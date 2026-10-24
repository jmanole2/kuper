// Flujo completo con MOCK_LLM y DRY_RUN: generar → aprobar → publicar, cambios y asset real.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agente-'));
Object.assign(process.env, { DATA_DIR: dir, MOCK_LLM: '1', DRY_RUN: '1', SECRET_KEY: 'test-secret', GEMINI_API_KEY: '' });
const db = await import('../src/db.js');
const pipe = await import('../src/pipeline.js');

db.openDb(':memory:');
const client = db.createClient({
  slug: 'demo', nombre: 'Demo',
  perfil: {
    cliente: 'Demo', cta_preferido: 'Escríbenos', permite_emojis: false, temas_prohibidos: [], colores_marca: ['#0b3d91', '#ffffff', '#ffb000'],
    pilares_de_contenido: [{ nombre: 'tips', requiere_imagen_real: false }, { nombre: 'portafolio', requiere_imagen_real: true }],
  },
  config: {
    instagram: { activo: true, frecuencia: 'semanal', modo_publicacion: 'aprobacion', formatos: ['imagen_estatica'] },
    facebook: { activo: true, frecuencia: 'semanal', modo_publicacion: 'auto', formatos: ['solo_texto'] },
  },
  credentials: { meta: { page_id: 'P', ig_user_id: 'I', page_token: 'secreto' } },
});

test('las credenciales se guardan cifradas', () => {
  const raw = db.getDb().prepare('SELECT credentials_enc FROM clients WHERE id = ?').get(client.id).credentials_enc;
  assert.ok(!raw.includes('secreto'));
  assert.equal(db.clientCredentials(db.getClient(client.id)).meta.page_token, 'secreto');
});

test('modo aprobación: genera con imagen y espera al cliente', { timeout: 120_000 }, async () => {
  const p = await pipe.generateForPlatform(client.id, 'instagram');
  assert.equal(p.status, 'pendiente');
  assert.equal(p.salida.variantes_copy.length, 2);
  assert.ok(fs.existsSync(p.image_path), 'debe existir la imagen');
  assert.equal(await pipe.generateForPlatform(client.id, 'instagram'), null, 'no duplica posts abiertos');

  const ok = pipe.approvePost(p.id, { variante: 1 });
  assert.equal(ok.status, 'aprobado');
  assert.equal(ok.copy_final, p.salida.variantes_copy[1].copy);

  await pipe.publishDue(new Date(Date.parse(ok.scheduled_at) - 60_000));
  assert.equal(db.getPost(p.id).status, 'aprobado', 'no publica antes de tiempo');
  await pipe.publishDue(new Date(Date.parse(ok.scheduled_at) + 1000));
  const pub = db.getPost(p.id);
  assert.equal(pub.status, 'publicado');
  assert.match(pub.external_id, /^dry-run/);
});

test('modo auto: queda aprobado sin intervención', { timeout: 60_000 }, async () => {
  const p = await pipe.generateForPlatform(client.id, 'facebook');
  assert.equal(p.status, 'aprobado');
  assert.equal(p.formato, 'solo_texto');
});

test('pedir cambios regenera el post y conserva la fecha', { timeout: 120_000 }, async () => {
  const p = await pipe.generateForPlatform(client.id, 'instagram');
  pipe.requestChanges(p.id, 'Más corto');
  await pipe.idle();
  const r = db.getPost(p.id);
  assert.equal(r.status, 'pendiente');
  assert.match(r.tema, /corregido/);
  assert.equal(r.scheduled_at, p.scheduled_at);
});

test('subir el asset real pasa el post a aprobación', () => {
  const p = db.createPost({ client_id: client.id, plataforma: 'linkedin', status: 'necesita_asset' });
  const f = path.join(dir, 'foto.jpg');
  fs.writeFileSync(f, 'x');
  pipe.attachAsset(p.id, f, 'image/jpeg');
  assert.equal(db.getPost(p.id).status, 'pendiente');
});

test('temas que pide el cliente: la siguiente publicación usa la primera idea y la quita', { timeout: 60_000 }, async () => {
  pipe.agregarTema(client.id, 'Nuestra promoción de diciembre');
  pipe.agregarTema(client.id, 'El nuevo horario');
  assert.throws(() => pipe.agregarTema(client.id, ' '), /Escribe de qué/);
  const p = await pipe.generateForPlatform(client.id, 'facebook', { force: true });
  assert.equal(p.tema, 'Sobre: Nuestra promoción de diciembre');
  assert.deepEqual(pipe.temasPendientes(db.getClient(client.id)).map((t) => t.texto), ['El nuevo horario']);
  // con tema explícito (publicación extra) no toca la lista
  const q = await pipe.generateForPlatform(client.id, 'facebook', { force: true, tema: 'Un cliente feliz' });
  assert.equal(q.tema, 'Sobre: Un cliente feliz');
  assert.equal(pipe.temasPendientes(db.getClient(client.id)).length, 1);
  pipe.quitarTema(client.id, 0);
  assert.equal(pipe.temasPendientes(db.getClient(client.id)).length, 0);
});

test('se puede subir (o reintentar) la historia de un post ya publicado', async () => {
  const p = db.createPost({ client_id: client.id, plataforma: 'instagram', status: 'generando' });
  db.updatePost(p.id, { status: 'publicado' });
  assert.equal(await pipe.publishStoryOf(p.id), true);
  assert.deepEqual(db.postEvents(p.id).map((e) => e.tipo).slice(0, 2), ['historia_publicada', 'historia_subiendo']);
  const fb = db.createPost({ client_id: client.id, plataforma: 'facebook', status: 'generando' });
  assert.equal(await pipe.publishStoryOf(fb.id), false, 'solo Instagram tiene historias');
});
