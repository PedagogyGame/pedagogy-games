/**
 * logic9 "Skyline" — toy-train wall-top tracks near the ceiling + the hidden mouse run.
 *
 *   Hall of Echoes floor ──(Skyline Climb, ≤28% eased)──▶ hall east wall-top (y 3.2)
 *     ──▶ framed portals through hall S + foyer N walls ──▶ Foyer Skybridge (hangs from the
 *     ceiling over the foyer) ──▶ south wall-top ledge ─┬─▶ west: SKY END (neon cap, mid-air)
 *                                                       ├─▶ east spur: BARRICADE
 *                                                       └─▶ framed portal INTO the hollow
 *     between the foyer south wall and the façade ──▶ Mouse Run (dim, neon, 0.7 wide) descends
 *     3.2 → 0 inside the wall ──▶ out at the west end ──▶ Garden Return (lawn) ──▶ through the
 *     front door + a floor mouse hole ──▶ joins the foyer road at the spawn.
 *
 * Points are authored dense; tracks.js uses them RAW (no spline) so grade is exactly as written.
 */
import { LAB_PATH_DEFS } from "./labGarage.js?v=logic24";
const H = 3.2;          // wall-top height on the ground story (ceiling slab bottom ≈ 4.0)
const MAX_G = 0.28;     // peak grade (eased ends) — hard cap 0.30
const R = (v) => Math.round(v * 1000) / 1000;

function poly(prims, yAt, step = 0.25, arcStep = step * 0.6) {
  // prims: {line:[x0,z0,x1,z1]} | {arc:{cx,cz,r,a0,a1}} (angle measured atan2(z-cz, x-cx))
  const xz = [];
  for (const p of prims) {
    if (p.line) {
      const [x0, z0, x1, z1] = p.line;
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / step));
      for (let i = xz.length ? 1 : 0; i <= n; i++) xz.push([x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n]);
    } else {
      const { cx, cz, r, a0, a1 } = p.arc;
      const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) * r / arcStep));
      for (let i = xz.length ? 1 : 0; i <= n; i++) {
        const a = a0 + (a1 - a0) * i / n;
        xz.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
      }
    }
  }
  let s = 0;
  return xz.map((q, i) => {
    if (i) s += Math.hypot(q[0] - xz[i - 1][0], q[1] - xz[i - 1][1]);
    return { x: R(q[0]), y: R(yAt(s)), z: R(q[1]) };
  });
}

/** Eased climb profile: flat f0, rise `rise` with grade easing in/out over `e`, then flat. */
function easedProfile(y0, rise, f0, e = 1.2) {
  const L = Math.abs(rise) / MAX_G + e; // integral of eased grade = MAX_G·(L−e)
  const sign = Math.sign(rise);
  return {
    len: L,
    y: (s) => {
      const u = s - f0;
      if (u <= 0) return y0;
      if (u >= L) return y0 + rise;
      // grade(u) = MAX_G·ramp, ramp = smooth over [0,e] and [L−e,L]
      const g = (t) => (t < e ? 0.5 - 0.5 * Math.cos(Math.PI * t / e) : 1);
      // integrate analytically: ∫0^t (0.5−0.5cos(πx/e))dx = t/2 − e/(2π)·sin(πt/e)
      const I = (t) => (t < e ? t / 2 - (e / (2 * Math.PI)) * Math.sin(Math.PI * t / e) : e / 2 + (t - e));
      const up = I(Math.min(u, L - e)) - (u > L - e ? 0 : 0);
      let acc = up;
      if (u > L - e) { const v = L - u; acc = (e / 2 + (L - 2 * e)) + (e / 2 - I(v)); }
      void g;
      return y0 + sign * MAX_G * acc;
    },
  };
}

const PI = Math.PI;

