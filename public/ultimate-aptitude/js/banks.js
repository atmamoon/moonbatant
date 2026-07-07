// banks.js — static question banks (JSON files in banks/) + a no-repeat sampler.
//
// A bank is a JSON array of question objects in the simulator's schema:
//   { category, topic?, difficulty?, promptHTML, options[5], correct, optionsHTML?, explanation }
// To add a bank: drop the file in banks/ and register it in BANKS below.

export const BANKS = {
  numerical: 'banks/questions-numerical.json',
  logic: 'banks/questions-logic.json',
  // Fresh GMAT-Focus / CAT-level banks (hard & very-hard only, adversarially key-checked).
  advanced: 'banks/questions-quant-advanced.json', // Problem Solving: algebra, geometry/mensuration, number theory, modern math, hard arithmetic, statistics
  ds: 'banks/questions-data-sufficiency.json',      // GMAT Data Sufficiency (5-verdict)
  dilr: 'banks/questions-dilr.json',                // CAT DILR: arrangements, grouping, scheduling, DI caselets, games
  // GMAT Focus Edition's other two sections (mirror the real exam blueprint).
  verbal: 'banks/questions-verbal.json',            // GMAT Verbal: Critical Reasoning + Reading Comprehension (no sentence correction)
  dataInsights: 'banks/questions-data-insights.json', // GMAT Data Insights: DS + Multi-Source + Table Analysis + Graphics Interp + Two-Part
};

const USED_KEY = 'ua_bank_used'; // localStorage: { bankName: [ids...] } — questions you've actually SEEN (reached in a test), so they don't repeat. Drawing does NOT mark seen; only questions you reach are marked, via markSeen() at finish.

const cache = {};

export async function loadBank(name) {
  if (cache[name]) return cache[name];
  const url = BANKS[name];
  if (!url) throw new Error(`Unknown bank "${name}"`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load bank "${name}" (${res.status})`);
  const items = await res.json();
  // stable id = bank + position in file; validate just enough to not break the test UI
  cache[name] = items
    .filter(q => q && q.promptHTML && Array.isArray(q.options) && q.options.length === 5
      && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 5)
    .map((q, i) => ({ ...q, id: `${name}:${i}`, type: q.topic || 'bank', optionsHTML: q.optionsHTML || false }));
  return cache[name];
}

function loadUsed() {
  try { return JSON.parse(localStorage.getItem(USED_KEY)) || {}; } catch { return {}; }
}
function saveUsed(used) {
  try { localStorage.setItem(USED_KEY, JSON.stringify(used)); } catch { /* private mode / quota */ }
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Draw n questions from a bank, preferring ones never seen before (tracked across
// sessions). Drawing does NOT mark questions seen — only questions you actually
// reach in a test get marked, via markSeen() at finish. So a question you never
// open (e.g. you ran out of time) stays in the unseen pool and can come back.
// When the unseen pool can't fill a test, the seen-set for that bank resets.
export async function drawFromBank(name, n, filter) {
  let pool = await loadBank(name);
  if (filter) pool = pool.filter(filter);
  const used = loadUsed();
  const usedSet = new Set(used[name] || []);
  let fresh = pool.filter(q => !usedSet.has(q.id));
  if (fresh.length < n) { delete used[name]; saveUsed(used); fresh = pool; } // exhausted → recycle the seen-set
  const picked = shuffle([...fresh]).slice(0, n);
  return picked.map(q => ({ ...q }));
}

// Mark specific questions as SEEN. Call at test finish with the ids of the
// questions the user actually reached (opened or attempted). Non-bank ids
// (procedurally generated questions have no "bank:index" id) are ignored.
export function markSeen(ids) {
  if (!ids || !ids.length) return;
  const used = loadUsed();
  let changed = false;
  for (const id of ids) {
    if (typeof id !== 'string' || !id.includes(':')) continue;
    const bank = id.slice(0, id.indexOf(':'));
    if (!BANKS[bank]) continue;
    const set = new Set(used[bank] || []);
    if (!set.has(id)) { set.add(id); used[bank] = [...set]; changed = true; }
  }
  if (changed) saveUsed(used);
}

// Remaining unseen count, for the start-screen hint.
export async function bankFreshCount(name) {
  const pool = await loadBank(name);
  const usedSet = new Set(loadUsed()[name] || []);
  return pool.filter(q => !usedSet.has(q.id)).length;
}
