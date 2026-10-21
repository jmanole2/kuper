// Funciones que Sofía usa durante la llamada para buscar, cambiar o cancelar una cita ya agendada en Cal.com.
// Retell las llama en POST https://<dominio>/funciones/<nombre> con { name, call, args }.
// Se activan con CAL_API_KEY y PUBLIC_URL en el .env.

import { createHmac, timingSafeEqual } from 'node:crypto';

const CAL = 'https://api.cal.com/v2';
const VERSION_LISTA = '2026-05-01';
const VERSION_CAMBIO = '2026-02-25';
export const hooks = { fetch: (...a) => fetch(...a), ahora: () => Date.now() }; // pruebas

/** Llave que Retell manda en cada función (se deriva de la clave de Retell; no hay que guardar otra). */
export const tokenFunciones = (retellKey) => createHmac('sha256', String(retellKey || '')).update('kuper-funciones-llamadas').digest('hex').slice(0, 40);

export function configFunciones(env = process.env) {
  const url = String(env.PUBLIC_URL || '').replace(/\/+$/, ''), cal = env.CAL_API_KEY || '', key = env.RETELL_API_KEY || '';
  return url && cal && key ? { url, cal, token: tokenFunciones(key) } : null;
}

/** Definiciones para Retell (general_tools del LLM). Sofía consulta horarios con la función de Cal.com que ya tiene. */
export function definiciones({ url, token }, tz) {
  const comun = { type: 'custom', method: 'POST', headers: { Authorization: `Bearer ${token}` }, timeout_ms: 20000, speak_during_execution: true, speak_after_execution: true, execution_message_type: 'static_text' };
  const correo = { type: 'string', description: 'Correo electrónico con el que la persona agendó la cita, confirmado letra por letra.' };
  const citaId = { type: 'string', description: 'ID de la cita que devolvió buscar_cita, si la persona tiene más de una.' };
  return [
    { ...comun, name: 'buscar_cita', url: `${url}/funciones/buscar_cita`, execution_message_description: 'Permítame revisar su cita.',
      description: 'Busca las citas próximas de la persona por su correo. Úsala antes de cambiar o cancelar una cita.',
      parameters: { type: 'object', properties: { correo }, required: ['correo'] } },
    { ...comun, name: 'cambiar_cita', url: `${url}/funciones/cambiar_cita`, execution_message_description: 'Un momento, la estoy cambiando.',
      description: 'Cambia la cita de la persona a un nuevo horario. Antes revisa que el horario esté libre con la función de disponibilidad y confirma con la persona.',
      parameters: { type: 'object', required: ['correo', 'nueva_fecha_hora'], properties: { correo, cita_id: citaId,
        nueva_fecha_hora: { type: 'string', description: `Nuevo inicio en formato ISO 8601 con zona horaria (${tz}), por ejemplo 2026-10-27T10:00:00-06:00.` } } } },
    { ...comun, name: 'cancelar_cita', url: `${url}/funciones/cancelar_cita`, execution_message_description: 'Un momento, la estoy cancelando.',
      description: 'Cancela la cita de la persona. Úsala solo si la persona confirmó que quiere cancelar (si solo quiere moverla, usa cambiar_cita).',
      parameters: { type: 'object', required: ['correo'], properties: { correo, cita_id: citaId, motivo: { type: 'string', description: 'Motivo de la cancelación, si lo dijo.' } } } },
  ];
}

