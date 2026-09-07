import * as THREE from "three";
import { TRACK_PATHS } from "../data/tracks.js";

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
  c.width = 256; c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1c1c22";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const v = 28 + Math.random() * 50;
    ctx.fillStyle = `rgba(${v},${v},${v + 4},0.4)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  ctx.strokeStyle = "#e8eaf0";
  ctx.lineWidth = 10;
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(18, 256); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(238, 0); ctx.lineTo(238, 256); ctx.stroke();
  ctx.strokeStyle = "#f5c400";
  ctx.lineWidth = 6;
  ctx.setLineDash([18, 14]);
  ctx.beginPath();
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeChevronTexture() {
  const c = makeCanvas(64, 128);
  if (!c) return null;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#37474f";
  ctx.fillRect(0, 0, 64, 128);
  ctx.strokeStyle = "#ffd54f";
  ctx.lineWidth = 5;
  for (let y = 8; y < 128; y += 28) {
    ctx.beginPath();
    ctx.moveTo(12, y + 16);
    ctx.lineTo(32, y);
    ctx.lineTo(52, y + 16);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
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

const ELEV_KINDS = new Set(["elevated", "cornice", "balcony", "ramp", "shortcut", "mouse", "shaft", "chute"]);
const MAGNET_KINDS = new Set(["elevated", "cornice", "balcony", "ramp", "shortcut", "mouse", "shaft", "chute", "tunnel"]);

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
    this._asphalt = makeAsphaltTexture();
    this._chevron = makeChevronTexture();
    this._petal = makePetalTexture();
    this._hollow = makeHollowTexture();
    this._tmp = new THREE.Vector3();
    this._moteMats = [];
    this._buildAll();
  }

  _buildAll() {
    for (const path of TRACK_PATHS) {
      this._buildPath(path);
    }
  }

  _buildPath(path) {
    const pts = path.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    if (pts.length < 2) return;
    const width = path.width || 1.2;
    const kind = path.kind || "floor";
    const tension = path.tension != null ? path.tension : 0.22;

    let curvePts = pts;
    if (pts.length >= 3) {
      const curve = new THREE.CatmullRomCurve3(pts, !!path.closed, "catmullrom", tension);
      const dense =
        kind === "elevated" || kind === "cornice" || kind === "ramp" || kind === "balcony"
          ? 7
          : kind === "shortcut" || kind === "mouse" || kind === "shaft" || kind === "chute"
            ? 5
            : kind === "flower" || kind === "tunnel" ? 5 : 4;
      const n = Math.max(pts.length * dense, 20);
      curvePts = curve.getPoints(n);
    }

    const isRail =
      !!path.rail
      || kind === "elevated" || kind === "ramp" || kind === "cornice" || kind === "balcony"
      || kind === "shortcut" || kind === "mouse" || kind === "shaft" || kind === "chute";

    for (let i = 0; i < curvePts.length - 1; i++) {
      const a = curvePts[i];
      const b = curvePts[i + 1];
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
        magnet: MAGNET_KINDS.has(kind),
      });

      this._addRoadMesh(a, b, dir, len, width, kind, isRail);
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
    if (kind === "ramp" || kind === "cornice") {
      // On-ramp signage: emissive arrows near first point
      if (path.id && (path.id.startsWith("ramp_") || path.id.includes("brace"))) {
        this._addArrowSign(pts[0], pts[Math.min(1, pts.length - 1)]);
      }
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
      kind === "elevated" || kind === "cornice" || kind === "balcony" ? 0.09
        : kind === "ramp" || kind === "chute" ? 0.07
          : kind === "shortcut" || kind === "mouse" || kind === "shaft" ? 0.055
            : kind === "flower" ? 0.04
              : 0.045;
    const geo = new THREE.BoxGeometry(width, thick, len);
    let mat;
    if (kind === "outdoor") {
      mat = new THREE.MeshStandardMaterial({ color: 0x5c564c, roughness: 0.92, metalness: 0.05 });
    } else if (kind === "flower") {
      const opts = { color: 0x5d4037, roughness: 0.88, metalness: 0.04 };
      if (this._petal) {
        opts.map = this._petal.clone();
        opts.map.repeat.set(1, Math.max(1, len / 1.2));
        opts.map.needsUpdate = true;
        opts.color = 0xffffff;
      }
      mat = new THREE.MeshStandardMaterial(opts);
    } else if (kind === "cornice") {
      mat = new THREE.MeshStandardMaterial({
        color: 0x3e2723, roughness: 0.55, metalness: 0.18,
      });
    } else if (kind === "balcony") {
      mat = new THREE.MeshStandardMaterial({
        color: 0x6d4c41, roughness: 0.7, metalness: 0.08,
      });
    } else if (kind === "shortcut" || kind === "mouse" || kind === "shaft") {
      const opts = {
        color: 0x2a2018, roughness: 0.78, metalness: 0.08,
      };
      if (this._hollow) {
        opts.map = this._hollow.clone();
        opts.map.repeat.set(1, Math.max(1, len / 1.1));
        opts.map.needsUpdate = true;
        opts.color = 0xffffff;
      }
      mat = new THREE.MeshStandardMaterial(opts);
    } else if (kind === "chute") {
      mat = new THREE.MeshStandardMaterial({
        color: 0x37474f, roughness: 0.4, metalness: 0.35,
        emissive: 0x263238, emissiveIntensity: 0.15,
      });
    } else if (kind === "elevated" || kind === "ramp") {
      const opts = {
        color: kind === "ramp" ? 0x455a64 : 0x263238,
        roughness: 0.5, metalness: 0.28,
      };
      if (kind === "ramp" && this._chevron) {
        opts.map = this._chevron.clone();
        opts.map.repeat.set(1, Math.max(1, len / 0.9));
        opts.map.needsUpdate = true;
        opts.color = 0xffffff;
      }
      mat = new THREE.MeshStandardMaterial(opts);
    } else if (kind === "tunnel") {
      mat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.65, metalness: 0.12 });
    } else {
      const opts = { color: 0x1c1c22, roughness: 0.82, metalness: 0.06 };
      if (this._asphalt) {
        opts.map = this._asphalt.clone();
        opts.map.repeat.set(1, Math.max(1, len / 1.4));
        opts.map.needsUpdate = true;
        opts.color = 0xffffff;
      }
      mat = new THREE.MeshStandardMaterial(opts);
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(mid);
    const xAxis = this._orientMesh(mesh, dir);
    mesh.receiveShadow = true;
    mesh.castShadow = kind === "elevated" || kind === "cornice" || kind === "balcony";
    mesh.frustumCulled = true;
    this.root.add(mesh);

    // Gold edge strip on cornice
    if (kind === "cornice") {
      for (const side of [-1, 1]) {
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.025, len),
          new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.7 })
        );
        const off = xAxis.clone().multiplyScalar(side * (width * 0.5 - 0.02));
        strip.position.copy(mid).add(off);
        strip.position.y += thick * 0.55;
        strip.quaternion.copy(mesh.quaternion);
        this.root.add(strip);
      }
    }

    // Petal-colored edge dust on flower paths
    if (kind === "flower") {
      const petalColors = [0xe91e63, 0xf48fb1, 0xffcdd2, 0xce93d8];
      for (const side of [-1, 1]) {
        const dust = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.015, len * 0.95),
          new THREE.MeshStandardMaterial({
            color: petalColors[(side + 1) % petalColors.length],
            roughness: 0.7, metalness: 0.05,
            emissive: 0xe91e63, emissiveIntensity: 0.18,
            transparent: true, opacity: 0.75,
          })
        );
        const off = xAxis.clone().multiplyScalar(side * (width * 0.5 - 0.02));
        dust.position.copy(mid).add(off);
        dust.position.y += thick * 0.6;
        dust.quaternion.copy(mesh.quaternion);
        this.root.add(dust);
      }
    }

    // Timber skirting edges inside hollow walls
    if (kind === "shortcut" || kind === "mouse" || kind === "shaft") {
      for (const side of [-1, 1]) {
        const trim = new THREE.Mesh(
          new THREE.BoxGeometry(0.035, 0.04, len),
          new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.65, metalness: 0.1 })
        );
        const off = xAxis.clone().multiplyScalar(side * (width * 0.5 - 0.01));
        trim.position.copy(mid).add(off);
        trim.position.y += thick * 0.4;
        trim.quaternion.copy(mesh.quaternion);
        this.root.add(trim);
      }
    }

    if ((kind === "floor" || kind === "outdoor") && !this._asphalt) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.012, len * 0.95),
        new THREE.MeshBasicMaterial({ color: 0xf0c000 })
      );
      line.position.copy(mid);
      line.position.y += thick * 0.55;
      line.quaternion.copy(mesh.quaternion);
      this.root.add(line);
    }

    if (rail || ELEV_KINDS.has(kind)) {
      const railColor =
        kind === "cornice" ? 0xc9a227
          : kind === "balcony" ? 0xd7ccc8
            : kind === "shortcut" || kind === "mouse" || kind === "shaft" ? 0x8d6e63
              : kind === "chute" ? 0x90a4ae
                : 0xffcc80;
      const woodColor = kind === "cornice" ? 0x4e342e : 0x5d4037;
      const railH = (kind === "shortcut" || kind === "shaft" || kind === "chute") ? 0.11 : 0.14;
      const slim = kind === "shortcut" || kind === "mouse" || kind === "shaft" || kind === "flower";
      for (const side of [-1, 1]) {
        const railMesh = new THREE.Mesh(
          new THREE.BoxGeometry(slim ? 0.04 : 0.05, railH, len),
          new THREE.MeshStandardMaterial({
            color: railColor, roughness: 0.38, metalness: 0.55,
            transparent: true, opacity: kind === "balcony" ? 0.85 : slim ? 0.55 : 0.7,
          })
        );
        const off = xAxis.clone().multiplyScalar(side * (width * 0.5 + 0.03));
        railMesh.position.copy(mid).add(off);
        railMesh.position.y += 0.1;
        railMesh.quaternion.copy(mesh.quaternion);
        this.root.add(railMesh);

        // Skip wood base on slim cavities to keep mesh count down
        if (!slim) {
          const base = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.04, len),
            new THREE.MeshStandardMaterial({ color: woodColor, roughness: 0.7, metalness: 0.1 })
          );
          base.position.copy(mid).add(off);
          base.position.y += 0.02;
          base.quaternion.copy(mesh.quaternion);
          this.root.add(base);
        }
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
    const r = kind === "flower" ? 0.38 : 0.42;
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x5d4037, roughness: 0.45, metalness: 0.25,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x8d6e63, roughness: 0.55, metalness: 0.15,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: kind === "flower" ? 0xffcdd2 : 0xffe0b2,
      emissive: kind === "flower" ? 0xe91e63 : 0xffcc80,
      emissiveIntensity: kind === "flower" ? 0.9 : 1.15,
      roughness: 0.35, transparent: true, opacity: 0.85,
    });

    // Circular wood-trimmed mouse hole
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.055, 8, 20), ringMat);
    ring.position.set(p.x, p.y + r * 0.15, p.z);
    ring.rotation.y = yaw;
    this.root.add(ring);

    const trim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 6, 16), woodMat);
    trim.position.copy(ring.position);
    trim.rotation.copy(ring.rotation);
    this.root.add(trim);

    // Glowing hole disc (discoverability)
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.85, 16), glowMat);
    disc.position.copy(ring.position);
    disc.rotation.y = yaw;
    this.root.add(disc);

    // Outer pulsing ring (emissive only — light budget safe)
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(r * 1.15, 0.02, 6, 18),
      new THREE.MeshStandardMaterial({
        color: 0xffecb3, emissive: 0xffb74d, emissiveIntensity: 1.4,
        roughness: 0.4, transparent: true, opacity: 0.7,
      })
    );
    halo.position.copy(ring.position);
    halo.rotation.copy(ring.rotation);
    this.root.add(halo);

    this.portals.push({
      pos: p.clone(),
      y: op.y,
      kind,
      pathId: path.id,
      label: op.label || "Shortcut — wall run",
      mesh: halo,
    });
  }

  _addBoostPad(exit, path) {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry((path.width || 0.7) * 0.9, 0.04, 0.55),
      new THREE.MeshStandardMaterial({
        color: 0xffeb3b, emissive: 0xffc107, emissiveIntensity: 1.2,
        roughness: 0.35, metalness: 0.2,
      })
    );
    pad.position.set(exit.x, exit.y + 0.04, exit.z);
    this.root.add(pad);
    this.boostPads.push({ pos: exit.clone(), pathId: path.id });
  }

  _addHollowCavityDecor(pts, width, kind) {
    const plaster = new THREE.MeshStandardMaterial({
      color: 0x3e342c, roughness: 0.85, metalness: 0.05,
    });
    const moteMat = new THREE.MeshStandardMaterial({
      color: 0xfff8e1, emissive: 0xffe0b2, emissiveIntensity: 0.85,
      transparent: true, opacity: 0.55, roughness: 0.5,
    });
    this._moteMats.push(moteMat);

    // Occasional light slots + dust motes along cavity (sparse — light budget)
    const step = Math.max(2, Math.floor(pts.length / 3));
    for (let i = 0; i < pts.length; i += step) {
      const p = pts[i];
      let yaw = 0;
      if (i < pts.length - 1) {
        yaw = Math.atan2(pts[i + 1].x - p.x, pts[i + 1].z - p.z);
      } else if (i > 0) {
        yaw = Math.atan2(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
      }
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

      // Side cavity walls (short segments — suggest hollow interior)
      if (kind !== "chute") {
        for (const side of [-1, 1]) {
          const wall = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, width * 1.1, 0.7),
            plaster
          );
          wall.position.set(
            p.x + right.x * side * (width * 0.55),
            p.y + width * 0.45,
            p.z + right.z * side * (width * 0.55)
          );
          wall.rotation.y = yaw;
          this.root.add(wall);
        }
      }

      // Light slot (emissive strip)
      const slot = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.35, 0.03, 0.08),
        new THREE.MeshStandardMaterial({
          color: 0xffe0b2, emissive: 0xffcc80, emissiveIntensity: 1.0, roughness: 0.4,
        })
      );
      slot.position.set(p.x, p.y + width * 0.95, p.z);
      slot.rotation.y = yaw;
      this.root.add(slot);

      // Dust mote (single emissive speck)
      const mote = new THREE.Mesh(new THREE.SphereGeometry(0.028, 5, 5), moteMat);
      mote.position.set(
        p.x + (Math.random() - 0.5) * width * 0.3,
        p.y + 0.3 + Math.random() * 0.35,
        p.z + (Math.random() - 0.5) * 0.25
      );
      this.root.add(mote);
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
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.55, 8), postMat);
      post.position.set(p.x + width * 0.55, p.y + 0.28, p.z);
      this.root.add(post);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), lanternMat);
      lamp.position.set(p.x + width * 0.55, p.y + 0.58, p.z);
      this.root.add(lamp);
    }
  }

  _addArrowSign(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    if (dir.lengthSq() < 1e-6) return;
    dir.normalize();
    const yaw = Math.atan2(dir.x, dir.z);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffeb3b, emissive: 0xffc107, emissiveIntensity: 1.35, roughness: 0.35,
    });
    // Chevron arrow pointing along ramp
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.35), mat);
    shaft.position.set(from.x, from.y + 0.2, from.z);
    shaft.rotation.y = yaw;
    this.root.add(shaft);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 3), mat);
    head.position.set(
      from.x + dir.x * 0.28,
      from.y + 0.2,
      from.z + dir.z * 0.28
    );
    head.rotation.y = yaw;
    head.rotation.x = Math.PI / 2;
    this.root.add(head);
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
    for (let i = 0; i < pts.length; i++) {
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
        new THREE.TorusGeometry(width * 0.58, 0.09, 8, 16, Math.PI),
        archMat
      );
      arch.position.set(p.x, p.y + width * 0.58, p.z);
      arch.rotation.y = yaw;
      arch.rotation.z = Math.PI;
      this.root.add(arch);

      const trim = new THREE.Mesh(
        new THREE.TorusGeometry(width * 0.58, 0.035, 6, 14, Math.PI),
        trimMat
      );
      trim.position.copy(arch.position);
      trim.position.y += 0.02;
      trim.rotation.copy(arch.rotation);
      this.root.add(trim);

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
        this.root.add(wall);
      }

      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.7, 0.04, 0.12),
        lightMat
      );
      strip.position.set(p.x, p.y + width * 1.05, p.z);
      strip.rotation.y = yaw;
      this.root.add(strip);
    }
  }

  /**
   * Find nearest track point within radius. Returns snap info with optional railPush.
   */
  querySnap(x, y, z, radius = 2.4) {
    let best = null;
    let bestScore = Infinity;
    for (const seg of this.segments) {
      const abx = seg.b.x - seg.a.x;
      const aby = seg.b.y - seg.a.y;
      const abz = seg.b.z - seg.a.z;
      // 3D projection for steep shafts / chutes (not just XZ)
      const apx = x - seg.a.x;
      const apy = y - seg.a.y;
      const apz = z - seg.a.z;
      const steep = Math.abs(aby) > Math.abs(abx) * 0.45 + Math.abs(abz) * 0.45;
      let t;
      if (steep || seg.kind === "shaft" || seg.kind === "chute" || seg.kind === "shortcut") {
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
      const heightBand = elev || seg.kind === "tunnel" ? 2.0 : 2.8;
      const useRadius = elev ? radius * 0.95 : radius * 1.15; // wider forgiveness on floor
      const checkDist = steep ? dist3 : dist;
      if (dy > heightBand || checkDist > useRadius) continue;
      // Prefer magnet kinds + stick to current path (shafts/shortcuts won't drop mid-run)
      const magnetBias = seg.magnet ? -0.18 : 0;
      const pathBias = (this._lastPathId && seg.pathId === this._lastPathId) ? -0.55 : 0;
      const score = (steep ? dist3 : dist) + dy * (elev ? 0.42 : 0.32) + magnetBias + pathBias;
      if (score < bestScore) {
        bestScore = score;
        const flatLen = Math.hypot(abx, abz) || 1e-6;
        const yaw = Math.atan2(abx, abz);
        const bank = Math.atan2(aby, flatLen) * (seg.kind === "chute" ? 0.75 : 0.55);
        const halfW = seg.width * 0.5;
        const onTrack = (steep ? dist3 : dist) < seg.width * (elev ? 0.85 : 0.78);
        let railPush = null;
        if (seg.rail && dist > halfW * 0.5) {
          const pushDirX = (px - x);
          const pushDirZ = (pz - z);
          const plen = Math.hypot(pushDirX, pushDirZ) || 1;
          const strength = Math.min(1.6, (dist - halfW * 0.5) * (elev ? 2.8 : 2.0));
          railPush = {
            x: (pushDirX / plen) * strength,
            z: (pushDirZ / plen) * strength,
          };
        }
        best = {
          x: px, y: py + 0.07, z: pz,
          yaw, bank,
          onTrack,
          softPull: checkDist < useRadius,
          dist: checkDist, kind: seg.kind, pathId: seg.pathId, label: seg.label,
          railPush,
          magnet: !!seg.magnet,
          steep: !!steep,
        };
      }
    }
    if (!best) {
      let near = null;
      let nd = 10;
      for (const seg of this.segments) {
        const mx = (seg.a.x + seg.b.x) * 0.5;
        const my = (seg.a.y + seg.b.y) * 0.5;
        const mz = (seg.a.z + seg.b.z) * 0.5;
        const d = Math.hypot(x - mx, z - mz);
        const dy = Math.abs(y - my);
        if (d < nd && dy < 4) {
          nd = d;
          near = {
            x: mx, y: my + 0.07, z: mz,
            yaw: Math.atan2(seg.b.x - seg.a.x, seg.b.z - seg.a.z),
            bank: 0, onTrack: false, softPull: d < 4.5, dist: d,
            kind: seg.kind, pathId: seg.pathId, railPush: null, magnet: false,
          };
        }
      }
      if (near?.pathId) this._lastPathId = near.pathId;
      return near;
    }
    if (best?.pathId) this._lastPathId = best.pathId;
    return best;
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

  onBoostPad(x, z, maxDist = 1.1) {
    for (const b of this.boostPads) {
      if (Math.hypot(x - b.pos.x, z - b.pos.z) < maxDist) return true;
    }
    return false;
  }

  /** Subtle dust-mote pulse (no extra lights). */
  updateVisuals(t) {
    const pulse = 0.7 + 0.35 * Math.sin(t * 2.2);
    for (const m of this._moteMats) m.emissiveIntensity = pulse;
    for (const p of this.portals) {
      if (p.mesh) {
        const s = 1 + 0.06 * Math.sin(t * 3.0 + p.pos.x);
        p.mesh.scale.set(s, s, s);
      }
    }
  }

  setVisible(v) {
    this.root.visible = v;
  }
}
