import * as THREE from "three";
import { Player } from "./player.js";
import { Mansion } from "./mansion.js";
import { InspectMode } from "./inspect.js";
import { SliceSystem } from "./slice.js";
import { DriveMode } from "./drive/driveMode.js";
import { VEHICLE_PRESETS } from "./drive/car.js";
import { OBJECTS } from "./data/objects.js";
import { ROOM_PURPOSES } from "./data/rooms.js";

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
const playModeButtons = [...document.querySelectorAll("[data-play-mode]")];
const driveHud = document.getElementById("drive-hud");
const speedoEl = document.getElementById("speedo");
const driveToast = document.getElementById("drive-toast");
const driveBadge = document.getElementById("drive-badge");
const driveModeLabel = document.getElementById("drive-mode-label");
const driveCrashBanner = document.getElementById("drive-crash-banner");
const btnEnter = document.getElementById("btn-enter");
const bootErrorEl = document.getElementById("boot-error");
const boot = window.__MOTU_BOOT__ || (window.__MOTU_BOOT__ = {
  pendingEnter: false,
  ready: false,
  failed: false,
});

/** @type {'explore' | 'drive'} */
let playMode = "explore";
let mode = "title"; // title | roam | inspect | drive
let hoverTarget = null;
let inspectRoomLabel = "";
let lastRoomId = null;
let roomWhisperUntil = 0;
const _glintMats = new Map(); // objectId -> materials we've tagged
let mansion = null;
let inspect = null;
let slice = null;
let drive = null;

const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();

function showBootError(err) {
  boot.failed = true;
  boot.ready = false;
  console.error(err);
  if (bootErrorEl) {
    bootErrorEl.classList.remove("hidden");
    bootErrorEl.textContent =
      "Failed to build the mansion: " + (err && err.message ? err.message : String(err));
  }
  if (btnEnter) {
    btnEnter.disabled = true;
    btnEnter.setAttribute("aria-busy", "false");
    btnEnter.textContent = "Estate unavailable";
  }
}

function setEnterLoading(label = "Preparing estate…") {
  if (!btnEnter) return;
  btnEnter.disabled = true;
  btnEnter.setAttribute("aria-busy", "true");
  btnEnter.textContent = label;
}

function setEnterReady() {
  boot.ready = true;
  boot.failed = false;
  if (!btnEnter) return;
  btnEnter.disabled = false;
  btnEnter.setAttribute("aria-busy", "false");
  btnEnter.textContent = "Enter the Estate";
}

function syncVehicleUI(id) {
  document.querySelectorAll("[data-vehicle]").forEach((b) => {
    b.classList.toggle("active", b.dataset.vehicle === id);
  });
}

function setVehicle(id) {
  if (!drive || !VEHICLE_PRESETS[id]) return;
  drive.setVehicle(id);
  syncVehicleUI(id);
}

function syncPlayModeUI() {
  playModeButtons.forEach((b) => {
    b.classList.toggle("active", b.dataset.playMode === playMode);
  });
  if (driveHud) driveHud.classList.toggle("hidden", playMode !== "drive");
  if (driveBadge) driveBadge.classList.toggle("hidden", playMode !== "drive");
  if (crosshair) crosshair.classList.toggle("hidden", playMode === "drive");
}

function setPlayMode(next) {
  if (!mansion || !drive || boot.failed) return;
  if (next !== "explore" && next !== "drive") return;
  if (next === playMode && mode !== "title") {
    syncPlayModeUI();
    return;
  }

  if (mode === "inspect") exitInspect(false);

  if (next === "drive") {
    player.unlock();
    player.enabled = false;
    if (drive.active) drive.exit();
    const vBtn = document.querySelector(
      "#vehicle-picker .vehicle-btn.active, #drive-vehicle-picker .vehicle-btn.active"
    );
    if (vBtn?.dataset?.vehicle) drive.vehicleId = vBtn.dataset.vehicle;
    drive.enter();
    syncVehicleUI(drive.vehicleId);
    playMode = "drive";
    mode = "drive";
    clearCuriosityGlints();
    promptEl.textContent =
      "Toy tour of the house · WASD cruise · Shift boost (treat) · Follow glowing ramps";
    promptEl.classList.remove("lit", "hidden");
  } else {
    if (drive.active) drive.exit();
    playMode = "explore";
    mode = "roam";
    player.enabled = true;
    // Fair handoff: keep stroll spawn near foyer if player was far / mid-air from drive cam
    const p = player.position;
    if (!Number.isFinite(p.x) || Math.abs(p.y) > 20) {
      player.setPosition(0, undefined, 11);
    } else {
      // Re-ground feet after drive camera hijack
      player.setPosition(p.x, undefined, p.z);
    }
    camera.position.copy(player.position);
    camera.fov = 68;
    camera.updateProjectionMatrix();
    player.lock();
    promptEl.textContent = "Wander & wonder · Walk to a curiosity · Shift brisk walk";
    promptEl.classList.remove("lit", "hidden");
    lastRoomId = null;
  }
  syncPlayModeUI();
}

