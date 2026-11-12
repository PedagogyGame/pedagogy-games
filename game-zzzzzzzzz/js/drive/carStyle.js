/** logic38: rebuild procedural Drive meshes to match the MINIATURE DRIVE Blender sheet.
 *  Same footprints, wheel hubs/radii, and contact shadow as logic37. Metallic Standard/Physical
 *  paints, bevel-ish boxes/cylinders, black multi-spoke rims. Model units: root scaled by CAR_SCALE;
 *  nose toward −Z inside bodyPivot (rotated π). Visuals stay inside |x| ≤ 0.165, |z| ≤ 0.235. */
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
    const t = (v.y + h / 2) / h; /* 0 bottom → 1 top */
    if (taper) v.x *= 1 - taper * t;
    if (drop) v.y -= drop * t * Math.max(0, -v.z / (d / 2)) ** 2;
    if (rake) v.z += rake * (t - 0.5) * Math.sign(v.z || 1) * -1;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

export function vehicleMats(preset) {
  const paint = PAINTS[preset.id] || PAINTS.car;
  const P = THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial;
  /* slightly more metallic than logic37 so the candy paint reads like the Blender sheet */
  const candy = new P({ color: paint.body, metalness: 0.62, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06 });
  const accent = new P({ color: 0x14161a, metalness: 0.7, roughness: 0.32, clearcoat: 0.4, clearcoatRoughness: 0.25 });
  const glass = new P({ color: 0x0a141c, metalness: 0.45, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03,
    emissive: 0x081820, emissiveIntensity: 0.22, transparent: true, opacity: 0.78 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.7, metalness: 0.25 });
  const seam = new THREE.MeshStandardMaterial({ color: 0x06070a, roughness: 0.9, metalness: 0.1 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb8c4cf, roughness: 0.18, metalness: 0.95 });
  const gun = new THREE.MeshStandardMaterial({ color: 0x5b6470, roughness: 0.28, metalness: 0.9 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x131315, roughness: 0.93, metalness: 0.02 });
  const side = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.88, metalness: 0.04 });
  const rim = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.32, metalness: 0.75 }); /* black multi-spoke */
  const silver = new THREE.MeshStandardMaterial({ color: 0xc5ced6, roughness: 0.22, metalness: 0.92 });
  const seat = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.55, metalness: 0.08 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xeaf6ff, emissive: 0xcfeeff, emissiveIntensity: 0.7, roughness: 0.15, metalness: 0.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x6a0010, emissive: 0xff1f3d, emissiveIntensity: 0.5, roughness: 0.3 });
  const neon = new THREE.MeshBasicMaterial({ color: 0x3fe0f0 });
  const headGlow = new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false });
  const tailGlow = new THREE.MeshBasicMaterial({ color: 0xff2a48, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false });
  const underglow = new THREE.MeshStandardMaterial({ color: 0x3fe0f0, emissive: 0x3fe0f0, emissiveIntensity: 0.16, transparent: true, opacity: 0.18, roughness: 0.6, depthWrite: false });
  return { candy, accent, glass, dark, seam, chrome, gun, rubber, side, rim, silver, seat, headMat, tailMat, neon, headGlow, tailGlow, underglow, cream: accent, hubMat: rim };
}

const M = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = false; return m; };

/** wheels: steer pivot (front, +Z in root) → spinner (rotation.x) → chunky tyre + black 8-spoke rim.
 *  Hub positions and (tireR, tireW) MUST stay exactly as GLB-SPECS / logic37. */
