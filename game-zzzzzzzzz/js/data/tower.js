/**
 * logic33 SKY NEEDLE — Ben 11:42–11:46 AM Nov 4 2026. A dark-2100s observation tower behind/right of the
 * Lab Garage (seen from the yard), its drivable network, and the elevator. Pure data (no THREE).
 *
 * Network (all heights are deck tops; every grade ≤ 0.28 by construction, checked in logic33-sim):
 *   tower_road   yard lawn → threads between the three legs under the core → swings out north-east (straight run)
 *                → switchback hairpin at the property edge → SKY BRIDGE straight back to Catwalk 1 (y 9)
 *   tower_c1/2/3 three catwalk rings (r 4.4) at y 9 / 16 / 23
 *   tower_m2     Catwalk 1 → wide spiral (r 7–8) → Catwalk 2           tower_m3  Catwalk 2 → spiral (r 6.3–7) → Catwalk 3
 *   tower_inner  Catwalk 1 → in through the core door → climbs round the elevator shaft → out of a duct window
 *   tower_facade the duct window → winds up the facade beside the gutters/fins (r 3.45) → Catwalk 3
 *   tower_fx2    facade road ⇄ Catwalk 2 link                           tower_pipe  through-pipe across the core at y 16
 *   tower_gantry elevator mid stop → pipe (maintenance gantry, y 16)     tower_ledge lookout teardrop off Catwalk 3 (net hop)
 *   tower_final  Catwalk 3 → curls up under the saucer and through its slot onto the observation deck (y 30)
 */
export const TOWER = {
  x: 52.0, z: -14.0,
  legR: 6.5, legAngles: [Math.PI / 2, Math.PI * 7 / 6, Math.PI * 11 / 6], legMeetY: 9.0,
  coreR0: 3.0, coreR1: 2.6, coreTop: 28.4,
  shaftR: 0.8,
  c: [9.0, 16.0, 23.0], ringR: 4.4, ringW: 1.0,
  deckY: 30.0, deckR: 7.0, saucerR: 7.6, saucerBottom: 28.65,
  slot: { a0: 0, a1: 0, r0: 5.33, r1: 6.17 }, // filled below from the final path
  spireTop: 46.0,
  lift: { stops: [0.0, 16.0, 30.0], pads: [{ dx: 0, dz: 0 }, { dx: 0, dz: 0 }, { dx: 0, dz: 0 }], cabR: 0.72, hold: 2.4 },
  cat: { a: Math.PI / 6, y: 23.0 } // pod on Catwalk 3's inner side at 30°,
};
const R3 = (v) => Math.round(v * 1000) / 1000;
const TX = TOWER.x, TZ = TOWER.z;
const P = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];

