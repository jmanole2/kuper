// Cobro con Stripe: el cliente registra su tarjeta en la página segura de Stripe (nunca pasa por
// este servidor), queda domiciliada la mensualidad de su plan y se le pueden cobrar extras.
// .env: STRIPE_SECRET_KEY (sk_live_… o sk_test_…) y STRIPE_WEBHOOK_SECRET (whsec_…).
import crypto from 'node:crypto';
import { config } from './config.js';
import * as db from './db.js';
import { planDe } from './plan.js';

const KEY = () => process.env.STRIPE_SECRET_KEY || '';
export const stripeOn = () => !!KEY();
export const hooks = {}; // pruebas: hooks.fetch

// Parámetros anidados al formato de Stripe: a[b][0][c]=x
function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}
export async function stripe(method, path, params, { idem } = {}) {
  if (!stripeOn()) throw new Error('Los pagos no están configurados (falta STRIPE_SECRET_KEY).');
  const url = `https://api.stripe.com/v1${path}${method === 'GET' && params ? `?${form(params)}` : ''}`;
  const res = await (hooks.fetch || fetch)(url, {
    method,
    headers: { Authorization: `Bearer ${KEY()}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20', ...(idem ? { 'Idempotency-Key': idem } : {}) },
    body: method === 'GET' || !params ? undefined : form(params),
    signal: AbortSignal.timeout(20000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(j.error?.message || `Stripe ${res.status}`); e.code = j.error?.code; e.stripe = j.error; throw e; }
  return j;
}

const cents = (mxn) => Math.round(Number(mxn) * 100);
const tarjetaTxt = (pm) => (pm?.card ? `${pm.card.brand} •••• ${pm.card.last4} · vence ${String(pm.card.exp_month).padStart(2, '0')}/${String(pm.card.exp_year).slice(-2)}` : null);

async function cliente(client, email) {
  const b = db.getBilling(client.id);
  if (b.stripe_customer) return b.stripe_customer;
  const c = await stripe('POST', '/customers', { name: client.nombre, email: email || undefined, metadata: { client_id: client.id, slug: client.slug } }, { idem: `cust-${client.id}` });
  db.setBilling(client.id, { stripe_customer: c.id });
  return c.id;
}

// Si está en prueba gratis, la mensualidad empieza a cobrarse al terminar la prueba.
function trial(plan) {
  if (!plan.prueba_hasta) return {};
  const fin = Math.floor(new Date(`${plan.prueba_hasta}T23:59:00-06:00`).getTime() / 1000);
  return fin > Date.now() / 1000 + 2 * 86400 ? { trial_end: fin } : {}; // Stripe pide al menos 48 h
}

/** Página de Stripe para domiciliar la tarjeta (y arrancar la mensualidad del plan si tiene conceptos mensuales). */
export async function checkoutUrl(client, { email } = {}) {
  const customer = await cliente(client, email);
  const plan = planDe(client), mensual = plan.conceptos.filter((c) => c.tipo !== 'unico'), unico = plan.conceptos.filter((c) => c.tipo === 'unico');
  const b = db.getBilling(client.id);
  const base = { customer, locale: 'es', success_url: `${config.publicBaseUrl}/app/pagos?ok=1`, cancel_url: `${config.publicBaseUrl}/app/pagos`, metadata: { client_id: client.id } };
  // Sin mensualidad (o ya suscrito): solo guarda la tarjeta para cobros futuros.
  if (!mensual.length || b.subscription_id) {
    const s = await stripe('POST', '/checkout/sessions', { ...base, mode: 'setup', currency: 'mxn', payment_method_types: ['card'] });
    return s.url;
  }
  const line = (c, recurring) => ({ quantity: 1, price_data: { currency: 'mxn', unit_amount: cents(c.monto), product_data: { name: c.nombre }, ...(recurring ? { recurring: { interval: 'month' } } : {}) } });
  const s = await stripe('POST', '/checkout/sessions', {
    ...base, mode: 'subscription', payment_method_types: ['card'],
    line_items: [...mensual.map((c) => line(c, true)), ...unico.map((c) => line(c, false))],
    subscription_data: { metadata: { client_id: client.id }, ...trial(plan) },
  });
  return s.url;
}

/** Portal de Stripe: cambiar tarjeta, ver y descargar facturas. */
export async function portalUrl(client) {
  const b = db.getBilling(client.id);
  if (!b.stripe_customer) throw new Error('Primero domicilia una tarjeta.');
  const s = await stripe('POST', '/billing_portal/sessions', { customer: b.stripe_customer, return_url: `${config.publicBaseUrl}/app/pagos` });
  return s.url;
}

/** Estado en vivo para la página de pagos: tarjeta, próximo cobro y facturas. */
export async function resumen(client) {
  const b = db.getBilling(client.id);
  if (!stripeOn() || !b.stripe_customer) return { ...b, facturas: [] };
  const [cust, inv] = await Promise.all([
    stripe('GET', `/customers/${b.stripe_customer}`, { expand: ['invoice_settings.default_payment_method'] }),
    stripe('GET', '/invoices', { customer: b.stripe_customer, limit: 12 }),
  ]);
  let tarjeta = tarjetaTxt(cust.invoice_settings?.default_payment_method), proximo = b.proximo_cobro;
  if (b.subscription_id) {
    const sub = await stripe('GET', `/subscriptions/${b.subscription_id}`, { expand: ['default_payment_method'] }).catch(() => null);
    if (sub) { tarjeta = tarjetaTxt(sub.default_payment_method) || tarjeta; proximo = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : proximo; }
  }
  const upd = db.setBilling(client.id, { tarjeta, proximo_cobro: proximo, ...(tarjeta && b.estado === 'sin_tarjeta' ? { estado: 'al_corriente' } : {}) });
  return { ...upd, facturas: (inv.data || []).map((i) => ({ numero: i.number, fecha: new Date(i.created * 1000).toISOString(), total: i.total / 100, estado: i.status, url: i.hosted_invoice_url, concepto: i.lines?.data?.[0]?.description || '' })) };
}

/** Cobra un extra a la tarjeta domiciliada. Devuelve { ok, factura } o { ok:false, error, url } si el banco pide confirmar. */
export async function cobrarExtra(client, { monto, concepto, idem }) {
  const b = db.getBilling(client.id);
  if (!b.stripe_customer || !b.tarjeta) return { ok: false, error: 'sin_tarjeta' };
  await stripe('POST', '/invoiceitems', { customer: b.stripe_customer, amount: cents(monto), currency: 'mxn', description: concepto }, { idem: `ii-${idem}` });
  const inv = await stripe('POST', '/invoices', { customer: b.stripe_customer, collection_method: 'charge_automatically', pending_invoice_items_behavior: 'include', auto_advance: true, description: concepto, metadata: { client_id: client.id } }, { idem: `inv-${idem}` });
  try {
    const paid = await stripe('POST', `/invoices/${inv.id}/pay`, {});
    return paid.status === 'paid' ? { ok: true, factura: inv.id } : { ok: false, error: 'pendiente', url: paid.hosted_invoice_url, factura: inv.id };
  } catch (e) {
    const fin = await stripe('GET', `/invoices/${inv.id}`).catch(() => inv);
    return { ok: false, error: e.message, url: fin.hosted_invoice_url, factura: inv.id };
  }
}

// ------------------------------------------------------------ avisos de Stripe (webhook)
export function verificarFirma(raw, header, secret = process.env.STRIPE_WEBHOOK_SECRET, now = Date.now()) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(String(header).split(',').map((p) => p.split('=')).map(([k, ...v]) => [k, v.join('=')]));
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > 300) return false;
  const want = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return String(header).split(',').filter((p) => p.startsWith('v1=')).some((p) => {
    const got = Buffer.from(p.slice(3)), w = Buffer.from(want);
    return got.length === w.length && crypto.timingSafeEqual(got, w);
  });
}

const clientDe = (obj) => {
  const id = Number(obj?.metadata?.client_id) || db.billingByCustomer(obj?.customer)?.client_id;
  return id ? db.getClient(id) : null;
};
export async function procesarEvento(ev) {
  const o = ev.data?.object || {};
  const c = clientDe(o);
  if (!c) return { omitido: true };
  switch (ev.type) {
    case 'checkout.session.completed': {
      const f = { stripe_customer: o.customer, estado: 'al_corriente' };
      if (o.subscription) f.subscription_id = o.subscription;
      if (o.setup_intent) { // solo tarjeta: dejarla como la predeterminada para cobros
        const si = await stripe('GET', `/setup_intents/${o.setup_intent}`);
        if (si.payment_method) await stripe('POST', `/customers/${o.customer}`, { invoice_settings: { default_payment_method: si.payment_method } });
      }
      db.setBilling(c.id, f);
      db.logEvent({ clientId: c.id, tipo: 'tarjeta_domiciliada', detalle: o.subscription ? 'Mensualidad activa' : 'Tarjeta guardada' });
      break;
    }
    case 'invoice.paid':
      db.setBilling(c.id, { estado: 'al_corriente', ultimo_pago: new Date().toISOString() });
      db.logEvent({ clientId: c.id, tipo: 'pago_recibido', detalle: `${(o.amount_paid / 100).toFixed(2)} MXN · ${o.number || o.id}` });
      break;
    case 'invoice.payment_failed':
      db.setBilling(c.id, { estado: 'pago_fallido' });
      db.logEvent({ clientId: c.id, tipo: 'pago_fallido', detalle: `${(o.amount_due / 100).toFixed(2)} MXN · ${o.last_finalization_error?.message || 'tarjeta rechazada'}` });
      break;
    case 'customer.subscription.deleted':
      db.setBilling(c.id, { subscription_id: null, estado: 'cancelado' });
      db.logEvent({ clientId: c.id, tipo: 'suscripcion_cancelada', detalle: o.id });
      break;
    default: return { omitido: true };
  }
  return { ok: true };
}