export function addWheels(car, m, layout, tireR, tireW) {
  const tyre = new THREE.CylinderGeometry(tireR, tireR, tireW, 24);
  const wall = new THREE.CylinderGeometry(tireR * 0.88, tireR * 0.88, tireW + 0.005, 24);
  const lip = new THREE.CylinderGeometry(tireR * 0.72, tireR * 0.70, tireW + 0.004, 20);
  const dish = new THREE.CylinderGeometry(tireR * 0.58, tireR * 0.22, tireW * 0.42, 18);
  const hub = new THREE.CylinderGeometry(tireR * 0.16, tireR * 0.16, tireW + 0.005, 12);
  const cap = new THREE.CylinderGeometry(tireR * 0.07, tireR * 0.07, tireW + 0.006, 10);
  const spoke = new THREE.BoxGeometry(tireW * 0.28, tireR * 0.50, tireR * 0.065);
  const rimMat = m.rim || m.accent;
  car._steerWheels = []; car._wheelRoots = car._wheelRoots || [];
  for (const [x, z] of layout) {
    const steer = new THREE.Group(); steer.position.set(x, tireR, z);
    const spin = new THREE.Group(); steer.add(spin);
    for (const [g, mat] of [[tyre, m.rubber], [wall, m.side], [lip, rimMat], [hub, rimMat], [cap, m.gun]]) {
      const k = M(g, mat); k.rotation.z = Math.PI / 2; spin.add(k);
    }
    const dishM = M(dish, rimMat); dishM.rotation.z = Math.PI / 2; dishM.position.x = Math.sign(x || 1) * (tireW * 0.18); spin.add(dishM);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const s = M(spoke, rimMat, 0, Math.cos(a) * tireR * 0.32, Math.sin(a) * tireR * 0.32);
      s.rotation.x = a; spin.add(s);
    }
    car.root.add(steer); car._wheelRoots.push(steer); car.wheels.push(spin);
    if (z > 0) car._steerWheels.push(steer);
  }
  car._wheelRadiusModel = tireR;
}

function lights(b, m, { hw, hl, ly, tailW = null }) {
  for (const sx of [-1, 1]) {
    b.add(M(rbox(0.036, 0.014, 0.012, 0.003, 2), m.headMat, sx * hw * 0.62, ly, -hl - 0.002));
    const hg = M(new THREE.CircleGeometry(0.014, 12), m.headGlow, sx * hw * 0.62, ly, -hl - 0.008); hg.rotation.y = Math.PI; b.add(hg);
  }
  b.add(M(rbox((tailW || hw) * 1.35, 0.01, 0.009, 0.003, 2), m.tailMat, 0, ly + 0.002, hl + 0.002));
}

/** CRIMSON COUPE — low wedge, dark glass cabin, big rear wing on struts, side skirts, silver lower trim. */
export function buildCar(car, m) {
  const b = car.bodyPivot;
  b.add(M(rbox(0.232, 0.02, 0.44, 0.008), m.dark, 0, 0.038, 0)); /* floor pan */
  b.add(M(rbox(0.248, 0.048, 0.45, 0.016, 4, { taper: 0.04, drop: 0.012 }), m.candy, 0, 0.072, 0.004)); /* wedge body */
  b.add(M(rbox(0.22, 0.018, 0.16, 0.006, 3, { drop: 0.006 }), m.candy, 0, 0.098, -0.12)); /* hood */
  /* dark tinted cabin */
  b.add(M(rbox(0.20, 0.058, 0.20, 0.014, 4, { taper: 0.18, rake: 0.04 }), m.glass, 0, 0.126, 0.028));
  b.add(M(rbox(0.15, 0.008, 0.11, 0.003, 2), m.candy, 0, 0.156, 0.034)); /* roof skin */
  for (const sx of [-1, 1]) {
    b.add(M(rbox(0.036, 0.028, 0.10, 0.01, 2), m.accent, sx * 0.118, 0.058, -0.135)); /* front flare */
    b.add(M(rbox(0.036, 0.028, 0.10, 0.01, 2), m.accent, sx * 0.118, 0.058, 0.135));
    b.add(M(new THREE.BoxGeometry(0.018, 0.016, 0.26), m.accent, sx * 0.128, 0.046, 0)); /* side skirt */
    b.add(M(new THREE.BoxGeometry(0.010, 0.006, 0.26), m.silver, sx * 0.134, 0.037, 0)); /* silver skirt lip */
  }
  b.add(M(new THREE.BoxGeometry(0.22, 0.008, 0.022), m.silver, 0, 0.032, -0.226)); /* front splitter */
  b.add(M(new THREE.BoxGeometry(0.20, 0.002, 0.0025), m.seam, 0, 0.100, -0.10));
  /* big rear wing on two struts */
  for (const sx of [-1, 1]) {
    b.add(M(new THREE.BoxGeometry(0.010, 0.055, 0.012), m.accent, sx * 0.07, 0.128, 0.208));
    b.add(M(rbox(0.018, 0.012, 0.05, 0.003, 2), m.candy, sx * 0.108, 0.168, 0.210)); /* endplate */
  }
  b.add(M(rbox(0.22, 0.008, 0.048, 0.003, 2), m.candy, 0, 0.168, 0.210));
  b.add(M(new THREE.BoxGeometry(0.20, 0.003, 0.006), m.accent, 0, 0.173, 0.232)); /* wing lip */
  lights(b, m, { hw: 0.125, hl: 0.226, ly: 0.074 });
  addWheels(car, m, [[-0.128, -0.135], [0.128, -0.135], [-0.128, 0.135], [0.128, 0.135]], 0.05, 0.04);
}

