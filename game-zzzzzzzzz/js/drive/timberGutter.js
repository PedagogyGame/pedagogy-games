import * as THREE from "three";
import { TIMBER, GUTTER } from "../data/loftNet.js?v=logic21";

/**
 * logic18: east-cavity TIMBER FRAMING (studs, joists, braces, beams, batting, wiring) +
 * WEST GUTTER soft trough walls. GPU-lite: one merged vertex-coloured mesh for timber,
 * one for gutter trough. No lights. Framing is scenery (no Drive colliders) — the road
 * rails remain the soft side-guides. Gutter trough sides ARE soft driveKind "rail" boxes
 * so the car can wiggle but not fall off.
 */
const M = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

function merged(parts) {
  const P = [], N = [], C = [], I = []; const col = new THREE.Color(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
  for (const [g0, c, m] of parts) {
    const g = g0, pos = g.attributes.position, nor = g.attributes.normal, base = P.length / 3;
    nm.getNormalMatrix(m); col.set(c);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m); P.push(v.x, v.y, v.z);
      v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); N.push(v.x, v.y, v.z); C.push(col.r, col.g, col.b);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) I.push(base + g.index.getX(i));
    else for (let i = 0; i < pos.count; i++) I.push(base + i);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  geo.setIndex(I); return geo;
}

