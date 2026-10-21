// Usuarios del panel: administrador (Kuper) ve todo; cada cliente solo su marca.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'usuarios-')), SECRET_KEY: 'x', TIMEZONE: 'America/Mexico_City', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123' });
const db = await import('../src/db.js');
const { hashPassword } = await import('../src/crypto.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');
const perfil = { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] };
const kuper = db.createClient({ slug: 'kuper', nombre: 'Kuper Media', perfil, config: {}, credentials: {} });
const sabor = db.createClient({ slug: 'buen-sabor', nombre: 'Buen Sabor', perfil, config: {}, credentials: {} });
const postSabor = db.createPost({ client_id: sabor.id, plataforma: 'instagram', status: 'pendiente' });
const postKuper = db.createPost({ client_id: kuper.id, plataforma: 'instagram', status: 'pendiente' });
db.addLeadMessage(kuper.id, { telefono: '+525511112222', nombre: 'Lead de Kuper', origen: 'whatsapp' }, { rol: 'lead', texto: 'secreto de Kuper' });
const leadKuper = db.listLeads(kuper.id)[0];

const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

async function login(email, password) {
  const r = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, password }) });
  const c = (r.headers.get('set-cookie') || '').split(';')[0];
  return { status: r.status, to: r.headers.get('location'), cookie: c };
}
const get = (u, cookie) => fetch(`${base}${u}`, { headers: { cookie }, redirect: 'manual' });
const post = (u, cookie, body) => fetch(`${base}${u}`, { method: 'POST', headers: { cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body), redirect: 'manual' });

let admin, clave;
test('el administrador entra con la contraseña maestra y crea un usuario para Buen Sabor', async () => {
  admin = await login('', 'maestra-123');
  assert.equal(admin.to, '/admin');
  const r = await post('/admin/usuarios', admin.cookie, { nombre: 'Laura', email: 'Laura@BuenSabor.mx', rol: 'cliente', client_id: String(sabor.id) });
  const h = await r.text();
  assert.equal(r.status, 200);
  clave = h.match(/color:#c9f53a">([A-Za-z0-9-]+)</)[1];
  assert.ok(clave.length >= 12, 'muestra la contraseña temporal una vez');
  assert.ok(db.getUserByEmail('laura@buensabor.mx'), 'correo sin mayúsculas');
  assert.equal((await post('/admin/usuarios', admin.cookie, { nombre: 'Otra', email: 'laura@buensabor.mx', rol: 'cliente', client_id: String(sabor.id) })).status, 400, 'no repite correos');
});

test('el cliente solo ve y toca su marca', async () => {
  const s = await login('laura@buensabor.mx', clave);
  assert.equal(s.to, '/app');
  const home = await (await get('/app', s.cookie)).text();
  assert.match(home, /Buen Sabor/);
  assert.ok(!home.includes('Kuper Media</div>'), 'no ve el nombre de otra marca arriba');
  assert.equal((await get('/admin', s.cookie)).headers.get('location'), '/app', 'no entra al panel de administrador');
  assert.equal((await get('/admin/usuarios', s.cookie)).status, 302);
  assert.equal((await get('/app?c=' + kuper.id, s.cookie)).status, 200);
  assert.ok(!(await (await get('/app/leads?c=' + kuper.id, s.cookie)).text()).includes('Lead de Kuper'), 'cambiar ?c= no le enseña otra marca');
  assert.equal((await get(`/app/leads/${leadKuper.id}/chat`, s.cookie)).status, 404, 'no lee chats de otra marca');
  assert.equal((await post(`/app/posts/${postKuper.id}/rechazar`, s.cookie, { motivo: 'x' })).status, 404, 'no toca posts de otra marca');
  assert.equal(db.getPost(postKuper.id).status, 'pendiente');
  assert.equal((await post(`/app/posts/${postSabor.id}/cambios`, s.cookie, { comentarios: 'más color' })).status, 302, 'sí puede pedir cambios en lo suyo');
  assert.match(await (await get('/app/posts', s.cookie)).text(), /Publicaciones|Por revisar/);
  assert.equal((await get('/app/pulso.json', s.cookie)).status, 200);
});

test('el administrador puede ver como el cliente', async () => {
  const r = await get('/app?c=' + sabor.id, admin.cookie);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Buen Sabor/);
});

test('cambiar contraseña cierra sesiones viejas; bloquear y contraseña incorrecta', async () => {
  const s = await login('laura@buensabor.mx', clave);
  const r = await post('/app/cuenta', s.cookie, { actual: clave, nueva: 'NuevaClave2030', nueva2: 'NuevaClave2030' });
  assert.match(await r.text(), /tu contraseña cambió/);
  assert.equal((await get('/app', s.cookie)).headers.get('location'), '/entrar', 'la sesión con la contraseña vieja ya no sirve');
  assert.equal((await login('laura@buensabor.mx', clave)).status, 401);
  const ok = await login('laura@buensabor.mx', 'NuevaClave2030');
  assert.equal(ok.to, '/app');
  const u = db.getUserByEmail('laura@buensabor.mx');
  await post(`/admin/usuarios/${u.id}/activo`, admin.cookie, {});
  assert.equal((await login('laura@buensabor.mx', 'NuevaClave2030')).status, 401, 'bloqueado no entra');
  assert.equal((await get('/app', ok.cookie)).headers.get('location'), '/entrar', 'y su sesión abierta se corta');
});

test('"Mi cuenta" para administradores (y aviso si entró con la contraseña maestra)', async () => {
  const m = await login('', 'maestra-123');
  const menu = await (await get('/admin', m.cookie)).text();
  assert.match(menu, /href="\/app\/cuenta"/);
  assert.match(await (await get('/app/cuenta', m.cookie)).text(), /Contraseña maestra/);
  db.createUser({ email: 'jefe@kuper.media', nombre: 'Jefe', rol: 'admin', password_hash: hashPassword('ClaveJefe20301') });
  const a = await login('jefe@kuper.media', 'ClaveJefe20301');
  assert.match(await (await get('/app/cuenta', a.cookie)).text(), /Activar verificación en dos pasos/);
});

test('administrador con usuario propio y freno a intentos', async () => {
  db.createUser({ email: 'equipo@kuper.media', nombre: 'Equipo', rol: 'admin', password_hash: hashPassword('ClaveEquipo2030') });
  const a = await login('equipo@kuper.media', 'ClaveEquipo2030');
  assert.equal(a.to, '/admin');
  assert.equal((await get('/admin/usuarios', a.cookie)).status, 200);
  let last;
  for (let i = 0; i < 9; i++) last = await login('equipo@kuper.media', 'mal');
  assert.equal(last.status, 429);
});
