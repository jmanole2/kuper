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
