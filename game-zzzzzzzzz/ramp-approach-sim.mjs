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
  const foot0 = ramp.points[0];
  const skirtingX = foot0.x;
  const skirtingZ = foot0.z;
  let overlap = false;
  let culprit = null;
  for (let i = 0; i < cols.length; i++) {
    const b = cols[i];
    if ((b.driveKind || "wall") !== "stair") continue;
    // Drive-softened copy used in play
    const soft = drive._wallColliders[i] || b;
    if (soft.min.y > 0.2) continue; // raised underside ok
    if (soft.max.z < foot0.z - 2.5 || soft.min.z > foot0.z + 2.5) continue;
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
    if (b.max.z < foot0.z - 1.5 || b.min.z > foot0.z + 2.0) continue;
    if (b.max.x < foot0.x - 1.2 || b.min.x > foot0.x + 1.2) continue;
    // Does AABB overlap car on clear climb approach?
    const px = foot0.x, pz = foot0.z + 1.4;
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
  drive.tracks._lastPathId = "foyer_drive_start";
  drive.tracks._lastPathKind = "floor";
}

function steerAimClimb(noise = 0) {
  const p = drive.car.position;
  const s = drive.tracks.querySnap(p.x, p.y, p.z, 1.65, drive.car.yaw);
  let yawTarget = Math.atan2(foot.x - p.x, foot.z - p.z);
  const toFoot = Math.hypot(p.x - foot.x, p.z - foot.z);
  // Near foot / on ramp: lock climb heading (browser still wobbles farther out)
  if (s?.kind === "ramp" && s.pathId === "ramp_foyer_to_landing"
      && (s.onTrack || s.nearDeck || s.rampContinuity)) {
    // Aim up the soft S-weave (not just local segment yaw — prevents foot circling)
    let bestI = 0, bestD = Infinity;
    for (let i = 0; i < ramp.points.length; i++) {
      const q = ramp.points[i];
      const d = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
      if (d < bestD) { bestD = d; bestI = i; }
    }
    const tgt = ramp.points[Math.min(ramp.points.length - 1, bestI + 3)];
    yawTarget = Math.atan2(tgt.x - p.x, tgt.z - p.z);
    if (s.yaw != null) {
      let dy = s.yaw - yawTarget;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      if (Math.abs(dy) < 1.1) yawTarget = s.yaw * 0.55 + yawTarget * 0.45;
    }
    noise *= 0.08;
  } else if (toFoot < 1.35 && Math.abs(p.x - foot.x) < 0.85) {
    // Only climb-aim once actually at the foot — earlier mid-ramp aim yanks south off the start road
    const tgt = ramp.points[Math.min(6, ramp.points.length - 1)];
    yawTarget = Math.atan2(tgt.x - p.x, tgt.z - p.z);
    noise *= 0.12;
  } else if ((s?.pathId === "foyer_drive_start" || s?.pathId === "foyer_climb_spur") && s.yaw != null) {
    let d0 = s.yaw - drive.car.yaw;
    while (d0 > Math.PI) d0 -= Math.PI * 2;
    while (d0 < -Math.PI) d0 += Math.PI * 2;
    let d1 = d0 + Math.PI;
    while (d1 > Math.PI) d1 -= Math.PI * 2;
    while (d1 < -Math.PI) d1 += Math.PI * 2;
    yawTarget = Math.abs(d1) < Math.abs(d0) ? s.yaw + Math.PI : s.yaw;
  } else {
    // Recover onto start road / foot if noise threw us onto carpet
    yawTarget = Math.atan2(foot.x - p.x, foot.z - p.z);
  }
  yawTarget += noise;
  let left = false, right = false;
  if (Number.isFinite(yawTarget)) {
    let dyaw = yawTarget - drive.car.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    left = dyaw > 0.045;
    right = dyaw < -0.045;
  }
  return { forward: true, back: false, left, right, boost: false, snap: s };
}

