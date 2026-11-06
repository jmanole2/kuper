// Llamadas por teléfono que entran al número del agente (p. ej. un número de Telnyx importado en Retell,
// al que el cliente desvía su línea de siempre). Antes de contestar, Retell nos pregunta aquí y decidimos:
//   - "atender": contesta la asistente.
//   - "transferir": la asistente solo saluda y pasa la llamada al equipo (botón "Pausar llamadas" del panel
//     o "Horario de la IA: solo fuera del horario del equipo" mientras el equipo está en horario).
// Si el panel no responde, contesta la asistente: nunca se pierde una llamada.

// El número del asesor no va en el repo (es público): numero_transferencia en la demo o TRANSFERIR_<DEMO> en el .env.
export const variableTransferencia = (clave) => `TRANSFERIR_${String(clave).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
export const numeroTransferencia = (cfg, clave, env = process.env) => String(cfg?.numero_transferencia || env[variableTransferencia(clave)] || '').trim();

export const saludoTransferir = (negocio) => `Hola, gracias por llamar a ${negocio}. En un momento le comunico con un asesor.`;

/** Respuesta para el webhook "call_inbound" de Retell. turno = lo que contesta el panel ({ atiende, motivo }) o null. */
export function respuestaEntrante({ demo, clave, turno, infoPanel, transferencia }) {
  const transferir = Boolean(transferencia) && turno?.atiende === 'equipo';
  const variables = { modo_llamada: transferir ? 'transferir' : 'atender' };
  if (transferir) variables.saludo = saludoTransferir(demo.negocio);
  if (infoPanel) variables.info_panel = infoPanel;
  return { call_inbound: { dynamic_variables: variables, metadata: { origen: `telefono-${clave}`, atiende: transferir ? 'equipo' : 'ia', motivo: turno?.motivo || 'sin_panel' } } };
}
