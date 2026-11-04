import * as THREE from "three";
import { TIMBER, GUTTER } from "../data/loftNet.js?v=logic31";

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

export const TIMBER_BRACES_DROPPED = (globalThis.__TIMBER_BRACES_DROPPED = []);
export function buildTimberAndGutter(root, tracks) {
  const T = TIMBER, U = GUTTER;
  const wood = 0x3a2a1a, woodD = 0x2a1c12, woodL = 0x5a4030, bat = 0x6b5a3e, wire = 0x2a2e34, rust = 0x5a3a22;
  const parts = [];
  const box = (sx, sy, sz, col, x, y, z, ry = 0) => parts.push([new THREE.BoxGeometry(sx, sy, sz), col, M(x, y, z, 0, ry, 0)]);
  // ── TIMBER SHAFT framing in the east cavity ──
  const xI = T.xInner, xO = T.xOuter, z0 = T.zN - 0.4, z1 = T.zS + 0.4;
  // Vertical studs every ~1.1 m on both cavity faces
  for (let z = z0; z <= z1; z += 1.1) {
    const top = z < T.zN + 0.75 ? T.yT - 0.08 : 8.6; // logic24: under the Timber Attic crossing the studs stop below its deck
    box(0.08, top, 0.1, wood, xI + 0.04, top / 2, z);
    box(0.08, top, 0.1, woodD, xO - 0.04, top / 2, z);
  }
  // logic24 (Ben t188u "drove through what looked like a wall"): the story ledgers used to be full-width slabs
  // with cross joists spanning the cavity — the shaft lanes ran straight through them, and the diagonal braces
  // crossed both lanes. Now everything hugs the two cavity faces: ledger strips + braces in the wall planes.
  for (const y of [0.15, 3.35, 6.7, 8.35]) for (let z = z0; z < z1 - 1e-6; z += 1.1) { // in 1.1 m runs so branch mouths can drop a piece
    const L = Math.min(1.1, z1 - z);
    box(0.06, 0.1, L, woodL, xI + 0.03, y, z + L / 2);
    box(0.06, 0.1, L, woodL, xO - 0.07, y, z + L / 2);
  }
  const braces = []; // logic28: diagonal braces, checked against the lanes as true slanted bars below
  for (let z = z0; z < z1 - 1.2; z += 2.2) {
    const mid = z + 1.1, h = 3.2;
    for (const y0 of [0.2, 3.4]) {
      const L = Math.hypot(1.1, h), ang = Math.atan2(h, 1.1);
      parts.push([new THREE.BoxGeometry(0.04, L, 0.06), woodD, M(xI + 0.07, y0 + h / 2, mid, ang - Math.PI / 2, 0, 0)]);
      braces.push({ g: parts[parts.length - 1][0], x: xI + 0.07, y0, z0: mid + 0.55, y1: y0 + h, z1: mid - 0.55 });
      parts.push([new THREE.BoxGeometry(0.04, L, 0.06), woodD, M(xO - 0.07, y0 + h / 2, mid, -ang + Math.PI / 2, 0, 0)]);
      braces.push({ g: parts[parts.length - 1][0], x: xO - 0.07, y0, z0: mid - 0.55, y1: y0 + h, z1: mid + 0.55 });
    }
  }
  // logic24: boards closing the cavity-floor pockets beside the shaft-foot lane, under the header (colliders in loftSolids)
  for (const [xa, xb] of [[24.40, 24.535], [25.315, 26.4]]) box(xb - xa, 0.6, 0.1, woodL, (xa + xb) / 2, 0.25, 13.35);
  // Insulation batting scraps (soft yellow-brown pads between studs)
  let sd = 11; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 28; i++) {
    const z = z0 + 0.4 + rnd() * (z1 - z0 - 0.8), y = 0.4 + rnd() * 7.5;
    box(0.04, 0.35 + rnd() * 0.5, 0.55 + rnd() * 0.4, bat, rnd() > 0.5 ? xI + 0.1 : xO - 0.08, y, z); // logic24: outer pads flush to the shell face
  }
  // Wiring runs (thin dark cables along joists)
  for (let i = 0; i < 6; i++) {
    const y = 1.2 + i * 1.2;
    for (let z = z0 + 0.5; z < z1 - 0.5 - 1e-6; z += 1.1) { const L = Math.min(1.1, z1 - 0.5 - z); // logic24: inner face, in runs
      box(0.02, 0.02, L, wire, xI + 0.09 + (i % 2) * 0.02, y, z + L / 2); }
  }
  // A few hanging scrap planks / blocking
  for (let i = 0; i < 10; i++) {
    const z = z0 + 1 + rnd() * (z1 - z0 - 2), y = 1 + rnd() * 6;
    const hgt = 0.5 + rnd() * 0.8, side = rnd() - 0.5; rnd(); // logic24: blocking sits on the cavity faces, not in the lanes
    box(0.03, hgt, 0.12, woodL, side < 0 ? xI + 0.065 : xO - 0.065, y, z);
  }
  // logic24 (Ben t188u): nothing of the framing may stand in a lane's car band — the branch roads (Timber G / F, the
  // Attic) pass through the cavity faces, and studs / ledgers / pads used to run straight across their mouths.
  {
    const lanes = (tracks && tracks.segments ? tracks.segments : []).filter((q) => /^(timber_|gutter)/.test(q.pathId));
    const pts = [];
    for (const q of lanes) { const n = Math.max(2, Math.ceil(q.len / 0.05)); for (let i = 0; i <= n; i++) { const t = i / n;
      const cx = q.a.x + (q.b.x - q.a.x) * t, cz = q.a.z + (q.b.z - q.a.z) * t, cy = q.a.y + (q.b.y - q.a.y) * t;
      for (let k = -10; k <= 10; k++) { const o = k / 20; pts.push([cx + q.dir.z * o * (q.width - 0.02), cy, cz - q.dir.x * o * (q.width - 0.02)]); } } }
    const bb = new THREE.Box3();
    for (let i = parts.length - 1; i >= 0; i--) {
      const [g, , m] = parts[i]; g.computeBoundingBox(); bb.copy(g.boundingBox).applyMatrix4(m);
      if (pts.some(([x, y, z]) => x > bb.min.x - 0.005 && x < bb.max.x + 0.005 && z > bb.min.z - 0.005 && z < bb.max.z + 0.005 && bb.max.y > y + 0.005 && bb.min.y < y + 0.16)) parts.splice(i, 1);
    }
    // logic28 (Ben 12:14 PM: "dark timber X-bracing near the timber ramp" read as a drive-through blocker): the AABB
    // test above can't judge a slanted bar — a brace whose box missed the 16 cm car band still crossed in front of the
    // car a little higher up. Test the real diagonal: drop any brace within 4 cm of a lane point's 0–0.45 m headroom.
    const near = (B, x, y, z) => { if (Math.abs(x - B.x) > 0.06) return false;
      const ay = B.y1 - B.y0, az = B.z1 - B.z0, L2 = ay * ay + az * az;
      for (const yy of [y + 0.03, y + 0.15, y + 0.3, y + 0.45]) { const u = Math.max(0, Math.min(1, ((yy - B.y0) * ay + (z - B.z0) * az) / L2));
        if (Math.hypot(yy - (B.y0 + ay * u), z - (B.z0 + az * u)) < 0.04 + 0.035) return true; }
      return false; };
    for (const B of braces) {
      const hit = pts.some(([x, y, z]) => near(B, x, y, z));
      if (hit) { const i = parts.findIndex((q) => q[0] === B.g); if (i >= 0) { parts.splice(i, 1); TIMBER_BRACES_DROPPED.push({ x: B.x, y0: B.y0, z: (B.z0 + B.z1) / 2 }); } }
    }
  }
  { // logic27: slanted guide board + a dark trim strip (added after the lane-mouth filter, whose AABB test would drop a slanted board; closes the deck cul-de-sac beside the lane foot; collider in loftNet)
    const x0 = 25.335, z0 = 14.22, x1 = 26.27, z1 = 15.62, L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    box(0.06, 0.6, L, woodL, (x0 + x1) / 2, 0.3, (z0 + z1) / 2, ry);
    box(0.07, 0.05, L + 0.02, woodD, (x0 + x1) / 2, 0.58, (z0 + z1) / 2, ry);
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
    // logic23 (Ben t187u "a barrier here which you can drive through"): the WEST lip wall used to start at the
    // trough's north end, right across the mouth where the Gutter Entry arc drives in — its physics rail
    // (loftSolids) already started after the arc, so the wall was visual-only. It now starts where the rail does.
    const zArc = T.zN + (U.x - T.x - 0.5);
    for (const s of [-1, 1]) {
      const z0 = s < 0 ? Math.max(zLip0, zArc - 0.05) : zLip0, L = Math.abs(lipZ - z0), mz = (z0 + lipZ) / 2;
      gParts.push([new THREE.BoxGeometry(0.038, wh, L + (s < 0 ? 0 : 0.04)), zinc, M(gx + s * (U.width / 2 + 0.01), yA + wh / 2 - 0.01, mz + (s < 0 ? 0.0 : 0))]);
      gParts.push([new THREE.BoxGeometry(0.012, 0.008, L), lip, M(gx + s * (U.width / 2 + 0.02), yA + wh - 0.005, mz)]);
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
