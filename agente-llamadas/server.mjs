#!/usr/bin/env node
// Página de prueba del agente telefónico: el cliente habla con el agente desde el navegador.
//
//   node --env-file=agente-llamadas/.env agente-llamadas/server.mjs
//
// La clave de Retell se queda en el servidor: el navegador solo recibe un token de un solo uso por llamada.

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as panel from './panel.mjs';
import { configFunciones, crearFunciones } from './funciones.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(resolve(process.env.NEGOCIO_CONFIG || join(aqui, 'negocio.json')), 'utf8'));

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const KEY = process.env.RETELL_API_KEY;
const CLAVE = process.env.DEMO_CLAVE || '';
const POR_IP = Number(process.env.LLAMADAS_POR_IP_DIA || 5);
const POR_DIA = Number(process.env.LLAMADAS_DIA_TOTAL || 60);

const archivos = {
  '/': ['public/index.html', 'text/html; charset=utf-8'],
  '/vendor/retell-sdk.js': ['public/vendor/retell-sdk.js', 'text/javascript; charset=utf-8'],
  '/logo.png': [cfg.logo || '../assets/kuper-logo.png', 'image/png'],
};

let agenteId = process.env.RETELL_AGENT_ID || '';
async function buscarAgente() {
  if (agenteId) return agenteId;
  const r = await fetch('https://api.retellai.com/list-agents', { headers: { Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`list-agents ${r.status}: ${await r.text()}`);
  const a = (await r.json()).find((x) => x.agent_name === cfg.nombre_agente);
  if (!a) throw new Error(`No existe el agente "${cfg.nombre_agente}". Córrelo primero: node agente-llamadas/retell.mjs crear`);
  return (agenteId = a.agent_id);
}

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
  if (CLAVE && url.searchParams.get('c') !== CLAVE) return json(res, 403, { error: 'Este enlace de prueba no es válido.' });
  if (!KEY) return json(res, 500, { error: 'El servidor no tiene configurada la clave de Retell.' });
  const ip = ipDe(req);
  const limite = permitir(ip);
  if (limite) return json(res, 429, { error: limite });
  try {
    const r = await fetch('https://api.retellai.com/v3/create-web-call', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: await buscarAgente(), metadata: { origen: 'demo-web' } }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`create-web-call ${r.status}: ${JSON.stringify(d)}`);
    console.log(`${new Date().toISOString()} llamada ${d.call_id} desde ${ip}`);
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
const funciones = cfgFunciones ? crearFunciones({ ...cfgFunciones, tz: cfg.zona_horaria }) : null;
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
  if (ruta === '/salud') return json(res, 200, { ok: true, servicio: 'agente-llamadas', panel: Boolean(sincro), citas: Boolean(funciones) });
  if (ruta === '/api/config') {
    return json(res, 200, {
      negocio: cfg.negocio,
      asistente: cfg.asistente,
      tipo_de_cita: cfg.tipo_de_cita,
      link_reservas: cfg.link_reservas || '',
      requiere_clave: Boolean(CLAVE),
    });
  }
  if (ruta === '/api/llamada' && req.method === 'POST') return crearLlamada(req, res);
  const fn = /^\/funciones\/([a-z_]+)$/.exec(ruta);
  if (fn && req.method === 'POST') return atenderFuncion(req, res, fn[1]);
  const archivo = archivos[ruta];
  if (archivo && req.method === 'GET') {
    const p = resolve(aqui, archivo[0]);
    if (existsSync(p)) {
      res.writeHead(200, { 'Content-Type': archivo[1], 'Cache-Control': ruta === '/' ? 'no-cache' : 'public, max-age=86400' });
      return res.end(readFileSync(p));
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('No encontrado');
});

// Cada llamada terminada se manda al panel de Kuper como lead (si el .env tiene PANEL_URL, PANEL_SLUG y PANEL_API_KEY).
const sincro = panel.iniciar({ key: KEY, agenteId: buscarAgente, dirDatos: process.env.LLAMADAS_DATOS || join(aqui, 'datos') });

server.listen(PORT, HOST, () => console.log(`Agente de llamadas: http://${HOST}:${PORT}`));
