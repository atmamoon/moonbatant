// app.js — UI, state, timer, navigation, results for Ultimate Aptitude.

import { TEST_TYPES, buildTestForType } from './testTypes.js';
import { bankFreshCount, markSeen } from './banks.js';
import { initAnalytics, track } from './analytics.js';

const LOG_KEY = 'ua_history';

const state = {
  mode: 'full',
  totalSeconds: TEST_TYPES.full.seconds,
  questions: [],
  answers: [],      // index chosen, or null
  flagged: [],      // bool
  qTimes: [],       // seconds spent on each question
  qShownAt: null,   // timestamp when the current question appeared
  current: 0,
  remaining: TEST_TYPES.full.seconds,
  timerId: null,
  startedAt: null,
  finished: false,
};

const $ = (sel) => document.querySelector(sel);
const ABC = ['A', 'B', 'C', 'D', 'E'];

/* ---------------- screens ---------------- */
function show(screen) {
  ['start', 'test', 'results'].forEach(s => $('#screen-' + s).classList.toggle('hidden', s !== screen));
}

/* ---------------- start / new test ---------------- */
async function startTest(mode = state.mode) {
  const t = TEST_TYPES[mode] || TEST_TYPES.full;
  let questions;
  try {
    questions = await buildTestForType(mode in TEST_TYPES ? mode : 'full');
  } catch (e) {
    alert(`Couldn't build the test: ${e.message}\n(Question banks need the page served over http://, not file://.)`);
    return;
  }
  state.mode = mode;
  state.totalSeconds = t.seconds;
  state.questions = questions;
  state.answers = state.questions.map(() => null);
  state.flagged = state.questions.map(() => false);
  state.qTimes = state.questions.map(() => 0);
  state.qShownAt = Date.now();
  state.current = 0;
  state.remaining = t.seconds;
  state.finished = false;
  state.startedAt = Date.now();
  track('test_started', {
    test_type: state.mode,
    test_label: t.label,
    questions: state.questions.length,
    time_limit_sec: t.seconds,
  });
  $('#timer').textContent = fmtTime(t.seconds);
  show('test');
  renderPalette();
  renderQuestion();
  startTimer();
}

/* ---------------- mode picker (rendered from TEST_TYPES config) ---------------- */
function renderModePicker() {
  const wrap = $('#mode-picker');
  wrap.innerHTML = '';
  for (const [key, t] of Object.entries(TEST_TYPES)) {
    const btn = document.createElement('button');
    btn.className = 'mode-card' + (t.featured ? ' primary-card' : '');
    btn.dataset.mode = key;
    btn.innerHTML = `<span class="mode-title">${t.label}</span>
      <span class="mode-spec">${t.spec}</span>
      <span class="mode-desc">${t.desc}</span>
      <span class="mode-fresh" data-fresh="${key}"></span>`;
    btn.addEventListener('click', () => startTest(key));
    wrap.appendChild(btn);
  }
  // async decoration: unseen-question counts for bank-backed types
  for (const [key, t] of Object.entries(TEST_TYPES)) {
    const banks = [...new Set(t.blocks.filter(b => b.source === 'bank').map(b => b.bank))];
    if (!banks.length) continue;
    Promise.all(banks.map(bankFreshCount))
      .then(counts => {
        const el = document.querySelector(`[data-fresh="${key}"]`);
        if (el) el.textContent = `${counts.reduce((a, b) => a + b, 0)} unseen questions left`;
      })
      .catch(() => { /* banks unreachable — card still works, error surfaces on start */ });
  }
}

