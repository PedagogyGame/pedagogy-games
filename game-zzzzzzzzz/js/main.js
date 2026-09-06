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
const inspectPanel = document.getElementById("inspect-panel");
const layerTerm = document.getElementById("layer-term");
const layerDef = document.getElementById("layer-def");
const layerMeta = document.getElementById("layer-meta");
const sliceSlider = document.getElementById("slice-slider");
const objectTitle = document.getElementById("object-title");
const strataList = document.getElementById("strata-list");
const layerLooking = document.getElementById("layer-looking");

let mode = "title"; // title | roam | inspect
let hoverTarget = null;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0908);
scene.fog = new THREE.FogExp2(0x1a120e, 0.028);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 80);
const player = new Player(camera, document.body);
player.setPosition(0, 1.6, 3);

const hemi = new THREE.HemisphereLight(0xffe8d6, 0x1a120e, 0.55);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xb0c4de, 0.25);
moon.position.set(-10, 20, 8);
scene.add(moon);

const mansion = new Mansion(scene);
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
    if (e.code === "BracketLeft" || e.code === "Minus") slice.delta(-1);
    if (e.code === "BracketRight" || e.code === "Equal") slice.delta(1);
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

slice.onLayerChange = () => syncSliceUI();

function enterInspect(target) {
  const id = target.userData.objectId;
  const obj = target.userData.target || target;
  const def = OBJECTS[id];
  if (!def) return;
  // Ensure def is on the mesh group
  if (!obj.userData.def) obj.userData.def = def;
  if (!obj.userData.layers) {
    // hit proxy — find real object
    const real = mansion.getInteractives().find((o) => o.userData.layers && o.userData.objectId === id);
    if (!real) return;
    return enterInspect(real);
  }
  mode = "inspect";
  player.unlock();
  player.enabled = false;
  inspect.enter(obj);
  slice.attach(obj, scene);
  inspectPanel.classList.remove("hidden");
  promptEl.classList.add("hidden");
  objectTitle.textContent = def.name;
  sliceSlider.max = String(def.layers.length - 1);
  sliceSlider.value = "0";
  buildStrata(def);
  syncSliceUI();
}

function exitInspect() {
  slice.detach(scene);
  inspect.exit();
  inspectPanel.classList.add("hidden");
  promptEl.classList.remove("hidden");
  mode = "roam";
  player.enabled = true;
  player.lock();
}

function buildStrata(def) {
  strataList.innerHTML = "";
  def.layers.forEach((L, i) => {
    const li = document.createElement("button");
    li.type = "button";
    li.className = "strata-item";
    li.style.setProperty("--swatch", "#" + L.color.toString(16).padStart(6, "0"));
    li.textContent = L.hint ? `${i + 1}. ${L.term} (${L.hint})` : `${i + 1}. ${L.term}`;
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
  const hint = L.hint ? ` · ${L.hint}` : "";
  layerMeta.textContent = `Layer ${L.index + 1} of ${L.total} · Outside → in${hint}`;
  if (layerLooking) layerLooking.textContent = `You are looking at: ${L.term}`;
  sliceSlider.max = String(L.total - 1);
  sliceSlider.value = String(L.index);
  [...strataList.children].forEach((el, i) => {
    const on = i === L.index;
    el.classList.toggle("active", on);
    if (on) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

function currentRoomName(pos) {
  for (const room of Object.values(ROOMS)) {
    const [w, , d] = room.size;
    const [cx, , cz] = room.pos;
    if (pos.x > cx - w / 2 && pos.x < cx + w / 2 && pos.z > cz - d / 2 && pos.z < cz + d / 2) {
      return room.name;
    }
  }
  return "Mansion";
}

function updateHover() {
  if (mode !== "roam" || !player.locked) {
    hoverTarget = null;
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
    promptEl.textContent = `Click to inspect · ${def?.name || "Object"}`;
    promptEl.classList.add("lit");
  } else {
    hoverTarget = null;
    promptEl.textContent = "Explore the mansion · Walk to a pedestal";
    promptEl.classList.remove("lit");
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
    roomBadge.textContent = currentRoomName(player.position);
  } else if (mode === "inspect") {
    inspect.update();
    slice.update(t);
  }
  renderer.render(scene, camera);
}
tick();
