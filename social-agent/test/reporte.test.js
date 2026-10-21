// Métricas de redes y reporte mensual.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'reporte-')), SECRET_KEY: 'x', TIMEZONE: 'America/Mexico_City', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123' });
const db = await import('../src/db.js');
const met = await import('../src/metricas.js');
const { reporteCorreo } = await import('../src/web/reporte.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');
const c = db.createClient({ slug: 'sabor', nombre: 'Buen Sabor', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] },
  config: { instagram: { activo: true }, notificaciones: { email: 'dueno@sabor.mx' } }, credentials: { meta: { page_id: 'P1', ig_user_id: 'IG1', page_token: 't' } } });

let seguidores = 1000;
met.hooks.graph = async (_m, p, params) => {
  if (p === 'IG1') return { followers_count: seguidores, media_count: 40, username: 'buensabor' };
  if (p === 'IG1/media') return { data: [
    { id: 'm1', media_type: 'IMAGE', permalink: 'https://ig/p/1', timestamp: '2030-03-10T18:00:00+0000', like_count: 120, comments_count: 8, media_url: 'https://cdn/1.jpg', caption: 'Tacos al pastor' },
    { id: 'm2', media_type: 'VIDEO', permalink: 'https://ig/p/2', timestamp: '2030-03-12T18:00:00+0000', like_count: 300, comments_count: 20, thumbnail_url: 'https://cdn/2.jpg', caption: 'Reel <script>' },
  ] };
  if (p.endsWith('/insights')) { if (p.startsWith('m2')) return { data: [{ name: 'reach', values: [{ value: 5400 }] }, { name: 'total_interactions', values: [{ value: 350 }] }] }; throw new Error('sin permiso'); }
  if (p === 'P1') return { followers_count: 800, name: 'Buen Sabor' };
  throw new Error('?');
};

test('foto diaria de Instagram y Facebook, y resumen del mes', async () => {
  await met.recolectar(c, new Date('2030-03-01T18:00:00Z'));
  seguidores = 1085;
  const r0 = await met.recolectar(c, new Date('2030-03-20T18:00:00Z'));
  assert.equal(r0.instagram.seguidores, 1085);
  assert.equal(r0.facebook.seguidores, 800);
  const p = db.createPost({ client_id: c.id, plataforma: 'instagram', status: 'publicado' });
  db.getDb().prepare("UPDATE posts SET published_at = '2030-03-10T18:00:00Z' WHERE id = ?").run(p.id);
  db.addLeadMessage(c.id, { telefono: '+525511112222', nombre: 'Ana', origen: 'whatsapp' }, { rol: 'lead', texto: 'Hola' });
  db.addLeadMessage(c.id, { telefono: '+525511112222' }, { rol: 'agente', texto: 'Hola Ana' });
  db.getDb().prepare("UPDATE lead_mensajes SET created_at = '2030-03-15 18:00:00'").run();
  db.getDb().prepare("UPDATE leads SET created_at = '2030-03-15 18:00:00', estado = 'cita', cita_inicio = '2030-03-18T16:00:00Z'").run();
  const r = met.resumenMes(c, '2030-03');
  assert.equal(r.publicaciones, 1);
  assert.equal(r.respuestas, 1);
  assert.equal(r.leads, 1);
  assert.equal(r.citas, 1);
  assert.deepEqual(r.porOrigen, { whatsapp: 1 });
  assert.equal(r.instagram.seguidores, 1085);
  assert.equal(r.instagram.crecimiento, 85);
  assert.equal(r.top[0].id, 'm2', 'la mejor publicación primero');
  assert.equal(r.top[0].alcance, 5400);
  assert.equal(r.top[1].interacciones, 128, 'sin permiso de insights usa likes + comentarios');
});

test('correo del reporte el día 1 a las 9:00, una sola vez', async () => {
  const enviados = [];
  const send = async (m) => enviados.push(m);
  assert.equal((await met.enviarReporteSiToca(c, new Date('2030-04-01T14:00:00Z'), { send, armar: reporteCorreo })).skip, 'temprano');
  const r = await met.enviarReporteSiToca(c, new Date('2030-04-01T16:00:00Z'), { send, armar: reporteCorreo });
  assert.equal(r.mes, '2030-03');
  assert.equal(enviados[0].to, 'dueno@sabor.mx');
  assert.match(enviados[0].subject, /marzo/i);
  assert.match(enviados[0].html, new RegExp(`/p/${db.getClient(c.id).portal_token}/reporte\\?mes=2030-03`));
  assert.equal((await met.enviarReporteSiToca(c, new Date('2030-04-02T16:00:00Z'), { send, armar: reporteCorreo })).skip, 'ya_enviado');
  assert.equal(enviados.length, 1);
});

test('el reporte se ve en el portal, en /app y en el admin (y escapa el texto de Instagram)', async () => {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const h = await (await fetch(`${base}/p/${db.getClient(c.id).portal_token}/reporte?mes=2030-03`)).text();
    assert.match(h, /Descargar PDF/);
    assert.match(h, /Tus mejores publicaciones/);
    assert.ok(!h.includes('Reel <script>') && h.includes('Reel &lt;script&gt;'));
    const r = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'email=&password=maestra-123' });
    const ck = r.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(`${base}/admin/clientes/${c.id}?tab=reporte&mes=2030-03`, { headers: { cookie: ck } })).status, 200);
    assert.equal((await fetch(`${base}/app/reporte?c=${c.id}`, { headers: { cookie: ck } })).status, 200);
  } finally { server.close(); }
});
