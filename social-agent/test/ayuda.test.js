// Chat de ayuda de Kuper dentro del panel.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'ay-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123', SCHEDULER: '0' });
const db = await import('../src/db.js');
const A = await import('../src/ayuda.js');
const V = await import('../src/web/views.js');
db.openDb(':memory:');
const c = db.createClient({ slug: 'ay', nombre: 'Tacos A', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, config: { plan: { servicios: { chat: true } } }, credentials: {} });
let visto = null;
A.hooks.ia = async (o) => { visto = o; return { data: { respuesta: 'Ve a Agente y toca "Pausar agente".', hablar_con_kuper: false } }; };

test('contesta con el manual y sabe qué contrató la marca', async () => {
  const r = await A.preguntar(db.getClient(c.id), { id: 1, nombre: 'Ana' }, '¿cómo pauso al agente?');
  assert.match(r.respuesta, /Pausar agente/);
  assert.match(visto.system, /Agente de IA \(chat\)/); assert.match(visto.system, /Pausar agente \(deja de contestar a todos\)/);
  await assert.rejects(A.preguntar(db.getClient(c.id), { id: 1 }, '  '), /Escribe/);
});
test('la burbuja sale en el panel de la marca y no en el admin', () => {
  const cl = db.getClient(c.id);
  assert.match(V.asistentePage(cl, { base: '/app', app: true }), /id="ky-b"/);
  assert.doesNotMatch(V.asistentePage(cl, { base: '/admin/clientes/1', app: false }), /id="ky-b"/);
});
