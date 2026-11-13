// Embudo de ventas, ficha del lead y analítica.
// Cada cliente tiene sus etapas (client.config.embudo); cada etapa tiene un "tipo" que es el estado general
// del lead (nuevo, conversacion, cita, cliente, perdido), así los reportes y las listas de siempre siguen funcionando.
import * as db from './db.js';
import { config } from './config.js';

// Al cambiar quién atiende por la etapa (IA o equipo), el servidor le avisa al agente de WhatsApp.
export const hooks = { control: null };

export const TIPOS = { nuevo: 'Nuevo', conversacion: 'En conversación', cita: 'Cita o visita', cliente: 'Cliente', perdido: 'Perdido', archivo: 'Base de datos' };
export const RESULTADOS = { vendido: 'Vendido', perdido: 'Perdido', resuelto: 'Resuelto' };
const COLORES = { nuevo: '#93b4ff', conversacion: '#fbbf24', cita: '#c9f53a', cliente: '#4ade80', perdido: '#f87171', archivo: '#8a857c' };
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
const etapasValidas = (l) => (Array.isArray(l) ? l.filter((x) => x && x.id && x.nombre && TIPOS[x.tipo]) : []);

/** Embudos del cliente: config.embudos = [{ id, nombre, etapas }]. Los de antes (config.embudo) son un solo embudo. */
export function embudos(client) {
  const lista = Array.isArray(client?.config?.embudos) ? client.config.embudos.map((e) => ({ ...e, etapas: etapasValidas(e.etapas) })).filter((e) => e.id && e.nombre && e.etapas.length >= 2) : [];
  if (lista.length) return lista;
  const viejas = etapasValidas(client?.config?.embudo);
  return [{ id: 'principal', nombre: 'Embudo de ventas', etapas: viejas.length >= 2 ? viejas : ETAPAS_BASE }];
}
export const embudoDe = (client, lead) => { const l = embudos(client); return l.find((e) => e.id === lead?.embudo) || l[0]; };
/** Etapas de un embudo (por defecto, el primero). */
export const etapas = (client, embudoId) => { const l = embudos(client); return (l.find((e) => e.id === embudoId) || l[0]).etapas; };

const ALIAS = { nuevo: 'nuevo', nuevos: 'nuevo', conversacion: 'conversacion', seguimiento: 'conversacion', contestado: 'conversacion',
  cita: 'cita', visita: 'cita', citas: 'cita', cliente: 'cliente', clientes: 'cliente', vendido: 'cliente', perdido: 'perdido', perdidos: 'perdido',
  archivo: 'archivo', base: 'archivo', basededatos: 'archivo', crm: 'archivo' };
