// "Conectar WhatsApp" (Embedded Signup): código -> token, se lo pasa al agente, suscribe con el webhook del agente y registra el número.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'wasignup-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123',
  META_APP_ID: '1817877119391171', META_CONFIG_ID: '999888777', META_APP_SECRET: 'secreto-kuper' });
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
  if (u.pathname.endsWith('/oauth/access_token')) return u.searchParams.get('code') === 'codigo-bueno' ? json({ access_token: 'EAAG-token-negocio' }) : json({ error: { message: 'código inválido' } }, 400);
  if (u.pathname.endsWith('/subscribed_apps')) return json({ success: true });
  if (u.pathname.endsWith('/register') || u.pathname.endsWith('/smb_app_data')) return json({ success: true });
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
  await assert.rejects(W.conectar(db.getClient(c.id), { code: 'x', waba_id: '', phone_number_id: '' }), /no regresó el número/);
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
