/**
 * Drive tracks — EXPERT FIGURE-8 LAP (2026-09-17).
 *
 * LAP: (1) foyer oval S/F mid-foyer long axis
 *      (2) Climb A foyer→landing dedicated asphalt corridor EAST of west scenic stairs
 *      (3) landing hairpin 180 around solid newel
 *      (4) balcony loop — outer rail = wall, marked inner edge
 *      (5) Climb B balcony→foyer EAST hole (opposite Climb A)
 *      (6) short foyer straight into start — fully kissed junctions
 *
 * LANE: clear 2.2–2.8 m, straights ≤3.0, never >3.5; curb visual 0.35–0.5
 * CAR_SCALE≈0.19. Grade ≤30%. Real dual floor holes. No freeways / floating roads.
 */
export const ROAD_WIDTH_SCALE = 1.0;
export const RAMP_WIDTH_MULT = 1.0;
export const RAMP_WIDTH_MIN = 2.2;
export const FLOOR_WIDTH_MIN = 2.2;
export const DOOR_WIDTH_MIN = 2.2;
export const DECK_WIDTH_MIN = 2.2;
export const RAMP_MAX_GRADE = 0.30;
export const RAMP_DISABLE_MEAN_GRADE = 0.305;
export const CAR_LENGTH_U = 0.19;

