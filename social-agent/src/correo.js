// Correo como canal: el panel revisa el buzón de la marca (IMAP), cada correo nuevo queda como lead con su conversación,
// y la IA contesta con lo que sabe el agente ("Lo que sabe tu agente" + avisos vigentes). Dos modos:
//   - borrador:   la IA deja la respuesta lista y una persona la revisa y la manda desde el panel (recomendado al inicio);
//   - automatico: la IA la manda sola, salvo que pida pasarlo a una persona (queja, precio especial, algo que no sabe).
// Se responde en el mismo hilo (In-Reply-To / References) desde la cuenta de la marca (SMTP).
//
// client.config.correo      = { activo, modo, nombre, firma }
// credentials.correo        = { imap_host, imap_port, smtp_host, smtp_port, usuario, password }   (cifrado)
import dns from 'node:dns/promises';
import net from 'node:net';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import * as db from './db.js';
import * as conocimiento from './conocimiento.js';
import { pedirJSON } from './llm/proveedor.js';

export const hooks = {
  imap: (o) => new ImapFlow(o),
  smtp: (o) => nodemailer.createTransport(o),
  ia: (...a) => pedirJSON(...a),
  lookup: (h) => dns.lookup(h, { all: true }),
  avisar: null, // pruebas / push al equipo
};
export const MODOS = { borrador: 'La IA deja la respuesta lista y alguien del equipo la aprueba', automatico: 'La IA contesta sola (lo delicado lo pasa al equipo)' };
export const PROVEEDORES = {
  google: { nombre: 'Google Workspace / Gmail', imap_host: 'imap.gmail.com', imap_port: 993, smtp_host: 'smtp.gmail.com', smtp_port: 465 },
  outlook: { nombre: 'Outlook / Microsoft 365', imap_host: 'outlook.office365.com', imap_port: 993, smtp_host: 'smtp.office365.com', smtp_port: 587 },
  dreamhost: { nombre: 'DreamHost', imap_host: 'imap.dreamhost.com', imap_port: 993, smtp_host: 'smtp.dreamhost.com', smtp_port: 465 },
};
export const ajustes = (client) => ({ activo: false, modo: 'borrador', nombre: '', firma: '', ...(client?.config?.correo || {}) });
export const cuenta = (client) => db.clientCredentials(client).correo || null;
export const listo = (client) => { const c = cuenta(client); return ajustes(client).activo && !!(c?.imap_host && c?.smtp_host && c?.usuario && c?.password); };

let tablas = false;
const d = () => {
  if (!tablas) {
    tablas = true;
    db.getDb().exec(`CREATE TABLE IF NOT EXISTS correos (
      id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, lead_id INTEGER,
      direccion TEXT NOT NULL, message_id TEXT, in_reply_to TEXT, referencias TEXT, de TEXT, para TEXT, asunto TEXT, texto TEXT,
      estado TEXT NOT NULL, borrador TEXT, motivo TEXT, autor TEXT, error TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS correos_msg ON correos(client_id, message_id);
    CREATE INDEX IF NOT EXISTS correos_estado ON correos(client_id, estado, id);`);
  }
  return db.getDb();
};

