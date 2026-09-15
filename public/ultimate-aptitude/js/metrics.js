// metrics.js — every number on the progress dashboard, as pure functions.
// No DOM and no storage: callers pass the practice log and the abandoned-
// session records in as plain arrays, so the whole catalogue in
// DASHBOARD-METRICS.md can be unit-tested in node (tools/test-dashboard.mjs).

const DAY_MS = 86400000;

export const RANGES = [
  { key: 'all', label: 'All time', days: null },
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
];

// A fitted slope that moves less than `flat` per 10 sessions reads as flat.
export const TREND_METRICS = {
  accuracy: { label: 'Accuracy', better: 'up', flat: 1 },
  timePerQ: { label: 'Time per question', better: 'down', flat: 0.5 },
  totalTime: { label: 'Total time', better: 'down', flat: 15 },
  abandoned: { label: 'Abandoned', better: 'down', flat: 0.25 },
};
export const MIN_TREND_SESSIONS = 3;
// Earlier-half → recent-half moves on one question type smaller than this are flat.
export const TOPIC_FLAT = { accuracy: 5, timePerQ: 2 };
// A running test whose heartbeat is older than this lost its tab.
export const STALE_MS = 90 * 1000;

const REASONS = ['complete', 'manual', 'time'];

const num = (v, fallback = 0) =>
  (v !== null && v !== '' && typeof v !== 'boolean' && Number.isFinite(Number(v)) ? Number(v) : fallback);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
const mean = (arr) => (arr.length ? sum(arr, (x) => x) / arr.length : null);
const byTs = (a, b) => a.ts - b.ts;
const pad = (n) => String(n).padStart(2, '0');

/* ---------------- calendar helpers (local time, DST-safe) ---------------- */
export function startOfDay(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
// Start of the calendar day `k` days after ts's day.
export function addDays(ts, k) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + k).getTime();
}
export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
// Whole calendar days from a's day to b's day (a 23h or 25h DST day still counts as one).
export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);

export function rangeStart(range, now) {
  const days = RANGES.find((r) => r.key === String(range))?.days;
  return days ? addDays(now, -(days - 1)) : -Infinity;
}

/* ---------------- normalisation ---------------- */
// Turns one stored log row (legacy or schema 2, possibly hand-edited) into a
// clean session, or null if it can't be scored.
export function normalizeSession(e, testTypes = {}) {
  if (!e || typeof e !== 'object' || !Number.isFinite(num(e.ts, NaN))) return null;
  const total = Math.round(num(e.total));
  if (total <= 0) return null;
  const correct = clamp(Math.round(num(e.correct)), 0, total);
  const answered = clamp(Math.round(num(e.answered, total)), correct, total);
  const tt = testTypes[e.mode];
  const usedSec = Math.max(0, num(e.usedSec));
  const limitSec = num(e.limitSec, tt ? tt.seconds : 0) || null;
  const known = REASONS.includes(e.reason);
  const topics = e.topics && typeof e.topics === 'object'
    ? Object.entries(e.topics)
        .filter(([, t]) => Array.isArray(t))
        .map(([key, t]) => {
          const n = Math.round(num(t[1]));
          const c = clamp(Math.round(num(t[0])), 0, Math.max(0, n));
          return { key, correct: c, total: n, secs: Math.max(0, num(t[2])), blank: t.length > 3 ? clamp(num(t[3]), 0, n) : null };
        })
        .filter((t) => t.total > 0)
    : [];
  const split = e.split && typeof e.split === 'object' ? e.split : null;
  return {
    ts: num(e.ts),
    mode: String(e.mode ?? 'unknown'),
    label: e.modeLabel || tt?.label || String(e.mode ?? 'unknown'),
    correct, total, answered,
    blank: total - answered,
    accuracy: (correct / total) * 100,
    hitRate: answered ? (correct / answered) * 100 : null,
    usedSec,
    timePerQ: usedSec / total,
    limitSec,
    reason: known ? e.reason : (limitSec && usedSec >= limitSec ? 'time' : 'complete'),
    reasonInferred: !known,
    reached: e.reached != null ? clamp(Math.round(num(e.reached, total)), 0, total) : null,
    topics,
    split,
  };
}

export function normalizeAbandoned(a, testTypes = {}) {
  if (!a || typeof a !== 'object' || !Number.isFinite(num(a.ts, NaN))) return null;
  const total = Math.round(num(a.total));
  if (total <= 0) return null;
  const tt = testTypes[a.mode];
  const answered = clamp(Math.round(num(a.answered)), 0, total);
  return {
    ts: num(a.ts),
    mode: String(a.mode ?? 'unknown'),
    label: a.modeLabel || tt?.label || String(a.mode ?? 'unknown'),
    total, answered,
    unanswered: total - answered,
    reached: clamp(Math.round(num(a.reached)), 0, total),
    elapsedSec: Math.max(0, num(a.elapsedSec)),
    limitSec: num(a.limitSec, tt ? tt.seconds : 0) || null,
  };
}

