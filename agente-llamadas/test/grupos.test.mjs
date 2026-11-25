import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// Cada grupo de grupos.json apunta a demos que existen y no choca con el nombre de una demo.
test('grupos de WhatsApp: marcas existentes y sin choque de nombres', () => {
  const grupos = JSON.parse(readFileSync(new URL('../grupos.json', import.meta.url), 'utf8'));
  for (const [g, d] of Object.entries(grupos)) {
    assert.match(g, /^[a-z0-9-]+$/);
    assert.ok(!existsSync(new URL(`../demos/${g}.json`, import.meta.url)), `${g} ya es una demo`);
    assert.ok(d.nombre && d.marcas.length);
    for (const m of d.marcas) assert.ok(existsSync(new URL(`../demos/${m}.json`, import.meta.url)), `falta demos/${m}.json`);
    for (const c of Object.values(d.fondos || {})) assert.match(c, /^#[0-9a-f]{3,8}$/i);
  }
});
