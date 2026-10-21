// El panel le habla al agente de WhatsApp de cada cliente (para responder a mano y tomar el control).
// Usa la misma llave que el agente usa para hablarle al panel (Configuración → Agente de WhatsApp).
import * as db from './db.js';

export const hooks = {}; // pruebas: hooks.fetch
export const agenteConfigurado = (client) => { const c = db.clientCredentials(client); return !!(c.agente_url && c.api_key); };
export const identidad = (lead) => (lead.telefono ? { telefono: lead.telefono } : { usuario: lead.usuario });

export async function llamarAgente(client, method, path, body, { timeout = 15000 } = {}) {
  const c = db.clientCredentials(client);
  if (!c.agente_url || !c.api_key) throw new Error('Falta la URL del agente o su llave (Configuración → Agente de WhatsApp).');
  const url = `${c.agente_url.replace(/\/$/, '')}/panel${path}`;
  const res = await (hooks.fetch || fetch)(url, {
    method, headers: { Authorization: `Bearer ${c.api_key}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(j.error === 'ventana_cerrada' ? 'Pasaron más de 24 h desde su último mensaje: WhatsApp no deja escribirle hasta que vuelva a escribir.' : (j.mensaje || j.error || `El agente respondió ${res.status}`)); e.code = j.error; throw e; }
  return j;
}
