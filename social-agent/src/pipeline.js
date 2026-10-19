// Orquestación del agente: generar → medios → aprobación → publicar.
import path from 'node:path';
import fs from 'node:fs';
import { config, mediaDir } from './config.js';
import * as db from './db.js';
import { generatePost, analyzeCompetitors } from './llm/claude.js';
import { validatePost, needsApproval, PLATFORM_RULES } from './rules.js';
import { nextSlot, zonedToUtc, daysUntil, localDate } from './schedule.js';
import { renderAnimation, renderStill } from './media/animation.js';
import { generateImage, imageModelConfigured, ensureJpeg } from './media/image.js';
import { publishPost } from './publishers/index.js';
import { fetchCompetitors } from './competitors/instagram.js';
import { randomToken } from './crypto.js';

// Cola de trabajos en serie: las generaciones abren Chromium y llaman a APIs, mejor de una en una.
let chain = Promise.resolve();
const running = new Set();
export function enqueue(key, fn) {
  if (running.has(key)) return false;
  running.add(key);
  chain = chain.then(fn).catch((e) => console.error(`[cola] ${key}:`, e)).finally(() => running.delete(key));
  return true;
}
export const idle = () => chain;

const platformCfg = (client, plataforma) => client.config[plataforma] || {};
const modoDe = (client, plataforma) => platformCfg(client, plataforma).modo_publicacion || 'aprobacion';
const horaDe = (client, plataforma) => platformCfg(client, plataforma).hora || '10:00';

export function slotFor(client, plataforma, now = new Date()) {
  return nextSlot({
    lastIso: db.lastDateFor(client.id, plataforma),
    frecuencia: platformCfg(client, plataforma).frecuencia || 'semanal',
    hora: horaDe(client, plataforma),
    tz: config.timezone,
    now,
    minDays: needsApproval(modoDe(client, plataforma)) ? 1 : 0,
  });
}

function buildInput(client, plataforma, { feedback, postId } = {}) {
  const slot = slotFor(client, plataforma);
  const historial = db.recentHistory(client.id, { excludeId: postId }).map((h) => ({
    plataforma: h.plataforma, pilar: h.pilar, tema: h.tema, formato: h.formato, fecha: h.fecha?.slice(0, 10),
  }));
  const report = db.latestCompetitorReport(client.id);
  return {
    plataforma,
    perfil: client.perfil,
    config: client.config,
    historial: { ultimas_publicaciones: historial, fecha_calculada: slot.fecha, sin_publicaciones_previas: slot.sinHistorial },
    competencia: report ? { ...report.data, fecha_analisis: report.created_at } : null,
    fechaCalculada: slot.fecha,
    scheduledAt: slot.scheduledAt,
    feedback,
  };
}

// Nombre con parte aleatoria: los medios se sirven públicos antes de aprobarse.
const fileBase = (client, post) => path.join(mediaDir(), `${client.slug}-${post.plataforma}-${post.id}-${randomToken(8)}`);

async function produceMedia(client, post, out) {
  if (out.requiere_asset_real || out.formato_contenido === 'solo_texto') return { image_path: null, video_path: null };
  const logoPath = client.logo_path && fs.existsSync(client.logo_path) ? client.logo_path : null;
  if (out.formato_contenido === 'video_animado') {
    const { video, cover } = await renderAnimation({
      animacion: out.animacion, formato: out.formato_imagen, perfil: client.perfil, logoPath, outFile: `${fileBase(client, post)}.mp4`,
    });
    return { video_path: video, image_path: cover };
  }
  // imagen_estatica
  if (imageModelConfigured()) {
    try {
      const f = await generateImage({ prompt: out.prompt_imagen, formato: out.formato_imagen, outFileBase: fileBase(client, post) });
      return { image_path: ensureJpeg(f), video_path: null };
    } catch (e) {
      db.logEvent({ postId: post.id, clientId: client.id, tipo: 'imagen_fallo', detalle: `${e.message}. Se usa gráfico de marca.` });
    }
  }
  // Respaldo: tarjeta gráfica con los colores de la marca.
  const file = await renderStill({
    titular: out.tema, apoyo: '', formato: out.formato_imagen, perfil: client.perfil, logoPath, outFile: `${fileBase(client, post)}.jpg`,
  });
  return { image_path: file, video_path: null };
}

