// Anuncios: qué anuncio de Meta vende de verdad. Junta lo que gastó cada anuncio (Meta) con los leads, conversaciones
// y ventas que trajo (panel) → costo por lead, costo por venta y retorno (ROAS). La IA recomienda qué escalar, pausar o
// probar y propone textos para anuncios nuevos con lo que preguntan quienes sí compran.
// También manda segmentos a Meta como públicos (personalizado y similar) para que los anuncios encuentren gente parecida.
//
// client.config.anuncios = { cuenta: 'act_123' }   ·   token: credentials.meta.ads_token (ads_read; ads_management para públicos)
import crypto from 'node:crypto';
import { config } from './config.js';
import * as db from './db.js';
import { pedirJSON } from './llm/proveedor.js';

export const hooks = { fetch: (...a) => fetch(...a), ia: (...a) => pedirJSON(...a) }; // pruebas
const G = () => `https://graph.facebook.com/${config.metaGraphVersion}`;
export const ajustes = (client) => ({ cuenta: '', ...(client?.config?.anuncios || {}) });
const token = (client) => { const m = db.clientCredentials(client).meta || {}; return m.ads_token || ''; };
export const listo = (client) => !!token(client);
const cuentaId = (c) => { const x = String(c || '').trim().replace(/^act_/, ''); return /^\d{5,20}$/.test(x) ? `act_${x}` : ''; };

