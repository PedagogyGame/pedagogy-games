// logic11 MOUSE WORLD — a lived-in cartoony world inside the hollow walls.
// Props sit on the outer ~7 cm of each tube lane (lane centre stays clear), lit only by the
// existing neon (no lights). GPU-lite: 3 InstancedMeshes (box / cylinder / wedge) + 1 canvas tex.
import * as THREE from "three";

const RIDE = 0.012;
const C = {
  wood: 0x9a6a3a, match: 0xd9b27a, red: 0xc2362e, cloth1: 0x7d5ab8, cloth2: 0x3f8f8a, cloth3: 0xd4789a,
  cheese: 0xf3c33c, rind: 0xd99a20, metal: 0xb8bcc4, brass: 0xc9a043, thread1: 0x4e7fd1, thread2: 0xd14e6a,
  button1: 0xe2584a, button2: 0x5ab0e2, cap: 0x3aa64a, crumb: 0xc79a5c, sock: 0xe7e2d8, sockBand: 0x5a7ad8,
  coin: 0xd8b04a, pencil: 0xf2c230, lead: 0x333333, thimble: 0xa9adb5, pink: 0xf0a8b8,
};

function makeTex() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 128, 128);
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) { const v = 200 + r() * 55 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * 128, r() * 128, 1 + r() * 3, 1 + r() * 2); }
  g.strokeStyle = "rgba(0,0,0,0.12)"; for (let y = 0; y < 128; y += 16) { g.beginPath(); g.moveTo(0, y + r() * 3); g.lineTo(128, y + r() * 3); g.stroke(); } // weave/grain
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4;
  if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// parts: [shape, u(along), v(out from centre, +), y, sx, sy, sz, yaw, color]   shape b|c|w
