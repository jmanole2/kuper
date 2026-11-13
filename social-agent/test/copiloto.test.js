// Ayuda de IA en la bandeja: sugerir, resumir y traducir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'cop-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123', SCHEDULER: '0' });
const db = await import('../src/db.js');
const P = await import('../src/copiloto.js');
const K = await import('../src/conocimiento.js');
const V = await import('../src/web/views.js');
db.openDb(':memory:');
const c = db.createClient({ slug: 'cop', nombre: 'Tacos A', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, config: {}, credentials: {} });
K.guardar(c.id, { texto: 'Abrimos de 9 a 18. Envío gratis en CDMX.' }, 'Ana');
const l = db.upsertLead(c.id, { telefono: '+525511112222', origen: 'whatsapp' });
db.addLeadMessage(c.id, { telefono: '+525511112222' }, { rol: 'lead', texto: 'Do you deliver to Polanco?' });
const vistos = [];
P.hooks.ia = async (o) => { vistos.push(o); const s = Object.keys(o.schema.properties);
  if (s.includes('respuesta')) return { data: { respuesta: 'Yes! Free delivery in CDMX.' } };
  if (s.includes('resumen')) return { data: { resumen: ['Pregunta por envío a Polanco'], siguiente_paso: 'Confirmar dirección' } };
  return { data: { idioma: 'inglés', traduccion: '¿Entregan en Polanco?' } }; };

test('sugerir usa lo que sabe el agente y la conversación', async () => {
  const r = await P.ayudar(db.getClient(c.id), l, 'sugerir');
  assert.equal(r.texto, 'Yes! Free delivery in CDMX.');
  assert.match(vistos[0].system, /Envío gratis en CDMX/); assert.match(vistos[0].messages[0].content, /Cliente: Do you deliver/);
});
test('resumir y traducir', async () => {
  assert.deepEqual((await P.ayudar(db.getClient(c.id), l, 'resumir')).resumen, ['Pregunta por envío a Polanco']);
  const t = await P.ayudar(db.getClient(c.id), l, 'traducir');
  assert.equal(t.idioma, 'inglés'); assert.equal(t.borrador, false);
  assert.equal((await P.ayudar(db.getClient(c.id), l, 'traducir', 'Sí, sin costo')).borrador, true);
  await assert.rejects(P.ayudar(db.getClient(c.id), l, 'borrar'), /no válida/);
});
test('los botones salen en la conversación', () => {
  const h = V.leadChatPage(db.getClient(c.id), l, db.leadMessages(l.id), { base: '/app/leads/1', puedeResponder: true });
  assert.match(h, /Sugerir respuesta/); assert.match(h, /Resumir conversación/); assert.match(h, /Enviar por WhatsApp/);
});
