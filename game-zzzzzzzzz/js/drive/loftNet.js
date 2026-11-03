import * as THREE from "three";
import { buildMouseWorld } from "./mouseWorld.js?v=logic26";
import { LOFT_PATHS, LOFT_DEAD_ENDS, LOFT_PORTALS, LIFTS, FOUNTAIN, CONVEYOR, GUTTER, TIMBER } from "../data/loftNet.js?v=logic26";
import { buildConveyor } from "./conveyor.js?v=logic26";
import { buildYard } from "./treehouse.js?v=logic26";
import { buildTimberAndGutter } from "./timberGutter.js?v=logic26";
import { KICKERS, kickerBox } from "../data/kickers.js?v=logic26";
import { ROOMS } from "../data/rooms.js?v=logic26";
import { LAB, inLab } from "../data/labGarage.js?v=logic26";
const VISIBLE_IDS = new Set(["garden_return", "loft_climb", "parlor_greenwall", "court_fountain", "fountain_rim", "nursery_loft"]); // visible mansion floor roads
const TUBE_IDS = new Set(LOFT_PATHS.filter((p) => p.tube).map((p) => p.id));
/** ceiling above (indoors) or the roof/ground below (outdoors) for a trestle at (x,y,z) */
function supportAt(x, y, z) {
  let ceil = null, below = 0;
  for (const r of Object.values(ROOMS)) {
    if (r.outdoor) continue;
    const [w, h, d] = r.size, [cx, cy, cz] = r.pos;
    if (x < cx - w / 2 || x > cx + w / 2 || z < cz - d / 2 || z > cz + d / 2) continue;
    if (y >= cy - 0.05 && y < cy + h) ceil = Math.min(ceil ?? 99, cy + h - 0.2);
    else if (cy + h <= y) below = Math.max(below, cy + h);
  }
  return { ceil, below };
}

/**
 * logic9 Skyline visuals + solids. GPU-lite: everything below is ~10 draw calls total
 * (merged BufferGeometries + InstancedMeshes), unlit MeshBasic neon (no lights added).
 */
const RIDE = 0.012;              // = tracks.ASPHALT_RIDE (no import: avoid a cycle)
const RAIL_H = 0.035, RAIL_T = 0.04; // low toy rail: just above the car's collision band floor (+0.02)
const NEON_BLUE = 0x5fe8ff, NEON_PURPLE = 0x8e8cff; // logic17: electric cyan + ice violet (was 0x39a8ff / 0xb04dff)
const NEON_BIO = 0x2fd6a2; // logic17: faint bioluminescent edge on the treehouse road
const CEIL_Y = 4.0;
const LOFT_IDS = new Set(LOFT_PATHS.map((p) => p.id));

/** logic14: each area gets its own deck colour/material (neon edges unchanged on the secret layer). */
const THEME_BY_ID = {
  // logic16 (Ben: less wood/gold): spiral sapphire, roof slate blue, conveyor road graphite+neon,
  // runners only on the two visible garden/loft-climb floors; elsewhere emerald/crimson/slate/plum/stone.
  loft_east_spur: "parody", loft_skyline: "purple", garden_return: "runner", loft_climb: "runner",
  parlor_greenwall: "emerald", nursery_loft: "crimson", court_fountain: "stone", fountain_rim: "stone",
  sky_attic: "stone", sky_science: "slate", sky_l_science: "slate", sky_garden: "emerald",
  sky_chandelier: "sapphire", sky_conveyor_exit: "graphite", sky_attic_roof: "slate", sky_roof_ring: "slate", sky_roof_spoke: "slate", sky_roof_edge: "slate",
  grand_descent: "descent", tree_road: "moss",
  timber_shaft: "graphite", timber_g: "graphite", timber_f: "graphite", timber_attic: "graphite", timber_lawn: "graphite",
  gutter: "slate", gutter_entry: "slate",
  lab_circuit: "graphite", lab_window: "slate", // logic19 lab garage
};
export function deckTheme(path) {
  if (!path) return "purple";
  if (THEME_BY_ID[path.id]) return THEME_BY_ID[path.id];
  if (path.kind === "mouse" || path.tube) return "card";
  const ys = path.points.map((p) => p.y), ym = ys.reduce((a, b) => a + b, 0) / Math.max(1, ys.length);
  if (Math.abs(ym - 3.2) < 0.3) return "plum";
  if (Math.abs(ym - 7.2) < 0.3) return "teal";
  return "purple";
}

function edgeOf(seg, side) {
  const nx = seg.dir.z, nz = -seg.dir.x; // left normal
  const o = side * seg.width * 0.5;
  return [seg.a.x + nx * o, seg.a.z + nz * o, seg.b.x + nx * o, seg.b.z + nz * o];
}

function onOtherDeck(segs, self, x, y, z) {
  for (const s of segs) {
    if (s === self) continue;
    if (s.pathId === self.pathId && Math.abs(s._k - self._k) < 4) continue;
    const abx = s.b.x - s.a.x, abz = s.b.z - s.a.z, L2 = abx * abx + abz * abz;
    if (L2 < 1e-8) continue;
    const u = Math.max(0, Math.min(1, ((x - s.a.x) * abx + (z - s.a.z) * abz) / L2));
    const sy = s.a.y + (s.b.y - s.a.y) * u;
    if (Math.abs(sy - y) > 0.3) continue;
    // logic18: open gore only at branch mouths (shaft↔off-ramp), NOT between the shaft's own parallel runs
    // (that was stripping every rail off the twin lanes). Gutter entry joins similarly.
    const branch = (a, b) => (a === "timber_shaft" && /^timber_(g|f|attic|lawn)$/.test(b))
      || (b === "timber_shaft" && /^timber_(g|f|attic|lawn)$/.test(a))
      || (a === "gutter" && b === "gutter_entry") || (b === "gutter" && a === "gutter_entry")
      || (a === "tree_road" && b === "grand_descent") || (b === "tree_road" && a === "grand_descent")
      || (a === "lab_circuit" && b === "lab_window") || (b === "lab_circuit" && a === "lab_window") // logic19 window fork
      || (a === "timber_f" && b === "sky_roofrun") || (b === "timber_f" && a === "sky_roofrun"); // logic19 Roof Run fork
    // logic19: the attic mouth sits at the shaft tip — a 0.4 gore stripped Run C's inner rail ~1 m down the
    // ramp and cars coming back down off the Cap dropped into the liner gap. Tight gore there.
    // Same at the first-floor mouth: the shaft's + Roof Run's own rails stay right up to the timber_f deck edge.
    const tight = (s.pathId === "timber_attic" && self.pathId === "timber_shaft") || (self.pathId === "timber_attic" && s.pathId === "timber_shaft")
      || (/^timber_[fg]$/.test(s.pathId) && (self.pathId === "timber_shaft" || self.pathId === "sky_roofrun"))
      || (s.pathId === "lab_circuit" && self.pathId === "lab_window") // logic19: window road keeps its outer rail round the fork
      || (s.pathId === "lab_window" && self.pathId === "lab_circuit"); // …and the circuit keeps its SE outer rail except right at the window mouth
    // logic19: timber_f / timber_g leave WEST off the shaft — never strip the shaft's east-side rail for them
    if (self.pathId === "timber_shaft" && /^timber_[fg]$/.test(s.pathId) && x > TIMBER.x + 0.05) continue;
    const gore = branch(s.pathId, self.pathId) ? (tight ? (s.pathId === "timber_attic" ? -0.25 : self.pathId === "timber_shaft" ? 0.15 : self.pathId === "lab_window" ? -0.1 : self.pathId === "lab_circuit" ? 0.05 : -0.1) : 0.4) : 0.06; // logic16: Treehouse fork — open gore, no rail wedge across the mouth
    if (Math.hypot(x - (s.a.x + abx * u), z - (s.a.z + abz * u)) < s.width * 0.5 + gore) return true;
  }
  return false;
}

