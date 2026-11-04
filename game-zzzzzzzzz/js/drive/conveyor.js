import * as THREE from "three";
import { CONVEYOR, conveyorFrame, ROOF_LIFT } from "../data/loftNet.js?v=logic33";

/**
 * logic14 PADDLE CONVEYOR visuals (Drive-only secret layer). GPU-lite: 2 pulley meshes, one
 * InstancedMesh of belt links, one InstancedMesh of flaps, one merged static frame. Lambert,
 * no lights. update(t) poses everything from the SAME clock the physics uses (world.conveyor.t),
 * so a car standing on a flap moves exactly with it.
 */
function merged(list) {
  const pos = [], nor = [];
  for (const [geo, m] of list) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(m);
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.computeBoundingSphere();
  return out;
}
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);

export function buildConveyor(root) {
  const K = CONVEYOR, H = K.yT - K.yB, L = 2 * H + 2 * Math.PI * K.Rp;
  const g = new THREE.Group(); g.name = "conveyor";
  const iron = new THREE.MeshLambertMaterial({ color: 0x2e2a30 });
  const brass = new THREE.MeshLambertMaterial({ color: 0x5fb8c8, emissive: 0x062a2e }); // logic16: teal steel (was brass)
  const flapMat = new THREE.MeshLambertMaterial({ color: 0xd9a441, emissive: 0x24180a });
  const beltMat = new THREE.MeshLambertMaterial({ color: 0x4a3b2c });
  const cx = (K.flapX0 + K.flapX1) / 2, W = K.flapX1 - K.flapX0; // flap visual x span
  // pulleys: drum + two sprocket rims + spokes, axis along x
  const pg = [];
  const drum = new THREE.CylinderGeometry(K.Rp * 0.82, K.Rp * 0.82, W - 0.06, 20); pg.push([drum, new THREE.Matrix4().makeRotationZ(Math.PI / 2)]);
  for (const sx of [-W / 2 + 0.02, W / 2 - 0.02]) {
    pg.push([new THREE.CylinderGeometry(K.Rp, K.Rp, 0.025, 20), new THREE.Matrix4().makeRotationZ(Math.PI / 2).premultiply(T(sx, 0, 0))]);
    for (let k = 0; k < 3; k++) pg.push([new THREE.BoxGeometry(0.03, K.Rp * 2.15, 0.035), new THREE.Matrix4().makeRotationX(k * Math.PI / 3).premultiply(T(sx + Math.sign(sx) * 0.02, 0, 0))]);
  }
  const pulleyGeo = merged(pg);
  const pulleys = [K.yB, K.yT].map((y, i) => { const m = new THREE.Mesh(pulleyGeo, brass); m.position.set(cx, y, K.zc); m.name = i ? "conveyor_pulley_top" : "conveyor_pulley_bottom"; g.add(m); return m; });
  // static frame: side channels, axles, a cross-beam the chandelier chains hang from, cage posts
  const fr = [];
  for (const sx of [cx - W / 2 - 0.035, cx + W / 2 + 0.035]) {
    fr.push([new THREE.BoxGeometry(0.022, H + 0.5, 0.04), T(sx, (K.yB + K.yT) / 2, K.zc - 0.05)]);
    for (const y of [K.yB, K.yT]) fr.push([new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), new THREE.Matrix4().makeRotationZ(Math.PI / 2).premultiply(T(sx, y, K.zc))]);
  }
  for (const y of [K.yB, K.yT]) fr.push([new THREE.CylinderGeometry(0.018, 0.018, W + 0.12, 8), new THREE.Matrix4().makeRotationZ(Math.PI / 2).premultiply(T(cx, y, K.zc))]);
  fr.push([new THREE.BoxGeometry(W + 0.14, 0.04, 0.05), T(cx, 8.2, K.zc - 0.06)]);
  for (const [x, z] of [[1.765, 4.755], [2.77, 4.755]]) fr.push([new THREE.BoxGeometry(0.025, H - 0.4, 0.025), T(x, 7.95 + (H - 0.4) / 2, z)]);
  // logic14: brass discs mark the roof lift pads (replaces the neon shaft frame)
  for (const y of [ROOF_LIFT.padY, ROOF_LIFT.topY]) fr.push([new THREE.CylinderGeometry(0.27, 0.27, 0.006, 24), T(ROOF_LIFT.pad.x, y + 0.012 + 0.0045, ROOF_LIFT.pad.z)]);
  const frame = new THREE.Mesh(merged(fr), iron); frame.name = "conveyor_frame"; g.add(frame);
  const padDisc = frame; void padDisc;
  // belt links
  const nLinks = Math.round(L / 0.085);
  const links = new THREE.InstancedMesh(new THREE.BoxGeometry(W - 0.04, 0.014, 0.07), beltMat, nLinks);
  links.name = "conveyor_belt"; links.frustumCulled = false; g.add(links);
  // flaps: plate (top at local y=0, extends local +z) + raised tip lip + hinge barrel
  const fl = [
    [new THREE.BoxGeometry(W, 0.026, K.flapL), T(0, -0.013, K.flapL / 2)],
    [new THREE.BoxGeometry(W, 0.03, 0.025), T(0, 0.004, K.flapL - 0.0125)],
    [new THREE.CylinderGeometry(0.018, 0.018, W, 8), new THREE.Matrix4().makeRotationZ(Math.PI / 2).premultiply(T(0, -0.012, 0.0))],
  ];
  const flaps = new THREE.InstancedMesh(merged(fl), flapMat, K.n);
  flaps.name = "conveyor_flaps"; flaps.frustumCulled = false; g.add(flaps);
  root.add(g);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const api = {
    group: g, flaps, links, pulleys,
    update(t) {
      const s = K.v * t;
      for (const p of pulleys) p.rotation.x = -s / K.Rp;
      for (let i = 0; i < nLinks; i++) {
        const f = conveyorFrame(s + (i * L) / nLinks);
        e.set(Math.atan2(-f.ty, f.tz), 0, 0); q.setFromEuler(e);
        v.set(cx, f.y - f.ny * 0.008, f.z - f.nz * 0.008);
        links.setMatrixAt(i, m.compose(v, q, one));
      }
      links.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < K.n; i++) {
        const f = conveyorFrame(s + (i * L) / K.n);
        const dy = f.ny * (1 - f.fold) - f.ty * f.fold, dz = f.nz * (1 - f.fold) - f.tz * f.fold;
        e.set(Math.atan2(-dy, dz), 0, 0); q.setFromEuler(e);
        v.set(cx, f.y, f.z);
        flaps.setMatrixAt(i, m.compose(v, q, one));
      }
      flaps.instanceMatrix.needsUpdate = true;
    },
  };
  api.update(0);
  return api;
}
