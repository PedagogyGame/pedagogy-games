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
    this.root = new THREE.Group();
    this.root.name = "mansion";
    scene.add(this.root);
    this._build();
  }

  _mat(color, rough = 0.75, metal = 0.05) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: rough,
      metalness: metal,
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
      h.castShadow = true;
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
      const lamp = new THREE.PointLight(0xffcc80, 8, 14, 2);
      lamp.position.set(sx, 3.1, gateZ);
      g.add(lamp);
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
      // South (front) facade facing drive — with door opening
      { size: [30, facadeH, 0.45], pos: [0, facadeH / 2, 14.2], door: true, doorW: 3.2 },
      // North (conservatory garden) — with wide garden doors
      { size: [24, 6.2, 0.4], pos: [0, 3.1, -40.2], door: true, doorW: 4.5 },
      // West outer
      { size: [0.45, facadeH, 56], pos: [-26.5, facadeH / 2, -12], door: false },
      // East outer
      { size: [0.45, facadeH, 56], pos: [26.5, facadeH / 2, -12], door: false },
    ];

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
          new THREE.BoxGeometry(horizontal ? 1.3 : 0.14, 1.7, horizontal ? 0.14 : 1.3),
          this._mat(0xc9a227, 0.4, 0.5)
        );
        frame.position.set(wx, fy, wz);
        group.add(frame);
        // Warm glowing pane
        const pane = new THREE.Mesh(
          new THREE.BoxGeometry(horizontal ? 1.05 : 0.08, 1.4, horizontal ? 0.08 : 1.05),
          new THREE.MeshStandardMaterial({
            color: 0xffe0b2,
            emissive: 0xffb74d,
            emissiveIntensity: 0.85,
            roughness: 0.35,
            transparent: true,
            opacity: 0.75,
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
        const pl = new THREE.PointLight(0xffcc80, 3.5, 9, 2);
        pl.position.set(wx, fy, wz + (horizontal ? (pz > 0 ? 0.4 : -0.4) : 0));
        group.add(pl);
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

    this.root.add(g);
  }

  _addFountain(g, x, y, z) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.4, 24), this._mat(0xb0bec5, 0.55, 0.2));
    base.position.set(x, y + 0.2, z);
    g.add(base);
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
    const light = new THREE.PointLight(0xffe0b2, 10, 12, 2);
    light.position.set(x, y + 2.8, z);
    g.add(light);
  }

  _addGreenhouse(g, x, y, z) {
    const frame = this._mat(0xcfd8dc, 0.4, 0.5);
    const glass = new THREE.MeshStandardMaterial({
      color: 0xa5d6a7, transparent: true, opacity: 0.35, roughness: 0.2, metalness: 0.1,
      emissive: 0x81c784, emissiveIntensity: 0.12,
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 4), this._mat(0x6d4c41, 0.8));
    base.position.set(x, y + 0.15, z);
    g.add(base);
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.6, 3.6), glass);
    body.position.set(x, y + 1.5, z);
    g.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.4, 4), glass);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(x, y + 3.4, z);
    g.add(roof);
    for (const sx of [-2.2, 2.2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), frame);
      post.position.set(x + sx, y + 1.5, z);
      g.add(post);
    }
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
    const pl = new THREE.PointLight(0xffcc80, 5, 11, 2);
    pl.position.set(x, 2.5, z);
    g.add(pl);
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

    // Soft ambient for zone
    const amb = new THREE.PointLight(p.light, 6, Math.max(w, d) * 0.8, 2);
    amb.position.set(cx, cy + 2.5, cz);
    g.add(amb);

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

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.2, d),
      this._mat(p.floor, 0.85, 0.02)
    );
    floor.position.set(cx, cy - 0.1, cz);
    floor.receiveShadow = true;
    floor.userData.floorY = cy;
    g.add(floor);

    const rug = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(w * 0.45, 8), 0.03, Math.min(d * 0.4, 6)),
      this._mat(p.trim, 0.9, 0.05)
    );
    rug.position.set(cx, cy + 0.02, cz);
    g.add(rug);

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

    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.3, 0.1, d - 0.3),
      this._mat(p.trim, 0.4, 0.45)
    );
    crown.position.set(cx, cy + h - 0.08, cz);
    g.add(crown);

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
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...wall.size), this._mat(p.wall, 0.8));
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
    const spot = new THREE.SpotLight(p.light, 40, reach + 6, Math.PI / 3.2, 0.5, 1.2);
    spot.position.set(cx, cy + h - 0.35, cz);
    spot.target.position.set(cx, cy, cz);
    spot.castShadow = true;
    spot.shadow.mapSize.set(512, 512);
    g.add(spot, spot.target);

    const amb = new THREE.PointLight(p.light, 12, reach + 4, 2);
    amb.position.set(cx, cy + Math.min(2.4, h * 0.55), cz);
    g.add(amb);

    this._addChandelier(g, cx, cy + h - 0.5, cz, p.trim);
    this._addSconces(g, room, p);
    this._addDecor(g, room, p);

    // Surface furniture for realism
    this._addRoomFurniture(g, room, p);

    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.35, 0.06, d - 0.35),
      this._mat(p.trim, 0.4, 0.55)
    );
    trim.position.set(cx, cy + 0.04, cz);
    g.add(trim);

    this._placeRoomObjects(g, room, cy, p, false);

    this.root.add(g);
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
    // Moonlight wash
    const moon = new THREE.PointLight(0xb3e5fc, 8, 22, 2);
    moon.position.set(cx, cy + h - 0.5, cz - 2);
    group.add(moon);
  }

  _addRoomFurniture(group, room, p) {
    const [w, , d] = room.size;
    const [cx, cy, cz] = room.pos;
    if (room.id === "dining") {
      const table = new THREE.Mesh(new THREE.BoxGeometry(6, 0.15, 3), this._mat(0x5d4037, 0.6));
      table.position.set(cx, cy + 0.85, cz);
      group.add(table);
      for (const sx of [-2.5, 2.5]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.85, 0.15), this._mat(0x4e342e, 0.7));
        leg.position.set(cx + sx, cy + 0.42, cz);
        group.add(leg);
      }
    }
    if (room.id === "workshop" || room.id === "cellar") {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(8, 0.12, 1.2), this._mat(0x6d4c41, 0.7));
      bench.position.set(cx, cy + 0.95, cz - d * 0.28);
      group.add(bench);
    }
    if (room.id === "study") {
      const desk = new THREE.Mesh(new THREE.BoxGeometry(7, 0.12, 1.4), this._mat(0x3e2723, 0.65));
      desk.position.set(cx, cy + 0.95, cz + d * 0.25);
      group.add(desk);
    }
    if (room.id === "music") {
      // Sideboard along wall
      const board = new THREE.Mesh(new THREE.BoxGeometry(10, 0.9, 0.5), this._mat(0x4a148c, 0.6, 0.2));
      board.position.set(cx, cy + 0.45, cz + d / 2 - 0.5);
      group.add(board);
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
    const count = horizontal ? Math.max(1, Math.floor(sx / 6)) : Math.max(1, Math.floor(sz / 6));
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1) - 0.5) * 0.7;
      const wx = horizontal ? px + t * sx : px;
      const wz = horizontal ? pz : pz + t * sz;
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 1.4 : 0.12, 1.8, horizontal ? 0.12 : 1.4),
        this._mat(p.trim, 0.4, 0.4)
      );
      frame.position.set(wx, floorY + 2.0, wz);
      group.add(frame);
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 1.1 : 0.06, 1.5, horizontal ? 0.06 : 1.1),
        new THREE.MeshStandardMaterial({
          color: p.light,
          emissive: p.light,
          emissiveIntensity: 0.7,
          roughness: 0.4,
          transparent: true,
          opacity: 0.7,
        })
      );
      glow.position.set(wx, floorY + 2.0, wz);
      group.add(glow);
      const pl = new THREE.PointLight(p.light, 4.5, 9, 2);
      pl.position.set(wx, floorY + 2.0, wz);
      group.add(pl);
    }
  }

  _addChandelier(group, x, y, z, color) {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8),
      this._mat(color, 0.3, 0.7)
    );
    stem.position.set(x, y, z);
    group.add(stem);
    const bowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 10),
      new THREE.MeshStandardMaterial({
        color: 0xffe0b2,
        emissive: 0xffcc80,
        emissiveIntensity: 0.7,
        roughness: 0.3,
        metalness: 0.2,
      })
    );
    bowl.position.set(x, y - 0.25, z);
    group.add(bowl);
    const light = new THREE.PointLight(0xffe0b2, 10, 12, 2);
    light.position.set(x, y - 0.25, z);
    group.add(light);
  }

  _addSconces(group, room, p) {
    const [w, h, d] = room.size;
    const [cx, cy, cz] = room.pos;
    const spots = [
      [cx - w * 0.35, cy + 2.2, cz - d * 0.35],
      [cx + w * 0.35, cy + 2.2, cz + d * 0.35],
    ];
    for (const [x, y, z] of spots) {
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.25, 0.08),
        this._mat(p.trim, 0.35, 0.55)
      );
      plate.position.set(x, y, z);
      group.add(plate);
      const bulb = new THREE.PointLight(p.light, 3.5, 7, 2);
      bulb.position.set(x, y, z);
      group.add(bulb);
    }
  }

  _addDecor(group, room, p) {
    const [w, , d] = room.size;
    const [cx, cy, cz] = room.pos;
    for (let i = 0; i < 2; i++) {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.9, 0.06),
        this._mat(p.trim, 0.4, 0.5)
      );
      const canvas = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.7, 0.04),
        this._mat([0x8d6e63, 0x5d4037, 0x1a237e, 0x4a148c][i % 4], 0.7)
      );
      const x = cx + (i === 0 ? -w * 0.25 : w * 0.25);
      const z = cz - d / 2 + 0.2;
      frame.position.set(x, cy + 2.3, z);
      canvas.position.set(x, cy + 2.3, z + 0.02);
      group.add(frame, canvas);
    }
    if (room.id === "library_hall" || room.id === "study" || room.id === "cabinet") {
      const shelf = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 2.4, 0.45),
        this._mat(0x5d4037, 0.7)
      );
      shelf.position.set(cx - w / 2 + 1.3, cy + 1.2, cz);
      group.add(shelf);
      for (let r = 0; r < 4; r++) {
        for (let b = 0; b < 5; b++) {
          const book = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.35, 0.28),
            this._mat([0xb71c1c, 0x1a237e, 0x33691e, 0xf9a825, 0x4a148c][b], 0.65)
          );
          book.position.set(cx - w / 2 + 1.3 - 0.8 + b * 0.35, cy + 0.4 + r * 0.5, cz + 0.05);
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
      landing: { north: true },
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
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? doorW + 0.3 : thick + 0.15, 0.2, horizontal ? thick + 0.15 : doorW + 0.3),
      this._mat(trimColor || 0xc9a227, 0.35, 0.6)
    );
    const floorY = py - sy / 2;
    lintel.position.set(px, floorY + doorH + 0.05, pz);
    group.add(lintel);
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
      step.receiveShadow = true;
      g.add(step);
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

  getFloorY(x, z) {
    let best = null;
    let bestPri = -1;
    for (const r of this.ramps) {
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        let t = 0;
        if (r.dir === "north") t = (r.z0 - z) / r.length;
        else if (r.dir === "south") t = (z - r.z0) / r.length;
        else if (r.dir === "east") t = (x - r.x0) / r.length;
        else t = (r.x0 - x) / r.length;
        t = Math.max(0, Math.min(1, t));
        const y = r.fromY + (r.toY - r.fromY) * t;
        if (r.priority >= bestPri) {
          bestPri = r.priority;
          best = y;
        }
      }
    }
    if (best != null) return best;

    for (const f of this.floorRegions) {
      if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) {
        if (f.priority >= bestPri) {
          bestPri = f.priority;
          best = f.y;
        }
      }
    }
    return best ?? 0;
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
    return best;
  }

  getInteractives() {
    return this.interactives;
  }

  getColliders() {
    return this.colliders;
  }
}
