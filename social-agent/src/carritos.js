// Carrito abandonado: la tienda en línea avisa cuando alguien deja su compra a medias (Shopify con webhook, o cualquier
// tienda con la API del panel). Si en X horas no pagó, se le manda una plantilla de WhatsApp con su link para terminar
// la compra (y un segundo recordatorio opcional). Si paga después del recordatorio, cuenta como recuperado: el lead
// queda como vendido con el valor del carrito y se ve cuánto dinero se recuperó.
//
// client.config.carritos = { activo, plantilla, idioma, horas, segundo, horas2, plantilla2 }
// credentials.carritos   = { shopify_secret }  (para validar que el webhook sí viene de su tienda)
import crypto from 'node:crypto';
import { config } from './config.js';
import * as db from './db.js';
import * as difusion from './difusion.js';
import * as embudo from './embudo.js';

export const hooks = { enviar: (...a) => difusion.enviarPlantilla(...a), ahora: () => new Date() }; // pruebas
export const ajustes = (client) => ({ activo: false, plantilla: '', idioma: 'es_MX', horas: 1, segundo: false, horas2: 24, plantilla2: '', ...(client?.config?.carritos || {}) });
export const secreto = (client) => db.clientCredentials(client).carritos?.shopify_secret || '';
const VENTANA_DIAS = 7; // carritos más viejos ya no se recuerdan

let tablas = false;
const d = () => {
  if (!tablas) {
    tablas = true;
    db.getDb().exec(`CREATE TABLE IF NOT EXISTS carritos (
      id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, origen TEXT NOT NULL, externo_id TEXT NOT NULL,
      lead_id INTEGER, telefono TEXT, nombre TEXT, email TEXT, total REAL, moneda TEXT, url TEXT, productos TEXT,
      estado TEXT NOT NULL DEFAULT 'abierto', recordatorios INTEGER NOT NULL DEFAULT 0, recordado_at TEXT, recuperado_at TEXT, error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE UNIQUE INDEX IF NOT EXISTS carritos_ext ON carritos(client_id, origen, externo_id);
    CREATE INDEX IF NOT EXISTS carritos_estado ON carritos(client_id, estado, created_at);`);
  }
  return db.getDb();
};
const tel = (t) => { const x = String(t || '').replace(/\D/g, ''); return x.length === 10 ? `52${x}` : x.length >= 11 && x.length <= 15 ? x : ''; };

