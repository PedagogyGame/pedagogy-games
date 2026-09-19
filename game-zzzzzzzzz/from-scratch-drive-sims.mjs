/**
 * Figure-8 expert lap proofs (geometry + light drive).
 * Parent live-proves; this is not a ready claim.
 */
import * as THREE from "./vendor/three.module.js";
import { Mansion } from "./js/mansion.js";
import { DriveMode } from "./js/drive/driveMode.js";
import { CAR_SCALE } from "./js/drive/car.js";
import {
  TRACK_PATHS, CAR_SPAWN, PRIMARY_CIRCUIT, RAMP_MAX_GRADE, ROAD_WIDTH_SCALE,
} from "./js/data/tracks.js";

const fails = [];
const ok = (name, pass, detail = "") => {
  console.log((pass ? "PASS  " : "FAIL  ") + name + (detail ? " — " + detail : ""));
  if (!pass) fails.push(name);
};

const byId = Object.fromEntries(TRACK_PATHS.map((p) => [p.id, p]));

ok("primary-only",
  TRACK_PATHS.length === PRIMARY_CIRCUIT.length
  && TRACK_PATHS.every((p) => PRIMARY_CIRCUIT.includes(p.id) && !p.disabled),
  `n=${TRACK_PATHS.length}`);
ok("car-scale", Math.abs(CAR_SCALE - 0.19) < 1e-6, `CAR_SCALE=${CAR_SCALE}`);
ok("width-scale", ROAD_WIDTH_SCALE === 1.0, `scale=${ROAD_WIDTH_SCALE}`);

for (const p of TRACK_PATHS) {
  ok(`width-band-${p.id}`, p.width >= 2.2 - 1e-6 && p.width <= 3.5 + 1e-6, `w=${p.width}`);
}

function gradeStats(path) {
  const pts = path.points;
  let flat = 0, maxSeg = 0;
  for (let i = 1; i < pts.length; i++) {
    const run = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) || 1e-6;
    flat += run;
    maxSeg = Math.max(maxSeg, Math.abs(pts[i].y - pts[i - 1].y) / run);
  }
  const rise = Math.abs(pts.at(-1).y - pts[0].y);
  return { flat, rise, mean: rise / flat, maxSeg };
}

for (const id of ["climb_a", "climb_b"]) {
  const g = gradeStats(byId[id]);
  ok(`${id}-grade-le-30`,
    g.mean <= RAMP_MAX_GRADE + 1e-3 && g.maxSeg <= RAMP_MAX_GRADE + 0.02,
    `mean=${g.mean.toFixed(3)} maxSeg=${g.maxSeg.toFixed(3)} flat=${g.flat.toFixed(2)}`);
}

const kisses = [
  ["foyer_to_climb_a", -1, "climb_a", 0],
  ["climb_a", -1, "landing_hairpin", 0],
  ["landing_hairpin", -1, "balcony_loop", 0],
  ["balcony_to_climb_b", -1, "climb_b", 0],
  ["climb_b", -1, "foyer_finish", 0],
  ["foyer_finish", -1, "foyer_oval", 0],
];
for (const [a, ai, b, bi] of kisses) {
  const pa = byId[a].points.at(ai), pb = byId[b].points.at(bi);
  const d = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
  ok(`kiss-${a}->${b}`, d < 0.05, `d=${d.toFixed(4)}`);
}

ok("climb-a-corridor-east-of-stairs", Math.abs(byId.climb_a.points[0].x - (-5.0)) < 0.05,
  `footX=${byId.climb_a.points[0].x}`);
ok("climb-b-corridor-at-x7", Math.abs(byId.climb_b.points[0].x - 7.0) < 0.05,
  `crestX=${byId.climb_b.points[0].x}`);

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
    total += L; return L;
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
  if (!a || !b) return { ok: false, onRate: 0, maxJump: 99 };
  car.setPose(a.x, a.y + 0.02, a.z, a.yaw);
  car.speed = 0.9;
  car.crashed = false;
  tracks._lastPathId = latch || pathId;
  tracks._lastPathKind = byId[latch || pathId]?.kind || "floor";
  let onN = 0, maxY = a.y, maxJump = 0;
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
    maxJump = Math.max(maxJump, Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z));
    prev = { x: p.x, y: p.y, z: p.z };
    if (snap.onTrack) onN++;
    maxY = Math.max(maxY, p.y);
    if (Math.hypot(p.x - b.x, p.z - b.z) < 0.65 && Math.abs(p.y - b.y) < 0.65) {
      return { ok: true, onRate: onN / (f + 1), maxY, maxJump };
    }
  }
  return { ok: false, onRate: onN / frames, maxY, maxJump };
}

