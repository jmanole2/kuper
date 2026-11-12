// Cobros por chat: el agente manda un link de pago (Mercado Pago o Stripe) con la cuenta de la marca; el dinero le
// llega directo a la marca. Cada pocos minutos se revisa con el proveedor si ya pagaron (sin webhooks que configurar);
// al pagar, el lead queda como vendido con su valor, pasa a la etapa elegida y la venta se le avisa a Meta.
//
// client.config.cobros = { activo, proveedor: 'mercadopago' | 'stripe', etapa_pagado, monto_max }
// credentials.cobros = { token }   (Mercado Pago: access token de producción · Stripe: clave secreta sk_live…)
import crypto from 'node:crypto';
import { config } from './config.js';
import * as db from './db.js';
import * as embudo from './embudo.js';
import * as atribucion from './atribucion.js';

export const hooks = { fetch: (...a) => fetch(...a) }; // pruebas
export const PROVEEDORES = { mercadopago: 'Mercado Pago', stripe: 'Stripe' };
export const ajustes = (client) => ({ activo: false, proveedor: 'mercadopago', etapa_pagado: '', monto_max: 20000, ...(client?.config?.cobros || {}) });
const token = (client) => db.clientCredentials(client).cobros?.token || '';
export const listo = (client) => ajustes(client).activo && Boolean(token(client));
const VIGENCIA_H = 72;

let tablas = false;
const d = () => {
  if (!tablas) {
    tablas = true;
    db.getDb().exec(`CREATE TABLE IF NOT EXISTS cobros (
      id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, ref TEXT NOT NULL UNIQUE,
      lead_id INTEGER, concepto TEXT NOT NULL, monto REAL NOT NULL, moneda TEXT NOT NULL DEFAULT 'MXN', proveedor TEXT NOT NULL,
      externo_id TEXT, url TEXT, status TEXT NOT NULL DEFAULT 'pendiente', autor TEXT, pagado_at TEXT, error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS cobros_cliente ON cobros(client_id, created_at);`);
  }
  return db.getDb();
};
const json = async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error?.message || j.message || `${r.status}`); return j; };

async function crearEnProveedor(client, { ref, concepto, monto }) {
  const aj = ajustes(client), tk = token(client);
  if (aj.proveedor === 'stripe') {
    const f = new URLSearchParams({ mode: 'payment', client_reference_id: ref, 'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'mxn',
      'line_items[0][price_data][unit_amount]': String(Math.round(monto * 100)), 'line_items[0][price_data][product_data][name]': concepto,
      success_url: `${config.publicBaseUrl}/pago-listo`, expires_at: String(Math.floor(Date.now() / 1000) + 23 * 3600), 'metadata[ref]': ref });
    const j = await json(await hooks.fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: f, signal: AbortSignal.timeout(15000) }));
    return { externo_id: j.id, url: j.url };
  }
  const vence = new Date(Date.now() + VIGENCIA_H * 3600000).toISOString();
  const j = await json(await hooks.fetch('https://api.mercadopago.com/checkout/preferences', { method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': ref },
    body: JSON.stringify({ items: [{ title: concepto, quantity: 1, unit_price: monto, currency_id: 'MXN' }], external_reference: ref, expires: true, expiration_date_to: vence,
      back_urls: { success: `${config.publicBaseUrl}/pago-listo` }, statement_descriptor: String(client.nombre).slice(0, 22) }) }));
  return { externo_id: j.id, url: j.init_point };
}

