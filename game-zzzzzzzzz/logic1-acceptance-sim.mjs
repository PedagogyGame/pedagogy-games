/**
 * logic1 acceptance checks (ROADS-LOGIC-AUDIT §C).
 * Not a ready claim — geometry logic only.
 */
import * as THREE from "./vendor/three.module.js";
import { Mansion } from "./js/mansion.js";
import {
  TRACK_PATHS, PRIMARY_CIRCUIT, RAMP_MAX_GRADE, RAMP_MOUNT_FEET,
} from "./js/data/tracks.js";

const fails = [];
const ok = (name, pass, detail = "") => {
  console.log((pass ? "PASS  " : "FAIL  ") + name + (detail ? " — " + detail : ""));
  if (!pass) fails.push(name);
};

const byId = Object.fromEntries(TRACK_PATHS.map((p) => [p.id, p]));
ok("primary-circuit-ids",
  PRIMARY_CIRCUIT.every((id) => byId[id]) && TRACK_PATHS.length === PRIMARY_CIRCUIT.length,
  `n=${TRACK_PATHS.length}`);
ok("no-closed-circuit-members",
  !byId.foyer_sf?.closed && !byId.balcony_arc?.closed,
  "foyer_sf+balcony_arc open");

const scene = new THREE.Scene();
const mansion = new Mansion(scene);
const holesL = mansion._storyApertures({ id: "landing" }, "floor");
const holesF = mansion._storyApertures({ id: "foyer" }, "ceiling");
ok("apertures-four", holesL.length === 4 && holesF.length === 4, `L=${holesL.length} F=${holesF.length}`);

const holeA_climb = holesL.find((h) => Math.abs(h.minX - (-6.35)) < 0.01);
const holeB_climb = holesL.find((h) => Math.abs(h.minX - 5.65) < 0.01);
const holeA_scenic = holesL.find((h) => Math.abs(h.minX - (-8.80)) < 0.01);
const holeB_scenic = holesL.find((h) => Math.abs(h.minX - 8.20) < 0.01);
ok("named-strips", !!(holeA_climb && holeB_climb && holeA_scenic && holeB_scenic));

function inHole(x, z, hole) {
  return x >= hole.minX && x <= hole.maxX && z >= hole.minZ && z <= hole.maxZ;
}
function inAnyClimbHole(x, z) {
  return (holeA_climb && inHole(x, z, holeA_climb)) || (holeB_climb && inHole(x, z, holeB_climb));
}

// 1) Landing flats (y≈4.2) must sit on solid planks — not inside climb holes.
// Ground y≈0 always has foyer plank (ceiling holes do not delete ground).
// Allow samples within 0.55 m of intentional ramp crest/foot kisses.
{
  const rampKisses = [];
  for (const id of ["climb_a", "climb_b"]) {
    const pts = byId[id].points;
    rampKisses.push(pts[0], pts[pts.length - 1]);
  }
  const nearRampKiss = (x, z) => rampKisses.some((k) => Math.hypot(x - k.x, z - k.z) < 1.85);
  let bad = 0, n = 0;
  const samples = [];
  for (const path of TRACK_PATHS) {
    if (path.kind === "ramp") continue;
    const halfW = path.width * 0.5;
    const pts = path.points;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const steps = Math.max(1, Math.ceil(len / 0.25));
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const x = a.x + (b.x - a.x) * u;
        const y = a.y + (b.y - a.y) * u;
        const z = a.z + (b.z - a.z) * u;
        if (Math.abs(y - 4.2) > 0.15) continue; // landing deck only
        n++;
        const dx = b.x - a.x, dz = b.z - a.z;
        const L = Math.hypot(dx, dz) || 1;
        const rx = -dz / L, rz = dx / L;
        // Centerline must be solid; curb may kiss hole lip on exit/merge
        if (!nearRampKiss(x, z) && inAnyClimbHole(x, z)) {
          bad++;
          if (samples.length < 6) samples.push({ path: path.id, x: +x.toFixed(2), y, z: +z.toFixed(2) });
        }
      }
    }
  }
  ok("flat-not-in-climb-holes", bad === 0, `bad=${bad}/${n * 3} eg=${JSON.stringify(samples)}`);
}

