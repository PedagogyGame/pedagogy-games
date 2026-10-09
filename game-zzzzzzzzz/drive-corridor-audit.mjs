/**
 * logic3 — Drive corridor audit (all 8 PRIMARY paths).
 *  A) Car-box vs Drive colliders along every flat path (centerline + lateral drift ±0.35u):
 *     walls / pillars must never sit on the road (a hard wall across a flat = blocked lap).
 *  B) Wall-crossing table: every mansion wall the ribbon crosses → needed opening
 *     (along span = ribbon ±halfW + margin, y span = deck..deck+clear) vs authored opening.
 *  C) Unused drive openings (punched but no ribbon crosses) → Swiss-cheese candidates.
 *  D) Newel edge clearance (ribbon edge → newel collider box) on the real spline.
 * Not a ready claim — parent live-proves.
 */
import * as THREE from "./vendor/three.module.js";
import { Mansion } from "./js/mansion.js";
import { DriveMode } from "./js/drive/driveMode.js";
import { TRACK_PATHS, PRIMARY_CIRCUIT } from "./js/data/tracks.js";

if (typeof globalThis.document === "undefined") {
  const makeCtx = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : (k === "measureText" ? () => ({ width: 0 }) : (k === "getImageData" ? () => ({ data: new Uint8ClampedArray(4) }) : (typeof k === "string" && k.startsWith("create") ? () => ({ addColorStop() {} }) : () => {})))), set: (t, k, v) => { t[k] = v; return true; } });
  globalThis.document = {
    createElement: (t) => t === "canvas" ? { width: 0, height: 0, getContext: () => makeCtx(), style: {} }
      : { style: {}, classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {}, removeEventListener() {}, remove() {} },
    addEventListener() {}, removeEventListener() {}, getElementById: () => null, querySelector: () => null,
    head: { appendChild() {} }, body: { appendChild() {} },
  };
}
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;

const QUIET = process.argv.includes("--quiet");
const JSON_OUT = process.argv.includes("--json");
const fails = [];
const ok = (name, pass, detail = "") => {
  if (!QUIET || !pass) console.log((pass ? "PASS  " : "FAIL  ") + name + (detail ? " — " + detail : ""));
  if (!pass) fails.push(name);
};

// Record every wall + its openings as the mansion builds
const walls = [];
const origAdd = Mansion.prototype._addWallWithOpenings;
Mansion.prototype._addWallWithOpenings = function (group, wall, color, thick, trim, openings, plaster) {
  walls.push({ room: this.__curRoom || "?", wall, openings: openings ? openings.map((o) => ({ ...o })) : [] });
  return origAdd.call(this, group, wall, color, thick, trim, openings, plaster);
};
const origDrive = Mansion.prototype._driveOpeningsForWall;
Mansion.prototype._driveOpeningsForWall = function (room, side) {
  this.__curRoom = room.id + ":" + side;
  return origDrive.call(this, room, side);
};

const scene = new THREE.Scene();
const mansion = new Mansion(scene);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
const drive = new DriveMode(scene, camera);
drive.setWallColliders(mansion.getColliders());
const cols = drive._wallColliders;
const RIDE = 0.012;
const carR = drive._carRadius;

if (process.env.WALLDBG) {
  const re = new RegExp(process.env.WALLDBG);
  for (const w of walls) if (re.test(w.room)) console.log("WALL", w.room, JSON.stringify(w.wall.pos), JSON.stringify(w.wall.size), JSON.stringify(w.openings.map((o) => [o.along, o.width, o.y0, +o.y1.toFixed(2)])));
}
const byId = Object.fromEntries(TRACK_PATHS.map((p) => [p.id, p]));
function samplePath(p, step = 0.05) {
  const pts = p.points.map((q) => new THREE.Vector3(q.x, q.y, q.z));
  if (pts.length < 3) {
    const L = pts[0].distanceTo(pts[1]);
    const n = Math.max(2, Math.ceil(L / step));
    return Array.from({ length: n + 1 }, (_, i) => pts[0].clone().lerp(pts[1], i / n));
  }
  const c = new THREE.CatmullRomCurve3(pts, !!p.closed, "catmullrom", p.tension ?? 0.15);
  const n = Math.max(8, Math.ceil(c.getLength() / step));
  return c.getSpacedPoints(n);
}
const samples = {};
for (const id of PRIMARY_CIRCUIT) samples[id] = samplePath(byId[id]);
const tangentAt = (arr, i) => {
  const a = arr[Math.max(0, i - 1)], b = arr[Math.min(arr.length - 1, i + 1)];
  const tx = b.x - a.x, tz = b.z - a.z; const L = Math.hypot(tx, tz) || 1;
  return { tx: tx / L, tz: tz / L };
};

