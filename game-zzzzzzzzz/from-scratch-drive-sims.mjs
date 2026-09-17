/**
 * From-scratch Drive proofs (primary circuit only):
 * 1) tour: spawn → spur → climb crest → landing → balcony → return
 * 2) no-teleport: path flips + frame delta caps
 * 3) climb centerline hard-collider clear (delegates logic)
 * 4) pillar HARD (no soft-raise pierce)
 * 5) Explore↔Drive handoff cleanliness
 */
import * as THREE from "./vendor/three.module.js";
import { Mansion } from "./js/mansion.js";
import { TrackSystem } from "./js/drive/tracks.js";
import { RCCar } from "./js/drive/car.js";
import { DriveMode } from "./js/drive/driveMode.js";
import {
  TRACK_PATHS, CAR_SPAWN, PRIMARY_CIRCUIT, RAMP_MAX_GRADE, ROAD_WIDTH_SCALE,
} from "./js/data/tracks.js";

const fails = [];
const ok = (name, pass, detail = "") => {
  const line = pass ? `PASS  ${name}${detail ? " — " + detail : ""}` : `FAIL  ${name}${detail ? " — " + detail : ""}`;
  console.log(line);
  if (!pass) fails.push(line);
};

const byId = Object.fromEntries(TRACK_PATHS.map((p) => [p.id, p]));

// ── Static circuit shape ──────────────────────────────────────────
ok("primary-only", TRACK_PATHS.length === PRIMARY_CIRCUIT.length
  && TRACK_PATHS.every((p) => PRIMARY_CIRCUIT.includes(p.id) && !p.disabled),
  `n=${TRACK_PATHS.length}`);

const ramp = byId.ramp_foyer_to_landing;
let flat = 0, turn = 0, maxSeg = 0;
const pts = ramp.points;
for (let i = 1; i < pts.length; i++) {
  const run = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) || 1e-6;
  flat += run;
  maxSeg = Math.max(maxSeg, Math.abs(pts[i].y - pts[i - 1].y) / run);
  if (i >= 2) {
    const ax = pts[i - 1].x - pts[i - 2].x, az = pts[i - 1].z - pts[i - 2].z;
    const bx = pts[i].x - pts[i - 1].x, bz = pts[i].z - pts[i - 1].z;
    const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1;
    const c = Math.max(-1, Math.min(1, (ax * bx + az * bz) / (la * lb)));
    turn += Math.acos(c) * 180 / Math.PI;
  }
}
const rise = Math.abs(pts.at(-1).y - pts[0].y);
ok("climb-grade-le-30", rise / flat <= RAMP_MAX_GRADE + 1e-4 && maxSeg <= RAMP_MAX_GRADE + 1e-4,
  `mean=${(rise / flat).toFixed(3)} maxSeg=${maxSeg.toFixed(3)}`);
ok("climb-turn-lt-100", turn < 100, `turnDeg=${turn.toFixed(1)}`);
ok("scale", ROAD_WIDTH_SCALE === 0.80, `scale=${ROAD_WIDTH_SCALE}`);

// ── Systems ───────────────────────────────────────────────────────
const scene = new THREE.Scene();
const mansion = new Mansion(scene);
const camera = new THREE.PerspectiveCamera(68, 1, 0.08, 200);
const drive = new DriveMode(scene, camera);
drive.setWallColliders(mansion.getColliders());
const tracks = drive.tracks;
const car = drive.car;

function pathPoint(pathId, tFrac) {
  const segs = tracks.segments.filter((s) => s.pathId === pathId);
  let total = 0;
  const lens = segs.map((s) => {
    const L = Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z);
    total += L;
    return L;
  });
  let want = total * tFrac, acc = 0;
  for (let i = 0; i < segs.length; i++) {
    if (acc + lens[i] >= want || i === segs.length - 1) {
      const u = Math.min(1, Math.max(0, (want - acc) / Math.max(1e-6, lens[i])));
      const s = segs[i];
      return {
        x: s.a.x + (s.b.x - s.a.x) * u,
        y: s.a.y + (s.b.y - s.a.y) * u,
        z: s.a.z + (s.b.z - s.a.z) * u,
        yaw: Math.atan2(s.b.x - s.a.x, s.b.z - s.a.z),
      };
    }
    acc += lens[i];
  }
}