/** "Nombre = tipo" por línea → etapas. El tipo puede ir en texto ("visita", "cliente"…). */
export function parseEtapas(texto) {
  const out = [], vistos = new Set();
  for (const linea of String(texto || '').split('\n')) {
    const [n, t = ''] = linea.split('=').map((x) => x.trim());
    if (!n) continue;
    const tipo = ALIAS[slug(t).replace(/-/g, '')] || (TIPOS[t] ? t : 'conversacion');
    let id = slug(n) || `etapa-${out.length + 1}`;
    while (vistos.has(id)) id += '-2';
    vistos.add(id);
    out.push({ id, nombre: n.slice(0, 40), tipo });
  }
  if (out.length < 2) throw new Error('Pon al menos dos etapas, una por línea.');
  if (out.length > 16) throw new Error('Máximo 16 etapas por embudo.');
  return out;
}
/** Varios embudos en un solo texto: "# Nombre del embudo" y debajo sus etapas. Sin "#", es un solo embudo. */
export function parseEmbudos(texto, anteriores = []) {
  const bloques = [];
  for (const linea of String(texto || '').split('\n')) {
    const m = /^\s*#\s*(.+)$/.exec(linea);
    if (m) bloques.push({ nombre: m[1].trim().slice(0, 40), lineas: [] });
    else if (linea.trim()) { if (!bloques.length) bloques.push({ nombre: 'Embudo de ventas', lineas: [] }); bloques.at(-1).lineas.push(linea); }
  }
  if (!bloques.length) throw new Error('Pon al menos un embudo con dos etapas.');
  if (bloques.length > 8) throw new Error('Máximo 8 embudos.');
  const vistos = new Set();
  return bloques.map((b, i) => {
    // Se conserva el id del embudo que ya existía con ese nombre (los leads lo tienen guardado).
    let id = anteriores.find((e) => e.nombre === b.nombre)?.id || (bloques.length === 1 && anteriores[0]?.id) || slug(b.nombre) || `embudo-${i + 1}`;
    while (vistos.has(id)) id += '-2';
    vistos.add(id);
    let et;
    try { et = parseEtapas(b.lineas.join('\n')); } catch (e) { throw new Error(`${b.nombre}: ${e.message}`); }
    const prev = anteriores.find((e) => e.id === id)?.etapas || [];
    // Se conserva el id y la configuración de la etapa que ya existía con ese nombre (los leads guardan el id).
    const usados = new Set();
    const etapas = et.map((x) => {
      const v = prev.find((y) => !usados.has(y.id) && y.nombre.toLowerCase() === x.nombre.toLowerCase()) || prev.find((y) => !usados.has(y.id) && y.id === x.id);
      if (v) usados.add(v.id);
      return v ? { ...v, nombre: x.nombre, tipo: x.tipo } : x;
    });
    const ids = new Set();
    for (const x of etapas) { while (ids.has(x.id)) x.id += '-2'; ids.add(x.id); }
    return { id, nombre: b.nombre, etapas };
  });
}
export const etapasTexto = (lista) => lista.map((e) => `${e.nombre} = ${e.tipo}`).join('\n');
export const embudosTexto = (client) => { const l = embudos(client); return l.length === 1 && l[0].id === 'principal' && l[0].nombre === 'Embudo de ventas' ? etapasTexto(l[0].etapas) : l.map((e) => `# ${e.nombre}\n${etapasTexto(e.etapas)}`).join('\n\n'); };

/** Etapa en la que se ve el lead: la que tiene guardada en su embudo o, si no, la primera de su estado. */
export function etapaDe(client, lead) {
  const lista = embudoDe(client, lead).etapas;
  return lista.find((e) => e.id === lead.etapa) || lista.find((e) => e.tipo === lead.estado) || lista[0];
}

const ESTADO_DE = { archivo: 'conversacion' };
/** Mueve el lead a una etapa (de su embudo, o de otro si se da embudoId). */
export function moverLead(client, leadId, etapaId, embudoId) {
  const lead = db.getLead(client.id, leadId);
  if (!lead) throw new Error('Lead no encontrado');
  const emb = embudoId ? embudos(client).find((x) => x.id === embudoId) : embudoDe(client, lead);
  if (!emb) throw new Error('Embudo no válido');
  const e = emb.etapas.find((x) => x.id === etapaId);
  if (!e) throw new Error('Etapa no válida');
  const antes = etapaDe(client, lead);
  const resultado = e.tipo === 'cliente' ? 'vendido' : e.tipo === 'perdido' ? 'perdido' : lead.resultado === 'vendido' || lead.resultado === 'perdido' ? null : lead.resultado;
  db.getDb().prepare("UPDATE leads SET embudo = ?, etapa = ?, estado = ?, resultado = ?, updated_at = datetime('now') WHERE id = ? AND client_id = ?")
    .run(emb.id, e.id, ESTADO_DE[e.tipo] || e.tipo, resultado, leadId, client.id);
  return controlPorEtapa(client, db.getLead(client.id, leadId), antes);
}

/** Etapas "solo equipo": ahí la IA no contesta. Al entrar, el lead pasa al equipo; al salir a una etapa con IA, regresa a la IA. */
export function controlPorEtapa(client, lead, antes = null) {
  if (!lead) return lead;
  const ahora = etapaDe(client, lead);
  let humano = null;
  if (ahora.solo_equipo && lead.control !== 'humano') humano = true;
  else if (!ahora.solo_equipo && antes?.solo_equipo && antes.id !== ahora.id && lead.control === 'humano') humano = false;
  if (humano === null) return lead;
  db.getDb().prepare('UPDATE leads SET control = ? WHERE id = ?').run(humano ? 'humano' : 'bot', lead.id);
  try { hooks.control?.(client, lead, humano); } catch { /* el agente se entera en la siguiente sincronización */ }
  return db.getLead(client.id, lead.id);
}