/** Guarda o actualiza un carrito. pagado=true lo marca como comprado (recuperado si ya se le había recordado). */
export function registrar(client, c) {
  const origen = ['shopify', 'api'].includes(c.origen) ? c.origen : 'api';
  const ext = String(c.id || c.externo_id || '').slice(0, 120);
  if (!ext) throw new Error('Falta el id del carrito.');
  const ahora = hooks.ahora().toISOString().replace('T', ' ').slice(0, 19);
  const prev = d().prepare('SELECT * FROM carritos WHERE client_id = ? AND origen = ? AND externo_id = ?').get(client.id, origen, ext);
  const datos = { telefono: tel(c.telefono) || prev?.telefono || null, nombre: String(c.nombre || '').slice(0, 80) || prev?.nombre || null, email: String(c.email || '').slice(0, 160) || prev?.email || null,
    total: Number(c.total) || prev?.total || 0, moneda: String(c.moneda || prev?.moneda || 'MXN').slice(0, 5), url: /^https:\/\//.test(String(c.url || '')) ? String(c.url).slice(0, 600) : prev?.url || null,
    productos: (Array.isArray(c.productos) ? c.productos.map((p) => String(p).slice(0, 80)).slice(0, 10).join(', ') : String(c.productos || '').slice(0, 600)) || prev?.productos || null };
  let id = prev?.id;
  if (!prev) {
    id = Number(d().prepare(`INSERT INTO carritos (client_id, origen, externo_id, telefono, nombre, email, total, moneda, url, productos, estado, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(client.id, origen, ext, datos.telefono, datos.nombre, datos.email, datos.total, datos.moneda, datos.url, datos.productos, datos.telefono ? 'abierto' : 'sin_telefono', ahora, ahora).lastInsertRowid);
  } else {
    d().prepare(`UPDATE carritos SET telefono = ?, nombre = ?, email = ?, total = ?, moneda = ?, url = ?, productos = ?, updated_at = ?,
      estado = CASE WHEN estado = 'sin_telefono' AND ? IS NOT NULL THEN 'abierto' ELSE estado END WHERE id = ?`)
      .run(datos.telefono, datos.nombre, datos.email, datos.total, datos.moneda, datos.url, datos.productos, ahora, datos.telefono, id);
  }
  if (c.pagado) pagado(client, id);
  return obtener(client.id, id);
}

/** Compra terminada: si se le había recordado, cuenta como recuperado (y el lead queda vendido). */
export function pagado(client, carritoId) {
  const x = obtener(client.id, carritoId);
  if (!x || ['recuperado', 'comprado'].includes(x.estado)) return x;
  const recuperado = x.recordatorios > 0;
  d().prepare("UPDATE carritos SET estado = ?, recuperado_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(recuperado ? 'recuperado' : 'comprado', x.id);
  if (recuperado && x.lead_id) {
    try { embudo.marcarResultado(client, x.lead_id, 'vendido', x.total); } catch { /* el lead pudo borrarse */ }
    db.logEvent({ clientId: client.id, tipo: 'carrito_recuperado', detalle: `${x.nombre || x.telefono}: $${Math.round(x.total)}` });
  }
  return obtener(client.id, x.id);
}

/** Pedido nuevo de la tienda: busca su carrito por id, o por teléfono si el carrito se recordó en los últimos días. */
export function pedido(client, { carrito_id, telefono, origen = 'api' }) {
  let x = carrito_id ? d().prepare('SELECT * FROM carritos WHERE client_id = ? AND origen = ? AND externo_id = ?').get(client.id, origen, String(carrito_id)) : null;
  if (!x && tel(telefono)) x = d().prepare(`SELECT * FROM carritos WHERE client_id = ? AND telefono = ? AND estado IN ('abierto', 'recordado')
    AND datetime(created_at) >= datetime('now', '-${VENTANA_DIAS} days') ORDER BY id DESC LIMIT 1`).get(client.id, tel(telefono));
  return x ? pagado(client, x.id) : null;
}

// ------------------------------------------------------------ Shopify
export function firmaShopifyValida(client, raw, firma) {
  const s = secreto(client);
  if (!s || !firma) return false;
  const esperada = crypto.createHmac('sha256', s).update(raw).digest('base64');
  const a = Buffer.from(esperada), b = Buffer.from(String(firma));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
/** Webhooks de Shopify: checkouts/create, checkouts/update (carrito) y orders/create (compra). */
export function webhookShopify(client, tema, j) {
  if (/^orders\//.test(tema)) return pedido(client, { carrito_id: j.checkout_token || j.cart_token, telefono: j.phone || j.customer?.phone || j.shipping_address?.phone || j.billing_address?.phone, origen: 'shopify' });
  if (!/^checkouts\//.test(tema)) return null;
  const nombre = [j.customer?.first_name || j.shipping_address?.first_name, j.customer?.last_name || j.shipping_address?.last_name].filter(Boolean).join(' ');
  return registrar(client, { origen: 'shopify', id: j.token || j.id, telefono: j.phone || j.customer?.phone || j.shipping_address?.phone || j.billing_address?.phone, nombre, email: j.email,
    total: j.total_price, moneda: j.currency, url: j.abandoned_checkout_url, productos: (j.line_items || []).map((l) => `${l.quantity > 1 ? `${l.quantity} × ` : ''}${l.title}`), pagado: !!j.completed_at });
}

// ------------------------------------------------------------ recordatorios
const enHorario = (t) => { const h = difusion.horaLocal(t); return h >= 9 && h < 21; };
export async function revisar(client) {
  const aj = ajustes(client);
  if (!aj.activo || !aj.plantilla) return { enviados: 0 };
  const ahora = hooks.ahora();
  if (!enHorario(ahora)) return { enviados: 0 };
  const ts = (h) => new Date(ahora.getTime() - h * 3600000).toISOString().replace('T', ' ').slice(0, 19);
  const primeros = d().prepare(`SELECT * FROM carritos WHERE client_id = ? AND estado = 'abierto' AND recordatorios = 0 AND telefono IS NOT NULL
    AND created_at <= ? AND created_at >= ? ORDER BY id LIMIT 20`).all(client.id, ts(Math.max(0.25, Number(aj.horas) || 1)), ts(VENTANA_DIAS * 24));
  const segundos = aj.segundo ? d().prepare(`SELECT * FROM carritos WHERE client_id = ? AND estado = 'recordado' AND recordatorios = 1
    AND recordado_at <= ? AND created_at >= ? ORDER BY id LIMIT 20`).all(client.id, ts(Math.max(1, Number(aj.horas2) || 24)), ts(VENTANA_DIAS * 24)) : [];
  let enviados = 0;
  for (const x of [...primeros, ...segundos]) {
    const segundo = x.recordatorios === 1;
    const plantilla = segundo && aj.plantilla2 ? aj.plantilla2 : aj.plantilla;
    try {
      const lead = db.upsertLead(client.id, { telefono: `+${x.telefono}`, nombre: x.nombre || undefined, email: x.email || undefined, origen: 'tienda' });
      const vals = [x.nombre?.split(' ')[0] || 'Hola', x.url || config.publicBaseUrl];
      await hooks.enviar(client, { telefono: x.telefono, plantilla, idioma: aj.idioma, vals, leadId: lead.id, autor: 'Carrito abandonado',
        texto: `[Carrito abandonado${segundo ? ' · 2º recordatorio' : ''}] ${x.productos || ''} · $${Math.round(x.total)} · ${x.url || ''}`.slice(0, 600) });
      d().prepare("UPDATE carritos SET estado = 'recordado', recordatorios = recordatorios + 1, recordado_at = datetime('now'), lead_id = ?, error = NULL, updated_at = datetime('now') WHERE id = ?").run(lead.id, x.id);
      enviados++;
    } catch (e) {
      d().prepare("UPDATE carritos SET estado = 'error', error = ?, updated_at = datetime('now') WHERE id = ?").run(String(e.message).slice(0, 300), x.id);
    }
  }
  return { enviados };
}

export const obtener = (clientId, id) => d().prepare('SELECT * FROM carritos WHERE client_id = ? AND id = ?').get(clientId, Number(id));
export const listar = (clientId, limit = 100) => d().prepare('SELECT * FROM carritos WHERE client_id = ? ORDER BY id DESC LIMIT ?').all(clientId, limit);
export function resumen(clientId, dias = 30) {
  const r = d().prepare(`SELECT estado, recordatorios, total FROM carritos WHERE client_id = ? AND datetime(created_at) >= datetime('now', ?)`).all(clientId, `-${dias} days`);
  const recup = r.filter((x) => x.estado === 'recuperado');
  return { abandonados: r.length, recordados: r.filter((x) => x.recordatorios > 0).length, recuperados: recup.length, dinero: recup.reduce((s, x) => s + (Number(x.total) || 0), 0),
    tasa: r.filter((x) => x.recordatorios > 0).length ? Math.round((recup.length / r.filter((x) => x.recordatorios > 0).length) * 100) : null };
}