// ── A) flats: car box vs hard colliders ─────────────────────────────
const report = { flatHits: {}, crossings: [], unused: [], newel: null };
for (const id of PRIMARY_CIRCUIT) {
  const p = byId[id];
  if (p.kind === "ramp") continue; // ramps pierce walls on-track; climb-collider-check covers visuals
  const arr = samples[id];
  const hits = [];
  for (let i = 0; i < arr.length; i++) {
    const s = arr[i];
    const { tx, tz } = tangentAt(arr, i);
    const rx = -tz, rz = tx;
    for (const lat of [0, 0.2, -0.2, 0.35, -0.35]) {
      const x = s.x + rx * lat, z = s.z + rz * lat;
      const y = s.y + RIDE;
      const y0 = y + 0.02, y1 = y + 0.12; // logic3: matches driveMode band (tyres ride ON wall tops)
      for (const b of cols) {
        if (b.driveKind === "stair" || b.driveKind === "furniture") continue;
        if (y1 < b.min.y || y0 > b.max.y) continue;
        if (x + carR > b.min.x && x - carR < b.max.x && z + carR > b.min.z && z - carR < b.max.z) {
          hits.push({ lat, x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), kind: b.driveKind,
            box: [b.min.x, b.max.x, b.min.y, b.max.y, b.min.z, b.max.z].map((v) => +v.toFixed(2)) });
          break;
        }
      }
    }
  }
  const center = hits.filter((h) => h.lat === 0);
  report.flatHits[id] = { center: center.length, drift: hits.length - center.length, eg: hits.slice(0, 3) };
  ok(`flat-hard-free-${id}`, center.length === 0 && hits.length === 0,
    `center=${center.length} drift±0.35=${hits.length - center.length}${hits[0] ? " eg=" + JSON.stringify(hits[0]) : ""}`);
}
// Soft furniture on flats (report only)
for (const id of PRIMARY_CIRCUIT) {
  const p = byId[id]; if (p.kind === "ramp") continue;
  let n = 0; let eg = null;
  for (const s of samples[id]) {
    const y = s.y + RIDE, y0 = y + 0.02, y1 = y + 0.12;
    for (const b of cols) {
      if (!(b.driveKind === "stair" || b.driveKind === "furniture")) continue;
      if (y1 < b.min.y || y0 > b.max.y) continue;
      if (s.x + carR > b.min.x && s.x - carR < b.max.x && s.z + carR > b.min.z && s.z - carR < b.max.z) { n++; eg = eg || { x: s.x, z: s.z, kind: b.driveKind }; break; }
    }
  }
  ok(`flat-soft-free-${id}`, n === 0, `n=${n}${eg ? " eg=" + JSON.stringify(eg) : ""}`);
}

