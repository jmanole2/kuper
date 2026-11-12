// Documentos que los contactos mandan por WhatsApp (PDF, fotos, videos): el agente los descarga de Meta y los
// manda aquí. Se guardan en el expediente del lead (se ven y descargan desde su ficha) y, si la marca conectó una
// carpeta de Google Drive, se suben ahí ordenados por país y por contacto:  <carpeta>/México/Café Origen - Ana Torres/RFC.pdf
// La carpeta debe estar en una unidad compartida de Google Drive con la cuenta de servicio del panel como
// "Administrador de contenido" (las cuentas de servicio no tienen espacio propio en "Mi unidad").
//
// client.config.documentos = { activo, requeridos: ['Constancia fiscal', 'Identificación', …], drive_carpeta, etapa_completos }
// El agente pone el tipo (RUT, INE…) con registrar_documento; si ya están todos los requeridos, el lead puede pasar
// solo a la etapa "etapa_completos" del embudo.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import * as db from './db.js';
import * as embudo from './embudo.js';
import { paisDeTelefono, clasificar } from './paises.js';
import { googleToken } from './agenda/index.js';

export const hooks = { fetch: (...a) => fetch(...a), token: () => googleToken('https://www.googleapis.com/auth/drive') }; // pruebas
export const MAX_BYTES = 25 * 1024 * 1024;
const TIPOS_OK = /^(application\/pdf|image\/(jpeg|png|webp|heic)|video\/(mp4|3gpp|quicktime)|application\/(msword|vnd\.openxmlformats-officedocument\.[\w.]+|vnd\.ms-excel)|text\/plain)$/;

export const ajustes = (client) => ({ activo: false, requeridos: [], drive_carpeta: '', etapa_completos: '', ...(client?.config?.documentos || {}) });

let tablas = false;
const d = () => {
  if (!tablas) {
    tablas = true;
    db.getDb().exec(`CREATE TABLE IF NOT EXISTS lead_documentos (
      id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL, tipo TEXT, mime TEXT, bytes INTEGER, ruta TEXT NOT NULL, drive_id TEXT, drive_link TEXT, drive_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS lead_documentos_lead ON lead_documentos(lead_id, id);`);
  }
  return db.getDb();
};
const limpio = (s, n = 80) => String(s || '').normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const ext = (mime, nombre) => path.extname(nombre || '') || ({ 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'video/mp4': '.mp4' }[mime] || '');

export const listar = (clientId, leadId) => d().prepare('SELECT * FROM lead_documentos WHERE client_id = ? AND lead_id = ? ORDER BY id').all(clientId, leadId);
export const obtener = (clientId, id) => d().prepare('SELECT * FROM lead_documentos WHERE client_id = ? AND id = ?').get(clientId, Number(id));
export function faltantes(client, leadId) {
  const req = ajustes(client).requeridos || [];
  const tienen = new Set(listar(client.id, leadId).map((x) => String(x.tipo || '').toLowerCase()).filter(Boolean));
  return req.filter((r) => !tienen.has(String(r).toLowerCase()));
}

/** Guarda un archivo que llegó por WhatsApp. buf: Buffer. */
export async function guardar(client, { telefono, nombre, mime, buf, caption = '' }) {
  if (!ajustes(client).activo) throw new Error('Esta marca no tiene activados los documentos.');
  if (!buf?.length) throw new Error('Archivo vacío.');
  if (buf.length > MAX_BYTES) throw new Error('El archivo pesa más de 25 MB.');
  const m = String(mime || '').split(';')[0].toLowerCase();
  if (!TIPOS_OK.test(m)) throw new Error(`Tipo de archivo no permitido (${m || 'desconocido'}).`);
  let lead = db.upsertLead(client.id, { telefono, origen: 'whatsapp' });
  lead = clasificar(client, lead);
  const nom = limpio(nombre) || `archivo${ext(m)}`;
  const dir = path.join(config.dataDir, 'documentos', String(client.id), String(lead.id));
  fs.mkdirSync(dir, { recursive: true });
  const ruta = path.join(dir, `${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ext(m, nom)}`);
  fs.writeFileSync(ruta, buf);
  const r = d().prepare('INSERT INTO lead_documentos (client_id, lead_id, nombre, mime, bytes, ruta) VALUES (?, ?, ?, ?, ?, ?)').run(client.id, lead.id, nom, m, buf.length, ruta);
  const doc = obtener(client.id, Number(r.lastInsertRowid));
  db.addLeadMessage(client.id, { telefono }, { rol: 'lead', texto: `📎 ${nom}${caption ? ` · ${String(caption).slice(0, 300)}` : ''}` });
  db.logEvent({ clientId: client.id, tipo: 'documento_recibido', detalle: `${lead.nombre || lead.telefono}: ${nom}` });
  subirADrive(client, lead, doc).catch(() => { /* el error queda en el documento */ });
  return { id: doc.id, lead_id: lead.id, faltan: faltantes(client, lead.id) };
}

