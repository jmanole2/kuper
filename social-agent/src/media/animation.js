// Renderiza la plantilla de animación 2D cuadro por cuadro con Chromium (Playwright)
// y la codifica a MP4 con ffmpeg. También sirve para generar imágenes fijas de marca.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import ffmpegStatic from 'ffmpeg-static';
import { ROOT } from '../config.js';

const require = createRequire(import.meta.url);
const FFMPEG = process.env.FFMPEG || ffmpegStatic;
const TEMPLATE = path.join(ROOT, 'src/media/template.html');

export const CANVAS = {
  '9:16': [1080, 1920],
  '4:5': [1080, 1350],
  '1:1': [1080, 1080],
  '1.91:1': [1200, 628],
};

function fontUrls() {
  const dir = path.dirname(require.resolve('@fontsource/dm-sans/package.json'));
  return [500, 700].map((w) => [w, pathToFileURL(path.join(dir, `files/dm-sans-latin-${w}-normal.woff2`)).href]);
}

async function launch() {
  // En contenedores con Chromium preinstalado se puede fijar la ruta con CHROMIUM_PATH.
  const opts = { args: ['--force-color-profile=srgb'] };
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  return chromium.launch(opts);
}

async function openTemplate(browser, spec) {
  const page = await browser.newPage({ viewport: { width: 600, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((s) => { window.SPEC = s; }, spec);
  await page.goto(pathToFileURL(TEMPLATE).href);
  await page.evaluate(() => window.ANIM.ready);
  if (errors.length) throw new Error(`Error en la plantilla: ${errors.join('; ')}`);
  return page;
}

const grab = (page, t, type = 'image/png') => page.evaluate(([tt, ty]) => {
  window.ANIM.render(tt);
  return document.getElementById('c').toDataURL(ty, 0.92);
}, [t, type]).then((u) => Buffer.from(u.split(',')[1], 'base64'));

function buildSpec({ animacion, formato, perfil, logoPath, fps = 30 }) {
  const [width, height] = CANVAS[formato] || CANVAS['9:16'];
  return {
    width, height, fps,
    duration: animacion.duracion_seg,
    colors: perfil.colores_marca || [],
    escenas: animacion.escenas,
    cierre: animacion.cierre,
    marca: perfil.cliente,
    // data: URI (una imagen file:// "contamina" el canvas y no se podría exportar)
    logoUrl: logoPath && fs.existsSync(logoPath)
      ? `data:image/${path.extname(logoPath).slice(1).replace('jpg', 'jpeg')};base64,${fs.readFileSync(logoPath).toString('base64')}`
      : null,
    fontUrls: fontUrls(),
  };
}

/** Renderiza un MP4 (H.264 + pista de audio silenciosa, compatible con Reels y LinkedIn). */
export async function renderAnimation({ animacion, formato, perfil, logoPath, outFile, fps = 30 }) {
  const spec = buildSpec({ animacion, formato, perfil, logoPath, fps });
  const total = Math.round(spec.duration * fps);
  const browser = await launch();
  try {
    const page = await openTemplate(browser, spec);
    const ff = spawn(FFMPEG, [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-shortest', '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(fps),
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outFile,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('exit', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg terminó con código ${c}`)))));
    for (let i = 0; i < total; i++) {
      const frame = await grab(page, i / fps, 'image/jpeg');
      if (!ff.stdin.write(frame)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await done;
    // Portada: un cuadro de la primera escena ya armada.
    const cover = outFile.replace(/\.mp4$/, '.jpg');
    fs.writeFileSync(cover, await grab(page, Math.min(spec.duration - 0.1, 0.5 + (spec.duration * 0.72 - 0.5) / Math.max(1, spec.escenas.length) * 0.6), 'image/jpeg'));
    return { video: outFile, cover };
  } finally {
    await browser.close();
  }
}

/** Imagen fija de marca (respaldo cuando no hay modelo de imagen configurado). */
export async function renderStill({ titular, apoyo = '', cierre = '', formato, perfil, logoPath, outFile }) {
  const spec = buildSpec({ animacion: { duracion_seg: 4, escenas: [{ titular, apoyo }], cierre }, formato, perfil, logoPath });
  const browser = await launch();
  try {
    const page = await openTemplate(browser, spec);
    fs.writeFileSync(outFile, await grab(page, 1.6, 'image/jpeg'));
    return outFile;
  } finally {
    await browser.close();
  }
}
