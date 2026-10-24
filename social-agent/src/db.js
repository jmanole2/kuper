// Base de datos SQLite (módulo nativo node:sqlite, sin dependencias).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config, mediaDir } from './config.js';
import { encrypt, decrypt, randomToken } from './crypto.js';

// Estados de un post:
//   generando → (necesita_asset) → pendiente → aprobado → publicando → publicado
//   pendiente → cambios_solicitados → pendiente (se regenera con el feedback)
//   pendiente → rechazado          publicando → error (se puede reintentar)
//   generando → error_generacion
export const STATUS = {
  generando: 'Generando',
  necesita_asset: 'Falta foto/video real',
  pendiente: 'Esperando aprobación',
  cambios_solicitados: 'Aplicando cambios',
  aprobado: 'Aprobado / programado',
  publicando: 'Publicando',
  publicado: 'Publicado',
  rechazado: 'Rechazado',
  error: 'Error al publicar',
  error_generacion: 'Error al generar',
};
export const OPEN_STATUSES = ['generando', 'necesita_asset', 'pendiente', 'cambios_solicitados', 'aprobado', 'publicando'];
export const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'tiktok'];

let db;

export function openDb(file = path.join(config.dataDir, 'agente.db')) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.mkdirSync(mediaDir(), { recursive: true });
  db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      perfil_json TEXT NOT NULL,
      config_json TEXT NOT NULL,
      credentials_enc TEXT,
      logo_path TEXT,
      portal_token TEXT UNIQUE NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS competitors (
      id INTEGER PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      plataforma TEXT NOT NULL DEFAULT 'instagram',
      handle TEXT NOT NULL,
      notas TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS competitor_reports (
      id INTEGER PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      data_json TEXT NOT NULL,
      raw_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      plataforma TEXT NOT NULL,
      status TEXT NOT NULL,
      pilar TEXT,
      tema TEXT,
      formato TEXT,
      salida_json TEXT,
      variante INTEGER NOT NULL DEFAULT 0,
      copy_final TEXT,
      hashtags_json TEXT NOT NULL DEFAULT '[]',
      image_path TEXT,
      video_path TEXT,
      alt_text TEXT,
      scheduled_at TEXT,
      published_at TEXT,
      external_id TEXT,
      external_url TEXT,
      error TEXT,
      feedback TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS posts_client_status ON posts(client_id, status);
    CREATE TABLE IF NOT EXISTS keyword_replies (
      comment_id TEXT PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      media_id TEXT,
      username TEXT,
      texto TEXT,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      nombre TEXT,
      telefono TEXT,
      usuario TEXT,
      origen TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'nuevo',
      nota TEXT,
      cita_inicio TEXT,
      cita_evento TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS leads_client ON leads(client_id, updated_at);
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('admin', 'cliente')),
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      password_hash TEXT NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1,
      last_login TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS extras (
      id INTEGER PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      mes TEXT NOT NULL,
      plataforma TEXT NOT NULL,
      monto REAL NOT NULL DEFAULT 0,
      estado TEXT NOT NULL,
      factura TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS billing (
      client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
      stripe_customer TEXT,
      subscription_id TEXT,
      estado TEXT NOT NULL DEFAULT 'sin_tarjeta',
      tarjeta TEXT,
      proximo_cobro TEXT,
      ultimo_pago TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS lead_mensajes (
      id INTEGER PRIMARY KEY,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      rol TEXT NOT NULL,
      texto TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS lead_mensajes_lead ON lead_mensajes(lead_id, id);
    CREATE TABLE IF NOT EXISTS kv (
      k TEXT PRIMARY KEY,
      v TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY,
      post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      detalle TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  // Migraciones de columnas nuevas (bases creadas con versiones anteriores).
  const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  const ensure = (t, col, def) => { if (!cols(t).includes(col)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${col} ${def}`); };
  ensure('posts', 'images_json', "TEXT NOT NULL DEFAULT '[]'");
  ensure('posts', 'estructura', 'TEXT');
  ensure('posts', 'tipo_post', 'TEXT');
  ensure('posts', 'origen_id', 'INTEGER'); // post de Instagram del que se reutilizó el video/carrusel
  // Celulares de México: WhatsApp los manda como 521 + 10 dígitos; se guardan como +52 + 10 para no duplicar leads.
  db.exec("UPDATE leads SET telefono = '+52' || substr(telefono, 5) WHERE telefono LIKE '+521%' AND length(telefono) = 14");
  ensure('leads', 'control', "TEXT NOT NULL DEFAULT 'bot'"); // 'bot' | 'humano' (alguien tomó la conversación)
  ensure('lead_mensajes', 'autor', 'TEXT'); // quién respondió a mano desde el panel
  ensure('leads', 'email', 'TEXT'); // leads de llamadas por la web: a veces solo dejan su correo
  return db;
}

export const getDb = () => db || openDb();

// ------------------------------------------------------------------ clientes
function hydrateClient(row) {
  if (!row) return null;
  return {
    ...row,
    perfil: JSON.parse(row.perfil_json),
    config: JSON.parse(row.config_json),
    activo: !!row.activo,
  };
}

export function clientCredentials(client) {
  return decrypt(client.credentials_enc);
}

export function listClients() {
  return getDb().prepare('SELECT * FROM clients ORDER BY nombre').all().map(hydrateClient);
}
export const getClient = (id) => hydrateClient(getDb().prepare('SELECT * FROM clients WHERE id = ?').get(id));
export const getClientByToken = (t) => hydrateClient(getDb().prepare('SELECT * FROM clients WHERE portal_token = ?').get(t));

export function createClient({ slug, nombre, perfil, config: cfg, credentials = {} }) {
  const r = getDb()
    .prepare('INSERT INTO clients (slug, nombre, perfil_json, config_json, credentials_enc, portal_token) VALUES (?, ?, ?, ?, ?, ?)')
    .run(slug, nombre, JSON.stringify(perfil), JSON.stringify(cfg), encrypt(credentials), randomToken());
  return getClient(Number(r.lastInsertRowid));
}

export function updateClient(id, { nombre, perfil, config: cfg, credentials, logo_path, activo }) {
  const c = getClient(id);
  if (!c) throw new Error('Cliente no existe');
  getDb()
    .prepare('UPDATE clients SET nombre = ?, perfil_json = ?, config_json = ?, credentials_enc = ?, logo_path = ?, activo = ? WHERE id = ?')
    .run(
      nombre ?? c.nombre,
      JSON.stringify(perfil ?? c.perfil),
      JSON.stringify(cfg ?? c.config),
      credentials ? encrypt(credentials) : c.credentials_enc,
      logo_path === undefined ? c.logo_path : logo_path,
      activo === undefined ? (c.activo ? 1 : 0) : activo ? 1 : 0,
      id,
    );
  return getClient(id);
}

export function rotatePortalToken(id) {
  getDb().prepare('UPDATE clients SET portal_token = ? WHERE id = ?').run(randomToken(), id);
  return getClient(id);
}

// ------------------------------------------------------------------ competencia
export const listCompetitors = (clientId) =>
  getDb().prepare('SELECT * FROM competitors WHERE client_id = ? ORDER BY id').all(clientId);
export const addCompetitor = (clientId, handle, plataforma = 'instagram', notas = '') =>
  getDb().prepare('INSERT INTO competitors (client_id, plataforma, handle, notas) VALUES (?, ?, ?, ?)')
    .run(clientId, plataforma, handle.replace(/^@/, '').trim(), notas);
export const deleteCompetitor = (clientId, id) =>
  getDb().prepare('DELETE FROM competitors WHERE id = ? AND client_id = ?').run(id, clientId);

export function saveCompetitorReport(clientId, data, raw) {
  getDb().prepare('INSERT INTO competitor_reports (client_id, data_json, raw_json) VALUES (?, ?, ?)')
    .run(clientId, JSON.stringify(data), JSON.stringify(raw));
}
export function latestCompetitorReport(clientId) {
  const r = getDb().prepare('SELECT * FROM competitor_reports WHERE client_id = ? ORDER BY id DESC LIMIT 1').get(clientId);
  return r ? { ...r, data: JSON.parse(r.data_json) } : null;
}

// ------------------------------------------------------------------ posts
function hydratePost(row) {
  if (!row) return null;
  return {
    ...row,
    salida: row.salida_json ? JSON.parse(row.salida_json) : null,
    hashtags: JSON.parse(row.hashtags_json || '[]'),
    images: JSON.parse(row.images_json || '[]'),
  };
}

export const getPost = (id) => hydratePost(getDb().prepare('SELECT * FROM posts WHERE id = ?').get(id));

export function listPosts({ clientId, statuses, limit = 200 } = {}) {
  const where = [];
  const args = [];
  if (clientId) { where.push('client_id = ?'); args.push(clientId); }
  if (statuses?.length) { where.push(`status IN (${statuses.map(() => '?').join(',')})`); args.push(...statuses); }
  const sql = `SELECT * FROM posts ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY COALESCE(scheduled_at, created_at) DESC LIMIT ?`;
  return getDb().prepare(sql).all(...args, limit).map(hydratePost);
}

export function createPost(fields) {
  const r = getDb().prepare('INSERT INTO posts (client_id, plataforma, status, scheduled_at, origen_id) VALUES (?, ?, ?, ?, ?)')
    .run(fields.client_id, fields.plataforma, fields.status ?? 'generando', fields.scheduled_at ?? null, fields.origen_id ?? null);
  return getPost(Number(r.lastInsertRowid));
}

const POST_FIELDS = ['status', 'pilar', 'tema', 'formato', 'estructura', 'tipo_post', 'images_json', 'salida_json', 'variante', 'copy_final', 'hashtags_json',
  'image_path', 'video_path', 'alt_text', 'scheduled_at', 'published_at', 'external_id', 'external_url', 'error', 'feedback'];

/** Borra un post (y su bitácora). Devuelve los archivos que ya no usa ningún otro post. */
export function deletePost(id) {
  const p = getPost(id); if (!p) return [];
  const files = [...new Set([p.image_path, p.video_path, ...(p.images || [])].filter(Boolean))];
  getDb().prepare('DELETE FROM events WHERE post_id = ?').run(id);
  getDb().prepare('DELETE FROM posts WHERE id = ?').run(id);
  const used = (f) => getDb().prepare('SELECT 1 FROM posts WHERE image_path = ? OR video_path = ? OR images_json LIKE ? LIMIT 1').get(f, f, `%${JSON.stringify(f).slice(1, -1)}%`);
  return files.filter((f) => !used(f));
}

export const sharedCopy = (origenId, plataforma) =>
  hydratePost(getDb().prepare('SELECT * FROM posts WHERE origen_id = ? AND plataforma = ? LIMIT 1').get(origenId, plataforma));

export function updatePost(id, patch) {
  const p = { ...patch };
  if ('salida' in p) { p.salida_json = p.salida ? JSON.stringify(p.salida) : null; delete p.salida; }
  if ('hashtags' in p) { p.hashtags_json = JSON.stringify(p.hashtags || []); delete p.hashtags; }
  if ('images' in p) { p.images_json = JSON.stringify(p.images || []); delete p.images; }
  const keys = Object.keys(p).filter((k) => POST_FIELDS.includes(k));
  if (!keys.length) return getPost(id);
  getDb().prepare(`UPDATE posts SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
    .run(...keys.map((k) => p[k] ?? null), id);
  return getPost(id);
}

// Cambia de estado solo si el post sigue en el estado esperado (evita dobles publicaciones).
export function transitionPost(id, from, to) {
  const froms = Array.isArray(from) ? from : [from];
  const r = getDb().prepare(`UPDATE posts SET status = ?, updated_at = datetime('now') WHERE id = ? AND status IN (${froms.map(() => '?').join(',')})`)
    .run(to, id, ...froms);
  return r.changes === 1;
}

export function duePosts(nowIso) {
  return getDb().prepare("SELECT * FROM posts WHERE status = 'aprobado' AND scheduled_at <= ? ORDER BY scheduled_at").all(nowIso).map(hydratePost);
}

export function openPostFor(clientId, plataforma) {
  return hydratePost(getDb().prepare(
    `SELECT * FROM posts WHERE client_id = ? AND plataforma = ? AND status IN (${OPEN_STATUSES.map(() => '?').join(',')}) LIMIT 1`,
  ).get(clientId, plataforma, ...OPEN_STATUSES));
}

export function lastGenerationErrorAt(clientId, plataforma) {
  return getDb().prepare("SELECT MAX(updated_at) AS t FROM posts WHERE client_id = ? AND plataforma = ? AND status = 'error_generacion'")
    .get(clientId, plataforma)?.t ?? null;
}

// Publicaciones recientes (publicadas o ya programadas) para rotación de pilares y fechas.
export function recentHistory(clientId, { limit = 12, excludeId = 0 } = {}) {
  return getDb().prepare(
    `SELECT plataforma, pilar, tema, formato, estructura, tipo_post, COALESCE(published_at, scheduled_at) AS fecha, status
     FROM posts WHERE client_id = ? AND id != ? AND tema IS NOT NULL
       AND status IN ('publicado','aprobado','publicando','pendiente','necesita_asset')
     ORDER BY COALESCE(published_at, scheduled_at) DESC LIMIT ?`,
  ).all(clientId, excludeId, limit);
}

export function lastDateFor(clientId, plataforma) {
  return getDb().prepare(
    `SELECT MAX(COALESCE(published_at, scheduled_at)) AS t FROM posts
     WHERE client_id = ? AND plataforma = ? AND status IN ('publicado','aprobado','publicando')`,
  ).get(clientId, plataforma)?.t ?? null;
}

// ------------------------------------------------------------------ bitácora
export function logEvent({ postId = null, clientId = null, tipo, detalle = '' }) {
  getDb().prepare('INSERT INTO events (post_id, client_id, tipo, detalle) VALUES (?, ?, ?, ?)')
    .run(postId, clientId, tipo, typeof detalle === 'string' ? detalle : JSON.stringify(detalle));
  // También al log del servicio (journalctl), para seguir el avance en vivo.
  if (process.env.LOG_EVENTOS !== '0') console.log(`[${tipo}]${postId ? ` post ${postId}` : ''} ${typeof detalle === 'string' ? detalle : JSON.stringify(detalle)}`.slice(0, 300));
}

/** Al arrancar: lo que quedó a medias por un reinicio no se va a terminar solo. */
export function recoverInterrupted() {
  const d = getDb();
  const stuck = d.prepare("SELECT id, client_id, status FROM posts WHERE status IN ('generando','cambios_solicitados','publicando')").all();
  for (const p of stuck) {
    const [to, msg] = {
      generando: ['error_generacion', 'Se interrumpió la generación (reinicio del servicio). Se reintenta sola o con "Generar ahora".'],
      cambios_solicitados: ['pendiente', 'Se interrumpieron los cambios (reinicio del servicio). Vuelve a pedirlos.'],
      publicando: ['error', 'Se interrumpió la publicación (reinicio). Revisa en la red si salió antes de reintentar.'],
    }[p.status];
    d.prepare("UPDATE posts SET status = ?, error = ?, updated_at = datetime('now') WHERE id = ?").run(to, msg, p.id);
    logEvent({ postId: p.id, clientId: p.client_id, tipo: 'interrumpido', detalle: msg });
  }
  return stuck.length;
}
export const postEvents = (postId) =>
  getDb().prepare('SELECT * FROM events WHERE post_id = ? ORDER BY id DESC').all(postId);
export const recentEvents = (limit = 50) =>
  getDb().prepare('SELECT e.*, c.nombre AS cliente FROM events e LEFT JOIN clients c ON c.id = e.client_id ORDER BY e.id DESC LIMIT ?').all(limit);

// ------------------------------------------------------------ palabra clave
export const keywordReplySeen = (commentId) => !!getDb().prepare('SELECT 1 FROM keyword_replies WHERE comment_id = ?').get(commentId);
// ------------------------------------------------------------------ leads
export const LEAD_ESTADOS = { nuevo: 'Nuevo', conversacion: 'En conversación', cita: 'Con cita', cliente: 'Cliente', perdido: 'Perdido' };
function normTel(t) {
  if (!t) return null;
  let d = String(t).replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10) d = `52${d}`;                         // número de México sin lada de país
  if (d.length === 13 && d.startsWith('521')) d = `52${d.slice(3)}`; // formato de WhatsApp para celulares de México
  return `+${d}`;
}
/** Crea o actualiza un lead (se identifica por teléfono o por usuario de Instagram). */
export function upsertLead(clientId, { nombre, telefono, usuario, email, origen, estado, nota, cita_inicio, cita_evento, control }) {
  const tel = normTel(telefono), user = usuario ? String(usuario).replace(/^@/, '').toLowerCase() : null;
  const mail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || '').trim()) ? String(email).trim().toLowerCase() : null;
  if (!tel && !user && !mail) throw new Error('El lead necesita teléfono, usuario o correo');
  const d = getDb();
  const prev = d.prepare(`SELECT * FROM leads WHERE client_id = ? AND ((telefono IS NOT NULL AND telefono = ?) OR (usuario IS NOT NULL AND usuario = ?) OR (email IS NOT NULL AND email = ?))
    ORDER BY (telefono = ?) DESC LIMIT 1`).get(clientId, tel, user, mail, tel);
  if (prev) {
    // No se retrocede de estado (un cliente no vuelve a "nuevo" porque escribió otra vez).
    const ORDEN = Object.keys(LEAD_ESTADOS);
    const nuevoEstado = estado && (estado === 'perdido' || ORDEN.indexOf(estado) > ORDEN.indexOf(prev.estado)) ? estado : prev.estado;
    d.prepare(`UPDATE leads SET nombre = COALESCE(?, nombre), telefono = COALESCE(?, telefono), usuario = COALESCE(?, usuario), email = COALESCE(?, email), estado = ?,
      nota = COALESCE(?, nota), cita_inicio = COALESCE(?, cita_inicio), cita_evento = COALESCE(?, cita_evento), updated_at = datetime('now') WHERE id = ?`)
      .run(nombre ?? null, tel, user, mail, nuevoEstado, nota ?? null, cita_inicio ?? null, cita_evento ?? null, prev.id);
    if (control === 'bot' || control === 'humano') d.prepare('UPDATE leads SET control = ? WHERE id = ?').run(control, prev.id);
    return d.prepare('SELECT * FROM leads WHERE id = ?').get(prev.id);
  }
  const r = d.prepare('INSERT INTO leads (client_id, nombre, telefono, usuario, email, origen, estado, nota, cita_inicio, cita_evento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(clientId, nombre ?? null, tel, user, mail, origen || 'otro', estado || 'nuevo', nota ?? null, cita_inicio ?? null, cita_evento ?? null);
  return d.prepare('SELECT * FROM leads WHERE id = ?').get(Number(r.lastInsertRowid));
}
export const getLead = (clientId, id) => getDb().prepare('SELECT * FROM leads WHERE id = ? AND client_id = ?').get(id, clientId);
/** Guarda un mensaje de la conversación del lead (lo manda el agente de WhatsApp). */
export function addLeadMessage(clientId, ident, { rol, texto, autor = null }) {
  if (!['lead', 'agente', 'humano'].includes(rol) || !String(texto ?? '').trim()) throw new Error('Mensaje no válido');
  const lead = upsertLead(clientId, ident);
  getDb().prepare('INSERT INTO lead_mensajes (lead_id, rol, texto, autor) VALUES (?, ?, ?, ?)').run(lead.id, rol, String(texto).slice(0, 4000), autor ? String(autor).slice(0, 80) : null);
  getDb().prepare("UPDATE leads SET updated_at = datetime('now') WHERE id = ?").run(lead.id);
  return lead;
}
export const leadMessages = (leadId, limit = 400) => getDb()
  .prepare('SELECT * FROM (SELECT * FROM lead_mensajes WHERE lead_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id').all(leadId, limit);
export const leadMessageCounts = (clientId) => Object.fromEntries(getDb()
  .prepare('SELECT m.lead_id, COUNT(*) n FROM lead_mensajes m JOIN leads l ON l.id = m.lead_id WHERE l.client_id = ? GROUP BY m.lead_id').all(clientId).map((r) => [r.lead_id, r.n]));

// ------------------------------------------------------------------ cobro (Stripe)
export const getBilling = (clientId) => getDb().prepare('SELECT * FROM billing WHERE client_id = ?').get(clientId) || { client_id: clientId, estado: 'sin_tarjeta' };
export const billingByCustomer = (customer) => getDb().prepare('SELECT * FROM billing WHERE stripe_customer = ?').get(customer);
export function setBilling(clientId, fields) {
  getDb().prepare('INSERT OR IGNORE INTO billing (client_id) VALUES (?)').run(clientId);
  const keys = Object.keys(fields).filter((k) => ['stripe_customer', 'subscription_id', 'estado', 'tarjeta', 'proximo_cobro', 'ultimo_pago'].includes(k));
  if (keys.length) getDb().prepare(`UPDATE billing SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE client_id = ?`).run(...keys.map((k) => fields[k] ?? null), clientId);
  return getBilling(clientId);
}

// ------------------------------------------------------------------ usuarios del panel
export const ROLES = { admin: 'Administrador (Kuper)', cliente: 'Cliente' };
const normEmail = (e) => String(e || '').trim().toLowerCase();
export function createUser({ email, nombre, rol, client_id = null, password_hash }) {
  const em = normEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) throw new Error('Correo no válido');
  if (!ROLES[rol]) throw new Error('Rol no válido');
  if (rol === 'cliente' && !client_id) throw new Error('Elige la marca del usuario');
  if (getUserByEmail(em)) throw new Error('Ya existe un usuario con ese correo');
  const r = getDb().prepare('INSERT INTO users (email, nombre, rol, client_id, password_hash) VALUES (?, ?, ?, ?, ?)')
    .run(em, String(nombre || em).trim().slice(0, 80), rol, rol === 'cliente' ? Number(client_id) : null, password_hash);
  return getUser(Number(r.lastInsertRowid));
}
export const getUser = (id) => getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
export const getUserByEmail = (email) => getDb().prepare('SELECT * FROM users WHERE email = ?').get(normEmail(email));
export const listUsers = () => getDb().prepare('SELECT u.*, c.nombre AS cliente FROM users u LEFT JOIN clients c ON c.id = u.client_id ORDER BY u.rol, c.nombre, u.nombre').all();
export const setUserPassword = (id, hash) => getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
export const setUserActivo = (id, activo) => getDb().prepare('UPDATE users SET activo = ? WHERE id = ?').run(activo ? 1 : 0, id);
export const deleteUser = (id) => getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
export const touchLogin = (id) => getDb().prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(id);

export const listLeads = (clientId, { estado, limit = 300 } = {}) => getDb()
  .prepare(`SELECT * FROM leads WHERE client_id = ? ${estado ? 'AND estado = ?' : ''} ORDER BY updated_at DESC LIMIT ?`)
  .all(...[clientId, ...(estado ? [estado] : []), limit]);
export function setLeadEstado(clientId, id, estado) {
  if (!LEAD_ESTADOS[estado]) throw new Error('Estado no válido');
  getDb().prepare("UPDATE leads SET estado = ?, updated_at = datetime('now') WHERE id = ? AND client_id = ?").run(estado, id, clientId);
}

export function recordKeywordReply({ clientId, comment, status, error = null }) {
  getDb().prepare('INSERT OR REPLACE INTO keyword_replies (comment_id, client_id, media_id, username, texto, status, error) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(comment.id, clientId, comment.media_id ?? null, comment.username ?? null, String(comment.text ?? '').slice(0, 500), status, error);
}
export const keywordReplies = (clientId, limit = 20) =>
  getDb().prepare("SELECT * FROM keyword_replies WHERE client_id = ? AND status NOT IN ('propio') ORDER BY created_at DESC LIMIT ?").all(clientId, limit);
export const kvGet = (k) => getDb().prepare('SELECT v FROM kv WHERE k = ?').get(k)?.v ?? null;
export const kvSet = (k, v) => getDb().prepare('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)').run(k, String(v));
/** Posts creados por el programador desde un instante (ISO UTC), para el límite diario. */
// Los intentos fallidos no cuentan: si no, un cliente con error se come el cupo del día de todos.
export const generatedSince = (iso) => getDb().prepare(
  "SELECT COUNT(*) AS n FROM posts WHERE created_at >= datetime(?) AND status != 'error_generacion'").get(iso).n;
/** Posts que esperan al cliente (revisar o subir foto) cambiados después de un instante. */
export const waitingSince = (clientId, iso) => getDb().prepare(
  `SELECT * FROM posts WHERE client_id = ? AND status IN ('pendiente','necesita_asset') AND updated_at > datetime(?) ORDER BY scheduled_at`,
).all(clientId, iso).map(hydratePost);
export const hasKeywordBaseline = (clientId) => !!getDb().prepare('SELECT 1 FROM kv WHERE k = ?').get(`kw_baseline_${clientId}`);
export const setKeywordBaseline = (clientId) => getDb().prepare('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)').run(`kw_baseline_${clientId}`, new Date().toISOString());
