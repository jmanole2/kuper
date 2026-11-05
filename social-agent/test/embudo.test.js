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

test('horario de la IA: siempre por defecto, y se guarda el del equipo', () => {
  assert.equal(E.horarioIA(c).modo, 'siempre');
  const c2 = E.guardarHorario(c, { ia_modo: 'fuera_de_horario', de: '9', a: '18', dias: ['1', '2', '3', '4', '5'] });
  assert.deepEqual(E.horarioIA(c2), { modo: 'fuera_de_horario', dias: [1, 2, 3, 4, 5], de: 9, a: 18, tz: 'America/Mexico_City' });
  assert.throws(() => E.guardarHorario(c, { de: '18', a: '9', dias: ['1'] }), /después/);
});

test('el agente puede mandar el tipo de etapa', () => {
  const l = db.upsertLead(c.id, { telefono: '5500000123', origen: 'whatsapp' });
  assert.equal(E.datosDelAgente(c, l, { etapa: 'conversacion' }).etapa, 'contestado');
  assert.equal(E.datosDelAgente(c, db.getLead(c.id, l.id), { etapa: 'cita' }).etapa, 'en-visita');
});

test('agregar lead a mano y marcar resultado desde la barra', () => {
  const r = E.agregarLead(c, { nombre: 'Nuevo', lada: '52', telefono: '55 1111 2222', destino: `${E.embudos(c)[0].id}/contestado` }, 'Ana');
  assert.equal(r.lead.telefono, '+525511112222'); assert.equal(r.lead.etapa, 'contestado'); assert.equal(r.existia, false);
  assert.equal(E.agregarLead(c, { lada: '52', telefono: '5511112222' }).existia, true);
  const v = E.marcarResultado(c, r.lead.id, 'vendido', '$15,500');
  assert.equal(v.resultado, 'vendido'); assert.equal(v.valor, 15500); assert.equal(E.etapaDe(c, v).tipo, 'cliente');
  assert.throws(() => E.agregarLead(c, { nombre: 'Sin datos' }), /teléfono/);
});

test('menú de la columna: renombrar, agregar, estancado, al entrar y eliminar; acciones en grupo', () => {
  const emb = E.embudos(c)[0];
  let c2 = E.editarEtapa(c, emb.id, 'contestado', 'renombrar', 'Respondido');
  assert.equal(E.etapas(c2, emb.id).find((x) => x.id === 'contestado').nombre, 'Respondido');
  c2 = E.editarEtapa(c2, emb.id, 'contestado', 'agregar', 'Cotización enviada');
  const lista = E.etapas(c2, emb.id);
  assert.equal(lista[lista.findIndex((x) => x.id === 'contestado') + 1].nombre, 'Cotización enviada');
  c2 = E.editarEtapa(c2, emb.id, 'contestado', 'estancado', '3');
  c2 = E.editarEtapa(c2, emb.id, 'contestado', 'al_entrar', 'vendido');
  const et = E.etapas(c2, emb.id).find((x) => x.id === 'contestado');
  assert.equal(et.estancado_dias, 3); assert.equal(et.al_entrar, 'vendido');
  // editar el texto del embudo no borra esa configuración
  c2 = db.updateClient(c2.id, { config: { ...c2.config, embudos: E.parseEmbudos(E.embudosTexto(c2), E.embudos(c2)) } }) || db.getClient(c2.id);
  c2 = db.getClient(c.id);
  assert.equal(E.etapas(c2, emb.id).find((x) => x.id === 'contestado').estancado_dias, 3);
  const l = db.upsertLead(c2.id, { telefono: '5500009999', origen: 'whatsapp' });
  E.moverLead(c2, l.id, 'contestado');
  db.getDb().prepare("UPDATE leads SET updated_at = datetime('now', '-5 days') WHERE id = ?").run(l.id);
  assert.equal(E.estancado(c2, db.getLead(c2.id, l.id)), true);
  c2 = E.editarEtapa(c2, emb.id, 'contestado', 'eliminar');
  assert.ok(!E.etapas(c2, emb.id).some((x) => x.id === 'contestado'));
  assert.notEqual(db.getLead(c2.id, l.id).etapa, 'contestado', 'sus leads pasan a otra etapa');
  const n = E.accionMasiva(c2, [l.id], { prioridad: 'urgente', asesor: String(ana.id) });
  assert.equal(n, 1); assert.equal(db.getLead(c2.id, l.id).prioridad, 'urgente'); assert.equal(db.getLead(c2.id, l.id).asignado_id, ana.id);
});

test('pausar agente desde el panel: se guarda y el agente lo lee con el conocimiento', async () => {
  const { createApp } = await import('../src/server.js');
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const r = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'ana@inhouse.mx', password: 'clave-larga-123' }) });
    const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
    assert.match(await (await fetch(`${base}/app/agente`, { headers: { cookie } })).text(), /Pausar agente/);
    const p = await fetch(`${base}/app/agente/pausa`, { method: 'POST', redirect: 'manual', headers: { cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ pausado: '1' }) });
    assert.equal(p.status, 302);
    assert.equal(db.getClient(c.id).config.agente_pausado, true);
    assert.match(await (await fetch(`${base}/app/agente`, { headers: { cookie } })).text(), /Reanudar agente/);
  } finally { server.close(); }
});

test('analítica: rango de fechas (atajos y propio) y filtro por asesor', () => {
  const ahora = Date.parse('2026-11-05T18:00:00Z');
  assert.deepEqual(E.rangoFechas({ rango: 'mes' }, ahora), { desde: '2026-11-01', hasta: '2026-11-05', rango: 'mes' });
  assert.deepEqual(E.rangoFechas({ rango: 'mes_pasado' }, ahora), { desde: '2026-10-01', hasta: '2026-10-31', rango: 'mes_pasado' });
  assert.deepEqual(E.rangoFechas({ rango: '7' }, ahora), { desde: '2026-10-30', hasta: '2026-11-05', rango: '7' });
  assert.deepEqual(E.rangoFechas({ desde: '2026-10-10', hasta: '2026-10-04' }, ahora), { desde: '2026-10-04', hasta: '2026-10-10', rango: 'propio' });
  const a = E.analitica(c, { desde: '2026-11-03', hasta: '2026-11-03', ahora });
  assert.equal(a.dias, 1);
  const todos = E.analitica(c, { rango: '90', ahora }).nuevos;
  const deAna = E.analitica(c, { rango: '90', asesor: String(ana.id), ahora }).nuevos;
  assert.ok(deAna <= todos);
});
