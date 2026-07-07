// svg.js — procedural SVG shape/tile rendering for spatial & inductive questions

export const PALETTE = {
  red: '#e23b3b', blue: '#2f6fe0', green: '#2faa55', orange: '#f08a24',
  purple: '#8a3fd1', teal: '#159a9a', pink: '#e34fa0', amber: '#e0a81e'
};
export const COLOR_KEYS = Object.keys(PALETTE);

// Single-shape markup inside a 0..100 viewBox, centred on (50,50).
function shapeMarkup(shape, color) {
  switch (shape) {
    case 'circle':   return `<circle cx="50" cy="50" r="30" fill="${color}"/>`;
    case 'square':   return `<rect x="22" y="22" width="56" height="56" rx="3" fill="${color}"/>`;
    case 'triangle': return `<polygon points="50,18 83,80 17,80" fill="${color}"/>`;
    case 'diamond':  return `<polygon points="50,14 84,50 50,86 16,50" fill="${color}"/>`;
    case 'pentagon': return `<polygon points="50,15 85,41 71,82 29,82 15,41" fill="${color}"/>`;
    case 'hexagon':  return `<polygon points="30,22 70,22 88,50 70,78 30,78 12,50" fill="${color}"/>`;
    case 'star':     return `<polygon points="50,14 61,39 88,39 66,57 75,84 50,67 25,84 34,57 12,39 39,39" fill="${color}"/>`;
    // directional arrow (good for rotation matrices) — symmetric about its own axis
    case 'arrow':    return `<polygon points="18,42 56,42 56,26 86,50 56,74 56,58 18,58" fill="${color}"/>`;
    // chiral "L" / boot (good for rotation-vs-reflection) — has NO mirror symmetry
    case 'ell':      return `<polygon points="28,18 50,18 50,58 82,58 82,82 28,82" fill="${color}"/>`;
    // chiral flag
    case 'flag':     return `<g fill="${color}"><rect x="30" y="18" width="8" height="64"/><polygon points="38,20 78,30 38,48"/></g>`;
    default:         return `<circle cx="50" cy="50" r="30" fill="${color}"/>`;
  }
}

// Render a single shape tile with optional rotation (deg, clockwise) and mirror.
export function tile({ shape = 'circle', color = '#2f6fe0', rotation = 0, mirror = false, size = 88 } = {}) {
  const inner = shapeMarkup(shape, color);
  const tf = [];
  tf.push(`rotate(${rotation} 50 50)`);          // applied last (outermost)
  if (mirror) tf.push('translate(100 0) scale(-1 1)'); // applied first → reflection
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="tile-svg" aria-hidden="true"><g transform="${tf.join(' ')}">${inner}</g></svg>`;
}

// Unit polygons (centre 0,0, radius 1) for small inner shapes.
const POLY = {
  triangle: [[0, -1], [0.87, 0.55], [-0.87, 0.55]],
  diamond: [[0, -1], [1, 0], [0, 1], [-1, 0]],
  pentagon: [[0, -1], [0.95, -0.31], [0.59, 0.81], [-0.59, 0.81], [-0.95, -0.31]],
  hexagon: [[0, -1], [0.87, -0.5], [0.87, 0.5], [0, 1], [-0.87, 0.5], [-0.87, -0.5]],
  star: [[0, -1], [0.22, -0.31], [0.95, -0.31], [0.36, 0.12], [0.59, 0.81], [0, 0.38], [-0.59, 0.81], [-0.36, 0.12], [-0.95, -0.31], [-0.22, -0.31]],
};
function miniShape(shape, cx, cy, r, color) {
  if (shape === 'circle') return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;
  if (shape === 'square') return `<rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" fill="${color}"/>`;
  const pts = (POLY[shape] || POLY.triangle).map(([x, y]) => `${(cx + x * r).toFixed(1)},${(cy + y * r).toFixed(1)}`).join(' ');
  return `<polygon points="${pts}" fill="${color}"/>`;
}

