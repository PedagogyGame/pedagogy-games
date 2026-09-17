import * as THREE from "three";
import { TRACK_PATHS, CAR_SPAWN, RAMP_MOUNT_FEET } from "../data/tracks.js?v=drivefix3";

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
  const c = makeCanvas(256, 256);
  if (!c) return null;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#0a0a0e";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 800; i++) {
    const v = 14 + Math.random() * 22;
    ctx.fillStyle = `rgba(${v},${v},${v + 3},0.32)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  ctx.strokeStyle = "rgba(248,248,252,0.95)";
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(16, 256); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(240, 0); ctx.lineTo(240, 256); ctx.stroke();
  ctx.strokeStyle = "rgba(255,204,40,0.98)";
  ctx.lineWidth = 5.5;
  ctx.setLineDash([18, 14]);
  ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 256); ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeChevronTexture() {
  const c = makeCanvas(128, 256);
  if (!c) return null;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#0c0e14";
  ctx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 300; i++) {
    const v = 16 + Math.random() * 24;
    ctx.fillStyle = `rgba(${v},${v + 2},${v + 6},0.30)`;
    ctx.fillRect(Math.random() * 128, Math.random() * 256, 1, 1);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(12, 256); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(116, 0); ctx.lineTo(116, 256); ctx.stroke();
  ctx.strokeStyle = "#ffe066";
  ctx.lineWidth = 7;
  for (let y = 14; y < 256; y += 36) {
    ctx.beginPath();
    ctx.moveTo(28, y + 18); ctx.lineTo(64, y); ctx.lineTo(100, y + 18);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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

function ribbonYLift(kind) {
  if (kind === "ramp") return 0.018;
  if (kind === "balcony" || kind === "elevated" || kind === "cornice") return 0.016;
  return 0.015;
}

const FOYER_CLIMB_FOOT = (RAMP_MOUNT_FEET.ramp_foyer_to_landing?.foot)
  || { x: -4.85, y: 0.06, z: 11.85 };
const FOYER_CLIMB_ENGAGE_R = ((RAMP_MOUNT_FEET.ramp_foyer_to_landing?.engageBack) || 1.10) + 1.35;

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
    this._startFinish = makeStartFinishTexture();
    this._sharedMats = this._makeSharedRoadMats();
    this._railPostPositions = [];
    this._addSpawnPadMesh();
    for (const job of this._pendingVisuals) {
      this._addRibbonRoad(job.visualPts, job.width, job.kind, job.closed, job.gap, job.isRail);
      if (job.climbChevrons) this._addClimbChevrons(job.visualPts, job.width);
    }
    this._flushRailPosts();
    let meshCount = 0;
    this.root.traverse((o) => { if (o.isMesh) meshCount++; });
    const ms = ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - t0;
    console.log(
      `[TrackSystem] meshes deferred-built meshes=${meshCount} in ${ms.toFixed(0)}ms (Explore never paid this)`
    );
  }

  _makeSharedRoadMats() {
    // Lambert/Basic: asphalt is large + always in Drive frustum; Standard × moving fill
    // PointLight was a major SwiftShader cost while holding W.
    const asphaltOpts = { color: 0x1a1a22 };
    if (this._asphalt) { asphaltOpts.map = this._asphalt; asphaltOpts.color = 0xffffff; }
    const asphalt = new THREE.MeshLambertMaterial(asphaltOpts);
    const chevronOpts = { color: 0x22222a };
    if (this._chevron) { chevronOpts.map = this._chevron; chevronOpts.color = 0xffffff; }
    const chevron = new THREE.MeshLambertMaterial(chevronOpts);
    const rail = new THREE.MeshLambertMaterial({
      color: 0xc9a227,
      emissive: 0x3a2a08, emissiveIntensity: 0.12,
    });
    const side = new THREE.MeshLambertMaterial({
      color: 0x121218,
    });
    return { asphalt, chevron, rail, side };
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

  _addSpawnPadLogic() {
    const r = 2.35;
    this._spawnApron = { x: CAR_SPAWN.x, z: CAR_SPAWN.z, r, y: 0.06 };
  }

  _addSpawnPadMesh() {
    const r = this._spawnApron?.r || 2.35;
    const geo = new THREE.CircleGeometry(r, 48);
    const mat = this._sharedMats.asphalt.clone();
    if (mat.map) {
      mat.map = mat.map.clone();
      mat.map.repeat.set(3, 3);
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = "spawn_clean_pad";
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(CAR_SPAWN.x, 0.06 + 0.012, CAR_SPAWN.z);
    mesh.receiveShadow = false;
    this.root.add(mesh);
    if (this._startFinish) {
      const sf = new THREE.Mesh(
        new THREE.PlaneGeometry(r * 0.55, r * 0.18),
        new THREE.MeshLambertMaterial({ map: this._startFinish })
      );
      sf.rotation.x = -Math.PI / 2;
      sf.position.set(CAR_SPAWN.x, 0.06 + 0.018, CAR_SPAWN.z);
      sf.receiveShadow = false;
      this.root.add(sf);
    }
  }

  _buildPathLogic(path) {
    const kind = path.kind || "floor";
    const width = path.width;
    const tension = path.tension != null ? path.tension : 0.15;
    const pts = path.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    if (pts.length < 2) return;

    let visualPts = pts;
    let snapPts = pts;
    if (pts.length >= 3) {
      const curve = new THREE.CatmullRomCurve3(pts, !!path.closed, "catmullrom", tension);
      const climb = kind === "ramp";
      const foyerClimb = path.id === "ramp_foyer_to_landing";
      // Keep visual density modest — high subdiv + per-post meshes previously hit ~230
      // meshes and could OOM Chrome's GPU process the moment Drive setVisible(true).
      const visN = Math.max(pts.length * (foyerClimb ? 4 : climb ? 4 : path.fancy ? 3 : 3),
        foyerClimb ? 28 : climb ? 24 : path.fancy ? 18 : 12);
      const snapN = Math.max(pts.length * (climb ? 5 : 3), climb ? 24 : 12);
      visualPts = curve.getPoints(visN);
      snapPts = curve.getPoints(snapN);
      if (path.closed && visualPts.length > 2
          && visualPts[0].distanceTo(visualPts[visualPts.length - 1]) < 0.04) {
        visualPts = visualPts.slice(0, -1);
      }
      if (path.closed && snapPts.length > 2
          && snapPts[0].distanceTo(snapPts[snapPts.length - 1]) < 0.04) {
        snapPts = snapPts.slice(0, -1);
      }
    }

    const isRail = !!path.rail || kind === "ramp" || kind === "balcony" || kind === "elevated";

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
      });
    }

    const gap = (path.id === "foyer_skirting" || path.id === "foyer_drive_start"
      || path.id === "foyer_climb_spur")
      ? { x: CAR_SPAWN.x, z: CAR_SPAWN.z, r: Math.max(2.55, (this._spawnApron?.r || 2.25) + 0.35) }
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

    // Queue ribbon/rail visuals — built only on first Drive enter
    this._pendingVisuals.push({
      visualPts,
      width,
      kind,
      closed: !!path.closed,
      gap,
      isRail,
      climbChevrons: kind === "ramp" && path.id === "ramp_foyer_to_landing",
    });
  }

  _addRibbonRoad(pts, width, kind, closed, gap, isRail) {
    if (!pts || pts.length < 2) return;
    const yLift = ribbonYLift(kind);
    const halfW = width * 0.5;
    // Thick asphalt deck (ramp thicker)
    const thick = kind === "ramp" ? 0.112 : (kind === "balcony" ? 0.055 : 0.042);

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
        uvs.push(0, distAcc * 0.55, 1, distAcc * 0.55);
        if (i > 0) {
          const a = (i - 1) * 2, b = a + 1, c = i * 2, d = c + 1;
          idx.push(a, b, c, b, d, c);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mat = kind === "ramp" ? this._sharedMats.chevron : this._sharedMats.asphalt;
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

      if (isRail && (kind === "balcony" || kind === "ramp")) {
        // Sparse posts → batched in _flushRailPosts as one InstancedMesh
        const step = Math.max(2, Math.floor(left.length / 12));
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

  _addClimbChevrons(pts, width) {
    // Already using chevron material on ramp ribbon — optional arrow markers at foot
    if (!pts.length) return;
    const foot = pts[0];
    const marker = new THREE.Mesh(
      new THREE.ConeGeometry(width * 0.18, 0.08, 3),
      new THREE.MeshLambertMaterial({
        color: 0xffe066, emissive: 0xaa8800, emissiveIntensity: 0.35,
      })
    );
    marker.rotation.x = Math.PI / 2;
    marker.position.set(foot.x, foot.y + 0.05, foot.z);
    this.root.add(marker);
  }

  /**
   * Binary snap: onTrack only when wheels are on a ribbon.
   * Carpet = supported story floor off-ribbon (no onTrack).
   * Strong hysteresis: prefer _lastPathId unless intentional junction.
   */
  querySnap(x, y, z, radius = 2.4, carYaw = null) {
    const storyFloors = [8.46, 4.26, 0.075, -4.05];
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
      const foyerClimbXZ = seg.pathId === "ramp_foyer_to_landing"
        && (this._lastPathId === "ramp_foyer_to_landing"
          || this._lastPathId === "foyer_climb_spur");

      let t;
      if (foyerClimbXZ) {
        const abLenSq = abx * abx + abz * abz;
        t = abLenSq > 1e-8 ? (apx * abx + apz * abz) / abLenSq : 0;
      } else if (steep || seg.kind === "ramp") {
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
      const isFloor = FLOOR_KINDS.has(seg.kind);
      const flatDeck = seg.kind === "balcony" || seg.kind === "elevated" || seg.kind === "cornice";
      const signedBelow = py - y;
      const halfApprox = seg.width * 0.5;
      const foyerClimbSeg = seg.pathId === "ramp_foyer_to_landing";
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
      if (seg.pathId === "ramp_foyer_to_landing" && y >= 3.90
          && (this._lastPathId === "landing_skirting"
            || this._lastPathId === "ramp_landing_to_balcony"
            || this._lastPathId === "balcony_loop"
            || this._lastPathId === "ramp_balcony_return")) {
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
      const pathBias = (this._lastPathId && seg.pathId === this._lastPathId) ? -0.92 : 0;
      const floorBias = (onFloorCruise && isFloor && dy < 0.28) ? -0.22 : 0;

      const rampGrade = seg.kind === "ramp"
        ? Math.abs(aby) / Math.max(1e-4, Math.hypot(abx, abz)) : 0;
      const foyerFootDist = foyerClimbSeg
        ? Math.hypot(x - FOYER_CLIMB_FOOT.x, z - FOYER_CLIMB_FOOT.z) : Infinity;
      const foyerFootEngage = foyerClimbSeg && foyerFootDist < FOYER_CLIMB_ENGAGE_R;

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
      if (rampBias && rampGrade < 0.08 && seg.pathId !== "ramp_foyer_to_landing") {
        rampBias *= (inRampCorridor && checkDist < halfApprox) ? 0.88 : 0.28;
      }
      if (rampBias && foyerFootEngage) rampBias -= 0.35;

      // Intentional junction bonuses (spur→climb, crest→landing, balcony lips)
      let junctionBias = 0;
      if (!pathBias) {
        if (seg.pathId === "ramp_foyer_to_landing"
            && (this._lastPathId === "foyer_climb_spur" || this._lastPathId === "foyer_drive_start")
            && foyerFootEngage) {
          junctionBias = -0.55;
        }
        if (seg.pathId === "landing_skirting"
            && this._lastPathId === "ramp_foyer_to_landing"
            && y >= 3.85 && dist < halfApprox * 1.4) {
          junctionBias = -0.70;
        }
        if ((seg.pathId === "ramp_landing_to_balcony" || seg.pathId === "ramp_balcony_return")
            && this._lastPathId === "landing_skirting" && inRampCorridor) {
          junctionBias = -0.40;
        }
        if (seg.pathId === "balcony_loop"
            && (this._lastPathId === "ramp_landing_to_balcony" || this._lastPathId === "ramp_balcony_return")
            && dist < halfApprox * 1.3) {
          junctionBias = -0.55;
        }
        if (seg.pathId === "landing_skirting"
            && this._lastPathId === "ramp_balcony_return"
            && dist < halfApprox * 1.3) {
          junctionBias = -0.55;
        }
        // Floor re-engage when drifted onto another floor ribbon under wheels
        if (isFloor && this._lastPathKind === "floor" && dist < halfApprox * 0.95 && dy < 0.2) {
          junctionBias = -0.15;
        }
      }

      const score = checkDist + dy * dyW + pathBias + floorBias + rampBias + junctionBias;
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
          (best.pathId === "ramp_foyer_to_landing"
            && (this._lastPathId === "foyer_climb_spur" || this._lastPathId === "foyer_drive_start")
            && Math.hypot(x - FOYER_CLIMB_FOOT.x, z - FOYER_CLIMB_FOOT.z) < FOYER_CLIMB_ENGAGE_R)
          || (best.pathId === "landing_skirting" && this._lastPathId === "ramp_foyer_to_landing" && y >= 3.85)
          || (best.pathId === "ramp_landing_to_balcony" && this._lastPathId === "landing_skirting")
          || (best.pathId === "balcony_loop" && this._lastPathId === "ramp_landing_to_balcony")
          || (best.pathId === "ramp_balcony_return" && this._lastPathId === "balcony_loop")
          || (best.pathId === "landing_skirting" && this._lastPathId === "ramp_balcony_return")
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

    // Spawn apron: asphalt feel, latch ONLY foyer_drive_start
    const apron = this._spawnApron;
    const onApron = apron && Math.abs(y - apron.y) < 0.35
      && Math.hypot(x - apron.x, z - apron.z) < apron.r;

    if (!chosen) {
      if (onApron || (storyY != null && storyDy < 0.35)) {
        const carpetY = (onApron ? apron.y : storyY) + 0.015;
        if (onApron) {
          this._lastPathId = "foyer_drive_start";
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
          pathId: onApron ? "foyer_drive_start" : null,
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
    // Foyer climb approach apron: within engage radius at floor Y → supported nearDeck
    // (runway / imperfect aim behind foot — not a track teleport)
    if (!onRibbon && chosen.pathId === "ramp_foyer_to_landing" && storyY != null && storyDy < 0.35) {
      const fd = Math.hypot(x - FOYER_CLIMB_FOOT.x, z - FOYER_CLIMB_FOOT.z);
      if (fd < FOYER_CLIMB_ENGAGE_R) nearDeck = true;
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
