// Servidor web: panel de agencia (/admin), portal de aprobación del cliente (/p/:token)
// y archivos de medios públicos (/media) que Instagram/Facebook descargan al publicar.
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config, mediaDir, mediaUrl } from './config.js';
import * as db from './db.js';
import * as pipe from './pipeline.js';
import { sign, unsign, safeEqual, randomToken, hashPassword, verifyPassword, tempPassword, encrypt, decrypt } from './crypto.js';
import { freqDays } from './schedule.js';
import * as V from './web/views.js';
import { checkConnections } from './publishers/check.js';
import { sendTestDigest } from './notify.js';
import * as agenda from './agenda/index.js';
import { pulse } from './pulse.js';
import * as plan from './plan.js';
import * as billing from './billing.js';
import * as metricas from './metricas.js';
import { reportePage } from './web/reporte.js';
import * as agente from './agente.js';
import * as conoc from './conocimiento.js';
import * as seg from './seguridad.js';
import * as blog from './blog.js';
import * as campanas from './campanas.js';
import { parsePaletas } from './rotacion.js';
import * as avisosAgente from './avisos-agente.js';
import * as facturacion from './facturacion.js';
import * as llamadas from './llamadas.js';
import * as prospeccion from './prospeccion.js';
import { feedHtml } from './web/control.js';
import { inicioPage, privacidadPage, terminosPage } from './web/publico.js';
import * as embudo from './embudo.js';
import * as importar from './importar.js';
import * as limpieza from './limpieza.js';
import { fichaLead } from './web/embudo.js';
import { tiktokAuthUrl, exchangeTikTokCode, revokeTikTok, tiktokConfigured, freshTikTokCreds, tiktokCreatorInfo } from './publishers/tiktok.js';

// Los videos de TikTok por aprobar muestran la cuenta y sus opciones (las pide TikTok antes de publicar).
async function withTikTokInfo(client, posts) {
  const pend = posts.filter((p) => p.plataforma === 'tiktok' && p.status === 'pendiente');
  if (!pend.length) return posts;
  let info;
  try {
    const creds = db.clientCredentials(client);
    const tk = await freshTikTokCreds(creds.tiktok, (nuevo) => db.updateClient(client.id, { credentials: { ...creds, tiktok: nuevo } }));
    info = await tiktokCreatorInfo(tk.access_token);
  } catch (e) { info = { error: e.message }; }
  for (const p of pend) p.tiktokInfo = info;
  return posts;
}

