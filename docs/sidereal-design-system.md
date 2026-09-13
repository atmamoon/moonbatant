# SIDEREAL — the moonbatant design system

*One evening at a high camp below a great range. The page is a clock nobody has to read.*

Sidereal replaces the "Living Expedition" (float-glass cards over crossfading
photos, an altitude rope) with a single physically-driven world. Every visual
state on the site derives from **one scalar: the altitude of the sun**. Scrolling
advances the evening from golden hour to astronomical night. Nothing is
decorated. Sky colour, which stars are visible, the Milky Way, the colour of the
snow, the moonrise — all are consequences of that one number, the way they are
in the mountains.

The sensibility is Nolan's: practical, monumental, restrained, precise. Real
data where real data exists (a real star catalogue, real twilight physics, real
diurnal rotation). Wide, quiet typography. Time as structure. No glass, no pills,
no rounded cards. Content stands in the scene the way the moon stands in the
sky and a white peak stands against it from the valley floor: **luminous
objects in a vast dark field, separated by contrast and emptiness, not by
boxes.**

---

## 1. The clock — chapters as solar altitude

The home page is one evening at ~28°N, late October, looking north at the
range. Each section is a chapter of twilight, pinned to a real solar altitude.
The altitudes and phase names below are the engine's model, not page copy: they
decide the light and are never printed (see *The scene is never annotated*).

| Chapter | Content | Sun altitude | Phase | What the world does | The frame |
|---|---|---|---|---|---|
| 01 | Hero (name, positioning) | +4° | Golden hour | Low amber light rakes the snow; gold horizon, deep-blue zenith | Two-line inscription, left-weighted; the right third carries the proof — one lead result per case, as instruments |
| 02 | Selected work | −1° | Sunset · alpenglow | Only the summits glow rose; the first stars | The manifest: hairline rows, instrument readouts |
| 03 | About | −5° | Civil twilight | Belt of Venus + earth shadow; stars to mag 2 | The light goes flat: one centred measure, credits beneath |
| 04 | Experience | −10° | Nautical twilight | Horizon fades; stars to mag 4; snow goes silver-blue | The ledger |
| 05 | Education | −14° | Astronomical twilight | Stars to mag 6 | A short entry |
| 06 | Writing | −18° | Night | Milky Way at full strength | Rows, narrowed to 960px |
| 07 | Contact | −22° | Moonrise | The moon breaks the highest summit's ridge and climbs; the sky wheels at 1× while you read | One sentence, centred, the whole sky |

Outgoing chapters fade to zero under the header band (opacity only).

### The scene is never annotated

No coordinates, degrees, local clock, weather readings, place names or sky-phase
labels appear anywhere on the page, in visible text or in accessible names, and
the page fetches no weather. An earlier version carried a time-card (clock, sun
altitude, live summit weather), a solar-altitude scale and per-chapter slates.
They were removed on 2026-09-13: readers could mistake that data for the
portfolio's content, and it pulled the eye while reading. The light still changes
with every chapter; the reader feels the evening without being told about it.
Group 8 of `tests/sidereal.test.mjs` fails if any of it comes back.

Rules:
- The sun altitude is derived from scroll progress (eased), never the reverse.
  Effects **read** scroll; nothing ever writes it.
- While the reader is still, real time passes at 1×: the sky wheels at its true
  15°/hour and stars scintillate. Nothing else moves under text being read.
- Case-study and writing pages sit at *night* (−20°, moon up) — the reading hour.

## 2. The world — one WebGL stage

A single fixed `<canvas>` (`src/scripts/sky.ts`) renders, back to front:

1. **Sky** — analytic twilight gradient over view elevation + azimuth-to-sun,
   blended between five measured keyframes (golden / sunset / civil / nautical /
   night). Includes the earth-shadow band and the Belt of Venus during civil
   twilight, and night airglow near the horizon. Phones and tablets keep the 16:10
   vertical field and crop the sides, like the range plate, so the fall-off below the
   horizon stays as gentle as it is on desktop.
