/**
 * Full primary Drive circuit audit:
 * 1) Sample EVERY enabled path centerline + ±halfW edges at car height vs hard wall/pillar
 * 2) Float check: tour car along circuit; |car.y - snap.y| on-ribbon
 * 3) Summarize widths / CAR_SCALE
 */
import * as THREE from "./vendor/three.module.js";
import { Mansion } from "./js/mansion.js";
import { TrackSystem } from "./js/drive/tracks.js";
import { RCCar, CAR_SCALE } from "./js/drive/car.js";
import { TRACK_PATHS, PRIMARY_CIRCUIT, ROAD_WIDTH_SCALE } from "./js/data/tracks.js";

const scene = new THREE.Scene();
const mansion = new Mansion(scene);
const tracks = new TrackSystem(scene);
const car = new RCCar(scene);
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

const byId = Object.fromEntries(TRACK_PATHS.map((p) => [p.id, p]));
const pathReports = [];
let totalHardHits = 0;
const allHitDetails = [];

for (const pathId of PRIMARY_CIRCUIT) {
  const path = byId[pathId];
  if (!path || path.disabled) {
    pathReports.push({ id: pathId, status: "MISSING_OR_DISABLED", hardHits: -1 });
    continue;
  }
  const halfW = path.width * 0.5;
  const closed = !!path.closed;
  const tension = path.tension ?? 0.5;
  const pts = path.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  const curve = new THREE.CatmullRomCurve3(pts, closed, "catmullrom", tension);
  const nSamples = Math.max(80, Math.floor(curve.getLength() * 8));
  const samples = curve.getPoints(nSamples);
  const hits = [];
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i];
    const j = Math.min(i + 1, samples.length - 1);
    const tx = samples[j].x - p.x, tz = samples[j].z - p.z;
    const tl = Math.hypot(tx, tz) || 1;
    const rx = -tz / tl, rz = tx / tl;
    // Full ±halfW edges (Ben: passable everywhere there is road)
    for (const lat of [0, halfW, -halfW, halfW * 0.5, -halfW * 0.5]) {
      const x = p.x + rx * lat, z = p.z + rz * lat;
      for (const yOff of [0.18, 0.35, 0.48]) {
        const y = p.y + yOff;
        const h = hardHit(x, y, z);
        if (h) {
          hits.push({
            i, lat: +lat.toFixed(3), yOff,
            x: +x.toFixed(3), y: +p.y.toFixed(3), z: +z.toFixed(3),
            kind: h.kind,
            box: {
              x: [+h.minX.toFixed(2), +h.maxX.toFixed(2)],
              y: [+h.minY.toFixed(2), +h.maxY.toFixed(2)],
              z: [+h.minZ.toFixed(2), +h.maxZ.toFixed(2)],
            },
          });
        }
      }
    }
  }
  // Dedup by sample index + lat bucket
  const seen = new Set();
  const uniq = [];
  for (const h of hits) {
    const k = `${h.i}:${h.lat}:${h.yOff}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(h);
  }
  totalHardHits += uniq.length;
  for (const h of uniq.slice(0, 12)) allHitDetails.push({ path: pathId, ...h });
  pathReports.push({
    id: pathId,
    kind: path.kind,
    width: +path.width.toFixed(3),
    halfW: +halfW.toFixed(3),
    samples: samples.length,
    hardHits: uniq.length,
    firstHits: uniq.slice(0, 5).map((h) => ({
      i: h.i, lat: h.lat, xz: [h.x, h.z], y: h.y, kind: h.kind, box: h.box,
    })),
  });
}

// ── Float check: simulate along each primary path centerline ──
function pathPoint(pathId, tFrac) {
  const segs = tracks.segments.filter((s) => s.pathId === pathId);
  if (!segs.length) return null;
  let total = 0;
  const lens = segs.map((s) => {
    const L = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y, s.b.z - s.a.z) || 1e-6;
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

const floatByPath = {};
let globalMaxAbsDy = 0;
let airborneFrames = 0;
let onRibbonFrames = 0;
let maxAirDy = 0;

for (const pathId of PRIMARY_CIRCUIT) {
  const a = pathPoint(pathId, 0.02);
  if (!a) {
    floatByPath[pathId] = { error: "no segments" };
    continue;
  }
  car.setPose(a.x, a.y + 0.02, a.z, a.yaw);
  car.speed = 0.85;
  car.crashed = false;
  tracks._lastPathId = pathId;
  tracks._lastPathKind = byId[pathId]?.kind || "floor";
  let maxAbsDy = 0, samples = 0, airN = 0, onN = 0;
  const end = pathPoint(pathId, 0.98);
  const frames = pathId.includes("ramp_foyer") ? 1600 : 900;
  for (let f = 0; f < frames; f++) {
    const pos = car.position;
    const snap = tracks.querySnap(pos.x, pos.y, pos.z, 1.65, car.yaw);
    // User throttle/steer only — mild yaw align for staying on ribbon in headless tour
    if (snap.onTrack && snap.yaw != null && (byId[pathId]?.kind === "ramp" || byId[pathId]?.kind === "balcony")) {
      let dy = snap.yaw - car.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      car.yaw += dy * 0.28;
    }
    car.update(1 / 60, { forward: true, back: false, left: false, right: false, boost: false }, snap);
    const p = car.position;
    if (snap.onTrack && snap.y != null) {
      onN++;
      onRibbonFrames++;
      const ady = Math.abs(p.y - snap.y);
      maxAbsDy = Math.max(maxAbsDy, ady);
      globalMaxAbsDy = Math.max(globalMaxAbsDy, ady);
      // Airborne latch: car well above snap while claiming onTrack on floor
      if (ady > 0.12 && (snap.kind === "floor" || snap.kind === "outdoor")) {
        airN++;
        airborneFrames++;
        maxAirDy = Math.max(maxAirDy, ady);
      }
      samples++;
    }
    if (end && Math.hypot(p.x - end.x, p.z - end.z) < 0.6 && Math.abs(p.y - end.y) < 0.7) break;
  }
  floatByPath[pathId] = {
    maxAbsDy: +maxAbsDy.toFixed(4),
    onRibbon: onN,
    airSuspect: airN,
  };
}

const widths = Object.fromEntries(
  PRIMARY_CIRCUIT.map((id) => [id, byId[id] ? +byId[id].width.toFixed(3) : null])
);

const report = {
  carScale: CAR_SCALE,
  roadWidthScale: ROAD_WIDTH_SCALE,
  widths,
  pathHardHits: pathReports,
  totalHardHits,
  hitSamples: allHitDetails.slice(0, 40),
  float: {
    byPath: floatByPath,
    globalMaxAbsDy: +globalMaxAbsDy.toFixed(4),
    airborneFrames,
    onRibbonFrames,
    maxAirDy: +maxAirDy.toFixed(4),
  },
};

console.log(JSON.stringify(report, null, 2));
const hardOk = totalHardHits === 0;
const floatOk = globalMaxAbsDy < 0.08 && airborneFrames === 0;
console.log(hardOk ? "PASS hardHits=0 all paths" : `FAIL hardHits=${totalHardHits}`);
console.log(floatOk
  ? `PASS float maxΔY=${globalMaxAbsDy.toFixed(4)} air=0`
  : `FAIL float maxΔY=${globalMaxAbsDy.toFixed(4)} air=${airborneFrames}`);
process.exit(hardOk && floatOk ? 0 : 1);
