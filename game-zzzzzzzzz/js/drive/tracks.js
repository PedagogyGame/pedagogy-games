import * as THREE from "three";
import { TRACK_PATHS, CAR_SPAWN } from "../data/tracks.js";

function makeCanvas(w, h) {
  if (typeof document !== "undefined" && document.createElement) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  return null;
}

function makeAsphaltTexture() {
  // Solid black asphalt + white shoulder dashes + yellow center lane
  // (baked into one texture — no coplanar line meshes / no wood-plank look).
  const c = makeCanvas(256, 256);
  if (!c) return null;
  c.width = 256; c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1a1a22";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const v = 22 + Math.random() * 38;
    ctx.fillStyle = `rgba(${v},${v},${v + 3},0.38)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  // Soft white shoulder dashes (texture-only — no junction star meshes)
  ctx.strokeStyle = "rgba(230,230,235,0.55)";
  ctx.lineWidth = 3.5;
  ctx.setLineDash([10, 14]);
  ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(22, 256); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(234, 0); ctx.lineTo(234, 256); ctx.stroke();
  // Yellow center lane dashes
  ctx.strokeStyle = "rgba(235,195,45,0.85)";
  ctx.lineWidth = 5;
  ctx.setLineDash([16, 14]);
  ctx.beginPath();
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function makeChevronTexture() {
  const c = makeCanvas(128, 256);
  if (!c) return null;
  const ctx = c.getContext("2d");
  // Bright climb asphalt — readable on dark wood floors (not stealth black blocks)
  ctx.fillStyle = "#3a424e";
  ctx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 400; i++) {
    const v = 55 + Math.random() * 40;
    ctx.fillStyle = `rgba(${v},${v + 4},${v + 10},0.35)`;
    ctx.fillRect(Math.random() * 128, Math.random() * 256, 2, 2);
  }
  // White shoulders
  ctx.strokeStyle = "rgba(245,245,250,0.75)";
  ctx.lineWidth = 5;
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(14, 256); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(114, 0); ctx.lineTo(114, 256); ctx.stroke();
  // Strong yellow chevrons (climb language)
  ctx.strokeStyle = "#f0d24a";
  ctx.lineWidth = 4.5;
  ctx.globalAlpha = 0.95;
  for (let y = 18; y < 256; y += 40) {
    ctx.beginPath();
    ctx.moveTo(32, y + 16);
    ctx.lineTo(64, y);
    ctx.lineTo(96, y + 16);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makePetalTexture() {
  const c = makeCanvas(128, 128);
  if (!c) return null;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#4a3a2a";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 80; i++) {
    const hues = ["#e91e63", "#f48fb1", "#ffcdd2", "#ce93d8", "#fff59d"];
    ctx.fillStyle = hues[i % hues.length];
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * 128, Math.random() * 128,
      2 + Math.random() * 4, 1 + Math.random() * 2,
      Math.random() * Math.PI, 0, Math.PI * 2
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeHollowTexture() {
  const c = makeCanvas(128, 128);
  if (!c) return null;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1a1410";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 200; i++) {
    const v = 30 + Math.random() * 40;
    ctx.fillStyle = `rgba(${v},${v - 8},${v - 14},0.35)`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 3, 2);
  }
  // faint timber grain
  ctx.strokeStyle = "rgba(80,55,35,0.25)";
  ctx.lineWidth = 1;
  for (let y = 8; y < 128; y += 10) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y) * 2);
    ctx.lineTo(128, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Premium dark-wood cornice deck with gold inlay channel. */
function makeCorniceDeckTexture() {
  const c = makeCanvas(256, 256);
  if (!c) return null;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2a1810";
  ctx.fillRect(0, 0, 256, 256);
  // plank grain
  for (let y = 0; y < 256; y += 28) {
    ctx.fillStyle = "#3e2723";
    ctx.fillRect(0, y, 256, 26);
    ctx.fillStyle = "rgba(20,10,6,0.45)";
    ctx.fillRect(0, y + 25, 256, 2);
    ctx.fillStyle = "rgba(90,60,40,0.2)";
    for (let x = ((y / 28) % 2) * 40; x < 256; x += 80) {
      ctx.fillRect(x, y, 2, 26);
    }
    // grain lines
    ctx.strokeStyle = "rgba(60,35,20,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 8 + Math.sin(y) * 2);
    ctx.lineTo(256, y + 10);
    ctx.stroke();
  }
  // gold center inlay
  const g = ctx.createLinearGradient(118, 0, 138, 0);
  g.addColorStop(0, "#8a6a1a");
  g.addColorStop(0.4, "#f0d060");
  g.addColorStop(0.6, "#ffe082");
  g.addColorStop(1, "#8a6a1a");
  ctx.fillStyle = g;
  ctx.fillRect(120, 0, 16, 256);
  ctx.fillStyle = "rgba(255,236,179,0.5)";
  ctx.fillRect(126, 0, 4, 256);
  // edge brass rails hint
  ctx.fillStyle = "#c9a227";
  ctx.fillRect(6, 0, 5, 256);
  ctx.fillRect(245, 0, 5, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeStartFinishTexture() {
  const c = makeCanvas(128, 64);
  if (!c) return null;
  const ctx = c.getContext("2d");
  const n = 8;
  for (let i = 0; i < n; i++) {
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

const ELEV_KINDS = new Set(["elevated", "cornice", "balcony", "ramp", "shortcut", "mouse", "shaft", "chute"]);
const TUBE_KINDS = new Set(["shortcut", "mouse", "shaft", "tunnel", "chute"]);
const FLOOR_KINDS = new Set(["floor", "outdoor", "flower"]);

/** Ribbon top offset matching _addRibbonRoad yLift — snap ride height must equal visual asphalt. */
function ribbonYLift(kind) {
  if (kind === "outdoor" || kind === "flower") return 0.016;
  if (kind === "ramp") return 0.018;
  if (kind === "elevated" || kind === "cornice" || kind === "balcony") return 0.016;
  return 0.015; // floor + default
}

/**
 * Builds road meshes from TRACK_PATHS and provides nearest-track snap queries.
 */
export class TrackSystem {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = "drive_tracks";
    scene.add(this.root);
    this.segments = [];
    this.checkpoints = [];
    this.portals = [];
    this.boostPads = [];
    this._lastPathId = null;
    this._lastPathKind = null;
    this._asphalt = makeAsphaltTexture();
    this._chevron = makeChevronTexture();
    this._petal = makePetalTexture();
    this._hollow = makeHollowTexture();
    this._corniceDeck = makeCorniceDeckTexture();
    this._startFinish = makeStartFinishTexture();
    this._bannerMats = [];
    this._tmp = new THREE.Vector3();
    this._moteMats = [];
    this._speedGates = [];
    this._sharedMats = this._makeSharedRoadMats();
    this._gridCell = 2.5;
    this._snapGrid = new Map(); // "ix,iz" -> segment index[]
    this._gridOriginX = 0;
    this._gridOriginZ = 0;
    this._visTick = 0;
    this._buildAll();
  }

  _buildAll() {
    // Apron first so foyer_skirting visual gap matches pad radius (no sliver overlap)
    this._addSpawnPad();
    for (const path of TRACK_PATHS) {
      if (path.disabled) continue;
      this._buildPath(path);
    }
    this._buildSnapGrid();
    const cells = this._snapGrid.size;
    let meshCount = 0;
    this.root.traverse((o) => { if (o.isMesh) meshCount++; });
    console.log(
      `[TrackSystem] segments=${this.segments.length} meshes=${meshCount} snapGrid=${cells} cells @ ${this._gridCell}m (querySnap uses grid, not full scan)`
    );
    this._meshCount = meshCount;
  }

  /** XZ uniform grid so querySnap only tests nearby segment indices. */
  _buildSnapGrid() {
    this._snapGrid = new Map();
    const cell = this._gridCell;
    if (!this.segments.length) return;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const seg of this.segments) {
      minX = Math.min(minX, seg.a.x, seg.b.x);
      maxX = Math.max(maxX, seg.a.x, seg.b.x);
      minZ = Math.min(minZ, seg.a.z, seg.b.z);
      maxZ = Math.max(maxZ, seg.a.z, seg.b.z);
    }
    this._gridOriginX = minX;
    this._gridOriginZ = minZ;
    const pad = 1; // cells of slack for radius queries
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const ax = Math.min(seg.a.x, seg.b.x) - seg.width;
      const bx = Math.max(seg.a.x, seg.b.x) + seg.width;
      const az = Math.min(seg.a.z, seg.b.z) - seg.width;
      const bz = Math.max(seg.a.z, seg.b.z) + seg.width;
      const ix0 = Math.floor((ax - this._gridOriginX) / cell) - pad;
      const ix1 = Math.floor((bx - this._gridOriginX) / cell) + pad;
      const iz0 = Math.floor((az - this._gridOriginZ) / cell) - pad;
      const iz1 = Math.floor((bz - this._gridOriginZ) / cell) + pad;
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
    const cell = this._gridCell;
    const r = radius + 1.5;
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
   * ONE continuous apron under CAR_SPAWN — solid dark asphalt + soft yellow
   * center dashes only. No ring, no stacked ribbons (foyer_skirting is gapped).
   * Kills spawn z-fighting / flitting shards / starburst.
   */
  _addSpawnPad() {
    const sx = CAR_SPAWN.x;
    const sz = CAR_SPAWN.z;
    // Dedicated apron texture (not shared UV swimming with ribbon)
    let map = null;
    const c = makeCanvas(256, 256);
    if (c) {
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#1a1a20";
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 500; i++) {
        const v = 26 + Math.random() * 40;
        ctx.fillStyle = `rgba(${v},${v},${v + 4},0.28)`;
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
      }
      // Real road markings: white shoulders + yellow center
      ctx.strokeStyle = "rgba(230,230,235,0.60)";
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 14]);
      ctx.beginPath(); ctx.moveTo(28, 8); ctx.lineTo(28, 248); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(228, 8); ctx.lineTo(228, 248); ctx.stroke();
      ctx.strokeStyle = "rgba(235,195,45,0.88)";
      ctx.lineWidth = 6;
      ctx.setLineDash([20, 14]);
      ctx.beginPath();
      ctx.moveTo(128, 8);
      ctx.lineTo(128, 248);
      ctx.stroke();
      map = new THREE.CanvasTexture(c);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 4;
      map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
      map.generateMipmaps = true;
      map.minFilter = THREE.LinearMipmapLinearFilter;
      map.magFilter = THREE.LinearFilter;
    }
    const mat = new THREE.MeshStandardMaterial({
      color: map ? 0xffffff : 0x1a1a20,
      roughness: 0.86,
      metalness: 0.05,
      ...(map ? { map } : {}),
      // Single mesh above carpet — slight bias only, no stacked layers
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      depthWrite: true,
    });
    // Wide solid start pad — matches foyer_drive_start width into open foyer
    const apronW = 3.4;
    const apronD = 4.0;
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(apronW, apronD), mat);
    pad.rotation.x = -Math.PI / 2;
    pad.rotation.z = CAR_SPAWN.yaw || 0; // dashes / pad align with travel
    pad.position.set(sx, 0.075, sz);
    pad.receiveShadow = true;
    pad.castShadow = false;
    pad.renderOrder = 2;
    pad.name = "spawn_clean_pad";
    pad.frustumCulled = true;
    this.root.add(pad);
    this._spawnApron = { x: sx, z: sz, r: 2.25 };
  }

  _buildPath(path) {
    let pts = path.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    // Preserve story floors. Only normalize near-ground asphalt so ribbon Y matches
    // ramp feet (authored ~0.06). NEVER flatten landing/attic/cellar to ground.
    const STORY_BANDS = [-4.05, 0.06, 4.26, 8.46];
    if (path.kind === "floor" || path.kind === "outdoor" || path.kind === "flower") {
      pts = pts.map((v) => {
        let best = v.y;
        let bd = Infinity;
        for (const s of STORY_BANDS) {
          const d = Math.abs(v.y - s);
          if (d < bd && d < 0.55) { bd = d; best = s; }
        }
        // Outdoor / flower stay slightly proud of indoor asphalt when near ground
        if ((path.kind === "outdoor" || path.kind === "flower") && Math.abs(best - 0.06) < 0.01) {
          best = 0.08;
        }
        return new THREE.Vector3(v.x, best, v.z);
      });
    }
    if (pts.length < 2) return;
    // Drop duplicate closed endpoint (avoids knot / double-cap at loop seams)
    if (path.closed && pts.length > 2 && pts[0].distanceTo(pts[pts.length - 1]) < 0.05) {
      pts = pts.slice(0, -1);
    }
    const width = path.width || 1.2;
    const kind = path.kind || "floor";
    const tension = path.tension != null ? path.tension : 0.22;
    // Floor asphalt AND elevated/ramp/cornice/balcony: ONE continuous ribbon mesh (no BoxGeometry plank stacks)
    const useRibbon = kind === "floor" || kind === "outdoor" || kind === "flower" || kind === "tunnel"
      || kind === "elevated" || kind === "ramp" || kind === "cornice" || kind === "balcony";
    // door_* strips: keep snap + thin visible ribbon (asphalt texture has yellow dashes only —
    // no white edge lines, so foyer junctions no longer starburst/z-fight)
    const isDoorStrip = typeof path.id === "string" && path.id.startsWith("door_");
    const visualOk = path.visual !== false;

    if (isDoorStrip && pts.length >= 2) {
      const inset = Math.min(width * 0.85, 0.28);
      if (pts.length === 2) {
        const dir = new THREE.Vector3().subVectors(pts[1], pts[0]);
        const len = dir.length();
        if (len > inset * 2.2) {
          dir.normalize();
          pts[0].addScaledVector(dir, inset);
          pts[1].addScaledVector(dir, -inset * 0.35);
        }
      } else {
        const d0 = new THREE.Vector3().subVectors(pts[1], pts[0]);
        if (d0.length() > inset * 1.2) {
          d0.normalize();
          pts[0].addScaledVector(d0, inset);
        }
      }
    }

    // Visual densify (ribbon beauty) vs coarser snap densify (querySnap cost)
    let visualPts = pts;
    let snapPts = pts;
    if (pts.length >= 3) {
      const curve = new THREE.CatmullRomCurve3(pts, !!path.closed, "catmullrom", tension);
      const elevFancy = kind === "elevated" || kind === "cornice" || kind === "ramp" || kind === "balcony";
      const tubeish = kind === "shortcut" || kind === "mouse" || kind === "shaft" || kind === "chute";
      const floorish = kind === "floor" || kind === "outdoor";
      // Visual densify kept low for draw-call/FPS; snap stays reliable on curves
      const visDense = elevFancy ? (path.fancy ? 3 : 2)
        : tubeish ? 2
          : kind === "flower" || kind === "tunnel" ? 2
            : floorish ? 2 : 2;
      // Snap densify: elevated/tube need curve support; floor coarser
      const snapDense = elevFancy ? (path.fancy ? 5 : (path.closed ? 4 : 3))
        : tubeish ? 3
          : floorish ? 2 : 2;
      const visN = Math.max(pts.length * visDense, path.fancy ? 20 : (useRibbon && visualOk ? 12 : 8));
      const snapN = Math.max(pts.length * snapDense, path.fancy ? 14 : (useRibbon ? 10 : 8));
      visualPts = curve.getPoints(visN);
      snapPts = curve.getPoints(snapN);
      // Closed curves: getPoints repeats the start — drop last so we don't double-cap
      if (path.closed && visualPts.length > 2
          && visualPts[0].distanceTo(visualPts[visualPts.length - 1]) < 0.04) {
        visualPts = visualPts.slice(0, -1);
      }
      if (path.closed && snapPts.length > 2
          && snapPts[0].distanceTo(snapPts[snapPts.length - 1]) < 0.04) {
        snapPts = snapPts.slice(0, -1);
      }
    } else if (useRibbon && pts.length === 2) {
      const a = pts[0], b = pts[1];
      const visSteps = Math.max(2, Math.ceil(a.distanceTo(b) * 2.5));
      const snapSteps = Math.max(1, Math.ceil(a.distanceTo(b) * 1.2));
      visualPts = [];
      for (let i = 0; i <= visSteps; i++) {
        visualPts.push(new THREE.Vector3().lerpVectors(a, b, i / visSteps));
      }
      snapPts = [];
      for (let i = 0; i <= snapSteps; i++) {
        snapPts.push(new THREE.Vector3().lerpVectors(a, b, i / snapSteps));
      }
    }

    const isRail =
      !!path.rail
      || kind === "elevated" || kind === "ramp" || kind === "cornice" || kind === "balcony"
      || kind === "shortcut" || kind === "mouse" || kind === "shaft" || kind === "chute";

    // Snap segments (coarser). ANY visual:false path gets NO snap — if driveable it MUST draw.
    if (visualOk) {
      for (let i = 0; i < snapPts.length - 1; i++) {
        const a = snapPts[i];
        const b = snapPts[i + 1];
        const dir = new THREE.Vector3().subVectors(b, a);
        const len = dir.length();
        if (len < 0.01) continue;
        dir.normalize();

        let label = null;
        for (const op of path.points) {
          if (!op.label) continue;
          const d = Math.hypot(op.x - a.x, op.y - a.y, op.z - a.z);
          if (d < 1.6) { label = op.label; break; }
        }

        this.segments.push({
          a: a.clone(), b: b.clone(), dir: dir.clone(), len,
          kind, pathId: path.id, width, label, rail: isRail,
          elevated: ELEV_KINDS.has(kind),
          tube: TUBE_KINDS.has(kind),
          visual: visualOk,
        });
      }
    }

    if (!useRibbon && visualOk) {
      for (let i = 0; i < visualPts.length - 1; i++) {
        const va = visualPts[i];
        const vb = visualPts[i + 1];
        const vdir = new THREE.Vector3().subVectors(vb, va);
        const vlen = vdir.length();
        if (vlen < 0.01) continue;
        vdir.normalize();
        this._addRoadMesh(va, vb, vdir, vlen, width, kind, isRail);
      }
    }

    // Continuous ribbon — skip door_* and visual:false
    // Gap foyer_skirting visuals under spawn apron (ONE mesh there — no z-fight)
    if (useRibbon && visualOk) {
      const gap = (path.id === "foyer_skirting" || path.id === "foyer_drive_start")
        ? { x: CAR_SPAWN.x, z: CAR_SPAWN.z, r: (this._spawnApron?.r || 1.85) }
        : null;
      this._addRibbonRoad(visualPts, width, kind, !!path.closed, gap, isRail);
    }

    for (const op of path.points) {
      if (op.label) {
        this.checkpoints.push({
          pos: new THREE.Vector3(op.x, op.y, op.z),
          label: op.label,
          pathId: path.id,
          kind,
        });
      }
      if (op.portal) {
        this._addMousePortal(op, path, pts);
      }
    }

    if (path.boostExit && pts.length >= 2) {
      const exit = pts[pts.length - 1];
      this._addBoostPad(exit, path);
    }

    if (kind === "tunnel") {
      this._addTunnelArches(pts, width);
    }
    if (kind === "shortcut" || kind === "mouse" || kind === "shaft") {
      this._addHollowCavityDecor(pts, width, kind);
    }
    if (kind === "flower") {
      this._addFlowerMarkers(pts, width);
    }
    // One subtle chevron at low on-ramp feet only (no yellow triangle piles at junctions)
    if (kind === "ramp" && path.id && path.id.startsWith("ramp_") && pts[0].y < 1.15) {
      this._addArrowSign(pts[0], pts[Math.min(1, pts.length - 1)]);
    }
    // Cornice showcase: start/finish stripe only (banners/posts culled for Drive FPS)
    // Guard: avoid boot crash if class body/load race omits the method briefly
    if ((kind === "cornice" || kind === "balcony") && typeof this._addCorniceShowcase === "function") {
      this._addCorniceShowcase(pts, width, path);
    }
  }

  _makeSharedRoadMats() {
    const asphaltMap = this._asphalt;
    const petalMap = this._petal;
    // Shared mats + depth bias: markings live in texture only (no coplanar line meshes)
    const bias = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: true };
    const asphalt = new THREE.MeshStandardMaterial({
      color: asphaltMap ? 0xffffff : 0x1c1c22,
      roughness: 0.82,
      metalness: 0.06,
      ...(asphaltMap ? { map: asphaltMap } : {}),
      ...bias,
    });
    if (asphaltMap) {
      asphaltMap.wrapS = asphaltMap.wrapT = THREE.RepeatWrapping;
      asphaltMap.repeat.set(1, 1);
    }
    const outdoor = new THREE.MeshStandardMaterial({
      color: asphaltMap ? 0xffffff : 0x5c564c,
      roughness: 0.88,
      metalness: 0.05,
      ...(asphaltMap ? { map: asphaltMap } : {}),
      ...bias,
    });
    const flower = new THREE.MeshStandardMaterial({
      color: petalMap ? 0xffffff : 0x5d4037,
      roughness: 0.88,
      metalness: 0.04,
      ...(petalMap ? { map: petalMap } : {}),
      ...bias,
    });
    const tunnel = new THREE.MeshStandardMaterial({
      color: 0x3e2723, roughness: 0.65, metalness: 0.12,
      ...bias,
    });
    return { asphalt, outdoor, flower, tunnel };
  }

  _roadMatForKind(kind) {
    if (kind === "outdoor") return this._sharedMats.outdoor;
    if (kind === "flower") return this._sharedMats.flower;
    if (kind === "tunnel") return this._sharedMats.tunnel;
    return this._sharedMats.asphalt;
  }

  /**
   * Deck mats: primary roads (ramp/elevated/cornice/balcony) share asphalt lane language
   * with floor highways. Wall hollows stay timber/plaster; chutes stay metal.
   */
  _elevMatForKind(kind) {
    if (!this._elevMats) this._elevMats = {};
    if (this._elevMats[kind]) return this._elevMats[kind];
    let mat;
    const asphaltMap = this._asphalt;
    const asphaltBias = {
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: true,
    };
    // Road family — solid asphalt + baked white/yellow lane markings
    // Climb ramps: bright asphalt language (chevron map) — readable on dark floors
    if (kind === "ramp") {
      const rampMap = this._chevron || asphaltMap;
      mat = new THREE.MeshStandardMaterial({
        color: rampMap ? 0xffffff : 0x3a424e,
        roughness: 0.72,
        metalness: 0.1,
        emissive: 0x1a2030,
        emissiveIntensity: 0.14,
        ...(rampMap ? { map: rampMap } : {}),
        ...asphaltBias,
      });
    } else if (kind === "elevated" || kind === "cornice" || kind === "balcony") {
      mat = new THREE.MeshStandardMaterial({
        color: asphaltMap ? 0xffffff : 0x141418,
        roughness: 0.84,
        metalness: 0.08,
        ...(asphaltMap ? { map: asphaltMap } : {}),
        ...asphaltBias,
      });
    } else if (kind === "shortcut" || kind === "mouse" || kind === "shaft") {
      mat = new THREE.MeshStandardMaterial({
        color: this._hollow ? 0xffffff : 0x2a2018, roughness: 0.78, metalness: 0.08,
        ...(this._hollow ? { map: this._hollow } : {}),
      });
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -1;
      mat.polygonOffsetUnits = -2;
      mat.depthWrite = true;
    } else if (kind === "chute") {
      mat = new THREE.MeshStandardMaterial({
        color: 0x37474f, roughness: 0.4, metalness: 0.35,
        emissive: 0x263238, emissiveIntensity: 0.15,
      });
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -1;
      mat.polygonOffsetUnits = -2;
      mat.depthWrite = true;
    } else {
      mat = this._roadMatForKind(kind);
    }
    this._elevMats[kind] = mat;
    return mat;
  }

  /**
   * Seamless road ribbon: ONE top-deck strip (markings in shared texture only).
   * Smoothed right-vectors kill sawtooth edges; no coplanar bottom / line meshes.
   * Optional gapOpts {x,z,r} punches a hole (used under spawn apron).
   */
  _addRibbonRoad(curvePts, width, kind, closed, gapOpts = null, rail = false) {
    if (!curvePts || curvePts.length < 2) return;
    let pts = curvePts.slice();
    // Close once only — never double-cap (spawn knot / white shard fan)
    if (closed && pts.length > 2 && !gapOpts) {
      const f = pts[0], l = pts[pts.length - 1];
      const d = f.distanceTo(l);
      if (d < 0.04) {
        // already closed in point list — leave as single seam
      } else if (d < 0.35) {
        // near-close: snap last to first instead of adding another vertex
        l.copy(f);
      } else {
        pts.push(f.clone());
      }
    }
    // Split into continuous runs excluding spawn gap — apron owns that region alone
    if (gapOpts && gapOpts.r > 0) {
      const runs = [];
      let cur = [];
      const inGap = (p) => Math.hypot(p.x - gapOpts.x, p.z - gapOpts.z) < gapOpts.r;
      for (const p of pts) {
        if (inGap(p)) {
          if (cur.length >= 2) runs.push(cur);
          cur = [];
        } else {
          cur.push(p);
        }
      }
      if (cur.length >= 2) runs.push(cur);
      // Closed loop with gap at seam → single open run is enough
      if (!runs.length) return;
      for (const run of runs) {
        this._addRibbonRoad(run, width, kind, false, null, rail);
      }
      return;
    }
    const halfW = width * 0.5;
    const isDeck = kind === "elevated" || kind === "ramp" || kind === "cornice" || kind === "balcony";
    // Thick asphalt for ALL driveable ribbons (floor + decks) — no paper-tape look
    const thickAsphalt = isDeck || kind === "floor" || kind === "outdoor" || kind === "flower";
    // Floor asphalt clear of plank top; decks slightly above surfaces
    const yLift = kind === "outdoor" || kind === "flower" ? 0.016
      : (kind === "ramp" ? 0.018 : (isDeck ? 0.016 : 0.015));
    const n = pts.length;
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const rights = [];
    const ups = [];
    const tangents = [];

    for (let i = 0; i < n; i++) {
      const p = pts[i];
      let tangent;
      if (i === 0) tangent = new THREE.Vector3().subVectors(pts[1], p);
      else if (i === n - 1) tangent = new THREE.Vector3().subVectors(p, pts[i - 1]);
      else tangent = new THREE.Vector3().subVectors(pts[i + 1], pts[i - 1]);
      if (tangent.lengthSq() < 1e-10) tangent.set(0, 0, 1);
      tangent.normalize();
      tangents.push(tangent);
      let right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tangent);
      if (right.lengthSq() < 1e-8) {
        right = new THREE.Vector3().crossVectors(new THREE.Vector3(1, 0, 0), tangent);
      }
      right.normalize();
      const up = new THREE.Vector3().crossVectors(tangent, right).normalize();
      rights.push(right);
      ups.push(up);
    }

    // Flip continuity then Laplacian-smooth rights (stable width, no sawtooth ribbon)
    for (let i = 1; i < n; i++) {
      if (rights[i].dot(rights[i - 1]) < 0) {
        rights[i].multiplyScalar(-1);
        ups[i].multiplyScalar(-1);
      }
    }
    const smoothR = rights.map((r) => r.clone());
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < n - 1; i++) {
        const avg = new THREE.Vector3()
          .add(smoothR[i - 1])
          .add(smoothR[i])
          .add(smoothR[i + 1])
          .multiplyScalar(1 / 3);
        // Re-orthogonalize to tangent in XZ
        const t = tangents[i];
        avg.sub(t.clone().multiplyScalar(avg.dot(t)));
        if (avg.lengthSq() > 1e-8) smoothR[i].copy(avg.normalize());
      }
      // Keep end continuity
      if (n > 2) {
        if (smoothR[0].dot(smoothR[1]) < 0) smoothR[0].multiplyScalar(-1);
        if (smoothR[n - 1].dot(smoothR[n - 2]) < 0) smoothR[n - 1].multiplyScalar(-1);
      }
    }
    for (let i = 0; i < n; i++) {
      rights[i].copy(smoothR[i]);
      ups[i].crossVectors(tangents[i], rights[i]).normalize();
    }

    let dist = 0;
    // Solid asphalt slab: top + bottom + side walls (not paper-thin tape ribbons)
    const slab = isDeck ? 0.055 : (kind === "ramp" ? 0.048 : (thickAsphalt ? 0.036 : 0.028));
    const vPer = thickAsphalt ? 4 : 2; // L-top R-top R-bot L-bot
    for (let i = 0; i < n; i++) {
      if (i > 0) dist += pts[i].distanceTo(pts[i - 1]);
      const p = pts[i];
      const right = rights[i];
      const up = ups[i];
      // Stable along-track UV (width-normalized) — no swimming edge shards
      const u = dist / Math.max(0.55, width);
      const y = p.y + yLift;
      const lx = p.x - right.x * halfW;
      const lz = p.z - right.z * halfW;
      const rx = p.x + right.x * halfW;
      const rz = p.z + right.z * halfW;

      positions.push(lx, y, lz);
      positions.push(rx, y, rz);
      normals.push(up.x, up.y, up.z);
      normals.push(up.x, up.y, up.z);
      uvs.push(0, u);
      uvs.push(1, u);
      if (thickAsphalt) {
        positions.push(rx, y - slab, rz);
        positions.push(lx, y - slab, lz);
        normals.push(-up.x, -up.y, -up.z);
        normals.push(-up.x, -up.y, -up.z);
        uvs.push(1, u);
        uvs.push(0, u);
      }

      if (i < n - 1) {
        const a = i * vPer;
        const b = (i + 1) * vPer;
        // top deck
        indices.push(a, a + 1, b + 1, a, b + 1, b);
        if (thickAsphalt) {
          // bottom
          indices.push(a + 3, b + 3, b + 2, a + 3, b + 2, a + 2);
          // right wall (a+1 top-right → a+2 bot-right)
          indices.push(a + 1, a + 2, b + 2, a + 1, b + 2, b + 1);
          // left wall (a top-left → a+3 bot-left)
          indices.push(a, b, b + 3, a, b + 3, a + 3);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeBoundingSphere();

    const mat = isDeck ? this._elevMatForKind(kind) : this._roadMatForKind(kind);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.frustumCulled = true;
    mesh.renderOrder = isDeck ? 2 : 1;
    mesh.name = `ribbon_${kind}`;
    this.root.add(mesh);

    // Continuous edge rails for open decks (same ribbon approach — no per-box planks)
    const wantRails = !!(rail || isDeck)
      && kind !== "shortcut" && kind !== "mouse" && kind !== "shaft" && kind !== "chute";
    if (wantRails) {
      this._addRibbonRails(pts, rights, ups, width, kind);
    }
  }

  /** Thin continuous rail strips along ribbon edges (replaces BoxGeometry rail stacks). */
  _addRibbonRails(pts, rights, ups, width, kind) {
    if (!pts || pts.length < 2) return;
    if (!this._railMats) this._railMats = {};
    let railMat = this._railMats[kind];
    if (!railMat) {
      const fancyRail = kind === "cornice" || kind === "balcony";
      const railColor =
        kind === "cornice" ? 0xcfd8dc
          : kind === "balcony" ? 0xb0bec5
            : kind === "ramp" ? 0x90a4ae
              : 0x78909c;
      railMat = new THREE.MeshStandardMaterial({
        color: railColor,
        roughness: fancyRail ? 0.35 : 0.42,
        metalness: fancyRail ? 0.55 : 0.4,
        emissive: 0x000000,
        emissiveIntensity: 0,
        transparent: true,
        opacity: kind === "balcony" ? 0.9 : fancyRail ? 0.85 : 0.7,
      });
      this._railMats[kind] = railMat;
    }
    const fancyRail = kind === "cornice" || kind === "balcony";
    const railHalf = fancyRail ? 0.016 : 0.012;
    const railUp = fancyRail ? 0.055 : 0.045;
    const halfW = width * 0.5 + 0.012;
    for (const side of [-1, 1]) {
      const positions = [];
      const normals = [];
      const indices = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const r = rights[i];
        const up = ups[i];
        const cx = p.x + r.x * side * halfW;
        const cy = p.y + 0.03;
        const cz = p.z + r.z * side * halfW;
        // Two verts across rail width (along right)
        positions.push(cx - r.x * railHalf, cy, cz - r.z * railHalf);
        positions.push(cx + r.x * railHalf, cy + railUp * 0.15, cz + r.z * railHalf);
        normals.push(up.x, up.y, up.z, up.x, up.y, up.z);
        if (i < pts.length - 1) {
          const a = i * 2;
          const b = (i + 1) * 2;
          indices.push(a, a + 1, b + 1, a, b + 1, b);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
      geo.setIndex(indices);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, railMat);
      mesh.castShadow = false;
      mesh.frustumCulled = true;
      mesh.name = `ribbon_rail_${kind}`;
      this.root.add(mesh);
    }
  }

  _addFlowerRibbonEdges(pts, rights, ups, width, thick, yLift) {
    const petalColors = [0xe91e63, 0xf48fb1, 0xffcdd2, 0xce93d8];
    const halfW = width * 0.5 - 0.02;
    for (const side of [-1, 1]) {
      const positions = [];
      const indices = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const r = rights[i];
        const up = ups[i];
        const ox = r.x * side * halfW;
        const oz = r.z * side * halfW;
        const y = p.y + yLift + thick * 0.7;
        positions.push(p.x + ox - r.x * 0.015, y, p.z + oz - r.z * 0.015);
        positions.push(p.x + ox + r.x * 0.015, y, p.z + oz + r.z * 0.015);
        if (i < pts.length - 1) {
          const a = i * 2;
          const b = (i + 1) * 2;
          indices.push(a, a + 1, b + 1, a, b + 1, b);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const dust = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: petalColors[(side + 1) % petalColors.length],
          roughness: 0.7, metalness: 0.05,
          emissive: 0xe91e63, emissiveIntensity: 0.18,
          transparent: true, opacity: 0.75, side: THREE.DoubleSide,
        })
      );
      this.root.add(dust);
    }
  }

    _orientMesh(mesh, dir) {
    const up = new THREE.Vector3(0, 1, 0);
    const zAxis = dir.clone().normalize();
    const xAxis = new THREE.Vector3().crossVectors(up, zAxis);
    if (xAxis.lengthSq() < 1e-6) xAxis.set(1, 0, 0);
    else xAxis.normalize();
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
    const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    mesh.quaternion.setFromRotationMatrix(basis);
    return xAxis;
  }

  _addRoadMesh(a, b, dir, len, width, kind, rail) {
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const thick =
      kind === "elevated" || kind === "cornice" || kind === "balcony" ? 0.045
        : kind === "ramp" || kind === "chute" ? 0.035
          : kind === "shortcut" || kind === "mouse" || kind === "shaft" ? 0.028
            : kind === "flower" ? 0.022
              : 0.028;
    // Slight lengthwise overlap closes CatmullRom box-join gaps / light-leak tears
    const asphaltJoin = kind === "floor" || kind === "outdoor" || kind === "flower" || kind === "tunnel";
    const overlap = asphaltJoin
      ? Math.min(0.09, Math.max(0.04, len * 0.14))
      : Math.min(0.045, Math.max(0.02, len * 0.08));
    const meshLen = len + overlap;
    const geo = new THREE.BoxGeometry(width, thick, meshLen);
    // Shared mats per kind — no per-box texture clones (major GPU/CPU win)
    const mat = this._elevMatForKind(kind);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(mid);
    // Nudge asphalt slightly above shared floor planes to reduce coplanar light leaks
    if (asphaltJoin) mesh.position.y += 0.0015;
    const xAxis = this._orientMesh(mesh, dir);
    mesh.receiveShadow = true;
    mesh.castShadow = false; // Drive lag: no per-deck shadow casters
    mesh.frustumCulled = true;
    mesh.renderOrder = asphaltJoin ? 1 : 0;
    this.root.add(mesh);

    // Gold inlay / petal dust / hollow timber trim culled — road surface + rails only (FPS)

    if ((kind === "floor" || kind === "outdoor") && !this._asphalt) {
      // Wide center dash — never ultra-thin wire ribbons
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.08, width * 0.22), 0.01, meshLen * 0.95),
        new THREE.MeshBasicMaterial({ color: 0xf0c000 })
      );
      line.position.copy(mid);
      line.position.y += thick * 0.55;
      line.quaternion.copy(mesh.quaternion);
      this.root.add(line);
    }

    // Essential rails on open elevated decks only (tubes use cavity walls / bounce)
    const wantRails = (rail || ELEV_KINDS.has(kind))
      && kind !== "shortcut" && kind !== "mouse" && kind !== "shaft" && kind !== "chute";
    if (wantRails) {
      if (!this._railMats) this._railMats = {};
      const railKey = kind;
      let railMat = this._railMats[railKey];
      if (!railMat) {
        const railColor =
          kind === "cornice" ? 0xe0c060
            : kind === "balcony" ? 0xd7ccc8
              : kind === "shortcut" || kind === "mouse" || kind === "shaft" ? 0x8d6e63
                : kind === "chute" ? 0x90a4ae
                  : 0xffcc80;
        const fancyRail = kind === "cornice" || kind === "balcony";
        const slim = kind === "shortcut" || kind === "mouse" || kind === "shaft" || kind === "flower";
        railMat = new THREE.MeshStandardMaterial({
          color: railColor,
          roughness: fancyRail ? 0.28 : 0.38,
          metalness: fancyRail ? 0.78 : 0.55,
          emissive: fancyRail ? 0x8a6a1a : 0x000000,
          emissiveIntensity: fancyRail ? 0.18 : 0,
          transparent: true,
          opacity: kind === "balcony" ? 0.9 : slim ? 0.55 : fancyRail ? 0.92 : 0.7,
        });
        this._railMats[railKey] = railMat;
      }
      const fancyRail = kind === "cornice" || kind === "balcony";
      const slim = kind === "shortcut" || kind === "mouse" || kind === "shaft" || kind === "flower";
      const railH = (kind === "shortcut" || kind === "shaft" || kind === "chute") ? 0.055
        : fancyRail ? 0.085 : 0.07;
      for (const side of [-1, 1]) {
        const railMesh = new THREE.Mesh(
          new THREE.BoxGeometry(slim ? 0.02 : fancyRail ? 0.032 : 0.028, railH, len),
          railMat
        );
        const off = xAxis.clone().multiplyScalar(side * (width * 0.5 + 0.015));
        railMesh.position.copy(mid).add(off);
        railMesh.position.y += 0.05;
        railMesh.quaternion.copy(mesh.quaternion);
        railMesh.castShadow = false;
        railMesh.frustumCulled = true;
        this.root.add(railMesh);
      }
    }
  }

  _addMousePortal(op, path, pts) {
    const p = new THREE.Vector3(op.x, op.y, op.z);
    // Estimate facing from nearest neighbor along path
    let yaw = 0;
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = pts[i].distanceTo(p);
      if (d < best) {
        best = d;
        const j = i < pts.length - 1 ? i + 1 : Math.max(0, i - 1);
        yaw = Math.atan2(pts[j].x - pts[i].x, pts[j].z - pts[i].z);
      }
    }

    const kind = path.kind || "shortcut";
    const r = kind === "flower" ? 0.18 : 0.2;
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x5d4037, roughness: 0.45, metalness: 0.25,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: kind === "flower" ? 0xffcdd2 : 0xffe0b2,
      emissive: kind === "flower" ? 0xe91e63 : 0xffcc80,
      emissiveIntensity: kind === "flower" ? 0.9 : 1.15,
      roughness: 0.35, transparent: true, opacity: 0.85,
    });

    // Compact mouse hole: ring + glow disc only (trim/halo culled for FPS)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.028, 6, 14), ringMat);
    ring.position.set(p.x, p.y + r * 0.15, p.z);
    ring.rotation.y = yaw;
    ring.castShadow = false;
    this.root.add(ring);

    const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.85, 12), glowMat);
    disc.position.copy(ring.position);
    disc.rotation.y = yaw;
    disc.castShadow = false;
    this.root.add(disc);

    ring.userData.exploreHint = true;
    disc.userData.exploreHint = true;
    // Dim mansion-friendly glow — readable in Explore without neon spam
    glowMat.emissiveIntensity = kind === "flower" ? 0.55 : 0.7;
    glowMat.opacity = 0.72;

    this.portals.push({
      pos: p.clone(),
      y: op.y,
      kind,
      pathId: path.id,
      label: op.label || "Shortcut — wall run",
      mesh: disc,
      ring,
    });
  }

  _addBoostPad(exit, path) {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry((path.width || 0.35) * 0.9, 0.02, 0.28),
      new THREE.MeshStandardMaterial({
        color: 0xffeb3b, emissive: 0xffc107, emissiveIntensity: 1.2,
        roughness: 0.35, metalness: 0.2,
      })
    );
    pad.position.set(exit.x, exit.y + 0.02, exit.z);
    this.root.add(pad);
    this.boostPads.push({ pos: exit.clone(), pathId: path.id });
  }

  _addHollowCavityDecor(pts, width, kind) {
    // Sparse plaster walls only — motes/banners/gates/insulation/cables culled (Drive FPS)
    if (!pts || pts.length < 2 || kind === "chute") return;
    if (!this._hollowWallMat) {
      this._hollowWallMat = new THREE.MeshStandardMaterial({
        color: 0x3e342c, roughness: 0.85, metalness: 0.05,
      });
    }
    const plaster = this._hollowWallMat;
    const n = pts.length;
    const step = Math.max(2, Math.floor(n / 6));
    for (let i = 0; i < n; i += step) {
      const p = pts[i];
      let yaw = 0;
      if (i < n - 1) yaw = Math.atan2(pts[i + 1].x - p.x, pts[i + 1].z - p.z);
      else if (i > 0) yaw = Math.atan2(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const wallH = width * 1.15;
      const wallSep = width * 0.55;
      for (const side of [-1, 1]) {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, wallH, 0.7),
          plaster
        );
        wall.position.set(
          p.x + right.x * side * wallSep,
          p.y + wallH * 0.42,
          p.z + right.z * side * wallSep
        );
        wall.rotation.y = yaw;
        wall.castShadow = false;
        wall.frustumCulled = true;
        this.root.add(wall);
      }
    }
  }

  _addFlowerMarkers(pts, width) {
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xfff3e0, emissive: 0xffcc80, emissiveIntensity: 1.1, roughness: 0.4,
    });
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x5d4037, roughness: 0.7, metalness: 0.1,
    });
    // Lanterns at ends
    for (const idx of [0, pts.length - 1]) {
      const p = pts[idx];
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.28, 8), postMat);
      post.position.set(p.x + width * 0.55, p.y + 0.14, p.z);
      this.root.add(post);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), lanternMat);
      lamp.position.set(p.x + width * 0.55, p.y + 0.3, p.z);
      this.root.add(lamp);
    }
  }

  _addArrowSign(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    if (dir.lengthSq() < 1e-6) return;
    dir.normalize();
    const yaw = Math.atan2(dir.x, dir.z);
    if (!this._rampArrowMats) this._rampArrowMats = [];
    // Single quiet gold chevron at ramp foot — no dual neon triangle piles
    const mat = new THREE.MeshStandardMaterial({
      color: 0xc9a227, emissive: 0x8a6a1a, emissiveIntensity: 0.35, roughness: 0.45, metalness: 0.35,
    });
    this._rampArrowMats.push(mat);
    const ox = from.x + dir.x * 0.08;
    const oz = from.z + dir.z * 0.08;
    const oy = from.y + 0.045;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.07, 3), mat);
    head.position.set(ox + dir.x * 0.04, oy, oz + dir.z * 0.04);
    head.rotation.y = yaw;
    head.rotation.x = Math.PI / 2;
    head.frustumCulled = true;
    this.root.add(head);
  }

  /** Start/finish stripe only on main cornice circuits (banners/posts culled). */
  _addCorniceShowcase(pts, width, path) {
    // Banners/brass posts/motes culled — keep optional start/finish stripe only
    if (!pts || pts.length < 2) return;
    const id = (path && path.id) || "";
    const wantSF = !!(path && (path.startFinish || path.fancy
      || id.includes("foyer") || id.includes("circuit") || id.startsWith("cornice_main")));
    if (!wantSF) return;
    const a = pts[0];
    const b = pts[Math.min(1, pts.length - 1)];
    const dir = new THREE.Vector3().subVectors(b, a);
    if (dir.lengthSq() < 1e-8 && pts.length > 2) dir.subVectors(pts[2], a);
    if (dir.lengthSq() < 1e-8) return;
    dir.normalize();
    const yaw = Math.atan2(dir.x, dir.z);
    const stripeW = Math.max(width * 1.15, 0.28);
    const opts = {
      color: 0xffffff, roughness: 0.55, metalness: 0.05,
      emissive: 0x222222, emissiveIntensity: 0.12,
    };
    if (this._startFinish) opts.map = this._startFinish;
    else opts.color = 0xf5f5f5;
    const mat = new THREE.MeshStandardMaterial(opts);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(stripeW, 0.012, Math.max(0.16, width * 0.55)),
      mat
    );
    stripe.position.set(a.x + dir.x * 0.08, a.y + 0.04, a.z + dir.z * 0.08);
    stripe.rotation.y = yaw;
    stripe.receiveShadow = true;
    stripe.castShadow = false;
    this.root.add(stripe);
  }

  _addTunnelArches(pts, width) {
    const archMat = new THREE.MeshStandardMaterial({
      color: 0x5d4037, roughness: 0.55, metalness: 0.2,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xc9a227, roughness: 0.35, metalness: 0.65,
    });
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xffe0b2, emissive: 0xffcc80, emissiveIntensity: 1.1,
      roughness: 0.4,
    });
    const step = Math.max(1, Math.floor(pts.length / 4));
    for (let i = 0; i < pts.length; i += step) {
      const p = pts[i];
      let yaw = Math.PI / 2;
      if (i < pts.length - 1) {
        const dx = pts[i + 1].x - p.x;
        const dz = pts[i + 1].z - p.z;
        yaw = Math.atan2(dx, dz);
      } else if (i > 0) {
        const dx = p.x - pts[i - 1].x;
        const dz = p.z - pts[i - 1].z;
        yaw = Math.atan2(dx, dz);
      }

      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(width * 0.58, 0.09, 6, 12, Math.PI),
        archMat
      );
      arch.position.set(p.x, p.y + width * 0.58, p.z);
      arch.rotation.y = yaw;
      arch.rotation.z = Math.PI;
      arch.castShadow = false;
      arch.frustumCulled = true;
      this.root.add(arch);

      const sideOff = width * 0.58;
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      for (const side of [-1, 1]) {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, width * 0.95, 0.9),
          archMat
        );
        wall.position.set(
          p.x + right.x * side * sideOff,
          p.y + width * 0.42,
          p.z + right.z * side * sideOff
        );
        wall.rotation.y = yaw;
        wall.castShadow = false;
        wall.frustumCulled = true;
        this.root.add(wall);
      }
    }
  }

  /**
   * Surface query for MANUAL drive — NO centerline magnet / rail babysitting.
   * Strict under≠on: elevated/cornice/balcony ignored when car is below the deck;
   * ramps only engage along their surface corridor (no jump-up from floor).
   * Coplanar decks still beat nearby story floors when ON the surface.
   * KEEP spatial grid (_segmentsNear) — never full-scan.
   */
  querySnap(x, y, z, radius = 2.4, carYaw = null) {
    let best = null;
    let bestScore = Infinity;
    // Story floors — narrow band for carpet preference (was 0.85: stole cornice ~3.5)
    const storyFloors = [8.46, 4.26, 0.075, -4.05];
    let storyY = null;
    let storyDy = 0.42;
    for (const f of storyFloors) {
      const d = Math.abs(y - f);
      if (d < storyDy) { storyDy = d; storyY = f; }
    }
    // Wider lookup only for open-floor carpet fallback (not for scoring bias)
    let carpetStoryY = storyY;
    if (carpetStoryY == null) {
      let cd = 0.95;
      for (const f of storyFloors) {
        const d = Math.abs(y - f);
        if (d < cd) { cd = d; carpetStoryY = f; }
      }
    }
    const onFloorCruise = storyY != null; // truly at asphalt/carpet height

    const candidates = this._snapGrid && this._snapGrid.size
      ? this._segmentsNear(x, z, radius)
      : this.segments;
    for (const seg of candidates) {
      const abx = seg.b.x - seg.a.x;
      const aby = seg.b.y - seg.a.y;
      const abz = seg.b.z - seg.a.z;
      const apx = x - seg.a.x;
      const apy = y - seg.a.y;
      const apz = z - seg.a.z;
      const steep = Math.abs(aby) > Math.abs(abx) * 0.45 + Math.abs(abz) * 0.45;
      let t;
      if (steep || seg.kind === "shaft" || seg.kind === "chute" || seg.kind === "shortcut" || seg.kind === "ramp") {
        const abLenSq = abx * abx + aby * aby + abz * abz;
        t = abLenSq > 1e-8 ? (apx * abx + apy * aby + apz * abz) / abLenSq : 0;
      } else {
        const abLenSq = abx * abx + abz * abz;
        t = abLenSq > 1e-8 ? (apx * abx + apz * abz) / abLenSq : 0;
      }
      t = Math.max(0, Math.min(1, t));
      const px = seg.a.x + abx * t;
      const py = seg.a.y + aby * t;
      const pz = seg.a.z + abz * t;
      const dist = Math.hypot(x - px, z - pz);
      const dist3 = Math.hypot(x - px, y - py, z - pz);
      const dy = Math.abs(y - py);
      const elev = ELEV_KINDS.has(seg.kind);
      const tube = TUBE_KINDS.has(seg.kind);
      const isFloor = FLOOR_KINDS.has(seg.kind);
      const flatDeck = seg.kind === "cornice" || seg.kind === "balcony" || seg.kind === "elevated";
      // signedBelow > 0 ⇒ segment surface is ABOVE the car (car is underneath)
      const signedBelow = py - y;

      // Invisible paths never engage — snap-active requires drawn asphalt.
      if (seg.visual === false) continue;

      // Half-width corridor (used by under≠on ramp exceptions + scoring)
      const halfApprox = seg.width * 0.5;
      const inRampCorridor = seg.kind === "ramp" && (steep ? dist3 : dist) < halfApprox * 1.08;
      const rampContinuity = seg.kind === "ramp" && this._lastPathId === seg.pathId
        && (steep ? dist3 : dist) < halfApprox * 1.35;

      // ── Strict under ≠ on ──────────────────────────────────────────
      // Flat elevated decks: ignore entirely when car is under the deck.
      if (flatDeck && signedBelow > 0.28) continue;
      // Ramps: allow deeper "below surface" ONLY while inside the climb corridor
      // (or continuing the same ramp) so under≠on does not drop legitimate climbs.
      // Still ignore jump-ups from floor under a high midspan outside the ribbon.
      if (seg.kind === "ramp") {
        const rampUnderMax = (inRampCorridor || rampContinuity) ? 0.58 : 0.32;
        if (signedBelow > rampUnderMax) continue;
      }
      // Horizontal tubes: no jump-up from far below
      if (tube && !steep && signedBelow > 0.45) continue;

      // Cruising true floor: skip overhead decks unless coplanar lip
      // (ramps in-corridor are exempt — feet + early climb must engage)
      if (onFloorCruise && (elev || tube) && !inRampCorridor && !rampContinuity
          && dy > 0.45 && Math.abs(py - storyY) > 0.5) {
        continue;
      }
      // On-deck height band (tight): must be near surface, not reaching up through void
      const heightBand = elev || tube
        ? (flatDeck ? 0.72 : (seg.kind === "ramp" && (inRampCorridor || rampContinuity) ? 1.15 : 0.95))
        : 2.8;
      const useRadius = elev || tube
        ? radius * 0.85
        : (isFloor ? radius * 1.45 : radius * 1.2);
      const checkDist = steep ? dist3 : dist;
      if (dy > heightBand || checkDist > useRadius) continue;

      // HEIGHT DOMINATES: coplanar ramp/bridge/cornice always beats distant-Y floor
      const dyW = (elev || tube) ? 3.4 : (isFloor ? 0.55 : 1.1);
      const pathBias = (this._lastPathId && seg.pathId === this._lastPathId) ? -0.48 : 0;
      // Mild floor prefer only when both car AND segment are at story asphalt height
      const floorBias = (onFloorCruise && isFloor && dy < 0.28) ? -0.22 : 0;
      // Snap engagement at ramp feet / climb: beat skirting pathBias+floorBias
      // so the car picks up the ramp the moment it drives onto the foot corridor.
      // Prefer real climbs (steeper grade) over near-flat ramp connectors at shared feet
      const rampGrade = seg.kind === "ramp"
        ? Math.abs(aby) / Math.max(1e-4, Math.hypot(abx, abz))
        : 0;
      let rampBias = (seg.kind === "ramp" && (inRampCorridor || rampContinuity)
        && signedBelow <= ((inRampCorridor || rampContinuity) ? 0.55 : 0.28)
        && dy < 0.72)
        ? (-1.25 - Math.min(0.55, rampGrade * 0.85))
        : 0;
      // Floor-cruise continuity: kissing ramp feet must NOT steal skirting loops /
      // T-junctions into furniture unless the car is aiming along the ramp.
      const lastIsFloor = this._lastPathKind === "floor"
        || this._lastPathKind === "outdoor"
        || this._lastPathKind === "flower";
      if (rampBias && lastIsFloor && onFloorCruise && !rampContinuity) {
        let align = 1;
        if (carYaw != null && Number.isFinite(carYaw)) {
          const rampYaw = Math.atan2(abx, abz);
          let d0 = rampYaw - carYaw;
          while (d0 > Math.PI) d0 -= Math.PI * 2;
          while (d0 < -Math.PI) d0 += Math.PI * 2;
          let d1 = d0 + Math.PI;
          while (d1 > Math.PI) d1 -= Math.PI * 2;
          while (d1 < -Math.PI) d1 += Math.PI * 2;
          align = Math.max(Math.cos(d0), Math.cos(d1));
          // Foyer climb foot: generous engage so browser approach mounts
          const foyerFoot = seg.pathId === "ramp_foyer_to_landing"
            && Math.hypot(x - (-7.15), z - 11.20) < 1.85;
          if (foyerFoot) {
            if (align < 0.25) rampBias *= 0.45;
            else if (align < 0.55) rampBias *= 0.75;
            // else keep full bias
          } else {
            if (align < 0.50) rampBias *= 0.06;
            else if (align < 0.72) rampBias *= 0.35;
            else if (align < 0.88) rampBias *= 0.7;
          }
        }
        // No carYaw (legacy sims / placement at foot): leave full rampBias
      }
      // Penalize elevated only when clearly wrong height while floor-cruising
      // — never penalize an in-corridor ramp (feet kiss floor by design).
      const elevPenalty = (onFloorCruise && (elev || tube) && dy > 0.38
        && !inRampCorridor && !rampContinuity) ? 1.1 : 0;
      // Hard penalty if somehow still scoring a flat deck from below (not ramps)
      const underPenalty = (flatDeck && signedBelow > 0.22) ? 2.4
        : (seg.kind === "ramp" && signedBelow > 0.55 && !inRampCorridor) ? 2.4 : 0;
      // Off-ribbon elevated must not steal junctions from coplanar on-ribbon decks
      const offRibbonPenalty = ((elev || tube) && checkDist >= halfApprox
        && !(seg.kind === "ramp" && rampContinuity)) ? 1.15 : 0;
      const score = checkDist + dy * dyW + pathBias + floorBias + rampBias
        + elevPenalty + underPenalty + offRibbonPenalty;
      if (score < bestScore) {
        bestScore = score;
        const flatLen = Math.hypot(abx, abz) || 1e-6;
        const yaw = Math.atan2(abx, abz);
        const bank = Math.atan2(aby, flatLen) * (seg.kind === "chute" ? 0.75 : seg.kind === "cornice" || seg.kind === "balcony" ? 0.62 : seg.kind === "ramp" ? 0.52 : 0.45);
        const halfW = seg.width * 0.5;
        const lateral = steep ? dist3 : dist;
        // BINARY onTrack: half-width ribbon. Ramps allow slightly deeper under-surface
        // while progressing in corridor so climb pickup is not blocked by under≠on.
        const rampOnUnder = (seg.kind === "ramp" && (inRampCorridor || rampContinuity)) ? 0.52 : 0.28;
        const onTrack = lateral < halfW && signedBelow <= rampOnUnder;
        // nearDeck: rim Y-assist only when already at deck height — NEVER from underneath
        // (ramps in-corridor may use a slightly deeper band for climb glue)
        const nearDeckUnder = (seg.kind === "ramp" && (inRampCorridor || rampContinuity)) ? 0.35 : 0.12;
        const nearDeck = (elev || tube) && !onTrack && lateral < halfW * 1.42
          && dy < 0.55 && signedBelow <= nearDeckUnder && (y - py) < 0.55;
        const supportUnder = (seg.kind === "ramp" && (inRampCorridor || rampContinuity)) ? 0.52 : 0.28;
        const supported = (onTrack || nearDeck) && dy < (elev || tube ? 0.72 : 0.9)
          && signedBelow <= supportUnder;

        let wallBounce = null;
        if (tube && dist > halfW * 0.72) {
          const pushDirX = (px - x);
          const pushDirZ = (pz - z);
          const plen = Math.hypot(pushDirX, pushDirZ) || 1;
          if (dist < halfW * 1.35) {
            const over = dist - halfW * 0.72;
            const strength = Math.min(0.045, over * 0.085);
            wallBounce = {
              x: (pushDirX / plen) * strength,
              z: (pushDirZ / plen) * strength,
            };
          }
        }
        // Soft rim fence on elevated / cornice / balcony / furniture decks —
        // push toward center when near rim (NOT full-track centerline magnet).
        // Hard fall only if they truly leave the deck into void.
        const deckFence = elev && !tube && (
          seg.kind === "elevated" || seg.kind === "cornice" || seg.kind === "balcony"
          || seg.kind === "ramp"
        );
        if (deckFence && lateral > halfW * 0.50 && lateral < halfW * 1.38) {
          const pushDirX = (px - x);
          const pushDirZ = (pz - z);
          const plen = Math.hypot(pushDirX, pushDirZ) || 1;
          const over = lateral - halfW * 0.50;
          // Stickier near absolute rim — casual play stays ON deck
          // Ramps: stronger rim push (climb assist) without full centerline magnet
          const rampRim = seg.kind === "ramp" ? 1.55 : 1;
          const rimT = THREE.MathUtils.clamp(over / Math.max(1e-4, halfW * 0.55), 0, 1);
          const strength = Math.min(0.088 * rampRim, over * (0.13 + 0.20 * rimT) * rampRim);
          const bx = (pushDirX / plen) * strength;
          const bz = (pushDirZ / plen) * strength;
          if (!wallBounce) wallBounce = { x: bx, z: bz };
          else { wallBounce.x += bx; wallBounce.z += bz; }
        }

        const exitedTube = tube && dist > halfW * 1.25 && !steep;
        // Carpet = off-ribbon floor support/slow only — must NOT claim onTrack
        const carpet = isFloor && !onTrack && dy < 0.55;
        const edgeMargin = halfW - lateral;
        best = {
          // Ride height = segment Y + ribbon yLift so wheels sit on asphalt top (not hover/sink)
          // Plant wheels on asphalt top: tiny -2mm sink hides mesh faceting; carpet matches lift
          x: px, y: (carpet ? py + ribbonYLift(seg.kind) : py + ribbonYLift(seg.kind) - 0.002), z: pz,
          yaw, bank,
          onTrack: onTrack && !exitedTube,
          supported: (supported && !exitedTube) || carpet,
          softPull: false,
          carpet,
          dist: checkDist, kind: seg.kind, pathId: seg.pathId, label: seg.label,
          wallBounce,
          magnet: false,
          elevated: elev,
          wasElevated: elev,
          steep: !!steep,
          tube,
          halfW,
          edgeMargin,
          nearDeck: !!nearDeck,
          rampContinuity: !!(seg.kind === "ramp" && rampContinuity),
        };
      }
    }

    if (best) {
      // Only demote elevated→carpet when FAR from the deck laterally while floor-cruising
      const farFromDeck = best.elevated || best.tube
        ? (best.dist > (best.halfW || 0.2) * 1.42 && !best.nearDeck && !best.onTrack)
        : false;
      if (onFloorCruise && (best.elevated || best.tube) && farFromDeck) {
        best = {
          x, y: storyY, z,
          yaw: null, bank: 0,
          onTrack: false, supported: true, softPull: false,
          carpet: true, dist: best.dist, kind: "floor", pathId: null, label: null,
          wallBounce: null, magnet: false, elevated: false, wasElevated: false, steep: false,
          edgeMargin: 1, halfW: 1, nearDeck: false,
        };
      } else {
        // Only latch path continuity when actually on the ribbon (avoids junction theft)
        if (best.pathId && best.onTrack) {
          this._lastPathId = best.pathId;
          this._lastPathKind = best.kind || null;
        }
      }
      // Spawn apron = visual asphalt must count as onTrack (no carpet penalty at pad edge)
      if (this._spawnApron && onFloorCruise && !best.onTrack
          && (best.kind === "floor" || best.carpet || best.kind === "outdoor")) {
        const adx = x - this._spawnApron.x;
        const adz = z - this._spawnApron.z;
        if (adx * adx + adz * adz <= this._spawnApron.r * this._spawnApron.r) {
          best = {
            ...best,
            onTrack: true,
            supported: true,
            carpet: false,
            kind: best.kind === "outdoor" ? "outdoor" : "floor",
            pathId: best.pathId || "foyer_drive_start",
            edgeMargin: Math.max(0.2, best.edgeMargin || 0.2),
            y: best.y != null ? best.y : (storyY ?? 0.075),
          };
          this._lastPathId = best.pathId;
          this._lastPathKind = best.kind;
        }
      }
      return best;
    }

    // Spawn apron alone (no ribbon sample) still drives as asphalt
    if (this._spawnApron && carpetStoryY != null && Math.abs(y - carpetStoryY) < 0.95) {
      const adx = x - this._spawnApron.x;
      const adz = z - this._spawnApron.z;
      if (adx * adx + adz * adz <= this._spawnApron.r * this._spawnApron.r) {
        return {
          x, y: carpetStoryY, z,
          yaw: CAR_SPAWN.yaw, bank: 0,
          onTrack: true, supported: true, softPull: false,
          carpet: false, dist: 0, kind: "floor", pathId: "foyer_drive_start", label: null,
          wallBounce: null, magnet: false, elevated: false, wasElevated: false, steep: false,
          edgeMargin: 0.4, halfW: 1.1, nearDeck: false,
        };
      }
    }

    // Open floor of any mansion story → carpet crawl (slow), never void/crash
    if (carpetStoryY != null && Math.abs(y - carpetStoryY) < 0.95) {
      return {
        x, y: carpetStoryY, z,
        yaw: null, bank: 0,
        onTrack: false, supported: true, softPull: false,
        carpet: true, dist: 0, kind: "floor", pathId: null, label: null,
        wallBounce: null, magnet: false, elevated: false, wasElevated: false, steep: false,
        edgeMargin: 1, halfW: 1, nearDeck: false,
      };
    }

    // No support — fall candidate (car tracks _lastElevated for balcony/cornice)
    return {
      x, y, z,
      yaw: null, bank: 0,
      onTrack: false, supported: false, softPull: false,
      carpet: false, dist: 99, kind: "void", pathId: null, label: null,
      wallBounce: null, magnet: false, elevated: false, wasElevated: false, steep: false,
      edgeMargin: -1, halfW: 0, nearDeck: false,
    };
  }


  /**
   * Nearest visible onTrack asphalt for unstuck nudge.
   * Prefers floor/outdoor at story height; falls back to any onTrack ribbon.
   */
  findEscapeSnap(x, y, z, radius = 4.5) {
    let bestFloor = null;
    let bestFloorD = Infinity;
    let bestAny = null;
    let bestAnyD = Infinity;
    const candidates = this._snapGrid && this._snapGrid.size
      ? this._segmentsNear(x, z, radius)
      : this.segments;
    for (const seg of candidates) {
      if (seg.visual === false) continue;
      const abx = seg.b.x - seg.a.x;
      const aby = seg.b.y - seg.a.y;
      const abz = seg.b.z - seg.a.z;
      const abLenSq = abx * abx + abz * abz;
      let t = abLenSq > 1e-8 ? ((x - seg.a.x) * abx + (z - seg.a.z) * abz) / abLenSq : 0;
      t = Math.max(0, Math.min(1, t));
      const px = seg.a.x + abx * t;
      const py = seg.a.y + aby * t;
      const pz = seg.a.z + abz * t;
      const dist = Math.hypot(x - px, z - pz);
      const dy = Math.abs(y - py);
      if (dist > radius || dy > 2.8) continue;
      // Prefer centers of thick ribbons (clear of furniture cages)
      const halfW = seg.width * 0.5;
      if (halfW < 0.16) continue; // skip wire-thin leftovers
      const yaw = Math.atan2(abx, abz);
      const cand = {
        x: px, y: py + ribbonYLift(seg.kind), z: pz, yaw,
        onTrack: true, supported: true, kind: seg.kind, pathId: seg.pathId,
        dist, elevated: ELEV_KINDS.has(seg.kind),
      };
      const score = dist + dy * 0.35;
      if (FLOOR_KINDS.has(seg.kind) && dy < 0.85) {
        if (score < bestFloorD) { bestFloorD = score; bestFloor = cand; }
      }
      if (score < bestAnyD) { bestAnyD = score; bestAny = cand; }
    }
    return bestFloor || bestAny;
  }

  nearestCheckpoint(x, z, maxDist = 3.5, y = null) {
    let best = null;
    let bd = maxDist;
    for (const cp of this.checkpoints) {
      const d = Math.hypot(x - cp.pos.x, z - cp.pos.z);
      const dy = y != null ? Math.abs(y - cp.pos.y) : 0;
      if (d < bd && dy < 3.5) { bd = d; best = cp; }
    }
    return best;
  }

  nearestPortal(x, y, z, maxDist = 2.8) {
    let best = null;
    let bd = maxDist;
    for (const p of this.portals) {
      const d = Math.hypot(x - p.pos.x, y - p.y, z - p.pos.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  onBoostPad(x, z, maxDist = 0.55) {
    for (const b of this.boostPads) {
      if (Math.hypot(x - b.pos.x, z - b.pos.z) < maxDist) return true;
    }
    return false;
  }

  /** Track FX pulse — heavily throttled; motes/banners/gates mostly culled. */
  updateVisuals(t) {
    const tick = (t * 2) | 0; // ~2 Hz
    if (tick === this._visTick) return;
    this._visTick = tick;
    if (this._rampArrowMats && this._rampArrowMats.length) {
      const rampGlow = 0.28 + 0.12 * Math.sin(t * 1.6);
      for (const m of this._rampArrowMats) {
        if (m.emissiveIntensity != null) m.emissiveIntensity = rampGlow;
      }
    }
    // Portals: rare scale pulse only
    if ((tick & 3) === 0) {
      for (const p of this.portals) {
        if (p.mesh) {
          const s = 1 + 0.04 * Math.sin(t * 2.2 + p.pos.x);
          p.mesh.scale.setScalar(s);
        }
      }
    }
  }

  /**
   * Track visibility by play mode.
   * - true / "drive": full asphalt + rails + portals
   * - false: hide everything
   * - "explore": only mouse/flower/shaft portal rings (subtle mansion cues)
   */
  setVisible(v) {
    const mode = v === true || v === "drive" ? "drive"
      : v === "explore" || v === "portals" ? "explore"
        : "off";
    this._visMode = mode;
    if (mode === "off") {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    const exploreOnly = mode === "explore";
    this.root.traverse((obj) => {
      if (!obj.isMesh && !obj.isLine && !obj.isPoints) return;
      if (exploreOnly) {
        obj.visible = !!obj.userData.exploreHint;
      } else {
        obj.visible = true;
      }
    });
    // Explore: quieter portal pulse so mansion look stays primary
    for (const p of this.portals) {
      if (p.mesh && p.mesh.material) {
        p.mesh.material.emissiveIntensity = exploreOnly
          ? (p.kind === "flower" ? 0.4 : 0.55)
          : (p.kind === "flower" ? 0.9 : 1.15);
        p.mesh.material.opacity = exploreOnly ? 0.62 : 0.85;
      }
    }
  }
}
