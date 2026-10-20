import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cuesFromMotion, writeSoundtrack } from '../src/animator/audio.js';

test('pone sonidos donde cambia la imagen, al inicio y al final', () => {
  const diffs = Array.from({ length: 300 }, (_, i) => (i === 90 ? 0.2 : i === 180 ? 0.05 : 0.002));
  const cues = cuesFromMotion(diffs, 30, 10);
  assert.equal(cues[0].s, 'pop');
  assert.ok(cues.some((c) => Math.abs(c.t - 3) < 0.05 && c.s === 'whoosh'), 'cambio grande = whoosh');
  assert.ok(cues.some((c) => Math.abs(c.t - 6) < 0.05), 'cambio medio = pop');
  assert.equal(cues.at(-1).s, 'chime');
});

test('escribe un WAV estéreo con música y efectos', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'audio-')), 'a.wav');
  writeSoundtrack(f, { duration: 2, cues: [{ t: 0.1, s: 'pop' }, { t: 1, s: 'whoosh' }] });
  const b = fs.readFileSync(f);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.readUInt16LE(22), 2);
  assert.equal(b.length, 44 + 2 * 48000 * 4);
});
