// Procedural Unova diorama. Everything here is built from primitives; the only
// textures are generated on a canvas (skyscraper windows).
import * as THREE from 'three';
import { STOPS } from './data.js';

const P = (x, z) => new THREE.Vector2(x, -z); // shape space -> world after rotateX(-90°)

// Coastline, world XZ, roughly the Unova silhouette with the central bay.
const COAST = [
  [26, 26], [30, 14], [28, 0], [27, -12], [26, -24], [16, -29], [4, -27], [-8, -27],
  [-20, -21], [-27, -9], [-27, 4], [-21, 14], [-13, 17], [-11, 12], [-11, 7],
  [1, 7], [1, 14], [3, 24], [10, 25], [13, 18], [13, 13], [16, 12], [20, 16], [22, 26],
];

export const SEASONS = {
  spring: { grass: 0x6fbd58, grass2: 0x8fd36f, route: 0xd9c48a, pine: 0x2f8f57, round: [0xf3a8c8, 0xf7c4d9, 0x88c86a, 0xffb3d1], water: 0x2c6fb5, cliff: 0x6b5b45 },
  summer: { grass: 0x4ea84a, grass2: 0x67c25a, route: 0xd4bc7f, pine: 0x1f7a45, round: [0x2e8b57, 0x3fa065, 0x4fb872, 0x2b7d4b], water: 0x2478c9, cliff: 0x6e5a40 },
  autumn: { grass: 0xc9a04e, grass2: 0xd9b25c, route: 0xd7bf86, pine: 0x3a6f4a, round: [0xe07a2f, 0xd9542c, 0xf0b13a, 0xb8412a], water: 0x2a5f9e, cliff: 0x6b4d35 },
  winter: { grass: 0xe8eef5, grass2: 0xf4f7fb, route: 0xcfd6df, pine: 0x2f5e4a, round: [0xd8e3ec, 0xc7d5e2, 0xe6eef5, 0xbfd0e0], water: 0x3a6fa8, cliff: 0x5e5a5e },
};

function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const rand = mulberry32(2010);
const R = (a, b) => a + rand() * (b - a);

