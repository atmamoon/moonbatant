# SIDEREAL — the moonbatant design system

*One evening at a high camp below a great range. The page is a clock.*

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

The home page is one evening at ~28°N (the Khumbu), late October, looking north
at the range. Each section is a chapter of twilight, pinned to a real solar
altitude and the phase name astronomers use. A fixed *time-card* (mono) reads
the clock; a vertical *solar scale* on the right edge shows the sun sinking.

| Chapter | Content | Sun altitude | Phase | What the world does |
|---|---|---|---|---|
| 01 | Hero (name, positioning) | +4° | Golden hour | Low amber light rakes the snow; gold horizon, deep-blue zenith |
| 02 | Selected work | −1° | Sunset · alpenglow | Only the summits glow rose; Venus and Jupiter appear |
| 03 | About | −5° | Civil twilight | Belt of Venus + earth shadow on the horizon; stars to mag 2 |
| 04 | Experience | −10° | Nautical twilight | Horizon fades; stars to mag 4; snow goes silver-blue |
| 05 | Education | −15° | Astronomical twilight | Milky Way emerges; stars to mag 6 |
| 06 | Writing & contact | −20° | Night | Full sky; the moon rises behind the summit (the brand mark, in-world) |

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
4. **Moon** — photographic disc, rising over the last chapter so the summit
   bites its base: the Ridgemoon mark, realised in the world.
5. **The range** — one real-looking plate of a Himalayan range at golden hour,
   sky keyed out (`public/sidereal/range.webp`, RGBA). Relit *in the shader* by
   the same sun altitude: warm highlight lift at golden hour, rose alpenglow at
   sunset, desaturated silver-blue at night, with the shadow side always cool.
6. **Atmosphere** — two cloud/fog strips drifting at prime-number periods
   (transform only), spindrift blowing off the skyline profile, an occasional
   satellite crossing, a rare meteor after dark.

Performance contract: DPR ≤ 1.5, ≤ 6 draw calls per frame, zero DOM paint
animation. Motion dies under `prefers-reduced-motion` and `[data-motion=off]`
(a still night frame is drawn once). No WebGL → a static poster + CSS gradient.

## 3. Typography — wide, quiet, exact

| Role | Face | Setting |
|---|---|---|
| Wordmark / chapter cards / numerals | **Archivo** (variable, `wdth` 125) | Uppercase, weight 300–400, tracking 0.16–0.22em. The name is set as a horizon-wide inscription above the peaks. |
| Headlines, titles, prose | **Newsreader** (variable, opsz) | Weight 400 (never semibold), leading 1.02–1.1 for display, 1.6 for prose at 18–19px. Italic only for pull quotes and the dek. |
| Labels, HUD, meta | **JetBrains Mono** | 11–12px, uppercase, tracking 0.14em, muted. |
| UI copy (nav, buttons, summaries) | **Archivo** (`wdth` 100) | 14–15px, weight 400–500. |

Colour of type follows the light: `--ink` is warm snow in golden hour and cool
snow at night, switched per chapter (a discrete change, never animated
per-frame). Contrast against the darkest sky region ≥ 7:1 for body text.

## 4. Surfaces — none

- **No cards.** Content units are separated by 1px hairlines
  (`rgba(255,255,255,.16)`), by index numerals (`01`), and by whitespace.
- **No radius** on any rectangle. Buttons are text with a hairline rule, or a
  1px outlined rectangle with tracked caps (a slate label). Hover extends the
  rule / brightens it to alpenglow. No fills, no shadows, no blur.
- **No pills.** Skills are set as film credits: group name right-aligned in mono
  caps, items in a running line separated by thin middots.
- **Metrics** are large Archivo-expanded numerals with tiny mono captions —
  instrument readouts, not badges.
- **Legibility without boxes** comes from placement (text lives in the dark
  upper sky; the range lives low), from the sky's own darkness, and from a
  1px tight text-shadow at golden hour only.

## 5. Layout

- 12-column grid, max 1280px, gutter `clamp(20px, 5vw, 48px)`.
- Text is **left-weighted** (columns 1–7). The right side is kept open — that is
  where the peaks stand and where the moon rises.
- Reading measure 66ch. Section spacing `clamp(140px, 22vh, 260px)` — each
  chapter must feel like time passing.
- Manifest rows (case studies): `index · title · meta` left, `metrics` right,
  full-row link, hairline above; hover reveals a sweep and a right arrow.
- Ledger (experience): company as a serif heading, role/period in mono, bullets
  with hairline leaders, no bullet glyphs.

## 6. Motion budget

| Where | What may move | Never |
|---|---|---|
| Sky | star wheel (real rate), scintillation, Milky Way fade, moonrise, clouds, spindrift, satellite, meteor | per-frame DOM style writes, filters on layers |
| Content | one-shot reveal (opacity + 12px rise), hairline sweeps on hover, numeral count-up once | anything continuous under text |
| HUD | time-card text (on change only), solar-scale marker (transform) | — |

## 7. Files

```
docs/sidereal-design-system.md      this document
src/styles/sidereal/tokens.css      colour, type, spacing, rules
src/styles/sidereal/base.css        element defaults, prose, hairlines
src/scripts/sky.ts                  the WebGL stage + solar clock + HUD
src/scripts/sky-data.ts             star catalogue loader
src/components/sidereal/*           Stage, Header, TimeCard, SolarScale, Manifest, Credits, Ledger, Slate
public/sidereal/                    range.webp (RGBA), stars.bin, milkyway.webp, moon.webp, poster.webp
scripts/bake-sky.mjs                builds stars.bin + milkyway.webp from d3-celestial data
```
