// node --test agente-llamadas/test/panel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aPanel, crearSincronizador, configPanel, hooks } from '../panel.mjs';

const ahora = Date.parse('2026-10-21T18:00:00Z');
const web = { call_id: 'c1', call_type: 'web_call', call_status: 'ended', start_timestamp: ahora - 600_000, end_timestamp: ahora - 400_000, duration_ms: 200_000,
  call_analysis: { call_summary: 'Quiere un agente.', custom_analysis_data: { nombre_cliente: 'Laura', correo_cliente: 'laura@x.mx', telefono_cliente: 'N/A', cita_agendada: true } },
  transcript_object: [{ role: 'agent', content: 'Hola' }, { role: 'user', content: 'Hola, quiero info' }, { role: 'transfer_target', content: 'x' }] };

test('convierte una llamada de Retell al formato del panel', () => {
  assert.deepEqual(aPanel(web), { call_id: 'c1', tipo: 'web', inicio: new Date(ahora - 600_000).toISOString(), duracion_s: 200, telefono: null, nombre: 'Laura', email: 'laura@x.mx',
    resumen: 'Quiere un agente.', cita: true, transcripcion: [{ rol: 'agente', texto: 'Hola' }, { rol: 'lead', texto: 'Hola, quiero info' }] });
  const entrante = aPanel({ ...web, call_type: 'phone_call', direction: 'inbound', from_number: '+525511112222', to_number: '+15550000' });
  assert.equal(entrante.tipo, 'entrante');
  assert.equal(entrante.telefono, '+525511112222');
  assert.equal(aPanel({ ...web, call_type: 'phone_call', direction: 'outbound', to_number: '+52553' }).telefono, '+52553');
});

test('sin PANEL_* no se activa', () => {
  assert.equal(configPanel({}), null);
  assert.deepEqual(configPanel({ PANEL_URL: 'https://p.mx/', PANEL_SLUG: 'k', PANEL_API_KEY: 'z' }), { url: 'https://p.mx', slug: 'k', key: 'z' });
});

test('manda cada llamada una vez y espera el resumen', async () => {
  const sinAnalisis = { call_id: 'c2', call_type: 'web_call', call_status: 'ended', start_timestamp: ahora - 120_000, end_timestamp: ahora - 60_000 };
  const pedidos = [];
  hooks.fetch = async (url, opt) => {
    pedidos.push({ url, opt });
    const j = (x) => ({ ok: true, status: 200, json: async () => x, text: async () => '' });
    if (url.endsWith('/v3/list-calls')) return j({ items: [sinAnalisis, { ...web, transcript_object: undefined }], has_more: false });
    if (url.includes('/v2/get-call/')) return j(web);
    return j({ ok: true });
  };
  const archivo = join(mkdtempSync(join(tmpdir(), 'll-')), 'datos', 'enviadas.json');
  const s = crearSincronizador({ key: 'rk', agenteId: async () => 'ag1', panel: { url: 'https://p.mx', slug: 'kuper', key: 'pk' }, archivo, log: { error() {} } });
  assert.deepEqual(await s.sincronizar(ahora), { enviadas: 1 });
  const lista = JSON.parse(pedidos[0].opt.body);
  assert.deepEqual(lista.filter_criteria.agent, [{ agent_id: 'ag1' }]);
  const alPanel = pedidos.find((p) => p.url === 'https://p.mx/api/kuper/llamadas');
  assert.equal(alPanel.opt.headers.Authorization, 'Bearer pk');
  assert.equal(JSON.parse(alPanel.opt.body).call_id, 'c1');
  assert.deepEqual(JSON.parse(readFileSync(archivo, 'utf8')), ['c1']);
  pedidos.length = 0;
  assert.deepEqual(await s.sincronizar(ahora), { enviadas: 0 }, 'no repite');
  assert.deepEqual(await s.sincronizar(ahora + 11 * 60_000), { enviadas: 1 }, 'sin resumen tras 10 min, se manda igual');
});

test('si el panel falla, no la marca como enviada', async () => {
  hooks.fetch = async (url) => {
    if (url.endsWith('/v3/list-calls')) return { ok: true, json: async () => ({ items: [web] }) };
    if (url.includes('/v2/get-call/')) return { ok: true, json: async () => web };
    return { ok: false, status: 500, text: async () => 'caído' };
  };
  const archivo = join(mkdtempSync(join(tmpdir(), 'll-')), 'enviadas.json');
  const s = crearSincronizador({ key: 'rk', agenteId: async () => 'ag1', panel: { url: 'https://p.mx', slug: 'kuper', key: 'pk' }, archivo, log: { error() {} } });
  const r = await s.sincronizar(ahora);
  assert.match(r.error, /panel 500/);
  assert.equal(s.enviadas.size, 0);
});
