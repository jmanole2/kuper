// Datos del centro de control (página de inicio del panel): actividad de hoy, series de 14 días,
// leads, citas y lo último que hizo cada agente. Todo sale de la base; las citas, de Google Calendar.
import { config } from './config.js';
import { getDb, LEAD_ESTADOS } from './db.js';
import * as agenda from './agenda/index.js';

const DAY = 86400_000;
const utc = (s) => new Date(String(s).replace(' ', 'T') + (String(s).endsWith('Z') ? '' : 'Z'));
const fmtKey = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtHour = new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, hour: '2-digit', hourCycle: 'h23' });
const dayKey = (d) => fmtKey.format(d);
const hourOf = (d) => Number(fmtHour.format(d));

// Cómo se ve cada evento en el feed.
const FEED = {
  publicado: ['Post publicado', 'post'], historia_publicada: ['Historia publicada', 'post'], generado: ['Post creado', 'spark'],
  aprobado: ['Post aprobado', 'check'], cita_agendada: ['Cita agendada', 'cal'], cita_cancelada: ['Cita cancelada', 'cal'],
  palabra_clave: ['DM enviado', 'chat'], aviso_enviado: ['Aviso al cliente', 'mail'], competencia_analizada: ['Competencia analizada', 'eye'],
  asset_subido: ['Archivo recibido', 'post'], cambios_solicitados: ['Cambios pedidos', 'spark'],
};
const ERROR = /error|fallo|interrumpido/;

const citasCache = new Map(); // ids de clientes -> { at, data }
async function citas(clients, now) {
  const key = clients.map((c) => c.id).join(',');
  const hit = citasCache.get(key);
  if (hit && now - hit.at < 60_000) return hit.data;
  const out = { hoy: 0, semana: 0, proximas: [], porDia: [], libres: null, error: null };
  const dias = Array.from({ length: 7 }, (_, i) => dayKey(new Date(now.getTime() + i * DAY)));
  const porDia = Object.fromEntries(dias.map((d) => [d, []]));
  for (const c of clients) {
    const cfg = agenda.agendaCfg(c);
    if (!cfg.calendar_id) continue;
    try {
      const evs = await agenda.upcomingEvents(cfg.calendar_id, 80);
      for (const e of evs) {
        const ini = new Date(e.start?.dateTime || e.start?.date);
        const k = dayKey(ini);
        if (!(k in porDia)) continue;
        const kuper = e.extendedProperties?.private?.kuper === '1';
        porDia[k].push({ hora: hourOf(ini), kuper });
        if (kuper) {
          out.semana++;
          if (k === dias[0]) out.hoy++;
          if (out.proximas.length < 3) out.proximas.push({ cliente: c.nombre, titulo: e.summary || 'Cita', inicio: ini.toISOString() });
        }
      }
      if (out.libres == null) out.libres = (await agenda.availability(c, { dias: 7 }).catch(() => [])).length;
    } catch (e) { out.error = e.message; }
  }
  out.porDia = dias.map((d) => ({ dia: d, eventos: porDia[d] }));
  citasCache.set(key, { at: now.getTime(), data: out });
  return out;
}

