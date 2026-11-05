// Embudo de ventas, ficha del lead y analítica.
// Cada cliente tiene sus etapas (client.config.embudo); cada etapa tiene un "tipo" que es el estado general
// del lead (nuevo, conversacion, cita, cliente, perdido), así los reportes y las listas de siempre siguen funcionando.
import * as db from './db.js';
import { config } from './config.js';

export const TIPOS = { nuevo: 'Nuevo', conversacion: 'En conversación', cita: 'Cita o visita', cliente: 'Cliente', perdido: 'Perdido' };
export const RESULTADOS = { vendido: 'Vendido', perdido: 'Perdido', resuelto: 'Resuelto' };
const COLORES = { nuevo: '#93b4ff', conversacion: '#fbbf24', cita: '#c9f53a', cliente: '#4ade80', perdido: '#f87171' };
export const colorTipo = (t) => COLORES[t] || '#93b4ff';

export const ETAPAS_BASE = [
  { id: 'nuevo', nombre: 'Nuevos', tipo: 'nuevo' },
  { id: 'contestado', nombre: 'Contestado', tipo: 'conversacion' },
  { id: 'seguimiento', nombre: 'En seguimiento', tipo: 'conversacion' },
  { id: 'cita', nombre: 'Cita o visita', tipo: 'cita' },
  { id: 'cliente', nombre: 'Clientes', tipo: 'cliente' },
  { id: 'perdido', nombre: 'Perdidos', tipo: 'perdido' },
];

const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export function etapas(client) {
  const e = Array.isArray(client?.config?.embudo) ? client.config.embudo.filter((x) => x && x.id && x.nombre && TIPOS[x.tipo]) : [];
  return e.length >= 2 ? e : ETAPAS_BASE;
}

/** "Nombre = tipo" por línea → etapas. El tipo puede ir en texto ("visita", "cliente"…). */
export function parseEtapas(texto) {
  const alias = { nuevo: 'nuevo', nuevos: 'nuevo', conversacion: 'conversacion', conversación: 'conversacion', seguimiento: 'conversacion', contestado: 'conversacion',
    cita: 'cita', visita: 'cita', citas: 'cita', cliente: 'cliente', clientes: 'cliente', vendido: 'cliente', perdido: 'perdido', perdidos: 'perdido' };
  const out = [], vistos = new Set();
  for (const linea of String(texto || '').split('\n')) {
    const [n, t = ''] = linea.split('=').map((x) => x.trim());
    if (!n) continue;
    const tipo = alias[slug(t).replace(/-/g, '')] || alias[t.toLowerCase()] || (TIPOS[t] ? t : 'conversacion');
    let id = slug(n) || `etapa-${out.length + 1}`;
    while (vistos.has(id)) id += '-2';
    vistos.add(id);
    out.push({ id, nombre: n.slice(0, 40), tipo });
  }
  if (out.length < 2) throw new Error('Pon al menos dos etapas, una por línea.');
  if (out.length > 14) throw new Error('Máximo 14 etapas.');
  return out;
}
export const etapasTexto = (lista) => lista.map((e) => `${e.nombre} = ${e.tipo}`).join('\n');

/** Etapa en la que se ve el lead: la que tiene guardada o, si no, la primera de su estado. */
export function etapaDe(client, lead) {
  const lista = etapas(client);
  return lista.find((e) => e.id === lead.etapa) || lista.find((e) => e.tipo === lead.estado) || lista[0];
}

export function moverLead(client, leadId, etapaId) {
  const e = etapas(client).find((x) => x.id === etapaId);
  if (!e) throw new Error('Etapa no válida');
  const lead = db.getLead(client.id, leadId);
  if (!lead) throw new Error('Lead no encontrado');
  const resultado = e.tipo === 'cliente' ? 'vendido' : e.tipo === 'perdido' ? 'perdido' : lead.resultado === 'vendido' || lead.resultado === 'perdido' ? null : lead.resultado;
  db.getDb().prepare("UPDATE leads SET etapa = ?, estado = ?, resultado = ?, updated_at = datetime('now') WHERE id = ? AND client_id = ?").run(e.id, e.tipo, resultado, leadId, client.id);
  return db.getLead(client.id, leadId);
}

