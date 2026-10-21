// Seguridad del panel: cabeceras, freno a envíos desde otros sitios, bitácora de seguridad,
// límite de peticiones a la API y verificación en dos pasos (códigos de 6 dígitos, TOTP).
import crypto from 'node:crypto';
import { config } from './config.js';
import * as db from './db.js';

// ------------------------------------------------------------ cabeceras
export function cabeceras(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: https:",
    "media-src 'self' https: blob:", "font-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'",
    "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  ].join('; '));
  if (config.publicBaseUrl.startsWith('https')) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
}

// ------------------------------------------------------------ envíos desde otros sitios (CSRF)
// Los formularios del panel solo se aceptan si vienen del propio panel (Origin/Referer).
export function mismoOrigen(req, res, next) {
  if (req.method !== 'POST') return next();
  const permitidos = new Set([new URL(config.publicBaseUrl).host, req.headers.host].filter(Boolean));
  const fuente = req.headers.origin || req.headers.referer;
  if (!fuente || fuente === 'null') return next(); // navegadores viejos o herramientas: la cookie SameSite=Lax ya protege
  let host;
  try { host = new URL(fuente).host; } catch { host = null; }
  if (host && permitidos.has(host)) return next();
  auditar(req, 'origen_rechazado', `${req.method} ${req.originalUrl} desde ${String(fuente).slice(0, 100)}`);
  res.status(403).send('Solicitud rechazada: viene de otro sitio.');
}

// ------------------------------------------------------------ bitácora de seguridad
export function ensureTables() {
  db.getDb().exec(`CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY, user_id INTEGER, email TEXT, accion TEXT NOT NULL, detalle TEXT, ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  const cols = db.getDb().prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  if (!cols.includes('totp_enc')) db.getDb().exec('ALTER TABLE users ADD COLUMN totp_enc TEXT');
}
export const ipDe = (req) => String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
export function auditar(req, accion, detalle = '', user = null) {
  try {
    ensureTables();
    const u = user || req?.sesion?.user || null;
    db.getDb().prepare('INSERT INTO auditoria (user_id, email, accion, detalle, ip) VALUES (?, ?, ?, ?, ?)')
      .run(u?.id ?? null, u?.email ?? (req?.sesion?.admin ? 'contraseña maestra' : null), accion, String(detalle).slice(0, 300), req ? ipDe(req) : null);
  } catch (e) { console.error('[auditoria]', e.message); }
}
export const bitacora = (n = 60) => { ensureTables(); return db.getDb().prepare('SELECT * FROM auditoria ORDER BY id DESC LIMIT ?').all(n); };

// ------------------------------------------------------------ límite de peticiones
export function limite({ max, ventanaMs = 60_000, clave = ipDe }) {
  const hits = new Map();
  return (req, res, next) => {
    const k = clave(req), t = Date.now(), lista = (hits.get(k) || []).filter((x) => t - x < ventanaMs);
    if (lista.length >= max) { res.setHeader('Retry-After', String(Math.ceil(ventanaMs / 1000))); return res.status(429).json({ error: 'Demasiadas solicitudes, intenta en un minuto.' }); }
    lista.push(t); hits.set(k, lista);
    if (hits.size > 5000) for (const [kk, v] of hits) if (!v.some((x) => t - x < ventanaMs)) hits.delete(kk);
    next();
  };
}

// ------------------------------------------------------------ verificación en dos pasos (TOTP, RFC 6238)
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function nuevoSecreto() {
  const b = crypto.randomBytes(20); let bits = '', out = '';
  for (const x of b) bits += x.toString(2).padStart(8, '0');
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}
function deB32(s) {
  let bits = '';
  for (const ch of String(s).toUpperCase().replace(/[^A-Z2-7]/g, '')) bits += B32.indexOf(ch).toString(2).padStart(5, '0');
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
export function codigoTotp(secreto, t = Date.now()) {
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(t / 1000 / 30)));
  const h = crypto.createHmac('sha1', deB32(secreto)).update(c).digest(), o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
/** Acepta el código actual y uno de antes/después (relojes desfasados). */
export function verificarTotp(secreto, codigo, t = Date.now()) {
  const c = String(codigo || '').replace(/\D/g, '');
  if (c.length !== 6 || !secreto) return false;
  return [-1, 0, 1].some((w) => crypto.timingSafeEqual(Buffer.from(codigoTotp(secreto, t + w * 30_000)), Buffer.from(c)));
}
export const otpauthUrl = (secreto, email) => `otpauth://totp/${encodeURIComponent(`Kuper:${email}`)}?secret=${secreto}&issuer=Kuper&digits=6&period=30`;
