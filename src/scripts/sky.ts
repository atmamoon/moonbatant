// sky.ts — the SIDEREAL stage.
// One fixed WebGL canvas renders the whole world from ONE scalar: the altitude
// of the sun. Scroll advances the evening; idle time passes at 1× (the sky
// really wheels at 15°/h). Layers, back to front: analytic twilight sky →
// Milky Way (isophote bake) → 5,044 real stars → moon → the range (relit in
// the shader) → cloud strips → spindrift, satellites, meteors.
// Iron rules: effects READ scroll, never write it; nothing per-frame touches
// DOM style except the chapter fade (opacity, written on change); everything
// stops only under prefers-reduced-motion. The scene is never
// annotated: altitude, phase, clock and place drive the light but are never
// printed, so nothing on screen competes with the content.

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
  { alt: 6,   zenith: [0.09, 0.21, 0.56], mid: [0.32, 0.47, 0.80], horizon: [0.90, 0.73, 0.54], glow: [1.0, 0.78, 0.45], glowK: 0.40, belt: [0.0, 0, 0], shadow: [0, 0, 0], beltK: 0,    airglow: [0, 0, 0], limMag: -9, mw: 0 },
  { alt: 2,   zenith: [0.08, 0.18, 0.50], mid: [0.29, 0.42, 0.76], horizon: [0.94, 0.70, 0.50], glow: [1.0, 0.72, 0.40], glowK: 0.50, belt: [0.9, 0.62, 0.66], shadow: [0.30, 0.34, 0.52], beltK: 0.25, airglow: [0, 0, 0], limMag: -9, mw: 0 },
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

import { phaseOf } from './twilight';

// ── shaders ───────────────────────────────────────────────────────────────
const VS_QUAD = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;
const FS_SKY = `
precision highp float;
varying vec2 vUv;
uniform vec2 uTan; uniform mat3 uCamToHor; uniform mat3 uHorToEq;
uniform vec3 uZenith, uMid, uHorizon, uGlow, uBelt, uShadow, uAirglow;
uniform float uGlowK, uBeltK, uSunAz, uMW, uSeed;
uniform sampler2D uMWTex;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }   // hash without sine
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
  // the bake is soft: keep its core, drop its haze, and break it into a fine grain fixed to the sky
  mw = smoothstep(0.03, 0.45, mw) * mix(0.4, 1.3, h12(floor(muv * vec2(4096.0, 2048.0))));
  col += vec3(0.62,0.70,0.94) * mw * uMW * 1.0 * smoothstep(-0.02, 0.28, alt);
  // dither (kills banding on 8-bit displays)
  col += (hash(gl_FragCoord.xy + uSeed) - 0.5) * (1.6/255.0);
  gl_FragColor = vec4(col, 1.0);
}`;

const VS_STARS = `
attribute vec3 aDir; attribute float aMag; attribute float aBv; attribute float aSeed;
uniform mat3 uEqToHor, uHorToCam; uniform vec2 uTan; uniform float uLimMag, uTime, uDpr, uTwk;
varying float vI; varying vec3 vCol; varying float vBig; varying float vSize;
void main(){
  vec3 h = uEqToHor * aDir; vec3 c = uHorToCam * h;
  if (c.z <= 0.02 || h.z < -0.02) { gl_Position = vec4(2.0,2.0,2.0,1.0); gl_PointSize = 0.0; vI = 0.0; vCol = vec3(0.0); vBig = 0.0; vSize = 0.0; return; }
  gl_Position = vec4(c.x/c.z/uTan.x, c.y/c.z/uTan.y, 0.0, 1.0);
  float alt = asin(clamp(h.z,-1.0,1.0));
  float vis = 1.0 - smoothstep(uLimMag - 0.8, uLimMag, aMag);
  float I = pow(10.0, -0.4*(aMag - 2.3)*mix(0.55, 0.45, step(3.0, aMag)));   // a gentler curve for the faint majority
  I *= mix(0.3, 1.0, smoothstep(0.0, 0.25, alt));           // extinction
  // scintillation, not a pulse: three incommensurate tones (about 1.5 to 7 Hz) under a slow
  // gust of seeing, strongest through the thick air near the horizon
  float lowAmp = 0.22 + 0.6*(1.0 - smoothstep(0.02, 0.45, alt));
  float ph = aSeed*6.2831;
  float sc = 0.5*sin(uTime*(9.0 + 7.0*fract(aSeed*7.31)) + ph)
           + 0.3*sin(uTime*(19.0 + 9.0*fract(aSeed*3.17)) + ph*2.7)
           + 0.2*sin(uTime*(33.0 + 11.0*fract(aSeed*5.71)) + ph*4.1);
  float gust = 0.45 + 0.55*smoothstep(-0.4, 0.9, sin(uTime*(0.21 + 0.3*fract(aSeed*11.3)) + ph*9.0));
  float twk = 1.0 + uTwk * lowAmp * gust * sc;
  vI = clamp(I*vis*twk, 0.0, 1.8);
  float b = clamp((3.6 - aMag)/5.2, 0.0, 1.0);
  vBig = b;
  float ps = mix(2.0, 9.0, b*b) * uDpr;
  if (b < 0.15) ps = max(4.0, ps);   // faint stars: room for a pixel-sized Gaussian
  gl_PointSize = ps; vSize = ps;
  vec3 col = aBv < 0.0 ? mix(vec3(0.62,0.76,1.0), vec3(1.0), clamp((aBv+0.45)/0.45,0.0,1.0))
       : aBv < 0.65 ? mix(vec3(1.0), vec3(1.0,0.94,0.82), aBv/0.65)
       : mix(vec3(1.0,0.94,0.82), vec3(1.0,0.66,0.40), clamp((aBv-0.65)/1.2,0.0,1.0));
  vCol = mix(vec3(dot(col, vec3(0.333))), col, 1.0 + 0.6*b); // bright stars keep their colour
  float lowC = uTwk * 0.25 * (1.0 - smoothstep(0.04, 0.3, alt));  // low stars flash faint colour
  vCol *= 1.0 + lowC * vec3(sin(uTime*23.0 + ph*3.0), sin(uTime*29.0 + ph*5.0), sin(uTime*31.0 + ph*7.0));
}`;
const FS_STARS = `
precision mediump float;
varying float vI; varying vec3 vCol; varying float vBig; varying float vSize;
uniform float uPx;   // device pixels per CSS pixel (its own name: a shared uniform would need matching precision)
void main(){
  vec2 p = gl_PointCoord*2.0-1.0; float d = dot(p,p);
  float core = exp(-d*5.5);
  // faint stars: a Gaussian of about 0.65 px in device pixels, the same total light, whatever the sub-pixel position
  if (vBig < 0.15) { vec2 q = (gl_PointCoord - 0.5) * vSize; core = 0.40 * exp(-dot(q, q) / (1.1 * uPx * uPx)); }
  float halo = exp(-sqrt(d)*2.6) * 0.55 * vBig * vBig;
  float a = vI * (core + halo);
  if (a < 0.003) discard;
  gl_FragColor = vec4(vCol * a, a);
}`;

