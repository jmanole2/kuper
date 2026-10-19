// Ejemplo de referencia: Reel 9:16 de 12 s para una marca de agentes de IA en WhatsApp.
// Dirección: oscuro, editorial, mucha aire. Un solo elemento de luz guía la mirada.
// Escena 1-2: la hora del mensaje contra la hora de la respuesta (el problema, con números).
// Escena 3: un haz de luz sube y "enciende" la respuesta. Cierre: logo + palabra clave.
// K.content: { escenas: [{ titular, apoyo }], cierre, cta }
function setup(K) {
  const c = K.content, U = K.U, w = K.safe.width;
  const big = (txt) => K.fit(txt, { maxW: w, maxH: K.H * 0.24, max: 112 * U, min: 64 * U, weight: 400, lineHeight: 1.02 });
  const small = (txt) => (txt ? K.fit(txt, { maxW: w * 0.85, maxH: K.H * 0.12, max: 42 * U, min: 34 * U, weight: 400, family: K.brand.fontBody, lineHeight: 1.3, tracking: 0 }) : null);
  return {
    scenes: c.escenas.map((e) => ({ t: big(e.titular), a: small(e.apoyo) })),
    cierre: K.fit(c.cierre, { maxW: w, maxH: K.H * 0.14, max: 96 * U, weight: 400 }),
  };
}

function draw(ctx, t, K) {
  const S = K.state, U = K.U, sf = K.safe, W = K.W, H = K.H;
  const blue = K.brand.primary, ice = K.brand.light;

  // Fondo: casi negro con UNA zona de luz concentrada que baja lento a lo largo del video.
  const k = K.tween(t, 0, 9, K.ease.inOutSine);
  K.bg.luminous(ctx, t, { base: K.brand.bg, spots: [
    { x: 0.95, y: K.lerp(0.02, 0.3, k), r: 0.6, color: blue, a: 0.75 },
    { x: 0.0, y: 1.05, r: 0.45, color: K.brand.accent, a: 0.3 },
  ] });
  K.vignette(ctx, 0.55);

  // Etiquetas de esquina (siempre presentes, muy discretas).
  K.corners(ctx, { tl: K.brand.name, tr: 'Agentes de IA' }, { p: K.tween(t, 0.1, 0.8), alpha: 0.6 });

  // Línea horizontal fina con destello que cruza toda la pieza (hilo conductor).
  const lineY = sf.top + sf.height * 0.36;
  const sx = K.lerp(sf.left, sf.right, K.tween(t, 0.2, 6.2, K.ease.inOutCubic));
  K.hairline(ctx, 0, lineY, W, lineY, { p: K.tween(t, 0, 1.2, K.ease.outExpo), alpha: 0.22 * (1 - K.tween(t, 5.8, 6.4)) });
  if (t < 6.4) K.sparkle(ctx, sx, lineY, 22 * U, { alpha: K.inOut(t, 0.3, 6.4, 0.6) });

  // Escena 3: panel de vidrio acanalado con una aurora detrás (la "respuesta" se enciende).
  // Va DEBAJO del texto de la escena y se dibuja ANTES, para que el vidrio no deforme las letras.
  const textY = lineY + 60 * U;
  const s3 = S.scenes[2];
  const s3Y = sf.top + 130 * U; // la escena 3 sube para dejarle espacio al panel
  const pk = K.tween(t, 6.3, 7.2, K.ease.outCubic) * (1 - K.tween(t, 9.3, 9.8, K.ease.inCubic));
  if (pk > 0 && s3) {
    const px = sf.left, pw = sf.width;
    const py = s3Y + s3.t.height + (s3.a ? s3.a.height + 36 * U : 0) + 80 * U + (1 - pk) * 80 * U;
    const ph = Math.max(200 * U, sf.bottom - py);
    ctx.save(); ctx.globalAlpha = pk;
    ctx.save(); K.roundRect(ctx, px, py, pw, ph, 36 * U); ctx.clip(); // la luz vive dentro del vidrio
    ctx.fillStyle = K.rgba(K.brand.bg, 0.6); ctx.fillRect(px, py, pw, ph);
    K.aurora(ctx, t, { x: px, y: py, w: pw, h: ph, color: blue, intensity: 2.2 * pk, ribbons: 4 });
    ctx.restore();
    K.fluted(ctx, px, py, pw, ph, { ribs: 16, amp: 34 * U, blur: 4 * U, r: 36 * U, phase: t * 0.5, shade: 0.28 });
    K.roundRect(ctx, px, py, pw, ph, 36 * U); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5 * U; ctx.stroke();
    K.pill(ctx, 'Responde por ti', px + 40 * U, py + ph - 100 * U, { p: K.tween(t, 6.8, 7.4) });
    K.asterisk(ctx, px + pw - 70 * U, py + 70 * U, 30 * U, { w: 6 * U, color: ice, p: K.tween(t, 6.9, 7.6), rot: t * 0.2 });
    ctx.restore();
  }

  // Escenas: titular grande que entra desenfocado y se enfoca; apoyo pequeño debajo.
  const slots = [[0.25, 3.0], [3.0, 6.3], [6.3, 9.5]];
  S.scenes.forEach((sc, i) => {
    const [a, b] = slots[i] || slots[slots.length - 1];
    const vis = K.inOut(t, a, b, 0.5);
    if (vis <= 0) return;
    ctx.save(); ctx.globalAlpha = vis;
    const y = i === 2 ? s3Y : textY;
    K.drawText(ctx, sc.t, sf.left, y, { p: K.tween(t, a, a + 0.9), style: 'blur', by: 'words', spread: 0.5 });
    if (sc.a) K.drawText(ctx, sc.a, sf.left, y + sc.t.height + 36 * U, { p: K.tween(t, a + 0.6, a + 1.3), style: 'blur', color: K.rgba(ice, 0.72) });
    ctx.restore();
  });

  // Cierre: cono de luz (filo blanco que sube, cuña oscura que baja), mensaje y logo quietos.
  const o = K.tween(t, 9.6, 10.6);
  if (o > 0) {
    ctx.save(); ctx.globalAlpha = o;
    K.lightCone(ctx, W / 2, H * 0.5, { h: H * 0.42 * K.tween(t, 9.6, 10.8, K.ease.outCubic), color: blue, intensity: o });
    K.drawText(ctx, S.cierre, W / 2, H * 0.58, { align: 'center', p: K.tween(t, 10.0, 10.9), style: 'blur' });
    K.logo(ctx, W / 2, sf.bottom - 70 * U, 56 * U, { align: 'center', alpha: K.tween(t, 10.4, 11.1) * 0.9 });
    ctx.restore();
  }
  K.grain(ctx, 0.05);
}