// ─── logic10 "Skyline Everywhere": a ring in every major room on ground + first floor, an attic
// circuit, outdoor skyways round the grounds, two more mouse runs between floors, all linked. ───
const G = H, F = 7.2, AT = 8.45;
let TIMBER_F_J = { z: -5.47, y: F }, TIMBER_F_PLATEAU_Z = -5.3; // logic19: set by the timber_f block, read by Roof Run
function ring(x0, x1, z0, z1, y, r = 1.0) {
  return poly([
    { line: [x0 + r, z0, x1 - r, z0] }, { arc: { cx: x1 - r, cz: z0 + r, r, a0: -PI / 2, a1: 0 } },
    { line: [x1, z0 + r, x1, z1 - r] }, { arc: { cx: x1 - r, cz: z1 - r, r, a0: 0, a1: PI / 2 } },
    { line: [x1 - r, z1, x0 + r, z1] }, { arc: { cx: x0 + r, cz: z1 - r, r, a0: PI / 2, a1: PI } },
    { line: [x0, z1 - r, x0, z0 + r] }, { arc: { cx: x0 + r, cz: z0 + r, r, a0: PI, a1: 1.5 * PI } },
  ], () => y, 0.8, 0.16);
}
const link = (x0, z0, x1, z1, y) => poly([{ line: [x0, z0, x1, z1] }], () => y, 0.8);
function EXPANSION_PATHS() {
  const P = [];
  const add = (id, kind, points, label, extra = {}) => P.push({ id, kind, width: kind === "mouse" ? 0.7 : 1.0, /* logic16: default loft lane 1.1→1.0 (−9%) */ points, label, ...extra });
  // Ground floor rings (y 3.2) — inset clear of every wall face (overlapping room shells included)
  add("sky_cabinet", "loft", ring(-23.25, -7.6, -15.25, -2.0, G), "Cabinet Ring");
  add("sky_armoury", "loft", ring(7.6, 23.25, -15.25, -2.0, G), "Armoury Ring");
  add("sky_conservatory", "loft", ring(-7.2, 8.9, -38.25, -22.85, G), "Glasshouse Ring");
  add("sky_dining", "loft", ring(-23.25, -12.0, -36.25, -23.75, G), "Dining Ring");
  add("sky_hall_east", "loft", ring(11.85, 17.5, -34.25, -25.75, G), "East Hall Ring");
  add("sky_x_west", "loft", link(HALL_X, -4.0, -7.6 - 0.3, -4.0, G), "Hall Crossing W");
  add("sky_x_east", "loft", link(HALL_X, -4.0, 7.6 + 0.3, -4.0, G), "Hall Crossing E");
  add("sky_b_dining", "loft", link(-16.0, -15.25, -16.0, -23.75, G), "Dining Bridge");
  add("sky_b_easthall", "loft", link(14.0, -15.25, 14.0, -25.75, G), "East Hall Bridge");
  add("sky_b_glass", "loft", link(8.9, -30.0, 11.85, -30.0, G), "Glasshouse Link");
  // First floor rings (y 7.2)
  add("sky_landing", "loft", ring(-7.25, 7.25, 0.75, 9.25, F), "Landing Ring");
  add("sky_library", "loft", ring(-2.85, 2.85, -19.25, -0.75, F), "Library Ring");
  add("sky_study", "loft", ring(-21.25, -6.75, -14.25, -2.8, F), "Study Ring");
  add("sky_nursery", "loft", ring(6.75, 21.25, -14.25, -2.8, F), "Nursery Ring");
  add("sky_music", "loft", ring(-5.2, 8.9, -35.25, -20.75, F), "Music Ring");
  add("sky_workshop", "loft", ring(-21.25, -6.75, -34.25, -21.75, F), "Workshop Ring");
  add("sky_annex", "loft", ring(10.85, 17.5, -32.25, -23.75, F), "Annex Ring");
  add("sky_l_nursery", "loft", link(6.75, -11.5, 2.85, -11.5, F), "Nursery Link");
  add("sky_l_study", "loft", link(-2.85, -11.5, -6.75, -11.5, F), "Study Link");
  add("sky_l_music", "loft", link(-1.0, -19.25, -1.0, -20.75, F), "Music Link");
  add("sky_l_annex", "loft", link(8.9, -27.0, 10.85, -27.0, F), "Annex Link");
  add("sky_l_workshop", "loft", link(-14.0, -14.25, -14.0, -21.75, F), "Workshop Bridge");
  add("sky_l_landing", "loft", link(-1.0, -0.75, -1.0, 0.75, F), "Landing Link");
  // Attic circuit: a low toy track ON the attic floor (+5 cm) + the Science attic
  add("sky_attic", "floor", ring(-10.0, 10.0, -16.0, 0.9, AT, 1.2), "Attic Circuit");
  add("sky_science", "floor", ring(-3.9, 3.9, -31.25, -20.75, AT), "Science Attic Ring");
  add("sky_l_science", "floor", link(0.0, -16.0, 0.0, -20.75, AT), "Science Bridge");
  // logic18 sky_carriage spur RETIRED in logic19: it was a second deck laid exactly over the Armoury Ring's east
  // lane + timber_g (coplanar z-fight, and its corner arc bulged into the armoury wall). Same drive is now
  // Armoury Ring east lane → timber_g (Timber → Armoury), which already joins the shaft at Run B.
  // logic18 TIMBER SHAFT — giant switchback between the east rooms and the outer shell.
  // Linear grades (cosine peaking broke the 30% cap). Hairpins flat.
  {
    const T = TIMBER, X = T.x, zS = T.zS, zN = T.zN, HR = 0.71, Xo = X + HR; // outer lane ≈ 25.63 (logic19: was 25.75 — 9 cm off the outer liner)
    const zMid = -1.0; // S hairpin near nursery/armoury south so Run C climbs through nursery z
    const lin = (a, b, u) => R(a + (b - a) * Math.min(1, Math.max(0, u)));
    const runA = Math.abs(zS - zN), runB = Math.abs(zN - zMid), runC = Math.abs(zMid - (-15.0));
    // Pull hairpins 0.8m short of the cavity ends so the U-turn deck stays on solid framing
    const zNu = zN + 1.1, zSu = zMid; // N U-turn pulled in from zN so Cap at zN is clear
    // logic19: last 0.8 m of Run A is flat at y1 — timber_g now leaves from there (it used to cross A from Run B)
    const A = poly([{ line: [X, zS, X, zNu] }], (s) => lin(T.y0, T.y1, s / (Math.abs(zS - zNu) - 0.8)), 0.35);
    // Roomier U: out to outer lane, flat, no tiny arc launch
    // logic19: semicircular hairpins (were square U's — cars swung their tail into the outer liner at the corners)
    // r ≤ half lane width so the chord decks overlap at the bulb centre (r 0.40 left a 4 cm pinhole a wheel fell through)
    const rU = T.width / 2 - 0.01, cU = Xo - rU, xa = cU - rU, xb = Xo; // exit straight onto Run B; entry jogs west off Run A
    const HN = poly([
      { line: [X, zNu, xa, zNu - 0.5] },
      { arc: { cx: cU, cz: zNu - 0.5, r: rU, a0: PI, a1: 2 * PI } },
      { line: [xb, zNu - 0.5, Xo, zNu] },
    ], () => T.y1, 0.12);
    // logic19: Run B flat for its first 0.45 m out of the north bulb (matches Run A's flat top — no pop in the overlap)
    const B = poly([{ line: [Xo, zNu, Xo, zSu] }], (s) => lin(T.y1, T.y2, Math.max(0, s - 0.45) / (Math.abs(zNu - zSu) - 0.45)), 0.35);
    const HS = poly([
      { line: [Xo, zSu, xb, zSu + 0.5] },
      { arc: { cx: cU, cz: zSu + 0.5, r: rU, a0: 0, a1: PI } },
      { line: [xa, zSu + 0.5, X, zSu] },
    ], () => T.y2, 0.12);
    const zTop = zN; // north tip at attic height
    // logic19: last 0.7 m of Run C flat at the tip (attic deck overlaps it — slope-under-flat popped 3 cm)
    // + a 1.2 m plateau at fY where timber_f leaves (flat-on-slope overlap popped 4–5 cm)
    const runCl = Math.abs(zSu - zTop) - 0.7 - 1.2, sF0 = runCl * (T.fY - T.y2) / (T.yT - T.y2);
    const Crun = poly([{ line: [X, zSu, X, zTop] }], (s) => s <= sF0 ? lin(T.y2, T.fY, s / sF0) : s <= sF0 + 1.2 ? T.fY : lin(T.fY, T.yT, (s - sF0 - 1.2) / (runCl - sF0)), 0.35);
    TIMBER_F_PLATEAU_Z = zSu - (sF0 + 0.6);
    // Cap stub west: unique end xz (avoids pursue/done confusing Run A at the same z)
    const Cap = poly([{ line: [X, zTop, X + 0.5, zTop] }], () => T.yT, 0.2); // stub at zN — clear of the U-turn crossbar
    const pts = [...A, ...HN.slice(1), ...B.slice(1), ...HS.slice(1), ...Crun.slice(1), ...Cap.slice(1)];
    add("timber_shaft", "mouse", pts, "Timber Shaft", { tube: true, width: T.width, keepWidth: true });
    // GROUND: Run B → west through liner (flat at shaft y) then short ramp down onto sky_armoury (G)
    {
      const j = { x: X, z: zNu + 0.35, y: T.y1 }; // logic19: off Run A's flat top (was B[0] — crossing A broke the hairpin)
      const zJ = j.z, yJ = j.y;
      add("timber_g", "mouse", poly([
        { line: [j.x, zJ, 24.15, zJ] },
        { line: [24.15, zJ, 23.25, zJ] },
      ], (s) => {
        const flat = Math.abs(j.x - 24.15);
        if (s <= flat) return yJ;
        return R(yJ + (G - yJ) * Math.min(1, (s - flat) / Math.abs(24.15 - 23.25)));
      }, 0.06), "Timber → Armoury", { tube: true, width: 1.2, keepWidth: true }); // logic19: wide mouth off Run A (90° turn)
    }
    // FIRST: Run C at y≈7.2 (nursery z), west onto sky_nursery (wide so shaft momentum stays on deck)
    {
      const j = { x: X, z: TIMBER_F_PLATEAU_Z, y: T.fY }; // logic19: centre of Run C's flat plateau
      TIMBER_F_J = { z: j.z, y: j.y }; // logic19: Roof Run now forks off this deck
      add("timber_f", "mouse", poly([{ line: [j.x, j.z, 21.25, j.z] }], () => j.y, 0.2), "Timber → Nursery", { tube: true, width: 1.4, keepWidth: true }); // logic19: 1.05 → 1.4 (90° turn off Run C at speed)
    }
    // ATTIC: from Cap tip west onto attic circuit. North bumper (liner) stops tip overshoot.
    // logic19: straight onto the attic ring's north-east corner (old hook arc doubled back north on itself)
    // logic19: centreline nudged 0.1 m south off the Cap (and 1.1 wide) — closes the pocket by the Roof Run arc,
    // keeps the north edge clear of the tip bumper
    add("timber_attic", "mouse", poly([
      { line: [X + 0.5, zTop, X - 0.3, zTop + 0.1] },
      { line: [X - 0.3, zTop + 0.1, 10.0, zTop + 0.1] },
    ], () => AT, 0.25), "Timber → Attic", { tube: true, width: 1.1, keepWidth: true });
    // LAWN: foot south out of the cavity onto the front lawn
    // logic19: westward run moved z 18 → 17 so it no longer drives over/into the east-lawn kicker (22,18)
    add("timber_lawn", "mouse", poly([
      { line: [X, zS, X, 15.8] },
      { arc: { cx: X - 1.2, cz: 15.8, r: 1.2, a0: 0, a1: PI / 2 } },
      { line: [X - 1.2, 17.0, 8.0, 17.0] },
    ], () => 0, 0.35), "Timber → Lawn", { tube: true, width: 0.8, keepWidth: true }); // logic19: keepWidth so its mouth overlaps the shaft foot (reachability)
  }
  // logic18 GUTTER — straight steep chute down the EAST outer shell. Soft trough; steer still works.
  // Entered from the timber shaft top (not Grand Descent).
  {
    const U = GUTTER, T = TIMBER;
    // flat lip: diagonal onto the chute, then ~2.2 m of flat so yaw settles south before the plunge
    const lipZ = U.z0 + 2.2;
    add("gutter_entry", "loftramp", poly([
      // logic19: smooth quarter-arc off the Cap onto the lip (the old diagonal clipped its own corner rail + the lip rail)
      { arc: { cx: T.x + 0.5, cz: T.zN + (U.x - T.x - 0.5), r: U.x - T.x - 0.5, a0: -PI / 2, a1: 0 } },
      { line: [U.x, T.zN + (U.x - T.x - 0.5), U.x, lipZ] },
    ], () => U.y0, 0.22), "Gutter Entry", { width: 0.7, keepWidth: true });
    add("gutter", "loftramp", poly([
      { line: [U.x, lipZ, U.x, U.z1] },
    ], (s) => R(U.y0 + (U.y1 - U.y0) * Math.min(1, Math.max(0, s / Math.abs(U.z1 - lipZ)))), 0.3),
      "East Gutter", { width: U.width, keepWidth: true });
  }
  // Mouse run 3: Roof Run — from the Carriage Climb top, on up the cavity to the attic floor
  {
    const prof = easedProfile(F, AT - F, 1.8);
    const zr = -8.0 - 0.6 - prof.len - 0.3; // ramp begins ~1.8 past the branch
    // logic19: the old Carriage Climb start (24.1,-6.8) was orphaned when the carriage house became the lab —
    // Roof Run now forks north off the Timber → Nursery deck (same ~7.2 m level), flat until its old ramp start.
    const jz = TIMBER_F_J.z, jy = TIMBER_F_J.y, sOff = Math.max(0, jz - (-6.8));
    add("sky_roofrun", "mouse", poly([
      { line: [24.1, jz, 24.1, zr] },
      { arc: { cx: 23.1, cz: zr, r: 1.0, a0: 0, a1: -PI / 2 } },
      { line: [23.1, zr - 1.0, 8.0, zr - 1.0] },
    ], (s) => Math.max(jy, prof.y(Math.max(0, s - sOff))), 0.3), "Roof Run", { tube: true });
  }
  // Mouse run 4: West Chute — study ring (1st floor) out the west wall, then ONE long straight
  // descent down the cavity between the west rooms and the outer shell → into the dining ring
  {
    const prof = easedProfile(F, G - F, 3.75 + 1.26 + 0.6);
    add("sky_westchute", "mouse", poly([
      { line: [-21.25, -4.0, -24.4, -4.0] },
      { arc: { cx: -24.4, cz: -4.8, r: 0.8, a0: PI / 2, a1: PI } },
      { line: [-25.2, -4.8, -25.2, -26.0] },
      { arc: { cx: -24.4, cz: -26.0, r: 0.8, a0: PI, a1: 1.5 * PI } },
      { line: [-24.4, -26.8, -23.25, -26.8] },
    ], (s) => prof.y(s), 0.3), "West Chute", { tube: true });
  }
  // Outdoor: Garden Skyway — off the Garden Return, round the front lawn + rose walk, then up an
  // orchard trestle to the LOOKOUT (tagged dead end, neon cap)
  {
    const prof = easedProfile(0, 2.0, 0);
    const trZ = -8.0;
    const pts = poly([
      { line: [-8.0, 19.0, -8.0, 21.4] },
      { arc: { cx: -9.2, cz: 21.4, r: 1.2, a0: 0, a1: PI / 2 } },
      { line: [-9.2, 22.6, -36.6, 22.6] },
      { arc: { cx: -36.6, cz: 21.4, r: 1.2, a0: PI / 2, a1: PI } },
      { line: [-37.8, 21.4, -37.8, trZ] },
      { line: [-37.8, trZ, -37.8, trZ - prof.len - 4.0] },
    ], () => 0, 0.4);
    let s0 = 0; const out = [];
    for (let i = 0; i < pts.length; i++) {
      if (i) s0 += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      out.push({ ...pts[i], y: pts[i].z < trZ ? R(prof.y(trZ - pts[i].z)) : 0 });
    }
    add("sky_garden", "loftramp", out, "Garden Skyway");
  }
  // logic11 CHANDELIER CENTERPIECE (Upper Landing): a neon helix climbs 3¼ turns round the
  // chandelier from the landing road to a lift pad; the hidden shaft carries the car on up
  // through the ceiling to the attic (DriveMode._tickLift) and an attic road joins the circuit.
  {
    const C = CHANDELIER, r = C.helixR, turns = 6.5 * PI;
    const HL = turns * r, y0 = 4.2, rise = C.padY - 4.2;
    const pts = poly([
      { line: [0.0, C.hz - r, C.hx, C.hz - r] },
      { arc: { cx: C.hx, cz: C.hz, r, a0: -PI / 2, a1: 6 * PI } },
      { arc: { cx: C.hx + r - 0.55, cz: C.hz, r: 0.55, a0: 0, a1: PI / 2 } },
      { line: [C.hx + r - 0.55, C.hz + 0.55, C.pad.x, C.pad.z] },
    ], (s) => { const u = Math.max(0, Math.min(1, (s - C.hx) / HL)); return y0 + rise * (0.5 - 0.5 * Math.cos(PI * u)); }, 0.3, 0.2);
    add("sky_chandelier", "loft", pts, "Chandelier Spiral", { width: 0.8, lift: "bottom" });
    // logic14: the hidden lift became a PADDLE CONVEYOR (see CONVEYOR). The spiral now ends on a
    // boarding pad that a passing flap scoops; the car rides up and drives off WEST at the top
    // onto this brass road, which curves north over the attic ceiling and rises to the Roof Ring.
    const K = CONVEYOR, x0 = K.exit.x, z0 = K.exit.z;
    const ex = poly([
      { line: [x0, z0, 0.9, z0] },
      { arc: { cx: 0.9, cz: z0 - 0.9, r: 0.9, a0: PI / 2, a1: PI } },
      { line: [0.0, z0 - 0.9, 0.0, -5.0] },
    ], () => 0, 0.4, 0.15);
    let acc = 0;
    const exPts = ex.map((q, i) => { if (i) acc += Math.hypot(q.x - ex[i - 1].x, q.z - ex[i - 1].z); return q; });
    const sR0 = 0.95 + 0.45 * PI + 0.6, total = acc;
    acc = 0;
    add("sky_conveyor_exit", "loftramp", exPts.map((q, i) => {
      if (i) acc += Math.hypot(q.x - exPts[i - 1].x, q.z - exPts[i - 1].z);
      const u = Math.max(0, Math.min(1, (acc - sR0) / (total - sR0 - 0.8)));
      return { ...q, y: R(K.deckY + (ROOF_LIFT.topY - K.deckY) * (0.5 - 0.5 * Math.cos(PI * u))) };
    }), "Conveyor Top Road", { width: 0.9, lift: "top" });
  }
  // ── logic13 "GET LOST": more turns, tunnels, loops, outdoor routes, roof + fountain ──────────
  {
    const X = 2.55, zb = 5.6, r = 1.0, xN = 4.85; // HALL_X skybridge (heading +z) → LEFT (+x)
    // LEFT TURN off the skybridge, U-arc back north beside it, then a TUNNEL through the foyer
    // north wall + armoury south wall onto the Armoury Ring (all at the ground wall-top, y 3.2)
    add("sky_foyer_left", "loft", poly([
      { line: [X, zb - 0.6, X, zb] },
      { arc: { cx: X + r, cz: zb, r, a0: PI, a1: PI / 2 } },
      { line: [X + r, zb + r, xN - r, zb + r] },
      { arc: { cx: xN - r, cz: zb, r, a0: PI / 2, a1: 0 } },
      { line: [xN, zb, xN, -0.8] },
      { arc: { cx: xN + 1.2, cz: -0.8, r: 1.2, a0: PI, a1: 1.5 * PI } },
      { line: [xN + 1.2, -2.0, 7.6 + 1.0, -2.0] },
    ], () => G, 0.4, 0.15), "Foyer Left Tunnel");
  }
  // logic15 BRIDGE (Ben's screenshot: Armoury NW corner → through the foyer tunnel): a short span
  // off the Foyer Left road (x 4.85, y 3.2) that curves east and merges onto Climb B's straight
  // (x 7.0, the road rising round the foyer pillar) at exactly its height. ≤ 9% grade.
  {
    const fCB = (z) => 3.193 - 0.2925 * (z - 2.0) + 0.003;   // Climb B centreline height along x = 7.0 (+3 mm: no coplanar fight)
    // Surface height is a FIELD (yAt), not just the centreline: where the span overlaps Climb B
    // (x ≥ 6.5) it is exactly (+3 mm) Climb B's surface across its whole width — no kerb, no hump.
    const yAt = (x, z) => { const w = Math.max(0, Math.min(1, (x - 4.9) / 1.6)), e = w * w * (3 - 2 * w); return 3.2 * (1 - e) + fCB(z) * e; };
    // Driving direction = Ben's: north (−z) along Foyer Left, peel RIGHT, swing across and join
    // Climb B heading north UP its slope toward the crest.
    const pts = poly([
      { arc: { cx: 5.45, cz: 3.0, r: 0.6, a0: PI, a1: 1.5 * PI } },   // peel right off Foyer Left (heading −z → +x)
      { line: [5.45, 2.4, 5.9, 2.4] },
      { arc: { cx: 5.9, cz: 1.3, r: 1.1, a0: PI / 2, a1: 0 } },       // swing left onto Climb B (→ −z, uphill)
      { line: [7.0, 1.3, 7.0, 0.7] },
    ], () => 3.2, 0.25, 0.15).map((q) => ({ ...q, y: R(yAt(q.x, q.z)) }));
    add("sky_bridge_climbb", "loftramp", pts, "Foyer Bridge", { yAt });
  }
  // Cross-links / loops
  add("sky_b_dining_glass", "loft", link(-7.2, -33.5, -12.0, -33.5, G), "Glasshouse–Dining Tunnel");
  add("sky_l_workshop_music", "loft", link(-6.75, -28.0, -5.2, -28.0, F), "Workshop–Music Tunnel");
  // Breakfast Parlor GREEN-WALL ROAD: dining floor → out the west wall → garden → Garden Skyway
  add("parlor_greenwall", "floor", poly([
    { line: [-13.0, -24.7, -31.5, -24.7] },
    { arc: { cx: -31.5, cz: -23.5, r: 1.2, a0: -PI / 2, a1: -PI } },
    { line: [-32.7, -23.5, -32.7, -3.2] },
    { arc: { cx: -33.9, cz: -3.2, r: 1.2, a0: 0, a1: PI / 2 } },
    { line: [-33.9, -2.0, -37.8, -2.0] },
  ], () => 0, 0.5), "Green-Wall Road", { width: 0.9 });
  // Nursery LOFT: floor ramp up to a loft platform, then on up to the Nursery Ring (25%)
  {
    const yF = 4.2, yL = 5.7, sA = 6.0, sB = sA + 2.5 + (PI / 2) * 1.2;
    const pts = poly([
      { line: [8.0, -12.4, 14.0, -12.4] },          // ramp 1 (6.0 @ 25%)
      { line: [14.0, -12.4, 16.5, -12.4] },         // loft platform
      { arc: { cx: 16.5, cz: -11.2, r: 1.2, a0: -PI / 2, a1: 0 } },
      { line: [17.7, -11.2, 17.7, -5.2] },          // ramp 2 (6.0 @ 25%)
      { line: [17.7, -5.2, 17.7, -2.8] },
    ], (s) => s < sA ? yF + (yL - yF) * (s / sA) : s < sB ? yL : yL + (F - yL) * Math.min(1, (s - sB) / 6.0), 0.4, 0.15);
    add("nursery_loft", "loftramp", pts, "Nursery Loft", { width: 1.0 });
  }
  // FOUNTAIN: a court road off the Garden Return to a radial ramp up onto the fountain's drivable RIM
  {
    const F0 = FOUNTAIN, zr0 = 27.9, zr1 = F0.z - F0.r - 0.35;
    const pts = poly([
      { line: [-6.2, 19.0, -6.2, 25.5] },
      { arc: { cx: -5.0, cz: 25.5, r: 1.2, a0: PI, a1: PI / 2 } },
      { line: [-5.0, 26.7, F0.x - 1.2, 26.7] },
      { arc: { cx: F0.x - 1.2, cz: 27.9, r: 1.2, a0: -PI / 2, a1: 0 } },
      { line: [F0.x, 27.9, F0.x, F0.z - F0.r] },
    ], (s) => 0, 0.4, 0.15).map((q) => ({ ...q, y: Math.abs(q.x - F0.x) < 1e-3 && q.z >= zr0 ? R(F0.rimY * Math.min(1, (q.z - zr0) / (zr1 - zr0))) : q.y }));
    add("court_fountain", "floor", pts, "Fountain Court", { width: 0.9 });
    add("fountain_rim", "floor", poly([{ arc: { cx: F0.x, cz: F0.z, r: F0.r, a0: -PI / 2, a1: 1.5 * PI } }], () => F0.rimY, 0.3, 0.12), "Fountain Rim", { width: 0.6, solid: 0 });
  }
  // ROOF TRACKS: attic road → roof lift (hidden shaft through the roof) → roof-top ring round the
  // peak → a run down the east roof slope to the ROOF EDGE lookout (tagged dead end)
  {
    const L = ROOF_LIFT;
    add("sky_attic_roof", "floor", link(0.0, -16.0, L.pad.x, L.pad.z, AT), "Roof Lift Road", { width: 0.9, lift: "bottom" });
    add("sky_roof_ring", "loft", ring(-3.0, 3.0, -11.0, -5.0, L.topY, 1.0), "Roof Ring");
    add("sky_roof_spoke", "loft", link(L.pad.x, L.pad.z, 0.0, -5.0, L.topY), "Roof Spoke", { lift: "top" });
    const s0 = 3.0, run = 8.6;
    add("sky_roof_edge", "loftramp", poly([{ line: [s0, -8.0, s0 + run, -8.0] }],
      (s) => L.topY - ROOF_SLOPE * Math.max(0, s - 0.6) * 0.98, 0.4), "Roof Slope Run");
    // logic16 GRAND DESCENT: carries straight on from the Roof Slope Run's end (no barricade
    // now), flies east over the roof and clears the east shell's cornice, corkscrews 2¾ turns round
    // the Descent Turret, then sweeps down the east yard and round onto the front lawn.
    // One cosine profile → grade eases in/out, max ≈ 22%.
    const D = GRAND_DESCENT, y0 = L.topY - ROOF_SLOPE * (run - 0.6) * 0.98, S = D.dropLen;
    add("grand_descent", "loftramp", poly([
      { line: [s0 + run, -8.0, D.tx, -8.0] },
      { arc: { cx: D.tx, cz: D.tz, r: D.tr, a0: PI / 2, a1: PI / 2 - 5.5 * PI } },
      { line: [D.tx - D.tr, D.tz, D.tx - D.tr, 16.0] },
      { arc: { cx: D.tx - D.tr - 4.0, cz: 16.0, r: 4.0, a0: 0, a1: PI / 2 } },
      { line: [D.tx - D.tr - 4.0, 20.0, 14.0, 20.0] },
    ], (s) => R(s >= S ? 0 : y0 * (0.5 + 0.5 * Math.cos(PI * s / S))), 0.3, 0.18), "Grand Descent", { width: 1.0 });
    // logic16 TREEHOUSE SKY ROAD: peels off the Grand Descent at the turret mouth, sweeps south
    // through the Treehouse hut and corkscrews down round the yard oak's trunk onto the lawn.
    const T = TREEHOUSE, sJ = D.tx - s0 - run, yD = (u) => y0 * (0.5 + 0.5 * Math.cos(PI * u / S)), F = 3.4;
    const yJ = yD(sJ + F), LA = T.leadLen, LB = T.downLen; // the fork's first 3.4 m shadows the Descent's own height (no step between them)
    add("tree_road", "loftramp", poly([
      { line: [D.tx, -8.0, D.tx + 3.4, -8.0] },
      { arc: { cx: D.tx + 3.4, cz: -2.0, r: 6.0, a0: -PI / 2, a1: 0 } },
      { line: [D.tx + 9.4, -2.0, D.tx + 9.4, T.hutZ1] },
      { line: [D.tx + 9.4, T.hutZ1, D.tx + 9.4, T.hutZ1 + T.hutLen] },
      { arc: { cx: T.x, cz: T.z, r: T.r, a0: PI, a1: PI - 2.5 * PI } },
      { line: [T.x, T.z + T.r, T.x + 3.0, T.z + T.r] },
    ], (s) => R(s <= F ? yD(sJ + s) : s <= LA ? T.deckY + (yJ - T.deckY) * (0.5 + 0.5 * Math.cos(PI * (s - F) / (LA - F)))
      : s <= LA + T.hutLen ? T.deckY : s >= LA + T.hutLen + LB ? 0 : T.deckY * (0.5 + 0.5 * Math.cos(PI * (s - LA - T.hutLen) / LB))), 0.3, 0.18), "Treehouse Sky Road", { width: 0.95 });
  }
  return P;
}
const HALL_X = 2.55, SOUTH_Z = 12.23, CAV_Z = 13.57;

