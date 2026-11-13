// Equipo: reparto automático de leads, tiempos de respuesta por asesor (con alerta antes de que el cliente se vaya)
// y encuesta de satisfacción al cerrar.
//
// client.config.equipo = { reparto: 'no' | 'turnos' | 'menos_carga', sla_min: 15, alertas: true,
//                          csat: { activo, plantilla, idioma, texto } }
// users.disponible = 0 → no recibe leads nuevos (vacaciones, fuera de turno).
import * as db from './db.js';
import { config } from './config.js';
import { sendMail, smtpConfigured } from './notify.js';
import * as push from './push.js';

export const hooks = { send: (m) => sendMail(m), enviar: null, ahora: () => new Date() }; // pruebas
export const REPARTOS = { no: 'No repartir (se asigna a mano)', turnos: 'Por turnos (uno y uno)', menos_carga: 'Al que tenga menos leads abiertos' };
export const ajustes = (client) => {
  const e = client?.config?.equipo || {};
  return { reparto: REPARTOS[e.reparto] ? e.reparto : 'no', sla_min: Math.min(24 * 60, Math.max(1, Number(e.sla_min) || 15)), alertas: e.alertas !== false,
    csat: { activo: false, plantilla: '', idioma: 'es_MX', texto: 'Del 1 al 5, ¿qué tan bien te atendimos? Responde solo con el número 🙏', ...(e.csat || {}) } };
};

let listo = false;
const d = () => {
  if (!listo) {
    listo = true;
    const g = db.getDb();
    const cols = g.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
    if (!cols.includes('disponible')) g.exec('ALTER TABLE users ADD COLUMN disponible INTEGER NOT NULL DEFAULT 1');
    g.exec(`CREATE TABLE IF NOT EXISTS csat (
      id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, lead_id INTEGER NOT NULL, asesor_id INTEGER,
      enviada_at TEXT NOT NULL DEFAULT (datetime('now')), calificacion INTEGER, respondida_at TEXT);
    CREATE INDEX IF NOT EXISTS csat_lead ON csat(lead_id, id);`);
  }
  return db.getDb();
};
const iso = (t) => new Date(t).toISOString().replace('T', ' ').slice(0, 19);
const asesoresDe = (client, { soloDisponibles = false } = {}) => d().prepare(`SELECT id, nombre, email, disponible FROM users WHERE client_id = ? AND rol = 'cliente' AND activo = 1 AND COALESCE(permiso, '') != 'caja'${soloDisponibles ? ' AND disponible = 1' : ''} ORDER BY nombre`).all(client.id);
export const setDisponible = (client, userId, si) => d().prepare('UPDATE users SET disponible = ? WHERE id = ? AND client_id = ?').run(si ? 1 : 0, userId, client.id);

// ------------------------------------------------------------ reparto
const abiertos = (client, asesorId) => d().prepare(`SELECT COUNT(*) n FROM leads WHERE client_id = ? AND asignado_id = ? AND resultado IS NULL AND estado != 'perdido' AND datetime(updated_at) >= datetime('now', '-14 days')`).get(client.id, asesorId).n;
/** Asigna un lead sin asesor según el reparto de la marca. Devuelve el lead (actualizado o igual). */
export function repartir(client, lead) {
  const aj = ajustes(client);
  if (!lead || lead.asignado_id || aj.reparto === 'no') return lead;
  const lista = asesoresDe(client, { soloDisponibles: true });
  if (!lista.length) return lead;
  let elegido;
  if (aj.reparto === 'menos_carga') elegido = lista.map((a) => ({ a, n: abiertos(client, a.id) })).sort((x, y) => x.n - y.n || x.a.id - y.a.id)[0].a;
  else {
    const k = `turno_asesor:${client.id}`;
    const i = (Number(db.kvGet(k)) || 0) % lista.length;
    db.kvSet(k, i + 1);
    elegido = lista[i];
  }
  d().prepare('UPDATE leads SET asignado_id = ? WHERE id = ? AND asignado_id IS NULL').run(elegido.id, lead.id);
  return db.getLead(client.id, lead.id);
}
export function repartirTelefono(client, telefono) {
  if (ajustes(client).reparto === 'no' || !telefono) return null;
  const dig = String(telefono).replace(/\D/g, '').slice(-10);
  const l = d().prepare('SELECT * FROM leads WHERE client_id = ? AND telefono LIKE ? ORDER BY updated_at DESC LIMIT 1').get(client.id, `%${dig}`);
  return l ? repartir(client, l) : null;
}