const normalizeAll = (rows, f, testTypes) =>
  (Array.isArray(rows) ? rows : []).map((r) => f(r, testTypes)).filter(Boolean).sort(byTs);

/* ---------------- statistics ---------------- */
// Ordinary least squares of y against its index; null/NaN values are gaps.
export function linearTrend(ys) {
  const pts = (ys || []).map((y, x) => [x, y]).filter(([, y]) => Number.isFinite(y));
  const n = pts.length;
  if (n < 2) return null;
  const mx = sum(pts, (p) => p[0]) / n;
  const my = sum(pts, (p) => p[1]) / n;
  let sxy = 0, sxx = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
  const slope = sxx ? sxy / sxx : 0;
  return { slope, intercept: my - slope * mx, n };
}

export function trendVerdict(metric, fit) {
  const m = TREND_METRICS[metric];
  if (!m || !fit || fit.n < MIN_TREND_SESSIONS) return { dir: 'none', per10: null, label: 'Not enough sessions yet' };
  const per10 = fit.slope * 10;
  if (Math.abs(per10) < m.flat) return { dir: 'flat', per10, label: 'Holding steady' };
  const improving = (m.better === 'up') === (per10 > 0);
  return { dir: improving ? 'better' : 'worse', per10, label: improving ? 'Improving' : 'Slipping' };
}

// Last 5 vs the 5 before them once there are 10+ values; newer half vs older half before that.
export function recentVsEarlier(values, window = 5) {
  const v = (values || []).filter(Number.isFinite);
  const n = v.length;
  if (n < 2) return null;
  const k = n >= 2 * window ? window : Math.ceil(n / 2);
  const recent = v.slice(n - k);
  const earlier = v.slice(Math.max(0, n - 2 * k), n - k);
  return { recent: mean(recent), earlier: mean(earlier), delta: mean(recent) - mean(earlier), nRecent: recent.length, nEarlier: earlier.length };
}

// Same thresholds as the results screen's "Pacing by topic" verdicts.
export function pacingVerdict(timePerQ, accuracyFrac, budget) {
  if (!budget) return null;
  if (timePerQ > budget * 1.4 && accuracyFrac < 0.5) return 'sink';
  if (timePerQ > budget * 1.4) return 'slow';
  if (timePerQ <= budget && accuracyFrac < 0.5) return 'rushed';
  return 'good';
}

/* ---------------- A. overall ---------------- */
export function streaks(sessions, now) {
  const days = new Set(sessions.map((s) => dayKey(s.ts)));
  if (!days.size) return { activeDays: 0, currentStreak: 0, longestStreak: 0 };
  const sorted = [...days].sort();
  let longest = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const [y, m, d] = sorted[i - 1].split('-').map(Number);
    run = dayKey(new Date(y, m - 1, d + 1).getTime()) === sorted[i] ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  let cursor = startOfDay(now);
  if (!days.has(dayKey(cursor))) cursor = addDays(cursor, -1); // today not practised yet: streak still alive
  let current = 0;
  while (days.has(dayKey(cursor))) { current++; cursor = addDays(cursor, -1); }
  return { activeDays: days.size, currentStreak: current, longestStreak: longest };
}

export function overallSummary(sessions, abandoned, now) {
  const served = sum(sessions, (s) => s.total);
  const answered = sum(sessions, (s) => s.answered);
  const correct = sum(sessions, (s) => s.correct);
  const usedSec = sum(sessions, (s) => s.usedSec);
  const started = sessions.length + abandoned.length;
  return {
    sessions: sessions.length,
    questions: served, answered, correct, usedSec,
    accuracy: served ? (correct / served) * 100 : null,
    hitRate: answered ? (correct / answered) * 100 : null,
    timePerQ: served ? usedSec / served : null,
    blanks: served - answered,
    blankRate: served ? ((served - answered) / served) * 100 : null,
    abandonedSessions: abandoned.length,
    abandonRate: started ? (abandoned.length / started) * 100 : null,
    ...streaks(sessions, now),
  };
}

