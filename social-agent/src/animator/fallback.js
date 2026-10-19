// Diseño genérico de respaldo: se usa en modo de prueba (MOCK_LLM) o si Claude no logra
// una pieza válida. Lee K.content con la estructura estándar del agente.
export const FALLBACK_CODE = String.raw`
function setup(K) {
  const c = K.content, U = K.U, w = K.safe.width - 112 * U;
  const card = (a, b, big) => ({
    a: K.fit(a || '', { maxW: w, maxH: K.H * (big ? 0.32 : 0.22), max: (big ? 110 : 84) * U, weight: 800 }),
    b: b ? K.fit(b, { maxW: w, maxH: K.H * 0.2, max: 48 * U, min: 30 * U, weight: 400, family: K.brand.fontBody, lineHeight: 1.3 }) : null,
  });
  const scenes = K.kind === 'carrusel'
    ? (c.slides || []).map((s, i) => card(s.titulo, s.texto, i === 0))
    : K.kind === 'imagen' ? [card(c.titular || c.tema, c.apoyo, true)]
    : (c.escenas || []).map((s) => card(s.titular, s.apoyo, false));
  return { scenes, cierre: K.fit(c.cierre || c.cta || '', { maxW: K.safe.width, maxH: K.H * 0.2, max: 90 * U, weight: 800 }) };
}

function drawCard(ctx, K, sc, p, idx, total) {
  const U = K.U, x = K.safe.left, w = K.safe.width;
  const h = 120 * U + sc.a.height + (sc.b ? sc.b.height + 40 * U : 0) + 40 * U;
  const y = K.safe.top + (K.safe.height - h) / 2 + (1 - K.ease.outCubic(p)) * 120 * U;
  ctx.save(); ctx.globalAlpha = Math.min(1, p * 1.5);
  K.glass(ctx, x, y, w, h, { glow: K.rgba(K.brand.primary, 0.45) });
  if (total > 1) { ctx.font = K.font(800, 36 * U); ctx.fillStyle = K.brand.accent; ctx.textBaseline = 'top'; ctx.fillText(String(idx + 1).padStart(2, '0') + (K.kind === 'carrusel' ? ' / ' + String(total).padStart(2, '0') : ''), x + 56 * U, y + 50 * U); }
  K.drawText(ctx, sc.a, x + 56 * U, y + 110 * U, { p: K.clamp(p * 1.2) });
  if (sc.b) K.drawText(ctx, sc.b, x + 56 * U, y + 110 * U + sc.a.height + 40 * U, { p: K.clamp(p * 1.4 - 0.4), color: K.rgba(K.brand.text, 0.85) });
  ctx.restore();
}

function draw(ctx, t, K) {
  const S = K.state, U = K.U;
  K.bg.iridescent(ctx, t, { darkness: 0.6 });
  if (K.kind !== 'video') {
    const i = K.kind === 'carrusel' ? K.slide : 0;
    drawCard(ctx, K, S.scenes[i] || S.scenes[0], 1, i, S.scenes.length);
    if (K.kind === 'carrusel' && i < S.scenes.length - 1) { ctx.font = K.font(700, 34 * U); ctx.fillStyle = K.brand.text; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('Desliza →', K.safe.right, K.safe.bottom); }
    else K.logo(ctx, K.safe.right, K.safe.bottom - 56 * U, 56 * U, { align: 'right', alpha: 0.9 });
    K.grain(ctx, 0.05);
    return;
  }
  const n = Math.max(1, S.scenes.length), outro = Math.min(2.5, K.duration * 0.25), len = (K.duration - outro - 0.3) / n;
  S.scenes.forEach((sc, i) => {
    const t0 = 0.3 + i * len, t1 = t0 + len;
    if (t < t0 || t > t1 + 0.3) return;
    const p = K.tween(t, t0, t0 + 0.6) * (1 - K.tween(t, t1 - 0.1, t1 + 0.25, K.ease.inCubic));
    drawCard(ctx, K, sc, p, i, n);
  });
  const o = K.tween(t, K.duration - outro, K.duration - outro + 0.6, K.ease.outBack);
  if (o > 0) {
    ctx.save(); ctx.globalAlpha = Math.min(1, o);
    const y = K.H * 0.42;
    K.drawText(ctx, S.cierre, K.W / 2, y, { align: 'center', p: o });
    K.logo(ctx, K.W / 2, y + S.cierre.height + 60 * U, 80 * U, { align: 'center' });
    ctx.restore();
  }
  K.grain(ctx, 0.05);
}
`;