export function crearFunciones({ cal, token, tz }) {
  const cuando = (iso) => new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  const calApi = async (metodo, ruta, version, cuerpo) => {
    const r = await hooks.fetch(CAL + ruta, { method: metodo, headers: { Authorization: `Bearer ${cal}`, 'cal-api-version': version, 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.status === 'error') throw new Error(`Cal.com ${ruta} ${r.status}: ${JSON.stringify(d.error || d).slice(0, 200)}`);
    return d;
  };
  const proximas = async (correo) => {
    const email = String(correo || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
    const d = await calApi('GET', `/bookings?status=upcoming&attendeeEmail=${encodeURIComponent(email)}&limit=10`, VERSION_LISTA);
    return (d.data || []).filter((b) => ['accepted', 'pending'].includes(b.status) && new Date(b.start) > hooks.ahora())
      .sort((a, b) => a.start.localeCompare(b.start));
  };
  const elegir = (citas, id) => (id ? citas.find((c) => c.uid === id) : citas.length === 1 ? citas[0] : null);

  const funciones = {
    async buscar_cita({ correo }) {
      const citas = await proximas(correo);
      if (!citas) return { resultado: 'Ese correo no parece válido. Pídelo de nuevo y confírmalo letra por letra.' };
      if (!citas.length) return { resultado: `No hay citas próximas con el correo ${correo}. Verifica el correo con la persona; si es correcto, ofrece agendar una nueva.` };
      return { resultado: `Citas próximas: ${citas.map((c) => `${cuando(c.start)} (cita_id ${c.uid})`).join('; ')}.`, citas: citas.map((c) => ({ cita_id: c.uid, inicio: c.start, cuando: cuando(c.start) })) };
    },
    async cambiar_cita({ correo, cita_id, nueva_fecha_hora }) {
      const nueva = new Date(nueva_fecha_hora);
      if (Number.isNaN(nueva.getTime()) || !/[zZ]|[+-]\d\d:?\d\d$/.test(String(nueva_fecha_hora))) return { resultado: 'La nueva fecha no es válida: mándala en ISO 8601 con zona horaria, por ejemplo 2026-10-27T10:00:00-06:00.' };
      if (nueva <= hooks.ahora()) return { resultado: 'Ese horario ya pasó. Ofrece otro.' };
      const citas = await proximas(correo);
      if (!citas?.length) return { resultado: `No encontré citas próximas con el correo ${correo}. Verifica el correo.` };
      const cita = elegir(citas, cita_id);
      if (!cita) return { resultado: `La persona tiene ${citas.length} citas: ${citas.map((c) => `${cuando(c.start)} (cita_id ${c.uid})`).join('; ')}. Pregunta cuál quiere cambiar y vuelve a llamar con su cita_id.` };
      try {
        const d = await calApi('POST', `/bookings/${encodeURIComponent(cita.uid)}/reschedule`, VERSION_CAMBIO, { start: nueva.toISOString(), reschedulingReason: 'Cambio pedido por teléfono a la asistente virtual' });
        return { resultado: `Listo: la cita se cambió de ${cuando(cita.start)} a ${cuando(d.data?.start || nueva)}. Le llegará la confirmación por correo.` };
      } catch (e) {
        console.error(`[funciones] cambiar_cita ${e.message}`);
        return { resultado: 'No se pudo cambiar a ese horario (puede que ya no esté libre). Revisa la disponibilidad y ofrece otro horario.' };
      }
    },
    async cancelar_cita({ correo, cita_id, motivo }) {
      const citas = await proximas(correo);
      if (!citas?.length) return { resultado: `No encontré citas próximas con el correo ${correo}. Verifica el correo.` };
      const cita = elegir(citas, cita_id);
      if (!cita) return { resultado: `La persona tiene ${citas.length} citas: ${citas.map((c) => `${cuando(c.start)} (cita_id ${c.uid})`).join('; ')}. Pregunta cuál quiere cancelar y vuelve a llamar con su cita_id.` };
      await calApi('POST', `/bookings/${encodeURIComponent(cita.uid)}/cancel`, VERSION_CAMBIO, { cancellationReason: String(motivo || 'Cancelada por teléfono con la asistente virtual').slice(0, 300) });
      return { resultado: `Listo: se canceló la cita del ${cuando(cita.start)}. Le llegará un correo de confirmación. Ofrece agendar otra fecha si la persona quiere.` };
    },
  };

  /** Atiende POST /funciones/:nombre. Devuelve [código, cuerpo]. */
  async function atender(nombre, authorization, cuerpo) {
    const dado = Buffer.from(String(authorization || '').replace(/^Bearer\s+/i, '')), quiero = Buffer.from(token);
    if (dado.length !== quiero.length || !timingSafeEqual(dado, quiero)) return [401, { error: 'No autorizado' }];
    const f = Object.hasOwn(funciones, nombre) ? funciones[nombre] : null;
    if (!f) return [404, { error: 'Función desconocida' }];
    try { return [200, await f(cuerpo?.args || {})]; }
    catch (e) {
      console.error(`[funciones] ${nombre} ${e.message}`);
      return [200, { resultado: 'Hubo un problema con el calendario. Discúlpate, toma sus datos y dile que un asesor le confirmará el cambio por correo.' }];
    }
  }
  return { atender, funciones };
}