/** El agente (o la API) mueve el lead dentro de su embudo: solo hacia adelante, nunca saca a un lead de Clientes o Perdidos.
 *  Si estaba en la base de datos (tipo archivo) y vuelve a escribir, sí se mueve. */
export function avanzarPorAgente(client, lead, etapaId) {
  const lista = embudoDe(client, lead).etapas;
  const actual = etapaDe(client, lead);
  const archivado = actual.tipo === 'archivo';
  // El agente puede mandar el tipo ("conversacion", "cita", "perdido"): va a la primera etapa de ese tipo que esté adelante.
  const destino = lista.find((x) => x.id === etapaId || slug(x.nombre) === slug(etapaId || ''))
    || (TIPOS[etapaId] ? (archivado ? lista : lista.slice(lista.indexOf(actual) + 1)).find((x) => x.tipo === etapaId) || (etapaId === 'perdido' ? lista.find((x) => x.tipo === 'perdido') : null) : null);
  if (!destino || destino === actual) return lead;
  if (actual.tipo === 'cliente' || actual.tipo === 'perdido') return lead;
  if (!archivado && lista.indexOf(destino) <= lista.indexOf(actual) && destino.tipo !== 'perdido') return lead;
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

// [nombre, ícono (lineal), color]
export const PRIORIDADES = { neutral: ['Neutral', '', ''], urgente: ['Urgente', 'flame', '#f87171'], importante: ['Importante', 'star', '#fbbf24'], pendiente: ['Pendiente', 'clock', '#93b4ff'], atorado: ['Atorado', 'pause', '#a5b4fc'] };

/** Lead agregado a mano desde el embudo. body: { nombre, lada, telefono, email, destino: "embudo/etapa" } */
export function agregarLead(client, body = {}, autor = '') {
  const lada = String(body.lada || '52').replace(/\D/g, '').slice(0, 4) || '52';
  const num = String(body.telefono || '').replace(/\D/g, '');
  const email = String(body.email || '').trim();
  if (num.length < 7 && !email) throw new Error('Pon el teléfono (o un correo) del lead.');
  const tel = num ? (num.startsWith(lada) && num.length > 10 ? num : `${lada}${num}`) : null;
  const antes = tel ? db.getDb().prepare('SELECT id FROM leads WHERE client_id = ? AND telefono = ?').get(client.id, `+${tel}`) : null;
  const lead = db.upsertLead(client.id, { nombre: String(body.nombre || '').trim().slice(0, 80) || undefined, telefono: tel ? `+${tel}` : undefined, email: email || undefined, origen: 'manual',
    nota: antes ? undefined : `Agregado a mano${autor ? ` por ${autor}` : ''}` });
  const [embId, etId] = String(body.destino || '').split('/');
  const emb = embudos(client).find((x) => x.id === embId) || embudos(client)[0];
  moverLead(client, lead.id, emb.etapas.find((x) => x.id === etId)?.id || emb.etapas[0].id, emb.id);
  return { lead: db.getLead(client.id, lead.id), embudo: emb.id, existia: !!antes };
}

// ------------------------------------------------------------ ficha del lead
export const tagsDe = (lead) => { try { return JSON.parse(lead.tags_json || '[]'); } catch { return []; } };
export const asesores = (client) => db.getDb().prepare("SELECT id, nombre, email FROM users WHERE client_id = ? AND rol = 'cliente' AND activo = 1 AND COALESCE(permiso, '') != 'caja' ORDER BY nombre").all(client.id);

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
  if (body.prioridad !== undefined) db.getDb().prepare('UPDATE leads SET prioridad = ? WHERE id = ?').run(PRIORIDADES[body.prioridad] && body.prioridad !== 'neutral' ? body.prioridad : null, leadId);
  db.getDb().prepare(`UPDATE leads SET nombre = COALESCE(?, nombre), email = ?, empresa = ?, valor = ?, nota = ?, tags_json = ?, asignado_id = ?, resultado = ?, updated_at = datetime('now')
    WHERE id = ? AND client_id = ?`).run(txt(body.nombre, 80), email ? email.toLowerCase() : null, txt(body.empresa, 120), valor ? Number(valor) : null, txt(body.nota, 1000),
    JSON.stringify(tags), asignado, resultado, leadId, client.id);
  // Vendido / Perdido mueve el lead a la etapa correspondiente.
  const lista = embudoDe(client, db.getLead(client.id, leadId)).etapas;
  if (resultado === 'vendido' && lead.resultado !== 'vendido') { const e = lista.find((x) => x.tipo === 'cliente'); if (e) moverLead(client, leadId, e.id); }
  if (resultado === 'perdido' && lead.resultado !== 'perdido') { const e = lista.find((x) => x.tipo === 'perdido'); if (e) moverLead(client, leadId, e.id); }
  if (body.etapa) {
    const [embId, etId] = String(body.etapa).includes('/') ? String(body.etapa).split('/') : [embudoDe(client, lead).id, String(body.etapa)];
    const ahora = db.getLead(client.id, leadId);
    if (etId !== etapaDe(client, ahora).id || embId !== embudoDe(client, ahora).id) moverLead(client, leadId, etId, embId);
  }
  return db.getLead(client.id, leadId);
}

