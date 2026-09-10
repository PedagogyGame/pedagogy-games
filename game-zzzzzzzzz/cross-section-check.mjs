/**
 * Browser-free cross-section check: every OBJECTS def must build with matching
 * layers, and SliceSystem Section/Peel/Ghost must show real cut faces + layer
 * change at setSlice(0.25/0.5/0.75).
 */
import * as THREE from "./vendor/three.module.js";
import { OBJECTS } from "./js/data/objects.js";
import { buildLayerShells, isConcentricDef } from "./js/meshes.js";
import { SliceSystem } from "./js/slice.js";

const FRACS = [0.25, 0.5, 0.75];
const MODES = ["section", "peel", "ghost"];

function countMeshes(layer) {
  let n = 0;
  layer.traverse((o) => { if (o.isMesh) n++; });
  return n;
}

function cutDisks(slice) {
  if (!slice.cutFaces) return [];
  return slice.cutFaces.children.filter((c) => c.userData.isCutDisk);
}

function checkObject(id, def) {
  const failures = [];

  if (!def.layers || def.layers.length === 0) {
    return { id, ok: false, failures: ["empty layers"] };
  }

  let obj;
  try {
    obj = buildLayerShells(def);
  } catch (e) {
    return { id, ok: false, failures: [`build threw: ${e.message}`] };
  }

  const meshLayers = obj.userData.layers || [];
  if (meshLayers.length !== def.layers.length) {
    failures.push(`layer count mismatch mesh=${meshLayers.length} def=${def.layers.length}`);
  }
  if (meshLayers.length === 0) {
    return { id, ok: false, failures: [...failures, "no mesh layers"] };
  }
  for (let i = 0; i < meshLayers.length; i++) {
    if (countMeshes(meshLayers[i]) === 0) failures.push(`layer ${i} has zero meshes`);
  }

  const scene = new THREE.Scene();
  scene.add(obj);
  const slice = new SliceSystem();
  try {
    slice.attach(obj, scene);
  } catch (e) {
    return { id, ok: false, failures: [...failures, `attach threw: ${e.message}`] };
  }

  if (!slice.cutFaces) failures.push("attach did not create cutFaces");
  const disks0 = cutDisks(slice);
  if (disks0.length < def.layers.length) {
    failures.push(`cut disks ${disks0.length} < layers ${def.layers.length}`);
  }

  // Annuli must have area (rOuter > rInner for non-core)
  for (const d of disks0) {
    const ro = d.userData.rOuter ?? 0;
    const ri = d.userData.rInner ?? 0;
    if (ro < 0.03) failures.push(`cut disk layer ${d.userData.layerIndex} rOuter too small (${ro})`);
    if (d.userData.layerIndex < def.layers.length - 1 && ri >= ro) {
      failures.push(`cut annulus layer ${d.userData.layerIndex} ri>=ro`);
    }
  }

  let missingClip = 0;
  for (const layer of meshLayers) {
    layer.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m.clippingPlanes?.length) missingClip++;
      }
    });
  }
  if (missingClip > 0) failures.push(`${missingClip} materials missing clippingPlanes`);

  const n = def.layers.length;
  const seen = new Map(); // mode -> list of visible-layer bitsets / active disk

  for (const mode of MODES) {
    slice.setMode(mode);
    for (const frac of FRACS) {
      slice.setSlice(frac);
      slice._apply(true);
      const index = slice.index;

      if (!slice.cutFaces?.visible) {
        failures.push(`${mode}@${frac}: cutFaces group not visible`);
      }
      const disks = cutDisks(slice);
      const active = disks.find((d) => d.userData.layerIndex === index);
      if (!active?.visible) {
        failures.push(`${mode}@${frac}: active cut face hidden (index ${index})`);
      }
      // At least one cut face visible
      if (!disks.some((d) => d.visible)) {
        failures.push(`${mode}@${frac}: no cut faces visible`);
      }

      if (mode === "section") {
        if (index > 0 && meshLayers[0].visible) {
          failures.push(`section@${frac}: outer layer still visible`);
        }
        if (!meshLayers[index].visible) {
          failures.push(`section@${frac}: active layer not visible`);
        }
        // Outer cut annuli must be hidden once peeled past
        for (const d of disks) {
          if (d.userData.layerIndex < index && d.visible) {
            failures.push(`section@${frac}: outer cut face ${d.userData.layerIndex} still visible`);
          }
        }
      }

      if (mode === "peel" && index > 0) {
        let outerOp = 1;
        meshLayers[0].traverse((o) => {
          if (!o.isMesh || !o.material) return;
          const m = Array.isArray(o.material) ? o.material[0] : o.material;
          if (m) outerOp = Math.min(outerOp, m.opacity ?? 1);
        });
        if (outerOp > 0.35) failures.push(`peel@${frac}: outer opacity still high (${outerOp.toFixed(2)})`);
      }

      if (mode === "ghost" && index > 0) {
        let sawWire = false;
        meshLayers[0].traverse((o) => {
          if (!o.isMesh || !o.material) return;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            if (m.wireframe) sawWire = true;
          }
        });
        if (!sawWire) failures.push(`ghost@${frac}: outer not wireframed`);
      }

      const visKey = meshLayers.map((l) => (l.visible ? "1" : "0")).join("");
      if (!seen.has(mode)) seen.set(mode, new Set());
      seen.get(mode).add(`${index}:${visKey}`);
    }
  }

  // Fracs must produce distinct layer indices when n >= 3
  if (n >= 3) {
    const idxs = FRACS.map((f) => {
      slice.setSlice(f);
      return slice.index;
    });
    if (new Set(idxs).size < 2) {
      failures.push(`setSlice fracs collapsed to one index: ${idxs.join(",")}`);
    }
  }

  // Solid section mats must not be forced transparent at index 0
  slice.setMode("section");
  slice.setSlice(0);
  slice._apply(true);
  let badTransparent = 0;
  for (const layer of meshLayers) {
    layer.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if ((m.opacity ?? 1) >= 0.99 && m.transparent) badTransparent++;
      }
    });
  }
  if (badTransparent > 0) {
    failures.push(`solid section mats forced transparent (${badTransparent})`);
  }

  // Multiple strata visible on cut at slice 0 (annuli)
  const disksAt0 = cutDisks(slice);
  const visDisks = disksAt0.filter((d) => d.visible).length;
  if (visDisks < Math.min(def.layers.length, 2)) {
    failures.push(`section@0: only ${visDisks} cut faces visible (want nested strata)`);
  }

  slice.detach(scene);
  scene.remove(obj);

  return {
    id,
    ok: failures.length === 0,
    failures,
    meta: { concentric: isConcentricDef(def), layers: n, disks: disks0.length },
  };
}

const results = Object.keys(OBJECTS).map((id) => checkObject(id, OBJECTS[id]));
const pass = results.filter((r) => r.ok);
const fail = results.filter((r) => !r.ok);

console.log(JSON.stringify({
  total: results.length,
  pass: pass.length,
  fail: fail.length,
  failures: fail.map((r) => ({ id: r.id, reasons: r.failures })),
}, null, 2));

if (fail.length) process.exitCode = 1;
else console.log(`ALL ${pass.length} OBJECTS PASS cross-section check`);
