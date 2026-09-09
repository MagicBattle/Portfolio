import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { STOPS, currentSeason, currentPhase, spriteGif, spritePng } from './data.js';
import { buildRegion } from './region.js';
import { loadAnimatedTexture } from './gif.js';
import { Music } from './audio.js';
import { createUI } from './ui.js';

const q = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const season = q.get('season') || currentSeason();
const phase = q.get('time') || currentPhase();
const N = STOPS.length;

// ---------- lighting per time of day
const PHASES = {
  morning: { bg: 0x1d1a33, sun: 0xffc39a, sunI: 2.4, sunPos: [-30, 14, 26], sky: 0xffd2b8, ground: 0x3a2c4a, hemiI: 1.0, night: 0.3, bloom: 0.42, label: 'MORNING' },
  day:     { bg: 0x0b1130, sun: 0xffffff, sunI: 3.0, sunPos: [18, 34, 22], sky: 0xcfe8ff, ground: 0x4c5d4a, hemiI: 1.2, night: 0.0, bloom: 0.25, label: 'DAY' },
  evening: { bg: 0x1a0d1d, sun: 0xff8f52, sunI: 2.2, sunPos: [34, 9, -14], sky: 0xffb08a, ground: 0x2b1a2f, hemiI: 0.9, night: 0.55, bloom: 0.5, label: 'EVENING' },
  night:   { bg: 0x05060f, sun: 0x96acff, sunI: 1.3, sunPos: [-22, 28, -14], sky: 0x34467c, ground: 0x0e1324, hemiI: 0.95, night: 1.0, bloom: 0.8, label: 'NIGHT' },
};
const ph = PHASES[phase] || PHASES.night;

// ---------- renderer / scene
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(ph.bg);
scene.fog = new THREE.FogExp2(ph.bg, 0.012);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 400);

const hemi = new THREE.HemisphereLight(ph.sky, ph.ground, ph.hemiI);
scene.add(hemi);
const sun = new THREE.DirectionalLight(ph.sun, ph.sunI);
sun.position.set(...ph.sunPos);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 });
sun.shadow.bias = -0.0008;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x6f86ff, 0.35); fill.position.set(-20, 10, -30); scene.add(fill);

// ---------- world
const region = buildRegion(season);
region.setNight(ph.night);
scene.add(region.group);

// ---------- stars + fireflies
function makeStars() {
  const n = 900, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const r = 180 + Math.random() * 60, a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1); pos.set([r * Math.sin(b) * Math.cos(a), Math.abs(r * Math.cos(b)) - 20, r * Math.sin(b) * Math.sin(a)], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, sizeAttenuation: true, transparent: true, opacity: 0.55 * (0.2 + 0.8 * ph.night), fog: false });
  const s = new THREE.Points(g, m); scene.add(s); return s;
}
makeStars();

