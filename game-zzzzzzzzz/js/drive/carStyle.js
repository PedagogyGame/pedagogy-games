/** logic29 (Ben 6:36 PM "make the cars overall nicer"): 2100s RC vehicles — bevelled/rounded panels, tinted
 *  reflective glass, clear-coat metallic deep paints, real wheels (tyre, sidewall, rim dish, 5 spokes, hub, cyan
 *  centre cap) on steer pivots, glowing head/tail lights, cyan neon sill trim + underglow, panel seams.
 *  Model units: the car root is scaled by CAR_SCALE; nose toward −Z inside bodyPivot (rotated π).
 *  Every visual stays inside the old box footprint (|x| ≤ 0.165, |z| ≤ 0.235) — well inside the collider. */
import * as THREE from "three";

export const PAINTS = {
  car: { body: 0x8e1526, name: "deep crimson" },
  suv: { body: 0x18295e, name: "midnight blue" },
  jeep: { body: 0x464e58, name: "gunmetal" },
  convertible: { body: 0x9a5530, name: "copper" },
};

/** rounded box: BoxGeometry with every vertex pushed onto an r-radius shell around the inner box (true normals) */
export function rbox(w, h, d, r, seg = 3, opt = {}) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const p = g.attributes.position, n = g.attributes.normal;
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  const v = new THREE.Vector3(), c = new THREE.Vector3(), dl = new THREE.Vector3();
  const taper = opt.taper || 0, drop = opt.drop || 0, rake = opt.rake || 0;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(THREE.MathUtils.clamp(v.x, -hx, hx), THREE.MathUtils.clamp(v.y, -hy, hy), THREE.MathUtils.clamp(v.z, -hz, hz));
    dl.subVectors(v, c);
    if (dl.lengthSq() > 1e-14) { dl.normalize(); v.copy(c).addScaledVector(dl, r); n.setXYZ(i, dl.x, dl.y, dl.z); }
    const t = (v.y + h / 2) / h; // 0 bottom → 1 top
    if (taper) v.x *= 1 - taper * t;                          // tumblehome: narrower at the top
    if (drop) v.y -= drop * t * Math.max(0, -v.z / (d / 2)) ** 2; // nose slopes down
    if (rake) v.z += rake * (t - 0.5) * Math.sign(v.z || 1) * -1; // raked glass: top shorter than the base
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

