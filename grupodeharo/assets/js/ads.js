// Anuncios del espectacular (canvas 2048×1024, proporción 2:1).
// Foto real + tipografía de marca (Barlow Condensed / DM Sans).

const W = 2048;
const H = 1024;
const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
const SANS = '"DM Sans", "Helvetica Neue", Arial, sans-serif';
const PURPLE = '#531c5d';

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function cover(ctx, img, x, y, w, h, fx = 0.5, fy = 0.5) {
  if (!img) { ctx.fillStyle = '#ccc'; ctx.fillRect(x, y, w, h); return; }
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.width - sw) * fx, (img.height - sh) * fy, sw, sh, x, y, w, h);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function logoTinted(logo, color) {
  if (!logo) return null;
  const c = document.createElement('canvas');
  c.width = logo.width; c.height = logo.height;
  const x = c.getContext('2d');
  x.drawImage(logo, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

function drawLogo(ctx, logo, x, y, w) {
  if (!logo) return;
  ctx.drawImage(logo, x, y, w, w * (logo.height / logo.width));
}

function lines(ctx, text, x, y, size, lh) {
  text.split('\n').forEach((l, i) => ctx.fillText(l, x, y + i * size * lh));
}

function canvas() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  return c;
}

// 1 · Foto + panel morado redondeado (estilo referencia "viero")
function adPanel(photo, logo, title) {
  const c = canvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efece6';
  ctx.fillRect(0, 0, W, H);
  const m = 56;
  ctx.save();
  roundRect(ctx, m, m, 1130, H - m * 2, 44);
  ctx.clip();
  cover(ctx, photo, m, m, 1130, H - m * 2, 0.5, 0.42);
  ctx.restore();
  roundRect(ctx, 1130 + m * 2, m, W - 1130 - m * 3, H - m * 2, 44);
  ctx.fillStyle = PURPLE;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `500 128px ${DISPLAY}`;
  ctx.textBaseline = 'top';
  lines(ctx, title, 1130 + m * 2 + 70, m + 80, 128, 0.96);
  drawLogo(ctx, logo, 1130 + m * 2 + 70, H - m - 150, 420);
  return c;
}

// 2 · Foto blanco y negro + panel claro
function adLight(photo, logo, title) {
  const c = canvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f1ec';
  ctx.fillRect(0, 0, W, H);
  cover(ctx, photo, 980, 0, W - 980, H, 0.5, 0.35);
  const g = ctx.createLinearGradient(980, 0, 1180, 0);
  g.addColorStop(0, '#f4f1ec');
  g.addColorStop(1, 'rgba(244,241,236,0)');
  ctx.fillStyle = g;
  ctx.fillRect(980, 0, 200, H);
  ctx.fillStyle = PURPLE;
  ctx.textBaseline = 'top';
  ctx.font = `500 150px ${DISPLAY}`;
  lines(ctx, title, 110, 150, 150, 0.95);
  drawLogo(ctx, logoTinted(logo, PURPLE), 116, H - 230, 440);
  return c;
}

// 3 · Foto a sangre con texto blanco
function adFull(photo, logo, title) {
  const c = canvas();
  const ctx = c.getContext('2d');
  cover(ctx, photo, 0, 0, W, H, 0.5, 0.55);
  const g = ctx.createLinearGradient(0, H, 0, H * 0.35);
  g.addColorStop(0, 'rgba(20,6,24,0.75)');
  g.addColorStop(1, 'rgba(20,6,24,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `500 168px ${DISPLAY}`;
  ctx.fillText(title, 96, H - 110);
  drawLogo(ctx, logo, W - 96 - 420, H - 180, 420);
  return c;
}

export async function createAds() {
  try {
    await Promise.all([
      document.fonts.load(`500 120px ${DISPLAY}`),
      document.fonts.load(`400 40px ${SANS}`),
    ]);
  } catch (e) { /* fuente de respaldo */ }
  const [logo, p1, p2, p3] = await Promise.all([
    loadImage('assets/img/logo-horizontal-white-header.png'),
    loadImage('assets/photos/ad-reforma.jpg'),
    loadImage('assets/photos/ad-rostro.jpg'),
    loadImage('assets/photos/cdmx-gente.jpg'),
  ]);
  return [
    adPanel(p1, logo, 'TE\nVOLTEARÁN\nA VER.'),
    adLight(p2, logo, 'DONDE\nMÉXICO\nMIRA.'),
    adFull(p3, logo, '750+ ESPACIOS. 6 CIUDADES.'),
  ];
}
