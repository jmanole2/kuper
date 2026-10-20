// Personaje de Kuper v2: capucha con volumen y luz, cara tipo visor de vidrio,
// ojos de luz con expresiones, base de luz y tarjetas de vidrio alrededor.
const EXPR = ['normal', 'feliz', 'sorprendido', 'cansado', 'guino'];
function drawMascota(x, o = {}) {
  const { cx = 0, cy = 0, s = 1, eye = '#8cff2a', rim = '#6dde2f', look = 0, lookY = 0, blink = 0, expr = 'normal',
    wave = 0, phone = false, step = 0, squash = 0, base = 1 } = o;
  x.save(); x.translate(cx, cy); x.scale(s, s);
  // base de luz (anillo bajo los pies)
  if (base > 0) {
    x.save(); x.globalAlpha = base;
    const pg = x.createRadialGradient(0, 196, 10, 0, 196, 190); pg.addColorStop(0, eye + '55'); pg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = pg; x.beginPath(); x.ellipse(0, 196, 190, 44, 0, 0, 7); x.fill();
    x.strokeStyle = eye; x.lineWidth = 3; x.shadowColor = eye; x.shadowBlur = 24; x.globalAlpha = base * .8;
    x.beginPath(); x.ellipse(0, 196, 165, 34, 0, 0, 7); x.stroke(); x.restore();
  }
  x.scale(1 + squash * .06, 1 - squash * .06);
  const shade = (path, light, dark, lx = -60, ly = -110) => {
    const g = x.createRadialGradient(lx, ly, 10, lx + 40, ly + 120, 330); g.addColorStop(0, light); g.addColorStop(1, dark);
    x.fillStyle = g; path(); x.fill();
  };
  const rimLine = (path, w = 3) => {
    x.save(); const g = x.createLinearGradient(-150, -200, 150, 170);
    g.addColorStop(0, rim + '30'); g.addColorStop(.55, rim + 'aa'); g.addColorStop(1, rim);
    x.strokeStyle = g; x.lineWidth = w; x.shadowColor = rim; x.shadowBlur = 14; path(); x.stroke(); x.restore();
  };
  // patitas
  for (const sx of [-1, 1]) {
    const lift = Math.max(0, Math.sin(step * Math.PI * 2 + (sx > 0 ? Math.PI : 0))) * 14;
    const leg = () => { x.beginPath(); x.roundRect(sx * 52 - 25, 148 - lift, 50, 44, [6, 6, 16, 16]); };
    shade(leg, '#3a3d44', '#15161a', sx * 52 - 10, 150); rimLine(leg, 2.5);
  }
  const arm = (sx, ang) => {
    x.save(); x.translate(sx * 132, 42); x.rotate(ang * sx);
    const sl = () => { x.beginPath(); x.roundRect(sx > 0 ? -14 : -44, -25, 58, 50, 22); };
    shade(sl, '#4a4d55', '#1b1c20', sx * 10, -20); rimLine(sl, 2.5);
    x.fillStyle = '#040405'; x.beginPath(); x.ellipse(sx * 38, 0, 8, 19, 0, 0, 7); x.fill();
    x.restore();
  };
  arm(-1, -.12);
  // capucha
  const hood = () => {
    x.beginPath(); x.moveTo(-26, -188); x.quadraticCurveTo(0, -214, 26, -188);
    x.bezierCurveTo(70, -140, 154, -40, 154, 70); x.bezierCurveTo(154, 152, 90, 168, 0, 168);
    x.bezierCurveTo(-90, 168, -154, 152, -154, 70); x.bezierCurveTo(-154, -40, -70, -140, -26, -188); x.closePath();
  };
  shade(hood, '#5a5e67', '#18191d');
  // pliegue suave
  x.save(); hood(); x.clip(); x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 10;
  x.beginPath(); x.moveTo(-120, 130); x.quadraticCurveTo(0, 175, 120, 130); x.stroke();
  // brillo especular arriba a la izquierda
  const sp = x.createRadialGradient(-62, -95, 4, -62, -95, 70); sp.addColorStop(0, 'rgba(255,255,255,.22)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = sp; x.beginPath(); x.ellipse(-62, -95, 60, 80, -.5, 0, 7); x.fill(); x.restore();
  rimLine(hood, 3.5);
  // borde interior de la capucha (labio) y visor
  x.save(); x.shadowColor = 'rgba(0,0,0,.8)'; x.shadowBlur = 18; x.fillStyle = '#26282d';
  x.beginPath(); x.ellipse(0, 2, 108, 122, 0, 0, 7); x.fill(); x.restore();
  const vg = x.createRadialGradient(0, -30, 10, 0, 10, 120); vg.addColorStop(0, '#0e1012'); vg.addColorStop(1, '#010102');
  x.fillStyle = vg; x.beginPath(); x.ellipse(0, 4, 96, 110, 0, 0, 7); x.fill();
  // ojos
  const ex = (sx) => sx * 44 + look * 14, ey = -8 + lookY * 10;
  const glow = (fn) => { x.save(); x.shadowColor = eye; x.shadowBlur = 40; fn(); x.shadowBlur = 12; fn(); x.restore(); };
  for (const sx of [-1, 1]) {
    const kind = expr === 'guino' && sx < 0 ? 'feliz' : expr;
    if (kind === 'feliz') {
      glow(() => { x.strokeStyle = eye; x.lineWidth = 15; x.lineCap = 'round'; x.beginPath(); x.arc(ex(sx), ey + 12, 24, Math.PI * 1.12, Math.PI * 1.88); x.stroke(); });
      continue;
    }
    let rw = 29, rh = 35 * (1 - blink * .92);
    if (kind === 'sorprendido') { rw = 34; rh = 42 * (1 - blink * .92); }
    if (kind === 'cansado') {
      glow(() => { x.fillStyle = eye; x.beginPath(); x.moveTo(ex(sx) - rw, ey); x.quadraticCurveTo(ex(sx), ey - 6, ex(sx) + rw, ey);
        x.ellipse(ex(sx), ey, rw, rh * .8, 0, 0, Math.PI); x.closePath(); x.fill(); });
      continue;
    }
    glow(() => {
      const g = x.createRadialGradient(ex(sx) - 6, ey - 10, 2, ex(sx), ey, rh + 4);
      g.addColorStop(0, '#e9ffc9'); g.addColorStop(.35, eye); g.addColorStop(1, eye);
      x.fillStyle = g; x.beginPath(); x.ellipse(ex(sx), ey, rw, Math.max(3, rh), 0, 0, 7); x.fill();
    });
  }
  // reflejo del visor (vidrio)
  x.save(); x.beginPath(); x.ellipse(0, 4, 96, 110, 0, 0, 7); x.clip();
  x.strokeStyle = 'rgba(255,255,255,.13)'; x.lineWidth = 9; x.lineCap = 'round';
  x.beginPath(); x.arc(0, 30, 112, Math.PI * 1.18, Math.PI * 1.42); x.stroke();
  x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.ellipse(52, -70, 10, 6, -.6, 0, 7); x.fill(); x.restore();
  arm(1, -.12 - wave * .95);
  if (phone) {
    x.save(); x.translate(8, 122); x.rotate(-.08);
    x.shadowColor = '#25d366'; x.shadowBlur = 30; x.fillStyle = '#0c1514'; x.beginPath(); x.roundRect(-30, -52, 60, 96, 11); x.fill(); x.shadowBlur = 0;
    x.strokeStyle = '#3d4250'; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#25d366'; x.beginPath(); x.roundRect(-20, -38, 34, 12, 6); x.fill();
    x.fillStyle = '#e8f0ff'; x.globalAlpha = .8; x.beginPath(); x.roundRect(-14, -18, 34, 12, 6); x.fill(); x.restore();
  }
  x.restore();
}
// Tarjeta de vidrio con icono (como las de Meta, en oscuro).
function glassCard(x, { cx, cy, w = 250, h = 170, label = '', icon = 'chat', color = '#25d366', a = 1, sc = 1 }) {
  x.save(); x.globalAlpha = a; x.translate(cx, cy); x.scale(sc, sc);
  x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 30; x.shadowOffsetY = 10;
  const g = x.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,.04)');
  x.fillStyle = g; x.beginPath(); x.roundRect(-w / 2, -h / 2, w, h, 26); x.fill(); x.shadowColor = 'transparent';
  x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 2; x.stroke();
  x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(-w / 2 + 26, -h / 2 + 1); x.lineTo(w / 2 - 26, -h / 2 + 1); x.stroke();
  // icono
  const ig = x.createLinearGradient(-30, -h / 2 + 20, 30, -h / 2 + 80); ig.addColorStop(0, color); ig.addColorStop(1, shadeHex(color, -40));
  x.fillStyle = ig; x.beginPath(); x.roundRect(-32, -h / 2 + 18, 64, 64, 16); x.fill();
  x.save(); x.translate(0, -h / 2 + 50); drawIcon(x, icon); x.restore();
  x.fillStyle = '#f2f5fa'; x.font = '600 28px system-ui'; x.textAlign = 'center';
  const lines = label.split('\n'); lines.forEach((l, i) => x.fillText(l, 0, -h / 2 + 118 + i * 32));
  x.restore();
}
function shadeHex(h, d) { const n = parseInt(h.slice(1), 16); const c = (v) => Math.max(0, Math.min(255, v + d)); return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`; }
function drawIcon(x, k) {
  x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 4; x.lineCap = 'round'; x.lineJoin = 'round';
  if (k === 'chat') { x.beginPath(); x.roundRect(-18, -14, 36, 24, 8); x.stroke(); x.beginPath(); x.moveTo(-8, 10); x.lineTo(-12, 18); x.lineTo(0, 10); x.stroke(); }
  if (k === 'cal') { x.beginPath(); x.roundRect(-17, -14, 34, 30, 5); x.stroke(); x.beginPath(); x.moveTo(-17, -4); x.lineTo(17, -4); x.moveTo(-8, -20); x.lineTo(-8, -10); x.moveTo(8, -20); x.lineTo(8, -10); x.stroke(); }
  if (k === 'money') { x.font = '700 34px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('$', 0, 2); x.textBaseline = 'alphabetic'; }
  if (k === 'bell') { x.beginPath(); x.moveTo(-14, 10); x.quadraticCurveTo(-14, -16, 0, -16); x.quadraticCurveTo(14, -16, 14, 10); x.closePath(); x.stroke(); x.beginPath(); x.arc(0, 15, 4, 0, 7); x.fill(); }
  if (k === 'clock') { x.beginPath(); x.arc(0, 0, 17, 0, 7); x.stroke(); x.beginPath(); x.moveTo(0, -9); x.lineTo(0, 0); x.lineTo(8, 5); x.stroke(); }
  if (k === 'star') { x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 8 : 18, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); }
}
function grain(x, w, h, a = .05, seed = 5) { const d = x.getImageData(0, 0, w, h), p = d.data; let s = seed; for (let i = 0; i < p.length; i += 4) { s = (s * 16807) % 2147483647; const n = ((s / 2147483647) - .5) * 255 * a; p[i] += n; p[i + 1] += n; p[i + 2] += n; } x.putImageData(d, 0, 0); }
function bg(x, w, h, eye = '#8cff2a') {
  x.fillStyle = '#08090c'; x.fillRect(0, 0, w, h);
  const r = x.createRadialGradient(w / 2, h * .52, 30, w / 2, h * .52, Math.max(w, h) * .6); r.addColorStop(0, '#1a1d23'); r.addColorStop(1, '#07080a');
  x.fillStyle = r; x.fillRect(0, 0, w, h);
  // bokeh suave (profundidad)
  [[.12, .2, 90, '#2b3550'], [.85, .15, 120, '#1f2a40'], [.9, .7, 80, '#203024'], [.08, .78, 110, '#262b38']].forEach(([px, py, rr, c]) => {
    const b = x.createRadialGradient(px * w, py * h, 0, px * w, py * h, rr); b.addColorStop(0, c + 'aa'); b.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = b; x.fillRect(0, 0, w, h);
  });
}
const CARDS = [
  { label: 'Contesta\nWhatsApp', icon: 'chat', color: '#25d366' },
  { label: 'Agenda\ncitas', icon: 'cal', color: '#3b82f6' },
  { label: 'Cotiza al\nmomento', icon: 'money', color: '#f59e0b' },
  { label: 'Da\nseguimiento', icon: 'bell', color: '#a855f7' },
  { label: 'Atiende\n24/7', icon: 'clock', color: '#06b6d4' },
  { label: 'Pide\nreseñas', icon: 'star', color: '#ec4899' },
];
