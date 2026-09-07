import * as THREE from "three";
import { Player } from "./player.js";
import { Mansion } from "./mansion.js";
import { InspectMode } from "./inspect.js";
import { SliceSystem } from "./slice.js";
import { OBJECTS } from "./data/objects.js";
import { ROOMS } from "./data/rooms.js";

const canvas = document.getElementById("c");
const titleScreen = document.getElementById("title-screen");
const hud = document.getElementById("hud");
const promptEl = document.getElementById("prompt");
const roomBadge = document.getElementById("room-badge");
const roomFloorEl = document.getElementById("room-floor");
const roomNameEl = document.getElementById("room-name");
const crosshair = document.getElementById("crosshair");
const inspectPanel = document.getElementById("inspect-panel");
const layerTerm = document.getElementById("layer-term");
const layerDef = document.getElementById("layer-def");
const layerMeta = document.getElementById("layer-meta");
const layerHint = document.getElementById("layer-hint");
const layerSwatch = document.getElementById("layer-swatch");
const sliceSlider = document.getElementById("slice-slider");
const sliceTicks = document.getElementById("slice-ticks");
const sliceCount = document.getElementById("slice-count");
const objectTitle = document.getElementById("object-title");
const objectRoom = document.getElementById("object-room");
const strataList = document.getElementById("strata-list");
const btnPrevLayer = document.getElementById("btn-prev-layer");
const btnNextLayer = document.getElementById("btn-next-layer");
const modeButtons = [...document.querySelectorAll(".mode-btn")];

let mode = "title"; // title | roam | inspect
let hoverTarget = null;
let inspectRoomLabel = "";

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" /* HD pass */ });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1224);
scene.fog = new THREE.FogExp2(0x1a1830, 0.0068);

const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.08, 240);
const player = new Player(camera, document.body);
const hemi = new THREE.HemisphereLight(0xc5d8f0, 0x1a2a18, 0.55);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xd0e4ff, 0.55);
moon.position.set(-18, 35, 12);
moon.castShadow = false;
scene.add(moon);
const moonFill = new THREE.DirectionalLight(0x6a8caf, 0.18);
moonFill.position.set(20, 12, -10);
scene.add(moonFill);

let mansion;
try {
  mansion = new Mansion(scene);
} catch (err) {
  console.error(err);
  const boot = document.getElementById("boot-error");
  if (boot) {
    boot.classList.remove("hidden");
    boot.textContent = "Failed to build the mansion: " + (err && err.message ? err.message : String(err));
  }
  throw err;
}
// Pass last known floorY so stacked stories don't steal ground sampling
player.getFloorY = (x, z) => mansion.getFloorY(x, z, player.floorY);
// Spawn on flat foyer near front door (not on stair foot)
player.setPosition(0, undefined, 11);
const inspect = new InspectMode(camera, canvas);
const slice = new SliceSystem();

const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();

document.getElementById("btn-enter").addEventListener("click", () => {
  titleScreen.classList.add("hidden");
  hud.classList.remove("hidden");
  mode = "roam";
  player.lock();
});

player.controls.addEventListener("unlock", () => {
  if (mode === "roam") {
    promptEl.textContent = "Click to look around · WASD to walk";
    promptEl.classList.remove("lit");
    crosshair.classList.remove("hot");
  }
});

canvas.addEventListener("click", () => {
  if (mode === "roam" && !player.locked) player.lock();
  else if (mode === "roam" && hoverTarget) enterInspect(hoverTarget);
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    if (mode === "inspect") exitInspect();
  }
  if (mode === "inspect") {
    if (e.code === "BracketLeft" || e.code === "Minus" || e.code === "ArrowLeft") {
      slice.delta(-1);
      syncSliceUI();
    }
    if (e.code === "BracketRight" || e.code === "Equal" || e.code === "ArrowRight") {
      slice.delta(1);
      syncSliceUI();
    }
  }
});

canvas.addEventListener(
  "wheel",
  (e) => {
    if (mode !== "inspect") return;
    e.preventDefault();
    slice.delta(e.deltaY > 0 ? 1 : -1);
    syncSliceUI();
  },
  { passive: false }
);

sliceSlider.addEventListener("input", () => {
  slice.setIndex(Number(sliceSlider.value));
  syncSliceUI();
});

btnPrevLayer?.addEventListener("click", () => {
  slice.delta(-1);
  syncSliceUI();
});
btnNextLayer?.addEventListener("click", () => {
  slice.delta(1);
  syncSliceUI();
});

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const m = btn.dataset.mode;
    slice.setMode(m);
    modeButtons.forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
    syncSliceUI();
  });
});

slice.onLayerChange = () => syncSliceUI();

function colorCss(hex) {
  return "#" + (hex >>> 0).toString(16).padStart(6, "0");
}

