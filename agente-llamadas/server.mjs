#!/usr/bin/env node
// Página de prueba del agente telefónico: el cliente habla con el agente desde el navegador.
//
//   node --env-file=agente-llamadas/.env agente-llamadas/server.mjs
//
// La clave de Retell se queda en el servidor: el navegador solo recibe un token de un solo uso por llamada.

import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as panel from './panel.mjs';
import { configFunciones, crearFunciones, eventoDeLink, tokenFunciones } from './funciones.mjs';
import * as marcador from './marcador.mjs';
import { agentePorNombre as buscarEnRetell } from './agentes.mjs';
import { numeroTransferencia, respuestaEntrante } from './entrante.mjs';
import * as chat from './chat.mjs';
import * as envios from './envios.mjs';
import * as inst from './instantanea.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(resolve(process.env.NEGOCIO_CONFIG || join(aqui, 'negocio.json')), 'utf8'));

// Demos para prospectos: cada archivo demos/<nombre>.json es otra asistente (llamadas.kuper.media/<nombre>).
const demos = new Map();
let instCfg = null; // demos/instantanea.json: agente genérico de "Haz tu demo gratis"
const dirDemos = join(aqui, 'demos');
if (existsSync(dirDemos)) for (const f of readdirSync(dirDemos).filter((x) => /^[a-z0-9-]+\.json$/.test(x))) {
  try {
    const d = JSON.parse(readFileSync(join(dirDemos, f), 'utf8'));
    if (d.instantanea) instCfg = d; else demos.set(f.slice(0, -5), d); // la demo instantánea no tiene página propia
  } catch (e) { console.error(`demos/${f}: ${e.message}`); }
}
const demoDe = (url) => demos.get(String(url.searchParams.get('demo') || '')) || null;
// "Haz tu demo gratis" (kuper.media/demo): cada demo vive 7 días en datos/instantaneas.
const instantaneas = inst.almacen(join(process.env.LLAMADAS_DATOS || join(aqui, 'datos'), 'instantaneas'));
const instDe = (url) => (instCfg && url.searchParams.get('instantanea') ? instantaneas.leer(url.searchParams.get('instantanea')) : null);
// La página vive en kuper.media/demo y le habla a este servidor: solo esos orígenes pueden.
const ORIGENES = String(process.env.DEMO_ORIGENES || 'https://kuper.media,https://www.kuper.media').split(',').map((x) => x.trim()).filter(Boolean);
function cors(req, res) {
  const o = req.headers.origin;
  if (o && ORIGENES.includes(o)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); }
}
const INST_POR_IP = Number(process.env.DEMO_GRATIS_POR_IP || 3), INST_POR_DIA = Number(process.env.DEMO_GRATIS_DIA || 60);
let instDia = '', instTotal = 0; const instPorIp = new Map();
function permitirInst(ip) {
  const hoy = new Date().toISOString().slice(0, 10);
  if (hoy !== instDia) { instDia = hoy; instTotal = 0; instPorIp.clear(); }
  if (instTotal >= INST_POR_DIA) return 'Hoy ya se hicieron muchas demos. Escríbenos por WhatsApp y te la armamos.';
  if ((instPorIp.get(ip) || 0) >= INST_POR_IP) return 'Ya hiciste varias demos hoy. Escríbenos por WhatsApp y te ayudamos.';
  instTotal += 1; instPorIp.set(ip, (instPorIp.get(ip) || 0) + 1);
  return null;
}
const ERRORES_INST = { direccion_no_permitida: 'Ese link no se puede abrir. Revisa que sea la página pública de tu negocio.', no_es_negocio: 'No encontramos información de un negocio en esa página. Cuéntanos en dos líneas qué hace tu negocio.',
  no_es_pagina: 'Ese link no es una página web. Prueba con la página principal de tu negocio.', sin_ia: 'La demo no está disponible en este momento.' };
