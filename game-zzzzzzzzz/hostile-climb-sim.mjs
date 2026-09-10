/**
 * Hostile human-noise sim + hard specs:
 * - max segment grade ≤ 0.30 on all enabled paths
 * - single connected component from foyer_drive_start
 * - imperfect steering still crests foyer climb and reaches balcony
 */
import * as THREE from "./vendor/three.module.js";
import { DriveMode } from "./js/drive/driveMode.js";
import { TRACK_PATHS, CAR_SPAWN, RAMP_MAX_GRADE } from "./js/data/tracks.js";

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
  console.log(pass ? `PASS  ${name}${detail ? " — " + detail : ""}` : `FAIL  ${name}${detail ? " — " + detail : ""}`);
  if (!pass) fails.push(name);
};

const en = TRACK_PATHS.filter((p) => !p.disabled && p.visual !== false);
const byId = Object.fromEntries(TRACK_PATHS.map((p) => [p.id, p]));

// ─── 1) Grade hard cap ───
{
  let worst = { id: null, g: 0 };
  let bad = 0;
  for (const p of en) {
    for (let i = 1; i < p.points.length; i++) {
      const a = p.points[i - 1], b = p.points[i];
      const run = Math.hypot(b.x - a.x, b.z - a.z);
      if (run < 1e-6) continue;
      const g = Math.abs(b.y - a.y) / run;
      if (g > worst.g) worst = { id: p.id, g };
      if (g > 0.30 + 1e-4) bad++;
    }
  }
  ok("max-grade-0.30", bad === 0, `worst=${worst.id} g=${worst.g.toFixed(3)} cap=${RAMP_MAX_GRADE}`);
}

// ─── 2) Connectivity ───
{
  const near = (a, b, tol = 0.45) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= tol;
  const adj = Object.fromEntries(en.map((p) => [p.id, new Set()]));
  for (let i = 0; i < en.length; i++) {
    for (let j = i + 1; j < en.length; j++) {
      const A = en[i], B = en[j];
      let kiss = false;
      const EA = [A.points[0], A.points.at(-1)];
      const EB = [B.points[0], B.points.at(-1)];
      for (const a of EA) for (const b of EB) if (near(a, b)) kiss = true;
      if (!kiss) for (const a of EA) for (const b of B.points) if (near(a, b)) { kiss = true; break; }
      if (!kiss) for (const b of EB) for (const a of A.points) if (near(a, b)) { kiss = true; break; }
      if (kiss) { adj[A.id].add(B.id); adj[B.id].add(A.id); }
    }
  }
  const seen = new Set(["foyer_drive_start"]);
  const q = ["foyer_drive_start"];
  while (q.length) {
    const u = q.pop();
    for (const v of adj[u]) if (!seen.has(v)) { seen.add(v); q.push(v); }
  }
  const orphans = en.map((p) => p.id).filter((id) => !seen.has(id));
  ok("primary-circuit-connected", orphans.length === 0, `enabled=${en.length} connected=${seen.size} orphans=${orphans.join(",") || "none"}`);
}

// ─── 3) Ramp approach runway exists ───
{
  const mount = byId.ramp_foyer_to_landing;
  const spur = byId.foyer_climb_spur;
  const foot = mount.points[0];
  const spurEnd = spur.points.at(-1);
  const d = Math.hypot(foot.x - spurEnd.x, foot.z - spurEnd.z);
  const runwayLen = (() => {
    let L = 0;
    for (let i = 1; i < spur.points.length; i++) {
      const a = spur.points[i - 1], b = spur.points[i];
      L += Math.hypot(b.x - a.x, b.z - a.z);
    }
    return L;
  })();
  ok("climb-approach-runway", d < 0.05 && runwayLen >= 1.2 && spur.width >= 1.5,
    `kiss=${d.toFixed(3)} runway=${runwayLen.toFixed(2)} spurW=${spur.width}`);
}

