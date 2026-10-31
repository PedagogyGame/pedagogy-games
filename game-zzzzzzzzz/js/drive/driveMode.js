import { loftSolids } from "./loftNet.js?v=logic21";
import * as THREE from "three";
import { RCCar, VEHICLE_PRESETS, CAR_K } from "./car.js?v=logic21";
import { TrackSystem } from "./tracks.js?v=logic21";
import { DriveWorld, railHit } from "./world.js?v=logic21";
import { EngineAudio } from "./engineAudio.js?v=logic21";
import { CAR_SPAWN, SHORTCUT_TOAST_RE, RAMP_MOUNT_FEET } from "../data/tracks.js?v=logic21";
import { LIFTS, CONVEYOR } from "../data/loftNet.js?v=logic21";
import { GhostBooks, makeFlames } from "./ghostBooks.js?v=logic21";
import { TreeCritters } from "./treehouse.js?v=logic21";
import { BOOKS_FOR_TURBO, BOOKS_FOR_SUPER } from "../data/ghostBooks.js?v=logic21";

/**
 * Drive-mode orchestrator: TRUE MANUAL RC + chase cam + crash/restart.
 * Explore: tiny parked car, tracks hidden. Drive: free steer, can fall.
 */
/** logic20: localStorage that never throws (private mode / sims / file://). */
function lsGet(k) { try { return globalThis.localStorage ? globalThis.localStorage.getItem(k) : null; } catch (_) { return null; } }
function lsSet(k, v) { try { if (globalThis.localStorage) globalThis.localStorage.setItem(k, v); } catch (_) {} }

export class DriveMode {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.active = false;
    this.tracks = new TrackSystem(scene);
    this.vehicleId = "car";
    this.car = new RCCar(this.vehicleId);
    this.scene.add(this.car.root);
    // logic15: ghost books, turbo tiers, muffler flames, opt-in mouse look
    this.books = new GhostBooks(scene);
    this.books.setVisible(false);
    this.car.turboLevel = this.books.turboLevel;
    this._flames = makeFlames();
    this.car.root.add(this._flames);
    this.flamesOn = true;
    this.mouseLook = { on: false, yaw: 0, pitch: 0, idle: 99 };
    this._onMouseMove = this._onMouseMove.bind(this);
    // logic20: mouse-look invert (I = vertical, Shift+I = horizontal) + MOUSE STEER (N), all saved
    this.mouseInvert = { y: lsGet("motu.mouseInvertY") === "1", x: lsGet("motu.mouseInvertX") === "1" };
    this.mouseSteer = { on: lsGet("motu.mouseSteer") === "1", raw: 0, out: 0, dead: 0.1, gain: 0.32, rate: 9, armed: false, lastX: null }; // logic21: armed only by real movement
    this._mouseListening = false;

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
    this._driveFov = 76; // logic11: driver-eye scale — wide so the rooms loom full-size
    this._camMode = "chase"; // "chase" | "bumper" (C key)
    void 0; // calmer tour FOV (was arcade-wide 74; logic7 68→70)
    this._wallFov = 66; // tighter echo-y FOV in walls
    this._leisureFov = 76; // logic7: was 62 — at rest the spawn read as a narrow corridor
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
    this._carRadius = 0.09 * CAR_K; // logic16: collider shrinks with the car
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
  /** logic8: the drivable house (floors with real holes + road surfaces + solids). */
  attachMansion(mansion) {
    this.mansion = mansion;
    this.world = new DriveWorld(mansion, this.tracks);
    if (mansion && mansion.getColliders) {
      // logic9: Skyline drop-side rails + barricades are hard solids too
      const ls = this.tracks._loftSolidsCache || (this.tracks._loftSolidsCache = loftSolids(this.tracks.segments));
      this.setWallColliders(mansion.getColliders().concat(ls.solids));
    }
  }

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
    // logic8: every solid is HARD in Drive — walls, pillars, furniture, stairs. No shrink,
    // no raised crawl gaps, no pierce rules. (Explore keeps its own copy.)
    const out = box.clone();
    out.driveKind = box.driveKind || "wall";
    if (box.rail && !globalThis.__NORAIL) out.rail = box.rail; // logic16: keep the exact rail segment (the AABB is only a broad-phase)
    if (box.conveyor) out.conveyor = true;
    if (box.gutter) out.gutter = true; if (box.timber) out.timber = true; if (box.lab) out.lab = true; // logic19 // logic14: conveyor cage (car-only; the camera sees through it)
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
    if (this.active && code === "KeyC" && e.type === "keydown" && !e.repeat) {
      this._camMode = this._camMode === "bumper" ? "chase" : "bumper"; // logic11: C = bumper / chase cam
      if (this.onHint) this.onHint(this._camMode === "bumper" ? "Bumper cam" : "Chase cam");
      return;
    }
    if (this.active && code === "KeyM" && e.type === "keydown" && !e.repeat) { this.setMouseLook(!this.mouseLook.on); return; }
    if (this.active && code === "KeyI" && e.type === "keydown" && !e.repeat) { if (e.shiftKey) this.setMouseInvert("x", !this.mouseInvert.x); else this.setMouseInvert("y", !this.mouseInvert.y); return; }
    if (this.active && code === "KeyN" && e.type === "keydown" && !e.repeat) { this.setMouseSteer(!this.mouseSteer.on); return; }
    if (this.active && code === "Space") { // logic15: Shift+Space = SUPER TURBO (12 books)
      if (e.cancelable) e.preventDefault();
      this.keys.superTurbo = e.type === "keydown";
      return;
    }
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

  _setHatch(closed) {
    const h = this.mansion && this.mansion.root && this.mansion.root.getObjectByName("attic_hatch");
    if (h) h.visible = closed;
  }

