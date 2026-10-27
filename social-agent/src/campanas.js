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
