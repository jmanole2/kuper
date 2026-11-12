#!/usr/bin/env node
// Crea o actualiza el agente telefónico de citas en Retell.
//
//   node agente-llamadas/retell.mjs voces            -> voces disponibles con acento latino/español
//   node agente-llamadas/retell.mjs crear            -> crea el agente (o lo actualiza si ya existe)
//   node agente-llamadas/retell.mjs llamar +52...    -> el agente llama a ese número
//
// Requiere la variable de entorno RETELL_API_KEY. Opcional: --config otro-negocio.json

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configFunciones, definiciones, tokenFunciones } from './funciones.mjs';
import { agentePorNombre } from './agentes.mjs';
import { numeroTransferencia, variableTransferencia } from './entrante.mjs';
import { construirPrompt } from './prompt.mjs';

const API = 'https://api.retellai.com';
const aqui = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const comando = args[0];
const iCfg = args.indexOf('--config');
const rutaCfg = iCfg >= 0 ? resolve(args[iCfg + 1]) : resolve(aqui, 'negocio.json');
const cfg = JSON.parse(readFileSync(rutaCfg, 'utf8'));
const demoClave = rutaCfg.split('/').pop().replace(/\.json$/, '');
// Número del asesor al que se pasan las llamadas (numero_transferencia o TRANSFERIR_<DEMO> en el .env).
const TRANSFERIR = numeroTransferencia(cfg, demoClave);

const KEY = process.env.RETELL_API_KEY;

