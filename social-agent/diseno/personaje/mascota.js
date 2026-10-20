// Personaje de Kuper: capucha-cuerpo, cara negra, ojos de luz, bracitos y dos patitas.
// drawMascota(ctx, {x, y, s, eye, rim, look, blink, wave, phone, step, squash})
function drawMascota(x, o = {}) {
  const { cx = 0, cy = 0, s = 1, eye = '#8cff2a', rim = '#5fbf2a', look = 0, lookY = 0, blink = 0, wave = 0, phone = false, step = 0, squash = 0 } = o;
  x.save(); x.translate(cx, cy); x.scale(s * (1 + squash * 0.06), s * (1 - squash * 0.06));
  const glowLine = (path, w = 3.5) => { x.save(); x.strokeStyle = rim; x.lineWidth = w; x.lineJoin = 'round'; x.shadowColor = rim; x.shadowBlur = 10; path(); x.stroke(); x.restore(); };
  // sombra en el piso
  const sh = x.createRadialGradient(0, 205, 5, 0, 205, 150); sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = sh; x.fillRect(-170, 175, 340, 60);
  // patitas (alternan al caminar)
  for (const sx of [-1, 1]) {
    const lift = Math.max(0, Math.sin(step * Math.PI * 2 + (sx > 0 ? Math.PI : 0))) * 14;
    const leg = () => { x.beginPath(); x.roundRect(sx * 52 - 26, 150 - lift, 52, 42, 6); };
    x.fillStyle = '#1e2024'; leg(); x.fill(); glowLine(leg, 3);
  }
  // brazos: manga gris con hueco negro hacia afuera
  const arm = (sx, ang) => {
    x.save(); x.translate(sx * 128, 40); x.rotate(ang * sx);
    const sl = () => { x.beginPath(); x.roundRect(sx > 0 ? -10 : -46, -24, 56, 48, 12); };
    x.fillStyle = '#2b2d32'; sl(); x.fill(); glowLine(sl, 3);
    x.fillStyle = '#050506'; x.beginPath(); x.ellipse(sx * 40, 0, 9, 20, 0, 0, Math.PI * 2); x.fill();
    x.restore();
  };
  arm(-1, -0.15);
  // cuerpo-capucha: triángulo redondeado
  const hood = () => {
    x.beginPath(); x.moveTo(-26, -188); x.quadraticCurveTo(0, -214, 26, -188);
    x.bezierCurveTo(70, -140, 152, -40, 152, 70); x.bezierCurveTo(152, 150, 90, 165, 0, 165);
    x.bezierCurveTo(-90, 165, -152, 150, -152, 70); x.bezierCurveTo(-152, -40, -70, -140, -26, -188); x.closePath();
  };
  const g = x.createLinearGradient(-120, -200, 120, 160); g.addColorStop(0, '#3a3c42'); g.addColorStop(1, '#232428');
  x.fillStyle = g; hood(); x.fill(); glowLine(hood, 4);
  // cara
  const face = () => { x.beginPath(); x.ellipse(0, 0, 98, 112, 0, 0, Math.PI * 2); };
  const fg = x.createRadialGradient(0, -10, 20, 0, 0, 115); fg.addColorStop(0, '#0a0a0b'); fg.addColorStop(1, '#020203');
  x.fillStyle = fg; face(); x.fill();
  // ojos
  const eh = 36 * (1 - blink * 0.92);
  for (const sx of [-1, 1]) {
    x.save(); x.shadowColor = eye; x.shadowBlur = 45; x.fillStyle = eye;
    x.beginPath(); x.ellipse(sx * 46 + look * 14, -6 + lookY * 10, 30, Math.max(3, eh), 0, 0, Math.PI * 2); x.fill();
    x.shadowBlur = 14; x.fill(); x.restore();
    if (blink < 0.5) { x.fillStyle = 'rgba(255,255,255,.45)'; x.beginPath(); x.ellipse(sx * 46 + look * 14 - 9, -18 + lookY * 10, 9, 11 * (1 - blink), 0, 0, Math.PI * 2); x.fill(); }
  }
  // brazo derecho (saluda)
  arm(1, -0.15 - wave * 0.95);
  // celular
  if (phone) {
    x.save(); x.translate(10, 120); x.rotate(-0.08);
    x.shadowColor = '#6fb0ff'; x.shadowBlur = 35; x.fillStyle = '#0d1a33'; x.beginPath(); x.roundRect(-30, -52, 60, 96, 10); x.fill(); x.shadowBlur = 0;
    x.strokeStyle = '#3d4250'; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#25d366'; x.beginPath(); x.roundRect(-20, -38, 34, 12, 6); x.fill();
    x.fillStyle = '#e8f0ff'; x.globalAlpha = .8; x.beginPath(); x.roundRect(-14, -18, 34, 12, 6); x.fill(); x.globalAlpha = 1;
    x.restore();
  }
  x.restore();
}
function grain(x, w, h, a = .06, seed = 5) { const d = x.getImageData(0, 0, w, h), p = d.data; let s = seed; for (let i = 0; i < p.length; i += 4) { s = (s * 16807) % 2147483647; const n = ((s / 2147483647) - .5) * 255 * a; p[i] += n; p[i + 1] += n; p[i + 2] += n; } x.putImageData(d, 0, 0); }
function bg(x, w, h) { x.fillStyle = '#0d0e11'; x.fillRect(0, 0, w, h); const r = x.createRadialGradient(w / 2, h * .45, 30, w / 2, h * .45, Math.max(w, h) * .7); r.addColorStop(0, '#1b1d22'); r.addColorStop(1, '#0b0c0f'); x.fillStyle = r; x.fillRect(0, 0, w, h); }
