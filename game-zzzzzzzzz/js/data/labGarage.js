/**
 * logic19 BACKYARD LAB GARAGE (Ben t182u) — replaces the little carriage-house box at (36,0,0).
 *
 *   Free-standing garage, walls x 31.0–39.0, z −5.0–9.0, roof 4.4. Garage door in the WEST wall
 *   (faces the Grand Descent ground road at x≈28), side window in the SOUTH wall (east end).
 *
 *   Drivable multi-level circuit "lab_circuit" (a loop: both ends on the Grand Descent road):
 *     GD road (peel-off arc) → in through the garage door (floor)
 *     → W ramp 0 → 0.90 (25%) → WEST WORKBENCH top (0.90)
 *     → NW corner → N ramp 0.90 → 1.60 (25%) → NORTH LOWER SHELF
 *     → NE corner → E lower shelf 1.60 → E ramp → 2.40 (25%) → EAST HIGH SHELF
 *     → SE corner (fork: straight on = WINDOW ROAD) → south high shelf → centre GANTRY
 *       2.40 → 0 (27.6%) → floor U-turn → floor return lane → out of the garage door → GD road
 *
 *   "lab_window": from the SE corner straight on through the south window (y 2.40), down a
 *   25% trestle ramp to the lawn, round south of the greenhouse, merges onto the Grand Descent
 *   ground road at (25.0, 19.85).
 */
export const LAB = {
  x0: 31.0, x1: 39.0, z0: -5.0, z1: 9.0, t: 0.2, h: 4.4,
  door: { z0: 5.0, z1: 7.6, h: 2.5 },             // west wall opening (x = x0)
  win: { x0: 37.35, x1: 38.65, y0: 2.12, y1: 3.25 }, // south wall opening (z = z1)
  lane: 0.8, r: 0.9,
  yBench: 0.9, yLow: 1.6, yHigh: 2.4,
  island: { x0: 35.5, x1: 37.5, z0: -0.5, z1: 6.75, top: 0.95 },
};

const R3 = (v) => Math.round(v * 1000) / 1000;
/** legs: [{line:[x0,z0,x1,z1]} | {arc:{cx,cz,r,a0,a1}}, y0, y1] → dense points, linear y per leg */
export function legPoints(legs, step = 0.22) {
  const out = [];
  for (const [prim, y0, y1] of legs) {
    const pts = [];
    if (prim.line) {
      const [x0, z0, x1, z1] = prim.line, L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / step));
      for (let i = 0; i <= n; i++) pts.push([x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n]);
    } else {
      const { cx, cz, r, a0, a1 } = prim.arc, n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * r / (step * 0.6)));
      for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
    }
    let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    let s = 0;
    pts.forEach((q, i) => {
      if (i) s += Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]);
      if (i === 0 && out.length) return; // shared joint
      out.push({ x: R3(q[0]), y: R3(y0 + (y1 - y0) * (L > 0 ? s / L : 0)), z: R3(q[1]) });
    });
  }
  return out;
}

const PI = Math.PI, B = LAB.yBench, Lo = LAB.yLow, Hi = LAB.yHigh, r = LAB.r;
export const LAB_CIRCUIT_LEGS = [
  [{ arc: { cx: 29.7, cz: 3.9, r: 1.7, a0: PI, a1: PI / 2 } }, 0, 0], // peel off the Grand Descent road (heading south)
  [{ line: [29.7, 5.6, 31.1, 5.6] }, 0, 0],                         // in through the door
  [{ arc: { cx: 31.1, cz: 4.7, r, a0: PI / 2, a1: 0 } }, 0, 0],      // turn north
  [{ line: [32.0, 4.7, 32.0, 1.1] }, 0, B],                          // W ramp (25%)
  [{ line: [32.0, 1.1, 32.0, -3.1] }, B, B],                         // WEST WORKBENCH
  [{ arc: { cx: 32.9, cz: -3.1, r, a0: PI, a1: 1.5 * PI } }, B, B],  // NW corner
  [{ line: [32.9, -4.0, 33.6, -4.0] }, B, B],
  [{ line: [33.6, -4.0, 36.4, -4.0] }, B, Lo],                       // N ramp (25%)
  [{ line: [36.4, -4.0, 37.1, -4.0] }, Lo, Lo],                      // NORTH LOWER SHELF
  [{ arc: { cx: 37.1, cz: -3.1, r, a0: 1.5 * PI, a1: 2 * PI } }, Lo, Lo], // NE corner
  [{ line: [38.0, -3.1, 38.0, -1.6] }, Lo, Lo],                      // EAST LOWER SHELF
  [{ line: [38.0, -1.6, 38.0, 1.6] }, Lo, Hi],                       // E ramp (25%)
  [{ line: [38.0, 1.6, 38.0, 6.8] }, Hi, Hi],                        // EAST HIGH SHELF
  [{ arc: { cx: 37.0, cz: 6.8, r: 1.0, a0: 0, a1: PI / 2 } }, Hi, Hi], // SE corner (window fork) — logic19 r 0.9 → 1.0, earlier
  [{ line: [37.0, 7.8, 35.8, 7.8] }, Hi, Hi],                        // SOUTH HIGH SHELF
  [{ arc: { cx: 35.8, cz: 7.0, r: 0.8, a0: PI / 2, a1: PI } }, Hi, Hi],
  [{ line: [35.0, 7.0, 35.0, -1.6] }, Hi, 0],                        // centre GANTRY down (27.9%)
  [{ arc: { cx: 34.1, cz: -1.6, r, a0: 0, a1: -PI } }, 0, 0],        // floor U-turn
  [{ line: [33.2, -1.6, 33.2, 6.1] }, 0, 0],                         // floor return lane
  [{ arc: { cx: 32.3, cz: 6.1, r, a0: 0, a1: PI / 2 } }, 0, 0],
  [{ line: [32.3, 7.0, 29.7, 7.0] }, 0, 0],                          // out through the door
  [{ arc: { cx: 29.7, cz: 8.7, r: 1.7, a0: -PI / 2, a1: -PI } }, 0, 0], // merge back onto the Grand Descent road (south)
];
export const LAB_WINDOW_LEGS = [
  [{ line: [38.0, 6.8, 38.0, 9.6] }, Hi, Hi],                        // straight on through the window
  [{ line: [38.0, 9.6, 38.0, 19.2] }, Hi, 0],                        // trestle ramp down (25%)
  [{ line: [38.0, 19.2, 38.0, 21.0] }, 0, 0],
  [{ arc: { cx: 36.8, cz: 21.0, r: 1.2, a0: 0, a1: PI / 2 } }, 0, 0],
  [{ line: [36.8, 22.2, 29.0, 22.2] }, 0, 0],                        // lawn, south of the greenhouse
  [{ line: [29.0, 22.2, 25.0, 19.85] }, 0, 0],                       // merge onto the Grand Descent road
];
export const LAB_PATH_DEFS = [
  { id: "lab_circuit", kind: "loftramp", width: LAB.lane, keepWidth: true, label: "Lab Garage Circuit", points: legPoints(LAB_CIRCUIT_LEGS) },
  { id: "lab_window", kind: "loftramp", width: LAB.lane, keepWidth: true, label: "Lab Window Road", points: legPoints(LAB_WINDOW_LEGS) },
];
/** inside the garage shell (xz)? */
export const inLab = (x, z, pad = 0) => x > LAB.x0 - pad && x < LAB.x1 + pad && z > LAB.z0 - pad && z < LAB.z1 + pad;