export function dailyVolume(sessions, range, now) {
  const days = RANGES.find((r) => r.key === String(range))?.days ?? null;
  if (!sessions.length && !days) return { unit: 'day', bins: [] };
  const from = days ? addDays(now, -(days - 1)) : startOfDay(sessions[0].ts);
  const last = sessions.length ? Math.max(now, sessions[sessions.length - 1].ts) : now;
  const span = daysBetween(from, last) + 1;
  const step = span > 120 ? 7 : 1;
  const bins = Array.from({ length: Math.ceil(span / step) }, (_, k) =>
    ({ start: addDays(from, k * step), days: step, sessions: 0, questions: 0, usedSec: 0 }));
  for (const s of sessions) {
    const b = bins[Math.floor(daysBetween(from, s.ts) / step)];
    if (!b) continue;
    b.sessions++; b.questions += s.total; b.usedSec += s.usedSec;
  }
  return { unit: step === 7 ? 'week' : 'day', bins };
}

export function modeSummaries(sessions, abandoned, testTypes = {}) {
  const groups = new Map();
  const group = (mode) => {
    if (!groups.has(mode)) groups.set(mode, { mode, ss: [], ab: [] });
    return groups.get(mode);
  };
  sessions.forEach((s) => group(s.mode).ss.push(s));
  abandoned.forEach((a) => group(a.mode).ab.push(a));
  return [...groups.values()].map(({ mode, ss, ab }) => {
    const all = [...ss, ...ab].sort(byTs);
    const last = all[all.length - 1];
    const served = sum(ss, (s) => s.total);
    const fit = linearTrend(ss.map((s) => s.accuracy));
    return {
      mode,
      label: testTypes[mode]?.label || last.label,
      sessions: ss.length,
      abandoned: ab.length,
      lastTs: last.ts,
      accuracy: served ? (sum(ss, (s) => s.correct) / served) * 100 : null,
      latestAccuracy: ss.length ? ss[ss.length - 1].accuracy : null,
      timePerQ: served ? sum(ss, (s) => s.usedSec) / served : null,
      accuracyFit: fit,
      accuracyVerdict: trendVerdict('accuracy', fit),
      spark: ss.slice(-12).map((s) => s.accuracy),
    };
  }).sort((a, b) => b.lastTs - a.lastTs);
}

/* ---------------- B. per test type ---------------- */
export function topicTable(sessions, budgetPerQ) {
  const map = new Map();
  for (const s of sessions) {
    for (const t of s.topics) {
      if (!map.has(t.key)) map.set(t.key, []);
      map.get(t.key).push({ ts: s.ts, correct: t.correct, total: t.total, secs: t.secs, blank: t.blank });
    }
  }
  const agg = (occ) => {
    const n = sum(occ, (o) => o.total);
    return n ? { questions: n, accuracy: (sum(occ, (o) => o.correct) / n) * 100, timePerQ: sum(occ, (o) => o.secs) / n } : null;
  };
  return [...map.entries()].map(([key, occ]) => {
    occ.sort(byTs);
    const all = agg(occ);
    const withBlank = occ.filter((o) => o.blank != null);
    const blankServed = sum(withBlank, (o) => o.total);
    // every question of this type left blank: a pacing verdict ("fast but wrong") would misread it
    const neverAnswered = withBlank.length === occ.length && sum(withBlank, (o) => o.blank) === all.questions;
    // earlier half vs recent half of this type's questions, cut at a session boundary
    let early = null, late = null;
    if (occ.length >= 2 && all.questions >= 4) {
      let cut = 0, seen = 0;
      while (cut < occ.length - 1 && seen < all.questions / 2) seen += occ[cut++].total;
      early = agg(occ.slice(0, cut));
      late = agg(occ.slice(cut));
    }
    return {
      key,
      questions: all.questions,
      sessions: occ.length,
      accuracy: all.accuracy,
      timePerQ: all.timePerQ,
      blankRate: blankServed ? (sum(withBlank, (o) => o.blank) / blankServed) * 100 : null,
      early, late,
      verdict: neverAnswered ? 'unanswered' : pacingVerdict(all.timePerQ, all.accuracy / 100, budgetPerQ),
    };
  }).sort((a, b) => a.accuracy - b.accuracy || b.questions - a.questions);
}

