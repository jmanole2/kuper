/* Kuper panel — ring of modules around a particle orb.
 * The ring is static; only the orb moves (one full turn per loop, so it loops seamlessly).
 * Text / timing in panel.config.json.
 */
'use strict';
(() => {
  const CFG = Object.assign({
    duration: 6,
    items: ['Competencia', 'Blog', null, null, 'Citas', 'Leads', 'Embudo', 'Analítica', 'WhatsApp', 'Posts'],
    accent: '#C9E33F',
    particles: 5200,
  }, window.ANIM_CONFIG || {});
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const CX = 480, CY = 476;
  const R_IN = 312, R_OUT = 438;       // module segments
  const R_WELL = 292, R_DISC = 274;    // dark well + black disc
  const ORB_R = 212;

  // ---------------------------------------------------------------- random
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
  // smooth lumpiness on the sphere: sum of a few random "waves" on direction
  const R = rng(42);
  const WAVES = Array.from({ length: 7 }, () => {
    const z = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    return { d: [s * Math.cos(a), s * Math.sin(a), z], f: 1.5 + R() * 2.5, p: R() * 6.28, amp: 0.018 + R() * 0.025 };
  });
  const lump = (x, y, z) => WAVES.reduce((acc, w) => acc + w.amp * Math.sin(w.f * (x * w.d[0] + y * w.d[1] + z * w.d[2]) * 3 + w.p), 0);

  const PTS = [];
  for (let i = 0; i < CFG.particles; i++) {
    // fibonacci sphere + jitter
    const k = (i + 0.5) / CFG.particles;
    const z = 1 - 2 * k, r = Math.sqrt(1 - z * z), a = i * 2.399963 + (R() - 0.5) * 0.08;
    const x = r * Math.cos(a), y = r * Math.sin(a);
    const shell = 1 + lump(x, y, z) - Math.pow(R(), 3) * 0.16;
    PTS.push({ x: x * shell, y: y * shell, z: z * shell, s: R(), accent: R() < 0.01, tw: R() * 6.28 });
  }

  // ---------------------------------------------------------------- icons (24px line icons, centred)
  const ICON = {
    Competencia: (ctx) => { ctx.beginPath(); ctx.moveTo(-11, 0); ctx.quadraticCurveTo(0, -11, 11, 0); ctx.quadraticCurveTo(0, 11, -11, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, 7); ctx.stroke(); },
    Blog: (ctx) => { ctx.beginPath(); ctx.moveTo(-7, -10); ctx.lineTo(3, -10); ctx.lineTo(8, -5); ctx.lineTo(8, 10); ctx.lineTo(-7, 10); ctx.closePath(); ctx.stroke(); for (const y of [-2, 2, 6]) { ctx.beginPath(); ctx.moveTo(-3, y); ctx.lineTo(4, y); ctx.stroke(); } },
    Citas: (ctx) => { ctx.beginPath(); ctx.roundRect(-10, -8, 20, 18, 3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-10, -2); ctx.lineTo(10, -2); ctx.moveTo(-5, -11); ctx.lineTo(-5, -5); ctx.moveTo(5, -11); ctx.lineTo(5, -5); ctx.stroke(); },
    Leads: (ctx) => { ctx.beginPath(); ctx.arc(-3, -4, 4.5, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(-3, 11, 8, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.beginPath(); ctx.arc(6, -5, 3.5, -1.6, 1.6); ctx.stroke(); ctx.beginPath(); ctx.moveTo(8, 2); ctx.quadraticCurveTo(12, 4, 12, 9); ctx.stroke(); },
    Embudo: (ctx) => { ctx.beginPath(); ctx.moveTo(-11, -9); ctx.lineTo(11, -9); ctx.lineTo(3, 1); ctx.lineTo(3, 10); ctx.lineTo(-3, 7); ctx.lineTo(-3, 1); ctx.closePath(); ctx.stroke(); },
    'Analítica': (ctx) => { ctx.beginPath(); ctx.moveTo(-10, 10); ctx.lineTo(10, 10); for (const [x, h] of [[-5, 8], [0, 14], [5, 6]]) { ctx.moveTo(x, 10); ctx.lineTo(x, 10 - h); } ctx.stroke(); },
    WhatsApp: (ctx) => { ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(10, -8); ctx.lineTo(8, 7); ctx.lineTo(-4, 7); ctx.lineTo(-10, 11); ctx.closePath(); ctx.stroke(); },
    Posts: (ctx) => { ctx.beginPath(); ctx.roundRect(-10, -10, 20, 20, 3); ctx.stroke(); ctx.beginPath(); ctx.arc(-3, -3, 2.5, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-10, 8); ctx.lineTo(1, -1); ctx.lineTo(10, 6); ctx.stroke(); },
  };

  // ---------------------------------------------------------------- static layer (ring), drawn once
  let STATIC = null;
  function buildStatic() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const bg = g.createRadialGradient(CX + 120, CY + 300, 50, CX, CY, 900);
    bg.addColorStop(0, '#3E3B36'); bg.addColorStop(1, '#262421');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);

    const n = CFG.items.length, step = (Math.PI * 2) / n, gap = 0.035;
    CFG.items.forEach((label, i) => {
      if (!label) return;
      const a = -Math.PI / 2 + i * step, a0 = a - step / 2 + gap, a1 = a + step / 2 - gap;
      g.beginPath();
      g.arc(CX, CY, R_OUT, a0, a1);
      g.lineTo(CX + Math.cos(a1) * R_IN, CY + Math.sin(a1) * R_IN);
      g.lineTo(CX + Math.cos(a0) * R_IN, CY + Math.sin(a0) * R_IN);
      g.closePath();
      const sg = g.createLinearGradient(CX + Math.cos(a) * R_IN, CY + Math.sin(a) * R_IN, CX + Math.cos(a) * R_OUT, CY + Math.sin(a) * R_OUT);
      sg.addColorStop(0, 'rgba(255,255,255,0.075)'); sg.addColorStop(1, 'rgba(255,255,255,0.055)');
      g.fillStyle = sg; g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = 1.5; g.stroke();

      const rm = (R_IN + R_OUT) / 2;
      g.save();
      g.translate(CX + Math.cos(a) * rm, CY + Math.sin(a) * rm);
      g.rotate(Math.sin(a) > 0.01 ? a - Math.PI / 2 : a + Math.PI / 2);
      g.strokeStyle = 'rgba(232,230,224,0.88)'; g.lineWidth = 2; g.lineJoin = 'round'; g.lineCap = 'round';
      g.save(); g.translate(0, -26); g.scale(1.3, 1.3); g.lineWidth = 1.7; ICON[label]?.(g); g.restore();
      g.fillStyle = 'rgba(232,230,224,0.92)';
      g.font = '500 25px "DM Sans"'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(label, 0, 20);
      g.restore();
    });

    // dashed guide circle
    g.save(); g.setLineDash([6, 6]); g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(CX, CY, 304, 0, 7); g.stroke(); g.restore();
    // well
    const w = g.createRadialGradient(CX, CY, R_DISC, CX, CY, R_WELL);
    w.addColorStop(0, '#141312'); w.addColorStop(1, '#1D1C1A');
    g.fillStyle = w; g.beginPath(); g.arc(CX, CY, R_WELL, 0, 7); g.fill();
    // black disc with soft inner shade
    const d = g.createRadialGradient(CX, CY, 0, CX, CY, R_DISC);
    d.addColorStop(0, '#0A0A0A'); d.addColorStop(0.85, '#060606'); d.addColorStop(1, '#141414');
    g.fillStyle = d; g.beginPath(); g.arc(CX, CY, R_DISC, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 2; g.stroke();
    STATIC = c;
  }
  // ---------------------------------------------------------------- frame
  function render(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(STATIC, 0, 0);
    const u = (t / CFG.duration) % 1;
    const ay = u * Math.PI * 2;                       // full turn per loop
    const ax = 0.32 + 0.06 * Math.sin(u * Math.PI * 2); // gentle wobble, also periodic
    const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
    const breathe = 1 + 0.015 * Math.sin(u * Math.PI * 4);
    const out = [];
    for (const p of PTS) {
      let x = p.x * cy + p.z * sy, z = -p.x * sy + p.z * cy, y = p.y;
      const y2 = y * cx - z * sx; z = y * sx + z * cx; y = y2;
      const f = 3.2 / (3.2 - z);                      // perspective
      out.push([CX + x * ORB_R * breathe * f, CY + y * ORB_R * breathe * f, z, p]);
    }
    out.sort((a, b) => a[2] - b[2]);
    ctx.save();
    ctx.beginPath(); ctx.arc(CX, CY, R_DISC - 2, 0, 7); ctx.clip();
    for (const [px, py, z, p] of out) {
      const depth = (z + 1) / 2;                       // 0 back .. 1 front
      const tw = 0.75 + 0.25 * Math.sin(p.tw + u * Math.PI * 2 * 3);
      if (p.accent) {
        ctx.fillStyle = CFG.accent;
        ctx.globalAlpha = (0.35 + 0.65 * depth) * tw;
        const s = 3 + 2.5 * depth;
        ctx.fillRect(px - s / 2, py - s / 2, s, s);
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = (0.12 + 0.8 * depth * depth) * (0.55 + 0.45 * p.s) * tw;
        const s = 1.4 + 2.2 * depth * (0.5 + 0.5 * p.s);
        ctx.fillRect(px - s / 2, py - s / 2, s, s);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  window.ANIM = {
    duration: CFG.duration,
    ready: (async () => {
      await document.fonts.load('500 25px "DM Sans"');
      buildStatic();
      return true;
    })(),
    render,
  };
  if (!window.ANIM_CONFIG) {
    window.ANIM.ready.then(() => {
      const t0 = performance.now();
      const loop = () => { render(((performance.now() - t0) / 1000) % CFG.duration); requestAnimationFrame(loop); };
      loop();
    });
  }
})();
