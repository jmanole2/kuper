// Plan por cliente: secciones según servicios, posts extra (1 gratis al mes) y cobro con Stripe (simulado).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'plan-')), SECRET_KEY: 'x', TIMEZONE: 'America/Mexico_City', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_test', SCHEDULER: '0' });
const db = await import('../src/db.js');
const plan = await import('../src/plan.js');
const billing = await import('../src/billing.js');
const pipe = await import('../src/pipeline.js');
const { hashPassword } = await import('../src/crypto.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');
const perfil = { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] };
const chatOnly = db.createClient({ slug: 'clinica', nombre: 'Clínica Sol', perfil, credentials: {},
  config: { instagram: { activo: true }, plan: { servicios: { redes: false, chat: true, agenda: true }, conceptos: [{ nombre: 'Agente IA', monto: 499, tipo: 'mensual' }, { nombre: 'Configuración', monto: 5499, tipo: 'unico' }] } } });
const sabor = db.createClient({ slug: 'buen-sabor', nombre: 'Buen Sabor', perfil, credentials: {},
  config: { instagram: { activo: true }, facebook: { activo: true }, plan: { servicios: { redes: true, chat: false, agenda: false }, posts_semana: 3, extra_gratis_mes: 1, precio_extra: 150 } } });
db.createUser({ email: 'ana@clinica.mx', nombre: 'Ana', rol: 'cliente', client_id: chatOnly.id, password_hash: hashPassword('ClaveAna2030!') });
db.createUser({ email: 'luis@buensabor.mx', nombre: 'Luis', rol: 'cliente', client_id: sabor.id, password_hash: hashPassword('ClaveLuis2030!') });

// Stripe simulado
const llamadas = [];
let pagoFalla = false;
billing.hooks.fetch = async (url, opt) => {
  const u = new URL(url), body = opt.body ? Object.fromEntries(new URLSearchParams(String(opt.body))) : {};
  llamadas.push({ m: opt.method, p: u.pathname, body, idem: opt.headers['Idempotency-Key'] });
  const ok = (j) => ({ ok: true, status: 200, json: async () => j });
  if (u.pathname === '/v1/customers' && opt.method === 'POST') return ok({ id: 'cus_1' });
  if (u.pathname === '/v1/checkout/sessions') return ok({ url: 'https://checkout.stripe.test/s1' });
  if (u.pathname === '/v1/tax_rates' && opt.method === 'GET') return ok({ data: [] });
  if (u.pathname === '/v1/tax_rates') return ok({ id: body.inclusive === 'true' ? 'txr_inc' : 'txr_mas' });
  if (u.pathname === '/v1/invoiceitems') return ok({ id: 'ii_1' });
  if (u.pathname === '/v1/invoices' && opt.method === 'POST') return ok({ id: 'in_1' });
  if (u.pathname === '/v1/invoices/in_1/pay') return pagoFalla ? { ok: false, status: 402, json: async () => ({ error: { message: 'Tarjeta rechazada' } }) } : ok({ status: 'paid' });
  if (u.pathname === '/v1/invoices/in_1') return ok({ id: 'in_1', hosted_invoice_url: 'https://pay.stripe.test/in_1' });
  if (u.pathname === '/v1/setup_intents/seti_1') return ok({ payment_method: 'pm_1' });
  if (u.pathname === '/v1/customers/cus_1' && opt.method === 'POST') return ok({ id: 'cus_1' });
  return ok({});
};
const generados = [];
pipe.__setGenerate?.((cid, red) => generados.push([cid, red]));

const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());
async function login(email, password) {
  const r = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, password }) });
  return (r.headers.get('set-cookie') || '').split(';')[0];
}
const get = (u, cookie) => fetch(`${base}${u}`, { headers: { cookie }, redirect: 'manual' });
const post = (u, cookie, body) => fetch(`${base}${u}`, { method: 'POST', headers: { cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body), redirect: 'manual' });

