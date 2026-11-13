// Chat de ayuda de Kuper dentro del panel: contesta dudas de cómo usar el panel con un manual, y si no sabe
// o es algo de cobro, contrato o un error, manda a la persona al WhatsApp de Kuper. Solo explica: no cambia nada.
import * as plan from './plan.js';
import { pedirJSON } from './llm/proveedor.js';

export const hooks = { ia: (...a) => pedirJSON(...a) }; // pruebas
export const MAX_DIA = 40; // por persona
const usos = new Map();

export const MANUAL = `MANUAL DEL PANEL DE KUPER (redes.kuper.media). Menú de la izquierda; cada marca ve solo lo que contrató.
- Inicio: resumen de la marca (leads, publicaciones, avisos).
- Publicaciones: el agente de redes propone posts (imagen o video, texto, hashtags). Se aprueban, se piden cambios o se rechazan; nada se publica sin aprobación. Si dice "Necesita una foto o video tuyo", hay que subirlo. Se publican solos en el mejor horario.
- Leads: todas las personas que escribieron (WhatsApp, Instagram, Messenger, llamadas, chat web, correo). Arriba hay filtros por campaña de Meta; "Descargar CSV" baja la lista. Si una campaña no es de la marca (anuncio de otra empresa), se elige esa campaña y se toca "No es nuestra": sus leads salen de reportes y el agente les contesta que se equivocaron de número; se deshace en "Ver campañas que no son tuyas".
- Conversación de un lead (botón "Ver chat"): se ve todo lo que se dijeron. "Tomar control" pausa la IA solo con esa persona y se contesta desde el panel; "Devolver al agente" la regresa. Botones de IA: "Sugerir respuesta" (escribe un borrador), "Resumir conversación" y "Traducir". A la derecha está la ficha: nombre, correo, empresa, valor, etiquetas, notas, asesor y resultado.
- Embudo de ventas: tablero por etapas; se arrastran los leads entre etapas o a Vendido / Perdido / Resuelto (abajo). Los tres puntos de cada etapa: cambiar nombre, agregar etapa, marcar estancado tras N días, tipo de etapa, abrir formulario al entrar, eliminar, y "Que aquí solo conteste el equipo" (en esa etapa la IA deja de contestar; al sacar al lead de ahí, la IA vuelve). Selección múltiple para mover, asignar asesor o prioridad. "Crear lead" agrega uno a mano. 🔥 = más cerca de comprar.
- Analítica: mensajes, leads nuevos, tiempo de respuesta (IA y equipo), fuera de horario, ventas, temas, canales, asesores, con filtro de fechas y por asesor. Tarjeta "Con IA": "Analizar conversaciones" agrupa de qué pregunta la gente, lo que el agente no supo contestar y propone texto para agregarle (botón "Agregar a lo que sabe mi agente"); una vez cada 6 horas.
- Agente (Lo que sabe tu agente): el texto que usa la IA para contestar (servicios, precios, horarios, preguntas frecuentes). "Llenar desde mi página" arma un borrador leyendo su sitio web; se revisa y se toca Guardar. Hay versiones anteriores para restaurar. También: Pausar agente (deja de contestar a todos), Horario de la IA (siempre o solo fuera del horario del equipo), Avisos por tiempo limitado (promos que vencen solas), Conectar WhatsApp, Países por lada y documentos por WhatsApp (se guardan en su expediente y en Google Drive), archivos que el agente puede mandar (brochure, catálogo).
- Probar agente (botón en "Lo que sabe tu agente"): chat de prueba con el agente real; no agenda, no guarda ni le escribe a nadie (las acciones salen marcadas "(prueba)"). Preguntas de control: pregunta + qué debe contestar; se corren solas al cambiar lo que sabe el agente y avisan al celular si una que salía bien empieza a fallar. "Correr ahora" las corre a mano.
- Anuncios: lo que gastó cada anuncio de Meta junto a sus leads, conversaciones y ventas (costo por lead, costo por venta, ROAS) en 7, 30 o 90 días. "Revisar mis anuncios": la IA dice qué escalar, pausar o revisar y propone textos para anuncios nuevos. Se guarda el ID de la cuenta publicitaria para ver también los anuncios que gastan sin traer nada. "Mandar un público a Meta": compradores, todos los leads o los que no compraron, con público similar 1% (mínimo 100 contactos; van cifrados). Requiere el token de anuncios que conecta Kuper.
- Carritos abandonados (tiendas en línea): Shopify con webhook (Creación de pago y Creación de pedido) u otra tienda con la API; tras X horas se manda una plantilla de WhatsApp con el link para terminar la compra y, opcional, un segundo recordatorio. Si compra después, cuenta como recuperado y el lead queda vendido. Solo de 9 a 21 h.
- Citas: la agenda (Google Calendar) con las citas que agenda el agente; recordatorios 24 h y 2 h antes.
- Comentarios: el agente contesta comentarios de Instagram y Facebook (posts y anuncios), manda al mensaje directo a quien quiere comprar y oculta spam. Se puede pedir aprobación antes de responder, pausar, y dar cupones por DM.
- Campañas de WhatsApp: mandar una plantilla aprobada por Meta a un segmento (por etapa, etiquetas, origen, días sin actividad). Toda campaña se aprueba antes de salir; tope diario (250 al inicio, lo pone Meta); las automáticas ("30 días sin comprar") escriben cada día a quien entra al segmento. Las plantillas se crean y aprueban en Meta; Meta cobra cada mensaje de plantilla.
- Cupones: promociones que da el agente (código único o imagen por WhatsApp), vigencia y máximo al día. En sucursal se canjea escribiendo el código; un usuario "solo caja" solo ve esa pantalla.
- Cobros por chat: el agente manda un link de pago de Mercado Pago o Stripe con la cuenta de la marca; al pagar, el lead queda vendido. Se necesita el token del proveedor (se pega en Ajustes, se guarda cifrado). También "Ventas a Meta" (pixel y token de la API de conversiones).
- Correo: conectar el correo de la marca (Google, Outlook, DreamHost u otro) con una "contraseña de aplicación"; la IA deja borradores para aprobar o contesta sola (modo automático); lo delicado lo deja para una persona. "Probar conexión" y "Revisar buzón ahora". Los correos viejos no se contestan.
- Equipo: reparto automático de leads (por turnos o al de menos carga) entre asesores disponibles, tiempos de respuesta por asesor, alertas cuando alguien espera demasiado (correo y celular), encuesta de satisfacción 1 a 5 al marcar Vendido o Resuelto.
- Pregúntale a tu panel: preguntas sobre sus datos ("¿quién espera respuesta?") y también puede hacer cosas (mover, asignar, etiquetar, preparar una campaña) siempre pidiendo confirmar.
- Llamadas: el agente de voz contesta, agenda y transfiere; cada llamada con resumen y grabación. Se puede pausar.
- Reporte del mes: resumen mensual de redes y leads.
- Pagos: mensualidades, facturas (CFDI) y datos fiscales.
- Mi cuenta: cambiar contraseña, verificación en dos pasos, "Activar avisos" al celular. El panel se instala en el celular desde el navegador ("Agregar a pantalla de inicio").
- Usuarios y accesos nuevos, cambios de plan, conectar Instagram/Facebook/WhatsApp por primera vez, facturas o cobros de Kuper, y errores: los atiende el equipo de Kuper por WhatsApp.`;

