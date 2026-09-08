// sky.ts — the SIDEREAL stage.
// One fixed WebGL canvas renders the whole world from ONE scalar: the altitude
// of the sun. Scroll advances the evening; idle time passes at 1× (the sky
// really wheels at 15°/h). Layers, back to front: analytic twilight sky →
// Milky Way (isophote bake) → 5,044 real stars → moon → the range (relit in
// the shader) → cloud strips → spindrift, satellites, meteors.
// Iron rules: effects READ scroll, never write it; nothing per-frame touches
// DOM style except the HUD text (on change) and the scale marker (transform);
// everything dies under prefers-reduced-motion / [data-motion=off].

type Mode = 'clock' | 'night';
interface Opts { mode: Mode; }

const DEG = Math.PI / 180;
const LAT = 27.99 * DEG;           // Khumbu
const CAM_AZ = 20 * DEG;           // looking NNE: the earth-shadow side; the moon rises on the right
const CAM_PITCH = 7 * DEG;
const HFOV = 84 * DEG;
const SUN_AZ = 257 * DEG;          // late-October sunset azimuth at 28°N
const LST0 = 300 * DEG;            // sidereal time at the golden-hour frame (~18:00 NPT, 20 Oct)

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ── keyframes by sun altitude ─────────────────────────────────────────────
type V3 = [number, number, number];
interface SkyKey { alt: number; zenith: V3; mid: V3; horizon: V3; glow: V3; glowK: number; belt: V3; shadow: V3; beltK: number; airglow: V3; limMag: number; mw: number; }
const SKY: SkyKey[] = [
  { alt: 6,   zenith: [0.09, 0.21, 0.56], mid: [0.32, 0.47, 0.80], horizon: [0.84, 0.76, 0.64], glow: [1.0, 0.78, 0.45], glowK: 0.40, belt: [0.0, 0, 0], shadow: [0, 0, 0], beltK: 0,    airglow: [0, 0, 0], limMag: -9, mw: 0 },
  { alt: 2,   zenith: [0.08, 0.18, 0.50], mid: [0.29, 0.42, 0.76], horizon: [0.90, 0.74, 0.58], glow: [1.0, 0.72, 0.40], glowK: 0.50, belt: [0.9, 0.62, 0.66], shadow: [0.30, 0.34, 0.52], beltK: 0.25, airglow: [0, 0, 0], limMag: -9, mw: 0 },
  { alt: -1,  zenith: [0.06, 0.13, 0.42], mid: [0.24, 0.33, 0.68], horizon: [0.86, 0.60, 0.50], glow: [1.0, 0.58, 0.32], glowK: 0.50, belt: [0.88, 0.56, 0.62], shadow: [0.26, 0.29, 0.48], beltK: 0.7,  airglow: [0, 0, 0], limMag: -0.5, mw: 0 },
  { alt: -5,  zenith: [0.035, 0.075, 0.28], mid: [0.14, 0.20, 0.50], horizon: [0.70, 0.50, 0.52], glow: [1.0, 0.60, 0.35], glowK: 0.32, belt: [0.80, 0.50, 0.60], shadow: [0.19, 0.21, 0.40], beltK: 1.0,  airglow: [0, 0, 0], limMag: 2.2, mw: 0 },
  { alt: -10, zenith: [0.018, 0.038, 0.15], mid: [0.06, 0.10, 0.30], horizon: [0.33, 0.31, 0.50], glow: [0.9, 0.50, 0.35], glowK: 0.16, belt: [0.6, 0.42, 0.55], shadow: [0.12, 0.13, 0.27], beltK: 0.35, airglow: [0.05, 0.07, 0.05], limMag: 4.2, mw: 0.05 },
  { alt: -15, zenith: [0.013, 0.022, 0.075], mid: [0.028, 0.045, 0.14], horizon: [0.12, 0.13, 0.25], glow: [0.5, 0.35, 0.30], glowK: 0.05, belt: [0, 0, 0], shadow: [0, 0, 0], beltK: 0,    airglow: [0.10, 0.14, 0.10], limMag: 5.8, mw: 0.55 },
  { alt: -20, zenith: [0.010, 0.016, 0.050], mid: [0.020, 0.030, 0.090], horizon: [0.070, 0.085, 0.17], glow: [0, 0, 0], glowK: 0, belt: [0, 0, 0], shadow: [0, 0, 0], beltK: 0,    airglow: [0.12, 0.16, 0.12], limMag: 6.5, mw: 1 },
];
interface RangeKey { alt: number; exposure: number; sat: number; tint: V3; hiTint: V3; hiMix: number; lift: number; contrast: number; }
const RANGE: RangeKey[] = [
  { alt: 6,   exposure: 1.00, sat: 1.00, tint: [1, 1, 1],            hiTint: [1.0, 0.95, 0.85], hiMix: 0.15, lift: 0.00, contrast: 1.00 },
  { alt: 2,   exposure: 0.92, sat: 0.98, tint: [1, 0.97, 0.98],      hiTint: [1.0, 0.86, 0.74], hiMix: 0.45, lift: 0.00, contrast: 1.02 },
  { alt: -1,  exposure: 0.66, sat: 0.86, tint: [0.90, 0.86, 0.97],   hiTint: [1.0, 0.62, 0.64], hiMix: 0.82, lift: 0.00, contrast: 1.04 },
  { alt: -5,  exposure: 0.42, sat: 0.40, tint: [0.78, 0.82, 1.0],    hiTint: [1.0, 0.86, 0.92], hiMix: 0.30, lift: 0.02, contrast: 0.95 },
  { alt: -10, exposure: 0.31, sat: 0.20, tint: [0.62, 0.72, 1.0],    hiTint: [1, 1, 1],         hiMix: 0.00, lift: 0.02, contrast: 0.90 },
  { alt: -15, exposure: 0.23, sat: 0.10, tint: [0.58, 0.70, 1.0],    hiTint: [1, 1, 1],         hiMix: 0.00, lift: 0.03, contrast: 0.88 },
  { alt: -20, exposure: 0.27, sat: 0.08, tint: [0.62, 0.72, 1.0],    hiTint: [0.95, 0.98, 1.0], hiMix: 0.40, lift: 0.03, contrast: 0.90 },
];
function keyAt<T extends { alt: number }>(keys: T[], alt: number): [T, T, number] {
  if (alt >= keys[0].alt) return [keys[0], keys[0], 0];
  for (let i = 0; i < keys.length - 1; i++) {
    if (alt <= keys[i].alt && alt >= keys[i + 1].alt) {
      const t = (keys[i].alt - alt) / (keys[i].alt - keys[i + 1].alt);
      return [keys[i], keys[i + 1], t * t * (3 - 2 * t)];
    }
  }
  const l = keys[keys.length - 1]; return [l, l, 0];
}
const mix3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

