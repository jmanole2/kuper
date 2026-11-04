// Páginas públicas (revisión de TikTok) y conexión de TikTok desde la cuenta del cliente.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'publico-')), SECRET_KEY: 'x', TIMEZONE: 'America/Mexico_City', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123', TIKTOK_CLIENT_KEY: 'ck', TIKTOK_CLIENT_SECRET: 'cs' });
const db = await import('../src/db.js');
const { hashPassword, sign } = await import('../src/crypto.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');
const perfil = { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] };
const chubbies = db.createClient({ slug: 'chubbies', nombre: 'Chubbies', perfil, config: {}, credentials: {} });
const otro = db.createClient({ slug: 'otro', nombre: 'Otro', perfil, config: {}, credentials: {} });
db.createUser({ email: 'dueno@chubbies.mx', nombre: 'Dueño', rol: 'cliente', client_id: chubbies.id, password_hash: hashPassword('clave-larga-123') });

const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());
const get = (u, cookie = '') => fetch(`${base}${u}`, { headers: { cookie }, redirect: 'manual' });

test('inicio, privacidad y términos se ven sin sesión', async () => {
  for (const [u, txt] of [['/', 'Kuper Publicador'], ['/privacidad', 'video.publish'], ['/terms', 'Terms of Service']]) {
    const r = await get(u);
    assert.equal(r.status, 200, u);
    assert.match(await r.text(), new RegExp(txt), u);
  }
});

test('el cliente conecta TikTok desde su cuenta y el regreso vuelve a su cuenta', async () => {
  const r = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'dueno@chubbies.mx', password: 'clave-larga-123' }) });
  const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  assert.match(await (await get('/app/cuenta', cookie)).text(), /Conectar TikTok/);
  const c = await get('/app/cuenta/tiktok/conectar', cookie);
  assert.equal(c.status, 302);
  const auth = new URL(c.headers.get('location'));
  assert.equal(auth.host, 'www.tiktok.com');
  const state = auth.searchParams.get('state');
  // TikTok regresa con error (el usuario canceló): vuelve a su cuenta con el aviso
  const cb = await get(`/admin/tiktok/callback?state=${encodeURIComponent(state)}&error=access_denied`, cookie);
  assert.match(cb.headers.get('location'), /^\/app\/cuenta\?error=/);
  // un state de otro cliente no le sirve
  const ajeno = sign(`tiktok:${otro.id}:${Date.now() + 60000}:app`);
  const cb2 = await get(`/admin/tiktok/callback?state=${encodeURIComponent(ajeno)}&error=x`, cookie);
  assert.equal(cb2.headers.get('location'), '/entrar');
  // sin sesión tampoco
  const cb3 = await get(`/admin/tiktok/callback?state=${encodeURIComponent(state)}&error=x`);
  assert.equal(cb3.headers.get('location'), '/entrar');
});
