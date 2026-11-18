// Genera los QR en alta resolución (PNG 3000 px + SVG vectorial) para cada origen.
// Uso:
//   cd kvibe/tools/qr && npm install
//   node qr.mjs https://kvibeplus.mx pantalla redes impreso
// Salida: tools/qr/out/kvibe-qr-<origen>.png / .svg
import QRCode from 'qrcode';
import { mkdirSync } from 'node:fs';

const [base, ...sources] = process.argv.slice(2);
if (!base || !sources.length) {
  console.error('Uso: node qr.mjs <url-base> <origen> [origen...]');
  process.exit(1);
}
mkdirSync(new URL('./out/', import.meta.url), { recursive: true });

for (const src of sources) {
  const url = `${base.replace(/\/$/, '')}/?src=${encodeURIComponent(src)}`;
  const opts = { errorCorrectionLevel: 'Q', margin: 4, color: { dark: '#000000', light: '#ffffff' } };
  const png = new URL(`./out/kvibe-qr-${src}.png`, import.meta.url).pathname;
  const svg = new URL(`./out/kvibe-qr-${src}.svg`, import.meta.url).pathname;
  await QRCode.toFile(png, url, { ...opts, width: 3000 });
  await QRCode.toFile(svg, url, { ...opts, type: 'svg' });
  console.log(`${src.padEnd(10)} → ${url}`);
}
