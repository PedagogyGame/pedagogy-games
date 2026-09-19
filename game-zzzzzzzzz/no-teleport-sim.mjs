/**
 * No track-to-track teleport proof (figure-8 primary circuit):
 * Drive foyer_oval with noisy steer — pathId must not flip to distant climbs;
 * per-frame position delta capped (no ribbon yank). Never teleports.
 */
import * as THREE from "./vendor/three.module.js";
import { TrackSystem } from "./js/drive/tracks.js";
import { RCCar } from "./js/drive/car.js";
import { TRACK_PATHS, CAR_SPAWN } from "./js/data/tracks.js";

const fails = [];
const ok = (name, pass, detail = "") => {
  const line = pass ? `PASS  ${name}${detail ? " — " + detail : ""}` : `FAIL  ${name}${detail ? " — " + detail : ""}`;
  console.log(line);
  if (!pass) fails.push(line);
};

const scene = new THREE.Scene();
const tracks = new TrackSystem(scene);
const car = new RCCar("car");
scene.add(car.root);

const byPath = new Map();
for (const s of tracks.segments) {
  if (!byPath.has(s.pathId)) byPath.set(s.pathId, []);
  byPath.get(s.pathId).push(s);
}

function pathPoint(pathId, tFrac) {
  const segs = byPath.get(pathId);
  if (!segs || !segs.length) return { x: CAR_SPAWN.x, y: CAR_SPAWN.y, z: CAR_SPAWN.z, yaw: CAR_SPAWN.yaw };
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

// Apron / off-spur: sticky foyer_oval must not latch climb_a from afar
{
  tracks._lastPathId = "foyer_oval";
  tracks._lastPathKind = "floor";
  const s = tracks.querySnap(-3.35, 0.08, 11.5, 1.65, Math.PI);
  ok(
    "apron-no-climb-latch",
    s.pathId !== "climb_a" || !s.onTrack,
    `path=${s.pathId} on=${s.onTrack}`
  );
  const dXZ = Math.hypot((s.x ?? -3.35) + 3.35, (s.z ?? 11.5) - 11.5);
  ok("apron-no-distant-magnet", dXZ < 1.25, `dXZ=${dXZ.toFixed(3)}`);
}

// Mid-foyer cruise: must not snap onto climb when far from foot
{
  tracks._lastPathId = "foyer_oval";
  tracks._lastPathKind = "floor";
  const s = tracks.querySnap(0.0, 0.08, 6.5, 1.65, -Math.PI / 2);
  ok(
    "mid-foyer-not-climb",
    s.pathId !== "climb_a" || !s.onTrack,
    `path=${s.pathId} on=${s.onTrack}`
  );
}

// Intentional Climb A foot still mounts
{
  tracks._lastPathId = "foyer_to_climb_a";
  tracks._lastPathKind = "floor";
  const ramp = TRACK_PATHS.find((q) => q.id === "climb_a");
  const ft = ramp.points[0];
  const s = tracks.querySnap(ft.x, 0.08, ft.z, 1.65, Math.atan2(0, -1));
  ok(
    "climb-a-foot-mounts",
    s.pathId === "climb_a" && (s.onTrack || s.nearDeck),
    `path=${s.pathId} on=${s.onTrack} near=${s.nearDeck}`
  );
}

// Drive along foyer_oval with noisy steer — no distant flips / no yank
tracks._lastPathId = "foyer_oval";
tracks._lastPathKind = "floor";
const start = pathPoint("foyer_oval", 0.05);
car.setPose(start.x, start.y + 0.012, start.z, start.yaw);
car.speed = 1.15;

const distant = new Set([
  "climb_a", "climb_b", "landing_hairpin", "balcony_loop", "balcony_to_climb_b",
]);
let lastPath = "foyer_oval";
let badFlips = 0;
let maxExcess = 0;
const dt = 1 / 60;
const allowedNear = new Set([
  "foyer_oval", "foyer_to_climb_a", "foyer_finish",
]);

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
  const expect = Math.abs(car.speed) * dt + 0.05;
  const excess = delta - expect;
  if (excess > maxExcess) maxExcess = excess;

  const pid = snap?.pathId;
  if (pid && pid !== lastPath) {
    if (distant.has(pid) && !allowedNear.has(pid)) {
      // Only count as bad if jump is large (true teleport), not a natural spur kiss
      const jump = Math.hypot((snap.x ?? prev.x) - prev.x, (snap.z ?? prev.z) - prev.z);
      if (jump > 1.5) badFlips++;
    }
    lastPath = pid;
  }
}

ok("noisy-drive-no-distant-teleport", badFlips === 0, `badFlips=${badFlips}`);
ok("noisy-drive-no-yank", maxExcess < 0.55, `maxExcess=${maxExcess.toFixed(3)}`);

console.log(fails.length ? `\n${fails.length} FAIL(s)` : "\nALL PASS");
process.exit(fails.length ? 1 : 0);
