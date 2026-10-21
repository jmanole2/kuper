// Lo que sabe el agente: editor con versiones y API para los agentes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'conoc-')), SECRET_KEY: 'x', TIMEZONE: 'America/Mexico_City', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123' });
const db = await import('../src/db.js');
const { hashPassword } = await import('../src/crypto.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');
const perfil = { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] };
const c = db.createClient({ slug: 'sabor', nombre: 'Buen Sabor', perfil, config: { plan: { servicios: { chat: true } } }, credentials: { api_key: 'llave-123' } });
const sinChat = db.createClient({ slug: 'solo-redes', nombre: 'Solo Redes', perfil, config: { plan: { servicios: { redes: true, chat: false } } }, credentials: {} });
db.createUser({ email: 'rh@sabor.mx', nombre: 'Rocío', rol: 'cliente', client_id: c.id, password_hash: hashPassword('ClaveRocio2030') });
db.createUser({ email: 'r@redes.mx', nombre: 'R', rol: 'cliente', client_id: sinChat.id, password_hash: hashPassword('ClaveRedes2030') });

const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());
async function login(email, password) {
  const r = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, password }) });
  return (r.headers.get('set-cookie') || '').split(';')[0];
}
const get = (u, cookie) => fetch(`${base}${u}`, { headers: { cookie }, redirect: 'manual' });
const post = (u, cookie, body) => fetch(`${base}${u}`, { method: 'POST', headers: { cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body), redirect: 'manual' });
const api = () => fetch(`${base}/api/sabor/conocimiento`, { headers: { Authorization: 'Bearer llave-123' } }).then((r) => r.json());

test('el cliente edita lo que sabe su agente y el agente lo lee', async () => {
  const ck = await login('rh@sabor.mx', 'ClaveRocio2030');
  assert.match(await (await get('/app/agente', ck)).text(), /Quiénes somos/, 'arranca con una plantilla');
  assert.equal((await api()).version, 0);
  const r = await post('/app/agente', ck, { texto: '# Buen Sabor\n- Pagamos cada 15 días.\n- Uniforme incluido.', dato_direccion: 'Av. Insurgentes Sur 123, CDMX', dato_que_llevar: 'INE y CV' });
  assert.equal(r.headers.get('location'), '/app/agente?ok=1');
  const k = await api();
  assert.match(k.texto, /Pagamos cada 15 días/);
  assert.deepEqual(k.datos, { direccion: 'Av. Insurgentes Sur 123, CDMX', que_llevar: 'INE y CV' });
  assert.ok(k.version > 0);
  assert.equal((await fetch(`${base}/api/sabor/conocimiento`, { headers: { Authorization: 'Bearer mala' } })).status, 401);
});

test('versiones y restaurar; límites', async () => {
  const ck = await login('rh@sabor.mx', 'ClaveRocio2030');
  const v1 = (await api()).version;
  await post('/app/agente', ck, { texto: 'Versión equivocada' });
  assert.equal((await api()).texto, 'Versión equivocada');
  const admin = await login('', 'maestra-123');
  assert.equal((await post(`/admin/clientes/${c.id}/agente/restaurar/${v1}`, admin, {})).status, 302);
  assert.match((await api()).texto, /Pagamos cada 15 días/, 'regresa a la versión anterior');
  const largo = await post('/app/agente', ck, { texto: 'x'.repeat(20001) });
  assert.equal(largo.status, 400);
  assert.match(await largo.text(), /muy largo/);
  const html = await (await post('/app/agente', ck, { texto: '' })).text();
  assert.match(html, /Escribe al menos algo/);
});

test('solo quien tiene agente de chat ve esta sección', async () => {
  const ck = await login('r@redes.mx', 'ClaveRedes2030');
  assert.equal((await get('/app/agente', ck)).headers.get('location'), '/app');
  assert.doesNotMatch(await (await get('/app', ck)).text(), /Lo que sabe tu agente/);
});
