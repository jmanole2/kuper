// Limpieza automática para que el servidor no se llene. Corre sola cada 12 horas (y con: npm run limpiar).
//  - Posts publicados hace más de MEDIA_DIAS (60): se borran el video y las imágenes en tamaño completo y queda
//    una miniatura ligera (~40 KB) para el historial y los reportes. El post sigue en Instagram/Facebook.
//  - Posts rechazados o que no se pudieron generar hace más de DESCARTADOS_DIAS (14): se borran sus archivos
//    (los que fallaron al publicar se conservan: se pueden reintentar).
//  - Archivos que ya nadie usa (restos de renders, subidas que no se guardaron) con más de HUERFANOS_DIAS (7).
//  - Bitácora de eventos con más de EVENTOS_DIAS (180).
// Nunca toca: logos, mascotas, archivos del agente (brochures), imágenes del blog ni nada de un post pendiente.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as db from './db.js';
import { mediaDir } from './config.js';

const N = (k, def) => { const v = Number(process.env[k]); return Number.isFinite(v) && v > 0 ? v : def; };
const DIA = 86400000;
let ffmpeg = null;
try { ffmpeg = createRequire(import.meta.url)('ffmpeg-static'); } catch { /* sin ffmpeg: no hay miniaturas, se conserva la imagen */ }

/** Miniatura JPG de 540 px de ancho a partir de una imagen o del segundo 1 de un video. */
function miniatura(origen, destino) {
  if (!ffmpeg || !origen || !fs.existsSync(origen)) return null;
  const esVideo = /\.(mp4|mov|webm)$/i.test(origen);
  try {
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', ...(esVideo ? ['-ss', '1'] : []), '-i', origen, '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '6', destino], { timeout: 60000 });
    return fs.existsSync(destino) && fs.statSync(destino).size > 0 ? destino : null;
  } catch { return null; }
}
const tam = (f) => { try { return fs.statSync(f).size; } catch { return 0; } };
const borrar = (f, r) => { const t = tam(f); if (!t) return; if (!r.simular) fs.rmSync(f, { force: true }); r.archivos++; r.bytes += t; };

/** Archivos que se usan en algún lado (por nombre), para no borrarlos nunca. */
function enUso() {
  const d = db.getDb();
  const textos = [
    ...d.prepare('SELECT image_path a, video_path b, images_json c FROM posts').all().flatMap((r) => [r.a, r.b, r.c]),
    ...d.prepare('SELECT logo_path a, config_json b, perfil_json c FROM clients').all().flatMap((r) => [r.a, r.b, r.c]),
    ...d.prepare('SELECT imagen_path a, contenido_html b FROM blog_articulos').all().flatMap((r) => [r.a, r.b]),
    ...d.prepare('SELECT config_json a FROM blog_sitios').all().map((r) => r.a),
  ].filter(Boolean).join('\n');
  return new Set(textos.match(/[\w.@()+-]+\.(png|jpe?g|webp|gif|svg|mp4|mov|webm|pdf|wav|mp3|m4a)/gi) || []);
}