function enterInspect(target) {
  const id = target.userData.objectId;
  const obj = target.userData.target || target;
  const def = OBJECTS[id];
  if (!def) return;
  if (!obj.userData.def) obj.userData.def = def;
  if (!obj.userData.layers) {
    const real = mansion.getInteractives().find((o) => o.userData.layers && o.userData.objectId === id);
    if (!real) return;
    return enterInspect(real);
  }
  mode = "inspect";
  player.unlock();
  player.enabled = false;
  inspect.enter(obj, scene);
  slice.attach(obj, scene);
  inspectPanel.classList.remove("hidden");
  // next frame open transition
  requestAnimationFrame(() => inspectPanel.classList.add("open"));
  promptEl.classList.add("hidden");
  crosshair.classList.remove("hot");
  objectTitle.textContent = def.name;
  const room = mansion.getRoomAt(obj.position.x, obj.position.y, obj.position.z);
  inspectRoomLabel = room ? room.name : "Estate";
  if (objectRoom) objectRoom.textContent = inspectRoomLabel;
  sliceSlider.max = String(def.layers.length - 1);
  sliceSlider.value = "0";
  buildSliceTicks(def.layers.length);
  buildStrata(def);
  modeButtons.forEach((b) => b.classList.toggle("active", b.dataset.mode === slice.mode));
  syncSliceUI();
}

function exitInspect() {
  slice.detach(scene);
  inspect.exit(scene);
  inspectPanel.classList.remove("open");
  inspectPanel.classList.add("hidden");
  promptEl.classList.remove("hidden");
  mode = "roam";
  player.enabled = true;
  player.lock();
}

function buildSliceTicks(n) {
  if (!sliceTicks) return;
  sliceTicks.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const t = document.createElement("span");
    sliceTicks.appendChild(t);
  }
}

function buildStrata(def) {
  strataList.innerHTML = "";
  def.layers.forEach((L, i) => {
    const li = document.createElement("button");
    li.type = "button";
    li.className = "strata-item";
    li.style.setProperty("--swatch", colorCss(L.color));
    const num = document.createElement("span");
    num.className = "strata-num";
    num.textContent = `${i + 1}.`;
    li.appendChild(num);
    li.appendChild(document.createTextNode(` ${L.term}`));
    li.title = L.hint ? `${L.term} (${L.hint})` : L.term;
    li.addEventListener("click", () => {
      slice.setIndex(i);
      syncSliceUI();
    });
    strataList.appendChild(li);
  });
}

function syncSliceUI() {
  const L = slice.currentLayer();
  if (!L) return;
  layerTerm.textContent = L.term;
  layerDef.textContent = L.def;
  layerMeta.textContent = `Layer ${L.index + 1} of ${L.total} · Outside → in`;
  if (layerHint) {
    if (L.hint) {
      layerHint.textContent = L.hint;
      layerHint.classList.remove("hidden");
    } else {
      layerHint.textContent = "";
      layerHint.classList.add("hidden");
    }
  }
  if (layerSwatch) {
    const sw = colorCss(L.color);
    layerSwatch.style.setProperty("--swatch", sw);
    layerSwatch.style.background = sw;
  }
  sliceSlider.max = String(L.total - 1);
  sliceSlider.value = String(L.index);
  if (sliceCount) sliceCount.textContent = `${L.index + 1} / ${L.total}`;
  if (sliceTicks) {
    [...sliceTicks.children].forEach((el, i) => el.classList.toggle("on", i <= L.index));
  }
  [...strataList.children].forEach((el, i) => {
    const on = i === L.index;
    el.classList.toggle("active", on);
    if (on) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

function updateRoomBadge(pos) {
  const room = mansion.getRoomAt(pos.x, pos.y, pos.z);
  if (room) {
    if (roomFloorEl) roomFloorEl.textContent = room.floor || "Estate";
    if (roomNameEl) roomNameEl.textContent = room.name;
    else roomBadge.textContent = `${room.floor} · ${room.name}`;
  } else {
    if (roomFloorEl) roomFloorEl.textContent = "Estate";
    if (roomNameEl) roomNameEl.textContent = "Mansion of the Unseen";
    else roomBadge.textContent = "Mansion of the Unseen";
  }
}

function updateHover() {
  if (mode !== "roam" || !player.locked) {
    hoverTarget = null;
    crosshair.classList.remove("hot");
    return;
  }
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(mansion.getInteractives(), true);
  const hit = hits.find((h) => {
    let o = h.object;
    while (o) {
      if (o.userData?.interactable) return true;
      o = o.parent;
    }
    return false;
  });
  if (hit) {
    let o = hit.object;
    while (o && !o.userData?.objectId) o = o.parent;
    hoverTarget = o;
    const def = OBJECTS[o.userData.objectId];
    const name = def?.name || "Object";
    promptEl.textContent = `Click — Inspect ${name}`;
    promptEl.classList.add("lit");
    crosshair.classList.add("hot");
  } else {
    hoverTarget = null;
    promptEl.textContent = "Explore the mansion & gardens · Walk to a curiosity";
    promptEl.classList.remove("lit");
    crosshair.classList.remove("hot");
  }
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", onResize);

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (mode === "roam") {
    player.update(dt, mansion.getColliders());
    updateHover();
    updateRoomBadge(player.position);
    mansion.updateFireflies(t);
  } else if (mode === "inspect") {
    inspect.update();
    slice.update(t, dt);
  } else {
    mansion.updateFireflies(t);
  }
  renderer.render(scene, camera);
}
tick();