2. **Milky Way** — a texture baked from the d3-celestial isophote contours
   (`scripts/bake-sky.mjs`), mapped on the celestial sphere, faded in below −12°. Value noise fixed
   to the sky breaks its soft isophote plateaus into star clouds and dark lanes, and its densest light warms
   toward the core's colour.
3. **Stars** — 5,044 real stars (d3-celestial `stars.6`, Hipparcos-derived,
   mag ≤ 6) as GL points. Real RA/Dec → alt/az for the site's latitude and the
   chapter's sidereal time, with east on the right of the north-north-east view, where
   the stars rise. Size and brightness from magnitude; colour from B−V.
   Limiting magnitude rises with darkness, so the sky fills in bright-first, the
   way it really does. They scintillate quickly and irregularly, never a slow pulse,
   most through the thick air near the horizon, where the brightest flash faint colour.
4. **Moon** — photographic disc, opaque, drawn behind the range: it starts below
   the highest summit on the right of the frame, where a moon really rises in this view,
   and rises through chapter 07, drifting a little rightward and kept clear of the header band, until at the page's
   end it rests on its summit, the ridge biting its lower quarter — the Ridgemoon mark, realised in the world.
   Where that summit sits under the contact text it rises clear of the lines instead, and on portrait screens it
   climbs higher, above them. A full moon
   owns its sky: limiting magnitude drops ~1.3, the Milky Way goes, a wide aureole lifts
   the sky around it, and the disc itself, lifted and hugged by a tight glow, is the
   brightest thing in the frame. Time on the page lifts only a risen moon, a little, so a
   long visit never floats it up behind the text. On reading pages a smaller disc (80px) hangs
   centred in the right margin, measured from the text column's real edge, with at
   least 48px of air on each side. Where the margin can't hold that (below roughly
   1440px wide, and on phones) reading pages show no moon. It drifts slowly upward, never under the header band.
5. **The range** — one real-looking plate of a Himalayan range at golden hour,
   sky keyed out (`public/sidereal/range.webp`, RGBA, padded to a power-of-two
   canvas so it mipmaps; `range.json` carries the sub-rect and the skyline profile, which sits on the solid rock; the suite
   scans both plates for sky showing through beneath it). Relit *in the shader* by
   the same sun altitude: warm highlight lift at golden hour, rose alpenglow at
   sunset, desaturated silver-blue at night, with the shadow side always cool. Cloud and
   plume baked in above the ridge were lit by the low sun, so they thin out as it sets and are
   gone by −4° (the shader reads the skyline profile as a one-row texture), leaving clean peaks at night.
6. **Atmosphere** — two cloud layers drifting downwind at different depths (about 8
   and 6 px/s at 1600px wide), their tiles never narrower than the screen is tall, the faint
   haze around each cloud cut so it keeps an edge; a cloud carries light only while the sky or the moon lights it, its body is lit unevenly by its own
   texture and its sunward edge catches the low sun's glow; on a moonless night it gives no light and only dims the
   sky behind it, keeping that sky's gradient, a little denser and lower, across the last glow above the ridge and
   the starlit snow;
   cloud shadows shaped by the nearer layer, travelling with it and falling on the
   range only, while there is sun to cast them;
   spindrift puffs blowing off the summits at a fraction of a degree a second; an occasional satellite crossing at a
   low orbit's half to one degree a second; a rare meteor, one continuous 15–25° streak, every 8 to 20 minutes after
   dark. Speeds are angles, not screen units, so a phone and a desktop see the same sky; satellites and meteors keep
   to the home page, so nothing crosses behind reading-page text. Measured: about 1.9% of pixels change over six seconds at golden
   hour and 2.5% under the risen moon, slow but alive; a moonless night moves only faintly (about 0.4%), since its
   clouds give no light and only dim the sky they cross.

