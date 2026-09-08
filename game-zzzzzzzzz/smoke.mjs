/**
 * Node smoke: Mansion + DriveMode boot, floors, spawn snap, collision.
 */
import * as THREE from "./vendor/three.module.js";
import { Mansion } from "./js/mansion.js";
import { DriveMode } from "./js/drive/driveMode.js";
import { CAR_SPAWN, TRACK_PATHS, ROAD_WIDTH_SCALE, ROAD_WIDTH_DESIGN } from "./js/data/tracks.js";
import { CAR_SCALE } from "./js/drive/car.js";
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
if (carP.steerRate < 3.35 || carP.steerRate > 3.55) throw new Error(`car steerRate want ~3.42, got ${carP.steerRate}`);

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

// Floor off-ribbon = supported carpet, never void (no floor crash) — NOT onTrack
const carpetSnap = drive.tracks.querySnap(0, 0.045, 6, 1.65);
console.log("Foyer center carpet snap", {
  supported: carpetSnap.supported, carpet: carpetSnap.carpet, onTrack: carpetSnap.onTrack,
  elevated: carpetSnap.elevated, kind: carpetSnap.kind,
});
if (!carpetSnap.supported) throw new Error("Foyer floor should be supported (carpet), not void");
if (carpetSnap.elevated) throw new Error("Foyer floor must not be elevated");
if (carpetSnap.onTrack) throw new Error("Foyer center must NOT be onTrack (binary: carpet != road)");
if (!carpetSnap.carpet) throw new Error("Foyer center should be carpet");

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

// Spawn: ONE apron mesh only — no ring stack, no ribbon overlap under pad
let spawnPad = false;
let spawnRing = false;
let meshesNearSpawn = 0;
drive.tracks.root.traverse((o) => {
  if (o.name === "spawn_clean_pad") spawnPad = true;
  if (o.name === "spawn_road_ring") spawnRing = true;
  if (o.isMesh && o.geometry) {
    // Count road-ish meshes whose bbox overlaps spawn apron (~0.95m)
    o.geometry.computeBoundingBox?.();
    const bb = o.geometry.boundingBox;
    if (!bb) return;
    // world approx via position
    const cx = o.position.x;
    const cz = o.position.z;
    // ribbon meshes sit at origin with baked verts — sample a few positions
    if (o.name === "spawn_clean_pad") return;
    if (o.name && o.name.startsWith("ribbon_") && o.geometry.attributes?.position) {
      const arr = o.geometry.attributes.position.array;
      let near = false;
      for (let i = 0; i < arr.length; i += 9) { // every ~3 verts
        const x = arr[i], z = arr[i + 2];
        if (Math.hypot(x - CAR_SPAWN.x, z - CAR_SPAWN.z) < 0.85) { near = true; break; }
      }
      if (near) meshesNearSpawn++;
    }
  }
});
if (!spawnPad) throw new Error("spawn_clean_pad missing");
if (spawnRing) throw new Error("spawn_road_ring must be removed (single apron only)");
if (meshesNearSpawn > 0) {
  throw new Error(`foyer ribbon still overlaps spawn apron (${meshesNearSpawn} ribbon mesh(es))`);
}
console.log("Spawn apron clean", { spawnPad, spawnRing, ribbonOverlap: meshesNearSpawn });

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

