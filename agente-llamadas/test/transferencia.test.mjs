// node --test agente-llamadas/test/transferencia.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aPanel, crearSincronizador, transferenciaFallida, hooks } from '../panel.mjs';
import { camposAnalisis, textoEvaluacion, RUBRICA_DEFECTO } from '../evaluacion.mjs';

const ahora = Date.parse('2026-11-12T18:00:00Z');
const base = { call_id: 't1', call_type: 'phone_call', direction: 'inbound', from_number: '+525511112222', to_number: '+525500000000', call_status: 'ended',
  start_timestamp: ahora - 600_000, end_timestamp: ahora - 400_000, duration_ms: 200_000, agent_id: 'ag1',
  call_analysis: { call_summary: 'Pidió hablar con un asesor por una cotización.', custom_analysis_data: { nombre_cliente: 'Laura Gómez' } },
  transcript_object: [{ role: 'agent', content: 'Le comunico.' }] };
const invocacion = [{ role: 'agent', content: 'Le comunico con un asesor.' }, { role: 'tool_call_invocation', name: 'transferir_a_humano', arguments: '{}' }, { role: 'tool_call_result', content: 'no contestó' }];

test('detecta cuándo nadie tomó la transferencia', () => {
  assert.equal(transferenciaFallida({ ...base, disconnection_reason: 'user_hangup', transcript_with_tool_calls: invocacion }), true, 'intentó y colgó');
  assert.equal(transferenciaFallida({ ...base, disconnection_reason: 'transfer_failed' }), true);
  assert.equal(transferenciaFallida({ ...base, disconnection_reason: 'transfer_cancelled' }), true);
  assert.equal(transferenciaFallida({ ...base, disconnection_reason: 'call_transfer', transcript_with_tool_calls: invocacion }), false, 'sí se transfirió');
  assert.equal(transferenciaFallida({ ...base, disconnection_reason: 'user_hangup', transcript_with_tool_calls: [{ role: 'agent', content: 'Hola' }] }), false, 'no intentó');
  assert.equal(transferenciaFallida({ ...base, call_type: 'web_call', disconnection_reason: 'transfer_failed' }), false, 'pruebas web no');
  assert.equal(transferenciaFallida({ ...base, from_number: '', disconnection_reason: 'transfer_failed' }), false, 'sin número no');
});

function retellFalso(call, pedidos, panelOk = true) {
  return async (url, opt) => {
    pedidos.push({ url, body: opt?.body ? JSON.parse(opt.body) : null });
    const j = (x, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => x, text: async () => '' });
    if (url.endsWith('/v3/list-calls')) return j({ items: [call] });
    if (url.includes('/v2/get-call/')) return j(call);
    if (url.endsWith('/plantilla')) return j({ ok: panelOk }, panelOk);
    return j({ ok: true });
  };
}

test('avisa al equipo una sola vez y manda la plantilla de WhatsApp si la demo la pide', async () => {
  const call = { ...base, disconnection_reason: 'user_hangup', transcript_with_tool_calls: invocacion };
  const pedidos = [];
  hooks.fetch = retellFalso(call, pedidos);
  const archivo = join(mkdtempSync(join(tmpdir(), 'tr-')), 'datos', 'enviadas.json');
  const s = crearSincronizador({ key: 'rk', agenteId: async () => 'ag1', panel: { url: 'https://p.mx', slug: 'kuper', key: 'pk' }, archivo, log: { error() {} },
    principal: { plantilla: 'llamada_perdida', idioma: 'es_MX', negocio: 'Kuper Media' } });
  await s.sincronizar(ahora);
  const plantilla = pedidos.find((p) => p.url === 'https://p.mx/api/kuper/plantilla');
  assert.deepEqual(plantilla.body, { telefono: '+525511112222', plantilla: 'llamada_perdida', idioma: 'es_MX', parametros: ['Laura', 'Kuper Media'], motivo: 'llamada_transferida_sin_contestar' });
  const aviso = pedidos.find((p) => p.url === 'https://p.mx/api/kuper/avisos');
  assert.equal(aviso.body.titulo, 'Llamada transferida sin contestar');
  assert.equal(aviso.body.correo, true);
  assert.equal(aviso.body.telefono, '+525511112222');
  assert.match(aviso.body.texto, /Pidió hablar con un asesor/);
  assert.match(aviso.body.texto, /Ya se le mandó un WhatsApp/);
  assert.ok(pedidos.findIndex((p) => p.url.endsWith('/llamadas')) < pedidos.findIndex((p) => p.url.endsWith('/avisos')), 'primero la llamada, luego el aviso');
  assert.deepEqual(JSON.parse(readFileSync(archivo.replace(/\.json$/, '-transferencias.json'), 'utf8')), ['t1']);
  pedidos.length = 0;
  await s.sincronizar(ahora);
  assert.equal(pedidos.filter((p) => p.url.endsWith('/avisos')).length, 0, 'no repite');
});