async function crearInstantanea(req, res) {
  let b;
  try { b = JSON.parse(await leerCuerpo(req, 20_000) || '{}'); } catch { return json(res, 400, { error: 'Datos no válidos.' }); }
  if (b.sitio_web_2) return json(res, 400, { error: 'Datos no válidos.' }); // campo trampa para bots
  const nombre = String(b.nombre || '').trim().slice(0, 80), tel = String(b.whatsapp || '').replace(/\D/g, ''), correo = String(b.correo || '').trim().slice(0, 120);
  const descripcion = String(b.descripcion || '').trim().slice(0, 2000);
  if (!nombre || tel.length < 10) return json(res, 400, { error: 'Pon tu nombre y tu WhatsApp (10 dígitos) para mandarte tu demo.' });
  const url = b.url ? inst.normalizarUrl(b.url) : null;
  if (b.url && !url) return json(res, 400, { error: 'Ese link no parece válido. Ejemplo: minegocio.com' });
  if (!url && descripcion.length < 30) return json(res, 400, { error: 'Pega el link de tu negocio o cuéntanos qué hace (mínimo dos líneas).' });
  const limite = permitirInst(ipDe(req));
  if (limite) return json(res, 429, { error: limite });
  try {
    let sitio = null;
    if (url) {
      try { sitio = await inst.leerSitio(url); }
      catch (e) { if (!descripcion) return json(res, 422, { error: /instagram|facebook|tiktok/i.test(url.hostname) ? 'Las redes sociales no dejan leer su contenido. Cuéntanos en dos líneas qué hace tu negocio.' : ERRORES_INST[e.message] || 'No pudimos abrir esa página. Cuéntanos en dos líneas qué hace tu negocio.', pedir_descripcion: true }); }
      if (sitio && sitio.texto.length < 200 && !descripcion) return json(res, 422, { error: 'Tu página casi no tiene texto que podamos leer. Cuéntanos en dos líneas qué hace tu negocio.', pedir_descripcion: true });
    }
    const negocio = await inst.armarNegocio({ sitio, descripcion });
    const d = instantaneas.crear({ negocio, logo: sitio?.logo || '', url: sitio?.url || '', contacto: { nombre, whatsapp: tel, correo } });
    console.log(`${new Date().toISOString()} demo gratis ${d.id}: ${negocio.negocio} (${sitio?.url || 'descripción'})`);
    avisarLead(d).catch((e) => console.error('[demo gratis lead]', e.message));
    json(res, 200, { id: d.id, negocio: negocio.negocio, giro: negocio.giro, servicios: negocio.servicios.slice(0, 4), logo: d.logo, asistente: 'Sofía', chat: chat.chatConfigurado(), limites: inst.LIMITES });
  } catch (e) {
    console.error('[demo gratis]', e.message);
    json(res, e.message === 'no_es_negocio' ? 422 : 502, { error: ERRORES_INST[e.message] || 'No pudimos armar tu demo en este momento. Intenta de nuevo.', pedir_descripcion: e.message === 'no_es_negocio' });
  }
}
// Cada demo gratis llega como lead al panel de Kuper (PANEL_URL + PANEL_SLUG + PANEL_API_KEY del .env).
async function avisarLead(d) {
  const url = String(process.env.PANEL_URL || '').replace(/\/+$/, ''), slug = process.env.PANEL_SLUG, key = process.env.PANEL_API_KEY;
  if (!url || !slug || !key) return;
  await fetch(`${url}/api/${encodeURIComponent(slug)}/leads`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ nombre: d.contacto.nombre, telefono: d.contacto.whatsapp, email: d.contacto.correo || undefined, origen: 'web', empresa: d.negocio.negocio, tags: ['demo gratis'],
      resumen: `Hizo su demo gratis: ${d.negocio.negocio} (${d.negocio.giro}). ${d.url || 'Sin página web'}.`, nota: `Demo gratis ${d.url || ''}` }) });
  // Y un correo al aviso de Kuper (Configuración → Notificaciones del panel), con botón para escribirle por WhatsApp.
  await fetch(`${url}/api/${encodeURIComponent(slug)}/avisos`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ correo: true, nombre: d.contacto.nombre, telefono: d.contacto.whatsapp, origen: 'web', titulo: `Nueva demo gratis: ${d.negocio.negocio}`.slice(0, 160),
      texto: [`Negocio: ${d.negocio.negocio} (${d.negocio.giro})`, d.url ? `Página: ${d.url}` : 'Sin página web (lo describió)', d.contacto.correo ? `Correo: ${d.contacto.correo}` : '',
        `Su demo: https://kuper.media/demo/?d=${d.id}`].filter(Boolean).join('\n') }) });
}
// ?aplicante=<id>: probar la demo "como" un aplicante de la lista (envío de pendientes).
const aplicanteDe = (demo, url) => (demo ? envios.aplicanteDe(demo, String(url.searchParams.get('aplicante') || '')) : null);

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const KEY = process.env.RETELL_API_KEY;
const CLAVE = process.env.DEMO_CLAVE || '';
const POR_IP = Number(process.env.LLAMADAS_POR_IP_DIA || 5);
const POR_DIA = Number(process.env.LLAMADAS_DIA_TOTAL || 60);
// Con ?ventas=CLAVE la página prueba al agente de ventas (como si llamara a una empresa). Sin VENTAS_CLAVE no se puede.
const VENTAS_CLAVE = process.env.VENTAS_CLAVE || '';

