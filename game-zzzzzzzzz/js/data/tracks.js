/**
 * Drive tracks — OPEN CIRCUIT · logic3 polish.
 *
 * LAP: foyer_sf → foyer_to_climb_a → climb_a → landing_hairpin →
 *      balcony_arc → balcony_to_climb_b → climb_b → foyer_finish → S/F
 *
 * logic3: every kiss is d=0 AND tangent-continuous (no spur reversal at the
 * Climb A foot, crest turns are real arcs). Grade ≤30% by construction
 * (eased trapezoid profile). All lanes 2.2u (house-scale). Flat lanes on
 * solid planks; climb holes = corridor strips only.
 */
export const ROAD_WIDTH_SCALE = 1.0;
export const RAMP_WIDTH_MULT = 1.0;
export const RAMP_WIDTH_MIN = 2.2;
export const FLOOR_WIDTH_MIN = 2.2;
export const DOOR_WIDTH_MIN = 2.2;
export const DECK_WIDTH_MIN = 2.2;
export const RAMP_MAX_GRADE = 0.30;
export const RAMP_DISABLE_MEAN_GRADE = 0.305;
// logic6: was 0.19 — that is car.js CAR_SCALE, not the car's length. The real body length is
// 0.45 × CAR_SCALE = 0.0855u. Audit: this export is imported by NOTHING (no js module, no sim),
// so the wrong value never affected behaviour; corrected for documentation only. Lane widths
// (*_WIDTH_MIN = 2.2) are deliberately unchanged.
export const CAR_LENGTH_U = 0.0855;

// ── logic3 plan helpers ───────────────────────────────────────────────
// Climbs are authored as plan primitives (straight + circular arcs) so every
// junction is TANGENT-continuous (no 180° spur reversal at the foot, no 90°
// snap turn at the crest). Height follows a trapezoid grade profile:
// flat tip → linear ease-in → constant gmax → ease-out → flat tip.
// Control-point maxSeg ≤ gmax ≤ RAMP_MAX_GRADE (0.30) by construction.
const R3 = (v) => Math.round(v * 1000) / 1000;
function _planSample(prims, step) {
  const out = [];
  let s = 0;
  const push = (x, z) => {
    const prev = out[out.length - 1];
    if (prev) {
      const d = Math.hypot(x - prev.x, z - prev.z);
      if (d < 1e-6) return;
      s += d;
    }
    out.push({ x, z, s });
  };
  for (const pr of prims) {
    if (pr.line) {
      const [x0, z0, x1, z1] = pr.line;
      const L = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(L / step));
      for (let i = 0; i <= n; i++) push(x0 + (x1 - x0) * (i / n), z0 + (z1 - z0) * (i / n));
    } else if (pr.arc) {
      const { cx, cz, r, a0, a1 } = pr.arc;
      const L = Math.abs(a1 - a0) * r;
      const n = Math.max(2, Math.round(L / step));
      for (let i = 0; i <= n; i++) {
        const a = a0 + (a1 - a0) * (i / n);
        push(cx + r * Math.cos(a), cz + r * Math.sin(a));
      }
    }
  }
  return out;
}
/** Height at arc-length s for a trapezoid grade profile. */
function _easedRise(s, flat0, flat1, total, ease, rise) {
  const L = total - flat0 - flat1;
  const g = rise / (L - ease);
  const u = Math.min(Math.max(s - flat0, 0), L);
  if (u <= ease) return g * u * u / (2 * ease);
  if (u >= L - ease) {
    const v = L - u;
    return rise - g * v * v / (2 * ease);
  }
  return g * (u - ease / 2);
}
function _climbPoints({ prims, yStart, yEnd, flat0, flat1, ease = 0.55, step = 0.5, labels = {} }) {
  const plan = _planSample(prims, step);
  const total = plan[plan.length - 1].s;
  const rise = Math.abs(yEnd - yStart);
  const sign = Math.sign(yEnd - yStart) || 1;
  // Guarantee explicit kinks-free tip flats: insert exact flat-end samples
  const pts = plan.map((p) => ({
    x: R3(p.x),
    y: R3(yStart + sign * _easedRise(p.s, flat0, flat1, total, ease, rise)),
    z: R3(p.z),
  }));
  if (labels.start) pts[0].label = labels.start;
  if (labels.end) pts[pts.length - 1].label = labels.end;
  return pts;
}
function _arcPts(cx, cz, r, a0, a1, n, y = 0) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    out.push({ x: R3(cx + r * Math.cos(a)), y, z: R3(cz + r * Math.sin(a)) });
  }
  return out;
}
const PI = Math.PI;