/** centripetal Catmull–Rom through control points [[x,z,y],...] (tower-relative), sampled every `step` m. */
function spline(ctrl, step = 0.25, prof = null) {
  const pts = ctrl.map((c) => ({ x: c[0], z: c[1], y: c[2] }));
  const ext = [{ x: 2 * pts[0].x - pts[1].x, z: 2 * pts[0].z - pts[1].z }, ...pts, { x: 2 * pts[pts.length - 1].x - pts[pts.length - 2].x, z: 2 * pts[pts.length - 1].z - pts[pts.length - 2].z }];
  const out = [], knotS = [0];
  for (let i = 1; i < ext.length - 2; i++) {
    const p0 = ext[i - 1], p1 = ext[i], p2 = ext[i + 1], p3 = ext[i + 2];
    const d = (a, b) => Math.max(1e-4, Math.sqrt(Math.hypot(b.x - a.x, b.z - a.z)));
    const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    const L = Math.hypot(p2.x - p1.x, p2.z - p1.z), n = Math.max(2, Math.ceil(L / step * 1.3));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      const t = t1 + (t2 - t1) * k / n, lerp = (a, b, ta, tb) => ({ x: a.x * (tb - t) / (tb - ta) + b.x * (t - ta) / (tb - ta), z: a.z * (tb - t) / (tb - ta) + b.z * (t - ta) / (tb - ta) });
      const A1 = lerp(p0, p1, t0, t1), A2 = lerp(p1, p2, t1, t2), A3 = lerp(p2, p3, t2, t3), B1 = lerp(A1, A2, t0, t2), B2 = lerp(A2, A3, t1, t3), C = lerp(B1, B2, t1, t2);
      out.push({ x: C.x, z: C.z, seg: i - 1 });
    }
  }
  let s = 0; out.forEach((q, i) => { if (i) s += Math.hypot(q.x - out[i - 1].x, q.z - out[i - 1].z); q.s = s; if (i && q.seg !== out[i - 1].seg) knotS[q.seg] = out[i - 1].s; });
  knotS[pts.length - 1] = s;
  for (let i = 1; i < pts.length - 1; i++) if (knotS[i] == null) knotS[i] = out.find((q) => q.seg === i)?.s ?? 0;
  // monotone cubic (Fritsch–Carlson) height through the knots → smooth, no overshoot
  const ys = pts.map((p) => p.y), n = ys.length, h = [], dl = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) { h[i] = Math.max(1e-4, knotS[i + 1] - knotS[i]); dl[i] = (ys[i + 1] - ys[i]) / h[i]; }
  for (let i = 1; i < n - 1; i++) m[i] = dl[i - 1] * dl[i] <= 0 ? 0 : (3 * (h[i - 1] + h[i])) / ((2 * h[i] + h[i - 1]) / dl[i - 1] + (h[i] + 2 * h[i - 1]) / dl[i]);
  m[0] = 0; m[n - 1] = 0; // flat ends → grade 0 at every junction
  const yAt = (s) => { let i = 0; while (i < n - 2 && s > knotS[i + 1]) i++; const t = Math.min(1, Math.max(0, (s - knotS[i]) / h[i])), t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1]; };
  // eased trapezoid (flat f0 → constant grade with cosine-eased ends of length e → flat f1): peak grade = Δ/(L−f0−f1−e)
  const trap = prof && ((s) => { const L = out[out.length - 1].s, a = prof.f0, b = L - prof.f1, e = Math.min(prof.e ?? 1.5, (b - a) / 2), g = (prof.y1 - prof.y0) / (b - a - e);
    const I = (u) => (u <= 0 ? 0 : u >= b - a ? (b - a - e) : u < e ? u / 2 - (e / (2 * Math.PI)) * Math.sin(Math.PI * u / e) : u > b - a - e ? (b - a - e) - ((b - a - u) / 2 - (e / (2 * Math.PI)) * Math.sin(Math.PI * (b - a - u) / e)) : u - e / 2);
    return prof.y0 + g * I(s - a); });
  return out.map((q) => ({ x: R3(TX + q.x), y: R3(trap ? trap(q.s) : yAt(q.s)), z: R3(TZ + q.z) }));
}
/** arc helper → control points at radius r from a0 to a1 (rad), heights y0→y1 linear (spline smooths) */
function arcCtrl(r0, r1, a0, a1, y0, y1, n) { const o = []; for (let i = 0; i <= n; i++) { const u = i / n, r = r0 + (r1 - r0) * u, a = a0 + (a1 - a0) * u; o.push([...P(r, a), y0 + (y1 - y0) * u]); } return o; }
function ringPts(r, y, step = 0.3) { const n = Math.ceil(2 * Math.PI * r / step), o = []; for (let i = 0; i <= n; i++) { const a = 2 * Math.PI * i / n; o.push({ x: R3(TX + Math.cos(a) * r), y, z: R3(TZ + Math.sin(a) * r) }); } return o; }
function line(x0, z0, x1, z1, y, step = 0.3) { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / step)), o = []; for (let i = 0; i <= n; i++) o.push({ x: R3(TX + x0 + (x1 - x0) * i / n), y, z: R3(TZ + z0 + (z1 - z0) * i / n) }); return o; }