/* ---------------- timer ---------------- */
function fmtTime(s) {
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${String(ss).padStart(2, '0')}`;
}
function startTimer() {
  clearInterval(state.timerId);
  updateTimer();
  state.timerId = setInterval(() => {
    state.remaining -= 1;
    updateTimer();
    if (state.remaining <= 0) { clearInterval(state.timerId); finishTest('time'); }
  }, 1000);
}
function updateTimer() {
  const el = $('#timer');
  el.textContent = fmtTime(Math.max(0, state.remaining));
  el.classList.toggle('warn', state.remaining <= 120 && state.remaining > 30);
  el.classList.toggle('danger', state.remaining <= 30);
}

/* ---------------- render question (forward-only) ---------------- */
function renderQuestion() {
  const q = state.questions[state.current];
  const last = state.current === state.questions.length - 1;
  $('#q-counter').textContent = `Question ${state.current + 1} of ${state.questions.length}`;
  $('#q-category').textContent = q.category;
  $('#q-prompt').innerHTML = q.promptHTML;

  const optsWrap = $('#q-options');
  optsWrap.innerHTML = '';
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option' + (state.answers[state.current] === i ? ' selected' : '');
    btn.innerHTML = `<span class="opt-letter">${ABC[i]}</span><span class="opt-body">${opt}</span>`;
    // selecting is changeable only while ON this question; click again to clear (skip).
    btn.addEventListener('click', () => {
      state.answers[state.current] = (state.answers[state.current] === i) ? null : i;
      renderQuestion();
      renderPalette();
    });
    optsWrap.appendChild(btn);
  });

  const adv = $('#advance-btn');
  const hasSel = state.answers[state.current] != null;
  adv.textContent = (hasSel ? 'Lock in' : 'Skip (leave blank)') + (last ? ' & Finish' : ' & Next →');
  adv.classList.toggle('locked-in', hasSel);
}

// Display-only progress (forward-only: passed questions are locked, not clickable).
function renderPalette() {
  const wrap = $('#palette');
  wrap.innerHTML = '';
  state.questions.forEach((q, i) => {
    const b = document.createElement('div');
    let cls = 'pal';
    if (i === state.current) cls += ' current';
    else if (i < state.current) cls += (state.answers[i] != null ? ' answered' : ' skipped');
    else cls += ' upcoming';
    b.className = cls;
    b.textContent = i + 1;
    wrap.appendChild(b);
  });
  const answered = state.answers.filter((a, i) => a != null && i <= state.current).length;
  const skipped = state.answers.filter((a, i) => a == null && i < state.current).length;
  $('#answered-count').textContent = `${answered} answered · ${skipped} skipped · Q${state.current + 1}/${state.questions.length}`;
}

/* ---------------- forward-only advance ---------------- */
// Accumulate time on the current question and reset the clock (accumulating
// handles re-entry, e.g. a cancelled submit dialog).
function recordQTime() {
  if (state.qShownAt == null) return;
  state.qTimes[state.current] += (Date.now() - state.qShownAt) / 1000;
  state.qShownAt = Date.now();
}

function advance() {
  if (state.finished) return;
  if (state.current >= state.questions.length - 1) { finishTest('complete'); return; }
  recordQTime();
  state.current += 1;                 // previous question is now locked & unreachable
  renderQuestion(); renderPalette();
}

/* ---------------- anonymous analytics (see analytics.js for the privacy contract) ---------------- */
// One event per question actually reached, plus a test-level summary. Question
// ids are bank-position ids ("advanced:41") or null for generated questions —
// nothing about the person, only about the question.
function trackFinish(reason) {
  const reached = state.current + 1;
  state.questions.slice(0, reached).forEach((q, i) => {
    track('question_answered', {
      question_id: q.id || null,
      source: q.id ? 'bank' : 'generated',
      category: q.category,
      topic: q.topic || null,
      difficulty: q.difficulty || null,
      test_type: state.mode,
      answered: state.answers[i] != null,
      correct: state.answers[i] === q.correct,
      time_sec: Math.round(state.qTimes[i] * 10) / 10,
    });
  });
  let correct = 0, answered = 0;
  state.questions.forEach((q, i) => {
    if (state.answers[i] != null) answered++;
    if (state.answers[i] === q.correct) correct++;
  });
  track('test_completed', {
    test_type: state.mode,
    test_label: (TEST_TYPES[state.mode] || TEST_TYPES.full).label,
    reason, // 'complete' | 'time' | 'manual'
    correct,
    total: state.questions.length,
    answered,
    score_pct: Math.round((correct / state.questions.length) * 100),
    duration_sec: state.totalSeconds - Math.max(0, state.remaining),
  });
}

/* ---------------- finish + results ---------------- */
function finishTest(reason = 'manual') {
  if (state.finished) return;
  const unanswered = state.answers.filter(a => a == null).length;
  if (reason === 'manual' && unanswered > 0) {
    if (!confirm(`End the test now? ${unanswered} question(s) will be left blank (scored as wrong — there's no penalty for guessing).`)) return;
  }
  recordQTime();
  state.finished = true;
  clearInterval(state.timerId);
  // Mark as seen ONLY the questions actually reached (forward-only: indices
  // 0..current are opened; anything past `current` was never opened — e.g. time
  // ran out — so it stays unseen and can come back next time).
  markSeen(state.questions.slice(0, state.current + 1).map(q => q.id));
  trackFinish(reason);
  renderResults(reason === 'time');
  show('results');
}

