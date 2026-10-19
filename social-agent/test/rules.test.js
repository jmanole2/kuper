import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePost } from '../src/rules.js';
import { mockPost } from '../src/llm/mock.js';

const perfil = {
  cliente: 'Demo', cta_preferido: 'Escríbenos', permite_emojis: false, temas_prohibidos: ['política'],
  pilares_de_contenido: [{ nombre: 'tips', requiere_imagen_real: false }, { nombre: 'portafolio', requiere_imagen_real: true }],
};
const cfg = { instagram: { modo_publicacion: 'aprobacion' }, linkedin: { modo_publicacion: 'auto' } };
const ctx = (plataforma, extra = {}) => ({ perfil, plataforma, modo: cfg[plataforma].modo_publicacion, historial: [], fechaCalculada: '2026-10-22', ...extra });
const make = (plataforma) => mockPost({ plataforma, perfil, config: cfg, historial: { ultimas_publicaciones: [] }, fechaCalculada: '2026-10-22' });

test('una salida correcta pasa la validación', () => {
  assert.deepEqual(validatePost(make('instagram'), ctx('instagram')), []);
  assert.deepEqual(validatePost(make('linkedin'), ctx('linkedin')), []);
});

test('detecta emojis, hashtags en el copy y temas prohibidos', () => {
  const out = make('instagram');
  out.variantes_copy[0].copy += ' 🚀 #extra sin política';
  const errs = validatePost(out, ctx('instagram')).join('\n');
  assert.match(errs, /emojis/);
  assert.match(errs, /hashtags van en el arreglo/);
  assert.match(errs, /tema prohibido/);
});

test('exige 2 variantes en modo aprobación y la fecha calculada', () => {
  const out = make('instagram');
  out.variantes_copy.pop();
  out.fecha_sugerida = '2026-11-01';
  const errs = validatePost(out, ctx('instagram')).join('\n');
  assert.match(errs, /exactamente 2 variante/);
  assert.match(errs, /fecha_sugerida/);
});

test('pilares con imagen real no llevan imagen sintética', () => {
  const out = make('instagram');
  out.pilar_de_contenido = 'portafolio';
  const errs = validatePost(out, ctx('instagram')).join('\n');
  assert.match(errs, /requiere_asset_real/);
  assert.match(errs, /"animacion" debe ser null/);
});

test('no repite el pilar anterior de la misma plataforma', () => {
  const out = make('instagram');
  const errs = validatePost(out, ctx('instagram', { historial: [{ plataforma: 'instagram', pilar: 'tips', tema: 'x' }] }));
  assert.ok(errs.some((e) => e.includes('ya se usó')));
});
