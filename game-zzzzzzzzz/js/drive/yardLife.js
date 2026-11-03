/**
 * logic27 (Ben pt196u, Nov 3): YARD LIFE — an ambient house mouse + the backyard dog.
 *  Scale: the car is mouse-sized (~8 cm), so the mouse is about car-sized and the dog is a real dog (~1 m long).
 *  Palette: the house's dark 2100s look — charcoal fur, gunmetal, slate wood, thin cyan neon accents only.
 *
 *  MOUSE  wanders the indoor floors at random times/places. It never looks at or chases the car; when the car
 *         is on a collision course it scurries aside (or freezes if the side is blocked) and carries on.
 *         Never parks in a lane, never leaves its floor, never ends the game. Soft at most (it dodges).
 *  DOG    sleeps by its doghouse in the east backyard (beside the lab garage). Drive close → sometimes wakes
 *         (chance per approach + cooldown) → ears up, growl, bark → chases on the ground with line of sight.
 *         A catch ends the run exactly like a big fall (car.crashed → crash → restart). Lose it under the deck,
 *         through the bush tunnel, under the wheelbarrow/crate, under the fence gate, or in the garage / up the
 *         lab window road. 120 s without seeing the car → it gives up, walks home, lies down (cooldown).
 */
import * as THREE from "three";

export const DOG_T = {
  house: { x: 45.4, z: 15.2, yaw: -Math.PI / 2 }, // door faces west (toward the garage / yard)
  trigger: 3.2,      // m from the doghouse: entering this radius rolls the wake chance
  nearWake: 1.5,     // lingering this close for nearT seconds always wakes him (unless on cooldown)
  nearT: 2.5,
  chance: 0.6,       // per approach
  cooldown: 25,      // s after he lies back down (or after a no-wake roll: rollCd)
  rollCd: 6,
  alertT: 1.1, barkT: 0.75,
  runMax: 1.30,      // car top 1.38 (boost 1.88) — beatable flat out, faster than a slow car
  accel: 3.4, decel: 4.5,
  turnLo: 3.0, turnHi: 1.55, // rad/s at standstill → at full run (min turn radius ≈ 0.84 m flat out)
  walk: 0.55, searchSpeed: 0.75,
  radius: 0.30,      // body circle (the hide gaps are 0.16–0.35 m: far too small for him)
  mouth: 0.62, catchR: 0.24, catchY: 0.30,
  sightMax: 16, giveUp: 120,
};
// Dog territory (union of rects): east yard beside the garage + the south lawn. Garage interior is never his.
const TERR = [
  { x0: 40.6, x1: 49.6, z0: 9.4, z1: 31.5 },
  { x0: 29.5, x1: 49.6, z0: 23.3, z1: 31.5 },
];
export const inTerritory = (x, z, m = 0) => TERR.some((r) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m);

let SEED = 1234567;
export function setYardSeed(s) { SEED = s >>> 0 || 1; }
const rnd = () => ((SEED = (SEED * 16807) % 2147483647) / 2147483647);

const mat = (c, r = 0.75, m = 0.05, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra });
const neon = (c, i = 1.4) => new THREE.MeshStandardMaterial({ color: 0x0b0f14, emissive: c, emissiveIntensity: i, roughness: 0.4, metalness: 0.2 });

