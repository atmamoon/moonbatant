// terrain.ts — the Range Flythrough. Real SRTM elevation of the Nepal Himalaya
// (Annapurna → Everest → Kangchenjunga) displaced in a vertex shader, draped
// with real Sentinel-2 imagery, lit by a section-keyed sun. Scroll flies the
// camera along an authored spline; by night the satellite realism cross-
// dissolves into rim-lit contour cartography — the mountain becomes the map.
// Perf contract: 2 draw calls, render-on-demand (GPU ~0% while reading),
// DPR capped, hard fallback to the photo experience when WebGL2 is absent.
import * as THREE from 'three';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

// ── geography ──
const LON_W = 749 / 1024 * 360 - 180;          // west edge of tile x749
const LON_E = 765 / 1024 * 360 - 180;          // east edge of tile x764
const lat = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 1024))) * 180) / Math.PI;
const LAT_N = lat(425), LAT_S = lat(432);
const KM_X = 553, KM_Z = 242;                   // plane size in km (real extent)
const EXAG = 1.5;                               // must match bake-terrain.mjs

const toXZ = (lon: number, la: number): [number, number] => [
  ((lon - LON_W) / (LON_E - LON_W) - 0.5) * KM_X,
  ((LAT_N - la) / (LAT_N - LAT_S) - 0.5) * KM_Z,
];

const PEAKS = [
  { name: 'ANNAPURNA I', el: 8091, lon: 83.8203, lat: 28.5961 },
  { name: 'MACHAPUCHARE', el: 6993, lon: 83.949, lat: 28.4958 },
  { name: 'MANASLU', el: 8163, lon: 84.5597, lat: 28.5497 },
  { name: 'CHO OYU', el: 8188, lon: 86.6608, lat: 28.0942 },
  { name: 'EVEREST', el: 8849, lon: 86.925, lat: 27.9881 },
  { name: 'MAKALU', el: 8485, lon: 87.0885, lat: 27.8897 },
  { name: 'KANGCHENJUNGA', el: 8586, lon: 88.1475, lat: 27.7025 },
];

// camera keyframes. cam = [lon, lat, altitude km REAL]; look = [lon, lat, gaze
// height km REAL]. Staging: low camera near the massifs, summits cresting the
// frame — expedition cinematography, not satellite view.
const KEYS = [
  { t: 0.0, cam: [83.52, 28.94, 7.2], look: [83.84, 28.57, 7.6], sun: [0.5, 0.16, 0.6], fog: [0.6, 0.43, 0.4], den: 0.024, star: 0.0 },
  { t: 0.24, cam: [84.28, 28.97, 7.6], look: [84.57, 28.53, 7.4], sun: [0.35, 0.13, 0.75], fog: [0.6, 0.43, 0.44], den: 0.03, star: 0.05 },
  { t: 0.44, cam: [85.85, 28.62, 8.0], look: [86.68, 28.08, 7.2], sun: [-0.2, 0.1, 0.9], fog: [0.44, 0.38, 0.5], den: 0.034, star: 0.18 },
  { t: 0.62, cam: [86.68, 27.6, 7.4], look: [86.94, 28.0, 7.8], sun: [-0.6, 0.07, 0.55], fog: [0.3, 0.26, 0.42], den: 0.028, star: 0.5 },
  { t: 1.0, cam: [87.72, 27.28, 9.2], look: [88.16, 27.72, 7.6], sun: [-0.7, 0.04, 0.35], fog: [0.09, 0.11, 0.22], den: 0.02, star: 1.0 },
];

function keyAt(t: number) {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].t < t) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const u = smooth(clamp((t - a.t) / (b.t - a.t), 0, 1));
  const mix = (p: number[], q: number[]) => p.map((v, k) => lerp(v, q[k], u));
  return {
    cam: mix(a.cam, b.cam), look: mix(a.look, b.look), sun: mix(a.sun, b.sun),
    fog: mix(a.fog, b.fog), den: lerp(a.den, b.den, u), star: lerp(a.star, b.star, u),
  };
}