// 1) Skyline Climb — hall_ground east side, from the conservatory doorway north → south.
const climbProf = easedProfile(0, H, 2.2);
const CLIMB_START_Z = -21.6;
const CLIMB_TOP_Z = CLIMB_START_Z + 2.2 + climbProf.len;
const skylineClimb = poly([{ line: [HALL_X, CLIMB_START_Z, HALL_X, CLIMB_TOP_Z + 0.6] }].map((p) => ({ line: [p.line[0], p.line[1], p.line[2], p.line[3]] })),
  (s) => climbProf.y(s));
// poly() walks x→x / z→z; swap our (x,z) line correctly
// 2) Skyline — hall wall-top → portals → skybridge → south wall-top → west SKY END
const BR = 1.23;
const skyline = poly([
  { line: [HALL_X, CLIMB_TOP_Z + 0.6, HALL_X, 11.0] },
  { arc: { cx: HALL_X - BR, cz: 11.0, r: BR, a0: 0, a1: PI / 2 } },
  { line: [HALL_X - BR, SOUTH_Z, -7.6, SOUTH_Z] },
], () => H);
// 3) East spur → BARRICADE
const eastSpur = poly([
  { line: [HALL_X, 9.4, HALL_X, 11.0] },
  { arc: { cx: HALL_X + BR, cz: 11.0, r: BR, a0: PI, a1: PI / 2 } },
  { line: [HALL_X + BR, SOUTH_Z, 7.6, SOUTH_Z] },
], () => H);
// 4) Mouse Run — S-jog through the foyer S wall portal into the hollow, then down to the lawn
const X0 = -0.4, JR = 0.67;
const runProf = easedProfile(H, -H, 0.2 + (PI / 2) * JR * 2 + 0.4);
const runEndX = X0 - 2 * JR - 0.4 - runProf.len;
const mouseRun = poly([
  { line: [X0 + 0.2, SOUTH_Z, X0, SOUTH_Z] },
  { arc: { cx: X0, cz: SOUTH_Z + JR, r: JR, a0: -PI / 2, a1: -PI } },
  { arc: { cx: X0 - 2 * JR, cz: SOUTH_Z + JR, r: JR, a0: 0, a1: PI / 2 } },
  { line: [X0 - 2 * JR, CAV_Z, runEndX - 1.6, CAV_Z] },
], (s) => runProf.y(s));
// 5) Garden Return — lawn west of the façade, round the front, in through the front door + mouse hole
const GX = runEndX - 1.6, RR = 1.2;
const gardenReturn = poly([
  { line: [GX, CAV_Z, GX - 0.4, CAV_Z] },
  { arc: { cx: GX - 0.4, cz: CAV_Z + RR, r: RR, a0: -PI / 2, a1: -PI } },
  { line: [GX - 0.4 - RR, CAV_Z + RR, GX - 0.4 - RR, 17.8] },
  { arc: { cx: GX - 0.4, cz: 17.8, r: RR, a0: PI, a1: PI / 2 } },
  { line: [GX - 0.4, 19.0, 1.0 - RR, 19.0] },   // threads between the front-drive lamp pillars (0,18)/(0,20)
  { arc: { cx: 1.0 - RR, cz: 17.8, r: RR, a0: PI / 2, a1: 0 } },
  { line: [1.0, 17.8, 1.0, 11.45] },
], () => 0, 0.5);