/** Genera (o regenera con feedback) el contenido de un post existente. */
async function fillPost(postId, { feedback } = {}) {
  let post = db.getPost(postId);
  const client = db.getClient(post.client_id);
  const input = buildInput(client, post.plataforma, { feedback, postId });
  // Al regenerar se respeta la fecha que ya tenía el post.
  if (feedback && post.scheduled_at) input.fechaCalculada = input.historial.fecha_calculada = localDate(post.scheduled_at, config.timezone);
  const modo = modoDe(client, post.plataforma);
  const validate = (out) => validatePost(out, {
    perfil: client.perfil, plataforma: post.plataforma, modo, historial: input.historial.ultimas_publicaciones,
    fechaCalculada: input.fechaCalculada, formatosPermitidos: platformCfg(client, post.plataforma).formatos,
  });

  const { out, errors } = await generatePost(input, validate);
  if (out.error) {
    db.updatePost(postId, { status: 'error_generacion', salida: out, error: (out.advertencias || []).join(' ') || out.error });
    db.logEvent({ postId, clientId: client.id, tipo: 'error_generacion', detalle: out.error });
    return db.getPost(postId);
  }
  const media = await produceMedia(client, post, out);
  const advertencias = [...(out.advertencias || []), ...errors.map((e) => `Validación: ${e}`)];
  const salida = { ...out, advertencias };
  const scheduledAt = feedback && post.scheduled_at ? post.scheduled_at : zonedToUtc(input.fechaCalculada, horaDe(client, post.plataforma), config.timezone);

  let status;
  if (out.requiere_asset_real && !post.image_path && !post.video_path) status = 'necesita_asset';
  else if (needsApproval(modo) || errors.length) status = 'pendiente'; // con errores de validación nunca se publica solo
  else status = 'aprobado';

  post = db.updatePost(postId, {
    status, pilar: out.pilar_de_contenido, tema: out.tema, formato: out.formato_contenido, salida,
    variante: 0, copy_final: out.variantes_copy[0]?.copy ?? '', hashtags: out.variantes_copy[0]?.hashtags ?? [],
    alt_text: out.alt_text, scheduled_at: scheduledAt, error: null,
    ...(out.requiere_asset_real ? {} : media),
  });
  db.logEvent({ postId, clientId: client.id, tipo: feedback ? 'regenerado' : 'generado', detalle: `${out.tema} → ${db.STATUS[status]}` });
  return post;
}

export async function generateForPlatform(clientId, plataforma, { force = false } = {}) {
  const client = db.getClient(clientId);
  if (!client) throw new Error('Cliente no existe');
  if (!PLATFORM_RULES[plataforma]) throw new Error(`Plataforma no soportada: ${plataforma}`);
  if (!force && db.openPostFor(clientId, plataforma)) return null;
  const post = db.createPost({ client_id: clientId, plataforma, status: 'generando' });
  try {
    return await fillPost(post.id);
  } catch (e) {
    db.updatePost(post.id, { status: 'error_generacion', error: e.message });
    db.logEvent({ postId: post.id, clientId, tipo: 'error_generacion', detalle: e.message });
    throw e;
  }
}

// ------------------------------------------------------------ acciones del cliente
export function approvePost(postId, { variante, copy, hashtags, fecha, hora } = {}) {
  const post = db.getPost(postId);
  if (!['pendiente'].includes(post.status)) throw new Error(`No se puede aprobar un post en estado "${db.STATUS[post.status]}"`);
  const v = post.salida?.variantes_copy?.[variante ?? post.variante];
  const patch = {
    variante: variante ?? post.variante,
    copy_final: (copy ?? v?.copy ?? post.copy_final).trim(),
    hashtags: hashtags ?? v?.hashtags ?? post.hashtags,
  };
  if (fecha) patch.scheduled_at = zonedToUtc(fecha, hora || '10:00', config.timezone);
  db.updatePost(postId, patch);
  if (!db.transitionPost(postId, 'pendiente', 'aprobado')) throw new Error('El post cambió de estado; recarga la página.');
  db.logEvent({ postId, clientId: post.client_id, tipo: 'aprobado', detalle: patch.scheduled_at || post.scheduled_at });
  return db.getPost(postId);
}

export function rejectPost(postId, motivo = '') {
  const post = db.getPost(postId);
  if (!db.transitionPost(postId, ['pendiente', 'necesita_asset', 'aprobado'], 'rechazado')) throw new Error('No se puede rechazar en este estado');
  db.updatePost(postId, { feedback: motivo });
  db.logEvent({ postId, clientId: post.client_id, tipo: 'rechazado', detalle: motivo });
}

export function requestChanges(postId, comentarios) {
  const post = db.getPost(postId);
  if (!comentarios?.trim()) throw new Error('Escribe qué cambios quieres');
  if (!db.transitionPost(postId, ['pendiente', 'necesita_asset'], 'cambios_solicitados')) throw new Error('No se pueden pedir cambios en este estado');
  db.updatePost(postId, { feedback: comentarios });
  db.logEvent({ postId, clientId: post.client_id, tipo: 'cambios_solicitados', detalle: comentarios });
  enqueue(`regen-${postId}`, async () => {
    try {
      await fillPost(postId, { feedback: { propuesta_anterior: post.salida, comentarios_del_cliente: comentarios } });
    } catch (e) {
      db.updatePost(postId, { status: 'pendiente', error: `No se pudieron aplicar los cambios: ${e.message}` });
      db.logEvent({ postId, clientId: post.client_id, tipo: 'error_generacion', detalle: e.message });
    }
  });
}

