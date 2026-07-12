// Verifies: (1) Read links pinned identically bottom-right in all work cards;
// (2) first-load hero shows a clean frame immediately (no blend ghost) and the
// video starts past the blend region.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--window-size=1600,1000', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 1600, height: 1000 } });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.goto('http://localhost:4322/', { waitUntil: 'domcontentloaded' }).catch(() => {});
await new Promise(r => setTimeout(r, 450));
await p.screenshot({ path: 'scratch_qa/pol-load-04s.png' });   // poster moment
await new Promise(r => setTimeout(r, 3000));
await p.screenshot({ path: 'scratch_qa/pol-load-3s.png' });    // video live
const vid = await p.evaluate(() => { const v = document.querySelector('#stage video'); return v ? { t: +v.currentTime.toFixed(2), playing: !v.paused } : null; });
// read-link alignment
await p.evaluate(() => document.getElementById('work').scrollIntoView());
await new Promise(r => setTimeout(r, 1800));
const reads = await p.evaluate(() => [...document.querySelectorAll('.pc')].map(card => {
  const c = card.getBoundingClientRect();
  const r = card.querySelector('.pc__read').getBoundingClientRect();
  return { fromRight: Math.round(c.right - r.right), fromBottom: Math.round(c.bottom - r.bottom) };
}));
await p.screenshot({ path: 'scratch_qa/pol-cards.png' });
console.log(JSON.stringify({ vid, reads, errs }));
await b.close();
