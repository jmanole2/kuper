// Marcador del agente de ventas: cada 2 minutos pide al panel la siguiente empresa y le marca.
// El panel decide si toca llamar (activado, horario de oficina, REPEP revisado, intentos, una a la vez).
// Necesita RETELL_FROM_NUMBER (número comprado en Retell) y PANEL_URL / PANEL_SLUG / PANEL_API_KEY.
// El resultado de cada llamada lo manda panel.mjs cuando Retell termina el resumen.

import { configPanel } from './panel.mjs';

export const hooks = { fetch: (...a) => fetch(...a) }; // pruebas

export function crearMarcador({ key, ventasId, panel, desde, log = console }) {
  const alPanel = (ruta, metodo = 'GET', cuerpo) => hooks.fetch(`${panel.url}/api/${encodeURIComponent(panel.slug)}/${ruta}`, {
    method: metodo, headers: { Authorization: `Bearer ${panel.key}`, 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  let ocupado = false;
  async function turno() {
    if (ocupado) return { omitido: true };
    ocupado = true;
    try {
      const r = await alPanel('prospectos/siguiente');
      if (!r.ok) throw new Error(`panel ${r.status}`);
      const { prospecto, motivo } = await r.json();
      if (!prospecto) return { motivo };
      const llamada = await hooks.fetch('https://api.retellai.com/v2/create-phone-call', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_number: desde, to_number: prospecto.telefono, override_agent_id: await ventasId(),
          retell_llm_dynamic_variables: { empresa: prospecto.empresa, giro: prospecto.giro || 'negocio', ciudad: prospecto.ciudad || 'México' },
          metadata: { prospecto_id: String(prospecto.id), origen: 'ventas' },
        }),
      });
      const d = await llamada.json().catch(() => ({}));
      if (!llamada.ok) {
        // No se pudo marcar: se registra como "no contestó" para no dejarla trabada en "llamando".
        await alPanel(`prospectos/${prospecto.id}/resultado`, 'POST', { resultado: 'no_contesto', resumen: `No se pudo marcar (${llamada.status}).` });
        throw new Error(`create-phone-call ${llamada.status}: ${JSON.stringify(d).slice(0, 200)}`);
      }
      log.log(`${new Date().toISOString()} ventas: marcando a ${prospecto.empresa} (${d.call_id})`);
      return { llamando: prospecto.id, call_id: d.call_id };
    } catch (e) {
      log.error(`[ventas] ${e.message}`);
      return { error: e.message };
    } finally { ocupado = false; }
  }
  return { turno };
}

export function iniciar({ key, ventasId }) {
  const panel = configPanel(), desde = process.env.RETELL_FROM_NUMBER || '';
  if (!panel || !key || !desde || !ventasId) return null;
  const m = crearMarcador({ key, ventasId, panel, desde });
  setInterval(() => m.turno(), 2 * 60 * 1000).unref();
  console.log(`Agente de ventas: marcará desde ${desde} cuando el panel lo active.`);
  return m;
}