/** El agente (o la API) mueve el lead: solo hacia adelante, y nunca saca a un lead de Clientes o Perdidos. */
export function avanzarPorAgente(client, lead, etapaId) {
  const lista = etapas(client);
  const actual = etapaDe(client, lead);
  // El agente puede mandar el tipo ("conversacion", "cita", "perdido"): va a la primera etapa de ese tipo que esté adelante.
  const destino = lista.find((x) => x.id === etapaId || slug(x.nombre) === slug(etapaId || ''))
    || (TIPOS[etapaId] ? lista.slice(lista.indexOf(actual) + 1).find((x) => x.tipo === etapaId) || (etapaId === 'perdido' ? lista.find((x) => x.tipo === 'perdido') : null) : null);
  if (!destino) return lead;
  if (actual.tipo === 'cliente' || actual.tipo === 'perdido') return lead;
  if (lista.indexOf(destino) <= lista.indexOf(actual) && destino.tipo !== 'perdido') return lead;
  return moverLead(client, lead.id, destino.id);
}

/** Lo que manda el agente con el lead: etapa (avanza), empresa, resumen de la conversación y etiquetas. */
export function datosDelAgente(client, lead, body = {}) {
  const txt = (v, n) => { const s = String(v ?? '').trim(); return s ? s.slice(0, n) : null; };
  const empresa = txt(body.empresa, 120), resumen = txt(body.resumen, 1500);
  const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim().slice(0, 30)).filter(Boolean) : [];
  if (empresa || resumen || tags.length) {
    const prev = tagsDe(lead);
    db.getDb().prepare('UPDATE leads SET empresa = COALESCE(empresa, ?), resumen = COALESCE(?, resumen), tags_json = ? WHERE id = ?')
      .run(empresa, resumen, JSON.stringify([...new Set([...prev, ...tags])].slice(0, 12)), lead.id);
    lead = db.getLead(client.id, lead.id);
  }
  if (body.etapa) lead = avanzarPorAgente(client, lead, String(body.etapa));
  return lead;
}

// ------------------------------------------------------------ ficha del lead
export const tagsDe = (lead) => { try { return JSON.parse(lead.tags_json || '[]'); } catch { return []; } };
export const asesores = (client) => db.getDb().prepare("SELECT id, nombre, email FROM users WHERE client_id = ? AND rol = 'cliente' AND activo = 1 ORDER BY nombre").all(client.id);

export function guardarFicha(client, leadId, body = {}) {
  const lead = db.getLead(client.id, leadId);
  if (!lead) throw new Error('Lead no encontrado');
  const txt = (v, n) => { const s = String(v ?? '').trim(); return s ? s.slice(0, n) : null; };
  const email = txt(body.email, 120);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('El correo no es válido');
  const valor = String(body.valor ?? '').replace(/[$,\s]/g, '');
  if (valor && !(Number(valor) >= 0)) throw new Error('El valor debe ser un número');
  const asignado = Number(body.asignado_id) || null;
  if (asignado && !asesores(client).some((a) => a.id === asignado)) throw new Error('Ese asesor no es de esta cuenta');
  const tags = String(body.tags || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12).map((t) => t.slice(0, 30));
  const resultado = RESULTADOS[body.resultado] ? body.resultado : null;
  db.getDb().prepare(`UPDATE leads SET nombre = COALESCE(?, nombre), email = ?, empresa = ?, valor = ?, nota = ?, tags_json = ?, asignado_id = ?, resultado = ?, updated_at = datetime('now')
    WHERE id = ? AND client_id = ?`).run(txt(body.nombre, 80), email ? email.toLowerCase() : null, txt(body.empresa, 120), valor ? Number(valor) : null, txt(body.nota, 1000),
    JSON.stringify(tags), asignado, resultado, leadId, client.id);
  // Vendido / Perdido mueve el lead a la etapa correspondiente.
  const lista = etapas(client);
  if (resultado === 'vendido' && lead.resultado !== 'vendido') { const e = lista.find((x) => x.tipo === 'cliente'); if (e) moverLead(client, leadId, e.id); }
  if (resultado === 'perdido' && lead.resultado !== 'perdido') { const e = lista.find((x) => x.tipo === 'perdido'); if (e) moverLead(client, leadId, e.id); }
  if (body.etapa && body.etapa !== etapaDe(client, lead).id) moverLead(client, leadId, String(body.etapa));
  return db.getLead(client.id, leadId);
}