// ─── 1) HOSTILE browser-like: spawn → climb with human steering noise + walls ───
{
  // Match live spawn; _pickOpenRoadYaw must keep into-foyer heading
  const spawnYaw = drive._pickOpenRoadYaw(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, CAR_SPAWN.yaw);
  reset(CAR_SPAWN.x, CAR_SPAWN.z, spawnYaw, 0.22);
  drive.tracks._lastPathId = "foyer_drive_start";
  drive.tracks._lastPathKind = "floor";
  let pinFrames = 0, maxPin = 0, streak = 0, minSpd = 99;
  let mounted = false, crested = false, maxY = 0;
  let sumSpd = 0, n = 0;
  let culprit = null;
  for (let i = 0; i < 60 * 90; i++) { // longer soft climb
    const noise = Math.sin(i * 0.19) * 0.055 + Math.sin(i * 0.47) * 0.035 + Math.sin(i * 0.07) * 0.02;
    const { snap: s, ...keys } = steerAimClimb(noise);
    drive.keys = keys;
    drive.update(dt);
    const p = drive.car.position;
    const s2 = drive.tracks.querySnap(p.x, p.y, p.z, 1.65, drive.car.yaw);
    const spd = Math.abs(drive.car.speed);
    sumSpd += spd; n++;
    if (i > 60 && spd < minSpd) minSpd = spd;
    if (spd < 0.05) {
      pinFrames++; streak++; maxPin = Math.max(maxPin, streak);
      if (streak > 20 && !culprit) {
        const r = drive._carRadius;
        const hits = [];
        for (const b of drive._wallColliders) {
          if (b.min.y > 0.55) continue;
          if (p.x + r > b.min.x && p.x - r < b.max.x && p.z + r > b.min.z && p.z - r < b.max.z) {
            hits.push({
              kind: b.driveKind || "wall",
              x: [+b.min.x.toFixed(2), +b.max.x.toFixed(2)],
              y: [+b.min.y.toFixed(2), +b.max.y.toFixed(2)],
              z: [+b.min.z.toFixed(2), +b.max.z.toFixed(2)],
            });
          }
        }
        culprit = {
          x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2),
          spd: +spd.toFixed(3), path: s2?.pathId, kind: s2?.kind, hits,
        };
      }
    } else streak = 0;
    maxY = Math.max(maxY, p.y);
    if (s2?.kind === "ramp" && s2.pathId === "ramp_foyer_to_landing" && s2.onTrack) {
      mounted = true;
      drive.tracks._lastPathId = "ramp_foyer_to_landing";
      drive.tracks._lastPathKind = "ramp";
      // Commit to climb: leave noisy foyer cruise and follow soft weave to crest
      for (let j = 0; j < 60 * 45 && !crested; j++) {
        const pj = drive.car.position;
        const sj = drive.tracks.querySnap(pj.x, pj.y, pj.z, 1.85, drive.car.yaw);
        let bestI = 0, bestD = Infinity;
        for (let k = 0; k < ramp.points.length; k++) {
          const q = ramp.points[k];
          const d = Math.hypot(q.x - pj.x, q.y - pj.y, q.z - pj.z);
          if (d < bestD) { bestD = d; bestI = k; }
        }
        const tgt = ramp.points[Math.min(ramp.points.length - 1, bestI + 3)];
        let yawTarget = Math.atan2(tgt.x - pj.x, tgt.z - pj.z);
        if (sj?.onTrack && sj.yaw != null) {
          let dy = sj.yaw - yawTarget;
          while (dy > Math.PI) dy -= Math.PI * 2;
          while (dy < -Math.PI) dy += Math.PI * 2;
          if (Math.abs(dy) < 1.2) yawTarget = sj.yaw * 0.6 + yawTarget * 0.4;
        }
        let dyaw = yawTarget - drive.car.yaw;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        if (sj?.onTrack && sj.yaw != null) drive.car.yaw = sj.yaw;
        else drive.car.yaw = yawTarget;
        const keysJ = { forward: true, back: false, left: false, right: false, boost: false };
        drive.car.update(dt, keysJ, sj);
        maxY = Math.max(maxY, drive.car.position.y);
        if (drive.car.position.y >= crest.y - 0.55
            && Math.hypot(drive.car.position.x - crest.x, drive.car.position.z - crest.z) < 2.6) {
          crested = true;
        }
        if (drive.car.crashed) break;
      }
      break;
    }
    if (p.y >= crest.y - 0.55 && Math.hypot(p.x - crest.x, p.z - crest.z) < 2.6) {
      crested = true;
      break;
    }
    if (drive.car.crashed) break;
  }
  const pinTime = pinFrames / 60;
  const maxPinS = maxPin / 60;
  const avg = sumSpd / n;
  console.log("HOSTILE_APPROACH", {
    spawnYaw: +spawnYaw.toFixed(3),
    avgSpd: +avg.toFixed(3), minSpd: +minSpd.toFixed(3),
    pinTime_s: +pinTime.toFixed(2), maxPinStreak_s: +maxPinS.toFixed(2),
    mounted, crested, maxY: +maxY.toFixed(3), culprit,
    end: {
      x: +drive.car.position.x.toFixed(2),
      y: +drive.car.position.y.toFixed(2),
      z: +drive.car.position.z.toFixed(2),
      spd: +Math.abs(drive.car.speed).toFixed(3),
      kmh: +drive.car.getSpeedKmh().toFixed(1),
    },
  });
  ok("hostile spawn yaw into foyer", Math.cos(spawnYaw) < -0.55, `yaw=${spawnYaw.toFixed(3)}`);
  ok("ramp-approach pinTime≈0 (<0.35s)", pinTime < 0.35, `pinTime=${pinTime.toFixed(2)}s culprit=${JSON.stringify(culprit)}`);
  ok("ramp-approach no permanent pin (streak < 0.35s)", maxPinS < 0.35, `maxPin=${maxPinS.toFixed(2)}s`);
  ok("ramp-approach mounts climb", mounted, `mounted=${mounted}`);
  ok("ramp-approach crests landing", crested && !drive.car.crashed, `maxY=${maxY.toFixed(2)} crest=${crest.y}`);
  ok("ramp-approach avg cruise > 0.30", avg > 0.30, `avg=${avg.toFixed(3)}`);
}

// ─── 2) Nose into former stringer endcap / underside grab zone ───
{
  const fx = foot.x, fz = foot.z;
  const cases = [
    { label: "clear_foot_aim_climb", x: fx, z: fz + 0.15, yaw: Math.PI },
    { label: "stringer_endcap_z8", x: -7.4, z: 9.0, yaw: Math.PI * 0.95 },
    { label: "into_stair_from_room", x: -6.4, z: 9.2, yaw: -Math.PI / 2 },
    { label: "former_wall_wedge", x: -8.2, z: 9.5, yaw: Math.PI },
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
  for (let i = 0; i < 60 * 40; i++) { // longer soft climb from foot
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
      drive.car.position.y >= crest.y - 0.45
      && Math.hypot(drive.car.position.x - crest.x, drive.car.position.z - crest.z) < 2.2
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
