// Servidor web: panel de agencia (/admin), portal de aprobación del cliente (/p/:token)
// y archivos de medios públicos (/media) que Instagram/Facebook descargan al publicar.
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { config, mediaDir } from './config.js';
import * as db from './db.js';
import * as pipe from './pipeline.js';
import { sign, unsign, safeEqual, randomToken } from './crypto.js';
import { freqDays } from './schedule.js';
import * as V from './web/views.js';

export function createApp() {
  db.getDb();
  const app = express();
  app.disable('x-powered-by');
  app.use(express.urlencoded({ extended: false, limit: '2mb' }));
  app.use('/media', express.static(mediaDir(), { maxAge: '1h', fallthrough: false }));
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
      if (!['pendiente', 'necesita_asset', 'aprobado', 'error', 'error_generacion'].includes(p.status)) continue;
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
      if (k === 'respuesta_palabra_clave') continue;
      if (!db.PLATFORMS.includes(k)) throw new Error(`Red no soportada: ${k} (usa ${db.PLATFORMS.join(', ')})`);
      if (v.activo) freqDays(v.frecuencia || 'semanal');
      if (v.hora && !/^\d{2}:\d{2}$/.test(v.hora)) throw new Error(`${k}: "hora" debe ser HH:MM`);
    }
    const keep = (nv, old) => (nv?.trim() ? nv.trim() : old);
    const credentials = {
      meta: {
        page_id: keep(body.meta_page_id, existingCreds.meta?.page_id),
        ig_user_id: keep(body.meta_ig_user_id, existingCreds.meta?.ig_user_id),
        page_token: keep(body.meta_page_token, existingCreds.meta?.page_token),
      },
      linkedin: {
        org_id: keep(body.li_org_id, existingCreds.linkedin?.org_id),
        access_token: keep(body.li_access_token, existingCreds.linkedin?.access_token),
      },
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

  const clientView = (c, error) => V.clientFormPage(c, {
    error, competitors: db.listCompetitors(c.id), report: db.latestCompetitorReport(c.id),
    posts: db.listPosts({ clientId: c.id, limit: 30 }), creds: db.clientCredentials(c), keywordReplies: db.keywordReplies(c.id),
  });

  admin.param('cid', (req, res, next, id) => {
    req.client = db.getClient(Number(id));
    return req.client ? next() : res.status(404).send('Cliente no encontrado');
  });
  admin.get('/clientes/:cid', (req, res) => res.send(clientView(req.client)));
  admin.post('/clientes/:cid', (req, res) => {
    try {
      const data = parseClientForm(req.body, db.clientCredentials(req.client));
      db.updateClient(req.client.id, { ...data, activo: req.body.activo === '1' });
      res.redirect(`/admin/clientes/${req.client.id}`);
    } catch (e) {
      res.status(400).send(clientView(req.client, e.message));
    }
  });
  admin.post('/clientes/:cid/rotar-token', (req, res) => { db.rotatePortalToken(req.client.id); res.redirect(`/admin/clientes/${req.client.id}`); });
  admin.post('/clientes/:cid/logo', upload.single('archivo'), (req, res) => {
    if (req.file) db.updateClient(req.client.id, { logo_path: req.file.path });
    res.redirect(`/admin/clientes/${req.client.id}`);
  });
  admin.post('/clientes/:cid/competencia', (req, res) => {
    db.addCompetitor(req.client.id, req.body.handle, 'instagram', req.body.notas || '');
    res.redirect(`/admin/clientes/${req.client.id}#competencia`);
  });
  admin.post('/clientes/:cid/competencia/:compId/borrar', (req, res) => {
    db.deleteCompetitor(req.client.id, Number(req.params.compId));
    res.redirect(`/admin/clientes/${req.client.id}`);
  });
  admin.post('/clientes/:cid/analizar', async (req, res) => {
    try {
      await pipe.runCompetitorAnalysis(req.client.id);
      res.redirect(`/admin/clientes/${req.client.id}`);
    } catch (e) {
      res.status(400).send(clientView(req.client, `Análisis de competencia: ${e.message}`));
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
  admin.get('/posts/:pid', (req, res) => res.send(V.postAdminPage(req.post, db.getClient(req.post.client_id), db.postEvents(req.post.id))));
  admin.post('/posts/:pid/publicar', async (req, res) => {
    await pipe.publishOne(req.post.id);
    res.redirect(`/admin/posts/${req.post.id}`);
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
  portal.get('/', (req, res) => {
    const posts = db.listPosts({ clientId: req.client.id, limit: 100 }).filter((p) => !['rechazado', 'error_generacion'].includes(p.status));
    res.send(V.portalPage(req.client, posts, req.params.token));
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
      });
      res.redirect(back(req));
    });
    router.post('/posts/:pid/cambios', (req, res) => { pipe.requestChanges(req.post.id, req.body.comentarios); res.redirect(back(req)); });
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
  app.listen(config.port, () => {
    console.log(`Agente social en ${config.publicBaseUrl} (puerto ${config.port})${config.dryRun ? ' — DRY_RUN activo' : ''}${config.mockLlm ? ' — MOCK_LLM activo' : ''}`);
    if (config.schedulerEnabled) pipe.startScheduler();
  });
}