// ── B) wall crossings → needed opening ─────────────────────────────
const CLEAR_ABOVE = 1.9;   // lintel height above deck (tiny car + chase cam ~0.35)
const MARGIN = 0.25;       // along-wall margin beyond ribbon edge
const DECK_BELOW = 0.22;   // ramp slab + keel under deck
for (const w of walls) {
  const [sx, sy, sz] = w.wall.size; const [px, py, pz] = w.wall.pos;
  const horizontal = sx > sz;
  const half = (horizontal ? sz : sx) / 2 + 0.02;
  const yBot = py - sy / 2, yTop = py + sy / 2;
  const aMin = (horizontal ? px : pz) - (horizontal ? sx : sz) / 2;
  const aMax = aMin + (horizontal ? sx : sz);
  const needs = [];
  for (const id of PRIMARY_CIRCUIT) {
    const p = byId[id]; const halfW = p.width / 2; const arr = samples[id];
    let span = null;
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i]; const { tx, tz } = tangentAt(arr, i); const rx = -tz, rz = tx;
      const deck = s.y + RIDE;
      const y0 = deck - (p.kind === "ramp" ? DECK_BELOW : 0.06), y1 = deck + CLEAR_ABOVE;
      if (y1 < yBot || y0 > yTop) continue;
      for (let k = -10; k <= 10; k++) {
        const lat = (k / 10) * halfW;
        const x = s.x + rx * lat, z = s.z + rz * lat;
        const perp = horizontal ? z - pz : x - px;
        if (Math.abs(perp) > half) continue;
        const along = horizontal ? x : z;
        if (along < aMin || along > aMax) continue;
        if (!span) span = { id, a0: along, a1: along, y0: Math.max(yBot, deck - (p.kind === "ramp" ? DECK_BELOW : 0)), y1: Math.min(yTop, deck + CLEAR_ABOVE), cy0: deck, cy1: deck };
        span.a0 = Math.min(span.a0, along); span.a1 = Math.max(span.a1, along);
        span.y0 = Math.min(span.y0, Math.max(yBot, deck - (p.kind === "ramp" ? DECK_BELOW : 0)));
        span.y1 = Math.max(span.y1, Math.min(yTop, deck + CLEAR_ABOVE));
        span.cy0 = Math.min(span.cy0, deck); span.cy1 = Math.max(span.cy1, deck);
      }
    }
    if (span) needs.push(span);
  }
  // The car/deck must be below the wall top to need an opening at all
  // (logic3) a ramp passing UNDER a hanging wall bottom also needs clearance: deck+CLEAR_ABOVE > yBot
  const real = needs.filter((n) => n.cy0 + CLEAR_ABOVE > yBot + 0.02 && n.cy0 < yTop - 0.02);
  for (const n of real) {
    const need = { a0: Math.max(aMin, n.a0 - MARGIN), a1: Math.min(aMax, n.a1 + MARGIN), y0: n.y0, y1: n.y1 };
    // covered by an authored opening?
    const cov = w.openings.find((o) => o.along - o.width / 2 <= need.a0 + 0.02 && o.along + o.width / 2 >= need.a1 - 0.02
      && o.y0 <= need.y0 + 0.02 && o.y1 >= Math.min(need.y1, yTop) - 0.02);
    // car body itself (centerline ± car) must be clear even if the ribbon edge brushes
    report.crossings.push({ wall: w.room, path: n.id, need: Object.fromEntries(Object.entries(need).map(([k, v]) => [k, +v.toFixed(2)])), deckY: [+n.cy0.toFixed(2), +n.cy1.toFixed(2)], covered: !!cov, opening: cov ? { along: cov.along, width: cov.width, y0: +cov.y0.toFixed(2), y1: +cov.y1.toFixed(2) } : null });
  }
  for (const o of w.openings) {
    if (!o.driveOnly) {
      // flag big openings: does any ribbon cross it?
      const used = real.some((n) => n.a1 >= o.along - o.width / 2 && n.a0 <= o.along + o.width / 2);
      if (!used && (o.width >= 3.2 || (o.y1 - o.y0) >= sy - 0.1)) {
        report.unused.push({ wall: w.room, along: o.along, width: o.width, y0: +o.y0.toFixed(2), y1: +o.y1.toFixed(2), fullH: o.y1 >= yTop - 0.05 });
      }
    }
  }
}
for (const c of report.crossings) {
  ok(`opening-${c.wall}-${c.path}`, c.covered, `need a∈[${c.need.a0},${c.need.a1}] y∈[${c.need.y0},${c.need.y1}] deckY=${c.deckY.join("..")} have=${c.opening ? JSON.stringify(c.opening) : "NONE"}`);
}
if (!QUIET) for (const u of report.unused) console.log(`INFO  unused-big-opening ${u.wall} along=${u.along} w=${u.width} y=${u.y0}..${u.y1}${u.fullH ? " fullH" : ""}`);

