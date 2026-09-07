import * as THREE from "three";
import { RCCar, VEHICLE_PRESETS } from "./car.js";
import { TrackSystem } from "./tracks.js";
import { CAR_SPAWN, SHORTCUT_TOAST_RE } from "../data/tracks.js";

/**
 * Drive-mode orchestrator: TRUE MANUAL RC + chase cam + crash/restart.
 * Explore: tiny parked car, tracks hidden. Drive: free steer, can fall.
 */
export class DriveMode {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.active = false;
    this.tracks = new TrackSystem(scene);
    this.vehicleId = "car";
    this.car = new RCCar(this.vehicleId);
    this.scene.add(this.car.root);

    this.keys = { forward: false, back: false, left: false, right: false, boost: false };
    this._onKey = this._onKey.bind(this);
    this._camPos = new THREE.Vector3();
    this._camTarget = new THREE.Vector3();
    this._lookAhead = new THREE.Vector3();
    this._camVel = new THREE.Vector3();
    this._lastLabel = "";
    this._labelCooldown = 0;
    this._hintCooldown = 0;
    this._lastHint = "";
    this._edgeWarn = 0; // 0..1 soft near-edge amount (elevated tracks)
    this._edgeHintCd = 0;
    this._baseFov = camera.fov || 60;
    this._driveFov = 68; // calmer tour FOV (was arcade-wide 74)
    this._wallFov = 54; // tighter echo-y FOV in walls
    this._leisureFov = 62; // slower = slightly tighter / more cinematic
    this._fov = this._baseFov;
    this._tunnelDark = 0;
    this._time = 0;
    this.onCheckpoint = null;
    this.onSpeed = null;
    this.onHint = null;
    this.onCrash = null;
    this.onHud = null;

    // Crash state: null | 'falling' | 'smash' | 'restarting'
    this._crashPhase = null;
    this._crashTimer = 0;
    this._flash = 0;
    this._fade = 0;
    this._inputsFrozen = false;

    this._fxRoot = new THREE.Group();
    this._fxRoot.name = "drive_fx";
    this._fxRoot.visible = false;
    scene.add(this._fxRoot);
    this._speedLines = [];
    this._dust = [];
    this._sparks = [];
    this._smashBits = [];
    this._buildFx();

    /** @type {THREE.Box3[]|null} mansion wall/furniture colliders for drive bounce */
    this._wallColliders = null;
    this._carRadius = 0.09;
    this._passKinds = new Set(["shortcut", "mouse", "shaft", "tunnel", "chute"]);