  /** logic15 MOUSE LOOK (opt-in, M / menu): mouse orbits the chase cam; eases back after ~1.5 s idle. */
  setMouseLook(on) {
    const ml = this.mouseLook; ml.on = !!on;
    if (!ml.on) { ml.yaw = 0; ml.pitch = 0; ml.idle = 99; }
    this._syncMouseListener();
    if (!ml.on) { const doc = typeof document !== "undefined" ? document : null; try { if (doc && doc.pointerLockElement) doc.exitPointerLock(); } catch (_) {} }
    if (this.onHint) this.onHint(ml.on ? (this.mouseSteer.on ? "Mouse look ON (M) — mouse steer has the mouse, camera follows behind" : "Mouse look ON (M) — move the mouse to look around · I invert") : "Mouse look off");
    this._syncBookHud();
  }
  /** logic20: flip a mouse-look axis ("y" vertical, "x" horizontal); saved in localStorage. */
  setMouseInvert(axis, on) {
    const k = axis === "x" ? "x" : "y"; this.mouseInvert[k] = !!on;
    lsSet(k === "x" ? "motu.mouseInvertX" : "motu.mouseInvertY", on ? "1" : "0");
    if (this.onHint) this.onHint(`Invert ${k === "x" ? "horizontal" : "vertical"} ${on ? "ON" : "off"} (${k === "x" ? "Shift+I" : "I"})`);
    this._syncBookHud();
  }
  /** logic20 MOUSE STEER (N): horizontal mouse position steers the car (dead zone + smoothing). Keys still work. */
  setMouseSteer(on) {
    const ms = this.mouseSteer; ms.on = !!on; ms.raw = 0; ms.out = 0; ms.armed = false; ms.lastX = null;
    lsSet("motu.mouseSteer", ms.on ? "1" : "0");
    if (this.keys) this.keys.steerAnalog = null;
    this._syncMouseListener();
    if (this.onHint) this.onHint(ms.on ? "Mouse steer ON (N) — mouse left/right of centre steers" + (this.mouseInvert.x ? " (inverted)" : "") : "Mouse steer off");
    this._syncBookHud();
  }
  _syncMouseListener() {
    const doc = typeof document !== "undefined" ? document : null; if (!doc || !doc.addEventListener) return;
    const want = this.active && (this.mouseLook.on || this.mouseSteer.on);
    // logic21: the wheel centres and DISARMS when the mouse leaves the window/canvas or the tab loses focus;
    // it re-arms only on a real movement (no twitch from a resting mouse or synthetic mousemove events)
    if (!this._onMouseOut) this._onMouseOut = (e) => { if (!e.relatedTarget || (e.relatedTarget.tagName && e.relatedTarget.tagName !== "CANVAS" && e.target && e.target.tagName === "CANVAS")) this._mouseSteerRelease(); };
    if (!this._onBlurSteer) this._onBlurSteer = () => this._mouseSteerRelease();
    const win = typeof window !== "undefined" && window.addEventListener ? window : null;
    if (want && !this._mouseListening) { doc.addEventListener("mousemove", this._onMouseMove, true); doc.addEventListener("mouseout", this._onMouseOut, true); if (win) win.addEventListener("blur", this._onBlurSteer); this._mouseListening = true; }
    if (!want && this._mouseListening) { doc.removeEventListener("mousemove", this._onMouseMove, true); doc.removeEventListener("mouseout", this._onMouseOut, true); if (win) win.removeEventListener("blur", this._onBlurSteer); this._mouseListening = false; }
    if (!want) this._mouseSteerRelease();
  }
  _mouseSteerRelease() { const ms = this.mouseSteer; ms.raw = 0; ms.armed = false; ms.lastX = null; }
  _onMouseMove(e) {
    if (this.mouseSteer.on) { // steer owns the mouse; the chase cam simply follows behind
      const ms = this.mouseSteer, w = (typeof window !== "undefined" && window.innerWidth) || 1280;
      const locked = typeof document !== "undefined" && document.pointerLockElement;
      if (!locked && e.target && e.target.tagName && e.target.tagName !== "CANVAS") { this._mouseSteerRelease(); return; } // over HUD buttons → no steer
      if (!locked && typeof e.clientX === "number") {
        if (ms.lastX != null && Math.abs(e.clientX - ms.lastX) < 1 && !e.movementX) return; // synthetic / zero-move event
        const first = ms.lastX == null; ms.lastX = e.clientX;
        if (first && !e.movementX) return; // need a REAL move before the wheel arms
        ms.armed = true; this.steerFromMouse((e.clientX - w / 2) / (w / 2));
      } else if (e.movementX) { ms.armed = true; this.steerFromMouse(ms.raw + e.movementX / (w / 2)); }
      return;
    }
    this.orbitLook(e.movementX || 0, e.movementY || 0);
  }
  /** logic20: horizontal mouse offset nx (−1 = left edge … +1 = right edge, 0 = centre) → steer target. */
  steerFromMouse(nx) { this.mouseSteer.armed = true; this.mouseSteer.raw = Math.max(-1, Math.min(1, Number(nx) || 0)); }
  /** logic20: raw mouse offset → analog wheel (+ = left, like the A key): dead zone, gain, invert. */
  mouseSteerTarget(raw = this.mouseSteer.raw) {
    const ms = this.mouseSteer, a = Math.abs(raw);
    if (a <= ms.dead) return 0;
    const v = Math.min(1, (a - ms.dead) / Math.max(0.05, ms.gain)) * Math.sign(raw); // full lock at dead+gain of the half-screen
    return (this.mouseInvert.x ? 1 : -1) * Math.max(-1, Math.min(1, v)); // mouse right of centre = steer right
  }
  _tickMouseSteer(dt) {
    const ms = this.mouseSteer;
    if (!ms.on) { if (this.keys && this.keys.steerAnalog != null) this.keys.steerAnalog = null; return; }
    ms.out += ((ms.armed ? this.mouseSteerTarget() : 0) - ms.out) * Math.min(1, ms.rate * dt); // smoothing (disarmed → centre)
    if (Math.abs(ms.out) < 1e-3) ms.out = 0;
    this.keys.steerAnalog = ms.out;
  }
  /** Orbit by a mouse delta in pixels (also used by sims / ?shot). */
  orbitLook(dx, dy) {
    const ml = this.mouseLook; if (!ml.on || !this.active || this.mouseSteer.on) return;
    if (this.mouseInvert.x) dx = -dx;
    if (this.mouseInvert.y) dy = -dy;
    ml.yaw -= dx * 0.005;
    while (ml.yaw > Math.PI) ml.yaw -= 2 * Math.PI; while (ml.yaw < -Math.PI) ml.yaw += 2 * Math.PI;
    ml.pitch = Math.max(-0.25, Math.min(0.75, ml.pitch + dy * 0.004));
    if (dx || dy) ml.idle = 0;
  }
  setFlames(on) { this.flamesOn = !!on; this._syncBookHud(); }
  resetBooks() { this.books.reset(); this.car.turboLevel = this.books.turboLevel; this._syncBookHud(); if (this.onHud) this.onHud({ mode: "toast", text: "Ghost Books reset" }); }
  _tickBooks(dt) {
    // logic16 treehouse critters: per-zone pass counters (squirrel every 4th, nest every 9th)
    if (!this.critters && this.tracks && this.tracks.yard) {
      this.critters = new TreeCritters(this.tracks.yard);
      try { const q = typeof location !== "undefined" ? new URLSearchParams(location.search) : null; if (q && q.get("critters") === "1") this.critters.force = true; } catch (_) {}
    }
    if (this.critters) {
      if (globalThis.__MOTU_CRITTERS__ != null) this.critters.force = !!globalThis.__MOTU_CRITTERS__;
      const c = this.critters.tick(dt, this.car.position);
      if (c && this.onHud) this.onHud({ mode: "toast", text: c === "squirrel" ? `A squirrel! (pass ${this.critters.counts.squirrel})` : `Baby birds! (pass ${this.critters.counts.nest})` });
    }
    const b = this.books.touch(this.car.position);
    if (b) {
      const n = this.books.count;
      const extra = n === BOOKS_FOR_TURBO ? " — TURBO unlocked! Hold Shift" : n === BOOKS_FOR_SUPER ? " — FLAMES + SUPER TURBO! Shift+Space" : "";
      if (this.onHud) this.onHud({ mode: "toast", text: `Ghost Book! ${n}/${this.books.total}${extra}` });
      this.car.turboLevel = this.books.turboLevel;
      this._syncBookHud();
    }
    this.car.turboLevel = this.books.turboLevel;
    // muffler flames: idle flicker at 12 books, roaring while turbo is held
    const fl = this._flames, show = this.flamesOn && this.books.turboLevel >= 2;
    fl.visible = show;
    if (show) {
      const m = this.car.turboMul || 1, roar = m > 1.3 ? 1.6 : m > 1.05 ? 1.2 : 0.55;
      const f = roar * (0.85 + 0.3 * Math.random());
      for (const c of fl.children) c.scale.set(1, f, 1);
    }
    this.flamesVisible = show;
  }
  _syncBookHud() {
    const doc = typeof document !== "undefined" ? document : null; if (!doc || !doc.getElementById) return;
    let el = doc.getElementById("ghost-hud");
    if (!el) {
      const host = doc.getElementById("drive-hud"); if (!host) return;
      el = doc.createElement("div"); el.id = "ghost-hud";
      el.innerHTML = '<div id="ghost-count">Ghost Books 0/12</div>'
        + '<div id="turbo-btns"><button type="button" id="btn-turbo" class="turbo-btn">TURBO</button><button type="button" id="btn-super" class="turbo-btn super">SUPER TURBO</button></div>'
        + '<div id="ghost-menu"><button type="button" id="btn-mouselook">Mouse look: off (M)</button><button type="button" id="btn-invert-y">Invert Y: off (I)</button><button type="button" id="btn-invert-x">Invert X: off (Shift+I)</button><button type="button" id="btn-mousesteer">Mouse steer: off (N)</button><button type="button" id="btn-flames">Flames: on</button><button type="button" id="btn-books-reset">Reset ghost books</button></div>';
      host.appendChild(el);
      const hold = (id, sup) => {
        const b = doc.getElementById(id);
        const on = (e) => { e.preventDefault(); this.keys.boost = true; if (sup) this.keys.superTurbo = true; b.classList.add("held"); };
        const off = () => { this.keys.boost = false; this.keys.superTurbo = false; b.classList.remove("held"); };
        b.addEventListener("pointerdown", on); for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, off);
      };
      hold("btn-turbo", false); hold("btn-super", true);
      doc.getElementById("btn-mouselook").addEventListener("click", () => this.setMouseLook(!this.mouseLook.on));
      doc.getElementById("btn-invert-y").addEventListener("click", () => this.setMouseInvert("y", !this.mouseInvert.y));
      doc.getElementById("btn-invert-x").addEventListener("click", () => this.setMouseInvert("x", !this.mouseInvert.x));
      doc.getElementById("btn-mousesteer").addEventListener("click", () => this.setMouseSteer(!this.mouseSteer.on));
      doc.getElementById("btn-flames").addEventListener("click", () => this.setFlames(!this.flamesOn));
      doc.getElementById("btn-books-reset").addEventListener("click", () => { if (!window.confirm || window.confirm("Reset all ghost books?")) this.resetBooks(); });
    }
    const lv = this.books.turboLevel;
    doc.getElementById("ghost-count").textContent = `Ghost Books ${this.books.count}/${this.books.total}`;
    doc.getElementById("btn-turbo").style.display = lv >= 1 ? "" : "none";
    doc.getElementById("btn-super").style.display = lv >= 2 ? "" : "none";
    doc.getElementById("btn-flames").style.display = lv >= 2 ? "" : "none";
    doc.getElementById("btn-flames").textContent = "Flames: " + (this.flamesOn ? "on" : "off");
    doc.getElementById("btn-mouselook").textContent = "Mouse look: " + (this.mouseLook.on ? "ON" : "off") + " (M)";
    doc.getElementById("btn-mouselook").classList.toggle("on", this.mouseLook.on);
    // logic20: invert toggles appear once mouse look is on (horizontal invert also matters for mouse steer)
    const iy = doc.getElementById("btn-invert-y"), ix = doc.getElementById("btn-invert-x"), st = doc.getElementById("btn-mousesteer");
    // logic21 (Ben t184u "the inverted option didn't show up"): both invert pills are ALWAYS shown; dimmed
    // (still clickable — the choice is saved) while the mouse mode they affect is off, with a tooltip.
    if (iy) { iy.style.display = ""; iy.textContent = "Invert Y: " + (this.mouseInvert.y ? "ON" : "off") + " (I)"; iy.classList.toggle("on", this.mouseInvert.y); iy.classList.toggle("dim", !this.mouseLook.on);
      iy.title = "Invert vertical mouse look (up/down)" + (this.mouseLook.on ? "" : " — applies when Mouse look is ON (M)"); }
    if (ix) { const live = this.mouseLook.on || this.mouseSteer.on; ix.style.display = ""; ix.textContent = "Invert X: " + (this.mouseInvert.x ? "ON" : "off") + " (Shift+I)"; ix.classList.toggle("on", this.mouseInvert.x); ix.classList.toggle("dim", !live);
      ix.title = "Invert horizontal mouse look and mouse steer" + (live ? "" : " — applies when Mouse look (M) or Mouse steer (N) is ON"); }
    if (st) { st.textContent = "Mouse steer: " + (this.mouseSteer.on ? "ON" : "off") + " (N)"; st.classList.toggle("on", this.mouseSteer.on); }
  }

  enter() {
    this.books.setVisible(true);
    try { this._syncBookHud(); } catch (_) {}
    this._setHatch(false); // logic12: attic hatch lid opens for the driver's lift shaft
    this.active = true;
    this._mouseSteerRelease(); this._syncMouseListener(); // logic20: saved mouse-steer preference re-listens on entry (logic21: wheel stays centred until the mouse moves)
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
    this.books.setVisible(false);
    if (this.mouseLook.on) this.setMouseLook(false);
    this.active = false; this._syncMouseListener(); // logic20: mouse steer listener off outside Drive
    if (this.keys) this.keys.steerAnalog = null;
    this._setHatch(true);
    this._clearAutodriveUI();
    this._autodrive = null;
    this._autoLastWall = 0;
    this.active = false;
    this.car.speed = 0;
    this.keys = { forward: false, back: false, left: false, right: false, boost: false };
    this.camera.fov = this._baseFov;
    this.camera.near = 0.08; this.camera.far = 240; this.camera.updateProjectionMatrix(); // logic11: Explore camera exactly as before
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
    const hi = inWall ? 0 : (this._camHigh || 0);
    // logic11 DRIVER-EYE SCALE: the camera rides just above/behind the 3 cm car (≈ a toy driver's
    // eye), not at human standing height — furniture and rooms loom full-size.
    const bumper = this._camMode === "bumper";
    const back = bumper ? -0.045 : (inWall ? 0.10 : 0.125 + leisure * 0.03 + elev * 0.01) + Math.min(0.05, spd * 0.02) + hi * 0.12;
    const up = bumper ? 0.024 : (inWall ? 0.042 : 0.046 + leisure * 0.012 + elev * 0.008) + Math.min(0.012, spd * 0.004) + hi * 0.17;
    this._camBack = back * CAR_K; // logic16: rig scales with the car → same framing
    this._camUp = up * CAR_K;
    this._camLookYaw = lookYaw;
    const cx = p.x - Math.sin(yaw) * back * CAR_K;
    const cy = p.y + up * CAR_K;
    const cz = p.z - Math.cos(yaw) * back * CAR_K;
    this._camPos.set(cx, cy, cz);

    // Look along tube / track — shorter ahead in walls keeps view readable
    const ahead = (inWall ? 0.5 : 0.55 + leisure * 0.15) + Math.min(0.3, spd * 0.08);
    const aheadUse = bumper ? 1.2 : ahead + hi * 0.25;
    this._lookAhead.set(
      p.x + Math.sin(bumper ? yaw : lookYaw) * aheadUse,
      p.y + ((bumper ? 0.022 : (inWall ? 0.035 : 0.038 + leisure * 0.01)) - hi * 0.3) * CAR_K,
      p.z + Math.cos(bumper ? yaw : lookYaw) * aheadUse
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
    this._camOccK = 1;
    this._camSolK = null; this._camBaseY = null;
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
  /** logic8: first hit (0..1) of segment a→b against nearby solid boxes, or 1 if clear. */
  _segSolidHit(ax, ay, az, bx, by, bz, pad = 0.03) {
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    const len = Math.hypot(bx - ax, bz - az);
    const boxes = this._wallsNear ? this._wallsNear(cx, cz, len / 2 + 0.4) : [];
    const d = [bx - ax, by - ay, bz - az], o = [ax, ay, az];
    let best = 1;
    for (const b of boxes) {
      if (b.conveyor) continue; // logic14: the open conveyor cage never pulls the camera in
      const mn = [b.min.x - pad, b.min.y - pad, b.min.z - pad], mx = [b.max.x + pad, b.max.y + pad, b.max.z + pad];
      let t0 = 0, t1 = best, ok = true;
      for (let k = 0; k < 3 && ok; k++) {
        if (Math.abs(d[k]) < 1e-9) { if (o[k] < mn[k] || o[k] > mx[k]) ok = false; continue; }
        let ta = (mn[k] - o[k]) / d[k], tb = (mx[k] - o[k]) / d[k];
        if (ta > tb) { const t = ta; ta = tb; tb = t; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) ok = false;
      }
      if (ok && t0 < best) best = t0;
    }
    return best;
  }

  _camClearOfSolids(pp, camX, camY, camZ) {
    const minUp = 0.1; // camera always above the car roof line
    camY = Math.max(camY, pp.y + minUp);
    const ax = pp.x, ay = pp.y + 0.07, az = pp.z; // aim point = car body centre
    let t = this._segSolidHit(ax, ay, az, camX, camY, camZ);
    // Blocked: first try lifting the camera (look down over low furniture/walls) before pulling in
    if (t < 1) {
      for (const lift of [0.15, 0.3, 0.45]) {
        const t2 = this._segSolidHit(ax, ay, az, camX, camY + lift, camZ);
        if (t2 >= 1) { t = 1; camY += lift; break; }
      }
    }
    if (t < 1) {
      const dist = Math.hypot(camX - ax, camY - ay, camZ - az) || 1;
      const k = Math.max(0.12 / dist, t - 0.04 / dist);
      camX = ax + (camX - ax) * k; camY = Math.max(pp.y + minUp, ay + (camY - ay) * k); camZ = az + (camZ - az) * k;
    }
    this._camSolidPull = t < 1 ? 1 - t : 0;
    return { x: camX, y: camY, z: camZ };
  }

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
        if (box.rail) { // logic16: only a real rail contact needs clearing; a shallow graze is pushed straight off the segment
          const R = box.rail; if (!railHit(R, px, pz, y0, y1, r)) continue;
          const ax = R.x1 - R.x0, az = R.z1 - R.z0, L2 = ax * ax + az * az || 1e-9;
          const u = Math.max(0, Math.min(1, ((px - R.x0) * ax + (pz - R.z0) * az) / L2));
          const cx = R.x0 + ax * u, cz = R.z0 + az * u, nx = px - cx, nz = pz - cz, nl = Math.hypot(nx, nz);
          if (nl > 1e-6 && r + R.t - nl < 0.03) { const k = (r + R.t + 0.004) / nl; px = cx + nx * k; pz = cz + nz * k; moved = true; continue; }
        }
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
    const base = fallback;
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

  /**
   * logic8: stuck / void recovery. The ONLY time the car is moved by anything but its own
   * wheels: it fell out of the world, or W has been held for 2.5 s with the car not moving
   * (wedged). Then it respawns, stopped, on the nearest road. No nudges, no pulls.
   */
  _updateStuckRespawn(dt, keys, prevX, prevZ, flags) {
    if ((flags && flags.lift) || this._onFlap >= 0) { this._stuckTimer = 0; return; } // logic11 lift / logic14 conveyor ride
    const p = this.car.position;
    if (flags && flags.void) { this._respawnNearestRoad("Hopped back on"); return; }
    if (this.car.airborne) { this._stuckTimer = 0; return; }
    const moved = Math.hypot(p.x - prevX, p.z - prevZ);
    const pushing = !!(keys && (keys.forward || keys.back));
    if (pushing && moved < 0.0015 * Math.max(1, dt * 60)) this._stuckTimer = (this._stuckTimer || 0) + dt;
    else this._stuckTimer = 0;
    if (this._stuckTimer > 2.5) this._respawnNearestRoad("Stuck — hopped back on");
  }

  _respawnNearestRoad(hint) {
    const p = this.car.position;
    const w = this.world;
    const road = w ? w.nearestRoad(p.x, Math.max(p.y, -0.2), p.z) : null;
    if (!road) { this._respawnAtStart(); return; }
    // face along the road, in the direction closest to the old heading
    let yaw = road.yaw;
    let d = yaw - this.car.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) > Math.PI / 2) yaw += Math.PI;
    this.car.setPose(road.x, road.y, road.z, yaw);
    this.car.speed = 0;
    this._stuckTimer = 0;
    this._respawns = (this._respawns || 0) + 1;
    this._resetChaseSmoothing();
    this._snapCamera(true);
    if (hint && this.onHint) this.onHint(hint);
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
    // logic11: FIXED-TIMESTEP physics + render interpolation (see POLISH-LOGIC11.md)
    const root = this.car.root, cam = this.camera;
    // logic21: undo LAST frame's interpolation (car AND camera) before stepping physics. logic11 only
    // interpolated on frames that ran a physics step and never restored the camera, so at 120/144 Hz
    // (ProMotion, gaming monitors) the shown car and the chase camera advanced on ALTERNATE frames —
    // the "car glitches slightly as I go forward" shimmer — and the camera smoothing integrated its own
    // render offset. Now every rendered frame shows lerp(prevPhys, curPhys, acc/step) for both.
    if (this._physPos && this._interpShown && this._shownPos && root.position.distanceToSquared(this._shownPos) < 1e-12) {
      root.position.copy(this._physPos); root.rotation.y = this._physYaw; this.car.yaw = this._physYaw;
      if (cam && this._camPhys && this._camShown && cam.position.distanceToSquared(this._camShown) < 1e-12) cam.position.copy(this._camPhys);
    }
    this._interpShown = false;
    let d = Math.max(0, Math.min(Number(dt) || 0, 1.0));
    this._dtAvg = this._dtAvg ? this._dtAvg + (Math.min(d, 0.5) - this._dtAvg) * 0.1 : Math.min(d, 0.1);
    if (d > 0.1 && d > 4 * this._dtAvg) d = Math.min(d, 2 * this._dtAvg + 1 / 60); // hitch clamp
    const step = this._dtAvg > 0.045 ? 1 / 30 : 1 / 60;
    if (this._physStep !== step) { this._physStep = step; this._physPrev = null; }
    this._acc = Math.min((this._acc || 0) + d, step * 40);
    const prev = this._prevPhys || (this._prevPhys = new THREE.Vector3());
    const cur = this._physPos || (this._physPos = new THREE.Vector3());
    // the pose was changed outside update() (teleport / setPose / reset) → no stale interpolation
    if (!this._physPrev || root.position.distanceToSquared(cur) > 1e-12) {
      cur.copy(root.position); this._physYaw = this.car.yaw;
      prev.copy(cur); this._prevPhysYaw = this.car.yaw; this._physPrev = prev;
    }
    let stepped = 0;
    while (this._acc >= step && stepped < 40) {
      prev.copy(root.position); this._prevPhysYaw = this.car.yaw;
      this._updateFrame(step);
      this._acc -= step; stepped++;
      if (!this.active) break;
    }
    this._fixedSteps = (this._fixedSteps || 0) + stepped;
    if (stepped) {
      cur.copy(root.position); this._physYaw = this.car.yaw;
      if (cam) (this._camPhys || (this._camPhys = new THREE.Vector3())).copy(cam.position);
    }
    if (this.active && this._camPhys && prev.distanceToSquared(cur) < 0.25 && prev.distanceToSquared(cur) > 0) {
      const alpha = Math.max(0, Math.min(1, this._acc / step));
      const ix = prev.x + (cur.x - prev.x) * alpha, iy = prev.y + (cur.y - prev.y) * alpha, iz = prev.z + (cur.z - prev.z) * alpha;
      let dy = this._physYaw - this._prevPhysYaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      if (cam && cam.position.distanceToSquared(this._camPhys) < 1e-12) {
        cam.position.set(this._camPhys.x + ix - cur.x, this._camPhys.y + iy - cur.y, this._camPhys.z + iz - cur.z);
        (this._camShown || (this._camShown = new THREE.Vector3())).copy(cam.position);
      }
      root.position.set(ix, iy, iz); root.rotation.y = this._prevPhysYaw + dy * alpha;
      this._interpShown = true; (this._shownPos || (this._shownPos = new THREE.Vector3())).copy(root.position);
      if (this.tracks._conveyor && this.world && this.world.conveyor) this.tracks._conveyor.update(this.world.conveyor.t - (1 - alpha) * step); // logic14: flaps interpolated like the car
    }
  }

  /** Single simulation frame (physics + cam + FX). */
  /**
   * logic11 CHANDELIER LIFT — a continuous elevator in the hidden shaft above the chandelier.
   * Pull onto the pad at the top of the spiral (or onto the attic pad) and the car is carried
   * smoothly (cosine ease, no teleport) to the other end, centred and turned to face out, then
   * released rolling gently onto the attic road (up) or back down the spoke (down). Re-arms only
   * after the car has left both pads. Returns frame flags while riding, else null.
   */
  _tickLift(dt) {
    const car = this.car, p = car.position;
    const onPad = (C, y) => Math.hypot(p.x - C.pad.x, p.z - C.pad.z) < C.padR && Math.abs(p.y - (y + 0.012)) < 0.06 && !car.airborne;
    let L = this._lift;
    let C = L ? L.C : null;
    if (!L) {
      // logic13: several lifts (chandelier shaft, roof shaft) — same ride, own pads/headings
      let atBot = false, atTop = false;
      for (const c of LIFTS) { if (c.conveyor) continue; atBot = onPad(c, c.padY); atTop = onPad(c, c.topY); if (atBot || atTop) { C = c; break; } }
      if (!atBot && !atTop) { this._liftArmed = true; return null; }
      if (this._liftArmed === false) return null;
      const up = atBot;
      const T = 2.6 * Math.max(1, Math.abs(C.topY - C.padY) / 1.6) ** 0.5;
      L = this._lift = { C, t: 0, up, x0: p.x, z0: p.z, y0: p.y, y1: (up ? C.topY : C.padY) + 0.012, yaw0: car.yaw, yaw1: up ? C.yawUp : C.yawDown, T };
      this._liftId = C.id;
      this._liftArmed = false; this._liftRides = (this._liftRides || 0) + 1;
      if (this.onHud) this.onHud({ mode: "toast", text: up ? "Going up…" : "Going down…" });
    }
    L.t += dt;
    const u = Math.min(1, L.t / L.T), e = 0.5 - 0.5 * Math.cos(Math.PI * u);
    const c = Math.min(1, L.t / 0.5), ec = 0.5 - 0.5 * Math.cos(Math.PI * c); // centre on the pad first
    let dy = L.yaw1 - L.yaw0; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    const yaw = L.yaw0 + dy * e;
    p.set(L.x0 + (C.pad.x - L.x0) * ec, L.y0 + (L.y1 - L.y0) * e, L.z0 + (C.pad.z - L.z0) * ec);
    car.yaw = yaw; car.root.rotation.y = yaw; car.root.rotation.x = 0; car.root.rotation.z = 0;
    car.speed = 0; car.vy = 0; car.airborne = false; this._stuckTimer = 0;
    if (u >= 1) { this._lift = null; car.speed = 0.25; } // gentle roll-off onto the road
    return { surface: "road", grade: 0, lift: true };
  }

  /**
   * logic14 PADDLE CONVEYOR. The flaps are real moving floors (DriveWorld.surfacesAt), so riding
   * is ordinary physics: the car stands on a flap and rises with it (no scripted carry → no
   * jitter). Only the TIP at the top is scripted: if the car is still on a flap when it rounds
   * the top pulley, it slides off (eased, ~0.75 s, no teleport) onto the exit deck. Never buried.
   */
  _tickConveyor(dt) {
    const w = this.world;
    if (!w || !w.conveyor) return null;
    w.conveyor.t += dt;
    const car = this.car, p = car.position, K = CONVEYOR;
    let S = this._convSlide;
    if (!S) {
      const i = this._onFlap ?? -1;
      if (i < 0) return null;
      const f = w.flapAt(i);
      if (!this._convToast && f.y > K.deckY - 0.06 && this.onHud) { this._convToast = true; this.onHud({ mode: "toast", text: "Top! Drive straight off!" }); }
      if (f.carrying) return null;
      S = this._convSlide = { t: 0, T: 0.75, x0: p.x, y0: p.y, z0: p.z, x1: K.exit.x - 0.26, y1: K.deckY + 0.012, z1: K.exit.z, yaw0: car.yaw, yaw1: -Math.PI / 2 };
      this._onFlap = -1; this._convTips = (this._convTips || 0) + 1;
      if (this.onHud) this.onHud({ mode: "toast", text: "Whoops — the flap tipped you off!" });
    }
    S.t += dt;
    const u = Math.min(1, S.t / S.T), e = 0.5 - 0.5 * Math.cos(Math.PI * u);
    let dyaw = S.yaw1 - S.yaw0; while (dyaw > Math.PI) dyaw -= 2 * Math.PI; while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
    p.set(S.x0 + (S.x1 - S.x0) * e, S.y0 + (S.y1 - S.y0) * e + 0.05 * Math.sin(Math.PI * u), S.z0 + (S.z1 - S.z0) * e);
    car.yaw = S.yaw0 + dyaw * e; car.root.rotation.set(0, car.yaw, 0);
    car.speed = 0; car.vy = 0; car.airborne = false; this._stuckTimer = 0;
    if (u >= 1) { this._convSlide = null; this._convToast = false; car.speed = 0.3; }
    return { surface: "road", grade: 0, lift: true, conveyor: true };
  }

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
    this._tickMouseSteer(dt); // logic20
    const driveKeys = this._inputsFrozen
      ? { forward: false, back: false, left: false, right: false, boost: false }
      : this.keys;

    const prevX = pos.x;
    const prevZ = pos.z;
    // logic8: free drive — the car reads only the world (surfaces + solids). No path snap.
    const env = this._env || (this._env = {
      world: this.world,
      radius: this._carRadius,
      boxesNear: (x, z, r) => this._wallsNear(x, z, r),
      clear: (x, z, y) => this._clearPointFromWalls(x, z, y, 0.004),
    });
    env.world = this.world;
    const flags = this._tickConveyor(dt) || this._tickLift(dt) || (this.world ? this.car.update(dt, driveKeys, env) : { surface: null, grade: 0 });
    this._lastFlags = flags;
    this._tickBooks(dt); // logic15
    // logic14: standing on a carrying conveyor flap?
    this._onFlap = (this.world && !this._convSlide && !this.car.airborne && this.world.flapUnder) ? this.world.flapUnder(pos.x, pos.z, pos.y) : -1;
    if (this._onFlap < 0 && !this._convSlide) this._convToast = false;
    if (this._onFlap >= 0) { // logic16: belt guide — riders ease to the middle of the flaps (no grinding the cage at the lip)
      const P = CONVEYOR.phys, zc = (P.minZ + P.maxZ) / 2;
      pos.z += (zc - pos.z) * Math.min(1, 1.5 * dt);
    }
    if (this.tracks._conveyor && this.world && this.world.conveyor) this.tracks._conveyor.update(this.world.conveyor.t);
    this._frameWallHits = flags.hit ? 1 : 0;
    if (flags.hit) this._wallHitCount = (this._wallHitCount || 0) + 1;
    if (flags.hitHeadOn) this._impactPulse = Math.max(this._impactPulse || 0, 0.12);
    this._sanitizeCar();
    this._updateStuckRespawn(dt, driveKeys, prevX, prevZ, flags);
    this.car.idleTwitch(dt);
    this.tracks.updateVisuals(this._time);
    this.books.update(this._time, dt);
    this._updateFx(dt, null, flags);

    if (this.car.crashed && !this._crashPhase) {
      this._beginCrash();
    }

    // Camera "elevated" feel on ramps / high decks (from the real slope + height above the floor)
    const onElevDeck = Math.abs(flags.grade || 0) > 0.08 || (flags.surface === "road" && pos.y > 0.3 && pos.y < 4.1);
    this._camElevated = THREE.MathUtils.lerp(this._camElevated, onElevDeck ? 1 : 0, 1 - Math.exp(-2.4 * dt));
    this._camDt = dt;
    // logic9 toy-train view: on a high wall-top track, lift + pull the chase cam and tilt the
    // aim down over the rooms below (h = height above the floor under the car).
    {
      let floorY = null;
      let pathId = null;
      if (this.world && !this.car.airborne) {
        for (const sf of this.world.surfacesAt(pos.x, pos.z)) {
          if (sf.kind === "floor" && sf.y < pos.y - 0.3 && (floorY == null || sf.y > floorY)) floorY = sf.y;
          if (sf.kind === "road" && Math.abs(sf.y - pos.y) < 0.06) pathId = sf.pathId;
        }
      }
      const h = floorY == null ? 0 : pos.y - floorY;
      const want = (this.car.airborne || pathId === "mouse_run" || pathId === "sky_chandelier" || this._lift || this._onFlap >= 0 || this._convSlide) ? 0 : THREE.MathUtils.smoothstep(h, 1.2, 2.8);
      this._camHigh = THREE.MathUtils.lerp(this._camHigh || 0, want, 1 - Math.exp(-2.2 * dt));
      this._inMouseRun = (pathId === "mouse_run" && pos.z > 13.1) || pathId === "sky_roofrun" || pathId === "sky_westchute" || pathId === "sky_carriage";

    this._onGutter = pathId === "gutter" || pathId === "gutter_entry";
    // logic18 gutter: soft trough lets the car wiggle; speed assist only on the plunge (not the flat lip)
    // so the entry does not launch east. Whoosh builds on both. Steer still works via keys + soft rails.
    if (this._onGutter && !this.car.airborne) {
      if (pathId === "gutter" && this.car.speed > 0.12) {
        this.car.speed = Math.min(this.car.speed * (1 + 0.4 * Math.min(1, dt * 4)), this.car.maxSpeed * 1.6);
      }
      if (!this._gutterWhoosh) this._gutterWhoosh = 0;
      this._gutterWhoosh = Math.min(1, this._gutterWhoosh + dt * (pathId === "gutter" ? 2.4 : 1.2));
    } else if (this._gutterWhoosh) {
      this._gutterWhoosh = Math.max(0, this._gutterWhoosh - dt * 1.5);
    }
    }
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
    // logic13: in the air (and just after touchdown) the rig's height follows a low-passed car
    // height, so a hop reads as the car flying — not the whole world bobbing.
    const airish = this.car.airborne || (this.car._justLanded || 0) > 0;
    if (this._camBaseY == null || this._lift || this._convSlide || this._onFlap >= 0 || this._camMode === "bumper") this._camBaseY = pp.y; // logic14: conveyor ride = lift
    this._camBaseY += (pp.y - this._camBaseY) * ease(airish ? 16.0 : 14.0); // rug lips / kerb steps glide too
    if (Math.abs(pp.y - this._camBaseY) > 0.6) this._camBaseY = pp.y; // a real drop: follow
    this._camBaseY = THREE.MathUtils.clamp(this._camBaseY, pp.y - 0.03, pp.y + 0.03); // never lose the car out of frame
    let camY = this._camBaseY + this._camUpS;
    // Never let the chase cam sink below the car's own deck height (ramp-body clip guard)
    let camFloor = pp.y + 0.03; // logic11: driver-eye scale (was 0.06 for the 0.26u chase)
    // logic4: ...and never under the ribbon deck BEHIND the car. On the Climb B descent the
    // chase cam trails up a 29% grade; the guard samples the car→camera sight line so the ray to
    // the car clears the deck (and its under-fill keel) everywhere between them.
    if (this.world) {
      const aimY = pp.y + 0.03;
      for (const f of [0.3, 0.45, 0.6, 0.75, 0.9, 1.0]) {
        const sx = pp.x + (camX - pp.x) * f, sz = pp.z + (camZ - pp.z) * f;
        const ys = this.world.surfaceTopNear(sx, sz, pp.y);
        if (ys == null || ys > pp.y + 0.25) continue; // logic12: a deck ABOVE (next helix ring) is an occluder, not a floor
        if (f < 1 && ys < pp.y + 0.06) continue; // logic13: a rug lip / kerb step behind the car never pops the rig
        const need = f >= 1 ? ys + 0.05 : aimY + (ys + 0.03 - aimY) / f;
        camFloor = Math.max(camFloor, Math.min(pp.y + 0.9, need));
      }
    }
    // Lift rises immediately (never inside a deck) and relaxes smoothly (no pop when it clears)
    const wantLift = Math.max(0, camFloor - camY);
    // logic13: rises fast but CONTINUOUSLY (a rug lip / threshold behind the car used to pop the
    // rig up 0.14 in one frame); a big deck is never more than 0.06 under the line of sight.
    const cl = this._camLift || 0;
    this._camLift = wantLift >= cl ? Math.max(cl + (wantLift - cl) * ease(12.0), wantLift - 0.06)
      : cl + (wantLift - cl) * ease(4.0);
    camY += this._camLift;
    // logic11: at driver-eye scale a crest/grade lift is large relative to the 0.17u rig — swing
    // the camera UP-and-IN (keep the rig length) instead of only up, so the car never shrinks.
    let hX = camX - pp.x, hZ = camZ - pp.z;
    if (this._camLift > 1e-4) {
      const nom = Math.hypot(this._camBackS, this._camUpS) * 1.08, dy = camY - pp.y;
      const h = Math.hypot(hX, hZ), want = Math.sqrt(Math.max(0.04 * 0.04, nom * nom - dy * dy));
      if (h > want) { hX *= want / h; hZ *= want / h; }
    }
    // logic15 MOUSE LOOK: orbit the rig around the car (yaw/pitch offsets), before every
    // occlusion / solid guard below so the orbiting camera stays just as safe.
    {
      const ml = this.mouseLook;
      ml.idle += dt;
      if (!ml.on || ml.idle > 1.5) { const k = Math.exp(-2.6 * dt); ml.yaw *= k; ml.pitch *= k; if (Math.abs(ml.yaw) < 1e-4) ml.yaw = 0; if (Math.abs(ml.pitch) < 1e-4) ml.pitch = 0; }
      if (ml.yaw || ml.pitch) {
        const c = Math.cos(ml.yaw), s = Math.sin(ml.yaw), rx = hX * c + hZ * s, rz = -hX * s + hZ * c;
        hX = rx; hZ = rz;
        const h = Math.hypot(hX, hZ), pc = Math.cos(ml.pitch);
        hX *= pc; hZ *= pc; camY += h * Math.sin(ml.pitch);
      }
    }
    // logic8: off-road the car can run under/beside furniture. Never let the chase cam sit
    // inside a solid or behind one: pull it in along the car→camera ray to just before the
    // first solid (never closer than 0.12u), and keep it above the car's roof.
    // logic12: DECK OCCLUSION — never look at the car through a deck overhead (spiral turns,
    // skybridges over rugs, the next helix ring). Walk the car→camera line; if a road deck's slab
    // (top … top−0.13) cuts it, pull the camera in to just before that point (smoothed out again).
    if (this.world) {
      let fCut = 1;
      for (const f of [0.25, 0.4, 0.55, 0.7, 0.85, 1.0]) {
        const sx = pp.x + hX * f, sz = pp.z + hZ * f, sy = pp.y + 0.03 + (camY - pp.y - 0.03) * f;
        for (const sf of this.world.surfacesAt(sx, sz)) {
          if (sf.kind !== "road" || sf.y < pp.y + 0.05) continue;
          if (sy > sf.y - 0.15 && sy < sf.y + 0.02) { fCut = Math.min(fCut, f - 0.15); break; }
        }
        if (fCut < 1) break;
      }
      const want = Math.max(0.35, fCut);
      this._camOccK = want < (this._camOccK ?? 1) ? want : (this._camOccK ?? 1) + (want - (this._camOccK ?? 1)) * ease(3.0);
      if (this._camOccK < 0.999) { hX *= this._camOccK; hZ *= this._camOccK; }
    }
    let cam = this._camClearOfSolids(pp, pp.x + hX, camY, pp.z + hZ);
    // logic13 STEADY OCCLUSION: also probe where the car will be in ~0.3 s so a door jamb /
    // tunnel mouth / furniture edge starts easing the camera in (and up) BEFORE it occludes;
    // the eased rig never sits less safe than what this frame needs, and relaxes back slowly.
    {
      const hl = Math.hypot(hX, hZ) || 1;
      const kOf = (c, ox, oz) => Math.min(1, Math.hypot(c.x - (pp.x + ox), c.z - (pp.z + oz)) / hl);
      const kNow = kOf(cam, 0, 0), yNow = cam.y - camY;
      const v = this.car.speed || 0, la = 0.3;
      const ox = Math.sin(this.car.yaw) * v * la, oz = Math.cos(this.car.yaw) * v * la;
      let kT = kNow, yT = yNow;
      if (Math.abs(v) > 0.05 && this._camMode !== "bumper") {
        const ahead = this._camClearOfSolids({ x: pp.x + ox, y: pp.y, z: pp.z + oz }, pp.x + ox + hX, camY, pp.z + oz + hZ);
        kT = Math.min(kT, kOf(ahead, ox, oz)); yT = Math.max(yT, ahead.y - camY);
        this._camClearOfSolids(pp, pp.x + hX, camY, pp.z + hZ); // restore _camSolidPull for this frame
      }
      if (this._camSolK == null) { this._camSolK = kT; this._camSolY = yT; }
      this._camSolK += (kT - this._camSolK) * ease(kT < this._camSolK ? 9.0 : 2.4);
      this._camSolY += (yT - this._camSolY) * ease(yT > this._camSolY ? 9.0 : 2.4);
      const kF = Math.min(this._camSolK, kNow), yF = Math.max(this._camSolY, yNow);
      if (this._camMode !== "bumper" && (kF < kNow - 1e-4 || yF > yNow + 1e-4)) {
        const c2 = { x: pp.x + hX * kF, y: camY + yF, z: pp.z + hZ * kF };
        if (this._segSolidHit(pp.x, pp.y + 0.07, pp.z, c2.x, c2.y, c2.z) >= 1) cam = c2;
      }
    }
    this.camera.position.set(cam.x, cam.y, cam.z);
    this._camVel.set(0, 0, 0);
    this._camPrevTarget = null;

    // Aim: car-relative look offset, low-passed (Y softer so grade creases don't tip the lens)
    const offX = this._camTarget.x - pp.x, offY = this._camTarget.y - pp.y, offZ = this._camTarget.z - pp.z;
    if (!this._camLookOff) this._camLookOff = new THREE.Vector3(offX, offY, offZ);
    this._camLookOff.x += (offX - this._camLookOff.x) * ease(6.5);
    this._camLookOff.z += (offZ - this._camLookOff.z) * ease(6.5);
    this._camLookOff.y += (offY - this._camLookOff.y) * ease(3.0);
    if (!this._camLookSmooth) this._camLookSmooth = new THREE.Vector3();
    const lk = Math.min(1, (this._camLift || 0) / 0.05); // lifted rig: aim nearer the car so it stays framed
    const mlK = Math.min(1, (Math.abs(this.mouseLook.yaw) + Math.abs(this.mouseLook.pitch)) / 0.5); // orbiting: look at the car
    this._camLookSmooth.set(pp.x + this._camLookOff.x * (1 - 0.6 * lk) * (1 - mlK), pp.y + this._camLookOff.y * (1 - mlK) + 0.03 * mlK, pp.z + this._camLookOff.z * (1 - 0.6 * lk) * (1 - mlK));
    this.camera.lookAt(this._camLookSmooth);
    this._sanitizeCamera();

    const inDark = !!this._inMouseRun; // logic9: inside the hollow-wall mouse run
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
    // logic11: driver-eye camera sits 2–5 cm from the car → small near; far trimmed to keep the
    // depth range (far/near) ≈ the logic10 one per unit of distance in view.
    const wantNear = this._camMode === "bumper" ? 0.008 : THREE.MathUtils.lerp(0.014, 0.01, this._tunnelDark);
    if (this.camera.far !== 110) { this.camera.far = 110; this.camera.updateProjectionMatrix(); }
    let projDirty = Math.abs(this.camera.fov - this._fov) > 0.08;
    if (Math.abs(this.camera.near - wantNear) > 0.0015) {
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
        grade: this.car._smoothGrade || 0,
        steer: this.car._steerInput || 0,
        voidEdge: this._voidEdge || 0,
        carpet: !!(this._lastFlags && this._lastFlags.surface === "floor"),
        braking: thr < -0.05 || (thr < 0.02 && Math.abs(this.car.speed) > 0.15),
        gutter: this._gutterWhoosh || 0,
      });
    }

    this._labelCooldown = Math.max(0, this._labelCooldown - dt);
    this._hintCooldown = Math.max(0, this._hintCooldown - dt);

    // logic8: plain "Entering <room>" toasts from where the car actually is (on or off road)
    const room = (!this.car.airborne && this.world) ? this.world.roomAt(pos.x, pos.y, pos.z) : null;
    const roomName = room && room.name ? room.name : "";
    if (roomName && roomName !== this._lastLabel && this._labelCooldown <= 0) {
      this._lastLabel = roomName;
      this._labelCooldown = 2.5;
      if (this.onCheckpoint) this.onCheckpoint(roomName, { shortcut: false });
    }

    // Void-edge warning (kept): probe the ground just ahead of the bumper; a drop of more than a
    // kerb (hole / deck edge / balcony lip) ahead → soft vignette + tiny FOV tighten. Never moves the car.
    this._edgeHintCd = Math.max(0, this._edgeHintCd - dt);
    let edgeAmt = 0;
    let voidEdge = 0;
    if (this.world && !this.car.airborne) {
      const fx = Math.sin(this.car.yaw), fz = Math.cos(this.car.yaw);
      const sgn = this.car.speed < -0.02 ? -1 : 1;
      for (const [d, w] of [[0.10, 1.0], [0.18, 0.7], [0.28, 0.45]]) {
        const g = this.world.groundAt(pos.x + fx * d * sgn, pos.z + fz * d * sgn, pos.y);
        if (!g || g.y < pos.y - 0.3) { voidEdge = Math.max(voidEdge, w); }
      }
      edgeAmt = voidEdge * 0.92;
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

    this._crashPhase = null;
    this._crashTimer = 0;
    this._inputsFrozen = false;
    this._stuckTimer = 0;
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
    const ROAD = /^ribbon_/; // logic8: plain road surfaces only
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

  /** Pure-pursuit look-ahead point along the harness route (keys only; never moves the car). */
  _autodriveTarget(ad, p, ahead) {
    if (!ad.route) {
      const ids = ad.side === "b"
        ? ["balcony_to_climb_b", "climb_b", "foyer_finish"]
        : ["foyer_to_climb_a", "climb_a", "landing_hairpin"];
      const pts = [];
      for (const id of ids) {
        for (const sg of this.tracks.segments) {
          if (sg.pathId !== id) continue;
          if (!pts.length) pts.push(sg.a);
          pts.push(sg.b);
        }
      }
      ad.route = pts;
      ad.routeI = 0;
    }
    const R = ad.route;
    if (R.length < 2) return null;
    let bi = ad.routeI || 0, bd = Infinity;
    for (let i = Math.max(0, bi - 2); i < Math.min(R.length, bi + 25); i++) {
      const d = Math.hypot(R[i].x - p.x, R[i].z - p.z) + Math.abs(R[i].y - p.y) * 0.5;
      if (d < bd) { bd = d; bi = i; }
    }
    ad.routeI = bi;
    let acc = 0;
    for (let i = bi; i < R.length - 1; i++) {
      acc += Math.hypot(R[i + 1].x - R[i].x, R[i + 1].z - R[i].z);
      if (acc >= ahead) return R[i + 1];
    }
    return R[R.length - 1];
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

    // logic8: the harness is a DRIVER, not a rail: it reads which road (if any) is really under
    // the wheels and presses A/D toward a point ~0.45u ahead on the route — nothing else.
    const gnd = (this.world && !this.car.airborne) ? this.world.groundAt(p.x, p.z, p.y) : null;
    const snap = gnd ? { onTrack: gnd.kind === "road", pathId: gnd.pathId || null, y: gnd.y } : null;
    const pathId = (snap && snap.pathId) || "-";
    if (isB && pathId === "climb_b") ad.sawPath = true;
    if (!isB && pathId === "climb_a") ad.sawPath = true;

    // logic4: car-in-frame proof. Sample every 6th frame while on the climb, every frame once
    // the pass metric is reached; PASS needs ≥90% visible samples on the climb AND the last
    // 6 frames visible (camera→car ray clear + car inside the frustum).
    ad.visFrame = (ad.visFrame || 0) + 1;
    const nearPassMetric = isB ? ad.drop >= 3.8 : ad.maxY >= 4.0;
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
    let cmd = 0;
    const tgt = this._autodriveTarget(ad, p, 0.45);
    if (tgt) {
      let d = Math.atan2(tgt.x - p.x, tgt.z - p.z) - this.car.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      cmd = d * 1.6;
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
      const line = `t=${ad.t.toFixed(1)}s y=${p.y.toFixed(2)} ground.y=${snapY} on=${onTrk} xz=${p.x.toFixed(2)},${p.z.toFixed(2)} spd=${Number(kmh).toFixed(0)} km/h path=${pathId} ${metric} ${visNow}`;
      console.log("[autodrive]", line);
      if (ad.logEl) ad.logEl.textContent = line + (ad.result ? `\n${ad.result}` : "");
    }

    if (isB) {
      // PASS on Y drop ≥2.5 with climb_b path seen (landing → foyer)
      const onB = !!(snap && snap.onTrack);
      // logic3: full descent to the foyer (drop ≥4.0 of 4.2), live on=1
      if (ad.drop >= 4.19 && ad.sawPath && onB && (pathId === "climb_b" || pathId === "foyer_finish") && !this._crashPhase && !this.car?.crashed && visOkNow) {
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
    const crestOk = ad.maxY >= 4.205; // logic8: on the flat crest top, not mid-slope // logic3: full crest (tip flat is 4.2), not 3.8 mid-arc
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
