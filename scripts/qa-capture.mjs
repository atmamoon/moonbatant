// QA harness: drives installed Chrome through the journey, captures waypoints,
// reports console errors, video state, altimeter state, and scroll FPS.
import puppeteer from 'puppeteer-core';
const BASE = process.env.BASE || 'http://localhost:4321';
const OUT = process.env.OUT || 'scratch_qa';
import { mkdirSync } from 'fs';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--window-size=1600,1000', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1600, height: 1000 },
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));

const report = { errors, waypoints: [] };
const stops = [
  ['hero', 0], ['work', 0.23], ['about', 0.45], ['experience', 0.66], ['summit', 1.0],
];
for (const [name, frac] of stops) {
  await page.evaluate((f) => {
    const max = document.body.scrollHeight - innerHeight;
    window.scrollTo(0, Math.round(max * f));
  }, frac);
  await new Promise((r) => setTimeout(r, 2600)); // crossfade + video settle
  const state = await page.evaluate(() => ({
    y: Math.round(scrollY),
    alt: document.getElementById('alt-value')?.textContent,
    camp: document.getElementById('alt-camp')?.textContent,
    plates: [...document.querySelectorAll('.stage__plate')].map((p) => +getComputedStyle(p).opacity.slice(0, 4)),
    videosPlaying: [...document.querySelectorAll('#stage video')].filter((v) => !v.paused).length,
    weather: document.getElementById('hero-weather')?.textContent,
  }));
  await page.screenshot({ path: `${OUT}/wp-${name}.png` });
  report.waypoints.push({ name, ...state });
}

// scroll-performance sample: continuous scroll over 3s, count rAF frames
const fps = await page.evaluate(async () => {
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 400));
  const max = document.body.scrollHeight - innerHeight;
  const t0 = performance.now();
  let frames = 0;
  return await new Promise((res) => {
    const loop = () => {
      frames++;
      const u = (performance.now() - t0) / 3000;
      window.scrollTo(0, max * Math.min(1, u));
      if (u < 1) requestAnimationFrame(loop);
      else res(Math.round(frames / 3));
    };
    requestAnimationFrame(loop);
  });
});
report.scrollFps = fps;
console.log(JSON.stringify(report, null, 1));
await browser.close();
