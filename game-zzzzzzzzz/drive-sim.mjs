/**
 * Full drivability simulation for elevated/ramp/balcony/cornice/furniture network.
 */
import * as THREE from "./vendor/three.module.js";
import { DriveMode } from "./js/drive/driveMode.js";
import { TRACK_PATHS, CAR_SPAWN, ROAD_WIDTH_SCALE } from "./js/data/tracks.js";

// DOM stubs
if (typeof globalThis.document === "undefined") {
  const makeCtx = () => ({
    fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1, font: "",
    textAlign: "", textBaseline: "",
    fillRect() {}, strokeRect() {}, clearRect() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
    quadraticCurveTo() {}, bezierCurveTo() {}, arc() {}, ellipse() {},
    rect() {}, stroke() {}, fill() {}, clip() {}, save() {}, restore() {},
    translate() {}, rotate() {}, scale() {}, setTransform() {}, setLineDash() {},
    fillText() {}, strokeText() {}, measureText: () => ({ width: 0 }),
    drawImage() {}, createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => null,
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    putImageData() {},
  });
  globalThis.document = {
    createElement: (tag) => tag === "canvas"
      ? { width: 0, height: 0, getContext: () => makeCtx(), style: {} }
      : { style: {}, appendChild() {}, addEventListener() {}, removeEventListener() {} },
    addEventListener() {}, removeEventListener() {},
    getElementById: () => null, querySelector: () => null, body: { appendChild() {} },
  };
}
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;

const ELEV_GRAPH_KINDS = new Set([
  "elevated", "ramp", "balcony", "cornice", "shortcut", "mouse", "shaft", "chute",
]);
// Primary elevated deck kinds for snap sampling (exclude tubes/chutes that are intentional voids exits)
const DECK_KINDS = new Set(["elevated", "ramp", "balcony", "cornice"]);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
const drive = new DriveMode(scene, camera);
const tracks = drive.tracks;

const byId = Object.fromEntries(TRACK_PATHS.map((p) => [p.id, p]));
const elevPaths = TRACK_PATHS.filter((p) => ELEV_GRAPH_KINDS.has(p.kind));
const deckPaths = TRACK_PATHS.filter((p) => DECK_KINDS.has(p.kind));

function endPts(p) {
  return { start: p.points[0], end: p.points[p.points.length - 1] };
}
function dist3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
function distXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Join threshold ≈ path half-width sum * factor, floored */
function joinThresh(a, b) {
  const wa = (a.width || 0.35);
  const wb = (b.width || 0.35);
  return Math.max(0.22, (wa + wb) * 0.55);
}

// ─── Graph by endpoint proximity ───
const nodes = elevPaths.map((p) => p.id);
const adj = Object.fromEntries(nodes.map((id) => [id, []]));
const junctionGaps = [];

function tryLink(a, aEnd, b, bEnd, explicit = false) {
  const pa = aEnd === "start" ? a.points[0] : a.points[a.points.length - 1];
  const pb = bEnd === "start" ? b.points[0] : b.points[b.points.length - 1];
  // Also allow proximity to ANY point on closed / multi-point path (not just ends)
  let best = dist3(pa, pb);
  let via = bEnd;
  // Scan all points of b for near-hit from a's endpoint
  for (let i = 0; i < b.points.length; i++) {
    const d = dist3(pa, b.points[i]);
    if (d < best) { best = d; via = `pt${i}`; }
  }
  const thresh = joinThresh(a, b);
  if (best <= thresh) {
    if (!adj[a.id].includes(b.id)) adj[a.id].push(b.id);
    if (!adj[b.id].includes(a.id)) adj[b.id].push(a.id);
    return { ok: true, dist: best, thresh };
  }
  return { ok: false, dist: best, thresh };
}