/** MIDNIGHT SUV — boxy metallic body, tall dark greenhouse, silver roof frame, black wheels. */
export function buildSuv(car, m) {
  const b = car.bodyPivot;
  b.add(M(rbox(0.25, 0.028, 0.45, 0.01), m.dark, 0, 0.048, 0));
  b.add(M(rbox(0.262, 0.062, 0.458, 0.016, 4, { taper: 0.02, drop: 0.008 }), m.candy, 0, 0.088, 0));
  b.add(M(rbox(0.252, 0.055, 0.34, 0.014, 3, { taper: 0.04 }), m.candy, 0, 0.142, 0.04)); /* upper body, short hood */
  /* tall, almost-upright greenhouse */
  b.add(M(rbox(0.236, 0.062, 0.30, 0.012, 4, { taper: 0.06, rake: 0.02 }), m.glass, 0, 0.196, 0.048));
  b.add(M(rbox(0.20, 0.008, 0.27, 0.003, 2), m.accent, 0, 0.230, 0.048)); /* roof panel */
  /* silver roof frame / rails */
  for (const sx of [-1, 1]) {
    const rail = M(new THREE.CylinderGeometry(0.0045, 0.0045, 0.27, 8), m.silver, sx * 0.078, 0.240, 0.048);
    rail.rotation.x = Math.PI / 2; b.add(rail);
    b.add(M(new THREE.BoxGeometry(0.01, 0.012, 0.01), m.silver, sx * 0.078, 0.235, 0.048 - 0.12));
    b.add(M(new THREE.BoxGeometry(0.01, 0.012, 0.01), m.silver, sx * 0.078, 0.235, 0.048 + 0.12));
    b.add(M(rbox(0.032, 0.030, 0.11, 0.01, 2), m.accent, sx * 0.126, 0.070, -0.14));
    b.add(M(rbox(0.032, 0.030, 0.11, 0.01, 2), m.accent, sx * 0.126, 0.070, 0.14));
    b.add(M(new THREE.BoxGeometry(0.008, 0.055, 0.008), m.silver, sx * 0.118, 0.196, -0.08)); /* A-pillar trim */
    b.add(M(new THREE.BoxGeometry(0.008, 0.055, 0.008), m.silver, sx * 0.118, 0.196, 0.16));
  }
  const cross = M(new THREE.CylinderGeometry(0.0035, 0.0035, 0.156, 8), m.silver, 0, 0.240, 0.048);
  cross.rotation.z = Math.PI / 2; b.add(cross);
  b.add(M(new THREE.BoxGeometry(0.16, 0.018, 0.008), m.accent, 0, 0.092, -0.230)); /* grille bar */
  for (let i = -2; i <= 2; i++) b.add(M(new THREE.BoxGeometry(0.006, 0.016, 0.004), m.silver, i * 0.028, 0.092, -0.235));
  lights(b, m, { hw: 0.131, hl: 0.231, ly: 0.096 });
  addWheels(car, m, [[-0.13, -0.14], [0.13, -0.14], [-0.13, 0.14], [0.13, 0.14]], 0.055, 0.045);
}

