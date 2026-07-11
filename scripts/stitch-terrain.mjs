import { mkdirSync, writeFileSync, existsSync } from 'fs';
import sharp from 'sharp';
const z = 10, x0 = 749, x1 = 764, y0 = 425, y1 = 431;
// 1) download satellite tiles
mkdirSync('scratch_sat', { recursive: true });
let fails = 0;
for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
  const p = `scratch_sat/${x}_${y}.jpg`;
  if (existsSync(p)) continue;
  const u = `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/${z}/${y}/${x}.jpg`;
  const r = await fetch(u);
  if (!r.ok) { fails++; console.error('FAIL', u, r.status); continue; }
  writeFileSync(p, Buffer.from(await r.arrayBuffer()));
}
console.log('sat download done, fails:', fails);
// 2) stitch heightmap (lossless PNG) + satellite (JPEG)
const W = (x1 - x0 + 1) * 256, H = (y1 - y0 + 1) * 256;
const hLayers = [], sLayers = [];
for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
  hLayers.push({ input: `public/terrain/${z}/${x}/${y}.png`, left: (x - x0) * 256, top: (y - y0) * 256 });
  sLayers.push({ input: `scratch_sat/${x}_${y}.jpg`, left: (x - x0) * 256, top: (y - y0) * 256 });
}
await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } })
  .composite(hLayers).png({ compressionLevel: 9 }).toFile('public/terrain/heightmap-z10.png');
await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } })
  .composite(sLayers).jpeg({ quality: 72, mozjpeg: true }).toFile('public/terrain/satellite-z10.jpg');
console.log(`stitched ${W}x${H}`);
