import * as THREE from "three";

/**
 * Premium miniature RC vehicles — toy/mouse scale (~0.10–0.11 m long).
 * Manual RC physics: free steer, surface support, gravity falls, crash.
 * Types: car | suv | jeep | convertible — distinct meshes + handling.
 */
export const CAR_SCALE = 0.190; // ~0.42 m → ~0.079 m length — small mouse RC in mansion rooms

/** Optional whisper of road grip when wheels on surface. OFF by default. */
export const ASSIST_MAGNET = false;

/**
 * Visual orientation caps (radians) — keep car planted/upright.
 * Bank = lateral roll only (NOT climb grade). Grade drives subtle pitch separately.
 * Hard caps kill sideways tip at ramp creases / ribbon joins.
 */
export const VISUAL_BANK_MAX = 0.020;       // ±1.15° normal floor/ramp/deck (upright cruise)
export const VISUAL_BANK_MAX_CHUTE = 0.14;  // ±8° intentional chute barrel
export const GRADE_PITCH_SCALE = 0.18;      // visual pitch from snap.grade (softer)
export const GRADE_PITCH_MAX = 0.085;       // ±4.9° body pitch cap
export const STEER_LEAN_MAX = 0.028;        // ±1.6° steer lean (softened)

/** Handling / look presets (base values; tiny-car precision). */
export const VEHICLE_PRESETS = {
  // Driver-feel cruise sweet spot — fun to wander (not crawl, not twitchy rocket)
  // car maxSpeed ~1.38, boost ~1.88, steerRate ~3.26, steer lerp ~2.30 (smooth cruise)
  car: {
    id: "car",
    label: "Car",
    blurb: "Balanced · joyful cruise",
    maxSpeed: 1.38,
    boostMax: 1.88,
    accel: 5.9,
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
    maxSpeed: 1.28,
    boostMax: 1.78,
    accel: 5.4,
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
    maxSpeed: 1.22,
    boostMax: 1.72,
    accel: 5.6,
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
    maxSpeed: 1.48,
    boostMax: 2.00,
    accel: 6.5,
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
    this.maxSpeed = 1.39;
    this.boostMax = 1.90;
    this.accel = 6.0;
    this.brake = 15;
    this.friction = 7.1;
    this.steerRate = 3.26;
    this.wheelBase = 0.055;
    this.onTrack = true;
    this.airborne = false;
    this.crashed = false;
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
    this._steerInput = 0; // kill residual steer so re-enter/pure-W does not yaw-drift
    this._throttleSmooth = 0; // logic3: no residual throttle after re-enter / respawn (car crept + steer jerk)
    this.airborne = false;
    this.crashed = false;
    this._unsupportedFrames = 0;
    this._fallStartY = 0;
    this._lastElevated = false;
    this._smoothBank = 0;
    this._smoothGrade = 0;
    this._kissY = null;
    this._crestSquat = 0;
    this._prevGrade = 0;
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

  _storyFloors() {
    // Match asphalt ride height (pathY = plank top + ASPHALT_RIDE 0.012)
    return [8.412, 4.212, 0.012, -4.188];
  }

  /** Nearest walkable story floor within band, or null if mid-air between stories. */
  _nearestStoryFloor(y) {
    let best = null;
    let bd = 0.55;
    for (const f of this._storyFloors()) {
      const d = Math.abs(y - f);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  /** Highest mansion floor strictly below fall start (story-aware crash landings). */
  _landingFloorY() {
    const start = this._fallStartY;
    for (const f of this._storyFloors()) {
      if (f < start - 0.35) return f;
    }
    return 0.012;
  }

  /**
   * Manual RC step.
   * snap: {x,y,z,yaw,onTrack,supported,bank,grade,kind,wallBounce,carpet,elevated,steep?}
   * Returns { scrape, landed, fell } flags for FX.
   */
  update(dt, keys, snap) {
    const flags = { scrape: 0, landed: false, fell: false };
    if (this.crashed) return flags;

    const throttle = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
    const steer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    // Planted steer — readable turn-in, no float/veer junk
    this._steerInput = THREE.MathUtils.lerp(this._steerInput, steer, Math.min(1, 2.55 * dt));

    const supported = !!(snap && (snap.supported || snap.onTrack || snap.carpet));
    const elevated = !!(snap?.elevated);
    const kind = snap?.kind || "";
    const inTube = kind === "shortcut" || kind === "mouse" || kind === "shaft" || kind === "tunnel";

    // Truly elevated = cornice/balcony/furniture/mid-ramp above story floor.
    // Ramp bases / floor asphalt must NEVER latch elevated (that caused floor crashes).
    const storyYNow = this._nearestStoryFloor(this.root.position.y);
    const trulyElevated = !!(elevated && snap && (
      snap.kind === "cornice" || snap.kind === "balcony"
      || (snap.y != null && storyYNow != null && snap.y > storyYNow + 0.45)
      || (snap.y != null && storyYNow == null && snap.y > 0.55)
    ));
    // Do not latch elevated grace while still under a ceiling deck
    const underCeiling = !!(elevated && snap?.y != null
      && (snap.y - this.root.position.y) > 0.28
      && kind !== "ramp" && !snap?.steep);
    if (supported && trulyElevated && !underCeiling) this._lastElevated = true;
    if (underCeiling) this._lastElevated = false;
    if (supported && (snap?.carpet || snap?.kind === "floor" || snap?.kind === "outdoor" || snap?.kind === "flower")) {
      this._lastElevated = false;
    }
    if (supported && snap?.onTrack && !trulyElevated) this._lastElevated = false;

    // Floor / outdoor / carpet = slow only. Crash ONLY after leaving elevated rail into void.
    if (supported && !this.airborne) {
      this._unsupportedFrames = 0;
      this._fallStartY = 0;
    } else if (!this.airborne) {
      this._unsupportedFrames += 1;
      const fromElev = !!(this._lastElevated || trulyElevated);
      const storyY = this._nearestStoryFloor(this.root.position.y);
      // Any story floor / outdoor ground band → carpet crawl, never fall
      const onFloorBand = storyY != null
        && Math.abs(this.root.position.y - storyY) < 0.85;
      if (onFloorBand) {
        this._lastElevated = false;
        this.root.position.y = THREE.MathUtils.lerp(
          this.root.position.y, storyY, Math.min(1, 10 * dt)
        );
        this._unsupportedFrames = 0;
      } else if (fromElev && this._unsupportedFrames >= 6) {
        // Brief grace after leaving deck — softens junction blips; hard crash only for true void
        this.airborne = true;
        this._fallStartY = this.root.position.y;
        this._lastElevated = false;
        this.vy = Math.min(this.vy, 0.15);
        flags.fell = true;
      } else if (!fromElev && this._unsupportedFrames >= 14) {
        // Mid-air between stories with no surface — rare; allow fall
        this.airborne = true;
        this._fallStartY = this.root.position.y;
        this.vy = Math.min(this.vy, 0.15);
        flags.fell = true;
      }
    }

    if (this.airborne) {
      // Tumble + gravity — committed falls, little air authority
      this.vy -= 16.8 * dt;
      this.speed *= 1 - Math.min(1, 1.35 * dt);
      this._tumble += dt;
      this.root.position.x += Math.sin(this.yaw) * this.speed * dt;
      this.root.position.z += Math.cos(this.yaw) * this.speed * dt;
      this.root.position.y += this.vy * dt;
      this.bodyPivot.rotation.x += 3.8 * dt;
      this.bodyPivot.rotation.z += 5.2 * dt * Math.sign(this._steerInput || 1);
      this.root.rotation.y = this.yaw;

      const floorY = this._landingFloorY();
      if (this.root.position.y <= floorY + 0.04 && this.vy < 0) {
        this.root.position.y = floorY;
        const bigFall = (this._fallStartY - floorY) > 0.7;
        if (this._tumble > 0.18 || Math.abs(this.vy) > 2.2 || bigFall) {
          this.crashed = true;
          this.speed = 0;
          this.vy = 0;
        } else {
          this.airborne = false;
          this.vy = 0;
          this._tumble = 0;
          this._justLanded = 0.35;
          flags.landed = true;
          this.bodyPivot.rotation.x = 0;
          this.bodyPivot.rotation.z = 0;
        }
      }
      if (this.root.position.y < -7) {
        this.crashed = true;
        this.speed = 0;
        this.vy = 0;
      }
      return flags;
    }

    // Grounded driving — slow precise toy feel
    this._boosting = !!(keys.boost && Math.abs(this.speed) > 0.4);
    let maxV = keys.boost ? this.boostMax : this.maxSpeed;
    if ((snap?.carpet && !snap.onTrack) || (!snap?.onTrack && !elevated && this._nearestStoryFloor(this.root.position.y) != null)) {
      maxV *= 0.78; // brief off-ribbon slow — not sticky death (was 0.58 → felt like 3 km/h pin)
    }
    if (kind === "flower" || kind === "outdoor") maxV *= 0.88;
    const onRailDeck = elevated || kind === "cornice" || kind === "balcony" || kind === "elevated";
    if (onRailDeck && snap?.onTrack) maxV *= 0.88;

    let fric = this.friction;
    if (snap?.onTrack) {
      if (kind === "cornice" || kind === "balcony") fric *= 1.78;
      else if (elevated || kind === "ramp") fric *= 1.58;
      else fric *= 1.18;
    }

    // Surface feel — asphalt vs carpet (strengthened #8; still binary on-road)
    const onAsphalt = !!(snap?.onTrack && !snap?.carpet);
    const onCarpet = !!(snap?.carpet && !snap?.onTrack);
    let accelMul = 1;
    if (onCarpet) { fric *= 1.34; accelMul = 0.74; maxV *= 0.88; }
    else if (onAsphalt) { fric *= 0.93; accelMul = 1.08; }
    this._surfaceCarpet = onCarpet ? 1 : 0;
    // Extra grip when soft rim fence is active (casual play stays ON deck)
    // Rim fence grip while onTrack OR brief nearDeck Y-assist (still not "on road")
    if (onRailDeck && snap?.wallBounce && (snap?.onTrack || snap?.nearDeck)) {
      fric *= 1.18;
    }

    // Soft throttle ease — responsive on climb, calm on floor cruise (upright caps unchanged)
    if (this._throttleSmooth == null) this._throttleSmooth = 0;
    // logic3: floor ramp-up eased (5.8→4.4/s) — W from rest builds speed over ~0.6 s, no lurch
    // logic4: the ease applies to PRESSING only. On release the pedal lifts quickly (12/s) —
    // the old symmetric 4.4/s ease kept pushing for ~0.9 s after W-up and then hit a hard
    // friction wall (see coast below), which read as "holds, then snaps to 0 km/h".
    const thrRate = (Math.abs(throttle) < Math.abs(this._throttleSmooth) || throttle === 0)
      ? 16.0
      : ((kind === "ramp" || snap?.steep) ? 6.8 : 4.4);
    this._throttleSmooth = THREE.MathUtils.lerp(this._throttleSmooth, throttle, Math.min(1, thrRate * dt));
    if (throttle === 0 && Math.abs(this._throttleSmooth) < 0.02) this._throttleSmooth = 0;
    const thr = this._throttleSmooth;
    if (thr > 0.02) {
      const headroom = 1 - Math.min(1, Math.abs(this.speed) / maxV);
      const curve = 0.45 + 0.55 * headroom * headroom;
      // Climb-only plant — floor cruise torque unchanged so ribbon onRate stays green
      const climbPlant = (kind === "ramp" || snap?.steep) ? 1.06 : 1;
      this.speed += this.accel * thr * curve * climbPlant * accelMul * dt;
      // logic4: pedal lifting (W released) — rolling drag fades in as the throttle fades out,
      // so there is no cruise plateau followed by a drop.
      if (throttle <= 0 && this.speed > 0) {
        const surfL = THREE.MathUtils.clamp(fric / (this.friction * 1.18 * 0.93), 0.85, 1.15);
        this.speed = Math.max(0, this.speed - (0.55 + 0.9 * this.speed) * surfL * (1 - thr) * dt);
      }
    } else if (thr < -0.02) {
      this.speed -= this.brake * Math.abs(thr) * dt;
    } else {
      // logic4: COAST = rolling drag, not a brake. The old path subtracted the full surface
      // friction (~8.3 u/s² on floor asphalt) → cruise 1.38 → 0 in ~0.17 s (1–3 frames on
      // SwiftShader) — the physics itself snapped the speedo to 0 km/h. Now: constant rolling
      // resistance + speed-proportional drag, scaled by the surface's friction ratio:
      // floor asphalt 1.38 → 0 in ≈1.3 s. logic5: surface ratio clamped 0.85–1.15 so a release on a
      // ramp foot / deck still coasts ≈1.1 s wall-clock (was 1.58× → 0.83 s live).
      const surf = THREE.MathUtils.clamp(fric / (this.friction * 1.18 * 0.93), 0.85, 1.15);
      const coast = (0.55 + 0.9 * Math.abs(this.speed)) * surf;
      if (this.speed > 0) this.speed = Math.max(0, this.speed - coast * dt);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + coast * dt);
    }
    this.speed = THREE.MathUtils.clamp(this.speed, -maxV * 0.42, maxV);

    if (kind === "flower" || kind === "outdoor") {
      this.speed *= 1 - Math.min(0.28, 0.28 * dt);
    }

    if (snap?.steep || kind === "chute") {
      this._landingDamp = Math.min(1, this._landingDamp + 2.5 * dt);
    } else {
      this._landingDamp = Math.max(0, this._landingDamp - 1.8 * dt);
      if (this._landingDamp > 0.15) {
        this.speed *= 1 - Math.min(0.5, this._landingDamp * 1.2 * dt);
      }
    }

    const absV = Math.abs(this.speed);
    // Milder low-speed steer boost — planted, not twitchy at crawl
    const lowBoost = 1.08 - 0.08 * THREE.MathUtils.smoothstep(absV, 0.08, 1.0);
    const highDamp = 1 - 0.42 * THREE.MathUtils.smoothstep(absV, 0.85, this.boostMax);
    const railGrip = (onRailDeck && snap?.onTrack) ? 1.05 : 1;
    // Near-wall / scrape: damp steering so corners don't yaw harder into the stud
    const wallSteerDamp = 1 - 0.38 * THREE.MathUtils.clamp(this._scrape, 0, 1);
    const rimSteerDamp = (snap?.onTrack && typeof snap.edgeMargin === "number" && snap.edgeMargin < 0.08)
      ? 0.82 : 1;
    const steerEff =
      this._steerInput * this.steerRate * Math.min(1.02, absV / 0.70 + 0.14)
      * lowBoost * highDamp * railGrip * wallSteerDamp * rimSteerDamp;
    // Soft yaw-rate limit (rad/s) — smooth turn-in/out without killing fun
    const yawDelta = steerEff * Math.sign(this.speed || 1) * dt;
    const maxYawRate = 2.05; // rad/s soft cap — planted turn-in, no veer
    const maxDyaw = maxYawRate * dt;
    this.yaw += THREE.MathUtils.clamp(yawDelta, -maxDyaw, maxDyaw);
    while (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
    while (this.yaw < -Math.PI) this.yaw += Math.PI * 2;

    this._driftTrail = THREE.MathUtils.lerp(
      this._driftTrail,
      Math.abs(this._steerInput) * THREE.MathUtils.smoothstep(absV, 0.9, 2.2) * 0.8,
      Math.min(1, 8 * dt)
    );

    const fwdX = Math.sin(this.yaw);
    const fwdZ = Math.cos(this.yaw);
    let x = this.root.position.x + fwdX * this.speed * dt;
    let z = this.root.position.z + fwdZ * this.speed * dt;
    let y = this.root.position.y;

    this.onTrack = !!(snap?.onTrack);

    if (snap?.wallBounce) {
      x += snap.wallBounce.x;
      z += snap.wallBounce.z;
      const scrape = Math.hypot(snap.wallBounce.x, snap.wallBounce.z);
      if (scrape > 0.0005) {
        // On-ribbon: light scrape speed kill so cruise stays smooth
        const onRibbon = !!snap.onTrack;
        const kill = onRibbon ? 7.5 : 16;
        const cap = onRibbon ? 0.20 : 0.42;
        this.speed *= 1 - Math.min(cap, scrape * kill * dt);
        this._scrape = Math.min(1, this._scrape + scrape * (onRibbon ? 22 : 40));
        flags.scrape = scrape;
      }
    } else {
      this._scrape = Math.max(0, this._scrape - 3 * dt);
    }

    // Height follow: stick to surface under wheels (NO full-floor centerline magnet).
    // Climb ramps get a SOFT lateral hold + yaw settle so real cars do not slide off
    // narrow ribbons (smoke centerline sampling used to hide this).
    // Never yank upward onto cornice/balcony/furniture from below (under ≠ on).
    const belowElevDeck = !!(elevated && snap && snap.y != null
      && (snap.y - y) > 0.28
      && kind !== "ramp" && !snap.steep);
    if (supported && snap && !belowElevDeck) {
      const sticky = (elevated || kind === "cornice" || kind === "balcony" || !!snap.nearDeck)
        && !belowElevDeck;
      // Stickier on elevated decks; nearDeck Y-assist stays glued without flipping onTrack
      const nearRim = sticky && (
        !!snap.nearDeck
        || (typeof snap.edgeMargin === "number" && snap.edgeMargin < 0.10)
      );
      // Ramp climb: firm Y-lock along surface; flat decks sticky; never from under
      // Foyer climb first segments: stronger Y-lock so foot mount does not drop back to asphalt
      const foyerClimb = snap.pathId === "climb_a" || snap.pathId === "climb_b";
      const foyerFootHold = foyerClimb && (snap.y == null || snap.y < 1.35);
      const yLock = snap.steep || kind === "ramp"
        ? (foyerFootHold ? 92 : 62)
        : (sticky ? (nearRim ? 36 : 32) : 28);
      // Foyer climb: snap Y must lead — never let car Y trail rising ribbon
      // (browser dt clamp / hitch used to leave Y at foot while XZ advanced).
      if (foyerClimb && snap.y != null && Number.isFinite(snap.y)
          && (snap.onTrack || snap.nearDeck || snap.rampContinuity || foyerFootHold)) {
        const climbLock = Math.max(yLock, 140);
        y = THREE.MathUtils.lerp(y, snap.y, Math.min(1, climbLock * dt));
        if (snap.y > y) {
          // Keep wheels within 2cm under surface while ascending
          const gap = snap.y - y;
          if (gap > 0.02 && gap < 0.65) y = snap.y - 0.02;
          else if (gap >= 0.65) y = THREE.MathUtils.lerp(y, snap.y, Math.min(1, 0.85));
        }
      } else {
        y = THREE.MathUtils.lerp(y, snap.y, Math.min(1, yLock * dt));
      }

      // Climb-only soft lateral magnet (NOT full floor ASSIST_MAGNET)
      const rampAssist = kind === "ramp" && (
        !!snap.onTrack || !!snap.nearDeck || !!snap.rampContinuity
      );
      // Hard gate: never lerp XZ toward a snap centerline more than ~0.55m away
      // (path-label flips / apron ghosts must not teleport the car onto another ribbon).
      const snapJump = (snap.x != null && snap.z != null)
        ? Math.hypot(snap.x - x, snap.z - z) : 99;
      const snapNear = snapJump < 0.55;
      // logic6: every XZ magnet below is LATERAL-ONLY. The snap point's along-track offset is
      // removed using the ribbon tangent (snap.yaw). Before this, a car still on the runway
      // (x≈-1.55) that engaged climb_a got its snap point clamped to the climb's first vertex
      // (the foot, x=-2.11) and the 0.72/frame "lateral" pull dragged it ~0.5u FORWARD in
      // ~0.15 s (0.129u in one 1/60 frame at 1.21 u/s = the Climb A foot surge).
      let magX = snap.x, magZ = snap.z;
      if (snap.x != null && snap.z != null && Number.isFinite(snap.yaw)) {
        const fx = Math.sin(snap.yaw), fz = Math.cos(snap.yaw);
        const along = (snap.x - x) * fx + (snap.z - z) * fz;
        magX = snap.x - along * fx;
        magZ = snap.z - along * fz;
      }
      if (rampAssist && snapNear && snap.x != null && snap.z != null) {
        const em = typeof snap.edgeMargin === "number" ? snap.edgeMargin : 0.2;
        // Strong climb hold — imperfect human steer still crests (not centerline magnet)
        const rimFactor = em < 0.14 ? (foyerClimb ? 2.95 : 2.45)
          : (em < 0.26 ? (foyerClimb ? 2.15 : 1.75) : (foyerClimb ? (foyerFootHold ? 1.55 : 1.35) : 1.10));
        const pullCap = foyerFootHold ? 0.72 : (foyerClimb ? 0.68 : 0.58);
        const pull = Math.min(pullCap,
          (0.26 + 0.26 * rimFactor) * Math.min(1, 18 * dt));
        x = THREE.MathUtils.lerp(x, magX, pull);
        z = THREE.MathUtils.lerp(z, magZ, pull);
      } else if (snapNear && snap.onTrack && snap.x != null && snap.z != null
        && (kind === "floor" || kind === "outdoor" || kind === "flower")) {
        // Soft rim hold — keep cruise on ribbon without centerline yank / path teleport
        const em = typeof snap.edgeMargin === "number" ? snap.edgeMargin : 0.2;
        if (em < 0.10) {
          const pull = Math.min(0.14, (0.05 + (0.10 - em) * 0.8) * Math.min(1, 12 * dt));
          x = THREE.MathUtils.lerp(x, magX, pull);
          z = THREE.MathUtils.lerp(z, magZ, pull);
        }
      } else if (ASSIST_MAGNET && snapNear && snap.onTrack) {
        const whisper = Math.min(1, 0.08 * 10 * dt);
        x = THREE.MathUtils.lerp(x, magX, whisper);
        z = THREE.MathUtils.lerp(z, magZ, whisper);
      }


      // Kiss handoff polish (#9) — tighter soft-settle, no hitch / no snapJump yank
      if (this._kissY == null) this._kissY = y;
      const yDelta = y - this._kissY;
      if (Math.abs(yDelta) > 0.08 && !foyerClimb) {
        // Soft settle only — never teleport Y at ribbon kisses
        y = this._kissY + Math.sign(yDelta) * Math.min(Math.abs(yDelta), 0.032 + absV * 0.022);
      } else if (Math.abs(yDelta) > 0.22 && foyerClimb) {
        y = this._kissY + Math.sign(yDelta) * Math.min(Math.abs(yDelta), 0.078 + absV * 0.032);
      }
      this._kissY = THREE.MathUtils.lerp(this._kissY, y, Math.min(1, 18 * dt));

      // Lateral bank ONLY (hard-capped). Grade is separate — never tip sideways on climbs.
      const bankCap = kind === "chute" ? VISUAL_BANK_MAX_CHUTE : VISUAL_BANK_MAX;
      const rawBank = THREE.MathUtils.clamp(snap.bank || 0, -bankCap, bankCap);
      // Heavy low-pass — crease / ribbon-join spikes must not twitch roll
      const bankSmooth = sticky || rampAssist ? 2.6 : 2.1;
      this._smoothBank = THREE.MathUtils.lerp(this._smoothBank, rawBank, Math.min(1, bankSmooth * dt));
      const bank = THREE.MathUtils.clamp(this._smoothBank, -bankCap, bankCap);
      // Along-track grade → subtle pitch (not roll)
      const rawGrade = (snap.grade != null && Number.isFinite(snap.grade)) ? snap.grade : 0;
      const gradeSmooth = sticky || rampAssist ? 3.0 : 2.4;
      this._smoothGrade = THREE.MathUtils.lerp(this._smoothGrade, rawGrade, Math.min(1, gradeSmooth * dt));
      // Crest compression (#5) — fire on RAW grade drop. Smoothed grade never spans
      // 0.10→0.06 in one frame (prev tracked smooth too), so crest never armed.
      const gPrev = this._prevGrade || 0;
      const leavingClimb = gPrev > 0.10 && rawGrade < 0.06 && absV > 0.20
        && (kind === "floor" || kind === "balcony" || kind === "elevated" || !snap.steep);
      if (leavingClimb && this._crestSquat < 0.20) this._crestSquat = 1;
      this._prevGrade = rawGrade;
      if (this._crestSquat > 0) {
        // Slightly longer settle so the "compression" reads
        this._crestSquat = Math.max(0, this._crestSquat - 2.2 * dt);
      }
      // Gentle yaw settle — climb ramps / decks only. Floor cruise: NO ribbon yaw magnet
      // (player must be able to hold W and go straight on skirting without constant correction).
      const floorAssist = false;
      // Yaw settle on ribbon; foyer foot also settles while nearDeck so approach mounts turn uphill
      if ((sticky || rampAssist) && (snap.onTrack || foyerFootHold) && snap.yaw != null && Number.isFinite(snap.yaw) && absV > 0.12) {
        let dyaw = snap.yaw - this.yaw;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        // Bidirectional ribbon yaw — reverse travel must not U-turn.
        // EXCEPTION: foyer climb foot — always settle toward uphill segment yaw so a
        // west/north approach does not glue to the foot facing the wrong way.
        // logic3: feet are tangent-aligned now — no forced uphill spin (was yawLim π)
        {
          let dyawR = dyaw + Math.PI;
          while (dyawR > Math.PI) dyawR -= Math.PI * 2;
          while (dyawR < -Math.PI) dyawR += Math.PI * 2;
          if (Math.abs(dyawR) < Math.abs(dyaw)) dyaw = dyawR;
        }
        const yawLim = rampAssist ? (foyerClimb ? 1.35 : 1.20) : 0.45;
        const yawK = rampAssist ? (foyerClimb ? (foyerFootHold ? 0.60 : 0.52) : 0.44) : 0.12;
        const yawRate = rampAssist ? (foyerClimb ? (foyerFootHold ? 5.2 : 4.6) : 4.0) : 1.2;
        if (Math.abs(dyaw) < yawLim) {
          this.yaw += dyaw * Math.min(yawK, yawRate * dt) * Math.min(1, absV / 0.9);
        }
      }
      // Steer lean subtle; bank already capped — do NOT add grade into roll
      const steerLean = -this._steerInput * STEER_LEAN_MAX * Math.min(1, absV / 1.2);
      const targetRoll = THREE.MathUtils.clamp(bank + steerLean, -(bankCap + STEER_LEAN_MAX), bankCap + STEER_LEAN_MAX);
      this._bodyRoll = THREE.MathUtils.lerp(this._bodyRoll, targetRoll, Math.min(1, 3.4 * dt));
    } else {
      this._smoothBank = THREE.MathUtils.lerp(this._smoothBank, 0, Math.min(1, 4 * dt));
      this._smoothGrade = THREE.MathUtils.lerp(this._smoothGrade, 0, Math.min(1, 4 * dt));
      this._bodyRoll = THREE.MathUtils.lerp(this._bodyRoll, 0, Math.min(1, 5 * dt));
    }

    if (this._justLanded > 0) {
      this._justLanded = Math.max(0, this._justLanded - dt);
      this.speed *= 1 - Math.min(0.4, 1.2 * dt);
    }

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(this.yaw)
        || !Number.isFinite(this.speed) || !Number.isFinite(this.vy)) {
      // Do not write NaN into the scene graph — reset planted pose
      this.speed = 0;
      this.vy = 0;
      if (!Number.isFinite(this.yaw)) this.yaw = 0;
      return flags;
    }

    this.root.position.set(x, y, z);
    this.root.rotation.y = this.yaw;
    // Roll = lateral bank + steer lean ONLY (never grade)
    this.bodyPivot.rotation.z = this._bodyRoll;
    // Pitch = along-track grade (capped) — not a second copy of bank
    const pitchFromGrade = THREE.MathUtils.clamp(
      -(this._smoothGrade || 0) * GRADE_PITCH_SCALE,
      -GRADE_PITCH_MAX,
      GRADE_PITCH_MAX
    );
    const crestDip = (this._crestSquat || 0) * 0.040; // brief squat (strengthened #5), not a jump
    this.bodyPivot.position.y = THREE.MathUtils.lerp(this.bodyPivot.position.y || 0, -crestDip, Math.min(1, 12 * dt));
    this.bodyPivot.rotation.x = THREE.MathUtils.lerp(
      this.bodyPivot.rotation.x,
      pitchFromGrade - this._landingDamp * 0.08 + crestDip * 0.9,
      Math.min(1, 3.8 * dt)
    );

    if (inTube) {
      this.bodyPivot.rotation.z += Math.sin(this._idlePhase * 9) * 0.01 * absV;
    }

    const spin = (this.speed * dt) / Math.max(0.008, this._wheelRadius);
    for (const w of this.wheels) w.rotation.x += spin;

    // Reactive brake lights: braking OR reverse-intent coast
    const brakingNow = (thr < -0.05) || (thr < 0.02 && this.speed > 0.15 && !keys.boost);
    this._updateBrakeLights(brakingNow, dt);

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