// Soft elevated rim fence: near-edge query should push toward center (wallBounce)
const furnEdge = drive.tracks.querySnap(5.5 + 0.22, 0.98, 10.0, 1.65);
console.log("Furniture rim fence", {
  onTrack: furnEdge.onTrack, edgeMargin: furnEdge.edgeMargin,
  wallBounce: furnEdge.wallBounce, kind: furnEdge.kind,
});
if (furnEdge.elevated || furnEdge.kind === "elevated" || furnEdge.kind === "ramp") {
  if (!furnEdge.wallBounce) {
    // try a bit farther out
    const farther = drive.tracks.querySnap(5.5 + 0.28, 0.98, 10.0, 1.65);
    console.log("Furniture rim fence (farther)", farther.wallBounce, farther.edgeMargin, farther.kind);
    if (!farther.wallBounce && farther.onTrack) {
      console.warn("WARN: no wallBounce near furniture rim — check edge fence");
    }
  }
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
if (!drive._wallGrid || drive._wallGrid.size < 5) {
  throw new Error("Drive wall spatial hash missing or tiny");
}
console.log("Drive wallGrid cells", drive._wallGrid.size, "cellSize", drive._wallGridCell);

// Furniture colliders should exceed bare walls
if (mansion.getColliders().length < 160) {
  console.warn("WARN: expected more furniture colliders, got", mansion.getColliders().length);
} else {
  console.log("Collider count with furniture", mansion.getColliders().length);
}

// Binary track: open floor carpet must never invent onTrack; elevated nearDeck must not merge
{
  const floorOff = drive.tracks.querySnap(0, 0.045, 6, 1.65);
  console.log("Binary off-ribbon foyer floor", {
    onTrack: floorOff.onTrack, nearDeck: floorOff.nearDeck, carpet: floorOff.carpet,
    supported: floorOff.supported, kind: floorOff.kind,
  });
  if (floorOff.onTrack) throw new Error("Open floor must not be onTrack");
  if (!floorOff.carpet || !floorOff.supported) throw new Error("Open floor should be carpet-supported");

  // True lateral offset from ramp_foyer_console centerline (path not axis-aligned)
  let best = null, bd = 99;
  for (const seg of drive.tracks.segments) {
    if (seg.pathId !== "ramp_foyer_console") continue;
    const mx = (seg.a.x + seg.b.x) * 0.5;
    const mz = (seg.a.z + seg.b.z) * 0.5;
    const d = Math.hypot(mx - 5.5, mz - 10);
    if (d < bd) { bd = d; best = seg; }
  }
  if (!best) throw new Error("ramp_foyer_console segment missing");
  const abx = best.b.x - best.a.x, abz = best.b.z - best.a.z;
  const len = Math.hypot(abx, abz) || 1;
  const rx = -abz / len, rz = abx / len;
  const midX = (best.a.x + best.b.x) * 0.5;
  const midY = (best.a.y + best.b.y) * 0.5;
  const midZ = (best.a.z + best.b.z) * 0.5;
  // Just past half-width → nearDeck Y-assist, NOT onTrack
  const elevOff = drive.tracks.querySnap(
    midX + rx * best.width * 0.55,
    midY,
    midZ + rz * best.width * 0.55,
    1.65
  );
  console.log("Binary elevated nearDeck", {
    onTrack: elevOff.onTrack, nearDeck: elevOff.nearDeck, supported: elevOff.supported,
    elevated: elevOff.elevated, kind: elevOff.kind, edgeMargin: elevOff.edgeMargin,
  });
  if (elevOff.onTrack) throw new Error("Elevated nearDeck must not merge into onTrack");
  if (!elevOff.nearDeck) throw new Error("Expected nearDeck just past half-width on elevated");
  if (!elevOff.supported) throw new Error("nearDeck should still support Y-stick briefly");

  // Far past deck → unsupported (void / fall), still not onTrack
  const elevVoid = drive.tracks.querySnap(
    midX + rx * best.width * 1.05,
    midY,
    midZ + rz * best.width * 1.05,
    1.65
  );
  console.log("Binary elevated void rim", {
    onTrack: elevVoid.onTrack, nearDeck: elevVoid.nearDeck, supported: elevVoid.supported,
    kind: elevVoid.kind,
  });
  if (elevVoid.onTrack) throw new Error("Void rim must not be onTrack");
  if (elevVoid.supported && elevVoid.kind !== "floor") {
    // may snap to distant floor carpet at wrong Y — only accept if not claiming elevated support
    if (elevVoid.elevated || elevVoid.nearDeck) {
      throw new Error("Far past elevated deck must not stay elevated-supported");
    }
  }
}

// Mesh count under drive_tracks — lag killer was 20k+ decorative meshes
let driveMeshes = 0;
drive.tracks.root.traverse((o) => { if (o.isMesh) driveMeshes++; });
console.log("drive_tracks mesh count", driveMeshes, "segments", drive.tracks.segments.length);
if (driveMeshes > 5000) {
  throw new Error(`drive_tracks still too heavy: ${driveMeshes} meshes (want <=5000)`);
}
if (drive.tracks.segments.length > 3500) {
  throw new Error(`segment count high: ${drive.tracks.segments.length}`);
}

// Wall query strategy profile: spatial neighbors << full list
{
  const cols = mansion.getColliders();
  drive.setWallColliders(cols);
  const N = 2000;
  const px = CAR_SPAWN.x, pz = CAR_SPAWN.z;
  const t0 = performance.now();
  let nearN = 0;
  for (let i = 0; i < N; i++) {
    const n = drive._wallsNear(px, pz, 0.45);
    nearN = n.length;
  }
  const gridMs = performance.now() - t0;
  const t1 = performance.now();
  for (let i = 0; i < N; i++) {
    let c = 0;
    for (const b of cols) {
      if (Math.abs((b.min.x + b.max.x) * 0.5 - px) < 8) c++; // cheap stand-in full touch
      void b.min.y;
    }
    nearN = c || nearN;
  }
  const fullMs = performance.now() - t1;
  console.log(`wallNear x${N}: gridNeighbors≈${drive._wallsNear(px, pz, 0.45).length}/${cols.length} grid=${gridMs.toFixed(2)}ms fullTouch=${fullMs.toFixed(2)}ms`);
  if (drive._wallsNear(px, pz, 0.45).length >= cols.length) {
    console.warn("WARN: wall spatial hash returned all colliders at spawn");
  }
}



// Roadway width scale (~13% smaller) — preserve every path, shrink widths only
if (Math.abs(ROAD_WIDTH_SCALE - 0.87) > 0.001) {
  throw new Error(`ROAD_WIDTH_SCALE want 0.87, got ${ROAD_WIDTH_SCALE}`);
}
let widthChecks = 0;
for (const path of TRACK_PATHS) {
  const design = ROAD_WIDTH_DESIGN[path.id];
  if (design == null) throw new Error(`missing design width for ${path.id}`);
  const expect = Math.round(design * ROAD_WIDTH_SCALE * 1000) / 1000;
  if (Math.abs(path.width - expect) > 0.0005) {
    throw new Error(`${path.id} width ${path.width} != design ${design} * scale (want ${expect})`);
  }
  if (!(path.width < design - 1e-9)) {
    throw new Error(`${path.id} width not reduced (${path.width} vs design ${design})`);
  }
  widthChecks++;
}
console.log("Road widths reduced", { scale: ROAD_WIDTH_SCALE, paths: widthChecks, foyer: TRACK_PATHS.find(p => p.id === "foyer_skirting")?.width });
if (widthChecks < 50) throw new Error("too few paths for width check");

if (CAR_SCALE > 0.23 || CAR_SCALE < 0.20) {
  throw new Error(`CAR_SCALE should be ~0.218 (10–15% smaller than 0.25), got ${CAR_SCALE}`);
}
console.log("CAR_SCALE", CAR_SCALE);

// Explore intact: interactives, spawn z≈11 walk floor
const interactives = mansion.getInteractives();
console.log("Explore interactives", interactives.length);
if (interactives.length < 40) throw new Error(`Explore object roster too small: ${interactives.length}`);
const spawnFloor = mansion.getFloorY(0, 11, 0);
console.log("Explore spawn floor", spawnFloor);
if (Math.abs(spawnFloor) > 0.05) throw new Error(`Spawn ~z=11 should be ground, got ${spawnFloor}`);

console.log("\nALL SMOKE CHECKS PASSED");