const archivos = {
  '/': ['public/index.html', 'text/html; charset=utf-8'],
  '/vendor/retell-sdk.js': ['public/vendor/retell-sdk.js', 'text/javascript; charset=utf-8'],
  '/gratis': ['public/gratis.html', 'text/html; charset=utf-8'],
  '/kuper-blanco.png': ['public/kuper-blanco.png', 'image/png'],
  '/logo.png': [cfg.logo || '../assets/kuper-logo.png', 'image/png'],
};

const idsAgentes = new Map(process.env.RETELL_AGENT_ID ? [[cfg.nombre_agente, process.env.RETELL_AGENT_ID]] : []);
async function agentePorNombre(nombre) {
  if (idsAgentes.has(nombre)) return idsAgentes.get(nombre);
  const a = await buscarEnRetell(KEY, nombre);
  if (!a) throw new Error(`No existe el agente "${nombre}". Córrelo primero: node agente-llamadas/retell.mjs crear`);
  idsAgentes.set(nombre, a.agent_id);
  return a.agent_id;
}
const buscarAgente = () => agentePorNombre(cfg.nombre_agente);
const buscarVentas = cfg.ventas ? () => agentePorNombre(cfg.ventas.nombre_agente) : null;
const esPruebaVentas = (url) => Boolean(buscarVentas && VENTAS_CLAVE && url.searchParams.get('ventas') === VENTAS_CLAVE);

// Límite de llamadas para que nadie gaste los créditos: por IP y total, se reinicia cada día.
let dia = '';
let total = 0;
const porIp = new Map();
function permitir(ip) {
  const hoy = new Date().toISOString().slice(0, 10);
  if (hoy !== dia) { dia = hoy; total = 0; porIp.clear(); }
  if (total >= POR_DIA) return 'Ya se usaron todas las pruebas de hoy. Intenta mañana.';
  if ((porIp.get(ip) || 0) >= POR_IP) return 'Ya hiciste varias pruebas hoy. Intenta mañana.';
  total += 1;
  porIp.set(ip, (porIp.get(ip) || 0) + 1);
  return null;
}

function ipDe(req) {
  const directa = req.socket.remoteAddress || '';
  const reenviada = req.headers['x-forwarded-for'];
  // Detrás de nginx/Caddy la IP real llega en X-Forwarded-For; solo se confía en ella si viene del propio servidor.
  if (reenviada && /^(::1|127\.|::ffff:127\.)/.test(directa)) return String(reenviada).split(',').pop().trim();
  return directa;
}

function json(res, codigo, datos) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(datos));
}