function renderResults(auto) {
  const cats = {};
  let correct = 0, answered = 0;
  state.questions.forEach((q, i) => {
    cats[q.category] = cats[q.category] || { correct: 0, total: 0 };
    cats[q.category].total++;
    if (state.answers[i] !== null) answered++;
    if (state.answers[i] === q.correct) { correct++; cats[q.category].correct++; }
  });
  const total = state.questions.length;
  const scorePct = Math.round((correct / total) * 100);
  const used = state.totalSeconds - Math.max(0, state.remaining);

  $('#result-score').textContent = `${correct} / ${total}`;
  $('#result-pct').textContent = `${scorePct}%`;
  $('#result-meta').innerHTML =
    `Answered <b>${answered}/${total}</b>${total - answered ? ` &middot; <span class="leak">${total - answered} left blank</span>` : ' &middot; <span class="good">no blanks 🎉</span>'}`
    + ` &middot; Time used <b>${fmtTime(used)}</b>${auto ? ' (auto-submitted)' : ''}`;

  // donut
  const ring = $('#score-ring');
  ring.style.background = `conic-gradient(var(--accent) ${scorePct * 3.6}deg, #e6e9f0 0)`;

  // category bars
  const cb = $('#category-bars');
  cb.innerHTML = '';
  Object.entries(cats).forEach(([cat, s]) => {
    const p = Math.round((s.correct / s.total) * 100);
    cb.insertAdjacentHTML('beforeend',
      `<div class="catbar"><div class="catbar-top"><span>${cat}</span><span>${s.correct}/${s.total} &middot; ${p}%</span></div>
       <div class="catbar-track"><div class="catbar-fill" style="width:${p}%"></div></div></div>`);
  });

  // pacing analysis (per topic for bank questions, per category otherwise)
  const budget = state.totalSeconds / total; // fair share of the clock per question
  const topicStats = renderPacing(budget);

  // review list
  const rv = $('#review-list');
  rv.innerHTML = '';
  state.questions.forEach((q, i) => {
    const chosen = state.answers[i];
    const ok = chosen === q.correct;
    const status = chosen === null ? 'blank' : (ok ? 'ok' : 'bad');
    const yourAns = chosen === null ? '<i>blank</i>' : `${ABC[chosen]}. ${q.options[chosen]}`;
    const secs = state.qTimes[i];
    const tCls = secs <= budget ? 't-ok' : secs <= budget * 1.5 ? 't-warn' : 't-bad';
    rv.insertAdjacentHTML('beforeend', `
      <details class="review-item ${status}">
        <summary>
          <span class="rv-num">Q${i + 1}</span>
          <span class="rv-cat">${q.category}</span>
          ${q.topic ? `<span class="rv-tag">${q.topic}</span>` : ''}
          ${q.difficulty ? `<span class="rv-tag diff">${q.difficulty}</span>` : ''}
          <span class="rv-time ${tCls}">${Math.round(secs)}s</span>
          <span class="rv-mark">${status === 'ok' ? '✓' : status === 'blank' ? '○' : '✗'}</span>
        </summary>
        <div class="rv-body">
          <div class="rv-prompt">${q.promptHTML}</div>
          <div class="rv-line">Your answer: <b>${yourAns}</b></div>
          <div class="rv-line">Correct: <b>${ABC[q.correct]}. ${q.options[q.correct]}</b></div>
          <div class="rv-expl">${q.explanation}</div>
        </div>
      </details>`);
  });

  // persist this attempt + refresh the on-screen log
  logResult({
    ts: Date.now(),
    mode: state.mode,
    modeLabel: (TEST_TYPES[state.mode] || TEST_TYPES.full).label,
    correct, total, pct: scorePct, answered,
    usedSec: used,
    avgSec: Math.round((used / total) * 10) / 10,
    cats: Object.fromEntries(Object.entries(cats).map(([c, s]) => [c, [s.correct, s.total]])),
    topics: Object.fromEntries(Object.entries(topicStats).map(([t, s]) => [t, [s.correct, s.total, Math.round(s.secs)]])),
  });
  renderHistory('#results-history');
}