export const LOFT_H = H;
/** logic11 chandelier + hidden lift shaft (Upper Landing → attic). */
export const CHANDELIER = {
  hx: 2.2, hz: 3.75, helixR: 1.1,            // helix centre / radius
  cx: 2.2, cz: 4.0,                         // chandelier axis (hangs from the lift pad)
  pad: { x: 2.62, z: 4.3 }, padY: 7.7, topY: 8.45, padR: 0.3, // logic14: pad end nudged east (conveyor boarding)
  yawUp: Math.PI, yawDown: Math.PI / 2,      // release headings: attic road north / back out the spoke
  shaft: { minX: 1.8, maxX: 2.6, minZ: 3.9, maxZ: 4.7 },
};
/** logic13 front-court fountain (rim = drivable ring). */
export const FOUNTAIN = { x: 8.0, z: 31.3, r: 1.7, rimY: 0.35, basinR: 1.4 };
/** logic16 Grand Descent geometry (turret corkscrew outside the east shell wall x≈26.5). */
export const GRAND_DESCENT = { tx: 30.6, tz: -10.6, tr: 2.6, dropLen: 78.0 };
/** logic16 yard oak + treehouse: helix centre (= trunk), hut on the flat stretch at x 40. */
export const TREEHOUSE = { x: 42.4, z: 19.5, r: 2.4, deckY: 3.6, hutZ1: 18.0, hutLen: 1.5, leadLen: 3.4 + 3 * Math.PI + 20.0, downLen: 2.5 * Math.PI * 2.4 + 3.0,
  squirrel: { x: 40.0, z: 18.75, r: 1.0, every: 4 }, nest: { x: 42.4 + 2.4, z: 19.5, r: 1.0, every: 9 } };
