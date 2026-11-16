// "Conectar WhatsApp" (Embedded Signup): código -> token, se lo pasa al agente, suscribe con el webhook del agente y registra el número.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'wasignup-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123',
  META_APP_ID: '1817877119391171', PUBLIC_BASE_URL: 'https://redes.kuper.media', META_CONFIG_ID: '999888777', META_APP_SECRET: 'secreto-kuper' });
const db = await import('../src/db.js');
const W = await import('../src/whatsappSignup.js');
const agente = await import('../src/agente.js');
const { hashPassword } = await import('../src/crypto.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');
const perfil = { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] };
const c = db.createClient({ slug: 'inhouse', nombre: 'Inhouse Work', perfil, config: { plan: { servicios: { chat: true } } }, credentials: { api_key: 'llave-ih', agente_url: 'https://inhouse.kuper.media' } });
db.createUser({ email: 'ana@inhouse.mx', nombre: 'Ana', rol: 'cliente', client_id: c.id, password_hash: hashPassword('ClaveAna20301') });

const llamadas = [];
const meta = async (url, opts = {}) => {
  const u = new URL(url); const body = opts.body ? JSON.parse(opts.body) : null;
  llamadas.push({ ruta: u.pathname, query: Object.fromEntries(u.searchParams), body, auth: opts.headers?.Authorization });
  const json = (x, status = 200) => ({ ok: status < 300, status, json: async () => x });
  if (u.hostname === 'inhouse.kuper.media') return json({ ok: true, phone_id: body.phone_id });
  if (u.pathname.endsWith('/oauth/access_token') && u.searchParams.get('code') === 'codigo-jssdk') return u.searchParams.get('redirect_uri') === 'https://redes.kuper.media/admin/clientes/1/agente' ? json({ access_token: 'EAAG-token-negocio' }) : json({ error: { message: 'Error validating verification code. Please make sure your redirect_uri is identical to the one you used in the OAuth dialog request' } }, 400);
  if (u.pathname.endsWith('/oauth/access_token')) return u.searchParams.get('code') === 'codigo-bueno' ? json({ access_token: 'EAAG-token-negocio' }) : json({ error: { message: 'código inválido' } }, 400);
  if (u.pathname.endsWith('/subscribed_apps')) return json({ success: true });
  if (u.pathname.endsWith('/register') || u.pathname.endsWith('/smb_app_data')) return json({ success: true });
  if (u.pathname.endsWith('/debug_token')) return json({ data: { granular_scopes: [{ scope: 'whatsapp_business_management', target_ids: ['1632154828399441'] }, { scope: 'business_management' }] } });
  if (u.pathname.endsWith('/1632154828399441/phone_numbers')) return json({ data: [{ id: '1374873522382080', display_phone_number: '+52 1 55 1234 5678', verified_name: 'Inhouse Work' }] });
  if (u.pathname.endsWith('/1374873522382080')) return json({ display_phone_number: '+52 1 55 1234 5678', verified_name: 'Inhouse Work' });
  return json({ error: { message: 'ruta desconocida ' + u.pathname } }, 404);
};
W.hooks.fetch = meta; agente.hooks.fetch = meta;

test('número nuevo: token al agente, webhook del agente y registro con PIN', async () => {
  const r = await W.conectar(c, { code: 'codigo-bueno', waba_id: '1632154828399441', phone_number_id: '1374873522382080', evento: 'FINISH' });
  assert.equal(r.numero, '+52 1 55 1234 5678');
  assert.equal(r.coexistencia, false);
  const alAgente = llamadas.find((l) => l.ruta === '/panel/whatsapp');
  assert.equal(alAgente.auth, 'Bearer llave-ih');
  assert.equal(alAgente.body.token, 'EAAG-token-negocio');
  assert.equal(alAgente.body.app_secret, 'secreto-kuper');
  const sub = llamadas.find((l) => l.ruta.endsWith('/1632154828399441/subscribed_apps'));
  assert.equal(sub.body.override_callback_uri, 'https://inhouse.kuper.media/webhook');
  assert.equal(sub.body.verify_token, alAgente.body.verify_token);
  assert.ok(llamadas.findIndex((l) => l.ruta === '/panel/whatsapp') < llamadas.findIndex((l) => l.ruta.endsWith('/subscribed_apps')), 'el agente lo sabe antes de que Meta verifique');
  const reg = llamadas.find((l) => l.ruta.endsWith('/register'));
  assert.match(reg.body.pin, /^\d{6}$/);
  const w = db.clientCredentials(db.getClient(c.id)).whatsapp;
  assert.equal(w.token, 'EAAG-token-negocio');
  assert.equal(w.pin, reg.body.pin);
  assert.deepEqual(Object.keys(W.estado(db.getClient(c.id))).includes('token'), false);
});

