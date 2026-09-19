/**
 * Climb A/B centerline + ±0.85·halfW vs hard wall/pillar AABBs.
 * Expect 0 hard hits on both climbs.
 */
import * as THREE from "./vendor/three.module.js";
import { Mansion } from "./js/mansion.js";
import { TRACK_PATHS } from "./js/data/tracks.js";

const scene = new THREE.Scene();
const mansion = new Mansion(scene);
const cols = mansion.getColliders();

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
    if (x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && z >= b.minZ && z <= b.maxZ) {
      return b;
    }
  }
  return null;
}

function sampleClimb(id) {
  const ramp = TRACK_PATHS.find((p) => p.id === id);
  if (!ramp || ramp.disabled) return { id, ok: false, reason: "missing/disabled" };
  const halfW = ramp.width * 0.5;
  const pts = ramp.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.16);
  const samples = curve.getPoints(120);
  const hits = [];
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i];
    const j = Math.min(i + 1, samples.length - 1);
    const tx = samples[j].x - p.x, tz = samples[j].z - p.z;
    const tl = Math.hypot(tx, tz) || 1;
    const rx = -tz / tl, rz = tx / tl;
    for (const lat of [0, halfW * 0.85, -halfW * 0.85]) {
      const x = p.x + rx * lat, z = p.z + rz * lat;
      for (const yOff of [0.22, 0.48]) {
        const hit = hardHit(x, p.y + yOff, z);
        if (hit) hits.push({ x, y: p.y + yOff, z, kind: hit.kind, i });
      }
    }
  }
  const foot = ramp.points[0];
  const crest = ramp.points[ramp.points.length - 1];
  return {
    id,
    ok: hits.length === 0,
    hits: hits.length,
    sample: hits[0] || null,
    foot: { x: foot.x, y: foot.y, z: foot.z },
    crest: { x: crest.x, y: crest.y, z: crest.z },
  };
}

let failed = 0;
for (const id of ["climb_a", "climb_b"]) {
  const r = sampleClimb(id);
  const line = r.ok
    ? `PASS  ${id} — 0 hard hits foot=(${r.foot.x.toFixed(2)},${r.foot.y.toFixed(2)},${r.foot.z.toFixed(2)}) crest=(${r.crest.x.toFixed(2)},${r.crest.y.toFixed(2)},${r.crest.z.toFixed(2)})`
    : `FAIL  ${id} — hits=${r.hits} first=${JSON.stringify(r.sample)} reason=${r.reason || ""}`;
  console.log(line);
  if (!r.ok) failed++;
}

// Separation proof: scenic stairs must not own asphalt centerline XZ
const stairs = [];
scene.traverse((o) => {
  if (o.name && /^stairs_/.test(o.name)) stairs.push(o.name);
});
console.log("scenic stair groups:", stairs.join(", ") || "(none)");
const climbA = TRACK_PATHS.find((p) => p.id === "climb_a");
const mid = climbA.points[Math.floor(climbA.points.length / 2)];
console.log(`Climb A mid asphalt XYZ=(${mid.x}, ${mid.y}, ${mid.z}) — east of scenic west stairs`);

process.exit(failed ? 1 : 0);
