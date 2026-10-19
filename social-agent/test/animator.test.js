import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Stage } from '../src/animator/render.js';
import { createVisual } from '../src/animator/index.js';
import { FALLBACK_CODE } from '../src/animator/fallback.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anim-'));
const brand = { name: 'Demo', colors: ['#0B0D1F', '#3B7CF6', '#EC4899', '#FFFFFF'], fontHead: 'Poppins', fontBody: 'Poppins' };
const video = { kind: 'video', formato: '9:16', duration: 3, brand, content: { escenas: [{ titular: 'Uno', apoyo: 'dos' }], cierre: 'Fin' } };

test('el ejemplo del prompt pasa la revisión técnica', { timeout: 60_000 }, async () => {
  const st = await Stage.open();
  try {
    await st.load({ ...video, duration: 10, content: { escenas: [{ titular: 'Uno', apoyo: 'dos' }, { titular: 'Tres', apoyo: '' }, { titular: 'Cuatro', apoyo: 'cinco' }], cierre: 'Fin', cta: 'Fin' } },
      fs.readFileSync(path.join(ROOT, 'prompts/ejemplo-animacion.js'), 'utf8'));
    const p = await st.probe();
    assert.deepEqual(p.errors, []);
  } finally { await st.close(); }
});

test('detecta excepciones y texto fuera del lienzo', { timeout: 60_000 }, async () => {
  const st = await Stage.open();
  try {
    await st.load(video, `function draw(ctx, t, K) { K.bg.solid(ctx); ctx.font = K.font(800, 90); ctx.fillStyle = '#fff'; ctx.fillText('Texto que se sale por la derecha', K.W - 200, 500); if (t > 2) null.x; }`);
    const p = await st.probe();
    assert.ok(p.errors.some((e) => e.includes('se sale del cuadro')));
    assert.ok(p.errors.some((e) => /null/.test(e)));
  } finally { await st.close(); }
});

test('el diseño de respaldo funciona en carrusel', { timeout: 60_000 }, async () => {
  const job = { kind: 'carrusel', formato: '4:5', slides: 3, brand, content: { slides: [{ titulo: 'Portada', texto: '' }, { titulo: 'Paso uno', texto: 'Hazlo así' }, { titulo: 'Cierre', texto: 'Listo' }] } };
  const r = await createVisual(job, path.join(dir, 'car'), { useClaude: false });
  assert.equal(r.images.length, 3);
  assert.ok(r.images.every((f) => fs.statSync(f).size > 10_000));
});

test('ciclo con Claude: corrige errores, revisa la hoja de contacto y aprueba', { timeout: 120_000 }, async () => {
  const bueno = `function draw(ctx, t, K) { K.bg.iridescent(ctx, t); const b = K.fit('Hola', { maxW: K.safe.width }); K.drawText(ctx, b, K.safe.left, K.H / 2, { p: K.tween(t, 0, 1) }); }`;
  const replies = [
    { concepto: 'v1', codigo: 'function draw(ctx, t, K) { noExiste(); }', aprobado: false, problemas: [] },
    { concepto: 'v2', codigo: bueno, aprobado: false, problemas: [] },
    { concepto: 'v2', codigo: '', aprobado: true, problemas: [] },
  ];
  const seen = [];
  const askFn = async (messages) => {
    seen.push(messages.at(-1));
    const data = replies.shift();
    return { data, content: [{ type: 'text', text: JSON.stringify(data) }] };
  };
  const r = await createVisual(video, path.join(dir, 'loop'), { useClaude: true, askFn });
  assert.equal(r.codigo, bueno);
  assert.equal(r.respaldo, undefined);
  assert.match(String(seen[1].content), /noExiste/, 'le devuelve el error técnico');
  assert.ok(Array.isArray(seen[2].content) && seen[2].content[0].type === 'image', 'le manda la hoja de contacto');
  assert.ok(fs.statSync(r.video).size > 10_000);
});
