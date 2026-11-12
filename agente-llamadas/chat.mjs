// Chat de la página de demo: la misma asistente que contesta llamadas, pero escribiendo.
// Usa las mismas instrucciones que la voz (prompt.mjs) con Claude (ANTHROPIC_API_KEY en el .env).
// No guarda nada: el navegador manda la conversación completa en cada mensaje.
import { construirPrompt } from './prompt.mjs';

export const hooks = { fetch: (...a) => fetch(...a) }; // pruebas
const MAX_MENSAJES = 30, MAX_TEXTO = 1200;

// Claude directo (ANTHROPIC_API_KEY) o por OpenRouter (LLM_API_KEY, la misma que usan los agentes de WhatsApp).
export const chatConfigurado = (env = process.env) => Boolean(env.ANTHROPIC_API_KEY || env.LLM_API_KEY);

function fechaLocal(tz, t = Date.now()) {
  return new Intl.DateTimeFormat('es-MX', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' }).format(t);
}
function calendario(tz, t = Date.now()) {
  const f = new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' });
  return Array.from({ length: 14 }, (_, i) => `- ${f.format(t + i * 86400000)}`).join('\n');
}

/** Instrucciones para el chat: las de la voz con las variables de Retell resueltas y reglas de texto. */
export function promptChat(cfg, { infoPanel = '', ahora = Date.now(), variables = {} } = {}) {
  const tz = cfg.zona_horaria || 'America/Mexico_City';
  const base = construirPrompt(cfg, { transferir: '', conFunciones: false })
    .replaceAll(`{{current_time_${tz}}}`, fechaLocal(tz, ahora))
    .replaceAll(`{{current_calendar_${tz}}}`, `\n${calendario(tz, ahora)}`)
    .replaceAll('{{direction}}', 'chat escrito en la página web (no es llamada)')
    .replaceAll('{{nombre_cliente}}', variables.nombre_cliente || 'desconocido')
    .replaceAll('{{motivo_llamada}}', variables.motivo_llamada || 'ninguno')
    .replaceAll('{{modo_llamada}}', 'atender')
    .replaceAll('{{info_panel}}', infoPanel || 'Sin cambios recientes.');
  return `${base}

## Este canal es un chat escrito (va antes que todo lo de arriba sobre llamadas)
- La persona te escribe desde el chat de la página web; no es una llamada. Ignora lo que diga arriba sobre voz, colgar o terminar la llamada, y no digas "gracias por llamar".
- Aquí SÍ puedes usar números, ${cfg.moneda ? `el signo ${cfg.simbolo_moneda || ''} ` : 'signos de pesos '}y porcentajes normales (${cfg.moneda ? `1.545 ${cfg.simbolo_moneda || ''}` : '$15,500'}, 24/7, 10 %), y escribir correos y ligas tal cual.
- Respuestas cortas: de una a tres frases, como en WhatsApp. Sin títulos ni listas largas; si hace falta enumerar, máximo tres puntos cortos.
- Haz una sola pregunta a la vez.
- Para datos de contacto no hace falta deletrear: repítelos tal cual para confirmarlos.
- Si la persona pide hablar con alguien, toma su nombre y su WhatsApp y dile que una persona del equipo le escribe.
- Tu primer mensaje ya se mostró (un saludo); no te vuelvas a presentar.`;
}

const herramientaDisponibilidad = {
  name: 'consultar_disponibilidad',
  description: 'Consulta en el sistema qué oficinas y puestos fijos están disponibles AHORA. Úsala SIEMPRE antes de decir si hay o no hay disponibilidad, y antes de ofrecer una oficina concreta.',
  input_schema: { type: 'object', properties: {
    sede: { type: 'string', description: 'Sede o zona que pidió. Vacío si no importa.' },
    personas: { type: 'number', description: 'Cuántas personas, si lo dijo.' },
    tipo: { type: 'string', enum: ['oficina privada', 'puesto fijo', ''], description: 'Qué busca, si lo dijo.' } } },
};

/** Limpia lo que manda el navegador: [{ rol: 'user' | 'assistant', texto }] alternados, empezando por user. */
export function limpiarMensajes(mensajes) {
  const out = [];
  for (const m of (Array.isArray(mensajes) ? mensajes : []).slice(-MAX_MENSAJES)) {
    const role = m?.rol === 'assistant' ? 'assistant' : 'user';
    const texto = String(m?.texto ?? '').trim().slice(0, MAX_TEXTO);
    if (!texto) continue;
    if (!out.length && role === 'assistant') continue; // el saludo inicial lo pone la página
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += `\n${texto}`;
    else out.push({ role, content: texto });
  }
  return out;
}

/**
 * Siguiente respuesta de la asistente.
 * disponibilidad: async (args) => texto, si la demo consulta disponibilidad en su panel.
 */
export async function responder({ cfg, mensajes, infoPanel = '', disponibilidad = null, variables = {}, env = process.env }) {
  const msgs = limpiarMensajes(mensajes);
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') throw new Error('sin_mensaje');
  const system = promptChat(cfg, { infoPanel, variables });
  if (!env.ANTHROPIC_API_KEY && env.LLM_API_KEY) return responderOpenRouter({ system, msgs, disponibilidad, env });
  const tools = disponibilidad ? [herramientaDisponibilidad] : undefined;
  for (let ronda = 0; ronda < 4; ronda++) {
    const r = await hooks.fetch(`${String(env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '')}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.CHAT_MODEL || env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: 600, system, messages: msgs, ...(tools ? { tools } : {}) }),
      signal: AbortSignal.timeout(30000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`anthropic ${r.status}: ${d?.error?.message || ''}`.trim());
    const usos = (d.content || []).filter((b) => b.type === 'tool_use');
    if (d.stop_reason !== 'tool_use' || !usos.length || !disponibilidad) {
      const texto = (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      return texto || 'Perdón, ¿me lo repites?';
    }
    msgs.push({ role: 'assistant', content: d.content });
    const resultados = [];
    for (const u of usos) {
      let res;
      try { res = await disponibilidad(u.input || {}); } catch { res = 'No pude revisar la disponibilidad. No digas que hay o que no hay lugar: ofrece que un asesor lo confirme.'; }
      resultados.push({ type: 'tool_result', tool_use_id: u.id, content: String(res) });
    }
    msgs.push({ role: 'user', content: resultados });
  }
  return 'Déjame confirmarlo con un asesor. ¿Me compartes tu nombre y tu WhatsApp para que te escriba?';
}

// OpenRouter (formato OpenAI). Modelo: CHAT_MODEL o LLM_MODEL (p. ej. anthropic/claude-haiku-5.5).
async function responderOpenRouter({ system, msgs, disponibilidad, env }) {
  const base = String(env.LLM_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
  const messages = [{ role: 'system', content: system }, ...msgs];
  const tools = disponibilidad ? [{ type: 'function', function: { name: herramientaDisponibilidad.name, description: herramientaDisponibilidad.description, parameters: herramientaDisponibilidad.input_schema } }] : undefined;
  for (let ronda = 0; ronda < 4; ronda++) {
    const r = await hooks.fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'Kuper demos' },
      body: JSON.stringify({ model: env.CHAT_MODEL || env.LLM_MODEL || 'anthropic/claude-haiku-5.5', max_tokens: 600, messages, ...(tools ? { tools } : {}) }),
      signal: AbortSignal.timeout(30000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) throw new Error(`openrouter ${r.status}: ${d?.error?.message || ''}`.trim());
    const m = d.choices?.[0]?.message || {};
    const llamadas = m.tool_calls || [];
    if (!llamadas.length || !disponibilidad) return String(m.content || '').trim() || 'Perdón, ¿me lo repites?';
    messages.push({ role: 'assistant', content: m.content || '', tool_calls: llamadas });
    for (const c of llamadas) {
      let args = {}; try { args = JSON.parse(c.function?.arguments || '{}'); } catch { /* sin argumentos */ }
      let res;
      try { res = await disponibilidad(args); } catch { res = 'No pude revisar la disponibilidad. No digas que hay o que no hay lugar: ofrece que un asesor lo confirme.'; }
      messages.push({ role: 'tool', tool_call_id: c.id, content: String(res) });
    }
  }
  return 'Déjame confirmarlo con un asesor. ¿Me compartes tu nombre y tu WhatsApp para que te escriba?';
}

/** Pide a la IA un objeto JSON (Claude directo u OpenRouter). Devuelve el objeto o lanza error. */
export async function pedirJSON({ system, texto, env = process.env, maxTokens = 2000 }) {
  let salida = '';
  if (env.ANTHROPIC_API_KEY) {
    const r = await hooks.fetch(`${String(env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '')}/v1/messages`, {
      method: 'POST', headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.CHAT_MODEL || env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: maxTokens, system, messages: [{ role: 'user', content: texto }] }),
      signal: AbortSignal.timeout(45000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`anthropic ${r.status}: ${d?.error?.message || ''}`.trim());
    salida = (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  } else if (env.LLM_API_KEY) {
    const r = await hooks.fetch(`${String(env.LLM_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST', headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'Kuper demos' },
      body: JSON.stringify({ model: env.CHAT_MODEL || env.LLM_MODEL || 'anthropic/claude-haiku-5.5', max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: texto }], response_format: { type: 'json_object' } }),
      signal: AbortSignal.timeout(45000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) throw new Error(`openrouter ${r.status}: ${d?.error?.message || ''}`.trim());
    salida = String(d.choices?.[0]?.message?.content || '');
  } else throw new Error('sin_ia');
  const m = salida.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('La IA no devolvió JSON');
  return JSON.parse(m[0]);
}