/** Hide title and start explore/drive. Safe only after boot.ready. */
function enterEstate() {
  if (boot.failed || !boot.ready || !mansion || !drive) return;
  titleScreen.classList.add("hidden");
  titleScreen.setAttribute("aria-hidden", "true");
  if (bootErrorEl) bootErrorEl.classList.add("hidden");
  hud.classList.remove("hidden");
  const titleActive = document.querySelector("#title-mode-toggle .play-mode-btn.active");
  const startMode = titleActive?.dataset?.playMode || "explore";
  setPlayMode(startMode === "drive" ? "drive" : "explore");
}

window.__MOTU_ENTER__ = enterEstate;
setEnterLoading();

// Enter wired immediately (also via HTML stub → window.__MOTU_ENTER__)
btnEnter?.addEventListener("click", () => {
  if (boot.ready && !boot.failed) enterEstate();
  else if (!boot.failed) boot.pendingEnter = true;
});

// Vehicle picker on title must not swallow Enter; stopPropagation stays on vehicle only
document.querySelectorAll("[data-vehicle]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setVehicle(btn.dataset.vehicle);
  });
});

playModeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (mode === "title") {
      playModeButtons.forEach((b) => {
        b.classList.toggle("active", b.dataset.playMode === btn.dataset.playMode);
      });
      return;
    }
    setPlayMode(btn.dataset.playMode);
  });
});

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance" /* HD pass */,
});
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

// Yield so title + disabled "Preparing…" can paint before the heavy mansion build.
const bootT0 = performance.now();
await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

try {
  const tBuild = performance.now();
  mansion = new Mansion(scene);
  console.info(
    `[motu] mansion build ${(performance.now() - tBuild).toFixed(0)}ms (pre-build wait ${(tBuild - bootT0).toFixed(0)}ms)`
  );
} catch (err) {
  showBootError(err);
}

if (mansion && !boot.failed) {
  player.getFloorY = (x, z) => mansion.getFloorY(x, z, player.floorY);
  player.setPosition(0, undefined, 11);
  try {
    inspect = new InspectMode(camera, canvas);
    slice = new SliceSystem();
    drive = new DriveMode(scene, camera);
  } catch (err) {
    showBootError(err);
  }
}

if (!boot.failed && mansion && drive && inspect && slice) {
  drive.onSpeed = (kmh) => {
    if (speedoEl) speedoEl.textContent = `${Math.round(kmh)} km/h`;
  };
  drive.onCheckpoint = (label, meta = {}) => {
    if (!driveToast) return;
    driveToast.textContent = meta.shortcut ? label : `Entering ${label}`;
    driveToast.classList.toggle("shortcut", !!meta.shortcut);
    driveToast.classList.add("show");
    clearTimeout(driveToast._t);
    driveToast._t = setTimeout(() => {
      driveToast.classList.remove("show", "shortcut");
    }, 2200);
  };
  drive.onHint = (hint) => {
    if (!driveToast) return;
    if (driveToast.classList.contains("show") && !driveToast.classList.contains("hint")) return;
    driveToast.textContent = hint;
    driveToast.classList.add("show", "hint");
    clearTimeout(driveToast._t);
    driveToast._t = setTimeout(() => {
      driveToast.classList.remove("show", "hint", "shortcut");
    }, 1800);
  };
  drive.onCrash = ({ phase, message }) => {
    if (!driveCrashBanner) return;
    if (phase === "crash") {
      driveCrashBanner.textContent = message || "CRASH";
      driveCrashBanner.classList.remove("restart");
      driveCrashBanner.classList.add("show");
    } else if (phase === "restarting") {
      driveCrashBanner.textContent = message || "Crashed! Restarting…";
      driveCrashBanner.classList.add("show", "restart");
    } else {
      driveCrashBanner.classList.remove("show", "restart");
      driveCrashBanner.textContent = "";
    }
  };
  drive.onHud = ({ mode: m, text }) => {
    if (!driveModeLabel) return;
    driveModeLabel.classList.remove("crash", "wall");
    if (m === "crash") {
      driveModeLabel.textContent = text || "CRASH";
      driveModeLabel.classList.add("crash");
    } else if (m === "wall") {
      driveModeLabel.textContent = text || "Wall run";
      driveModeLabel.classList.add("wall");
      clearTimeout(driveModeLabel._t);
      driveModeLabel._t = setTimeout(() => {
        driveModeLabel.classList.remove("wall");
        driveModeLabel.textContent = "Toy tour — cruise the house";
      }, 2200);
    } else if (m === "restart") {
      driveModeLabel.textContent = text || "Crashed! Restarting…";
      driveModeLabel.classList.add("crash");
    } else if (m === "manual" || m === "off") {
      driveModeLabel.textContent = text || "Toy tour — cruise the house";
    }
  };

  slice.onLayerChange = () => syncSliceUI();

  setEnterReady();
  console.info(`[motu] boot ready in ${(performance.now() - bootT0).toFixed(0)}ms`);
  if (boot.pendingEnter) {
    boot.pendingEnter = false;
    enterEstate();
  }
} else if (!boot.failed) {
  showBootError(new Error("Boot incomplete — mansion or drive failed to initialize"));
}

