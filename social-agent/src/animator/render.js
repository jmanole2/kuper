// Lado servidor del motor: abre el escenario en Chromium, prueba el código de Claude,
// arma hojas de contacto y renderiza el video/imágenes finales.
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
const STAGE = path.join(ROOT, 'src/animator/stage.html');

export const CANVAS = {
  '9:16': [1080, 1920],
  '4:5': [1080, 1350],
  '1:1': [1080, 1080],
  '1.91:1': [1200, 628],
};

// Tipografías disponibles para las marcas (agrega aquí nuevas fuentes de @fontsource).
const fs5 = (pkg, file, weights) => Object.fromEntries(weights.map((w) => [w, () =>
  path.join(path.dirname(require.resolve(`@fontsource/${pkg}/package.json`)), `files/${file}-latin-${w}-normal.woff2`)]));
export const FONTS = {
  'Inter Tight': fs5('inter-tight', 'inter-tight', [300, 400, 500, 600]),
  Geist: fs5('geist-sans', 'geist-sans', [300, 400, 500, 600]),
  'DM Sans': fs5('dm-sans', 'dm-sans', [400, 500, 700, 800]),
  Poppins: { 400: () => path.join(ROOT, 'assets/fonts/Poppins-Regular.ttf'), 700: () => path.join(ROOT, 'assets/fonts/Poppins-Bold.ttf') },
};

function fontList(families) {
  const out = [];
  for (const fam of new Set(families)) {
    const f = FONTS[fam] || FONTS['DM Sans'];
    const name = FONTS[fam] ? fam : 'DM Sans';
    for (const [w, p] of Object.entries(f)) out.push({ family: name, weight: Number(w), url: pathToFileURL(p()).href });
  }
  return out;
}

const dataUri = (file) => (file && fs.existsSync(file)
  ? `data:image/${path.extname(file).slice(1).toLowerCase().replace('jpg', 'jpeg')};base64,${fs.readFileSync(file).toString('base64')}`
  : null);

/**
 * job: { kind: 'video'|'carrusel'|'imagen', formato, duration, fps, slides, content, brand: {name, colors, fontHead, fontBody, style, logoPath, markPath} }
 */
export function buildSpec(job) {
  const [width, height] = CANVAS[job.formato] || CANVAS['1:1'];
  const fontHead = FONTS[job.brand.fontHead] ? job.brand.fontHead : 'DM Sans';
  const fontBody = FONTS[job.brand.fontBody] ? job.brand.fontBody : fontHead;
  return {
    spec: {
      width, height, format: job.formato, kind: job.kind,
      duration: job.kind === 'video' ? job.duration : 1, fps: job.fps || 30,
      slides: job.slides || 1, content: job.content || {},
      brand: { name: job.brand.name, colors: job.brand.colors, fontHead, fontBody, style: job.brand.style },
      fonts: fontList([fontHead, fontBody]),
    },
    assets: { logo: dataUri(job.brand.logoPath), mark: dataUri(job.brand.markPath) },
  };
}

export class Stage {
  static async open() {
    // Banderas para servidores chicos: sin GPU, sin /dev/shm (en droplets es de 64 MB) y heap de JS acotado.
    const opts = { args: ['--force-color-profile=srgb', '--disable-gpu', '--disable-dev-shm-usage', '--disable-extensions', '--js-flags=--max-old-space-size=512'] };
    if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
    const s = new Stage();
    s.browser = await chromium.launch(opts);
    return s;
  }

  /** Carga el código en una página nueva. Lanza error si no compila o falla setup(). */
  async load(job, code) {
    if (this.page) await this.page.close();
    const { spec, assets } = buildSpec(job);
    this.spec = spec;
    const page = await this.browser.newPage({ viewport: { width: 600, height: 800 } });
    // Sin red: el código generado solo puede usar lo que le da el kit.
    await page.route('**/*', (r) => (/^(file|data):/.test(r.request().url()) ? r.continue() : r.abort()));
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(pathToFileURL(STAGE).href);
    this.page = page;
    try {
      await page.evaluate(([s, c, a]) => window.STAGE.init(s, c, a), [spec, code, assets]);
    } catch (e) {
      throw new Error(`No se pudo cargar el código: ${cleanErr(e)}`);
    }
    if (pageErrors.length) throw new Error(`Error en la página: ${pageErrors.join('; ')}`);
    return spec;
  }