// ── logic3 layout constants (house units) ────────────────────────────
// Ground straight (S/F line) along the foyer south strip, both climbs curve off it.
const GROUND_Z = 11.40;
const SF_X = 1.00;                 // Start / Finish (centre of the foyer straight)
const CLIMB_A_X = -5.00;           // holeA_climb centre (x∈[-6.35,-3.65])
const CLIMB_B_X = 7.00;            // holeB_climb centre (x∈[5.65,8.35])
const BOT_R = 1.50;                // foot-arc radius (west leg → uphill / downhill → west leg)
const TOP_R = 1.30;                // crest-arc radius (inner ribbon edge stays ≥0.2)
const CREST_Z = -1.00;             // crest corridor centre (between landing N wall & library S wall)
const TIP = 0.45;                  // explicit flat tips at both climb ends
const A_FOOT_X = -2.11;            // Climb A foot (flat) — 2.0u+ solid runway east of it
const B_FOOT_X = 4.11;             // Climb B foot (mirror of A about SF_X)
const B_CREST_X = 4.40;            // Climb B entry on solid landing (U-turn start)
const LAND_Y = 4.20;

const _PATHS = [
  // ── 1) FOYER S/F — straight ground line heading WEST toward Climb A foot
  {
    id: "foyer_sf",
    kind: "floor",
    width: 2.20,
    tension: 0.06,
    closed: false,
    fancy: true,
    points: [
      { x: SF_X, y: 0.0, z: GROUND_Z, label: "Start / Finish" },
      { x: 0.52, y: 0.0, z: GROUND_Z },
      { x: 0.05, y: 0.0, z: GROUND_Z }, // kiss foyer_to_climb_a
    ],
  },

  // Runway → Climb A foot: straight, same heading as the climb's first metres (≥2u solid)
  {
    id: "foyer_to_climb_a",
    kind: "floor",
    width: 2.20,
    tension: 0.03,
    fancy: true,
    points: [
      { x: 0.05, y: 0.0, z: GROUND_Z },
      { x: -1.03, y: 0.0, z: GROUND_Z },
      { x: A_FOOT_X, y: 0.0, z: GROUND_Z }, // kiss climb_a foot (tangent-continuous, heading west)
    ],
  },

  // ── 2) Climb A — west leg → foot arc (turn north) → straight up holeA → crest arc (turn east)
  {
    id: "climb_a",
    kind: "ramp",
    width: 2.20,
    gentleStart: false,
    noLateralBow: true,
    authoredGrade: true,
    tension: 0.08,
    points: _climbPoints({
      prims: [
        { line: [A_FOOT_X, GROUND_Z, CLIMB_A_X + BOT_R, GROUND_Z] },
        { arc: { cx: CLIMB_A_X + BOT_R, cz: GROUND_Z - BOT_R, r: BOT_R, a0: PI / 2, a1: PI } },
        { line: [CLIMB_A_X, GROUND_Z - BOT_R, CLIMB_A_X, CREST_Z + TOP_R] },
        { arc: { cx: CLIMB_A_X + TOP_R, cz: CREST_Z + TOP_R, r: TOP_R, a0: PI, a1: 1.5 * PI } },
        { line: [CLIMB_A_X + TOP_R, CREST_Z, CLIMB_A_X + TOP_R + TIP, CREST_Z] },
      ],
      yStart: 0.0, yEnd: LAND_Y, flat0: TIP, flat1: TIP,
      labels: { start: "Grand Foyer", end: "Upper Landing" },
    }),
  },

  // ── 3) Landing hairpin — crest corridor east → right turn through the library-south
  //       doorway (x∈[-1.5,1.5]) → south down the landing (newel stays west, ≥0.4u edge clear)
  {
    id: "landing_hairpin",
    kind: "floor",
    width: 2.20,
    tension: 0.10,
    fancy: true,
    points: [
      { x: CLIMB_A_X + TOP_R + TIP, y: LAND_Y, z: CREST_Z }, // kiss climb_a crest
      { x: -2.25, y: LAND_Y, z: CREST_Z },
      ..._arcPts(-1.25, CREST_Z + 1.25, 1.25, 1.5 * PI, 2 * PI, 3, LAND_Y), // → (0, 0.25) heading south
      { x: 0.00, y: LAND_Y, z: 1.70 },
      { x: 0.00, y: LAND_Y, z: 3.60 },
      { x: 0.00, y: LAND_Y, z: 5.60 },
      { x: 0.00, y: LAND_Y, z: 7.60 },
      { x: 0.00, y: LAND_Y, z: 9.60, label: "Balcony Approach" },
    ],
  },

  // ── 4) Balcony sweep — out through the French doors, S-bend west, U-loop, east run,
  //       back north through the east doors. Open (not a closed loop), no self-crossing.
  {
    id: "balcony_arc",
    kind: "balcony",
    width: 2.20,
    rail: true,
    tension: 0.05,
    closed: false,
    fancy: true,
    points: [
      { x: 0.00, y: LAND_Y, z: 9.60 },
      { x: 0.00, y: LAND_Y, z: 10.60 },
      ..._arcPts(-1.60, 11.60, 1.60, 0, PI / 2, 3, LAND_Y).slice(0), // (0,11.6) → (-1.6,13.2)
      { x: -2.80, y: LAND_Y, z: 13.20 },
      ..._arcPts(-2.80, 14.60, 1.40, -PI / 2, -1.5 * PI, 5, LAND_Y).slice(1), // U-loop → (-2.8,16.0)
      { x: -1.00, y: LAND_Y, z: 16.00 },
      { x: 0.80, y: LAND_Y, z: 16.00 },
      ..._arcPts(2.60, 14.20, 1.80, PI / 2, 0, 3, LAND_Y), // (2.6,16.0) → (4.4,14.2) heading north
      { x: B_CREST_X, y: LAND_Y, z: 12.40 },
      { x: B_CREST_X, y: LAND_Y, z: 10.60 }, // kiss balcony_to_climb_b
    ],
  },

  // Solid east landing runway (x=4.40 < holeB minX 5.65) → Climb B entry
  {
    id: "balcony_to_climb_b",
    kind: "floor",
    width: 2.20,
    tension: 0.06,
    fancy: true,
    points: [
      { x: B_CREST_X, y: LAND_Y, z: 10.60 },
      { x: B_CREST_X, y: LAND_Y, z: 8.20 },
      { x: B_CREST_X, y: LAND_Y, z: 5.40 },
      { x: B_CREST_X, y: LAND_Y, z: 2.60 },
      { x: B_CREST_X, y: LAND_Y, z: CREST_Z + TOP_R }, // kiss climb_b (U-turn start, solid)
    ],
  },

  // ── 5) Climb B — flat U-turn over the crest → straight down holeB → foot arc (turn west) → foot
  {
    id: "climb_b",
    kind: "ramp",
    width: 2.20,
    gentleStart: false,
    noLateralBow: true,
    authoredGrade: true,
    tension: 0.08,
    points: _climbPoints({
      prims: [
        { arc: { cx: B_CREST_X + TOP_R, cz: CREST_Z + TOP_R, r: TOP_R, a0: PI, a1: 2 * PI } },
        { line: [CLIMB_B_X, CREST_Z + TOP_R, CLIMB_B_X, GROUND_Z - BOT_R] },
        { arc: { cx: CLIMB_B_X - BOT_R, cz: GROUND_Z - BOT_R, r: BOT_R, a0: 0, a1: PI / 2 } },
        { line: [CLIMB_B_X - BOT_R, GROUND_Z, B_FOOT_X, GROUND_Z] },
      ],
      yStart: LAND_Y, yEnd: 0.0, flat0: (PI / 2) * TOP_R, flat1: TIP,
      labels: { start: "Upper Landing", end: "Grand Foyer" },
    }),
  },

  // ── 6) Foyer finish — B foot → S/F (straight, tangent-continuous)
  {
    id: "foyer_finish",
    kind: "floor",
    width: 2.20,
    tension: 0.04,
    fancy: true,
    points: [
      { x: B_FOOT_X, y: 0.0, z: GROUND_Z }, // kiss climb_b foot
      { x: 2.55, y: 0.0, z: GROUND_Z },
      { x: SF_X, y: 0.0, z: GROUND_Z, label: "Start / Finish" },
    ],
  },
];

