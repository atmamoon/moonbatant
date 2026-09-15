// dashboard.js — draws the progress dashboard: stat tiles, hand-rolled SVG
// charts with a hover + keyboard readout, and sortable tables. Every number
// comes from metrics.js; the ids on screen (A1, B2.3, …) match
// DASHBOARD-METRICS.md. Depends on nothing app-specific, so the same file
// works in any copy of the simulator that passes its log in.

import { RANGES, TREND_METRICS, TOPIC_FLAT, buildDashboardModel } from './metrics.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/* ---------------- formatting ---------------- */
function clock(v) {
  if (v == null) return '—';
  const t = Math.round(v);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
const pct = (v) => (v == null ? '—' : `${Math.round(v)}%`);
const perQ = (v) => (v == null ? '—' : v < 100 ? `${v.toFixed(1)}s` : clock(v));
const one = (v) => (v == null ? '—' : String(Math.round(v * 10) / 10));
function duration(sec) {
  const m = Math.round(sec / 60);
  if (m < 1) return `${Math.round(sec)}s`;
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
const dayLabel = (ts) => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const dateTime = (ts) => `${dayLabel(ts)}, ${new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const DELTA_FMT = {
  accuracy: (d) => `${Math.abs(d).toFixed(1)} pts`,
  timePerQ: (d) => `${Math.abs(d).toFixed(1)}s`,
  totalTime: (d) => `${Math.round(Math.abs(d))}s`,
  abandoned: (d) => `${Math.abs(d).toFixed(2)} Q`,
};
const arrow = (dir, value) => (dir === 'flat' ? '▬' : dir === 'none' ? '·' : value > 0 ? '▲' : '▼');
const PACING = { sink: '⛔ Time sink', slow: '🐢 Accurate but slow', rushed: '⚠️ Fast but wrong', unanswered: '○ Never answered', good: '✓ On pace' };
const PACING_ORDER = ['sink', 'slow', 'rushed', 'unanswered', 'good'];
const ENDED = { complete: 'Finished', manual: 'Submitted early', time: 'Timed out' };

// "last 5 vs previous 5": the arrow says up/down, the colour says whether that is good for this metric
function changeHTML(change, metric) {
  if (!change || !change.nEarlier) return '';
  const { better, flat } = TREND_METRICS[metric];
  const d = change.delta;
  const dir = Math.abs(d) < flat ? 'flat' : (d > 0) === (better === 'up') ? 'better' : 'worse';
  return `<div class="dash-delta ${dir}">${arrow(dir, d)} ${DELTA_FMT[metric](d)} <span class="dash-delta-ctx">last ${change.nRecent} vs previous ${change.nEarlier}</span></div>`;
}

const tile = (id, label, value, sub = '', extra = '') => `
  <div class="dash-tile">
    <div class="dash-tile-label"><span class="dash-id">${id}</span>${label}</div>
    <div class="dash-tile-value">${value}</div>
    ${sub ? `<div class="dash-tile-sub">${sub}</div>` : ''}${extra}
  </div>`;

function endedText(h) {
  if (h.kind === 'abandoned') return `Abandoned at Q${h.reached}/${h.total}`;
  return `${ENDED[h.reason]}${h.reasonInferred ? '*' : ''}`;
}

function splitText(split) {
  if (!split) return '<span class="dash-muted">—</span>';
  const avg = (k) => (Array.isArray(split[k]) && split[k][0] ? perQ(split[k][1] / split[k][0]) : '—');
  return `✓ ${avg('ok')} · ✗ ${avg('bad')}`;
}

// older half of a question type's questions → newer half
function topicTrend(t, metric) {
  if (!t.early) return '<span class="dash-muted" title="Needs at least 4 questions over 2 sessions">—</span>';
  const a = t.early[metric], b = t.late[metric], d = b - a;
  const improving = metric === 'accuracy' ? d > 0 : d < 0;
  const dir = Math.abs(d) < TOPIC_FLAT[metric] ? 'flat' : improving ? 'better' : 'worse';
  const fmt = metric === 'accuracy' ? pct : perQ;
  return `${fmt(a)} → ${fmt(b)} <span class="dash-delta ${dir}">${arrow(dir, d)}</span>`;
}

function sparkline(values) {
  if (values.length < 2) return '';
  const w = 84, h = 22, p = 3;
  const x = (i) => (p + (i / (values.length - 1)) * (w - 2 * p)).toFixed(1);
  const y = (v) => (h - p - (v / 100) * (h - 2 * p)).toFixed(1);
  const last = values.length - 1;
  return `<svg class="dash-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <path d="${values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')}"/><circle cx="${x(last)}" cy="${y(values[last])}" r="2.5"/></svg>`;
}

/* ---------------- charts ---------------- */
const TIME_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 180, 300, 600, 900, 1800, 3600];

function yScale(max, { fixedMax, time, integer }) {
  if (fixedMax) return { top: fixedMax, ticks: [0, 1, 2, 3, 4].map((k) => (k * fixedMax) / 4) };
  const m = max > 0 ? max : 1;
  const raw = m / 4;
  let step;
  if (time) step = TIME_STEPS.find((s) => s >= raw) ?? Math.ceil(raw / 3600) * 3600;
  else {
    const p = 10 ** Math.floor(Math.log10(raw));
    const f = raw / p;
    step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  if (integer) step = Math.max(1, Math.ceil(step));
  const top = Math.max(step, Math.ceil(m / step - 1e-9) * step);
  const ticks = [];
  for (let k = 0; k * step <= top + 1e-9; k++) ticks.push(k * step);
  return { top, ticks };
}

function fillTip(tip, p) {
  const head = document.createElement('div');
  head.className = 'ch-tip-head';
  head.textContent = p.title;
  const rows = p.tip.map(([value, label]) => {
    const row = document.createElement('div');
    row.className = 'ch-tip-row';
    const b = document.createElement('b');
    b.textContent = value;
    row.append(b);
    if (label) { const s = document.createElement('span'); s.textContent = label; row.append(s); }
    return row;
  });
  tip.replaceChildren(head, ...rows);
}

// One series per chart (never two y-scales). `kind` is 'line' or 'column'.
// Sized to the host's real width so axis text stays at its CSS size on phones.
function drawChart(host, spec) {
  const pts = spec.points;
  const n = pts.length;
  if (!n) { host.innerHTML = '<div class="ch-empty">No sessions in this range.</div>'; return; }
  const W = Math.max(240, Math.round(host.clientWidth || 520));
  const H = spec.height || 200;
  const M = { l: 46, r: 14, t: 22, b: 28 };
  const pw = W - M.l - M.r, ph = H - M.t - M.b, base = M.t + ph;
  const column = spec.kind === 'column';
  const band = pw / n;
  const cx = column ? (i) => M.l + band * (i + 0.5) : (i) => M.l + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
  const finite = pts.map((p) => p.y).filter(Number.isFinite);
  const { top, ticks } = yScale(Math.max(0, ...finite, spec.ref?.y ?? 0), spec);
  const cy = (v) => M.t + ph - (Math.min(Math.max(v, 0), top) / top) * ph;
  const r1 = (v) => Math.round(v * 10) / 10;
  let s = '';

  for (const t of ticks) {
    s += `<line class="ch-grid" x1="${M.l}" x2="${W - M.r}" y1="${r1(cy(t))}" y2="${r1(cy(t))}"/>`
      + `<text class="ch-tick" x="${M.l - 8}" y="${r1(cy(t))}" dy="0.32em" text-anchor="end">${esc(spec.tickFmt(t))}</text>`;
  }
  for (const mk of spec.marks || []) {
    if (mk.i <= 0 || mk.i >= n) continue;
    const x = r1((cx(mk.i - 1) + cx(mk.i)) / 2);
    const right = x > W * 0.6;
    s += `<line class="ch-mark" x1="${x}" x2="${x}" y1="${M.t - 6}" y2="${base}"/>`
      + `<text class="ch-mark-label" x="${right ? x - 4 : x + 4}" y="${M.t - 9}" text-anchor="${right ? 'end' : 'start'}">→ ${esc(mk.label)}</text>`;
  }
  if (spec.ref && spec.ref.y > 0) {
    const y = r1(cy(spec.ref.y));
    s += `<line class="ch-ref" x1="${M.l}" x2="${W - M.r}" y1="${y}" y2="${y}"/>`
      + `<text class="ch-ref-label" x="${M.l + 4}" y="${y - 5}">${esc(spec.ref.label)}</text>`;
  }
  s += `<line class="ch-axis" x1="${M.l}" x2="${W - M.r}" y1="${base}" y2="${base}"/>`;

  if (column) {
    const w = Math.max(1, Math.min(24, band - 2)); // 2px surface gap between neighbours
    pts.forEach((p, i) => {
      const x0 = r1(cx(i) - w / 2);
      if (p.y > 0) {
        const yt = cy(p.y), rr = Math.min(4, base - yt, w / 2); // rounded data end, square at the baseline
        s += `<path class="ch-col${p.kind === 'abandoned' ? ' ch-col-alt' : ''}" data-i="${i}" d="M${x0},${base}V${r1(yt + rr)}Q${x0},${r1(yt)} ${r1(x0 + rr)},${r1(yt)}H${r1(x0 + w - rr)}Q${r1(x0 + w)},${r1(yt)} ${r1(x0 + w)},${r1(yt + rr)}V${base}Z"/>`;
      }
      if (p.kind === 'abandoned') s += `<text class="ch-flag" x="${r1(cx(i))}" y="${r1((p.y > 0 ? cy(p.y) : base) - 5)}" text-anchor="middle">✕</text>`;
    });
  } else {
    let d = '', pen = false;
    pts.forEach((p, i) => {
      if (!Number.isFinite(p.y)) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${r1(cx(i))},${r1(cy(p.y))}`;
      pen = true;
    });
    s += `<path class="ch-line" d="${d}"/>`;
    pts.forEach((p, i) => {
      if (Number.isFinite(p.y) && (n <= 60 || i === n - 1)) s += `<circle class="ch-dot" cx="${r1(cx(i))}" cy="${r1(cy(p.y))}" r="4"/>`;
    });
  }
  if (spec.fit && n >= 3) {
    const y0 = spec.fit.intercept, y1 = spec.fit.intercept + spec.fit.slope * (n - 1);
    s += `<line class="ch-fit" x1="${r1(cx(0))}" y1="${r1(cy(y0))}" x2="${r1(cx(n - 1))}" y2="${r1(cy(y1))}"/>`;
  }
  // selective direct label: the latest value only
  const last = pts[n - 1];
  if (!column && Number.isFinite(last.y)) {
    s += `<text class="ch-end" x="${r1(cx(n - 1))}" y="${r1(cy(last.y) - 10)}" text-anchor="${n === 1 ? 'middle' : 'end'}">${esc(spec.valueFmt(last.y))}</text>`;
  }
  const xLabel = (i, anchor) => `<text class="ch-tick" x="${r1(cx(i))}" y="${H - 8}" text-anchor="${anchor}">${esc(spec.xFmt(pts[i]))}</text>`;
  if (n === 1) s += xLabel(0, 'middle');
  else {
    const edge = column && band > 60;
    s += xLabel(0, edge ? 'middle' : 'start') + xLabel(n - 1, edge ? 'middle' : 'end');
    if (n >= 7 && W >= 420) s += xLabel(Math.floor((n - 1) / 2), 'middle');
  }
  s += `<line class="ch-cross" x1="0" x2="0" y1="${M.t}" y2="${base}" visibility="hidden"/>`;
  if (!column) s += '<circle class="ch-halo" r="6" cx="0" cy="0" visibility="hidden"/>';
  s += `<rect class="ch-hit" x="${M.l - 12}" y="0" width="${pw + 24}" height="${H}" fill="transparent"/>`;

  host.innerHTML = `<svg class="ch-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${s}</svg>`
    + '<div class="ch-tip" role="status" aria-live="polite" hidden></div>';

  // hover + keyboard readout: the crosshair snaps to the nearest session
  const svg = host.firstElementChild, tip = host.lastElementChild;
  const cross = svg.querySelector('.ch-cross'), halo = svg.querySelector('.ch-halo');
  let active = -1;
  const hide = () => {
    active = -1;
    cross.setAttribute('visibility', 'hidden');
    halo?.setAttribute('visibility', 'hidden');
    svg.querySelector('.is-active')?.classList.remove('is-active');
    tip.hidden = true;
  };
  const showAt = (i) => {
    active = Math.max(0, Math.min(n - 1, i));
    const p = pts[active], x = r1(cx(active));
    cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible');
    if (halo && Number.isFinite(p.y)) { halo.setAttribute('cx', x); halo.setAttribute('cy', r1(cy(p.y))); halo.setAttribute('visibility', 'visible'); }
    svg.querySelector('.is-active')?.classList.remove('is-active');
    svg.querySelector(`[data-i="${active}"]`)?.classList.add('is-active');
    fillTip(tip, p);
    tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.left = `${x + 14 + tw > W ? Math.max(0, x - 14 - tw) : x + 14}px`;
    tip.style.top = `${M.t}px`;
  };
  const indexAt = (clientX) => {
    const box = svg.getBoundingClientRect();
    const x = (clientX - box.left) * (W / box.width);
    return column ? Math.floor((x - M.l) / band) : Math.round(((x - M.l) / pw) * (n - 1));
  };
  const hit = svg.querySelector('.ch-hit');
  hit.addEventListener('pointermove', (e) => showAt(indexAt(e.clientX)));
  hit.addEventListener('pointerleave', () => { if (document.activeElement !== host) hide(); });
  host.tabIndex = 0;
  host.onfocus = () => showAt(active >= 0 ? active : n - 1);
  host.onblur = hide;
  host.onkeydown = (e) => {
    const cur = active < 0 ? n : active; // nothing shown yet: either arrow starts at the latest session
    const next = { ArrowLeft: cur - 1, ArrowRight: cur + 1, Home: 0, End: n - 1 }[e.key];
    if (next !== undefined) { e.preventDefault(); showAt(next); } else if (e.key === 'Escape') hide();
  };
}

/* ---------------- C. definitions (mirrors DASHBOARD-METRICS.md) ---------------- */
const DEFINITIONS = [
  ['Scope', [['Range', 'Filters every section: all time, or the last 7, 30 or 90 calendar days including today.']]],
  ['A · Overall progress', [
    ['A1', 'Sessions completed: finished tests in range.'],
    ['A2', 'Questions attempted: answered, out of every question served.'],
    ['A3', 'Practice time: total clock used.'],
    ['A4', 'Overall accuracy: correct ÷ served, so a blank counts as wrong, as in the score.'],
    ['A5', 'Accuracy on attempted: correct ÷ answered.'],
    ['A6', 'Time per question: clock used ÷ questions served.'],
    ['A7', 'Streaks: consecutive calendar days with a finished test. Still alive if you last practised yesterday.'],
    ['A8', 'Abandoned: tests started but never finished (the tab was reloaded or closed mid-test), plus questions left blank in finished tests.'],
    ['A9', 'Test types improving: a rising accuracy trendline, out of the types with at least 3 sessions.'],
    ['A10', 'Practice volume: minutes practised per day (per week once the range passes 120 days).'],
    ['A11', 'By test type: sessions, abandoned, last played, pooled and latest accuracy, time per question, accuracy sparkline and trend.'],
  ]],
  ['B · Test report', [
    ['B1', 'Headline figures for one test type. Changes compare the last 5 sessions with the 5 before them (the newer half with the older half under 10 sessions).'],
    ['B2.1–2.3', 'Accuracy, time per question (against the budget) and total time (against the limit), one point per session, with a dashed least-squares trendline. Less than 1 point, 0.5 s or 15 s per 10 sessions reads as steady.'],
    ['B2.4', 'Abandoned: questions left blank in each finished session, and in red the questions never answered in an abandoned one. Less than 0.25 per 10 sessions reads as steady.'],
    ['B3', 'By question type: questions, accuracy, time per question against the budget, blank rate, older-half → newer-half trends (moves under 5 points or 2 s are flat), and the results screen\'s pacing verdict, or Never answered when every question of the type was left blank.'],
    ['B4', 'Session history: every finished and abandoned session, newest first, with how it ended.'],
  ]],
  ['C · Shared terms', [
    ['Pooled', 'A ratio of sums across sessions (question-weighted), not an average of percentages.'],
    ['Budget', 'The session\'s time limit ÷ its questions.'],
    ['Trendline', 'Ordinary least squares over session order. Its slope is the change per session; whether it counts as steady is judged on 10 sessions of that slope.'],
  ]],
];

/* ---------------- the dashboard ---------------- */
export function createDashboard({ root, testTypes, loadLog, loadAbandoned, onStart }) {
  const ui = { range: 'all', mode: null, sort: { key: 'accuracy', dir: 1 } };
  let model = null;
  let specs = {};

  function render(focusSelector) {
    model = buildDashboardModel({ log: loadLog(), abandoned: loadAbandoned(), testTypes, range: ui.range, mode: ui.mode });
    ui.mode = model.selectedMode;
    specs = {};
    root.innerHTML = `<div class="dash">${toolbarHTML()}${model.empty ? emptyHTML() : overallHTML() + reportHTML()}${definitionsHTML()}</div>`;
    wire();
    drawCharts();
    if (focusSelector) root.querySelector(focusSelector)?.focus({ preventScroll: true });
  }

  function drawCharts() {
    root.querySelectorAll('[data-chart]').forEach((host) => { if (specs[host.dataset.chart]) drawChart(host, specs[host.dataset.chart]); });
  }

  const toolbarHTML = () => `
    <header class="dash-toolbar">
      <div>
        <h1 class="dash-h1">📈 Progress dashboard</h1>
        <p class="dash-lede">Every attempt logged in this browser: overall progress first, then a report for one test type. The ids match the definitions at the bottom.</p>
      </div>
      <div class="dash-range" role="group" aria-label="Date range">
        ${RANGES.map((r) => `<button type="button" class="dash-pill" data-range="${r.key}" aria-pressed="${r.key === ui.range}">${r.label}</button>`).join('')}
      </div>
    </header>`;

  const emptyHTML = () => `<div class="card dash-card dash-empty">${model.hasAnyData
    ? '<b>Nothing logged in this range.</b> Your older sessions are still there. <button type="button" class="btn ghost sm" data-range="all">Show all time</button>'
    : '<b>No sessions yet.</b> Finish a test and this fills in. Trendlines appear after 3 sessions of a test type. <a class="btn primary sm" href="./" data-tab="practice">Pick a session</a>'}</div>`;

  /* ----- A. overall ----- */
  function overallHTML() {
    const o = model.overall, v = model.volume;
    const range = RANGES.find((r) => r.key === ui.range).label;
    specs.volume = {
      kind: 'column',
      tickFmt: (t) => `${t}m`,
      xFmt: (p) => dayLabel(p.start),
      points: v.bins.map((b, i) => ({
        i, y: b.usedSec / 60, start: b.start,
        title: v.unit === 'week' ? `Week of ${dayLabel(b.start)}` : new Date(b.start).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
        tip: [[duration(b.usedSec), 'practised'], [String(b.sessions), b.sessions === 1 ? 'session' : 'sessions'], [String(b.questions), 'questions']],
      })),
    };
    const practised = v.bins.filter((b) => b.sessions).reverse();
    return `
    <section class="card dash-card" aria-labelledby="dash-a">
      <div class="dash-sec-head"><span class="dash-sec-letter">A</span><h2 id="dash-a">Overall progress</h2><span class="dash-sec-note">All test types · ${range}</span></div>
      <div class="dash-tiles">
        ${tile('A1', 'Sessions completed', o.sessions, `${o.questions.toLocaleString()} questions served`)}
        ${tile('A2', 'Questions attempted', o.answered.toLocaleString(), `of ${o.questions.toLocaleString()} served`)}
        ${tile('A3', 'Practice time', duration(o.usedSec), o.activeDays ? `about ${duration(o.usedSec / o.activeDays)} per active day` : '')}
        ${tile('A4', 'Overall accuracy', pct(o.accuracy), 'blanks count as wrong')}
        ${tile('A5', 'Accuracy on attempted', pct(o.hitRate), 'correct ÷ answered')}
        ${tile('A6', 'Time per question', perQ(o.timePerQ), 'clock used ÷ questions served')}
        ${tile('A7', 'Current streak', plural(o.currentStreak, 'day'), `longest ${plural(o.longestStreak, 'day')} · ${plural(o.activeDays, 'active day')}`)}
        ${tile('A8', 'Abandoned', plural(o.abandonedSessions, 'session'), `${o.abandonRate == null ? '' : `${pct(o.abandonRate)} of starts · `}${o.blanks.toLocaleString()} questions left blank (${pct(o.blankRate)})`)}
        ${tile('A9', 'Test types improving', o.typesWithTrend ? `${o.typesImproving} of ${o.typesWithTrend}` : '—', o.typesWithTrend ? 'rising accuracy trendline' : 'needs 3 sessions of one type')}
      </div>
      <h3><span class="dash-id">A10</span>Practice volume</h3>
      <figure class="dash-chart-card">
        <figcaption><b>Minutes practised per ${v.unit}</b><span class="dash-muted">hover, or focus and use ← →</span></figcaption>
        <div class="dash-chart" data-chart="volume" aria-label="Minutes practised per ${v.unit}. Arrow keys step through the ${v.unit}s."></div>
        <details class="dash-tableview"><summary>Table view</summary><div class="dash-table-wrap"><table class="dash-table">
          <thead><tr><th>${v.unit === 'week' ? 'Week of' : 'Day'}</th><th>Minutes</th><th>Sessions</th><th>Questions</th></tr></thead>
          <tbody>${practised.map((b) => `<tr><td>${dayLabel(b.start)}</td><td>${Math.round(b.usedSec / 60)}</td><td>${b.sessions}</td><td>${b.questions}</td></tr>`).join('') || '<tr><td colspan="4">No finished sessions in this range.</td></tr>'}</tbody>
        </table></div></details>
      </figure>
      <h3><span class="dash-id">A11</span>By test type <span class="dash-muted">· pick a row for its report</span></h3>
      <div class="dash-table-wrap">
        <table class="dash-table">
          <thead><tr><th>Test type</th><th>Sessions</th><th>Abandoned</th><th>Last played</th><th>Accuracy</th><th>Latest</th><th>Time / Q</th><th>Accuracy trend</th></tr></thead>
          <tbody>${model.modes.map((m) => `
            <tr data-mode="${esc(m.mode)}" tabindex="0" class="${m.mode === ui.mode ? 'is-selected' : ''}">
              <td><b>${esc(m.label)}</b></td><td>${m.sessions}</td><td>${m.abandoned || '—'}</td><td>${dayLabel(m.lastTs)}</td>
              <td>${pct(m.accuracy)}</td><td>${pct(m.latestAccuracy)}</td><td>${perQ(m.timePerQ)}</td>
              <td>${sparkline(m.spark)}<span class="dash-verdict ${m.accuracyVerdict.dir}">${arrow(m.accuracyVerdict.dir, m.accuracyVerdict.per10)} ${m.accuracyVerdict.label}</span></td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </section>`;
  }

  /* ----- B. one test type ----- */
  function reportSpecs(r) {
    const k = r.kpis;
    const title = (p) => `#${p.i + 1} · ${dateTime(p.ts)}`;
    const xFmt = (p) => dayLabel(p.ts);
    const marks = (series) => r.labelChanges.map((c) => ({ i: series.findIndex((p) => p.ts === c.ts), label: c.label }));
    specs.accuracy = {
      kind: 'line', fixedMax: 100, tickFmt: (t) => `${t}%`, valueFmt: pct, xFmt,
      fit: r.trends.accuracy.fit, marks: marks(r.series.accuracy),
      points: r.series.accuracy.map((p) => ({ ...p, title: title(p), tip: [[pct(p.y), 'accuracy'], [`${p.row.correct}/${p.row.total}`, 'score'], [`${p.row.answered}/${p.row.total}`, 'attempted']] })),
    };
    specs.timePerQ = {
      kind: 'line', time: true, tickFmt: (t) => `${t}s`, valueFmt: perQ, xFmt,
      fit: r.trends.timePerQ.fit, marks: marks(r.series.timePerQ),
      ref: k.budgetPerQ ? { y: k.budgetPerQ, label: `budget ${perQ(k.budgetPerQ)}` } : null,
      points: r.series.timePerQ.map((p) => ({ ...p, title: title(p), tip: [[perQ(p.y), 'per question'], [clock(p.row.usedSec), 'clock used']] })),
    };
    specs.totalTime = {
      kind: 'line', time: true, tickFmt: clock, valueFmt: clock, xFmt,
      fit: r.trends.totalTime.fit, marks: marks(r.series.totalTime),
      ref: k.limitSec ? { y: k.limitSec, label: `limit ${clock(k.limitSec)}` } : null,
      points: r.series.totalTime.map((p) => ({ ...p, title: title(p), tip: [[clock(p.y), 'clock used'], [endedText(p.row), '']] })),
    };
    specs.abandoned = {
      kind: 'column', integer: true, tickFmt: String, valueFmt: String, xFmt,
      fit: r.trends.abandoned.fit, marks: marks(r.series.abandoned),
      points: r.series.abandoned.map((p) => ({
        ...p,
        title: `${p.kind === 'abandoned' ? 'Abandoned · ' : ''}${dateTime(p.ts)}`,
        tip: p.kind === 'abandoned'
          ? [[String(p.y), 'never answered'], [`Q${p.row.reached}/${p.row.total}`, 'quit at'], [clock(p.row.elapsedSec), 'into the test']]
          : [[String(p.y), 'left blank'],
             ...(p.row.reached != null && p.row.reached < p.row.total ? [[String(p.row.total - p.row.reached), 'not reached']] : []),
             [endedText(p.row), '']],
      })),
    };
  }

  function chartCard(id, key, title, extra = '') {
    const { verdict: v, fit } = model.report.trends[key];
    // the fitted change per session: scaling a 3-session slope up to "per 10" overstates it
    const slope = v.per10 == null ? '' : ` · ${fit.slope >= 0 ? '+' : '−'}${DELTA_FMT[key](fit.slope)} per session`;
    return `<figure class="dash-chart-card">
      <figcaption><span class="dash-id">${id}</span><b>${title}</b><span class="dash-verdict ${v.dir}">${arrow(v.dir, v.per10)} ${v.label}${slope}</span></figcaption>
      <div class="dash-chart" data-chart="${key}" aria-label="${title} per session. Arrow keys step through sessions."></div>${extra}
    </figure>`;
  }

  function reportHTML() {
    const r = model.report;
    if (!r) return '';
    const k = r.kpis, t = r.trends;
    const first = r.history[r.history.length - 1];
    reportSpecs(r);
    return `
    <section class="card dash-card" id="dash-b" aria-labelledby="dash-b-title">
      <div class="dash-sec-head">
        <span class="dash-sec-letter">B</span><h2 id="dash-b-title">Test report</h2>
        <div class="dash-sec-actions">
          <label class="dash-muted" for="dash-mode-select">Test type</label>
          <select id="dash-mode-select" class="dash-select">${model.modes.map((m) => `<option value="${esc(m.mode)}"${m.mode === r.mode ? ' selected' : ''}>${esc(m.label)} (${m.sessions})</option>`).join('')}</select>
          ${Object.prototype.hasOwnProperty.call(testTypes, r.mode) ? `<button type="button" class="btn primary sm" data-start="${esc(r.mode)}">▶ Start this test</button>` : ''}
        </div>
      </div>
      <h3><span class="dash-id">B1</span>Headline figures</h3>
      <div class="dash-tiles">
        ${tile('B1.1', 'Sessions', k.sessions, `first on ${dayLabel(first.ts)}`)}
        ${tile('B1.2', 'Accuracy', pct(k.accuracy), 'pooled across sessions', changeHTML(t.accuracy.change, 'accuracy'))}
        ${tile('B1.3', 'Best / latest', `${pct(k.bestAccuracy)} <span class="dash-muted">/</span> ${pct(k.latestAccuracy)}`, 'single-session accuracy')}
        ${tile('B1.4', 'Time per question', perQ(k.timePerQ), k.budgetPerQ ? `budget ${perQ(k.budgetPerQ)}` : '', changeHTML(t.timePerQ.change, 'timePerQ'))}
        ${tile('B1.5', 'Total time per session', clock(k.avgTotalTime), k.limitSec ? `limit ${clock(k.limitSec)}` : '', changeHTML(t.totalTime.change, 'totalTime'))}
        ${tile('B1.6', 'Time-outs', pct(k.timedOutPct), 'sessions where the clock ran out')}
        ${tile('B1.7', 'Blanks per session', one(k.blanksPerSession), 'questions left unanswered', changeHTML(k.blanksChange, 'abandoned'))}
        ${tile('B1.8', 'Abandoned sessions', k.abandonedSessions, `${pct(k.abandonRate)} of sessions started`)}
      </div>
      <h3><span class="dash-id">B2</span>Trendlines <span class="dash-muted">· one point per session, dashed line = fitted trend</span></h3>
      <div class="dash-charts">
        ${chartCard('B2.1', 'accuracy', 'Accuracy')}
        ${chartCard('B2.2', 'timePerQ', 'Time per question')}
        ${chartCard('B2.3', 'totalTime', 'Total time')}
        ${chartCard('B2.4', 'abandoned', 'Abandoned', `<div class="dash-legend"><span><i class="k-accent"></i>left blank in a finished session</span><span><i class="k-bad"></i>✕ abandoned session: questions never answered</span><span><i class="k-fit"></i>trend</span></div>`)}
      </div>
      <h3><span class="dash-id">B3</span>By question type</h3>
      <div class="dash-table-wrap" id="dash-topics">${topicsHTML()}</div>
      <h3><span class="dash-id">B4</span>Session history <span class="dash-muted">· also the table view of the B2 charts</span></h3>
      <div class="dash-table-wrap">${historyHTML(r)}</div>
    </section>`;
  }

  const TOPIC_COLS = [
    ['key', 'B3.1', 'Question type'], ['questions', 'B3.2', 'Questions'], ['accuracy', 'B3.3', 'Accuracy'],
    ['timePerQ', 'B3.4', 'Time / Q'], ['blankRate', 'B3.5', 'Blank rate'], ['accTrend', 'B3.6', 'Accuracy trend'],
    ['timeTrend', 'B3.7', 'Time trend'], ['verdict', 'B3.8', 'Verdict'],
  ];
  const TOPIC_SORT = {
    key: (t) => t.key,
    questions: (t) => t.questions,
    accuracy: (t) => t.accuracy,
    timePerQ: (t) => t.timePerQ,
    blankRate: (t) => t.blankRate,
    accTrend: (t) => (t.early ? t.late.accuracy - t.early.accuracy : null),
    timeTrend: (t) => (t.early ? t.late.timePerQ - t.early.timePerQ : null),
    verdict: (t) => (t.verdict ? PACING_ORDER.indexOf(t.verdict) : null),
  };
  const ASCENDING_FIRST = ['key', 'accuracy', 'verdict']; // weakest / worst first on the first click

  function topicsHTML() {
    const r = model.report;
    if (!r.topics.length) return '<div class="dash-muted">No per-question-type data for this test type in this range.</div>';
    const budget = r.kpis.budgetPerQ;
    const get = TOPIC_SORT[ui.sort.key];
    const rows = r.topics.slice().sort((a, b) => {
      const x = get(a), y = get(b);
      if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1; // no data sorts last either way
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * ui.sort.dir;
    });
    const head = TOPIC_COLS.map(([key, id, label]) => {
      const on = ui.sort.key === key;
      return `<th aria-sort="${on ? (ui.sort.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="dash-sort" data-sort="${key}"><span class="dash-id">${id}</span>${label}${on ? (ui.sort.dir > 0 ? ' ↑' : ' ↓') : ''}</button></th>`;
    }).join('');
    const body = rows.map((t) => {
      const chip = !budget ? '' : t.timePerQ <= budget ? 'ok' : t.timePerQ <= budget * 1.5 ? 'warn' : 'bad';
      return `<tr>
        <td><b>${esc(t.key)}</b></td>
        <td>${t.questions} <span class="dash-muted">in ${plural(t.sessions, 'session')}</span></td>
        <td><span class="dash-meter" aria-hidden="true"><i style="width:${Math.round(t.accuracy)}%"></i></span>${pct(t.accuracy)}</td>
        <td><span class="dash-chip ${chip}">${perQ(t.timePerQ)}</span></td>
        <td>${t.blankRate == null ? '<span class="dash-muted" title="Only sessions logged since the dashboard shipped record blanks per question type">—</span>' : pct(t.blankRate)}</td>
        <td>${topicTrend(t, 'accuracy')}</td>
        <td>${topicTrend(t, 'timePerQ')}</td>
        <td class="dash-verdict-cell ${t.verdict || ''}">${t.verdict ? PACING[t.verdict] : '—'}</td>
      </tr>`;
    }).join('');
    return `<table class="dash-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      <div class="dash-muted dash-foot">${budget ? `Time chip: green within the ${perQ(budget)} budget per question, amber up to 1.5×, red beyond. ` : ''}Trends compare the older half of a type's questions with the newer half.</div>`;
  }

  function historyHTML(r) {
    const rows = r.history.map((h) => (h.kind === 'abandoned'
      ? `<tr class="is-abandoned"><td>${dateTime(h.ts)}</td><td>${esc(h.label)}</td><td>—</td><td>—</td><td>${h.answered}/${h.total}</td><td>${h.unanswered}</td><td>${clock(h.elapsedSec)}</td><td>—</td><td>—</td><td>✕ ${endedText(h)}</td></tr>`
      : `<tr><td>${dateTime(h.ts)}</td><td>${esc(h.label)}</td><td><b>${h.correct}/${h.total}</b></td><td>${pct(h.accuracy)}</td><td>${h.answered}/${h.total}</td>
          <td>${h.blank}${h.reached != null && h.reached < h.total ? ` <span class="dash-muted">(${h.total - h.reached} not reached)</span>` : ''}</td>
          <td>${clock(h.usedSec)}</td><td>${perQ(h.timePerQ)}</td><td>${splitText(h.split)}</td><td>${endedText(h)}</td></tr>`)).join('');
    return `<table class="dash-table">
      <thead><tr><th>Date</th><th>Label</th><th>Score</th><th>Accuracy</th><th>Attempted</th><th>Blanks</th><th>Clock used</th><th>Time / Q</th><th>Avg time right · wrong</th><th>Ended</th></tr></thead>
      <tbody>${rows}</tbody></table>
      ${r.history.some((h) => h.reasonInferred) ? '<div class="dash-muted dash-foot">* inferred from the clock, for sessions logged before the dashboard recorded how a session ended.</div>' : ''}`;
  }

  const definitionsHTML = () => `
    <details class="card dash-card dash-defs">
      <summary><span class="dash-sec-letter">C</span> Metric definitions: what every number means</summary>
      ${DEFINITIONS.map(([group, items]) => `<div class="dash-defs-group"><h4>${group}</h4><dl>${items.map(([id, text]) => `<dt>${id}</dt><dd>${text}</dd>`).join('')}</dl></div>`).join('')}
    </details>`;

  function wire() {
    root.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => {
      ui.range = b.dataset.range;
      render(`.dash-range [data-range="${ui.range}"]`);
    }));
    const select = root.querySelector('#dash-mode-select');
    select?.addEventListener('change', () => { ui.mode = select.value; render('#dash-mode-select'); });
    root.querySelectorAll('tr[data-mode]').forEach((tr) => {
      const open = () => {
        ui.mode = tr.dataset.mode;
        render('#dash-mode-select');
        root.querySelector('#dash-b')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      };
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
    root.querySelector('[data-start]')?.addEventListener('click', (e) => onStart?.(e.currentTarget.dataset.start));
    wireSort();
  }

  function wireSort() {
    root.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => {
      const key = b.dataset.sort;
      ui.sort = { key, dir: ui.sort.key === key ? -ui.sort.dir : ASCENDING_FIRST.includes(key) ? 1 : -1 };
      root.querySelector('#dash-topics').innerHTML = topicsHTML();
      wireSort();
      root.querySelector(`[data-sort="${key}"]`)?.focus();
    }));
  }

  // charts are drawn at the container's real width, so redraw when it changes
  let lastWidth = 0;
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      const w = root.clientWidth;
      if (!w || Math.abs(w - lastWidth) < 8) return;
      lastWidth = w;
      drawCharts();
    }).observe(root);
  }

  return { render };
}
