// Social thumbnails: 1200x630 (OG standard), captured at 2x for crispness.
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--window-size=1200,630', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1200, height: 630, deviceScaleFactor: 2 },
});
const shots = [
  ['og-hero', 'http://localhost:4322/', 0, 6000],        // Ama Dablam video settled
  ['og-summit', 'http://localhost:4322/', 1.0, 5000],    // Milky Way register
  ['og-flight', 'http://localhost:4322/flight/', 0, 6000], // terrain hero
];
for (const [name, url, frac, wait] of shots) {
  const p = await b.newPage();
  await p.goto(url, { waitUntil: 'networkidle2', timeout: 40000 });
  if (frac > 0) {
    await p.evaluate(f => window.scrollTo(0, (document.body.scrollHeight - innerHeight) * f), frac);
  }
  await new Promise(r => setTimeout(r, wait));
  await p.screenshot({ path: `scratch_qa/${name}-raw.png` });
  await sharp(`scratch_qa/${name}-raw.png`).resize(1200, 630).jpeg({ quality: 84, mozjpeg: true }).toFile(`scratch_qa/${name}.jpg`);
  await p.close();
}
console.log('captured');
await b.close();
