/**
 * Ramp-approach proof: foyer_skirting → ramp_foyer_to_landing with wall+stair+furniture.
 * Assert no permanent 0-speed pin when aiming at climb; climb still crests.
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
console.log("Booting Mansion + Drive for ramp-approach-sim…");
const mansion = new Mansion(scene);
const drive = new DriveMode(scene, camera);
drive.setWallColliders(mansion.getColliders());
drive.enter();

const cols = mansion.getColliders();
const dt = 1 / 60;
const ramp = TRACK_PATHS.find((p) => p.id === "ramp_foyer_to_landing");
const foot = ramp.points[0];
const crest = ramp.points[ramp.points.length - 1];

// Prove stringers no longer overlap west skirting centerline
{
  const skirtingX = -8.3;
  let overlap = false;
  let culprit = null;
  for (let i = 0; i < cols.length; i++) {
    const b = cols[i];
    if ((b.driveKind || "wall") !== "stair") continue;
    // Drive-softened copy used in play
    const soft = drive._wallColliders[i] || b;
    if (soft.min.y > 0.2) continue; // raised underside ok
    if (soft.max.z < 7.5 || soft.min.z > 12) continue;
    if (soft.min.x <= skirtingX && soft.max.x >= skirtingX) {
      overlap = true;
      culprit = { i, min: soft.min, max: soft.max, kind: soft.driveKind };
      break;
    }
  }
  // Also check Drive colliders near ribbon with car radius
  const r = drive._carRadius;
  let hitRibbon = false;
  let hitInfo = null;
  for (const b of drive._wallColliders) {
    if (b.min.y > 0.2) continue;
    if (b.max.z < 8.5 || b.min.z > 11.5) continue;
    if (b.max.x < -8.6 || b.min.x > -7.9) continue;
    // Does AABB overlap car at (-8.3, 9.5)?
    const px = -8.3, pz = 9.5;
    if (px + r > b.min.x && px - r < b.max.x && pz + r > b.min.z && pz - r < b.max.z) {
      hitRibbon = true;
      hitInfo = { kind: b.driveKind, x: [b.min.x, b.max.x], z: [b.min.z, b.max.z], y: [b.min.y, b.max.y] };
      break;
    }
  }
  console.log("STRINGER_CLEAR", { overlap, culprit, hitRibbon, hitInfo });
  ok("stair stringers clear west skirting ribbon", !hitRibbon, hitRibbon ? JSON.stringify(hitInfo) : "clear");
}

function reset(x, z, yaw, spd = 0.32) {
  drive.car.setPose(x, 0.075, z, yaw);
  drive.car.speed = spd;
  drive.car.crashed = false;
  drive.car.airborne = false;
  drive.car.vy = 0;
  drive.car._unsupportedFrames = 0;
  drive.car._lastElevated = false;
  drive._stuckTimer = 0;
  drive._jamHits = 0;
  drive._stuckNudgeCd = 0;
  drive._crashPhase = null;
  drive._inputsFrozen = false;
  drive.tracks._lastPathId = "foyer_skirting";
  drive.tracks._lastPathKind = "floor";
}

function steerAimClimb() {
  const p = drive.car.position;
  const s = drive.tracks.querySnap(p.x, p.y, p.z, 1.65, drive.car.yaw);
  let yawTarget = Math.PI; // -Z toward foot from south
  const toFoot = Math.hypot(p.x - foot.x, p.z - foot.z);
  if (s?.kind === "ramp" && s.onTrack && s.yaw != null) {
    yawTarget = s.yaw;
  } else if (toFoot < 2.8 || p.z < 10.0) {
    const tgt = ramp.points[Math.min(3, ramp.points.length - 1)];
    yawTarget = Math.atan2(tgt.x - p.x, tgt.z - p.z);
  } else if (s?.yaw != null) {
    // Bidirectional prefer
    let d0 = s.yaw - drive.car.yaw;
    while (d0 > Math.PI) d0 -= Math.PI * 2;
    while (d0 < -Math.PI) d0 += Math.PI * 2;
    let d1 = d0 + Math.PI;
    while (d1 > Math.PI) d1 -= Math.PI * 2;
    while (d1 < -Math.PI) d1 += Math.PI * 2;
    yawTarget = Math.abs(d1) < Math.abs(d0) ? s.yaw + Math.PI : s.yaw;
  }
  let left = false, right = false;
  if (Number.isFinite(yawTarget)) {
    let dyaw = yawTarget - drive.car.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    left = dyaw > 0.06;
    right = dyaw < -0.06;
  }
  return { forward: true, back: false, left, right, boost: false, snap: s };
}

// ─── 1) Approach climb from spawn along west skirting, mount, no pin ───
{
  reset(-8.05, 12.0, Math.PI, 0.30); // playtest-like: face ramp along west wall
  let pinFrames = 0, maxPin = 0, streak = 0, minSpd = 99;
  let mounted = false, crested = false, maxY = 0;
  let sumSpd = 0, n = 0;
  for (let i = 0; i < 60 * 28; i++) {
    const { snap, ...keys } = steerAimClimb();
    drive.keys = keys;
    drive.update(dt);
    const spd = Math.abs(drive.car.speed);
    const p = drive.car.position;
    sumSpd += spd; n++;
    if (i > 45 && spd < minSpd) minSpd = spd;
    if (spd < 0.05) { pinFrames++; streak++; maxPin = Math.max(maxPin, streak); }
    else streak = 0;
    maxY = Math.max(maxY, p.y);
    if (snap?.kind === "ramp" && snap.pathId === "ramp_foyer_to_landing" && snap.onTrack) mounted = true;
    if (p.y >= crest.y - 0.25 && Math.hypot(p.x - crest.x, p.z - crest.z) < 1.5) {
      crested = true;
      break;
    }
    if (drive.car.crashed) break;
  }
  const pinTime = pinFrames / 60;
  const maxPinS = maxPin / 60;
  const avg = sumSpd / n;
  console.log("APPROACH", {
    avgSpd: +avg.toFixed(3), minSpd: +minSpd.toFixed(3),
    pinTime_s: +pinTime.toFixed(2), maxPinStreak_s: +maxPinS.toFixed(2),
    mounted, crested, maxY: +maxY.toFixed(3),
    end: {
      x: +drive.car.position.x.toFixed(2),
      y: +drive.car.position.y.toFixed(2),
      z: +drive.car.position.z.toFixed(2),
      spd: +Math.abs(drive.car.speed).toFixed(3),
      kmh: +drive.car.getSpeedKmh().toFixed(1),
    },
  });
  ok("ramp-approach pinTime < 0.5s", pinTime < 0.5, `pinTime=${pinTime.toFixed(2)}s`);
  ok("ramp-approach no permanent pin (streak < 0.5s)", maxPinS < 0.5, `maxPin=${maxPinS.toFixed(2)}s`);
  ok("ramp-approach mounts climb", mounted, `mounted=${mounted}`);
  ok("ramp-approach crests landing", crested && !drive.car.crashed, `maxY=${maxY.toFixed(2)} crest=${crest.y}`);
  ok("ramp-approach avg cruise > 0.35", avg > 0.35, `avg=${avg.toFixed(3)}`);
}

// ─── 2) Nose into former stringer endcap / underside grab zone ───
{
  const cases = [
    { label: "west_foot_aim_climb", x: -8.25, z: 9.2, yaw: Math.PI },
    { label: "stringer_endcap_z8", x: -8.3, z: 8.2, yaw: Math.PI * 0.95 },
    { label: "into_stair_from_room", x: -7.2, z: 8.8, yaw: -Math.PI / 2 },
    { label: "wall_gap_former_wedge", x: -8.55, z: 8.3, yaw: Math.PI },
  ];
  for (const c of cases) {
    reset(c.x, c.z, c.yaw, 0.35);
    let pinFrames = 0, maxPin = 0, streak = 0, minSpd = 99, mounted = false;
    for (let i = 0; i < 60 * 8; i++) {
      const { snap, ...keys } = steerAimClimb();
      drive.keys = keys;
      drive.update(dt);
      const spd = Math.abs(drive.car.speed);
      if (spd < minSpd) minSpd = spd;
      if (spd < 0.05) { pinFrames++; streak++; maxPin = Math.max(maxPin, streak); }
      else streak = 0;
      if (snap?.kind === "ramp" && snap.onTrack) mounted = true;
    }
    const pinTime = pinFrames / 60;
    const maxPinS = maxPin / 60;
    console.log("CASE", c.label, {
      pinTime: +pinTime.toFixed(2), maxPin: +maxPinS.toFixed(2),
      minSpd: +minSpd.toFixed(3), mounted,
      endSpd: +Math.abs(drive.car.speed).toFixed(3),
      end: { x: +drive.car.position.x.toFixed(2), z: +drive.car.position.z.toFixed(2), y: +drive.car.position.y.toFixed(2) },
    });
    ok(`no pin ${c.label}`, maxPinS < 0.5 && pinTime < 0.55,
      `pin=${pinTime.toFixed(2)} max=${maxPinS.toFixed(2)} min=${minSpd.toFixed(3)}`);
  }
}

// ─── 3) Climb from foot still crests with walls ───
{
  const pts = ramp.points;
  const yaw = Math.atan2(pts[1].x - foot.x, pts[1].z - foot.z);
  reset(foot.x, foot.z, yaw, 1.25);
  drive.car.position.y = foot.y + 0.02;
  let reached = false, maxY = foot.y;
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
    ) { reached = true; break; }
    if (drive.car.crashed) break;
  }
  console.log("CLIMB", { reached, maxY: +maxY.toFixed(3), crestY: crest.y, crashed: drive.car.crashed });
  ok("foyer→landing climb crests (walls)", reached && !drive.car.crashed, `maxY=${maxY.toFixed(2)}`);
}

if (fails.length) {
  console.error("\nRAMP-APPROACH FAILED:", fails.length);
  for (const f of fails) console.error(f);
  process.exit(1);
}
console.log("\nALL RAMP-APPROACH CHECKS PASSED");
