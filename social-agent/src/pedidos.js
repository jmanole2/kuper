// Pedidos por chat con catálogo: el agente de WhatsApp busca productos del catálogo de la marca, arma el carrito
// de cada contacto (agregar/quitar, total), sugiere complementos ("¿le agrego unas papas?") y, al confirmar, crea
// el pedido en el panel, manda el link de pago (Cobros por chat) y avisa al equipo.
//
// client.config.pedidos = { activo, envio, minimo, entrega: 'ambos'|'domicilio'|'recoger', sugerencias: [{ si, ofrece }] }
//   sugerencias: "si en el carrito hay algo de la categoría `si` y nada de `ofrece`, sugiere algo de `ofrece`".
import * as db from './db.js';
import * as cobros from './pagos-clientes.js';
import * as avisosAgente from './avisos-agente.js';
import { parseCSV } from './importar.js';
import { normalizarUrl } from './sitioweb.js';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

export const hooks = { fetch: (...a) => fetch(...a), lookup: (h) => lookup(h, { all: true }), aviso: (...a) => avisosAgente.recibir(...a) }; // pruebas
export const ESTADOS = { nuevo: 'Nuevo', pagado: 'Pagado', preparacion: 'En preparación', entregado: 'Entregado', cancelado: 'Cancelado' };
export const ajustes = (client) => ({ activo: false, envio: 0, minimo: 0, entrega: 'ambos', sugerencias: [], ...(client?.config?.pedidos || {}) });
const MAX_ITEMS = 30, MAX_CANT = 50;

let tablas = false;
const d = () => {
  if (!tablas) {
    tablas = true;
    db.getDb().exec(`CREATE TABLE IF NOT EXISTS catalogo (
      id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, sku TEXT NOT NULL, nombre TEXT NOT NULL,
      descripcion TEXT, precio REAL NOT NULL, categoria TEXT, foto TEXT, disponible INTEGER NOT NULL DEFAULT 1, origen TEXT NOT NULL DEFAULT 'panel',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE UNIQUE INDEX IF NOT EXISTS catalogo_sku ON catalogo(client_id, sku);
    CREATE TABLE IF NOT EXISTS carritos_chat (
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, telefono TEXT NOT NULL, items TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (client_id, telefono));
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, numero INTEGER NOT NULL, lead_id INTEGER,
      telefono TEXT, nombre TEXT, items TEXT NOT NULL, subtotal REAL NOT NULL, envio REAL NOT NULL DEFAULT 0, total REAL NOT NULL,
      entrega TEXT, direccion TEXT, notas TEXT, estado TEXT NOT NULL DEFAULT 'nuevo', cobro_ref TEXT, pago_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS pedidos_cliente ON pedidos(client_id, created_at);`);
  }
  return db.getDb();
};

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const tel = (t) => { const x = String(t || '').replace(/\D/g, ''); return x.length === 10 ? `52${x}` : x.length >= 11 && x.length <= 15 ? x : ''; };
const precio = (v) => Math.round(Number(String(v ?? '').replace(/[$,\s]/g, '')) * 100) / 100;
const dinero = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const fila = (p) => ({ id: p.id, sku: p.sku, nombre: p.nombre, descripcion: p.descripcion || '', precio: p.precio, categoria: p.categoria || '', foto: p.foto || '', disponible: !!p.disponible });

// ------------------------------------------------------------ catálogo
export function productos(clientId, { todos = false } = {}) {
  return d().prepare(`SELECT * FROM catalogo WHERE client_id = ? ${todos ? '' : 'AND disponible = 1'} ORDER BY categoria, nombre`).all(clientId).map(fila);
}
export const producto = (clientId, id) => { const p = d().prepare('SELECT * FROM catalogo WHERE client_id = ? AND id = ?').get(clientId, Number(id)); return p ? fila(p) : null; };
export const categorias = (clientId) => d().prepare("SELECT DISTINCT categoria FROM catalogo WHERE client_id = ? AND disponible = 1 AND categoria IS NOT NULL AND categoria <> '' ORDER BY categoria").all(clientId).map((r) => r.categoria);

