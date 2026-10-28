// A qué IA se le pide cada cosa (posts, animaciones, competencia, adaptar a otras redes).
// Orden por defecto: Gemini con la clave gratis (GEMINI_TEXT_API_KEY) y, si falla o llega a su
// límite del día, Claude (ANTHROPIC_API_KEY). POSTS_LLM_ORDEN=anthropic,gemini lo invierte.
// Los mensajes llegan en el formato de Claude (texto, imágenes, bloques de razonamiento) y aquí
// se traducen para Gemini.
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

export class RefusalError extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const hooks = { fetch: (...a) => fetch(...a), anthropic: null, esperaMs: null }; // pruebas

// Si un proveedor se quedó sin cupo o falló, se salta un rato para no esperar en cada pieza.
const pausa = new Map();
export const _reset = () => pausa.clear();
const PAUSA_MS = { cupo: 60 * 60_000, error: 10 * 60_000 };

export function orden() {
  const pedido = String(config.postsLlmOrden || '').split(',').map((s) => s.trim()).filter(Boolean);
  const hay = { gemini: !!config.geminiTextApiKey, anthropic: !!process.env.ANTHROPIC_API_KEY || !!hooks.anthropic };
  const base = pedido.length ? pedido : ['gemini', 'anthropic'];
  return base.filter((p) => hay[p]);
}

/** Pide una respuesta JSON que cumpla `schema`. Devuelve { data, content, proveedor }. */
export async function pedirJSON({ system, messages, schema, maxTokens = 32000, effort = config.anthropicEffort, etiqueta = 'post' }) {
  const lista = orden();
  if (!lista.length) throw new Error('No hay IA configurada: falta GEMINI_TEXT_API_KEY o ANTHROPIC_API_KEY en el .env del panel.');
  const activos = lista.filter((p) => !(pausa.get(p) > Date.now()));
  const intentar = activos.length ? activos : lista;
  let ultimo;
  for (let i = 0; i < intentar.length; i++) {
    const p = intentar[i];
    try {
      const r = p === 'gemini'
        ? await gemini({ system, messages, schema, maxTokens })
        : await claude({ system, messages, schema, maxTokens, effort });
      pausa.delete(p);
      console.log(`[ia] ${etiqueta}: ${p} ${r.modelo} entrada=${r.uso.entrada} salida=${r.uso.salida}`);
      return { data: r.data, content: r.content, proveedor: p };
    } catch (e) {
      ultimo = e;
      if (e instanceof RefusalError && i === intentar.length - 1) throw e;
      if (i < intentar.length - 1) pausa.set(p, Date.now() + (e.cupo ? PAUSA_MS.cupo : PAUSA_MS.error));
      console.error(`[ia] ${etiqueta}: ${p} falló${i < intentar.length - 1 ? ', pruebo con el siguiente' : ''}: ${e.message}`);
    }
  }
  throw ultimo;
}

// ------------------------------------------------------------ Gemini (REST)
/** Mensajes de Claude → contenidos de Gemini (sin bloques de razonamiento). */
export function aGemini(messages) {
  const partes = (content) => {
    if (typeof content === 'string') return [{ text: content }];
    return (content || []).flatMap((b) => {
      if (b.type === 'text' && b.text) return [{ text: b.text }];
      if (b.type === 'image' && b.source?.type === 'base64') return [{ inline_data: { mime_type: b.source.media_type, data: b.source.data } }];
      return []; // thinking, redacted_thinking, etc.
    });
  };
  return messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: partes(m.content) }))
    .filter((m) => m.parts.length);
}

