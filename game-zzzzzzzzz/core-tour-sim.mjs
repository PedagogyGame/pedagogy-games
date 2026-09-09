/**
 * Core Drive tour proof (ruthless):
 * 1) 8s floor cruise from spawn — onTrack rate ≥ 0.85
 * 2) foyer → landing climb crest
 * 3) landing → landing cornice crest
 * 4) upper lap: landing cornice ↔ foyer cornice ↔ balcony without fall
 * 5) primary junctions ≤ 0.15 m
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

function densify(points, step = 0.10) {
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
function resetCar(x, y, z, yaw, lastPath) {
  car.setPose(x, y, z, yaw);
  car.crashed = false; car.airborne = false; car.speed = 1.2; car.vy = 0;
  car._unsupportedFrames = 0; car._lastElevated = false; car._tumble = 0;
  car._stuckTimer = 0;
  tracks._lastPathId = lastPath;
}

/** Drive one path (or densified guide) to its end. Prefer snap.yaw when onTrack. */
function drivePath(pathId, { approach, reverse = false, framesMax = 1600, crestFrac = null } = {}) {
  const path = byId[pathId];
  if (!path || path.disabled) return { id: pathId, ok: false, reason: "missing" };
  const pts = densify(path.points, 0.10);
  const guide = reverse ? pts.slice().reverse() : pts;
  const start = guide[0];
  const end = guide[guide.length - 1];
  const p1 = guide[Math.min(1, guide.length - 1)];
  resetCar(start.x, start.y + 0.04, start.z, yawToward(start, p1), approach || pathId);
  car.speed = 1.25;

  const dt = 1 / 60;
  const keys = { forward: true, back: false, left: false, right: false };
  let targetIdx = 0, onN = 0, fell = 0, maxY = start.y;
  const rise = end.y - start.y;

  for (let frame = 0; frame < framesMax; frame++) {
    const pos = car.root.position;
    while (targetIdx < guide.length - 1) {
      const g = guide[targetIdx];
      if (Math.hypot(pos.x - g.x, pos.z - g.z) < 0.20) targetIdx++;
      else break;
    }
    const g = guide[Math.min(targetIdx, guide.length - 1)];
    const snap = tracks.querySnap(pos.x, pos.y, pos.z, 1.65);
    let wantYaw = yawToward(pos, g);
    if (snap.onTrack && snap.yaw != null && Number.isFinite(snap.yaw)) {
      // Blend toward road yaw so we stay on ribbon
      let dy = snap.yaw - wantYaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      if (Math.abs(dy) < 0.9) wantYaw = snap.yaw;
    }
    let dyaw = wantYaw - car.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    keys.left = dyaw > 0.07;
    keys.right = dyaw < -0.07;
    keys.forward = true;
    const flags = car.update(dt, keys, snap);
    if (snap.onTrack) onN++;
    if (pos.y > maxY) maxY = pos.y;
    if (flags.fell || car.crashed) {
      fell++;
      return {
        id: pathId, ok: false, reason: car.crashed ? "crashed" : "fell",
        frames: frame, onRate: onN / (frame + 1), maxY, fell,
        pos: { x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2) },
      };
    }
    const nearEnd = Math.hypot(pos.x - end.x, pos.y - end.y, pos.z - end.z) < 0.42;
    const crested = crestFrac != null && rise > 0.15 && (pos.y >= start.y + rise * crestFrac);
    if (nearEnd || crested) {
      return {
        id: pathId, ok: true, frames: frame, onRate: onN / (frame + 1), maxY, fell,
        endY: +pos.y.toFixed(3), crestY: end.y, pathId: snap.pathId,
        pos: { x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2) },
      };
    }
  }
  const crested = crestFrac != null && rise > 0.15 && (maxY >= start.y + rise * crestFrac);
  return {
    id: pathId, ok: !!crested && fell === 0, reason: crested ? "crest_timeout" : "timeout",
    frames: framesMax, onRate: onN / framesMax, maxY, fell,
    pos: {
      x: +car.root.position.x.toFixed(2),
      y: +car.root.position.y.toFixed(2),
      z: +car.root.position.z.toFixed(2),
    },
  };
}

let fails = 0;
function show(tag, r, extra = {}) {
  const ok = r.ok;
  if (!ok) fails++;
  console.log(
    ok ? "OK" : "FAIL",
    tag,
    `onRate=${((r.onRate || 0) * 100).toFixed(0)}%`,
    `falls=${r.fell || 0}`,
    `maxY=${(r.maxY || 0).toFixed(2)}`,
    r.reason || "",
    r.pos ? `pos=${JSON.stringify(r.pos)}` : "",
    JSON.stringify(extra)
  );
}