/** Drop-side rails (+ barricades) as hard Drive colliders. Deterministic from segments. */
export function loftSolids(segments) {
  const segs = segments.filter((s) => LOFT_IDS.has(s.pathId));
  segs.forEach((s, i) => { s._k = i; });
  // logic16: Climb B's low sweeping bend (x 5.5–7, z 10.8–12, deck 0.25–0.6 up) gets kerb rails —
  // super-turbo ran wide off it and wedged against the deck side.
  const bend = segments.filter((s) => (s.pathId === "climb_b" || s.pathId === "climb_a") && Math.min(s.a.y, s.b.y) > 0.25 && Math.max(s.a.y, s.b.y) < 0.8
    && Math.abs(s.a.x) > 4.5 && Math.abs(s.a.x) < 7.4 && s.a.z > 10.2 && s.a.z < 12.2) // (Climb A mirrors it on the west)
    // logic22 (Ben t186u): Climb B's top turn leaves the Upper Landing over the open well — its sides get rails
    // once the deck is clear of the landing floor (x > 5.75), so a diagonal entry can't drop into the Foyer.
    .concat(segments.filter((s) => s.pathId === "climb_b" && Math.min(s.a.y, s.b.y) > 3.3 && Math.max(s.a.x, s.b.x) > 5.75 && Math.max(s.a.x, s.b.x) < 7.3 && Math.max(s.a.z, s.b.z) < 1.2 && Math.min(s.a.z, s.b.z) > -2.0));
  bend.forEach((s, i) => { s._k = 100000 + i; });
  const rails = [], solids = [];
  for (const s of [...segs, ...bend]) {
    const yMin = Math.min(s.a.y, s.b.y);
    const rimOuter = s.pathId === "fountain_rim"; // logic16: the rim gets a low OUTER kerb-rail (turbo flew off the ring and wedged against its wall)
    // logic19: timber_lawn keeps floor rails only inside the cavity — out on the open lawn they just trip cars crossing it
    const keepLow = /^timber_|gutter|mouse_run/.test(s.pathId) && !(s.pathId === "timber_lawn" && Math.min(s.a.z, s.b.z) > 14.0);
    if (yMin < (/^climb_[ab]$/.test(s.pathId) ? 0.25 : keepLow ? -1 : 0.6) && !rimOuter) continue; // logic18: timber/gutter/mouse keep rails to the floor
                           // low road: no rail (a 0.6 hop is fine)
    if (s.pathId === "sky_chandelier" && yMin < 4.26) continue; // logic16: only the flush foot is open (was < 4.45 — the low turn ran off its open edge) // logic11: spiral foot on the landing floor stays open
    // logic9: rails along the whole mouse run (the foyer front-door gap x∈[-5.4,-2] is an open side)
    for (const side of [-1, 1]) {
      let [x0, z0, x1, z1] = edgeOf(s, side);
      if (rimOuter && Math.hypot((x0 + x1) / 2 - 8.0, (z0 + z1) / 2 - 31.3) < 1.7) continue;
      if (s.pathId === "sky_conveyor_exit" && Math.max(x0, x1) > 1.7) { // logic14: rails start clear of the conveyor cage
        if (Math.min(x0, x1) > 1.7) continue;
        if (x0 > 1.7) { z0 = z0 + (z1 - z0) * (x0 - 1.7) / (x0 - x1); x0 = 1.7; } else { z1 = z1 + (z0 - z1) * (x1 - 1.7) / (x1 - x0); x1 = 1.7; }
      }
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, my = (s.a.y + s.b.y) / 2;
      const pool = s.yAt ? segments : segs; // logic15: the Foyer Bridge merges onto Climb B (a ribbon) — no rail across it
      if (onOtherDeck(pool, s, mx, my, mz) || onOtherDeck(pool, s, x0, s.a.y, z0) || onOtherDeck(pool, s, x1, s.b.y, z1)) continue;
      const box = new THREE.Box3(
        new THREE.Vector3(Math.min(x0, x1) - RAIL_T / 2, yMin + RIDE - 0.01, Math.min(z0, z1) - RAIL_T / 2),
        new THREE.Vector3(Math.max(x0, x1) + RAIL_T / 2, Math.max(s.a.y, s.b.y) + RIDE + RAIL_H, Math.max(z0, z1) + RAIL_T / 2));
      box.driveKind = "rail";
      // logic16: the real collider is the rail SEGMENT (a thin capsule along the deck edge), not
      // this axis-aligned box — on the curved spiral the AABB of a diagonal piece poked ~0.1 into the lane.
      box.rail = { x0, z0, x1, z1, y0: s.a.y + RIDE, y1: s.b.y + RIDE, t: RAIL_T / 2, h: RAIL_H };
      rails.push({ box, x0, z0, x1, z1, y0: s.a.y + RIDE, y1: s.b.y + RIDE });
      solids.push(box);
    }
  }
  // logic23 (Ben t187u "a barrier here which you can drive through"): where Gutter Entry leaves the Timber
  // Attic (x 25.42–25.95) both its edge rails were skipped as "on another deck" — the attic's wide deck
  // overlaps the mouth — so the cyan kerb visibly stopped short and the car ran through the gap and fell
  // ~5 m. Those first entry pieces now carry their low kerb on both sides (the travel direction stays open).
  for (const s of segs) {
    const shaftS = s.pathId === "timber_shaft" && Math.abs(s.a.z + 15.8) < 0.02 && Math.abs(s.b.z + 15.8) < 0.02 && Math.min(s.a.x, s.b.x) > 25.0;
    if (!shaftS && (s.pathId !== "gutter_entry" || Math.min(s.a.x, s.b.x) > 25.95)) continue;
    for (const side of [-1, 1]) {
      const [x0, z0, x1, z1] = edgeOf(s, side);
      if (shaftS && (z0 + z1) / 2 > -15.9) continue; // shaft's last east piece: south lip only (north is the attic/entry mouth)
      const yMin = Math.min(s.a.y, s.b.y);
      const box = new THREE.Box3(
        new THREE.Vector3(Math.min(x0, x1) - RAIL_T / 2, yMin + RIDE - 0.01, Math.min(z0, z1) - RAIL_T / 2),
        new THREE.Vector3(Math.max(x0, x1) + RAIL_T / 2, Math.max(s.a.y, s.b.y) + RIDE + RAIL_H, Math.max(z0, z1) + RAIL_T / 2));
      box.driveKind = "rail"; box.logic23 = true;
      box.rail = { x0, z0, x1, z1, y0: s.a.y + RIDE, y1: s.b.y + RIDE, t: RAIL_T / 2, h: RAIL_H };
      rails.push({ box, x0, z0, x1, z1, y0: s.a.y + RIDE, y1: s.b.y + RIDE });
      solids.push(box);
    }
  }
  // logic24 (Ben t188u "i got stuck right here"): the shaft foot (Timber Shaft → Timber Lawn, z 12.1–13.9) had no
  // kerbs — the shaft/lawn "branch" gore stripped them — so the car rolled off sideways onto the cavity floor beside the
  // lane and into the dead-end pocket under the outer ramp. Kerbs run continuously through the foot now, and the pocket
  // mouths under the cavity header (z ≈ 13.35) are boarded shut (visual in timberGutter.js).
  for (const s of segs) {
    const zs = Math.min(s.a.z, s.b.z), ze = Math.max(s.a.z, s.b.z);
    const foot = (s.pathId === "timber_shaft" && Math.max(s.a.y, s.b.y) < 0.2 && ze > 12.0 && zs < 13.3 && Math.abs(s.a.x - TIMBER.x) < 0.05)
      || (s.pathId === "timber_lawn" && zs >= 13.15 && ze <= 13.9 && Math.abs(s.a.x - TIMBER.x) < 0.05);
    if (!foot) continue;
    for (const side of [-1, 1]) {
      const [x0, z0, x1, z1] = edgeOf(s, side);
      const box = new THREE.Box3(new THREE.Vector3(Math.min(x0, x1) - RAIL_T / 2, Math.min(s.a.y, s.b.y) + RIDE - 0.01, Math.min(z0, z1) - RAIL_T / 2),
        new THREE.Vector3(Math.max(x0, x1) + RAIL_T / 2, Math.max(s.a.y, s.b.y) + RIDE + RAIL_H, Math.max(z0, z1) + RAIL_T / 2));
      box.driveKind = "rail"; box.logic24 = true;
      box.rail = { x0, z0, x1, z1, y0: s.a.y + RIDE, y1: s.b.y + RIDE, t: RAIL_T / 2, h: RAIL_H };
      rails.push({ box, x0, z0, x1, z1, y0: s.a.y + RIDE, y1: s.b.y + RIDE }); solids.push(box);
    }
  }
  // logic24: edge seal for the attic / roof-run / shaft / gutter-entry network — any lane edge whose outside is open air
  // (no deck within 12 cm of height just past it) and that has no kerb yet gets one. Two parallel decks that each skipped
  // their rail because the other "covered" it (Timber Attic + Sky Roof Run) left the attic's north lip bare → 5 m drop.
  {
    const net = segments.filter((q) => /^(timber_|gutter_entry$|sky_roofrun$)/.test(q.pathId) && Math.min(q.a.y, q.b.y) > 0.6
      && (q.pathId !== "sky_roofrun" || (Math.max(q.a.x, q.b.x) > 8 && Math.min(q.a.z, q.b.z) < -12)));
    const allS = segments.filter((q) => LOFT_IDS.has(q.pathId) || /^timber_|^gutter|^sky_/.test(q.pathId));
    const railNear = (x, y, z) => rails.some((r) => {
      const ax = r.x1 - r.x0, az = r.z1 - r.z0, l2 = ax * ax + az * az; const u = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((x - r.x0) * ax + (z - r.z0) * az) / l2));
      return Math.hypot(x - (r.x0 + ax * u), z - (r.z0 + az * u)) < 0.09 && Math.abs(r.y0 + (r.y1 - r.y0) * u - y) < 0.2; });
    const deckAt = (x, y, z) => allS.some((q) => { const sy = laneHit(q, x, z, 0); return sy != null && Math.abs(sy - y) < 0.12; });
    const otherDeck = (q, x, y, z) => allS.some((o) => { if (o.pathId === q.pathId) return false; const sy = laneHit(o, x, z, -0.02); return sy != null && Math.abs(sy - y) < 0.12; });
    const N = 4;
    for (const q of net) for (const side of [-1, 1]) {
      const [ex0, ez0, ex1, ez1] = edgeOf(q, side); const nx = q.dir.z * side, nz = -q.dir.x * side;
      for (let k = 0; k < N; k++) {
        const t0 = k / N, t1 = (k + 1) / N, P = (t) => [ex0 + (ex1 - ex0) * t, q.a.y + (q.b.y - q.a.y) * t, ez0 + (ez1 - ez0) * t];
        const pts = [P(t0), P((t0 + t1) / 2), P(t1)];
        if (pts.some(([x, y, z]) => deckAt(x + nx * 0.05, y, z + nz * 0.05))) continue;      // something drivable just outside
        if (pts.some(([x, y, z]) => otherDeck(q, x, y, z))) continue;                          // edge lies on another lane — never rail across it
        if (railNear(pts[1][0], pts[1][1] + RIDE, pts[1][2])) continue;
        const [x0, y0, z0] = pts[0], [x1, y1, z1] = pts[2];
        const box = new THREE.Box3(new THREE.Vector3(Math.min(x0, x1) - RAIL_T / 2, Math.min(y0, y1) + RIDE - 0.01, Math.min(z0, z1) - RAIL_T / 2),
          new THREE.Vector3(Math.max(x0, x1) + RAIL_T / 2, Math.max(y0, y1) + RIDE + RAIL_H, Math.max(z0, z1) + RAIL_T / 2));
        box.driveKind = "rail"; box.logic24 = true; box.seal = true;
        box.rail = { x0, z0, x1, z1, y0: y0 + RIDE, y1: y1 + RIDE, t: RAIL_T / 2, h: RAIL_H };
        rails.push({ box, x0, z0, x1, z1, y0: y0 + RIDE, y1: y1 + RIDE }); solids.push(box);
      }
    }
  }
  for (const [xa, xb] of TIMBER_FOOT_BOARDS) { const box = new THREE.Box3(new THREE.Vector3(xa, -0.05, 13.30), new THREE.Vector3(xb, 0.6, 13.40)); box.driveKind = "wall"; box.timber = true; box.logic24 = true; solids.push(box); }
  // The façade hollow is only closed between the foyer S wall and the façade for x∈[-9.17, 9];
  // west of the foyer the mouse run would be out on the lawn. Drive-only lining wall + roof
  // keep it a real tunnel inside the wall until it pops out at the façade's west end.
  const lining = [
    { min: [-15.0, 0.0, 13.17], max: [-9.17, 3.95, 13.21] },  // north lining (hard)
    { min: [-15.0, 3.95, 13.17], max: [-5.75, 4.05, 13.97] }, // roof (above the run)
  ];
  const linings = [];
  for (const l of lining) {
    const box = new THREE.Box3(new THREE.Vector3(...l.min), new THREE.Vector3(...l.max));
    box.driveKind = "wall";
    solids.push(box); linings.push(box);
  }
  { // logic13 fountain pedestal (hard) — only reachable by tumbling into the basin
    const F = FOUNTAIN, box = new THREE.Box3(new THREE.Vector3(F.x - 0.26, 0, F.z - 0.26), new THREE.Vector3(F.x + 0.26, 1.3, F.z + 0.26));
    box.driveKind = "wall"; solids.push(box);
  }
  { // logic14 paddle conveyor guards: boarding stop on the pad + cage round the ascending run
    const K = CONVEYOR, B = (a, b, kind = "wall") => { const box = new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b)); box.driveKind = kind; box.conveyor = true; solids.push(box); };
    B([2.51, K.padY, 3.92], [2.53, 7.95, 4.75]);                  // stop: car waits over the flap path (centre x 2.62)
    B([1.74, 7.95, 3.9], [1.79, K.deckY - 0.01, 4.78]);          // west: opens only once the flap is within a kerb step of the exit deck
    B([2.745, 7.84, 3.9], [2.79, K.yT + 0.1, 4.78]);             // east (from just above a pad-level car: no slipping back off)
    B([1.74, 7.84, 4.73], [2.79, K.yT + 0.1, 4.78]);             // south
    B([1.74, 7.6, 3.9], [2.79, K.yT + 0.1, 3.96]);               // belt side
  }
  const features = [];
  for (const d of LOFT_DEAD_ENDS) {
    const ps = segs.filter((s) => s.pathId === d.pathId);
    if (!ps.length) continue;
    const s = ps[ps.length - 1];
    const e = { x: s.b.x, y: s.b.y + RIDE, z: s.b.z, dx: s.dir.x, dz: s.dir.z, w: s.width, style: d.style, id: d.id };
    features.push(e);
    if (d.style === "barricade") {
      const cx = e.x - e.dx * 0.12, cz = e.z - e.dz * 0.12;
      const hx = Math.abs(e.dx) > 0.5 ? 0.06 : e.w / 2 + 0.05, hz = Math.abs(e.dx) > 0.5 ? e.w / 2 + 0.05 : 0.06;
      const box = new THREE.Box3(new THREE.Vector3(cx - hx, e.y - 0.02, cz - hz), new THREE.Vector3(cx + hx, e.y + 0.22, cz + hz));
      box.driveKind = "barricade";
      solids.push(box);
      e.box = box;
    }
  }
  // logic18: timber cavity liner walls (drive solids) — studs are visual; these keep the car in the shaft
  {
    const T = TIMBER, U = GUTTER;
    // helper: punch rectangular gaps out of a full-height z-span wall at fixed x
    const punchX = (x, gaps) => {
      const zLo = T.zN - 0.3, zHi = T.zS + 0.3, yLo = -0.05, yHi = T.yT + 0.3;
      // start with one slab, then split around each gap
      let slabs = [{ y0: yLo, y1: yHi, z0: zLo, z1: zHi }];
      for (const g of gaps) {
        const next = [];
        for (const S of slabs) {
          const gz0 = Math.max(S.z0, g.z0), gz1 = Math.min(S.z1, g.z1);
          const gy0 = Math.max(S.y0, g.y0), gy1 = Math.min(S.y1, g.y1);
          if (gz1 <= gz0 || gy1 <= gy0) { next.push(S); continue; }
          // north of gap
          if (gz0 > S.z0) next.push({ y0: S.y0, y1: S.y1, z0: S.z0, z1: gz0 });
          // south of gap
          if (gz1 < S.z1) next.push({ y0: S.y0, y1: S.y1, z0: gz1, z1: S.z1 });
          // below gap (within gap z)
          if (gy0 > S.y0) next.push({ y0: S.y0, y1: gy0, z0: gz0, z1: gz1 });
          // above gap (within gap z)
          if (gy1 < S.y1) next.push({ y0: gy1, y1: S.y1, z0: gz0, z1: gz1 });
        }
        slabs = next;
      }
      for (const S of slabs) {
        if (S.z1 - S.z0 < 0.02 || S.y1 - S.y0 < 0.02) continue;
        const box = new THREE.Box3(new THREE.Vector3(x - 0.04, S.y0, S.z0), new THREE.Vector3(x + 0.04, S.y1, S.z1));
        box.driveKind = "wall"; box.timber = true; solids.push(box);
      }
    };
    // inner liner: gaps at each westbound off-ramp + carriage spur
    punchX(T.xInner + 0.02, [
      { z0: -15.55, z1: -13.55, y0: 2.90, y1: 4.05 },   // timber_g (logic19: 1.2-wide mouth off Run A)
      { z0: -6.6, z1: -4.4, y0: 6.7, y1: 7.95 },         // timber_f (wide)
      { z0: T.zN - 0.55, z1: T.zN + 0.75, y0: 8.05, y1: 9.05 }, // timber_attic (logic19: 1.1 wide, 0.1 m south)
    ]);
    // outer liner: gap at the north attic for the gutter entry
    punchX(T.xOuter - 0.02, [
      { z0: T.zN - 0.7, z1: U.z0 + 1.0, y0: U.y0 - 0.2, y1: U.y0 + 0.7 },
    ]);
    // south end cap — open at floor for timber_lawn exit
    {
      const z = T.zS + 0.15;
      const box = new THREE.Box3(new THREE.Vector3(T.xInner, 0.55, z - 0.04), new THREE.Vector3(T.xOuter, T.y1 + 0.5, z + 0.04));
      box.driveKind = "wall"; box.timber = true; solids.push(box);
    }
    // logic19: kerb across the slot between Roof Run's east edge and Run C's west edge, just north of the
    // timber_f deck (liner is open there for the off-ramp) — nothing to fall into from the first-floor fork.
    {
      const tf = LOFT_PATHS.find((p) => p.id === "timber_f"), zE = tf.points[0].z - tf.width / 2, yF = tf.points[0].y;
      const box = new THREE.Box3(new THREE.Vector3(T.xInner - 0.04, yF - 0.1, zE - 0.06), new THREE.Vector3(T.x - T.width / 2 + 0.02, yF + 0.2, zE - 0.01));
      box.driveKind = "rail"; box.timber = true;
      box.rail = { x0: box.min.x, z0: zE - 0.035, x1: box.max.x, z1: zE - 0.035, y0: yF + 0.04, y1: yF + 0.04, t: 0.03, h: 0.12 };
      rails.push({ box, x0: box.min.x, z0: zE - 0.035, x1: box.max.x, z1: zE - 0.035, y0: yF + 0.04, y1: yF + 0.04 });
      solids.push(box);
    }
    // logic19: soft kerb just inside the outer liner at both hairpins — a wide line round the bulb glances
    // along it (rail redirect) instead of catching the hard liner
    for (const [z0, z1, yU] of [[T.zN - 0.35, T.zN + 2.2, T.y1], [-1.6, 0.2, T.y2]]) {
      const x = T.xOuter - 0.075;
      const box = new THREE.Box3(new THREE.Vector3(x - 0.02, yU - 0.05, z0), new THREE.Vector3(x + 0.02, yU + 0.2, z1));
      box.driveKind = "rail"; box.timber = true;
      box.rail = { x0: x, z0, x1: x, z1, y0: yU + 0.04, y1: yU + 0.04, t: 0.03, h: 0.12 };
      rails.push({ box, x0: x, z0, x1: x, z1, y0: yU + 0.04, y1: yU + 0.04 });
      solids.push(box);
    }
    // logic19: soft lane divider between the twin runs for ~3 m out of each hairpin (Run A/B leave the north bulb,
    // B/C the south one) — the decks overlap there at nearly the same height and a wide exit slid onto the wrong run
    {
      const sp = LOFT_PATHS.find((p) => p.id === "timber_shaft").points;
      // the divider sits on the shared edge between the two runs (T.x moved so the decks no longer overlap)
      for (const [za, zb, xD] of [[T.zN + 1.0, T.zN + 4.1, T.x + T.width / 2 + 0.005], [-4.1, -1.0, T.x + T.width / 2 + 0.005]]) {
        const ys = sp.filter((q) => q.z >= za - 0.2 && q.z <= zb + 0.2 && Math.abs(q.x - xD) < 0.7).map((q) => q.y);
        const y0 = Math.min(...ys) - 0.05, y1 = Math.max(...ys) + 0.2;
        const box = new THREE.Box3(new THREE.Vector3(xD - 0.02, y0, za), new THREE.Vector3(xD + 0.02, y1, zb));
        box.driveKind = "rail"; box.timber = true;
        box.rail = { x0: xD, z0: za, x1: xD, z1: zb, y0: y0 + 0.05, y1: y0 + 0.05, t: 0.03, h: y1 - y0 };
        rails.push({ box, x0: xD, z0: za, x1: xD, z1: zb, y0: y0 + 0.05, y1: y0 + 0.05 });
        solids.push(box);
      }
    }
    // logic19: kerb across the pocket between the attic deck's south edge, the Roof Run arc and the inner liner
    {
      const ta = LOFT_PATHS.find((p) => p.id === "timber_attic"), zE = ta.points[ta.points.length - 1].z + ta.width / 2;
      const box = new THREE.Box3(new THREE.Vector3(24.2, T.yT - 0.1, zE + 0.01), new THREE.Vector3(T.xInner, T.yT + 0.2, zE + 0.05));
      box.driveKind = "rail"; box.timber = true;
      box.rail = { x0: 24.2, z0: zE + 0.03, x1: T.xInner, z1: zE + 0.03, y0: T.yT + 0.04, y1: T.yT + 0.04, t: 0.03, h: 0.12 };
      rails.push({ box, x0: 24.2, z0: zE + 0.03, x1: T.xInner, z1: zE + 0.03, y0: T.yT + 0.04, y1: T.yT + 0.04 });
      solids.push(box);
    }
    // north tip bumper (inner/centre only) — stops Cap overshoot; outer half stays open for gutter lip
    {
      const z = T.zN - 0.32; // logic19: was zN-0.1 — car posed on the Cap (z = zN) scraped it heading west
      const box = new THREE.Box3(new THREE.Vector3(T.xInner - 0.02, T.yT - 0.55, z - 0.04), new THREE.Vector3(T.x + 0.42, T.yT + 0.45, z + 0.04));
      box.driveKind = "wall"; box.timber = true; solids.push(box);
    }
  }
  // logic18: gutter soft trough rails — lip (flat y) + plunge (sloped). Tall enough to catch a wiggle, not a lock-rail.
  {
    const U = GUTTER, T = TIMBER;
    const lipZ = U.z0 + 2.2;
    const h = U.wallH + 0.12; // physics taller than visual so a hop still glances
    const segs = [
      { z0: T.zN - 0.35, z1: lipZ, y0: U.y0, y1: U.y0 },
      { z0: lipZ, z1: U.z1 + 0.15, y0: U.y0, y1: U.y1 },
    ];
    const zArc = T.zN + (U.x - T.x - 0.5); // logic19: entry arc lands here — west lip rail starts after it
    for (const S0 of segs) {
      for (const side of [-1, 1]) {
        const S = side < 0 && S0.z0 < zArc ? { ...S0, z0: zArc - 0.05 } : S0;
        const x = U.x + side * (U.width / 2 + 0.01);
        const yLo = Math.min(S.y0, S.y1) - 0.05, yHi = Math.max(S.y0, S.y1) + h + 0.08;
        const box = new THREE.Box3(
          new THREE.Vector3(x - 0.035, yLo, Math.min(S.z0, S.z1)),
          new THREE.Vector3(x + 0.035, yHi, Math.max(S.z0, S.z1)));
        box.driveKind = "rail";
        box.rail = { x0: x, z0: S.z0, x1: x, z1: S.z1, y0: S.y0, y1: S.y1, t: 0.032, h };
        box.gutter = true;
        rails.push({ box, x0: x, z0: S.z0, x1: x, z1: S.z1, y0: S.y0, y1: S.y1 });
        solids.push(box);
      }
    }
  }
  // logic19: lab garage casework — everything under an elevated lab lane is solid (no driving
  // under benches/shelves/the gantry, no wedge pockets). Wall-hugging lanes fill back to the wall.
  for (const box of labUnderfill(segments)) solids.push(box);
  return { rails, solids, features, linings };
}

