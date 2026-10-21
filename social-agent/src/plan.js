// Plan contratado por cada cliente: qué servicios tiene (y por lo tanto qué secciones ve),
// cuántas publicaciones incluye y lo que se le cobra. Vive en client.config.plan.
import { getDb } from './db.js';
import { config } from './config.js';
import { localDate, addDays } from './schedule.js';

export const SERVICIOS = {
  redes: { nombre: 'Redes sociales', desc: 'Publicaciones automáticas en Instagram, Facebook, TikTok y LinkedIn, competencia y palabra clave.', tabs: ['posts', 'competencia', 'palabra'] },
  chat: { nombre: 'Agente de IA (chat)', desc: 'Responde en WhatsApp, Messenger e Instagram y registra cada lead.', tabs: ['leads', 'agente'] },
  agenda: { nombre: 'Agenda de citas', desc: 'Citas en Google Calendar sin encimarse, con recordatorios.', tabs: ['citas'] },
  llamadas: { nombre: 'Agente de llamadas', desc: 'Contesta y hace llamadas telefónicas.', tabs: ['llamadas'], proximamente: true },
  videollamadas: { nombre: 'Agente de videollamadas', desc: 'Atiende videollamadas con un avatar.', tabs: ['videollamadas'], proximamente: true },
};

const DEFAULT = {
  servicios: { redes: true, chat: true, agenda: true, llamadas: false, videollamadas: false }, // clientes de antes: lo que ya tenían
  posts_semana: 3,
  extra_gratis_mes: 1,
  precio_extra: 150,
  conceptos: [], // [{ nombre, monto, tipo: 'mensual' | 'unico' }] en MXN
  cobro: 'stripe', // 'stripe' (tarjeta domiciliada) | 'cortesia' (gratis) | 'externo' (transferencia, efectivo…)
  prueba_hasta: '', // 'YYYY-MM-DD': prueba gratis hasta ese día (inclusive)
};
export const COBROS = { stripe: 'Tarjeta domiciliada (Stripe)', cortesia: 'Cortesía: gratis', externo: 'Paga por fuera (transferencia, efectivo…)' };

export function planDe(client) {
  const p = client?.config?.plan || {};
  return { ...DEFAULT, ...p, servicios: { ...DEFAULT.servicios, ...(p.servicios || {}) }, conceptos: Array.isArray(p.conceptos) ? p.conceptos : [] };
}
export const tiene = (client, servicio) => !!planDe(client).servicios[servicio];
/** ¿Esta pestaña/sección está contratada? (config siempre está) */
export function tabActiva(client, tab) {
  if (tab === 'config') return true;
  const s = Object.entries(SERVICIOS).find(([, v]) => v.tabs.includes(tab));
  return !s || tiene(client, s[0]);
}
/** Cómo se le cobra hoy: 'prueba' mientras dure la prueba gratis; si no, lo que diga el plan. */
export function modoCobro(client, now = new Date()) {
  const p = planDe(client);
  if (p.prueba_hasta && p.prueba_hasta >= localDate(now, config.timezone)) return 'prueba';
  return COBROS[p.cobro] ? p.cobro : 'stripe';
}
export const sinCosto = (client, now) => ['cortesia', 'prueba'].includes(modoCobro(client, now));
export const mensualidad = (client) => planDe(client).conceptos.filter((c) => c.tipo !== 'unico').reduce((n, c) => n + (Number(c.monto) || 0), 0);
export const mxn = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);

/** "Nombre | 499 | mensual" por línea -> conceptos. */
export function parseConceptos(text) {
  return String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [nombre, monto, tipo] = l.split('|').map((x) => x.trim());
    const n = Number(String(monto || '').replace(/[$,\s]/g, ''));
    if (!nombre || !Number.isFinite(n) || n <= 0) throw new Error(`Concepto no válido: "${l}" (usa: Nombre | monto | mensual o único)`);
    return { nombre: nombre.slice(0, 80), monto: Math.round(n * 100) / 100, tipo: /^u/i.test(String(tipo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')) ? 'unico' : 'mensual' };
  });
}
export const conceptosTexto = (plan) => plan.conceptos.map((c) => `${c.nombre} | ${c.monto} | ${c.tipo === 'unico' ? 'único' : 'mensual'}`).join('\n');

// ------------------------------------------------------------ publicaciones de la semana y extras
export function semanaActual(now = new Date()) {
  const hoy = localDate(now, config.timezone);
  const dow = (new Date(`${hoy}T12:00:00Z`).getUTCDay() + 6) % 7; // lunes = 0
  const lunes = addDays(hoy, -dow);
  return { desde: lunes, hasta: addDays(lunes, 6) };
}
export function postsDeLaSemana(clientId, now = new Date()) {
  const { desde, hasta } = semanaActual(now);
  return getDb().prepare(`SELECT scheduled_at, status, plataforma FROM posts WHERE client_id = ? AND scheduled_at IS NOT NULL
    AND status IN ('pendiente','necesita_asset','aprobado','publicando','publicado')`).all(clientId)
    .filter((p) => { const d = localDate(p.scheduled_at, config.timezone); return d >= desde && d <= hasta; }).length;
}
const mesActual = (now = new Date()) => localDate(now, config.timezone).slice(0, 7);
export const extrasDelMes = (clientId, now = new Date()) => getDb()
  .prepare("SELECT * FROM extras WHERE client_id = ? AND mes = ? AND estado IN ('gratis','pagado','por_cobrar') ORDER BY id").all(clientId, mesActual(now));
/** Lo que costaría el siguiente post extra: 0 si aún le queda uno gratis este mes. */
export function costoExtra(client, now = new Date()) {
  const p = planDe(client), usados = extrasDelMes(client.id, now).filter((e) => e.estado === 'gratis').length;
  const modo = modoCobro(client, now);
  if (modo === 'cortesia' || modo === 'prueba') return { gratisRestantes: Infinity, monto: 0, modo }; // sin costo: extras gratis
  return { gratisRestantes: Math.max(0, p.extra_gratis_mes - usados), monto: usados < p.extra_gratis_mes ? 0 : p.precio_extra, modo };
}
export function registrarExtra(clientId, { plataforma, monto, estado, factura = null }, now = new Date()) {
  const r = getDb().prepare('INSERT INTO extras (client_id, mes, plataforma, monto, estado, factura) VALUES (?, ?, ?, ?, ?, ?)')
    .run(clientId, mesActual(now), plataforma, monto, estado, factura);
  return Number(r.lastInsertRowid);
}
