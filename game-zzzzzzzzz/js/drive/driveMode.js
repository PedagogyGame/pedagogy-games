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
    this._camElevated = 0; // smoothed elevated chase blend
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
    this._wallGrid = new Map();
    this._wallGridCell = 3.0;
    this._wallGridOriginX = 0;
    this._wallGridOriginZ = 0;
    this._carRadius = 0.09;
    this._passKinds = new Set(["shortcut", "mouse", "shaft", "tunnel", "chute"]);
    this._stuckTimer = 0;
    this._stuckNudgeCd = 0;
    this._jamHits = 0;

    // Temporary chase-cam fill so foyer spawn is not pitch black (room lights sit high/center)
    this._fillLight = new THREE.PointLight(0xffe0b2, 4.2, 11, 2);
    this._fillLight.name = "drive_fill";
    this._fillLight.visible = false;
    this._fillLight.position.set(CAR_SPAWN.x, CAR_SPAWN.y + 1.6, CAR_SPAWN.z);
    scene.add(this._fillLight);

    this.parkForExplore();
  }

  /** Wire mansion colliders so Drive cannot clip through solid walls (except mouse/tunnels).
   * Furniture AABBs are raised/shrunk for Drive only — tiny car is not caged under tables
   * or between wall and furniture bases. Room walls stay hard. Explore keeps full boxes.
   */
  setWallColliders(colliders) {
    if (!colliders || !colliders.length) {
      this._wallColliders = null;
      this._buildWallGrid();
      return;
    }
    this._wallColliders = colliders.map((b) => this._driveSoftCollider(b));
    this._buildWallGrid();
  }

  /**
   * Soft copy for Drive: furniture shrink XZ ~26% and raise min.y so floor cruise
   * (car height band ~0..0.12) slips under tabletops / past chair bases.
   * Stair underside slabs raise above the *story* RC band so ramp-foot approach is not
   * pinned (foyer y≈0, landing y≈4.2, cellar y≈-4.2). Absolute 0.52 only fixed ground;
   * stringers stay (already inset inside stair footprint in mansion build).
   */
  _driveSoftCollider(box) {
    const out = box.clone();
    out.driveKind = box.driveKind || "wall";
    if (out.driveKind === "stair") {
      const bw = out.max.x - out.min.x;
      const bd = out.max.z - out.min.z;
      const thinStringer = Math.min(bw, bd) < 0.35 && Math.max(bw, bd) > 0.75;
      if (thinStringer) {
        // Authored stair side AABBs span both stories. Leave a car-height portal at
        // each floor so skirting that crosses a stair foot/crest cannot pillar-grab;
        // the middle still blocks off-road cuts and ramp snaps pierce it while climbing.
        out.min.y += 0.54;
        out.max.y -= 0.55;
      } else if (bw > 0.75 && bd > 0.75) {
        // Underside / tread slab (both axes wide): raise relative to story floor.
        // Built as yLo-0.15 … yLo+… — story floor ≈ min.y + 0.15.
        const storyFloor = out.min.y + 0.15;
        const raised = storyFloor + 0.52;
        // Never invert AABB (descending cellar underside max is below ground 0.52).
        if (raised < out.max.y - 0.05) {
          out.min.y = Math.max(out.min.y, raised);
        } else {
          out.min.y = Math.min(out.max.y - 0.08, Math.max(out.min.y, storyFloor + 0.42));
        }
      }
      return out;
    }
    if (out.driveKind !== "furniture") return out;
    const cx = (out.min.x + out.max.x) * 0.5;
    const cz = (out.min.z + out.max.z) * 0.5;
    const hx = Math.max(0.06, (out.max.x - out.min.x) * 0.5 * 0.74);
    const hz = Math.max(0.06, (out.max.z - out.min.z) * 0.5 * 0.74);
    out.min.x = cx - hx;
    out.max.x = cx + hx;
    out.min.z = cz - hz;
    out.max.z = cz + hz;
    // Raise collision floor — leave a crawl gap for the RC car
    const raise = 0.36;
    if (out.max.y - out.min.y > raise + 0.12) {
      out.min.y = Math.min(out.max.y - 0.12, out.min.y + raise);
    } else {
      // Short volumes: shrink further in XZ instead of fully blocking floor
      const hx2 = hx * 0.85;
      const hz2 = hz * 0.85;
      out.min.x = cx - hx2;
      out.max.x = cx + hx2;
      out.min.z = cz - hz2;
      out.max.z = cz + hz2;
      out.min.y = Math.min(out.max.y - 0.08, out.min.y + 0.22);
    }
    return out;
  }

  /** XZ spatial hash for Drive wall bounce — same idea as track snap grid. */
  _buildWallGrid() {
    this._wallGrid = new Map();
    this._wallGridCell = 3.0;
    this._wallGridOriginX = 0;
    this._wallGridOriginZ = 0;
    const cols = this._wallColliders;
    if (!cols || !cols.length) return;
    let minX = Infinity, minZ = Infinity;
    for (const b of cols) {
      minX = Math.min(minX, b.min.x);
      minZ = Math.min(minZ, b.min.z);
    }
    this._wallGridOriginX = minX;
    this._wallGridOriginZ = minZ;
    const cell = this._wallGridCell;
    const pad = 0; // boxes already padded by car radius at query time
    for (let i = 0; i < cols.length; i++) {
      const b = cols[i];
      const ix0 = Math.floor((b.min.x - this._wallGridOriginX) / cell) - pad;
      const ix1 = Math.floor((b.max.x - this._wallGridOriginX) / cell) + pad;
      const iz0 = Math.floor((b.min.z - this._wallGridOriginZ) / cell) - pad;
      const iz1 = Math.floor((b.max.z - this._wallGridOriginZ) / cell) + pad;
      for (let ix = ix0; ix <= ix1; ix++) {
        for (let iz = iz0; iz <= iz1; iz++) {
          const key = ix + "," + iz;
          let bucket = this._wallGrid.get(key);
          if (!bucket) { bucket = []; this._wallGrid.set(key, bucket); }
          bucket.push(i);
        }
      }
    }
    console.log(
      `[DriveMode] wallGrid=${this._wallGrid.size} cells @ ${cell}m for ${cols.length} colliders (spatial, not linear scan)`
    );
  }

  _wallsNear(x, z, radius) {
    const cols = this._wallColliders;
    if (!cols || !cols.length) return [];
    if (!this._wallGrid || !this._wallGrid.size) return cols;
    const cell = this._wallGridCell;
    const r = radius;
    const ix0 = Math.floor((x - r - this._wallGridOriginX) / cell);
    const ix1 = Math.floor((x + r - this._wallGridOriginX) / cell);
    const iz0 = Math.floor((z - r - this._wallGridOriginZ) / cell);
    const iz1 = Math.floor((z + r - this._wallGridOriginZ) / cell);
    const seen = new Set();
    const out = [];
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const bucket = this._wallGrid.get(ix + "," + iz);
        if (!bucket) continue;
        for (const idx of bucket) {
          if (seen.has(idx)) continue;
          seen.add(idx);
          out.push(cols[idx]);
        }
      }
    }
    return out;
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
    if (this.onHud) this.onHud({ mode: "manual", text: "" });
  }

  parkForExplore() {
    this.active = false;
    this.car.setPose(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, CAR_SPAWN.yaw);
    this.car.speed = 0;
    this.car.root.visible = true;
    this.car.setLightsSubtle(true);
    // Explore: hide asphalt ribbons; keep subtle mouse-portal cues near tracks
    this.tracks.setVisible("explore");
    this._fxRoot.visible = false;
    if (this._fillLight) this._fillLight.visible = false;
    this._crashPhase = null;
    this._inputsFrozen = false;
    this._flash = 0;
    this._fade = 0;
    this._edgeWarn = 0;
    this._applyFlashFade();
  }

  _onKey(e) {
    const code = e.code;
    const isDriveKey =
      code === "KeyW" || code === "ArrowUp" ||
      code === "KeyS" || code === "ArrowDown" ||
      code === "KeyA" || code === "ArrowLeft" ||
      code === "KeyD" || code === "ArrowRight" ||
      code === "ShiftLeft" || code === "ShiftRight";
    if (!this.active || this._inputsFrozen) {
      if (this._inputsFrozen) {
        // Still clear keys so they don't stick after restart
        const down = e.type === "keydown";
        if (!down) {
          switch (code) {
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
    if (!isDriveKey) return;
    if (e.cancelable) e.preventDefault();
    const down = e.type === "keydown";
    switch (code) {
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
    // Face along open road (snap yaw + wall probe), never into foyer south wall
    const spawnYaw = this._pickOpenRoadYaw(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, CAR_SPAWN.yaw);
    this.car.setPose(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, spawnYaw);
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
    this._stuckTimer = 0;
    this._stuckNudgeCd = 0;
    this._jamHits = 0;
    if (this._fillLight) {
      this._fillLight.visible = true;
      this._fillLight.intensity = 4.2;
      this._fillLight.position.set(CAR_SPAWN.x, CAR_SPAWN.y + 1.6, CAR_SPAWN.z);
    }
    if (typeof document !== "undefined") {
      const canvas = document.getElementById("c");
      if (canvas) {
        if (!canvas.hasAttribute("tabindex") || canvas.tabIndex < 0) canvas.tabIndex = 0;
        try { canvas.focus({ preventScroll: true }); } catch (_) { try { canvas.focus(); } catch (_) {} }
      }
      // Idempotent rebind (capture) — Drive WASD works without pointer lock / button focus
      const win = typeof window !== "undefined" ? window : null;
      if (win && typeof win.removeEventListener === "function") {
        win.removeEventListener("keydown", this._onKey, true);
        win.removeEventListener("keyup", this._onKey, true);
      }
      document.removeEventListener("keydown", this._onKey, true);
      document.removeEventListener("keyup", this._onKey, true);
      if (win && typeof win.addEventListener === "function") {
        win.addEventListener("keydown", this._onKey, true);
        win.addEventListener("keyup", this._onKey, true);
      }
      document.addEventListener("keydown", this._onKey, true);
      document.addEventListener("keyup", this._onKey, true);
    }
    this._snapCamera(true);
    // Drive HUD is speed + vehicle only — no lingering instruction text
    if (this.onHud) this.onHud({ mode: "manual", text: "" });
  }

  exit() {
    this.active = false;
    this.car.speed = 0;
    this.keys = { forward: false, back: false, left: false, right: false, boost: false };
    this.camera.fov = this._baseFov;
    this.camera.updateProjectionMatrix();
    if (this._fillLight) this._fillLight.visible = false;
    if (typeof document !== "undefined") {
      const win = typeof window !== "undefined" ? window : null;
      if (win && typeof win.removeEventListener === "function") {
        win.removeEventListener("keydown", this._onKey, true);
        win.removeEventListener("keyup", this._onKey, true);
      }
      document.removeEventListener("keydown", this._onKey, true);
      document.removeEventListener("keyup", this._onKey, true);
    }
    this.parkForExplore();
    if (this.onHud) this.onHud({ mode: "off" });
  }

  _respawnAtStart() {
    const spawnYaw = this._pickOpenRoadYaw(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, CAR_SPAWN.yaw);
    this.car.setPose(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, spawnYaw);
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
    this._stuckTimer = 0;
    this._stuckNudgeCd = 0;
    this._jamHits = 0;
    if (this.onHud) this.onHud({ mode: "manual", text: "" });
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
    const elev = this._camElevated || 0;
    // Leisure factor: slow sightseeing → higher / farther cinematic chase
    const leisure = 1 - THREE.MathUtils.smoothstep(spd, 0.15, 1.35);
    // In-wall: tuck camera close + slightly above car so we never clip inside studs
    // Elevated: slightly higher / calmer chase so cornice banks don't jitter the lens
    const back = (inWall ? 0.16 : 0.4 + leisure * 0.22 + elev * 0.06) + Math.min(0.28, spd * 0.07);
    const up = (inWall ? 0.12 : 0.14 + leisure * 0.1 + elev * 0.05) + Math.min(0.08, spd * 0.022);
    const cx = p.x - Math.sin(yaw) * back;
    const cy = p.y + up;
    const cz = p.z - Math.cos(yaw) * back;
    this._camPos.set(cx, cy, cz);

    // Look along tube / track — shorter ahead in walls keeps view readable
    const ahead = (inWall ? 0.28 : 0.32 + leisure * 0.28 + elev * 0.06) + Math.min(0.4, spd * 0.09);
    this._lookAhead.set(
      p.x + Math.sin(yaw) * ahead,
      p.y + (inWall ? 0.06 : 0.04 + leisure * 0.03 + elev * 0.02) + Math.min(0.03, spd * 0.007),
      p.z + Math.cos(yaw) * ahead
    );
    this._camTarget.copy(this._lookAhead);

    if (immediate) {
      this.camera.position.copy(this._camPos);
      this.camera.lookAt(this._camTarget);
    }
  }

  /**
   * Push an XZ point out of Drive wall/furniture AABBs (car radius pad).
   * Skirting centerlines sometimes clip stair stringers — magnets must aim clear.
   */
  _clearPointFromWalls(x, z, y, pad = 0.02) {
    const r = this._carRadius + pad;
    const y0 = y - 0.02;
    const y1 = y + 0.12;
    let px = x;
    let pz = z;
    const cols = this._wallsNear(px, pz, r + 0.5);
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      for (const box of cols) {
        if (y1 < box.min.y || y0 > box.max.y) continue;
        if (!(px + r > box.min.x && px - r < box.max.x &&
              pz + r > box.min.z && pz - r < box.max.z)) continue;
        const ol = (px + r) - box.min.x;
        const orr = box.max.x - (px - r);
        const od = (pz + r) - box.min.z;
        const ou = box.max.z - (pz - r);
        const eps = 0.008;
        const bw = box.max.x - box.min.x;
        const bd = box.max.z - box.min.z;
        // Thin stair stringers / jambs: escape along the thin axis so ribbon
        // magnets stay beside the slab (not parked on its short end-cap).
        const thinX = bw < bd * 0.65;
        const thinZ = bd < bw * 0.65;
        const minX = Math.min(ol, orr);
        const minZ = Math.min(od, ou);
        // Prefer escaping thin slabs sideways (stair stringers) — end-cap
        // shallowest-Z traps skirting magnets on the short face.
        let useX;
        if (thinX && minX < 0.55) useX = true;
        else if (thinZ && minZ < 0.55) useX = false;
        else useX = minX <= minZ;
        if (useX) {
          if (ol < orr) px = box.min.x - r - eps;
          else px = box.max.x + r + eps;
        } else {
          if (od < ou) pz = box.min.z - r - eps;
          else pz = box.max.z + r + eps;
        }
        moved = true;
      }
      if (!moved) break;
    }
    return { x: px, z: pz };
  }

  /**
   * Choose yaw along open asphalt — prefer snap yaw / reverse that does NOT
   * immediately nose into a wall or furniture collider (T-junction safe).
   */
  _pickOpenRoadYaw(x, y, z, fallback) {
    const snap = this.tracks.querySnap(x, y, z, 2.0, fallback);
    let base = (snap && Number.isFinite(snap.yaw)) ? snap.yaw : fallback;
    // Prefer floor ribbon yaw when a kissing ramp stole the junction snap
    if (snap && (snap.kind === "ramp" || snap.kind === "elevated")) {
      const esc = this.tracks.findEscapeSnap ? this.tracks.findEscapeSnap(x, y, z, 2.2) : null;
      if (esc && (esc.kind === "floor" || esc.kind === "outdoor")
          && Number.isFinite(esc.yaw) && esc.dist < 0.55) {
        base = esc.yaw;
      }
    }
    // Dense forward samples so thin posts/pillars between coarse distances cannot sneak through
    const probeClear = (yaw, dist = 0.85) => {
      const dx = Math.sin(yaw) * dist;
      const dz = Math.cos(yaw) * dist;
      const px = x + dx;
      const pz = z + dz;
      const r = this._carRadius;
      const cols = this._wallsNear(px, pz, r + 0.28);
      const y0 = y - 0.02;
      const y1 = y + 0.12;
      for (const box of cols) {
        if (y1 < box.min.y || y0 > box.max.y) continue;
        if (px + r > box.min.x && px - r < box.max.x &&
            pz + r > box.min.z && pz - r < box.max.z) {
          return false;
        }
      }
      return true;
    };
    const corridorClear = (yaw) => {
      // Require clear asphalt ≥3 m ahead (pillar/furniture must not sit in camera cone)
      for (const d of [0.35, 0.7, 1.1, 1.6, 2.2, 3.0]) {
        if (!probeClear(yaw, d)) return false;
      }
      return true;
    };
    // Authored spawn yaw FIRST (into foyer / toward climb) — never let
    // skirting tangent steal into a wall-hug heading when the fallback is clear.
    const candidates = [];
    if (Number.isFinite(fallback)) {
      candidates.push(fallback, fallback + Math.PI);
    }
    candidates.push(base, base + Math.PI, base + Math.PI / 2, base - Math.PI / 2);
    // Mild offsets if authored heading kisses a post
    if (Number.isFinite(fallback)) {
      for (const d of [0.25, -0.25, 0.5, -0.5, 0.85, -0.85]) candidates.push(fallback + d);
    }
    const seen = new Set();
    for (const yaw of candidates) {
      const key = (Math.round(yaw * 1000) / 1000);
      if (seen.has(key)) continue;
      seen.add(key);
      if (corridorClear(yaw)) return yaw;
    }
    for (const yaw of candidates) {
      if (probeClear(yaw, 0.9) && probeClear(yaw, 1.35) && probeClear(yaw, 2.0)) return yaw;
    }
    for (const yaw of candidates) {
      if (probeClear(yaw, 0.55)) return yaw;
    }
    return Number.isFinite(fallback) ? fallback : base;
  }

  /** Foyer climb approach corridor — stair/furniture must not pin before snap. */
  _nearFoyerClimbCorridor(x, z) {
    // Climb foot EAST of grand stair — approach must not pin on stringers/furniture
    const fx = -4.70, fz = 10.60;
    if (Math.hypot(x - fx, z - fz) <= 1.65) return true;
    // East-flank climb band (open asphalt → beside stair → landing)
    if (x >= -5.60 && x <= -3.60 && z >= -0.8 && z <= 11.2) {
      const along = Math.hypot(x - fx, z - fz);
      if (along < 3.2) return true;
    }
    return false;
  }

  /**
   * Soft wall slide — depenetrate along outward normal, keep tangential speed,
   * scrub only when head-on. Grazing along skirting must NOT pin to ~0.
   * Passages / on-track ramp climbs still pierce.
   */
  _resolveDriveWalls(prevX, prevZ, snap) {
    this._frameWallHits = 0;
    if (!this._wallColliders || !this._wallColliders.length) return;
    const kind = snap?.kind || "";
    if (this._passKinds.has(kind) || snap?.tube) return;
    // Pierce while climbing OR approaching foot (nearDeck / continuity) so stair
    // stringers / underside never pin the ribbon path onto the ramp.
    if (kind === "ramp" && (snap?.onTrack || snap?.nearDeck || snap?.rampContinuity)) return;
    const r = this._carRadius;
    const p = this.car.root.position;
    const y = p.y;
    const y0 = y - 0.02;
    const y1 = y + 0.12;
    // Ruthless: in foyer climb corridor, pierce ALL stair/furniture within 1.5m
    // so dark-pad / stringer / pillar cannot kill speed before ramp snap.
    const climbApproach = this._nearFoyerClimbCorridor(p.x, p.z);
    if (climbApproach && (kind === "floor" || kind === "ramp" || !kind)) {
      // Still collide with room walls — only soft kinds are pierced
    }
    let cols = this._wallsNear(p.x, p.z, r + 0.35);
    if (climbApproach) {
      cols = cols.filter((b) => (b.driveKind || "wall") === "wall");
    }
    if (!cols.length) return;

    const onRibbon = !!(snap && snap.onTrack);
    let hitCount = 0;
    let accNX = 0;
    let accNZ = 0;

    for (let pass = 0; pass < 3; pass++) {
      let hit = false;
      for (const box of cols) {
        if (y1 < box.min.y || y0 > box.max.y) continue;
        const overlaps =
          p.x + r > box.min.x && p.x - r < box.max.x &&
          p.z + r > box.min.z && p.z - r < box.max.z;
        if (!overlaps) continue;
        hit = true;

        // Depenetrate along shallowest axis → outward normal
        const ol = (p.x + r) - box.min.x;
        const orr = box.max.x - (p.x - r);
        const od = (p.z + r) - box.min.z;
        const ou = box.max.z - (p.z - r);
        if (!(ol > 0 && orr > 0 && od > 0 && ou > 0)) continue;
        const eps = 0.006;
        const bw = box.max.x - box.min.x;
        const bd = box.max.z - box.min.z;
        const thinX = bw < bd * 0.65;
        const thinZ = bd < bw * 0.65;
        const minX = Math.min(ol, orr);
        const minZ = Math.min(od, ou);
        let useX;
        if (thinX && minX < 0.55) useX = true;
        else if (thinZ && minZ < 0.55) useX = false;
        else useX = minX <= minZ;
        let nx = 0;
        let nz = 0;
        if (useX) {
          if (ol < orr) { p.x = box.min.x - r - eps; nx = -1; }
          else { p.x = box.max.x + r + eps; nx = 1; }
        } else {
          if (od < ou) { p.z = box.min.z - r - eps; nz = -1; }
          else { p.z = box.max.z + r + eps; nz = 1; }
        }

        hitCount += 1;
        accNX += nx;
        accNZ += nz;
        this._frameWallHits = (this._frameWallHits || 0) + 1;
        const soft = box.driveKind === "furniture" || box.driveKind === "stair";
        if (!soft) this._jamHits = (this._jamHits || 0) + 1;
        // Floor asphalt onTrack: positional depenetrate ONLY — no speed scrub / yaw yank
        // (aggressive scrub was killing W cruise to ~3 km/h / pin on apron edge).
        const floorCruise = onRibbon && (kind === "floor" || kind === "outdoor" || kind === "flower");
        if (floorCruise) {
          this.car._scrape = Math.min(1, (this.car._scrape || 0) + 0.08);
          // Still kill into-wall speed when nose-in — otherwise HUD speed>0 while position frozen
          const fwdX0 = Math.sin(this.car.yaw);
          const fwdZ0 = Math.cos(this.car.yaw);
          const headOn0 = Math.max(0, -(fwdX0 * nx + fwdZ0 * nz));
          if (headOn0 > 0.55) {
            const spd0 = this.car.speed;
            const vx0 = fwdX0 * spd0;
            const vz0 = fwdZ0 * spd0;
            const nDot0 = vx0 * nx + vz0 * nz;
            if (nDot0 < 0) {
              const vx2 = vx0 - nDot0 * nx;
              const vz2 = vz0 - nDot0 * nz;
              const spd2 = Math.hypot(vx2, vz2);
              const signed = Math.sign(spd0 || 1);
              if (spd2 > 0.05) {
                const slideYaw = Math.atan2(vx2, vz2);
                let dyaw = slideYaw - this.car.yaw;
                while (dyaw > Math.PI) dyaw -= Math.PI * 2;
                while (dyaw < -Math.PI) dyaw += Math.PI * 2;
                this.car.yaw += dyaw * Math.min(0.55, 0.18 + headOn0 * 0.4);
                this.car.root.rotation.y = this.car.yaw;
                this.car.speed = signed * Math.max(spd2 * 0.92, 0.45);
              } else {
                this.car.speed *= 0.55;
              }
            }
          }
          continue;
        }
        // Feed car scrape FX while sliding mansion walls off-ribbon / elevated
        this.car._scrape = Math.min(1, (this.car._scrape || 0) + (soft ? 0.25 : 0.45));

        // Fresh forward each hit (yaw may have slid on prior collider)
        const fwdX = Math.sin(this.car.yaw);
        const fwdZ = Math.cos(this.car.yaw);

        // Project velocity onto wall tangent — slide, don't pin
        const spd = this.car.speed;
        const vx = fwdX * spd;
        const vz = fwdZ * spd;
        const nDotV = vx * nx + vz * nz;
        const headOn = Math.max(0, -(fwdX * nx + fwdZ * nz)); // 0=graze, 1=nose-in

        if (nDotV < 0) {
          // Remove into-wall component; keep tangential slide
          const vx2 = vx - nDotV * nx;
          const vz2 = vz - nDotV * nz;
          const spd2 = Math.hypot(vx2, vz2);
          if (spd2 > 0.04) {
            const slideYaw = Math.atan2(vx2, vz2);
            let dyaw = slideYaw - this.car.yaw;
            while (dyaw > Math.PI) dyaw -= Math.PI * 2;
            while (dyaw < -Math.PI) dyaw += Math.PI * 2;
            // Light yaw slide only when clearly head-on — grazing must not yank steer
            const yawBlend = Math.min(0.42, 0.10 + headOn * 0.32);
            this.car.yaw += dyaw * yawBlend;
            this.car.root.rotation.y = this.car.yaw;
            const loss = soft
              ? (0.04 + headOn * 0.16)
              : (0.07 + headOn * 0.28);
            const signed = Math.sign(spd || 1);
            this.car.speed = signed * spd2 * (1 - Math.min(0.55, loss));
            if (onRibbon && headOn < 0.55) {
              const floor = Math.min(this.car.maxSpeed * 0.70, 0.85);
              const keep = headOn < 0.25 ? 0.72 : 0.55;
              if (Math.abs(this.car.speed) < floor * keep) {
                this.car.speed = signed * Math.max(Math.abs(this.car.speed), floor * keep);
              }
            }
          } else {
            // Truly jammed into wall with no tangent — soft bounce reverse
            this.car.speed *= soft ? 0.48 : 0.32;
            const tx = -nz;
            const tz = nx;
            const intend = (prevX !== p.x || prevZ !== p.z)
              ? Math.atan2(p.x - prevX, p.z - prevZ)
              : this.car.yaw;
            const tYawA = Math.atan2(tx, tz);
            const tYawB = Math.atan2(-tx, -tz);
            let dA = tYawA - intend;
            let dB = tYawB - intend;
            while (dA > Math.PI) dA -= Math.PI * 2;
            while (dA < -Math.PI) dA += Math.PI * 2;
            while (dB > Math.PI) dB -= Math.PI * 2;
            while (dB < -Math.PI) dB += Math.PI * 2;
            this.car.yaw = Math.abs(dA) <= Math.abs(dB) ? tYawA : tYawB;
            this.car.root.rotation.y = this.car.yaw;
            if (Math.abs(this.car.speed) < 0.25) {
              this.car.speed = Math.sign(this.car.speed || 1) * 0.35;
            }
          }
        } else {
          // Parallel / moving away — whisper scrub only
          this.car.speed *= soft ? 0.99 : 0.97;
        }
      }
      if (!hit) break;
    }

    // Under wall pressure: light outward + tiny wall-safe centerline nudge — NO yaw magnet.
    // (Full 0.42 shove + yaw settle was yanking steer into furniture; keep positional only.)
    if (hitCount > 0 && onRibbon && snap && snap.x != null && snap.z != null) {
      const nLen = Math.hypot(accNX, accNZ) || 1;
      const nnx = accNX / nLen;
      const nnz = accNZ / nLen;
      const toSX = snap.x - p.x;
      const toSZ = snap.z - p.z;
      const nDot = toSX * nnx + toSZ * nnz;
      // Drop into-wall component of magnet
      const adjX = toSX - Math.min(0, nDot) * nnx;
      const adjZ = toSZ - Math.min(0, nDot) * nnz;
      const pull = (kind === "floor" || kind === "outdoor" || kind === "flower") ? 0.10 : 0.08;
      p.x += adjX * pull;
      p.z += adjZ * pull;
      p.x += nnx * 0.010;
      p.z += nnz * 0.010;
    }
  }


  /**
   * Auto-unstuck: forward input but speed≈0 for >0.6s, or jammed in colliders.
   * Soft-nudge toward nearest visible onTrack asphalt (prefer floor/outdoor).
   */
  _updateStuckEscape(dt, keys, snap, prevX, prevZ) {
    if (!this.active || this._inputsFrozen || this.car.airborne || this.car.crashed) {
      this._stuckTimer = 0;
      this._jamHits = 0;
      return;
    }
    this._stuckNudgeCd = Math.max(0, (this._stuckNudgeCd || 0) - dt);
    const forward = !!(keys && keys.forward);
    const absV = Math.abs(this.car.speed);
    const p = this.car.root.position;
    const moved = Math.hypot(p.x - prevX, p.z - prevZ);
    const onRibbon = !!(snap && snap.onTrack);
    // Stall: forward but barely moving (0 km/h screenshot) OR scraping wall while off-ribbon
    const stalled = forward && !onRibbon && absV < 0.08 && moved < 0.005;
    const slowOffRoad = forward && !onRibbon && absV < 0.20 && moved < 0.012
      && ((this._frameWallHits || 0) >= 1 || (snap && snap.carpet));
    const jammed = forward && absV < 0.15 && (
      (this._frameWallHits || 0) >= 2 || (this._jamHits || 0) >= 3
    );
    // On-ribbon wall pin (skirting scrape that still dies) — escape sooner
    const wallPin = forward && onRibbon && absV < 0.18 && moved < 0.004
      && (this._frameWallHits || 0) >= 1;
    // Ben freeze class: HUD speed>0 but position locked against wall/furniture
    const speedFrozen = forward && moved < 0.0025 && absV > 0.25
      && ((this._frameWallHits || 0) >= 1 || (this._jamHits || 0) >= 1);

    if (stalled || jammed || slowOffRoad || wallPin || speedFrozen) {
      this._stuckTimer = (this._stuckTimer || 0) + dt;
    } else if (!forward || (onRibbon && !speedFrozen && absV > 0.35 && moved > 0.008)) {
      this._stuckTimer = 0;
      this._jamHits = 0;
    } else if (!forward || (onRibbon && moved > 0.01)) {
      this._stuckTimer = Math.max(0, (this._stuckTimer || 0) - dt * 0.5);
      this._jamHits = Math.max(0, (this._jamHits || 0) - 1);
    } else {
      this._stuckTimer = Math.max(0, (this._stuckTimer || 0) - dt * 0.35);
      this._jamHits = Math.max(0, (this._jamHits || 0) - 1);
    }

    // Escape sooner on ribbon wall-pin / speed-freeze / ramp-approach grab
    const nearClimb = !!(snap && (snap.kind === "ramp" || snap.nearDeck || snap.rampContinuity));
    const stuckNeed = (wallPin || speedFrozen || nearClimb) ? 0.28 : 0.6;
    if (this._stuckTimer < stuckNeed || this._stuckNudgeCd > 0) return;

    const escape = this.tracks.findEscapeSnap
      ? this.tracks.findEscapeSnap(p.x, p.y, p.z, 4.5)
      : null;
    // Prefer road center + forward along ribbon (not sideways into furniture/stairs)
    const target = (escape && escape.onTrack) ? escape : (snap && snap.onTrack ? snap : escape);
    if (!target || target.x == null) {
      this._stuckTimer = 0;
      this._jamHits = 0;
      this._stuckNudgeCd = 0.85;
      return;
    }
    let yaw = (target.yaw != null && Number.isFinite(target.yaw)) ? target.yaw : this.car.yaw;
    // Choose ribbon direction closest to current facing / travel intent
    let dYaw = yaw - this.car.yaw;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    let dYawR = dYaw + Math.PI;
    while (dYawR > Math.PI) dYawR -= Math.PI * 2;
    while (dYawR < -Math.PI) dYawR += Math.PI * 2;
    if (Math.abs(dYawR) < Math.abs(dYaw)) yaw += Math.PI;
    // Nudge to centerline then along road forward (away from pin), then clear walls
    let nx = target.x + Math.sin(yaw) * 0.35;
    let nz = target.z + Math.cos(yaw) * 0.35;
    const cleared = this._clearPointFromWalls(nx, nz, p.y, 0.04);
    p.x = cleared.x;
    p.z = cleared.z;
    if (target.y != null) p.y = Math.max(p.y, target.y);
    this.car.yaw = yaw;
    this.car.root.rotation.y = this.car.yaw;
    this.car.speed = Math.max(0.75, Math.min(this.car.maxSpeed * 0.60, Math.abs(this.car.speed) + 0.60));
    this.car.airborne = false;
    this.car.vy = 0;
    this.car._unsupportedFrames = 0;
    this._stuckTimer = 0;
    this._jamHits = 0;
    this._stuckNudgeCd = 1.0;
    if (this.onHint) this.onHint("Unstuck — back on the road");
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

    // Track real displacement — kill ghost streaks when pinned / absV≈0 / stuck
    const prevFx = this._fxPrevPos || p;
    const movedFx = Math.hypot(p.x - prevFx.x, p.z - prevFx.z);
    this._fxPrevPos = { x: p.x, y: p.y, z: p.z };
    const reallyMoving = movedFx > 0.004 && spd > 0.35;
    this._fxStuck = reallyMoving ? 0 : Math.min(1, (this._fxStuck || 0) + dt * 3);

    // Speed lines — boost OR fast wall run, ONLY while actually translating
    const showLines = reallyMoving && this._fxStuck < 0.2
      && ((boosting && spd > 1.4) || (inWall && spd > 1.8));
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
        // Hard-clear when stuck / not moving — no frozen translucent bars
        const fade = (!reallyMoving || this._fxStuck > 0.15) ? 12 : 4;
        line.material.opacity = Math.max(0, line.material.opacity - fade * dt);
        if (line.material.opacity <= 0.02) {
          line.visible = false;
          line.material.opacity = 0;
        }
      }
    }

    if (reallyMoving && (boosting || this.car.driftTrail > 0.35) && spd > 1.2 && Math.random() < 0.35) {
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
    // Freeze / absV≈0: snuff bokeh dust immediately (no lingering orbs when pinned)
    if (!reallyMoving || this._fxStuck > 0.25) {
      for (const d of this._dust) {
        d.life = 0;
        d.mesh.visible = false;
        d.mesh.material.opacity = 0;
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
    const snap = this.tracks.querySnap(pos.x, pos.y, pos.z, 1.65, this.car.yaw);
    // Floor/outdoor ribbon magnets must aim at a wall-cleared point (stair stringers
    // often overlap authored skirting centerlines by a few cm).
    if (snap && snap.onTrack && snap.x != null && snap.z != null
        && (snap.kind === "floor" || snap.kind === "outdoor" || snap.kind === "flower")) {
      const cleared = this._clearPointFromWalls(snap.x, snap.z, pos.y);
      snap.x = cleared.x;
      snap.z = cleared.z;
    }

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
    // Guarantee: holding W on floor asphalt keeps cruise — but NOT while wall-pinned
    // (forcing 0.55 during a freeze made HUD read 17 km/h with zero translation).
    const movedFrame = Math.hypot(this.car.position.x - prevX, this.car.position.z - prevZ);
    if (driveKeys.forward && snap && snap.onTrack
        && (snap.kind === "floor" || snap.kind === "outdoor" || snap.kind === "flower")
        && !this.car.airborne && !this.car.crashed
        && movedFrame > 0.0015 && (this._frameWallHits || 0) < 2) {
      if (this.car.speed < 0.55) {
        this.car.speed = Math.min(this.car.maxSpeed, Math.max(this.car.speed, 0.55));
      }
    }
    this._updateStuckEscape(dt, driveKeys, snap, prevX, prevZ);
    this.car.idleTwitch(dt);
    this.tracks.updateVisuals(this._time);
    this._updateFx(dt, snap, flags);

    if (this.car.crashed && !this._crashPhase) {
      this._beginCrash();
    }

    const onElevDeck = !!(snap && (snap.elevated || snap.nearDeck || snap.kind === "cornice"
      || snap.kind === "balcony" || snap.kind === "ramp"));
    this._camElevated = THREE.MathUtils.lerp(this._camElevated, onElevDeck ? 1 : 0, Math.min(1, 3.2 * dt));
    this._snapCamera(false);

    const spdAbs = Math.abs(this.car.speed);
    const leisureCam = 1 - THREE.MathUtils.smoothstep(spdAbs, 0.15, 1.3);
    const elevCam = this._camElevated || 0;
    const spring = 10.5 + leisureCam * 3.5 - elevCam * 2.2; // softer follow on elevated decks
    const damp = 4.2 + leisureCam * 0.8 + elevCam * 0.9;
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

    if (this._fillLight && this._fillLight.visible) {
      const p = this.car.position;
      this._fillLight.position.set(p.x, p.y + 1.55, p.z);
    }

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
      // no instructional edge spam in Drive HUD
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
