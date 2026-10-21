// Cifrado de credenciales (AES-256-GCM) y firma de cookies de sesión (HMAC).
import crypto from 'node:crypto';
import { config } from './config.js';

function key() {
  if (!config.secretKey) throw new Error('Falta SECRET_KEY en el .env');
  return crypto.createHash('sha256').update(config.secretKey).digest();
}

export function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

export function decrypt(str) {
  if (!str) return {};
  const [iv, tag, data] = str.split('.').map((s) => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString('utf8'));
}

export function sign(value) {
  const mac = crypto.createHmac('sha256', key()).update(value).digest('base64url');
  return `${value}.${mac}`;
}

export function unsign(signed) {
  if (!signed) return null;
  const i = signed.lastIndexOf('.');
  if (i < 0) return null;
  const value = signed.slice(0, i);
  const a = Buffer.from(sign(value));
  const b = Buffer.from(signed);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? value : null;
}

export const randomToken = (n = 24) => crypto.randomBytes(n).toString('base64url');

export function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

// Contraseñas de usuarios del panel: scrypt con sal propia. Formato "scrypt$sal$hash".
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('base64url')}$${crypto.scryptSync(String(pw), salt, 32).toString('base64url')}`;
}
export function verifyPassword(pw, stored) {
  const [alg, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const got = crypto.scryptSync(String(pw), Buffer.from(salt, 'base64url'), 32), want = Buffer.from(hash, 'base64url');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
/** Contraseña temporal fácil de dictar (sin letras que se confunden). */
export function tempPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(12), (b) => abc[b % abc.length]).join('').replace(/(.{4})(?!$)/g, '$1-');
}