/** El cliente sube la foto/video real que pidió el agente. */
export function attachAsset(postId, filePath, mimetype) {
  const post = db.getPost(postId);
  const client = db.getClient(post.client_id);
  const isVideo = mimetype.startsWith('video/');
  const patch = isVideo ? { video_path: filePath, image_path: null } : { image_path: ensureJpeg(filePath), video_path: null };
  db.updatePost(postId, patch);
  if (post.status === 'necesita_asset') {
    const next = needsApproval(modoDe(client, post.plataforma)) ? 'pendiente' : 'aprobado';
    db.transitionPost(postId, 'necesita_asset', next);
  }
  db.logEvent({ postId, clientId: post.client_id, tipo: 'asset_subido', detalle: path.basename(filePath) });
}

// ------------------------------------------------------------ publicación
export async function publishOne(postId) {
  if (!db.transitionPost(postId, ['aprobado', 'error'], 'publicando')) return null;
  const post = db.getPost(postId);
  const client = db.getClient(post.client_id);
  try {
    const res = await publishPost(post, client);
    db.updatePost(postId, { status: 'publicado', published_at: new Date().toISOString(), external_id: res.id, external_url: res.url, error: null });
    db.logEvent({ postId, clientId: client.id, tipo: 'publicado', detalle: `${post.plataforma}${res.dryRun ? ' (simulado)' : ''} ${res.url || res.id}` });
  } catch (e) {
    db.updatePost(postId, { status: 'error', error: e.message });
    db.logEvent({ postId, clientId: client.id, tipo: 'error_publicacion', detalle: e.message });
  }
  return db.getPost(postId);
}

export async function publishDue(now = new Date()) {
  for (const p of db.duePosts(now.toISOString())) {
    const client = db.getClient(p.client_id);
    if (!client?.activo) continue;
    await publishOne(p.id);
  }
}

// ------------------------------------------------------------ competencia
export async function runCompetitorAnalysis(clientId) {
  const client = db.getClient(clientId);
  const competitors = db.listCompetitors(clientId);
  if (!competitors.length) throw new Error('Agrega al menos una cuenta de competencia');
  const creds = db.clientCredentials(client);
  const raw = config.mockLlm && !creds.meta ? { cuentas: [], errores: ['Modo de prueba sin credenciales'] } : await fetchCompetitors(creds.meta, competitors);
  const notas = competitors.filter((c) => c.notas).map((c) => `@${c.handle}: ${c.notas}`).join('\n');
  if (!raw.cuentas.length && !notas) throw new Error(`No se pudo leer ninguna cuenta. ${raw.errores.join(' · ')}`);
  const data = await analyzeCompetitors({ perfil: client.perfil, data: raw, notas });
  if (raw.errores.length) data.advertencias = [...(data.advertencias || []), ...raw.errores];
  db.saveCompetitorReport(clientId, data, raw);
  db.logEvent({ clientId, tipo: 'competencia_analizada', detalle: `${raw.cuentas.length} cuentas` });
  return data;
}

// ------------------------------------------------------------ ciclo automático
export async function tick(now = new Date()) {
  await publishDue(now);
  for (const client of db.listClients().filter((c) => c.activo)) {
    // Análisis de competencia periódico.
    const report = db.latestCompetitorReport(client.id);
    const stale = !report || daysUntil(report.created_at.replace(' ', 'T') + 'Z', now) < -config.competitorRefreshDays;
    if (stale && db.listCompetitors(client.id).length) {
      enqueue(`comp-${client.id}`, () => runCompetitorAnalysis(client.id).catch((e) =>
        db.logEvent({ clientId: client.id, tipo: 'competencia_error', detalle: e.message })));
    }
    // Generación con anticipación para cada plataforma activa.
    for (const plataforma of db.PLATFORMS) {
      if (!platformCfg(client, plataforma).activo) continue;
      if (db.openPostFor(client.id, plataforma)) continue;
      const lastErr = db.lastGenerationErrorAt(client.id, plataforma);
      if (lastErr && (now - new Date(lastErr.replace(' ', 'T') + 'Z')) < 6 * 3600_000) continue; // no reintentar en bucle
      const slot = slotFor(client, plataforma, now);
      if (daysUntil(slot.scheduledAt, now) > config.leadDays) continue;
      enqueue(`gen-${client.id}-${plataforma}`, () => generateForPlatform(client.id, plataforma).catch(() => {}));
    }
  }
}

export function startScheduler() {
  const run = () => tick().catch((e) => console.error('[programador]', e));
  setTimeout(run, 2000);
  return setInterval(run, config.schedulerIntervalSec * 1000);
}
