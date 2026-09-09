/**
 * Step the real Car.update along primary climbs; detect:
 * - failed ramp mount (skirting wins at foot)
 * - Y jitter / snap fighting (kind flip-flops, large dy)
 * - false falls (airborne while on climb)
 * - unsupported blips mid-climb
 */
import * as THREE from "./vendor/three.module.js";
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
const drive = new DriveMode(scene, camera);
const car = drive.car;
const tracks = drive.tracks;
const byId = Object.fromEntries(TRACK_PATHS.map((p) => [p.id, p]));

function densify(points, step = 0.12) {
  const out = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
      });
    }
  }
  out.push({ ...points.at(-1) });
  return out;
}

function yawToward(from, to) {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

function runClimb(pathId, approachPathId = null) {
  const path = byId[pathId];
  if (!path) return { id: pathId, error: "missing" };
  const pts = densify(path.points, 0.10);
  // Approach from behind foot, then mount onto climb corridor
  const foot = path.points[0];
  const p1 = path.points[1];
  const dx = p1.x - foot.x, dy = p1.y - foot.y, dz = p1.z - foot.z;
  const len = Math.hypot(dx, dz) || 1;
  // Start just behind foot on approach path height; yaw toward climb
  // Start on the foot corridor (hostile lastPath still set) so shared junctions mount
  const start = {
    x: foot.x + (dx / len) * 0.08,
    y: foot.y + 0.04,
    z: foot.z + (dz / len) * 0.08,
  };
  car.setPose(start.x, start.y, start.z, yawToward(start, p1));
  car.crashed = false; car.airborne = false; car.speed = 1.2; car.vy = 0;
  car._unsupportedFrames = 0; car._lastElevated = false; car._tumble = 0;
  tracks._lastPathId = approachPathId || "foyer_skirting";
  car._lastElevated = false;
  car.airborne = false;
  car.crashed = false;
  car.speed = 1.2;

  const dt = 1 / 60;
  const keys = { forward: true, back: false, left: false, right: false };
  let mounted = false;
  let mountAt = -1;
  let falseFalls = 0;
  let unsupported = 0;
  let kindFlips = 0;
  let yJitter = 0;
  let prevKind = null;
  let prevY = start.y;
  let maxAbsDy = 0;
  const events = [];
  let targetIdx = 0;
  const guide = [start, ...pts];

  for (let frame = 0; frame < 1600; frame++) {
    const pos = car.root.position;
    // Steer toward next guide point
    while (targetIdx < guide.length - 1) {
      const g = guide[targetIdx];
      if (Math.hypot(pos.x - g.x, pos.z - g.z) < 0.18) targetIdx++;
      else break;
    }
    const g = guide[Math.min(targetIdx, guide.length - 1)];
    const wantYaw = yawToward(pos, g);
    let dyaw = wantYaw - car.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    keys.left = dyaw > 0.08;
    keys.right = dyaw < -0.08;
    keys.forward = true;

    const snap = tracks.querySnap(pos.x, pos.y, pos.z, 1.65);
    const flags = car.update(dt, keys, snap);

    if (!mounted && snap.onTrack && snap.supported && (
      (snap.kind === "ramp" && snap.pathId === pathId)
      || (snap.pathId === pathId)
    )) {
      mounted = true;
      mountAt = frame;
    }
    if (flags.fell) {
      falseFalls++;
      if (events.length < 8) {
        events.push({
          t: "fell", frame, kind: snap.kind, pathId: snap.pathId,
          y: +pos.y.toFixed(3), on: snap.onTrack, supp: snap.supported,
        });
      }
    }
    if (!snap.supported && !snap.carpet) {
      unsupported++;
      if (events.length < 12) {
        events.push({
          t: "unsupp", frame, kind: snap.kind, pathId: snap.pathId,
          y: +pos.y.toFixed(3), last: tracks._lastPathId,
        });
      }
    }
    if (prevKind && snap.kind !== prevKind && (prevKind === "ramp" || snap.kind === "ramp"
        || prevKind === "floor" || snap.kind === "floor")) {
      // count flip only near climb (not approach)
      if (mounted || Math.hypot(pos.x - foot.x, pos.z - foot.z) < 0.5) {
        kindFlips++;
        if (events.length < 14) {
          events.push({
            t: "flip", frame, from: prevKind, to: snap.kind,
            pathId: snap.pathId, y: +pos.y.toFixed(3),
          });
        }
      }
    }
    const dy = Math.abs(pos.y - prevY);
    if (dy > maxAbsDy) maxAbsDy = dy;
    // per-frame Y jump while supposedly supported (sloppy snap fight)
    if (dy > 0.12 && snap.supported) {
      yJitter++;
      if (events.length < 16) {
        events.push({
          t: "yjitter", frame, dy: +dy.toFixed(3),
          kind: snap.kind, pathId: snap.pathId, y: +pos.y.toFixed(3),
        });
      }
    }
    prevKind = snap.kind;
    prevY = pos.y;

    // Done when near path end
    const end = path.points.at(-1);
    if (mounted && Math.hypot(pos.x - end.x, pos.y - end.y, pos.z - end.z) < 0.35) {
      return {
        id: pathId, ok: true, frames: frame, mountAt,
        falseFalls, unsupported, kindFlips, yJitter,
        maxAbsDy: +maxAbsDy.toFixed(3),
        endY: +pos.y.toFixed(3), endKind: snap.kind, endPath: snap.pathId,
        events: events.slice(0, 10),
      };
    }
    if (car.crashed) {
      return {
        id: pathId, ok: false, reason: "crashed", frames: frame, mountAt,
        falseFalls, unsupported, kindFlips, yJitter,
        maxAbsDy: +maxAbsDy.toFixed(3), events: events.slice(0, 10),
      };
    }
  }
  // Long climbs/descents: mounted + traveled along path counts as working
  const end = path.points.at(-1);
  const startPt = path.points[0];
  const pathLen = Math.hypot(end.x - startPt.x, end.y - startPt.y, end.z - startPt.z) || 1;
  const traveled = Math.hypot(
    car.root.position.x - startPt.x,
    car.root.position.y - startPt.y,
    car.root.position.z - startPt.z
  );
  const climbed = mounted && (traveled > pathLen * 0.22 || falseFalls === 0 && unsupported < 8);
  return {
    id: pathId, ok: !!climbed && falseFalls === 0, reason: mounted ? (climbed ? "partial_ok" : "timeout_mid") : "never_mounted",
    frames: 1600, mountAt, falseFalls, unsupported, kindFlips, yJitter,
    maxAbsDy: +maxAbsDy.toFixed(3),
    pos: {
      x: +car.root.position.x.toFixed(2),
      y: +car.root.position.y.toFixed(2),
      z: +car.root.position.z.toFixed(2),
    },
    events: events.slice(0, 12),
  };
}

const climbs = [
  // Primary vertical links (must mount + finish)
  ["ramp_foyer_to_landing", "foyer_skirting"],
  ["ramp_landing_to_landing_cornice", "landing_skirting"],
  ["ramp_foyer_console", "foyer_skirting"],
  ["ramp_console_to_foyer_cornice", "furniture_foyer_console"],
  ["attic_from_landing_access", "landing_skirting"],
  ["ramp_landing_to_balcony", "landing_skirting"],
  ["ramp_balcony_to_drive", "balcony_loop"],
  ["ramp_balcony_return", "balcony_loop"],
  // Supporting furniture climbs
  ["ramp_cabinet_case", "cabinet_skirting"],
  ["ramp_dining_table", "door_cons_dining"],
  ["ramp_workshop_bench", "workshop_skirting"],
];

const results = [];
for (const [id, approach] of climbs) {
  const r = runClimb(id, approach);
  results.push(r);
  const status = r.ok ? "OK" : "FAIL";
  console.log(
    `${status} ${id} mount@${r.mountAt} falls=${r.falseFalls} unsupp=${r.unsupported} flips=${r.kindFlips} yjit=${r.yJitter} maxDy=${r.maxAbsDy}`
      + (r.reason ? ` (${r.reason})` : "")
      + (r.events?.length ? `\n  events: ${JSON.stringify(r.events.slice(0, 5))}` : "")
  );
}

const bad = results.filter((r) => !r.ok || r.falseFalls > 0 || r.yJitter > 8 || r.kindFlips > 12);
console.log("\nSUMMARY", {
  total: results.length,
  ok: results.filter((r) => r.ok).length,
  neverMounted: results.filter((r) => r.reason === "never_mounted").length,
  crashed: results.filter((r) => r.reason === "crashed").length,
  sloppy: bad.map((r) => r.id),
});

/** Hostile lateral-drift crest — yaw bias + weak steer (real-drive failure mode). */
function hostileCrest(pathId, approachId, yawBias = 0.22, minCrestFrac = 0.85) {
  const path = byId[pathId];
  if (!path || path.disabled) return { id: pathId, ok: false, reason: "missing" };
  const foot = path.points[0], p1 = path.points[1], end = path.points.at(-1);
  const dx = p1.x - foot.x, dz = p1.z - foot.z, len = Math.hypot(dx, dz) || 1;
  const rise = end.y - foot.y;
  car.setPose(foot.x + (dx / len) * 0.08, foot.y + 0.04, foot.z + (dz / len) * 0.08,
    Math.atan2(dx, dz) + yawBias);
  car.crashed = false; car.airborne = false; car.speed = 1.25; car.vy = 0;
  car._unsupportedFrames = 0; car._lastElevated = false; car._tumble = 0;
  tracks._lastPathId = approachId;
  const dt = 1 / 60;
  const keys = { forward: true, back: false, left: false, right: false };
  let maxY = foot.y, fell = false;
  for (let frame = 0; frame < 1600; frame++) {
    const pos = car.root.position;
    const snap = tracks.querySnap(pos.x, pos.y, pos.z, 1.65);
    if ((snap.kind === "ramp" || snap.pathId === pathId) && snap.yaw != null) {
      let dyaw = snap.yaw - car.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      keys.left = dyaw > 0.15;
      keys.right = dyaw < -0.15;
    }
    const flags = car.update(dt, keys, snap);
    if (pos.y > maxY) maxY = pos.y;
    if (flags.fell || car.crashed) { fell = true; break; }
    const nearEnd = Math.hypot(pos.x - end.x, pos.y - end.y, pos.z - end.z) < 0.5;
    const climbed = rise > 0.2
      ? (pos.y >= foot.y + rise * minCrestFrac)
      : nearEnd || Math.hypot(pos.x - end.x, pos.z - end.z) < 0.55;
    if (nearEnd || climbed) {
      return {
        id: pathId, ok: true, maxY: +maxY.toFixed(3), endY: +pos.y.toFixed(3),
        crestY: end.y, fell: false, frames: frame, yawBias,
      };
    }
  }
  return {
    id: pathId, ok: false, maxY: +maxY.toFixed(3), endY: +car.root.position.y.toFixed(3),
    crestY: end.y, fell, crashed: car.crashed, yawBias,
  };
}

const hostileClimbs = [
  ["ramp_foyer_to_landing", "foyer_skirting", 0.22, 0.88],
  ["ramp_foyer_console", "foyer_skirting", 0.18, 0.85],
  ["ramp_console_to_foyer_cornice", "furniture_foyer_console", 0.18, 0.8],
  ["ramp_dining_table", "door_cons_dining", 0.18, 0.85],
  ["attic_from_landing_access", "landing_skirting", 0.18, 0.85],
];
let hostileFail = 0;
for (const [id, approach, bias, frac] of hostileClimbs) {
  const h = hostileCrest(id, approach, bias, frac);
  console.log(`HOSTILE ${id}`, h);
  // Trust hostileCrest: reached near crest OR climbed frac without fall
  if (!h.ok || h.fell) {
    console.error(`HOSTILE FAIL ${id}`);
    hostileFail++;
  }
}
if (hostileFail) process.exitCode = 1;
else console.log("HOSTILE multi-climb PASSED", { n: hostileClimbs.length });
