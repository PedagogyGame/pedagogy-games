import * as THREE from "three";
import { TREEHOUSE, GRAND_DESCENT } from "../data/loftNet.js?v=logic22";

/**
 * logic16 YARD SCENERY for the Grand Descent + Treehouse Sky Road. GPU-lite: every static piece
 * is merged into ONE vertex-coloured Lambert mesh (turret, oak trunk + branches, hut, deck,
 * nest bowl); leaves are ONE InstancedMesh; critters are tiny groups animated by transforms only.
 * No lights. Nothing here is a Drive collider — branches/leaves are scenery the car passes.
 */
const CRIT_KEY = "motu.critters.v1";
const ls = () => { try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (_) { return null; } };

function merged(parts) { // parts: [geometry, color, matrix]
  const P = [], N = [], C = [], I = []; const col = new THREE.Color(), nm = new THREE.Matrix3();
  for (const [g0, c, m] of parts) {
    const g = g0.index ? g0 : g0; const pos = g.attributes.position, nor = g.attributes.normal, base = P.length / 3;
    nm.getNormalMatrix(m); col.set(c); const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m); P.push(v.x, v.y, v.z);
      v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); N.push(v.x, v.y, v.z); C.push(col.r, col.g, col.b);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) I.push(base + g.index.getX(i)); else for (let i = 0; i < pos.count; i++) I.push(base + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); return g;
}
const M = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
/** cylinder from a to b (radius r0→r1) */
function limb(a, b, r0, r1, color, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, false);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return [g, color, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1))];
}

