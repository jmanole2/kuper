// Anuncios: gasto de Meta vs leads y ventas, recomendaciones y públicos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'ads-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123', SCHEDULER: '0' });
const db = await import('../src/db.js');
const A = await import('../src/anuncios.js');
const V = await import('../src/web/views.js');
db.openDb(':memory:');
const c = db.createClient({ slug: 'ads', nombre: 'Tacos A', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, config: { anuncios: { cuenta: 'act_5550001112' } }, credentials: { meta: { ads_token: 'EAA-ads' } } });
const cli = () => db.getClient(c.id);
// 3 leads del anuncio 111 (1 vendido por $3,000) y 1 del 222; el 333 gasta sin traer nadie.
for (let i = 0; i < 3; i++) db.upsertLead(c.id, { telefono: `+52551000000${i}`, origen: 'whatsapp', campana: { anuncio_id: '111', titulo: 'Promo tacos' } });
db.upsertLead(c.id, { telefono: '+525510000009', origen: 'whatsapp', campana: { anuncio_id: '222', titulo: 'Video' } });
const vendido = db.listLeads(c.id).find((l) => l.anuncio_id === '111');
db.getDb().prepare("UPDATE leads SET resultado = 'vendido', valor = 3000 WHERE id = ?").run(vendido.id);
for (const t of ['hola', '¿precio?']) db.addLeadMessage(c.id, { telefono: vendido.telefono }, { rol: 'lead', texto: t });
const pedidos = [];
A.hooks.fetch = async (url, o = {}) => {
  pedidos.push({ url: String(url), metodo: o.method || 'GET', body: o.body ? JSON.parse(o.body) : null });
  if (String(url).includes('/act_5550001112/insights')) return new Response(JSON.stringify({ data: [
    { ad_id: '111', ad_name: 'Promo tacos', campaign_name: 'Octubre', spend: '600', impressions: '10000', clicks: '200' },
    { ad_id: '333', ad_name: 'Carrusel', campaign_name: 'Octubre', spend: '900', impressions: '20000', clicks: '50' }] }));
  if (String(url).endsWith('/act_5550001112/customaudiences')) return new Response(JSON.stringify({ id: o.body.includes('LOOKALIKE') ? 'AUD-SIM' : 'AUD-1' }));
  if (/AUD-1\/(users|usersreplace)$/.test(String(url))) return new Response(JSON.stringify({ num_received: 1 }));
  return new Response(JSON.stringify({ error: { message: 'no esperado' } }), { status: 400 });
};

test('junta gasto de Meta con leads y ventas del panel', async () => {
  const r = await A.rendimiento(cli(), { dias: 30 });
  const f = Object.fromEntries(r.filas.map((x) => [x.ad_id, x]));
  assert.equal(f['111'].gasto, 600); assert.equal(f['111'].leads, 3); assert.equal(f['111'].ventas, 1); assert.equal(f['111'].cpl, 200); assert.equal(f['111'].roas, 5);
  assert.equal(f['111'].conversaciones, 1);
  assert.equal(f['333'].leads, 0, 'el que gasta sin traer nadie también aparece'); assert.equal(f['222'].gasto, 0);
  assert.equal(r.totales.gasto, 1500); assert.equal(r.totales.ventas, 1);
  assert.match(pedidos[0].url, /act_5550001112\/insights\?.*level=ad/); assert.match(pedidos[0].url, /access_token=EAA-ads/);
  const h = V.anunciosPage(cli(), { rend: r, aj: A.ajustes(cli()), listo: true, SEGMENTOS: A.SEGMENTOS, base: '/app', app: true });
  assert.match(h, /Promo tacos/); assert.match(h, /5\.0x/);
});

test('recomendaciones: usa la tabla y lo que escribieron los compradores', async () => {
  let visto = '';
  A.hooks.ia = async ({ messages }) => { visto = messages[0].content; return { data: { resumen: 'El carrusel gasta sin traer leads.', acciones: [{ anuncio: 'Carrusel', accion: 'pausar', por_que: '$900 y 0 leads' }], ideas: [{ titulo: 'Tacos a domicilio', texto: 'x', por_que: 'y' }] } }; };
  const r = await A.recomendar(cli(), await A.rendimiento(cli()));
  assert.equal(r.acciones[0].accion, 'pausar'); assert.match(visto, /¿precio\?/); assert.match(visto, /"anuncio":"Carrusel"/);
  assert.equal(A.ultimasRecomendaciones(cli()).resumen, 'El carrusel gasta sin traer leads.');
});

test('públicos: pide 100 contactos, manda datos cifrados y crea el similar', async () => {
  await assert.rejects(A.crearPublico(cli(), { segmento: 'leads' }), /al menos 100/);
  for (let i = 0; i < 120; i++) db.upsertLead(c.id, { telefono: `+5255200${String(i).padStart(5, '0')}`, origen: 'whatsapp' });
  const r = await A.crearPublico(cli(), { segmento: 'leads', similar: true });
  assert.equal(r.id, 'AUD-1'); assert.equal(r.similar_id, 'AUD-SIM'); assert.ok(r.contactos >= 124);
  const subida = pedidos.find((p) => p.url.endsWith('AUD-1/users'));
  assert.deepEqual(subida.body.payload.schema, ['PHONE', 'EMAIL']);
  assert.match(subida.body.payload.data[0][0], /^[a-f0-9]{64}$/, 'teléfono cifrado'); assert.doesNotMatch(JSON.stringify(subida.body), /5255200/);
  await A.crearPublico(cli(), { segmento: 'leads', similar: true });
  assert.ok(pedidos.some((p) => p.url.endsWith('AUD-1/usersreplace')), 'la segunda vez reemplaza en el mismo público');
  assert.equal(pedidos.filter((p) => p.url.endsWith('customaudiences')).length, 2, 'no crea públicos repetidos');
});
