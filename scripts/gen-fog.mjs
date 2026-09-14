// Two seamlessly tiling FBM cloud plates (alpha webp) for the sky's cloud layers, run from the repo root.
// Soft FBM density, faint enough that text reads over it at every hour (denser clouds with firm edges took text behind
// them to 2.6:1 at sunset); shading is baked into RGB from the density itself: lit where a cloud thins toward the low
// sun (left, below), shaded inside.
import sharp from 'sharp';
const W = 2048, H = 1024, OCTAVES = 5;
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
  for (let o = 0; o < OCTAVES; o++) octs.push(makeNoise(seed + o * 77, scale * (1 << o)));
  const A = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let f = 0, amp = 0.5;
    for (let o = 0; o < OCTAVES; o++) { f += octs[o]((x / W) * scale * (1 << o), (y / H) * (scale * (1 << o)) * (H / W)) * amp; amp *= 0.5; }
    // horizontal band bias: denser mid, fade top/bottom edges (still tiles horizontally)
    const band = Math.sin((y / H) * Math.PI) ** 1.2;
    A[y * W + x] = Math.min(1, Math.max(0, f - 0.44) * 2.4 * band * gain) ** 1.35;
  }
  // shading: blur the density (sigma 8, wrapping horizontally so the plate still tiles), then compare each point with
  // one a step toward the low sun
  const R = 24, k = [];
  let ks = 0;
  for (let i = -R; i <= R; i++) { const v = Math.exp(-(i * i) / 128); k.push(v); ks += v; }
  const tmp = new Float32Array(W * H), G = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let t = 0; for (let i = -R; i <= R; i++) t += A[y * W + ((x + i) % W + W) % W] * k[i + R]; tmp[y * W + x] = t / ks; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let t = 0; for (let i = -R; i <= R; i++) t += tmp[Math.min(H - 1, Math.max(0, y + i)) * W + x] * k[i + R]; G[y * W + x] = t / ks; }
  let maxA = 0;
  for (const v of A) if (v > maxA) maxA = v;
  const buf = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, j = Math.min(H - 1, y + 16) * W + ((x - 24) % W + W) % W;
    const L = Math.min(1, Math.max(0.35, 0.62 + 1.2 * (G[i] - G[j]) / Math.max(maxA, 1e-3)));
    const v = Math.round(L * 255);
    buf[i * 4] = v; buf[i * 4 + 1] = v; buf[i * 4 + 2] = v; buf[i * 4 + 3] = Math.round(A[i] * 255);
  }
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 92, alphaQuality: 100, effort: 5 }).toFile(`public/photos/${name}`);
  console.log(`${name}: peak density ${maxA.toFixed(2)}`);
}
await plate(12, 3, 0.85, 'fog-plate-a.webp');
await plate(97, 5, 0.7, 'fog-plate-b.webp');
console.log('fog plates done');
