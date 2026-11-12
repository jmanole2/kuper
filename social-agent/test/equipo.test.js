import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'eq-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123', SMTP_HOST: 'smtp.test', SMTP_USER: 'u', SMTP_PASS: 'p' });
const db = await import('../src/db.js');
const eq = await import('../src/equipo.js');
const { hashPassword } = await import('../src/crypto.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');

const c = db.createClient({ slug: 'eq', nombre: 'Equipo SA', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] },
  config: { plan: { servicios: { chat: true } }, notificaciones: { email: 'avisos@eq.mx' }, equipo: { reparto: 'menos_carga', sla_min: 15, alertas: true, csat: { activo: true, plantilla: 'encuesta' } } },
  credentials: { api_key: 'llave-eq' } });
const ana = db.createUser({ email: 'ana@eq.mx', nombre: 'Ana', rol: 'cliente', client_id: c.id, password_hash: hashPassword('x') });
const beto = db.createUser({ email: 'beto@eq.mx', nombre: 'Beto', rol: 'cliente', client_id: c.id, password_hash: hashPassword('x') });
db.createUser({ email: 'caja@eq.mx', nombre: 'Caja', rol: 'cliente', client_id: c.id, password_hash: hashPassword('x'), permiso: 'caja' });
const cl = () => db.getClient(c.id);
const correos = [], plantillas = [];
eq.hooks.send = async (m) => { correos.push(m); };
eq.hooks.enviar = async (client, x) => { plantillas.push(x); };

test('reparto: al que tiene menos leads abiertos, nunca a caja ni a quien no está disponible', () => {
  const l1 = eq.repartir(cl(), db.upsertLead(c.id, { telefono: '5511111111', origen: 'whatsapp' }));
  const l2 = eq.repartir(cl(), db.upsertLead(c.id, { telefono: '5522222222', origen: 'whatsapp' }));
  assert.notEqual(l1.asignado_id, l2.asignado_id);
  assert.ok([ana.id, beto.id].includes(l1.asignado_id));
  eq.setDisponible(cl(), beto.id, false);
  const l3 = eq.repartir(cl(), db.upsertLead(c.id, { telefono: '5533333333', origen: 'whatsapp' }));
  assert.equal(l3.asignado_id, ana.id);
  eq.setDisponible(cl(), beto.id, true);
});

test('tiempos de respuesta por asesor y alerta de espera (una sola vez)', async () => {
  const l = db.getDb().prepare("SELECT * FROM leads WHERE telefono = '+525511111111'").get();
  db.getDb().prepare("UPDATE leads SET control = 'humano' WHERE id = ?").run(l.id);
  const ins = db.getDb().prepare('INSERT INTO lead_mensajes (lead_id, rol, texto, created_at) VALUES (?, ?, ?, ?)');
  ins.run(l.id, 'lead', 'hola', '2026-11-12 10:00:00'); ins.run(l.id, 'humano', 'hola, ¿en qué te ayudo?', '2026-11-12 10:08:00');
  ins.run(l.id, 'lead', '¿precio?', '2026-11-12 11:00:00');
  const ahora = new Date('2026-11-12T11:30:00Z');
  const r = eq.rendimiento(cl(), { ahora }).find((x) => x.id === l.asignado_id);
  assert.equal(r.mediana_min, 8);
  assert.equal(r.en_sla, 100);
  assert.equal(r.esperando, 1);
  assert.equal((await eq.alertar(cl(), { ahora })).enviadas, 1);
  assert.match(correos[0].subject, /lleva 30 min esperando/);
  assert.match(correos[0].to, /avisos@eq\.mx/);
  assert.equal((await eq.alertar(cl(), { ahora })).enviadas, 0);
});

test('encuesta: se manda al cerrar, se captura el 1-5 y cuenta por asesor', async () => {
  const l = db.getDb().prepare("SELECT * FROM leads WHERE telefono = '+525522222222'").get();
  assert.equal((await eq.enviarEncuesta(cl(), l)).enviada, true);
  assert.equal(plantillas[0].plantilla, 'encuesta');
  assert.equal((await eq.enviarEncuesta(cl(), l)).enviada, false); // no se repite en 7 días
  assert.equal(eq.capturar(cl(), '5522222222', 'hola'), null);
  assert.equal(eq.capturar(cl(), '5522222222', '5'), 5);
  assert.equal(eq.capturar(cl(), '5522222222', '4'), null); // ya respondió
  assert.equal(eq.resumenCsat(c.id).promedio, 5);
  assert.equal(eq.rendimiento(cl()).find((x) => x.id === l.asignado_id).csat, 5);
});

test('la página Equipo se ve y los mensajes de la API reparten', async () => {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fetch(`${base}/api/eq/mensajes`, { method: 'POST', headers: { Authorization: 'Bearer llave-eq', 'Content-Type': 'application/json' }, body: JSON.stringify({ telefono: '5544444444', rol: 'lead', texto: 'hola' }) });
    assert.ok(db.getDb().prepare("SELECT asignado_id FROM leads WHERE telefono = '+525544444444'").get().asignado_id);
    db.setUserPassword(ana.id, hashPassword('ClaveAna2030'));
    const login = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: base }, body: new URLSearchParams({ email: 'ana@eq.mx', password: 'ClaveAna2030' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const h = await (await fetch(`${base}/app/equipo`, { headers: { Cookie: cookie } })).text();
    assert.match(h, /Rendimiento/);
    assert.doesNotMatch(h, />Caja</);
    const no = await fetch(`${base}/app/equipo/${beto.id}/disponible`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded', Origin: base }, body: new URLSearchParams({ disponible: '0' }) });
    assert.equal(no.status, 403); // Ana no puede pausar a Beto
  } finally { server.close(); }
});