// ------------------------------------------------------------ servidores permitidos
// El servidor lo escribe la marca: se valida que sea un nombre de dominio público (no una IP interna del servidor).
const privada = (ip) => {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const x = ip.toLowerCase();
  return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80') || x.startsWith('::ffff:') && privada(x.slice(7));
};
export async function hostSeguro(host) {
  const h = String(host || '').trim().toLowerCase();
  if (!/^(?=.{4,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(h)) throw new Error(`"${host}" no es un servidor de correo válido.`);
  const ips = await hooks.lookup(h).catch(() => { throw new Error(`No encontré el servidor ${h}.`); });
  if (!ips.length || ips.some((x) => privada(x.address))) throw new Error(`El servidor ${h} no es válido.`);
  return h;
}
const PUERTOS_IMAP = [993], PUERTOS_SMTP = [465, 587];

async function conectarImap(c) {
  const host = await hostSeguro(c.imap_host);
  const im = hooks.imap({ host, port: PUERTOS_IMAP.includes(Number(c.imap_port)) ? Number(c.imap_port) : 993, secure: true, auth: { user: c.usuario, pass: c.password }, logger: false, socketTimeout: 60000 });
  await im.connect();
  return im;
}
async function transporte(c) {
  const host = await hostSeguro(c.smtp_host);
  const port = PUERTOS_SMTP.includes(Number(c.smtp_port)) ? Number(c.smtp_port) : 465;
  return hooks.smtp({ host, port, secure: port === 465, requireTLS: port !== 465, auth: { user: c.usuario, pass: c.password }, connectionTimeout: 20000 });
}

/** Prueba que la cuenta entre por IMAP y por SMTP (botón "Probar conexión"). */
export async function probar(client) {
  const c = cuenta(client);
  if (!c?.usuario || !c?.password) throw new Error('Falta el correo o la contraseña.');
  const im = await conectarImap(c).catch((e) => { throw new Error(`No pude entrar a leer el correo (IMAP): ${e.authenticationFailed ? 'usuario o contraseña incorrectos' : e.message}`); });
  await im.logout().catch(() => {});
  const t = await transporte(c);
  await t.verify().catch((e) => { throw new Error(`No pude entrar a enviar correo (SMTP): ${/auth|535|credentials/i.test(e.message) ? 'usuario o contraseña incorrectos' : e.message}`); });
  return true;
}

// ------------------------------------------------------------ leer
const AUTOMATICO = /no-?reply|mailer-daemon|postmaster|notificaciones?@|notifications?@|bounce/i;
/** Quita lo citado del correo anterior ("El lunes … escribió:", líneas con ">") y firmas largas. */
export function limpiarTexto(t) {
  const lineas = String(t || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  for (const l of lineas) {
    if (/^(El|On) .{5,200}(escribió|wrote):\s*$/i.test(l.trim()) || /^-{2,}\s*(Original Message|Mensaje original)/i.test(l.trim()) || /^(De|From):\s.+/i.test(l.trim()) && out.length) break;
    if (/^>/.test(l)) continue;
    out.push(l);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 4000);
}
const esMasivo = (p) => {
  const h = p.headers;
  const auto = String(h.get('auto-submitted') || 'no').toLowerCase();
  const prec = String(h.get('precedence') || '').toLowerCase();
  return auto !== 'no' || ['bulk', 'list', 'junk'].includes(prec) || h.has('list') || h.has('list-unsubscribe') || h.has('list-id');
};

/** Procesa un correo crudo. Devuelve el registro guardado o null si se ignora. */
export async function procesar(client, raw) {
  const p = await simpleParser(raw);
  const from = p.from?.value?.[0];
  const email = String(from?.address || '').toLowerCase();
  const c = cuenta(client);
  const mid = String(p.messageId || '').slice(0, 300) || `sin-id-${Date.now()}-${Math.random()}`;
  if (!email || email === String(c?.usuario || '').toLowerCase() || AUTOMATICO.test(email) || esMasivo(p)) return null;
  const texto = limpiarTexto(p.text || (p.html ? String(p.html).replace(/<[^>]+>/g, ' ') : ''));
  if (!texto) return null;
  const asunto = String(p.subject || '(sin asunto)').slice(0, 200);
  const r = d().prepare(`INSERT OR IGNORE INTO correos (client_id, direccion, message_id, in_reply_to, referencias, de, para, asunto, texto, estado)
    VALUES (?, 'entrante', ?, ?, ?, ?, ?, ?, ?, 'recibido')`).run(client.id, mid, String(p.inReplyTo || '').slice(0, 300) || null,
    [].concat(p.references || []).join(' ').slice(0, 2000) || null, email, String(c?.usuario || ''), asunto, texto);
  if (!r.changes) return null; // ya lo teníamos
  let lead = db.upsertLead(client.id, { email, nombre: String(from?.name || '').slice(0, 80) || undefined, origen: 'correo' });
  db.addLeadMessage(client.id, { email }, { rol: 'lead', texto: `✉️ ${asunto}\n\n${texto}` });
  d().prepare('UPDATE correos SET lead_id = ? WHERE id = ?').run(lead.id, Number(r.lastInsertRowid));
  try { const eq = await import('./equipo.js'); lead = eq.repartir(client, lead) || lead; } catch { /* sin reparto */ }
  const row = obtener(client.id, Number(r.lastInsertRowid));
  if (lead.control === 'humano') { await avisarEquipo(client, lead, `Correo de ${lead.nombre || email}: lo atiende el equipo.`); return row; }
  await responderConIA(client, lead, row);
  return obtener(client.id, row.id);
}

/** Revisa los correos nuevos del buzón. La primera vez solo marca dónde va (no contesta correos viejos). */
export async function revisar(client) {
  if (!listo(client)) return { nuevos: 0 };
  const im = await conectarImap(cuenta(client));
  const clave = `correo:uid:${client.id}`;
  let nuevos = 0;
  const lock = await im.getMailboxLock('INBOX');
  try {
    const guardado = db.kvGet(clave);
    const siguiente = Number(im.mailbox?.uidNext || 1);
    if (guardado === null) { db.kvSet(clave, siguiente - 1); return { nuevos: 0, inicio: true }; }
    const ult = Number(guardado);
    if (siguiente - 1 <= ult) return { nuevos: 0 };
    let max = ult;
    for await (const m of im.fetch(`${ult + 1}:*`, { uid: true, source: true }, { uid: true })) {
      if (m.uid <= ult) continue;
      max = Math.max(max, m.uid);
      try { if (await procesar(client, m.source)) nuevos++; } catch (e) { db.logEvent({ clientId: client.id, tipo: 'correo_error', detalle: e.message }); }
      if (nuevos >= 40) break; // de a poco si llegaron muchos
    }
    db.kvSet(clave, max);
  } finally { lock.release(); await im.logout().catch(() => {}); }
  return { nuevos };
}

// ------------------------------------------------------------ contestar
const S = { type: 'string' };
const SCHEMA = { type: 'object', additionalProperties: false, required: ['respuesta', 'pasar_a_persona', 'motivo'],
  properties: { respuesta: S, pasar_a_persona: { type: 'boolean' }, motivo: S } };

async function responderConIA(client, lead, correo) {
  const aj = ajustes(client);
  const historial = db.leadMessages(lead.id).slice(-12).map((m) => ({ role: m.rol === 'lead' ? 'user' : 'assistant', content: String(m.texto).slice(0, 3000) }));
  const system = `Eres quien contesta el correo de ${client.nombre}${aj.nombre ? ` (firmas como ${aj.nombre})` : ''}. Responde en el idioma del cliente, con tono cordial y profesional, en texto plano (sin markdown), breve y útil.
- Usa SOLO la información de abajo. Si no sabes algo, no lo inventes: dilo y ofrece que alguien del equipo le dé seguimiento.
- Pon "pasar_a_persona": true (y explica en "motivo") si es una queja, una cancelación, un precio o descuento especial, algo legal o de facturación, o si no tienes la información para contestar bien. Aun así deja en "respuesta" un borrador útil.
- No pongas firma ni despedida con nombre: el sistema agrega la firma.
INFORMACIÓN DEL NEGOCIO:
${conocimiento.textoParaAgente(client).slice(0, 18000) || '(sin información cargada)'}`;
  let r;
  try { r = await hooks.ia({ system, messages: historial.length ? historial : [{ role: 'user', content: correo.texto }], schema: SCHEMA, maxTokens: 1500, etiqueta: 'correo' }); } catch (e) {
    d().prepare("UPDATE correos SET estado = 'error', error = ?, updated_at = datetime('now') WHERE id = ?").run(`IA: ${e.message}`.slice(0, 300), correo.id);
    return;
  }
  const respuesta = String(r.data?.respuesta || '').trim().slice(0, 6000);
  const escalar = !!r.data?.pasar_a_persona || !respuesta;
  d().prepare("UPDATE correos SET estado = 'borrador', borrador = ?, motivo = ?, updated_at = datetime('now') WHERE id = ?").run(respuesta, escalar ? String(r.data?.motivo || 'La IA pide que lo revise una persona').slice(0, 300) : null, correo.id);
  if (aj.modo === 'automatico' && !escalar) {
    await enviar(client, correo.id, respuesta, { autor: null }).catch(() => {});
  } else {
    await avisarEquipo(client, lead, escalar ? `Correo para revisar: ${r.data?.motivo || correo.asunto}` : `Respuesta por aprobar: ${correo.asunto}`);
  }
}

async function avisarEquipo(client, lead, texto) {
  try {
    const f = hooks.avisar || (await import('./push.js')).avisar;
    await f(client, { titulo: `✉️ ${client.nombre}`, texto, url: '/app/correo', lead });
  } catch { /* sin avisos */ }
}

const conFirma = (client, texto) => { const f = ajustes(client).firma; return f ? `${texto.trim()}\n\n${String(f).trim()}` : texto.trim(); };

/** Manda la respuesta a un correo entrante (aprobada desde el panel, editada o automática). autor null = la IA. */
export async function enviar(client, correoId, texto, { autor = null } = {}) {
  const x = obtener(client.id, correoId);
  if (!x || x.direccion !== 'entrante') throw new Error('Ese correo ya no existe.');
  if (x.estado === 'respondido') throw new Error('Ese correo ya se contestó.');
  const cuerpo = String(texto ?? x.borrador ?? '').replace(/\r\n/g, '\n').trim().slice(0, 8000);
  if (!cuerpo) throw new Error('La respuesta está vacía.');
  const c = cuenta(client), aj = ajustes(client);
  if (!c?.usuario) throw new Error('Falta conectar el correo de la marca.');
  const asunto = /^re:/i.test(x.asunto || '') ? x.asunto : `Re: ${x.asunto || ''}`.trim();
  const refs = [x.referencias, x.message_id].filter(Boolean).join(' ').trim();
  try {
    const t = await transporte(c);
    const info = await t.sendMail({ from: { name: aj.nombre || client.nombre, address: c.usuario }, to: x.de, subject: asunto, text: conFirma(client, cuerpo),
      inReplyTo: x.message_id || undefined, references: refs || undefined });
    d().prepare(`INSERT OR IGNORE INTO correos (client_id, lead_id, direccion, message_id, in_reply_to, de, para, asunto, texto, estado, autor)
      VALUES (?, ?, 'saliente', ?, ?, ?, ?, ?, ?, 'enviado', ?)`).run(client.id, x.lead_id, String(info?.messageId || `env-${Date.now()}`), x.message_id, c.usuario, x.de, asunto, cuerpo, autor || 'IA');
    d().prepare("UPDATE correos SET estado = 'respondido', autor = ?, error = NULL, updated_at = datetime('now') WHERE id = ?").run(autor || 'IA', x.id);
    db.addLeadMessage(client.id, { email: x.de }, { rol: autor ? 'humano' : 'agente', texto: `✉️ ${asunto}\n\n${cuerpo}`, autor });
    db.logEvent({ clientId: client.id, tipo: 'correo_enviado', detalle: `${autor || 'IA'} → ${x.de}` });
  } catch (e) {
    d().prepare("UPDATE correos SET estado = 'error', error = ?, updated_at = datetime('now') WHERE id = ?").run(String(e.message).slice(0, 300), x.id);
    throw new Error(`No se pudo enviar: ${e.message}`);
  }
}

/** Respuesta escrita a mano desde la conversación del lead: contesta su último correo. */
export async function responderLead(client, lead, texto, autor) {
  const x = d().prepare("SELECT * FROM correos WHERE client_id = ? AND lead_id = ? AND direccion = 'entrante' ORDER BY id DESC LIMIT 1").get(client.id, lead.id);
  if (!x) throw new Error('Este contacto no ha escrito por correo.');
  if (x.estado === 'respondido') {
    // Ya se contestó su último correo: se manda como seguimiento en el mismo hilo.
    d().prepare("UPDATE correos SET estado = 'borrador' WHERE id = ?").run(x.id);
  }
  return enviar(client, x.id, texto, { autor });
}

export const descartar = (clientId, id) => d().prepare("UPDATE correos SET estado = 'descartado', updated_at = datetime('now') WHERE client_id = ? AND id = ? AND direccion = 'entrante' AND estado != 'respondido'").run(clientId, Number(id)).changes;
export const obtener = (clientId, id) => d().prepare('SELECT * FROM correos WHERE client_id = ? AND id = ?').get(clientId, Number(id));
export function listar(clientId, { estado = '', limit = 100 } = {}) {
  return d().prepare(`SELECT c.*, l.nombre AS lead_nombre FROM correos c LEFT JOIN leads l ON l.id = c.lead_id
    WHERE c.client_id = ? AND c.direccion = 'entrante' ${estado ? 'AND c.estado = ?' : ''} ORDER BY c.id DESC LIMIT ?`).all(...[clientId, ...(estado ? [estado] : []), limit]);
}
export function resumen(clientId) {
  const r = d().prepare(`SELECT estado, COUNT(*) n FROM correos WHERE client_id = ? AND direccion = 'entrante' AND datetime(created_at) >= datetime('now', '-30 days') GROUP BY estado`).all(clientId);
  const o = Object.fromEntries(r.map((x) => [x.estado, x.n]));
  return { recibidos: r.reduce((a, x) => a + x.n, 0), por_aprobar: (o.borrador || 0), respondidos: o.respondido || 0, errores: o.error || 0 };
}
export const esCorreo = (lead) => lead?.origen === 'correo' || (!lead?.telefono && !lead?.usuario && !!lead?.email);