/** Crea o actualiza un producto (por id o por sku). */
export function guardarProducto(client, p) {
  const nombre = String(p.nombre || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const pr = precio(p.precio);
  if (!nombre) throw new Error('Falta el nombre del producto.');
  if (String(p.precio ?? '').trim() === '' || !(pr >= 0) || !Number.isFinite(pr)) throw new Error(`El precio de "${nombre}" no es válido.`);
  const sku = String(p.sku || '').trim().slice(0, 80) || `p-${norm(nombre).replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`;
  const foto = /^https:\/\//.test(String(p.foto || '')) ? String(p.foto).slice(0, 600) : null;
  const disp = p.disponible === undefined || p.disponible === null || p.disponible === '' ? 1 : /^(1|si|sí|true|yes|disponible)$/i.test(String(p.disponible).trim()) || p.disponible === true ? 1 : 0;
  const vals = [nombre, String(p.descripcion || '').slice(0, 600) || null, pr, String(p.categoria || '').trim().slice(0, 60) || null, foto, disp, String(p.origen || 'panel').slice(0, 20)];
  if (p.id) {
    const r = d().prepare("UPDATE catalogo SET nombre = ?, descripcion = ?, precio = ?, categoria = ?, foto = ?, disponible = ?, origen = ?, updated_at = datetime('now') WHERE client_id = ? AND id = ?").run(...vals, client.id, Number(p.id));
    if (!r.changes) throw new Error('Ese producto no existe.');
    return producto(client.id, p.id);
  }
  d().prepare(`INSERT INTO catalogo (client_id, sku, nombre, descripcion, precio, categoria, foto, disponible, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(client_id, sku) DO UPDATE SET nombre = excluded.nombre, descripcion = excluded.descripcion, precio = excluded.precio, categoria = excluded.categoria,
    foto = excluded.foto, disponible = excluded.disponible, origen = excluded.origen, updated_at = datetime('now')`).run(client.id, sku, ...vals);
  return fila(d().prepare('SELECT * FROM catalogo WHERE client_id = ? AND sku = ?').get(client.id, sku));
}
export const borrarProducto = (client, id) => d().prepare('DELETE FROM catalogo WHERE client_id = ? AND id = ?').run(client.id, Number(id)).changes > 0;
export const disponible = (client, id, si) => d().prepare("UPDATE catalogo SET disponible = ?, updated_at = datetime('now') WHERE client_id = ? AND id = ?").run(si ? 1 : 0, client.id, Number(id)).changes > 0;

/** CSV con columnas nombre, precio y opcionales categoria, descripcion, foto, disponible, sku (también en inglés). */
export function importarCSV(client, texto) {
  const filas = parseCSV(texto);
  if (!filas.length) throw new Error('El archivo está vacío o no tiene encabezados.');
  const col = (f, ...nombres) => { for (const n of nombres) { const k = Object.keys(f).find((x) => norm(x) === n); if (k && f[k] !== '') return f[k]; } return ''; };
  let ok = 0; const errores = [];
  for (const [i, f] of filas.slice(0, 2000).entries()) {
    try {
      guardarProducto(client, { nombre: col(f, 'nombre', 'producto', 'name', 'title'), precio: col(f, 'precio', 'price'), categoria: col(f, 'categoria', 'category', 'type'),
        descripcion: col(f, 'descripcion', 'description'), foto: col(f, 'foto', 'imagen', 'image', 'image src'), disponible: col(f, 'disponible', 'available'), sku: col(f, 'sku', 'clave', 'id'), origen: 'csv' });
      ok++;
    } catch (e) { if (errores.length < 10) errores.push(`Fila ${i + 2}: ${e.message}`); }
  }
  db.logEvent({ clientId: client.id, tipo: 'catalogo_importado', detalle: `CSV: ${ok} productos` });
  return { importados: ok, errores };
}

// Shopify publica su catálogo en /products.json (sin llaves). Se lee con cuidado: solo direcciones públicas.
const privada = (ip) => {
  if (isIP(ip) === 6) { const x = ip.toLowerCase(); if (x.startsWith('::ffff:')) return privada(x.slice(7)); return x === '::1' || x === '::' || /^f[cd]/.test(x) || /^fe[89ab]/.test(x); }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
};
async function jsonPublico(u) {
  for (let i = 0; i < 3; i++) {
    const ips = isIP(u.hostname) ? [{ address: u.hostname }] : await hooks.lookup(u.hostname);
    if (!ips.length || ips.some((x) => privada(x.address)) || /^(localhost|.*\.local|.*\.internal)$/i.test(u.hostname)) throw new Error('Esa dirección no se puede abrir.');
    const r = await hooks.fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; KuperPanel/1.0)' } });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { u = new URL(r.headers.get('location'), u); if (u.protocol !== 'https:') throw new Error('Esa dirección no se puede abrir.'); continue; }
    if (!r.ok) throw new Error(r.status === 404 ? 'Esa tienda no publica su catálogo (¿es Shopify?).' : `La tienda respondió ${r.status}.`);
    const t = await r.text();
    if (t.length > 8_000_000) throw new Error('El catálogo es demasiado grande.');
    try { return JSON.parse(t); } catch { throw new Error('Esa tienda no publica su catálogo (¿es Shopify?).'); }
  }
  throw new Error('Demasiadas redirecciones.');
}
const sinHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** Importa los productos de una tienda Shopify (hasta 1,000). Un producto por modelo; las variantes van en la descripción. */
export async function importarShopify(client, dominio) {
  const base = normalizarUrl(dominio);
  if (!base) throw new Error('Escribe la dirección de la tienda, ej. mitienda.com');
  let ok = 0;
  for (let page = 1; page <= 4; page++) {
    const u = new URL(`/products.json?limit=250&page=${page}`, `https://${base.hostname}`);
    const j = await jsonPublico(u);
    const lista = Array.isArray(j?.products) ? j.products : null;
    if (!lista) throw new Error('Esa tienda no publica su catálogo (¿es Shopify?).');
    for (const p of lista) {
      const vs = Array.isArray(p.variants) ? p.variants : [];
      const disponibles = vs.filter((v) => v.available !== false);
      const precios = (disponibles.length ? disponibles : vs).map((v) => Number(v.price)).filter((n) => n > 0);
      if (!precios.length) continue;
      const opciones = disponibles.map((v) => v.title).filter((t) => t && t !== 'Default Title');
      const desc = [opciones.length ? `Opciones disponibles: ${opciones.slice(0, 25).join(', ')}` : '', sinHtml(p.body_html).slice(0, 300)].filter(Boolean).join('. ');
      try {
        guardarProducto(client, { sku: `shopify-${p.id}`, nombre: p.title, precio: Math.min(...precios), categoria: p.product_type || (Array.isArray(p.tags) ? p.tags[0] : String(p.tags || '').split(',')[0]) || '',
          descripcion: `${Math.min(...precios) !== Math.max(...precios) ? `Desde ${dinero(Math.min(...precios))}. ` : ''}${desc}`, foto: p.images?.[0]?.src || '', disponible: disponibles.length > 0, origen: 'shopify' });
        ok++;
      } catch { /* producto incompleto */ }
    }
    if (lista.length < 250) break;
  }
  db.logEvent({ clientId: client.id, tipo: 'catalogo_importado', detalle: `Shopify ${base.hostname}: ${ok} productos` });
  return { importados: ok, tienda: base.hostname };
}

