// node --test agente-llamadas/test/funciones.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearFunciones, definiciones, tokenFunciones, configFunciones, hooks } from '../funciones.mjs';

const ahora = Date.parse('2026-10-21T18:00:00Z');
hooks.ahora = () => ahora;
const token = tokenFunciones('rk');
const { atender } = crearFunciones({ cal: 'cal_x', token, tz: 'America/Mexico_City' });
let citas = [];
const pedidos = [];
hooks.fetch = async (url, opt) => {
  pedidos.push({ url, opt, body: opt.body ? JSON.parse(opt.body) : null });
  const j = (s, x) => ({ ok: s < 300, status: s, json: async () => x });
  if (url.includes('/bookings?')) return j(200, { status: 'success', data: citas });
  if (url.endsWith('/reschedule')) return j(201, { status: 'success', data: { uid: 'nuevo', start: pedidos.at(-1).body.start } });
  if (url.endsWith('/cancel')) return j(200, { status: 'success', data: {} });
  return j(404, {});
};
const pedir = (nombre, args, auth = `Bearer ${token}`) => atender(nombre, auth, { name: nombre, args, call: {} });
const cita = (uid, start, status = 'accepted') => ({ uid, start, status, attendees: [{ email: 'ana@x.mx' }] });

test('sin la llave correcta no responde', async () => {
  assert.equal((await pedir('buscar_cita', { correo: 'ana@x.mx' }, 'Bearer otra'))[0], 401);
  assert.equal((await pedir('nada', {}))[0], 404);
  assert.equal((await pedir('constructor', {}))[0], 404);
});

test('busca solo citas futuras y vigentes por correo', async () => {
  citas = [cita('a', '2026-10-27T16:00:00Z'), cita('b', '2026-10-01T16:00:00Z'), cita('c', '2026-10-28T16:00:00Z', 'cancelled')];
  const [cod, r] = await pedir('buscar_cita', { correo: ' Ana@X.mx ' });
  assert.equal(cod, 200);
  assert.deepEqual(r.citas.map((c) => c.cita_id), ['a']);
  assert.match(r.resultado, /martes, 27 de octubre/);
  assert.match(pedidos.at(-1).url, /attendeeEmail=ana%40x\.mx/);
  assert.equal(pedidos.at(-1).opt.headers.Authorization, 'Bearer cal_x');
});

test('cambia la cita al nuevo horario', async () => {
  citas = [cita('a', '2026-10-27T16:00:00Z')];
  const [, r] = await pedir('cambiar_cita', { correo: 'ana@x.mx', nueva_fecha_hora: '2026-10-29T11:00:00-06:00' });
  const p = pedidos.at(-1);
  assert.match(p.url, /\/bookings\/a\/reschedule$/);
  assert.equal(p.body.start, '2026-10-29T17:00:00.000Z');
  assert.match(r.resultado, /Listo: la cita se cambió de martes, 27 de octubre.*jueves, 29 de octubre/);
});

test('pide aclarar si hay varias citas o la fecha no sirve', async () => {
  citas = [cita('a', '2026-10-27T16:00:00Z'), cita('b', '2026-10-30T16:00:00Z')];
  const n = pedidos.length;
  assert.match((await pedir('cambiar_cita', { correo: 'ana@x.mx', nueva_fecha_hora: '2026-11-02T10:00:00-06:00' }))[1].resultado, /tiene 2 citas/);
  assert.match((await pedir('cambiar_cita', { correo: 'ana@x.mx', nueva_fecha_hora: '2026-11-02T10:00:00' }))[1].resultado, /no es válida/);
  assert.match((await pedir('cambiar_cita', { correo: 'ana@x.mx', nueva_fecha_hora: '2026-10-01T10:00:00-06:00' }))[1].resultado, /ya pasó/);
  assert.ok(!pedidos.slice(n).some((p) => p.url.endsWith('/reschedule')), 'no cambia nada');
  await pedir('cambiar_cita', { correo: 'ana@x.mx', cita_id: 'b', nueva_fecha_hora: '2026-11-02T10:00:00-06:00' });
  assert.match(pedidos.at(-1).url, /\/bookings\/b\/reschedule$/);
});

test('cancela la cita', async () => {
  citas = [cita('a', '2026-10-27T16:00:00Z')];
  const [, r] = await pedir('cancelar_cita', { correo: 'ana@x.mx', motivo: 'Se enfermó' });
  assert.match(pedidos.at(-1).url, /\/bookings\/a\/cancel$/);
  assert.equal(pedidos.at(-1).body.cancellationReason, 'Se enfermó');
  assert.match(r.resultado, /se canceló/);
});

test('si Cal.com falla, Sofía recibe una salida amable', async () => {
  hooks.fetch = async () => ({ ok: false, status: 500, json: async () => ({ status: 'error' }) });
  const [cod, r] = await pedir('cancelar_cita', { correo: 'ana@x.mx' });
  assert.equal(cod, 200);
  assert.match(r.resultado, /un asesor/);
});

test('definiciones para Retell', () => {
  assert.equal(configFunciones({ PUBLIC_URL: 'https://l.mx' }), null);
  const f = configFunciones({ PUBLIC_URL: 'https://l.mx/', CAL_API_KEY: 'c', RETELL_API_KEY: 'rk' });
  const d = definiciones(f, 'America/Mexico_City');
  assert.deepEqual(d.map((x) => [x.name, x.url]), [['buscar_cita', 'https://l.mx/funciones/buscar_cita'], ['cambiar_cita', 'https://l.mx/funciones/cambiar_cita'], ['cancelar_cita', 'https://l.mx/funciones/cancelar_cita']]);
  assert.equal(d[0].headers.Authorization, `Bearer ${token}`);
});