const fireflies = (() => {
  const n = 420, pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 42; pos.set([Math.cos(a) * r, 0.4 + Math.random() * 9, Math.sin(a) * r], i * 3); seed[i] = Math.random() * 100; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0.25 + 0.75 * ph.night }, uColor: { value: new THREE.Color(0xd8ff7a) } },
    vertexShader: `attribute float seed; uniform float uTime; varying float vA;
      void main(){ vec3 p = position; p.x += sin(uTime*0.6+seed)*0.8; p.y += sin(uTime*0.9+seed*1.7)*0.5; p.z += cos(uTime*0.5+seed*0.6)*0.8;
        vA = 0.35 + 0.65*pow(0.5+0.5*sin(uTime*2.2+seed*3.1),3.0);
        vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = (9.0*vA+2.0) * (30.0/-mv.z); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying float vA;
      void main(){ float d = length(gl_PointCoord-0.5); if(d>0.5) discard; float a = smoothstep(0.5,0.05,d)*vA*uAlpha; gl_FragColor = vec4(uColor,a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, m); scene.add(pts); return pts;
})();

// ---------- post
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), ph.bloom, 0.5, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- camera rail
const camPts = STOPS.map(s => new THREE.Vector3(s.pos[0] + s.cam[0], s.cam[1] + (s.ground || 0), s.pos[1] + s.cam[2]));
const tgtPts = STOPS.map((s, i) => { const sp = region.spots[i]; return new THREE.Vector3(s.pos[0] * 0.45 + sp.x * 0.55, 1.3 + (s.ground || 0), s.pos[1] * 0.45 + sp.z * 0.55); });
const camCurve = new THREE.CatmullRomCurve3(camPts, false, 'centripetal', 0.5);
const tgtCurve = new THREE.CatmullRomCurve3(tgtPts, false, 'centripetal', 0.5);

let cur = 0, vel = 0;
const mouse = new THREE.Vector2(), mouseS = new THREE.Vector2();
addEventListener('pointermove', e => { mouse.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5); }, { passive: true });

// ---------- step travel: one gesture = one stop, eased flight in between
let stopIndex = 0;
let tween = null; // { from, to, t0, dur }
const easeInOut = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
function goTo(i, instant = false) {
  i = Math.max(0, Math.min(N - 1, i));
  if (i === stopIndex && !tween) return;
  stopIndex = i;
  const to = i / (N - 1);
  if (instant || reduced) { tween = null; cur = to; return; }
  const dist = Math.abs(to - cur) * (N - 1);
  tween = { from: cur, to, t0: performance.now(), dur: 900 + Math.min(dist, 3) * 450 };
}
function step(dir) {
  // accept the next step only once the current flight is mostly done, so gyms can't be skipped
  if (tween) { const p = (performance.now() - tween.t0) / tween.dur; if (p < 0.8) return; }
  goTo(stopIndex + dir);
}
let wheelAcc = 0, wheelLock = 0;
addEventListener('wheel', e => {
  e.preventDefault();
  const now = performance.now();
  if (now < wheelLock) return;
  wheelAcc += e.deltaY;
  if (Math.abs(wheelAcc) > 40) { step(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; wheelLock = now + 700; }
}, { passive: false });
let touchY = null;
addEventListener('touchstart', e => { touchY = e.touches[0].clientY; }, { passive: true });
addEventListener('touchmove', e => { if (touchY === null) return; const dy = touchY - e.touches[0].clientY; if (Math.abs(dy) > 50) { step(dy > 0 ? 1 : -1); touchY = null; } }, { passive: true });
addEventListener('touchend', () => { touchY = null; });
addEventListener('keydown', e => {
  if ((e.target && e.target.matches && e.target.matches('input,textarea')) || e.metaKey || e.ctrlKey) return;
  const k = e.key;
  if (['w', 'W', 'ArrowDown', 'ArrowRight', 'PageDown', ' ', 'a', 'A', 'Enter'].includes(k)) { e.preventDefault(); step(1); }
  else if (['s', 'S', 'ArrowUp', 'ArrowLeft', 'PageUp', 'b', 'B', 'Backspace'].includes(k)) { e.preventDefault(); step(-1); }
  else if (k === 'Home') goTo(0); else if (k === 'End') goTo(N - 1);
});
if (location.hash) { const i = STOPS.findIndex(s => '#' + s.id === location.hash); if (i > 0) goTo(i, true); }
let override = null;
function readScroll() {}

// ---------- Pokémon billboards
const music = new Music();
const ui = createUI({ stops: STOPS, music, goTo, season, phaseLabel: ph.label, night: ph.night });

const sprites = [];
const shadowGeo = new THREE.CircleGeometry(0.9, 16);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
STOPS.forEach((s, i) => {
  let id = s.mon;
  if (s.id === 'league' && ph.night < 0.55) { id = 644; s.monName = 'Zekrom'; }
  const sp = region.spots[i];
  const g0 = sp.y;
  const base = new THREE.Vector3(sp.x, g0, sp.z);
  const sh = new THREE.Mesh(shadowGeo, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.set(base.x, g0 + 0.06, base.z); scene.add(sh);
  const holder = { stop: s, base, mesh: null, tex: null, shadow: sh, phase: Math.random() * 6 };
  sprites.push(holder);
  loadAnimatedTexture(spriteGif(id), spritePng(id)).then(tex => {
    const h = s.kind === 'gym' ? 2.4 : s.kind === 'end' ? 4.4 : 3.2;
    const geo = new THREE.PlaneGeometry(h * tex.userData.aspect, h);
    const m = new THREE.MeshBasicMaterial({ map: tex, color: 0xe0e0e0, transparent: true, alphaTest: 0.05, depthWrite: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(base.x, g0 + h / 2 + 0.2, base.z); scene.add(mesh);
    holder.mesh = mesh; holder.tex = tex; holder.h = h;
  });
});

// ---------- stop detection
let atStop = -1;
function detectStop(dt) {
  const f = cur * (N - 1), i = Math.round(f), d = Math.abs(f - i);
  if (atStop === -1 && d < 0.1 && Math.abs(vel) < 0.35) { atStop = i; ui.enter(i); }
  else if (atStop !== -1 && (Math.abs(f - atStop) > 0.3)) { ui.leave(atStop); atStop = -1; }
}

// ---------- loop
const clock = new THREE.Clock();
let running = true, frames = 0;
document.addEventListener('visibilitychange', () => { if (q.has('debug')) return; running = !document.hidden; if (running) { clock.getDelta(); loop(); } });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

const tmpV = new THREE.Vector3(), camPos = new THREE.Vector3(), look = new THREE.Vector3();
const raf = q.has('debug') ? (f => setTimeout(f, 16)) : requestAnimationFrame;
function loop() {
  if (!running) return;
  raf(loop);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;

  const prev = cur;
  if (tween) { const p = Math.min(1, (performance.now() - tween.t0) / tween.dur); cur = tween.from + (tween.to - tween.from) * easeInOut(p); if (p >= 1) tween = null; }
  vel = (cur - prev) / Math.max(dt, 1e-4) * (N - 1);
  mouseS.lerp(mouse, 1 - Math.exp(-dt * 4));

  camCurve.getPoint(cur, camPos);
  tgtCurve.getPoint(cur, look);
  const frac = (cur * (N - 1)) % 1;
  camPos.y += Math.sin(frac * Math.PI) * 3.2;
  if (!reduced) { camPos.x += Math.sin(t * 0.25) * 0.25; camPos.y += Math.sin(t * 0.4) * 0.12; }
  const right = tmpV.subVectors(look, camPos).setY(0).normalize().cross(new THREE.Vector3(0, 1, 0));
  camPos.addScaledVector(right, mouseS.x * 1.2); camPos.y -= mouseS.y * 0.8;
  camera.position.copy(camPos);
  camera.lookAt(look);

  region.update(t, dt, cur);
  fireflies.material.uniforms.uTime.value = t;
  for (const s of sprites) {
    if (!s.mesh) continue;
    s.tex.userData.tick(dt * 1000);
    s.mesh.position.y = (s.stop.ground || 0) + s.h / 2 + 0.2 + Math.sin(t * 1.6 + s.phase) * 0.12;
    s.mesh.quaternion.copy(camera.quaternion);
    s.shadow.scale.setScalar(1 - Math.sin(t * 1.6 + s.phase) * 0.08);
  }
  detectStop(dt);
  ui.tick(cur, vel);
  composer.render();

  if (++frames === 2) { document.getElementById('loader').classList.add('done'); }
}
loop();

window.__dbg = { scene, camera, region, goTo, sprites, music, get cur() { return cur; }, jump(i) { goTo(i, true); } };
