import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validatePost } from '../src/rules.js';
import { cleanOutput, cleanText, captionIssues } from '../src/textcheck.js';
import { mockPost } from '../src/llm/mock.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const perfil = {
  cliente: 'Demo', cta_preferido: 'Comenta INFO', permite_emojis: false, temas_prohibidos: ['política'],
  palabra_clave_cta: 'INFO', terminos_busqueda: ['atención por WhatsApp'], palabras_prohibidas: ['sinergia'],
  pilares_de_contenido: [{ nombre: 'tips', requiere_imagen_real: false }, { nombre: 'otro', requiere_imagen_real: false }, { nombre: 'portafolio', requiere_imagen_real: true }],
};
const cfg = { instagram: { modo_publicacion: 'aprobacion' }, linkedin: { modo_publicacion: 'auto' }, facebook: { modo_publicacion: 'auto' } };
const ctx = (plataforma, extra = {}) => ({ perfil, plataforma, modo: cfg[plataforma].modo_publicacion, historial: [], fechaCalculada: '2026-10-22', ...extra });
const make = (plataforma, n = 0) => mockPost({ plataforma, perfil, config: cfg, historial: { ultimas_publicaciones: Array(n).fill({ plataforma }) }, fechaCalculada: '2026-10-22' });

test('salidas correctas pasan la validación (reel, carrusel, LinkedIn, Facebook)', () => {
  assert.deepEqual(validatePost(make('instagram'), ctx('instagram')), []);
  const car = mockPost({ plataforma: 'instagram', perfil, config: { instagram: { modo_publicacion: 'aprobacion', formatos: ['carrusel'] } }, historial: { ultimas_publicaciones: [] }, fechaCalculada: '2026-10-22' });
  assert.equal(car.formato_contenido, 'carrusel');
  assert.deepEqual(validatePost(car, ctx('instagram')), []);
  assert.deepEqual(validatePost(make('linkedin'), ctx('linkedin')), []);
  assert.deepEqual(validatePost(make('facebook'), ctx('facebook')), []);
});

test('el ejemplo del prompt maestro cumple sus propias reglas', () => {
  const md = fs.readFileSync(path.join(ROOT, 'prompts/maestro.md'), 'utf8');
  const ex = JSON.parse(md.slice(md.lastIndexOf('```json') + 7, md.lastIndexOf('```')));
  const p = { ...perfil, palabra_clave_cta: 'CEPILLO', terminos_busqueda: ['cepillarse', 'encía'], permite_emojis: true, max_emojis: 1,
    pilares_de_contenido: [{ nombre: 'prevención', requiere_imagen_real: false }] };
  assert.deepEqual(validatePost(cleanOutput(ex), { ...ctx('instagram'), perfil: p, fechaCalculada: '2026-10-27' }), []);
});

test('limpia rayas, comillas curvas e invisibles', () => {
  assert.equal(cleanText('Hola — esto es “bueno”… ok​'), 'Hola, esto es "bueno"... ok');
});

test('caption de Instagram: primera línea, una acción, palabra clave, búsqueda, muletillas', () => {
  const errs = captionIssues('Hola a todos! En el mundo actual la sinergia es clave y esta primera línea es tan larga que Instagram la corta antes de que alguien llegue al final de verdad.\n¿El resultado?\nGuarda este post y comenta info. https://x.com', { plataforma: 'instagram', perfil, trabajo: 'A' }).join('\n');
  for (const re of [/125/, /saludo/, /2 llamadas/, /en el mundo actual/, /sinergia/, /pregunta retórica/, /link/, /palabra clave en MAYÚSCULAS/, /término de búsqueda/, /trabajo A/]) assert.match(errs, re);
});

test('el gancho elegido debe abrir la pieza y usar 3 fórmulas distintas', () => {
  const out = make('instagram');
  out.animacion.escenas[0].titular = 'Otra cosa';
  out.ganchos[2].formula_id = out.ganchos[0].formula_id;
  const errs = validatePost(out, ctx('instagram')).join('\n');
  assert.match(errs, /debe abrir con el gancho/);
  assert.match(errs, /fórmulas distintas/);
});

test('pilares inactivos y carruseles mal formados', () => {
  const p2 = { ...perfil, pilares_de_contenido: [...perfil.pilares_de_contenido, { nombre: 'blog', requiere_imagen_real: false, activo: false }] };
  const out = make('instagram');
  out.pilar_de_contenido = 'blog';
  assert.ok(validatePost(out, { ...ctx('instagram'), perfil: p2 }).some((e) => e.includes('no es un pilar activo')));
  const car = make('instagram');
  car.formato_contenido = 'carrusel'; car.animacion = null; car.formato_imagen = '4:5';
  car.slides = [{ titulo: 'una portada que tiene muchas más palabras de las permitidas', texto: '' }];
  const errs = validatePost(car, ctx('instagram')).join('\n');
  assert.match(errs, /de 5 a 10 slides/);
  assert.match(errs, /máximo 6 palabras \(portada\)/);
});

test('pilares con imagen real no llevan visual sintético', () => {
  const out = make('instagram');
  out.pilar_de_contenido = 'portafolio';
  const errs = validatePost(out, ctx('instagram')).join('\n');
  assert.match(errs, /requiere_asset_real/);
  assert.match(errs, /"animacion" debe ser null/);
});

test('rota pilar, tipo de post y estructura', () => {
  const out = make('instagram');
  const errs = validatePost(out, ctx('instagram', { historial: [{ plataforma: 'instagram', pilar: out.pilar_de_contenido, tipo_post: out.tipo_post, tema: 'x', estructura: out.estructura }] })).join('\n');
  assert.match(errs, /ya se usó en la publicación anterior/);
  assert.match(errs, /tipo de post/);
  assert.match(errs, /estructura/);
});

test('con muchos pilares no repite ninguno de los últimos 3', () => {
  const muchos = { ...perfil, pilares_de_contenido: ['a', 'b', 'c', 'd', 'e', 'tips'].map((nombre) => ({ nombre, requiere_imagen_real: false })) };
  const out = { ...make('instagram'), pilar_de_contenido: 'tips' };
  const hist = [{ plataforma: 'instagram', pilar: 'a' }, { plataforma: 'instagram', pilar: 'b' }, { plataforma: 'instagram', pilar: 'tips' }];
  assert.ok(validatePost(out, ctx('instagram', { perfil: muchos, historial: hist })).some((e) => /últimas 3 publicaciones/.test(e)));
  const viejo = [...hist.slice(0, 2), { plataforma: 'instagram', pilar: 'c' }, { plataforma: 'instagram', pilar: 'tips' }];
  assert.ok(!validatePost(out, ctx('instagram', { perfil: muchos, historial: viejo })).some((e) => /pilar/.test(e)), 'hace 4 sí se puede');
});