/* ───────────────────────────── yard props (doghouse + hides) ───────────────────────────── */
function buildYardProps(root, solids) {
  const H = DOG_T.house;
  const g = new THREE.Group(); g.name = "dog_yard"; root.add(g);
  const add = (geo, m, x, y, z, ry = 0, rx = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  const solid = (x0, y0, z0, x1, y1, z1, tag, dogOnly = false) => { const b = new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)); b.driveKind = "pillar"; b.yard = tag; b.dogOnly = dogOnly; solids.push(b); return b; };
  const slate = mat(0x3a3430, 0.82), roofM = mat(0x1f2633, 0.55, 0.35), trim = neon(0x2ee6ff, 1.2), dark = mat(0x121418, 0.9);
  // DOGHOUSE (1.0 × 0.9 × 0.95, pitched roof, arched dark door, cyan eave line, brass name plate "BRUNO")
  const hx = H.x, hz = H.z, W = 0.9, D = 1.0, WH = 0.62;
  add(new THREE.BoxGeometry(D, 0.06, W), mat(0x2a2522, 0.9), hx, 0.03, hz);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(D, WH, 0.05), slate, hx, 0.06 + WH / 2, hz + s * (W / 2 - 0.025));
  add(new THREE.BoxGeometry(0.05, WH, W), slate, hx + D / 2 - 0.025, 0.06 + WH / 2, hz); // back (east)
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.05, WH, 0.24), slate, hx - D / 2 + 0.025, 0.06 + WH / 2, hz + s * 0.33); // front jambs
  add(new THREE.BoxGeometry(0.05, 0.14, 0.42), slate, hx - D / 2 + 0.025, 0.06 + WH - 0.07, hz);
  add(new THREE.BoxGeometry(0.02, 0.46, 0.4), dark, hx - D / 2 + 0.03, 0.29, hz); // dark doorway
  const roofLen = D + 0.16, half = W / 2 + 0.1, pitch = 0.62;
  for (const s of [-1, 1]) {
    const r = add(new THREE.BoxGeometry(roofLen, 0.04, half / Math.cos(pitch) + 0.02), roofM, hx, 0.06 + WH + Math.tan(pitch) * half / 2, hz + s * half / 2, 0, s * pitch);
    void r;
    add(new THREE.BoxGeometry(roofLen, 0.012, 0.012), trim, hx, 0.06 + WH + 0.005, hz + s * (half + 0.0)); // eave neon
  }
  // gable fronts
  const gab = new THREE.Shape(); gab.moveTo(-W / 2, 0); gab.lineTo(W / 2, 0); gab.lineTo(0, Math.tan(pitch) * W / 2); gab.closePath();
  for (const s of [-1, 1]) add(new THREE.ShapeGeometry(gab), new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.85, side: THREE.DoubleSide }), hx + s * (D / 2 - 0.02), 0.06 + WH, hz, Math.PI / 2);
  add(new THREE.BoxGeometry(0.01, 0.05, 0.2), mat(0x8a7344, 0.4, 0.7), hx - D / 2 - 0.004, 0.06 + WH - 0.03, hz); // name plate
  add(new THREE.CylinderGeometry(0.11, 0.09, 0.05, 18), mat(0x2b3038, 0.35, 0.7), hx - D / 2 - 0.35, 0.025, hz + 0.32); // steel bowl
  add(new THREE.CylinderGeometry(0.095, 0.095, 0.01, 18), mat(0x1a2a33, 0.1, 0.2), hx - D / 2 - 0.35, 0.045, hz + 0.32);
  add(new THREE.CylinderGeometry(0.06, 0.07, 0.03, 10), mat(0x5a4a3a, 0.9), hx - D / 2 - 0.55, 0.015, hz - 0.35, 0, 0, Math.PI / 2.6); // chew bone-ish
  solid(hx - D / 2, 0, hz - W / 2 - 0.06, hx + D / 2, 1.05, hz + W / 2 + 0.06, "doghouse");
  solid(hx - D / 2 - 0.46, 0, hz + 0.21, hx - D / 2 - 0.24, 0.05, hz + 0.43, "bowl");

  const hides = [];
  // 1) UNDER THE DECK — low garden deck against the garage's east wall; skirt boards with two small gaps
  {
    const x0 = 40.65, x1 = 43.05, z0 = 10.2, z1 = 12.2, top = 0.42, wood = mat(0x3a2c22, 0.85), joist = mat(0x251c16, 0.9);
    add(new THREE.BoxGeometry(x1 - x0, 0.06, z1 - z0), wood, (x0 + x1) / 2, top - 0.03, (z0 + z1) / 2);
    for (let i = 0; i < 8; i++) add(new THREE.BoxGeometry(x1 - x0, 0.004, 0.006), dark, (x0 + x1) / 2, top + 0.001, z0 + 0.25 * (i + 0.5)); // board gaps
    for (const zz of [z0 + 0.04, z1 - 0.04]) add(new THREE.BoxGeometry(x1 - x0, 0.12, 0.05), joist, (x0 + x1) / 2, top - 0.12, zz);
    add(new THREE.BoxGeometry(2.4, 0.012, 0.012), trim, (x0 + x1) / 2, top + 0.006, z1 + 0.005);
    // skirt: south side (z1) with a 0.34 m gap at x 41.5–41.84 · east side (x1) with a gap at z 10.9–11.24
    const skirtM = mat(0x2c231c, 0.9);
    const skirt = (ax0, az0, ax1, az1) => { add(new THREE.BoxGeometry(Math.max(0.04, ax1 - ax0), top - 0.06, Math.max(0.04, az1 - az0)), skirtM, (ax0 + ax1) / 2, (top - 0.06) / 2, (az0 + az1) / 2); solid(ax0, 0, az0, ax1, top, az1, "deck"); };
    skirt(x0, z1 - 0.04, 41.5, z1); skirt(41.84, z1 - 0.04, x1, z1);
    skirt(x1 - 0.04, z0, x1, 10.9); skirt(x1 - 0.04, 11.24, x1, z1);
    skirt(x0, z0, x1, z0 + 0.04); skirt(x0, z0, x0 + 0.04, z1); // north + west closed (west faces the garage road)
    solid(x0, 0.3, z0, x1, top, z1, "deck_top");
    // baffle boards a hand inside each gap: the way in doglegs, so a nose at the gap can't see the car tucked inside
    add(new THREE.BoxGeometry(0.75, 0.3, 0.04), skirtM, 41.675, 0.15, 11.75); solid(41.3, 0, 11.73, 42.05, 0.3, 11.77, "deck_baffle");
    add(new THREE.BoxGeometry(0.04, 0.3, 0.75), skirtM, 42.72, 0.15, 11.075); solid(42.7, 0, 10.7, 42.74, 0.3, 11.45, "deck_baffle");
    for (const [px, pz] of [[x0 + 0.1, z0 + 0.1], [x1 - 0.1, z0 + 0.1], [x0 + 0.1, z1 - 0.1], [x1 - 0.1, z1 - 0.1], [41.85, 11.2]]) { add(new THREE.BoxGeometry(0.07, top - 0.06, 0.07), joist, px, (top - 0.06) / 2, pz); solid(px - 0.035, 0, pz - 0.035, px + 0.035, top, pz + 0.035, "deck_post"); }
    // steps up onto the deck (dog-scale, visual)
    add(new THREE.BoxGeometry(0.5, 0.2, 0.3), wood, 42.4, 0.1, z1 + 0.18);
    solid(42.15, 0, z1 + 0.03, 42.65, 0.2, z1 + 0.33, "deck_step");
    hides.push({ id: "under_deck", label: "under the deck", x: 42.35, z: 11.55, cover: { x0: x0 + 0.04, x1: x1 - 0.04, z0: z0 + 0.04, z1: z1 - 0.04 }, enter: [[41.67, 12.45], [43.3, 11.07]] });
  }
  // 2) BUSH TUNNEL — a long dark hedge with a mouse-sized tunnel through it (along x)
  {
    const cx = 46.6, cz = 19.6, L = 2.4, Wd = 0.9, Hh = 0.95, tw = 0.32, th = 0.22;
    const leaf = mat(0x1d3426, 0.95), leaf2 = mat(0x284634, 0.95);
    let k = 0;
    for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) {
      const r = 0.32 + rnd() * 0.12, x = cx - L / 2 + 0.2 + i * (L - 0.4) / 8, z = cz + (j - 1) * 0.3 + (rnd() - 0.5) * 0.08;
      const y = j === 1 ? th + r * 0.85 : 0.18 + r * 0.7 + rnd() * 0.15;
      const s = add(new THREE.IcosahedronGeometry(r, 1), (k++ % 3) ? leaf : leaf2, x, Math.min(Hh - r * 0.6, y), z); s.scale.y = 0.85;
    }
    // tunnel lining (dark) so the hole reads
    add(new THREE.BoxGeometry(L + 0.02, 0.01, tw), dark, cx, 0.005, cz);
    for (const s of [-1, 1]) solid(cx - L / 2, 0, s < 0 ? cz - Wd / 2 : cz + tw / 2, cx + L / 2, Hh, s < 0 ? cz - tw / 2 : cz + Wd / 2, "bush");
    solid(cx - L / 2, th, cz - tw / 2, cx + L / 2, Hh, cz + tw / 2, "bush_top");
    hides.push({ id: "bush_tunnel", label: "the bush tunnel", x: cx, z: cz, enter: [[cx - L / 2 - 0.25, cz], [cx + L / 2 + 0.25, cz]] });
  }
  // 3) OVERTURNED WHEELBARROW — gunmetal tub upside down, one rim propped on a brick (gap 0.17 m on the west)
  {
    const cx = 43.1, cz = 21.0, tl = 0.95, tw = 0.68, th = 0.36, gap = 0.17;
    const gm = mat(0x3b4048, 0.55, 0.6), rust = mat(0x4a3428, 0.8, 0.3);
    add(new THREE.BoxGeometry(tl, 0.035, tw), gm, cx, th, cz, 0, 0, -0.08);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(tl, th - 0.03, 0.035), gm, cx, (th - 0.03) / 2 + 0.01, cz + s * (tw / 2 - 0.018));
    add(new THREE.BoxGeometry(0.035, th - 0.03, tw), gm, cx + tl / 2 - 0.018, (th - 0.03) / 2 + 0.01, cz);
    add(new THREE.BoxGeometry(0.035, th - gap - 0.02, tw), gm, cx - tl / 2 + 0.018, gap + (th - gap) / 2, cz);
    add(new THREE.BoxGeometry(0.16, gap, 0.1), rust, cx - tl / 2 + 0.06, gap / 2, cz - tw / 2 + 0.1); // brick
    const wheel = add(new THREE.TorusGeometry(0.17, 0.045, 8, 18), mat(0x15171a, 0.9), cx + tl / 2 + 0.2, th + 0.12, cz); wheel.rotation.y = Math.PI / 2;
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 8), gm, cx - tl / 2 - 0.25, th - 0.02, cz + s * 0.24, 0, 0, Math.PI / 2 - 0.12);
    for (const s of [-1, 1]) solid(cx - tl / 2, 0, s < 0 ? cz - tw / 2 : cz + tw / 2 - 0.04, cx + tl / 2, th + 0.04, s < 0 ? cz - tw / 2 + 0.04 : cz + tw / 2, "barrow");
    solid(cx + tl / 2 - 0.04, 0, cz - tw / 2, cx + tl / 2, th + 0.04, cz + tw / 2, "barrow");
    solid(cx - tl / 2, gap, cz - tw / 2, cx + tl / 2, th + 0.04, cz + tw / 2, "barrow_top");
    solid(cx - tl / 2 - 0.02, 0, cz - tw / 2 + 0.05, cx - tl / 2 + 0.14, gap, cz - tw / 2 + 0.15, "brick");
    hides.push({ id: "wheelbarrow", label: "under the wheelbarrow", x: cx + 0.05, z: cz + 0.05, enter: [[cx - tl / 2 - 0.3, cz + 0.08]] });
  }
  // 4) OVERTURNED CRATE — dark slatted crate upside down, a kicked-out slat leaves a 0.26 m hole on the north
  {
    const cx = 47.6, cz = 26.0, s = 0.72, wood = mat(0x4a3a2c, 0.85), wood2 = mat(0x3b2e23, 0.85);
    add(new THREE.BoxGeometry(s, 0.04, s), wood, cx, s - 0.02, cz);
    for (let i = 0; i < 4; i++) {
      const y = 0.07 + i * 0.17;
      add(new THREE.BoxGeometry(s, 0.12, 0.03), i % 2 ? wood : wood2, cx, y, cz + s / 2 - 0.015);
      add(new THREE.BoxGeometry(0.03, 0.12, s), i % 2 ? wood2 : wood, cx + s / 2 - 0.015, y, cz);
      add(new THREE.BoxGeometry(0.03, 0.12, s), i % 2 ? wood : wood2, cx - s / 2 + 0.015, y, cz);
      if (i > 0) add(new THREE.BoxGeometry(s, 0.12, 0.03), wood, cx, y, cz - s / 2 + 0.015);
      else for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.22, 0.12, 0.03), wood2, cx + sx * 0.25, y, cz - s / 2 + 0.015);
    }
    add(new THREE.BoxGeometry(0.3, 0.025, 0.1), wood2, cx + 0.05, 0.012, cz - s / 2 - 0.25, 0.4); // the kicked-out slat
    solid(cx - s / 2, 0, cz + s / 2 - 0.03, cx + s / 2, s, cz + s / 2, "crate");
    solid(cx + s / 2 - 0.03, 0, cz - s / 2, cx + s / 2, s, cz + s / 2, "crate");
    solid(cx - s / 2, 0, cz - s / 2, cx - s / 2 + 0.03, s, cz + s / 2, "crate");
    for (const sx of [-1, 1]) solid(sx < 0 ? cx - s / 2 : cx + 0.13, 0, cz - s / 2, sx < 0 ? cx - 0.13 : cx + s / 2, s, cz - s / 2 + 0.03, "crate");
    solid(cx - 0.13, 0.13, cz - s / 2, cx + 0.13, s, cz - s / 2 + 0.03, "crate");
    solid(cx - s / 2, s - 0.04, cz - s / 2, cx + s / 2, s, cz + s / 2, "crate_top");
    hides.push({ id: "crate", label: "under the crate", x: cx, z: cz + 0.05, enter: [[cx, cz - s / 2 - 0.35]] });
  }
  // 5) FENCE + GATE — dark slate fence between the east yard and the south lawn; the gate hangs 0.16 m high
  {
    const z = 23.15, xa = 40.6, xb = 49.6, gx0 = 44.4, gx1 = 45.3, fh = 0.8, gap = 0.16, fm = mat(0x2c2f36, 0.7, 0.3);
    const run = (x0, x1) => {
      add(new THREE.BoxGeometry(x1 - x0, fh, 0.04), fm, (x0 + x1) / 2, fh / 2, z);
      add(new THREE.BoxGeometry(x1 - x0, 0.012, 0.05), trim, (x0 + x1) / 2, fh + 0.006, z);
      for (let x = x0; x <= x1 + 1e-6; x += 1.0) add(new THREE.BoxGeometry(0.07, fh + 0.06, 0.07), mat(0x23262c, 0.7, 0.3), Math.min(x, x1), (fh + 0.06) / 2, z);
      solid(x0, 0, z - 0.04, x1, fh, z + 0.04, "fence");
    };
    run(xa, gx0); run(gx1, xb);
    add(new THREE.BoxGeometry(gx1 - gx0 - 0.02, fh - gap, 0.035), mat(0x30343c, 0.6, 0.4), (gx0 + gx1) / 2, gap + (fh - gap) / 2, z);
    for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(0.012, fh - gap - 0.05, 0.04), dark, gx0 + 0.12 + i * 0.16, gap + (fh - gap) / 2, z);
    add(new THREE.BoxGeometry(gx1 - gx0, 0.012, 0.05), trim, (gx0 + gx1) / 2, fh + 0.006, z);
    solid(gx0, gap, z - 0.04, gx1, fh, z + 0.04, "gate");
    hides.push({ id: "gate_gap", label: "under the gate", x: (gx0 + gx1) / 2, z, enter: [[(gx0 + gx1) / 2, z - 0.4], [(gx0 + gx1) / 2, z + 0.4]] });
  }
  hides.push({ id: "garage", label: "the lab garage", x: 35.5, z: 2.0, enter: [[30.6, 6.3]] });
  return { group: g, hides };
}

