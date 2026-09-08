/**
 * Node smoke: Mansion + DriveMode boot, floors, spawn snap, collision.
 */
import * as THREE from "./vendor/three.module.js";
import { Mansion } from "./js/mansion.js";
import { DriveMode } from "./js/drive/driveMode.js";
import { CAR_SPAWN, TRACK_PATHS, ROAD_WIDTH_SCALE, ROAD_WIDTH_DESIGN, RAMP_MOUNT_FEET, RAMP_WIDTH_MULT, RAMP_WIDTH_MIN } from "./js/data/tracks.js";
import { CAR_SCALE } from "./js/drive/car.js";
import { VEHICLE_PRESETS } from "./js/drive/car.js";
import { Player } from "./js/player.js";
import { OBJECTS } from "./js/data/objects.js";
import { ROOMS } from "./js/data/rooms.js";
import { buildLayerShells, isConcentricDef } from "./js/meshes.js";
import { SliceSystem } from "./js/slice.js";

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
        const x = arr[i], y = arr[i + 1], z = arr[i + 2];
        // Only floor-band ribbons z-fight the apron — elevated cornice/ramps above are fine
        // Ground-story band only (ignore cellar ribbons that share XZ under the apron)
        if (y > -0.15 && y < 0.35 && Math.hypot(x - CAR_SPAWN.x, z - CAR_SPAWN.z) < 0.85) { near = true; break; }
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