/** GUNMETAL JEEP — open body, dark-steel roll cage, slotted grille, flared fenders, spare that does not spin. */
export function buildJeep(car, m) {
  const b = car.bodyPivot;
  const cage = m.gun;
  b.add(M(rbox(0.25, 0.028, 0.38, 0.01), m.dark, 0, 0.060, 0));
  b.add(M(rbox(0.255, 0.070, 0.38, 0.014, 3, { taper: 0.02 }), m.candy, 0, 0.108, 0.01)); /* open tub */
  b.add(M(rbox(0.24, 0.028, 0.13, 0.01, 3, { drop: 0.005 }), m.candy, 0, 0.152, -0.125)); /* hood */
  /* cabin cut / seats so the open body reads */
  b.add(M(rbox(0.09, 0.03, 0.07, 0.01, 2), m.seat, -0.04, 0.148, 0.02));
  b.add(M(rbox(0.09, 0.03, 0.07, 0.01, 2), m.seat, 0.04, 0.148, 0.02));
  b.add(M(rbox(0.08, 0.05, 0.02, 0.006, 2), m.seat, -0.04, 0.175, 0.05));
  b.add(M(rbox(0.08, 0.05, 0.02, 0.006, 2), m.seat, 0.04, 0.175, 0.05));
  /* almost-vertical windshield + frame */
  const ws = M(rbox(0.22, 0.07, 0.008, 0.002, 2), m.glass, 0, 0.205, -0.058); ws.rotation.x = 0.12; b.add(ws);
  b.add(M(new THREE.BoxGeometry(0.22, 0.006, 0.008), cage, 0, 0.242, -0.066));
  for (const sx of [-1, 1]) b.add(M(new THREE.BoxGeometry(0.008, 0.07, 0.008), cage, sx * 0.108, 0.205, -0.060));
  /* dark-steel tubular roll cage (box hoop + side bars + rear cross) */
  const tube = (x, y, z, L, rx, rz) => { const t = M(new THREE.CylinderGeometry(0.007, 0.007, L, 8), cage, x, y, z); t.rotation.set(rx || 0, 0, rz || 0); b.add(t); };
  for (const sx of [-1, 1]) {
    tube(sx * 0.108, 0.205, -0.055, 0.14); /* A-pillar-ish */
    tube(sx * 0.108, 0.26, 0.02, 0.16, Math.PI / 2); /* roof side */
    tube(sx * 0.108, 0.205, 0.10, 0.14); /* rear down */
    tube(sx * 0.108, 0.16, 0.10, 0.08); /* short rear post into tub */
  }
  tube(0, 0.26, -0.055, 0.216, 0, Math.PI / 2); /* front roof bar */
  tube(0, 0.26, 0.10, 0.216, 0, Math.PI / 2); /* rear roof bar */
  tube(0, 0.205, 0.10, 0.216, 0, Math.PI / 2); /* rear hoop cross */
  /* steering wheel (static, on body — does not spin) */
  { const wh = M(new THREE.TorusGeometry(0.028, 0.004, 6, 14), m.accent, -0.04, 0.185, -0.02); wh.rotation.x = 1.15; b.add(wh); }

  for (const sx of [-1, 1]) {
    /* rounder flared fenders */
    b.add(M(rbox(0.055, 0.032, 0.13, 0.014, 3), m.candy, sx * 0.132, 0.088, -0.12));
    b.add(M(rbox(0.055, 0.032, 0.13, 0.014, 3), m.candy, sx * 0.132, 0.088, 0.12));
  }
  /* slotted front grille */
  b.add(M(new THREE.BoxGeometry(0.16, 0.048, 0.01), m.accent, 0, 0.118, -0.195));
  for (let i = -2; i <= 2; i++) b.add(M(new THREE.BoxGeometry(0.14, 0.005, 0.006), m.gun, 0, 0.102 + i * 0.009, -0.201));
  /* spare on the tail — part of body, must not go into car.wheels */
  const spare = M(new THREE.TorusGeometry(0.040, 0.016, 8, 18), m.rubber, 0, 0.135, 0.215); b.add(spare);
  { const h = M(new THREE.CylinderGeometry(0.018, 0.018, 0.014, 12), m.rim, 0, 0.135, 0.215); h.rotation.x = Math.PI / 2; b.add(h); }
  b.add(M(new THREE.BoxGeometry(0.03, 0.03, 0.02), m.gun, 0, 0.135, 0.198)); /* spare mount */
  lights(b, m, { hw: 0.135, hl: 0.196, ly: 0.118 });
  addWheels(car, m, [[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]], 0.058, 0.05);
}