/** Resultado al soltar el lead en la barra de abajo del embudo. Vendido/Perdido lo pasan a esa etapa si el embudo la tiene. */
export function marcarResultado(client, leadId, resultado, valor, { mover = true } = {}) {
  if (!RESULTADOS[resultado]) throw new Error('Resultado no válido');
  const lead = db.getLead(client.id, leadId);
  if (!lead) throw new Error('Lead no encontrado');
  const v = String(valor ?? '').replace(/[$,\s]/g, '');
  if (v && !(Number(v) >= 0)) throw new Error('El valor debe ser un número');
  db.getDb().prepare("UPDATE leads SET resultado = ?, valor = COALESCE(?, valor), updated_at = datetime('now') WHERE id = ?").run(resultado, v ? Number(v) : null, leadId);
  const lista = embudoDe(client, lead).etapas;
  const destino = resultado === 'vendido' ? lista.find((x) => x.tipo === 'cliente') : resultado === 'perdido' ? lista.find((x) => x.tipo === 'perdido') : null;
  if (mover && destino && etapaDe(client, lead).id !== destino.id) moverLead(client, leadId, destino.id);
  return db.getLead(client.id, leadId);
}

// ------------------------------------------------------------ menú de cada columna y acciones en grupo
function guardarEmbudos(client, lista) {
  const { embudo: _v, ...resto } = client.config;
  db.updateClient(client.id, { config: { ...resto, embudos: lista } });
  return db.getClient(client.id);
}
/** accion: renombrar | agregar | tipo | estancado | al_entrar | eliminar */
export function editarEtapa(client, embudoId, etapaId, accion, valor = '') {
  const lista = embudos(client).map((e) => ({ ...e, etapas: e.etapas.map((x) => ({ ...x })) }));
  const emb = lista.find((e) => e.id === embudoId) || lista[0];
  const i = emb.etapas.findIndex((x) => x.id === etapaId);
  if (i < 0) throw new Error('Etapa no encontrada');
  const et = emb.etapas[i];
  const v = String(valor ?? '').trim();
  if (accion === 'renombrar') { if (!v) throw new Error('Escribe el nombre.'); et.nombre = v.slice(0, 40); }
  else if (accion === 'agregar') {
    if (!v) throw new Error('Escribe el nombre de la etapa.');
    if (emb.etapas.length >= 16) throw new Error('Máximo 16 etapas por embudo.');
    let id = slug(v) || `etapa-${emb.etapas.length + 1}`;
    while (emb.etapas.some((x) => x.id === id)) id += '-2';
    emb.etapas.splice(i + 1, 0, { id, nombre: v.slice(0, 40), tipo: et.tipo === 'nuevo' ? 'conversacion' : et.tipo });
  } else if (accion === 'tipo') { if (!TIPOS[v]) throw new Error('Tipo no válido'); et.tipo = v; }
  else if (accion === 'estancado') { const d = Number(v); if (v && !(d >= 1 && d <= 365)) throw new Error('Pon un número de días entre 1 y 365.'); if (d) et.estancado_dias = d; else delete et.estancado_dias; }
  else if (accion === 'solo_equipo') { if (et.solo_equipo) delete et.solo_equipo; else et.solo_equipo = true; }
  else if (accion === 'al_entrar') { if (v && !RESULTADOS[v]) throw new Error('Opción no válida'); if (v && et.al_entrar !== v) et.al_entrar = v; else delete et.al_entrar; }
  else if (accion === 'eliminar') {
    if (emb.etapas.length <= 2) throw new Error('Un embudo necesita al menos dos etapas.');
    const destino = emb.etapas[i === 0 ? 1 : i - 1];
    emb.etapas.splice(i, 1);
    // Sus leads pasan a la etapa de al lado (no se pierde ninguno).
    db.getDb().prepare("UPDATE leads SET etapa = ?, estado = ? WHERE client_id = ? AND COALESCE(embudo, ?) = ? AND etapa = ?")
      .run(destino.id, ESTADO_DE[destino.tipo] || destino.tipo, client.id, lista[0].id, emb.id, et.id);
  } else throw new Error('Acción no válida');
  return guardarEmbudos(client, lista);
}
/** ¿El lead lleva más días sin moverse de los que permite su etapa? */
export function estancado(client, lead, ahora = Date.now()) {
  const d = etapaDe(client, lead).estancado_dias;
  return !!d && ahora - new Date(String(lead.updated_at).replace(' ', 'T') + 'Z').getTime() > d * 86400000;
}
/** Acciones con varios leads a la vez: mover, asesor, estatus o resultado. */
export function accionMasiva(client, ids, body = {}) {
  const lista = [...new Set([].concat(ids || []).map(Number).filter(Boolean))].slice(0, 2000);
  if (!lista.length) throw new Error('No elegiste leads.');
  let n = 0;
  for (const id of lista) {
    if (!db.getLead(client.id, id)) continue;
    if (body.destino) { const [e, et] = String(body.destino).split('/'); moverLead(client, id, et, e); }
    if (body.asesor) {
      const a = body.asesor === '-' ? null : Number(body.asesor);
      if (a && !asesores(client).some((x) => x.id === a)) throw new Error('Ese asesor no es de esta cuenta');
      db.getDb().prepare('UPDATE leads SET asignado_id = ? WHERE id = ?').run(a, id);
    }
    if (body.prioridad && PRIORIDADES[body.prioridad]) db.getDb().prepare('UPDATE leads SET prioridad = ? WHERE id = ?').run(body.prioridad === 'neutral' ? null : body.prioridad, id);
    if (body.resultado && RESULTADOS[body.resultado]) marcarResultado(client, id, body.resultado);
    n++;
  }
  return n;
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
/** ¿Está el equipo en su horario en este momento? (hora del panel). */
export function enHorarioEquipo(client, t = Date.now()) {
  const h = horarioEquipo(client);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: config.timezone, hourCycle: 'h23', weekday: 'short', hour: '2-digit' }).formatToParts(t).map((x) => [x.type, x.value]));
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return h.dias.map(Number).includes(dia) && Number(p.hour) >= h.de && Number(p.hour) < h.a;
}
/**
 * Quién contesta una llamada que entra ahora: 'ia' (la asistente) o 'equipo' (la pasa al asesor).
 * Pasa al equipo si las llamadas están en pausa o si la IA está en "solo fuera de horario" y es horario del equipo.
 */