const [Y1, Y2, Y3] = TOWER.c, RR = TOWER.ringR, D = Math.PI / 180;
// main road: yard → legs → out-run → switchback → sky bridge → Catwalk 1 (enters the ring at −70°)
const mainCtrl = [
  [-9.0, 12.0, 0.0], [-8.2, 8.0, 0.0], [-5.6, 3.7, 0.0], [-2.7, 1.75, 0.0], [0.0, 2.5, 0.0], [2.7, 1.75, 0.0], [5.4, 3.5, 0.0], // between the legs (south of the cab)
  [8.6, 2.2, 0.45], [10.1, -2.2, 1.3], [11.4, -8.0, 2.4], [12.6, -14.0, 3.5], [13.6, -20.0, 4.5],                                      // swing out north-east: the straight run
  [13.4, -23.2, 4.9], [11.8, -25.0, 5.15], [9.7, -24.0, 5.35],                                                                            // switchback hairpin (r ≈ 2)
  [7.7, -18.6, 6.3], [5.6, -13.0, 7.4], [3.5, -7.6, 8.4], [2.3, -5.5, 8.85], [...P(RR + 0.25, -96 * D), 8.99], [...P(RR - 0.15, -106 * D), Y1],              // sky bridge back to Catwalk 1
];
// logic33: all upward travel runs CLOCKWISE seen from above (angles decrease) so every merge is tangential
const Dn = -D;
// eased branch: radius follows a cosine ease over a long angle so every fork / merge is a gentle tangential S (≤ ~25°)
const easeCtrl = (r0, r1, a0, a1, n) => { const o = []; for (let i = 0; i <= n; i++) { const u = i / n, e = 0.5 - 0.5 * Math.cos(Math.PI * u); o.push([...P(r0 + (r1 - r0) * e, a0 + (a1 - a0) * u), 0]); } return o; };
const BR = RR - 0.2; // branch mouths sit 0.2 m inside the catwalk centre line
// Catwalk 1 → Catwalk 2: forks off at 178°, swings wide (r 7.2–8.2, varying), merges back onto Catwalk 2 at 118°
const m2Ctrl = [...easeCtrl(BR, 7.2, 178 * Dn, 262 * Dn, 4), ...arcCtrl(7.4, 8.2, 285 * Dn, 330 * Dn, 0, 0, 2), ...arcCtrl(8.0, 6.6, 352 * Dn, 405 * Dn, 0, 0, 2), ...easeCtrl(6.4, BR, 425 * Dn, 478 * Dn, 4)];
// Catwalk 2 → Catwalk 3: forks at 198°, spiral r 6.6→7.0→6.3, merges onto Catwalk 3 at 200°
const m3Ctrl = [...easeCtrl(BR, 6.6, 198 * Dn, 270 * Dn, 4), ...arcCtrl(6.7, 7.0, 290 * Dn, 375 * Dn, 0, 0, 3), ...arcCtrl(7.0, 6.4, 395 * Dn, 445 * Dn, 0, 0, 2), ...easeCtrl(6.2, BR, 465 * Dn, 520 * Dn, 4)];
// inner climb: forks INWARD off Catwalk 1 at 125° → core door → round the shaft (r 1.8) → out of the duct window at 520°
const innerCtrl = [...easeCtrl(BR, 2.0, 125 * Dn, 185 * Dn, 5), ...arcCtrl(1.8, 1.8, 205 * Dn, 450 * Dn, 0, 0, 6), ...easeCtrl(2.0, 3.45, 470 * Dn, 520 * Dn, 4)];
const IY = Y1 + 2.5, IA = 520 * Dn;
// facade road: duct window (r 3.45) → winds up the facade 2.25 turns beside the fins and downpipes → merges onto Catwalk 3 at 68°
const FAC_TURN = -2.25 * 2 * Math.PI;
const facadeCtrl = [[...P(3.45, IA), 0], ...arcCtrl(3.45, 3.45, IA + 22 * Dn, IA + FAC_TURN - 10 * Dn, 0, 0, 14), ...easeCtrl(3.45, BR, IA + FAC_TURN, IA + FAC_TURN + 34 * Dn, 3)];
// final approach: forks off Catwalk 3 at 226°, eases out to r 5.75, curls ~1.3 turns up under the saucer → through its slot → deck
const F0 = 240 * Dn, F1 = F0 - 1.35 * 2 * Math.PI;
const finalCtrl = [...easeCtrl(BR, 5.75, F0 - 14 * Dn, F0 + 45 * Dn, 4), ...arcCtrl(5.75, 5.75, F0 + 68 * Dn, F1 - 20 * Dn, 0, 0, 12), [...P(5.75, F1), 0], [...P(5.75, F1 + 12 * Dn), 0]];
const ledgeCtrl = [...easeCtrl(BR, 6.6, 40 * D, 10 * D, 4).map((c) => [c[0], c[1], Y3]), [8.2, 1.4, Y3], [9.4, 0.0, Y3], [8.2, -1.4, Y3], ...easeCtrl(6.6, BR, -10 * D, -40 * D, 4).map((c) => [c[0], c[1], Y3])]; // entered at +14° (clockwise traffic)
// the HOP GAP: the ledge deck stops 0.5 m either side of its tip; a sagging cyan catch-net (dip 8 cm, ≤ 25 % slope) spans it
const NET_SPAN = 1.0, NET_DIP = 0.08;
const ledgeAll = spline(ledgeCtrl);
const _ledgeS = (() => { let s = 0; return ledgeAll.map((q, i) => (s += i ? Math.hypot(q.x - ledgeAll[i - 1].x, q.z - ledgeAll[i - 1].z) : 0)); })();
const _mid = _ledgeS[_ledgeS.length - 1] / 2;
// logic33 STAGING (Ben 12:36 PM allows it): the lookout ledge + catch net, the through-pipe and the facade⇄C2 link move to logic34
// (their junctions failed the pursue-drive / fall-rule tests). The mid gantry now runs straight from the cab to Catwalk 2.
export const STAGED_L34 = new Set(["tower_ledge", "tower_ledge_b", "tower_pipe", "tower_fx2"]);
export const TOWER_NET = ledgeAll.map((q, i) => ({ ...q, s: _ledgeS[i] - (_mid - NET_SPAN / 2) })).filter((q) => q.s >= -0.12 && q.s <= NET_SPAN + 0.12).filter(() => !STAGED_L34.has("tower_ledge"));

