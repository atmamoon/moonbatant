// bake-sky.mjs — builds the Sidereal sky data from d3-celestial's open data
// (https://github.com/ofrohn/d3-celestial, BSD-3):
//   public/sidereal/stars.bin      5,044 stars (mag ≤ 6): unit vector (int16 ×3), mag (u8), B−V (u8)
//   public/sidereal/milkyway.webp  equirectangular isophote bake of the Milky Way
// Usage: node scripts/bake-sky.mjs <dir-with-stars.6.json+mw.json>
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const src = process.argv[2];
const out = path.resolve('public/sidereal');
fs.mkdirSync(out, { recursive: true });

// ── stars ──
const stars = JSON.parse(fs.readFileSync(path.join(src, 'stars.6.json'))).features;
const rec = 8; // bytes per star
const buf = Buffer.alloc(stars.length * rec);
let n = 0;
for (const f of stars) {
  const [lon, dec] = f.geometry.coordinates; // lon: RA in degrees, −180..180
  const mag = Number(f.properties.mag);
  const bv = Number(f.properties.bv ?? 0.6);
  if (!Number.isFinite(mag)) continue;
  const ra = (lon * Math.PI) / 180, d = (dec * Math.PI) / 180;
  const x = Math.cos(d) * Math.cos(ra), y = Math.cos(d) * Math.sin(ra), z = Math.sin(d);
  const o = n * rec;
  buf.writeInt16LE(Math.round(x * 32767), o);
  buf.writeInt16LE(Math.round(y * 32767), o + 2);
  buf.writeInt16LE(Math.round(z * 32767), o + 4);
  buf.writeUInt8(Math.max(0, Math.min(255, Math.round((mag + 2) * 28))), o + 6); // −2..7.1 → 0..255
  buf.writeUInt8(Math.max(0, Math.min(255, Math.round((bv + 0.5) * 100))), o + 7); // −0.5..2.05
  n++;
}
fs.writeFileSync(path.join(out, 'stars.bin'), buf.subarray(0, n * rec));
console.log('stars', n, 'bytes', n * rec);

// ── milky way ── equirectangular, u = (lon+180)/360, v = (90−dec)/180
const W = 2048, H = 1024;
const mw = JSON.parse(fs.readFileSync(path.join(src, 'mw.json'))).features;
const levels = { ol1: 0.16, ol2: 0.2, ol3: 0.24, ol4: 0.3, ol5: 0.38 };
let paths = '';
for (const f of mw) {
  const op = levels[f.id] ?? 0.2;
  const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
  for (const poly of polys) {
    let d = '';
    for (const ring of poly) {
      d += ring.map(([lon, lat], i) => `${i ? 'L' : 'M'}${(((lon + 180) / 360) * W).toFixed(1)} ${(((90 - lat) / 180) * H).toFixed(1)}`).join(' ') + 'Z';
    }
    paths += `<path d="${d}" fill="#fff" fill-opacity="${op}" fill-rule="evenodd"/>`;
  }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#000"/>${paths}</svg>`;
const base = await sharp(Buffer.from(svg)).blur(9).raw().toBuffer({ resolveWithObject: true });
// structure: multiply by a soft turbulence so the band isn't a flat wash
const { data, info } = base;
const seed = 7;
function hash(x, y) { let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
function noise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const gray = Buffer.alloc(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * info.channels;
  let l = data[i] / 255;
  const nz = 0.55 * noise(x / 90, y / 90) + 0.3 * noise(x / 31, y / 31) + 0.15 * noise(x / 11, y / 11);
  l = l * (0.55 + 0.9 * nz); // dust-lane like modulation
  gray[y * W + x] = Math.max(0, Math.min(255, Math.round(l * 255 * 1.35)));
}
await sharp(gray, { raw: { width: W, height: H, channels: 1 } }).webp({ quality: 82 }).toFile(path.join(out, 'milkyway.webp'));
await sharp(gray, { raw: { width: W, height: H, channels: 1 } }).resize(1024).png().toFile(path.join(src, 'milkyway-preview.png'));
console.log('milkyway baked');