Performance contract: a canvas pixel ratio between 1 and 1.5, lowered on large dense screens so
the canvas stays near 3 MP (never below CSS resolution) and asks for the low-power GPU, plates are prepared as bitmaps off the main thread, a fading chapter gets
its own layer, cloud passes scissored to their band,
~8 draw calls per frame (the moon is a small
quad, masks upload as LUMINANCE_ALPHA, uniform locations are cached), zero DOM
paint animation; the loop sleeps under reduced motion once the sun has settled and
never draws in a hidden tab. Motion is always on, with no site toggle; only the reader's
own `prefers-reduced-motion` setting stills it (a still night frame is drawn once). Without WebGL, or when the context is lost
mid-visit, every page shows a night still in night ink, with every chapter visible; so
does a page with JavaScript off, and a range plate that fails to load. While the plate is
still arriving, a chapter past golden hour reads over the night still.

## 3. Typography — wide, quiet, exact

| Role | Face | Setting |
|---|---|---|
| Wordmark / chapter cards / numerals | **Archivo** (variable, `wdth` 125) | Uppercase, weight 300–400, tracking 0.16–0.22em. The name is set as a horizon-wide inscription above the peaks. |
| Headlines, titles, prose | **Newsreader** (variable, opsz) | Weight 400 (never semibold), leading 1.02–1.1 for display, 1.7 for prose at 18px. Italic only for pull quotes and the dek. |
| Labels, meta, readouts | **JetBrains Mono** | 11–12px, uppercase, tracking 0.14em, muted. |
| UI copy (nav, buttons, summaries) | **Archivo** (`wdth` 100) | 14–15px, weight 400–500. |

Colour of type follows the light: `--ink` is warm snow in golden hour and cool
snow at night, switched per chapter (a discrete change, never animated
per-frame). Every line meets WCAG AA (4.5:1, 3:1 for large text) against the live scene, as the tests
measure it; body text over open sky runs 7:1 or better.

## 4. Surfaces — none

- **No cards.** Content units are separated by 1px hairlines
  (`rgba(255,255,255,.16)`), by index numerals (`01`), and by whitespace.
- **No radius** on any rectangle. Buttons are text with a hairline rule, or a
  1px outlined rectangle with tracked caps (a slate label); the one primary action
  per page is a solid ink slate. Hover extends the rule / brightens it to alpenglow.
  No shadows, no blur.
- **No pills.** Skills are set as film credits: group name right-aligned in mono
  caps, items in a running line with a thin middot before each; the dot that would
  start a line is clipped away, so none ever dangles. On phones the group sits above.
- **Metrics** are Archivo-expanded numerals, each over its mono caption, so captions
  share one left edge in every row: instrument readouts, not badges. Only values that
  are numbers get the numeral; phrases ("Minutes") are set in the reading serif at a comparable
  size, so a result in words carries the weight of a number. On phones a case study's results
  stack one to a row.
- **Legibility without boxes** comes from placement (text lives in the dark
  upper sky; the range lives low), from three cinematographer's grads on the stage
  (a lower ND grad, a left-weighted grad and a right-edge grad that fade out
  continuously as the sun sinks through nautical twilight; the last two are multiplied into the WebGL frame, so they
  darken without a blue cast, with CSS copies for the poster fallbacks), from a tight ink shadow keyed to the phase, and from an
  opaque title-safe band behind the header. Clouds keep full strength with motion off,
  so a still frame is the worst case for contrast, and the tests judge bright chapters
  at three points in the clouds' drift.
- **Below 1100px wide, and on landscape phones,** secondary ink steps up to full ink and the
  readout halo widens on the home page, where the lit range sits behind more of the text, and a soft radial grad dims
  the horizon glow that the portrait crop puts behind the hero's lines. Contrast is
  judged in windows about two and a half characters wide, so a bright patch behind a
  few words fails, and generated numbers (section and list counters) are judged too.