test('coexistencia: no se registra, se sincronizan contactos', async () => {
  llamadas.length = 0;
  const r = await W.conectar(db.getClient(c.id), { code: 'codigo-bueno', waba_id: '1632154828399441', phone_number_id: '1374873522382080', evento: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' });
  assert.equal(r.coexistencia, true);
  assert.equal(llamadas.some((l) => l.ruta.endsWith('/register')), false);
  assert.equal(llamadas.find((l) => l.ruta.endsWith('/smb_app_data')).body.sync_type, 'smb_app_state_sync');
});

test('errores claros: código malo o sin agente', async () => {
  await assert.rejects(W.conectar(db.getClient(c.id), { code: 'malo', waba_id: '1', phone_number_id: '2' }), /código inválido/);
  await assert.rejects(W.conectar(db.getClient(c.id), { code: '', waba_id: '', phone_number_id: '' }), /no regresó la autorización/);
  const sin = db.createClient({ slug: 'sin', nombre: 'Sin agente', perfil, config: {}, credentials: {} });
  await assert.rejects(W.conectar(sin, { code: 'codigo-bueno', waba_id: '1', phone_number_id: '2' }), /URL del agente/);
});

test('la página del agente muestra el botón y deja abrir la ventana de Meta', async () => {
  const server = createApp().listen(0); const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const r = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'ana@inhouse.mx', password: 'ClaveAna20301' }) });
    const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
    const p = await fetch(`${base}/app/agente`, { headers: { cookie } });
    const html = await p.text();
    assert.match(html, /Conectado: \+52 1 55 1234 5678/);
    assert.match(html, /config_id: '999888777'/);
    assert.match(p.headers.get('content-security-policy'), /connect\.facebook\.net/);
    assert.equal(p.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups');
  } finally { server.close(); }
});

test('si la ventana de Meta no avisa la cuenta y el número, se le pregunta a Meta qué se compartió', async () => {
  const r = await W.conectar(db.getClient(c.id), { code: 'codigo-bueno', waba_id: '', phone_number_id: '', evento: 'coexistencia' });
  assert.equal(r.numero, '+52 1 55 1234 5678');
  const dbg = llamadas.find((x) => x.ruta.endsWith('/debug_token'));
  assert.equal(dbg.query.input_token, 'EAAG-token-negocio'); assert.equal(dbg.query.access_token, '1817877119391171|secreto-kuper');
  const w = db.clientCredentials(db.getClient(c.id)).whatsapp;
  assert.equal(w.waba_id, '1632154828399441'); assert.equal(w.phone_id, '1374873522382080'); assert.equal(w.coexistencia, true);
});

test('si Meta pide la misma dirección de regreso, se reintenta con la de la página del botón (solo del panel)', async () => {
  const r = await W.conectar(db.getClient(c.id), { code: 'codigo-jssdk', waba_id: '1632154828399441', phone_number_id: '1374873522382080', evento: 'FINISH', pagina: 'https://redes.kuper.media/admin/clientes/1/agente' });
  assert.equal(r.numero, '+52 1 55 1234 5678');
  await assert.rejects(W.conectar(db.getClient(c.id), { code: 'codigo-jssdk', waba_id: '1', phone_number_id: '2', pagina: 'https://otro-sitio.test/x' }), /redirect_uri/);
});

