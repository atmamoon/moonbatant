// Renders the flight hero camera pose with all DOM chrome hidden and saves it
// as the boot poster — the page then looks like flight mode from frame zero.
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--window-size=1920,1080', '--hide-scrollbars'], defaultViewport: { width: 1920, height: 1080 } });
const p = await b.newPage();
await p.goto('http://localhost:4322/', { waitUntil: 'networkidle2' });
await p.addStyleTag({ content: '.journey-content, header, .rope, .peak-labels, .terrain-scrim { display: none !important; } .terrain-canvas { transition: none !important; }' });
await new Promise(r => setTimeout(r, 5000)); // terrain boot + settle
await p.screenshot({ path: 'scratch_qa/poster-raw.png' });
await b.close();
await sharp('scratch_qa/poster-raw.png').webp({ quality: 74 }).toFile('public/terrain/poster.webp');
const { size } = await import('fs').then(fs => fs.statSync('public/terrain/poster.webp'));
console.log('poster.webp', (size / 1024).toFixed(0) + 'KB');