// ── D) Newel clearance on the real spline ───────────────────────────
{
  const newel = mansion.getColliders().find((c) => c.driveKind === "pillar" && c.min.y >= 4.0 && c.max.y < 6.5
    && (c.max.x - c.min.x) < 0.7 && (c.max.z - c.min.z) < 0.7 && Math.abs((c.min.x + c.max.x) / 2 + 2.2) < 1.2 && Math.abs((c.min.z + c.max.z) / 2 - 2.2) < 1.2);
  let minEdge = Infinity, minCenter = Infinity, where = null;
  if (newel) {
    const ncx = (newel.min.x + newel.max.x) / 2, ncz = (newel.min.z + newel.max.z) / 2;
    for (const id of PRIMARY_CIRCUIT) {
      const p = byId[id]; if (Math.abs(p.points[0].y - 4.2) > 0.2 && Math.abs(p.points.at(-1).y - 4.2) > 0.2) continue;
      for (const s of samples[id]) {
        if (Math.abs(s.y - 4.2) > 0.6) continue;
        const dx = Math.max(newel.min.x - s.x, 0, s.x - newel.max.x);
        const dz = Math.max(newel.min.z - s.z, 0, s.z - newel.max.z);
        const dBox = Math.hypot(dx, dz);
        const edge = dBox - p.width / 2;
        if (edge < minEdge) { minEdge = edge; where = { id, x: +s.x.toFixed(2), z: +s.z.toFixed(2) }; }
        minCenter = Math.min(minCenter, Math.hypot(s.x - ncx, s.z - ncz));
      }
    }
    report.newel = { center: [ncx, ncz], box: [newel.min.x, newel.max.x, newel.min.z, newel.max.z], minEdge, minCenter, where };
  }
  ok("newel-edge-clearance-ge-0.40", !!newel && minEdge >= 0.40,
    newel ? `edge→box=${minEdge.toFixed(3)} centerDist=${minCenter.toFixed(3)} at ${JSON.stringify(where)}` : "newel missing");
}