{
  const spawn = tracks.querySnap(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, 1.65);
  ok("spawn-onTrack", !!spawn.onTrack && (spawn.kind === "floor" || spawn.kind === "floor"),
    `path=${spawn.pathId} kind=${spawn.kind}`);

  const oval = driveAlong("foyer_oval", { endFrac: 0.35, frames: 700 });
  ok("drive-oval", oval.onRate > 0.55 && oval.maxJump < 0.55,
    `on=${(oval.onRate * 100) | 0}% jump=${oval.maxJump.toFixed(3)}`);

  const spur = driveAlong("foyer_to_climb_a", { frames: 500, latch: "foyer_to_climb_a" });
  ok("drive-spur", spur.ok || spur.onRate > 0.45, `on=${(spur.onRate * 100) | 0}%`);

  const foot = byId.climb_a.points[0];
  car.setPose(foot.x, foot.y + 0.03, foot.z, Math.atan2(0, -1));
  tracks._lastPathId = "foyer_to_climb_a";
  tracks._lastPathKind = "floor";
  let maxY = foot.y, fell = 0, onN = 0;
  for (let f = 0; f < 1600; f++) {
    const pos = car.position;
    const snap = tracks.querySnap(pos.x, pos.y, pos.z, 1.65, car.yaw);
    if (snap.onTrack && snap.yaw != null) {
      let dy = snap.yaw - car.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      car.yaw += dy * 0.4;
    }
    car.update(1 / 60, { forward: true, back: false, left: false, right: false, boost: false }, snap);
    if (snap.onTrack) onN++;
    maxY = Math.max(maxY, car.position.y);
    if (car.crashed || car.position.y < -0.5) { fell++; break; }
    if (maxY >= 3.9) break;
  }
  ok("drive-climb-a-crest", maxY >= 3.9 && fell === 0,
    `maxY=${maxY.toFixed(2)} on=${((onN / 1600) * 100) | 0}%`);

  const hair = driveAlong("landing_hairpin", { latch: "climb_a", frames: 1000 });
  ok("drive-hairpin", hair.onRate >= 0.45 && hair.maxJump < 0.6,
    `on=${(hair.onRate * 100) | 0}% jump=${hair.maxJump.toFixed(3)}`);

  const loop = driveAlong("balcony_loop", { startFrac: 0.05, endFrac: 0.55, frames: 1200, latch: "balcony_loop" });
  ok("drive-balcony", loop.onRate >= 0.40 && loop.maxJump < 0.65,
    `on=${(loop.onRate * 100) | 0}% jump=${loop.maxJump.toFixed(3)}`);

  {
    tracks._lastPathId = "climb_b";
    tracks._lastPathKind = "ramp";
    const segs = tracks.segments.filter((s) => s.pathId === "climb_b");
    let onN2 = 0, y0 = null, y1 = null, hard = 0;
    const hardCols = mansion.getColliders().filter((c) => c.driveKind === "wall" || c.driveKind === "pillar");
    for (const s of segs) {
      for (const u of [0, 0.5, 1]) {
        const x = s.a.x + (s.b.x - s.a.x) * u;
        const y = s.a.y + (s.b.y - s.a.y) * u;
        const z = s.a.z + (s.b.z - s.a.z) * u;
        if (y0 == null) y0 = y;
        y1 = y;
        const snap = tracks.querySnap(x, y + 0.05, z, 1.65);
        if (snap.onTrack && snap.pathId === "climb_b") onN2++;
        for (const c of hardCols) {
          if (x > c.min.x && x < c.max.x && y + 0.3 > c.min.y && y + 0.3 < c.max.y
              && z > c.min.z && z < c.max.z) hard++;
        }
      }
    }
    const samples = Math.max(1, segs.length * 3);
    ok("drive-climb-b-ribbon",
      onN2 >= samples * 0.85 && hard === 0 && y1 < 0.35 && y0 > 3.5,
      `on=${onN2}/${samples} hard=${hard} y0=${y0?.toFixed?.(2)} y1=${y1?.toFixed?.(2)}`);
  }

  const fin = driveAlong("foyer_finish", { latch: "climb_b", frames: 800 });
  ok("drive-finish", fin.ok || fin.onRate > 0.5, `ok=${fin.ok} on=${(fin.onRate * 100) | 0}%`);
}

{
  const holesF = mansion._storyApertures({ id: "foyer" }, "ceiling");
  const holesL = mansion._storyApertures({ id: "landing" }, "floor");
  ok("dual-holes-foyer", holesF.length === 2, `n=${holesF.length}`);
  ok("dual-holes-landing", holesL.length === 2, `n=${holesL.length}`);
  ok("holes-opposite", holesF[0].maxX < 0 && holesF[1].minX > 0, "west+east");
}

{
  const cols = mansion.getColliders();
  const newels = cols.filter((c) => c.driveKind === "pillar"
    && c.min.x < -5.2 && c.max.x > -5.8 && c.min.y >= 4.0);
  ok("landing-newel", newels.length >= 1, `n=${newels.length}`);
}

{
  tracks._lastPathId = "foyer_oval";
  tracks._lastPathKind = "floor";
  const mid = tracks.querySnap(0, 0.08, 6.0, 1.65, Math.PI);
  ok("no-teleport-mid-foyer", mid.pathId !== "climb_a" || !mid.onTrack, `path=${mid.pathId}`);
}

// Mesh budget when Drive builds ribbons
{
  tracks.ensureMeshes();
  let meshCount = 0;
  tracks.root.traverse((o) => { if (o.isMesh) meshCount++; });
  ok("gpu-lite-meshes", meshCount <= 40, `meshes=${meshCount}`);
}

console.log(fails.length ? `\n${fails.length} FAIL(s)` : "\nALL PASS");
process.exit(fails.length ? 1 : 0);