const DITHER = `
  float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;

const TERRAIN_VERT = `
  uniform sampler2D uHeight;
  uniform float uHMin, uHMax;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec3 rg = texture(uHeight, uv).rgb;
    float h = (rg.r * 255.0 * 256.0 + rg.g * 255.0) / 65535.0 * (uHMax - uHMin) + uHMin;
    float hKm = h / 1000.0 * ${EXAG.toFixed(2)};
    // perimeter skirt: pull border ring down so the plane edge hides in fog
    float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    if (edge < 0.002) hKm -= 3.0;
    vec3 p = vec3(position.x, hKm, position.y);
    vWorld = p;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const TERRAIN_FRAG = `
  precision highp float;
  uniform sampler2D uHeight, uNormal, uAlbedo;
  uniform float uHMin, uHMax, uDen, uCarto, uTime;
  uniform vec3 uSun, uFogC, uCam;
  varying vec2 vUv;
  varying vec3 vWorld;
  ${DITHER}
  void main() {
    vec3 n = normalize(texture(uNormal, vUv).rgb * 2.0 - 1.0);
    n = vec3(n.x, n.y, n.z); // baked: x east, y up, z south — matches world
    vec3 rg = texture(uHeight, vUv).rgb;
    float elev = (rg.r * 255.0 * 256.0 + rg.g * 255.0) / 65535.0 * (uHMax - uHMin) + uHMin;

    // ── realism pass: graded satellite + snowline + sun ──
    vec3 alb = texture(uAlbedo, vUv).rgb;
    // lowlands recede into shadowed valley tones; the high range carries the light
    alb *= mix(0.42, 1.0, smoothstep(800.0, 4200.0, elev));
    float snowNoise = ign(vUv * 1400.0) * 250.0;
    float snow = smoothstep(4900.0 + snowNoise, 5600.0 + snowNoise, elev) * smoothstep(0.4, 0.68, n.y);
    alb = mix(alb, vec3(0.87, 0.9, 0.97), snow * 0.9);
    vec3 sun = normalize(uSun);
    float dif = max(dot(n, sun), 0.0);
    float amb = 0.32 + 0.18 * n.y;
    vec3 warm = vec3(1.0, 0.74, 0.55);
    vec3 real = alb * (amb * vec3(0.42, 0.47, 0.64) + dif * warm * (0.55 + snow * 0.6));

    // ── cartography pass: slate relief + contour ink + gold rim ──
    float band = fract(elev / 250.0);
    float w = fwidth(elev / 250.0) * 1.6;
    float line = 1.0 - smoothstep(0.0, w * 2.5, min(band, 1.0 - band));
    float major = step(0.5, fract(elev / 1000.0 + 0.5));
    vec3 slate = mix(vec3(0.055, 0.075, 0.13), vec3(0.16, 0.2, 0.3), smoothstep(0.0, 8800.0, elev));
    slate += snow * 0.06;
    vec3 view = normalize(uCam - vWorld);
    float rim = pow(1.0 - max(dot(n, view), 0.0), 3.0);
    vec3 carto = slate
      + line * (0.10 + major * 0.10) * vec3(0.96, 0.78, 0.52)
      + rim * vec3(0.9, 0.66, 0.38) * 0.22
      + dif * 0.05;

    vec3 col = mix(real, carto, uCarto);

    // ── analytic fog: extinction + sun-tinted inscatter + valley haze ──
    float dist = length(uCam - vWorld);
    float hFog = exp(-max(vWorld.y - 1.5, 0.0) * 0.35);
    float f = 1.0 - exp(-dist * uDen * (0.5 + hFog * 1.4));
    float sunAmt = pow(max(dot(-view, sun), 0.0), 8.0);
    vec3 fogC = mix(uFogC, vec3(1.0, 0.66, 0.44), sunAmt * (1.0 - uCarto) * 0.35);
    // far terrain melts fully into atmosphere — no horizon seam, no z-speckle
    float farFade = smoothstep(150.0, 290.0, dist) * 0.92;
    col = mix(col, fogC, clamp(max(f, farFade), 0.0, 0.97));
    // valley veil: low ground sits under a permanent haze deck, so smooth
    // near-camera foothills read as mist instead of bare low-res mesh.
    // Broken up with drifting noise so it reads as cloud, not paint.
    float veil = smoothstep(4.6, 1.6, vWorld.y);
    float vNoise = 0.82 + 0.18 * ign(vUv * 900.0 + uTime * 0.005);
    col = mix(col, uFogC * 0.9, clamp(veil * 0.66 * vNoise, 0.0, 0.8));

    col += (ign(gl_FragCoord.xy) - 0.5) / 255.0 * 3.0;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const SKY_VERT = `
  varying vec2 vP;
  void main() { vP = position.xy; gl_Position = vec4(position.xy, 0.9999, 1.0); }