player.controls.addEventListener("unlock", () => {
  if (mode === "roam" && playMode === "explore") {
    promptEl.textContent = "Click to look around · WASD stroll · Shift brisk";
    promptEl.classList.remove("lit");
    crosshair.classList.remove("hot");
  }
});

canvas.addEventListener("click", () => {
  if (mode === "title" || boot.failed) return;
  if (playMode === "drive") return;
  if (mode === "roam" && !player.locked) player.lock();
  else if (mode === "roam" && hoverTarget) enterInspect(hoverTarget);
});

window.addEventListener("keydown", (e) => {
  if (boot.failed || !mansion) return;
  if (e.code === "Escape") {
    if (mode === "inspect") exitInspect();
  }
  if (e.code === "Digit1" && mode !== "inspect" && mode !== "title") {
    setPlayMode("explore");
  }
  if (e.code === "Digit2" && mode !== "inspect" && mode !== "title") {
    setPlayMode("drive");
  }
  if (mode === "inspect" && slice) {
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
    if (mode !== "inspect" || !slice) return;
    e.preventDefault();
    slice.delta(e.deltaY > 0 ? 1 : -1);
    syncSliceUI();
  },
  { passive: false }
);

sliceSlider?.addEventListener("input", () => {
  if (!slice) return;
  slice.setIndex(Number(sliceSlider.value));
  syncSliceUI();
});

btnPrevLayer?.addEventListener("click", () => {
  if (!slice) return;
  slice.delta(-1);
  syncSliceUI();
});
btnNextLayer?.addEventListener("click", () => {
  if (!slice) return;
  slice.delta(1);
  syncSliceUI();
});

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!slice) return;
    const m = btn.dataset.mode;
    slice.setMode(m);
    modeButtons.forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
    syncSliceUI();
  });
});

function colorCss(hex) {
  return "#" + (hex >>> 0).toString(16).padStart(6, "0");
}

function enterInspect(target) {
  if (playMode !== "explore" || !mansion || !inspect || !slice) return;
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
  clearCuriosityGlints();
  mode = "inspect";
  player.unlock();
  player.enabled = false;
  inspect.enter(obj, scene);
  slice.attach(obj, scene);
  inspectPanel.classList.remove("hidden");
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

function exitInspect(relock = true) {
  if (!slice || !inspect) return;
  slice.detach(scene);
  inspect.exit(scene);
  inspectPanel.classList.remove("open");
  inspectPanel.classList.add("hidden");
  promptEl.classList.remove("hidden");
  if (playMode === "explore") {
    mode = "roam";
    player.enabled = true;
    if (relock) player.lock();
  }
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
  if (!strataList || !slice) return;
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
  if (!slice) return;
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
  modeButtons.forEach((b) => b.classList.toggle("active", b.dataset.mode === slice.mode));
}

function updateRoomBadge(pos, opts = {}) {
  if (!mansion) return;
  const room = mansion.getRoomAt(pos.x, pos.y, pos.z);
  if (room) {
    if (roomFloorEl) roomFloorEl.textContent = room.floor || "Estate";
    if (roomNameEl) roomNameEl.textContent = room.name;
    else roomBadge.textContent = `${room.floor} · ${room.name}`;
    // Gentle purpose whisper when entering a new room (Explore only)
    if (opts.whisper && playMode === "explore" && mode === "roam" && room.id !== lastRoomId) {
      lastRoomId = room.id;
      const purpose = ROOM_PURPOSES[room.id];
      if (purpose && !hoverTarget) {
        promptEl.textContent = purpose;
        promptEl.classList.remove("whisper-out");
        promptEl.classList.add("lit", "whisper");
        roomWhisperUntil = performance.now() * 0.001 + 5.0;
        clearTimeout(promptEl._whisperT);
        clearTimeout(promptEl._whisperOutT);
        promptEl._whisperT = setTimeout(() => {
          promptEl.classList.add("whisper-out");
          promptEl._whisperOutT = setTimeout(() => {
            promptEl.classList.remove("whisper", "whisper-out");
            if (!hoverTarget && mode === "roam") {
              promptEl.textContent = "Wander & wonder · Walk to a curiosity · Shift brisk walk";
              promptEl.classList.remove("lit");
            }
          }, 650);
        }, 4300);
      }
    }
  } else {
    if (roomFloorEl) roomFloorEl.textContent = "Estate";
    if (roomNameEl) roomNameEl.textContent = "Mansion of the Unseen";
    else roomBadge.textContent = "Mansion of the Unseen";
  }
}


function _tagGlintMaterials(obj) {
  if (!obj?.userData?.objectId) return [];
  const id = obj.userData.objectId;
  if (_glintMats.has(id)) return _glintMats.get(id);
  const mats = [];
  obj.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) {
      if (!m || !m.emissive) continue;
      if (m.userData?._glintBase == null) {
        m.userData._glintBase = m.emissiveIntensity ?? 0;
        m.userData._glintColor = m.emissive.getHex();
      }
      mats.push(m);
    }
  });
  _glintMats.set(id, mats);
  return mats;
}

