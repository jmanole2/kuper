// Temas con IA: lee las conversaciones recientes de la marca, agrupa de qué pregunta la gente, detecta lo que el
// agente no supo contestar y propone texto para agregar a "Lo que sabe tu agente" (se agrega con un clic).
// Se guarda el último análisis en la config de la marca; máximo uno cada 6 h para cuidar el costo.
import * as db from './db.js';
import * as conocimiento from './conocimiento.js';
import { pedirJSON } from './llm/proveedor.js';

export const hooks = { ia: (...a) => pedirJSON(...a), ahora: () => new Date() }; // pruebas
export const CADA_HORAS = 6;
const MAX_CONV = 150;

export const ultimo = (client) => client?.config?.temas_ia || null;

/** Conversaciones del periodo, compactas (sin teléfonos ni correos). */
export function conversaciones(client, dias = 30) {
  const d = db.getDb();
  const leads = d.prepare(`SELECT DISTINCT l.id FROM leads l JOIN lead_mensajes m ON m.lead_id = l.id
    WHERE l.client_id = ? AND l.ajena = 0 AND m.rol = 'lead' AND datetime(m.created_at) >= datetime('now', ?) ORDER BY l.updated_at DESC LIMIT ?`).all(client.id, `-${dias} days`, MAX_CONV);
  const msgs = d.prepare('SELECT rol, texto FROM (SELECT id, rol, texto FROM lead_mensajes WHERE lead_id = ? ORDER BY id DESC LIMIT 14) ORDER BY id');
  const limpiar = (t) => String(t).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[correo]').replace(/\+?\d[\d\s-]{8,}\d/g, '[teléfono]').slice(0, 220);
  return leads.map(({ id }) => msgs.all(id).map((m) => `${m.rol === 'lead' ? 'Cliente' : m.rol === 'humano' ? 'Equipo' : 'Agente'}: ${limpiar(m.texto)}`).join('\n')).filter(Boolean);
}

const S = { type: 'string' }, I = { type: 'integer' };
const obj = (props) => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });
const SCHEMA = obj({
  temas: { type: 'array', items: obj({ tema: S, conversaciones: I, ejemplo: S }) },
  sin_respuesta: { type: 'array', items: obj({ pregunta: S, veces: I }) },
  sugerencias: { type: 'array', items: obj({ titulo: S, por_que: S, texto: S }) },
});

export async function analizar(client, { dias = 30, forzar = false, autor = '' } = {}) {
  const prev = ultimo(client);
  const ahora = hooks.ahora();
  if (!forzar && prev?.fecha && ahora - new Date(prev.fecha) < CADA_HORAS * 3600_000) throw new Error(`Ya se analizó hace poco. Puedes volver a hacerlo cada ${CADA_HORAS} horas.`);
  const convs = conversaciones(client, dias);
  if (convs.length < 3) throw new Error('Todavía hay muy pocas conversaciones en el periodo para analizar.');
  const k = conocimiento.actual(client.id);
  const system = `Analizas las conversaciones de WhatsApp/Instagram del negocio "${client.nombre}" con sus clientes. Responde en español.
1. "temas": agrupa de qué escribe la gente (máx. 10, de más a menos frecuente). "conversaciones" = en cuántas aparece; "ejemplo" = una frase típica parafraseada (sin nombres ni datos personales).
2. "sin_respuesta": preguntas que el agente NO supo contestar, contestó con evasivas, dijo que no tenía la información o pasó al equipo por no saber (máx. 10).
3. "sugerencias": máx. 6 cosas concretas para agregar a lo que sabe el agente, para que conteste mejor. "texto" es el párrafo listo para pegar en su base de conocimiento, escrito como información del negocio. Si no sabes el dato real (precio, horario, etc.), escribe el texto con [completar: …] en lugar de inventarlo. No sugieras lo que ya está en la información actual.
INFORMACIÓN ACTUAL DEL AGENTE:
${String(k?.texto || '(vacía)').slice(0, 8000)}`;
  const r = await hooks.ia({ system, messages: [{ role: 'user', content: `${convs.length} conversaciones de los últimos ${dias} días:\n\n${convs.map((c, i) => `--- Conversación ${i + 1}\n${c}`).join('\n\n')}` }], schema: SCHEMA, maxTokens: 4000, etiqueta: 'temas_ia' });
  const t = (x, n) => String(x || '').slice(0, n);
  const res = {
    fecha: ahora.toISOString(), dias, conversaciones: convs.length, autor: t(autor, 80),
    temas: (r.data?.temas || []).slice(0, 10).map((x) => ({ tema: t(x.tema, 80), conversaciones: Math.max(0, Math.round(Number(x.conversaciones) || 0)), ejemplo: t(x.ejemplo, 200) })),
    sin_respuesta: (r.data?.sin_respuesta || []).slice(0, 10).map((x) => ({ pregunta: t(x.pregunta, 200), veces: Math.max(1, Math.round(Number(x.veces) || 1)) })),
    sugerencias: (r.data?.sugerencias || []).slice(0, 6).map((x) => ({ titulo: t(x.titulo, 100), por_que: t(x.por_que, 240), texto: t(x.texto, 1500), agregada: false })),
  };
  db.updateClient(client.id, { config: { ...db.getClient(client.id).config, temas_ia: res } });
  db.logEvent({ clientId: client.id, tipo: 'temas_ia', detalle: `${convs.length} conversaciones · ${res.temas.length} temas · ${res.sugerencias.length} sugerencias` });
  return res;
}

/** Agrega una sugerencia (quizá editada) a lo que sabe el agente, como versión nueva. */
export function agregarSugerencia(client, i, texto, autor) {
  const ult = ultimo(client);
  const s = ult?.sugerencias?.[Number(i)];
  if (!s) throw new Error('Esa sugerencia ya no existe. Vuelve a analizar.');
  const nuevo = String(texto ?? s.texto).replace(/\r\n/g, '\n').trim().slice(0, 2000);
  if (!nuevo) throw new Error('El texto está vacío.');
  const k = conocimiento.actual(client.id);
  conocimiento.guardar(client.id, { texto: `${String(k?.texto || '').trim()}\n\n## ${s.titulo}\n${nuevo}`.trim(), datos: k?.datos || {} }, autor);
  const sugerencias = ult.sugerencias.map((x, j) => (j === Number(i) ? { ...x, agregada: true } : x));
  db.updateClient(client.id, { config: { ...db.getClient(client.id).config, temas_ia: { ...ult, sugerencias } } });
}
