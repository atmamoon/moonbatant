// generators.js — procedural question generators for all four cognitive-aptitude categories.
// Each generator returns: { category, type, promptHTML, options:[html...], correct:index, explanation }

import { tile, dotsTile, panel, barChart, lineChart, pieChart, PALETTE, COLOR_KEYS } from './svg.js';

/* ---------- tiny RNG helpers ---------- */
const rint = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const money = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const plain = (n) => String(n);
const pct = (n) => n + '%';

// Build EXACTLY 5 unique options from a correct numeric value + plausible wrong values.
// Dedupes on the *formatted* string so two numbers that format alike never collide.
function mc(correct, wrongs, fmt = plain) {
  const round = (v) => Math.round(v * 100) / 100;
  const correctR = round(correct);
  const correctF = fmt(correctR);
  const seen = new Set([correctF]);
  const order = [correctF];
  const add = (v) => {
    if (order.length >= 5 || !isFinite(v)) return;
    const f = fmt(round(v));
    if (!seen.has(f)) { seen.add(f); order.push(f); }
  };
  for (const w of wrongs) add(w);
  let guard = 0;
  while (order.length < 5 && guard++ < 300) {
    const span = (Math.max(2, Math.round(Math.abs(correctR) * 0.15)) || 2) + order.length;
    add(correctR + pick([-1, 1]) * rint(1, span));
  }
  const sh = shuffle(order);
  return { options: sh.map(esc), correct: sh.indexOf(correctF) };
}

// Build EXACTLY 5 unique string options. `filler` makes extra unique distractors if needed.
function mcStr(correctStr, wrongStrs, filler) {
  const order = [correctStr];
  const seen = new Set([correctStr]);
  const add = (s) => { if (order.length < 5 && s != null && !seen.has(s)) { seen.add(s); order.push(s); } };
  for (const w of wrongStrs) add(w);
  let guard = 0;
  while (order.length < 5 && guard++ < 300) add(filler ? filler() : correctStr + '·'.repeat(order.length));
  const sh = shuffle(order);
  return { options: sh.map(esc), correct: sh.indexOf(correctStr) };
}

/* =======================================================================
   NUMERICAL REASONING
   ======================================================================= */

function genDiscount() {
  const orig = rint(5, 40) * 100;
  const d = pick([10, 20, 25, 30, 40]);
  const final = orig * (1 - d / 100);
  const m = mc(orig, [final * (1 + d / 100), final + d, orig - final, final], money);
  return {
    category: 'Numerical', type: 'discount',
    promptHTML: `A product costs <b>${money(final)}</b> after a <b>${d}%</b> discount. What was the original price?`,
    ...m, explanation: `${money(final)} is ${100 - d}% of the original, so original = ${money(final)} ÷ ${(100 - d) / 100} = ${money(orig)}.`,
  };
}

function genRaise() {
  const orig = rint(20, 60) * 1000;
  const r = pick([10, 15, 20, 25]);
  const nw = orig * (1 + r / 100);
  const m = mc(orig, [nw * (1 - r / 100), nw - (nw * r / 100), orig + r, nw], money);
  return {
    category: 'Numerical', type: 'raise',
    promptHTML: `After a <b>${r}%</b> raise, a salary is <b>${money(nw)}</b>. What was the original salary?`,
    ...m, explanation: `New salary is ${100 + r}% of original → ${money(nw)} ÷ ${(100 + r) / 100} = ${money(orig)}.`,
  };
}

function genAvgRemoved() {
  const n = pick([5, 6, 7]);
  const A = rint(25, 40);
  const delta = pick([2, 3, 4]);
  const newAvg = A + delta;                 // removing a below-average value raises the mean
  const removed = n * A - (n - 1) * newAvg;
  const m = mc(removed, [A, newAvg, n * A - newAvg, A - delta]);
  return {
    category: 'Numerical', type: 'avg-removed',
    promptHTML: `The average of <b>${n}</b> numbers is <b>${A}</b>. One number is removed and the average of the rest becomes <b>${newAvg}</b>. What was the removed number?`,
    ...m, explanation: `Removed = ${n}×${A} − ${n - 1}×${newAvg} = ${n * A} − ${(n - 1) * newAvg} = ${removed}.`,
  };
}

function genSpeed() {
  const speed = pick([40, 45, 50, 60, 72, 80]);
  const time = pick([2, 3, 4, 5]);
  const dist = speed * time;
  const m = mc(dist, [speed * (time + 1), speed * (time - 1), dist + speed, dist - speed]);
  return {
    category: 'Numerical', type: 'speed',
    promptHTML: `A car travels at a constant <b>${speed} km/h</b>. How far does it go in <b>${time} hours</b>?`,
    ...m, explanation: `Distance = speed × time = ${speed} × ${time} = ${dist} km.`,
  };
}

function genPipes() {
  const [a, b, res] = pick([[12, 6, 4], [12, 4, 3], [10, 15, 6], [20, 30, 12], [12, 24, 8], [15, 10, 6], [6, 3, 2], [8, 8, 4], [9, 18, 6]]);
  const m = mc(res, [a + b, Math.abs(a - b), (a + b) / 2, Math.min(a, b)]);
  return {
    category: 'Numerical', type: 'pipes',
    promptHTML: `Two pipes can fill a tank in <b>${a}</b> and <b>${b}</b> minutes respectively. If both are open together, how long to fill the tank?`,
    ...m, explanation: `Combined rate = 1/${a} + 1/${b}; time = (${a}×${b}) ÷ (${a}+${b}) = ${res} minutes.`,
  };
}

function genSI() {
  const P = rint(5, 20) * 1000;
  const r = pick([5, 8, 10, 12]);
  const t = pick([2, 3, 4]);
  const si = P * r * t / 100;
  const total = P + si;
  const askTotal = Math.random() < 0.5;
  const correct = askTotal ? total : si;
  const m = mc(correct, [askTotal ? si : total, P, P + r * t, P * (1 + r / 100)], money);
  return {
    category: 'Numerical', type: 'simple-interest',
    promptHTML: `${money(P)} is invested at <b>${r}%</b> simple interest per year for <b>${t} years</b>. What is the <b>${askTotal ? 'total amount' : 'interest earned'}</b>?`,
    ...m, explanation: `Interest = ${money(P)} × ${r}% × ${t} = ${money(si)}.${askTotal ? ` Total = ${money(P)} + ${money(si)} = ${money(total)}.` : ''}`,
  };
}

function genProfit() {
  const cp = rint(2, 12) * 100;
  const p = pick([10, 20, 25, 50]);
  const sp = cp * (1 + p / 100);
  const askSP = Math.random() < 0.5;
  const correct = askSP ? sp : cp;
  const m = mc(correct, [askSP ? cp : sp, cp * (1 - p / 100), sp + p, cp + p], money);
  return {
    category: 'Numerical', type: 'profit',
    promptHTML: askSP
      ? `An item costs <b>${money(cp)}</b>. What selling price gives a <b>${p}%</b> profit?`
      : `An item is sold for <b>${money(sp)}</b> at a <b>${p}%</b> profit. What was the cost price?`,
    ...m, explanation: askSP ? `SP = ${money(cp)} × ${1 + p / 100} = ${money(sp)}.` : `CP = ${money(sp)} ÷ ${1 + p / 100} = ${money(cp)}.`,
  };
}

function genRatioShare() {
  const parts = [rint(1, 5), rint(1, 5), rint(1, 5)];
  const sum = parts.reduce((a, b) => a + b, 0);
  const unit = rint(2, 9) * 100;
  const total = sum * unit;
  const idx = rint(0, 2);
  const share = parts[idx] * unit;
  const m = mc(share, [total / 3, parts[(idx + 1) % 3] * unit, parts[(idx + 2) % 3] * unit, total - share], money);
  return {
    category: 'Numerical', type: 'ratio-share',
    promptHTML: `${money(total)} is divided among three people in the ratio <b>${parts.join(' : ')}</b>. How much does the <b>${['first', 'second', 'third'][idx]}</b> person get?`,
    ...m, explanation: `Total parts = ${sum}; one part = ${money(unit)}; share = ${parts[idx]} × ${money(unit)} = ${money(share)}.`,
  };
}

function genPctOfPct() {
  const a = pick([10, 15, 20, 25]);
  const b = pick([20, 40, 50, 80]);
  const base = pick([1000, 2000, 2500, 4000]);
  const ans = a / 100 * (b / 100) * base;
  const m = mc(ans, [b / 100 * base, a / 100 * base, (a + b) / 100 * base, a * b], money);
  return {
    category: 'Numerical', type: 'pct-of-pct',
    promptHTML: `What is <b>${a}%</b> of <b>${b}%</b> of <b>${money(base)}</b>?`,
    ...m, explanation: `${a}% × ${b}% × ${money(base)} = ${a * b / 10000} × ${money(base)} = ${money(ans)}.`,
  };
}

function genAges() {
  const son = pick([8, 10, 12, 14]);
  const k = pick([3, 4]);                     // father = k × son now (k>2 keeps it well-posed)
  const father = k * son;
  // In t years father is m× son: solve nicely — just report and verify with a true scenario
  const t = father - 2 * son;                // makes father+t = 2(son+t) when k... compute generally
  const m = mc(son, [father, son + t, father - son, k * son - t]);
  return {
    category: 'Numerical', type: 'ages',
    promptHTML: `A father is <b>${k} times</b> as old as his son. In <b>${t} years</b> he will be <b>twice</b> as old as his son. What is the son's present age?`,
    ...m, explanation: `Let son = s. ${k}s + ${t} = 2(s + ${t}) → ${k}s + ${t} = 2s + ${2 * t} → ${k - 2}s = ${t} → s = ${son}.`,
  };
}

/* =======================================================================
   LOGIC & ANALYSIS
   ======================================================================= */

function genSeries() {
  const mode = pick(['addk', 'mulk', 'sqdiff', 'altmuladd', 'fib']);
  let seq = [], next, expl;
  if (mode === 'addk') {
    const s = rint(2, 9), d = rint(3, 9);
    for (let i = 0; i < 5; i++) seq.push(s + i * d);
    next = s + 5 * d; expl = `Add ${d} each step.`;
  } else if (mode === 'mulk') {
    const s = rint(2, 5), r = pick([2, 3]);
    for (let i = 0; i < 5; i++) seq.push(s * r ** i);
    next = s * r ** 5; expl = `Multiply by ${r} each step.`;
  } else if (mode === 'sqdiff') {
    const s = rint(1, 5); let v = s, d = rint(2, 4);
    seq.push(v);
    for (let i = 0; i < 4; i++) { v += d; seq.push(v); d += 1; }
    next = v + d; expl = `Each gap between terms increases by 1.`;
  } else if (mode === 'altmuladd') {
    const s = rint(3, 7), mul = 2, add = pick([3, 5]);
    let v = s; seq.push(v);
    for (let i = 0; i < 4; i++) { v = (i % 2 === 0) ? v * mul : v + add; seq.push(v); }
    next = (4 % 2 === 0) ? v * mul : v + add; expl = `Alternate ×${mul} and +${add}.`;
  } else { // fib
    let a = rint(1, 4), b = rint(2, 5); seq = [a, b];
    for (let i = 0; i < 3; i++) { const c = a + b; seq.push(c); a = b; b = c; }
    next = a + b; expl = `Each term = sum of the previous two.`;
  }
  const m = mc(next, [next + rint(1, 4), next - rint(1, 4), seq[4] + (seq[4] - seq[3]), next + 10]);
  return {
    category: 'Logic', type: 'number-series',
    promptHTML: `What comes next?<div class="mono big">${seq.join(',&nbsp; ')},&nbsp; ?</div>`,
    ...m, explanation: `${seq.join(', ')} → ${next}. ${expl}`,
  };
}

function genOddNumber() {
  const mode = pick(['square', 'cube', 'prime', 'multiple']);
  let set = [], odd, expl;
  if (mode === 'square') {
    const base = rint(3, 9);
    set = [base, base + 1, base + 2, base + 3].map(x => x * x);
    odd = set[rint(0, 3)] + pick([1, -1, 3]); expl = `The others are perfect squares.`;
  } else if (mode === 'cube') {
    const base = rint(2, 4);
    set = [base, base + 1, base + 2, base + 3].map(x => x ** 3);
    odd = set[rint(0, 3)] + pick([2, -2, 4]); expl = `The others are perfect cubes.`;
  } else if (mode === 'prime') {
    set = shuffle([7, 11, 13, 17, 19, 23, 29]).slice(0, 4);
    odd = pick([15, 21, 25, 27, 33, 9]); expl = `The others are prime numbers.`;
  } else {
    const k = pick([3, 4, 6, 7]);
    set = [2, 3, 4, 5].map(x => x * k);
    odd = set[rint(0, 3)] + pick([1, -1, 2]); expl = `The others are multiples of ${k}.`;
  }
  while (set.includes(odd)) odd += 1;
  const all = shuffle([...set, odd]);
  return {
    category: 'Logic', type: 'odd-one-out',
    promptHTML: `Which is the <b>odd one out</b>?`,
    options: all.map(v => esc(String(v))), correct: all.indexOf(odd),
    explanation: `${odd} is the odd one. ${expl}`,
  };
}

function genAnalogy() {
  const fn = pick([['square', x => x * x, 'n²'], ['cube', x => x ** 3, 'n³'], ['triangular', x => x * (x + 1), 'n(n+1)'], ['double+', x => x * 2 + 1, '2n+1']]);
  const a = rint(2, 6), b = rint(3, 9);
  const fa = fn[1](a), fb = fn[1](b);
  const m = mc(fb, [b * b, b ** 3, b * (b + 1), fb + b]);
  return {
    category: 'Logic', type: 'analogy',
    promptHTML: `Complete the analogy:<div class="mono big">${a} : ${fa}&nbsp; ::&nbsp; ${b} : ?</div>`,
    ...m, explanation: `The rule is ${fn[2]}: ${a}→${fa}, so ${b}→${fb}.`,
  };
}

function genLetterSeries() {
  // gaps grow: +2,+3,+4,+5 → +6
  const startGap = pick([1, 2]);
  let pos = rint(0, 3), letters = [], gap = startGap;
  letters.push(pos);
  for (let i = 0; i < 4; i++) { pos += gap; letters.push(pos); gap += 1; }
  const nextPos = pos + gap;
  const L = (n) => String.fromCharCode(65 + ((n % 26) + 26) % 26);
  const m = mcStr(L(nextPos), [L(nextPos - 1), L(nextPos + 1), L(pos + gap - 1), L(nextPos - 2)],
    () => L(rint(0, 25)));
  return {
    category: 'Logic', type: 'letter-series',
    promptHTML: `What comes next in the letter series?<div class="mono big">${letters.map(L).join(',&nbsp; ')},&nbsp; ?</div>`,
    ...m, explanation: `Gaps increase by one each step; the next letter is ${L(nextPos)}.`,
  };
}

function genCoding() {
  const atbash = Math.random() < 0.5;
  const words = ['CAT', 'DOG', 'SUN', 'MAP', 'BOX', 'KEY', 'FOX', 'JAM'];
  const w = pick(words);
  const code = (s) => s.split('').map(ch => {
    const i = ch.charCodeAt(0) - 65;
    return String.fromCharCode(65 + (atbash ? 25 - i : (i + 3) % 26));
  }).join('');
  const correct = code(w);
  const offByOne = w.split('').map((ch, j) => {
    const i = ch.charCodeAt(0) - 65;
    const v = atbash ? 25 - i : (i + 3) % 26;
    return String.fromCharCode(65 + ((v + (j === 0 ? 1 : 0)) % 26));
  }).join('');
  const randWord = () => Array.from({ length: w.length }, () => String.fromCharCode(65 + rint(0, 25))).join('');
  const m = mcStr(correct, [offByOne, code(w).split('').reverse().join(''), w, code(shuffle(w.split('')).join(''))], randWord);
  return {
    category: 'Logic', type: 'coding',
    promptHTML: `In a code, every letter is ${atbash ? 'replaced by its mirror in the alphabet (A↔Z, B↔Y …)' : 'shifted 3 places forward (A→D, B→E …)'}.<br>How is <b class="mono">${w}</b> written?`,
    ...m, explanation: `Apply the rule to each letter: ${w} → ${correct}.`,
  };
}

/* =======================================================================
   SPATIAL / INDUCTIVE  (colored SVG)
   ======================================================================= */

const ABC = ['A', 'B', 'C', 'D', 'E'];