async function api(metodo, ruta, cuerpo) {
  if (!KEY) throw new Error('Falta RETELL_API_KEY. Agrégala como variable de entorno (ver agente-llamadas/LEEME.md).');
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${ruta} -> ${r.status}: ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

// Agente completo (con response_engine) por nombre, o null.
async function buscar(nombre) {
  if (!KEY) throw new Error('Falta RETELL_API_KEY. Agrégala como variable de entorno (ver agente-llamadas/LEEME.md).');
  const a = await agentePorNombre(KEY, nombre);
  return a ? api('GET', `/get-agent/${a.agent_id}`) : null;
}

const tz = cfg.zona_horaria;
const saludoEntrante = `Hola, gracias por llamar a ${cfg.negocio}, le atiende ${cfg.asistente}, asistente virtual. ¿En qué le puedo ayudar?`;

const prompt = () => construirPrompt(cfg, { transferir: TRANSFERIR, conFunciones: Boolean(configFunciones()) });

function herramientas() {
  const tools = [
    { type: 'end_call', name: 'terminar_llamada', description: 'Termina la llamada cuando la conversación concluyó y ya te despediste.' },
  ];
  const t = herramientaTransferir();
  if (t) tools.push(t);
  return tools;
}
function herramientaTransferir() {
  if (!TRANSFERIR) return null;
  return {
    type: 'transfer_call',
    name: 'transferir_a_humano',
    description: 'Pasa la llamada a una persona del equipo: cuando el cliente lo pida, o de inmediato si el modo de la llamada es "transferir".',
    transfer_destination: { type: 'predefined', number: TRANSFERIR },
    transfer_option: { type: 'cold_transfer' },
  };
}
// Agrega, actualiza o quita transferir_a_humano sin tocar las demás funciones.
async function sincronizarTransferencia(llmId) {
  try {
    const llm = await api('GET', `/get-retell-llm/${llmId}`);
    const antes = llm.general_tools || [];
    const otras = antes.filter((x) => x.name !== 'transferir_a_humano');
    const t = herramientaTransferir();
    if (!t && otras.length === antes.length) return;
    await api('PATCH', `/update-retell-llm/${llmId}`, { general_tools: t ? [...otras, t] : otras });
    console.log(t ? `${cfg.asistente} puede pasar llamadas al equipo.` : `${cfg.asistente}: sin número para pasar llamadas (${variableTransferencia(demoClave)}).`);
  } catch (e) { console.error(`No pude actualizar transferir_a_humano: ${e.message}`); }
}

async function elegirVoz(vozId = cfg.voz_id, genero = 'female') {
  if (vozId) return vozId;
  const voces = await api('GET', '/list-voices');
  // acento_voz (opcional, regex): p. ej. "spain|castil|españa" para España.
  const acento = new RegExp(cfg.acento_voz || 'mexic|latin|spanish|español', 'i');
  const prov = (v) => !cfg.voz_proveedor || v.provider === cfg.voz_proveedor;
  let latinas = voces.filter((v) => acento.test(`${v.accent} ${v.voice_name}`) && prov(v));
  if (!latinas.length && cfg.acento_voz) {
    console.log(`No hay voz con acento "${cfg.acento_voz}"; uso otra en español (o pon "voz_id").`);
    latinas = voces.filter((v) => /spanish|español|mexic|latin/i.test(`${v.accent} ${v.voice_name}`) && prov(v));
    if (!latinas.length) latinas = voces.filter((v) => /spanish|español|mexic|latin/i.test(`${v.accent} ${v.voice_name}`));
  }
  const voz = latinas.find((v) => v.gender === genero) || latinas[0];
  if (!voz) throw new Error('No encontré una voz en español. Corre el comando "voces" y pon una en "voz_id" de negocio.json.');
  console.log(`Voz elegida: ${voz.voice_name} (${voz.accent}, ${voz.provider}) -> ${voz.voice_id}`);
  return voz.voice_id;
}

// Si Retell rechaza la combinación de idiomas o el modelo de voz (demos en varios idiomas),
// se vuelve a intentar con un solo idioma, para que la demo siempre funcione.
async function guardarAgente(enviar, agente) {
  try { return await enviar(agente); }
  catch (e) {
    if (!Array.isArray(agente.language) && !agente.voice_model) throw e;
    const solo = { ...agente, language: Array.isArray(agente.language) ? agente.language[0] : agente.language };
    delete solo.voice_model;
    console.log(`Retell no aceptó idiomas ${JSON.stringify(agente.language)}${agente.voice_model ? ` / ${agente.voice_model}` : ''} (${e.message}). Uso solo ${solo.language}.`);
    return enviar(solo);
  }
}

async function crear() {
  const llm = {
    general_prompt: prompt(),
    begin_message: '{{saludo}}',
    start_speaker: 'agent',
    model_config: { type: 'cascading', primary: { model: cfg.modelo }, temperature: 0.2 },
    default_dynamic_variables: { saludo: saludoEntrante, nombre_cliente: 'desconocido', motivo_llamada: 'ninguno', modo_llamada: 'atender', ...(cfg.panel_slug ? { info_panel: 'Sin cambios recientes.' } : {}), ...(cfg.variables_defecto || {}) },
  };
  const agente = {
    agent_name: cfg.nombre_agente,
    // idioma_voz: 'es-419' por defecto; 'es-ES' para España, o una lista (["es-ES","en-US","ru-RU"]) para que hable varios idiomas.
    language: cfg.idioma_voz || 'es-419',
    voice_id: await elegirVoz(),
    ...(cfg.voz_modelo ? { voice_model: cfg.voz_modelo } : {}),
    // Topes para no gastar créditos si alguien deja la llamada abierta.
    // Qué tanto lo interrumpe un ruido o una palabra suelta (0 a 1; 1 = se calla con cualquier sonido).
    interruption_sensitivity: Number.isFinite(Number(cfg.interrupcion)) ? Number(cfg.interrupcion) : 0.6,
    max_call_duration_ms: (Number(cfg.duracion_max_seg) || 600) * 1000,
    end_call_after_silence_ms: (Number(cfg.silencio_max_seg) || 30) * 1000,
    post_call_analysis_data: [
      { type: 'system-presets', name: 'call_summary' },
      { type: 'boolean', name: 'cita_agendada', description: '¿Se agendó una cita durante la llamada?' },
      { type: 'string', name: 'nombre_cliente', description: 'Nombre completo del cliente, si lo dio.' },
      { type: 'string', name: 'correo_cliente', description: 'Correo del cliente, si lo dio.' },
      { type: 'string', name: 'telefono_cliente', description: 'Número de teléfono o WhatsApp que dio el cliente, solo dígitos con lada (por ejemplo 5512345678). Vacío si no lo dio.' },
    ],
  };

  const previo = await buscar(cfg.nombre_agente);

  if (previo) {
    // No mandamos general_tools: así no se borran las funciones de Cal.com agregadas en el panel.
    const llmId = previo.response_engine?.llm_id;
    await api('PATCH', `/update-retell-llm/${llmId}`, llm);
    await guardarAgente((a) => api('PATCH', `/update-agent/${previo.agent_id}`, a), agente);
    console.log(`Agente actualizado: ${previo.agent_id} (LLM ${llmId})`);
    if (!cfg.instrucciones) await sincronizarFunciones(llmId);
    await sincronizarDisponibilidad(llmId);
    await sincronizarTransferencia(llmId);
    return;
  }

  const nuevoLlm = await api('POST', '/create-retell-llm', { ...llm, general_tools: herramientas() });
  const nuevo = await guardarAgente((a) => api('POST', '/create-agent', a), { ...agente, response_engine: { type: 'retell-llm', llm_id: nuevoLlm.llm_id } });
  console.log(`Agente creado: ${nuevo.agent_id} (LLM ${nuevoLlm.llm_id})`);
  await sincronizarDisponibilidad(nuevoLlm.llm_id);
  if (cfg.instrucciones) return; // demo de prospecto: toma los datos, sin calendario
  await sincronizarFunciones(nuevoLlm.llm_id);
  console.log('Siguiente paso: en el panel de Retell agrega las funciones de Cal.com (ver LEEME.md).');
}

// Disponibilidad en el momento (Airtable del cliente vía su panel): la asistente dice "dame un segundo" y consulta.
function herramientaDisponibilidad() {
  if (!cfg.panel_slug) return null;
  const base = String(process.env.PUBLIC_URL || 'https://llamadas.kuper.media').replace(/\/+$/, '');
  return {
    type: 'custom', name: 'consultar_disponibilidad', method: 'POST', url: `${base}/funciones/disponibilidad?demo=${encodeURIComponent(demoClave)}`,
    headers: { Authorization: `Bearer ${tokenFunciones(KEY)}` }, timeout_ms: 10000,
    speak_during_execution: true, speak_after_execution: true, // La frase de "lo reviso" la escribe la IA (no es fija), para que no suene a robot.
    execution_message_type: 'prompt',
    execution_message_description: 'Antes de revisar, di UNA frase muy corta y natural, distinta cada vez y ligada a lo que pidió la persona, para avisar que lo vas a revisar. Ejemplos de estilo (no los repitas tal cual): "Va, déjame ver qué tenemos en Del Valle", "Claro, lo checo en este momento", "Permíteme, reviso qué hay para seis personas", "A ver, te digo qué está libre ahorita". Nunca uses dos veces la misma frase en la llamada.',
    description: 'Consulta en el sistema qué oficinas y puestos fijos están disponibles AHORA. Úsala SIEMPRE antes de decir si hay o no hay disponibilidad, y antes de ofrecer una oficina concreta.',
    parameters: { type: 'object', properties: {
      sede: { type: 'string', description: 'Sede o zona que pidió (Polanco, Roma Norte, Del Valle, Parque Hundido, San Borja, Coyoacán). Vacío si no importa.' },
      personas: { type: 'number', description: 'Cuántas personas, si lo dijo.' },
      tipo: { type: 'string', enum: ['oficina privada', 'puesto fijo', ''], description: 'Qué busca, si lo dijo.' } } },
  };
}
async function sincronizarDisponibilidad(llmId) {
  const t = herramientaDisponibilidad();
  if (!t) return;
  try {
    const llm = await api('GET', `/get-retell-llm/${llmId}`);
    const otras = (llm.general_tools || []).filter((x) => x.name !== t.name);
    await api('PATCH', `/update-retell-llm/${llmId}`, { general_tools: [...otras, t] });
    console.log(`Disponibilidad en el momento lista para ${cfg.asistente} (${demoClave}).`);
  } catch (e) { console.error(`No pude agregar consultar_disponibilidad: ${e.message}`); }
}

// Agrega (o actualiza) nuestras funciones de citas sin tocar las demás (p. ej. las de Cal.com del panel).
const NUESTRAS = ['ver_horarios', 'agendar_cita', 'buscar_cita', 'cambiar_cita', 'cancelar_cita'];
async function sincronizarFunciones(llmId, nombres = ['buscar_cita', 'cambiar_cita', 'cancelar_cita']) {
  const f = configFunciones();
  try {
    const llm = await api('GET', `/get-retell-llm/${llmId}`);
    const otras = (llm.general_tools || []).filter((t) => !NUESTRAS.includes(t.name));
    const nuevas = f ? definiciones(f, tz, nombres) : [];
    if (!f && otras.length === (llm.general_tools || []).length) return console.log('Funciones de citas: sin CAL_API_KEY o PUBLIC_URL, no se agregan.');
    await api('PATCH', `/update-retell-llm/${llmId}`, { general_tools: [...otras, ...nuevas] });
    console.log(f ? `Funciones de citas listas: ${nombres.join(', ')} -> ${f.url}/funciones` : 'Funciones de citas quitadas (falta CAL_API_KEY o PUBLIC_URL).');
  } catch (e) {
    console.error(`No pude agregar las funciones de citas: ${e.message}`);
  }
}

// ------------------------------------------------------------ agente de ventas (llama a empresas)
const V = cfg.ventas || null;
function promptVentas() {
  const lista = (xs) => xs.map((x) => `- ${x}`).join('\n');
  return `## Identidad
Eres ${V.asistente}, asesor virtual de ${cfg.negocio}, ${cfg.giro}. Hablas español de México, con tono amable, seguro y breve. Eres un asistente de inteligencia artificial y lo dices desde el inicio.

## Contexto de esta llamada
- Llamas a la empresa: {{empresa}} (giro: {{giro}}, ciudad: {{ciudad}}).
- Fecha y hora actual: {{current_time_${tz}}}
- Es una llamada en frío: no te esperaban. Respeta su tiempo.

## Lo que ofreces
${V.propuesta}
${lista(V.beneficios)}

Servicios:
${lista(cfg.servicios)}

## Cómo llevar la llamada
1. Cuando contesten, saluda, di tu nombre, que eres un asistente virtual de ${cfg.negocio}, y pregunta si hablas con {{empresa}}. Si no es ahí, discúlpate y termina la llamada.
2. Pide hablar con el dueño o con quien atiende los clientes. Si no está, pregunta su nombre y un correo para mandarle información, agradece y termina.
3. Pregunta si tiene un minuto. Si dice que no, ofrece llamar otro día o mandarle información por correo, y termina.
4. Haz como máximo dos preguntas para entender cómo atienden hoy (por ejemplo: "¿quién contesta los WhatsApp cuando están ocupados o cerrados?").
5. Conecta su respuesta con un beneficio concreto, en una o dos frases.
6. Ofrece ${cfg.tipo_de_cita} sin costo. Si acepta: usa ver_horarios, ofrece dos o tres horarios, pide su nombre completo y su correo (repítelo letra por letra) y usa agendar_cita.
7. Confirma día y hora, agradece y termina la llamada.

## Reglas
- Respuestas cortas: una o dos frases por turno.
- Todo lo que escribes se lee en voz alta: nunca uses símbolos, barras, abreviaturas ni viñetas. Di "las 24 horas, todos los días" (nunca "24/7"), "por ciento" en vez de "%", "pesos" en vez de "$" y los correos como "arroba" y "punto".
- Si dice que no le interesa, agradece una sola vez y termina. No insistas ni discutas.
- Si pide que no le vuelvan a llamar, discúlpate, confirma que no se le llamará de nuevo y termina.
- Nunca inventes precios: se cotiza en la videollamada. Nunca inventes horarios.
- Si contesta un buzón de voz o una grabación, termina la llamada sin dejar mensaje.
- Si te preguntan cómo conseguiste el número: lo encontraste en el perfil público del negocio en Google Maps.`;
}
async function crearVentas() {
  if (!V) return;
  const llm = {
    general_prompt: promptVentas(),
    begin_message: '',
    start_speaker: 'user',
    model_config: { type: 'cascading', primary: { model: cfg.modelo }, temperature: 0.3 },
    default_dynamic_variables: { empresa: 'su negocio', giro: 'negocio', ciudad: 'México' },
  };
  const agente = {
    agent_name: V.nombre_agente,
    language: 'es-419',
    voice_id: await elegirVoz(V.voz_id, V.genero_voz || 'male'),
    // Qué tanto lo interrumpe un ruido o una palabra suelta (0 a 1; 1 = se calla con cualquier sonido).
    interruption_sensitivity: Number.isFinite(Number(cfg.interrupcion)) ? Number(cfg.interrupcion) : 0.6,
    max_call_duration_ms: 6 * 60 * 1000,
    end_call_after_silence_ms: 20 * 1000,
    voicemail_option: { action: { type: 'hangup' } },
    post_call_analysis_data: [
      { type: 'system-presets', name: 'call_summary' },
      { type: 'enum', name: 'resultado', description: 'Cómo terminó la llamada.', choices: ['no_contesto', 'no_interesa', 'interesado', 'cita', 'no_llamar'],
        conditional_prompt: 'no_contesto: buzón, nadie respondió o número equivocado. no_interesa: dijo que no. interesado: quiere información o que le llamen después. cita: se agendó la videollamada. no_llamar: pidió que no le vuelvan a llamar.' },
      { type: 'string', name: 'nombre_contacto', description: 'Nombre y puesto de la persona con quien se habló, si lo dio.' },
      { type: 'string', name: 'correo_contacto', description: 'Correo que dio la persona, si lo dio.' },
    ],
  };
  const previo = await buscar(V.nombre_agente);
  let llmId;
  if (previo) {
    llmId = previo.response_engine?.llm_id;
    await api('PATCH', `/update-retell-llm/${llmId}`, llm);
    await api('PATCH', `/update-agent/${previo.agent_id}`, agente);
    console.log(`Agente de ventas (${V.asistente}) actualizado: ${previo.agent_id}`);
  } else {
    const nuevoLlm = await api('POST', '/create-retell-llm', { ...llm, general_tools: [{ type: 'end_call', name: 'terminar_llamada', description: 'Termina la llamada cuando ya te despediste, si no le interesa o si es un buzón de voz.' }] });
    llmId = nuevoLlm.llm_id;
    const nuevo = await api('POST', '/create-agent', { ...agente, response_engine: { type: 'retell-llm', llm_id: llmId } });
    console.log(`Agente de ventas (${V.asistente}) creado: ${nuevo.agent_id}`);
  }
  await sincronizarFunciones(llmId, NUESTRAS);
}

async function voces() {
  const lista = await api('GET', '/list-voices');
  const latinas = lista.filter((v) => /mexic|latin|spanish|español/i.test(`${v.accent} ${v.voice_name}`));
  for (const v of latinas.length ? latinas : lista) {
    console.log(`${v.voice_id}\t${v.voice_name}\t${v.gender}\t${v.accent ?? ''}\t${v.provider}`);
  }
}

async function llamar() {
  const numero = args[1];
  const desde = process.env.RETELL_FROM_NUMBER;
  if (!numero || !desde) {
    console.error('Uso: RETELL_FROM_NUMBER=+1... node agente-llamadas/retell.mjs llamar +52XXXXXXXXXX ["Nombre"] ["motivo"]');
    process.exit(1);
  }
  const nombre = args[2] || 'desconocido';
  const motivo = args[3] || `ofrecerle ${cfg.tipo_de_cita}`;
  const agente = await buscar(cfg.nombre_agente);
  if (!agente) throw new Error('Primero crea el agente con el comando "crear".');
  const quien = nombre !== 'desconocido' ? `¿Hablo con ${nombre}? ` : '';
  const r = await api('POST', '/v2/create-phone-call', {
    from_number: desde,
    to_number: numero,
    override_agent_id: agente.agent_id,
    retell_llm_dynamic_variables: {
      nombre_cliente: nombre,
      motivo_llamada: motivo,
      saludo: `Hola, buen día. ${quien}Le habla ${cfg.asistente}, asistente virtual de ${cfg.negocio}. Le llamo para ${motivo}. ¿Tiene un minuto?`,
    },
  });
  console.log(`Llamada iniciada: ${r.call_id}`);
}

// Conecta un número de teléfono (de Telnyx, por SIP) a esta asistente: las llamadas que entran pasan antes por
// /retell/entrante para decidir si contesta ella o las pasa al equipo. Si el número ya está en Retell, lo actualiza.
//   node --env-file=agente-llamadas/.env agente-llamadas/retell.mjs conectar-numero +5255XXXXXXXX --config agente-llamadas/demos/inhousework.json
// .env: TELNYX_SIP_URI (p. ej. sip.telnyx.com), TELNYX_SIP_USUARIO y TELNYX_SIP_CLAVE (credenciales del SIP trunk de Telnyx).
async function conectarNumero() {
  const numero = String(args[1] || '').replace(/[^+\d]/g, '');
  if (!/^\+\d{11,15}$/.test(numero)) throw new Error('Uso: retell.mjs conectar-numero +5255XXXXXXXX [--config demos/x.json] (con lada y +52)');
  const agente = await buscar(cfg.nombre_agente);
  if (!agente) throw new Error(`Primero crea el agente "${cfg.nombre_agente}" con el comando "crear".`);
  const base = String(process.env.PUBLIC_URL || 'https://llamadas.kuper.media').replace(/\/+$/, '');
  const webhook = `${base}/retell/entrante?demo=${encodeURIComponent(demoClave)}&t=${tokenFunciones(KEY)}`;
  const datos = { inbound_agents: [{ agent_id: agente.agent_id, weight: 1 }], nickname: `${cfg.negocio} · ${cfg.asistente}`, inbound_webhook_url: webhook };
  const existentes = await api('GET', '/list-phone-numbers').catch(() => []);
  if ((existentes || []).some((n) => n.phone_number === numero)) {
    await api('PATCH', `/update-phone-number/${encodeURIComponent(numero)}`, datos);
    console.log(`Número ${numero} actualizado: contesta ${cfg.asistente}.`);
  } else {
    const { TELNYX_SIP_URI: uri, TELNYX_SIP_USUARIO: usuario, TELNYX_SIP_CLAVE: clave } = process.env;
    if (!uri || !usuario || !clave) throw new Error('Faltan TELNYX_SIP_URI, TELNYX_SIP_USUARIO y TELNYX_SIP_CLAVE en el .env (credenciales del SIP trunk de Telnyx).');
    await api('POST', '/import-phone-number', { phone_number: numero, termination_uri: uri, sip_trunk_auth_username: usuario, sip_trunk_auth_password: clave, transport: 'TCP', ...datos });
    console.log(`Número ${numero} conectado: contesta ${cfg.asistente}.`);
  }
  console.log(TRANSFERIR ? 'Pasa llamadas al equipo según el panel (pausa y horario de la IA).' : `Ojo: sin número del equipo (${variableTransferencia(demoClave)} en el .env), ${cfg.asistente} contesta todas las llamadas.`);
}

async function verPrompt() {
  console.log(prompt());
}

async function crearTodo() {
  await crear();
  try { await crearVentas(); } catch (e) { console.error(`No pude crear el agente de ventas: ${e.message}`); }
}
const comandos = { crear: crearTodo, voces, llamar, 'conectar-numero': conectarNumero, prompt: verPrompt, 'prompt-ventas': async () => console.log(V ? promptVentas() : 'No hay "ventas" en negocio.json') };
if (!comandos[comando]) {
  console.error('Comandos: prompt | prompt-ventas | voces | crear | llamar <número> [nombre] [motivo] | conectar-numero <número>');
  process.exit(1);
}
comandos[comando]().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
