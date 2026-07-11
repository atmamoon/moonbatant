// Simulates a slow device: throttled network, screenshot DURING boot (before
// the canvas is live) — the backdrop must already read as flight mode.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--window-size=1600,1000', '--hide-scrollbars'], defaultViewport: { width: 1600, height: 1000 } });
const p = await b.newPage();
const cdp = await p.target().createCDPSession();
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 120, downloadThroughput: 1.2e6, uploadThroughput: 5e5 }); // ~10Mbps
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.goto('http://localhost:4322/', { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
await new Promise(r => setTimeout(r, 1600)); // mid-boot
const boot = await p.evaluate(() => ({
  canvasLive: !!document.querySelector('.terrain-canvas.is-live'),
  posterBg: getComputedStyle(document.querySelector('.terrain-poster')).backgroundImage,
}));
await p.screenshot({ path: 'scratch_qa/boot-midload.png' });
await new Promise(r => setTimeout(r, 9000));
const after = await p.evaluate(() => ({ canvasLive: !!document.querySelector('.terrain-canvas.is-live') }));
console.log(JSON.stringify({ boot, after, errs }));
await b.close();