const FS_RANGE = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex; uniform vec4 uMap; uniform vec2 uSub;
uniform float uExposure, uSat, uHiMix, uLift, uContrast, uMoonLift;
uniform vec3 uTint, uHiTint;
uniform sampler2D uCloud; uniform float uShA, uShOff, uShRep;
void main(){
  vec2 uv = vUv * uMap.xy + uMap.zw;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0); return; }
  vec4 c = texture2D(uTex, vec2(uv.x * uSub.x, (1.0 - uv.y) * uSub.y));   // plate = top-left uSub of a POT texture; row 0 is its top
  vec3 rgb = c.rgb / max(c.a, 1e-4);   // uploaded premultiplied; grade the straight colour
  float L = dot(rgb, vec3(0.299,0.587,0.114));
  vec3 g = mix(vec3(L), rgb, uSat);
  float hi = smoothstep(0.48, 0.95, L) * smoothstep(0.9, 1.0, c.a);   // no highlight lift on the half-transparent cut edge
  g = mix(g, g*uHiTint, uHiMix*hi);
  g = (g - 0.5)*uContrast + 0.5 + uLift;
  g *= uTint * (uExposure + uMoonLift*hi*0.35);
  // cloud shadow: the nearer layer's density darkens the range, sunlit snow most
  float cl = texture2D(uCloud, vec2(vUv.x*uShRep + uShOff, 1.0 - vUv.y)).a;
  g *= 1.0 - uShA * smoothstep(0.02, 0.16, cl) * mix(0.35, 1.0, hi);
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
    float a = pow(max(1.0 - d, 0.0), 2.2) * uAlpha;
    gl_FragColor = vec4(uTint*a, a);
  } else {
    vec4 c = texture2D(uTex, vec2(p.x, 1.0-p.y));
    vec3 m = pow(c.rgb, vec3(0.8)) * 1.18;   // lifted: a full moon is the brightest thing in the night frame
    gl_FragColor = vec4(m*uTint*c.a*uAlpha, c.a*uAlpha);
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

// The camera's graduated filters, multiplied into the frame (dst *= keep): the CSS left grad
// (linear-gradient(100deg, .72 0%, .50 46%, .12 82%)), its radial over the horizon glow on narrow and
// landscape screens (radial-gradient(90% 45% at 100% 58%, .55 0%, .30 55%, 0 100%)) and the right-edge rail
// (linear-gradient(270deg, .66 0px, .50 260px, .20 520px, 0 820px)). A multiply darkens without the blue cast
// a near-black overlay leaves, so golden hour keeps its warmth. Geometry in CSS pixels, y down.
const FS_GRADE = `
precision mediump float;
varying vec2 vUv;
uniform vec2 uView; uniform float uLeftK, uRailK, uRadial;
void main(){
  vec2 p = vec2(vUv.x * uView.x, (1.0 - vUv.y) * uView.y);
  vec2 dir = vec2(0.98481, 0.17365);
  float len = dir.x * uView.x + dir.y * uView.y;
  float t = clamp(dot(p - 0.5 * uView, dir) / len + 0.5, 0.0, 1.0);
  float aL = t < 0.46 ? mix(0.72, 0.50, t / 0.46) : (t < 0.82 ? mix(0.50, 0.12, (t - 0.46) / 0.36) : 0.12);
  float d = length((p - vec2(uView.x, 0.58 * uView.y)) / vec2(0.9 * uView.x, 0.45 * uView.y));
  float aR = uRadial * (d < 0.55 ? mix(0.55, 0.30, d / 0.55) : (d < 1.0 ? mix(0.30, 0.0, (d - 0.55) / 0.45) : 0.0));
  float r = uView.x - p.x;
  float aRail = r < 260.0 ? mix(0.66, 0.50, r / 260.0) : (r < 520.0 ? mix(0.50, 0.20, (r - 260.0) / 260.0) : (r < 820.0 ? mix(0.20, 0.0, (r - 520.0) / 300.0) : 0.0));
  float keep = (1.0 - uLeftK * (1.0 - (1.0 - aL) * (1.0 - aR))) * (1.0 - uRailK * aRail);
  gl_FragColor = vec4(vec3(keep), 1.0);
}`;

const VS_PTS = `
attribute vec2 aPos; attribute float aSize; attribute float aAlpha;
uniform float uDpr; varying float vA;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); gl_PointSize = aSize*uDpr; vA = aAlpha; }`;
const FS_PTS = `
precision mediump float; varying float vA; uniform vec3 uCol;
void main(){ vec2 p = gl_PointCoord*2.0-1.0; float a = exp(-dot(p,p)*2.2)*vA; if (a < 0.003) discard; gl_FragColor = vec4(uCol*a, a); }`;

// ── gl helpers ────────────────────────────────────────────────────────────
function compile(gl: WebGLRenderingContext, vs: string, fs: string) {
  const mk = (t: number, s: string) => { const sh = gl.createShader(t)!; gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader'); return sh; };
  const p = gl.createProgram()!;
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
  return p;
}
function loadTex(gl: WebGLRenderingContext, url: string, opts: { repeat?: boolean; alpha?: boolean; mip?: boolean; lum?: boolean; premultiply?: boolean } = {}): Promise<WebGLTexture> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = async () => {
      try { await img.decode?.(); } catch { /* upload anyway */ }
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, opts.premultiply ? 1 : 0);
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
  // Motion is always on; only the reader's own reduced-motion setting stills the world.
  // A header toggle once stored 'mb-motion' = 'off'; clear it so a stale choice can't linger.
  try { localStorage.removeItem('mb-motion'); } catch { /* storage blocked */ }
  const motionOff = () => mqReduce.matches;

  const gl = (canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }) ||
    canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
  // no engine: the poster is a night still, so the page reads in night ink
  if (!gl) { root.classList.add('no-webgl'); root.dataset.phase = 'night'; return; }
  root.classList.add('webgl');

  // programs — a compile failure on an old GPU must fall back to the poster, not a black canvas
  let pSky: WebGLProgram, pStars: WebGLProgram, pRange: WebGLProgram, pSprite: WebGLProgram, pFog: WebGLProgram, pPts: WebGLProgram, pGrade: WebGLProgram;
  try {
    pSky = compile(gl, VS_QUAD, FS_SKY);
    pStars = compile(gl, VS_STARS, FS_STARS);
    pRange = compile(gl, VS_QUAD, FS_RANGE);
    pSprite = compile(gl, VS_SPRITE, FS_SPRITE);
    pFog = compile(gl, VS_QUAD, FS_FOG);
    pPts = compile(gl, VS_PTS, FS_PTS);
    pGrade = compile(gl, VS_QUAD, FS_GRADE);
  } catch (e) {
    root.classList.remove('webgl'); root.classList.add('no-webgl'); root.dataset.phase = 'night';
    console.warn('[sidereal] shaders failed, showing the poster', e);
    return;
  }
  let contextLost = false;
  // a lost context stops the loop for good: night still, night ink, and every chapter
  // shown again (the fades under the header would otherwise freeze where they were)
  // the one way down: night still, night ink, every chapter shown again (fades under the header would freeze)
  const fallBack = () => {
    contextLost = true;
    root.classList.remove('webgl', 'range-ready'); root.classList.add('no-webgl');
    root.dataset.phase = 'night';
    document.querySelectorAll<HTMLElement>('[data-chapter]').forEach((el) => { el.style.opacity = ''; });
  };
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fallBack(); });
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
    redraw();
  }).catch(() => {});
  let texMW: WebGLTexture | null = null, texRange: WebGLTexture | null = null, texMoon: WebGLTexture | null = null, texFogA: WebGLTexture | null = null, texFogB: WebGLTexture | null = null;
  let redraw: () => void = () => {};   // set once the loop exists; assets call it when they land
  let rangeW = 3168, rangeH = 1344; let skyline: number[] = []; let peaks: number[] = [];
  let sub: [number, number] = [1, 1];   // plate / texture size (POT padding)
  let summitCol = -1;                    // the highest in-frame summit, found once
  // no mipmaps: atan wraps u from 1 to 0 across one pixel, and a mip chain samples its blurriest level there,
  // drawing a hairline along the RA 12h meridian (the bake is ~6 texels per degree, well under screen density)
  loadTex(gl, '/sidereal/milkyway.webp', { repeat: true, lum: true, mip: false }).then((t) => { texMW = t; redraw(); }).catch(() => {});
  // must match the plate preload media queries in Sidereal.astro, or the browser fetches both plates
  const small = window.innerWidth < 900 || window.matchMedia('(pointer: coarse)').matches;
  loadTex(gl, small ? '/sidereal/range-2k.webp' : '/sidereal/range.webp', { alpha: true, premultiply: true })   /* premultiplied: no stored sky colour bleeds into the filtered cut edge */.then((t) => { texRange = t; root.classList.add('range-ready'); redraw(); }).catch(() => fallBack());   // no plate: the night still, not an empty sky
  loadTex(gl, '/sidereal/moon.webp', { alpha: true }).then((t) => { texMoon = t; redraw(); }).catch(() => {});
  loadTex(gl, '/photos/fog-plate-a.webp', { repeat: true, lum: true, mip: false }).then((t) => { texFogA = t; redraw(); }).catch(() => {});
  loadTex(gl, '/photos/fog-plate-b.webp', { repeat: true, lum: true, mip: false }).then((t) => { texFogB = t; redraw(); }).catch(() => {});
  fetch('/sidereal/range.json').then((r) => r.json()).then((j) => {
    rangeW = j.w; rangeH = j.h; skyline = j.skyline; if (j.sub) sub = j.sub;
    // spindrift emitters: local maxima of the skyline (smallest y), spaced
    const cand: number[] = [];
    for (let i = 2; i < skyline.length - 2; i++) if (skyline[i] < skyline[i - 1] && skyline[i] <= skyline[i + 1] && skyline[i] < skyline[i - 2] && skyline[i] <= skyline[i + 2]) cand.push(i);
    cand.sort((a, b) => skyline[a] - skyline[b]);
    peaks = []; for (const c of cand) { if (peaks.every((p) => Math.abs(p - c) > skyline.length * 0.035)) peaks.push(c); if (peaks.length >= 9) break; }
    const mid = peaks.filter((c) => c / skyline.length > 0.15 && c / skyline.length < 0.85);
    summitCol = (mid.length ? mid : peaks).slice().sort((a, b) => skyline[a] - skyline[b])[0] ?? -1;
  }).catch(() => {});

  // ── state ──
  const dbg = { fog: 1, drift: 1, shadow: 1, speed: 1 };   // live tuning hooks (window.__sidereal.dbg)
  let W = 1, H = 1, dpr = 1, aspect = 1, tanX = 1, tanY = 1;
  let sunAlt = 6, sunTarget = 6;          // degrees
  let moonUp = 0;                         // 0..1 rise progress
  // last drawn moon (CSS px rect), for the test hook
  const moonState: { vis: number; alt: number; rect: { left: number; right: number; top: number; bottom: number } | null } = { vis: 0, alt: -90, rect: null };
  let readingCx = -1;                     // reading pages: moon centre in the right margin (fraction of width), -1 when it doesn't fit
  let readingR = 0;                       // reading pages: moon radius in CSS px
  let bandCss = 0, labelDocTop = Infinity; // home page: the header band's height and the contact label's page position, for the moon's fit
  let moonSummitFor: object | null = null, moonSummitCol = -1;   // the summit the moon rises behind, per viewport mapping
  let idleSec = 0;                        // real seconds since load (sky wheels)
  let scrollT = 0;                        // 0..1 page progress
  const isClock = opts.mode === 'clock';
  let chapters: { el: HTMLElement; sun: number; center: number; top: number; height: number; pad: number }[] = [];
  let docH = 1, vh = window.innerHeight;

  function resize() {
    vh = window.innerHeight;
    // at most ~3 MP of canvas: several full-screen passes redraw 30 times a second while someone reads
    dpr = clamp(Math.min(window.devicePixelRatio || 1, Math.sqrt(3.0e6 / Math.max(1, canvas.clientWidth * canvas.clientHeight))), 1, 1.5);
    W = Math.round(canvas.clientWidth * dpr); H = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    aspect = W / H;
    // narrower than 16:10 (phones, tablets): keep the 16:10 vertical field and crop the
    // sides, the way the range plate is cropped. A wider vertical field squeezes the
    // sky's fall-off below the horizon into a dark band behind the ridges.
    { const tanH = Math.tan(HFOV / 2); if (aspect >= 1.6) { tanX = tanH; tanY = tanH / aspect; } else { tanY = tanH / 1.6; tanX = tanY * aspect; } }
    mapCache = null;
    gl.viewport(0, 0, W, H);
    docH = Math.max(1, document.body.scrollHeight - vh);
    chapters = Array.from(document.querySelectorAll<HTMLElement>('[data-chapter]')).map((el) => {
      const r = el.getBoundingClientRect(); const top = r.top + window.scrollY;
      const pad = parseFloat(getComputedStyle(el).paddingTop) || 0;
      return { el, sun: Number(el.dataset.sun ?? 0), top, height: r.height, center: top + r.height / 2, pad };
    });
    if (!isClock) {
      // a reading page's moon may only hang in the right margin, and only when
      // that margin holds the whole disc clear of the text column
      const wrap = document.querySelector<HTMLElement>('main .wrap');
      const vw = window.innerWidth;
      const contentRight = wrap ? wrap.getBoundingClientRect().right - (parseFloat(getComputedStyle(wrap).paddingRight) || 0) : vw;
      const margin = vw - contentRight;
      readingR = Math.min(40, (margin - 96) / 2);             // at least 48px of air on each side
      readingCx = readingR >= 28 ? (contentRight + margin / 2) / vw : -1;
    } else {
      const hd = document.querySelector('.hd');
      bandCss = hd ? parseFloat(getComputedStyle(hd, '::before').height) || 0 : 0;
      const label = document.querySelector<HTMLElement>('.final__label');
      labelDocTop = label ? layoutTop(label) : Infinity;
    }
  }

  // ── phase: the one fact about the sky the page itself reads (ink, grads) ──
  let lastPhase = '';
  function syncPhase(alt: number) {
    const ph = phaseOf(Math.round(alt * 10) / 10);
    if (ph !== lastPhase) { lastPhase = ph; root.dataset.phase = ph; }
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
    // ha → horizon (north, east, up): north = −xh sP + zh cP ; east = +yh ; up = xh cP + zh sP.
    // yh already points east (hour angle grows westward) and north-east-up is left-handed, so this
    // map is a reflection (det −1); a rotation here draws the sky mirror-image, east for west.
    const ha2hor = [-sP, 0, cP, 0, 1, 0, cP, 0, sP];
    const eq2hor = mat3Mul(ha2hor, eq2ha);
    // horizon → camera (right, up, forward)
    const cA = Math.cos(CAM_AZ), sA = Math.sin(CAM_AZ), cT = Math.cos(CAM_PITCH), sT = Math.sin(CAM_PITCH);
    const f = [cT * cA, cT * sA, sT], r = [-sA, cA, 0];
    const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
    const hor2cam = [r[0], u[0], f[0], r[1], u[1], f[1], r[2], u[2], f[2]];
    return { eq2hor, hor2cam, cam2hor: transpose(hor2cam), hor2eq: transpose(eq2hor) };
  }

  // ── particles: spindrift, satellite, meteor ──
  const NP = 340;
  const parts = Array.from({ length: NP }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, a: 0 }));
  const ptData = new Float32Array(NP * 4);
  const ptBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, ptBuf); gl.bufferData(gl.ARRAY_BUFFER, ptData.byteLength, gl.DYNAMIC_DRAW);
  let sat = { on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0 }, nextSat = 25;
  let meteor = { on: false, x: 0, y: 0, dx: 0, dy: 0, t: 0 }, nextMeteor = 40;
  let gradeLeft = 0, gradeRail = 0, gradeInit = false;   // the multiplied grads' phase opacities, eased like the CSS they replace
  let mapCache: { sx: number; sy: number; ox: number; oy: number } | null = null;
  function rangeMap() {
    if (mapCache) return mapCache;
    // cover: on very wide viewports the plate fits by width; otherwise it fits
    // by height and the horizontal window centres on the main massif (u≈0.42).
    // uv = vUv * (sx, sy) + (ox, oy); anchored to the viewport bottom.
    const ar = rangeW / rangeH;
    const fitAr = ar * 0.92;
    if (aspect >= fitAr) {
      const plateH = (W / fitAr) / H;                 // plate height in viewport units
      return (mapCache = { sx: 1, sy: 1 / plateH, ox: 0, oy: 0 });
    }
    const plateW = (H * ar) / W;                      // plate width in viewport units (> 1)
    const sx = 1 / plateW;
    const ox = clamp(0.42 - 0.42 * sx, 0, 1 - sx);
    return (mapCache = { sx, sy: 1, ox, oy: 0 });
  }
  // the moon rises behind the highest summit on the right of the frame: a real moonrise at 28°N is east of this
  // north-north-east view, so right of centre. Portrait screens, and a frame with no summit there, keep the highest in frame.
  function moonSummit() {
    const m = rangeMap();
    if (moonSummitFor === m) return moonSummitCol;
    moonSummitFor = m;
    const right = aspect >= 0.8 ? peaks.filter((c) => { const vx = (c / skyline.length - m.ox) / m.sx; return vx >= 0.66 && vx <= 0.9; }) : [];
    moonSummitCol = right.length ? right.slice().sort((a, b) => skyline[a] - skyline[b])[0] : (summitCol >= 0 ? summitCol : peaks[0]);
    return moonSummitCol;
  }
  function emit(dt: number, strength: number, wind: number) {
    if (!peaks.length || strength <= 0.01) return;
    const m = rangeMap();
    let n = Math.round(strength * dt * 45);
    for (const p of parts) {
      if (n <= 0) break;
      if (p.life > 0) continue;
      const col = peaks[Math.floor(Math.random() * Math.min(peaks.length, 6))];
      const u = col / skyline.length, v = 1 - skyline[col] / rangeH;
      p.x = (u - m.ox) / m.sx * 2 - 1; p.y = (v - m.oy - (isClock ? scrollT * 0.03 : 0)) / m.sy * 2 - 1;   // follow the plate's parallax
      p.x += (Math.random() - 0.4) * 0.02; p.y += Math.random() * 0.006;
      // plumes: soft puffs, downwind and slightly up, then settling — blowing snow, not sparks
      p.vx = (0.03 + Math.random() * 0.06) * wind; p.vy = 0.005 + Math.random() * 0.012;
      p.max = 1.8 + Math.random() * 2.4; p.life = p.max; p.size = 3 + Math.random() * 5; p.a = (0.035 + Math.random() * 0.06) * strength;
      n--;
    }
  }
  function stepParts(dt: number, wind: number) {
    let k = 0;
    for (const p of parts) {
      if (p.life <= 0) continue;
      p.life -= dt; const u = 1 - p.life / p.max;
      p.vy -= 0.008 * dt; p.vx += (Math.sin(idleSec * 2.1 + p.x * 9) * 0.012) * dt; p.size += 1.6 * dt;   // puffs spread a little as they drift
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
    // time on the page lifts only a risen moon, and only a little: before moonrise it must never float the
    // disc up behind the text (portrait screens pin it at 72% across, where the ridge can't hide it)
    const rise = smooth(0, 1, moonUp);
    const moonAlt = isClock ? lerp(-6.8, 11, rise) + Math.min(idleSec * 0.004, 1.5) * rise + (aspect < 0.8 ? 6 * rise : 0) : 13 + idleSec * 0.004 + (aspect < 0.8 ? 6 : 0);
    // reading pages: no moon unless the right margin can hold it clear of the text (see resize)
    const moonVis = (moonAlt > -6.6 ? 1 : 0) * smooth(-14, -17, alt) * (!isClock && readingCx < 0 ? 0 : 1);
    const moonLight = moonVis * clamp(moonAlt / 10, 0, 1);
    moonState.vis = moonVis; moonState.alt = moonAlt;
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
    gl.uniform1f(U(pSky, 'uMW'), lerp(s0.mw, s1.mw, st) * (1 - moonLight * 0.92) * (texMW ? 1 : 0));
    gl.uniform1f(U(pSky, 'uSeed'), (mwSeed = (mwSeed + 0.37) % 97));
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texMW); gl.uniform1i(U(pSky, 'uMWTex'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND);
    // stars — additive
    const limMag = lerp(s0.limMag, s1.limMag, st) - moonLight * 1.3;   // a full moon still leaves stars to about magnitude 5 high in the sky
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
      gl.uniform1f(U(pStars, 'uTime'), (now / 1000) % 1024);   // wrapped: the shimmer's sines keep their precision on a tab open for days
      gl.uniform1f(U(pStars, 'uDpr'), dpr); gl.uniform1f(U(pStars, 'uPx'), dpr);
      gl.uniform1f(U(pStars, 'uTwk'), motionOff() ? 0 : 0.55);
      gl.drawArrays(gl.POINTS, 0, nStars);
      gl.disableVertexAttribArray(aMag); gl.disableVertexAttribArray(aBv); gl.disableVertexAttribArray(aSeed);
    }

    // moon + halo (screen-space: rises behind the highest summit)
    const m = rangeMap();
    let moonR = (isClock ? clamp(W * 0.045, 44 * dpr, 92 * dpr) : Math.max(readingR, 0) * dpr) / W; // half-width as a fraction of width
    moonState.rect = null;
    if (texMoon && moonVis > 0.001 && peaks.length) {
      const col = moonSummit();
      const u = col / skyline.length, v = 1 - skyline[col] / rangeH;
      const px = (u - m.ox) / m.sx, py = (v - m.oy) / m.sy - (isClock ? scrollT * 0.03 : 0);   // 0..1 viewport, parallax included
      let rx = moonR, ry = moonR * aspect;
      const shortLand = aspect >= 0.8 && H / dpr < 500;   // landscape phones: keep the disc right of the centred contact text
      let cx = isClock ? (aspect < 0.8 ? 0.72 : shortLand ? 0.86 : clamp(px + rx * 0.15, 0.2, 0.86) + 0.05 * rise) : readingCx, cy = isClock ? py - ry * 0.75 + (moonAlt + 3) / 13 * ry * 4.2 : 0.78 + Math.min(0.03, idleSec * 5e-5);
      if (isClock) {
        // clear of the header band, and on portrait screens above the contact label: the disc shrinks to fit, or sets
        const vhCss = H / dpr, top = bandCss + 8, bottom = aspect < 0.8 ? labelDocTop - window.scrollY - 16 : vhCss;
        const rCss = ry * vhCss, fit = Math.min(rCss, (bottom - top) / 2);
        if (fit < 20) { rx = ry = 0; moonState.vis = 0; }
        else { const k = fit / rCss; rx *= k; ry *= k; cy = clamp(cy, 1 - bottom / vhCss + ry, 1 - top / vhCss - ry); }
      }
      { const vwCss = W / dpr, vhCss = H / dpr; moonState.rect = { left: (cx - rx) * vwCss, right: (cx + rx) * vwCss, top: (1 - cy - ry) * vhCss, bottom: (1 - cy + ry) * vhCss }; }
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(pSprite); bindUnit(pSprite);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texMoon); gl.uniform1i(U(pSprite, 'uTex'), 0);
      // halo
      gl.uniform4f(U(pSprite, 'uRect'), cx - rx * 8, cy - ry * 8, rx * 16, ry * 16);
      gl.uniform1f(U(pSprite, 'uHalo'), 1); gl.uniform3f(U(pSprite, 'uTint'), 0.55, 0.62, 0.85); gl.uniform1f(U(pSprite, 'uAlpha'), 0.30 * moonVis * night * clamp(moonAlt / 6, 0.2, 1));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      // a tight glow hugging the disc
      gl.uniform4f(U(pSprite, 'uRect'), cx - rx * 2.4, cy - ry * 2.4, rx * 4.8, ry * 4.8);
      gl.uniform1f(U(pSprite, 'uHalo'), 1); gl.uniform3f(U(pSprite, 'uTint'), 0.85, 0.88, 0.95); gl.uniform1f(U(pSprite, 'uAlpha'), 0.22 * moonVis * night);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      // disc — warm near the horizon, silver higher up
      const warm = 1 - clamp(moonAlt / 6, 0, 1);
      gl.uniform4f(U(pSprite, 'uRect'), cx - rx, cy - ry, rx * 2, ry * 2);
      gl.uniform1f(U(pSprite, 'uHalo'), 0); gl.uniform3f(U(pSprite, 'uTint'), lerp(0.96, 1.0, warm), lerp(0.99, 0.86, warm), lerp(1.04, 0.72, warm)); gl.uniform1f(U(pSprite, 'uAlpha'), moonVis);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    const fogRep = Math.min(1, aspect / 1.6);   // a cloud tile is never narrower than the viewport is tall
    // the range — relit
    if (texRange) {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(pRange); bindQuad(pRange);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texRange); gl.uniform1i(U(pRange, 'uTex'), 0);
      // parallax: the range settles very slightly as the evening passes
      gl.uniform4f(U(pRange, 'uMap'), m.sx, m.sy, m.ox, m.oy + scrollT * 0.03 * (isClock ? 1 : 0));
      gl.uniform2f(U(pRange, 'uSub'), sub[0], sub[1]);
      const t3 = (n: string, a: V3, b: V3) => { const v = mix3(a, b, rt); gl.uniform3f(U(pRange, n), v[0], v[1], v[2]); };
      gl.uniform1f(U(pRange, 'uExposure'), lerp(r0.exposure, r1.exposure, rt));
      gl.uniform1f(U(pRange, 'uSat'), lerp(r0.sat, r1.sat, rt));
      gl.uniform1f(U(pRange, 'uHiMix'), lerp(r0.hiMix, r1.hiMix, rt));
      gl.uniform1f(U(pRange, 'uLift'), lerp(r0.lift, r1.lift, rt));
      gl.uniform1f(U(pRange, 'uContrast'), lerp(r0.contrast, r1.contrast, rt));
      gl.uniform1f(U(pRange, 'uMoonLift'), moonLight * (isClock ? 0.5 : 0.15));   // reading pages: less moonlit snow behind long text
      t3('uTint', r0.tint, r1.tint); t3('uHiTint', r0.hiTint, r1.hiTint);
      // cloud shadows, while there is sun to cast them: cloud layer A's own shape and drift
      const shA = texFogA ? 0.44 * smooth(-2.5, 3, alt) * (motionOff() ? 0 : 1) * dbg.shadow : 0;
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texFogA || texRange); gl.uniform1i(U(pRange, 'uCloud'), 1);
      gl.uniform1f(U(pRange, 'uShA'), shA);
      gl.uniform1f(U(pRange, 'uShOff'), -idleSec * dbg.speed / 128);
      gl.uniform1f(U(pRange, 'uShRep'), 1.6 * fogRep);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.activeTexture(gl.TEXTURE0);
    }

    const bandBase = 1 / rangeMap().sy;             // plate height in viewport units
    // cloud strips — drift at prime periods; more present in twilight
    const fogK = (0.26 + 0.30 * smooth(6, -4, alt) * (1 - smooth(-9, -16, alt)) + 0.10 * night) * dbg.fog;
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
    // the cloud layers only ever cover their band (0.40–0.98 of the plate height): skip the rest of the frame
    gl.enable(gl.SCISSOR_TEST); gl.scissor(0, Math.max(0, Math.floor(H * bandBase * 0.40) - 2), W, Math.ceil(H * bandBase * 0.58) + 4);
    drawFog(texFogA, -idleSec * dbg.speed / 128, fogK, bandBase * 0.40, bandBase * 0.86, 1.6 * fogRep);   // both layers drift downwind, slowly
    drawFog(texFogB, -idleSec * dbg.speed / 260, fogK * 0.8, bandBase * 0.52, bandBase * 0.98, 1.1 * fogRep);
    gl.disable(gl.SCISSOR_TEST);

    // spindrift + satellite + meteor
    if (!motionOff()) {
      const wind = 0.7 + 0.3 * Math.sin(idleSec * 0.11);
      const drift = (0.35 + 0.65 * smooth(-8, 3, alt)) * dbg.drift; // backlit at golden hour
      emit(dt, drift, wind); let n = stepParts(dt, wind);
      // satellite: a slow point crossing the dark sky
      nextSat -= dt;
      if (!sat.on && nextSat < 0 && alt < -9) { sat = { on: true, x: -1.05, y: 0.2 + Math.random() * 0.6, vx: 0.05 + Math.random() * 0.03, vy: (Math.random() - 0.5) * 0.02, t: 0 }; nextSat = 70 + Math.random() * 90; }
      if (sat.on) { sat.x += sat.vx * dt; sat.y += sat.vy * dt; if (sat.x > 1.05) sat.on = false; else if (n < NP) { ptData[n * 4] = sat.x; ptData[n * 4 + 1] = sat.y; ptData[n * 4 + 2] = 2.2; ptData[n * 4 + 3] = 0.75 * night; n++; } }
      nextMeteor -= dt;
      if (!meteor.on && nextMeteor < 0 && alt < -14) { meteor = { on: true, x: -0.6 + Math.random() * 1.2, y: 0.3 + Math.random() * 0.6, dx: 0.9 + Math.random() * 0.6, dy: -(0.5 + Math.random() * 0.4), t: 0 }; nextMeteor = 60 + Math.random() * 120; }
      if (meteor.on) {
        meteor.t += dt; const life = meteor.t / 0.7;
        if (life > 1) meteor.on = false;
        else for (let i = 0; i < 64 && n < NP; i++) { const u = life - i * 0.004; if (u < 0) break; ptData[n * 4] = meteor.x + meteor.dx * u; ptData[n * 4 + 1] = meteor.y + meteor.dy * u; ptData[n * 4 + 2] = 3.0 - i * 0.025; ptData[n * 4 + 3] = (1 - life) * (1 - i / 64) * 0.5 * night; n++; }   // a continuous streak, not beads
      }
      if (n > 0) {
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(pPts);
        gl.bindBuffer(gl.ARRAY_BUFFER, ptBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, ptData.subarray(0, n * 4));
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
    // the graduated filters (see FS_GRADE): per-phase opacities as the CSS had them (.stage__grad × its ::after;
    // the rail from 1100px), eased over about a second like the CSS transitions; at once on the first frame
    {
      const ph = phaseOf(Math.round(alt * 10) / 10), vwCss = W / dpr, vhCss = H / dpr;
      const leftTarget = ph === 'golden' ? 1 : ph === 'sunset' || ph === 'civil' ? 0.765 : 0;
      const railTarget = vwCss < 1100 ? 0 : ph === 'golden' || ph === 'sunset' || ph === 'civil' ? 1 : ph === 'nautical' ? 0.5 : 0;
      const ease = motionOff() || !gradeInit ? 1 : 1 - Math.exp(-dt / 0.4);
      gradeInit = true;
      gradeLeft += (leftTarget - gradeLeft) * ease; gradeRail += (railTarget - gradeRail) * ease;
      if (gradeLeft > 0.002 || gradeRail > 0.002) {
        gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
        gl.useProgram(pGrade); bindQuad(pGrade);
        gl.uniform2f(U(pGrade, 'uView'), vwCss, vhCss);
        gl.uniform1f(U(pGrade, 'uLeftK'), gradeLeft);
        gl.uniform1f(U(pGrade, 'uRailK'), gradeRail);
        gl.uniform1f(U(pGrade, 'uRadial'), vwCss < 1100 || (vhCss <= 500 && vwCss > vhCss) ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }
    syncPhase(alt);
  }

  // ── loop ──
  let rafId = 0, lastNow = performance.now(), lastFrameTs = 0, scrollDirty = true, drawFailed = false;
  let lastScrollAt = performance.now(), lastDrawn = 0;
  function frame(now: number) {
    if (contextLost) { rafId = 0; return; }
    // resting: the sky wheels at 15°/hour — 30 fps is indistinguishable and halves the GPU cost
    if (now - lastScrollAt > 2000 && now - lastDrawn < 30 && !scrollDirty && !meteor.on) { rafId = requestAnimationFrame(frame); return; }   // a meteor gets every frame
    lastDrawn = now;
    lastFrameTs = now;
    const dt = clamp((now - lastNow) / 1000, 0, 0.05); lastNow = now;
    if (!motionOff()) idleSec += dt;
    if (scrollDirty) { readScroll(); scrollDirty = false; }
    sunAlt = motionOff() ? sunTarget : lerp(sunAlt, sunTarget, 1 - Math.pow(0.001, dt)); // ~settles in 1s
    try { draw(now, dt); } catch (e) { drawFailed = true; console.error('[sidereal] draw failed, showing the night still', e); fallBack(); rafId = 0; return; }
    // reduced motion: the world is a still — draw it once per change, then sleep
    if (motionOff() && Math.abs(sunAlt - sunTarget) < 0.01) { rafId = 0; return; }
    rafId = requestAnimationFrame(frame);
  }
  const wake = () => { if (!rafId && !document.hidden) { lastNow = performance.now(); rafId = requestAnimationFrame(frame); } };
  redraw = () => { scrollDirty = true; wake(); };
  // heartbeat for rAF-suspended contexts (occluded windows, embedded panes) — never while hidden
  const heartbeat = setInterval(() => {
    if (document.hidden || motionOff() || contextLost) return;
    const now = performance.now();
    if (now - lastFrameTs < 400) return;
    readScroll(); sunAlt = sunTarget;
    try { draw(now, 0.016); } catch (e) { drawFailed = true; console.error('[sidereal] draw failed, showing the night still', e); fallBack(); }
  }, 250);

  window.addEventListener('scroll', () => { scrollDirty = true; lastScrollAt = performance.now(); wake(); }, { passive: true });
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
  window.addEventListener('pagehide', () => { clearInterval(heartbeat); cancelAnimationFrame(rafId); rafId = 0; });
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
  // document y of an element's layout box, ignoring transforms: a block that has
  // not revealed yet is still shifted by its reveal offset, and measuring that
  // would land the anchor short once the reveal settles
  const layoutTop = (el: HTMLElement) => { let y = 0; for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) y += e.offsetTop; return y; };
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // new tab, new window, download: the browser's call
    const a = (e.target as Element).closest?.('a[href^="#"]') as HTMLAnchorElement | null;
    if (!a) return;
    const id = a.getAttribute('href')!.slice(1);
    const el = id ? document.getElementById(id) : document.body;
    if (!el) return;
    e.preventDefault(); history.pushState(null, '', `#${id}`);
    const headOffset = parseFloat(getComputedStyle(root).getPropertyValue('--head-offset')) || 110;
    // a chapter's negative scroll-margin (its own top padding) lands its first line, not its sky, under the header
    scrollToY(id === 'top' || id === '' ? 0 : layoutTop(el) - headOffset - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0));
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
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
    }, { threshold: 0, rootMargin: '0px 0px -40px 0px' });   // any block, however tall, shows as soon as it is on screen
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
  // test + tuning hook, only on the dev server or a page opened with ?qa=1:
  // window.__sidereal.sun = -12; window.__sidereal.dbg.fog = 3
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('qa')) {
    (window as any).__sidereal = {
      get sun() { return sunAlt; }, set sun(v: number) { sunTarget = v; sunAlt = v; wake(); },
      get idle() { return idleSec; }, set idle(v: number) { idleSec = v; wake(); }, get raf() { return rafId; }, get lastFrame() { return lastFrameTs; },
      get fov() { return { h: (2 * Math.atan(tanX) * 180) / Math.PI, v: (2 * Math.atan(tanY) * 180) / Math.PI }; },
      get moonVis() { return moonState.vis; }, get moonAlt() { return moonState.alt; }, get moonRect() { return moonState.rect; },
      resize, dbg,
      // orientation: equatorial degrees → horizon [north, east, up]; horizon → camera [right, up, forward]
      eqToHor(raDeg: number, decDeg: number, lstDeg: number) { const d = decDeg * DEG, a = raDeg * DEG, e = matrices(lstDeg * DEG).eq2hor, v = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]; return [0, 1, 2].map((r) => e[r] * v[0] + e[3 + r] * v[1] + e[6 + r] * v[2]); },
      horToCam(n: number, e: number, u: number) { const m = matrices(0).hor2cam; return [0, 1, 2].map((r) => m[r] * n + m[3 + r] * e + m[6 + r] * u); },
    };
  }
}