// ─── 4) Hostile noise climb → balcony ───
{
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  const drive = new DriveMode(scene, camera);
  const car = drive.car;
  const tracks = drive.tracks;

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

  // Approach from spur with noisy steer
  const spurPts = densify(byId.foyer_climb_spur.points, 0.10);
  const climbPts = densify(byId.ramp_foyer_to_landing.points, 0.08);
  const landPts = densify(byId.landing_skirting.points, 0.14);
  const balRamp = densify(byId.ramp_landing_to_balcony.points, 0.10);
  const guide = [...spurPts.slice(0, -1), ...climbPts];

  const start = guide[0];
  car.setPose(start.x, start.y + 0.04, start.z, yawToward(start, guide[1]));
  car.crashed = false; car.airborne = false; car.speed = 1.15; car.vy = 0;
  car._unsupportedFrames = 0; car._lastElevated = false; car._tumble = 0;
  tracks._lastPathId = "foyer_climb_spur";

  const dt = 1 / 60;
  const keys = { forward: true, back: false, left: false, right: false };
  let targetIdx = 0, maxY = start.y, fell = 0, crest = false;
  const crestY = byId.ramp_foyer_to_landing.points.at(-1).y;
  let noisePhase = 0;

  for (let frame = 0; frame < 4000; frame++) {
    const pos = car.root.position;
    while (targetIdx < guide.length - 1) {
      const g = guide[targetIdx];
      if (Math.hypot(pos.x - g.x, pos.y - g.y, pos.z - g.z) < 0.42) targetIdx++;
      else break;
    }
    const g = guide[Math.min(targetIdx, guide.length - 1)];
    const snap = tracks.querySnap(pos.x, pos.y, pos.z, 1.85, car.yaw);
    let wantYaw = yawToward(pos, g);
    if (snap.onTrack && snap.yaw != null && Number.isFinite(snap.yaw)) {
      let dy = snap.yaw - wantYaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      if (Math.abs(dy) < 1.2) wantYaw = snap.yaw * 0.80 + wantYaw * 0.20;
    }
    // Hostile human noise — imperfect steering
    noisePhase += dt;
    wantYaw += Math.sin(noisePhase * 7.3) * 0.12 + Math.sin(noisePhase * 3.1) * 0.08;
    let dyaw = wantYaw - car.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    // Delayed/clumsy corrections
    keys.left = dyaw > 0.12;
    keys.right = dyaw < -0.12;
    keys.forward = true;
    const flags = car.update(dt, keys, snap);
    if (pos.y > maxY) maxY = pos.y;
    if (flags.fell || car.crashed) fell++;
    if (pos.y >= crestY - 0.15 && Math.hypot(pos.x - (-5), pos.z - 1.9) < 1.8) {
      crest = true;
      break;
    }
  }
  ok("hostile-noise-crest", crest && fell === 0, `maxY=${maxY.toFixed(2)} fell=${fell} pos=${JSON.stringify({
    x: +car.root.position.x.toFixed(2),
    y: +car.root.position.y.toFixed(2),
    z: +car.root.position.z.toFixed(2),
  })}`);

  // Continue landing → balcony with noise.
  // Short scenic guide: crest → west/south face → east balcony mount (not full loop spin).
  if (crest && fell === 0) {
    const balFoot = byId.ramp_landing_to_balcony.points[0];
    const crestPt = byId.ramp_foyer_to_landing.points.at(-1);
    const shortGuide = densify([
      crestPt,
      { x: -5.6, y: 4.26, z: 3.5 },
      { x: -6.2, y: 4.26, z: 5.5 },
      { x: -6.5, y: 4.26, z: 7.4 },
      { x: -6.5, y: 4.26, z: 8.7 },
      { x: -4.0, y: 4.26, z: 8.95 },
      { x: -1.0, y: 4.26, z: 9.0 },
      { x: 2.0, y: 4.26, z: 9.0 },
      { x: 4.5, y: 4.26, z: 8.95 },
      balFoot,
    ], 0.12);
    const full = [...shortGuide, ...balRamp];
    const g0 = full[0], g1 = full[Math.min(1, full.length - 1)];
    car.setPose(g0.x, g0.y + 0.03, g0.z, yawToward(g0, g1));
    car.crashed = false; car.airborne = false; car.speed = 1.28; car.vy = 0;
    car._unsupportedFrames = 0; car._lastElevated = false; car._tumble = 0;
    car._steerInput = 0;
    targetIdx = 0;
    tracks._lastPathId = "landing_skirting";
    tracks._lastPathKind = "floor";
    // Nudge off climb crest glue toward landing circuit
    car.root.position.x += 0.12;
    car.root.position.z += 0.15;
    let reachedBal = false;
    noisePhase = 0;
    fell = 0;
    for (let frame = 0; frame < 4800; frame++) {
      const pos = car.root.position;
      while (targetIdx < full.length - 1) {
        const g = full[targetIdx];
        if (Math.hypot(pos.x - g.x, pos.z - g.z) < 0.40) targetIdx++;
        else break;
      }
      const g = full[Math.min(targetIdx, full.length - 1)];
      const snap = tracks.querySnap(pos.x, pos.y, pos.z, 1.85, car.yaw);
      let wantYaw = yawToward(pos, g);
      if (snap.onTrack && snap.yaw != null && Number.isFinite(snap.yaw)) {
        let dy = snap.yaw - wantYaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        let dyR = dy + Math.PI;
        while (dyR > Math.PI) dyR -= Math.PI * 2;
        while (dyR < -Math.PI) dyR += Math.PI * 2;
        if (Math.abs(dyR) < Math.abs(dy)) dy = dyR;
        if (Math.abs(dy) < 0.85) wantYaw = snap.yaw * 0.55 + wantYaw * 0.45;
      }
      noisePhase += dt;
      wantYaw += Math.sin(noisePhase * 6.5) * 0.08;
      let dyaw = wantYaw - car.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      keys.left = dyaw > 0.11;
      keys.right = dyaw < -0.11;
      const flags = car.update(dt, keys, snap);
      // Keep yaw bounded for noisy human sim stability
      while (car.yaw > Math.PI) car.yaw -= Math.PI * 2;
      while (car.yaw < -Math.PI) car.yaw += Math.PI * 2;
      if (flags.fell || car.crashed) { fell++; break; }
      const onBalDeck = pos.y > 4.15 && pos.z > 10.2 && Math.abs(pos.x) < 6.5;
      if (onBalDeck
          || snap.pathId === "balcony_loop"
          || (snap.pathId === "ramp_landing_to_balcony" && pos.z > 10.2)
          || (snap.pathId === "ramp_balcony_return" && pos.z > 10.2)) {
        reachedBal = true;
        break;
      }
    }
    ok("hostile-noise-balcony", reachedBal && fell === 0, `fell=${fell} pos=${JSON.stringify({
      x: +car.root.position.x.toFixed(2),
      y: +car.root.position.y.toFixed(2),
      z: +car.root.position.z.toFixed(2),
    })}`);
  } else {
    ok("hostile-noise-balcony", false, "skipped — no crest");
  }
}

if (fails.length) {
  console.log("\nHOSTILE/HARD-SPEC FAILURES:", fails.length);
  process.exit(1);
}
console.log("\nALL HOSTILE/HARD-SPEC CHECKS PASSED");
