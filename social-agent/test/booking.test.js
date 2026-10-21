// Página pública para agendar (/agendar/<slug>): muestra horarios libres y crea la cita sin encimarse.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'booking-')), SECRET_KEY: 'x', TIMEZONE: 'America/Mexico_City', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'x' });
const db = await import('../src/db.js');
const agenda = await import('../src/agenda/index.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');
const client = db.createClient({ slug: 'kuper', nombre: 'Kuper', perfil: { cliente: 'K', pilares_de_contenido: [{ nombre: 'x' }] }, config: { agenda: { calendar_id: 'cal@x', anticipacion_horas: 0, horario: { lun: ['09:00', '18:00'], mar: ['09:00', '18:00'], mie: ['09:00', '18:00'], jue: ['09:00', '18:00'], vie: ['09:00', '18:00'], sab: ['09:00', '18:00'], dom: ['09:00', '18:00'] } } }, credentials: {} });
const creados = [];
agenda.hooks.busy = async () => creados.map((e) => [new Date(e.start.dateTime).getTime(), new Date(e.end.dateTime).getTime()]);
agenda.hooks.insert = async (ev) => { creados.push(ev); return { id: `e${creados.length}` }; };

const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());
const post = (body) => fetch(`${base}/agendar/kuper`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });

test('muestra los horarios libres con nombre y teléfono prellenados', async () => {
  const r = await fetch(`${base}/agendar/kuper?n=Ana&tel=5215511112222`);
  const h = await r.text();
  assert.equal(r.status, 200);
  assert.match(h, /type="radio" name="inicio"/);
  assert.match(h, /value="Ana"/);
  assert.match(h, /value="5215511112222"/);
  assert.equal((await fetch(`${base}/agendar/otro`)).status, 404);
});

test('agenda la cita, registra el lead y ese horario ya no se ofrece', async () => {
  const h = await (await fetch(`${base}/agendar/kuper`)).text();
  const inicio = h.match(/name="inicio" value="([^"]+)"/)[1];
  const r = await post({ inicio, nombre: 'Ana', telefono: '55 1111 2222', motivo: 'SEO' });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /quedó agendada/);
  assert.equal(creados.length, 1);
  const lead = db.listLeads(client.id)[0];
  assert.equal(lead.telefono, '+525511112222');
  assert.equal(lead.estado, 'cita');
  assert.ok(!(await (await fetch(`${base}/agendar/kuper`)).text()).includes(`value="${inicio}"`));
  const again = await post({ inicio, nombre: 'Beto', telefono: '5522223333' });
  assert.equal(again.status, 409);
  assert.match(await again.text(), /se acaba de ocupar/);
  assert.equal(creados.length, 1);
});

test('rechaza bots (campo trampa) y teléfonos inválidos', async () => {
  assert.equal((await post({ inicio: 'x', nombre: 'Bot', telefono: '5511112222', sitio: 'spam' })).status, 400);
  assert.equal((await post({ inicio: 'x', nombre: 'Ana', telefono: '123' })).status, 400);
});

test('API del agente: mensajes del chat, citas del agente y teléfonos de México sin duplicar', async () => {
  const key = 'llave-prueba-123';
  db.updateClient(client.id, { credentials: { ...db.clientCredentials(client), api_key: key } });
  const api = (m, p, body) => fetch(`${base}/api/kuper${p}`, { method: m, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  assert.equal((await api('POST', '/mensajes', { telefono: '+5215511112222', rol: 'lead', texto: 'Hola' })).status, 200);
  assert.equal((await api('POST', '/mensajes', { telefono: '+5215511112222', rol: 'agente', texto: '¡Hola! ¿En qué te ayudo?' })).status, 200);
  assert.equal((await api('POST', '/mensajes', { telefono: '+5215511112222', rol: 'x', texto: 'no' })).status, 400);
  const leads = db.listLeads(client.id).filter((l) => l.telefono === '+525511112222');
  assert.equal(leads.length, 1, 'el 521 de WhatsApp y el 52 de la página son el mismo lead');
  const msgs = db.leadMessages(leads[0].id);
  assert.deepEqual(msgs.map((m) => m.rol), ['lead', 'agente']);
  const ev = await agenda.agentEvents(client, { listFn: async () => [
    { id: 'a', status: 'confirmed', start: { dateTime: '2030-01-01T16:00:00Z' }, extendedProperties: { private: { kuper: '1', telefono: '+525511112222', nombre: 'Ana' } } },
    { id: 'b', status: 'confirmed', start: { dateTime: '2030-01-01T18:00:00Z' } },
  ] });
  assert.deepEqual(ev, [{ id: 'a', inicio: '2030-01-01T16:00:00Z', telefono: '+525511112222', nombre: 'Ana' }]);
  assert.equal(creados[0].extendedProperties.private.nombre, 'Ana');
});

test('centro de control: números del día, feed y "en vivo"', async () => {
  const { pulse } = await import('../src/pulse.js');
  db.logEvent({ clientId: client.id, tipo: 'publicado', detalle: 'Post de prueba' });
  const p = await pulse(db.listClients(), { conCitas: false });
  assert.ok(p.tareasHoy >= 3, 'cuenta eventos y respuestas del agente de hoy');
  assert.equal(p.horas.length, 24);
  assert.equal(p.serie.length, 14);
  assert.ok(p.feed.some((f) => f.titulo === 'Post publicado'));
  assert.equal(p.vivo.nombre, 'Ana');
  assert.match(p.vivo.texto, /En qué te ayudo/);
  const { controlCenter } = await import('../src/web/control.js');
  const h = String(controlCenter(p, db.listClients()));
  assert.match(h, /id="cc-orb"/);
  assert.ok(!h.includes('<script>alert'), 'escapa el texto');
  assert.notEqual((await fetch(`${base}/admin/pulso.json`, { redirect: 'manual' })).status, 200, 'pide sesión');
});
