/**
 * No track-to-track teleport proof:
 * Drive foyer_drive_start with noisy steer — pathId must not flip to distant paths;
 * per-frame position delta capped (no ribbon yank).
 */
import * as THREE from "./vendor/three.module.js";
import { TrackSystem } from "./js/drive/tracks.js";
import { RCCar } from "./js/drive/car.js";
import { TRACK_PATHS, CAR_SPAWN, ROAD_WIDTH_SCALE } from "./js/data/tracks.js";

const fails = [];
const ok = (name, pass, detail = "") => {
  const line = pass ? `PASS  ${name}${detail ? " — " + detail : ""}` : `FAIL  ${name}${detail ? " — " + detail : ""}`;
  console.log(line);
  if (!pass) fails.push(line);
};

const scene = new THREE.Scene();
const tracks = new TrackSystem(scene);
const car = new RCCar(scene);

const byPath = new Map();
for (const s of tracks.segments) {
  if (!byPath.has(s.pathId)) byPath.set(s.pathId, []);
  byPath.get(s.pathId).push(s);
}

function pathPoint(pathId, tFrac) {
  const segs = byPath.get(pathId);
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
        y: s.a.y,
        z: s.a.z + (s.b.z - s.a.z) * u,
        yaw: Math.atan2(s.b.x - s.a.x, s.b.z - s.a.z),
      };
    }
    acc += lens[i];
  }
}

// Static: sticky drive_start must not latch door_/distant skirting via apron
{
  tracks._lastPathId = "foyer_drive_start";
  tracks._lastPathKind = "floor";
  const s = tracks.querySnap(-3.35, 0.08, 11.5, 1.65, Math.PI);
  ok("apron no door latch", s.pathId === "foyer_drive_start" || s.pathId == null || s.pathId === "foyer_drive_start",
    `path=${s.pathId} on=${s.onTrack} d=${s.dist?.toFixed?.(3)}`);
  ok("apron no distant magnet", Math.hypot(s.x + 3.35, s.z - 11.5) < 0.85,
    `dXZ=${Math.hypot(s.x + 3.35, s.z - 11.5).toFixed(3)}`);
}

// Mid-foyer cruise: must not snap to climb when far from foot
{
  tracks._lastPathId = "foyer_drive_start";
  tracks._lastPathKind = "floor";
  const s = tracks.querySnap(-2.5, 0.08, 8.5, 1.65, Math.PI);
  ok("mid-foyer not climb", s.pathId !== "ramp_foyer_to_landing" || !s.onTrack,
    `path=${s.pathId} on=${s.onTrack}`);
}

// Intentional foot still mounts
{
  tracks._lastPathId = "foyer_climb_spur";
  tracks._lastPathKind = "floor";
  const ramp = TRACK_PATHS.find((q) => q.id === "ramp_foyer_to_landing");
  const ft = ramp.points[0];
  const s = tracks.querySnap(ft.x, 0.08, ft.z, 1.65, -1.0);
  ok("climb foot mounts", s.pathId === "ramp_foyer_to_landing" && (s.onTrack || s.nearDeck),
    `path=${s.pathId} on=${s.onTrack} near=${s.nearDeck}`);
}

// Drive along foyer_drive_start with noisy steer
tracks._lastPathId = "foyer_drive_start";
tracks._lastPathKind = "floor";
const start = pathPoint("foyer_drive_start", 0.05);
car.root.position.set(start.x, 0.09, start.z);
car.yaw = start.yaw;
car.speed = 1.35;

const distant = new Set([
  "door_foyer_outdoor", "door_foyer_hall_east", "door_foyer_hall_west",
  "cabinet_skirting", "landing_skirting", "balcony_loop",
]);
let lastPath = "foyer_drive_start";
let badFlips = 0;
let maxExcess = 0;
const flipLog = [];
const dt = 1 / 60;
const allowedNear = new Set(["foyer_drive_start", "foyer_skirting", "foyer_climb_spur", "ramp_foyer_to_landing"]);

for (let i = 0; i < 720; i++) {
  const p = car.root.position;
  const prev = { x: p.x, y: p.y, z: p.z };
  const snap = tracks.querySnap(p.x, p.y, p.z, 1.65, car.yaw);
  const keys = {
    forward: true, back: false,
    left: Math.sin(i * 0.23) > 0.28,
    right: Math.sin(i * 0.23 + 1.9) > 0.32,
    boost: false,
  };
  car.update(dt, keys, snap);
  const delta = Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
  const expect = Math.abs(car.speed) * dt + 0.012; // tiny magnet/wall slack
  const excess = delta - expect;
  if (excess > maxExcess) maxExcess = excess;

  const pid = snap?.pathId;
  if (pid && pid !== lastPath) {
    const jump = Math.hypot((snap.x ?? prev.x) - prev.x, (snap.z ?? prev.z) - prev.z);
    // Bad: flip to distant path OR jump-to-center > 0.9m while claiming onTrack
    const isDistant = distant.has(pid) || (jump > 1.2 && pid !== "ramp_foyer_to_landing");
    const farMagnet = snap.onTrack && jump > 0.9 && !allowedNear.has(pid);
    if (isDistant || farMagnet) {
      badFlips++;
      flipLog.push({ i, from: lastPath, to: pid, jump: +jump.toFixed(3), on: snap.onTrack });
    }
    lastPath = pid;
  } else if (pid) lastPath = pid;

  // Stay in foyer band for this cruise test
  if (p.z < 3.5) break;
}

ok("no distant path flips", badFlips === 0, `badFlips=${badFlips} log=${JSON.stringify(flipLog.slice(0, 5))}`);
ok("frame delta capped", maxExcess < 0.22, `maxExcess=${maxExcess.toFixed(4)}`);

// Escape must not yank >1.2m to other path from drive_start
{
  tracks._lastPathId = "foyer_drive_start";
  const pt = pathPoint("foyer_drive_start", 0.4);
  const esc = tracks.findEscapeSnap(pt.x + 0.7, pt.y, pt.z, 4.5);
  const d = esc ? Math.hypot(esc.x - (pt.x + 0.7), esc.z - pt.z) : 0;
  ok("escape same-path / short", !esc || d < 1.2, `path=${esc?.pathId} d=${d.toFixed(3)}`);
}

const driveW = TRACK_PATHS.find((p) => p.id === "foyer_drive_start")?.width;
const skirtW = TRACK_PATHS.find((p) => p.id === "foyer_skirting")?.width;
const rampW = TRACK_PATHS.find((p) => p.id === "ramp_foyer_to_landing")?.width;
console.log("widths post-scale", { ROAD_WIDTH_SCALE, driveW, skirtW, rampW });

if (fails.length) {
  console.error(`\n${fails.length} FAIL(s)`);
  process.exit(1);
}
console.log("\nALL no-teleport checks PASS");
