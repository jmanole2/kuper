// Cupones: el agente (o el de comentarios) le da a una persona un código único con un beneficio y vigencia, según la
// promoción que aplique a la conversación; se canjea en sucursal (el cajero lo valida en el panel).
//
// client.config.cupones = { activo, prefijo: 'CHUB', promociones: [{ id, nombre, beneficio, cuando, vigencia_horas, max_dia, activa }] }
//   beneficio: lo que recibe ("10 % en la Hamburguesa Clásica"); cuando: en qué caso darlo (lo lee la IA).
// Reglas que se cumplen en código (no las decide la IA): una promoción por persona mientras tenga un cupón vigente
// de ella, máximo por día por promoción, y un código solo se canjea una vez y antes de vencer.
import crypto from 'node:crypto';
import * as db from './db.js';

export const DEFAULTS = { activo: false, prefijo: '', promociones: [] };
export const ajustes = (client) => {
  const c = { ...DEFAULTS, ...(client?.config?.cupones || {}) };
  return { ...c, promociones: (Array.isArray(c.promociones) ? c.promociones : []).filter((p) => p && p.id && p.beneficio) };
};
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para que el cajero no se confunda

let tablas = false;
const d = () => {
  if (!tablas) {
    tablas = true;
    db.getDb().exec(`CREATE TABLE IF NOT EXISTS cupones (
      id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, codigo TEXT NOT NULL UNIQUE,
      promocion_id TEXT NOT NULL, promocion TEXT, beneficio TEXT NOT NULL, lead_id INTEGER, persona TEXT, canal TEXT, motivo TEXT,
      vence_at TEXT NOT NULL, canjeado_at TEXT, canjeado_por TEXT, sucursal TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS cupones_cliente ON cupones(client_id, created_at);`);
  }
  return db.getDb();
};
const iso = (t) => new Date(t).toISOString().replace('T', ' ').slice(0, 19);
const limpia = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Limpia las promociones que vienen del formulario del panel. */
export function limpiarPromociones(lista) {
  return (Array.isArray(lista) ? lista : []).slice(0, 20).map((p, i) => ({
    id: limpia(p.id, 30).toLowerCase().replace(/[^a-z0-9-]/g, '') || `promo${i + 1}`,
    nombre: limpia(p.nombre, 60) || `Promoción ${i + 1}`,
    beneficio: limpia(p.beneficio, 160),
    cuando: limpia(p.cuando, 300),
    vigencia_horas: Math.min(24 * 90, Math.max(1, Math.round(Number(p.vigencia_horas) || 72))),
    max_dia: Math.min(5000, Math.max(0, Math.round(Number(p.max_dia) || 0))), // 0 = sin límite
    activa: p.activa !== false && p.activa !== '0',
  })).filter((p) => p.beneficio);
}

function codigoNuevo(prefijo) {
  for (let i = 0; i < 20; i++) {
    const r = Array.from(crypto.randomBytes(5), (b) => ALFABETO[b % ALFABETO.length]).join('');
    const c = `${(prefijo || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'CUP'}-${r}`;
    if (!d().prepare('SELECT 1 FROM cupones WHERE codigo = ?').get(c)) return c;
  }
  throw new Error('No se pudo generar el código.');
}
const fechaTexto = (t) => new Date(t).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });

/**
 * Genera (o devuelve el vigente) cupón de una promoción para una persona.
 * ident: { telefono } o { usuario } (Instagram/Facebook), opcional nombre.
 */