export const TRACK_PATHS = _PATHS;

export const ROAD_WIDTH_DESIGN = Object.fromEntries(
  TRACK_PATHS.map((p) => [p.id, p.width])
);

for (const path of TRACK_PATHS) {
  if (typeof path.width === "number") {
    path.width = Math.round(path.width * ROAD_WIDTH_SCALE * 1000) / 1000;
  }
}
for (const path of TRACK_PATHS) {
  if (path.kind !== "ramp" || typeof path.width !== "number") continue;
  path.width = Math.round(path.width * RAMP_WIDTH_MULT * 1000) / 1000;
  if (path.width < RAMP_WIDTH_MIN) path.width = RAMP_WIDTH_MIN;
  if (path.width > 3.5) path.width = 3.5;
}
for (const path of TRACK_PATHS) {
  if (path.disabled || path.visual === false || typeof path.width !== "number") continue;
  if (path.width > 3.5) path.width = 3.5;
  if (path.kind === "floor" || path.kind === "outdoor" || path.kind === "flower") {
    if (path.width < FLOOR_WIDTH_MIN) path.width = FLOOR_WIDTH_MIN;
  } else if (path.kind === "elevated" || path.kind === "cornice" || path.kind === "balcony") {
    if (path.width < DECK_WIDTH_MIN) path.width = DECK_WIDTH_MIN;
  }
}

