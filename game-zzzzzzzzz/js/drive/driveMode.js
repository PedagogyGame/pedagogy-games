import * as THREE from "three";
import { RCCar, VEHICLE_PRESETS } from "./car.js?v=logic7";
import { TrackSystem } from "./tracks.js?v=logic7";
import { EngineAudio } from "./engineAudio.js?v=logic7";
import { CAR_SPAWN, SHORTCUT_TOAST_RE, RAMP_MOUNT_FEET } from "../data/tracks.js?v=logic7";

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
    this._voidEdge = 0;
    this._camElevated = 0; // smoothed elevated chase blend
    this._edgeHintCd = 0;
    this._baseFov = camera.fov || 60;
    this._driveFov = 70; // calmer tour FOV (was arcade-wide 74; logic7 68→70)
    this._wallFov = 54; // tighter echo-y FOV in walls
    this._leisureFov = 72; // logic7: was 62 — at rest the spawn read as a narrow corridor
    this._fov = this._baseFov;
    this._tunnelDark = 0;
    this._time = 0;
    this.onCheckpoint = null;
    this.onSpeed = null;
    this.onHint = null;
    this.onCrash = null;
    this.onHud = null;

    /** @type {null|{mode:string,t:number,duration:number,maxY:number,done:boolean,pass:boolean,foot:{x:number,y:number,z:number},logEl:HTMLElement|null,bannerEl:HTMLElement|null,logAcc:number,result:string}} */
    this._autodrive = null;
    /** Wall-clock anchor for autodrive catch-up (Chrome rAF throttle / dt clamp). */
    this._autoLastWall = 0;

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

    // SwiftShader: only TWO low-intensity Drive lights (fill + climb foot).
    // High-intensity moving PointLights + mid-climb third killed GPU while holding W.
    this._liteGpu = true;
    // logic4: fill 3.4→7.0 / range 14→16 (uniforms only; still the same two Drive lights)
    this._fillLight = new THREE.PointLight(0xffe8c8, 7.0, 16.0, 1.6);
    this._fillLight.name = "drive_fill";
    this._fillLight.visible = false;
    this._fillLight.castShadow = false;
    this._fillLight.position.set(CAR_SPAWN.x, CAR_SPAWN.y + 1.6, CAR_SPAWN.z);
    scene.add(this._fillLight);

    // Static fill at foyer climb left/foot — low intensity, does not move with car
    const climbFoot = (RAMP_MOUNT_FEET && RAMP_MOUNT_FEET.climb_a
      && RAMP_MOUNT_FEET.climb_a.foot)
      ? RAMP_MOUNT_FEET.climb_a.foot
      : { x: -5.05, y: 0.0, z: 11.75 };
    this._climbFill = new THREE.PointLight(0xffe0b8, 2.8, 12.0, 1.6);
    this._climbFill.name = "drive_climb_fill";
    this._climbFill.visible = false;
    this._climbFill.castShadow = false;
    // Bias slightly left/west of foot so the under-ramp corner reads
    this._climbFill.position.set(climbFoot.x - 0.85, climbFoot.y + 1.15, climbFoot.z - 0.35);
    scene.add(this._climbFill);

    // Allocated but NEVER enabled — third Drive PointLight = GPU death on move (sims still expect object)
    this._climbMidFill = new THREE.PointLight(0xffe0b8, 0, 0.1, 2);
    this._climbMidFill.name = "drive_climb_mid_fill";
    this._climbMidFill.visible = false;
    this._climbMidFill.castShadow = false;
    this._climbMidFill.position.set(-4.85, 2.15, 4.70);
    scene.add(this._climbMidFill);

    this._engineAudio = new EngineAudio();
    this._impactPulse = 0;

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
   * Pillars/columns/posts and structural walls stay HARD (no shrink, no raise).
   * Stair underside slabs raise above the *story* RC band so ramp-foot approach is not
   * pinned (foyer y≈0, landing y≈4.2, cellar y≈-4.2). Absolute 0.52 only fixed ground;
   * stringers stay (already inset inside stair footprint in mansion build).
   */
  _driveSoftCollider(box) {
    const out = box.clone();
    out.driveKind = box.driveKind || "wall";
    // Pillar / column / post — never soft-shrink or raise (car must bounce)
    if (out.driveKind === "pillar") return out;
    // Heuristic: tall skinny "furniture" posts that should have been pillars
    if (out.driveKind === "furniture") {
      const bw = out.max.x - out.min.x;
      const bd = out.max.z - out.min.z;
      const bh = out.max.y - out.min.y;
      const maxXZ = Math.max(bw, bd);
      const minXZ = Math.min(bw, bd);
      if (bh >= 1.2 && maxXZ <= 0.55 && minXZ <= 0.45) {
        out.driveKind = "pillar";
        return out;
      }
    }
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
    // Lite GPU: tiny BasicMaterial pools only. No MeshStandard dust/smash (lit every frame
    // by moving fill = SwiftShader death while holding W). Speed/dust/sparks capped off.
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false,
    });
    const lineN = this._liteGpu ? 0 : 14;
    for (let i = 0; i < lineN; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.22), lineMat.clone());
      line.visible = false;
      this._fxRoot.add(line);
      this._speedLines.push(line);
    }
    const dustMat = new THREE.MeshBasicMaterial({
      color: 0xd7ccc8, transparent: true, opacity: 0.0, depthWrite: false,
    });
    const dustN = this._liteGpu ? 0 : 10;
    for (let i = 0; i < dustN; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), dustMat.clone());
      d.visible = false;
      this._fxRoot.add(d);
      this._dust.push({ mesh: d, life: 0, vx: 0, vy: 0, vz: 0 });
    }
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffab40, transparent: true, opacity: 0, depthWrite: false,
    });
    const sparkN = this._liteGpu ? 0 : 16;
    for (let i = 0; i < sparkN; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.012, 4, 4), sparkMat.clone());
      s.visible = false;
      this._fxRoot.add(s);
      this._sparks.push({ mesh: s, life: 0, vx: 0, vy: 0, vz: 0 });
    }
    // Crash smash — Basic only, few bits
    const smashMat = new THREE.MeshBasicMaterial({
      color: 0xff5252, transparent: true, opacity: 0, depthWrite: false,
    });
    const smashN = this._liteGpu ? 6 : 18;
    for (let i = 0; i < smashN; i++) {
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
    // FROM_SCRATCH_HANDOFF: Explore must not see Drive asphalt / hear engine / keep Drive FOV
    this.active = false;
    this.car.setPose(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, CAR_SPAWN.yaw);
    this.car.speed = 0;
    this.car.root.visible = true;
    this.car.setLightsSubtle(true);
    // Explore: hide asphalt ribbons; keep subtle mouse-portal cues near tracks
    this.tracks.setVisible("explore");
    this._fxRoot.visible = false;
    if (this._fillLight) this._fillLight.visible = false;
    if (this._climbFill) this._climbFill.visible = false;
    if (this._climbMidFill) this._climbMidFill.visible = false;
    if (this._engineAudio) this._engineAudio.stop();
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
    try { this.car.setVehicle(this.vehicleId); } catch (err) {
      console.warn("[DriveMode] setVehicle failed", err);
    }
    this.car.root.visible = true;
    try { this.car.setLightsSubtle(false); } catch (_) {}
    // First Drive enter pays road mesh cost — Explore never does
    try { this.tracks.ensureMeshes(); } catch (err) {
      console.warn("[DriveMode] tracks.ensureMeshes failed", err);
    }
    try { this.tracks.setVisible(true); } catch (err) {
      console.warn("[DriveMode] tracks.setVisible failed", err);
    }
    this._fxRoot.visible = true;
    // Clear sticky path bias so spawn/re-enter is not glued to a prior climb spur
    // But do NOT wipe an in-flight ?autodrive=climb harness (double enter / mode toggle).
    const resumeAuto = !!(this._autodrive && !this._autodrive.done && (this._autodrive.mode === "climb" || this._autodrive.mode === "climb_b"));
    if (this.tracks && !resumeAuto) this.tracks._lastPathId = null;
    if (!resumeAuto) {
      // Face along open road (snap yaw + wall probe), never into foyer south wall
      const spawnYaw = this._pickOpenRoadYaw(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, CAR_SPAWN.yaw);
      this.car.setPose(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, spawnYaw);
      this.car.speed = 0;
      this.car.resetBoost();
      this.keys = { forward: false, back: false, left: false, right: false, boost: false };
    } else {
      this.keys.forward = true;
      this.keys.back = false;
      this.keys.boost = false;
      this._inputsFrozen = false;
      this._crashPhase = null;
    }
    this._baseFov = this.camera.fov || 60;
    this._fov = this._driveFov;
    this.camera.fov = this._driveFov;
    this.camera.updateProjectionMatrix();
    this._tunnelDark = 0;
    this._camVel.set(0, 0, 0);
    this._camPrevTarget = null;
    this._camLookSmooth = null;
    this._camYawS = null;
    this._crashPhase = null;
    this._crashTimer = 0;
    this._inputsFrozen = false;
    this._flash = 0;
    this._fade = 0;
    this._lastLabel = "";
    this._lastHint = "";
    this._edgeWarn = 0;
    this._edgeHintCd = 0;
    this._voidEdge = 0;
    this._lookSteer = 0;
    this._stuckTimer = 0;
    this._stuckNudgeCd = 0;
    this._jamHits = 0;
    if (this._fillLight) {
      this._fillLight.visible = true;
      this._fillLight.intensity = 7.0; // logic4 (was 3.4 — house read near-black at spawn)
      this._fillLight.distance = 16.0;
      this._fillLight.position.set(CAR_SPAWN.x, CAR_SPAWN.y + 1.6, CAR_SPAWN.z);
    }
    if (this._climbFill) {
      this._climbFill.visible = true;
      this._climbFill.intensity = 4.2; // logic4 (was 2.8)
      this._climbFill.distance = 12.0;
    }
    // climbMidFill intentionally never enabled (SwiftShader: 3rd Drive PointLight)
    // User gesture already happened (Enter/Drive click) — safe to resume AudioContext.
    // Never let audio failures kill the tab.
    try {
      if (this._engineAudio) this._engineAudio.start();
    } catch (err) {
      console.warn("[DriveMode] engineAudio.start failed", err);
      try { this._engineAudio?.stop?.(); } catch (_) {}
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
    this._clearAutodriveUI();
    this._autodrive = null;
    this._autoLastWall = 0;
    this.active = false;
    this.car.speed = 0;
    this.keys = { forward: false, back: false, left: false, right: false, boost: false };
    this.camera.fov = this._baseFov;
    this.camera.updateProjectionMatrix();
    if (this._fillLight) this._fillLight.visible = false;
    if (this._climbFill) this._climbFill.visible = false;
    if (this._climbMidFill) this._climbMidFill.visible = false;
    if (this._engineAudio) this._engineAudio.stop();
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
    this._camPrevTarget = null;
    this._camLookSmooth = null;
    this._camYawS = null;
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
    this._impactPulse = 0.2;
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
    // Leisure factor: slow sightseeing → mild push-out (kept close so car fills frame)
    const leisure = 1 - THREE.MathUtils.smoothstep(spd, 0.15, 1.35);
    // Look-into-turn (#1 strengthened) — yaw look-ahead blended with steer; stay close
    const steerIn = (this.car && this.car._steerInput != null) ? this.car._steerInput : 0;
    if (this._lookSteer == null) this._lookSteer = 0;
    // logic7: frame-rate independent (was lerp 0.24 per call = per sub-step)
    const lsDt = this._camDt || 1 / 60;
    this._lookSteer = immediate ? steerIn
      : THREE.MathUtils.lerp(this._lookSteer, steerIn, 1 - Math.exp(-16.5 * lsDt));
    const lookYaw = yaw + this._lookSteer * 0.55 * Math.min(1, spd / 0.75);
    // In-wall: tuck camera close + slightly above car so we never clip inside studs
    // Open road: closer chase — car fills frame (not a speck); still clears walls
    // logic7: a little higher + further at rest/leisure so the spawn reads as a room (was a
    // low "brown corridor" view); cruise framing nearly unchanged.
    const back = (inWall ? 0.15 : 0.21 + leisure * 0.13 + elev * 0.03) + Math.min(0.10, spd * 0.040);
    const up = (inWall ? 0.11 : 0.115 + leisure * 0.11 + elev * 0.028) + Math.min(0.045, spd * 0.014);
    this._camBack = back;
    this._camUp = up;
    this._camLookYaw = lookYaw;
    const cx = p.x - Math.sin(yaw) * back;
    const cy = p.y + up;
    const cz = p.z - Math.cos(yaw) * back;
    this._camPos.set(cx, cy, cz);

    // Look along tube / track — shorter ahead in walls keeps view readable
    const ahead = (inWall ? 0.26 : 0.22 + leisure * 0.10 + elev * 0.03) + Math.min(0.22, spd * 0.055);
    // Cap leisure push-out so look-into-turn never becomes a far sightseeing yank
    const aheadUse = Math.min(ahead, inWall ? 0.32 : 0.38);
    this._lookAhead.set(
      p.x + Math.sin(lookYaw) * aheadUse,
      p.y + (inWall ? 0.055 : 0.032 + leisure * 0.030 + elev * 0.012) + Math.min(0.022, spd * 0.005),
      p.z + Math.cos(lookYaw) * aheadUse
    );
    this._camTarget.copy(this._lookAhead);

    if (immediate) {
      this.camera.position.copy(this._camPos);
      this.camera.lookAt(this._camTarget);
      this._resetChaseSmoothing();
    }
    this._sanitizeCamera();
  }

  /** logic7: drop smoothed chase state so the next frame starts exactly on the framing. */
  _resetChaseSmoothing() {
    this._camYawS = null;
    this._camBackS = null;
    this._camUpS = null;
    this._camLift = 0;
    this._camLookOff = null;
    this._camLookSmooth = null;
  }

  /**
   * logic7: nominal chase framing (camera→car distance the rig is designed to hold) — used by
   * cam-framing-fps-sim. Excludes the sight-line lift over decks.
   */
  chaseNominalDistance() {
    return Math.hypot(this._camBack || 0, this._camUp || 0);
  }

  /** Recover from NaN/Inf camera (would black-screen / destabilize WebGL). */
  _sanitizeCamera() {
    const p = this.camera.position;
    const ok = Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)
      && Number.isFinite(this.camera.fov)
      && Number.isFinite(this._camVel.x) && Number.isFinite(this._camVel.y) && Number.isFinite(this._camVel.z);
    if (ok) return;
    console.warn("[DriveMode] non-finite camera — resetting to spawn chase");
    const y = Number.isFinite(CAR_SPAWN?.yaw) ? CAR_SPAWN.yaw : 0;
    p.set(CAR_SPAWN.x - Math.sin(y) * 0.35, CAR_SPAWN.y + 0.22, CAR_SPAWN.z - Math.cos(y) * 0.35);
    this._camPos.copy(p);
    this._camTarget.set(CAR_SPAWN.x, CAR_SPAWN.y + 0.06, CAR_SPAWN.z);
    this._camVel.set(0, 0, 0);
    this._camPrevTarget = null;
    this._camLookSmooth = null;
    this._camYawS = null;
    this.camera.fov = this._driveFov || 68;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this._camTarget);
  }

  /** Recover from NaN/Inf car pose (cascades into cam → WebGL death). */
  _sanitizeCar() {
    const c = this.car;
    if (!c) return;
    const p = c.position;
    const ok = Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)
      && Number.isFinite(c.yaw) && Number.isFinite(c.speed) && Number.isFinite(c.vy);
    if (ok) return;
    console.warn("[DriveMode] non-finite car — resetting to spawn");
    const yaw = Number.isFinite(CAR_SPAWN?.yaw) ? CAR_SPAWN.yaw : 0;
    c.setPose(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, yaw);
    c.speed = 0;
    c.vy = 0;
    this._camVel.set(0, 0, 0);
    this._camPrevTarget = null;
  }

  /**
   * Push an XZ point out of Drive wall/furniture AABBs (car radius pad).
   * Skirting centerlines sometimes clip stair stringers — magnets must aim clear.
   */
  _clearPointFromWalls(x, z, y, pad = 0.02) {
    const r = this._carRadius + pad;
    const y0 = y + 0.02; // logic3: tyres ride ON a wall top flush with the deck (4.2 vs 4.212)
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
      const y0 = y + 0.02; // logic3: tyres ride ON a wall top flush with the deck (4.2 vs 4.212)
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

  /** Foyer climb approach corridor — stair/furniture/junction walls must not pin. */
  _nearFoyerClimbCorridor(x, z) {
    // logic3 feet: tangent-continuous foot arcs off the S/F straight (z≈11.4)
    // Climb A foot sweep x∈[-6.45,-2.0], Climb B x∈[4.0,8.45], z∈[9.0,12.6]
    if (z >= 9.0 && z <= 12.6 && ((x >= -6.45 && x <= -2.0) || (x >= 4.0 && x <= 8.45))) return true;
    // Climb strips (holeA_climb / holeB_climb, end at z=10)
    if (x >= -6.45 && x <= -3.55 && z >= -2.25 && z <= 10.2) return true;
    if (x >= 5.55 && x <= 8.45 && z >= -2.25 && z <= 10.2) return true;
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
    const y0 = y + 0.02; // logic3: tyres ride ON a wall top flush with the deck (4.2 vs 4.212)
    const y1 = y + 0.12;
    // Climb corridor: pierce ONLY intentional soft volumes (stair underside /
    // furniture). NEVER pierce walls or pillars — freestanding posts stay solid.
    // Door/climb apertures are already cut in meshes; do not ghost thin pillars.
    const climbApproach = this._nearFoyerClimbCorridor(p.x, p.z);
    let cols = this._wallsNear(p.x, p.z, r + 0.35);
    if (climbApproach) {
      const climbRibbon = (kind === "ramp" || kind === "floor" || !kind
        || snap?.onTrack || snap?.nearDeck || snap?.rampContinuity);
      if (climbRibbon) {
        cols = cols.filter((b) => {
          const k = b.driveKind || "wall";
          // Soft only — walls + pillars always collide
          if (k === "stair" || k === "furniture") return false;
          return true;
        });
      } else {
        // Off-ribbon in climb band: keep hard solids (wall + pillar)
        cols = cols.filter((b) => {
          const k = b.driveKind || "wall";
          return k === "wall" || k === "pillar";
        });
      }
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
        const soft = box.driveKind === "furniture" || box.driveKind === "stair"; // pillar/wall = hard
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
        // Softer scrape on-ribbon — cruise stays smooth, less speed-kill jerk
        this.car._scrape = Math.min(1, (this.car._scrape || 0) + (soft ? 0.12 : (onRibbon ? 0.12 : 0.34)));

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
              ? (0.02 + headOn * 0.10)
              : (onRibbon ? (0.025 + headOn * 0.12) : (0.05 + headOn * 0.22));
            const signed = Math.sign(spd || 1);
            this.car.speed = signed * spd2 * (1 - Math.min(0.55, loss));
            if (onRibbon && headOn < 0.65) {
              const floor = Math.min(this.car.maxSpeed * 0.78, 0.95);
              const keep = headOn < 0.25 ? 0.82 : (headOn < 0.45 ? 0.68 : 0.58);
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
      ? this.tracks.findEscapeSnap(p.x, p.y, p.z, 2.4)
      : null;
    // Prefer SAME ribbon / continuous junction — never jump to a parallel track across the room
    const lastId = this.tracks._lastPathId;
    let target = null;
    if (snap && snap.onTrack && snap.x != null) target = snap;
    else if (escape && escape.onTrack && escape.x != null) {
      const jump = Math.hypot(escape.x - p.x, escape.z - p.z);
      const samePath = !lastId || escape.pathId === lastId;
      if (samePath && jump < 1.25) target = escape;
      else if (!samePath && jump < 0.55) target = escape; // tiny adjacent junction only
    }
    if (!target || target.x == null) {
      // Local forward nudge along current facing — no distant asphalt teleport
      const fx = Math.sin(this.car.yaw);
      const fz = Math.cos(this.car.yaw);
      const cleared = this._clearPointFromWalls(p.x + fx * 0.28, p.z + fz * 0.28, p.y, 0.04);
      p.x = cleared.x;
      p.z = cleared.z;
      this.car.speed = Math.max(0.55, Math.min(this.car.maxSpeed * 0.45, Math.abs(this.car.speed) + 0.35));
      this._stuckTimer = 0;
      this._jamHits = 0;
      this._stuckNudgeCd = 0.85;
      if (this.onHint) this.onHint("Unstuck — keep moving");
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
    // Soft nudge toward nearby centerline (cap step) then along road — never hard teleport
    const toX = target.x - p.x;
    const toZ = target.z - p.z;
    const toLen = Math.hypot(toX, toZ) || 1;
    const step = Math.min(0.32, toLen * 0.55);
    let nx = p.x + (toX / toLen) * step + Math.sin(yaw) * 0.18;
    let nz = p.z + (toZ / toLen) * step + Math.cos(yaw) * 0.18;
    const cleared = this._clearPointFromWalls(nx, nz, p.y, 0.04);
    p.x = cleared.x;
    p.z = cleared.z;
    if (target.y != null && Math.abs(target.y - p.y) < 0.45) {
      p.y = Math.max(p.y, Math.min(target.y, p.y + 0.08));
    }
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

    // Lite GPU: only tick smash bits (crash). No speed lines / dust / sparks while moving.
    if (this._liteGpu) {
      for (const b of this._smashBits) {
        if (b.life <= 0) { b.mesh.visible = false; continue; }
        b.life -= dt;
        b.mesh.position.x += b.vx * dt;
        b.mesh.position.y += b.vy * dt;
        b.mesh.position.z += b.vz * dt;
        b.vy -= 6 * dt;
        b.mesh.material.opacity = Math.max(0, b.life * 2);
      }
      return;
    }

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
    // ?autodrive=climb: catch up wall clock with fixed steps. Chrome background
    // tabs / long hitches clamp getDelta→0.05 and discard time, freezing maxY≈foot.
    if (this._autodrive && !this._autodrive.done && (this._autodrive.mode === "climb" || this._autodrive.mode === "climb_b")) {
      const now = (typeof performance !== "undefined" && performance.now)
        ? performance.now()
        : Date.now();
      if (!this._autoLastWall) this._autoLastWall = now;
      const wallDt = Math.max(0, (now - this._autoLastWall) / 1000);
      this._autoLastWall = now;
      // Cap high enough that rare Chrome rAF (bg tab ~1–5s) still keeps realtime climb
      let budget = Math.min(5.0, Math.max(wallDt, Number(dt) || 0));
      const step = 1 / 60;
      let guard = 0;
      while (budget > 1e-6 && guard++ < 300) {
        const s = Math.min(step, budget);
        this._updateFrame(s);
        budget -= s;
        if (this._autodrive?.done) break;
      }
      return;
    }
    // logic4: real-time manual drive on slow GPUs. main.js used to clamp every rAF to 0.05 s,
    // so at SwiftShader's ~2–6 fps game time ran 4–10× slower than the wall clock: holding W
    // for a few seconds only reached ~6 km/h. Now main passes real dt (≤1 s since logic5) and we
    // integrate it in ≤1/30 s sub-steps (identical to before for normal 60 fps frames).
    // logic5: accept up to 1 s (live box Chrome ran Drive at ~0.8 fps); still ≤1/30 s sub-steps.
    const d = Math.max(0, Math.min(Number(dt) || 0, 1.0));
    const n = Math.max(1, Math.ceil(d * 30 - 1e-6));
    for (let i = 0; i < n; i++) {
      this._updateFrame(d / n);
      if (!this.active) break;
    }
  }

  /** Single simulation frame (physics + cam + FX). */
  _updateFrame(dt) {
    if (!this.active) return;
    this._time += dt;
    if (this._autodrive && !this._autodrive.done) this._tickAutodriveClimb(dt);
    const adHold = this._autodrive && this._autodrive.done && this._autodrive.hold ? this._autodrive : null;
    if (adHold) {
      const k = this.keys || {};
      if (k.forward || k.back || k.left || k.right || k.boost) {
        adHold.hold = false; // player took over
      } else {
        // brake to a stop on the spot the result was measured (≈0.15u roll from cruise)
        this.car.speed *= Math.exp(-9 * dt);
        if (Math.abs(this.car.speed) < 0.01) this.car.speed = 0;
      }
    }


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
    this._sanitizeCar();
    this._resolveDriveWalls(prevX, prevZ, snap);
    // Guarantee: holding W on floor asphalt keeps cruise — but NOT while wall-pinned
    // (forcing 0.55 during a freeze made HUD read 17 km/h with zero translation).
    const movedFrame = Math.hypot(this.car.position.x - prevX, this.car.position.z - prevZ);
    if (driveKeys.forward && snap && snap.onTrack
        && (snap.kind === "floor" || snap.kind === "outdoor" || snap.kind === "flower")
        && !this.car.airborne && !this.car.crashed
        && movedFrame > 0.0015 && (this._frameWallHits || 0) < 2) {
      // logic3: ease UP toward the cruise floor (was an instant 0→0.55 snap = 0.49/frame jolt)
      if (this.car.speed < 0.55) {
        this.car.speed = Math.min(0.55, this.car.speed + 1.8 * dt);
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
    this._camElevated = THREE.MathUtils.lerp(this._camElevated, onElevDeck ? 1 : 0, 1 - Math.exp(-2.4 * dt));
    this._camDt = dt;
    this._snapCamera(false);

    // logic7 chase rig — CAR-RELATIVE and frame-rate independent.
    // Before: a world-space spring (k 9.2, damping 4.6 toward ZERO velocity) chased the target.
    // Its steady-state trail at cruise is v·damp/k ≈ 1.21·4.6/9.2 ≈ 0.6u on top of the 0.26u
    // framing, i.e. the camera sat ~0.86u back and the car shrank to a dot whenever it moved,
    // then "snapped back" when it stopped (read live as the car leaping ahead). Now only the
    // ORIENTATION and framing lengths are smoothed (exp(-k·dt), per ≤1/30 s sub-step); the rig
    // is anchored to the car, so cam→car distance is the same at 1, 5 and 60 fps and any speed.
    const pp = this.car.position;
    const ease = (k) => 1 - Math.exp(-k * dt);
    const wantYaw = this.car.yaw; // chase sits behind the car body; look-into-turn is in the aim
    if (this._camYawS == null || !Number.isFinite(this._camYawS)) this._camYawS = wantYaw;
    let dYaw = wantYaw - this._camYawS;
    while (dYaw > Math.PI) dYaw -= 2 * Math.PI;
    while (dYaw < -Math.PI) dYaw += 2 * Math.PI;
    this._camYawS += dYaw * ease(7.5 - (this._camElevated || 0) * 1.5);
    if (this._camBackS == null) this._camBackS = this._camBack;
    if (this._camUpS == null) this._camUpS = this._camUp;
    this._camBackS += (this._camBack - this._camBackS) * ease(7.0);
    this._camUpS += (this._camUp - this._camUpS) * ease(7.0);
    const camX = pp.x - Math.sin(this._camYawS) * this._camBackS;
    const camZ = pp.z - Math.cos(this._camYawS) * this._camBackS;
    let camY = pp.y + this._camUpS;
    // Never let the chase cam sink below the car's own deck height (ramp-body clip guard)
    let camFloor = pp.y + 0.06;
    // logic4: ...and never under the ribbon deck BEHIND the car. On the Climb B descent the
    // chase cam trails up a 29% grade; the guard samples the car→camera sight line so the ray to
    // the car clears the deck (and its under-fill keel) everywhere between them.
    if (this.tracks.surfaceYAt) {
      const pid = this.tracks._lastPathId;
      const aimY = pp.y + 0.06;
      for (const f of [0.3, 0.45, 0.6, 0.75, 0.9, 1.0]) {
        const sx = pp.x + (camX - pp.x) * f, sz = pp.z + (camZ - pp.z) * f;
        const ys = this.tracks.surfaceYAt(sx, sz, pp.y, pid);
        if (ys == null) continue;
        const need = f >= 1 ? ys + 0.14 : aimY + (ys + 0.06 - aimY) / f;
        camFloor = Math.max(camFloor, Math.min(pp.y + 0.9, need));
      }
    }
    // Lift rises immediately (never inside a deck) and relaxes smoothly (no pop when it clears)
    const wantLift = Math.max(0, camFloor - camY);
    this._camLift = wantLift >= (this._camLift || 0) ? wantLift
      : this._camLift + (wantLift - this._camLift) * ease(4.0);
    camY += this._camLift;
    this.camera.position.set(camX, camY, camZ);
    this._camVel.set(0, 0, 0);
    this._camPrevTarget = null;

    // Aim: car-relative look offset, low-passed (Y softer so grade creases don't tip the lens)
    const offX = this._camTarget.x - pp.x, offY = this._camTarget.y - pp.y, offZ = this._camTarget.z - pp.z;
    if (!this._camLookOff) this._camLookOff = new THREE.Vector3(offX, offY, offZ);
    this._camLookOff.x += (offX - this._camLookOff.x) * ease(6.5);
    this._camLookOff.z += (offZ - this._camLookOff.z) * ease(6.5);
    this._camLookOff.y += (offY - this._camLookOff.y) * ease(3.0);
    if (!this._camLookSmooth) this._camLookSmooth = new THREE.Vector3();
    this._camLookSmooth.set(pp.x + this._camLookOff.x, pp.y + this._camLookOff.y, pp.z + this._camLookOff.z);
    this.camera.lookAt(this._camLookSmooth);
    this._sanitizeCamera();

    const inDark =
      snap?.kind === "shortcut" || snap?.kind === "mouse" || snap?.kind === "shaft"
      || snap?.kind === "tunnel" || snap?.kind === "chute";
    this._tunnelDark = THREE.MathUtils.lerp(this._tunnelDark, inDark ? 1 : 0, 1 - Math.exp(-3.5 * dt));

    // Echo-y tighter FOV in walls; leisurely cruise uses calmer FOV; boost is a treat
    const leisureF = 1 - THREE.MathUtils.smoothstep(Math.abs(this.car.speed), 0.2, 1.4);
    let wantFov = THREE.MathUtils.lerp(this._driveFov, this._leisureFov, leisureF * 0.85);
    wantFov -= this._tunnelDark * (wantFov - this._wallFov);
    if (this.keys.boost && Math.abs(this.car.speed) > 1.5) wantFov += 2.8;
    // FOV tighten near balcony void lip (#7 strengthened; never a hard snap)
    wantFov -= (this._voidEdge || 0) * 4.6;
    this._fov = THREE.MathUtils.lerp(this._fov, wantFov, 1 - Math.exp(-2.8 * dt));
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

    // Fill follows car but only every other frame + short range (avoids full-scene
    // StandardMaterial re-light storms every tick on SwiftShader while holding W).
    if (this._fillLight && this._fillLight.visible) {
      this._fillFollowTick = (this._fillFollowTick || 0) + 1;
      if ((this._fillFollowTick & 1) === 0) {
        const p = this.car.position;
        if (Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) {
          this._fillLight.position.set(p.x, p.y + 1.55, p.z);
        }
      }
    }

    if (this._engineAudio && this.active) {
      const thr = (this.keys.forward ? 1 : 0) - (this.keys.back ? 1 : 0);
      const scrapeAmt = this.car.scrapeAmount || 0;
      const impact = this._impactPulse > 0;
      if (impact) this._impactPulse = Math.max(0, this._impactPulse - dt);
      this._engineAudio.update({
        speed: this.car.speed,
        maxSpeed: this.car.maxSpeed || 1.4,
        throttle: thr,
        boost: !!this.keys.boost || !!this.car.isBoosting,
        scrape: scrapeAmt,
        impact,
        grade: (snap && snap.grade != null) ? snap.grade : (this.car._smoothGrade || 0),
        steer: this.car._steerInput || 0,
        voidEdge: this._voidEdge || 0,
        carpet: !!(snap && snap.carpet && !snap.onTrack),
        braking: thr < -0.05 || (thr < 0.02 && Math.abs(this.car.speed) > 0.15),
      });
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


    // Void-edge warning — balcony inner lip: soft rumble + tiny FOV tighten; NEVER teleport
    this._edgeHintCd = Math.max(0, this._edgeHintCd - dt);
    let edgeAmt = 0;
    let voidEdge = 0;
    if (snap && snap.onTrack && typeof snap.edgeMargin === "number") {
      if (snap.elevated && snap.edgeMargin < 0.075) {
        edgeAmt = THREE.MathUtils.clamp(1 - snap.edgeMargin / 0.075, 0, 1);
      }
      // Balcony void lip (#7) — slightly earlier/stronger warning on the drop side
      if (snap.pathId === "balcony_arc" && snap.edgeMargin < 0.13) {
        // logic3: balcony_arc loops OUT onto the deck (x∈[-5.75,6.75], z≤17.5) and back;
        // the drop is on the OUTER side of the loop (balustrade / deck ends), south of the facade.
        const atriumX = 0.1, atriumZ = 14.6;
        const toAtrium = Math.hypot(pos.x - atriumX, pos.z - atriumZ);
        const ribbonToAtrium = Math.hypot((snap.x ?? pos.x) - atriumX, (snap.z ?? pos.z) - atriumZ);
        const onInner = pos.z > 14.0 && toAtrium >= ribbonToAtrium - 0.05; // (name kept: "void side")
        if (onInner) {
          voidEdge = THREE.MathUtils.clamp(1 - snap.edgeMargin / 0.13, 0, 1);
          edgeAmt = Math.max(edgeAmt, voidEdge * 0.92);
        }
      }
    }
    this._edgeWarn = THREE.MathUtils.lerp(this._edgeWarn, edgeAmt, Math.min(1, 6 * dt));
    this._voidEdge = THREE.MathUtils.lerp(this._voidEdge || 0, voidEdge, Math.min(1, 5 * dt));
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

  /**
   * Temporary URL-param live prove.
   * ?autodrive=climb / climb_a — hold W up Climb A from foyer spur.
   * ?autodrive=climb_b / climb=b — pose at Climb B foot on landing, hold W down to foyer.
   * Default Drive untouched when param absent.
   * @param {"a"|"b"|string} [which]
   */
  beginClimbAutodrive(which = "a") {
    if (typeof document === "undefined") return;
    const side = (String(which || "a").toLowerCase() === "b" || String(which).toLowerCase() === "climb_b")
      ? "b" : "a";

    let ax, ay, az, yaw, foot, latchPath, latchKind, mode, armMsg, aimFallback;
    // logic3: honest poses ON the circuit, upstream of each climb, facing authored travel.
    // The harness then follows the ribbon (snap.yaw is authored a→b — never flipped).
    if (side === "b") {
      foot = (RAMP_MOUNT_FEET && RAMP_MOUNT_FEET.climb_b && RAMP_MOUNT_FEET.climb_b.crest)
        ? RAMP_MOUNT_FEET.climb_b.crest
        : { x: 4.40, y: 4.20, z: 0.30 };
      ax = 4.40; ay = 4.212; az = 3.20; // balcony_to_climb_b, 2.9u before the apex U-turn
      yaw = Math.PI;                    // heading −Z (north) toward the apex
      latchPath = "balcony_to_climb_b";
      latchKind = "floor";
      mode = "climb_b";
      armMsg = "autodrive=climb_b armed… posing on balcony_to_climb_b before the Climb B apex";
      aimFallback = null;
    } else {
      foot = (RAMP_MOUNT_FEET && RAMP_MOUNT_FEET.climb_a && RAMP_MOUNT_FEET.climb_a.foot)
        ? RAMP_MOUNT_FEET.climb_a.foot
        : { x: -2.11, y: 0.0, z: 11.40 };
      ax = 0.05; ay = 0.012; az = 11.40; // start of foyer_to_climb_a runway
      yaw = -Math.PI / 2;                // heading −X (west) into the foot sweep
      latchPath = "foyer_to_climb_a";
      latchKind = "floor";
      mode = "climb";
      armMsg = "autodrive=climb armed… posing on the Climb A runway facing the foot";
      aimFallback = null;
    }

    this._clearAutodriveUI();
    this._autoLastWall = (typeof performance !== "undefined" && performance.now)
      ? performance.now()
      : Date.now();
    this._autodrive = {
      mode,
      side,
      t: 0,
      duration: side === "b" ? 30 : 32,
      maxY: ay,
      minY: ay,
      startY: ay,
      drop: 0,
      sawPath: false,
      done: false,
      pass: false,
      foot,
      aimFallback,
      logEl: null,
      bannerEl: null,
      logAcc: 0,
      result: "",
    };

    if (this.tracks) {
      this.tracks._lastPathId = latchPath;
      this.tracks._lastPathKind = latchKind;
    }
    this._crashPhase = null;
    this._crashTimer = 0;
    this._inputsFrozen = false;
    this._stuckTimer = 0;
    this._jamHits = 0;
    this._stuckNudgeCd = 0;
    this.car.setPose(ax, ay, az, yaw);
    this.car.speed = 0.45;
    this.car.crashed = false;
    this.car.airborne = false;
    this.car.vy = 0;
    if (typeof this.car.resetBoost === "function") this.car.resetBoost();
    this.keys = { forward: true, back: false, left: false, right: false, boost: false };
    this._snapCamera(true);

    // Visible log + inject minimal styles (query-param harness only)
    let style = document.getElementById("autodrive-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "autodrive-style";
      style.textContent = `
#autodrive-log{position:fixed;left:12px;bottom:12px;z-index:9999;max-width:min(92vw,420px);
  padding:10px 12px;border-radius:8px;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;
  color:#e8f0ff;background:rgba(8,12,24,.82);border:1px solid rgba(120,160,255,.35);
  white-space:pre-wrap;pointer-events:none}
#autodrive-banner{position:fixed;top:18%;left:50%;transform:translateX(-50%);z-index:10000;
  padding:14px 28px;border-radius:10px;font:700 22px/1.2 system-ui,sans-serif;
  letter-spacing:.04em;pointer-events:none;display:none;box-shadow:0 8px 32px rgba(0,0,0,.45)}
#autodrive-banner.pass{display:block;color:#04140a;background:#3dff8a;border:2px solid #b6ffd4}
#autodrive-banner.fail{display:block;color:#1a0505;background:#ff4d4d;border:2px solid #ffb0b0}
`;
      document.head.appendChild(style);
    }
    let log = document.getElementById("autodrive-log");
    if (!log) {
      log = document.createElement("div");
      log.id = "autodrive-log";
      document.body.appendChild(log);
    }
    log.textContent = armMsg;
    this._autodrive.logEl = log;

    let banner = document.getElementById("autodrive-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "autodrive-banner";
      document.body.appendChild(banner);
    }
    banner.className = "";
    banner.textContent = "";
    this._autodrive.bannerEl = banner;

    console.info("[autodrive] climb harness start", side, "@", { x: ax, y: ay, z: az, yaw: +yaw.toFixed(3) });
  }

  _clearAutodriveUI() {
    if (typeof document === "undefined") return;
    const log = document.getElementById("autodrive-log");
    if (log) log.remove();
    const banner = document.getElementById("autodrive-banner");
    if (banner) banner.remove();
  }

  _showAutodriveBanner(pass) {
    const ad = this._autodrive;
    if (!ad) return;
    const el = ad.bannerEl || (typeof document !== "undefined" ? document.getElementById("autodrive-banner") : null);
    if (!el) return;
    ad.bannerEl = el;
    const tag = ad.side === "b" ? "CLIMB B" : "CLIMB";
    if (pass) {
      el.textContent = `${tag} AUTO PASS`;
      el.className = "pass";
    } else {
      el.textContent = `${tag} AUTO FAIL`;
      el.className = "fail";
    }
  }

  /**
   * logic4: is the car actually ON SCREEN? Car centre inside the view frustum (with a margin)
   * AND the camera→car ray not blocked by any visible opaque mesh (decks, walls, slabs).
   * The autodrive PASS banners require this so a buried / occluded camera can't show green.
   * @returns {{ok:boolean,inFrustum:boolean,blocker:string|null,ndcX:number,ndcY:number}}
   */
  _carVisibleInFrame() {
    const cam = this.camera;
    const car = this.car;
    if (!this._visRay) {
      this._visRay = new THREE.Raycaster();
      this._visTgt = new THREE.Vector3();
      this._visDir = new THREE.Vector3();
      this._visCarSet = new Set();
    }
    this._visCarSet.clear();
    car.root.traverse((o) => this._visCarSet.add(o));
    // Harness-only: sync world matrices (headless sims never render; the car/tracks move)
    this.scene.updateMatrixWorld(true);
    cam.updateMatrixWorld(true);
    const tgt = this._visTgt.set(car.position.x, car.position.y + 0.06, car.position.z);
    const ndc = tgt.clone().project(cam);
    const inFrustum = ndc.z > -1 && ndc.z < 1 && Math.abs(ndc.x) <= 0.92 && Math.abs(ndc.y) <= 0.92;
    const dir = this._visDir.subVectors(tgt, cam.position);
    const dist = dir.length();
    let blocker = null;
    if (dist > 1e-4) {
      dir.multiplyScalar(1 / dist);
      const rc = this._visRay;
      rc.set(cam.position, dir);
      rc.near = 0;
      rc.far = Math.max(0, dist - 0.07);
      const visibleChain = (o) => {
        for (let q = o; q; q = q.parent) if (q.visible === false) return false;
        return true;
      };
      const hits = rc.intersectObjects(this.scene.children, true);
      for (const h of hits) {
        const o = h.object;
        if (!o.isMesh || this._visCarSet.has(o) || !visibleChain(o)) continue;
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (m && (m.visible === false || (m.transparent && (m.opacity ?? 1) < 0.5))) continue;
        blocker = `${o.name || o.parent?.name || o.type}@${h.distance.toFixed(2)}`;
        break;
      }
    }
    return { ok: inFrustum && !blocker, inFrustum, blocker, ndcX: ndc.x, ndcY: ndc.y };
  }

  /**
   * logic7: is there DRAWN asphalt directly under the car? Ray straight down from just above the
   * car against every visible mesh (car excluded); the FIRST surface hit must be a track road
   * surface (ribbon / spawn pad / end band / painted chevrons) within a few cm of the wheels.
   * The logic6 banner trusted snap.onTrack only — it can't see a missing/culled road mesh.
   * @returns {{ok:boolean, hit:string|null, gap:number|null}}
   */
  _asphaltUnderCar() {
    const car = this.car;
    if (!this._asRay) {
      this._asRay = new THREE.Raycaster();
      this._asDown = new THREE.Vector3(0, -1, 0);
      this._asOrigin = new THREE.Vector3();
      this._asCarSet = new Set();
    }
    this._asCarSet.clear();
    car.root.traverse((o) => this._asCarSet.add(o));
    this.scene.updateMatrixWorld(true);
    const p = car.position;
    const rc = this._asRay;
    rc.set(this._asOrigin.set(p.x, p.y + 0.3, p.z), this._asDown);
    rc.near = 0;
    rc.far = 0.6;
    const visibleChain = (o) => {
      for (let q = o; q; q = q.parent) if (q.visible === false) return false;
      return true;
    };
    const trackRoot = this.tracks && this.tracks.root;
    const inTracks = (o) => { for (let q = o; q; q = q.parent) if (q === trackRoot) return true; return false; };
    const ROAD = /^(ribbon_|spawn_clean_pad|spawn_apron_lane|climb_end_band|corner_chevrons|junction_flow_chevrons)/;
    const hits = rc.intersectObjects(this.scene.children, true);
    for (const h of hits) {
      const o = h.object;
      if (!o.isMesh || this._asCarSet.has(o) || !visibleChain(o)) continue;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m && (m.visible === false || (m.transparent && (m.opacity ?? 1) < 0.5))) continue;
      const gap = p.y - h.point.y;
      const road = !!trackRoot && inTracks(o) && ROAD.test(o.name || "");
      return { ok: road && Math.abs(gap) < 0.08, hit: o.name || o.parent?.name || o.type, gap };
    }
    return { ok: false, hit: null, gap: null };
  }

  _tickAutodriveClimb(dt) {
    const ad = this._autodrive;
    if (!ad || ad.done) return;
    if (ad.mode !== "climb" && ad.mode !== "climb_b") return;
    const isB = ad.mode === "climb_b" || ad.side === "b";

    const finish = (pass, result) => {
      ad.done = true;
      ad.pass = !!pass;
      ad.result = result;
      this._showAutodriveBanner(!!pass);
      if (ad.logEl) ad.logEl.textContent += `\n${ad.result}`;
      if (pass) console.info("[autodrive] PASS", result);
      else console.warn("[autodrive]", result);
      // logic7: HOLD at the result. logic6 kept W held after PASS with steering released, so
      // the car rolled straight off the crest/foot onto room floors and into walls (04a/04c).
      // Now every key is released and the car brakes to a stop where the result was measured;
      // any real key press (keys flip back to true) hands control to the player.
      ad.hold = true;
      ad.holdAt = { x: this.car.position.x, y: this.car.position.y, z: this.car.position.z };
      this.keys = { forward: false, back: false, left: false, right: false, boost: false };
    };

    if (this._inputsFrozen || this._crashPhase) {
      ad.t += dt;
      const py = this.car?.position?.y ?? 0;
      ad.maxY = Math.max(ad.maxY, py);
      ad.minY = Math.min(ad.minY ?? py, py);
      ad.drop = (ad.startY ?? ad.maxY) - ad.minY;
      if (ad.t >= ad.duration) {
        if (isB) {
          // logic3: never PASS from a crash/freeze (needs live on=1 frame)
          if (ad.drop < 1.0 || this.car?.crashed) finish(false, "CLIMB B AUTO FAIL");
          else finish(false, `CLIMB B AUTO TIMEOUT drop=${ad.drop.toFixed(2)} saw=${ad.sawPath ? 1 : 0}`);
        } else {
          // Never PASS from crash freeze — green+CRASH was the logic1 lie
          finish(false, `CLIMB AUTO FAIL (crash/freeze) maxY=${ad.maxY.toFixed(2)}`);
        }
      }
      return;
    }

    ad.t += dt;
    const p = this.car.position;
    ad.maxY = Math.max(ad.maxY, p.y);
    ad.minY = Math.min(ad.minY ?? p.y, p.y);
    ad.drop = (ad.startY ?? ad.maxY) - ad.minY;

    // Hold virtual forward every frame (do not rely on synthetic WASD events)
    this.keys.forward = true;
    this.keys.back = false;
    this.keys.boost = false;

    const snap = this.tracks.querySnap(p.x, p.y, p.z, 1.65, this.car.yaw);
    const pathId = (snap && snap.pathId) || this.tracks._lastPathId || "-";
    if (isB && pathId === "climb_b") ad.sawPath = true;
    if (!isB && pathId === "climb_a") ad.sawPath = true;

    // logic4: car-in-frame proof. Sample every 6th frame while on the climb, every frame once
    // the pass metric is reached; PASS needs ≥90% visible samples on the climb AND the last
    // 6 frames visible (camera→car ray clear + car inside the frustum).
    ad.visFrame = (ad.visFrame || 0) + 1;
    const nearPassMetric = isB ? ad.drop >= 3.6 : ad.maxY >= 3.9;
    if (ad.sawPath && (nearPassMetric || ad.visFrame % 6 === 0)) {
      const vis = this._carVisibleInFrame();
      const asph = this._asphaltUnderCar();
      ad.asphLast = asph;
      if (asph.ok) ad.asphStreak = (ad.asphStreak || 0) + 1;
      else { ad.asphStreak = 0; ad.asphLastMiss = asph.hit || "none"; }
      ad.visN = (ad.visN || 0) + 1;
      if (vis.ok) { ad.visOk = (ad.visOk || 0) + 1; ad.visStreak = (ad.visStreak || 0) + 1; }
      else { ad.visStreak = 0; ad.visLastBlock = vis.blocker || (vis.inFrustum ? "?" : "off-frame"); }
      ad.visLast = vis;
    }
    const visRatio = ad.visN ? (ad.visOk || 0) / ad.visN : 0;
    // logic7: PASS also needs drawn asphalt under the wheels for the last 6 samples
    const visOkNow = (ad.visStreak || 0) >= 6 && visRatio >= 0.9 && (ad.asphStreak || 0) >= 6;
    const visTag = `vis=${Math.round(visRatio * 100)}% asphalt=${ad.asphLast?.hit || "-"}`;

    let left = false;
    let right = false;
    // logic3: plain ribbon follow — authored snap.yaw + lateral error (a human holding the lane).
    // No aim-point flips, no hard-coded crest coordinates.
    let cmd = 0;
    if (snap && Number.isFinite(snap.yaw)) {
      let d = snap.yaw - this.car.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      cmd += d * 1.6;
      if (snap.x != null && snap.z != null) {
        const rx = -Math.cos(this.car.yaw), rz = Math.sin(this.car.yaw);
        const latErr = (snap.x - p.x) * rx + (snap.z - p.z) * rz; // + = ribbon centre to the right
        cmd -= latErr * 1.2;
      }
    }
    if (cmd > 0.04) left = true;
    else if (cmd < -0.04) right = true;
    this.keys.left = left;
    this.keys.right = right;

    ad.logAcc = (ad.logAcc || 0) + dt;
    if (ad.logAcc >= 0.25 || ad.t < 0.05) {
      ad.logAcc = 0;
      const kmh = this.car.getSpeedKmh ? this.car.getSpeedKmh() : Math.abs(this.car.speed) * 3.6;
      const snapY = (snap && snap.y != null && Number.isFinite(snap.y)) ? snap.y.toFixed(2) : "-";
      const onTrk = snap ? (snap.onTrack ? "1" : "0") : "-";
      const metric = isB
        ? `drop=${ad.drop.toFixed(2)} minY=${ad.minY.toFixed(2)}`
        : `maxY=${ad.maxY.toFixed(2)}`;
      const visNow = (ad.visLast ? (ad.visLast.ok ? "car=vis" : `car=HIDDEN(${ad.visLastBlock})`) : "car=-")
        + (ad.asphLast ? (ad.asphLast.ok ? " road=asphalt" : ` road=MISSING(${ad.asphLast.hit || "none"})`) : "");
      const line = `t=${ad.t.toFixed(1)}s y=${p.y.toFixed(2)} snap.y=${snapY} on=${onTrk} xz=${p.x.toFixed(2)},${p.z.toFixed(2)} spd=${Number(kmh).toFixed(0)} km/h path=${pathId} ${metric} ${visNow}`;
      console.log("[autodrive]", line);
      if (ad.logEl) ad.logEl.textContent = line + (ad.result ? `\n${ad.result}` : "");
    }

    if (isB) {
      // PASS on Y drop ≥2.5 with climb_b path seen (landing → foyer)
      const onB = !!(snap && snap.onTrack);
      // logic3: full descent to the foyer (drop ≥4.0 of 4.2), live on=1
      if (ad.drop >= 4.0 && ad.sawPath && onB && (pathId === "climb_b" || pathId === "foyer_finish") && !this._crashPhase && !this.car?.crashed && visOkNow) {
        finish(true, `CLIMB B AUTO PASS drop=${ad.drop.toFixed(2)} on=1 path=${pathId} ${visTag} car-in-frame`);
        return;
      }
      if (this._crashPhase || this.car?.crashed) {
        finish(false, `CLIMB B AUTO FAIL crash drop=${ad.drop.toFixed(2)}`);
        return;
      }
      if (ad.t >= ad.duration) {
        if (ad.drop < 1.0) finish(false, "CLIMB B AUTO FAIL");
        else finish(false, `CLIMB B AUTO TIMEOUT drop=${ad.drop.toFixed(2)} saw=${ad.sawPath ? 1 : 0} ${visTag} block=${ad.visLastBlock || "-"} (need drop≥4.0 + on=1 + path=climb_b + car in frame + asphalt under car)`);
      }
      return;
    }

    // Honest PASS: near crest height, still on ribbon, no crash overlay
    const onOk = !!(snap && snap.onTrack);
    const crestOk = ad.maxY >= 4.15; // logic3: full crest (tip flat is 4.2), not 3.8 mid-arc
    const pathOk = pathId === "climb_a" || pathId === "landing_hairpin";
    const noCrash = !this._crashPhase && !this.car?.crashed;
    if (crestOk && onOk && pathOk && noCrash && visOkNow) {
      finish(true, `CLIMB AUTO PASS maxY=${ad.maxY.toFixed(2)} on=1 path=${pathId} ${visTag} car-in-frame`);
      return;
    }
    if (this._crashPhase || this.car?.crashed) {
      finish(false, `CLIMB AUTO FAIL crash maxY=${ad.maxY.toFixed(2)} on=${onOk ? 1 : 0} xz=${p.x.toFixed(2)},${p.z.toFixed(2)}`);
      return;
    }

    if (ad.t >= ad.duration) {
      if (ad.maxY < 1.0) finish(false, "CLIMB AUTO FAIL");
      else {
        finish(false, `CLIMB AUTO TIMEOUT maxY=${ad.maxY.toFixed(2)} on=${onOk ? 1 : 0} path=${pathId} ${visTag} block=${ad.visLastBlock || "-"} (need maxY≥4.15 + on=1 + no crash + car in frame + asphalt under car)`);
      }
    }
  }

}
