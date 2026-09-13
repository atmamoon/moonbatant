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
| 06 | Writing | −18° | Night | Milky Way at full strength; constellation figures as 8% hairlines | Rows, narrowed to 960px |
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
   twilight, and night airglow near the horizon.
2. **Milky Way** — a texture baked from the d3-celestial isophote contours
   (`scripts/bake-sky.mjs`), mapped on the celestial sphere, faded in below −12°.
3. **Stars** — 5,044 real stars (d3-celestial `stars.6`, Hipparcos-derived,
   mag ≤ 6) as GL points. Real RA/Dec → alt/az for the site's latitude and the
   chapter's sidereal time. Size and brightness from magnitude; colour from B−V.
   Limiting magnitude rises with darkness, so the sky fills in bright-first, the
   way it really does. Scintillation is stronger near the horizon.
4. **Moon** — photographic disc, opaque, drawn behind the range: it starts below
   the highest in-frame summit and climbs through chapter 07, so the ridge bites
   its base on the way up — the Ridgemoon mark, realised in the world. A full moon
   owns its sky: limiting magnitude drops ~2.4, the Milky Way and the figures go, a
   wide aureole lifts the sky around it. On reading pages it hangs at 13° in the right
   margin, measured from the text column's real edge, and only when that margin holds
   the whole disc clear of the text (from roughly 1440px wide); narrower reading pages
   show no moon, because it would sit behind a line of text. It drifts at the real rate.
5. **The range** — one real-looking plate of a Himalayan range at golden hour,
   sky keyed out (`public/sidereal/range.webp`, RGBA, padded to a power-of-two
   canvas so it mipmaps; `range.json` carries the sub-rect and the skyline). Relit *in the shader* by
   the same sun altitude: warm highlight lift at golden hour, rose alpenglow at
   sunset, desaturated silver-blue at night, with the shadow side always cool.
6. **Atmosphere** — two cloud strips drifting at prime periods (a strip crosses in
   about a minute), a cloud's shadow sweeping the range while there is sun to cast
   it, spindrift puffs blowing off the summits of the skyline profile, an occasional
   satellite crossing, a rare meteor after dark. Measured: 1.5–3.8% of pixels
   change over any three seconds — slow, but alive.

Performance contract: DPR ≤ 1.5, ~8 draw calls per frame (the moon is a small
quad, masks upload as LUMINANCE_ALPHA, uniform locations are cached), zero DOM
paint animation; the loop sleeps under reduced motion once the sun has settled and
never draws in a hidden tab. Motion dies under `prefers-reduced-motion` and `[data-motion=off]`
(a still night frame is drawn once). No WebGL → a static poster + CSS gradient.

## 3. Typography — wide, quiet, exact

| Role | Face | Setting |
|---|---|---|
| Wordmark / chapter cards / numerals | **Archivo** (variable, `wdth` 125) | Uppercase, weight 300–400, tracking 0.16–0.22em. The name is set as a horizon-wide inscription above the peaks. |
| Headlines, titles, prose | **Newsreader** (variable, opsz) | Weight 400 (never semibold), leading 1.02–1.1 for display, 1.6 for prose at 18–19px. Italic only for pull quotes and the dek. |
| Labels, meta, readouts | **JetBrains Mono** | 11–12px, uppercase, tracking 0.14em, muted. |
| UI copy (nav, buttons, summaries) | **Archivo** (`wdth` 100) | 14–15px, weight 400–500. |

Colour of type follows the light: `--ink` is warm snow in golden hour and cool
snow at night, switched per chapter (a discrete change, never animated
per-frame). Contrast against the darkest sky region ≥ 7:1 for body text.

## 4. Surfaces — none

- **No cards.** Content units are separated by 1px hairlines
  (`rgba(255,255,255,.16)`), by index numerals (`01`), and by whitespace.
- **No radius** on any rectangle. Buttons are text with a hairline rule, or a
  1px outlined rectangle with tracked caps (a slate label); the one primary action
  per page is a solid ink slate. Hover extends the rule / brightens it to alpenglow.
  No shadows, no blur.
- **No pills.** Skills are set as film credits: group name right-aligned in mono
  caps, items in a running line separated by thin middots.
- **Metrics** are Archivo-expanded numerals with mono captions in one shared
  two-column grid — instrument readouts, not badges. Only values that are numbers
  get the numeral; phrases ("Minutes") stay at text size.
- **Legibility without boxes** comes from placement (text lives in the dark
  upper sky; the range lives low), from three cinematographer's grads on the stage
  (a lower ND grad, a left-weighted grad and a right-edge grad that appear only
  while the sky is bright), from a tight ink shadow keyed to the phase, and from an
  opaque title-safe band behind the header.

## 5. Layout

- 12-column grid, max 1280px, gutter `clamp(20px, 5vw, 48px)`.
- Text is **left-weighted** (columns 1–7). The right side is kept open — that is
  where the peaks stand and where the moon rises.
- Reading measure 34em (≈ 72 characters of Newsreader; `ch` overstates a serif).
- Contact carries the one primary action of the page: the address itself, as an outlined slate.
- Section spacing `clamp(140px, 22vh, 260px)`: each chapter must feel like time passing.
- Manifest rows (case studies): `index · title · meta` left, `metrics` right,
  full-row link, hairline above; hover reveals a sweep and a right arrow.
- Ledger (experience): company as a serif heading, role/period in mono, bullets
  with hairline leaders, no bullet glyphs.

## 6. Motion budget

| Where | What may move | Never |
|---|---|---|
| Sky | star wheel (real rate), scintillation, Milky Way fade, moonrise, clouds, spindrift, satellite, meteor | per-frame DOM style writes, filters on layers |
| Content | one-shot reveal (opacity + 12px rise), hairline sweeps on hover, numeral count-up once | anything continuous under text |

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
                                    constellations.bin, milkyway.webp, moon.webp, poster.webp,
                                    poster-night.webp, NOTICE.txt (star data license)
scripts/bake-sky.mjs                stars.bin, constellations.bin, milkyway.webp from d3-celestial
scripts/publish-range.mjs           keyed range plate → range.webp, range-2k.webp, range.json, poster.webp
scripts/qa-sidereal.mjs             screenshots of every chapter, desktop and phone
tests/sidereal.test.mjs             acceptance suite (`npm test`)
```