function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#20263a'; g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 128; y += 8) for (let x = 4; x < 64; x += 8) {
    const lit = rand() < 0.55;
    g.fillStyle = lit ? (rand() < 0.5 ? '#ffd27a' : '#ffe9b0') : '#0d1120';
    g.fillRect(x, y, 4, 5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildRegion(seasonKey) {
  const group = new THREE.Group();
  const pal = SEASONS[seasonKey];
  const anim = [];         // fn(t, dt)
  const glow = [];         // materials whose emissiveIntensity follows night
  const seasonal = [];     // fn(pal)

  // ---------- materials
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true, ...extra });
  const grassMat = mat(pal.grass);
  const cliffMat = mat(pal.cliff);
  const rockMat = mat(0x3d3548);
  const rockMat2 = mat(0x2a2536);
  const waterMat = new THREE.MeshStandardMaterial({ color: pal.water, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.92 });
  const routeMat = mat(pal.route);
  const wallMats = [0xf4efe2, 0xe9dcc4, 0xf1e6d0, 0xdfe7ee, 0xf6e3d3].map(c => mat(c));
  const roofMats = [0xc9503e, 0x3f6fb5, 0x5b8f4a, 0x8b5a9e, 0xd98a3a].map(c => mat(c));
  const winMat = new THREE.MeshStandardMaterial({ color: 0x3b2f22, emissive: 0xffd27a, emissiveIntensity: 0, roughness: 1 });
  glow.push({ m: winMat, max: 1.6 });
  seasonal.push(p => { grassMat.color.set(p.grass); cliffMat.color.set(p.cliff); waterMat.color.set(p.water); routeMat.color.set(p.route); });

  // ---------- island
  const coastCurve = new THREE.CatmullRomCurve3(COAST.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'catmullrom', 0.6);
  const coastPts = coastCurve.getPoints(220);
  const outlineXZ = coastPts.map(p => [p.x, p.z]);
  const centroid = coastPts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / coastPts.length);

  function plate(scale, depth, y, mats) {
    const shape = new THREE.Shape(coastPts.map(p => P(centroid.x + (p.x - centroid.x) * scale, centroid.z + (p.z - centroid.z) * scale)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    const m = new THREE.Mesh(geo, mats);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y - depth;
    m.receiveShadow = true; m.userData.terrain = true;
    group.add(m);
    return m;
  }
  plate(1, 1.2, 0, [grassMat, cliffMat]);            // land
  plate(1.13, 0.5, -0.55, [waterMat, waterMat]);      // sea
  plate(0.88, 5, -1.0, [rockMat, rockMat]);           // rock
  plate(0.62, 6, -5.5, [rockMat2, rockMat2]);         // taper
  plate(0.32, 5, -11, [rockMat2, rockMat2]);

  // bay water (inside the notch)
  const bay = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.3, 7.6), waterMat);
  bay.position.set(-5, -0.2, 10.6); bay.userData.terrain = true;
  group.add(bay);

  // ---------- routes (ribbon along the stops)
  const stopV = STOPS.map(s => new THREE.Vector3(s.pos[0], 0, s.pos[1]));
  const routeCurve = new THREE.CatmullRomCurve3(stopV, false, 'catmullrom', 0.4);
  const routePts = routeCurve.getPoints(320);
  {
    const w = 0.55, pos = [], idx = [];
    for (let i = 0; i < routePts.length; i++) {
      const p = routePts[i];
      const q = routePts[Math.min(i + 1, routePts.length - 1)];
      const tx = q.x - p.x, tz = q.z - p.z, l = Math.hypot(tx, tz) || 1;
      const nx = -tz / l * w, nz = tx / l * w;
      pos.push(p.x + nx, 0.04, p.z + nz, p.x - nx, 0.04, p.z - nz);
      if (i < routePts.length - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const routeMesh = new THREE.Mesh(g, routeMat); routeMesh.userData.terrain = true; group.add(routeMesh);
  }

  // ---------- building helpers
  const box = (w, h, d, m, x, y, z, parent = group) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; parent.add(b); return b; };
  function house(x, z, opts = {}) {
    const w = opts.w ?? R(0.9, 1.3), d = opts.d ?? R(0.9, 1.3), h = opts.h ?? R(0.7, 1.0);
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = opts.rot ?? R(-0.3, 0.3);
    box(w, h, d, opts.wall ?? wallMats[Math.floor(rand() * wallMats.length)], 0, h / 2, 0, g);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.7, 4), opts.roof ?? roofMats[Math.floor(rand() * roofMats.length)]);
    roof.position.y = h + h * 0.35; roof.rotation.y = Math.PI / 4; g.add(roof);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.26), winMat); win.position.set(w * 0.2, h * 0.5, d / 2 + 0.01); g.add(win);
    const win2 = win.clone(); win2.position.x = -w * 0.2; g.add(win2);
    group.add(g);
    return g;
  }
  const ringOf = (cx, cz, r, n, fn) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + R(-0.2, 0.2); fn(cx + Math.cos(a) * r, cz + Math.sin(a) * r, a); } };
  const at = id => STOPS.find(s => s.id === id).pos;

  // ---------- Nuvema Town: three houses and the lab
  { const [x, z] = at('nuvema');
    house(x - 1.8, z + 1.2); house(x + 0.4, z + 2); house(x + 2, z - 0.4);
    const lab = new THREE.Group(); lab.position.set(x - 1.2, 0, z - 1.8);
    box(2.2, 1.1, 1.6, wallMats[3], 0, 0.55, 0, lab); box(2.4, 0.15, 1.8, roofMats[1], 0, 1.15, 0, lab);
    box(0.06, 0.9, 0.06, mat(0x888), 0.7, 1.6, -0.4, lab);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xdddddd)); dish.position.set(0.7, 2.05, -0.4); dish.rotation.x = Math.PI; lab.add(dish);
    for (let i = -1; i <= 1; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), winMat); w.position.set(i * 0.6, 0.55, 0.81); lab.add(w); }
    group.add(lab); }

  // ---------- Accumula Town: houses on a hill
  { const [x, z] = at('accumula');
    const hill = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.8, 0.7, 12), grassMat); hill.position.set(x, 0.35, z); hill.userData.terrain = true; group.add(hill);
    ringOf(x, z, 1.9, 5, (hx, hz) => { const h = house(hx, hz, { w: 0.9, d: 0.9, h: 0.75 }); h.position.y = 0.7; }); }

  // ---------- Striaton City: round gym with a dome
  { const [x, z] = at('striaton');
    ringOf(x, z, 2.6, 6, (hx, hz) => house(hx, hz));
    const gym = new THREE.Group(); gym.position.set(x, 0, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 1, 12), wallMats[0]); base.position.y = 0.5; gym.add(base);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), roofMats[0]); dome.position.y = 1; gym.add(dome);
    group.add(gym); }

  // ---------- Nacrene City: warehouses and the museum
  { const [x, z] = at('nacrene');
    const brick = mat(0xb8654a), brick2 = mat(0xa3573f);
    for (let i = 0; i < 4; i++) { const b = box(2.4, 1, 1.1, i % 2 ? brick : brick2, x - 2.6 + (i % 2) * 2.8, 0.5, z + 1.6 + Math.floor(i / 2) * 1.5); box(2.5, 0.12, 1.2, mat(0x5b3a2e), b.position.x, 1.06, b.position.z); }
    const mus = new THREE.Group(); mus.position.set(x, 0, z - 1.6);
    box(2.6, 1.2, 1.6, wallMats[1], 0, 0.6, 0, mus);
    for (let i = -1.5; i <= 1.5; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.2, 6), wallMats[0]); c.position.set(i * 0.65, 0.6, 0.95); mus.add(c); }
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0, 1.6, 0.5, 3), roofMats[2]); ped.rotation.z = Math.PI / 2; ped.rotation.y = 0; ped.scale.set(1, 1, 0.6); ped.position.set(0, 1.45, 0.2); mus.add(ped);
    group.add(mus); }

  // ---------- Castelia City: skyscrapers with window grids
  { const [x, z] = at('castelia');
    const wt = windowTexture();
    const towers = [];
    const spec = [[0, 0, 5.2, 1.3], [1.6, 0.4, 4.2, 1.1], [-1.5, 0.6, 3.6, 1.0], [0.4, 1.9, 2.8, 1.0], [-1.2, -1.6, 3.1, 1.0], [1.9, -1.4, 2.4, 0.9], [-0.2, -2.9, 2.0, 0.9], [2.6, 1.9, 1.8, 0.8], [-2.8, -0.6, 2.2, 0.8], [-2.4, 1.9, 1.6, 0.8], [1.3, 3.2, 1.5, 0.8], [3.2, 0.2, 2.9, 0.9]];
    for (const [dx, dz, h, w] of spec) {
      const t = wt.clone(); t.needsUpdate = true; t.repeat.set(w * 2, h * 2);
      const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.6, metalness: 0.2 });
      glow.push({ m, max: 0.55 });
      const b = box(w, h, w, m, x + dx, h / 2, z + dz);
      towers.push(b);
      if (h > 4) { box(0.05, 1.2, 0.05, mat(0xcccccc), x + dx, h + 0.6, z + dz); const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshStandardMaterial({ color: 0xff4040, emissive: 0xff2020, emissiveIntensity: 2 })); tip.position.set(x + dx, h + 1.25, z + dz); group.add(tip); anim.push(t => { tip.material.emissiveIntensity = 1.5 + Math.sin(t * 4) * 1.5; }); }
    }
    // pier along the south edge
    box(4, 0.15, 0.8, mat(0x8a7a5a), x, 0.08, z + 6.2); }

  // ---------- Skyarrow Bridge: Nacrene shore -> Castelia peninsula across the bay
  {
    const A = new THREE.Vector3(-4.2, 0, 6.2), B = new THREE.Vector3(2.6, 0, 14.6);
    const dir = B.clone().sub(A); const L = dir.length(); dir.normalize();
    const deckY = 1.0, g = new THREE.Group();
    g.position.copy(A); g.rotation.y = Math.atan2(dir.x, dir.z);
    const white = mat(0xeeeeee), red = mat(0xd84040);
    box(1.1, 0.14, L, white, 0, deckY, L / 2, g);
    const rail = box(0.04, 0.2, L, red, 0.52, deckY + 0.17, L / 2, g); rail.clone(); const rail2 = rail.clone(); rail2.position.x = -0.52; g.add(rail2);
    const towerZ = [L * 0.3, L * 0.7], th = 3.6;
    const cableMat = mat(0xdddddd);
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff1c0, emissive: 0xffd27a, emissiveIntensity: 0 }); glow.push({ m: lightMat, max: 2.5 });
    for (const tz of towerZ) {
      for (const sx of [-0.62, 0.62]) box(0.2, th, 0.24, red, sx, th / 2, tz, g);
      box(1.5, 0.18, 0.2, red, 0, th - 0.4, tz, g); box(1.5, 0.18, 0.2, red, 0, th - 1.6, tz, g);
    }
    for (const sx of [-0.62, 0.62]) {
      const spans = [[0, towerZ[0], deckY + 0.3, th], [towerZ[0], towerZ[1], th, th], [towerZ[1], L, th, deckY + 0.3]];
      for (const [z0, z1, y0, y1] of spans) {
        const sag = (z0 === towerZ[0]) ? deckY + 0.9 : Math.min(y0, y1) - 0.1;
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(sx, y0, z0), new THREE.Vector3(sx, sag, (z0 + z1) / 2), new THREE.Vector3(sx, y1, z1));
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.03, 5), cableMat));
        const n = Math.floor((z1 - z0) / 0.7);
        for (let i = 1; i < n; i++) {
          const p = curve.getPoint(i / n);
          const hgt = p.y - deckY - 0.07; if (hgt < 0.15) continue;
          const hMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, hgt, 3), cableMat); hMesh.position.set(sx, deckY + 0.07 + hgt / 2, p.z); g.add(hMesh);
          if (i % 2 === 0) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 5), lightMat); l.position.copy(p); g.add(l); }
        }
      }
    }
    group.add(g);
  }

  // ---------- Nimbasa City: Ferris wheel, stadium, houses
  { const [x, z] = at('nimbasa');
    ringOf(x, z, 3.1, 7, (hx, hz) => house(hx, hz, { w: 0.9, d: 0.9, h: 0.8 }));
    const stadium = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.7, 14, 1, true), mat(0xf0e6d2)); stadium.position.set(x - 2.4, 0.35, z - 2.4); stadium.material.side = THREE.DoubleSide; group.add(stadium);
    const field = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.3, 14), mat(0x4caf50)); field.position.set(x - 2.4, 0.15, z - 2.4); group.add(field);
    const fl = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0 }); glow.push({ m: fl, max: 3 });
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; box(0.06, 1.8, 0.06, mat(0x999), x - 2.4 + Math.cos(a) * 1.8, 0.9, z - 2.4 + Math.sin(a) * 1.8); box(0.3, 0.14, 0.08, fl, x - 2.4 + Math.cos(a) * 1.8, 1.85, z - 2.4 + Math.sin(a) * 1.8); }

    const wheel = new THREE.Group(); wheel.position.set(x + 1.2, 2.6, z + 1.2); wheel.rotation.y = -0.6;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.07, 6, 40), mat(0xf5f5f5));
    const spinning = new THREE.Group(); spinning.add(ring);
    const spokeMat = mat(0xdddddd);
    for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 4.2, 0.05), spokeMat); s.rotation.z = i / 10 * Math.PI; spinning.add(s); }
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe3a0, emissive: 0xffb84d, emissiveIntensity: 0 }); glow.push({ m: bulbMat, max: 3 });
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 5), bulbMat); b.position.set(Math.cos(a) * 2.1, Math.sin(a) * 2.1, 0); spinning.add(b); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 8), mat(0x666)); hub.rotation.x = Math.PI / 2; spinning.add(hub);
    wheel.add(spinning);
    const cabinMats = [0xff5c5c, 0x5cb8ff, 0xffd95c, 0x7cff8a].map(c => mat(c));
    const cabins = [];
    for (let i = 0; i < 8; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), cabinMats[i % 4]); wheel.add(c); cabins.push(c); }
    for (const sx of [-0.35, 0.35]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.2, 0.1), mat(0xaaaaaa)); leg.position.set(0, -1.4, sx); leg.rotation.x = sx > 0 ? 0.42 : -0.42; wheel.add(leg); }
    group.add(wheel);
    anim.push((t) => { spinning.rotation.z = t * 0.25; cabins.forEach((c, i) => { const a = i / 8 * Math.PI * 2 + spinning.rotation.z; c.position.set(Math.cos(a) * 2.1, Math.sin(a) * 2.1 - 0.22, 0); }); }); }

  // ---------- Driftveil City: market, crane, drawbridge across the bay
  let bridgeLift = 0, bridgeTarget = 0;
  { const [x, z] = at('driftveil');
    ringOf(x, z, 2.6, 6, (hx, hz) => house(hx, hz));
    box(2.2, 0.9, 1.4, mat(0xd9b46a), x, 0.45, z - 0.2); box(2.4, 0.18, 1.6, roofMats[0], x, 0.98, z - 0.2);
    box(0.12, 3, 0.12, mat(0xe0a040), x + 2.8, 1.5, z + 2.6); box(2.6, 0.12, 0.12, mat(0xe0a040), x + 3.9, 3, z + 2.6); box(0.03, 1.4, 0.03, mat(0x333), x + 4.8, 2.3, z + 2.6); box(0.3, 0.3, 0.3, mat(0x4477aa), x + 4.8, 1.5, z + 2.6);
    const steel = mat(0x8a94a6), deck = mat(0x6b4f3a);
    const zB = 9.6, x0 = -11.2, x1 = 1.2, half = (x1 - x0) / 2;
    for (const [px, dirn] of [[x0, 1], [x1, -1]]) {
      box(0.5, 2.4, 1.2, steel, px, 1.2, zB);
      const piv = new THREE.Group(); piv.position.set(px + dirn * 0.25, 0.7, zB);
      const d = new THREE.Mesh(new THREE.BoxGeometry(half - 0.25, 0.14, 1.0), deck); d.position.x = dirn * (half - 0.25) / 2; piv.add(d);
      for (let i = 1; i < 6; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, 0.05), steel); r.position.set(dirn * i * (half - 0.25) / 6, 0.19, 0.48); piv.add(r); const r2 = r.clone(); r2.position.z = -0.48; piv.add(r2); }
      group.add(piv);
      anim.push(() => { piv.rotation.z = dirn * bridgeLift * 1.05; });
    }
  }

  // ---------- Chargestone Cave: mountain and floating crystals
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x8fe4ff, emissive: 0x3fc8ff, emissiveIntensity: 1.2, roughness: 0.3 });
  { const [x, z] = at('chargestone');
    const mtn = new THREE.Mesh(new THREE.ConeGeometry(4.2, 5.2, 7), mat(0x4a4660)); mtn.position.set(x - 1.5, 2.6, z - 2); group.add(mtn);
    const mtn2 = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.4, 6), mat(0x554f6c)); mtn2.position.set(x + 2.2, 1.7, z - 3); group.add(mtn2);
    const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.8, 8, 1, false, 0, Math.PI), mat(0x0a0a14)); mouth.rotation.z = Math.PI / 2; mouth.rotation.y = Math.PI / 2; mouth.position.set(x - 1.5, 0.4, z + 2.1); group.add(mouth);
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(R(0.15, 0.45)), crystalMat);
      const ox = x + R(-4, 4), oz = z + R(-3, 4), oy = R(0.4, 4.5), ph = R(0, 6);
      c.rotation.set(R(0, 3), R(0, 3), 0); group.add(c);
      anim.push(t => { c.position.set(ox, oy + Math.sin(t * 0.8 + ph) * 0.3, oz); c.rotation.y = t * 0.4 + ph; });
    }
  }
  // floating rocks in the void, Chargestone-style
  for (let i = 0; i < 26; i++) {
    const a = R(0, Math.PI * 2), r = R(34, 52), y = R(-9, 9), s = R(0.5, 2.4);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), i % 3 ? rockMat : rockMat2);
    rock.rotation.set(R(0, 3), R(0, 3), R(0, 3)); rock.userData.terrain = true;
    const ph = R(0, 6), cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    group.add(rock);
    if (i % 4 === 0) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(s * 0.3), crystalMat); c.position.y = s * 0.9; rock.add(c); }
    anim.push(t => { rock.position.set(cx, y + Math.sin(t * 0.3 + ph) * 0.8, cz); rock.rotation.y = t * 0.05 + ph; });
  }

  // ---------- Mistralton City: runway, hangar, circling plane
  { const [x, z] = at('mistralton');
    ringOf(x - 1, z + 1.5, 2.4, 5, (hx, hz) => house(hx, hz, { w: 0.9, d: 0.9, h: 0.75 }));
    box(9, 0.08, 1.6, mat(0x4a4d55), x, 0.05, z - 2.6);
    for (let i = -3.5; i <= 3.5; i++) box(0.5, 0.1, 0.12, mat(0xffffff), x + i, 0.06, z - 2.6);
    const hangar = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2, 12, 1, false, 0, Math.PI), mat(0xbfc7d1)); hangar.rotation.z = Math.PI / 2; hangar.rotation.y = 0; hangar.position.set(x - 3.4, 0, z - 0.6); group.add(hangar);
    const plane = new THREE.Group();
    box(1.2, 0.28, 0.28, mat(0xf4f4f4), 0, 0, 0, plane); box(0.35, 0.05, 1.6, mat(0xd84040), 0.05, 0, 0, plane); box(0.25, 0.32, 0.05, mat(0xd84040), -0.5, 0.2, 0, plane); box(0.25, 0.04, 0.5, mat(0xd84040), -0.5, 0.15, 0, plane);
    plane.userData.terrain = true; group.add(plane);
    anim.push(t => { const a = t * 0.35; const r = 6.5; plane.position.set(x + Math.cos(a) * r, 4.2 + Math.sin(t * 0.7) * 0.4, z - 1 + Math.sin(a) * r); plane.rotation.set(0, -a, 0.35); plane.rotation.y = -a; }); }

  // ---------- Icirrus City: marsh ponds, houses, Dragonspiral Tower
  { const [x, z] = at('icirrus');
    for (const [dx, dz, r] of [[2.2, 1.8, 1.3], [-2.6, 1.2, 1.0], [0.4, -2.6, 1.5]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.12, 12), waterMat); p.position.set(x + dx, 0.02, z + dz); p.userData.terrain = true; group.add(p); }
    ringOf(x, z, 1.7, 4, (hx, hz) => house(hx, hz, { w: 0.9, d: 0.9, h: 0.75 }));
    const tower = new THREE.Group(); tower.position.set(x - 3.2, 0, z - 4.2);
    const stone = mat(0x8d8a9c), stone2 = mat(0x6f6c80);
    for (let i = 0; i < 5; i++) { const r = 1.4 - i * 0.2; const seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.15, 1.1, 8), i % 2 ? stone : stone2); seg.position.set(Math.cos(i * 1.4) * 0.15, 0.55 + i * 1.1, Math.sin(i * 1.4) * 0.15); seg.rotation.y = i * 0.3; tower.add(seg); }
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1, 8), roofMats[1]); cap.position.y = 6; tower.add(cap);
    group.add(tower); }

  // ---------- Opelucid City (Black): dark glass with light bands
  { const [x, z] = at('opelucid');
    const glass = mat(0x1d2233); glass.roughness = 0.4; glass.metalness = 0.5;
    const band = new THREE.MeshStandardMaterial({ color: 0x9fdcff, emissive: 0x4fc3ff, emissiveIntensity: 0.6 }); glow.push({ m: band, max: 2.4, min: 0.6 });
    const spec = [[0, 0, 3.4, 1.4], [2, 0.6, 2.6, 1.1], [-1.8, -0.5, 2.2, 1.0], [0.5, 2.2, 1.8, 1.0], [-0.6, -2.4, 2.9, 1.1], [2.4, -1.8, 1.6, 0.9], [-2.6, 1.8, 1.4, 0.9]];
    for (const [dx, dz, h, w] of spec) { box(w, h, w, glass, x + dx, h / 2, z + dz); box(w + 0.04, 0.08, w + 0.04, band, x + dx, h - 0.25, z + dz); box(w + 0.04, 0.05, w + 0.04, band, x + dx, h * 0.45, z + dz); }
    // Tubeline-style bridge heading south-west
    const tb = new THREE.Group(); tb.position.set(x - 4.5, 0, z + 3.5); tb.rotation.y = 0.6;
    box(0.8, 0.12, 7, mat(0x555a66), 0, 0.9, 0, tb);
    for (let i = -3; i <= 3; i++) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 5, 12, Math.PI), band); hoop.position.set(0, 0.95, i); hoop.rotation.y = Math.PI / 2; tb.add(hoop); }
    group.add(tb); }

  // ---------- Pokémon League: mountain plateau and spires
  { const [x, z] = at('league');
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.6, 2.2, 10), mat(0x5c5670)); plat.position.set(x, 1.1, z); plat.userData.terrain = true; group.add(plat);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.15, 10), mat(0x9e97b3)); top.position.set(x, 2.25, z); top.userData.terrain = true; group.add(top);
    const spireMat = mat(0xe8e4f2), gold = new THREE.MeshStandardMaterial({ color: 0xffd85e, emissive: 0xffb400, emissiveIntensity: 1.2, roughness: 0.3 });
    const main = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 3.4, 8), spireMat); main.position.set(x, 4, z); group.add(main);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.2, 8), roofMats[3]); cone.position.set(x, 6.8, z); group.add(cone);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), gold); group.add(gem);
    anim.push(t => { gem.position.set(x, 8.3 + Math.sin(t * 1.5) * 0.15, z); gem.rotation.y = t; });
    ringOf(x, z, 2.5, 4, (sx, sz, a) => { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.8, 6), spireMat); s.position.set(sx, 3.2, sz); group.add(s); const c = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.9, 6), roofMats[3]); c.position.set(sx, 4.55, sz); group.add(c); });
    // Victory Road stairs
    for (let i = 0; i < 6; i++) box(1.4, 0.35, 0.9, mat(0x7a7390), x - 3.4 - i * 0.55, 0.18 + i * 0.35, z + 1.8 + i * 0.3); }



  // ---------- landmarks: the pieces that make each town read as its B/W self
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffd88a, emissiveIntensity: 0 }); glow.push({ m: lampMat, max: 2.2 });
  const postMat = mat(0x3a3f4a), plazaMat = mat(0xcfc6b4), stoneMat = mat(0xa8a39a), woodMat = mat(0x8a5a3a);
  seasonal.push(p => plazaMat.color.set(p.route === 0xcfd6df ? 0xdfe5ec : 0xcfc6b4));
  function lamp(x, z) { box(0.07, 1.3, 0.07, postMat, x, 0.65, z); const l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), lampMat); l.position.set(x, 1.35, z); group.add(l); }
  function plaza(x, z, r, y = 0) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.06, 20), plazaMat); m.position.set(x, y + 0.04, z); m.userData.terrain = true; group.add(m); }
  function fence(x0, z0, x1, z1, n) { for (let i = 0; i <= n; i++) { const t = i / n; box(0.06, 0.35, 0.06, mat(0xf0ece2), x0 + (x1 - x0) * t, 0.18, z0 + (z1 - z0) * t); } const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, L = Math.hypot(x1 - x0, z1 - z0); const rail = box(L, 0.04, 0.04, mat(0xf0ece2), cx, 0.3, cz); rail.rotation.y = -Math.atan2(z1 - z0, x1 - x0); }
  function signpost(x, z, rot) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; box(0.06, 0.7, 0.06, woodMat, 0, 0.35, 0, g); box(0.7, 0.3, 0.05, mat(0xd9b46a), 0, 0.75, 0, g); group.add(g); }
  function boat(x, z, rot, len = 2.4, hullC = 0xf4f4f4) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.25, len, 6, 1), mat(hullC)); hull.rotation.z = Math.PI / 2; hull.scale.set(1, 1, 0.7); hull.position.y = 0.15; g.add(hull);
    box(len * 0.4, 0.35, 0.5, mat(0x3f6fb5), -len * 0.05, 0.5, 0, g); box(0.14, 0.5, 0.14, mat(0xd84040), -len * 0.15, 0.9, 0, g);
    box(0.05, 0.8, 0.05, mat(0x333), len * 0.25, 0.7, 0, g);
    group.add(g); return g;
  }
  for (const s of STOPS) {
    if (s.kind === 'end' || s.id === 'chargestone') continue;
    const y = s.ground || 0;
    plaza(s.pos[0], s.pos[1], s.id === 'castelia' ? 1.6 : 2.0, y);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; lamp(s.pos[0] + Math.cos(a) * 1.7, s.pos[1] + Math.sin(a) * 1.7); }
    const dx = s.cam[0], dz = s.cam[2], l = Math.hypot(dx, dz);
    signpost(s.pos[0] + dx / l * 1.9 + dz / l * 0.9, s.pos[1] + dz / l * 1.9 - dx / l * 0.9, Math.atan2(dx, dz));
  }

  // Nuvema: picket fences, a dock into the sea, the player's two-storey house
  { const [x, z] = at('nuvema');
    fence(x - 3.2, z + 3.2, x + 1.5, z + 3.6, 7); fence(x + 3.4, z - 2.4, x + 3.6, z + 1.8, 6);
    box(0.7, 0.12, 3.2, woodMat, x + 4.4, 0.1, z + 3.6); for (let i = 0; i < 4; i++) box(0.1, 0.5, 0.1, woodMat, x + 4.1 + (i % 2) * 0.6, 0.1, z + 2.4 + Math.floor(i / 2) * 2.2);
    const h = house(x - 3.6, z + 0.6, { w: 1.3, d: 1.2, h: 1.5, wall: wallMats[0], roof: roofMats[0], rot: 0.2 }); }

  // Accumula: terraced hillside with stone stairs and the plaza where Team Plasma speaks
  { const [x, z] = at('accumula');
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.3, 0.4, 12), grassMat); t2.position.set(x - 1.2, 0.9, z - 1.2); t2.userData.terrain = true; group.add(t2);
    plaza(x - 1.2, z - 1.2, 1.5, 1.1);
    box(1.2, 0.25, 0.7, stoneMat, x - 1.2, 1.25, z - 1.9); box(0.08, 0.7, 0.08, mat(0x5b8f4a), x - 1.7, 1.7, z - 1.9); box(0.08, 0.7, 0.08, mat(0x5b8f4a), x - 0.7, 1.7, z - 1.9); box(1.1, 0.06, 0.06, mat(0x5b8f4a), x - 1.2, 2.05, z - 1.9);
    for (let i = 0; i < 4; i++) box(1.0, 0.18, 0.4, stoneMat, x + 2.3 + i * 0.35, 0.09 + i * 0.18, z + 2.6 - i * 0.35); }

  // Striaton: the restaurant gym with striped awning and café tables, Trainers' School, Dreamyard ruins
  { const [x, z] = at('striaton');
    const g = new THREE.Group(); g.position.set(x, 0, z + 3.4); g.rotation.y = 0.15;
    box(2.6, 1.0, 1.4, mat(0xf6ead6), 0, 0.5, 0, g); box(2.8, 0.2, 1.6, roofMats[0], 0, 1.1, 0, g);
    for (let i = -5; i <= 5; i++) box(0.24, 0.05, 0.6, i % 2 ? mat(0xd84040) : mat(0xffffff), i * 0.24, 0.98, 0.95, g);
    box(1.4, 0.35, 0.05, winMat, 0, 0.45, 0.71, g);
    for (const tx of [-1.0, 0, 1.0]) { const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 10), mat(0xffffff)); tb.position.set(tx, 0.4, 1.6); g.add(tb); box(0.04, 0.4, 0.04, postMat, tx, 0.2, 1.6, g); const par = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.2, 8), mat(0xd84040)); par.position.set(tx, 0.95, 1.6); g.add(par); box(0.03, 0.55, 0.03, postMat, tx, 0.65, 1.6, g); }
    group.add(g);
    const sch = new THREE.Group(); sch.position.set(x - 3.6, 0, z - 2.2);
    box(2.4, 1.3, 1.6, wallMats[3], 0, 0.65, 0, sch); box(2.6, 0.5, 1.8, roofMats[1], 0, 1.5, 0, sch);
    const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 12), mat(0xffffff)); clock.rotation.x = Math.PI / 2; clock.position.set(0, 1.35, 0.85); sch.add(clock);
    group.add(sch);
    for (let i = 0; i < 5; i++) { const px = x + 5.2 + (i % 3) * 0.9, pz = z - 3.6 - Math.floor(i / 3) * 1.1; const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, R(0.5, 1.2), 7), mat(0x8fa08a)); pil.position.set(px, 0.4, pz); pil.rotation.z = R(-0.15, 0.15); group.add(pil); }
    box(2.2, 0.5, 0.25, mat(0x8fa08a), x + 6.0, 0.25, z - 5.0); }

  // Nacrene: rail line with a freight car, Pinwheel Forest edge of tall dark pines
  { const [x, z] = at('nacrene');
    const rg = new THREE.Group(); rg.position.set(x, 0, z + 4.2); rg.rotation.y = 0.12;
    for (const off of [-0.22, 0.22]) box(9, 0.05, 0.06, mat(0x777), 0, 0.05, off, rg);
    for (let i = -18; i <= 18; i++) box(0.12, 0.04, 0.7, woodMat, i * 0.25, 0.03, 0, rg);
    box(1.6, 0.6, 0.55, mat(0x9a3f2f), 2.0, 0.42, 0, rg); box(1.2, 0.5, 0.5, mat(0x4a5a6a), 0.3, 0.37, 0, rg);
    group.add(rg);
    const pine = mat(0x1f4a3a);
    for (let i = 0; i < 14; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.4, 6), pine); t.position.set(x - 7.5 + R(-1.5, 1.5), 1.2, z + R(-4, 4)); group.add(t); } }

  // Castelia: plaza fountain, street grid, harbour with the ferry and a liner
  { const [x, z] = at('castelia');
    const f1 = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.25, 14), stoneMat); f1.position.set(x, 0.12, z - 3.4); group.add(f1);
    const fw = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.12, 14), waterMat); fw.position.set(x, 0.24, z - 3.4); group.add(fw);
    const f2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.6, 10), stoneMat); f2.position.set(x, 0.5, z - 3.4); group.add(f2);
    const spray = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), waterMat); group.add(spray);
    anim.push(t => { spray.position.set(x, 0.95 + Math.sin(t * 3) * 0.06, z - 3.4); spray.scale.setScalar(1 + Math.sin(t * 6) * 0.1); });
    const road = mat(0x3c3f48);
    for (const [rx, rz, w, d] of [[0, 0, 0.5, 8], [0, 0, 8, 0.5], [2.6, 0, 0.5, 6], [-2.4, 0, 0.5, 6]]) { const r = box(w, 0.03, d, road, x + rx, 0.05, z + rz); r.userData.terrain = true; }
    boat(x + 1.5, z + 7.4, 0.2, 3.2, 0xffffff); boat(x - 2.4, z + 7.0, -0.3, 1.8, 0xf0d060);
    for (let i = 0; i < 3; i++) lamp(x - 1.6 + i * 1.6, z + 5.8); }

  // Nimbasa: Musical Theater with marquee, Battle Subway entrance, roller-coaster loop, Gear Station tracks
  { const [x, z] = at('nimbasa');
    const th = new THREE.Group(); th.position.set(x - 1.8, 0, z + 3.6); th.rotation.y = -0.2;
    box(3.2, 1.4, 1.8, mat(0xf3d7e8), 0, 0.7, 0, th); box(3.4, 0.3, 2.0, mat(0xb84a8a), 0, 1.55, 0, th);
    const mq = new THREE.MeshStandardMaterial({ color: 0xffd6ee, emissive: 0xff7ac8, emissiveIntensity: 0.4 }); glow.push({ m: mq, max: 2.0, min: 0.4 });
    box(2.6, 0.35, 0.1, mq, 0, 1.2, 0.95, th);
    for (let i = -2; i <= 2; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.4, 8), mat(0xffffff)); c.position.set(i * 0.7, 0.7, 1.0); th.add(c); }
    box(3.6, 0.1, 0.6, mat(0xb84a8a), 0, 1.4, 1.2, th);
    group.add(th);
    const sub = new THREE.Group(); sub.position.set(x + 3.4, 0, z - 3.6); sub.rotation.y = 0.4;
    box(1.6, 0.9, 1.0, mat(0x5b6f9e), 0, 0.45, 0, sub); box(1.8, 0.15, 1.2, mat(0x2d3a5e), 0, 0.95, 0, sub); box(0.6, 0.55, 0.05, winMat, 0, 0.3, 0.51, sub);
    const sm = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x7ad7ff, emissiveIntensity: 0.5 }); glow.push({ m: sm, max: 2.2, min: 0.5 }); box(1.0, 0.18, 0.06, sm, 0, 0.78, 0.53, sub);
    group.add(sub);
    for (const off of [-0.18, 0.18]) { const rail = box(6, 0.04, 0.05, mat(0x777), x + 5.6, 0.05, z - 3.6 + off); rail.rotation.y = 0.4; }
    const coaster = new THREE.Group(); coaster.position.set(x + 4.6, 0, z + 2.6);
    const loop = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 6, 24), mat(0xffb84d)); loop.position.y = 1.2; coaster.add(loop);
    for (const [cx, cy] of [[-0.8, 0.6], [0.8, 0.6], [0, 1.2]]) box(0.07, cy * 2, 0.07, mat(0xffb84d), cx, cy, 0.3, coaster);
    box(4.5, 0.08, 0.5, mat(0xffb84d), 0, 0.42, 0.9, coaster);
    const car = box(0.5, 0.25, 0.3, mat(0xff5c5c), 0, 0, 0, coaster);
    anim.push(t => { const a = (t * 1.4) % (Math.PI * 2); car.position.set(Math.cos(a) * 1.1, 1.2 + Math.sin(a) * 1.1, 0); car.rotation.z = a + Math.PI / 2; });
    group.add(coaster); }

  // Driftveil: container port, cargo ship at the quay, Cold Storage, the market awning
  { const [x, z] = at('driftveil');
    const cols = [0xe0453a, 0x3b7dd8, 0xf0b13a, 0x3ddc84, 0xffffff];
    for (let i = 0; i < 12; i++) { const cx = x + 1.6 + (i % 4) * 0.95, cz = z + 3.6 + Math.floor(i / 4) * 0.7; box(0.85, 0.45, 0.55, mat(cols[i % 5]), cx, 0.23, cz); if (i % 3 === 0) box(0.85, 0.45, 0.55, mat(cols[(i + 2) % 5]), cx, 0.7, cz); }
    box(6, 0.12, 1.4, mat(0x6e6a66), x + 2.8, 0.06, z + 5.4);
    boat(x + 3.4, z + 7.2, 0.05, 4.2, 0x8a3a2a);
    const cs = new THREE.Group(); cs.position.set(x - 3.8, 0, z - 2.8);
    box(3.0, 1.4, 1.8, mat(0xc9d2dc), 0, 0.7, 0, cs); box(3.1, 0.25, 1.9, mat(0x3b7dd8), 0, 0.95, 0, cs); box(3.2, 0.12, 2.0, mat(0x8fa0b4), 0, 1.45, 0, cs);
    group.add(cs);
    for (let i = -3; i <= 3; i++) box(0.3, 0.05, 0.5, i % 2 ? mat(0xe0453a) : mat(0xffffff), x + i * 0.3, 0.92, z + 0.7); }

  // Mistralton: the cargo-plane gym parked on the apron, Celestial Tower, windsock
  { const [x, z] = at('mistralton');
    const cp = new THREE.Group(); cp.position.set(x + 3.6, 0, z - 4.4); cp.rotation.y = 0.3;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 3.6, 10), mat(0xf4f4f4)); body.rotation.z = Math.PI / 2; body.position.y = 0.55; cp.add(body);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), mat(0xf4f4f4)); nose.position.set(1.8, 0.55, 0); cp.add(nose);
    box(0.9, 0.08, 4.6, mat(0xd84040), 0.1, 0.6, 0, cp); box(0.5, 0.8, 0.08, mat(0xd84040), -1.7, 1.1, 0, cp); box(0.4, 0.06, 1.6, mat(0xd84040), -1.7, 0.9, 0, cp);
    for (const wz of [-1.4, 1.4]) { const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.6, 8), mat(0x555)); eng.rotation.z = Math.PI / 2; eng.position.set(0.3, 0.45, wz); cp.add(eng); }
    for (const [gx, gz] of [[1.2, 0], [-0.4, -0.5], [-0.4, 0.5]]) { const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 8), mat(0x222)); wheel.rotation.x = Math.PI / 2; wheel.position.set(gx, 0.1, gz); cp.add(wheel); }
    group.add(cp);
    const ct = new THREE.Group(); ct.position.set(x + 5.2, 0, z + 3.2);
    for (let i = 0; i < 4; i++) { const r = 0.9 - i * 0.15; const seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.1, 1.3, 8), i % 2 ? wallMats[1] : wallMats[0]); seg.position.y = 0.65 + i * 1.3; ct.add(seg); const ledge = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.25, r + 0.25, 0.1, 8), roofMats[1]); ledge.position.y = 1.3 + i * 1.3; ct.add(ledge); }
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.9, 8), roofMats[1]); cap.position.y = 5.65; ct.add(cap);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffd85e, metalness: 0.6, roughness: 0.3 })); bell.position.y = 5.0; ct.add(bell);
    group.add(ct);
    box(0.04, 1.2, 0.04, postMat, x - 4.6, 0.6, z - 3.6); const sock = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 6), mat(0xff7a2a)); sock.rotation.z = -Math.PI / 2; sock.position.set(x - 4.25, 1.2, z - 3.6); group.add(sock); }

  // Icirrus: the ice gym with frozen slides, marsh reeds, the Moor boardwalk
  { const [x, z] = at('icirrus');
    const ice = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9 });
    const ig = new THREE.Group(); ig.position.set(x + 3.8, 0, z - 2.6); ig.rotation.y = -0.3;
    box(2.4, 1.2, 1.8, mat(0xe6f3fb), 0, 0.6, 0, ig); box(2.6, 0.4, 2.0, mat(0x6fb3e8), 0, 1.4, 0, ig);
    for (let i = 0; i < 5; i++) { const spike = new THREE.Mesh(new THREE.ConeGeometry(R(0.15, 0.3), R(0.5, 1.1), 6), ice); spike.position.set(R(-1, 1), 1.6, R(-0.7, 0.7)); spike.rotation.set(R(-0.2, 0.2), 0, R(-0.2, 0.2)); ig.add(spike); }
    const slide = box(0.5, 0.06, 2.4, ice, 1.6, 0.9, 0.6, ig); slide.rotation.x = 0.5;
    group.add(ig);
    const reed = mat(0x6a8a3a);
    for (const [dx, dz, r] of [[2.2, 1.8, 1.3], [-2.6, 1.2, 1.0], [0.4, -2.6, 1.5]]) for (let i = 0; i < 9; i++) { const a = R(0, 6.3), rr = r + R(-0.1, 0.35); box(0.04, R(0.3, 0.6), 0.04, reed, x + dx + Math.cos(a) * rr, 0.25, z + dz + Math.sin(a) * rr); }
    for (let i = 0; i < 6; i++) box(0.5, 0.06, 0.9, woodMat, x + 2.2 + Math.cos(i * 0.5) * 0.3, 0.12, z + 0.4 + i * 0.85); }

  // Opelucid (Black): Drayden's dragon-spire gym and holographic billboards
  { const [x, z] = at('opelucid');
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.6, 5), mat(0x2a3050)); spire.position.set(x - 3.2, 2.3, z - 3.2); group.add(spire);
    const holo = new THREE.MeshStandardMaterial({ color: 0x4fc3ff, emissive: 0x4fc3ff, emissiveIntensity: 0.5, transparent: true, opacity: 0.55, side: THREE.DoubleSide }); glow.push({ m: holo, max: 1.8, min: 0.5 });
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; const h = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), holo); h.position.set(x - 3.2 + Math.cos(a) * 1.3, 3.2 + (i % 2) * 0.5, z - 3.2 + Math.sin(a) * 1.3); h.rotation.y = -a + Math.PI / 2; group.add(h); anim.push(t => { h.position.y = 3.2 + (i % 2) * 0.5 + Math.sin(t * 1.3 + i) * 0.12; }); }
    for (let i = 0; i < 3; i++) { const fin = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.0, 4), mat(0x4fc3ff)); fin.position.set(x - 3.2 + Math.cos(i * 2.1) * 0.7, 1.4 + i * 0.9, z - 3.2 + Math.sin(i * 2.1) * 0.7); fin.rotation.z = Math.cos(i * 2.1) * 0.9; fin.rotation.x = Math.sin(i * 2.1) * 0.9; group.add(fin); }
    const bb = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.7), holo); bb.position.set(x + 3.4, 2.4, z + 2.4); bb.rotation.y = -0.6; group.add(bb); }

  // ---------- Pokémon Center + Poké Mart in every gym town
  const occupied = [];
  function scanOccupancy() {
    occupied.length = 0;
    const b = new THREE.Box3(), c = new THREE.Vector3(), sz = new THREE.Vector3();
    group.updateMatrixWorld(true);
    group.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.terrain) return;
      let p = o; let skip = false; while (p && p !== group) { if (p.userData.terrain) skip = true; p = p.parent; }
      if (skip) return;
      b.setFromObject(o); if (b.isEmpty()) return; b.getCenter(c); b.getSize(sz);
      if (c.y > 6 || Math.hypot(c.x, c.z) > 36) return;
      occupied.push({ x: c.x, z: c.z, r: Math.max(sz.x, sz.z) / 2 });
    });
  }
  function findFree(cx, cz, dx, dz, rad, dmin, dmax, extra = [], angleFirst = false) {
    const baseA = Math.atan2(dz, dx);
    const angles = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.9, -1.9, 2.4, -2.4, Math.PI];
    const dists = []; for (let d = dmin; d <= dmax; d += 0.35) dists.push(d);
    const order = [];
    if (angleFirst) { for (const da of angles) for (const d of dists) order.push([d, da]); }
    else { for (const d of dists) for (const da of angles) order.push([d, da]); }
    for (const [d, da] of order) {
      {
        const a = baseA + da, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (!pointInPoly(x, z, outlineXZ)) continue;
        if (x > -12 && x < 2 && z > 6 && z < 15) continue;
        if (occupied.some(o => Math.hypot(o.x - x, o.z - z) < o.r + rad)) continue;
        if (extra.some(o => Math.hypot(o.x - x, o.z - z) < o.r + rad)) continue;
        return { x, z };
      }
    }
    return { x: cx + dx * dmax, z: cz + dz * dmax };
  }
  scanOccupancy();
  const centerWall = mat(0xf7f2e8), centerRoof = mat(0xe0453a), martRoof = mat(0x3b7dd8), signMat = mat(0xffffff);
  const ballRed = mat(0xe3350d), ballWhite = mat(0xf4f4f4), ballBand = mat(0x222222);
  function pokeCenter(x, z, rot) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
    box(2.2, 1.0, 1.5, centerWall, 0, 0.5, 0, g);
    box(2.4, 0.5, 1.7, centerRoof, 0, 1.2, 0, g);
    box(0.9, 0.45, 0.06, winMat, 0, 0.42, 0.76, g);
    const ball = new THREE.Group(); ball.position.set(0, 1.85, 0);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), ballRed); ball.add(top);
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), ballWhite); ball.add(bot);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.08, 16), ballBand); ball.add(band);
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), ballWhite); btn.rotation.x = Math.PI / 2; btn.position.z = 0.36; ball.add(btn);
    g.add(ball); group.add(g);
    anim.push(t => { ball.rotation.y = t * 0.6; });
    occupied.push({ x, z, r: 1.4 });
  }
  function pokeMart(x, z, rot) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
    box(1.8, 0.9, 1.3, centerWall, 0, 0.45, 0, g);
    box(2.0, 0.35, 1.5, martRoof, 0, 1.05, 0, g);
    box(0.7, 0.4, 0.06, winMat, -0.3, 0.42, 0.66, g);
    box(0.6, 0.3, 0.05, signMat, 0.5, 0.75, 0.67, g);
    box(0.5, 0.2, 0.06, martRoof, 0.5, 0.75, 0.68, g);
    group.add(g);
    occupied.push({ x, z, r: 1.2 });
  }
  for (const s of STOPS) {
    if (s.kind !== 'gym' || s.id === 'chargestone') continue;
    const dx = -s.cam[0], dz = -s.cam[2], l = Math.hypot(dx, dz);
    const rot = Math.atan2(s.cam[0], s.cam[2]);
    const c = findFree(s.pos[0], s.pos[1], -dx / l, -dz / l, 1.5, 3.0, 7);
    pokeCenter(c.x, c.z, rot);
    const m = findFree(s.pos[0], s.pos[1], -dz / l, dx / l, 1.3, 3.0, 7);
    pokeMart(m.x, m.z, rot);
  }

  // ---------- battle spots: a clear pad in front of each town for its Pokémon
  const padMat = mat(0xd9c48a); seasonal.push(p => padMat.color.set(p.route));
  const spots = STOPS.map(s => {
    const dx = s.cam[0], dz = s.cam[2], l = Math.hypot(dx, dz);
    let sp;
    if (s.kind === 'end') sp = findFree(s.pos[0], s.pos[1], dx / l, dz / l, 0.9, 1.0, 2.4);
    else sp = findFree(s.pos[0], s.pos[1], dx / l, dz / l, 1.5, 2.2, 5.2, [], true);
    const y = s.ground || 0;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.45, 0.08, 18), padMat); pad.position.set(sp.x, y + 0.03, sp.z); pad.userData.terrain = true; group.add(pad);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.05, 6, 24), mat(0xffffff)); rim.rotation.x = Math.PI / 2; rim.position.set(sp.x, y + 0.08, sp.z); rim.userData.terrain = true; group.add(rim);
    return { x: sp.x, y, z: sp.z };
  });
  // ---------- trees (instanced)
  {
    const pineGeo = new THREE.ConeGeometry(0.42, 1.3, 5);
    const roundGeo = new THREE.IcosahedronGeometry(0.5, 0);
    const trunkGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.5, 5);
    const pineMat = mat(pal.pine), roundMat = mat(0xffffff), trunkMat = mat(0x5a3d2b);
    const spots = [];
    let tries = 0;
    while (spots.length < 520 && tries++ < 6000) {
      const x = R(-28, 31), z = R(-30, 27);
      if (!pointInPoly(x, z, outlineXZ)) continue;
      if (STOPS.some(s => Math.hypot(s.pos[0] - x, s.pos[1] - z) < 3.6)) continue;
      if (occupied.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 0.6)) continue;
      if (spots.some(o => Math.hypot(o.x - x, o.z - z) < 2.4)) continue;
      if (x > -12 && x < 2 && z > 6 && z < 15) continue;                       // bay
      let nearRoute = false;
      for (let i = 0; i < routePts.length; i += 2) { if (Math.hypot(routePts[i].x - x, routePts[i].z - z) < 1.1) { nearRoute = true; break; } }
      if (nearRoute) continue;
      spots.push({ x, z, s: R(0.7, 1.4), pine: rand() < (z < -8 ? 0.7 : 0.4), c: Math.floor(rand() * 4) });
    }
    const pines = spots.filter(s => s.pine), rounds = spots.filter(s => !s.pine);
    const pineMesh = new THREE.InstancedMesh(pineGeo, pineMat, pines.length);
    const roundMesh = new THREE.InstancedMesh(roundGeo, roundMat, rounds.length);
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), T = new THREE.Vector3();
    pines.forEach((s, i) => { M.compose(T.set(s.x, 0.25 + 0.65 * s.s, s.z), Q, S.set(s.s, s.s, s.s)); pineMesh.setMatrixAt(i, M); });
    rounds.forEach((s, i) => { M.compose(T.set(s.x, 0.3 + 0.5 * s.s, s.z), Q.setFromEuler(new THREE.Euler(R(0, 1), R(0, 3), 0)), S.set(s.s, s.s * 0.9, s.s)); roundMesh.setMatrixAt(i, M); });
    spots.forEach((s, i) => { M.compose(T.set(s.x, 0.2, s.z), Q.identity(), S.set(1, 1, 1)); trunkMesh.setMatrixAt(i, M); });
    const colorRounds = p => { const C = new THREE.Color(); rounds.forEach((s, i) => roundMesh.setColorAt(i, C.set(p.round[s.c]))); roundMesh.instanceColor.needsUpdate = true; pineMat.color.set(p.pine); };
    colorRounds(pal);
    seasonal.push(colorRounds);
    group.add(pineMesh, roundMesh, trunkMesh);
  }


  // ---------- API
  const driftveilIndex = STOPS.findIndex(s => s.id === 'driftveil');
  const stopCount = STOPS.length;
  function update(t, dt, progress) {
    // bridge lifts when the camera is nearby
    const d = Math.abs(progress * (stopCount - 1) - driftveilIndex);
    bridgeTarget = d < 0.7 ? 1 : 0;
    bridgeLift += (bridgeTarget - bridgeLift) * Math.min(1, dt * 1.6);
    for (const f of anim) f(t, dt);
  }
  function setNight(n) { for (const g of glow) g.m.emissiveIntensity = (g.min ?? 0) + ((g.max - (g.min ?? 0)) * n); }
  function setSeason(key) { const p = SEASONS[key]; for (const f of seasonal) f(p); }

  return { group, update, setNight, setSeason, stopPositions: stopV, spots };
}
