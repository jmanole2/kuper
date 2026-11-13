// Ayuda con IA para quien contesta en la bandeja: sugerir respuesta, resumir la conversación y traducir.
// Solo propone texto; nada se manda sin que la persona lo envíe.
import * as db from './db.js';
import * as conocimiento from './conocimiento.js';
import { pedirJSON } from './llm/proveedor.js';

export const hooks = { ia: (...a) => pedirJSON(...a) }; // pruebas
export const MAX_DIA = 200; // por marca
const usos = new Map();
const S = { type: 'string' };
const obj = (p) => ({ type: 'object', additionalProperties: false, required: Object.keys(p), properties: p });

const conversacion = (lead, n = 30) => db.leadMessages(lead.id).slice(-n)
  .map((m) => `${m.rol === 'lead' ? 'Cliente' : m.rol === 'humano' ? `Equipo${m.autor ? ` (${m.autor})` : ''}` : 'Agente IA'}: ${String(m.texto).slice(0, 1200)}`).join('\n');

function cupo(client) {
  const k = `${client.id}:${new Date().toISOString().slice(0, 10)}`;
  if ((usos.get(k) || 0) >= MAX_DIA) throw new Error('Se alcanzó el límite de ayudas de IA de hoy. Mañana se reinicia.');
  usos.set(k, (usos.get(k) || 0) + 1);
}

export async function ayudar(client, lead, accion, texto = '') {
  if (!['sugerir', 'resumir', 'traducir'].includes(accion)) throw new Error('Acción no válida');
  const chat = conversacion(lead);
  if (!chat) throw new Error('Esta conversación todavía no tiene mensajes.');
  cupo(client);
  const t = String(texto || '').trim().slice(0, 4000);
  if (accion === 'sugerir') {
    const r = await hooks.ia({ etiqueta: 'copiloto', maxTokens: 900, schema: obj({ respuesta: S }),
      system: `Ayudas a una persona del equipo de ${client.nombre} a contestarle a un cliente. Escribe la siguiente respuesta del equipo: breve, cálida, en el idioma del cliente y lista para mandar por chat (sin saludo repetido si ya se saludaron, sin firma). Usa solo la información del negocio; si falta un dato, deja [completar: …] en vez de inventarlo.${t ? `\nLa persona ya empezó a escribir esto; mejóralo y complétalo sin cambiar su intención: "${t}"` : ''}
INFORMACIÓN DEL NEGOCIO:
${conocimiento.textoParaAgente(client).slice(0, 15000) || '(sin información)'}`,
      messages: [{ role: 'user', content: `Conversación:\n${chat}` }] });
    return { texto: String(r.data?.respuesta || '').trim() };
  }
  if (accion === 'resumir') {
    const r = await hooks.ia({ etiqueta: 'copiloto', maxTokens: 700, schema: obj({ resumen: { type: 'array', items: S }, siguiente_paso: S }),
      system: 'Resume en español, para alguien del equipo que va a retomar esta conversación: 3 a 5 puntos cortos (qué quiere el cliente, datos clave, qué se le prometió, en qué quedó) y el siguiente paso recomendado.',
      messages: [{ role: 'user', content: chat }] });
    return { resumen: (r.data?.resumen || []).slice(0, 6).map(String), siguiente_paso: String(r.data?.siguiente_paso || '') };
  }
  // traducir: con texto, al idioma del cliente; sin texto, los últimos mensajes del cliente al español.
  const r = await hooks.ia({ etiqueta: 'copiloto', maxTokens: 900, schema: obj({ idioma: S, traduccion: S }),
    system: t ? 'Traduce el borrador del equipo al idioma en que escribe el cliente (detéctalo de la conversación). Conserva el tono. Si el cliente escribe en español, devuelve el borrador igual. Contesta el nombre del idioma en español en "idioma".'
      : 'Traduce al español los últimos mensajes del cliente (los marcados "Cliente:") de esta conversación. Contesta el idioma original en "idioma" (en español).',
    messages: [{ role: 'user', content: t ? `Conversación:\n${chat}\n\nBorrador a traducir:\n${t}` : chat }] });
  return { idioma: String(r.data?.idioma || ''), texto: String(r.data?.traduccion || '').trim(), borrador: !!t };
}
