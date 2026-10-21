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
import { sign, unsign, safeEqual, randomToken, hashPassword, verifyPassword, tempPassword } from './crypto.js';
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
import { feedHtml } from './web/control.js';
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
  api.get('/citas', async (req, res) => {
    try { res.json({ citas: await agenda.agentEvents(req.client, { dias: Math.min(90, Number(req.query.dias) || 45) }) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
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
  api.post('/leads', (req, res) => {
    try { res.json({ ok: true, lead: db.upsertLead(req.client.id, { ...req.body, origen: req.body?.origen || 'whatsapp' }) }); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.use('/api/:slug', api);

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
  const setSession = (res, value) => {
    const secure = config.publicBaseUrl.startsWith('https') ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(sign(value))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secure}`);
  };
  // Freno a intentos de contraseña: 8 fallos por IP cada 15 min.
  const fallos = new Map();
  const ipDe = (req) => String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
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
      if (config.adminPassword && safeEqual(pw, config.adminPassword)) { setSession(res, `admin:${Date.now() + 12 * 3600_000}`); return res.redirect('/admin'); }
      fallo(ip); return res.status(401).send(V.loginPage('Correo o contraseña incorrectos', email));
    }
    const u = db.getUserByEmail(email);
    if (!u || !u.activo || !verifyPassword(pw, u.password_hash)) { fallo(ip); return res.status(401).send(V.loginPage('Correo o contraseña incorrectos', email)); }
    db.touchLogin(u.id);
    setSession(res, `u:${u.id}:${Date.now() + 12 * 3600_000}:${huella(u)}`);
    res.redirect(u.rol === 'admin' ? '/admin' : '/app');
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
    if (req.path === '/cuenta') return next();
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
  appR.use(['/posts', '/extra'], servicio('redes'));
  appR.use('/leads', servicio('chat'));
  appR.use('/citas', servicio('agenda'));
  for (const srv of ['llamadas', 'videollamadas']) appR.get(`/${srv}`, servicio(srv), (req, res) => res.send(V.appProximamentePage(req.client, srv)));
  const cuota = (c) => ({ semana: plan.postsDeLaSemana(c.id), costo: plan.costoExtra(c), extras: plan.extrasDelMes(c.id).length });
  const redExtra = (c, red) => db.PLATFORMS.includes(red) && c.config[red]?.activo && red !== 'tiktok' && !c.config[red]?.reusar_instagram;
  appR.get('/extra', (req, res) => {
    const red = String(req.query.red || '');
    if (!redExtra(req.client, red)) return res.redirect('/app/posts');
    res.send(V.appExtraPage(req.client, { red, costo: plan.costoExtra(req.client), tarjeta: db.getBilling(req.client.id).tarjeta }));
  });
  const extrasEnCurso = new Set();
  appR.post('/extra', async (req, res) => {
    const c = req.client, red = String(req.body.red || '');
    if (!redExtra(c, red)) return res.redirect('/app/posts');
    if (extrasEnCurso.has(c.id)) return res.redirect('/app/posts');
    extrasEnCurso.add(c.id);
    try {
      const costo = plan.costoExtra(c), tarjeta = db.getBilling(c.id).tarjeta;
      const vista = (error) => V.appExtraPage(c, { red, costo, tarjeta, error });
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
      db.logEvent({ clientId: c.id, tipo: 'post_extra', detalle: `${red} · ${costo.monto ? plan.mxn(costo.monto) : 'gratis'}` });
      pipe.enqueue(`extra-${c.id}-${red}-${Date.now()}`, () => pipe.generateForPlatform(c.id, red, { force: true }).catch(() => {}));
      res.redirect('/app/posts?ok=extra');
    } catch (e) {
      console.error('[extra]', e.message);
      res.status(500).send(V.appExtraPage(c, { red, costo: plan.costoExtra(c), tarjeta: db.getBilling(c.id).tarjeta, error: 'No pudimos procesarlo. Intenta de nuevo en unos minutos.' }));
    } finally { extrasEnCurso.delete(c.id); }
  });
  appR.get('/pagos', async (req, res) => {
    let r = { ...db.getBilling(req.client.id), facturas: [] }, error = '';
    try { r = await billing.resumen(req.client); } catch (e) { console.error('[pagos]', e.message); error = 'No pudimos consultar tus pagos en este momento.'; }
    res.send(V.appPagosPage(req.client, r, { error, ok: req.query.ok ? 'Listo, tu tarjeta quedó domiciliada.' : '', stripeOn: billing.stripeOn() }));
  });
  appR.post('/pagos/domiciliar', async (req, res) => {
    try { res.redirect(303, await billing.checkoutUrl(req.client, { email: req.sesion.user?.email })); }
    catch (e) { console.error('[pagos]', e.message); res.status(500).send(V.appPagosPage(req.client, { ...db.getBilling(req.client.id), facturas: [] }, { error: 'No pudimos abrir la página de pago. Intenta de nuevo.', stripeOn: billing.stripeOn() })); }
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
    cuota(req.client), req.query.ok === 'extra' ? 'Listo, el agente ya está creando tu publicación extra. En unos minutos aparece en "Por revisar".' : '')));
  appR.param('pid', (req, res, next, id) => {
    req.post = db.getPost(Number(id));
    return req.post && req.post.client_id === req.client.id ? next() : res.status(404).send('Post no encontrado');
  });
  postActions(appR, (req) => `/app/posts#post-${req.post.id}`);
  appR.get('/leads', (req, res) => res.send(V.appLeadsPage(req.client, db.listLeads(req.client.id), db.leadMessageCounts(req.client.id), appPosts(req.client))));
  appR.post('/leads/:leadId', (req, res) => { db.setLeadEstado(req.client.id, Number(req.params.leadId), String(req.body.estado)); res.redirect('/app/leads'); });
  chatRoutes(appR, () => '/app', { app: true, prefix: '' });
  appR.get('/citas', async (req, res) => {
    const cfg = agenda.agendaCfg(req.client), view = { agendaCfg: cfg };
    try { view.citas = cfg.calendar_id ? agenda.groupRecurring(await agenda.upcomingEvents(cfg.calendar_id)) : null; } catch { view.citasError = 'No pudimos leer la agenda en este momento.'; }
    res.send(V.appCitasPage(req.client, view, appPosts(req.client), db.listLeads(req.client.id).length));
  });
  appR.get('/reporte', (req, res) => {
    const mes = /^\d{4}-\d{2}$/.test(req.query.mes || '') ? req.query.mes : metricas.mesActual();
    res.send(reportePage(req.client, metricas.resumenMes(req.client, mes), { base: '/app/reporte?', meses: metricas.ultimosMeses(), side: V.appSide('reporte', req.client) }));
  });
  appR.get('/cuenta', (req, res) => {
    if (!req.sesion.user) return res.redirect('/admin');
    res.send(V.cuentaPage(req.sesion.user, { client: req.sesion.user.client_id ? db.getClient(req.sesion.user.client_id) : null }));
  });
  appR.post('/cuenta', (req, res) => {
    const u = req.sesion.user;
    if (!u) return res.redirect('/admin');
    const { actual = '', nueva = '', nueva2 = '' } = req.body;
    if (!verifyPassword(actual, u.password_hash)) return res.status(400).send(V.cuentaPage(u, { client: u.client_id ? db.getClient(u.client_id) : null, error: 'La contraseña actual no es correcta.' }));
    if (nueva.length < 10) return res.status(400).send(V.cuentaPage(u, { client: u.client_id ? db.getClient(u.client_id) : null, error: 'La nueva contraseña debe tener al menos 10 caracteres.' }));
    if (nueva !== nueva2) return res.status(400).send(V.cuentaPage(u, { client: u.client_id ? db.getClient(u.client_id) : null, error: 'Las contraseñas nuevas no coinciden.' }));
    db.setUserPassword(u.id, hashPassword(nueva));
    const nu = db.getUser(u.id);
    setSession(res, `u:${nu.id}:${Date.now() + 12 * 3600_000}:${huella(nu)}`);
    res.send(V.cuentaPage(nu, { client: nu.client_id ? db.getClient(nu.client_id) : null, ok: 'Listo, tu contraseña cambió.' }));
  });
  app.use('/app', appR);

  // ------------------------------------------------------------ admin
  const admin = express.Router();
  admin.use(requireAdmin);

  // Usuarios del panel
  const usersView = (req, extra = {}) => V.usersPage(db.listUsers(), db.listClients(), { filtro: Number(req.query.c) || null, ...extra });
  admin.get('/usuarios', (req, res) => res.send(usersView(req)));
  admin.post('/usuarios', (req, res) => {
    const password = tempPassword();
    try {
      const u = db.createUser({ email: req.body.email, nombre: req.body.nombre, rol: req.body.rol, client_id: req.body.client_id, password_hash: hashPassword(password) });
      db.logEvent({ clientId: u.client_id, tipo: 'usuario_creado', detalle: `${u.email} (${u.rol})` });
      res.send(usersView(req, { creado: { nombre: u.nombre, email: u.email, password }, filtro: u.client_id }));
    } catch (e) { res.status(400).send(usersView(req, { error: e.message })); }
  });
  admin.param('uid', (req, res, next, id) => { req.usuario = db.getUser(Number(id)); return req.usuario ? next() : res.status(404).send('Usuario no encontrado'); });
  admin.post('/usuarios/:uid/clave', (req, res) => {
    const password = tempPassword();
    db.setUserPassword(req.usuario.id, hashPassword(password));
    res.send(usersView(req, { creado: { nombre: req.usuario.nombre, email: req.usuario.email, password }, filtro: req.usuario.client_id }));
  });
  admin.post('/usuarios/:uid/activo', (req, res) => {
    if (req.sesion.user?.id === req.usuario.id) return res.status(400).send(usersView(req, { error: 'No puedes bloquearte a ti mismo.' }));
    db.setUserActivo(req.usuario.id, !req.usuario.activo); res.redirect('/admin/usuarios');
  });
  admin.post('/usuarios/:uid/eliminar', (req, res) => {
    if (req.sesion.user?.id === req.usuario.id) return res.status(400).send(usersView(req, { error: 'No puedes eliminarte a ti mismo.' }));
    db.deleteUser(req.usuario.id); res.redirect('/admin/usuarios');
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
    if (view.tab === 'leads') { view.leads = db.listLeads(req.client.id); view.chats = db.leadMessageCounts(req.client.id); }
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
      if (req.client.config.plan) data.config.plan = req.client.config.plan; // el plan se edita en su propia tarjeta
      db.updateClient(req.client.id, { ...data, activo: req.body.activo === '1' });
      pipe.resetKeywordPause(req.client.id);
      res.redirect(`/admin/clientes/${req.client.id}?tab=config&ok=Guardado`);
    } catch (e) {
      res.status(400).send(clientView(req.client, e.message, undefined, undefined, { tab: 'config' }));
    }
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
      };
      db.updateClient(req.client.id, { config: { ...req.client.config, plan: nuevo } });
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
  chatRoutes(admin, (req) => `/admin/clientes/${req.client.id}`, { prefix: '/clientes/:cid' });
  admin.post('/clientes/:cid/agente-url', (req, res) => {
    const raw = String(req.body.agente_url || '').trim().replace(/\/+$/, '');
    if (raw && !/^https:\/\/[a-z0-9.-]+(:\d+)?(\/[\w.-]*)*$/i.test(raw)) return res.status(400).send(clientView(req.client, 'La URL del agente debe empezar con https:// (ej. https://agente.kuper.mx)', undefined, undefined, { tab: 'config' }));
    db.updateClient(req.client.id, { credentials: { ...db.clientCredentials(req.client), agente_url: raw || undefined } });
    db.logEvent({ clientId: req.client.id, tipo: 'agente_url', detalle: raw || '(quitada)' });
    res.redirect(`/admin/clientes/${req.client.id}?tab=config&ok=URL del agente guardada`);
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
      const opts = { base: `${base(req)}/leads/${lead.id}`, puedeResponder: agente.agenteConfigurado(req.client), estado, ...extra };
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