const TP = [];
const add = (id, kind, points, label, extra = {}) => TP.push({ id, kind, width: 1.0, points, label, tower: true, ...extra });
add("tower_road", "loftramp", spline(mainCtrl, 0.25, { y0: 0, y1: Y1, f0: 17.5, f1: 1.2 }), "Sky Needle Road", { width: 1.05 });
add("tower_c1", "loft", ringPts(RR, Y1), "Needle Catwalk 1", { closedRing: true });
add("tower_c2", "loft", ringPts(RR, Y2), "Needle Catwalk 2", { closedRing: true });
add("tower_c3", "loft", ringPts(RR, Y3), "Needle Catwalk 3", { closedRing: true });
add("tower_m2", "loftramp", spline(m2Ctrl, 0.25, { y0: Y1, y1: Y2, f0: 4.0, f1: 4.0 }), "Needle Spiral");
add("tower_m3", "loftramp", spline(m3Ctrl, 0.25, { y0: Y2, y1: Y3, f0: 4.0, f1: 4.0 }), "Needle Upper Spiral");
add("tower_inner", "loftramp", spline(innerCtrl, 0.25, { y0: Y1, y1: IY, f0: 4.0, f1: 0.9 }), "Core Climb", { width: 0.9, keepWidth: true, tube: false });
add("tower_facade", "loftramp", spline(facadeCtrl, 0.25, { y0: IY, y1: Y3, f0: 0.8, f1: 4.0 }), "Gutter Facade Road", { width: 0.8, keepWidth: true });
add("tower_final", "loftramp", spline(finalCtrl, 0.25, { y0: Y3, y1: TOWER.deckY, f0: 4.0, f1: 1.4 }), "Saucer Approach");
add("tower_ledge", "loft", ledgeAll.filter((q, i) => _ledgeS[i] <= _mid - NET_SPAN / 2 + 0.02), "Village Lookout");
add("tower_ledge_b", "loft", ledgeAll.filter((q, i) => _ledgeS[i] >= _mid + NET_SPAN / 2 - 0.02), "Village Lookout (return)");
add("tower_pipe", "loft", line(-(Math.sqrt(RR * RR - 1.7 * 1.7) - 0.1), 1.7, Math.sqrt(RR * RR - 1.7 * 1.7) - 0.1, 1.7, Y2, 0.25), "Through-Pipe", { tube: true, width: 1.0, keepWidth: true });
add("tower_gantry", "loft", line(0, 0.05, 0, RR - 0.1, Y2, 0.2), "Mid Gantry", { width: 0.95, keepWidth: true });
// facade road ⇄ Catwalk 2: radial link where the facade road passes y 16
{ const fac = TP.find((p) => p.id === "tower_facade").points; let best = null; for (const q of fac) if (!best || Math.abs(q.y - Y2) < Math.abs(best.y - Y2)) best = q;
  const a = Math.atan2(best.z - TZ, best.x - TX); TOWER.fx2 = { a, y: best.y };
  add("tower_fx2", "loft", line(Math.cos(a) * 3.45, Math.sin(a) * 3.45, Math.cos(a) * (RR - 0.1), Math.sin(a) * (RR - 0.1), Y2, 0.15), "Facade ⇄ Catwalk 2", { width: 0.9, keepWidth: true }); }