async function crearLlamada(req, res) {
  const url = new URL(req.url, 'http://x');
  const demo = demoDe(url);
  const ins = instDe(url);
  if (url.searchParams.get('instantanea')) {
    if (!ins) return json(res, 404, { error: 'Tu demo ya no está disponible. Haz una nueva.' });
    if (ins.llamadas >= inst.LIMITES.llamadas) return json(res, 429, { error: 'Ya usaste las llamadas de tu demo. Escríbenos por WhatsApp para tenerlo en tu negocio.' });
  }
  const ventas = !demo && !ins && esPruebaVentas(url);
  if (url.searchParams.has('ventas') && !ventas) return json(res, 403, { error: 'Este enlace de prueba no es válido.' });
  if (!ventas && !demo && !ins && CLAVE && url.searchParams.get('c') !== CLAVE) return json(res, 403, { error: 'Este enlace de prueba no es válido.' });
  if (!KEY) return json(res, 500, { error: 'El servidor no tiene configurada la clave de Retell.' });
  const ip = ipDe(req);
  const limite = permitir(ip);
  if (limite) return json(res, 429, { error: limite });
  try {
    const r = await fetch('https://api.retellai.com/v3/create-web-call', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(ventas ? {
        agent_id: await buscarVentas(), metadata: { origen: 'prueba-ventas' },
        // Empresa de mentira para probar: ?ventas=CLAVE&empresa=Clínica Sonrisa&giro=dentista&ciudad=Puebla
        retell_llm_dynamic_variables: Object.fromEntries(['empresa', 'giro', 'ciudad'].map((k) => [k, String(url.searchParams.get(k) || { empresa: 'Clínica Dental Sonrisa', giro: 'dentista', ciudad: 'Ciudad de México' }[k]).slice(0, 80)])),
      } : ins ? { agent_id: await agentePorNombre(instCfg.nombre_agente), metadata: { origen: 'demo-gratis', demo_gratis: ins.id }, retell_llm_dynamic_variables: inst.variables(ins) }
      : demo ? { agent_id: await agentePorNombre(demo.nombre_agente), metadata: { origen: `demo-${url.searchParams.get('demo')}` },
        ...(await infoDelPanel(demo).then((t) => {
          const a = aplicanteDe(demo, url);
          const v = { ...(t ? { info_panel: t } : {}), ...(a ? envios.variables(demo, a) : {}) };
          return Object.keys(v).length ? { retell_llm_dynamic_variables: v } : {};
        })) }
        : { agent_id: await buscarAgente(), metadata: { origen: 'demo-web' } }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`create-web-call ${r.status}: ${JSON.stringify(d)}`);
    console.log(`${new Date().toISOString()} llamada ${d.call_id} desde ${ip}`);
    if (ins) { ins.llamadas += 1; instantaneas.guardar(ins); }
    json(res, 200, {
      accessToken: d.access_token,
      callId: d.call_id,
      transport: d.transport,
      url: d.url,
      iceServers: d.ice_servers,
    });
  } catch (e) {
    console.error(e.message);
    // Un intento fallido no cuenta para el tope del día.
    total -= 1;
    porIp.set(ip, porIp.get(ip) - 1);
    json(res, 502, { error: 'No se pudo iniciar la llamada. Intenta de nuevo en un momento.' });
  }
}

// Funciones que Sofía usa en la llamada para buscar, cambiar o cancelar citas (CAL_API_KEY + PUBLIC_URL en el .env).
const cfgFunciones = configFunciones();
const funciones = cfgFunciones ? crearFunciones({ ...cfgFunciones, tz: cfg.zona_horaria, evento: eventoDeLink(cfg.link_reservas) }) : null;
function leerCuerpo(req, max = 1_000_000) {
  return new Promise((ok, mal) => {
    let n = 0; const partes = [];
    req.on('data', (c) => { n += c.length; if (n > max) { mal(new Error('cuerpo muy grande')); req.destroy(); } else partes.push(c); });
    req.on('end', () => ok(Buffer.concat(partes).toString('utf8')));
    req.on('error', mal);
  });
}
async function atenderFuncion(req, res, nombre) {
  if (!funciones) return json(res, 404, { error: 'Funciones de citas no configuradas' });
  let cuerpo;
  try { cuerpo = JSON.parse(await leerCuerpo(req) || '{}'); } catch { return json(res, 400, { error: 'JSON no válido' }); }
  const [codigo, datos] = await funciones.atender(nombre, req.headers.authorization, cuerpo);
  if (codigo === 200) console.log(`${new Date().toISOString()} función ${nombre}: ${String(datos.resultado || '').slice(0, 120)}`);
  json(res, codigo, datos);
}

const server = createServer(async (req, res) => {
  const ruta = new URL(req.url, 'http://x').pathname;
  if (ruta.startsWith('/api/') || ruta === '/vendor/retell-sdk.js' || ruta === '/kuper-blanco.png') cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (ruta === '/api/instantanea' && req.method === 'POST') return crearInstantanea(req, res);
  if (ruta === '/api/instantanea' && req.method === 'GET') {
    const d = instDe(new URL(req.url, 'http://x'));
    if (!d) return json(res, 404, { error: 'Tu demo ya no está disponible. Haz una nueva.' });
    return json(res, 200, { id: d.id, negocio: d.negocio.negocio, giro: d.negocio.giro, servicios: d.negocio.servicios.slice(0, 4), logo: d.logo, asistente: 'Sofía', chat: chat.chatConfigurado(),
      limites: inst.LIMITES, usadas: { llamadas: d.llamadas, mensajes: d.mensajes } });
  }
  if (ruta === '/salud') return json(res, 200, { ok: true, servicio: 'agente-llamadas', panel: Boolean(sincro), citas: Boolean(funciones), ventas: marcando ? 'marcando' : buscarVentas ? 'solo_pruebas' : false });
  if (ruta === '/api/config') {
    const demo = demoDe(new URL(req.url, 'http://x'));
    if (demo) {
      return json(res, 200, { negocio: demo.negocio, asistente: demo.asistente, tipo_de_cita: demo.tipo_de_cita, link_reservas: demo.link_reservas || '',
        sub: demo.pagina?.sub || '', datos: demo.pagina?.datos || null, pasos: demo.pagina?.pasos || null, logo: demo.pagina?.logo || '', logo_alto: Number(demo.pagina?.logo_alto) || 0, logo_oscuro: demo.pagina?.logo_oscuro === true, chat: chat.chatConfigurado(), etiqueta: demo.pagina?.etiqueta || '',
        link_extra: demo.pagina?.link_extra || null,
        aplicante: (() => { const a = aplicanteDe(demo, new URL(req.url, 'http://x')); return a ? { nombre: a.nombre, negocio: a.negocio, pais: envios.paisDe(a.pais), mensaje: envios.mensaje(demo, a) } : null; })() });
    }
    if (esPruebaVentas(new URL(req.url, 'http://x'))) {
      return json(res, 200, { negocio: cfg.negocio, asistente: cfg.ventas.asistente, tipo_de_cita: cfg.tipo_de_cita, link_reservas: cfg.link_reservas || '', ventas: true,
        sub: `Prueba del agente de ventas: ${cfg.ventas.asistente} te llama como si fueras la empresa. Contesta como lo haría el negocio.` });
    }
    return json(res, 200, {
      negocio: cfg.negocio,
      asistente: cfg.asistente,
      tipo_de_cita: cfg.tipo_de_cita,
      link_reservas: cfg.link_reservas || '',
      requiere_clave: Boolean(CLAVE),
      chat: chat.chatConfigurado(),
    });
  }
  if (ruta === '/api/llamada' && req.method === 'POST') return crearLlamada(req, res);
  if (ruta === '/funciones/disponibilidad' && req.method === 'POST') return consultarDisponibilidad(req, res);
  if (ruta === '/retell/entrante' && req.method === 'POST') return llamadaEntrante(req, res);
  if (ruta === '/api/chat' && req.method === 'POST') return mensajeChat(req, res);
  if (ruta === '/api/envios') return apiEnvios(req, res);
  const fn = /^\/funciones\/([a-z_]+)$/.exec(ruta);
  if (fn && req.method === 'POST') return atenderFuncion(req, res, fn[1]);
  const conEnvios = /^\/([a-z0-9-]+)\/envios\/?$/.exec(ruta);
  const archivo = archivos[ruta] || (demos.has(ruta.slice(1)) ? archivos['/'] : null)
    || (conEnvios && demos.get(conEnvios[1])?.aplicantes ? ['public/envios.html', 'text/html; charset=utf-8'] : null);
  if (archivo && req.method === 'GET') {
    const p = resolve(aqui, archivo[0]);
    if (existsSync(p)) {
      res.writeHead(200, { 'Content-Type': archivo[1], 'Cache-Control': /html/.test(archivo[1]) ? 'no-cache' : 'public, max-age=86400' });
      return res.end(readFileSync(p));
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('No encontrado');
});

// Cada llamada terminada se manda al panel de Kuper como lead (si el .env tiene PANEL_URL, PANEL_SLUG y PANEL_API_KEY).
// "panel_slug" en la demo + PANEL_KEY_<SLUG> en el .env: sus llamadas van al panel de ese cliente.
const llaveDe = (slug) => process.env[`PANEL_KEY_${String(slug).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`] || '';
// Lo que el cliente escribió en su panel ("Lo que sabe tu agente"), para la llamada (se guarda 5 min).
const infoCache = new Map();
async function infoDelPanel(demo) {
  const key = llaveDe(demo.panel_slug), base = String(process.env.PANEL_URL || '').replace(/\/+$/, '');
  if (!demo.panel_slug || !key || !base) return null;
  const c = infoCache.get(demo.panel_slug);
  if (c && Date.now() - c.t < 5 * 60000) return c.texto;
  try {
    const r = await fetch(`${base}/api/${encodeURIComponent(demo.panel_slug)}/conocimiento`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(3000) });
    const j = r.ok ? await r.json() : null;
    const texto = j && typeof j.texto === 'string' && j.texto.trim() ? j.texto.trim().slice(0, 14000) : null;
    infoCache.set(demo.panel_slug, { t: Date.now(), texto });
    return texto;
  } catch { return c?.texto || null; }
}
// consultar_disponibilidad: pregunta al panel del cliente qué hay libre en este momento (la usan la voz y el chat).
async function disponibilidadDe(demo, args = {}) {
  const key = demo && llaveDe(demo.panel_slug), base = String(process.env.PANEL_URL || '').replace(/\/+$/, '');
  if (!demo || !key || !base) return 'No pude revisar el sistema de disponibilidad. No digas que hay o que no hay lugar: ofrece que un asesor lo confirme y toma sus datos.';
  const qs = new URLSearchParams(Object.entries({ sede: args.sede, personas: args.personas, tipo: args.tipo }).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)]));
  try {
    const r = await fetch(`${base}/api/${encodeURIComponent(demo.panel_slug)}/disponibilidad?${qs}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    console.log(`${new Date().toISOString()} disponibilidad ${demo.panel_slug} ${qs}: ${String(j.resultado || '').slice(0, 80)}`);
    return j.resultado || 'Sin datos de disponibilidad: ofrece que un asesor lo confirme.';
  } catch (e) {
    console.error('[disponibilidad]', e.message);
    return 'El sistema de disponibilidad no respondió. No digas que hay o que no hay lugar: ofrece que un asesor lo confirme y toma sus datos.';
  }
}
async function consultarDisponibilidad(req, res) {
  const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!KEY || tok !== tokenFunciones(KEY)) return json(res, 401, { error: 'no autorizado' });
  const demo = demos.get(String(new URL(req.url, 'http://x').searchParams.get('demo') || ''));
  let args = {};
  try { const b = JSON.parse(await leerCuerpo(req) || '{}'); args = b.args || b; } catch { /* sin argumentos */ }
  return json(res, 200, { resultado: await disponibilidadDe(demo, args) });
}

// Chat de la página: la misma asistente escribiendo. Límite propio por IP y por día.
const CHAT_POR_IP = Number(process.env.CHAT_POR_IP_DIA || 40), CHAT_POR_DIA = Number(process.env.CHAT_DIA_TOTAL || 1500);
let chatDia = '', chatTotal = 0; const chatPorIp = new Map();
function permitirChat(ip) {
  const hoy = new Date().toISOString().slice(0, 10);
  if (hoy !== chatDia) { chatDia = hoy; chatTotal = 0; chatPorIp.clear(); }
  if (chatTotal >= CHAT_POR_DIA || (chatPorIp.get(ip) || 0) >= CHAT_POR_IP) return false;
  chatTotal += 1; chatPorIp.set(ip, (chatPorIp.get(ip) || 0) + 1);
  return true;
}
async function mensajeChat(req, res) {
  const url = new URL(req.url, 'http://x');
  const demo = demoDe(url);
  const ins = instDe(url);
  if (!chat.chatConfigurado()) return json(res, 503, { error: 'El chat no está disponible en este momento.' });
  if (url.searchParams.get('instantanea')) {
    if (!ins) return json(res, 404, { error: 'Tu demo ya no está disponible. Haz una nueva.' });
    if (ins.mensajes >= inst.LIMITES.mensajes) return json(res, 429, { error: 'Llegaste al límite de mensajes de tu demo. ¿Lo quieres en tu WhatsApp de verdad? Escríbenos.' });
  }
  if (!demo && !ins && CLAVE && url.searchParams.get('c') !== CLAVE) return json(res, 403, { error: 'Este enlace de prueba no es válido.' });
  let cuerpo;
  try { cuerpo = JSON.parse(await leerCuerpo(req, 100_000) || '{}'); } catch { return json(res, 400, { error: 'Mensaje no válido.' }); }
  if (!permitirChat(ipDe(req))) return json(res, 429, { error: 'Ya se usaron los mensajes de prueba de hoy. Intenta mañana.' });
  const cfgChat = ins ? inst.cfgChat(ins, instCfg) : demo || cfg;
  if (ins) { ins.mensajes += 1; instantaneas.guardar(ins); }
  try {
    const a = aplicanteDe(demo, url);
    const texto = await chat.responder({ cfg: cfgChat, mensajes: cuerpo.mensajes, variables: a ? envios.variables(demo, a) : {},
      infoPanel: demo ? await infoDelPanel(demo) : '',
      disponibilidad: demo?.panel_slug && llaveDe(demo.panel_slug) ? (args) => disponibilidadDe(demo, args) : null });
    json(res, 200, { texto });
  } catch (e) {
    if (e.message === 'sin_mensaje') return json(res, 400, { error: 'Escribe un mensaje.' });
    console.error('[chat]', e.message);
    json(res, 502, { error: 'No pude contestar en este momento. Intenta de nuevo.' });
  }
}
// Envío de pendientes (demo): GET da la lista de ejemplo con sus mensajes; POST arma los mensajes de una lista propia (CSV).
async function apiEnvios(req, res) {
  const url = new URL(req.url, 'http://x');
  const demo = demoDe(url);
  if (!demo?.aplicantes) return json(res, 404, { error: 'Esta demo no tiene envío de pendientes.' });
  let filas = demo.aplicantes;
  if (req.method === 'POST') {
    try { filas = JSON.parse(await leerCuerpo(req, 200_000) || '{}').filas; } catch { return json(res, 400, { error: 'Lista no válida.' }); }
  }
  json(res, 200, { asistente: demo.asistente, negocio: demo.negocio, logo: demo.pagina?.logo || '', limite_diario: Number(demo.envios?.limite_diario) || 250,
    fecha_limite: demo.envios?.fecha_limite || '', aplicantes: envios.preparar(demo, filas), ejemplo: req.method !== 'POST' });
}

const demosIds = async () => (await Promise.all([...demos.values()].map(async (d) => ({ id: await agentePorNombre(d.nombre_agente).catch(() => null), etiqueta: d.negocio,
  panel: d.panel_slug && llaveDe(d.panel_slug) ? { slug: d.panel_slug, key: llaveDe(d.panel_slug) } : null })))).filter((d) => d.id);
const sincro = panel.iniciar({ key: KEY, agenteId: buscarAgente, ventasId: buscarVentas, demosIds, dirDatos: process.env.LLAMADAS_DATOS || join(aqui, 'datos') });
// Agente de ventas: marca a la siguiente empresa de la lista del panel (necesita RETELL_FROM_NUMBER).
const marcando = sincro && buscarVentas ? marcador.iniciar({ key: KEY, ventasId: buscarVentas }) : null;

server.listen(PORT, HOST, () => console.log(`Agente de llamadas: http://${HOST}:${PORT}`));