/** Asigna el lead al siguiente asesor, por turnos (si no tiene ya uno). */
export function asignarPorTurno(client, lead) {
  if (!lead || lead.asignado_id) return lead;
  const lista = asesores(client);
  if (!lista.length) return lead;
  const k = `turno_asesor:${client.id}`;
  const i = (Number(db.kvGet(k)) || 0) % lista.length;
  db.kvSet(k, i + 1);
  db.getDb().prepare('UPDATE leads SET asignado_id = ? WHERE id = ?').run(lista[i].id, lead.id);
  return db.getLead(client.id, lead.id);
}

// ------------------------------------------------------------ analítica
const utc = (s) => new Date(String(s).replace(' ', 'T') + (String(s).endsWith('Z') ? '' : 'Z'));
const partes = (d) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: config.timezone, hour: 'numeric', hourCycle: 'h23', weekday: 'short' }).formatToParts(d).map((x) => [x.type, x.value]));
  return { hora: Number(p.hour) % 24, dia: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
};
const mediana = (xs) => { if (!xs.length) return null; const a = [...xs].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

export const TEMAS_BASE = [
  { nombre: 'Precio o cotización', palabras: ['precio', 'costo', 'cuanto', 'cuánto', 'cotiza', 'tarifa'] },
  { nombre: 'Agendar o disponibilidad', palabras: ['cita', 'agendar', 'disponib', 'reservar', 'horario', 'fecha'] },
  { nombre: 'Ubicación', palabras: ['ubicaci', 'direcci', 'donde', 'dónde', 'mapa', 'sucursal', 'sede'] },
  { nombre: 'Información general', palabras: ['informaci', 'info', 'detalles', 'más datos', 'me interesa'] },
];
export const temas = (client) => (Array.isArray(client?.config?.temas) && client.config.temas.length ? client.config.temas : TEMAS_BASE);

/** Horario del equipo (para "fuera de horario"): client.config.horario_equipo = { dias: [1..5], de: 8, a: 18 }. */
export const horarioEquipo = (client) => ({ dias: [1, 2, 3, 4, 5], de: 8, a: 18, ...(client?.config?.horario_equipo || {}) });

/** Cuándo contesta la IA: 'siempre' (por defecto) o 'fuera_de_horario' (el equipo atiende en su horario). */
export const MODOS_IA = { siempre: 'Siempre (las 24 horas)', fuera_de_horario: 'Solo fuera del horario del equipo' };
export const horarioIA = (client) => ({ modo: MODOS_IA[client?.config?.ia_modo] ? client.config.ia_modo : 'siempre', ...horarioEquipo(client), tz: config.timezone });
export function guardarHorario(client, body = {}) {
  const dias = [].concat(body.dias || []).map(Number).filter((d) => d >= 0 && d <= 6);
  const de = Number(body.de), a = Number(body.a);
  if (!dias.length) throw new Error('Elige al menos un día del equipo.');
  if (!(de >= 0 && de <= 23 && a >= 1 && a <= 24 && a > de)) throw new Error('La hora de salida debe ser después de la de entrada.');
  const modo = MODOS_IA[body.ia_modo] ? body.ia_modo : 'siempre';
  db.updateClient(client.id, { config: { ...client.config, ia_modo: modo, horario_equipo: { dias: [...new Set(dias)].sort(), de, a } } });
  return db.getClient(client.id);
}

export function analitica(client, { dias = 30, ahora = Date.now() } = {}) {
  const desde = new Date(ahora - dias * 86400000);
  const desdeSql = desde.toISOString().slice(0, 19).replace('T', ' ');
  const d = db.getDb();
  const leads = d.prepare('SELECT * FROM leads WHERE client_id = ?').all(client.id);
  const msgs = d.prepare(`SELECT m.lead_id, m.rol, m.autor, m.texto, m.created_at FROM lead_mensajes m JOIN leads l ON l.id = m.lead_id
    WHERE l.client_id = ? AND m.created_at >= ? ORDER BY m.id`).all(client.id, desdeSql);
  const porLead = new Map();
  for (const m of msgs) { if (!porLead.has(m.lead_id)) porLead.set(m.lead_id, []); porLead.get(m.lead_id).push(m); }
  const h = horarioEquipo(client);
  const enHorario = (dt) => { const p = partes(dt); return h.dias.includes(p.dia) && p.hora >= h.de && p.hora < h.a; };

  const nuevos = leads.filter((l) => utc(l.created_at) >= desde);
  const horas = Array(24).fill(0), semana = Array(7).fill(0);
  let fuera = 0;
  const primera = [], primeraAgente = [], primeraEquipo = [], respEquipo = [], respAgente = [];
  const conteoTemas = Object.fromEntries(temas(client).map((t) => [t.nombre, 0]));
  let conPrimerMsg = 0;
  for (const l of nuevos) {
    const t0 = utc(l.created_at);
    const p = partes(t0);
    horas[p.hora] += 1; semana[p.dia] += 1;
    if (!enHorario(t0)) fuera += 1;
    const ms = porLead.get(l.id) || [];
    const i = ms.findIndex((m) => m.rol === 'lead');
    if (i >= 0) {
      conPrimerMsg += 1;
      const texto = ms[i].texto.toLowerCase();
      for (const t of temas(client)) if (t.palabras.some((w) => texto.includes(String(w).toLowerCase()))) conteoTemas[t.nombre] += 1;
      const r = ms.slice(i + 1).find((m) => m.rol !== 'lead');
      if (r) {
        const min = (utc(r.created_at) - utc(ms[i].created_at)) / 60000;
        primera.push(min);
        (r.rol === 'agente' ? primeraAgente : primeraEquipo).push(min);
      }
    }
  }
  // Tiempo de respuesta en general: cada mensaje del lead que abre turno, hasta la siguiente respuesta.
  let sinSeguimiento = 0;
  for (const ms of porLead.values()) {
    for (let i = 0; i < ms.length; i++) {
      if (ms[i].rol !== 'lead' || (i > 0 && ms[i - 1].rol === 'lead')) continue;
      const r = ms.slice(i + 1).find((m) => m.rol !== 'lead');
      if (!r) continue;
      const min = (utc(r.created_at) - utc(ms[i].created_at)) / 60000;
      (r.rol === 'agente' ? respAgente : respEquipo).push(min);
    }
    const ult = ms[ms.length - 1];
    if (ult && ult.rol !== 'lead' && ahora - utc(ult.created_at) > 3 * 86400000) sinSeguimiento += 1;
  }
  const lista = etapas(client);
  const porEtapa = lista.map((e) => ({ ...e, n: leads.filter((l) => etapaDe(client, l).id === e.id).length }));
  const clientes = nuevos.filter((l) => etapaDe(client, l).tipo === 'cliente').length;
  const vendido = leads.filter((l) => l.resultado === 'vendido' && utc(l.updated_at) >= desde).reduce((a, l) => a + (Number(l.valor) || 0), 0);
  const canales = {};
  for (const l of nuevos) canales[l.origen] = (canales[l.origen] || 0) + 1;
  const ases = asesores(client).map((a) => ({ ...a, leads: leads.filter((l) => l.asignado_id === a.id && utc(l.updated_at) >= desde).length,
    respuestas: msgs.filter((m) => m.rol === 'humano' && m.autor === a.nombre).length }));
  const activos = new Set(msgs.map((m) => m.lead_id));
  return {
    dias, mensajesLead: msgs.filter((m) => m.rol === 'lead').length, nuevos: nuevos.length, fuera, horas, semana,
    primeraMediana: mediana(primera), rapidos: primera.length ? primera.filter((x) => x <= 15).length / primera.length : null,
    primeraAgente: mediana(primeraAgente), primeraEquipo: mediana(primeraEquipo), respAgente: mediana(respAgente), respEquipo: mediana(respEquipo),
    respondidosAgente: respAgente.length, respondidosEquipo: respEquipo.length,
    temas: Object.entries(conteoTemas).sort((a, b) => b[1] - a[1]), conPrimerMsg,
    porEtapa, clientes, vendido, canales: Object.entries(canales).sort((a, b) => b[1] - a[1]),
    sinSeguimiento, sinAsignar: leads.filter((l) => activos.has(l.id) && !l.asignado_id).length, conversaciones: activos.size,
    asesores: ases, horario: h, totalLeads: leads.length,
  };
}