export function buildYard(root) {
  const T = TREEHOUSE, D = GRAND_DESCENT, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const parts = [];
  // Descent Turret: the corkscrew winds round it (r 2.6 lane → tower r 1.25)
  parts.push([new THREE.CylinderGeometry(1.25, 1.35, 11.2, 14), 0x343a43, M(D.tx, 5.6, D.tz)]);
  parts.push([new THREE.ConeGeometry(1.6, 2.4, 14), 0x5a3420, M(D.tx, 12.4, D.tz)]);
  for (let k = 0; k < 5; k++) parts.push([new THREE.BoxGeometry(0.25, 0.4, 0.06), 0x1d2f4a, M(D.tx + Math.cos(k * 1.3) * 1.31, 2 + k * 1.9, D.tz + Math.sin(k * 1.3) * 1.31, 0, -k * 1.3 + Math.PI / 2, 0)]);
  // Yard oak: thick trunk at the helix centre, limbs reaching out ABOVE the lane, roots
  const bark = 0x5b3f2a, barkD = 0x46301f;
  parts.push([new THREE.CylinderGeometry(0.42, 0.62, 7.4, 10), bark, M(T.x, 3.7, T.z)]);
  for (let k = 0; k < 5; k++) parts.push(limb(V(T.x, 0.15, T.z), V(T.x + Math.cos(k * 1.26) * 1.05, -0.05, T.z + Math.sin(k * 1.26) * 1.05), 0.2, 0.08, barkD));
  const limbs = [];
  for (let k = 0; k < 7; k++) { // two tiers: each limb clears the lane below it by ≥0.6
    const a = k * 0.9 + 0.3, y = 4.6 + (k % 3) * 0.7, L = 3.6 + (k % 2) * 0.8;
    const tip = V(T.x + Math.cos(a) * L, y + 0.7, T.z + Math.sin(a) * L);
    parts.push(limb(V(T.x, y - 0.6, T.z), tip, 0.2, 0.06, barkD)); limbs.push(tip);
  }
  // treehouse: deck slab around the flat stretch + a hut the lane runs THROUGH
  const hx = D.tx + 9.4, hz0 = T.hutZ1, hz = hz0 + T.hutLen / 2, y = T.deckY;
  parts.push([new THREE.BoxGeometry(2.4, 0.1, 2.6), 0x3a2c1e, M(hx + 0.3, y - 0.07, hz)]);
  for (const sx of [-1, 1]) parts.push([new THREE.BoxGeometry(0.06, 0.45, 1.5), 0x3b2c20, M(hx + sx * 0.66, y + 0.22, hz)]); // window-height walls: the chase cam stays above them
  for (const sx of [-1, 1]) parts.push([new THREE.BoxGeometry(0.75, 0.04, 1.6), 0x1f2a1c, M(hx + sx * 0.4, y + 0.55, hz, 0, 0, sx * -0.5)]); // open-ridge roof: two leaning panels, the cam sees the lane between them
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push([new THREE.CylinderGeometry(0.07, 0.08, y, 6), bark, M(hx + 0.3 + dx * 1.05, y / 2, hz + dz * 1.15)]);
  parts.push(limb(V(hx + 1.4, y - 0.1, hz), V(T.x - 0.4, y + 0.6, T.z), 0.14, 0.18, barkD)); // the deck's carrying limb
  // nest bowl on a low limb beside the helix (nest critters sit in it)
  const N0 = V(T.nest.x + 0.78, T.nest.y + 0.3, T.nest.z); // just outside the rail, beak-height of the passing car
  parts.push(limb(V(T.x, N0.y - 0.1, T.z), N0, 0.12, 0.07, barkD));
  parts.push([new THREE.TorusGeometry(0.13, 0.05, 6, 12), 0x8b6b3e, M(N0.x, N0.y + 0.05, N0.z, Math.PI / 2, 0, 0)]);
  parts.push([new THREE.CylinderGeometry(0.12, 0.06, 0.06, 10), 0x6d5230, M(N0.x, N0.y + 0.02, N0.z)]);
  // squirrel's limb (over the hut road, beside the lane)
  const S0 = V(hx - 0.68, y + 0.16, hz + 1.55); // on a stub limb right by the hut's exit, outside the rail
  parts.push(limb(V(hx - 1.6, y - 0.3, hz + 1.55), V(hx - 0.6, y + 0.12, hz + 1.55), 0.06, 0.05, barkD));
  const stat = new THREE.Mesh(merged(parts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  stat.name = "yard_turret_oak_treehouse"; root.add(stat);
  // leaves: one InstancedMesh of low-poly blobs in the canopy, around (not on) the lane
  const leafPos = [];
  let sd = 5; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (const tip of limbs) for (let j = 0; j < 4; j++) leafPos.push([tip.x + (rnd() - 0.5) * 1.4, tip.y + (rnd() - 0.2) * 0.9, tip.z + (rnd() - 0.5) * 1.4, 0.55 + rnd() * 0.45]);
  for (let k = 0; k < 18; k++) { const a = k * 0.7, h = 0.9 + (k % 6) * 0.55; // walls of leaves outside the helix lane
    leafPos.push([T.x + Math.cos(a) * 4.1, h + 0.4, T.z + Math.sin(a) * 4.1, 0.5 + rnd() * 0.3]); }
  for (let k = 0; k < 6; k++) leafPos.push([T.x + Math.cos(k) * 0.9, 6.4 + rnd(), T.z + Math.sin(k) * 0.9, 1.0]);
  const leaf = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), leafPos.length);
  const cA = new THREE.Color(0x1e3318), cB = new THREE.Color(0x35522a); // logic17: deeper, realer foliage
  leafPos.forEach(([x, y2, z, s], i) => { leaf.setMatrixAt(i, M(x, y2, z, rnd(), rnd(), 0, s, s * 0.8, s)); leaf.setColorAt(i, cA.clone().lerp(cB, rnd())); });
  leaf.name = "yard_oak_leaves"; leaf.raycast = () => {}; root.add(leaf);
  // ── critters (transform-only animation) ──
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
  const fur = lam(0xa0552a), furL = lam(0xe7c39a), nutM = lam(0x7a4a1c), dark = lam(0x161616);
  const sq = new THREE.Group(); sq.name = "squirrel";
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), fur); body.scale.set(1, 1.25, 0.85); body.position.y = 0.09;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), furL); belly.position.set(0, 0.08, 0.05);
  const head = new THREE.Group(); head.position.set(0, 0.22, 0.03);
  const hd = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), fur); head.add(hd);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 4), fur); e.position.set(sx * 0.035, 0.06, 0); head.add(e); const ey = new THREE.Mesh(new THREE.SphereGeometry(0.01, 4, 3), dark); ey.position.set(sx * 0.03, 0.015, 0.05); head.add(ey); }
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), fur); tail.scale.set(0.7, 1.8, 0.7); tail.position.set(0, 0.2, -0.12); tail.rotation.x = -0.3;
  const paws = new THREE.Group(); paws.position.set(0, 0.17, 0.08);
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 5), nutM); nut.scale.set(1, 1.3, 1); paws.add(nut);
  sq.add(body, belly, head, tail, paws); sq.position.copy(S0); sq.position.y += 0.04; sq.rotation.y = Math.PI / 2 + 0.4; sq.scale.setScalar(1.6);
  sq.visible = false; root.add(sq);
  const nest = new THREE.Group(); nest.name = "bird_nest"; nest.position.copy(N0); nest.position.y += 0.06;
  const babies = [];
  const bodyM = lam(0x8d8a7a), beakM = lam(0xf2b632), mouthM = lam(0xd23b3b);
  for (let k = 0; k < 3; k++) {
    const b = new THREE.Group(); const a = k * 2.1; b.position.set(Math.cos(a) * 0.06, 0.02, Math.sin(a) * 0.06);
    const bb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), bodyM);
    const up = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.04, 4), beakM), lo = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.035, 4), beakM);
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.012, 4, 3), mouthM);
    const jaw = new THREE.Group(); jaw.position.set(0, 0.05, 0); jaw.add(up, lo, mouth);
    up.position.y = 0.022; lo.position.y = 0.018; lo.rotation.z = Math.PI; mouth.position.y = 0.012;
    b.add(bb, jaw); b.lookAt(0, 0.4, 0); nest.add(b); babies.push({ up, lo, jaw, phase: k * 1.3 });
  }
  const mama = new THREE.Group(); mama.position.set(0.0, 0.16, -0.2);
  const mb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), lam(0x3d5a8c)); mb.scale.set(1, 0.9, 1.4);
  const mh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), lam(0x3d5a8c)); mh.position.set(0, 0.06, 0.08);
  const mbk = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.05, 4), beakM); mbk.rotation.x = Math.PI / 2; mbk.position.set(0, 0.055, 0.14);
  const worm = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.08, 4), lam(0xd77a8c)); worm.position.set(0, 0.03, 0.16); worm.rotation.z = 0.6;
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.1), lam(0x2c4470)); w.position.set(sx * 0.07, 0.01, 0); mama.add(w); }
  mama.add(mb, mh, mbk, worm); nest.add(mama); nest.scale.setScalar(1.6);
  nest.visible = false; root.add(nest);
  const yard = { stat, leaf, squirrel: sq, nest, parts: { head, paws, tail, babies, mama, worm }, t: 0 };
  return yard;
}

