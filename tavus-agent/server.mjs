// Agente de videollamada con Tavus. Sin dependencias: Node 18+.
// La clave de Tavus vive solo en el servidor; el navegador nunca la ve.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createLeads } from './leads.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const API = 'https://tavusapi.com/v2';
const STATE_FILE = path.join(DIR, '.tavus-state.json');

loadDotEnv(path.join(DIR, '.env'));
const KEY = process.env.TAVUS_API_KEY;
const PORT = Number(process.env.PORT || 3000);

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  // Tolera BOM, saltos de línea de Windows y comillas tipográficas de TextEdit.
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  for (const line of text.split(/\r?\n|\r/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["'“”‘’]+|["'“”‘’]+$/g, '');
  }
}

const readConfig = () => JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8'));
const readState = () => (fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {});
const writeState = (s) => fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));

async function tavus(method, route, body) {
  const res = await fetch(API + route, {
    method,
    headers: { 'x-api-key': KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data.message || data.error || text || res.statusText;
    throw Object.assign(new Error(`Tavus ${res.status}: ${msg}`), { status: res.status });
  }
  return data;
}

// Tavus solo acepta letras/números sin acentos y . _ - en medio ("Sofía López" -> "Sofia-Lopez").
function toUsername(name) {
  const clean = String(name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
  return clean.length >= 2 ? clean : 'Agente';
}

// Personalidad + lo que sabe de Kuper (conocimiento.md) + cómo capturar al cliente.
function fullPrompt(cfg) {
  const kbFile = path.join(DIR, cfg.knowledgeFile || 'conocimiento.md');
  const kb = fs.existsSync(kbFile) ? fs.readFileSync(kbFile, 'utf8').replace(/^>.*$/gm, '').trim() : '';
  return [
    cfg.systemPrompt,
    kb && `INFORMACIÓN DE LA EMPRESA (úsala para responder; no inventes nada fuera de esto):\n${kb}`,
    cfg.leadInstructions,
  ].filter(Boolean).join('\n\n');
}

function palBody(cfg) {
  const tts = { tts_engine: cfg.voice?.engine || 'tavus-auto' };
  if (cfg.voice?.externalVoiceId) tts.external_voice_id = cfg.voice.externalVoiceId;
  if (cfg.voice?.modelName) tts.tts_model_name = cfg.voice.modelName;
  // Solo hace falta para voces privadas/clonadas; las voces públicas funcionan sin clave.
  const providerKey = { elevenlabs: process.env.ELEVENLABS_API_KEY, cartesia: process.env.CARTESIA_API_KEY }[tts.tts_engine];
  if (providerKey) tts.api_key = providerKey;
  return {
    pal_name: cfg.agentName,
    pipeline_mode: 'full',
    system_prompt: fullPrompt(cfg),
    default_face_id: cfg.faceId,
    layers: {
      llm: { model: cfg.llmModel || 'tavus-gemma-4' },
      tts,
    },
  };
}

// El nombre para Zoom / Meet / Teams es único en todo Tavus, así que le añadimos un sufijo
// aleatorio ("Sofia-Kuper-3f9a") y lo guardamos para reutilizarlo.
const randomUsername = (cfg) =>
  `${toUsername(cfg.meetingUsername || cfg.agentName)}-${crypto.randomBytes(3).toString('hex')}`;

// Crea el PAL (personalidad) la primera vez y lo vuelve a crear si cambias config.json.
async function ensurePal(cfg) {
  const body = palBody(cfg);
  const hash = crypto.createHash('sha256').update(JSON.stringify([body, Boolean(cfg.enableMeetings)])).digest('hex');
  const state = readState();
  if (state.palId && state.hash === hash) return state.palId;

  let username = state.username || randomUsername(cfg);
  for (let attempt = 1; ; attempt++) {
    try {
      // Las reuniones (Zoom/Meet/Teams) no están en el plan gratis: solo se activan con enableMeetings.
      const pal = await tavus('POST', '/pals', cfg.enableMeetings
        ? { ...body, layers: { ...body.layers, conferencing: { username } } }
        : body);
      const palId = pal.pal_id || pal.persona_id;
      if (!palId) throw new Error('Tavus no devolvió pal_id: ' + JSON.stringify(pal));
      writeState({ palId, hash, username, createdAt: new Date().toISOString() });
      console.log(`PAL creado: ${palId} (usuario para reuniones: ${username})`);
      return palId;
    } catch (err) {
      if (attempt >= 5 || !/username/i.test(err.message)) throw err;
      username = randomUsername(cfg);
    }
  }
}

async function startConversation({ meetingUrl } = {}) {
  const cfg = readConfig();
  const palId = await ensurePal(cfg);
  const body = {
    pal_id: palId,
    face_id: cfg.faceId,
    conversation_name: `${cfg.agentName} ${new Date().toISOString()}`,
    custom_greeting: cfg.greeting || undefined,
    properties: {
      languages: cfg.languages || ['es'],
      max_call_duration: cfg.maxCallSeconds || 600,
      participant_left_timeout: 30,
    },
  };
  if (meetingUrl) {
    if (!cfg.enableMeetings) throw Object.assign(new Error('Las reuniones de Zoom/Meet/Teams están desactivadas (requieren plan de pago de Tavus). Activa "enableMeetings" en config.json.'), { status: 400 });
    body.meeting_url = meetingUrl;
  }
  const conv = await tavus('POST', '/conversations', body);
  leads.add({ conversationId: conv.conversation_id, agentName: cfg.agentName, maxCallSeconds: cfg.maxCallSeconds || 600 });
  return { conversationId: conv.conversation_id, conversationUrl: conv.conversation_url, agentName: cfg.agentName };
}

const leads = createLeads({ dir: DIR, tavus });

// Panel de prospectos: con ADMIN_PASSWORD (usuario cualquiera, o "Authorization: Bearer <clave>");
// sin ADMIN_PASSWORD solo se puede ver desde esta misma computadora.
function isAdmin(req) {
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  const auth = req.headers.authorization || '';
  const given = auth.startsWith('Bearer ') ? auth.slice(7)
    : auth.startsWith('Basic ') ? Buffer.from(auth.slice(6), 'base64').toString().split(':').slice(1).join(':') : '';
  const a = Buffer.from(given), b = Buffer.from(pass);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const send = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(DIR, 'public', 'index.html')));
    }
    if (req.method === 'GET' && (req.url === '/admin' || req.url === '/api/leads')) {
      if (!isAdmin(req)) {
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Prospectos", charset="UTF-8"' });
        return res.end('Acceso restringido');
      }
      if (req.url === '/api/leads') return send(res, 200, leads.load());
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(DIR, 'public', 'admin.html')));
    }
    if (req.method === 'GET' && req.url === '/api/info') {
      const cfg = readConfig();
      return send(res, 200, { agentName: cfg.agentName, hasKey: Boolean(KEY), enableMeetings: Boolean(cfg.enableMeetings) });
    }
    if (!KEY) return send(res, 500, { error: 'Falta TAVUS_API_KEY (ponla en tavus-agent/.env).' });
    if (req.method === 'POST' && req.url === '/api/conversation') {
      const { meetingUrl } = await readJson(req);
      return send(res, 200, await startConversation({ meetingUrl }));
    }
    const end = req.url.match(/^\/api\/conversation\/([\w-]+)\/end$/);
    if (req.method === 'POST' && end) {
      await tavus('POST', `/conversations/${end[1]}/end`).catch((err) => console.error(err.message));
      leads.processLead(end[1]);
      return send(res, 200, { ok: true });
    }
    send(res, 404, { error: 'No encontrado' });
  } catch (err) {
    console.error(err.message);
    send(res, [400, 401].includes(err.status) ? err.status : 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Agente listo en http://localhost:${PORT}`);
  console.log(`Prospectos en http://localhost:${PORT}/admin`);
  if (!KEY) console.warn('Aviso: falta TAVUS_API_KEY.');
  if (!process.env.SUMMARY_API_KEY) console.warn('Aviso: falta SUMMARY_API_KEY: las llamadas se guardan pero sin resumen.');
  if (KEY) { leads.sweep(); setInterval(leads.sweep, 60_000).unref(); }
});
