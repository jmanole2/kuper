// Métricas de redes (Instagram y Facebook) y resumen mensual por cliente.
// Una foto al día de seguidores e interacciones; el reporte del mes junta eso con lo que hicieron
// los agentes (publicaciones, respuestas, leads, citas).
import { config } from './config.js';
import * as db from './db.js';
import { graphCall } from './publishers/meta.js';
import { tiene, planDe } from './plan.js';
import { localDate } from './schedule.js';

const DAY = 86400_000;
const getDb = () => db.getDb();
export const hooks = {}; // pruebas: hooks.graph

export function ensureTables() {
  getDb().exec(`CREATE TABLE IF NOT EXISTS metricas (
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    fecha TEXT NOT NULL, red TEXT NOT NULL,
    seguidores INTEGER, publicaciones INTEGER, alcance INTEGER, interacciones INTEGER,
    detalle_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (client_id, fecha, red))`);
}

const hoyLocal = (now = new Date()) => localDate(now, config.timezone);

/** Toma la foto del día de Instagram y Facebook. Tolera permisos faltantes (insights) sin romper. */
export async function recolectar(client, now = new Date()) {
  ensureTables();
  const meta = db.clientCredentials(client).meta || {};
  if (!meta.page_token) return { omitido: 'sin_token' };
  const g = hooks.graph || graphCall;
  const fecha = hoyLocal(now), res = {};
  const guardar = (red, f) => getDb().prepare(`INSERT OR REPLACE INTO metricas (client_id, fecha, red, seguidores, publicaciones, alcance, interacciones, detalle_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(client.id, fecha, red, f.seguidores ?? null, f.publicaciones ?? null, f.alcance ?? null, f.interacciones ?? null, JSON.stringify(f.detalle || {}));
  if (meta.ig_user_id) {
    try {
      const acct = await g('GET', meta.ig_user_id, { fields: 'followers_count,media_count,username' }, meta.page_token);
      const media = (await g('GET', `${meta.ig_user_id}/media`, { fields: 'id,caption,media_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url', limit: '30' }, meta.page_token)).data || [];
      const recientes = media.filter((m) => now - new Date(m.timestamp) < 40 * DAY);
      for (const m of recientes) {
        try {
          const ins = await g('GET', `${m.id}/insights`, { metric: 'reach,total_interactions' }, meta.page_token);
          for (const x of ins.data || []) m[x.name] = x.values?.[0]?.value ?? x.total_value?.value ?? null;
        } catch { /* sin permiso de insights o tipo de media sin métricas */ }
      }
      const posts = recientes.map((m) => ({ id: m.id, tipo: m.media_type, link: m.permalink, fecha: m.timestamp, texto: String(m.caption || '').slice(0, 140),
        imagen: m.thumbnail_url || m.media_url || null, likes: m.like_count ?? 0, comentarios: m.comments_count ?? 0,
        alcance: m.reach ?? null, interacciones: m.total_interactions ?? (m.like_count ?? 0) + (m.comments_count ?? 0) }));
      res.instagram = { seguidores: acct.followers_count, publicaciones: acct.media_count, alcance: posts.reduce((n, p) => n + (p.alcance || 0), 0) || null,
        interacciones: posts.reduce((n, p) => n + (p.interacciones || 0), 0), detalle: { usuario: acct.username, posts } };
      guardar('instagram', res.instagram);
    } catch (e) { res.instagramError = e.message; }
  }
  if (meta.page_id) {
    try {
      const p = await g('GET', meta.page_id, { fields: 'followers_count,fan_count,name' }, meta.page_token);
      res.facebook = { seguidores: p.followers_count ?? p.fan_count ?? null, detalle: { nombre: p.name } };
      guardar('facebook', res.facebook);
    } catch (e) { res.facebookError = e.message; }
  }
  return res;
}

/** Una vez al día por cliente (después de las 7:00), solo si contrató redes. */
export async function recolectarSiToca(client, now = new Date()) {
  if (!client.activo || !tiene(client, 'redes')) return null;
  const key = `metricas_${client.id}`, hoy = hoyLocal(now);
  if (db.kvGet(key) === hoy || Number(new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, hour: '2-digit', hourCycle: 'h23' }).format(now)) < 7) return null;
  db.kvSet(key, hoy);
  const r = await recolectar(client, now);
  if (r.instagramError || r.facebookError) db.logEvent({ clientId: client.id, tipo: 'metricas_error', detalle: [r.instagramError, r.facebookError].filter(Boolean).join(' · ').slice(0, 300) });
  return r;
}

// ------------------------------------------------------------ resumen del mes
export const mesActual = (now = new Date()) => hoyLocal(now).slice(0, 7);
export const mesAnterior = (now = new Date()) => { const [y, m] = mesActual(now).split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };
const enMes = (iso, mes) => !!iso && localDate(new Date(String(iso).replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? '' : 'Z')), config.timezone).startsWith(mes);
export const nombreMes = (mes) => new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${mes}-15T12:00:00Z`));

