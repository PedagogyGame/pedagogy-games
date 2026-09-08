import * as THREE from "./vendor/three.module.js";
import { DriveMode } from "./js/drive/driveMode.js";
import { TRACK_PATHS } from "./js/data/tracks.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
const drive = new DriveMode(scene, camera);

const PRIMARY = [
  "ramp_foyer_to_landing",
  "ramp_foyer_console",
  "ramp_landing_to_landing_cornice",
  "ramp_console_to_foyer_cornice",
  "ramp_cabinet_case",
  "ramp_dining_table",
  "ramp_workshop_bench",
  "attic_from_landing_access",
  "ramp_cornice_to_balcony",
  "ramp_balcony_to_drive",
  "ramp_landing_to_balcony",
  "ramp_music_to_hall_cornice",
  "mouse_dining_west_garden",
];

function pointAlong(path, dist) {
  let rem = dist;
  for (let i = 1; i < path.points.length; i++) {
    const p0 = path.points[i - 1], p1 = path.points[i];
    const seg = Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
    if (rem <= seg) {
      const t = rem / seg;
      return {
        x: p0.x + (p1.x - p0.x) * t,
        y: p0.y + (p1.y - p0.y) * t,
        z: p0.z + (p1.z - p0.z) * t,
      };
    }
    rem -= seg;
  }
  const last = path.points[path.points.length - 1];
  return { x: last.x, y: last.y, z: last.z };
}

function nearestApproach(foot) {
  let best = { id: "foyer_skirting", d: Infinity };
  for (const p of TRACK_PATHS) {
    if (!(p.kind === "floor" || p.kind === "outdoor" || p.kind === "cornice"
      || p.kind === "elevated" || p.kind === "balcony")) continue;
    for (const q of p.points) {
      const d = Math.hypot(q.x - foot.x, q.y - foot.y, q.z - foot.z);
      if (d < best.d) best = { id: p.id, d };
    }
  }
  return best;
}

function approachTest(path, approachPathId) {
  const foot = path.points[0];
  const a = path.points[0], b = path.points[1];
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len, uz = dz / len;
  const results = [];
  for (const back of [0.55, 0.35, 0.18, 0.08, 0.0, -0.12, -0.28, -0.5, -1.0]) {
    let x, y, z;
    if (back >= 0) {
      x = foot.x - ux * back;
      z = foot.z - uz * back;
      y = foot.y + 0.04;
    } else {
      const p = pointAlong(path, -back);
      x = p.x; y = p.y + 0.04; z = p.z;
    }
    drive.tracks._lastPathId = approachPathId;
    const snap = drive.tracks.querySnap(x, y, z, 1.65);
    results.push({
      back,
      kind: snap.kind,
      pathId: snap.pathId,
      on: !!snap.onTrack,
      supp: !!snap.supported,
      snapY: snap.y != null ? +snap.y.toFixed(3) : null,
    });
  }
  return results;
}

function progressiveClimb(path, approachPathId) {
  drive.tracks._lastPathId = approachPathId;
  const fails = [];
  const steps = [];
  for (let dist = -0.4; dist <= 3.5; dist += 0.15) {
    let x, y, z;
    if (dist < 0) {
      const a = path.points[0], b = path.points[1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      x = a.x - (dx / len) * (-dist);
      z = a.z - (dz / len) * (-dist);
      y = a.y + 0.04;
    } else {
      const p = pointAlong(path, dist);
      x = p.x; y = p.y + 0.04; z = p.z;
    }
    const snap = drive.tracks.querySnap(x, y, z, 1.65);
    const ok = dist < 0
      ? true
      : (snap.onTrack && snap.supported && (snap.kind === "ramp" || snap.kind === "mouse"
          || snap.kind === "shortcut" || snap.pathId === path.id
          || (snap.elevated && Math.abs(snap.y - y) < 0.35)));
    const footZone = dist >= 0 && dist <= 0.25;
    const footOk = !footZone || (snap.onTrack && snap.supported && (
      snap.kind === "ramp" || snap.kind === "mouse" || snap.kind === "shortcut" || snap.pathId === path.id
    ));
    steps.push({
      dist: +dist.toFixed(2), kind: snap.kind, pathId: snap.pathId,
      on: !!snap.onTrack, last: drive.tracks._lastPathId,
    });
    if (!ok || !footOk) {
      fails.push({
        dist: +dist.toFixed(2), kind: snap.kind, pathId: snap.pathId,
        on: !!snap.onTrack, footZone,
      });
    }
  }
  return { fails, steps };
}

let totalFootFail = 0, totalProgFail = 0;
for (const id of PRIMARY) {
  const path = TRACK_PATHS.find((p) => p.id === id);
  if (!path) { console.log("MISSING", id); continue; }
  const best = nearestApproach(path.points[0]);
  const r = approachTest(path, best.id);
  console.log("\n===", id, "via", best.id, "d=" + best.d.toFixed(3));
  for (const x of r) {
    const needRamp = x.back <= 0.08;
    const roadish = x.kind === "ramp" || x.kind === "mouse" || x.kind === "shortcut" || x.pathId;
    const bad = needRamp && !(roadish && x.on && x.supp);
    if (bad) totalFootFail++;
    console.log(
      `  back=${String(x.back).padStart(5)} ${x.kind}/${x.pathId} on=${x.on} y=${x.snapY}${bad ? " FAIL" : ""}`
    );
  }
  const prog = progressiveClimb(path, best.id);
  if (prog.fails.length) {
    totalProgFail += prog.fails.length;
    console.log("  PROG FAILS", JSON.stringify(prog.fails.slice(0, 6)));
  } else {
    console.log("  PROG OK steps", prog.steps.length);
  }
}
console.log("\nTOTAL footFail samples", totalFootFail, "progFail", totalProgFail);
