/* Particle orb shared by panel.js and ad.js.
 *   const orb = makeOrb({ particles, accent, seed });
 *   orb.draw(ctx, cx, cy, radius, u)   // u = loop phase 0..1 (one full turn, seamless)
 */
'use strict';
window.makeOrb = function makeOrb(opts = {}) {
  const N = opts.particles ?? 5200, ACCENT = opts.accent ?? '#C9E33F', ACC_P = opts.accentShare ?? 0.01;
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const R = rng(opts.seed ?? 42);
  // smooth lumpiness: a few random waves over the direction
  const WAVES = Array.from({ length: 7 }, () => {
    const z = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    return { d: [s * Math.cos(a), s * Math.sin(a), z], f: 1.5 + R() * 2.5, p: R() * 6.28, amp: 0.018 + R() * 0.025 };
  });
  const lump = (x, y, z) => WAVES.reduce((acc, w) => acc + w.amp * Math.sin(w.f * (x * w.d[0] + y * w.d[1] + z * w.d[2]) * 3 + w.p), 0);
  const PTS = [];
  for (let i = 0; i < N; i++) { // fibonacci sphere + jitter
    const k = (i + 0.5) / N;
    const z = 1 - 2 * k, r = Math.sqrt(1 - z * z), a = i * 2.399963 + (R() - 0.5) * 0.08;
    const x = r * Math.cos(a), y = r * Math.sin(a);
    const shell = 1 + lump(x, y, z) - Math.pow(R(), 3) * 0.16;
    PTS.push({ x: x * shell, y: y * shell, z: z * shell, s: R(), accent: R() < ACC_P, tw: R() * 6.28 });
  }
  const buf = PTS.map(() => [0, 0, 0, null]);

  function draw(ctx, CX, CY, RAD, u, scale = 1) {
    const ay = u * Math.PI * 2;
    const ax = 0.32 + 0.06 * Math.sin(u * Math.PI * 2);
    const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
    const k = RAD * (1 + 0.015 * Math.sin(u * Math.PI * 4));
    PTS.forEach((p, i) => {
      let x = p.x * cy + p.z * sy, z = -p.x * sy + p.z * cy, y = p.y;
      const y2 = y * cx - z * sx; z = y * sx + z * cx; y = y2;
      const f = 3.2 / (3.2 - z);
      const b = buf[i]; b[0] = CX + x * k * f; b[1] = CY + y * k * f; b[2] = z; b[3] = p;
    });
    buf.sort((a, b) => a[2] - b[2]);
    ctx.save();
    for (const [px, py, z, p] of buf) {
      const depth = (z + 1) / 2;
      const tw = 0.75 + 0.25 * Math.sin(p.tw + u * Math.PI * 6);
      let s;
      if (p.accent) {
        ctx.fillStyle = ACCENT;
        ctx.globalAlpha = (0.35 + 0.65 * depth) * tw;
        s = (3 + 2.5 * depth) * scale;
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = (0.12 + 0.8 * depth * depth) * (0.55 + 0.45 * p.s) * tw;
        s = (1.4 + 2.2 * depth * (0.5 + 0.5 * p.s)) * scale;
      }
      ctx.fillRect(px - s / 2, py - s / 2, s, s);
    }
    ctx.restore();
  }
  return { draw };
};