/* ───────────────────────────── dog ───────────────────────────── */
function buildDog() {
  const root = new THREE.Group(); root.name = "yard_dog";
  const fur = mat(0x2b2724, 0.92), fur2 = mat(0x3a332d, 0.92), muzzleM = mat(0x4a423b, 0.9), nose = mat(0x0b0b0c, 0.3, 0.1);
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x1a1208, emissive: 0xffa040, emissiveIntensity: 0.35, roughness: 0.2 });
  const collarM = mat(0x2a3038, 0.4, 0.7), led = neon(0x2ee6ff, 1.6);
  const body = new THREE.Group(); root.add(body); // body pivot at hip/shoulder line
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.52, 6, 12), fur); torso.rotation.z = Math.PI / 2; torso.scale.set(1, 1, 0.82); body.add(torso);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), fur2); chest.position.set(0.26, -0.02, 0); chest.scale.set(1, 1.05, 0.85); body.add(chest);
  const neck = new THREE.Group(); neck.position.set(0.36, 0.08, 0); body.add(neck);
  const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.26, 10), fur); neckM.rotation.z = -0.9; neckM.position.set(0.07, 0.07, 0); neck.add(neckM);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.018, 6, 16), collarM); collar.rotation.y = Math.PI / 2; collar.rotation.x = 0.6; collar.position.set(0.05, 0.05, 0); neck.add(collar);
  const ledM = new THREE.Mesh(new THREE.TorusGeometry(0.106, 0.004, 4, 16, Math.PI * 0.7), led); ledM.rotation.copy(collar.rotation); ledM.position.copy(collar.position); neck.add(ledM);
  const head = new THREE.Group(); head.position.set(0.17, 0.18, 0); neck.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), fur); skull.scale.set(1.15, 0.95, 0.95); head.add(skull);
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.085, 0.1), muzzleM); muzzle.position.set(0.14, -0.035, 0); head.add(muzzle);
  const jaw = new THREE.Group(); jaw.position.set(0.07, -0.075, 0); head.add(jaw);
  const jawM = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.025, 0.085), muzzleM); jawM.position.set(0.07, 0, 0); jaw.add(jawM);
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.008, 0.045), mat(0x6a3a40, 0.6)); tongue.position.set(0.1, 0.004, 0); jaw.add(tongue);
  const noseM = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), nose); noseM.position.set(0.225, -0.005, 0); head.add(noseM);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), eyeM); e.position.set(0.09, 0.035, s * 0.06); head.add(e); }
  const ears = [];
  for (const s of [-1, 1]) {
    const ep = new THREE.Group(); ep.position.set(-0.02, 0.07, s * 0.07); head.add(ep);
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.07), fur2); ear.position.set(0, -0.05, 0); ep.add(ear);
    ep.userData.s = s; ears.push(ep);
  }
  const legs = [];
  for (const [lx, s, front] of [[0.25, -1, 1], [0.25, 1, 1], [-0.27, -1, 0], [-0.27, 1, 0]]) {
    const hip = new THREE.Group(); hip.position.set(lx, -0.06, s * 0.1); body.add(hip);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.16, 4, 8), front ? fur2 : fur); up.position.y = -0.1; hip.add(up);
    const knee = new THREE.Group(); knee.position.y = -0.2; hip.add(knee);
    const lo = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.15, 4, 8), fur2); lo.position.y = -0.09; knee.add(lo);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), muzzleM); paw.scale.set(1.4, 0.6, 1); paw.position.set(0.02, -0.19, 0); knee.add(paw);
    legs.push({ hip, knee, s, front, phase: front ? 0 : Math.PI });
  }
  const tail = new THREE.Group(); tail.position.set(-0.42, 0.06, 0); body.add(tail);
  const tailM = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.3, 8), fur); tailM.position.y = 0.15; tail.add(tailM);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.raycast = () => {}; } });
  return { root, body, neck, head, jaw, ears, legs, tail, tongue };
}