for (let i = TP.length - 1; i >= 0; i--) if (STAGED_L34.has(TP[i].id)) TP.splice(i, 1);
export const TOWER_PATHS = TP;
// the saucer slot (radial band r0–r1) = where the final approach is below the deck top
{ const fin = TP.find((p) => p.id === "tower_final").points; let a0 = Infinity, a1 = -Infinity, prev = null;
  for (const q of fin) { if (q.y < TOWER.saucerBottom - 0.35 || q.y > TOWER.deckY - 0.004) continue; let a = Math.atan2(q.z - TZ, q.x - TX); if (prev != null) { while (a < prev - Math.PI) a += 2 * Math.PI; while (a > prev + Math.PI) a -= 2 * Math.PI; } prev = a; a0 = Math.min(a0, a); a1 = Math.max(a1, a); }
  TOWER.slot.a0 = a0 - 2 * D; TOWER.slot.a1 = a1 + 6 * D; // clockwise climb: deep (entry) end at a1, flush (exit) end at a0
}
/** observation deck + mid landing as drivable surfaces (DriveWorld): discs/annuli, deck minus the saucer slot */
export function towerDeckAt(x, z) {
  const dx = x - TX, dz = z - TZ, r = Math.hypot(dx, dz), out = [];
  if (r <= TOWER.deckR) { let inSlot = false; const S = TOWER.slot; if (r > S.r0 && r < S.r1) { let a = Math.atan2(dz, dx); while (a < S.a0) a += 2 * Math.PI; if (a <= S.a1) inSlot = true; }
    if (!inSlot) out.push({ y: TOWER.deckY, kind: "floor", roomId: "tower_deck" }); }
  if (r <= TOWER.lift.cabR + 0.12) out.push({ y: TOWER.c[1], kind: "floor", roomId: "tower_mid_landing" });
  if (Math.abs(x - TX - 9.0) < 1.2 && Math.abs(z - TZ) < 1.2) { // catch net
    let best = null, bd = 0.44; for (const q of TOWER_NET) { const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = q; } }
    if (best) { const u = Math.max(0, Math.min(1, best.s / NET_SPAN)); out.push({ y: TOWER.c[2] - NET_DIP * Math.sin(Math.PI * u), kind: "road", roadKind: "loft", pathId: "tower_net", roomId: "tower_net" }); } }
  return out; }
/** logic33 Drive colliders (plain data; DriveMode turns them into Box3s). Only the BASE and LEGS are structural
 *  (Ben: "colliders only at the base and legs"); the rest are low exact rails (deck rim, saucer slot, cab walls, net sides). */
