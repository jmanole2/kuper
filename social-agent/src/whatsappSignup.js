// "Conectar WhatsApp" (Embedded Signup de Meta con la app de Kuper como Tech Provider).
// El cliente inicia sesión en Meta desde el panel y elige su número; aquí:
//   1. se cambia el código por el token del negocio (META_APP_ID + META_APP_SECRET de la app de Kuper);
//   2. se le pasa al agente del cliente (token, número, verify token y secreto de la app) por /panel/whatsapp;
//   3. se suscribe la cuenta de WhatsApp a la app, con los mensajes dirigidos al webhook de SU agente;
//   4. si es un número nuevo se registra con un PIN; si es coexistencia (sigue usando la app de WhatsApp
//      Business) se pide sincronizar sus contactos.
// El token y el PIN se guardan cifrados en las credenciales del cliente.
import crypto from 'node:crypto';
import { config } from './config.js';
import * as db from './db.js';
import { llamarAgente } from './agente.js';

export const hooks = { fetch: null }; // pruebas
const GRAPH = () => `https://graph.facebook.com/${config.whatsappApp.graph}`;

export const configurado = () => Boolean(config.whatsappApp.id && config.whatsappApp.configId && config.whatsappApp.secret);

async function graph(method, ruta, { token, body, query } = {}) {
  const url = new URL(`${GRAPH()}/${ruta}`);
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, v);
  const r = await (hooks.fetch || fetch)(url, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.error_user_msg || j.error?.message || `Meta respondió ${r.status}`);
  return j;
}

/** Estado para mostrar en el panel (sin token ni PIN). */
export function estado(client) {
  const w = db.clientCredentials(client).whatsapp;
  return w?.phone_id ? { conectado: true, numero: w.numero || '', nombre: w.nombre || '', coexistencia: !!w.coexistencia, conectado_at: w.conectado_at, phone_id: w.phone_id, waba_id: w.waba_id } : { conectado: false };
}

export async function conectar(client, { code, waba_id, phone_number_id, evento = '' } = {}) {
  if (!configurado()) throw new Error('Falta configurar la app de Meta de Kuper en el panel (META_APP_ID, META_CONFIG_ID y META_APP_SECRET).');
  const creds = db.clientCredentials(client);
  if (!creds.agente_url || !creds.api_key) throw new Error('Primero pon la URL del agente de WhatsApp de esta marca (Configuración).');
  const waba = String(waba_id || '').replace(/\D/g, ''), phone = String(phone_number_id || '').replace(/\D/g, '');
  if (!code || !waba || !phone) throw new Error('Meta no regresó el número elegido. Intenta otra vez y termina todos los pasos de la ventana.');
  const coexistencia = /WHATSAPP_BUSINESS_APP_ONBOARDING/.test(String(evento));

  // 1. Código -> token del negocio.
  const { access_token: token } = await graph('GET', 'oauth/access_token', { query: { client_id: config.whatsappApp.id, client_secret: config.whatsappApp.secret, code } });
  if (!token) throw new Error('Meta no regresó el token. Intenta otra vez.');
  const verify = crypto.randomBytes(18).toString('hex');

  // 2. El agente recibe la conexión antes de suscribir (Meta verifica su webhook con este verify token).
  await llamarAgente(client, 'POST', '/whatsapp', { token, phone_id: phone, waba_id: waba, verify_token: verify, app_secret: config.whatsappApp.secret });

  // 3. Mensajes de esta cuenta -> webhook de su agente.
  await graph('POST', `${waba}/subscribed_apps`, { token, body: { override_callback_uri: `${creds.agente_url.replace(/\/+$/, '')}/webhook`, verify_token: verify } });

  // 4. Número nuevo: registrarlo. Coexistencia: ya está registrado en la app; se sincronizan sus contactos.
  let pin = creds.whatsapp?.pin || String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const avisos = [];
  if (coexistencia) {
    try { await graph('POST', `${phone}/smb_app_data`, { token, body: { messaging_product: 'whatsapp', sync_type: 'smb_app_state_sync' } }); }
    catch (e) { avisos.push(`No se pudieron sincronizar los contactos (${e.message}).`); }
    pin = creds.whatsapp?.pin || null;
  } else {
    try { await graph('POST', `${phone}/register`, { token, body: { messaging_product: 'whatsapp', pin } }); }
    catch (e) { avisos.push(`El número no se pudo registrar todavía (${e.message}).`); }
  }
  const info = await graph('GET', phone, { token, query: { fields: 'display_phone_number,verified_name' } }).catch(() => ({}));

  db.updateClient(client.id, { credentials: { ...db.clientCredentials(db.getClient(client.id)), whatsapp: {
    waba_id: waba, phone_id: phone, token, pin, coexistencia, numero: info.display_phone_number || '', nombre: info.verified_name || '', conectado_at: new Date().toISOString() } } });
  db.logEvent({ clientId: client.id, tipo: 'whatsapp_conectado', detalle: `${info.display_phone_number || phone}${coexistencia ? ' (coexistencia)' : ''}` });
  return { numero: info.display_phone_number || phone, nombre: info.verified_name || '', coexistencia, avisos };
}
