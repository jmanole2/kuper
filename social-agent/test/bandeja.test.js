// Bandeja: responder a mano desde el panel y tomar/devolver el control al agente.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'bandeja-')), SECRET_KEY: 'x', TIMEZONE: 'America/Mexico_City', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123' });
const db = await import('../src/db.js');
const agente = await import('../src/agente.js');
const { hashPassword } = await import('../src/crypto.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');
const perfil = { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] };
const c = db.createClient({ slug: 'sabor', nombre: 'Buen Sabor', perfil, config: { plan: { servicios: { chat: true } } }, credentials: { api_key: 'llave-123', agente_url: 'https://agente.sabor.test' } });
const otro = db.createClient({ slug: 'otro', nombre: 'Otro', perfil, config: { plan: { servicios: { chat: true } } }, credentials: {} });
db.addLeadMessage(c.id, { telefono: '+5215511112222', nombre: 'Luis', origen: 'whatsapp' }, { rol: 'lead', texto: 'Hola, ¿hay vacantes?' });
db.addLeadMessage(otro.id, { telefono: '+5215599990000', nombre: 'Ajeno', origen: 'whatsapp' }, { rol: 'lead', texto: 'secreto' });
const lead = db.listLeads(c.id)[0], ajeno = db.listLeads(otro.id)[0];
db.createUser({ email: 'rh@sabor.mx', nombre: 'Rocío RH', rol: 'cliente', client_id: c.id, password_hash: hashPassword('ClaveRocio2030') });

const llamadas = [];
let ventana = true;
agente.hooks.fetch = async (url, opt) => {
  const body = JSON.parse(opt.body || '{}');
  llamadas.push({ url, body, auth: opt.headers.Authorization });
  const j = (s, x) => ({ ok: s < 300, status: s, json: async () => x });
  if (url.endsWith('/panel/estado')) return j(200, { humano: false, ventana_abierta: ventana });
  if (url.endsWith('/panel/enviar')) return ventana ? j(200, { ok: true }) : j(409, { error: 'ventana_cerrada' });
  if (url.endsWith('/panel/control')) return j(200, { ok: true, humano: body.humano });
  return j(404, {});
};

const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());
async function login(email, password) {
  const r = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, password }) });
  return (r.headers.get('set-cookie') || '').split(';')[0];
}
const get = (u, cookie) => fetch(`${base}${u}`, { headers: { cookie }, redirect: 'manual' });
const post = (u, cookie, body) => fetch(`${base}${u}`, { method: 'POST', headers: { cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body), redirect: 'manual' });

test('el cliente responde desde su panel y el agente se pausa', async () => {
  const ck = await login('rh@sabor.mx', 'ClaveRocio2030');
  const h = await (await get(`/app/leads/${lead.id}/chat`, ck)).text();
  assert.match(h, /Enviar por WhatsApp/);
  assert.match(h, /Tomar control/);
  const r = await post(`/app/leads/${lead.id}/responder`, ck, { texto: 'Hola Luis, sí hay vacante de mesero 🙂' });
  assert.equal(r.status, 302);
  const env = llamadas.find((l) => l.url === 'https://agente.sabor.test/panel/enviar');
  assert.deepEqual(env.body, { telefono: '+525511112222', texto: 'Hola Luis, sí hay vacante de mesero 🙂', autor: 'Rocío RH' });
  assert.equal(env.auth, 'Bearer llave-123', 'usa la llave del cliente');
  assert.equal(db.getLead(c.id, lead.id).control, 'humano');
  assert.match(await (await get('/app/leads', ck)).text(), /Atiende una persona/);
});

test('ventana de 24 h cerrada: avisa y no pierde lo escrito', async () => {
  ventana = false;
  const ck = await login('rh@sabor.mx', 'ClaveRocio2030');
  const r = await post(`/app/leads/${lead.id}/responder`, ck, { texto: '¿Sigues interesado?' });
  const h = await r.text();
  assert.equal(r.status, 400);
  assert.match(h, /24 h/);
  assert.match(h, /¿Sigues interesado\?<\/textarea>/);
  ventana = true;
});

test('devolver al agente y permisos', async () => {
  const admin = await login('', 'maestra-123');
  assert.equal((await post(`/admin/clientes/${c.id}/leads/${lead.id}/control`, admin, { humano: '0' })).status, 302);
  assert.deepEqual(llamadas.at(-1).body, { telefono: '+525511112222', humano: false });
  assert.equal(db.getLead(c.id, lead.id).control, 'bot');
  const ck = await login('rh@sabor.mx', 'ClaveRocio2030');
  assert.equal((await post(`/app/leads/${ajeno.id}/responder`, ck, { texto: 'x' })).status, 404, 'no responde chats de otra marca');
  const j = await (await get(`/app/leads/${lead.id}/chat.json`, ck)).json();
  assert.match(j.html, /hay vacantes/);
  // sin URL del agente no aparece la caja de respuesta
  db.addLeadMessage(otro.id, { telefono: '+5215599990000' }, { rol: 'agente', texto: 'hola' });
  assert.match(await (await get(`/admin/clientes/${otro.id}/leads/${ajeno.id}/chat`, admin)).text(), /Kuper tiene que conectar/);
  // la URL del agente debe ser https
  assert.equal((await post(`/admin/clientes/${otro.id}/agente-url`, admin, { agente_url: 'http://inseguro.test' })).status, 400);
  assert.equal((await post(`/admin/clientes/${otro.id}/agente-url`, admin, { agente_url: 'https://agente.otro.test/' })).status, 302);
  assert.equal(db.clientCredentials(db.getClient(otro.id)).agente_url, 'https://agente.otro.test');
});

test('el agente reporta la respuesta del equipo con su autor', async () => {
  const r = await fetch(`${base}/api/sabor/mensajes`, { method: 'POST', headers: { Authorization: 'Bearer llave-123', 'Content-Type': 'application/json' }, body: JSON.stringify({ telefono: '+5215511112222', rol: 'humano', texto: 'Te esperamos', autor: 'Rocío RH' }) });
  assert.equal(r.status, 200);
  const m = db.leadMessages(lead.id).at(-1);
  assert.equal(m.rol, 'humano');
  assert.equal(m.autor, 'Rocío RH');
});