export async function pulse(clients, { now = new Date(), conCitas = true, clientId = null } = {}) {
  // Con clientId solo cuenta lo de esa marca (vista del cliente).
  if (clientId) clients = clients.filter((c) => c.id === clientId);
  const f = clientId ? ' AND client_id = ' + Number(clientId) : '';
  const db = getDb();
  const desde = new Date(now.getTime() - 15 * DAY).toISOString().replace('T', ' ').slice(0, 19);
  const nombres = Object.fromEntries(clients.map((c) => [c.id, c.nombre]));
  const events = db.prepare(`SELECT id, client_id, tipo, detalle, created_at FROM events WHERE created_at >= ?${f} ORDER BY id DESC`).all(desde);
  const msgs = db.prepare(`SELECT m.id, m.rol, m.texto, m.created_at, l.nombre, l.telefono, l.usuario, l.client_id FROM lead_mensajes m
    JOIN leads l ON l.id = m.lead_id WHERE m.created_at >= ?${clientId ? ' AND l.client_id = ' + Number(clientId) : ''} ORDER BY m.id DESC`).all(desde);
  const leads = db.prepare(`SELECT estado, origen, created_at FROM leads WHERE 1=1${f}`).all();
  const posts = db.prepare(`SELECT status, COUNT(*) n FROM posts WHERE 1=1${f} GROUP BY status`).all();
  const pc = Object.fromEntries(posts.map((r) => [r.status, r.n]));

  const hoy = dayKey(now), ayer = dayKey(new Date(now.getTime() - DAY));
  const dias = Array.from({ length: 14 }, (_, i) => dayKey(new Date(now.getTime() - (13 - i) * DAY)));
  const serie = Object.fromEntries(dias.map((d) => [d, { tareas: 0, posts: 0, mensajes: 0, leads: 0 }]));
  const horas = Array.from({ length: 24 }, () => ({ eventos: 0, mensajes: 0 }));
  let tareasHoy = 0, tareasAyer = 0;
  for (const e of events) {
    const d = utc(e.created_at), k = dayKey(d);
    if (serie[k]) { serie[k].tareas++; if (['publicado', 'historia_publicada'].includes(e.tipo)) serie[k].posts++; }
    if (k === hoy) { tareasHoy++; horas[hourOf(d)].eventos++; }
    if (k === ayer) tareasAyer++;
  }
  for (const m of msgs) {
    if (m.rol !== 'agente') continue;
    const d = utc(m.created_at), k = dayKey(d);
    if (serie[k]) { serie[k].tareas++; serie[k].mensajes++; }
    if (k === hoy) { tareasHoy++; horas[hourOf(d)].mensajes++; }
    if (k === ayer) tareasAyer++;
  }
  for (const l of leads) { const k = dayKey(utc(l.created_at)); if (serie[k]) serie[k].leads++; }

  const porEstado = Object.fromEntries(Object.keys(LEAD_ESTADOS).map((k) => [k, 0]));
  for (const l of leads) porEstado[l.estado] = (porEstado[l.estado] || 0) + 1;

  // Feed: eventos + mensajes recibidos, lo más nuevo primero.
  const feed = [
    ...events.slice(0, 40).filter((e) => FEED[e.tipo] || ERROR.test(e.tipo)).map((e) => ({
      t: utc(e.created_at).toISOString(), titulo: FEED[e.tipo]?.[0] || 'Algo falló', icono: FEED[e.tipo]?.[1] || 'alert', error: !FEED[e.tipo],
      detalle: [nombres[e.client_id], String(e.detalle || '').slice(0, 70)].filter(Boolean).join(' · '),
    })),
    ...msgs.slice(0, 40).filter((m) => m.rol === 'lead').map((m) => ({
      t: utc(m.created_at).toISOString(), titulo: 'WhatsApp recibido', icono: 'chat',
      detalle: `${m.nombre || m.telefono || m.usuario || 'Lead'} · ${String(m.texto).replace(/^\[[^\]]+\]\s*/, '').slice(0, 60)}`,
    })),
  ].sort((a, b) => b.t.localeCompare(a.t)).slice(0, 5);

  // "En vivo": la última respuesta del agente de WhatsApp (o lo último que pasó).
  const ult = msgs.find((m) => m.rol === 'agente');
  const vivo = ult ? {
    nombre: ult.nombre || ult.telefono || 'Lead', canal: 'WhatsApp', t: utc(ult.created_at).toISOString(),
    texto: String(ult.texto).replace(/^\[bot[oó]n [^\]]+\]\s*/i, '').slice(0, 160), activo: now - utc(ult.created_at) < 10 * 60_000,
  } : feed[0] ? { nombre: feed[0].titulo, canal: 'Agente social', t: feed[0].t, texto: feed[0].detalle, activo: now - new Date(feed[0].t) < 10 * 60_000 } : null;

  const sem = dias.slice(-7).map((d) => serie[d]);
  const horasAhorradas = sem.map((s) => Math.round((s.posts * 0.75 + s.mensajes * 0.04 + s.tareas * 0.05) * 10) / 10);
  const revisados = (pc.aprobado || 0) + (pc.publicado || 0) + (pc.rechazado || 0) + (pc.publicando || 0);
  return {
    ahora: now.toISOString(),
    marcas: clients.filter((c) => c.activo).length,
    tareasHoy, tareasAyer,
    horas: horas.map((h, i) => ({ hora: i, ...h })),
    serie: dias.map((d) => ({ dia: d, ...serie[d] })),
    horasAhorradas, horasSemana: Math.round(horasAhorradas.reduce((a, b) => a + b, 0) * 10) / 10,
    aprobacion: revisados ? Math.round((((pc.aprobado || 0) + (pc.publicado || 0) + (pc.publicando || 0)) / revisados) * 100) : null,
    posts: { revisar: (pc.pendiente || 0) + (pc.necesita_asset || 0), programados: (pc.aprobado || 0) + (pc.publicando || 0), publicados: pc.publicado || 0 },
    leads: { total: leads.length, porEstado, hoy: serie[hoy]?.leads || 0, whatsapp: leads.filter((l) => l.origen === 'whatsapp').length },
    mensajesHoy: serie[hoy]?.mensajes || 0,
    feed, vivo,
    citas: conCitas ? await citas(clients, now) : null,
  };
}
