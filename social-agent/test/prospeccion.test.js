// Agente de ventas: búsqueda de empresas, REPEP, reglas para llamar y resultados.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'pros-')), SECRET_KEY: 'x', TIMEZONE: 'America/Mexico_City', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123', GOOGLE_PLACES_API_KEY: 'gk' });
const db = await import('../src/db.js');
const pros = await import('../src/prospeccion.js');
const llamadas = await import('../src/llamadas.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');
const perfil = { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] };
const c = db.createClient({ slug: 'kuper', nombre: 'Kuper', perfil, config: { plan: { servicios: { chat: true, llamadas: true } } }, credentials: { api_key: 'llave-k' } });
db.upsertLead(c.id, { telefono: '5599990000', nombre: 'Ya es lead', origen: 'whatsapp' });

const pedidosGoogle = [];
pros.hooks.fetch = async (url, opt) => {
  pedidosGoogle.push({ url, opt, body: JSON.parse(opt.body) });
  const pagina = pedidosGoogle.length;
  return { ok: true, json: async () => pagina === 1 ? {
    places: [
      { id: 'p1', displayName: { text: 'Clínica Sonrisa' }, internationalPhoneNumber: '+52 55 1111 2222', formattedAddress: 'CDMX', rating: 4.7, userRatingCount: 120, businessStatus: 'OPERATIONAL' },
      { id: 'p2', displayName: { text: 'Sin teléfono' }, businessStatus: 'OPERATIONAL' },
      { id: 'p3', displayName: { text: 'Cerrado' }, nationalPhoneNumber: '55 3333 4444', businessStatus: 'CLOSED_PERMANENTLY' },
      { id: 'p4', displayName: { text: 'Ya conocido' }, nationalPhoneNumber: '55 9999 0000' },
    ], nextPageToken: 'pg2' } : { places: [{ id: 'p5', displayName: { text: 'Dental Norte' }, nationalPhoneNumber: '(55) 5555 6666' }] } };
};

