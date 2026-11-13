// De qué campaña de Meta viene cada lead. El agente manda el id del anuncio (viene en el mensaje
// cuando la persona escribe desde un anuncio de WhatsApp, Instagram o Messenger) y aquí se le
// piden a Meta los nombres de la campaña, el conjunto y el anuncio. Para eso hace falta un token
// con permiso ads_read (campo "Token de anuncios" del cliente); sin él se muestra el título del anuncio.
import { config } from './config.js';
import * as db from './db.js';

export const hooks = { fetch: (...a) => fetch(...a) }; // pruebas
const DIA = 86400_000;

/** Etiqueta para mostrar: campaña > título del anuncio > id del anuncio > "Orgánico". */
export const etiquetaCampana = (l) => l.campana || l.anuncio || (l.anuncio_id ? `Anuncio ${l.anuncio_id}` : '') || (l.campana_json ? 'Anuncio de Meta' : 'Orgánico');

export async function nombresDeAnuncio(client, anuncioId) {
  const key = `anuncio_${client.id}_${anuncioId}`;
  const guardado = db.kvGet(key);
  if (guardado) { try { const g = JSON.parse(guardado); if (g.ok || Date.now() - g.t < DIA) return g; } catch { /* se vuelve a pedir */ } }
  const creds = db.clientCredentials(client).meta || {};
  const token = creds.ads_token || creds.page_token;
  let r = { ok: false, t: Date.now() };
  if (token && /^\d+$/.test(anuncioId)) {
    try {
      const url = `https://graph.facebook.com/${config.metaGraphVersion}/${anuncioId}?fields=name,adset{name},campaign{name}&access_token=${encodeURIComponent(token)}`;
      const res = await hooks.fetch(url, { signal: AbortSignal.timeout(15_000) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.id) r = { ok: true, t: Date.now(), anuncio: j.name, conjunto: j.adset?.name, campana: j.campaign?.name };
      else r.error = j.error?.message || `HTTP ${res.status}`;
    } catch (e) { r.error = e.message; }
  } else r.error = token ? 'id de anuncio no válido' : 'sin token de Meta';
  db.kvSet(key, JSON.stringify(r));
  if (r.ok) db.setNombresAnuncio(client.id, anuncioId, r);
  else db.logEvent({ clientId: client.id, tipo: 'campana_sin_nombre', detalle: `Anuncio ${anuncioId}: ${r.error}` });
  return r;
}

/** Tras guardar un lead: si viene de un anuncio sin nombre de campaña, lo busca (en segundo plano). */
export function completarCampana(client, lead) {
  if (lead?.anuncio_id && !lead.campana) nombresDeAnuncio(client, lead.anuncio_id).catch(() => {});
}

// ------------------------------------------------------------ CSV
const COLS = [['nombre', 'Nombre'], ['telefono', 'Teléfono'], ['usuario', 'Usuario'], ['email', 'Correo'], ['origen', 'Origen'], ['estado', 'Estado'],
  ['campana_txt', 'Campaña'], ['conjunto', 'Conjunto de anuncios'], ['anuncio', 'Anuncio'], ['anuncio_id', 'ID del anuncio'], ['nota', 'Nota'],
  ['cita_inicio', 'Cita'], ['created_at', 'Llegó'], ['updated_at', 'Actualizado']];
const celda = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // que Excel no lo tome como fórmula
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function leadsCsv(leads, { estados = {} } = {}) {
  const filas = leads.map((l) => ({ ...l, campana_txt: etiquetaCampana(l), estado: estados[l.estado] || l.estado, usuario: l.usuario ? `@${l.usuario}` : '' }));
  return '﻿' + [COLS.map(([, t]) => t).join(','), ...filas.map((f) => COLS.map(([k]) => celda(f[k])).join(','))].join('\r\n') + '\r\n';
}

// ------------------------------------------------------------ campañas que no son de la marca
// Un anuncio de otra empresa que manda gente a este WhatsApp (p. ej. una página ajena conectada al número).
// Marcarla saca a esos leads de listas y reportes, los que lleguen después del mismo anuncio también, y el agente
// les contesta una sola vez con un mensaje fijo (se lo pasa el panel en /conocimiento).
export const MENSAJE_AJENA = 'Hola, gracias por escribir. Parece que este mensaje llegó por error: este WhatsApp no tiene relación con la promoción que viste. Te sugerimos contactar directamente a la marca del anuncio. ¡Saludos!';
export const ajenas = (client) => (Array.isArray(client?.config?.campanas_ajenas) ? client.config.campanas_ajenas : []);
export function marcarAjena(client, etiqueta, { mensaje = '', autor = '' } = {}) {
  const et = String(etiqueta || '').trim();
  if (!et || et === 'Orgánico') throw new Error('Elige una campaña de anuncio.');
  const todos = [...db.listLeads(client.id, { limit: 100000 }), ...db.listLeads(client.id, { limit: 100000, ajenas: true })];
  const deEsta = todos.filter((l) => etiquetaCampana(l) === et);
  const anuncios = [...new Set(deEsta.map((l) => l.anuncio_id).filter(Boolean))];
  const upd = db.getDb().prepare('UPDATE leads SET ajena = 1 WHERE id = ?');
  for (const l of deEsta) upd.run(l.id);
  const lista = [...ajenas(client).filter((a) => a.etiqueta !== et), { etiqueta: et.slice(0, 200), anuncio_ids: anuncios.slice(0, 50), mensaje: String(mensaje || '').trim().slice(0, 600) || MENSAJE_AJENA, desde: new Date().toISOString(), autor: String(autor).slice(0, 80) }];
  db.updateClient(client.id, { config: { ...client.config, campanas_ajenas: lista.slice(-30) } });
  db.logEvent({ clientId: client.id, tipo: 'campana_ajena', detalle: `${et}: ${deEsta.length} leads fuera de reportes` });
  return { leads: deEsta.length, anuncios };
}
export function quitarAjena(client, etiqueta) {
  const a = ajenas(client).find((x) => x.etiqueta === etiqueta);
  if (!a) return 0;
  const leads = db.listLeads(client.id, { limit: 100000, ajenas: true }).filter((l) => etiquetaCampana(l) === etiqueta || (l.anuncio_id && a.anuncio_ids.includes(l.anuncio_id)));
  const upd = db.getDb().prepare('UPDATE leads SET ajena = 0 WHERE id = ?');
  for (const l of leads) upd.run(l.id);
  db.updateClient(client.id, { config: { ...client.config, campanas_ajenas: ajenas(client).filter((x) => x.etiqueta !== etiqueta) } });
  return leads.length;
}
/** Para un lead que acaba de llegar: si viene de una campaña marcada como ajena, lo saca de reportes. */
export function aplicarAjena(client, lead) {
  if (!lead || lead.ajena) return lead;
  const a = ajenas(client).find((x) => (lead.anuncio_id && x.anuncio_ids?.includes(lead.anuncio_id)) || x.etiqueta === etiquetaCampana(lead));
  if (!a) return lead;
  db.getDb().prepare('UPDATE leads SET ajena = 1 WHERE id = ?').run(lead.id);
  return { ...lead, ajena: 1 };
}
/** Lo que el agente necesita saber (sin datos de personas). */
export const ajenasParaAgente = (client) => ajenas(client).map((a) => ({ anuncio_ids: a.anuncio_ids || [], titulo: a.etiqueta, mensaje: a.mensaje }));