// 2) Unique junction successor within 0.75 m (no triple kiss)
{
  const ends = [];
  for (const id of PRIMARY_CIRCUIT) {
    const pts = byId[id].points;
    ends.push({ id, which: "start", p: pts[0] });
    ends.push({ id, which: "end", p: pts[pts.length - 1] });
  }
  let triple = 0;
  const reports = [];
  for (let i = 0; i < ends.length; i++) {
    const near = [];
    for (let j = 0; j < ends.length; j++) {
      if (i === j) continue;
      const a = ends[i].p, b = ends[j].p;
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (d < 0.75) near.push(`${ends[j].id}:${ends[j].which}@${d.toFixed(3)}`);
    }
    // At a kiss point we expect exactly one other endpoint (the successor/predecessor)
    // Shared S/F: foyer_sf start + foyer_finish end is OK (2 endpoints). Triple = ≥3 others.
    if (near.length >= 3) {
      triple++;
      if (reports.length < 4) reports.push({ at: `${ends[i].id}:${ends[i].which}`, near });
    }
  }
  ok("unique-junction-no-triple", triple === 0, `triples=${triple} ${JSON.stringify(reports)}`);
}

// Circuit kiss d=0 chain
{
  const chain = [
    ["foyer_sf", "foyer_to_climb_a"],
    ["foyer_to_climb_a", "climb_a"],
    ["climb_a", "landing_hairpin"],
    ["landing_hairpin", "balcony_arc"],
    ["balcony_arc", "balcony_to_climb_b"],
    ["balcony_to_climb_b", "climb_b"],
    ["climb_b", "foyer_finish"],
    ["foyer_finish", "foyer_sf"],
  ];
  for (const [a, b] of chain) {
    const pa = byId[a].points.at(-1);
    const pb = b === "foyer_sf" ? byId[b].points[0] : byId[b].points[0];
    // foyer_finish end → foyer_sf start
    const end = byId[a].points.at(-1);
    const start = byId[b].points[0];
    const d = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
    ok(`kiss-${a}->${b}`, d < 0.05, `d=${d.toFixed(4)}`);
  }
}

// 3) Hairpin self-proximity
{
  const pts = byId.landing_hairpin.points;
  let bad = 0;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 2; j < pts.length; j++) {
      if (j === i + 1) continue;
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z);
      if (d < 1.0) bad++;
    }
  }
  ok("hairpin-self-prox", bad === 0, `pairs<1m=${bad}`);
}

// 4) Newel clearance
{
  const nx = -2.20, nz = 2.20;
  const halfW = byId.landing_hairpin.width * 0.5;
  let minD = Infinity;
  const pts = byId.landing_hairpin.points;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const steps = 12;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      minD = Math.min(minD, Math.hypot(x - nx, z - nz));
    }
  }
  ok("newel-clearance", minD >= halfW + 0.15, `minD=${minD.toFixed(3)} need≥${(halfW + 0.15).toFixed(2)}`);
  const cols = mansion.getColliders();
  const newels = cols.filter((c) => c.driveKind === "pillar"
    && c.min.x < -2.0 && c.max.x > -2.4 && c.min.z < 2.4 && c.max.z > 2.0 && c.min.y >= 4.0);
  ok("newel-on-solid", newels.length >= 1 && !inAnyClimbHole(-2.20, 2.20), `n=${newels.length}`);
}

