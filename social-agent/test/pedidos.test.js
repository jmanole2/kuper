// Pedidos por chat: catálogo (a mano, CSV, Shopify), carrito del contacto con sugerencias, pedido con link de pago,
// estados y la API que usa el agente de WhatsApp.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'ped-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123', SCHEDULER: '0' });
const db = await import('../src/db.js');
const P = await import('../src/pedidos.js');
const cobros = await import('../src/pagos-clientes.js');
const V = await import('../src/web/views.js');
const { hashPassword } = await import('../src/crypto.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');

const c = db.createClient({ slug: 'burger', nombre: 'Burger Demo', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] },
  config: { plan: { servicios: { chat: true } }, cobros: { activo: true, proveedor: 'mercadopago', monto_max: 5000 },
    pedidos: { activo: true, envio: 40, minimo: 100, entrega: 'ambos', sugerencias: [{ si: 'Hamburguesas', ofrece: 'Papas' }, { si: 'Hamburguesas', ofrece: 'Bebidas' }] } },
  credentials: { api_key: 'llave-burger', cobros: { token: 'APP_USR-x' } } });
db.createUser({ email: 'dueno@burger.mx', nombre: 'Dueño', rol: 'cliente', client_id: c.id, password_hash: hashPassword('ClaveBurger2030') });
const cl = () => db.getClient(c.id);
const avisos = [];
P.hooks.aviso = async (client, b) => { avisos.push(b); return { ok: true }; };
const mp = [];
cobros.hooks.fetch = async (url, o) => { mp.push({ url, body: o?.body ? JSON.parse(o.body) : null }); return new Response(JSON.stringify({ id: 'pref-1', init_point: 'https://mp.test/pagar/1' }), { status: 200 }); };

test('catálogo: a mano y por CSV (actualiza por sku, reporta errores)', () => {
  const p = P.guardarProducto(cl(), { nombre: 'Clásica', precio: '$129', categoria: 'Hamburguesas', descripcion: 'Smash 140 g con queso' });
  assert.equal(p.precio, 129); assert.equal(p.disponible, true);
  const r = P.importarCSV(cl(), 'nombre,precio,categoria,disponible,sku\nDoble,169,Hamburguesas,sí,dob\nPapas francesas,59,Papas,si,pap\nRefresco,35,Bebidas,1,ref\nMalteada,79,Bebidas,no,mal\nSin precio,,Otros,,x');
  assert.equal(r.importados, 4); assert.equal(r.errores.length, 1); assert.match(r.errores[0], /Fila 6/);
  P.importarCSV(cl(), 'nombre,precio,categoria,sku\nDoble,175,Hamburguesas,dob');
  assert.equal(P.productos(c.id).find((x) => x.sku === 'dob').precio, 175, 'mismo sku: actualiza el precio');
  assert.equal(P.productos(c.id).some((x) => x.nombre === 'Malteada'), false, 'agotado no se ofrece');
  assert.equal(P.productos(c.id, { todos: true }).some((x) => x.nombre === 'Malteada'), true);
  assert.throws(() => P.guardarProducto(cl(), { nombre: 'x', precio: 'abc' }), /precio/);
});

test('búsqueda sin acentos y por categoría', () => {
  assert.equal(P.buscar(cl(), { q: 'papas' })[0].nombre, 'Papas francesas');
  assert.equal(P.buscar(cl(), { q: 'clasica' })[0].nombre, 'Clásica');
  assert.deepEqual(P.buscar(cl(), { categoria: 'hamburguesas' }).map((x) => x.nombre).sort(), ['Clásica', 'Doble']);
  assert.deepEqual(P.categorias(c.id), ['Bebidas', 'Hamburguesas', 'Papas']);
});

