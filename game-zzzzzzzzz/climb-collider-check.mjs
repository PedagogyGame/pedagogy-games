/**
 * Centerline-vs-colliders for ramp_foyer_to_landing.
 * Catmull-Rom centerline + ±0.85·halfW at car-body height vs hard wall/pillar
 * AABBs, plus decorative gold jamb meshes (Ben screenshot class).
 */
import * as THREE from "./vendor/three.module.js";
import { Mansion } from "./js/mansion.js";
import { TRACK_PATHS } from "./js/data/tracks.js";

const scene = new THREE.Scene();
const mansion = new Mansion(scene);
const cols = mansion.colliders;
const ramp = TRACK_PATHS.find((p) => p.id === "ramp_foyer_to_landing");
if (!ramp || ramp.disabled) {
  console.error("FAIL ramp missing/disabled", ramp?._disabledReason);
  process.exit(1);
}

const halfW = ramp.width * 0.5;
const pts = ramp.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.22);
const samples = curve.getPoints(100);

function boxOf(c) {
  if (c.min && c.max) {
    return {
      minX: c.min.x, maxX: c.max.x, minY: c.min.y, maxY: c.max.y,
      minZ: c.min.z, maxZ: c.max.z, kind: c.driveKind || "?",
    };
  }
  return {
    minX: c.minX, maxX: c.maxX, minY: c.minY, maxY: c.maxY,
    minZ: c.minZ, maxZ: c.maxZ, kind: c.driveKind || "?",
  };
}

function hardHit(x, y, z) {
  for (const c of cols) {
    const b = boxOf(c);
    if (b.kind !== "wall" && b.kind !== "pillar") continue;
    if (b.minX == null) continue;
    if (x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && z >= b.minZ && z <= b.maxZ) return b;
  }
  return null;
}

const goldBoxes = [];
scene.traverse((o) => {
  if (!o.isMesh || !o.material?.color) return;
  const hex = o.material.color.getHexString();
  if (hex !== "e8c547" && hex !== "c9a227") return;
  o.updateWorldMatrix(true, false);
  const b = new THREE.Box3().setFromObject(o);
  if (b.max.y - b.min.y < 1.5) return;
  if (b.max.x < -8 || b.min.x > 0 || b.max.z < -4 || b.min.z > 14) return;
  goldBoxes.push(b);
});

function goldHit(x, y, z) {
  for (const b of goldBoxes) {
    if (x >= b.min.x && x <= b.max.x && y >= b.min.y && y <= b.max.y && z >= b.min.z && z <= b.max.z) return b;
  }
  return null;
}

let hardHits = [];
let goldHits = [];
let maxEarlyY = 0;
const earlyN = Math.floor(samples.length * 0.08);
for (let i = 0; i < samples.length; i++) {
  const p = samples[i];
  if (i < earlyN) maxEarlyY = Math.max(maxEarlyY, p.y);
  const j = Math.min(i + 1, samples.length - 1);
  const tx = samples[j].x - p.x, tz = samples[j].z - p.z;
  const tl = Math.hypot(tx, tz) || 1;
  const rx = -tz / tl, rz = tx / tl;
  for (const lat of [0, halfW * 0.85, -halfW * 0.85]) {
    const x = p.x + rx * lat, z = p.z + rz * lat;
    for (const yOff of [0.22, 0.48]) {
      const y = p.y + yOff;
      if (hardHit(x, y, z)) hardHits.push({ i, x, y: p.y, z, lat });
      if (goldHit(x, y, z)) goldHits.push({ i, x, y: p.y, z, lat });
    }
  }
}
const uniq = (arr) => {
  const s = new Set(); const out = [];
  for (const a of arr) {
    const k = `${a.i}:${a.lat.toFixed(2)}`;
    if (s.has(k)) continue; s.add(k); out.push(a);
  }
  return out;
};
hardHits = uniq(hardHits); goldHits = uniq(goldHits);

let flat = 0, turn = 0, maxSeg = 0;
for (let i = 1; i < pts.length; i++) {
  const run = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) || 1e-6;
  flat += run;
  maxSeg = Math.max(maxSeg, Math.abs(pts[i].y - pts[i - 1].y) / run);
}
for (let i = 1; i < pts.length - 1; i++) {
  const a = pts[i - 1], b = pts[i], c = pts[i + 1];
  let d = Math.atan2(c.x - b.x, c.z - b.z) - Math.atan2(b.x - a.x, b.z - a.z);
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  turn += Math.abs(d);
}
const rise = Math.abs(pts.at(-1).y - pts[0].y);
const mean = rise / flat;
const foot = pts[0], crest = pts.at(-1);
const report = {
  foot: { x: +foot.x.toFixed(2), y: +foot.y.toFixed(2), z: +foot.z.toFixed(2) },
  crest: { x: +crest.x.toFixed(2), y: +crest.y.toFixed(2), z: +crest.z.toFixed(2) },
  width: +ramp.width.toFixed(3),
  halfW: +halfW.toFixed(3),
  flat: +flat.toFixed(2),
  rise: +rise.toFixed(2),
  meanGrade: +mean.toFixed(3),
  maxSegGrade: +maxSeg.toFixed(3),
  turnDeg: +(turn * 180 / Math.PI).toFixed(1),
  maxY_first8pct: +maxEarlyY.toFixed(3),
  hardHits: hardHits.length,
  goldHits: goldHits.length,
  aperture: { minX: -8.55, maxX: -2.40, minZ: -2.55, maxZ: 12.40 },
};
console.log(JSON.stringify(report, null, 2));
if (hardHits.length) console.log("HARD", hardHits.slice(0, 6));
if (goldHits.length) console.log("GOLD", goldHits.slice(0, 6));
const ok = hardHits.length === 0 && goldHits.length === 0
  && mean <= 0.30 + 1e-3 && maxSeg <= 0.30 + 1e-3
  && turn * 180 / Math.PI < 100 && maxEarlyY < 0.55;
console.log(ok ? "PASS climb-collider-check" : "FAIL climb-collider-check");
process.exit(ok ? 0 : 1);
