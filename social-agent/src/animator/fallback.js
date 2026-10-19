// Diseño genérico de respaldo: se usa en modo de prueba (MOCK_LLM) o si Claude no logra
// una pieza válida. Estilo editorial oscuro con luz; lee K.content con la estructura estándar.
export const FALLBACK_CODE = String.raw`
function setup(K) {
  const c = K.content, U = K.U, w = K.safe.width;
  const head = (txt, big) => K.fit(txt || '', { maxW: w, maxH: K.H * (big ? 0.34 : 0.26), max: (big ? 124 : 96) * U, min: 56 * U, weight: 400, lineHeight: 1.03 });
  const body = (txt) => (txt ? K.fit(txt, { maxW: w * 0.9, maxH: K.H * 0.2, max: 42 * U, min: 32 * U, weight: 400, family: K.brand.fontBody, lineHeight: 1.32, tracking: 0 }) : null);
  const items = K.kind === 'carrusel' ? (c.slides || []).map((s, i) => ({ h: head(s.titulo, i === 0), b: body(s.texto) }))
    : K.kind === 'imagen' ? [{ h: head(c.titular || c.tema, true), b: body(c.apoyo) }]
    : (c.escenas || []).map((s) => ({ h: head(s.titular, false), b: body(s.apoyo) }));
  return { items, cierre: K.fit(c.cierre || c.cta || '', { maxW: w, maxH: K.H * 0.16, max: 96 * U, weight: 400 }) };
}

function backdrop(ctx, t, K, k) {
  // k (0..1) mueve la luz: en carrusel avanza slide a slide para que el swipe se sienta continuo.
  K.bg.luminous(ctx, t, { spots: [
    { x: K.lerp(0.95, 0.2, k), y: K.lerp(0.05, 0.25, k), r: 0.6, color: K.brand.primary, a: 0.7 },
    { x: K.lerp(0.0, 0.9, k), y: 1.05, r: 0.45, color: K.brand.accent, a: 0.28 },
  ] });
  K.vignette(ctx, 0.5);
}

function block(ctx, K, it, x, y, p) {
  K.drawText(ctx, it.h, x, y, { p, style: 'blur' });
  if (it.b) K.drawText(ctx, it.b, x, y + it.h.height + 36 * K.U, { p: K.clamp(p * 1.3 - 0.3), style: 'blur', color: K.rgba(K.brand.light, 0.75) });
  return it.h.height + (it.b ? it.b.height + 36 * K.U : 0);
}

function outro(ctx, t, K, S, p) {
  const U = K.U;
  K.lightCone(ctx, K.W / 2, K.H * 0.5, { h: K.H * 0.42 * p, color: K.brand.primary, intensity: p });
  K.drawText(ctx, S.cierre, K.W / 2, K.H * 0.58, { align: 'center', p, style: 'blur' });
  K.logo(ctx, K.W / 2, K.safe.bottom - 70 * U, 56 * U, { align: 'center', alpha: 0.9 * p });
}

function draw(ctx, t, K) {
  const S = K.state, U = K.U, sf = K.safe;
  if (K.kind !== 'video') {
    const n = S.items.length, i = K.kind === 'carrusel' ? K.slide : 0, it = S.items[i] || S.items[0];
    backdrop(ctx, t, K, n > 1 ? i / (n - 1) : 0.3);
    const last = K.kind === 'carrusel' && i === n - 1;
    K.corners(ctx, {
      tl: K.brand.name,
      tr: n > 1 ? String(i + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0') : '',
      br: K.kind === 'carrusel' && !last ? 'Desliza' : '',
    });
    if (i === 0) {
      // portada: titular grande abajo, marca gráfica arriba a la derecha
      K.asterisk(ctx, sf.right - 50 * U, sf.top + 140 * U, 44 * U, { w: 7 * U, color: K.brand.light });
      const h = it.h.height + (it.b ? it.b.height + 36 * U : 0);
      block(ctx, K, it, sf.left, sf.bottom - h - 90 * U, 1);
    } else {
      const y = sf.top + sf.height * 0.3;
      K.hairline(ctx, sf.left, y - 50 * U, sf.right, y - 50 * U, { alpha: 0.25 });
      K.sparkle(ctx, sf.left + (sf.width * i) / Math.max(1, n - 1), y - 50 * U, 18 * U);
      block(ctx, K, it, sf.left, y, 1);
      if (last) K.logo(ctx, sf.right, sf.bottom - 50 * U, 50 * U, { align: 'right', alpha: 0.9 });
    }
    K.grain(ctx, 0.05);
    return;
  }
  backdrop(ctx, t, K, K.tween(t, 0, K.duration, K.ease.inOutSine));
  K.corners(ctx, { tl: K.brand.name }, { p: K.tween(t, 0, 0.6) });
  const n = Math.max(1, S.items.length), tail = Math.min(2.6, K.duration * 0.25), len = (K.duration - tail - 0.3) / n;
  const lineY = sf.top + sf.height * 0.36;
  K.hairline(ctx, 0, lineY, K.W, lineY, { p: K.tween(t, 0, 1.2, K.ease.outExpo), alpha: 0.2 * (1 - K.tween(t, K.duration - tail - 0.4, K.duration - tail)) });
  K.sparkle(ctx, K.lerp(sf.left, sf.right, K.tween(t, 0.2, K.duration - tail, K.ease.inOutCubic)), lineY, 20 * U, { alpha: 1 - K.tween(t, K.duration - tail - 0.4, K.duration - tail) });
  S.items.forEach((it, i) => {
    const t0 = 0.3 + i * len, t1 = t0 + len;
    const vis = K.inOut(t, t0, t1, 0.45);
    if (vis <= 0) return;
    ctx.save(); ctx.globalAlpha = vis;
    block(ctx, K, it, sf.left, lineY + 60 * U, K.tween(t, t0, t0 + 0.9));
    ctx.restore();
  });
  const o = K.tween(t, K.duration - tail, K.duration - tail + 0.9);
  if (o > 0) { ctx.save(); ctx.globalAlpha = o; outro(ctx, t, K, S, o); ctx.restore(); }
  K.grain(ctx, 0.05);
}
`;
