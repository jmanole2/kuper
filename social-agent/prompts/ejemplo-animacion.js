// Ejemplo de referencia: Reel 9:16 de 10 s, "3 errores al usar IA en tu PyME".
// Concepto: tarjetas de vidrio que entran una por una sobre el fondo iridiscente;
// cada error se tacha y se reemplaza por la corrección. Cierre con logo.
function setup(K) {
  const c = K.content;
  // Medir una sola vez los bloques de texto (fit es caro).
  const cardW = K.safe.width;
  return {
    cardW,
    hook: K.fit(c.hook, { maxW: cardW, maxH: K.H * 0.2, max: 104 * K.U, weight: 800, upper: true }),
    items: c.items.map((it) => ({
      mal: K.fit(it.mal, { maxW: cardW - 120 * K.U, maxH: 190 * K.U, max: 64 * K.U, weight: 700 }),
      bien: K.fit(it.bien, { maxW: cardW - 120 * K.U, maxH: 190 * K.U, max: 52 * K.U, weight: 400, family: K.brand.fontBody }),
    })),
    cierre: K.fit(c.cierre, { maxW: cardW, maxH: K.H * 0.16, max: 84 * K.U, weight: 800, upper: true }),
  };
}

function draw(ctx, t, K) {
  const S = K.state, U = K.U, { safe } = K;
  K.bg.iridescent(ctx, t, { darkness: 0.55 });

  // --- 0.0–2.4 s: gancho
  const hookIn = K.tween(t, 0.2, 1.0);
  const hookOut = K.tween(t, 2.1, 2.6, K.ease.inCubic);
  if (t < 2.7) {
    ctx.save();
    ctx.globalAlpha = 1 - hookOut;
    ctx.translate(0, -hookOut * 80 * U);
    K.pill(ctx, 'IA PARA PYMES', safe.left, safe.top + 40 * U, { p: K.tween(t, 0, 0.5) });
    K.drawText(ctx, S.hook, safe.left, K.H * 0.38, { p: hookIn, style: 'mask', by: 'words', highlight: { words: ['ia'], color: K.brand.accent } });
    ctx.restore();
  }

  // --- 2.4–8.0 s: tres tarjetas, una a la vez (la anterior sale cuando entra la siguiente)
  const start = 2.4, each = 1.85;
  S.items.forEach((it, i) => {
    const t0 = start + i * each, t1 = t0 + each;
    if (t < t0 || t > t1 + 0.4) return;
    const enter = K.tween(t, t0, t0 + 0.5, K.ease.outBack);
    const exit = K.tween(t, t1 - 0.05, t1 + 0.35, K.ease.inCubic);
    const cardH = 150 * U + it.mal.height + it.bien.height + 80 * U;
    const y = (K.H - cardH) / 2 - 40 * U + (1 - enter) * K.H * 0.45 - exit * K.H * 0.25;
    ctx.save();
    ctx.globalAlpha = Math.min(1, enter * 1.4) * (1 - exit);
    ctx.translate(K.W / 2, y + cardH / 2); ctx.rotate((1 - enter) * 0.06 - exit * 0.04); ctx.translate(-K.W / 2, -(y + cardH / 2));
    K.glass(ctx, safe.left, y, S.cardW, cardH, { glow: K.rgba(K.brand.primary, 0.5) });
    // número grande
    ctx.font = K.font(800, 64 * U); ctx.fillStyle = K.brand.accent2; ctx.textBaseline = 'top';
    ctx.fillText(`0${i + 1}`, safe.left + 56 * U, y + 50 * U);
    // el error, tachado cuando aparece la corrección
    const strike = K.tween(t, t0 + 0.75, t0 + 1.1);
    const tx = safe.left + 56 * U, ty = y + 140 * U;
    K.drawText(ctx, it.mal, tx, ty, { p: K.tween(t, t0 + 0.2, t0 + 0.65), color: K.rgba('#ffffff', 1 - strike * 0.5) });
    if (strike > 0) {
      ctx.fillStyle = K.brand.accent2; ctx.font = it.mal.font;
      it.mal.lines.forEach((l, li) => ctx.fillRect(tx, ty + li * it.mal.lineH + it.mal.size * 0.55, ctx.measureText(l).width * strike, 6 * U));
    }
    // la corrección
    K.drawText(ctx, it.bien, tx, ty + it.mal.height + 40 * U, { p: K.tween(t, t0 + 0.95, t0 + 1.45), style: 'rise', color: '#ffffff' });
    ctx.restore();
  });

  // --- 8.0–10 s: cierre
  const cl = K.tween(t, 8.1, 8.8, K.ease.outBack);
  if (t > 8.0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, cl);
    const y = K.H * 0.42;
    K.drawText(ctx, S.cierre, K.W / 2, y, { align: 'center', p: K.tween(t, 8.1, 8.9), style: 'rise' });
    K.logo(ctx, K.W / 2, y + S.cierre.height + 70 * U, 90 * U, { align: 'center', alpha: K.tween(t, 8.6, 9.2) });
    ctx.restore();
  }
  K.grain(ctx, 0.06);
}