function genOddOneOut() {
  const mode = pick(['color', 'shape', 'count', 'chirality']);
  // rotation-distinguishable shapes (exclude circle/square which look the same when turned)
  const shapes = ['triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'arrow', 'ell', 'flag'];
  const odd = rint(0, 4);
  // each tile gets a DISTINCT rotation (an irrelevant dimension) so the 4 "same" tiles
  // aren't pixel-identical — you must spot the actual rule, not a repeated image.
  const rots = shuffle([0, 36, 80, 145, 210, 270, 315]).slice(0, 5);
  let tiles = [], expl;

  if (mode === 'color') {
    const [c1, c2] = shuffle(COLOR_KEYS).slice(0, 2);
    const sh = pick(shapes);
    tiles = ABC.map((_, i) => tile({ shape: sh, color: PALETTE[i === odd ? c2 : c1], rotation: rots[i] }));
    expl = `Four shapes share one colour; the odd one is a different colour.`;
  } else if (mode === 'shape') {
    const [s1, s2] = shuffle(shapes).slice(0, 2);
    const col = PALETTE[pick(COLOR_KEYS)];
    tiles = ABC.map((_, i) => tile({ shape: i === odd ? s2 : s1, color: col, rotation: rots[i] }));
    expl = `Four tiles are the same shape; the odd one is a different shape.`;
  } else if (mode === 'count') {
    const base = pick([2, 3, 4]);
    let other = base + pick([1, -1, 2]); if (other < 1) other = base + 2;
    const col = PALETTE[pick(COLOR_KEYS)]; const sh = pick(['circle', 'square', 'triangle']);
    tiles = ABC.map((_, i) => dotsTile({ count: i === odd ? other : base, color: col, shape: sh, rotation: rots[i] }));
    expl = `Four tiles contain the same number of items; the odd one has a different count.`;
  } else { // chirality — 4 rotations of a chiral figure, 1 mirror image
    const rset = shuffle([0, 90, 180, 270]);
    const sh = pick(['ell', 'flag']);
    const col = PALETTE[pick(COLOR_KEYS)];
    let r = 0;
    tiles = ABC.map((_, i) => i === odd
      ? tile({ shape: sh, color: col, rotation: pick([0, 90, 180, 270]), mirror: true })
      : tile({ shape: sh, color: col, rotation: rset[r++] }));
    expl = `Four tiles are rotations of the same figure; the odd one is a mirror image (flipped).`;
  }

  return {
    category: 'Spatial', type: 'odd-one-out',
    promptHTML: `Which figure does <b>not</b> belong with the others?`,
    options: tiles, correct: odd, optionsHTML: true,
    explanation: `Option ${ABC[odd]} is the odd one. ${expl}`,
  };
}

function genMatrix() {
  // Arrow rotating a fixed step each cell, reading order; last cell missing.
  const step = pick([45, 90]);
  const base = pick([0, 45, 90, 135]);
  const col = PALETTE[pick(COLOR_KEYS)];
  const cells = [];
  for (let i = 0; i < 9; i++) cells.push(base + step * i);
  const missing = 8;
  const correctRot = ((cells[missing] % 360) + 360) % 360;

  // grid markup (8 arrows + a "?")
  let grid = '<div class="matrix-grid">';
  for (let i = 0; i < 9; i++) {
    grid += `<div class="matrix-cell">${i === missing ? '<span class="qmark">?</span>' : tile({ shape: 'arrow', color: col, rotation: cells[i], size: 64 })}</div>`;
  }
  grid += '</div>';

  const wrongPool = shuffle([45, 90, 135, 180, 225, 270, 315].map(d => (correctRot + d) % 360))
    .filter(r => r !== correctRot);
  const wrongs = [];
  for (const r of wrongPool) { if (wrongs.length >= 4) break; if (!wrongs.includes(r)) wrongs.push(r); }
  const optRots = shuffle([correctRot, ...wrongs]);
  return {
    category: 'Spatial', type: 'matrix',
    promptHTML: `The arrow turns by the same amount from each cell to the next. Which option completes the grid?${grid}`,
    options: optRots.map(r => tile({ shape: 'arrow', color: col, rotation: r })),
    correct: optRots.indexOf(correctRot), optionsHTML: true,
    explanation: `The arrow rotates ${step}° clockwise per cell, so the missing arrow points the same way as Option ${ABC[optRots.indexOf(correctRot)]}.`,
  };
}

function genRotation() {
  const sh = pick(['ell', 'flag']);
  const col = PALETTE[pick(COLOR_KEYS)];
  const baseRot = pick([0, 90, 180, 270]);
  const turn = pick([90, 180, 270]);
  const correctRot = (baseRot + turn) % 360;
  // distractors: reflections (mirror) + a wrong rotation
  const opts = shuffle([
    { rotation: correctRot, mirror: false, key: 'correct' },
    { rotation: correctRot, mirror: true, key: 'refl1' },
    { rotation: (correctRot + 90) % 360, mirror: true, key: 'refl2' },
    { rotation: (baseRot + (turn === 90 ? 270 : turn - 90)) % 360, mirror: false, key: 'wrongrot' },
    { rotation: (correctRot + 180) % 360, mirror: true, key: 'refl3' },
  ]);
  return {
    category: 'Spatial', type: 'rotation',
    promptHTML: `The figure on the left is the reference. Which option shows it rotated <b>${turn}° clockwise</b> (not flipped)?
      <div class="ref-row"><div class="ref-box">${tile({ shape: sh, color: col, rotation: baseRot })}<span class="ref-cap">reference</span></div></div>`,
    options: opts.map(o => tile({ shape: sh, color: col, rotation: o.rotation, mirror: o.mirror })),
    correct: opts.findIndex(o => o.key === 'correct'), optionsHTML: true,
    explanation: `Only one option is a pure rotation; the rest are mirror images (the figure is flipped, which rotation can never do).`,
  };
}

function genShapeSeries() {
  const mode = pick(['count', 'rotate']);
  const col = PALETTE[pick(COLOR_KEYS)];
  if (mode === 'count') {
    const start = pick([1, 2]); const sh = pick(['circle', 'square', 'triangle']);
    const seqCounts = [start, start + 1, start + 2, start + 3];
    const nextCount = start + 4;
    let row = '<div class="series-row">' + seqCounts.map(c => `<div class="series-cell">${dotsTile({ count: c, color: col, shape: sh, size: 60 })}</div>`).join('') + '<div class="series-cell qmark-cell"><span class="qmark">?</span></div></div>';
    const wrongPool = shuffle([nextCount + 1, nextCount - 1, nextCount - 2, nextCount + 2, start, nextCount + 3])
      .filter(c => c !== nextCount && c >= 1);
    const wrongs = []; for (const c of wrongPool) { if (wrongs.length >= 4) break; if (!wrongs.includes(c)) wrongs.push(c); }
    const opts = shuffle([nextCount, ...wrongs]);
    return {
      category: 'Spatial', type: 'series',
      promptHTML: `How does the series continue? Pick the next figure.${row}`,
      options: opts.map(c => dotsTile({ count: c, color: col, shape: sh })),
      correct: opts.indexOf(nextCount), optionsHTML: true,
      explanation: `The number of items increases by one each step → the next has ${nextCount}.`,
    };
  } else {
    const step = 45; const base = pick([0, 45, 90]);
    const seq = [0, 1, 2, 3].map(i => base + step * i);
    const nextRot = ((base + step * 4) % 360 + 360) % 360;
    let row = '<div class="series-row">' + seq.map(r => `<div class="series-cell">${tile({ shape: 'arrow', color: col, rotation: r, size: 60 })}</div>`).join('') + '<div class="series-cell qmark-cell"><span class="qmark">?</span></div></div>';
    const wrongPool = shuffle([45, 90, 135, 180, 225, 315].map(d => (nextRot + d) % 360)).filter(r => r !== nextRot);
    const wrongs = []; for (const r of wrongPool) { if (wrongs.length >= 4) break; if (!wrongs.includes(r)) wrongs.push(r); }
    const opts = shuffle([nextRot, ...wrongs]);
    return {
      category: 'Spatial', type: 'series',
      promptHTML: `How does the series continue? Pick the next figure.${row}`,
      options: opts.map(r => tile({ shape: 'arrow', color: col, rotation: r })),
      correct: opts.indexOf(nextRot), optionsHTML: true,
      explanation: `The arrow rotates ${step}° clockwise each step.`,
    };
  }
}

/* =======================================================================
   ATTENTION TO DETAIL
   ======================================================================= */

const CONFUSE = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
function randStr(hard = true) {
  const blocks = hard ? pick([3, 4]) : pick([2, 3]);
  const parts = [];
  for (let b = 0; b < blocks; b++) {
    const len = hard ? rint(4, 5) : rint(3, 4);
    let s = '';
    for (let i = 0; i < len; i++) s += CONFUSE[rint(0, CONFUSE.length - 1)];
    parts.push(s);
  }
  return parts.join('-');
}
function mutate(s) {
  const chars = s.split('');
  const idxs = chars.map((c, i) => c !== '-' ? i : -1).filter(i => i >= 0);
  // 45% of the time: TRANSPOSE two adjacent characters (very hard to spot); else substitute
  if (Math.random() < 0.45) {
    const adj = idxs.filter(i => idxs.includes(i + 1) && chars[i] !== chars[i + 1]);
    if (adj.length) { const i = pick(adj);[chars[i], chars[i + 1]] = [chars[i + 1], chars[i]]; return chars.join(''); }
  }
  const swaps = { O: '0', '0': 'O', I: 'l', l: 'I', '1': 'l', B: '8', '8': 'B', '5': 'S', S: '5', Z: '2', '2': 'Z', G: '6', '6': 'G' };
  const i = pick(idxs);
  const c = chars[i];
  chars[i] = swaps[c] || CONFUSE[(CONFUSE.indexOf(c) + 1 + CONFUSE.length) % CONFUSE.length];
  if (chars[i] === c) chars[i] = c === 'A' ? 'H' : 'A';
  return chars.join('');
}

function genExactMatch() {
  const ref = randStr();
  const wrongs = []; let g = 0;
  while (wrongs.length < 4 && g++ < 30) { const w = mutate(ref); if (w !== ref && !wrongs.includes(w)) wrongs.push(w); }
  const m = mcStr(ref, wrongs);
  return {
    category: 'Attention', type: 'exact-match',
    promptHTML: `Which option <b>exactly matches</b> the reference?<div class="mono big">${esc(ref)}</div>`,
    options: m.options.map(s => `<span class="mono">${s}</span>`), correct: m.correct, optionsHTML: true,
    explanation: `Only one option matches every character of <span class="mono">${esc(ref)}</span> exactly.`,
  };
}

function genCountIdentical() {
  const n = pick([4, 5]);
  let same = 0;
  const rows = [];
  for (let i = 0; i < n; i++) {
    const a = randStr();
    const identical = Math.random() < 0.5;
    const b = identical ? a : mutate(a);
    if (b === a) same++; else if (identical) same++;
    rows.push([a, b]);
  }
  // recompute truth precisely
  same = rows.filter(([a, b]) => a === b).length;
  const rowsHTML = '<table class="pairs"><tbody>' + rows.map(([a, b], i) =>
    `<tr><td class="pi">${i + 1}</td><td class="mono">${esc(a)}</td><td class="mono">${esc(b)}</td></tr>`).join('') + '</tbody></table>';
  // clean integer options drawn from the valid range 0..n (exactly 5)
  let pool = []; for (let v = 0; v <= n; v++) pool.push(v);
  while (pool.length > 5) { if (pool[0] !== same) pool.shift(); else pool.pop(); }
  const sh = shuffle(pool);
  return {
    category: 'Attention', type: 'count-identical',
    promptHTML: `How many of these pairs are <b>identical</b>?${rowsHTML}`,
    options: sh.map(String), correct: sh.indexOf(same),
    explanation: `${same} of the ${n} pairs match exactly.`,
  };
}

function genSpotDifferent() {
  const ref = randStr();
  const odd = rint(0, 4);
  const diff = mutate(ref);
  const opts = ABC.map((_, i) => (i === odd ? diff : ref));
  return {
    category: 'Attention', type: 'spot-different',
    promptHTML: `Four of these are identical. Which is the <b>odd one out</b>?`,
    options: opts.map(s => `<span class="mono">${esc(s)}</span>`), correct: odd, optionsHTML: true,
    explanation: `Option ${ABC[odd]} differs from the other four.`,
  };
}

/* =======================================================================
   HARDER NUMERICAL
   ======================================================================= */

function genCompoundInterest() {
  const [P, r] = pick([[8000, 10], [10000, 10], [12000, 5], [16000, 5], [20000, 5], [15000, 10]]);
  const A = Math.round(P * (1 + r / 100) ** 2);
  const ci = A - P, si = P * r * 2 / 100;
  const m = mc(ci, [si, A, P + si + r, ci + P * r * r / 10000], money);
  return {
    category: 'Numerical', type: 'compound-interest',
    promptHTML: `${money(P)} is invested at <b>${r}%</b> per annum, <b>compounded annually</b>. What is the total <b>interest</b> after 2 years?`,
    ...m, explanation: `Amount = ${money(P)} × ${1 + r / 100}² = ${money(A)}; interest = ${money(ci)} (vs ${money(si)} simple — the difference is interest-on-interest).`,
  };
}

function genMixture() {
  const [p1, v1, p2, v2] = pick([[20, 5, 50, 10], [20, 3, 45, 2], [10, 4, 40, 4], [30, 2, 50, 3], [20, 3, 70, 2], [25, 6, 55, 4]]);
  const conc = (p1 * v1 + p2 * v2) / (v1 + v2);
  const m = mc(conc, [(p1 + p2) / 2, p1 + p2, conc + 5, conc - 5], pct);
  return {
    category: 'Numerical', type: 'mixture',
    promptHTML: `<b>${v1} L</b> of a <b>${p1}%</b> solution is mixed with <b>${v2} L</b> of a <b>${p2}%</b> solution. What is the concentration of the mixture?`,
    ...m, explanation: `Total solute = ${p1}%×${v1} + ${p2}%×${v2} = ${(p1 * v1 + p2 * v2) / 100} L in ${v1 + v2} L → ${conc}%.`,
  };
}

function genSuccessiveDiscount() {
  const [d1, d2] = pick([[20, 10], [30, 10], [25, 20], [20, 20], [40, 10], [30, 20]]);
  const eq = Math.round((1 - (1 - d1 / 100) * (1 - d2 / 100)) * 100 * 100) / 100;
  const m = mc(eq, [d1 + d2, d1 + d2 - 1, eq + 2, eq - 2], pct);
  return {
    category: 'Numerical', type: 'successive-discount',
    promptHTML: `An item is given two successive discounts of <b>${d1}%</b> and then <b>${d2}%</b>. What single discount is this equivalent to?`,
    ...m, explanation: `Equivalent = 1 − (${1 - d1 / 100})(${1 - d2 / 100}) = ${eq}% (NOT ${d1 + d2}% — discounts don't simply add).`,
  };
}

function genBoatStream() {
  const [dist, t1, t2] = pick([[24, 2, 3], [20, 2, 4], [36, 3, 4], [30, 2, 5], [18, 2, 3]]);
  const D = dist / t1, U = dist / t2;
  const stream = (D - U) / 2, boat = (D + U) / 2;
  const askStream = Math.random() < 0.5;
  const correct = askStream ? stream : boat;
  const m = mc(correct, [askStream ? boat : stream, D, U, D - U]);
  return {
    category: 'Numerical', type: 'boat-stream',
    promptHTML: `A boat covers <b>${dist} km downstream</b> in <b>${t1} h</b> and the same distance <b>upstream</b> in <b>${t2} h</b>. Find the speed of the <b>${askStream ? 'stream' : 'boat in still water'}</b> (km/h).`,
    ...m, explanation: `Downstream = ${D}, upstream = ${U} km/h. Stream = (${D}−${U})/2 = ${stream}; boat = (${D}+${U})/2 = ${boat}.`,
  };
}

function genRelativeTrains() {
  const [l1, l2, s1, s2] = pick([[120, 80, 40, 32], [150, 100, 50, 40], [200, 100, 54, 36], [110, 90, 45, 27]]);
  const rel = (s1 + s2) * 5 / 18; // m/s
  const time = Math.round((l1 + l2) / rel * 100) / 100;
  const m = mc(time, [time + 2, time - 2, (l1 + l2) / (s1 * 5 / 18), time + 5]);
  return {
    category: 'Numerical', type: 'relative-trains',
    promptHTML: `Two trains, <b>${l1} m</b> and <b>${l2} m</b> long, move toward each other at <b>${s1} km/h</b> and <b>${s2} km/h</b>. How many <b>seconds</b> to completely cross each other?`,
    ...m, explanation: `Relative speed = ${s1 + s2} km/h = ${rel} m/s; time = ${l1 + l2} ÷ ${rel} = ${time} s.`,
  };
}

/* =======================================================================
   HARDER LOGIC
   ======================================================================= */

function evalNoDiv(nums, ops) {
  const n = [...nums], o = [...ops];
  for (let i = 0; i < o.length;) { if (o[i] === '×') { n[i] = n[i] * n[i + 1]; n.splice(i + 1, 1); o.splice(i, 1); } else i++; }
  let r = n[0];
  for (let i = 0; i < o.length; i++) r = o[i] === '+' ? r + n[i + 1] : r - n[i + 1];
  return r;
}
function genOperatorSub() {
  const printed = ['+', '−', '×'];
  const meaning = shuffle(['+', '-', '×']);
  const sym = { '+': '+', '-': '−', '×': '×' };
  const map = {}; printed.forEach((p, i) => map[p] = meaning[i]);
  const nums = [rint(4, 9), rint(2, 8), rint(2, 6), rint(2, 6)];
  const ops = [pick(printed), pick(printed), pick(printed)];
  const real = ops.map(p => map[p]);
  const val = evalNoDiv(nums, real);
  const naive = evalNoDiv(nums, ops.map(p => p === '−' ? '-' : p));
  const expr = `${nums[0]} ${ops[0]} ${nums[1]} ${ops[1]} ${nums[2]} ${ops[2]} ${nums[3]}`;
  const m = mc(val, [naive, val + rint(2, 6), val - rint(2, 6), -val]);
  return {
    category: 'Logic', type: 'operator-sub',
    promptHTML: `If <b>+</b> means ${sym[map['+']]}, <b>−</b> means ${sym[map['-']]}, and <b>×</b> means ${sym[map['×']]}, then:<div class="mono big">${expr} = ?</div>`,
    ...m, explanation: `Substitute the symbols → ${nums[0]} ${sym[map[ops[0]]]} ${nums[1]} ${sym[map[ops[1]]]} ${nums[2]} ${sym[map[ops[2]]]} ${nums[3]}, then apply ×-before-± = ${val}.`,
  };
}

function genInterleaved() {
  const a0 = rint(2, 6), aStep = pick([3, 4, 5]);
  const b0 = rint(4, 8), bMul = pick([2, 3]);
  const a = [a0, a0 + aStep, a0 + 2 * aStep, a0 + 3 * aStep];
  const b = [b0, b0 * bMul, b0 * bMul ** 2, b0 * bMul ** 3];
  const seq = [a[0], b[0], a[1], b[1], a[2], b[2], a[3]];
  const next = b[3];
  const m = mc(next, [a[3] + aStep, b[2] + bMul, next + b[2], a[3] * bMul]);
  return {
    category: 'Logic', type: 'interleaved-series',
    promptHTML: `Two series are interleaved. What comes next?<div class="mono big">${seq.join(',&nbsp; ')},&nbsp; ?</div>`,
    ...m, explanation: `Odd positions add ${aStep} each time; even positions (the one asked) multiply by ${bMul}: ${b.join(', ')} → ${next}.`,
  };
}

function genSyllogism() {
  const nouns = shuffle(['poets', 'doctors', 'metals', 'flowers', 'engineers', 'planets', 'birds', 'rivers', 'novels', 'lions']);
  const [A, B, C] = nouns;
  const forms = [
    { p: [`All ${A} are ${B}.`, `All ${B} are ${C}.`], c: `All ${A} are ${C}.`, w: [`All ${C} are ${A}.`, `No ${A} are ${C}.`, `Some ${A} are not ${C}.`, `Some ${C} are not ${A}.`] },
    { p: [`All ${A} are ${B}.`, `No ${B} are ${C}.`], c: `No ${A} are ${C}.`, w: [`Some ${A} are ${C}.`, `All ${C} are ${A}.`, `All ${A} are ${C}.`, `Some ${C} are ${A}.`] },
    { p: [`Some ${A} are ${B}.`, `All ${B} are ${C}.`], c: `Some ${A} are ${C}.`, w: [`All ${A} are ${C}.`, `No ${A} are ${C}.`, `Some ${C} are not ${A}.`, `All ${C} are ${A}.`] },
    { p: [`All ${A} are ${B}.`, `Some ${B} are ${C}.`], c: `None of these necessarily follows.`, w: [`Some ${A} are ${C}.`, `All ${A} are ${C}.`, `No ${A} are ${C}.`, `Some ${C} are not ${A}.`] },
  ];
  const f = pick(forms);
  const m = mcStr(f.c, f.w);  // 4 distinct wrongs → 5 options, no filler needed
  return {
    category: 'Logic', type: 'syllogism',
    promptHTML: `Read the statements:<div class="syllo">“${f.p[0]} ${f.p[1]}”</div>Which conclusion <b>must</b> be true?`,
    ...m, explanation: `Valid conclusion: <b>${f.c}</b>. The others don't necessarily follow from the premises.`,
  };
}

function genMirrorClock() {
  const h = rint(1, 11), m = pick([0, 10, 15, 20, 30, 40, 45, 50]);
  const real = (h % 12) * 60 + m;
  const view = (720 - real) % 720;
  const fmt = (min) => { let hh = Math.floor(min / 60) % 12; if (hh === 0) hh = 12; return `${hh}:${String(min % 60).padStart(2, '0')}`; };
  const opts = mcStr(fmt(real), [fmt((view) % 720), fmt((real + 60) % 720), fmt((720 - real + 60) % 720), fmt((real + 30) % 720)], () => fmt(rint(0, 719)));
  return {
    category: 'Logic', type: 'mirror-clock',
    promptHTML: `A clock seen <b>in a mirror</b> shows the time as <b class="mono">${fmt(view)}</b>. What is the <b>actual</b> time?`,
    ...opts, explanation: `Actual = 11:60 − mirror time = ${fmt(real)}. (Mirror reflects across the 12–6 line.)`,
  };
}

function genBloodRelation() {
  const bank = [
    { q: `Pointing to a man, a woman says: “His mother is the only daughter of my mother.” How is the woman related to the man?`, a: 'Mother', w: ['Sister', 'Aunt', 'Grandmother', 'Cousin'], e: `The only daughter of her mother is the woman herself, so she is the man's mother.` },
    { q: `Pointing to a girl, Rahul says: “She is the daughter of my mother's only son.” How is the girl related to Rahul?`, a: 'Daughter', w: ['Sister', 'Niece', 'Cousin', 'Mother'], e: `His mother's only son is Rahul himself, so the girl is his daughter.` },
    { q: `A is the brother of B. B is the brother of C. C is the father of D. How is A related to D?`, a: 'Uncle', w: ['Father', 'Brother', 'Grandfather', 'Cousin'], e: `A and C are brothers; C is D's father, so A is D's uncle.` },
    { q: `P is the mother of Q. Q is the daughter of R. How is R related to P?`, a: 'Husband', w: ['Father', 'Brother', 'Son', 'Uncle'], e: `Q's parents are P (mother) and R; R is therefore P's husband.` },
  ];
  const b = pick(bank);
  const m = mcStr(b.a, b.w);
  return { category: 'Logic', type: 'blood-relation', promptHTML: b.q, ...m, explanation: b.e };
}

function genDirection() {
  const a = rint(3, 7);
  let b = rint(3, 8); while (b === a) b = rint(3, 8);   // keep the a-km and b-km decoys distinct
  const headings = ['North', 'East', 'South', 'West'];
  const vecs = { North: [0, 1], East: [1, 0], South: [0, -1], West: [-1, 0] };
  const start = rint(0, 3);
  const afterRight = (start + 1) % 4;            // two right turns reverse leg1↔leg3 → net = leg2
  const dir = headings[afterRight];
  const m = mcStr(`${b} km ${dir}`, headings.filter(h => h !== dir).map(h => `${b} km ${h}`).concat([`${a} km ${dir}`]));
  return {
    category: 'Logic', type: 'direction',
    promptHTML: `A person walks <b>${a} km ${headings[start]}</b>, turns <b>right</b> and walks <b>${b} km</b>, then turns <b>right</b> and walks <b>${a} km</b>. How far and in which direction are they from the start?`,
    ...m, explanation: `The first and third legs (both ${a} km, opposite directions after two right turns) cancel; the net displacement is the middle leg: ${b} km ${dir}.`,
  };
}

function genGridNumber() {
  const rules = [
    { f: (a, b) => a + b, t: 'third = first + second' },
    { f: (a, b) => a * b, t: 'third = first × second' },
    { f: (a, b) => a * b - b, t: 'third = (first × second) − second' },
    { f: (a, b) => 2 * a + b, t: 'third = 2×first + second' },
    { f: (a, b) => a * b + a, t: 'third = first × second + first' },
  ];
  const r = pick(rules);
  const rows = [0, 1, 2].map(() => { const a = rint(2, 9), b = rint(2, 6); return [a, b, r.f(a, b)]; });
  const hide = rint(0, 2);
  const correct = rows[hide][2];
  let grid = '<table class="numgrid"><tbody>' + rows.map((row, ri) =>
    '<tr>' + row.map((v, ci) => `<td>${ri === hide && ci === 2 ? '<span class="qmark">?</span>' : v}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
  const m = mc(correct, [rows[hide][0] + rows[hide][1], rows[hide][0] * rows[hide][1], correct + rint(1, 4), correct - rint(1, 4)]);
  return {
    category: 'Logic', type: 'grid-number',
    promptHTML: `In each row, the third number follows the same rule. Find the missing number.${grid}`,
    ...m, explanation: `The rule is “${r.t}”. So the missing value is ${correct}.`,
  };
}

/* =======================================================================
   HARDER SPATIAL (two attributes change at once)
   ======================================================================= */

function genMatrixColorRot() {
  const step = pick([45, 90]);
  const base = pick([0, 45, 90]);
  const cols = shuffle(COLOR_KEYS).slice(0, 3).map(k => PALETTE[k]);
  const cellRot = (i) => ((base + step * i) % 360 + 360) % 360;
  const cellCol = (i) => cols[i % 3];             // colour depends on column
  let grid = '<div class="matrix-grid">';
  for (let i = 0; i < 9; i++) grid += `<div class="matrix-cell">${i === 8 ? '<span class="qmark">?</span>' : tile({ shape: 'arrow', color: cellCol(i), rotation: cellRot(i), size: 60 })}</div>`;
  grid += '</div>';
  const cRot = cellRot(8), cCol = cellCol(8), wCol = cols[(8 % 3 + 1) % 3];
  const variants = shuffle([
    { rotation: cRot, color: cCol, key: 'correct' },
    { rotation: cRot, color: wCol, key: 'w1' },
    { rotation: (cRot + step) % 360, color: cCol, key: 'w2' },
    { rotation: (cRot + 180) % 360, color: wCol, key: 'w3' },
    { rotation: (cRot - step + 360) % 360, color: cCol, key: 'w4' },
  ]);
  return {
    category: 'Spatial', type: 'matrix-2attr',
    promptHTML: `Both the <b>direction</b> and the <b>colour</b> follow a rule across the grid. Which option completes it?${grid}`,
    options: variants.map(v => tile({ shape: 'arrow', color: v.color, rotation: v.rotation })),
    correct: variants.findIndex(v => v.key === 'correct'), optionsHTML: true,
    explanation: `The arrow rotates ${step}° per cell AND the colour repeats by column — the missing cell must match BOTH.`,
  };
}

function genInductiveRow() {
  const cols = shuffle(COLOR_KEYS).slice(0, 3).map(k => PALETTE[k]);
  const sh = pick(['circle', 'square', 'triangle']);
  const seq = [1, 2, 3, 4];
  let row = '<div class="series-row">' + seq.map((c, i) => `<div class="series-cell">${dotsTile({ count: c, color: cols[i % 3], shape: sh, size: 58 })}</div>`).join('') + '<div class="series-cell qmark-cell"><span class="qmark">?</span></div></div>';
  const nC = 5, nCol = cols[4 % 3];
  const variants = shuffle([
    { count: nC, color: nCol, key: 'correct' },
    { count: nC, color: cols[(4 % 3 + 1) % 3], key: 'w1' },
    { count: 4, color: nCol, key: 'w2' },
    { count: nC + 1, color: nCol, key: 'w3' },
    { count: nC, color: cols[(4 % 3 + 2) % 3], key: 'w4' },
  ]);
  return {
    category: 'Spatial', type: 'inductive-row',
    promptHTML: `Both the <b>number of items</b> and the <b>colour</b> change in a pattern. Pick the next figure.${row}`,
    options: variants.map(v => dotsTile({ count: v.count, color: v.color, shape: sh })),
    correct: variants.findIndex(v => v.key === 'correct'), optionsHTML: true,
    explanation: `The count increases by one each step (→ ${nC}) and the colours cycle through three — the next must match both.`,
  };
}

/* =======================================================================
   HARDER ATTENTION
   ======================================================================= */

function genCountDifferences() {
  const a = randStr(true);
  const chars = a.split('');
  const idxs = chars.map((c, i) => c !== '-' ? i : -1).filter(i => i >= 0);
  const t = Math.min(rint(1, 4), idxs.length);   // exactly t single-char changes → count always 0..4
  const chosen = shuffle(idxs).slice(0, t);
  const sw = { O: '0', '0': 'O', I: 'l', l: 'I', '1': 'l', B: '8', '8': 'B', '5': 'S', S: '5', Z: '2', '2': 'Z', G: '6', '6': 'G' };
  const b = [...chars];
  for (const i of chosen) {
    const c = b[i];
    let nc = sw[c] || CONFUSE[(CONFUSE.indexOf(c) + 1 + CONFUSE.length) % CONFUSE.length];
    if (nc === c) nc = c === 'A' ? 'H' : 'A';
    b[i] = nc;
  }
  const bs = b.join('');
  let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== bs[i]) d++;
  const pool = [0, 1, 2, 3, 4];
  const sh = shuffle(pool);
  return {
    category: 'Attention', type: 'count-differences',
    promptHTML: `How many character positions <b>differ</b> between these two strings?<div class="mono big">${esc(a)}<br>${esc(bs)}</div>`,
    options: sh.map(String), correct: sh.indexOf(d),
    explanation: `${d} position(s) differ between the two strings.`,
  };
}

/* =======================================================================
   DATA INTERPRETATION  (bar / line / pie / table — numerical)
   ======================================================================= */

function genBarChart() {
  const ctx = pick([
    { t: 'Monthly sales (units)', l: ['Jan', 'Feb', 'Mar', 'Apr', 'May'] },
    { t: 'Branch revenue (₹ lakh)', l: ['A', 'B', 'C', 'D'] },
    { t: 'Daily visitors (hundreds)', l: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
    { t: 'Units produced', l: ['Q1', 'Q2', 'Q3', 'Q4'] },
  ]);
  const n = ctx.l.length;
  let vals, guard = 0;
  do { vals = ctx.l.map(() => rint(2, 9) * 10); guard++; }
  while (guard < 30 && (new Set(vals).size < n)); // unique values → unambiguous max/min
  const chart = `<div class="chart-title">${ctx.t}</div>${barChart(ctx.l, vals)}`;
  const sum = vals.reduce((a, b) => a + b, 0);
  const maxI = vals.indexOf(Math.max(...vals)), minI = vals.indexOf(Math.min(...vals));
  const mode = pick(['diff', 'total', 'highest', 'lowest', 'range', 'combined', 'pct']);

  if (mode === 'highest' || mode === 'lowest') {
    const idx = mode === 'highest' ? maxI : minI;
    const m = mcStr(ctx.l[idx], ctx.l.filter((_, i) => i !== idx));
    return { category: 'Numerical', type: 'bar-chart', promptHTML: `${chart}<p>Which has the <b>${mode}</b> value?</p>`, ...m, explanation: `${ctx.l[idx]} = ${vals[idx]} is the ${mode}.` };
  }
  let i = rint(0, n - 1), j = rint(0, n - 1); while (j === i) j = rint(0, n - 1);
  let correct, q, wrongs, expl;
  if (mode === 'diff') { correct = Math.abs(vals[i] - vals[j]); q = `By how much do <b>${ctx.l[i]}</b> and <b>${ctx.l[j]}</b> differ?`; wrongs = [vals[i] + vals[j], correct + 10, correct - 10, sum]; expl = `|${vals[i]} − ${vals[j]}| = ${correct}.`; }
  else if (mode === 'total') { correct = sum; q = `What is the <b>total</b> of all bars?`; wrongs = [sum - 10, sum + 10, sum - vals[0], Math.round(sum / n)]; expl = `${vals.join(' + ')} = ${sum}.`; }
  else if (mode === 'range') { correct = vals[maxI] - vals[minI]; q = `What is the difference between the <b>highest</b> and <b>lowest</b> bars?`; wrongs = [vals[maxI] + vals[minI], correct + 10, correct - 10, vals[maxI]]; expl = `${vals[maxI]} − ${vals[minI]} = ${correct}.`; }
  else if (mode === 'combined') { correct = vals[i] + vals[j]; q = `What is the <b>combined</b> value of <b>${ctx.l[i]}</b> and <b>${ctx.l[j]}</b>?`; wrongs = [Math.abs(vals[i] - vals[j]), correct + 10, correct - 10, sum]; expl = `${vals[i]} + ${vals[j]} = ${correct}.`; }
  else { correct = Math.round(vals[i] / sum * 100); q = `Approximately what <b>percentage of the total</b> does <b>${ctx.l[i]}</b> represent?`; wrongs = [Math.round(vals[i] / sum * 100) + 5, Math.round(vals[i] / sum * 100) - 5, Math.round(vals[j] / sum * 100), Math.round(100 / n)]; expl = `${vals[i]} ÷ ${sum} ≈ ${correct}%.`; return { category: 'Numerical', type: 'bar-chart', promptHTML: `${chart}<p>${q}</p>`, ...mc(correct, wrongs, pct), explanation: expl }; }
  return { category: 'Numerical', type: 'bar-chart', promptHTML: `${chart}<p>${q}</p>`, ...mc(correct, wrongs), explanation: expl };
}

function genLineChart() {
  const ctx = pick([
    { t: 'Website signups (per week)', l: ['W1', 'W2', 'W3', 'W4', 'W5'] },
    { t: 'Temperature (°C)', l: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
    { t: 'Revenue (₹ lakh)', l: ['2020', '2021', '2022', '2023', '2024'] },
  ]);
  const n = ctx.l.length;
  const vals = ctx.l.map(() => rint(2, 9) * 10);
  const chart = `<div class="chart-title">${ctx.t}</div>${lineChart(ctx.l, vals)}`;
  const diffs = vals.slice(1).map((v, i) => v - vals[i]);
  const mode = pick(['biggestRise', 'biggestFall', 'change', 'total', 'peak']);

  if (mode === 'biggestRise' || mode === 'biggestFall') {
    const target = mode === 'biggestRise' ? Math.max(...diffs) : Math.min(...diffs);
    const idx = diffs.indexOf(target);
    const labelOf = (k) => `${ctx.l[k]}→${ctx.l[k + 1]}`;
    const correct = labelOf(idx);
    const m = mcStr(correct, diffs.map((_, k) => labelOf(k)).filter(s => s !== correct));
    return { category: 'Numerical', type: 'line-chart', promptHTML: `${chart}<p>Between which two consecutive points was the <b>${mode === 'biggestRise' ? 'largest increase' : 'largest decrease'}</b>?</p>`, ...m, explanation: `${correct} changes by ${target}, the ${mode === 'biggestRise' ? 'biggest rise' : 'biggest fall'}.` };
  }
  if (mode === 'peak') {
    let mx = vals.indexOf(Math.max(...vals)); if (vals.filter(v => v === vals[mx]).length > 1) return genLineChart();
    const m = mcStr(ctx.l[mx], ctx.l.filter((_, i) => i !== mx));
    return { category: 'Numerical', type: 'line-chart', promptHTML: `${chart}<p>At which point was the value <b>highest</b>?</p>`, ...m, explanation: `${ctx.l[mx]} = ${vals[mx]} is the peak.` };
  }
  if (mode === 'total') { const sum = vals.reduce((a, b) => a + b, 0); return { category: 'Numerical', type: 'line-chart', promptHTML: `${chart}<p>What is the <b>total</b> across all points?</p>`, ...mc(sum, [sum - 10, sum + 10, sum - vals[0], Math.round(sum / n)]), explanation: `Sum = ${sum}.` }; }
  // change between two points (signed → ask net change with direction baked into sign)
  let i = rint(0, n - 2), j = i + rint(1, n - 1 - i);
  const correct = vals[j] - vals[i];
  return { category: 'Numerical', type: 'line-chart', promptHTML: `${chart}<p>What is the <b>net change</b> from <b>${ctx.l[i]}</b> to <b>${ctx.l[j]}</b>? (a fall is negative)</p>`, ...mc(correct, [-correct, correct + 10, correct - 10, Math.abs(correct)]), explanation: `${vals[j]} − ${vals[i]} = ${correct}.` };
}

function genPieChart() {
  const dist = pick([[40, 30, 20, 10], [50, 20, 20, 10], [30, 30, 20, 20], [50, 30, 10, 10], [40, 25, 20, 15], [35, 30, 25, 10]]);
  const cats = shuffle(['Marketing', 'Salaries', 'R&D', 'Operations', 'Logistics', 'Admin', 'Sales', 'Support']).slice(0, 4);
  const order = shuffle(dist);
  const cols = shuffle(COLOR_KEYS).slice(0, 4).map(k => PALETTE[k]);
  const segs = cats.map((c, i) => ({ label: c, value: order[i], color: cols[i] }));
  const total = pick([200, 250, 300, 400, 500]);
  const chart = `<div class="chart-title">Budget breakdown (total = ${total.toLocaleString('en-IN')})</div>${pieChart(segs)}`;
  const cnt = (s) => Math.round(s.value / 100 * total);
  const mode = pick(['count', 'combined', 'diff', 'ratio']);
  let i = rint(0, 3), j = rint(0, 3); while (j === i) j = rint(0, 3);

  if (mode === 'count') return { category: 'Numerical', type: 'pie-chart', promptHTML: `${chart}<p>How much is allocated to <b>${segs[i].label}</b>?</p>`, ...mc(cnt(segs[i]), [cnt(segs[j]), cnt(segs[i]) + total / 10, segs[i].value, cnt(segs[i]) - total / 10]), explanation: `${segs[i].value}% × ${total} = ${cnt(segs[i])}.` };
  if (mode === 'combined') return { category: 'Numerical', type: 'pie-chart', promptHTML: `${chart}<p>What is the <b>combined</b> amount for <b>${segs[i].label}</b> and <b>${segs[j].label}</b>?</p>`, ...mc(cnt(segs[i]) + cnt(segs[j]), [Math.abs(cnt(segs[i]) - cnt(segs[j])), cnt(segs[i]) + cnt(segs[j]) + total / 10, total, segs[i].value + segs[j].value]), explanation: `(${segs[i].value}+${segs[j].value})% × ${total} = ${cnt(segs[i]) + cnt(segs[j])}.` };
  if (mode === 'diff') return { category: 'Numerical', type: 'pie-chart', promptHTML: `${chart}<p>How much <b>more</b> is spent on the largest category than the smallest?</p>`, ...mc(Math.round((Math.max(...order) - Math.min(...order)) / 100 * total), [Math.round((Math.max(...order) + Math.min(...order)) / 100 * total), Math.max(...order) - Math.min(...order), total / 2, Math.round(Math.max(...order) / 100 * total)]), explanation: `(${Math.max(...order)}−${Math.min(...order)})% × ${total} = ${Math.round((Math.max(...order) - Math.min(...order)) / 100 * total)}.` };
  // ratio
  const g = (a, b) => b ? g(b, a % b) : a; const d = g(segs[i].value, segs[j].value);
  const correct = `${segs[i].value / d} : ${segs[j].value / d}`;
  const m = mcStr(correct, [`${segs[i].value} : ${segs[j].value}`, `${segs[j].value / d} : ${segs[i].value / d}`, `1 : ${Math.round(segs[j].value / segs[i].value)}`, `${segs[i].value / d + 1} : ${segs[j].value / d}`]);
  return { category: 'Numerical', type: 'pie-chart', promptHTML: `${chart}<p>What is the <b>ratio</b> of ${segs[i].label} to ${segs[j].label} (simplest form)?</p>`, ...m, explanation: `${segs[i].value} : ${segs[j].value} simplifies to ${correct}.` };
}

function genTable() {
  const rows = ['North', 'South', 'East'];
  const cols = ['Q1', 'Q2', 'Q3'];
  const data = rows.map(() => cols.map(() => rint(2, 9) * 10));
  let tbl = '<table class="dtable"><thead><tr><th></th>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>'
    + rows.map((r, i) => `<tr><th>${r}</th>${data[i].map(v => `<td>${v}</td>`).join('')}</tr>`).join('') + '</tbody></table>';
  const rowSum = (i) => data[i].reduce((a, b) => a + b, 0);
  const colSum = (j) => data.reduce((a, row) => a + row[j], 0);
  const mode = pick(['rowTotal', 'colTotal', 'bestRow', 'cellDiff']);
  if (mode === 'rowTotal') { const i = rint(0, 2); return { category: 'Numerical', type: 'table', promptHTML: `<div class="chart-title">Sales by region (units)</div>${tbl}<p>What is the total for <b>${rows[i]}</b>?</p>`, ...mc(rowSum(i), [rowSum((i + 1) % 3), rowSum(i) + 10, rowSum(i) - 10, colSum(0)]), explanation: `${data[i].join(' + ')} = ${rowSum(i)}.` }; }
  if (mode === 'colTotal') { const j = rint(0, 2); return { category: 'Numerical', type: 'table', promptHTML: `<div class="chart-title">Sales by region (units)</div>${tbl}<p>What is the total for <b>${cols[j]}</b> (all regions)?</p>`, ...mc(colSum(j), [colSum((j + 1) % 3), colSum(j) + 10, colSum(j) - 10, rowSum(0)]), explanation: `${data.map(r => r[j]).join(' + ')} = ${colSum(j)}.` }; }
  if (mode === 'bestRow') { const totals = rows.map((_, i) => rowSum(i)); let mx = totals.indexOf(Math.max(...totals)); if (totals.filter(t => t === totals[mx]).length > 1) return genTable(); const m = mcStr(rows[mx], rows.filter((_, i) => i !== mx)); return { category: 'Numerical', type: 'table', promptHTML: `<div class="chart-title">Sales by region (units)</div>${tbl}<p>Which region had the <b>highest total</b> sales?</p>`, ...m, explanation: `${rows[mx]} totals ${totals[mx]}, the highest.` }; }
  const i = rint(0, 2), j = rint(0, 2), i2 = rint(0, 2), j2 = rint(0, 2);
  const correct = Math.abs(data[i][j] - data[i2][j2]);
  return { category: 'Numerical', type: 'table', promptHTML: `<div class="chart-title">Sales by region (units)</div>${tbl}<p>What is the difference between <b>${rows[i]} ${cols[j]}</b> and <b>${rows[i2]} ${cols[j2]}</b>?</p>`, ...mc(correct, [data[i][j] + data[i2][j2], correct + 10, correct - 10, rowSum(i)]), explanation: `|${data[i][j]} − ${data[i2][j2]}| = ${correct}.` };
}

/* =======================================================================
   HARDER LOGIC (compound / non-obvious)
   ======================================================================= */

function genSeriesHard() {
  const mode = pick(['sq', 'prime', 'mulc']);
  let seq = [], next, expl;
  if (mode === 'sq') {
    const s = rint(1, 6), g = [1, 4, 9, 16, 25]; let v = s; seq = [s];
    for (let i = 0; i < 4; i++) { v += g[i]; seq.push(v); } next = v + g[4];
    expl = `Add consecutive perfect squares: +1, +4, +9, +16, then +25.`;
  } else if (mode === 'prime') {
    const s = rint(2, 7), g = [2, 3, 5, 7, 11]; let v = s; seq = [s];
    for (let i = 0; i < 4; i++) { v += g[i]; seq.push(v); } next = v + g[4];
    expl = `Add successive prime numbers: +2, +3, +5, +7, then +11.`;
  } else {
    const s = rint(2, 4), k = 3, c = pick([1, 2]); let v = s; seq = [s];
    for (let i = 0; i < 4; i++) { v = v * k + c; seq.push(v); } next = seq[seq.length - 1] * k + c;
    expl = `Each term is the previous × ${k}, then + ${c}.`;
  }
  const m = mc(next, [next + rint(2, 9), next - rint(2, 9), seq[4] + (seq[4] - seq[3]), Math.round(next * 1.15)]);
  return {
    category: 'Logic', type: 'series-hard',
    promptHTML: `What comes next?<div class="mono big">${seq.join(',&nbsp; ')},&nbsp; ?</div>`,
    ...m, explanation: `${seq.join(', ')} → ${next}. ${expl}`,
  };
}

function genAlphaNumSeries() {
  const L = (n) => String.fromCharCode(65 + ((n % 26) + 26) % 26);
  let lpos = rint(0, 3), g = 2; const lets = [lpos];
  for (let i = 0; i < 3; i++) { lpos += g; lets.push(lpos); g++; }
  const nextL = lpos + g;
  const nums = [2, 4, 8, 16], nextN = 32;
  const seqStr = lets.map((p, i) => `${L(p)}${nums[i]}`).join(',&nbsp; ');
  const correct = `${L(nextL)}${nextN}`;
  const m = mcStr(correct, [`${L(nextL - 1)}${nextN}`, `${L(nextL)}24`, `${L(nextL + 1)}${nextN}`, `${L(nextL)}${nextN * 2}`],
    () => `${L(rint(0, 25))}${pick([6, 12, 20, 24, 48, 64])}`);
  return {
    category: 'Logic', type: 'alphanumeric-series',
    promptHTML: `What comes next? (letters and numbers each follow their own rule)<div class="mono big">${seqStr},&nbsp; ?</div>`,
    ...m, explanation: `Letters skip by +2, +3, +4, +5 (→ ${L(nextL)}); numbers double each step (→ ${nextN}). Answer: ${correct}.`,
  };
}

function genCodingHard() {
  const words = ['CAT', 'DOG', 'MAPS', 'LION', 'STAR', 'FROG', 'BIRD'];
  const w = pick(words);
  const shift = (ch, by) => String.fromCharCode(65 + ((ch.charCodeAt(0) - 65 + by) % 26));
  const code = (s) => s.split('').map((ch, i) => shift(ch, i + 1)).join('');
  const caesar = (s) => s.split('').map(ch => shift(ch, 1)).join('');
  const correct = code(w);
  const filler = () => Array.from({ length: w.length }, () => String.fromCharCode(65 + rint(0, 25))).join('');
  const m = mcStr(correct, [caesar(w), correct.split('').reverse().join(''), w, code(w.split('').reverse().join(''))], filler);
  return {
    category: 'Logic', type: 'coding-hard',
    promptHTML: `In a code, each letter is shifted forward by its <b>position</b> (1st letter +1, 2nd +2, 3rd +3 …).<br>How is <b class="mono">${w}</b> written?`,
    ...m, explanation: `${w.split('').map((c, i) => `${c}+${i + 1}`).join(', ')} → ${correct}.`,
  };
}

/* =======================================================================
   ABSTRACT / MULTI-RULE SPATIAL  (distribution-of-three, compound series,
   visual analogy — the genuinely hard SHL-matrix mechanics)
   ======================================================================= */

// Authentic SHL "complete the series": a row of 5 panels, each with THREE elements
// following independent rules (rotation + translation + shading). Pick the 6th from 5.
function genSHLSeries() {
  const color = PALETTE[pick(COLOR_KEYS)];
  const step = pick([45, 90]);
  const base = pick([0, 45, 90]);
  const dotBase = rint(0, 3);
  const dotDir = pick([1, 3]);                 // +1 clockwise, +3 (=−1) anticlockwise around 4 corners
  const shadeBase = pick([true, false]);
  const stateAt = (i) => ({
    rot: (((base + step * i) % 360) + 360) % 360,
    dotPos: (((dotBase + dotDir * i) % 4) + 4) % 4,
    shaded: (i % 2 === 0) ? shadeBase : !shadeBase,
  });
  let row = '<div class="panel-row">';
  for (let i = 0; i < 5; i++) row += `<div class="panel-cell">${panel({ ...stateAt(i), color, size: 70 })}</div>`;
  row += '<div class="panel-cell qmark-cell"><span class="qmark">?</span></div></div>';
  const ans = stateAt(5);
  const sig = (s) => `${s.rot}|${s.dotPos}|${s.shaded}`;
  const cand = [
    ans,
    { ...ans, rot: (ans.rot + step) % 360 },                       // rotation wrong
    { ...ans, dotPos: (ans.dotPos + 1) % 4 },                      // dot wrong
    { ...ans, shaded: !ans.shaded },                               // shading wrong
    { ...ans, rot: (ans.rot + 180) % 360, dotPos: (ans.dotPos + 2) % 4 }, // two wrong
  ];
  const opts = []; const seen = new Set();
  for (const c of cand) { const k = sig(c); if (opts.length < 5 && !seen.has(k)) { seen.add(k); opts.push(c); } }
  let g = 0;
  while (opts.length < 5 && g++ < 30) { const c = { rot: pick([0, 45, 90, 135, 180, 225, 270, 315]), dotPos: rint(0, 3), shaded: pick([true, false]) }; const k = sig(c); if (!seen.has(k)) { seen.add(k); opts.push(c); } }
  const shf = shuffle(opts);
  return {
    category: 'Spatial', type: 'shl-series',
    promptHTML: `Each box changes by a fixed set of rules. Work out the rule for <b>each element separately</b>, then choose the box that comes next.${row}`,
    options: shf.map(s => panel({ ...s, color })),
    correct: shf.findIndex(s => sig(s) === sig(ans)), optionsHTML: true,
    explanation: `Three rules run at once → the arrow turns ${step}° each step; the dot moves one corner ${dotDir === 1 ? 'clockwise' : 'anticlockwise'} each step; and the fill alternates solid/hollow. Combine all three for the next box.`,
  };
}

function genAbstractMatrix() {
  const shapes = shuffle(['triangle', 'square', 'circle', 'diamond', 'pentagon', 'hexagon', 'star']).slice(0, 3);
  const colors = shuffle(COLOR_KEYS).slice(0, 3).map(k => PALETTE[k]);
  const attr = {
    shape: { vals: shapes, shift: pick([1, 2]), perm: shuffle([0, 1, 2]) },
    color: { vals: colors, shift: pick([1, 2]), perm: shuffle([0, 1, 2]) },
    count: { vals: shuffle([1, 2, 3]), shift: pick([1, 2]), perm: shuffle([0, 1, 2]) },
  };
  const at = (a, i, j) => a.vals[a.perm[(((i + a.shift * j) % 3) + 3) % 3]];
  const cell = (i, j) => ({ shape: at(attr.shape, i, j), color: at(attr.color, i, j), count: at(attr.count, i, j) });
  let grid = '<div class="matrix-grid abstract">';
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    grid += (i === 2 && j === 2)
      ? `<div class="matrix-cell"><span class="qmark">?</span></div>`
      : `<div class="matrix-cell">${dotsTile({ ...cell(i, j), size: 56 })}</div>`;
  }
  grid += '</div>';
  const correct = cell(2, 2);
  const sig = (c) => `${c.count}|${c.shape}|${c.color}`;
  const other = (key) => pick(attr[key].vals.filter(v => v !== correct[key]));
  // One distractor wrong on EACH attribute (so every rule is a discriminator) + one wrong on two.
  const two = shuffle(['shape', 'color', 'count']).slice(0, 2);
  const d4 = { ...correct }; for (const key of two) d4[key] = other(key);
  const ds = [{ ...correct, shape: other('shape') }, { ...correct, color: other('color') }, { ...correct, count: other('count') }, d4];
  const opts = [correct]; const seen = new Set([sig(correct)]);
  for (const c of ds) { if (opts.length >= 5) break; if (!seen.has(sig(c))) { seen.add(sig(c)); opts.push(c); } }
  let guard = 0;
  while (opts.length < 5 && guard++ < 30) { const c = { count: pick([1, 2, 3]), shape: pick(attr.shape.vals), color: pick(attr.color.vals) }; if (!seen.has(sig(c))) { seen.add(sig(c)); opts.push(c); } }
  const sh = shuffle(opts);
  return {
    category: 'Spatial', type: 'abstract-matrix',
    promptHTML: `<b>Shape</b>, <b>colour</b> and <b>number</b> each follow their own rule — each value appears once per row and once per column. Which option completes the grid?${grid}`,
    options: sh.map(c => dotsTile({ ...c, size: 78 })),
    correct: sh.findIndex(c => sig(c) === sig(correct)), optionsHTML: true,
    explanation: `In every row and column the three shapes, the three colours and the counts 1–3 each appear exactly once (“distribution of three”). The only cell that satisfies all three at once is the answer: ${correct.count} item(s) of the remaining shape & colour.`,
  };
}

function genSeriesCompound() {
  const colors = shuffle(COLOR_KEYS).slice(0, 3).map(k => PALETTE[k]);
  if (Math.random() < 0.5) {
    const sh = pick(['arrow', 'ell', 'flag']);
    const step = pick([45, 90]), base = pick([0, 45, 90]);
    const frame = (i) => ({ rot: (((base + step * i) % 360) + 360) % 360, color: colors[i % 3] });
    const row = '<div class="series-row">' + [0, 1, 2, 3].map(i => { const f = frame(i); return `<div class="series-cell">${tile({ shape: sh, color: f.color, rotation: f.rot, size: 56 })}</div>`; }).join('') + '<div class="series-cell qmark-cell"><span class="qmark">?</span></div></div>';
    const nf = frame(4), csig = `${nf.rot}|${nf.color}`;
    const cand = [nf, { rot: (nf.rot + step) % 360, color: nf.color }, { rot: nf.rot, color: colors[(4 + 1) % 3] }, { rot: (nf.rot + 180) % 360, color: colors[(4 + 2) % 3] }, { rot: (((nf.rot - step) % 360) + 360) % 360, color: nf.color }];
    const opts = []; const seen = new Set();
    for (const c of cand) { const s = `${c.rot}|${c.color}`; if (opts.length < 5 && !seen.has(s)) { seen.add(s); opts.push(c); } }
    const shf = shuffle(opts);
    return {
      category: 'Spatial', type: 'series-compound',
      promptHTML: `Two things change at once — the figure <b>rotates</b> and the <b>colour</b> cycles. Pick the next figure.${row}`,
      options: shf.map(f => tile({ shape: sh, color: f.color, rotation: f.rot })),
      correct: shf.findIndex(f => `${f.rot}|${f.color}` === csig), optionsHTML: true,
      explanation: `The figure turns ${step}° clockwise each step AND the colour repeats every three — the next advances both.`,
    };
  }
  const sh = pick(['circle', 'square', 'triangle', 'diamond', 'pentagon']);
  const next = 5, nColor = colors[4 % 3], csig = `${next}|${nColor}`;
  const row = '<div class="series-row">' + [1, 2, 3, 4].map((c, i) => `<div class="series-cell">${dotsTile({ count: c, color: colors[i % 3], shape: sh, size: 54 })}</div>`).join('') + '<div class="series-cell qmark-cell"><span class="qmark">?</span></div></div>';
  const cand = [{ count: next, color: nColor }, { count: next, color: colors[(4 + 1) % 3] }, { count: 4, color: nColor }, { count: next + 1, color: nColor }, { count: next, color: colors[(4 + 2) % 3] }];
  const opts = []; const seen = new Set();
  for (const c of cand) { const s = `${c.count}|${c.color}`; if (opts.length < 5 && !seen.has(s)) { seen.add(s); opts.push(c); } }
  const shf = shuffle(opts);
  return {
    category: 'Spatial', type: 'series-compound',
    promptHTML: `Two things change at once — the <b>number</b> of items and the <b>colour</b>. Pick the next figure.${row}`,
    options: shf.map(o => dotsTile({ count: o.count, color: o.color, shape: sh })),
    correct: shf.findIndex(o => `${o.count}|${o.color}` === csig), optionsHTML: true,
    explanation: `The count rises by one each step (→ ${next}) and the colour cycles through three.`,
  };
}

function genVisualAnalogy() {
  const sh = pick(['arrow', 'ell', 'flag', 'triangle', 'pentagon']);
  const colors = shuffle(COLOR_KEYS).slice(0, 4).map(k => PALETTE[k]);
  const turn = pick([90, 180, 270]);
  const [cFrom, cTo] = colors;
  const aRot = pick([0, 45, 90, 135]), cRot = pick([0, 45, 90, 135]);
  const A = { rot: aRot, color: cFrom }, B = { rot: (aRot + turn) % 360, color: cTo };
  const C = { rot: cRot, color: cFrom }, Q = { rot: (cRot + turn) % 360, color: cTo };
  const cellOf = (o, sz) => `<div class="series-cell">${tile({ shape: sh, color: o.color, rotation: o.rot, size: sz })}</div>`;
  const head = `<div class="analogy-row">${cellOf(A, 54)}<span class="ana-arrow">→</span>${cellOf(B, 54)}<span class="ana-sep">::</span>${cellOf(C, 54)}<span class="ana-arrow">→</span><div class="series-cell qmark-cell"><span class="qmark">?</span></div></div>`;
  const sig = (o) => `${o.rot}|${o.color}`;
  const cand = [Q, { rot: Q.rot, color: cFrom }, { rot: cRot, color: cTo }, { rot: (cRot + turn) % 360, color: colors[2] }, { rot: (Q.rot + 180) % 360, color: cTo }, { rot: (cRot + (turn + 90)) % 360, color: cTo }];
  const opts = []; const seen = new Set();
  for (const c of cand) { if (opts.length < 5 && !seen.has(sig(c))) { seen.add(sig(c)); opts.push(c); } }
  const shf = shuffle(opts);
  return {
    category: 'Spatial', type: 'visual-analogy',
    promptHTML: `The first figure becomes the second by a rule. Apply the <b>same rule</b> to the third figure to get the answer.${head}`,
    options: shf.map(o => tile({ shape: sh, color: o.color, rotation: o.rot })),
    correct: shf.findIndex(o => sig(o) === sig(Q)), optionsHTML: true,
    explanation: `Rule: rotate ${turn}° clockwise AND change colour. Applied to the third figure, the answer rotates ${turn}° and takes the new colour.`,
  };
}

function genOddRule() {
  const k = pick([2, 3]);
  const odd = rint(0, 4);
  let oc = k + pick([1, -1]); if (oc < 1) oc = k + 2;
  const shapes = shuffle(['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star']);
  const colors = shuffle(COLOR_KEYS).map(c => PALETTE[c]);
  const rots = shuffle([0, 40, 90, 160, 215, 300, 335]);
  const tiles = ABC.map((_, i) => dotsTile({ count: i === odd ? oc : k, color: colors[i], shape: shapes[i], size: 82, rotation: rots[i] }));
  return {
    category: 'Spatial', type: 'odd-rule',
    promptHTML: `Four of these share <b>one feature</b>; one breaks it. Which is the <b>odd one out</b>?`,
    options: tiles, correct: odd, optionsHTML: true,
    explanation: `Four tiles contain the same number of items (${k}); the odd one (Option ${ABC[odd]}) has ${oc}. The shape, colour and orientation all vary deliberately to disguise the rule.`,
  };
}

/* =======================================================================
   CAT/GMAT-LEVEL NUMERICAL — hard tier (fresh templates, multi-step).
   Every question is constructed FROM its answer, so the key is correct by
   construction. Each carries a `topic` tag so pacing-by-topic works.
   ======================================================================= */

const gcd2 = (a, b) => b ? gcd2(b, a % b) : a;
const frac = (num, den) => { const g = gcd2(num, den); return `${num / g}/${den / g}`; };
const nCk = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return Math.round(r); };
const modpow = (base, exp, mod) => { let b = BigInt(base) % BigInt(mod), e = BigInt(exp), m = BigInt(mod), r = 1n; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return Number((r % m + m) % m); };
const trailingZeros = (N) => { let z = 0; for (let p = 5; p <= N; p *= 5) z += Math.floor(N / p); return z; };
const factorCount = (n) => { let c = 1; for (let p = 2; p * p <= n; p++) { let e = 0; while (n % p === 0) { n /= p; e++; } if (e) c *= e + 1; } if (n > 1) c *= 2; return c; };
// residue cycle of a^1, a^2, … (mod m); pure cycle when gcd(a,m)=1 or for last-digit mod 10.
const residueCycle = (a, m) => { const seen = [], pos = {}; let v = ((a % m) + m) % m; while (pos[v] === undefined) { pos[v] = seen.length; seen.push(v); v = (v * (((a % m) + m) % m)) % m; } return seen; };
// prime-factorisation as HTML, e.g. 720 → "2³·3²·5"
const primeFactorStr = (n) => { const parts = []; for (let p = 2; p * p <= n; p++) { let e = 0; while (n % p === 0) { n /= p; e++; } if (e) parts.push(e === 1 ? `${p}` : `${p}<sup>${e}</sup>`); } if (n > 1) parts.push(`${n}`); return parts.join('·'); };
// Legendre's formula: exponent of prime p in N!  = ⌊N/p⌋ + ⌊N/p²⌋ + …
const legendre = (p, N) => { let s = 0; for (let pk = p; pk <= N; pk *= p) s += Math.floor(N / pk); return s; };
// prime factors of n as [[p,e],…]
const primeFactors = (n) => { const f = []; for (let p = 2; p * p <= n; p++) { let e = 0; while (n % p === 0) { n /= p; e++; } if (e) f.push([p, e]); } if (n > 1) f.push([n, 1]); return f; };

function genWorkEfficiency() {
  // rates: B = 1 unit/day, A = m units/day → together (1+m)T units = whole job
  const [m, p] = pick([[1.2, 20], [1.25, 25], [1.4, 40], [1.5, 50], [1.6, 60], [1.75, 75],
    [1.8, 80], [2, 100], [2.2, 120], [2.5, 150], [3, 200], [4, 300]]);
  const T = pick([4, 5, 6, 8, 9, 10, 12, 15].filter(t => Number.isInteger((1 + m) * t)));
  const bAlone = (1 + m) * T;
  // distractor = "A-alone time" misread (bAlone/m), rounded to an integer so it matches
  // the all-integer option texture and never telegraphs itself as the lone decimal.
  const q = mc(bAlone, [Math.round(bAlone / m), 2 * T, bAlone + T, bAlone - T]);
  return {
    category: 'Numerical', topic: 'work & time', type: 'work-efficiency',
    promptHTML: `A is <b>${p}% more efficient</b> than B. Working together they finish a job in <b>${T} days</b>. How many days would <b>B alone</b> take?`,
    ...q, explanation: `Let B do 1 unit/day → A does ${m}. Together ${1 + m}/day × ${T} days = ${bAlone} units of work. B alone: ${bAlone} ÷ 1 = ${bAlone} days.`,
  };
}

function genWorkLeave() {
  // curated [aDays, bDays, daysTogether, bFinishAlone] — all integer by construction
  const [a, b, x] = pick([[5, 10, 1], [5, 10, 2], [6, 9, 2], [6, 10, 3], [7, 14, 1], [7, 14, 2], [8, 12, 2], [8, 12, 4], [9, 12, 3], [9, 15, 3], [10, 14, 5], [10, 15, 2], [11, 22, 4], [11, 22, 5], [12, 15, 4], [12, 16, 3], [13, 26, 5], [13, 26, 6], [14, 18, 7], [14, 20, 7]]);
  const L = a * b / gcd2(a, b), rA = L / a, rB = L / b;
  const y = (L - x * (rA + rB)) / rB;
  // distractors kept positive integers (y−2 could hit 0, the /rA value was the lone decimal)
  const q = mc(y, [y + 2, y - 1, b - x, Math.round((L - x * (rA + rB)) / rA)]);
  return {
    category: 'Numerical', topic: 'work & time', type: 'work-leave',
    promptHTML: `A can finish a job in <b>${a} days</b>, B in <b>${b} days</b>. They work together for <b>${x} days</b>, then A leaves. How many <b>more days</b> does B need to finish alone?`,
    ...q, explanation: `Take the job as ${L} units → A does ${rA}/day, B does ${rB}/day. In ${x} days together: ${x}×${rA + rB} = ${x * (rA + rB)} units. Remaining ${L - x * (rA + rB)} ÷ ${rB} = ${y} days.`,
  };
}

function genSuccessivePct() {
  const [a, b] = pick([[25, 40], [10, 30], [20, 35], [60, 50], [35, 40], [20, 30], [45, 40], [10, 20], [20, 25], [30, 30], [15, 20], [55, 40], [20, 20], [40, 30], [10, 10], [25, 20], [20, 15], [30, 20], [40, 25], [20, 10], [40, 20], [45, 20], [30, 10], [40, 15], [50, 20], [55, 20]]);
  const net = a - b - a * b / 100;
  const thing = pick(['The price of a stock', 'A company’s revenue', 'A city’s population', 'The value of a car']);
  const q = mc(net, [a - b, b - a, -(a - b), net + 2], pct);
  return {
    category: 'Numerical', topic: 'percentages', type: 'successive-pct',
    promptHTML: `${thing} increases by <b>${a}%</b> and then decreases by <b>${b}%</b>. What is the <b>net percentage change</b>? (negative = decrease)`,
    ...q, explanation: `Net = ${a} − ${b} − ${a}×${b}/100 = ${net}% (multiply factors: ${1 + a / 100} × ${1 - b / 100} = ${Math.round((1 + a / 100) * (1 - b / 100) * 100) / 100} — NOT ${a - b}%).`,
  };
}

function genInversePct() {
  const [p] = pick([[25], [60], [100], [150], [220], [300], [400], [525], [700], [900]]);
  const q = Math.round(10000 * p / (100 + p)) / 100;
  const salary = Math.random() < 0.5;
  const m = mc(q, [p, p - q, q + 5, q - 5], pct);
  return {
    category: 'Numerical', topic: 'percentages', type: 'inverse-pct',
    promptHTML: salary
      ? `A’s salary is <b>${p}% more</b> than B’s. By what percent is B’s salary <b>less</b> than A’s?`
      : `The price of petrol rises by <b>${p}%</b>. By what percent must a driver cut consumption to keep total spending <b>unchanged</b>?`,
    ...m, explanation: `Required % = ${p}/(100+${p}) × 100 = ${q}%. (It is NOT ${p}% — the base changes.)`,
  };
}

function genCIvsSI() {
  const [P, r] = pick([[5000, 4], [10000, 4], [15000, 4], [20000, 4], [4000, 5], [6000, 5], [8000, 5], [10000, 5], [5000, 8], [10000, 8], [15000, 8], [20000, 8], [4000, 10], [5000, 10], [6000, 10], [8000, 10], [5000, 12], [10000, 12], [15000, 12], [20000, 12], [4000, 15], [6000, 15], [8000, 15], [10000, 15]]);
  const diff = P * r * r / 10000;
  const m = mc(P, [P / 2, 2 * P, P + 2000, P - 2000], money);
  return {
    category: 'Numerical', topic: 'interest', type: 'ci-vs-si',
    promptHTML: `The difference between <b>compound</b> and <b>simple</b> interest on a sum for <b>2 years</b> at <b>${r}% p.a.</b> is <b>${money(diff)}</b>. Find the sum.`,
    ...m, explanation: `For 2 years, CI − SI = P(r/100)² = P × ${r * r / 10000}. So P = ${money(diff)} ÷ ${r * r / 10000} = ${money(P)}.`,
  };
}

function genMarkupDiscount() {
  const [mk, d] = pick([[70, 50], [45, 40], [60, 45], [20, 25], [80, 50], [30, 30], [55, 40], [90, 50], [20, 20], [40, 30], [65, 40], [25, 20], [20, 15], [30, 20], [40, 25], [75, 40], [20, 10], [80, 40], [100, 45], [85, 40], [40, 20], [90, 40], [45, 20], [30, 10], [95, 40], [40, 15], [100, 40]]);
  const pr = mk - d - mk * d / 100;
  // when d (the "discount value as answer" trap) coincides with pr, swap in mk*d/100 instead of letting mc backfill a random number
  const m = mc(pr, [mk - d, pr + 5, pr - 5, d === pr ? mk * d / 100 : d], pct);
  return {
    category: 'Numerical', topic: 'profit & loss', type: 'markup-discount',
    promptHTML: `A trader marks goods <b>${mk}%</b> above cost price and then allows a <b>${d}%</b> discount. What is the net <b>profit percent</b>? (negative = loss)`,
    ...m, explanation: `SP = CP × ${1 + mk / 100} × ${1 - d / 100} = CP × ${Math.round((1 + mk / 100) * (1 - d / 100) * 100) / 100} → ${pr}% (markup and discount do NOT cancel: ${mk}−${d}=${mk - d} is the trap).`,
  };
}

function genMixtureReplace() {
  const [V, x] = pick([[20, 4], [20, 6], [20, 8], [24, 6], [24, 12], [25, 10], [30, 6], [30, 12], [40, 4], [40, 6], [40, 8], [45, 18], [50, 10], [50, 20], [60, 6], [60, 12], [60, 18], [75, 30], [80, 4], [80, 8], [80, 10], [100, 4], [100, 10], [100, 20]]);
  const left = Math.round((V - x) * (V - x) / V * 100) / 100;
  // traps: V−2x (naive double-subtract), V−x (one-replacement), (V−x)³/V² (three-replacement miscount)
  const m = mc(left, [V - 2 * x, V - x, Math.round((V - x) ** 3 / (V * V) * 100) / 100, left + 2]);
  return {
    category: 'Numerical', topic: 'mixtures', type: 'mixture-replace',
    promptHTML: `A vessel holds <b>${V} L</b> of pure milk. <b>${x} L</b> is drawn off and replaced with water; then the process is repeated <b>once more</b>. How many litres of <b>milk</b> remain?`,
    ...m, explanation: `Each replacement keeps fraction ${1 - x / V} of the milk. After two: ${V} × ${1 - x / V}² = ${left} L. (${V}−${2 * x}=${V - 2 * x} is the trap — the second draw removes mixture, not pure milk.)`,
  };
}

function genAvgSpeed() {
  const [a, b] = pick([[20, 30], [20, 60], [20, 80], [25, 100], [30, 45], [30, 60], [30, 70], [30, 90], [30, 120], [40, 60], [40, 120], [45, 90], [45, 105], [50, 75], [60, 90], [60, 100], [60, 120], [70, 105], [80, 120], [90, 110]]);
  const avg = 2 * a * b / (a + b);
  const m = mc(avg, [(a + b) / 2, a, b, avg + 4]);
  return {
    category: 'Numerical', topic: 'speed & distance', type: 'avg-speed',
    promptHTML: `A car drives from town X to town Y at <b>${a} km/h</b> and returns over the same road at <b>${b} km/h</b>. What is its <b>average speed</b> for the whole round trip?`,
    ...m, explanation: `Average speed = 2ab/(a+b) = 2×${a}×${b} ÷ ${a + b} = ${avg} km/h — NOT ${(a + b) / 2} (equal distances, not equal times).`,
  };
}

function genTrainPlatform() {
  const [L, t1, t2] = pick([[84, 7, 12], [84, 7, 15], [96, 8, 13], [96, 8, 16], [108, 9, 14], [108, 9, 17], [120, 10, 15], [120, 10, 18], [144, 12, 17], [144, 12, 20], [90, 6, 11], [90, 6, 14], [105, 7, 12], [105, 7, 15], [135, 9, 14], [135, 9, 17], [150, 10, 15], [150, 10, 18], [180, 12, 17], [180, 12, 20], [126, 7, 12], [126, 7, 15], [162, 9, 14], [162, 9, 17]]);
  const v = L / t1, plat = v * t2 - L;
  const askSpeed = Math.random() < 0.35;
  const kmh = v * 3.6;
  const m = askSpeed
    ? mc(kmh, [v, kmh + 18, kmh - 18, kmh / 2])
    : mc(plat, [v * t2, L, plat + 40, plat - 40]);
  return {
    category: 'Numerical', topic: 'speed & distance', type: 'train-platform',
    promptHTML: `A train crosses a lamp post in <b>${t1} s</b> and a platform in <b>${t2} s</b>. The train is <b>${L} m</b> long. ${askSpeed ? 'What is its speed in <b>km/h</b>?' : 'How long is the <b>platform</b> (m)?'}`,
    ...m, explanation: `Speed = ${L}/${t1} = ${v} m/s${askSpeed ? ` = ${v} × 3.6 = ${kmh} km/h.` : `. Crossing the platform covers train + platform: ${v}×${t2} = ${v * t2} m → platform = ${v * t2} − ${L} = ${plat} m.`}`,
  };
}

function genPartnership() {
  const [iA, mA, iB, mB, P] = pick([[12000, 10, 16000, 5, 12000], [12000, 10, 8000, 6, 14000], [16000, 5, 12000, 10, 12000], [16000, 5, 10000, 12, 12000], [10000, 12, 16000, 5, 12000], [10000, 12, 8000, 6, 14000], [15000, 8, 8000, 6, 14000], [15000, 8, 12000, 8, 18000], [8000, 6, 12000, 10, 14000], [8000, 6, 16000, 5, 12000], [25000, 4, 12000, 10, 22000], [25000, 4, 16000, 5, 18000], [18000, 5, 12000, 10, 14000], [18000, 5, 10000, 12, 14000], [20000, 6, 16000, 5, 12000], [20000, 6, 8000, 6, 14000]]);
  const wA = iA * mA, wB = iB * mB, g = gcd2(wA, wB);
  const askA = Math.random() < 0.5;
  const share = Math.round(P * (askA ? wA : wB) / (wA + wB));
  const other = P - share;
  // structured traps so no random non-round filler is needed: the other partner's share,
  // capital-only ratio (time ignored), and time-only ratio (capital ignored).
  const capOnly = Math.round(P * (askA ? iA : iB) / (iA + iB));
  const timeOnly = Math.round(P * (askA ? mA : mB) / (mA + mB));
  const m = mc(share, [other, capOnly, timeOnly, share + 1000], money);
  return {
    category: 'Numerical', topic: 'ratio & partnership', type: 'partnership',
    promptHTML: `A invests <b>${money(iA)}</b> for <b>${mA} months</b>; B invests <b>${money(iB)}</b> for <b>${mB} months</b>. From a total profit of <b>${money(P)}</b>, what is <b>${askA ? 'A' : 'B'}’s share</b>?`,
    ...m, explanation: `Shares follow capital × time → ${wA / 1000}k : ${wB / 1000}k = ${wA / g} : ${wB / g}. ${askA ? 'A' : 'B'}’s share = ${money(P)} × ${(askA ? wA : wB) / g}/${(wA + wB) / g} = ${money(share)}.`,
  };
}

function genReplaceAvg() {
  const [n, d, w] = pick([[8, 2.5, 45], [10, 2, 50], [12, 1.5, 48], [15, 2, 55], [10, 3.5, 42], [6, 2.5, 60], [9, 2, 40], [14, 2.5, 52], [16, 1.25, 58], [12, 2.5, 50], [20, 1.5, 45], [10, 3, 55], [8, 3.5, 44], [14, 3, 48], [6, 3.5, 50], [18, 2, 46], [25, 2, 62], [12, 3.5, 47]]);
  const nw = w + n * d;
  const m = mc(nw, [w + d, n * d, w - n * d, nw + 5]);
  return {
    category: 'Numerical', topic: 'averages', type: 'replace-avg',
    promptHTML: `The average weight of <b>${n}</b> people rises by <b>${d} kg</b> when a person weighing <b>${w} kg</b> is replaced by a newcomer. What is the <b>newcomer’s weight</b>?`,
    ...m, explanation: `The group total rises by ${n} × ${d} = ${n * d} kg, all due to the swap → newcomer = ${w} + ${n * d} = ${nw} kg.`,
  };
}

function genDigitReverse() {
  const [ta, ub] = pick([[2, 1], [3, 1], [3, 2], [4, 1], [4, 2], [4, 3], [5, 1], [5, 2], [5, 3], [5, 4], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [7, 1], [7, 2], [7, 3], [7, 4], [7, 5]]);
  const s = ta + ub, D = 9 * (ta - ub), ans = 10 * ta + ub;
  const rev = Number(String(ans).split('').reverse().join(''));
  const m = mc(ans, [rev, ans + 9, ans - 9, ans + 1]);
  return {
    category: 'Numerical', topic: 'number properties', type: 'digit-reverse',
    promptHTML: `The digits of a two-digit number add up to <b>${s}</b>. Reversing the digits gives a number <b>${D} smaller</b>. What is the original number?`,
    ...m, explanation: `For 10a+b: a+b = ${s} and 9(a−b) = ${D} → a−b = ${D / 9}. So a = ${(s + D / 9) / 2}, b = ${(s - D / 9) / 2} → ${ans}.`,
  };
}

function genProbBalls() {
  const [r, b] = pick([[4, 4], [5, 3], [3, 3], [6, 4], [5, 5], [4, 2], [6, 3], [7, 3], [7, 5], [8, 4], [6, 6], [5, 4], [8, 5], [7, 4], [9, 3], [6, 5], [8, 6], [5, 2], [7, 6], [9, 4], [4, 3], [10, 5]]);
  const n = r + b;
  const correct = frac(r * (r - 1), n * (n - 1));
  const m = mcStr(correct, [frac(r * r, n * n), frac(r, n), frac(r - 1, n - 1), frac(r * (r - 1), n * n)],
    () => frac(rint(1, 5), rint(6, 12)));
  return {
    category: 'Numerical', topic: 'probability & counting', type: 'prob-balls',
    promptHTML: `A bag holds <b>${r} red</b> and <b>${b} blue</b> balls. Two balls are drawn at random <b>without replacement</b>. What is the probability that <b>both are red</b>?`,
    ...m, explanation: `P = ${r}/${n} × ${r - 1}/${n - 1} = ${frac(r * (r - 1), n * (n - 1))}. (The second draw has one fewer red and one fewer total.)`,
  };
}

function genCombinatorics() {
  const [men, wom, km, kw] = pick([[6, 4, 3, 2], [5, 4, 2, 2], [7, 3, 3, 1], [6, 5, 2, 3], [5, 3, 3, 2], [8, 4, 2, 2], [7, 4, 3, 2], [6, 4, 2, 2], [8, 5, 3, 2], [7, 5, 2, 3], [9, 4, 3, 2], [6, 6, 3, 3], [5, 5, 2, 2], [8, 3, 3, 1], [7, 6, 2, 2], [10, 4, 2, 2], [6, 5, 3, 2], [9, 5, 2, 3]]);
  const cm = nCk(men, km), cw = nCk(wom, kw), ans = cm * cw;
  const m = mc(ans, [cm + cw, nCk(men + wom, km + kw), ans + 10, ans - 10]);
  return {
    category: 'Numerical', topic: 'probability & counting', type: 'committee',
    promptHTML: `From <b>${men} men</b> and <b>${wom} women</b>, a committee of <b>${km} men</b> and <b>${kw} women</b> must be formed. How many different committees are possible?`,
    ...m, explanation: `C(${men},${km}) × C(${wom},${kw}) = ${cm} × ${cw} = ${ans}. (Choose independently, then multiply.)`,
  };
}

function genHcfLcm() {
  const [h, pf, qf] = pick([[3, 2, 3], [4, 2, 3], [5, 2, 3], [3, 2, 5], [4, 2, 5], [5, 2, 5], [6, 2, 7], [7, 2, 7], [8, 2, 7], [6, 3, 4], [7, 3, 4], [8, 3, 4], [9, 3, 5], [11, 3, 5], [12, 3, 5], [9, 3, 7], [11, 3, 7], [12, 3, 7]]);
  const n1 = h * pf, n2 = h * qf, lcm = h * pf * qf;
  const m = mc(n2, [lcm - n1, lcm / h * 2, n2 + h, n2 - h]);
  return {
    category: 'Numerical', topic: 'number properties', type: 'hcf-lcm',
    promptHTML: `Two numbers have HCF <b>${h}</b> and LCM <b>${lcm}</b>. One of the numbers is <b>${n1}</b>. What is the other?`,
    ...m, explanation: `Product of two numbers = HCF × LCM → other = ${h} × ${lcm} ÷ ${n1} = ${n2}.`,
  };
}

function genRatioAdd() {
  const [pf, qf, k, x] = pick([[2, 3, 2, 3], [2, 3, 2, 4], [2, 3, 2, 6], [2, 3, 2, 8], [2, 3, 2, 10], [2, 3, 2, 12], [2, 3, 3, 3], [2, 3, 6, 3], [3, 5, 3, 3], [3, 5, 9, 3], [2, 5, 2, 4], [2, 5, 2, 5], [2, 5, 3, 3], [2, 5, 4, 7]]);
  const A = pf * k, B = qf * k;
  const ng = gcd2(A + x, B + x), newRatio = `${(A + x) / ng} : ${(B + x) / ng}`;
  const g = gcd2(A, B);
  // traps: A (larger/smaller swap), A+x & B+x (post-addition values), A+B (sum) — all positive, no degenerate 0
  const m = mc(B, [A, A + x, B + x, A + B]);
  return {
    category: 'Numerical', topic: 'ratio & partnership', type: 'ratio-add',
    promptHTML: `Two numbers are in the ratio <b>${A / g} : ${B / g}</b>. When <b>${x}</b> is added to each, the ratio becomes <b>${newRatio}</b>. What is the <b>larger</b> original number?`,
    ...m, explanation: `Let the numbers be ${A / g}k and ${B / g}k. (${A / g}k+${x})/(${B / g}k+${x}) = ${newRatio.replace(' : ', '/')} → k = ${A / (A / g)}. Numbers: ${A} and ${B} → larger = ${B}.`,
  };
}

function genClockAngle() {
  // whole-hour times dropped: they make the "forgot drift" trap collide with the key
  const [h, mm] = pick([[1, 10], [1, 40], [2, 10], [2, 45], [3, 15], [3, 50], [4, 20], [4, 50], [5, 30], [6, 30], [6, 10], [7, 40], [7, 10], [8, 45], [8, 10], [9, 50], [9, 15], [10, 50], [10, 20], [11, 30], [12, 10], [12, 30]]);
  const H = h % 12; // treat 12 as 0 so the worked steps read cleanly
  const raw = Math.abs(30 * H - 5.5 * mm), ang = Math.min(raw, 360 - raw);
  const drift = Math.abs(30 * H - 6 * mm); // "forgot the hour hand drifts 0.5°/min" trap
  // every distractor forced into (0°,180°] and ≠ key, so no negative/zero angles ever render
  const cand = [drift, ang + 15, ang - 15, ang + 30, ang - 30, ang + 7.5, ang - 7.5, ang + 22.5, ang - 22.5, ang + 5, ang - 5];
  const wrongs = [...new Set(cand.filter(v => v > 0 && v <= 180 && v !== ang))].slice(0, 4);
  const m = mc(ang, wrongs, (n) => n + '°');
  return {
    category: 'Numerical', topic: 'clocks', type: 'clock-angle',
    promptHTML: `What is the angle between the hour and minute hands of a clock at <b>${h}:${String(mm).padStart(2, '0')}</b>?`,
    ...m, explanation: `Angle = |30×${H} − 5.5×${mm}| = ${raw}°${raw > 180 ? `, so the smaller angle is 360 − ${raw} = ${ang}°` : ''}. (The hour hand moves 0.5° per minute — it isn’t sitting on the ${h}.)`,
  };
}

function genAlligation() {
  const [a, b, c] = pick([[8, 18, 10], [8, 18, 12], [8, 18, 14], [10, 20, 12], [10, 20, 14], [10, 20, 16], [12, 22, 14], [12, 22, 16], [12, 22, 18], [14, 24, 22], [14, 29, 24], [14, 29, 26], [16, 26, 24], [16, 31, 26], [16, 46, 26], [18, 33, 28], [18, 48, 28], [18, 53, 28], [20, 50, 30], [20, 55, 30], [20, 55, 40], [22, 57, 32], [22, 57, 42], [22, 57, 52]]);
  const rg = gcd2(b - c, c - a), ratio = `${(b - c) / rg} : ${(c - a) / rg}`;
  const rev = ratio.split(' : ').reverse().join(' : ');
  const g = gcd2(a, b);
  const m = mcStr(ratio, [rev, `${a / g} : ${b / g}`, `${b / g} : ${a / g}`, '1 : 1'],
    () => `${rint(1, 6)} : ${rint(1, 6)}`);
  return {
    category: 'Numerical', topic: 'mixtures', type: 'alligation',
    promptHTML: `In what ratio must rice at <b>₹${a}/kg</b> be mixed with rice at <b>₹${b}/kg</b> so that the mixture costs <b>₹${c}/kg</b>?`,
    ...m, explanation: `Alligation: ratio = (dearer − mean) : (mean − cheaper) = (${b}−${c}) : (${c}−${a}) = ${b - c} : ${c - a} = ${ratio}.`,
  };
}

/* =======================================================================
   CAT/GMAT-LEVEL NUMERICAL — extra families (number theory, sets,
   progressions, mensuration, coordinate geometry). Answer computed from
   inputs, so the key is correct by construction.
   ======================================================================= */

function genRemainderPower() {
  // moduli kept ≥ 5 so 5 distinct non-negative residues always exist (m=4 can't fill 5 options)
  const [a, n, m] = pick([[2, 10, 7], [3, 50, 7], [7, 100, 5], [2, 100, 9], [3, 30, 11], [5, 40, 13],
    [4, 64, 7], [6, 20, 5], [2, 200, 13], [3, 17, 10], [8, 33, 9], [2, 47, 7], [5, 99, 7], [3, 81, 13],
    [11, 53, 7], [4, 40, 9]]);
  const r = modpow(a, n, m);
  // distractors are always valid residues in {0..m-1}\{r} — never negative, never ≥ m
  const wrongs = []; for (let c = 1; wrongs.length < 4; c++) { const rr = (r + c) % m; if (rr !== r && !wrongs.includes(rr)) wrongs.push(rr); }
  const q = mc(r, wrongs);
  const cyc = residueCycle(a, m), P = cyc.length;
  return {
    category: 'Numerical', topic: 'number properties', type: 'remainder-power',
    promptHTML: `What is the <b>remainder</b> when <b>${a}<sup>${n}</sup></b> is divided by <b>${m}</b>?`,
    ...q, explanation: `Powers of ${a} mod ${m} repeat with period ${P}: ${a}<sup>1</sup>, ${a}<sup>2</sup>, … ≡ ${cyc.join(', ')}, then repeat. Since ${n} mod ${P} = ${n % P}, ${a}<sup>${n}</sup> ≡ ${r} (mod ${m}).`,
  };
}

function genUnitsDigit() {
  const [a, n] = pick([[2, 34], [3, 51], [4, 27], [7, 53], [8, 22], [9, 41], [6, 15], [12, 38], [13, 19],
    [17, 24], [24, 33], [29, 47], [7, 100], [3, 99], [2, 64], [8, 81], [14, 53], [19, 28], [23, 45], [27, 30]]);
  const u = modpow(a, n, 10);
  // distractors are always distinct digits 0–9 (never out of range)
  const wrongs = []; for (let c = 1; wrongs.length < 4; c++) { const dd = (u + c) % 10; if (dd !== u && !wrongs.includes(dd)) wrongs.push(dd); }
  const q = mc(u, wrongs);
  const cyc = residueCycle(a % 10, 10), P = cyc.length;
  return {
    category: 'Numerical', topic: 'number properties', type: 'units-digit',
    promptHTML: `What is the <b>units (last) digit</b> of <b>${a}<sup>${n}</sup></b>?`,
    ...q, explanation: `The units digit of ${a} is ${a % 10}; its powers end in ${cyc.join(', ')} (period ${P}). Since ${n} mod ${P} = ${n % P}, ${a}<sup>${n}</sup> ends in ${u}.`,
  };
}

function genTrailingZeros() {
  const N = pick([25, 30, 40, 45, 50, 60, 70, 75, 80, 90, 100, 120, 125, 150, 175, 200, 250, 300]);
  const z = trailingZeros(N);
  const q = mc(z, [z + 1, z - 1, Math.floor(N / 5), z + 2]);
  return {
    category: 'Numerical', topic: 'number properties', type: 'trailing-zeros',
    promptHTML: `How many <b>trailing zeros</b> are at the end of <b>${N}!</b> (${N} factorial)?`,
    ...q, explanation: `Count the factors of 5: ⌊${N}/5⌋ + ⌊${N}/25⌋ + ⌊${N}/125⌋ + … = ${z}. (Factors of 2 are more plentiful, so 5s are the bottleneck — ⌊${N}/5⌋ = ${Math.floor(N / 5)} alone is the trap.)`,
  };
}

function genFactorCount() {
  // larger, less-obvious N + an "odd factors only" twist to push past trivial level
  const N = pick([72, 84, 96, 120, 144, 168, 180, 210, 216, 240, 288, 360, 420, 504, 540, 600, 720, 840, 900, 1260]);
  const odd = Math.random() < 0.4;
  let n = N, allCount = 1, oddCount = 1;
  for (let p = 2; p * p <= n; p++) { let e = 0; while (n % p === 0) { n /= p; e++; } if (e) { allCount *= e + 1; if (p !== 2) oddCount *= e + 1; } }
  if (n > 1) { allCount *= 2; oddCount *= 2; } // leftover prime is odd (2 already divided out)
  const c = odd ? oddCount : allCount;
  const q = mc(c, [c + 1, c - 1, c + 2, c - 2]);
  return {
    category: 'Numerical', topic: 'number properties', type: 'factor-count',
    promptHTML: `How many <b>distinct positive ${odd ? 'odd ' : ''}factors (divisors)</b> does <b>${N}</b> have?`,
    ...q, explanation: odd
      ? `${N} = ${primeFactorStr(N)}. Odd factors ignore every power of 2, so multiply (exponent+1) over the odd primes only → ${c}.`
      : `${N} = ${primeFactorStr(N)}, so the divisor count is the product of (exponent+1) = ${c}.`,
  };
}

function genTwoSets() {
  const [T, A, B, neither] = pick([[100, 60, 50, 10], [80, 50, 45, 5], [120, 70, 65, 15], [50, 30, 28, 6],
    [200, 120, 100, 20], [60, 40, 35, 5], [90, 55, 50, 10], [150, 90, 80, 10], [100, 65, 55, 8], [70, 45, 40, 7]]);
  const both = A + B - (T - neither);
  const q = mc(both, [A + B - T, both + 5, both - 5, T - neither]);
  return {
    category: 'Numerical', topic: 'set theory', type: 'two-sets',
    promptHTML: `In a group of <b>${T}</b> people, <b>${A}</b> like tea and <b>${B}</b> like coffee, while <b>${neither}</b> like neither. How many like <b>both</b>?`,
    ...q, explanation: `At least one = ${T} − ${neither} = ${T - neither}. By inclusion–exclusion, both = ${A} + ${B} − ${T - neither} = ${both}.`,
  };
}

function genThreeSets() {
  const [A, B, C, ab, bc, ca, abc] = pick([[40, 35, 30, 12, 10, 8, 5], [50, 45, 40, 15, 12, 10, 6],
    [60, 50, 45, 20, 15, 12, 8], [30, 28, 25, 8, 7, 6, 3], [55, 48, 42, 16, 14, 11, 7], [70, 60, 50, 22, 18, 15, 10],
    [45, 40, 35, 14, 11, 9, 5], [65, 55, 48, 18, 16, 13, 8]]);
  const union = A + B + C - ab - bc - ca + abc;
  const q = mc(union, [A + B + C, A + B + C - ab - bc - ca, union + 5, union - 5]);
  return {
    category: 'Numerical', topic: 'set theory', type: 'three-sets',
    promptHTML: `Out of a survey: <b>${A}</b> read A, <b>${B}</b> read B, <b>${C}</b> read C; <b>${ab}</b> read A&B, <b>${bc}</b> read B&C, <b>${ca}</b> read C&A, and <b>${abc}</b> read all three. How many read <b>at least one</b>?`,
    ...q, explanation: `|A∪B∪C| = (${A}+${B}+${C}) − (${ab}+${bc}+${ca}) + ${abc} = ${union}.`,
  };
}

function genAPsum() {
  const [a, d, n] = pick([[3, 4, 20], [5, 3, 25], [7, 5, 18], [2, 6, 30], [10, 4, 15], [4, 7, 22], [6, 5, 40],
    [8, 3, 50], [1, 9, 20], [12, 6, 16], [5, 8, 24], [9, 4, 35], [7, 6, 28], [11, 5, 30], [3, 7, 26]]);
  const term = a + (n - 1) * d, sum = n * (2 * a + (n - 1) * d) / 2;
  const mode = pick(['term', 'sum', 'count']);
  if (mode === 'count') {
    // reverse / multi-step: solve for the number of terms that sum to a target
    const q = mc(n, [n + 1, n - 1, n + 2, n - 2]);
    return {
      category: 'Numerical', topic: 'progressions', type: 'ap',
      promptHTML: `The arithmetic progression <b>${a}, ${a + d}, ${a + 2 * d}, …</b> How many terms must be added so that their <b>sum equals ${sum}</b>?`,
      ...q, explanation: `Solve n/2·(2a + (n−1)d) = ${sum} with a = ${a}, d = ${d}. This quadratic in n gives n = ${n} (the first ${n} terms total exactly ${sum}).`,
    };
  }
  const ask = mode === 'term';
  const ans = ask ? term : sum;
  const q = mc(ans, ask ? [term + d, term - d, a + n * d, term + 2 * d] : [sum + n, sum - n, n * (a + term), sum + d]);
  return {
    category: 'Numerical', topic: 'progressions', type: 'ap',
    promptHTML: `An arithmetic progression starts at <b>${a}</b> with common difference <b>${d}</b>. ${ask ? `What is the <b>${n}<sup>th</sup> term</b>?` : `What is the <b>sum of the first ${n} terms</b>?`}`,
    ...q, explanation: ask ? `nth term = a + (n−1)d = ${a} + ${n - 1}×${d} = ${term}.` : `Sum = n/2 · (2a + (n−1)d) = ${n}/2 · (${2 * a} + ${(n - 1) * d}) = ${sum}.`,
  };
}

function genGPsum() {
  const [a, r, n] = pick([[1, 2, 8], [1, 2, 10], [3, 2, 6], [2, 3, 5], [1, 3, 6], [5, 2, 7], [1, 2, 12],
    [4, 2, 6], [2, 2, 9], [1, 4, 5], [3, 3, 4], [1, 5, 4], [2, 3, 6], [1, 3, 7], [5, 3, 4]]);
  const sum = a * (r ** n - 1) / (r - 1);
  const last = a * r ** (n - 1);
  if (Math.random() < 0.45) {
    // reverse: which term equals a given value (solve for the exponent)
    const q = mc(n, [n - 1, n + 1, n - 2, n + 2]);
    return {
      category: 'Numerical', topic: 'progressions', type: 'gp',
      promptHTML: `In the geometric progression <b>${a}, ${a * r}, ${a * r * r}, …</b> (ratio ${r}), <b>which term equals ${last}</b>?`,
      ...q, explanation: `The kth term is ${a}·${r}<sup>k−1</sup>. Set it to ${last} → ${r}<sup>k−1</sup> = ${last / a} = ${r}<sup>${n - 1}</sup>, so k = ${n}.`,
    };
  }
  const q = mc(sum, [last, sum - last, sum + a, sum - a]);
  return {
    category: 'Numerical', topic: 'progressions', type: 'gp',
    promptHTML: `A geometric progression starts at <b>${a}</b> with common ratio <b>${r}</b>. What is the <b>sum of the first ${n} terms</b>?`,
    ...q, explanation: `Sum = a(rⁿ−1)/(r−1) = ${a}(${r}<sup>${n}</sup>−1)/${r - 1} = ${sum}.`,
  };
}

function genCubePaint() {
  const n = pick([3, 4, 5, 6, 7, 8, 10]);
  const mode = pick(['two', 'one', 'zero', 'three']);
  const counts = { three: 8, two: 12 * (n - 2), one: 6 * (n - 2) ** 2, zero: (n - 2) ** 3 };
  const labels = { three: 'exactly three', two: 'exactly two', one: 'exactly one', zero: 'no' };
  const ans = counts[mode];
  const q = mc(ans, [counts.two, counts.one, counts.zero, counts.three, ans + 4]);
  return {
    category: 'Numerical', topic: 'mensuration', type: 'cube-paint',
    promptHTML: `A cube is painted on all six faces, then cut into <b>${n}×${n}×${n} = ${n ** 3}</b> identical small cubes. How many small cubes have <b>${labels[mode]}</b> painted face${mode === 'one' ? '' : 's'}?`,
    ...q, explanation: `3-face (corners) = 8; 2-face (edges) = 12(n−2) = ${12 * (n - 2)}; 1-face = 6(n−2)² = ${6 * (n - 2) ** 2}; 0-face (interior) = (n−2)³ = ${(n - 2) ** 3}. <b>You were asked for ${labels[mode]} painted face${mode === 'one' ? '' : 's'} → ${ans}.</b>`,
  };
}

function genCylinder() {
  const [r, h] = pick([[7, 10], [7, 20], [14, 5], [7, 15], [21, 10], [14, 10], [7, 30], [14, 15], [7, 5], [21, 5], [14, 20], [7, 25]]);
  const mode = pick(['vol', 'csa', 'height']);
  const vol = 22 / 7 * r * r * h;
  const csa = 2 * 22 / 7 * r * h;
  if (mode === 'height') {
    // reverse: given volume and radius, recover the height
    const q = mc(h, [Math.round(vol / (22 / 7 * r) ), h + 2, Math.max(1, h - 2), 2 * h]);
    return {
      category: 'Numerical', topic: 'mensuration', type: 'cylinder',
      promptHTML: `A cylinder of radius <b>${r} cm</b> has volume <b>${vol} cm³</b> (take π = 22/7). What is its <b>height (cm)</b>?`,
      ...q, explanation: `h = V / (πr²) = ${vol} ÷ (22/7 × ${r}²) = ${vol} ÷ ${22 / 7 * r * r} = ${h} cm.`,
    };
  }
  const ask = mode === 'vol';
  const ans = ask ? vol : csa;
  const q = mc(ans, ask ? [csa, 22 / 7 * r * h, vol / 2, vol + 154] : [vol, 22 / 7 * r * h, csa / 2, csa + 88]);
  return {
    category: 'Numerical', topic: 'mensuration', type: 'cylinder',
    promptHTML: `A cylinder has radius <b>${r} cm</b> and height <b>${h} cm</b> (take π = 22/7). What is its <b>${ask ? 'volume (cm³)' : 'curved surface area (cm²)'}</b>?`,
    ...q, explanation: ask ? `Volume = πr²h = 22/7 × ${r}² × ${h} = ${vol} cm³.` : `Curved surface = 2πrh = 2 × 22/7 × ${r} × ${h} = ${csa} cm².`,
  };
}

function genCoordGeo() {
  const [x1, y1, dx, dy, dist] = pick([[1, 2, 3, 4, 5], [0, 0, 6, 8, 10], [2, 1, 5, 12, 13], [1, 1, 8, 6, 10],
    [3, 2, 9, 12, 15], [0, 1, 8, 15, 17], [2, 3, 12, 5, 13], [1, 0, 7, 24, 25], [4, 4, 3, 4, 5], [0, 0, 9, 12, 15],
    [2, 2, 6, 8, 10], [1, 3, 20, 21, 29]]);
  const x2 = x1 + dx, y2 = y1 + dy;
  if (Math.random() < 0.4) {
    // reverse / multi-step: solve for an unknown coordinate given a fixed distance
    const q = mc(y2, [y1 - dy, y1 + dx, dy, y1 + dist]);
    return {
      category: 'Numerical', topic: 'coordinate geometry', type: 'distance',
      promptHTML: `The distance between <b>(${x1}, ${y1})</b> and <b>(${x2}, k)</b> is <b>${dist}</b>. Given <b>k &gt; ${y1}</b>, find <b>k</b>.`,
      ...q, explanation: `(${x2}−${x1})² + (k−${y1})² = ${dist}² → (k−${y1})² = ${dist ** 2} − ${dx ** 2} = ${dy ** 2}, so k−${y1} = ${dy} → k = ${y2}.`,
    };
  }
  // base mode — all distractors strictly positive (Manhattan dx+dy is the classic trap)
  const q = mc(dist, [dx + dy, dist - 1, dist + 1, dist + 3]);
  return {
    category: 'Numerical', topic: 'coordinate geometry', type: 'distance',
    promptHTML: `What is the <b>distance</b> between the points <b>(${x1}, ${y1})</b> and <b>(${x2}, ${y2})</b>?`,
    ...q, explanation: `Distance = √[(${x2}−${x1})² + (${y2}−${y1})²] = √(${dx ** 2} + ${dy ** 2}) = √${dx ** 2 + dy ** 2} = ${dist}.`,
  };
}

function genFalseWeight() {
  const W = pick([900, 800, 750, 960, 950, 875, 920, 850, 940, 625, 500]);
  const profit = Math.round((1000 - W) / W * 10000) / 100;
  // distractors stay near the true profit% — the base-1000 trap plus small near-misses; no absurd 100–500% decoy
  const q = mc(profit, [Math.round((1000 - W) / 1000 * 100), profit + 2, profit - 2, profit + 5], pct);
  return {
    category: 'Numerical', topic: 'profit & loss', type: 'false-weight',
    promptHTML: `A dishonest dealer sells goods at cost price but uses a weight of only <b>${W} g</b> in place of <b>1000 g</b>. What is the <b>profit percent</b>?`,
    ...q, explanation: `Gain% = (true − used)/used × 100 = (1000 − ${W})/${W} × 100 = ${profit}%. (Using 1000 as the base — (1000−${W})/1000 — is the trap; the dealer's cost is for ${W} g.)`,
  };
}

function genExamMarks() {
  const [X, p, m] = pick([[30, 40, 30], [25, 35, 40], [40, 50, 25], [33, 40, 21], [20, 30, 50], [45, 55, 18],
    [36, 45, 27], [30, 45, 60], [28, 40, 36], [40, 60, 50], [35, 50, 45], [24, 36, 48]]);
  const M = 100 * m / (p - X);
  const pass = Math.round(p * M / 100);
  const q = mc(M, [M + 50, M - 50, Math.round(100 * m / p), pass]);
  return {
    category: 'Numerical', topic: 'percentages', type: 'exam-marks',
    promptHTML: `A student scores <b>${X}%</b> in an exam and fails by <b>${m} marks</b>. The pass mark is <b>${p}%</b>. What are the <b>maximum marks</b>?`,
    ...q, explanation: `The gap (${p}% − ${X}%) = ${p - X}% of the maximum equals the ${m} shortfall → max = 100×${m}/${p - X} = ${M}.`,
  };
}

/* =======================================================================
   ELITE TIER — genuinely hard, MULTI-STEP, trap-engineered families that
   exceed the official GMAT-Focus / CAT hard ceiling. Each requires ≥2–3
   conceptual steps; distractors map to specific reasoning errors; answers
   are computed from inputs so keys are correct by construction.
   ======================================================================= */

function genLastTwoDigits() {
  // bases idempotent mod 100 (e.g. 76) are dropped — they trivially answer themselves
  const [a, n] = pick([[2, 12], [3, 24], [7, 47], [8, 77], [12, 128], [13, 12], [17, 22], [23, 47], [27, 77], [33, 128], [39, 12], [49, 33], [57, 47], [63, 77], [29, 53], [87, 12], [91, 22], [99, 47]]);
  const ans = modpow(a, n, 100);
  const pad = (v) => String(((v % 100) + 100) % 100).padStart(2, '0');
  const wrongs = []; for (let c = 1; wrongs.length < 4; c++) { const w = (ans + c * 7) % 100; if (w !== ans && !wrongs.includes(w)) wrongs.push(w); }
  const m = mcStr(pad(ans), wrongs.map(pad), () => pad(rint(10, 99)));
  return {
    category: 'Numerical', topic: 'number properties', type: 'last-two-digits',
    promptHTML: `What are the <b>last two digits</b> of <b>${a}<sup>${n}</sup></b>?`,
    ...m, explanation: `Last two digits = ${a}<sup>${n}</sup> mod 100. Powers of ${a} mod 100 are eventually periodic (period dividing 20 for bases coprime to 100; the even/non-coprime cases split via CRT into mod 4 and mod 25). Reducing the exponent within that cycle gives ${a}<sup>${n}</sup> ≡ ${pad(ans)} (mod 100).`,
  };
}

function genHighestPowerFactorial() {
  const [N, k] = pick([[50, 12], [100, 12], [80, 18], [100, 6], [120, 15], [150, 24], [200, 12], [100, 45], [60, 36], [90, 15], [120, 18], [200, 45], [100, 24], [150, 18]]);
  const fac = primeFactors(k);
  const perPrime = fac.map(([p, e]) => ({ p, e, leg: legendre(p, N), q: Math.floor(legendre(p, N) / e) }));
  const ans = Math.min(...perPrime.map(x => x.q));
  const wrongs = [Math.max(...perPrime.map(x => x.q)), perPrime[0].leg, perPrime[perPrime.length - 1].leg, ans + 1, ans - 1];
  const m = mc(ans, wrongs);
  return {
    category: 'Numerical', topic: 'number properties', type: 'highest-power',
    promptHTML: `What is the <b>highest power of ${k}</b> that divides <b>${N}!</b> &nbsp;(largest n with ${k}<sup>n</sup> | ${N}!)?`,
    ...m, explanation: `${k} = ${primeFactorStr(k)}. Exponent of each prime in ${N}! (Legendre): ${perPrime.map(x => `${x.p}→${x.leg} (÷${x.e}=${x.q})`).join(', ')}. The binding prime gives the minimum = <b>${ans}</b>.`,
  };
}

function genRemainderFactorialSum() {
  // Σ k·k! = (n+1)! − 1 (telescoping, since k·k! = (k+1)! − k!)
  const [n, m] = pick([[10, 13], [12, 17], [15, 23], [20, 19], [11, 16], [13, 18], [9, 23], [14, 17], [16, 19], [10, 23], [12, 29], [18, 31]]);
  let f = 1n; const M = BigInt(m);
  for (let k = 1; k <= n + 1; k++) f = (f * BigInt(k)) % (M * 720n); // keep it bounded but exact mod M
  const ans = Number(((f - 1n) % M + M) % M);
  const wrongs = []; for (let c = 1; wrongs.length < 4; c++) { const w = (ans + c) % m; if (w !== ans && !wrongs.includes(w)) wrongs.push(w); }
  const q = mc(ans, wrongs);
  return {
    category: 'Numerical', topic: 'number properties', type: 'rem-factorial-sum',
    promptHTML: `Find the <b>remainder</b> when <b>1·1! + 2·2! + 3·3! + … + ${n}·${n}!</b> is divided by <b>${m}</b>.`,
    ...q, explanation: `Each term telescopes: k·k! = (k+1)! − k!, so the whole sum collapses to ${n + 1}! − 1. Now reduce ${n + 1}! modulo the prime ${m} (Wilson's theorem, (${m}−1)! ≡ −1, lets you shortcut it); then subtract 1 → remainder <b>${ans}</b>.`,
  };
}

function genUnitDigitTower() {
  // units digit of a power TOWER a^(b^c): reduce the giant exponent within a's last-digit cycle
  // bases restricted to last digit ∈ {2,3,7,8} → cycle length 4, so the exponent reduction always matters
  const [a, b, c] = pick([[2, 3, 4], [3, 4, 5], [7, 2, 10], [8, 3, 3], [17, 3, 3], [23, 2, 8], [2, 7, 3], [3, 3, 5], [7, 4, 4], [12, 3, 3], [13, 5, 2], [2, 2, 20], [3, 2, 15], [8, 5, 3]]);
  const E = BigInt(b) ** BigInt(c);
  const ans = modpow(a, E, 10);
  const cyc = residueCycle(a % 10, 10), L = cyc.length;
  const er = Number(E % BigInt(L));
  const wrongs = []; for (let k = 1; wrongs.length < 4; k++) { const w = (ans + k) % 10; if (w !== ans && !wrongs.includes(w)) wrongs.push(w); }
  const q = mc(ans, wrongs);
  return {
    category: 'Numerical', topic: 'number properties', type: 'units-digit-tower',
    promptHTML: `What is the <b>units digit</b> of <b>${a}^(${b}^${c})</b> &nbsp;(a power tower)?`,
    ...q, explanation: `The last digit of ${a} repeats every ${L} powers: ${cyc.join(', ')}. You must reduce the whole exponent ${b}^${c} modulo the cycle length ${L} (not the base 10): ${b}^${c} ≡ ${er} (mod ${L}), which picks out units digit <b>${ans}</b>. (Forgetting to reduce the exponent — or reducing it mod 10 — is the trap.)`,
  };
}

function genCountDivisible() {
  // three-set inclusion–exclusion: divisible by NONE of a, b, c
  const [N, a, b, c] = pick([[100, 2, 3, 5], [200, 3, 4, 5], [300, 2, 5, 7], [500, 3, 5, 6], [1000, 2, 3, 7], [120, 4, 5, 6], [210, 2, 3, 7], [180, 3, 4, 9], [400, 2, 5, 8], [252, 2, 3, 5], [300, 3, 4, 5], [600, 4, 5, 6]]);
  const L = (u, v) => u * v / gcd2(u, v), L3 = (u, v, w) => L(L(u, v), w);
  const sa = Math.floor(N / a), sb = Math.floor(N / b), sc = Math.floor(N / c);
  const sab = Math.floor(N / L(a, b)), sbc = Math.floor(N / L(b, c)), sca = Math.floor(N / L(c, a)), sabc = Math.floor(N / L3(a, b, c));
  const uni = sa + sb + sc - sab - sbc - sca + sabc, ans = N - uni;
  const wrongs = [uni, N - sa - sb - sc, N - (sa + sb + sc - sab - sbc - sca), ans + 10];
  const q = mc(ans, wrongs);
  return {
    category: 'Numerical', topic: 'number properties', type: 'count-divisible',
    promptHTML: `How many integers from <b>1 to ${N}</b> are divisible by <b>none of ${a}, ${b} or ${c}</b>?`,
    ...q, explanation: `By inclusion–exclusion, divisible by at least one = (${sa}+${sb}+${sc}) − (${sab}+${sbc}+${sca}) + ${sabc} = ${uni}. None = ${N} − ${uni} = <b>${ans}</b>. (Forgetting the triple-overlap add-back is the classic trap.)`,
  };
}

function genSetMaxMin() {
  const [N, a, b, c] = pick([[100, 80, 75, 70], [100, 90, 85, 80], [200, 150, 140, 130], [100, 85, 80, 75], [120, 100, 90, 85], [100, 95, 90, 70], [100, 92, 88, 76], [150, 120, 110, 100], [100, 88, 82, 80], [80, 70, 65, 60], [200, 160, 150, 140], [100, 78, 76, 72], [60, 50, 45, 40]]);
  const ans = a + b + c - 2 * N; // minimum who are in all three (curated so 0 < ans < min)
  const cmin = Math.min(a, b, c);
  // every distractor is a logically possible overlap: 0 < v ≤ min(a,b,c)
  const wrongs = [...new Set([cmin, ans + 5, ans - 5, ans + 10, Math.round((ans + cmin) / 2)].filter(v => v > 0 && v <= cmin && v !== ans))].slice(0, 4);
  const q = mc(ans, wrongs);
  return {
    category: 'Numerical', topic: 'set theory', type: 'set-max-min',
    promptHTML: `In a group of <b>${N}</b> people, <b>${a}</b> own a phone, <b>${b}</b> own a laptop and <b>${c}</b> own a tablet. <b>At least how many</b> own all three?`,
    ...q, explanation: `Minimum overlap of three sets = (${a}+${b}+${c}) − 2×${N} = ${a + b + c} − ${2 * N} = <b>${ans}</b>. (max(0, ΣA − (k−1)N); since the sum exceeds 2×${N}, that many MUST be common.)`,
  };
}

function genQuadraticSym() {
  // S²−4P is deliberately NOT a perfect square → roots are irrational, so factoring can't shortcut Vieta
  const [S, P] = pick([[4, 2], [5, 3], [5, 5], [6, 4], [6, 7], [7, 7], [7, 11], [8, 8], [8, 14], [9, 10], [9, 19], [10, 12], [10, 23], [11, 15], [11, 29], [12, 17]]);
  const sq2 = S * S - 2 * P;
  const mode = pick(['sq', 'cube', 'diffsq', 'quart']);
  let ans, ask, wrongs, expl;
  if (mode === 'sq') { ans = sq2; ask = 'α² + β²'; wrongs = [S * S, S * S - P, P, ans + 2]; expl = `α²+β² = (α+β)² − 2αβ = ${S}² − 2·${P} = ${ans}.`; }
  else if (mode === 'cube') { ans = S * S * S - 3 * P * S; ask = 'α³ + β³'; wrongs = [S * S * S, S * S * S - P * S, S * S * S - 3 * P, ans + 3]; expl = `α³+β³ = (α+β)³ − 3αβ(α+β) = ${S}³ − 3·${P}·${S} = ${ans}.`; }
  else if (mode === 'quart') { ans = sq2 * sq2 - 2 * P * P; ask = 'α⁴ + β⁴'; wrongs = [sq2 * sq2, S * S * S * S, sq2 * sq2 - P * P, ans + 4]; expl = `α⁴+β⁴ = (α²+β²)² − 2(αβ)² = ${sq2}² − 2·${P}² = ${ans}.`; }
  else { ans = S * S - 4 * P; ask = '(α − β)²'; wrongs = [S * S, sq2, P, ans + 2]; expl = `(α−β)² = (α+β)² − 4αβ = ${S}² − 4·${P} = ${ans}.`; }
  const m = mc(ans, wrongs);
  return {
    category: 'Numerical', topic: 'algebra', type: 'quadratic-sym',
    promptHTML: `α and β are the roots of <b>x² − ${S}x + ${P} = 0</b>. Find <b>${ask}</b>.`,
    ...m, explanation: `The roots here are irrational, so factoring is futile — use Vieta: α+β = ${S}, αβ = ${P}. ${expl}`,
  };
}

function genFunctionIterate() {
  const fr = (num, den) => { if (den < 0) { num = -num; den = -den; } const g = gcd2(Math.abs(num), Math.abs(den)) || 1; return (den / g) === 1 ? `${num / g}` : `${num / g}/${den / g}`; };
  // three distinct Möbius maps with periods 3, 2, 4 — defeats memorising the one famous example
  const FUNCS = {
    A: { label: '1/(1 − x)', period: 3, val: (a, r) => r === 0 ? [a, 1] : r === 1 ? [1, 1 - a] : [a - 1, a] },
    B: { label: '1/x', period: 2, val: (a, r) => r === 0 ? [a, 1] : [1, a] },
    C: { label: '(1 + x)/(1 − x)', period: 4, val: (a, r) => r === 0 ? [a, 1] : r === 1 ? [1 + a, 1 - a] : r === 2 ? [-1, a] : [a - 1, a + 1] },
  };
  const [id, a, n] = pick([['A', 2, 5], ['A', 3, 7], ['A', 2, 10], ['B', 3, 9], ['B', 2, 21], ['B', 5, 8], ['C', 2, 6], ['C', 3, 9], ['C', 4, 7], ['C', 2, 11], ['A', 4, 8], ['B', 4, 15], ['C', 5, 10], ['A', 5, 13]]);
  const f = FUNCS[id], r = n % f.period;
  const correct = fr(...f.val(a, r));
  const cands = Array.from({ length: f.period }, (_, k) => fr(...f.val(a, k))).concat([fr(1, a), fr(-1, a)]);
  const wrongs = [...new Set(cands)].filter(s => s !== correct);
  const m = mcStr(correct, wrongs, () => fr(rint(1, 7), rint(2, 9)));
  return {
    category: 'Numerical', topic: 'algebra', type: 'fn-iterate',
    promptHTML: `If f(x) = ${f.label}, what do you get when f is <b>applied ${n} times</b> to <b>${a}</b>?`,
    ...m, explanation: `Iterating f is periodic with period ${f.period}. Since ${n} mod ${f.period} = ${r}, the ${n}-fold iterate of ${a} is <b>${correct}</b>.`,
  };
}

function genInequalityModCount() {
  // varied gap + parity, and some c < gap (no-solution trap); count is brute-forced so it's always exact
  const [a, b, c] = pick([[2, 7, 9], [1, 6, 8], [3, 9, 10], [2, 8, 11], [4, 10, 12], [1, 5, 3], [3, 7, 5], [2, 9, 7], [5, 12, 14], [1, 8, 15], [2, 6, 4], [4, 11, 9], [3, 10, 6], [2, 7, 4]]);
  const d = b - a;
  let ans = 0; for (let x = a - 40; x <= b + 40; x++) if (Math.abs(x - a) + Math.abs(x - b) <= c) ans++;
  const m = mc(ans, [c + 1, c, Math.max(0, c - 1), d + 1]);
  return {
    category: 'Numerical', topic: 'algebra', type: 'ineq-mod-count',
    promptHTML: `How many <b>integer</b> values of x satisfy <b>|x − ${a}| + |x − ${b}| ≤ ${c}</b>?`,
    ...m, explanation: c < d
      ? `|x−${a}| + |x−${b}| is always ≥ the gap ${d}. Since ${c} < ${d}, <b>no</b> x qualifies → the answer is 0.`
      : `The distance-sum is ≥ ${d} (the gap) and ≤ ${c} on a symmetric interval about [${a},${b}]; counting integers there gives <b>${ans}</b>. (Blindly using "c+1" ignores the gap/parity — that's the trap.)`,
  };
}

function genMultiStagePercent() {
  const [p, q, s, V] = pick([[20, 10, 20, 8000], [20, 10, 25, 12000], [20, 10, 50, 20000], [20, 20, 20, 10000], [20, 20, 25, 16000], [20, 20, 50, 8000], [20, 25, 20, 12000], [20, 25, 25, 20000], [20, 25, 50, 10000], [25, 10, 20, 16000], [25, 10, 25, 8000], [25, 10, 50, 12000], [25, 20, 20, 20000], [25, 20, 25, 10000], [25, 20, 50, 16000], [25, 25, 20, 8000]]);
  const C = V * (1 + s / 100), B = C * (1 - q / 100), A = B * (1 + p / 100);
  const m = mc(A, [V * (1 + (p - q + s) / 100), Math.round(B), Math.round(C), V * (1 + s / 100) * (1 - q / 100) * (1 - p / 100)], money);
  return {
    category: 'Numerical', topic: 'percentages', type: 'multi-pct',
    promptHTML: `A's income is <b>${p}% more</b> than B's; B's is <b>${q}% less</b> than C's; and C's is <b>${s}% more</b> than D's. If D earns <b>${money(V)}</b>, what is <b>A's income</b>?`,
    ...m, explanation: `D = ${money(V)} → C = ×(1+${s}/100) = ${money(C)} → B = ×(1−${q}/100) = ${money(B)} → A = ×(1+${p}/100) = <b>${money(A)}</b>. (Adding the three percentages off one base is the trap — each acts on a different base.)`,
  };
}

function genTSDfaster() {
  const [v, s, t] = pick([[30, 5, 1], [30, 5, 2], [36, 6, 1], [36, 6, 2], [40, 5, 1], [40, 5, 2], [45, 5, 1], [45, 5, 2], [48, 6, 1], [48, 6, 2], [50, 5, 1], [50, 5, 2], [60, 5, 1], [60, 6, 1], [72, 6, 1], [72, 9, 1]]);
  const D = v * (v + s) * t / s;
  const m = mc(v, [v + s, v - s, v + 5, Math.round(D / t)]);
  return {
    category: 'Numerical', topic: 'speed & distance', type: 'tsd-faster',
    promptHTML: `A train covers <b>${D} km</b> at a uniform speed. Had its speed been <b>${s} km/h more</b>, it would have taken <b>${t} hour${t > 1 ? 's' : ''} less</b>. Find its <b>original speed</b> (km/h).`,
    ...m, explanation: `${D}/v − ${D}/(v+${s}) = ${t}  ⇒  ${t}·v² + ${t * s}·v − ${D * s} = 0, whose positive root is v = <b>${v}</b> km/h.`,
  };
}

function genWork3Pairwise() {
  // params constrained so each implied solo rate is strictly positive (a real, possible scenario)
  const [x, y, z] = pick([[4, 4, 6], [4, 4, 14], [5, 5, 10], [6, 6, 9], [6, 6, 15], [7, 7, 21], [8, 8, 12], [8, 10, 24], [9, 10, 18], [9, 12, 18], [10, 10, 20], [10, 15, 18], [12, 12, 18], [12, 15, 20]]);
  const inv = 1 / x + 1 / y + 1 / z;
  const T = Math.round(2 / inv * 100) / 100;
  const m = mc(T, [Math.round(1 / inv * 100) / 100, Math.round((x + y + z) / 3 * 100) / 100, x + y + z, T + 1]);
  return {
    category: 'Numerical', topic: 'work & time', type: 'work3-pairwise',
    promptHTML: `A and B together finish a job in <b>${x} days</b>, B and C in <b>${y} days</b>, and C and A in <b>${z} days</b>. How long will <b>all three together</b> take?`,
    ...m, explanation: `Adding the three pairwise rates double-counts everyone: (1/${x} + 1/${y} + 1/${z}) = 2·(1/A+1/B+1/C), so the combined rate is half of that, giving all-three time = <b>${T}</b> days.`,
  };
}

function genProbDrawThree() {
  const [r, g, b] = pick([[3, 4, 5], [2, 3, 4], [4, 4, 4], [3, 3, 3], [2, 4, 6], [5, 3, 2], [3, 5, 4], [4, 3, 5], [2, 5, 3], [6, 4, 2], [3, 4, 3], [4, 5, 6], [5, 4, 3], [4, 4, 3]]);
  const n = r + g + b, tot = nCk(n, 3);
  const mode = pick(['alldiff', 'atleast1red', 'exactly2red']);
  let fav, ask, expl;
  if (mode === 'alldiff') { fav = r * g * b; ask = 'all three are of <b>different colours</b>'; expl = `Favourable = one of each = ${r}×${g}×${b} = ${fav}.`; }
  else if (mode === 'atleast1red') { fav = tot - nCk(n - r, 3); ask = '<b>at least one is red</b>'; expl = `Use the complement: ways with NO red = C(${n - r},3) = ${nCk(n - r, 3)}, so favourable = ${tot} − ${nCk(n - r, 3)} = ${fav}.`; }
  else { fav = nCk(r, 2) * (n - r); ask = '<b>exactly two are red</b>'; expl = `Favourable = C(${r},2) × (non-red) = ${nCk(r, 2)} × ${n - r} = ${fav}.`; }
  const correct = frac(fav, tot);
  const wrongs = [frac(r * g * b, n * n * n), frac(nCk(r, 2) + nCk(g, 2) + nCk(b, 2), tot), frac(tot - fav, tot), frac(fav, tot - 1)];
  const m = mcStr(correct, wrongs, () => frac(rint(1, 6), rint(7, 20)));
  return {
    category: 'Numerical', topic: 'probability & counting', type: 'prob-draw-three',
    promptHTML: `A bag has <b>${r} red</b>, <b>${g} green</b> and <b>${b} blue</b> balls. Three are drawn at random <b>without replacement</b>. What is the probability that ${ask}?`,
    ...m, explanation: `Total ways = C(${n},3) = ${tot}. ${expl} P = ${fav}/${tot} = <b>${correct}</b>.`,
  };
}

function genConeRecast() {
  const exact = Math.random() < 0.5;
  const [R, H, r] = exact
    ? pick([[3, 4, 1], [3, 8, 1], [3, 12, 1], [4, 3, 1], [4, 4, 1], [4, 6, 1], [6, 3, 1], [6, 4, 1], [6, 6, 1], [8, 3, 1], [8, 3, 2], [8, 4, 1], [9, 4, 1], [9, 8, 3], [9, 12, 3]])
    : pick([[5, 5, 1], [5, 7, 1], [5, 9, 1], [7, 5, 1], [7, 7, 1], [7, 7, 2], [9, 5, 1], [9, 5, 2], [9, 7, 1], [10, 5, 2], [10, 7, 2], [10, 9, 2], [11, 5, 1], [11, 5, 2]]);
  const raw = R * R * H / (4 * r ** 3);
  const count = exact ? raw : Math.floor(raw);
  const wrongs = exact
    ? [Math.round(R * R * H / (r ** 3)), Math.round(R * R * H / (3 * r ** 3)), count + 2, Math.max(1, count - 2)]
    : [Math.ceil(raw), Math.round(raw), count + 2, Math.max(1, count - 2)];
  const m = mc(count, wrongs);
  return {
    category: 'Numerical', topic: 'mensuration', type: 'cone-recast',
    promptHTML: `A solid metal cone of base radius <b>${R} cm</b> and height <b>${H} cm</b> is melted and recast into solid spheres of radius <b>${r} cm</b>. How many ${exact ? 'spheres are formed' : '<b>complete</b> spheres can be made'}?`,
    ...m, explanation: exact
      ? `Volume conserved: ⅓πR²H = N·(4/3)πr³ ⇒ N = R²H/(4r³) = ${R}²·${H}/(4·${r}³) = <b>${count}</b>.`
      : `N = R²H/(4r³) = ${R}²·${H}/(4·${r}³) = ${Math.round(raw * 1000) / 1000}…, so only <b>${count}</b> COMPLETE spheres can be cast — the leftover metal can't fill another (rounding up is the trap).`,
  };
}

function genCIfind() {
  // doubling/powers: becoming baseᵏ× takes k periods, NOT a linear scaling of time
  const [t, base, k] = pick([[4, 2, 2], [5, 2, 3], [6, 2, 2], [8, 2, 3], [10, 2, 2], [4, 2, 4], [5, 3, 2], [6, 3, 2], [4, 3, 3], [8, 3, 2], [12, 2, 3], [6, 2, 4], [5, 2, 2], [10, 3, 2]]);
  const mult = base ** k, ans = k * t;
  const m = mc(ans, [(k - 1) * t, (k + 1) * t, base ** (k - 1) * t, ans + 1]);
  return {
    category: 'Numerical', topic: 'interest', type: 'ci-doubling',
    promptHTML: `A sum of money becomes <b>${base} times</b> itself in <b>${t} years</b> at compound interest. In how many years will it become <b>${mult} times</b> itself at the same rate?`,
    ...m, explanation: `Becoming ${base}× means (1 + r/100)<sup>${t}</sup> = ${base}. Since ${mult} = ${base}<sup>${k}</sup>, you need ${k} such periods: ${k} × ${t} = <b>${ans}</b> years. (Scaling time linearly with the multiple is the trap.)`,
  };
}

function genAvgChange() {
  // weighted-average REVERSE: recover a group size from the overall and two sub-group averages
  const [n, A, B, C] = pick([[30, 60, 70, 50], [30, 60, 72, 52], [30, 60, 72, 54], [40, 60, 70, 50], [40, 60, 70, 54], [40, 60, 72, 52], [45, 60, 70, 52], [45, 60, 72, 54], [45, 60, 76, 52], [50, 60, 76, 56], [50, 62, 70, 50], [50, 62, 70, 54], [60, 60, 72, 56], [60, 60, 76, 52], [60, 60, 76, 56]]);
  const boys = n * (A - C) / (B - C);
  const m = mc(boys, [n - boys, Math.round(n / 2), Math.round(n * (A - C) / (B - A)), boys + 5]);
  return {
    category: 'Numerical', topic: 'averages', type: 'avg-weighted',
    promptHTML: `A class of <b>${n}</b> students has an overall average score of <b>${A}</b>. The boys average <b>${B}</b> and the girls average <b>${C}</b>. How many <b>boys</b> are in the class?`,
    ...m, explanation: `By the weighted-average (alligation) rule, boys : girls = (${A}−${C}) : (${B}−${A}). So boys = ${n} × (${A}−${C})/(${B}−${C}) = ${n} × ${A - C}/${B - C} = <b>${boys}</b>.`,
  };
}

/* =======================================================================
   REGISTRY + TEST BUILDER
   ======================================================================= */

const GENS = {
  Numerical: [genDiscount, genRaise, genAvgRemoved, genPipes, genSI, genProfit, genRatioShare, genAges,
    genCompoundInterest, genMixture, genSuccessiveDiscount, genBoatStream, genRelativeTrains,
    genBarChart, genLineChart, genPieChart, genTable],
  // Hard tier — CAT/GMAT-level multi-step word problems, all fresh templates.
  // Questions still carry category 'Numerical' (for the results breakdown) but
  // each has its own `topic` so the pacing table groups them meaningfully.
  NumericalHard: [genWorkEfficiency, genWorkLeave, genSuccessivePct, genInversePct, genCIvsSI,
    genMarkupDiscount, genMixtureReplace, genAvgSpeed, genTrainPlatform, genPartnership,
    genReplaceAvg, genDigitReverse, genProbBalls, genCombinatorics, genHcfLcm, genRatioAdd,
    genClockAngle, genAlligation,
    // extra CAT/GMAT families (number theory, sets, progressions, mensuration, coordinate geometry)
    genRemainderPower, genUnitsDigit, genTrailingZeros, genFactorCount, genTwoSets, genThreeSets,
    genAPsum, genGPsum, genCubePaint, genCylinder, genCoordGeo, genFalseWeight, genExamMarks],
  // ELITE tier — multi-step, trap-engineered, above the official GMAT-Focus / CAT hard ceiling.
  // Powers the "Quant" and "Quant blitz" modes (see testTypes.js).
  NumericalElite: [genLastTwoDigits, genHighestPowerFactorial, genRemainderFactorialSum, genUnitDigitTower,
    genCountDivisible, genSetMaxMin, genQuadraticSym, genFunctionIterate, genInequalityModCount,
    genMultiStagePercent, genTSDfaster, genWork3Pairwise, genProbDrawThree, genConeRecast, genCIfind, genAvgChange],
  Logic: [genSeriesHard, genAlphaNumSeries, genCodingHard, genInterleaved, genOperatorSub,
    genSyllogism, genMirrorClock, genBloodRelation, genDirection, genGridNumber, genAnalogy, genLetterSeries],
  // SPATIAL — multi-rule / compound only (the genuinely hard SHL-matrix mechanics).
  // Abstract matrix is weighted x2 because it's the flagship hard type.
  // SHL-style inductive: panel-series (flagship, weighted) + distribution-of-three matrices + analogies.
  Spatial: [genSHLSeries, genSHLSeries, genAbstractMatrix, genAbstractMatrix, genSeriesCompound, genVisualAnalogy, genOddRule, genMatrixColorRot, genInductiveRow],
  Attention: [genExactMatch, genCountIdentical, genSpotDifferent, genCountDifferences],
};

const DEFAULT_PLAN = { Numerical: 15, Logic: 11, Spatial: 8, Attention: 6 };

// Even sampler: cycles through every generator in a category (shuffled) before repeating any,
// so each test surfaces as many distinct question TYPES as possible.
function makeSampler(list) {
  let pool = [];
  return () => { if (pool.length === 0) pool = shuffle([...list]); return pool.pop(); };
}

// Generate n procedural questions of one category.
export function generateQuestions(category, n) {
  // distinct options required for every type except 'spot-different' (which is 4-identical by design)
  const isClean = (q) => q.type === 'spot-different' || new Set(q.options).size === q.options.length;
  const qs = [];
  const next = makeSampler(GENS[category]);   // next() returns a generator fn → call it
  for (let i = 0; i < n; i++) {
    try {
      let q = next()(), tries = 0;
      while (!isClean(q) && tries++ < 8) q = next()();
      q.optionsHTML = q.optionsHTML || false;
      qs.push(q);
    } catch (e) {
      // fallback: simple safe question if a generator hiccups
      qs.push({ category, type: 'fallback', promptHTML: 'What is 2 + 2?', options: ['3', '4', '5', '6', '7'], correct: 1, optionsHTML: false, explanation: '2 + 2 = 4.' });
    }
  }
  return qs;
}

// Interleave so categories don't cluster (real test mixes types). Greedy: each step take the
// category with the MOST remaining that isn't the one just placed — spreads the big buckets out.
export function interleave(qs) {
  const byCat = {};
  for (const q of shuffle(qs)) (byCat[q.category] = byCat[q.category] || []).push(q);
  const mixed = []; let prev = null;
  while (mixed.length < qs.length) {
    const cats = Object.keys(byCat).filter(c => byCat[c].length > 0).sort((a, b) => byCat[b].length - byCat[a].length);
    const choice = cats.find(c => c !== prev) || cats[0];
    mixed.push(byCat[choice].pop());
    prev = choice;
  }
  mixed.forEach((q, i) => { q.n = i + 1; });
  return mixed;
}

export function buildTest(plan = DEFAULT_PLAN) {
  const qs = [];
  for (const [cat, n] of Object.entries(plan)) qs.push(...generateQuestions(cat, n));
  return interleave(qs);
}

export { DEFAULT_PLAN };