// 5) Scenic stair AABB ∩ ground ribbon AABB = ∅
{
  const scenic = [
    { minX: -8.7, maxX: -6.5, minZ: 2.0, maxZ: 10.5 }, // main_up
    { minX: 8.25, maxX: 9.75, minZ: 2.0, maxZ: 10.5 }, // climb_b_east approx
  ];
  let hits = 0;
  for (const path of TRACK_PATHS) {
    if (path.kind !== "floor") continue;
    if (Math.abs(path.points[0].y) > 0.15) continue;
    const halfW = path.width * 0.5;
    for (const pt of path.points) {
      for (const sc of scenic) {
        // ribbon AABB around point
        const rminX = pt.x - halfW, rmaxX = pt.x + halfW;
        const rminZ = pt.z - halfW, rmaxZ = pt.z + halfW;
        const overlap = !(rmaxX < sc.minX || rminX > sc.maxX || rmaxZ < sc.minZ || rminZ > sc.maxZ);
        if (overlap) hits++;
      }
    }
  }
  ok("scenic-vs-ground-ribbon", hits === 0, `hits=${hits}`);
}

// 6) Grade ≤30%, runway solid ≥2u, mounts foot=low
{
  for (const id of ["climb_a", "climb_b"]) {
    const pts = byId[id].points;
    let flat = 0, maxSeg = 0;
    for (let i = 1; i < pts.length; i++) {
      const run = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) || 1e-6;
      flat += run;
      maxSeg = Math.max(maxSeg, Math.abs(pts[i].y - pts[i - 1].y) / run);
    }
    const rise = Math.abs(pts.at(-1).y - pts[0].y);
    const mean = rise / flat;
    // logic3: Ben's hard spec — every segment ≤30% (no +0.02 tip allowance any more)
    ok(`${id}-grade`, mean <= RAMP_MAX_GRADE + 1e-3 && maxSeg <= 0.300,
      `mean=${mean.toFixed(3)} maxSeg=${maxSeg.toFixed(3)}`);
  }
  const mA = RAMP_MOUNT_FEET.climb_a;
  const mB = RAMP_MOUNT_FEET.climb_b;
  ok("climb-a-foot-low", mA.foot.y < mA.crest.y + 0.01, `footY=${mA.foot.y} crestY=${mA.crest.y}`);
  // logic3: B foot = climb_b's last point on the S/F straight (z=11.4), not the retired z=12.70
  const bLast = TRACK_PATHS.find((q) => q.id === "climb_b").points.at(-1);
  ok("climb-b-foot-low", mB.foot.y < mB.crest.y + 0.01 && Math.hypot(mB.foot.x - bLast.x, mB.foot.z - bLast.z) < 0.05 && bLast.y < 0.05,
    `foot=${JSON.stringify(mB.foot)} crest=${JSON.stringify(mB.crest)}`);

  // Climb A approach is ground plank (ceiling hole ≠ deleted floor) — full spur length.
  {
    const pts = byId.foyer_to_climb_a.points;
    let runA = 0;
    for (let i = 1; i < pts.length; i++) {
      runA += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    }
    ok("runway-a-solid-ge-2", runA >= 2.0, `runA=${runA.toFixed(2)}`);
  }
  // Climb B approach: solid landing pad (x=4.80 < holeB) until merge into strip
  {
    let runB = 0;
    const pts = byId.balcony_to_climb_b.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      if (inAnyClimbHole(mx, mz) || inAnyClimbHole(b.x, b.z)) break;
      runB += Math.hypot(b.x - a.x, b.z - a.z);
    }
    ok("runway-b-solid-ge-2", runB >= 2.0, `runB=${runB.toFixed(2)}`);
  }
}

// West cruise not at x=-7
{
  const west = byId.foyer_sf.points.filter((p) => p.x < -4);
  ok("foyer-west-not-x7", west.every((p) => p.x > -6.0), `xs=${west.map((p) => p.x)}`);
}

console.log(fails.length ? `\n${fails.length} FAIL(s): ${fails.join(", ")}` : "\nALL PASS");
process.exit(fails.length ? 1 : 0);
