// journey.ts — the Living Expedition engine.
// ONE scroll scalar drives everything: sky ramp, plate crossfades, parallax,
// fog densification at seams, the rope/altimeter HUD, and a single shared FX
// canvas (spindrift, shooting stars, chough flocks, prayer flags) breathing on
// a single shared wind scalar (seeded by Everest's live weather).
// Iron rules honored here: we READ scroll, never write it; parallax < 30% of
// scroll rate; all motion dies under prefers-reduced-motion / data-motion=off.

type Camp = { el: HTMLElement; label: string; elev: number; top: number; height: number; center: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (t: number) => t * t * (3 - 2 * t);

let started = false;

export function initJourney() {
  if (started || typeof window === 'undefined') return;
  started = true;
  // stage is optional: /flight runs this engine for the HUD/weather/anchor
  // scrolling while a WebGL terrain provides the world instead of plates.
  const stage = document.getElementById('stage');

  const root = document.documentElement;
  const plates = stage ? Array.from(stage.querySelectorAll<HTMLElement>('.stage__plate')) : [];
  const fxCanvas = document.getElementById('stage-fx') as HTMLCanvasElement | null;

  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const stored = localStorage.getItem('mb-motion');
  // both states are attribute-addressable from CSS from the very first paint
  root.dataset.motion = stored === 'off' ? 'off' : 'on';
  const motionOff = () => mqReduce.matches || root.dataset.motion === 'off';

  const saveData = (navigator as any).connection?.saveData === true;
  const lowMem = (navigator as any).deviceMemory !== undefined && (navigator as any).deviceMemory < 4;
  const videosAllowed = () => !motionOff() && !saveData && !lowMem;

  // ── metrics ──
  let camps: Camp[] = [];
  let docH = 1, vh = window.innerHeight;
  function measure() {
    vh = window.innerHeight;
    docH = Math.max(1, document.body.scrollHeight - vh);
    camps = Array.from(document.querySelectorAll<HTMLElement>('[data-journey-section]')).map((el) => {
      const r = el.getBoundingClientRect();
      const top = r.top + window.scrollY;
      return {
        el, top, height: r.height, center: top + r.height / 2,
        label: el.dataset.camp || '', elev: Number(el.dataset.elevation || 0),
      };
    });
    layoutKnots();
  }

  // ── rope HUD ──
  const knotsWrap = document.getElementById('rope-knots');
  const ropeProgress = document.getElementById('rope-progress');
  const altValue = document.getElementById('alt-value');
  const altCamp = document.getElementById('alt-camp');
  function layoutKnots() {
    if (!knotsWrap) return;
    knotsWrap.innerHTML = '';
    camps.forEach((c) => {
      const a = document.createElement('a');
      a.className = 'rope__knot';
      a.href = `#${c.el.id}`;
      // knots answer "what's there"; the altimeter below owns the altitude story
      a.dataset.label = c.label;
      a.setAttribute('aria-label', `${c.label} — ${c.elev.toLocaleString('en-US')} m`);
      a.style.top = `${(clamp(c.center - vh / 2, 0, docH) / docH) * 100}%`;
      knotsWrap.appendChild(a);
    });
  }

  // ── weather (live Everest conditions seed the wind scalar) ──
  let wind = 0.35; // 0..1
  async function weather() {
    try {
      const cached = JSON.parse(localStorage.getItem('mb-wx') || 'null');
      let d = cached && Date.now() - cached.ts < 30 * 60e3 ? cached.d : null;
      if (!d) {
        const r = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=27.9881&longitude=86.925&elevation=8849&current=temperature_2m,wind_speed_10m,weather_code'
        );
        if (!r.ok) throw 0;
        d = (await r.json()).current;
        localStorage.setItem('mb-wx', JSON.stringify({ ts: Date.now(), d }));
      }
      const el = document.getElementById('hero-weather');
      if (el && d) {
        const t = Math.round(d.temperature_2m);
        const w = Math.round(d.wind_speed_10m);
        const code = d.weather_code ?? 0;
        const sky = code === 0 ? 'CLEAR' : code < 4 ? 'PARTLY CLEAR' : code < 50 ? 'CLOUD' : code < 80 ? 'SNOW' : 'STORM';
        el.textContent = `EVEREST, NOW · ${t < 0 ? '−' : ''}${Math.abs(t)}°C · WIND ${w} KM/H · ${sky}`;
        el.classList.add('is-live');
        wind = clamp(w / 90, 0.15, 1);
        root.style.setProperty('--wind', wind.toFixed(2));
      }
    } catch {
      /* silent — the preset caption stays */
    }
  }

  // ── video plates (max 2 mounted; AV1 first, H264 fallback) ──
  const probe = document.createElement('video');
  const av1OK = probe.canPlayType('video/mp4; codecs="av01.0.12M.10"') !== '';
  const mounted = new Set<HTMLElement>();
  function ensureVideo(plate: HTMLElement, on: boolean) {
    const has = plate.querySelector('video') as HTMLVideoElement | null;
    if (on && !has && videosAllowed() && mounted.size < 2) {
      const av1 = plate.dataset.videoAv1, h264 = plate.dataset.videoH264;
      if (!av1 && !h264) return;
      if (plate.dataset.vblocked) return;
      const v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      // dreamy, cinemagraph-paced motion: some plates play slowed down.
      // defaultPlaybackRate too — the load algorithm resets playbackRate to it
      // when src is assigned, silently undoing a bare playbackRate.
      const rate = Number(plate.dataset.videoRate) || 1;
      v.defaultPlaybackRate = rate;
      v.playbackRate = rate;
      v.style.opacity = '0';
      v.style.transition = 'opacity 1.4s ease';
      // The seamless-loop encode blends tail→head across the first 2s of the
      // file. Mid-loop that blend IS the invisible seam — but STARTING inside
      // it shows a ghosted double-exposure. A media fragment starts playback
      // past it (race-proof, unlike seeking in loadedmetadata); posters are
      // cut from the same clean frame so the handoff matches.
      v.src = ((av1OK && av1 ? av1 : h264 || av1) as string) + '#t=2.6';
      // reveal only from a clean frame: if the fragment start lost the race
      // with play(), silently seek past the blend while still transparent
      v.addEventListener('playing', () => {
        if (v.currentTime < 2.4) {
          const reveal = () => { v.style.opacity = '1'; };
          v.addEventListener('seeked', reveal, { once: true });
          try { v.currentTime = 2.6; } catch { reveal(); }
        } else {
          v.style.opacity = '1';
        }
      }, { once: true });
      plate.appendChild(v);
      mounted.add(plate);
      // Autoplay denied (rare with muted, but possible): keep the poster and
      // don't churn retries/network for the rest of the session.
      v.play().catch(() => { v.remove(); mounted.delete(plate); plate.dataset.vblocked = '1'; });
    } else if (has) {
      if (on && has.paused && videosAllowed()) has.play().catch(() => {});
      if (!on && !has.paused) has.pause();
    }
  }
  function unmountFarVideos(opacities: number[]) {
    plates.forEach((p, i) => {
      const v = p.querySelector('video');
      if (v && opacities[i] < 0.01 && mounted.size >= 2) { v.remove(); mounted.delete(p); }
    });
  }

  // ── main scroll → world mapping ──
  const plateOp = plates.map((_, i) => (i === 0 ? 1 : 0));
  let calmUntil = 0, reachedSummit = false;
  let lastScrollTs = performance.now();
  let scrollDirty = true;
  let settling = false;          // plate opacities still lerping toward targets
  let lastT = -1, lastFog = -1, lastElev = -1, lastCampIdx = -1;

  function world(now: number) {
    const s = window.scrollY;
    const t = clamp(s / docH, 0, 1);
    const viewCenter = s + vh * 0.5;

    // Sky + grade progression: opacity-only crossfades (compositor work, no paint)
    if (stage && Math.abs(t - lastT) > 0.006) {
      lastT = t;
      const alt = ease(t);
      const skyTw = document.getElementById('sky-twilight');
      const skyNi = document.getElementById('sky-night');
      const gradeCool = document.getElementById('grade-cool');
      const gradeWarm = stage.querySelector<HTMLElement>('.stage__grade');
      // twilight bells around mid-page; night ramps in over the last third
      if (skyTw) skyTw.style.opacity = clamp(1 - Math.abs(t - 0.5) * 3.4, 0, 1).toFixed(2);
      if (skyNi) skyNi.style.opacity = clamp((t - 0.58) / 0.34, 0, 1).toFixed(2);
      if (gradeWarm) gradeWarm.style.opacity = (0.14 * (1 - alt)).toFixed(3);
      if (gradeCool) gradeCool.style.opacity = (0.14 * alt).toFixed(3);
    }

    // plate targets: 1 inside a section band, crossfade over seams (±26% vh)
    const fadeHalf = vh * 0.26;
    let fogBoost = 0;
    const targets = plates.map(() => 0);
    if (camps.length) {
      let seg = 0;
      while (seg < camps.length - 1 && viewCenter > camps[seg + 1].top + fadeHalf * 0.2) seg++;
      targets[Math.min(seg, plates.length - 1)] = 1;
      if (seg < camps.length - 1) {
        const seam = camps[seg + 1].top + fadeHalf * 0.2;
        const d = seam - viewCenter;
        if (d < fadeHalf * 2) {
          const u = clamp(1 - d / (fadeHalf * 2), 0, 1);
          targets[Math.min(seg, plates.length - 1)] = 1 - u;
          targets[Math.min(seg + 1, plates.length - 1)] = u;
        }
      }
      // fog densification near every seam — wide enough to lead and trail the
      // plate crossfade, so transitions read as climbing through a cloud deck
      for (let i = 1; i < camps.length; i++) {
        const d = Math.abs(viewCenter - camps[i].top) / (vh * 0.62);
        fogBoost = Math.max(fogBoost, Math.exp(-d * d));
      }
    }
    if (Math.abs(fogBoost - lastFog) > 0.02) {
      lastFog = fogBoost;
      root.style.setProperty('--fog-boost', fogBoost.toFixed(3));
    }

    // the hero scrim only exists to protect hero text — dissolve it as the
    // reader climbs out, so it never floats over the next vista as a dark band
    if (camps[0]) {
      const scrim = document.querySelector<HTMLElement>('.hero__textscrim');
      if (scrim) {
        const op = (1 - clamp(s / Math.max(1, camps[0].height * 0.7), 0, 1)).toFixed(2);
        if (scrim.style.opacity !== op) scrim.style.opacity = op;
      }
    }

    const still = motionOff();
    const heartbeatMode = now - lastFrameTs > 400; // rAF asleep → converge faster
    settling = false;
    plates.forEach((p, i) => {
      const prev = plateOp[i];
      plateOp[i] = still ? targets[i] : lerp(plateOp[i], targets[i], heartbeatMode ? 0.55 : 0.16);
      if (Math.abs(plateOp[i] - targets[i]) > 0.004) settling = true;
      else plateOp[i] = targets[i];
      const o = plateOp[i] < 0.004 ? 0 : plateOp[i];
      if (Math.abs(prev - plateOp[i]) > 0.002 || o === 0 || o === 1) {
        p.style.opacity = o.toFixed(3);
        p.style.visibility = o === 0 ? 'hidden' : 'visible';
      }
      // A plate about to appear must not wait on lazy-loading heuristics
      // (some render-throttled contexts never run them once scrolled).
      if (targets[i] > 0 && !p.dataset.eager) {
        p.dataset.eager = '1';
        const img = p.querySelector('img');
        if (img) { img.loading = 'eager'; img.decode?.().catch(() => {}); }
      }
      if (!still && camps[i] && o > 0) {
        const rel = clamp((viewCenter - camps[i].center) / (camps[i].height + vh), -1, 1);
        // divergent depth drift: an incoming plate swells to full scale while
        // the outgoing one recedes — the crossfade reads volumetric, not flat
        const sc = 1.036 + 0.011 * plateOp[i];
        p.style.transform = `translate3d(0, ${(-rel * 26).toFixed(1)}px, 0) scale(${sc.toFixed(4)})`;
      }
      ensureVideo(p, o > 0.05 && targets[i] > 0.05);
    });
    unmountFarVideos(plateOp);

    // altimeter + knots (write only on change)
    if (camps.length && altValue && altCamp && ropeProgress) {
      let i = 0;
      while (i < camps.length - 1 && viewCenter > camps[i + 1].center) i++;
      const a = camps[i], b = camps[Math.min(i + 1, camps.length - 1)];
      const u = b === a ? 1 : clamp((viewCenter - a.center) / (b.center - a.center), 0, 1);
      let elev = Math.round(lerp(a.elev, b.elev, u));
      if (t > 0.985) elev = camps[camps.length - 1].elev; // the summit is the summit
      if (elev !== lastElev) {
        lastElev = elev;
        altValue.textContent = elev.toLocaleString('en-US');
        (ropeProgress as unknown as SVGLineElement).style.strokeDashoffset = String(1 - t);
      }
      const campIdx = camps.indexOf(u < 0.6 ? a : b);
      if (campIdx !== lastCampIdx) {
        lastCampIdx = campIdx;
        altCamp.textContent = camps[campIdx].label;
        knotsWrap?.querySelectorAll('a.rope__knot').forEach((k, ki) => {
          k.classList.toggle('active', ki === campIdx);
          k.classList.toggle('passed', ki < campIdx);
        });
      }
      // summit arrival: everything goes still for a beat
      if (!reachedSummit && t > 0.94) { reachedSummit = true; calmUntil = now + 2200; }
      if (t < 0.85) reachedSummit = false;
    }
  }

  // ── FX canvas: one shared system ──
  let ctx: CanvasRenderingContext2D | null = null;
  let cw = 0, ch = 0, dpr = 1;
  function sizeCanvas() {
    if (!fxCanvas) return;
    dpr = clamp(window.devicePixelRatio || 1, 1, window.innerWidth < 800 ? 1.5 : 2);
    cw = fxCanvas.clientWidth; ch = fxCanvas.clientHeight;
    fxCanvas.width = Math.round(cw * dpr); fxCanvas.height = Math.round(ch * dpr);
    ctx = fxCanvas.getContext('2d');
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  type Flake = { x: number; y: number; z: number; ph: number };
  const flakes: Flake[] = [];
  for (let i = 0; i < 52; i++) flakes.push({ x: Math.random(), y: Math.random(), z: 0.35 + Math.random() * 0.65, ph: Math.random() * 7 });
  let gustEnv = 0, nextGust = 8e3;

  let nextStar = 3e4; let star: { x: number; y: number; t0: number } | null = null;
  let nextFlock = 7e4; let flock: { dir: number; y: number; t0: number; n: number; off: number[][] } | null = null;

  // prayer-flag verlet chain
  const FP = 22;
  const chain = Array.from({ length: FP }, (_, i) => ({ x: 0, y: 0, px: 0, py: 0, init: false, i }));
  const FLAG_COLORS = ['#3d6fb8', '#e8e4da', '#c04b3a', '#3f8f5f', '#d9b23a'];

  function fx(now: number, dt: number) {
    if (!ctx || motionOff()) return;
    ctx.clearRect(0, 0, cw, ch);
    const t = clamp(window.scrollY / docH, 0, 1);
    const calm = now < calmUntil ? 1 - (calmUntil - now) / 2200 : 1;
    const heroBand = plateOp[0] ?? 0;
    const expBand = plateOp[3] ?? 0;
    const nightBand = plateOp[plateOp.length - 1] ?? 0;
    const idle = now - lastScrollTs > 3000;

    // gust scheduler (shared weather event)
    nextGust -= dt;
    if (nextGust < 0) { nextGust = 2e4 + Math.random() * 25e3; gustEnv = 1; }
    gustEnv = Math.max(0, gustEnv - dt / 2600);
    const gust = gustEnv * gustEnv * (3 - 2 * gustEnv);
    const windNow = (wind * 0.7 + gust * 0.9) * calm;

    // ── spindrift ──
    const driftA = heroBand * 0.9 + expBand * 0.45;
    if (driftA > 0.04) {
      const n = Math.round(flakes.length * (heroBand > expBand ? 1 : 0.4));
      for (let i = 0; i < n; i++) {
        const f = flakes[i];
        f.x += (0.00012 + windNow * 0.00075) * f.z * dt;
        f.y += (0.00002 * dt + Math.sin(now * 0.001 + f.ph) * 0.00006 * dt) * f.z;
        if (f.x > 1.05) { f.x = -0.05; f.y = Math.random() * 0.7; }
        if (f.y > 1.02) f.y = -0.02;
        const px = f.x * cw, py = f.y * ch * 0.72;
        ctx.globalAlpha = (0.08 + f.z * 0.3) * driftA * calm;
        ctx.fillStyle = '#eef3ff';
        ctx.beginPath();
        ctx.arc(px, py, 0.7 + f.z * 1.5, 0, 6.283);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ── shooting star (footer only, rationed) ──
    if (nightBand > 0.5) {
      nextStar -= dt;
      if (nextStar < 0 && !star) { nextStar = 25e3 + Math.random() * 65e3; star = { x: 0.15 + Math.random() * 0.6, y: 0.06 + Math.random() * 0.2, t0: now }; }
      if (star) {
        const life = (now - star.t0) / 850;
        if (life > 1) star = null;
        else {
          const len = 150, prog = life * 1.4;
          const x0 = star.x * cw + prog * 260, y0 = star.y * ch + prog * 130;
          const g = ctx.createLinearGradient(x0, y0, x0 - len, y0 - len * 0.5);
          g.addColorStop(0, `rgba(240,246,255,${0.85 * (1 - life) * nightBand})`);
          g.addColorStop(1, 'rgba(240,246,255,0)');
          ctx.strokeStyle = g; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 - len, y0 - len * 0.5); ctx.stroke();
        }
      }
    }

    // ── chough flock (rare event, only while idle at hero/footer) ──
    if ((heroBand > 0.6 || nightBand > 0.6) && idle) {
      nextFlock -= dt;
      if (nextFlock < 0 && !flock) {
        nextFlock = 6e4 + Math.random() * 12e4;
        const n = 5 + Math.floor(Math.random() * 5);
        flock = { dir: Math.random() > 0.5 ? 1 : -1, y: 0.12 + Math.random() * 0.22, t0: now, n, off: Array.from({ length: n }, () => [Math.random() * 90, (Math.random() - 0.5) * 60, Math.random() * 7]) };
      }
    }
    if (flock) {
      const life = (now - flock.t0) / 17e3;
      if (life > 1) flock = null;
      else {
        const bx = flock.dir > 0 ? life * (cw + 200) - 100 : cw + 100 - life * (cw + 200);
        const by = flock.y * ch + Math.sin(life * 6) * 18;
        ctx.strokeStyle = `rgba(8,10,18,${0.75 * Math.max(heroBand, nightBand)})`;
        ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        for (let i = 0; i < flock.n; i++) {
          const [ox, oy, ph] = flock.off[i];
          const x = bx - ox * flock.dir, y = by + oy;
          const flap = Math.sin(now * 0.012 + ph) * 3.4;
          const s = 4.6;
          ctx.beginPath();
          ctx.moveTo(x - s, y - flap * 0.6);
          ctx.quadraticCurveTo(x - s * 0.4, y + flap * 0.35, x, y);
          ctx.quadraticCurveTo(x + s * 0.4, y + flap * 0.35, x + s, y - flap * 0.6);
          ctx.stroke();
        }
      }
    }

    // ── prayer flags (footer corner, verlet cloth on the shared wind) ──
    if (nightBand > 0.35) {
      const x0 = cw - 20, y0 = 64, x1 = cw - 20 - 300, y1 = 118;
      for (let i = 0; i < FP; i++) {
        const p = chain[i];
        if (!p.init) { p.x = lerp(x0, x1, i / (FP - 1)); p.y = lerp(y0, y1, i / (FP - 1)) + Math.sin(i) * 4; p.px = p.x; p.py = p.y; p.init = true; }
      }
      const sub = Math.min(dt, 34);
      for (let i = 1; i < FP - 1; i++) {
        const p = chain[i];
        const vx = (p.x - p.px) * 0.985, vy = (p.y - p.py) * 0.985;
        p.px = p.x; p.py = p.y;
        const turb = Math.sin(now * 0.0021 + i * 0.9) * 0.5 + Math.sin(now * 0.0037 + i * 1.7) * 0.5;
        p.x += vx + (windNow * 0.055 + turb * windNow * 0.05) * sub;
        p.y += vy + 0.0022 * sub + turb * windNow * 0.03 * sub;
      }
      chain[0].x = x0; chain[0].y = y0; chain[FP - 1].x = x1; chain[FP - 1].y = y1;
      const seg = Math.hypot(x1 - x0, y1 - y0) / (FP - 1) * 1.06;
      for (let k = 0; k < 3; k++) for (let i = 0; i < FP - 1; i++) {
        const a = chain[i], b = chain[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const diff = ((d - seg) / d) * 0.5;
        const mx = dx * diff, my = dy * diff;
        if (i > 0) { a.x += mx; a.y += my; }
        if (i < FP - 2) { b.x -= mx; b.y -= my; }
      }
      ctx.globalAlpha = 0.8 * nightBand;
      ctx.strokeStyle = 'rgba(220,226,240,0.5)';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(chain[0].x, chain[0].y);
      for (let i = 1; i < FP; i++) ctx.lineTo(chain[i].x, chain[i].y);
      ctx.stroke();
      for (let f = 0; f < 5; f++) {
        const i = 2 + f * 4;
        if (i + 1 >= FP) break;
        const a = chain[i], b = chain[i + 1];
        const nx = (b.y - a.y), ny = -(b.x - a.x);
        const nl = Math.hypot(nx, ny) || 1;
        const fl = 16 + Math.sin(now * 0.003 + f * 2) * windNow * 5;
        ctx.fillStyle = FLAG_COLORS[f];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.lineTo(b.x + (nx / nl) * fl, b.y + (ny / nl) * fl + windNow * 6);
        ctx.lineTo(a.x + (nx / nl) * fl, a.y + (ny / nl) * fl + windNow * 6);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ── frame loop: world() only when scroll moved or plates are settling;
  //    fx() every frame (cheap canvas), skipped entirely when motion is off ──
  let rafId = 0, lastNow = performance.now(), lastFrameTs = 0;
  function frame(now: number) {
    lastFrameTs = now;
    const dt = Math.min(50, now - lastNow);
    lastNow = now;
    if (scrollDirty || settling) { world(now); scrollDirty = false; }
    if (!motionOff()) fx(now, dt);
    rafId = requestAnimationFrame(frame);
  }
  // Heartbeat: some contexts suspend rAF — and with it 'scroll' event
  // dispatch — entirely (battery savers, headless panes, occluded windows).
  // Poll scrollY on a coarse timer so crossfades and the altimeter never
  // freeze even when the render loop is asleep.
  let lastPolledY = -1;
  setInterval(() => {
    const now = performance.now();
    if (now - lastFrameTs < 400) return; // rAF is alive, it owns the world
    if (window.scrollY !== lastPolledY || settling) {
      lastPolledY = window.scrollY;
      lastScrollTs = now;
      world(now);
      scrollDirty = false;
    }
  }, 250);

  // ── wiring ──
  window.addEventListener('scroll', () => { scrollDirty = true; lastScrollTs = performance.now(); }, { passive: true });
  window.addEventListener('resize', () => { measure(); sizeCanvas(); scrollDirty = true; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(rafId);
    else { lastNow = performance.now(); rafId = requestAnimationFrame(frame); }
  });
  mqReduce.addEventListener?.('change', () => { scrollDirty = true; });


  // ── eased anchor scrolling (self-driven; immune to the Chromium smooth-
  //    scroll cancellation that per-frame DOM writes cause) ──
  let animScroll = 0;
  function scrollToY(target: number) {
    cancelAnimationFrame(animScroll);
    if (motionOff()) { window.scrollTo({ top: target, behavior: 'instant' as ScrollBehavior }); return; }
    const from = window.scrollY;
    const dist = target - from;
    const dur = clamp(Math.abs(dist) * 0.45, 350, 1100);
    const t0 = performance.now();
    let stepped = false;
    const step = (now: number) => {
      stepped = true;
      const u = clamp((now - t0) / dur, 0, 1);
      const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
      window.scrollTo(0, from + dist * e);
      if (u < 1) animScroll = requestAnimationFrame(step);
    };
    animScroll = requestAnimationFrame(step);
    // rAF-suspended context: jump instantly rather than not at all
    setTimeout(() => { if (!stepped) window.scrollTo(0, target); }, 150);
  }
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest?.('a[href^="#"]') as HTMLAnchorElement | null;
    if (!a) return;
    const id = a.getAttribute('href')!.slice(1);
    const el = id ? document.getElementById(id) : document.body;
    if (!el) return;
    e.preventDefault();
    history.pushState(null, '', `#${id}`);
    scrollToY(id === 'top' || id === '' ? 0 : el.getBoundingClientRect().top + window.scrollY - 80);
  });
  // wheel/touch input cancels an in-flight eased scroll (user wins)
  window.addEventListener('wheel', () => cancelAnimationFrame(animScroll), { passive: true });
  window.addEventListener('touchstart', () => cancelAnimationFrame(animScroll), { passive: true });

  // ── engagement pack: reveal-on-enter + metric count-ups (once, subtle) ──
  function engage() {
    if (motionOff() || !('IntersectionObserver' in window)) return;
    root.classList.add('anim-ok');
    // liveness probe: IO callbacks ride the render loop — if the environment
    // never runs one (frozen/headless panes), content must not stay hidden
    let ioAlive = false;
    new IntersectionObserver((_, obs) => { ioAlive = true; obs.disconnect(); }).observe(document.body);
    setTimeout(() => {
      if (!ioAlive) {
        root.classList.remove('anim-ok');
        document.querySelectorAll('.js-reveal').forEach((el) => el.classList.add('revealed'));
      }
    }, 1400);
    const targets = document.querySelectorAll(
      '.work__grid > *, .about__card, .exp__list > *, .edu__list > *, .writing-row'
    );
    let batch = 0, lastBatchTs = 0;
    const io = new IntersectionObserver((entries) => {
      const now = performance.now();
      if (now - lastBatchTs > 400) batch = 0;
      lastBatchTs = now;
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target as HTMLElement;
        el.style.setProperty('--rv-delay', `${Math.min(batch++ * 90, 360)}ms`);
        el.classList.add('revealed');
        io.unobserve(el);
      });
    }, { threshold: 0.18 });
    targets.forEach((el) => { el.classList.add('js-reveal'); io.observe(el); });

    // metric count-ups: numbers tick up the first time a card is read
    const mio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target as HTMLElement;
        mio.unobserve(el);
        const m = (el.textContent || '').match(/^([^0-9]*)(\d+(?:\.\d+)?)([\s\S]*)$/);
        if (!m) return;
        const [, pre, numStr, post] = m;
        const target = parseFloat(numStr);
        const dec = numStr.includes('.') ? numStr.split('.')[1].length : 0;
        const t0 = performance.now();
        const tick = (now: number) => {
          const u = clamp((now - t0) / 950, 0, 1);
          const v = target * (1 - (1 - u) ** 3);
          el.textContent = pre + v.toFixed(dec) + post;
          if (u < 1) requestAnimationFrame(tick);
          else el.textContent = pre + numStr + post;
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    document.querySelectorAll('.mb-metric__val').forEach((el) => mio.observe(el));
  }
  engage();

  measure();
  sizeCanvas();
  weather();
  // late-load nudge: fonts/images/styles settle → re-measure once. The canvas
  // MUST be re-sized post-load too: if this module runs before the stylesheet,
  // clientWidth is the 300px canvas default and everything draws squished.
  setTimeout(() => { measure(); sizeCanvas(); }, 1200);
  window.addEventListener('load', () => { measure(); sizeCanvas(); });
  rafId = requestAnimationFrame(frame);
}
