// node --test agente-llamadas/test/entrante.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { numeroTransferencia, respuestaEntrante, variableTransferencia } from '../entrante.mjs';

const demo = { negocio: 'Inhouse Work', asistente: 'Valeria', panel_slug: 'inhouse-work' };

test('el número del equipo sale de la demo o del .env, nunca del repo', () => {
  assert.equal(variableTransferencia('inhousework'), 'TRANSFERIR_INHOUSEWORK');
  assert.equal(numeroTransferencia(demo, 'inhousework', {}), '');
  assert.equal(numeroTransferencia(demo, 'inhousework', { TRANSFERIR_INHOUSEWORK: ' +525511112222 ' }), '+525511112222');
  assert.equal(numeroTransferencia({ ...demo, numero_transferencia: '+525533334444' }, 'inhousework', { TRANSFERIR_INHOUSEWORK: '+52551' }), '+525533334444');
});

test('en pausa u horario del equipo la asistente saluda y transfiere', () => {
  const r = respuestaEntrante({ demo, clave: 'inhousework', turno: { atiende: 'equipo', motivo: 'pausa' }, infoPanel: 'Precios nuevos', transferencia: '+525511112222' });
  assert.equal(r.call_inbound.dynamic_variables.modo_llamada, 'transferir');
  assert.match(r.call_inbound.dynamic_variables.saludo, /Inhouse Work.*asesor/);
  assert.equal(r.call_inbound.dynamic_variables.info_panel, 'Precios nuevos');
  assert.deepEqual(r.call_inbound.metadata, { origen: 'telefono-inhousework', atiende: 'equipo', motivo: 'pausa' });
});

test('contesta la asistente si le toca, si no hay número del equipo o si el panel no responde', () => {
  const ia = respuestaEntrante({ demo, clave: 'inhousework', turno: { atiende: 'ia', motivo: 'fuera_de_horario' }, transferencia: '+525511112222' });
  assert.equal(ia.call_inbound.dynamic_variables.modo_llamada, 'atender');
  assert.equal(ia.call_inbound.dynamic_variables.saludo, undefined); // usa el saludo normal
  const sinNumero = respuestaEntrante({ demo, clave: 'inhousework', turno: { atiende: 'equipo', motivo: 'pausa' }, transferencia: '' });
  assert.equal(sinNumero.call_inbound.dynamic_variables.modo_llamada, 'atender');
  const sinPanel = respuestaEntrante({ demo, clave: 'inhousework', turno: null, transferencia: '+525511112222' });
  assert.deepEqual(sinPanel.call_inbound.metadata, { origen: 'telefono-inhousework', atiende: 'ia', motivo: 'sin_panel' });
});