/** COPPER CONVERTIBLE — low open-top, grey bucket seats, windscreen frame, rear deck, black rims. */
export function buildConvertible(car, m) {
  const b = car.bodyPivot;
  b.add(M(rbox(0.22, 0.024, 0.44, 0.01), m.dark, 0, 0.038, 0));
  b.add(M(rbox(0.235, 0.048, 0.456, 0.018, 4, { taper: 0.06, drop: 0.014 }), m.candy, 0, 0.066, 0));
  b.add(M(rbox(0.20, 0.016, 0.16, 0.006, 3, { drop: 0.006 }), m.candy, 0, 0.092, -0.12)); /* hood */
  b.add(M(rbox(0.17, 0.016, 0.15, 0.006, 2), m.dark, 0, 0.090, 0.02)); /* cockpit tub */
  /* grey bucket seats */
  for (const sx of [-1, 1]) {
    b.add(M(rbox(0.062, 0.022, 0.055, 0.01, 2), m.seat, sx * 0.042, 0.108, 0.04)); /* cushion */
    b.add(M(rbox(0.060, 0.048, 0.016, 0.008, 2), m.seat, sx * 0.042, 0.132, 0.068)); /* backrest */
    b.add(M(rbox(0.008, 0.018, 0.045, 0.003, 2), m.seat, sx * 0.068, 0.116, 0.04)); /* bolster */
    b.add(M(rbox(0.036, 0.024, 0.10, 0.01, 2), m.accent, sx * 0.110, 0.054, -0.135));
    b.add(M(rbox(0.036, 0.024, 0.10, 0.01, 2), m.accent, sx * 0.110, 0.054, 0.13));
  }
  b.add(M(rbox(0.20, 0.028, 0.10, 0.012, 3), m.candy, 0, 0.098, 0.155)); /* rear deck */
  /* windscreen + metal frame */
  const ws = M(rbox(0.168, 0.048, 0.006, 0.002, 2), m.glass, 0, 0.122, -0.062); ws.rotation.x = -0.42; b.add(ws);
  const ff = M(new THREE.BoxGeometry(0.172, 0.004, 0.007), m.silver, 0, 0.146, -0.074); ff.rotation.x = -0.42; b.add(ff);
  for (const sx of [-1, 1]) {
    const st = M(new THREE.BoxGeometry(0.007, 0.05, 0.007), m.silver, sx * 0.084, 0.122, -0.062);
    st.rotation.x = -0.42; b.add(st);
  }
  lights(b, m, { hw: 0.117, hl: 0.229, ly: 0.068 });
  addWheels(car, m, [[-0.12, -0.135], [0.12, -0.135], [-0.12, 0.13], [0.12, 0.13]], 0.045, 0.036);
}

/* logic35 GROUNDING + logic37: soft contact shadow. logic37 root cause of flicker was the tilted plane
 * digging into the road (0.012 lift << halfLen*|sin θ| on grades) → z-fight. Lift clears the lowest edge,
 * height/normal are low-passed, opacity is constant when grounded and fades only when airborne. Darkness
 * ~−38 % vs logic36, soft even falloff. */
let _shadowTex37 = null;
function shadowTex37(wheels) {
  const c = document.createElement("canvas"); c.width = 128; c.height = 256; const x = c.getContext("2d");
  /* soft even blob: lower peak, gentler mid, long falloff (logic36 was 0.56/0.34 × 0.75) */
  const g = x.createRadialGradient(64, 128, 8, 64, 128, 120); g.addColorStop(0, "rgba(0,0,0,0.50)"); g.addColorStop(0.42, "rgba(0,0,0,0.26)"); g.addColorStop(0.78, "rgba(0,0,0,0.08)"); g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 256);
  for (const [u, v] of wheels) { const r = x.createRadialGradient(u, v, 1.5, u, v, 22); r.addColorStop(0, "rgba(0,0,0,0.68)"); r.addColorStop(0.55, "rgba(0,0,0,0.22)"); r.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = r; x.fillRect(u - 22, v - 22, 44, 44); }
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}
export function addContactShadow35(car) {
  if (car._shadow35) { car.root.remove(car._shadow35); car._shadow35.geometry.dispose(); if (car._shadow35.material) car._shadow35.material.dispose(); car._shadow35 = null; }
  car._env35 = false;
  const roots = car._wheelRoots || []; if (!roots.length || typeof document === "undefined") return;
  let mx = 0, mz = 0; for (const w of roots) { mx = Math.max(mx, Math.abs(w.position.x)); mz = Math.max(mz, Math.abs(w.position.z)); }
  const W = mx * 2 + 0.09, L = mz * 2 + 0.16;
  const wheels = roots.map((w) => [64 + (w.position.x / W) * 128, 128 + (w.position.z / L) * 256]);
  if (!_shadowTex37) _shadowTex37 = shadowTex37(wheels);
  /* opacity 0.46 ≈ −38.7 % vs logic36's 0.75; depthWrite off + stronger polygonOffset + lift in car.js stop the flicker */
  const mat = new THREE.MeshBasicMaterial({ map: _shadowTex37, color: 0xffffff, transparent: true, opacity: 0.46, depthWrite: false, depthTest: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8, toneMapped: false, fog: true });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, L), mat); m.name = "car_contact_shadow"; m.rotation.x = -Math.PI / 2; m.position.y = 0.02; m.renderOrder = 10; m.castShadow = false; m.receiveShadow = false;
  m.userData.halfL = L * 0.5; m.userData.baseOp = 0.46;
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