/** Búsqueda para el agente: por nombre, categoría o descripción (sin acentos). Solo disponibles. */
export function buscar(client, { q = '', categoria = '', limite = 12 } = {}) {
  const lista = productos(client.id);
  const cat = norm(categoria);
  const palabras = norm(q).split(' ').filter((w) => w.length > 1);
  const puntos = (p) => {
    if (cat && !norm(p.categoria).includes(cat)) return -1;
    if (!palabras.length) return 1;
    const n = norm(p.nombre), c = norm(p.categoria), t = norm(p.descripcion);
    return palabras.reduce((s, w) => s + (n.includes(w) ? 3 : c.includes(w) ? 2 : t.includes(w) ? 1 : 0), 0);
  };
  return lista.map((p) => [puntos(p), p]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, Math.min(30, limite)).map(([, p]) => p);
}

// ------------------------------------------------------------ carrito de cada contacto
function cargar(client, t) {
  const r = d().prepare('SELECT items FROM carritos_chat WHERE client_id = ? AND telefono = ?').get(client.id, t);
  try { return r ? JSON.parse(r.items) : []; } catch { return []; }
}
const guardar = (client, t, items) => d().prepare(`INSERT INTO carritos_chat (client_id, telefono, items, updated_at) VALUES (?, ?, ?, datetime('now'))
  ON CONFLICT(client_id, telefono) DO UPDATE SET items = excluded.items, updated_at = datetime('now')`).run(client.id, t, JSON.stringify(items));

