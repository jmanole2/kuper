import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'cob-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123', PUBLIC_BASE_URL: 'https://redes.kuper.media' });
const db = await import('../src/db.js');
const cobros = await import('../src/pagos-clientes.js');
const atrib = await import('../src/atribucion.js');
const embudo = await import('../src/embudo.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');

const embudos = [{ id: 'v', nombre: 'Ventas', etapas: [{ id: 'nuevo', nombre: 'Nuevo', tipo: 'nuevo' }, { id: 'pedido', nombre: 'Pidió', tipo: 'conversacion' }, { id: 'pagado', nombre: 'Pagado', tipo: 'cliente' }] }];
const c = db.createClient({ slug: 'chub', nombre: 'Chubbies', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] },
  config: { plan: { servicios: { chat: true } }, embudos, cobros: { activo: true, proveedor: 'mercadopago', etapa_pagado: 'pagado', monto_max: 2000 }, conversiones: { activo: true, dataset_id: '999' } },
  credentials: { api_key: 'llave-chub', cobros: { token: 'APP_USR-x' }, meta: { capi_token: 'EAAG-capi' }, whatsapp: { waba_id: '777' } } });
const cl = () => db.getClient(c.id);

const llamadas = [];
let mpPagado = false;
const fakeFetch = async (url, o = {}) => {
  const u = String(url); llamadas.push({ u, o });
  if (u.includes('checkout/preferences')) return new Response(JSON.stringify({ id: 'PREF1', init_point: 'https://mpago.la/abc' }));
  if (u.includes('payments/search')) return new Response(JSON.stringify({ results: mpPagado ? [{ status: 'approved', transaction_amount: 258 }] : [] }));
  if (u.includes('api.stripe.com/v1/checkout/sessions/')) return new Response(JSON.stringify({ id: 'cs_1', payment_status: 'paid', status: 'complete' }));
  if (u.includes('api.stripe.com/v1/checkout/sessions')) return new Response(JSON.stringify({ id: 'cs_1', url: 'https://checkout.stripe.com/c/cs_1' }));
  if (u.includes('graph.facebook.com')) return new Response(JSON.stringify({ events_received: 1 }));
  return new Response('{}', { status: 404 });
};
cobros.hooks.fetch = fakeFetch; atrib.hooks.fetch = fakeFetch;

test('el agente pide un link de Mercado Pago y al pagar el lead queda vendido, cambia de etapa y se avisa a Meta', async () => {
  const lead = db.upsertLead(c.id, { telefono: '5512345678', nombre: 'Ana', origen: 'whatsapp', campana: { anuncio_id: '123', ctwa_clid: 'CLID-XYZ', canal: 'whatsapp' } });
  const server = createApp().listen(0);
  try {
    const r = await (await fetch(`http://127.0.0.1:${server.address().port}/api/chub/cobros/link`, { method: 'POST', headers: { Authorization: 'Bearer llave-chub', 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefono: '5512345678', concepto: '2 Doble Chubbie + papas', monto: 258 }) })).json();
    assert.equal(r.url, 'https://mpago.la/abc');
  } finally { server.close(); }
  const pref = JSON.parse(llamadas.find((x) => x.u.includes('preferences')).o.body);
  assert.equal(pref.items[0].unit_price, 258);
  assert.equal(pref.back_urls.success, 'https://redes.kuper.media/pago-listo');
  assert.equal((await cobros.revisar(cl())).pagados, 0);
  mpPagado = true;
  assert.equal((await cobros.revisar(cl())).pagados, 1);
  const l = db.getLead(c.id, lead.id);
  assert.equal(l.resultado, 'vendido');
  assert.equal(l.valor, 258);
  assert.equal(l.etapa, 'pagado');
  assert.match(db.leadMessages(lead.id).at(-1).texto, /💳 Pagó \$258/);
  const capi = llamadas.find((x) => x.u.includes('graph.facebook.com') && x.u.includes('/999/events'));
  const ev = JSON.parse(capi.o.body).data[0];
  assert.equal(ev.event_name, 'Purchase');
  assert.equal(ev.action_source, 'business_messaging');
  assert.equal(ev.user_data.ctwa_clid, 'CLID-XYZ');
  assert.equal(ev.user_data.whatsapp_business_account_id, '777');
  assert.equal(ev.custom_data.value, 258);
  assert.equal(ev.user_data.ph[0].length, 64); // teléfono con hash, nunca en claro
  assert.equal((await cobros.revisar(cl())).pagados, 0); // no se cuenta dos veces
  assert.equal(cobros.resumen(c.id).total, 258);
});

test('límites: monto máximo, mínimo y sin configurar', async () => {
  await assert.rejects(() => cobros.crearLink(cl(), { telefono: '5512345678', concepto: 'Banquete', monto: 5000 }), /máximo/);
  await assert.rejects(() => cobros.crearLink(cl(), { telefono: '5512345678', concepto: 'x', monto: 5 }), /mínimo/);
  db.updateClient(c.id, { config: { ...cl().config, cobros: { ...cl().config.cobros, activo: false } } });
  await assert.rejects(() => cobros.crearLink(cl(), { telefono: '5512345678', concepto: 'x', monto: 100 }), /no están configurados/);
});

test('Stripe también funciona', async () => {
  db.updateClient(c.id, { config: { ...cl().config, cobros: { activo: true, proveedor: 'stripe', monto_max: 2000 } } });
  const r = await cobros.crearLink(cl(), { telefono: '5598765432', concepto: 'Combo', monto: 150 });
  assert.equal(r.url, 'https://checkout.stripe.com/c/cs_1');
  const f = new URLSearchParams(llamadas.findLast((x) => x.u.endsWith('/v1/checkout/sessions')).o.body);
  assert.equal(f.get('line_items[0][price_data][unit_amount]'), '15000');
  assert.equal((await cobros.revisar(cl())).pagados, 1);
});

test('prioridad: calientes arriba, vendidos y viejos abajo', () => {
  const ahora = Date.now();
  const etapa = (id) => ({ etapa: id, embudo: 'v' });
  const reciente = new Date(ahora - 3600000).toISOString().replace('T', ' ').slice(0, 19);
  const viejo = new Date(ahora - 20 * 86400000).toISOString().replace('T', ' ').slice(0, 19);
  const cal = embudo.puntaje(cl(), { ...etapa('pedido'), updated_at: reciente, valor: 300, estado: 'conversacion' }, { rol: 'lead' }, ahora);
  assert.ok(embudo.caliente(cal), String(cal));
  assert.ok(!embudo.caliente(embudo.puntaje(cl(), { ...etapa('nuevo'), updated_at: viejo, estado: 'nuevo' }, null, ahora)));
  assert.equal(embudo.puntaje(cl(), { ...etapa('pedido'), updated_at: reciente, resultado: 'vendido' }, null, ahora), 0);
});
