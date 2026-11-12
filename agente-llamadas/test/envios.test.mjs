import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as envios from '../envios.mjs';
import { construirPrompt } from '../prompt.mjs';
import { promptChat } from '../chat.mjs';

const demo = { negocio: 'Emprende en TikTok', asistente: 'Lucía', zona_horaria: 'America/Mexico_City', servicios: [], preguntas_frecuentes: [], horario: 'x', tipo_de_cita: 'y', giro: 'z',
  envios: { programa: 'Emprende en TikTok', fecha_limite: '20 de marzo' },
  aplicantes: [{ id: 'lucas', nombre: 'Lucas Fernández', negocio: 'Mate y Yerba', pais: 'Argentina', pendientes: ['el CUIT', 'el link de TikTok'], escribio_hace_h: null }] };

test('mensaje con el tono del país, pendientes y baja', () => {
  const m = envios.mensaje(demo, demo.aplicantes[0]);
  assert.match(m, /¿Cómo andás\? Soy Lucía/);
  assert.match(m, /el CUIT y el link de TikTok/);
  assert.match(m, /20 de marzo/);
  assert.match(m, /respondé BAJA/);
});

test('ventana de 24 h: gratis o plantilla', () => {
  assert.equal(envios.ventana({ escribio_hace_h: 5 }).abierta, true);
  assert.equal(envios.ventana({ escribio_hace_h: 30 }).abierta, false);
  assert.equal(envios.ventana({ escribio_hace_h: null }).abierta, false);
  assert.equal(envios.ventana({ escribio_hace_h: '' }).abierta, false);
});

test('normalizar filas de CSV', () => {
  const [a, ...resto] = envios.normalizar([{ nombre: 'Ana', negocio: 'Café', pais: 'mexico', pendientes: 'video; RFC' }, { nombre: '', pendientes: 'x' }, { nombre: 'Sin pendientes' }]);
  assert.equal(resto.length, 0);
  assert.equal(a.pais, 'México');
  assert.deepEqual(a.pendientes, ['video', 'RFC']);
  assert.equal(envios.paisDe('PE'), 'Perú');
});

test('la asistente sabe con quién habla (llamada y chat)', () => {
  const v = envios.variables(demo, demo.aplicantes[0]);
  assert.match(v.saludo, /¿hablo con Lucas\? Te llama Lucía/);
  assert.match(v.saludo, /Tenés un minuto/);
  const p = promptChat(demo, { variables: v });
  assert.match(p, /Lucas Fernández, de Mate y Yerba \(Argentina\)/);
  assert.match(p, /le falta el CUIT y el link de TikTok/);
});

test('el prompt incluye las postulaciones solo si la demo las tiene', () => {
  assert.match(construirPrompt(demo), /## Postulaciones registradas/);
  assert.doesNotMatch(construirPrompt({ ...demo, aplicantes: undefined }), /Postulaciones registradas/);
});
