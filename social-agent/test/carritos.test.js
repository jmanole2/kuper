// Carrito abandonado: Shopify (con firma), API genérica, recordatorios por WhatsApp y recuperados.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'cart-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123', SCHEDULER: '0', TIMEZONE: 'America/Mexico_City' });
const db = await import('../src/db.js');
const K = await import('../src/carritos.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');
const c = db.createClient({ slug: 'tienda', nombre: 'Tienda A', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] },
  config: { plan: { servicios: { chat: true } }, carritos: { activo: true, plantilla: 'carrito_pendiente', horas: 1, segundo: true, horas2: 24, plantilla2: 'carrito_cupon' } },
  credentials: { carritos: { shopify_secret: 'shh' } } });
const cli = () => db.getClient(c.id);
const enviados = [];
K.hooks.enviar = async (cl, m) => { enviados.push(m); };
let reloj = new Date('2026-11-13T18:00:00Z'); // 12:00 en CDMX
K.hooks.ahora = () => reloj;
const srv = createApp().listen(0); const base = `http://127.0.0.1:${srv.address().port}`;
test.after(() => srv.close());
const shopify = (tema, cuerpo, secreto = 'shh') => { const raw = JSON.stringify(cuerpo);
  return fetch(`${base}/webhooks/carrito/tienda/shopify`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Topic': tema, 'X-Shopify-Hmac-Sha256': crypto.createHmac('sha256', secreto).update(raw).digest('base64') }, body: raw }); };

test('Shopify: sin la firma correcta no entra; con firma guarda el carrito', async () => {
  assert.equal((await shopify('checkouts/create', { token: 'chk1' }, 'otra')).status, 401);
  const r = await shopify('checkouts/create', { token: 'chk1', phone: '5512345678', customer: { first_name: 'Ana', last_name: 'López' }, total_price: '1290.00', currency: 'MXN',
    abandoned_checkout_url: 'https://tienda.test/checkouts/chk1/recover', line_items: [{ title: 'Tenis', quantity: 1 }, { title: 'Calcetas', quantity: 2 }] });
  assert.equal(r.status, 200);
  const [x] = K.listar(c.id);
  assert.equal(x.telefono, '525512345678'); assert.equal(x.total, 1290); assert.equal(x.productos, 'Tenis, 2 × Calcetas'); assert.equal(x.estado, 'abierto');
});

test('recordatorio a la hora, en horario, con nombre y link; segundo a las 24 h', async () => {
  assert.equal((await K.revisar(cli())).enviados, 0, 'todavía no pasa la hora');
  reloj = new Date(reloj.getTime() + 61 * 60000);
  assert.equal((await K.revisar(cli())).enviados, 1);
  assert.equal(enviados[0].plantilla, 'carrito_pendiente'); assert.deepEqual(enviados[0].vals, ['Ana', 'https://tienda.test/checkouts/chk1/recover']);
  assert.equal((await K.revisar(cli())).enviados, 0, 'no repite');
  const x = K.listar(c.id)[0]; assert.equal(x.estado, 'recordado'); assert.ok(x.lead_id);
  db.getDb().prepare("UPDATE carritos SET recordado_at = datetime('now', '-25 hours') WHERE id = ?").run(x.id);
  reloj = new Date('2026-11-14T03:30:00Z'); // 21:30 CDMX: fuera de horario
  assert.equal((await K.revisar(cli())).enviados, 0, 'de noche no');
  reloj = new Date('2026-11-14T16:00:00Z');
  assert.equal((await K.revisar(cli())).enviados, 1); assert.equal(enviados.at(-1).plantilla, 'carrito_cupon');
});

test('compra después del recordatorio: recuperado y lead vendido con su valor', async () => {
  await shopify('orders/create', { checkout_token: 'chk1', phone: '+52 55 1234 5678' });
  const x = K.listar(c.id)[0];
  assert.equal(x.estado, 'recuperado');
  const lead = db.getLead(c.id, x.lead_id); assert.equal(lead.resultado, 'vendido'); assert.equal(Number(lead.valor), 1290);
  const r = K.resumen(c.id); assert.equal(r.recuperados, 1); assert.equal(r.dinero, 1290);
});

test('API genérica: carrito y pago; si compra sin recordatorio no cuenta como recuperado', async () => {
  const llave = db.rotateApiKey ? db.rotateApiKey(c.id) : null;
  K.registrar(cli(), { origen: 'api', id: 'woo-9', telefono: '5598765432', nombre: 'Luis', total: 500, url: 'https://tienda.test/carrito/9' });
  const y = K.pedido(cli(), { carrito_id: 'woo-9' });
  assert.equal(y.estado, 'comprado');
  assert.throws(() => K.registrar(cli(), { origen: 'api' }), /Falta el id/);
  assert.equal(K.registrar(cli(), { origen: 'api', id: 'x1', telefono: '', url: 'javascript:alert(1)' }).url, null, 'solo links https');
  void llave;
});
