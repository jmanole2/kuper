// "Probar agente": la marca habla con su agente real en modo prueba (no guarda ni manda nada) y tiene una lista de
// preguntas de control que se corren solas cada vez que cambian lo que sabe el agente. Si una que pasaba ahora falla,
// se avisa al equipo (al celular) para revisarlo antes de que le pase a un cliente.
//
// client.config.pruebas_agente = [{ id, pregunta, debe, no_debe }]   ·   kv pruebas:<id> = último resultado
import crypto from 'node:crypto';
import * as db from './db.js';
import * as agente from './agente.js';
import { pedirJSON } from './llm/proveedor.js';

export const hooks = { probar: null, juez: (...a) => pedirJSON(...a), avisar: null }; // pruebas
export const MAX_PREGUNTAS = 20;
export const lista = (client) => (Array.isArray(client?.config?.pruebas_agente) ? client.config.pruebas_agente : []);
export const resultado = (client) => { try { return JSON.parse(db.kvGet(`pruebas:${client.id}`) || 'null'); } catch { return null; } };

/** Una respuesta del agente real en modo prueba. mensajes: [{ rol: 'cliente'|'agente', texto }] */
export async function probar(client, mensajes, { refrescar = false } = {}) {
  if (hooks.probar) return hooks.probar(client, mensajes);
  if (!agente.agenteConfigurado(client)) throw new Error('Esta marca todavía no tiene su agente conectado al panel.');
  const limpios = (Array.isArray(mensajes) ? mensajes : []).slice(-12).map((m) => ({ rol: m.rol === 'agente' ? 'agente' : 'cliente', texto: String(m.texto || '').slice(0, 2000) }));
  return agente.llamarAgente(client, 'POST', '/probar', { mensajes: limpios, refrescar }, { timeout: 90000 });
}

export function agregar(client, { pregunta, debe = '', no_debe: noDebe = '' }) {
  const p = String(pregunta || '').trim().slice(0, 400);
  if (!p) throw new Error('Escribe la pregunta del cliente.');
  if (!String(debe).trim() && !String(noDebe).trim()) throw new Error('Escribe qué debe contestar (o qué no debe decir).');
  const l = lista(client);
  if (l.length >= MAX_PREGUNTAS) throw new Error(`Máximo ${MAX_PREGUNTAS} preguntas de control.`);
  const nueva = { id: crypto.randomBytes(4).toString('hex'), pregunta: p, debe: String(debe).trim().slice(0, 400), no_debe: String(noDebe).trim().slice(0, 400) };
  db.updateClient(client.id, { config: { ...client.config, pruebas_agente: [...l, nueva] } });
  return nueva;
}
export function quitar(client, id) {
  db.updateClient(client.id, { config: { ...client.config, pruebas_agente: lista(client).filter((x) => x.id !== id) } });
}

const JUEZ = { type: 'object', additionalProperties: false, required: ['aprobada', 'comentario'], properties: { aprobada: { type: 'boolean' }, comentario: { type: 'string' } } };
/** Corre todas las preguntas de control. Si alguna que pasaba ahora falla, avisa. */
export async function correr(client, { motivo = 'manual', refrescar = false } = {}) {
  const preguntas = lista(client);
  if (!preguntas.length) return null;
  const antes = resultado(client);
  const res = [];
  for (const q of preguntas) {
    let respuesta = '', acciones = [], aprobada = false, comentario = '';
    try {
      const r = await probar(client, [{ rol: 'cliente', texto: q.pregunta }], { refrescar: refrescar && !res.length });
      respuesta = String(r.respuesta || ''); acciones = r.acciones || [];
      const j = await hooks.juez({ etiqueta: 'pruebas_agente', maxTokens: 300, schema: JUEZ,
        system: 'Revisas si la respuesta de un agente de atención cumple lo esperado. Sé estricto con los datos (precios, horarios, nombres) pero flexible con la redacción. Comentario: una frase en español.',
        messages: [{ role: 'user', content: `Pregunta del cliente: ${q.pregunta}\nDebe: ${q.debe || '(nada en particular)'}\nNo debe: ${q.no_debe || '(nada en particular)'}\nAcciones que usó el agente: ${acciones.map((a) => a.herramienta).join(', ') || 'ninguna'}\nRespuesta del agente: ${respuesta}` }] });
      aprobada = !!j.data?.aprobada; comentario = String(j.data?.comentario || '').slice(0, 300);
    } catch (e) { comentario = `No se pudo probar: ${e.message}`.slice(0, 300); }
    res.push({ id: q.id, pregunta: q.pregunta, respuesta: respuesta.slice(0, 1500), aprobada, comentario });
  }
  const out = { fecha: new Date().toISOString(), motivo, total: res.length, aprobadas: res.filter((x) => x.aprobada).length, resultados: res };
  db.kvSet(`pruebas:${client.id}`, JSON.stringify(out));
  const antesOk = new Set((antes?.resultados || []).filter((x) => x.aprobada).map((x) => x.id));
  const empeoro = res.filter((x) => !x.aprobada && antesOk.has(x.id));
  if (empeoro.length) {
    db.logEvent({ clientId: client.id, tipo: 'pruebas_agente_fallan', detalle: empeoro.map((x) => x.pregunta).join(' | ').slice(0, 300) });
    try {
      const f = hooks.avisar || (await import('./push.js')).avisar;
      await f(client, { titulo: `⚠️ Revisa a tu agente (${client.nombre})`, texto: `${empeoro.length} pregunta(s) de control ya no se contestan bien: "${empeoro[0].pregunta}"`, url: '/app/agente/probar' });
    } catch { /* sin avisos */ }
  }
  return out;
}

// Después de guardar lo que sabe el agente se corren solas (con un pequeño retraso; una a la vez por marca).
const enCurso = new Map();
export function programar(client, retrasoMs = 20000) {
  if (!lista(client).length || !agente.agenteConfigurado(client) && !hooks.probar) return;
  clearTimeout(enCurso.get(client.id));
  enCurso.set(client.id, setTimeout(() => { enCurso.delete(client.id); correr(db.getClient(client.id), { motivo: 'cambio de información', refrescar: true }).catch(() => {}); }, retrasoMs).unref?.() || null);
}
