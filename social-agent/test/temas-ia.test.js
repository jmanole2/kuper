// Temas con IA: agrupa lo que pregunta la gente, lo que el agente no supo y sugerencias que se agregan con un clic.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'tia-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123', SCHEDULER: '0' });
const db = await import('../src/db.js');
const T = await import('../src/temas-ia.js');
const K = await import('../src/conocimiento.js');
const V = await import('../src/web/views.js');
db.openDb(':memory:');
const c = db.createClient({ slug: 'a', nombre: 'Tacos A', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, config: { plan: { servicios: { chat: true } } }, credentials: {} });
K.guardar(c.id, { texto: 'Abrimos de 9 a 18.' }, 'Ana');
for (let i = 0; i < 4; i++) {
  const t = `+52551111000${i}`;
  db.upsertLead(c.id, { telefono: t, origen: 'whatsapp' });
  db.addLeadMessage(c.id, { telefono: t }, { rol: 'lead', texto: `¿Tienen envío a domicilio? mi correo es ana${i}@x.com` });
  db.addLeadMessage(c.id, { telefono: t }, { rol: 'agente', texto: 'No tengo esa información, te paso con el equipo.' });
}
let visto = '';
T.hooks.ia = async ({ system, messages }) => { visto = system + messages[0].content; return { data: {
  temas: [{ tema: 'Envíos', conversaciones: 4, ejemplo: '¿Hacen envíos?' }],
  sin_respuesta: [{ pregunta: '¿Tienen envío a domicilio?', veces: 4 }],
  sugerencias: [{ titulo: 'Envíos a domicilio', por_que: '4 personas preguntaron', texto: 'Sí hacemos envíos en [completar: zonas].' }] } }; };

test('analiza sin mandar correos ni teléfonos y guarda el resultado', async () => {
  const r = await T.analizar(db.getClient(c.id));
  assert.equal(r.conversaciones, 4); assert.equal(r.temas[0].tema, 'Envíos');
  assert.doesNotMatch(visto, /ana0@x\.com|5511110000/); assert.match(visto, /Abrimos de 9 a 18/);
  assert.equal(T.ultimo(db.getClient(c.id)).sugerencias.length, 1);
  await assert.rejects(T.analizar(db.getClient(c.id)), /hace poco/);
});

test('la sugerencia (editada) se agrega a lo que sabe el agente', () => {
  T.agregarSugerencia(db.getClient(c.id), 0, 'Sí hacemos envíos en CDMX.', 'Ana');
  assert.match(K.actual(c.id).texto, /Abrimos de 9 a 18\.\n\n## Envíos a domicilio\nSí hacemos envíos en CDMX\./);
  assert.equal(T.ultimo(db.getClient(c.id)).sugerencias[0].agregada, true);
  assert.throws(() => T.agregarSugerencia(db.getClient(c.id), 5, 'x', 'Ana'), /ya no existe/);
});

test('se ve en la analítica', async () => {
  const E = await import('../src/embudo.js');
  const a = E.analitica(db.getClient(c.id), { rango: '30' }); a.temasIA = T.ultimo(db.getClient(c.id));
  const h = V.appAnaliticaPage(db.getClient(c.id), a);
  assert.match(h, /Lo que tu agente no supo contestar/); assert.match(h, /Ya está en lo que sabe tu agente/);
});