function driveAlong(pathId, { startFrac = 0, endFrac = 1, frames = 900, latch = null } = {}) {
  const a = pathPoint(pathId, startFrac);
  const b = pathPoint(pathId, endFrac);
  car.setPose(a.x, a.y + 0.02, a.z, a.yaw);
  car.speed = 0.9;
  car.crashed = false;
  tracks._lastPathId = latch || pathId;
  tracks._lastPathKind = byId[latch || pathId]?.kind || "floor";
  let onN = 0, maxY = a.y, maxJump = 0, flips = 0;
  let lastPath = tracks._lastPathId;
  let prev = { x: a.x, y: a.y, z: a.z };
  for (let f = 0; f < frames; f++) {
    const pos = car.position;
    const snap = tracks.querySnap(pos.x, pos.y, pos.z, 1.65, car.yaw);
    if (snap.onTrack && snap.yaw != null) {
      let dy = snap.yaw - car.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      car.yaw += dy * 0.35;
    }
    car.update(1 / 60, { forward: true, back: false, left: false, right: false, boost: false }, snap);
    const p = car.position;
    const jump = Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
    maxJump = Math.max(maxJump, jump);
    prev = { x: p.x, y: p.y, z: p.z };
    if (snap.onTrack) onN++;
    maxY = Math.max(maxY, p.y);
    if (snap.pathId && lastPath && snap.pathId !== lastPath) {
      const far = Math.hypot((snap.x ?? p.x) - p.x, (snap.z ?? p.z) - p.z) > 0.85;
      if (far) flips++;
      lastPath = snap.pathId;
    } else if (snap.pathId) lastPath = snap.pathId;
    // reached end neighborhood
    if (Math.hypot(p.x - b.x, p.z - b.z) < 0.55 && Math.abs(p.y - b.y) < 0.55) {
      return { ok: true, frames: f, onRate: onN / (f + 1), maxY, maxJump, flips, end: { ...p } };
    }
  }
  return { ok: false, frames, onRate: onN / frames, maxY, maxJump, flips, end: { ...car.position } };
}

// ── Tour ──────────────────────────────────────────────────────────
{
  const spawn = tracks.querySnap(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, 1.65);
  ok("spawn-onTrack", !!spawn.onTrack && spawn.kind === "floor",
    `path=${spawn.pathId}`);

  const spur = driveAlong("foyer_climb_spur", { frames: 400 });
  ok("tour-spur", spur.ok || spur.onRate > 0.7, `on=${(spur.onRate * 100) | 0}% jump=${spur.maxJump.toFixed(3)}`);

  // Climb from foot
  const foot = ramp.points[0];
  car.setPose(foot.x, foot.y + 0.03, foot.z, Math.atan2(0, -1));
  tracks._lastPathId = "foyer_climb_spur";
  tracks._lastPathKind = "floor";
  let maxY = foot.y, fell = 0, onN = 0;
  for (let f = 0; f < 1400; f++) {
    const pos = car.position;
    const snap = tracks.querySnap(pos.x, pos.y, pos.z, 1.65, car.yaw);
    if (snap.onTrack && snap.yaw != null) {
      let dy = snap.yaw - car.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      // prefer uphill
      car.yaw += dy * 0.4;
    }
    car.update(1 / 60, { forward: true, back: false, left: false, right: false, boost: false }, snap);
    if (snap.onTrack) onN++;
    maxY = Math.max(maxY, car.position.y);
    if (car.crashed || car.position.y < -0.5) { fell++; break; }
    if (maxY >= 3.9) break;
  }
  ok("tour-climb-crest", maxY >= 3.9 && fell === 0,
    `maxY=${maxY.toFixed(2)} on=${((onN / 1400) * 100) | 0}%`);

  const bal = driveAlong("ramp_landing_to_balcony", { latch: "landing_skirting", frames: 700 });
  ok("tour-to-balcony", bal.ok || bal.maxY >= 4.2,
    `ok=${bal.ok} maxY=${bal.maxY.toFixed(2)} on=${(bal.onRate * 100) | 0}%`);

  const loop = driveAlong("balcony_loop", { startFrac: 0, endFrac: 0.55, frames: 900 });
  ok("tour-balcony-loop", loop.onRate >= 0.55 && loop.maxJump < 0.55,
    `on=${(loop.onRate * 100) | 0}% jump=${loop.maxJump.toFixed(3)}`);

  const ret = driveAlong("ramp_balcony_return", { latch: "balcony_loop", frames: 700 });
  ok("tour-balcony-return", ret.ok || (ret.end.y >= 4.1 && ret.end.z < 11),
    `ok=${ret.ok} endY=${ret.end.y?.toFixed?.(2)} z=${ret.end.z?.toFixed?.(2)}`);
}