import { phaseOf, clockOf, PHASE_LABEL } from './twilight';

// ── shaders ───────────────────────────────────────────────────────────────
const VS_QUAD = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;
const FS_SKY = `
precision highp float;
varying vec2 vUv;
uniform vec2 uTan; uniform mat3 uCamToHor; uniform mat3 uHorToEq;
uniform vec3 uZenith, uMid, uHorizon, uGlow, uBelt, uShadow, uAirglow;
uniform float uGlowK, uBeltK, uSunAz, uMW, uSeed;
uniform sampler2D uMWTex;
const float PI = 3.141592653589793;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec3 d = normalize(vec3((vUv.x*2.0-1.0)*uTan.x, (vUv.y*2.0-1.0)*uTan.y, 1.0));
  vec3 h = uCamToHor * d;                 // (north, east, up)
  float alt = asin(clamp(h.z,-1.0,1.0));
  float az = atan(h.y, h.x);
  float t = clamp(alt/(PI*0.5), -0.15, 1.0);
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.16, t));
  col = mix(col, uZenith, smoothstep(0.08, 0.62, t));
  // below the horizon: the ground is hidden behind the range; keep it dark
  col = mix(col, uZenith*0.6, smoothstep(0.0, -0.12, t));
  // twilight wedge toward the sun
  float dAz = cos(az - uSunAz)*0.5+0.5;
  float lobe = pow(dAz, 3.0) * exp(-max(alt,0.0)*8.0);
  col += uGlow * uGlowK * lobe;
  // earth shadow + Belt of Venus, opposite the sun, civil twilight only
  float anti = pow(cos(az - uSunAz + PI)*0.5+0.5, 2.0);
  float shadowBand = smoothstep(-0.02, 0.01, alt) * (1.0 - smoothstep(0.02, 0.13, alt));
  float beltBand = smoothstep(0.03, 0.10, alt) * (1.0 - smoothstep(0.12, 0.26, alt));
  col = mix(col, uShadow, uBeltK * anti * shadowBand * 0.5);
  col = mix(col, uBelt, uBeltK * anti * beltBand * 0.5);
  // night airglow near the horizon
  col += uAirglow * exp(-max(alt,0.0)*7.0) * 0.55;
  // Milky Way, with extinction toward the horizon
  vec3 e = uHorToEq * h;
  float ra = atan(e.y, e.x); float dec = asin(clamp(e.z,-1.0,1.0));
  vec2 muv = vec2((ra+PI)/(2.0*PI), (PI*0.5-dec)/PI);
  float mw = texture2D(uMWTex, muv).r;
  col += vec3(0.62,0.70,0.94) * mw * uMW * 1.15 * smoothstep(-0.02, 0.28, alt);
  // dither (kills banding on 8-bit displays)
  col += (hash(gl_FragCoord.xy + uSeed) - 0.5) * (1.6/255.0);
  gl_FragColor = vec4(col, 1.0);
}`;

const VS_STARS = `
attribute vec3 aDir; attribute float aMag; attribute float aBv; attribute float aSeed;
uniform mat3 uEqToHor, uHorToCam; uniform vec2 uTan; uniform float uLimMag, uTime, uDpr, uTwk;
varying float vI; varying vec3 vCol; varying float vBig;
void main(){
  vec3 h = uEqToHor * aDir; vec3 c = uHorToCam * h;
  if (c.z <= 0.02 || h.z < -0.02) { gl_Position = vec4(2.0,2.0,2.0,1.0); gl_PointSize = 0.0; vI = 0.0; vCol = vec3(0.0); vBig = 0.0; return; }
  gl_Position = vec4(c.x/c.z/uTan.x, c.y/c.z/uTan.y, 0.0, 1.0);
  float alt = asin(clamp(h.z,-1.0,1.0));
  float vis = 1.0 - smoothstep(uLimMag - 1.3, uLimMag, aMag);
  float I = pow(10.0, -0.4*(aMag - 2.3)*0.55);
  I *= mix(0.3, 1.0, smoothstep(0.0, 0.25, alt));           // extinction
  float lowAmp = 0.22 + 0.6*(1.0 - smoothstep(0.02, 0.45, alt));
  float twk = 1.0 + uTwk * lowAmp * sin(uTime*(1.7 + 4.3*fract(aSeed*7.31)) + aSeed*6.2831);
  vI = clamp(I*vis*twk, 0.0, 1.8);
  float b = clamp((3.6 - aMag)/5.2, 0.0, 1.0);
  vBig = b;
  gl_PointSize = mix(2.0, 9.0, b*b) * uDpr;
  vec3 col = aBv < 0.0 ? mix(vec3(0.62,0.76,1.0), vec3(1.0), clamp((aBv+0.45)/0.45,0.0,1.0))
       : aBv < 0.65 ? mix(vec3(1.0), vec3(1.0,0.94,0.82), aBv/0.65)
       : mix(vec3(1.0,0.94,0.82), vec3(1.0,0.66,0.40), clamp((aBv-0.65)/1.2,0.0,1.0));
  vCol = mix(vec3(dot(col, vec3(0.333))), col, 1.0 + 0.6*b); // bright stars keep their colour
}`;
const FS_STARS = `
precision mediump float;
varying float vI; varying vec3 vCol; varying float vBig;
void main(){
  vec2 p = gl_PointCoord*2.0-1.0; float d = dot(p,p);
  float core = exp(-d*5.5);
  float halo = exp(-sqrt(d)*2.6) * 0.55 * vBig * vBig;
  float a = vI * (core + halo);
  if (a < 0.003) discard;
  gl_FragColor = vec4(vCol * a, a);
}`;