export function turnoLlamadas(client, t = Date.now()) {
  if (client?.config?.llamadas_pausado === true) return { atiende: 'equipo', motivo: 'pausa' };
  if (horarioIA(client).modo === 'fuera_de_horario' && enHorarioEquipo(client, t)) return { atiende: 'equipo', motivo: 'horario_equipo' };
  return { atiende: 'ia', motivo: horarioIA(client).modo === 'fuera_de_horario' ? 'fuera_de_horario' : 'siempre' };
}
export function guardarHorario(client, body = {}) {
  const dias = [].concat(body.dias || []).map(Number).filter((d) => d >= 0 && d <= 6);
  const de = Number(body.de), a = Number(body.a);
  if (!dias.length) throw new Error('Elige al menos un día del equipo.');
  if (!(de >= 0 && de <= 23 && a >= 1 && a <= 24 && a > de)) throw new Error('La hora de salida debe ser después de la de entrada.');
  const modo = MODOS_IA[body.ia_modo] ? body.ia_modo : 'siempre';
  db.updateClient(client.id, { config: { ...client.config, ia_modo: modo, horario_equipo: { dias: [...new Set(dias)].sort(), de, a } } });
  return db.getClient(client.id);
}

// Medianoche (hora del panel) de un día "YYYY-MM-DD", como fecha UTC.
function medianoche(ymd) {
  const [y, m, dd] = ymd.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, dd);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(guess).map((x) => [x.type, x.value]));
  const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(guess - (local - guess));
}
const hoyLocal = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone }).format(t);
/** Rango del filtro de fechas: atajo ('7', '30', '90', 'mes', 'mes_pasado') o desde/hasta (YYYY-MM-DD). */
export function rangoFechas({ rango = '', desde = '', hasta = '' } = {}, ahora = Date.now()) {
  const ok = (x) => /^\d{4}-\d\d-\d\d$/.test(x || '');
  const hoy = hoyLocal(ahora);
  const menos = (n) => hoyLocal(ahora - n * 86400000);
  if (ok(desde) && ok(hasta)) return desde <= hasta ? { desde, hasta, rango: 'propio' } : { desde: hasta, hasta: desde, rango: 'propio' };
  if (rango === 'mes') return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy, rango };
  if (rango === 'mes_pasado') {
    const [y, m] = hoy.split('-').map(Number), py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
    const ult = new Date(Date.UTC(py, pm, 0)).getUTCDate();
    return { desde: `${py}-${String(pm).padStart(2, '0')}-01`, hasta: `${py}-${String(pm).padStart(2, '0')}-${String(ult).padStart(2, '0')}`, rango };
  }
  const n = [7, 30, 90].includes(Number(rango)) ? Number(rango) : 30;
  return { desde: menos(n - 1), hasta: hoy, rango: String(n) };
}