test('carrito: agregar por nombre, sugerencias por categoría, quitar, ambigüedad y agotados', () => {
  const tel = '5512345678';
  let r = P.carrito(cl(), { telefono: tel, producto: 'clasica', cantidad: 2, nota: 'sin cebolla' });
  assert.equal(r.subtotal, 258); assert.equal(r.items[0].nota, 'sin cebolla');
  assert.deepEqual(r.sugerencias.map((s) => s.categoria), ['Papas', 'Bebidas']);
  assert.equal(r.sugerencias[0].productos[0].nombre, 'Papas francesas');
  r = P.carrito(cl(), { telefono: tel, producto: 'papas', cantidad: 1 });
  assert.deepEqual(r.sugerencias.map((s) => s.categoria), ['Bebidas'], 'ya tiene papas: solo ofrece bebida');
  r = P.carrito(cl(), { telefono: tel, producto: 'hamburguesa' });
  assert.equal(r.error, 'varios'); assert.equal(r.opciones.length, 2, 'Clásica o Doble: pregunta cuál');
  const mal = P.productos(c.id, { todos: true }).find((x) => x.nombre === 'Malteada');
  r = P.carrito(cl(), { telefono: tel, producto: String(mal.id) });
  assert.equal(r.error, 'agotado');
  r = P.carrito(cl(), { telefono: tel, accion: 'quitar', producto: 'clasica', cantidad: 1 });
  assert.equal(r.items.find((i) => i.nombre === 'Clásica').cantidad, 1);
  assert.equal(r.subtotal, 129 + 59);
  assert.equal(P.verCarrito(cl(), '+52 55 1234 5678').subtotal, 188, 'mismo contacto con o sin lada');
  assert.throws(() => P.carrito(cl(), { telefono: '', producto: 'papas' }), /teléfono/);
});

