/** logic40: lazy-load Ben's museum cross-section GLBs into existing Explore inspect spots.
 * Units are metres, +Y up, ground at Y=0. One named mesh/group per peel_order layer.
 * The game generates its own slice caps; assets have none. Drive never starts a load.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

if (typeof globalThis.self === "undefined") globalThis.self = globalThis;

/** Node-only: GLTFLoader.parse needs Image + document.createElementNS("img").
 *  Never install this at module load — a stub document would clobber the
 *  sim-harness canvas mock (createElement("canvas").getContext).
 */
function ensureNodeImageShims() {
  if (typeof globalThis.window !== "undefined") return;
  if (typeof globalThis.Image === "undefined") {
    globalThis.Image = class Image {
      constructor() {
        this.width = 1; this.height = 1; this.naturalWidth = 1; this.naturalHeight = 1;
        this.complete = false; this._src = "";
      }
      set src(v) {
        this._src = v; this.complete = true;
        queueMicrotask(() => { if (this.onload) this.onload(); });
      }
      get src() { return this._src; }
      decode() { return Promise.resolve(); }
      addEventListener(type, fn) { if (type === "load") this.onload = fn; }
      removeEventListener() {}
    };
  }
  if (typeof globalThis.document === "undefined") {
    globalThis.document = {
      createElementNS() { return new globalThis.Image(); },
      createElement(name) {
        const n = String(name || "").toLowerCase();
        if (n === "canvas") {
          throw new Error("museumGlb: canvas requested before a document mock was installed");
        }
        return new globalThis.Image();
      },
    };
  } else if (typeof globalThis.document.createElementNS !== "function") {
    globalThis.document.createElementNS = () => new globalThis.Image();
  }
}

export const MUSEUM_OBJECTS = {
  piano: { file: "01_Grand_Piano.glb", size: [1.763, 1.003, 2.197], monument: true, placeholderLayers: 8 },
  violin: { file: "02_Violin.glb", size: [0.207, 0.087, 0.604], placeholderLayers: 6 },
  acoustic_guitar: { file: "03_Acoustic_Guitar.glb", size: [0.404, 0.134, 1.033], placeholderLayers: 6 },
  pocket_watch: { file: "04_Pocket_Watch.glb", size: [0.052, 0.017, 0.064], placeholderLayers: 8 },
  padlock: { file: "05_Pin_Tumbler_Padlock.glb", size: [0.052, 0.083, 0.026], placeholderLayers: 6 },
  combination_lock: { file: "06_Combination_Lock.glb", size: [0.058, 0.096, 0.035], placeholderLayers: 5 },
  sewing_machine: { file: "07_Sewing_Machine.glb", size: [0.418, 0.350, 0.190], placeholderLayers: 5 },
  slr_camera: { file: "08_SLR_Camera.glb", size: [0.146, 0.128, 0.120], placeholderLayers: 5 },
  walkman: { file: "09_Walkman.glb", size: [0.091, 0.125, 0.038], placeholderLayers: 5 },
  binoculars: { file: "10_Porro_Binoculars.glb", size: [0.162, 0.073, 0.198], placeholderLayers: 5 },
  spinning_reel: { file: "11_Spinning_Reel.glb", size: [0.125, 0.155, 0.173], placeholderLayers: 5 },
  hard_drive: { file: "12_Hard_Drive.glb", size: [0.102, 0.026, 0.148], placeholderLayers: 5 },
  dc_motor: { file: "13_Small_DC_Motor.glb", size: [0.038, 0.038, 0.070], placeholderLayers: 7 },
  music_box: { file: "14_Music_Box.glb", size: [0.151, 0.069, 0.100], placeholderLayers: 5 },
  metronome: { file: "15_Metronome.glb", size: [0.113, 0.227, 0.107], placeholderLayers: 6 },
  clarinet: { file: "16_Clarinet.glb", size: [0.074, 0.074, 0.668], placeholderLayers: 5 },
  super_soaker: { file: "17_Super_Soaker.glb", size: [0.431, 0.239, 0.072], placeholderLayers: 5 },
  nerf_blaster: { file: "18_Nerf_Blaster.glb", size: [0.328, 0.169, 0.050], placeholderLayers: 5 },
  cow_eye: { file: "19_Cow_Eye_Model.glb", size: [0.040, 0.040, 0.070], placeholderLayers: 6 },
  fountain_pen: { file: "20_Fountain_Pen.glb", size: [0.016, 0.019, 0.172], placeholderLayers: 5 },
};

const FURNITURE_XZ = {
  floor: [8, 8],
  rug: [2.2, 2.2],
  shelf: [1.0, 0.55],
  stand: [1.0, 0.55],
  table: [1.2, 0.75],
  bench: [1.2, 0.75],
  desk: [1.2, 0.75],
  pedestal: [0.72, 0.72],
};

const MIN_VISIBLE = 0.32; // metres — tiny curios (watch, lock, pen, eye) would vanish at 1:1
const MARGIN = 0.92;

const STUB_LAYER = { term: "Part", def: "", color: 0x888888, hint: "" };

export function isMuseumObject(id) {
  return !!MUSEUM_OBJECTS[id];
}

/** Def passed to the existing procedural builder so placeholder layer counts still match. */
export function museumPlaceholderDef(def) {
  const rec = MUSEUM_OBJECTS[def.id];
  if (!rec) return def;
  const n = rec.placeholderLayers;
  const layers = [];
  for (let i = 0; i < n; i++) layers.push(def.layers[i] || STUB_LAYER);
  return { ...def, layers, museumGlb: false };
}

