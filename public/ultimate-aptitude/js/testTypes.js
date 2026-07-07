// testTypes.js — test definitions, fully decoupled from question sources.
//
// A test type = timing + a composition of blocks. Each block pulls from either:
//   { source: 'gen',  category, n }            — procedural generators (infinite, aptitude-test style)
//   { source: 'bank', bank, n, filter? }       — a static JSON bank (banks.js, no-repeat across sessions)
// Adding a new test = adding an entry here. The UI renders whatever this exports.

import { generateQuestions, interleave } from './generators.js';
import { drawFromBank } from './banks.js';

// Topic filters over the 'advanced' bank, used to mirror official CAT/GMAT section weights.
const inTopics = (...t) => (q) => t.includes(q.topic);
const ADV = {
  algebra: inTopics('algebra-equations', 'algebra-inequalities', 'algebra-functions', 'progressions'),
  arithmetic: inTopics('arithmetic-advanced', 'statistics'), // GMAT/CAT file statistics under arithmetic
  geometry: inTopics('geometry-triangles', 'geometry-circles', 'geometry-coordinate', 'mensuration'),
  number: inTopics('number-remainders', 'number-factors'),
  modern: inTopics('permutations-combinations', 'probability', 'set-theory'),
  stats: inTopics('statistics'),
};
const DI_ONLY = inTopics('di-tables', 'di-mixed', 'di-games'); // DI sets within the dilr bank
const DI_STATS = (q) => q.skill === 'statistics'; // stats-flavored items in the dataInsights bank
// GMAT Focus Quant = Problem Solving only — geometry & mensuration were removed from the Quant section.
const noGeometry = (q) => !['geometry-triangles', 'geometry-circles', 'geometry-coordinate', 'mensuration'].includes(q.topic);

