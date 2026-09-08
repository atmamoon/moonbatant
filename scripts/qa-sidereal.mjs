// QA harness for SIDEREAL: real Chrome (WebGL via SwiftShader), captures every
// chapter of the home page + the reading pages, desktop and mobile, and
// reports console errors, the solar clock state, and scroll FPS.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://localhost:4321';
const OUT = process.env.OUT || 'scratch_qa/sidereal';
const ONLY = process.env.ONLY || '';
mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--window-size=1600,1000', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 1 },
});
const errors = [];
async function run(viewport, tag) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${tag}] ${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => errors.push(`[${tag}] PAGEERROR: ${e.message.slice(0, 200)}`));
  await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3500));
  const noToolbar = () => page.evaluate(() => document.querySelector('astro-dev-toolbar')?.remove());
  await noToolbar();
  const idleA = await page.evaluate(() => window.__sidereal?.idle ?? null);
  await new Promise((r) => setTimeout(r, 1200));
  const idleB = await page.evaluate(() => window.__sidereal?.idle ?? null);
  const engineAlive = idleA !== null && idleB !== null && idleB - idleA > 0.5;
  if (!engineAlive) errors.push(`[${tag}] ENGINE NOT ADVANCING: idle ${idleA} → ${idleB}`);
  const layout = await page.evaluate(() => Array.from(document.querySelectorAll('[data-chapter]')).map((el) => ({ id: el.id, top: Math.round(el.getBoundingClientRect().top + scrollY), h: Math.round(el.getBoundingClientRect().height) })).concat([{ id: 'doc', top: 0, h: document.body.scrollHeight }, { id: 'mf-rows', top: 0, h: Array.from(document.querySelectorAll('.mf__row')).map((r) => Math.round(r.getBoundingClientRect().height)).join('/') }]));
  const stops = ['hero', 'work', 'about', 'experience', 'education', 'writing', 'contact'];
  const report0 = [{ layout, engineAlive }];
  const report = report0;
  for (const id of stops) {
    if (ONLY && !ONLY.split(',').includes(id)) continue;
    await page.evaluate((id) => { const el = document.getElementById(id); if (!el) return; const y = id === 'hero' ? 0 : el.getBoundingClientRect().top + scrollY - 72; window.scrollTo(0, y); }, id);
    await new Promise((r) => setTimeout(r, 2600));
    const st = await page.evaluate(() => ({ y: Math.round(scrollY), sun: +(window.__sidereal?.sun ?? NaN).toFixed(1), phase: document.documentElement.dataset.phase, clock: document.getElementById('tc-clock')?.textContent, webgl: document.documentElement.classList.contains('webgl'), ready: document.documentElement.classList.contains('range-ready') }));
    await noToolbar();
    await page.screenshot({ path: `${OUT}/${tag}-${id}.png` });
    report.push({ id, ...st });
  }
  if (!ONLY) {
    const fps = await page.evaluate(async () => {
      window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 300));
      const max = document.body.scrollHeight - innerHeight; const t0 = performance.now(); let frames = 0;
      return await new Promise((res) => { const loop = () => { frames++; const u = (performance.now() - t0) / 3000; window.scrollTo(0, max * Math.min(1, u)); if (u < 1) requestAnimationFrame(loop); else res(Math.round(frames / 3)); }; requestAnimationFrame(loop); });
    });
    report.push({ scrollFps: fps });
  }
  await page.close();
  return report;
}
const desktop = await run({ width: 1600, height: 1000, deviceScaleFactor: 1 }, 'desk');
const mobile = ONLY ? [] : await run({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'mob');
// reading pages
if (!ONLY) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  page.on('pageerror', (e) => errors.push('PAGEERROR(case): ' + e.message.slice(0, 200)));
  for (const [name, path] of [['case', '/work/pm-agent-claude-code'], ['work', '/work'], ['writing', '/writing']]) {
    await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 3000));
    await page.evaluate(() => document.querySelector('astro-dev-toolbar')?.remove());
    await page.screenshot({ path: `${OUT}/page-${name}.png` });
    if (name === 'case') { await page.evaluate(() => window.scrollTo(0, 900)); await new Promise((r) => setTimeout(r, 1500)); await page.screenshot({ path: `${OUT}/page-case-mid.png` }); }
  }
  await page.close();
}
console.log(JSON.stringify({ desktop, mobile, errors: [...new Set(errors)].slice(0, 20) }, null, 1));
await browser.close();
