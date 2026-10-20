// Agenda de citas con Google Calendar como fuente de verdad.
// - Disponibilidad: horarios libres según las reglas del cliente (duración, margen, horario, anticipación)
//   y lo que ya está ocupado en su Google Calendar (incluidas las citas que se pusieron a mano).
// - Reservar: se vuelve a revisar el calendario justo antes de crear el evento, una reserva a la vez
//   por cliente, para que dos personas no tomen el mismo horario.
//
// Credenciales: una cuenta de servicio de Google de la agencia (archivo JSON, nunca en el repo).
// Cada cliente comparte su calendario con el correo de esa cuenta ("Hacer cambios en eventos").
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { zonedToUtc, localDate, addDays } from '../schedule.js';

const DIAS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
export const AGENDA_DEFAULT = {
  calendar_id: '',
  duracion_min: 45,
  margen_min: 15,
  anticipacion_horas: 4,
  paso_min: 30,
  horario: { lun: ['09:00', '18:00'], mar: ['09:00', '18:00'], mie: ['09:00', '18:00'], jue: ['09:00', '18:00'] },
  titulo: 'Cita con {nombre}',
};
export const agendaCfg = (client) => ({ ...AGENDA_DEFAULT, ...(client.config.agenda || {}) });

// ------------------------------------------------------------ Google (cuenta de servicio)
const saFile = () => process.env.GOOGLE_SA_FILE || path.join(config.dataDir, 'google-service-account.json');
export function serviceAccount() {
  try { return JSON.parse(fs.readFileSync(saFile(), 'utf8')); } catch { return null; }
}
const b64u = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
let cached = null;
async function googleToken() {
  if (cached && cached.exp - 60 > Date.now() / 1000) return cached.token;
  const sa = serviceAccount();
  if (!sa?.client_email || !sa?.private_key) throw new Error(`Falta la cuenta de servicio de Google (${saFile()}).`);
  const iat = Math.floor(Date.now() / 1000), exp = iat + 3600;
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/calendar', aud: sa.token_uri || 'https://oauth2.googleapis.com/token', iat, exp }));
  const sig = b64u(crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(sa.private_key));
  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${body}.${sig}` }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google: ${j.error_description || j.error || res.status}`);
  cached = { token: j.access_token, exp };
  return j.access_token;
}
async function gcal(method, p, body) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${p}`, {
    method, headers: { Authorization: `Bearer ${await googleToken()}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = j.error?.message || res.status;
    throw new Error(`Google Calendar: ${msg}${res.status === 404 ? ' (¿compartiste el calendario con la cuenta de servicio?)' : ''}`);
  }
  return j;
}
export async function busy(calendarId, fromIso, toIso) {
  const j = await gcal('POST', '/freeBusy', { timeMin: fromIso, timeMax: toIso, timeZone: config.timezone, items: [{ id: calendarId }] });
  const cal = j.calendars?.[calendarId];
  if (cal?.errors?.length) throw new Error(`Google Calendar: ${cal.errors.map((e) => e.reason).join(', ')} (¿compartiste el calendario con la cuenta de servicio?)`);
  return (cal?.busy || []).map((b) => [new Date(b.start).getTime(), new Date(b.end).getTime()]);
}
export const upcomingEvents = (calendarId, max = 30) =>
  gcal('GET', `/calendars/${encodeURIComponent(calendarId)}/events?${new URLSearchParams({ timeMin: new Date().toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: String(max) })}`)
    .then((j) => j.items || []);

