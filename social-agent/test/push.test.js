import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'push-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123' });
const db = await import('../src/db.js');
const push = await import('../src/push.js');
const { hashPassword } = await import('../src/crypto.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');
const c = db.createClient({ slug: 'p', nombre: 'P', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, config: { plan: { servicios: { chat: true } } }, credentials: { api_key: 'llave-p' } });
const ana = db.createUser({ email: 'ana@p.mx', nombre: 'Ana', rol: 'cliente', client_id: c.id, password_hash: hashPassword('ClaveAna2030') });
const beto = db.createUser({ email: 'beto@p.mx', nombre: 'Beto', rol: 'cliente', client_id: c.id, password_hash: hashPassword('x') });
const enviadas = [];
push.hooks.enviar = async (sub, carga) => { enviadas.push({ ep: sub.endpoint, ...JSON.parse(carga) }); if (sub.endpoint.includes('muerto')) { const e = new Error('gone'); e.statusCode = 410; throw e; } };
const sub = (n) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, keys: { p256dh: 'BKey', auth: 'auth' } });

test('la app instalable: manifiesto, íconos y service worker', async () => {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const m = await (await fetch(`${base}/manifest.webmanifest`)).json();
    assert.equal(m.start_url, '/app'); assert.equal(m.display, 'standalone');
    assert.equal((await fetch(`${base}/app-icono-512.png`)).status, 200);
    assert.match(await (await fetch(`${base}/sw.js`)).text(), /showNotification/);
    assert.match(await (await fetch(`${base}/entrar`)).text(), /rel="manifest"/);
    // suscribirse desde Mi cuenta
    const login = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: base }, body: new URLSearchParams({ email: 'ana@p.mx', password: 'ClaveAna2030' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.match((await (await fetch(`${base}/app/push/llave`, { headers: { Cookie: cookie } })).json()).llave, /^[\w-]{80,}$/);
    const r = await fetch(`${base}/app/push/suscribir`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(sub('ana1')) });
    assert.equal(r.status, 200);
    assert.equal(push.cuantas(ana.id), 1);
    assert.match(await (await fetch(`${base}/app/cuenta`, { headers: { Cookie: cookie } })).text(), /Activar avisos/);
    // un lead nuevo por la API avisa a la marca
    await fetch(`${base}/api/p/leads`, { method: 'POST', headers: { Authorization: 'Bearer llave-p', 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: 'Laura', telefono: '5512345678', nota: 'quiere precio' }) });
    await new Promise((ok) => setTimeout(ok, 30));
    assert.ok(enviadas.some((x) => x.titulo === 'Nuevo lead: Laura' && /\/app\/leads\/\d+\/chat/.test(x.url)));
  } finally { server.close(); }
});

test('con asesor solo a él; sin asesor a todo el equipo; quita dispositivos que ya no existen', async () => {
  push.suscribir(beto, c.id, sub('beto1'));
  push.suscribir(beto, c.id, sub('muerto'));
  enviadas.length = 0;
  await push.avisar(db.getClient(c.id), { titulo: 'x', lead: { id: 9, asignado_id: ana.id } });
  assert.deepEqual(enviadas.map((x) => x.ep.split('/').pop()), ['ana1']);
  enviadas.length = 0;
  await push.avisar(db.getClient(c.id), { titulo: 'y' });
  assert.equal(enviadas.length, 3);
  assert.equal(push.cuantas(beto.id), 1); // el muerto se borró
  assert.throws(() => push.suscribir(ana, c.id, { endpoint: 'http://inseguro', keys: {} }), /no válida/);
});
