import * as THREE from "three";
import { ROOMS } from "./data/rooms.js";
import { OBJECTS } from "./data/objects.js";
import { buildLayerShells, buildPedestal } from "./meshes.js";

export class Mansion {
  constructor(scene) {
    this.scene = scene;
    this.interactives = [];
    this.colliders = [];
    this.roomLabels = [];
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
    for (const room of Object.values(ROOMS)) {
      this._buildRoom(room);
    }
    this._connectHalls();
  }

  _buildRoom(room) {
    const [w, h, d] = room.size;
    const [cx, cy, cz] = room.pos;
    const p = room.palette;
    const g = new THREE.Group();
    g.name = room.id;

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.2, d),
      this._mat(p.floor, 0.85, 0.02)
    );
    floor.position.set(cx, cy - 0.1, cz);
    floor.receiveShadow = true;
    g.add(floor);

    const ceil = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.15, d),
      this._mat(0x1a1410, 0.9)
    );
    ceil.position.set(cx, cy + h, cz);
    g.add(ceil);

    const wallH = h;
    const thick = 0.25;
    const walls = [
      { size: [w, wallH, thick], pos: [cx, cy + wallH / 2, cz - d / 2] },
      { size: [w, wallH, thick], pos: [cx, cy + wallH / 2, cz + d / 2] },
      { size: [thick, wallH, d], pos: [cx - w / 2, cy + wallH / 2, cz] },
      { size: [thick, wallH, d], pos: [cx + w / 2, cy + wallH / 2, cz] },
    ];

    // Door gaps: punch openings toward hallway connections by skipping full walls
    // and adding wall segments with openings instead — simplified: open doorways
    const doorways = this._doorwaysFor(room);

    for (let i = 0; i < walls.length; i++) {
      const side = ["north", "south", "west", "east"][i];
      if (doorways[side]) {
        this._addWallWithDoor(g, walls[i], doorways[side], p.wall, thick);
      } else {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(...walls[i].size),
          this._mat(p.wall, 0.8)
        );
        mesh.position.set(...walls[i].pos);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        g.add(mesh);
        const half = new THREE.Vector3(walls[i].size[0] / 2, walls[i].size[1] / 2, walls[i].size[2] / 2);
        const box = new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(...walls[i].pos),
          new THREE.Vector3(...walls[i].size)
        );
        this.colliders.push(box);
      }
    }

    // Museum spotlight
    const spot = new THREE.SpotLight(p.light, 35, 18, Math.PI / 4, 0.45, 1.5);
    spot.position.set(cx, cy + h - 0.4, cz);
    spot.target.position.set(cx, cy, cz);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    g.add(spot, spot.target);

    const amb = new THREE.PointLight(p.light, 8, 14, 2);
    amb.position.set(cx, cy + 2.2, cz);
    g.add(amb);

    // Trim molding
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.2, 0.08, d - 0.2),
      this._mat(p.trim, 0.4, 0.55)
    );
    trim.position.set(cx, cy + 0.05, cz);
    g.add(trim);

    if (room.objects) {
      for (const place of room.objects) {
        const def = OBJECTS[place.id];
        if (!def) continue;
        const pedestal = buildPedestal(p.trim);
        const [px, py, pz] = place.pos;
        pedestal.position.set(px, 0, pz);
        g.add(pedestal);

        const obj = buildLayerShells(def);
        const yOff = def.monument ? 0.5 : 1.05;
        obj.position.set(px, yOff, pz);
        if (def.monument) obj.scale.multiplyScalar(1.1);
        obj.userData.interactable = true;
        obj.userData.objectId = def.id;
        g.add(obj);
        this.interactives.push(obj);

        // Invisible hit sphere for easier targeting
        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(def.monument ? 1.8 : 0.7, 8, 8),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        hit.position.copy(obj.position);
        hit.userData.interactable = true;
        hit.userData.objectId = def.id;
        hit.userData.target = obj;
        g.add(hit);
        this.interactives.push(hit);
      }
    }

    this.root.add(g);
  }

  _doorwaysFor(room) {
    // Map exits to wall sides based on room layout
    const map = {};
    const exits = room.exits || {};
    // Approximate: rooms open toward hallway center (0,-12)
    if (room.id === "foyer") map.north = true;
    if (room.id === "hallway") {
      map.south = true;
      map.west = true;
      map.east = true;
      map.north = true;
    }
    if (room.id === "cabinet") map.east = true;
    if (room.id === "armoury") map.west = true;
    if (room.id === "conservatory") {
      map.south = true;
      map.west = true;
      map.east = true;
    }
    if (room.id === "workshop") map.east = true;
    if (room.id === "music") map.west = true;
    return map;
  }

  _addWallWithDoor(group, wall, _open, color, thick) {
    // Split wall into two side panels leaving a 2.2m door in the middle
    const [sx, sy, sz] = wall.size;
    const [px, py, pz] = wall.pos;
    const doorW = 2.2;
    const horizontal = sx > sz;
    if (horizontal) {
      const remain = (sx - doorW) / 2;
      for (const sign of [-1, 1]) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(remain, sy, sz),
          this._mat(color, 0.8)
        );
        mesh.position.set(px + sign * (doorW / 2 + remain / 2), py, pz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        this.colliders.push(
          new THREE.Box3().setFromCenterAndSize(
            mesh.position.clone(),
            new THREE.Vector3(remain, sy, sz)
          )
        );
      }
    } else {
      const remain = (sz - doorW) / 2;
      for (const sign of [-1, 1]) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(sx, sy, remain),
          this._mat(color, 0.8)
        );
        mesh.position.set(px, py, pz + sign * (doorW / 2 + remain / 2));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        this.colliders.push(
          new THREE.Box3().setFromCenterAndSize(
            mesh.position.clone(),
            new THREE.Vector3(sx, sy, remain)
          )
        );
      }
    }
    // Door lintel
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? doorW : sx, 0.35, horizontal ? sz : doorW),
      this._mat(0xc9a227, 0.35, 0.6)
    );
    lintel.position.set(px, py + sy / 2 - 0.25, pz);
    group.add(lintel);
  }

  _connectHalls() {
    // Soft fill floors between rooms already covered by room floors overlapping hallway
  }

  getInteractives() {
    return this.interactives;
  }

  getColliders() {
    return this.colliders;
  }
}