// ------------------------------------------------------------ disponibilidad
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Horarios candidatos (sin mirar el calendario) desde hoy por `dias` días, respetando horario y anticipación. */
export function candidateSlots(cfg, { now = new Date(), dias = 7 } = {}) {
  const out = [], earliest = now.getTime() + cfg.anticipacion_horas * 3600_000, hoy = localDate(now, config.timezone);
  for (let d = 0; d < dias; d++) {
    const fecha = addDays(hoy, d), dia = DIAS[new Date(`${fecha}T12:00:00Z`).getUTCDay()], h = cfg.horario[dia];
    if (!h) continue;
    for (let m = toMin(h[0]); m + cfg.duracion_min <= toMin(h[1]); m += cfg.paso_min) {
      const start = new Date(zonedToUtc(fecha, hhmm(m), config.timezone)).getTime();
      if (start < earliest) continue;
      out.push({ start, end: start + cfg.duracion_min * 60_000 });
    }
  }
  return out;
}
/** ¿El horario choca con algo ocupado, contando el margen antes y después? */
export const collides = (slot, busyList, margenMin) => {
  const a = slot.start - margenMin * 60_000, b = slot.end + margenMin * 60_000;
  return busyList.some(([s, e]) => s < b && e > a);
};
export async function availability(client, { now = new Date(), dias = 7, busyFn = busy } = {}) {
  const cfg = agendaCfg(client);
  if (!cfg.calendar_id) throw new Error('Falta "agenda": { "calendar_id": "…" } en la configuración del cliente.');
  const cands = candidateSlots(cfg, { now, dias });
  if (!cands.length) return [];
  const ocupado = await busyFn(cfg.calendar_id, new Date(cands[0].start - 86400_000).toISOString(), new Date(cands.at(-1).end + 86400_000).toISOString());
  return cands.filter((s) => !collides(s, ocupado, cfg.margen_min)).map((s) => ({ inicio: new Date(s.start).toISOString(), fin: new Date(s.end).toISOString() }));
}

// ------------------------------------------------------------ reservar
const locks = new Map();
function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const run = prev.then(fn, fn);
  locks.set(key, run.catch(() => {}));
  return run;
}
export class SlotTaken extends Error {}

/** Reserva una cita. { inicio (ISO), nombre, telefono, motivo }. Lanza SlotTaken si ya no está libre. */
export function book(client, { inicio, nombre, telefono, motivo = '' }, { now = new Date(), busyFn = busy, insertFn } = {}) {
  return withLock(`agenda-${client.id}`, async () => {
    const cfg = agendaCfg(client);
    if (!cfg.calendar_id) throw new Error('Falta "agenda": { "calendar_id": "…" } en la configuración del cliente.');
    const start = new Date(inicio).getTime();
    if (!Number.isFinite(start)) throw new Error('Fecha de inicio no válida');
    const slot = { start, end: start + cfg.duracion_min * 60_000 };
    // Debe ser uno de los horarios válidos (día, hora y anticipación).
    const valido = candidateSlots(cfg, { now, dias: 60 }).some((s) => s.start === start);
    if (!valido) throw new SlotTaken('Ese horario está fuera del horario de citas o con menos anticipación de la permitida.');
    const ocupado = await busyFn(cfg.calendar_id, new Date(start - 86400_000).toISOString(), new Date(slot.end + 86400_000).toISOString());
    if (collides(slot, ocupado, cfg.margen_min)) throw new SlotTaken('Ese horario se acaba de ocupar.');
    const ev = {
      summary: cfg.titulo.replace('{nombre}', nombre || 'cliente'),
      description: [motivo && `Motivo: ${motivo}`, telefono && `Teléfono: ${telefono}`, 'Agendada por el agente de Kuper'].filter(Boolean).join('\n'),
      start: { dateTime: new Date(slot.start).toISOString(), timeZone: config.timezone },
      end: { dateTime: new Date(slot.end).toISOString(), timeZone: config.timezone },
      extendedProperties: { private: { kuper: '1', telefono: telefono || '' } },
    };
    const created = await (insertFn || ((e) => gcal('POST', `/calendars/${encodeURIComponent(cfg.calendar_id)}/events`, e)))(ev);
    return { id: created.id, link: created.htmlLink, inicio: ev.start.dateTime, fin: ev.end.dateTime };
  });
}
