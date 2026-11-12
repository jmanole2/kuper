/* Kuper — static ad turned into a seamless GIF: only the particle orb (and the
 * "en línea" dot) move. Kuper brand look: near-black, lime accent, DM Sans + mono labels.
 * All text in ad.config.json.
 */
'use strict';
(() => {
  const CFG = window.ANIM_CONFIG || { duration: 6, text: {} };
  const T = CFG.text;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const M = 72; // side margin
  const C = {
    bg: '#111110', card: '#1C1C1B', cardLine: 'rgba(255,255,255,0.08)',
    lime: '#D8F23F', limeDim: 'rgba(216,242,63,0.12)', iconBox: '#2A2E1C',
    text: '#F2F1EC', mute: '#A3A29C', ink: '#111110',
  };
  const ORB = window.makeOrb({ particles: 4200, accent: C.lime, accentShare: 0.012 });

  const LOGO = new Image();
  LOGO.src = window.KUPER_LOGO;

  // ---------------------------------------------------------------- helpers
  const font = (w, s, f = 'DM Sans') => `${w} ${s}px "${f}"`;
  function txt(str, x, y, o = {}) {
    ctx.save();
    ctx.font = font(o.w || 400, o.s || 28, o.f);
    ctx.letterSpacing = (o.ls || 0) + 'px';
    ctx.fillStyle = o.c || C.text;
    ctx.textAlign = o.a || 'left';
    ctx.textBaseline = o.b || 'alphabetic';
    ctx.fillText(str, x, y);
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  }
  function rr(x, y, w, h, r, fill, stroke) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
  function icon(kind, x, y) { // 24px line icons, centred on x,y, lime
    ctx.save();
    ctx.translate(x, y); ctx.scale(1.25, 1.25);
    ctx.strokeStyle = C.lime; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (kind === 'chat') {
      ctx.roundRect(-10, -9, 20, 14, 5); ctx.moveTo(-4, 5); ctx.lineTo(-7, 10); ctx.lineTo(1, 5);
      ctx.moveTo(-5, -3); ctx.lineTo(5, -3); ctx.moveTo(-5, 1); ctx.lineTo(2, 1);
    } else if (kind === 'bolt') {
      ctx.moveTo(2, -11); ctx.lineTo(-7, 2); ctx.lineTo(0, 2); ctx.lineTo(-2, 11); ctx.lineTo(7, -2); ctx.lineTo(0, -2); ctx.closePath();
    } else if (kind === 'target') {
      ctx.arc(0, 0, 10, 0, 7); ctx.moveTo(5.5, 0); ctx.arc(0, 0, 5.5, 0, 7); ctx.moveTo(1.5, 0); ctx.arc(0, 0, 1.5, 0, 7);
    } else if (kind === 'calendar') {
      ctx.roundRect(-10, -8, 20, 18, 3); ctx.moveTo(-10, -2); ctx.lineTo(10, -2);
      ctx.moveTo(-5, -11); ctx.lineTo(-5, -5); ctx.moveTo(5, -11); ctx.lineTo(5, -5);
      ctx.moveTo(-4, 4); ctx.lineTo(-1, 7); ctx.lineTo(5, 1);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------- static layer
  let STATIC = null, ORB_BOX = null, DOT = null;
  function buildStatic() {
    // background + soft olive glow top-right (as in the proposal)
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W + 60, -80, 40, W + 60, -80, 760);
    g.addColorStop(0, 'rgba(120,140,40,0.32)'); g.addColorStop(1, 'rgba(120,140,40,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // header: white logo + pill
    if (LOGO.naturalWidth) {
      const lh = 46, lw = lh * LOGO.naturalWidth / LOGO.naturalHeight;
      const c = document.createElement('canvas'); c.width = Math.ceil(lw); c.height = lh;
      const lg = c.getContext('2d');
      lg.drawImage(LOGO, 0, 0, lw, lh);
      lg.globalCompositeOperation = 'source-in'; lg.fillStyle = C.text; lg.fillRect(0, 0, lw, lh);
      ctx.drawImage(c, M, 70);
    }
    ctx.font = font(500, 19, 'JetBrains Mono'); ctx.letterSpacing = '4px';
    const pw = ctx.measureText(T.pill).width + 52; ctx.letterSpacing = '0px';
    rr(W - M - pw, 66, pw, 54, 27, null, 'rgba(255,255,255,0.18)');
    txt(T.pill, W - M - pw / 2 + 2, 94, { f: 'JetBrains Mono', w: 500, s: 19, ls: 4, c: C.lime, a: 'center', b: 'middle' });

    // headline
    const HS = 70;
    txt(T.headline[0], M - 4, 245, { w: 300, s: HS, ls: -2 });
    const w2 = txt(T.headline[1], M - 4, 330, { w: 300, s: HS, ls: -2 });
    txt(T.headline[2], M - 4 + w2, 330, { w: 700, s: HS, ls: -2.5, c: C.lime });
    // sub
    T.sub.forEach((l, i) => txt(l, M, 395 + i * 38, { s: 27, c: C.mute }));

    // orb card
    const oy = 470, oh = 370, ow = W - 2 * M;
    rr(M, oy, ow, oh, 30, C.card, C.cardLine);
    ORB_BOX = { cx: M + 290, cy: oy + oh / 2, r: 150 };
    // black well for the orb
    ctx.save();
    const wg = ctx.createRadialGradient(ORB_BOX.cx, ORB_BOX.cy, 0, ORB_BOX.cx, ORB_BOX.cy, 172);
    wg.addColorStop(0, '#070707'); wg.addColorStop(0.9, '#090909'); wg.addColorStop(1, '#151514');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(ORB_BOX.cx, ORB_BOX.cy, 172, 0, 7); ctx.fill();
    ctx.setLineDash([5, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ORB_BOX.cx, ORB_BOX.cy, 182, 0, 7); ctx.stroke();
    ctx.restore();
    // label with live dot (dot animated later)
    const rx = M + 530;
    DOT = { x: rx + 9, y: oy + 82 };
    txt(T.orbLabel, rx + 28, oy + 83, { f: 'JetBrains Mono', w: 500, s: 17, ls: 3, c: C.mute, b: 'middle' });
    // right side: 24/7
    txt(T.orbBig, rx - 6, oy + 235, { w: 700, s: 150, ls: -6, c: C.lime });
    T.orbSmall.forEach((l, i) => txt(l, rx, oy + 290 + i * 36, { s: 27, c: C.text, w: i ? 400 : 500 }));

    // benefits 2x2
    const by = 862, bw = (ow - 18) / 2, bh = 104;
    T.benefits.forEach(([ic, title, desc], i) => {
      const x = M + (i % 2) * (bw + 18), y = by + Math.floor(i / 2) * (bh + 14);
      rr(x, y, bw, bh, 22, C.card, C.cardLine);
      rr(x + 20, y + 24, 56, 56, 15, C.iconBox);
      icon(ic, x + 48, y + 52);
      txt(title, x + 92, y + 47, { w: 700, s: 23 });
      txt(desc, x + 92, y + 79, { s: 19, c: C.mute });
    });

    // lime CTA
    const cy = 1110, ch = 166;
    rr(M, cy, ow, ch, 30, C.lime);
    txt(T.ctaKicker, M + 40, cy + 46, { f: 'JetBrains Mono', w: 500, s: 17, ls: 4, c: 'rgba(17,17,16,0.7)' });
    T.cta.forEach((l, i) => txt(l, M + 40, cy + 96 + i * 42, { w: 700, s: 38, ls: -1, c: C.ink }));
    ctx.font = font(700, 26); const bwid = ctx.measureText(T.ctaButton).width + 100;
    rr(M + ow - 36 - bwid, cy + ch / 2 - 32, bwid, 64, 32, C.ink);
    txt(T.ctaButton + '  →', M + ow - 36 - bwid / 2, cy + ch / 2 + 1, { w: 700, s: 26, c: C.lime, a: 'center', b: 'middle' });

    // footer
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(M, 1300, ow, 1.5);
    txt(T.footerLeft, M, 1332, { s: 20, c: C.mute });
    txt(T.footerRight, W - M, 1332, { w: 700, s: 20, c: C.text, a: 'right' });

    STATIC = document.createElement('canvas'); STATIC.width = W; STATIC.height = H;
    STATIC.getContext('2d').drawImage(canvas, 0, 0);
  }

  // ---------------------------------------------------------------- frame
  function render(t) {
    const u = (t / CFG.duration) % 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(STATIC, 0, 0);
    // live dot: two pulses per loop
    const ph = (u * 3) % 1;
    ctx.save();
    ctx.globalAlpha = 0.45 * (1 - ph);
    ctx.fillStyle = C.lime; ctx.beginPath(); ctx.arc(DOT.x, DOT.y, 7 + 12 * ph, 0, 7); ctx.fill();
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(DOT.x, DOT.y, 7, 0, 7); ctx.fill();
    ctx.restore();
    // orb
    ctx.save();
    ctx.beginPath(); ctx.arc(ORB_BOX.cx, ORB_BOX.cy, 170, 0, 7); ctx.clip();
    ORB.draw(ctx, ORB_BOX.cx, ORB_BOX.cy, ORB_BOX.r, u, 0.9);
    ctx.restore();
  }

  window.ANIM = {
    duration: CFG.duration,
    ready: (async () => {
      await Promise.all([
        ...[300, 400, 500, 700].map((w) => document.fonts.load(`${w} 30px "DM Sans"`)),
        document.fonts.load('500 20px "JetBrains Mono"'),
        LOGO.decode().catch(() => {}),
      ]);
      buildStatic();
      return true;
    })(),
    render,
  };
})();
