// Probar agente y preguntas de control.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'pa-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123', SCHEDULER: '0' });
const db = await import('../src/db.js');
const P = await import('../src/pruebas-agente.js');
const V = await import('../src/web/views.js');
const agente = await import('../src/agente.js');
db.openDb(':memory:');
const c = db.createClient({ slug: 'pa', nombre: 'Inhouse', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, config: {}, credentials: { agente_url: 'https://agente.test', api_key: 'k' } });
const cli = () => db.getClient(c.id);
let precio = '$12,500';
const pedidos = [];
agente.hooks.fetch = async (url, o) => { pedidos.push({ url, body: JSON.parse(o.body) }); return new Response(JSON.stringify({ ok: true, respuesta: `La oficina para 4 cuesta ${precio} al mes + IVA.`, acciones: [{ herramienta: 'consultar_disponibilidad', simulada: false }] }), { headers: { 'content-type': 'application/json' } }); };
P.hooks.juez = async ({ messages }) => ({ data: { aprobada: messages[0].content.includes('cuesta $12,500'), comentario: 'ok' } });
const avisos = []; P.hooks.avisar = async (cl, a) => avisos.push(a);

test('el chat de prueba llama al agente real en /probar', async () => {
  const r = await P.probar(cli(), [{ rol: 'cliente', texto: '¿Cuánto cuesta para 4?' }]);
  assert.match(r.respuesta, /12,500/);
  assert.match(pedidos[0].url, /\/panel\/probar$/); assert.equal(pedidos[0].body.mensajes[0].rol, 'cliente');
});

test('preguntas de control: corren, guardan resultado y avisan solo si algo empeora', async () => {
  assert.throws(() => P.agregar(cli(), { pregunta: 'x' }), /qué debe contestar/);
  P.agregar(cli(), { pregunta: '¿Cuánto cuesta una oficina para 4?', debe: 'desde $12,500 + IVA' });
  let r = await P.correr(cli());
  assert.equal(r.aprobadas, 1); assert.equal(avisos.length, 0);
  precio = '$9,000';
  r = await P.correr(cli(), { motivo: 'cambio', refrescar: true });
  assert.equal(r.aprobadas, 0); assert.equal(avisos.length, 1, 'avisa porque antes pasaba');
  assert.equal(pedidos.at(-1).body.refrescar, true, 'pide al agente traer lo último');
  r = await P.correr(cli());
  assert.equal(avisos.length, 1, 'no repite el aviso si ya fallaba');
  const h = V.probarAgentePage(cli(), { preguntas: P.lista(cli()), ultimo: P.resultado(cli()), conectado: true, base: '/app', app: true });
  assert.match(h, /Revisar/); assert.match(h, /Chat de prueba/);
  P.quitar(cli(), P.lista(cli())[0].id); assert.equal(P.lista(cli()).length, 0);
});