// Link every elev pair by endpoint↔any-point proximity
for (let i = 0; i < elevPaths.length; i++) {
  for (let j = i + 1; j < elevPaths.length; j++) {
    const a = elevPaths[i], b = elevPaths[j];
    // Check both ends of a against b, and both ends of b against a
    const r1 = tryLink(a, "start", b, "start");
    const r2 = tryLink(a, "end", b, "start");
    // tryLink already scans all points; calling twice covers both ends of a
    void r1; void r2;
  }
}

// Also link floor↔elev at on-ramps: floor paths near ramp bottoms (for tour)
const floorPaths = TRACK_PATHS.filter((p) => p.kind === "floor" || p.kind === "outdoor" || p.kind === "flower" || p.kind === "tunnel");
const allGraphPaths = [...elevPaths, ...floorPaths];
const allNodes = allGraphPaths.map((p) => p.id);
const adjAll = Object.fromEntries(allNodes.map((id) => [id, [...(adj[id] || [])]]));
for (const a of elevPaths) {
  for (const b of floorPaths) {
    const pa0 = a.points[0], pa1 = a.points[a.points.length - 1];
    let best = Infinity;
    for (const q of b.points) {
      best = Math.min(best, dist3(pa0, q), dist3(pa1, q));
    }
    const thresh = Math.max(0.35, ((a.width || 0.35) + (b.width || 0.35)) * 0.65);
    if (best <= thresh) {
      if (!adjAll[a.id].includes(b.id)) adjAll[a.id].push(b.id);
      if (!adjAll[b.id].includes(a.id)) adjAll[b.id].push(a.id);
    }
  }
}
// floor-floor endpoint links
for (let i = 0; i < floorPaths.length; i++) {
  for (let j = i + 1; j < floorPaths.length; j++) {
    const a = floorPaths[i], b = floorPaths[j];
    const endsA = [a.points[0], a.points[a.points.length - 1]];
    let best = Infinity;
    for (const pa of endsA) {
      for (const q of b.points) best = Math.min(best, dist3(pa, q));
    }
    const endsB = [b.points[0], b.points[b.points.length - 1]];
    for (const pb of endsB) {
      for (const q of a.points) best = Math.min(best, dist3(pb, q));
    }
    const thresh = Math.max(0.4, ((a.width || 0.35) + (b.width || 0.35)) * 0.7);
    if (best <= thresh) {
      if (!adjAll[a.id].includes(b.id)) adjAll[a.id].push(b.id);
      if (!adjAll[b.id].includes(a.id)) adjAll[b.id].push(a.id);
    }
  }
}

function components(nodeList, adjacency) {
  const seen = new Set();
  const comps = [];
  for (const n of nodeList) {
    if (seen.has(n)) continue;
    const stack = [n];
    const comp = [];
    seen.add(n);
    while (stack.length) {
      const u = stack.pop();
      comp.push(u);
      for (const v of adjacency[u] || []) {
        if (!seen.has(v)) { seen.add(v); stack.push(v); }
      }
    }
    comps.push(comp);
  }
  comps.sort((a, b) => b.length - a.length);
  return comps;
}

const elevComps = components(nodes, adj);
const allComps = components(allNodes, adjAll);

// Dead-ends into void: elev path endpoint with no neighbor within thresh AND not closed loop
const deadEnds = [];
for (const p of deckPaths) {
  if (p.closed) continue;
  const ends = [
    { name: "start", pt: p.points[0] },
    { name: "end", pt: p.points[p.points.length - 1] },
  ];
  for (const e of ends) {
    let linked = false;
    let nearest = { id: null, d: Infinity };
    for (const q of elevPaths) {
      if (q.id === p.id) continue;
      for (const pt of q.points) {
        const d = dist3(e.pt, pt);
        if (d < nearest.d) nearest = { id: q.id, d };
        if (d <= joinThresh(p, q)) { linked = true; break; }
      }
      if (linked) break;
    }
    // Also check floor (ramp bottoms OK)
    if (!linked) {
      for (const q of floorPaths) {
        for (const pt of q.points) {
          const d = dist3(e.pt, pt);
          if (d < nearest.d) nearest = { id: q.id, d };
          if (d <= Math.max(0.4, ((p.width || 0.35) + (q.width || 0.35)) * 0.7)) {
            linked = true; break;
          }
        }
        if (linked) break;
      }
    }
    if (!linked) {
      deadEnds.push({
        pathId: p.id, end: e.name, kind: p.kind,
        pt: { x: +e.pt.x.toFixed(3), y: +e.pt.y.toFixed(3), z: +e.pt.z.toFixed(3) },
        nearest: nearest.id, nearestDist: +nearest.d.toFixed(3),
      });
    }
  }
}

