// Facturación automática con Factura.com (simulada): alta del cliente, CFDI con IVA, una sola vez por cobro.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'fac-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123', SCHEDULER: '0',
  FACTURACOM_API_KEY: 'api-123', FACTURACOM_SECRET_KEY: 'sec-456', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x' });
const db = await import('../src/db.js');
const fac = await import('../src/facturacion.js');
const billing = await import('../src/billing.js');
db.openDb(':memory:');
const fiscal = { rfc: 'ROM010203AB1', razon_social: 'RED ONE MEXICO S.A. DE C.V.', cp: '11000', regimen: '601', uso: 'G03', correo: 'conta@redone.agency' };
const c = db.createClient({ slug: 'red-one', nombre: 'Red One', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, credentials: {}, config: { fiscal, plan: { servicios: { chat: true } } } });

const pedidos = [];
let creadas = 0;
fac.hooks.fetch = async (url, opt) => {
  const body = opt.body ? JSON.parse(opt.body) : null;
  pedidos.push({ url, method: opt.method, headers: opt.headers, body });
  const ok = (j) => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => j });
  if (url.endsWith('/v4/series')) return ok({ data: [{ SerieID: 19843, SerieName: 'A', SerieType: 'factura' }, { SerieID: 1, SerieName: 'P', SerieType: 'pago' }] });
  if (/\/v1\/clients\/ROM010203AB1$/.test(url)) return { ok: false, status: 404, headers: { get: () => 'application/json' }, json: async () => ({ status: 'error' }) };
  if (url.endsWith('/v1/clients/create')) return ok({ status: 'success', Data: { UID: 'cli-uid-1' } });
  if (url.endsWith('/v4/cfdi40/create')) { creadas++; return ok({ response: 'success', UUID: 'uuid-111', uid: 'cfdi-uid-1', INV: { Serie: 'A', Folio: 15 } }); }
  if (url.endsWith('/v4/cfdi40/cfdi-uid-1/pdf')) return { ok: true, status: 200, headers: { get: () => 'application/pdf' }, arrayBuffer: async () => new TextEncoder().encode('%PDF-falso').buffer };
  return { ok: false, status: 404, headers: { get: () => 'application/json' }, json: async () => ({}) };
};
fac.hooks.stripe = async (m, p) => (p === '/charges/ch_1' ? { payment_method_details: { card: { funding: 'debit' } } } : {});

// Factura de Stripe: $1,500 + IVA (tasa exclusiva) y un extra de $150 con IVA incluido.
const inv = { id: 'in_1', number: 'KUPER-0001', amount_paid: 191400, charge: 'ch_1', lines: { data: [
  { amount: 150000, amount_excluding_tax: 150000, description: '1 × Agente de IA (WhatsApp, Instagram y Messenger)', tax_amounts: [{ amount: 24000, inclusive: false }] },
  { amount: 17400, amount_excluding_tax: 15000, description: 'Publicación extra en instagram', tax_amounts: [{ amount: 2400, inclusive: true }] },
] } };

test('ajustes: series de Factura.com y validación', async () => {
  const s = await fac.series();
  assert.deepEqual(s.map((x) => x.nombre), ['A'], 'solo series de factura');
  assert.equal(pedidos[0].headers['F-Api-Key'], 'api-123'); assert.equal(pedidos[0].headers['F-PLUGIN'], '9d4095c8f7ed5785cb14c0e3b033eeb8252416ed');
  assert.match(pedidos[0].url, /^https:\/\/api\.factura\.com\/v4\/series$/);
  assert.throws(() => fac.guardarAjustes({ activo: '1', clave_prod_serv: '123' }), /8 números/);
  assert.throws(() => fac.guardarAjustes({ activo: '1', clave_prod_serv: '81112100' }), /serie/);
  fac.guardarAjustes({ activo: '1', serie: '19843|A', clave_prod_serv: '81112100', clave_unidad: 'e48', unidad: 'Unidad de servicio' });
  assert.equal(fac.ajustes().clave_unidad, 'E48');
});

test('razón social sin régimen de capital', () => {
  assert.equal(fac.razonSinRegimen('RED ONE MEXICO S.A. DE C.V.'), 'RED ONE MEXICO');
  assert.equal(fac.razonSinRegimen('Kuper Media SAPI de CV'), 'KUPER MEDIA');
  assert.equal(fac.razonSinRegimen('JUAN PEREZ LOPEZ'), 'JUAN PEREZ LOPEZ');
});