test('conectar sin el SDK: ventana de Meta con dirección fija, regreso con state de un solo uso', async () => {
  const W2 = await import('../src/whatsappSignup.js');
  const u = new URL(W2.urlAutorizacion({ redirect: 'https://redes.kuper.media/app/agente/whatsapp/regreso', state: 'abc', coexistencia: true }));
  assert.equal(u.hostname, 'www.facebook.com'); assert.match(u.pathname, /\/dialog\/oauth$/);
  assert.equal(u.searchParams.get('config_id'), '999888777'); assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(JSON.parse(u.searchParams.get('extras')).featureType, 'whatsapp_business_app_onboarding');
  // El canje usa exactamente la misma dirección de regreso.
  const r = await W2.conectar(db.getClient(c.id), { code: 'codigo-jssdk', evento: 'coexistencia', redirect: 'https://redes.kuper.media/admin/clientes/1/agente' });
  assert.equal(r.numero, '+52 1 55 1234 5678');
  const server = createApp().listen(0); const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'ana@inhouse.mx', password: 'ClaveAna20301' }) });
    const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
    const a = await fetch(`${base}/app/agente/whatsapp/abrir?coex=1`, { headers: { cookie }, redirect: 'manual' });
    assert.equal(a.status, 302);
    const meta = new URL(a.headers.get('location'));
    assert.equal(meta.hostname, 'www.facebook.com'); assert.match(meta.searchParams.get('redirect_uri'), /\/app\/agente\/whatsapp\/regreso$/);
    const state = meta.searchParams.get('state');
    const malo = await fetch(`${base}/app/agente/whatsapp/regreso?code=x&state=otro`, { headers: { cookie }, redirect: 'manual' });
    assert.match(await malo.text(), /caducó o no corresponde/);
    const cancel = await fetch(`${base}/app/agente/whatsapp/regreso?error=access_denied&error_description=Permissions+error&state=${state}`, { headers: { cookie }, redirect: 'manual' });
    assert.match(await cancel.text(), /Permissions error/);
    const otra = await fetch(`${base}/app/agente/whatsapp/regreso?code=codigo-bueno&state=${state}`, { headers: { cookie }, redirect: 'manual' });
    assert.match(await otra.text(), /caducó/, 'el state es de un solo uso');
  } finally { server.close(); }
});

test('agente viejo sin /whatsapp: se guarda solo en el panel y no se toca su webhook ni el número', async () => {
  const W3 = await import('../src/whatsappSignup.js');
  const viejo = db.createClient({ slug: 'kuper-viejo', nombre: 'Kuper', perfil, config: {}, credentials: { api_key: 'k', agente_url: 'https://viejo.kuper.test' } });
  const antes = agente.hooks.fetch;
  agente.hooks.fetch = async (url) => (String(url).startsWith('https://viejo.kuper.test') ? { ok: false, status: 404, json: async () => ({ error: 'no_encontrado', mensaje: 'Este contacto no ha escrito al agente.' }) } : meta(url));
  const n = llamadas.length;
  const r = await W3.conectar(db.getClient(viejo.id), { code: 'codigo-bueno', waba_id: '1632154828399441', phone_number_id: '1374873522382080', evento: 'coexistencia' });
  assert.match(r.avisos.join(' '), /no se cambió nada/);
  const nuevas = llamadas.slice(n).map((x) => x.ruta);
  assert.ok(!nuevas.some((x) => x.endsWith('/subscribed_apps') || x.endsWith('/register') || x.endsWith('/smb_app_data')), nuevas.join(','));
  const w = db.clientCredentials(db.getClient(viejo.id)).whatsapp;
  assert.equal(w.token, 'EAAG-token-negocio'); assert.equal(w.solo_panel, true);
  agente.hooks.fetch = antes;
});

test('Kuper: conectar el panel con token de usuario del sistema (valida número y cuenta; solo panel)', async () => {
  const W4 = await import('../src/whatsappSignup.js');
  const k = db.createClient({ slug: 'kuper-token', nombre: 'Kuper', perfil, config: {}, credentials: { api_key: 'k', agente_url: 'https://viejo.kuper.test' } });
  const antes = W4.hooks.fetch;
  W4.hooks.fetch = async (url, o) => { const u = new URL(url); if (u.pathname.endsWith('/1632154828399441/message_templates')) return { ok: true, status: 200, json: async () => ({ data: [] }) }; return meta(url, o); };
  await assert.rejects(W4.conectarConToken(db.getClient(k.id), { token: '', waba_id: '1', phone_number_id: '2' }), /Pega el token/);
  const r = await W4.conectarConToken(db.getClient(k.id), { token: ' EAAsys ', waba_id: '1632154828399441', phone_number_id: '1374873522382080' });
  assert.equal(r.numero, '+52 1 55 1234 5678');
  const w = db.clientCredentials(db.getClient(k.id)).whatsapp;
  assert.equal(w.token, 'EAAsys'); assert.equal(w.solo_panel, true); assert.equal(w.waba_id, '1632154828399441');
  W4.hooks.fetch = antes;
});
