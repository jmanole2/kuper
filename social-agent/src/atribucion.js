// Atribución a Meta: cuando un lead compra (pagó con link o se marcó "Vendido"), se le avisa a Meta por la API de
// Conversiones con el evento Purchase y su valor. Si el lead llegó por un anuncio de clic a WhatsApp, va el ctwa_clid
// y Meta sabe qué anuncio vendió de verdad: sus campañas aprenden a traer más gente que compra.
//
// client.config.conversiones = { activo, dataset_id }  ·  credentials.meta.capi_token (token de sistema con permiso de anuncios)
import crypto from 'node:crypto';
import { config } from './config.js';
import * as db from './db.js';

export const hooks = { fetch: (...a) => fetch(...a) }; // pruebas
const sha = (s) => crypto.createHash('sha256').update(String(s).trim().toLowerCase()).digest('hex');
export const ajustes = (client) => ({ activo: false, dataset_id: '', ...(client?.config?.conversiones || {}) });

/** Arma el evento Purchase de Meta para un lead. */
export function evento(client, lead, { valor = 0, moneda = 'MXN', id = '', ahora = new Date() } = {}) {
  let camp = {};
  try { camp = JSON.parse(lead.campana_json || '{}') || {}; } catch { /* sin anuncio */ }
  const tel = String(lead.telefono || '').replace(/\D/g, '');
  const waba = db.clientCredentials(client).whatsapp?.waba_id;
  const porWhatsApp = Boolean(camp.ctwa_clid) || lead.origen === 'whatsapp';
  return {
    event_name: 'Purchase', event_time: Math.floor(ahora.getTime() / 1000), event_id: id || `lead-${lead.id}-${Math.floor(ahora.getTime() / 1000)}`,
    action_source: porWhatsApp ? 'business_messaging' : 'system_generated',
    ...(porWhatsApp ? { messaging_channel: 'whatsapp' } : {}),
    user_data: { ...(tel ? { ph: [sha(tel)] } : {}), ...(lead.email ? { em: [sha(lead.email)] } : {}), ...(camp.ctwa_clid ? { ctwa_clid: camp.ctwa_clid } : {}), ...(waba && porWhatsApp ? { whatsapp_business_account_id: String(waba) } : {}) },
    custom_data: { currency: moneda, value: Math.round(Number(valor) * 100) / 100 },
  };
}

/** Manda la venta a Meta. No rompe nada si no está configurado o Meta falla (queda en el registro). */
export async function venta(client, lead, opts = {}) {
  const aj = ajustes(client);
  const token = db.clientCredentials(client).meta?.capi_token;
  if (!aj.activo || !aj.dataset_id || !token || !lead) return { enviado: false };
  const ev = evento(client, lead, opts);
  try {
    const r = await hooks.fetch(`https://graph.facebook.com/${config.metaGraphVersion}/${encodeURIComponent(aj.dataset_id)}/events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ data: [ev], access_token: token }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error?.message || `Meta ${r.status}`);
    db.logEvent({ clientId: client.id, tipo: 'conversion_meta', detalle: `${lead.nombre || lead.telefono}: $${ev.custom_data.value}${ev.user_data.ctwa_clid ? ' (anuncio)' : ''}` });
    return { enviado: true, anuncio: Boolean(ev.user_data.ctwa_clid) };
  } catch (e) {
    db.logEvent({ clientId: client.id, tipo: 'conversion_meta_error', detalle: e.message });
    return { enviado: false, error: e.message };
  }
}
