// Agente de comentarios: la IA contesta los comentarios de Instagram y Facebook (posts y anuncios de Facebook).
// Cada pocos minutos revisa los comentarios nuevos y, para cada uno, decide con lo que sabe el agente:
//   - respuesta pública corta (o ninguna si es solo un emoji o etiqueta a un amigo),
//   - mensaje directo cuando la persona quiere comprar, cotizar o pregunta algo que no va en público,
//   - ocultar spam u ofensas, y avisar al equipo si es una queja.
// Modo "revisión": nada sale hasta que alguien lo aprueba en el panel. La primera vez que corre solo registra
// los comentarios que ya existían (no contesta lo viejo). Si la palabra clave está activa, ese comentario lo
// atiende la palabra clave y aquí se salta.
//
// Configuración (client.config.comentarios):
//   { activo, pausado, instagram, facebook, anuncios, publico, dm, ocultar, revision, instrucciones }
// Permisos del token de la página: instagram_manage_comments, pages_manage_engagement, pages_read_engagement,
// pages_messaging e instagram_manage_messages (para el mensaje directo).
import { graphCall } from '../publishers/meta.js';
import { config } from '../config.js';
import * as db from '../db.js';
import * as conoc from '../conocimiento.js';
import { pedirJSON } from '../llm/proveedor.js';
import { matchesKeyword } from './keyword.js';

export const hooks = { graph: (...a) => graphCall(...a), ia: (...a) => pedirJSON(...a) }; // pruebas

export const DEFAULTS = { activo: false, pausado: false, instagram: true, facebook: true, anuncios: true, publico: true, dm: true, ocultar: true, revision: false, instrucciones: '' };
export const ajustes = (client) => ({ ...DEFAULTS, ...(client.config?.comentarios || {}) });

export const ESTADOS = {
  por_aprobar: ['Por aprobar', '#fbbf24'],
  enviado: ['Contestado', '#4ade80'],
  oculto: ['Oculto', '#a39d93'],
  ignorado: ['Sin respuesta', '#a39d93'],
  descartado: ['Descartado', '#a39d93'],
  simulado: ['Simulado', '#93b4ff'],
  error: ['Error', '#f87171'],
};
export const INTENCIONES = { compra: 'Quiere comprar', pregunta: 'Pregunta', elogio: 'Elogio', queja: 'Queja', spam: 'Spam', ofensivo: 'Ofensivo', etiqueta: 'Etiqueta a alguien', otro: 'Otro' };

const MAX_POR_VUELTA = 25;
const DIAS_DM = 7; // Meta solo permite la respuesta privada dentro de 7 días
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