function _softenRampGrades(path) {
  if (path.kind !== "ramp" || path.disabled || !path.points || path.points.length < 3) return;
  if (path.authoredGrade) return; // logic3: eased profile authored in _climbPoints
  const pts = path.points;
  const y0 = pts[0].y;
  const y1 = pts[pts.length - 1].y;
  const rise = Math.abs(y1 - y0);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
  }
  const totalFlat = cum[cum.length - 1];
  if (totalFlat < 1e-4 || rise < 1e-4) return;
  const mean = rise / totalFlat;
  if (mean > RAMP_DISABLE_MEAN_GRADE) {
    path.disabled = true;
    path._disabledReason = `mean grade ${mean.toFixed(2)} > ${RAMP_DISABLE_MEAN_GRADE}`;
    return;
  }
  let i0 = 0;
  while (i0 + 1 < pts.length && Math.abs(pts[i0 + 1].y - y0) < 0.05) i0++;
  let i1 = pts.length - 1;
  while (i1 - 1 > i0 && Math.abs(pts[i1 - 1].y - y1) < 0.05) i1--;
  const climbLen = cum[i1] - cum[i0];
  if (climbLen < 1e-3) return;
  const sign = Math.sign(y1 - y0) || 1;
  for (let i = i0 + 1; i < i1; i++) {
    const t = (cum[i] - cum[i0]) / climbLen;
    let frac = t;
    if (path.gentleStart && rise > 0.4) {
      frac = t <= 0.20 ? t * 0.45 : 0.09 + ((t - 0.20) / 0.80) * 0.91;
    }
    pts[i].y = Math.round((y0 + sign * rise * frac) * 1000) / 1000;
  }
  for (let i = 0; i <= i0; i++) pts[i].y = y0;
  for (let i = i1; i < pts.length; i++) pts[i].y = y1;
  let maxSeg = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const run = Math.hypot(b.x - a.x, b.z - a.z);
    if (run < 1e-6) continue;
    maxSeg = Math.max(maxSeg, Math.abs(b.y - a.y) / run);
  }
  if (maxSeg > RAMP_MAX_GRADE + 0.02) {
    for (let i = i0 + 1; i < i1; i++) {
      const t = (cum[i] - cum[i0]) / climbLen;
      pts[i].y = Math.round((y0 + (y1 - y0) * t) * 1000) / 1000;
    }
  }
}
for (const path of TRACK_PATHS) _softenRampGrades(path);

// Spawn on S/F straight, facing west toward the Climb A runway
export const CAR_SPAWN = { x: SF_X, y: 0.012, z: GROUND_Z, yaw: -Math.PI / 2 };

/** logic3 layout anchors (sims / mansion decor read these — single source of truth). */
export const LAYOUT = {
  GROUND_Z, SF_X, CLIMB_A_X, CLIMB_B_X, BOT_R, TOP_R, CREST_Z, TIP,
  A_FOOT_X, B_FOOT_X, B_CREST_X, LAND_Y,
  NEWEL: { x: -2.20, y: LAND_Y, z: 2.20, half: 0.30 },
};

export const RAMP_MOUNT_FEET = (() => {
  const APPROACH = {
    climb_a: "foyer_to_climb_a",
    climb_b: "balcony_to_climb_b",
  };
  const out = {};
  for (const path of TRACK_PATHS) {
    if (path.kind !== "ramp" || path.disabled) continue;
    const a = path.points[0];
    const b = path.points[path.points.length - 1];
    // foot = LOW end, crest = HIGH end (Climb B path order is crest→foot)
    const footPt = a.y <= b.y ? a : b;
    const crestPt = a.y <= b.y ? b : a;
    out[path.id] = {
      approach: APPROACH[path.id] || null,
      foot: { x: footPt.x, y: footPt.y, z: footPt.z },
      crest: { x: crestPt.x, y: crestPt.y, z: crestPt.z },
      engageBack: path.id === "climb_a" || path.id === "climb_b" ? 1.25 : 0.08,
      crestSoft: 0.12,
      climbFracs: [0.25, 0.5, 0.75],
    };
  }
  return out;
})();

export const SHORTCUT_TOAST_RE = /mouse run|wall hollow|pipe shaft|service shaft|drop chute|climb tube|safe landing|start \/ finish/i;

export const PRIMARY_CIRCUIT = [
  "foyer_sf",
  "foyer_to_climb_a",
  "climb_a",
  "landing_hairpin",
  "balcony_arc",
  "balcony_to_climb_b",
  "climb_b",
  "foyer_finish",
];
