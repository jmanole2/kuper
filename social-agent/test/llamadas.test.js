// Llamadas del agente de voz: llegan por la API, quedan como lead y se ven en el panel.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'llamadas-')), SECRET_KEY: 'x', TIMEZONE: 'America/Mexico_City', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123' });
const db = await import('../src/db.js');
const metricas = await import('../src/metricas.js');
const { hashPassword } = await import('../src/crypto.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');
const perfil = { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] };
const c = db.createClient({ slug: 'kuper', nombre: 'Kuper', perfil, config: { plan: { servicios: { chat: true, llamadas: true } } }, credentials: { api_key: 'llave-k' } });
const sin = db.createClient({ slug: 'sin', nombre: 'Sin llamadas', perfil, config: { plan: { servicios: { chat: true, llamadas: false } } }, credentials: { api_key: 'llave-s' } });
db.createUser({ email: 'ana@kuper.mx', nombre: 'Ana', rol: 'cliente', client_id: c.id, password_hash: hashPassword('ClaveAna2030xx') });
db.createUser({ email: 'sin@x.mx', nombre: 'Sin', rol: 'cliente', client_id: sin.id, password_hash: hashPassword('ClaveSin2030xx') });

const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());
const api = (body, key = 'llave-k', slug = 'kuper') => fetch(`${base}/api/${slug}/llamadas`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
async function login(email, password) {
  const r = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, password }) });
  return (r.headers.get('set-cookie') || '').split(';')[0];
}
const get = (u, cookie) => fetch(`${base}${u}`, { headers: { cookie }, redirect: 'manual' });

const ahora = new Date().toISOString();
const llamada = {
  call_id: 'call_1', tipo: 'web', inicio: ahora, duracion_s: 185, nombre: 'Laura Gómez', email: 'Laura@Ejemplo.com',
  resumen: 'Laura quiere un agente de WhatsApp para su clínica. Agendó diagnóstico el martes.', cita: true,
  transcripcion: [{ rol: 'agente', texto: 'Hola, le atiende Sofía.' }, { rol: 'lead', texto: 'Hola, quiero un agente para mi clínica.' }, { rol: 'sistema', texto: 'ignorar' }],
};

test('sin llave no entra', async () => {
  assert.equal((await api(llamada, 'mala')).status, 401);
});

test('una llamada crea el lead (por correo), su conversación y no se duplica', async () => {
  const r = await api(llamada);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.nueva, true);
  const lead = db.getLead(c.id, j.lead_id);
  assert.equal(lead.origen, 'llamada');
  assert.equal(lead.email, 'laura@ejemplo.com');
  assert.equal(lead.estado, 'cita');
  assert.match(lead.nota, /clínica/);
  assert.equal(db.leadMessages(lead.id).length, 2, 'guarda solo turnos válidos');
  const otra = await (await api(llamada)).json();
  assert.equal(otra.nueva, false, 'la misma llamada no se guarda dos veces');
  assert.equal(db.leadMessages(lead.id).length, 2);
});

test('una llamada por teléfono se junta con el lead de WhatsApp', async () => {
  db.addLeadMessage(c.id, { telefono: '+5215511112222', nombre: 'Pedro', origen: 'whatsapp' }, { rol: 'lead', texto: 'Hola por WhatsApp' });
  const j = await (await api({ call_id: 'call_2', tipo: 'entrante', telefono: '+525511112222', duracion_s: 40, resumen: 'Pidió precios.', transcripcion: [{ rol: 'lead', texto: '¿Cuánto cuesta?' }] })).json();
  const lead = db.getLead(c.id, j.lead_id);
  assert.equal(lead.nombre, 'Pedro');
  assert.equal(lead.origen, 'whatsapp', 'conserva el origen original');
  assert.equal(db.leadMessages(lead.id).length, 2);
});

test('una llamada sin datos de contacto se guarda sin lead', async () => {
  const j = await (await api({ call_id: 'call_3', duracion_s: 12 })).json();
  assert.equal(j.lead_id, null);
  assert.equal((await api({ duracion_s: 1 })).status, 400, 'call_id es obligatorio');
});

test('el cliente ve sus llamadas y el reporte las cuenta', async () => {
  const ck = await login('ana@kuper.mx', 'ClaveAna2030xx');
  const h = await (await get('/app/llamadas', ck)).text();
  assert.match(h, /Laura Gómez/);
  assert.match(h, /Agendó cita/);
  assert.match(h, /quiero un agente para mi clínica/);
  assert.match(h, /3 min 05 s/);
  assert.match(await (await get('/app/leads', ck)).text(), /Llamada/);
  const r = metricas.resumenMes(db.getClient(c.id), metricas.mesActual());
  assert.deepEqual(r.llamadas, { llamadas: 3, minutos: 4, citas: 1 });
  assert.match(await (await get('/app/reporte', ck)).text(), /Llamadas atendidas/);
});

test('sin el servicio contratado no hay sección de llamadas', async () => {
  const ck = await login('sin@x.mx', 'ClaveSin2030xx');
  assert.equal((await get('/app/llamadas', ck)).status, 302);
});