/** Encuentra UN producto por id o por nombre; si hay varios parecidos, devuelve las opciones. */
function resolver(client, ref) {
  if (/^\d+$/.test(String(ref ?? '').trim())) { const p = producto(client.id, ref); if (p) return { p }; }
  const n = norm(ref);
  const lista = productos(client.id);
  const exacto = lista.find((p) => norm(p.nombre) === n || norm(p.sku) === n);
  if (exacto) return { p: exacto };
  const parecidos = buscar(client, { q: ref, limite: 5 });
  if (parecidos.length === 1) return { p: parecidos[0] };
  return { opciones: parecidos };
}

function sugerencias(client, items) {
  const reglas = (ajustes(client).sugerencias || []).filter((r) => r?.si && r?.ofrece);
  if (!reglas.length || !items.length) return [];
  const enCarrito = new Set(items.map((i) => norm(i.categoria)));
  const out = [];
  for (const r of reglas) {
    if (![...enCarrito].some((c) => c.includes(norm(r.si))) || [...enCarrito].some((c) => c.includes(norm(r.ofrece)))) continue;
    const ps = buscar(client, { categoria: r.ofrece, limite: 3 });
    if (ps.length) out.push({ categoria: r.ofrece, productos: ps.map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio })) });
  }
  return out.slice(0, 2);
}

function resumen(client, items) {
  const aj = ajustes(client);
  const subtotal = Math.round(items.reduce((s, i) => s + i.precio * i.cantidad, 0) * 100) / 100;
  return { items: items.map(({ id, nombre, precio: pr, cantidad, nota, categoria }) => ({ id, nombre, precio: pr, cantidad, nota: nota || '', categoria: categoria || '', importe: Math.round(pr * cantidad * 100) / 100 })),
    subtotal, envio_domicilio: Number(aj.envio) || 0, minimo: Number(aj.minimo) || 0, entrega: aj.entrega, sugerencias: sugerencias(client, items) };
}

export function verCarrito(client, telefono) {
  const t = tel(telefono);
  if (!t) throw new Error('Falta el teléfono del contacto.');
  return resumen(client, cargar(client, t));
}

/** accion: agregar | quitar | vaciar. producto: id o nombre. cantidad: cuántas agregar o quitar (quitar sin cantidad = todas). */
export function carrito(client, { telefono, accion = 'agregar', producto: ref, cantidad, nota }) {
  if (!ajustes(client).activo) throw new Error('Los pedidos por chat no están activos en esta marca.');
  const t = tel(telefono);
  if (!t) throw new Error('Falta el teléfono del contacto.');
  let items = cargar(client, t);
  if (accion === 'vaciar') { guardar(client, t, []); return resumen(client, []); }
  const r = resolver(client, ref);
  if (!r.p) return { ...resumen(client, items), error: r.opciones?.length ? 'varios' : 'no_encontrado', opciones: (r.opciones || []).map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio })) };
  const n = Math.max(1, Math.min(MAX_CANT, Math.floor(Number(cantidad) || 1)));
  const i = items.findIndex((x) => x.id === r.p.id && (x.nota || '') === String(nota || '').slice(0, 120));
  if (accion === 'quitar') {
    const j = i >= 0 ? i : items.findIndex((x) => x.id === r.p.id);
    if (j >= 0) { if (cantidad && items[j].cantidad > n) items[j].cantidad -= n; else items.splice(j, 1); }
  } else {
    if (!r.p.disponible) return { ...resumen(client, items), error: 'agotado', producto: r.p.nombre };
    if (i >= 0) items[i].cantidad = Math.min(MAX_CANT, items[i].cantidad + n);
    else { if (items.length >= MAX_ITEMS) throw new Error('El carrito ya tiene demasiados productos.'); items.push({ id: r.p.id, nombre: r.p.nombre, precio: r.p.precio, categoria: r.p.categoria, cantidad: n, nota: String(nota || '').slice(0, 120) }); }
  }
  // Precios y disponibilidad siempre del catálogo actual (no de lo que se guardó antes).
  items = items.map((x) => { const p = producto(client.id, x.id); return p ? { ...x, nombre: p.nombre, precio: p.precio, categoria: p.categoria } : null; }).filter(Boolean);
  guardar(client, t, items);
  return resumen(client, items);
}

