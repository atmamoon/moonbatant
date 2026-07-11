import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
mkdirSync('scratch_qa', { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--window-size=1600,1000', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', '--use-angle=metal'],
  defaultViewport: { width: 1600, height: 1000 },
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message.slice(0, 300)));
await page.goto('http://localhost:4321/flight/', { waitUntil: 'networkidle2', timeout: 40000 });
await new Promise((r) => setTimeout(r, 4000));
const report = { errors, stops: [] };
for (const [name, frac] of [['annapurna', 0], ['manaslu', 0.24], ['khumbu', 0.46], ['everest', 0.7], ['kangchenjunga-night', 1]]) {
  await page.evaluate((f) => { const m = document.body.scrollHeight - innerHeight; window.scrollTo(0, Math.round(m * f)); }, frac);
  await new Promise((r) => setTimeout(r, 3200)); // damped camera settle
  const state = await page.evaluate(() => ({
    live: !!document.querySelector('.terrain-canvas.is-live'),
    noTerrain: document.body.classList.contains('no-terrain'),
    labels: [...document.querySelectorAll('.peak-label')].filter((l) => l.style.opacity !== '0').map((l) => l.textContent),
    alt: document.getElementById('alt-value')?.textContent,
  }));
  await page.screenshot({ path: `scratch_qa/fl-${name}.png` });
  report.stops.push({ name, ...state });
}
const fps = await page.evaluate(async () => {
  window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 600));
  const max = document.body.scrollHeight - innerHeight; const t0 = performance.now(); let frames = 0;
  return await new Promise((res) => { const loop = () => { frames++; const u = (performance.now() - t0) / 4000; window.scrollTo(0, max * Math.min(1, u)); if (u < 1) requestAnimationFrame(loop); else res(Math.round(frames / 4)); }; requestAnimationFrame(loop); });
});
report.scrollFps = fps;
console.log(JSON.stringify(report, null, 1));
await browser.close();