// lane height where the helix passes the nest (a = 0, i.e. π·r along the down-run)
TREEHOUSE.nest.y = TREEHOUSE.deckY * (0.5 + 0.5 * Math.cos(Math.PI * (Math.PI * TREEHOUSE.r) / TREEHOUSE.downLen));
TREEHOUSE.squirrel.y = TREEHOUSE.deckY;
/** logic18 TIMBER SHAFT: two-story-tall switchback ramp in the east wall cavity between the
 *  armoury/nursery east walls (x≈24 / x≈22) and the outer shell (x≈26.5). */
export const TIMBER = {
  x: 24.92,           // lane centreline (inner run) — logic19: was 25.05; with Run B at 25.63 the twin decks no longer overlap
  xInner: 24.40,      // against armoury east wall
  xOuter: 26.00,      // against shell
  zS: 13.2, zN: -15.8,
  y0: 0.0, y1: 3.35, y2: 6.70, yT: 8.45,
  width: 0.72,        // tighter — fits between studs with clearance
  gY: 3.20, fY: 7.20,
};
/** logic18 GUTTER: straight steep chute down the EAST outer shell (outside the timber cavity).
 *  Separate from Grand Descent (turret/corkscrew further east). Entered from the timber shaft top. */
export const GUTTER = {
  x: 26.50,           // seated in the east-façade full-height slot (shell centre)
  z0: -15.5, z1: 0.0, // north → mid-yard (shorter = steeper ~55%)
  y0: 8.45, y1: 0.02,  // attic → lawn
  width: 0.70,
  wallH: 0.14,        // soft trough walls — tall enough to nudge, short enough to wiggle over a bit
};

