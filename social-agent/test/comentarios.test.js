import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'com-')), SECRET_KEY: 'k', DRY_RUN: '0', MOCK_LLM: '1' });
const db = await import('../src/db.js');
const com = await import('../src/engage/comentarios.js');
const conoc = await import('../src/conocimiento.js');
db.openDb(':memory:');

const client = db.createClient({
  slug: 'c', nombre: 'Chubbies', perfil: { cliente: 'Chubbies', pilares_de_contenido: [{ nombre: 'x' }] },
  config: { plan: { servicios: { comentarios: true } }, comentarios: { activo: true } },
  credentials: { meta: { page_id: 'P', ig_user_id: 'IG', page_token: 'T' } },
});
conoc.guardar(client.id, { texto: '# Chubbies\n- Hamburguesa clásica $129' }, 'test');

let ig = [], fb = [], ads = [];
const enviados = [];
const pedidos = [];
com.hooks.graph = async (method, ruta, params) => {
  if (method === 'POST') { enviados.push({ ruta, params }); return { id: 'ok' }; }
  if (ruta === 'IG') return { username: 'chubbies' };
  if (ruta === 'IG/media') return { data: [{ id: 'M1', permalink: 'https://ig/p/1', caption: 'Nueva burger', comments: { data: ig } }] };
  if (ruta === 'P/published_posts') return { data: [{ id: 'P_1', permalink_url: 'https://fb/1', message: 'Promo', comments: { data: fb } }] };
  if (ruta === 'P/ads_posts') return { data: [{ id: 'P_AD', permalink_url: 'https://fb/ad', message: 'Anuncio', comments: { data: ads } }] };
  throw new Error(`ruta inesperada ${ruta}`);
};
// La IA de prueba: decide según el texto.
com.hooks.ia = async ({ messages, system }) => {
  pedidos.push(system);
  const lista = JSON.parse(messages[0].content.replace(/^Comentarios nuevos:\n/, ''));
  return { data: { respuestas: lista.map((c) => {
    if (/precio|cuánto/i.test(c.comentario)) return { id: c.id, intencion: 'compra', publica: '¡Te escribimos por mensaje! 🍔', dm: 'La clásica cuesta $129. ¿Para cuántas personas?', ocultar: false, avisar: false, cupon: 'primera' };
    if (/gana dinero|http/i.test(c.comentario)) return { id: c.id, intencion: 'spam', publica: '', dm: '', ocultar: true, avisar: false };
    if (/fría|tardó/i.test(c.comentario)) return { id: c.id, intencion: 'queja', publica: 'Lo sentimos mucho, te escribimos para resolverlo.', dm: '', ocultar: false, avisar: true };
    return { id: c.id, intencion: 'etiqueta', publica: '', dm: '', ocultar: false, avisar: false };
  }) } };
};

const ahora = () => new Date().toISOString();
const cIG = (id, text, username = 'ana') => ({ id, text, username, timestamp: ahora() });
const cFB = (id, message, name = 'Luis') => ({ id, message, from: { id: `u${id}`, name }, created_time: ahora() });
const fresco = () => db.getClient(client.id);

test('la primera vuelta solo registra lo que ya existía', async () => {
  ig = [cIG('I0', '¿precio?')]; fb = [cFB('F0', '¿cuánto cuesta?')];
  const r = await com.revisar(fresco());
  assert.equal(r.nuevos, 0);
  assert.equal(enviados.length, 0);
  assert.equal(pedidos.length, 0);
});