export const TEST_TYPES = {
  full: {
    label: 'Full mock',
    spec: '40 Q · 20:00',
    desc: 'All 4 categories, real test conditions',
    seconds: 20 * 60,
    blocks: [
      { source: 'gen', category: 'Numerical', n: 15 },
      { source: 'gen', category: 'Logic', n: 11 },
      { source: 'gen', category: 'Spatial', n: 8 },
      { source: 'gen', category: 'Attention', n: 6 },
    ],
  },
  quant: {
    label: 'Quant only',
    spec: '20 Q · 20:00',
    desc: 'Hardest quant — 12 fresh elite multi-step generators + 8 hand-crafted, above-the-official-ceiling bank items',
    seconds: 20 * 60,
    featured: true,
    blocks: [
      { source: 'gen', category: 'NumericalElite', n: 12 },
      { source: 'bank', bank: 'advanced', n: 8 },
    ],
  },
  quantBlitz: {
    label: 'Quant blitz',
    spec: '10 Q · 8:00',
    desc: 'Hardest quant under pace pressure (48s/Q) — 6 elite generators + 4 above-ceiling bank items',
    seconds: 8 * 60,
    blocks: [
      { source: 'gen', category: 'NumericalElite', n: 6 },
      { source: 'bank', bank: 'advanced', n: 4 },
    ],
  },
  quantCore: {
    label: 'Quant (core)',
    spec: '20 Q · 22:00',
    desc: 'Core hard-quant warm-up — single-concept templates across 31 topics, fresh every time. Ramp up before the Elite modes.',
    seconds: 22 * 60,
    blocks: [{ source: 'gen', category: 'NumericalHard', n: 20 }],
  },
  gmat: {
    label: 'GMAT style',
    spec: '20 Q · 25:00',
    desc: 'GMAT/CAT-level question bank — hard multi-step quant + logic, ~75s/question',
    seconds: 25 * 60,
    blocks: [
      { source: 'bank', bank: 'numerical', n: 16 },
      { source: 'bank', bank: 'logic', n: 4 },
    ],
  },

  // ---- Fresh hard banks (GMAT-Focus / CAT level, no-repeat across sessions) ----
  advancedPS: {
    label: 'Advanced PS',
    spec: '20 Q · 40:00',
    desc: 'Fresh hard/very-hard Problem Solving — algebra, geometry, number theory, P&C, probability, statistics. 366-question bank, none seen before.',
    seconds: 40 * 60,
    featured: true,
    blocks: [{ source: 'bank', bank: 'advanced', n: 20 }],
  },
  dataSufficiency: {
    label: 'Data Sufficiency',
    spec: '15 Q · 25:00',
    desc: 'GMAT Data Sufficiency (5-verdict) — arithmetic, algebra, number properties, geometry, word problems. The trap-heavy GMAT type.',
    seconds: 25 * 60,
    blocks: [{ source: 'bank', bank: 'ds', n: 15 }],
  },
  dilrSets: {
    label: 'DI & LR sets',
    spec: '12 Q · 30:00',
    desc: 'CAT DILR — seating/arrangement, grouping, scheduling, data-table caselets, tournaments. Each item carries its full puzzle stimulus.',
    seconds: 30 * 60,
    blocks: [{ source: 'bank', bank: 'dilr', n: 12 }],
  },
  statsDrill: {
    label: 'Statistics drill',
    spec: '15 Q · 30:00',
    desc: 'Statistics only, above the GMAT ceiling — SD/variance rules, mean–median–mode construction, weighted averages, frequency tables, plus stats-flavored Data Insights (DS, two-part, table & graph reads).',
    seconds: 30 * 60,
    featured: true,
    blocks: [
      { source: 'bank', bank: 'advanced', n: 9, filter: ADV.stats },
      { source: 'bank', bank: 'numerical', n: 2, filter: ADV.stats },
      { source: 'bank', bank: 'dataInsights', n: 4, filter: DI_STATS },
    ],
  },

  // ---- Full mocks mirroring the official section blueprints ----
  catQA: {
    label: 'CAT QA mock',
    spec: '22 Q · 40:00',
    desc: 'Mirrors CAT Quantitative Ability weights: Arithmetic + Algebra ~60%, then Geometry/Mensuration, Number systems, Modern math.',
    seconds: 40 * 60,
    featured: true,
    blocks: [
      { source: 'bank', bank: 'advanced', n: 7, filter: ADV.algebra },
      { source: 'bank', bank: 'advanced', n: 5, filter: ADV.arithmetic },
      { source: 'bank', bank: 'advanced', n: 5, filter: ADV.geometry },
      { source: 'bank', bank: 'advanced', n: 3, filter: ADV.number },
      { source: 'bank', bank: 'advanced', n: 2, filter: ADV.modern },
    ],
  },
  gmatFocus: {
    label: 'GMAT Focus (Quant + DI)',
    spec: '20 Q · 45:00',
    desc: 'GMAT Focus Edition: Problem Solving (algebra/arithmetic/number — no geometry) plus Data Insights (Data Sufficiency + Data Interpretation).',
    seconds: 45 * 60,
    blocks: [
      { source: 'bank', bank: 'advanced', n: 5, filter: ADV.algebra },
      { source: 'bank', bank: 'advanced', n: 3, filter: ADV.arithmetic },
      { source: 'bank', bank: 'advanced', n: 2, filter: ADV.number },
      { source: 'bank', bank: 'advanced', n: 1, filter: ADV.modern },
      { source: 'bank', bank: 'ds', n: 6 },
      { source: 'bank', bank: 'dilr', n: 3, filter: DI_ONLY },
    ],
  },

  // ---- GMAT Focus Edition's other two sections (mirror real section length & timing) ----
  verbal: {
    label: 'Verbal Reasoning',
    spec: '23 Q · 45:00',
    desc: 'GMAT Focus Verbal — Critical Reasoning + Reading Comprehension at 655–805 level. No sentence correction (matches the current exam). Passage questions stay grouped, like the real test.',
    seconds: 45 * 60,
    featured: true,
    sectioned: true,
    blocks: [{ source: 'bank', bank: 'verbal', n: 23 }],
  },
  dataInsights: {
    label: 'Data Insights',
    spec: '20 Q · 45:00',
    desc: 'GMAT Focus Data Insights — Data Sufficiency, Multi-Source Reasoning, Table Analysis, Graphics Interpretation & Two-Part Analysis.',
    seconds: 45 * 60,
    featured: true,
    sectioned: true,
    blocks: [{ source: 'bank', bank: 'dataInsights', n: 20 }],
  },

  // ---- Complete GMAT Focus mock: all three sections, in real section order ----
  gmatFull: {
    label: 'Full GMAT mock (3 sections)',
    spec: '64 Q · 2:15:00',
    desc: 'Complete GMAT Focus Edition format — Quant (21, Problem Solving incl. statistics, no geometry) → Verbal (23) → Data Insights (20), kept in section order. 64 questions, 2h15m.',
    seconds: 135 * 60,
    featured: true,
    sectioned: true,
    blocks: [
      { source: 'bank', bank: 'advanced', n: 21, filter: noGeometry },
      { source: 'bank', bank: 'verbal', n: 23 },
      { source: 'bank', bank: 'dataInsights', n: 20 },
    ],
  },
};

// Fisher–Yates shuffle (local; interleave's shuffle isn't exported).
function shuffleArr(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Section-faithful ordering: shuffle the GROUPS (a group = an RC passage / MSR
// source, marked by q.group; standalone questions are their own group) but keep a
// group's members adjacent and in authored order, so a passage and its questions
// stay together exactly like the real test. Used for `sectioned` test types.
function seqGrouped(qs) {
  const idx = (q) => { const p = String(q.id || '').split(':'); return p.length > 1 ? (+p[1] || 0) : 0; };
  const groups = new Map();
  qs.forEach((q, i) => {
    const k = q.group || q.id || ('solo' + i);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(q);
  });
  const out = [];
  for (const k of shuffleArr([...groups.keys()])) {
    out.push(...groups.get(k).slice().sort((a, b) => idx(a) - idx(b)));
  }
  return out;
}

export async function buildTestForType(key) {
  const t = TEST_TYPES[key];
  if (!t) throw new Error(`Unknown test type "${key}"`);
  const blocks = [];
  for (const b of t.blocks) {
    blocks.push(b.source === 'gen'
      ? generateQuestions(b.category, b.n)
      : await drawFromBank(b.bank, b.n, b.filter));
  }
  // Sectioned tests (GMAT-format mocks) keep blocks in order and cluster passage
  // questions; everything else mixes categories so the same type never repeats.
  if (t.sectioned) {
    const ordered = [];
    for (const qs of blocks) ordered.push(...seqGrouped(qs));
    ordered.forEach((q, i) => { q.n = i + 1; });
    return ordered;
  }
  return interleave(blocks.flat());
}
