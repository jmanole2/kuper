/* Kit de animación 2D (corre dentro de Chromium).
 * Claude escribe una función draw(ctx, t, K) por post; este archivo le da a K
 * todo lo necesario: medidas, marca, matemáticas, texto, formas, fondos y logo.
 * Reglas del motor: draw debe ser función pura de t (mismo t → mismo cuadro).
 */
'use strict';
window.makeKit = function makeKit(spec, assets) {
  const W = spec.width, H = spec.height;
  const U = Math.min(W, H) / 1080;

  // ------------------------------------------------------------ matemáticas
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (t, a, b) => (b === a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
  const ease = {
    linear: (x) => x,
    inQuad: (x) => x * x,
    outQuad: (x) => 1 - (1 - x) * (1 - x),
    inCubic: (x) => x * x * x,
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
    outBack: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    outElastic: (x) => (x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
  };
  // progreso con curva entre a y b
  const tween = (t, a, b, e = ease.outCubic) => e(seg(t, a, b));
  // entrada escalonada: elemento i empieza en start + i*gap y dura dur
  const stagger = (t, start, i, gap, dur, e = ease.outCubic) => tween(t, start + i * gap, start + i * gap + dur, e);
  // 0→1→0 entre a y b (para algo que entra y sale)
  const inOut = (t, a, b, fade = 0.35, e = ease.outCubic) => Math.min(tween(t, a, a + fade, e), 1 - tween(t, b - fade, b, ease.inCubic));
  function rand(seed = 1) {
    let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
    return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  }
  // ruido suave 2D (value noise) en [-1, 1]
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  function noise(x, y = 0) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return (lerp(lerp(a, b, u), lerp(c, d, u), v)) * 2 - 1;
  }

  // ------------------------------------------------------------ color
  const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h).trim()); const n = m ? parseInt(m[1], 16) : 0; return [n >> 16, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a = 1) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; };
  const mix = (h1, h2, k) => { const a = hexRgb(h1), b = hexRgb(h2); return '#' + a.map((v, i) => Math.round(lerp(v, b[i], k)).toString(16).padStart(2, '0')).join(''); };
  const lum = (h) => { const c = hexRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const readableOn = (bg) => (contrast(bg, '#111111') >= contrast(bg, '#ffffff') ? '#111111' : '#ffffff');

  // ------------------------------------------------------------ marca
  const b = spec.brand || {};
  const colors = (b.colors || []).filter((c) => /^#?[0-9a-f]{6}$/i.test(c)).map((c) => (c[0] === '#' ? c : '#' + c));
  const sorted = [...colors].sort((x, y) => lum(x) - lum(y));
  const bg = b.bg || sorted[0] || '#0b0d1f';
  const vivid = colors.filter((c) => c !== bg && lum(c) > 0.04 && lum(c) < 0.85);
  const brand = {
    name: b.name || '',
    colors,
    bg,
    primary: b.primary || vivid[0] || '#3b7cf6',
    accent: b.accent || vivid[1] || vivid[0] || '#ec4899',
    accent2: vivid[2] || vivid[1] || vivid[0] || '#8b5cf6',
    light: sorted[sorted.length - 1] && lum(sorted[sorted.length - 1]) > 0.7 ? sorted[sorted.length - 1] : '#ffffff',
    text: readableOn(bg),
    fontHead: b.fontHead || 'Brand Head',
    fontBody: b.fontBody || 'Brand Body',
    style: b.style || '',
    logo: assets.logo || null,
  };

  // ------------------------------------------------------------ texto
  const font = (weight, size, family = brand.fontHead) => `${weight} ${Math.round(size)}px "${family}", sans-serif`;
  let ctxRef = null;
  function wrap(text, maxW, f) {
    const c = ctxRef; c.save(); c.font = f;
    const lines = [];
    for (const para of String(text ?? '').split('\n')) {
      let line = '';
      for (const w of para.split(/\s+/).filter(Boolean)) {
        const test = line ? line + ' ' + w : w;
        if (c.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
      }
      lines.push(line);
    }
    c.restore();
    return lines;
  }
  /** Ajusta el texto al recuadro bajando el tamaño. Devuelve {font, size, lines, lineH, width, height}. */
  function fit(text, o = {}) {
    const { maxW = W * 0.8, maxH = H * 0.3, weight = 800, max = 120 * U, min = 22 * U, lineHeight = 1.1, family = brand.fontHead, upper = false } = o;
    const str = upper ? String(text).toUpperCase() : String(text);
    for (let size = max; size >= min; size -= 2 * U) {
      const f = font(weight, size, family);
      const lines = wrap(str, maxW, f);
      const c = ctxRef; c.save(); c.font = f;
      const width = Math.max(...lines.map((l) => c.measureText(l).width));
      c.restore();
      if (lines.length * size * lineHeight <= maxH && width <= maxW) return { font: f, size, lines, lineH: size * lineHeight, width, height: lines.length * size * lineHeight };
    }
    const f = font(weight, min, family);
    const lines = wrap(str, maxW, f);
    return { font: f, size: min, lines, lineH: min * lineHeight, width: maxW, height: lines.length * min * lineHeight, overflow: true };
  }
  /**
   * Dibuja un bloque de fit(). x,y = esquina superior (según align).
   * p = progreso 0..1 de la animación de entrada; style: 'rise' | 'fade' | 'type' | 'mask' | 'none'
   * by: 'words' | 'lines' | 'chars'
   */
  function drawText(ctx, block, x, y, o = {}) {
    const { color = brand.text, align = 'left', p = 1, style = 'rise', by = 'words', spread = 0.6, shadow = null, highlight = null } = o;
    ctx.save();
    ctx.font = block.font; ctx.textBaseline = 'top'; ctx.fillStyle = color;
    if (shadow) { ctx.shadowColor = shadow.color || 'rgba(0,0,0,0.4)'; ctx.shadowBlur = shadow.blur ?? 20 * U; ctx.shadowOffsetY = shadow.y ?? 6 * U; }
    const units = [];
    block.lines.forEach((line, li) => {
      const lw = ctx.measureText(line).width;
      const lx = align === 'center' ? x - lw / 2 : align === 'right' ? x - lw : x;
      const ly = y + li * block.lineH;
      if (by === 'lines') units.push({ s: line, x: lx, y: ly, li });
      else if (by === 'chars') { let cx = lx; for (const ch of line) { units.push({ s: ch, x: cx, y: ly, li }); cx += ctx.measureText(ch).width; } }
      else { let cx = lx; for (const w of line.split(' ')) { units.push({ s: w, x: cx, y: ly, li }); cx += ctx.measureText(w + ' ').width; } }
    });
    const n = units.length;
    units.forEach((u, i) => {
      // cada unidad anima en una ventana; spread controla cuánto se escalonan
      const start = n > 1 ? (i / (n - 1)) * spread : 0;
      const k = style === 'none' ? 1 : clamp((p - start) / (1 - spread || 1));
      if (k <= 0) return;
      if (highlight && highlight.words?.some((w) => u.s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') === w.toLowerCase())) ctx.fillStyle = highlight.color;
      else ctx.fillStyle = color;
      ctx.save();
      if (style === 'type') { if (k < 1) { ctx.restore(); return; } ctx.fillText(u.s, u.x, u.y); ctx.restore(); return; }
      const e = ease.outCubic(k);
      ctx.globalAlpha *= style === 'mask' ? 1 : e;
      if (style === 'mask') { ctx.beginPath(); ctx.rect(u.x - 4 * U, u.y - block.size * 0.15, ctx.measureText(u.s).width + 8 * U, block.lineH * 1.05); ctx.clip(); ctx.fillText(u.s, u.x, u.y + (1 - e) * block.lineH); }
      else if (style === 'rise') ctx.fillText(u.s, u.x, u.y + (1 - e) * block.size * 0.45);
      else ctx.fillText(u.s, u.x, u.y);
      ctx.restore();
    });
    ctx.restore();
  }

  // ------------------------------------------------------------ formas
  function roundRect(ctx, x, y, w, h, r = 24 * U) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  /** Tarjeta de vidrio esmerilado: desenfoca lo que ya está dibujado detrás. */
  function glass(ctx, x, y, w, h, o = {}) {
    const { r = 36 * U, blur = 28 * U, tint = 'rgba(255,255,255,0.08)', border = 'rgba(255,255,255,0.22)', glow = null, shadow = true } = o;
    ctx.save();
    if (shadow) { ctx.save(); roundRect(ctx, x, y, w, h, r); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 60 * U; ctx.shadowOffsetY = 24 * U; ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill(); ctx.restore(); }
    roundRect(ctx, x, y, w, h, r); ctx.clip();
    const m = ctx.getTransform(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = `blur(${blur}px)`; ctx.drawImage(ctx.canvas, 0, 0); ctx.filter = 'none';
    ctx.setTransform(m);
    ctx.fillStyle = tint; ctx.fillRect(x, y, w, h);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(0.4, 'rgba(255,255,255,0.02)'); g.addColorStop(1, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.save(); roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 30 * U; }
    ctx.strokeStyle = border; ctx.lineWidth = 1.5 * U; ctx.stroke(); ctx.restore();
  }
  function pill(ctx, text, x, y, o = {}) {
    const { size = 28 * U, color = brand.text, fill = 'rgba(255,255,255,0.08)', border = 'rgba(255,255,255,0.45)', p = 1 } = o;
    ctx.save(); ctx.globalAlpha *= ease.outCubic(clamp(p));
    ctx.font = font(700, size, brand.fontHead);
    const tw = ctx.measureText(text).width, padX = size * 0.8, h = size * 2;
    roundRect(ctx, x, y, tw + padX * 2, h, h / 2); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = border; ctx.lineWidth = 1.5 * U; ctx.stroke();
    ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.fillText(text, x + padX, y + h / 2 + 1);
    ctx.restore();
    return { w: tw + padX * 2, h };
  }
  function glowCircle(ctx, x, y, r, color, alpha = 0.8) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, alpha)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ------------------------------------------------------------ fondos listos
  const bgs = {
    solid(ctx, color = brand.bg) { ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); },
    /** degradado iridiscente que se desplaza + líneas verticales de luz */
    iridescent(ctx, t, o = {}) {
      const { colors: cs = [brand.primary, brand.accent2, brand.accent], speed = 0.08, lines = true, darkness = 0.45 } = o;
      ctx.fillStyle = brand.bg; ctx.fillRect(0, 0, W, H);
      const a = t * speed * Math.PI * 2;
      const g = ctx.createLinearGradient(W * (0.5 + 0.5 * Math.cos(a)), 0, W * (0.5 - 0.5 * Math.cos(a)), H);
      cs.forEach((c, i) => g.addColorStop(i / Math.max(1, cs.length - 1), c));
      ctx.globalAlpha = 0.85; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      if (lines) {
        for (let i = 0; i < 26; i++) {
          const x = (i / 26) * W + Math.sin(t * 0.6 + i) * 6 * U;
          const lw = (2 + (i % 4) * 3) * U;
          const lg = ctx.createLinearGradient(0, 0, 0, H);
          const al = 0.06 + 0.08 * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 1.7));
          lg.addColorStop(0, `rgba(255,255,255,0)`); lg.addColorStop(0.45, `rgba(255,255,255,${al})`); lg.addColorStop(1, `rgba(255,255,255,0)`);
          ctx.fillStyle = lg; ctx.fillRect(x, 0, lw, H);
        }
      }
      const v = ctx.createLinearGradient(0, 0, 0, H);
      v.addColorStop(0, rgba(brand.bg, darkness * 0.4)); v.addColorStop(0.55, rgba(brand.bg, darkness * 0.6)); v.addColorStop(1, rgba(brand.bg, Math.min(1, darkness * 1.8)));
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    },
    /** esferas de luz que flotan */
    orbs(ctx, t, o = {}) {
      const { colors: cs = [brand.primary, brand.accent2, brand.accent], count = 6, seed = 3 } = o;
      ctx.fillStyle = brand.bg; ctx.fillRect(0, 0, W, H);
      const r = rand(seed);
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < count; i++) {
        const bx = r() * W, by = r() * H, rad = (300 + r() * 420) * U, sp = 0.15 + r() * 0.2, ph = r() * 6;
        glowCircle(ctx, bx + Math.sin(t * sp + ph) * 140 * U, by + Math.cos(t * sp * 0.8 + ph) * 160 * U, rad, cs[i % cs.length], 0.55);
      }
      ctx.restore();
    },
    /** malla de puntos/perspectiva tech */
    grid(ctx, t, o = {}) {
      const { color = brand.primary, gap = 64 * U, speed = 40 * U } = o;
      ctx.fillStyle = brand.bg; ctx.fillRect(0, 0, W, H);
      const off = (t * speed) % gap;
      ctx.fillStyle = rgba(color, 0.35);
      for (let y = -gap + off; y < H + gap; y += gap) for (let x = 0; x < W + gap; x += gap) { ctx.beginPath(); ctx.arc(x, y, 2.2 * U, 0, Math.PI * 2); ctx.fill(); }
      glowCircle(ctx, W * 0.5, H * 0.35, W * 0.7, color, 0.25);
    },
  };

  // ------------------------------------------------------------ acabados
  let grainCanvas = null;
  function grain(ctx, amount = 0.08) {
    if (!grainCanvas) {
      grainCanvas = document.createElement('canvas'); grainCanvas.width = grainCanvas.height = 256;
      const g = grainCanvas.getContext('2d'); const d = g.createImageData(256, 256); const r = rand(9);
      for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - 0.5) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      g.putImageData(d, 0, 0);
    }
    ctx.save(); ctx.globalAlpha = amount; ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(grainCanvas, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  function vignette(ctx, strength = 0.5) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  /** Logo del cliente. h = alto en px. align: 'left' | 'center' | 'right' respecto a x. */
  function logo(ctx, x, y, h = 60 * U, o = {}) {
    const { align = 'left', alpha = 1, which = 'main' } = o;
    const img = which === 'mark' && assets.mark ? assets.mark : brand.logo;
    if (!img) {
      if (!brand.name) return 0;
      ctx.save(); ctx.globalAlpha *= alpha; ctx.font = font(800, h * 0.7); ctx.fillStyle = brand.text; ctx.textBaseline = 'top';
      const w = ctx.measureText(brand.name).width; ctx.fillText(brand.name, align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, y + h * 0.15); ctx.restore();
      return w;
    }
    const w = img.width * (h / img.height);
    ctx.save(); ctx.globalAlpha *= alpha; ctx.drawImage(img, align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, y, w, h); ctx.restore();
    return w;
  }
  /** Número que cuenta de `from` a `to` entre a y b. */
  const counter = (t, from, to, a, b, decimals = 0) => (from + (to - from) * tween(t, a, b, ease.outExpo)).toFixed(decimals);

  // ------------------------------------------------------------ zona segura
  // En Reels/Stories la interfaz de Instagram tapa arriba y abajo: el texto importante va dentro.
  const tall = H / W > 1.6;
  const safe = {
    top: tall ? 0.12 * H : 0.06 * H,
    bottom: tall ? H - 0.22 * H : H - 0.07 * H,
    left: 0.08 * W,
    right: W - (tall ? 0.16 : 0.08) * W,
  };
  safe.width = safe.right - safe.left; safe.height = safe.bottom - safe.top;

  const K = {
    W, H, U, fps: spec.fps, duration: spec.duration, format: spec.format, kind: spec.kind,
    slide: spec.slide || 0, slides: spec.slides || 1, safe, brand, content: spec.content || {},
    clamp, lerp, seg, ease, tween, stagger, inOut, rand, noise,
    rgba, mix, lum, contrast, readableOn,
    font, wrap, fit, drawText, roundRect, glass, pill, glowCircle, bg: bgs, grain, vignette, logo, counter,
    _bindCtx(c) { ctxRef = c; },
  };
  return K;
};