export function resumenMes(client, mes) {
  ensureTables();
  const d = getDb(), id = client.id;
  const posts = d.prepare("SELECT id, plataforma, tema, image_path, video_path, published_at, external_url FROM posts WHERE client_id = ? AND status = 'publicado' AND published_at IS NOT NULL").all(id).filter((p) => enMes(p.published_at, mes));
  const msgs = d.prepare("SELECT m.rol, m.created_at FROM lead_mensajes m JOIN leads l ON l.id = m.lead_id WHERE l.client_id = ?").all(id).filter((m) => enMes(m.created_at, mes));
  const leads = d.prepare('SELECT estado, origen, created_at, cita_inicio, updated_at FROM leads WHERE client_id = ?').all(id);
  const nuevos = leads.filter((l) => enMes(l.created_at, mes));
  const porOrigen = nuevos.reduce((o, l) => ({ ...o, [l.origen]: (o[l.origen] || 0) + 1 }), {});
  const citas = leads.filter((l) => enMes(l.cita_inicio, mes)).length;
  const clientes = leads.filter((l) => l.estado === 'cliente' && enMes(l.updated_at, mes)).length;
  const serie = (red) => d.prepare('SELECT * FROM metricas WHERE client_id = ? AND red = ? ORDER BY fecha').all(id, red);
  const redRes = (red) => {
    const all = serie(red), del = all.filter((r) => r.fecha.startsWith(mes)), antes = all.filter((r) => r.fecha < `${mes}-01`).at(-1);
    if (!del.length) return null;
    const ini = (antes || del[0]).seguidores, fin = del.at(-1).seguidores;
    return { seguidores: fin, crecimiento: fin != null && ini != null ? fin - ini : null, detalle: JSON.parse(del.at(-1).detalle_json || '{}'), puntos: del.map((r) => ({ fecha: r.fecha, seguidores: r.seguidores })) };
  };
  const ig = redRes('instagram'), fb = redRes('facebook');
  const igPosts = (ig?.detalle.posts || []).filter((p) => enMes(p.fecha, mes));
  const top = [...igPosts].sort((a, b) => (b.interacciones || 0) - (a.interacciones || 0)).slice(0, 3);
  const respuestas = msgs.filter((m) => m.rol === 'agente').length;
  return {
    mes, nombreMes: nombreMes(mes), cliente: client.nombre,
    publicaciones: posts.length, porRed: posts.reduce((o, p) => ({ ...o, [p.plataforma]: (o[p.plataforma] || 0) + 1 }), {}),
    respuestas, mensajesRecibidos: msgs.filter((m) => m.rol === 'lead').length,
    leads: nuevos.length, porOrigen, citas, clientes,
    instagram: ig ? { seguidores: ig.seguidores, crecimiento: ig.crecimiento, alcance: igPosts.reduce((n, p) => n + (p.alcance || 0), 0) || null, interacciones: igPosts.reduce((n, p) => n + (p.interacciones || 0), 0), usuario: ig.detalle.usuario, puntos: ig.puntos } : null,
    facebook: fb ? { seguidores: fb.seguidores, crecimiento: fb.crecimiento } : null,
    top,
    horasAhorradas: Math.round((posts.length * 0.75 + respuestas * 0.04 + citas * 0.25) * 10) / 10,
    servicios: planDe(client).servicios,
  };
}

// ------------------------------------------------------------ correo del reporte (día 1 a las 9:00, mes anterior)
export async function enviarReporteSiToca(client, now = new Date(), { send, armar } = {}) {
  const email = String(client.config.notificaciones?.email || '').trim();
  if (!client.activo || !email) return { skip: 'sin_correo' };
  const hora = Number(new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, hour: '2-digit', hourCycle: 'h23' }).format(now));
  if (hora < 9) return { skip: 'temprano' };
  const mes = mesAnterior(now), key = `reporte_${client.id}_${mes}`;
  if (db.kvGet(key)) return { skip: 'ya_enviado' };
  const r = resumenMes(client, mes);
  db.kvSet(key, now.toISOString());
  if (!r.publicaciones && !r.respuestas && !r.leads && !r.instagram) return { skip: 'sin_actividad' };
  const url = `${config.publicBaseUrl}/p/${client.portal_token}/reporte?mes=${mes}`;
  const m = armar(client, r, url);
  await send({ to: email, ...m });
  db.logEvent({ clientId: client.id, tipo: 'reporte_enviado', detalle: `${r.nombreMes} a ${email}` });
  return { enviado: true, mes };
}
export const ultimosMeses = (now = new Date(), n = 6) => {
  const out = []; let [y, m] = mesActual(now).split('-').map(Number);
  for (let i = 0; i < n; i++) { const mes = `${y}-${String(m).padStart(2, '0')}`; out.push({ mes, nombre: nombreMes(mes).replace(/ de \d+$/, '') }); m--; if (!m) { m = 12; y--; } }
  return out;
};