const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());
const api = (ruta, { method = 'GET', body } = {}) => fetch(`${base}/api/kuper${ruta}`, { method, headers: { Authorization: 'Bearer llave-k', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const martes11 = new Date('2026-10-20T17:00:00Z'); // martes 11:00 en CDMX

test('busca por giro y ciudad y guarda solo negocios abiertos con teléfono nuevo', async () => {
  const r = await pros.buscar(c, { giro: 'dentistas', ciudad: 'CDMX', cuantas: 40 });
  assert.deepEqual(r, { encontradas: 5, nuevas: 2 });
  assert.equal(pedidosGoogle[0].body.textQuery, 'dentistas en CDMX');
  assert.equal(pedidosGoogle[0].opt.headers['X-Goog-Api-Key'], 'gk');
  assert.equal(pedidosGoogle[1].body.pageToken, 'pg2');
  assert.deepEqual(pros.listar(c.id).map((p) => [p.empresa, p.telefono]).sort(), [['Clínica Sonrisa', '+525511112222'], ['Dental Norte', '+525555556666']]);
  assert.equal((await pros.buscar(c, { giro: 'dentistas', ciudad: 'CDMX' })).nuevas, 0, 'no duplica');
});

test('no llama sin activar, fuera de horario ni sin revisar el REPEP', () => {
  assert.equal(pros.siguiente(c, martes11).motivo, 'pausado');
  pros.setActivo(c.id, true);
  assert.equal(pros.siguiente(c, new Date('2026-10-20T21:00:00Z')).motivo, 'fuera_de_horario', '15:00');
  assert.equal(pros.siguiente(c, new Date('2026-10-24T17:00:00Z')).motivo, 'fuera_de_horario', 'sábado');
  assert.equal(pros.siguiente(c, martes11).motivo, 'sin_pendientes', 'nada revisado en REPEP');
  const r = pros.aplicarRepep(c.id, '55 5555 6666\n');
  assert.deepEqual(r, { bloqueados: 1, revisados: 1 });
  assert.equal(pros.listar(c.id).find((p) => p.empresa === 'Dental Norte').estado, 'no_llamar');
});

test('una llamada a la vez, máximo 3 intentos y un día entre intentos', async () => {
  const j = await (await api('/prospectos/siguiente')).json(); // la API usa la hora real: solo revisamos que responda
  assert.ok(j.prospecto || j.motivo);
  if (j.prospecto) pros.resultado(c, j.prospecto.id, { resultado: 'no_contesto' });
  getDb().prepare("UPDATE prospectos SET intentos = 0, ultimo_intento = NULL, estado = 'pendiente' WHERE estado != 'no_llamar'").run();
  const a = pros.siguiente(c, martes11);
  assert.equal(a.prospecto.empresa, 'Clínica Sonrisa');
  assert.equal(pros.siguiente(c, martes11).motivo, 'ocupado');
  pros.resultado(c, a.prospecto.id, { resultado: 'no_contesto' });
  assert.equal(pros.siguiente(c, new Date(+martes11 + 3600_000)).motivo, 'sin_pendientes', 'espera un día');
  const b = pros.siguiente(c, new Date(+martes11 + 86400_000));
  assert.equal(b.prospecto.intento, 2);
  pros.resultado(c, b.prospecto.id, { resultado: 'no_contesto' });
  pros.resultado(c, pros.siguiente(c, new Date(+martes11 + 2 * 86400_000)).prospecto.id, { resultado: 'no_contesto' });
  assert.equal(pros.siguiente(c, new Date(+martes11 + 3 * 86400_000)).motivo, 'sin_pendientes', 'no pasa de 3 intentos');
});

test('si el agente se cae, la llamada no se queda en "llamando"', () => {
  getDb().prepare("UPDATE prospectos SET intentos = 0, ultimo_intento = NULL, estado = 'pendiente' WHERE estado != 'no_llamar'").run();
  pros.siguiente(c, martes11);
  const r = pros.siguiente(c, new Date(+martes11 + 31 * 60_000));
  assert.notEqual(r.motivo, 'ocupado');
});

test('resultado por la API: interesado entra a Leads y Llamadas; no le interesa, solo a Llamadas', async () => {
  getDb().prepare("UPDATE prospectos SET intentos = 0, ultimo_intento = NULL, estado = 'llamando' WHERE empresa = 'Clínica Sonrisa'").run();
  const p = pros.listar(c.id).find((x) => x.empresa === 'Clínica Sonrisa');
  const r = await api(`/prospectos/${p.id}/resultado`, { method: 'POST', body: { resultado: 'cita', call_id: 'v1', contacto: 'Dra. Ruiz', email: 'ruiz@sonrisa.mx', resumen: 'Agendó diagnóstico.', duracion_s: 140, transcripcion: [{ rol: 'agente', texto: 'Hola' }] } });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).prospecto.estado, 'cita');
  const lead = db.listLeads(c.id).find((l) => l.telefono === '+525511112222');
  assert.equal(lead.nombre, 'Dra. Ruiz (Clínica Sonrisa)');
  assert.equal(lead.estado, 'cita');
  db.getDb().prepare("INSERT INTO prospectos (client_id, empresa, telefono, repep_revisado) VALUES (?, 'Gym Sur', '+525577778888', 1)").run(c.id);
  const g = pros.listar(c.id).find((x) => x.empresa === 'Gym Sur');
  await api(`/prospectos/${g.id}/resultado`, { method: 'POST', body: { resultado: 'no_interesa', call_id: 'v2', resumen: 'No le interesa.', duracion_s: 30 } });
  assert.ok(!db.listLeads(c.id).some((l) => l.telefono === '+525577778888'), 'no ensucia Leads');
  assert.equal(llamadas.listar(c.id).find((x) => x.call_id === 'v2').nombre, 'Gym Sur');
  assert.equal((await api('/prospectos/999999/resultado', { method: 'POST', body: {} })).status, 404);
});

test('importar una lista pegada (con | o copiada de Excel)', () => {
  const r = pros.importar(c, [
    'Empresa | Teléfono | Giro | Ciudad | Web',
    'Gimnasio Fuerza | 222 111 3344 | gimnasio | Puebla | https://fuerza.mx',
    'Spa Zen\t(442) 555-0001\tspa\tQuerétaro',
    'Sin teléfono | | spa',
    'Ya es lead | 55 9999 0000',
    'Gimnasio Fuerza otra vez | 2221113344',
  ].join('\n'));
  assert.deepEqual([r.nuevas, r.repetidas, r.invalidas.length], [2, 2, 1]);
  const g = pros.listar(c.id).find((p) => p.empresa === 'Gimnasio Fuerza');
  assert.deepEqual([g.telefono, g.giro, g.ciudad, g.web, g.repep_revisado], ['+522221113344', 'gimnasio', 'Puebla', 'https://fuerza.mx', 0]);
  assert.equal(pros.listar(c.id).find((p) => p.empresa === 'Spa Zen').telefono, '+524425550001');
});

test('el admin ve la pestaña Ventas', async () => {
  const r = await fetch(`${base}/admin/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ password: 'maestra-123' }) });
  const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  const h = await (await fetch(`${base}/admin/clientes/${c.id}?tab=ventas`, { headers: { cookie } })).text();
  assert.match(h, /Agregar a la lista/);
  assert.match(h, /Buscar en Google Maps/, 'con clave de Google también aparece la búsqueda');
  assert.match(h, /REPEP/);
  assert.match(h, /Clínica Sonrisa/);
});

function getDb() { return db.getDb(); }