/** logic19: per-segment AABB under every elevated lab lane inside the garage (top = deck − 0.13). */
export function labUnderfill(segments) {
  const out = [], L = LAB, ix0 = L.x0 + L.t, ix1 = L.x1 - L.t, iz0 = L.z0 + L.t, iz1 = L.z1 - L.t;
  for (const s of segments) {
    if (s.pathId !== "lab_circuit" && s.pathId !== "lab_window") continue;
    const yMin = Math.min(s.a.y, s.b.y);
    if (yMin < 0.25) continue;
    const mx = (s.a.x + s.b.x) / 2, mz = (s.a.z + s.b.z) / 2;
    if (!inLab(mx, mz)) continue;
    const hw = s.width / 2 + 0.02, nx = Math.abs(s.dir.z) * hw, nz = Math.abs(s.dir.x) * hw;
    let x0 = Math.min(s.a.x, s.b.x) - nx, x1 = Math.max(s.a.x, s.b.x) + nx, z0 = Math.min(s.a.z, s.b.z) - nz, z1 = Math.max(s.a.z, s.b.z) + nz;
    if (mx - ix0 < 1.0) x0 = ix0; if (ix1 - mx < 1.0) x1 = ix1; if (mz - iz0 < 1.0) z0 = iz0; if (iz1 - mz < 1.0) z1 = iz1;
    x0 = Math.max(x0, ix0); x1 = Math.min(x1, ix1); z0 = Math.max(z0, iz0); z1 = Math.min(z1, iz1);
    if (x1 <= x0 || z1 <= z0) continue;
    const box = new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, yMin - 0.13, z1));
    box.driveKind = "wall"; box.lab = true;
    out.push(box);
  }
  return out;
}

