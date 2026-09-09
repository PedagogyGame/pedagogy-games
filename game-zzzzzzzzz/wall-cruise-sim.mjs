/**
 * Wall-cruise + head-on escape + climb proof (required before zip).
 * 1) foyer_skirting full loop with mansion wall/furniture colliders
 * 2) Head-on wall-adjacent approaches — escape/slide within N seconds
 * 3) foyer→landing climb still crests
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
      : { style: {}, classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {}, removeEventListener() {} },
    addEventListener() {}, removeEventListener() {},
    getElementById: () => null, querySelector: () => null, body: { appendChild() {} },
  };
}
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;

const fails = [];
const ok = (name, pass, detail = "") => {
  const line = pass ? `PASS  ${name}${detail ? " — " + detail : ""}` : `FAIL  ${name}${detail ? " — " + detail : ""}`;
  console.log(line);
  if (!pass) fails.push(line);
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
console.log("Booting Mansion + Drive for wall-cruise-sim…");
const mansion = new Mansion(scene);
const drive = new DriveMode(scene, camera);
drive.setWallColliders(mansion.getColliders());
drive.enter();

const dt = 1 / 60;
const foyer = TRACK_PATHS.find((p) => p.id === "foyer_skirting");
if (!foyer) throw new Error("foyer_skirting missing");

function softSteerKeys() {
  const s = drive.tracks.querySnap(
    drive.car.position.x, drive.car.position.y, drive.car.position.z, 1.65, drive.car.yaw
  );
  let left = false, right = false;
  // Prefer floor ribbon yaw when on floor cruise (don't chase furniture T into walls)
  let yawTarget = s?.yaw;
  if (s?.onTrack && (s.kind === "floor" || s.kind === "outdoor") && s.yaw != null) {
    yawTarget = s.yaw;
  } else if (s?.onTrack && s.kind === "ramp" && drive.tracks._lastPathKind === "floor") {
    const esc = drive.tracks.findEscapeSnap(drive.car.position.x, drive.car.position.y, drive.car.position.z, 1.8);
    if (esc && esc.kind === "floor" && esc.yaw != null) yawTarget = esc.yaw;
  }
  if (yawTarget != null && Number.isFinite(yawTarget)) {
    let dyaw = yawTarget - drive.car.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    let dyawR = dyaw + Math.PI;
    while (dyawR > Math.PI) dyawR -= Math.PI * 2;
    while (dyawR < -Math.PI) dyawR += Math.PI * 2;
    if (Math.abs(dyawR) < Math.abs(dyaw)) dyaw = dyawR;
    left = dyaw > 0.07;
    right = dyaw < -0.07;
  }
  return { forward: true, back: false, left, right, boost: false, snap: s };
}

// ─── 0) W-only lateral drift on foyer_skirting (no steer) ─────────
{
  // Start mid south wall, face +X; hold W only — must not veer hard into wall/furniture
  drive.car.setPose(-4.0, 0.075, 12.35, Math.PI / 2);
  drive.car.speed = 0.35;
  drive.car.crashed = false;
  drive.car.airborne = false;
  drive.tracks._lastPathId = "foyer_skirting";
  drive.tracks._lastPathKind = "floor";
  drive._stuckTimer = 0;
  drive._jamHits = 0;
  const z0 = drive.car.position.z;
  const yaw0 = drive.car.yaw;
  let sumAbsDz = 0, maxLat = 0, maxDyaw = 0, frames = 0;
  drive.keys = { forward: true, back: false, left: false, right: false, boost: false };
  for (let i = 0; i < 60 * 6; i++) {
    const z = drive.car.position.z;
    drive.update(dt);
    sumAbsDz += Math.abs(drive.car.position.z - z);
    maxLat = Math.max(maxLat, Math.abs(drive.car.position.z - z0));
    let dyaw = drive.car.yaw - yaw0;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    maxDyaw = Math.max(maxDyaw, Math.abs(dyaw));
    frames++;
    if (drive.car.position.x > 7.2) break;
  }
  const tSec = frames / 60;
  const latRate = sumAbsDz / Math.max(1e-3, tSec);
  console.log("W_ONLY_DRIFT", {
    t: +tSec.toFixed(2), maxLat: +maxLat.toFixed(4), latRate: +latRate.toFixed(4),
    maxDyawDeg: +(maxDyaw * 180 / Math.PI).toFixed(2),
    end: { x: +drive.car.position.x.toFixed(2), z: +drive.car.position.z.toFixed(2) },
  });
  ok("W-only lateral drift rate < 0.08 m/s", latRate < 0.08, `latRate=${latRate.toFixed(4)}`);
  ok("W-only max lateral offset < 0.18 m", maxLat < 0.18, `maxLat=${maxLat.toFixed(4)}`);
  ok("W-only yaw wander < 12°", maxDyaw < (12 * Math.PI / 180), `maxDyaw=${(maxDyaw*180/Math.PI).toFixed(2)}`);
}

// ─── 1) Full foyer_skirting loop with walls ───────────────────────
{
  // Cruise lap starts on south skirting facing +X — NOT climb-biased Drive spawn
  // (CAR_SPAWN faces into foyer toward climb; spawn clarity is asserted in §4).
  const loopX = 0.0, loopZ = 12.35, loopYaw = Math.PI / 2;
  drive.car.setPose(loopX, 0.075, loopZ, loopYaw);
  drive.car.speed = 0;
  drive.car.crashed = false;
  drive.car.airborne = false;
  drive._stuckTimer = 0;
  drive._jamHits = 0;
  drive.tracks._lastPathId = "foyer_skirting";
  drive.tracks._lastPathKind = "floor";

  const seconds = 45;
  let pinFrames = 0, total = 0, sumSpd = 0, minSpd = 99;
  let maxPinStreak = 0, pinStreak = 0;
  let onTrackFrames = 0;
  let climbedFurniture = 0;
  let wallHitFrames = 0;
  const start = { x: loopX, z: loopZ };
  let maxDistFromStart = 0;
  let lapProgress = 0; // rough: visit quadrants
  const quads = new Set();

  for (let i = 0; i < 60 * seconds; i++) {
    const { snap, ...keys } = softSteerKeys();
    drive.keys = keys;
    drive.update(dt);
    const spd = Math.abs(drive.car.speed);
    sumSpd += spd;
    total++;
    if (i > 90 && spd < minSpd) minSpd = spd;
    if (spd < 0.06) {
      pinFrames++;
      pinStreak++;
      maxPinStreak = Math.max(maxPinStreak, pinStreak);
    } else pinStreak = 0;
    if (snap?.onTrack) onTrackFrames++;
    if ((drive._frameWallHits || 0) > 0) wallHitFrames++;
    if (drive.car.position.y > 0.55) climbedFurniture++;
    const dx = drive.car.position.x - start.x;
    const dz = drive.car.position.z - start.z;
    maxDistFromStart = Math.max(maxDistFromStart, Math.hypot(dx, dz));
    // Quadrants relative to foyer center ~ (0, 6)
    const qx = drive.car.position.x > 0 ? 1 : 0;
    const qz = drive.car.position.z > 6 ? 1 : 0;
    quads.add(`${qx}${qz}`);
  }

  const avgSpd = sumSpd / total;
  const pinTime = pinFrames / 60;
  const maxPin = maxPinStreak / 60;
  const onRate = onTrackFrames / total;
  lapProgress = quads.size;

  console.log("LOOP_NUMBERS", {
    avgSpd: +avgSpd.toFixed(3),
    minSpd: +minSpd.toFixed(3),
    pinTime_s: +pinTime.toFixed(2),
    maxPinStreak_s: +maxPin.toFixed(2),
    onRate: +(onRate * 100).toFixed(1),
    wallHitFrames,
    climbedFurniture,
    maxDistFromStart: +maxDistFromStart.toFixed(2),
    quads: lapProgress,
    end: {
      x: +drive.car.position.x.toFixed(2),
      y: +drive.car.position.y.toFixed(2),
      z: +drive.car.position.z.toFixed(2),
    },
  });

  ok("wall-cruise avg speed > 0.55", avgSpd > 0.55, `avg=${avgSpd.toFixed(3)}`);
  ok("wall-cruise pin time < 2.5s", pinTime < 2.5, `pinTime=${pinTime.toFixed(2)}s`);
  ok("wall-cruise no permanent pin (streak < 1.2s)", maxPin < 1.2, `maxPin=${maxPin.toFixed(2)}s`);
  ok("wall-cruise min cruise speed > 0.04 (brief corner dips ok)", minSpd > 0.04, `min=${minSpd.toFixed(3)}`);
  ok("wall-cruise stays mostly on ribbon", onRate > 0.55, `onRate=${(onRate * 100).toFixed(1)}%`);
  ok("wall-cruise covers foyer (3+ quads)", lapProgress >= 3, `quads=${lapProgress}`);
  ok("wall-cruise not stuck on furniture deck", climbedFurniture < 60 * 8, `elevFrames=${climbedFurniture}`);
}

// ─── 2) Head-on wall approaches — escape/slide within N seconds ───
{
  const cases = [
    { label: "west_wall_headon", x: -7.2, y: 0.075, z: 8.0, yaw: -Math.PI / 2, N: 3.5 },
    { label: "south_wall_headon", x: -4.0, y: 0.075, z: 11.6, yaw: 0, N: 3.5 },
    { label: "east_skirting_into_wall", x: 7.6, y: 0.075, z: 11.8, yaw: Math.PI / 2, N: 4.0 },
    { label: "SE_corner_wedge", x: 7.8, y: 0.075, z: 11.9, yaw: 0.4, N: 4.0 },
  ];

  for (const c of cases) {
    drive.car.setPose(c.x, c.y, c.z, c.yaw);
    drive.car.speed = 1.15;
    drive.car.crashed = false;
    drive.car.airborne = false;
    drive.car.vy = 0;
    drive._stuckTimer = 0;
    drive._jamHits = 0;
    drive._stuckNudgeCd = 0;
    drive.tracks._lastPathId = "foyer_skirting";
    drive.tracks._lastPathKind = "floor";

    let escapedAt = -1;
    let minSpd = 99;
    let pinFrames = 0;
    const start = { x: c.x, z: c.z };
    for (let i = 0; i < 60 * c.N; i++) {
      drive.keys = { forward: true, back: false, left: false, right: false, boost: false };
      // Mild steer toward ribbon after contact so escape is fair
      const s = drive.tracks.querySnap(
        drive.car.position.x, drive.car.position.y, drive.car.position.z, 1.65, drive.car.yaw
      );
      if (s?.onTrack && s.yaw != null && i > 20) {
        let dyaw = s.yaw - drive.car.yaw;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        drive.keys.left = dyaw > 0.12;
        drive.keys.right = dyaw < -0.12;
      }
      drive.update(dt);
      const spd = Math.abs(drive.car.speed);
      if (spd < minSpd) minSpd = spd;
      if (spd < 0.06) pinFrames++;
      const moved = Math.hypot(drive.car.position.x - start.x, drive.car.position.z - start.z);
      // Escaped = moving with usable speed and not permanently nose-pinned
      if (escapedAt < 0 && i > 25 && spd > 0.35 && moved > 0.25) {
        escapedAt = i / 60;
      }
    }
    const pinTime = pinFrames / 60;
    const pass = escapedAt >= 0 && escapedAt <= c.N && pinTime < c.N * 0.55;
    console.log("HEADON", c.label, {
      escapedAt: escapedAt < 0 ? null : +escapedAt.toFixed(2),
      minSpd: +minSpd.toFixed(3),
      pinTime_s: +pinTime.toFixed(2),
      endSpd: +Math.abs(drive.car.speed).toFixed(3),
      end: { x: +drive.car.position.x.toFixed(2), z: +drive.car.position.z.toFixed(2) },
    });
    ok(
      `head-on escape ${c.label}`,
      pass,
      `esc=${escapedAt < 0 ? "NONE" : escapedAt.toFixed(2) + "s"} pin=${pinTime.toFixed(2)}s`
    );
  }
}

// ─── 3) foyer→landing climb still crests (via DriveMode + walls) ──
{
  const path = TRACK_PATHS.find((p) => p.id === "ramp_foyer_to_landing");
  const pts = path.points;
  const foot = pts[0];
  const crest = pts[pts.length - 1];
  const yaw = Math.atan2(pts[1].x - foot.x, pts[1].z - foot.z);
  drive.car.setPose(foot.x, foot.y + 0.02, foot.z, yaw);
  drive.car.speed = 1.25;
  drive.car.crashed = false;
  drive.car.airborne = false;
  drive.car.vy = 0;
  drive.car._unsupportedFrames = 0;
  drive.car._lastElevated = false;
  drive._stuckTimer = 0;
  drive._crashPhase = null;
  drive._inputsFrozen = false;
  drive.tracks._lastPathId = "foyer_skirting";
  drive.tracks._lastPathKind = "floor";

  let reached = false;
  let maxY = foot.y;
  for (let i = 0; i < 60 * 25; i++) {
    const s = drive.tracks.querySnap(
      drive.car.position.x, drive.car.position.y, drive.car.position.z, 1.8, drive.car.yaw
    );
    const keys = { forward: true, back: false, left: false, right: false, boost: false };
    if (s?.onTrack && s.yaw != null) {
      let dyaw = s.yaw - drive.car.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      keys.left = dyaw > 0.1;
      keys.right = dyaw < -0.1;
    }
    drive.keys = keys;
    drive.update(dt);
    maxY = Math.max(maxY, drive.car.position.y);
    if (
      drive.car.position.y >= crest.y - 0.2
      && Math.hypot(drive.car.position.x - crest.x, drive.car.position.z - crest.z) < 1.4
    ) {
      reached = true;
      break;
    }
    if (drive.car.crashed) break;
  }
  console.log("CLIMB", {
    reached,
    maxY: +maxY.toFixed(3),
    crestY: crest.y,
    endY: +drive.car.position.y.toFixed(3),
    crashed: drive.car.crashed,
  });
  ok("foyer→landing climb crests (with walls)", reached && !drive.car.crashed, `maxY=${maxY.toFixed(2)} crest=${crest.y}`);
}

// ─── 4) Spawn faces open road — clear ≥3 m (no pillar in cone) ────
{
  const yaw = drive._pickOpenRoadYaw(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, CAR_SPAWN.yaw);
  const r = drive._carRadius;
  const y0 = CAR_SPAWN.y - 0.02, y1 = CAR_SPAWN.y + 0.12;
  let blocked = false;
  let hitDist = null;
  for (const dist of [0.35, 0.7, 1.1, 1.6, 2.2, 3.0]) {
    const px = CAR_SPAWN.x + Math.sin(yaw) * dist;
    const pz = CAR_SPAWN.z + Math.cos(yaw) * dist;
    const cols = drive._wallsNear(px, pz, r + 0.28);
    for (const b of cols) {
      if (y1 < b.min.y || y0 > b.max.y) continue;
      if (px + r > b.min.x && px - r < b.max.x && pz + r > b.min.z && pz - r < b.max.z) {
        blocked = true; hitDist = dist; break;
      }
    }
    if (blocked) break;
  }
  ok("spawn yaw open road 3m", !blocked, `yaw=${yaw.toFixed(3)} hit@${hitDist}`);
  ok("spawn off center x=0 pillar lane", Math.abs(CAR_SPAWN.x) >= 2.5, `x=${CAR_SPAWN.x}`);
  // W 2s from spawn
  drive.car.setPose(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, yaw);
  drive.car.speed = 0; drive.car.crashed = false; drive.car.airborne = false;
  drive.keys = { forward: true, back: false, left: false, right: false, boost: false };
  let wallFrames = 0;
  const x0 = drive.car.position.x, z0 = drive.car.position.z;
  for (let i = 0; i < 120; i++) {
    drive.update(1 / 60);
    if ((drive._frameWallHits || 0) > 0) wallFrames++;
  }
  const moved = Math.hypot(drive.car.position.x - x0, drive.car.position.z - z0);
  ok("W 2s from spawn moves >0.5m", moved > 0.5, `moved=${moved.toFixed(3)} spd=${Math.abs(drive.car.speed).toFixed(3)}`);
  ok("W 2s no wall pin frames", wallFrames === 0, `wallFrames=${wallFrames}`);
}

if (fails.length) {
  console.error("\nWALL-CRUISE FAILED:", fails.length);
  for (const f of fails) console.error(f);
  process.exit(1);
}
console.log("\nALL WALL-CRUISE CHECKS PASSED");
