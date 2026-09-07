import * as THREE from "three";

/**
 * Premium miniature RC car (~0.42 m) — candy-red two-tone, chrome, glass,
 * detailed wheels, subtle underglow, speed-tied wheel spin + body roll.
 */
export class RCCar {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = "rc_car";
    this.bodyPivot = new THREE.Group(); // rolls independently of yaw
    this.root.add(this.bodyPivot);
    this.wheels = [];
    this.speed = 0;
    this.yaw = Math.PI;
    this.maxSpeed = 8.2;
    this.boostMax = 12.2;
    this.accel = 18;       // snappy start
    this.brake = 26;
    this.friction = 6.4;   // soft coast
    this.steerRate = 3.05;
    this.wheelBase = 0.22;
    this.onTrack = true;
    this._steerInput = 0;
    this._bodyRoll = 0;
    this._landingDamp = 0;
    this._driftTrail = 0;
    this._boosting = false;
    this._build();
  }

  _build() {
    const candy = new THREE.MeshStandardMaterial({
      color: 0xd32f2f, roughness: 0.28, metalness: 0.42,
    });
    const cream = new THREE.MeshStandardMaterial({
      color: 0xfff3e0, roughness: 0.4, metalness: 0.18,
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
      color: 0xfffde7, emissive: 0xffecb3, emissiveIntensity: 1.6,
      roughness: 0.25,
    });
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff1744, emissive: 0xff1744, emissiveIntensity: 0.85, roughness: 0.35,
    });
    const underglow = new THREE.MeshStandardMaterial({
      color: 0xff5252, emissive: 0xff1744, emissiveIntensity: 0.45,
      transparent: true, opacity: 0.55, roughness: 0.5,
    });

    const b = this.bodyPivot;

    // Layered body for bevelled silhouette (lower → mid → upper taper)
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.44), candy);
    lower.position.y = 0.055;
    lower.castShadow = true;
    b.add(lower);

    const mid = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.40), candy);
    mid.position.y = 0.095;
    mid.castShadow = true;
    b.add(mid);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.12), candy);
    nose.position.set(0, 0.09, -0.18);
    b.add(nose);

    // Cream racing stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.012, 0.42), cream);
    stripe.position.set(0, 0.122, -0.01);
    b.add(stripe);
    const stripeHood = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 0.1), cream);
    stripeHood.position.set(0, 0.112, -0.2);
    b.add(stripeHood);

    // Cabin / windshield glass
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.07, 0.16), glass);
    cabin.position.set(0, 0.155, -0.02);
    b.add(cabin);
    // Soft cabin frame
    const cabinFrame = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.015, 0.175), dark);
    cabinFrame.position.set(0, 0.125, -0.02);
    b.add(cabinFrame);

    // Spoiler
    const spoilerPostL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.02), dark);
    spoilerPostL.position.set(-0.07, 0.145, 0.17);
    b.add(spoilerPostL);
    const spoilerPostR = spoilerPostL.clone();
    spoilerPostR.position.x = 0.07;
    b.add(spoilerPostR);
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.018, 0.055), cream);
    spoiler.position.set(0, 0.175, 0.17);
    b.add(spoiler);

    // Chrome bumpers
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.028, 0.035), chrome);
    frontBumper.position.set(0, 0.048, -0.225);
    b.add(frontBumper);
    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.028, 0.03), chrome);
    rearBumper.position.set(0, 0.048, 0.22);
    b.add(rearBumper);

    // Chrome side mirrors
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.012), chrome);
      arm.position.set(sx * 0.12, 0.13, -0.08);
      b.add(arm);
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.028, 0.022), chrome);
      mirror.position.set(sx * 0.145, 0.13, -0.08);
      b.add(mirror);
    }

    // Headlight lenses (emissive — no SpotLights)
    for (const sx of [-0.07, 0.07]) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), headMat);
      h.position.set(sx, 0.078, -0.225);
      h.scale.z = 0.7;
      b.add(h);
    }
    // Tail lights
    for (const sx of [-0.07, 0.07]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.022, 0.018), tailMat);
      t.position.set(sx, 0.078, 0.225);
      b.add(t);
    }

    // Subtle underglow panel
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.008, 0.32), underglow);
    glow.position.y = 0.018;
    b.add(glow);

    // Detailed wheels: tire + hub + rim ring
    const tireGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.038, 14);
    const hubGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.042, 10);
    const rimGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.04, 12);
    for (const [x, z] of [[-0.125, -0.13], [0.125, -0.13], [-0.125, 0.13], [0.125, 0.13]]) {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(x, 0.048, z);
      const tire = new THREE.Mesh(tireGeo, rubber);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelGroup.add(tire);
      const rim = new THREE.Mesh(rimGeo, chrome);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(rim);
      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.rotation.z = Math.PI / 2;
      wheelGroup.add(hub);
      // Spoke nubs
      for (let i = 0; i < 4; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.028, 0.008), chrome);
        spoke.rotation.z = Math.PI / 2;
        spoke.rotation.x = (i / 4) * Math.PI;
        wheelGroup.add(spoke);
      }
      this.root.add(wheelGroup);
      this.wheels.push(wheelGroup);
    }
  }

  setPose(x, y, z, yaw) {
    this.root.position.set(x, y, z);
    this.yaw = yaw;
    this.root.rotation.y = yaw;
    this._bodyRoll = 0;
    this._landingDamp = 0;
    this._driftTrail = 0;
    this.bodyPivot.rotation.z = 0;
    this.bodyPivot.rotation.x = 0;
  }

  /**
   * Arcade step. keys: {forward,back,left,right,boost}
   * snap: {x,y,z,yaw,onTrack,bank,railPush?,magnet?,kind?,steep?} from track system
   */
  update(dt, keys, snap) {
    const throttle = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
    const steer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    this._steerInput = THREE.MathUtils.lerp(this._steerInput, steer, Math.min(1, 14 * dt));
    this._boosting = !!(keys.boost && Math.abs(this.speed) > 1.5);
    const maxV = keys.boost ? this.boostMax : this.maxSpeed;

    // Acceleration curve: snappy start, soft asymptotic cap
    if (throttle > 0) {
      const headroom = 1 - Math.min(1, Math.abs(this.speed) / maxV);
      const curve = 0.55 + 0.45 * headroom * headroom; // punchy off the line
      this.speed += this.accel * throttle * curve * dt;
    } else if (throttle < 0) {
      this.speed -= this.brake * dt;
    } else {
      if (this.speed > 0) this.speed = Math.max(0, this.speed - this.friction * dt);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + this.friction * dt);
    }
    this.speed = THREE.MathUtils.clamp(this.speed, -maxV * 0.45, maxV);

    const kind = snap?.kind || "";
    const magnet = !!(snap?.magnet || kind === "shortcut" || kind === "shaft" || kind === "chute"
      || kind === "elevated" || kind === "cornice" || kind === "balcony" || kind === "ramp");

    // Grip / off-track: slow on carpet/grass feel, never hard freeze
    if (snap?.onTrack) {
      if (kind === "flower" || kind === "outdoor") {
        // soft petal / gravel — slight drag, still fun
        this.speed *= 1 - Math.min(0.35, 0.35 * dt);
      }
    } else if (snap?.softPull) {
      this.speed *= 1 - Math.min(1, 1.05 * dt);
    } else {
      this.speed *= 1 - Math.min(1, 2.4 * dt);
    }

    // Landing damp after jumps / steep slides
    if (snap?.steep || kind === "chute") {
      this._landingDamp = Math.min(1, this._landingDamp + 2.5 * dt);
    } else {
      this._landingDamp = Math.max(0, this._landingDamp - 1.8 * dt);
      if (this._landingDamp > 0.15) {
        this.speed *= 1 - Math.min(0.5, this._landingDamp * 1.2 * dt);
      }
    }

    // Steering: high at low speed, stable at high
    const absV = Math.abs(this.speed);
    const lowBoost = 1.45 - 0.6 * THREE.MathUtils.smoothstep(absV, 0.4, 5.5);
    const highDamp = 1 - 0.32 * THREE.MathUtils.smoothstep(absV, 5, this.boostMax);
    const steerEff =
      this._steerInput * this.steerRate * Math.min(1.2, absV / 2.0 + 0.18) * lowBoost * highDamp;
    this.yaw += steerEff * Math.sign(this.speed || 1) * dt;

    // Visual-only drift trail intensity
    this._driftTrail = THREE.MathUtils.lerp(
      this._driftTrail,
      Math.abs(this._steerInput) * THREE.MathUtils.smoothstep(absV, 3, 8) * 0.8,
      Math.min(1, 8 * dt)
    );

    const fwdX = Math.sin(this.yaw);
    const fwdZ = Math.cos(this.yaw);
    let x = this.root.position.x + fwdX * this.speed * dt;
    let z = this.root.position.z + fwdZ * this.speed * dt;
    let y = this.root.position.y;

    if (snap) {
      this.onTrack = !!snap.onTrack;
      if (snap.onTrack || snap.softPull) {
        // Stronger magnetic centerline on elevated / shortcut / shafts
        const basePull = snap.onTrack ? (magnet ? 0.78 : 0.48) : (magnet ? 0.32 : 0.16);
        const pullMul = Math.min(1, basePull * 14 * dt);
        x = THREE.MathUtils.lerp(x, snap.x, pullMul);
        z = THREE.MathUtils.lerp(z, snap.z, pullMul);
        // Fast Y lock — critical so car doesn't fall out mid-shaft
        const yLock = magnet || snap.steep ? 28 : 18;
        y = THREE.MathUtils.lerp(y, snap.y, Math.min(1, yLock * dt));

        if (snap.railPush) {
          const railMul = magnet ? 14 : 10;
          x += snap.railPush.x * Math.min(1, railMul * dt);
          z += snap.railPush.z * Math.min(1, railMul * dt);
        }

        if (snap.onTrack && snap.yaw != null) {
          let dy = snap.yaw - this.yaw;
          while (dy > Math.PI) dy -= Math.PI * 2;
          while (dy < -Math.PI) dy += Math.PI * 2;
          const align = (magnet ? 0.4 : 0.28) + 0.28 * THREE.MathUtils.smoothstep(absV, 2, 8);
          this.yaw += dy * Math.min(1, 4.2 * dt) * align;
        }

        // Bank follows track; extra on chutes
        const bank = snap.bank || 0;
        const targetRoll = bank - this._steerInput * 0.14 * Math.min(1, absV / 4);
        this._bodyRoll = THREE.MathUtils.lerp(this._bodyRoll, targetRoll, Math.min(1, 11 * dt));
      } else {
        y = THREE.MathUtils.lerp(y, snap.y ?? y, Math.min(1, 5 * dt));
        this._bodyRoll = THREE.MathUtils.lerp(this._bodyRoll, 0, Math.min(1, 6 * dt));
      }
    }

    // NaN guard
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(this.yaw)) {
      return;
    }

    this.root.position.set(x, y, z);
    this.root.rotation.y = this.yaw;
    this.bodyPivot.rotation.z = this._bodyRoll;
    // Subtle pitch from landing damp / chute
    this.bodyPivot.rotation.x = THREE.MathUtils.lerp(
      this.bodyPivot.rotation.x,
      -(snap?.bank || 0) * 0.35 - this._landingDamp * 0.08,
      Math.min(1, 8 * dt)
    );

    const spin = (this.speed * dt) / 0.048;
    for (const w of this.wheels) w.rotation.x += spin;
  }

  get position() {
    return this.root.position;
  }

  getSpeedKmh() {
    return Math.abs(this.speed) * 3.6;
  }

  get isBoosting() {
    return this._boosting;
  }

  get driftTrail() {
    return this._driftTrail;
  }
}
