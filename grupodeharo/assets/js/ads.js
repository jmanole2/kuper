// Anuncios del espectacular (canvas 2048×1024, proporción 2:1).
// Fotos de Unsplash (licencia libre) + tipografía de marca (Barlow Condensed).

const W = 2048;
const H = 1024;
const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
const PURPLE = '#531c5d';

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function cover(ctx, img, x, y, w, h, fx = 0.5, fy = 0.5) {
  if (!img) { ctx.fillStyle = '#9a9a96'; ctx.fillRect(x, y, w, h); return; }
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.width - sw) * fx, (img.height - sh) * fy, sw, sh, x, y, w, h);
}

function canvas() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  return c;
}

function logo(ctx, img, x, y, w) {
  if (img) ctx.drawImage(img, x, y, w, w * (img.height / img.width));
}

function tinted(img, color) {
  if (!img) return null;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

// 1 · Te voltearán a ver: Reforma a sangre
function adLook(a) {
  const c = canvas();
  const ctx = c.getContext('2d');
  cover(ctx, a.reforma, 0, 0, W, H, 0.5, 0.6);
  ctx.fillStyle = 'rgba(10,8,12,0.25)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.font = `600 236px ${DISPLAY}`;
  ctx.fillText('TE VOLTEARÁN A VER.', 104, H - 140);
  logo(ctx, a.logo, W - 104 - 420, 92, 420);
  return c;
}

// 2 · 750 espacios: campo claro + foto
function adNumbers(a) {
  const c = canvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efece6';
  ctx.fillRect(0, 0, W, H);
  cover(ctx, a.skyline, 1020, 0, W - 1020, H, 0.5, 0.5);
  ctx.fillStyle = PURPLE;
  ctx.font = `600 430px ${DISPLAY}`;
  ctx.fillText('750', 96, 520);
  ctx.font = `600 124px ${DISPLAY}`;
  ctx.fillText('ESPACIOS EN', 104, 690);
  ctx.fillText('SEIS CIUDADES', 104, 812);
  logo(ctx, tinted(a.logo, PURPLE), 108, 884, 330);
  return c;
}

// 3 · Este espacio es tuyo: foto + campo morado
function adYours(a) {
  const c = canvas();
  const ctx = c.getContext('2d');
  cover(ctx, a.gente, 0, 0, 1060, H, 0.5, 0.45);
  ctx.fillStyle = PURPLE;
  ctx.fillRect(1060, 0, W - 1060, H);
  ctx.fillStyle = '#fff';
  ctx.font = `600 190px ${DISPLAY}`;
  ctx.fillText('ESTE ESPACIO', 1140, 380);
  ctx.fillText('ES TUYO.', 1140, 560);
  ctx.font = `500 76px ${DISPLAY}`;
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.fillText('LLAMA AL 55 5241 6999', 1144, 700);
  logo(ctx, a.logo, 1144, H - 190, 400);
  return c;
}

// 4 · Marca (cuando la cámara llega al espectacular)
function adBrand(a) {
  const c = canvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = PURPLE;
  ctx.fillRect(0, 0, W, H);
  logo(ctx, a.logo, W / 2 - 620, H / 2 - 150, 1240);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `500 72px ${DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.fillText('LÍDERES EN PUBLICIDAD EXTERIOR', W / 2, H - 150);
  return c;
}

export async function createAds() {
  try { await document.fonts.load(`600 140px ${DISPLAY}`); } catch (e) { /* respaldo */ }
  const [lg, reforma, gente, skyline] = await Promise.all([
    loadImage('assets/img/logo-horizontal-white-header.png'),
    loadImage('assets/photos/cdmx-reforma.jpg'),
    loadImage('assets/photos/cdmx-gente.jpg'),
    loadImage('assets/photos/cdmx-skyline.jpg'),
  ]);
  const a = { logo: lg, reforma, gente, skyline };
  return {
    rotation: [adLook(a), adNumbers(a), adYours(a)],
    brand: adBrand(a),
  };
}