async function graph(client, ruta, { metodo = 'GET', params = {}, body = null } = {}) {
  const qs = new URLSearchParams({ ...params, access_token: token(client) });
  const r = await hooks.fetch(`${G()}/${ruta}${metodo === 'GET' ? `?${qs}` : ''}`, metodo === 'GET' ? { signal: AbortSignal.timeout(20000) }
    : { method: metodo, signal: AbortSignal.timeout(30000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(body || {}), access_token: token(client) }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const m = j.error?.message || `HTTP ${r.status}`;
    throw new Error(/permission|permiso|ads_management|ads_read/i.test(m) ? `Meta no dio permiso (${m}). El token de anuncios necesita ads_read (y ads_management para públicos).` : `Meta: ${m}`);
  }
  return j;
}

const dia = (d) => new Date(d).toISOString().slice(0, 10);
/** Rango de fechas: los últimos N días (hasta ayer incluido hoy). */
export const rango = (dias = 30, ahora = new Date()) => ({ desde: dia(ahora.getTime() - (dias - 1) * 86400000), hasta: dia(ahora) });

/** Gasto por anuncio en Meta: de la cuenta (todos los anuncios) o, sin cuenta, de los anuncios que trajeron leads. */
async function gastoMeta(client, { desde, hasta }, anunciosConLeads) {
  const time_range = JSON.stringify({ since: desde, until: hasta });
  const fields = 'ad_id,ad_name,adset_name,campaign_name,spend,impressions,clicks';
  const cuenta = cuentaId(ajustes(client).cuenta);
  const out = {};
  if (cuenta) {
    let ruta = `${cuenta}/insights`, params = { level: 'ad', fields, time_range, limit: '200' };
    for (let i = 0; i < 10 && ruta; i++) {
      const j = await graph(client, ruta, { params });
      for (const x of j.data || []) out[x.ad_id] = x;
      const sig = j.paging?.next ? new URL(j.paging.next) : null;
      if (!sig) break;
      ruta = sig.pathname.replace(/^\/v[\d.]+\//, ''); params = Object.fromEntries([...sig.searchParams].filter(([k]) => k !== 'access_token'));
    }
  } else {
    for (const id of anunciosConLeads.slice(0, 60)) {
      try { const j = await graph(client, `${id}/insights`, { params: { fields, time_range } }); if (j.data?.[0]) out[id] = j.data[0]; } catch (e) { if (/permiso/.test(e.message)) throw e; }
    }
  }
  return out;
}

/** Tabla de rendimiento por anuncio (y totales). */
export async function rendimiento(client, { dias = 30, ahora = new Date() } = {}) {
  const { desde, hasta } = rango(dias, ahora);
  const leads = db.getDb().prepare(`SELECT id, anuncio_id, anuncio, campana, conjunto, resultado, valor, estado, created_at FROM leads
    WHERE client_id = ? AND ajena = 0 AND anuncio_id IS NOT NULL AND date(created_at) BETWEEN ? AND ?`).all(client.id, desde, hasta);
  const conRespuesta = new Set(db.getDb().prepare(`SELECT DISTINCT m.lead_id FROM lead_mensajes m JOIN leads l ON l.id = m.lead_id
    WHERE l.client_id = ? AND m.rol = 'lead' GROUP BY m.lead_id HAVING COUNT(*) >= 2`).all(client.id).map((r) => r.lead_id));
  const porAnuncio = {};
  for (const l of leads) {
    const a = (porAnuncio[l.anuncio_id] ||= { ad_id: l.anuncio_id, anuncio: l.anuncio || '', campana: l.campana || '', conjunto: l.conjunto || '', leads: 0, conversaciones: 0, ventas: 0, ingreso: 0 });
    a.leads++; if (conRespuesta.has(l.id)) a.conversaciones++;
    if (l.resultado === 'vendido') { a.ventas++; a.ingreso += Number(l.valor) || 0; }
  }
  let meta = {}, error = '';
  if (listo(client)) { try { meta = await gastoMeta(client, { desde, hasta }, Object.keys(porAnuncio)); } catch (e) { error = e.message; } }
  else error = 'Falta el token de anuncios de Meta (con permiso ads_read) para ver el gasto.';
  const ids = new Set([...Object.keys(porAnuncio), ...Object.keys(meta)]);
  const filas = [...ids].map((id) => {
    const a = porAnuncio[id] || { ad_id: id, anuncio: '', campana: '', conjunto: '', leads: 0, conversaciones: 0, ventas: 0, ingreso: 0 };
    const m = meta[id] || {};
    const gasto = Number(m.spend) || 0;
    return { ...a, anuncio: m.ad_name || a.anuncio || `Anuncio ${id}`, campana: m.campaign_name || a.campana, conjunto: m.adset_name || a.conjunto,
      gasto, impresiones: Number(m.impressions) || 0, clics: Number(m.clicks) || 0,
      cpl: a.leads && gasto ? gasto / a.leads : null, costo_venta: a.ventas && gasto ? gasto / a.ventas : null, roas: gasto ? a.ingreso / gasto : null };
  }).sort((x, y) => y.gasto - x.gasto || y.leads - x.leads);
  const t = filas.reduce((s, f) => ({ gasto: s.gasto + f.gasto, leads: s.leads + f.leads, ventas: s.ventas + f.ventas, ingreso: s.ingreso + f.ingreso }), { gasto: 0, leads: 0, ventas: 0, ingreso: 0 });
  return { desde, hasta, dias, filas, totales: { ...t, cpl: t.leads && t.gasto ? t.gasto / t.leads : null, costo_venta: t.ventas && t.gasto ? t.gasto / t.ventas : null, roas: t.gasto ? t.ingreso / t.gasto : null }, error, con_cuenta: !!cuentaId(ajustes(client).cuenta) };
}

// ------------------------------------------------------------ recomendaciones de la IA
const S = { type: 'string' };
const obj = (p) => ({ type: 'object', additionalProperties: false, required: Object.keys(p), properties: p });
const SCHEMA = obj({
  resumen: S,
  acciones: { type: 'array', items: obj({ anuncio: S, accion: { type: 'string', enum: ['escalar', 'pausar', 'revisar', 'mantener'] }, por_que: S }) },
  ideas: { type: 'array', items: obj({ titulo: S, texto: S, por_que: S }) },
});
export async function recomendar(client, rend) {
  if (!rend.filas.length) throw new Error('Todavía no hay anuncios con datos en este periodo.');
  // Lo que preguntan quienes sí compraron por anuncio: para proponer textos de anuncios nuevos.
  const compradores = db.getDb().prepare(`SELECT m.texto FROM lead_mensajes m JOIN leads l ON l.id = m.lead_id
    WHERE l.client_id = ? AND l.resultado = 'vendido' AND l.anuncio_id IS NOT NULL AND m.rol = 'lead' ORDER BY m.id DESC LIMIT 60`).all(client.id).map((r) => String(r.texto).slice(0, 200));
  const tabla = rend.filas.slice(0, 40).map((f) => ({ anuncio: f.anuncio, campana: f.campana, gasto: Math.round(f.gasto), leads: f.leads, conversaciones: f.conversaciones, ventas: f.ventas, ingreso: Math.round(f.ingreso),
    costo_por_lead: f.cpl && Math.round(f.cpl), costo_por_venta: f.costo_venta && Math.round(f.costo_venta), roas: f.roas && Number(f.roas.toFixed(2)) }));
  const r = await hooks.ia({ etiqueta: 'anuncios', maxTokens: 2500, schema: SCHEMA,
    system: `Eres el analista de anuncios de ${client.nombre} (pesos mexicanos). Con la tabla de los últimos ${rend.dias} días: qué anuncio vende y cuál solo gasta.
- "resumen": 2 o 3 frases claras con lo más importante (qué funciona, qué no, cuánto dinero se está tirando).
- "acciones": por anuncio relevante, escalar (le subirías presupuesto: vende barato), pausar (gasta y no trae leads o ventas), revisar (trae leads pero no vende: el problema puede ser la atención o la oferta) o mantener. Explica con números.
- "ideas": 3 textos para anuncios nuevos (titular y texto corto) basados en lo que preguntan quienes sí compraron. Sin promesas que el negocio no haya hecho.
No inventes datos. Si hay pocos datos para concluir, dilo.`,
    messages: [{ role: 'user', content: `Totales: ${JSON.stringify(rend.totales)}\nAnuncios:\n${JSON.stringify(tabla)}\n\nLo que escribieron clientes que compraron:\n${compradores.join('\n') || '(sin ventas registradas todavía)'}` }] });
  const res = { fecha: new Date().toISOString(), resumen: String(r.data?.resumen || ''), acciones: (r.data?.acciones || []).slice(0, 20), ideas: (r.data?.ideas || []).slice(0, 5) };
  db.kvSet(`anuncios_ia:${client.id}`, JSON.stringify(res));
  return res;
}
export const ultimasRecomendaciones = (client) => { try { return JSON.parse(db.kvGet(`anuncios_ia:${client.id}`) || 'null'); } catch { return null; } };

// ------------------------------------------------------------ públicos para Meta
export const SEGMENTOS = { compradores: 'Clientes que compraron (Vendido)', leads: 'Todos los leads', sin_compra: 'Leads que no han comprado' };
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const telMeta = (t) => String(t || '').replace(/\D/g, '');

/** Datos del segmento ya cifrados (SHA-256) como los pide Meta: teléfono con lada y correo en minúsculas. */
export function datosSegmento(client, segmento) {
  if (!SEGMENTOS[segmento]) throw new Error('Segmento no válido');
  const filtro = segmento === 'compradores' ? "AND resultado = 'vendido'" : segmento === 'sin_compra' ? "AND (resultado IS NULL OR resultado != 'vendido')" : '';
  const filas = db.getDb().prepare(`SELECT telefono, email FROM leads WHERE client_id = ? AND ajena = 0 ${filtro}`).all(client.id);
  const datos = [];
  for (const f of filas) {
    const tel = telMeta(f.telefono), mail = String(f.email || '').trim().toLowerCase();
    if (tel.length < 10 && !mail) continue;
    datos.push([tel.length >= 10 ? sha(tel) : '', mail ? sha(mail) : '']);
  }
  return datos;
}

/** Crea (o actualiza) el público en la cuenta publicitaria y, si se pide, un público similar. */
export async function crearPublico(client, { segmento, similar = false, pais = 'MX' }) {
  const cuenta = cuentaId(ajustes(client).cuenta);
  if (!cuenta) throw new Error('Escribe primero el ID de la cuenta publicitaria (act_…).');
  if (!listo(client)) throw new Error('Falta el token de anuncios de Meta.');
  const datos = datosSegmento(client, segmento);
  if (datos.length < 100) throw new Error(`Ese segmento tiene ${datos.length} contactos con teléfono o correo; Meta pide al menos 100 para usar un público.`);
  const nombre = `Kuper · ${client.nombre} · ${SEGMENTOS[segmento]}`.slice(0, 100);
  const guardados = JSON.parse(db.kvGet(`publicos:${client.id}`) || '{}');
  let id = guardados[segmento]?.id;
  const nuevo = !id;
  if (!id) {
    const j = await graph(client, `${cuenta}/customaudiences`, { metodo: 'POST', body: { name: nombre, subtype: 'CUSTOM', customer_file_source: 'USER_PROVIDED_ONLY', description: 'Creado desde el panel de Kuper' } });
    id = j.id;
  }
  // Se mandan en bloques (Meta acepta hasta 10,000 por llamada).
  const sesion = { session_id: Number(String(Date.now()).slice(-9)), batch_seq: 1, last_batch_flag: false, estimated_num_total: datos.length };
  for (let i = 0; i < datos.length; i += 10000) {
    const bloque = datos.slice(i, i + 10000);
    sesion.last_batch_flag = i + 10000 >= datos.length;
    await graph(client, `${id}/${nuevo ? 'users' : 'usersreplace'}`, { metodo: 'POST', body: { session: { ...sesion }, payload: { schema: ['PHONE', 'EMAIL'], data: bloque } } });
    sesion.batch_seq++;
  }
  let similarId = guardados[segmento]?.similar_id || null;
  if (similar && !similarId) {
    const j = await graph(client, `${cuenta}/customaudiences`, { metodo: 'POST', body: { name: `${nombre} · similar 1% ${pais}`.slice(0, 100), subtype: 'LOOKALIKE', origin_audience_id: id, lookalike_spec: JSON.stringify({ type: 'similarity', country: pais, ratio: 0.01 }) } });
    similarId = j.id;
  }
  guardados[segmento] = { id, similar_id: similarId, contactos: datos.length, fecha: new Date().toISOString() };
  db.kvSet(`publicos:${client.id}`, JSON.stringify(guardados));
  db.logEvent({ clientId: client.id, tipo: 'publico_meta', detalle: `${SEGMENTOS[segmento]}: ${datos.length} contactos${similarId ? ' + similar' : ''}` });
  return guardados[segmento];
}
export const publicos = (client) => { try { return JSON.parse(db.kvGet(`publicos:${client.id}`) || '{}'); } catch { return {}; } };