test('sin plantilla configurada (o si el panel no la acepta) solo avisa', async () => {
  const call = { ...base, call_id: 't2', disconnection_reason: 'transfer_failed' };
  for (const [principal, panelOk, espera] of [[null, true, /Devuélvele la llamada/], [{ plantilla: 'x', negocio: 'K' }, false, /No se pudo mandar el WhatsApp/]]) {
    const pedidos = [];
    hooks.fetch = retellFalso(call, pedidos, panelOk);
    const s = crearSincronizador({ key: 'rk', agenteId: async () => 'ag1', panel: { url: 'https://p.mx', slug: 'kuper', key: 'pk' }, archivo: join(mkdtempSync(join(tmpdir(), 'tr-')), 'e.json'), log: { error() {} }, principal });
    await s.sincronizar(ahora);
    assert.equal(pedidos.some((p) => p.url.endsWith('/plantilla')), Boolean(principal));
    assert.match(pedidos.find((p) => p.url.endsWith('/avisos')).body.texto, espera);
  }
});

test('demo con su propio panel y su plantilla: el aviso va a su panel', async () => {
  const call = { ...base, call_id: 't3', agent_id: 'demo1', disconnection_reason: 'transfer_failed' };
  const pedidos = [];
  hooks.fetch = retellFalso(call, pedidos);
  const s = crearSincronizador({ key: 'rk', agenteId: async () => 'ag1', panel: { url: 'https://p.mx', slug: 'kuper', key: 'pk' }, archivo: join(mkdtempSync(join(tmpdir(), 'tr-')), 'e.json'), log: { error() {} },
    demosIds: async () => [{ id: 'demo1', etiqueta: 'Inhouse Work', panel: { slug: 'inhouse', key: 'ik' }, seguimiento: { plantilla: 'te_llamamos' } }] });
  await s.sincronizar(ahora);
  const pl = pedidos.find((p) => p.url.endsWith('/plantilla'));
  assert.equal(pl.url, 'https://p.mx/api/inhouse/plantilla');
  assert.deepEqual(pl.body.parametros, ['Laura', 'Inhouse Work']);
  assert.ok(pedidos.some((p) => p.url === 'https://p.mx/api/inhouse/avisos'));
});

test('rúbrica: campos de análisis y calificación en el resumen', () => {
  assert.deepEqual(camposAnalisis({}), [], 'sin rúbrica no cambia nada');
  const def = camposAnalisis({ evaluar_llamadas: true });
  assert.deepEqual(def.map((c) => [c.type, c.name]), [['number', 'calificacion'], ['string', 'evaluacion']]);
  assert.match(def[0].description, new RegExp(RUBRICA_DEFECTO[0]));
  assert.match(camposAnalisis({ rubrica: ['Ofreció la visita'] })[1].description, /1\. Ofreció la visita/);
  assert.equal(textoEvaluacion({}), '');
  const p = aPanel({ ...base, call_analysis: { call_summary: 'Agendó visita.', custom_analysis_data: { calificacion: 8, evaluacion: 'Cumplió: 1, 2, 4. Faltó: 5. Consejo: confirmar el correo.' } } });
  assert.equal(p.resumen, 'Agendó visita.\n\nCalificación de la llamada: 8/10\nCumplió: 1, 2, 4. Faltó: 5. Consejo: confirmar el correo.');
  const largo = aPanel({ ...base, call_analysis: { call_summary: 'x'.repeat(3000), custom_analysis_data: { calificacion: 6, evaluacion: 'Consejo: y.' } } });
  assert.ok(largo.resumen.length <= 1500 && largo.resumen.endsWith('Consejo: y.'), 'la evaluación no se corta');
});