export function analitica(client, { dias = null, desde: desdeTxt = '', hasta: hastaTxt = '', rango = '', asesor = '', ahora = Date.now() } = {}) {
  const r = rangoFechas({ rango: rango || (dias ? String(dias) : ''), desde: desdeTxt, hasta: hastaTxt }, ahora);
  const desde = medianoche(r.desde), fin = new Date(medianoche(r.hasta).getTime() + 86400000);
  dias = Math.max(1, Math.round((fin - desde) / 86400000));
  const desdeSql = desde.toISOString().slice(0, 19).replace('T', ' '), finSql = fin.toISOString().slice(0, 19).replace('T', ' ');
  const d = db.getDb();
  const asesorId = asesor === '-' ? '-' : Number(asesor) || null;
  const leads = d.prepare('SELECT * FROM leads WHERE client_id = ? AND ajena = 0').all(client.id)
    .filter((l) => !asesorId || (asesorId === '-' ? !l.asignado_id : l.asignado_id === asesorId));
  const ids = new Set(leads.map((l) => l.id));
  const msgs = d.prepare(`SELECT m.lead_id, m.rol, m.autor, m.texto, m.created_at FROM lead_mensajes m JOIN leads l ON l.id = m.lead_id
    WHERE l.client_id = ? AND m.created_at >= ? AND m.created_at < ? ORDER BY m.id`).all(client.id, desdeSql, finSql).filter((m) => ids.has(m.lead_id));
  const porLead = new Map();
  for (const m of msgs) { if (!porLead.has(m.lead_id)) porLead.set(m.lead_id, []); porLead.get(m.lead_id).push(m); }
  const h = horarioEquipo(client);
  const enHorario = (dt) => { const p = partes(dt); return h.dias.includes(p.dia) && p.hora >= h.de && p.hora < h.a; };

  const nuevos = leads.filter((l) => utc(l.created_at) >= desde && utc(l.created_at) < fin);
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
  const porEmbudo = embudos(client).map((emb) => ({ ...emb, etapas: emb.etapas.map((e) => ({ ...e, n: leads.filter((l) => embudoDe(client, l).id === emb.id && etapaDe(client, l).id === e.id).length })) }));
  const porEtapa = porEmbudo[0].etapas;
  const clientes = nuevos.filter((l) => etapaDe(client, l).tipo === 'cliente').length;
  const vendido = leads.filter((l) => l.resultado === 'vendido' && utc(l.updated_at) >= desde && utc(l.updated_at) < fin).reduce((a, l) => a + (Number(l.valor) || 0), 0);
  const canales = {};
  for (const l of nuevos) canales[l.origen] = (canales[l.origen] || 0) + 1;
  const ases = asesores(client).map((a) => ({ ...a, leads: leads.filter((l) => l.asignado_id === a.id && utc(l.updated_at) >= desde).length,
    respuestas: msgs.filter((m) => m.rol === 'humano' && m.autor === a.nombre).length }));
  const activos = new Set(msgs.map((m) => m.lead_id));
  return {
    dias, desde: r.desde, hasta: r.hasta, rango: r.rango, asesor: asesor || '', mensajesLead: msgs.filter((m) => m.rol === 'lead').length, nuevos: nuevos.length, fuera, horas, semana,
    primeraMediana: mediana(primera), rapidos: primera.length ? primera.filter((x) => x <= 15).length / primera.length : null,
    primeraAgente: mediana(primeraAgente), primeraEquipo: mediana(primeraEquipo), respAgente: mediana(respAgente), respEquipo: mediana(respEquipo),
    respondidosAgente: respAgente.length, respondidosEquipo: respEquipo.length,
    temas: Object.entries(conteoTemas).sort((a, b) => b[1] - a[1]), conPrimerMsg,
    porEtapa, porEmbudo, clientes, vendido, canales: Object.entries(canales).sort((a, b) => b[1] - a[1]),
    sinSeguimiento, sinAsignar: leads.filter((l) => activos.has(l.id) && !l.asignado_id).length, conversaciones: activos.size,
    asesores: ases, horario: h, totalLeads: leads.length,
  };
}

