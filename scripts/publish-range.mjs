// publish-range.mjs — takes a keyed RGBA cutout (+ skyline json) and writes the
// Sidereal range assets: range.webp (full), range-2k.webp (mobile), range.json
// (skyline profile, 1 sample / 4 px), poster.webp (static first-paint frame).
import sharp from 'sharp';
import fs from 'fs';
const [,, cutPng, skylineJson] = process.argv;
const out = 'public/sidereal';
const sk = JSON.parse(fs.readFileSync(skylineJson));
// power-of-two canvases (4096×2048 / 2048×1024) so WebGL1 can mipmap: the plate
// sits in the top-left; range.json carries the sub-rect the shader samples.
const padPOT = async (src, w, h, outFile, q) => {
  const img = await sharp(src).resize(w).png().toBuffer(); const m = await sharp(img).metadata();
  await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: img, top: 0, left: 0 }]).webp({ quality: q, alphaQuality: 95, effort: 5 }).toFile(outFile);
  return [m.width / w, m.height / h];
};
const subFull = await padPOT(cutPng, 4096, 2048, `${out}/range.webp`, 90);
await padPOT(cutPng, 2048, 1024, `${out}/range-2k.webp`, 88);
const step = 4, ds = [];
for (let x = 0; x < sk.W; x += step) ds.push(sk.skyline[x]);
fs.writeFileSync(`${out}/range.json`, JSON.stringify({ w: sk.W, h: sk.H, step, sub: subFull.map((v) => +v.toFixed(5)), skyline: ds }));
// poster: golden-hour gradient (raw buffer) + the cutout anchored to the bottom
const W = sk.W, H = Math.round(sk.H * 1.45);
const stops = [[0, [15, 37, 96]], [0.45, [47, 79, 146]], [0.72, [139, 147, 184]], [1, [217, 191, 168]]];
const bg = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) {
  const t = y / (H - 1); let i = 0; while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [t0, c0] = stops[i], [t1, c1] = stops[i + 1]; const u = (t - t0) / (t1 - t0);
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * u), g = Math.round(c0[1] + (c1[1] - c0[1]) * u), b = Math.round(c0[2] + (c1[2] - c0[2]) * u);
  for (let x = 0; x < W; x++) { const o = (y * W + x) * 3; bg[o] = r; bg[o + 1] = g; bg[o + 2] = b; }
}
const cut = await sharp(cutPng).png().toBuffer();
const posterFull = await sharp(bg, { raw: { width: W, height: H, channels: 3 } }).composite([{ input: cut, top: H - sk.H, left: 0 }]).png().toBuffer(); // sharp resizes before composite, so composite first
await sharp(posterFull).resize(2048).webp({ quality: 82 }).toFile(`${out}/poster.webp`);
for (const f of fs.readdirSync(out)) console.log(f, (fs.statSync(`${out}/${f}`).size / 1024 | 0) + 'KB');