const P = {
  matchboxBed: [["b", 0, 0, 0.018, 0.12, 0.036, 0.07, 0, C.red], ["b", 0, 0, 0.038, 0.11, 0.006, 0.062, 0, C.cloth1], ["b", -0.04, 0, 0.045, 0.03, 0.012, 0.05, 0, C.sock], ["b", 0.02, 0.005, 0.043, 0.06, 0.004, 0.066, 0.1, C.cloth3]],
  thimbleBed: [["c", 0, 0, 0.02, 0.05, 0.04, 0.05, 0, C.thimble], ["c", 0, 0, 0.042, 0.044, 0.006, 0.044, 0, C.cloth2], ["b", 0.03, 0.01, 0.004, 0.05, 0.004, 0.04, 0.5, C.cloth3]],
  cheese: [["w", 0, 0, 0.016, 0.06, 0.032, 0.06, 0.3, C.cheese], ["c", 0.012, 0.0, 0.03, 0.008, 0.002, 0.008, 0, C.rind]],
  trap: [["b", 0, 0, 0.005, 0.12, 0.01, 0.055, 0, C.wood], ["b", 0.02, 0, 0.016, 0.004, 0.012, 0.05, 0, C.metal], ["b", -0.02, 0, 0.012, 0.05, 0.003, 0.003, 0, C.metal], ["w", -0.035, 0, 0.014, 0.02, 0.01, 0.02, 0, C.cheese], ["b", 0.045, 0, 0.012, 0.004, 0.006, 0.05, 0, C.red]],
  spool: [["c", 0, 0, 0.004, 0.035, 0.008, 0.035, 0, C.wood], ["c", 0, 0, 0.026, 0.026, 0.036, 0.026, 0, C.thread1], ["c", 0, 0, 0.048, 0.035, 0.008, 0.035, 0, C.wood]],
  buttons: [["c", 0, 0, 0.003, 0.024, 0.006, 0.024, 0, C.button1], ["c", 0.04, 0.01, 0.003, 0.018, 0.006, 0.018, 0, C.button2], ["c", 0.02, -0.02, 0.009, 0.016, 0.006, 0.016, 0, C.brass]],
  cap: [["c", 0, 0, 0.007, 0.03, 0.014, 0.03, 0, C.cap], ["c", 0, 0, 0.0145, 0.026, 0.001, 0.026, 0, C.metal]],
  crumbs: [["b", 0, 0, 0.005, 0.012, 0.01, 0.01, 0.4, C.crumb], ["b", 0.02, 0.01, 0.004, 0.009, 0.008, 0.008, 1.1, C.crumb], ["b", -0.015, -0.012, 0.003, 0.007, 0.006, 0.007, 0.2, C.crumb], ["b", 0.035, -0.01, 0.003, 0.006, 0.005, 0.006, 0.8, C.crumb]],
  sock: [["b", 0, 0, 0.008, 0.16, 0.016, 0.05, 0.15, C.sock], ["b", 0.07, 0.02, 0.009, 0.05, 0.018, 0.055, 0.7, C.sock], ["b", -0.07, -0.01, 0.0095, 0.03, 0.019, 0.052, 0.15, C.sockBand]],
  coins: [["c", 0, 0, 0.0015, 0.022, 0.003, 0.022, 0, C.coin], ["c", 0.005, 0.003, 0.0045, 0.022, 0.003, 0.022, 0, C.coin], ["c", 0.035, -0.01, 0.0015, 0.018, 0.003, 0.018, 0, C.metal]],
  pencils: [["b", 0, 0, 0.005, 0.09, 0.01, 0.01, 0.2, C.pencil], ["b", 0.05, 0.01, 0.005, 0.012, 0.008, 0.008, 0.2, C.lead], ["b", 0.0, -0.025, 0.005, 0.06, 0.01, 0.01, -0.5, C.cloth2]],
  ladder: [["b", 0, -0.02, 0.06, 0.006, 0.12, 0.006, 0, C.match], ["b", 0, 0.02, 0.06, 0.006, 0.12, 0.006, 0, C.match], ...[0.02, 0.05, 0.08, 0.11].map((y) => ["b", 0, 0, y, 0.004, 0.004, 0.046, 0, C.match])],
  table: [["b", 0, 0, 0.032, 0.07, 0.005, 0.05, 0, C.match], ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ["b", a * 0.03, b * 0.02, 0.015, 0.004, 0.03, 0.004, 0, C.match]), ["c", 0, 0, 0.036, 0.012, 0.004, 0.012, 0, C.brass]],
};
P.dining = [...P.table, ["c", -0.055, 0, 0.012, 0.016, 0.024, 0.016, 0, C.thimble], ["c", 0.055, 0, 0.012, 0.016, 0.024, 0.016, 0, C.thimble], ["w", 0.01, 0.0, 0.043, 0.022, 0.012, 0.022, 0.5, C.cheese], ["b", -0.015, 0.012, 0.0355, 0.012, 0.002, 0.012, 0, C.crumb]];
P.stash = [...P.coins, ...P.buttons.map((q) => ["c", q[1] + 0.06, q[2], q[3] + 0.003, q[4], q[5], q[6], 0, q[8]]), ...P.crumbs.map((q) => ["b", q[1] - 0.06, q[2], q[3], q[4], q[5], q[6], q[7], q[8]]), ["c", -0.02, 0.015, 0.02, 0.012, 0.04, 0.012, 0, C.thread2]];
const ORDER = ["matchboxBed", "cheese", "spool", "crumbs", "trap", "buttons", "dining", "cap", "sock", "pencils", "thimbleBed", "coins", "ladder", "stash", "cheese", "table"];

function inOtherLane(segments, own, x, y, z, pad) {
  for (const q of segments) {
    if (q.pathId === own.pathId) continue;
    if (Math.max(q.a.x, q.b.x) + q.width < x || Math.min(q.a.x, q.b.x) - q.width > x || Math.max(q.a.z, q.b.z) + q.width < z || Math.min(q.a.z, q.b.z) - q.width > z) continue;
    const ax = q.b.x - q.a.x, az = q.b.z - q.a.z, L2 = ax * ax + az * az || 1e-9;
    const u = Math.max(0, Math.min(1, ((x - q.a.x) * ax + (z - q.a.z) * az) / L2));
    if (Math.hypot(x - (q.a.x + ax * u), z - (q.a.z + az * u)) > q.width / 2 + pad) continue;
    if (Math.abs(q.a.y + (q.b.y - q.a.y) * u - y) < 0.15) return true;
  }
  return false;
}