// Junction gaps: for each elev endpoint, report if nearest other elev is just outside thresh
const softGaps = [];
for (const p of elevPaths) {
  if (p.closed) continue;
  for (const e of [{ name: "start", pt: p.points[0] }, { name: "end", pt: p.points[p.points.length - 1] }]) {
    let nearest = { id: null, d: Infinity, thresh: 0 };
    for (const q of elevPaths) {
      if (q.id === p.id) continue;
      const th = joinThresh(p, q);
      for (const pt of q.points) {
        const d = dist3(e.pt, pt);
        if (d < nearest.d) nearest = { id: q.id, d, thresh: th };
      }
    }
    // Soft gap: within 2× thresh but outside thresh
    if (nearest.d > nearest.thresh && nearest.d <= nearest.thresh * 2.2) {
      softGaps.push({
        pathId: p.id, end: e.name, nearest: nearest.id,
        dist: +nearest.d.toFixed(3), thresh: +nearest.thresh.toFixed(3),
      });
    }
  }
}

// Steep ramps: segment-wise and overall
const steepRamps = [];
const STEEP_SEG = 0.72; // rise/run per segment
const STEEP_OVERALL = 0.58;
for (const p of TRACK_PATHS.filter((x) => x.kind === "ramp")) {
  let run = 0, rise = 0;
  const segs = [];
  for (let i = 1; i < p.points.length; i++) {
    const a = p.points[i - 1], b = p.points[i];
    const r = Math.hypot(b.x - a.x, b.z - a.z);
    const h = Math.abs(b.y - a.y);
    run += r;
    rise += (b.y - a.y); // signed accumulate later abs
    const g = h / Math.max(r, 1e-6);
    if (g > STEEP_SEG) {
      segs.push({ i, grade: +g.toFixed(3), rise: +h.toFixed(3), run: +r.toFixed(3) });
    }
  }
  const overallRise = Math.abs(p.points.at(-1).y - p.points[0].y);
  const overall = overallRise / Math.max(run, 1e-6);
  if (overall > STEEP_OVERALL || segs.length) {
    steepRamps.push({
      id: p.id,
      overall: +overall.toFixed(3),
      overallRise: +overallRise.toFixed(3),
      run: +run.toFixed(3),
      steepSegs: segs,
    });
  }
}

// ─── Centerline snap sampling ───
function densify(points, closed, step = 0.4) {
  const pts = points.slice();
  if (closed && pts.length > 1) {
    const a = pts[0], b = pts[pts.length - 1];
    if (dist3(a, b) > 0.05) pts.push({ ...a });
  }
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const len = dist3(a, b);
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
  if (pts.length) out.push({ ...pts[pts.length - 1] });
  return out;
}

const snapReport = [];
let totalSamples = 0, totalOn = 0, totalSupp = 0, totalVoid = 0;
const badPaths = [];

