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

test('con los pedidos apagados el agente no puede armar carritos', () => {
  db.updateClient(c.id, { config: { ...cl().config, pedidos: { ...cl().config.pedidos, activo: false } } });
  assert.throws(() => P.carrito(cl(), { telefono: '5512345678', producto: 'papas' }), /no están activos/);
  const html = V.pedidosPage(cl(), { lista: [], resumen: {}, aj: P.ajustes(cl()), base: '/app', app: true });
  assert.match(String(html), /están apagados/);
});
