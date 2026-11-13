// Llenar "Lo que sabe tu agente" desde la página web del negocio.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'web-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123', SCHEDULER: '0' });
const db = await import('../src/db.js');
const W = await import('../src/sitioweb.js');
const K = await import('../src/conocimiento.js');
db.openDb(':memory:');
const c = db.createClient({ slug: 'web', nombre: 'Tacos A', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, config: {}, credentials: {} });
const pagina = (cuerpo) => ({ ok: true, status: 200, headers: new Map([['content-type', 'text/html']]), body: null, text: async () => cuerpo });
const pedidas = [];
W.hooks.lookup = async (h) => (h === 'interno.test' ? [{ address: '192.168.1.5' }] : [{ address: '93.184.216.34' }]);
W.hooks.fetch = async (u) => { pedidas.push(String(u));
  if (String(u).includes('/servicios')) return pagina('<h1>Servicios</h1><p>Taco al pastor $25. Orden de 5 tacos $110. Servicio a domicilio en Roma y Condesa.</p>'.repeat(3));
  return pagina(`<title>Tacos A</title><nav><a href="/servicios">Servicios y precios</a><a href="https://otro.test/x">Fuera</a></nav><p>${'Somos una taquería familiar en la Roma desde 1990. Abrimos de 12 a 23 h. '.repeat(6)}</p><script>alert(1)</script>`); };
let visto = '';
W.hooks.ia = async ({ messages }) => { visto = messages[0].content; return { data: { texto: '# Lo que tu agente sabe de tu negocio\n## Quiénes somos\n- Taquería familiar en la Roma desde 1990.\n## Servicios y precios\n- Taco al pastor: $25' } }; };

test('lee la página y sus páginas internas, sin scripts, y arma el borrador', async () => {
  const r = await W.borradorDesdeWeb(db.getClient(c.id), 'tacosa.test');
  assert.match(r.texto, /Taquería familiar/);
  assert.ok(pedidas.some((u) => u.endsWith('/servicios')), 'lee la página de servicios'); assert.ok(!pedidas.some((u) => u.includes('otro.test')), 'no sale del sitio');
  assert.match(visto, /Taco al pastor \$25/); assert.doesNotMatch(visto, /alert\(1\)/);
  assert.equal(K.actual(c.id), null, 'no guarda nada solo');
});
test('conserva lo que ya tenían', async () => {
  K.guardar(c.id, { texto: 'Promoción martes 2x1.' }, 'Ana');
  await W.borradorDesdeWeb(db.getClient(c.id), 'https://tacosa.test');
  assert.match(visto, /YA TIENEN ESTA INFORMACIÓN[\s\S]*martes 2x1/);
});
test('no lee direcciones internas ni basura', async () => {
  await assert.rejects(W.borradorDesdeWeb(db.getClient(c.id), 'http://interno.test'), /no se puede leer/);
  await assert.rejects(W.borradorDesdeWeb(db.getClient(c.id), 'http://127.0.0.1'), /no se puede leer/);
  await assert.rejects(W.borradorDesdeWeb(db.getClient(c.id), 'ftp://x'), /Escribe la dirección/);
  await assert.rejects(W.borradorDesdeWeb(db.getClient(c.id), 'https://tacosa.test:8080'), /Escribe la dirección/);
});