export function limpiar({ ahora = Date.now(), simular = false } = {}) {
  const d = db.getDb(), r = { simular, posts_aligerados: 0, posts_descartados: 0, archivos: 0, bytes: 0, eventos: 0 };
  const hace = (dias) => new Date(ahora - dias * DIA).toISOString().slice(0, 19).replace('T', ' ');
  // Un archivo puede estar en varios posts (Instagram y TikTok comparten video): solo se borra si ningún post vivo lo usa.
  const vivos = new Set(d.prepare(`SELECT image_path a, video_path b, images_json c FROM posts WHERE NOT (
      (status = 'publicado' AND COALESCE(published_at, updated_at) < ?) OR (status IN ('rechazado', 'error_generacion') AND updated_at < ?))`)
    .all(hace(N('MEDIA_DIAS', 60)), hace(N('DESCARTADOS_DIAS', 14))).flatMap((p) => [p.a, p.b, ...JSON.parse(p.c || '[]')]).filter(Boolean));
  const libre = (f) => f && !vivos.has(f);

  // 1) Publicados viejos: queda solo una miniatura
  for (const p of d.prepare("SELECT id, image_path, video_path, images_json FROM posts WHERE status = 'publicado' AND COALESCE(published_at, updated_at) < ?").all(hace(N('MEDIA_DIAS', 60)))) {
    const imgs = JSON.parse(p.images_json || '[]');
    const archivos = [...new Set([p.video_path, p.image_path, ...imgs].filter(Boolean))];
    if (!archivos.length || (archivos.length === 1 && /-mini\.jpg$/.test(archivos[0]))) continue; // ya está aligerado
    const base = p.image_path || imgs[0] || p.video_path;
    let mini = null;
    if (!simular) mini = miniatura(p.image_path && fs.existsSync(p.image_path) ? p.image_path : imgs[0] || p.video_path, base.replace(/\.[^.]+$/, '') + '-mini.jpg');
    if (!simular && !mini) continue; // sin miniatura no se borra nada (mejor ocupar espacio que perder la vista)
    for (const f of archivos) if (libre(f) && f !== mini) borrar(f, r);
    if (!simular) d.prepare('UPDATE posts SET image_path = ?, video_path = NULL, images_json = ? WHERE id = ?').run(mini, JSON.stringify([mini]), p.id);
    r.posts_aligerados++;
  }
  // 2) Rechazados, descartados o con error: fuera sus archivos
  for (const p of d.prepare("SELECT id, image_path, video_path, images_json FROM posts WHERE status IN ('rechazado', 'error_generacion') AND updated_at < ? AND (image_path IS NOT NULL OR video_path IS NOT NULL OR images_json <> '[]')").all(hace(N('DESCARTADOS_DIAS', 14)))) {
    for (const f of [...new Set([p.video_path, p.image_path, ...JSON.parse(p.images_json || '[]')].filter(Boolean))]) if (libre(f)) borrar(f, r);
    if (!simular) d.prepare("UPDATE posts SET image_path = NULL, video_path = NULL, images_json = '[]' WHERE id = ?").run(p.id);
    r.posts_descartados++;
  }
  // 3) Archivos que nadie usa
  const usados = enUso(), dir = mediaDir();
  for (const nombre of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    const f = path.join(dir, nombre);
    let st; try { st = fs.statSync(f); } catch { continue; }
    if (!st.isFile() || usados.has(nombre) || ahora - st.mtimeMs < N('HUERFANOS_DIAS', 7) * DIA) continue;
    borrar(f, r);
  }
  // Importaciones de CSV que no se confirmaron (vista previa abandonada)
  const imp = path.join(path.dirname(dir), 'importaciones');
  for (const nombre of fs.existsSync(imp) ? fs.readdirSync(imp) : []) {
    const f = path.join(imp, nombre);
    try { if (ahora - fs.statSync(f).mtimeMs > DIA) borrar(f, r); } catch { /* ya no estaba */ }
  }
  // 4) Bitácora vieja
  r.eventos = simular ? d.prepare('SELECT COUNT(*) n FROM events WHERE created_at < ?').get(hace(N('EVENTOS_DIAS', 180))).n
    : Number(d.prepare('DELETE FROM events WHERE created_at < ?').run(hace(N('EVENTOS_DIAS', 180))).changes);
  r.mb = Math.round(r.bytes / 1048576 * 10) / 10;
  return r;
}

/** Cuánto ocupa la carpeta de archivos (MB). */
export function espacio() {
  const dir = mediaDir();
  let bytes = 0, n = 0;
  for (const nombre of fs.existsSync(dir) ? fs.readdirSync(dir) : []) { bytes += tam(path.join(dir, nombre)); n++; }
  return { archivos: n, mb: Math.round(bytes / 1048576) };
}

export function iniciar() {
  const correr = () => {
    try {
      const r = limpiar();
      if (r.archivos || r.eventos) console.log(`[limpieza] ${r.mb} MB liberados · ${r.archivos} archivos · ${r.posts_aligerados} posts aligerados · ${r.posts_descartados} descartados · ${r.eventos} eventos viejos`);
    } catch (e) { console.error('[limpieza]', e.message); }
  };
  setTimeout(correr, 5 * 60000).unref?.();
  return setInterval(correr, 12 * 3600000).unref?.();
}