export function towerSolids() {
  const out = [], seg = (x0, z0, x1, z1, y, kind = "rail", h = 0.035) => out.push({ kind, rail: { x0, z0, x1, z1, y0: y, y1: y, t: 0.025, h },
    min: [Math.min(x0, x1) - 0.03, y - 0.01, Math.min(z0, z1) - 0.03], max: [Math.max(x0, x1) + 0.03, y + h + 0.07, Math.max(z0, z1) + 0.03] });
  const arc = (r, a0, a1, y, step = 0.35, skip = null) => { const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) * r / step));
    for (let i = 0; i < n; i++) { const b0 = a0 + (a1 - a0) * i / n, b1 = a0 + (a1 - a0) * (i + 1) / n; if (skip && skip((b0 + b1) / 2)) continue; seg(TX + Math.cos(b0) * r, TZ + Math.sin(b0) * r, TX + Math.cos(b1) * r, TZ + Math.sin(b1) * r, y); } };
  // legs: slanted box stack from the feet (r 6.5) to the core (r 2.9 at y 9)
  for (const a of TOWER.legAngles) for (let y = 0; y < TOWER.legMeetY; y += 0.45) {
    const u = (y + 0.225) / TOWER.legMeetY, r = TOWER.legR + (2.9 - TOWER.legR) * u, h = 0.42 - 0.12 * u, x = TX + Math.cos(a) * r, z = TZ + Math.sin(a) * r;
    out.push({ kind: "pillar", min: [x - h, y, z - h], max: [x + h, y + 0.46, z + h] });
  }
  // base: plinth ring round the cab (door gap south), feet pads
  const C = TOWER.lift.cabR, gapS = (a) => Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.62, gapN = (a) => Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.62;
  { const n = 14; for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * 2 * Math.PI; if (gapS(a)) continue; const x = TX + Math.cos(a) * (C + 0.05), z = TZ + Math.sin(a) * (C + 0.05);
    out.push({ kind: "wall", min: [x - 0.12, 0, z - 0.12], max: [x + 0.12, 1.1, z + 0.12] }); } }
  arc(C + 0.05, 0, 2 * Math.PI, TOWER.c[1], 0.2, gapS); // gantry-level cab wall (door south, onto the gantry)
  arc(C + 0.05, 0, 2 * Math.PI, TOWER.deckY, 0.2, gapN); // deck-level cab wall (door north)
  arc(TOWER.deckR - 0.05, 0, 2 * Math.PI, TOWER.deckY, 0.4); // observation deck rim
  arc(TOWER.ringR + 0.42, Math.PI / 2 - 0.45, Math.PI / 2 + 0.45, TOWER.c[1], 0.25); // Catwalk 2 outer kerb across the gantry T (its gore stripped the ring rail there)
  { const g = Math.asin(0.5 / (TOWER.ringR - 0.42)); arc(TOWER.ringR - 0.42, Math.PI / 2 + g, Math.PI / 2 + 0.5, TOWER.c[1], 0.2); arc(TOWER.ringR - 0.42, Math.PI / 2 - 0.5, Math.PI / 2 - g, TOWER.c[1], 0.2); } // …and its inner kerb either side of the gantry mouth
  { const S = TOWER.slot, fin = TP.find((p) => p.id === "tower_final").points; let aOpen = S.a1, prev = null;
    for (const q of fin) { if (q.y < TOWER.saucerBottom - 0.35) continue; let a = Math.atan2(q.z - TZ, q.x - TX); while (a < S.a0) a += 2 * Math.PI; if (q.y >= TOWER.deckY - 0.1) { aOpen = Math.min(a, S.a1); break; } }
    // rails along both slot lips from where the road is still below the deck (aOpen) to the deep end a1, plus the deep end's cross rail
    arc(S.r0 - 0.03, aOpen, S.a1, TOWER.deckY, 0.3); arc(S.r1 + 0.03, aOpen, S.a1, TOWER.deckY, 0.3);
    seg(TX + Math.cos(S.a1) * S.r0, TZ + Math.sin(S.a1) * S.r0, TX + Math.cos(S.a1) * S.r1, TZ + Math.sin(S.a1) * S.r1, TOWER.deckY); TOWER.slot.aOpen = aOpen; }
  // catch-net sides
  for (let i = 1; i < TOWER_NET.length; i++) { const a = TOWER_NET[i - 1], b = TOWER_NET[i], tx = b.x - a.x, tz = b.z - a.z, L = Math.hypot(tx, tz) || 1, nx = -tz / L * 0.43, nz = tx / L * 0.43;
    seg(a.x + nx, a.z + nz, b.x + nx, b.z + nz, TOWER.c[2] - 0.1); seg(a.x - nx, a.z - nz, b.x - nx, b.z - nz, TOWER.c[2] - 0.1); }
  return out;
}
export const TOWER_LIFT_PADS = TOWER.lift.stops.map((y, i) => ({ y, x: TX + TOWER.lift.pads[i].dx, z: TZ + TOWER.lift.pads[i].dz }));
