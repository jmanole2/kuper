import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'rec-')), SECRET_KEY: 'k', MOCK_LLM: '1' });
const db = await import('../src/db.js');
const dif = await import('../src/difusion.js');
const rec = await import('../src/recordatorios.js');
db.openDb(':memory:');

const client = db.createClient({ slug: 'r', nombre: 'Clínica', perfil: { cliente: 'C', pilares_de_contenido: [{ nombre: 'x' }] },
  config: { recordatorios: rec.limpiar({ activo: '1', plantilla: 'recordatorio_cita', horas: '24, 2', cuerpo: 'Hola {{1}}, tu cita es el {{2}} a las {{3}}' }) },
  credentials: { whatsapp: { token: 'T', phone_id: 'PH' } } });
const enviados = [];
dif.hooks.fetch = async (url, opts) => { enviados.push(JSON.parse(opts.body)); return new Response(JSON.stringify({ messages: [{ id: 'w' }] })); };

const cita = new Date('2026-11-13T17:30:00Z'); // 11:30 a. m. en CDMX
const l = db.upsertLead(client.id, { nombre: 'Laura Gómez', telefono: '5512345678', origen: 'web', estado: 'cita', cita_inicio: cita.toISOString(), cita_evento: 'e1' });
db.upsertLead(client.id, { nombre: 'Sin tel', email: 'x@x.mx', origen: 'web', estado: 'cita', cita_inicio: cita.toISOString() });
const c = () => db.getClient(client.id);

test('ajustes: horas limpias y ordenadas', () => {
  assert.deepEqual(rec.limpiar({ horas: '2, 24, 900, x' }).horas, [24, 2]);
});

test('manda el de 24 h, luego el de 2 h, y no repite', async () => {
  assert.equal((await rec.enviar(c(), { ahora: new Date('2026-11-12T10:00:00Z') })).enviados, 0); // faltan 31 h
  assert.equal((await rec.enviar(c(), { ahora: new Date('2026-11-12T18:00:00Z') })).enviados, 1); // faltan 23.5 h (12:00 CDMX)
  assert.equal(enviados[0].template.name, 'recordatorio_cita');
  assert.deepEqual(enviados[0].template.components[0].parameters.map((p) => p.text), ['Laura', 'viernes, 13 de noviembre', '11:30 a.m.']);
  assert.match(db.leadMessages(l.id).at(-1).texto, /Hola Laura, tu cita es el viernes/);
  assert.equal((await rec.enviar(c(), { ahora: new Date('2026-11-12T19:00:00Z') })).enviados, 0);
  assert.equal((await rec.enviar(c(), { ahora: new Date('2026-11-13T16:00:00Z') })).enviados, 1); // faltan 1.5 h
  assert.equal((await rec.enviar(c(), { ahora: new Date('2026-11-13T16:30:00Z') })).enviados, 0);
  assert.equal(rec.recientes(client.id).length, 2);
});

test('de noche no manda el de 24 h; si la cita cambia, vuelve a recordar', async () => {
  db.getDb().prepare('UPDATE leads SET cita_inicio = ? WHERE id = ?').run('2026-11-15T15:00:00.000Z', l.id); // 9:00 CDMX del domingo
  const n = enviados.length;
  assert.equal((await rec.enviar(c(), { ahora: new Date('2026-11-14T16:00:00Z') })).enviados, 1); // 10:00 CDMX del día anterior
  assert.equal(enviados.length, n + 1);
});

test('apagado no manda nada', async () => {
  db.updateClient(client.id, { config: { ...c().config, recordatorios: { ...rec.ajustes(c()), activo: false } } });
  assert.deepEqual(rec.pendientes(c(), new Date('2026-11-15T14:00:00Z')), []);
});
