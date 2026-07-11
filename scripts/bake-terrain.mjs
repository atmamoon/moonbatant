// Bake shipped terrain assets from cached raw tiles.
// Outputs: public/terrain/height-rg.png (RG-packed 16-bit), normal.webp, albedo.webp, manifest.json
import sharp from 'sharp';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
const z = 10, x0 = 749, x1 = 764, y0 = 425, y1 = 431;
const W = (x1 - x0 + 1) * 256, H = (y1 - y0 + 1) * 256; // 4096 x 1792
const EXAG = 1.5;

// 1) decode DEM from cached terrarium tiles
const dem = new Float32Array(W * H);
for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) {
  const { data, info } = await sharp(`scripts/.tile-cache/10/${tx}/${ty}.png`).raw().toBuffer({ resolveWithObject: true });
  const ox = (tx - x0) * 256, oy = (ty - y0) * 256;
  for (let p = 0; p < 256 * 256; p++) {
    const i = p * info.channels;
    const e = data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
    dem[(oy + (p >> 8)) * W + ox + (p & 255)] = Math.max(0, e); // clamp void artifacts
  }
}
let hMin = Infinity, hMax = -Infinity;
for (const e of dem) { if (e < hMin) hMin = e; if (e > hMax) hMax = e; }
console.log('DEM range', hMin, hMax);

// 2) ground spacing (m/px) at center lat for normals
const latC = 28.2;
const mpp = (156543.03392 * Math.cos((latC * Math.PI) / 180)) / 2 ** z;

// 3) normal map at full res (exaggeration baked), then downsample
const nrm = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const xm = Math.max(0, x - 1), xp = Math.min(W - 1, x + 1);
  const ym = Math.max(0, y - 1), yp = Math.min(H - 1, y + 1);
  const dzdx = ((dem[y * W + xp] - dem[y * W + xm]) * EXAG) / ((xp - xm) * mpp);
  const dzdy = ((dem[yp * W + x] - dem[ym * W + x]) * EXAG) / ((yp - ym) * mpp);
  const inv = 1 / Math.hypot(dzdx, dzdy, 1);
  const i = (y * W + x) * 3;
  nrm[i]     = Math.round((-dzdx * inv * 0.5 + 0.5) * 255);
  nrm[i + 1] = Math.round((inv * 0.5 + 0.5) * 255);        // up in G
  nrm[i + 2] = Math.round((-dzdy * inv * 0.5 + 0.5) * 255);
}
await sharp(nrm, { raw: { width: W, height: H, channels: 3 } })
  .resize(2048, 896, { kernel: 'lanczos3' })
  .blur(0.7) // soften SRTM striping noise that Sobel + exaggeration amplify
  .webp({ quality: 95 }).toFile('public/terrain/normal.webp');

// 4) RG-packed heightmap at 2048x896 (average-downsample dem first)
const W2 = 2048, H2 = 896;
const packed = Buffer.alloc(W2 * H2 * 3);
for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
  let s = 0;
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) s += dem[(y * 2 + dy) * W + x * 2 + dx];
  const t = Math.round(((s / 4 - hMin) / (hMax - hMin)) * 65535);
  const i = (y * W2 + x) * 3;
  packed[i] = t >> 8; packed[i + 1] = t & 255; packed[i + 2] = 0;
}
await sharp(packed, { raw: { width: W2, height: H2, channels: 3 } })
  .webp({ lossless: true }).toFile('public/terrain/height-rg.webp');

// 5) albedo: fetch 2016 CC-BY satellite, stitch, desaturate, dusk-grade
mkdirSync('scripts/.tile-cache/sat2016', { recursive: true });
const layers = [];
for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) {
  const p = `scripts/.tile-cache/sat2016/${tx}_${ty}.jpg`;
  if (!existsSync(p)) {
    const r = await fetch(`https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${z}/${ty}/${tx}.jpg`);
    if (!r.ok) throw new Error('sat fetch ' + r.status);
    writeFileSync(p, Buffer.from(await r.arrayBuffer()));
  }
  layers.push({ input: p, left: (tx - x0) * 256, top: (ty - y0) * 256 });
}
await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } })
  .composite(layers)
  .modulate({ saturation: 0.62, brightness: 0.94 })
  .resize(2048, 896, { kernel: 'lanczos3' })
  .webp({ quality: 76 }).toFile('public/terrain/albedo.webp');

// 6) manifest
writeFileSync('public/terrain/manifest.json', JSON.stringify({
  z, x0, x1, y0, y1, width: W2, height: H2, hMin, hMax, exaggeration: EXAG,
  metersPerPixel: mpp * 2, extentKmX: (W * mpp) / 1000, extentKmY: (H * mpp) / 1000,
  attribution: 'Sentinel-2 cloudless by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016) · Elevation: Mapzen terrain tiles (SRTM)',
}, null, 2));
console.log('bake complete');