// logic24: lane footprint helpers for hanger rods
function laneHit(s, x, z, pad) {
  const abx = s.b.x - s.a.x, abz = s.b.z - s.a.z, L2 = abx * abx + abz * abz; if (L2 < 1e-8) return null;
  const u = ((x - s.a.x) * abx + (z - s.a.z) * abz) / L2; if (u < -0.02 || u > 1.02) return null;
  const uc = Math.max(0, Math.min(1, u)), px = s.a.x + abx * uc, pz = s.a.z + abz * uc;
  if (Math.hypot(x - px, z - pz) > s.width / 2 + pad) return null;
  return s.a.y + (s.b.y - s.a.y) * uc;
}
function rodInLane(all, self, x, y, z) {
  for (const s of all) { if (s === self) continue; const sy = laneHit(s, x, z, 0.02); if (sy != null && Math.abs(sy - y) < 0.35) return true; }
  return false;
}
function rodClip(all, self, x, z, lo, hi, up) {
  let v = up ? hi : lo;
  for (const s of all) { if (s === self) continue; const sy = laneHit(s, x, z, 0.06); if (sy == null) continue;
    if (up && sy > lo + 0.05 && sy - 0.08 < v) v = sy - 0.08;
    if (!up && sy < hi - 0.05 && sy + 0.01 > v) v = sy + 0.01; }
  return v;
}
// logic24: boards closing the cavity floor pockets beside the shaft-foot lane (x ranges, z 13.30–13.40, y 0–0.6)
export const TIMBER_FOOT_BOARDS = [[24.40, 24.535], [25.315, 26.4]]; // logic24: outer board runs into the shell (a 0.2 m slot at x 26.0–26.2 pinned cars)
function pushBox(arr, cx, cy, cz, sx, sy, sz, yaw = 0) {
  arr.push({ cx, cy, cz, sx, sy, sz, yaw });
}

