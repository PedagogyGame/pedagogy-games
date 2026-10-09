/**
 * No track-to-track teleport proof (figure-8 primary circuit):
 * Drive foyer_sf with noisy steer — pathId must not flip to distant climbs;
 * per-frame position delta capped (no ribbon yank). Never teleports.
 * logic6: + full DriveMode (walls) step-ratio checks — no frame may move the car more than
 *   1.5× speed·dt (+4 mm) on a held-W pursuit lap, a release at the Climb A foot handoff,
 *   and the Climb B foot handoff. Catches the logic3–5 foot surge (0.129u in one frame @1.21u/s).
 */
import * as THREE from "./vendor/three.module.js";
import { TrackSystem } from "./js/drive/tracks.js";
import { RCCar } from "./js/drive/car.js";
import { TRACK_PATHS, CAR_SPAWN, PRIMARY_CIRCUIT } from "./js/data/tracks.js";
import { Mansion } from "./js/mansion.js";
import { DriveMode } from "./js/drive/driveMode.js";
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
      : { style: {}, classList: { add() {}, remove() {} }, appendChild() {},
          addEventListener() {}, removeEventListener() {},
          textContent: "", id: "", className: "", remove() {} },
    addEventListener() {}, removeEventListener() {},
    getElementById: () => null, querySelector: () => null,
    head: { appendChild() {} }, body: { appendChild() {} },
  };
}
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (typeof globalThis.performance === "undefined") {
  globalThis.performance = { now: () => Date.now() };
}

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

// Apron / off-spur: sticky foyer_sf must not latch climb_a from afar
{
  tracks._lastPathId = "foyer_sf";
  tracks._lastPathKind = "floor";
  // logic3: (-3.35,11.5) is now ON the Climb A west foot leg — probe a ground car on the
  // foyer floor BESIDE the climb straight instead (2u east of x=-5, 1.1u below the deck).
  const s = tracks.querySnap(-3.0, 0.08, 8.6, 1.65, Math.PI);
  ok(
    "apron-no-climb-latch",
    s.pathId !== "climb_a" || !s.onTrack,
    `path=${s.pathId} on=${s.onTrack}`
  );
  const dXZ = s.onTrack ? Math.hypot((s.x ?? -3.0) + 3.0, (s.z ?? 8.6) - 8.6) : 0; // off-ribbon → no magnet at all
  ok("apron-no-distant-magnet", dXZ < 1.25, `dXZ=${dXZ.toFixed(3)}`);
}

