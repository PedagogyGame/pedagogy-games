import * as THREE from "three";
import { TRACK_PATHS, CAR_SPAWN, RAMP_MOUNT_FEET } from "../data/tracks.js?v=ramps1";

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
  // Near-black deck so white/yellow paint pops under lite Drive lights
  ctx.fillStyle = "#050508";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 500; i++) {
    const v = 10 + Math.random() * 16;
    ctx.fillStyle = `rgba(${v},${v},${v + 2},0.28)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  // WHITE edge lanes — thick, solid, high contrast
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 14;
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(18, 256); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(238, 0); ctx.lineTo(238, 256); ctx.stroke();
  // Soft outer halo so edges stay readable at glancing angles
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 22;
  ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(18, 256); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(238, 0); ctx.lineTo(238, 256); ctx.stroke();
  // YELLOW center dashes — wider + longer
  ctx.strokeStyle = "#ffdd22";
  ctx.lineWidth = 12;
  ctx.setLineDash([36, 16]);
  ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 256); ctx.stroke();
  ctx.strokeStyle = "rgba(255,200,40,0.55)";
  ctx.lineWidth = 18;
  ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 256); ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeChevronTexture() {
  const c = makeCanvas(128, 256);
  if (!c) return null;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#06060a";
  ctx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 200; i++) {
    const v = 12 + Math.random() * 18;
    ctx.fillStyle = `rgba(${v},${v + 2},${v + 4},0.26)`;
    ctx.fillRect(Math.random() * 128, Math.random() * 256, 1, 1);
  }
  // WHITE edges — thick on climb ramps too
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 11;
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(10, 256); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(118, 0); ctx.lineTo(118, 256); ctx.stroke();
  // YELLOW chevrons + center spine
  ctx.strokeStyle = "#ffdd22";
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, 256); ctx.stroke();
  ctx.lineWidth = 10;
  for (let y = 10; y < 256; y += 40) {
    ctx.beginPath();
    ctx.moveTo(22, y + 22); ctx.lineTo(64, y); ctx.lineTo(106, y + 22);
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

const FOYER_CLIMB_FOOT = (RAMP_MOUNT_FEET.climb_a?.foot)
  || { x: -7.00, y: 0.0, z: 12.30 };
const FOYER_CLIMB_ENGAGE_R = ((RAMP_MOUNT_FEET.climb_a?.engageBack) || 1.25) + 1.35;
const CLIMB_B_FOOT = (RAMP_MOUNT_FEET.climb_b?.foot)
  || { x: 7.00, y: 4.20, z: 13.80 };
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
    this._addSpawnPadMesh();
    for (const job of this._pendingVisuals) {
      this._addRibbonRoad(job.visualPts, job.width, job.kind, job.closed, job.gap, job.isRail);
      if (job.climbChevrons) this._addClimbChevrons(job.visualPts, job.width);
      if (job.curb) this._addCurbRails(job.visualPts, job.width, job.kind);
      if (job.voidBarriers) this._addVoidBarriers(job.visualPts, job.width);
      if (job.cornerChevrons) this._addCornerChevrons(job.visualPts, job.width);
    }
    this._addJunctionFlowChevrons();
    this._flushRailPosts();
    this._flushCurbSegments();
    this._flushUnderfill();
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
      color: 0x1a1a22,
      emissive: 0x222218,
      emissiveIntensity: 0.22,
    };
    if (this._asphalt) { asphaltOpts.map = this._asphalt; asphaltOpts.color = 0xffffff; }
    const asphalt = new THREE.MeshLambertMaterial(asphaltOpts);
    const chevronOpts = {
      color: 0x22222a,
      emissive: 0x2a2810,
      emissiveIntensity: 0.28,
    };
    if (this._chevron) { chevronOpts.map = this._chevron; chevronOpts.color = 0xffffff; }
    const chevron = new THREE.MeshLambertMaterial(chevronOpts);
    const rail = new THREE.MeshLambertMaterial({
      color: 0xc9a227,
      emissive: 0x3a2a08, emissiveIntensity: 0.12,
    });
    const side = new THREE.MeshLambertMaterial({
      color: 0x121218,
    });
    const curb = new THREE.MeshLambertMaterial({ color: 0x0a0a10 });
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
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      dummy.position.set(s.x, s.y, s.z);
      dummy.scale.set(s.sx, s.sy, s.sz);
      dummy.rotation.set(0, s.yaw || 0, 0);
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
    // y = plank top (path band); ride height = y + ASPHALT_RIDE
    this._spawnApron = { x: CAR_SPAWN.x, z: CAR_SPAWN.z, r, y: 0.0 };
  }

  _addSpawnPadMesh() {
    const r = this._spawnApron?.r || 2.35;
    const thick = ASPHALT_THICK_FLOOR;
    const topY = ASPHALT_RIDE;
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
      this.root.add(dash);
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
    if (pts.length >= 3) {
      const curve = new THREE.CatmullRomCurve3(pts, !!path.closed, "catmullrom", tension);
      const climb = kind === "ramp";
      const foyerClimb = path.id === "climb_a" || path.id === "climb_b";
      // Figure-8 densify cut — curb InstancedMesh + low subdiv keeps SwiftShader alive on W.
      const visN = Math.max(pts.length * (foyerClimb ? 2 : climb ? 2 : path.fancy ? 2 : 2),
        foyerClimb ? 14 : climb ? 12 : path.fancy ? 10 : 8);
      const snapN = Math.max(pts.length * (climb ? 3 : 2), climb ? 16 : 10);
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

    const gap = (path.id === "foyer_oval" || path.id === "foyer_finish"
      || path.id === "foyer_to_climb_a")
      ? { x: CAR_SPAWN.x, z: CAR_SPAWN.z, r: Math.max(2.80, (this._spawnApron?.r || 2.25) + 0.45) }
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
      climbChevrons: kind === "ramp" && (path.id === "climb_a" || path.id === "climb_b"),
      voidBarriers: kind === "ramp",
      cornerChevrons: path.id === "landing_hairpin" || path.id === "balcony_loop",
      curb: true,
    });
  }

  _addRibbonRoad(pts, width, kind, closed, gap, isRail) {
    if (!pts || pts.length < 2) return;
    const yLift = ribbonYLift(kind);
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
        uvs.push(0, distAcc * 0.42, 1, distAcc * 0.42);
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
      // Ramps: dark asphalt + white edges + yellow center (Mario Kart readable).
      // Chevrons are foot markers only — never the whole ribbon.
      const mat = this._sharedMats.asphalt;
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
            botIdx.push(a, c, b, b, c, d);
          }
        }
        const botGeo = new THREE.BufferGeometry();
        botGeo.setAttribute("position", new THREE.Float32BufferAttribute(botPos, 3));
        botGeo.setIndex(botIdx);
        botGeo.computeVertexNormals();
        const botMesh = new THREE.Mesh(botGeo, this._sharedMats.side);
        botMesh.name = "ramp_bottom";
        this.root.add(botMesh);

        const bucket = this._underfillPositions || (this._underfillPositions = []);
        // Sparse keels — ~6 per climb, one InstancedMesh later
        const step = Math.max(3, Math.floor(left.length / 6));
        for (let i = 0; i < left.length - 1; i += step) {
          const j = Math.min(left.length - 1, i + step);
          const deckY = Math.min(tops[i], tops[j]);
          const yTop = deckY - thick;
          const pathY = Math.min(slice[i].y, slice[j].y);
          const plantY = pathY >= 2.1 ? 4.20 : 0.0;
          let keelH = Math.max(0.16, Math.min(1.05, yTop - plantY - 0.02));
          const midX = (left[i].x + right[i].x + left[j].x + right[j].x) * 0.25;
          const midZ = (left[i].z + right[i].z + left[j].z + right[j].z) * 0.25;
          const midY = yTop - keelH * 0.5;
          const span = Math.hypot(slice[j].x - slice[i].x, slice[j].z - slice[i].z) || 0.4;
          const yaw = Math.atan2(slice[j].x - slice[i].x, slice[j].z - slice[i].z);
          bucket.push({
            x: midX, y: midY, z: midZ,
            sx: width * 0.90, sy: keelH, sz: Math.max(0.45, span * 0.92),
            yaw,
          });
        }
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

  /** Continuous dark curb strips — queued for one InstancedMesh flush (GPU-safe). */
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
        bucket.push({
          x: (a.x + b.x) * 0.5,
          y: (a.y + b.y) * 0.5,
          z: (a.z + b.z) * 0.5,
          sx: curbW * 0.55,
          sy: curbH,
          sz: len,
          yaw,
        });
      }
    }
  }

  /** Thick barrier + warning band at climb void lips (foot & crest). */
  _addVoidBarriers(pts, width) {
    if (!pts || pts.length < 2) return;
    const matBar = new THREE.MeshLambertMaterial({ color: 0x1a1a22 });
    const matWarn = new THREE.MeshLambertMaterial({
      color: 0xffcc33, emissive: 0xaa8800, emissiveIntensity: 0.25,
    });
    for (const idx of [0, pts.length - 1]) {
      const p = pts[idx];
      const q = pts[idx === 0 ? 1 : pts.length - 2];
      let tx = p.x - q.x, tz = p.z - q.z;
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl; tz /= tl;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(width + 0.55, 0.22, 0.16), matBar);
      bar.position.set(p.x + tx * 0.12, p.y + 0.14, p.z + tz * 0.12);
      bar.lookAt(p.x + tx, bar.position.y, p.z + tz);
      this.root.add(bar);
      const warn = new THREE.Mesh(new THREE.BoxGeometry(width + 0.35, 0.03, 0.35), matWarn);
      warn.position.set(p.x, p.y + 0.02, p.z);
      this.root.add(warn);
    }
  }

  /** Outer chevrons on hairpin / balcony corners (GPU-lite sparse). */
  _addCornerChevrons(pts, width) {
    if (!pts || pts.length < 4) return;
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffe066, emissive: 0x886600, emissiveIntensity: 0.2,
    });
    let placed = 0;
    for (let i = 2; i < pts.length - 2; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const ax = b.x - a.x, az = b.z - a.z;
      const bx = c.x - b.x, bz = c.z - b.z;
      const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1;
      const dot = (ax * bx + az * bz) / (la * lb);
      if (dot > 0.55) continue; // only sharp corners
      if (placed > 6) break;
      placed++;
      const chev = new THREE.Mesh(new THREE.ConeGeometry(width * 0.10, 0.06, 3), mat);
      chev.rotation.x = Math.PI / 2;
      chev.position.set(b.x, b.y + 0.04, b.z);
      chev.castShadow = false;
      chev.receiveShadow = false;
      this.root.add(chev);
    }
  }


  /**
   * Discrete painted flow arrows at figure-8 junctions — lap direction only.
   * foyer→Climb A, hairpin, balcony→Climb B, finish. One InstancedMesh (GPU-lite).
   */
  _addJunctionFlowChevrons() {
    const marks = [
      // foyer_oval → Climb A
      { x: -5.00, y: 0.0, z: 11.70, yaw: Math.atan2(0.0, 1.0) },
      // Climb A crest → landing_hairpin
      { x: -5.00, y: 4.20, z: -2.10, yaw: Math.atan2(0.8, 1.2) },
      // landing_hairpin → balcony_loop
      { x: 4.70, y: 4.20, z: 9.40, yaw: Math.atan2(0.4, 1.0) },
      // balcony_loop → balcony_to_climb_b
      { x: 5.20, y: 4.20, z: 14.40, yaw: Math.atan2(0.2, -1.0) },
      // Climb B foot → foyer_finish
      { x: 7.00, y: 0.0, z: 12.50, yaw: Math.atan2(-1.0, -0.35) },
      // foyer_finish → foyer_oval start
      { x: 1.20, y: 0.0, z: 10.45, yaw: Math.atan2(-1.0, 0.0) },
    ];
    // Two chevrons per junction (lead + trail) → 12 instances, 1 draw
    const count = marks.length * 2;
    const geo = new THREE.ConeGeometry(0.17, 0.36, 3);
    // Strengthened (#6) — brighter emissive so lap direction reads at a glance
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffee77, emissive: 0xcc8800, emissiveIntensity: 0.48,
    });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.name = "junction_flow_chevrons";
    inst.castShadow = false;
    inst.receiveShadow = false;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (const m of marks) {
      for (const [along, scl] of [[0, 1.08], [0.42, 0.88]]) {
        dummy.position.set(
          m.x + Math.sin(m.yaw) * along,
          m.y + 0.052,
          m.z + Math.cos(m.yaw) * along
        );
        dummy.rotation.order = "YXZ";
        dummy.rotation.set(Math.PI / 2, m.yaw, 0);
        dummy.scale.setScalar(scl);
        dummy.updateMatrix();
        inst.setMatrixAt(i++, dummy.matrix);
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    this.root.add(inst);
  }


  _flushUnderfill() {
    const list = this._underfillPositions || [];
    this._underfillPositions = [];
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
            || this._lastPathId === "foyer_oval"))
        || (seg.pathId === "climb_b"
          && (this._lastPathId === "climb_b" || this._lastPathId === "balcony_to_climb_b"
            || this._lastPathId === "balcony_loop"));

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
            || this._lastPathId === "balcony_loop"
            || this._lastPathId === "balcony_to_climb_b"
            || this._lastPathId === "climb_b"
            || this._lastPathId === "foyer_finish")) {
        continue;
      }
      if (seg.pathId === "climb_b" && y <= 0.55
          && (this._lastPathId === "foyer_oval" || this._lastPathId === "foyer_finish"
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
      const foyerFootEngage = (seg.pathId === "climb_a" && climbAFootDist < FOYER_CLIMB_ENGAGE_R)
        || (seg.pathId === "climb_b" && climbBFootDist < CLIMB_B_ENGAGE_R);

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
      // Must stay magnetized until near tip — foyer_oval east wall shares x=7 z≈9..12.4,
      // so early soften lets oval steal before foyer_finish kiss. Soften only near tip,
      // slightly earlier than Climb A (tRaw>0.82 vs 0.90) because last seg is longer (~2.2m).
      if (seg.pathId === "climb_b" && this._lastPathId === "climb_b"
          && y <= 0.35 && tRaw > 0.82) {
        rampBias *= 0.12;
        pathBias *= 0.20;
      }

      // Intentional junction bonuses — figure-8 kissed handoffs
      let junctionBias = 0;
      if (!pathBias) {
        if (seg.pathId === "climb_a"
            && (this._lastPathId === "foyer_to_climb_a" || this._lastPathId === "foyer_oval")
            && foyerFootEngage) {
          junctionBias = -0.55;
        }
        if (seg.pathId === "landing_hairpin"
            && this._lastPathId === "climb_a"
            && y >= 3.85 && dist < halfApprox * 1.4) {
          // Stronger crest kiss (#5/#9) — must beat climb_a rampBias+pathBias at tip
          junctionBias = y >= 4.0 ? -1.55 : -0.70;
        }
        if (seg.pathId === "balcony_loop"
            && this._lastPathId === "landing_hairpin"
            && dist < halfApprox * 1.3) {
          junctionBias = -0.55;
        }
        if (seg.pathId === "climb_b"
            && (this._lastPathId === "balcony_to_climb_b" || this._lastPathId === "balcony_loop")
            && foyerFootEngage) {
          junctionBias = -0.55;
        }
        if (seg.pathId === "foyer_finish"
            && this._lastPathId === "climb_b"
            && y < 0.55 && dist < halfApprox * 1.4) {
          // Beat climb_b tip magnet AND coplanar foyer_oval east wall at x=7
          junctionBias = y <= 0.35 ? -1.85 : -0.85;
        }
        if (seg.pathId === "foyer_oval"
            && this._lastPathId === "climb_b"
            && y < 0.55 && dist < halfApprox * 1.2) {
          // Block oval steal at Climb B foot — finish must win the kiss first
          junctionBias = 0.95;
        }
        if (seg.pathId === "foyer_oval"
            && this._lastPathId === "foyer_finish"
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
            && (this._lastPathId === "foyer_to_climb_a" || this._lastPathId === "foyer_oval")
            && Math.hypot(x - FOYER_CLIMB_FOOT.x, z - FOYER_CLIMB_FOOT.z) < FOYER_CLIMB_ENGAGE_R)
          || (best.pathId === "landing_hairpin" && this._lastPathId === "climb_a" && y >= 3.85)
          || (best.pathId === "balcony_loop" && this._lastPathId === "landing_hairpin")
          || (best.pathId === "balcony_to_climb_b" && this._lastPathId === "balcony_loop")
          || (best.pathId === "climb_b"
            && (this._lastPathId === "balcony_to_climb_b" || this._lastPathId === "balcony_loop")
            && Math.hypot(x - CLIMB_B_FOOT.x, z - CLIMB_B_FOOT.z) < CLIMB_B_ENGAGE_R)
          || (best.pathId === "foyer_finish" && this._lastPathId === "climb_b" && y < 0.55)
          || (best.pathId === "foyer_oval" && this._lastPathId === "foyer_finish")
          || (best.pathId === "foyer_to_climb_a" && this._lastPathId === "foyer_oval")
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

    // Spawn apron: asphalt feel, latch ONLY foyer_oval
    const apron = this._spawnApron;
    const onApron = apron && Math.abs(y - apron.y) < 0.35
      && Math.hypot(x - apron.x, z - apron.z) < apron.r;

    if (!chosen) {
      if (onApron || (storyY != null && storyDy < 0.35)) {
        // Apron.y is plank top; storyY is already ride height from storyFloors
        const carpetY = onApron ? (apron.y + ASPHALT_RIDE) : storyY;
        if (onApron) {
          this._lastPathId = "foyer_oval";
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
          pathId: onApron ? "foyer_oval" : null,
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
    if (!onRibbon && (chosen.pathId === "climb_a" || chosen.pathId === "climb_b")
        && storyY != null && storyDy < 0.55) {
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