test('cliente solo de chat: no ve publicaciones ni competencia', async () => {
  const ck = await login('ana@clinica.mx', 'ClaveAna2030!');
  const home = await (await get('/app', ck)).text();
  assert.ok(home.includes('href="/app/leads"') && home.includes('href="/app/citas"'));
  assert.ok(!home.includes('href="/app/posts"'), 'no aparece Publicaciones');
  assert.equal((await get('/app/posts', ck)).headers.get('location'), '/app', 'y si entra directo, lo regresa');
  assert.equal((await get('/app/extra?red=instagram', ck)).headers.get('location'), '/app');
  assert.match(home, /Domicilia tu tarjeta/, 'le pide domiciliar porque tiene plan');
  const admin = await login('', 'maestra-123');
  const page = await (await get(`/admin/clientes/${chatOnly.id}?tab=posts`, admin)).text();
  assert.ok(!page.includes('?tab=competencia') && !page.includes('?tab=posts"'), 'en el admin también se esconden');
});

test('el administrador guarda el plan desde la tarjeta', async () => {
  const admin = await login('', 'maestra-123');
  const r = await post(`/admin/clientes/${sabor.id}/plan`, admin, { servicio_redes: '1', servicio_chat: '1', posts_semana: '4', extra_gratis_mes: '1', precio_extra: '200', conceptos: 'Redes sociales | 2,999 | mensual\nArranque | 1500 | único' });
  assert.equal(r.status, 302);
  const p = plan.planDe(db.getClient(sabor.id));
  assert.equal(p.posts_semana, 4);
  assert.equal(p.precio_extra, 200);
  assert.deepEqual(p.servicios, { redes: true, chat: true, agenda: false, llamadas: false, blog: false, videollamadas: false });
  assert.deepEqual(p.conceptos, [{ nombre: 'Redes sociales', monto: 2999, tipo: 'mensual' }, { nombre: 'Arranque', monto: 1500, tipo: 'unico' }]);
  assert.equal(plan.mensualidad(db.getClient(sabor.id)), 2999);
  assert.equal((await post(`/admin/clientes/${sabor.id}/plan`, admin, { conceptos: 'Mal | abc' })).status, 400);
});

test('posts extra: el primero del mes es gratis, luego se cobra a la tarjeta', async () => {
  const ck = await login('luis@buensabor.mx', 'ClaveLuis2030!');
  const posts = await (await get('/app/posts', ck)).text();
  assert.match(posts, /de 4 publicaciones/);
  assert.match(posts, /Te queda <b>1 gratis<\/b>/);
  assert.match(posts, /\/app\/extra\?red=instagram/);
  assert.match(await (await get('/app/extra?red=instagram', ck)).text(), /Esta va gratis/);
  assert.equal((await post('/app/extra', ck, { red: 'instagram', monto: '0' })).headers.get('location'), '/app/posts?ok=extra');
  assert.equal(plan.extrasDelMes(sabor.id).length, 1);
  // segundo: cuesta y no hay tarjeta
  assert.match(await (await get('/app/extra?red=facebook', ck)).text(), /Cuesta \$200/);
  assert.equal((await post('/app/extra', ck, { red: 'facebook', monto: '0' })).status, 409, 'si el precio cambió, pide confirmar otra vez');
  assert.equal((await post('/app/extra', ck, { red: 'facebook', monto: '200' })).status, 402, 'sin tarjeta no cobra');
  // con tarjeta
  db.setBilling(sabor.id, { stripe_customer: 'cus_1', tarjeta: 'visa •••• 4242', estado: 'al_corriente' });
  assert.equal((await post('/app/extra', ck, { red: 'facebook', monto: '200' })).headers.get('location'), '/app/posts?ok=extra');
  const item = llamadas.find((l) => l.p === '/v1/invoiceitems');
  assert.equal(item.body.amount, '20000');
  assert.equal(item.body.currency, 'mxn');
  assert.ok(item.idem, 'cobro con llave de idempotencia (no cobra doble)');
  assert.deepEqual(plan.extrasDelMes(sabor.id).map((e) => e.estado), ['gratis', 'pagado']);
  pagoFalla = true;
  const r = await post('/app/extra', ck, { red: 'facebook', monto: '200' });
  assert.equal(r.status, 402);
  assert.match(await r.text(), /pay\.stripe\.test|No se pudo cobrar/);
  assert.equal(plan.extrasDelMes(sabor.id).length, 2, 'si el cobro falla no se crea el extra');
  pagoFalla = false;
});

