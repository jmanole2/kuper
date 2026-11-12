// Recordatorios de cita por WhatsApp: antes de cada cita (24 h y 2 h, configurable) se manda una plantilla aprobada
// con el nombre, la fecha y la hora. Las citas salen de los leads con cita (las que agenda el agente, la página de
// citas o el equipo). Cada recordatorio se manda una sola vez por cita; si la cita cambia de hora, se vuelve a mandar.
// Si la plantilla tiene botones (p. ej. "Confirmo" / "Quiero cambiarla"), la respuesta le llega al agente como un
// mensaje normal y él confirma o reagenda.
//
// client.config.recordatorios = { activo, plantilla, idioma, horas: [24, 2], cuerpo }
// Variables de la plantilla: {{1}} nombre, {{2}} fecha ("martes 4 de noviembre"), {{3}} hora ("10:30 a. m.").
import { config } from './config.js';
import * as db from './db.js';
import { enviarPlantilla, render, horaLocal } from './difusion.js';

export const DEFAULTS = { activo: false, plantilla: '', idioma: 'es_MX', horas: [24, 2], cuerpo: '' };
export const ajustes = (client) => ({ ...DEFAULTS, ...(client.config?.recordatorios || {}) });
const HORAS_ENVIO = [8, 21]; // no se manda de madrugada: el de 24 h de una cita a las 9 sale a las 8 del día anterior como pronto

let tablas = false;
const d = () => {
  if (!tablas) {
    tablas = true;
    db.getDb().exec(`CREATE TABLE IF NOT EXISTS recordatorios_enviados (
      lead_id INTEGER NOT NULL, cita_inicio TEXT NOT NULL, horas INTEGER NOT NULL, status TEXT NOT NULL, error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (lead_id, cita_inicio, horas))`);
  }
  return db.getDb();
};

export function limpiar(b = {}) {
  const horas = [...new Set(String(Array.isArray(b.horas) ? b.horas.join(',') : b.horas ?? '24,2').split(',').map((x) => Math.round(Number(x))).filter((x) => x >= 1 && x <= 72))].sort((a, z) => z - a).slice(0, 3);
  return { activo: b.activo === true || b.activo === '1', plantilla: String(b.plantilla || '').trim().toLowerCase().replace(/\s+/g, '_').slice(0, 120),
    idioma: String(b.idioma || 'es_MX').slice(0, 10), horas: horas.length ? horas : [24], cuerpo: String(b.cuerpo || '').slice(0, 1024) };
}

const tz = () => config.timezone || 'America/Mexico_City';
export const fechaTexto = (t) => new Intl.DateTimeFormat('es-MX', { timeZone: tz(), weekday: 'long', day: 'numeric', month: 'long' }).format(t);
export const horaTexto = (t) => new Intl.DateTimeFormat('es-MX', { timeZone: tz(), hour: 'numeric', minute: '2-digit' }).format(t);
const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0] || 'hola';

/** Citas próximas que necesitan recordatorio ahora. */
export function pendientes(client, ahora = new Date()) {
  const aj = ajustes(client);
  if (!aj.activo || !aj.plantilla) return [];
  const out = [];
  const leads = d().prepare("SELECT * FROM leads WHERE client_id = ? AND cita_inicio IS NOT NULL AND telefono IS NOT NULL AND estado != 'perdido'").all(client.id);
  for (const l of leads) {
    const cita = new Date(l.cita_inicio);
    if (!(cita > ahora)) continue;
    const falta = (cita - ahora) / 3600000;
    // El recordatorio más cercano que ya toca y no se ha mandado (si toca el de 2 h, el de 24 h ya no se manda).
    const toca = aj.horas.filter((h) => falta <= h).sort((a, z) => a - z)[0];
    if (!toca) continue;
    // Ya se mandó este u otro más cercano a la cita: no se repite.
    if (d().prepare('SELECT 1 FROM recordatorios_enviados WHERE lead_id = ? AND cita_inicio = ? AND horas <= ?').get(l.id, l.cita_inicio, toca)) continue;
    out.push({ lead: l, horas: toca, vals: [primerNombre(l.nombre), fechaTexto(cita), horaTexto(cita)] });
  }
  return out;
}

/** Una vuelta: manda los recordatorios que tocan (en horario razonable). */
export async function enviar(client, { ahora = new Date() } = {}) {
  const h = horaLocal(ahora);
  const lista = pendientes(client, ahora);
  if (!lista.length) return { enviados: 0 };
  const aj = ajustes(client);
  let enviados = 0;
  for (const { lead, horas, vals } of lista) {
    // De noche solo sale el recordatorio corto (cita de muy temprano); el de 24 h espera a la mañana.
    if ((h < HORAS_ENVIO[0] || h >= HORAS_ENVIO[1]) && horas > 3) continue;
    const marca = (status, error = null) => d().prepare('INSERT OR REPLACE INTO recordatorios_enviados (lead_id, cita_inicio, horas, status, error) VALUES (?, ?, ?, ?, ?)')
      .run(lead.id, lead.cita_inicio, horas, status, error);
    try {
      await enviarPlantilla(client, { telefono: String(lead.telefono).replace(/\D/g, ''), plantilla: aj.plantilla, idioma: aj.idioma, vals,
        texto: aj.cuerpo ? render(aj.cuerpo, vals) : `Recordatorio de tu cita: ${vals[1]} a las ${vals[2]}`, leadId: lead.id, autor: 'Recordatorio de cita' });
      marca('enviado'); enviados++;
      db.logEvent({ clientId: client.id, tipo: 'recordatorio_cita', detalle: `${lead.nombre || lead.telefono}: ${vals[1]} ${vals[2]} (${horas} h antes)` });
    } catch (e) {
      marca('error', String(e.message).slice(0, 300));
      db.logEvent({ clientId: client.id, tipo: 'recordatorio_error', detalle: `${lead.nombre || lead.telefono}: ${e.message}` });
    }
  }
  return { enviados };
}

export function recientes(clientId, limit = 15) {
  return d().prepare(`SELECT r.*, l.nombre, l.telefono FROM recordatorios_enviados r JOIN leads l ON l.id = r.lead_id WHERE l.client_id = ? ORDER BY r.created_at DESC LIMIT ?`).all(clientId, limit);
}
