#!/usr/bin/env node
// Renders src/index.html frame-by-frame with headless Chromium and encodes an MP4.
//
//   node render.mjs                       -> out/claude-academy.mp4
//   node render.mjs --stills 0.5,3.6,9    -> out/stills/still_<t>.png
//   node render.mjs --sheet               -> out/contact-sheet.png (1 frame / 0.5 s)
//   options: --page src/x.html --config file.json --out path.mp4 --workers N --fps N
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const cfgPath = path.resolve(ROOT, opt('config', 'animation.config.json'));
const config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
if (opt('fps')) config.fps = Number(opt('fps'));
const FFMPEG = process.env.FFMPEG || ffmpegPath;

async function openPages(n) {
  const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
  const pages = [];
  for (let i = 0; i < n; i++) {
    const page = await browser.newPage({ viewport: { width: 600, height: 1000 } });
    page.on('pageerror', (e) => console.error('page error:', e.message));
    await page.addInitScript((c) => { window.ANIM_CONFIG = c; }, config);
    await page.goto(pathToFileURL(path.resolve(ROOT, opt('page', 'src/index.html'))).href);
    await page.evaluate(() => window.ANIM.ready);
    pages.push(page);
  }
  return { browser, pages };
}
const grab = (page, t) => page.evaluate((tt) => {
  window.ANIM.render(tt);
  return document.getElementById('c').toDataURL('image/png');
}, t).then((u) => Buffer.from(u.split(',')[1], 'base64'));

function run(cmd, a) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, a, { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}`))));
  });
}

async function stills(times, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const { browser, pages } = await openPages(1);
  const files = [];
  for (const t of times) {
    const f = path.join(dir, `still_${t.toFixed(2).padStart(5, '0')}.png`);
    fs.writeFileSync(f, await grab(pages[0], t));
    files.push(f);
  }
  await browser.close();
  return files;
}

async function video(out) {
  const duration = (config.duration ?? Object.values(config.scenes).reduce((a, b) => a + b, 0));
  const fps = config.fps;
  const total = Math.round(duration * fps);
  const workers = Number(opt('workers', Math.max(1, Math.min(4, os.cpus().length))));
  const frameDir = path.join(ROOT, 'out/.frames');
  fs.rmSync(frameDir, { recursive: true, force: true });
  fs.mkdirSync(frameDir, { recursive: true });
  const { browser, pages } = await openPages(workers);
  const started = Date.now();
  let next = 0, done = 0;
  await Promise.all(pages.map(async (page) => {
    while (next < total) {
      const i = next++;
      const buf = await grab(page, i / fps);
      fs.writeFileSync(path.join(frameDir, `f_${String(i).padStart(5, '0')}.png`), buf);
      if (++done % 60 === 0) console.log(`  ${done}/${total} frames (${((Date.now() - started) / 1000).toFixed(0)}s)`);
    }
  }));
  await browser.close();
  console.log(`rendered ${total} frames in ${((Date.now() - started) / 1000).toFixed(1)}s, encoding…`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (out.endsWith('.gif')) {
    const pal = path.join(frameDir, 'palette.png');
    const scale = config.gifWidth ? `scale=${config.gifWidth}:-1:flags=lanczos,` : '';
    await run(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(frameDir, 'f_%05d.png'),
      '-vf', `${scale}palettegen=max_colors=256:stats_mode=full`, pal]);
    await run(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(frameDir, 'f_%05d.png'), '-i', pal,
      '-lavfi', `${scale.replace(/,$/, '')}${scale ? ' [x]; [x]' : ''}[1:v] paletteuse=dither=sierra2_4a:diff_mode=rectangle`, '-loop', '0', out]);
    fs.rmSync(frameDir, { recursive: true, force: true });
    console.log(`wrote ${out}`);
    return;
  }
  await run(FFMPEG, [
    '-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(frameDir, 'f_%05d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-movflags', '+faststart', '-an', out,
  ]);
  fs.rmSync(frameDir, { recursive: true, force: true });
  console.log(`wrote ${out}`);
}

if (opt('stills')) {
  const times = String(opt('stills')).split(',').map(Number);
  const files = await stills(times, path.join(ROOT, 'out/stills'));
  console.log(files.join('\n'));
} else if (opt('sheet')) {
  const step = Number(opt('step', 0.5));
  const duration = (config.duration ?? Object.values(config.scenes).reduce((a, b) => a + b, 0));
  const times = [];
  for (let t = Number(opt('from', 0)); t <= Number(opt('to', duration)) + 1e-6; t += step) times.push(Math.min(t, duration - 0.001));
  const cols = Number(opt('cols', 8));
  const out = path.resolve(ROOT, opt('out', 'out/contact-sheet.png'));
  const { browser, pages } = await openPages(1);
  const url = await pages[0].evaluate(({ times, cols }) => {
    const src = document.getElementById('c');
    const tw = 360, th = 640, rows = Math.ceil(times.length / cols);
    const sheet = document.createElement('canvas');
    sheet.width = cols * tw; sheet.height = rows * th;
    const g = sheet.getContext('2d');
    times.forEach((t, i) => {
      window.ANIM.render(t);
      const x = (i % cols) * tw, y = Math.floor(i / cols) * th;
      g.drawImage(src, x, y, tw, th);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, y, 70, 26);
      g.fillStyle = '#fff'; g.font = '18px sans-serif'; g.fillText(t.toFixed(2) + 's', x + 6, y + 19);
      g.strokeStyle = '#000'; g.strokeRect(x, y, tw, th);
    });
    return sheet.toDataURL('image/png');
  }, { times, cols });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  await browser.close();
  console.log(`wrote ${out}`);
} else {
  await video(path.resolve(ROOT, opt('out', 'out/claude-academy.mp4')));
}
