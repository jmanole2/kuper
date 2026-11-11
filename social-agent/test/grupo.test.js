// Acceso de grupo: un usuario ve varias marcas con un solo login y no puede entrar a las que no le tocan.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'grupo-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123' });
const db = await import('../src/db.js');
const { hashPassword } = await import('../src/crypto.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');
const perfil = { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] };
const banquetes = db.createClient({ slug: 'ambrosia', nombre: 'Ambrosía Banquetes', perfil, config: {}, credentials: {} });
const escuela = db.createClient({ slug: 'acc', nombre: 'Ambrosía Centro Culinario', perfil, config: {}, credentials: {} });
const ajeno = db.createClient({ slug: 'otro', nombre: 'Otra Marca', perfil, config: {}, credentials: {} });
const u = db.createUser({ email: 'dir@ambrosia.mx', nombre: 'Dirección', rol: 'cliente', client_id: banquetes.id, password_hash: hashPassword('ClaveGrupo2030') });
const solo = db.createUser({ email: 'solo@acc.mx', nombre: 'Solo', rol: 'cliente', client_id: escuela.id, password_hash: hashPassword('ClaveSolo20301') });

const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());
async function login(email, password) {
  const r = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, password }) });
  return (r.headers.get('set-cookie') || '').split(';')[0];
}
const get = (u, cookie) => fetch(`${base}${u}`, { headers: { cookie }, redirect: 'manual' });

test('las marcas extra se guardan sin repetir la propia ni ids inválidos', () => {
  assert.deepEqual(db.setMarcasExtra(u.id, [String(escuela.id), banquetes.id, 'x', escuela.id]), [escuela.id]);
  assert.deepEqual(db.marcasDeUsuario(u).map((m) => m.nombre), ['Ambrosía Banquetes', 'Ambrosía Centro Culinario']);
});

test('un login, varias marcas: cambia de marca y recuerda la elegida', async () => {
  const ck = await login('dir@ambrosia.mx', 'ClaveGrupo2030');
  let html = await (await get('/app', ck)).text();
  assert.match(html, /Ambrosía Banquetes/);
  assert.match(html, /cambiar de marca/);
  const marcas = await (await get('/app/marcas', ck)).text();
  assert.match(marcas, /Ambrosía Centro Culinario/);
  const r = await get(`/app?marca=${escuela.id}`, ck);
  const ck2 = `${ck}; ${(r.headers.get('set-cookie') || '').split(';')[0]}`;
  assert.match(await r.text(), /Ambrosía Centro Culinario/);
  html = await (await get('/app', ck2)).text(); // sin ?marca, se queda en la elegida
  assert.match(html, /Ambrosía Centro Culinario · Panel/);
});

test('no puede entrar a una marca que no es de su grupo', async () => {
  const ck = await login('dir@ambrosia.mx', 'ClaveGrupo2030');
  const html = await (await get(`/app?marca=${ajeno.id}`, `${ck}; sa_marca=${ajeno.id}`)).text();
  assert.doesNotMatch(html, /Otra Marca/);
  assert.match(html, /Ambrosía Banquetes/);
});

test('quien tiene una sola marca no ve el selector', async () => {
  const ck = await login('solo@acc.mx', 'ClaveSolo20301');
  const html = await (await get(`/app?marca=${banquetes.id}`, ck)).text();
  assert.doesNotMatch(html, /cambiar de marca/);
  assert.doesNotMatch(html, /Ambrosía Banquetes/);
});

test('Kuper asigna las marcas del grupo desde Usuarios', async () => {
  const admin = await login('', 'maestra-123');
  const r = await fetch(`${base}/admin/usuarios/${solo.id}/marcas`, { method: 'POST', redirect: 'manual', headers: { cookie: admin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: `marcas=${banquetes.id}&marcas=${ajeno.id}` });
  assert.equal(r.status, 302);
  assert.deepEqual(db.marcasExtra(solo.id).sort(), [banquetes.id, ajeno.id].sort());
  const html = await (await get('/admin/usuarios', admin)).text();
  assert.match(html, /\+2 marcas del grupo/);
  db.setMarcasExtra(solo.id, []);
});
