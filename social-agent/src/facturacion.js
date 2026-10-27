// Facturación automática con Factura.com (CFDI 4.0): cada vez que Stripe cobra (invoice.paid), se timbra
// la factura con los datos fiscales que el cliente capturó en Pagos y Factura.com se la manda por correo.
// Claves en el .env: FACTURACOM_API_KEY y FACTURACOM_SECRET_KEY. Los ajustes (serie, clave SAT, unidad,
// encendido) se guardan desde el panel en /admin/facturacion.
import { config } from './config.js';
import * as db from './db.js';
import { fiscalDe } from './plan.js';

export const hooks = { fetch: (...a) => fetch(...a), stripe: null }; // pruebas
const PLUGIN = '9d4095c8f7ed5785cb14c0e3b033eeb8252416ed'; // valor fijo que pide Factura.com
const host = () => (config.facturacom.sandbox ? 'https://sandbox.factura.com/api' : 'https://api.factura.com');
export const conectado = () => !!(config.facturacom.apiKey && config.facturacom.secretKey);

// ------------------------------------------------------------ ajustes (desde el panel)
const DEFAULT = { activo: false, serie_id: '', serie_nombre: '', clave_prod_serv: '', clave_unidad: 'E48', unidad: 'Unidad de servicio' };
export const ajustes = () => { try { return { ...DEFAULT, ...JSON.parse(db.kvGet('facturacion') || '{}') }; } catch { return { ...DEFAULT }; } };
export function guardarAjustes(b) {
  const clave = String(b.clave_prod_serv || '').trim();
  if (clave && !/^\d{8}$/.test(clave)) throw new Error('La clave de producto o servicio del SAT tiene 8 números (ej. 81112100).');
  const unidad = String(b.clave_unidad || 'E48').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,3}$/.test(unidad)) throw new Error('La clave de unidad no es válida (normalmente E48).');
  const serie = String(b.serie || '').split('|');
  const a = { activo: b.activo === '1' || b.activo === true, serie_id: serie[0] || '', serie_nombre: serie[1] || '', clave_prod_serv: clave, clave_unidad: unidad, unidad: String(b.unidad || 'Unidad de servicio').trim().slice(0, 60) };
  if (a.activo && (!a.serie_id || !a.clave_prod_serv)) throw new Error('Para encender la facturación automática elige la serie y pon la clave del SAT.');
  db.kvSet('facturacion', JSON.stringify(a));
  return a;
}

