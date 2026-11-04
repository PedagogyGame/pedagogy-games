import { FOUNTAIN, CONVEYOR, conveyorFrame } from "../data/loftNet.js?v=logic34";
import { KICKERS, kickerBox, kickerY } from "../data/kickers.js?v=logic34";
import * as THREE from "three";
import { ROOMS } from "../data/rooms.js?v=logic34";
import { ASPHALT_RIDE } from "./tracks.js?v=logic34";
import { mouseWorldLayout } from "./mouseWorld.js?v=logic34";
import { LOFT_PATHS } from "../data/loftNet.js?v=logic34";
import { towerDeckAt } from "../data/tower.js?v=logic34";

/**
 * logic8 DriveWorld — the house as a drivable place, not a racetrack.
 *
 * Supporting surfaces (highest one under the wheels wins, never one far above them):
 *   - every mansion floor region (rooms, connectors, balcony deck, lawn) MINUS its real
 *     apertures (climb holes, scenic stair cuts, attic stairwell) → holes are real drops;
 *   - every road / ramp ribbon segment (its true interpolated height, ride +ASPHALT_RIDE).
 *
 * Solids at car height (all hard, no soft/pierce rules):
 *   - mansion colliders (walls, pillars, furniture, stairs) as AABBs;
 *   - ramp under-fill keels as oriented boxes;
 *   - the SIDE of any surface whose top is above a kerb-step but below the car roof + slab
 *     (ramp deck sides, floor-slab hole edges seen from below).
 *
 * No path ids, no snapping, no magnets: this module only answers "what is under / in front
 * of the car".
 */
export const STEP_UP = 0.056; // logic9: rugs (+0.05) and floor frame lips (+0.034) roll over
//         // largest lip the wheels roll over (ramp grade/substep ≈0.02)
export const STICK_DOWN = 0.06;       // larger drops than this are real falls
const SLAB_THICK = 0.22;              // floor slabs / ramp decks treated as this thick from below
const CAR_TOP = 0.12 * 0.87 * 0.88 * 0.85; // logic29 car ×0.85 · logic28 car ×0.88; // logic16 CAR_K                 // car body band above ride height (collision)
const EPS_HOLE = 0.0;

