// Aviso diario por correo y ritmo de generación (una pieza al día, de madrugada).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agente-aviso-'));
Object.assign(process.env, {
  DATA_DIR: dir, MOCK_LLM: '1', DRY_RUN: '1', SECRET_KEY: 'test-secret', TIMEZONE: 'America/Mexico_City',
  MAX_PIEZAS_DIA: '1', HORAS_GENERACION: '01-06', HORA_AVISO: '09:00',
});
const db = await import('../src/db.js');
const pipe = await import('../src/pipeline.js');
const { notifyClient, digestMessage } = await import('../src/notify.js');

db.openDb(':memory:');
const perfil = { cliente: 'Demo', pilares_de_contenido: [{ nombre: 'tips' }] };
const client = db.createClient({
  slug: 'demo', nombre: 'Demo', perfil,
  config: {
    instagram: { activo: true, frecuencia: 'semanal', modo_publicacion: 'aprobacion' },
    facebook: { activo: true, frecuencia: 'semanal', modo_publicacion: 'aprobacion' },
    notificaciones: { email: 'cliente@example.com', whatsapp: false },
  },
  credentials: {},
});

// Horas en Ciudad de México (UTC-6).
const mx = (fecha, hora) => new Date(`${fecha}T${hora}:00-06:00`);

test('genera solo en la ventana de madrugada', () => {
  assert.equal(pipe.inGenerationWindow(mx('2026-10-20', '03:00')), true);
  assert.equal(pipe.inGenerationWindow(mx('2026-10-20', '06:00')), false);
  assert.equal(pipe.inGenerationWindow(mx('2026-10-20', '14:00')), false);
  assert.equal(pipe.inGenerationWindow(mx('2026-10-20', '23:00'), '22-04'), true);
  assert.equal(pipe.inGenerationWindow(mx('2026-10-20', '12:00'), ''), true);
});

test('una pieza al día: la más próxima primero', () => {
  const now = new Date();
  const cands = pipe.generationCandidates(now);
  assert.equal(cands.length, 2);
  assert.ok(cands[0].scheduledAt <= cands[1].scheduledAt);
  assert.equal(pipe.piecesLeftToday(now), 1);
  db.createPost({ client_id: client.id, plataforma: 'instagram', status: 'pendiente', scheduled_at: cands[0].scheduledAt });
  assert.equal(pipe.piecesLeftToday(now), 0, 'ya se generó la de hoy');
  assert.equal(pipe.generationCandidates(now).length, 1, 'instagram ya tiene post abierto');
});

test('aviso por correo: uno al día, solo con posts nuevos y después de la hora', async () => {
  const sent = [];
  const send = async (m) => { sent.push(m); };
  const p = db.listPosts({ clientId: client.id })[0];
  db.updatePost(p.id, { tema: 'Tu negocio contesta a las 11 p. m.' });
  const manana = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);

  assert.equal((await notifyClient(client, mx(manana, '08:00'), { send })).skip, 'antes_de_hora');
  const r = await notifyClient(client, mx(manana, '09:05'), { send });
  assert.equal(r.posts, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'cliente@example.com');
  assert.match(sent[0].text, /\/p\//);
  assert.match(sent[0].subject, /1 publicación lista para revisar/);

  assert.equal((await notifyClient(client, mx(manana, '15:00'), { send })).skip, 'ya_avisado_hoy');
  const pasado = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
  assert.equal((await notifyClient(client, mx(pasado, '09:30'), { send })).skip, 'nada_nuevo', 'no repite los mismos posts');
  assert.equal(sent.length, 1);
});

test('sin correo configurado no avisa', async () => {
  const otro = db.createClient({ slug: 'otro', nombre: 'Otro', perfil, config: { instagram: { activo: false } }, credentials: {} });
  assert.equal((await notifyClient(otro, new Date())).skip, 'sin_destinatario');
});

test('el correo escapa el HTML', () => {
  const m = digestMessage({ ...client, portal_token: 'x' }, [{ plataforma: 'instagram', status: 'pendiente', tema: '<b>hola</b>', scheduled_at: new Date().toISOString() }]);
  assert.ok(!m.html.includes('<b>hola</b>'));
});

test('al arrancar, lo que quedó a medias por un reinicio se libera', () => {
  const p = db.createPost({ client_id: client.id, plataforma: 'facebook', status: 'generando' });
  assert.equal(db.recoverInterrupted(), 1);
  assert.equal(db.getPost(p.id).status, 'error_generacion');
});
