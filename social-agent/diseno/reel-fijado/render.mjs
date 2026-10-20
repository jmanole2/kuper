// Renderiza el reel: node diseno/reel-fijado/render.mjs [cuadros de prueba...]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import ff from 'ffmpeg-static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const D = path.dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + D + '/reel.html'); await p.evaluate(() => window.fontsReady);
const shots = process.argv.slice(2).map(Number);
if (shots.length) {
  for (const t of shots) { await p.evaluate((t) => frame(t), t); await p.locator('#c').screenshot({ path: `${D}/f-${t}.png` }); }
} else {
  const fps = 30, total = Math.round(await p.evaluate(() => DUR) * fps), tmp = D + '/reel-solo.mp4';
  const f = spawn(ff, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', tmp]);
  const done = new Promise((r) => f.on('exit', r));
  for (let i = 0; i < total; i++) {
    const u = await p.evaluate((t) => { frame(t); return document.getElementById('c').toDataURL('image/jpeg', .92); }, i / fps);
    if (!f.stdin.write(Buffer.from(u.split(',')[1], 'base64'))) await new Promise((r) => f.stdin.once('drain', r));
  }
  f.stdin.end(); await done;
  await new Promise((r) => spawn(ff, ['-y', '-loglevel', 'error', '-i', tmp, '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000', '-shortest', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-movflags', '+faststart', D + '/reel-kuper-agentes.mp4']).on('exit', r));
}
console.log(errs.length ? errs : 'ok');
await b.close();
