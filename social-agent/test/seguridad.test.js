// Seguridad del panel: cabeceras, envíos desde otros sitios, verificación en dos pasos, bitácora y límites.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'seg-')), SECRET_KEY: 'x', TIMEZONE: 'America/Mexico_City', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123' });
const db = await import('../src/db.js');
const seg = await import('../src/seguridad.js');
const { hashPassword } = await import('../src/crypto.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');
const c = db.createClient({ slug: 'sabor', nombre: 'Buen Sabor', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, config: {}, credentials: {} });
db.createUser({ email: 'ana@sabor.mx', nombre: 'Ana', rol: 'cliente', client_id: c.id, password_hash: hashPassword('ClaveAna2030!') });

const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());
const form = (u, body, headers = {}) => fetch(`${base}${u}`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(body) });
const ck = (r) => (r.headers.getSetCookie?.() || [r.headers.get('set-cookie')]).map((x) => String(x).split(';')[0]).filter((x) => !x.endsWith('=')).join('; ');

test('cabeceras de seguridad', async () => {
  const r = await fetch(`${base}/entrar`);
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(r.headers.get('x-powered-by'), null);
});

test('rechaza formularios enviados desde otro sitio', async () => {
  const r = await form('/entrar', { email: '', password: 'maestra-123' }, { Origin: 'https://sitio-malo.com' });
  assert.equal(r.status, 403);
  assert.equal((await form('/entrar', { email: '', password: 'maestra-123' }, { Origin: base })).status, 302, 'desde el propio panel sí');
  assert.ok(seg.bitacora().some((b) => b.accion === 'origen_rechazado'));
});

test('verificación en dos pasos: activar, entrar con código y quitarla', async () => {
  let s = ck(await form('/entrar', { email: 'ana@sabor.mx', password: 'ClaveAna2030!' }));
  const ini = await (await fetch(`${base}/app/cuenta/2fa/iniciar`, { method: 'POST', headers: { cookie: s } })).text();
  const secreto = ini.match(/user-select:all[^>]*>([A-Z2-7 ]+)</)[1].replace(/ /g, '');
  const token = ini.match(/name="token" value="([^"]+)"/)[1].replace(/&quot;/g, '"');
  assert.equal((await fetch(`${base}/app/cuenta/2fa/activar`, { method: 'POST', headers: { cookie: s, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token, codigo: '000000' }) })).status, 400);
  const ok = await (await fetch(`${base}/app/cuenta/2fa/activar`, { method: 'POST', headers: { cookie: s, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token, codigo: seg.codigoTotp(secreto) }) })).text();
  assert.match(ok, /te pediremos un código/);
  // al entrar pide código
  const r1 = await form('/entrar', { email: 'ana@sabor.mx', password: 'ClaveAna2030!' });
  assert.equal(r1.status, 200);
  assert.match(await r1.text(), /Escribe tu código/);
  const c2fa = ck(r1);
  assert.ok(!c2fa.includes('sa_admin='), 'todavía no hay sesión');
  assert.equal((await form('/entrar/codigo', { codigo: '111111' }, { cookie: c2fa })).status, 401);
  const r2 = await form('/entrar/codigo', { codigo: seg.codigoTotp(secreto) }, { cookie: c2fa });
  assert.equal(r2.headers.get('location'), '/app');
  assert.equal((await form('/entrar/codigo', { codigo: seg.codigoTotp(secreto) })).status, 401, 'sin el primer paso no sirve el código');
  // el admin se la quita (perdió el teléfono)
  const admin = ck(await form('/entrar', { email: '', password: 'maestra-123' }));
  const u = db.getUserByEmail('ana@sabor.mx');
  await form(`/admin/usuarios/${u.id}/quitar-2fa`, {}, { cookie: admin });
  assert.equal((await form('/entrar', { email: 'ana@sabor.mx', password: 'ClaveAna2030!' })).headers.get('location'), '/app');
  const usuarios = await (await fetch(`${base}/admin/usuarios`, { headers: { cookie: admin } })).text();
  assert.match(usuarios, /Actividad de seguridad/);
  assert.match(usuarios, /Activó 2 pasos/);
  assert.match(usuarios, /Código incorrecto/);
});

test('códigos TOTP y límite de peticiones', () => {
  const s = seg.nuevoSecreto();
  assert.match(s, /^[A-Z2-7]{32}$/);
  assert.equal(seg.codigoTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000), '287082', 'vector de prueba del RFC 6238');
  assert.ok(seg.verificarTotp(s, seg.codigoTotp(s, Date.now() - 30_000)), 'acepta el código anterior (reloj desfasado)');
  assert.ok(!seg.verificarTotp(s, seg.codigoTotp(s, Date.now() - 120_000)));
  const lim = seg.limite({ max: 2, clave: () => 'x' });
  const res = { setHeader() {}, status(n) { this.code = n; return this; }, json() { return this; } };
  let pasa = 0; for (let i = 0; i < 3; i++) lim({}, res, () => pasa++);
  assert.equal(pasa, 2);
  assert.equal(res.code, 429);
});
