// node --test agente-llamadas/test/ventas.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearSincronizador, resultadoVentas, hooks as hooksPanel } from '../panel.mjs';
import { crearMarcador, hooks as hooksMarcador } from '../marcador.mjs';
import { crearFunciones, hooks as hooksFn, tokenFunciones } from '../funciones.mjs';

const ahora = Date.parse('2026-10-21T18:00:00Z');
const panel = { url: 'https://p.mx', slug: 'kuper', key: 'pk' };
const silencio = { log() {}, error() {} };
const conversacion = [{ role: 'agent', content: 'Hola, soy Mateo' }, { role: 'user', content: 'Sí, dígame' }];

test('resultado de ventas: buzón o sin respuesta cuenta como no contestó', () => {
  const ok = { call_id: 'v', call_status: 'ended', transcript_object: conversacion, call_analysis: { call_summary: 'Agendó.', custom_analysis_data: { resultado: 'cita', nombre_contacto: 'Dra. Ruiz', correo_contacto: 'r@x.mx' } } };
  assert.deepEqual([resultadoVentas(ok).resultado, resultadoVentas(ok).contacto, resultadoVentas(ok).email, resultadoVentas(ok).cita], ['cita', 'Dra. Ruiz', 'r@x.mx', true]);
  assert.equal(resultadoVentas({ ...ok, disconnection_reason: 'voicemail_reached' }).resultado, 'no_contesto');
  assert.equal(resultadoVentas({ ...ok, call_status: 'not_connected' }).resultado, 'no_contesto');
  assert.equal(resultadoVentas({ ...ok, transcript_object: [conversacion[0]] }).resultado, 'no_contesto', 'solo habló el agente');
  assert.equal(resultadoVentas({ ...ok, call_analysis: { custom_analysis_data: { resultado: 'otra cosa' } } }).resultado, 'no_contesto');
});

test('el sincronizador manda las llamadas de ventas a la lista de prospectos', async () => {
  const pedidos = [];
  const venta = { call_id: 'v1', agent_id: 'ag-v', call_type: 'phone_call', direction: 'outbound', to_number: '+525511112222', call_status: 'ended', metadata: { prospecto_id: '7' },
    start_timestamp: ahora - 300_000, end_timestamp: ahora - 200_000, call_analysis: { call_summary: 'No le interesa.', custom_analysis_data: { resultado: 'no_interesa' } } };
  const noConecto = { call_id: 'v2', agent_id: 'ag-v', call_status: 'not_connected', metadata: { prospecto_id: '8' }, start_timestamp: ahora - 100_000 };
  hooksPanel.fetch = async (url, opt) => {
    pedidos.push({ url, body: opt.body ? JSON.parse(opt.body) : null });
    const j = (x) => ({ ok: true, status: 200, json: async () => x, text: async () => '' });
    if (url.endsWith('/v3/list-calls')) return j({ items: [noConecto, venta] });
    if (url.includes('/get-call/v1')) return j({ ...venta, transcript_object: conversacion });
    if (url.includes('/get-call/v2')) return j(noConecto);
    return j({ ok: true });
  };
  const s = crearSincronizador({ key: 'rk', agenteId: async () => 'ag-s', ventasId: async () => 'ag-v', panel, archivo: join(mkdtempSync(join(tmpdir(), 'v-')), 'e.json'), log: silencio });
  assert.deepEqual(await s.sincronizar(ahora), { enviadas: 2 });
  assert.deepEqual(pedidos[0].body.filter_criteria.agent, [{ agent_id: 'ag-s' }, { agent_id: 'ag-v' }]);
  const r7 = pedidos.find((p) => p.url === 'https://p.mx/api/kuper/prospectos/7/resultado');
  assert.equal(r7.body.resultado, 'no_interesa');
  assert.equal(pedidos.find((p) => p.url === 'https://p.mx/api/kuper/prospectos/8/resultado').body.resultado, 'no_contesto');
  assert.ok(!pedidos.some((p) => p.url.endsWith('/llamadas')));
});