/* ---------------- pacing analysis ---------------- */
// Groups questions by topic (bank) or category (generated), then flags each
// group by where the time went vs the per-question budget. Returns the stats
// so the session log can persist them.
function renderPacing(budget) {
  const groups = {};
  let okSec = 0, okN = 0, badSec = 0, badN = 0, blankSec = 0, blankN = 0;
  state.questions.forEach((q, i) => {
    const key = q.topic || q.category;
    const g = groups[key] = groups[key] || { correct: 0, total: 0, secs: 0 };
    g.total++; g.secs += state.qTimes[i];
    if (state.answers[i] === null) { blankSec += state.qTimes[i]; blankN++; }
    else if (state.answers[i] === q.correct) { g.correct++; okSec += state.qTimes[i]; okN++; }
    else { badSec += state.qTimes[i]; badN++; }
  });

  // headline: where the seconds went
  const avg = (s, n) => n ? Math.round(s / n) : null;
  const aOk = avg(okSec, okN), aBad = avg(badSec, badN), aBlank = avg(blankSec, blankN);
  const parts = [];
  if (aOk != null) parts.push(`<b class="good">${aOk}s</b> avg on correct`);
  if (aBad != null) parts.push(`<b class="leak">${aBad}s</b> avg on wrong`);
  if (aBlank != null) parts.push(`<b>${aBlank}s</b> avg on blanks`);
  let note = `${parts.join(' &middot; ')} &middot; budget <b>${Math.round(budget)}s</b>/question.`;
  if (aBad != null && aOk != null && aBad > aOk * 1.3) {
    note += ` <span class="leak">You're sinking time into questions you miss — cut losses sooner and guess-and-go.</span>`;
  }
  $('#pacing-note').innerHTML = note;

  // per-topic table, slowest first
  const verdict = (g) => {
    const a = g.secs / g.total, acc = g.correct / g.total;
    if (a > budget * 1.4 && acc < 0.5) return ['sink', '⛔ Time sink — guess fast in tests, drill after'];
    if (a > budget * 1.4) return ['slow', '🐢 Accurate but slow — drill for speed'];
    if (a <= budget && acc < 0.5) return ['rushed', '⚠️ Fast but wrong — slow down a touch'];
    return ['good', '✓ On pace'];
  };
  const rows = Object.entries(groups)
    .sort((x, y) => y[1].secs / y[1].total - x[1].secs / x[1].total)
    .map(([t, g]) => {
      const [cls, label] = verdict(g);
      return `<tr class="pace-${cls}">
        <td>${t}</td><td>${g.correct}/${g.total}</td>
        <td><b>${Math.round(g.secs / g.total)}s</b></td><td>${Math.round(g.secs)}s</td>
        <td class="pace-verdict">${label}</td></tr>`;
    }).join('');
  $('#pacing-table').innerHTML =
    `<table><thead><tr><th>Topic</th><th>Score</th><th>Avg/Q</th><th>Total</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table>`;
  return groups;
}

