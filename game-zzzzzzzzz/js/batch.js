// logic12 STATIC BATCHER — the mansion built ~6.8k meshes with ~5.2k (mostly cloned) materials →
// ~1.4k draw calls per frame. After DriveWorld has scanned the scene, every plain static mesh in
// a room group is merged with its look-alikes (same material appearance) into one mesh per
// (room, look). Interactive curiosities, instanced/animated/transparent meshes are left alone.
import * as THREE from "three";

const SKIP_KEYS = ["objectId", "interactable", "def", "target", "layers", "layerIndex", "isRing", "isBevel", "isCutDisk", "clipPlane", "baseEmissive", "term", "mouseWorld", "noBatch"];
const hasTag = (o) => o.userData && SKIP_KEYS.some((k) => o.userData[k] != null);
const hex = (c) => (c && c.getHexString ? c.getHexString() : "-");
function matKey(m) {
  return [m.type, hex(m.color), hex(m.emissive), m.emissiveIntensity ?? "", m.map ? m.map.uuid : "", m.normalMap ? m.normalMap.uuid : "",
    m.roughness ?? "", m.metalness ?? "", m.side, m.vertexColors ? 1 : 0, m.flatShading ? 1 : 0, m.fog ? 1 : 0,
    m.polygonOffset ? `${m.polygonOffsetFactor},${m.polygonOffsetUnits}` : "", m.depthWrite ? 1 : 0, m.toneMapped ? 1 : 0, m.wireframe ? 1 : 0].join("|");
}
export function batchStatic(root) {
  root.updateMatrixWorld(true);
  const before = { meshes: 0, merged: 0, out: 0 };
  for (const group of root.children) {
    if (!group.isGroup && !group.isObject3D) continue;
    if (hasTag(group)) continue;
    const buckets = new Map();
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    group.traverse((o) => {
      if (!o.isMesh) return;
      before.meshes++;
      if (o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.material.transparent || o.morphTargetInfluences) return;
      for (let p = o; p && p !== group; p = p.parent) if (hasTag(p) || p.visible === false) return;
      if (o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
      const g = o.geometry; if (!g || !g.attributes.position || !g.attributes.normal || g.morphAttributes?.position) return;
      const k = matKey(o.material) + "|uv" + (g.attributes.uv ? 1 : 0) + "|vc" + (g.attributes.color ? 1 : 0) + "|cs" + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0);
      let b = buckets.get(k); if (!b) buckets.set(k, (b = { mat: o.material, list: [] }));
      b.list.push(o);
    });
    for (const b of buckets.values()) {
      if (b.list.length < 2) continue;
      let nV = 0; const parts = [];
      for (const o of b.list) {
        const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(m);
        if (m.determinant() < 0) { const pos = g.attributes.position.array; /* flip winding */ for (let i = 0; i < pos.length; i += 9) for (let j = 0; j < 3; j++) { const t = pos[i + 3 + j]; pos[i + 3 + j] = pos[i + 6 + j]; pos[i + 6 + j] = t; } for (const nm of ["normal", "uv", "color"]) { const at = g.attributes[nm]; if (!at) continue; const s = at.itemSize, a = at.array; for (let i = 0; i < a.length; i += 3 * s) for (let j = 0; j < s; j++) { const t = a[i + s + j]; a[i + s + j] = a[i + 2 * s + j]; a[i + 2 * s + j] = t; } } }
        parts.push(g); nV += g.attributes.position.count;
      }
      const out = new THREE.BufferGeometry();
      for (const nm of ["position", "normal", "uv", "color"]) {
        if (!parts[0].attributes[nm]) continue;
        const s = parts[0].attributes[nm].itemSize, arr = new Float32Array(nV * s); let off = 0;
        for (const g of parts) { arr.set(g.attributes[nm].array, off); off += g.attributes[nm].array.length; }
        out.setAttribute(nm, new THREE.BufferAttribute(arr, s));
      }
      out.computeBoundingSphere(); out.computeBoundingBox();
      const mesh = new THREE.Mesh(out, b.mat);
      mesh.name = "batch:" + (b.list[0].name || "static");
      mesh.castShadow = b.list[0].castShadow; mesh.receiveShadow = b.list[0].receiveShadow;
      mesh.userData.batched = b.list.length;
      for (const o of b.list) { o.parent.remove(o); }
      group.add(mesh);
      before.merged += b.list.length; before.out++;
    }
  }
  return before;
}
