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

/** Respaldo: si la ventana de Meta no avisó qué cuenta y número se eligieron, se le pregunta a Meta qué compartió el negocio
 *  con la app (debug_token → cuentas de WhatsApp con permiso) y sus números. Si hay uno solo, se usa ese. */
export async function resolverActivos(token, { numero = '' } = {}) {
  const dbg = await graph('GET', 'debug_token', { query: { input_token: token, access_token: `${config.whatsappApp.id}|${config.whatsappApp.secret}` } });
  const scopes = dbg.data?.granular_scopes || [];
  const wabas = [...new Set(scopes.filter((s) => /^whatsapp_business_(management|messaging)$/.test(s.scope)).flatMap((s) => s.target_ids || []))];
  if (!wabas.length) throw new Error('Meta no compartió ninguna cuenta de WhatsApp con Kuper. En la ventana de Meta elige tu cuenta de WhatsApp Business y tu número, y termina todos los pasos.');
  const numeros = [];
  for (const w of wabas.slice(0, 10)) {
    const j = await graph('GET', `${w}/phone_numbers`, { token, query: { fields: 'id,display_phone_number,verified_name' } }).catch(() => ({ data: [] }));
    for (const p of j.data || []) numeros.push({ waba_id: w, phone_number_id: p.id, numero: p.display_phone_number || '', nombre: p.verified_name || '' });
  }
  const limpio = (x) => String(x || '').replace(/\D/g, '');
  const elegido = numero ? numeros.filter((n) => limpio(n.numero).endsWith(limpio(numero).slice(-10))) : numeros;
  if (elegido.length === 1) return elegido[0];
  if (!numeros.length) throw new Error('Tu cuenta de WhatsApp todavía no tiene un número. En la ventana de Meta agrega y verifica el número.');
  const e = new Error(`Compartiste ${numeros.length} números con Kuper (${numeros.map((n) => n.numero).join(', ')}). Escribe abajo cuál quieres conectar y vuelve a intentarlo.`);
  e.numeros = numeros;
  throw e;
}

export async function conectar(client, { code, waba_id, phone_number_id, evento = '', numero = '', pagina = '' } = {}) {
  if (!configurado()) throw new Error('Falta configurar la app de Meta de Kuper en el panel (META_APP_ID, META_CONFIG_ID y META_APP_SECRET).');
  const creds = db.clientCredentials(client);
  if (!creds.agente_url || !creds.api_key) throw new Error('Primero pon la URL del agente de WhatsApp de esta marca (Configuración).');
  let waba = String(waba_id || '').replace(/\D/g, ''), phone = String(phone_number_id || '').replace(/\D/g, '');
  if (!code) throw new Error('Meta no regresó la autorización. Intenta otra vez y termina todos los pasos de la ventana.');
  const coexistencia = /WHATSAPP_BUSINESS_APP_ONBOARDING/.test(String(evento)) || String(evento) === 'coexistencia';

  // 1. Código -> token del negocio.
  // Con el SDK de Meta en el navegador, Meta puede pedir la misma dirección de regreso con la que abrió la ventana: se prueba
  // sin ella y con la de la página del botón (solo direcciones del propio panel).
  const base = String(config.publicBaseUrl || '').replace(/\/+$/, '');
  const pag = /^https:\/\/[^\s]+$/.test(pagina) && base && pagina.startsWith(base) ? pagina.split('#')[0] : '';
  const intentos = [null, pag, pag && (pag.endsWith('/') ? pag.slice(0, -1) : `${pag}/`), base && `${base}/`].filter((x, i, a) => x !== '' && a.indexOf(x) === i);
  let token = null, ultimo = null;
  for (const redirect of intentos) {
    try {
      ({ access_token: token } = await graph('GET', 'oauth/access_token', { query: { client_id: config.whatsappApp.id, client_secret: config.whatsappApp.secret, code, ...(redirect ? { redirect_uri: redirect } : {}) } }));
      break;
    } catch (e) { ultimo = e; if (!/redirect_uri/i.test(e.message)) throw e; }
  }
  if (!token) throw ultimo || new Error('Meta no regresó el token. Intenta otra vez.');
  // La ventana no avisó la cuenta y el número: se le pregunta a Meta qué se compartió.
  if (!waba || !phone) { const r = await resolverActivos(token, { numero }); waba = r.waba_id; phone = r.phone_number_id; }
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
