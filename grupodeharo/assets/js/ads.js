// Portadas del espectacular (canvas 2048×1024, proporción 2:1).
// Fotos de Unsplash (licencia libre) + tipografía de marca.

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

// Texto que se ajusta al ancho disponible (para la marca que escribe el visitante)
function fitText(ctx, text, maxW, maxSize, weight = 600) {
  let size = maxSize;
  do {
    ctx.font = `${weight} ${size}px ${DISPLAY}`;
    if (ctx.measureText(text).width <= maxW) break;
    size -= 6;
  } while (size > 60);
  return size;
}

let assets = null;
async function load() {
  if (assets) return assets;
  try { await document.fonts.load(`600 140px ${DISPLAY}`); } catch (e) { /* respaldo */ }
  const [lg, reforma, gente, skyline] = await Promise.all([
    loadImage('assets/img/logo-horizontal-white-header.png'),
    loadImage('assets/photos/cdmx-reforma.jpg'),
    loadImage('assets/photos/cdmx-gente.jpg'),
    loadImage('assets/photos/cdmx-skyline.jpg'),
  ]);
  assets = { lg, reforma, gente, skyline };
  return assets;
}

// A · La marca del visitante: foto de Reforma + campo morado con su nombre
export function coverBrand(name) {
  const { lg, gente } = assets;
  const c = canvas();
  const ctx = c.getContext('2d');
  cover(ctx, gente, 0, 0, 1060, H, 0.5, 0.45);
  ctx.fillStyle = PURPLE;
  ctx.fillRect(1060, 0, W - 1060, H);
  const text = (name || 'Tu marca').trim().toUpperCase() || 'TU MARCA';
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  const size = fitText(ctx, text, W - 1060 - 180, 260);
  ctx.fillText(text, 1150, 470 + size * 0.35);
  ctx.font = `500 64px ${DISPLAY}`;
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillText('AQUÍ, EN PASEO DE LA REFORMA', 1150, 640);
  logo(ctx, lg, 1150, H - 190, 400);
  return c;
}

// B · Te voltearán a ver
function coverLook() {
  const { lg, reforma } = assets;
  const c = canvas();
  const ctx = c.getContext('2d');
  cover(ctx, reforma, 0, 0, W, H, 0.5, 0.6);
  ctx.fillStyle = 'rgba(10,8,12,0.28)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.font = `600 230px ${DISPLAY}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('TE VOLTEARÁN A VER.', 110, H - 150);
  logo(ctx, lg, W - 110 - 400, 90, 400);
  return c;
}

// C · 750 espacios
function coverNumbers() {
  const { lg, skyline } = assets;
  const c = canvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ececea';
  ctx.fillRect(0, 0, W, H);
  cover(ctx, skyline, 1000, 0, W - 1000, H, 0.5, 0.5);
  ctx.fillStyle = PURPLE;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 420px ${DISPLAY}`;
  ctx.fillText('750', 100, 520);
  ctx.font = `600 120px ${DISPLAY}`;
  ctx.fillText('ESPACIOS EN', 110, 690);
  ctx.fillText('SEIS CIUDADES', 110, 810);
  const dark = document.createElement('canvas');
  if (lg) {
    dark.width = lg.width; dark.height = lg.height;
    const d = dark.getContext('2d');
    d.drawImage(lg, 0, 0);
    d.globalCompositeOperation = 'source-in';
    d.fillStyle = PURPLE;
    d.fillRect(0, 0, dark.width, dark.height);
    logo(ctx, dark, 112, 880, 330);
  }
  return c;
}

export async function createCovers(brandName) {
  await load();
  return [coverBrand(brandName), coverLook(), coverNumbers()];
}