/** Per-critter drive-by counters (persisted beside the Ghost Books). One count per zone ENTRY,
 *  with a cooldown so idling on the zone edge does not farm passes. */
export class TreeCritters {
  constructor(yard, opts = {}) {
    this.yard = yard; this.cool = opts.cooldown ?? 4.0; this.showFor = opts.showFor ?? 9.0;
    this.counts = { squirrel: 0, nest: 0 };
    try { const s = ls()?.getItem(CRIT_KEY); if (s) Object.assign(this.counts, JSON.parse(s)); } catch (_) {}
    this.z = {
      squirrel: { ...TREEHOUSE.squirrel, inside: false, last: -1e9, show: 0 },
      nest: { ...TREEHOUSE.nest, inside: false, last: -1e9, show: 0 },
    };
    this.force = false; this.t = 0;
  }
  _save() { try { ls()?.setItem(CRIT_KEY, JSON.stringify(this.counts)); } catch (_) {} }
  reset() { this.counts.squirrel = this.counts.nest = 0; this._save(); }
  /** car position → returns the critter id that just appeared (or null) */
  tick(dt, p) {
    this.t += dt; let appeared = null;
    for (const id of ["squirrel", "nest"]) {
      const Z = this.z[id], inZ = Math.hypot(p.x - Z.x, p.z - Z.z) < Z.r && Math.abs(p.y - Z.y) < 1.2;
      if (inZ && !Z.inside && this.t - Z.last > this.cool) {
        Z.last = this.t; this.counts[id]++; this._save();
        if (this.counts[id] % Z.every === 0) { Z.show = this.showFor; appeared = id; }
      }
      if (inZ) Z.last = Math.max(Z.last, this.t - this.cool + 0.5); // still inside: cooldown restarts on exit
      Z.inside = inZ; Z.show = Math.max(0, Z.show - dt);
    }
    this.animate(dt);
    return appeared;
  }
  visible(id) { return this.force || this.z[id].show > 0; }
  animate(dt) {
    const y = this.yard; if (!y) return; y.t += dt; const t = y.t, P = y.parts;
    y.squirrel.visible = this.visible("squirrel"); y.nest.visible = this.visible("nest");
    if (y.squirrel.visible) { // nibble loop: head dips to the nut, paws turn it, tail flicks
      const k = Math.max(0, Math.sin(t * 9)); P.head.rotation.x = 0.35 * k; P.paws.rotation.y = t * 2.2; P.paws.position.y = 0.17 + 0.01 * k; P.tail.rotation.x = -0.3 + 0.12 * Math.sin(t * 3.1);
    }
    if (y.nest.visible) { // babies gape, mama bobs in with the worm
      for (const b of P.babies) { const o = 0.25 + 0.35 * Math.max(0, Math.sin(t * 7 + b.phase)); b.up.rotation.x = -o; b.lo.rotation.x = Math.PI + o; b.jaw.position.y = 0.05 + 0.01 * Math.sin(t * 7 + b.phase); }
      const f = 0.5 + 0.5 * Math.sin(t * 2.4); P.mama.position.set(0, 0.16 - 0.06 * f, -0.2 + 0.12 * f); P.mama.rotation.x = 0.5 * f; P.worm.rotation.z = 0.6 + 0.5 * Math.sin(t * 11);
    }
  }
}