/* ───────────────────────────── mouse ───────────────────────────── */
function buildMouse() {
  const root = new THREE.Group(); root.name = "house_mouse";
  const fur = mat(0x4a423c, 0.95), belly = mat(0x6a5f55, 0.95), earM = mat(0x6e5656, 0.7), tailM = mat(0x5d4b46, 0.7);
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0x2ee6ff, emissiveIntensity: 0.12, roughness: 0.1, metalness: 0.3 });
  const body = new THREE.Group(); body.position.y = 0.024; root.add(body);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), fur); torso.scale.set(1.65, 0.85, 1.0); body.add(torso);
  const bel = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), belly); bel.scale.set(1.5, 0.6, 0.9); bel.position.y = -0.01; body.add(bel);
  const head = new THREE.Group(); head.position.set(0.045, 0.004, 0); body.add(head);
  const skull = new THREE.Mesh(new THREE.ConeGeometry(0.019, 0.045, 10), fur); skull.rotation.z = -Math.PI / 2; skull.position.x = 0.012; head.add(skull);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 6, 5), mat(0x2a1a1c, 0.4)); nose.position.x = 0.036; head.add(nose);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 6, 5), eyeM); e.position.set(0.012, 0.008, s * 0.011); head.add(e);
    const ear = new THREE.Mesh(new THREE.CircleGeometry(0.012, 12), new THREE.MeshStandardMaterial({ color: 0x6e5656, roughness: 0.7, side: THREE.DoubleSide })); ear.position.set(-0.002, 0.017, s * 0.012); ear.rotation.y = s * 0.9 + Math.PI / 2; head.add(ear);
    for (const k of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.0004, 0.0004, 0.03, 3), mat(0x9a9088, 0.5)); w.rotation.set(Math.PI / 2, 0, k * 0.25 * s); w.position.set(0.03, 0.0, s * 0.012); head.add(w); }
  }
  void earM;
  const legs = [];
  for (const [lx, s] of [[0.026, -1], [0.026, 1], [-0.02, -1], [-0.02, 1]]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.003, 0.018, 5), belly); l.position.set(lx, -0.017, s * 0.016); body.add(l); legs.push({ l, lx, s });
  }
  const tail = [];
  let parent = body, px = -0.05;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Group(); seg.position.set(i === 0 ? px : -0.016, i === 0 ? -0.004 : 0, 0); parent.add(seg);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0022 - i * 0.0002, 0.0026 - i * 0.0002, 0.017, 5), tailM); m.rotation.z = Math.PI / 2; m.position.x = -0.008; seg.add(m);
    tail.push(seg); parent = seg;
  }
  root.traverse((o) => { if (o.isMesh) o.raycast = () => {}; });
  return { root, body, head, legs, tail };
}

/* ───────────────────────────── audio (shared AudioContext of the engine) ───────────────────────────── */
class DogVoice {
  constructor(getCtx) { this.getCtx = getCtx; this._noise = null; this._pant = null; }
  _ctx() { const c = this.getCtx && this.getCtx(); return c && c.state !== "closed" ? c : null; }
  _noiseBuf(c) { if (this._noise) return this._noise; const b = c.createBuffer(1, c.sampleRate * 1.0, c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return (this._noise = b); }
  bark(vol = 1, n = 2) {
    const c = this._ctx(); if (!c || vol < 0.02) return;
    for (let k = 0; k < n; k++) {
      const t = c.currentTime + k * 0.24 + Math.random() * 0.03;
      const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(380, t); o.frequency.exponentialRampToValueAtTime(190, t + 0.16);
      const ns = c.createBufferSource(); ns.buffer = this._noiseBuf(c);
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(1100, t); bp.frequency.exponentialRampToValueAtTime(520, t + 0.16); bp.Q.value = 2.2;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      const gn = c.createGain(); gn.gain.value = 0.5;
      o.connect(bp); ns.connect(gn).connect(bp); bp.connect(g).connect(c.destination);
      o.start(t); o.stop(t + 0.22); ns.start(t); ns.stop(t + 0.22);
    }
  }
  growl(vol = 1, dur = 1.0) {
    const c = this._ctx(); if (!c || vol < 0.02) return; const t = c.currentTime;
    const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = 78;
    const lfo = c.createOscillator(); lfo.frequency.value = 17; const lg = c.createGain(); lg.gain.value = 0.05 * vol;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 380;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09 * vol, t + 0.2); g.gain.setValueAtTime(0.09 * vol, t + dur - 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lfo.connect(lg).connect(g.gain); o.connect(lp).connect(g).connect(c.destination);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }
  pant(on, vol = 1) {
    const c = this._ctx(); if (!c) return;
    if (on && !this._pant) {
      const ns = c.createBufferSource(); ns.buffer = this._noiseBuf(c); ns.loop = true;
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1400; bp.Q.value = 1.1;
      const am = c.createGain(); am.gain.value = 0; const lfo = c.createOscillator(); lfo.frequency.value = 3.2; const lg = c.createGain(); lg.gain.value = 0.035;
      const out = c.createGain(); out.gain.value = 0;
      lfo.connect(lg).connect(am.gain); ns.connect(bp).connect(am).connect(out).connect(c.destination); ns.start(); lfo.start();
      this._pant = { ns, lfo, out };
    }
    if (this._pant) this._pant.out.gain.setTargetAtTime(on ? Math.min(1, vol) : 0, c.currentTime, 0.2);
  }
}

/* ───────────────────────────── controller ───────────────────────────── */
export class YardLife {
  constructor(scene, drive) {
    this.drive = drive;
    this.root = new THREE.Group(); this.root.name = "yard_life"; scene.add(this.root);
    this.solids = [];
    const yp = buildYardProps(this.root, this.solids);
    buildLandingBridge(this.root); // logic27 (Ben 3:59 AM): truss + neon dressing for the Landing Bridge deck (sky_l_landing_b)
    this.hides = yp.hides;
    this.dogSolids = this.solids.filter((b) => b.min.y < 0.55); // he can't duck under anything lower than his chest
    this.voice = new DogVoice(() => drive && drive._engineAudio && drive._engineAudio._ctx);
    this.dogM = buildDog(); this.dogM.root.userData.creature = true; this.root.add(this.dogM.root);
    this.mouseM = buildMouse(); this.mouseM.root.userData.creature = true; this.root.add(this.mouseM.root);
    this.dog = { x: DOG_T.house.x - 0.95, z: DOG_T.house.z, yaw: DOG_T.house.yaw + Math.PI, v: 0, state: "sleep", t: 0, cd: 0, noSee: 0, seeT: 0,
      last: null, sniffPts: [], sniffI: 0, sniffT: 0, inR: false, nearT: 0, rollCd: 0, gait: 0, barkCd: 0, lieK: 1, earK: 0, lookT: 0 };
    this.dog.yaw = 0; // lies facing out (+x local → world −x is west); yaw = heading angle atan2(dx,dz) convention
    this.dog.yaw = Math.atan2(-1, 0);
    this.mouse = { on: false, t: 0, hideT: 6 + rnd() * 10, x: 0, y: 0, z: 0, yaw: 0, v: 0, goal: null, mode: "idle", modeT: 0, gait: 0, sniff: 0, fade: 0 };
    this.mouseM.root.visible = false;
    this.events = []; this.stats = { wakes: 0, rolls: 0, catches: 0, giveUps: 0, mouseDodges: 0, mouseWaits: 0 };
    this.enabled = true;
    this.dogVisualUpdate(0);
  }
  getColliders() { return this.solids; }
  setVisible(v) { this.root.visible = v; }
  _ev(type, extra) { const e = { type, t: this.drive ? this.drive._time : 0, ...extra }; this.events.push(e); if (this.events.length > 200) this.events.shift(); if (this.onEvent) this.onEvent(e); }
  _toast(text) { const d = this.drive; if (d && d.onHud) d.onHud({ mode: "toast", text }); }