function instanced(list, mat, name) {
  if (!list.length) return null;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  list.forEach((b, i) => {
    e.set(b.pitch || 0, b.yaw, 0, "YXZ"); q.setFromEuler(e);
    m.compose(new THREE.Vector3(b.cx, b.cy, b.cz), q, new THREE.Vector3(b.sx, b.sy, b.sz));
    im.setMatrixAt(i, m);
  });
  im.name = name;
  im.frustumCulled = false;
  return im;
}

function mesh(pos, idx, mat, name, uv = null) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  if (uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat);
  m.name = name;
  return m;
}

/** All Skyline / mouse run meshes, merged. */
export function buildLoftMeshes(tracks, jobs) {
  const root = new THREE.Group();
  root.name = "loft_net";
  const themed = {}, side = { p: [], i: [] }, neon = { p: [], i: [] }, neonP = { p: [], i: [] }, neonT = { p: [], i: [] };
  const quad = (o, a, b, c, d) => { const n = o.p.length / 3; o.p.push(...a, ...b, ...c, ...d); o.i.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  // logic10: overlapping branch/junction decks never coplanar — greedy "colouring" of lift bins
  jobs.forEach((job, ji) => {
    const used = new Set();
    for (let i = 0; i < ji; i++) {
      const o = jobs[i];
      const hit = job.pts.some((p) => o.pts.some((q) => Math.abs(p.y - q.y) < 0.08 && Math.abs(p.x - q.x) < 1.3 && Math.abs(p.z - q.z) < 1.3));
      if (hit) used.add(o._bin);
    }
    let b = 0; while (used.has(b)) b++;
    job._bin = b; job._lift = 0.0012 * b;
  }); // logic10: overlapping branch decks never coplanar
  for (const job of jobs) {
    const pts = job.pts, hw = job.width / 2;
    const thick = job.kind === "floor" ? 0.055 : 0.12;
    const L = [], Rr = [], Lo = [], Ro = [];
    for (let i = 0; i < pts.length; i++) {
      const nP = pts.length, closed = Math.hypot(pts[0].x - pts[nP - 1].x, pts[0].z - pts[nP - 1].z) < 1e-3;
      const p0 = closed && i === 0 ? pts[nP - 2] : pts[Math.max(0, i - 1)], p1 = closed && i === nP - 1 ? pts[1] : pts[Math.min(nP - 1, i + 1)];
      let tx = p1.x - p0.x, tz = p1.z - p0.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const y = pts[i].y + RIDE + job._lift;
      const yA = job.path && job.path.yAt; // logic15: height field → each deck edge sits on it
      const yE = (x, z) => (yA ? yA(x, z) + RIDE + job._lift : y);
      L.push([pts[i].x - tz * hw, yE(pts[i].x - tz * hw, pts[i].z + tx * hw), pts[i].z + tx * hw]);
      Rr.push([pts[i].x + tz * hw, yE(pts[i].x + tz * hw, pts[i].z - tx * hw), pts[i].z - tx * hw]);
      if (job.path && job.path.solid != null) L[i].t = Rr[i].t = Math.max(thick, y - job.path.solid); // logic13: solid to the ground (fountain basin wall)
      const ho = hw + 0.006; // neon sits just proud of the deck side (no z-fight)
      Lo.push([pts[i].x - tz * ho, yE(pts[i].x - tz * ho, pts[i].z + tx * ho), pts[i].z + tx * ho]);
      Ro.push([pts[i].x + tz * ho, yE(pts[i].x + tz * ho, pts[i].z - tx * ho), pts[i].z - tx * ho]);
    }
    let dist = 0;
    const th = deckTheme(job.path); // logic14: per-area deck material
    const top = themed[th] || (themed[th] = { p: [], i: [], uv: [] });
    for (let i = 0; i < pts.length; i++) {
      if (i) dist += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      const n = top.p.length / 3;
      top.p.push(...L[i], ...Rr[i]); top.uv.push(0, dist * 0.95, 1, dist * 0.95);
      if (i) { const a = n - 2, b = n - 1, c = n, d = n + 1; top.i.push(a, c, b, b, c, d); } // logic10: wound UP (was facing down → asphalt culled, the grey deck underside showed through)
    }
    const neonOut = job.path && job.path.id === "tree_road" ? neonT : job.kind === "mouse" || job.kind === "loftramp" ? neonP : neon;
    for (let i = 1; i < pts.length; i++) {
      for (const [E, O] of [[L, Lo], [Rr, Ro]]) {
        const a = E[i - 1], b = E[i];
        const dn = (v) => [v[0], v[1] - (v.t ?? thick), v[2]];
        quad(side, a, b, dn(b), dn(a));
        quad(side, b, a, dn(a), dn(b));
        {
          const a = O[i - 1], b = O[i];
          const lo = (v, h) => [v[0], v[1] - h, v[2]];
          quad(neonOut, lo(a, 0.017), lo(b, 0.017), lo(b, 0.0225), lo(a, 0.0225)); // logic17: a 5.5 mm embedded light strip (was 14 mm)
          quad(neonOut, lo(b, 0.017), lo(a, 0.017), lo(a, 0.0225), lo(b, 0.0225));
        }
      }
      if (job.kind !== "floor") {
        const dn = (v) => [v[0], v[1] - (v.t ?? thick), v[2]];
        quad(side, dn(L[i - 1]), dn(L[i]), dn(Rr[i]), dn(Rr[i - 1]));
        quad(side, dn(Rr[i - 1]), dn(Rr[i]), dn(L[i]), dn(L[i - 1]));
      }
    }
  }
  const mats = tracks._sharedMats;
  // logic11: the Skyline is the driver's SECRET neon layer — keeps its own dark asphalt (not the
  // house's oak runner) and all its neon; only the visible mansion roads became runners.
  // logic14: …now only the one parody stretch keeps it; every other area has its own material.
  const FALLBACK = { purple: 0x3b1f63, teal: 0x11605f, orange: 0xa4501d, plum: 0x5f2a4c, stone: 0xa8a297, wood: 0x7fa9c9, brass: 0x9c7a2e, sapphire: 0x1d4fa8, emerald: 0x13704a, crimson: 0x8e1d2c, slate: 0x3d5878, graphite: 0x2a2d33, moss: 0x4d7a2a, descent: 0xc2561c, card: 0xb4895a, parody: 0x2b2d33 };
  for (const [th, o] of Object.entries(themed)) {
    if (!o.i.length) continue;
    let mat;
    if (th === "runner") mat = mats.asphalt;
    else if (th === "parody") mat = new THREE.MeshLambertMaterial(tracks._skyTex ? { color: 0xffffff, map: tracks._skyTex } : { color: FALLBACK.parody });
    else mat = tracks._themeMat ? tracks._themeMat(th) : new THREE.MeshLambertMaterial({ color: FALLBACK[th] }); // logic17: dark Standard materials (THEME_LOOK)
    root.add(mesh(o.p, o.i, mat, `loft_deck_${th}`, o.uv));
  }
  root.add(mesh(side.p, side.i, mats.side, "loft_side"));
  const blue = new THREE.MeshBasicMaterial({ color: NEON_BLUE, toneMapped: false });
  const purple = new THREE.MeshBasicMaterial({ color: NEON_PURPLE, toneMapped: false });
  root.add(mesh(neon.p, neon.i, blue, "loft_neon"));
  root.add(mesh(neonP.p, neonP.i, purple, "loft_neon_purple"));
  if (neonT.i.length) root.add(mesh(neonT.p, neonT.i, new THREE.MeshBasicMaterial({ color: NEON_BIO, transparent: true, opacity: 0.55, toneMapped: false }), "loft_neon_bio"));

  // Rails (instanced, purple neon top)
  const sol = tracks._loftSolidsCache || (tracks._loftSolidsCache = loftSolids(tracks.segments));
  const railList = sol.rails.map((r) => {
    const len = Math.hypot(r.x1 - r.x0, r.z1 - r.z0) + 0.02;
    return { cx: (r.x0 + r.x1) / 2, cy: (r.y0 + r.y1) / 2 + RAIL_H / 2 - 0.004, cz: (r.z0 + r.z1) / 2, sx: RAIL_T * 0.4, sy: RAIL_H + 0.008, sz: Math.hypot(len, r.y1 - r.y0), yaw: Math.atan2(r.x1 - r.x0, r.z1 - r.z0), pitch: -Math.atan2(r.y1 - r.y0, len) };
  });
  // logic10: rail = dark violet post-rail with a thin neon top line (edge definition, not a slab)
  const railMat = new THREE.MeshStandardMaterial({ color: 0x1b2028, roughness: 0.35, metalness: 0.4 }); // logic17: dark gunmetal post-rail (was violet 0x2c2340)
  const ri = instanced(railList, railMat, "loft_rail"); if (ri) root.add(ri);
  const caps = railList.map((r) => ({ ...r, cy: r.cy + r.sy / 2 + 0.003, sy: 0.006, sx: r.sx + 0.004 })); // logic17: cap geometry kept (a thinner cap added z-fight pairs); only its colour is cooler
  const ci = instanced(caps, blue, "loft_rail_neon"); if (ci) root.add(ci);

  // Hangers (toy-train trestle rods to the ceiling) + wall brackets
  const hang = [];
  const segs = tracks.segments.filter((s) => LOFT_IDS.has(s.pathId) && Math.min(s.a.y, s.b.y) > 0.6);
  const allLoft = tracks.segments.filter((s) => LOFT_IDS.has(s.pathId));
  let acc = 0, lastPath = null;
  for (const s of segs) {
    if (s.pathId !== lastPath) { acc = 0; lastPath = s.pathId; }
    acc += s.len;
    const yaw = Math.atan2(s.dir.x, s.dir.z);
    if (TUBE_IDS.has(s.pathId)) {
      // mouse-run tube: dark side walls + roof (visual; the rails are the physics)
      const len = s.len + 0.02, dy = s.b.y - s.a.y, pitch = -Math.atan2(dy, s.len);
      const mx = (s.a.x + s.b.x) / 2, my = (s.a.y + s.b.y) / 2 + RIDE, mz = (s.a.z + s.b.z) / 2;
      for (const sd of [-1, 1]) {
        const o = s.width / 2 + 0.05;
        if (onOtherDeck(segs, s, mx + s.dir.z * sd * o, my - RIDE, mz - s.dir.x * sd * o)) continue; // branch mouth stays open
        { // logic24 (Ben t188u "drove through what looked like a wall"): no tube side wall standing on another lane (shaft top → attic)
          const wx = mx + s.dir.z * sd * o, wz = mz - s.dir.x * sd * o, hl = Math.hypot(len, dy) / 2;
          if ([-1, 0, 1].some((t) => rodInLane(allLoft, s, wx + s.dir.x * hl * t * 0.9, my - RIDE + 0.05, wz + s.dir.z * hl * t * 0.9))) continue; }
        pushBox(hang, mx + s.dir.z * sd * o, my + 0.2, mz - s.dir.x * sd * o, 0.03, 0.42, Math.hypot(len, dy), yaw);
        hang[hang.length - 1].pitch = pitch;
      }
      pushBox(hang, mx, my + 0.43, mz, s.width + 0.16, 0.03, Math.hypot(len, dy), yaw);
      hang[hang.length - 1].pitch = pitch;
    }
    if (acc < 1.6) continue;
    acc = 0;
    if (/^lab_/.test(s.pathId) && inLab(s.b.x, s.b.z, 0.3)) continue; // logic19: casework holds the lab lanes up
    const sup = supportAt(s.b.x, s.b.y, s.b.z);
    for (const sd of [-1, 1]) {
      const nx = s.dir.z * sd, nz = -s.dir.x * sd, o = s.width / 2 + 0.035;
      const x = s.b.x + nx * o, z = s.b.z + nz * o, y0 = s.b.y - 0.1;
      if (s.pathId === "sky_chandelier" && Math.hypot(x - 2.2, z - 3.75) < 0.95) continue; // logic14: no inner rods through the upper helix turns / conveyor
      // logic24 (Ben t188u "drove through what looked like a wall"): a rod must never stand in drivable space —
      // skip it if its foot sits on another lane (branch mouths), and clip it at any deck it would pierce.
      if (rodInLane(allLoft, s, x, y0 + 0.1, z)) continue;
      if (sup.ceil != null && sup.ceil > y0 + 0.05) { const top = rodClip(allLoft, s, x, z, y0, sup.ceil, true); if (top > y0 + 0.05) pushBox(hang, x, (y0 + top) / 2, z, 0.025, top - y0, 0.025); }
      else if (sup.ceil == null && y0 - sup.below > 0.1) { const bot = rodClip(allLoft, s, x, z, sup.below, y0, false); if (y0 - bot > 0.1 && bot <= sup.below + 1e-6) pushBox(hang, x, (y0 + bot) / 2, z, 0.04, y0 - bot, 0.04); } // trestle leg
    }
    { // logic24: the under-deck cross beam may not poke into a neighbouring lane (twin shaft runs)
      const nx = s.dir.z, nz = -s.dir.x, hw = (s.width + 0.2) / 2, yb = s.b.y - 0.13;
      const clash = [-1, 1].some((sd) => rodInLane(allLoft, s, s.b.x + nx * sd * hw, yb, s.b.z + nz * sd * hw));
      pushBox(hang, s.b.x, yb, s.b.z, clash ? s.width - 0.02 : s.width + 0.2, 0.025, 0.04, yaw);
    }
  }
  for (const b of sol.linings || []) pushBox(hang, (b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2, b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x77738a, emissive: 0x1c1a26 }); // logic21: was #23202c — read as black slashes
  const hi = instanced(hang, darkMat, "loft_hanger"); if (hi) root.add(hi);

  // Neon portal frames, dead-end features, mouse-run wall glow — one instanced mesh
  const glow = [];
  // logic10: portals get a crisp neon OUTLINE (thin tubes just proud of both wall faces), not
  // a solid slab — nothing is coplanar with the wall panels or the opening reveals.
  for (const P of LOFT_PORTALS) {
    if (P.covered) continue;
    const t = 0.022, a = P.axis === "z";
    for (const face of [-1, 1]) {
      const off = face * (0.14 + 0.014 + t / 2);
      const bx = (along, y, len, vert) => {
        const w = vert ? t : len, h = vert ? len : t;
        if (a) pushBox(glow, P.x + along, y, P.z + off, w, h, t); else pushBox(glow, P.x + off, y, P.z + along, t, h, w);
      };
      const hw = P.w / 2 + t / 2 + 0.01;
      bx(-hw, (P.y0 + P.y1 + t) / 2, P.y1 - P.y0 + t, true);
      bx(hw, (P.y0 + P.y1 + t) / 2, P.y1 - P.y0 + t, true);
      bx(0, P.y1 + t / 2 + 0.01, P.w + 3 * t, false);
    }
  }
  for (const f of sol.features) {
    const yaw = Math.atan2(f.dx, f.dz);
    if (f.style === "endcap") {
      // neon end cap: a glowing arch you can see from across the foyer
      const px = -f.dz, pz = f.dx;
      for (const sd of [-1, 1]) pushBox(glow, f.x + px * sd * (f.w / 2), f.y + 0.2, f.z + pz * sd * (f.w / 2), 0.05, 0.4, 0.05, yaw);
      pushBox(glow, f.x, f.y + 0.42, f.z, f.w + 0.05, 0.05, 0.05, yaw);
      pushBox(glow, f.x, f.y - 0.02, f.z, f.w, 0.03, 0.06, yaw);
    } else if (f.box) {
      const b = f.box;
      for (const k of [0, 1, 2]) pushBox(glow, (b.min.x + b.max.x) / 2, b.min.y + 0.05 + k * 0.075, (b.min.z + b.max.z) / 2, b.max.x - b.min.x, 0.04, b.max.z - b.min.z);
    }
  }
  // logic14: the neon shaft frames / outline lines round the lifts are gone (Ben: "weird lines").
  void LIFTS;
  const gi = instanced(glow, blue, "loft_glow"); if (gi) root.add(gi);
  const dots = [];
  for (const s of tracks.segments) {
    if (s.pathId !== "mouse_run" || Math.min(s.a.z, s.b.z) < 13.3) continue;
    if (Math.round(s.a.x * 2) % 3 !== 0) continue;
    for (const zf of [s.a.x < -9.17 ? 13.215 : 13.19, 13.95]) pushBox(dots, s.a.x, s.a.y + 0.09, zf, 0.12, 0.025, 0.01);
  }
  const di = instanced(dots, purple, "mouse_glow"); if (di) root.add(di);
  // logic12: trim/neon overlays sit a hair proud of the rails/deck sides they hug (zfight-scan)
  root.traverse((o) => {
    if (o.name === "loft_rail_neon") o.position.y += 0.0011;
    if (o.name === "loft_glow") o.position.y += 0.0007;
  });
  buildExtras13(root, glow.length ? blue : blue, purple);
  tracks.yard = buildYard(root); // logic16: Descent Turret + yard oak + treehouse + critters (GPU-lite)
  tracks.timberGutter = buildTimberAndGutter(root, tracks); // logic18: timber framing + gutter trough
  tracks._conveyor = buildConveyor(root); // logic14 paddle conveyor (animated in updateVisuals)
  tracks.root.add(root);
  tracks._mouseWorld = buildMouseWorld(tracks, TUBE_IDS); // logic11: lived-in mouse world props
  return root;
}

/** logic13: kicker wedges (one merged mesh + neon lip lines) and the front-court fountain. */
function buildExtras13(root, blue, purple) {
  const P = [], I = [], C = [];
  const tri = (a, b, c, col) => { const n = P.length / 3; P.push(...a, ...b, ...c); I.push(n, n + 1, n + 2); for (let k = 0; k < 3; k++) C.push(...col); };
  const quad = (a, b, c, d, col) => { tri(a, b, c, col); tri(a, c, d, col); };
  const wood = [0.30, 0.13, 0.05], woodD = [0.15, 0.06, 0.025], stripe = [0.95, 0.78, 0.2]; // linear vertex colours
  const lips = [];
  for (const k of KICKERS) {
    const b = kickerBox(k), y0 = k.base + (k.on || 0) + 0.003, y1 = k.base + (k.on || 0) + k.rise + 0.012;
    // local frame: u along launch dir (−len/2…+len/2), v across
    const ux = b.ax ? b.s : 0, uz = b.ax ? 0 : b.s, vx = -uz, vz = ux;
    const at = (u, v, y) => [k.x + ux * u + vx * v, y, k.z + uz * u + vz * v];
    const h = k.len / 2, w = k.w / 2;
    const A = at(-h, -w, y0), B = at(-h, w, y0), Ct = at(h, w, y1), D = at(h, -w, y1), E = at(h, w, y0), F2 = at(h, -w, y0);
    quad(A, D, Ct, B, wood); quad(A, B, Ct, D, wood);               // ramp face (both windings)
    quad(D, F2, E, Ct, woodD); quad(Ct, E, F2, D, woodD);           // lip face
    tri(A, F2, D, woodD); tri(A, D, F2, woodD); tri(B, Ct, E, woodD); tri(B, E, Ct, woodD); // cheeks
    for (const v of [-w + 0.05, 0, w - 0.05]) { // chevron stripes on the face
      const p = at(h - 0.06, v, y1 - 0.06 * k.rise / k.len + 0.002); pushBox(lips, p[0], p[1], p[2], b.ax ? 0.03 : 0.08, 0.004, b.ax ? 0.08 : 0.03);
    }
    const lp = at(h + 0.004, 0, y1 - 0.004); pushBox(lips, lp[0], lp[1], lp[2], b.ax ? 0.01 : k.w, 0.012, b.ax ? k.w : 0.01);
  }
  // Fountain: inner basin wall (the rim deck is solid outside), water disc, pedestal + bowl + jet
  const Fn = FOUNTAIN, seg = 40, stone = [0.42, 0.40, 0.37], stoneD = [0.24, 0.23, 0.21], water = [0.02, 0.10, 0.28];
  const ri = Fn.r - 0.3 + 0.004, wy = 0.31;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const p = (r, a, y) => [Fn.x + Math.cos(a) * r, y, Fn.z + Math.sin(a) * r];
    quad(p(ri, a0, 0.0), p(ri, a1, 0.0), p(ri, a1, Fn.rimY + 0.012), p(ri, a0, Fn.rimY + 0.012), stoneD);
    quad(p(ri, a0, 0.0), p(ri, a0, Fn.rimY + 0.012), p(ri, a1, Fn.rimY + 0.012), p(ri, a1, 0.0), stoneD);
    tri([Fn.x, wy, Fn.z], p(ri, a1, wy), p(ri, a0, wy), water);
    // pedestal (r .22 → 1.0 high), upper bowl (r .55 at 1.0)
    quad(p(0.22, a0, 0), p(0.22, a0, 1.0), p(0.22, a1, 1.0), p(0.22, a1, 0), stone);
    quad(p(0.22, a0, 0.95), p(0.55, a0, 1.08), p(0.55, a1, 1.08), p(0.22, a1, 0.95), stone);
    quad(p(0.22, a0, 0.95), p(0.22, a1, 0.95), p(0.55, a1, 1.08), p(0.55, a0, 1.08), stoneD);
    tri([Fn.x, 1.05, Fn.z], p(0.52, a1, 1.05), p(0.52, a0, 1.05), water);
    quad(p(0.03, a0, 1.0), p(0.03, a0, 1.45), p(0.03, a1, 1.45), p(0.03, a1, 1.0), [0.45, 0.7, 0.95]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.name = "loft_jumps_fountain"; root.add(m);
  const li = instanced(lips, new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false }), "loft_kicker_lips"); if (li) root.add(li);
  void blue; void purple; void stripe;
}