export function generar(client, { promocion, telefono, usuario, nombre, canal = 'whatsapp', motivo = '' }, ahora = new Date()) {
  const aj = ajustes(client);
  if (!aj.activo) throw new Error('Los cupones no están activos en esta marca.');
  const p = aj.promociones.find((x) => x.id === String(promocion || '').toLowerCase() && x.activa);
  if (!p) throw new Error('Esa promoción no existe o está pausada.');
  let lead = null;
  try { lead = db.upsertLead(client.id, { telefono, usuario, nombre, origen: canal }); } catch { /* sin datos de contacto */ }
  const persona = lead?.telefono || lead?.usuario || limpia(usuario || telefono, 60);
  if (!persona) throw new Error('Falta a quién se le da el cupón.');
  const vigente = d().prepare(`SELECT * FROM cupones WHERE client_id = ? AND promocion_id = ? AND persona = ? AND canjeado_at IS NULL AND vence_at > ?`).get(client.id, p.id, persona, iso(ahora));
  if (vigente) return { ...publico(vigente), repetido: true };
  if (p.max_dia) {
    const hoy = d().prepare("SELECT COUNT(*) n FROM cupones WHERE client_id = ? AND promocion_id = ? AND date(created_at) = date(?)").get(client.id, p.id, iso(ahora)).n;
    if (hoy >= p.max_dia) throw new Error('Ya se dieron todos los cupones de esta promoción por hoy.');
  }
  const vence = new Date(ahora.getTime() + p.vigencia_horas * 3600000);
  const codigo = codigoNuevo(aj.prefijo || client.slug);
  d().prepare(`INSERT INTO cupones (client_id, codigo, promocion_id, promocion, beneficio, lead_id, persona, canal, motivo, vence_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(client.id, codigo, p.id, p.nombre, p.beneficio, lead?.id || null, persona, canal, limpia(motivo, 200), iso(vence), iso(ahora));
  db.logEvent({ clientId: client.id, tipo: 'cupon_generado', detalle: `${codigo} · ${p.nombre} · ${lead?.nombre || persona}` });
  return publico(d().prepare('SELECT * FROM cupones WHERE codigo = ?').get(codigo));
}
const publico = (c) => ({ codigo: c.codigo, beneficio: c.beneficio, promocion: c.promocion, vence_at: c.vence_at, vence_texto: fechaTexto(`${c.vence_at.replace(' ', 'T')}Z`),
  texto: `Tu cupón ${c.codigo}: ${c.beneficio}. Válido hasta el ${fechaTexto(`${c.vence_at.replace(' ', 'T')}Z`)}. Muéstralo en sucursal.` });

const normCodigo = (c) => String(c || '').toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '').slice(0, 30);
/** Lo que ve el cajero al escribir el código. */
export function consultar(client, codigo, ahora = new Date()) {
  const c = d().prepare('SELECT * FROM cupones WHERE client_id = ? AND codigo = ?').get(client.id, normCodigo(codigo));
  if (!c) return { estado: 'no_existe' };
  const lead = c.lead_id ? db.getLead(client.id, c.lead_id) : null;
  const estado = c.canjeado_at ? 'canjeado' : c.vence_at <= iso(ahora) ? 'vencido' : 'valido';
  return { estado, cupon: c, nombre: lead?.nombre || '', vence_texto: fechaTexto(`${c.vence_at.replace(' ', 'T')}Z`) };
}
/** Canje en sucursal: una sola vez y antes de que venza (en una transacción para que dos cajas no lo canjeen a la vez). */
export function canjear(client, codigo, { autor = '', sucursal = '' } = {}, ahora = new Date()) {
  const r = d().prepare(`UPDATE cupones SET canjeado_at = ?, canjeado_por = ?, sucursal = ? WHERE client_id = ? AND codigo = ? AND canjeado_at IS NULL AND vence_at > ?`)
    .run(iso(ahora), limpia(autor, 80), limpia(sucursal, 80), client.id, normCodigo(codigo), iso(ahora));
  const x = consultar(client, codigo, ahora);
  if (!r.changes) throw new Error(x.estado === 'no_existe' ? 'Ese código no existe.' : x.estado === 'canjeado' ? `Ese cupón ya se canjeó (${x.cupon.canjeado_at}${x.cupon.sucursal ? `, ${x.cupon.sucursal}` : ''}).` : 'Ese cupón ya venció.');
  db.logEvent({ clientId: client.id, tipo: 'cupon_canjeado', detalle: `${x.cupon.codigo} · ${x.cupon.promocion}${sucursal ? ` · ${sucursal}` : ''}` });
  return x;
}

export function listar(clientId, { limit = 100 } = {}) {
  return d().prepare('SELECT * FROM cupones WHERE client_id = ? ORDER BY id DESC LIMIT ?').all(clientId, limit);
}
export function resumen(clientId, dias = 30) {
  const filas = d().prepare(`SELECT promocion, COUNT(*) dados, SUM(canjeado_at IS NOT NULL) canjeados FROM cupones WHERE client_id = ? AND datetime(created_at) >= datetime('now', ?) GROUP BY promocion_id ORDER BY dados DESC`)
    .all(clientId, `-${dias} days`);
  const dados = filas.reduce((a, x) => a + x.dados, 0), canjeados = filas.reduce((a, x) => a + (x.canjeados || 0), 0);
  return { dados, canjeados, tasa: dados ? Math.round((canjeados / dados) * 100) : 0, porPromocion: filas };
}

/** Bloque para lo que sabe el agente: qué promociones puede dar y cuándo. */
export function bloqueAgente(client) {
  const aj = ajustes(client);
  const activas = aj.promociones.filter((p) => p.activa);
  if (!aj.activo || !activas.length) return '';
  return `## Cupones que puedes dar (usa generar_cupon con el id; nunca inventes códigos ni descuentos)\n${activas.map((p) => `- id "${p.id}": ${p.beneficio}. Cuándo darlo: ${p.cuando || 'cuando ayude a cerrar la venta'}. Vigencia: ${p.vigencia_horas} horas.`).join('\n')}\nDa como máximo un cupón por conversación y solo si la situación encaja. Dile que lo muestre en sucursal.`;
}