export function vehicleMats(preset) {
  const paint = PAINTS[preset.id] || PAINTS.car;
  const P = THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial;
  const candy = new P({ color: paint.body, metalness: 0.45, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const accent = new P({ color: 0x1b1f26, metalness: 0.6, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 }); // satin black trim
  const glass = new P({ color: 0x0c1a24, metalness: 0.35, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03,
    emissive: 0x0b3c4a, emissiveIntensity: 0.35, transparent: true, opacity: 0.82 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.7, metalness: 0.25 });
  const seam = new THREE.MeshStandardMaterial({ color: 0x06070a, roughness: 0.9, metalness: 0.1 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb8c4cf, roughness: 0.18, metalness: 0.95 });
  const gun = new THREE.MeshStandardMaterial({ color: 0x5b6470, roughness: 0.28, metalness: 0.9 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x131315, roughness: 0.93, metalness: 0.02 });
  const side = new THREE.MeshStandardMaterial({ color: 0x1f2024, roughness: 0.85, metalness: 0.05 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xeaf6ff, emissive: 0xcfeeff, emissiveIntensity: 0.85, roughness: 0.15, metalness: 0.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x6a0010, emissive: 0xff1f3d, emissiveIntensity: 0.55, roughness: 0.3 });
  const neon = new THREE.MeshBasicMaterial({ color: 0x3fe0f0 });
  const headGlow = new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const tailGlow = new THREE.MeshBasicMaterial({ color: 0xff2a48, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
  const underglow = new THREE.MeshStandardMaterial({ color: 0x3fe0f0, emissive: 0x3fe0f0, emissiveIntensity: 0.28, transparent: true, opacity: 0.3, roughness: 0.6, depthWrite: false });
  return { candy, accent, glass, dark, seam, chrome, gun, rubber, side, headMat, tailMat, neon, headGlow, tailGlow, underglow, cream: accent, hubMat: gun };
}

const M = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = false; return m; };

/** wheels: steer pivot (front, +Z in root) → spinner (rotation.x) → tyre/sidewall/rim/spokes/hub */
export function addWheels(car, m, layout, tireR, tireW) {
  const tyre = new THREE.CylinderGeometry(tireR, tireR, tireW, 22);
  const wall = new THREE.CylinderGeometry(tireR * 0.86, tireR * 0.86, tireW + 0.004, 22);
  const dish = new THREE.CylinderGeometry(tireR * 0.66, tireR * 0.6, tireW + 0.006, 18);
  const hub = new THREE.CylinderGeometry(tireR * 0.2, tireR * 0.2, tireW + 0.008, 10);
  const cap = new THREE.CylinderGeometry(tireR * 0.09, tireR * 0.09, tireW + 0.01, 8);
  const spoke = new THREE.BoxGeometry(tireW + 0.009, tireR * 0.5, tireR * 0.12);
  car._steerWheels = []; car._wheelRoots = car._wheelRoots || [];
  for (const [x, z] of layout) {
    const steer = new THREE.Group(); steer.position.set(x, tireR, z);
    const spin = new THREE.Group(); steer.add(spin);
    for (const [g, mat] of [[tyre, m.rubber], [wall, m.side], [dish, m.gun], [hub, m.chrome], [cap, m.neon]]) { const k = M(g, mat); k.rotation.z = Math.PI / 2; spin.add(k); }
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2, s = M(spoke, m.chrome, 0, Math.cos(a) * tireR * 0.38, Math.sin(a) * tireR * 0.38); s.rotation.x = a; spin.add(s); }
    car.root.add(steer); car._wheelRoots.push(steer); car.wheels.push(spin);
    if (z > 0) car._steerWheels.push(steer);
  }
  car._wheelRadiusModel = tireR;
}

/** shared: lights, sill neon, underglow, seams. Body extents: half-width hw, nose z −hl, tail z +hl, light height ly */
function dress(b, m, { hw, hl, ly, sillY, seamZ = [], seamH = 0.035, seamY = 0.075, wide = 1 }) {
  for (const sx of [-1, 1]) {
    b.add(M(rbox(0.05 * wide, 0.016, 0.012, 0.005, 2), m.headMat, sx * hw * 0.62, ly, -hl - 0.002));
    const hg = M(new THREE.CircleGeometry(0.017, 14), m.headGlow, sx * hw * 0.62, ly, -hl - 0.009); hg.rotation.y = Math.PI; b.add(hg);
    b.add(M(new THREE.BoxGeometry(0.004, 0.004, hl * 1.6), m.neon, sx * (hw + 0.002), sillY, 0)); // sill neon line
    for (const z of seamZ) b.add(M(new THREE.BoxGeometry(0.002, seamH, 0.0025), m.seam, sx * (hw + 0.0012), seamY, z)); // door seams
  }
  b.add(M(rbox(hw * 1.5, 0.012, 0.01, 0.004, 2), m.tailMat, 0, ly + 0.004, hl + 0.002)); // full-width light bar
  b.add(M(new THREE.PlaneGeometry(hw * 1.7, 0.03), m.tailGlow, 0, ly + 0.004, hl + 0.009));
  const glow = M(new THREE.PlaneGeometry(hw * 1.4, hl * 1.5), m.underglow, 0, 0.016, 0); glow.rotation.x = -Math.PI / 2; b.add(glow);
}

export function buildCar(car, m) {
  const b = car.bodyPivot;
  b.add(M(rbox(0.235, 0.026, 0.43, 0.01), m.dark, 0, 0.04, 0));                                    // floor pan
  b.add(M(rbox(0.25, 0.052, 0.452, 0.022, 4, { taper: 0.06, drop: 0.014 }), m.candy, 0, 0.074, 0)); // wedge body
  b.add(M(rbox(0.19, 0.056, 0.2, 0.026, 4, { taper: 0.28, rake: 0.05 }), m.glass, 0, 0.123, 0.025)); // canopy
  b.add(M(rbox(0.14, 0.01, 0.1, 0.005, 2), m.candy, 0, 0.152, 0.03));                               // roof skin
  b.add(M(new THREE.BoxGeometry(0.2, 0.002, 0.0025), m.seam, 0, 0.1012, -0.1));                     // hood seam
  for (const sx of [-1, 1]) {
    b.add(M(rbox(0.04, 0.03, 0.1, 0.012, 2), m.accent, sx * 0.118, 0.06, -0.135));                   // front arch flare
    b.add(M(rbox(0.04, 0.03, 0.1, 0.012, 2), m.accent, sx * 0.118, 0.06, 0.135));                    // rear arch flare
    b.add(M(new THREE.BoxGeometry(0.012, 0.03, 0.012), m.accent, sx * 0.07, 0.115, 0.205));            // wing post
  }
  b.add(M(rbox(0.21, 0.008, 0.04, 0.004, 2), m.accent, 0, 0.133, 0.205));                           // wing
  b.add(M(new THREE.BoxGeometry(0.19, 0.003, 0.004), m.neon, 0, 0.138, 0.226));                      // wing neon edge
  dress(b, m, { hw: 0.125, hl: 0.226, ly: 0.078, sillY: 0.05, seamZ: [-0.055, 0.075] });
  addWheels(car, m, [[-0.128, -0.135], [0.128, -0.135], [-0.128, 0.135], [0.128, 0.135]], 0.05, 0.04);
}

export function buildSuv(car, m) {
  const b = car.bodyPivot;
  b.add(M(rbox(0.25, 0.03, 0.45, 0.012), m.dark, 0, 0.05, 0));
  b.add(M(rbox(0.262, 0.065, 0.462, 0.024, 4, { taper: 0.04, drop: 0.012 }), m.candy, 0, 0.09, 0));
  b.add(M(rbox(0.25, 0.06, 0.36, 0.026, 4, { taper: 0.12 }), m.candy, 0, 0.148, 0.04));
  b.add(M(rbox(0.232, 0.052, 0.31, 0.022, 4, { taper: 0.14, rake: 0.03 }), m.glass, 0, 0.198, 0.045));
  b.add(M(rbox(0.205, 0.014, 0.29, 0.007, 2), m.accent, 0, 0.229, 0.045));
  for (const sx of [-1, 1]) {
    { const r = M(new THREE.CylinderGeometry(0.004, 0.004, 0.26, 6), m.chrome, sx * 0.085, 0.241, 0.045); r.rotation.x = Math.PI / 2; b.add(r); } // roof rail
    b.add(M(rbox(0.035, 0.032, 0.11, 0.012, 2), m.accent, sx * 0.124, 0.072, -0.14));
    b.add(M(rbox(0.035, 0.032, 0.11, 0.012, 2), m.accent, sx * 0.124, 0.072, 0.14));
  }
  b.add(M(new THREE.BoxGeometry(0.2, 0.003, 0.004), m.neon, 0, 0.12, -0.231));                       // grille neon
  dress(b, m, { hw: 0.131, hl: 0.231, ly: 0.098, sillY: 0.062, seamZ: [-0.04, 0.08], seamH: 0.05, seamY: 0.115 });
  addWheels(car, m, [[-0.13, -0.14], [0.13, -0.14], [-0.13, 0.14], [0.13, 0.14]], 0.055, 0.045);
}

export function buildJeep(car, m) {
  const b = car.bodyPivot;
  b.add(M(rbox(0.25, 0.03, 0.38, 0.012), m.dark, 0, 0.062, 0));
  b.add(M(rbox(0.27, 0.075, 0.39, 0.018, 3, { taper: 0.03 }), m.candy, 0, 0.11, 0.01));
  b.add(M(rbox(0.25, 0.03, 0.13, 0.012, 3, { drop: 0.006 }), m.candy, 0, 0.158, -0.125));
  const ws = M(rbox(0.23, 0.065, 0.01, 0.004, 2), m.glass, 0, 0.2, -0.055); ws.rotation.x = 0.22; b.add(ws);
  const wf = M(rbox(0.24, 0.008, 0.014, 0.003, 2), m.gun, 0, 0.235, -0.063); b.add(wf);
  const tube = (x, y, z, L, rx, rz) => { const t = M(new THREE.CylinderGeometry(0.007, 0.007, L, 8), m.gun, x, y, z); t.rotation.set(rx || 0, 0, rz || 0); b.add(t); };
  for (const sx of [-1, 1]) { tube(sx * 0.105, 0.2, 0.06, 0.12); tube(sx * 0.105, 0.26, 0.0, 0.12, Math.PI / 2); tube(sx * 0.105, 0.2, -0.055, 0.12); }
  tube(0, 0.26, 0.06, 0.21, 0, Math.PI / 2);
  for (const sx of [-1, 1]) {
    b.add(M(rbox(0.045, 0.028, 0.12, 0.012, 2), m.accent, sx * 0.13, 0.085, -0.12));
    b.add(M(rbox(0.045, 0.028, 0.12, 0.012, 2), m.accent, sx * 0.13, 0.085, 0.12));
  }
  const spare = M(new THREE.TorusGeometry(0.038, 0.015, 8, 18), m.rubber, 0, 0.13, 0.215); b.add(spare);
  { const h = M(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 12), m.gun, 0, 0.13, 0.215); h.rotation.x = Math.PI / 2; b.add(h); }
  for (let i = -2; i <= 2; i++) b.add(M(new THREE.BoxGeometry(0.008, 0.04, 0.004), m.seam, i * 0.03, 0.115, -0.197)); // grille slots
  dress(b, m, { hw: 0.135, hl: 0.196, ly: 0.12, sillY: 0.075, seamZ: [0.0], seamH: 0.05, seamY: 0.12 });
  addWheels(car, m, [[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]], 0.058, 0.05);
}

export function buildConvertible(car, m) {
  const b = car.bodyPivot;
  b.add(M(rbox(0.22, 0.026, 0.44, 0.01), m.dark, 0, 0.04, 0));
  b.add(M(rbox(0.235, 0.05, 0.458, 0.022, 4, { taper: 0.08, drop: 0.016 }), m.candy, 0, 0.068, 0));
  b.add(M(rbox(0.17, 0.02, 0.15, 0.008, 2), m.dark, 0, 0.092, 0.02));                                 // cockpit tub
  for (const sx of [-1, 1]) b.add(M(rbox(0.06, 0.04, 0.045, 0.012, 2), m.accent, sx * 0.042, 0.11, 0.05)); // seats
  b.add(M(rbox(0.19, 0.03, 0.09, 0.014, 3), m.candy, 0, 0.1, 0.15));                                 // rear deck hump
  const ws = M(rbox(0.17, 0.045, 0.008, 0.004, 2), m.glass, 0, 0.12, -0.065); ws.rotation.x = -0.45; b.add(ws);
  b.add(M(new THREE.BoxGeometry(0.17, 0.003, 0.004), m.neon, 0, 0.143, -0.076));
  for (const sx of [-1, 1]) {
    b.add(M(rbox(0.04, 0.026, 0.1, 0.012, 2), m.accent, sx * 0.108, 0.055, -0.135));
    b.add(M(rbox(0.04, 0.026, 0.1, 0.012, 2), m.accent, sx * 0.108, 0.055, 0.13));
  }
  dress(b, m, { hw: 0.117, hl: 0.229, ly: 0.07, sillY: 0.046, seamZ: [-0.04], seamH: 0.03, seamY: 0.068 });
  addWheels(car, m, [[-0.12, -0.135], [0.12, -0.135], [-0.12, 0.13], [0.12, 0.13]], 0.045, 0.036);
}

/* logic35 GROUNDING: soft contact shadow (body blob + darker tyre patches) that rides the road, and a dim warm
 * mansion-tone reflection map so the lacquer/chrome pick up the room instead of reading as a flat cut-out. */
let _shadowTex35 = null;
function shadowTex35(wheels) {
  const c = document.createElement("canvas"); c.width = 128; c.height = 256; const x = c.getContext("2d");
  const g = x.createRadialGradient(64, 128, 10, 64, 128, 128); g.addColorStop(0, "rgba(0,0,0,0.56)"); g.addColorStop(0.55, "rgba(0,0,0,0.34)"); /* logic36: × mat 0.75 → blob ≈ −32 % */ g.addColorStop(1, "rgba(0,0,0,0)");
  x.save(); x.scale(1, 1); x.fillStyle = g; x.fillRect(0, 0, 128, 256); x.restore();
  for (const [u, v] of wheels) { const r = x.createRadialGradient(u, v, 2, u, v, 20); r.addColorStop(0, "rgba(0,0,0,0.95)"); /* tyre contact stays (≈ −16 %) */ r.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = r; x.fillRect(u - 20, v - 20, 40, 40); }
  const t = new THREE.CanvasTexture(c); return t;
}
export function addContactShadow35(car) {
  if (car._shadow35) { car.root.remove(car._shadow35); car._shadow35.geometry.dispose(); car._shadow35 = null; }
  car._env35 = false;
  const roots = car._wheelRoots || []; if (!roots.length || typeof document === "undefined") return;
  let mx = 0, mz = 0; for (const w of roots) { mx = Math.max(mx, Math.abs(w.position.x)); mz = Math.max(mz, Math.abs(w.position.z)); }
  const W = mx * 2 + 0.09, L = mz * 2 + 0.16;
  const wheels = roots.map((w) => [64 + (w.position.x / W) * 128, 128 + (w.position.z / L) * 256]);
  if (!_shadowTex35) _shadowTex35 = shadowTex35(wheels);
  const mat = new THREE.MeshBasicMaterial({ map: _shadowTex35, color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, toneMapped: false, fog: true });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, L), mat); m.name = "car_contact_shadow"; m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.renderOrder = 1; m.castShadow = false; m.receiveShadow = false;
  car.root.add(m); car._shadow35 = m;
  if (!globalThis.__CAR_ENV35) try {
    const c = document.createElement("canvas"); c.width = 256; c.height = 128; const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, "#2a2f44"); g.addColorStop(0.42, "#6b5a46"); g.addColorStop(0.5, "#3a2a20"); g.addColorStop(1, "#140e0a");
    x.fillStyle = g; x.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 6; i++) { const r = x.createRadialGradient(20 + i * 44, 22, 1, 20 + i * 44, 22, 14); r.addColorStop(0, "rgba(255,226,170,0.9)"); r.addColorStop(1, "rgba(255,226,170,0)"); x.fillStyle = r; x.fillRect(i * 44, 0, 44, 50); }
    const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace || t.colorSpace;
    globalThis.__CAR_ENV35 = t;
  } catch (_) {}
}
