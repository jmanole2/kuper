// Avisos al cliente: un correo al día como máximo con los posts que esperan su revisión
// y el link a su portal. WhatsApp queda como opción por cliente (apagada por defecto).
import nodemailer from 'nodemailer';
import { config, mediaUrl } from './config.js';
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

const COLOR = { instagram: '#e1306c', facebook: '#4f7cff', linkedin: '#3d8bd9', tiktok: '#111111' };
const FORMATO = { video_animado: 'Video', carrusel: 'Carrusel', imagen_estatica: 'Imagen', solo_texto: 'Texto' };
const fechaBonita = (iso) => new Intl.DateTimeFormat('es-MX', { timeZone: config.timezone, weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

/** Correo del resumen diario: HTML con tablas y estilos en línea (lo que respetan Gmail, Outlook y Apple Mail). */
export function digestMessage(client, posts) {
  const url = portalUrl(client);
  const n = posts.length;
  const subject = n === 1 ? `Tienes 1 publicación lista para revisar · ${client.nombre}` : `Tienes ${n} publicaciones listas para revisar · ${client.nombre}`;
  const pre = n === 1 ? 'Échale un ojo y apruébala desde tu teléfono.' : 'Échales un ojo y apruébalas desde tu teléfono.';
  const fecha = (p) => (p.scheduled_at ? fechaBonita(p.scheduled_at) : 'sin fecha');
  const text = `Hola,\n\n${n === 1 ? 'Tienes una publicación lista' : `Tienes ${n} publicaciones listas`} para revisar:\n\n${posts.map((p) => `- ${RED[p.plataforma] || p.plataforma} · ${fecha(p)}: ${p.tema || 'post'} (${QUE_FALTA[p.status]})`).join('\n')}\n\nRevísalas aquí: ${url}\n\nSi no las apruebas, no se publican.\n`;
  const logo = client.logo_path ? mediaUrl(client.logo_path) : null;
  const thumb = (p) => { const f = p.image_path || p.images?.[0]; return f ? mediaUrl(f) : null; };
  const card = (p) => {
    const t = thumb(p), col = COLOR[p.plataforma] || '#2f6bff', falta = p.status === 'necesita_asset';
    return `<tr><td style="padding:0 0 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#15171c;border:1px solid #23262e;border-radius:18px">
<tr>${t ? `<td width="96" style="padding:14px 0 14px 14px;vertical-align:top"><a href="${esc(url)}"><img src="${esc(t)}" width="82" height="102" alt="" style="display:block;width:82px;height:102px;object-fit:cover;border-radius:12px;background:#000"></a></td>` : ''}
<td style="padding:14px 16px;vertical-align:top">
<div style="font-size:12px;font-weight:600;color:${col};letter-spacing:.02em">&#9679; ${esc(RED[p.plataforma] || p.plataforma)}${p.formato && FORMATO[p.formato] ? ` <span style="color:#7d8494">· ${FORMATO[p.formato]}</span>` : ''}</div>
<div style="font-size:16px;line-height:1.35;font-weight:600;color:#f2f4f8;margin:6px 0 8px">${esc(p.tema || 'Publicación')}</div>
<div style="font-size:13px;color:#9097a6">${esc(fecha(p))}</div>
${falta ? '<div style="display:inline-block;margin-top:8px;font-size:12px;font-weight:600;color:#fcd34d;background:#2a2410;border-radius:99px;padding:3px 10px">Necesita una foto o video tuyo</div>' : ''}
</td></tr></table></td></tr>`;
  };
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#08090c">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#08090c"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:'Inter Tight',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<tr><td style="padding:0 4px 22px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
${logo ? `<td style="padding-right:12px"><img src="${esc(logo)}" height="36" alt="${esc(client.nombre)}" style="display:block;height:36px;max-width:140px;background:#000;border-radius:10px;padding:6px 8px"></td>` : ''}
<td style="font-size:14px;color:#9097a6">${esc(client.nombre)}</td></tr></table>
</td></tr>
<tr><td style="background:#101217;border:1px solid #1f222a;border-radius:26px;padding:30px 26px">
<div style="font-size:13px;font-weight:600;color:#c6ff3d;letter-spacing:.04em;text-transform:uppercase">Por revisar</div>
<div style="font-size:30px;line-height:1.15;font-weight:600;color:#f2f4f8;margin:8px 0 10px;letter-spacing:-.02em">${n === 1 ? 'Tienes una publicación lista' : `Tienes ${n} publicaciones listas`}</div>
<div style="font-size:15px;line-height:1.55;color:#a3aab8;margin-bottom:24px">${esc(pre)} Si quieres algo distinto, pide cambios ahí mismo y el agente las rehace.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${posts.slice(0, 6).map(card).join('')}</table>
${n > 6 ? `<div style="font-size:13px;color:#9097a6;margin:0 0 14px">y ${n - 6} más en tu portal.</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-top:8px">
<a href="${esc(url)}" style="display:inline-block;background:#c6ff3d;color:#0b0d06;font-size:16px;font-weight:700;text-decoration:none;padding:15px 34px;border-radius:99px">Revisar y aprobar</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:20px 8px;font-size:12px;line-height:1.6;color:#6b7280;text-align:center">
Nada se publica sin tu visto bueno. Este aviso llega una vez al día como máximo, solo cuando hay algo nuevo.<br>
Hecho por Kuper Media
</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

/** Correo de prueba con lo que está por revisar ahora (o los últimos posts si no hay nada pendiente). */
export async function sendTestDigest(client, to) {
  if (!smtpConfigured()) throw new Error('Falta configurar SMTP_HOST, SMTP_USER y SMTP_PASS en el .env del servidor.');
  let posts = db.listPosts({ clientId: client.id, statuses: ['pendiente', 'necesita_asset'], limit: 6 });
  if (!posts.length) posts = db.listPosts({ clientId: client.id, limit: 3 });
  if (!posts.length) throw new Error('No hay posts para armar el correo de prueba.');
  const m = digestMessage(client, posts);
  await getTransport().sendMail({ from: config.smtp.from, to, ...m, subject: `[Prueba] ${m.subject}` });
  return posts.length;
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

/** Correo genérico (reporte mensual, etc.) con el mismo SMTP. */
export async function sendMail(m) {
  if (!smtpConfigured()) throw new Error('Falta configurar SMTP en el .env');
  return getTransport().sendMail({ from: config.smtp.from, ...m });
}