for (const p of deckPaths) {
  const samples = densify(p.points, !!p.closed, 0.4);
  let on = 0, off = 0, supp = 0, voids = 0;
  const holes = [];
  for (const s of samples) {
    totalSamples++;
    const snap = tracks.querySnap(s.x, s.y, s.z, 2.0);
    const sameOrNear = snap.pathId === p.id
      || (snap.onTrack && DECK_KINDS.has(snap.kind))
      || (snap.supported && snap.elevated);
    if (snap.onTrack) { on++; totalOn++; }
    else { off++; }
    if (snap.supported) { supp++; totalSupp++; }
    else { voids++; totalVoid++; }
    // Hole: centerline sample not onTrack AND not supported (true void on deck)
    // Or: supported only via carpet/floor demotion while elevated expected
    if (!snap.onTrack) {
      const bad = !snap.supported
        || (snap.carpet && !snap.elevated)
        || (snap.kind === "void")
        || (snap.kind === "floor" && Math.abs((snap.y ?? 0) - s.y) > 0.55);
      if (bad) {
        holes.push({
          x: +s.x.toFixed(2), y: +s.y.toFixed(2), z: +s.z.toFixed(2),
          got: snap.kind, pathId: snap.pathId, onTrack: snap.onTrack, supported: snap.supported,
        });
      }
    }
  }
  const rate = on / samples.length;
  const entry = {
    id: p.id, kind: p.kind, samples: samples.length,
    onTrack: on, offTrack: off, supported: supp, voids,
    onRate: +rate.toFixed(3),
    holeCount: holes.length,
    holes: holes.slice(0, 5),
  };
  snapReport.push(entry);
  if (rate < 0.92 || holes.length > 0) badPaths.push(entry);
}

snapReport.sort((a, b) => a.onRate - b.onRate);

// ─── Greedy tour: CAR_SPAWN → primary ramps → cornice circuit lap ───
const PRIMARY_CLIMB = [
  "foyer_skirting",
  "ramp_foyer_to_landing",
  "landing_skirting",
  "ramp_landing_to_landing_cornice",
  "cornice_landing_east",
  "cornice_landing_west",
  "cornice_foyer",
  "ramp_stair_to_cornice",
  "ramp_console_to_foyer_cornice",
  "furniture_foyer_console",
  "ramp_foyer_console",
  "cornice_hall_west",
  "cornice_hall_east",
  "cornice_hall_cross_mid",
  "balcony_loop",
];

function bfsPath(startId, goalId, adjacency) {
  if (!adjacency[startId] || !adjacency[goalId]) return null;
  if (startId === goalId) return [startId];
  const q = [startId];
  const prev = { [startId]: null };
  while (q.length) {
    const u = q.shift();
    for (const v of adjacency[u] || []) {
      if (v in prev) continue;
      prev[v] = u;
      if (v === goalId) {
        const path = [];
        let cur = goalId;
        while (cur) { path.push(cur); cur = prev[cur]; }
        return path.reverse();
      }
      q.push(v);
    }
  }
  return null;
}

// Find path containing spawn
let spawnPathId = null;
{
  const snap = tracks.querySnap(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, 2.4);
  spawnPathId = snap.pathId || "foyer_skirting";
}

const tourTargets = [
  spawnPathId,
  "ramp_foyer_console",
  "furniture_foyer_console",
  "ramp_console_to_foyer_cornice",
  "cornice_foyer",
  "ramp_stair_to_cornice",
  "ramp_foyer_to_landing",
  "ramp_landing_to_landing_cornice",
  "cornice_landing_west",
  "cornice_hall_west",
  "cornice_hall_cross_mid",
  "cornice_hall_east",
  "cornice_conservatory",
  "balcony_loop",
].filter((id) => byId[id]);

const tourHops = [];
let tourOk = true;
let tourBreak = null;
for (let i = 1; i < tourTargets.length; i++) {
  const a = tourTargets[i - 1], b = tourTargets[i];
  const path = bfsPath(a, b, adjAll);
  if (!path) {
    // try elev-only
    const path2 = bfsPath(a, b, adj);
    if (!path2) {
      tourOk = false;
      tourBreak = { from: a, to: b };
      tourHops.push({ from: a, to: b, ok: false, hops: null });
      break;
    }
    tourHops.push({ from: a, to: b, ok: true, hops: path2.length - 1, via: path2 });
  } else {
    tourHops.push({ from: a, to: b, ok: true, hops: path.length - 1, via: path });
  }
}

