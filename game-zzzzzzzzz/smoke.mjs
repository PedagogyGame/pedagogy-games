/**
 * Node smoke: Mansion + DriveMode boot, floors, spawn snap, collision.
 */
import * as THREE from "./vendor/three.module.js";
import { Mansion } from "./js/mansion.js";
import { DriveMode } from "./js/drive/driveMode.js";
import { CAR_SPAWN } from "./js/data/tracks.js";
import { VEHICLE_PRESETS } from "./js/drive/car.js";
import { Player } from "./js/player.js";

// Minimal DOM stubs for PointerLock / canvas texture paths
if (typeof globalThis.document === "undefined") {
  const makeCtx = () => {
    const ctx = {
      fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
      font: "", textAlign: "", textBaseline: "",
      fillRect() {}, strokeRect() {}, clearRect() {},
      beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
      quadraticCurveTo() {}, bezierCurveTo() {}, arc() {}, ellipse() {},
      rect() {}, stroke() {}, fill() {}, clip() {}, save() {}, restore() {},
      translate() {}, rotate() {}, scale() {}, setTransform() {}, setLineDash() {},
      fillText() {}, strokeText() {}, measureText: () => ({ width: 0 }),
      drawImage() {}, createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      createPattern: () => null,
      getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
      putImageData() {},
    };
    return ctx;
  };
  globalThis.document = {
    createElement: (tag) => {
      if (tag === "canvas") {
        return { width: 0, height: 0, getContext: () => makeCtx(), style: {} };
      }
      return { style: {}, appendChild() {}, addEventListener() {}, removeEventListener() {} };
    },
    addEventListener() {},
    removeEventListener() {},
    getElementById: () => null,
    querySelector: () => null,
    body: { appendChild() {} },
  };
}
if (typeof globalThis.window === "undefined") {
  globalThis.window = globalThis;
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
camera.position.set(0, 1.6, 12);

console.log("Booting Mansion…");
const mansion = new Mansion(scene);
console.log("OK Mansion rooms/colliders", {
  colliders: mansion.colliders.length,
  floors: mansion.floorRegions.length,
  connectors: mansion.floorRegions.filter((f) => String(f.roomId).startsWith("connector_")).length,
});

console.log("Booting DriveMode…");
const drive = new DriveMode(scene, camera);
console.log("OK DriveMode", {
  segments: drive.tracks.segments.length,
  visible: drive.tracks.root.visible,
});

// Floors: (0,6)->0, (0,4)->4.2 with story hint
const f0 = mansion.getFloorY(0, 6, 0);
const f1 = mansion.getFloorY(0, 4, 4.2);
console.log("Floor samples", { "getFloorY(0,6,0)": f0, "getFloorY(0,4,4.2)": f1 });
if (Math.abs(f0 - 0) > 0.05) throw new Error(`Expected floor 0 at (0,6), got ${f0}`);
if (Math.abs(f1 - 4.2) > 0.05) throw new Error(`Expected floor 4.2 at (0,4), got ${f1}`);

// Spawn snap on foyer_skirting
const snap = drive.tracks.querySnap(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, 2.4);
console.log("Spawn snap", {
  spawn: CAR_SPAWN,
  onTrack: snap.onTrack,
  kind: snap.kind,
  pathId: snap.pathId,
  supported: snap.supported,
});
if (!snap.onTrack) throw new Error("Spawn not onTrack");
if (snap.pathId !== "foyer_skirting" && snap.kind !== "floor") {
  console.warn("WARN: spawn pathId", snap.pathId);
}
if (snap.pathId && snap.pathId !== "foyer_skirting") {
  // Accept nearby floor segment if still asphalt
  if (snap.kind !== "floor") throw new Error(`Spawn kind ${snap.kind} not floor`);
}

// Vehicle Driver-feel cruise sweet spot (not crawl, not rocket)
for (const [id, p] of Object.entries(VEHICLE_PRESETS)) {
  console.log(`Vehicle ${id}: max=${p.maxSpeed} boost=${p.boostMax} steer=${p.steerRate}`);
  if (p.maxSpeed < 1.15 || p.maxSpeed > 1.55) throw new Error(`${id} maxSpeed out of sweet spot: ${p.maxSpeed}`);
  if (p.boostMax < 1.6 || p.boostMax > 2.15) throw new Error(`${id} boostMax out of range: ${p.boostMax}`);
  if (p.steerRate < 2.9 || p.steerRate > 3.9) throw new Error(`${id} steerRate out of sweet spot: ${p.steerRate}`);
}
const carP = VEHICLE_PRESETS.car;
if (carP.maxSpeed < 1.35 || carP.maxSpeed > 1.45) throw new Error(`car maxSpeed want ~1.4, got ${carP.maxSpeed}`);
if (carP.steerRate < 3.4 || carP.steerRate > 3.7) throw new Error(`car steerRate want ~3.55, got ${carP.steerRate}`);

// Collision smoke: walk into a solid wall collider and ensure push-back
const dom = {
  ownerDocument: {
    addEventListener() {},
    removeEventListener() {},
  },
  addEventListener() {},
  removeEventListener() {},
  requestPointerLock() {},
};
const player = new Player(camera, dom);
player.controls.isLocked = true;
player.enabled = true;
player.getFloorY = (x, z) => mansion.getFloorY(x, z, player.floorY);
player.setPosition(0, null, 6); // foyer center
const colliders = mansion.getColliders();
// Prefer an indoor foyer wall panel (not estate boundary hedges)
let wall = null;
for (const b of colliders) {
  if (b.min.y > 0.5 || b.max.y < 2.5) continue;
  const cx = (b.min.x + b.max.x) / 2;
  const cz = (b.min.z + b.max.z) / 2;
  const thick = Math.min(b.max.x - b.min.x, b.max.z - b.min.z);
  if (thick > 0.55) continue; // skip huge outdoor slabs
  // Foyer west/east solid walls ~ x±9, z 0..13
  if (Math.abs(cx) > 7.5 && Math.abs(cx) < 10 && cz > 0 && cz < 12) {
    wall = b;
    break;
  }
}
if (!wall) {
  wall = colliders.find((b) => {
    const thick = Math.min(b.max.x - b.min.x, b.max.z - b.min.z);
    return b.min.y < 0.5 && b.max.y > 2.5 && thick < 0.55 && thick > 0.15
      && Math.abs((b.min.x + b.max.x) / 2) < 30
      && Math.abs((b.min.z + b.max.z) / 2) < 40;
  });
}
if (!wall) throw new Error("No wall collider found for smoke");

// Place player overlapping wall, resolve
const before = player.position.clone();
player.position.x = (wall.min.x + wall.max.x) / 2;
player.position.z = (wall.min.z + wall.max.z) / 2;
player.position.y = 1.6;
const overlapping = player._hits(player.position, wall);
player._resolveColliders(player.controls.getObject(), before, [wall]);
const after = player.position.clone();
const stillHit = player._hits(after, wall);
console.log("Collision smoke", {
  overlapping,
  stillHit,
  before: { x: before.x, z: before.z },
  forced: { x: (wall.min.x + wall.max.x) / 2, z: (wall.min.z + wall.max.z) / 2 },
  after: { x: after.x, z: after.z },
});
if (stillHit) throw new Error("Player still inside wall after resolve");

// Doorway pass: foyer→hall bridge floor at story 0
const bridgeY = mansion.getFloorY(0, 0.5, 0);
console.log("Foyer-hall bridge floor Y", bridgeY);
if (Math.abs(bridgeY) > 0.05) throw new Error(`Bridge should be ground story, got ${bridgeY}`);

// Attic connector should hold story 8.4
const atticBridge = mansion.getFloorY(0, -18.5, 8.4);
console.log("Attic bridge floor Y", atticBridge);
if (Math.abs(atticBridge - 8.4) > 0.05) {
  throw new Error(`Attic connector missing/wrong: ${atticBridge}`);
}

// Ribbon mesh exists (no per-seg asphalt boxes for foyer path — check root children BufferGeometry)
let ribbonLike = 0;
drive.tracks.root.traverse((o) => {
  if (o.isMesh && o.geometry && o.geometry.index && o.geometry.attributes.position) {
    const vc = o.geometry.attributes.position.count;
    if (vc > 40) ribbonLike++;
  }
});
console.log("Ribbon-like meshes", ribbonLike);
if (ribbonLike < 1) throw new Error("Expected continuous ribbon meshes");

// Floor off-ribbon = supported carpet, never void (no floor crash)
const carpetSnap = drive.tracks.querySnap(0, 0.045, 6, 1.65);
console.log("Foyer center carpet snap", {
  supported: carpetSnap.supported, carpet: carpetSnap.carpet, elevated: carpetSnap.elevated, kind: carpetSnap.kind,
});
if (!carpetSnap.supported) throw new Error("Foyer floor should be supported (carpet), not void");
if (carpetSnap.elevated) throw new Error("Foyer floor must not be elevated");

// Segment count sanity (density reduced from ×16)
console.log("Track segment count", drive.tracks.segments.length);
if (drive.tracks.segments.length > 12000) throw new Error("Segment count still too high — lag risk");

// Spatial snap grid must exist
if (!drive.tracks._snapGrid || drive.tracks._snapGrid.size < 10) {
  throw new Error("snap grid missing or tiny");
}
console.log("Snap grid cells", drive.tracks._snapGrid.size, "cellSize", drive.tracks._gridCell);

// querySnap 1000x at spawn — grid must beat naive full scan by a wide margin
const N = 1000;
const sx = CAR_SPAWN.x, sy = CAR_SPAWN.y, sz = CAR_SPAWN.z;
const t0 = performance.now();
for (let i = 0; i < N; i++) drive.tracks.querySnap(sx, sy, sz, 1.65);
const gridMs = performance.now() - t0;

// Temporary full-scan baseline (same scoring, all segments)
const segs = drive.tracks.segments;
const near = drive.tracks._segmentsNear.bind(drive.tracks);
drive.tracks._segmentsNear = () => segs; // force full list through same path
const t1 = performance.now();
for (let i = 0; i < N; i++) drive.tracks.querySnap(sx, sy, sz, 1.65);
const fullMs = performance.now() - t1;
drive.tracks._segmentsNear = near;

console.log(`querySnap x${N} at spawn: grid=${gridMs.toFixed(2)}ms fullScan=${fullMs.toFixed(2)}ms speedup=${(fullMs / Math.max(0.001, gridMs)).toFixed(1)}x`);
if (gridMs > fullMs * 0.85 && segs.length > 500) {
  console.warn("WARN: grid not clearly faster — check indexing");
}
// Expect meaningful win when segment count is high
if (segs.length > 800 && gridMs > fullMs) {
  throw new Error(`Grid slower than full scan (${gridMs} vs ${fullMs})`);
}

// door_* should not add ribbon meshes named/stacked at spawn — pad present
let spawnPad = false;
drive.tracks.root.traverse((o) => { if (o.name === "spawn_clean_pad") spawnPad = true; });
if (!spawnPad) throw new Error("spawn_clean_pad missing");


// Elevated bridge / ramp must stay height-matched (no ghost through to story carpet)
const bridgeSnap = drive.tracks.querySnap(0, 3.5, -0.45, 1.65);
console.log("Hall header bridge snap", {
  onTrack: bridgeSnap.onTrack, supported: bridgeSnap.supported,
  kind: bridgeSnap.kind, pathId: bridgeSnap.pathId, y: bridgeSnap.y,
});
if (!bridgeSnap.supported || !bridgeSnap.onTrack) {
  throw new Error(`Hall header bridge unsupported: ${bridgeSnap.kind}/${bridgeSnap.pathId}`);
}
if (bridgeSnap.kind === "floor" || bridgeSnap.carpet) {
  throw new Error("Hall header bridge stolen by floor carpet — ghost deck");
}
if (Math.abs(bridgeSnap.y - 3.53) > 0.35) {
  throw new Error(`Bridge Y wrong: ${bridgeSnap.y}`);
}

const rampSnap = drive.tracks.querySnap(-7.0, 1.8, 6.0, 1.65);
console.log("Foyer stair ramp snap", {
  onTrack: rampSnap.onTrack, supported: rampSnap.supported,
  kind: rampSnap.kind, pathId: rampSnap.pathId,
});
if (!rampSnap.supported || rampSnap.kind !== "ramp") {
  throw new Error(`Ramp not supported: ${rampSnap.kind}/${rampSnap.pathId}`);
}

const furnSnap = drive.tracks.querySnap(5.5, 0.98, 10.0, 1.65);
console.log("Foyer console furniture snap", {
  onTrack: furnSnap.onTrack, supported: furnSnap.supported,
  kind: furnSnap.kind, pathId: furnSnap.pathId,
});
if (!furnSnap.supported || !(furnSnap.kind === "elevated" || furnSnap.kind === "ramp")) {
  throw new Error(`Furniture deck unsupported: ${furnSnap.kind}/${furnSnap.pathId}`);
}

// Visible foyer skirting ribbon present (designed road at spawn)
let foyerRibbon = false;
drive.tracks.root.traverse((o) => {
  if (o.isMesh && o.name === "ribbon_floor") foyerRibbon = true;
});
if (!foyerRibbon) throw new Error("foyer floor ribbon mesh missing");
console.log("Foyer ribbon_floor present", foyerRibbon);

// Drive wall bounce wired
if (typeof drive.setWallColliders !== "function") {
  throw new Error("DriveMode.setWallColliders missing");
}
drive.setWallColliders(mansion.getColliders());
console.log("Drive wall colliders", mansion.getColliders().length);

// Furniture colliders should exceed bare walls
if (mansion.getColliders().length < 160) {
  console.warn("WARN: expected more furniture colliders, got", mansion.getColliders().length);
} else {
  console.log("Collider count with furniture", mansion.getColliders().length);
}


console.log("\nALL SMOKE CHECKS PASSED");