// ── No teleport ───────────────────────────────────────────────────
{
  tracks._lastPathId = "foyer_drive_start";
  tracks._lastPathKind = "floor";
  const mid = tracks.querySnap(-2.5, 0.08, 8.5, 1.65, Math.PI);
  ok("no-teleport-mid-foyer", mid.pathId !== "ramp_foyer_to_landing" || !mid.onTrack,
    `path=${mid.pathId}`);

  car.setPose(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, CAR_SPAWN.yaw);
  tracks._lastPathId = "foyer_drive_start";
  let maxExcess = 0, badFlips = 0;
  let prev = { x: car.position.x, y: car.position.y, z: car.position.z };
  let last = "foyer_drive_start";
  for (let f = 0; f < 240; f++) {
    const steer = Math.sin(f * 0.17) * 0.55;
    const snap = tracks.querySnap(car.position.x, car.position.y, car.position.z, 1.65, car.yaw);
    car.update(1 / 60, {
      forward: true, back: false,
      left: steer < -0.15, right: steer > 0.15, boost: false,
    }, snap);
    const p = car.position;
    const d = Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
    maxExcess = Math.max(maxExcess, Math.max(0, d - 0.12));
    if (snap.pathId && last && snap.pathId !== last) {
      const yank = Math.hypot((snap.x ?? p.x) - p.x, (snap.z ?? p.z) - p.z);
      if (yank > 0.85) badFlips++;
      last = snap.pathId;
    }
    prev = { x: p.x, y: p.y, z: p.z };
  }
  ok("no-teleport-noisy-cruise", badFlips === 0 && maxExcess < 0.35,
    `flips=${badFlips} excess=${maxExcess.toFixed(4)}`);

  const esc = tracks.findEscapeSnap(CAR_SPAWN.x + 0.4, CAR_SPAWN.y, CAR_SPAWN.z, 2.4);
  const escD = esc ? Math.hypot(esc.x - (CAR_SPAWN.x + 0.4), esc.z - CAR_SPAWN.z) : 99;
  ok("escape-no-room-cross", !esc || escD <= 1.15, `d=${escD.toFixed(3)} path=${esc?.pathId}`);
}

// ── Pillar HARD ───────────────────────────────────────────────────
{
  const cols = mansion.colliders || mansion.getColliders?.() || [];
  const pillars = cols.filter((c) => c.driveKind === "pillar");
  ok("pillars-tagged", pillars.length >= 1, `n=${pillars.length}`);
  // Soft-raise must not apply to pillars in DriveMode
  const soft = drive._driveSoftCollider(pillars[0].clone());
  ok("pillar-not-soft-raised",
    Math.abs(soft.min.y - pillars[0].min.y) < 1e-6
    && Math.abs(soft.max.x - pillars[0].max.x) < 1e-6,
    `kind=${soft.driveKind}`);
}

// ── Climb collider centerline (inline) ────────────────────────────
{
  const cols = mansion.getColliders();
  const halfW = ramp.width * 0.5;
  const curvePts = ramp.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  const curve = new THREE.CatmullRomCurve3(curvePts, false, "catmullrom", 0.22);
  const samples = curve.getPoints(100);
  let hardHits = 0;
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i];
    const j = Math.min(i + 1, samples.length - 1);
    const tx = samples[j].x - p.x, tz = samples[j].z - p.z;
    const tl = Math.hypot(tx, tz) || 1;
    const rx = -tz / tl, rz = tx / tl;
    for (const lat of [0, halfW * 0.85, -halfW * 0.85]) {
      const x = p.x + rx * lat, z = p.z + rz * lat;
      for (const yOff of [0.22, 0.48]) {
        const y = p.y + yOff;
        for (const c of cols) {
          if (c.driveKind !== "wall" && c.driveKind !== "pillar") continue;
          const minX = c.min?.x ?? c.minX, maxX = c.max?.x ?? c.maxX;
          const minY = c.min?.y ?? c.minY, maxY = c.max?.y ?? c.maxY;
          const minZ = c.min?.z ?? c.minZ, maxZ = c.max?.z ?? c.maxZ;
          if (x >= minX && x <= maxX && y >= minY && y <= maxY && z >= minZ && z <= maxZ) {
            hardHits++;
          }
        }
      }
    }
  }
  ok("climb-centerline-0-hard-hits", hardHits === 0, `hits=${hardHits}`);
}

// ── Explore ↔ Drive handoff ───────────────────────────────────────
{
  drive.enter();
  ok("enter-active", drive.active === true);
  ok("enter-tracks-drive", tracks._visMode === "drive" && tracks.root.visible);
  ok("enter-audio-started", !!drive._engineAudio);
  const fovDrive = camera.fov;
  drive.exit();
  ok("exit-inactive", drive.active === false);
  ok("exit-tracks-explore", tracks._visMode === "explore");
  ok("exit-fill-lights-off",
    !drive._fillLight.visible && !drive._climbFill.visible && !drive._climbMidFill.visible);
  ok("exit-fov-restored", Math.abs(camera.fov - drive._baseFov) < 0.01,
    `fov=${camera.fov} base=${drive._baseFov} (was drive ${fovDrive})`);
  ok("exit-car-parked",
    Math.hypot(car.position.x - CAR_SPAWN.x, car.position.z - CAR_SPAWN.z) < 0.05
    && car.speed === 0);
  // Keys should be clear
  ok("exit-keys-clear", !drive.keys.forward && !drive.keys.boost);
}

// Binary carpet
{
  tracks._lastPathId = null;
  const carpet = tracks.querySnap(0, 0.045, 6, 1.65);
  ok("binary-carpet", carpet.carpet === true && carpet.onTrack === false && carpet.supported === true,
    `on=${carpet.onTrack} carpet=${carpet.carpet}`);
}

console.log("\n" + (fails.length ? `FAILED ${fails.length}` : "ALL FROM-SCRATCH DRIVE SIMS PASSED"));
if (fails.length) {
  for (const f of fails) console.log("  ", f);
  process.exit(1);
}