  /* —— geometry helpers —— */
  _dogBlocked(x, z, r = DOG_T.radius) {
    if (!inTerritory(x, z)) return true;
    for (const b of this.dogSolids) if (x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z) return true;
    const d = this.drive; if (d && d._wallsNear) for (const b of d._wallsNear(x, z, r + 0.3)) if (b.min.y < 0.55 && b.max.y > 0.08 && !b.rail && x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z) return true;
    return false;
  }
  _sight(car) {
    const d = this.dog, p = car.position;
    if (p.y > 0.4 || !inTerritory(p.x, p.z, 1.2)) return false; // up a road / out of his yard → out of reach and out of mind
    const dist = Math.hypot(p.x - d.x, p.z - d.z); if (dist > DOG_T.sightMax) return false;
    for (const h of this.hides) { const c = h.cover; if (c && p.x > c.x0 && p.x < c.x1 && p.z > c.z0 && p.z < c.z1 && !(d.x > c.x0 && d.x < c.x1 && d.z > c.z0 && d.z < c.z1)) return false; } // dark under the deck: he can't make you out from outside
    const ex = d.x + Math.sin(d.yaw) * 0.45, ez = d.z + Math.cos(d.yaw) * 0.45, ey = 0.62;
    const ty = p.y + 0.05;
    // hide solids + every house solid (garage walls etc.) occlude
    const seg = (b) => { const o = [ex, ey, ez], dd = [p.x - ex, ty - ey, p.z - ez]; let t0 = 0, t1 = 1; const mn = [b.min.x, b.min.y, b.min.z], mx = [b.max.x, b.max.y, b.max.z];
      for (let k = 0; k < 3; k++) { if (Math.abs(dd[k]) < 1e-9) { if (o[k] < mn[k] || o[k] > mx[k]) return false; continue; } let ta = (mn[k] - o[k]) / dd[k], tb = (mx[k] - o[k]) / dd[k]; if (ta > tb) { const q = ta; ta = tb; tb = q; } t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return false; } return t1 > 0.001 && t0 < 0.999; };
    for (const b of this.solids) if (seg(b)) return false;
    const dr = this.drive; if (dr && dr._segSolidHit && dr._segSolidHit(ex, ey, ez, p.x, ty, p.z, 0) < 0.995) return false;
    return true;
  }
  // a resting dog is solid: the car is pushed out of his body (no driving through him) and the bump wakes him
  _dogBodyContact(car) {
    const d = this.dog; if (d.state === "chase") return; // a chasing dog that reaches you catches you (see _catch)
    const p = car.position; if (p.y > 0.3) return;
    const ax = Math.sin(d.yaw), az = Math.cos(d.yaw), hx = d.x + ax * 0.15, hz = d.z + az * 0.15; // body axis ≈ 0.95 m long
    const rx = p.x - hx, rz = p.z - hz, u = Math.max(-0.5, Math.min(0.5, rx * ax + rz * az));
    const cx = hx + ax * u, cz = hz + az * u, dx = p.x - cx, dz = p.z - cz, dist = Math.hypot(dx, dz), R = 0.22 + 0.078;
    if (dist >= R) return;
    const nx = dist > 1e-6 ? dx / dist : -az, nz = dist > 1e-6 ? dz / dist : ax;
    p.x = cx + nx * R; p.z = cz + nz * R; car.speed *= -0.25; this.stats.bumps = (this.stats.bumps || 0) + 1;
    if (d.state === "sleep" && d.cd <= 0) { this._toast("You bumped the dog!"); this._wake(); }
  }
  carHidden(car) { const p = car.position; return !!this.hides.find((h) => Math.hypot(p.x - h.x, p.z - h.z) < 0.6); }