test('timbra el cobro con IVA desglosado, alta del cliente y forma de pago por tipo de tarjeta', async () => {
  const r = await fac.facturarCobro(db.getClient(c.id), inv);
  assert.equal(r.factura.status, 'emitida'); assert.equal(r.factura.folio, '15'); assert.equal(r.factura.uuid, 'uuid-111');
  const alta = pedidos.find((p) => p.url.endsWith('/v1/clients/create')).body;
  assert.deepEqual([alta.rfc, alta.razons, alta.codpos, alta.regimen, alta.pais, alta.email], ['ROM010203AB1', 'RED ONE MEXICO', 11000, '601', 'MEX', 'conta@redone.agency']);
  const cfdi = pedidos.find((p) => p.url.endsWith('/v4/cfdi40/create')).body;
  assert.equal(cfdi.Receptor.UID, 'cli-uid-1'); assert.equal(cfdi.Serie, 19843); assert.equal(cfdi.FormaPago, '28'); assert.equal(cfdi.MetodoPago, 'PUE'); assert.equal(cfdi.UsoCFDI, 'G03');
  const [a, b] = cfdi.Conceptos;
  assert.equal(a.ValorUnitario, 1500); assert.equal(a.Impuestos.Traslados[0].Importe, 240); assert.equal(a.Descripcion, 'Agente de IA (WhatsApp, Instagram y Messenger)');
  assert.equal(b.ValorUnitario, 150, 'con IVA incluido se factura la base'); assert.equal(b.Impuestos.Traslados[0].Importe, 24);
  assert.equal(a.ClaveProdServ, '81112100'); assert.equal(a.ClaveUnidad, 'E48'); assert.equal(a.ObjetoImp, '02');
  assert.equal(db.getClient(c.id).config.fiscal.facturacom_uid, 'cli-uid-1', 'se guarda el UID del cliente');
});

test('nunca factura dos veces el mismo cobro', async () => {
  const r = await fac.facturarCobro(db.getClient(c.id), inv);
  assert.ok(r.ya); assert.equal(creadas, 1);
});

test('sin datos fiscales queda pendiente', async () => {
  const sin = db.createClient({ slug: 'sin', nombre: 'Sin datos', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, credentials: {}, config: {} });
  const r = await fac.facturarCobro(sin, { ...inv, id: 'in_2' });
  assert.equal(r.factura.status, 'pendiente'); assert.match(r.factura.error, /datos fiscales/); assert.equal(creadas, 1);
});

test('el webhook de Stripe (invoice.paid) dispara la factura y el panel la muestra', async () => {
  billing.hooks.fetch = async (url) => ({ ok: true, status: 200, json: async () => (url.includes('/invoices/in_3') ? { ...inv, id: 'in_3' } : { data: [] }) });
  await billing.procesarEvento({ type: 'invoice.paid', data: { object: { ...inv, id: 'in_3', customer: 'cus_ro', metadata: { client_id: c.id } } } });
  for (let i = 0; i < 50 && fac.listar({ clientId: c.id }).find((f) => f.stripe_invoice === 'in_3')?.status !== 'emitida'; i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(fac.porStripe(c.id).in_3.status, 'emitida');
  const { createApp } = await import('../src/server.js');
  const server = createApp().listen(0), base = `http://127.0.0.1:${server.address().port}`;
  try {
    const cookie = ((await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: '', password: 'maestra-123' }) })).headers.get('set-cookie') || '').split(';')[0];
    const pag = await (await fetch(`${base}/admin/facturacion`, { headers: { cookie } })).text();
    assert.match(pag, /Facturas automáticas/); assert.match(pag, /A15/); assert.match(pag, /value="19843\|A" selected/);
    const f = fac.porStripe(c.id).in_1;
    const pdf = await fetch(`${base}/admin/facturacion/${f.id}/pdf`, { headers: { cookie } });
    assert.equal(pdf.headers.get('content-type'), 'application/pdf'); assert.equal(await pdf.text(), '%PDF-falso');
    assert.equal((await fetch(`${base}/admin/facturacion/${f.id}/exe`, { headers: { cookie } })).status, 404);
  } finally { server.close(); }
});