test('contesta en público, manda DM a quien quiere comprar, oculta spam y avisa quejas', async () => {
  ig = [cIG('I0', '¿precio?'), cIG('I1', '¿Qué precio tiene la clásica?'), cIG('I2', 'gana dinero rápido http://x', 'bot1'), cIG('I3', '@pepe vamos', 'maria')];
  fb = [cFB('F0', '¿cuánto cuesta?'), cFB('F1', 'Llegó fría y tardó una hora')];
  ads = [cFB('A1', '¿cuánto cuesta el combo?', 'Rosa')];
  const r = await com.revisar(fresco());
  assert.equal(r.nuevos, 5);
  assert.match(pedidos[0], /Hamburguesa clásica \$129/); // usa lo que sabe el agente
  // Instagram: DM por respuesta privada y respuesta pública en /replies
  assert.ok(enviados.some((e) => e.ruta === 'P/messages' && JSON.parse(e.params.recipient).comment_id === 'I1'));
  assert.ok(enviados.some((e) => e.ruta === 'I1/replies'));
  // spam oculto en Instagram
  assert.ok(enviados.some((e) => e.ruta === 'I2' && e.params.hide === 'true'));
  // la etiqueta a un amigo no se contesta
  assert.ok(!enviados.some((e) => e.ruta.startsWith('I3')));
  assert.equal(com.obtener(client.id, 'I3').status, 'ignorado');
  // Facebook: respuesta en /comments, también en anuncios
  assert.ok(enviados.some((e) => e.ruta === 'F1/comments'));
  assert.ok(enviados.some((e) => e.ruta === 'A1/comments'));
  assert.equal(com.obtener(client.id, 'A1').anuncio, 1);
  // queja: aviso al equipo
  assert.equal(com.obtener(client.id, 'F1').intencion, 'queja');
  // quien quería comprar por Instagram queda como lead
  assert.ok(db.listLeads(client.id).some((l) => l.usuario === 'ana'));
  // no repite
  const n = enviados.length;
  const otra = await com.revisar(fresco());
  assert.equal(otra.nuevos, 0);
  assert.equal(enviados.length, n);
  const res = com.resumen(client.id);
  assert.equal(res.compra, 2);
  assert.equal(res.quejas, 1);
});

test('modo revisión: nada sale hasta aprobarlo; se puede editar o descartar', async () => {
  db.updateClient(client.id, { config: { ...fresco().config, comentarios: { activo: true, revision: true } } });
  ig = [cIG('I4', '¿precio de las papas?', 'leo'), cIG('I5', '¿cuánto cuesta el refresco?', 'sol')];
  const n = enviados.length;
  const r = await com.revisar(fresco());
  assert.equal(r.por_aprobar, 2);
  assert.equal(enviados.length, n);
  assert.equal(com.listar(client.id, { status: 'por_aprobar' }).length, 2);
  const st = await com.aprobar(fresco(), 'I4', { publica: 'Te mandamos mensaje 🙌', dm: 'Las papas cuestan $49.', autor: 'Paty' });
  assert.equal(st, 'enviado');
  assert.ok(enviados.some((e) => e.ruta === 'I4/replies' && e.params.message === 'Te mandamos mensaje 🙌'));
  assert.equal(com.obtener(client.id, 'I4').autor, 'Paty');
  com.descartar(fresco(), 'I5', 'Paty');
  assert.equal(com.obtener(client.id, 'I5').status, 'descartado');
  await assert.rejects(() => com.aprobar(fresco(), 'I4', {}), /ya se atendió/);
});

test('en pausa o sin el servicio activo no revisa', async () => {
  db.updateClient(client.id, { config: { ...fresco().config, comentarios: { activo: true, pausado: true } } });
  ig = [cIG('I9', '¿precio?', 'zoe')];
  const r = await com.revisar(fresco());
  assert.equal(r.nuevos, 0);
  assert.equal(com.obtener(client.id, 'I9'), undefined);
});

test('las instrucciones respetan los ajustes', () => {
  const t = com.instrucciones({ nombre: 'X' }, { ...com.DEFAULTS, publico: false, dm: false, instrucciones: 'No des precios en público.' }, 'saber');
  assert.match(t, /déjala siempre vacía/);
  assert.match(t, /déjalo siempre vacío/);
  assert.match(t, /No des precios en público/);
});