/** logic13 second lift: attic centre → roof-top deck (hidden shaft through the attic ceiling + roof). */
const ROOF_SLOPE = 0.288;
export const ROOF_LIFT = {
  id: "roof", pad: { x: 0.0, z: -10.3 }, padY: 8.45, topY: 13.35, padR: 0.3,
  yawUp: 0, yawDown: Math.PI,
  shaft: { minX: -0.4, maxX: 0.4, minZ: -10.7, maxZ: -9.9 },
};
/** logic14 PADDLE CONVEYOR above the chandelier: a vertical belt loop in the y–z plane (pulleys
 *  turn about x). The ascending run faces +z; its flaps stand out horizontally to z=zc+Rp+flapL and
 *  are real (moving) drive surfaces. Flaps fold flat against the belt everywhere else, unfolding
 *  in the bottom arc and tipping over at the top. Board at `pad`, drive off west at `exit`. */
export const CONVEYOR = {
  id: "conveyor", conveyor: true,
  x: 2.24, zc: 3.8, Rp: 0.2,
  flapX0: 1.86, flapX1: 2.62, flapL: 0.64,    // visual flap: x 1.86..2.62, z 4.0..4.64
  phys: { minX: 1.84, maxX: 2.665, minZ: 4.0, maxZ: 4.65 }, // = every car centre the cage allows
  yB: 7.5, yT: 12.95, deckY: 12.5, v: 0.5, n: 14,
  pad: { x: 2.62, z: 4.3 }, padY: 7.7, padR: 0.3,
  exit: { x: 1.86, z: 4.3 }, topPad: { x: 1.86, z: 4.3 }, topY: 12.5,
  shaft: { minX: 1.72, maxX: 2.78, minZ: 3.5, maxZ: 4.78 },
};
/** u (distance along the loop, 0 = bottom of the ascending run) → attach point, tangent, fold. */
export function conveyorFrame(u) {
  const K = CONVEYOR, H = K.yT - K.yB, A = Math.PI * K.Rp, L = 2 * H + 2 * A;
  u = ((u % L) + L) % L;
  let y, z, ty, tz, ny, nz;
  if (u < H) { y = K.yB + u; z = K.zc + K.Rp; ty = 1; tz = 0; ny = 0; nz = 1; }
  else if (u < H + A) { const a = (u - H) / K.Rp; ny = Math.sin(a); nz = Math.cos(a); y = K.yT + K.Rp * ny; z = K.zc + K.Rp * nz; ty = Math.cos(a); tz = -Math.sin(a); }
  else if (u < 2 * H + A) { y = K.yT - (u - H - A); z = K.zc - K.Rp; ty = -1; tz = 0; ny = 0; nz = -1; }
  else { const a = Math.PI + (u - 2 * H - A) / K.Rp; ny = Math.sin(a); nz = Math.cos(a); y = K.yB + K.Rp * ny; z = K.zc + K.Rp * nz; ty = Math.cos(a); tz = -Math.sin(a); }
  // fold: 0 = standing out (carrying), 1 = flat against the belt (trailing)
  let fold;
  if (u <= H) fold = 0;
  else if (u < H + 0.35) fold = (u - H) / 0.35;      // tips over the top
  else if (u > L - 0.42) fold = (L - u) / 0.42;       // unfolds round the bottom
  else fold = 1;
  fold = fold * fold * (3 - 2 * fold);
  return { y, z, ty, tz, ny, nz, fold, u, L, H, carrying: u <= H };
}
export const LIFTS = [ROOF_LIFT, CONVEYOR]; // logic14: chandelier shaft lift → conveyor (DriveMode skips .conveyor)
export const LOFT_PATHS = [
  { id: "loft_climb", kind: "loftramp", width: 1.10, points: skylineClimb, label: "Skyline Climb" },
  { id: "loft_skyline", kind: "loft", width: 1.10, points: skyline, label: "Skyline", deadEnd: "end", keepWidth: true }, // logic14: kept 1.1 (foyer drop-in sim)
  { id: "loft_east_spur", kind: "loft", width: 1.10, points: eastSpur, label: "Skyline East", deadEnd: "end" },
  { id: "mouse_run", kind: "mouse", width: 0.70, points: mouseRun, label: "Mouse Run", keepWidth: true }, // logic14: kept 0.7 (through-wall entry sim)
  { id: "garden_return", kind: "floor", width: 1.10, points: gardenReturn, label: "Garden Return" },
  ...EXPANSION_PATHS(),
  ...LAB_PATH_DEFS, // logic19 backyard lab garage circuit + window road
].map((p) => ({ ...p, loft: true, raw: true, authoredGrade: true, closed: false }));

