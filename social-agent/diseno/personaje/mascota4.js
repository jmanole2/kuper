// Personaje de Kuper v4 (elegido): cabeza con capucha que barre hacia atrás, pantalla negra,
// ojos verdes cuadrados redondeados, cuerpo en arco con muesca y bracitos sueltos.
function drawKuper(x, o = {}) {
  const { cx = 0, cy = 0, s = 1, expr = 'normal', blink = 0, look = 0, lookY = 0, wave = 0, phone = false, squash = 0, hop = 0 } = o;
  const C = { head: '#585c66', head2: '#2c2e34', rim: '#5d6069', visor: '#0b0c0f', eye: '#8cff2a', ear: '#202227' };
  x.save(); x.translate(cx, cy);
  // sombra (se achica al saltar)
  const sh = 1 - Math.min(1, hop / 120) * .4;
  x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.ellipse(0, 6, 120 * sh * s, 16 * sh * s, 0, 0, 7); x.fill();
  x.translate(0, -hop); x.scale(s * (1 + squash * .07), s * (1 - squash * .07));
  const shade = (path, lx = -70, ly = -330) => { const g = x.createRadialGradient(lx, ly, 10, lx + 80, ly + 180, 360); g.addColorStop(0, C.head); g.addColorStop(1, C.head2); x.fillStyle = g; path(); x.fill(); };
  // cuerpo en arco con muesca
  const body = () => { x.beginPath(); x.moveTo(-62, 0); x.lineTo(-62, -62); x.bezierCurveTo(-62, -104, 62, -104, 62, -62); x.lineTo(62, 0); x.lineTo(20, 0);
    x.lineTo(20, -16); x.arc(0, -16, 20, 0, Math.PI, true); x.lineTo(-20, 0); x.closePath(); };
  x.save(); x.lineJoin = 'round'; x.lineWidth = 14; x.strokeStyle = C.head2; shade(body, -30, -100); body(); x.stroke(); shade(body, -30, -100); x.restore();
  // bracitos sueltos
  const arm = (sx, up) => { x.save(); x.translate(sx * (96 + up * 110), -52 - up * 150); x.rotate(sx * up * 0.5);
    const a = () => { x.beginPath(); x.roundRect(-14, -28, 28, 56, 14); }; shade(a, 0, -30); x.restore(); };
  arm(-1, 0); if (wave < .15) arm(1, wave);
  // capucha que barre hacia atrás (detrás de la cabeza)
  const hood = () => { x.beginPath(); x.moveTo(-150, -230); x.bezierCurveTo(-150, -330, -40, -372, 60, -376); x.bezierCurveTo(120, -378, 160, -392, 176, -410);
    x.bezierCurveTo(178, -372, 166, -340, 150, -318); x.bezierCurveTo(158, -300, 156, -270, 150, -240); x.closePath(); };
  shade(hood, -90, -380);
  // orejas
  for (const sx of [-1, 1]) { x.fillStyle = C.ear; x.beginPath(); x.roundRect(sx * 168 - 14, -262, 28, 76, 12); x.fill(); }
  // cabeza
  const head = () => { x.beginPath(); x.roundRect(-158, -340, 316, 236, 96); };
  shade(head); x.save(); x.strokeStyle = C.rim; x.globalAlpha = .5; x.lineWidth = 3; head(); x.stroke(); x.restore();
  // brillo de la capucha
  x.save(); hood(); x.clip(); x.fillStyle = 'rgba(255,255,255,.13)'; x.beginPath(); x.ellipse(-40, -352, 90, 12, -.18, 0, 7); x.fill(); x.restore();
  // pantalla
  const vis = () => { x.beginPath(); x.roundRect(-128, -308, 256, 178, 64); };
  x.fillStyle = C.visor; vis(); x.fill();
  x.save(); vis(); x.clip(); x.fillStyle = 'rgba(255,255,255,.06)'; x.beginPath(); x.ellipse(-50, -300, 120, 34, -.08, 0, 7); x.fill(); x.restore();
  // ojos
  const ex = (sx) => sx * 54 + look * 16, ey = -219 + lookY * 10;
  const glow = (fn) => { x.save(); x.shadowColor = C.eye; x.shadowBlur = 34; x.fillStyle = C.eye; x.strokeStyle = C.eye; fn(); x.shadowBlur = 10; fn(); x.restore(); };
  for (const sx of [-1, 1]) {
    const k = expr === 'guino' && sx < 0 ? 'feliz' : expr;
    if (k === 'feliz') { glow(() => { x.lineWidth = 14; x.lineCap = 'round'; x.beginPath(); x.arc(ex(sx), ey + 14, 24, Math.PI * 1.12, Math.PI * 1.88); x.stroke(); }); continue; }
    if (k === 'estrellas') { glow(() => { x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 29, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(ex(sx) + Math.cos(a) * r, ey + Math.sin(a) * r); } x.closePath(); x.lineJoin = 'round'; x.lineWidth = 5; x.fill(); x.stroke(); }); continue; }
    if (k === 'decidido') { glow(() => { x.beginPath(); x.moveTo(ex(sx) - 26, ey - (sx < 0 ? 18 : 4)); x.lineTo(ex(sx) + 26, ey - (sx < 0 ? 4 : 18)); x.lineTo(ex(sx) + 26, ey + 22); x.quadraticCurveTo(ex(sx), ey + 32, ex(sx) - 26, ey + 22); x.closePath(); x.fill(); }); continue; }
    if (k === 'cansado') { glow(() => { x.beginPath(); x.roundRect(ex(sx) - 26, ey, 52, 26, [4, 4, 14, 14]); x.fill(); }); continue; }
    const r = k === 'sorprendido' ? 1.2 : 1, h = 60 * r * (1 - blink * .9);
    glow(() => { x.beginPath(); x.roundRect(ex(sx) - 26 * r, ey - h / 2, 52 * r, Math.max(5, h), Math.min(14, h / 2)); x.fill(); });
  }
  if (wave >= .15) arm(1, wave);
  if (phone) {
    x.save(); x.translate(0, -42); x.shadowColor = '#25d366'; x.shadowBlur = 26; x.fillStyle = '#0c1514'; x.beginPath(); x.roundRect(-26, -40, 52, 80, 10); x.fill(); x.shadowBlur = 0;
    x.fillStyle = '#25d366'; x.beginPath(); x.roundRect(-17, -28, 28, 10, 5); x.fill(); x.fillStyle = '#e8f0ff'; x.beginPath(); x.roundRect(-11, -12, 28, 10, 5); x.fill(); x.restore();
  }
  x.restore();
}
