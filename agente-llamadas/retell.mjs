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

const API = 'https://api.retellai.com';
const aqui = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const comando = args[0];
const iCfg = args.indexOf('--config');
const rutaCfg = iCfg >= 0 ? resolve(args[iCfg + 1]) : resolve(aqui, 'negocio.json');
const cfg = JSON.parse(readFileSync(rutaCfg, 'utf8'));

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

const tz = cfg.zona_horaria;
const saludoEntrante = `Hola, gracias por llamar a ${cfg.negocio}, le atiende ${cfg.asistente}, asistente virtual. ¿En qué le puedo ayudar?`;

function prompt() {
  const lista = (xs) => xs.map((x) => `- ${x}`).join('\n');
  return `## Identidad
Eres ${cfg.asistente}, asistente virtual de ${cfg.negocio}, ${cfg.giro}. Hablas español de México, con un tono cálido, profesional y breve, como una recepcionista amable. Si te preguntan, dices con honestidad que eres un asistente de inteligencia artificial.

## Contexto
- Fecha y hora actual: {{current_time_${tz}}}
- Calendario de los próximos días: {{current_calendar_${tz}}}
- Tipo de llamada: {{direction}} (inbound = el cliente nos llamó, outbound = nosotros llamamos).
- Nombre del cliente si lo conocemos: {{nombre_cliente}}
- Motivo de la llamada saliente, si aplica: {{motivo_llamada}}

## Servicios
${lista(cfg.servicios)}

Horario de citas: ${cfg.horario} (hora del centro de México).

## Preguntas frecuentes
${lista(cfg.preguntas_frecuentes)}

## Objetivo
Tu meta principal es agendar ${cfg.tipo_de_cita}.

## Cómo agendar
1. Entiende qué necesita la persona en una o dos preguntas.
2. Pregunta qué día y en qué horario le acomoda.
3. Usa la función de consultar disponibilidad del calendario y ofrece como máximo dos o tres horarios libres.
4. Cuando elija uno, pide su nombre completo y su correo electrónico. Repite el correo letra por letra para confirmarlo.
5. Usa la función de agendar cita con esos datos.
6. Confirma en voz alta el día, la hora y que le llegará la confirmación por correo.
7. Pregunta si necesita algo más y despídete amablemente; luego termina la llamada.

## Reglas
- Respuestas cortas: una o dos frases por turno. Es una llamada telefónica, no un correo.
- Nunca inventes horarios: solo ofrece los que devuelve la función de disponibilidad.
- Di fechas y horas de forma natural ("el martes 4 a las 10 de la mañana"), nunca en formato técnico.
- Si no sabes algo, dilo y ofrece que un asesor le contacte en la cita.
- Si es una llamada saliente, presenta el motivo en la primera frase y pregunta si es buen momento para hablar. Si la persona no quiere, agradece y termina la llamada sin insistir.
- Si la persona pide hablar con un humano${cfg.numero_transferencia ? ', transfiere la llamada' : ', toma su nombre y dile que un asesor le devolverá la llamada'}.`;
}

function herramientas() {
  const tools = [
    { type: 'end_call', name: 'terminar_llamada', description: 'Termina la llamada cuando la conversación concluyó y ya te despediste.' },
  ];
  if (cfg.numero_transferencia) {
    tools.push({
      type: 'transfer_call',
      name: 'transferir_a_humano',
      description: 'Transfiere la llamada a una persona del equipo cuando el cliente lo pida.',
      transfer_destination: { type: 'predefined', number: cfg.numero_transferencia },
      transfer_option: { type: 'cold_transfer' },
    });
  }
  return tools;
}

async function elegirVoz() {
  if (cfg.voz_id) return cfg.voz_id;
  const voces = await api('GET', '/list-voices');
  const latinas = voces.filter((v) => /mexic|latin|spanish|español/i.test(`${v.accent} ${v.voice_name}`));
  const voz = latinas.find((v) => v.gender === 'female') || latinas[0];
  if (!voz) throw new Error('No encontré una voz en español. Corre el comando "voces" y pon una en "voz_id" de negocio.json.');
  console.log(`Voz elegida: ${voz.voice_name} (${voz.accent}, ${voz.provider}) -> ${voz.voice_id}`);
  return voz.voice_id;
}

async function crear() {
  const llm = {
    general_prompt: prompt(),
    begin_message: '{{saludo}}',
    start_speaker: 'agent',
    model_config: { type: 'cascading', primary: { model: cfg.modelo }, temperature: 0.2 },
    default_dynamic_variables: { saludo: saludoEntrante, nombre_cliente: 'desconocido', motivo_llamada: 'ninguno' },
  };
  const agente = {
    agent_name: cfg.nombre_agente,
    language: 'es-419',
    voice_id: await elegirVoz(),
    // Topes para no gastar créditos si alguien deja la llamada abierta.
    max_call_duration_ms: 10 * 60 * 1000,
    end_call_after_silence_ms: 30 * 1000,
    post_call_analysis_data: [
      { type: 'system-presets', name: 'call_summary' },
      { type: 'boolean', name: 'cita_agendada', description: '¿Se agendó una cita durante la llamada?' },
      { type: 'string', name: 'nombre_cliente', description: 'Nombre completo del cliente, si lo dio.' },
      { type: 'string', name: 'correo_cliente', description: 'Correo del cliente, si lo dio.' },
    ],
  };

  const existentes = await api('GET', '/list-agents');
  const previo = existentes.find((a) => a.agent_name === cfg.nombre_agente);

  if (previo) {
    // No mandamos general_tools: así no se borran las funciones de Cal.com agregadas en el panel.
    const llmId = previo.response_engine?.llm_id;
    await api('PATCH', `/update-retell-llm/${llmId}`, llm);
    await api('PATCH', `/update-agent/${previo.agent_id}`, agente);
    console.log(`Agente actualizado: ${previo.agent_id} (LLM ${llmId})`);
    return;
  }

  const nuevoLlm = await api('POST', '/create-retell-llm', { ...llm, general_tools: herramientas() });
  const nuevo = await api('POST', '/create-agent', {
    ...agente,
    response_engine: { type: 'retell-llm', llm_id: nuevoLlm.llm_id },
  });
  console.log(`Agente creado: ${nuevo.agent_id} (LLM ${nuevoLlm.llm_id})`);
  console.log('Siguiente paso: en el panel de Retell agrega las funciones de Cal.com (ver LEEME.md).');
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
  const agentes = await api('GET', '/list-agents');
  const agente = agentes.find((a) => a.agent_name === cfg.nombre_agente);
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

async function verPrompt() {
  console.log(prompt());
}

const comandos = { crear, voces, llamar, prompt: verPrompt };
if (!comandos[comando]) {
  console.error('Comandos: prompt | voces | crear | llamar <número> [nombre] [motivo]');
  process.exit(1);
}
comandos[comando]().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