/** Deterministic layout (also used by DriveWorld for the mouse-trap bump surfaces). */
export function mouseWorldLayout(segments, tubeIds) {
  const segs = segments.filter((s) => tubeIds.has(s.pathId) || (s.pathId === "mouse_run" && Math.min(s.a.z, s.b.z) > 13.3));
  const parts = { b: [], c: [], w: [] }, traps = [];
  const placed = []; let acc = 0.4, side = 1, k = 0, last = null;
  for (const s of segs) {
    if (s.pathId !== last) { acc = 0.4; last = s.pathId; }
    const len = s.len || Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z);
    let t0 = 0;
    while (acc + (len - t0) >= 0.55) {
      t0 += 0.55 - acc; acc = 0;
      const f = t0 / len, x = s.a.x + (s.b.x - s.a.x) * f, z = s.a.z + (s.b.z - s.a.z) * f, y = s.a.y + (s.b.y - s.a.y) * f + RIDE;
      if (Math.abs(s.b.y - s.a.y) / len > 0.12) { side = -side; continue; } // steep climbs: keep bare
      const tx = s.dir ? s.dir.x : (s.b.x - s.a.x) / len, tz = s.dir ? s.dir.z : (s.b.z - s.a.z) / len;
      const kindNext = ORDER[k % ORDER.length];
      const nx = tz * side, nz = -tx * side, off = s.width / 2 - (kindNext === "trap" ? 0.12 : 0.07); // trap sits a car-width in from the rail
      const cx = x + nx * off, cz = z + nz * off;
      if (placed.some((q) => Math.hypot(q[0] - cx, q[1] - cz) < 0.3 && Math.abs(q[2] - y) < 0.2)) { side = -side; continue; }
      // logic28 obstruction audit: a prop may not sit in ANOTHER road's lane where a tube run meets / crosses it (they were
      // drive-through clutter on the Timber Shaft, Timber Attic, Roof Run, Sky Attic and the Timber lawn road).
      if (inOtherLane(segments, s, cx, y - RIDE, cz, 0.09)) { side = -side; continue; }
      placed.push([cx, cz, y]);
      const yaw = Math.atan2(tx, tz);
      const kind = ORDER[k++ % ORDER.length];
      if (kind === "trap") { // gentle bump: the trap base is a 1.6 cm drivable hump (≤ STEP_UP)
        const hx = 0.07, hz = 0.04, cs = Math.abs(tx), sn = Math.abs(tz);
        const ex = hx * sn + hz * cs, ez = hx * cs + hz * sn; // AABB of the rotated base
        traps.push({ minX: cx - ex, maxX: cx + ex, minZ: cz - ez, maxZ: cz + ez, y: y + 0.016, base: y - RIDE, dx: tx, dz: tz });
      }
      for (const [sh, u, v, py, sx, sy, sz, ry, col] of P[kind]) {
        const vv = v * side;
        parts[sh].push({ x: cx + tx * u + nx * vv, y: y + py, z: cz + tz * u + nz * vv, sx, sy, sz, yaw: yaw + ry, col });
      }
      side = -side;
    }
    acc += len - t0;
  }
  return { parts, traps, count: placed.length };
}

export function buildMouseWorld(tracks, tubeIds) {
  const { parts, count } = mouseWorldLayout(tracks.segments, tubeIds);
  const placed = { length: count };
  const root = new THREE.Group(); root.name = "mouse_world";
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: makeTex(), emissive: 0x2a2440 }); // faint neon bounce
  const geos = { b: new THREE.BoxGeometry(1, 1, 1), c: new THREE.CylinderGeometry(0.5, 0.5, 1, 14), w: new THREE.CylinderGeometry(0.5, 0.5, 1, 3) };
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color(), V = new THREE.Vector3(), S = new THREE.Vector3();
  for (const sh of ["b", "c", "w"]) {
    const L = parts[sh]; if (!L.length) continue;
    const im = new THREE.InstancedMesh(geos[sh], mat, L.length);
    L.forEach((p, i) => { q.setFromEuler(e.set(0, p.yaw, 0)); m.compose(V.set(p.x, p.y, p.z), q, S.set(p.sx, p.sy, p.sz)); im.setMatrixAt(i, m); im.setColorAt(i, col.setHex(p.col)); });
    im.name = "mouse_props_" + sh; im.userData.mouseWorld = true;
    root.add(im);
  }
  root.userData.propCount = placed.length;
  tracks.root.add(root);
  return root;
}