// ------------------------------------------------------------ API de Factura.com
async function api(method, path, body) {
  if (!conectado()) throw new Error('Faltan las claves de Factura.com (FACTURACOM_API_KEY y FACTURACOM_SECRET_KEY).');
  const res = await hooks.fetch(`${host()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'F-PLUGIN': PLUGIN, 'F-Api-Key': config.facturacom.apiKey, 'F-Secret-Key': config.facturacom.secretKey },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const tipo = res.headers?.get?.('content-type') || '';
  if (/pdf|xml|octet/.test(tipo)) return { res, archivo: true };
  const j = await res.json().catch(() => ({}));
  return { res, j };
}
const mensajeError = (j, res) => {
  const m = j?.message;
  if (m && typeof m === 'object') return [m.message, m.messageDetail].filter(Boolean).join(' · ') || 'Error al timbrar';
  return m || j?.error || `HTTP ${res?.status}`;
};

/** Series de factura dadas de alta en Factura.com (para elegir en el panel). */
export async function series() {
  const { res, j } = await api('GET', '/v4/series');
  if (!res.ok || j.response === 'error') throw new Error(`Factura.com: ${mensajeError(j, res)}`);
  return (j.data || []).filter((s) => !s.SerieType || s.SerieType === 'factura').map((s) => ({ id: String(s.SerieID), nombre: s.SerieName, descripcion: s.SerieDescription || '' }));
}

// La razón social va sin el régimen de capital (así lo pide el SAT en CFDI 4.0).
export const razonSinRegimen = (r) => String(r || '').toUpperCase().replace(/[,.\s]+(S\.?\s?A\.?\s?P\.?\s?I\.?|S\.?\s?A\.?|S\.?\s?DE\s?R\.?\s?L\.?|S\.?\s?C\.?|A\.?\s?C\.?|S\.?\s?A\.?\s?S\.?)(\s+DE\s+C\.?\s?V\.?)?\.?\s*$/i, '').trim();

/** UID del cliente en Factura.com: lo busca por RFC y, si no existe, lo da de alta. */
async function receptorUid(client, f, correo) {
  if (f.facturacom_uid && f.facturacom_rfc === f.rfc) return f.facturacom_uid;
  let uid = null;
  const b = await api('GET', `/v1/clients/${encodeURIComponent(f.rfc)}`);
  if (b.res.ok && b.j?.Data?.UID) uid = b.j.Data.UID;
  if (!uid) {
    const c = await api('POST', '/v1/clients/create', { rfc: f.rfc, razons: razonSinRegimen(f.razon_social), codpos: Number(f.cp), email: correo, regimen: String(f.regimen), usocfdi: f.uso || 'G03', pais: 'MEX' });
    uid = c.j?.Data?.UID;
    if (!uid) throw new Error(`No se pudo dar de alta al cliente en Factura.com: ${mensajeError(c.j, c.res)}`);
  } else {
    // Si ya existía, se actualizan sus datos por si cambiaron (razón social, CP, régimen).
    await api('POST', `/v1/clients/${uid}/update`, { rfc: f.rfc, razons: razonSinRegimen(f.razon_social), codpos: Number(f.cp), email: correo, regimen: String(f.regimen), usocfdi: f.uso || 'G03', pais: 'MEX' }).catch(() => {});
  }
  const cfg = db.getClient(client.id).config;
  db.updateClient(client.id, { config: { ...cfg, fiscal: { ...cfg.fiscal, facturacom_uid: uid, facturacom_rfc: f.rfc } } });
  return uid;
}

const r2 = (n) => Math.round(n * 100) / 100;
/** Conceptos del CFDI a partir de la factura de Stripe (montos en centavos; el IVA va desglosado). */
export function conceptosDeStripe(inv, aj) {
  return (inv.lines?.data || []).filter((l) => l.amount > 0).map((l, i) => {
    const iva = (l.tax_amounts || []).reduce((n, t) => n + t.amount, 0);
    const inclusivo = (l.tax_amounts || []).some((t) => t.inclusive);
    const base = r2((l.amount_excluding_tax ?? (inclusivo ? l.amount - iva : l.amount)) / 100);
    const conIva = iva > 0;
    return {
      ClaveProdServ: aj.clave_prod_serv, NoIdentificacion: `K${i + 1}`, Cantidad: 1, ClaveUnidad: aj.clave_unidad, Unidad: aj.unidad,
      ValorUnitario: base, Importe: base, Descripcion: String(l.description || 'Servicio').replace(/^\d+\s*×\s*/, '').slice(0, 1000), Descuento: '0',
      ObjetoImp: conIva ? '02' : '01',
      ...(conIva ? { Impuestos: { Traslados: [{ Base: base, Impuesto: '002', TipoFactor: 'Tasa', TasaOCuota: '0.16', Importe: r2(base * 0.16) }], Retenidos: [], Locales: [] } } : {}),
    };
  });
}

/** Forma de pago SAT según la tarjeta con la que pagó: 28 débito, 04 crédito. */
async function formaPago(inv) {
  try {
    if (!inv.charge || !hooks.stripe) return '04';
    const ch = await hooks.stripe('GET', `/charges/${inv.charge}`);
    return ch?.payment_method_details?.card?.funding === 'debit' ? '28' : '04';
  } catch { return '04'; }
}

const getFactura = (stripeInvoice) => db.getDb().prepare('SELECT * FROM facturas WHERE stripe_invoice = ?').get(stripeInvoice);
const guardar = (stripeInvoice, clientId, f) => {
  db.getDb().prepare('INSERT OR IGNORE INTO facturas (client_id, stripe_invoice) VALUES (?, ?)').run(clientId, stripeInvoice);
  const campos = Object.keys(f);
  db.getDb().prepare(`UPDATE facturas SET ${campos.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE stripe_invoice = ?`).run(...campos.map((k) => f[k]), stripeInvoice);
  return getFactura(stripeInvoice);
};
export const listar = ({ clientId, limit = 100 } = {}) => db.getDb().prepare(`SELECT f.*, c.nombre AS cliente FROM facturas f JOIN clients c ON c.id = f.client_id ${clientId ? 'WHERE f.client_id = ?' : ''} ORDER BY f.id DESC LIMIT ?`).all(...(clientId ? [clientId, limit] : [limit]));
export const porStripe = (clientId) => Object.fromEntries(listar({ clientId, limit: 500 }).map((f) => [f.stripe_invoice, f]));

/** Timbra la factura de un cobro de Stripe. Nunca timbra dos veces el mismo cobro. */
export async function facturarCobro(client, inv, { forzar = false } = {}) {
  const aj = ajustes();
  if (!forzar && !aj.activo) return { omitida: 'apagada' };
  if (!inv?.id || !(inv.amount_paid > 0)) return { omitida: 'sin_monto' };
  const previa = getFactura(inv.id);
  if (previa?.status === 'emitida') return { ya: previa };
  const total = r2(inv.amount_paid / 100);
  const f = fiscalDe(client);
  if (!f?.rfc) {
    db.logEvent({ clientId: client.id, tipo: 'factura_pendiente', detalle: `Cobro ${inv.number || inv.id}: el cliente no ha capturado sus datos fiscales` });
    return { factura: guardar(inv.id, client.id, { status: 'pendiente', total, error: 'Faltan los datos fiscales del cliente (los llena en su panel, en Pagos).' }) };
  }
  if (!aj.serie_id || !aj.clave_prod_serv) return { factura: guardar(inv.id, client.id, { status: 'pendiente', total, error: 'Falta elegir la serie y la clave del SAT en Facturación.' }) };
  try {
    const correo = f.correo || client.config.notificaciones?.email || inv.customer_email;
    if (!correo) throw new Error('No hay correo para mandarle la factura al cliente.');
    const uid = await receptorUid(client, f, correo);
    const conceptos = conceptosDeStripe(inv, aj);
    if (!conceptos.length) throw new Error('El cobro no tiene conceptos con monto.');
    const cuerpo = {
      Receptor: { UID: uid }, TipoDocumento: 'factura', Conceptos: conceptos, UsoCFDI: f.uso || 'G03', Serie: Number(aj.serie_id),
      FormaPago: await formaPago(inv), MetodoPago: 'PUE', Moneda: 'MXN', EnviarCorreo: true, NumOrder: inv.id,
      Comentarios: `Cobro ${inv.number || inv.id}`,
    };
    const { res, j } = await api('POST', '/v4/cfdi40/create', cuerpo);
    if (!res.ok || j.response !== 'success') {
      // Ya existía con este mismo cobro (por un reintento): se toma la que ya está.
      if (j.uuid && j.uid && /ya existe/i.test(String(j.message))) return { factura: guardar(inv.id, client.id, { status: 'emitida', uuid: j.uuid, cfdi_uid: j.uid, total, error: null }) };
      throw new Error(mensajeError(j, res));
    }
    const fac = guardar(inv.id, client.id, { status: 'emitida', uuid: j.UUID || j.SAT?.UUID, cfdi_uid: j.uid || j.invoice_uid, serie: j.INV?.Serie || aj.serie_nombre, folio: String(j.INV?.Folio ?? ''), total, error: null, detalle: conceptos.map((c) => c.Descripcion).join(' · ') });
    db.logEvent({ clientId: client.id, tipo: 'factura_emitida', detalle: `${fac.serie || ''}${fac.folio} · ${total.toFixed(2)} MXN · ${correo}` });
    return { factura: fac };
  } catch (e) {
    db.logEvent({ clientId: client.id, tipo: 'factura_error', detalle: `Cobro ${inv.number || inv.id}: ${e.message}` });
    return { factura: guardar(inv.id, client.id, { status: 'error', total, error: String(e.message).slice(0, 500) }), error: e.message };
  }
}

/** PDF o XML de una factura emitida (se pide a Factura.com con las claves del panel). */
export async function archivo(fac, tipo) {
  if (!fac?.cfdi_uid) throw new Error('Esta factura no está emitida.');
  const { res } = await api('GET', `/v4/cfdi40/${encodeURIComponent(fac.cfdi_uid)}/${tipo === 'xml' ? 'xml' : 'pdf'}`);
  if (!res.ok) throw new Error(`Factura.com no entregó el ${tipo} (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