/** Intentional dead ends (Ben: 2–4, readable as features). */
export const LOFT_DEAD_ENDS = [
  { id: "sky_end_west", pathId: "loft_skyline", at: "end", style: "endcap", label: "Sky End" },
  { id: "barricade_east", pathId: "loft_east_spur", at: "end", style: "barricade", label: "Barricade" },
  { id: "orchard_lookout", pathId: "sky_garden", at: "end", style: "endcap", label: "Orchard Lookout" },
  // logic16: the Roof Edge barricade is gone — the Grand Descent carries on from there
];

/** Framed openings the network passes through (must match mansion._driveOpeningsForWall). */
export const LOFT_PORTALS_LEGACY = [
  { x: HALL_X, z: 2.0, axis: "z", w: 1.5, y0: 2.98, y1: 3.80 },   // hall S wall
  { x: HALL_X, z: -1.0, axis: "z", w: 1.5, y0: 2.98, y1: 3.80 },  // foyer N wall
  { x: -1.07, z: 13.0, axis: "z", w: 1.5, y0: 2.98, y1: 3.80 },   // foyer S wall → hollow
  { x: 1.0, z: 13.0, axis: "z", w: 1.4, y0: 0.0, y1: 0.90 },      // foyer S floor mouse hole
  { x: 1.0, z: 14.2, axis: "z", w: 3.2, y0: 0.0, y1: 3.40 },      // façade front door (existing)
];