- **The header band** is opaque where the nav sits, in a darker shade of the sky's own colour
  while the sky is bright (golden hour to nautical twilight), so it reads as dusk overhead,
  not a toolbar.
- **Below 1100px** the hero's four results sit beneath its actions as a two-by-two readout; from 375px
  wide both actions share one line, in the web font and its fallback alike, so the font's arrival never
  shifts the page; narrower phones stack them.
- **Case-study section headings** are set in the reading serif, larger than the body, each
  numbered in small alpenglow mono; the sticky contents column marks the section being read,
  down to the last one, and a click marks its own entry.
- **Details stay beside what they describe:** writing rows keep a 960px measure, education
  dates end with the school's line, experience dates sit beside the highlights.
- **The nav** links Work, About, Experience, Writing and Contact. In forced colours the header
  band turns to a solid system background; printed pages are dark text on white, without the
  scene or the header. The page being read is marked in the nav in full ink. On the home page every nav item
  scrolls in place, Work included, and the nav marks the chapter being read.
- **Result captions** are 12px mono (13px on case studies): a number means nothing without its caption, and
  each hero result names the company where it was earned.

## 5. Layout

- 12-column grid, max 1280px, gutter `clamp(20px, 5vw, 48px)`.
- Text is **left-weighted** (columns 1–7). The right side is kept open — that is
  where the peaks stand and where the moon rises.
- Reading measure 34em (≈ 72 characters of Newsreader; `ch` overstates a serif).
- In-page links land a chapter's first line just under the header band, never its empty
  sky; a shared link to a case-study section lands the same way. Long-form article text
  never fades in, nor does the first screen of any page (a phone would flash the name away), and
  keyboard focus shows any block that hasn't revealed yet. The header band's opaque top
  takes the clicks it covers.
- Contact carries the one primary action of the page: the address itself, as a solid
  slate a shade dimmer than the moon.
- Section spacing `clamp(140px, 22vh, 260px)`: each chapter must feel like time passing.
- Manifest rows (case studies): `index · title · meta` left, `metrics` right,
  full-row link, hairline above; hover reveals a sweep and a right arrow. On phones the arrow
  sits in the row's top-right corner, so title, summary and readouts share the full width.
- Ledger (experience): company as a serif heading, role/period in mono, bullets
  with hairline leaders, no bullet glyphs.

## 6. Motion budget

| Where | What may move | Never |
|---|---|---|
| Sky | star wheel (real rate), scintillation, Milky Way fade, moonrise, clouds, spindrift, satellite, meteor | per-frame DOM style writes, filters on layers |
| Content | one-shot reveal (opacity + 12px rise) as soon as a block is on screen, hairline sweeps on hover, numeral count-up once | anything continuous under text |

## 7. Files

```
docs/sidereal-design-system.md      this document
src/styles/sidereal/tokens.css      colour, type, spacing, rules
src/styles/sidereal/base.css        element defaults, prose, hairlines
src/styles/sidereal/pages.css       reading pages (work index, case studies, writing)
src/scripts/sky.ts                  the WebGL stage: sky, stars, moon, range, atmosphere
src/scripts/twilight.ts             solar altitude → phase (drives ink and grads, never shown)
src/layouts/Sidereal.astro          page shell: stage, header, main
src/components/sidereal/*           Stage, Header, HomeChapters, Manifest
public/sidereal/                    range.webp (RGBA), range-2k.webp, range.json (skyline), stars.bin,
                                    milkyway.webp, moon.webp, poster.webp,
                                    poster-night.webp, NOTICE.txt (star data license)
scripts/bake-sky.mjs                stars.bin, milkyway.webp from d3-celestial
scripts/publish-range.mjs           keyed range plate → range.webp, range-2k.webp, range.json, poster.webp
scripts/qa-sidereal.mjs             screenshots of every chapter, desktop and phone
tests/sidereal.test.mjs             acceptance suite (`npm test`)
```
