// Embudo de ventas, ficha del lead, asignación por turnos y analítica.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'embudo-')), SECRET_KEY: 'x', TIMEZONE: 'America/Mexico_City', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123' });
const db = await import('../src/db.js');
const E = await import('../src/embudo.js');
const { hashPassword } = await import('../src/crypto.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');
const perfil = { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] };
let c = db.createClient({ slug: 'inhouse', nombre: 'Inhouse Work', perfil, config: {}, credentials: {} });
const ana = db.createUser({ email: 'ana@inhouse.mx', nombre: 'Ana', rol: 'cliente', client_id: c.id, password_hash: hashPassword('clave-larga-123') });
const beto = db.createUser({ email: 'beto@inhouse.mx', nombre: 'Beto', rol: 'cliente', client_id: c.id, password_hash: hashPassword('clave-larga-123') });

test('etapas propias: nombre = tipo, una por línea', () => {
  const lista = E.parseEtapas('Nuevos = nuevo\nContestado = seguimiento\nEn visita = visita\nClientes = cliente\nPerdidos = perdido');
  assert.deepEqual(lista.map((e) => [e.id, e.tipo]), [['nuevos', 'nuevo'], ['contestado', 'conversacion'], ['en-visita', 'cita'], ['clientes', 'cliente'], ['perdidos', 'perdido']]);
  db.updateClient(c.id, { config: { ...c.config, embudo: lista } });
  c = db.getClient(c.id);
  assert.throws(() => E.parseEtapas('Solo una'), /al menos dos/);
});

test('mover de etapa cambia el estado; el agente solo avanza', () => {
  let l = db.upsertLead(c.id, { telefono: '5512345678', nombre: 'Moshé', origen: 'whatsapp' });
  assert.equal(E.etapaDe(c, l).id, 'nuevos');
  l = E.datosDelAgente(c, l, { etapa: 'en-visita', empresa: 'Acme', resumen: 'Busca oficina para 6 en Polanco', tags: ['oficina'] });
  assert.equal(l.estado, 'cita'); assert.equal(l.empresa, 'Acme'); assert.deepEqual(E.tagsDe(l), ['oficina']);
  l = E.datosDelAgente(c, l, { etapa: 'contestado' });
  assert.equal(E.etapaDe(c, l).id, 'en-visita', 'no retrocede');
  l = E.moverLead(c, l.id, 'clientes');
  assert.equal(l.resultado, 'vendido');
  assert.equal(E.datosDelAgente(c, l, { etapa: 'perdidos' }).estado, 'cliente', 'no saca a un cliente');
});

test('ficha: valor, resultado y asesor; perdido mueve a Perdidos', () => {
  const l = db.upsertLead(c.id, { telefono: '5512340000', origen: 'instagram' });
  const f = E.guardarFicha(c, l.id, { nombre: 'Laura', email: 'Laura@X.mx', valor: '$4,700', resultado: 'perdido', tags: 'terraza, evento', asignado_id: String(ana.id) });
  assert.equal(f.valor, 4700); assert.equal(f.email, 'laura@x.mx'); assert.equal(f.estado, 'perdido'); assert.equal(f.asignado_id, ana.id);
  assert.throws(() => E.guardarFicha(c, l.id, { asignado_id: '999' }), /asesor/);
});

test('asignación por turnos entre asesores', () => {
  const a = E.asignarPorTurno(c, db.upsertLead(c.id, { telefono: '5500000001', origen: 'whatsapp' }));
  const b = E.asignarPorTurno(c, db.upsertLead(c.id, { telefono: '5500000002', origen: 'whatsapp' }));
  assert.notEqual(a.asignado_id, b.asignado_id);
  assert.ok([ana.id, beto.id].includes(a.asignado_id));
});

test('analítica: primera respuesta, fuera de horario y temas', () => {
  const l = db.upsertLead(c.id, { telefono: '5500000009', origen: 'whatsapp' });
  // 23:30 hora de CDMX (05:30 UTC) un martes: fuera de horario
  db.getDb().prepare("UPDATE leads SET created_at = '2026-11-03 05:30:00' WHERE id = ?").run(l.id);
  db.getDb().prepare("INSERT INTO lead_mensajes (lead_id, rol, texto, created_at) VALUES (?, 'lead', '¿Cuál es el precio de una oficina?', '2026-11-03 05:30:00'), (?, 'agente', 'Hola…', '2026-11-03 05:30:20')").run(l.id, l.id);
  const a = E.analitica(c, { dias: 30, ahora: Date.parse('2026-11-05T12:00:00Z') });
  assert.ok(a.fuera >= 1);
  assert.ok(a.primeraAgente < 1, `responde en segundos: ${a.primeraAgente}`);
  assert.equal(a.temas.find(([t]) => t === 'Precio o cotización')[1], 1);
  assert.equal(a.horas[23], 1);
});

test('las páginas se ven y mover por fetch funciona', async () => {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const r = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'ana@inhouse.mx', password: 'clave-larga-123' }) });
    const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
    const emb = await (await fetch(`${base}/app/embudo`, { headers: { cookie } })).text();
    assert.match(emb, /En visita/); assert.match(emb, /Moshé/);
    assert.match(await (await fetch(`${base}/app/analitica?dias=7`, { headers: { cookie } })).text(), /Temas del primer mensaje/);
    const l = db.upsertLead(c.id, { telefono: '5500000077', origen: 'facebook' });
    const m = await fetch(`${base}/app/embudo/mover`, { method: 'POST', headers: { cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ lead: String(l.id), etapa: 'contestado' }) });
    assert.equal(m.status, 200);
    assert.equal(db.getLead(c.id, l.id).etapa, 'contestado');
    assert.match(await (await fetch(`${base}/app/leads/${l.id}/chat`, { headers: { cookie } })).text(), /Datos del lead/);
  } finally { server.close(); }
});
