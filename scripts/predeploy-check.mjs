import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--window-size=1600,1000', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1600, height: 1000 },
});
const pages = ['/', '/flight/', '/work/', '/work/agentic-benefits-verification/', '/work/fax-referral-intake-agent/', '/work/plg-growth-supanote/', '/work/pm-agent-claude-code/', '/writing/', '/ultimate-aptitude/'];
const report = [];
for (const path of pages) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
  const resp = await page.goto('http://localhost:4322' + path, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => window.scrollTo(0, 400));
  await new Promise(r => setTimeout(r, 400));
  const frost = await page.evaluate(() => document.querySelector('.kit-header-bar')?.classList.contains('scrolled') ?? null);
  report.push({ path, status: resp.status(), errors: errs.length, frosted: frost });
  await page.close();
}
console.log(JSON.stringify(report, null, 1));
await browser.close();