test('el marcador llama a la empresa que le da el panel y respeta cuando no toca', async () => {
  const pedidos = [];
  let siguiente = { motivo: 'fuera_de_horario' }, fallaRetell = false;
  hooksMarcador.fetch = async (url, opt) => {
    pedidos.push({ url, body: opt.body ? JSON.parse(opt.body) : null, auth: opt.headers.Authorization });
    if (url.endsWith('/prospectos/siguiente')) return { ok: true, json: async () => siguiente };
    if (url.endsWith('/create-phone-call')) return fallaRetell ? { ok: false, status: 402, json: async () => ({ error: 'sin saldo' }) } : { ok: true, json: async () => ({ call_id: 'c9' }) };
    return { ok: true, json: async () => ({}) };
  };
  const m = crearMarcador({ key: 'rk', ventasId: async () => 'ag-v', panel, desde: '+15550001111', log: silencio });
  assert.deepEqual(await m.turno(), { motivo: 'fuera_de_horario' });
  assert.ok(!pedidos.some((p) => p.url.includes('retellai')), 'no marca');
  siguiente = { prospecto: { id: 7, empresa: 'Clínica Sonrisa', telefono: '+525511112222', giro: 'dentista', ciudad: 'CDMX' } };
  assert.deepEqual(await m.turno(), { llamando: 7, call_id: 'c9' });
  const llamada = pedidos.find((p) => p.url.endsWith('/create-phone-call'));
  assert.deepEqual(llamada.body, { from_number: '+15550001111', to_number: '+525511112222', override_agent_id: 'ag-v',
    retell_llm_dynamic_variables: { empresa: 'Clínica Sonrisa', giro: 'dentista', ciudad: 'CDMX' }, metadata: { prospecto_id: '7', origen: 'ventas' } });
  assert.equal(llamada.auth, 'Bearer rk');
  fallaRetell = true;
  assert.match((await m.turno()).error, /402/);
  assert.equal(pedidos.at(-1).url, 'https://p.mx/api/kuper/prospectos/7/resultado', 'si no pudo marcar, la libera');
  assert.equal(pedidos.at(-1).body.resultado, 'no_contesto');
});

test('ver horarios y agendar en Cal.com', async () => {
  hooksFn.ahora = () => ahora;
  const pedidos = [];
  hooksFn.fetch = async (url, opt) => {
    pedidos.push({ url, opt, body: opt.body ? JSON.parse(opt.body) : null });
    if (url.includes('/slots?')) return { ok: true, json: async () => ({ status: 'success', data: { '2026-10-21': [{ start: '2026-10-21T12:30:00-06:00' }], '2026-10-22': ['2026-10-22T10:00:00-06:00', '2026-10-22T11:00:00-06:00', '2026-10-22T12:00:00-06:00', '2026-10-22T13:00:00-06:00', '2026-10-22T14:00:00-06:00'] } }) };
    if (url.endsWith('/bookings')) return { ok: true, status: 201, json: async () => ({ status: 'success', data: { uid: 'b1' } }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const { atender } = crearFunciones({ cal: 'cal_x', token: tokenFunciones('rk'), tz: 'America/Mexico_City', evento: { username: 'kuper', eventTypeSlug: '30min' } });
  const pedir = (n, args) => atender(n, `Bearer ${tokenFunciones('rk')}`, { args });
  const [, h] = await pedir('ver_horarios', {});
  assert.match(pedidos[0].url, /username=kuper&eventTypeSlug=30min&start=2026-10-21&end=2026-10-28&timeZone=America%2FMexico_City/);
  assert.equal(pedidos[0].opt.headers['cal-api-version'], '2024-09-04');
  assert.deepEqual(h.horarios, ['2026-10-22T10:00:00-06:00', '2026-10-22T11:00:00-06:00', '2026-10-22T12:00:00-06:00', '2026-10-22T13:00:00-06:00'], 'quita lo de dentro de una hora y deja 4 por día');
  const [, a] = await pedir('agendar_cita', { fecha_hora: '2026-10-22T11:00:00-06:00', nombre: 'Dra. Ruiz', correo: 'Ruiz@Sonrisa.mx', empresa: 'Clínica Sonrisa', telefono: '+52 55 1111 2222' });
  const b = pedidos.at(-1).body;
  assert.deepEqual([b.start, b.username, b.eventTypeSlug, b.attendee.email, b.attendee.phoneNumber, b.attendee.language, b.metadata.empresa], ['2026-10-22T17:00:00.000Z', 'kuper', '30min', 'ruiz@sonrisa.mx', '+525511112222', 'es', 'Clínica Sonrisa']);
  assert.match(a.resultado, /quedó agendada para el jueves, 22 de octubre/);
  assert.match((await pedir('agendar_cita', { fecha_hora: '2026-10-22T11:00:00-06:00', nombre: 'X', correo: 'malo' }))[1].resultado, /no parece válido/);
});
