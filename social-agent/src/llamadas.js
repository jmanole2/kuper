// Llamadas del agente de voz (Retell): cada llamada que termina llega aquí desde el agente de llamadas,
// se guarda con su resumen y su transcripción, y la persona queda como lead (origen "llamada").
import * as db from './db.js';
import { localDate } from './schedule.js';
import { config } from './config.js';

const getDb = () => db.getDb();
export const TIPOS = { web: 'Prueba web', entrante: 'Entrante', saliente: 'Saliente' };

export function ensureTables() {
  getDb().exec(`CREATE TABLE IF NOT EXISTS llamadas (
    id INTEGER PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    call_id TEXT NOT NULL,
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    tipo TEXT NOT NULL DEFAULT 'web',
    inicio TEXT NOT NULL,
    duracion_s INTEGER NOT NULL DEFAULT 0,
    resumen TEXT,
    cita INTEGER NOT NULL DEFAULT 0,
    transcripcion_json TEXT NOT NULL DEFAULT '[]',
    nombre TEXT, telefono TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (client_id, call_id))`);
  const cols = getDb().prepare('PRAGMA table_info(llamadas)').all().map((c) => c.name);
  for (const c of ['nombre', 'telefono']) if (!cols.includes(c)) getDb().exec(`ALTER TABLE llamadas ADD COLUMN ${c} TEXT`);
}

const txt = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);

/**
 * Registra una llamada terminada. Es idempotente: si la misma call_id llega dos veces, no se duplica.
 * body: { call_id, tipo, inicio, duracion_s, telefono, nombre, email, resumen, cita, transcripcion: [{ rol: 'lead'|'agente', texto }] }
 */
export function registrar(client, body = {}, { sinLead = false } = {}) {
  ensureTables();
  const callId = txt(body.call_id, 120);
  if (!callId) throw new Error('Falta call_id');
  const previa = getDb().prepare('SELECT * FROM llamadas WHERE client_id = ? AND call_id = ?').get(client.id, callId);
  if (previa) return { llamada: previa, nueva: false };

  const inicio = new Date(body.inicio || Date.now());
  if (Number.isNaN(inicio.getTime())) throw new Error('Fecha de inicio no válida');
  const tipo = TIPOS[body.tipo] ? body.tipo : 'web';
  const turnos = (Array.isArray(body.transcripcion) ? body.transcripcion : [])
    .filter((t) => ['lead', 'agente'].includes(t?.rol) && String(t?.texto ?? '').trim())
    .slice(0, 300).map((t) => ({ rol: t.rol, texto: String(t.texto).trim().slice(0, 2000) }));
  const resumen = txt(body.resumen, 1500), cita = !!body.cita;

  // Lead: por teléfono (llamadas reales) o por correo (pruebas desde la web). Sin ninguno, la llamada se guarda sin lead.
  let lead = null;
  const ident = { telefono: txt(body.telefono, 30), email: txt(body.email, 120), nombre: txt(body.nombre, 80) };
  if (!sinLead && (ident.telefono || ident.email)) {
    try {
      const antes = getDb().prepare('SELECT COUNT(*) n FROM leads WHERE client_id = ?').get(client.id).n;
      lead = db.upsertLead(client.id, { ...ident, origen: 'llamada', estado: cita ? 'cita' : 'conversacion' });
      const esNuevo = getDb().prepare('SELECT COUNT(*) n FROM leads WHERE client_id = ?').get(client.id).n > antes;
      if (resumen && (esNuevo || !lead.nota)) getDb().prepare('UPDATE leads SET nota = ? WHERE id = ?').run(resumen.slice(0, 300), lead.id);
      const ins = getDb().prepare('INSERT INTO lead_mensajes (lead_id, rol, texto, autor, created_at) VALUES (?, ?, ?, ?, ?)');
      const cuando = inicio.toISOString().replace('T', ' ').slice(0, 19);
      for (const t of turnos) ins.run(lead.id, t.rol, t.texto, 'Llamada', cuando);
    } catch (e) { lead = null; console.error('[llamadas] lead', e.message); }
  }

  const r = getDb().prepare(`INSERT INTO llamadas (client_id, call_id, lead_id, tipo, inicio, duracion_s, resumen, cita, transcripcion_json, nombre, telefono)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(client.id, callId, lead?.id ?? null, tipo, inicio.toISOString(),
    Math.max(0, Math.round(Number(body.duracion_s) || 0)), resumen, cita ? 1 : 0, JSON.stringify(turnos), ident.nombre, ident.telefono);
  db.logEvent({ clientId: client.id, tipo: 'llamada', detalle: `${TIPOS[tipo]} · ${ident.nombre || ident.telefono || ident.email || 'sin datos'}${cita ? ' · agendó cita' : ''}` });
  return { llamada: getDb().prepare('SELECT * FROM llamadas WHERE id = ?').get(Number(r.lastInsertRowid)), nueva: true, lead };
}

export function listar(clientId, limit = 100) {
  ensureTables();
  return getDb().prepare(`SELECT ll.*, COALESCE(l.nombre, ll.nombre) AS nombre, COALESCE(l.telefono, ll.telefono) AS telefono, l.email, l.estado AS lead_estado FROM llamadas ll
    LEFT JOIN leads l ON l.id = ll.lead_id WHERE ll.client_id = ? ORDER BY ll.inicio DESC LIMIT ?`).all(clientId, limit)
    .map((x) => ({ ...x, transcripcion: JSON.parse(x.transcripcion_json || '[]') }));
}

/** Llamadas de un mes ('YYYY-MM', hora de México). */
export function delMes(clientId, mes) {
  ensureTables();
  const filas = getDb().prepare('SELECT inicio, duracion_s, cita FROM llamadas WHERE client_id = ?').all(clientId)
    .filter((x) => localDate(new Date(x.inicio), config.timezone).startsWith(mes));
  return { llamadas: filas.length, minutos: Math.round(filas.reduce((n, x) => n + x.duracion_s, 0) / 60), citas: filas.filter((x) => x.cita).length };
}
