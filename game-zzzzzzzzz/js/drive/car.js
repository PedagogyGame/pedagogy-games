import * as THREE from "three";

/**
 * Premium miniature RC vehicles — toy/mouse scale (~0.10–0.11 m long).
 * Manual RC physics: free steer, surface support, gravity falls, crash.
 * Types: car | suv | jeep | convertible — distinct meshes + handling.
 */
export const CAR_K = 0.87 * 0.88; // logic28 (Ben 12:04 PM "12% smaller and yet 8% faster"): 0.7656 · logic16: car ~13% smaller (mesh, wheels, collider, camera rig all × CAR_K)
export const CAR_SCALE = 0.190 * CAR_K; // ~0.42 m → ~0.079 m length — small mouse RC in mansion rooms

/** logic8: free drive — the car has NO road grip assist / magnet of any kind. */
const GRAV_AIR = 9.5;    // logic15: floatier flight (was 12) — real air time off kickers   // logic13: flight gravity (toy-scale feel; jumps read as hops, not drops)
const KICKER_POP = 2.0;  // logic13: kicker ramps have a sprung lip
const STICK_DOWN_CAR = 0.06; // drops bigger than this per step are real falls (matches world.STICK_DOWN)

/**
 * Visual orientation caps (radians) — keep car planted/upright.
 * Bank = lateral roll only (NOT climb grade). Grade drives subtle pitch separately.
 * Hard caps kill sideways tip at ramp creases / ribbon joins.
 */
export const VISUAL_BANK_MAX = 0.020;       // ±1.15° normal floor/ramp/deck (upright cruise)
export const VISUAL_BANK_MAX_CHUTE = 0.14;  // ±8° intentional chute barrel
export const GRADE_PITCH_SCALE = 0.18;      // visual pitch from snap.grade (softer)
export const GRADE_PITCH_MAX = 0.085;       // ±4.9° body pitch cap
// logic28 steering pipeline (keys + mouse steer). Tap (≈50 ms) → ≈0.05 of lock; hold → full lock at rampT.
export const YAW_MAX = 2.05 * 1.08; // rad/s (logic27 2.05): r = v/ω stays the logic27 turning circle at 1.08× speed
export const FALL = { frac: 0.6, outdoorH: 4.2 }; // logic28 fall-damage rule
export const STEER = { rampT: 0.32, ease: 1.25, buildRate: 9.0, returnRate: 12, reverseRate: 9, lockHigh: 1.0, vLockLo: 0.5, vLockHi: 1.75, yawDamp: 14, graceT: 0.15 };
// logic28 fix: lockHigh 0.85→1.0 — the high-speed authority cut widened the super-turbo turning circle ~18% past logic27, so the car overran the chandelier-spiral foot onto the landing (L25/SPIRAL). Steadiness at speed comes from rampT/buildRate instead. Same pass: returnRate 7.5→12 / reverseRate 6→9 — with full authority at speed the slower self-centre let the wheel overshoot each correction (tour driver ran off the climb_b bend into the landing wall); quicker centring kills the overshoot without touching tap/hold response.
if (globalThis.__STEER_OVR) Object.assign(STEER, globalThis.__STEER_OVR); // test hook
export const STEER_LEAN_MAX = 0.028;        // ±1.6° steer lean (softened)

/** Handling / look presets (base values; tiny-car precision). */
export const VEHICLE_PRESETS = {
  // Driver-feel cruise sweet spot — fun to wander (not crawl, not twitchy rocket)
  // car maxSpeed ~1.38, boost ~1.88, steerRate ~3.26, steer lerp ~2.30 (smooth cruise)
  car: {
    id: "car",
    label: "Car",
    blurb: "Balanced · joyful cruise",
    maxSpeed: 1.49, // logic28 ×1.08 (was 1.38)
    boostMax: 2.03, // logic28 ×1.08 (was 1.88)
    accel: 6.372, // logic28 ×1.08 (was 5.9)
    brake: 14.0,
    friction: 7.6,
    steerRate: 3.18,
    bodyColor: 0xd32f2f,
    accent: 0xfff3e0,
  },
  suv: {
    id: "suv",
    label: "SUV",
    blurb: "Taller · calm cruise",
    maxSpeed: 1.382, // logic28 ×1.08 (was 1.28)
    boostMax: 1.922, // logic28 ×1.08 (was 1.78)
    accel: 5.832, // logic28 ×1.08 (was 5.4)
    brake: 13.5,
    friction: 8.0,
    steerRate: 3.02,
    bodyColor: 0x1565c0,
    accent: 0xeceff1,
  },
  jeep: {
    id: "jeep",
    label: "Jeep",
    blurb: "Chunky · grippy roam",
    maxSpeed: 1.318, // logic28 ×1.08 (was 1.22)
    boostMax: 1.858, // logic28 ×1.08 (was 1.72)
    accel: 6.048, // logic28 ×1.08 (was 5.6)
    brake: 15,
    friction: 8.6,
    steerRate: 3.12,
    bodyColor: 0x2e7d32,
    accent: 0xfff59d,
  },
  convertible: {
    id: "convertible",
    label: "Convertible",
    blurb: "Open-top · nimble cruise",
    maxSpeed: 1.598, // logic28 ×1.08 (was 1.48)
    boostMax: 2.16, // logic28 ×1.08 (was 2.00)
    accel: 7.02, // logic28 ×1.08 (was 6.5)
    brake: 13.5,
    friction: 7.0,
    steerRate: 3.55,
    bodyColor: 0xf9a825,
    accent: 0x212121,
  },
};

