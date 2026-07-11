import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--window-size=1600,1000', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1600, height: 1000 },
});
const page = await browser.newPage();
await page.goto('http://localhost:4322/', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2000));
// seam positions: halfway through each crossfade band
const seams = await page.evaluate(() => {
  const tops = [...document.querySelectorAll('[data-journey-section]')].map(s => s.getBoundingClientRect().top + scrollY);
  return tops.slice(1).map(t => Math.round(t + 0.052 * innerHeight - innerHeight * 0.5)); // viewCenter == seam
});
let i = 0;
for (const y of seams) {
  await page.evaluate(v => window.scrollTo(0, v), y);
  await new Promise(r => setTimeout(r, 1600)); // mid-settle: plates at partial opacity
  await page.screenshot({ path: `scratch_qa/seam-${i++}.png` });
}
console.log('seams at', seams.join(','));
await browser.close();
