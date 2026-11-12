import * as THREE from "three";
import { LAB, LAB_PATH_DEFS, inLab } from "./data/labGarage.js?v=logic39";

/**
 * logic19 BACKYARD LAB GARAGE — shell (walls / garage door / side window / roof), luxury
 * chemistry casework under every drivable lab lane, wall shelving packed with glassware and
 * instruments, corner machines, a reactor island, overhead pipe manifolds and cable trays.
 *
 * GPU-lite: one merged Standard mesh (structure + metal), one merged smoked-glass mesh, one
 * merged unlit glow mesh (liquids / screens), one merged neon mesh, + 6 InstancedMeshes for the
 * repeated glassware (vials, conical flasks, round flasks — glass + liquid each). No lights.
 * Colliders: shell walls (door + window openings), the island, the floor-standing machines.
 * The casework under the lanes is a Drive solid (drive/loftNet.js labUnderfill).
 */
const COL = {
  shellOut: 0x23272e, shellSeam: 0x15181d, wallIn: 0x161c2b, wallSeam: 0x0f1320, floor: 0x15181d, floorSeam: 0x0b0d10,
  roof: 0x1b1e24, cab: 0x20252e, cabFace: 0x262c37, drawer: 0x0e1116, handle: 0x8a96a4, steel: 0x6c7682, steelD: 0x3f4751,
  gun: 0x2a2f36, copper: 0x8c4a26, copperL: 0xa9612f, brass: 0x7a6236, rubber: 0x101215, shelf: 0x3a414b, bracket: 0x1c2027,
  panel: 0x141a2a, navy: 0x1a2238,
};
const LIQ = [0x1a9e94, 0xb36a22, 0x5a4cc4, 0x4fa7c8, 0x5f9e2e, 0x9e3a5a, 0x2b8fb0, 0x8f7a2a];
const GLOW = { cyan: 0x3fbfdc, ice: 0x7c7af0, screen: 0x1f6f8f, screen2: 0x274d86, amber: 0xb7782a, red: 0xa0302a, green: 0x3f9e5a };
const NEON = 0x5fe8ff, NEON_ICE = 0x8e8cff;

const M = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const I4 = new THREE.Matrix4();

function merged(parts, withColor = true) {
  const P = [], N = [], C = [], I = []; const col = new THREE.Color(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
  for (const [g, c, m] of parts) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position, nor = g.attributes.normal, base = P.length / 3;
    nm.getNormalMatrix(m); col.set(c);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m); P.push(v.x, v.y, v.z);
      v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); N.push(v.x, v.y, v.z);
      if (withColor) C.push(col.r, col.g, col.b);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) I.push(base + g.index.getX(i));
    else for (let i = 0; i < pos.count; i++) I.push(base + i);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  if (withColor) geo.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  geo.setIndex(I); geo.computeBoundingSphere(); return geo;
}
/** 8-corner hexahedron (bottom 0..3, top 4..7, both CCW from above) with flat normals */
function hexa(c) {
  const f = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], P = [];
  for (const [a, b, cc, d] of f) for (const k of [a, b, cc, a, cc, d]) P.push(...c[k]);
  // winding: fix per face so normals point outward (centroid test)
  const cen = c.reduce((s, q) => [s[0] + q[0] / 8, s[1] + q[1] / 8, s[2] + q[2] / 8], [0, 0, 0]);
  for (let t = 0; t < P.length; t += 9) {
    const A = new THREE.Vector3(P[t], P[t + 1], P[t + 2]), Bv = new THREE.Vector3(P[t + 3], P[t + 4], P[t + 5]), Cv = new THREE.Vector3(P[t + 6], P[t + 7], P[t + 8]);
    const n = new THREE.Vector3().subVectors(Bv, A).cross(new THREE.Vector3().subVectors(Cv, A));
    const m = new THREE.Vector3().addVectors(A, Bv).add(Cv).multiplyScalar(1 / 3).sub(new THREE.Vector3(...cen));
    if (n.dot(m) < 0) for (let j = 0; j < 3; j++) { const tmp = P[t + 3 + j]; P[t + 3 + j] = P[t + 6 + j]; P[t + 6 + j] = tmp; }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g;
}