export function buildTimberAndGutter(root, tracks) {
  const T = TIMBER, U = GUTTER;
  const wood = 0x3a2a1a, woodD = 0x2a1c12, woodL = 0x5a4030, bat = 0x6b5a3e, wire = 0x2a2e34, rust = 0x5a3a22;
  const parts = [];
  const box = (sx, sy, sz, col, x, y, z, ry = 0) => parts.push([new THREE.BoxGeometry(sx, sy, sz), col, M(x, y, z, 0, ry, 0)]);
  // ── TIMBER SHAFT framing in the east cavity ──
  const xI = T.xInner, xO = T.xOuter, z0 = T.zN - 0.4, z1 = T.zS + 0.4;
  // Vertical studs every ~1.1 m on both cavity faces
  for (let z = z0; z <= z1; z += 1.1) {
    box(0.08, 8.6, 0.1, wood, xI + 0.04, 4.3, z);
    box(0.08, 8.6, 0.1, woodD, xO - 0.04, 4.3, z);
  }
  // Floor joists / ledgers at story heights
  for (const y of [0.15, 3.35, 6.7, 8.35]) {
    box(xO - xI - 0.1, 0.1, z1 - z0, woodL, (xI + xO) / 2, y, (z0 + z1) / 2);
    // cross joists
    for (let z = z0 + 0.55; z < z1; z += 1.1) box(xO - xI - 0.15, 0.07, 0.08, wood, (xI + xO) / 2, y + 0.08, z);
  }
  // Diagonal cross-bracing (every other bay)
  for (let z = z0; z < z1 - 1.2; z += 2.2) {
    const mid = z + 1.1, h = 3.2;
    for (const y0 of [0.2, 3.4]) {
      // brace as a thin rotated box
      const L = Math.hypot(1.1, h), ang = Math.atan2(h, 1.1);
      parts.push([new THREE.BoxGeometry(0.06, L, 0.06), woodD, M(xI + 0.12, y0 + h / 2, mid, 0, 0, -ang + Math.PI / 2)]);
      parts.push([new THREE.BoxGeometry(0.06, L, 0.06), woodD, M(xO - 0.12, y0 + h / 2, mid, 0, 0, ang - Math.PI / 2)]);
    }
  }
  // Insulation batting scraps (soft yellow-brown pads between studs)
  let sd = 11; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 28; i++) {
    const z = z0 + 0.4 + rnd() * (z1 - z0 - 0.8), y = 0.4 + rnd() * 7.5;
    box(0.04, 0.35 + rnd() * 0.5, 0.55 + rnd() * 0.4, bat, rnd() > 0.5 ? xI + 0.1 : xO - 0.1, y, z);
  }
  // Wiring runs (thin dark cables along joists)
  for (let i = 0; i < 6; i++) {
    const y = 1.2 + i * 1.2;
    box(0.02, 0.02, z1 - z0 - 1, wire, xI + 0.18 + (i % 2) * 0.15, y, (z0 + z1) / 2);
  }
  // A few hanging scrap planks / blocking
  for (let i = 0; i < 10; i++) {
    const z = z0 + 1 + rnd() * (z1 - z0 - 2), y = 1 + rnd() * 6;
    box(0.04, 0.5 + rnd() * 0.8, 0.12, woodL, (xI + xO) / 2 + (rnd() - 0.5) * 0.6, y, z, rnd() * 0.4);
  }
  const timber = new THREE.Mesh(merged(parts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  timber.name = "timber_framing"; timber.raycast = () => {}; root.add(timber);

  // ── GUTTER trough (visual) — wet-zinc U channel with thin neon lip ──
  // Flat lip (attic) + steep plunge; soft walls tall enough to nudge, low enough to wiggle.
  const gParts = [];
  const zinc = 0x3a424c, zincD = 0x1e242c, lip = 0x5fe8ff;
  const gx = U.x, lipZ = U.z0 + 2.2;
  const zLip0 = T.zN - 0.2, yA = U.y0, yB = U.y1, zB = U.z1;
  const wh = U.wallH + 0.02;
  // flat lip floor + walls
  {
    const len = Math.abs(lipZ - zLip0);
    const midZ = (zLip0 + lipZ) / 2;
    gParts.push([new THREE.BoxGeometry(U.width + 0.08, 0.025, len + 0.08), zincD, M(gx, yA - 0.02, midZ)]);
    for (const s of [-1, 1]) {
      gParts.push([new THREE.BoxGeometry(0.038, wh, len + 0.04), zinc, M(gx + s * (U.width / 2 + 0.01), yA + wh / 2 - 0.01, midZ)]);
      gParts.push([new THREE.BoxGeometry(0.012, 0.008, len), lip, M(gx + s * (U.width / 2 + 0.02), yA + wh - 0.005, midZ)]);
    }
    gParts.push([new THREE.BoxGeometry(U.width + 0.28, 0.04, 0.45), zinc, M(gx, yA + 0.02, zLip0)]);
  }
  // plunge floor + walls (pitched)
  {
    const len = Math.hypot(0, zB - lipZ), pitch = -Math.atan2(yA - yB, len);
    const midZ = (lipZ + zB) / 2, midY = (yA + yB) / 2;
    gParts.push([new THREE.BoxGeometry(U.width + 0.08, 0.025, len + 0.1), zincD, M(gx, midY - 0.02, midZ, pitch, 0, 0)]);
    for (const s of [-1, 1]) {
      gParts.push([new THREE.BoxGeometry(0.038, wh, len + 0.05), zinc, M(gx + s * (U.width / 2 + 0.01), midY + wh / 2 - 0.01, midZ, pitch, 0, 0)]);
      gParts.push([new THREE.BoxGeometry(0.012, 0.008, len), lip, M(gx + s * (U.width / 2 + 0.02), midY + wh - 0.005, midZ, pitch, 0, 0)]);
    }
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x5fe8ff, toneMapped: false });
    for (const s of [-1, 1]) {
      const lipM = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.006, len), neonMat);
      lipM.position.set(gx + s * (U.width / 2 + 0.022), midY + wh, midZ);
      lipM.rotation.x = pitch; lipM.name = "gutter_neon"; root.add(lipM);
    }
  }
  const gutter = new THREE.Mesh(merged(gParts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  gutter.name = "gutter_trough"; root.add(gutter);

  // Soft rails are authored in loftSolids (lip + plunge); stash empty for API compat
  const soft = [];
  if (tracks) tracks._gutterSoft = soft;
  return { timber, gutter, soft };
}
