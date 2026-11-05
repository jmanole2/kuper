// Limpieza automática: aligera publicados viejos, borra rechazados y archivos sin uso; nunca toca lo pendiente.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'limpieza-')), SECRET_KEY: 'x', LOG_EVENTOS: '0' });
const db = await import('../src/db.js');
const { mediaDir } = await import('../src/config.js');
const { limpiar } = await import('../src/limpieza.js');
db.openDb(':memory:');
const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
const M = (n) => path.join(mediaDir(), n);
const img = (n) => { execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=purple:s=1080x1350', '-frames:v', '1', M(n)]); return M(n); };
const vid = (n) => { execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=1080x1920:d=2', '-pix_fmt', 'yuv420p', M(n)]); return M(n); };
const viejo = (f) => { const t = new Date(Date.now() - 30 * 86400000); fs.utimesSync(f, t, t); };

test('aligera publicados viejos, limpia rechazados y huérfanos, respeta lo vivo', () => {
  const c = db.createClient({ slug: 'k', nombre: 'K', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, config: { mascota_path: img('k-mascota.png') }, credentials: {} });
  db.updateClient(c.id, { logo_path: img('k-logo.png') });
  const compartido = vid('k-instagram-1-aaa.mp4');
  const pub = db.createPost({ client_id: c.id, plataforma: 'instagram', status: 'publicado' });
  db.updatePost(pub.id, { image_path: img('k-instagram-1-aaa.jpg'), video_path: compartido });
  db.getDb().prepare("UPDATE posts SET published_at = datetime('now', '-90 days') WHERE id = ?").run(pub.id);
  const tiktok = db.createPost({ client_id: c.id, plataforma: 'tiktok', status: 'pendiente' }); // usa el mismo video, aún sin publicar
  db.updatePost(tiktok.id, { video_path: compartido });
  const rech = db.createPost({ client_id: c.id, plataforma: 'facebook', status: 'rechazado' });
  db.updatePost(rech.id, { image_path: img('k-facebook-3-bbb.jpg') });
  db.getDb().prepare("UPDATE posts SET updated_at = datetime('now', '-20 days') WHERE id = ?").run(rech.id);
  const huerfano = img('k-instagram-9-render-tmp.png'); viejo(huerfano);
  const nuevo = img('subida-reciente.png');
  for (const f of ['k-mascota.png', 'k-logo.png']) viejo(M(f));

  const sim = limpiar({ simular: true });
  assert.ok(sim.archivos >= 3 && fs.existsSync(huerfano), 'simular no borra nada');
  const r = limpiar();
  const p = db.getPost(pub.id);
  assert.match(p.image_path, /-mini\.jpg$/); assert.ok(fs.statSync(p.image_path).size < 60000, 'miniatura ligera');
  assert.equal(p.video_path, null);
  assert.ok(fs.existsSync(compartido), 'el video lo usa un post pendiente: no se borra');
  assert.ok(!fs.existsSync(M('k-instagram-1-aaa.jpg')));
  assert.ok(!fs.existsSync(M('k-facebook-3-bbb.jpg')) && db.getPost(rech.id).image_path === null, 'rechazado sin archivos');
  assert.ok(!fs.existsSync(huerfano), 'huérfano viejo borrado');
  assert.ok(fs.existsSync(nuevo), 'archivo reciente se respeta');
  assert.ok(fs.existsSync(M('k-mascota.png')) && fs.existsSync(M('k-logo.png')), 'mascota y logo nunca se tocan');
  assert.equal(r.posts_aligerados, 1);
  assert.equal(limpiar().archivos, 0, 'la segunda vez ya no hay nada que hacer');
});