/** Crea un link de pago para un contacto. */
export async function crearLink(client, { telefono, usuario, nombre, concepto, monto, autor = 'IA' }) {
  const aj = ajustes(client);
  if (!listo(client)) throw new Error('Los cobros por chat no están configurados en esta marca.');
  const m = Math.round(Number(monto) * 100) / 100;
  const c = String(concepto || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!c) throw new Error('Falta el concepto (qué se está pagando).');
  if (!(m >= 10)) throw new Error('El monto mínimo es $10.');
  if (m > Number(aj.monto_max || 20000)) throw new Error(`El monto pasa del máximo permitido por chat ($${Number(aj.monto_max).toLocaleString('es-MX')}). Que lo confirme una persona del equipo.`);
  let lead = null;
  try { lead = db.upsertLead(client.id, { telefono, usuario, nombre, origen: telefono ? 'whatsapp' : 'instagram' }); } catch { /* sin contacto */ }
  const ref = `k${client.id}-${crypto.randomBytes(8).toString('hex')}`;
  const r = await crearEnProveedor(client, { ref, concepto: c, monto: m });
  d().prepare('INSERT INTO cobros (client_id, ref, lead_id, concepto, monto, proveedor, externo_id, url, autor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(client.id, ref, lead?.id || null, c, m, aj.proveedor, r.externo_id || null, r.url, String(autor).slice(0, 80));
  db.logEvent({ clientId: client.id, tipo: 'cobro_link', detalle: `${lead?.nombre || lead?.telefono || ''}: ${c} $${m}` });
  return { ref, url: r.url, monto: m, concepto: c };
}

async function pagadoEnProveedor(client, cobro) {
  const tk = token(client);
  if (cobro.proveedor === 'stripe') {
    const j = await json(await hooks.fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(cobro.externo_id)}`, { headers: { Authorization: `Bearer ${tk}` }, signal: AbortSignal.timeout(15000) }));
    return j.payment_status === 'paid' ? 'pagado' : j.status === 'expired' ? 'vencido' : null;
  }
  const j = await json(await hooks.fetch(`https://api.mercadopago.com/v1/payments/search?${new URLSearchParams({ external_reference: cobro.ref, sort: 'date_created', criteria: 'desc' })}`, { headers: { Authorization: `Bearer ${tk}` }, signal: AbortSignal.timeout(15000) }));
  return (j.results || []).some((p) => p.status === 'approved' && Math.abs(Number(p.transaction_amount) - cobro.monto) < 0.01) ? 'pagado' : null;
}

/** Revisa los cobros pendientes (de las últimas 72 h) y marca los pagados. */
export async function revisar(client, { ahora = new Date() } = {}) {
  if (!token(client)) return { pagados: 0 };
  const pend = d().prepare(`SELECT * FROM cobros WHERE client_id = ? AND status = 'pendiente' AND datetime(created_at) >= datetime(?, '-${VIGENCIA_H} hours')`).all(client.id, ahora.toISOString().replace('T', ' ').slice(0, 19));
  const viejos = d().prepare(`UPDATE cobros SET status = 'vencido' WHERE client_id = ? AND status = 'pendiente' AND datetime(created_at) < datetime(?, '-${VIGENCIA_H} hours')`).run(client.id, ahora.toISOString().replace('T', ' ').slice(0, 19));
  let pagados = 0;
  for (const c of pend) {
    let st;
    try { st = await pagadoEnProveedor(client, c); } catch (e) { d().prepare('UPDATE cobros SET error = ? WHERE id = ?').run(String(e.message).slice(0, 200), c.id); continue; }
    if (st === 'vencido') { d().prepare("UPDATE cobros SET status = 'vencido' WHERE id = ?").run(c.id); continue; }
    if (st !== 'pagado') continue;
    if (!d().prepare("UPDATE cobros SET status = 'pagado', pagado_at = datetime('now'), error = NULL WHERE id = ? AND status = 'pendiente'").run(c.id).changes) continue;
    pagados++;
    await alPagar(client, c);
  }
  return { pagados, vencidos: viejos.changes };
}

async function alPagar(client, c) {
  db.logEvent({ clientId: client.id, tipo: 'cobro_pagado', detalle: `${c.concepto} $${c.monto}` });
  if (!c.lead_id) return;
  const lead = db.getLead(client.id, c.lead_id);
  if (!lead) return;
  try { db.getDb().prepare("INSERT INTO lead_mensajes (lead_id, rol, texto, autor) VALUES (?, 'lead', ?, 'Pago')").run(lead.id, `💳 Pagó $${c.monto.toLocaleString('es-MX')} · ${c.concepto}`); } catch { /* historial */ }
  db.getDb().prepare("UPDATE leads SET resultado = 'vendido', valor = COALESCE(valor, 0) + ?, updated_at = datetime('now') WHERE id = ?").run(c.monto, lead.id);
  const etapa = ajustes(client).etapa_pagado;
  if (etapa) try { embudo.moverLead(client, lead.id, etapa); } catch { /* etapa no válida */ }
  await atribucion.venta(client, db.getLead(client.id, lead.id), { valor: c.monto, id: c.ref });
}

export function listar(clientId, limit = 60) { return d().prepare('SELECT * FROM cobros WHERE client_id = ? ORDER BY id DESC LIMIT ?').all(clientId, limit); }
export function resumen(clientId, dias = 30) {
  const r = d().prepare(`SELECT COUNT(*) links, SUM(status = 'pagado') pagados, SUM(CASE WHEN status = 'pagado' THEN monto ELSE 0 END) total FROM cobros WHERE client_id = ? AND datetime(created_at) >= datetime('now', ?)`).get(clientId, `-${dias} days`);
  return { links: r.links || 0, pagados: r.pagados || 0, total: r.total || 0 };
}
