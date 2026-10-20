// Audio de los videos del agente: efectos de sonido sintetizados (sin derechos de terceros)
// colocados donde cambia la imagen, más una cama musical suave. Si hay pistas en assets/musica
// (mp3/m4a/wav con licencia comercial), se usa una de esas en lugar de la música sintetizada.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../config.js';

export const SR = 48000;

// Generador pseudoaleatorio determinista (mismo video, mismo audio).
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

function env(n, a = 0.005, r = 0.08) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; out[i] = Math.min(1, t / a) * Math.exp(-t / r); }
  return out;
}
const lowpass = (x, k) => { const y = new Float32Array(x.length); let acc = 0; for (let i = 0; i < x.length; i++) { acc += x[i] - (i >= k ? x[i - k] : 0); y[i] = acc / k; } return y; };

export const SFX = {
  pop(f0 = 620, f1 = 980, d = 0.07) {
    const n = Math.round(SR * d), e = env(n, 0.002, 0.025), y = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { ph += 2 * Math.PI * (f0 + (f1 - f0) * i / n) / SR; y[i] = Math.sin(ph) * e[i]; }
    return y;
  },
  blip(f = 880, d = 0.06) {
    const n = Math.round(SR * d), e = env(n, 0.003, 0.03), y = new Float32Array(n);
    for (let i = 0; i < n; i++) { const s = Math.sin(2 * Math.PI * f * i / SR); y[i] = (Math.sign(s) * 0.5 + s * 0.5) * e[i]; }
    return lowpass(y, 6);
  },
  bipbup() { const a = SFX.blip(740), b = SFX.blip(1100), y = new Float32Array(a.length + b.length + 960); y.set(a, 0); y.set(b, a.length + 960); return y; },
  chime(fs = [1318.5, 1975.5], d = 0.9) {
    const n = Math.round(SR * d), e = env(n, 0.003, 0.25), y = new Float32Array(n);
    for (let i = 0; i < n; i++) { let v = 0; fs.forEach((f, k) => { v += Math.sin(2 * Math.PI * f * i / SR) / (k + 1); }); y[i] = v * e[i] * 0.6; }
    return y;
  },
  whoosh(d = 0.45, bright = 8, seed = 3) {
    const n = Math.round(SR * d), r = rng(seed), x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = r() * 2 - 1;
    const y = new Float32Array(n), seg = Math.floor(n / 12);
    for (let k = 0; k < 12; k++) {
      const part = lowpass(x.subarray(k * seg, (k + 1) * seg), Math.round(bright + 30 * Math.abs(Math.sin(Math.PI * k / 12 - 1.2))));
      y.set(part, k * seg);
    }
    for (let i = 0; i < n; i++) y[i] *= Math.sin(Math.PI * i / n) ** 2 * 0.5;
    return y;
  },
  tick(seed = 5) { const n = Math.round(SR * 0.012), r = rng(seed), e = env(n, 0.0005, 0.003), y = new Float32Array(n); for (let i = 0; i < n; i++) y[i] = (r() * 2 - 1) * e[i]; return lowpass(y, 3); },
};

/**
 * Detecta dónde cambia la imagen (diferencia entre cuadros) y decide qué sonido va en cada punto.
 * diffs: un valor por cuadro (0..1). Devuelve [{ t, s }].
 */
export function cuesFromMotion(diffs, fps, duration) {
  const n = diffs.length; if (!n) return [];
  const sm = diffs.map((_, i) => (diffs[Math.max(0, i - 1)] + diffs[i] + diffs[Math.min(n - 1, i + 1)]) / 3);
  const sorted = [...sm].sort((a, b) => a - b), p50 = sorted[Math.floor(n * 0.5)], p90 = sorted[Math.floor(n * 0.9)];
  const thr = Math.max(p50 * 2.5, 0.012), cues = [], minGap = Math.round(fps * 0.45);
  let last = -minGap;
  for (let i = 1; i < n - 1; i++) {
    if (sm[i] < thr || sm[i] < sm[i - 1] || sm[i] < sm[i + 1] || i - last < minGap) continue;
    cues.push({ t: i / fps, s: sm[i] >= p90 && sm[i] > thr * 2 ? 'whoosh' : 'pop' }); last = i;
  }
  const out = [{ t: 0.08, s: 'pop' }, ...cues.filter((c) => c.t > 0.3 && c.t < duration - 1.4)];
  out.push({ t: Math.max(0, duration - 1.3), s: 'chime' });
  return out.slice(0, Math.ceil(duration * 1.4));
}