// Mid-foyer cruise: must not snap onto climb when far from foot
{
  tracks._lastPathId = "foyer_sf";
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

// Drive along foyer_sf with noisy steer — no distant flips / no yank
tracks._lastPathId = "foyer_sf";
tracks._lastPathKind = "floor";
const start = pathPoint("foyer_sf", 0.05);
car.setPose(start.x, start.y + 0.012, start.z, start.yaw);
car.speed = 1.15;

const distant = new Set([
  "climb_a", "climb_b", "landing_hairpin", "balcony_arc", "balcony_to_climb_b",
]);
let lastPath = "foyer_sf";
let badFlips = 0;
let maxExcess = 0;
const dt = 1 / 60;
const allowedNear = new Set([
  "foyer_sf", "foyer_to_climb_a", "foyer_finish",
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

// ── logic6: per-frame step ≤ 1.5 × speed·dt through every handoff (full DriveMode, walls) ──
{
  const scene2 = new THREE.Scene();
  const cam2 = new THREE.PerspectiveCamera(68, 2, 0.08, 240);
  const mansion2 = new Mansion(scene2);
  const drive = new DriveMode(scene2, cam2);
  drive.setWallColliders(mansion2.getColliders());
  const byId2 = Object.fromEntries(TRACK_PATHS.map((q) => [q.id, q]));
  const line = [];
  for (const id of PRIMARY_CIRCUIT) {
    const pts = byId2[id].points.map((q) => new THREE.Vector3(q.x, q.y, q.z));
    const curve = pts.length >= 3 ? new THREE.CatmullRomCurve3(pts, false, "catmullrom", byId2[id].tension ?? 0.15) : null;
    const L = curve ? curve.getLength() : pts[0].distanceTo(pts[1]);
    const sp = curve ? curve.getSpacedPoints(Math.max(2, Math.ceil(L / 0.05))) : [pts[0], pts[1]];
    for (let i = line.length ? 1 : 0; i < sp.length; i++) line.push({ p: sp[i], id });
  }
  const STEP_RATIO = 1.5, EPS = 0.004;
  const run = (label, { frames, releaseAt = null, startIdx = 0, pose = null, dt = 1 / 60 }) => {
    drive.enter();
    if (pose) {
      drive.tracks._lastPathId = pose.path; drive.tracks._lastPathKind = "floor";
      drive.car.setPose(pose.x, pose.y, pose.z, pose.yaw);
      drive.car.speed = pose.v ?? 0;
      drive._snapCamera(true);
    }
    drive.keys = { forward: true, back: false, left: false, right: false, boost: false };
    const car2 = drive.car;
    let idx = startIdx, worst = { ratio: 0 }, bad = 0, released = false;
    for (let f = 0; f < frames; f++) {
      const pos = car2.position;
      let best = idx, bd = Infinity;
      for (let k = idx; k < Math.min(line.length, idx + 60); k++) {
        const q = line[k].p;
        const d = Math.hypot(q.x - pos.x, (q.y - pos.y) * 2, q.z - pos.z);
        if (d < bd) { bd = d; best = k; }
      }
      idx = best;
      const look = line[Math.min(line.length - 1, idx + 14)].p;
      let d = Math.atan2(look.x - pos.x, look.z - pos.z) - car2.yaw;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      drive.keys.left = d > 0.03; drive.keys.right = d < -0.03;
      if (releaseAt && !released && releaseAt(pos)) { drive.keys.forward = false; released = true; }
      const px = pos.x, pz = pos.z, v0 = Math.abs(car2.speed);
      drive.update(dt);
      if (drive._crashPhase || car2.crashed) break;
      const step = Math.hypot(car2.position.x - px, car2.position.z - pz);
      const vRef = Math.max(v0, Math.abs(car2.speed));
      const allow = STEP_RATIO * vRef * dt + EPS;
      const ratio = step / Math.max(1e-6, vRef * dt);
      if (step > allow) bad++;
      if (step > EPS && ratio > worst.ratio) worst = { ratio, step, v: vRef, x: car2.position.x, z: car2.position.z, path: drive.tracks._lastPathId, f };
      if (idx >= line.length - 3 || (released && car2.speed < 1e-4)) break;
    }
    ok(label, bad === 0,
      `badFrames=${bad} worst=${worst.ratio.toFixed(2)}× step=${(worst.step || 0).toFixed(4)} v=${(worst.v || 0).toFixed(3)} @${(worst.x ?? 0).toFixed(2)},${(worst.z ?? 0).toFixed(2)} ${worst.path || ""}`);
    drive.exit();
  };
  run("step-ratio-pursuit-lap", { frames: 60 * 90 });
  run("step-ratio-climb-a-foot-release", { frames: 60 * 8, releaseAt: (p) => p.x < -1.45 });
  run("step-ratio-climb-a-foot-30fps", { frames: 30 * 6, dt: 1 / 30 });
  // Climb B foot handoff (climb_b → foyer_finish): start on the descent and run to the S/F line
  const iB = line.findIndex((q) => q.id === "climb_b" && q.p.y < 1.2);
  const pB = line[iB].p, qB = line[iB + 2].p;
  run("step-ratio-climb-b-foot", { frames: 60 * 8, startIdx: iB,
    pose: { x: pB.x, y: pB.y + 0.012, z: pB.z, yaw: Math.atan2(qB.x - pB.x, qB.z - pB.z), path: "climb_b", v: 1.2 } });
}

console.log(fails.length ? `\n${fails.length} FAIL(s)` : "\nALL PASS");
process.exit(fails.length ? 1 : 0);