// ------------------------------------------------------------ pedidos
/** Confirma el carrito: crea el pedido, el link de pago (si hay cobros) y avisa al equipo. */
export async function confirmar(client, { telefono, nombre, entrega, direccion, notas }) {
  const aj = ajustes(client);
  if (!aj.activo) throw new Error('Los pedidos por chat no están activos en esta marca.');
  const t = tel(telefono);
  if (!t) throw new Error('Falta el teléfono del contacto.');
  let items = cargar(client, t).map((x) => { const p = producto(client.id, x.id); return p && p.disponible ? { ...x, nombre: p.nombre, precio: p.precio } : null; }).filter(Boolean);
  if (!items.length) throw new Error('El carrito está vacío.');
  const tipo = entrega === 'domicilio' || entrega === 'recoger' ? entrega : aj.entrega === 'recoger' ? 'recoger' : aj.entrega === 'domicilio' ? 'domicilio' : null;
  if (!tipo) throw new Error('Falta saber si es a domicilio o para recoger.');
  if (aj.entrega !== 'ambos' && tipo !== aj.entrega) throw new Error(aj.entrega === 'recoger' ? 'Esta marca solo tiene pedidos para recoger.' : 'Esta marca solo tiene pedidos a domicilio.');
  const dir = String(direccion || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (tipo === 'domicilio' && dir.length < 8) throw new Error('Falta la dirección de entrega completa.');
  const subtotal = Math.round(items.reduce((s, i) => s + i.precio * i.cantidad, 0) * 100) / 100;
  if (aj.minimo && subtotal < Number(aj.minimo)) throw new Error(`El pedido mínimo es de ${dinero(aj.minimo)}.`);
  const envio = tipo === 'domicilio' ? Number(aj.envio) || 0 : 0;
  const total = Math.round((subtotal + envio) * 100) / 100;
  let lead = null;
  try { lead = db.upsertLead(client.id, { telefono: `+${t}`, nombre: nombre || undefined, origen: 'whatsapp' }); } catch { /* sin lead */ }
  const numero = (d().prepare('SELECT MAX(numero) n FROM pedidos WHERE client_id = ?').get(client.id).n || 0) + 1;
  const id = Number(d().prepare(`INSERT INTO pedidos (client_id, numero, lead_id, telefono, nombre, items, subtotal, envio, total, entrega, direccion, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(client.id, numero, lead?.id || null, t, String(nombre || lead?.nombre || '').slice(0, 80) || null, JSON.stringify(items), subtotal, envio, total, tipo, dir || null, String(notas || '').slice(0, 300) || null).lastInsertRowid);
  guardar(client, t, []);
  const lineas = items.map((i) => `${i.cantidad} × ${i.nombre}${i.nota ? ` (${i.nota})` : ''} · ${dinero(i.precio * i.cantidad)}`);
  // Link de pago con lo que ya existe (Mercado Pago o Stripe de la marca). Si no hay cobros, se paga como acuerde el equipo.
  let pago = null, errorPago = null;
  if (cobros.listo(client)) {
    try {
      pago = await cobros.crearLink(client, { telefono: t, nombre, concepto: `Pedido #${numero} · ${client.nombre}`, monto: total, autor: 'IA (pedido)' });
      d().prepare("UPDATE pedidos SET cobro_ref = ?, pago_url = ?, updated_at = datetime('now') WHERE id = ?").run(pago.ref, pago.url, id);
    } catch (e) { errorPago = e.message; }
  }
  if (lead) try { db.getDb().prepare("INSERT INTO lead_mensajes (lead_id, rol, texto, autor) VALUES (?, 'agente', ?, 'Pedido')").run(lead.id, `🧾 Pedido #${numero}: ${lineas.join(', ')} · Total ${dinero(total)}`); } catch { /* historial */ }
  db.logEvent({ clientId: client.id, tipo: 'pedido_nuevo', detalle: `#${numero} ${nombre || t}: ${dinero(total)}` });
  hooks.aviso(client, { titulo: `Pedido nuevo #${numero} · ${dinero(total)}`, nombre, telefono: t, origen: 'whatsapp', correo: true,
    texto: [...lineas, envio ? `Envío: ${dinero(envio)}` : '', `Total: ${dinero(total)}`, tipo === 'domicilio' ? `A domicilio: ${dir}` : 'Para recoger', notas ? `Notas: ${notas}` : '', pago ? 'Se le mandó link de pago.' : 'Sin link de pago: cobrar como acuerden.'].filter(Boolean).join('\n') })
    .catch((e) => console.error('[pedido aviso]', e.message));
  return { pedido: obtener(client.id, id), pago_url: pago?.url || null, error_pago: errorPago };
}

export function obtener(clientId, id) {
  const p = d().prepare('SELECT * FROM pedidos WHERE client_id = ? AND id = ?').get(clientId, Number(id));
  if (!p) return null;
  try { p.items = JSON.parse(p.items); } catch { p.items = []; }
  return p;
}
export function listar(clientId, { estado = '', limite = 100 } = {}) {
  return d().prepare(`SELECT * FROM pedidos WHERE client_id = ? ${ESTADOS[estado] ? 'AND estado = ?' : ''} ORDER BY id DESC LIMIT ?`).all(...[clientId, ...(ESTADOS[estado] ? [estado] : []), limite])
    .map((p) => { try { p.items = JSON.parse(p.items); } catch { p.items = []; } return p; });
}
/** Pedidos recientes de un contacto (para "¿dónde viene mi pedido?"). */
export const deContacto = (client, telefono) => { const t = tel(telefono); return t ? listar(client.id, { limite: 200 }).filter((p) => p.telefono === t).slice(0, 5) : []; };

export function cambiarEstado(client, id, estado) {
  if (!ESTADOS[estado]) throw new Error('Estado no válido.');
  const r = d().prepare("UPDATE pedidos SET estado = ?, updated_at = datetime('now') WHERE client_id = ? AND id = ?").run(estado, client.id, Number(id));
  if (!r.changes) throw new Error('Ese pedido no existe.');
  const p = obtener(client.id, id);
  db.logEvent({ clientId: client.id, tipo: 'pedido_estado', detalle: `#${p.numero} → ${ESTADOS[estado]}` });
  return p;
}

/** Pedidos con link de pago: si el cobro ya se pagó, el pedido pasa a "pagado" (corre después de revisar los cobros). */
export function sincronizarPagos(client) {
  cobros.listar(client.id, 1); // asegura la tabla de cobros
  const r = d().prepare(`UPDATE pedidos SET estado = 'pagado', updated_at = datetime('now') WHERE client_id = ? AND estado = 'nuevo' AND cobro_ref IS NOT NULL
    AND cobro_ref IN (SELECT ref FROM cobros WHERE client_id = ? AND status = 'pagado')`).run(client.id, client.id);
  return { pagados: r.changes };
}

export function resumenPedidos(clientId, dias = 30) {
  const r = d().prepare(`SELECT COUNT(*) n, SUM(estado <> 'cancelado') validos, SUM(CASE WHEN estado IN ('pagado','preparacion','entregado') THEN total ELSE 0 END) vendido,
    SUM(estado = 'nuevo') nuevos FROM pedidos WHERE client_id = ? AND datetime(created_at) >= datetime('now', ?)`).get(clientId, `-${dias} days`);
  return { pedidos: r.n || 0, nuevos: r.nuevos || 0, vendido: r.vendido || 0 };
}