/** El agente dice qué documento es (RUT, INE, video pitch…). Si ya están todos, mueve el lead de etapa. */
export function registrarTipo(client, { telefono, tipo }) {
  const t = limpio(tipo, 60);
  if (!t) throw new Error('Falta el tipo de documento.');
  const dig = String(telefono || '').replace(/\D/g, '').slice(-10);
  const lead = d().prepare("SELECT * FROM leads WHERE client_id = ? AND telefono LIKE ? ORDER BY updated_at DESC LIMIT 1").get(client.id, `%${dig}`);
  if (!lead) throw new Error('Contacto no encontrado.');
  const ultimo = d().prepare('SELECT * FROM lead_documentos WHERE client_id = ? AND lead_id = ? ORDER BY id DESC LIMIT 1').get(client.id, lead.id);
  if (!ultimo) throw new Error('Ese contacto no ha mandado documentos.');
  // Usa el nombre exacto de la lista de requeridos si coincide (sin importar mayúsculas).
  const req = ajustes(client).requeridos || [];
  const tipoFinal = req.find((r) => r.toLowerCase() === t.toLowerCase()) || t;
  d().prepare('UPDATE lead_documentos SET tipo = ? WHERE id = ?').run(tipoFinal, ultimo.id);
  const faltan = faltantes(client, lead.id);
  const etapa = ajustes(client).etapa_completos;
  let movido = false;
  if (!faltan.length && req.length && etapa) {
    try { embudo.moverLead(client, lead.id, etapa); movido = true; db.logEvent({ clientId: client.id, tipo: 'documentos_completos', detalle: lead.nombre || lead.telefono }); } catch { /* etapa no válida */ }
  }
  return { tipo: tipoFinal, faltan, completo: !faltan.length && req.length > 0, movido };
}

// ------------------------------------------------------------ Google Drive (unidad compartida)
const DRIVE = 'https://www.googleapis.com/drive/v3';
async function drive(method, url, { body, headers = {} } = {}) {
  const r = await hooks.fetch(url, { method, headers: { Authorization: `Bearer ${await hooks.token()}`, ...headers }, body, signal: AbortSignal.timeout(60000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Drive ${r.status}: ${j.error?.message || ''}`.trim());
  return j;
}
async function carpeta(padre, nombre) {
  const q = `name = '${nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and '${padre}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const r = await drive('GET', `${DRIVE}/files?${new URLSearchParams({ q, fields: 'files(id)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', corpora: 'allDrives' })}`);
  if (r.files?.[0]?.id) return r.files[0].id;
  const c = await drive('POST', `${DRIVE}/files?supportsAllDrives=true&fields=id`, { headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nombre, mimeType: 'application/vnd.google-apps.folder', parents: [padre] }) });
  return c.id;
}
export async function subirADrive(client, lead, doc) {
  const raiz = String(ajustes(client).drive_carpeta || '').trim();
  if (!raiz) return null;
  try {
    const pais = paisDeTelefono(lead.telefono) || 'Sin país';
    const quien = limpio([lead.empresa, lead.nombre || lead.telefono].filter(Boolean).join(' - '), 100) || 'Contacto';
    const destino = await carpeta(await carpeta(raiz, pais), quien);
    const limite = `kuper${crypto.randomBytes(8).toString('hex')}`;
    const cuerpo = Buffer.concat([
      Buffer.from(`--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: doc.nombre, parents: [destino] })}\r\n--${limite}\r\nContent-Type: ${doc.mime || 'application/octet-stream'}\r\n\r\n`),
      fs.readFileSync(doc.ruta), Buffer.from(`\r\n--${limite}--`)]);
    const f = await drive('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink',
      { headers: { 'Content-Type': `multipart/related; boundary=${limite}` }, body: cuerpo });
    d().prepare('UPDATE lead_documentos SET drive_id = ?, drive_link = ?, drive_error = NULL WHERE id = ?').run(f.id, f.webViewLink || null, doc.id);
    return f;
  } catch (e) {
    d().prepare('UPDATE lead_documentos SET drive_error = ? WHERE id = ?').run(String(e.message).slice(0, 300), doc.id);
    db.logEvent({ clientId: client.id, tipo: 'documento_drive_error', detalle: `${doc.nombre}: ${e.message}` });
    throw e;
  }
}