// ── E) Ribbon overlap between non-adjacent paths (z-fight / snap confusion) ─
{
  const order = PRIMARY_CIRCUIT;
  let worst = { d: Infinity };
  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j < order.length; j++) {
      const adj = j === i + 1 || (i === 0 && j === order.length - 1);
      // Circuit distance 2 with a short middle path (e.g. the 0.95u S/F straight between
      // foyer_finish and foyer_to_climb_a): collinear chain, not an overlap.
      const cd = Math.min(j - i, order.length - (j - i));
      const mid = cd === 2 ? byId[order[(j - i === 2) ? i + 1 : (j + 1) % order.length]] : null;
      const midShort = mid && Math.hypot(mid.points[0].x - mid.points.at(-1).x, mid.points[0].z - mid.points.at(-1).z) < 3.0;
      const A = samples[order[i]], B = samples[order[j]];
      const wA = byId[order[i]].width / 2, wB = byId[order[j]].width / 2;
      for (let a = 0; a < A.length; a += 2) {
        for (let b = 0; b < B.length; b += 2) {
          if (Math.abs(A[a].y - B[b].y) > 0.6) continue;
          const d = Math.hypot(A[a].x - B[b].x, A[a].z - B[b].z);
          // Adjacent paths: ignore the kiss neighbourhood (within 3u of the shared endpoint)
          if (adj) {
            const kiss = j === i + 1 ? byId[order[i]].points.at(-1) : byId[order[j]].points.at(-1);
            if (Math.hypot(A[a].x - kiss.x, A[a].z - kiss.z) < 3.0 || Math.hypot(B[b].x - kiss.x, B[b].z - kiss.z) < 3.0) continue;
          }
          if (midShort) {
            const e0 = mid.points[0], e1 = mid.points.at(-1);
            const near = (P) => Math.min(Math.hypot(P.x - e0.x, P.z - e0.z), Math.hypot(P.x - e1.x, P.z - e1.z)) < 3.0;
            if (near(A[a]) || near(B[b])) continue;
          }
          const gap = d - wA - wB;
          if (gap < worst.d) worst = { d: gap, a: order[i], b: order[j], at: [+A[a].x.toFixed(2), +A[a].z.toFixed(2)] };
        }
      }
    }
  }
  ok("no-foreign-ribbon-overlap", worst.d >= 0.0, `minGap=${worst.d.toFixed(2)} ${worst.a}~${worst.b} at ${JSON.stringify(worst.at)}`);
  report.overlap = worst;
}
// Self-overlap within a path (double-back)
for (const id of PRIMARY_CIRCUIT) {
  const A = samples[id]; const w = byId[id].width;
  let bad = 0; let eg = null;
  // arc-length index spacing
  for (let a = 0; a < A.length; a += 2) {
    for (let b = a + 2; b < A.length; b += 2) {
      let arc = 0; // approx arc between a and b
      arc = (b - a) * 0.05;
      if (arc < w * 2.2) continue;
      if (Math.abs(A[a].y - A[b].y) > 0.6) continue;
      const d = Math.hypot(A[a].x - A[b].x, A[a].z - A[b].z);
      if (d < w) { bad++; eg = eg || [+A[a].x.toFixed(2), +A[a].z.toFixed(2)]; }
    }
  }
  ok(`no-self-overlap-${id}`, bad === 0, `pairs=${bad}${eg ? " at " + JSON.stringify(eg) : ""}`);
}
// Junction tangent continuity (no reversal at kisses)
for (let i = 0; i < PRIMARY_CIRCUIT.length; i++) {
  const a = samples[PRIMARY_CIRCUIT[i]], b = samples[PRIMARY_CIRCUIT[(i + 1) % PRIMARY_CIRCUIT.length]];
  const ta = tangentAt(a, a.length - 1), tb = tangentAt(b, 0);
  const ang = Math.acos(Math.max(-1, Math.min(1, ta.tx * tb.tx + ta.tz * tb.tz))) * 180 / Math.PI;
  ok(`kiss-tangent-${PRIMARY_CIRCUIT[i]}->${PRIMARY_CIRCUIT[(i + 1) % PRIMARY_CIRCUIT.length]}`, ang <= 35, `turn=${ang.toFixed(1)}°`);
}

// ── G) Grade on the RENDERED spline (not just control points) — Ben: every segment ≤30%
for (const id of ["climb_a", "climb_b"]) {
  const arr = samples[id]; let maxG = 0, at = null;
  const W = 10; // 0.5u windows (sample step 0.05) — what a wheelbase actually feels
  for (let i = W; i < arr.length; i++) {
    const run = Math.hypot(arr[i].x - arr[i - W].x, arr[i].z - arr[i - W].z) || 1e-6;
    const g = Math.abs(arr[i].y - arr[i - W].y) / run;
    if (g > maxG) { maxG = g; at = [+arr[i].x.toFixed(2), +arr[i].y.toFixed(2), +arr[i].z.toFixed(2)]; }
  }
  report["grade_" + id] = { maxG, at };
  ok(`spline-grade-${id}-le-0.300`, maxG <= 0.300, `maxSeg=${maxG.toFixed(4)} at ${JSON.stringify(at)}`);
}

