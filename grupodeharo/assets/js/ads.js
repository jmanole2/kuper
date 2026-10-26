// Anuncios del espectacular, dibujados en canvas (2048×1024, proporción 2:1).
// Cada función regresa un canvas listo para usarse como textura.

const W = 2048;
const H = 1024;
const SERIF = '"Instrument Serif", "Times New Roman", serif';
const SANS = '"Inter Tight", "Helvetica Neue", Arial, sans-serif';

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return c;
}

function grain(ctx, amount = 14) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function spaced(ctx, text, x, y, spacing, align = 'center') {
  // letter-spacing manual (canvas no lo soporta en todos los navegadores)
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += widths[i] + spacing; });
  ctx.textAlign = prev;
}

// 1 · "Te voltearán a ver." Halo naranja (referencia del cliente)
function adGlow(logo) {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, W, 0);
  bg.addColorStop(0, '#2a0703');
  bg.addColorStop(0.5, '#c2310e');
  bg.addColorStop(1, '#2a0703');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 620);
  core.addColorStop(0, '#ff7a2e');
  core.addColorStop(0.55, '#e3461a');
  core.addColorStop(1, 'rgba(120,20,5,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, W, H);

  // anillo
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, 455 + i * 5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,170,90,${0.22 - i * 0.03})`;
    ctx.lineWidth = 26 - i * 3;
    ctx.filter = `blur(${8 + i * 6}px)`;
    ctx.stroke();
  }
  ctx.restore();
  ctx.filter = 'none';

  ctx.fillStyle = '#fff6ee';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `400 210px ${SERIF}`;
  ctx.fillText('Te voltearán a ver.', cx, cy - 20);
  ctx.font = `500 34px ${SANS}`;
  ctx.fillStyle = 'rgba(255,240,228,0.85)';
  spaced(ctx, 'PUBLICIDAD EXTERIOR · CASI 50 AÑOS EN LA CALLE', cx, cy + 140, 8);
  if (logo) drawLogo(ctx, logo, W - 120 - 360, H - 140, 360);
  grain(ctx, 10);
  return c;
}

// 2 · "750+ espacios". Morado de marca con retícula de puntos
function adNumbers(logo) {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2b0d31';
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.72, H * 0.4, 0, W * 0.72, H * 0.4, 1100);
  g.addColorStop(0, '#8a2f8c');
  g.addColorStop(0.6, '#531c5d');
  g.addColorStop(1, '#1d0822');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // puntos (inventario)
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 50; x++) {
      const px = 1060 + x * 18, py = 160 + y * 48;
      if (px > W - 80) continue;
      const lit = Math.random() < 0.55;
      ctx.fillStyle = lit ? 'rgba(255,120,220,0.95)' : 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(px, py, lit ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `400 400px ${SERIF}`;
  ctx.fillText('750+', 110, 560);
  ctx.font = `400 92px ${SERIF}`;
  ctx.fillText('espacios en seis ciudades.', 120, 700);
  ctx.font = `500 32px ${SANS}`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  spaced(ctx, 'CDMX · EDOMEX · MONTERREY · GUADALAJARA · PUEBLA · AGUASCALIENTES', 124, 800, 5, 'left');
  if (logo) drawLogo(ctx, logo, 124, 880, 330);
  grain(ctx, 9);
  return c;
}

// 3 · "Este espacio es tuyo". Negro y dorado (referencia hoarding)
function adGold(logo) {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b0907';
  ctx.fillRect(0, 0, W, H);

  // persianas verticales con luz cálida (como la referencia)
  for (let i = 0; i < 64; i++) {
    const x = i * 32;
    const v = 0.35 + 0.65 * Math.pow(Math.sin(i * 0.37) * 0.5 + 0.5, 3);
    const lg = ctx.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, `rgba(255,214,170,${0.55 * v})`);
    lg.addColorStop(0.35, `rgba(150,110,80,${0.18 * v})`);
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(x, 0, 18, H);
  }
  const veil = ctx.createLinearGradient(0, 0, W, 0);
  veil.addColorStop(0, 'rgba(11,9,7,0.2)');
  veil.addColorStop(0.55, 'rgba(11,9,7,0.85)');
  veil.addColorStop(1, 'rgba(11,9,7,0.95)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, W, H);

  // píldora
  const px = 1050, py = 250, pw = 880, ph = 520, r = ph / 2;
  ctx.beginPath();
  ctx.moveTo(px + r, py);
  ctx.arcTo(px + pw, py, px + pw, py + ph, r);
  ctx.arcTo(px + pw, py + ph, px, py + ph, r);
  ctx.arcTo(px, py + ph, px, py, r);
  ctx.arcTo(px, py, px + pw, py, r);
  ctx.closePath();
  ctx.fillStyle = '#120f0c';
  ctx.fill();
  ctx.strokeStyle = '#c9a27a';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#e6c49c';
  ctx.font = `600 64px ${SANS}`;
  spaced(ctx, 'ESTE ESPACIO', px + pw / 2, py + 220, 14);
  spaced(ctx, 'ES TUYO', px + pw / 2, py + 300, 14);
  ctx.font = `500 30px ${SANS}`;
  ctx.fillStyle = 'rgba(230,196,156,0.85)';
  spaced(ctx, 'LLAMA AL 55 5241 6999', px + pw / 2, py + 400, 7);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#e6c49c';
  ctx.font = `400 120px ${SERIF}`;
  ctx.fillText('Donde México', 120, 470);
  ctx.fillText('mira.', 120, 590);
  if (logo) drawLogo(ctx, logo, 124, 720, 360, 'rgba(230,196,156,1)');
  grain(ctx, 8);
  return c;
}

// 4 · DOOH programático
function adDigital(logo) {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#05060f');
  bg.addColorStop(1, '#14082a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // gráfica en vivo
  const base = 820;
  for (let i = 0; i < 46; i++) {
    const x = 1040 + i * 20;
    const h = 120 + Math.abs(Math.sin(i * 0.45) * 300) + Math.random() * 120;
    const lg = ctx.createLinearGradient(0, base - h, 0, base);
    lg.addColorStop(0, '#ff3fb4');
    lg.addColorStop(1, 'rgba(83,28,93,0.2)');
    ctx.fillStyle = lg;
    ctx.fillRect(x, base - h, 11, h);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(1040, base - i * 130);
    ctx.lineTo(W - 90, base - i * 130);
    ctx.stroke();
  }
  ctx.fillStyle = '#ff3fb4';
  ctx.beginPath();
  ctx.arc(1060, 170, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `600 30px ${SANS}`;
  ctx.textAlign = 'left';
  spaced(ctx, 'EN VIVO', 1090, 181, 6, 'left');

  ctx.fillStyle = '#fff';
  ctx.font = `400 150px ${SERIF}`;
  ctx.fillText('Compra pantallas', 110, 430);
  ctx.fillText('como compras clics.', 110, 570);
  ctx.font = `500 34px ${SANS}`;
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  spaced(ctx, 'DOOH PROGRAMÁTICO · MEDICIÓN EN TIEMPO REAL', 116, 680, 6, 'left');
  if (logo) drawLogo(ctx, logo, 116, 800, 330);
  grain(ctx, 8);
  return c;
}

// 5 · Marca. Usado al final del scroll (el espectacular "a solas")
function adBrand(logo) {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2a0c33';
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, 1150);
  g.addColorStop(0, '#8a3194');
  g.addColorStop(0.5, '#5a1f66');
  g.addColorStop(1, '#2a0c33');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (logo) drawLogo(ctx, logo, W / 2 - 600, H / 2 - 115, 1200);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `500 30px ${SANS}`;
  ctx.textAlign = 'center';
  spaced(ctx, 'LÍDERES EN PUBLICIDAD OOH', W / 2, H - 150, 10);
  grain(ctx, 8);
  return c;
}

function drawLogo(ctx, logo, x, y, width, tint) {
  const h = width * (logo.height / logo.width);
  if (!tint) {
    ctx.drawImage(logo, x, y, width, h);
    return;
  }
  const off = document.createElement('canvas');
  off.width = logo.width;
  off.height = logo.height;
  const o = off.getContext('2d');
  o.drawImage(logo, 0, 0);
  o.globalCompositeOperation = 'source-in';
  o.fillStyle = tint;
  o.fillRect(0, 0, off.width, off.height);
  ctx.drawImage(off, x, y, width, h);
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function createAds(logoSrc) {
  try {
    await Promise.all([
      document.fonts.load(`400 100px ${SERIF}`),
      document.fonts.load(`500 40px ${SANS}`),
      document.fonts.load(`600 40px ${SANS}`),
    ]);
  } catch (e) { /* se dibuja con la fuente de respaldo */ }
  const logo = await loadImage(logoSrc);
  return {
    rotation: [adGlow(logo), adNumbers(logo), adGold(logo), adDigital(logo)],
    brand: adBrand(logo),
  };
}