  sampleTimes(n = 10) {
    const d = this.spec.duration;
    if (this.spec.kind !== 'video') return [d];
    return Array.from({ length: n }, (_, i) => +(Math.min(d - 1 / 30, (i + 0.5) * d / n)).toFixed(2)).concat([+(d - 1 / 30).toFixed(3)]);
  }

  async probe() {
    return this.page.evaluate(([times, slides]) => window.STAGE.probe(times, slides), [this.sampleTimes(12), this.spec.slides]);
  }

  async sheet() {
    const items = this.spec.kind === 'video'
      ? this.sampleTimes(7).map((t) => ({ t, label: `${t.toFixed(1)} s` }))
      : Array.from({ length: this.spec.slides }, (_, i) => ({ t: this.spec.duration, slide: i, label: this.spec.slides > 1 ? `Slide ${i + 1}` : 'Imagen' }));
    const cols = Math.min(4, items.length);
    const url = await this.page.evaluate(([it, c]) => window.STAGE.sheet(it, c, 340), [items, cols]);
    return Buffer.from(url.split(',')[1], 'base64');
  }

  async capture(t, type = 'image/jpeg', slide = 0) {
    const url = await this.page.evaluate(([tt, ty, s]) => window.STAGE.capture(tt, ty, s), [t, type, slide]);
    return Buffer.from(url.split(',')[1], 'base64');
  }

  /** MP4 H.264 + pista de audio silenciosa (Reels y LinkedIn la prefieren). */
  async renderVideo(outFile) {
    const { duration, fps } = this.spec;
    const total = Math.round(duration * fps);
    // Paso 1: solo video. El audio silencioso se agrega aparte (paso 2): si se genera junto, ffmpeg
    // lo produce más rápido que los cuadros y lo acumula en memoria esperando al video.
    const tmp = outFile.replace(/\.mp4$/, '') + '.solo-video.mp4';
    const ff = spawn(FFMPEG, [
      '-y', '-loglevel', 'error',
      '-threads', '1', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      // Hilos acotados y ventana de análisis corta (rc-lookahead): x264 guarda esos cuadros en memoria.
      // Así cabe en un servidor de 1 GB.
      '-c:v', 'libx264', '-preset', process.env.FFMPEG_PRESET || 'medium', '-threads', process.env.FFMPEG_THREADS || '2',
      '-x264-params', `rc-lookahead=${process.env.FFMPEG_LOOKAHEAD || 10}`,
      '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(fps), tmp,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('exit', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg terminó con código ${c}`)))));
    for (let i = 0; i < total; i++) {
      const buf = await this.capture(i / fps, 'image/jpeg');
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await done;
    // Paso 2: pista de audio silenciosa (Reels y LinkedIn la prefieren) sin recodificar el video.
    await new Promise((res, rej) => spawn(FFMPEG, [
      '-y', '-loglevel', 'error', '-i', tmp,
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-shortest', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart', outFile,
    ], { stdio: ['ignore', 'inherit', 'inherit'] }).on('exit', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg (audio) terminó con código ${c}`)))));
    fs.rmSync(tmp, { force: true });
    return outFile;
  }

  async renderStills(base) {
    const files = [];
    for (let s = 0; s < this.spec.slides; s++) {
      const f = this.spec.slides > 1 ? `${base}-${s + 1}.jpg` : `${base}.jpg`;
      fs.writeFileSync(f, await this.capture(this.spec.duration, 'image/jpeg', s));
      files.push(f);
    }
    return files;
  }

  async close() { await this.browser?.close(); }
}

function cleanErr(e) {
  return String(e.message || e).replace(/^page\.evaluate: /, '').split('\n')[0];
}