export function buildLabGarage(parentGroup, pushCollider) {
  const L = LAB, ix0 = L.x0 + L.t, ix1 = L.x1 - L.t, iz0 = L.z0 + L.t, iz1 = L.z1 - L.t, H = L.h;
  const g = new THREE.Group(); g.name = "lab_garage"; g.userData.noBatch = true;
  const S = [], G = [], GL = [], NE = []; // structure, glass, glow, neon
  let sd = 19; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const pick = (a) => a[Math.floor(rnd() * a.length) % a.length];
  const box = (arr, sx, sy, sz, col, x, y, z, ry = 0) => arr.push([new THREE.BoxGeometry(sx, sy, sz), col, M(x, y, z, 0, ry, 0)]);
  const bx = (sx, sy, sz, col, x, y, z, ry = 0) => box(S, sx, sy, sz, col, x, y, z, ry);
  const cyl = (arr, rt, rb, h, col, x, y, z, seg = 12, rx = 0, rz = 0, open = false) => arr.push([new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), col, M(x, y, z, rx, 0, rz)]);
  const collide = (x0, y0, z0, x1, y1, z1, kind = "wall") => pushCollider(new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)), kind);
  const tube = (arr, pts, r, col, seg = 24, rad = 6) => arr.push([new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg, r, rad, false), col, I4]);

  // ── SHELL ─────────────────────────────────────────────────────────────────────────────
  const wallPiece = (x0, x1, y0, y1, z0, z1) => {
    bx(x1 - x0, y1 - y0, z1 - z0, COL.shellOut, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    collide(x0, y0, z0, x1, y1, z1);
  };
  const D = L.door, W = L.win;
  // west wall (garage door z 5.0–7.6)
  wallPiece(L.x0, ix0, 0, H, L.z0, D.z0); wallPiece(L.x0, ix0, 0, H, D.z1, L.z1); wallPiece(L.x0, ix0, D.h, H, D.z0, D.z1);
  // east + north walls
  wallPiece(ix1, L.x1, 0, H, L.z0, L.z1); wallPiece(ix0, ix1, 0, H, L.z0, iz0);
  // south wall (side window x 37.35–38.65, y 2.12–3.25)
  wallPiece(ix0, W.x0, 0, H, iz1, L.z1); wallPiece(W.x1, ix1, 0, H, iz1, L.z1);
  wallPiece(W.x0, W.x1, 0, W.y0, iz1, L.z1); wallPiece(W.x0, W.x1, W.y1, H, iz1, L.z1);
  // roof slab + fascia (no shadow so the moonlight still reads the interior a little)
  bx(L.x1 - L.x0 + 0.3, 0.2, L.z1 - L.z0 + 0.3, COL.roof, (L.x0 + L.x1) / 2, H + 0.1, (L.z0 + L.z1) / 2);
  // exterior vertical panel seams (proud of the wall, never coplanar)
  for (let z = L.z0 + 1.0; z < L.z1 - 0.5; z += 1.4) {
    if (!(z > D.z0 - 0.1 && z < D.z1 + 0.1)) bx(0.02, H - 0.1, 0.03, COL.shellSeam, L.x0 - 0.01, H / 2, z);
    bx(0.02, H - 0.1, 0.03, COL.shellSeam, L.x1 + 0.01, H / 2, z);
  }
  for (let x = L.x0 + 1.0; x < L.x1 - 0.5; x += 1.4) {
    bx(0.03, H - 0.1, 0.02, COL.shellSeam, x, H / 2, L.z0 - 0.01);
    if (!(x > W.x0 - 0.1 && x < W.x1 + 0.1)) bx(0.03, H - 0.1, 0.02, COL.shellSeam, x, H / 2, L.z1 + 0.01);
  }
  // interior wall lining: midnight panels with horizontal seams
  for (const y of [1.2, 2.4, 3.6]) {
    box(S, 0.012, 0.02, iz1 - iz0, COL.wallSeam, ix0 + 0.006, y, (iz0 + iz1) / 2);
    box(S, 0.012, 0.02, iz1 - iz0, COL.wallSeam, ix1 - 0.006, y, (iz0 + iz1) / 2);
    box(S, ix1 - ix0, 0.02, 0.012, COL.wallSeam, (ix0 + ix1) / 2, y, iz0 + 0.006);
    box(S, ix1 - ix0, 0.02, 0.012, COL.wallSeam, (ix0 + ix1) / 2, y, iz1 - 0.006);
  }
  // polished floor slab (top 0.0085: between the zone tint 0.005 and road decks 0.012)
  bx(ix1 - ix0, 0.06, iz1 - iz0, COL.floor, (ix0 + ix1) / 2, 0.0085 - 0.03, (iz0 + iz1) / 2);
  // floor apron out of the door (to the Grand Descent road)
  bx(2.55, 0.06, D.z1 - D.z0 + 0.6, COL.floor, L.x0 - 1.275, 0.0085 - 0.03, (D.z0 + D.z1) / 2); // logic19: west face 5 cm off the GD deck side (was coplanar)
  // garage door: rolled-up drum + guides
  cyl(S, 0.17, 0.17, D.z1 - D.z0, COL.steelD, ix0 + 0.2, D.h + 0.2, (D.z0 + D.z1) / 2, 16, Math.PI / 2);
  for (const z of [D.z0 + 0.04, D.z1 - 0.04]) bx(0.08, D.h, 0.06, COL.gun, ix0 + 0.05, D.h / 2, z);
  // neon door + window frames (exterior) and a slim neon fascia line round the roof
  const nline = (x0, y0, z0, x1, y1, z1, t = 0.022) => box(NE, Math.max(t, Math.abs(x1 - x0)), Math.max(t, Math.abs(y1 - y0)), Math.max(t, Math.abs(z1 - z0)), NEON, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const xo = L.x0 - 0.03;
  nline(xo, 0.02, D.z0 - 0.05, xo, D.h + 0.04, D.z0 - 0.05); nline(xo, 0.02, D.z1 + 0.05, xo, D.h + 0.04, D.z1 + 0.05); nline(xo, D.h + 0.05, D.z0 - 0.05, xo, D.h + 0.05, D.z1 + 0.05);
  const zo = L.z1 + 0.03;
  nline(W.x0 - 0.04, W.y0 - 0.03, zo, W.x0 - 0.04, W.y1 + 0.03, zo); nline(W.x1 + 0.04, W.y0 - 0.03, zo, W.x1 + 0.04, W.y1 + 0.03, zo);
  nline(W.x0 - 0.04, W.y1 + 0.04, zo, W.x1 + 0.04, W.y1 + 0.04, zo); nline(W.x0 - 0.04, W.y0 - 0.04, zo, W.x1 + 0.04, W.y0 - 0.04, zo);
  for (const [a, b, c, d] of [[L.x0 - 0.16, L.z0 - 0.16, L.x1 + 0.16, L.z0 - 0.16], [L.x0 - 0.16, L.z1 + 0.16, L.x1 + 0.16, L.z1 + 0.16], [L.x0 - 0.16, L.z0 - 0.16, L.x0 - 0.16, L.z1 + 0.16], [L.x1 + 0.16, L.z0 - 0.16, L.x1 + 0.16, L.z1 + 0.16]]) nline(a, H + 0.12, b, c, H + 0.12, d, 0.018);
  // copper window reveal + sign panel over the door
  for (const x of [W.x0 + 0.03, W.x1 - 0.03]) bx(0.06, W.y1 - W.y0, L.t + 0.02, COL.copper, x, (W.y0 + W.y1) / 2, iz1 + L.t / 2);
  box(GL, 0.02, 0.34, 1.5, GLOW.screen2, L.x0 - 0.02, D.h + 0.55, (D.z0 + D.z1) / 2);
  for (let i = 0; i < 3; i++) nline(L.x0 - 0.035, D.h + 0.45 + i * 0.1, (D.z0 + D.z1) / 2 - 0.6 + i * 0.2, L.x0 - 0.035, D.h + 0.45 + i * 0.1, (D.z0 + D.z1) / 2 + 0.6 - i * 0.2, 0.014);

  // ── CASEWORK under every elevated lab lane (matches the Drive underfill solids) ───────────
  const segs = [];
  for (const P of LAB_PATH_DEFS) for (let i = 1; i < P.points.length; i++) segs.push({ id: P.id, a: P.points[i - 1], b: P.points[i], w: P.width });
  const snap = (p, mx, mz) => {
    const q = [p[0], p[1], p[2]];
    if (mx - ix0 < 1.0 && p[0] < mx) q[0] = ix0; if (ix1 - mx < 1.0 && p[0] > mx) q[0] = ix1;
    if (mz - iz0 < 1.0 && p[2] < mz) q[2] = iz0; if (iz1 - mz < 1.0 && p[2] > mz) q[2] = iz1;
    return q;
  };
  const backTops = []; // wall-side strips at deck level (gear sits here)
  for (const s of segs) {
    const yMin = Math.min(s.a.y, s.b.y); if (yMin < 0.25) continue;
    const mx = (s.a.x + s.b.x) / 2, mz = (s.a.z + s.b.z) / 2; if (!inLab(mx, mz, -0.1)) continue;
    const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, len = Math.hypot(dx, dz) || 1, nx = dz / len, nz = -dx / len, hw = s.w / 2;
    const e = (p, o) => [p.x + nx * o, 0, p.z + nz * o];
    const ta = s.a.y - 0.112, tb = s.b.y - 0.112;
    const A0 = e(s.a, -hw), A1 = e(s.a, hw), B0 = e(s.b, -hw), B1 = e(s.b, hw);
    const lane = [[A0[0], 0, A0[2]], [B0[0], 0, B0[2]], [B1[0], 0, B1[2]], [A1[0], 0, A1[2]], [A0[0], ta, A0[2]], [B0[0], tb, B0[2]], [B1[0], tb, B1[2]], [A1[0], ta, A1[2]]];
    S.push([hexa(lane), COL.cab, I4]);
    // wall-side back strip (deck level) when the lane hugs a wall
    for (const sd2 of (s.id === "lab_window" ? [] : [-1, 1])) {
      const a = e(s.a, sd2 * (hw + 0.045)), b = e(s.b, sd2 * (hw + 0.045));
      const aw = snap(a, mx, mz), bw = snap(b, mx, mz);
      if (Math.hypot(aw[0] - a[0], aw[2] - a[2]) < 0.05 && Math.hypot(bw[0] - b[0], bw[2] - b[2]) < 0.05) continue;
      const tA = s.a.y + 0.004, tB = s.b.y + 0.004;
      const c = [[a[0], 0, a[2]], [b[0], 0, b[2]], [bw[0], 0, bw[2]], [aw[0], 0, aw[2]], [a[0], tA, a[2]], [b[0], tB, b[2]], [bw[0], tB, bw[2]], [aw[0], tA, aw[2]]];
      S.push([hexa(c), COL.cabFace, I4]);
      if (Math.abs(s.a.y - s.b.y) < 0.01 && s.id === "lab_circuit") backTops.push({ a, b, aw, bw, y: tA });
    }
  }
  // cabinet fronts: drawers + handles + cyan toe-kick glow on the room-facing sides
  const front = (x0, z0, x1, z1, top, face) => { // face: outward normal [fx, fz]
    const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, ry = Math.atan2(ux, uz) + Math.PI / 2;
    const n = Math.max(1, Math.floor(len / 0.62));
    for (let i = 0; i < n; i++) {
      const c = (i + 0.5) * len / n, cx = x0 + ux * c + face[0] * 0.012, cz = z0 + uz * c + face[1] * 0.012;
      const rows = top > 1.2 ? 3 : 2;
      for (let r = 0; r < rows; r++) {
        const h = (top - 0.16) / rows, y = 0.1 + h * (r + 0.5);
        box(S, len / n - 0.05, h - 0.04, 0.012, COL.drawer, cx, y, cz, ry);
        box(S, 0.16, 0.018, 0.02, COL.handle, cx + face[0] * 0.012, y + h * 0.3, cz + face[1] * 0.012, ry);
      }
    }
    box(NE, len - 0.04, 0.012, 0.01, NEON, (x0 + x1) / 2 + face[0] * 0.02, 0.05, (z0 + z1) / 2 + face[1] * 0.02, ry);
  };
  front(32.42, -2.7, 32.42, 1.0, 0.77, [1, 0]);         // west workbench (faces the return lane)
  front(33.6, -3.58, 36.2, -3.58, 0.77, [0, 1]);        // north shelf casework
  front(37.58, -2.6, 37.58, -0.6, 1.47, [-1, 0]);       // east casework (north of the island)
  front(34.58, 3.7, 34.58, 6.6, 1.15, [-1, 0]);         // gantry spine (faces the return lane)

  // ── REACTOR ISLAND (collider) ───────────────────────────────────────────────────────────
  const IS = L.island;
  bx(IS.x1 - IS.x0, IS.top, IS.z1 - IS.z0, COL.cab, (IS.x0 + IS.x1) / 2, IS.top / 2, (IS.z0 + IS.z1) / 2);
  bx(IS.x1 - IS.x0 + 0.06, 0.04, IS.z1 - IS.z0 + 0.06, COL.gun, (IS.x0 + IS.x1) / 2, IS.top + 0.02, (IS.z0 + IS.z1) / 2);
  collide(IS.x0, 0, IS.z0, IS.x1, IS.top + 0.04, IS.z1);
  front(IS.x0, IS.z0 + 0.1, IS.x0, IS.z1 - 0.1, IS.top, [-1, 0]);
  front(IS.x0 + 0.1, IS.z0, IS.x1 - 0.1, IS.z0, IS.top, [0, -1]);
  const icx = (IS.x0 + IS.x1) / 2, it = IS.top + 0.04;
  // reactor tank: steel body, copper bands, dome, sight-glass glow ring, gauges
  cyl(S, 0.42, 0.42, 1.3, COL.steel, icx, it + 0.65, 0.65, 24);
  for (const y of [0.2, 0.65, 1.1]) cyl(S, 0.435, 0.435, 0.05, COL.copper, icx, it + y, 0.65, 24);
  S.push([new THREE.SphereGeometry(0.42, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), COL.steel, M(icx, it + 1.3, 0.65)]);
  cyl(GL, 0.425, 0.425, 0.08, GLOW.cyan, icx, it + 0.9, 0.65, 24);
  for (const [dz, y] of [[-0.3, 0.45], [0.3, 0.45], [0, 1.0]]) { cyl(S, 0.07, 0.07, 0.03, COL.brass, icx - 0.43, it + y, 0.65 + dz, 14, 0, Math.PI / 2); cyl(GL, 0.055, 0.055, 0.01, GLOW.amber, icx - 0.45, it + y, 0.65 + dz, 14, 0, Math.PI / 2); }
  // distillation column: glass column with copper tray caps, reboiler flask, condenser coil, receiver
  const colX = icx, colZ = 2.35;
  cyl(G, 0.12, 0.12, 2.5, 0x9fb4c4, colX, it + 1.45, colZ, 14, 0, 0, true);
  for (let y = 0.35; y < 2.7; y += 0.42) cyl(S, 0.14, 0.14, 0.05, COL.copperL, colX, it + y, colZ, 14);
  cyl(GL, 0.06, 0.06, 2.2, GLOW.cyan, colX, it + 1.4, colZ, 8);
  G.push([new THREE.SphereGeometry(0.26, 16, 12), 0x9fb4c4, M(colX, it + 0.26, colZ)]);
  GL.push([new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), GLOW.amber, M(colX, it + 0.24, colZ)]);
  { const pts = []; for (let k = 0; k <= 80; k++) { const a = k / 80 * Math.PI * 9; pts.push(new THREE.Vector3(colX + Math.cos(a) * 0.2, it + 2.25 + k / 80 * 0.6, colZ + 1.0 + Math.sin(a) * 0.2)); }
    S.push([new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.022, 6, false), COL.copperL, I4]); }
  cyl(G, 0.09, 0.09, 0.7, 0x9fb4c4, colX, it + 2.55, colZ + 1.0, 12, 0, 0, true);
  tube(G, [[colX, it + 2.75, colZ], [colX, it + 3.0, colZ + 0.4], [colX, it + 2.9, colZ + 1.0]], 0.03, 0x9fb4c4);
  tube(G, [[colX, it + 2.2, colZ + 1.0], [colX + 0.2, it + 1.4, colZ + 1.4], [colX + 0.25, it + 0.5, colZ + 1.55]], 0.025, 0x9fb4c4);
  G.push([new THREE.SphereGeometry(0.2, 14, 10), 0x9fb4c4, M(colX + 0.25, it + 0.22, colZ + 1.6)]);
  GL.push([new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), GLOW.green, M(colX + 0.25, it + 0.2, colZ + 1.6)]);
  // centrifuge
  cyl(S, 0.36, 0.38, 0.42, COL.gun, icx, it + 0.21, 4.75, 24);
  G.push([new THREE.SphereGeometry(0.33, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x9fb4c4, M(icx, it + 0.42, 4.75, 0, 0, 0, 1, 0.45, 1)]);
  cyl(GL, 0.37, 0.37, 0.02, GLOW.ice, icx, it + 0.3, 4.75, 24);
  // control console (screens face west, toward the gantry + return lane)
  bx(0.7, 0.75, 1.1, COL.panel, icx + 0.2, it + 0.37, 5.85);
  S.push([new THREE.BoxGeometry(0.06, 0.55, 1.05), COL.navy, M(icx - 0.17, it + 0.95, 5.85, 0, 0, 0.35)]);
  for (const [dz, c] of [[-0.25, GLOW.screen], [0.25, GLOW.screen2]]) GL.push([new THREE.BoxGeometry(0.01, 0.4, 0.42), c, M(icx - 0.205, it + 0.95, 5.85 + dz, 0, 0, 0.35)]);
  for (let k = 0; k < 10; k++) GL.push([new THREE.BoxGeometry(0.012, 0.012, 0.03), pick([GLOW.green, GLOW.amber, GLOW.cyan, GLOW.red]), M(icx - 0.17, it + 0.76, 5.45 + k * 0.08)]);
  bx(0.12, 1.6, 0.5, COL.panel, icx + 0.4, it + 0.8 + 0.75, 6.4);
  GL.push([new THREE.BoxGeometry(0.01, 0.9, 0.42), GLOW.screen, M(icx + 0.335, it + 1.75, 6.4)]);
  // glass tube runs between the island machines (some carry glowing liquid cores)
  tube(G, [[icx, it + 1.25, 0.65], [icx - 0.2, it + 2.0, 1.4], [colX, it + 1.6, colZ]], 0.035, 0x9fb4c4, 40);
  tube(GL, [[icx, it + 1.25, 0.65], [icx - 0.2, it + 2.0, 1.4], [colX, it + 1.6, colZ]], 0.014, GLOW.cyan, 40, 5);
  tube(G, [[colX + 0.25, it + 0.4, colZ + 1.6], [icx + 0.3, it + 1.1, 3.9], [icx, it + 0.6, 4.75]], 0.03, 0x9fb4c4, 40);
  tube(GL, [[colX + 0.25, it + 0.4, colZ + 1.6], [icx + 0.3, it + 1.1, 3.9], [icx, it + 0.6, 4.75]], 0.012, GLOW.green, 40, 5);
  // steel + copper risers from the island up to the ceiling manifold
  for (const [x, z, c, r] of [[icx + 0.3, 0.2, COL.copper, 0.045], [icx + 0.35, 1.2, COL.steel, 0.04], [icx + 0.35, 3.2, COL.copper, 0.035], [icx + 0.3, 4.9, COL.steel, 0.04]]) cyl(S, r, r, H - it - 0.2, c, x, (it + H - 0.2) / 2, z, 10);

  // ── CORNER MACHINES ─────────────────────────────────────────────────────────────────────
  // SW: big jacketed reactor vessel on the floor (collider)
  { const x = 31.78, z = 8.22;
    cyl(S, 0.46, 0.46, 2.3, COL.steelD, x, 1.2, z, 24); for (const y of [0.4, 1.0, 1.6, 2.2]) cyl(S, 0.475, 0.475, 0.06, COL.copper, x, y, z, 24);
    S.push([new THREE.SphereGeometry(0.46, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), COL.steelD, M(x, 2.35, z)]);
    cyl(GL, 0.465, 0.465, 0.1, GLOW.amber, x, 1.3, z, 24);
    for (let k = 0; k < 4; k++) bx(0.05, 0.12, 0.05, COL.gun, x + Math.cos(k * 1.57) * 0.4, 0.06, z + Math.sin(k * 1.57) * 0.4);
    cyl(S, 0.05, 0.05, H - 2.6, COL.copper, x, (2.6 + H) / 2, z, 10);
    collide(x - 0.5, 0, z - 0.5, x + 0.5, 2.8, Math.min(iz1, z + 0.5)); }
  // SW low cabinet along the south wall (collider) + its top gear
  bx(1.9, 0.9, 0.48, COL.cab, 33.5, 0.45, iz1 - 0.24); collide(32.55, 0, iz1 - 0.5, 34.45, 0.92, iz1);
  front(32.6, iz1 - 0.48, 34.4, iz1 - 0.48, 0.9, [0, -1]);
  // NW cryostat (sits on the bench casework corner, clear of the lane arc)
  { const x = 31.62, z = -4.42; cyl(S, 0.24, 0.24, 3.0, COL.steel, x, 0.95 + 1.5, z, 20); for (let y = 1.2; y < 3.9; y += 0.55) cyl(GL, 0.245, 0.245, 0.03, GLOW.ice, x, y, z, 20);
    cyl(S, 0.04, 0.04, 0.6, COL.copper, x + 0.2, 3.9, z + 0.2, 8); }
  // NE mass-spec tower
  { const x = 38.42, z = -4.42; bx(0.42, 2.7, 0.42, COL.panel, x - 0.02, 1.6 + 1.35, z - 0.02);
    GL.push([new THREE.BoxGeometry(0.3, 0.7, 0.01), GLOW.screen, M(x - 0.02, 3.1, z + 0.195)]); GL.push([new THREE.BoxGeometry(0.01, 0.5, 0.3), GLOW.screen2, M(x - 0.235, 2.4, z - 0.02)]);
    for (let k = 0; k < 6; k++) GL.push([new THREE.BoxGeometry(0.012, 0.02, 0.02), pick([GLOW.green, GLOW.amber, GLOW.cyan]), M(x - 0.235, 2.0 + k * 0.05, z + 0.1)]); }

  // ── WALL SHELVING (non-drivable upper shelves) + overhead services ───────────────────────
  const shelves = []; // {x0,z0,x1,z1,y, nx,nz (into room)}
  const shelfRun = (x0, z0, x1, z1, y, nx, nz, depth = 0.34) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    const cx = (x0 + x1) / 2 + nx * depth / 2, cz = (z0 + z1) / 2 + nz * depth / 2;
    box(S, Math.abs(nx) > 0 ? depth : len, 0.03, Math.abs(nx) > 0 ? len : depth, COL.shelf, cx, y - 0.015, cz);
    box(NE, Math.abs(nx) > 0 ? 0.006 : len - 0.02, 0.006, Math.abs(nx) > 0 ? len - 0.02 : 0.006, NEON_ICE, (x0 + x1) / 2 + nx * (depth + 0.004), y - 0.026, (z0 + z1) / 2 + nz * (depth + 0.004));
    for (let c = 0.2; c < len; c += 0.9) { const px = x0 + (x1 - x0) * c / len, pz = z0 + (z1 - z0) * c / len; box(S, Math.abs(nx) > 0 ? depth - 0.02 : 0.03, 0.12, Math.abs(nx) > 0 ? 0.03 : depth - 0.02, COL.bracket, px + nx * depth / 2, y - 0.09, pz + nz * depth / 2); }
    shelves.push({ x0, z0, x1, z1, y, nx, nz, depth }); void ry;
  };
  for (const y of [1.65, 2.35, 3.05, 3.75]) shelfRun(ix0, -4.1, ix0, y < 2 ? 1.0 : 4.75, y, 1, 0);        // west wall
  for (const y of [2.4, 3.1, 3.8]) shelfRun(31.9, iz0, 37.9, iz0, y, 0, 1);                            // north wall
  for (const y of [3.25, 3.95]) shelfRun(ix1, -3.9, ix1, 8.55, y, -1, 0);                               // east wall
  shelfRun(ix1, -3.9, ix1, -1.7, 2.5, -1, 0);
  for (const y of [3.3, 4.0]) shelfRun(31.5, iz1, 37.1, iz1, y, 0, -1);                                // south wall
  for (const y of [1.55, 2.2]) shelfRun(32.6, iz1, 34.4, iz1, y, 0, -1);                               // over the SW cabinet
  // gear on the deck-level back strips + the SW cabinet top
  // merge consecutive collinear strip pieces into continuous runs (gear never straddles a seam)
  const runs = [];
  for (const t of backTops) {
    const q = runs[runs.length - 1];
    const dir = (u) => { const dx = u.b[0] - u.a[0], dz = u.b[2] - u.a[2], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
    if (q && Math.abs(q.y - t.y) < 0.005 && Math.hypot(q.b[0] - t.a[0], q.b[2] - t.a[2]) < 0.02) { const d0 = dir(q), d1 = dir(t); if (d0[0] * d1[0] + d0[1] * d1[1] > 0.999) { q.b = t.b; q.bw = t.bw; continue; } }
    runs.push({ ...t });
  }
  for (const t of runs) shelves.push({ x0: (t.a[0] + t.aw[0]) / 2, z0: (t.a[2] + t.aw[2]) / 2, x1: (t.b[0] + t.bw[0]) / 2, z1: (t.b[2] + t.bw[2]) / 2, y: t.y, strip: true });
  shelves.push({ x0: 32.65, z0: iz1 - 0.25, x1: 34.35, z1: iz1 - 0.25, y: 0.92, strip: true });

  // ── GLASSWARE (instanced) + instruments on every shelf ──────────────────────────────────
  const inst = { vial: [], erl: [], rf: [] };
  const place = (sh) => {
    const len = Math.hypot(sh.x1 - sh.x0, sh.z1 - sh.z0); if (len < 0.15) return;
    const ux = (sh.x1 - sh.x0) / len, uz = (sh.z1 - sh.z0) / len;
    const depth = sh.strip ? 0 : sh.depth;
    let c = 0.08;
    while (c < len - 0.08) {
      const k = rnd(), px = sh.x0 + ux * c + (sh.nx || 0) * depth * 0.5, pz = sh.z0 + uz * c + (sh.nz || 0) * depth * 0.5, y = sh.y;
      let wdt;
      if (k < 0.34) { // vial rack: steel rack + a row of vials (along the shelf)
        const n = 5 + Math.floor(rnd() * 6); wdt = n * 0.045 + 0.04;
        const mx = px + ux * wdt / 2, mz = pz + uz * wdt / 2;
        box(S, Math.abs(ux) > 0.5 ? wdt : 0.07, 0.03, Math.abs(ux) > 0.5 ? 0.07 : wdt, COL.steelD, mx, y + 0.06, mz);
        box(S, Math.abs(ux) > 0.5 ? wdt : 0.07, 0.012, Math.abs(ux) > 0.5 ? 0.07 : wdt, COL.steelD, mx, y + 0.006, mz);
        for (let i = 0; i < n; i++) inst.vial.push({ x: px + ux * (0.04 + i * 0.045), y: y + 0.065, z: pz + uz * (0.04 + i * 0.045), fill: 0.35 + rnd() * 0.55, c: pick(LIQ) });
      } else if (k < 0.55) { wdt = 0.16; inst.erl.push({ x: px + ux * 0.08, y, z: pz + uz * 0.08, s: 0.8 + rnd() * 0.5, c: pick(LIQ) }); }
      else if (k < 0.72) { wdt = 0.17; inst.rf.push({ x: px + ux * 0.085, y, z: pz + uz * 0.085, s: 0.75 + rnd() * 0.5, c: pick(LIQ) }); }
      else if (k < 0.86) { // reagent bottles (glass + liquid, merged)
        const n = 2 + Math.floor(rnd() * 3); wdt = n * 0.075;
        for (let i = 0; i < n; i++) { const bx2 = px + ux * (0.035 + i * 0.075), bz = pz + uz * (0.035 + i * 0.075), h = 0.14 + rnd() * 0.08;
          cyl(G, 0.03, 0.03, h, 0x8f9fae, bx2, y + h / 2, bz, 10); cyl(GL, 0.024, 0.024, h * 0.6, pick(LIQ), bx2, y + h * 0.3 + 0.003, bz, 8); cyl(S, 0.018, 0.018, 0.03, COL.rubber, bx2, y + h + 0.015, bz, 8); }
      } else { // compact instrument: housing + screen + status dots
        wdt = 0.26; const mx = px + ux * 0.13, mz = pz + uz * 0.13, h = 0.14 + rnd() * 0.12;
        bx(Math.abs(ux) > 0.5 ? 0.24 : 0.22, h, Math.abs(ux) > 0.5 ? 0.22 : 0.24, pick([COL.panel, COL.gun, COL.navy]), mx, y + h / 2, mz);
        const fx = (sh.nx || 0) * 0.112, fz = (sh.nz || 0) * 0.112;
        if (fx || fz) GL.push([new THREE.BoxGeometry(Math.abs(fx) > 0 ? 0.004 : 0.15, h * 0.5, Math.abs(fz) > 0 ? 0.004 : 0.15), pick([GLOW.screen, GLOW.screen2]), M(mx + fx, y + h * 0.58, mz + fz)]);
        GL.push([new THREE.BoxGeometry(0.02, 0.012, 0.02), pick([GLOW.green, GLOW.amber, GLOW.red]), M(mx, y + h + 0.006, mz)]);
      }
      c += wdt + 0.03 + rnd() * 0.05;
    }
  };
  shelves.forEach(place);
  // thin glass tubing runs along the shelves (arching between neighbouring flasks)
  for (const sh of shelves) {
    if (sh.strip || rnd() < 0.35) continue;
    const len = Math.hypot(sh.x1 - sh.x0, sh.z1 - sh.z0); if (len < 1.2) continue;
    const ux = (sh.x1 - sh.x0) / len, uz = (sh.z1 - sh.z0) / len, o = sh.depth * 0.75;
    for (let c = 0.3; c < len - 0.9; c += 1.1 + rnd()) {
      const p = (cc, h) => [sh.x0 + ux * cc + sh.nx * o, sh.y + h, sh.z0 + uz * cc + sh.nz * o];
      tube(G, [p(c, 0.2), p(c + 0.3, 0.42), p(c + 0.6, 0.22)], 0.012, 0x9fb4c4, 16, 5);
    }
  }
  // overhead: pipe manifold (copper + steel), cable trays with underglow, linear light bars
  for (const [x, c, r] of [[33.55, COL.copper, 0.05], [33.72, COL.steel, 0.045], [33.88, COL.steelD, 0.04]]) cyl(S, r, r, iz1 - iz0, c, x, H - 0.25, (iz0 + iz1) / 2, 10, Math.PI / 2);
  for (const [z, c, r] of [[0.8, COL.copper, 0.045], [0.95, COL.steel, 0.04]]) cyl(S, r, r, ix1 - ix0, c, (ix0 + ix1) / 2, H - 0.36, z, 10, 0, Math.PI / 2);
  for (let z = iz0 + 0.6; z < iz1; z += 1.6) for (const x of [33.55, 33.72, 33.88]) cyl(S, 0.06, 0.06, 0.04, COL.brass, x, H - 0.25, z, 10, Math.PI / 2);
  for (const z of [-2.2, 5.6]) { bx(ix1 - ix0 - 0.4, 0.05, 0.3, COL.bracket, (ix0 + ix1) / 2, H - 0.55, z); box(NE, ix1 - ix0 - 0.5, 0.006, 0.008, NEON, (ix0 + ix1) / 2, H - 0.578, z); }
  for (const x of [32.4, 36.5]) box(GL, 0.08, 0.012, iz1 - iz0 - 1.0, 0x6fa8c8, x, H - 0.02, (iz0 + iz1) / 2);
  // wall pipe runs with valve wheels + gauges (north + east walls, high)
  for (const [y, c, r] of [[4.05, COL.copper, 0.04], [4.17, COL.steel, 0.035]]) {
    cyl(S, r, r, ix1 - ix0, c, (ix0 + ix1) / 2, y, iz0 + 0.08, 10, 0, Math.PI / 2);
    cyl(S, r, r, iz1 - iz0, c, ix1 - 0.08, y, (iz0 + iz1) / 2, 10, Math.PI / 2);
  }
  for (const x of [32.6, 34.8, 37.0]) { S.push([new THREE.TorusGeometry(0.09, 0.012, 6, 16), COL.copperL, M(x, 4.05, iz0 + 0.17)]); cyl(S, 0.06, 0.06, 0.03, COL.brass, x + 0.4, 3.9, iz0 + 0.1, 14, Math.PI / 2); cyl(GL, 0.048, 0.048, 0.008, GLOW.amber, x + 0.4, 3.9, iz0 + 0.118, 14, Math.PI / 2); }
  // cable runs: dark cables draping down the walls between shelves
  for (const [x, z] of [[ix0 + 0.03, -1.0], [ix0 + 0.03, 3.6], [ix1 - 0.03, 2.2], [ix1 - 0.03, 6.0]]) tube(S, [[x, H - 0.3, z], [x, 3.4, z + 0.15], [x, 2.6, z - 0.1], [x, 1.9, z + 0.05]], 0.012, COL.rubber, 20, 5);

  // ── meshes ───────────────────────────────────────────────────────────────────────────────
  const structMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.32, emissive: 0x0b1018, emissiveIntensity: 1.0 });
  const glassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.3, depthWrite: false });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const neonMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const add = (geo, mat, name, shadow = false) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = shadow; m.receiveShadow = true; m.userData.noBatch = true; g.add(m); return m; };
  add(merged(S), structMat, "lab_struct");
  add(merged(G), glassMat, "lab_glass").renderOrder = 2;
  add(merged(GL), glowMat, "lab_glow");
  add(merged(NE), neonMat, "lab_neon");
  // instanced glassware
  const lathe = (pts, seg = 12) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  const geos = {
    vial: [new THREE.CylinderGeometry(0.016, 0.016, 0.11, 8, 1, true).translate(0, 0.055, 0), new THREE.CylinderGeometry(0.0125, 0.0125, 1, 8).translate(0, 0.5, 0)],
    erl: [lathe([[0.001, 0], [0.06, 0], [0.065, 0.01], [0.022, 0.12], [0.02, 0.17], [0.023, 0.175]]), lathe([[0.001, 0.004], [0.055, 0.004], [0.06, 0.012], [0.04, 0.06], [0.001, 0.06]])],
    rf: [lathe([[0.001, 0.0], [0.045, 0.01], [0.07, 0.06], [0.06, 0.11], [0.02, 0.14], [0.018, 0.2], [0.021, 0.205]], 14), lathe([[0.001, 0.004], [0.045, 0.014], [0.064, 0.05], [0.001, 0.05]], 14)],
  };
  const glassI = new THREE.MeshStandardMaterial({ color: 0x9fb4c4, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false });
  const liqI = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const m4 = new THREE.Matrix4(), cc = new THREE.Color();
  for (const [k, list] of Object.entries(inst)) {
    if (!list.length) continue;
    const gi = new THREE.InstancedMesh(geos[k][0], glassI, list.length), li = new THREE.InstancedMesh(geos[k][1], liqI, list.length);
    list.forEach((o, i) => {
      if (k === "vial") { gi.setMatrixAt(i, m4.makeTranslation(o.x, o.y, o.z)); li.setMatrixAt(i, M(o.x, o.y + 0.004, o.z, 0, 0, 0, 1, 0.1 * o.fill, 1)); }
      else { gi.setMatrixAt(i, M(o.x, o.y, o.z, 0, 0, 0, o.s, o.s, o.s)); li.setMatrixAt(i, M(o.x, o.y, o.z, 0, 0, 0, o.s, o.s, o.s)); }
      li.setColorAt(i, cc.set(o.c));
    });
    gi.name = `lab_${k}_glass`; li.name = `lab_${k}_liquid`; gi.renderOrder = 2;
    gi.userData.noBatch = li.userData.noBatch = true;
    gi.computeBoundingSphere(); li.computeBoundingSphere();
    g.add(li); g.add(gi);
  }
  g.userData.labCounts = { vials: inst.vial.length, conical: inst.erl.length, round: inst.rf.length, shelves: shelves.length };
  parentGroup.add(g);
  return g;
}
