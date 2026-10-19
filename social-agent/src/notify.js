// Avisos al cliente: un correo al día como máximo con los posts que esperan su revisión
// y el link a su portal. WhatsApp queda como opción por cliente (apagada por defecto).
import nodemailer from 'nodemailer';
import { config } from './config.js';
import * as db from './db.js';
import { localDate, localTime, zonedToUtc } from './schedule.js';

const QUE_FALTA = { pendiente: 'por revisar', necesita_asset: 'necesita una foto o video tuyo' };
const RED = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn' };

let transport;
export const smtpConfigured = () => !!(config.smtp.host && config.smtp.user && config.smtp.pass);
function getTransport() {
  transport ??= nodemailer.createTransport({
    host: config.smtp.host, port: config.smtp.port, secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  return transport;
}

export const portalUrl = (client) => `${config.publicBaseUrl}/p/${client.portal_token}`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function digestMessage(client, posts) {
  const url = portalUrl(client);
  const n = posts.length;
  const subject = n === 1 ? `Tienes 1 post por revisar (${client.nombre})` : `Tienes ${n} posts por revisar (${client.nombre})`;
  const lines = posts.map((p) => {
    const fecha = p.scheduled_at ? `${localDate(p.scheduled_at, config.timezone)} ${localTime(p.scheduled_at, config.timezone)}` : 'sin fecha';
    return { text: `- ${RED[p.plataforma] || p.plataforma}, ${fecha}: ${p.tema || 'post'} (${QUE_FALTA[p.status]})`, p, fecha };
  });
  const text = `Hola,\n\nHay contenido nuevo esperando tu visto bueno:\n\n${lines.map((l) => l.text).join('\n')}\n\nRevísalo aquí: ${url}\n\nSi no lo apruebas, no se publica.\n`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">
<p>Hola,</p><p>Hay contenido nuevo esperando tu visto bueno:</p>
<ul>${lines.map((l) => `<li><strong>${esc(RED[l.p.plataforma] || l.p.plataforma)}</strong>, ${esc(l.fecha)}: ${esc(l.p.tema || 'post')} <em>(${esc(QUE_FALTA[l.p.status])})</em></li>`).join('')}</ul>
<p><a href="${esc(url)}" style="display:inline-block;background:#1F6BFF;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Revisar posts</a></p>
<p style="color:#666;font-size:13px">Si no lo apruebas, no se publica.</p></div>`;
  return { subject, text, html };
}

/**
 * Manda el resumen si toca: hay posts nuevos esperando desde el último aviso, ya pasó la hora
 * de aviso del día y no se ha mandado otro hoy. Devuelve lo que hizo (para la bitácora y pruebas).
 */
export async function notifyClient(client, now = new Date(), { send } = {}) {
  const prefs = client.config.notificaciones || {};
  const email = String(prefs.email || '').trim();
  if (!email && !prefs.whatsapp) return { skip: 'sin_destinatario' };

  const hoy = localDate(now, config.timezone);
  if (now < new Date(zonedToUtc(hoy, config.horaAviso, config.timezone))) return { skip: 'antes_de_hora' };
  const key = `aviso_${client.id}`;
  const last = db.kvGet(key);
  if (last && localDate(last, config.timezone) === hoy) return { skip: 'ya_avisado_hoy' };

  const posts = db.waitingSince(client.id, last || '1970-01-01T00:00:00Z');
  if (!posts.length) return { skip: 'nada_nuevo' };

  const result = { posts: posts.length, canales: [] };
  if (email) {
    const sender = send || (smtpConfigured() ? (m) => getTransport().sendMail(m) : null);
    if (!sender) {
      db.logEvent({ clientId: client.id, tipo: 'aviso_error', detalle: 'Falta configurar SMTP_HOST/SMTP_USER/SMTP_PASS en el .env' });
      return { skip: 'sin_smtp' };
    }
    try {
      await sender({ from: config.smtp.from, to: email, ...digestMessage(client, posts) });
      result.canales.push('correo');
    } catch (e) {
      db.logEvent({ clientId: client.id, tipo: 'aviso_error', detalle: `Correo: ${e.message}` });
      return { error: e.message };
    }
  }
  // WhatsApp: el cliente lo puede pedir ("whatsapp": true), pero aún no se envía. Queda anotado.
  if (prefs.whatsapp) db.logEvent({ clientId: client.id, tipo: 'aviso_whatsapp_pendiente', detalle: 'El aviso por WhatsApp todavía no está conectado' });

  db.kvSet(key, now.toISOString());
  if (result.canales.length) db.logEvent({ clientId: client.id, tipo: 'aviso_enviado', detalle: `${result.canales.join(', ')}: ${posts.length} post(s) a ${email}` });
  return result;
}