export function modeReport(mode, sessions, abandoned, testTypes = {}) {
  const ss = sessions.filter((s) => s.mode === mode);
  const ab = abandoned.filter((a) => a.mode === mode);
  if (!ss.length && !ab.length) return null;
  const tt = testTypes[mode];
  const latest = ss[ss.length - 1] || null;
  const limitSec = latest?.limitSec ?? tt?.seconds ?? ab[ab.length - 1]?.limitSec ?? null;
  const budgetPerQ = latest?.limitSec ? latest.limitSec / latest.total : null;
  const served = sum(ss, (s) => s.total);
  const answered = sum(ss, (s) => s.answered);
  const correct = sum(ss, (s) => s.correct);

  const perSession = (f) => ss.map((s, i) => ({ i, ts: s.ts, y: f(s), kind: 'session', row: s }));
  const series = {
    accuracy: perSession((s) => s.accuracy),
    timePerQ: perSession((s) => s.timePerQ),
    totalTime: perSession((s) => s.usedSec),
    abandoned: [
      ...ss.map((s) => ({ ts: s.ts, y: s.blank, kind: 'session', row: s })),
      ...ab.map((a) => ({ ts: a.ts, y: a.unanswered, kind: 'abandoned', row: a })),
    ].sort(byTs).map((p, i) => ({ ...p, i })),
  };
  const trends = {};
  for (const [k, pts] of Object.entries(series)) {
    const ys = pts.map((p) => p.y);
    const fit = linearTrend(ys);
    trends[k] = { fit, verdict: trendVerdict(k, fit), change: recentVsEarlier(ys) };
  }
  const labelChanges = ss.slice(1)
    .map((s, j) => (s.label !== ss[j].label ? { i: j + 1, ts: s.ts, label: s.label } : null))
    .filter(Boolean);

  return {
    mode,
    label: tt?.label || (latest || ab[ab.length - 1]).label,
    kpis: {
      sessions: ss.length,
      abandonedSessions: ab.length,
      abandonRate: (ab.length / (ss.length + ab.length)) * 100,
      accuracy: served ? (correct / served) * 100 : null,
      hitRate: answered ? (correct / answered) * 100 : null,
      bestAccuracy: ss.length ? Math.max(...ss.map((s) => s.accuracy)) : null,
      latestAccuracy: latest ? latest.accuracy : null,
      timePerQ: served ? sum(ss, (s) => s.usedSec) / served : null,
      avgTotalTime: mean(ss.map((s) => s.usedSec)),
      timedOutPct: ss.length ? (ss.filter((s) => s.reason === 'time').length / ss.length) * 100 : null,
      blanksPerSession: mean(ss.map((s) => s.blank)),
      blanksChange: recentVsEarlier(ss.map((s) => s.blank)),
      limitSec,
      budgetPerQ,
    },
    series,
    trends,
    labelChanges,
    topics: topicTable(ss, budgetPerQ),
    history: [
      ...ss.map((s) => ({ kind: 'session', ...s })),
      ...ab.map((a) => ({ kind: 'abandoned', ...a })),
    ].sort((a, b) => b.ts - a.ts),
  };
}

/* ---------------- whole dashboard ---------------- */
export function buildDashboardModel({ log, abandoned, testTypes = {}, range = 'all', mode = null, now = Date.now() }) {
  const allSessions = normalizeAll(log, normalizeSession, testTypes);
  const allAbandoned = normalizeAll(abandoned, normalizeAbandoned, testTypes);
  const from = rangeStart(range, now);
  const sessions = allSessions.filter((s) => s.ts >= from);
  const ab = allAbandoned.filter((a) => a.ts >= from);
  const modes = modeSummaries(sessions, ab, testTypes);
  const eligible = modes.filter((m) => m.accuracyVerdict.dir !== 'none');
  const selectedMode = modes.some((m) => m.mode === mode) ? mode : (modes[0]?.mode ?? null);
  return {
    range,
    now,
    hasAnyData: allSessions.length + allAbandoned.length > 0,
    empty: sessions.length + ab.length === 0,
    overall: {
      ...overallSummary(sessions, ab, now),
      typesImproving: eligible.filter((m) => m.accuracyVerdict.dir === 'better').length,
      typesWithTrend: eligible.length,
    },
    volume: dailyVolume(sessions, range, now),
    modes,
    selectedMode,
    report: selectedMode ? modeReport(selectedMode, sessions, ab, testTypes) : null,
  };
}

/* ---------------- abandoned-session capture ---------------- */
// A running test counts as abandoned when it belongs to this tab (the page was
// reloaded mid-test) or its heartbeat went stale (the tab that owned it closed).
// A test still ticking in another live tab is kept.
export function sweepInflight(inflight, { tabId, now, staleMs = STALE_MS }) {
  const keep = {}, abandoned = [];
  for (const [id, r] of Object.entries(inflight && typeof inflight === 'object' ? inflight : {})) {
    if (!r || typeof r !== 'object') continue;
    const { tabId: owner, ...record } = r;
    const stale = !(now - num(r.lastSeen, -Infinity) < staleMs);
    if (owner === tabId || stale) abandoned.push(record);
    else keep[id] = r;
  }
  return { keep, abandoned: abandoned.sort(byTs) };
}
