// Agenda: reglas de horario (45 min, 15 de margen, 4 h de anticipación, lun-jue 9-18) y sin citas encimadas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'agenda-')), SECRET_KEY: 'x', TIMEZONE: 'America/Mexico_City', LOG_EVENTOS: '0' });
const db = await import('../src/db.js');
const agenda = await import('../src/agenda/index.js');
db.openDb(':memory:');
const client = db.createClient({ slug: 'k', nombre: 'K', perfil: { cliente: 'K', pilares_de_contenido: [{ nombre: 'x' }] }, config: { agenda: { calendar_id: 'cal@x' } }, credentials: {} });
const mx = (s) => new Date(`${s}-06:00`);

test('horarios: solo lunes a jueves de 9 a 18, cada 30 min, terminando antes de las 18', () => {
  const s = agenda.candidateSlots(agenda.agendaCfg(client), { now: mx('2030-10-14T00:00:00'), dias: 7 }); // lunes
  const days = new Set(s.map((x) => new Date(x.start).toLocaleDateString('en-US', { timeZone: 'America/Mexico_City', weekday: 'short' })));
  assert.deepEqual([...days], ['Mon', 'Tue', 'Wed', 'Thu']);
  const lunes = s.filter((x) => new Date(x.start) < mx('2030-10-15T00:00:00'));
  assert.equal(new Date(lunes[0].start).toISOString(), mx('2030-10-14T09:00:00').toISOString());
  assert.equal(new Date(lunes.at(-1).start).toISOString(), mx('2030-10-14T17:00:00').toISOString(), '17:00 + 45 min cabe; 17:30 no');
});

test('respeta 4 horas de anticipación', () => {
  const s = agenda.candidateSlots(agenda.agendaCfg(client), { now: mx('2030-10-14T10:10:00'), dias: 1 });
  assert.equal(new Date(s[0].start).toISOString(), mx('2030-10-14T14:30:00').toISOString());
});

test('deja 15 min de margen con lo ocupado (incluidas citas puestas a mano)', async () => {
  const ocupado = [[mx('2030-10-14T10:00:00').getTime(), mx('2030-10-14T10:45:00').getTime()]];
  const libres = await agenda.availability(client, { now: mx('2030-10-14T00:00:00'), dias: 1, busyFn: async () => ocupado });
  const horas = libres.map((x) => new Date(x.inicio).toLocaleTimeString('en-GB', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' }));
  assert.ok(!horas.includes('09:30') && !horas.includes('10:00') && !horas.includes('10:30'), horas.join(' '));
  assert.ok(horas.includes('09:00'), '9:00-9:45 deja justo 15 min antes de las 10:00');
  assert.ok(horas.includes('11:00'));
});

test('dos personas pidiendo el mismo horario a la vez: solo una lo obtiene', async () => {
  const ocupado = [];
  const busyFn = async () => ocupado.slice();
  const insertFn = async (ev) => { await new Promise((r) => setTimeout(r, 20)); ocupado.push([new Date(ev.start.dateTime).getTime(), new Date(ev.end.dateTime).getTime()]); return { id: 'e' + ocupado.length }; };
  const now = mx('2030-10-14T00:00:00'), inicio = mx('2030-10-15T11:00:00').toISOString();
  const r = await Promise.allSettled([
    agenda.book(client, { inicio, nombre: 'Ana' }, { now, busyFn, insertFn }),
    agenda.book(client, { inicio, nombre: 'Luis' }, { now, busyFn, insertFn }),
  ]);
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1);
  assert.ok(r.find((x) => x.status === 'rejected').reason instanceof agenda.SlotTaken);
});

test('no deja agendar fuera de horario', async () => {
  await assert.rejects(agenda.book(client, { inicio: mx('2030-10-18T11:00:00').toISOString() }, { now: mx('2030-10-14T00:00:00'), busyFn: async () => [], insertFn: async () => ({}) }), agenda.SlotTaken);
});

test('leads: se juntan por teléfono y no retroceden de estado', () => {
  db.upsertLead(client.id, { telefono: '+52 55 1234 5678', origen: 'whatsapp', estado: 'cita' });
  const l = db.upsertLead(client.id, { telefono: '+525512345678', nombre: 'Ana', origen: 'whatsapp', estado: 'nuevo' });
  assert.equal(l.nombre, 'Ana');
  assert.equal(l.estado, 'cita');
  assert.equal(db.listLeads(client.id).length, 1);
});

test('ultima_cita: la última cita del día empieza a esa hora como máximo', () => {
  const cfg = { ...agenda.AGENDA_DEFAULT, ultima_cita: '16:00', anticipacion_horas: 0 };
  const slots = agenda.candidateSlots(cfg, { now: new Date('2030-01-07T06:00:00Z'), dias: 1 }); // lunes en CDMX
  const fmt = (ms) => new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
  assert.equal(fmt(slots.at(-1).start), '16:00');
  assert.equal(fmt(slots[0].start), '09:00');
});

test('groupRecurring junta las repeticiones de un evento semanal', () => {
  const ev = (id, rec, d) => ({ id, recurringEventId: rec, summary: rec || id, start: { dateTime: d } });
  const g = agenda.groupRecurring([ev('a1', 'A', '2030-01-01T18:00:00Z'), ev('x', null, '2030-01-02T18:00:00Z'), ev('a2', 'A', '2030-01-08T18:00:00Z'), ev('a3', 'A', '2030-01-15T18:00:00Z')]);
  assert.equal(g.length, 2);
  assert.deepEqual(g[0].repeticiones, ['2030-01-08T18:00:00Z', '2030-01-15T18:00:00Z']);
  assert.equal(g[1].repeticiones.length, 0);
});

test('cancelEvent solo borra citas que agendó el agente', async () => {
  let borrado = false;
  await assert.rejects(agenda.cancelEvent(client, 'm1', { getFn: async () => ({ id: 'm1' }), deleteFn: async () => { borrado = true; } }), agenda.SlotTaken);
  assert.equal(borrado, false);
  await agenda.cancelEvent(client, 'k1', { getFn: async () => ({ id: 'k1', extendedProperties: { private: { kuper: '1' } } }), deleteFn: async () => { borrado = true; } });
  assert.equal(borrado, true);
});