// ------------------------------------------------------------ tiempos de respuesta
/** Por asesor: primera respuesta de una persona del equipo después de que el cliente escribe (conversaciones en manos del equipo). */
export function rendimiento(client, { dias = 30, ahora = hooks.ahora() } = {}) {
  const aj = ajustes(client);
  const desde = iso(ahora.getTime() - dias * 86400000);
  const filas = d().prepare(`SELECT m.lead_id, m.rol, m.created_at, l.asignado_id FROM lead_mensajes m JOIN leads l ON l.id = m.lead_id
    WHERE l.client_id = ? AND datetime(m.created_at) >= datetime(?) ORDER BY m.lead_id, m.id`).all(client.id, desde);
  const porAsesor = new Map();
  const reg = (id) => { if (!porAsesor.has(id)) porAsesor.set(id, { tiempos: [], dentro: 0 }); return porAsesor.get(id); };
  let espera = null, leadActual = null;
  for (const f of filas) {
    if (f.lead_id !== leadActual) { leadActual = f.lead_id; espera = null; }
    if (f.rol === 'lead') { if (!espera) espera = f.created_at; continue; }
    if (f.rol === 'humano' && espera) {
      const min = (new Date(`${f.created_at.replace(' ', 'T')}Z`) - new Date(`${espera.replace(' ', 'T')}Z`)) / 60000;
      const r = reg(f.asignado_id || 0);
      r.tiempos.push(min); if (min <= aj.sla_min) r.dentro++;
    }
    espera = null; // contestó alguien (IA o equipo)
  }
  const mediana = (xs) => { if (!xs.length) return null; const a = [...xs].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  const esperando = esperandoAhora(client, ahora);
  const csat = d().prepare(`SELECT asesor_id, AVG(calificacion) prom, COUNT(calificacion) n FROM csat WHERE client_id = ? AND calificacion IS NOT NULL AND datetime(enviada_at) >= datetime(?) GROUP BY asesor_id`).all(client.id, desde);
  const vendidos = d().prepare(`SELECT asignado_id, COUNT(*) n FROM leads WHERE client_id = ? AND resultado = 'vendido' AND datetime(updated_at) >= datetime(?) GROUP BY asignado_id`).all(client.id, desde);
  return asesoresDe(client).map((a) => {
    const r = porAsesor.get(a.id) || { tiempos: [], dentro: 0 };
    const c = csat.find((x) => x.asesor_id === a.id);
    return { ...a, abiertos: abiertos(client, a.id), respuestas: r.tiempos.length, mediana_min: mediana(r.tiempos), en_sla: r.tiempos.length ? Math.round((r.dentro / r.tiempos.length) * 100) : null,
      esperando: esperando.filter((l) => l.asignado_id === a.id).length, csat: c ? Math.round(c.prom * 10) / 10 : null, csat_n: c?.n || 0, vendidos: vendidos.find((x) => x.asignado_id === a.id)?.n || 0 };
  });
}
/** Conversaciones en manos del equipo donde el cliente escribió y nadie le ha contestado (más allá del tiempo meta). */
export function esperandoAhora(client, ahora = hooks.ahora()) {
  const sla = ajustes(client).sla_min;
  return d().prepare(`SELECT l.*, m.created_at AS espera_desde FROM leads l JOIN lead_mensajes m ON m.id = (SELECT MAX(id) FROM lead_mensajes WHERE lead_id = l.id)
    WHERE l.client_id = ? AND l.control = 'humano' AND m.rol = 'lead' AND datetime(m.created_at) <= datetime(?) AND datetime(m.created_at) >= datetime(?)`)
    .all(client.id, iso(ahora.getTime() - sla * 60000), iso(ahora.getTime() - 3 * 86400000));
}
/** Avisa por correo (al asesor y al correo de avisos) de cada conversación que pasó el tiempo meta, una vez por espera. */
export async function alertar(client, { ahora = hooks.ahora() } = {}) {
  const aj = ajustes(client);
  if (!aj.alertas) return { enviadas: 0 };
  let enviadas = 0;
  for (const l of esperandoAhora(client, ahora)) {
    const k = `sla_alerta:${l.id}:${l.espera_desde}`;
    if (db.kvGet(k)) continue;
    db.kvSet(k, '1');
    const asesor = l.asignado_id ? db.getUser(l.asignado_id) : null;
    const minutos = Math.round((ahora - new Date(`${l.espera_desde.replace(' ', 'T')}Z`)) / 60000);
    push.avisar(client, { titulo: `⏱️ ${l.nombre || l.telefono} lleva ${minutos} min esperando`, texto: 'Contesta antes de que se vaya.', url: `/app/leads/${l.id}/chat`, lead: l }).catch(() => {});
    const para = [asesor?.activo ? asesor.email : '', String(client.config.notificaciones?.email || '').trim()].filter(Boolean).join(', ');
    if (!para || !smtpConfigured()) continue;
    const min = Math.round((ahora - new Date(`${l.espera_desde.replace(' ', 'T')}Z`)) / 60000);
    await hooks.send({ to: para, subject: `⏱️ ${l.nombre || l.telefono || 'Un cliente'} lleva ${min} min esperando respuesta`.slice(0, 140),
      text: `${l.nombre || l.telefono} escribió hace ${min} minutos y nadie del equipo le ha contestado (meta: ${aj.sla_min} min).\n${config.publicBaseUrl}/app/leads/${l.id}/chat`,
      html: `<p><b>${String(l.nombre || l.telefono || 'Un cliente').replace(/</g, '&lt;')}</b> escribió hace ${min} minutos y nadie del equipo le ha contestado (meta: ${aj.sla_min} min).</p><p><a href="${config.publicBaseUrl}/app/leads/${l.id}/chat">Contestar ahora</a></p>` }).catch(() => {});
    db.logEvent({ clientId: client.id, tipo: 'sla_alerta', detalle: `${l.nombre || l.telefono}: ${min} min${asesor ? ` · ${asesor.nombre}` : ''}` });
    enviadas++;
  }
  return { enviadas };
}

// ------------------------------------------------------------ encuesta de satisfacción
/** Al cerrar un lead (vendido o resuelto), se le pregunta del 1 al 5 qué tan bien lo atendieron. */
export async function enviarEncuesta(client, lead) {
  const aj = ajustes(client).csat;
  if (!aj.activo || !lead?.telefono) return { enviada: false };
  if (d().prepare("SELECT 1 FROM csat WHERE lead_id = ? AND datetime(enviada_at) >= datetime('now', '-7 days')").get(lead.id)) return { enviada: false, motivo: 'reciente' };
  const enviar = hooks.enviar || (await import('./difusion.js')).enviarPlantilla;
  if (!aj.plantilla) return { enviada: false, motivo: 'sin_plantilla' };
  await enviar(client, { telefono: String(lead.telefono).replace(/\D/g, ''), plantilla: aj.plantilla, idioma: aj.idioma, vals: [String(lead.nombre || '').split(' ')[0] || 'hola'],
    texto: aj.texto, leadId: lead.id, autor: 'Encuesta' });
  d().prepare('INSERT INTO csat (client_id, lead_id, asesor_id) VALUES (?, ?, ?)').run(client.id, lead.id, lead.asignado_id || null);
  return { enviada: true };
}
/** Si el cliente contesta con un número del 1 al 5 a una encuesta pendiente, se guarda. */
export function capturar(client, telefono, texto) {
  const m = String(texto || '').trim().match(/^([1-5])(\s*(estrellas?|⭐+))?[\s.!]*$/i) || String(texto || '').trim().match(/^(⭐{1,5})$/);
  if (!m || !telefono) return null;
  const valor = m[1].startsWith('⭐') ? m[1].length : Number(m[1]);
  const dig = String(telefono).replace(/\D/g, '').slice(-10);
  const p = d().prepare(`SELECT c.* FROM csat c JOIN leads l ON l.id = c.lead_id WHERE c.client_id = ? AND l.telefono LIKE ? AND c.calificacion IS NULL AND datetime(c.enviada_at) >= datetime('now', '-3 days') ORDER BY c.id DESC LIMIT 1`).get(client.id, `%${dig}`);
  if (!p) return null;
  d().prepare("UPDATE csat SET calificacion = ?, respondida_at = datetime('now') WHERE id = ?").run(valor, p.id);
  db.logEvent({ clientId: client.id, tipo: 'csat', detalle: `${valor}/5` });
  return valor;
}
export function resumenCsat(clientId, dias = 30) {
  const r = d().prepare(`SELECT COUNT(*) enviadas, COUNT(calificacion) respondidas, AVG(calificacion) prom FROM csat WHERE client_id = ? AND datetime(enviada_at) >= datetime('now', ?)`).get(clientId, `-${dias} days`);
  return { enviadas: r.enviadas || 0, respondidas: r.respondidas || 0, promedio: r.prom ? Math.round(r.prom * 10) / 10 : null };
}