async function gemini({ system, messages, schema, maxTokens }) {
  const modelo = config.geminiTextModel;
  // En modo "stream" Gemini manda el texto conforme lo escribe: la conexión nunca se queda callada
  // (Node corta una petición que tarda más de 5 min en empezar a responder: "fetch failed").
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:streamGenerateContent?alt=sse`;
  const cuerpo = (conEsquema) => ({
    systemInstruction: { parts: [{ text: conEsquema ? system : `${system}\n\nResponde SOLO con un objeto JSON que cumpla este esquema:\n${JSON.stringify(schema)}` }] },
    contents: aGemini(messages),
    generationConfig: {
      responseMimeType: 'application/json', ...(conEsquema ? { responseJsonSchema: schema } : {}), maxOutputTokens: Math.min(maxTokens, 65536), temperature: 1,
      // Pensar poco: es más rápido y el pensamiento cuenta como texto de salida.
      ...(conPensamiento && config.geminiThinking !== 'default' ? { thinkingConfig: { thinkingLevel: config.geminiThinking } } : {}),
    },
  });
  let conEsquema = true, conPensamiento = true, intento = 0;
  for (;;) {
    intento++;
    const res = await hooks.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.geminiTextApiKey },
      body: JSON.stringify(cuerpo(conEsquema)),
      signal: AbortSignal.timeout(config.geminiTimeoutMs),
    }).catch((e) => {
      const causa = e.cause?.code || e.cause?.message || '';
      // Se tardó demasiado o se cortó la conexión: se reintenta una vez antes de pasar al siguiente proveedor.
      if (intento < 2 && /abort|timeout|fetch failed|socket|ECONN|ETIMEDOUT|EAI_AGAIN/i.test(`${e.message} ${causa}`)) { console.error(`[ia] Gemini no respondió (${causa || e.message}), reintento una vez`); return null; }
      throw new Error(`Gemini no respondió: ${e.message}${causa ? ` (${causa})` : ''}`);
    });
    if (!res) { await sleep(3000); continue; }
    const j = await leerRespuesta(res);
    if (res.ok) {
      const cand = j.candidates?.[0];
      if (!cand) throw new Error(`Gemini no devolvió respuesta (${j.promptFeedback?.blockReason || 'sin motivo'})`);
      if (cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT') throw new RefusalError(`Gemini declinó (${cand.finishReason}).`);
      if (cand.finishReason === 'MAX_TOKENS') throw new Error('La respuesta de Gemini se cortó por longitud.');
      const texto = (cand.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('');
      let data;
      try { data = JSON.parse(texto.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { throw new Error('Gemini devolvió un JSON que no se pudo leer.'); }
      const u = j.usageMetadata || {};
      return { data, content: texto, modelo, uso: { entrada: u.promptTokenCount || 0, salida: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) } };
    }
    const msg = j.error?.message || `HTTP ${res.status}`;
    // El esquema tiene algo que Gemini no acepta: se pide el JSON con el esquema en las instrucciones.
    if (res.status === 400 && conEsquema && /schema|responseJsonSchema/i.test(msg)) { conEsquema = false; continue; }
    if (res.status === 400 && conPensamiento && /think/i.test(msg)) { conPensamiento = false; continue; }
    const e = new Error(`Gemini ${res.status}: ${msg}`);
    if (res.status === 429) { e.cupo = true; throw e; } // límite gratis del día o del minuto
    // Saturado (503 "high demand") o falla momentánea: espera un poco más cada vez (15 s, 45 s) y reintenta.
    if ([500, 502, 503, 504].includes(res.status) && intento < 3) { console.error(`[ia] Gemini ${res.status}, reintento en ${intento * 15 * (intento === 1 ? 1 : 1.5)} s`); await sleep(hooks.esperaMs ?? intento * 15000 * (intento === 1 ? 1 : 1.5)); continue; }
    throw e;
  }
}

/** Junta la respuesta de Gemini: en stream (líneas "data: {...}") o un JSON normal (errores). */
async function leerRespuesta(res) {
  const crudo = res.text ? await res.text().catch(() => '') : JSON.stringify(await res.json().catch(() => ({})));
  if (!/^\s*data:/.test(crudo)) { try { return JSON.parse(crudo); } catch { return {}; } }
  const partes = [], out = {};
  let finishReason;
  for (const linea of crudo.split(/\r?\n/)) {
    if (!linea.startsWith('data:')) continue;
    let ev; try { ev = JSON.parse(linea.slice(5).trim()); } catch { continue; }
    const c = ev.candidates?.[0];
    if (c?.content?.parts) partes.push(...c.content.parts);
    if (c?.finishReason) finishReason = c.finishReason;
    if (ev.usageMetadata) out.usageMetadata = ev.usageMetadata;
    if (ev.promptFeedback) out.promptFeedback = ev.promptFeedback;
    if (ev.error) out.error = ev.error;
  }
  if (partes.length || finishReason) out.candidates = [{ content: { parts: partes }, finishReason }];
  return out;
}

// ------------------------------------------------------------ Claude
let cliente;
const anthropic = () => hooks.anthropic || (cliente ??= new Anthropic());

async function claude({ system, messages, schema, maxTokens, effort }) {
  const pedir = (completo) => anthropic().beta.messages.stream({
    model: config.anthropicModel,
    max_tokens: maxTokens,
    ...(completo ? { thinking: { type: 'adaptive' } } : {}),
    output_config: { ...(completo ? { effort } : {}), format: { type: 'json_schema', schema } },
    // Si el modelo declina por política, el servidor reintenta con el modelo de respaldo recomendado.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages,
  }).finalMessage();
  let msg;
  try { msg = await pedir(true); } catch (e) {
    // Modelos chicos (p. ej. Haiku) pueden no aceptar razonamiento o "effort": se pide sin ellos.
    if (e?.status === 400 && /thinking|effort/i.test(e.message || '')) msg = await pedir(false);
    else throw e;
  }
  if (msg.stop_reason === 'refusal') throw new RefusalError(`Claude declinó la solicitud (${msg.stop_details?.category ?? 'sin categoría'}).`);
  if (msg.stop_reason === 'max_tokens') throw new Error('La respuesta de Claude se cortó por max_tokens.');
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const u = msg.usage || {};
  return { data: JSON.parse(text), content: msg.content, modelo: config.anthropicModel, uso: { entrada: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0), salida: u.output_tokens || 0 } };
}