// Sample mid-climb on ramp_foyer_to_landing (path lengthened for gentler grade)
{
  const foyerRamp = TRACK_PATHS.find((p) => p.id === "ramp_foyer_to_landing");
  if (!foyerRamp) throw new Error("ramp_foyer_to_landing missing");
  const mid = foyerRamp.points[Math.floor(foyerRamp.points.length / 2)];
  const rampSnap = drive.tracks.querySnap(mid.x, mid.y, mid.z, 1.65);
  console.log("Foyer stair ramp snap", {
    onTrack: rampSnap.onTrack, supported: rampSnap.supported,
    kind: rampSnap.kind, pathId: rampSnap.pathId, sample: mid,
  });
  if (!rampSnap.supported || rampSnap.kind !== "ramp") {
    throw new Error(`Ramp not supported: ${rampSnap.kind}/${rampSnap.pathId}`);
  }
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

  // True lateral offset from cornice_foyer (long ribbon, no twin deck steal)
  let best = null, bd = 99;
  for (const seg of drive.tracks.segments) {
    if (seg.pathId !== "cornice_foyer") continue;
    const mx = (seg.a.x + seg.b.x) * 0.5;
    const mz = (seg.a.z + seg.b.z) * 0.5;
    const d = Math.hypot(mx - 8.3, mz - 6.0);
    if (d < bd) { bd = d; best = seg; }
  }
  if (!best) throw new Error("cornice_foyer segment missing");
  const abx = best.b.x - best.a.x, abz = best.b.z - best.a.z;
  const len = Math.hypot(abx, abz) || 1;
  const rx = -abz / len, rz = abx / len;
  const midX = (best.a.x + best.b.x) * 0.5;
  const midY = (best.a.y + best.b.y) * 0.5;
  const midZ = (best.a.z + best.b.z) * 0.5;
  // Just past half-width (inward toward void) → nearDeck Y-assist, NOT onTrack
  // Try both perpendicular signs; keep the one that reports nearDeck on this cornice
  let elevOff = null;
  for (const sign of [-1, 1]) {
    const cand = drive.tracks.querySnap(
      midX + rx * best.width * 0.55 * sign,
      midY,
      midZ + rz * best.width * 0.55 * sign,
      1.65
    );
    if (cand.pathId === "cornice_foyer" && cand.nearDeck && !cand.onTrack) {
      elevOff = cand; break;
    }
    if (!elevOff) elevOff = cand;
  }
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
if (drive.tracks.segments.length > 4200) {
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




// Elevated circuit united — key junctions meet; primary climbs not near-vertical
{
  const elevKinds = new Set(["elevated", "cornice", "balcony", "ramp"]);
  const byId = Object.fromEntries(TRACK_PATHS.map((p) => [p.id, p]));
  const must = [
    "ramp_landing_to_landing_cornice",
    "cornice_landing_west",
    "ramp_music_to_hall_cornice",
    "ramp_console_to_foyer_cornice",
    "ramp_workshop_to_dining_cornice",
  ];
  for (const id of must) {
    if (!byId[id] || byId[id].disabled) throw new Error(`Missing elevated connector ${id}`);
  }
  // Death-trap climbs stay in data but disabled (no invisible/undriveable lifts)
  for (const id of ["ramp_cabinet_down", "ramp_study_express_to_cases", "ramp_cornice_to_balcony"]) {
    if (!byId[id]?.disabled) throw new Error(`${id} should be disabled (too steep to soften)`);
  }
  const joinOK = (aId, aEnd, bId, maxD = 0.35) => {
    const a = byId[aId], b = byId[bId];
    const pa = aEnd === "start" ? a.points[0] : a.points[a.points.length - 1];
    let best = Infinity;
    for (const q of b.points) {
      best = Math.min(best, Math.hypot(pa.x - q.x, pa.y - q.y, pa.z - q.z));
    }
    if (best > maxD) throw new Error(`Junction ${aId}:${aEnd}↔${bId} gap ${best.toFixed(3)}`);
    return best;
  };
  const joins = [
    joinOK("cornice_hall_cross_mid", "start", "cornice_hall_west", 0.2),
    joinOK("cornice_hall_cross_mid", "end", "cornice_hall_east", 0.2),
    joinOK("cornice_dining_bridge", "start", "cornice_conservatory", 0.15),
    joinOK("cornice_dining_bridge", "end", "cornice_dining", 0.15),
    joinOK("ramp_balcony_to_drive", "start", "balcony_loop", 0.12),
    joinOK("ramp_cases_to_cornice", "end", "cornice_cabinet", 0.2),
    joinOK("ramp_landing_to_landing_cornice", "end", "cornice_landing_east", 0.12),
    // ramp_study_express_to_cases disabled (mean grade death trap)
    joinOK("ramp_music_to_hall_cornice", "end", "cornice_conservatory", 0.15),
  ];
  // Primary on-ramps: overall grade should stay tour-friendly (not chute-steep)
  const grade = (id) => {
    const p = byId[id];
    const rise = Math.abs(p.points.at(-1).y - p.points[0].y);
    let run = 0;
    for (let i = 1; i < p.points.length; i++) {
      run += Math.hypot(p.points[i].x - p.points[i - 1].x, p.points[i].z - p.points[i - 1].z);
    }
    return rise / Math.max(run, 1e-6);
  };
  for (const [id, maxG] of [
    ["ramp_foyer_to_landing", 0.45],
    ["ramp_cabinet_case", 0.45],
    ["ramp_landing_to_landing_cornice", 0.45],
    ["ramp_console_to_foyer_cornice", 0.45],
    // steep death-traps disabled rather than left undriveable
  ]) {
    const g = grade(id);
    if (g > maxG) throw new Error(`${id} too steep overall ${g.toFixed(2)} > ${maxG}`);
  }
  // Cornice snap still solid mid-circuit
  const corniceSnap = drive.tracks.querySnap(0, 3.48, -0.55, 1.65);
  if (!corniceSnap.onTrack || !corniceSnap.elevated) {
    throw new Error(`Cornice circuit snap failed: ${corniceSnap.kind}/${corniceSnap.pathId}`);
  }
  console.log("Elevated circuit united", {
    connectors: must.length,
    joins: joins.map((d) => +d.toFixed(3)),
    foyerClimb: +grade("ramp_foyer_to_landing").toFixed(3),
    cornicePath: corniceSnap.pathId,
  });
}

// Roadway width scale (~13% smaller) — preserve every path, shrink widths only.
// Climb ramps get RAMP_WIDTH_MULT after scale (halfW ≥ ~0.29) so real cars do not slide off.
if (Math.abs(ROAD_WIDTH_SCALE - 0.87) > 0.001) {
  throw new Error(`ROAD_WIDTH_SCALE want 0.87, got ${ROAD_WIDTH_SCALE}`);
}
if (!(RAMP_WIDTH_MULT >= 1.5) || !(RAMP_WIDTH_MIN >= 0.55)) {
  throw new Error(`Ramp width boost missing/weak: mult=${RAMP_WIDTH_MULT} min=${RAMP_WIDTH_MIN}`);
}
let widthChecks = 0;
let rampHalfOk = 0;
for (const path of TRACK_PATHS) {
  const design = ROAD_WIDTH_DESIGN[path.id];
  if (design == null) throw new Error(`missing design width for ${path.id}`);
  let expect = Math.round(design * ROAD_WIDTH_SCALE * 1000) / 1000;
  if (path.kind === "ramp") {
    expect = Math.round(expect * RAMP_WIDTH_MULT * 1000) / 1000;
    if (expect < RAMP_WIDTH_MIN) expect = RAMP_WIDTH_MIN;
  }
  if (Math.abs(path.width - expect) > 0.0005) {
    throw new Error(`${path.id} width ${path.width} != expect ${expect} (design ${design})`);
  }
  if (path.kind !== "ramp" && !(path.width < design - 1e-9)) {
    throw new Error(`${path.id} width not reduced (${path.width} vs design ${design})`);
  }
  if (path.kind === "ramp" && !path.disabled) {
    if (path.width * 0.5 < 0.28) throw new Error(`${path.id} halfW ${path.width * 0.5} < 0.28`);
    rampHalfOk++;
  }
  widthChecks++;
}
console.log("Road widths reduced", {
  scale: ROAD_WIDTH_SCALE, rampMult: RAMP_WIDTH_MULT, paths: widthChecks, rampHalfOk,
  foyer: TRACK_PATHS.find(p => p.id === "foyer_skirting")?.width,
  foyerRampHalf: +(TRACK_PATHS.find(p => p.id === "ramp_foyer_to_landing")?.width * 0.5).toFixed(3),
});
if (widthChecks < 50) throw new Error("too few paths for width check");
if (rampHalfOk < 20) throw new Error("too few widened climb ramps");

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

// Explore objects: ROOMS placements vs scene + SliceSystem section cut faces
{
  let placements = 0;
  for (const r of Object.values(ROOMS)) placements += (r.objects || []).length;
  const realObjs = interactives.filter((o) => o.userData?.layers);
  const hits = interactives.filter((o) => o.userData?.target);
  console.log("Explore object roster", { placements, realObjs: realObjs.length, hitProxies: hits.length });
  if (realObjs.length !== placements) {
    throw new Error(`Interactable meshes ${realObjs.length} != ROOMS placements ${placements}`);
  }
  if (hits.length !== placements) {
    throw new Error(`Hit proxies ${hits.length} != ROOMS placements ${placements}`);
  }
  for (const id of ["nautilus", "piano", "alkaline_aa"]) {
    const o = realObjs.find((x) => x.userData.objectId === id);
    if (!o) throw new Error(`Missing scene object ${id}`);
    const box = new THREE.Box3().setFromObject(o);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (id !== "piano" && maxDim < 0.35) throw new Error(`${id} too small in scene: ${maxDim}`);
  }

  for (const id of ["nautilus", "piano"]) {
    const def = OBJECTS[id];
    const obj = buildLayerShells(def);
    scene.add(obj);
    const slice = new SliceSystem();
    slice.attach(obj, scene);
    slice.setMode("section");
    slice.setIndex(0);
    slice._apply(true);
    if (!slice.cutFaces?.visible) throw new Error(`${id}: cutFaces not visible`);
    const disks = slice.cutFaces.children.filter(
      (c) => c.userData.isCutDisk || (!c.userData.isRing && !c.userData.isBevel)
    );
    if (disks.length < def.layers.length) throw new Error(`${id}: missing cut disks`);
    if (!disks.every((d) => d.visible)) throw new Error(`${id}: cut disks hidden at index 0`);
    let badTransparent = 0;
    for (const layer of obj.userData.layers) {
      layer.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if ((m.opacity ?? 1) >= 0.99 && m.transparent) badTransparent++;
          if (!m.clippingPlanes?.length) throw new Error(`${id}: material missing clip plane`);
        }
      });
    }
    if (badTransparent > 0) throw new Error(`${id}: solid section mats forced transparent`);
    slice.setIndex(2);
    slice._apply(true);
    if (obj.userData.layers[0].visible) throw new Error(`${id}: outer layer still visible in section@2`);
    const active = disks.find((d) => d.userData.layerIndex === 2);
    if (!active?.visible) throw new Error(`${id}: active cut disk hidden at index 2`);
    slice.detach(scene);
    scene.remove(obj);
    console.log(`Slice section OK ${id}`, { concentric: isConcentricDef(def), disks: disks.length });
  }
}

