import * as THREE from "three";
import { buildLoftMeshes } from "./loftNet.js?v=logic21";
import { TRACK_PATHS, CAR_SPAWN, RAMP_MOUNT_FEET, PRIMARY_CIRCUIT } from "../data/tracks.js?v=logic21";

function makeCanvas(w, h) {
  if (typeof document !== "undefined" && document.createElement) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  return null;
}

/**
 * logic11: the "roads" are no longer asphalt — a dark-oak runner that reads as part of the house:
 * long boards with soft grain, faint board joints, and a barely-there brass inlay near each edge.
 * No lane paint. 512² + mipmaps + anisotropy 8 (no 1-px sparkle that crawls when minified).
 */
function makeRunnerTexture(base = "#4b3424", grainHi = [104, 74, 50], grainLo = [44, 30, 20], seed0 = 11) {
  const N = 512;
  const c = makeCanvas(N, N);
  if (!c) return null;
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, N, N);
  let seed = seed0;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // logic14: 5 boards (odd → no seam down the middle reading as a centre line)
  const boards = 5, bw = N / boards;
  for (let b = 0; b < boards; b++) {
    const tint = (rnd() - 0.5) * 14;
    ctx.fillStyle = `rgba(${(grainHi[0] + tint) | 0},${(grainHi[1] + tint) | 0},${(grainHi[2] + tint) | 0},0.10)`;
    ctx.fillRect(b * bw, 0, bw, N);
    for (let g = 0; g < 26; g++) {
      const x = b * bw + 3 + rnd() * (bw - 6), w = 1 + rnd() * 2.5;
      const hi = rnd() > 0.5;
      const col = hi ? grainHi : grainLo;
      ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.10 + rnd() * 0.12})`;
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(x, 0);
      for (let y = 0; y <= N; y += 32) ctx.lineTo(x + Math.sin((y + b * 97) * 0.012 + g) * 2.2, y);
      ctx.stroke();
    }
    // soft board seam (2 px, low contrast)
    ctx.fillStyle = "rgba(20,12,8,0.22)";
    if (b) ctx.fillRect(b * bw, 0, 2, N);
    // staggered butt joint
    const jy = (b * 173 + 64) % N;
    ctx.fillStyle = "rgba(20,12,8,0.30)";
    ctx.fillRect(b * bw, jy, bw, 2);
  }
  // logic14: brass edge inlays removed (they read as lane lines)
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  return tex;
}
/** logic14: ONE classic striped-asphalt parody stretch keeps this look (dashes + white edge lines). */
export function makeParodyAsphaltTexture() {
  const tex = makeSkyAsphaltTexture();
  if (!tex || !tex.image || !tex.image.getContext) return tex;
  const ctx = tex.image.getContext("2d"), N = tex.image.width;
  ctx.setLineDash([]); ctx.fillStyle = "#eeeeea"; ctx.fillRect(18, 0, 9, N); ctx.fillRect(N - 27, 0, 9, N);
  tex.needsUpdate = true;
  return tex;
}
/** logic14 themed deck surfaces — NO centre dashes, NO lane lines. u across, v along the road. */
/** logic17 (Ben: "darker, realer, less 1990s, more 2100s"): every deck theme is a dark, real
 *  material — brushed gunmetal / midnight alloy, polished dark stone, smoked glass, burnt copper,
 *  weathered bark, grungy card. Fine micro-grain + faint TRANSVERSE panel seams only (no lane lines).
 *  Keys are kept (area → key mapping unchanged); only what each key looks like changed. */
export const THEME_LOOK = {
  //            base       hi (rgb)          lo (rgb)       style      rough metal
  purple:   ["#141c2e", [52, 70, 104], [6, 9, 16], "brushed", 0.42, 0.55],   // Skyline: midnight alloy
  sapphire: ["#0f1d36", [48, 78, 126], [4, 8, 18], "brushed", 0.32, 0.65],   // spiral: deep navy anodised
  slate:    ["#1b222c", [70, 82, 98], [8, 10, 14], "brushed", 0.45, 0.6],    // roof: gunmetal
  graphite: ["#17191d", [60, 64, 70], [6, 7, 8], "brushed", 0.5, 0.5],       // conveyor road
  plum:     ["#1d1c24", [66, 62, 80], [8, 8, 12], "brushed", 0.48, 0.5],     // ground-floor rings: smoked titanium
  teal:     ["#0e1a1f", [40, 70, 80], [3, 7, 9], "glass", 0.22, 0.35],       // 1st-floor rings: smoked glass
  emerald:  ["#101a19", [44, 70, 66], [4, 8, 8], "stone", 0.3, 0.1],         // dark petrol stone
  crimson:  ["#1f1214", [80, 44, 48], [8, 4, 5], "stone", 0.3, 0.1],         // oxblood granite
  stone:    ["#24262a", [86, 88, 92], [10, 10, 12], "stone", 0.34, 0.05],    // polished basalt
  orange:   ["#3a2414", [140, 90, 52], [22, 12, 6], "copper", 0.38, 0.85],   // garden skyway: dark amber
  descent:  ["#4a2a16", [168, 104, 58], [26, 12, 6], "copper", 0.33, 0.9],   // Grand Descent: burnt copper
  moss:     ["#231a13", [74, 56, 40], [10, 7, 5], "bark", 0.85, 0.0],        // treehouse: weathered bark wood
  wood:     ["#2a2018", [80, 62, 44], [12, 9, 6], "bark", 0.7, 0.0],
  brass:    ["#2c2416", [110, 92, 56], [14, 11, 6], "copper", 0.4, 0.8],
  card:     ["#5b4a36", [120, 102, 78], [34, 26, 18], "card", 0.95, 0.0],    // mouse world: grungy card
};
/** logic17: one MeshStandardMaterial per theme (roughness/metalness from THEME_LOOK; lit by the
 *  scene's existing lights — no env map, no new lights). Cached, so it is a handful of materials. */
const _themeMatCache = {};
export function themeMaterial(theme) {
  if (_themeMatCache[theme]) return _themeMatCache[theme];
  const L = THEME_LOOK[theme] || THEME_LOOK.graphite, tx = makeThemeTexture(theme);
  const m = new THREE.MeshStandardMaterial(tx ? { color: 0xffffff, map: tx, roughness: Math.max(0.46, L[4]), metalness: L[5] * 0.55 } : { color: new THREE.Color(L[0]), roughness: Math.max(0.46, L[4]), metalness: L[5] * 0.55 }); // roughness ≥0.46: the car-follow light made a blown hot-spot on the glossiest decks // ×0.55: no env map, full metal would read as black
  m.name = "deck_" + theme;
  return (_themeMatCache[theme] = m);
}
export function makeThemeTexture(theme) {
  const N = 256, c = makeCanvas(N, N);
  if (!c) return null;
  const ctx = c.getContext("2d");
  let seed = 97 + theme.length * 31;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const T = THEME_LOOK[theme] || ["#1a1c20", [70, 70, 74], [8, 8, 9], "brushed"];
  const style = T[3];
  ctx.fillStyle = T[0]; ctx.fillRect(0, 0, N, N);
  const rgba = (col, a) => `rgba(${col[0]},${col[1]},${col[2]},${a})`;
  // micro-grain for everything (2-px, low contrast — no 1-px sparkle when minified)
  for (let i = 0; i < 2200; i++) { ctx.fillStyle = rgba(rnd() > 0.5 ? T[1] : T[2], 0.05 + rnd() * 0.08); ctx.fillRect(rnd() * N, rnd() * N, 2, 2); }
  if (style === "brushed" || style === "copper") { // fine streaks ALONG travel (v axis), very low contrast
    for (let i = 0; i < 180; i++) { ctx.fillStyle = rgba(rnd() > 0.45 ? T[1] : T[2], 0.04 + rnd() * 0.06); ctx.fillRect(rnd() * N, 0, 1, N); }
    if (style === "copper") for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(40,70,64,${0.05 + rnd() * 0.07})`; const r = 2 + rnd() * 6; ctx.fillRect(rnd() * N, rnd() * N, r, r * 0.6); } // faint verdigris
    ctx.fillStyle = rgba(T[2], 0.6); ctx.fillRect(0, 0, N, 1); ctx.fillStyle = rgba(T[1], 0.18); ctx.fillRect(0, 1, N, 1); // panel seam across
  } else if (style === "stone" || style === "glass") { // polished dark stone / smoked glass: soft cloud + faint veins
    for (let i = 0; i < 40; i++) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); void g; ctx.fillStyle = rgba(rnd() > 0.5 ? T[1] : T[2], style === "glass" ? 0.03 : 0.05); ctx.beginPath(); ctx.arc(rnd() * N, rnd() * N, 10 + rnd() * 40, 0, 7); ctx.fill(); }
    if (style === "stone") for (let i = 0; i < 9; i++) { ctx.strokeStyle = rgba(T[1], 0.1 + rnd() * 0.1); ctx.lineWidth = 0.8 + rnd(); ctx.beginPath(); let x = rnd() * N, y = rnd() * N; ctx.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.3) * 50; ctx.lineTo(x, y); } ctx.stroke(); }
    ctx.fillStyle = rgba(T[2], 0.7); ctx.fillRect(0, 0, N, 1); if (style === "glass") { ctx.fillStyle = "rgba(160,200,230,0.05)"; ctx.fillRect(0, N * 0.55, N, N * 0.12); } // slab joint + sheen band
  } else if (style === "bark") { // weathered planks ACROSS the road, deep grain, worn
    for (let k = 0; k < 8; k++) { const y = k * N / 8; ctx.fillStyle = rgba(rnd() > 0.5 ? T[1] : T[2], 0.1 + rnd() * 0.1); ctx.fillRect(0, y, N, N / 8); ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, y, N, 2);
      for (let g = 0; g < 7; g++) { ctx.fillStyle = rgba(T[2], 0.25); ctx.fillRect(0, y + 3 + rnd() * (N / 8 - 6), N, 1); } }
    for (let i = 0; i < 30; i++) { ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(rnd() * N, rnd() * N, 2 + rnd() * 4, 1 + rnd() * 2, 0, 0, 7); ctx.fill(); } // knots
  } else if (style === "card") { // grungy corrugated card: flutes, water stains, scuffs, tape
    for (let y = 0; y < N; y += 8) { ctx.fillStyle = rgba(T[2], 0.22); ctx.fillRect(0, y, N, 3); }
    for (let i = 0; i < 10; i++) { ctx.fillStyle = `rgba(40,28,16,${0.08 + rnd() * 0.12})`; ctx.beginPath(); ctx.arc(rnd() * N, rnd() * N, 8 + rnd() * 26, 0, 7); ctx.fill(); }
    for (let i = 0; i < 18; i++) { ctx.fillStyle = rgba(T[1], 0.12); ctx.fillRect(rnd() * N, rnd() * N, 10 + rnd() * 30, 1 + rnd() * 3); }
    ctx.fillStyle = "rgba(150,130,90,0.16)"; ctx.fillRect(0, N * 0.3, N, 14); // old packing tape across
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  return tex;
}
function makeSkyAsphaltTexture() {
  // logic10: 512² fine-grain asphalt — low-contrast 2-px aggregate (no 1-px sparkle that crawls when
  // minified), soft-edged centre dash (bright core + feather) so it stays crisp without aliasing.
  const N = 512;
  const c = makeCanvas(N, N);
  if (!c) return null;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2b2d33";
  ctx.fillRect(0, 0, N, N);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 5200; i++) {
    const v = 34 + rnd() * 26;
    ctx.fillStyle = `rgba(${v | 0},${(v + 1) | 0},${(v + 4) | 0},0.30)`;
    ctx.fillRect(rnd() * N, rnd() * N, 2, 2);
  }
  for (let i = 0; i < 260; i++) {
    const v = 20 + rnd() * 10;
    ctx.fillStyle = `rgba(${v | 0},${v | 0},${(v + 3) | 0},0.18)`;
    ctx.beginPath(); ctx.ellipse(rnd() * N, rnd() * N, 4 + rnd() * 6, 3 + rnd() * 4, rnd() * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.setLineDash([44, 52]);
  ctx.lineCap = "butt";
  ctx.strokeStyle = "rgba(217,207,154,0.35)"; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(N / 2, 0); ctx.lineTo(N / 2, N); ctx.stroke();
  ctx.strokeStyle = "#e4dba6"; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(N / 2, 0); ctx.lineTo(N / 2, N); ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  return tex;
}

function makeAsphaltTexture() { return makeRunnerTexture(); }
function makeChevronTexture() { return makeRunnerTexture("#46301f", [98, 70, 46], [40, 27, 18], 23); }
/** Skyline wall-top ledges: lighter walnut "picture rail / crown ledge" (no paint at all) */
export function makeLedgeTexture() { return makeRunnerTexture("#5a3e2a", [120, 86, 58], [52, 36, 24], 37); }

function makeStartFinishTexture() {
  const c = makeCanvas(128, 64);
  if (!c) return null;
  const ctx = c.getContext("2d");
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 4; j++) {
      ctx.fillStyle = ((i + j) % 2 === 0) ? "#fafafa" : "#121212";
      ctx.fillRect(i * 16, j * 16, 16, 16);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const ELEV_KINDS = new Set(["elevated", "cornice", "balcony", "ramp"]);
const FLOOR_KINDS = new Set(["floor", "outdoor", "flower"]);
// logic6 kerbs: red/white blocks (instance colours on the single curb InstancedMesh)
const CURB_RED = 0xd8382c;
const CURB_WHITE = 0xf4f1ea;
const CURB_BLOCK_U = 0.32;

/** Ride height above story plank top — wheels sit here; deck top flush-ish. */
export const ASPHALT_RIDE = 0.012;
/** Floor asphalt slab thickness (extends DOWN into planks — no floating air gap). */
export const ASPHALT_THICK_FLOOR = 0.055;
export const ASPHALT_THICK_RAMP = 0.168;
export const ASPHALT_THICK_BALCONY = 0.055;

function ribbonYLift(kind) {
  // Small lift only — decks plant on wood (path Y already = story plank top)
  if (kind === "ramp") return ASPHALT_RIDE + 0.002;
  if (kind === "balcony" || kind === "elevated" || kind === "cornice") return ASPHALT_RIDE + 0.002;
  return ASPHALT_RIDE;
}

/**
 * logic3 anti z-fight: consecutive circuit ribbons alternate a 3 mm visual layer so the
 * overlapping wedge at every kiss never shares a depth plane (8-path loop is even →
 * neighbours always differ, including foyer_finish → foyer_sf). Physics ride height
 * (ribbonYLift) is unchanged.
 */
const VIS_BASE = 0.012;
const VIS_LAYER = 0.003;
function visualLiftFor(pathId) {
  const i = PRIMARY_CIRCUIT.indexOf(pathId);
  return VIS_BASE + (i >= 0 && (i % 2) === 1 ? VIS_LAYER : 0);
}
/** Spawn pad sits above both layers; ribbons tuck under its rim. */
const PAD_TOP = VIS_BASE + VIS_LAYER + 0.003;

const FOYER_CLIMB_FOOT = (RAMP_MOUNT_FEET.climb_a?.foot)
  || { x: -5.00, y: 0.0, z: 12.70 };
const FOYER_CLIMB_ENGAGE_R = ((RAMP_MOUNT_FEET.climb_a?.engageBack) || 1.25) + 1.35;
const CLIMB_B_FOOT = (RAMP_MOUNT_FEET.climb_b?.foot)
  || { x: 7.00, y: 0.0, z: 12.70 };
const CLIMB_B_CREST = (RAMP_MOUNT_FEET.climb_b?.crest)
  || { x: 7.00, y: 4.20, z: -1.50 };
const CLIMB_B_ENGAGE_R = ((RAMP_MOUNT_FEET.climb_b?.engageBack) || 1.25) + 1.35;

/**
 * Clean TrackSystem — primary circuit only.
 * Binary on-road: on ribbon OR carpet crawl. Strong path hysteresis. No teleports.
 */
export class TrackSystem {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = "drive_tracks";
    this.root.visible = false;
    scene.add(this.root);
    this.segments = [];
    this.checkpoints = [];
    this.portals = [];
    this.boostPads = [];
    this._lastPathId = null;
    this._lastPathKind = null;
    // Textures/mats deferred — Explore must not pay road GPU cost at boot
    this._asphalt = null;
    this._chevron = null;
    this._startFinish = null;
    this._sharedMats = null;
    this._gridCell = 2.5;
    this._snapGrid = new Map();
    this._gridOriginX = 0;
    this._gridOriginZ = 0;
    this._visMode = "off";
    this._bannerMats = [];
    this._moteMats = [];
    this._meshesBuilt = false;
    this._pendingVisuals = [];
    this._railPostPositions = [];
    this._curbSegmentPositions = [];
    this._buildLogic();
    // Real browser tab (http/https page): defer meshes until Drive enter.
    // Node sims stub document but have no location.href — build now for audits.
    const deferMeshes = typeof window !== "undefined"
      && window.location
      && typeof window.location.href === "string"
      && /^https?:/i.test(window.location.href);
    if (!deferMeshes) this.ensureMeshes();
  }

  /**
   * Build road meshes + textures on first Drive enter only.
   * Safe to call repeatedly. Explore boot never uploads road geometry.
   */
  ensureMeshes() {
    if (this._meshesBuilt) return;
    this._meshesBuilt = true;
    const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    this._asphalt = makeAsphaltTexture();
    this._chevron = makeChevronTexture();
    // Start/finish checkered landmark (#10) — IGNORED / hidden (ramps1)
    this._startFinish = null;
    this._sharedMats = this._makeSharedRoadMats();
    this._railPostPositions = [];
    this._curbSegmentPositions = [];
    this._underfillPositions = [];
    // logic8: plain roads & ramps only. No spawn pad / start disc, no kerbs, no chevrons, no
    // rail posts, no climb-end bands, no junction arrows — a road is just an asphalt surface
    // with a thin dashed centre line. Ramp under-fill keels stay (structure, and real colliders).
    for (const job of this._pendingVisuals) {
      this._addRibbonRoad(job.visualPts, job.width, job.kind, job.closed, null, false, job.pathId);
    }
    this._flushUnderfill();
    if (this._loftJobs && this._loftJobs.length) { if (!this._skyTex) this._skyTex = makeParodyAsphaltTexture(); this._themeMat = themeMaterial; this._themeTex = (th) => (this._themeCache || (this._themeCache = {}))[th] || (this._themeCache[th] = makeThemeTexture(th)); buildLoftMeshes(this, this._loftJobs); }
    let meshCount = 0;
    this.root.traverse((o) => { if (o.isMesh) meshCount++; });
    const ms = ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - t0;
    console.log(
      `[TrackSystem] meshes deferred-built meshes=${meshCount} in ${ms.toFixed(0)}ms (Explore never paid this)`
    );
  }

  _makeSharedRoadMats() {
    // Lambert only — no Standard under moving fill (SwiftShader). Slight emissive so
    // white/yellow lane paint stays readable with lite Drive lights.
    const asphaltOpts = {
      color: 0x2e2219, roughness: 0.62, metalness: 0.0,
    };
    // logic17: the foyer oak runner becomes a dark smoked oak with a satin finish
    if (this._asphalt) { asphaltOpts.map = this._asphalt; asphaltOpts.color = 0x8a7a6c; }
    const asphalt = new THREE.MeshStandardMaterial(asphaltOpts);
    const chevronOpts = {
      color: 0x46301f,
    };
    if (this._chevron) { chevronOpts.map = this._chevron; chevronOpts.color = 0xffffff; }
    const chevron = new THREE.MeshLambertMaterial(chevronOpts);
    const rail = new THREE.MeshLambertMaterial({
      color: 0x3a414c, // logic17: dark gunmetal (logic16 steel 0x8c96ac)
    });
    // logic4: deck sides / bottoms / keels were 0x2a2c34 — overhead Climb B deck read as a
    // pure-black slab at spawn. Mid slate so the ramp structure reads as structure.
    const side = new THREE.MeshLambertMaterial({
      color: 0x14171c, // logic17: near-black deck edge (logic16 0x2e3442)
    });
    // logic6: curbs were 0x1e2028 — near-black on dark asphalt, they never read. Now classic
    // red/white kerb blocks: material is white and each instance carries its colour
    // (InstancedMesh.setColorAt) — still ONE mesh / one draw call. Tiny neutral emissive so the
    // white blocks stay legible in the dim hall corners without washing out the red.
    const curb = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x181818, emissiveIntensity: 1.0 });
    return { asphalt, chevron, rail, side, curb };
  }

  /** CPU-only: segments + snap grid. No Mesh / texture / WebGL cost. */
  _buildLogic() {
    this._pendingVisuals = [];
    this._addSpawnPadLogic();
    for (const path of TRACK_PATHS) {
      if (path.disabled || path._disabledReason) continue;
      this._buildPathLogic(path);
    }
    this._assignSegmentGradeBank();
    this._buildSnapGrid();
    console.log(
      `[TrackSystem] logic-only segments=${this.segments.length} snapGrid=${this._snapGrid.size} cells @ ${this._gridCell}m (meshes deferred)`
    );
  }

  /** One InstancedMesh for all rail posts — avoids 200+ Cylinder draw calls / WebGL OOM on Drive enter. */
  _flushRailPosts() {
    const posts = this._railPostPositions || [];
    this._railPostPositions = [];
    if (!posts.length) return;
    const geo = new THREE.CylinderGeometry(0.012, 0.014, 0.085, 6);
    const mesh = new THREE.InstancedMesh(geo, this._sharedMats.rail, posts.length);
    mesh.name = "rail_posts_instanced";
    mesh.frustumCulled = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.root.add(mesh);
  }

  /** One InstancedMesh for curb strips — figure-8 was ~500 Box meshes and killed SwiftShader. */
  _flushCurbSegments() {
    const segs = this._curbSegmentPositions || [];
    this._curbSegmentPositions = [];
    if (!segs.length) return;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(geo, this._sharedMats.curb, segs.length);
    mesh.name = "curb_segments_instanced";
    mesh.frustumCulled = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const dummy = new THREE.Object3D();
    dummy.rotation.order = "YXZ";
    const red = new THREE.Color(CURB_RED), white = new THREE.Color(CURB_WHITE);
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      dummy.position.set(s.x, s.y, s.z);
      dummy.scale.set(s.sx, s.sy, s.sz);
      dummy.rotation.set(s.pitch || 0, s.yaw || 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, s.white ? white : red);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.curbInstanceCount = segs.length;
    this.root.add(mesh);
  }

  _assignSegmentGradeBank() {
    const segs = this.segments;
    const raw = new Array(segs.length);
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const flat = Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z) || 1e-6;
      raw[i] = Math.atan2(s.b.y - s.a.y, flat);
    }
    for (let pass = 0; pass < 2; pass++) {
      const next = raw.slice();
      for (let i = 0; i < segs.length; i++) {
        const prev = i > 0 && segs[i - 1].pathId === segs[i].pathId ? raw[i - 1] : raw[i];
        const nxt = i < segs.length - 1 && segs[i + 1].pathId === segs[i].pathId ? raw[i + 1] : raw[i];
        next[i] = (prev + raw[i] + nxt) / 3;
      }
      for (let i = 0; i < raw.length; i++) raw[i] = next[i];
    }
    for (let i = 0; i < segs.length; i++) {
      segs[i].grade = THREE.MathUtils.clamp(raw[i], -0.20, 0.20);
      segs[i].bank = 0; // upright cruise — no sideways tip
    }
  }

  _buildSnapGrid() {
    this._snapGrid = new Map();
    if (!this.segments.length) return;
    let minX = Infinity, minZ = Infinity;
    for (const s of this.segments) {
      minX = Math.min(minX, s.a.x, s.b.x);
      minZ = Math.min(minZ, s.a.z, s.b.z);
    }
    this._gridOriginX = minX - 2;
    this._gridOriginZ = minZ - 2;
    const cell = this._gridCell;
    for (let i = 0; i < this.segments.length; i++) {
      const s = this.segments[i];
      const pad = Math.ceil((s.width * 0.5 + 1.5) / cell);
      const ix0 = Math.floor((Math.min(s.a.x, s.b.x) - this._gridOriginX) / cell) - pad;
      const ix1 = Math.floor((Math.max(s.a.x, s.b.x) - this._gridOriginX) / cell) + pad;
      const iz0 = Math.floor((Math.min(s.a.z, s.b.z) - this._gridOriginZ) / cell) - pad;
      const iz1 = Math.floor((Math.max(s.a.z, s.b.z) - this._gridOriginZ) / cell) + pad;
      for (let ix = ix0; ix <= ix1; ix++) {
        for (let iz = iz0; iz <= iz1; iz++) {
          const key = ix + "," + iz;
          let bucket = this._snapGrid.get(key);
          if (!bucket) { bucket = []; this._snapGrid.set(key, bucket); }
          bucket.push(i);
        }
      }
    }
  }

  _segmentsNear(x, z, radius) {
    if (!this._snapGrid.size) return this.segments;
    const cell = this._gridCell;
    const r = radius + 1.2;
    const ix0 = Math.floor((x - r - this._gridOriginX) / cell);
    const ix1 = Math.floor((x + r - this._gridOriginX) / cell);
    const iz0 = Math.floor((z - r - this._gridOriginZ) / cell);
    const iz1 = Math.floor((z + r - this._gridOriginZ) / cell);
    const seen = new Set();
    const out = [];
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const bucket = this._snapGrid.get(ix + "," + iz);
        if (!bucket) continue;
        for (const idx of bucket) {
          if (seen.has(idx)) continue;
          seen.add(idx);
          out.push(this.segments[idx]);
        }
      }
    }
    return out;
  }

  /**
   * logic4: STATELESS ribbon surface height under (x,z) — never touches _lastPathId.
   * Only the given path and its PRIMARY_CIRCUIT neighbours count (no foreign kiss / under-ramp
   * ribbons). Returns the highest surface y within [yRef-below, yRef+above], or null.
   * Used by the chase cam so it can never sink under a ramp deck behind the car (Climb B descent).
   */
  surfaceYAt(x, z, yRef, pathId = null, above = 0.9, below = 0.6) {
    if (!this.segments.length) return null;
    let allow = null;
    if (pathId) {
      const i = PRIMARY_CIRCUIT.indexOf(pathId);
      allow = new Set([pathId]);
      if (i >= 0) {
        const n = PRIMARY_CIRCUIT.length;
        allow.add(PRIMARY_CIRCUIT[(i + 1) % n]);
        allow.add(PRIMARY_CIRCUIT[(i - 1 + n) % n]);
      }
    }
    let best = null;
    for (const s of this._segmentsNear(x, z, 0.6)) {
      if (allow && !allow.has(s.pathId)) continue;
      const abx = s.b.x - s.a.x, abz = s.b.z - s.a.z;
      const L2 = abx * abx + abz * abz;
      if (L2 < 1e-8) continue;
      const tr = ((x - s.a.x) * abx + (z - s.a.z) * abz) / L2;
      if (tr < -0.02 || tr > 1.02) continue;
      const t = Math.max(0, Math.min(1, tr));
      const d = Math.hypot(x - (s.a.x + abx * t), z - (s.a.z + abz * t));
      if (d > s.width * 0.5 + 0.12) continue;
      const py = s.a.y + (s.b.y - s.a.y) * t;
      if (py > yRef + above || py < yRef - below) continue;
      if (best == null || py > best) best = py;
    }
    return best;
  }

  _addSpawnPadLogic() {
    // logic3: pad = ribbon-sized disc on the S/F straight (was 2.35 → poked into walls)
    const r = 1.18;
    // y = plank top (path band); ride height = y + ASPHALT_RIDE
    this._spawnApron = { x: CAR_SPAWN.x, z: CAR_SPAWN.z, r, y: 0.0 };
  }

  _addSpawnPadMesh() {
    const r = this._spawnApron?.r || 1.18;
    const thick = ASPHALT_THICK_FLOOR;
    const topY = PAD_TOP;
    // Thick cylinder deck planted INTO the wood floor (bottom below y=0)
    const geo = new THREE.CylinderGeometry(r, r, thick, 48);
    const mat = this._sharedMats.asphalt.clone();
    if (mat.map) {
      mat.map = mat.map.clone();
      mat.map.repeat.set(3, 3);
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = "spawn_clean_pad";
    mesh.position.set(CAR_SPAWN.x, topY - thick * 0.5, CAR_SPAWN.z);
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    mesh.userData.ribbon = true;
    mesh.userData.kind = "floor";
    this.root.add(mesh);
    // Soft lane dashes on apron top (readable asphalt, not a floating paper disk)
    {
      const dashMat = new THREE.MeshLambertMaterial({
        color: 0xffcc28, emissive: 0x665500, emissiveIntensity: 0.25,
      });
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.006, r * 1.55), dashMat);
      dash.position.set(CAR_SPAWN.x, topY + 0.004, CAR_SPAWN.z);
      dash.name = "spawn_apron_lane";
      // logic16: no lane lines outside the parody stretch — dash not added
    }
    // Start/finish checkered band (#10) — IGNORED: mesh not added (ramps1)
    // (this._startFinish forced null in ensureMeshes)
  }

  _buildPathLogic(path) {
    const kind = path.kind || "floor";
    const width = path.width;
    const tension = path.tension != null ? path.tension : 0.15;
    const pts = path.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    if (pts.length < 2) return;

    let visualPts = pts;
    let snapPts = pts;
    if (pts.length >= 3 && !path.raw) {
      const curve = new THREE.CatmullRomCurve3(pts, !!path.closed, "catmullrom", tension);
      const climb = kind === "ramp";
      const foyerClimb = path.id === "climb_a" || path.id === "climb_b";
      // Figure-8 densify cut — curb InstancedMesh + low subdiv keeps SwiftShader alive on W.
      const visN = Math.max(pts.length * (foyerClimb ? 2 : climb ? 2 : path.fancy ? 2 : 2),
        foyerClimb ? 14 : climb ? 12 : path.fancy ? 10 : 8);
      const snapN = Math.max(pts.length * (climb ? 3 : 2), climb ? 16 : 10);
      // logic8: ONE sampling for mesh and physics — the wheels ride exactly the drawn surface
      snapPts = curve.getPoints(Math.max(visN, snapN));
      visualPts = snapPts;
      if (path.closed && visualPts.length > 2
          && visualPts[0].distanceTo(visualPts[visualPts.length - 1]) < 0.04) {
        visualPts = visualPts.slice(0, -1);
      }
      if (path.closed && snapPts.length > 2
          && snapPts[0].distanceTo(snapPts[snapPts.length - 1]) < 0.04) {
        snapPts = snapPts.slice(0, -1);
      }
      visualPts = snapPts;
    }

    const isRail = !!path.rail || kind === "ramp" || kind === "balcony" || kind === "elevated";

    const segStart = this.segments.length;
    for (let i = 0; i < snapPts.length - 1; i++) {
      const a = snapPts[i], b = snapPts[i + 1];
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      if (len < 0.01) continue;
      dir.normalize();
      let label = null;
      for (const op of path.points) {
        if (!op.label) continue;
        if (Math.hypot(op.x - a.x, op.y - a.y, op.z - a.z) < 1.6) { label = op.label; break; }
      }
      this.segments.push({
        a: a.clone(), b: b.clone(), dir: dir.clone(), len,
        kind, pathId: path.id, width, label, rail: isRail,
        elevated: ELEV_KINDS.has(kind),
        tube: false,
        visual: true,
        yAt: path.yAt || null, // logic15: surface-height field (Foyer Bridge merge)
      });
    }

    // logic8: open path ends are hard edges for the free-drive surface query; interior joints
    // are round (no wedge gaps on the outside of a bend).
    if (this.segments.length > segStart) {
      this.segments[segStart].openStart = !path.closed;
      this.segments[this.segments.length - 1].openEnd = !path.closed;
      // Miter allowance at each interior joint: how far past its end a segment still owns the
      // outside of the bend (halfW·tan(bend/2)) — closes the wedge gap without capsule "domes"
      // that would reach along the road onto higher ground.
      const segs = this.segments;
      for (let k = segStart; k < segs.length; k++) {
        const sg = segs[k];
        sg.extA = 0; sg.extB = 0;
        const bendTo = (o) => {
          const h0 = Math.atan2(sg.b.x - sg.a.x, sg.b.z - sg.a.z), h1 = Math.atan2(o.b.x - o.a.x, o.b.z - o.a.z);
          let d = Math.abs(h1 - h0); if (d > Math.PI) d = 2 * Math.PI - d;
          return Math.min(d, 1.2);
        };
        if (k > segStart) sg.extA = (width * 0.5) * Math.tan(bendTo(segs[k - 1]) / 2) + 0.004;
        if (k < segs.length - 1) sg.extB = (width * 0.5) * Math.tan(bendTo(segs[k + 1]) / 2) + 0.004;
      }
    }
    const gap = (path.id === "foyer_sf" || path.id === "foyer_finish"
      || path.id === "foyer_to_climb_a")
      ? { x: CAR_SPAWN.x, z: CAR_SPAWN.z, r: Math.max(0.6, (this._spawnApron?.r || 1.18) - 0.10) }
      : null;

    for (const op of path.points) {
      if (op.label) {
        this.checkpoints.push({
          pos: new THREE.Vector3(op.x, op.y, op.z),
          label: op.label,
          pathId: path.id,
          kind,
        });
      }
    }

    if (kind === "ramp") {
      if (!this.keels) this.keels = [];
      this.keels.push(...this._keelsFor(snapPts, width, path.id));
    }
    if (path.loft) {
      // logic9: Skyline / mouse run — merged into a handful of meshes by buildLoftMeshes
      (this._loftJobs || (this._loftJobs = [])).push({ path, pts: snapPts, width, kind });
      return;
    }
    // Queue ribbon/rail visuals — built only on first Drive enter
    this._pendingVisuals.push({
      pathId: path.id,
      visualPts,
      width,
      kind,
      closed: !!path.closed,
      gap,
      isRail,
      // logic3: per-foot 3D cones retired — uniform painted junction chevrons at all 8 kisses
      climbChevrons: false,
      voidBarriers: kind === "ramp",
      cornerChevrons: path.id === "landing_hairpin" || path.id === "balcony_arc",
      curb: true,
    });
  }


  /** logic8: ramp under-fill keels (structure) — shared by mesh flush AND Drive collision. */
  _keelsFor(slice, width, pathId) {
    const out = [];
    if (!slice || slice.length < 2) return out;
    const yLift = pathId ? visualLiftFor(pathId) : ribbonYLift("ramp");
    const thick = ASPHALT_THICK_RAMP;
    const tops = slice.map((p) => p.y + yLift);
    const step = Math.max(3, Math.floor(slice.length / 6));
    const headAt = (k) => {
      const a = slice[Math.max(0, k - 1)], b = slice[Math.min(slice.length - 1, k + 1)];
      return Math.atan2(b.x - a.x, b.z - a.z);
    };
    const bend = (i0, j0) => {
      let d = Math.abs(headAt(j0) - headAt(i0));
      if (d > Math.PI) d = Math.PI * 2 - d;
      return d;
    };
    for (let i = 0, j; i < slice.length - 1; i = j) {
      j = Math.min(slice.length - 1, i + step);
      while (j > i + 1 && bend(i, j) > 0.18) j = i + Math.max(1, Math.floor((j - i) / 2));
      let deckY = Infinity;
      for (let k = i; k <= j; k++) deckY = Math.min(deckY, tops[k]);
      const yTop = deckY - thick;
      const pathY = Math.min(slice[i].y, slice[j].y);
      const plantY = pathY >= 2.1 ? 4.20 : 0.0;
      // keel only where the deck is clearly off the floor (a low deck is its own wall)
      if (yTop - plantY < 0.12) continue;
      const keelH = Math.min(1.05, yTop - plantY);
      const span = Math.hypot(slice[j].x - slice[i].x, slice[j].z - slice[i].z) || 0.4;
      const yaw = Math.atan2(slice[j].x - slice[i].x, slice[j].z - slice[i].z);
      out.push({
        x: (slice[i].x + slice[j].x) * 0.5, y: yTop - keelH * 0.5, z: (slice[i].z + slice[j].z) * 0.5,
        sx: width * 0.6, sy: keelH, sz: Math.min(0.5, span * 0.5), yaw, pathId,
      });
    }
    return out;
  }

  _addRibbonRoad(pts, width, kind, closed, gap, isRail, pathId = null) {
    if (!pts || pts.length < 2) return;
    // Visual lift = alternating kiss layer (physics ride height unchanged)
    const yLift = pathId ? visualLiftFor(pathId) : ribbonYLift(kind);
    const halfW = width * 0.5;
    // Thick asphalt deck (ramp thicker)
    const thick = kind === "ramp" ? ASPHALT_THICK_RAMP
      : (kind === "balcony" ? ASPHALT_THICK_BALCONY : ASPHALT_THICK_FLOOR);

    const buildStrip = (slice) => {
      if (slice.length < 2) return;
      const left = [], right = [], tops = [];
      for (let i = 0; i < slice.length; i++) {
        const p = slice[i];
        const p0 = slice[Math.max(0, i - 1)];
        const p1 = slice[Math.min(slice.length - 1, i + 1)];
        let tx = p1.x - p0.x, tz = p1.z - p0.z;
        const tl = Math.hypot(tx, tz) || 1;
        tx /= tl; tz /= tl;
        const rx = -tz, rz = tx;
        left.push(new THREE.Vector3(p.x + rx * halfW, p.y + yLift, p.z + rz * halfW));
        right.push(new THREE.Vector3(p.x - rx * halfW, p.y + yLift, p.z - rz * halfW));
        tops.push(p.y + yLift);
      }
      // Top surface
      const pos = [];
      const uvs = [];
      const idx = [];
      let distAcc = 0;
      for (let i = 0; i < left.length; i++) {
        if (i > 0) distAcc += left[i].distanceTo(left[i - 1]);
        pos.push(left[i].x, left[i].y, left[i].z);
        pos.push(right[i].x, right[i].y, right[i].z);
        uvs.push(0, distAcc * 0.95, 1, distAcc * 0.95);
        if (i > 0) {
          const a = (i - 1) * 2, b = a + 1, c = i * 2, d = c + 1;
          // logic4: CCW seen from ABOVE (normal +Y). The old order (a,b,c / b,d,c) wound every
          // asphalt top face DOWNWARD, so FrontSide culling hid the whole road from the chase
          // cam: floors showed bare wood (Climb B foot / Climb A foot), ramps showed only the
          // untextured bottom slab. Only the spawn pad (separate mesh) ever read as asphalt.
          idx.push(a, c, b, b, c, d);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      // Ramps: dark asphalt + white edges + yellow center (Mario Kart readable).
      // Chevrons are foot markers only — never the whole ribbon.
      // logic16: oak runner only on the foyer floor roads; the climbs/balcony get jewel resins
      const MT = { climb_a: "emerald", landing_hairpin: "crimson", balcony_arc: "crimson", balcony_to_climb_b: "slate", climb_b: "plum" }[pathId];
      let mat = this._sharedMats.asphalt;
      if (MT) { this._mainThemeMats = this._mainThemeMats || {}; mat = this._mainThemeMats[MT] || (this._mainThemeMats[MT] = themeMaterial(MT)); }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = kind === "ramp" ? "ribbon_ramp" : (kind === "balcony" ? "ribbon_balcony" : "ribbon_floor");
      mesh.userData.ribbon = true;
      mesh.userData.kind = kind;
      mesh.receiveShadow = false;
      mesh.castShadow = false;
      this.root.add(mesh);

      // Thickness slab (vertical sides + bottom feel)
      const sidePos = [];
      const sideIdx = [];
      for (let i = 0; i < left.length; i++) {
        const L = left[i], R = right[i];
        sidePos.push(L.x, L.y, L.z, L.x, L.y - thick, L.z);
        sidePos.push(R.x, R.y, R.z, R.x, R.y - thick, R.z);
        if (i > 0) {
          const b = (i - 1) * 4;
          const c = i * 4;
          // left wall
          sideIdx.push(b, b + 1, c, b + 1, c + 1, c);
          // right wall
          sideIdx.push(b + 2, c + 2, b + 3, b + 3, c + 2, c + 3);
        }
      }
      const sideGeo = new THREE.BufferGeometry();
      sideGeo.setAttribute("position", new THREE.Float32BufferAttribute(sidePos, 3));
      sideGeo.setIndex(sideIdx);
      sideGeo.computeVertexNormals();
      this.root.add(new THREE.Mesh(sideGeo, this._sharedMats.side));

      // Ramp-only: bottom face + queued under-fill keels (InstancedMesh flush — GPU-lite)
      if (kind === "ramp") {
        const botPos = [];
        const botIdx = [];
        for (let i = 0; i < left.length; i++) {
          botPos.push(left[i].x, left[i].y - thick, left[i].z);
          botPos.push(right[i].x, right[i].y - thick, right[i].z);
          if (i > 0) {
            const a = (i - 1) * 2, b = a + 1, c = i * 2, d = c + 1;
            botIdx.push(a, b, c, b, d, c); // logic4: underside faces DOWN (was wound up)
          }
        }
        const botGeo = new THREE.BufferGeometry();
        botGeo.setAttribute("position", new THREE.Float32BufferAttribute(botPos, 3));
        botGeo.setIndex(botIdx);
        botGeo.computeVertexNormals();
        const botMesh = new THREE.Mesh(botGeo, this._sharedMats.side);
        botMesh.name = "ramp_bottom";
        this.root.add(botMesh);

        // logic8: keels are computed in the CPU logic pass (this.keels) — they are colliders
      }

      if (isRail && (kind === "balcony" || kind === "ramp")) {
        // Sparse posts → batched in _flushRailPosts as one InstancedMesh
        const step = Math.max(3, Math.floor(left.length / 8));
        for (const sidePts of [left, right]) {
          for (let i = 0; i < sidePts.length - 1; i += step) {
            const p = sidePts[i];
            this._railPostPositions.push({ x: p.x, y: p.y + 0.042, z: p.z });
          }
        }
      }
    };

    if (!gap) {
      buildStrip(pts);
      return;
    }
    // Split around spawn apron gap
    let run = [];
    for (const p of pts) {
      if (Math.hypot(p.x - gap.x, p.z - gap.z) < gap.r) {
        if (run.length >= 2) buildStrip(run);
        run = [];
      } else {
        run.push(p);
      }
    }
    if (run.length >= 2) buildStrip(run);
  }

  /** Red/white kerb strips — queued for one InstancedMesh flush (GPU-safe). */
  _addCurbRails(pts, width, kind) {
    if (!pts || pts.length < 2) return;
    const halfW = width * 0.5;
    const curbW = 0.42;
    const curbH = 0.085;
    const yLift = ribbonYLift(kind);
    const left = [], right = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[Math.min(pts.length - 1, i + 1)];
      let tx = p1.x - p0.x, tz = p1.z - p0.z;
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl; tz /= tl;
      const rx = -tz, rz = tx;
      left.push(new THREE.Vector3(p.x + rx * (halfW + curbW * 0.35), p.y + yLift + curbH * 0.5, p.z + rz * (halfW + curbW * 0.35)));
      right.push(new THREE.Vector3(p.x - rx * (halfW + curbW * 0.35), p.y + yLift + curbH * 0.5, p.z - rz * (halfW + curbW * 0.35)));
    }
    // Sparse segments — readability without hundreds of draw calls
    const step = Math.max(2, Math.floor(pts.length / 10));
    const bucket = this._curbSegmentPositions || (this._curbSegmentPositions = []);
    for (const side of [left, right]) {
      for (let i = 0; i < side.length - 1; i += step) {
        const a = side[i], b = side[Math.min(side.length - 1, i + step)];
        const len = a.distanceTo(b);
        if (len < 0.12) continue;
        const yaw = Math.atan2(b.x - a.x, b.z - a.z);
        const horiz = Math.hypot(b.x - a.x, b.z - a.z) || 1e-6;
        const pitch = -Math.atan2(b.y - a.y, horiz); // logic6: blocks follow the ramp grade
        // logic6: split each strip into alternating red/white blocks (~CURB_BLOCK_U long) —
        // more INSTANCES in the same single InstancedMesh, zero extra meshes.
        const nb = Math.max(1, Math.round(len / CURB_BLOCK_U));
        for (let k = 0; k < nb; k++) {
          const t = (k + 0.5) / nb;
          bucket.push({
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
            z: a.z + (b.z - a.z) * t,
            sx: curbW * 0.55,
            sy: curbH,
            sz: len / nb + 0.002,
            yaw,
            pitch,
            white: ((bucket.length) & 1) === 1,
          });
        }
      }
    }
  }

  /**
   * Warning band at climb ends (foot & crest kiss). logic3: flush painted band only —
   * the old 0.22u black bar sat ACROSS the road at every kiss (car drove through it).
   * Band sits above both kiss layers so it also hides the ramp/floor seam.
   */
  _addVoidBarriers(pts, width) {
    if (!pts || pts.length < 2) return;
    const matWarn = this._warnMat || (this._warnMat = new THREE.MeshLambertMaterial({
      color: 0xffcc33, emissive: 0xaa8800, emissiveIntensity: 0.22,
    }));
    for (const idx of [0, pts.length - 1]) {
      const p = pts[idx];
      const q = pts[idx === 0 ? 1 : pts.length - 2];
      const yaw = Math.atan2(p.x - q.x, p.z - q.z);
      const warn = new THREE.Mesh(new THREE.BoxGeometry(width - 0.04, 0.008, 0.16), matWarn);
      warn.position.set(p.x, p.y + VIS_BASE + VIS_LAYER + 0.006, p.z);
      warn.rotation.y = yaw;
      warn.name = "climb_end_band";
      warn.castShadow = false;
      warn.receiveShadow = false;
      this.root.add(warn);
    }
  }

  /**
   * Outer-edge chevrons on tight turns (hairpin corner + balcony bends). logic3: turns are
   * real arcs now, so detect by curvature (heading change per metre) instead of a sharp
   * control-point kink, paint them flat on the OUTER lane edge, and batch all of them
   * into ONE InstancedMesh (GPU-lite).
   */
  _addCornerChevrons(pts, width, pathId = null) {
    if (!pts || pts.length < 4) return;
    const bucket = this._cornerChevPositions || (this._cornerChevPositions = []);
    const halfW = width * 0.5;
    const yLift = (pathId ? visualLiftFor(pathId) : VIS_BASE) + 0.004;
    let lastS = -99;
    let s = 0;
    let placed = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      s += Math.hypot(b.x - a.x, b.z - a.z);
      const h0 = Math.atan2(b.x - a.x, b.z - a.z);
      const h1 = Math.atan2(c.x - b.x, c.z - b.z);
      let dh = h1 - h0;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const run = 0.5 * (Math.hypot(b.x - a.x, b.z - a.z) + Math.hypot(c.x - b.x, c.z - b.z)) || 1;
      const k = Math.abs(dh) / run; // rad per unit
      if (k < 0.55 || s - lastS < 1.4 || placed >= 4) continue;
      lastS = s;
      placed++;
      const tx = c.x - a.x, tz = c.z - a.z;
      const tl = Math.hypot(tx, tz) || 1;
      // Right-hand normal of travel; outer side = opposite the turn direction
      const rx = -tz / tl, rz = tx / tl;
      const outer = dh > 0 ? -1 : 1;
      const off = halfW - 0.24;
      bucket.push({
        x: b.x + rx * off * outer,
        y: b.y + yLift,
        z: b.z + rz * off * outer,
        yaw: Math.atan2(tx, tz),
      });
    }
  }

  _flushCornerChevrons() {
    const list = this._cornerChevPositions || [];
    this._cornerChevPositions = [];
    if (!list.length) return;
    const geo = new THREE.ConeGeometry(0.11, 0.24, 3);
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffe066, emissive: 0x886600, emissiveIntensity: 0.22,
    });
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    inst.name = "corner_chevrons_instanced";
    inst.castShadow = false;
    inst.receiveShadow = false;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      dummy.position.set(m.x, m.y, m.z);
      dummy.rotation.order = "YXZ";
      dummy.rotation.set(Math.PI / 2, m.yaw, 0);
      dummy.scale.set(1, 1, 0.12); // flat paint, not a 3D spike
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    this.root.add(inst);
  }


  /**
   * Discrete painted flow arrows at figure-8 junctions — lap direction only.
   * foyer→Climb A, hairpin, balcony→Climb B, finish. One InstancedMesh (GPU-lite).
   */
  _addJunctionFlowChevrons() {
    // logic3: derived from the 8 PRIMARY kisses (was a hand-typed list of 6 that
    // went stale whenever geometry moved). Lead + trail arrow on the SUCCESSOR path,
    // 0.55u / 0.95u past each kiss, oriented along its tangent → 16 instances, 1 draw.
    const byId = Object.fromEntries(TRACK_PATHS.map((p) => [p.id, p]));
    const marks = [];
    for (let i = 0; i < PRIMARY_CIRCUIT.length; i++) {
      const next = byId[PRIMARY_CIRCUIT[(i + 1) % PRIMARY_CIRCUIT.length]];
      if (!next) continue;
      const segs = this.segments.filter((sg) => sg.pathId === next.id);
      if (!segs.length) continue;
      for (const [d, scl] of [[0.55, 1.0], [0.95, 0.82]]) {
        let acc = 0;
        for (const sg of segs) {
          const L = Math.hypot(sg.b.x - sg.a.x, sg.b.z - sg.a.z);
          if (acc + L >= d) {
            const u = (d - acc) / Math.max(1e-6, L);
            marks.push({
              x: sg.a.x + (sg.b.x - sg.a.x) * u,
              y: sg.a.y + (sg.b.y - sg.a.y) * u + visualLiftFor(next.id) + 0.006,
              z: sg.a.z + (sg.b.z - sg.a.z) * u,
              yaw: Math.atan2(sg.b.x - sg.a.x, sg.b.z - sg.a.z),
              pitch: Math.atan2(sg.b.y - sg.a.y, Math.max(1e-6, L)),
              scl,
            });
            break;
          }
          acc += L;
        }
      }
    }
    if (!marks.length) return;
    const geo = new THREE.ConeGeometry(0.17, 0.36, 3);
    // Strengthened (#6) — brighter emissive so lap direction reads at a glance
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffee77, emissive: 0xcc8800, emissiveIntensity: 0.48,
    });
    const inst = new THREE.InstancedMesh(geo, mat, marks.length);
    inst.name = "junction_flow_chevrons";
    inst.castShadow = false;
    inst.receiveShadow = false;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < marks.length; i++) {
      const m = marks[i];
      dummy.position.set(m.x, m.y, m.z);
      dummy.rotation.order = "YXZ";
      dummy.rotation.set(Math.PI / 2 - m.pitch, m.yaw, 0);
      // Flat painted arrow (was a 0.34u-tall 3D spike the tiny car drove through)
      dummy.scale.set(m.scl, m.scl, 0.10 * m.scl);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    this.root.add(inst);
  }


  _flushUnderfill() {
    const list = this.keels || [];
    if (!list.length || !this._sharedMats) return;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const inst = new THREE.InstancedMesh(geo, this._sharedMats.side, list.length);
    inst.name = "ramp_underfill";
    inst.castShadow = false;
    inst.receiveShadow = false;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      dummy.position.set(u.x, u.y, u.z);
      dummy.rotation.set(0, u.yaw || 0, 0);
      dummy.scale.set(u.sx, u.sy, u.sz);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    this.root.add(inst);
  }

    _addClimbChevrons(pts, width) {
    // Chevrons at FEET only (vision) — 3 painted arrows along first ~1.4 m of ribbon
    if (!pts || pts.length < 2) return;
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffe066, emissive: 0xaa8800, emissiveIntensity: 0.42,
    });
    let acc = 0;
    const marks = [];
    for (let i = 0; i < pts.length - 1 && marks.length < 2; i++) {
      const a = pts[i], b = pts[i + 1];
      const seg = a.distanceTo(b);
      const need = [0.18, 0.85]; // 2 arrows at foot only
      for (const d of need) {
        if (marks.length >= 2) break;
        if (acc <= d && acc + seg >= d) {
          const u = (d - acc) / Math.max(1e-6, seg);
          marks.push({
            x: a.x + (b.x - a.x) * u,
            y: a.y + (b.y - a.y) * u,
            z: a.z + (b.z - a.z) * u,
            yaw: Math.atan2(b.x - a.x, b.z - a.z),
          });
        }
      }
      acc += seg;
      if (acc > 1.45) break;
    }
    for (const m of marks) {
      const marker = new THREE.Mesh(new THREE.ConeGeometry(width * 0.16, 0.09, 3), mat);
      marker.rotation.order = "YXZ";
      marker.rotation.set(Math.PI / 2, m.yaw, 0);
      marker.position.set(m.x, m.y + 0.055, m.z);
      marker.name = "climb_foot_chevron";
      marker.castShadow = false;
      marker.receiveShadow = false;
      this.root.add(marker);
    }
  }

  /**
   * Binary snap: onTrack only when wheels are on a ribbon.
   * Carpet = supported story floor off-ribbon (no onTrack).
   * Strong hysteresis: prefer _lastPathId unless intentional junction.
   */
  querySnap(x, y, z, radius = 2.4, carYaw = null) {
    const storyFloors = [8.4 + ASPHALT_RIDE, 4.2 + ASPHALT_RIDE, ASPHALT_RIDE, -4.2 + ASPHALT_RIDE];
    let storyY = null;
    let storyDy = 0.42;
    for (const f of storyFloors) {
      const d = Math.abs(y - f);
      if (d < storyDy) { storyDy = d; storyY = f; }
    }
    const onFloorCruise = storyY != null;

    const candidates = this._snapGrid.size
      ? this._segmentsNear(x, z, radius)
      : this.segments;

    let best = null;
    let bestScore = Infinity;
    let lastBest = null;
    let lastBestScore = Infinity;

    for (const seg of candidates) {
      const abx = seg.b.x - seg.a.x;
      const aby = seg.b.y - seg.a.y;
      const abz = seg.b.z - seg.a.z;
      const apx = x - seg.a.x;
      const apy = y - seg.a.y;
      const apz = z - seg.a.z;
      const steep = Math.abs(aby) > Math.abs(abx) * 0.45 + Math.abs(abz) * 0.45;
      const foyerClimbXZ = (seg.pathId === "climb_a"
          && (this._lastPathId === "climb_a" || this._lastPathId === "foyer_to_climb_a"
            || this._lastPathId === "foyer_sf"))
        || (seg.pathId === "climb_b"
          && (this._lastPathId === "climb_b" || this._lastPathId === "balcony_to_climb_b"
            || this._lastPathId === "balcony_arc"));

      let tRaw;
      if (foyerClimbXZ) {
        const abLenSq = abx * abx + abz * abz;
        tRaw = abLenSq > 1e-8 ? (apx * abx + apz * abz) / abLenSq : 0;
      } else if (steep || seg.kind === "ramp") {
        const abLenSq = abx * abx + aby * aby + abz * abz;
        tRaw = abLenSq > 1e-8 ? (apx * abx + apy * aby + apz * abz) / abLenSq : 0;
      } else {
        const abLenSq = abx * abx + abz * abz;
        tRaw = abLenSq > 1e-8 ? (apx * abx + apz * abz) / abLenSq : 0;
      }
      const t = Math.max(0, Math.min(1, tRaw));
      const px = seg.a.x + abx * t;
      const py = seg.a.y + aby * t;
      const pz = seg.a.z + abz * t;
      const dist = Math.hypot(x - px, z - pz);
      const dist3 = Math.hypot(x - px, y - py, z - pz);
      const dy = Math.abs(y - py);
      const elev = ELEV_KINDS.has(seg.kind);
      const isFloor = FLOOR_KINDS.has(seg.kind);
      const flatDeck = seg.kind === "balcony" || seg.kind === "elevated" || seg.kind === "cornice";
      const signedBelow = py - y;
      const halfApprox = seg.width * 0.5;
      const foyerClimbSeg = seg.pathId === "climb_a" || seg.pathId === "climb_b";
      const corridorMul = foyerClimbSeg ? 2.25 : 1.12;
      const contMul = foyerClimbSeg ? 2.55 : 1.40;
      const checkDist = steep ? dist3 : dist;
      const inRampCorridor = seg.kind === "ramp" && checkDist < halfApprox * corridorMul;
      const rampContinuity = seg.kind === "ramp" && this._lastPathId === seg.pathId
        && checkDist < halfApprox * contMul;

      // Leave climb crest after handoff
      if (seg.kind === "ramp" && t > 0.72
          && this._lastPathId && this._lastPathId !== seg.pathId
          && (this._lastPathKind === "floor" || this._lastPathKind === "balcony")) {
        continue;
      }
      if (seg.pathId === "climb_a" && y >= 3.90
          && (this._lastPathId === "landing_hairpin"
            || this._lastPathId === "balcony_arc"
            || this._lastPathId === "balcony_to_climb_b"
            || this._lastPathId === "climb_b"
            || this._lastPathId === "foyer_finish")) {
        continue;
      }
      if (seg.pathId === "climb_b" && y <= 0.55
          && (this._lastPathId === "foyer_sf" || this._lastPathId === "foyer_finish"
            || this._lastPathId === "foyer_to_climb_a")) {
        continue;
      }

      if (flatDeck && signedBelow > 0.28) continue;
      if (seg.kind === "ramp") {
        const underMax = (inRampCorridor || rampContinuity) ? 0.58 : 0.32;
        if (signedBelow > underMax) continue;
      }
      if (onFloorCruise && elev && !inRampCorridor && !rampContinuity
          && dy > 0.45 && Math.abs(py - storyY) > 0.5) {
        continue;
      }

      const heightBand = elev
        ? (flatDeck ? 0.72 : (seg.kind === "ramp" && (inRampCorridor || rampContinuity) ? 1.15 : 0.95))
        : 2.8;
      const useRadius = elev ? radius * 0.85 : (isFloor ? radius * 1.45 : radius * 1.2);
      if (dy > heightBand || checkDist > useRadius) continue;

      const dyW = elev ? 3.4 : (isFloor ? 0.55 : 1.1);
      let pathBias = (this._lastPathId && seg.pathId === this._lastPathId) ? -0.92 : 0;
      const floorBias = (onFloorCruise && isFloor && dy < 0.28) ? -0.22 : 0;

      const rampGrade = seg.kind === "ramp"
        ? Math.abs(aby) / Math.max(1e-4, Math.hypot(abx, abz)) : 0;
      const climbAFootDist = Math.hypot(x - FOYER_CLIMB_FOOT.x, z - FOYER_CLIMB_FOOT.z);
      const climbBFootDist = Math.hypot(x - CLIMB_B_FOOT.x, z - CLIMB_B_FOOT.z);
      const climbBCrestDist = Math.hypot(x - CLIMB_B_CREST.x, z - CLIMB_B_CREST.z);
      // Climb A: engage at low foot. Climb B: crest when approaching from balcony, foot at foyer tip.
      const foyerFootEngage = (seg.pathId === "climb_a" && climbAFootDist < FOYER_CLIMB_ENGAGE_R)
        || (seg.pathId === "climb_b" && (
          ((this._lastPathId === "balcony_to_climb_b" || this._lastPathId === "balcony_arc"
            || this._lastPathId === "climb_b") && climbBCrestDist < CLIMB_B_ENGAGE_R)
          || (y <= 0.55 && climbBFootDist < CLIMB_B_ENGAGE_R)
        ));

      let rampBias = 0;
      if (seg.kind === "ramp" && signedBelow <= ((inRampCorridor || rampContinuity) ? 0.55 : 0.28) && dy < 0.72) {
        if (foyerClimbSeg) {
          if (rampContinuity || (foyerFootEngage && inRampCorridor)) {
            rampBias = -1.05 - Math.min(0.45, rampGrade * 0.75);
          }
        } else if (inRampCorridor || rampContinuity) {
          rampBias = -1.25 - Math.min(0.55, rampGrade * 0.85);
        }
      }
      if (rampBias && rampGrade < 0.08 && seg.pathId !== "climb_a" && seg.pathId !== "climb_b") {
        rampBias *= (inRampCorridor && checkDist < halfApprox) ? 0.88 : 0.28;
      }
      if (rampBias && foyerFootEngage) rampBias -= 0.35;
      // Climb A crest release (#9) — past tip, drop ramp/path magnet so hairpin can win
      if (seg.pathId === "climb_a" && this._lastPathId === "climb_a"
          && y >= 4.0 && tRaw > 0.90) {
        rampBias *= 0.12;
        pathBias *= 0.20;
      }
      // Climb B foot release into foyer_finish (mirror Climb A crest #9).
      if (seg.pathId === "climb_b" && this._lastPathId === "climb_b"
          && y <= 0.35 && tRaw > 0.82) {
        rampBias *= 0.12;
        pathBias *= 0.20;
      }

      // Intentional junction bonuses — open circuit unique kisses (no oval-steal war)
      let junctionBias = 0;
      if (!pathBias) {
        if (seg.pathId === "climb_a"
            && (this._lastPathId === "foyer_to_climb_a" || this._lastPathId === "foyer_sf")
            && foyerFootEngage) {
          junctionBias = -0.55;
        }
        if (seg.pathId === "landing_hairpin"
            && this._lastPathId === "climb_a"
            && y >= 3.85 && dist < halfApprox * 1.4) {
          junctionBias = y >= 4.0 ? -1.55 : -0.70;
        }
        if (seg.pathId === "balcony_arc"
            && this._lastPathId === "landing_hairpin"
            && dist < halfApprox * 1.3) {
          junctionBias = -0.55;
        }
        if (seg.pathId === "balcony_to_climb_b"
            && this._lastPathId === "balcony_arc"
            && dist < halfApprox * 1.3) {
          junctionBias = -0.45;
        }
        if (seg.pathId === "climb_b"
            && (this._lastPathId === "balcony_to_climb_b" || this._lastPathId === "balcony_arc")
            && foyerFootEngage) {
          junctionBias = -0.55;
        }
        if (seg.pathId === "foyer_finish"
            && this._lastPathId === "climb_b"
            && y < 0.55 && dist < halfApprox * 1.4) {
          junctionBias = y <= 0.35 ? -1.55 : -0.70;
        }
        if (seg.pathId === "foyer_sf"
            && this._lastPathId === "foyer_finish"
            && dist < halfApprox * 1.3) {
          junctionBias = -0.45;
        }
        if (seg.pathId === "foyer_to_climb_a"
            && this._lastPathId === "foyer_sf"
            && dist < halfApprox * 1.3) {
          junctionBias = -0.45;
        }
        // Floor re-engage when drifted onto another floor ribbon under wheels
        if (isFloor && this._lastPathKind === "floor" && dist < halfApprox * 0.95 && dy < 0.2) {
          junctionBias = -0.15;
        }
      }

      // Endpoint clamp penalty — equal scores at joints used to freeze Climb B descent
      // (car past seg A end tied with seg B interior; earlier seg won forever).
      let score = checkDist + dy * dyW + pathBias + floorBias + rampBias + junctionBias;
      if (tRaw < -0.02 || tRaw > 1.02) score += 0.12;
      else if (tRaw < 0 || tRaw > 1) score += 0.05;
      const sample = {
        x: px, y: py + ribbonYLift(seg.kind), z: pz,
        dist, dist3, dy, t, seg, kind: seg.kind, pathId: seg.pathId,
        width: seg.width, yaw: Math.atan2(abx, abz),
        grade: seg.grade || 0, bank: 0,
        elevated: !!seg.elevated, steep,
        inRampCorridor, rampContinuity, halfApprox, checkDist,
      };

      if (score < bestScore) { bestScore = score; best = sample; }
      if (this._lastPathId && seg.pathId === this._lastPathId && score < lastBestScore) {
        lastBestScore = score;
        lastBest = sample;
      }
    }

    // Strong hysteresis: keep last path unless challenger clearly better / intentional junction
    let chosen = best;
    if (lastBest && best) {
      const same = best.pathId === lastBest.pathId;
      if (!same) {
        const lastOn = lastBest.checkDist < lastBest.halfApprox * 1.05;
        const bestOn = best.checkDist < best.halfApprox * 1.05;
        const clearlyCloser = best.checkDist + 0.22 < lastBest.checkDist;
        const intentional =
          (best.pathId === "climb_a"
            && (this._lastPathId === "foyer_to_climb_a" || this._lastPathId === "foyer_sf")
            && Math.hypot(x - FOYER_CLIMB_FOOT.x, z - FOYER_CLIMB_FOOT.z) < FOYER_CLIMB_ENGAGE_R)
          || (best.pathId === "landing_hairpin" && this._lastPathId === "climb_a" && y >= 3.85)
          || (best.pathId === "balcony_arc" && this._lastPathId === "landing_hairpin")
          || (best.pathId === "balcony_to_climb_b" && this._lastPathId === "balcony_arc")
          || (best.pathId === "climb_b"
            && (this._lastPathId === "balcony_to_climb_b" || this._lastPathId === "balcony_arc")
            && Math.hypot(x - CLIMB_B_CREST.x, z - CLIMB_B_CREST.z) < CLIMB_B_ENGAGE_R)
          || (best.pathId === "foyer_finish" && this._lastPathId === "climb_b" && y < 0.55)
          || (best.pathId === "foyer_sf" && this._lastPathId === "foyer_finish")
          || (best.pathId === "foyer_to_climb_a" && this._lastPathId === "foyer_sf")
          || (bestOn && !lastOn);
        if (lastOn && !intentional && !clearlyCloser) {
          chosen = lastBest;
        } else if (!intentional && lastOn && bestOn && bestScore > lastBestScore - 0.35) {
          chosen = lastBest;
        }
      }
    } else if (lastBest && !best) {
      chosen = lastBest;
    }

    // Spawn apron: asphalt feel, latch ONLY foyer_sf
    const apron = this._spawnApron;
    const onApron = apron && Math.abs(y - apron.y) < 0.35
      && Math.hypot(x - apron.x, z - apron.z) < apron.r;

    if (!chosen) {
      if (onApron || (storyY != null && storyDy < 0.35)) {
        // Apron.y is plank top; storyY is already ride height from storyFloors
        const carpetY = onApron ? (apron.y + ASPHALT_RIDE) : storyY;
        if (onApron) {
          this._lastPathId = "foyer_sf";
          this._lastPathKind = "floor";
        }
        return {
          x, y: carpetY, z,
          onTrack: !!onApron,
          supported: true,
          carpet: !onApron,
          nearDeck: false,
          elevated: false,
          kind: "floor",
          pathId: onApron ? "foyer_sf" : null,
          dist: onApron ? Math.hypot(x - apron.x, z - apron.z) : 0,
          yaw: carYaw,
          grade: 0, bank: 0,
          edgeMargin: onApron ? 0.4 : 0,
        };
      }
      return {
        x, y, z, onTrack: false, supported: false, carpet: false,
        nearDeck: false, elevated: false, kind: null, pathId: null,
        dist: 99, yaw: carYaw, grade: 0, bank: 0, edgeMargin: 0,
      };
    }

    const halfW = chosen.halfApprox;
    const lat = chosen.checkDist;
    const onRibbon = lat <= halfW * 1.02;
    let nearDeck = !onRibbon && chosen.elevated && lat <= halfW * 1.55 && chosen.dy < 0.55;
    const edgeMargin = halfW - lat;
    // Climb approach apron: A uses A foot; B uses B foot at foyer / B crest on landing
    if (!onRibbon && chosen.pathId === "climb_a"
        && storyY != null && storyDy < 0.55) {
      const fd = Math.hypot(x - FOYER_CLIMB_FOOT.x, z - FOYER_CLIMB_FOOT.z);
      if (fd < FOYER_CLIMB_ENGAGE_R) nearDeck = true;
    }
    if (!onRibbon && chosen.pathId === "climb_b" && storyY != null && storyDy < 0.55) {
      if (y <= 1.2) {
        const fd = Math.hypot(x - CLIMB_B_FOOT.x, z - CLIMB_B_FOOT.z);
        if (fd < CLIMB_B_ENGAGE_R) nearDeck = true;
      } else if (y >= 3.5) {
        const cd = Math.hypot(x - CLIMB_B_CREST.x, z - CLIMB_B_CREST.z);
        if (cd < CLIMB_B_ENGAGE_R) nearDeck = true;
      }
    }

    // Carpet fallback: off-ribbon floor = supported crawl, NEVER onTrack (binary)
    if (!onRibbon && !nearDeck && FLOOR_KINDS.has(chosen.kind) && storyY != null && storyDy < 0.45) {
      return {
        x, y: storyY + 0.015, z,
        onTrack: false, supported: true, carpet: true,
        nearDeck: false, elevated: false,
        kind: "floor", pathId: null,
        dist: lat, yaw: carYaw, grade: 0, bank: 0, edgeMargin: 0,
      };
    }

    if (onRibbon || nearDeck || chosen.rampContinuity) {
      this._lastPathId = chosen.pathId;
      this._lastPathKind = chosen.kind;
    }

    return {
      x: chosen.x,
      y: chosen.y,
      z: chosen.z,
      onTrack: onRibbon,
      supported: onRibbon || nearDeck || (FLOOR_KINDS.has(chosen.kind) && storyY != null),
      carpet: false,
      nearDeck: nearDeck && !onRibbon,
      elevated: !!chosen.elevated,
      steep: !!chosen.steep,
      kind: chosen.kind,
      pathId: chosen.pathId,
      dist: lat,
      yaw: chosen.yaw,
      grade: chosen.grade,
      bank: 0,
      edgeMargin,
      rampContinuity: !!chosen.rampContinuity,
      width: chosen.width,
    };
  }

  /** Escape only to SAME path or very near (≤1.15m) — no room-crossing teleport. */
  findEscapeSnap(x, y, z, radius = 2.4) {
    const r = Math.min(radius, 1.15);
    const snap = this.querySnap(x, y, z, r, null);
    if (!snap || !snap.pathId) return null;
    if (this._lastPathId && snap.pathId !== this._lastPathId) {
      const d = Math.hypot((snap.x ?? x) - x, (snap.z ?? z) - z);
      if (d > 1.15) return null;
    }
    if (!snap.onTrack && !snap.nearDeck) return null;
    const d = Math.hypot((snap.x ?? x) - x, (snap.z ?? z) - z);
    if (d > 1.15) return null;
    return snap;
  }

  onBoostPad() { return false; }

  nearestCheckpoint(x, z, radius = 2.4, y = null) {
    let best = null, bestD = radius;
    for (const cp of this.checkpoints) {
      if (y != null && Math.abs(cp.pos.y - y) > 1.8) continue;
      const d = Math.hypot(cp.pos.x - x, cp.pos.z - z);
      if (d < bestD) { bestD = d; best = cp; }
    }
    return best;
  }

  nearestPortal() { return null; }

  updateVisuals() { /* no animated banners in clean build */ }

  setVisible(v) {
    const mode = v === true || v === "drive" ? "drive"
      : v === "explore" || v === "portals" ? "explore"
        : "off";
    this._visMode = mode;
    if (mode === "off") {
      this.root.visible = false;
      return;
    }
    if (mode === "drive" && !this._meshesBuilt) this.ensureMeshes();
    // Explore: keep group off so renderer skips roads; also clear mesh.visible
    // flags so audits that ignore parent visibility still see asphalt hidden.
    if (mode === "explore") {
      this.root.visible = false;
      this.root.traverse((obj) => {
        if (!obj.isMesh && !obj.isLine && !obj.isPoints) return;
        obj.visible = !!obj.userData.exploreHint;
      });
      return;
    }
    this.root.visible = true;
    this.root.traverse((obj) => {
      if (!obj.isMesh && !obj.isLine && !obj.isPoints) return;
      obj.visible = true;
    });
  }
}
