// Post-fix verification: confirms each QA finding is resolved on the PROD build.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--window-size=1600,1000', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1600, height: 1000 },
});
const out = {};
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://localhost:4322/', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 2200));
out.dataMotionAtBoot = await page.evaluate(() => document.documentElement.dataset.motion);
out.headerAtTop = await page.evaluate(() => document.querySelector('.kit-header-bar').classList.contains('scrolled'));
await page.evaluate(() => window.scrollTo(0, 900));
await new Promise((r) => setTimeout(r, 600));
out.headerScrolled = await page.evaluate(() => {
  const h = document.querySelector('.kit-header-bar');
  return { cls: h.classList.contains('scrolled'), blur: getComputedStyle(h).backdropFilter };
});
out.labelShadow = await page.evaluate(() => getComputedStyle(document.querySelector('.section-label')).textShadow.split('rgb').length - 1);
// motion toggle honesty
await page.evaluate(() => window.scrollTo(0, 0));
await new Promise((r) => setTimeout(r, 1500));
out.videoBefore = await page.evaluate(() => [...document.querySelectorAll('#stage video')].filter((v) => !v.paused).length);

await page.evaluate(() => window.mbToggleMotion());
await new Promise((r) => setTimeout(r, 400));
out.videoAfterOff = await page.evaluate(() => [...document.querySelectorAll('#stage video')].filter((v) => !v.paused).length);
await page.evaluate(() => window.mbToggleMotion());
await new Promise((r) => setTimeout(r, 600));
out.videoAfterOn = await page.evaluate(() => [...document.querySelectorAll('#stage video')].filter((v) => !v.paused).length);
await page.screenshot({ path: 'scratch_qa/fix-home-work.png' });

// mobile footer bar
await page.setViewport({ width: 390, height: 844 });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await new Promise((r) => setTimeout(r, 1200));
out.motionPillH = await page.evaluate(() => document.querySelector('.motion-toggle').getBoundingClientRect().height);
await page.screenshot({ path: 'scratch_qa/fix-footer-390.png' });

// flight: labels at 50%, horizon check
await page.setViewport({ width: 1600, height: 1000 });
await page.goto('http://localhost:4322/flight/', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 3500));
const stops = {};
for (const f of [0.5, 0.62]) {
  await page.evaluate((u) => window.scrollTo(0, (document.body.scrollHeight - innerHeight) * u), f);
  await new Promise((r) => setTimeout(r, 3200));
  stops[f] = await page.evaluate(() => [...document.querySelectorAll('.peak-label')].filter((l) => +l.style.opacity > 0).map((l) => l.textContent + '@' + l.style.opacity));
}
out.flightLabels = stops;
await page.screenshot({ path: 'scratch_qa/fix-flight-everest.png' });
await page.evaluate(() => window.scrollTo(0, 0));
await new Promise((r) => setTimeout(r, 2800));
await page.screenshot({ path: 'scratch_qa/fix-flight-hero.png' });
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await browser.close();