// ── Drive expand: attic loft / cellar stubs / wall mice / ramp pickup ──
{
  const byId = Object.fromEntries(TRACK_PATHS.map((p) => [p.id, p]));
  const mustNew = [
    "attic_loft_skirting", "attic_science_skirting", "attic_loft_to_science",
    "attic_from_shaft_service", "attic_from_landing_access",
    "cellar_skirting", "cellar_to_shaft_service", "cellar_to_pipe_east", "cellar_to_climb_tube",
    "mouse_armoury_nursery_chase", "mouse_cabinet_study_chase", "mouse_hall_conservatory_mid",
  ];
  for (const id of mustNew) {
    if (!byId[id]) throw new Error(`Missing expand path ${id}`);
  }
  // Hall header: visual:false OK (foyer cornice draws it) but must NOT elev-support
  if (byId.cornice_hall_cross_south?.visual !== false) {
    throw new Error("cornice_hall_cross_south must stay visual:false (drawn by foyer cornice)");
  }
  {
    const ghost = drive.tracks.querySnap(0.0, 3.5, -0.45, 1.65);
    if (ghost.pathId === "cornice_hall_cross_south") {
      throw new Error("invisible cornice_hall_cross_south must not win snap/support");
    }
    // Some visible path (chandelier ramp / foyer cornice) may still hold here
    console.log("Invisible elev snap blocked", { kind: ghost.kind, pathId: ghost.pathId, on: ghost.onTrack });
  }

  // Attic loft corner + shaft portal
  const loft = drive.tracks.querySnap(-10.3, 8.46 + 0.04, 4.3, 1.65);
  console.log("Attic loft corner snap", { kind: loft.kind, pathId: loft.pathId, onTrack: loft.onTrack });
  if (!loft.onTrack || !loft.supported) throw new Error("Attic loft corner unsupported");
  if (!(loft.kind === "cornice" || loft.kind === "ramp")) {
    throw new Error(`Attic loft want cornice/ramp, got ${loft.kind}/${loft.pathId}`);
  }
  const loftNorth = drive.tracks.querySnap(0, 8.5 + 0.04, -16.5, 1.65);
  if (!loftNorth.onTrack || loftNorth.pathId !== "attic_loft_skirting") {
    throw new Error(`Attic loft north snap ${loftNorth.kind}/${loftNorth.pathId}`);
  }
  const shaftAttic = drive.tracks.querySnap(-5.0, 8.46 + 0.04, -2.0, 1.65);
  if (!shaftAttic.supported) throw new Error("shaft_service_west attic portal unsupported");

  // Cellar skirting makes shaft stubs reachable
  const cellar = drive.tracks.querySnap(-8.3, -4.05 + 0.04, 15.3, 1.65);
  console.log("Cellar skirting snap", { kind: cellar.kind, pathId: cellar.pathId, onTrack: cellar.onTrack });
  if (!cellar.onTrack || cellar.kind !== "floor") throw new Error("Cellar skirting unsupported");
  const cellarShaft = drive.tracks.querySnap(-8.4, -4.05 + 0.04, 7.0, 1.65);
  if (!cellarShaft.supported) throw new Error("Cellar→shaft_service stub unsupported");

  // Wall-hollow mice: mid-cavity onTrack + tube (wall collision exempt kinds)
  const passOk = new Set(["shortcut", "mouse", "shaft", "tunnel", "chute"]);
  for (const [id, idx] of [
    ["mouse_armoury_nursery_chase", 4],
    ["mouse_cabinet_study_chase", 4],
    ["mouse_hall_conservatory_mid", 3],
    ["mouse_landing_library_mid", 3],
    ["mouse_foyer_hall_mid", 3],
    ["mouse_dining_hall_west", 3],
    ["mouse_library_attic_chase", 4],
    ["mouse_dining_west_garden", 3],
    ["mouse_dining_cornice_garden", 2],
  ]) {
    const pts = byId[id].points;
    const mid = pts[idx];
    const s = drive.tracks.querySnap(mid.x, mid.y + 0.03, mid.z, 1.65);
    console.log(`Wall mouse ${id}`, { kind: s.kind, pathId: s.pathId, onTrack: s.onTrack, tube: s.tube });
    if (!s.onTrack || !s.supported) throw new Error(`${id} mid cavity unsupported`);
    if (!passOk.has(s.kind) && s.pathId !== id) throw new Error(`${id} mid not passage kind: ${s.kind}`);
    if (!drive._passKinds.has(s.kind) && !s.tube) {
      throw new Error(`${id} would NOT be wall-collision exempt (${s.kind})`);
    }
  }
  // Portals present on new mice
  const portalPaths = new Set(drive.tracks.portals.map((p) => p.pathId));
  for (const id of [
    "mouse_armoury_nursery_chase", "mouse_cabinet_study_chase", "mouse_hall_conservatory_mid",
    "mouse_landing_library_mid", "mouse_foyer_hall_mid", "mouse_dining_hall_west", "mouse_library_attic_chase",
    "mouse_dining_west_garden", "mouse_dining_cornice_garden",
  ]) {
    if (!portalPaths.has(id)) throw new Error(`Missing portals for ${id}`);
  }
  // New loft edge / cross ribbons onTrack
  for (const [id, x, y, z] of [
    ["attic_loft_cross_ew", 0, 8.5, -6.0],
    ["attic_loft_cross_ns", 0, 8.48, 0.0],
    ["loft_library_edge", 3.15, 7.15, -6.0],
    ["loft_nursery_edge", 14.0, 7.15, -1.6],
    ["loft_music_edge", 0, 7.15, -20.6],
  ]) {
    const s = drive.tracks.querySnap(x, y + 0.04, z, 1.65);
    if (!s.onTrack || !s.supported) throw new Error(`Loft edge ${id} unsupported → ${s.kind}/${s.pathId}`);
  }

  // RAMP PICKUP AUDIT — every ramp foot engages even after hostile skirting latch
  const ramps = TRACK_PATHS.filter((p) => p.kind === "ramp" && !p.disabled);
  let footFail = 0;
  let climbFail = 0;
  const footFails = [];
  const climbFails = [];
  for (const path of ramps) {
    drive.tracks._lastPathId = "foyer_skirting"; // hostile pathBias (real approach)
    const foot = path.points[0];
    const fs = drive.tracks.querySnap(foot.x, foot.y + 0.04, foot.z, 1.65);
    if (!(fs.kind === "ramp" && fs.onTrack && fs.supported)) {
      footFail++;
      if (footFails.length < 6) footFails.push(`${path.id}→${fs.kind}/${fs.pathId}/on=${fs.onTrack}`);
    }
    // Sample along climb (~25% / 50% / 75%) — onTrack+supported; slight under-surface drop
    for (const frac of [0.25, 0.5, 0.75]) {
      const i = Math.min(path.points.length - 2, Math.max(1, Math.floor((path.points.length - 1) * frac)));
      const a = path.points[i];
      const b = path.points[i + 1];
      const x = (a.x + b.x) * 0.5;
      const y = (a.y + b.y) * 0.5;
      const z = (a.z + b.z) * 0.5;
      const s0 = drive.tracks.querySnap(x, y + 0.04, z, 1.65);
      if (!(s0.supported && s0.onTrack && (s0.kind === "ramp" || s0.pathId === path.id))) {
        climbFail++;
        if (climbFails.length < 6) climbFails.push(`${path.id}@${frac}→${s0.kind}/${s0.pathId}`);
      }
      // under≠on must NOT block legitimate ramp corridor progress
      const s1 = drive.tracks.querySnap(x, y - 0.2, z, 1.65);
      if (!(s1.supported && (s1.kind === "ramp" || s1.pathId === path.id) && (s1.onTrack || s1.nearDeck))) {
        climbFail++;
        if (climbFails.length < 8) climbFails.push(`${path.id}@${frac}drop→${s1.kind}/${s1.pathId}/on=${s1.onTrack}`);
      }
    }
  }
  console.log("Ramp pickup audit", {
    ramps: ramps.length, footFail, climbFail, footFails, climbFails: climbFails.slice(0, 4),
  });
  if (footFail > 0) throw new Error(`Ramp feet not engaging: ${footFails.join("; ")}`);
  if (climbFail > 0) throw new Error(`Ramp climb pickup failed: ${climbFails.join("; ")}`);

  // Flat-deck under≠on still: under foyer cornice must NOT claim elevated onTrack
  const underCornice = drive.tracks.querySnap(-8.3, 0.06, 6.0, 1.65);
  if (underCornice.kind === "cornice" || underCornice.kind === "balcony" || underCornice.kind === "elevated") {
    if (underCornice.onTrack) throw new Error("under≠on broken: flat deck onTrack from below");
  }
  console.log("under≠on flat deck ok", { kind: underCornice.kind, onTrack: underCornice.onTrack });

  // Attic access grade tour-friendly
  const atticRamp = byId.attic_from_landing_access;
  let rise = Math.abs(atticRamp.points.at(-1).y - atticRamp.points[0].y);
  let run = 0;
  for (let i = 1; i < atticRamp.points.length; i++) {
    run += Math.hypot(
      atticRamp.points[i].x - atticRamp.points[i - 1].x,
      atticRamp.points[i].z - atticRamp.points[i - 1].z
    );
  }
  const g = rise / Math.max(run, 1e-6);
  console.log("Attic landing ramp grade", +g.toFixed(3));
  if (g > 0.58) throw new Error(`attic_from_landing_access too steep ${g.toFixed(2)}`);

  // ── Explore ↔ Drive near-track integration ─────────────────────────
  // Hall skirting walk lane clear (consoles hug plaster outside asphalt)
  {
    const cols = mansion.getColliders();
    const r = 0.38;
    const hits = (x, z, y = 0) => {
      let n = 0;
      for (const b of cols) {
        if (y + 1.95 < b.min.y || y + 0.15 > b.max.y) continue;
        if (x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z) n++;
      }
      return n;
    };
    const laneFails = [];
    for (const z of [-2, -6, -10, -14, -18]) {
      for (const x of [2.55, -2.55]) {
        if (hits(x, z, 0) > 0) laneFails.push(`${x},${z}`);
      }
    }
    // Doorway centers must stay Explore-clear
    for (const [name, x, z, y] of [
      ["foyer→hall", 0, -0.5, 0],
      ["hall→cons", 0, -21, 0],
      ["foyer front", 0, 12.5, 0],
    ]) {
      if (hits(x, z, y) > 0) laneFails.push(name);
    }
    console.log("Explore near-track walk lanes", { laneFails, hallCleared: laneFails.length === 0 });
    if (laneFails.length) throw new Error(`Explore near-track blocked: ${laneFails.join("; ")}`);
  }

  // Explore portal cues visible without full asphalt
  {
    drive.tracks.setVisible("explore");
    let portalVis = 0, asphaltVis = 0;
    drive.tracks.root.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.exploreHint && o.visible) portalVis++;
      if (!o.userData.exploreHint && o.visible) asphaltVis++;
    });
    drive.tracks.setVisible(true); // restore for any later checks
    console.log("Explore portal cues", { portalVis, asphaltVis, portals: drive.tracks.portals.length });
    if (portalVis < 4) throw new Error("Explore should show mouse portal cues");
    if (asphaltVis > 0) throw new Error("Explore must hide asphalt ribbons");
  }

  // Precise ramp mounts from designated approach paths (25/50/75%)
  {
    let mountFail = 0;
    const mountFails = [];
    const mounts = Object.entries(RAMP_MOUNT_FEET);
    if (mounts.length < 28) throw new Error(`RAMP_MOUNT_FEET incomplete: ${mounts.length}`);
    for (const [id, mount] of mounts) {
      const path = byId[id];
      if (!path) { mountFail++; mountFails.push(`${id} missing`); continue; }
      const approachId = mount.approach || "foyer_skirting";
      drive.tracks._lastPathId = approachId;
      // Foot engagement zone
      const fs = drive.tracks.querySnap(mount.foot.x, mount.foot.y + 0.04, mount.foot.z, 1.65);
      if (!(fs.onTrack && fs.supported && (fs.kind === "ramp" || fs.pathId === id))) {
        mountFail++;
        if (mountFails.length < 8) mountFails.push(`${id} foot→${fs.kind}/${fs.pathId}`);
      }
      // Approach just behind foot (engageBack): skirting/deck or ramp must hold support
      const a = path.points[0], b = path.points[1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const bx = a.x - (dx / len) * mount.engageBack;
      const bz = a.z - (dz / len) * mount.engageBack;
      const bs = drive.tracks.querySnap(bx, a.y + 0.04, bz, 1.65);
      const approachOk = bs.supported && (
        (bs.onTrack && (bs.pathId === id || bs.pathId === approachId || bs.kind === "ramp"
          || bs.kind === "floor" || bs.kind === "elevated" || bs.kind === "cornice"
          || bs.kind === "balcony" || bs.kind === "mouse" || bs.kind === "shortcut"))
        || (bs.kind === "ramp" && bs.pathId === id && (bs.onTrack || bs.nearDeck))
      );
      if (!approachOk) {
        mountFail++;
        if (mountFails.length < 8) {
          mountFails.push(`${id} approach→${bs.kind}/${bs.pathId}/on=${bs.onTrack}/nd=${!!bs.nearDeck}`);
        }
      }
      for (const frac of mount.climbFracs) {
        const i = Math.min(path.points.length - 2, Math.max(1, Math.floor((path.points.length - 1) * frac)));
        const p0 = path.points[i], p1 = path.points[i + 1];
        const x = (p0.x + p1.x) * 0.5;
        const y = (p0.y + p1.y) * 0.5;
        const z = (p0.z + p1.z) * 0.5;
        const s = drive.tracks.querySnap(x, y + 0.04, z, 1.65);
        if (!(s.onTrack && s.supported && (s.kind === "ramp" || s.pathId === id))) {
          mountFail++;
          if (mountFails.length < 8) mountFails.push(`${id}@${frac}→${s.kind}/${s.pathId}`);
        }
      }
    }
    console.log("Ramp mount precision", { mounts: mounts.length, mountFail, mountFails: mountFails.slice(0, 5) });
    if (mountFail > 0) throw new Error(`Ramp mount precision failed: ${mountFails.join("; ")}`);
  }

}


console.log("\nALL SMOKE CHECKS PASSED");
