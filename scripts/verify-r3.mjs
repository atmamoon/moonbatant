import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--window-size=1600,1000', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1600, height: 1000 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:4322/', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2500));
const out = {};
out.heroRate = await page.evaluate(() => document.querySelector('#stage video')?.playbackRate);
out.knots = await page.evaluate(() => [...document.querySelectorAll('.rope__knot')].map(k => k.dataset.label));
// hero->work seam (top transition)
const seams = await page.evaluate(() => {
  const tops = [...document.querySelectorAll('[data-journey-section]')].map(s => s.getBoundingClientRect().top + scrollY);
  return tops.slice(1).map(t => Math.round(t + 0.052 * innerHeight - innerHeight * 0.5));
});
await page.evaluate(v => window.scrollTo(0, v), seams[0]);
await new Promise(r => setTimeout(r, 2400));
await page.screenshot({ path: 'scratch_qa/r3-seam-hero-work.png' });
// experience->writing seam (bottom transition, milky way)
await page.evaluate(v => window.scrollTo(0, v), seams[3]);
await new Promise(r => setTimeout(r, 2400));
await page.screenshot({ path: 'scratch_qa/r3-seam-exp-writing.png' });
out.errors = errors;
console.log(JSON.stringify(out));
await browser.close();
