import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'cup-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123' });
const db = await import('../src/db.js');
const cup = await import('../src/cupones.js');
const { hashPassword } = await import('../src/crypto.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');

const promociones = cup.limpiarPromociones([
  { id: 'primera', nombre: 'Primera compra', beneficio: '10 % en la Hamburguesa Clásica', cuando: 'si es su primera vez', vigencia_horas: 72, max_dia: 2 },
  { id: 'papas', nombre: 'Papas gratis', beneficio: 'Papas gratis con tu combo', vigencia_horas: 24, activa: false },
]);
const c = db.createClient({ slug: 'chub', nombre: 'Chubbies', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] },
  config: { plan: { servicios: { chat: true } }, cupones: { activo: true, prefijo: 'CHUB', promociones } }, credentials: { api_key: 'llave-chub' } });
db.createUser({ email: 'caja@chub.mx', nombre: 'Caja Polanco', rol: 'cliente', client_id: c.id, password_hash: hashPassword('ClaveCaja2030') });
const cl = () => db.getClient(c.id);
const t0 = new Date('2026-11-12T18:00:00Z');

test('genera un código único con vigencia y no repite mientras esté vigente', () => {
  const a = cup.generar(cl(), { promocion: 'primera', telefono: '5512345678', nombre: 'Ana' }, t0);
  assert.match(a.codigo, /^CHUB-[A-HJ-NP-Z2-9]{5}$/);
  assert.match(a.texto, /10 % en la Hamburguesa Clásica/);
  const otra = cup.generar(cl(), { promocion: 'primera', telefono: '55 1234 5678' }, t0);
  assert.equal(otra.codigo, a.codigo);
  assert.equal(otra.repetido, true);
  assert.throws(() => cup.generar(cl(), { promocion: 'papas', telefono: '5512345678' }, t0), /pausada/);
  assert.throws(() => cup.generar(cl(), { promocion: 'inventada', telefono: '5512345678' }, t0), /no existe/);
});

test('respeta el máximo al día', () => {
  cup.generar(cl(), { promocion: 'primera', usuario: 'luis_ig', canal: 'instagram' }, t0);
  assert.throws(() => cup.generar(cl(), { promocion: 'primera', telefono: '5599998888' }, t0), /por hoy/);
});

test('se canjea una sola vez y no después de vencer', () => {
  const [a, b] = cup.listar(c.id).reverse();
  assert.equal(cup.consultar(cl(), a.codigo.toLowerCase(), t0).estado, 'valido');
  cup.canjear(cl(), a.codigo, { autor: 'Caja', sucursal: 'Polanco' }, t0);
  assert.throws(() => cup.canjear(cl(), a.codigo, {}, t0), /ya se canjeó.*Polanco/);
  assert.throws(() => cup.canjear(cl(), b.codigo, {}, new Date('2026-11-20T00:00:00Z')), /venció/);
  assert.throws(() => cup.canjear(cl(), 'CHUB-XXXXX', {}, t0), /no existe/);
  assert.equal(cup.resumen(c.id).canjeados, 1);
});

test('el agente lo pide por la API y el cajero lo canjea en el panel', async () => {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const conoc = await (await fetch(`${base}/api/chub/conocimiento`, { headers: { Authorization: 'Bearer llave-chub' } })).json();
    assert.match(conoc.texto, /id "primera": 10 % en la Hamburguesa Clásica/);
    assert.doesNotMatch(conoc.texto, /papas/i);
    db.getDb().exec('DELETE FROM cupones');
    const r = await (await fetch(`${base}/api/chub/cupones`, { method: 'POST', headers: { Authorization: 'Bearer llave-chub', 'Content-Type': 'application/json' }, body: JSON.stringify({ promocion: 'primera', telefono: '+525511112222' }) })).json();
    assert.ok(r.ok && r.codigo, JSON.stringify(r));
    const login = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: base }, body: new URLSearchParams({ email: 'caja@chub.mx', password: 'ClaveCaja2030' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const h = await (await fetch(`${base}/app/cupones?codigo=${r.codigo}`, { headers: { Cookie: cookie } })).text();
    assert.match(h, /Canjear ahora/);
    const k = await (await fetch(`${base}/app/cupones/canjear`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded', Origin: base }, body: new URLSearchParams({ codigo: r.codigo, sucursal: 'Roma' }) })).text();
    assert.match(k, /Canjeado ahora/);
    assert.equal(cup.consultar(cl(), r.codigo).cupon.canjeado_por, 'Caja Polanco');
  } finally { server.close(); }
});