/** logic16: car disc (r, band y0..y1) vs a deck-edge rail segment (capsule of radius t, height h above the deck). */
export function railHit(R, x, z, y0, y1, r) {
  const ax = R.x1 - R.x0, az = R.z1 - R.z0, L2 = ax * ax + az * az || 1e-9;
  const u = Math.max(0, Math.min(1, ((x - R.x0) * ax + (z - R.z0) * az) / L2));
  const d = Math.hypot(x - (R.x0 + ax * u), z - (R.z0 + az * u));
  if (d >= r + R.t) return false;
  const ry = R.y0 + (R.y1 - R.y0) * u;
  return y1 >= ry - 0.01 && y0 <= ry + R.h + 0.06; // collider taller than the low visual rail (no hopping it off a flap/bump)
}
// logic28 fix: aprons start at the cage east wall inner face 2.745 (= flap phys maxX, so no gap) — the old 2.64 plate poked 10 cm into the shaft camera column and hid the car at both landings (L12), and its walk surface caught a riding car (L11).
export const LIFT_APRONS = [
  { id: "lift_apron_attic", x0: 2.745, x1: 2.84, z0: 3.96, z1: 4.73, y: 8.40 },
  { id: "lift_apron_roof", x0: 2.745, x1: 2.84, z0: 3.96, z1: 4.73, y: 11.979 },
  // logic29 (Ben 7:24 PM "get off at the different levels"): attic WEST drive-off — bridge from the cage west face to the
  // attic floor edge (shaft hole minX 1.72); x1 = flap phys minX 1.821 so flap → apron is gap-free and flush at the stop.
  { id: "lift_apron_attic_w", x0: 1.722, x1: 1.821, z0: 3.96, z1: 4.73, y: 8.40, side: "w" },
  // logic30 (Ben 9:14 PM "a roof and a higher roof area … drive off onto those levels"): roof-deck WEST drive-off onto the
  // flat roof deck (filled_top 11.979) under the Conveyor Top Road; same flush bridge from the cage west face.
  { id: "lift_apron_roof_w", x0: 1.722, x1: 1.821, z0: 3.96, z1: 4.73, y: 11.979, side: "w" },
];
// logic29: the conveyor PAUSES at each level it passes (flap top flush with the floor) so the rider can drive off.
export const LIFT_STOPS = [
  { y: 8.40, name: "Attic", east: true, west: true },
  { y: 11.979, name: "Roof deck", east: true, west: true },
];
export const LIFT_STOP_HOLD = 2.4;
export class DriveWorld {
  constructor(mansion, tracks) {
    this.mansion = mansion;
    this.tracks = tracks;
    this.floors = [];
    this.keels = (tracks && tracks.keels) || [];
    this._buildFloors();
    // logic9: rugs / perimeter frame lips are real surfaces — the car rides ON the carpet
    // (logic8 had the wheels at plank level, i.e. 5 cm UNDER the rug mesh: invisible car).
    this.rugs = ((mansion && mansion.rugRegions) || []).map((r) => ({ ...r, base: r.y - (r.kind === "rug" ? (r.roomId === "pond" ? 0.05 : 0.008) : 0.0085) })); // logic31: flush rugs (8 mm) and frame inlays (8.5 mm)
    // logic10: EVERY low flat thing on a floor (outdoor paths, zone tints, the drive apron,
    // flower beds, planters, thresholds, trims…) is a real surface at its true top. Tops within a
    // kerb step are rolled onto; taller low boxes are hard sides (no more "buried car").
    this._scanDecor();
    // logic11 free-roam: furniture tops + book staircases are real surfaces (hard sides)
    for (const t of (mansion && mansion.furnitureTops) || []) this.rugs.push({ ...t, roomId: null, kind: "furniture", block: true });
    for (const t of (mansion && mansion.bookSteps) || []) this.rugs.push({ ...t, roomId: null, kind: "books", block: t.y - t.base > STEP_UP + 0.002 });
    // logic12: mouse traps in the hollow walls are a gentle drive-over bump (1.6 cm hump)
    this.mouseTraps = [];
    if (tracks && tracks.segments) {
      const tube = new Set(LOFT_PATHS.filter((p) => p.tube).map((p) => p.id));
      this.mouseTraps = mouseWorldLayout(tracks.segments, tube).traps;
      for (const t of this.mouseTraps) this.rugs.push({ ...t, roomId: null, kind: "trap", block: false });
    }
    // logic13: kicker ramps (sloped tops; the lip launches the car — car.js)
    for (const k of KICKERS) this.rugs.push({ ...kickerBox(k), y: k.base + (k.on || 0) + k.rise, base: k.base, roomId: null, kind: "kicker", block: false, kicker: k });
    { // logic13 fountain water: a car that tumbles off the rim's inner edge lands in the basin (one kerb step below the rim)
      const F = FOUNTAIN, h = F.r - 0.31;
      this.rugs.push({ minX: F.x - h, maxX: F.x + h, minZ: F.z - h, maxZ: F.z + h, y: 0.31, base: 0, roomId: null, kind: "water", block: false });
    }
    this.conveyor = { t: 0 }; // logic14 paddle conveyor clock (DriveMode advances it per physics step)
    this._grid = new Map();
    for (const r of this.rugs) {
      for (let ix = Math.floor(r.minX / 2); ix <= Math.floor(r.maxX / 2); ix++)
        for (let iz = Math.floor(r.minZ / 2); iz <= Math.floor(r.maxZ / 2); iz++) {
          const k = ix + "," + iz; (this._grid.get(k) || this._grid.set(k, []).get(k)).push(r);
        }
    }
    this.filledTops = [];
    try { this._fillExposedTops(); } catch (e) { this.filledTops = []; }
  }