  /* —— dog brain —— */
  _dogMove(tx, tz, vmax, dt) {
    const d = this.dog, want = Math.atan2(tx - d.x, tz - d.z), dist = Math.hypot(tx - d.x, tz - d.z);
    // choose a free heading near the wanted one (probe 0.7 m ahead)
    let best = null;
    for (const off of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.5, -1.5, 2.1, -2.1, 2.8]) {
      const h = want + off, px = d.x + Math.sin(h) * 0.7, pz = d.z + Math.cos(h) * 0.7;
      if (!this._dogBlocked(px, pz) && !this._dogBlocked(d.x + Math.sin(h) * 0.3, d.z + Math.cos(h) * 0.3)) { best = h; break; }
    }
    const vTarget = best == null ? 0 : Math.min(vmax, dist < 0.4 ? dist * 2 : vmax);
    if (best == null) best = want;
    let dy = best - d.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    const k = Math.min(1, Math.abs(d.v) / DOG_T.runMax), turn = DOG_T.turnLo + (DOG_T.turnHi - DOG_T.turnLo) * k;
    d.yaw += Math.max(-turn * dt, Math.min(turn * dt, dy));
    const slow = Math.abs(dy) > 1.2 ? 0.45 : 1; // sharp turn → he has to check his speed
    const vt = vTarget * slow;
    d.v += Math.max(-DOG_T.decel * dt, Math.min(DOG_T.accel * dt, vt - d.v));
    const nx = d.x + Math.sin(d.yaw) * d.v * dt, nz = d.z + Math.cos(d.yaw) * d.v * dt;
    if (!this._dogBlocked(nx, nz)) { d.x = nx; d.z = nz; }
    else if (!this._dogBlocked(nx, d.z)) { d.x = nx; d.v *= 0.8; }
    else if (!this._dogBlocked(d.x, nz)) { d.z = nz; d.v *= 0.8; }
    else d.v *= 0.3;
    return dist;
  }
  _setDog(state) { const d = this.dog; if (d.state === state) return; d.state = state; d.t = 0; this._ev("dog:" + state); }
  _dogUpdate(dt, car, crashed) {
    const d = this.dog, H = DOG_T.house, p = car.position;
    d.t += dt; d.barkCd = Math.max(0, d.barkCd - dt); d.rollCd = Math.max(0, d.rollCd - dt);
    const dh = Math.hypot(p.x - H.x, p.z - H.z), carGround = p.y < 0.4;
    const vol = Math.max(0, 1 - Math.hypot(p.x - d.x, p.z - d.z) / 18);
    switch (d.state) {
      case "sleep": {
        d.v = 0; d.cd = Math.max(0, d.cd - dt);
        const inR = carGround && dh < DOG_T.trigger && !crashed;
        if (inR && !d.inR && d.cd <= 0 && d.rollCd <= 0) {
          this.stats.rolls++; d.rollCd = DOG_T.rollCd;
          if (rnd() < DOG_T.chance) { this._wake(); break; }
          d.lookT = 2.2; this._ev("dog:stir"); // lifts his head, watches, settles
        }
        d.inR = inR;
        d.nearT = carGround && dh < DOG_T.nearWake && d.cd <= 0 ? d.nearT + dt : 0;
        if (d.nearT > DOG_T.nearT) this._wake();
        d.lookT = Math.max(0, d.lookT - dt);
        break;
      }
      case "alert": if (d.t > DOG_T.alertT) { this._setDog("bark"); this.voice.bark(vol, 2); } break;
      case "bark": if (d.t > DOG_T.barkT) { this._setDog("chase"); d.noSee = 0; this._toast("Dog is chasing!"); this.voice.pant(true, vol * 0.6); } break;
      case "chase": case "search": {
        d.seeT -= dt;
        if (d.seeT <= 0) { d.seeT = 0.1; d.sees = this._sight(car); }
        if (d.sees) { d.last = { x: p.x, z: p.z }; d.noSee = 0; if (d.state === "search") { this._setDog("chase"); this._toast("Dog spotted you!"); if (d.barkCd <= 0) { this.voice.bark(vol, 1); d.barkCd = 2.5; } } }
        else d.noSee += dt;
        if (d.state === "chase") {
          if (!d.sees) { this._setDog("search"); this._toast("Dog lost you"); this._planSniff(); break; }
          this._dogMove(p.x, p.z, DOG_T.runMax, dt);
          if (d.barkCd <= 0 && rnd() < dt * 0.35) { this.voice.bark(vol, 1); d.barkCd = 1.8; }
          // catch: mouth reaches the car on the ground
          const mx = d.x + Math.sin(d.yaw) * DOG_T.mouth, mz = d.z + Math.cos(d.yaw) * DOG_T.mouth;
          if (!crashed && carGround && Math.hypot(p.x - mx, p.z - mz) < DOG_T.catchR + 0.06 && p.y < DOG_T.catchY) { this._catch(); }
        } else {
          // search: last known spot, then sniff a widening ring around it
          const tgt = d.sniffPts[d.sniffI];
          if (tgt) {
            const dist = this._dogMove(tgt.x, tgt.z, d.sniffI === 0 ? DOG_T.searchSpeed * 1.4 : DOG_T.searchSpeed, dt);
            if (dist < 0.45 || d.sniffT > 6) { d.sniffT += dt; d.v *= 0.9; if (d.sniffT > (d.sniffI === 0 ? 2.2 : 1.4) + 0.45) { d.sniffI++; d.sniffT = 0; if (d.sniffI >= d.sniffPts.length) this._planSniff(true); } }
            else d.sniffT += dt * 0.15;
          }
          if (d.noSee >= DOG_T.giveUp) { this._setDog("return"); this.stats.giveUps++; this._toast("The dog gave up"); this.voice.pant(false); }
        }
        break;
      }
      case "return": {
        const hx = H.x - 0.95, hz = H.z;
        const dist = this._dogMove(hx, hz, DOG_T.walk, dt);
        if (dist < 0.25) { this._setDog("lie"); d.v = 0; }
        if (d.t > 60) { d.x = hx; d.z = hz; this._setDog("lie"); }
        break;
      }
      case "lie": {
        let dy = Math.atan2(-1, 0) - d.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; d.yaw += dy * Math.min(1, dt * 2.5);
        if (d.t > 1.4) { this._setDog("sleep"); d.cd = DOG_T.cooldown; d.inR = true; d.nearT = 0; }
        break;
      }
    }
  }
  _wake() { const d = this.dog; this.stats.wakes++; this._setDog("alert"); d.nearT = 0; this._toast("The dog woke up…"); const p = this.drive.car.position; this.voice.growl(Math.max(0.2, 1 - Math.hypot(p.x - d.x, p.z - d.z) / 18), 1.0); }
  _planSniff(widen = false) {
    const d = this.dog, L = d.last || { x: d.x, z: d.z }; const R = widen ? 2.2 + rnd() * 1.6 : 1.3;
    const pts = [{ x: L.x, z: L.z }];
    for (let i = 0; i < 4; i++) { const a = rnd() * Math.PI * 2; const x = L.x + Math.sin(a) * R, z = L.z + Math.cos(a) * R; pts.push({ x, z }); }
    // snap any point inside a solid to the nearest free spot so he nose-pokes at hide entrances
    d.sniffPts = pts.map((q) => { if (!this._dogBlocked(q.x, q.z)) return q; for (let r = 0.2; r < 2; r += 0.2) for (let a = 0; a < 6.28; a += 0.5) { const x = q.x + Math.sin(a) * r, z = q.z + Math.cos(a) * r; if (!this._dogBlocked(x, z)) return { x, z }; } return { x: d.x, z: d.z }; });
    d.sniffI = 0; d.sniffT = 0;
  }
  _catch() {
    const dr = this.drive; this.stats.catches++; this._ev("dog:catch");
    this.voice.bark(1, 2); this.voice.pant(false);
    dr._crashMessage = "The dog got you!";
    dr.car.crashed = true; // → the same crash/restart path as a big fall
    this._setDog("return"); this.dog.noSee = 0;
  }
  onRespawn() { const d = this.dog; if (d.state === "chase" || d.state === "search" || d.state === "alert" || d.state === "bark") { this._setDog("return"); this.voice.pant(false); } }

