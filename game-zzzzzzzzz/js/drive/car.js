import * as THREE from "three";

/**
 * Premium miniature RC vehicles — toy/mouse scale (~0.10–0.11 m long).
 * Manual RC physics: free steer, surface support, gravity falls, crash.
 * Types: car | suv | jeep | convertible — distinct meshes + handling.
 */
export const CAR_SCALE = 0.218; // ~0.42 m → ~0.092 m length (~13% smaller to match narrower roads)

/** Optional whisper of road grip when wheels on surface. OFF by default. */
export const ASSIST_MAGNET = false;

/** Handling / look presets (base values; tiny-car precision). */
export const VEHICLE_PRESETS = {
  // Driver-feel cruise sweet spot (not crawl ~1.05, not rocket ~1.72):
  // car maxSpeed ~1.40, boost ~1.92, steerRate ~3.42, steer lerp ~2.85 (planted)
  car: {
    id: "car",
    label: "Car",
    blurb: "Balanced · joyful cruise",
    maxSpeed: 1.40,
    boostMax: 1.92,
    accel: 6.2,
    brake: 14,
    friction: 7.4,
    steerRate: 3.42,
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
    this.wheels = [];
    this.speed = 0;
    this.yaw = Math.PI;
    this.vy = 0;
    this.vehicleId = "car";
    this.maxSpeed = 1.40;
    this.boostMax = 1.92;
    this.accel = 6.2;
    this.brake = 16;
    this.friction = 7.4;
    this.steerRate = 3.42;
    this.wheelBase = 0.055;
    this.onTrack = true;
    this.airborne = false;
    this.crashed = false;
    this._unsupportedFrames = 0;
    this._fallStartY = 0;
    this._lastElevated = false;
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
    const candy = new THREE.MeshStandardMaterial({
      color: preset.bodyColor, roughness: 0.28, metalness: 0.42,
    });
    const cream = new THREE.MeshStandardMaterial({
      color: preset.accent, roughness: 0.4, metalness: 0.18,
    });
    const glass = new THREE.MeshStandardMaterial({
      color: 0xb3e5fc, roughness: 0.08, metalness: 0.35,
      transparent: true, opacity: 0.55,
      emissive: 0x81d4fa, emissiveIntensity: 0.08,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a, roughness: 0.75, metalness: 0.15,
    });
    const chrome = new THREE.MeshStandardMaterial({
      color: 0xeceff1, roughness: 0.18, metalness: 0.92,
    });
    const rubber = new THREE.MeshStandardMaterial({
      color: 0x212121, roughness: 0.92, metalness: 0.05,
    });
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0xb0bec5, roughness: 0.3, metalness: 0.8,
    });
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xfffde7, emissive: 0xffecb3, emissiveIntensity: 0.35,
      roughness: 0.25,
    });
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff1744, emissive: 0xff1744, emissiveIntensity: 0.25, roughness: 0.35,
    });
    const underglow = new THREE.MeshStandardMaterial({
      color: preset.bodyColor, emissive: preset.bodyColor, emissiveIntensity: 0.12,
      transparent: true, opacity: 0.28, roughness: 0.5,
    });
    this._headMats = [headMat, tailMat];
    this._glowMat = underglow;
    return { candy, cream, glass, dark, chrome, rubber, hubMat, headMat, tailMat, underglow };
  }

  _addWheels(m, layout, tireR = 0.048, tireW = 0.038) {
    const tireGeo = new THREE.CylinderGeometry(tireR, tireR, tireW, 14);
    const hubGeo = new THREE.CylinderGeometry(tireR * 0.46, tireR * 0.46, tireW + 0.004, 10);
    const rimGeo = new THREE.CylinderGeometry(tireR * 0.67, tireR * 0.67, tireW + 0.002, 12);
    this._wheelRadius = tireR * CAR_SCALE;
    for (const [x, z] of layout) {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(x, tireR, z);
      const tire = new THREE.Mesh(tireGeo, m.rubber);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelGroup.add(tire);
      const rim = new THREE.Mesh(rimGeo, m.chrome);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(rim);
      const hub = new THREE.Mesh(hubGeo, m.hubMat);
      hub.rotation.z = Math.PI / 2;
      wheelGroup.add(hub);
      for (let i = 0; i < 4; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.006, tireR * 0.58, 0.008), m.chrome);
        spoke.rotation.z = Math.PI / 2;
        spoke.rotation.x = (i / 4) * Math.PI;
        wheelGroup.add(spoke);
      }
      this.root.add(wheelGroup);
      this.wheels.push(wheelGroup);
    }
  }

  _buildCar(m) {
    const b = this.bodyPivot;
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.44), m.candy);
    lower.position.y = 0.055;
    lower.castShadow = true;
    b.add(lower);
    const mid = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.40), m.candy);
    mid.position.y = 0.095;
    mid.castShadow = true;
    b.add(mid);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.12), m.candy);
    nose.position.set(0, 0.09, -0.18);
    b.add(nose);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.012, 0.42), m.cream);
    stripe.position.set(0, 0.122, -0.01);
    b.add(stripe);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.07, 0.16), m.glass);
    cabin.position.set(0, 0.155, -0.02);
    b.add(cabin);
    const cabinFrame = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.015, 0.175), m.dark);
    cabinFrame.position.set(0, 0.125, -0.02);
    b.add(cabinFrame);
    const spoilerPostL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.02), m.dark);
    spoilerPostL.position.set(-0.07, 0.145, 0.17);
    b.add(spoilerPostL);
    const spoilerPostR = spoilerPostL.clone();
    spoilerPostR.position.x = 0.07;
    b.add(spoilerPostR);
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.018, 0.055), m.cream);
    spoiler.position.set(0, 0.175, 0.17);
    b.add(spoiler);
    this._addBumpersLights(m, 0.078);
    this._addWheels(m, [[-0.125, -0.13], [0.125, -0.13], [-0.125, 0.13], [0.125, 0.13]]);
  }

  _buildSuv(m) {
    const b = this.bodyPivot;
    // Taller boxy cabin
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.055, 0.46), m.candy);
    lower.position.y = 0.07;
    lower.castShadow = true;
    b.add(lower);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.42), m.candy);
    body.position.y = 0.14;
    body.castShadow = true;
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
    lower.castShadow = true;
    b.add(lower);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.36), m.candy);
    body.position.y = 0.14;
    body.castShadow = true;
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
    lower.castShadow = true;
    b.add(lower);
    const mid = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.04, 0.4), m.candy);
    mid.position.y = 0.085;
    mid.castShadow = true;
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
    if (this._headMats[0]) this._headMats[0].emissiveIntensity = head;
    if (this._headMats[1]) this._headMats[1].emissiveIntensity = tail;
    if (this._glowMat) {
      this._glowMat.emissiveIntensity = glow;
      this._glowMat.opacity = glowOp;
    }
  }

  setPose(x, y, z, yaw) {
    this.root.position.set(x, y, z);
    this.yaw = yaw;
    this.root.rotation.y = yaw;
    this.root.rotation.x = 0;
    this.root.rotation.z = 0;
    this.vy = 0;
    this.speed = 0;
    this.airborne = false;
    this.crashed = false;
    this._unsupportedFrames = 0;
    this._fallStartY = 0;
    this._lastElevated = false;
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
    return [8.46, 4.26, 0.045, -4.05];
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
    return 0.045;
  }

  /**
   * Manual RC step.
   * snap: {x,y,z,yaw,onTrack,supported,bank,kind,wallBounce,carpet,elevated,steep?}
   * Returns { scrape, landed, fell } flags for FX.
   */
  update(dt, keys, snap) {
    const flags = { scrape: 0, landed: false, fell: false };
    if (this.crashed) return flags;

    const throttle = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
    const steer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    // Higher input damping → smoother turn-in/out (less twitchy)
    this._steerInput = THREE.MathUtils.lerp(this._steerInput, steer, Math.min(1, 2.85 * dt));

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
    if (supported && trulyElevated) this._lastElevated = true;
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
      } else if (fromElev && this._unsupportedFrames >= 3) {
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
      maxV *= 0.62; // mild carpet / off-ribbon penalty — slow, never crash
    }
    if (kind === "flower" || kind === "outdoor") maxV *= 0.88;
    const onRailDeck = elevated || kind === "cornice" || kind === "balcony" || kind === "elevated";
    if (onRailDeck && snap?.onTrack) maxV *= 0.88;

    let fric = this.friction;
    if (snap?.onTrack) {
      if (kind === "cornice" || kind === "balcony") fric *= 1.68;
      else if (elevated || kind === "ramp") fric *= 1.48;
      else fric *= 1.18;
    }
    // Extra grip when soft rim fence is active (casual play stays ON deck)
    // Rim fence grip while onTrack OR brief nearDeck Y-assist (still not "on road")
    if (onRailDeck && snap?.wallBounce && (snap?.onTrack || snap?.nearDeck)) {
      fric *= 1.12;
    }

    if (throttle > 0) {
      const headroom = 1 - Math.min(1, Math.abs(this.speed) / maxV);
      const curve = 0.45 + 0.55 * headroom * headroom;
      this.speed += this.accel * throttle * curve * dt;
    } else if (throttle < 0) {
      this.speed -= this.brake * dt;
    } else {
      if (this.speed > 0) this.speed = Math.max(0, this.speed - fric * dt);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + fric * dt);
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
    const lowBoost = 1.12 - 0.12 * THREE.MathUtils.smoothstep(absV, 0.08, 1.0);
    const highDamp = 1 - 0.42 * THREE.MathUtils.smoothstep(absV, 0.85, this.boostMax);
    const railGrip = (onRailDeck && snap?.onTrack) ? 1.05 : 1;
    const steerEff =
      this._steerInput * this.steerRate * Math.min(1.02, absV / 0.70 + 0.14) * lowBoost * highDamp * railGrip;
    // Soft yaw-rate limit (rad/s) — smooth turn-in/out without killing fun
    const yawDelta = steerEff * Math.sign(this.speed || 1) * dt;
    const maxYawRate = 2.45; // rad/s soft cap
    const maxDyaw = maxYawRate * dt;
    this.yaw += THREE.MathUtils.clamp(yawDelta, -maxDyaw, maxDyaw);

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
        this.speed *= 1 - Math.min(0.45, scrape * 18 * dt);
        this._scrape = Math.min(1, this._scrape + scrape * 40);
        flags.scrape = scrape;
      }
    } else {
      this._scrape = Math.max(0, this._scrape - 3 * dt);
    }

    // Height follow: stick to surface under wheels (NO centerline magnet)
    if (supported && snap) {
      const sticky = elevated || kind === "cornice" || kind === "balcony" || !!snap.nearDeck;
      // Stickier on elevated decks; nearDeck Y-assist stays glued without flipping onTrack
      const nearRim = sticky && (
        !!snap.nearDeck
        || (typeof snap.edgeMargin === "number" && snap.edgeMargin < 0.08)
      );
      const yLock = snap.steep ? 28 : (sticky ? (nearRim ? 34 : 30) : 18);
      y = THREE.MathUtils.lerp(y, snap.y, Math.min(1, yLock * dt));

      if (ASSIST_MAGNET && snap.onTrack) {
        const whisper = Math.min(1, 0.08 * 10 * dt);
        x = THREE.MathUtils.lerp(x, snap.x, whisper);
        z = THREE.MathUtils.lerp(z, snap.z, whisper);
      }

      const bank = snap.bank || 0;
      const targetRoll = bank - this._steerInput * 0.14 * Math.min(1, absV / 1.2);
      this._bodyRoll = THREE.MathUtils.lerp(this._bodyRoll, targetRoll, Math.min(1, 11 * dt));
    } else {
      this._bodyRoll = THREE.MathUtils.lerp(this._bodyRoll, 0, Math.min(1, 6 * dt));
    }

    if (this._justLanded > 0) {
      this._justLanded = Math.max(0, this._justLanded - dt);
      this.speed *= 1 - Math.min(0.4, 1.2 * dt);
    }

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(this.yaw)) {
      return flags;
    }

    this.root.position.set(x, y, z);
    this.root.rotation.y = this.yaw;
    this.bodyPivot.rotation.z = this._bodyRoll;
    this.bodyPivot.rotation.x = THREE.MathUtils.lerp(
      this.bodyPivot.rotation.x,
      -(snap?.bank || 0) * 0.35 - this._landingDamp * 0.08,
      Math.min(1, 8 * dt)
    );

    if (inTube) {
      this.bodyPivot.rotation.z += Math.sin(this._idlePhase * 9) * 0.01 * absV;
    }

    const spin = (this.speed * dt) / Math.max(0.008, this._wheelRadius);
    for (const w of this.wheels) w.rotation.x += spin;

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
