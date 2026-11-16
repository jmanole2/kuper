// Guardar la configuración del cliente en el admin no debe borrar lo que se conectó en otras pantallas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'cfgc-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123', SCHEDULER: '0' });
const db = await import('../src/db.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');
const c = db.createClient({ slug: 'kuper', nombre: 'Kuper', perfil: { cliente: 'K', pilares_de_contenido: [{ nombre: 'x' }] }, config: {},
  credentials: { api_key: 'k', agente_url: 'https://agente.test', meta: { page_id: '1', page_token: 'EAA-pag', capi_token: 'CAPI' },
    whatsapp: { token: 'WA-TOKEN', waba_id: '123', phone_id: '456' }, correo: { usuario: 'hola@k.mx', password: 'p' }, cobros: { token: 'MP' }, airtable: { token: 'pat', base: 'appX', tabla: 'tblY' } } });
const srv = createApp().listen(0); const base = `http://127.0.0.1:${srv.address().port}`;
test.after(() => srv.close());

test('guardar Configuración conserva WhatsApp, correo, cobros, Airtable y el token de conversiones', async () => {
  const r0 = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: '', password: 'maestra-123' }) });
  const cookie = (r0.headers.get('set-cookie') || '').split(';')[0];
  const cl = db.getClient(c.id);
  const r = await fetch(`${base}/admin/clientes/${c.id}`, { method: 'POST', redirect: 'manual', headers: { cookie, 'Content-Type': 'application/x-www-form-urlencoded', origin: base },
    body: new URLSearchParams({ nombre: 'Kuper Media', perfil: JSON.stringify(cl.perfil), config: JSON.stringify(cl.config), meta_page_id: '', meta_page_token: '', activo: '1' }) });
  assert.equal(r.status, 302, await r.text());
  const k = db.clientCredentials(db.getClient(c.id));
  assert.equal(db.getClient(c.id).nombre, 'Kuper Media');
  assert.equal(k.whatsapp?.token, 'WA-TOKEN'); assert.equal(k.correo?.password, 'p'); assert.equal(k.cobros?.token, 'MP'); assert.equal(k.airtable?.base, 'appX');
  assert.equal(k.meta.capi_token, 'CAPI'); assert.equal(k.meta.page_token, 'EAA-pag');
});