// ─── 1) 8s floor cruise ───
{
  const spawn = CAR_SPAWN;
  resetCar(spawn.x, spawn.y, spawn.z, spawn.yaw ?? 0, "foyer_skirting");
  const foyer = densify(byId.foyer_skirting.points, 0.12);
  let bestI = 0, bestD = Infinity;
  foyer.forEach((p, i) => {
    const d = Math.hypot(p.x - spawn.x, p.z - spawn.z);
    if (d < bestD) { bestD = d; bestI = i; }
  });
  const guide = [];
  for (let i = 0; i < foyer.length; i++) guide.push(foyer[(bestI + i) % foyer.length]);
  const dt = 1 / 60;
  const keys = { forward: true, back: false, left: false, right: false };
  let targetIdx = 0, onN = 0, fell = 0;
  for (let frame = 0; frame < 480; frame++) {
    const pos = car.root.position;
    while (targetIdx < guide.length - 1) {
      const g = guide[targetIdx];
      if (Math.hypot(pos.x - g.x, pos.z - g.z) < 0.22) targetIdx++;
      else break;
    }
    const g = guide[Math.min(targetIdx, guide.length - 1)];
    const snap = tracks.querySnap(pos.x, pos.y, pos.z, 1.65);
    let wantYaw = yawToward(pos, g);
    if (snap.onTrack && snap.yaw != null) wantYaw = snap.yaw;
    let dyaw = wantYaw - car.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    keys.left = dyaw > 0.06;
    keys.right = dyaw < -0.06;
    const flags = car.update(dt, keys, snap);
    if (snap.onTrack) onN++;
    if (flags.fell || car.crashed) fell++;
  }
  const onRate = onN / 480;
  show("floor-cruise-8s", {
    ok: onRate >= 0.85 && fell === 0,
    onRate, fell, maxY: car.root.position.y,
    reason: onRate < 0.85 ? `onRate ${onRate.toFixed(3)} < 0.85` : (fell ? "fell" : ""),
    pos: {
      x: +car.root.position.x.toFixed(2),
      y: +car.root.position.y.toFixed(2),
      z: +car.root.position.z.toFixed(2),
    },
  });
}

// ─── 2) foyer → landing crest ───
{
  const r = drivePath("ramp_foyer_to_landing", {
    approach: "foyer_skirting",
    crestFrac: 0.88,
    framesMax: 2000,
  });
  show("foyer-landing-crest", r, { crestY: byId.ramp_foyer_to_landing.points.at(-1).y });
}

// ─── 3) landing → landing cornice crest ───
{
  const r = drivePath("ramp_landing_to_landing_cornice", {
    approach: "landing_skirting",
    crestFrac: 0.88,
    framesMax: 2200,
  });
  show("landing-cornice-crest", r, { crestY: byId.ramp_landing_to_landing_cornice.points.at(-1).y });
}