const FS_RANGE = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex; uniform vec4 uMap;
uniform float uExposure, uSat, uHiMix, uLift, uContrast, uMoonLift;
uniform vec3 uTint, uHiTint;
void main(){
  vec2 uv = vUv * uMap.xy + uMap.zw;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0); return; }
  vec4 c = texture2D(uTex, vec2(uv.x, 1.0 - uv.y));
  float L = dot(c.rgb, vec3(0.299,0.587,0.114));
  vec3 g = mix(vec3(L), c.rgb, uSat);
  float hi = smoothstep(0.48, 0.95, L);
  g = mix(g, g*uHiTint, uHiMix*hi);
  g = (g - 0.5)*uContrast + 0.5 + uLift;
  g *= uTint * (uExposure + uMoonLift*hi*0.35);
  gl_FragColor = vec4(g * c.a, c.a);
}`;

const VS_SPRITE = `attribute vec2 aPos; uniform vec4 uRect; varying vec2 vUv;
void main(){ vUv = aPos; vec2 v = uRect.xy + aPos*uRect.zw; gl_Position = vec4(v*2.0-1.0, 0.0, 1.0); }`;
const FS_SPRITE = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex; uniform float uAlpha; uniform vec3 uTint; uniform float uHalo;
void main(){
  vec2 p = vUv;                              // 0..1 inside the sprite rect
  if (uHalo > 0.5) {
    vec2 q = p*2.0-1.0; float d = length(q);
    float a = exp(-d*d*3.2) * uAlpha;
    gl_FragColor = vec4(uTint*a, a);
  } else {
    vec4 c = texture2D(uTex, vec2(p.x, 1.0-p.y));
    gl_FragColor = vec4(c.rgb*uTint*c.a*uAlpha, c.a*uAlpha);
  }
}`;