/* ---------------- results log (localStorage) ---------------- */
function loadLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch { return []; }
}
function saveLog(log) {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch { /* private mode / quota */ }
}
function logResult(entry) {
  const log = loadLog();
  log.push(entry);
  saveLog(log);
  syncLogFile(); // best-effort: write practice-log.md into the project (local server.py only)
}
// POST the rendered markdown to the local server, which writes it to the repo.
// No-ops silently if served from a plain static host (file stays in localStorage).
function syncLogFile() {
  try {
    fetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'text/markdown' }, body: buildMarkdown() })
      .then(r => { const el = $('#sync-note'); if (el) el.textContent = r.ok ? '✓ Saved to practice-log.md in your project' : ''; })
      .catch(() => {});
  } catch { /* ignore */ }
}
function fmtDate(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function renderHistory(sel) {
  const el = $(sel);
  if (!el) return;
  const log = loadLog().slice().reverse(); // newest first
  if (!log.length) { el.innerHTML = '<div class="hist-empty">No sessions logged yet — finish a test and it shows up here.</div>'; return; }
  const rows = log.map(e => `
    <tr>
      <td>${fmtDate(e.ts)}</td>
      <td>${e.modeLabel || e.mode}</td>
      <td><b>${e.correct}/${e.total}</b> &middot; ${e.pct}%</td>
      <td>${e.answered}/${e.total} ans</td>
      <td>${fmtTime(e.usedSec)}</td>
      <td>${e.avgSec != null ? e.avgSec + 's' : '—'}</td>
    </tr>`).join('');
  el.innerHTML = `<table><thead><tr><th>Date</th><th>Mode</th><th>Score</th><th>Attempted</th><th>Time</th><th>Avg/Q</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function buildMarkdown() {
  const log = loadLog();
  if (!log.length) return '# Ultimate Aptitude — Practice Log\n\n_No sessions logged yet._\n';
  let md = '# Ultimate Aptitude — Practice Log\n\n| Date | Mode | Score | % | Attempted | Time | Avg/Q | Slowest topics | Per-category |\n|---|---|---|---|---|---|---|---|---|\n';
  for (const e of log) {
    const cats = e.cats ? Object.entries(e.cats).map(([c, [a, b]]) => `${c} ${a}/${b}`).join(', ') : '';
    const slow = e.topics
      ? Object.entries(e.topics)
          .sort((x, y) => y[1][2] / y[1][1] - x[1][2] / x[1][1])
          .slice(0, 3)
          .map(([t, [c, n, s]]) => `${t} ${Math.round(s / n)}s (${c}/${n})`)
          .join(', ')
      : '';
    md += `| ${fmtDate(e.ts)} | ${e.modeLabel || e.mode} | ${e.correct}/${e.total} | ${e.pct}% | ${e.answered}/${e.total} | ${fmtTime(e.usedSec)} | ${e.avgSec != null ? e.avgSec + 's' : ''} | ${slow} | ${cats} |\n`;
  }
  return md;
}
function exportLog() {
  const blob = new Blob([buildMarkdown()], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ultimate-aptitude-log.md';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function clearLog() {
  if (!confirm('Clear your entire practice log? This cannot be undone.')) return;
  saveLog([]);
  syncLogFile(); // overwrite the project file with the empty log too
  renderHistory('#history-table');
  renderHistory('#results-history');
  refreshHistoryVisibility();
}
function refreshHistoryVisibility() {
  $('#history-wrap').classList.toggle('hidden', loadLog().length === 0);
}

/* ---------------- review filter ---------------- */
function filterReview(mode) {
  document.querySelectorAll('.review-item').forEach(el => {
    el.style.display = (mode === 'all' || el.classList.contains(mode)) ? '' : 'none';
  });
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.f === mode));
}

/* ---------------- wire up ---------------- */
function init() {
  initAnalytics();
  renderModePicker();
  $('#advance-btn').addEventListener('click', advance);
  $('#submit-btn').addEventListener('click', () => finishTest('manual'));
  $('#new-test-btn').addEventListener('click', () => startTest(state.mode)); // same mode, fresh questions
  $('#review-toggle').addEventListener('click', () => $('#review-list').classList.toggle('hidden'));
  $('#export-log').addEventListener('click', exportLog);
  $('#results-export').addEventListener('click', exportLog);
  $('#clear-log').addEventListener('click', clearLog);
  document.querySelectorAll('.filter-btn').forEach(b => b.addEventListener('click', () => filterReview(b.dataset.f)));

  // keyboard: 1-5 select · → or Enter to lock & advance (forward-only, no going back)
  document.addEventListener('keydown', (e) => {
    if ($('#screen-test').classList.contains('hidden')) return;
    if (e.key >= '1' && e.key <= '5') {
      const i = +e.key - 1;
      const q = state.questions[state.current];
      if (i < q.options.length) { state.answers[state.current] = i; renderQuestion(); renderPalette(); }
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      advance();
    }
  });

  renderHistory('#history-table');
  refreshHistoryVisibility();
  show('start');
}

document.addEventListener('DOMContentLoaded', init);