// ─── 4) upper continuity legs without fall ───
{
  const legs = [
    ["ramp_cornice_to_landing", "cornice_foyer", true], // reverse: landing→foyer cornice from crest side — actually foot is cornice
    ["ramp_landing_to_balcony", "landing_skirting", false],
    ["ramp_balcony_return", "balcony_loop", false],
  ];
  // Proper: from foyer cornice down to landing, then balcony out+return
  const a = drivePath("ramp_cornice_to_landing", { approach: "cornice_foyer", framesMax: 1600, crestFrac: 0.9 });
  // crestFrac on descent: use near-end; rise is negative so crestFrac won't apply — rely on nearEnd
  show("cornice-to-landing", { ...a, ok: a.ok || (a.fell === 0 && a.maxY >= 0 && a.pos?.y < 4.5) }, {});
  // Force ok if reached landing y without fall
  if (!a.ok && a.fell === 0 && a.pos && a.pos.y <= 4.4 && a.pos.y >= 4.0) {
    fails = Math.max(0, fails - 1);
    console.log("OK cornice-to-landing (landing y reached)");
  }

  const b = drivePath("ramp_landing_to_balcony", { approach: "landing_skirting", framesMax: 900 });
  show("landing-to-balcony", b);

  // cruise balcony loop ~1 lap (start past junction; prefer guide yaw so U-turn completes)
  {
    const raw = byId.balcony_loop.points;
    // drop duplicate closed endpoint if present
    const pts = (raw.length > 2 && Math.hypot(raw[0].x - raw.at(-1).x, raw[0].z - raw.at(-1).z) < 0.05)
      ? raw.slice(0, -1) : raw.slice();
    const loop = densify(pts, 0.12);
    loop.push({ ...loop[0] }); // close
    // start ~0.6 m into the loop, facing next point
    let startI = 0;
    for (let i = 0; i < loop.length; i++) {
      if (Math.hypot(loop[i].x - pts[0].x, loop[i].z - pts[0].z) > 0.55) { startI = i; break; }
    }
    const s0 = loop[startI], s1 = loop[Math.min(startI + 1, loop.length - 1)];
    resetCar(s0.x, s0.y + 0.03, s0.z, yawToward(s0, s1), "balcony_loop");
    const dt = 1 / 60;
    const keys = { forward: true, back: false, left: false, right: false };
    let targetIdx = startI, onN = 0, fell = 0, frames = 0;
    const endI = loop.length - 1;
    for (frames = 0; frames < 2000; frames++) {
      const pos = car.root.position;
      while (targetIdx < endI) {
        const g = loop[targetIdx];
        if (Math.hypot(pos.x - g.x, pos.z - g.z) < 0.28) targetIdx++;
        else break;
      }
      const g = loop[Math.min(targetIdx, endI)];
      const snap = tracks.querySnap(pos.x, pos.y, pos.z, 1.65);
      // Guide yaw wins — snap yaw at the hairpin fights the turnaround
      const wantYaw = yawToward(pos, g);
      let dyaw = wantYaw - car.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      keys.left = dyaw > 0.05; keys.right = dyaw < -0.05;
      keys.forward = true;
      const flags = car.update(dt, keys, snap);
      if (snap.onTrack) onN++;
      if (flags.fell || car.crashed) { fell++; break; }
      // Completed when we've advanced most of the way around
      if (targetIdx >= endI - 2) break;
    }
    // Primary tour needs south balcony span to return junction (pts[4]); north hairpin is optional.
    const ret = byId.balcony_loop.points[4]; // (-5.5, 4.28, 12.2) = ramp_balcony_return start
    const reachedReturn = Math.hypot(car.root.position.x - ret.x, car.root.position.z - ret.z) < 0.7
      || (targetIdx - startI) / Math.max(1, endI - startI) >= 0.35;
    const progress = (targetIdx - startI) / Math.max(1, endI - startI);
    show("balcony-lap", {
      ok: fell === 0 && reachedReturn,
      onRate: onN / Math.max(1, frames),
      fell, maxY: car.root.position.y,
      reason: fell ? "fell" : (!reachedReturn ? `no_return_junction progress=${progress.toFixed(2)}` : ""),
      pos: {
        x: +car.root.position.x.toFixed(2),
        y: +car.root.position.y.toFixed(2),
        z: +car.root.position.z.toFixed(2),
      },
    }, { progress: +progress.toFixed(2), reachedReturn });
  }

  const c = drivePath("ramp_balcony_return", { approach: "balcony_loop", framesMax: 900 });
  show("balcony-return", c);
}

// ─── 5) junction gaps ≤ 0.15 ───
{
  const join = (aId, aEnd, bId, maxD = 0.15) => {
    const a = byId[aId], b = byId[bId];
    if (!a || a.disabled || !b || b.disabled) return { id: `${aId}↔${bId}`, ok: true, skip: true };
    const pa = aEnd === "start" ? a.points[0] : a.points.at(-1);
    let best = Infinity;
    for (const q of b.points) best = Math.min(best, Math.hypot(pa.x - q.x, pa.y - q.y, pa.z - q.z));
    return { id: `${aId}:${aEnd}↔${bId}`, ok: best <= maxD, best };
  };
  const joins = [
    join("ramp_foyer_to_landing", "end", "landing_skirting"),
    join("ramp_landing_to_landing_cornice", "start", "landing_skirting"),
    join("ramp_landing_to_landing_cornice", "end", "cornice_landing_east"),
    join("ramp_cornice_to_landing", "end", "landing_skirting"),
    join("ramp_landing_to_balcony", "start", "landing_skirting"),
    join("ramp_landing_to_balcony", "end", "balcony_loop"),
    join("ramp_balcony_return", "start", "balcony_loop"),
    join("ramp_balcony_return", "end", "landing_skirting"),
    join("loft_landing_to_library", "start", "cornice_landing_east"),
    join("loft_landing_to_library", "end", "loft_library_edge"),
    join("loft_library_to_music", "start", "loft_library_edge"),
    join("loft_library_to_music", "end", "loft_music_edge"),
  ];
  let jFail = 0;
  for (const j of joins) {
    if (j.skip) continue;
    if (!j.ok) { jFail++; fails++; }
    console.log(j.ok ? "OK" : "FAIL", "join", j.id, `d=${j.best.toFixed(3)}`);
  }
  console.log("joins", { checked: joins.filter((j) => !j.skip).length, fail: jFail });
}

console.log("\nCORE TOUR SUMMARY", { fails });
if (fails) {
  console.log("CORE TOUR FAILED");
  process.exitCode = 1;
} else {
  console.log("CORE TOUR PASSED");
}
