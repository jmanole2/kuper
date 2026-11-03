// Archivos para compartir: se suben en "Lo que sabe tu agente" y el agente los recibe con URL pública.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'archivos-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', PUBLIC_BASE_URL: 'https://redes.kuper.media' });
const db = await import('../src/db.js');
const { hashPassword } = await import('../src/crypto.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');
const c = db.createClient({ slug: 'redone', nombre: 'Red One', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, config: { plan: { servicios: { chat: true } } }, credentials: { api_key: 'llave-ro' } });
db.createUser({ email: 'fer@redone.agency', nombre: 'Fernanda', rol: 'cliente', client_id: c.id, password_hash: hashPassword('ClaveFernanda2030') });
const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());
const login = async () => (await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'fer@redone.agency', password: 'ClaveFernanda2030' }) })).headers.get('set-cookie').split(';')[0];
const api = () => fetch(`${base}/api/redone/conocimiento`, { headers: { Authorization: 'Bearer llave-ro' } }).then((r) => r.json());

test('subir un PDF y que el agente lo reciba con su URL y cuándo mandarlo', async () => {
  const ck = await login();
  const fd = new FormData();
  fd.append('nombre', 'Brochure Red One'); fd.append('cuando', 'cuando pidan brochure o presentación');
  fd.append('archivo', new Blob([Buffer.from('%PDF-1.4 prueba')], { type: 'application/pdf' }), 'brochure.pdf');
  const r = await fetch(`${base}/app/agente/archivos`, { method: 'POST', headers: { cookie: ck }, body: fd, redirect: 'manual' });
  assert.equal(r.status, 302);
  const k = await api();
  assert.equal(k.archivos.length, 1);
  assert.equal(k.archivos[0].nombre, 'Brochure Red One');
  assert.equal(k.archivos[0].tipo, 'document');
  assert.match(k.archivos[0].url, /^https:\/\/redes\.kuper\.media\/media\/archivo-\d+-[\w-]+\.pdf$/);
  assert.equal(k.archivos[0].nombre_archivo, 'Brochure Red One.pdf');
  assert.match(await (await fetch(`${base}/app/agente`, { headers: { cookie: ck } })).text(), /Brochure Red One/);
  // Quitarlo
  const id = db.getClient(c.id).config.archivos_agente[0].id;
  await fetch(`${base}/app/agente/archivos/${id}/borrar`, { method: 'POST', headers: { cookie: ck }, redirect: 'manual' });
  assert.equal((await api()).archivos.length, 0);
});

test('no acepta otros tipos de archivo', async () => {
  const ck = await login();
  const fd = new FormData();
  fd.append('nombre', 'x'); fd.append('cuando', 'y');
  fd.append('archivo', new Blob(['MZ...'], { type: 'application/x-msdownload' }), 'virus.exe');
  const r = await fetch(`${base}/app/agente/archivos`, { method: 'POST', headers: { cookie: ck }, body: fd, redirect: 'manual' });
  assert.equal(r.status, 400);
  assert.equal((await api()).archivos.length, 0);
});
