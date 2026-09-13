// ─────────────────────────────────────────────────────────────────────────────
// Acceptance tests for the Sidereal design (branch design/sidereal).
//
// Builds the site, serves dist/ with `astro preview`, and drives real Chrome
// (SwiftShader WebGL) through every page at phone, tablet, laptop and desktop
// sizes.
//
//   npm test                                  build → preview → every test
//   SKIP_BUILD=1 npm test                     reuse the existing dist/
//   BASE=http://localhost:4321 npm test       against a server that is already up
//
// Analytics (PostHog) is blocked, so test runs never reach the real project.
//
//   1 content is untouched          5 text reads against the scene (contrast)
//   2 every page loads cleanly      6 accessible structure and navigation
//   3 the world behaves             7 build, search and social
//   4 layout holds at every size    8 the scene is never annotated
// ─────────────────────────────────────────────────────────────────────────────
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.PORT || 4329);
const BASE = (process.env.BASE || `http://localhost:${PORT}`).replace(/\/$/, '');
const GL_ARGS = ['--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const BLOCKED = /posthog\.com|open-meteo\.com/;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const PHONE = { name: 'phone 390', width: 390, height: 844, dpr: 2, mobile: true };
const LAPTOP = { name: 'laptop 1280', width: 1280, height: 800, dpr: 1 };
const DESKTOP = { name: 'desktop 1600', width: 1600, height: 1000, dpr: 1 };

// ── the content model, read straight from the sources ────────────────────────
const C = await import(pathToFileURL(path.join(ROOT, 'src/consts.ts')).href);

function parseStudy(file) {
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error(`no frontmatter in ${file}`);
  const [, fm, body] = m;
  const field = (k) => {
    const x = fm.match(new RegExp(`^${k}:\\s*"((?:[^"\\\\]|\\\\.)*)"\\s*$`, 'm'));
    return x ? x[1].replace(/\\"/g, '"') : undefined;
  };
  return {
    slug: path.basename(file, '.md'),
    title: field('title'), summary: field('summary'), company: field('company'),
    role: field('role'), timeline: field('timeline'),
    metrics: [...fm.matchAll(/\{\s*value:\s*"([^"]*)"\s*,\s*label:\s*"([^"]*)"\s*\}/g)].map((x) => ({ value: x[1], label: x[2] })),
    tags: JSON.parse((fm.match(/^tags:\s*(\[.*\])\s*$/m) || [null, '[]'])[1]),
    order: Number((fm.match(/^order:\s*(\d+)/m) || [null, 99])[1]),
    featured: /^featured:\s*true\b/m.test(fm),
    draft: /^draft:\s*true\b/m.test(fm),
    body,
  };
}
const WORK_DIR = path.join(ROOT, 'src/content/work');
const STUDIES = fs.readdirSync(WORK_DIR).filter((f) => f.endsWith('.md'))
  .map((f) => parseStudy(path.join(WORK_DIR, f))).filter((s) => !s.draft).sort((a, b) => a.order - b.order);
const CASE = `/work/${STUDIES[0].slug}`;
const ROUTES = ['/', '/work', ...STUDIES.map((s) => `/work/${s.slug}`), '/writing'];

// the evening's phase each home chapter must hold while it is being read
const CHAPTER_LIGHT = { hero: 'golden', work: 'sunset', about: 'civil', experience: 'nautical', education: 'astro', writing: 'night', contact: 'night' };

// what a reader must never find printed over the scene
const SCENE_DATA = [
  ['degree sign', /°/],
  ['coordinates', /\b\d{1,3}(?:\.\d+)?\s*[NS]\b[\s,·]+\d{1,3}(?:\.\d+)?\s*[EW]\b/],
  ['clock time', /\b\d{1,2}:\d{2}\b/],
  ['time zone', /\bNPT\b/],
  ['weather', /km\s?\/\s?h|\bwind\b|partly clear|\bovercast\b|\bsnow\b|\bstorm\b/i],
  ['place names', /\b(everest|khumbu|himalaya|himalayan|himal|nepal|kangchenjunga|kanchenjunga|annapurna|ama dablam|lukla|base camp|south col)\b/i],
  ['sky and sun data', /\b(golden hour|alpenglow|twilight|evening|dusk|nightfall|night sky|starlight|moonlight|moonrise|moonset|sunset|sunrise|solar altitude|altitude|elevation|sidereal|hipparcos|celestial)\b/i],
  ['elevations', /\b\d{1,2},\d{3}\s?m\b/i],
];

// ── text helpers ─────────────────────────────────────────────────────────────
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(/^#x/i.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITIES[e.toLowerCase()] ?? m));
const words = (s) => ` ${String(s).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
const read = (rel) => fs.readFileSync(path.join(DIST, rel), 'utf8');
const distFile = (route) => (route === '/' ? 'index.html' : `${route.replace(/^\//, '')}/index.html`);
const pageWords = (rel) => words(decode(read(rel).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')));
const missingFrom = (hay, needles) => needles.filter((n) => n && words(n).trim() && !hay.includes(words(n)));
const paragraphs = (md) => md.split(/\r?\n\s*\r?\n/).map((block) => block
  .replace(/^\s{0,3}#{1,6}\s+/gm, '')
  .replace(/^\s*>\s?/gm, '')
  .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/[*_`]/g, '')
  .replace(/\s+/g, ' ').trim()).filter((p) => /[a-z0-9]/i.test(p));
const git = (...args) => execFileSync('git', args, { cwd: ROOT }).toString().trim();

// ── server + browser lifecycle ───────────────────────────────────────────────
let server = null;
let browser = null;

async function serverUp(url) {
  try { return (await fetch(url)).ok; } catch { return false; }
}

before(async () => {
  if (!process.env.BASE) {
    if (await serverUp(BASE)) throw new Error(`port ${PORT} is already serving something (a stale preview?) — stop it or set PORT`);
    if (!process.env.SKIP_BUILD) execFileSync('npx', ['astro', 'build'], { cwd: ROOT, stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });
    server = spawn('npx', ['astro', 'preview', '--port', String(PORT), '--host', 'localhost'], { cwd: ROOT, stdio: 'ignore', detached: true });
    const t0 = Date.now();
    while (!(await serverUp(BASE))) {
      if (Date.now() - t0 > 60000) throw new Error(`astro preview did not come up at ${BASE}`);
      await wait(400);
    }
  }
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: GL_ARGS });
});

after(async () => {
  await browser?.close().catch(() => {});
  if (server) { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already gone */ } }
});

async function open(route, vp = DESKTOP, { reduce = false, qa = true, b = browser, blockStorage = false, storage = null, js = true, holdPlate = false } = {}) {
  const page = await b.newPage();
  await page.setCacheEnabled(false);   // every page is a first visit: 200s, not 304s from an earlier test
  if (!js) await page.setJavaScriptEnabled(false);
  page.errors = [];
  page.warnings = [];
  page.external = [];
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(BASE) && !/^(data|blob):/.test(u)) page.external.push(u);
    if (holdPlate && /\/sidereal\/range(-2k)?\.webp/.test(u)) { page.heldPlate = r; return; }   // a slow network: the plate hasn't arrived
    return BLOCKED.test(u) ? r.abort() : r.continue();
  });
  page.on('pageerror', (e) => page.errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (BLOCKED.test(m.location()?.url || '') || /posthog/i.test(m.text())) return;
    if (m.type() === 'error') page.errors.push(`console.error: ${m.text()}`);
    // SwiftShader (the software GPU these tests run on) reports its own ReadPixels stalls as
    // "GL Driver Message (OpenGL, Performance, ...)"; the same page on a hardware GPU logs none
    else if (/^warn/.test(m.type()) && !/GL Driver Message \(OpenGL, Performance,/.test(m.text())) page.warnings.push(`console.warn: ${m.text()}`);   // the browser's own too, e.g. a preload it could not reuse
  });
  page.on('response', (r) => {
    const u = r.url();
    if (r.status() >= 400 && u.startsWith(BASE) && !u.endsWith('/favicon.ico')) page.errors.push(`HTTP ${r.status()} ${u.slice(BASE.length)}`);
  });
  page.on('requestfailed', (r) => {
    const why = r.failure()?.errorText || '';
    if (!BLOCKED.test(r.url()) && !/ERR_ABORTED/.test(why)) page.errors.push(`request failed (${why}): ${r.url()}`);
  });
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.dpr || 1, isMobile: !!vp.mobile, hasTouch: !!vp.mobile });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }]);
  if (blockStorage) await page.evaluateOnNewDocument(() => {
    // what Chrome does when the reader blocks site data: touching either storage throws
    for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { configurable: true, get() { throw new DOMException('Access is denied for this document.', 'SecurityError'); } });
  });
  if (storage) await page.evaluateOnNewDocument((kv) => { try { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); } catch { /* private mode */ } }, storage);
  const url = `${BASE}${route}${qa ? `${route.includes('?') ? '&' : '?'}qa=1` : ''}`;
  const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  page.status = res?.status();
  await page.evaluate(() => document.fonts.ready.then(() => document.querySelector('astro-dev-toolbar')?.remove())).catch(() => {});
  return page;
}

// the range has arrived and the live sky has finished crossfading in over the poster
const ready = async (page) => { await page.waitForFunction(() => document.documentElement.classList.contains('range-ready'), { timeout: 30000 }); await wait(950); };

async function state(page) {
  const s = await page.evaluate(() => {
    const q = window.__sidereal;
    return q ? { sun: q.sun, idle: q.idle, raf: q.raf, moonVis: q.moonVis, moonAlt: q.moonAlt, phase: document.documentElement.dataset.phase } : null;
  });
  assert.ok(s, 'the engine did not expose its state (window.__sidereal, opened with ?qa=1)');
  return s;
}

const walk = (page) => page.evaluate(async () => {
  const max = document.documentElement.scrollHeight;
  for (let y = 0; y <= max; y += Math.round(innerHeight * 0.7)) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
  scrollTo(0, 0);
});

const stopsOf = (page, frac = 0.6) => page.evaluate((frac) => {
  const max = document.documentElement.scrollHeight - innerHeight;
  const ys = [];
  for (let y = 0; y < max; y += Math.round(innerHeight * frac)) ys.push(y);
  ys.push(Math.max(0, max));
  return [...new Set(ys)];
}, frac);

// scroll positions where the sun crosses into each twilight (just after sunset, into nautical, into astronomical): a reader
// can stop there with the last light of the phase before still in the sky behind the text
const handoverStops = (page) => page.evaluate(async () => {
  const s = window.__sidereal, max = document.documentElement.scrollHeight - innerHeight, out = [];
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const at = async (y) => { window.scrollTo(0, y); await frame(); return s.sunTarget; };
  for (const alt of [-0.4, -6.1, -12.1]) {
    if (await at(max) > alt) continue;
    let lo = 0, hi = max;
    while (hi - lo > 6) { const mid = Math.round((lo + hi) / 2); if (await at(mid) > alt) lo = mid; else hi = mid; }
    out.push(hi);
  }
  window.scrollTo(0, 0);
  await frame();
  return out;
});

async function scrollSettle(page, y, ms = 650) {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await wait(ms);
}

async function diffPct(a, b, threshold = 12) {
  const A = await sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).removeAlpha().raw().toBuffer();
  const n = A.info.width * A.info.height;
  let changed = 0;
  for (let i = 0; i < n; i++) {
    const j = i * 3;
    if (Math.abs(A.data[j] - B[j]) + Math.abs(A.data[j + 1] - B[j + 1]) + Math.abs(A.data[j + 2] - B[j + 2]) > threshold) changed++;
  }
  return (changed / n) * 100;
}

async function frameDiff(page, ms) {
  const a = await page.screenshot({ type: 'png' });
  await wait(ms);
  const b = await page.screenshot({ type: 'png' });
  return diffPct(a, b);
}

// ── contrast: glyph colour against the scene actually behind it ──────────────
// Background is captured with every glyph made transparent but text-shadows
// kept (WCAG accepts a halo as the thing that provides contrast). Each line of
// text is sampled over its glyph band; the 90th-percentile pixel (10th for dark
// text) is the background it is judged against, so a single star or snow speck
// cannot fail a line but a bright band behind it will.
const LIN = Float64Array.from({ length: 256 }, (_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const lum = (r, g, b) => 0.2126 * LIN[r] + 0.7152 * LIN[g] + 0.0722 * LIN[b];
const ratioOf = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
// Generated numbers (the counters before case-study headings and list items) are text a reader sees, but no
// text node holds them: while measuring, a real span with the pseudo-element's own styles stands in for each.
const STAND_IN_COUNTERS = () => {
  const hosts = [];
  for (const [sel, index] of [
    ['.prose > h2', (el) => [...el.parentElement.querySelectorAll(':scope > h2')].indexOf(el) + 1],
    ['.prose ol > li', (el) => [...el.parentElement.children].indexOf(el) + 1],
  ]) {
    for (const el of document.querySelectorAll(sel)) {
      const ps = getComputedStyle(el, '::before');
      if (!/counter\(/.test(ps.content) || ps.display === 'none') continue;
      const span = document.createElement('span');
      span.setAttribute('data-cf-stand-in', '');
      span.textContent = String(index(el)).padStart(2, '0');
      for (const k of ['display', 'position', 'left', 'top', 'flex', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'letter-spacing', 'line-height', 'color', 'text-shadow', 'text-transform', 'margin-right', 'padding-top']) span.style.setProperty(k, ps.getPropertyValue(k));
      hosts.push([el, span]);
    }
  }
  const style = document.createElement('style');
  style.id = 'cf-host-style';
  style.textContent = '[data-cf-host]::before { content: none !important; }';
  document.head.append(style);
  for (const [el, span] of hosts) { el.setAttribute('data-cf-host', ''); el.prepend(span); }
};
const REMOVE_STAND_INS = () => {
  document.querySelectorAll('[data-cf-stand-in]').forEach((n) => n.remove());
  document.querySelectorAll('[data-cf-host]').forEach((n) => n.removeAttribute('data-cf-host'));
  document.getElementById('cf-host-style')?.remove();
};
const GLYPHS_OFF = 'body, body *, body *::before, body *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-decoration-color: transparent !important; }';

async function contrastFailures(page, where) {
  const dpr = page.viewport().deviceScaleFactor || 1;
  await page.evaluate(STAND_IN_COUNTERS);
  let runs, png;
  try {
  runs = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth, vh = innerHeight;
    const hd = document.querySelector('.hd');
    const band = hd ? parseFloat(getComputedStyle(hd, '::before').height) || 0 : 0;
    const shown = (el) => {
      let o = 1;
      for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility !== 'visible') return 0;
        o *= parseFloat(cs.opacity);
      }
      return o;
    };
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      if (!/[A-Za-z0-9]/.test(text)) continue;
      const el = node.parentElement;
      if (!el || el.closest('.stage, .skip-link, .sr-only, script, style, noscript')) continue;
      if (shown(el) < 0.98) continue;
      const inMain = !!el.closest('main');
      const cs = getComputedStyle(el);
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const q of range.getClientRects()) {
        if (q.width < 4 || q.height < 6) continue;
        if (q.top < 0 || q.bottom > vh || q.left < 0 || q.right > vw) continue;
        if (inMain && q.top < band) continue;   // passing under the header's title-safe band
        // aria-hidden words are still text to a sighted reader: only symbols get the 3:1 decorative bar
        out.push({ text: text.slice(0, 64), color: cs.color, size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400, decorative: !!el.closest('[aria-hidden="true"]') && !/[A-Za-z]{2,}/.test(text), x: q.left, y: q.top, w: q.width, h: q.height });
      }
    }
    return out;
  });
  if (!runs.length) return [];
  const tag = await page.addStyleTag({ content: GLYPHS_OFF });
  await wait(80);
  png = await page.screenshot({ type: 'png' });
  await tag.evaluate((n) => n.remove());
  } finally {
    await page.evaluate(REMOVE_STAND_INS).catch(() => {});
  }
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const fails = [];
  for (const r of runs) {
    const m = r.color.match(/rgba?\(([^)]+)\)/);
    if (!m) continue;
    const [cr, cg, cb, ca = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (!ca) continue;
    const X0 = Math.max(0, Math.floor(r.x * dpr)), X1 = Math.min(W, Math.ceil((r.x + r.w) * dpr));
    const y0 = Math.max(0, Math.floor((r.y + r.h * 0.2) * dpr)), y1 = Math.min(H, Math.ceil((r.y + r.h * 0.8) * dpr));
    const over = (i) => [0, 1, 2].map((c) => Math.round(ca * [cr, cg, cb][c] + (1 - ca) * data[i + c]));
    // judged window by window along the line, each about 2.5 characters high wide and half
    // overlapping, so a bright patch behind a few words fails even on an otherwise dark line
    const win = Math.max(8, Math.round(r.size * 2.5 * dpr)), step = Math.max(4, win >> 1);
    let ratio = Infinity, atX = r.x;
    for (let x0 = X0; x0 < X1; x0 += step) {
      const x1 = Math.min(X1, x0 + win);
      if (x0 > X0 && x1 - x0 < win >> 1) break;   // this tail lies inside the previous window
      const stride = Math.max(1, Math.round(Math.sqrt(((x1 - x0) * (y1 - y0)) / 1500)));
      const lums = [], at = [];
      for (let y = y0; y < y1; y += stride) for (let x = x0; x < x1; x += stride) {
        const i = (y * W + x) * 3;
        lums.push(lum(data[i], data[i + 1], data[i + 2]));
        at.push(i);
      }
      if (!lums.length) continue;
      const order = lums.map((_, k) => k).sort((a, b) => lums[a] - lums[b]);
      const median = order[order.length >> 1];
      const lightText = lum(...over(at[median])) > lums[median];
      const k = order[Math.round((lightText ? 0.9 : 0.1) * (order.length - 1))];
      const q = ratioOf(lum(...over(at[k])), lums[k]);
      if (q < ratio) { ratio = q; atX = x0 / dpr; }
    }
    if (ratio === Infinity) continue;
    const large = r.size >= 24 || (r.size >= 18.66 && r.weight >= 700);
    const need = r.decorative || large ? 3 : 4.5;
    if (ratio < need) fails.push({ where, text: r.text, ratio, need, size: r.size, x: Math.round(atX), y: Math.round(r.y) });
  }
  return fails;
}

// one line per failing text, at its worst
function assertReadable(fails) {
  const worst = new Map();
  for (const f of fails) if (!worst.has(f.text) || f.ratio < worst.get(f.text).ratio) worst.set(f.text, f);
  const list = [...worst.values()].sort((a, b) => a.ratio - b.ratio);
  assert.equal(list.length, 0, `\n${list.map((f) => `    ${f.ratio.toFixed(2)} < ${f.need}  "${f.text}"  ${f.size}px at (${f.x}, ${f.y})  ${f.where}`).join('\n')}\n`);
}

// ═════════════════════════════════════════════════════════════════════════════
describe('1 · content is untouched', () => {
  test('content sources are identical to where this branch left main', () => {
    const base = git('merge-base', 'main', 'HEAD');
    const diff = git('diff', '--stat', base, '--', 'src/content', 'src/consts.ts');
    assert.equal(diff, '', `content changed since ${base.slice(0, 7)}:\n${diff}`);
  });

  test('every string in consts.ts is on the home page', () => {
    const home = pageWords('index.html');
    const expected = [
      C.HERO.name, C.HERO.role, C.HERO.tagline, C.HERO.kicker,
      ...C.ABOUT.split('\n\n'),
      ...C.EXPERIENCE.flatMap((j) => [j.company, j.role, j.period, j.location, ...j.highlights]),
      C.EDUCATION.school, C.EDUCATION.degree, C.EDUCATION.period,
      ...C.SKILLS.flatMap((g) => [g.group, ...g.items]),
      C.SOCIALS.location, C.SOCIALS.phone, C.SOCIALS.email,
      ...C.WRITING.map((w) => w.title),
      "Products & agents I've shipped.", "Where I've shipped.", "Let's build something reliable.",
      ...STUDIES.filter((s) => s.featured).flatMap((s) => [s.title, s.summary, s.company, s.timeline, ...s.metrics.flatMap((m) => [m.value, m.label])]),
    ];
    const miss = missingFrom(home, expected);
    assert.deepEqual(miss, [], `missing from the home page:\n${miss.map((m) => `  · ${m.slice(0, 100)}`).join('\n')}`);
    const raw = read('index.html');
    const links = [C.SOCIALS.linkedin, C.SOCIALS.medium, C.SOCIALS.github, `mailto:${C.SOCIALS.email}`, ...C.WRITING.map((w) => w.href), '/resume.pdf'].filter(Boolean);
    assert.deepEqual(links.filter((h) => !raw.includes(`href="${h}"`)), [], 'links missing from the home page');
  });

  test('every case study renders all of its text', () => {
    const problems = [];
    for (const s of STUDIES) {
      const page = pageWords(`work/${s.slug}/index.html`);
      const expected = [s.title, s.summary, s.company, s.role, s.timeline, ...s.metrics.flatMap((m) => [m.value, m.label]), ...s.tags, ...paragraphs(s.body)];
      for (const miss of missingFrom(page, expected)) problems.push(`${s.slug}: ${miss.slice(0, 100)}`);
    }
    assert.deepEqual(problems, []);
  });

  test('every case metric appears character for character, symbols included', () => {
    const missing = [];
    for (const st of STUDIES) {
      const html = decode(read(`work/${st.slug}/index.html`));
      for (const m of st.metrics) for (const v of [m.value, m.label]) if (!html.includes(v)) missing.push(`${st.slug}: ${v}`);
    }
    assert.deepEqual(missing, []);
  });

  test('the work index and the writing page list everything', () => {
    const work = pageWords('work/index.html');
    assert.deepEqual(missingFrom(work, [...STUDIES.flatMap((s) => [s.title, s.summary]), "Products & agents I've shipped.",
      'How I think about building AI-native products — the problem, the agent and eval design, the tradeoffs I made, and what moved.']), []);
    assert.deepEqual(missingFrom(pageWords('writing/index.html'), C.WRITING.map((w) => w.title)), []);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('2 · every page loads cleanly', () => {
  for (const route of ROUTES) {
    for (const vp of [DESKTOP, PHONE]) {
      test(`${route} · ${vp.name}: 200, WebGL live, no errors while scrolling`, { timeout: 120000 }, async () => {
        const page = await open(route, vp);
        try {
          assert.equal(page.status, 200);
          await ready(page);
          assert.ok(await page.evaluate(() => document.documentElement.classList.contains('webgl')), 'WebGL stage not active');
          await walk(page);
          await wait(800);
          assert.deepEqual(page.errors, []);
          assert.deepEqual(page.warnings, []);
        } finally { await page.close(); }
      });
    }
  }

  test('a plain visit (no ?qa) runs the same engine and exposes no test hook', { timeout: 90000 }, async () => {
    const page = await open('/', DESKTOP, { qa: false });
    try {
      assert.equal(page.status, 200);
      await ready(page);
      await walk(page);
      await wait(800);
      const s = await page.evaluate(() => ({ webgl: document.documentElement.classList.contains('webgl'), hook: typeof window.__sidereal }));
      assert.deepEqual(s, { webgl: true, hook: 'undefined' });
      assert.deepEqual([...page.errors, ...page.warnings], []);
    } finally { await page.close(); }
  });

  test('every internal link and in-page anchor resolves', () => {
    const bad = [];
    for (const route of ROUTES) {
      const html = read(distFile(route));
      const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
      for (const [, href] of html.matchAll(/\shref="([^"]+)"/g)) {
        if (/^(https?:|mailto:|tel:|\/\/)/.test(href)) continue;
        const [p, hash] = href.split('#');
        if (!p) { if (hash && !ids.has(hash)) bad.push(`${route}: #${hash}`); continue; }
        const clean = p.split('?')[0];
        const target = path.extname(clean) ? path.join(DIST, clean) : path.join(DIST, clean, 'index.html');
        if (!fs.existsSync(target)) { bad.push(`${route}: ${href}`); continue; }
        if (hash && target.endsWith('.html') && !fs.readFileSync(target, 'utf8').includes(`id="${hash}"`)) bad.push(`${route}: ${href}`);
      }
    }
    assert.deepEqual(bad, []);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('3 · the world behaves', () => {
  test("the sky's clock keeps running while the reader is still", { timeout: 90000 }, async () => {
    const page = await open('/', DESKTOP);
    try {
      await ready(page);
      const a = await state(page);
      await wait(1500);
      const b = await state(page);
      assert.ok(b.idle - a.idle > 0.8, `engine clock went ${a.idle} → ${b.idle} in 1.5 s`);
    } finally { await page.close(); }
  });

  test('each home chapter holds its own light', { timeout: 120000 }, async () => {
    const page = await open('/', DESKTOP);
    try {
      await ready(page);
      const got = {};
      for (const id of Object.keys(CHAPTER_LIGHT)) {
        await page.evaluate((id) => {
          const el = document.getElementById(id);
          window.scrollTo(0, id === 'hero' ? 0 : el.getBoundingClientRect().top + scrollY - 72);
        }, id);
        await wait(1800);
        got[id] = (await state(page)).phase;
      }
      assert.deepEqual(got, CHAPTER_LIGHT);
    } finally { await page.close(); }
  });

  test('the moon stays below the ridge until the last chapter, then rises', { timeout: 90000 }, async (t) => {
    const page = await open('/', DESKTOP);
    try {
      await ready(page);
      await wait(800);
      const top = await state(page);
      if (top.moonVis === undefined) return t.skip('engine does not expose moon state');
      assert.equal(top.moonVis, 0, 'moon visible at golden hour');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await wait(2500);
      const end = await state(page);
      assert.ok(end.moonVis > 0.9 && end.moonAlt > 0, `moon at the end: vis ${end.moonVis}, alt ${end.moonAlt}`);
    } finally { await page.close(); }
  });

  test('the moon never sits behind a line of text, from Writing to the end, even after a long visit', { timeout: 900000 }, async () => {
    const problems = [];
    const sizes = [DESKTOP, { name: 'desktop 1920', width: 1920, height: 1080 }, { name: 'laptop 1440', width: 1440, height: 900 }, { name: 'laptop 1366', width: 1366, height: 768 }, LAPTOP, { name: 'laptop 1280x720', width: 1280, height: 720 }, { name: 'tablet 768', width: 768, height: 1024, dpr: 2, mobile: true }, PHONE, { name: 'phone landscape 667x375', width: 667, height: 375, dpr: 2, mobile: true }, { name: 'phone landscape 844x390', width: 844, height: 390, dpr: 2, mobile: true }, { name: 'phone 375x553', width: 375, height: 553, dpr: 2, mobile: true }, { name: 'phone 320x568', width: 320, height: 568, dpr: 2, mobile: true }];
    for (const vp of sizes) {
      const page = await open('/', vp);
      try {
        await ready(page);
        await page.evaluate(() => { window.__sidereal.idle = 600; });   // ten minutes on the page: past the cap on the moon's idle lift
        const stops = await page.evaluate(() => {
          const from = document.getElementById('writing').getBoundingClientRect().top + scrollY - innerHeight * 0.5;
          const max = document.documentElement.scrollHeight - innerHeight, out = [];
          for (let y = Math.max(0, from); y < max; y += Math.round(innerHeight * 0.5)) out.push(Math.round(y));
          out.push(max);
          return out;
        });
        for (const y of stops) {
          await page.evaluate((y) => window.scrollTo(0, y), y);
          await wait(1100);
          const r = await page.evaluate(() => {
            const s = window.__sidereal, m = s.moonRect;
            if (!(s.moonVis > 0.05) || !m) return null;
            const band = parseFloat(getComputedStyle(document.querySelector('.hd'), '::before').height) || 0;
            const cx = (m.left + m.right) / 2, cy = (m.top + m.bottom) / 2, rad = (m.right - m.left) / 2, pad = 12, hits = [];
            const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
              const n = walker.currentNode;
              if (!/[A-Za-z0-9]/.test(n.textContent)) continue;
              const range = document.createRange();
              range.selectNodeContents(n);
              for (const q of range.getClientRects()) {
                if (!q.width) continue;
                const dx = Math.max(q.left - cx, 0, cx - q.right), dy = Math.max(q.top - cy, 0, cy - q.bottom);
                if (Math.hypot(dx, dy) < rad + pad) { hits.push(n.textContent.trim().slice(0, 40)); break; }
              }
            }
            return hits.length || m.top < band - 1 ? { hits, underBand: m.top < band - 1, moon: [m.left, m.top, m.right, m.bottom].map(Math.round) } : null;
          });
          if (r) { problems.push(`${vp.name} at scrollY ${y}: moon at ${r.moon.join(', ')}${r.underBand ? ' reaches under the header band' : ''}${r.hits.length ? ` behind "${r.hits.slice(0, 2).join('", "')}"` : ''}`); break; }
        }
      } finally { await page.close(); }
    }
    assert.deepEqual(problems, []);
  });

  test('the sky is the right way round: east on the right, the pole in the north, stars rising in the east', { timeout: 60000 }, async () => {
    const page = await open('/', DESKTOP);
    try {
      await ready(page);
      const r = await page.evaluate(() => {
        const s = window.__sidereal;
        const east = s.eqToHor(90, 0, 0);                                   // six hours east of the meridian, on the equator
        const pole = s.eqToHor(0, 90, 123);                                 // the celestial pole
        const star = [s.eqToHor(60, 20, 0), s.eqToHor(60, 20, 10)];         // an eastern star, ten degrees of sidereal time apart
        const at = (az) => [Math.cos(az * Math.PI / 180), Math.sin(az * Math.PI / 180), 0];
        return {
          dueEast: Math.abs(east[0]) < 1e-3 && Math.abs(east[1] - 1) < 1e-3 && Math.abs(east[2]) < 1e-3,
          poleNorthAtLatitude: pole[0] > 0 && Math.abs(pole[1]) < 1e-3 && Math.abs(Math.asin(pole[2]) * 180 / Math.PI - 27.99) < 0.05,
          easternStarRises: star[0][1] > 0 && star[1][2] > star[0][2],
          eastOfViewIsRight: s.horToCam(...at(40))[0] > 0 && s.horToCam(...at(0))[0] < 0,   // the camera looks north-north-east
        };
      });
      assert.deepEqual(r, { dueEast: true, poleNorthAtLatitude: true, easternStarRises: true, eastOfViewIsRight: true });
    } finally { await page.close(); }
  });

  test('the risen moon is the brightest thing in the last chapter', { timeout: 90000 }, async () => {
    const page = await open('/', DESKTOP);
    try {
      await ready(page);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await wait(3000);
      const { moon, mail } = await page.evaluate(() => {
        const b = document.querySelector('.final__mail').getBoundingClientRect();
        return { moon: window.__sidereal.moonRect, mail: { left: b.left, top: b.top, right: b.right, bottom: b.bottom } };
      });
      assert.ok(moon, 'no moon at the end of the page');
      const { data, info } = await sharp(await page.screenshot({ type: 'png' })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const sample = (box, disc) => {
        const out = [], cx = (box.left + box.right) / 2, cy = (box.top + box.bottom) / 2, rx = (box.right - box.left) / 2, ry = (box.bottom - box.top) / 2;
        for (let y = Math.max(0, Math.floor(box.top)); y < Math.min(info.height, Math.ceil(box.bottom)); y++) {
          for (let x = Math.max(0, Math.floor(box.left)); x < Math.min(info.width, Math.ceil(box.right)); x++) {
            if (disc && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 0.64) continue;
            const i = (y * info.width + x) * 3;
            out.push(lum(data[i], data[i + 1], data[i + 2]));
          }
        }
        return out.sort((p, q) => p - q);
      };
      const disc = sample(moon, true);
      const button = sample({ left: mail.left + 4, top: mail.top + 4, right: mail.right - 4, bottom: mail.bottom - 4 }, false);
      const brightest = disc[Math.floor(disc.length * 0.9)], face = button[button.length >> 1];
      assert.ok(brightest > face, `the moon's brightest tenth measures ${brightest?.toFixed(2)}, the address button ${face?.toFixed(2)}`);
    } finally { await page.close(); }
  });

  test('reading pages hang the moon only in a margin that holds it clear of the text', { timeout: 180000 }, async () => {
    const problems = [];
    const sizes = [LAPTOP, { name: 'laptop 1366', width: 1366, height: 768 }, { name: 'laptop 1440', width: 1440, height: 900 }, { name: 'laptop 1536x730', width: 1536, height: 730 }, { name: 'desktop 1600x800', width: 1600, height: 800 }, DESKTOP, { name: 'desktop 1920', width: 1920, height: 1080 }, PHONE];
    for (const vp of sizes) {
      const page = await open(CASE, vp);
      try {
        await ready(page);
        await wait(1500);
        const r = await page.evaluate(() => {
          const s = window.__sidereal;
          const wrap = document.querySelector('main .wrap');
          const box = wrap.getBoundingClientRect();
          return { vis: s.moonVis, rect: s.moonRect, contentRight: box.right - parseFloat(getComputedStyle(wrap).paddingRight) };
        });
        if (r.vis > 0 && (!r.rect || r.rect.left < r.contentRight + 8)) problems.push(`${vp.name}: moon ${r.rect ? `${Math.round(r.rect.left)}–${Math.round(r.rect.right)}px` : 'without a rect'}, text column ends at ${Math.round(r.contentRight)}px`);
        if (vp === DESKTOP && !(r.vis > 0)) problems.push('desktop 1600: the moon should hang in the wide right margin');
        if (r.vis > 0) {
          // it drifts up with time on the page: after ten minutes it must still sit below the header band
          await page.evaluate(() => { window.__sidereal.idle = 600; });
          await wait(1200);
          const late = await page.evaluate(() => ({ rect: window.__sidereal.moonRect, band: parseFloat(getComputedStyle(document.querySelector('.hd'), '::before').height) || 0 }));
          if (late.rect && late.rect.top < late.band) problems.push(`${vp.name}: after ten minutes the moon's top is at ${Math.round(late.rect.top)}px, under the ${late.band}px header band`);
        }
      } finally { await page.close(); }
    }
    assert.deepEqual(problems, []);
  });

  test('phones and tablets crop the sky like the range instead of widening it', { timeout: 120000 }, async () => {
    const fields = {};
    for (const vp of [DESKTOP, { name: 'tablet 768', width: 768, height: 1024, dpr: 2, mobile: true }, PHONE, { name: 'phone 360', width: 360, height: 740, dpr: 2, mobile: true }]) {
      const page = await open('/', vp);
      try { await ready(page); fields[vp.name] = await page.evaluate(() => window.__sidereal.fov); } finally { await page.close(); }
    }
    const desk = fields[DESKTOP.name];
    const widened = Object.entries(fields).filter(([, f]) => f.v > desk.v + 0.5).map(([name, f]) => `${name}: vertical field ${f.v.toFixed(1)}°, desktop ${desk.v.toFixed(1)}°`);
    assert.deepEqual(widened, []);
  });

  test('zoomed and short screens: every fade-in completes as the page is read', { timeout: 900000 }, async () => {
    const problems = [];
    for (const vp of [{ name: '400% zoom (320x256)', width: 320, height: 256, dpr: 4 }, { name: 'landscape phone 568x320', width: 568, height: 320, dpr: 2, mobile: true }]) {
      for (const route of ROUTES) {
        const page = await open(route, vp);
        try {
          await ready(page);
          const stuck = await page.evaluate(async () => {
            const max = document.documentElement.scrollHeight - innerHeight;
            for (let y = 0; y <= max; y += Math.round(innerHeight * 0.9)) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
            scrollTo(0, max);
            await new Promise((r) => setTimeout(r, 500));
            // only blocks that render at this size: one hidden on purpose (display: none) never intersects
            return [...document.querySelectorAll('.rv')].filter((el) => el.getClientRects().length > 0 && !el.classList.contains('is-in')).map((el) => String(el.className).split(' ')[0]);
          });
          if (stuck.length) problems.push(`${route} @ ${vp.name}: ${stuck.length} never revealed (${stuck.slice(0, 3).join(', ')})`);
        } finally { await page.close(); }
      }
    }
    assert.deepEqual(problems, []);
  });

  test('the sky moves, slowly, at golden hour and at night', { timeout: 120000 }, async (t) => {
    const page = await open('/', DESKTOP);
    try {
      await ready(page);
      await wait(1500);
      const golden = await frameDiff(page, 6000);
      await page.evaluate(() => { window.__sidereal.sun = -22; });
      await wait(2500);
      const night = await frameDiff(page, 6000);
      t.diagnostic(`pixels changed in 6 s: golden hour ${golden.toFixed(2)}%, night ${night.toFixed(2)}%`);
      assert.ok(golden >= 1 && golden <= 25, `golden hour: ${golden.toFixed(2)}% of pixels changed in 6 s`);
      assert.ok(night >= 1 && night <= 25, `night: ${night.toFixed(2)}% of pixels changed in 6 s`);
    } finally { await page.close(); }
  });

  test('reduced motion: one still frame, all content visible, render loop asleep', { timeout: 90000 }, async () => {
    const page = await open('/', DESKTOP, { reduce: true });
    try {
      await ready(page);
      await wait(2500);
      const s = await page.evaluate(() => ({
        animOk: document.documentElement.classList.contains('anim-ok'),
        hiddenBlocks: [...document.querySelectorAll('.rv')].filter((el) => getComputedStyle(el).opacity !== '1').length,
        raf: window.__sidereal.raf,
        running: document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.animationName || a.transitionProperty || 'animation'),
      }));
      assert.deepEqual(s, { animOk: false, hiddenBlocks: 0, raf: 0, running: [] });
      const changed = await frameDiff(page, 2500);
      assert.ok(changed < 0.05, `${changed.toFixed(3)}% of pixels changed under reduced motion`);
    } finally { await page.close(); }
  });

  test('text on screen never waits to fade in, however tall its block', { timeout: 240000 }, async () => {
    const problems = [];
    for (const [route, vp] of [[CASE, DESKTOP], [CASE, PHONE], ['/', LAPTOP]]) {
      const page = await open(route, vp);
      try {
        await ready(page);
        for (const y of (await stopsOf(page, 0.9)).slice(0, 6)) {
          await page.evaluate((y) => window.scrollTo(0, y), y);
          await wait(1700);
          const hidden = await page.evaluate(() => [...document.querySelectorAll('.rv')].filter((el) => {
            const b = el.getBoundingClientRect();
            return b.top < innerHeight - 60 && b.bottom > 160 && getComputedStyle(el).opacity !== '1';
          }).map((el) => `${String(el.className).split(' ')[0]} at ${Math.round(el.getBoundingClientRect().top)}px`));
          if (hidden.length) problems.push(`${route} @ ${vp.name}, scrollY ${y}: ${hidden.slice(0, 3).join(', ')} still invisible`);
        }
      } finally { await page.close(); }
    }
    assert.deepEqual(problems, []);
  });

  test('motion is always on: no toggle in either menu, and an old "off" choice does not stick', { timeout: 90000 }, async () => {
    // a returning visitor who switched motion off back when the header had a toggle
    const page = await open('/', DESKTOP, { storage: { 'mb-motion': 'off' } });
    try {
      await ready(page);
      const a = await state(page);
      await wait(1500);
      const b = await state(page);
      const s = await page.evaluate(() => ({
        controls: document.querySelectorAll('#motion-toggle, [data-motion-toggle], .hd__motion').length,
        stored: localStorage.getItem('mb-motion'),
        animOk: document.documentElement.classList.contains('anim-ok'),
      }));
      assert.deepEqual(s, { controls: 0, stored: null, animOk: true });
      assert.ok(b.idle - a.idle > 0.8 && b.raf !== 0, `the sky should keep moving: clock ${a.idle} → ${b.idle}, raf ${b.raf}`);
    } finally { await page.close(); }
    const phone = await open('/', PHONE);
    try {
      await phone.click('#menu-btn');
      await wait(250);
      const items = await phone.evaluate(() => [...document.querySelectorAll('#mobile-nav a, #mobile-nav button')].map((el) => el.textContent.trim()));
      assert.ok(!items.some((t) => /motion/i.test(t)), `the phone menu still offers a motion control: ${items.join(' | ')}`);
    } finally { await phone.close(); }
  });

  test('blocked site storage never breaks the page', { timeout: 90000 }, async () => {
    const page = await open('/', DESKTOP, { blockStorage: true });
    try {
      assert.equal(await page.evaluate(() => { try { void window.localStorage; return 'readable'; } catch { return 'blocked'; } }), 'blocked', 'the storage block was not simulated');
      await ready(page);
      const a = await state(page);
      await wait(1500);
      const b = await state(page);
      assert.ok(await page.evaluate(() => document.documentElement.classList.contains('webgl')), 'WebGL stage not active');
      assert.ok(b.idle - a.idle > 0.2, `engine clock went ${a.idle} → ${b.idle}`);
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });

  test('without WebGL a night still stands in and every page reads in night ink', { timeout: 120000 }, async () => {
    const plain = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--disable-3d-apis'] });
    try {
      for (const route of ['/', CASE]) {
        const page = await open(route, DESKTOP, { b: plain });
        await wait(1500);
        const s = await page.evaluate(() => {
          const poster = document.querySelector('.stage__poster');
          return {
            noWebgl: document.documentElement.classList.contains('no-webgl'),
            posterOpacity: getComputedStyle(poster).opacity,
            posterImage: /poster-night/.test(getComputedStyle(poster, '::after').backgroundImage),
            phase: document.documentElement.dataset.phase,
            hiddenBlocks: [...document.querySelectorAll('.rv')].filter((el) => getComputedStyle(el).opacity !== '1').length,
          };
        });
        const errors = page.errors;
        await page.close();
        assert.deepEqual(s, { noWebgl: true, posterOpacity: '1', posterImage: true, phase: 'night', hiddenBlocks: 0 }, route);
        assert.deepEqual(errors, [], route);
      }
    } finally { await plain.close(); }
  });

  test('losing the GL context deep in the page leaves a night still and every chapter readable', { timeout: 300000 }, async () => {
    const page = await open('/', DESKTOP);
    try {
      await ready(page);
      // deep in the page, where the chapters above have faded out under the header
      await page.evaluate(() => window.scrollTo(0, document.getElementById('writing').getBoundingClientRect().top + scrollY - 72));
      await wait(1800);
      assert.ok(await page.evaluate(() => [...document.querySelectorAll('[data-chapter]')].some((el) => el.style.opacity !== '')), 'no chapter had faded under the header before the loss');
      const lost = await page.evaluate(() => {
        const gl = document.getElementById('sky').getContext('webgl');
        const ext = gl && gl.getExtension('WEBGL_lose_context');
        if (!ext) return false;
        ext.loseContext();
        return true;
      });
      assert.ok(lost, 'could not simulate a context loss');
      await wait(1800);
      const s = await page.evaluate(() => {
        const poster = document.querySelector('.stage__poster');
        return {
          noWebgl: document.documentElement.classList.contains('no-webgl'),
          posterOpacity: getComputedStyle(poster).opacity,
          posterNight: /poster-night/.test(getComputedStyle(poster, '::after').backgroundImage),
          phase: document.documentElement.dataset.phase,
          fadedChapters: [...document.querySelectorAll('[data-chapter]')].filter((el) => getComputedStyle(el).opacity !== '1').map((el) => el.id),
        };
      });
      assert.deepEqual(s, { noWebgl: true, posterOpacity: '1', posterNight: true, phase: 'night', fadedChapters: [] });
      const fails = [];
      for (const y of await stopsOf(page)) {
        await scrollSettle(page, y, 1000);
        fails.push(...await contrastFailures(page, `scrollY ${y}, after the loss`));
      }
      assertReadable(fails);
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('4 · layout holds at every size', () => {
  const SIZES = [
    { name: 'phone 320', width: 320, height: 568, dpr: 2, mobile: true },
    { name: 'phone 360', width: 360, height: 740, dpr: 2, mobile: true },
    PHONE,
    { name: 'tablet 768', width: 768, height: 1024, dpr: 2, mobile: true },
    { name: 'phone landscape 844x390', width: 844, height: 390, dpr: 2, mobile: true },
    { name: 'tablet 1024', width: 1024, height: 768, dpr: 1 },
    LAPTOP,
    { name: 'laptop 1366', width: 1366, height: 768, dpr: 1 },
    { name: 'laptop 1440', width: 1440, height: 900, dpr: 1 },
    DESKTOP,
    { name: 'desktop 1920', width: 1920, height: 1080, dpr: 1 },
  ];

  test('no line of text or hairline leaves the viewport or its content column', { timeout: 900000 }, async () => {
    const problems = [];
    for (const vp of SIZES) {
      for (const route of ['/', CASE, '/work', '/writing']) {
        const page = await open(route, vp);
        const bad = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth, out = [];   // not innerWidth: a phone zooms out to fit overflow, which inflates it
          const column = (wrap) => { const b = wrap.getBoundingClientRect(); const cs = getComputedStyle(wrap); return { left: b.left + parseFloat(cs.paddingLeft), right: b.right - parseFloat(cs.paddingRight) }; };
          if (document.documentElement.scrollWidth > vw + 1) out.push(`page is ${document.documentElement.scrollWidth}px wide`);
          for (const el of document.querySelectorAll('main *')) {
            const cs = getComputedStyle(el);
            if (cs.display === 'none') continue;
            const ruled = ['Top', 'Bottom', 'Left', 'Right'].some((side) => parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== 'none' && !/rgba\([^)]*,\s*0\)$/.test(cs[`border${side}Color`]));
            const wrap = el.parentElement?.closest('main .wrap');
            if (!ruled || !wrap) continue;
            const r = el.getBoundingClientRect(), c = column(wrap);
            if (r.width && (r.left < c.left - 1 || r.right > c.right + 1)) { out.push(`${String(el.className).split(' ')[0] || el.tagName} rule ${Math.round(r.left)}–${Math.round(r.right)} outside column ${Math.round(c.left)}–${Math.round(c.right)}`); break; }
          }
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const n = walker.currentNode;
            if (!n.textContent.trim() || n.parentElement.closest('.skip-link, .sr-only, .stage, script, style')) continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            const wrap = n.parentElement.closest('main .wrap');
            const c = wrap ? column(wrap) : { left: 0, right: vw };
            // display type may hang a hair into the margin for optical alignment (the hero name sits at -0.04em)
            const hang = Math.max(1, (parseFloat(getComputedStyle(n.parentElement).fontSize) || 16) * 0.05);
            for (const q of range.getClientRects()) {
              if (q.width && (q.left < c.left - hang || q.right > c.right + 1)) { out.push(`"${n.textContent.trim().slice(0, 40)}" spans ${Math.round(q.left)}–${Math.round(q.right)}, column ${Math.round(c.left)}–${Math.round(c.right)}`); break; }
            }
          }
          return out;
        });
        await page.close();
        if (bad.length) problems.push(`${route} @ ${vp.name}: ${bad.slice(0, 3).join(' | ')}`);
      }
    }
    assert.deepEqual(problems, []);
  });

  test('no line of text is printed over another', { timeout: 900000 }, async () => {
    const problems = [];
    for (const vp of [{ name: 'phone 320', width: 320, height: 568, dpr: 2, mobile: true }, PHONE, { name: 'tablet 768', width: 768, height: 1024, dpr: 2, mobile: true }, { name: 'tablet 1024', width: 1024, height: 768, dpr: 1 }, DESKTOP]) {
      for (const route of ['/', '/work', ...STUDIES.map((st) => `/work/${st.slug}`)]) {
        const page = await open(route, vp, { reduce: true });
        const hits = await page.evaluate(() => {
          const runs = [];
          const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const n = walker.currentNode, el = n.parentElement;
            if (!/\S/.test(n.textContent) || el.closest('.sr-only, .skip-link') || getComputedStyle(el).visibility !== 'visible') continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            for (const q of range.getClientRects()) if (q.width > 1 && q.height > 1) runs.push({ el, text: n.textContent.trim().slice(0, 30), l: q.left, r: q.right, t: q.top + scrollY, b: q.bottom + scrollY });
          }
          runs.sort((a, b) => a.t - b.t);
          const out = [];
          for (let i = 0; i < runs.length && out.length < 5; i++) {
            for (let j = i + 1; j < runs.length && runs[j].t < runs[i].b; j++) {
              const a = runs[i], b = runs[j];
              if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
              const ix = Math.min(a.r, b.r) - Math.max(a.l, b.l), iy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
              if (ix > 2 && iy > 0.35 * Math.min(a.b - a.t, b.b - b.t)) out.push(`"${a.text}" over "${b.text}" (${Math.round(ix)}x${Math.round(iy)}px)`);
            }
          }
          return out;
        });
        await page.close();
        if (hits.length) problems.push(`${route} @ ${vp.name}: ${hits.slice(0, 3).join(' | ')}`);
      }
    }
    assert.deepEqual(problems, []);
  });

  test('clicks on the header band never reach the page beneath it', { timeout: 60000 }, async () => {
    const page = await open('/', DESKTOP, { reduce: true });
    try {
      await ready(page);
      const y = await page.evaluate(() => Math.round(document.querySelector('.mf__row').getBoundingClientRect().top + scrollY - 40));
      await scrollSettle(page, y);
      const reachesPage = await page.evaluate(() => [30, 50, 60].map((yy) => !!document.elementFromPoint(700, yy)?.closest('main')));
      assert.deepEqual(reachesPage, [false, false, false]);
    } finally { await page.close(); }
  });

  test('in forced colours the header band stays solid over scrolled text', { timeout: 90000 }, async () => {
    const page = await open('/', DESKTOP, { reduce: true });
    try {
      // puppeteer's emulateMediaFeatures rejects forced-colors; the DevTools protocol accepts it
      const cdp = await page.createCDPSession();
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
      await ready(page);
      const y = await page.evaluate(() => { const w = document.getElementById('work'); return Math.round(w.getBoundingClientRect().top + scrollY + parseFloat(getComputedStyle(w).paddingTop) - 30); });
      await scrollSettle(page, y);
      const strip = await page.evaluate(() => Math.ceil(document.querySelector('.hd__inner').getBoundingClientRect().bottom) + 6);
      const clip = { x: 0, y: await page.evaluate(() => scrollY), width: DESKTOP.width, height: strip };   // puppeteer's clip is in document coordinates
      const a = await page.screenshot({ type: 'png', clip });
      await page.evaluate(() => { document.querySelector('main').style.visibility = 'hidden'; });
      const b = await page.screenshot({ type: 'png', clip });
      const pct = await diffPct(a, b, 16);
      assert.ok(pct <= 0.5, `${pct.toFixed(2)}% of the nav strip shows page content in forced colours`);
    } finally { await page.close(); }
  });

  test('the header band hides whatever scrolls beneath the nav', { timeout: 300000 }, async () => {
    const problems = [];
    for (const [route, vp] of [['/', DESKTOP], ['/', PHONE], [CASE, DESKTOP], ['/work', LAPTOP], [CASE, { name: 'phone landscape 844x390', width: 844, height: 390, dpr: 2, mobile: true }]]) {
      const page = await open(route, vp, { reduce: true });
      await ready(page);
      for (const y of await stopsOf(page)) {
        await scrollSettle(page, y);
        const strip = await page.evaluate(() => Math.ceil(document.querySelector('.hd__inner').getBoundingClientRect().bottom) + 6);
        const clip = { x: 0, y: await page.evaluate(() => scrollY), width: vp.width, height: strip };   // puppeteer's clip is in document coordinates
        const a = await page.screenshot({ type: 'png', clip });
        await page.evaluate(() => { document.querySelector('main').style.visibility = 'hidden'; });
        const b = await page.screenshot({ type: 'png', clip });
        await page.evaluate(() => { document.querySelector('main').style.visibility = ''; });
        const pct = await diffPct(a, b, 16);
        if (pct > 0.2) problems.push(`${route} @ ${vp.name}, scrollY ${y}: ${pct.toFixed(2)}% of the nav strip shows page content`);
      }
      await page.close();
    }
    assert.deepEqual(problems, []);
  });

  test('the hero results show from 1100px wide and never touch the hero text beside them', { timeout: 240000 }, async () => {
    for (const vp of [{ name: '1100', width: 1100, height: 800 }, { name: '1280', width: 1280, height: 800 }, { name: '1366', width: 1366, height: 768 }, { name: '1440', width: 1440, height: 900 }, DESKTOP, { name: '1920', width: 1920, height: 1080 }, { name: '2560', width: 2560, height: 1440 }]) {
      const page = await open('/', vp);
      const r = await page.evaluate(() => {
        const inst = document.querySelector('.hero__instruments');
        if (!inst || getComputedStyle(inst).display === 'none') return null;
        const i = inst.getBoundingClientRect();
        let right = -Infinity;
        for (const el of document.querySelectorAll('.hero__kicker, .hero__name, .hero__role, .hero__dek, .hero__cta')) {
          const range = document.createRange();
          range.selectNodeContents(el);
          for (const q of range.getClientRects()) if (q.width && q.bottom > i.top && q.top < i.bottom) right = Math.max(right, q.right);
        }
        return { gap: right === -Infinity ? 9999 : Math.round(i.left - right) };
      });
      await page.close();
      assert.ok(r, `the hero results are hidden at ${vp.name}px wide`);
      assert.ok(r.gap >= 24, `at ${vp.name}px the results sit ${r.gap}px from the hero text beside them`);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('5 · text reads against the scene', () => {
  const PASSES = [['/', DESKTOP], ['/', { name: 'laptop 1440', width: 1440, height: 900, dpr: 1 }], ['/', LAPTOP], ['/', { name: 'laptop 1366', width: 1366, height: 768, dpr: 1 }], ['/', { name: 'laptop 1536x730', width: 1536, height: 730, dpr: 1 }], ['/', { name: 'tablet 1024x768', width: 1024, height: 768, dpr: 1 }], ['/', { name: 'tablet 768x1024', width: 768, height: 1024, dpr: 2, mobile: true }], ['/', { name: 'phone landscape 844x390', width: 844, height: 390, dpr: 2, mobile: true }], ['/', PHONE], ['/work', DESKTOP], [CASE, DESKTOP], [CASE, LAPTOP], [CASE, PHONE], ['/writing', DESKTOP]];
  for (const [route, vp] of PASSES) {
    test(`contrast · ${route} · ${vp.name}: 4.5:1 for text, 3:1 for large or decorative`, { timeout: 300000 }, async () => {
      const page = await open(route, vp, { reduce: true });
      const fails = [];
      try {
        await ready(page);
        // the home page at laptop and desktop widths: a finer stride catches the handovers between chapters
        const stops = await stopsOf(page, route === '/' && vp.width >= 1280 ? 0.25 : 0.6);
        if (route === '/') stops.push(...await handoverStops(page));   // and exactly where the sun crosses into each twilight
        for (const y of stops) {
          await scrollSettle(page, y);
          const phase = await page.evaluate(() => document.documentElement.dataset.phase);
          // while the sky is bright the drifting clouds matter: judge three points in their drift
          const drift = ['golden', 'sunset', 'civil', 'nautical'].includes(phase) ? [0, 45, 90] : [0];
          for (const idle of drift) {
            if (idle) { await page.evaluate((v) => { window.__sidereal.idle = v; }, idle); await wait(300); }
            fails.push(...await contrastFailures(page, `scrollY ${y} (${phase}, clouds at ${idle}s)`));
          }
          if (drift.length > 1) { await page.evaluate(() => { window.__sidereal.idle = 0; }); await wait(300); }
        }
      } finally { await page.close(); }
      assertReadable(fails);
    });
  }

  for (const vp of [DESKTOP, PHONE]) {
    test(`contrast · while the range is still arriving · / · ${vp.name}`, { timeout: 300000 }, async () => {
      const page = await open('/', vp, { reduce: true, holdPlate: true });
      const fails = [];
      try {
        await wait(1500);
        assert.ok(await page.evaluate(() => document.documentElement.classList.contains('webgl') && !document.documentElement.classList.contains('range-ready')), 'the plate was not held back');
        for (const y of await stopsOf(page)) {
          await scrollSettle(page, y, 500);
          fails.push(...await contrastFailures(page, `scrollY ${y}, plate still arriving`));
        }
      } finally { await page.close(); }
      assertReadable(fails);
    });
  }

  for (const vp of [DESKTOP, PHONE]) {
    test(`contrast · JavaScript off · / · ${vp.name}: the night still in night ink`, { timeout: 300000 }, async () => {
      const page = await open('/', vp, { js: false, qa: false });
      const fails = [];
      try {
        await wait(1500);
        for (const y of await stopsOf(page)) {
          await scrollSettle(page, y, 300);
          fails.push(...await contrastFailures(page, `scrollY ${y}`));
        }
      } finally { await page.close(); }
      assertReadable(fails);
    });
  }

  for (const [route, vp] of [['/', DESKTOP], ['/', PHONE], [CASE, DESKTOP]]) {
    test(`contrast · no WebGL · ${route} · ${vp.name}: every line reads against the night still`, { timeout: 300000 }, async () => {
      const plain = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--disable-3d-apis'] });
      const fails = [];
      try {
        const page = await open(route, vp, { b: plain, reduce: true });
        await wait(1200);
        for (const y of await stopsOf(page)) {
          await scrollSettle(page, y);
          fails.push(...await contrastFailures(page, `scrollY ${y}`));
        }
        await page.close();
      } finally { await plain.close(); }
      assertReadable(fails);
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
describe('6 · accessible structure and navigation', () => {
  test('heading outline: one h1 per page, one h2 per home chapter, no skipped levels', () => {
    const bad = [];
    for (const route of ROUTES) {
      const levels = [...read(distFile(route)).matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
      const h1 = levels.filter((l) => l === 1).length;
      if (h1 !== 1) bad.push(`${route}: ${h1} h1`);
      if (levels[0] !== 1) bad.push(`${route}: first heading is h${levels[0]}`);
      levels.forEach((l, i) => { if (i && l > levels[i - 1] + 1) bad.push(`${route}: h${levels[i - 1]} → h${l}`); });
    }
    for (const chunk of read('index.html').split(/<section\b/).slice(1)) {
      const openTag = chunk.slice(0, chunk.indexOf('>'));
      if (!/data-chapter/.test(openTag)) continue;
      const id = (openTag.match(/\sid="([^"]+)"/) || [])[1];
      const h2 = (chunk.split(/<\/section>/)[0].match(/<h2[\s>]/g) || []).length;
      if (id !== 'hero' && h2 !== 1) bad.push(`#${id}: ${h2} h2`);
    }
    assert.deepEqual(bad, []);
  });

  test('case titles in the work list are headings, one level under their section', () => {
    const home = [...read('index.html').matchAll(/<(h[1-6])\b[^>]*class="mf__title/g)].map((m) => m[1]);
    const work = [...read('work/index.html').matchAll(/<(h[1-6])\b[^>]*class="mf__title/g)].map((m) => m[1]);
    assert.ok(home.length > 0 && home.every((h) => h === 'h3'), `home work titles: ${home.join(', ') || 'none'}`);
    assert.ok(work.length === STUDIES.length && work.every((h) => h === 'h2'), `/work titles: ${work.join(', ') || 'none'}`);
  });

  test('skip link and in-page links land below the header and take focus', { timeout: 120000 }, async () => {
    const page = await open('/', DESKTOP);
    try {
      await ready(page);
      await page.keyboard.press('Tab');
      assert.ok(await page.evaluate(() => document.activeElement?.classList.contains('skip-link')), 'first Tab does not reach the skip link');
      await page.keyboard.press('Enter');
      await wait(1200);
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'top', 'skip link did not move focus to main');
      await page.click('a[href="#work"]');
      await wait(1800);
      const w = await page.evaluate(() => { const el = document.getElementById('work'); return { id: document.activeElement?.id, top: Math.round(el.getBoundingClientRect().top + parseFloat(getComputedStyle(el).paddingTop)), offset: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--head-offset')) }; });
      assert.equal(w.id, 'work');
      assert.ok(Math.abs(w.top - w.offset) <= 4, `#work's first line landed at ${w.top}px, expected ${w.offset}px`);
    } finally { await page.close(); }

    const caseStudy = await open(CASE, DESKTOP);
    try {
      await ready(caseStudy);
      const hash = await caseStudy.evaluate(() => document.querySelector('.toc a')?.getAttribute('href'));
      assert.ok(hash, 'case study has no contents links');
      await caseStudy.click('.toc a');
      await wait(1800);
      const h = await caseStudy.evaluate((hash) => {
        const el = document.getElementById(hash.slice(1));
        return { focused: document.activeElement === el, top: Math.round(el.getBoundingClientRect().top), offset: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--head-offset')) };
      }, hash);
      assert.ok(h.focused, `${hash} did not take focus`);
      assert.ok(Math.abs(h.top - h.offset) <= 4, `${hash} landed at ${h.top}px, expected ${h.offset}px`);
    } finally { await caseStudy.close(); }
  });

  test('header links, shared section links and links without WebGL all land a first line under the header', { timeout: 180000 }, async () => {
    const offsetOf = (page) => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--head-offset')));
    // the header's chapter link, clicked on a home page reached through a tagged share link
    const tagged = await open('/?utm_source=linkedin', DESKTOP);
    try {
      await ready(tagged);
      await tagged.evaluate(() => { window.__sameDocument = true; });
      await tagged.click('.hd__nav a[href="#about"]');
      await wait(1800);
      const r = await tagged.evaluate(() => { const el = document.getElementById('about'); return { same: window.__sameDocument === true, top: Math.round(el.getBoundingClientRect().top + parseFloat(getComputedStyle(el).paddingTop)) }; });
      const off = await offsetOf(tagged);
      assert.ok(r.same, 'the header link reloaded the page');
      assert.ok(Math.abs(r.top - off) <= 4, `#about's first line landed at ${r.top}px, expected ${off}px`);
    } finally { await tagged.close(); }
    // a shared link straight to a case-study section
    const hash = (read(distFile(CASE)).match(/class="toc"[\s\S]*?href="(#[^"]+)"/) || [])[1];
    assert.ok(hash, 'case study has no contents links');
    const deep = await open(`${CASE}${hash}`, DESKTOP, { qa: false });
    try {
      await wait(2500);
      const d = await deep.evaluate((h) => Math.round(document.getElementById(h.slice(1)).getBoundingClientRect().top), hash);
      const off = await offsetOf(deep);
      assert.ok(Math.abs(d - off) <= 4, `${hash} opened from a shared link lands at ${d}px, expected ${off}px`);
    } finally { await deep.close(); }
    // a contents link on a page without WebGL, where the browser jumps natively
    const plain = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--disable-3d-apis'] });
    try {
      const page = await open(CASE, DESKTOP, { b: plain });
      await wait(1200);
      await page.click(`.toc a[href="${hash}"]`);
      await wait(1500);
      const t = await page.evaluate((h) => Math.round(document.getElementById(h.slice(1)).getBoundingClientRect().top), hash);
      const off = await offsetOf(page);
      await page.close();
      assert.ok(Math.abs(t - off) <= 4, `without WebGL, ${hash} lands at ${t}px, expected ${off}px`);
    } finally { await plain.close(); }
  });

  test('in-page links leave modified clicks (new tab, new window) to the browser', { timeout: 60000 }, async () => {
    const page = await open('/', DESKTOP);
    try {
      await ready(page);
      const r = await page.evaluate(() => {
        const a = document.querySelector('a[href="#work"]');
        const click = (init) => { const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }); a.dispatchEvent(ev); return ev.defaultPrevented; };
        return { plain: click({}), meta: click({ metaKey: true }), ctrl: click({ ctrlKey: true }), shift: click({ shiftKey: true }), alt: click({ altKey: true }) };
      });
      assert.deepEqual(r, { plain: true, meta: false, ctrl: false, shift: false, alt: false });
    } finally { await page.close(); }
  });

  test('accessible names sit only on elements that can carry them, and the nav marks the current page', () => {
    const bad = [];
    for (const route of ROUTES) {
      for (const [tag] of read(distFile(route)).matchAll(/<(?:div|span|dl|p)\b(?![^>]*\brole=)[^>]*\baria-label=[^>]*>/g)) bad.push(`${route}: ${tag.slice(0, 90)}`);
    }
    assert.deepEqual(bad, []);
    assert.match(read('work/index.html'), /<a href="\/work" aria-current="page"/);
    assert.match(read(distFile(CASE)), /<a href="\/work" aria-current="true"/);
  });

  test('printing a case study gives dark text on white, without the scene or the header', { timeout: 60000 }, async () => {
    const page = await open(CASE, DESKTOP, { reduce: true });
    try {
      await page.emulateMediaType('print');
      const s = await page.evaluate(() => {
        const lumOf = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        return {
          stage: getComputedStyle(document.querySelector('.stage')).display,
          header: getComputedStyle(document.querySelector('.hd')).display,
          // every line of the article reads at 7:1 or better on the white page (the opening note prints in #444)
          textOnWhite: Math.min(...[...document.querySelectorAll('.page__title, .prose p, .prose li, .prose h2')].map((el) => 1.05 / (lumOf(getComputedStyle(el).color) + 0.05))) >= 7,
          pageWhite: lumOf(getComputedStyle(document.body).backgroundColor) > 0.9,
        };
      });
      assert.deepEqual(s, { stage: 'none', header: 'none', textOnWhite: true, pageWhite: true });
    } finally { await page.close(); }
  });

  test('the case-study contents follow every section to the last, and a click marks its own entry', { timeout: 300000 }, async () => {
    const problems = [];
    for (const st of STUDIES) {
      for (const vp of [DESKTOP, { name: 'desktop 1920', width: 1920, height: 1080 }]) {
        const page = await open(`/work/${st.slug}`, vp, { reduce: true });
        try {
          const ids = await page.evaluate(() => [...document.querySelectorAll('.prose > h2[id]')].filter((h) => document.querySelector(`.toc a[href="#${CSS.escape(h.id)}"]`)).map((h) => h.id));
          const marked = () => page.evaluate(() => [...document.querySelectorAll('.toc a[aria-current]')].map((a) => a.getAttribute('href').slice(1)));
          for (const id of ids.slice(0, -1)) {
            // reading down; sections in the last screen are judged at the page end instead
            const reachable = await page.evaluate((id) => {
              const h = document.getElementById(id), y = h.getBoundingClientRect().top + scrollY - innerHeight * 0.2;
              if (y > document.documentElement.scrollHeight - innerHeight * 1.7) return false;
              window.scrollTo(0, y); return true;
            }, id);
            if (!reachable) continue;
            await wait(250);
            const m = await marked();
            if (m.length !== 1 || m[0] !== id) problems.push(`${st.slug} @ ${vp.name}: reading "${id}" marks ${m.join(', ') || 'nothing'}`);
          }
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await wait(300);
          const end = await marked();
          if (end.length !== 1 || end[0] !== ids.at(-1)) problems.push(`${st.slug} @ ${vp.name}: at the end the contents mark ${end.join(', ') || 'nothing'}, not "${ids.at(-1)}"`);
          await page.click(`.toc a[href="#${ids[0]}"]`);
          await wait(400);
          const clicked = await marked();
          if (clicked.length !== 1 || clicked[0] !== ids[0]) problems.push(`${st.slug} @ ${vp.name}: clicking "${ids[0]}" marks ${clicked.join(', ') || 'nothing'}`);
        } finally { await page.close(); }
      }
    }
    assert.deepEqual(problems, []);
  });

  test('results in words carry the weight of the numbers beside them', { timeout: 120000 }, async () => {
    const bad = [];
    let judged = 0;
    for (const [route, val, cap] of [...STUDIES.map((st) => [`/work/${st.slug}`, '.case__val--word', '.case__cap']), ['/work', '.mf__val--word', '.mf__cap']]) {
      const page = await open(route, DESKTOP, { reduce: true });
      try {
        const r = await page.evaluate((val, cap) => {
          const c = document.querySelector(cap);
          return { words: [...document.querySelectorAll(val)].map((el) => parseFloat(getComputedStyle(el).fontSize)), cap: c ? parseFloat(getComputedStyle(c).fontSize) : 0 };
        }, val, cap);
        judged += r.words.length;
        for (const w of r.words) if (w < r.cap * 1.35) bad.push(`${route}: a result in words is ${w}px over a ${r.cap}px caption`);
      } finally { await page.close(); }
    }
    assert.ok(judged > 0, 'no result in words found to judge');
    assert.deepEqual(bad, []);
  });

  test('phone work rows give their text the full width, the arrow clear of the title', { timeout: 60000 }, async () => {
    const bad = [];
    for (const route of ['/', '/work']) {
      const page = await open(route, PHONE, { reduce: true });
      try {
        const rows = await page.evaluate(() => [...document.querySelectorAll('.mf__row')].map((row) => {
          const r = row.getBoundingClientRect(), main = row.querySelector('.mf__main').getBoundingClientRect(), metrics = row.querySelector('.mf__metrics')?.getBoundingClientRect();
          const go = row.querySelector('.mf__go').getBoundingClientRect(), title = row.querySelector('.mf__title');
          const range = document.createRange();
          range.selectNodeContents(title);
          const hit = [...range.getClientRects()].some((q) => q.width && Math.min(q.right, go.right) - Math.max(q.left, go.left) > 0 && Math.min(q.bottom, go.bottom) - Math.max(q.top, go.top) > 0);
          return { title: title.textContent.trim().slice(0, 30), short: Math.round(r.right - main.right), edges: metrics ? Math.round(Math.abs(metrics.right - main.right)) : 0, hit };
        }));
        if (!rows.length) bad.push(`${route}: no work rows`);
        for (const row of rows) {
          if (row.short > 4) bad.push(`${route}: "${row.title}" text stops ${row.short}px short of the row's right edge`);
          if (row.edges > 2) bad.push(`${route}: "${row.title}" readouts and text end ${row.edges}px apart`);
          if (row.hit) bad.push(`${route}: "${row.title}" has the arrow on its title`);
        }
      } finally { await page.close(); }
    }
    assert.deepEqual(bad, []);
  });

  test('the hero actions share one line on a 390px phone', { timeout: 60000 }, async () => {
    const page = await open('/', PHONE, { reduce: true });
    try {
      const r = await page.evaluate(() => [...document.querySelectorAll('.hero__cta > a')].map((a) => { const q = a.getBoundingClientRect(); return { top: q.top, bottom: q.bottom }; }));
      assert.equal(r.length, 2);
      assert.ok(r[1].top < r[0].bottom && r[1].bottom > r[0].top, `the actions sit on separate lines (${r.map((q) => Math.round(q.top)).join(', ')})`);
    } finally { await page.close(); }
  });

  test('with JavaScript off, the phone header band ends above the hero', { timeout: 60000 }, async () => {
    const page = await open('/', PHONE, { js: false, qa: false });
    try {
      const r = await page.evaluate(() => ({
        band: parseFloat(getComputedStyle(document.querySelector('.hd'), '::before').height) || 0,
        nav: Math.max(...[...document.querySelectorAll('.hd__nav a')].map((a) => a.getBoundingClientRect().bottom)),
        kicker: document.querySelector('.hero__kicker').getBoundingClientRect().top,
      }));
      assert.ok(r.kicker >= r.band, `the hero's first line starts at ${Math.round(r.kicker)}px, under a ${r.band}px band`);
      assert.ok(r.nav <= r.band * 0.8, `the nav runs to ${Math.round(r.nav)}px, past the band's opaque ${Math.round(r.band * 0.8)}px`);
    } finally { await page.close(); }
  });

  test('reading pages open with their first screen in place, never fading in', { timeout: 120000 }, async () => {
    const bad = [];
    for (const [route, vp] of [['/work', DESKTOP], [CASE, DESKTOP], [CASE, PHONE], ['/writing', DESKTOP]]) {
      const page = await open(route, vp);
      try {
        // record the lowest opacity each first-screen block shows, from the first frame of a fresh load
        await page.evaluateOnNewDocument(() => {
          window.__firstScreen = {};
          const sample = () => {
            for (const el of document.querySelectorAll('.rv')) {
              const q = el.getBoundingClientRect();
              if (!q.height || q.top >= innerHeight) continue;
              const key = [...el.classList].filter((c) => c !== 'is-in').join('.');
              window.__firstScreen[key] = Math.min(window.__firstScreen[key] ?? 1, parseFloat(getComputedStyle(el).opacity));
            }
            if (performance.now() < 3500) requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
        await page.reload({ waitUntil: 'networkidle2' });
        await wait(600);
        const seen = await page.evaluate(() => window.__firstScreen);
        if (!Object.keys(seen).length) bad.push(`${route} @ ${vp.name}: no first-screen block was sampled`);
        for (const [key, min] of Object.entries(seen)) if (min < 0.98) bad.push(`${route} @ ${vp.name}: .${key} faded in from opacity ${min.toFixed(2)}`);
      } finally { await page.close(); }
    }
    assert.deepEqual(bad, []);
  });

  test('the hero actions keep their lines whether or not the web font has arrived', { timeout: 180000 }, async () => {
    const bad = [];
    for (const width of [360, 375, 390, 412, 430]) {
      const heights = [];
      for (const blockFonts of [true, false]) {
        const page = await browser.newPage();
        try {
          await page.setViewport({ width, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
          await page.setRequestInterception(true);
          page.on('request', (r) => (BLOCKED.test(r.url()) || (blockFonts && r.resourceType() === 'font') ? r.abort() : r.continue()));
          await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
          await page.evaluate(() => document.fonts.ready);
          heights.push(await page.evaluate(() => Math.round(document.querySelector('.hero__cta').getBoundingClientRect().height)));
        } finally { await page.close(); }
      }
      if (Math.abs(heights[0] - heights[1]) > 2) bad.push(`${width}px: the actions take ${heights[0]}px in the fallback font and ${heights[1]}px in the web font`);
    }
    assert.deepEqual(bad, []);
  });

  test('a hidden tab puts the sky to sleep, and showing it wakes the sky again', { timeout: 60000 }, async () => {
    const page = await open('/', DESKTOP);
    try {
      await ready(page);
      const setHidden = (hidden) => page.evaluate((hidden) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);
      const skyTime = () => page.evaluate(() => window.__sidereal.idle);
      await setHidden(true);
      await wait(300);
      const a = await skyTime();
      await wait(1500);
      const b = await skyTime();
      assert.ok(b - a < 0.05, `the sky ran ${(b - a).toFixed(2)}s in 1.5s while the tab was hidden`);
      await setHidden(false);
      await wait(300);
      const c = await skyTime();
      await wait(1500);
      const d = await skyTime();
      assert.ok(d - c > 0.5, `the sky ran only ${(d - c).toFixed(2)}s in 1.5s after the tab came back`);
    } finally { await page.close(); }
  });

  test('the nav shows the reader where they are', { timeout: 60000 }, async () => {
    const page = await open('/work', DESKTOP, { reduce: true });
    try {
      const s = await page.evaluate(() => {
        const cur = document.querySelector('.hd__nav a[aria-current]'), other = document.querySelector('.hd__nav a:not([aria-current]):not(.hd__cv)');
        return { current: cur?.textContent.trim(), differs: !!cur && !!other && getComputedStyle(cur).color !== getComputedStyle(other).color };
      });
      assert.deepEqual(s, { current: 'Work', differs: true });
    } finally { await page.close(); }
  });

  test('with WCAG text-spacing overrides no text is cut off at 320px', { timeout: 240000 }, async () => {
    const bad = [];
    for (const route of ['/', ...STUDIES.map((st) => `/work/${st.slug}`)]) {
      const page = await open(route, { name: 'phone 320', width: 320, height: 568, dpr: 2, mobile: true }, { reduce: true });
      try {
        await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }' });
        await wait(300);
        // the page clips sideways overflow (overflow-x: clip), so it never scrolls: look for text cut off at the edges instead
        const cut = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth, out = [];
          const skip = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const c = getComputedStyle(e); if (c.visibility === 'hidden' || /auto|scroll/.test(c.overflowX) || e.matches('.sr-only, .skip-link, [aria-hidden="true"]')) return true; } return false; };
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const n = walker.currentNode;
            if (!/\S/.test(n.textContent) || !n.parentElement || n.parentElement.closest('script, style, noscript') || skip(n.parentElement)) continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            for (const q of range.getClientRects()) if (q.width && (q.right > vw + 1 || q.left < -1)) { out.push(`"${n.textContent.trim().slice(0, 30)}" spans ${Math.round(q.left)} to ${Math.round(q.right)}px of ${vw}`); break; }
          }
          return out;
        });
        for (const c of cut) bad.push(`${route}: ${c}`);
      } finally { await page.close(); }
    }
    assert.deepEqual(bad, []);
  });

  test('keyboard focus is visible at every stop along the Tab order, never inside an invisible block', { timeout: 420000 }, async () => {
    const bad = [];
    for (const [route, vp] of [['/', DESKTOP], ['/', { name: 'laptop 1366', width: 1366, height: 768, dpr: 1 }], [CASE, DESKTOP], ['/', PHONE], [CASE, PHONE]]) {
      const page = await open(route, vp);
      try {
        await ready(page);
        const seen = new Set();
        let lastY = null, lastX = null;
        for (let i = 0; i < 90; i++) {
          await page.keyboard.press('Tab');
          await wait(60);
          const f = await page.evaluate(() => {
            const el = document.activeElement;
            if (!el || el === document.body) return null;
            const cs = getComputedStyle(el);
            return {
              index: [...document.querySelectorAll('*')].indexOf(el),
              label: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} ${el.getAttribute('href') || el.textContent.trim().slice(0, 32)}`,
              ring: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || cs.boxShadow !== 'none',
              opacity: (() => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; })(),
              docY: el.closest('.hd, .skip-link') ? null : Math.round(el.getBoundingClientRect().top + scrollY),
              docX: Math.round(el.getBoundingClientRect().left),
            };
          });
          if (!f || seen.has(f.index)) break;   // back round to the start
          seen.add(f.index);
          if (!f.ring) bad.push(`${route} @ ${vp.name}: ${f.label}`);
          if (f.opacity < 0.98) bad.push(`${route} @ ${vp.name}: ${f.label} takes focus at opacity ${f.opacity.toFixed(2)}`);
          // Tab order follows the layout: within one column, focus never jumps back up the page
          if (f.docY !== null && lastY !== null && Math.abs(f.docX - lastX) < 200 && f.docY < lastY - 120) bad.push(`${route} @ ${vp.name}: Tab jumps back up to ${f.label} (${lastY} → ${f.docY}px)`);
          if (f.docY !== null) { lastY = f.docY; lastX = f.docX; }
        }
        if (seen.size < 5) bad.push(`${route} @ ${vp.name}: only ${seen.size} Tab stops reached`);
      } finally { await page.close(); }
    }
    assert.deepEqual(bad, []);
  });

  test('the phone menu opens, closes with Escape and hands focus back to its button', { timeout: 60000 }, async () => {
    const page = await open('/', PHONE);
    const probe = () => page.evaluate(() => ({
      expanded: document.getElementById('menu-btn').getAttribute('aria-expanded'),
      shown: getComputedStyle(document.getElementById('mobile-nav')).display !== 'none',
      focus: document.activeElement?.id || document.activeElement?.tagName.toLowerCase(),
    }));
    try {
      await page.click('#menu-btn');
      await wait(250);
      assert.deepEqual(await probe(), { expanded: 'true', shown: true, focus: 'menu-btn' });
      await page.focus('#mobile-nav a');
      await page.keyboard.press('Escape');
      await wait(250);
      assert.deepEqual(await probe(), { expanded: 'false', shown: false, focus: 'menu-btn' });
      await page.click('#menu-btn');
      await wait(250);
      await page.mouse.click(8, PHONE.height - 40);   // a tap in the gutter, outside the menu and any link
      await wait(250);
      assert.equal((await probe()).expanded, 'false', 'a tap outside the open menu should close it');
    } finally { await page.close(); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('7 · build, search and social', () => {
  test('every page ships a title, description, canonical URL and social image', () => {
    const bad = [];
    for (const route of ROUTES) {
      const html = read(distFile(route));
      for (const [name, re] of [
        ['title', /<title>[^<]+<\/title>/],
        ['description', /<meta name="description" content="[^"]+"/],
        ['canonical', /<link rel="canonical" href="https:\/\/moonbatant\.com\/[^"]*"/],
        ['og:image', /<meta property="og:image" content="https:\/\/moonbatant\.com\/og-image\.jpg"/],
      ]) if (!re.test(html)) bad.push(`${route}: ${name}`);
    }
    assert.deepEqual(bad, []);
    assert.ok(fs.existsSync(path.join(DIST, 'og-image.jpg')), 'og-image.jpg missing');
  });

  test('the superseded /flight page stays out of search; the new pages are in the sitemap', () => {
    const sitemap = read('sitemap-0.xml');
    assert.ok(!sitemap.includes('/flight'), '/flight is in the sitemap');
    assert.match(read('flight/index.html'), /<meta name="robots" content="noindex"/);
    assert.deepEqual(STUDIES.filter((s) => !sitemap.includes(`/work/${s.slug}`)).map((s) => s.slug), []);
  });

  test('?og=1 frames a clean thumbnail; ordinary query strings leave the page alone', { timeout: 90000 }, async () => {
    const probe = (page) => page.evaluate(() => ({
      og: document.documentElement.classList.contains('og'),
      dek: getComputedStyle(document.querySelector('.hero__dek')).display,
      nav: getComputedStyle(document.querySelector('.hd__nav')).display,
    }));
    const og = await open('/?og=1', DESKTOP);
    const a = await probe(og);
    await og.close();
    assert.deepEqual(a, { og: true, dek: 'none', nav: 'none' });
    const tracked = await open('/?utm_source=google&ref=blog', DESKTOP);
    const b = await probe(tracked);
    await tracked.close();
    assert.deepEqual(b, { og: false, dek: 'block', nav: 'flex' });
  });

  test('the home page downloads a light first load', { timeout: 90000 }, async (t) => {
    const page = await open('/', DESKTOP);
    try {
      await ready(page);
      await wait(2000);
      const bytes = await page.evaluate(() => performance.getEntriesByType('navigation').concat(performance.getEntriesByType('resource'))
        .filter((e) => e.name.startsWith(location.origin)).reduce((sum, e) => sum + (e.encodedBodySize || 0), 0));
      t.diagnostic(`home first load: ${(bytes / 1024).toFixed(0)} KB over the wire, fonts, plates, clouds and scripts included`);
      assert.ok(bytes <= 1_600_000, `the home page's first load is ${bytes} bytes (measured 1185 KB when this budget was set)`);
    } finally { await page.close(); }
  });

  test('the sky canvas stays within a pixel budget on large, dense screens', { timeout: 120000 }, async (t) => {
    // the engine lowers the canvas's pixel ratio toward ~3 MP, but never below CSS resolution (softer stars)
    for (const [vp, limit, rule] of [
      [{ name: '1920x1080@2', width: 1920, height: 1080, dpr: 2 }, 3.1e6, 'about 3 MP'],
      [{ name: '2560x1440@2', width: 2560, height: 1440, dpr: 2 }, 2560 * 1440 * 1.01, 'CSS resolution'],
    ]) {
      const page = await open('/', vp);
      try {
        await ready(page);
        const px = await page.evaluate(() => { const c = document.getElementById('sky'); return c.width * c.height; });
        t.diagnostic(`canvas at ${vp.name}: ${(px / 1e6).toFixed(2)} MP (a device-resolution canvas would be ${((vp.width * vp.height * 4) / 1e6).toFixed(1)} MP)`);
        assert.ok(px <= limit, `at ${vp.name} the canvas is ${(px / 1e6).toFixed(2)} MP; the budget is ${rule}`);
      } finally { await page.close(); }
    }
  });

  test('the range plate has no keying holes in its rock', async () => {
    // rectangles (4096-wide texture px) where the keyed cutout once showed sky through solid rock
    const HOLES = { 'slit A': [3174, 1162, 3186, 1240], 'slit B': [3234, 1154, 3256, 1215], 'window C': [2841, 1182, 2876, 1229], 'window D': [1769, 1152, 1804, 1205] };
    const found = [];
    for (const file of ['range.webp', 'range-2k.webp']) {
      const { data, info } = await sharp(path.join(DIST, 'sidereal', file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const W = info.width, s = W / 4096, A = (x, y) => data[(y * W + x) * 4 + 3];
      const firstSolid = (x, yFrom, yTo) => { for (let y = yFrom; y <= yTo; y++) if (A(x, y) >= 250) return y; return yTo; };
      for (const [name, r] of Object.entries(HOLES)) {
        const [x0, y0, x1, y1] = r.map((v) => Math.round(v * s)), xa = x0 - 3, xb = x1 + 3, top = y0 - Math.round(80 * s);
        const rL = firstSolid(xa - 2, top, y1), rR = firstSolid(xb + 2, top, y1);   // the ridge, read from solid rock either side
        let seeThrough = 0;
        for (let x = xa; x <= xb; x++) {
          const ridge = Math.round(rL + (rR - rL) * (x - xa) / (xb - xa));
          for (let y = ridge + 3; y <= y1; y++) if (A(x, y) < 200) seeThrough++;
        }
        if (seeThrough) found.push(`${file} ${name}: ${seeThrough} see-through pixels below the ridge`);
      }
    }
    assert.deepEqual(found, []);
  });

  test('the home page stays light', (t) => {
    const html = read('index.html');
    const scripts = [...new Set([...html.matchAll(/(?:src|href)="(\/_astro\/[^"]+\.js)"/g)].map((m) => m[1]))];
    const jsBytes = scripts.reduce((sum, f) => sum + fs.statSync(path.join(DIST, f)).size, 0);
    const assetBytes = fs.readdirSync(path.join(DIST, 'sidereal')).reduce((sum, f) => sum + fs.statSync(path.join(DIST, 'sidereal', f)).size, 0);
    t.diagnostic(`home JS ${(jsBytes / 1024).toFixed(1)} KB · sky assets ${(assetBytes / 1024).toFixed(0)} KB`);
    assert.ok(jsBytes <= 80_000, `home page JavaScript is ${jsBytes} bytes`);
    assert.ok(assetBytes <= 1_600_000, `public/sidereal is ${assetBytes} bytes`);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('8 · the scene is never annotated', () => {
  for (const route of ROUTES) {
    test(`${route}: no coordinates, degrees, clock, weather, place names or sky data, and none fetched`, { timeout: 120000 }, async () => {
      const found = [];
      for (const vp of [DESKTOP, PHONE]) {
        const page = await open(route, vp);
        try {
          await ready(page);
          await walk(page);
          const hits = await page.evaluate((patterns) => {
            const texts = [document.body.innerText];
            for (const el of document.body.querySelectorAll('*')) {
              for (const a of ['aria-label', 'title', 'alt', 'placeholder']) { const v = el.getAttribute(a); if (v) texts.push(v); }
              for (const pseudo of ['::before', '::after']) {
                const cs = getComputedStyle(el, pseudo);
                if (cs.display === 'none') continue;
                const c = cs.content;
                if (!c || c === 'none' || c === 'normal') continue;
                const attr = c.match(/^attr\(([\w-]+)\)$/);
                if (attr) { const v = el.getAttribute(attr[1]); if (v) texts.push(v); } else if (/^".+"$/.test(c)) texts.push(c.slice(1, -1));
              }
            }
            const all = texts.join('\n');
            return patterns.map(([name, source, flags]) => { const m = all.match(new RegExp(source, flags)); return m ? `${name}: "${m[0]}"` : null; }).filter(Boolean);
          }, SCENE_DATA.map(([name, re]) => [name, re.source, re.flags]));
          found.push(...hits.map((h) => `${vp.name} → ${h}`));
          found.push(...page.external.filter((u) => !/posthog\.com/.test(u)).map((u) => `${vp.name} → fetches outside data: ${u.slice(0, 90)}`));
        } finally { await page.close(); }
      }
      assert.deepEqual(found, []);
    });
  }
});
