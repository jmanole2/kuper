// Renders index.html to desktop/mobile PNGs: node web-design/your-hair/render.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, 'index.html');
const browser = await chromium.launch();
for (const [name, width, height, scale] of [['desktop', 1440, 900, 1.25], ['mobile', 390, 844, 2]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(dir, `out/${name}.png`), fullPage: true });
  await page.close();
}
await browser.close();