const _PATHS = [
  // ── 1) FOYER OVAL ───────────────────────────────────────────────
  {
    id: "foyer_oval",
    kind: "floor",
    width: 2.50,
    tension: 0.08,
    closed: true,
    fancy: true,
    points: [
      { x: 0.00, y: 0.0, z: 10.40, label: "Start / Finish" },
      { x: -2.20, y: 0.0, z: 10.40 },
      { x: -4.00, y: 0.0, z: 10.55 },
      { x: -5.40, y: 0.0, z: 11.20 },
      { x: -6.40, y: 0.0, z: 11.90 },
      { x: -7.00, y: 0.0, z: 12.20 }, // west wall cruise (scenic stairs)
      { x: -7.00, y: 0.0, z: 9.00 },
      { x: -7.00, y: 0.0, z: 5.50 },
      { x: -6.40, y: 0.0, z: 2.80 },
      { x: -4.80, y: 0.0, z: 1.20 },
      { x: -2.40, y: 0.0, z: 0.55 },
      { x: 0.00, y: 0.0, z: 0.45 },
      { x: 2.40, y: 0.0, z: 0.55 },
      { x: 4.80, y: 0.0, z: 1.20 },
      { x: 6.40, y: 0.0, z: 2.80 },
      { x: 7.00, y: 0.0, z: 5.50 },
      { x: 7.00, y: 0.0, z: 9.00 },
      { x: 7.00, y: 0.0, z: 12.40 }, // kiss climb_b / finish
      { x: 5.20, y: 0.0, z: 12.05 },
      { x: 3.00, y: 0.0, z: 10.85 },
      { x: 1.40, y: 0.0, z: 10.50 },
      { x: 0.00, y: 0.0, z: 10.40 },
    ],
  },

  // Spur oval → Climb A (kiss)
  {
    id: "foyer_to_climb_a",
    kind: "floor",
    width: 2.45,
    tension: 0.03,
    fancy: true,
    points: [
      { x: -5.40, y: 0.0, z: 11.20 }, // from oval
      { x: -5.25, y: 0.0, z: 11.55 },
      { x: -5.15, y: 0.0, z: 11.90 },
      { x: -5.05, y: 0.0, z: 12.15 },
      { x: -5.00, y: 0.0, z: 12.40 }, // kiss climb_a foot
    ],
  },

    // ── 2) Climb A — dedicated asphalt EAST of west scenic stairs ───
  // Corridor x≈-5.0 (stairs scenery at x≈-7.6). Flat run ≥14 m; rise 4.2; grade ≤30%.
  {
    id: "climb_a",
    kind: "ramp",
    width: 2.40,
    gentleStart: false,
    noLateralBow: true,
    tension: 0.10,
    points: [
      // Asphalt corridor x=-5.0 east of scenic stairs (x≈-7.6). Crest east of newel.
      { x: -5.00, y: 0.0, z: 12.40, label: "Grand Foyer" },
      { x: -5.00, y: 0.55, z: 10.50 },
      { x: -5.00, y: 1.10, z: 8.60 },
      { x: -5.00, y: 1.65, z: 6.70 },
      { x: -5.00, y: 2.20, z: 4.80 },
      { x: -5.00, y: 2.75, z: 2.90 },
      { x: -5.00, y: 3.30, z: 1.00 },
      { x: -5.00, y: 3.75, z: -0.50 },
      { x: -5.00, y: 4.20, z: -1.80, label: "Upper Landing" }, // east of newel, kiss hairpin
    ],
  },

  // ── 3) Landing hairpin 180 around solid newel ───────────────────
  // Newel ≈ (-5.50, 4.2, -0.20); inner R ≥ 1.5
  {
    id: "landing_hairpin",
    kind: "floor",
    width: 2.40,
    tension: 0.10,
    fancy: true,
    points: [
      // Kiss climb_a crest east of newel; 180° around newel (-5.50,-0.20); R≥1.5
      { x: -5.00, y: 4.20, z: -1.80 },
      { x: -4.20, y: 4.20, z: -0.40 },
      { x: -3.60, y: 4.20, z: 1.00 },
      { x: -4.20, y: 4.20, z: 2.20 },
      { x: -5.50, y: 4.20, z: 2.40 }, // north of newel
      { x: -6.60, y: 4.20, z: 1.20 },
      { x: -6.60, y: 4.20, z: -0.40 },
      { x: -5.80, y: 4.20, z: -1.40 },
      { x: -4.80, y: 4.20, z: -1.20 },
      { x: -4.00, y: 4.20, z: 0.20 },
      { x: -3.40, y: 4.20, z: 1.80 },
      { x: -2.40, y: 4.20, z: 3.40 },
      { x: -1.20, y: 4.20, z: 5.00 },
      { x: 0.40, y: 4.20, z: 6.60 },
      { x: 2.20, y: 4.20, z: 7.80 },
      { x: 4.00, y: 4.20, z: 8.80 },
      { x: 5.00, y: 4.20, z: 9.55, label: "Balcony Approach" },
    ],
  },

  // ── 4) Balcony loop ─────────────────────────────────────────────
  {
    id: "balcony_loop",
    kind: "balcony",
    width: 2.40,
    rail: true,
    tension: 0.05,
    closed: true,
    fancy: true,
    points: [
      { x: 5.00, y: 4.20, z: 9.55 },
      { x: 5.40, y: 4.20, z: 11.20 },
      { x: 5.50, y: 4.20, z: 13.00 },
      { x: 5.20, y: 4.20, z: 14.80 },
      { x: 3.80, y: 4.20, z: 16.40 },
      { x: 1.80, y: 4.20, z: 17.00 },
      { x: 0.00, y: 4.20, z: 17.15 },
      { x: -1.80, y: 4.20, z: 17.00 },
      { x: -3.80, y: 4.20, z: 16.40 },
      { x: -5.00, y: 4.20, z: 14.80 },
      { x: -5.10, y: 4.20, z: 13.00 },
      { x: -4.70, y: 4.20, z: 11.20 },
      { x: -3.20, y: 4.20, z: 10.00 },
      { x: -1.00, y: 4.20, z: 9.60 },
      { x: 1.50, y: 4.20, z: 9.50 },
      { x: 3.60, y: 4.20, z: 9.50 },
      { x: 5.00, y: 4.20, z: 9.55 },
    ],
  },

  {
    id: "balcony_to_climb_b",
    kind: "floor",
    width: 2.40,
    tension: 0.06,
    fancy: true,
    points: [
      { x: 5.00, y: 4.20, z: 14.80 },
      { x: 5.60, y: 4.20, z: 11.00 },
      { x: 6.40, y: 4.20, z: 6.50 },
      { x: 6.90, y: 4.20, z: 2.50 },
      { x: 7.00, y: 4.20, z: -1.80 },
    ],
  },

    // ── 5) Climb B — EAST asphalt hole (scenic stairs at x≈8.6 beside) ─
  // Straight corridor x=7.00; flat ≥14 m; drop 4.2 → grade ≤0.30; landmark pylons at foot/crest
  {
    id: "climb_b",
    kind: "ramp",
    width: 2.40,
    gentleStart: false,
    noLateralBow: true,
    tension: 0.16,
    points: [
      { x: 7.00, y: 4.20, z: -1.80, label: "Upper Landing" },
      { x: 7.00, y: 3.60, z: 0.20 },
      { x: 7.00, y: 3.00, z: 2.20 },
      { x: 7.00, y: 2.40, z: 4.20 },
      { x: 7.00, y: 1.80, z: 6.20 },
      { x: 7.00, y: 1.20, z: 8.20 },
      { x: 7.00, y: 0.60, z: 10.20 },
      { x: 7.00, y: 0.00, z: 12.40, label: "Grand Foyer" },
    ],
  },

  // ── 6) Short foyer straight into start ──────────────────────────
  {
    id: "foyer_finish",
    kind: "floor",
    width: 2.50,
    tension: 0.04,
    fancy: true,
    points: [
      { x: 7.00, y: 0.0, z: 12.40 }, // kiss climb_b foot
      { x: 4.20, y: 0.0, z: 11.40 },
      { x: 1.80, y: 0.0, z: 10.60 },
      { x: 0.00, y: 0.0, z: 10.40, label: "Start / Finish" },
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
  // Identify authored flat pads (y≈y0 at start, y≈y1 at end)
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

// Spawn on S/F, facing west toward Climb A
export const CAR_SPAWN = { x: 0.00, y: 0.012, z: 10.40, yaw: -Math.PI / 2 };

export const RAMP_MOUNT_FEET = (() => {
  const APPROACH = {
    climb_a: "foyer_to_climb_a",
    climb_b: "balcony_to_climb_b",
  };
  const out = {};
  for (const path of TRACK_PATHS) {
    if (path.kind !== "ramp" || path.disabled) continue;
    const foot = path.points[0];
    const crest = path.points[path.points.length - 1];
    out[path.id] = {
      approach: APPROACH[path.id] || null,
      foot: { x: foot.x, y: foot.y, z: foot.z },
      crest: { x: crest.x, y: crest.y, z: crest.z },
      engageBack: path.id === "climb_a" || path.id === "climb_b" ? 1.25 : 0.08,
      crestSoft: 0.12,
      climbFracs: [0.25, 0.5, 0.75],
    };
  }
  return out;
})();

export const SHORTCUT_TOAST_RE = /mouse run|wall hollow|pipe shaft|service shaft|drop chute|climb tube|safe landing|start \/ finish/i;

export const PRIMARY_CIRCUIT = [
  "foyer_oval",
  "foyer_to_climb_a",
  "climb_a",
  "landing_hairpin",
  "balcony_loop",
  "balcony_to_climb_b",
  "climb_b",
  "foyer_finish",
];