// ── F) Visual obstruction: any mansion mesh inside the lane volume (ribbon footprint,
//     deck+0.004 … deck+0.55) — rugs over asphalt, decor on lanes, lips across the road.
{
  mansion.root.updateMatrixWorld(true);
  const boxes = [];
  mansion.root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const b = new THREE.Box3().setFromObject(o);
    if (!Number.isFinite(b.min.x)) return;
    boxes.push({ b, name: o.name || o.parent?.name || o.geometry.type });
  });
  const hitsBy = {};
  for (const id of PRIMARY_CIRCUIT) {
    const p = byId[id]; const arr = samples[id]; const halfW = p.width / 2;
    const found = new Map();
    for (let i = 0; i < arr.length; i += 2) {
      const s = arr[i]; const { tx, tz } = tangentAt(arr, i); const rx = -tz, rz = tx;
      const deck = s.y + RIDE;
      for (let k = -4; k <= 4; k++) {
        const lat = (k / 4) * (halfW - 0.05);
        const x = s.x + rx * lat, z = s.z + rz * lat;
        for (const { b, name } of boxes) {
          if (x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z) continue;
          if (b.max.y <= deck + 0.004 || b.min.y >= deck + 0.55) continue;
          const key = name + "@" + [b.min.x, b.min.y, b.min.z].map((v) => v.toFixed(2)).join(",");
          if (!found.has(key)) found.set(key, { name, lat: +lat.toFixed(2), at: [+x.toFixed(2), +deck.toFixed(2), +z.toFixed(2)], box: [b.min.x, b.max.x, b.min.y, b.max.y, b.min.z, b.max.z].map((v) => +v.toFixed(2)) });
        }
      }
    }
    hitsBy[id] = [...found.values()];
    ok(`lane-visual-clear-${id}`, found.size === 0, found.size ? `n=${found.size} eg=${JSON.stringify(hitsBy[id].slice(0, 4))}` : "n=0");
  }
  report.visual = hitsBy;
}

// ── logic6 F) Walkable (non-scenic) stairs never stand over a climb hole or the climb ──
{
  const { ROOMS } = await import("./js/data/rooms.js");
  const landing = ROOMS.landing || Object.values(ROOMS).find((r) => r.id === "landing");
  const foyer = ROOMS.foyer || Object.values(ROOMS).find((r) => r.id === "foyer");
  const holes = [...mansion._storyApertures(landing, "floor"), ...mansion._storyApertures(foyer, "ceiling")];
  const overlap = (a, b, m = 0) => a.maxX + m > b.minX && a.minX - m < b.maxX && a.maxZ + m > b.minZ && a.minZ - m < b.maxZ;
  const ribbons = [];
  for (const p of TRACK_PATHS) {
    if (p.disabled) continue;
    const pts = p.points.map((q) => new THREE.Vector3(q.x, q.y, q.z));
    const sp = pts.length >= 3 ? new THREE.CatmullRomCurve3(pts, false, "catmullrom", p.tension ?? 0.15).getSpacedPoints(400) : pts;
    ribbons.push({ id: p.id, hw: (p.width ?? 2.2) / 2, sp });
  }
  const walk = mansion.ramps.filter((r) => r.priority === 10);
  ok("stairs-walkable-found", walk.length > 0, `n=${walk.length}`);
  for (const r of walk) {
    const hit = holes.filter((h) => overlap(r, h, 0.3));
    let clr = 99, at = "";
    const yLo = Math.min(r.fromY, r.toY) - 0.5, yHi = Math.max(r.fromY, r.toY) + 0.5;
    for (const rb of ribbons) for (const q of rb.sp) {
      if (q.y < yLo || q.y > yHi) continue;
      const dx = Math.max(r.minX - q.x, 0, q.x - r.maxX), dz = Math.max(r.minZ - q.z, 0, q.z - r.maxZ);
      const d = Math.hypot(dx, dz) - rb.hw;
      if (d < clr) { clr = d; at = rb.id; }
    }
    const tag = `${r.x0},${r.z0}`;
    ok(`stair-clear-of-climb-holes@${tag}`, hit.length === 0, hit.length ? JSON.stringify(hit) : "0 holes within 0.3u");
    ok(`stair-clear-of-ribbon@${tag}`, clr >= 0.3, `edge clearance ${clr.toFixed(2)}u (${at})`);
  }
}

if (JSON_OUT) console.log(JSON.stringify(report, null, 1));
console.log(fails.length ? `\n${fails.length} FAIL(s): ${fails.join(", ")}` : "\nALL PASS");
process.exit(fails.length ? 1 : 0);
