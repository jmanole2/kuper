import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'dif-')), SECRET_KEY: 'k', MOCK_LLM: '1', TZ: 'UTC' });
const db = await import('../src/db.js');
const dif = await import('../src/difusion.js');
db.openDb(':memory:');

const client = db.createClient({ slug: 'd', nombre: 'Dental', perfil: { cliente: 'D', pilares_de_contenido: [{ nombre: 'x' }] },
  config: { plan: { servicios: { chat: true } } }, credentials: { whatsapp: { token: 'T', phone_id: 'PH', waba_id: 'W' } } });
const lead = (nombre, telefono, extra = {}) => { const l = db.upsertLead(client.id, { nombre, telefono, origen: 'whatsapp' }); if (extra.tags) db.getDb().prepare('UPDATE leads SET tags_json = ? WHERE id = ?').run(JSON.stringify(extra.tags), l.id);
  if (extra.updated) db.getDb().prepare('UPDATE leads SET updated_at = ? WHERE id = ?').run(extra.updated, l.id); return l; };
const ana = lead('Ana Torres', '5215511111111', { tags: ['vip'], updated: '2026-01-01 10:00:00' });
lead('Luis', '5215522222222', { tags: ['baja'] });
db.upsertLead(client.id, { nombre: 'Sin tel', email: 'sintel@x.mx', origen: 'web' });
db.upsertLead(client.id, { usuario: 'solo_ig', origen: 'instagram' });
const mar = lead('Mar', '5215533333333', { updated: '2026-01-01 10:00:00' });

const llamadas = [];
let falla = false;
dif.hooks.fetch = async (url, opts = {}) => {
  llamadas.push({ url: String(url), body: opts.body ? JSON.parse(opts.body) : null });
  if (String(url).includes('message_templates')) return new Response(JSON.stringify({ data: [{ name: 'reactivar', language: 'es_MX', status: 'APPROVED', category: 'MARKETING', components: [{ type: 'BODY', text: 'Hola {{1}}, te extrañamos en {{2}}' }] }, { name: 'x', status: 'REJECTED' }] }));
  if (falla) return new Response(JSON.stringify({ error: { message: 'Template name does not exist' } }), { status: 400 });
  return new Response(JSON.stringify({ messages: [{ id: 'wamid' }] }));
};
const enHorario = new Date('2026-11-12T17:00:00Z'); // 11:00 en CDMX

test('segmento: filtra y excluye sin WhatsApp y con baja', () => {
  const s = dif.segmento(client, {});
  assert.deepEqual(s.leads.map((l) => l.nombre).sort(), ['Ana Torres', 'Mar']);
  assert.equal(s.excluidos.baja, 1);
  assert.ok(s.excluidos.sin_whatsapp >= 1);
  assert.deepEqual(dif.segmento(client, { tags: 'VIP' }).leads.map((l) => l.nombre), ['Ana Torres']);
  assert.equal(dif.segmento(client, { sin_actividad: 30 }, { ahora: enHorario }).leads.length, 2);
});

test('plantillas aprobadas de la cuenta y variables', async () => {
  const p = await dif.plantillas(client);
  assert.deepEqual(p.map((t) => t.nombre), ['reactivar']);
  assert.equal(dif.cuantasVariables(p[0].cuerpo), 2);
  assert.equal(dif.render(p[0].cuerpo, dif.valores(client, ana, [{ fuente: 'nombre' }, { fuente: 'texto', texto: 'Dental' }])), 'Hola Ana, te extrañamos en Dental');
});