export function createApp() {
  db.getDb();
  const app = express();
  app.disable('x-powered-by');
  seg.ensureTables();
  app.use(seg.cabeceras);
  app.use(express.urlencoded({ extended: false, limit: '2mb' }));
  app.use(['/admin', '/app', '/entrar', '/salir', '/p', '/agendar'], seg.mismoOrigen);
  app.use('/media', express.static(mediaDir(), { maxAge: '1h', fallthrough: false }));
  // Tipografía del panel (Inter Tight, la misma de los videos), servida localmente.
  app.use('/fonts', express.static(path.join(path.dirname(fileURLToPath(import.meta.resolve('@fontsource/inter-tight/package.json'))), 'files'), { maxAge: '30d', fallthrough: false }));
  app.get('/salud', (_req, res) => res.json({ ok: true }));

  const upload = multer({
    storage: multer.diskStorage({
      destination: mediaDir(),
      filename: (_req, f, cb) => cb(null, `subida-${Date.now()}-${randomToken(6)}${path.extname(f.originalname).toLowerCase() || ''}`),
    }),
    limits: { fileSize: 300 * 1024 * 1024 },
    fileFilter: (_req, f, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'].includes(f.mimetype)),
  });

  // Archivos que manda el agente de WhatsApp: también PDF (nombre al azar: se sirven públicos para WhatsApp).
  const uploadDoc = multer({
    storage: multer.diskStorage({
      destination: mediaDir(),
      filename: (_req, f, cb) => cb(null, `archivo-${Date.now()}-${randomToken(10)}${path.extname(f.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '') || ''}`),
    }),
    limits: { fileSize: 60 * 1024 * 1024 },
    fileFilter: (_req, f, cb) => cb(null, ['application/pdf', 'image/jpeg', 'image/png', 'video/mp4'].includes(f.mimetype)),
  });

  // ------------------------------------------------------------ avisos de Stripe (pagos)
  app.post('/webhooks/stripe', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    if (!billing.verificarFirma(raw, req.headers['stripe-signature'])) return res.status(400).send('Firma no válida');
    try { await billing.procesarEvento(JSON.parse(raw)); res.json({ received: true }); }
    catch (e) { console.error('[stripe]', e.message); res.status(500).json({ error: 'No se pudo procesar' }); }
  });

  // ------------------------------------------------------------ API para el agente de WhatsApp
  // Autorización: "Authorization: Bearer <llave del cliente>" (se genera en el panel, pestaña Configuración).
  const api = express.Router({ mergeParams: true });
  api.use(seg.limite({ max: 300, clave: (req) => `${req.params.slug}|${seg.ipDe(req)}` })); // 300 por minuto por marca e IP
  api.use(express.json({ limit: '400kb' })); // una llamada de 10 min con su transcripción cabe de sobra
  api.use((req, res, next) => {
    const c = db.listClients().find((x) => x.slug === req.params.slug);
    const key = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const want = c && db.clientCredentials(c).api_key;
    if (!c || !want || !key || !safeEqual(key, want)) return res.status(401).json({ error: 'No autorizado' });
    req.client = c; next();
  });
  api.get('/disponibilidad', async (req, res) => {
    try { res.json({ horarios: await agenda.availability(req.client, { dias: Math.min(30, Number(req.query.dias) || 7) }) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  api.post('/citas', async (req, res) => {
    const { inicio, nombre, telefono, motivo } = req.body || {};
    try {
      const cita = await agenda.book(req.client, { inicio, nombre, telefono, motivo });
      if (telefono) db.upsertLead(req.client.id, { nombre, telefono, origen: 'whatsapp', estado: 'cita', cita_inicio: cita.inicio, cita_evento: cita.id });
      db.logEvent({ clientId: req.client.id, tipo: 'cita_agendada', detalle: `${nombre || telefono || ''} ${cita.inicio}` });
      res.json({ ok: true, cita });
    } catch (e) {
      if (e instanceof agenda.SlotTaken) {
        const alternativas = await agenda.availability(req.client, { dias: 7 }).catch(() => []);
        return res.status(409).json({ error: e.message, alternativas: alternativas.slice(0, 3) });
      }
      res.status(500).json({ error: e.message });
    }
  });
  api.get('/citas', async (req, res) => {
    try { res.json({ citas: await agenda.agentEvents(req.client, { dias: Math.min(90, Number(req.query.dias) || 45) }) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  api.get('/conocimiento', (req, res) => {
    const k = conoc.actual(req.client.id);
    // Archivos para compartir: con URL pública para que WhatsApp los descargue y los mande.
    const archivos = (Array.isArray(req.client.config.archivos_agente) ? req.client.config.archivos_agente : [])
      .filter((a) => fs.existsSync(a.archivo))
      .map((a) => ({ clave: `archivo-${a.id}`, nombre: a.nombre, cuando: a.cuando, tipo: a.tipo, url: mediaUrl(a.archivo), nombre_archivo: `${a.nombre.replace(/[\\/:*?"<>|]/g, '')}${path.extname(a.archivo)}` }));
    const ia = embudo.horarioIA(req.client); // cuándo contesta la IA (lo elige el cliente en el panel)
    const pausado = req.client.config.agente_pausado === true; // botón "Pausar agente" del panel
    res.set('Cache-Control', 'no-store').json(k ? { version: k.version, texto: k.texto, datos: k.datos, actualizado: k.actualizado, archivos, ia, pausado } : { version: 0, texto: '', datos: {}, archivos, ia, pausado });
  });
  api.post('/mensajes', (req, res) => {
    const { telefono, usuario, origen, rol, texto, autor } = req.body || {};
    try { db.addLeadMessage(req.client.id, { telefono, usuario, origen: origen || 'whatsapp' }, { rol, texto, autor }); res.json({ ok: true }); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  api.delete('/citas/:eventId', async (req, res) => {
    try {
      await agenda.cancelEvent(req.client, req.params.eventId);
      db.logEvent({ clientId: req.client.id, tipo: 'cita_cancelada', detalle: req.params.eventId });
      res.json({ ok: true });
    } catch (e) {
      if (e instanceof agenda.SlotTaken) return res.status(403).json({ error: e.message });
      res.status(/Not Found|404/.test(e.message) ? 404 : 500).json({ error: e.message });
    }
  });
  // El agente de llamadas manda aquí cada llamada que termina (resumen, transcripción y datos del cliente).
  api.post('/llamadas', (req, res) => {
    try { const r = llamadas.registrar(req.client, req.body || {}); res.json({ ok: true, nueva: r.nueva, lead_id: r.lead?.id ?? r.llamada.lead_id ?? null }); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  // Agente de ventas: siguiente empresa a llamar (respeta horario, intentos y REPEP) y resultado de cada llamada.
  api.get('/prospectos/siguiente', (req, res) => res.set('Cache-Control', 'no-store').json(prospeccion.siguiente(req.client)));
  api.post('/prospectos/:pid/resultado', (req, res) => {
    try { res.json({ ok: true, prospecto: prospeccion.resultado(req.client, Number(req.params.pid), req.body || {}) }); }
    catch (e) { res.status(/no encontrado/.test(e.message) ? 404 : 400).json({ error: e.message }); }
  });
  // El agente de WhatsApp avisa que alguien necesita a una persona: se marca en el lead y se manda por correo.
  api.post('/avisos', async (req, res) => {
    try { res.json(await avisosAgente.recibir(req.client, req.body || {})); }
    catch (e) { console.error('[avisos agente]', e.message); res.status(500).json({ error: e.message }); }
  });
  api.post('/leads', (req, res) => {
    try {
      let lead = db.upsertLead(req.client.id, { ...req.body, origen: req.body?.origen || 'whatsapp' });
      lead = embudo.datosDelAgente(req.client, lead, req.body || {});
      campanas.completarCampana(req.client, lead); // nombre de la campaña de Meta, en segundo plano
      res.json({ ok: true, lead });
    }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.use('/api/:slug', api);

  // ------------------------------------------------------------ facturación (Factura.com)
  async function enviarArchivoFactura(res, fac, tipo) {
    if (!['pdf', 'xml'].includes(tipo)) throw new Error('Archivo no válido');
    if (!fac || fac.status !== 'emitida') throw new Error('Factura no encontrada');
    const buf = await facturacion.archivo(fac, tipo);
    res.set({ 'Content-Type': tipo === 'xml' ? 'application/xml' : 'application/pdf', 'Content-Disposition': `attachment; filename="factura-${fac.serie || ''}${fac.folio || fac.id}.${tipo}"` }).send(buf);
  }
  /** Vuelve a intentar las facturas pendientes o con error de un cliente (o de todos). */
  async function reintentarFacturas(clientId = null) {
    const pend = facturacion.listar({ clientId, limit: 200 }).filter((f) => ['pendiente', 'error'].includes(f.status));
    for (const f of pend) {
      const c = db.getClient(f.client_id);
      const inv = await billing.stripe('GET', `/invoices/${f.stripe_invoice}`).catch(() => null);
      if (c && inv) await facturacion.facturarCobro(c, inv, { forzar: true });
    }
    return pend.length;
  }

  // Descarga de leads en CSV (abre en Excel); respeta el filtro de campaña.
  function enviarCsv(req, res) {
    const sel = String(req.query.campana || '');
    const leads = db.listLeads(req.client.id, { limit: 100000 }).filter((l) => !sel || campanas.etiquetaCampana(l) === sel);
    const nombre = `leads-${req.client.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${nombre}"`, 'Cache-Control': 'no-store' })
      .send(campanas.leadsCsv(leads, { estados: db.LEAD_ESTADOS }));
  }

  // ------------------------------------------------------------ blog: lo que leen los sitios PHP (público, solo lo publicado)
  const blogJson = (res, data) => {
    if (!data) return res.status(404).json({ error: 'No encontrado' });
    res.set({ 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' }).json(data);
  };
  app.get('/blog/:sitio/articulos.json', (req, res) => blogJson(res, blog.apiLista(req.params.sitio, { pagina: req.query.pagina, porPagina: req.query.por_pagina, categoria: String(req.query.categoria || '') })));
  app.get('/blog/:sitio/articulo/:slug.json', (req, res) => blogJson(res, blog.apiArticulo(req.params.sitio, req.params.slug)));
  app.get('/blog/:sitio/sitemap.json', (req, res) => blogJson(res, blog.apiSitemap(req.params.sitio)));

  // ------------------------------------------------------------ sesión admin
  const COOKIE = 'sa_admin';
  const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((x) => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
  // Sesión: "admin:<vence>" (contraseña maestra ADMIN_PASSWORD) o "u:<id>:<vence>:<huella>" (usuario).
  // La huella cambia al cambiar la contraseña, así se cierran las sesiones abiertas.
  const huella = (u) => u.password_hash.slice(-12);
  const session = (req) => {
    const v = unsign(cookies(req)[COOKIE]);
    if (!v) return null;
    const [tipo, a, b2, c] = v.split(':');
    if (tipo === 'admin') return Number(a) > Date.now() ? { admin: true, user: null } : null;
    if (tipo !== 'u' || Number(b2) <= Date.now()) return null;
    const u = db.getUser(Number(a));
    if (!u || !u.activo || huella(u) !== c) return null;
    return { admin: u.rol === 'admin', user: u };
  };
  const isAdmin = (req) => !!session(req)?.admin;
  const requireAdmin = (req, res, next) => {
    const s = session(req);
    if (s?.admin) { req.sesion = s; return next(); }
    res.redirect(s?.user ? '/app' : '/entrar');
  };
  // Páginas públicas: TikTok/Meta revisan que la app se presente a sus usuarios (negocios) con privacidad y términos.
  app.get('/', (req, res) => { const s = session(req); if (s?.admin) return res.redirect('/admin'); if (s?.user) return res.redirect('/app'); res.send(inicioPage()); });
  app.get(['/privacidad', '/privacy'], (_req, res) => res.send(privacidadPage()));
  app.get(['/terminos', '/terms'], (_req, res) => res.send(terminosPage()));
  // Regreso de TikTok. Fuera del router de admin para que también funcione cuando el cliente conecta su propia cuenta.
  // El "state" va firmado: tiktok:<cliente>:<vence>[:app]
  app.get('/admin/tiktok/callback', async (req, res) => {
    const st = unsign(String(req.query.state || ''));
    const [, cid, exp, origen] = st ? st.split(':') : [];
    const client = cid && Number(exp) > Date.now() ? db.getClient(Number(cid)) : null;
    if (!client) return res.status(400).send('El enlace de TikTok venció o no es válido. Vuelve a dar "Conectar TikTok".');
    const s = session(req);
    const esApp = origen === 'app';
    if (!s?.admin && !(esApp && s?.user?.client_id === client.id)) return res.redirect('/entrar');
    const volver = esApp ? '/app/cuenta' : `/admin/clientes/${client.id}`;
    if (req.query.error) return res.redirect(`${volver}?error=${encodeURIComponent(`TikTok: ${req.query.error_description || req.query.error}`)}`);
    try {
      const tk = await exchangeTikTokCode(String(req.query.code || ''));
      db.updateClient(client.id, { credentials: { ...db.clientCredentials(client), tiktok: tk } });
      db.logEvent({ clientId: client.id, tipo: 'tiktok_conectado', detalle: `open_id ${tk.open_id}${esApp ? ' (desde la cuenta del cliente)' : ''}` });
      res.redirect(esApp ? '/app/cuenta?ok=' + encodeURIComponent('TikTok conectado.') : volver);
    } catch (e) {
      res.redirect(`${volver}?error=${encodeURIComponent(e.message)}`);
    }
  });
  const setSession = (res, value) => {
    const secure = config.publicBaseUrl.startsWith('https') ? '; Secure' : '';
    res.append('Set-Cookie', `${COOKIE}=${encodeURIComponent(sign(value))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secure}`);
  };
  // Freno a intentos de contraseña: 8 fallos por IP cada 15 min.
  const fallos = new Map();
  const ipDe = seg.ipDe;
  const bloqueado = (ip) => (fallos.get(ip) || []).filter((t) => Date.now() - t < 15 * 60_000).length >= 8;
  const fallo = (ip) => fallos.set(ip, [...(fallos.get(ip) || []).filter((t) => Date.now() - t < 15 * 60_000), Date.now()]);

  app.get(['/entrar', '/admin/entrar'], (req, res) => {
    const s = session(req);
    if (s) return res.redirect(s.admin ? '/admin' : '/app');
    res.send(V.loginPage());
  });
  app.post(['/entrar', '/admin/entrar'], (req, res) => {
    const ip = ipDe(req), email = String(req.body.email || '').trim(), pw = String(req.body.password || '');
    if (bloqueado(ip)) return res.status(429).send(V.loginPage('Demasiados intentos. Espera 15 minutos.', email));
    if (!email || email.toLowerCase() === 'admin') { // contraseña maestra (la del .env)
      if (config.adminPassword && process.env.ADMIN_MASTER_LOGIN !== '0' && safeEqual(pw, config.adminPassword)) {
        setSession(res, `admin:${Date.now() + 12 * 3600_000}`); seg.auditar(req, 'entrada', 'contraseña maestra'); return res.redirect('/admin');
      }
      fallo(ip); seg.auditar(req, 'entrada_fallida', 'contraseña maestra'); return res.status(401).send(V.loginPage('Correo o contraseña incorrectos', email));
    }
    const u = db.getUserByEmail(email);
    if (!u || !u.activo || !verifyPassword(pw, u.password_hash)) { fallo(ip); seg.auditar(req, 'entrada_fallida', email.slice(0, 80)); return res.status(401).send(V.loginPage('Correo o contraseña incorrectos', email)); }
    if (u.totp_enc) { // segundo paso: código de la app de autenticación
      const secure = config.publicBaseUrl.startsWith('https') ? '; Secure' : '';
      res.setHeader('Set-Cookie', `sa_2fa=${encodeURIComponent(sign(`2fa:${u.id}:${Date.now() + 5 * 60_000}`))}; HttpOnly; SameSite=Lax; Path=/entrar; Max-Age=300${secure}`);
      return res.send(V.codigoPage());
    }
    entrar(req, res, u);
  });
  const entrar = (req, res, u) => {
    db.touchLogin(u.id);
    setSession(res, `u:${u.id}:${Date.now() + 12 * 3600_000}:${huella(u)}`);
    seg.auditar(req, 'entrada', u.rol, u);
    res.redirect(u.rol === 'admin' ? '/admin' : '/app');
  };
  app.post('/entrar/codigo', (req, res) => {
    const ip = ipDe(req);
    if (bloqueado(ip)) return res.status(429).send(V.loginPage('Demasiados intentos. Espera 15 minutos.'));
    const v = unsign(cookies(req).sa_2fa || ''), [tipo, id, exp] = String(v || '').split(':');
    const u = tipo === '2fa' && Number(exp) > Date.now() ? db.getUser(Number(id)) : null;
    if (!u || !u.activo || !u.totp_enc) return res.status(401).send(V.loginPage('El código expiró. Vuelve a entrar.'));
    if (!seg.verificarTotp(decrypt(u.totp_enc).s, req.body.codigo)) { fallo(ip); seg.auditar(req, 'codigo_fallido', '', u); return res.status(401).send(V.codigoPage('Código incorrecto. Revisa tu app y vuelve a intentar.')); }
    res.append('Set-Cookie', 'sa_2fa=; Path=/entrar; Max-Age=0');
    entrar(req, res, u);
  });
  app.get(['/salir', '/admin/salir'], (_req, res) => {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0`);
    res.redirect('/entrar');
  });

  // ------------------------------------------------------------ vista del cliente (/app)
  // Un cliente solo ve su marca. Un administrador puede verla igual con /app?c=<id>.
  const appR = express.Router();
  appR.use((req, res, next) => {
    const s = session(req);
    if (!s) return res.redirect('/entrar');
    req.sesion = s;
    if (req.path.startsWith('/cuenta')) return next();
    let cid = s.user?.rol === 'cliente' ? s.user.client_id : null;
    if (s.admin) {
      if (req.query.c) res.setHeader('Set-Cookie', `sa_ver=${Number(req.query.c)}; HttpOnly; SameSite=Lax; Path=/app`);
      cid = Number(req.query.c || cookies(req).sa_ver) || null;
      if (!cid) return res.redirect('/admin');
    }
    req.client = cid && db.getClient(cid);
    if (!req.client) return res.status(404).send('Marca no encontrada');
    res.setHeader('X-Robots-Tag', 'noindex');
    next();
  });
  const appPosts = (c) => db.listPosts({ clientId: c.id, limit: 400 }).filter((p) => !['rechazado', 'error_generacion'].includes(p.status));
  // Cada sección solo existe si el cliente la contrató.
  const servicio = (srv) => (req, res, next) => (plan.tiene(req.client, srv) ? next() : res.redirect('/app'));
  appR.use(['/posts', '/extra', '/temas'], servicio('redes'));
  appR.use('/leads', servicio('chat'));
  appR.use('/citas', servicio('agenda'));
  appR.get('/llamadas', servicio('llamadas'), (req, res) => res.send(V.appLlamadasPage(req.client, llamadas.listar(req.client.id), llamadas.delMes(req.client.id, metricas.mesActual()))));
  appR.get('/videollamadas', servicio('videollamadas'), (req, res) => res.send(V.appProximamentePage(req.client, 'videollamadas')));
  const cuota = (c) => ({ semana: plan.postsDeLaSemana(c.id), costo: plan.costoExtra(c), extras: plan.extrasDelMes(c.id).length });
  const redExtra = (c, red) => db.PLATFORMS.includes(red) && c.config[red]?.activo && red !== 'tiktok' && !c.config[red]?.reusar_instagram;
  appR.get('/extra', (req, res) => {
    const red = String(req.query.red || '');
    if (!redExtra(req.client, red)) return res.redirect('/app/posts');
    res.send(V.appExtraPage(req.client, { red, costo: plan.costoExtra(req.client), tarjeta: db.getBilling(req.client.id).tarjeta, tema: String(req.query.tema || '').slice(0, 400) }));
  });
  // Ideas de temas: a la lista de espera (gratis, entra en su plan) o directo a una publicación extra.
  appR.post('/temas', (req, res) => {
    const tema = String(req.body.tema || '').trim().slice(0, 400);
    if (req.body.accion === 'extra') {
      const red = db.PLATFORMS.find((p) => redExtra(req.client, p));
      return res.redirect(red ? `/app/extra?red=${red}&tema=${encodeURIComponent(tema)}` : '/app/posts');
    }
    try { pipe.agregarTema(req.client.id, tema); res.redirect(303, '/app/posts?ok=tema'); }
    catch (e) { res.redirect(303, `/app/posts?error=${encodeURIComponent(e.message)}`); }
  });
  appR.post('/temas/:i/quitar', (req, res) => { pipe.quitarTema(req.client.id, Number(req.params.i)); res.redirect(303, '/app/posts'); });
  const extrasEnCurso = new Set();
  appR.post('/extra', async (req, res) => {
    const c = req.client, red = String(req.body.red || '');
    if (!redExtra(c, red)) return res.redirect('/app/posts');
    if (extrasEnCurso.has(c.id)) return res.redirect('/app/posts');
    extrasEnCurso.add(c.id);
    try {
      const costo = plan.costoExtra(c), tarjeta = db.getBilling(c.id).tarjeta;
      const tema = String(req.body.tema || '').trim().slice(0, 400);
      const vista = (error) => V.appExtraPage(c, { red, costo, tarjeta, error, tema });
      if (Number(req.body.monto) !== costo.monto) return res.status(409).send(vista('El precio cambió desde que abriste esta página. Revísalo y confirma de nuevo.'));
      let estado = 'gratis', factura = null;
      if (costo.monto > 0 && costo.modo === 'externo') estado = 'por_cobrar'; // lo cobra Kuper por fuera
      else if (costo.monto > 0) {
        if (!billing.stripeOn() || !tarjeta) return res.status(402).send(vista('Primero domicilia tu tarjeta en Pagos.'));
        const r = await billing.cobrarExtra(c, { monto: costo.monto, concepto: `Publicación extra en ${red}`, idem: `extra-${c.id}-${plan.extrasDelMes(c.id).length}-${red}` });
        if (!r.ok) return res.status(402).send(vista(r.url ? `Tu banco pidió confirmar el pago. Ábrelo aquí: ${r.url}` : `No se pudo cobrar: ${r.error}`));
        estado = 'pagado'; factura = r.factura;
      }
      plan.registrarExtra(c.id, { plataforma: red, monto: costo.monto, estado, factura });
      db.logEvent({ clientId: c.id, tipo: 'post_extra', detalle: `${red} · ${costo.monto ? plan.mxn(costo.monto) : 'gratis'}${tema ? ` · ${tema}` : ''}` });
      pipe.enqueue(`extra-${c.id}-${red}-${Date.now()}`, () => pipe.generateForPlatform(c.id, red, { force: true, tema }).catch(() => {}));
      res.redirect('/app/posts?ok=extra');
    } catch (e) {
      console.error('[extra]', e.message);
      res.status(500).send(V.appExtraPage(c, { red, costo: plan.costoExtra(c), tarjeta: db.getBilling(c.id).tarjeta, error: 'No pudimos procesarlo. Intenta de nuevo en unos minutos.' }));
    } finally { extrasEnCurso.delete(c.id); }
  });
  appR.get('/pagos', async (req, res) => {
    let r = { ...db.getBilling(req.client.id), facturas: [] }, error = '';
    try { r = await billing.resumen(req.client); } catch (e) { console.error('[pagos]', e.message); error = 'No pudimos consultar tus pagos en este momento.'; }
    res.send(V.appPagosPage(req.client, r, { error, ok: req.query.ok ? 'Listo, tu tarjeta quedó domiciliada.' : req.query.fiscal ? 'Listo, guardamos tus datos para la factura.' : '', stripeOn: billing.stripeOn(), facturas: facturacion.porStripe(req.client.id) }));
  });
  // PDF o XML de la factura de un cobro (solo los del propio cliente).
  appR.get('/pagos/factura/:inv/:tipo', async (req, res) => {
    const fac = facturacion.porStripe(req.client.id)[req.params.inv];
    try { await enviarArchivoFactura(res, fac, req.params.tipo); } catch (e) { res.status(404).send(e.message); }
  });
  appR.post('/pagos/domiciliar', async (req, res) => {
    try { res.redirect(303, await billing.checkoutUrl(req.client, { email: req.sesion.user?.email })); }
    catch (e) { console.error('[pagos]', e.message); res.status(500).send(V.appPagosPage(req.client, { ...db.getBilling(req.client.id), facturas: [] }, { error: 'No pudimos abrir la página de pago. Intenta de nuevo.', stripeOn: billing.stripeOn() })); }
  });
  appR.post('/pagos/fiscal', async (req, res) => {
    try {
      const fiscal = plan.parseFiscal(req.body || {});
      db.updateClient(req.client.id, { config: { ...req.client.config, fiscal } });
      seg.auditar(req, 'datos_fiscales', fiscal.rfc);
      await billing.actualizarFiscal(req.client, fiscal);
      reintentarFacturas(req.client.id).catch(() => {}); // si había cobros esperando sus datos, ya se facturan
      res.redirect(303, '/app/pagos?fiscal=1#factura');
    } catch (e) {
      res.status(400).send(V.appPagosPage(req.client, { ...db.getBilling(req.client.id), facturas: [] }, { fiscalError: e.message, stripeOn: billing.stripeOn() }));
    }
  });
  appR.post('/pagos/portal', async (req, res) => {
    try { res.redirect(303, await billing.portalUrl(req.client)); }
    catch (e) { console.error('[pagos]', e.message); res.status(500).send(V.appPagosPage(req.client, { ...db.getBilling(req.client.id), facturas: [] }, { error: e.message, stripeOn: billing.stripeOn() })); }
  });
  appR.get('/', async (req, res) => res.send(V.appHomePage(req.client, await pulse(db.listClients(), { clientId: req.client.id }), db.getBilling(req.client.id))));
  appR.get('/pulso.json', async (req, res) => {
    const p = await pulse(db.listClients(), { clientId: req.client.id, conCitas: false });
    res.json({ ...p, feedHtml: feedHtml(p.feed) });
  });
  appR.get('/posts', async (req, res) => res.send(V.appPostsPage(req.client, await withTikTokInfo(req.client, appPosts(req.client)), String(req.query.t || ''), db.listLeads(req.client.id).length,
    cuota(req.client), req.query.ok === 'extra' ? 'Listo, el agente ya está creando tu publicación extra. En unos minutos aparece en "Por revisar".'
      : req.query.ok === 'tema' ? 'Listo, tu idea quedó en la lista: la usamos en tu próxima publicación.' : String(req.query.error || '').slice(0, 200))));
  appR.param('pid', (req, res, next, id) => {
    req.post = db.getPost(Number(id));
    return req.post && req.post.client_id === req.client.id ? next() : res.status(404).send('Post no encontrado');
  });
  postActions(appR, (req) => `/app/posts#post-${req.post.id}`);
  appR.get('/leads', (req, res) => res.send(V.appLeadsPage(req.client, db.listLeads(req.client.id), db.leadMessageCounts(req.client.id), appPosts(req.client), String(req.query.campana || ''))));
  appR.get('/leads.csv', servicio('chat'), (req, res) => enviarCsv(req, res));
  appR.post('/leads/:leadId', (req, res) => { db.setLeadEstado(req.client.id, Number(req.params.leadId), String(req.body.estado)); res.redirect('/app/leads'); });
  chatRoutes(appR, () => '/app', { app: true, prefix: '' });
  appR.use(['/embudo', '/analitica'], servicio('chat'));
  embudoRoutes(appR, () => '/app', { app: true });
  appR.use('/agente', servicio('chat'));
  conocimientoRoutes(appR, () => '/app', { app: true });
  appR.get('/citas', async (req, res) => {
    const cfg = agenda.agendaCfg(req.client), view = { agendaCfg: cfg, todo: req.query.todo === '1' };
    try { view.citas = cfg.calendar_id ? agenda.groupRecurring(await agenda.upcomingEvents(cfg.calendar_id)) : null; } catch { view.citasError = 'No pudimos leer la agenda en este momento.'; }
    res.send(V.appCitasPage(req.client, view, appPosts(req.client), db.listLeads(req.client.id).length));
  });
  appR.get('/reporte', (req, res) => {
    const mes = /^\d{4}-\d{2}$/.test(req.query.mes || '') ? req.query.mes : metricas.mesActual();
    res.send(reportePage(req.client, metricas.resumenMes(req.client, mes), { base: '/app/reporte?', meses: metricas.ultimosMeses(), side: V.appSide('reporte', req.client) }));
  });
  appR.get('/cuenta', (req, res) => {
    if (!req.sesion.user) return res.send(V.cuentaMaestraPage());
    res.send(V.cuentaPage(req.sesion.user, { client: req.sesion.user.client_id ? db.getClient(req.sesion.user.client_id) : null, ok: String(req.query.ok || '').slice(0, 200), error: String(req.query.error || '').slice(0, 300) }));
  });
  // TikTok: el propio cliente conecta su cuenta (Login Kit) y puede desconectarla cuando quiera.
  const clienteDeCuenta = (req) => (req.sesion.user?.client_id ? db.getClient(req.sesion.user.client_id) : null);
  appR.get('/cuenta/tiktok/conectar', (req, res) => {
    const c = clienteDeCuenta(req);
    if (!c) return res.redirect('/app/cuenta');
    if (!tiktokConfigured()) return res.redirect('/app/cuenta?error=' + encodeURIComponent('TikTok todavía no está disponible. Avísale a Kuper.'));
    res.redirect(tiktokAuthUrl(sign(`tiktok:${c.id}:${Date.now() + 15 * 60_000}:app`)));
  });
  appR.post('/cuenta/tiktok/desconectar', async (req, res) => {
    const c = clienteDeCuenta(req);
    if (!c) return res.redirect('/app/cuenta');
    const creds = db.clientCredentials(c);
    try { await revokeTikTok(creds.tiktok); } catch { /* se borra de todos modos */ }
    const { tiktok, ...rest } = creds;
    db.updateClient(c.id, { credentials: rest });
    db.logEvent({ clientId: c.id, tipo: 'tiktok_desconectado', detalle: 'desde la cuenta del cliente' });
    seg.auditar(req, 'tiktok_desconectado', c.nombre);
    res.redirect('/app/cuenta?ok=' + encodeURIComponent('TikTok desconectado. Borramos el acceso y tus tokens.'));
  });
  appR.post('/cuenta', (req, res) => {
    const u = req.sesion.user;
    if (!u) return res.redirect('/admin');
    const { actual = '', nueva = '', nueva2 = '' } = req.body;
    if (!verifyPassword(actual, u.password_hash)) return res.status(400).send(V.cuentaPage(u, { client: u.client_id ? db.getClient(u.client_id) : null, error: 'La contraseña actual no es correcta.' }));
    if (nueva.length < 10) return res.status(400).send(V.cuentaPage(u, { client: u.client_id ? db.getClient(u.client_id) : null, error: 'La nueva contraseña debe tener al menos 10 caracteres.' }));
    if (nueva !== nueva2) return res.status(400).send(V.cuentaPage(u, { client: u.client_id ? db.getClient(u.client_id) : null, error: 'Las contraseñas nuevas no coinciden.' }));
    db.setUserPassword(u.id, hashPassword(nueva));
    seg.auditar(req, 'clave_cambiada', '', u);
    const nu = db.getUser(u.id);
    setSession(res, `u:${nu.id}:${Date.now() + 12 * 3600_000}:${huella(nu)}`);
    res.send(V.cuentaPage(nu, { client: nu.client_id ? db.getClient(nu.client_id) : null, ok: 'Listo, tu contraseña cambió.' }));
  });
  // Verificación en dos pasos (Mi cuenta)
  const cliDe = (u) => (u.client_id ? db.getClient(u.client_id) : null);
  appR.post('/cuenta/2fa/iniciar', (req, res) => {
    const u = req.sesion.user; if (!u) return res.redirect('/admin');
    const secreto = seg.nuevoSecreto();
    res.send(V.cuentaPage(u, { client: cliDe(u), dosPasos: { secreto, url: seg.otpauthUrl(secreto, u.email), token: encrypt({ s: secreto, u: u.id, exp: Date.now() + 15 * 60_000 }) } }));
  });
  appR.post('/cuenta/2fa/activar', (req, res) => {
    const u = req.sesion.user; if (!u) return res.redirect('/admin');
    let t = null; try { t = decrypt(String(req.body.token || '')); } catch { /* token alterado */ }
    if (!t || t.u !== u.id || t.exp < Date.now()) return res.status(400).send(V.cuentaPage(u, { client: cliDe(u), error: 'Se venció el tiempo para activar. Empieza de nuevo.' }));
    if (!seg.verificarTotp(t.s, req.body.codigo)) return res.status(400).send(V.cuentaPage(u, { client: cliDe(u), error: 'Código incorrecto. Revisa que la hora de tu teléfono esté bien.', dosPasos: { secreto: t.s, url: seg.otpauthUrl(t.s, u.email), token: req.body.token } }));
    db.getDb().prepare('UPDATE users SET totp_enc = ? WHERE id = ?').run(encrypt({ s: t.s }), u.id);
    seg.auditar(req, '2fa_activado', '', u);
    res.send(V.cuentaPage(db.getUser(u.id), { client: cliDe(u), ok: 'Listo: desde ahora te pediremos un código de tu app al entrar.' }));
  });
  appR.post('/cuenta/2fa/quitar', (req, res) => {
    const u = db.getUser(req.sesion.user?.id); if (!u) return res.redirect('/admin');
    if (!u.totp_enc || !seg.verificarTotp(decrypt(u.totp_enc).s, req.body.codigo)) return res.status(400).send(V.cuentaPage(u, { client: cliDe(u), error: 'Código incorrecto.' }));
    db.getDb().prepare('UPDATE users SET totp_enc = NULL WHERE id = ?').run(u.id);
    seg.auditar(req, '2fa_quitado', '', u);
    res.send(V.cuentaPage(db.getUser(u.id), { client: cliDe(u), ok: 'Quitaste la verificación en dos pasos.' }));
  });
  app.use('/app', appR);

  // ------------------------------------------------------------ admin
  const admin = express.Router();
  admin.use(requireAdmin);

  // Usuarios del panel
  const usersView = (req, extra = {}) => V.usersPage(db.listUsers(), db.listClients(), { filtro: Number(req.query.c) || null, bitacora: seg.bitacora(40), ...extra });
  admin.get('/usuarios', (req, res) => res.send(usersView(req)));
  admin.post('/usuarios', (req, res) => {
    const password = tempPassword();
    try {
      const u = db.createUser({ email: req.body.email, nombre: req.body.nombre, rol: req.body.rol, client_id: req.body.client_id, password_hash: hashPassword(password) });
      db.logEvent({ clientId: u.client_id, tipo: 'usuario_creado', detalle: `${u.email} (${u.rol})` });
      seg.auditar(req, 'usuario_creado', `${u.email} (${u.rol})`);
      res.send(usersView(req, { creado: { nombre: u.nombre, email: u.email, password }, filtro: u.client_id }));
    } catch (e) { res.status(400).send(usersView(req, { error: e.message })); }
  });
  admin.param('uid', (req, res, next, id) => { req.usuario = db.getUser(Number(id)); return req.usuario ? next() : res.status(404).send('Usuario no encontrado'); });
  admin.post('/usuarios/:uid/clave', (req, res) => {
    const password = tempPassword();
    db.setUserPassword(req.usuario.id, hashPassword(password));
    seg.auditar(req, 'clave_reiniciada', req.usuario.email);
    res.send(usersView(req, { creado: { nombre: req.usuario.nombre, email: req.usuario.email, password }, filtro: req.usuario.client_id }));
  });
  admin.post('/usuarios/:uid/activo', (req, res) => {
    if (req.sesion.user?.id === req.usuario.id) return res.status(400).send(usersView(req, { error: 'No puedes bloquearte a ti mismo.' }));
    db.setUserActivo(req.usuario.id, !req.usuario.activo); seg.auditar(req, req.usuario.activo ? 'usuario_bloqueado' : 'usuario_activado', req.usuario.email); res.redirect('/admin/usuarios');
  });
  admin.post('/usuarios/:uid/eliminar', (req, res) => {
    if (req.sesion.user?.id === req.usuario.id) return res.status(400).send(usersView(req, { error: 'No puedes eliminarte a ti mismo.' }));
    db.deleteUser(req.usuario.id); seg.auditar(req, 'usuario_eliminado', req.usuario.email); res.redirect('/admin/usuarios');
  });
  admin.post('/usuarios/:uid/quitar-2fa', (req, res) => {
    db.getDb().prepare('UPDATE users SET totp_enc = NULL WHERE id = ?').run(req.usuario.id);
    seg.auditar(req, '2fa_quitado_por_admin', req.usuario.email); res.redirect('/admin/usuarios');
  });

  admin.get('/pulso.json', async (_req, res) => {
    const p = await pulse(db.listClients(), { conCitas: false });
    res.json({ ...p, feedHtml: feedHtml(p.feed) });
  });
  admin.get('/', async (_req, res) => {
    const clients = db.listClients();
    const counts = {};
    for (const p of db.listPosts({ limit: 2000 })) {
      if (!['pendiente', 'necesita_asset', 'aprobado', 'publicado', 'error', 'error_generacion'].includes(p.status)) continue;
      (counts[p.client_id] ??= {})[p.status] = (counts[p.client_id][p.status] || 0) + 1;
    }
    res.send(V.dashboardPage(clients, counts, await pulse(clients), Object.fromEntries(clients.map((c) => [c.id, db.getBilling(c.id)]))));
  });

  function parseClientForm(body, existingCreds = {}) {
    let perfil, cfg;
    try { perfil = JSON.parse(body.perfil); } catch (e) { throw new Error(`Perfil de marca: JSON inválido (${e.message})`); }
    try { cfg = JSON.parse(body.config); } catch (e) { throw new Error(`Configuración de redes: JSON inválido (${e.message})`); }
    if (!perfil.cliente || !Array.isArray(perfil.pilares_de_contenido) || !perfil.pilares_de_contenido.length) {
      throw new Error('El perfil necesita "cliente" y al menos un pilar en "pilares_de_contenido".');
    }
    for (const [k, v] of Object.entries(cfg)) {
      if (k === 'respuesta_palabra_clave' || k === 'agenda' || k === 'plan') continue;
      if (k === 'notificaciones') {
        if (v.email && !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(String(v.email).trim())) throw new Error('notificaciones: "email" no es un correo válido');
        continue;
      }
      // Ajustes internos que no son redes (mascota_path, temas_pendientes, sin_factura…): no son objetos de red.
      if (!db.PLATFORMS.includes(k) && (v === null || typeof v !== 'object' || Array.isArray(v))) continue;
      if (!db.PLATFORMS.includes(k)) throw new Error(`Red no soportada: ${k} (usa ${db.PLATFORMS.join(', ')})`);
      if (v.activo) freqDays(v.frecuencia || 'semanal');
      if (v.hora && !/^\d{2}:\d{2}$/.test(v.hora)) throw new Error(`${k}: "hora" debe ser HH:MM`);
    }
    const keep = (nv, old) => (nv?.trim() ? nv.trim() : old);
    // Tokens pegados con espacios, saltos de línea, comillas o el nombre de la variable del .env.
    const tok = (nv, old) => {
      const v = String(nv ?? '').replace(/^\s*[A-Z_]+\s*=/, '').replace(/["'\s$]/g, '');
      return v ? v : old;
    };
    const credentials = {
      meta: {
        page_id: keep(body.meta_page_id, existingCreds.meta?.page_id),
        ig_user_id: keep(body.meta_ig_user_id, existingCreds.meta?.ig_user_id),
        page_token: tok(body.meta_page_token, existingCreds.meta?.page_token),
        ads_token: tok(body.meta_ads_token, existingCreds.meta?.ads_token),
      },
      linkedin: {
        org_id: keep(body.li_org_id, existingCreds.linkedin?.org_id),
        access_token: tok(body.li_access_token, existingCreds.linkedin?.access_token),
      },
      api_key: existingCreds.api_key, // llave del agente de WhatsApp (se genera en el panel)
      agente_url: existingCreds.agente_url, // dónde vive el agente (para responder desde el panel)
      tiktok: existingCreds.tiktok, // se conecta con el botón "Conectar TikTok", no desde el formulario
      dry_run: body.dry_run === '1',
    };
    return { nombre: body.nombre.trim(), perfil, config: cfg, credentials };
  }

  admin.get('/clientes/nuevo', (_req, res) => res.send(V.clientFormPage(null)));
  admin.post('/clientes/nuevo', (req, res) => {
    try {
      const data = parseClientForm(req.body);
      // Servicios elegidos al crear: si no contrató redes, ninguna red queda activa (no se generan posts).
      const servicios = Object.fromEntries(Object.keys(plan.SERVICIOS).map((k) => [k, req.body[`servicio_${k}`] === '1']));
      if (!servicios.redes) for (const p of db.PLATFORMS) if (data.config[p]) data.config[p] = { ...data.config[p], activo: false };
      data.config.plan = { ...(data.config.plan || {}), servicios };
      const c = db.createClient({ slug: String(req.body.slug || '').trim(), ...data });
      res.redirect(`/admin/clientes/${c.id}`);
    } catch (e) {
      res.status(400).send(V.clientFormPage(null, { error: e.message }));
    }
  });

  const clientView = (c, error, notice, posts, view = {}) => V.clientFormPage(c, {
    error, notice, leadsCount: db.listLeads(c.id).length, billing: db.getBilling(c.id), ...view, competitors: db.listCompetitors(c.id), report: db.latestCompetitorReport(c.id),
    posts: posts || db.listPosts({ clientId: c.id, limit: 400 }), creds: db.clientCredentials(c), keywordReplies: db.keywordReplies(c.id),
  });

  admin.param('cid', (req, res, next, id) => {
    req.client = db.getClient(Number(id));
    return req.client ? next() : res.status(404).send('Cliente no encontrado');
  });
  admin.get('/clientes/:cid', async (req, res, next) => {
    if (req.query.tab === 'reporte') {
      const mes = /^\d{4}-\d{2}$/.test(req.query.mes || '') ? req.query.mes : metricas.mesActual();
      return res.send(reportePage(req.client, metricas.resumenMes(req.client, mes), { base: `/admin/clientes/${req.client.id}?tab=reporte&`, meses: metricas.ultimosMeses(), side: V.adminSide() }));
    }
    const view = { tab: String(req.query.tab || 'posts'), filtro: String(req.query.f || ''), red: String(req.query.red || '') };
    if (view.tab === 'leads') { view.leads = db.listLeads(req.client.id); view.chats = db.leadMessageCounts(req.client.id); view.campanaSel = String(req.query.campana || ''); }
    if (view.tab === 'ventas') { view.prospectos = prospeccion.listar(req.client.id); view.ventasActivo = prospeccion.activo(req.client.id); view.placesListo = !!config.googlePlacesKey; }
    if (view.tab === 'blog') return res.redirect(`/admin/clientes/${req.client.id}/blog`);
    if (view.tab === 'llamadas') { view.llamadas = llamadas.listar(req.client.id); view.llamadasMes = llamadas.delMes(req.client.id, metricas.mesActual()); }
    if (view.tab === 'citas') {
      const cfg = agenda.agendaCfg(req.client);
      try { view.citas = cfg.calendar_id ? agenda.groupRecurring(await agenda.upcomingEvents(cfg.calendar_id)) : null; } catch (e) { view.citasError = e.message; }
      view.agendaCfg = cfg; view.saEmail = agenda.serviceAccount()?.client_email || null; view.todo = req.query.todo === '1';
    }
    res.send(clientView(req.client, req.query.error ? String(req.query.error).slice(0, 300) : undefined, req.query.ok ? String(req.query.ok) : undefined, await withTikTokInfo(req.client, db.listPosts({ clientId: req.client.id, limit: 400 })), view));
  });
  // ------------------------------------------------------------ agente de blog
  const blogView = (c, { sitio = '', error, ok } = {}) => {
    const sitios = blog.listarSitios(c.id);
    const sel = sitio === 'nuevo' ? -1 : Number(sitio) || sitios[0]?.id || null;
    return clientView(c, error, ok, undefined, { tab: 'blog', blog: {
      sitios, sel, articulos: sel > 0 ? blog.listarArticulos(sel) : [], pexelsListo: !!config.pexelsApiKey,
      iaLista: !!(config.geminiTextApiKey || process.env.ANTHROPIC_API_KEY || config.mockLlm), panelUrl: config.publicBaseUrl,
    } });
  };
  const sitioDe = (req) => { const s = blog.getSitio(Number(req.params.sid)); return s && s.client_id === req.client.id ? s : null; };
  admin.get('/clientes/:cid/blog', (req, res) => res.send(blogView(req.client, { sitio: String(req.query.sitio || ''), error: req.query.error ? String(req.query.error).slice(0, 300) : undefined, ok: req.query.ok ? String(req.query.ok).slice(0, 200) : undefined })));
  admin.post('/clientes/:cid/blog/sitios', (req, res) => {
    try { const s = blog.guardarSitio(req.client.id, blog.parseSitio(req.body)); res.redirect(303, `/admin/clientes/${req.client.id}/blog?sitio=${s.id}&ok=Sitio agregado`); }
    catch (e) { res.status(400).send(blogView(req.client, { sitio: 'nuevo', error: e.message })); }
  });
  admin.post('/clientes/:cid/blog/sitios/:sid', (req, res) => {
    const s = sitioDe(req); if (!s) return res.status(404).send('Sitio no encontrado');
    try { blog.guardarSitio(req.client.id, blog.parseSitio(req.body), s.id); res.redirect(303, `/admin/clientes/${req.client.id}/blog?sitio=${s.id}&ok=Sitio guardado`); }
    catch (e) { res.status(400).send(blogView(req.client, { sitio: String(s.id), error: e.message })); }
  });
  admin.post('/clientes/:cid/blog/sitios/:sid/borrar', (req, res) => {
    const s = sitioDe(req); if (!s) return res.status(404).send('Sitio no encontrado');
    for (const a of blog.listarArticulos(s.id, { limit: 100000 })) blog.borrarArticulo(a.id);
    blog.borrarSitio(req.client.id, s.id);
    res.redirect(303, `/admin/clientes/${req.client.id}/blog?ok=Sitio borrado`);
  });
  admin.post('/clientes/:cid/blog/sitios/:sid/generar', (req, res) => {
    const s = sitioDe(req); if (!s) return res.status(404).send('Sitio no encontrado');
    const tema = String(req.body.tema || '').trim().slice(0, 300), back = `/admin/clientes/${req.client.id}/blog?sitio=${s.id}`;
    if (req.body.accion === 'cola') {
      try { blog.agregarTemaBlog(s.id, tema); return res.redirect(303, `${back}&ok=${encodeURIComponent('Tema guardado para el siguiente artículo')}`); }
      catch (e) { return res.redirect(303, `${back}&error=${encodeURIComponent(e.message)}`); }
    }
    blog.generarArticulo(s.id, { tema, categoria: String(req.body.categoria || '') }).catch(() => {});
    res.redirect(303, `${back}&ok=${encodeURIComponent('Escribiendo el artículo (1 a 3 minutos)…')}`);
  });
  admin.post('/clientes/:cid/blog/sitios/:sid/manual', async (req, res) => {
    const s = sitioDe(req); if (!s) return res.status(404).send('Sitio no encontrado');
    try {
      const a = await blog.articuloManual(s.id, { ...req.body, publicar: req.body.publicar === '1' });
      res.redirect(303, `/admin/blog/articulos/${a.id}`);
    } catch (e) { res.redirect(303, `/admin/clientes/${req.client.id}/blog?sitio=${s.id}&error=${encodeURIComponent(e.message)}`); }
  });
  admin.param('aid', (req, res, next, id) => {
    req.articulo = blog.getArticulo(Number(id));
    req.sitio = req.articulo && blog.getSitio(req.articulo.sitio_id);
    req.client = req.sitio && db.getClient(req.sitio.client_id);
    return req.client ? next() : res.status(404).send('Artículo no encontrado');
  });
  const volverArt = (req, res, ok) => res.redirect(303, `/admin/blog/articulos/${req.articulo.id}${ok ? `?ok=${encodeURIComponent(ok)}` : ''}`);
  admin.get('/blog/articulos/:aid', (req, res) => res.send(V.blogArticuloPage(req.articulo, req.sitio, req.client, { panelUrl: config.publicBaseUrl, ok: req.query.ok ? String(req.query.ok).slice(0, 300) : '' })));
  admin.post('/blog/articulos/:aid/publicar', (req, res) => { try { blog.publicar(req.articulo.id); volverArt(req, res); } catch (e) { res.status(400).send(e.message); } });
  admin.post('/blog/articulos/:aid/despublicar', (req, res) => { blog.despublicar(req.articulo.id); volverArt(req, res); });
  admin.post('/blog/articulos/:aid/rechazar', (req, res) => { blog.rechazar(req.articulo.id); volverArt(req, res); });
  admin.post('/blog/articulos/:aid/imagen', (req, res, next) => upload.single('archivo')(req, res, (e) => (e ? volverArt(req, res, `Error: ${e.message}`) : next())), async (req, res) => {
    try {
      await blog.cambiarImagen(req.articulo.id, { archivo: req.file || null, busqueda: req.body.busqueda, quitar: req.body.accion === 'quitar', alt: req.body.imagen_alt });
      volverArt(req, res, 'Imagen actualizada');
    } catch (e) { volverArt(req, res, `Error: ${e.message}`); }
  });
  admin.post('/blog/articulos/:aid/editar', (req, res) => { blog.editar(req.articulo.id, req.body || {}); volverArt(req, res); });
  admin.post('/blog/articulos/:aid/borrar', (req, res) => {
    const back = `/admin/clientes/${req.client.id}/blog?sitio=${req.sitio.id}&ok=Artículo borrado`;
    blog.borrarArticulo(req.articulo.id);
    res.redirect(303, back);
  });

  // Borrar todos los posts con error o rechazados de un cliente.
  admin.post('/clientes/:cid/limpiar', (req, res) => {
    const ps = db.listPosts({ clientId: req.client.id, statuses: pipe.DELETABLE, limit: 1000 });
    ps.forEach((p) => pipe.deletePost(p.id));
    res.redirect(`/admin/clientes/${req.client.id}?tab=posts&f=descartados&ok=${encodeURIComponent(`${ps.length} posts eliminados`)}`);
  });
  admin.post('/clientes/:cid', (req, res) => {
    try {
      const data = parseClientForm(req.body, db.clientCredentials(req.client));
      if (req.client.config.plan) data.config.plan = req.client.config.plan; // el plan se edita en su propia tarjeta
      db.updateClient(req.client.id, { ...data, activo: req.body.activo === '1' });
      pipe.resetKeywordPause(req.client.id);
      res.redirect(`/admin/clientes/${req.client.id}?tab=config&ok=Guardado`);
    } catch (e) {
      res.status(400).send(clientView(req.client, e.message, undefined, undefined, { tab: 'config' }));
    }
  });
  // ------------------------------------------------------------ agente de ventas (prospección)
  const ventasUrl = (c, msg, error) => `/admin/clientes/${c.id}?tab=ventas&${error ? 'error' : 'ok'}=${encodeURIComponent(msg)}`;
  admin.post('/clientes/:cid/ventas/buscar', async (req, res) => {
    try {
      const r = await prospeccion.buscar(req.client, { giro: req.body.giro, ciudad: req.body.ciudad, cuantas: Number(req.body.cuantas) || 20 });
      res.redirect(ventasUrl(req.client, `Encontré ${r.encontradas} negocios; ${r.nuevas} nuevos con teléfono quedaron en la lista.`));
    } catch (e) { res.redirect(ventasUrl(req.client, e.message, true)); }
  });
  admin.post('/clientes/:cid/ventas/importar', (req, res) => {
    const r = prospeccion.importar(req.client, req.body.lista);
    const msg = `${r.nuevas} empresas nuevas en la lista${r.repetidas ? `, ${r.repetidas} ya estaban` : ''}${r.invalidas.length ? `. Sin empresa o teléfono válido: ${r.invalidas.slice(0, 3).join(' / ')}${r.invalidas.length > 3 ? '…' : ''}` : ''}.`;
    res.redirect(ventasUrl(req.client, msg, !r.nuevas && r.invalidas.length > 0));
  });
  admin.post('/clientes/:cid/ventas/repep', (req, res) => {
    const r = prospeccion.aplicarRepep(req.client.id, req.body.numeros);
    seg.auditar(req, 'repep_revisado', `${req.client.nombre}: ${r.bloqueados} en REPEP, ${r.revisados} revisados`);
    res.redirect(ventasUrl(req.client, `Listo: ${r.bloqueados} pasaron a "No llamar" y ${r.revisados} quedaron revisados y listos para llamar.`));
  });
  admin.post('/clientes/:cid/ventas/activo', (req, res) => {
    prospeccion.setActivo(req.client.id, req.body.on === '1');
    seg.auditar(req, 'ventas_llamadas', `${req.client.nombre}: ${req.body.on === '1' ? 'activas' : 'en pausa'}`);
    res.redirect(ventasUrl(req.client, req.body.on === '1' ? 'Llamadas automáticas activadas.' : 'Llamadas automáticas en pausa.'));
  });
  admin.post('/clientes/:cid/ventas/:pid', (req, res) => {
    try {
      if (req.body.accion === 'borrar') prospeccion.borrar(req.client.id, Number(req.params.pid));
      else prospeccion.marcar(req.client.id, Number(req.params.pid), String(req.body.estado));
      res.redirect(`/admin/clientes/${req.client.id}?tab=ventas`);
    } catch (e) { res.redirect(ventasUrl(req.client, e.message, true)); }
  });
  admin.post('/clientes/:cid/plan', (req, res) => {
    try {
      const b = req.body, num = (v, d) => (Number.isFinite(Number(v)) && v !== '' ? Math.max(0, Number(v)) : d);
      const actual = plan.planDe(req.client);
      const nuevo = {
        servicios: Object.fromEntries(Object.keys(plan.SERVICIOS).map((k) => [k, b[`servicio_${k}`] === '1'])),
        posts_semana: num(b.posts_semana, actual.posts_semana), extra_gratis_mes: num(b.extra_gratis_mes, actual.extra_gratis_mes), precio_extra: num(b.precio_extra, actual.precio_extra),
        conceptos: plan.parseConceptos(b.conceptos),
        cobro: plan.COBROS[b.cobro] ? b.cobro : 'stripe',
        prueba_hasta: /^\d{4}-\d{2}-\d{2}$/.test(b.prueba_hasta || '') ? b.prueba_hasta : '',
        iva: plan.IVAS[b.iva] ? b.iva : plan.ivaDe(req.client),
      };
      db.updateClient(req.client.id, { config: { ...req.client.config, plan: nuevo } });
      seg.auditar(req, 'plan_actualizado', req.client.nombre);
      db.logEvent({ clientId: req.client.id, tipo: 'plan_actualizado', detalle: Object.entries(nuevo.servicios).filter(([, v]) => v).map(([k]) => k).join(', ') });
      res.redirect(`/admin/clientes/${req.client.id}?tab=config&ok=Plan guardado`);
    } catch (e) {
      res.status(400).send(clientView(req.client, e.message, undefined, undefined, { tab: 'config' }));
    }
  });
  admin.post('/clientes/:cid/probar', async (req, res) => {
    const r = await checkConnections(db.clientCredentials(req.client));
    const ok = r.filter((x) => x.ok).map((x) => x.texto).join(' · ');
    const bad = r.filter((x) => !x.ok).map((x) => x.texto).join(' · ');
    res.send(clientView(req.client, bad || undefined, ok || undefined, undefined, { tab: 'config' }));
  });
  // TikTok: el cliente (o la agencia con su sesión) autoriza la app de la agencia.
  admin.get('/clientes/:cid/tiktok/conectar', (req, res) => {
    if (!tiktokConfigured()) return res.status(400).send(clientView(req.client, 'Falta TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET en el .env del servidor.'));
    res.redirect(tiktokAuthUrl(sign(`tiktok:${req.client.id}:${Date.now() + 15 * 60_000}`)));
  });
  admin.post('/clientes/:cid/tiktok/desconectar', async (req, res) => {
    const creds = db.clientCredentials(req.client);
    let aviso = 'TikTok desconectado. Al volver a conectar, TikTok pedirá iniciar sesión y autorizar de nuevo.';
    try { await revokeTikTok(creds.tiktok); } catch (e) { aviso += ` (${e.message}; se borró de todos modos)`; }
    const { tiktok, ...rest } = creds;
    db.updateClient(req.client.id, { credentials: rest });
    db.logEvent({ clientId: req.client.id, tipo: 'tiktok_desconectado', detalle: '' });
    res.send(clientView(db.getClient(req.client.id), undefined, aviso, undefined, { tab: 'config' }));
  });
  admin.post('/clientes/:cid/aviso-prueba', async (req, res) => {
    const to = String(req.body.to || req.client.config.notificaciones?.email || '').trim();
    try {
      if (!to) throw new Error('Pon un correo para la prueba o configura "notificaciones": { "email": "…" }.');
      const n = await sendTestDigest(req.client, to);
      res.send(clientView(req.client, undefined, `Correo de prueba enviado a ${to} (${n} posts).`, undefined, { tab: 'config' }));
    } catch (e) {
      res.status(400).send(clientView(req.client, `Correo de prueba: ${e.message}`, undefined, undefined, { tab: 'config' }));
    }
  });
  admin.post('/clientes/:cid/llave-api', (req, res) => {
    const creds = db.clientCredentials(req.client);
    db.updateClient(req.client.id, { credentials: { ...creds, api_key: randomToken(24) } });
    seg.auditar(req, 'llave_api_generada', req.client.nombre);
    res.redirect(`/admin/clientes/${req.client.id}?tab=config&ok=Llave%20nueva%20generada`);
  });
  chatRoutes(admin, (req) => `/admin/clientes/${req.client.id}`, { prefix: '/clientes/:cid' });
  embudoRoutes(admin, (req) => `/admin/clientes/${req.client.id}`, { prefix: '/clientes/:cid' });
  // Importar contactos de Leadsales (CSV): primero vista previa, después se confirma. Solo administradores.
  const subirCsv = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
  const dirImport = () => { const d = path.join(config.dataDir, 'importaciones'); fs.mkdirSync(d, { recursive: true }); return d; };
  admin.get('/clientes/:cid/importar', (req, res) => res.send(V.importarPage(req.client, {})));
  admin.post('/clientes/:cid/importar', (req, res, next) => subirCsv.single('archivo')(req, res, (e) => (e ? res.status(400).send(V.importarPage(req.client, { error: e.message })) : next())), (req, res) => {
    try {
      if (!req.file) throw new Error('Sube el archivo CSV que exportaste de Leadsales.');
      const texto = req.file.buffer.toString('utf8');
      const leido = importar.leerContactos(texto, req.client);
      const token = randomToken(12);
      fs.writeFileSync(path.join(dirImport(), `${req.client.id}-${token}.csv`), texto);
      res.send(V.importarPage(req.client, { leido, token }));
    } catch (e) { res.status(400).send(V.importarPage(req.client, { error: e.message })); }
  });
  admin.post('/clientes/:cid/importar/confirmar', (req, res) => {
    const token = String(req.body.token || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const archivo = path.join(dirImport(), `${req.client.id}-${token}.csv`);
    try {
      if (!token || !fs.existsSync(archivo)) throw new Error('La vista previa venció. Sube el archivo otra vez.');
      const r = importar.importar(req.client, importar.leerContactos(fs.readFileSync(archivo, 'utf8'), req.client));
      fs.rmSync(archivo, { force: true }); // el CSV no se queda en el servidor
      seg.auditar(req, 'importacion_contactos', `${req.client.nombre}: ${r.nuevos} nuevos, ${r.actualizados} actualizados`);
      res.redirect(`/admin/clientes/${req.client.id}/embudo?ok=1&importados=${r.nuevos + r.actualizados}`);
    } catch (e) { res.status(400).send(V.importarPage(req.client, { error: e.message })); }
  });
  conocimientoRoutes(admin, (req) => `/admin/clientes/${req.client.id}`, { prefix: '/clientes/:cid' });
  admin.post('/clientes/:cid/agente-url', (req, res) => {
    const raw = String(req.body.agente_url || '').trim().replace(/\/+$/, '');
    if (raw && !/^https:\/\/[a-z0-9.-]+(:\d+)?(\/[\w.-]*)*$/i.test(raw)) return res.status(400).send(clientView(req.client, 'La URL del agente debe empezar con https:// (ej. https://agente.kuper.mx)', undefined, undefined, { tab: 'config' }));
    db.updateClient(req.client.id, { credentials: { ...db.clientCredentials(req.client), agente_url: raw || undefined } });
    db.logEvent({ clientId: req.client.id, tipo: 'agente_url', detalle: raw || '(quitada)' });
    res.redirect(`/admin/clientes/${req.client.id}?tab=config&ok=URL del agente guardada`);
  });
  admin.get('/clientes/:cid/leads.csv', (req, res) => enviarCsv(req, res));
  // RFC de un cliente que ya está dado de alta en Factura.com (no hace falta que capture todo lo demás).
  admin.post('/clientes/:cid/rfc', (req, res) => {
    const rfc = String(req.body.rfc || '').toUpperCase().replace(/[\s-]/g, '');
    if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) return res.redirect(303, `/admin/clientes/${req.client.id}?tab=config&error=${encodeURIComponent('El RFC no es válido.')}`);
    const fiscal = req.client.config.fiscal || {};
    db.updateClient(req.client.id, { config: { ...req.client.config, fiscal: { ...(fiscal.rfc === rfc ? fiscal : {}), rfc, actualizado: new Date().toISOString() } } });
    seg.auditar(req, 'rfc_cliente', rfc);
    res.redirect(303, `/admin/clientes/${req.client.id}?tab=config&ok=${encodeURIComponent('RFC guardado')}`);
  });
  admin.post('/clientes/:cid/requiere-factura', (req, res) => {
    const sin = req.body.requiere !== '1';
    db.updateClient(req.client.id, { config: { ...req.client.config, sin_factura: sin } });
    seg.auditar(req, 'requiere_factura', sin ? 'no' : 'sí');
    res.redirect(303, `/admin/clientes/${req.client.id}?tab=config&ok=${encodeURIComponent(sin ? 'Este cliente no se factura' : 'Este cliente sí se factura')}`);
  });
  admin.get('/facturacion', async (req, res) => {
    let series = [], seriesError = '';
    if (facturacion.conectado()) { try { series = await facturacion.series(); } catch (e) { seriesError = e.message; } }
    res.send(V.facturacionPage({ ajustes: facturacion.ajustes(), conectado: facturacion.conectado(), sandbox: config.facturacom.sandbox, series, seriesError, facturas: facturacion.listar(), ok: String(req.query.ok || '').slice(0, 200), error: String(req.query.error || '').slice(0, 300) }));
  });
  admin.post('/facturacion', (req, res) => {
    try { facturacion.guardarAjustes(req.body || {}); res.redirect(303, '/admin/facturacion?ok=Ajustes guardados'); }
    catch (e) { res.redirect(303, `/admin/facturacion?error=${encodeURIComponent(e.message)}`); }
  });
  admin.post('/facturacion/reintentar', async (req, res) => {
    const n = await reintentarFacturas().catch(() => 0);
    res.redirect(303, `/admin/facturacion?ok=${encodeURIComponent(`${n} factura(s) reintentadas`)}`);
  });
  admin.get('/facturacion/:fid/:tipo', async (req, res) => {
    const fac = facturacion.listar({ limit: 100000 }).find((f) => f.id === Number(req.params.fid));
    try { await enviarArchivoFactura(res, fac, req.params.tipo); } catch (e) { res.status(404).send(e.message); }
  });
  admin.post('/clientes/:cid/leads/:leadId', (req, res) => {
    db.setLeadEstado(req.client.id, Number(req.params.leadId), String(req.body.estado));
    res.redirect(`/admin/clientes/${req.client.id}?tab=leads`);
  });
  admin.post('/clientes/:cid/rotar-token', (req, res) => { db.rotatePortalToken(req.client.id); res.redirect(`/admin/clientes/${req.client.id}`); });
  admin.post('/clientes/:cid/logo', upload.single('archivo'), (req, res) => {
    if (req.file) db.updateClient(req.client.id, { logo_path: req.file.path });
    res.redirect(`/admin/clientes/${req.client.id}?tab=config`);
  });
  admin.post('/clientes/:cid/mascota', upload.single('archivo'), (req, res) => {
    const cfg = { ...req.client.config };
    if (req.body?.quitar) delete cfg.mascota_path;
    else if (req.file) cfg.mascota_path = req.file.path;
    db.updateClient(req.client.id, { config: cfg });
    res.redirect(`/admin/clientes/${req.client.id}?tab=config`);
  });
  admin.post('/clientes/:cid/paletas', (req, res) => {
    db.updateClient(req.client.id, { perfil: { ...req.client.perfil, paletas: parsePaletas(req.body.paletas) } });
    res.redirect(`/admin/clientes/${req.client.id}?tab=config`);
  });
  admin.post('/clientes/:cid/vetados', (req, res) => {
    const vetados = [...new Set(String(req.body.vetados || '').split(/\r?\n/).map((s) => s.trim().slice(0, 80)).filter(Boolean))].slice(0, 40);
    db.updateClient(req.client.id, { perfil: { ...req.client.perfil, temas_vetados: vetados } });
    res.redirect(`/admin/clientes/${req.client.id}?tab=config`);
  });
  admin.post('/clientes/:cid/competencia', (req, res) => {
    db.addCompetitor(req.client.id, req.body.handle, 'instagram', req.body.notas || '');
    res.redirect(`/admin/clientes/${req.client.id}?tab=competencia`);
  });
  admin.post('/clientes/:cid/competencia/:compId/borrar', (req, res) => {
    db.deleteCompetitor(req.client.id, Number(req.params.compId));
    res.redirect(`/admin/clientes/${req.client.id}?tab=competencia`);
  });
  admin.post('/clientes/:cid/analizar', async (req, res) => {
    try {
      await pipe.runCompetitorAnalysis(req.client.id);
      res.redirect(`/admin/clientes/${req.client.id}?tab=competencia`);
    } catch (e) {
      res.status(400).send(clientView(req.client, `Análisis de competencia: ${e.message}`, undefined, undefined, { tab: 'competencia' }));
    }
  });
  admin.post('/clientes/:cid/generar', (req, res) => {
    const plataforma = req.body.plataforma, tema = String(req.body.tema || '').trim().slice(0, 400);
    pipe.enqueue(`gen-${req.client.id}-${plataforma}-${Date.now()}`, () =>
      pipe.generateForPlatform(req.client.id, plataforma, { force: true, tema }).catch(() => {}));
    res.redirect(`/admin/clientes/${req.client.id}`);
  });

  admin.post('/clientes/:cid/temas/:i/quitar', (req, res) => { pipe.quitarTema(req.client.id, Number(req.params.i)); res.redirect(`/admin/clientes/${req.client.id}`); });

  admin.param('pid', (req, res, next, id) => {
    req.post = db.getPost(Number(id));
    return req.post ? next() : res.status(404).send('Post no encontrado');
  });
  admin.get('/posts/:pid', async (req, res) => {
    const client = db.getClient(req.post.client_id);
    await withTikTokInfo(client, [req.post]);
    res.send(V.postAdminPage(req.post, client, db.postEvents(req.post.id)));
  });
  // Publicar puede tardar minutos (Instagram procesa el video): se hace en segundo plano y la página
  // se recarga sola mientras dice "Publicando". Si no, el proxy corta la espera y muestra 502.
  admin.post('/posts/:pid/publicar', (req, res) => {
    const id = req.post.id;
    pipe.publishOne(id).catch((e) => console.error('[publicar]', id, e.message));
    res.redirect(303, `/admin/posts/${id}`);
  });
  // Regresa a la página desde donde se picó el botón (solo rutas del admin de este mismo sitio).
  const volverA = (req, otro) => { try { const u = new URL(req.get('referer') || ''); return u.host === req.get('host') && u.pathname.startsWith('/admin/') ? u.pathname + u.search : otro; } catch { return otro; } };
  admin.post('/posts/:pid/marcar-publicado', (req, res) => {
    const id = req.post.id;
    if (db.transitionPost(id, ['error'], 'publicado')) {
      db.updatePost(id, { published_at: new Date().toISOString(), error: null });
      db.logEvent({ postId: id, clientId: req.post.client_id, tipo: 'marcado_publicado', detalle: 'Ya había salido en la red (marcado a mano)' });
    }
    res.redirect(303, volverA(req, `/admin/posts/${id}`));
  });
  admin.post('/posts/:pid/historia', (req, res) => {
    const id = req.post.id;
    pipe.publishStoryOf(id).catch(() => {});
    res.redirect(303, volverA(req, `/admin/posts/${id}`));
  });
  admin.post('/posts/:pid/eliminar', (req, res) => {
    const cid = req.post.client_id;
    pipe.deletePost(req.post.id);
    res.redirect(`/admin/clientes/${cid}?tab=posts&f=descartados&ok=Post%20eliminado`);
  });
  postActions(admin, (req) => `/admin/posts/${req.post.id}`);
  app.use('/admin', admin);

  // ------------------------------------------------------------ página pública para agendar
  // /agendar/<slug>?n=Nombre&tel=52155...  (el agente de WhatsApp manda este link en un botón)
  const bookingClient = (req, res) => {
    const c = db.listClients().find((x) => x.slug === req.params.slug);
    if (!c || !agenda.agendaCfg(c).calendar_id || c.config.agenda?.publica === false) { res.status(404).send('Página no encontrada'); return null; }
    res.setHeader('X-Robots-Tag', 'noindex'); res.setHeader('Referrer-Policy', 'no-referrer');
    return c;
  };
  const intentos = new Map(); // ip -> [ts] (máx. 6 reservas por hora por IP)
  const limitado = (ip) => {
    const t = Date.now(), list = (intentos.get(ip) || []).filter((x) => t - x < 3600_000);
    intentos.set(ip, list);
    if (list.length >= 6) return true;
    list.push(t); return false;
  };
  const bookingView = async (c, form = {}, error = '') => {
    let slots = [];
    try { slots = await agenda.availability(c, { dias: 14 }); } catch (e) { console.error('[agendar]', e.message); error ||= 'No pudimos cargar los horarios. Intenta en unos minutos.'; }
    return V.bookingPage(c, { slots, form, error, duracion: agenda.agendaCfg(c).duracion_min });
  };
  app.get('/agendar/:slug', async (req, res) => {
    const c = bookingClient(req, res); if (!c) return;
    res.send(await bookingView(c, { nombre: String(req.query.n || '').slice(0, 80), telefono: String(req.query.tel || '').replace(/[^\d+]/g, '').slice(0, 20) }));
  });
  app.post('/agendar/:slug', async (req, res) => {
    const c = bookingClient(req, res); if (!c) return;
    const form = { inicio: String(req.body.inicio || ''), nombre: String(req.body.nombre || '').trim().slice(0, 80), telefono: String(req.body.telefono || '').trim().slice(0, 20), motivo: String(req.body.motivo || '').trim().slice(0, 200) };
    if (req.body.sitio) return res.status(400).send('Solicitud no válida');
    const digits = form.telefono.replace(/\D/g, '');
    if (!form.nombre || digits.length < 8 || digits.length > 15) return res.status(400).send(await bookingView(c, form, 'Escribe tu nombre y un número de WhatsApp válido.'));
    const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    if (limitado(ip)) return res.status(429).send(await bookingView(c, form, 'Demasiados intentos. Intenta más tarde o escríbenos por WhatsApp.'));
    const telefono = `+${digits.length === 10 ? `52${digits}` : digits}`;
    try {
      const cita = await agenda.book(c, { inicio: form.inicio, nombre: form.nombre, telefono, motivo: [form.motivo, 'Agendada desde la página de citas'].filter(Boolean).join(' · ') });
      db.upsertLead(c.id, { nombre: form.nombre, telefono, origen: 'web', estado: 'cita', cita_inicio: cita.inicio, cita_evento: cita.id });
      db.logEvent({ clientId: c.id, tipo: 'cita_agendada', detalle: `${form.nombre} ${cita.inicio} (página)` });
      res.send(V.bookingDone(c, cita, agenda.agendaCfg(c).link_reunion));
    } catch (e) {
      const msg = e instanceof agenda.SlotTaken ? 'Ese horario se acaba de ocupar. Elige otro, por favor.' : 'No pudimos agendar. Intenta de nuevo en unos minutos.';
      if (!(e instanceof agenda.SlotTaken)) console.error('[agendar]', e.message);
      res.status(409).send(await bookingView(c, { ...form, inicio: '' }, msg));
    }
  });

  // ------------------------------------------------------------ portal del cliente
  const portal = express.Router({ mergeParams: true });
  portal.use((req, res, next) => {
    req.client = db.getClientByToken(req.params.token);
    if (!req.client) return res.status(404).send('Enlace no válido');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex');
    next();
  });
  portal.get('/', async (req, res) => {
    const posts = await withTikTokInfo(req.client, db.listPosts({ clientId: req.client.id, limit: 100 }).filter((p) => !['rechazado', 'error_generacion'].includes(p.status)));
    res.send(V.portalPage(req.client, posts, req.params.token, String(req.query.t || '')));
  });
  portal.get('/reporte', (req, res) => {
    const mes = /^\d{4}-\d{2}$/.test(req.query.mes || '') ? req.query.mes : metricas.mesAnterior();
    res.send(reportePage(req.client, metricas.resumenMes(req.client, mes), { base: `/p/${req.params.token}/reporte?`, meses: metricas.ultimosMeses(), publico: true }));
  });
  portal.param('pid', (req, res, next, id) => {
    req.post = db.getPost(Number(id));
    return req.post && req.post.client_id === req.client.id ? next() : res.status(404).send('Post no encontrado');
  });
  postActions(portal, (req) => `/p/${req.params.token}#post-${req.post.id}`);
  app.use('/p/:token', portal);

  // Error genérico legible.
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(400).send(`<p style="font-family:system-ui;padding:24px">${String(err.message).replace(/</g, '&lt;')}</p><p style="font-family:system-ui;padding:0 24px"><a href="javascript:history.back()">Volver</a></p>`);
  });
  return app;

  // Acciones sobre un post (las comparten admin y portal).
  // Conversación de un lead: ver, responder a mano y tomar/devolver el control (admin y cliente).
  function chatRoutes(router, base, { app = false, prefix = '' } = {}) {
    const leadDe = (req, res) => { const l = db.getLead(req.client.id, Number(req.params.leadId)); if (!l) res.status(404).send('Lead no encontrado'); return l; };
    const ver = async (req, res, extra = {}) => {
      const lead = leadDe(req, res); if (!lead) return;
      let estado = null;
      if (agente.agenteConfigurado(req.client)) estado = await agente.llamarAgente(req.client, 'POST', '/estado', agente.identidad(lead), { timeout: 4000 }).catch(() => null);
      const b = `${base(req)}/leads/${lead.id}`;
      const opts = { base: b, puedeResponder: agente.agenteConfigurado(req.client), estado, ficha: fichaLead(req.client, lead, { base: b, asesores: embudo.asesores(req.client) }), ...extra };
      res.status(extra.error ? 400 : 200).send(app ? V.appChatPage(req.client, lead, db.leadMessages(lead.id), opts) : V.leadChatPage(req.client, lead, db.leadMessages(lead.id), opts));
    };
    router.get(`${prefix}/leads/:leadId/chat`, (req, res) => ver(req, res));
    router.get(`${prefix}/leads/:leadId/chat.json`, (req, res) => {
      const lead = db.getLead(req.client.id, Number(req.params.leadId));
      if (!lead) return res.status(404).json({});
      res.json({ html: V.chatBurbujas(db.leadMessages(lead.id)), control: lead.control });
    });
    router.post(`${prefix}/leads/:leadId/responder`, async (req, res) => {
      const lead = leadDe(req, res); if (!lead) return;
      const texto = String(req.body.texto || '').trim().slice(0, 4000);
      if (!texto) return res.redirect(`${base(req)}/leads/${lead.id}/chat`);
      const autor = req.sesion?.user?.nombre || 'Equipo Kuper';
      try {
        await agente.llamarAgente(req.client, 'POST', '/enviar', { ...agente.identidad(lead), texto, autor });
        db.upsertLead(req.client.id, { ...agente.identidad(lead), control: 'humano' });
        db.logEvent({ clientId: req.client.id, tipo: 'respuesta_manual', detalle: `${autor} → ${lead.nombre || lead.telefono || lead.usuario}` });
        res.redirect(`${base(req)}/leads/${lead.id}/chat`);
      } catch (e) { await ver(req, res, { error: e.message, borrador: texto }); }
    });
    router.post(`${prefix}/leads/:leadId/ficha`, async (req, res) => {
      const lead = leadDe(req, res); if (!lead) return;
      try {
        embudo.guardarFicha(req.client, lead.id, req.body || {});
        db.logEvent({ clientId: req.client.id, tipo: 'ficha_lead', detalle: `${req.sesion?.user?.nombre || 'Kuper'} · ${lead.nombre || lead.telefono || lead.usuario || lead.id}` });
        await ver(req, res, { ok: 'Datos guardados.' });
      } catch (e) { await ver(req, res, { error: e.message }); }
    });
    router.post(`${prefix}/leads/:leadId/control`, async (req, res) => {
      const lead = leadDe(req, res); if (!lead) return;
      const humano = req.body.humano === '1';
      try {
        await agente.llamarAgente(req.client, 'POST', '/control', { ...agente.identidad(lead), humano });
        db.upsertLead(req.client.id, { ...agente.identidad(lead), control: humano ? 'humano' : 'bot' });
        res.redirect(`${base(req)}/leads/${lead.id}/chat`);
      } catch (e) { await ver(req, res, { error: e.message }); }
    });
  }

  // Embudo de ventas y analítica (admin y cliente).
  function embudoRoutes(router, base, { app = false, prefix = '' } = {}) {
    const leadsDe = (c) => db.listLeads(c.id, { limit: 20000 });
    const verEmbudo = (req, res, extra = {}) => {
      const f = (k, n = 40) => String(req.query[k] || '').slice(0, n);
      const opts = { asesores: embudo.asesores(req.client), embudo: f('e'), ultimos: db.ultimosMensajes(req.client.id), importar: !app,
        filtros: { q: f('q', 80), asesor: f('asesor'), canal: f('canal'), estatus: f('estatus'), mensajes: f('mensajes'), fecha: f('fecha'), desde: f('desde', 10), hasta: f('hasta', 10) },
        vista: f('vista') === 'extendida' ? 'extendida' : 'compacta', ...extra };
      res.status(extra.error ? 400 : 200).send(app ? V.appEmbudoPage(req.client, leadsDe(req.client), opts) : V.adminEmbudoPage(req.client, leadsDe(req.client), opts));
    };
    router.get(`${prefix}/embudo`, (req, res) => verEmbudo(req, res, { aviso: req.query.importados ? `Listo: ${Number(req.query.importados).toLocaleString('es-MX')} contactos importados.`
      : req.query.nuevo ? 'Lead agregado.' : req.query.existe ? 'Ese contacto ya existía: lo moví a la etapa que elegiste.' : req.query.ok ? 'Etapas guardadas.' : '' }));
    router.post(`${prefix}/embudo/resultado`, (req, res) => {
      try {
        const l = embudo.marcarResultado(req.client, Number(req.body.lead), String(req.body.resultado || ''), req.body.valor, { mover: req.body.mover !== '0' });
        db.logEvent({ clientId: req.client.id, tipo: 'resultado_lead', detalle: `${l.nombre || l.telefono || l.id}: ${req.body.resultado}${l.valor ? ` $${l.valor}` : ''}` });
        res.json({ ok: true, etapa: l.etapa });
      } catch (e) { res.status(400).json({ error: e.message }); }
    });
    // Menú de cada columna (renombrar, agregar etapa, tipo, estancado, al entrar, eliminar).
    router.post(`${prefix}/embudo/etapa`, (req, res) => {
      try {
        const b = req.body || {};
        embudo.editarEtapa(req.client, String(b.embudo || ''), String(b.etapa || ''), String(b.accion || ''), b.valor);
        db.logEvent({ clientId: req.client.id, tipo: 'embudo_etapa', detalle: `${b.accion} ${b.etapa}${b.valor ? `: ${String(b.valor).slice(0, 40)}` : ''}` });
        res.json({ ok: true });
      } catch (e) { res.status(400).json({ error: e.message }); }
    });
    // Varios leads a la vez (seleccionar leads).
    router.post(`${prefix}/embudo/masivo`, (req, res) => {
      try { res.json({ ok: true, n: embudo.accionMasiva(req.client, String(req.body.ids || '').split(','), req.body || {}) }); }
      catch (e) { res.status(400).json({ error: e.message }); }
    });
    // Agregar un lead a mano (nombre, teléfono con lada y a qué embudo/etapa).
    router.post(`${prefix}/embudo/nuevo`, (req, res) => {
      try {
        const r = embudo.agregarLead(req.client, req.body || {}, req.sesion?.user?.nombre || 'Kuper');
        res.redirect(`${base(req)}/embudo?e=${encodeURIComponent(r.embudo)}&${r.existia ? 'existe' : 'nuevo'}=1`);
      } catch (e) { verEmbudo(req, res, { error: e.message, aviso: '' }); }
    });
    router.post(`${prefix}/embudo/mover`, (req, res) => {
      try { const l = embudo.moverLead(req.client, Number(req.body.lead), String(req.body.etapa || ''), req.body.embudo ? String(req.body.embudo) : undefined); res.json({ ok: true, etapa: l.etapa }); }
      catch (e) { res.status(400).json({ error: e.message }); }
    });
    router.post(`${prefix}/embudo/etapas`, (req, res) => {
      try {
        const lista = embudo.parseEmbudos(req.body.etapas, embudo.embudos(req.client));
        const { embudo: _viejo, ...resto } = req.client.config;
        db.updateClient(req.client.id, { config: { ...resto, embudos: lista } });
        db.logEvent({ clientId: req.client.id, tipo: 'embudo_etapas', detalle: lista.map((e) => `${e.nombre}: ${e.etapas.map((x) => x.nombre).join(' › ')}`).join(' | ') });
        res.redirect(`${base(req)}/embudo?ok=1`);
      } catch (e) { res.status(400).send(`<!doctype html><meta charset="utf-8"><p style="font-family:sans-serif">${String(e.message).replace(/</g, '&lt;')} <a href="${base(req)}/embudo">Volver</a></p>`); }
    });
    router.get(`${prefix}/analitica`, (req, res) => {
      const dias = [7, 30, 90].includes(Number(req.query.dias)) ? Number(req.query.dias) : 30;
      const a = embudo.analitica(req.client, { dias });
      res.send(app ? V.appAnaliticaPage(req.client, a) : V.adminAnaliticaPage(req.client, a));
    });
  }

  // Editor de lo que sabe el agente (admin y cliente).
  function conocimientoRoutes(router, base, { app = false, prefix = '' } = {}) {
    const vista = (req, res, extra = {}) => res.status(extra.error ? 400 : 200).send(V.conocimientoPage(req.client, conoc.actual(req.client.id), conoc.versiones(req.client.id), { base: base(req), app, ...extra }));
    router.get(`${prefix}/agente`, (req, res) => vista(req, res, { ok: req.query.aviso ? String(req.query.aviso).slice(0, 300) : req.query.ok ? 'Guardado. Tu agente lo usa desde su siguiente respuesta.' : '' }));
    router.post(`${prefix}/agente`, (req, res) => {
      const datos = Object.fromEntries(Object.keys(conoc.CAMPOS).map((k) => [k, req.body[`dato_${k}`]]));
      try { conoc.guardar(req.client.id, { texto: req.body.texto, datos }, req.sesion?.user?.nombre || 'Kuper'); res.redirect(`${base(req)}/agente?ok=1`); }
      catch (e) { vista(req, res, { error: e.message, borrador: { texto: req.body.texto, datos } }); }
    });
    // Pausar o reanudar el agente: se guarda aquí (el agente lo lee cada 5 min) y se le avisa al momento.
    router.post(`${prefix}/agente/pausa`, async (req, res) => {
      const pausado = req.body.pausado === '1';
      const autor = req.sesion?.user?.nombre || 'Kuper';
      db.updateClient(req.client.id, { config: { ...req.client.config, agente_pausado: pausado } });
      db.logEvent({ clientId: req.client.id, tipo: pausado ? 'agente_pausado' : 'agente_reanudado', detalle: autor });
      seg.auditar(req, pausado ? 'agente_pausado' : 'agente_reanudado', req.client.nombre);
      let aviso = pausado ? 'Agente en pausa: ya no contesta ni manda seguimientos. Los mensajes siguen llegando aquí.' : 'Agente activo otra vez.';
      if (agente.agenteConfigurado(req.client)) {
        try {
          const r = await agente.llamarAgente(req.client, 'POST', '/pausa', { pausado, autor }, { timeout: 6000 });
          if (!pausado && r?.por_env) aviso = 'Lo reanudé aquí, pero el agente sigue en pausa desde el servidor (AGENTE_PAUSADO=1 en su .env). Kuper tiene que quitarlo.';
        } catch { aviso += ' (El agente lo toma en los próximos 5 minutos.)'; }
      } else aviso += ' (El agente lo toma en los próximos 5 minutos.)';
      res.redirect(`${base(req)}/agente?aviso=${encodeURIComponent(aviso)}`);
    });
    router.post(`${prefix}/agente/horario`, (req, res) => {
      try {
        const c = embudo.guardarHorario(req.client, req.body || {});
        db.logEvent({ clientId: c.id, tipo: 'horario_ia', detalle: `${embudo.MODOS_IA[c.config.ia_modo]} · equipo ${c.config.horario_equipo.de}-${c.config.horario_equipo.a}` });
        res.redirect(`${base(req)}/agente?ok=1`);
      } catch (e) { vista(req, res, { error: e.message }); }
    });
    // Archivos que el agente puede mandar por WhatsApp (brochure, catálogo, menú…).
    router.post(`${prefix}/agente/archivos`, (req, res, next) => uploadDoc.single('archivo')(req, res, (e) => (e ? vista(req, res, { error: e.message }) : next())), (req, res) => {
      if (!req.file) return vista(req, res, { error: 'Sube un PDF, una imagen (JPG/PNG) o un video MP4.' });
      if (req.file.mimetype === 'application/pdf' && req.file.size > 16 * 1024 * 1024) { fs.rmSync(req.file.path, { force: true }); return vista(req, res, { error: 'El PDF pesa más de 16 MB, el máximo de WhatsApp. Compártelo más ligero.' }); }
      const lista = Array.isArray(req.client.config.archivos_agente) ? req.client.config.archivos_agente : [];
      if (lista.length >= 15) { fs.rmSync(req.file.path, { force: true }); return vista(req, res, { error: 'Máximo 15 archivos. Quita alguno antes.' }); }
      const nombre = String(req.body.nombre || '').trim().slice(0, 60) || 'Archivo';
      const tipo = req.file.mimetype === 'application/pdf' ? 'document' : req.file.mimetype.startsWith('video/') ? 'video' : 'image';
      const nuevo = { id: randomToken(6), nombre, cuando: String(req.body.cuando || '').trim().slice(0, 160), archivo: req.file.path, tipo, original: String(req.file.originalname || '').slice(0, 120), subido: new Date().toISOString() };
      db.updateClient(req.client.id, { config: { ...req.client.config, archivos_agente: [...lista, nuevo] } });
      db.logEvent({ clientId: req.client.id, tipo: 'archivo_agente', detalle: nombre });
      res.redirect(`${base(req)}/agente?ok=1`);
    });
    router.post(`${prefix}/agente/archivos/:fid/borrar`, (req, res) => {
      const lista = Array.isArray(req.client.config.archivos_agente) ? req.client.config.archivos_agente : [];
      const quitado = lista.find((a) => a.id === req.params.fid);
      if (quitado) fs.rmSync(quitado.archivo, { force: true });
      db.updateClient(req.client.id, { config: { ...req.client.config, archivos_agente: lista.filter((a) => a.id !== req.params.fid) } });
      res.redirect(`${base(req)}/agente?ok=1`);
    });
    router.post(`${prefix}/agente/restaurar/:vid`, (req, res) => {
      try { conoc.restaurar(req.client.id, Number(req.params.vid), req.sesion?.user?.nombre || 'Kuper'); res.redirect(`${base(req)}/agente?ok=1`); }
      catch (e) { vista(req, res, { error: e.message }); }
    });
  }

  function postActions(router, back) {
    router.post('/posts/:pid/aprobar', (req, res) => {
      pipe.approvePost(req.post.id, {
        variante: req.body.variante !== undefined ? Number(req.body.variante) : undefined,
        copy: req.body.copy,
        hashtags: req.body.hashtags !== undefined ? req.body.hashtags.split(/\s+/).filter(Boolean).map((h) => (h.startsWith('#') ? h : `#${h}`)) : undefined,
        fecha: req.body.fecha || undefined,
        hora: req.body.hora || undefined,
        tiktok: req.post.plataforma === 'tiktok' ? {
          privacy: req.body.tt_privacy || '',
          allow_comment: req.body.tt_comment === '1', allow_duet: req.body.tt_duet === '1', allow_stitch: req.body.tt_stitch === '1',
          disclose: req.body.tt_disclose === '1', brand_organic: req.body.tt_brand_organic === '1', brand_content: req.body.tt_brand_content === '1',
        } : undefined,
      });
      res.redirect(back(req));
    });
    router.post('/posts/:pid/cambios', (req, res) => { pipe.requestChanges(req.post.id, req.body.comentarios); res.redirect(back(req)); });
    router.post('/posts/:pid/revisar', (req, res) => { pipe.backToReview(req.post.id); res.redirect(back(req)); });
    router.post('/posts/:pid/rechazar', (req, res) => { pipe.rejectPost(req.post.id, req.body.motivo || ''); res.redirect(back(req)); });
    router.post('/posts/:pid/asset', upload.single('archivo'), (req, res) => {
      if (!req.file) throw new Error('Sube una imagen JPG/PNG o un video MP4');
      pipe.attachAsset(req.post.id, req.file.path, req.file.mimetype);
      res.redirect(back(req));
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!config.secretKey) { console.error('Falta SECRET_KEY en el .env'); process.exit(1); }
  fs.mkdirSync(mediaDir(), { recursive: true });
  const app = createApp();
  db.recoverInterrupted();
  // HOST=127.0.0.1 en el servidor: solo nginx/Caddy llega al agente; desde fuera, únicamente por https.
  app.listen(config.port, process.env.HOST || '0.0.0.0', () => {
    console.log(`Agente social en ${config.publicBaseUrl} (puerto ${config.port})${config.dryRun ? ' — DRY_RUN activo' : ''}${config.mockLlm ? ' — MOCK_LLM activo' : ''}`);
    if (config.schedulerEnabled) pipe.startScheduler();
    limpieza.iniciar(); // borra lo pesado que ya no se usa (ver src/limpieza.js)
  });
}
