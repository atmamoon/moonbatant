import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--window-size=1600,1000', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1600, height: 1000 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:4322/', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2000));
const out = {};
// mid-crossfade capture at the work->about seam (fast snap after jump)
const seam = await page.evaluate(() => {
  const tops = [...document.querySelectorAll('[data-journey-section]')].map(s => s.getBoundingClientRect().top + scrollY);
  return Math.round(tops[2] + 0.052 * innerHeight - innerHeight * 0.5);
});
await page.evaluate(v => window.scrollTo(0, v), seam);
await new Promise(r => setTimeout(r, 380)); // catch plates at partial opacity
out.midFade = await page.evaluate(() => [...document.querySelectorAll('.stage__plate')].map(p => getComputedStyle(p).opacity));
await page.screenshot({ path: 'scratch_qa/r2-seam-midfade.png' });
// knot labels now content-first?
out.knots = await page.evaluate(() => [...document.querySelectorAll('.rope__knot')].map(k => k.dataset.label));
// reveals + count-up at work section
await page.evaluate(() => window.scrollTo(0, 0));
await new Promise(r => setTimeout(r, 400));
await page.evaluate(() => document.getElementById('work').scrollIntoView());
await new Promise(r => setTimeout(r, 500));
out.midCountup = await page.evaluate(() => [...document.querySelectorAll('.mb-metric__val')].slice(0, 3).map(e => e.textContent));
await new Promise(r => setTimeout(r, 1300));
out.settledCountup = await page.evaluate(() => [...document.querySelectorAll('.mb-metric__val')].slice(0, 3).map(e => e.textContent));
out.revealed = await page.evaluate(() => document.querySelectorAll('.js-reveal.revealed').length + '/' + document.querySelectorAll('.js-reveal').length);
await page.screenshot({ path: 'scratch_qa/r2-work-revealed.png' });
// flight canvas robustness: shrink window mid-session, canvas must still cover
await page.goto('http://localhost:4322/flight/', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 3000));
await page.setViewport({ width: 1600, height: 760 });
await new Promise(r => setTimeout(r, 800));
out.canvasCovers = await page.evaluate(() => {
  const c = document.querySelector('.terrain-canvas');
  const r = c.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight, live: c.classList.contains('is-live') };
});
await page.screenshot({ path: 'scratch_qa/r2-flight-resized.png' });
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await browser.close();
