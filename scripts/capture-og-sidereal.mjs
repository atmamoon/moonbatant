// Social thumbnails for SIDEREAL: 1200×630 at 2x. Headless Chrome with
// SwiftShader so the WebGL stage renders. Writes scratch_qa/sidereal-og/*.jpg;
// copy og-hero.jpg → public/og-image.jpg and og-night.jpg → public/social/og-summit.jpg.
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://localhost:4321';
const OUT = 'scratch_qa/sidereal-og';
mkdirSync(OUT, { recursive: true });
const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--window-size=1200,630', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 1200, height: 630, deviceScaleFactor: 2 },
});
const shots = [
  ['og-hero', '/?og=1', 'hero'],
  ['og-night', '/?og=1', 'contact'],
  ['og-case', '/work/pm-agent-claude-code?og=1', null],
];
for (const [name, path, anchor] of shots) {
  const p = await b.newPage();
  await p.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3500));
  if (anchor && anchor !== 'hero') {
    await p.evaluate((id) => { const el = document.getElementById(id); if (el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 200); }, anchor);
    await new Promise((r) => setTimeout(r, 3000));
  }
  await p.evaluate(() => document.querySelector('astro-dev-toolbar')?.remove());   // dev-build chrome, not the design
  await p.screenshot({ path: `${OUT}/${name}-raw.png` });
  await sharp(`${OUT}/${name}-raw.png`).resize(1200, 630).jpeg({ quality: 86, mozjpeg: true }).toFile(`${OUT}/${name}.jpg`);
  await p.close();
}
console.log('captured');
await b.close();