function clearCuriosityGlints() {
  for (const mats of _glintMats.values()) {
    for (const m of mats) {
      if (m.userData?._glintBase != null) {
        m.emissiveIntensity = m.userData._glintBase;
        if (m.userData._glintColor != null) m.emissive.setHex(m.userData._glintColor);
      }
    }
  }
}

/** Subtle near-field glint on sliceable curios — invitation, not neon spam. */
function updateCuriosityGlints(pos, t) {
  if (!mansion || playMode !== "explore" || mode !== "roam") {
    clearCuriosityGlints();
    return;
  }
  const near = [];
  for (const obj of mansion.getInteractives()) {
    if (!obj.userData?.layers || !obj.userData?.objectId) continue;
    const d = obj.position.distanceTo(pos);
    if (d < 5.5) near.push({ obj, d });
  }
  near.sort((a, b) => a.d - b.d);
  const activeIds = new Set();
  for (const { obj, d } of near.slice(0, 8)) {
    activeIds.add(obj.userData.objectId);
    const mats = _tagGlintMaterials(obj);
    const proximity = 1 - Math.min(1, Math.max(0, (d - 1.2) / 4.0));
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.6 + obj.position.x * 0.3);
    const add = proximity * (0.08 + 0.14 * pulse);
    for (const m of mats) {
      const base = m.userData._glintBase ?? 0;
      m.emissiveIntensity = base + add;
      // Warm gold glint only while near — restore color on clear
      if (proximity > 0.15) m.emissive.setHex(0xffe082);
    }
  }
  // Restore mats for curios no longer near
  for (const [id, mats] of _glintMats) {
    if (activeIds.has(id)) continue;
    for (const m of mats) {
      m.emissiveIntensity = m.userData._glintBase ?? 0;
      if (m.userData._glintColor != null) m.emissive.setHex(m.userData._glintColor);
    }
  }
}

function updateHover() {
  if (mode !== "roam" || playMode !== "explore" || !player.locked || !mansion) {
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
    promptEl.textContent = `Click to inspect · ${name}`;
    promptEl.classList.add("lit");
    crosshair.classList.add("hot");
  } else {
    hoverTarget = null;
    // Room whisper may own the prompt briefly
    if (performance.now() * 0.001 > roomWhisperUntil) {
      promptEl.textContent = "Wander & wonder · Walk to a curiosity · Shift brisk walk";
      promptEl.classList.remove("lit");
    }
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
  if (!mansion || boot.failed) {
    renderer.render(scene, camera);
    return;
  }
  if ((mode === "drive" || playMode === "drive") && drive) {
    drive.update(dt);
    updateRoomBadge(drive.car.position);
    mansion.updateFireflies(t);
  } else if (mode === "roam") {
    player.update(dt, mansion.getColliders());
    updateHover();
    updateRoomBadge(player.position, { whisper: true });
    updateCuriosityGlints(player.position, t);
    mansion.updateFireflies(t);
  } else if (mode === "inspect" && inspect && slice) {
    inspect.update(dt);
    slice.update(t, dt);
  } else {
    mansion.updateFireflies(t);
  }
  renderer.render(scene, camera);
}
tick();