export function museumFit(id, surface = "desk") {
  const rec = MUSEUM_OBJECTS[id];
  const [sx, sy, sz] = rec.size;
  const furniture = FURNITURE_XZ[surface] || FURNITURE_XZ.desk;
  const longF = Math.max(furniture[0], furniture[1]) * MARGIN;
  const shortF = Math.min(furniture[0], furniture[1]) * MARGIN;
  const longM = Math.max(sx, sz);
  const shortM = Math.min(sx, sz);
  const modelLongIsZ = sz >= sx;
  const furnLongIsX = furniture[0] >= furniture[1];
  let yaw = 0;
  if (modelLongIsZ && furnLongIsX) yaw = Math.PI / 2;
  else if (!modelLongIsZ && !furnLongIsX) yaw = Math.PI / 2;
  let s = 1;
  if (!(rec.monument || surface === "floor")) {
    if (longM > longF) s = Math.min(s, longF / longM);
    if (shortM > shortF) s = Math.min(s, shortF / shortM);
    const realMax = Math.max(sx, sy, sz);
    if (realMax * s < MIN_VISIBLE) s = MIN_VISIBLE / realMax;
  }
  return { scale: s, yaw };
}

const ASSET_BASE = new URL("../assets/museum/", import.meta.url).href;
const templateCache = new Map();

function cloneMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    if (Array.isArray(o.material)) o.material = o.material.map((m) => m.clone());
    else o.material = o.material.clone();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      m.clippingPlanes = [];
      m.clipShadows = true;
      m.needsUpdate = true;
    }
  });
}

function extractLayerNodes(scene) {
  const layers = [];
  const isLayer = (o) => o && (o.userData?.peel_order != null || /^\d{2}_/.test(o.name || ""));
  const walk = (node) => {
    if (node !== scene && isLayer(node)) {
      layers.push(node);
      return;
    }
    for (const c of node.children.slice()) walk(c);
  };
  walk(scene);
  layers.sort((a, b) => (a.userData.peel_order ?? 99) - (b.userData.peel_order ?? 99) || a.name.localeCompare(b.name));
  return layers;
}

function prepareTemplate(scene) {
  const root = new THREE.Group();
  root.name = "museumTemplate";
  const layers = extractLayerNodes(scene);
  for (let i = 0; i < layers.length; i++) {
    const src = layers[i];
    if (src.parent) src.parent.remove(src);
    src.userData.layerIndex = i;
    src.userData.peel_order = src.userData.peel_order ?? i + 1;
    src.position.set(0, 0, 0);
    // identity already; keep any baked mesh origin (Y=0 ground is in the verts)
    root.add(src);
  }
  cloneMaterials(root);
  root.userData.layerCount = layers.length;
  return root;
}

function applyLayerMeta(root, def) {
  const layers = root.children.slice().sort(
    (a, b) => (a.userData.peel_order ?? 99) - (b.userData.peel_order ?? 99)
  );
  for (let i = 0; i < layers.length; i++) {
    const term = def.layers[i]?.term || layers[i].name || `Layer ${i + 1}`;
    layers[i].userData.layerIndex = i;
    layers[i].userData.term = term;
    layers[i].name = `layer_${i}_${term}`;
  }
  return layers;
}

async function loadMuseumTemplateNode(rec) {
  ensureNodeImageShims();
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const dir = fileURLToPath(new URL("../assets/museum/", import.meta.url));
  const buf = fs.readFileSync(path.join(dir, rec.file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new GLTFLoader();
  const gltf = await new Promise((res, rej) => loader.parse(ab, path.join(dir, "/"), res, rej));
  return prepareTemplate(gltf.scene);
}

export function loadMuseumTemplate(id) {
  if (templateCache.has(id)) return templateCache.get(id);
  const rec = MUSEUM_OBJECTS[id];
  if (!rec) return Promise.reject(new Error(`unknown museum object ${id}`));
  const p = (async () => {
    // Sims may install a window mock; still read the file in Node so Drive/smoke never fetch().
    if (typeof process !== "undefined" && process.versions?.node) return loadMuseumTemplateNode(rec);
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(new URL(rec.file, ASSET_BASE).href);
    return prepareTemplate(gltf.scene);
  })();
  templateCache.set(id, p);
  return p;
}

/** Swap a procedural placeholder (same Group already in the scene) for the GLB layers. */
export async function hydrateMuseumObject(root, def, surface) {
  if (!root || !isMuseumObject(def.id)) return root;
  if (root.userData.museumReady) return root;
  if (root.userData._hydrating) return root.userData._hydrating;
  const job = (async () => {
    const tpl = await loadMuseumTemplate(def.id);
    for (const ch of root.children.slice()) root.remove(ch);
    const inst = tpl.clone(true);
    cloneMaterials(inst);
    for (const ch of inst.children.slice()) root.add(ch);
    const layers = applyLayerMeta(root, def);
    const fit = museumFit(def.id, surface || root.userData.surface || "desk");
    root.scale.set(1, 1, 1);
    root.rotation.set(0, fit.yaw, 0);
    root.scale.setScalar(fit.scale);
    root.userData.objectId = def.id;
    root.userData.layers = layers;
    root.userData.def = def;
    root.userData.museumReady = true;
    root.userData.museumPending = false;
    root.userData.museumScale = fit.scale;
    root.userData.museumYaw = fit.yaw;
    root.name = def.id;
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.visible = true;
      o.frustumCulled = true;
      o.castShadow = false;
      o.receiveShadow = true;
    });
    if (layers[0]) {
      layers[0].traverse((o) => { if (o.isMesh) o.castShadow = true; });
    }
    return root;
  })();
  root.userData._hydrating = job;
  try {
    await job;
  } finally {
    delete root.userData._hydrating;
  }
  return root;
}
