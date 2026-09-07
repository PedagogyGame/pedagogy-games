import * as THREE from "three";
import { ROOMS } from "./data/rooms.js";
import { OBJECTS } from "./data/objects.js";
import { buildLayerShells, buildPedestal } from "./meshes.js";

export class Mansion {
  constructor(scene) {
    this.scene = scene;
    this.interactives = [];
    this.colliders = [];
    this.floorRegions = [];
    this.ramps = [];
    this.roomLabels = [];
    this.fireflies = null;
    this._pointLightBudget = 18;
    this._pointLightsUsed = 0;
    this._shadowSpotsLeft = 2;
    this._texCache = {};
    this.root = new THREE.Group();
    this.root.name = "mansion";
    scene.add(this.root);
    this._build();
  }

  /** Cap active PointLights to keep WebGL stable. */
  _allocPointLight(color, intensity, distance, decay = 2) {
    if (this._pointLightsUsed >= this._pointLightBudget) return null;
    this._pointLightsUsed += 1;
    return new THREE.PointLight(color, intensity, distance, decay);
  }

  _mat(color, rough = 0.75, metal = 0.05) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: rough,
      metalness: metal,
    });
  }

  _makeCanvas(w, h) {
    if (typeof document !== "undefined" && document.createElement) {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      return c;
    }
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
    return null;
  }

  /** Cheap repeating wood-plank CanvasTexture (shared by color key). */
  _plankTex(hex, stripe = 0x1a1008) {
    const key = `plank_${hex}_${stripe}`;
    if (this._texCache[key]) return this._texCache[key];
    const c = this._makeCanvas(256, 256);
    if (!c) return null;
    c.width = 256; c.height = 256;
    const ctx = c.getContext("2d");
    const base = "#" + (hex >>> 0).toString(16).padStart(6, "0");
    const line = "#" + (stripe >>> 0).toString(16).padStart(6, "0");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      ctx.fillStyle = line;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(0, y, 256, 2);
      ctx.globalAlpha = 0.12;
      ctx.fillRect(0, y + 14, 256, 1);
      // plank end joints
      ctx.globalAlpha = 0.2;
      const ox = ((y / 32) % 2) * 64;
      for (let x = ox; x < 256; x += 128) ctx.fillRect(x, y, 2, 32);
    }
    ctx.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this._texCache[key] = tex;
    return tex;
  }

  _rugTex(centerHex, borderHex) {
    const key = `rug_${centerHex}_${borderHex}`;
    if (this._texCache[key]) return this._texCache[key];
    const c = this._makeCanvas(128, 128);
    if (!c) return null;
    const ctx = c.getContext("2d");
    const border = "#" + (borderHex >>> 0).toString(16).padStart(6, "0");
    const center = "#" + (centerHex >>> 0).toString(16).padStart(6, "0");
    ctx.fillStyle = border;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = center;
    ctx.fillRect(10, 10, 108, 108);
    ctx.strokeStyle = border;
    ctx.lineWidth = 4;
    ctx.strokeRect(18, 18, 92, 92);
    // subtle diamond
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(64, 28); ctx.lineTo(100, 64); ctx.lineTo(64, 100); ctx.lineTo(28, 64);
    ctx.closePath(); ctx.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._texCache[key] = tex;
    return tex;
  }

  _artTex(seed = 0) {
    const key = `art_${seed}`;
    if (this._texCache[key]) return this._texCache[key];
    const c = this._makeCanvas(128, 96);
    if (!c) return null;
    const ctx = c.getContext("2d");
    const hues = [
      ["#1a237e", "#7e57c2", "#ffcc80"],
      ["#004d40", "#26a69a", "#ffe082"],
      ["#4a148c", "#e91e63", "#80cbc4"],
      ["#3e2723", "#c9a227", "#efebe9"],
      ["#0d47a1", "#42a5f5", "#ffecb3"],
      ["#b71c1c", "#ef9a9a", "#fff8e1"],
    ];
    const h = hues[seed % hues.length];
    const g = ctx.createLinearGradient(0, 0, 128, 96);
    g.addColorStop(0, h[0]); g.addColorStop(0.55, h[1]); g.addColorStop(1, h[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 96);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = h[2];
    ctx.beginPath(); ctx.arc(40 + (seed % 3) * 12, 50, 22, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.fillRect(70, 20, 40, 55);
    ctx.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._texCache[key] = tex;
    return tex;
  }

  _floorMat(hex, rough = 0.82) {
    const tex = this._plankTex(hex);
    if (!tex) return this._mat(hex, rough, 0.04);
    tex.repeat.set(4, 4);
    return new THREE.MeshStandardMaterial({
      map: tex, color: 0xffffff, roughness: rough, metalness: 0.04,
    });
  }

  _wood(hex = 0x5d4037, rough = 0.65, metal = 0.08) {
    return this._mat(hex, rough, metal);
  }

  _brass(hex = 0xc9a227) {
    return this._mat(hex, 0.32, 0.72);
  }

  _velvet(hex) {
    return this._mat(hex, 0.92, 0.02);
  }

  _glass(hex = 0xaaddff, opacity = 0.4) {
    return new THREE.MeshStandardMaterial({
      color: hex, roughness: 0.04, metalness: 0.28,
      transparent: true, opacity: Math.min(opacity, 0.42),
      emissive: hex, emissiveIntensity: 0.12,
    });
  }

  _cloth(hex, rough = 0.88) {
    return this._mat(hex, rough, 0.02);
  }

  _emissiveGlow(hex, intensity = 0.85) {
    return new THREE.MeshStandardMaterial({
      color: hex, emissive: hex, emissiveIntensity: intensity,
      roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.9,
    });
  }


  _build() {
    this._buildEstateGrounds();
    for (const room of Object.values(ROOMS)) {
      if (room.outdoor) this._buildOutdoorZone(room);
      else this._buildRoom(room);
    }
    for (const room of Object.values(ROOMS)) {
      if (room.stairs) {
        for (const s of room.stairs) this._buildStair(s, room);
      }
    }
    this._buildExteriorFacade();
    this._buildBalcony();
    this._buildGardenFeatures();
    this._buildFireflies();
  }

  // ─── Estate lawn, drive, paths, boundary ─────────────────────────
  _buildEstateGrounds() {
    const g = new THREE.Group();
    g.name = "estate_grounds";

    // Deep green lawn (large)
    const lawn = new THREE.Mesh(
      new THREE.CircleGeometry(72, 64),
      this._mat(0x2d5a27, 0.95, 0)
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = -0.04;
    lawn.receiveShadow = true;
    g.add(lawn);

    // Slightly raised terrace ring near house
    const terrace = new THREE.Mesh(
      new THREE.RingGeometry(18, 26, 48),
      this._mat(0x3d6b32, 0.92, 0)
    );
    terrace.rotation.x = -Math.PI / 2;
    terrace.position.set(0, -0.02, -8);
    terrace.receiveShadow = true;
    g.add(terrace);

    // Gravel drive (front)
    const drive = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.06, 30),
      this._mat(0x7a7368, 0.9, 0.05)
    );
    drive.position.set(0, 0.01, 28);
    drive.receiveShadow = true;
    g.add(drive);

    // Stone path rings / loops
    const pathMat = this._mat(0x8a8578, 0.88, 0.08);
    const paths = [
      { w: 2.2, d: 40, x: 0, z: -20 }, // center spine to conservatory/terrace
      { w: 2.0, d: 36, x: -22, z: -8 }, // west rose walk
      { w: 2.0, d: 36, x: 22, z: -8 }, // east rockery
      { w: 48, d: 2.0, x: 0, z: -44 }, // terrace cross
      { w: 40, d: 1.8, x: 0, z: 18 }, // front loop
    ];
    for (const p of paths) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.05, p.d), pathMat);
      mesh.position.set(p.x, 0.02, p.z);
      mesh.receiveShadow = true;
      g.add(mesh);
    }

    // Global outdoor floor so player never falls off near house
    this.floorRegions.push({
      minX: -70, maxX: 70, minZ: -70, maxZ: 70,
      y: 0, priority: -5, roomId: "grounds",
    });

    // Invisible boundary hedges (collision + silhouette)
    const hedgeMat = this._mat(0x1b4332, 0.9, 0);
    const boundary = [
      { s: [140, 2.8, 1.2], p: [0, 1.2, -68] },
      { s: [140, 2.8, 1.2], p: [0, 1.2, 68] },
      { s: [1.2, 2.8, 140], p: [-68, 1.2, 0] },
      { s: [1.2, 2.8, 140], p: [68, 1.2, 0] },
    ];
    for (const b of boundary) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(...b.s), hedgeMat);
      h.position.set(...b.p);
      h.castShadow = false;
      h.frustumCulled = true;
      g.add(h);
      this.colliders.push(
        new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(...b.p),
          new THREE.Vector3(...b.s)
        )
      );
    }

    // Iron gate at drive entrance
    const gateZ = 48;
    const pillarMat = this._mat(0x2a2a2e, 0.4, 0.7);
    for (const sx of [-5, 5]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.2, 0.7), pillarMat);
      pillar.position.set(sx, 1.6, gateZ);
      g.add(pillar);
      const lamp = this._allocPointLight(0xffcc80, 4, 12, 2);
      if (lamp) { lamp.position.set(sx, 3.1, gateZ); g.add(lamp); }
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xffe0b2, emissive: 0xffcc80, emissiveIntensity: 0.9 })
      );
      bulb.position.set(sx, 3.1, gateZ);
      g.add(bulb);
    }
    // Gate arch
    const arch = new THREE.Mesh(new THREE.BoxGeometry(11, 0.35, 0.5), pillarMat);
    arch.position.set(0, 3.2, gateZ);
    g.add(arch);

    this.root.add(g);
  }

  _buildExteriorFacade() {
    const g = new THREE.Group();
    g.name = "exterior_facade";
    // Approximate house footprint covering indoor rooms on ground floor
    // House center ~ (0,0,-8), extends roughly x±24, z from -40 to +14
    const stone = this._mat(0x4a3728, 0.85, 0.05);
    const trim = this._mat(0xc9a227, 0.4, 0.45);
    const facadeH = 9.5; // up toward attic eaves

    // Outer shell walls (outside the indoor walls) — slightly larger
    const shells = [
      // South front built separately (ground door + first-floor balcony doors)
      // North (conservatory garden) — with wide garden doors
      { size: [24, 6.2, 0.4], pos: [0, 3.1, -40.2], door: true, doorW: 4.5 },
      // West outer
      { size: [0.45, facadeH, 56], pos: [-26.5, facadeH / 2, -12], door: false },
      // East outer
      { size: [0.45, facadeH, 56], pos: [26.5, facadeH / 2, -12], door: false },
    ];

    this._addFrontFacadeWithBalconyDoors(g, stone, trim, facadeH);

    for (const wall of shells) {
      if (wall.door) {
        this._addFacadeDoorWall(g, wall, stone, trim);
      } else {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...wall.size), stone);
        mesh.position.set(...wall.pos);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        g.add(mesh);
        this.colliders.push(
          new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(...wall.pos),
            new THREE.Vector3(...wall.size)
          )
        );
        this._addExteriorWindows(g, wall);
      }
    }

    // Porch roof over front door
    const porch = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 3.5), trim);
    porch.position.set(0, 3.6, 15.5);
    g.add(porch);
    for (const sx of [-2.4, 2.4]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 3.5, 10), trim);
      col.position.set(sx, 1.75, 16.2);
      g.add(col);
    }

    // Roofline silhouette
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(22, 4.5, 4),
      this._mat(0x3e2723, 0.8, 0.1)
    );
    roof.position.set(0, facadeH + 1.5, -8);
    roof.rotation.y = Math.PI / 4;
    g.add(roof);

    this.root.add(g);
  }

  _addFacadeDoorWall(group, wall, stone, trim) {
    const [sx, sy, sz] = wall.size;
    const [px, py, pz] = wall.pos;
    const doorW = wall.doorW || 3;
    const doorH = Math.min(sy * 0.45, 3.4);
    const remain = (sx - doorW) / 2;
    for (const sign of [-1, 1]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(remain, sy, sz), stone);
      mesh.position.set(px + sign * (doorW / 2 + remain / 2), py, pz);
      mesh.castShadow = true;
      group.add(mesh);
      this.colliders.push(
        new THREE.Box3().setFromCenterAndSize(mesh.position.clone(), new THREE.Vector3(remain, sy, sz))
      );
      // Windows on facade wings
      this._addExteriorWindows(group, {
        size: [remain, sy, sz],
        pos: [px + sign * (doorW / 2 + remain / 2), py, pz],
      });
    }
    const headerH = sy - doorH;
    if (headerH > 0.3) {
      const header = new THREE.Mesh(new THREE.BoxGeometry(doorW, headerH, sz), stone);
      header.position.set(px, py + sy / 2 - headerH / 2, pz);
      group.add(header);
      this.colliders.push(
        new THREE.Box3().setFromCenterAndSize(header.position.clone(), new THREE.Vector3(doorW, headerH, sz))
      );
    }
    // Door frame glow
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(doorW + 0.4, 0.22, sz + 0.2),
      trim
    );
    lintel.position.set(px, doorH + 0.1, pz);
    group.add(lintel);
  }

  _addExteriorWindows(group, wall) {
    const [sx, sy, sz] = wall.size;
    const [px, py, pz] = wall.pos;
    const horizontal = sx > sz;
    const count = horizontal ? Math.max(1, Math.floor(sx / 5)) : Math.max(1, Math.floor(sy / 4));
    const floors = [1.8, 5.5];
    for (const fy of floors) {
      if (fy > sy - 1) continue;
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : (i / (count - 1) - 0.5) * 0.75;
        const wx = horizontal ? px + t * sx : px;
        const wz = horizontal ? pz : pz + t * (sz * 0.7);
        // Frame
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(horizontal ? 1.45 : 0.2, 1.85, horizontal ? 0.2 : 1.45),
          this._mat(0xc9a227, 0.35, 0.55)
        );
        frame.position.set(wx, fy, wz);
        group.add(frame);
        // Warm glowing pane
        const pane = new THREE.Mesh(
          new THREE.BoxGeometry(horizontal ? 1.05 : 0.08, 1.4, horizontal ? 0.08 : 1.05),
          new THREE.MeshStandardMaterial({
            color: 0xffe8c8,
            emissive: 0xffb74d,
            emissiveIntensity: 1.05,
            roughness: 0.08,
            metalness: 0.15,
            transparent: true,
            opacity: 0.52,
          })
        );
        pane.position.set(wx, fy, wz);
        group.add(pane);
        // Mullions
        const mullH = new THREE.Mesh(
          new THREE.BoxGeometry(horizontal ? 1.05 : 0.04, 0.06, horizontal ? 0.04 : 1.05),
          this._mat(0xc9a227, 0.4, 0.5)
        );
        mullH.position.set(wx, fy, wz);
        group.add(mullH);
        const mullV = new THREE.Mesh(
          new THREE.BoxGeometry(horizontal ? 0.06 : 0.04, 1.4, horizontal ? 0.04 : 0.06),
          this._mat(0xc9a227, 0.4, 0.5)
        );
        mullV.position.set(wx, fy, wz);
        group.add(mullV);
        // emissive pane only — no PointLight (perf)
      }
    }
  }

  _buildGardenFeatures() {
    const g = new THREE.Group();
    g.name = "garden_features";

    // Fountain (front lawn)
    this._addFountain(g, 0, 0, 34);
    // Koi pond disc
    this._addPond(g, 26, 0, -46);
    // Gazebo / pergola
    this._addGazebo(g, -34, 0, 18);
    // Greenhouse shed
    this._addGreenhouse(g, 34, 0, 18);
    // Carriage house nook
    this._addCarriageHouse(g, 36, 0, 0);

    // Topiary spheres + hedges
    const topiary = [
      [-10, 20], [10, 20], [-14, 30], [14, 30],
      [-36, -10], [-36, -30], [36, -20], [-20, -50], [10, -52],
    ];
    for (const [x, z] of topiary) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 0.8, 8),
        this._mat(0x5d4037, 0.8)
      );
      trunk.position.set(x, 0.4, z);
      g.add(trunk);
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 14, 12),
        this._mat(0x2e7d32, 0.9)
      );
      ball.position.set(x, 1.3, z);
      ball.castShadow = true;
      g.add(ball);
    }

    // Flower beds (colored low boxes)
    const beds = [
      { c: 0xe91e63, x: -26, z: 10, w: 4, d: 1.2 },
      { c: 0xf44336, x: -30, z: 6, w: 3, d: 1.2 },
      { c: 0x9c27b0, x: -24, z: 2, w: 3.5, d: 1.0 },
      { c: 0xffeb3b, x: -28, z: -18, w: 4, d: 1.2 },
      { c: 0xff9800, x: -22, z: -22, w: 3, d: 1.0 },
      { c: 0x03a9f4, x: 18, z: -36, w: 3, d: 1.0 },
    ];
    for (const b of beds) {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.35, b.d), this._mat(b.c, 0.85));
      bed.position.set(b.x, 0.18, b.z);
      g.add(bed);
      const soil = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.3, 0.15, b.d + 0.3), this._mat(0x4e342e, 0.95));
      soil.position.set(b.x, 0.05, b.z);
      g.add(soil);
    }

    // Rose garden ring
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = -28 + Math.cos(a) * 5;
      const z = 8 + Math.sin(a) * 5;
      const rose = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 10, 8),
        this._mat(i % 2 ? 0xc62828 : 0xad1457, 0.7)
      );
      rose.position.set(x, 0.55, z);
      g.add(rose);
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.05, 0.5, 6),
        this._mat(0x2e7d32, 0.9)
      );
      stem.position.set(x, 0.25, z);
      g.add(stem);
    }

    // Orchard trees
    const orchardSpots = [
      [-36, -38], [-30, -36], [-24, -40], [-34, -46], [-28, -50], [-22, -44],
      [-38, -42], [-26, -34],
    ];
    for (const [x, z] of orchardSpots) this._addTree(g, x, z);

    // Stone benches
    const benches = [
      [-8, 24], [8, 24], [-32, 0], [20, -40], [-20, -30], [0, -50],
    ];
    for (const [x, z] of benches) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 0.55), this._mat(0x9e9e9e, 0.7, 0.1));
      seat.position.set(x, 0.45, z);
      g.add(seat);
      for (const sx of [-0.7, 0.7]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.5), this._mat(0x757575, 0.75));
        leg.position.set(x + sx, 0.2, z);
        g.add(leg);
      }
    }

    // Lantern posts along paths
    const lanterns = [
      [0, 20], [0, 12], [0, -16], [0, -36], [0, -48],
      [-22, 8], [-22, -8], [-22, -28],
      [22, 8], [22, -8], [22, -28],
      [-8, 34], [8, 34], [0, 42],
    ];
    for (const [x, z] of lanterns) this._addLantern(g, x, z);

    // Extra garden furniture — iron tables + lounge chairs
    for (const [x, z] of [[-12, 26], [12, 26], [-6, -48], [8, -42], [28, -36]]) {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 12), this._mat(0x455a64, 0.4, 0.65));
      top.position.set(x, 0.8, z);
      g.add(top);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.8, 8), this._mat(0x37474f, 0.45, 0.6));
      leg.position.set(x, 0.4, z);
      g.add(leg);
    }
    for (const [x, z] of [[-16, 22], [16, 22], [0, -52]]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.7), this._mat(0x5d4037, 0.7));
      seat.position.set(x, 0.45, z);
      g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.1), this._velvet(0x4e342e));
      back.position.set(x, 0.85, z + 0.3);
      g.add(back);
    }

    this.root.add(g);
  }

  _addFountain(g, x, y, z) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.4, 24), this._mat(0xb0bec5, 0.55, 0.2));
    base.position.set(x, y + 0.2, z);
    g.add(base);
    // Detail rings
    for (const [r, yy] of [[2.35, 0.42], [1.95, 0.55], [1.7, 0.95]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 6, 28), this._mat(0xcfd8dc, 0.4, 0.35));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, y + yy, z);
      g.add(ring);
    }
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.5, 24), this._mat(0x90a4ae, 0.5, 0.25));
    bowl.position.set(x, y + 0.7, z);
    g.add(bowl);
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.45, 0.08, 32),
      new THREE.MeshStandardMaterial({
        color: 0x4fc3f7, roughness: 0.2, metalness: 0.6, transparent: true, opacity: 0.75,
        emissive: 0x0277bd, emissiveIntensity: 0.15,
      })
    );
    water.position.set(x, y + 0.95, z);
    g.add(water);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 10), this._mat(0xcfd8dc, 0.4, 0.4));
    spout.position.set(x, y + 1.5, z);
    g.add(spout);
    const plume = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xb3e5fc, transparent: true, opacity: 0.55, roughness: 0.3 })
    );
    plume.position.set(x, y + 2.2, z);
    g.add(plume);
  }

  _addPond(g, x, y, z) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.35, 8, 32), this._mat(0x78909c, 0.7, 0.15));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, y + 0.15, z);
    g.add(rim);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(4.0, 40),
      new THREE.MeshStandardMaterial({
        color: 0x1565c0, roughness: 0.15, metalness: 0.55, transparent: true, opacity: 0.8,
        emissive: 0x0d47a1, emissiveIntensity: 0.2,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, y + 0.12, z);
    g.add(water);
    // Koi hint blobs
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const koi = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 6),
        this._mat(0xff7043, 0.5)
      );
      koi.scale.set(1.6, 0.4, 0.7);
      koi.position.set(x + Math.cos(a) * 1.5, y + 0.14, z + Math.sin(a) * 1.5);
      g.add(koi);
    }
  }

  _addGazebo(g, x, y, z) {
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.2, 8), this._mat(0x8d6e63, 0.75));
    floor.position.set(x, y + 0.1, z);
    g.add(floor);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.8, 8), this._mat(0xc9a227, 0.4, 0.5));
      post.position.set(x + Math.cos(a) * 2.6, y + 1.5, z + Math.sin(a) * 2.6);
      g.add(post);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.8, 6), this._mat(0x5d4037, 0.7));
    roof.position.set(x, y + 3.6, z);
    g.add(roof);
    const light = this._allocPointLight(0xffe0b2, 5, 10, 2);
    if (light) { light.position.set(x, y + 2.8, z); g.add(light); }
  }

  _addGreenhouse(g, x, y, z) {
    const frame = this._mat(0xcfd8dc, 0.4, 0.5);
    const glass = this._glass(0xa5d6a7, 0.38);
    const base = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 4), this._mat(0x6d4c41, 0.8));
    base.position.set(x, y + 0.15, z);
    g.add(base);
    // Glass pane walls with mullions
    const panes = [
      { s: [4.6, 2.4, 0.06], p: [0, 1.4, -1.8] },
      { s: [4.6, 2.4, 0.06], p: [0, 1.4, 1.8] },
      { s: [0.06, 2.4, 3.6], p: [-2.3, 1.4, 0] },
      { s: [0.06, 2.4, 3.6], p: [2.3, 1.4, 0] },
    ];
    for (const pn of panes) {
      const body = new THREE.Mesh(new THREE.BoxGeometry(...pn.s), glass);
      body.position.set(x + pn.p[0], y + pn.p[1], z + pn.p[2]);
      g.add(body);
    }
    // Frame posts + cross mullions
    for (const sx of [-2.3, 0, 2.3]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.1), frame);
      post.position.set(x + sx, y + 1.5, z - 1.8);
      g.add(post);
      const post2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.1), frame);
      post2.position.set(x + sx, y + 1.5, z + 1.8);
      g.add(post2);
    }
    for (const sy of [0.8, 1.8]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.06, 0.06), frame);
      rail.position.set(x, y + sy, z - 1.8);
      g.add(rail);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.4, 4), glass);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(x, y + 3.4, z);
    g.add(roof);
  }

  _addCarriageHouse(g, x, y, z) {
    const shed = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 5), this._mat(0x5d4037, 0.8));
    shed.position.set(x, y + 1.6, z);
    g.add(shed);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.3, 5.5), this._mat(0x3e2723, 0.75));
    roof.position.set(x, y + 3.4, z);
    g.add(roof);
    // Open bay
    const bay = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 2.4, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.3 })
    );
    bay.position.set(x - 2, y + 1.3, z - 2.6);
    g.add(bay);
  }

  _addTree(g, x, z) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 2.4, 8),
      this._mat(0x5d4037, 0.85)
    );
    trunk.position.set(x, 1.2, z);
    trunk.castShadow = true;
    g.add(trunk);
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.8, 12, 10),
      this._mat(0x33691e, 0.9)
    );
    canopy.position.set(x, 3.2, z);
    canopy.castShadow = true;
    g.add(canopy);
    const canopy2 = new THREE.Mesh(
      new THREE.SphereGeometry(1.3, 10, 8),
      this._mat(0x558b2f, 0.88)
    );
    canopy2.position.set(x + 0.6, 3.6, z - 0.3);
    g.add(canopy2);
  }

  _addLantern(g, x, z) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 2.4, 8),
      this._mat(0x37474f, 0.5, 0.4)
    );
    post.position.set(x, 1.2, z);
    g.add(post);
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.45, 0.35),
      new THREE.MeshStandardMaterial({
        color: 0xffe0b2, emissive: 0xffb74d, emissiveIntensity: 0.8, roughness: 0.35, transparent: true, opacity: 0.85,
      })
    );
    lamp.position.set(x, 2.5, z);
    g.add(lamp);
    const pl = this._allocPointLight(0xffcc80, 3.5, 9, 2);
    if (pl) { pl.position.set(x, 2.5, z); g.add(pl); }
  }

  _buildFireflies() {
    const count = 80;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = 0.5 + Math.random() * 4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xc6ff00,
      size: 0.12,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.fireflies = new THREE.Points(geo, mat);
    this.fireflies.name = "fireflies";
    this.root.add(this.fireflies);
  }

  updateFireflies(t) {
    if (!this.fireflies) return;
    const pos = this.fireflies.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = 0.8 + Math.sin(t * 1.3 + i) * 0.5 + Math.sin(t * 0.7 + i * 0.3) * 0.35;
      pos.setY(i, y);
      pos.setX(i, x + Math.sin(t * 0.4 + i) * 0.002);
      pos.setZ(i, z + Math.cos(t * 0.35 + i) * 0.002);
    }
    pos.needsUpdate = true;
  }

  // ─── Outdoor zones ───────────────────────────────────────────────
  _buildOutdoorZone(room) {
    const [w, h, d] = room.size;
    const [cx, cy, cz] = room.pos;
    const p = room.palette;
    const g = new THREE.Group();
    g.name = room.id;

    this.floorRegions.push({
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
      y: cy,
      priority: 2,
      roomId: room.id,
    });

    // Subtle zone tint on ground (not a hard floor box — lawn shows through)
    const tint = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.92, 0.04, d * 0.92),
      this._mat(p.floor, 0.95, 0)
    );
    tint.position.set(cx, cy + 0.03, cz);
    tint.receiveShadow = true;
    g.add(tint);

    // Outdoor zones rely on moon/hemi — skip PointLights (perf)

    // Picnic / garden tables where objects need surfaces
    this._placeRoomObjects(g, room, cy, p, true);

    this.root.add(g);
  }

  _buildRoom(room) {
    const [w, h, d] = room.size;
    const [cx, cy, cz] = room.pos;
    const p = room.palette;
    const g = new THREE.Group();
    g.name = room.id;

    this.floorRegions.push({
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
      y: cy,
      priority: room.id.includes("hall") ? 0 : 1,
      roomId: room.id,
    });

    const isAttic = room.floor === "Attic";
    const floorMat = isAttic ? this._mat(p.floor, 0.88, 0.02) : this._floorMat(p.floor, 0.84);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), floorMat);
    floor.position.set(cx, cy - 0.1, cz);
    floor.receiveShadow = true;
    floor.userData.floorY = cy;
    floor.frustumCulled = true;
    g.add(floor);

    // Area rug with border (skip tiny halls)
    if (w > 5 && d > 5) {
      const rw = Math.min(w * 0.48, 9);
      const rd = Math.min(d * 0.42, 7);
      const rugMat = new THREE.MeshStandardMaterial({
        map: this._rugTex(p.trim, p.wall) || null,
        roughness: 0.95,
        metalness: 0.02,
      });
      const rug = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.035, rd), rugMat);
      rug.position.set(cx, cy + 0.025, cz);
      rug.receiveShadow = true;
      rug.frustumCulled = true;
      g.add(rug);
    }

    const ceil = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.12, d),
      this._mat(room.glass ? 0x88aacc : 0x1a1410, room.glass ? 0.3 : 0.9, room.glass ? 0.2 : 0)
    );
    if (room.glass) {
      ceil.material.transparent = true;
      ceil.material.opacity = 0.35;
    }
    ceil.position.set(cx, cy + h, cz);
    g.add(ceil);

    // Conservatory mullions + moonlight feel
    if (room.glass) {
      this._addConservatoryGlass(g, room);
    }

    // Crown / cornice strip (ring of thin boxes along walls — skip attic LOD)
    if (!isAttic) {
      this._addCornice(g, room, p);
      this._addWallPanels(g, room, p);
    } else {
      const crown = new THREE.Mesh(
        new THREE.BoxGeometry(w - 0.3, 0.1, d - 0.3),
        this._brass(p.trim)
      );
      crown.position.set(cx, cy + h - 0.08, cz);
      g.add(crown);
    }

    // Ceiling beams in hall / music / workshop
    if (["hall_ground", "library_hall", "music", "workshop", "cellar"].includes(room.id)) {
      this._addCeilingBeams(g, room, p);
    }

    const wallH = h;
    const thick = 0.28;
    const walls = [
      { size: [w, wallH, thick], pos: [cx, cy + wallH / 2, cz - d / 2], side: "north" },
      { size: [w, wallH, thick], pos: [cx, cy + wallH / 2, cz + d / 2], side: "south" },
      { size: [thick, wallH, d], pos: [cx - w / 2, cy + wallH / 2, cz], side: "west" },
      { size: [thick, wallH, d], pos: [cx + w / 2, cy + wallH / 2, cz], side: "east" },
    ];

    const doorways = this._doorwaysFor(room);

    for (const wall of walls) {
      if (doorways[wall.side]) {
        this._addWallWithDoor(g, wall, p.wall, thick, p.trim);
      } else {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...wall.size), this._mat(p.wall, 0.78, 0.04));
        mesh.position.set(...wall.pos);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        g.add(mesh);
        this.colliders.push(
          new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(...wall.pos),
            new THREE.Vector3(...wall.size)
          )
        );
        this._addWindows(g, wall, p, cy, h);
      }
    }

    const bbH = 0.18;
    for (const wall of walls) {
      const [sx, , sz] = wall.size;
      const [px, , pz] = wall.pos;
      const bb = new THREE.Mesh(
        new THREE.BoxGeometry(sx > sz ? sx - 0.2 : 0.08, bbH, sx > sz ? 0.08 : sz - 0.2),
        this._mat(p.trim, 0.45, 0.35)
      );
      bb.position.set(px, cy + bbH / 2, pz);
      g.add(bb);
    }

    const reach = Math.max(w, d) * 0.7;
    const spot = new THREE.SpotLight(p.light, 28, reach + 6, Math.PI / 3.2, 0.55, 1.4);
    spot.position.set(cx, cy + h - 0.35, cz);
    spot.target.position.set(cx, cy, cz);
    // Only a couple of rooms cast spot shadows
    if (this._shadowSpotsLeft > 0 && (room.id === "foyer" || room.id === "landing")) {
      this._shadowSpotsLeft -= 1;
      spot.castShadow = true;
      spot.shadow.mapSize.set(256, 256);
    } else {
      spot.castShadow = false;
    }
    g.add(spot, spot.target);

    // Prefer a few key room fills; chandelier/sconce emissives cover the rest
    const keyRooms = new Set(["foyer", "landing", "conservatory", "cellar", "music", "attic_loft"]);
    if (keyRooms.has(room.id)) {
      const amb = this._allocPointLight(p.light, 8, reach + 4, 2);
      if (amb) {
        amb.position.set(cx, cy + Math.min(2.4, h * 0.55), cz);
        g.add(amb);
      }
    }

    this._addChandelier(g, cx, cy + h - 0.5, cz, p.trim);
    this._addSconces(g, room, p);
    this._addDecor(g, room, p);

    // Surface furniture for realism
    this._addRoomFurniture(g, room, p);

    // Dark wood floor border trim (gold/brass accent corners via trim color)
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.35, 0.05, d - 0.35),
      this._brass(p.trim)
    );
    trim.position.set(cx, cy + 0.035, cz);
    g.add(trim);

    this._placeRoomObjects(g, room, cy, p, false);

    this.root.add(g);
  }


  _addCornice(group, room, p) {
    const [w, h, d] = room.size;
    const [cx, cy, cz] = room.pos;
    const mat = this._brass(p.trim);
    const thick = 0.1;
    const strips = [
      { s: [w - 0.2, 0.12, thick], p: [cx, cy + h - 0.1, cz - d / 2 + 0.18] },
      { s: [w - 0.2, 0.12, thick], p: [cx, cy + h - 0.1, cz + d / 2 - 0.18] },
      { s: [thick, 0.12, d - 0.2], p: [cx - w / 2 + 0.18, cy + h - 0.1, cz] },
      { s: [thick, 0.12, d - 0.2], p: [cx + w / 2 - 0.18, cy + h - 0.1, cz] },
    ];
    for (const s of strips) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...s.s), mat);
      m.position.set(...s.p);
      m.frustumCulled = true;
      group.add(m);
    }
    // Upper crown ledge
    const ledge = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.4, 0.06, d - 0.4),
      this._mat(p.trim, 0.45, 0.4)
    );
    ledge.position.set(cx, cy + h - 0.2, cz);
    group.add(ledge);
  }

  _addWallPanels(group, room, p) {
    const [w, h, d] = room.size;
    const [cx, cy, cz] = room.pos;
    if (h < 3.2) return;
    const panelH = Math.min(2.4, h * 0.55);
    const panelY = cy + 0.35 + panelH / 2;
    const inset = 0.04;
    const dark = this._mat(
      (p.wall & 0xfefefe) === p.wall ? p.wall : ((p.wall >> 1) & 0x7f7f7f) | (p.wall & 0x808080),
      0.82, 0.03
    );
    // Alternating inset panels on long walls (N/S)
    const nPanels = Math.max(2, Math.floor(w / 2.8));
    for (let i = 0; i < nPanels; i++) {
      if (i % 2 === 1) continue;
      const pw = Math.min(2.2, w / nPanels - 0.25);
      const x = cx - w / 2 + (i + 0.5) * (w / nPanels);
      for (const zSide of [cz - d / 2 + 0.16 + inset, cz + d / 2 - 0.16 - inset]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(pw, panelH, 0.04), dark);
        panel.position.set(x, panelY, zSide);
        panel.frustumCulled = true;
        group.add(panel);
        // rail
        const rail = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.08, 0.05, 0.05), this._brass(p.trim));
        rail.position.set(x, cy + 0.32 + panelH, zSide);
        group.add(rail);
      }
    }
    // E/W panels
    const nP2 = Math.max(2, Math.floor(d / 2.8));
    for (let i = 0; i < nP2; i++) {
      if (i % 2 === 1) continue;
      const pd = Math.min(2.2, d / nP2 - 0.25);
      const z = cz - d / 2 + (i + 0.5) * (d / nP2);
      for (const xSide of [cx - w / 2 + 0.16 + inset, cx + w / 2 - 0.16 - inset]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.04, panelH, pd), dark);
        panel.position.set(xSide, panelY, z);
        panel.frustumCulled = true;
        group.add(panel);
      }
    }
  }

  _addCeilingBeams(group, room, p) {
    const [w, h, d] = room.size;
    const [cx, cy, cz] = room.pos;
    const beamMat = this._wood(0x3e2723, 0.75, 0.05);
    const count = Math.max(3, Math.floor(d / 3.5));
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      const z = cz + t * (d - 1.2);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(w - 0.5, 0.16, 0.22), beamMat);
      beam.position.set(cx, cy + h - 0.28, z);
      beam.frustumCulled = true;
      group.add(beam);
    }
  }

  _addConservatoryGlass(group, room) {
    const [w, h, d] = room.size;
    const [cx, cy, cz] = room.pos;
    const mullion = this._mat(0xc9a227, 0.35, 0.55);
    // Vertical mullions on glass walls (visual only on north/south inward)
    for (let i = -3; i <= 3; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 0.9, 0.08), mullion);
      m.position.set(cx + i * 2.5, cy + h * 0.45, cz - d / 2 + 0.2);
      group.add(m);
    }
    // Moonlight wash (budgeted)
    const moon = this._allocPointLight(0xb3e5fc, 5, 18, 2);
    if (moon) {
      moon.position.set(cx, cy + h - 0.5, cz - 2);
      group.add(moon);
    }
  }

  _addRoomFurniture(group, room, p) {
    const [w, h, d] = room.size;
    const [cx, cy, cz] = room.pos;
    const id = room.id;
    const wood = this._wood(0x5d4037);
    const darkWood = this._wood(0x3e2723, 0.7);
    const brass = this._brass(p.trim);

    const addBox = (sx, sy, sz, x, y, z, mat, cast = false) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
      m.position.set(x, y, z);
      m.castShadow = cast;
      m.receiveShadow = true;
      m.frustumCulled = true;
      group.add(m);
      return m;
    };
    const addCyl = (rt, rb, h, x, y, z, mat, seg = 10) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
      m.position.set(x, y, z);
      m.frustumCulled = true;
      group.add(m);
      return m;
    };

    if (id === "foyer") {
      // Console table against west wall (away from stairs)
      addBox(2.4, 0.12, 0.7, cx + 5.5, cy + 0.9, cz + 4, darkWood, true);
      for (const sx of [-0.9, 0.9]) addBox(0.1, 0.9, 0.1, cx + 5.5 + sx, cy + 0.45, cz + 4, wood);
      // Mirror frame above console
      addBox(1.6, 2.0, 0.08, cx + 5.5, cy + 2.3, cz + 4.35, brass);
      addBox(1.35, 1.75, 0.04, cx + 5.5, cy + 2.3, cz + 4.32, this._glass(0xc5e1ff, 0.45));
      // Coat hooks rail near door
      addBox(2.2, 0.08, 0.08, cx - 4, cy + 1.7, cz + d / 2 - 0.35, brass);
      for (let i = -2; i <= 2; i++) {
        addCyl(0.03, 0.03, 0.18, cx - 4 + i * 0.4, cy + 1.55, cz + d / 2 - 0.45, brass, 6);
      }
      // Grand foyer runner already via rug; add pedestal urns
      for (const sx of [-4, 4]) {
        addCyl(0.35, 0.4, 0.7, cx + sx, cy + 0.35, cz - 2, this._mat(0x90a4ae, 0.4, 0.3), 12);
        addCyl(0.2, 0.28, 0.35, cx + sx, cy + 0.85, cz - 2, this._mat(0x78909c, 0.35, 0.25), 10);
      }
      // Console cloth runner
      addBox(2.2, 0.02, 0.55, cx + 5.5, cy + 0.97, cz + 4, this._cloth(0xd7ccc8, 0.9));
      // Doorway curtains
      for (const side of [-1, 1]) {
        const curtain = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, h * 0.7, 1.1),
          this._velvet(0x4e342e)
        );
        curtain.position.set(cx + side * 2.4, cy + h * 0.38, cz + d / 2 - 0.55);
        group.add(curtain);
      }
      // Extra wall sconce emissives (no PointLight)
      for (const sx of [-5, 5]) {
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 8, 6),
          this._emissiveGlow(0xffe0b2, 1.05)
        );
        bulb.position.set(cx + sx, cy + 2.2, cz);
        group.add(bulb);
      }
    }

    if (id === "cabinet") {
      // Glass display cases
      for (const [dx, dz] of [[-6, 4], [6, 4], [-6, -4], [6, -4]]) {
        const x = cx + dx, z = cz + dz;
        addBox(2.2, 0.15, 1.2, x, cy + 0.08, z, darkWood, true);
        // glass case
        const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.6, 1.0), this._glass(0xb3e5fc, 0.28));
        glass.position.set(x, cy + 0.95, z);
        glass.frustumCulled = true;
        group.add(glass);
        // frame posts
        for (const sx of [-0.95, 0.95]) for (const sz of [-0.45, 0.45]) {
          addBox(0.06, 1.6, 0.06, x + sx, cy + 0.95, z + sz, brass);
        }
        addBox(2.1, 0.08, 1.1, x, cy + 1.78, z, darkWood);
        // plaque
        addBox(0.7, 0.18, 0.04, x, cy + 0.35, z + 0.65, brass);
      }
      // Tall bookcases along north
      for (const dx of [-7, -2.5, 2.5, 7]) {
        addBox(2.0, 2.8, 0.4, cx + dx, cy + 1.4, cz - d / 2 + 0.35, darkWood, true);
        for (let r = 0; r < 5; r++) {
          for (let b = 0; b < 4; b++) {
            const col = [0xb71c1c, 0x1a237e, 0x33691e, 0xf9a825, 0x4a148c, 0x5d4037][(r + b) % 6];
            addBox(0.14, 0.32, 0.28, cx + dx - 0.7 + b * 0.4, cy + 0.35 + r * 0.5, cz - d / 2 + 0.4, this._mat(col, 0.7));
          }
        }
      }
    }

    if (id === "armoury") {
      // Trophy shelf
      addBox(6, 0.12, 0.45, cx, cy + 2.4, cz - d / 2 + 0.35, darkWood);
      for (const dx of [-2, 0, 2]) {
        addCyl(0.12, 0.15, 0.35, cx + dx, cy + 2.65, cz - d / 2 + 0.35, brass, 8);
        addBox(0.25, 0.08, 0.25, cx + dx, cy + 2.88, cz - d / 2 + 0.35, this._mat(0xffd54f, 0.35, 0.6));
      }
      // Game table center
      addBox(2.4, 0.12, 2.4, cx + 2, cy + 0.85, cz + 1, this._wood(0x1b5e20, 0.55), true);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        addBox(0.12, 0.85, 0.12, cx + 2 + sx, cy + 0.42, cz + 1 + sz, wood);
      }
      // Dartboard frame (flat against wall)
      const dartOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16), this._mat(0xefebe9, 0.7));
      dartOuter.rotation.x = Math.PI / 2;
      dartOuter.position.set(cx - 6, cy + 1.8, cz - d / 2 + 0.2);
      group.add(dartOuter);
      const dartInner = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 16), this._mat(0xb71c1c, 0.6));
      dartInner.rotation.x = Math.PI / 2;
      dartInner.position.set(cx - 6, cy + 1.8, cz - d / 2 + 0.22);
      group.add(dartInner);
      const dartBull = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 10), this._mat(0xffeb3b, 0.5));
      dartBull.rotation.x = Math.PI / 2;
      dartBull.position.set(cx - 6, cy + 1.8, cz - d / 2 + 0.24);
      group.add(dartBull);
      // Sofa
      addBox(3.2, 0.55, 1.1, cx - 4, cy + 0.45, cz + 4, this._velvet(0x283593), true);
      addBox(3.2, 0.7, 0.25, cx - 4, cy + 0.9, cz + 4.4, this._velvet(0x1a237e));
      for (const sx of [-1.4, 1.4]) addBox(0.3, 0.55, 1.0, cx - 4 + sx, cy + 0.7, cz + 4, this._velvet(0x1a237e));
    }

    if (id === "conservatory") {
      // Benches
      for (const [dx, dz] of [[-7, 2], [7, 2], [0, -5]]) {
        addBox(2.2, 0.12, 0.6, cx + dx, cy + 0.5, cz + dz, this._mat(0x8d6e63, 0.7), true);
        for (const sx of [-0.9, 0.9]) addBox(0.12, 0.5, 0.5, cx + dx + sx, cy + 0.25, cz + dz, this._mat(0x6d4c41, 0.75));
      }
      // Large planters
      for (const [dx, dz] of [[-8, -6], [8, -6], [-4, 5], [4, 5]]) {
        addCyl(0.55, 0.65, 0.7, cx + dx, cy + 0.35, cz + dz, this._mat(0x6d4c41, 0.8), 12);
        addCyl(0.5, 0.5, 0.15, cx + dx, cy + 0.72, cz + dz, this._mat(0x3e2723, 0.9), 10);
        addCyl(0.35, 0.2, 0.9, cx + dx, cy + 1.2, cz + dz, this._mat(0x2e7d32, 0.85), 8);
        const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), this._mat(0x43a047, 0.88));
        foliage.position.set(cx + dx, cy + 1.7, cz + dz);
        foliage.frustumCulled = true;
        group.add(foliage);
      }
      // Hanging baskets
      for (const dx of [-5, 0, 5]) {
        addCyl(0.02, 0.02, 0.8, cx + dx, cy + 4.2, cz - 2, brass, 6);
        addCyl(0.28, 0.22, 0.25, cx + dx, cy + 3.7, cz - 2, this._mat(0x8d6e63, 0.75), 8);
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), this._mat(0x66bb6a, 0.85));
        leaf.position.set(cx + dx, cy + 3.55, cz - 2);
        group.add(leaf);
      }
      // Iron tables
      for (const [dx, dz] of [[-3, 0], [3, 0]]) {
        addCyl(0.55, 0.55, 0.06, cx + dx, cy + 0.85, cz + dz, this._mat(0x37474f, 0.4, 0.7), 12);
        addCyl(0.08, 0.1, 0.85, cx + dx, cy + 0.42, cz + dz, this._mat(0x263238, 0.45, 0.65), 8);
      }
    }

    if (id === "dining") {
      // Long table
      addBox(7.5, 0.14, 2.8, cx, cy + 0.88, cz, darkWood, true);
      for (const sx of [-3.2, 3.2]) for (const sz of [-1.0, 1.0]) {
        addBox(0.14, 0.88, 0.14, cx + sx, cy + 0.44, cz + sz, wood);
      }
      // Chairs
      for (let i = -2; i <= 2; i++) {
        for (const side of [-1, 1]) {
          const x = cx + i * 1.35;
          const z = cz + side * 1.85;
          addBox(0.45, 0.08, 0.45, x, cy + 0.5, z, wood);
          addBox(0.45, 0.55, 0.08, x, cy + 0.8, z + side * 0.18, this._velvet(0x5d4037));
          for (const lx of [-0.15, 0.15]) addBox(0.06, 0.5, 0.06, x + lx, cy + 0.25, z, wood);
        }
      }
      // Sideboard
      addBox(4.5, 1.0, 0.55, cx, cy + 0.5, cz - d / 2 + 0.5, darkWood, true);
      addBox(4.5, 0.08, 0.58, cx, cy + 1.05, cz - d / 2 + 0.5, brass);
      // Place settings (plates + cups)
      for (let i = -2; i <= 2; i++) {
        for (const side of [-1, 1]) {
          addCyl(0.14, 0.14, 0.03, cx + i * 1.35, cy + 0.98, cz + side * 0.7, this._mat(0xfafafa, 0.4), 12);
          addCyl(0.05, 0.06, 0.1, cx + i * 1.35 + 0.22, cy + 1.02, cz + side * 0.7, this._mat(0xffe0b2, 0.35), 8);
        }
      }
      // Tablecloth
      addBox(7.7, 0.02, 2.95, cx, cy + 0.96, cz, this._cloth(0xf5e6d3, 0.92));
      // Side curtains
      for (const side of [-1, 1]) {
        const curtain = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, h * 0.72, 1.4),
          this._velvet(0xb71c1c)
        );
        curtain.position.set(cx + side * (w / 2 - 0.35), cy + h * 0.4, cz);
        group.add(curtain);
      }
      const candle = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 6),
        this._emissiveGlow(0xffe082, 1.15)
      );
      candle.position.set(cx + 1.5, cy + 1.25, cz - d / 2 + 0.5);
      group.add(candle);
    }

    if (id === "workshop" || id === "cellar") {
      addBox(8.5, 0.14, 1.4, cx, cy + 0.95, cz - d * 0.28, this._wood(0x6d4c41), true);
      for (const sx of [-3.5, 3.5]) addBox(0.15, 0.95, 1.2, cx + sx, cy + 0.47, cz - d * 0.28, wood);
      // Tool pegboard
      addBox(3.5, 2.0, 0.08, cx - w / 2 + 0.2, cy + 1.8, cz, this._mat(0x795548, 0.75));
      for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
        addCyl(0.03, 0.03, 0.12, cx - w / 2 + 0.28, cy + 1.1 + r * 0.4, cz - 1.2 + c * 0.55, brass, 6);
      }
      // Crates
      for (const [dx, dz] of [[3, 3], [4.5, 2.5], [-4, 4]]) {
        addBox(0.8, 0.55, 0.7, cx + dx, cy + 0.28, cz + dz, this._wood(0x8d6e63));
      }
      // Stool
      addCyl(0.28, 0.3, 0.08, cx + 2, cy + 0.55, cz - d * 0.1, wood, 10);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        addCyl(0.04, 0.04, 0.55, cx + 2 + Math.cos(a) * 0.18, cy + 0.27, cz - d * 0.1 + Math.sin(a) * 0.18, wood, 6);
      }
    }

    if (id === "music") {
      addBox(10, 0.9, 0.55, cx, cy + 0.45, cz + d / 2 - 0.55, this._wood(0x4a148c, 0.55, 0.15), true);
      // Music stands
      for (const dx of [-6, -2, 2, 6]) {
        addCyl(0.03, 0.04, 1.3, cx + dx, cy + 0.65, cz - 2, brass, 6);
        addBox(0.55, 0.4, 0.04, cx + dx, cy + 1.4, cz - 2, this._mat(0x212121, 0.6));
        // sheet music plane
        const sheet = new THREE.Mesh(
          new THREE.PlaneGeometry(0.4, 0.3),
          new THREE.MeshStandardMaterial({ color: 0xfff8e1, roughness: 0.9, emissive: 0xfff8e1, emissiveIntensity: 0.05 })
        );
        sheet.position.set(cx + dx, cy + 1.4, cz - 2.03);
        group.add(sheet);
      }
      // Chairs for audience
      for (const dx of [-4, -1.5, 1.5, 4]) {
        addBox(0.5, 0.08, 0.5, cx + dx, cy + 0.48, cz + 3, wood);
        addBox(0.5, 0.5, 0.08, cx + dx, cy + 0.75, cz + 3.2, this._velvet(0x6a1b9a));
      }
      // Curtains on sides
      for (const side of [-1, 1]) {
        const curtain = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, h * 0.75, 1.8),
          this._velvet(side < 0 ? 0x4a148c : 0x6a1b9a)
        );
        curtain.position.set(cx + side * (w / 2 - 0.4), cy + h * 0.4, cz - d / 2 + 1.2);
        group.add(curtain);
      }
    }

    if (id === "nursery") {
      // Toy chest
      addBox(1.6, 0.7, 0.9, cx + 5, cy + 0.35, cz + 4, this._wood(0xe91e63, 0.7), true);
      addBox(1.65, 0.08, 0.95, cx + 5, cy + 0.74, cz + 4, brass);
      // Small bed / crib
      addBox(2.2, 0.35, 1.2, cx - 4, cy + 0.4, cz + 3, this._wood(0xf8bbd0, 0.75), true);
      addBox(2.3, 0.7, 0.08, cx - 4, cy + 0.7, cz + 3.55, this._wood(0xf48fb1));
      addBox(2.3, 0.7, 0.08, cx - 4, cy + 0.7, cz + 2.45, this._wood(0xf48fb1));
      // Rug toys (blocks)
      for (let i = 0; i < 5; i++) {
        const col = [0xf44336, 0x2196f3, 0xffeb3b, 0x4caf50, 0xff9800][i];
        addBox(0.25, 0.25, 0.25, cx - 1 + i * 0.4, cy + 0.15, cz - 2, this._mat(col, 0.7));
      }
      for (const side of [-1, 1]) {
        const curtain = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, h * 0.7, 1.2),
          this._velvet(0xf48fb1)
        );
        curtain.position.set(cx + side * (w / 2 - 0.4), cy + h * 0.4, cz - d / 2 + 0.9);
        group.add(curtain);
      }
    }

    if (id === "study") {
      addBox(7.5, 0.14, 1.5, cx, cy + 0.95, cz + d * 0.25, darkWood, true);
      for (const sx of [-3, 3]) addBox(0.12, 0.95, 1.3, cx + sx, cy + 0.47, cz + d * 0.25, wood);
      // Chair
      addBox(0.55, 0.1, 0.55, cx, cy + 0.55, cz + d * 0.25 + 1.2, wood);
      addBox(0.55, 0.65, 0.1, cx, cy + 0.9, cz + d * 0.25 + 1.4, this._velvet(0x37474f));
      // Desk lamp (emissive)
      addCyl(0.04, 0.05, 0.35, cx - 2.5, cy + 1.2, cz + d * 0.25, brass, 8);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), this._emissiveGlow(0xffe0b2, 1.0));
      lamp.position.set(cx - 2.5, cy + 1.45, cz + d * 0.25);
      group.add(lamp);
      // Stacked books
      for (let i = 0; i < 4; i++) {
        const col = [0xb71c1c, 0x1a237e, 0x33691e, 0xf9a825][i];
        addBox(0.35, 0.08, 0.25, cx + 2 + (i % 2) * 0.05, cy + 1.05 + i * 0.09, cz + d * 0.25, this._mat(col, 0.7));
      }
    }

    if (id === "library_hall") {
      // Continuous bookcases both sides
      for (const side of [-1, 1]) {
        const x = cx + side * (w / 2 - 0.35);
        for (let zi = -3; zi <= 3; zi++) {
          const z = cz + zi * 2.4;
          addBox(0.45, 2.6, 2.2, x, cy + 1.3, z, darkWood, true);
          for (let r = 0; r < 5; r++) {
            for (let b = 0; b < 4; b++) {
              const col = [0xb71c1c, 0x1a237e, 0x33691e, 0xf9a825, 0x4a148c][(r + b + zi + 5) % 5];
              addBox(0.28, 0.32, 0.14, x - side * 0.05, cy + 0.35 + r * 0.48, z - 0.75 + b * 0.45, this._mat(col, 0.7));
            }
          }
        }
      }
    }

    if (id === "landing" || id === "hall_ground" || id === "hall_east" || id === "study_annex") {
      // Plant + painting already in decor; add console / plant pot
      addCyl(0.22, 0.28, 0.45, cx + w * 0.3, cy + 0.22, cz - d * 0.3, this._mat(0x8d6e63, 0.8), 10);
      const plant = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), this._mat(0x2e7d32, 0.88));
      plant.position.set(cx + w * 0.3, cy + 0.7, cz - d * 0.3);
      group.add(plant);
    }

    if (id === "attic_loft" || id === "science_attic") {
      // Sparse crates only (LOD)
      for (const [dx, dz] of [[-5, 3], [5, -3]]) {
        addBox(1.0, 0.7, 0.8, cx + dx, cy + 0.35, cz + dz, this._wood(0x6d4c41));
      }
    }
  }

  _placeRoomObjects(group, room, cy, p, outdoor) {
    if (!room.objects) return;
    for (const place of room.objects) {
      const def = OBJECTS[place.id];
      if (!def) {
        console.warn("[mansion] missing object", place.id);
        continue;
      }
      const [px, , pz] = place.pos;
      const surface = place.surface || "pedestal";

      // Surface prop
      if (surface === "pedestal" || surface === "crate" || surface === "stump" || surface === "rock") {
        if (surface === "pedestal") {
          const pedestal = buildPedestal(p.trim);
          pedestal.position.set(px, cy, pz);
          group.add(pedestal);
        } else if (surface === "crate") {
          const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), this._mat(0x6d4c41, 0.8));
          crate.position.set(px, cy + 0.25, pz);
          group.add(crate);
        } else if (surface === "stump") {
          const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.55, 10), this._mat(0x5d4037, 0.85));
          stump.position.set(px, cy + 0.28, pz);
          group.add(stump);
        } else if (surface === "rock") {
          const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 0), this._mat(0x78909c, 0.9));
          rock.position.set(px, cy + 0.25, pz);
          rock.rotation.set(0.2, 0.4, 0.1);
          group.add(rock);
        }
      } else if (surface === "table" || surface === "bench" || surface === "desk" || surface === "planter") {
        const top = new THREE.Mesh(
          new THREE.BoxGeometry(surface === "planter" ? 0.9 : 1.1, 0.1, 0.7),
          this._mat(outdoor ? 0x6d4c41 : 0x5d4037, 0.7)
        );
        top.position.set(px, cy + 0.85, pz);
        group.add(top);
        for (const sx of [-0.4, 0.4]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.1), this._mat(0x4e342e, 0.75));
          leg.position.set(px + sx, cy + 0.42, pz);
          group.add(leg);
        }
      } else if (surface === "garden") {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.35, 10), this._mat(0x8d6e63, 0.8));
        pot.position.set(px, cy + 0.18, pz);
        group.add(pot);
      } else if (surface === "shelf" || surface === "stand") {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.5), this._mat(p.trim, 0.5, 0.3));
        shelf.position.set(px, cy + 0.95, pz);
        group.add(shelf);
      }
      // rug / floor: no extra prop

      const obj = buildLayerShells(def);
      let yOff = 1.05;
      if (def.monument) yOff = 0.5;
      else if (surface === "rug" || surface === "floor") yOff = 0.35;
      else if (surface === "garden") yOff = 0.55;
      else if (surface === "rock" || surface === "stump" || surface === "crate") yOff = 0.7;
      else if (surface === "table" || surface === "bench" || surface === "desk" || surface === "planter" || surface === "shelf" || surface === "stand") yOff = 1.05;
      obj.position.set(px, cy + yOff, pz);
      if (def.monument) obj.scale.multiplyScalar(1.1);
      obj.userData.interactable = true;
      obj.userData.objectId = def.id;
      group.add(obj);
      this.interactives.push(obj);

      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(def.monument ? 1.8 : 0.7, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.copy(obj.position);
      hit.userData.interactable = true;
      hit.userData.objectId = def.id;
      hit.userData.target = obj;
      group.add(hit);
      this.interactives.push(hit);
    }
  }

  _addWindows(group, wall, p, floorY, h) {
    const [sx, sy, sz] = wall.size;
    const [px, py, pz] = wall.pos;
    const horizontal = sx > sz;
    if (sy < 3) return;
    const count = horizontal ? Math.max(1, Math.floor(sx / 5.5)) : Math.max(1, Math.floor(sz / 5.5));
    const trim = this._brass(p.trim);
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1) - 0.5) * 0.7;
      const wx = horizontal ? px + t * sx : px;
      const wz = horizontal ? pz : pz + t * sz;
      const wy = floorY + 2.05;
      // Recess box (slightly inset)
      const recess = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 1.55 : 0.18, 2.0, horizontal ? 0.18 : 1.55),
        this._mat(0x1a1410, 0.85)
      );
      recess.position.set(wx, wy, wz);
      recess.frustumCulled = true;
      group.add(recess);
      // Outer frame
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 1.45 : 0.14, 1.9, horizontal ? 0.14 : 1.45),
        trim
      );
      frame.position.set(wx, wy, wz);
      group.add(frame);
      // Glowing pane
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 1.15 : 0.06, 1.55, horizontal ? 0.06 : 1.15),
        new THREE.MeshStandardMaterial({
          color: p.light, emissive: p.light, emissiveIntensity: 0.75,
          roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.55,
        })
      );
      glow.position.set(wx, wy, wz);
      group.add(glow);
      // Mullion crossbars
      const mullH = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 1.15 : 0.04, 0.05, horizontal ? 0.05 : 1.15),
        trim
      );
      mullH.position.set(wx, wy, wz);
      group.add(mullH);
      const mullV = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 0.05 : 0.04, 1.55, horizontal ? 0.04 : 0.05),
        trim
      );
      mullV.position.set(wx, wy, wz);
      group.add(mullV);
      // Sill
      const sill = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 1.55 : 0.22, 0.08, horizontal ? 0.22 : 1.55),
        trim
      );
      sill.position.set(wx, wy - 1.0, wz);
      group.add(sill);
    }
  }

  _addChandelier(group, x, y, z, color) {
    const brass = this._brass(color);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.55, 8), brass);
    stem.position.set(x, y, z);
    group.add(stem);
    // Multi-arm chandelier with emissive bulbs (no PointLights)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 16), brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y - 0.35, z);
    group.add(ring);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const bx = x + Math.cos(a) * 0.32;
      const bz = z + Math.sin(a) * 0.32;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6), brass);
      arm.position.set(bx, y - 0.28, bz);
      group.add(arm);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 10, 8),
        this._emissiveGlow(0xffe0b2, 0.95)
      );
      bulb.position.set(bx, y - 0.42, bz);
      group.add(bulb);
    }
    const center = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 8),
      this._emissiveGlow(0xffcc80, 0.8)
    );
    center.position.set(x, y - 0.38, z);
    group.add(center);
  }

  _addSconces(group, room, p) {
    const [w, h, d] = room.size;
    const [cx, cy, cz] = room.pos;
    const brass = this._brass(p.trim);
    const spots = [
      [cx - w * 0.38, cy + 2.15, cz - d * 0.42],
      [cx + w * 0.38, cy + 2.15, cz + d * 0.42],
      [cx - w * 0.38, cy + 2.15, cz + d * 0.3],
      [cx + w * 0.38, cy + 2.15, cz - d * 0.3],
    ];
    for (const [x, y, z] of spots) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.32, 0.08), brass);
      plate.position.set(x, y, z);
      plate.frustumCulled = true;
      group.add(plate);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 6), brass);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(x, y - 0.05, z);
      group.add(arm);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 6),
        this._emissiveGlow(p.light || 0xffe0b2, 0.9)
      );
      // nudge bulb slightly inward from wall
      const inwardX = Math.sign(cx - x) * 0.12 || 0;
      const inwardZ = Math.sign(cz - z) * 0.12 || 0;
      bulb.position.set(x + inwardX, y - 0.05, z + inwardZ);
      group.add(bulb);
    }
  }

  _addDecor(group, room, p) {
    const [w, , d] = room.size;
    const [cx, cy, cz] = room.pos;
    const brass = this._brass(p.trim);
    // Abstract art paintings with CanvasTexture gradients
    for (let i = 0; i < 3; i++) {
      const seed = (room.id.charCodeAt(0) + i * 3) % 6;
      const artMat = new THREE.MeshStandardMaterial({
        map: this._artTex(seed) || undefined,
        roughness: 0.65,
        metalness: 0.05,
      });
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.05, 0.07), brass);
      const canvas = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.85, 0.04), artMat);
      const x = cx + (i - 1) * Math.min(w * 0.28, 4.5);
      const z = cz - d / 2 + 0.18;
      frame.position.set(x, cy + 2.35, z);
      canvas.position.set(x, cy + 2.35, z + 0.03);
      frame.frustumCulled = true;
      canvas.frustumCulled = true;
      group.add(frame, canvas);
    }
    // Bookcases for library/study/cabinet (extra if not already furniture-heavy)
    if (room.id === "study" || room.id === "cabinet") {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.5, 0.45), this._wood(0x5d4037));
      shelf.position.set(cx + w / 2 - 1.4, cy + 1.25, cz + d * 0.15);
      shelf.castShadow = true;
      shelf.frustumCulled = true;
      group.add(shelf);
      for (let r = 0; r < 4; r++) {
        for (let b = 0; b < 5; b++) {
          const book = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.35, 0.28),
            this._mat([0xb71c1c, 0x1a237e, 0x33691e, 0xf9a825, 0x4a148c][b], 0.65)
          );
          book.position.set(cx + w / 2 - 1.4 - 0.9 + b * 0.38, cy + 0.4 + r * 0.52, cz + d * 0.15 + 0.05);
          book.frustumCulled = true;
          group.add(book);
        }
      }
    }
  }

  _doorwaysFor(room) {
    const pairs = {
      foyer: { north: true, south: true },
      hall_ground: { south: true, west: true, east: true, north: true },
      cabinet: { east: true },
      armoury: { west: true },
      conservatory: { south: true, west: true, east: true, north: true },
      dining: { east: true },
      hall_east: { west: true },
      landing: { north: true, south: true },
      library_hall: { south: true, west: true, east: true, north: true },
      workshop: { east: true },
      music: { south: true, west: true, east: true },
      study_annex: { west: true },
      study: { east: true },
      nursery: { west: true },
      attic_loft: { north: true },
      science_attic: { south: true },
      cellar: {},
    };
    return pairs[room.id] || {};
  }

  _addWallWithDoor(group, wall, color, thick, trimColor) {
    const [sx, sy, sz] = wall.size;
    const [px, py, pz] = wall.pos;
    const doorW = 2.4;
    const doorH = Math.min(sy * 0.85, 3.2);
    const horizontal = sx > sz;
    if (horizontal) {
      const remain = (sx - doorW) / 2;
      for (const sign of [-1, 1]) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(remain, sy, sz), this._mat(color, 0.8));
        mesh.position.set(px + sign * (doorW / 2 + remain / 2), py, pz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        this.colliders.push(
          new THREE.Box3().setFromCenterAndSize(mesh.position.clone(), new THREE.Vector3(remain, sy, sz))
        );
      }
      const headerH = sy - doorH;
      if (headerH > 0.2) {
        const header = new THREE.Mesh(
          new THREE.BoxGeometry(doorW, headerH, sz),
          this._mat(color, 0.8)
        );
        header.position.set(px, py + sy / 2 - headerH / 2, pz);
        group.add(header);
        this.colliders.push(
          new THREE.Box3().setFromCenterAndSize(header.position.clone(), new THREE.Vector3(doorW, headerH, sz))
        );
      }
    } else {
      const remain = (sz - doorW) / 2;
      for (const sign of [-1, 1]) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, remain), this._mat(color, 0.8));
        mesh.position.set(px, py, pz + sign * (doorW / 2 + remain / 2));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        this.colliders.push(
          new THREE.Box3().setFromCenterAndSize(mesh.position.clone(), new THREE.Vector3(sx, sy, remain))
        );
      }
      const headerH = sy - doorH;
      if (headerH > 0.2) {
        const header = new THREE.Mesh(
          new THREE.BoxGeometry(sx, headerH, doorW),
          this._mat(color, 0.8)
        );
        header.position.set(px, py + sy / 2 - headerH / 2, pz);
        group.add(header);
        this.colliders.push(
          new THREE.Box3().setFromCenterAndSize(header.position.clone(), new THREE.Vector3(sx, headerH, doorW))
        );
      }
    }
    const trimMat = this._brass(trimColor || 0xc9a227);
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? doorW + 0.35 : thick + 0.18, 0.22, horizontal ? thick + 0.18 : doorW + 0.35),
      trimMat
    );
    const floorY = py - sy / 2;
    lintel.position.set(px, floorY + doorH + 0.06, pz);
    group.add(lintel);
    // Door jambs (left/right) + threshold
    if (horizontal) {
      for (const sign of [-1, 1]) {
        const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.12, doorH, thick + 0.2), trimMat);
        jamb.position.set(px + sign * (doorW / 2), floorY + doorH / 2, pz);
        jamb.frustumCulled = true;
        group.add(jamb);
      }
      const thresh = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.2, 0.06, thick + 0.25), trimMat);
      thresh.position.set(px, floorY + 0.03, pz);
      group.add(thresh);
    } else {
      for (const sign of [-1, 1]) {
        const jamb = new THREE.Mesh(new THREE.BoxGeometry(thick + 0.2, doorH, 0.12), trimMat);
        jamb.position.set(px, floorY + doorH / 2, pz + sign * (doorW / 2));
        jamb.frustumCulled = true;
        group.add(jamb);
      }
      const thresh = new THREE.Mesh(new THREE.BoxGeometry(thick + 0.25, 0.06, doorW + 0.2), trimMat);
      thresh.position.set(px, floorY + 0.03, pz);
      group.add(thresh);
    }
  }

  _buildStair(s, room) {
    const g = new THREE.Group();
    g.name = `stairs_${s.id}`;
    const steps = 14;
    const rise = (s.toY - s.fromY) / steps;
    const run = s.length / steps;
    const w = s.width;
    const dir = s.dir;
    const trim = this._mat(0x8d6e63, 0.7);
    const railMat = this._mat(0xc9a227, 0.35, 0.55);

    for (let i = 0; i < steps; i++) {
      const y = s.fromY + rise * (i + 0.5);
      let x = s.x;
      let z = s.z;
      if (dir === "north") z = s.z - run * (i + 0.5);
      else if (dir === "south") z = s.z + run * (i + 0.5);
      else if (dir === "east") x = s.x + run * (i + 0.5);
      else if (dir === "west") x = s.x - run * (i + 0.5);

      const step = new THREE.Mesh(
        new THREE.BoxGeometry(dir === "east" || dir === "west" ? run * 0.95 : w, Math.abs(rise) * 0.9, dir === "east" || dir === "west" ? w : run * 0.95),
        trim
      );
      step.position.set(x, y, z);
      step.castShadow = false;
      step.receiveShadow = true;
      step.frustumCulled = true;
      g.add(step);
      // Staircase runner (carpet strip)
      const runner = new THREE.Mesh(
        new THREE.BoxGeometry(
          dir === "east" || dir === "west" ? run * 0.9 : w * 0.45,
          0.025,
          dir === "east" || dir === "west" ? w * 0.45 : run * 0.9
        ),
        new THREE.MeshStandardMaterial({
          color: 0x6a1b9a, roughness: 0.95, metalness: 0.02,
          emissive: 0x4a148c, emissiveIntensity: 0.05,
        })
      );
      runner.position.set(x, y + Math.abs(rise) * 0.48, z);
      runner.frustumCulled = true;
      g.add(runner);
    }

    let minX, maxX, minZ, maxZ;
    if (dir === "north") {
      minX = s.x - w / 2; maxX = s.x + w / 2;
      minZ = s.z - s.length; maxZ = s.z;
    } else if (dir === "south") {
      minX = s.x - w / 2; maxX = s.x + w / 2;
      minZ = s.z; maxZ = s.z + s.length;
    } else if (dir === "east") {
      minX = s.x; maxX = s.x + s.length;
      minZ = s.z - w / 2; maxZ = s.z + w / 2;
    } else {
      minX = s.x - s.length; maxX = s.x;
      minZ = s.z - w / 2; maxZ = s.z + w / 2;
    }

    this.ramps.push({
      minX, maxX, minZ, maxZ,
      fromY: s.fromY,
      toY: s.toY,
      dir,
      x0: s.x,
      z0: s.z,
      length: s.length,
      priority: 10,
    });

    for (const side of [-1, 1]) {
      for (let i = 0; i < steps; i++) {
        const y = s.fromY + rise * (i + 0.5) + 0.55;
        let x = s.x;
        let z = s.z;
        if (dir === "north") {
          z = s.z - run * (i + 0.5);
          x = s.x + side * (w / 2 - 0.08);
        } else if (dir === "south") {
          z = s.z + run * (i + 0.5);
          x = s.x + side * (w / 2 - 0.08);
        } else if (dir === "east") {
          x = s.x + run * (i + 0.5);
          z = s.z + side * (w / 2 - 0.08);
        } else {
          x = s.x - run * (i + 0.5);
          z = s.z + side * (w / 2 - 0.08);
        }
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), railMat);
        post.position.set(x, y, z);
        g.add(post);
      }
    }

    this.root.add(g);
  }


  /**
   * Front facade with ground entry + first-floor balcony French doors.
   * Leaves walkable / driveable openings at y≈4.2–6.4, x∈[-5.5,5.5].
   */
  _addFrontFacadeWithBalconyDoors(group, stone, trim, facadeH) {
    const pz = 14.2;
    const thick = 0.45;
    const totalW = 30;
    const groundDoorW = 3.2;
    const groundDoorH = 3.4;
    const balDoorH0 = 4.25;
    const balDoorH1 = 6.45;
    const balDoorW = 11.2; // wide opening onto balcony

    // Helper to add a wall slab + collider
    const addSlab = (w, h, x, y) => {
      if (w < 0.05 || h < 0.05) return;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, thick), stone);
      mesh.position.set(x, y, pz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      this.colliders.push(
        new THREE.Box3().setFromCenterAndSize(
          mesh.position.clone(),
          new THREE.Vector3(w, h, thick)
        )
      );
    };

    // --- Below balcony door band (y 0 → balDoorH0), with ground door ---
    const belowH = balDoorH0;
    const belowCy = belowH / 2;
    const sideW = (totalW - groundDoorW) / 2;
    addSlab(sideW, belowH, -groundDoorW / 2 - sideW / 2, belowCy);
    addSlab(sideW, belowH, groundDoorW / 2 + sideW / 2, belowCy);
    // Ground door header strip up to balcony sill (only over door width)
    const gh = balDoorH0 - groundDoorH;
    if (gh > 0.05) addSlab(groundDoorW, gh, 0, groundDoorH + gh / 2);

    // Ground door lintel trim
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(groundDoorW + 0.4, 0.22, thick + 0.2),
      trim
    );
    lintel.position.set(0, groundDoorH + 0.1, pz);
    group.add(lintel);

    // Windows on lower wings
    this._addExteriorWindows(group, {
      size: [sideW, belowH, thick],
      pos: [-groundDoorW / 2 - sideW / 2, belowCy, pz],
    });
    this._addExteriorWindows(group, {
      size: [sideW, belowH, thick],
      pos: [groundDoorW / 2 + sideW / 2, belowCy, pz],
    });

    // --- Balcony door band: sides only ---
    const bandH = balDoorH1 - balDoorH0;
    const bandCy = (balDoorH0 + balDoorH1) / 2;
    const balSide = (totalW - balDoorW) / 2;
    addSlab(balSide, bandH, -balDoorW / 2 - balSide / 2, bandCy);
    addSlab(balSide, bandH, balDoorW / 2 + balSide / 2, bandCy);

    // French-door frames (visual, non-blocking)
    const frameMat = trim;
    for (const sx of [-3.5, -1.2, 1.2, 3.5]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, bandH * 0.95, 0.1), frameMat);
      post.position.set(sx, bandCy, pz + 0.05);
      group.add(post);
    }
    const balLintel = new THREE.Mesh(
      new THREE.BoxGeometry(balDoorW + 0.5, 0.18, thick + 0.25),
      trim
    );
    balLintel.position.set(0, balDoorH1 + 0.05, pz);
    group.add(balLintel);

    // --- Above balcony doors to eaves ---
    const aboveH = facadeH - balDoorH1;
    if (aboveH > 0.1) {
      addSlab(totalW, aboveH, 0, balDoorH1 + aboveH / 2);
      this._addExteriorWindows(group, {
        size: [totalW, aboveH, thick],
        pos: [0, balDoorH1 + aboveH / 2, pz],
      });
    }
  }

  /**
   * Exterior driveable balcony off Upper Landing (south / front of mansion).
   * Plank deck, stone balustrade, brackets, emissive lanterns + floor region.
   */
  _buildBalcony() {
    const g = new THREE.Group();
    g.name = "balcony";
    const deckY = 4.2;
    const deckW = 12.5; // X
    const deckD = 5.4;  // Z
    const deckX = 0.5;
    const deckZ = 14.8; // center — spans ~12.1 → 17.5

    // Floor region so Explore walk works
    this.floorRegions.push({
      minX: deckX - deckW / 2,
      maxX: deckX + deckW / 2,
      minZ: deckZ - deckD / 2,
      maxZ: deckZ + deckD / 2,
      y: deckY,
      priority: 4,
      roomId: "balcony",
    });

    // Connection strip from Upper Landing south edge (z≈10) to balcony
    this.floorRegions.push({
      minX: -6.5, maxX: 7.5,
      minZ: 9.5, maxZ: deckZ - deckD / 2 + 0.1,
      y: deckY,
      priority: 3,
      roomId: "balcony_approach",
    });

    const plank = this._floorMat(0x6d4c41, 0.78) || this._mat(0x6d4c41, 0.78);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.16, deckD), plank);
    deck.position.set(deckX, deckY - 0.08, deckZ);
    deck.receiveShadow = true;
    deck.castShadow = true;
    g.add(deck);

    // Approach boards toward landing
    const approach = new THREE.Mesh(
      new THREE.BoxGeometry(8.5, 0.14, 3.2),
      plank
    );
    approach.position.set(0.5, deckY - 0.07, 11.2);
    approach.receiveShadow = true;
    g.add(approach);

    const stone = this._mat(0xd7ccc8, 0.7, 0.15);
    const railMat = this._mat(0xcfd8dc, 0.45, 0.35);

    // Balustrade posts + rail on outer three sides (N open to house)
    const minX = deckX - deckW / 2 + 0.15;
    const maxX = deckX + deckW / 2 - 0.15;
    const minZ = deckZ - deckD / 2 + 0.15;
    const maxZ = deckZ + deckD / 2 - 0.15;
    const postH = 0.95;
    const posts = [];
    for (let x = minX; x <= maxX + 0.01; x += 1.15) {
      posts.push([x, maxZ]); // south outer
    }
    for (let z = minZ + 1.1; z < maxZ - 0.2; z += 1.15) {
      posts.push([minX, z]);
      posts.push([maxX, z]);
    }
    for (const [px, pz] of posts) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, postH, 8), stone);
      post.position.set(px, deckY + postH / 2, pz);
      post.castShadow = true;
      g.add(post);
      // Ball finial
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), stone);
      ball.position.set(px, deckY + postH + 0.06, pz);
      g.add(ball);
    }
    // Top rails
    const railY = deckY + 0.78;
    const southRail = new THREE.Mesh(
      new THREE.BoxGeometry(deckW - 0.2, 0.08, 0.1),
      railMat
    );
    southRail.position.set(deckX, railY, maxZ);
    g.add(southRail);
    for (const sx of [minX, maxX]) {
      const sideRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.08, deckD - 0.5),
        railMat
      );
      sideRail.position.set(sx, railY, deckZ + 0.15);
      g.add(sideRail);
    }

    // Support brackets under deck
    const bracketMat = this._mat(0x5d4037, 0.55, 0.2);
    for (let x = -5; x <= 5; x += 2.5) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 0.18), bracketMat);
      brace.position.set(x, deckY - 0.55, 12.4);
      brace.rotation.x = 0.4;
      g.add(brace);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), bracketMat);
      foot.position.set(x, deckY - 1.1, 14.0);
      g.add(foot);
    }

    // Warm outdoor lanterns (emissive only — light budget)
    const lanternMat = this._emissiveGlow(0xffe0b2, 1.15);
    const brass = this._brass();
    for (const [lx, lz] of [[-5.5, 17.0], [0.5, 17.2], [6.0, 17.0], [-5.5, 12.6], [6.0, 12.6]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 1.1, 6), brass);
      pole.position.set(lx, deckY + 0.55, lz);
      g.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), lanternMat);
      lamp.position.set(lx, deckY + 1.15, lz);
      g.add(lamp);
    }

    // Soft room label for getRoomAt via floorRegions / synthetic
    this.roomLabels.push({
      id: "balcony",
      name: "Balcony",
      floor: "First Floor",
      x: deckX, y: deckY, z: deckZ,
    });

    this.root.add(g);
  }

  getFloorY(x, z, currentY = 0) {
    if (!Number.isFinite(currentY)) currentY = 0;

    // 1) Ramps — only when feet are near this story band and inside ramp XZ
    let rampY = null;
    let rampDist = Infinity;
    for (const r of this.ramps) {
      if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) continue;
      const lo = Math.min(r.fromY, r.toY) - 0.5;
      const hi = Math.max(r.fromY, r.toY) + 1.2;
      if (currentY < lo || currentY > hi) continue;

      let t = 0;
      if (r.dir === "north") t = (r.z0 - z) / r.length;
      else if (r.dir === "south") t = (z - r.z0) / r.length;
      else if (r.dir === "east") t = (x - r.x0) / r.length;
      else t = (r.x0 - x) / r.length;
      t = Math.max(0, Math.min(1, t));
      const y = r.fromY + (r.toY - r.fromY) * t;
      const dy = Math.abs(y - currentY);
      if (dy < rampDist) {
        rampDist = dy;
        rampY = y;
      }
    }
    // Use ramp when on/near stairs (same band) — prefer while transitioning
    if (rampY != null && rampDist < 2.8) return rampY;

    // 2) Floor regions — prefer same story at/just below feet
    const candidates = [];
    for (const f of this.floorRegions) {
      if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) {
        candidates.push(f);
      }
    }
    if (!candidates.length) return rampY ?? 0;

    let pool = candidates.filter((f) => f.y <= currentY + 1.0);
    if (!pool.length) pool = candidates.slice();

    const sameStory = pool.filter((f) => Math.abs(f.y - currentY) < 2.2);
    if (sameStory.length) pool = sameStory;

    pool.sort((a, b) => {
      const da = Math.abs(a.y - currentY);
      const db = Math.abs(b.y - currentY);
      if (Math.abs(da - db) > 0.01) return da - db;
      // Prefer higher priority, then slightly prefer higher floor when tied
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.y - a.y;
    });

    return pool[0].y;
  }

  getRoomAt(x, y, z) {
    let best = null;
    let bestPri = -1;
    for (const room of Object.values(ROOMS)) {
      const [w, h, d] = room.size;
      const [cx, cy, cz] = room.pos;
      // Outdoor zones: ignore vertical wall height tightly; badge when on grounds
      const yOk = room.outdoor
        ? y > cy - 0.5 && y < cy + 8
        : y > cy - 0.5 && y < cy + h + 1.5;
      if (
        x > cx - w / 2 && x < cx + w / 2 &&
        z > cz - d / 2 && z < cz + d / 2 &&
        yOk
      ) {
        let pri = room.id.includes("hall") ? 0 : 1;
        if (room.outdoor) pri = 3;
        if (pri >= bestPri) {
          bestPri = pri;
          best = room;
        }
      }
    }
    // Balcony override when standing on deck
    if (
      y > 3.8 && y < 6.5 &&
      x > -6.5 && x < 7.5 &&
      z > 11.5 && z < 18.0
    ) {
      return {
        id: "balcony",
        name: "Balcony",
        floor: "First Floor",
        size: [12.5, 3.0, 5.4],
        pos: [0.5, 4.2, 14.8],
        palette: { wall: 0x4a3728, floor: 0x6d4c41, trim: 0xc9a227, light: 0xffe0b2 },
        outdoor: true,
      };
    }
    return best;
  }

  getInteractives() {
    return this.interactives;
  }

  getColliders() {
    return this.colliders;
  }
}
