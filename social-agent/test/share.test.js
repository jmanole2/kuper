// Mismo Reel en Facebook y TikTok con el texto adaptado, y publicación en TikTok.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agente-share-'));
Object.assign(process.env, { DATA_DIR: dir, MOCK_LLM: '1', DRY_RUN: '1', SECRET_KEY: 'test-secret', LOG_EVENTOS: '0' });
const db = await import('../src/db.js');
const pipe = await import('../src/pipeline.js');
const { publishTikTok, freshTikTokCreds } = await import('../src/publishers/tiktok.js');
const { adaptIssues } = await import('../src/llm/adapt.js');

db.openDb(':memory:');
const client = db.createClient({
  slug: 'demo', nombre: 'Demo',
  perfil: { cliente: 'Demo', pilares_de_contenido: [{ nombre: 'tips' }] },
  config: {
    instagram: { activo: true, frecuencia: 'semanal', modo_publicacion: 'aprobacion' },
    facebook: { activo: true, reusar_instagram: true, modo_publicacion: 'aprobacion', hora: '12:00' },
    tiktok: { activo: true, modo_publicacion: 'auto' },
    respuesta_palabra_clave: { activo: true, palabra: 'AGENTE', mensaje: 'Aquí está 👉 https://wa.me/525534907598?text=Hola' },
  },
  credentials: {},
});

test('Facebook y TikTok no generan contenido propio si reusan Instagram', () => {
  const cands = pipe.generationCandidates(new Date()).map((c) => c.plataforma);
  assert.deepEqual(cands, ['instagram']);
});

test('al aprobar un Reel se crean sus copias para Facebook y TikTok con texto adaptado', async () => {
  const ig = db.createPost({ client_id: client.id, plataforma: 'instagram', status: 'pendiente', scheduled_at: '2026-10-21T01:00:00.000Z' });
  const video = path.join(dir, 'v.mp4'); fs.writeFileSync(video, 'x');
  db.updatePost(ig.id, { tema: 'Bot vs agente', copy_final: 'El bot te dice marca 1.\n\nComenta AGENTE y te lo mando.', hashtags: ['#pymes'], video_path: video, image_path: null, salida: { variantes_copy: [] } });
  pipe.approvePost(ig.id, {});
  await pipe.idle();
  const fb = db.sharedCopy(ig.id, 'facebook');
  const tk = db.sharedCopy(ig.id, 'tiktok');
  assert.equal(fb.status, 'pendiente');
  assert.equal(fb.video_path, video);
  assert.match(fb.copy_final, /wa\.me/);
  assert.ok(!/comenta/i.test(fb.copy_final));
  assert.equal(fb.scheduled_at, '2026-10-20T18:00:00.000Z', 'mismo día, a la hora de Facebook');
  assert.equal(tk.status, 'aprobado', 'TikTok en automático');
  assert.ok(!/https?:/.test(tk.copy_final));
  pipe.shareApproved(ig.id); await pipe.idle();
  assert.equal(db.listPosts({ clientId: client.id }).length, 3, 'no duplica');
  pipe.rejectPost(ig.id, 'no');
  assert.equal(db.getPost(fb.id).status, 'rechazado');
});

test('reglas del texto adaptado', () => {
  const errs = adaptIssues('tiktok', { copy: 'Comenta AGENTE https://x.com', hashtags: [] }, {}, null);
  assert.ok(errs.some((e) => /link/.test(e)) && errs.some((e) => /comenta/i.test(e)) && errs.some((e) => /hashtags/.test(e)));
});

function mockFetch(handler) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method, body: opts.body, headers: opts.headers });
    const [status, body] = handler(String(url), opts);
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  };
  return { calls, restore: () => { globalThis.fetch = orig; } };
}

test('TikTok: consulta al creador, sube el video y espera a que se publique', async () => {
  const video = path.join(dir, 't.mp4'); fs.writeFileSync(video, Buffer.alloc(1000));
  let polls = 0;
  const m = mockFetch((u) => {
    if (u.includes('creator_info')) return [200, { data: { creator_username: 'kuper', privacy_level_options: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'] }, error: { code: 'ok' } }];
    if (u.includes('video/init')) return [200, { data: { publish_id: 'P1', upload_url: 'https://upload.tiktok/x' }, error: { code: 'ok' } }];
    if (u.startsWith('https://upload.tiktok')) return [201, ''];
    if (u.includes('status/fetch')) return [200, { data: ++polls < 2 ? { status: 'PROCESSING_UPLOAD' } : { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: [777] }, error: { code: 'ok' } }];
    return [404, {}];
  });
  try {
    const r = await publishTikTok({ access_token: 'T' }, { caption: 'hola #pymes', videoFile: video, privacy: 'PUBLIC_TO_EVERYONE' }, { pollMs: 1 });
    assert.equal(r.url, 'https://www.tiktok.com/@kuper/video/777');
    const init = JSON.parse(m.calls[1].body);
    assert.equal(init.source_info.video_size, 1000);
    assert.equal(init.post_info.is_aigc, true);
    assert.equal(m.calls[2].headers['Content-Range'], 'bytes 0-999/1000');
  } finally { m.restore(); }
});

test('TikTok: renueva el token cuando está por vencer', async () => {
  const m = mockFetch(() => [200, { access_token: 'NUEVO', refresh_token: 'R2', expires_in: 86400, refresh_expires_in: 31536000, open_id: 'O' }]);
  try {
    let saved;
    const tk = await freshTikTokCreds({ access_token: 'VIEJO', refresh_token: 'R1', expires_at: new Date().toISOString(), refresh_expires_at: '2099-01-01T00:00:00Z' }, (n) => { saved = n; });
    assert.equal(tk.access_token, 'NUEVO');
    assert.equal(saved.refresh_token, 'R2');
    assert.equal(new URLSearchParams(m.calls[0].body).get('grant_type'), 'refresh_token');
  } finally { m.restore(); }
});
