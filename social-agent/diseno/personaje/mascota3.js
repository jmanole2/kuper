// Personaje de Kuper v3 (chibi): cabeza grande con pantalla, cuerpo chiquito, mechón/rizo arriba.
// Variantes: 'a' capucha gris + bufanda azul, 'b' azul Kuper plano, 'c' espíritu de tinta con capa.
function drawChibi(x, o = {}) {
  const { cx = 0, cy = 0, s = 1, v = 'a', expr = 'normal', wave = 0, look = 0, phone = false, bob = 0 } = o;
  const P = {
    a: { head: '#3b3e46', head2: '#25272d', visor: '#0c0d10', eye: '#8cff2a', scarf: '#2f6bff', body: '#33363d', ear: '#1b1c20', mouth: false },
    b: { head: '#2f6bff', head2: '#1f4fd6', visor: '#14172a', eye: '#ffffff', scarf: null, body: '#2f6bff', ear: '#14172a', mouth: true },
    c: { head: '#121318', head2: '#08090b', visor: null, eye: '#8cff2a', scarf: '#2f6bff', body: '#121318', ear: null, mouth: false },
  }[v];
  x.save(); x.translate(cx, cy + bob); x.scale(s, s);
  const fillShade = (path, c1, c2, lx = -60, ly = -300) => { const g = x.createRadialGradient(lx, ly, 10, lx + 60, ly + 160, 330); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; path(); x.fill(); };
  const rim = (path) => { if (v !== 'c') return; x.save(); x.strokeStyle = 'rgba(140,255,42,.35)'; x.lineWidth = 3; x.shadowColor = '#8cff2a'; x.shadowBlur = 12; path(); x.stroke(); x.restore(); };
  // sombra
  x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.ellipse(0, 34, 110, 16, 0, 0, 7); x.fill();
  // piernas
  for (const sx of [-1, 1]) { const leg = () => { x.beginPath(); x.roundRect(sx * 30 - 21, -6, 42, 38, [4, 4, 18, 18]); }; fillShade(leg, P.body, P.head2, sx * 30, -10); rim(leg); }
  // brazos
  const arm = (sx, ang) => { x.save(); x.translate(sx * 66, -62); x.rotate(sx * ang); const a = () => { x.beginPath(); x.roundRect(-17, -10, 34, 56, 17); }; fillShade(a, P.body, P.head2, 0, 0); rim(a); x.restore(); };
  arm(-1, 0.35);
  // cuerpo
  const body = () => { x.beginPath(); x.roundRect(-64, -100, 128, 104, [40, 40, 26, 26]); };
  fillShade(body, P.body, P.head2, -30, -100); rim(body);
  arm(1, 0.35 - wave * 2.3);
  // bufanda / capa
  if (P.scarf && v === 'a') {
    x.fillStyle = P.scarf; x.beginPath(); x.roundRect(-78, -112, 156, 30, 15); x.fill();
    x.beginPath(); x.moveTo(30, -90); x.quadraticCurveTo(56, -60, 44, -22); x.lineTo(70, -30); x.quadraticCurveTo(76, -70, 52, -96); x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.roundRect(-70, -108, 120, 8, 4); x.fill();
  }
  if (v === 'c') {
    const cape = () => { x.beginPath(); x.moveTo(-70, -108); x.quadraticCurveTo(0, -122, 70, -108); x.quadraticCurveTo(118, -70, 108, -12); x.quadraticCurveTo(84, -30, 70, -6);
      x.quadraticCurveTo(46, -34, 10, -10); x.quadraticCurveTo(-30, -36, -60, -8); x.quadraticCurveTo(-86, -34, -112, -14); x.quadraticCurveTo(-116, -72, -70, -108); x.closePath(); };
    fillShade(cape, '#4d86ff', '#1d46b8', -40, -110);
  }
  // cabeza
  let head;
  if (v === 'c') {
    head = () => { x.beginPath(); x.moveTo(-10, -350); x.bezierCurveTo(-70, -330, -140, -280, -140, -205); x.bezierCurveTo(-140, -130, -80, -98, 0, -98);
      x.bezierCurveTo(80, -98, 140, -130, 140, -205); x.bezierCurveTo(140, -270, 80, -315, 40, -330); x.bezierCurveTo(20, -360, 50, -392, 80, -390);
      x.bezierCurveTo(40, -410, -10, -395, -10, -350); x.closePath(); };
  } else {
    head = () => { x.beginPath(); x.roundRect(-152, -330, 304, 238, 92); };
  }
  // orejas
  if (P.ear) for (const sx of [-1, 1]) { x.fillStyle = P.ear; x.beginPath(); x.roundRect(sx * 160 - 14, -250, 28, 74, 12); x.fill(); }
  fillShade(head, P.head, P.head2); rim(head);
  // mechón (a, b)
  if (v !== 'c') {
    x.save(); x.fillStyle = P.head; x.strokeStyle = P.head; x.lineWidth = 16; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(-60, -318); x.lineTo(92, -372); x.lineTo(106, -392); x.lineTo(100, -352); x.lineTo(124, -318); x.closePath(); x.fill(); x.stroke(); x.restore();
    // brillo de la cabeza
    x.fillStyle = 'rgba(255,255,255,.10)'; x.beginPath(); x.ellipse(-80, -300, 50, 18, -.3, 0, 7); x.fill();
  } else {
    x.save(); x.fillStyle = P.head; x.shadowColor = '#8cff2a'; x.shadowBlur = 8; x.beginPath(); x.arc(-52, -398, 13, 0, 7); x.fill(); x.restore();
  }
  // pantalla / visor
  if (P.visor) {
    const vis = () => { x.beginPath(); x.roundRect(-122, -302, 244, 186, 66); };
    x.fillStyle = P.visor; vis(); x.fill();
    x.save(); vis(); x.clip(); x.fillStyle = 'rgba(255,255,255,.09)'; x.beginPath(); x.ellipse(-60, -290, 90, 30, -.15, 0, 7); x.fill(); x.restore();
  }
  // ojos
  const ex = (sx) => sx * 50 + look * 12, ey = -212;
  const glow = (fn) => { x.save(); if (P.eye !== '#ffffff') { x.shadowColor = P.eye; x.shadowBlur = 30; } fn(); x.restore(); };
  for (const sx of [-1, 1]) {
    x.fillStyle = P.eye; x.strokeStyle = P.eye;
    if (expr === 'feliz') { glow(() => { x.lineWidth = 13; x.lineCap = 'round'; x.beginPath(); x.arc(ex(sx), ey + 12, 22, Math.PI * 1.12, Math.PI * 1.88); x.stroke(); }); continue; }
    if (expr === 'estrellas') { glow(() => { x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 27, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(ex(sx) + Math.cos(a) * r, ey + Math.sin(a) * r); } x.closePath(); x.lineJoin = 'round'; x.lineWidth = 5; x.fill(); x.stroke(); }); continue; }
    if (expr === 'decidido') { glow(() => { x.beginPath(); x.moveTo(ex(sx) - 24, ey - (sx < 0 ? 16 : 4)); x.lineTo(ex(sx) + 24, ey - (sx < 0 ? 4 : 16)); x.lineTo(ex(sx) + 24, ey + 20); x.quadraticCurveTo(ex(sx), ey + 30, ex(sx) - 24, ey + 20); x.closePath(); x.fill(); }); continue; }
    const r = expr === 'sorprendido' ? 1.25 : 1;
    if (v === 'c') glow(() => { x.beginPath(); x.ellipse(ex(sx), ey, 30 * r, 36 * r, 0, 0, 7); x.fill(); });
    else glow(() => { x.beginPath(); x.roundRect(ex(sx) - 24 * r, ey - 28 * r, 48 * r, 56 * r, 14); x.fill(); });
  }
  if (P.mouth && expr !== 'decidido') { x.fillStyle = '#fff'; x.beginPath(); x.arc(look * 12, -170, 9, 0, Math.PI); x.fill(); }
  if (phone) {
    x.save(); x.translate(0, -48); x.shadowColor = '#25d366'; x.shadowBlur = 26; x.fillStyle = '#0c1514'; x.beginPath(); x.roundRect(-26, -40, 52, 80, 10); x.fill(); x.shadowBlur = 0;
    x.fillStyle = '#25d366'; x.beginPath(); x.roundRect(-17, -28, 28, 10, 5); x.fill(); x.fillStyle = '#e8f0ff'; x.beginPath(); x.roundRect(-11, -12, 28, 10, 5); x.fill(); x.restore();
  }
  x.restore();
}