`;

const SKY_FRAG = `
  precision highp float;
  uniform vec3 uFogC;
  uniform float uStar, uCarto, uTime;
  varying vec2 vP;
  ${DITHER}
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    float y = vP.y * 0.5 + 0.5;
    vec3 zen = mix(vec3(0.075, 0.06, 0.17), vec3(0.012, 0.02, 0.05), uStar);
    vec3 hor = mix(uFogC, uFogC * 0.55, uStar * 0.6);
    vec3 col = mix(hor, zen, smoothstep(0.0, 0.75, y));
    // hash starfield, brighter with night; subtle twinkle
    vec2 cell = floor(vP * vec2(280.0, 160.0));
    float h = hash(cell);
    if (h > 0.9965) {
      float tw = 0.75 + 0.25 * sin(uTime * (1.5 + hash(cell + 7.0) * 2.5) + hash(cell + 3.0) * 6.28);
      float mag = (h - 0.9965) / 0.0035;
      col += vec3(0.9, 0.94, 1.0) * mag * tw * uStar * smoothstep(0.12, 0.55, y);
    }
    col += (ign(gl_FragCoord.xy) - 0.5) / 255.0 * 3.0;
    gl_FragColor = vec4(col, 1.0);
  }
`;

let started = false;

export async function initTerrain() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const holder = document.getElementById('terrain-stage');
  if (!holder) return;

  const fallback = () => document.body.classList.add('no-terrain');

  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2')) { fallback(); return; }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { /* static frame is fine */ }

  const manifest = await fetch('/terrain/manifest.json').then((r) => r.json()).catch(() => null);
  if (!manifest) { fallback(); return; }

  const canvas = document.createElement('canvas');
  canvas.className = 'terrain-canvas';
  holder.appendChild(canvas);

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch { fallback(); return; }
  const DPR = clamp(window.devicePixelRatio || 1, 1, innerWidth < 1000 ? 1.5 : 2);
  renderer.setPixelRatio(DPR);
  // updateStyle=false: CSS keeps the canvas glued to the viewport (100%/100%),
  // so even a momentarily stale backing store stretches instead of exposing
  // the poster beneath as a hard-edged band (seen after banner/window resizes).
  renderer.setSize(innerWidth, innerHeight, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 900);

  const loader = new THREE.TextureLoader();
  const tex = (u: string, srgb = false) => new Promise<THREE.Texture>((res, rej) => {
    loader.load(u, (t) => {
      t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      // image row 0 = NORTH; plane uv v=0 = north edge (world -z). flipY would
      // mirror the range and put Everest in the wrong hemisphere of the map.
      t.flipY = false;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      res(t);
    }, undefined, rej);
  });

  let hTex: THREE.Texture, nTex: THREE.Texture, aTex: THREE.Texture;
  try {
    [hTex, nTex, aTex] = await Promise.all([
      tex('/terrain/height-rg.webp'), tex('/terrain/normal.webp'), tex('/terrain/albedo.webp', true),
    ]);
  } catch { fallback(); return; }

  const lowPower = (navigator as any).deviceMemory !== undefined && (navigator as any).deviceMemory < 8;
  const SEG_X = lowPower ? 512 : 1024, SEG_Z = lowPower ? 224 : 448;
  const geo = new THREE.PlaneGeometry(KM_X, KM_Z, SEG_X, SEG_Z);

  const uniforms = {
    uHeight: { value: hTex }, uNormal: { value: nTex }, uAlbedo: { value: aTex },
    uHMin: { value: manifest.hMin }, uHMax: { value: manifest.hMax },
    uSun: { value: new THREE.Vector3(0.5, 0.2, 0.6) },
    uFogC: { value: new THREE.Color(0.8, 0.5, 0.4) },
    uDen: { value: 0.05 }, uCarto: { value: 0 }, uTime: { value: 0 },
    uCam: { value: new THREE.Vector3() },
  };
  const terrainMat = new THREE.ShaderMaterial({ uniforms, vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG });
  const terrain = new THREE.Mesh(geo, terrainMat);
  scene.add(terrain);

  const skyUniforms = {
    uFogC: uniforms.uFogC, uStar: { value: 0 }, uCarto: uniforms.uCarto, uTime: uniforms.uTime,
  };
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ uniforms: skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, depthWrite: false, depthTest: false })
  );
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);

  // ── peak labels (DOM, projected) ──
  const labelWrap = document.getElementById('peak-labels');
  const labels = labelWrap
    ? PEAKS.map((p) => {
        const el = document.createElement('span');
        el.className = 'peak-label';
        el.textContent = `${p.name} · ${p.el.toLocaleString('en-US')} M`;
        labelWrap.appendChild(el);
        const [x, z] = toXZ(p.lon, p.lat);
        return { el, pos: new THREE.Vector3(x, (p.el / 1000) * EXAG, z) };
      })
    : [];

  // ── scroll → flight ──
  let t = 0, tSmooth = 0, entranceUntil = performance.now() + 900;
  const target = () => {
    const max = document.body.scrollHeight - innerHeight;
    return max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
  };
  const v3 = new THREE.Vector3();
  function pose(now: number) {
    const k = keyAt(tSmooth);
    const [cx, cz] = toXZ(k.cam[0], k.cam[1]);
    camera.position.set(cx, k.cam[2] * EXAG, cz);
    const [lx, lz] = toXZ(k.look[0], k.look[1]);
    camera.lookAt(v3.set(lx, k.look[2] * EXAG, lz));
    uniforms.uSun.value.set(k.sun[0], k.sun[1], k.sun[2]).normalize();
    uniforms.uFogC.value.setRGB(k.fog[0], k.fog[1], k.fog[2]);
    uniforms.uDen.value = k.den;
    uniforms.uCarto.value = smooth(clamp((tSmooth - 0.62) / 0.33, 0, 1));
    skyUniforms.uStar.value = k.star;
    uniforms.uTime.value = now / 1000;
    uniforms.uCam.value.copy(camera.position);

    // labels: cull beyond 220km, fade with distance, and never overprint
    const placed: [number, number][] = [];
    labels.forEach(({ el, pos }) => {
      const dist = camera.position.distanceTo(pos);
      v3.copy(pos).project(camera);
      const sx = ((v3.x + 1) / 2) * innerWidth;
      const sy = (1 - (v3.y + 1) / 2) * innerHeight;
      const crowded = placed.some(([px, py]) => Math.abs(px - sx) < 150 && Math.abs(py - sy) < 26);
      // never overprint the reading column (left text block on wide screens)
      const overText = sx < 0.5 * innerWidth && sy > 0.45 * innerHeight && sy < 0.82 * innerHeight;
      const offEdge = sx > innerWidth - 180 || sx < 20; // don't clip at viewport edges
      const vis = v3.z < 1 && Math.abs(v3.x) < 0.97 && Math.abs(v3.y) < 0.9 && dist < 260 && !crowded && !overText && !offEdge;
      el.style.opacity = vis ? Math.max(0.35, 0.8 * (1 - dist / 300)).toFixed(2) : '0';
      if (vis) {
        placed.push([sx, sy]);
        el.style.transform = `translate(${sx.toFixed(0)}px, ${sy.toFixed(0)}px)`;
      }
    });
  }

  let lastRenderedT = -1;
  function frame(now: number) {
    t = target();
    tSmooth += (t - tSmooth) * 0.06;
    const active = Math.abs(t - tSmooth) > 5e-4 || now < entranceUntil || skyUniforms.uStar.value > 0.4;
    // render-on-demand: stars twinkle at night (cheap), otherwise only on move
    if (active || Math.abs(tSmooth - lastRenderedT) > 1e-5) {
      lastRenderedT = tSmooth;
      pose(now);
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);
  }
  let raf = requestAnimationFrame(frame);

  // heartbeat for rAF-suspended contexts: keep flying on a coarse timer
  let lastPolled = -1;
  setInterval(() => {
    const nt = target();
    if (Math.abs(nt - lastPolled) > 1e-4) {
      lastPolled = nt;
      tSmooth = nt;
      pose(performance.now());
      renderer.render(scene, camera);
    }
  }, 300);

  // entrance: canvas fades in over the poster once the first frame exists
  requestAnimationFrame(() => canvas.classList.add('is-live'));
  setTimeout(() => canvas.classList.add('is-live'), 400);

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    lastRenderedT = -1;
  };
  window.addEventListener('resize', onResize);
  // catches viewport changes that don't fire window resize (extension banners,
  // browser chrome collapsing)
  new ResizeObserver(onResize).observe(holder);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else raf = requestAnimationFrame(frame);
  });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fallback(); });
}
