import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--window-size=1600,1000', '--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 1600, height: 1000 } });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const out = {};
await p.goto('http://localhost:4322/', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 4000));
out.home = await p.evaluate(() => ({
  terrainLive: !!document.querySelector('.terrain-canvas.is-live'),
  modeToggle: !!document.querySelector('.mode-toggle'),
  motionToggle: !!document.querySelector('.motion-toggle'),
  knots: document.querySelectorAll('.rope__knot').length,
  weather: !!document.getElementById('hero-weather'),
}));
await p.goto('http://localhost:4322/photo/', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2500));
out.photo = await p.evaluate(() => ({
  plates: document.querySelectorAll('.stage__plate').length,
  videoPlaying: [...document.querySelectorAll('#stage video')].filter(v => !v.paused).length,
  modeToggle: !!document.querySelector('.mode-toggle'),
  motionToggle: !!document.querySelector('.motion-toggle'),
}));
out.errors = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
