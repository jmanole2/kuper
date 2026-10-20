// Servidor web: panel de agencia (/admin), portal de aprobación del cliente (/p/:token)
// y archivos de medios públicos (/media) que Instagram/Facebook descargan al publicar.
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config, mediaDir } from './config.js';
import * as db from './db.js';
import * as pipe from './pipeline.js';
import { sign, unsign, safeEqual, randomToken } from './crypto.js';
import { freqDays } from './schedule.js';
import * as V from './web/views.js';
import { checkConnections } from './publishers/check.js';
import { sendTestDigest } from './notify.js';
import * as agenda from './agenda/index.js';
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
  app.use(express.urlencoded({ extended: false, limit: '2mb' }));
  app.use('/media', express.static(mediaDir(), { maxAge: '1h', fallthrough: false }));
  // Tipografía del panel (Inter Tight, la misma de los videos), servida localmente.
  app.use('/fonts', express.static(path.join(path.dirname(fileURLToPath(import.meta.resolve('@fontsource/inter-tight/package.json'))), 'files'), { maxAge: '30d', fallthrough: false }));
  app.get('/', (_req, res) => res.redirect('/admin'));
  app.get('/salud', (_req, res) => res.json({ ok: true }));

  const upload = multer({
    storage: multer.diskStorage({
      destination: mediaDir(),
      filename: (_req, f, cb) => cb(null, `subida-${Date.now()}-${randomToken(6)}${path.extname(f.originalname).toLowerCase() || ''}`),
    }),
    limits: { fileSize: 300 * 1024 * 1024 },
    fileFilter: (_req, f, cb) => cb(null, ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'].includes(f.mimetype)),
  });

  // ------------------------------------------------------------ API para el agente de WhatsApp
  // Autorización: "Authorization: Bearer <llave del cliente>" (se genera en el panel, pestaña Configuración).
  const api = express.Router({ mergeParams: true });
  api.use(express.json({ limit: '100kb' }));
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
  api.post('/leads', (req, res) => {
    try { res.json({ ok: true, lead: db.upsertLead(req.client.id, { ...req.body, origen: req.body?.origen || 'whatsapp' }) }); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.use('/api/:slug', api);

  // ------------------------------------------------------------ sesión admin
  const COOKIE = 'sa_admin';
  const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((x) => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
  const isAdmin = (req) => {
    const v = unsign(cookies(req)[COOKIE]);
    return !!v && Number(v.split(':')[1]) > Date.now();
  };
  const requireAdmin = (req, res, next) => (isAdmin(req) ? next() : res.redirect('/admin/entrar'));

  app.get('/admin/entrar', (_req, res) => res.send(V.loginPage()));
  app.post('/admin/entrar', (req, res) => {
    if (!config.adminPassword) return res.status(500).send(V.loginPage('Configura ADMIN_PASSWORD en el .env'));
    if (!safeEqual(req.body.password || '', config.adminPassword)) return res.status(401).send(V.loginPage('Contraseña incorrecta'));
    const value = sign(`admin:${Date.now() + 12 * 3600_000}`);
    const secure = config.publicBaseUrl.startsWith('https') ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secure}`);
    res.redirect('/admin');
  });
  app.get('/admin/salir', (_req, res) => {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0`);
    res.redirect('/admin/entrar');
  });

  // ------------------------------------------------------------ admin
  const admin = express.Router();
  admin.use(requireAdmin);

  admin.get('/', (_req, res) => {
    const clients = db.listClients();
    const counts = {};
    for (const p of db.listPosts({ limit: 2000 })) {
      if (!['pendiente', 'necesita_asset', 'aprobado', 'publicado', 'error', 'error_generacion'].includes(p.status)) continue;
      (counts[p.client_id] ??= {})[p.status] = (counts[p.client_id][p.status] || 0) + 1;
    }
    res.send(V.dashboardPage(clients, counts, db.recentEvents(40)));
  });

  function parseClientForm(body, existingCreds = {}) {
    let perfil, cfg;
    try { perfil = JSON.parse(body.perfil); } catch (e) { throw new Error(`Perfil de marca: JSON inválido (${e.message})`); }
    try { cfg = JSON.parse(body.config); } catch (e) { throw new Error(`Configuración de redes: JSON inválido (${e.message})`); }
    if (!perfil.cliente || !Array.isArray(perfil.pilares_de_contenido) || !perfil.pilares_de_contenido.length) {
      throw new Error('El perfil necesita "cliente" y al menos un pilar en "pilares_de_contenido".');
    }
    for (const [k, v] of Object.entries(cfg)) {
      if (k === 'respuesta_palabra_clave' || k === 'agenda') continue;
      if (k === 'notificaciones') {
        if (v.email && !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(String(v.email).trim())) throw new Error('notificaciones: "email" no es un correo válido');
        continue;
      }
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
      },
      linkedin: {
        org_id: keep(body.li_org_id, existingCreds.linkedin?.org_id),
        access_token: tok(body.li_access_token, existingCreds.linkedin?.access_token),
      },
      api_key: existingCreds.api_key, // llave del agente de WhatsApp (se genera en el panel)
      tiktok: existingCreds.tiktok, // se conecta con el botón "Conectar TikTok", no desde el formulario
      dry_run: body.dry_run === '1',
    };
    return { nombre: body.nombre.trim(), perfil, config: cfg, credentials };
  }

  admin.get('/clientes/nuevo', (_req, res) => res.send(V.clientFormPage(null)));
  admin.post('/clientes/nuevo', (req, res) => {
    try {
      const c = db.createClient({ slug: req.body.slug, ...parseClientForm(req.body) });
      res.redirect(`/admin/clientes/${c.id}`);
    } catch (e) {
      res.status(400).send(V.clientFormPage(null, { error: e.message }));
    }
  });

  const clientView = (c, error, notice, posts, view = {}) => V.clientFormPage(c, {
    error, notice, ...view, competitors: db.listCompetitors(c.id), report: db.latestCompetitorReport(c.id),
    posts: posts || db.listPosts({ clientId: c.id, limit: 400 }), creds: db.clientCredentials(c), keywordReplies: db.keywordReplies(c.id),
  });

  admin.param('cid', (req, res, next, id) => {
    req.client = db.getClient(Number(id));
    return req.client ? next() : res.status(404).send('Cliente no encontrado');
  });
  admin.get('/clientes/:cid', async (req, res) => {
    const view = { tab: String(req.query.tab || 'posts'), filtro: String(req.query.f || ''), red: String(req.query.red || '') };
    if (view.tab === 'leads') view.leads = db.listLeads(req.client.id);
    if (view.tab === 'citas') {
      const cfg = agenda.agendaCfg(req.client);
      try { view.citas = cfg.calendar_id ? agenda.groupRecurring(await agenda.upcomingEvents(cfg.calendar_id)) : null; } catch (e) { view.citasError = e.message; }
      view.agendaCfg = cfg; view.saEmail = agenda.serviceAccount()?.client_email || null;
    }
    res.send(clientView(req.client, undefined, req.query.ok ? String(req.query.ok) : undefined, await withTikTokInfo(req.client, db.listPosts({ clientId: req.client.id, limit: 400 })), view));
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
      db.updateClient(req.client.id, { ...data, activo: req.body.activo === '1' });
      pipe.resetKeywordPause(req.client.id);
      res.redirect(`/admin/clientes/${req.client.id}?tab=config&ok=Guardado`);
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
  admin.get('/tiktok/callback', async (req, res) => {
    const st = unsign(String(req.query.state || ''));
    const [, cid, exp] = st ? st.split(':') : [];
    const client = cid && Number(exp) > Date.now() ? db.getClient(Number(cid)) : null;
    if (!client) return res.status(400).send('El enlace de TikTok venció o no es válido. Vuelve a dar "Conectar TikTok".');
    if (req.query.error) return res.status(400).send(clientView(client, `TikTok: ${req.query.error_description || req.query.error}`));
    try {
      const tk = await exchangeTikTokCode(String(req.query.code || ''));
      db.updateClient(client.id, { credentials: { ...db.clientCredentials(client), tiktok: tk } });
      db.logEvent({ clientId: client.id, tipo: 'tiktok_conectado', detalle: `open_id ${tk.open_id}` });
      res.redirect(`/admin/clientes/${client.id}`);
    } catch (e) {
      res.status(400).send(clientView(client, e.message));
    }
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
    res.redirect(`/admin/clientes/${req.client.id}?tab=config&ok=Llave%20nueva%20generada`);
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
    const plataforma = req.body.plataforma;
    pipe.enqueue(`gen-${req.client.id}-${plataforma}-${Date.now()}`, () =>
      pipe.generateForPlatform(req.client.id, plataforma, { force: true }).catch(() => {}));
    res.redirect(`/admin/clientes/${req.client.id}`);
  });

  admin.param('pid', (req, res, next, id) => {
    req.post = db.getPost(Number(id));
    return req.post ? next() : res.status(404).send('Post no encontrado');
  });
  admin.get('/posts/:pid', async (req, res) => {
    const client = db.getClient(req.post.client_id);
    await withTikTokInfo(client, [req.post]);
    res.send(V.postAdminPage(req.post, client, db.postEvents(req.post.id)));
  });
  admin.post('/posts/:pid/publicar', async (req, res) => {
    await pipe.publishOne(req.post.id);
    res.redirect(`/admin/posts/${req.post.id}`);
  });
  admin.post('/posts/:pid/eliminar', (req, res) => {
    const cid = req.post.client_id;
    pipe.deletePost(req.post.id);
    res.redirect(`/admin/clientes/${cid}?tab=posts&f=descartados&ok=Post%20eliminado`);
  });
  postActions(admin, (req) => `/admin/posts/${req.post.id}`);
  app.use('/admin', admin);

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
  });
}
