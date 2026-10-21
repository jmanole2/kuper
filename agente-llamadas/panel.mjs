// Manda cada llamada terminada al panel de Kuper (redes.kuper.media): ahí queda como lead,
// con el resumen y lo que se dijo. Se activa con PANEL_URL, PANEL_SLUG y PANEL_API_KEY en el .env.
//
// Cada minuto revisa en Retell las llamadas de los últimos 2 días que ya terminaron y manda las que falten.
// Las que ya se mandaron se anotan en datos/enviadas.json para no repetirlas (el panel tampoco las duplica).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const RETELL = 'https://api.retellai.com';
const ESPERA_ANALISIS_MS = 10 * 60 * 1000; // si Retell no ha terminado el resumen, se espera hasta 10 min
const VENTANA_MS = 2 * 24 * 3600 * 1000;

export const hooks = { fetch: (...a) => fetch(...a) }; // pruebas

export function configPanel(env = process.env) {
  const url = String(env.PANEL_URL || '').replace(/\/+$/, ''), slug = env.PANEL_SLUG || '', key = env.PANEL_API_KEY || '';
  return url && slug && key ? { url, slug, key } : null;
}

/** Convierte una llamada de Retell en lo que espera el panel (POST /api/:slug/llamadas). */
export function aPanel(call) {
  const datos = call.call_analysis?.custom_analysis_data || {};
  const tipo = call.call_type === 'web_call' ? 'web' : call.direction === 'outbound' ? 'saliente' : 'entrante';
  const telLinea = tipo === 'entrante' ? call.from_number : tipo === 'saliente' ? call.to_number : null;
  const limpio = (v) => { const s = String(v ?? '').trim(); return s && !/^(n\/?a|no|ninguno|desconocido|null|none)$/i.test(s) ? s : null; };
  return {
    call_id: call.call_id,
    tipo,
    inicio: new Date(call.start_timestamp || Date.now()).toISOString(),
    duracion_s: Math.round((call.duration_ms ?? ((call.end_timestamp || 0) - (call.start_timestamp || 0))) / 1000) || 0,
    telefono: limpio(telLinea) || limpio(datos.telefono_cliente),
    nombre: limpio(datos.nombre_cliente) || limpio(datos.nombre_contacto),
    email: limpio(datos.correo_cliente) || limpio(datos.correo_contacto),
    resumen: limpio(call.call_analysis?.call_summary),
    cita: datos.cita_agendada === true || datos.cita_agendada === 'true' || datos.resultado === 'cita',
    transcripcion: (call.transcript_object || [])
      .filter((t) => t.role === 'agent' || t.role === 'user')
      .map((t) => ({ rol: t.role === 'agent' ? 'agente' : 'lead', texto: t.content })),
  };
}

const SIN_CONTESTAR = /voicemail|no_answer|busy|dial_failed|invalid_destination|not_connected|machine/i;
const RESULTADOS = ['no_contesto', 'no_interesa', 'interesado', 'cita', 'no_llamar'];
/** Resultado de una llamada del agente de ventas para la lista de prospectos del panel. */
export function resultadoVentas(call) {
  const base = aPanel(call);
  const datos = call.call_analysis?.custom_analysis_data || {};
  const nadie = call.call_status !== 'ended' || SIN_CONTESTAR.test(String(call.disconnection_reason || '')) || !base.transcripcion.some((t) => t.rol === 'lead');
  return {
    ...base,
    resultado: nadie ? 'no_contesto' : RESULTADOS.includes(datos.resultado) ? datos.resultado : 'no_contesto',
    contacto: base.nombre, email: base.email,
  };
}

export function crearSincronizador({ key, agenteId, ventasId = null, panel, archivo, log = console }) {
  let enviadas = new Set();
  try { enviadas = new Set(JSON.parse(readFileSync(archivo, 'utf8'))); } catch { /* primera vez */ }
  const guardar = () => {
    try { mkdirSync(dirname(archivo), { recursive: true }); writeFileSync(archivo, JSON.stringify([...enviadas].slice(-3000))); }
    catch (e) { log.error(`[panel] no pude guardar ${archivo}: ${e.message}`); }
  };
  const retell = async (metodo, ruta, cuerpo) => {
    const r = await hooks.fetch(RETELL + ruta, { method: metodo, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    if (!r.ok) throw new Error(`Retell ${ruta} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  };

  let corriendo = false;
  async function sincronizar(ahora = Date.now()) {
    if (corriendo) return { omitido: true };
    corriendo = true;
    let enviadasAhora = 0;
    try {
      const id = await agenteId();
      const idVentas = ventasId ? await ventasId().catch(() => null) : null;
      const lista = await retell('POST', '/v3/list-calls', {
        filter_criteria: { agent: [id, idVentas].filter(Boolean).map((agent_id) => ({ agent_id })), call_status: { type: 'enum', op: 'in', value: ['ended', 'not_connected', 'error'] },
          start_timestamp: { type: 'number', op: 'ge', value: ahora - VENTANA_MS } },
        sort_order: 'descending', limit: 100,
      });
      for (const resumen of (lista.items || []).reverse()) {
        if (enviadas.has(resumen.call_id)) continue;
        const prospecto = resumen.metadata?.prospecto_id;
        const terminada = resumen.call_status === 'ended';
        if (!prospecto && !terminada) { enviadas.add(resumen.call_id); guardar(); continue; } // prueba web que no conectó
        if (terminada && !resumen.call_analysis && ahora - (resumen.end_timestamp || ahora) < ESPERA_ANALISIS_MS) continue; // aún sin resumen
        const call = await retell('GET', `/v2/get-call/${encodeURIComponent(resumen.call_id)}`);
        const [ruta, cuerpo] = prospecto
          ? [`prospectos/${encodeURIComponent(prospecto)}/resultado`, resultadoVentas({ ...resumen, ...call })]
          : ['llamadas', aPanel(call)];
        const r = await hooks.fetch(`${panel.url}/api/${encodeURIComponent(panel.slug)}/${ruta}`, {
          method: 'POST', headers: { Authorization: `Bearer ${panel.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
        });
        if (r.status === 404 && prospecto) { log.error(`[panel] prospecto ${prospecto} ya no existe`); enviadas.add(resumen.call_id); guardar(); continue; }
        if (!r.ok) throw new Error(`panel ${r.status}: ${(await r.text()).slice(0, 200)}`);
        enviadas.add(resumen.call_id); enviadasAhora += 1; guardar();
      }
      return { enviadas: enviadasAhora };
    } catch (e) {
      log.error(`[panel] ${e.message}`);
      return { error: e.message, enviadas: enviadasAhora };
    } finally { corriendo = false; }
  }
  return { sincronizar, enviadas };
}

/** Arranca la sincronización cada minuto. Devuelve null si el panel no está configurado. */
export function iniciar({ key, agenteId, ventasId = null, dirDatos }) {
  const panel = configPanel();
  if (!panel || !key) return null;
  const s = crearSincronizador({ key, agenteId, ventasId, panel, archivo: join(dirDatos, 'enviadas.json') });
  setTimeout(() => s.sincronizar(), 5000);
  setInterval(() => s.sincronizar(), 60 * 1000).unref();
  console.log(`Llamadas -> panel ${panel.url} (${panel.slug})`);
  return s;
}
