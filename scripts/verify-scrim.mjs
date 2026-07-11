import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--window-size=1800,1300', '--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 1800, height: 1300 } });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:4322/', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2200));
// reproduce the user's spot: mid hero->work transition (altimeter ~3,7xx OVERVIEW)
const y = await p.evaluate(() => {
  const hero = document.querySelector('[data-journey-section]');
  return Math.round(hero.getBoundingClientRect().height * 0.75);
});
await p.evaluate(v => window.scrollTo(0, v), y);
await new Promise(r => setTimeout(r, 2200));
const out = await p.evaluate(() => ({
  alt: document.getElementById('alt-value')?.textContent,
  scrimOpacity: document.querySelector('.hero__textscrim')?.style.opacity,
}));
out.errors = errs;
await p.screenshot({ path: 'scratch_qa/scrim-fix.png' });
console.log(JSON.stringify(out));
await b.close();
