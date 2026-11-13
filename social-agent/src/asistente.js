// Asistente del panel ("Pregúntale a tu panel"): la persona pregunta en español sobre los datos de SU marca
// ("¿cuántos leads de Colombia llegaron esta semana?", "¿quién espera respuesta?", "¿qué anuncio vende más?")
// y la IA contesta con una foto compacta de los datos, con links a cada lead. Solo lee: no cambia nada.
// Límite por persona al día para cuidar el costo.
import * as db from './db.js';
import * as embudo from './embudo.js';
import { paisDeTelefono } from './paises.js';
import { pedirJSON } from './llm/proveedor.js';
import * as difusion from './difusion.js';

export const hooks = { ia: (...a) => pedirJSON(...a), ahora: () => new Date() }; // pruebas
export const MAX_DIA = 30;
const usos = new Map();

const fecha = (t) => (t ? String(t).slice(0, 16).replace('T', ' ') : '');
/** Foto de los datos de la marca (lo que la IA puede consultar). */
export function contexto(client, ahora = hooks.ahora()) {
  const leads = db.listLeads(client.id, { limit: 100000 });
  const ases = Object.fromEntries(embudo.asesores(client).map((a) => [a.id, a.nombre]));
  const ultimos = Object.fromEntries(db.getDb().prepare(`SELECT m.lead_id, m.rol, m.texto, m.created_at FROM lead_mensajes m
    JOIN (SELECT lead_id, MAX(id) mid FROM lead_mensajes GROUP BY lead_id) x ON x.mid = m.id JOIN leads l ON l.id = m.lead_id WHERE l.client_id = ?`).all(client.id).map((m) => [m.lead_id, m]));
  const fila = (l) => {
    const u = ultimos[l.id];
    let camp = ''; try { camp = l.campana || JSON.parse(l.campana_json || '{}')?.titulo || ''; } catch { /* sin anuncio */ }
    return { id: l.id, nombre: l.nombre || l.usuario || l.telefono || '', canal: l.origen, pais: paisDeTelefono(l.telefono) || '', etapa: embudo.etapaDe(client, l)?.nombre || l.estado,
      asesor: ases[l.asignado_id] || '', resultado: l.resultado || '', valor: l.valor || 0, empresa: l.empresa || '', etiquetas: embudo.tagsDe(l).join(', '),
      prioridad: embudo.puntaje(client, l, u, ahora.getTime()), atiende: l.control === 'humano' ? 'equipo' : 'IA', espera_respuesta: u?.rol === 'lead',
      llego: fecha(l.created_at), ultima_actividad: fecha(l.updated_at), anuncio: camp, ultimo_mensaje: u ? `${u.rol}: ${String(u.texto).slice(0, 120)}` : '' };
  };
  const ordenados = [...leads].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  const a = embudo.analitica(client, { rango: '30', ahora: ahora.getTime() });
  return {
    marca: client.nombre, hoy: ahora.toISOString().slice(0, 10), total_leads: leads.length,
    resumen_30_dias: { leads: a.totalLeads, temas: a.temas?.slice(0, 8), conversion: a.conversion, tiempos: a.tiempos, fuera_de_horario: a.fueraDeHorario },
    leads: ordenados.slice(0, 400).map(fila),
    embudos: embudo.embudos(client).map((e) => ({ id: e.id, nombre: e.nombre, etapas: e.etapas.map((x) => ({ destino: `${e.id}/${x.id}`, id: x.id, nombre: x.nombre })) })),
    asesores: embudo.asesores(client).map((x) => ({ id: x.id, nombre: x.nombre })),
    prioridades: Object.keys(embudo.PRIORIDADES), resultados: Object.keys(embudo.RESULTADOS),
  };
}