/** logic10: every place a Skyline path pierces a room wall gets a framed opening (+ neon trim).
 *  mansion._driveOpeningsForWall appends these (skipping any already covered by a door/arch). */
import { ROOMS as _ROOMS } from "./rooms.js?v=logic24";
function autoPortals() {
  const out = [];
  const near = (q) => LOFT_PORTALS_LEGACY.some((L) => Math.hypot(L.x - q.x, L.z - q.z) < 0.8 && Math.abs(L.y0 - q.y0) < 1.5)
    || out.some((L) => L.axis === q.axis && Math.abs((q.axis === "z" ? L.z - q.z : L.x - q.x)) < 0.05 && Math.hypot(L.x - q.x, L.z - q.z) < 0.5 && Math.abs(L.y0 - q.y0) < 0.5);
  for (const path of LOFT_PATHS) {
    if (!path.id.startsWith("sky_") && !path.id.startsWith("timber_") && path.id !== "gutter" && path.id !== "gutter_entry" && path.id !== "parlor_greenwall" && path.id !== "nursery_loft") continue; // logic13 + logic18 timber/gutter
    const pts = path.points;
    for (const room of Object.values(_ROOMS)) {
      if (room.outdoor) continue;
      const [w, h, d] = room.size, [cx, cy, cz] = room.pos;
      const walls = [
        { axis: "z", c: cz - d / 2, lo: cx - w / 2, hi: cx + w / 2, side: "north" },
        { axis: "z", c: cz + d / 2, lo: cx - w / 2, hi: cx + w / 2, side: "south" },
        { axis: "x", c: cx - w / 2, lo: cz - d / 2, hi: cz + d / 2, side: "west" },
        { axis: "x", c: cx + w / 2, lo: cz - d / 2, hi: cz + d / 2, side: "east" },
      ];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        for (const W of walls) {
          const ka = W.axis === "z" ? a.z : a.x, kb = W.axis === "z" ? b.z : b.x;
          if ((ka - W.c) * (kb - W.c) > 0 || ka === kb) continue;
          const t = (W.c - ka) / (kb - ka);
          const al = W.axis === "z" ? a.x + (b.x - a.x) * t : a.z + (b.z - a.z) * t;
          const y = a.y + (b.y - a.y) * t;
          if (al < W.lo + 0.3 || al > W.hi - 0.3 || y < cy - 0.3 || y > cy + h - 0.3) continue;
          const q = W.axis === "z"
            ? { x: Math.round(al * 100) / 100, z: W.c, axis: "z", w: path.width + 0.5, y0: Math.round((y - 0.24) * 100) / 100, y1: Math.round((y + (path.tube ? 0.62 : 0.6)) * 100) / 100 }
            : { x: W.c, z: Math.round(al * 100) / 100, axis: "x", w: path.width + 0.5, y0: Math.round((y - 0.24) * 100) / 100, y1: Math.round((y + (path.tube ? 0.62 : 0.6)) * 100) / 100 };
          if (q.y0 < cy) q.y0 = cy;
          q.pathId = path.id;
          if (!near(q)) out.push(q);
        }
      }
    }
  }
  return out;
}
export const LOFT_AUTO_PORTALS = autoPortals();
export const LOFT_PORTALS = LOFT_PORTALS_LEGACY.concat(LOFT_AUTO_PORTALS);