test('domiciliar: Stripe Checkout con mensualidad y pago único', async () => {
  const ck = await login('ana@clinica.mx', 'ClaveAna2030!');
  const r = await post('/app/pagos/domiciliar', ck, {});
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('location'), 'https://checkout.stripe.test/s1');
  const s = llamadas.filter((l) => l.p === '/v1/checkout/sessions').at(-1).body;
  assert.equal(s.mode, 'subscription');
  assert.equal(s['line_items[0][price_data][unit_amount]'], '49900');
  assert.equal(s['line_items[0][price_data][recurring][interval]'], 'month');
  assert.equal(s['line_items[1][price_data][unit_amount]'], '549900');
  assert.equal(s['line_items[1][price_data][recurring][interval]'], undefined);
  assert.match(await (await get('/app/pagos', ck)).text(), /Agente IA/);
});

test('webhook de Stripe: firma y estados', async () => {
  const send = (ev, secret = 'whsec_test') => {
    const raw = JSON.stringify(ev), t = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
    return fetch(`${base}/webhooks/stripe`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${t},v1=${sig}` }, body: raw });
  };
  assert.equal((await send({ type: 'invoice.paid', data: { object: {} } }, 'otro')).status, 400, 'rechaza firmas falsas');
  await send({ type: 'checkout.session.completed', data: { object: { customer: 'cus_9', setup_intent: 'seti_1', metadata: { client_id: String(chatOnly.id) } } } });
  assert.equal(db.getBilling(chatOnly.id).estado, 'al_corriente');
  assert.equal(db.getBilling(chatOnly.id).stripe_customer, 'cus_9');
  await send({ type: 'invoice.payment_failed', data: { object: { customer: 'cus_9', amount_due: 49900 } } });
  assert.equal(db.getBilling(chatOnly.id).estado, 'pago_fallido');
  const ck = await login('ana@clinica.mx', 'ClaveAna2030!');
  assert.match(await (await get('/app', ck)).text(), /rechazó el último cobro/);
});

test('nueva marca solo con chat: sin redes activas ni posts automáticos', async () => {
  const admin = await login('', 'maestra-123');
  const r = await post('/admin/clientes/nuevo', admin, { nombre: 'Tacos Uno', slug: 'tacos-uno', servicio_chat: '1',
    perfil: JSON.stringify({ cliente: 'Tacos Uno', pilares_de_contenido: [{ nombre: 'x' }] }), config: JSON.stringify({ instagram: { activo: true, frecuencia: 'semanal' }, facebook: { activo: true, frecuencia: 'semanal' } }) });
  assert.equal(r.status, 302);
  const c = db.listClients().find((x) => x.slug === 'tacos-uno');
  assert.equal(c.config.instagram.activo, false);
  assert.equal(c.config.facebook.activo, false);
  assert.deepEqual(plan.planDe(c).servicios, { redes: false, chat: true, agenda: false, llamadas: false, blog: false, videollamadas: false });
  // aunque alguien active Instagram después, sin el servicio de redes no se generan posts
  db.updateClient(c.id, { config: { ...c.config, instagram: { activo: true, frecuencia: 'diario' } } });
  assert.ok(!pipe.generationCandidates().some((g) => g.client.id === c.id));
});

test('cortesía, pago por fuera y prueba gratis', async () => {
  const admin = await login('', 'maestra-123');
  const ck = await login('luis@buensabor.mx', 'ClaveLuis2030!');
  // cortesía: extras gratis aunque ya usó el del mes
  await post(`/admin/clientes/${sabor.id}/plan`, admin, { servicio_redes: '1', posts_semana: '4', extra_gratis_mes: '1', precio_extra: '200', conceptos: 'Redes | 2999 | mensual', cobro: 'cortesia' });
  assert.equal(plan.modoCobro(db.getClient(sabor.id)), 'cortesia');
  assert.equal(plan.costoExtra(db.getClient(sabor.id)).monto, 0);
  assert.match(await (await get('/app/pagos', ck)).text(), /cortesía de Kuper/);
  assert.doesNotMatch(await (await get('/app/pagos', ck)).text(), /Domiciliar mi tarjeta/);
  // pago por fuera: el extra queda "por cobrar", sin tocar Stripe
  await post(`/admin/clientes/${sabor.id}/plan`, admin, { servicio_redes: '1', posts_semana: '4', extra_gratis_mes: '1', precio_extra: '200', conceptos: 'Redes | 2999 | mensual', cobro: 'externo' });
  const antes = llamadas.length;
  assert.match(await (await get('/app/extra?red=instagram', ck)).text(), /se suma \$200 a tu pago/);
  assert.equal((await post('/app/extra', ck, { red: 'instagram', monto: '200' })).headers.get('location'), '/app/posts?ok=extra');
  assert.equal(plan.extrasDelMes(sabor.id).at(-1).estado, 'por_cobrar');
  assert.equal(llamadas.length, antes, 'no cobró en Stripe');
  // prueba gratis: el checkout pone el primer cobro al terminar la prueba
  const fin = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
  await post(`/admin/clientes/${chatOnly.id}/plan`, admin, { servicio_chat: '1', servicio_agenda: '1', conceptos: 'Agente IA | 499 | mensual', cobro: 'stripe', prueba_hasta: fin });
  assert.equal(plan.modoCobro(db.getClient(chatOnly.id)), 'prueba');
  db.setBilling(chatOnly.id, { subscription_id: null });
  const ana = await login('ana@clinica.mx', 'ClaveAna2030!');
  await post('/app/pagos/domiciliar', ana, {});
  const s = llamadas.filter((l) => l.p === '/v1/checkout/sessions').at(-1).body;
  assert.ok(Number(s['subscription_data[trial_end]']) > Date.now() / 1000 + 9 * 86400);
  assert.doesNotMatch(await (await get('/app', ana)).text(), /rechazó el último cobro/, 'en prueba no hay avisos de cobro');
});

test('IVA: desglose y opciones por cliente', () => {
  assert.deepEqual(plan.desglose(1000, 'mas'), { subtotal: 1000, iva: 160, total: 1160 });
  assert.deepEqual(plan.desglose(1160, 'incluido'), { subtotal: 1000, iva: 160, total: 1160 });
  assert.deepEqual(plan.desglose(500, 'exento'), { subtotal: 500, iva: 0, total: 500 });
  assert.equal(plan.ivaDe(db.getClient(sabor.id)), 'incluido', 'los clientes de antes no cambian de precio');
});

test('IVA "más IVA": Stripe recibe la tasa del 16 % en la mensualidad y en los extras', async () => {
  const admin = await login('', 'maestra-123');
  db.setBilling(chatOnly.id, { subscription_id: null });
  await post(`/admin/clientes/${chatOnly.id}/plan`, admin, { servicio_chat: '1', conceptos: 'Agente IA | 1000 | mensual', cobro: 'stripe', iva: 'mas' });
  const c = db.getClient(chatOnly.id);
  assert.equal(plan.ivaDe(c), 'mas');
  assert.equal(plan.mensualidadTotal(c), 1160);
  billing._resetTasas();
  const ana = await login('ana@clinica.mx', 'ClaveAna2030!');
  await post('/app/pagos/domiciliar', ana, {});
  const s = llamadas.filter((l) => l.p === '/v1/checkout/sessions').at(-1).body;
  assert.equal(s['line_items[0][price_data][unit_amount]'], '100000', 'el precio va sin IVA…');
  assert.equal(s['line_items[0][tax_rates][0]'], 'txr_mas', '…y Stripe le suma el IVA');
  const tasa = llamadas.filter((l) => l.p === '/v1/tax_rates' && l.m === 'POST').at(-1).body;
  assert.equal(tasa.percentage, '16'); assert.equal(tasa.inclusive, 'false'); assert.equal(tasa.display_name, 'IVA');
  const pagos = await (await get('/app/pagos', ana)).text();
  assert.match(pagos, /\$1,000 \+ IVA \$160 = \$1,160/);
  assert.match(pagos, /\$1,160 al mes/);
  // extra con IVA incluido: invoice item con la tasa "incluida"
  await post(`/admin/clientes/${sabor.id}/plan`, admin, { servicio_redes: '1', posts_semana: '3', extra_gratis_mes: '0', precio_extra: '150', cobro: 'stripe', iva: 'incluido' });
  db.setBilling(sabor.id, { stripe_customer: 'cus_1', tarjeta: 'visa •••• 4242', estado: 'al_corriente' });
  const luis = await login('luis@buensabor.mx', 'ClaveLuis2030!');
  assert.match(await (await get('/app/extra?red=instagram', luis)).text(), /Cuesta \$150/);
  await post('/app/extra', luis, { red: 'instagram', monto: '150' });
  const item = llamadas.filter((l) => l.p === '/v1/invoiceitems').at(-1).body;
  assert.equal(item.amount, '15000'); assert.equal(item['tax_rates[0]'], 'txr_inc');
  // sin IVA: no manda tasa
  await post(`/admin/clientes/${sabor.id}/plan`, admin, { servicio_redes: '1', posts_semana: '3', extra_gratis_mes: '0', precio_extra: '150', cobro: 'stripe', iva: 'exento' });
  await post('/app/extra', luis, { red: 'facebook', monto: '150' });
  assert.equal(llamadas.filter((l) => l.p === '/v1/invoiceitems').at(-1).body['tax_rates[0]'], undefined);
});

test('datos para factura: el cliente los captura y el admin los ve', async () => {
  const ana = await login('ana@clinica.mx', 'ClaveAna2030!');
  let r = await post('/app/pagos/fiscal', ana, { rfc: 'ABC12', razon_social: 'Clínica Sol', cp: '06600', regimen: '601' });
  assert.equal(r.status, 400); assert.match(await r.text(), /RFC no es válido/);
  r = await post('/app/pagos/fiscal', ana, { rfc: 'csl-010203-ab1', razon_social: 'Clínica Sol SA de CV', cp: '06600', regimen: '601', uso: 'G03', correo: 'conta@clinica.mx' });
  assert.equal(r.status, 303);
  const f = plan.fiscalDe(db.getClient(chatOnly.id));
  assert.equal(f.rfc, 'CSL010203AB1'); assert.equal(f.razon_social, 'CLÍNICA SOL SA DE CV');
  const cus = llamadas.filter((l) => /^\/v1\/customers\/cus_/.test(l.p) && l.m === 'POST').at(-1);
  assert.equal(cus.body['metadata[rfc]'], 'CSL010203AB1', 'el RFC también queda en Stripe');
  assert.match(await (await get('/app/pagos?fiscal=1', ana)).text(), /guardamos tus datos para la factura/);
  const admin = await login('', 'maestra-123');
  assert.match(await (await get(`/admin/clientes/${chatOnly.id}?tab=config`, admin)).text(), /RFC CSL010203AB1/);
});

test('el cliente deja una idea de tema desde su panel', async () => {
  const luis = await login('luis@buensabor.mx', 'ClaveLuis2030!');
  let r = await post('/app/temas', luis, { tema: 'Tacos al pastor 2x1 los martes', accion: 'cola' });
  assert.equal(r.headers.get('location'), '/app/posts?ok=tema');
  assert.equal(db.getClient(sabor.id).config.temas_pendientes[0].texto, 'Tacos al pastor 2x1 los martes');
  const pagina = await (await get('/app/posts?ok=tema', luis)).text();
  assert.match(pagina, /Ideas en espera \(1\)/); assert.match(pagina, /tu idea quedó en la lista/);
  r = await post('/app/temas', luis, { tema: 'Algo urgente', accion: 'extra' });
  assert.match(r.headers.get('location'), /^\/app\/extra\?red=\w+&tema=Algo%20urgente$/);
  assert.match(await (await get(r.headers.get('location'), luis)).text(), /Algo urgente<\/textarea>/);
  await post('/app/temas/0/quitar', luis, {});
  assert.equal(db.getClient(sabor.id).config.temas_pendientes.length, 0);
});