/* ---------- SHL-style inductive panel (multiple elements, multiple rules) ---------- */
// A bordered box containing: a big arrow (rotates), a corner dot (translates), and
// fill that toggles solid/hollow (shading rule). Three independent rules at once.
const ARROW_PATH = 'M16,42 H54 V26 L88,50 L54,74 V58 H16 Z';
export function panel({ rot = 0, dotPos = 0, shaded = true, color = '#425CC7', size = 84 } = {}) {
  const corners = [[24, 24], [76, 24], [76, 76], [24, 76]];
  const [dx, dy] = corners[((dotPos % 4) + 4) % 4];
  const arrow = shaded
    ? `<path d="${ARROW_PATH}" fill="${color}"/>`
    : `<path d="${ARROW_PATH}" fill="none" stroke="${color}" stroke-width="5"/>`;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="panel-svg tile-svg" aria-hidden="true"><rect x="3" y="3" width="94" height="94" rx="5" fill="#fff" stroke="#cdd3df"/><g transform="rotate(${rot} 50 50)">${arrow}</g><circle cx="${dx}" cy="${dy}" r="6.5" fill="#1c1d21"/></svg>`;
}

/* ---------- data-interpretation charts (numerical reasoning) ---------- */

export function barChart(labels, values, { color = '#425CC7' } = {}) {
  const W = 380, H = 210, padL = 28, padR = 12, padT = 26, padB = 32;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = Math.max(...values) || 1, n = values.length, gap = plotW / n, bw = gap * 0.58;
  let body = `<line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#c2c8d6"/>`;
  values.forEach((v, i) => {
    const h = v / max * plotH, x = padL + gap * i + (gap - bw) / 2, y = padT + plotH - h;
    body += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${color}"/>`;
    body += `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" font-size="12" text-anchor="middle" font-weight="700" fill="#1c1d21">${v}</text>`;
    body += `<text x="${(x + bw / 2).toFixed(1)}" y="${(padT + plotH + 16).toFixed(1)}" font-size="11" text-anchor="middle" fill="#6b7280">${labels[i]}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:430px" class="chart-svg" role="img">${body}</svg>`;
}

export function lineChart(labels, values, { color = '#425CC7' } = {}) {
  const W = 380, H = 210, padL = 28, padR = 14, padT = 26, padB = 32;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = Math.max(...values) || 1, min = Math.min(...values, 0), n = values.length, gap = plotW / (n - 1);
  const span = (max - min) || 1;
  const pts = values.map((v, i) => [padL + gap * i, padT + plotH - (v - min) / span * plotH]);
  let body = `<line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#c2c8d6"/>`;
  body += `<polyline points="${pts.map(p => p.map(x => x.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5"/>`;
  pts.forEach((p, i) => {
    body += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="${color}"/>`;
    body += `<text x="${p[0].toFixed(1)}" y="${(p[1] - 8).toFixed(1)}" font-size="11" text-anchor="middle" font-weight="700" fill="#1c1d21">${values[i]}</text>`;
    body += `<text x="${p[0].toFixed(1)}" y="${(padT + plotH + 16).toFixed(1)}" font-size="11" text-anchor="middle" fill="#6b7280">${labels[i]}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:430px" class="chart-svg" role="img">${body}</svg>`;
}

export function pieChart(segs) {
  const total = segs.reduce((a, s) => a + s.value, 0) || 1;
  const cx = 95, cy = 105, r = 78;
  let a0 = -Math.PI / 2, body = '';
  segs.forEach(s => {
    const a1 = a0 + (s.value / total) * 2 * Math.PI;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    body += `<path d="M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${s.color}" stroke="#fff" stroke-width="1.5"/>`;
    a0 = a1;
  });
  let legend = '';
  segs.forEach((s, i) => {
    const y = 36 + i * 24;
    legend += `<rect x="200" y="${y - 11}" width="13" height="13" rx="2" fill="${s.color}"/>`;
    legend += `<text x="220" y="${y}" font-size="13" fill="#1c1d21">${s.label}: ${Math.round(s.value / total * 100)}%</text>`;
  });
  return `<svg viewBox="0 0 360 210" width="100%" style="max-width:420px" class="chart-svg" role="img">${body}${legend}</svg>`;
}

// Render a tile containing `count` small shapes (count/shape/colour attributes).
export function dotsTile({ count = 1, color = '#2f6fe0', shape = 'circle', size = 88, rotation = 0 } = {}) {
  const layouts = {
    1: [[50, 50]],
    2: [[33, 50], [67, 50]],
    3: [[50, 30], [33, 68], [67, 68]],
    4: [[33, 33], [67, 33], [33, 67], [67, 67]],
    5: [[33, 33], [67, 33], [50, 50], [33, 67], [67, 67]],
    6: [[33, 28], [67, 28], [33, 50], [67, 50], [33, 72], [67, 72]],
  };
  const pts = layouts[count] || layouts[6];
  const r = count <= 2 ? 17 : count <= 4 ? 14 : 11;
  let body = '';
  for (const [cx, cy] of pts) body += miniShape(shape, cx, cy, r, color);
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="tile-svg" aria-hidden="true"><g transform="rotate(${rotation} 50 50)">${body}</g></svg>`;
}
