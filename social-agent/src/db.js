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
export const PLATFORMS = ['instagram', 'facebook', 'linkedin'];

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
  const r = getDb().prepare('INSERT INTO posts (client_id, plataforma, status, scheduled_at) VALUES (?, ?, ?, ?)')
    .run(fields.client_id, fields.plataforma, fields.status ?? 'generando', fields.scheduled_at ?? null);
  return getPost(Number(r.lastInsertRowid));
}

const POST_FIELDS = ['status', 'pilar', 'tema', 'formato', 'estructura', 'images_json', 'salida_json', 'variante', 'copy_final', 'hashtags_json',
  'image_path', 'video_path', 'alt_text', 'scheduled_at', 'published_at', 'external_id', 'external_url', 'error', 'feedback'];

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
    `SELECT plataforma, pilar, tema, formato, estructura, COALESCE(published_at, scheduled_at) AS fecha, status
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
}
export const postEvents = (postId) =>
  getDb().prepare('SELECT * FROM events WHERE post_id = ? ORDER BY id DESC').all(postId);
export const recentEvents = (limit = 50) =>
  getDb().prepare('SELECT e.*, c.nombre AS cliente FROM events e LEFT JOIN clients c ON c.id = e.client_id ORDER BY e.id DESC LIMIT ?').all(limit);
