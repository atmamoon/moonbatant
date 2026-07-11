// Two seamlessly-tiling FBM fog plates (alpha webp) for CSS drift layers.
import sharp from 'sharp';
const W = 2048, H = 1024;
function makeNoise(seed, period) {
  let s = seed >>> 0;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const g = [];
  for (let y = 0; y < period; y++) { g[y] = []; for (let x = 0; x < period; x++) g[y][x] = rand(); }
  const fade = (t) => t * t * (3 - 2 * t);
  return (x, y) => { // x,y in lattice units, wraps at period
    const xi = Math.floor(x) % period, yi = Math.floor(y) % period;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const x2 = (xi + 1) % period, y2 = (yi + 1) % period;
    const u = fade(xf), v = fade(yf);
    const a = g[yi][xi] * (1 - u) + g[yi][x2] * u;
    const b = g[y2][xi] * (1 - u) + g[y2][x2] * u;
    return a * (1 - v) + b * v;
  };
}
async function plate(seed, scale, gain, name) {
  const octs = [];
  for (let o = 0; o < 5; o++) octs.push(makeNoise(seed + o * 77, scale * (1 << o)));
  const buf = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let f = 0, amp = 0.5;
    for (let o = 0; o < 5; o++) { f += octs[o]((x / W) * scale * (1 << o), (y / H) * (scale * (1 << o)) * (H / W)) * amp; amp *= 0.5; }
    // horizontal band bias: denser mid, fade top/bottom edges (still tiles horizontally)
    const band = Math.sin((y / H) * Math.PI) ** 1.2;
    let a = Math.max(0, (f - 0.44)) * 2.4 * band * gain;
    a = Math.min(1, a) ** 1.35;
    const i = (y * W + x) * 4;
    buf[i] = 168; buf[i + 1] = 182; buf[i + 2] = 212; // cool blue-grey mist
    buf[i + 3] = Math.round(a * 255);
  }
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 62, alphaQuality: 80 }).toFile(`public/photos/${name}`);
}
await plate(12, 3, 0.85, 'fog-plate-a.webp');
await plate(97, 5, 0.7, 'fog-plate-b.webp');
console.log('fog plates done');
