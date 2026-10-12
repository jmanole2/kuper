// Renders index.html to desktop/mobile PNGs: node web-design/ama-nu/render.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, 'index.html');
const browser = await chromium.launch();
for (const [name, width, height, scale] of [['desktop', 1440, 900, 1.5], ['mobile', 390, 844, 2]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.goto(url);
  // Freeze the fixed test bar: first fold on desktop, page bottom on mobile.
  await page.evaluate(async ([h, atEnd]) => {
    await document.fonts.ready;
    const s = document.querySelector('.sticky');
    const top = atEnd ? document.body.scrollHeight : h;
    s.style.position = 'absolute';
    s.style.top = (top - s.offsetHeight - 22) + 'px';
    s.style.bottom = 'auto';
  }, [height, name === 'mobile']);
  await page.screenshot({ path: path.join(dir, `out/${name}.png`), fullPage: true });
  await page.close();
}
await browser.close();