const S = { type: 'string' };
const I = { type: 'integer' };
const LISTA = (x) => ({ type: 'array', items: x });
export const ACCIONES = { ninguna: '', mover: 'Mover de etapa', asignar: 'Asignar asesor', prioridad: 'Cambiar prioridad', resultado: 'Marcar resultado', etiquetar: 'Agregar etiqueta', campana: 'Preparar campaña de WhatsApp' };
const SCHEMA = { type: 'object', additionalProperties: false, required: ['respuesta', 'leads', 'accion'],
  properties: { respuesta: S, leads: LISTA(I),
    accion: { type: 'object', additionalProperties: false, required: ['tipo', 'resumen', 'leads', 'destino', 'asesor_id', 'valor', 'campana'], properties: {
      tipo: { type: 'string', enum: Object.keys(ACCIONES) }, resumen: S, leads: LISTA(I), destino: S, asesor_id: I, valor: S,
      campana: { type: 'object', additionalProperties: false, required: ['nombre', 'plantilla', 'etapas', 'tags', 'origen', 'sin_actividad'],
        properties: { nombre: S, plantilla: S, etapas: LISTA(S), tags: LISTA(S), origen: S, sin_actividad: I } } } } } };

export async function preguntar(client, user, pregunta, historial = []) {
  const p = String(pregunta || '').trim().slice(0, 600);
  if (!p) throw new Error('Escribe tu pregunta.');
  const k = `${user?.id || 'admin'}:${new Date().toISOString().slice(0, 10)}`;
  if ((usos.get(k) || 0) >= MAX_DIA) throw new Error(`Ya hiciste ${MAX_DIA} preguntas hoy. Mañana se reinicia.`);
  usos.set(k, (usos.get(k) || 0) + 1);
  const datos = contexto(client);
  const system = `Eres el asistente del panel de ${client.nombre}. Contestas preguntas sobre sus leads, conversaciones, embudo, asesores, países y anuncios usando SOLO los datos de abajo (JSON).
- Responde en español, breve y claro: primero la respuesta directa (un número, una lista corta), luego un detalle si ayuda.
- Si haces una lista de personas, máximo 10, y pon sus ids en "leads" para que el panel muestre los links.
- Cuenta y suma con cuidado. Si los datos no alcanzan para contestar (por ejemplo, algo de hace más tiempo o que no se guarda), dilo.
- No inventes datos. No des consejos genéricos de marketing salvo que te los pidan.
- Fechas en UTC (la marca está en la Ciudad de México, 6 h antes).
ACCIONES: si la persona te pide HACER algo (mover leads de etapa, asignarlos a un asesor, cambiar prioridad, marcar vendido/perdido/resuelto, agregar una etiqueta, o preparar una campaña de WhatsApp), llena "accion" con la propuesta; el panel le pide confirmar con un botón antes de hacerla. Tú NO la ejecutas: en "respuesta" di qué vas a hacer y que lo confirme.
- mover: "destino" es el valor "destino" de la etapa (embudo/etapa) tal cual está en DATOS.embudos. asignar: "asesor_id" de DATOS.asesores (0 = quitar asesor). prioridad: "valor" en DATOS.prioridades. resultado: "valor" en DATOS.resultados. etiquetar: "valor" es la etiqueta.
- Para mover, asignar, prioridad, resultado y etiquetar pon los ids en accion.leads (máximo 500) y "resumen" corto ("Mover 12 leads de Colombia a Documentos completos").
- campana: llena accion.campana con nombre, el nombre exacto de la plantilla aprobada de WhatsApp (si no te lo dijeron, pregúntalo y deja tipo "ninguna"), y filtros (ids de etapa, etiquetas, origen como whatsapp/instagram, días sin actividad o 0). Queda como borrador por aprobar en Campañas; no se envía nada.
- Si no hay nada que hacer, tipo "ninguna" y el resto vacío (listas vacías, 0, "").
DATOS:
${JSON.stringify(datos)}`;
  const mensajes = [...(Array.isArray(historial) ? historial : []).slice(-6).map((m) => ({ role: m.rol === 'asistente' ? 'assistant' : 'user', content: String(m.texto || '').slice(0, 1500) })),
    { role: 'user', content: p }];
  const r = await hooks.ia({ system, messages: mensajes, schema: SCHEMA, maxTokens: 1500, etiqueta: 'asistente' });
  const ids = new Set(datos.leads.map((l) => l.id));
  const leads = (r.data?.leads || []).filter((id) => ids.has(id)).slice(0, 10).map((id) => datos.leads.find((l) => l.id === id));
  const a = r.data?.accion;
  const accion = a && ACCIONES[a.tipo] && a.tipo !== 'ninguna' ? { ...a, leads: (a.leads || []).filter((id) => ids.has(id)).slice(0, 500), resumen: String(a.resumen || ACCIONES[a.tipo]).slice(0, 200) } : null;
  return { respuesta: String(r.data?.respuesta || 'No pude contestar.').slice(0, 3000), leads, accion };
}

