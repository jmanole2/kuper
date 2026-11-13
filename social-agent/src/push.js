// Notificaciones al celular (o compu) del equipo: el panel se instala como app (PWA) y avisa al momento de un lead
// nuevo, de un cliente que espera respuesta en una conversación que atiende el equipo o de una alerta.
// Cada persona las activa en su dispositivo (Mi cuenta → Notificaciones). Las llaves VAPID se generan solas la
// primera vez y se guardan en data/vapid.json.
import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';
import { config } from './config.js';
import * as db from './db.js';

export const hooks = { enviar: (sub, carga, opts) => webpush.sendNotification(sub, carga, opts) }; // pruebas

let llaves = null;
export function vapid() {
  if (llaves) return llaves;
  const f = path.join(config.dataDir, 'vapid.json');
  try { llaves = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {
    llaves = webpush.generateVAPIDKeys();
    fs.mkdirSync(config.dataDir, { recursive: true });
    fs.writeFileSync(f, JSON.stringify(llaves), { mode: 0o600 });
  }
  return llaves;
}

let tablas = false;
const d = () => {
  if (!tablas) {
    tablas = true;
    db.getDb().exec(`CREATE TABLE IF NOT EXISTS push_subs (
      endpoint TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, client_id INTEGER,
      p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  }
  return db.getDb();
};

export function suscribir(user, clientId, sub) {
  const ep = String(sub?.endpoint || '');
  if (!/^https:\/\/[\w.-]+\//.test(ep) || ep.length > 1000 || !sub?.keys?.p256dh || !sub?.keys?.auth) throw new Error('Suscripción no válida.');
  d().prepare('INSERT OR REPLACE INTO push_subs (endpoint, user_id, client_id, p256dh, auth) VALUES (?, ?, ?, ?, ?)')
    .run(ep, user.id, clientId || null, String(sub.keys.p256dh).slice(0, 200), String(sub.keys.auth).slice(0, 100));
}
export const quitar = (user, endpoint) => d().prepare('DELETE FROM push_subs WHERE endpoint = ? AND user_id = ?').run(String(endpoint || ''), user.id);
export const cuantas = (userId) => d().prepare('SELECT COUNT(*) n FROM push_subs WHERE user_id = ?').get(userId).n;

/**
 * Avisa al equipo de una marca. Si el lead tiene asesor, solo a él; si no, a todos los de la marca (menos caja).
 * aviso: { titulo, texto, url, lead }
 */
export async function avisar(client, { titulo, texto = '', url = '/app', lead = null }) {
  const usuarios = lead?.asignado_id
    ? [lead.asignado_id]
    : d().prepare("SELECT id FROM users WHERE client_id = ? AND rol = 'cliente' AND activo = 1 AND COALESCE(permiso, '') != 'caja'").all(client.id).map((u) => u.id);
  if (!usuarios.length) return { enviadas: 0 };
  const subs = d().prepare(`SELECT * FROM push_subs WHERE user_id IN (${usuarios.map(() => '?').join(',')})`).all(...usuarios);
  const k = vapid();
  const carga = JSON.stringify({ titulo: String(titulo).slice(0, 80), texto: String(texto).slice(0, 180), url: String(url).slice(0, 300), tag: lead ? `lead-${lead.id}` : undefined });
  let enviadas = 0;
  for (const s of subs) {
    try {
      await hooks.enviar({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga,
        { vapidDetails: { subject: `mailto:${process.env.PUSH_CONTACTO || 'avisos@kuper.media'}`, publicKey: k.publicKey, privateKey: k.privateKey }, TTL: 3600 });
      enviadas++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) d().prepare('DELETE FROM push_subs WHERE endpoint = ?').run(s.endpoint); // el dispositivo ya no existe
    }
  }
  return { enviadas };
}
