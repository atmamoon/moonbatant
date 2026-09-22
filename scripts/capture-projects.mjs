// Screenshot harness for the independent-project case studies.
//
// Each project lives in its own repo outside this one. Start it locally, then
// this drives installed Chrome through it and captures the screens referenced by
// the `gallery` frontmatter in src/content/work/. Output: public/shots/<slug>/.
//
//   node scripts/capture-projects.mjs                 # every project
//   node scripts/capture-projects.mjs backstop koragg # a subset
//
// Where each project is served from is machine-specific, so it is read from
// scripts/project-sources.local.json (untracked) rather than hard-coded here:
//
//   { "backstop": { "url": "http://localhost:5173/" },
//     "closesure": { "file": "/abs/path/to/dist/index.html" } }
//
// A flow entry takes either `url` for an already-running server or `file` for a
// self-contained build opened over file://. Run notes are in that same file.
//
// Shots are captured at 1600x1000 with deviceScaleFactor 2, then resampled to
// 1600px wide WebP, roughly 2x the 720px reading measure the figures render at.
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_ROOT = 'public/shots';
const SOURCES_FILE = 'scripts/project-sources.local.json';
const VIEWPORT = { width: 1600, height: 1000, deviceScaleFactor: 2 };

let SOURCES = {};
try {
  SOURCES = JSON.parse(readFileSync(SOURCES_FILE, 'utf8'));
} catch {
  console.error(`! ${SOURCES_FILE} not found. See the header comment for its shape.`);
  process.exit(1);
}

/** Resolve a flow's target from the local sources file. */
function resolveUrl(name) {
  const src = SOURCES[name];
  if (!src) throw new Error(`${SOURCES_FILE} has no entry for "${name}"`);
  if (src.url) return src.url;
  if (src.file) return `file://${src.file}`;
  throw new Error(`${SOURCES_FILE} entry "${name}" needs a url or a file`);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Click the first element matching `selector` whose text contains `text`. */
async function clickText(page, selector, text, { settle = 900 } = {}) {
  const hit = await page.evaluate(
    (sel, t) => {
      const el = [...document.querySelectorAll(sel)].find((e) =>
        e.textContent.replace(/\s+/g, ' ').includes(t),
      );
      if (!el) return false;
      el.scrollIntoView({ block: 'center' });
      el.click();
      return true;
    },
    selector,
    text,
  );
  if (!hit) throw new Error(`no <${selector}> containing "${text}"`);
  await wait(settle);
}

/**
 * Pin the page's clock. Some dashboards render relative times ("overdue 3h")
 * from Date.now(), so a fixture world dated in the past reads as months late.
 * Shifting the clock keeps time flowing while placing it inside that world.
 */
async function pinClock(page, iso) {
  await page.evaluateOnNewDocument((target) => {
    const Real = Date;
    const offset = new Real(target).getTime() - Real.now();
    class Shifted extends Real {
      constructor(...args) {
        if (args.length === 0) super(Real.now() + offset);
        else super(...args);
      }
      static now() {
        return Real.now() + offset;
      }
    }
    window.Date = Shifted;
  }, iso);
}

/** Capture the viewport (or one element) as WebP. */
async function shot(page, slug, name, { selector = null } = {}) {
  const dir = `${OUT_ROOT}/${slug}`;
  mkdirSync(dir, { recursive: true });
  const target = selector ? await page.$(selector) : page;
  if (!target) throw new Error(`missing selector for shot: ${selector}`);
  const png = await target.screenshot({ type: 'png' });
  const file = `${dir}/${name}.webp`;
  await sharp(png).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 78 }).toFile(file);
  const { size } = await sharp(file).metadata().then(async (m) => ({ size: m.size ?? 0 }));
  console.log(`  ✓ ${file}${size ? ` (${Math.round(size / 1024)} KB)` : ''}`);
}

// ── Flows ────────────────────────────────────────────────────────────────

