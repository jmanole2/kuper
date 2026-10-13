// Renders index.html to out/desktop.png and out/mobile.png: node web-design/novaplastica-hero/render.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const dir = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
for (const [name, width, height, scale] of [['desktop', 1440, 900, 2], ['mobile', 390, 844, 3]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale, reducedMotion: 'reduce' });
  await page.goto('file://' + path.join(dir, 'index.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(dir, `out/${name}.png`), fullPage: true });
  await page.close();
}
await browser.close();