const FS_FOG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex; uniform float uOffset, uAlpha, uY0, uY1, uRepeat; uniform vec3 uTint;
void main(){
  float band = smoothstep(uY0, uY0 + 0.1, vUv.y) * (1.0 - smoothstep(uY1 - 0.12, uY1, vUv.y));
  vec4 fc = texture2D(uTex, vec2(vUv.x*uRepeat + uOffset, 1.0 - (vUv.y - uY0)/(uY1-uY0)));
  float l = fc.a * max(fc.r, 0.6);   // LUMINANCE_ALPHA plate: density in alpha
  float a = clamp(l * band * uAlpha * 2.6, 0.0, 0.85);
  gl_FragColor = vec4(uTint*a, a);
}`;

const VS_LINES = `
attribute vec3 aDir;
uniform mat3 uEqToHor, uHorToCam; uniform vec2 uTan; varying float vA;
void main(){
  vec3 h = uEqToHor * aDir; vec3 c = uHorToCam * h;
  float alt = asin(clamp(h.z,-1.0,1.0));
  vA = smoothstep(0.0, 0.18, alt);
  gl_Position = vec4(c.x/uTan.x, c.y/uTan.y, 0.0, max(c.z, 0.0001));
}`;
const FS_LINES = `
precision mediump float; varying float vA; uniform float uAlpha;
void main(){ float a = uAlpha * vA; gl_FragColor = vec4(vec3(0.62,0.72,0.95)*a, a); }`;

const VS_PTS = `
attribute vec2 aPos; attribute float aSize; attribute float aAlpha;
uniform float uDpr; varying float vA;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); gl_PointSize = aSize*uDpr; vA = aAlpha; }`;
const FS_PTS = `
precision mediump float; varying float vA; uniform vec3 uCol;
void main(){ vec2 p = gl_PointCoord*2.0-1.0; float a = exp(-dot(p,p)*3.0)*vA; if (a < 0.004) discard; gl_FragColor = vec4(uCol*a, a); }`;

// ── gl helpers ────────────────────────────────────────────────────────────
function compile(gl: WebGLRenderingContext, vs: string, fs: string) {
  const mk = (t: number, s: string) => { const sh = gl.createShader(t)!; gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader'); return sh; };
  const p = gl.createProgram()!;
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
  return p;
}
function loadTex(gl: WebGLRenderingContext, url: string, opts: { repeat?: boolean; alpha?: boolean; mip?: boolean; lum?: boolean } = {}): Promise<WebGLTexture> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = async () => {
      try { await img.decode?.(); } catch { /* upload anyway */ }
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
      const fmt = opts.lum ? gl.LUMINANCE_ALPHA : gl.RGBA;     // masks: 2 channels instead of 4
      gl.texImage2D(gl.TEXTURE_2D, 0, fmt, fmt, gl.UNSIGNED_BYTE, img);
      const wrap = opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const pot = (img.width & (img.width - 1)) === 0 && (img.height & (img.height - 1)) === 0;
      if (opts.mip !== false && pot) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
      else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      res(t);
    };
    img.onerror = () => rej(new Error('tex ' + url));
    img.src = url;
  });
}
// rotation matrices (column-major for GL)
function mat3Mul(a: number[], b: number[]) { const o = new Array(9).fill(0); for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2]; return o; }
function transpose(a: number[]) { return [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]]; }

let started = false;
export function initSidereal(opts: Opts) {
  if (started || typeof window === 'undefined') return;
  started = true;
  const root = document.documentElement;
  const canvas = document.getElementById('sky') as HTMLCanvasElement | null;
  if (!canvas) return;
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const stored = localStorage.getItem('mb-motion');
  root.dataset.motion = stored === 'off' ? 'off' : 'on';
  const motionOff = () => mqReduce.matches || root.dataset.motion === 'off';

  const gl = (canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }) ||
    canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
  if (!gl) { root.classList.add('no-webgl'); return; }
  root.classList.add('webgl');

  // programs
  const pSky = compile(gl, VS_QUAD, FS_SKY);
  const pStars = compile(gl, VS_STARS, FS_STARS);
  const pRange = compile(gl, VS_QUAD, FS_RANGE);
  const pSprite = compile(gl, VS_SPRITE, FS_SPRITE);
  const pFog = compile(gl, VS_QUAD, FS_FOG);
  const pPts = compile(gl, VS_PTS, FS_PTS);
  const pLines = compile(gl, VS_LINES, FS_LINES);
  // locations are immutable after link — look each up once
  const uCache = new Map<WebGLProgram, Record<string, WebGLUniformLocation | null>>();
  const aCache = new Map<WebGLProgram, Record<string, number>>();
  const U = (p: WebGLProgram, n: string) => { let m = uCache.get(p); if (!m) { m = {}; uCache.set(p, m); } if (!(n in m)) m[n] = gl.getUniformLocation(p, n); return m[n]; };
  const A = (p: WebGLProgram, n: string) => { let m = aCache.get(p); if (!m) { m = {}; aCache.set(p, m); } if (!(n in m)) m[n] = gl.getAttribLocation(p, n); return m[n]; };

  const quad = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const bindQuad = (p: WebGLProgram) => { const a = A(p, 'aPos'); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0); };
  const unit = gl.createBuffer()!;                          // 0..1 quad for sprites
  gl.bindBuffer(gl.ARRAY_BUFFER, unit);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
  const bindUnit = (p: WebGLProgram) => { const a = A(p, 'aPos'); gl.bindBuffer(gl.ARRAY_BUFFER, unit); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0); };

  // ── assets ──
  let nStars = 0; const starBuf = gl.createBuffer()!;
  fetch('/sidereal/stars.bin').then((r) => r.arrayBuffer()).then((ab) => {
    const dv = new DataView(ab); nStars = ab.byteLength / 8;
    const arr = new Float32Array(nStars * 6);
    for (let i = 0; i < nStars; i++) {
      const o = i * 8;
      arr[i * 6] = dv.getInt16(o, true) / 32767; arr[i * 6 + 1] = dv.getInt16(o + 2, true) / 32767; arr[i * 6 + 2] = dv.getInt16(o + 4, true) / 32767;
      arr[i * 6 + 3] = dv.getUint8(o + 6) / 28 - 2; arr[i * 6 + 4] = dv.getUint8(o + 7) / 100 - 0.5; arr[i * 6 + 5] = ((i * 2654435761) >>> 0) / 4294967295;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, starBuf); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
  }).catch(() => {});
  let nLineVerts = 0; const lineBuf = gl.createBuffer()!;
  fetch('/sidereal/constellations.bin').then((r) => r.arrayBuffer()).then((ab) => {
    const dv = new DataView(ab); nLineVerts = ab.byteLength / 6;
    const arr = new Float32Array(nLineVerts * 3);
    for (let i = 0; i < nLineVerts; i++) { arr[i * 3] = dv.getInt16(i * 6, true) / 32767; arr[i * 3 + 1] = dv.getInt16(i * 6 + 2, true) / 32767; arr[i * 3 + 2] = dv.getInt16(i * 6 + 4, true) / 32767; }
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
  }).catch(() => {});
  let texMW: WebGLTexture | null = null, texRange: WebGLTexture | null = null, texMoon: WebGLTexture | null = null, texFogA: WebGLTexture | null = null, texFogB: WebGLTexture | null = null;
  let rangeW = 3168, rangeH = 1344; let skyline: number[] = []; let peaks: number[] = [];
  loadTex(gl, '/sidereal/milkyway.webp', { repeat: true, lum: true }).then((t) => (texMW = t)).catch(() => {});
  const small = window.innerWidth < 900 || (navigator as any).deviceMemory < 4;
  loadTex(gl, small ? '/sidereal/range-2k.webp' : '/sidereal/range.webp', { alpha: true, mip: false }).then((t) => { texRange = t; root.classList.add('range-ready'); }).catch(() => {});
  loadTex(gl, '/sidereal/moon.webp', { alpha: true }).then((t) => (texMoon = t)).catch(() => {});
  loadTex(gl, '/photos/fog-plate-a.webp', { repeat: true, lum: true, mip: false }).then((t) => (texFogA = t)).catch(() => {});
  loadTex(gl, '/photos/fog-plate-b.webp', { repeat: true, lum: true, mip: false }).then((t) => (texFogB = t)).catch(() => {});
  fetch('/sidereal/range.json').then((r) => r.json()).then((j) => {
    rangeW = j.w; rangeH = j.h; skyline = j.skyline;
    // spindrift emitters: local maxima of the skyline (smallest y), spaced
    const cand: number[] = [];
    for (let i = 2; i < skyline.length - 2; i++) if (skyline[i] < skyline[i - 1] && skyline[i] <= skyline[i + 1] && skyline[i] < skyline[i - 2] && skyline[i] <= skyline[i + 2]) cand.push(i);
    cand.sort((a, b) => skyline[a] - skyline[b]);
    peaks = []; for (const c of cand) { if (peaks.every((p) => Math.abs(p - c) > skyline.length * 0.035)) peaks.push(c); if (peaks.length >= 9) break; }
  }).catch(() => {});

  // ── state ──
  const dbg = { fog: 1, drift: 1 };   // live tuning hooks (window.__sidereal.dbg)
  let W = 1, H = 1, dpr = 1, aspect = 1, tanX = 1, tanY = 1;
  let sunAlt = 6, sunTarget = 6;          // degrees
  let moonUp = 0;                         // 0..1 rise progress
  let idleSec = 0;                        // real seconds since load (sky wheels)
  let scrollT = 0;                        // 0..1 page progress
  const isClock = opts.mode === 'clock';
  let chapters: { el: HTMLElement; sun: number; center: number; top: number; height: number; pad: number }[] = [];
  let docH = 1, vh = window.innerHeight;

  function resize() {
    vh = window.innerHeight;
    dpr = clamp(window.devicePixelRatio || 1, 1, 1.5);
    W = Math.round(canvas.clientWidth * dpr); H = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    aspect = W / H; tanX = Math.tan(HFOV / 2); tanY = tanX / aspect;
    gl.viewport(0, 0, W, H);
    docH = Math.max(1, document.body.scrollHeight - vh);
    chapters = Array.from(document.querySelectorAll<HTMLElement>('[data-chapter]')).map((el) => {
      const r = el.getBoundingClientRect(); const top = r.top + window.scrollY;
      const pad = parseFloat(getComputedStyle(el).paddingTop) || 0;
      return { el, sun: Number(el.dataset.sun ?? 0), top, height: r.height, center: top + r.height / 2, pad };
    });
    layoutScale();
  }

  // ── HUD ──
  const hudClock = document.getElementById('tc-clock'), hudSun = document.getElementById('tc-sun'), hudPhase = document.getElementById('tc-phase');
  const marker = document.getElementById('scale-marker');
  const scaleTicks = document.getElementById('scale-ticks');
  const SCALE_TOP = 6, SCALE_BOT = -26;
  function layoutScale() {
    if (!scaleTicks || scaleTicks.childElementCount) return;
    const frag = document.createDocumentFragment();
    for (let a = SCALE_TOP; a >= SCALE_BOT; a -= 2) {
      const t = document.createElement('span'); t.className = 'scale__tick' + (a % 6 === 0 ? ' scale__tick--major' : '');
      t.style.top = `${((SCALE_TOP - a) / (SCALE_TOP - SCALE_BOT)) * 100}%`;
      if (a % 6 === 0) t.dataset.v = `${a > 0 ? '+' : a < 0 ? '−' : ''}${Math.abs(a)}°`;
      frag.appendChild(t);
    }
    chapters.forEach((c) => {
      const label = c.el.dataset.chapterLabel; if (!label) return;
      const a = document.createElement('a'); a.className = 'scale__chapter'; a.href = `#${c.el.id}`; a.textContent = label;
      a.style.top = `${((SCALE_TOP - c.sun) / (SCALE_TOP - SCALE_BOT)) * 100}%`;
      frag.appendChild(a);
    });
    scaleTicks.appendChild(frag);
  }
  let lastHudAlt = 999, lastPhase = '';
  function hud(alt: number) {
    const r = Math.round(alt * 10) / 10;
    if (r !== lastHudAlt) {
      lastHudAlt = r;
      const s = `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(1)}°`;
      if (hudSun) hudSun.textContent = s;
      if (hudClock) hudClock.textContent = clockOf(alt);
      if (marker) marker.style.transform = `translate3d(0, ${((SCALE_TOP - clamp(alt, SCALE_BOT, SCALE_TOP)) / (SCALE_TOP - SCALE_BOT)) * 100}cqh, 0)`;
    }
    const ph = phaseOf(alt);
    if (ph !== lastPhase) { lastPhase = ph; root.dataset.phase = ph; if (hudPhase) hudPhase.textContent = PHASE_LABEL[ph]; }
  }

  // ── scroll → sun ──
  function fadeChapters(s: number) {
    for (const c of chapters) {
      const bottom = c.top + c.height - s;              // viewport y of the chapter's end
      const o = clamp((bottom - 96) / (vh * 0.12), 0, 1);
      const v = o < 0.995 ? o.toFixed(2) : '';
      if ((c.el.style.opacity || '') !== v) c.el.style.opacity = v;
    }
  }
  function readScroll() {
    const s = window.scrollY; scrollT = clamp(s / docH, 0, 1);
    fadeChapters(s);
    if (!isClock || !chapters.length) { sunTarget = -20; moonUp = 1; return; }
    // Each chapter HOLDS its altitude while the viewport centre is inside its
    // band (its box minus its own top padding); the sun sinks only in the gaps
    // between chapters. The page bottom is always the deepest night.
    const vc = s + vh * 0.5;
    const bands = chapters.map((c) => ({ a: c.top + c.pad, b: c.top + c.height, sun: c.sun }));
    bands[0].a = 0;
    bands[bands.length - 1].b = Math.max(bands[bands.length - 1].b, docH + vh);
    let target = bands[0].sun;
    if (vc >= bands[bands.length - 1].a) target = bands[bands.length - 1].sun;
    else for (let i = 0; i < bands.length - 1; i++) {
      const cur = bands[i], nxt = bands[i + 1];
      if (vc <= cur.b) { target = cur.sun; break; }
      if (vc < nxt.a) { const u = clamp((vc - cur.b) / Math.max(1, nxt.a - cur.b), 0, 1); target = lerp(cur.sun, nxt.sun, u * u * (3 - 2 * u)); break; }
    }
    if (s < 4) target = bands[0].sun + 0.6;
    sunTarget = target;
    const last = chapters[chapters.length - 1];
    const rise0 = last.top - vh * 0.15;
    moonUp = clamp((vc - rise0) / Math.max(1, docH + vh * 0.5 - rise0), 0, 1);
  }

  // ── matrices ──
  function matrices(lst: number) {
    const cL = Math.cos(lst), sL = Math.sin(lst), cP = Math.cos(LAT), sP = Math.sin(LAT);
    // eq (x→RA0, z→pole) → hour-angle frame: xh = x cos L + y sin L ; yh = −x sin L + y cos L ; zh = z
    const eq2ha = [cL, -sL, 0, sL, cL, 0, 0, 0, 1];
    // ha → horizon (north, east, up): north = −xh sP + zh cP ; east = −yh ; up = xh cP + zh sP
    const ha2hor = [-sP, 0, cP, 0, -1, 0, cP, 0, sP];
    const eq2hor = mat3Mul(ha2hor, eq2ha);
    // horizon → camera (right, up, forward)
    const cA = Math.cos(CAM_AZ), sA = Math.sin(CAM_AZ), cT = Math.cos(CAM_PITCH), sT = Math.sin(CAM_PITCH);
    const f = [cT * cA, cT * sA, sT], r = [-sA, cA, 0];
    const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
    const hor2cam = [r[0], u[0], f[0], r[1], u[1], f[1], r[2], u[2], f[2]];
    return { eq2hor, hor2cam, cam2hor: transpose(hor2cam), hor2eq: transpose(eq2hor) };
  }

  // ── particles: spindrift, satellite, meteor ──
  const NP = 150;
  const parts = Array.from({ length: NP }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, a: 0 }));
  const ptData = new Float32Array(NP * 4);
  const ptBuf = gl.createBuffer()!;
  let sat = { on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0 }, nextSat = 25;
  let meteor = { on: false, x: 0, y: 0, dx: 0, dy: 0, t: 0 }, nextMeteor = 40;
  function rangeMap() {
    // cover: on very wide viewports the plate fits by width; otherwise it fits
    // by height and the horizontal window centres on the main massif (u≈0.42).
    // uv = vUv * (sx, sy) + (ox, oy); anchored to the viewport bottom.
    const ar = rangeW / rangeH;
    const fitAr = ar * 0.92;
    if (aspect >= fitAr) {
      const plateH = (W / fitAr) / H;                 // plate height in viewport units
      return { sx: 1, sy: 1 / plateH, ox: 0, oy: 0 };
    }
    const plateW = (H * ar) / W;                      // plate width in viewport units (> 1)
    const sx = 1 / plateW;
    const ox = clamp(0.42 - 0.42 * sx, 0, 1 - sx);
    return { sx, sy: 1, ox, oy: 0 };
  }
  function emit(dt: number, strength: number, wind: number) {
    if (!peaks.length || strength <= 0.01) return;
    const m = rangeMap();
    let n = Math.round(strength * dt * 55);
    for (const p of parts) {
      if (n <= 0) break;
      if (p.life > 0) continue;
      const col = peaks[Math.floor(Math.random() * Math.min(peaks.length, 6))];
      const u = col / skyline.length, v = 1 - skyline[col] / rangeH;
      p.x = (u - m.ox) / m.sx * 2 - 1; p.y = (v - m.oy) / m.sy * 2 - 1;
      p.x += (Math.random() - 0.4) * 0.02; p.y += Math.random() * 0.006;
      p.vx = (0.03 + Math.random() * 0.05) * wind; p.vy = 0.012 + Math.random() * 0.02;
      p.max = 1.6 + Math.random() * 2.2; p.life = p.max; p.size = 1.2 + Math.random() * 1.6; p.a = (0.12 + Math.random() * 0.2) * strength;
      n--;
    }
  }
  function stepParts(dt: number, wind: number) {
    let k = 0;
    for (const p of parts) {
      if (p.life <= 0) continue;
      p.life -= dt; const u = 1 - p.life / p.max;
      p.vy -= 0.02 * dt; p.vx += (Math.sin(idleSec * 2.1 + p.x * 9) * 0.01) * dt;
      p.x += (p.vx + wind * 0.008) * dt; p.y += p.vy * dt;
      const fade = Math.sin(u * Math.PI);
      ptData[k++] = p.x; ptData[k++] = p.y; ptData[k++] = p.size; ptData[k++] = p.a * fade;
    }
    return k / 4;
  }

  // ── draw ──
  let mwSeed = 0;
  function draw(now: number, dt: number) {
    const alt = sunAlt;
    const [s0, s1, st] = keyAt(SKY, alt);
    const [r0, r1, rt] = keyAt(RANGE, alt);
    const night = smooth(-12, -18, alt);
    // narrow screens: the moon clears the contact block by rising higher
    const moonAlt = (isClock ? lerp(-4.6, 11, smooth(0, 1, moonUp)) : 13) + idleSec * 0.004 + (aspect < 0.8 ? 14 * smooth(0, 1, moonUp) : 0);
    const moonVis = (moonAlt > -4.4 ? 1 : 0) * smooth(-14, -17, alt);
    const moonLight = moonVis * clamp(moonAlt / 10, 0, 1);
    // sidereal time: each degree of sun altitude ≈ 4.6 min ≈ 1.15° of sky; idle at 1×
    const lst = LST0 + ((6 - alt) * 1.15 + idleSec / 240) * DEG;
    const M = matrices(lst);

    gl.disable(gl.BLEND);
    gl.useProgram(pSky); bindQuad(pSky);
    gl.uniform2f(U(pSky, 'uTan'), tanX, tanY);
    gl.uniformMatrix3fv(U(pSky, 'uCamToHor'), false, M.cam2hor);
    gl.uniformMatrix3fv(U(pSky, 'uHorToEq'), false, M.hor2eq);
    const set3 = (n: string, a: V3, b: V3) => { const v = mix3(a, b, st); gl.uniform3f(U(pSky, n), v[0], v[1], v[2]); };
    set3('uZenith', s0.zenith, s1.zenith); set3('uMid', s0.mid, s1.mid); set3('uHorizon', s0.horizon, s1.horizon);
    set3('uGlow', s0.glow, s1.glow); set3('uBelt', s0.belt, s1.belt); set3('uShadow', s0.shadow, s1.shadow); set3('uAirglow', s0.airglow, s1.airglow);
    gl.uniform1f(U(pSky, 'uGlowK'), lerp(s0.glowK, s1.glowK, st));
    gl.uniform1f(U(pSky, 'uBeltK'), lerp(s0.beltK, s1.beltK, st));
    gl.uniform1f(U(pSky, 'uSunAz'), SUN_AZ);
    gl.uniform1f(U(pSky, 'uMW'), lerp(s0.mw, s1.mw, st) * (1 - moonLight * 0.55) * (texMW ? 1 : 0));
    gl.uniform1f(U(pSky, 'uSeed'), (mwSeed = (mwSeed + 0.37) % 97));
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texMW); gl.uniform1i(U(pSky, 'uMWTex'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND);
    // stars — additive
    const limMag = lerp(s0.limMag, s1.limMag, st) - moonLight * 0.9;
    if (nStars && limMag > -3) {
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(pStars);
      gl.bindBuffer(gl.ARRAY_BUFFER, starBuf);
      const aDir = A(pStars, 'aDir'), aMag = A(pStars, 'aMag'), aBv = A(pStars, 'aBv'), aSeed = A(pStars, 'aSeed');
      gl.enableVertexAttribArray(aDir); gl.vertexAttribPointer(aDir, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(aMag); gl.vertexAttribPointer(aMag, 1, gl.FLOAT, false, 24, 12);
      gl.enableVertexAttribArray(aBv); gl.vertexAttribPointer(aBv, 1, gl.FLOAT, false, 24, 16);
      gl.enableVertexAttribArray(aSeed); gl.vertexAttribPointer(aSeed, 1, gl.FLOAT, false, 24, 20);
      gl.uniformMatrix3fv(U(pStars, 'uEqToHor'), false, M.eq2hor);
      gl.uniformMatrix3fv(U(pStars, 'uHorToCam'), false, M.hor2cam);
      gl.uniform2f(U(pStars, 'uTan'), tanX, tanY);
      gl.uniform1f(U(pStars, 'uLimMag'), limMag);
      gl.uniform1f(U(pStars, 'uTime'), now / 1000);
      gl.uniform1f(U(pStars, 'uDpr'), dpr);
      gl.uniform1f(U(pStars, 'uTwk'), motionOff() ? 0 : 0.55);
      gl.drawArrays(gl.POINTS, 0, nStars);
      gl.disableVertexAttribArray(aMag); gl.disableVertexAttribArray(aBv); gl.disableVertexAttribArray(aSeed);
    }

    // constellation figures — hairlines, only once the sky is fully dark
    const figA = 0.085 * smooth(-16, -20, alt) * (1 - moonLight * 0.5);
    if (nLineVerts && figA > 0.003) {
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(pLines);
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
      const aL = A(pLines, 'aDir'); gl.enableVertexAttribArray(aL); gl.vertexAttribPointer(aL, 3, gl.FLOAT, false, 12, 0);
      gl.uniformMatrix3fv(U(pLines, 'uEqToHor'), false, M.eq2hor);
      gl.uniformMatrix3fv(U(pLines, 'uHorToCam'), false, M.hor2cam);
      gl.uniform2f(U(pLines, 'uTan'), tanX, tanY);
      gl.uniform1f(U(pLines, 'uAlpha'), figA);
      gl.drawArrays(gl.LINES, 0, nLineVerts);
    }

    // moon + halo (screen-space: rises behind the highest summit)
    const m = rangeMap();
    let moonR = clamp(W * 0.045, 44 * dpr, 92 * dpr) / W; // half-width in ndc-x units (fraction of width)
    if (texMoon && moonVis > 0.001 && peaks.length) {
      const mid = peaks.filter((c) => c / skyline.length > 0.15 && c / skyline.length < 0.85);
      const col = (mid.length ? mid : peaks).slice().sort((a, b) => skyline[a] - skyline[b])[0]; // the highest summit in frame
      const u = col / skyline.length, v = 1 - skyline[col] / rangeH;
      const px = (u - m.ox) / m.sx, py = (v - m.oy) / m.sy;          // 0..1 viewport
      const rx = moonR, ry = moonR * aspect;
      const cx = isClock ? clamp(px + rx * 0.15, 0.2, aspect < 0.8 ? 0.72 : 0.8) : 0.92, cy = py - ry * 0.75 + (moonAlt + 3) / 13 * ry * 4.2;
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(pSprite); bindUnit(pSprite);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texMoon); gl.uniform1i(U(pSprite, 'uTex'), 0);
      // halo
      gl.uniform4f(U(pSprite, 'uRect'), cx - rx * 4.5, cy - ry * 4.5, rx * 9, ry * 9);
      gl.uniform1f(U(pSprite, 'uHalo'), 1); gl.uniform3f(U(pSprite, 'uTint'), 0.55, 0.62, 0.85); gl.uniform1f(U(pSprite, 'uAlpha'), 0.16 * moonVis * night);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      // disc — warm near the horizon, silver higher up
      const warm = 1 - clamp(moonAlt / 8, 0, 1);
      gl.uniform4f(U(pSprite, 'uRect'), cx - rx, cy - ry, rx * 2, ry * 2);
      gl.uniform1f(U(pSprite, 'uHalo'), 0); gl.uniform3f(U(pSprite, 'uTint'), 1.0, lerp(0.98, 0.80, warm), lerp(0.96, 0.62, warm)); gl.uniform1f(U(pSprite, 'uAlpha'), moonVis);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // the range — relit
    if (texRange) {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(pRange); bindQuad(pRange);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texRange); gl.uniform1i(U(pRange, 'uTex'), 0);
      // parallax: the range settles very slightly as the evening passes
      gl.uniform4f(U(pRange, 'uMap'), m.sx, m.sy, m.ox, m.oy + scrollT * 0.03 * (isClock ? 1 : 0));
      const t3 = (n: string, a: V3, b: V3) => { const v = mix3(a, b, rt); gl.uniform3f(U(pRange, n), v[0], v[1], v[2]); };
      gl.uniform1f(U(pRange, 'uExposure'), lerp(r0.exposure, r1.exposure, rt));
      gl.uniform1f(U(pRange, 'uSat'), lerp(r0.sat, r1.sat, rt));
      gl.uniform1f(U(pRange, 'uHiMix'), lerp(r0.hiMix, r1.hiMix, rt));
      gl.uniform1f(U(pRange, 'uLift'), lerp(r0.lift, r1.lift, rt));
      gl.uniform1f(U(pRange, 'uContrast'), lerp(r0.contrast, r1.contrast, rt));
      gl.uniform1f(U(pRange, 'uMoonLift'), moonLight * 0.5);
      t3('uTint', r0.tint, r1.tint); t3('uHiTint', r0.hiTint, r1.hiTint);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // cloud strips — drift at prime periods; more present in twilight
    const fogK = (0.16 + 0.26 * smooth(6, -4, alt) * (1 - smooth(-9, -16, alt)) + 0.08 * night) * (motionOff() ? 0.7 : 1) * dbg.fog;
    const hz = mix3(s0.horizon, s1.horizon, st);
    const fogTint: V3 = [lerp(hz[0], 1, 0.35), lerp(hz[1], 1, 0.35), lerp(hz[2], 1, 0.35)];
    const drawFog = (tex: WebGLTexture | null, off: number, a: number, y0: number, y1: number, rep: number) => {
      if (!tex) return;
      gl.useProgram(pFog); bindQuad(pFog);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U(pFog, 'uTex'), 0);
      gl.uniform1f(U(pFog, 'uOffset'), off); gl.uniform1f(U(pFog, 'uAlpha'), a); gl.uniform1f(U(pFog, 'uY0'), y0); gl.uniform1f(U(pFog, 'uY1'), y1); gl.uniform1f(U(pFog, 'uRepeat'), rep);
      gl.uniform3f(U(pFog, 'uTint'), fogTint[0], fogTint[1], fogTint[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const bandBase = 1 / rangeMap().sy;             // plate height in viewport units
    drawFog(texFogA, idleSec / 223, fogK, bandBase * 0.40, bandBase * 0.86, 1.6);
    drawFog(texFogB, -idleSec / 347, fogK * 0.8, bandBase * 0.52, bandBase * 0.98, 1.1);

    // spindrift + satellite + meteor
    if (!motionOff()) {
      const wind = 0.7 + 0.3 * Math.sin(idleSec * 0.11);
      const drift = (0.35 + 0.65 * smooth(-8, 3, alt)) * dbg.drift; // backlit at golden hour
      emit(dt, drift, wind); let n = stepParts(dt, wind);
      // satellite: a slow point crossing the dark sky
      nextSat -= dt;
      if (!sat.on && nextSat < 0 && alt < -9) { sat = { on: true, x: -1.05, y: 0.2 + Math.random() * 0.6, vx: 0.05 + Math.random() * 0.03, vy: (Math.random() - 0.5) * 0.02, t: 0 }; nextSat = 70 + Math.random() * 90; }
      if (sat.on) { sat.x += sat.vx * dt; sat.y += sat.vy * dt; if (sat.x > 1.05) sat.on = false; else { ptData[n * 4] = sat.x; ptData[n * 4 + 1] = sat.y; ptData[n * 4 + 2] = 2.2; ptData[n * 4 + 3] = 0.75 * night; n++; } }
      nextMeteor -= dt;
      if (!meteor.on && nextMeteor < 0 && alt < -14) { meteor = { on: true, x: -0.6 + Math.random() * 1.2, y: 0.3 + Math.random() * 0.6, dx: 0.9 + Math.random() * 0.6, dy: -(0.5 + Math.random() * 0.4), t: 0 }; nextMeteor = 60 + Math.random() * 120; }
      if (meteor.on) {
        meteor.t += dt; const life = meteor.t / 0.7;
        if (life > 1) meteor.on = false;
        else for (let i = 0; i < 14 && n < NP; i++) { const u = life - i * 0.02; if (u < 0) break; ptData[n * 4] = meteor.x + meteor.dx * u; ptData[n * 4 + 1] = meteor.y + meteor.dy * u; ptData[n * 4 + 2] = 2.6 - i * 0.12; ptData[n * 4 + 3] = (1 - life) * (1 - i / 14) * 0.9 * night; n++; }
      }
      if (n > 0) {
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(pPts);
        gl.bindBuffer(gl.ARRAY_BUFFER, ptBuf); gl.bufferData(gl.ARRAY_BUFFER, ptData.subarray(0, n * 4), gl.DYNAMIC_DRAW);
        const aP = A(pPts, 'aPos'), aS = A(pPts, 'aSize'), aA = A(pPts, 'aAlpha');
        gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(aS); gl.vertexAttribPointer(aS, 1, gl.FLOAT, false, 16, 8);
        gl.enableVertexAttribArray(aA); gl.vertexAttribPointer(aA, 1, gl.FLOAT, false, 16, 12);
        gl.uniform1f(U(pPts, 'uDpr'), dpr);
        const c = mix3([0.95, 0.9, 0.85], [0.85, 0.9, 1.0], night);
        gl.uniform3f(U(pPts, 'uCol'), c[0], c[1], c[2]);
        gl.drawArrays(gl.POINTS, 0, n);
        gl.disableVertexAttribArray(aS); gl.disableVertexAttribArray(aA);
      }
    }
    hud(alt);
  }

  // ── loop ──
  let rafId = 0, lastNow = performance.now(), lastFrameTs = 0, scrollDirty = true;
  function frame(now: number) {
    lastFrameTs = now;
    const dt = Math.min(0.05, (now - lastNow) / 1000); lastNow = now;
    if (!motionOff()) idleSec += dt;
    if (scrollDirty) { readScroll(); scrollDirty = false; }
    sunAlt = motionOff() ? sunTarget : lerp(sunAlt, sunTarget, 1 - Math.pow(0.001, dt)); // ~settles in 1s
    draw(now, dt);
    // reduced motion: the world is a still — draw it once per change, then sleep
    if (motionOff() && Math.abs(sunAlt - sunTarget) < 0.01) { rafId = 0; return; }
    rafId = requestAnimationFrame(frame);
  }
  const wake = () => { if (!rafId && !document.hidden) { lastNow = performance.now(); rafId = requestAnimationFrame(frame); } };
  // heartbeat for rAF-suspended contexts (occluded windows, embedded panes) — never while hidden
  setInterval(() => {
    if (document.hidden || motionOff()) return;
    const now = performance.now();
    if (now - lastFrameTs < 400) return;
    readScroll(); sunAlt = sunTarget; draw(now, 0.016);
  }, 250);

  window.addEventListener('scroll', () => { scrollDirty = true; wake(); }, { passive: true });
  let resizeQueued = 0, lastW = window.innerWidth, lastH = window.innerHeight;
  window.addEventListener('resize', () => {
    // iOS toolbars fire height-only resizes mid-scroll; only a width change re-lays the world there
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (coarse && window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 160) return;
    lastW = window.innerWidth; lastH = window.innerHeight;
    if (resizeQueued) return;
    resizeQueued = requestAnimationFrame(() => { resizeQueued = 0; resize(); scrollDirty = true; wake(); });
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(rafId); rafId = 0; } else wake(); });
  mqReduce.addEventListener?.('change', () => { scrollDirty = true; wake(); });

  // ── eased anchor scrolling (self-driven; cancellation-proof) ──
  let animScroll = 0;
  function scrollToY(target: number) {
    cancelAnimationFrame(animScroll);
    if (motionOff()) { window.scrollTo({ top: target, behavior: 'instant' as ScrollBehavior }); return; }
    const from = window.scrollY, dist = target - from, dur = clamp(Math.abs(dist) * 0.5, 400, 1300), t0 = performance.now();
    let stepped = false;
    const step = (now: number) => { stepped = true; const u = clamp((now - t0) / dur, 0, 1); const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2; window.scrollTo(0, from + dist * e); if (u < 1) animScroll = requestAnimationFrame(step); };
    animScroll = requestAnimationFrame(step);
    setTimeout(() => { if (!stepped) window.scrollTo(0, target); }, 150);
  }
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest?.('a[href^="#"]') as HTMLAnchorElement | null;
    if (!a) return;
    const id = a.getAttribute('href')!.slice(1);
    const el = id ? document.getElementById(id) : document.body;
    if (!el) return;
    e.preventDefault(); history.pushState(null, '', `#${id}`);
    scrollToY(id === 'top' || id === '' ? 0 : el.getBoundingClientRect().top + window.scrollY - 72);
  });
  window.addEventListener('wheel', () => cancelAnimationFrame(animScroll), { passive: true });
  window.addEventListener('touchstart', () => cancelAnimationFrame(animScroll), { passive: true });

  // ── reveal + numeral count-up (once, gated) ──
  function engage() {
    if (motionOff() || !('IntersectionObserver' in window)) return;
    root.classList.add('anim-ok');
    let alive = false;
    new IntersectionObserver((_, o) => { alive = true; o.disconnect(); }).observe(document.body);
    setTimeout(() => { if (!alive) { root.classList.remove('anim-ok'); document.querySelectorAll('.rv').forEach((el) => el.classList.add('is-in')); } }, 1400);
    let batch = 0, lastBatch = 0;
    const io = new IntersectionObserver((entries) => {
      const now = performance.now(); if (now - lastBatch > 400) batch = 0; lastBatch = now;
      entries.forEach((en) => { if (!en.isIntersecting) return; const el = en.target as HTMLElement; el.style.setProperty('--rv-delay', `${Math.min(batch++ * 80, 320)}ms`); el.classList.add('is-in'); io.unobserve(el); });
    }, { threshold: 0.12 });
    document.querySelectorAll('.rv').forEach((el) => io.observe(el));
    const mio = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return; const el = en.target as HTMLElement; mio.unobserve(el);
        const m = (el.textContent || '').match(/^([^0-9]*)(\d+(?:\.\d+)?)([\s\S]*)$/); if (!m) return;
        const [, pre, numStr, post] = m; const target = parseFloat(numStr); const dec = numStr.includes('.') ? numStr.split('.')[1].length : 0; const t0 = performance.now();
        const tick = (now: number) => { const u = clamp((now - t0) / 1100, 0, 1); el.textContent = pre + (target * (1 - (1 - u) ** 3)).toFixed(dec) + post; if (u < 1) requestAnimationFrame(tick); else el.textContent = pre + numStr + post; };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    document.querySelectorAll('.numeral-live').forEach((el) => mio.observe(el));
  }

  resize(); readScroll(); sunAlt = sunTarget; engage();
  setTimeout(() => { resize(); scrollDirty = true; }, 1200);
  window.addEventListener('load', () => { resize(); scrollDirty = true; });
  rafId = requestAnimationFrame(frame);
  // live tuning: window.__sidereal.sun = -12; window.__sidereal.dbg.fog = 3
  (window as any).__sidereal = { get sun() { return sunAlt; }, set sun(v: number) { sunTarget = v; sunAlt = v; wake(); }, resize, dbg };
}