const FLOWS = {
  // Serve the prototype's vite dev server, then point `backstop` at it.
  backstop: {
    async run(page) {
      await wait(1200);
      await shot(page, 'backstop', '01-queue');

      // Exception review: 9 pinned findings across all three claim tiers.
      await clickText(page, 'button', 'Top Cover', { settle: 2600 });
      await shot(page, 'backstop', '02-exception-review');

      // The findings report generated off that review.
      await clickText(page, 'button', 'Create report', { settle: 2000 });
      await shot(page, 'backstop', '03-report');

      // Standards profile hierarchy. The drawing workspace hides the sidebar,
      // so step back to the queue before switching sections.
      await clickText(page, 'button', 'Queue', { settle: 1600 });
      await clickText(page, 'button', 'Standards', { settle: 1600 });
      await shot(page, 'backstop', '04-standards');

      // Measurement design over live session actions.
      await clickText(page, 'button', 'Insights', { settle: 1600 });
      await shot(page, 'backstop', '05-insights');
    },
  },

  // Serve the read-only dashboard against the SYNTHETIC FIXTURE LEDGER only.
  // The live ledger in that repo holds real Slack and Gmail, and must never be
  // the capture target. Point `koragg` at the fixture server.
  koragg: {
    clock: '2026-06-25T09:30:00Z', // the demo world's own morning
    async run(page) {
      await wait(2400);
      await shot(page, 'koragg', '01-board');

      await clickText(page, 'button', 'Brief', { settle: 1600 });
      await shot(page, 'koragg', '02-brief');

      await clickText(page, 'button', 'Eval', { settle: 1800 });
      await shot(page, 'koragg', '03-eval');

      await clickText(page, 'button', 'Activity', { settle: 1600 });
      await shot(page, 'koragg', '04-activity');
    },
  },

  // Nothing to start: point `closesure` at the self-contained build with `file`.
  closesure: {
    async run(page) {
      await wait(1800);
      await shot(page, 'closesure', '01-dashboard');

      // Where the engine proposes and a person decides.
      await clickText(page, 'button', 'Open bank matching', { settle: 1800 });
      await shot(page, 'closesure', '02-bank-matching');

      // Input tax credit exposure, vendor by vendor.
      await clickText(page, 'button', 'GST credit (2B) recon', { settle: 1800 });
      await shot(page, 'closesure', '03-gst-credit');

      // The certified output.
      await clickText(page, 'button', 'Close pack', { settle: 1800 });
      await shot(page, 'closesure', '04-close-pack');
    },
  },

  // Serve the Next dev server, then point `dietician-scribe` at it.
  'dietician-scribe': {
    async run(page) {
      // The consult transcript streams in on a 600 ms tick over 47 steps, so
      // let it finish before capturing or the record panel is still empty.
      await wait(32000);
      await shot(page, 'dietician-scribe', '01-capture');

      await clickText(page, 'button', 'End & review record', { settle: 2600 });
      await shot(page, 'dietician-scribe', '02-review');

      // The confirm CTA is gated: every flagged field has to be resolved first.
      const resolved = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Confirm');
        buttons.forEach((b) => b.click());
        return buttons.length;
      });
      console.log(`  · resolved ${resolved} flagged field(s)`);
      await wait(1200);

      await clickText(page, 'button', 'Confirm & generate targets', { settle: 5000 });
      await shot(page, 'dietician-scribe', '03-targets');

      await clickText(page, 'button', 'Confirm & generate plan', { settle: 5000 });
      await shot(page, 'dietician-scribe', '04-plan');
    },
  },
};

// ── Driver ───────────────────────────────────────────────────────────────

const requested = process.argv.slice(2);
const names = requested.length ? requested : Object.keys(FLOWS);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--hide-scrollbars', '--force-color-profile=srgb', '--allow-file-access-from-files'],
  defaultViewport: VIEWPORT,
});

let failed = 0;
for (const name of names) {
  const flow = FLOWS[name];
  if (!flow) {
    console.error(`! unknown project: ${name}`);
    failed++;
    continue;
  }
  let url;
  try {
    url = resolveUrl(name);
  } catch (e) {
    console.error(`! ${e.message}`);
    failed++;
    continue;
  }
  console.log(`\n${name} → ${url}`);
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
  try {
    if (flow.clock) await pinClock(page, flow.clock);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await flow.run(page);
  } catch (e) {
    console.error(`  ✗ ${e.message}`);
    failed++;
  }
  if (errors.length) console.error(`  page errors: ${errors.join(' | ')}`);
  await page.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
