import sharp from 'sharp';
const src = 'public/terrain/heightmap-z10.png';
const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
// Quantize to 1m: zero the B channel (terrarium: elev = R*256+G+B/256-32768; B = fractional meters)
let minE = 1e9, maxE = -1e9;
for (let i = 0; i < data.length; i += info.channels) {
  const e = data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
  if (e < minE) minE = e; if (e > maxE) maxE = e;
  data[i + 2] = 0;
}
console.log(`elevation range: ${minE.toFixed(0)}m .. ${maxE.toFixed(0)}m`);
const base = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
await base.clone().webp({ lossless: true }).toFile('public/terrain/heightmap-z10.webp');
// also a 2048-wide variant for mobile
await base.clone().resize(2048, 896, { kernel: 'lanczos3' }).webp({ lossless: true }).toFile('public/terrain/heightmap-z10-half.webp');