    this.parkForExplore();
  }

  /** Wire mansion colliders so Drive cannot clip through solid walls (except mouse/tunnels). */
  setWallColliders(colliders) {
    this._wallColliders = colliders || null;
  }

  _buildFx() {
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false,
    });
    for (let i = 0; i < 14; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.22), lineMat.clone());
      line.visible = false;
      this._fxRoot.add(line);
      this._speedLines.push(line);
    }
    const dustMat = new THREE.MeshStandardMaterial({
      color: 0xd7ccc8, emissive: 0xffcc80, emissiveIntensity: 0.4,
      transparent: true, opacity: 0.0, roughness: 0.8,
    });
    for (let i = 0; i < 10; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), dustMat.clone());
      d.visible = false;
      this._fxRoot.add(d);
      this._dust.push({ mesh: d, life: 0, vx: 0, vy: 0, vz: 0 });
    }
    // Ember sparks when scraping wall
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffab40, transparent: true, opacity: 0, depthWrite: false,
    });
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.012, 4, 4), sparkMat.clone());
      s.visible = false;
      this._fxRoot.add(s);
      this._sparks.push({ mesh: s, life: 0, vx: 0, vy: 0, vz: 0 });
    }
    // Crash smash particles
    const smashMat = new THREE.MeshStandardMaterial({
      color: 0xff5252, emissive: 0xff1744, emissiveIntensity: 1.2,
      transparent: true, opacity: 0, roughness: 0.4,
    });
    for (let i = 0; i < 18; i++) {
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.02, 0.02),
        smashMat.clone()
      );
      b.visible = false;
      this._fxRoot.add(b);
      this._smashBits.push({ mesh: b, life: 0, vx: 0, vy: 0, vz: 0 });
    }
  }


  setVehicle(id) {
    if (!VEHICLE_PRESETS[id]) return;
    const wasSubtle = !this.active;
    const pos = this.car.position.clone();
    const yaw = this.car.yaw;
    const spd = this.car.speed;
    this.vehicleId = id;
    this.car.setVehicle(id);
    this.car.setPose(pos.x, pos.y, pos.z, yaw);
    this.car.speed = this.active ? Math.min(spd, this.car.maxSpeed * 0.5) : 0;
    this.car.setLightsSubtle(wasSubtle);
    if (this.onHud) {
      const p = VEHICLE_PRESETS[id];
      this.onHud({ mode: "manual", text: `${p.label} — leisurely cruise` });
    }
  }

  parkForExplore() {
    this.active = false;
    this.car.setPose(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, CAR_SPAWN.yaw);
    this.car.speed = 0;
    this.car.root.visible = true;
    this.car.setLightsSubtle(true);
    this.tracks.setVisible(false);
    this._fxRoot.visible = false;
    this._crashPhase = null;
    this._inputsFrozen = false;
    this._flash = 0;
    this._fade = 0;
    this._edgeWarn = 0;
    this._applyFlashFade();
  }

  _onKey(e) {
    if (!this.active || this._inputsFrozen) {
      if (this._inputsFrozen) {
        // Still clear keys so they don't stick after restart
        const down = e.type === "keydown";
        if (!down) {
          switch (e.code) {
            case "KeyW": case "ArrowUp": this.keys.forward = false; break;
            case "KeyS": case "ArrowDown": this.keys.back = false; break;
            case "KeyA": case "ArrowLeft": this.keys.left = false; break;
            case "KeyD": case "ArrowRight": this.keys.right = false; break;
            case "ShiftLeft": case "ShiftRight": this.keys.boost = false; break;
          }
        }
      }
      return;
    }
    const down = e.type === "keydown";
    switch (e.code) {
      case "KeyW":
      case "ArrowUp":
        this.keys.forward = down;
        break;
      case "KeyS":
      case "ArrowDown":
        this.keys.back = down;
        break;
      case "KeyA":
      case "ArrowLeft":
        this.keys.left = down;
        break;
      case "KeyD":
      case "ArrowRight":
        this.keys.right = down;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.keys.boost = down;
        break;
    }
  }

  enter() {
    this.active = true;
    this.car.setVehicle(this.vehicleId);
    this.car.root.visible = true;
    this.car.setLightsSubtle(false);
    this.tracks.setVisible(true);
    this._fxRoot.visible = true;
    this.car.setPose(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, CAR_SPAWN.yaw);
    this.car.speed = 0;
    this.car.resetBoost();
    this.keys = { forward: false, back: false, left: false, right: false, boost: false };
    this._baseFov = this.camera.fov || 60;
    this._fov = this._driveFov;
    this.camera.fov = this._driveFov;
    this.camera.updateProjectionMatrix();
    this._tunnelDark = 0;
    this._camVel.set(0, 0, 0);
    this._crashPhase = null;
    this._crashTimer = 0;
    this._inputsFrozen = false;
    this._flash = 0;
    this._fade = 0;
    this._lastLabel = "";
    this._lastHint = "";
    this._edgeWarn = 0;
    this._edgeHintCd = 0;
    if (typeof document !== "undefined") {
      document.addEventListener("keydown", this._onKey);
      document.addEventListener("keyup", this._onKey);
    }
    this._snapCamera(true);
    if (this.onHud) this.onHud({ mode: "manual", text: "Toy tour — cruise the house" });
    if (this.onHint) this.onHint("Cornice circuit tours the rooms below — find glowing ramps");
  }

  exit() {
    this.active = false;
    this.car.speed = 0;
    this.keys = { forward: false, back: false, left: false, right: false, boost: false };
    this.camera.fov = this._baseFov;
    this.camera.updateProjectionMatrix();
    if (typeof document !== "undefined") {
      document.removeEventListener("keydown", this._onKey);
      document.removeEventListener("keyup", this._onKey);
    }
    this.parkForExplore();
    if (this.onHud) this.onHud({ mode: "off" });
  }

  _respawnAtStart() {
    this.car.setPose(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, CAR_SPAWN.yaw);
    this.car.speed = 0;
    this.car.resetBoost();
    this.keys = { forward: false, back: false, left: false, right: false, boost: false };
    this._crashPhase = null;
    this._crashTimer = 0;
    this._inputsFrozen = false;
    this._flash = 0;
    this._fade = 0;
    this._camVel.set(0, 0, 0);
    this._snapCamera(true);
    this._edgeWarn = 0;
    if (this.onHud) this.onHud({ mode: "manual", text: "Toy tour — cruise the house" });
  }

  _beginCrash() {
    if (this._crashPhase) return;
    this._crashPhase = "smash";
    this._crashTimer = 0;
    this._inputsFrozen = true;
    this.keys = { forward: false, back: false, left: false, right: false, boost: false };
    this.car.crashed = true;
    this.car.speed = 0;
    this.car.vy = 0;
    this._flash = 1;
    this._spawnSmash();
    if (this.onCrash) this.onCrash({ phase: "crash", message: "CRASH" });
    if (this.onHud) this.onHud({ mode: "crash", text: "CRASH" });
  }

  _spawnSmash() {
    const p = this.car.position;
    for (const b of this._smashBits) {
      b.life = 0.5 + Math.random() * 0.45;
      b.vx = (Math.random() - 0.5) * 3.5;
      b.vy = 1.2 + Math.random() * 2.5;
      b.vz = (Math.random() - 0.5) * 3.5;
      b.mesh.visible = true;
      b.mesh.position.set(p.x, p.y + 0.05, p.z);
      b.mesh.material.opacity = 1;
      b.mesh.scale.setScalar(0.8 + Math.random());
    }
  }

  _spawnSparks(amt) {
    const p = this.car.position;
    const yaw = this.car.yaw;
    if (Math.random() > Math.min(0.9, amt * 25)) return;
    const slot = this._sparks.find((s) => s.life <= 0);
    if (!slot) return;
    slot.life = 0.25 + Math.random() * 0.2;
    slot.vx = -Math.sin(yaw) * 0.1 + (Math.random() - 0.5) * 1.2;
    slot.vy = 0.4 + Math.random() * 0.8;
    slot.vz = -Math.cos(yaw) * 0.1 + (Math.random() - 0.5) * 1.2;
    slot.mesh.visible = true;
    slot.mesh.position.set(p.x, p.y + 0.04, p.z);
    slot.mesh.material.opacity = 1;
  }

  _snapCamera(immediate = false) {
    const p = this.car.position;
    const yaw = this.car.yaw;
    const spd = Math.abs(this.car.speed);
    const inWall = this._tunnelDark > 0.35;
    // Leisure factor: slow sightseeing → higher / farther cinematic chase
    const leisure = 1 - THREE.MathUtils.smoothstep(spd, 0.15, 1.35);
    // In-wall: tuck camera close + slightly above car so we never clip inside studs
    const back = (inWall ? 0.16 : 0.4 + leisure * 0.22) + Math.min(0.28, spd * 0.07);
    const up = (inWall ? 0.12 : 0.14 + leisure * 0.1) + Math.min(0.08, spd * 0.022);
    const cx = p.x - Math.sin(yaw) * back;
    const cy = p.y + up;
    const cz = p.z - Math.cos(yaw) * back;
    this._camPos.set(cx, cy, cz);

    // Look along tube / track — shorter ahead in walls keeps view readable
    const ahead = (inWall ? 0.28 : 0.32 + leisure * 0.28) + Math.min(0.4, spd * 0.09);
    this._lookAhead.set(
      p.x + Math.sin(yaw) * ahead,
      p.y + (inWall ? 0.06 : 0.04 + leisure * 0.03) + Math.min(0.03, spd * 0.007),
      p.z + Math.cos(yaw) * ahead
    );
    this._camTarget.copy(this._lookAhead);

    if (immediate) {
      this.camera.position.copy(this._camPos);
      this.camera.lookAt(this._camTarget);
    }
  }

  /**
   * Bounce the RC car off mansion walls/furniture unless in a marked passageway.
   * Mouse-holes / tunnels / shafts intentionally pierce walls.
   */
  _resolveDriveWalls(prevX, prevZ, snap) {
    const cols = this._wallColliders;
    if (!cols || !cols.length) return;
    const kind = snap?.kind || "";
    if (this._passKinds.has(kind) || snap?.tube) return; // intentional passages
    const r = this._carRadius;
    const p = this.car.root.position;
    const y = p.y;
    // Car body height band (~wheel to roof)
    const y0 = y - 0.02;
    const y1 = y + 0.12;
    for (let pass = 0; pass < 2; pass++) {
      let hit = false;
      for (const box of cols) {
        if (y1 < box.min.y || y0 > box.max.y) continue;
        const overlaps =
          p.x + r > box.min.x && p.x - r < box.max.x &&
          p.z + r > box.min.z && p.z - r < box.max.z;
        if (!overlaps) continue;
        hit = true;
        const tryX = { x: p.x, z: prevZ };
        const tryZ = { x: prevX, z: p.z };
        const hitX =
          tryX.x + r > box.min.x && tryX.x - r < box.max.x &&
          tryX.z + r > box.min.z && tryX.z - r < box.max.z;
        const hitZ =
          tryZ.x + r > box.min.x && tryZ.x - r < box.max.x &&
          tryZ.z + r > box.min.z && tryZ.z - r < box.max.z;
        if (!hitX && hitZ) {
          p.z = prevZ;
        } else if (!hitZ && hitX) {
          p.x = prevX;
        } else if (!hitX && !hitZ) {
          // Prefer larger free axis from before
          const dx = Math.abs(p.x - prevX);
          const dz = Math.abs(p.z - prevZ);
          if (dx >= dz) p.z = prevZ;
          else p.x = prevX;
        } else {
          p.x = prevX;
          p.z = prevZ;
        }
        // Depenetrate along shallowest axis
        const ol = (p.x + r) - box.min.x;
        const orr = box.max.x - (p.x - r);
        const od = (p.z + r) - box.min.z;
        const ou = box.max.z - (p.z - r);
        if (ol > 0 && orr > 0 && od > 0 && ou > 0) {
          const m = Math.min(ol, orr, od, ou);
          const eps = 0.004;
          if (m === ol) p.x = box.min.x - r - eps;
          else if (m === orr) p.x = box.max.x + r + eps;
          else if (m === od) p.z = box.min.z - r - eps;
          else p.z = box.max.z + r + eps;
        }
        this.car.speed *= 0.35;
      }
      if (!hit) break;
      prevX = p.x;
      prevZ = p.z;
    }
  }

  _updateFx(dt, snap, flags) {
    const boosting = this.car.isBoosting;
    const spd = Math.abs(this.car.speed);
    const p = this.car.position;
    const yaw = this.car.yaw;
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);
    const inWall =
      snap?.kind === "shortcut" || snap?.kind === "mouse" || snap?.kind === "shaft"
      || snap?.kind === "tunnel" || snap?.kind === "chute";

    // Speed lines — boost OR fast wall run
    const showLines = (boosting && spd > 1.4) || (inWall && spd > 1.8);
    for (let i = 0; i < this._speedLines.length; i++) {
      const line = this._speedLines[i];
      if (showLines) {
        line.visible = true;
        const side = (i % 2 === 0 ? -1 : 1) * (0.06 + (i % 5) * 0.02);
        const back = 0.1 + (i * 0.035);
        line.position.set(
          p.x - fwdX * back + Math.cos(yaw) * side,
          p.y + 0.04 + (i % 3) * 0.02,
          p.z - fwdZ * back - Math.sin(yaw) * side
        );
        line.rotation.y = yaw;
        line.material.opacity = 0.1 + Math.min(0.45, spd * 0.08);
        if (inWall) line.material.color.setHex(0xffe0b2);
        else line.material.color.setHex(0xffffff);
      } else {
        line.material.opacity = Math.max(0, line.material.opacity - 4 * dt);
        if (line.material.opacity <= 0.02) line.visible = false;
      }
    }

    if ((boosting || this.car.driftTrail > 0.35) && spd > 1.2 && Math.random() < 0.35) {
      const slot = this._dust.find((d) => d.life <= 0);
      if (slot) {
        slot.life = 0.45 + Math.random() * 0.35;
        slot.vx = -fwdX * 0.25 + (Math.random() - 0.5) * 0.3;
        slot.vy = 0.15 + Math.random() * 0.2;
        slot.vz = -fwdZ * 0.25 + (Math.random() - 0.5) * 0.3;
        slot.mesh.visible = true;
        slot.mesh.position.set(p.x - fwdX * 0.06, p.y + 0.02, p.z - fwdZ * 0.06);
        const petal = snap?.kind === "flower";
        slot.mesh.material.color.setHex(petal ? 0xf48fb1 : 0xd7ccc8);
        slot.mesh.material.emissive.setHex(petal ? 0xe91e63 : 0xffcc80);
      }
    }
    for (const d of this._dust) {
      if (d.life <= 0) { d.mesh.visible = false; continue; }
      d.life -= dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      d.vy -= 0.5 * dt;
      d.mesh.material.opacity = Math.max(0, d.life * 1.2);
      d.mesh.scale.setScalar(0.7 + (0.5 - d.life));
    }

    if (flags?.scrape > 0.001 || this.car.scrapeAmount > 0.15) {
      this._spawnSparks(flags?.scrape || this.car.scrapeAmount * 0.02);
    }
    for (const s of this._sparks) {
      if (s.life <= 0) { s.mesh.visible = false; continue; }
      s.life -= dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      s.vy -= 2.5 * dt;
      s.mesh.material.opacity = Math.max(0, s.life * 3);
    }

    for (const b of this._smashBits) {
      if (b.life <= 0) { b.mesh.visible = false; continue; }
      b.life -= dt;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
      b.vy -= 6 * dt;
      b.mesh.rotation.x += 8 * dt;
      b.mesh.rotation.z += 6 * dt;
      b.mesh.material.opacity = Math.max(0, b.life * 2);
    }

    // Landing thump — brief dust burst
    if (flags?.landed) {
      for (let i = 0; i < 4; i++) {
        const slot = this._dust.find((d) => d.life <= 0);
        if (!slot) break;
        slot.life = 0.35;
        slot.vx = (Math.random() - 0.5) * 0.8;
        slot.vy = 0.3 + Math.random() * 0.4;
        slot.vz = (Math.random() - 0.5) * 0.8;
        slot.mesh.visible = true;
        slot.mesh.position.set(p.x, p.y + 0.02, p.z);
        slot.mesh.material.color.setHex(0xbcaaa4);
        slot.mesh.material.emissive.setHex(0x6d4c41);
      }
    }
  }

  update(dt) {
    if (!this.active) return;
    this._time += dt;

    // Crash / restart state machine
    if (this._crashPhase === "smash") {
      this._crashTimer += dt;
      this._flash = Math.max(0, this._flash - 2.2 * dt);
      this._updateFx(dt, null, {});
      if (this._crashTimer > 1.05) {
        this._crashPhase = "restarting";
        this._crashTimer = 0;
        this._fade = 0;
        if (this.onCrash) this.onCrash({ phase: "restarting", message: "Crashed! Restarting…" });
        if (this.onHud) this.onHud({ mode: "restart", text: "Crashed! Restarting…" });
      }
      this._applyFlashFade();
      return;
    }
    if (this._crashPhase === "restarting") {
      this._crashTimer += dt;
      this._fade = Math.min(1, this._crashTimer / 0.45);
      this._applyFlashFade();
      if (this._crashTimer > 0.7) {
        this._respawnAtStart();
        this._fade = 0;
        this._applyFlashFade();
        if (this.onCrash) this.onCrash({ phase: "done", message: "" });
      }
      return;
    }

    const pos = this.car.position;
    const snap = this.tracks.querySnap(pos.x, pos.y, pos.z, 1.65);

    if (this.tracks.onBoostPad(pos.x, pos.z) && this.car.speed > 0.35 && !this.car.airborne) {
      this.car.speed = Math.min(this.car.boostMax, this.car.speed + 3.2 * dt);
    }

    const driveKeys = this._inputsFrozen
      ? { forward: false, back: false, left: false, right: false, boost: false }
      : this.keys;

    const prevX = pos.x;
    const prevZ = pos.z;
    const flags = this.car.update(dt, driveKeys, snap);
    this._resolveDriveWalls(prevX, prevZ, snap);
    this.car.idleTwitch(dt);
    this.tracks.updateVisuals(this._time);
    this._updateFx(dt, snap, flags);

    if (this.car.crashed && !this._crashPhase) {
      this._beginCrash();
    }

    this._snapCamera(false);

    const spdAbs = Math.abs(this.car.speed);
    const leisureCam = 1 - THREE.MathUtils.smoothstep(spdAbs, 0.15, 1.3);
    const spring = 10.5 + leisureCam * 3.5; // softer follow when touring slowly
    const damp = 4.2 + leisureCam * 0.8;
    const dx = this._camPos.x - this.camera.position.x;
    const dy = this._camPos.y - this.camera.position.y;
    const dz = this._camPos.z - this.camera.position.z;
    this._camVel.x += (dx * spring - this._camVel.x * damp) * dt;
    this._camVel.y += (dy * spring - this._camVel.y * damp) * dt;
    this._camVel.z += (dz * spring - this._camVel.z * damp) * dt;
    this.camera.position.x += this._camVel.x * dt;
    this.camera.position.y += this._camVel.y * dt;
    this.camera.position.z += this._camVel.z * dt;
    this.camera.lookAt(this._camTarget);

    const inDark =
      snap?.kind === "shortcut" || snap?.kind === "mouse" || snap?.kind === "shaft"
      || snap?.kind === "tunnel" || snap?.kind === "chute";
    this._tunnelDark = THREE.MathUtils.lerp(this._tunnelDark, inDark ? 1 : 0, Math.min(1, 3.5 * dt));

    // Echo-y tighter FOV in walls; leisurely cruise uses calmer FOV; boost is a treat
    const leisureF = 1 - THREE.MathUtils.smoothstep(Math.abs(this.car.speed), 0.2, 1.4);
    let wantFov = THREE.MathUtils.lerp(this._driveFov, this._leisureFov, leisureF * 0.85);
    wantFov -= this._tunnelDark * (wantFov - this._wallFov);
    if (this.keys.boost && Math.abs(this.car.speed) > 1.5) wantFov += 2.8;
    this._fov = THREE.MathUtils.lerp(this._fov, wantFov, Math.min(1, 2.8 * dt));
    // Shrink near-plane in walls so chase cam doesn't clip inside cavity meshes
    const wantNear = THREE.MathUtils.lerp(0.08, 0.035, this._tunnelDark);
    let projDirty = Math.abs(this.camera.fov - this._fov) > 0.08;
    if (Math.abs(this.camera.near - wantNear) > 0.004) {
      this.camera.near = wantNear;
      projDirty = true;
    }
    if (projDirty) {
      this.camera.fov = this._fov;
      this.camera.updateProjectionMatrix();
    }

    if (this.onSpeed) this.onSpeed(this.car.getSpeedKmh());

    this._labelCooldown = Math.max(0, this._labelCooldown - dt);
    this._hintCooldown = Math.max(0, this._hintCooldown - dt);

    const cp = this.tracks.nearestCheckpoint(pos.x, pos.z, 2.4, pos.y);
    if (cp && cp.label !== this._lastLabel && this._labelCooldown <= 0) {
      this._lastLabel = cp.label;
      this._labelCooldown = 2.5;
      if (this.onCheckpoint) {
        const isShortcut = SHORTCUT_TOAST_RE.test(cp.label);
        this.onCheckpoint(cp.label, { shortcut: isShortcut });
      }
    }

    const portal = this.tracks.nearestPortal(pos.x, pos.y, pos.z, 1.8);
    if (portal && this._hintCooldown <= 0 && !this._crashPhase) {
      const hint =
        portal.kind === "flower" ? "Shortcut — petal path"
          : portal.kind === "shaft" || portal.kind === "chute" ? "Shortcut — pipe shaft"
            : "Wall run";
      if (hint !== this._lastHint) {
        this._lastHint = hint;
        this._hintCooldown = 3.0;
        if (this.onHint) this.onHint(hint);
        if (hint === "Wall run" && this.onHud) {
          this.onHud({ mode: "wall", text: "Wall run" });
        }
      }
    }


    // Soft near-edge hint on elevated tracks (still hard crash if you fall)
    this._edgeHintCd = Math.max(0, this._edgeHintCd - dt);
    let edgeAmt = 0;
    if (snap && snap.onTrack && snap.elevated && typeof snap.edgeMargin === "number") {
      // edgeMargin: distance inside half-width; small = near rim
      if (snap.edgeMargin < 0.075) {
        edgeAmt = THREE.MathUtils.clamp(1 - snap.edgeMargin / 0.075, 0, 1);
      }
    }
    this._edgeWarn = THREE.MathUtils.lerp(this._edgeWarn, edgeAmt, Math.min(1, 6 * dt));
    if (this._edgeWarn > 0.45 && this._edgeHintCd <= 0 && !this._crashPhase) {
      this._edgeHintCd = 2.8;
      if (this.onHint) this.onHint("Near the edge — ease back toward the track");
    }

    this._applyFlashFade();
  }

  _applyFlashFade() {
    // Expose flash/fade via CSS variables on document if present
    if (typeof document === "undefined") return;
    const overlay = document.getElementById("drive-crash-overlay");
    if (overlay) {
      if (this._flash > 0.02 || this._fade > 0.02) {
        overlay.classList.add("show");
        const flashA = Math.min(0.85, this._flash * 0.85);
        const fadeA = this._fade * 0.92;
        overlay.style.background =
          this._fade > 0.05
            ? `rgba(8,4,2,${fadeA})`
            : `rgba(255,220,180,${flashA})`;
      } else {
        overlay.classList.remove("show");
        overlay.style.background = "transparent";
      }
    }
    const edge = document.getElementById("drive-edge-vignette");
    if (edge) {
      const a = this.active ? Math.min(0.55, this._edgeWarn * 0.55) : 0;
      if (a > 0.04) {
        edge.classList.add("show");
        edge.style.opacity = String(a);
      } else {
        edge.classList.remove("show");
        edge.style.opacity = "0";
      }
    }
  }

  get flashAmount() {
    return this._flash;
  }
}
