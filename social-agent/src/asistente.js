// Asistente del panel ("Pregúntale a tu panel"): la persona pregunta en español sobre los datos de SU marca
// ("¿cuántos leads de Colombia llegaron esta semana?", "¿quién espera respuesta?", "¿qué anuncio vende más?")
// y la IA contesta con una foto compacta de los datos, con links a cada lead. Solo lee: no cambia nada.
// Límite por persona al día para cuidar el costo.
import * as db from './db.js';
import * as embudo from './embudo.js';
import { paisDeTelefono } from './paises.js';
import { pedirJSON } from './llm/proveedor.js';

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
  };
}

const S = { type: 'string' };
const SCHEMA = { type: 'object', additionalProperties: false, required: ['respuesta', 'leads'],
  properties: { respuesta: S, leads: { type: 'array', items: { type: 'integer' } } } };

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
DATOS:
${JSON.stringify(datos)}`;
  const mensajes = [...(Array.isArray(historial) ? historial : []).slice(-6).map((m) => ({ role: m.rol === 'asistente' ? 'assistant' : 'user', content: String(m.texto || '').slice(0, 1500) })),
    { role: 'user', content: p }];
  const r = await hooks.ia({ system, messages: mensajes, schema: SCHEMA, maxTokens: 1500, etiqueta: 'asistente' });
  const ids = new Set(datos.leads.map((l) => l.id));
  const leads = (r.data?.leads || []).filter((id) => ids.has(id)).slice(0, 10).map((id) => datos.leads.find((l) => l.id === id));
  return { respuesta: String(r.data?.respuesta || 'No pude contestar.').slice(0, 3000), leads };
}