  /* —— mouse brain —— */
  _mouseFloorOk(x, z, y) {
    const w = this.drive.world; if (!w) return false;
    const s = w.surfacesAt(x, z).filter((q) => Math.abs(q.y - y) < 0.057 && !q.block);
    if (!s.length) return false;
    y = Math.max(...s.map((q) => q.y)); // logic27: test walls against the floor it will actually stand on
    const d = this.drive; if (d._wallsNear) for (const b of d._wallsNear(x, z, 0.3)) if (b.min.y < y + 0.05 && b.max.y > y + 0.01 && !b.rail && x + 0.05 > b.min.x && x - 0.05 < b.max.x && z + 0.05 > b.min.z && z - 0.05 < b.max.z) return false;
    return Math.max(...s.map((q) => q.y));
  }
  _onRoad(x, z, y) { return this.drive.world.surfacesAt(x, z).some((q) => q.kind === "road" && Math.abs(q.y - y) < 0.06); }
  _mouseSpawn(car) {
    const rooms = this.mouseRooms || [];
    for (let tries = 0; tries < 60; tries++) {
      const r = rooms[(rnd() * rooms.length) | 0]; if (!r) return false;
      const x = r.x0 + 0.6 + rnd() * (r.x1 - r.x0 - 1.2), z = r.z0 + 0.6 + rnd() * (r.z1 - r.z0 - 1.2);
      const y = this._mouseFloorOk(x, z, r.y); if (y === false) continue;
      const dc = Math.hypot(x - car.position.x, z - car.position.z);
      if (Math.abs(car.position.y - y) < 1 && (dc < 2.5 || (tries < 40 && dc > 14))) continue; // not on top of the car; prefer somewhere you might see it
      if (this._onRoad(x, z, y)) continue;
      Object.assign(this.mouse, { on: true, x, y, z, yaw: rnd() * 6.28, v: 0, goal: null, mode: "idle", modeT: 1 + rnd() * 2, t: 0, life: 35 + rnd() * 45, fade: 0, room: r });
      this._ev("mouse:spawn", { x, z, y });
      return true;
    }
    return false;
  }
  _mouseGoal() {
    const m = this.mouse, r = m.room;
    for (let k = 0; k < 20; k++) {
      const a = rnd() * 6.28, dist = 0.6 + rnd() * 2.6, x = m.x + Math.sin(a) * dist, z = m.z + Math.cos(a) * dist;
      if (r && (x < r.x0 + 0.2 || x > r.x1 - 0.2 || z < r.z0 + 0.2 || z > r.z1 - 0.2)) continue;
      if (this._mouseFloorOk(x, z, m.y) === false) continue;
      if (!this._mousePathOk(m.x, m.z, x, z)) continue;
      return { x, z };
    }
    return null;
  }
  _mousePathOk(ax, az, bx, bz) {
    const m = this.mouse, n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.08);
    let y = m.y;
    for (let i = 1; i <= n; i++) { const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n; const ny = this._mouseFloorOk(x, z, y); if (ny === false) return false; y = ny; }
    return true;
  }
  _mouseUpdate(dt, car) {
    const m = this.mouse;
    if (!m.on) { m.hideT -= dt; if (m.hideT <= 0) { if (!this._mouseSpawn(car)) m.hideT = 3; } return; }
    m.t += dt; m.modeT -= dt;
    const p = car.position, sameLevel = Math.abs(p.y - m.y) < 0.3;
    // threat: closest approach of the car's straight-line path over the next 1.2 s
    let threat = null;
    if (sameLevel) {
      const fx = Math.sin(car.yaw) * car.speed, fz = Math.cos(car.yaw) * car.speed;
      let best = 9, bt = 0;
      for (let t = 0; t <= 1.2; t += 0.1) { const cx = p.x + fx * t, cz = p.z + fz * t; const dd = Math.hypot(cx - m.x, cz - m.z); if (dd < best) { best = dd; bt = t; } }
      if (best < 0.32 && (Math.abs(car.speed) > 0.08 || best < 0.16)) threat = { fx, fz, t: bt, d: best };
    }
    if (threat && m.mode !== "dodge") {
      // step aside perpendicular to the car's path, on the side the mouse is already on; freeze if both sides are walls
      const sp = Math.hypot(threat.fx, threat.fz) || 1, nx = -threat.fz / sp, nz = threat.fx / sp;
      const side = ((m.x - p.x) * nx + (m.z - p.z) * nz) >= 0 ? 1 : -1;
      let goal = null;
      for (const s of [side, -side]) for (const dist of [0.42, 0.3, 0.55]) { const gx = m.x + nx * s * dist, gz = m.z + nz * s * dist; if (this._mouseFloorOk(gx, gz, m.y) !== false && this._mousePathOk(m.x, m.z, gx, gz) && !this._onRoad(gx, gz, m.y)) { goal = { x: gx, z: gz }; break; } if (goal) break; }
      if (!goal) for (const s of [side, -side]) { const gx = m.x + nx * s * 0.42, gz = m.z + nz * s * 0.42; if (this._mouseFloorOk(gx, gz, m.y) !== false && this._mousePathOk(m.x, m.z, gx, gz)) { goal = { x: gx, z: gz }; break; } }
      if (goal) { m.goal = goal; m.mode = "dodge"; m.modeT = 1.6; this.stats.mouseDodges++; this._ev("mouse:dodge"); }
      else if (m.mode !== "wait") { m.mode = "wait"; m.modeT = 0.8; m.goal = null; this.stats.mouseWaits++; this._ev("mouse:wait"); }
    }
    const speed = m.mode === "dodge" ? 1.55 : m.mode === "walk" ? 0.55 : 0;
    if (m.mode === "idle" || m.mode === "sniff" || m.mode === "wait") {
      m.v = 0;
      if (m.modeT <= 0) {
        if (m.t > m.life) { m.mode = "leave"; m.goal = this._mouseGoal(); m.modeT = 4; }
        else { const g = this._mouseGoal(); if (g) { m.goal = g; m.mode = "walk"; m.modeT = 6; } else m.modeT = 0.6; }
      }
      // never loiter in a lane
      if (m.mode !== "walk" && this._onRoad(m.x, m.z, m.y) && m.modeT > 0.4) m.modeT = 0.4;
    }
    if ((m.mode === "walk" || m.mode === "dodge" || m.mode === "leave") && m.goal) {
      const dx = m.goal.x - m.x, dz = m.goal.z - m.z, dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz); let dy = want - m.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      m.yaw += Math.max(-9 * dt, Math.min(9 * dt, dy));
      const sp = m.mode === "leave" ? 0.8 : speed;
      const step = Math.min(dist, sp * dt * (Math.abs(dy) > 1.2 ? 0.3 : 1));
      const nx = m.x + Math.sin(m.yaw) * step, nz = m.z + Math.cos(m.yaw) * step;
      const ny = this._mouseFloorOk(nx, nz, m.y);
      if (ny !== false) { m.x = nx; m.z = nz; m.y = ny; m.v = step / dt; } else { m.goal = null; m.v = 0; }
      if (!m.goal || dist < 0.03 || m.modeT <= 0) {
        if (m.mode === "leave") { m.on = false; m.hideT = 15 + rnd() * 30; this._ev("mouse:leave"); return; }
        m.mode = rnd() < 0.55 ? "sniff" : "idle"; m.modeT = 0.8 + rnd() * 2.2; m.goal = null; m.v = 0;
      }
    }
    if (m.mode === "leave" && !m.goal) { m.on = false; m.hideT = 15 + rnd() * 30; return; }
    // soft contact: a car that still reaches it just nudges it aside (the car never feels it)
    const dc = Math.hypot(p.x - m.x, p.z - m.z);
    if (sameLevel && dc < 0.13) { const ax = (m.x - p.x) / (dc || 1), az = (m.z - p.z) / (dc || 1); for (const k of [0.14, 0.08]) { const ny = this._mouseFloorOk(m.x + ax * k, m.z + az * k, m.y); if (ny !== false) { m.x += ax * k; m.z += az * k; m.y = ny; break; } } }
  }

  /* —— visuals —— */
  dogVisualUpdate(dt) {
    const d = this.dog, M = this.dogM, T = this._vt = (this._vt || 0) + dt;
    M.root.position.set(d.x, 0, d.z); M.root.rotation.y = d.yaw - Math.PI / 2; // model +x is forward
    const lying = d.state === "sleep" || d.state === "lie";
    d.lieK += ((lying ? 1 : 0) - d.lieK) * Math.min(1, dt * 3);
    const run = Math.min(1, Math.abs(d.v) / DOG_T.runMax);
    d.gait += dt * (2 + 9 * run) * (Math.abs(d.v) > 0.02 ? 1 : 0);
    const L = d.lieK, breath = Math.sin(T * (lying ? 1.6 : 3.4)) * 0.008;
    M.body.position.y = 0.46 - 0.3 * L + breath + Math.abs(Math.sin(d.gait)) * 0.03 * run;
    M.body.rotation.z = Math.sin(d.gait * 2) * 0.03 * run;
    for (const lg of M.legs) {
      const sw = Math.sin(d.gait + lg.phase + (lg.s > 0 ? 0.6 : 0)) * (0.25 + 0.55 * run);
      lg.hip.rotation.z = (1 - L) * sw + L * (lg.front ? -1.35 : 1.25);
      lg.knee.rotation.z = (1 - L) * Math.max(0, -sw) * 0.8 + L * (lg.front ? 0.2 : -2.0);
    }
    const alert = d.state === "alert" || d.state === "bark" || d.state === "chase" || d.lookT > 0;
    const sniffing = d.state === "search" && d.sniffT > 0;
    d.earK += ((alert ? 1 : d.state === "search" ? 0.6 : 0) - d.earK) * Math.min(1, dt * 6);
    for (const e of M.ears) { e.rotation.x = e.userData.s * (0.55 - 0.5 * d.earK); e.rotation.z = -0.25 + 0.55 * d.earK; }
    const headLift = lying ? (d.lookT > 0 || d.state === "lie" ? 0.15 : -0.45) : 0;
    M.neck.rotation.z = sniffing ? -0.9 + Math.sin(T * 9) * 0.06 : d.state === "chase" ? -0.25 : d.state === "return" ? -0.35 : headLift;
    M.head.rotation.y = sniffing ? Math.sin(T * 2.3) * 0.4 : d.lookT > 0 ? 0.3 * Math.sin(T * 0.8) : 0;
    const barking = d.state === "bark" || (d.state === "chase" && d.barkCd > 1.5);
    M.jaw.rotation.z = barking ? -0.25 - 0.2 * Math.abs(Math.sin(T * 18)) : d.state === "chase" || d.state === "search" ? -0.18 : d.state === "alert" ? -0.06 : 0;
    M.tongue.visible = d.state === "chase" || d.state === "search" || d.state === "return";
    M.tail.rotation.z = d.state === "return" ? -0.9 : d.state === "chase" ? 0.6 + Math.sin(T * 7) * 0.15 : d.state === "alert" || d.state === "bark" ? 0.9 : lying ? -1.2 + Math.sin(T * 0.7) * 0.05 : 0.2 + Math.sin(T * 5) * 0.4;
    M.tail.rotation.x = d.state === "sleep" ? 0 : Math.sin(T * (d.state === "search" ? 6 : 3)) * 0.2;
  }
  mouseVisualUpdate(dt) {
    const m = this.mouse, M = this.mouseM, T = this._mt = (this._mt || 0) + dt;
    m.fade = Math.max(0, Math.min(1, m.fade + (m.on ? dt * 3 : -dt * 3)));
    M.root.visible = m.fade > 0.01 && this.root.visible;
    if (!M.root.visible) return;
    M.root.position.set(m.x, m.y + 0.004, m.z); M.root.rotation.y = m.yaw - Math.PI / 2; M.root.scale.setScalar(0.5 + 0.5 * m.fade);
    const moving = m.v > 0.02; m.gait += dt * (moving ? 18 + m.v * 14 : 0);
    for (const l of M.legs) l.l.rotation.z = moving ? Math.sin(m.gait + (l.lx > 0 ? 0 : Math.PI) + (l.s > 0 ? 1.4 : 0)) * 0.9 : 0;
    M.body.position.y = 0.024 + (moving ? Math.abs(Math.sin(m.gait)) * 0.004 : 0);
    const sniff = m.mode === "sniff" || m.mode === "idle";
    M.head.rotation.z = sniff ? Math.sin(T * 13) * 0.08 - 0.05 : m.mode === "wait" ? 0.15 : 0;
    M.head.rotation.y = sniff ? Math.sin(T * 1.7) * 0.5 : 0;
    M.tail.forEach((s, i) => { s.rotation.y = Math.sin(T * (moving ? 9 : 2) - i * 0.6) * (moving ? 0.22 : 0.12); s.rotation.z = i === 0 ? 0.25 : -0.05; });
  }

  update(dt, active = true) {
    if (!this.enabled) return;
    const d = this.drive, car = d.car;
    if (active) {
      if (!this.mouseRooms) this._initRooms();
      this._dogUpdate(dt, car, !!d._crashPhase || car.crashed);
      this._dogBodyContact(car);
      this._mouseUpdate(dt, car);
      if (this.dog.state !== "sleep") this.voice.pant(this.dog.state === "chase" || this.dog.state === "search" || this.dog.state === "return", Math.max(0, 1 - Math.hypot(car.position.x - this.dog.x, car.position.z - this.dog.z) / 14) * 0.7);
    }
    this.dogVisualUpdate(dt); this.mouseVisualUpdate(dt);
  }
  _initRooms() {
    this.mouseRooms = [];
    const R = this.drive.mansion && this.drive.mansion.rooms;
    const list = this.roomDefs || [];
    for (const r of list) {
      if (r.outdoor) continue; const [w, , dd] = r.size, [x, y, z] = r.pos;
      if (y > 5 || y < -1) continue; // ground + first floor (cellar is too dark to ever see him)
      this.mouseRooms.push({ id: r.id, x0: x - w / 2, x1: x + w / 2, z0: z - dd / 2, z1: z + dd / 2, y });
    }
    void R;
  }
}

