/**
 * Honest stuck/escape + foyer climb verification.
 * Places car beside furniture near walls in multiple rooms, holds W,
 * asserts escape onto visible onTrack asphalt within 3s.
 * Also runs foyer→landing crest climb via real DriveMode.update loop.
 */
import * as THREE from "./vendor/three.module.js";
import { Mansion } from "./js/mansion.js";
import { DriveMode } from "./js/drive/driveMode.js";
import { TRACK_PATHS, CAR_SPAWN } from "./js/data/tracks.js";

if (typeof globalThis.document === "undefined") {
  const makeCtx = () => ({
    fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1, font: "",
    textAlign: "", textBaseline: "",
    fillRect() {}, strokeRect() {}, clearRect() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, bezierCurveTo() {}, arc() {},
    ellipse() {}, rect() {}, stroke() {}, fill() {}, clip() {}, save() {}, restore() {},
    translate() {}, rotate() {}, scale() {}, setTransform() {}, setLineDash() {},
    fillText() {}, strokeText() {}, measureText: () => ({ width: 0 }),
    drawImage() {}, createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => null,
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    putImageData() {},
  });
  globalThis.document = {
    createElement: (t) => t === "canvas"
      ? { width: 0, height: 0, getContext: () => makeCtx(), style: {} }
      : { style: {}, appendChild() {}, addEventListener() {}, removeEventListener() {} },
    addEventListener() {}, removeEventListener() {},
    getElementById: () => null, querySelector: () => null, body: { appendChild() {} },
  };
}
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
console.log("Booting Mansion for stuck-sim…");
const mansion = new Mansion(scene);
const drive = new DriveMode(scene, camera);
drive.setWallColliders(mansion.getColliders());
drive.enter();

const furnCount = mansion.getColliders().filter((b) => b.driveKind === "furniture").length;
const softCount = (drive._wallColliders || []).filter((b) => b.driveKind === "furniture").length;
console.log("Colliders", {
  total: mansion.getColliders().length,
  furnitureTagged: furnCount,
  driveSoftFurniture: softCount,
});
if (furnCount < 20) {
  console.warn("WARN: expected more furniture-tagged colliders, got", furnCount);
}

// ── Visual asphalt audit: every snap segment path must have ribbon mesh language ──
{
  const snapIds = new Set(drive.tracks.segments.map((s) => s.pathId));
  const invisSnap = [];
  for (const path of TRACK_PATHS) {
    if (path.disabled) continue;
    if (!snapIds.has(path.id)) continue;
    if (path.visual === false) invisSnap.push(path.id);
    if (typeof path.width === "number" && path.width < 0.40
        && (path.kind === "floor" || path.kind === "outdoor" || path.kind === "ramp")) {
      invisSnap.push(`${path.id}:thin=${path.width}`);
    }
  }
  console.log("Snap-active invisible/thin audit", { bad: invisSnap.slice(0, 12), n: invisSnap.length });
  if (invisSnap.length) {
    throw new Error(`Snap-active invisible/thin paths: ${invisSnap.slice(0, 8).join(", ")}`);
  }
  let ribbonFloor = 0, ribbonRamp = 0;
  drive.tracks.root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === "ribbon_floor") ribbonFloor++;
    if (o.name === "ribbon_ramp") ribbonRamp++;
  });
  console.log("Ribbon meshes", { ribbonFloor, ribbonRamp });
  if (ribbonFloor < 5) throw new Error("Too few floor asphalt ribbons");
  if (ribbonRamp < 1) throw new Error("Too few ramp ribbons"); // primary-course: one foyer climb
}

/** Hold W via DriveMode.update (includes walls + unstuck). */
function holdW(seconds, label) {
  const dt = 1 / 60;
  const frames = Math.ceil(seconds / dt);
  drive.keys = { forward: true, back: false, left: false, right: false, boost: false };
  let escapedAt = -1;
  let maxOnTrack = false;
  const start = drive.car.position.clone();
  for (let i = 0; i < frames; i++) {
    drive.update(dt);
    const snap = drive.tracks.querySnap(
      drive.car.position.x, drive.car.position.y, drive.car.position.z, 1.65
    );
    if (snap.onTrack) {
      maxOnTrack = true;
      if (escapedAt < 0) escapedAt = i * dt;
    }
  }
  const end = drive.car.position;
  // Also accept: ended near escape asphalt after moving off the wall jam
  const escape = drive.tracks.findEscapeSnap(end.x, end.y, end.z, 2.5);
  const nearRoad = !!(escape && escape.dist < (escape.kind === "floor" ? 0.55 : 0.45));
  const escaped = (escapedAt >= 0 && escapedAt <= 3.0) || (nearRoad && maxOnTrack);
  return {
    label,
    escaped,
    escapedAt: escapedAt < 0 ? null : +escapedAt.toFixed(2),
    onTrack: maxOnTrack,
    nearRoad,
    moved: +Math.hypot(end.x - start.x, end.z - start.z).toFixed(3),
    end: { x: +end.x.toFixed(2), y: +end.y.toFixed(2), z: +end.z.toFixed(2) },
    speed: +drive.car.speed.toFixed(3),
    stuckTimer: +(drive._stuckTimer || 0).toFixed(2),
  };
}