// Continuous lap on cornice_foyer: walk samples in order, require onTrack
function walkCenterline(pathId, step = 0.35) {
  const p = byId[pathId];
  if (!p) return { ok: false, reason: "missing" };
  const samples = densify(p.points, !!p.closed, step);
  let breaks = 0;
  const breakPts = [];
  for (const s of samples) {
    const snap = tracks.querySnap(s.x, s.y + 0.02, s.z, 1.8);
    if (!snap.onTrack && !snap.nearDeck) {
      breaks++;
      if (breakPts.length < 6) breakPts.push({ ...s, kind: snap.kind, pathId: snap.pathId });
    }
  }
  return {
    ok: breaks === 0,
    samples: samples.length,
    breaks,
    breakPts: breakPts.map((b) => ({
      x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2),
      kind: b.kind, pathId: b.pathId,
    })),
  };
}

const corniceLap = walkCenterline("cornice_foyer", 0.35);
const balconyLap = walkCenterline("balcony_loop", 0.35);
const landingCornice = walkCenterline("cornice_landing_west", 0.35);

// Binary width: sample lateral offsets at halfW ± epsilon
const binaryIssues = [];
for (const p of deckPaths.slice(0, 40)) {
  const mid = p.points[Math.floor(p.points.length / 2)];
  if (!mid) continue;
  // Estimate tangent
  const i = Math.max(1, Math.floor(p.points.length / 2));
  const a = p.points[i - 1], b = p.points[Math.min(i, p.points.length - 1)];
  const tx = b.x - a.x, tz = b.z - a.z;
  const tlen = Math.hypot(tx, tz) || 1;
  const nx = -tz / tlen, nz = tx / tlen;
  const halfW = (p.width || 0.35) * 0.5;
  const inside = tracks.querySnap(mid.x + nx * halfW * 0.6, mid.y, mid.z + nz * halfW * 0.6, 1.6);
  const outside = tracks.querySnap(mid.x + nx * halfW * 1.25, mid.y, mid.z + nz * halfW * 1.25, 1.6);
  if (!inside.onTrack && !inside.nearDeck) {
    binaryIssues.push({ id: p.id, issue: "inside_half_not_onTrack", inside: inside.kind });
  }
  // Outside should NOT be onTrack (binary)
  if (outside.onTrack && outside.pathId === p.id) {
    binaryIssues.push({ id: p.id, issue: "outside_still_onTrack", distFactor: 1.25 });
  }
}

// Print report
const report = {
  ROAD_WIDTH_SCALE,
  elevPathCount: elevPaths.length,
  deckPathCount: deckPaths.length,
  elevComponents: elevComps.map((c) => ({ size: c.length, ids: c.slice(0, 12), more: c.length > 12 ? c.length - 12 : 0 })),
  elevComponentSizes: elevComps.map((c) => c.length),
  allNetworkComponents: allComps.map((c) => c.length),
  largestElevComp: elevComps[0]?.length,
  isolatedElev: elevComps.filter((c) => c.length <= 2).map((c) => c),
  deadEnds,
  softGaps: softGaps.slice(0, 25),
  softGapCount: softGaps.length,
  steepRamps,
  snapSummary: {
    totalSamples, totalOn, totalSupp, totalVoid,
    overallOnRate: +(totalOn / totalSamples).toFixed(4),
    overallSuppRate: +(totalSupp / totalSamples).toFixed(4),
    pathsBelow92: badPaths.filter((p) => p.onRate < 0.92).map((p) => ({ id: p.id, onRate: p.onRate, holes: p.holeCount })),
    pathsWithHoles: badPaths.filter((p) => p.holeCount > 0).map((p) => ({
      id: p.id, onRate: p.onRate, holes: p.holeCount, samples: p.holes,
    })),
  },
  worstSnap: snapReport.slice(0, 15),
  tour: { ok: tourOk, break: tourBreak, hops: tourHops, spawnPathId, targets: tourTargets },
  corniceLap, balconyLap, landingCornice,
  binaryIssues: binaryIssues.slice(0, 20),
};

console.log(JSON.stringify(report, null, 2));