  /**
   * logic20 NO FAKE FLOORS: any visible flat slab top (ceiling tops seen from the storey above, the
   * attic's flat roof, landing-edge slivers…) that a car can roll onto from a real surface at the same
   * height — with no wall in between — becomes a real floor at its true top. Flood-filled on a 0.25 m
   * grid from reachable edges, so sealed-off cavities stay untouched. Real holes are never filled: a
   * hole has no slab mesh under it.
   */
  _fillExposedTops() {
    const root = this.mansion && this.mansion.root;
    if (!root || !root.traverse) return;
    root.updateMatrixWorld(true);
    const C = 0.25, bb = new THREE.Box3(), boxes = [], slabs = [];
    const cols = ((this.mansion.getColliders && this.mansion.getColliders()) || []).filter((c) => !c.rail && c.driveKind !== "stair"); // Drive rolls over stair colliders
    root.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
      for (let q = o; q; q = q.parent) if (q.visible === false) return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!mat || (mat.transparent && mat.opacity < 0.5)) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      const it = { min: bb.min.clone(), max: bb.max.clone(), stair: /^stairs_/.test((o.parent && o.parent.name) || "") };
      boxes.push(it);
      if (o.geometry.type !== "BoxGeometry") return;
      const m = o.matrixWorld.elements;
      if (Math.abs(m[1]) > 1e-3 || Math.abs(m[9]) > 1e-3 || (Math.abs(m[4]) > 1e-3 && Math.abs(m[4]) < 0.999)) return; // axis-aligned only
      const sx = it.max.x - it.min.x, sz = it.max.z - it.min.z, sy = it.max.y - it.min.y;
      if ((sy > 0.3 && it.max.y < 11.5 && !it.stair) || sx < 0.12 || sz < 0.12 || sx * sz < 0.25 || it.max.y < 1.0) return; // slabs (+ the attic roof rim walls)
      slabs.push(it);
    });
    const bgrid = new Map();
    for (const it of boxes) for (let ix = Math.floor(it.min.x / 2); ix <= Math.floor(it.max.x / 2); ix++) for (let iz = Math.floor(it.min.z / 2); iz <= Math.floor(it.max.z / 2); iz++) {
      const k = ix + "," + iz; (bgrid.get(k) || bgrid.set(k, []).get(k)).push(it);
    }
    const covered = (self, x, z, y) => (bgrid.get(Math.floor(x / 2) + "," + Math.floor(z / 2)) || []).some((it) => it !== self && x > it.min.x && x < it.max.x && z > it.min.z && z < it.max.z && it.min.y > y - 0.01 && it.min.y < y + 0.5 && it.max.y > y + 0.01);
    const solid = (x, z, y) => cols.some((c) => x > c.min.x && x < c.max.x && z > c.min.z && z < c.max.z && c.min.y < y + 0.06 && c.max.y > y + 0.06);
    const has = (x, z, y) => this.surfacesAt(x, z).some((s) => Math.abs(s.y - y) < 0.07);
    // a road that dips INTO / just under the slab here (roof-edge descent) keeps its headroom: no lid over it
    const T = this.tracks;
    const roadUnder = (x, z, y) => !!(T && T._segmentsNear) && T._segmentsNear(x, z, 0.8).some((sg) => {
      const ax = sg.b.x - sg.a.x, az = sg.b.z - sg.a.z, L2 = ax * ax + az * az; if (L2 < 1e-8) return false;
      const u = Math.max(0, Math.min(1, ((x - sg.a.x) * ax + (z - sg.a.z) * az) / L2));
      if (Math.hypot(x - (sg.a.x + ax * u), z - (sg.a.z + az * u)) > sg.width * 0.5 + 0.12) return false;
      const ry = sg.a.y + (sg.b.y - sg.a.y) * u; return ry < y - 0.07 && ry > y - 0.45; // keep the 0.30 m headroom (L9-no-clip-floor-slabs) + a car radius
    });
    // exposed cells per slab; `at` indexes them by grid index + top height (cm) so the flood crosses slabs
    const cells = [], at = new Map();
    for (const sl of slabs) {
      const y = sl.max.y, yk = Math.round(y * 100);
      for (let ix = Math.floor(sl.min.x / C); ix * C < sl.max.x - 0.02; ix++) for (let iz = Math.floor(sl.min.z / C); iz * C < sl.max.z - 0.02; iz++) {
        // test point = centre of the cell clipped to the slab (edge slivers count too)
        const x = (Math.max(sl.min.x, ix * C) + Math.min(sl.max.x, (ix + 1) * C)) / 2, z = (Math.max(sl.min.z, iz * C) + Math.min(sl.max.z, (iz + 1) * C)) / 2, k = ix + "," + iz + "," + yk;
        if (has(x, z, y) || covered(sl, x, z, y) || solid(x, z, y) || roadUnder(x, z, y)) continue;
        const c = { ix, iz, x, z, y, yk, sl, on: false }; cells.push(c);
        (at.get(k) || at.set(k, []).get(k)).push(c);
      }
    }
    if (!cells.length) return;
    const q = [];
    for (const c of cells) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = c.x + dx * C, nz = c.z + dz * C;
        if (has(nx, nz, c.y) && !solid(nx, nz, c.y) && !solid((c.x + nx) / 2, (c.z + nz) / 2, c.y)) { c.on = true; q.push(c); break; }
      }
    }
    const light = (c) => { for (const n of at.get(c.ix + "," + c.iz + "," + c.yk) || []) if (!n.on) { n.on = true; q.push(n); } };
    for (const c of q.slice()) light(c);
    while (q.length) {
      const c = q.pop();
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (const n of at.get((c.ix + dx) + "," + (c.iz + dz) + "," + c.yk) || []) {
          if (!n.on && !solid((c.x + n.x) / 2, (c.z + n.z) / 2, c.y)) { n.on = true; q.push(n); light(n); }
        }
      }
    }
    // merge filled cells into rectangles (row runs, then stack identical runs), clipped to their slab
    const on = cells.filter((c) => c.on);
    const byRow = new Map();
    for (const c of on) { const k = c.iz + "|" + c.yk + "|" + slabs.indexOf(c.sl); (byRow.get(k) || byRow.set(k, []).get(k)).push(c); }
    const runs = [];
    for (const row of byRow.values()) {
      row.sort((a, b) => a.ix - b.ix);
      let s = row[0], p = row[0];
      for (let i = 1; i <= row.length; i++) {
        const c = row[i];
        if (c && c.ix === p.ix + 1 && c.sl === p.sl) { p = c; continue; }
        runs.push({ ix0: s.ix, ix1: p.ix, iz: s.iz, y: s.y, sl: s.sl });
        s = p = c;
      }
    }
    runs.sort((a, b) => a.ix0 - b.ix0 || a.ix1 - b.ix1 || a.iz - b.iz);
    const rects = [];
    for (const r of runs) {
      const last = rects.length && rects[rects.length - 1];
      if (last && last.ix0 === r.ix0 && last.ix1 === r.ix1 && last.iz1 === r.iz - 1 && last.y === r.y && last.sl === r.sl) { last.iz1 = r.iz; continue; }
      rects.push({ ix0: r.ix0, ix1: r.ix1, iz0: r.iz, iz1: r.iz, y: r.y, sl: r.sl });
    }
    for (const r of rects) {
      const f = { minX: Math.max(r.sl.min.x, r.ix0 * C), maxX: Math.min(r.sl.max.x, (r.ix1 + 1) * C), minZ: Math.max(r.sl.min.z, r.iz0 * C), maxZ: Math.min(r.sl.max.z, (r.iz1 + 1) * C), y: r.y, roomId: "filled_top", holes: [] };
      // logic26: close the hairline seams between merged deck rects (a car stopped exactly on one fell to the storey below)
      f.minX -= 0.025; f.maxX += 0.025; f.minZ -= 0.025; f.maxZ += 0.025;
      this.floors.push(f); this.filledTops.push(f);
    }
  }

  _buildFloors() {
    const m = this.mansion;
    if (!m || !m.floorRegions) return;
    const roomById = {};
    for (const r of Object.values(ROOMS)) roomById[r.id] = r;
    const landing = roomById.landing;
    const storyHoles = landing && m._storyApertures ? m._storyApertures(landing, "floor") : [];
    for (const f of m.floorRegions) {
      const room = roomById[f.roomId];
      let holes = [];
      if (room && m._storyApertures) holes = holes.concat(m._storyApertures(room, "floor"));
      // Any slab on the first-floor story (connectors, balcony approach strip…) respects the
      // same climb / stair cuts as the landing — no invisible bridges over a hole.
      if (Math.abs(f.y - 4.2) < 0.05) holes = holes.concat(storyHoles);
      if (room && room.id === "attic_loft") { /* already includes ATTIC_STAIRWELL */ }
      this.floors.push({
        minX: f.minX, maxX: f.maxX, minZ: f.minZ, maxZ: f.maxZ,
        y: f.y, roomId: f.roomId, holes,
      });
    }
    // Attic-story slabs that are not the loft itself (connectors) also honour the stairwell
    const attic = roomById.attic_loft;
    if (attic && m._storyApertures) {
      const well = m._storyApertures(attic, "floor");
      for (const f of this.floors) {
        if (Math.abs(f.y - attic.pos[1]) < 0.05 && f.roomId !== "attic_loft") f.holes = f.holes.concat(well);
      }
    }
  }

  _scanDecor() {
    const root = this.mansion && this.mansion.root;
    if (!root || !root.traverse) return;
    root.updateMatrixWorld(true);
    const cols = (this.mansion.getColliders && this.mansion.getColliders()) || [];
    const bb = new THREE.Box3(), e = new THREE.Vector3();
    let n = 0;
    root.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || !o.geometry || o.geometry.type !== "BoxGeometry") return;
      for (let q = o; q; q = q.parent) if (q.visible === false) return;
      const m = o.matrixWorld.elements;
      // axis-aligned only (no tilt; yaw in 90° steps)
      if (Math.abs(m[1]) > 1e-3 || Math.abs(m[9]) > 1e-3 || (Math.abs(m[4]) > 1e-3 && Math.abs(m[4]) < 0.999)) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      bb.getSize(e);
      if (e.y > 0.6 || e.x < 0.04 || e.z < 0.04) return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      if (mat && mat.transparent && mat.opacity < 0.5) return;
      const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
      let floorY = null;
      for (const f of this.floors) {
        if (cx < f.minX || cx > f.maxX || cz < f.minZ || cz > f.maxZ || this._inHole(f, cx, cz)) continue;
        if (bb.min.y > f.y - 0.07 && bb.min.y < f.y + 0.07 && bb.max.y > f.y + 0.004 && (floorY == null || f.y > floorY)) floorY = f.y;
      }
      if (floorY == null) return;
      // already a hard collider (furniture base, stair…) → physics has it
      for (const c of cols) if (cx > c.min.x && cx < c.max.x && cz > c.min.z && cz < c.max.z && bb.max.y > c.min.y && bb.min.y < c.max.y) return;
      const top = bb.max.y;
      for (const r of this.rugs) if (r.kind !== "decor" && cx > r.minX && cx < r.maxX && cz > r.minZ && cz < r.maxZ && Math.abs(r.y - top) < 0.012) return;
      this.rugs.push({ minX: bb.min.x, maxX: bb.max.x, minZ: bb.min.z, maxZ: bb.max.z, y: top, base: floorY,
        roomId: null, kind: "decor", block: top - floorY > STEP_UP + 0.002 });
      n++;
    });
    this.decorCount = n;
  }

  _inHole(f, x, z) {
    for (const h of f.holes) {
      if (x > h.minX + EPS_HOLE && x < h.maxX - EPS_HOLE && z > h.minZ + EPS_HOLE && z < h.maxZ - EPS_HOLE) return true;
    }
    return false;
  }

  /** All surface tops at (x,z): [{y, kind:'road'|'floor', pathId?, roadKind?}] */
  surfacesAt(x, z) {
    const SEAM = globalThis.__SEAM ?? 0.03; // logic24 (Ben t188u): bent joints left hair-thin wedge holes at the lane edges (car sank at the shaft/Gutter-Entry seam)
    const out = [];
    for (const f of this.floors) {
      if (x < f.minX || x > f.maxX || z < f.minZ || z > f.maxZ) continue;
      if (this._inHole(f, x, z)) continue;
      out.push({ y: f.y, kind: "floor", roomId: f.roomId });
    }
    { // logic26 (Ben): ROOF PEAK — the roofline pyramid (apex 13.25 at (0,-8), half-side 15.556, 4.5 tall; faces 28.9%)
      // fills the roof-deck hole round it: its faces are real floor now (it was drive-through into the attic).
      const d = Math.max(Math.abs(x), Math.abs(z + 8));
      if (d < 4.56 && !(x > -0.4 && x < 0.4 && z > -10.7 && z < -9.9)) out.push({ y: Math.max(11.979, 13.25 - d * (4.5 / 15.556)), kind: "floor", roomId: "roof_peak" });
      // logic26: the deck cells are cut out under the new roof ramps; their feet left a hairline gap (car fell to the attic there)
      if ((x > -10.3 && x < -4.4 && z > -9.05 && z < -6.95) || (x > -3.05 && x < -0.7 && z > -3.6 && z < 2.3)) out.push({ y: 11.979, kind: "floor", roomId: "roof_deck" });
      if (x > 1.7 && x < 2.8 && z > 3.4 && z < 3.93) out.push({ y: 11.979, kind: "floor", roomId: "roof_deck" }); // logic26: open sliver in front of the roof hatch frame
    }
    if (x > 43 && x < 62 && z < -4 && z > -24 && !globalThis.__L33_NO_TOWER) for (const t of towerDeckAt(x, z)) out.push(t); // logic33 Sky Needle deck / gantry landing / catch net
    const cell = this._grid && this._grid.get(Math.floor(x / 2) + "," + Math.floor(z / 2));
    if (cell) {
      const nf = out.length;
      for (const r of cell) {
        if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) continue;
        // a rug / decor top only exists where its floor does (never bridges a hole)
        let base = false;
        for (let i = 0; i < nf; i++) if (Math.abs(out[i].y - r.base) < 0.03) base = true;
        if (r.kind === "trap") base = true; // logic12: trap bump sits on a mouse-run deck (a road)
        let ry = r.kicker ? kickerY(r.kicker, x, z) : r.y;
        if (r.kind === "rug" && ry - r.base < 0.07) { // logic16: rug lips are a soft bevel (no 5 cm pop)
          const ed = Math.min(x - r.minX, r.maxX - x, z - r.minZ, r.maxZ - z);
          if (ed < 0.08) ry = r.base + (ry - r.base) * (0.35 + 0.65 * ed / 0.08);
        }
        if (base) out.push({ y: ry, kind: "floor", roomId: r.roomId, rug: r.kind, block: !!r.block, kicker: r.kicker || null });
      }
    }
    { // logic14: carrying flaps of the paddle conveyor are moving floor tops
      const K = CONVEYOR, P = K.phys;
      if (x >= P.minX && x <= P.maxX && z >= P.minZ && z <= P.maxZ) {
        for (let i = 0; i < K.n; i++) { const f = this.flapAt(i); if (f.carrying) out.push({ y: f.y, kind: "floor", rug: "flap", flap: i }); }
        if (x >= 2.5 && z >= 4.05 && z <= 4.6) out.push({ y: K.padY + 0.012, kind: "floor", roomId: "conveyor_sill" }); // logic16: boarding sill — the smaller car can roll past the spiral's end into the cage
      }
    }
    // logic28: lift hop-off aprons — flush lips bridging the shaft-hole gap at the attic (west) and roof deck (east)
    for (const A of LIFT_APRONS) if (x >= A.x0 && x <= A.x1 && z >= A.z0 && z <= A.z1) out.push({ y: A.y, kind: "floor", roomId: A.id });
    const t = this.tracks;
    if (t && t.segments && t.segments.length) {
      for (const s of t._segmentsNear(x, z, 0.4)) {
        const abx = s.b.x - s.a.x, abz = s.b.z - s.a.z;
        const L2 = abx * abx + abz * abz;
        if (L2 < 1e-8) continue;
        const tr = ((x - s.a.x) * abx + (z - s.a.z) * abz) / L2;
        const L = Math.sqrt(L2);
        const sm = /^(timber_|gutter)/.test(s.pathId) ? SEAM : 0; // only the timber/gutter network (elsewhere a 3 cm overhang broke Climb A)
        if (tr < -((s.extA || 0) + sm) / L || tr > 1 + ((s.extB || 0) + sm) / L) continue; // ends / miter only (logic24: + 3 cm seam overlap)
        const u = Math.max(0, Math.min(1, tr));
        const d = Math.hypot(x - (s.a.x + abx * u), z - (s.a.z + abz * u));
        if (d > s.width * 0.5) continue;
        let yR = (s.yAt ? s.yAt(x, z) : s.a.y + (s.b.y - s.a.y) * u) + ASPHALT_RIDE;
        // logic16: a deck lying a few cm proud of the floor (spiral foot, low runners) has a
        // bevelled edge — rolling on/off it is a smooth ramp, not a 4–5 cm pop.
        const edge = s.width * 0.5 - d;
        const yRaw = yR;
        // logic25 (Ben t191u spiral glitches): the 8 cm floor bevel dipped the swung-wide car 3 cm INTO the visible chandelier-spiral
        // foot deck at speed (+ a speed snag). The spiral keeps a 6 cm lip bevel (any narrower and a car swung off the foot snags the lip coming back).
        const BEV = s.pathId === "sky_chandelier" ? 0.06 : 0.08;
        const nearJoin = edge < BEV && t._segmentsNear(x, z, 0.4).some((o) => { // logic16: a junction mouth is not an edge
          if (o.pathId === s.pathId) return false;
          const ox = o.b.x - o.a.x, oz = o.b.z - o.a.z, l2 = ox * ox + oz * oz; if (l2 < 1e-8) return false;
          const v = Math.max(0, Math.min(1, ((x - o.a.x) * ox + (z - o.a.z) * oz) / l2));
          return Math.hypot(x - (o.a.x + ox * v), z - (o.a.z + oz * v)) < o.width * 0.5 + 0.15 && Math.abs(o.a.y + (o.b.y - o.a.y) * v + ASPHALT_RIDE - yR) < 0.07;
        });
        if (edge < BEV && !nearJoin && s.kind !== "mouse" && s.pathId !== "sky_conveyor_exit") {
          let done = false;
          for (let i = 0; i < out.length && !done; i++) { // a rug just proud of the deck beside it: ramp UP to it
            const e = out[i]; if (!e.rug || e.rug === "kicker" || e.rug === "flap" || e.rug === "trap") continue;
            const h = e.y - yR; if (h > 0.003 && h < 0.07) { yR += h * 0.75 * (1 - edge / BEV); done = true; }
          }
          for (let i = 0; i < out.length && !done; i++) { if (out[i].kind !== "floor" || out[i].rug) continue; const fy = out[i].y, h = yR - fy; if (h > 0.005 && h < 0.085) { yR = fy + h * (0.3 + 0.7 * edge / BEV); done = true; } }
        }
        out.push({
          y: yR,
          kind: "road", pathId: s.pathId, roadKind: s.kind, _in: tr >= 0 && tr <= 1, _edge: Math.max(0, edge), _raw: yRaw,
        });
      }
    }
    // logic16: no edge bevel where another road carries on at deck height (junction mouths)
    for (const e of out) if (e.kind === "road" && e._raw != null && e._raw - e.y > 1e-4
      && out.some((q) => q !== e && q.kind === "road" && q.pathId !== e.pathId && Math.abs(q.y - e._raw) < 0.07)) e.y = e._raw;
    // logic16 JOINT BLEND: at a bend two consecutive segments of one road overlap (miter /
    // round joint) with heights a few cm apart — the car popped between them. Merge them into
    // one surface: in-range projections win; several in-range → their mean.
    {
      const roads = out.filter((e) => e.kind === "road");
      if (roads.length > 1) {
        const drop = new Set();
        for (const e of roads) {
          if (drop.has(e)) continue;
          const grp = roads.filter((q) => !drop.has(q) && q.pathId === e.pathId && Math.abs(q.y - e.y) < 0.07);
          if (grp.length < 2) continue;
          const ins = grp.filter((q) => q._in), use = ins.length ? ins : grp;
          const y = use.reduce((a, q) => a + q.y, 0) / use.length;
          e.y = y; for (const q of grp) if (q !== e) drop.add(q);
        }
        if (drop.size) for (let i = out.length - 1; i >= 0; i--) if (drop.has(out[i])) out.splice(i, 1);
      }
      // logic16 CROSS-ROAD BLEND: where two different roads overlap a few cm apart (fountain rim over
      // the court ramp's crest) weight each by how deep inside it the point is — no step at its edge.
      const rs = out.filter((e) => e.kind === "road");
      for (const e of rs) for (const q of rs) {
        if (q === e || q.pathId === e.pathId || e.y >= q.y || q.y - e.y > 0.05) continue;
        if (e.roadKind !== q.roadKind || /bridge|climb_b/.test(e.pathId + q.pathId)) continue; // the Foyer Bridge merge has its own flush rule (logic15)
        const we = Math.min(e._edge ?? 1, 0.15), wq = Math.min(q._edge ?? 1, 0.15);
        if (wq >= 0.15) continue; // well inside the higher road: it holds
        const y = (e.y * we + q.y * wq) / Math.max(1e-6, we + wq); q.y = Math.max(e.y, Math.min(q.y, y));
      }
    }
    // logic16: a rug/decor top a few cm above a road deck at the same spot is UNDER that deck
    // (spiral foot over the landing rug popped the car up 3.8 cm) — the deck wins.
    if (out.length > 1 && out.some((e) => e.kind === "road")) {
      return out.filter((e) => !(e.rug && e.rug !== "kicker" && e.rug !== "flap" && e.rug !== "trap"
        && out.some((q) => q.kind === "road" && q.y <= e.y + 1e-4 && q.y >= e.y - 0.06)));
    }
    return out;
  }

  /** logic14: conveyor flap i at the current clock (see conveyorFrame). */
  flapAt(i, t = this.conveyor.t) {
    const K = CONVEYOR, H = K.yT - K.yB, L = 2 * H + 2 * Math.PI * K.Rp;
    return conveyorFrame(K.v * t + (i * L) / K.n);
  }
  /** index of the carrying flap the car stands on (within 2 cm), else -1 */
  flapUnder(x, z, y) {
    const P = CONVEYOR.phys, K = CONVEYOR;
    if (x < P.minX || x > P.maxX || z < P.minZ || z > P.maxZ) return -1;
    for (let i = 0; i < K.n; i++) { const f = this.flapAt(i); if (f.carrying && f.y > y - 0.004 && f.y < y + 0.02) return i; /* actually holding the car up */ }
    return -1;
  }

  /**
   * Ground the wheels can be on at (x,z) for a car whose ride height is yRef:
   * highest surface with top ≤ yRef + step. null → nothing below (void).
   */
  groundAt(x, z, yRef, step = STEP_UP) {
    let best = null;
    for (const s of this.surfacesAt(x, z)) {
      if (s.y > yRef + step) continue;
      if (!best || s.y > best.y || (s.y === best.y && s.kind === "road")) best = s;
    }
    return best;
  }

  /** Surface top in [yRef-below, yRef+above] (camera sight-line guard). */
  surfaceTopNear(x, z, yRef, above = 0.9, below = 0.6) {
    let best = null;
    for (const s of this.surfacesAt(x, z)) {
      if (s.y > yRef + above || s.y < yRef - below) continue;
      if (best == null || s.y > best) best = s.y;
    }
    return best;
  }

  /** A surface edge that would hit the car body (deck side / slab lip above a kerb step). */
  _surfaceSideBlocks(x, z, y, onRoad = false) {
    for (const s of this.surfacesAt(x, z)) {
      // A car already on asphalt is not "hitting" the same sloped deck a few cm higher at a
      // probe point beside it (curved ramp / crest) — only real lips/decks/slabs count.
      if (onRoad && s.kind === "road" && s.y < y + 0.12) continue;
      if (onRoad && s.rug === "flap") continue; // logic16: thin moving flap corners overhang the spiral's upper turn — the (smaller) car passes beneath, not into, them
      if (s.y > y + STEP_UP && (s.y < y + CAR_TOP + SLAB_THICK || (s.block && s.y < y + 0.7))) return true;
    }
    return false;
  }

  _keelBlocks(x, z, y, r) {
    const y0 = y + 0.02, y1 = y + CAR_TOP;
    for (const k of this.keels) {
      if (y1 < k.y - k.sy / 2 || y0 > k.y + k.sy / 2) continue;
      const dx = x - k.x, dz = z - k.z;
      const c = Math.cos(k.yaw), s = Math.sin(k.yaw);
      // local: lx along box X (right), lz along box Z (yaw direction)
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if (Math.abs(lx) < k.sx / 2 + r && Math.abs(lz) < k.sz / 2 + r) return true;
    }
    return false;
  }

  _boxBlocks(boxes, x, z, y, r) {
    const y0 = y + 0.02, y1 = y + CAR_TOP;
    for (const b of boxes) {
      if (y1 < b.min.y || y0 > b.max.y) continue;
      if (!(x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z)) continue;
      if (b.rail && !railHit(b.rail, x, z, y0, y1, r)) continue; // logic16: exact rail segment
      return b;
    }
    return null;
  }

  /** Is a car of radius r with ride height y blocked at (x,z)? */
  blocked(boxes, x, z, y, r, onRoad = false) {
    if (this._boxBlocks(boxes, x, z, y, r)) return true;
    if (this._keelBlocks(x, z, y, r)) return true;
    // deck / slab sides: probe car centre and its 4 extents (thin edges)
    const rr = r * 0.7;
    if (this._surfaceSideBlocks(x, z, y, onRoad)) return true;
    if (this._surfaceSideBlocks(x + rr, z, y, onRoad) || this._surfaceSideBlocks(x - rr, z, y, onRoad)
      || this._surfaceSideBlocks(x, z + rr, y, onRoad) || this._surfaceSideBlocks(x, z - rr, y, onRoad)) return true;
    return false;
  }

  /** Nearest road centre point (prefers the same story), with its tangent yaw. */
  nearestRoad(x, y, z) {
    const t = this.tracks;
    if (!t || !t.segments) return null;
    let best = null, bd = Infinity;
    for (const s of t.segments) {
      const abx = s.b.x - s.a.x, abz = s.b.z - s.a.z;
      const L2 = abx * abx + abz * abz;
      if (L2 < 1e-8) continue;
      const u = Math.max(0, Math.min(1, ((x - s.a.x) * abx + (z - s.a.z) * abz) / L2));
      const px = s.a.x + abx * u, pz = s.a.z + abz * u, py = s.a.y + (s.b.y - s.a.y) * u;
      // Flat road preferred (respawn on a ramp mid-slope is awkward), story distance weighs heavy
      const d = Math.hypot(px - x, pz - z) + Math.abs(py - y) * 2.5 + (s.kind === "ramp" || s.kind === "loftramp" || s.kind === "mouse" ? 3 : 0) + (s.a.y > 2.5 && Math.abs(s.a.y - y) > 0.5 ? 4 : 0);
      if (d < bd) { bd = d; best = { x: px, y: py + ASPHALT_RIDE, z: pz, yaw: Math.atan2(abx, abz), pathId: s.pathId }; }
    }
    return best;
  }

  roomAt(x, y, z) {
    try { return this.mansion && this.mansion.getRoomAt ? this.mansion.getRoomAt(x, y, z) : null; } catch (_) { return null; }
  }
}