const S = { type: 'string' };
const SCHEMA = { type: 'object', additionalProperties: false, required: ['respuesta', 'hablar_con_kuper'], properties: { respuesta: S, hablar_con_kuper: { type: 'boolean' } } };

export async function preguntar(client, user, pregunta, historial = []) {
  const p = String(pregunta || '').trim().slice(0, 600);
  if (!p) throw new Error('Escribe tu duda.');
  const k = `${user?.id || 'x'}:${new Date().toISOString().slice(0, 10)}`;
  if ((usos.get(k) || 0) >= MAX_DIA) throw new Error('Ya hiciste muchas preguntas hoy. Escríbenos por WhatsApp y te ayudamos.');
  usos.set(k, (usos.get(k) || 0) + 1);
  const contratado = Object.entries(plan.SERVICIOS).filter(([s]) => plan.tiene(client, s)).map(([, v]) => v.nombre).join(', ') || 'ninguno';
  const system = `Eres el asistente de ayuda de Kuper Media dentro del panel. Le explicas a ${user?.nombre || 'la persona'} (de ${client.nombre}) cómo usar el panel, en español, breve y paso a paso (dónde dar clic).
- Usa SOLO el manual de abajo. No inventes botones ni funciones. Si no está en el manual, o es un error, un cobro de Kuper, un cambio de plan, un acceso nuevo o algo que requiere al equipo de Kuper, pon "hablar_con_kuper": true y di que lo escriba por WhatsApp a Kuper.
- No tienes acceso a sus datos (leads, conversaciones): para eso está "Pregúntale a tu panel".
- Si pregunta por algo que su marca no contrató, dile que esa sección se activa contratándola con Kuper.
Servicios contratados por ${client.nombre}: ${contratado}.
${MANUAL}`;
  const mensajes = [...(Array.isArray(historial) ? historial : []).slice(-6).map((m) => ({ role: m.rol === 'ayuda' ? 'assistant' : 'user', content: String(m.texto || '').slice(0, 1500) })), { role: 'user', content: p }];
  const r = await hooks.ia({ system, messages: mensajes, schema: SCHEMA, maxTokens: 800, etiqueta: 'ayuda' });
  return { respuesta: String(r.data?.respuesta || 'No te entendí, ¿me lo explicas de otra forma?').slice(0, 2500), hablar_con_kuper: !!r.data?.hablar_con_kuper };
}