/** Ejecuta una acción que la persona confirmó. Se vuelve a validar todo: no se confía en lo que manda el navegador. */
export function ejecutar(client, user, accion = {}) {
  const tipo = String(accion.tipo || '');
  if (!ACCIONES[tipo] || tipo === 'ninguna') throw new Error('No hay nada que hacer.');
  const autor = user?.nombre || 'Kuper';
  if (tipo === 'campana') {
    const c = accion.campana || {};
    const d = difusion.crear(client, { nombre: c.nombre, plantilla: c.plantilla, filtros: { etapas: c.etapas, tags: c.tags, origen: c.origen, sin_actividad: c.sin_actividad || '' } }, autor);
    db.logEvent({ clientId: client.id, tipo: 'asistente_accion', detalle: `${autor}: campaña "${d.nombre}" (borrador)` });
    return { mensaje: `Listo: la campaña "${d.nombre}" quedó como borrador. Revísala y apruébala en Campañas.`, url: 'difusion' };
  }
  const ids = [...new Set([].concat(accion.leads || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500).filter((id) => db.getLead(client.id, id));
  if (!ids.length) throw new Error('No encontré esos leads en tu cuenta.');
  const v = String(accion.valor || '').trim();
  let n = 0;
  if (tipo === 'mover') {
    const [e, et] = String(accion.destino || '').split('/');
    if (!embudo.embudos(client).some((x) => x.id === e && x.etapas.some((y) => y.id === et))) throw new Error('Esa etapa no existe en tu embudo.');
    n = embudo.accionMasiva(client, ids, { destino: `${e}/${et}` });
  } else if (tipo === 'asignar') {
    const a = Number(accion.asesor_id) || 0;
    if (a && !embudo.asesores(client).some((x) => x.id === a)) throw new Error('Ese asesor no es de tu cuenta.');
    n = embudo.accionMasiva(client, ids, { asesor: a ? String(a) : '-' });
  } else if (tipo === 'prioridad') {
    if (!embudo.PRIORIDADES[v]) throw new Error('Prioridad no válida.');
    n = embudo.accionMasiva(client, ids, { prioridad: v });
  } else if (tipo === 'resultado') {
    if (!embudo.RESULTADOS[v]) throw new Error('Resultado no válido.');
    n = embudo.accionMasiva(client, ids, { resultado: v });
  } else if (tipo === 'etiquetar') {
    const tag = v.toLowerCase().slice(0, 40);
    if (!tag) throw new Error('Falta la etiqueta.');
    const upd = db.getDb().prepare('UPDATE leads SET tags_json = ? WHERE id = ? AND client_id = ?');
    for (const id of ids) { const l = db.getLead(client.id, id); const t = embudo.tagsDe(l); if (!t.map((x) => String(x).toLowerCase()).includes(tag)) upd.run(JSON.stringify([...t, tag].slice(0, 30)), id, client.id); n++; }
  }
  db.logEvent({ clientId: client.id, tipo: 'asistente_accion', detalle: `${autor}: ${ACCIONES[tipo]} · ${n} leads` });
  return { mensaje: `Listo: ${ACCIONES[tipo].toLowerCase()} en ${n} lead${n === 1 ? '' : 's'}.`, url: tipo === 'mover' ? 'embudo' : '' };
}