function placeBesideFurniture(x, y, z, yaw) {
  drive.car.setPose(x, y, z, yaw);
  drive.car.speed = 0;
  drive.car.crashed = false;
  drive.car.airborne = false;
  drive.car.vy = 0;
  drive.car._unsupportedFrames = 0;
  drive.car._lastElevated = false;
  drive._stuckTimer = 0;
  drive._stuckNudgeCd = 0;
  drive._jamHits = 0;
  drive._crashPhase = null;
  drive._inputsFrozen = false;
  drive.tracks._lastPathId = null;
}

/** Story floor under a Y band. */
function storyYNear(y) {
  const floors = [8.46, 4.26, 0.045, -4.05];
  let best = 0.045, bd = 99;
  for (const f of floors) {
    const d = Math.abs(y - f);
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}

/**
 * Park car in wall+furniture sandwich facing the WALL so W stalls (screenshot jam).
 * Soft furniture still brushes; hard wall kills speed → unstuck → asphalt.
 */
function wedgeNearFurniture(roomLabel, pred, floorYHint = 0.045) {
  const furn = mansion.getColliders().filter((b) => b.driveKind === "furniture" && pred(b));
  if (!furn.length) return { label: roomLabel, error: "no furniture in band" };
  let best = null;
  let bestScore = Infinity;
  const walls = mansion.getColliders().filter((b) => (b.driveKind || "wall") !== "furniture");
  for (const f of furn) {
    const fcx = (f.min.x + f.max.x) * 0.5;
    const fcz = (f.min.z + f.max.z) * 0.5;
    for (const w of walls) {
      if (w.max.y - w.min.y < 2.0) continue;
      const overlapY = !(f.max.y < w.min.y || f.min.y > w.max.y);
      if (!overlapY) continue;
      // Gap along X
      let gapX = 99, sideX = 0;
      if (w.min.x >= f.max.x - 0.05) { gapX = w.min.x - f.max.x; sideX = 1; }
      else if (f.min.x >= w.max.x - 0.05) { gapX = f.min.x - w.max.x; sideX = -1; }
      let gapZ = 99, sideZ = 0;
      if (w.min.z >= f.max.z - 0.05) { gapZ = w.min.z - f.max.z; sideZ = 1; }
      else if (f.min.z >= w.max.z - 0.05) { gapZ = f.min.z - w.max.z; sideZ = -1; }
      const gap = Math.min(gapX, gapZ);
      if (gap > 0.95) continue;
      const score = gap;
      if (score < bestScore) {
        bestScore = score;
        best = { f, w, gapX, gapZ, sideX, sideZ, fcx, fcz };
      }
    }
  }
  if (!best) {
    // Force jam: pin against nearest wall from furniture center
    const f = furn[0];
    const fcx = (f.min.x + f.max.x) * 0.5;
    const fcz = (f.min.z + f.max.z) * 0.5;
    let nearest = null, nd = 99;
    for (const w of walls) {
      if (w.max.y - w.min.y < 2.0) continue;
      const wcx = (w.min.x + w.max.x) * 0.5;
      const wcz = (w.min.z + w.max.z) * 0.5;
      const d = Math.hypot(fcx - wcx, fcz - wcz);
      if (d < nd) { nd = d; nearest = w; }
    }
    if (!nearest) return { label: roomLabel, error: "no wall near furniture" };
    best = {
      f, w: nearest, gapX: 0.2, gapZ: 0.2,
      sideX: (nearest.min.x + nearest.max.x) * 0.5 > fcx ? 1 : -1,
      sideZ: 0, fcx, fcz,
    };
  }
  const { f, w, gapX, gapZ, sideX, sideZ, fcx, fcz } = best;
  const y = storyYNear(floorYHint);
  let x, z, yaw;
  if (gapX <= gapZ && sideX !== 0) {
    // Sit in gap, face wall
    x = sideX > 0 ? w.min.x - drive._carRadius - 0.01 : w.max.x + drive._carRadius + 0.01;
    z = fcz;
    // Pull slightly toward furniture so soft AABB + wall sandwich
    x = sideX > 0
      ? Math.min(x, f.max.x + 0.08)
      : Math.max(x, f.min.x - 0.08);
    yaw = sideX > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    z = sideZ > 0 ? w.min.z - drive._carRadius - 0.01 : w.max.z + drive._carRadius + 0.01;
    x = fcx;
    z = sideZ > 0
      ? Math.min(z, f.max.z + 0.08)
      : Math.max(z, f.min.z - 0.08);
    yaw = sideZ > 0 ? 0 : Math.PI;
  }
  placeBesideFurniture(x, y, z, yaw);
  // Pre-jam: zero speed, already against wall
  drive.car.speed = 0;
  return holdW(3.0, roomLabel);
}

const scenarios = [];

// Foyer: furniture near east/south of room (cx=0,cz=6, size 18×14 → x±9, z -1..13)
scenarios.push(wedgeNearFurniture("foyer", (b) => {
  const cx = (b.min.x + b.max.x) * 0.5;
  const cz = (b.min.z + b.max.z) * 0.5;
  return cx > 2 && cx < 9 && cz > -1 && cz < 13 && b.min.y < 1.5;
}, 0.045));

scenarios.push(wedgeNearFurniture("hall", (b) => {
  const cx = (b.min.x + b.max.x) * 0.5;
  const cz = (b.min.z + b.max.z) * 0.5;
  return Math.abs(cx) < 4.2 && cz < 2 && cz > -22 && b.min.y < 1.5;
}, 0.045));

scenarios.push(wedgeNearFurniture("dining", (b) => {
  const cx = (b.min.x + b.max.x) * 0.5;
  const cz = (b.min.z + b.max.z) * 0.5;
  return cx < -6 && cx > -28 && cz < -20 && cz > -40 && b.min.y < 1.8;
}, 0.045));

scenarios.push(wedgeNearFurniture("landing", (b) => {
  const cx = (b.min.x + b.max.x) * 0.5;
  const cz = (b.min.z + b.max.z) * 0.5;
  const cy = (b.min.y + b.max.y) * 0.5;
  return cy > 3.5 && cy < 6.5 && Math.abs(cx) < 12 && cz > -5 && cz < 16;
}, 4.26));

// Explicit foyer console sandwich (screenshot-class): under extruded tabletop near east wall
{
  placeBesideFurniture(7.6, 0.045, 10.0, Math.PI / 2); // face east wall, beside console zone
  scenarios.push(holdW(3.0, "foyer-console-wall-wedge"));
}

console.log("\n=== STUCK ESCAPE RESULTS ===");
let fail = 0;
for (const r of scenarios) {
  if (r.error) {
    console.log(`SKIP ${r.label}: ${r.error}`);
    continue;
  }
  const ok = r.escaped && r.onTrack;
  console.log(`${ok ? "OK" : "FAIL"} ${r.label}`, r);
  if (!ok) fail++;
}

// ── Foyer ramp climb to crest via DriveMode.update ──
{
  const path = TRACK_PATHS.find((p) => p.id === "ramp_foyer_to_landing");
  const foot = path.points[0];
  const p1 = path.points[1];
  const end = path.points.at(-1);
  const dx = p1.x - foot.x, dz = p1.z - foot.z, len = Math.hypot(dx, dz) || 1;
  placeBesideFurniture(
    foot.x + (dx / len) * 0.1,
    foot.y + 0.04,
    foot.z + (dz / len) * 0.1,
    Math.atan2(dx, dz)
  );
  drive.car.speed = 1.15;
  drive.tracks._lastPathId = "ramp_foyer_to_landing";
  drive.tracks._lastPathKind = "ramp";
  const dt = 1 / 60;
  let maxY = drive.car.position.y;
  let reached = false;
  for (let i = 0; i < 2400; i++) {
    // Mild steer toward crest
    const pos = drive.car.position;
    const want = Math.atan2(end.x - pos.x, end.z - pos.z);
    let dyaw = want - drive.car.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    drive.keys = {
      forward: true, back: false,
      left: dyaw > 0.1, right: dyaw < -0.1, boost: false,
    };
    drive.update(dt);
    if (pos.y > maxY) maxY = pos.y;
    if (pos.y >= 4.0 && Math.hypot(pos.x - end.x, pos.z - end.z) < 1.2) {
      reached = true;
      break;
    }
    if (drive.car.crashed) break;
  }
  const climb = {
    reached, maxY: +maxY.toFixed(3),
    endY: +drive.car.position.y.toFixed(3),
    crashed: drive.car.crashed,
  };
  console.log("\n=== FOYER→LANDING CLIMB ===", climb);
  if (!reached || maxY < 4.0) {
    console.log("FAIL foyer ramp crest");
    fail++;
  } else {
    console.log("OK foyer ramp crest");
  }
}

// Soft furniture must raise min.y vs raw
{
  const raw = mansion.getColliders().find((b) => b.driveKind === "furniture");
  const soft = drive._wallColliders.find((b) => b.driveKind === "furniture");
  if (raw && soft) {
    const raised = soft.min.y > raw.min.y + 0.15;
    const shrunk = (soft.max.x - soft.min.x) < (raw.max.x - raw.min.x) * 0.95;
    console.log("Drive furniture soften sample", {
      raised, shrunk,
      rawMinY: +raw.min.y.toFixed(3),
      softMinY: +soft.min.y.toFixed(3),
    });
    if (!raised && !shrunk) {
      console.log("FAIL furniture not softened for Drive");
      fail++;
    }
  }
}

console.log("\nSUMMARY", { fail, scenarios: scenarios.length });
if (fail > 0) {
  console.error("car-stuck-sim FAILED");
  process.exit(1);
}
console.log("car-stuck-sim PASSED");