export class RCCar {
  constructor(vehicleId = "car") {
    this.root = new THREE.Group();
    this.root.name = "rc_car";
    this.bodyPivot = new THREE.Group();
    this.root.add(this.bodyPivot);
    // NOSE_MATCH_FORWARD: mesh nose was modeled toward -Z; travel uses +Z at yaw 0
    this.bodyPivot.rotation.y = Math.PI;

    this.wheels = [];
    this.speed = 0;
    this.yaw = Math.PI;
    this.vy = 0;
    this.vehicleId = "car";
    this.maxSpeed = 1.501; // logic28 ×1.08 (was 1.39)
    this.boostMax = 2.052; // logic28 ×1.08 (was 1.90)
    this.accel = 6.48; // logic28 ×1.08 (was 6.0)
    this.brake = 15;
    this.friction = 7.1;
    this.steerRate = 3.26;
    this.wheelBase = 0.055;
    this.onTrack = true;
    this.airborne = false;
    this.crashed = false; this.crashReason = null; this._airApexY = null;
    this._unsupportedFrames = 0;
    this._fallStartY = 0;
    this._lastElevated = false;
    this._smoothBank = 0;
    this._smoothGrade = 0;
    this._kissY = null;
    this._crestSquat = 0;
    this._prevGrade = 0;
    this._brakeLight = 0; // #4 reactive brakes IGNORED — static tails only
    this._baseTailEmissive = 0.55;
    this._throttleSmooth = 0;
    this._steerInput = 0;
    this._bodyRoll = 0;
    this._landingDamp = 0;
    this._driftTrail = 0;
    this._boosting = false;
    this._idlePhase = 0;
    this._tumble = 0;
    this._scrape = 0;
    this._justLanded = 0;
    this._headMats = [];
    this._glowMat = null;
    this._wheelRadius = 0.048 * CAR_SCALE;
    this.setVehicle(vehicleId);
  }

  get length() {
    return 0.45 * CAR_SCALE;
  }

  /** Swap mesh + handling flavor. Keeps pose/scale. */
  setVehicle(id) {
    const preset = VEHICLE_PRESETS[id] || VEHICLE_PRESETS.car;
    this.vehicleId = preset.id;
    this.maxSpeed = preset.maxSpeed;
    this.boostMax = preset.boostMax;
    this.accel = preset.accel;
    this.brake = preset.brake;
    this.friction = preset.friction;
    this.steerRate = preset.steerRate;

    // Clear previous mesh
    while (this.bodyPivot.children.length) {
      const c = this.bodyPivot.children[0];
      this.bodyPivot.remove(c);
      if (c.geometry) c.geometry.dispose?.();
    }
    for (const w of this.wheels) {
      this.root.remove(w);
    }
    this.wheels = [];
    this._headMats = [];
    this._glowMat = null;

    this._build(preset);
    this.root.scale.setScalar(CAR_SCALE);
  }