/** Cama musical suave sintetizada: acordes de pad + pulso tenue. */
export function musicBed(duration, seed = 1) {
  const n = Math.round(SR * duration), L = new Float32Array(n), R = new Float32Array(n), r = rng(seed * 7919 + 13);
  const roots = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]]; // Am7 Fmaj7 Cmaj7 G(6)
  const prog = r() > 0.5 ? roots : [roots[1], roots[2], roots[0], roots[3]];
  const bpm = 92 + Math.floor(r() * 16), beat = 60 / bpm, bar = beat * 4;
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);
  for (let i = 0; i < n; i++) {
    const t = i / SR, chord = prog[Math.floor(t / bar) % prog.length], inBar = (t % bar) / bar;
    const swell = 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, inBar * 1.1));
    let v = 0, w = 0;
    chord.forEach((m, k) => { const f = hz(m - 12); v += Math.sin(2 * Math.PI * f * t + k) + 0.3 * Math.sin(2 * Math.PI * f * 2.003 * t); w += Math.sin(2 * Math.PI * f * 1.004 * t + k * 2) + 0.3 * Math.sin(2 * Math.PI * f * 1.997 * t); });
    // pulso suave en cada tiempo (bajo)
    const tb = t % beat, kick = Math.sin(2 * Math.PI * (55 + 60 * Math.exp(-tb * 30)) * tb) * Math.exp(-tb * 9);
    // arpegio tenue en corcheas
    const te = t % (beat / 2), note = chord[Math.floor(t / (beat / 2)) % chord.length], arp = Math.sin(2 * Math.PI * hz(note + 12) * t) * Math.exp(-te * 7) * 0.35;
    L[i] = (v * 0.05 * swell + kick * 0.18 + arp * 0.6 * (1 + Math.sin(t * 0.7)) / 2);
    R[i] = (w * 0.05 * swell + kick * 0.18 + arp * 0.6 * (1 - Math.sin(t * 0.7)) / 2);
  }
  // un poco de suavizado y entrada/salida
  const fade = (x) => { const fi = SR * 0.8, fo = SR * 1.5; for (let i = 0; i < n; i++) x[i] *= Math.min(1, i / fi, (n - i) / fo); return lowpass(x, 4); };
  return [fade(L), fade(R)];
}

export function musicFiles() {
  const dir = process.env.MUSICA_DIR || path.join(ROOT, 'assets/musica');
  try { return fs.readdirSync(dir).filter((f) => /\.(mp3|m4a|wav|aac)$/i.test(f)).map((f) => path.join(dir, f)); } catch { return []; }
}

/** Mezcla efectos + música sintetizada y escribe un WAV estéreo. Devuelve la ruta. */
export function writeSoundtrack(file, { duration, cues, seed = 1, withMusic = true }) {
  const n = Math.round(SR * duration), L = new Float32Array(n), R = new Float32Array(n);
  if (withMusic) { const [ml, mr] = musicBed(duration, seed); for (let i = 0; i < n; i++) { L[i] += ml[i] * 0.55; R[i] += mr[i] * 0.55; } }
  let k = 0;
  for (const c of cues) {
    const s = c.s === 'whoosh' ? SFX.whoosh(0.5, 6, ++k) : c.s === 'chime' ? SFX.chime() : c.s === 'bipbup' ? SFX.bipbup() : c.s === 'tick' ? SFX.tick(++k) : SFX.pop(560 + (k++ % 4) * 70, 880 + (k % 4) * 70);
    const g = c.s === 'whoosh' ? 0.55 : c.s === 'chime' ? 0.5 : 0.4, at = Math.round(c.t * SR);
    for (let i = 0; i < s.length && at + i < n; i++) { L[at + i] += s[i] * g; R[at + i] += s[i] * g; }
  }
  let peak = 1e-6; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const buf = Buffer.alloc(44 + n * 4), gain = 0.85 / peak;
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * gain * 32767))), 44 + i * 4);
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * gain * 32767))), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
  return file;
}