test('confirmar: pide dirección a domicilio, respeta mínimo, crea pedido, link de pago y aviso', async () => {
  const tel = '5512345678';
  await assert.rejects(P.confirmar(cl(), { telefono: tel, entrega: 'domicilio', direccion: '' }), /dirección/);
  await assert.rejects(P.confirmar(cl(), { telefono: '5599990000', entrega: 'recoger' }), /vacío/);
  P.carrito(cl(), { telefono: '5599990000', producto: 'refresco' });
  await assert.rejects(P.confirmar(cl(), { telefono: '5599990000', entrega: 'recoger' }), /mínimo/);
  const r = await P.confirmar(cl(), { telefono: tel, nombre: 'Ana', entrega: 'domicilio', direccion: 'Liverpool 179, Juárez', notas: 'tocar timbre' });
  assert.equal(r.pedido.numero, 1); assert.equal(r.pedido.subtotal, 188); assert.equal(r.pedido.envio, 40); assert.equal(r.pedido.total, 228);
  assert.equal(r.pago_url, 'https://mp.test/pagar/1');
  assert.equal(mp.at(-1).body.items[0].unit_price, 228); assert.match(mp.at(-1).body.items[0].title, /Pedido #1/);
  assert.match(avisos.at(-1).titulo, /Pedido nuevo #1/); assert.match(avisos.at(-1).texto, /1 × Clásica \(sin cebolla\)/); assert.match(avisos.at(-1).texto, /Liverpool 179/);
  assert.equal(P.verCarrito(cl(), tel).items.length, 0, 'el carrito se vacía');
  assert.ok(r.pedido.lead_id); assert.equal(db.getLead(c.id, r.pedido.lead_id).nombre, 'Ana');
});

test('estados: pagado al pagarse el link, cambios manuales y validación', () => {
  const [p] = P.listar(c.id);
  assert.equal(p.estado, 'nuevo');
  db.getDb().prepare("UPDATE cobros SET status = 'pagado' WHERE ref = ?").run(p.cobro_ref);
  assert.equal(P.sincronizarPagos(cl()).pagados, 1);
  assert.equal(P.obtener(c.id, p.id).estado, 'pagado');
  assert.equal(P.cambiarEstado(cl(), p.id, 'preparacion').estado, 'preparacion');
  assert.throws(() => P.cambiarEstado(cl(), p.id, 'volando'), /no válido/);
  assert.equal(P.resumenPedidos(c.id).vendido, 228);
});

test('Shopify: importa productos públicos (precio mínimo, variantes disponibles) y no abre direcciones privadas', async () => {
  P.hooks.lookup = async (h) => [{ address: h === 'interna.test' ? '10.0.0.5' : '93.184.216.34' }];
  const pagina = { products: [
    { id: 11, title: 'Playera Aventura', product_type: 'Playeras', body_html: '<p>Algodón <b>orgánico</b></p>', images: [{ src: 'https://cdn.shopify.test/p.jpg' }],
      variants: [{ title: 'M', price: '649.00', available: true }, { title: 'L', price: '699.00', available: true }, { title: 'XL', price: '699.00', available: false }] },
    { id: 12, title: 'Gorra agotada', product_type: 'Gorras', variants: [{ title: 'Default Title', price: '799.00', available: false }] },
  ] };
  P.hooks.fetch = async (u) => (String(u).includes('page=1') ? new Response(JSON.stringify(pagina), { status: 200 }) : new Response(JSON.stringify({ products: [] }), { status: 200 }));
  const r = await P.importarShopify(cl(), 'tienda.test');
  assert.equal(r.importados, 2);
  const pl = P.productos(c.id, { todos: true }).find((x) => x.sku === 'shopify-11');
  assert.equal(pl.precio, 649); assert.equal(pl.categoria, 'Playeras'); assert.match(pl.descripcion, /Opciones disponibles: M, L/); assert.doesNotMatch(pl.descripcion, /XL/);
  assert.match(pl.descripcion, /Algodón orgánico/); assert.equal(pl.foto, 'https://cdn.shopify.test/p.jpg');
  assert.equal(P.productos(c.id, { todos: true }).find((x) => x.sku === 'shopify-12').disponible, false);
  await assert.rejects(P.importarShopify(cl(), 'interna.test'), /no se puede abrir/);
  P.hooks.fetch = async () => new Response('<html>no</html>', { status: 200 });
  await assert.rejects(P.importarShopify(cl(), 'otra.test'), /no publica su catálogo/);
});

test('API del agente: catálogo, carrito, pedido y su estado; sin llave no entra', async () => {
  const srv = createApp().listen(0); const base = `http://127.0.0.1:${srv.address().port}`;
  const H = { Authorization: 'Bearer llave-burger', 'Content-Type': 'application/json' };
  try {
    assert.equal((await fetch(`${base}/api/burger/catalogo`)).status, 401);
    const cat = await (await fetch(`${base}/api/burger/catalogo?q=doble`, { headers: H })).json();
    assert.equal(cat.activo, true); assert.equal(cat.productos[0].nombre, 'Doble');
    let r = await (await fetch(`${base}/api/burger/carrito`, { method: 'POST', headers: H, body: JSON.stringify({ telefono: '5511110000', producto: 'doble', cantidad: 1 }) })).json();
    assert.equal(r.subtotal, 175); assert.ok(r.sugerencias.length);
    r = await (await fetch(`${base}/api/burger/carrito?telefono=5511110000`, { headers: H })).json();
    assert.equal(r.items[0].nombre, 'Doble');
    const bad = await fetch(`${base}/api/burger/pedidos`, { method: 'POST', headers: H, body: JSON.stringify({ telefono: '5511110000', entrega: 'domicilio' }) });
    assert.equal(bad.status, 400); assert.match((await bad.json()).error, /dirección/);
    const ok = await (await fetch(`${base}/api/burger/pedidos`, { method: 'POST', headers: H, body: JSON.stringify({ telefono: '5511110000', nombre: 'Luis', entrega: 'recoger' }) })).json();
    assert.ok(ok.ok); assert.equal(ok.numero, 2); assert.equal(ok.total, 175); assert.equal(ok.envio, 0); assert.equal(ok.pago_url, 'https://mp.test/pagar/1');
    const mios = await (await fetch(`${base}/api/burger/pedidos?telefono=+525511110000`, { headers: H })).json();
    assert.equal(mios.pedidos[0].numero, 2); assert.equal(mios.pedidos[0].estado, 'Nuevo');

    // Panel del cliente: ve sus pedidos y cambia el estado.
    const login = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: base }, body: new URLSearchParams({ email: 'dueno@burger.mx', password: 'ClaveBurger2030' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const h = await (await fetch(`${base}/app/pedidos`, { headers: { Cookie: cookie } })).text();
    assert.match(h, /#2/); assert.match(h, /Luis/); assert.match(h, /1 × Doble/);
    const pid = P.listar(c.id).find((p) => p.numero === 2).id;
    const cambio = await fetch(`${base}/app/pedidos/${pid}/estado`, { method: 'POST', redirect: 'manual', headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded', Origin: base }, body: new URLSearchParams({ estado: 'cancelado' }) });
    assert.equal(cambio.status, 302); assert.equal(P.obtener(c.id, pid).estado, 'cancelado');
    const cat2 = await (await fetch(`${base}/app/pedidos/catalogo`, { headers: { Cookie: cookie } })).text();
    assert.match(cat2, /Playera Aventura/); assert.match(cat2, /Hamburguesas -&gt; Papas|Hamburguesas -> Papas/);
    const aj = await fetch(`${base}/app/pedidos/ajustes`, { method: 'POST', redirect: 'manual', headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded', Origin: base },
      body: new URLSearchParams({ activo: '1', envio: '50', minimo: '0', entrega: 'recoger', sugerencias: 'Playeras -> Gorras\nlinea mala' }) });
    assert.equal(aj.status, 302);
    assert.deepEqual(P.ajustes(cl()).sugerencias, [{ si: 'Playeras', ofrece: 'Gorras' }]); assert.equal(P.ajustes(cl()).entrega, 'recoger');
  } finally { srv.close(); }
});

test('fuente externa: Google Sheets (CSV) se copia al panel, existencias 0 = agotado y lo descontinuado se quita', async () => {
  assert.equal(P.urlDeHoja('https://docs.google.com/spreadsheets/d/AbC-123/edit#gid=456'), 'https://docs.google.com/spreadsheets/d/AbC-123/export?format=csv&gid=456');
  P.hooks.lookup = async () => [{ address: '142.250.1.1' }];
  const pedidas = [];
  let csv = 'Producto,Precio,Linea,Existencia,Clave\nCombo Familiar,399,Combos,10,CF1\nCombo Pareja,249,Combos,0,CP1\n';
  P.hooks.fetch = async (u, o) => { pedidas.push({ url: String(u), headers: o.headers }); return new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv' } }); };
  db.updateClient(c.id, { config: { ...cl().config, pedidos: { ...cl().config.pedidos, fuente: { tipo: 'archivo', url: 'https://docs.google.com/spreadsheets/d/AbC-123/edit#gid=456', cada_min: 15 } } } });
  const manual = P.guardarProducto(cl(), { nombre: 'Salsa extra', precio: 15, categoria: 'Extras' });
  const r = await P.sincronizarFuente(cl());
  assert.equal(r.productos, 2); assert.match(pedidas[0].url, /export\?format=csv&gid=456/);
  const cf = P.productos(c.id, { todos: true }).find((x) => x.nombre === 'Combo Familiar');
  assert.equal(cf.precio, 399); assert.equal(cf.categoria, 'Combos'); assert.equal(cf.sku, 'archivo:CF1'); assert.equal(cf.disponible, true);
  assert.equal(P.productos(c.id, { todos: true }).find((x) => x.nombre === 'Combo Pareja').disponible, false, 'existencia 0');
  csv = 'Producto,Precio,Linea,Existencia,Clave\nCombo Familiar,419,Combos,3,CF1\n';
  const r2 = await P.sincronizarFuente(cl());
  assert.equal(r2.quitados, 1);
  assert.equal(P.productos(c.id, { todos: true }).find((x) => x.nombre === 'Combo Familiar').precio, 419, 'precio actualizado');
  assert.ok(!P.productos(c.id, { todos: true }).some((x) => x.nombre === 'Combo Pareja'), 'descontinuado');
  assert.ok(P.producto(c.id, manual.id), 'lo cargado a mano se queda');
  assert.equal(P.estadoFuente(c.id).ok, true);
  assert.equal(P.tocaSincronizar(cl(), Date.now() + 60_000), false); assert.equal(P.tocaSincronizar(cl(), Date.now() + 16 * 60_000), true);
  csv = '<html>Inicia sesión</html>';
  await assert.rejects(P.sincronizarFuente(cl()), /Cualquier persona con el link/);
  assert.equal(P.estadoFuente(c.id).ok, false);
});

test('fuente externa: API tipo Odoo con llave (campos [id, nombre]), la llave no se manda si redirige a otro dominio', async () => {
  const pedidas = [];
  P.hooks.fetch = async (u, o) => {
    pedidas.push({ url: String(u), headers: o.headers });
    if (String(u).startsWith('https://erp.test/')) return new Response(null, { status: 302, headers: { Location: 'https://cdn.test/productos.json' } });
    return new Response(JSON.stringify({ jsonrpc: '2.0', result: { records: [
      { display_name: 'Torta Cubana', list_price: 95, categ_id: [3, 'Tortas'], qty_available: 12, default_code: 'TC', description_sale: '<p>Con <b>todo</b></p>' },
      { display_name: 'Torta Ahogada', list_price: 89, categ_id: [3, 'Tortas'], qty_available: 0, default_code: 'TA' }] } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  db.updateClient(c.id, { config: { ...cl().config, pedidos: { ...cl().config.pedidos, fuente: { tipo: 'api', url: 'https://erp.test/api/productos', header: 'Authorization', cada_min: 5 } } }, credentials: { ...db.clientCredentials(cl()), pedidos: { token: 'tok-secreto' } } });
  const r = await P.sincronizarFuente(cl());
  assert.equal(r.productos, 2);
  assert.equal(pedidas[0].headers.Authorization, 'Bearer tok-secreto');
  assert.equal(pedidas[1].headers.Authorization, undefined, 'no reenvía la llave a otro dominio');
  const t = P.productos(c.id, { todos: true }).find((x) => x.nombre === 'Torta Cubana');
  assert.equal(t.categoria, 'Tortas'); assert.equal(t.precio, 95); assert.equal(t.descripcion, 'Con todo'); assert.equal(t.sku, 'api:TC');
  assert.equal(P.productos(c.id, { todos: true }).find((x) => x.nombre === 'Torta Ahogada').disponible, false);
  assert.ok(!P.productos(c.id, { todos: true }).some((x) => x.sku.startsWith('archivo:')), 'lo de la fuente anterior se quita');
  assert.ok(P.productos(c.id, { todos: true }).some((x) => x.nombre === 'Playera Aventura'), 'lo importado una vez de Shopify se queda');
  P.hooks.fetch = async () => new Response('{}', { status: 401 });
  await assert.rejects(P.sincronizarFuente(cl()), /rechazó la llave/);
});

test('pedido de regreso al sistema del cliente: webhook firmado con HMAC en pedido nuevo y cambio de estado', async () => {
  const crypto = await import('node:crypto');
  db.updateClient(c.id, { config: { ...cl().config, pedidos: { ...cl().config.pedidos, activo: true, entrega: 'ambos', minimo: 0, webhook: 'https://erp.test/webhooks/pedidos' } },
    credentials: { ...db.clientCredentials(cl()), pedidos: { ...db.clientCredentials(cl()).pedidos, webhook_secret: 'firma-123' } } });
  const enviados = [];
  P.hooks.fetch = async (u, o) => { enviados.push({ url: String(u), headers: o.headers, body: o.body }); return new Response('{}', { status: 200 }); };
  P.carrito(cl(), { telefono: '5544443333', producto: 'torta cubana', cantidad: 2 });
  const r = await P.confirmar(cl(), { telefono: '5544443333', nombre: 'Mar', entrega: 'recoger' });
  await new Promise((s) => setTimeout(s, 20));
  const w = enviados.find((e) => e.url === 'https://erp.test/webhooks/pedidos');
  assert.ok(w, 'se mandó al sistema');
  assert.equal(w.headers['X-Kuper-Evento'], 'pedido_nuevo');
  assert.equal(w.headers['X-Kuper-Firma'], crypto.createHmac('sha256', 'firma-123').update(w.body).digest('hex'));
  const b = JSON.parse(w.body);
  assert.equal(b.pedido.numero, r.pedido.numero); assert.equal(b.pedido.items[0].sku, 'TC'); assert.equal(b.pedido.items[0].cantidad, 2); assert.equal(b.pedido.total, 190);
  P.cambiarEstado(cl(), r.pedido.id, 'entregado');
  await new Promise((s) => setTimeout(s, 20));
  assert.equal(enviados.at(-1).headers['X-Kuper-Evento'], 'pedido_estado'); assert.equal(JSON.parse(enviados.at(-1).body).pedido.estado, 'entregado');
});

test('panel: guardar la fuente conecta y guarda la llave cifrada sin mostrarla', async () => {
  const srv = createApp().listen(0); const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    P.hooks.fetch = async () => new Response('nombre,precio\nTaco,25\n', { status: 200, headers: { 'Content-Type': 'text/csv' } });
    const login = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: base }, body: new URLSearchParams({ email: 'dueno@burger.mx', password: 'ClaveBurger2030' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const r = await fetch(`${base}/app/pedidos/fuente`, { method: 'POST', redirect: 'manual', headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded', Origin: base },
      body: new URLSearchParams({ tipo: 'archivo', url: 'https://mi-erp.test/export.csv', token: 'NO-MOSTRAR', cada_min: '30', webhook: 'https://mi-erp.test/hook' }) });
    assert.equal(r.status, 302); assert.match(decodeURIComponent(r.headers.get('location')), /Conectado: 1 productos/);
    assert.equal(P.fuenteDe(cl()).cada_min, 30); assert.equal(db.clientCredentials(cl()).pedidos.token, 'NO-MOSTRAR');
    const h = await (await fetch(`${base}/app/pedidos/catalogo`, { headers: { Cookie: cookie } })).text();
    assert.doesNotMatch(h, /NO-MOSTRAR/); assert.match(h, /ya guardada/); assert.match(h, /X-Kuper-Firma/); assert.match(h, /Taco/);
    assert.equal(P.ajustes(cl()).activo, true, 'guardar la fuente no apaga los pedidos');
  } finally { srv.close(); }
});

test('con los pedidos apagados el agente no puede armar carritos', () => {
  db.updateClient(c.id, { config: { ...cl().config, pedidos: { ...cl().config.pedidos, activo: false } } });
  assert.throws(() => P.carrito(cl(), { telefono: '5512345678', producto: 'papas' }), /no están activos/);
  const html = V.pedidosPage(cl(), { lista: [], resumen: {}, aj: P.ajustes(cl()), base: '/app', app: true });
  assert.match(String(html), /están apagados/);
});