  _mats(preset) {
    // Toy RC paint: glossy lacquer, clear glass, rubber tires — not candy boxes
    const candy = new THREE.MeshStandardMaterial({
      color: preset.bodyColor, roughness: 0.22, metalness: 0.38,
    });
    const cream = new THREE.MeshStandardMaterial({
      color: preset.accent, roughness: 0.36, metalness: 0.22,
    });
    const glass = new THREE.MeshStandardMaterial({
      color: 0x88c9e8, roughness: 0.06, metalness: 0.55,
      transparent: true, opacity: 0.42,
      emissive: 0x4fc3f7, emissiveIntensity: 0.04,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x141418, roughness: 0.72, metalness: 0.22,
    });
    const chrome = new THREE.MeshStandardMaterial({
      color: 0xf5f7fa, roughness: 0.14, metalness: 0.95,
    });
    const rubber = new THREE.MeshStandardMaterial({
      color: 0x1a1a1c, roughness: 0.95, metalness: 0.02,
    });
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0xcfd8dc, roughness: 0.28, metalness: 0.85,
    });
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xfffde7, emissive: 0xffe082, emissiveIntensity: 0.55,
      roughness: 0.18, metalness: 0.35,
    });
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff1744, emissive: 0xff1744, emissiveIntensity: 0.4, roughness: 0.3,
    });
    const underglow = new THREE.MeshStandardMaterial({
      color: preset.bodyColor, emissive: preset.bodyColor, emissiveIntensity: 0.08,
      transparent: true, opacity: 0.18, roughness: 0.55,
    });
    this._headMats = [headMat, tailMat];
    this._glowMat = underglow;
    return { candy, cream, glass, dark, chrome, rubber, hubMat, headMat, tailMat, underglow };
  }

  _addWheels(m, layout, tireR = 0.048, tireW = 0.038) {
    const tireGeo = new THREE.CylinderGeometry(tireR, tireR, tireW, 16);
    const sidewallGeo = new THREE.CylinderGeometry(tireR * 0.92, tireR * 0.92, tireW + 0.006, 16);
    const hubGeo = new THREE.CylinderGeometry(tireR * 0.42, tireR * 0.42, tireW + 0.008, 12);
    const rimGeo = new THREE.CylinderGeometry(tireR * 0.62, tireR * 0.62, tireW + 0.003, 14);
    this._wheelRadius = tireR * CAR_SCALE;
    for (const [x, z] of layout) {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(x, tireR, z);
      const tire = new THREE.Mesh(tireGeo, m.rubber);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = false;
      wheelGroup.add(tire);
      // Slightly inset sidewall ring — reads as real tire depth
      const side = new THREE.Mesh(sidewallGeo, m.dark);
      side.rotation.z = Math.PI / 2;
      wheelGroup.add(side);
      const rim = new THREE.Mesh(rimGeo, m.chrome);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(rim);
      const hub = new THREE.Mesh(hubGeo, m.hubMat);
      hub.rotation.z = Math.PI / 2;
      wheelGroup.add(hub);
      for (let i = 0; i < 5; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.005, tireR * 0.55, 0.007), m.chrome);
        spoke.rotation.z = Math.PI / 2;
        spoke.rotation.x = (i / 5) * Math.PI;
        wheelGroup.add(spoke);
      }
      this.root.add(wheelGroup);
      this.wheels.push(wheelGroup);
    }
  }

  _buildCar(m) {
    const b = this.bodyPivot;
    // Chassis tub (low, wide — planted RC proportions)
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.255, 0.028, 0.46), m.dark);
    chassis.position.y = 0.042;
    chassis.castShadow = false;
    b.add(chassis);
    // Main body shell — single cohesive volume (not stacked candy boxes)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.235, 0.055, 0.42), m.candy);
    body.position.y = 0.078;
    body.castShadow = false;
    b.add(body);
    // Hood (slightly lower / tapered nose)
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.032, 0.14), m.candy);
    hood.position.set(0, 0.088, -0.175);
    hood.castShadow = false;
    b.add(hood);
    // Wheel-arch lips
    for (const [sx, sz] of [[-0.12, -0.13], [0.12, -0.13], [-0.12, 0.13], [0.12, 0.13]]) {
      const arch = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.022, 0.07), m.dark);
      arch.position.set(sx, 0.058, sz);
      b.add(arch);
    }
    // Racing stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.01, 0.40), m.cream);
    stripe.position.set(0, 0.108, -0.02);
    b.add(stripe);
    // Cabin greenhouse — framed glass (toy RC windshield/roof)
    const cabinBase = new THREE.Mesh(new THREE.BoxGeometry(0.188, 0.018, 0.175), m.dark);
    cabinBase.position.set(0, 0.112, 0.01);
    b.add(cabinBase);
    const wind = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.055, 0.012), m.glass);
    wind.position.set(0, 0.148, -0.065);
    wind.rotation.x = -0.35;
    b.add(wind);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.012, 0.12), m.candy);
    roof.position.set(0, 0.178, 0.02);
    b.add(roof);
    const sideGlassL = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.045, 0.11), m.glass);
    sideGlassL.position.set(-0.09, 0.148, 0.015);
    b.add(sideGlassL);
    const sideGlassR = sideGlassL.clone();
    sideGlassR.position.x = 0.09;
    b.add(sideGlassR);
    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.04, 0.01), m.glass);
    rearGlass.position.set(0, 0.155, 0.085);
    rearGlass.rotation.x = 0.28;
    b.add(rearGlass);
    // Compact rear wing
    for (const sx of [-0.065, 0.065]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.04, 0.014), m.dark);
      post.position.set(sx, 0.155, 0.175);
      b.add(post);
    }
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.014, 0.048), m.cream);
    spoiler.position.set(0, 0.178, 0.175);
    b.add(spoiler);
    this._addBumpersLights(m, 0.082);
    this._addWheels(m, [[-0.128, -0.135], [0.128, -0.135], [-0.128, 0.135], [0.128, 0.135]], 0.05, 0.04);
  }

  _buildSuv(m) {
    const b = this.bodyPivot;
    // Tall wagon — chassis + shell (less candy-stack)
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.03, 0.47), m.dark);
    chassis.position.y = 0.05;
    chassis.castShadow = false;
    b.add(chassis);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.255, 0.05, 0.45), m.candy);
    lower.position.y = 0.078;
    lower.castShadow = false;
    b.add(lower);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.095, 0.40), m.candy);
    body.position.y = 0.145;
    body.castShadow = false;
    b.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.28), m.glass);
    cabin.position.set(0, 0.22, 0.02);
    b.add(cabin);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.26), m.dark);
    roof.position.set(0, 0.275, 0.02);
    b.add(roof);
    // Roof rails
    for (const sx of [-0.08, 0.08]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.02, 0.3), m.chrome);
      rail.position.set(sx, 0.29, 0.0);
      b.add(rail);
    }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.4), m.cream);
    stripe.position.set(0, 0.2, -0.02);
    b.add(stripe);
    this._addBumpersLights(m, 0.09, 0.26);
    this._addWheels(m, [[-0.13, -0.14], [0.13, -0.14], [-0.13, 0.14], [0.13, 0.14]], 0.055, 0.045);
  }

  _buildJeep(m) {
    const b = this.bodyPivot;
    // Chunky short wheelbase, open cage
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.4), m.candy);
    lower.position.y = 0.08;
    lower.castShadow = false;
    b.add(lower);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.36), m.candy);
    body.position.y = 0.14;
    body.castShadow = false;
    b.add(body);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.12), m.candy);
    hood.position.set(0, 0.15, -0.16);
    b.add(hood);
    // Roll cage
    for (const sx of [-0.1, 0.1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.12, 0.018), m.dark);
      post.position.set(sx, 0.24, 0.05);
      b.add(post);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.016, 0.016), m.dark);
    bar.position.set(0, 0.3, 0.05);
    b.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.18), m.dark);
    bar2.position.set(0, 0.3, -0.02);
    b.add(bar2);
    // Spare tire on back
    const spare = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.016, 8, 14), m.rubber);
    spare.position.set(0, 0.16, 0.22);
    spare.rotation.y = Math.PI / 2;
    b.add(spare);
    // Snorkel / grill bars
    for (let i = -1; i <= 1; i++) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.008), m.chrome);
      g.position.set(i * 0.04, 0.14, -0.22);
      b.add(g);
    }
    this._addBumpersLights(m, 0.1, 0.28);
    this._addWheels(m, [[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]], 0.058, 0.05);
  }

  _buildConvertible(m) {
    const b = this.bodyPivot;
    // Low sleek open-top
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.04, 0.46), m.candy);
    lower.position.y = 0.05;
    lower.castShadow = false;
    b.add(lower);
    const mid = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.04, 0.4), m.candy);
    mid.position.y = 0.085;
    mid.castShadow = false;
    b.add(mid);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.14), m.candy);
    nose.position.set(0, 0.08, -0.2);
    b.add(nose);
    // Open cockpit (no cabin glass roof) — windshield only
    const wind = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.012), m.glass);
    wind.position.set(0, 0.14, -0.08);
    b.add(wind);
    const windFrame = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.01, 0.02), m.chrome);
    windFrame.position.set(0, 0.17, -0.08);
    b.add(windFrame);
    // Soft-top folded stack
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.08), m.dark);
    top.position.set(0, 0.12, 0.14);
    b.add(top);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 0.38), m.cream);
    stripe.position.set(0, 0.11, -0.02);
    b.add(stripe);
    // Low spoiler lip
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.012, 0.03), m.cream);
    lip.position.set(0, 0.1, 0.2);
    b.add(lip);
    this._addBumpersLights(m, 0.07);
    this._addWheels(m, [[-0.12, -0.135], [0.12, -0.135], [-0.12, 0.13], [0.12, 0.13]], 0.045, 0.036);
  }

  _addBumpersLights(m, lightY = 0.078, bumperW = 0.25) {
    const b = this.bodyPivot;
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(bumperW, 0.028, 0.035), m.chrome);
    frontBumper.position.set(0, 0.048, -0.225);
    b.add(frontBumper);
    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(bumperW * 0.96, 0.028, 0.03), m.chrome);
    rearBumper.position.set(0, 0.048, 0.22);
    b.add(rearBumper);
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.012), m.chrome);
      arm.position.set(sx * 0.12, lightY + 0.04, -0.08);
      b.add(arm);
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.028, 0.022), m.chrome);
      mirror.position.set(sx * 0.145, lightY + 0.04, -0.08);
      b.add(mirror);
    }
    for (const sx of [-0.07, 0.07]) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), m.headMat);
      h.position.set(sx, lightY, -0.225);
      h.scale.z = 0.7;
      b.add(h);
    }
    for (const sx of [-0.07, 0.07]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.022, 0.018), m.tailMat);
      t.position.set(sx, lightY, 0.225);
      b.add(t);
    }
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.008, 0.32), m.underglow);
    glow.position.y = 0.018;
    b.add(glow);
  }

  _build(preset) {
    const m = this._mats(preset);
    if (preset.id === "suv") this._buildSuv(m);
    else if (preset.id === "jeep") this._buildJeep(m);
    else if (preset.id === "convertible") this._buildConvertible(m);
    else this._buildCar(m);
  }

  setLightsSubtle(subtle) {
    const head = subtle ? 0.22 : 0.85;
    const tail = subtle ? 0.15 : 0.55;
    const glow = subtle ? 0.06 : 0.28;
    const glowOp = subtle ? 0.12 : 0.35;
    this._lightsSubtle = !!subtle;
    this._baseTailEmissive = tail;
    if (this._headMats[0]) this._headMats[0].emissiveIntensity = head;
    if (this._headMats[1]) this._headMats[1].emissiveIntensity = tail; // #4 static — no reactive brake punch
    if (this._glowMat) {
      this._glowMat.emissiveIntensity = glow;
      this._glowMat.opacity = glowOp;
    }
  }

  /** Reactive brake lights (#4) — IGNORED / no-op; leave static or minimal. */
  _updateBrakeLights(_braking, _dt) {
    this._brakeLight = 0;
    if (this._lightsSubtle || !this._headMats[1]) return;
    const base = this._baseTailEmissive != null ? this._baseTailEmissive : 0.55;
    this._headMats[1].emissiveIntensity = base; // static cruise tails only
  }

  setPose(x, y, z, yaw) {
    this.root.position.set(x, y, z);
    this.yaw = yaw;
    this.root.rotation.y = yaw;
    this.root.rotation.x = 0;
    this.root.rotation.z = 0;
    this.vy = 0;
    this.speed = 0;
    this._yawRate = 0; this._steerHold = 0; this._steerKeyDir = 0; this._steerGap = 0;
    this._steerInput = 0; // kill residual steer so re-enter/pure-W does not yaw-drift
    this._throttleSmooth = 0; // logic3: no residual throttle after re-enter / respawn (car crept + steer jerk)
    this.airborne = false;
    this.crashed = false; this.crashReason = null; this._airApexY = null;
    this._unsupportedFrames = 0;
    this._fallStartY = 0;
    this._lastElevated = false;
    this._smoothBank = 0;
    this._smoothGrade = 0;
    this._kissY = null;
    this._crestSquat = 0;
    this._prevGrade = 0; this._lastGoodGrade = 0;
    this._brakeLight = 0;
    this._bodyRoll = 0;
    this._landingDamp = 0;
    this._driftTrail = 0;
    this._tumble = 0;
    this._scrape = 0;
    this._justLanded = 0;
    this._boosting = false;
    this.bodyPivot.rotation.z = 0;
    this.bodyPivot.rotation.x = 0;
  }

  resetBoost() {
    this._boosting = false;
  }

  /**
   * logic8 FREE-DRIVE step. No paths, no snapping, no magnets, no lateral pulls.
   * env = { world: DriveWorld, boxesNear(x,z,r) → AABB colliders, radius }
   * The car goes where its wheels take it; height = the real surface under the wheels;
   * walls/furniture/pillars/ramp keels/deck sides stop it; holes and deck edges drop it.
   * Returns { scrape, landed, fell, void, hit, hitHeadOn, surface, grade } for FX / sims.
   */
  update(dt, keys, env) {
    const flags = { scrape: 0, landed: false, fell: false, void: false, hit: false, hitHeadOn: false, surface: null, grade: 0 };
    if (this.crashed) return flags;
    const world = env && env.world;
    if (!world) return flags;
    const r = (env && env.radius) || 0.09 * CAR_K;
    const p = this.root.position;

    const throttle = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
    let steer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    // logic20 MOUSE STEER: an analog wheel (−1..1, +left) when no steering key is held — keys always win
    if (!steer && typeof keys.steerAnalog === "number" && Number.isFinite(keys.steerAnalog)) steer = Math.max(-1, Math.min(1, keys.steerAnalog));
    // logic28 (Ben 12:09 PM "turn less with single A/D pushes … sensitive, smooth, dynamic"): analog-style keyboard
    // steering. A held key builds its own command along an ease-in curve (full lock after STEER.rampT); release
    // self-centres fast; reversal is rate-limited (no snap); lock shrinks with speed. Mouse steer is already analog
    // and feeds the same rate-limited pipeline.
    const S = STEER, keyDir = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    // Feathering: a re-press of the SAME key within S.graceT of letting go carries on its build (rapid taps steer like a
    // partial hold, as on a real wheel) — an isolated tap still only nudges; the other key always starts from zero.
    if (keyDir !== 0) {
      if (keyDir !== this._steerKeyDir || (this._steerGap || 0) > S.graceT) { this._steerKeyDir = keyDir; this._steerHold = 0; }
      this._steerGap = 0;
      this._steerHold = Math.min(S.rampT, (this._steerHold || 0) + dt);
    } else { this._steerGap = (this._steerGap || 0) + dt; if (this._steerGap > S.graceT) { this._steerKeyDir = 0; this._steerHold = 0; } }
    const absV0 = Math.abs(this.speed || 0);
    const lock = 1 - (1 - S.lockHigh) * THREE.MathUtils.smoothstep(absV0, S.vLockLo, S.vLockHi);
    let cmd = keyDir !== 0 ? keyDir * Math.pow(this._steerHold / S.rampT, S.ease) : steer; // steer = analog when no key
    cmd *= lock;
    const cur = this._steerInput, towardZero = Math.abs(cmd) < Math.abs(cur) && Math.sign(cmd || -cur) !== Math.sign(cur) || cmd === 0;
    const rate = cmd === 0 ? S.returnRate : (Math.sign(cmd) !== Math.sign(cur) && cur !== 0 ? S.reverseRate : (towardZero ? S.returnRate : S.buildRate));
    const dlt = cmd - cur, mx = rate * dt;
    this._steerInput = cur + Math.max(-mx, Math.min(mx, dlt));
    if (cmd === 0 && Math.abs(this._steerInput) < 0.004) this._steerInput = 0;
    if (globalThis.__STEER_L27) this._steerInput = THREE.MathUtils.lerp(cur, steer, Math.min(1, 2.55 * dt)); // diagnostic: logic27 steering

    const boxes = env.boxesNear ? env.boxesNear(p.x, p.z, r + 0.3) : [];
    let onRoadNow = false;
    const isBlocked = (x, z, y) => world.blocked(boxes, x, z, y, r, onRoadNow);
    // Spawned / landed overlapping a solid box: push straight out of it first (never "through")
    if (isBlocked(p.x, p.z, p.y) && env.clear) {
      const c = env.clear(p.x, p.z, p.y);
      p.x = c.x; p.z = c.z;
    }
    const startBlocked = isBlocked(p.x, p.z, p.y); // still wedged (e.g. under a deck lip) → allow moves that free it

    // Move horizontally by (dx,dz) at ride height y with hard collision + wall slide.
    // Returns achieved fraction along the intended direction.
    const moveXZ = (dx, dz, y) => {
      const want = Math.hypot(dx, dz);
      if (want < 1e-9) return 1;
      if (!isBlocked(p.x + dx, p.z + dz, y)) { p.x += dx; p.z += dz; return 1; }
      if (startBlocked && !world._boxBlocks(boxes, p.x + dx, p.z + dz, y, r)) { p.x += dx; p.z += dz; return 1; }
      // logic16 SOFT RAIL: a deck-edge rail redirects the car along itself (keeps the along-rail
      // part of the motion + a nudge back into the lane) instead of stopping it.
      const rb = world._boxBlocks(boxes, p.x + dx, p.z + dz, y, r);
      if (rb && rb.rail) {
        // logic16 SOFT RAIL: project the move off every rail it would touch (iterating, so rail
        // joints on a curve — concave or convex — never pin the car), plus a tiny nudge inward.
        const railN = (tx, tz) => { let nx = 0, nz = 0, hard = false;
          for (const b of boxes) {
            if (!world._boxBlocks([b], tx, tz, y, r)) continue;
            if (!b.rail) { hard = true; continue; }
            const R = b.rail, ax = R.x1 - R.x0, az = R.z1 - R.z0, L2 = ax * ax + az * az || 1e-9;
            const u = Math.max(0, Math.min(1, ((tx - R.x0) * ax + (tz - R.z0) * az) / L2));
            const qx = tx - (R.x0 + ax * u), qz = tz - (R.z0 + az * u), ql = Math.hypot(qx, qz) || 1; nx += qx / ql; nz += qz / ql; this._railTan = Math.atan2(ax, az);
          }
          const l = Math.hypot(nx, nz); return { hard, nx: l ? nx / l : 0, nz: l ? nz / l : 0, any: l > 0 }; };
        let mx = dx, mz = dz;
        for (let it = 0; it < 4; it++) {
          const n = railN(p.x + mx, p.z + mz);
          if (n.hard) break;
          if (!n.any) { p.x += mx; p.z += mz; flags.railSlide = true; this._railYaw = Math.atan2(mx, mz) * Math.sign(this.speed || 1); return 1; }
          const into = mx * n.nx + mz * n.nz;
          if (into < 0) { mx -= into * n.nx; mz -= into * n.nz; }
          mx += n.nx * 0.0015; mz += n.nz * 0.0015;
        }
      }
      flags.hit = true;
      const okX = !isBlocked(p.x + dx, p.z, y);
      const okZ = !isBlocked(p.x, p.z + dz, y);
      let mx = 0, mz = 0;
      if (okX && okZ) { if (Math.abs(dx) >= Math.abs(dz)) mx = dx; else mz = dz; }
      else if (okX) mx = dx;
      else if (okZ) mz = dz;
      p.x += mx; p.z += mz;
      const along = (mx * dx + mz * dz) / (want * want);
      if (along < 0.25) flags.hitHeadOn = true;
      return along;
    };

    // ── Airborne: gravity, no air steering, land on whatever is below ──────────────
    if (this.airborne) {
      const yPrev = p.y;
      this._airApexY = Math.max(this._airApexY ?? p.y, p.y); // logic28 fall rule: drop measured from the arc apex
      this.vy -= GRAV_AIR * dt;
      this._airT = (this._airT || 0) + dt;
      this.speed *= 1 - Math.min(1, 0.15 * dt); // logic15: launch keeps its ramp speed
      // logic15 gentle AIR CONTROL: a little yaw from the wheel while flying
      this.yaw += this._steerInput * 0.85 * dt * Math.sign(this.speed || 1);
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      const frac = moveXZ(fx * this.speed * dt, fz * this.speed * dt, p.y);
      if (frac < 0.999) this.speed *= Math.max(0, frac);
      p.y += this.vy * dt;
      // logic13: a kerb-step-high top swept into sideways while falling (threshold, rug edge) is
      // landed ON — never end up inside it (no burial)
      const g = world.groundAt(p.x, p.z, yPrev, 0.054);
      if (g && p.y <= g.y) {
        const impact = Math.abs(this.vy);
        p.y = g.y; // logic13: land ON the surface top (never below it → no burial)
        this._squash = Math.min(1, 0.25 + impact * 0.9); // suspension squash on touchdown
        this._lastAir = this._airT || 0; this._airT = 0; this.jumps = (this.jumps || 0) + (this._launched ? 1 : 0); this._launched = false;
        this.vy = 0;
        this.airborne = false;
        this._justLanded = Math.min(0.3, 0.1 + impact * 0.04);
        this._noLaunchT = 0.22; // logic15: no re-launch bounce on touchdown
        this._landingDamp = Math.min(1, impact * 0.12);
        flags.landed = true;
        flags.surface = g.kind;
        // logic28 (Ben 12:12 PM) FALL DAMAGE: a free-fall drop (arc apex → landing) of more than 60 % of the room's
        // floor-to-ceiling height at the landing point is a crash ("Too far a fall!"); outdoors uses one storey (4.2 m).
        const drop = (this._airApexY ?? g.y) - g.y, roomH = (env.roomHeightAt && env.roomHeightAt(p.x, g.y, p.z)) || FALL.outdoorH;
        this._lastDrop = drop; this._lastDropRoomH = roomH; this._airApexY = null;
        if (!globalThis.__NO_FALL_DMG && drop > FALL.frac * roomH) { this.crashed = true; this.crashReason = "fall"; flags.fallDamage = drop; }
      }
      if (p.y < -6.5) flags.void = true;
      // logic13: nose follows the flight path (up off a kicker, tipping over at the apex)
      const airPitch = THREE.MathUtils.clamp(-Math.atan2(this.vy, Math.max(0.3, Math.abs(this.speed))) * 0.7, -0.35, 0.35)
        * Math.max(0.3, 1 - (this._airT || 0) * 1.1); // logic15: body levels out in flight → flat landings
      this.bodyPivot.rotation.x = THREE.MathUtils.lerp(this.bodyPivot.rotation.x, airPitch, Math.min(1, 6 * dt));
      this.bodyPivot.scale.set(1, 1, 1);
      this.root.rotation.y = this.yaw;
      return flags;
    }

    // ── Grounded ────────────────────────────────────────────────────────────────────
    const ground = world.groundAt(p.x, p.z, p.y);
    const onRoad = !!(ground && ground.kind === "road");
    onRoadNow = onRoad;
    flags.surface = ground ? ground.kind : null;

    // Real slope under the wheels: front/rear axle samples along the heading
    const fwdX0 = Math.sin(this.yaw), fwdZ0 = Math.cos(this.yaw);
    const AX = 0.045;
    const gF = world.groundAt(p.x + fwdX0 * AX, p.z + fwdZ0 * AX, p.y + 0.03);
    const gR = world.groundAt(p.x - fwdX0 * AX, p.z - fwdZ0 * AX, p.y + 0.03);
    let grade = 0;
    if (gF && gR && Math.abs(gF.y - gR.y) < 0.08) grade = (gF.y - gR.y) / (2 * AX);
    grade = THREE.MathUtils.clamp(grade, -0.6, 0.6);
    // logic13: at a lip the front axle is already over the drop (no valid sample) — the takeoff
    // keeps the slope the wheels were just on
    const gradeValid = !!(gF && gR && Math.abs(gF.y - gR.y) < 0.08);
    const lipGrade = gradeValid ? grade : (this._lastGoodGrade || 0);
    if (gradeValid) this._lastGoodGrade = grade;
    flags.grade = grade;

    this._boosting = !!(keys.boost && (this.turboLevel || 0) >= 1 && Math.abs(this.speed) > 0.4);
    // logic15 TURBO (ghost books): Shift = +17% top speed & accel once unlocked (6 books);
    // Shift+Space = SUPER TURBO, a further +25% (12 books). Locked → Shift does nothing.
    const tl = this.turboLevel || 0;
    const turboMul = (keys.boost && tl >= 1) ? (keys.superTurbo && tl >= 2 ? 1.17 * 1.25 : 1.17) : 1;
    this.turboMul = turboMul;
    let maxV = this.maxSpeed * turboMul;
    // Surface feel: asphalt grippy & quick; wood/carpet a little softer (still fully drivable)
    let accelMul = 1, surfDrag = 1;
    if (onRoad) { accelMul = 1.08; surfDrag = 0.95; }
    else { accelMul = 0.9; surfDrag = 1.08; maxV *= 0.9; }
    this._surfaceCarpet = onRoad ? 0 : 1;

    if (this._throttleSmooth == null) this._throttleSmooth = 0;
    const thrRate = (Math.abs(throttle) < Math.abs(this._throttleSmooth) || throttle === 0) ? 16.0 : 4.4;
    this._throttleSmooth = THREE.MathUtils.lerp(this._throttleSmooth, throttle, Math.min(1, thrRate * dt));
    if (throttle === 0 && Math.abs(this._throttleSmooth) < 0.02) this._throttleSmooth = 0;
    const thr = this._throttleSmooth;
    if (thr > 0.02) {
      if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + this.brake * thr * dt); // W while rolling back = brake
      } else {
        const headroom = 1 - Math.min(1, Math.abs(this.speed) / maxV);
        const curve = 0.45 + 0.55 * headroom * headroom;
        this.speed = Math.min(this.speed + this.accel * turboMul * thr * curve * accelMul * dt, Math.max(this.speed, maxV));
      }
    } else if (thr < -0.02) {
      if (this.speed > 0) this.speed = Math.max(0, this.speed - this.brake * Math.abs(thr) * dt);
      else {
        const headroom = 1 - Math.min(1, Math.abs(this.speed) / (maxV * 0.42));
        this.speed -= this.accel * 0.6 * Math.abs(thr) * (0.45 + 0.55 * headroom) * dt;
      }
    }
    // Rolling drag (coast ≈1.1–1.3 s from cruise) — applied whenever the pedal is not pushing
    if (Math.abs(thr) <= 0.02 || (thr > 0 && throttle <= 0)) {
      const coast = (0.55 + 0.9 * Math.abs(this.speed)) * surfDrag * (1 - Math.min(1, Math.abs(thr)));
      if (this.speed > 0) this.speed = Math.max(0, this.speed - coast * dt);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + coast * dt);
    }
    // Gravity along the slope (toy-scale): climbing slows a little, rolling downhill speeds up
    const SLOPE_G = 1.4;
    if (Math.abs(this.speed) > 0.02 || Math.abs(grade) > 0.45) this.speed -= SLOPE_G * grade * dt;
    // logic16: over the (new, lower) top speed — e.g. Shift released — bleed off smoothly
    // (≈1.6 m/s²) instead of the old hard clamp that braked 32% in a single frame.
    if (this.speed > maxV) this.speed = Math.max(maxV, this.speed - 1.6 * dt);
    this.speed = Math.max(this.speed, -maxV * 0.42);

    if (this._landingDamp > 0) this._landingDamp = Math.max(0, this._landingDamp - 1.8 * dt);

    if (this._noLaunchT > 0) this._noLaunchT -= dt;
    const absV = Math.abs(this.speed);
    const lowBoost = 1.08 - 0.08 * THREE.MathUtils.smoothstep(absV, 0.08, 1.0);
    const highDamp = 1 - 0.42 * THREE.MathUtils.smoothstep(absV, 0.85, this.boostMax);
    const steerEff = this._steerInput * this.steerRate * Math.min(1.02, absV / 0.70 + 0.14) * lowBoost * highDamp;
    const maxDyaw = YAW_MAX * dt; // logic28: yaw-rate cap ×1.08 with the speed → same turning circle in the house as logic27
    // Steering only turns the car when the wheels roll (no pivot on the spot)
    const rollF = Math.min(1, absV / 0.05);
    // logic28 light yaw damping: the yaw rate eases toward the steering demand (no twitch on taps / mouse jitter)
    const wantRate = THREE.MathUtils.clamp(steerEff * Math.sign(this.speed || 1) * rollF, -YAW_MAX, YAW_MAX);
    this._yawRate = THREE.MathUtils.lerp(this._yawRate || 0, wantRate, Math.min(1, STEER.yawDamp * dt));
    this.yaw += THREE.MathUtils.clamp(this._yawRate * dt, -maxDyaw, maxDyaw);
    while (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
    while (this.yaw < -Math.PI) this.yaw += Math.PI * 2;

    this._driftTrail = THREE.MathUtils.lerp(this._driftTrail,
      Math.abs(this._steerInput) * THREE.MathUtils.smoothstep(absV, 0.9, 2.2) * 0.8, Math.min(1, 8 * dt));

    const fwdX = Math.sin(this.yaw), fwdZ = Math.cos(this.yaw);
    const x0 = p.x, z0 = p.z, y0 = p.y;
    this._railTan = null;
    const frac = moveXZ(fwdX * this.speed * dt, fwdZ * this.speed * dt, p.y);
    if (flags.railSlide && !flags.hit && this.speed > 0 && !globalThis.__NOREDIR) { // logic16: the rail turns the car along itself
      let dyw = Math.atan2(p.x - x0, p.z - z0) - this.yaw; while (dyw > Math.PI) dyw -= 2 * Math.PI; while (dyw < -Math.PI) dyw += 2 * Math.PI;
      // logic28: the rail's turn-in is geometric — logic27's 0.06 rad/frame at 1.38 = 2.6 rad per metre of rub for the 0.87 car;
      // per metre it scales with 1/car size (a 0.88× car aligns in 0.88× the distance), so at 1.49 that is 0.074 rad/frame.
      // a car rubbing a rail ends parallel to the rail itself (its tangent, either way along it) — not to the nudged motion
      if (this._railTan != null) { let d2 = this._railTan - this.yaw; while (d2 > Math.PI) d2 -= 2 * Math.PI; while (d2 < -Math.PI) d2 += 2 * Math.PI;
        if (Math.abs(d2) > Math.PI / 2) d2 += d2 > 0 ? -Math.PI : Math.PI; if (Math.abs(d2) < 0.2) { this.yaw += d2; dyw = 0; } } // last ~11°: the body settles flat against the rail
      const cap = Math.max(0.06, 0.06 * (Math.hypot(p.x - x0, p.z - z0) / (1.38 / 60)) / 0.88);
      this.yaw += THREE.MathUtils.clamp(dyw, -cap, cap);
      this.speed *= 1 - Math.min(0.04, Math.abs(dyw) * 0.08); // light rub, never a stop
    }
    if (flags.hit) {
      // Hard obstacle: the into-wall part of the motion is gone. Head-on = stop.
      if (flags.hitHeadOn) this.speed = 0;
      else this.speed *= Math.max(0, Math.min(1, frac));
      this._scrape = Math.min(1, this._scrape + 0.25);
      flags.scrape = 0.01 * (1 - frac);
    } else {
      this._scrape = Math.max(0, this._scrape - 3 * dt);
    }

    // Height = real surface under the wheels at the new spot
    const gN = world.groundAt(p.x, p.z, y0);
    // logic13 JUMPS: leaving a lip keeps the takeoff velocity (v·sinθ up a ramp/kicker), and a
    // fast crest whose next surface drops away from the ballistic line launches instead of sticking.
    const stepD = Math.hypot(p.x - x0, p.z - z0);
    const lipDrop = gN ? (y0 + Math.max(0, grade) * stepD) - gN.y : 0;
    const crestLaunch = gN && grade > 0.12 && absV > 0.6 && lipDrop > 0.012 && !this._noLaunch && !(this._noLaunchT > 0) && !(gF && gF.rug === "flap") && !(gR && gR.rug === "flap"); // logic14: a passing conveyor flap is not a ramp lip
    if (!gN || gN.y < y0 - STICK_DOWN_CAR || crestLaunch) {
      // Rolled off an edge / into a hole / off a ramp lip → real flight
      this.airborne = true; this._airApexY = p.y;
      const gT = crestLaunch ? grade : Math.max(lipGrade, this._prevGrade || 0); // the lip itself can read as a drop
      const sinA = gT / Math.sqrt(1 + gT * gT);
      const kick = ground && ground.rug === "kicker" ? KICKER_POP : 1;
      const kk = ground && ground.kicker;
      this.vy = gT > 0 ? (kk && kk.pop ? Math.abs(this.speed) * (sinA + kk.pop) : sinA * Math.abs(this.speed) * kick) : Math.min(0, -Math.max(0, -gT) * absV * 0.5);
      this._launched = gT > 0.08 && absV > 0.4;
      if (crestLaunch) p.y = y0 + Math.max(0, grade) * stepD; // leave along the ramp line
      this._airT = 0;
      this._fallStartY = y0;
      flags.fell = !this._launched;
      flags.launch = this._launched;
    } else {
      p.y = gN.y;
      flags.surface = gN.kind;
    }
    this.onTrack = flags.surface === "road";

    // Crest settle (#5) — fire when the slope under the wheels flattens after a climb
    const gPrev = this._prevGrade || 0;
    if (gPrev > 0.12 && grade < 0.05 && absV > 0.2 && this._crestSquat < 0.2) this._crestSquat = 1;
    this._prevGrade = grade;
    if (this._crestSquat > 0) this._crestSquat = Math.max(0, this._crestSquat - 2.2 * dt);

    this._smoothGrade = THREE.MathUtils.lerp(this._smoothGrade || 0, grade, Math.min(1, 10 * dt));
    const steerLean = -this._steerInput * STEER_LEAN_MAX * Math.min(1, absV / 1.2);
    this._bodyRoll = THREE.MathUtils.lerp(this._bodyRoll, steerLean, Math.min(1, 3.4 * dt));

    if (this._justLanded > 0) {
      this._justLanded = Math.max(0, this._justLanded - dt);
      this.speed *= 1 - Math.min(0.4, 0.6 * dt); // logic15: soft landings keep momentum
    }

    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z) || !Number.isFinite(this.speed)) {
      p.set(x0, y0, z0);
      this.speed = 0; this.vy = 0;
      return flags;
    }

    this.root.rotation.y = this.yaw;
    this.bodyPivot.rotation.z = this._bodyRoll;
    // Body pitch follows the real slope under the axles (nose up on a climb)
    const pitch = -Math.atan(this._smoothGrade || 0);
    const crestDip = (this._crestSquat || 0) * 0.040;
    // logic13 landing squash: body drops + flattens, springs back over ~0.3 s
    this._squash = Math.max(0, (this._squash || 0) - 3.4 * dt);
    const sq = this._squash * this._squash;
    this.bodyPivot.scale.set(1 + 0.06 * sq, 1 - 0.2 * sq, 1 + 0.04 * sq);
    this.bodyPivot.position.y = THREE.MathUtils.lerp(this.bodyPivot.position.y || 0, -crestDip * 0.25 - 0.012 * sq, Math.min(1, 12 * dt));
    this.bodyPivot.rotation.x = THREE.MathUtils.lerp(this.bodyPivot.rotation.x,
      pitch - this._landingDamp * 0.08 + crestDip * 0.9, Math.min(1, 10 * dt));

    const spin = (this.speed * dt) / Math.max(0.008, this._wheelRadius);
    for (const w of this.wheels) w.rotation.x += spin;
    this._updateBrakeLights(false, dt);
    this._idlePhase += dt;
    return flags;
  }

  idleTwitch(dt) {
    this._idlePhase += dt;
    if (Math.abs(this.speed) > 0.08 || this.airborne || this.crashed) return;
    const twitch = Math.sin(this._idlePhase * 1.7) * 0.35 * dt;
    for (const w of this.wheels) w.rotation.x += twitch;
    if (this._headMats[0]) {
      const blink = 0.55 + 0.35 * Math.sin(this._idlePhase * 2.4);
      this._headMats[0].emissiveIntensity = blink;
    }
  }

  get position() {
    return this.root.position;
  }

  getSpeedKmh() {
    return Math.abs(this.speed) * 3.6 * 2.8;
  }

  get isBoosting() {
    return this._boosting;
  }

  get driftTrail() {
    return this._driftTrail;
  }

  get scrapeAmount() {
    return this._scrape;
  }
}