test('nada sale sin aprobar; aprobada se envía escalonada, en horario y no repite', async () => {
  const c = dif.crear(client, { nombre: 'Reactivar', plantilla: 'reactivar', cuerpo: 'Hola {{1}}, te extrañamos en {{2}}', variables: [{ fuente: 'nombre' }, { fuente: 'texto', texto: 'Dental' }], tope_diario: 250 }, 'Paty');
  assert.equal(c.estado, 'borrador');
  llamadas.length = 0;
  assert.equal((await dif.enviarPendientes(client, { ahora: enHorario })).enviados, 0);
  dif.cambiarEstado(client, c.id, 'aprobar', 'Dra. Ruiz');
  assert.equal((await dif.enviarPendientes(client, { ahora: new Date('2026-11-12T05:00:00Z') })).fuera_de_horario, true); // 23:00 en CDMX
  const r = await dif.enviarPendientes(client, { ahora: enHorario });
  assert.equal(r.enviados, 2);
  const envio = llamadas.find((x) => x.url.includes('/PH/messages') && x.body.to === '525511111111');
  assert.equal(envio.body.template.name, 'reactivar');
  assert.deepEqual(envio.body.template.components[0].parameters.map((p) => p.text), ['Ana', 'Dental']);
  assert.match(db.leadMessages(ana.id).at(-1).texto, /Hola Ana, te extrañamos/);
  await dif.enviarPendientes(client, { ahora: enHorario }); // sin pendientes: termina
  const fin = dif.obtener(client.id, c.id);
  assert.equal(fin.estado, 'terminada');
  assert.equal(fin.aprobada_por, 'Dra. Ruiz');
  // quien respondió cuenta
  db.addLeadMessage(client.id, { telefono: '5215511111111' }, { rol: 'lead', texto: 'Sí, quiero cita' });
  assert.equal(dif.metricas(c.id).respondieron, 1);
  // frecuencia: ya no entran en otra campaña esta semana
  assert.equal(dif.segmento(client, {}).leads.length, 0);
  assert.throws(() => dif.crear(client, { nombre: 'Otra', plantilla: 'reactivar' }, 'x'), /no tiene contactos/);
});

test('si fallan varios seguidos, la campaña se pausa', async () => {
  db.getDb().exec('DELETE FROM difusion_envios');
  for (let i = 0; i < 4; i++) lead(`P${i}`, `52155444444${i}0`);
  const c = dif.crear(client, { nombre: 'Mala', plantilla: 'no_existe' }, 'x');
  dif.cambiarEstado(client, c.id, 'aprobar', 'x');
  falla = true;
  await dif.enviarPendientes(client, { ahora: enHorario });
  const x = dif.obtener(client.id, c.id);
  assert.equal(x.estado, 'pausada');
  assert.match(x.error, /does not exist/);
  falla = false;
  assert.equal(dif.reintentarErrores(client, c.id), 3);
  dif.cambiarEstado(client, c.id, 'reanudar', 'x');
  await dif.enviarPendientes(client, { ahora: enHorario });
  assert.ok(dif.metricas(c.id).enviados >= 3);
  assert.throws(() => dif.cambiarEstado(client, c.id, 'aprobar', 'x'), /no aplica/);
});

test('automática: cada día agrega a quien entra al segmento y no se termina', async () => {
  db.getDb().exec('DELETE FROM difusion_envios');
  const c = dif.crear(client, { nombre: 'Recompra 30 días', plantilla: 'recompra', filtros: { tags: 'recompra' }, recurrente: '1' }, 'x');
  assert.equal(c.recurrente, 1);
  dif.cambiarEstado(client, c.id, 'aprobar', 'x');
  await dif.enviarPendientes(client, { ahora: enHorario });
  assert.equal(dif.obtener(client.id, c.id).estado, 'enviando'); // vacía pero sigue activa
  lead('Nuevo cliente', '5215566667777', { tags: ['recompra'] });
  db.getDb().prepare("UPDATE difusiones SET revisada_at = datetime('now', '-1 day') WHERE id = ?").run(c.id);
  const r = await dif.enviarPendientes(client, { ahora: enHorario });
  assert.equal(r.enviados, 1);
  db.getDb().prepare("UPDATE difusiones SET revisada_at = datetime('now', '-1 day') WHERE id = ?").run(c.id);
  assert.equal((await dif.enviarPendientes(client, { ahora: enHorario })).enviados, 0); // no repite a la misma persona
});