// logic27: dressing for the Landing ⇄ Library bridge (deck itself is the loft path sky_l_landing_b, x 1.4, y 7.2).
// Everything sits outside / below the drivable deck (no coplanar faces): a navy belly pan, two slim gunmetal Warren
// trusses along the open span (z −0.25…0.25) and thin cyan neon strips on the truss chords.
export function buildLandingBridge(root, X = 1.4, Y = 7.2) {
  const g = new THREE.Group(); g.name = "landing_bridge"; root.add(g);
  const gun = new THREE.MeshStandardMaterial({ color: 0x2a3038, metalness: 0.75, roughness: 0.38 });
  const navy = new THREE.MeshStandardMaterial({ color: 0x141c30, metalness: 0.4, roughness: 0.55 });
  const neon = new THREE.MeshBasicMaterial({ color: 0x3fe0f0 });
  const B = (sx, sy, sz, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); o.rotation.x = rx; g.add(o); return o; };
  const z0 = -0.27, z1 = 0.27, L = z1 - z0;
  B(0.84, 0.03, L, navy, X, Y - 0.075, 0);                      // belly pan under the deck
  for (const sd of [-1, 1]) {
    const x = X + sd * 0.445;
    B(0.025, 0.025, L, gun, x, Y - 0.06, 0);                    // bottom chord
    B(0.025, 0.025, L, gun, x, Y + 0.075, 0);                   // top chord (beside the kerb, outside the lane)
    B(0.012, 0.008, L, neon, x + sd * 0.016, Y + 0.075, 0);      // neon on the top chord
    B(0.012, 0.008, L, neon, x + sd * 0.016, Y - 0.06, 0);       // and the bottom chord
    const n = 3, h = 0.135, w = L / n;
    for (let i = 0; i < n; i++) {                               // Warren diagonals
      const za = z0 + i * w, ang = Math.atan2(h, w) * (i % 2 ? 1 : -1);
      B(0.014, 0.014, Math.hypot(w, h), gun, x, Y + 0.0075, za + w / 2, ang);
    }
  }
  return g;
}