let tablas = false;
const d = () => { if (!tablas) { tablas = true; ensureTables(); } return db.getDb(); };
export function ensureTables() {
  tablas = true;
  db.getDb().exec(`CREATE TABLE IF NOT EXISTS comentarios (
    comment_id TEXT PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    canal TEXT NOT NULL,
    post_id TEXT,
    post_link TEXT,
    post_texto TEXT,
    anuncio INTEGER NOT NULL DEFAULT 0,
    usuario TEXT,
    usuario_id TEXT,
    texto TEXT,
    comentado_at TEXT,
    intencion TEXT,
    publica TEXT,
    dm TEXT,
    ocultar INTEGER NOT NULL DEFAULT 0,
    avisar INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    error TEXT,
    autor TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS comentarios_cliente ON comentarios(client_id, created_at);`);
}
const visto = (id) => !!d().prepare('SELECT 1 FROM comentarios WHERE comment_id = ?').get(id);
const hayBase = (clientId) => !!db.kvGet(`comentarios_base_${clientId}`);
function guardar(clientId, c, extra) {
  d().prepare(`INSERT OR REPLACE INTO comentarios (comment_id, client_id, canal, post_id, post_link, post_texto, anuncio, usuario, usuario_id, texto, comentado_at,
    intencion, publica, dm, ocultar, avisar, status, error, autor, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
    .run(c.id, clientId, c.canal, c.post_id || null, c.post_link || null, String(c.post_texto || '').slice(0, 400), c.anuncio ? 1 : 0, c.usuario || null, c.usuario_id || null,
      String(c.texto || '').slice(0, 2000), c.comentado_at || null, extra.intencion || null, extra.publica || null, extra.dm || null, extra.ocultar ? 1 : 0, extra.avisar ? 1 : 0,
      extra.status, extra.error || null, extra.autor || null);
}
export const listar = (clientId, { status = '', limit = 100 } = {}) => d().prepare(
  `SELECT * FROM comentarios WHERE client_id = ? ${status ? 'AND status = ?' : "AND status NOT IN ('base')"} ORDER BY datetime(COALESCE(comentado_at, created_at)) DESC LIMIT ?`)
  .all(...[clientId, ...(status ? [status] : []), limit]);
export const obtener = (clientId, id) => d().prepare('SELECT * FROM comentarios WHERE client_id = ? AND comment_id = ?').get(clientId, String(id));
export function resumen(clientId, dias = 30) {
  const filas = d().prepare(`SELECT status, intencion, COUNT(*) n FROM comentarios WHERE client_id = ? AND status != 'base' AND datetime(created_at) >= datetime('now', ?) GROUP BY status, intencion`)
    .all(clientId, `-${dias} days`);
  const suma = (f) => filas.filter(f).reduce((a, x) => a + x.n, 0);
  return { total: suma(() => true), contestados: suma((x) => x.status === 'enviado'), por_aprobar: suma((x) => x.status === 'por_aprobar'),
    ocultos: suma((x) => x.status === 'oculto'), compra: suma((x) => x.intencion === 'compra'), quejas: suma((x) => x.intencion === 'queja') };
}

// ------------------------------------------------------------ leer comentarios de Meta
async function deInstagram(meta, own) {
  const r = await hooks.graph('GET', `${meta.ig_user_id}/media`, {
    fields: 'id,permalink,caption,timestamp,comments.limit(50){id,text,timestamp,username,from,replies{username}}', limit: '12' }, meta.page_token);
  const out = [];
  for (const m of r.data || []) {
    for (const c of m.comments?.data || []) {
      // Si la marca ya contestó ese comentario (a mano), no se toca.
      const yaContestado = (c.replies?.data || []).some((x) => own && norm(x.username) === norm(own));
      out.push({ id: c.id, canal: 'instagram', post_id: m.id, post_link: m.permalink, post_texto: m.caption, usuario: c.username || c.from?.username, usuario_id: c.from?.id,
        texto: c.text, comentado_at: c.timestamp, propio: own && norm(c.username) === norm(own), yaContestado });
    }
  }
  return out;
}
async function deFacebook(meta, { anuncios }) {
  const fields = 'id,permalink_url,message,created_time,comments.limit(50).filter(toplevel){id,message,created_time,from,comments.limit(10){from}}';
  const fuentes = [['published_posts', false], ...(anuncios ? [['ads_posts', true]] : [])];
  const out = [];
  for (const [edge, anuncio] of fuentes) {
    let r;
    try { r = await hooks.graph('GET', `${meta.page_id}/${edge}`, { fields, limit: '12' }, meta.page_token); }
    catch (e) { if (anuncio) continue; throw e; } // los posts de anuncios pueden no estar permitidos; los normales sí deben leerse
    for (const p of r.data || []) {
      for (const c of p.comments?.data || []) {
        const yaContestado = (c.comments?.data || []).some((x) => x.from?.id === meta.page_id);
        out.push({ id: c.id, canal: 'facebook', anuncio, post_id: p.id, post_link: p.permalink_url, post_texto: p.message, usuario: c.from?.name, usuario_id: c.from?.id,
          texto: c.message, comentado_at: c.created_time, propio: c.from?.id === meta.page_id, yaContestado });
      }
    }
  }
  return out;
}

// ------------------------------------------------------------ decidir con la IA
const S = { type: 'string' };
export const SCHEMA = { type: 'object', additionalProperties: false, required: ['respuestas'], properties: { respuestas: { type: 'array', items: {
  type: 'object', additionalProperties: false, required: ['id', 'intencion', 'publica', 'dm', 'ocultar', 'avisar'],
  properties: { id: S, intencion: { type: 'string', enum: Object.keys(INTENCIONES) }, publica: S, dm: S, ocultar: { type: 'boolean' }, avisar: { type: 'boolean' } } } } } };

export function instrucciones(client, aj, saber) {
  return `Eres quien contesta los comentarios de Instagram y Facebook de ${client.nombre}. Hablas como la marca: cálido, breve y natural, en el idioma del comentario (español de México si no se nota otro).

## Lo que sabe la marca (no inventes nada fuera de esto)
${saber || '(Sin información cargada: no des precios, horarios ni datos; invita a escribir por mensaje.)'}

## Cómo decidir cada comentario
- intencion: compra (quiere comprar, pedir, cotizar, precio, reservar), pregunta, elogio, queja, spam, ofensivo, etiqueta (solo menciona a otra persona) u otro.
- publica: ${aj.publico ? 'respuesta pública de máximo 2 frases cortas (200 caracteres). Sin hashtags. Máximo un emoji. Si es solo un emoji, una etiqueta a un amigo o spam, déjala vacía.' : 'déjala siempre vacía (la marca no contesta en público).'}
- dm: ${aj.dm ? 'mensaje directo solo si la persona quiere comprar o cotizar, o si la respuesta necesita datos que no van en público (precios por persona, pedidos, datos de contacto). Lo prometido va primero y termina con una pregunta corta. Máximo 3 frases. Si mandas dm, la respuesta pública dice que le escribiste por mensaje.' : 'déjalo siempre vacío.'}
- ocultar: ${aj.ocultar ? 'true solo para spam, estafas, links sospechosos u ofensas; nunca para quejas reales.' : 'siempre false.'}
- avisar: true si es una queja, un problema con un pedido, algo delicado o algo que no sabes contestar.
- Si es una queja: responde con empatía en público, sin discutir ni dar explicaciones largas, y ofrece seguir por mensaje.
- Nunca prometas precios, descuentos, disponibilidad ni tiempos que no estén en lo que sabe la marca.
- No repitas la misma respuesta pública en varios comentarios: varía las palabras.
${aj.instrucciones ? `\n## Indicaciones de la marca (tienen prioridad)\n${aj.instrucciones}\n` : ''}
Devuelve una respuesta por cada comentario, con el mismo id.`;
}

async function decidir(client, aj, comentarios) {
  const saber = conoc.actual(client.id)?.texto || '';
  const lista = comentarios.map((c) => ({ id: c.id, canal: c.canal, anuncio: !!c.anuncio, post: String(c.post_texto || '').slice(0, 200), usuario: c.usuario || '', comentario: String(c.texto || '').slice(0, 600) }));
  const r = await hooks.ia({ system: instrucciones(client, aj, saber.slice(0, 12000)), schema: SCHEMA, maxTokens: 4000, etiqueta: 'comentarios',
    messages: [{ role: 'user', content: `Comentarios nuevos:\n${JSON.stringify(lista, null, 1)}` }] });
  const porId = new Map((r.data?.respuestas || []).map((x) => [String(x.id), x]));
  return comentarios.map((c) => ({ c, d: porId.get(String(c.id)) || null }));
}

// ------------------------------------------------------------ mandar
async function publicar(meta, row, { publica, dm, ocultar }) {
  const hechos = [];
  if (ocultar) {
    await hooks.graph('POST', row.comment_id, row.canal === 'instagram' ? { hide: 'true' } : { is_hidden: 'true' }, meta.page_token);
    return ['oculto'];
  }
  if (dm) {
    const viejo = row.comentado_at && Date.now() - new Date(row.comentado_at) > DIAS_DM * 86400000;
    if (!viejo) {
      await hooks.graph('POST', `${meta.page_id}/messages`, { recipient: JSON.stringify({ comment_id: row.comment_id }), message: JSON.stringify({ text: dm }) }, meta.page_token);
      hechos.push('dm');
    }
  }
  if (publica) {
    await hooks.graph('POST', row.canal === 'instagram' ? `${row.comment_id}/replies` : `${row.comment_id}/comments`, { message: publica }, meta.page_token);
    hechos.push('publica');
  }
  return hechos;
}

/** Manda lo que decidió la IA (o lo que editó el equipo) y deja el registro. */
export async function enviar(client, row, { publica = row.publica, dm = row.dm, ocultar = !!row.ocultar, autor = 'IA' } = {}) {
  const creds = db.clientCredentials(client);
  const meta = creds.meta || {};
  const base = { intencion: row.intencion, publica, dm, ocultar, avisar: !!row.avisar, autor };
  const c = { id: row.comment_id, canal: row.canal, post_id: row.post_id, post_link: row.post_link, post_texto: row.post_texto, anuncio: row.anuncio, usuario: row.usuario,
    usuario_id: row.usuario_id, texto: row.texto, comentado_at: row.comentado_at };
  if (!publica && !dm && !ocultar) { guardar(client.id, c, { ...base, status: 'ignorado' }); return 'ignorado'; }
  if (config.dryRun || creds.dry_run) { guardar(client.id, c, { ...base, status: 'simulado' }); return 'simulado'; }
  try {
    const hechos = await publicar(meta, row, { publica, dm, ocultar });
    const status = hechos.includes('oculto') ? 'oculto' : 'enviado';
    guardar(client.id, c, { ...base, status });
    if (hechos.includes('dm') && row.intencion === 'compra' && row.usuario) {
      try { db.upsertLead(client.id, { usuario: row.canal === 'instagram' ? row.usuario : null, nombre: row.canal === 'facebook' ? row.usuario : null,
        telefono: null, email: null, origen: row.canal, nota: `Comentó: "${String(row.texto).slice(0, 120)}"` }); } catch { /* Facebook sin usuario: queda en comentarios */ }
    }
    db.logEvent({ clientId: client.id, tipo: 'comentario', detalle: `${row.canal} ${row.usuario || ''}: ${status}${hechos.includes('dm') ? ' + DM' : ''}` });
    return status;
  } catch (e) {
    guardar(client.id, c, { ...base, status: 'error', error: e.message });
    db.logEvent({ clientId: client.id, tipo: 'comentario_error', detalle: `${row.canal} ${row.usuario || ''}: ${e.message}` });
    return 'error';
  }
}

/** Una vuelta: lee comentarios nuevos, la IA decide y se manda (o queda por aprobar). */
export async function revisar(client, { now = new Date() } = {}) {
  const aj = ajustes(client);
  if (!aj.activo || aj.pausado) return { revisados: 0, nuevos: 0 };
  const meta = db.clientCredentials(client).meta || {};
  if (!meta.page_token || (!meta.page_id && !meta.ig_user_id)) return { revisados: 0, nuevos: 0, error: 'faltan credenciales de Meta' };
  ensureTables();

  const todos = [];
  if (aj.instagram && meta.ig_user_id) {
    const own = (await hooks.graph('GET', meta.ig_user_id, { fields: 'username' }, meta.page_token)).username;
    todos.push(...await deInstagram(meta, own));
  }
  if (aj.facebook && meta.page_id) todos.push(...await deFacebook(meta, aj));

  const primera = !hayBase(client.id);
  const kw = client.config?.respuesta_palabra_clave;
  const nuevos = [];
  for (const c of todos) {
    if (visto(c.id)) continue;
    const base = primera || c.propio || c.yaContestado || (kw?.activo && c.canal === 'instagram' && matchesKeyword(c.texto, kw.palabra));
    if (base) { guardar(client.id, c, { status: 'base' }); continue; }
    nuevos.push(c);
  }
  if (primera) db.kvSet(`comentarios_base_${client.id}`, now.toISOString());
  if (!nuevos.length) return { revisados: todos.length, nuevos: 0 };

  const lote = nuevos.sort((a, b) => String(a.comentado_at).localeCompare(String(b.comentado_at))).slice(0, MAX_POR_VUELTA);
  const decisiones = await decidir(client, aj, lote);
  let enviados = 0, porAprobar = 0;
  for (const { c, d: x } of decisiones) {
    if (!x) continue; // la IA no lo contestó: se intenta en la siguiente vuelta
    const row = { comment_id: c.id, canal: c.canal, post_id: c.post_id, post_link: c.post_link, post_texto: c.post_texto, anuncio: c.anuncio, usuario: c.usuario, usuario_id: c.usuario_id,
      texto: c.texto, comentado_at: c.comentado_at, intencion: x.intencion, publica: aj.publico ? x.publica.trim() : '', dm: aj.dm ? x.dm.trim() : '', ocultar: aj.ocultar && x.ocultar, avisar: x.avisar };
    if (x.avisar) db.logEvent({ clientId: client.id, tipo: 'comentario_atencion', detalle: `${c.canal} ${c.usuario || ''}: "${String(c.texto).slice(0, 140)}"` });
    if (aj.revision && (row.publica || row.dm || row.ocultar)) {
      guardar(client.id, c, { intencion: row.intencion, publica: row.publica, dm: row.dm, ocultar: row.ocultar, avisar: row.avisar, status: 'por_aprobar' });
      porAprobar++;
      continue;
    }
    if ((await enviar(client, row)) === 'enviado') enviados++;
  }
  return { revisados: todos.length, nuevos: lote.length, enviados, por_aprobar: porAprobar };
}

/** El equipo aprueba (con o sin cambios) o descarta un comentario que estaba por aprobar. */
export async function aprobar(client, id, { publica, dm, autor } = {}) {
  const row = obtener(client.id, id);
  if (!row) throw new Error('Comentario no encontrado.');
  if (!['por_aprobar', 'error'].includes(row.status)) throw new Error('Ese comentario ya se atendió.');
  return enviar(client, row, { publica: publica !== undefined ? String(publica).trim().slice(0, 1000) : row.publica, dm: dm !== undefined ? String(dm).trim().slice(0, 1000) : row.dm, ocultar: !!row.ocultar, autor });
}
export function descartar(client, id, autor) {
  const row = obtener(client.id, id);
  if (!row) throw new Error('Comentario no encontrado.');
  d().prepare("UPDATE comentarios SET status = 'descartado', autor = ?, updated_at = datetime('now') WHERE comment_id = ?").run(autor || null, row.comment_id);
}