/**
 * Prioridad (0 a 100): qué tan cerca está de comprar y qué tan urgente es atenderlo. Sale de señales que ya
 * tenemos (etapa, si espera respuesta, qué tan reciente, valor, si vino de un anuncio); no gasta IA.
 * ultimo: último mensaje { rol } (si espera respuesta del negocio suma).
 */
export function puntaje(client, lead, ultimo = null, ahora = Date.now()) {
  if (['vendido', 'perdido', 'resuelto'].includes(lead.resultado)) return 0;
  const tipo = etapaDe(client, lead)?.tipo;
  if (tipo === 'perdido' || tipo === 'cliente' || tipo === 'archivo') return 0;
  let p = { nuevo: 25, conversacion: 40, cita: 65 }[tipo] ?? 25;
  if (ultimo?.rol === 'lead') p += 15; // escribió y espera respuesta
  const horas = (ahora - new Date(String(lead.updated_at || lead.created_at).replace(' ', 'T') + 'Z')) / 3600000;
  p += horas < 24 ? 15 : horas < 72 ? 5 : horas > 24 * 14 ? -25 : 0;
  if (Number(lead.valor) > 0) p += 10;
  if (lead.campana_json || lead.anuncio_id) p += 5;
  if (lead.prioridad === 'urgente') p += 10;
  return Math.max(0, Math.min(100, Math.round(p)));
}
export const caliente = (n) => n >= 70;
