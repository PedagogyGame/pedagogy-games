import * as THREE from "three";
import { ROOMS } from "./data/rooms.js?v=logic32";
import { OBJECTS } from "./data/objects.js?v=logic32";
import { buildLayerShells, buildPedestal } from "./meshes.js?v=logic32";
import { LOFT_AUTO_PORTALS, CHANDELIER, CONVEYOR, ROOF_LIFT, FOUNTAIN } from "./data/loftNet.js?v=logic32";
import { TRACK_PATHS } from "./data/tracks.js?v=logic32";
import { buildLabGarage } from "./labGarage.js?v=logic32";

// logic6: attic_up stairwell (landing ceiling + attic floor). Stair footprint x -3.05..-1.75.
const ATTIC_STAIRWELL = { minX: -3.10, maxX: -1.70, minZ: 1.70, maxZ: 4.70 };

export class Mansion {
  constructor(scene) {
    this.scene = scene;
    this.interactives = [];
    this.colliders = [];
    this.floorRegions = [];
    this.rugRegions = []; // logic9: rugs / floor frame lips are drivable surfaces (car sits ON them)
    this.ramps = [];
    this.roomLabels = [];
    this.fireflies = null;
    // SwiftShader: minimal PointLights + no spot shadows — Enter first-frame was dying
    this._pointLightBudget = 4;
    this._pointLightsUsed = 0;
    this._shadowSpotsLeft = 0;
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

  /** MeshStandardMaterial that omits null/undefined map (never pass map: null). */
  _stdMat(opts) {
    const o = { ...opts };
    if (o.map == null) delete o.map;
    return new THREE.MeshStandardMaterial(o);
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
    for (let y = 0; y < 256; y += 28) {
      ctx.fillStyle = line;
      ctx.globalAlpha = 0.38;
      ctx.fillRect(0, y, 256, 2);
      ctx.globalAlpha = 0.1;
      ctx.fillRect(0, y + 12, 256, 1);
      // soft polish highlight along plank center
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, y + 6, 256, 4);
      ctx.fillStyle = line;
      // plank end joints
      ctx.globalAlpha = 0.22;
      const ox = ((y / 28) % 2) * 72;
      for (let x = ox; x < 256; x += 144) ctx.fillRect(x, y, 2, 28);
    }
    // subtle grain noise for premium read at stroll distance
    for (let i = 0; i < 220; i++) {
      ctx.globalAlpha = 0.04 + Math.random() * 0.05;
      ctx.fillStyle = Math.random() > 0.5 ? "#fff8e7" : line;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 2);
    }
    ctx.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
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
    // Pattern variety from hex bits — diamond / stripes / medallion dots
    const mode = (centerHex ^ borderHex) % 3;
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    if (mode === 0) {
      ctx.beginPath();
      ctx.moveTo(64, 28); ctx.lineTo(100, 64); ctx.lineTo(64, 100); ctx.lineTo(28, 64);
      ctx.closePath(); ctx.stroke();
    } else if (mode === 1) {
      for (let y = 28; y < 100; y += 10) {
        ctx.globalAlpha = 0.18;
        ctx.fillRect(22, y, 84, 3);
      }
      ctx.globalAlpha = 1;
    } else {
      for (let i = 0; i < 5; i++) {
        const r = 12 + i * 8;
        ctx.beginPath(); ctx.arc(64, 64, r, 0, Math.PI * 2); ctx.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._texCache[key] = tex;
    return tex;
  }

  /** Soft damask / stripe wallpaper tint for room personality (mesh, not lights). */
  _wallpaperTex(hex, accentHex = 0xc9a227) {
    const key = `wallp_${hex}_${accentHex}`;
    if (this._texCache[key]) return this._texCache[key];
    const c = this._makeCanvas(256, 256);
    if (!c) return null;
    const ctx = c.getContext("2d");
    const base = "#" + (hex >>> 0).toString(16).padStart(6, "0");
    const accent = "#" + (accentHex >>> 0).toString(16).padStart(6, "0");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    const mode = hex % 3;
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    if (mode === 0) {
      // damask diamonds
      for (let y = 0; y < 256; y += 48) {
        for (let x = 0; x < 256; x += 48) {
          ctx.globalAlpha = 0.12;
          ctx.beginPath();
          ctx.moveTo(x + 24, y + 6); ctx.lineTo(x + 42, y + 24);
          ctx.lineTo(x + 24, y + 42); ctx.lineTo(x + 6, y + 24);
          ctx.closePath(); ctx.stroke();
        }
      }
    } else if (mode === 1) {
      // vertical stripes
      for (let x = 0; x < 256; x += 28) {
        ctx.globalAlpha = 0.1;
        ctx.fillRect(x, 0, 10, 256);
      }
    } else {
      // small florals
      for (let y = 16; y < 256; y += 40) {
        for (let x = 16; x < 256; x += 40) {
          ctx.globalAlpha = 0.14;
          ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.08;
          ctx.beginPath(); ctx.arc(x + 8, y + 6, 3, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    this._texCache[key] = tex;
    return tex;
  }

  _medallionTex(hex = 0xc9a227) {
    const key = `medal_${hex}`;
    if (this._texCache[key]) return this._texCache[key];
    const c = this._makeCanvas(128, 128);
    if (!c) return null;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#1a1410";
    ctx.fillRect(0, 0, 128, 128);
    const gold = "#" + (hex >>> 0).toString(16).padStart(6, "0");
    ctx.strokeStyle = gold;
    ctx.fillStyle = gold;
    for (const r of [56, 42, 28, 14]) {
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(64, 64, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(64, 64);
      ctx.lineTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
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

  /** Subtle plaster / paint noise for interior walls. */
  _plasterTex(hex) {
    const key = `plaster_${hex}`;
    if (this._texCache[key]) return this._texCache[key];
    const c = this._makeCanvas(256, 256);
    if (!c) return null;
    const ctx = c.getContext("2d");
    const base = "#" + (hex >>> 0).toString(16).padStart(6, "0");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    // fine plaster grain
    for (let i = 0; i < 2800; i++) {
      const v = (Math.random() - 0.5) * 28;
      const r = Math.max(0, Math.min(255, ((hex >> 16) & 255) + v));
      const g = Math.max(0, Math.min(255, ((hex >> 8) & 255) + v));
      const b = Math.max(0, Math.min(255, (hex & 255) + v * 0.85));
      ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},0.22)`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    // soft mottling
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.015 + Math.random() * 0.03})`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * 256, Math.random() * 256, 12 + Math.random() * 30, 8 + Math.random() * 18, Math.random(), 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    this._texCache[key] = tex;
    return tex;
  }

  /** Exterior stone / brick suggestion. */
  _stoneTex() {
    const key = "stone_facade";
    if (this._texCache[key]) return this._texCache[key];
    const c = this._makeCanvas(256, 256);
    if (!c) return null;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#4a3728";
    ctx.fillRect(0, 0, 256, 256);
    const brickH = 22;
    const brickW = 48;
    for (let y = 0, row = 0; y < 256; y += brickH, row++) {
      const ox = (row % 2) * (brickW / 2);
      for (let x = -brickW; x < 256 + brickW; x += brickW) {
        const shade = 55 + Math.random() * 35;
        ctx.fillStyle = `rgb(${shade + 20},${shade},${shade - 8})`;
        ctx.fillRect(x + ox + 1, y + 1, brickW - 2, brickH - 2);
        // mortar
        ctx.fillStyle = "rgba(180,170,150,0.35)";
        ctx.fillRect(x + ox, y, brickW, 1);
        ctx.fillRect(x + ox, y, 1, brickH);
      }
    }
    // stone speckles
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 1);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    this._texCache[key] = tex;
    return tex;
  }

  _wallMat(hex, rough = 0.74, metal = 0.035) {
    const tex = this._plasterTex(hex);
    if (!tex) {
      const m = this._mat(hex, rough, metal);
      m.side = THREE.FrontSide;
      m.depthWrite = true;
      return m;
    }
    const t = tex.clone();
    t.repeat.set(2.0, 2.0);
    return this._stdMat({
      map: t, color: 0xffffff, roughness: rough, metalness: metal,
      side: THREE.FrontSide, depthWrite: true,
    });
  }

  _floorMat(hex, rough = 0.72) {
    const tex = this._plankTex(hex);
    if (!tex) {
      const m = this._mat(hex, rough, 0.06);
      m.side = THREE.FrontSide;
      m.depthWrite = true;
      return m;
    }
    const t = tex.clone();
    t.repeat.set(3.6, 3.6);
    return this._stdMat({
      map: t, color: 0xffffff, roughness: rough, metalness: 0.08,
      side: THREE.FrontSide, depthWrite: true,
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

  _glass(hex = 0xaaddff, opacity = 0.38) {
    return new THREE.MeshStandardMaterial({
      color: hex, roughness: 0.03, metalness: 0.32,
      transparent: true, opacity: Math.min(opacity, 0.4),
      emissive: hex, emissiveIntensity: 0.16,
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
    this._addClimbLandmarks();
    this._buildDoorConnectors();
    this._buildExteriorFacade();
    this._buildBalcony();
    this._buildServiceGalleries(); // logic20: the dark strip between Library Hall and Nursery/Study (Ben t183u)
    this._buildGardenFeatures();
    this._buildFireflies();
    this._declashCoplanar();
    this._buildBookSteps();
    this._buildChandelier(); // logic11 centerpiece (Upper Landing)
    this._settleCurios(); // logic26
    { // logic13: the conservatory west skirting runs inside the dining shell overlap — lift it a hair
      // (now in view from the Green-Wall Road; zfight-scan)
      const cons = this.root.getObjectByName && this.root.getObjectByName("conservatory");
      const bb = new THREE.Box3();
      if (cons) { cons.updateMatrixWorld(true); cons.traverse((o) => { if (!o.isMesh || o.isInstancedMesh) return; bb.setFromObject(o); if (bb.max.x < -10.6 && bb.min.x > -11.2 && bb.max.y < 1.5 && bb.max.y - bb.min.y < 0.7) o.position.y += 0.0016; }); }
    }
  }

  /** logic26 audit: curios whose stand sits inside a room's own workbench / desk / case were buried in it.
   *  Lift each onto the highest furniture top under its footprint (≤ 0.75 m up), with its hit proxy + glow ring. */
  _settleCurios() {
    const bb = new THREE.Box3();
    for (const obj of this.interactives) {
      if (obj.userData.target || obj.userData.supportY == null) continue;
      obj.updateMatrixWorld(true); bb.setFromObject(obj);
      let top = -Infinity;
      for (const c of this.colliders) {
        if (c.driveKind !== "furniture") continue;
        if (c.max.x < bb.min.x + 0.02 || c.min.x > bb.max.x - 0.02 || c.max.z < bb.min.z + 0.02 || c.min.z > bb.max.z - 0.02) continue;
        if (c.max.y > bb.min.y + 0.005 && c.max.y < bb.min.y + 0.75 && c.min.y < bb.min.y + 0.05) top = Math.max(top, c.max.y);
      }
      if (top === -Infinity) continue;
      const dy = top + 0.004 - bb.min.y;
      obj.position.y += dy; obj.userData.supportY = top;
      if (obj.userData.hitProxy) obj.userData.hitProxy.position.y += dy;
      if (obj.userData.accent) obj.userData.accent.position.y = top + 0.003;
    }
  }

  /** logic11 free-roam playground: every low piece of furniture (tables, desks, beds, benches…)
   *  gets a little staircase of stacked books against one clear side, each book a kerb-high step
   *  (≤4.5 cm, under the car's 5.6 cm step-up) — so the toy car can climb onto and drive over it.
   *  One InstancedMesh (1 draw call). DriveWorld registers furnitureTops + bookSteps as surfaces. */
  /** logic11 CHANDELIER — brass frame merged into 1 mesh, crystals + candle flames instanced
   *  (MeshBasic = self-lit, no lights). Hangs on 3 chains clear of the lift pad above it. */
  _buildChandelier() {
    const C = CHANDELIER, cx = C.cx, cz = C.cz;
    const merge = (list) => {
      const pos = [], nor = [];
      for (const [geo, m] of list) {
        const g = geo.index ? geo.toNonIndexed() : geo; g.applyMatrix4(m);
        pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
      return out;
    };
    const M = (x, y, z, rx = 0) => new THREE.Matrix4().makeRotationX(rx).setPosition(x, y, z);
    const parts = [];
    parts.push([new THREE.CylinderGeometry(0.05, 0.08, 1.15, 12), M(cx, 6.6, cz)]);          // stem
    parts.push([new THREE.SphereGeometry(0.11, 14, 10), M(cx, 6.25, cz)]);                    // knop
    parts.push([new THREE.ConeGeometry(0.07, 0.25, 12), M(cx, 5.75, cz, Math.PI)]);           // finial
    parts.push([new THREE.CylinderGeometry(0.3, 0.16, 0.08, 16), M(cx, 7.22, cz)]);           // crown
    const tiers = [[6.0, 0.38, 12], [6.5, 0.3, 10], [6.95, 0.2, 8]];
    for (const [y, r] of tiers) {
      parts.push([new THREE.TorusGeometry(r, 0.014, 6, 32), M(cx, y, cz, Math.PI / 2)]);
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; const arm = new THREE.CylinderGeometry(0.008, 0.008, r, 4); arm.rotateZ(Math.PI / 2); arm.rotateY(-a); parts.push([arm, M(cx + Math.cos(a) * r / 2, y + 0.02, cz + Math.sin(a) * r / 2)]); }
    }
    for (const [dx, dz] of [[-0.25, -0.2], [0.25, -0.2], [0, -0.3]]) {                     // chains up to the ceiling
      const x = cx + dx, z = cz + dz, y0 = 7.24, y1 = 8.2, len = Math.hypot(y1 - y0, dx * 0.2);
      parts.push([new THREE.CylinderGeometry(0.007, 0.007, len, 4), M(x, (y0 + y1) / 2, z)]);
      parts.push([new THREE.CylinderGeometry(0.045, 0.06, 0.03, 10), M(x, 8.185, z)]);       // ceiling rose
    }
    { // logic12: Explore sees a closed wooden hatch over the hidden lift shaft (hidden in Drive)
      const b = CONVEYOR.shaft, hatch = new THREE.Group(); hatch.name = "attic_hatch"; hatch.userData.noBatch = true;
      const wood = new THREE.MeshLambertMaterial({ color: 0x5a3a24 }), iron = new THREE.MeshLambertMaterial({ color: 0x2a2622 });
      const lid = new THREE.Mesh(new THREE.BoxGeometry(b.maxX - b.minX + 0.08, 0.03, b.maxZ - b.minZ + 0.08), wood); lid.position.set((b.minX + b.maxX) / 2, 8.4 + 0.016, (b.minZ + b.maxZ) / 2);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 16), iron); ring.rotation.x = Math.PI / 2; ring.position.set(lid.position.x, 8.4 + 0.034, lid.position.z);
      const under = new THREE.Mesh(new THREE.BoxGeometry(b.maxX - b.minX + 0.08, 0.03, b.maxZ - b.minZ + 0.08), wood); under.position.set(lid.position.x, 8.2 - 0.016, lid.position.z); // landing-ceiling side
      hatch.add(lid, ring, under); this.root.add(hatch);
    }
    const frame = new THREE.Mesh(merge(parts), new THREE.MeshLambertMaterial({ color: 0xc9a043, emissive: 0x3a2a08 }));
    frame.name = "chandelier_frame"; this.root.add(frame);
    const cr = [], fl = [];
    for (const [y, r, n] of tiers) {
      for (let k = 0; k < n * 2; k++) { const a = k * Math.PI / n; cr.push([cx + Math.cos(a) * r, y - 0.09 - (k % 2) * 0.05, cz + Math.sin(a) * r, 0.022 + (k % 2) * 0.008]); }
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; fl.push([cx + Math.cos(a) * r, y + 0.07, cz + Math.sin(a) * r, 0.018]); }
    }
    for (let k = 0; k < 18; k++) { const a = k * 2.4, rr = 0.06 + (k % 6) * 0.045; cr.push([cx + Math.cos(a) * rr, 5.85 + (k % 6) * 0.06, cz + Math.sin(a) * rr, 0.03]); }
    const inst = (geo, mat, L, name, sy = 1.8) => {
      const im = new THREE.InstancedMesh(geo, mat, L.length), m = new THREE.Matrix4();
      L.forEach(([x, y, z, sc], i) => { m.makeScale(sc, sc * sy, sc).setPosition(x, y, z); im.setMatrixAt(i, m); });
      im.name = name; this.root.add(im); return im;
    };
    inst(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xdff3ff, transparent: true, opacity: 0.85 }), cr, "chandelier_crystals", 2.2);
    inst(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd27a }), fl, "chandelier_flames", 1.6);
    // candle sleeves (white) under each flame
    inst(new THREE.CylinderGeometry(0.5, 0.5, 1, 6), new THREE.MeshLambertMaterial({ color: 0xf4efe2 }), fl.map(([x, y, z]) => [x, y - 0.035, z, 0.022]), "chandelier_candles", 2.4);
  }

  _buildBookSteps() {
    this.bookSteps = []; this.furnitureTops = []; this.bookStairs = [];
    const cols = this.colliders.filter((c) => c.driveKind === "furniture");
    const floorAt = (x, z, y) => {
      let best = null;
      for (const f of this.floorRegions) if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ && f.y <= y + 0.05 && (best == null || f.y > best)) best = f.y;
      return best;
    };
    const free = (x0, x1, z0, z1, y0, y1, self) => !this.colliders.some((c) => c !== self && c.max.x > x0 && c.min.x < x1 && c.max.z > z0 && c.min.z < z1 && c.max.y > y0 && c.min.y < y1);
    const segs = [];
    for (const tp of TRACK_PATHS) { const P = tp.points || []; for (let i = 1; i < P.length; i++) segs.push([P[i - 1], P[i]]); }
    const nearTrack = (x0, x1, z0, z1, y0, y1) => segs.some(([a, b]) => {
      const nS = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1));
      for (let k = 0; k <= nS; k++) { const t = k / nS;
        const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
        if (x > x0 && x < x1 && z > z0 && z < z1 && y > y0 && y < y1) return true;
      }
      return false;
    });
    const perRoom = new Map();
    for (const c of cols) {
      const cx = (c.min.x + c.max.x) / 2, cz = (c.min.z + c.max.z) / 2;
      const fy = floorAt(cx, cz, c.min.y);
      if (fy == null) continue;
      const h = c.max.y - fy, w = c.max.x - c.min.x, d = c.max.z - c.min.z;
      if (h < 0.12 || h > (c.min.y - fy > 0.3 && cx < -12 && cz < -23 && fy < 0.5 ? 1.4 : 1.05) || w < 0.25 || d < 0.25) continue; // logic11: raised table tops (dining table run) up to 1.4
      this.furnitureTops.push({ minX: c.min.x, maxX: c.max.x, minZ: c.min.z, maxZ: c.max.z, y: c.max.y, base: fy });
      const key = Math.round(cx / 6) + "," + Math.round(cz / 6) + "," + Math.round(fy);
      const cur = perRoom.get(key);
      if (!cur || w * d > cur.w * cur.d) perRoom.set(key, { c, fy, h, w, d });
    }
    const RISE = 0.045, RUN = 0.09, SW = 0.16;
    const inst = [];
    for (const { c, fy, h } of perRoom.values()) {
      const n = Math.ceil((h - 0.01) / RISE);
      const len = n * RUN + 0.11;
      const cx = (c.min.x + c.max.x) / 2, cz = (c.min.z + c.max.z) / 2;
      const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [sx, sz] of sides) {
        const ox = sx > 0 ? c.max.x : sx < 0 ? c.min.x : cx, oz = sz > 0 ? c.max.z : sz < 0 ? c.min.z : cz;
        const x0 = sx ? (sx > 0 ? ox : ox - len) : ox - SW / 2, x1 = sx ? (sx > 0 ? ox + len : ox) : ox + SW / 2;
        const z0 = sz ? (sz > 0 ? oz : oz - len) : oz - SW / 2, z1 = sz ? (sz > 0 ? oz + len : oz) : oz + SW / 2;
        // stair footprint + a 0.45 run-up beyond its foot must be clear of every solid
        const rx0 = Math.min(x0, sx < 0 ? x0 - 0.45 : x0), rx1 = Math.max(x1, sx > 0 ? x1 + 0.45 : x1);
        const rz0 = Math.min(z0, sz < 0 ? z0 - 0.45 : z0), rz1 = Math.max(z1, sz > 0 ? z1 + 0.45 : z1);
        if (!free(rx0 - 0.1, rx1 + 0.1, rz0 - 0.1, rz1 + 0.1, fy + 0.005, fy + h + 0.15, c)) continue;
        if (nearTrack(rx0 - 0.5, rx1 + 0.5, rz0 - 0.5, rz1 + 0.5, fy - 0.1, fy + h + 0.4)) continue; // never on a road
        if (floorAt(x0, z0, fy) !== fy || floorAt(x1, z1, fy) !== fy) continue;
        this.bookStairs.push({ x: sx ? ox + sx * (len + 0.25) : ox, z: sz ? oz + sz * (len + 0.25) : oz, yaw: Math.atan2(-sx, -sz), floorY: fy, topY: c.max.y, cx, cz });
        for (let k = 0; k < n; k++) {
          const top = Math.min(c.max.y - 0.004, fy + RISE * (n - k)); // step k=0 touches the furniture
          const a = k ? 0.11 + k * RUN : 0, b = 0.11 + (k + 1) * RUN; // top landing 0.2 deep
          const bx0 = sx > 0 ? ox + a : sx < 0 ? ox - b : x0, bx1 = sx > 0 ? ox + b : sx < 0 ? ox - a : x1;
          const bz0 = sz > 0 ? oz + a : sz < 0 ? oz - b : z0, bz1 = sz > 0 ? oz + b : sz < 0 ? oz - a : z1;
          this.bookSteps.push({ minX: bx0, maxX: bx1, minZ: bz0, maxZ: bz1, y: top, base: fy });
          inst.push([bx0, bx1, bz0, bz1, fy, top]);
        }
        break;
      }
    }
    if (!inst.length) return;
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, inst.length);
    const m = new THREE.Matrix4(), col = new THREE.Color();
    const spines = [0x7a2e2a, 0x2f4a3a, 0x3a3f6a, 0x8a6a34, 0x5a3a5a, 0x6b4a2e];
    inst.forEach(([x0, x1, z0, z1, y0, y1], i) => {
      m.makeScale(x1 - x0 - 0.004, y1 - y0, z1 - z0 - 0.004).setPosition((x0 + x1) / 2, (y0 + y1) / 2 + 0.0005, (z0 + z1) / 2);
      im.setMatrixAt(i, m); im.setColorAt(i, col.setHex(spines[i % spines.length]));
    });
    im.name = "book_steps";
    this.root.add(im);
  }

  /** logic10: shared walls / stacked slabs between neighbouring rooms were built as coplanar
   *  boxes (two rooms each own the wall between them) → depth-fight shimmer + dark stray lines.
   *  Nudge every structural box a hair (0.5–3 mm, unique per room/mesh) along its thin axis.
   *  Visual only — colliders/floor regions are untouched. Slabs only ever move DOWN. */
  _declashCoplanar() {
    // every structural box shrinks by its own 0.4–2.4 mm per face (unique per room/mesh), so no two
    // boxes ever share a face plane (tops, ends, faces); centres stay put, physics untouched.
    this.root.children.forEach((g, gi) => {
      let mi = 0;
      g.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || !o.geometry) return;
        if (o.geometry.type !== "BoxGeometry") return;
        const pr = o.geometry.parameters;
        const dims = [pr.width * o.scale.x, pr.height * o.scale.y, pr.depth * o.scale.z];
        if (Math.min(...dims) < 0.05 || Math.max(...dims) < 0.5) return; // trims / decor keep their exact size
        const n = gi * 7 + mi++;
        const k = 0.0003 + 0.0021 * (Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1);
        // + a stable per-mesh depth bias (8 bins): exact-coplanar leftovers resolve the same way every frame
        const bin = n % 8;
        if (bin && o.material && !Array.isArray(o.material)) {
          const cache = (this._biasMats ||= new Map());
          const key = o.material.uuid + ":" + bin;
          let m = cache.get(key);
          if (!m) { m = o.material.clone(); m.polygonOffset = true; m.polygonOffsetFactor = -0.15 * bin; m.polygonOffsetUnits = -bin; cache.set(key, m); }
          o.material = m;
        }
        o.scale.x *= (dims[0] - 2 * k) / dims[0];
        o.scale.y *= (dims[1] - 2 * k) / dims[1];
        o.scale.z *= (dims[2] - 2 * k) / dims[2];
      });
    });
  }

  // ─── Estate lawn, drive, paths, boundary ─────────────────────────
  _buildEstateGrounds() {
    const g = new THREE.Group();
    g.name = "estate_grounds";

    // Deep green lawn (large)
    const lawn = new THREE.Mesh(
      new THREE.CircleGeometry(72, 64),
      this._mat(0x1f2f1a, 0.97, 0) // logic17: darker, realer turf (was 0x2d5a27)
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
      new THREE.BoxGeometry(8, 0.004, 30),
      this._mat(0x7a7368, 0.9, 0.05)
    );
    drive.position.set(0, 0.0, 28); // logic10: skin, top 0.002
    drive.name = "gravel_drive";
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
      // logic10: thin flagstone skin (top 0.008) — car + garden road ride on its true top
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.006, p.d), pathMat);
      mesh.position.set(p.x, 0.005, p.z);
      mesh.name = "outdoor_path";
      mesh.receiveShadow = true;
      g.add(mesh);
    }

    // Global outdoor floor so player never falls off near house
    this.floorRegions.push({
      minX: -72, maxX: 72, minZ: -72, maxZ: 72, // logic20: covers the whole lawn disc (r 72), was ±70
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
      // Hard pillar — never soft-shrink / never climb-pierce
      this._pushCollider(
        new THREE.Box3(
          new THREE.Vector3(sx - 0.38, 0.0, gateZ - 0.38),
          new THREE.Vector3(sx + 0.38, 3.2, gateZ + 0.38)
        ),
        "pillar"
      );
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
    const stoneTex = this._stoneTex();
    const stone = stoneTex
      ? this._stdMat({
          map: (() => { const t = stoneTex.clone(); t.repeat.set(3, 4); return t; })(),
          color: 0xffffff, roughness: 0.88, metalness: 0.06,
        })
      : this._mat(0x4a3728, 0.85, 0.05);
    const trim = this._mat(0xc9a227, 0.35, 0.55);
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
      } else if (wall.pos[0] === -26.5) {
        // logic13 GREEN-WALL ROAD: an ivy-framed toy-car arch through the west shell at z −24.7
        // (Breakfast Parlor road out to the garden). Wall = 3 boxes (south / north / lintel).
        const z0 = -25.45, z1 = -23.95, top = 0.95, x = wall.pos[0], t = wall.size[0];
        const zA = wall.pos[2] - wall.size[2] / 2, zB = wall.pos[2] + wall.size[2] / 2;
        const parts = [
          { c: [x, facadeH / 2, (zA + z0) / 2], sz: [t, facadeH, z0 - zA] },
          { c: [x, facadeH / 2, (z1 + zB) / 2], sz: [t, facadeH, zB - z1] },
          { c: [x, (top + facadeH) / 2, (z0 + z1) / 2], sz: [t, facadeH - top, z1 - z0] },
        ];
        for (const q of parts) {
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(...q.sz), stone);
          mesh.position.set(...q.c); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
          this.colliders.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...q.c), new THREE.Vector3(...q.sz)));
        }
        const ivy = this._mat(0x2f6b2a, 0.95, 0.0);
        for (const [cx, cy, cz, sx, sy, sz] of [[x, top + 0.06, -24.7, t + 0.12, 0.12, 1.74], [x, top / 2, z0 - 0.06, t + 0.12, top + 0.12, 0.12], [x, top / 2, z1 + 0.06, t + 0.12, top + 0.12, 0.12],
          [x - 0.25, 1.6, -24.7, 0.06, 1.4, 2.6], [x + 0.25, 1.6, -24.7, 0.06, 1.4, 2.6]]) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), ivy); m.position.set(cx, cy, cz); g.add(m);
        }
        this._addExteriorWindows(g, wall);
      } else if (wall.pos[0] === 26.5) {
        // logic18 GUTTER: full-height vertical slot down the east shell for the straight plunge chute
        // (timber attic → lawn). Slot spans gutter + flat entry lip. Soft trough lives in the opening.
        const z0 = -16.25, z1 = 0.2, x = wall.pos[0], t = wall.size[0];
        const zA = wall.pos[2] - wall.size[2] / 2, zB = wall.pos[2] + wall.size[2] / 2;
        const parts = [
          { c: [x, facadeH / 2, (zA + z0) / 2], sz: [t, facadeH, z0 - zA] },
          { c: [x, facadeH / 2, (z1 + zB) / 2], sz: [t, facadeH, zB - z1] },
        ];
        for (const q of parts) {
          if (q.sz[2] <= 0.01) continue;
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(...q.sz), stone);
          mesh.position.set(...q.c); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
          this.colliders.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...q.c), new THREE.Vector3(...q.sz)));
        }
        // gunmetal lip trim on the slot edges (visual only)
        const lip = this._mat(0x3a4248, 0.55, 0.35);
        for (const [cz, sy] of [[z0, facadeH], [z1, facadeH]]) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(t + 0.08, sy, 0.08), lip);
          m.position.set(x, facadeH / 2, cz); g.add(m);
        }
        this._addExteriorWindows(g, wall);
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
    { // logic26 (Ben "you drive right through it"): the peak's four faces are now the drivable floor over the roof-deck
      // hole (DriveWorld.surfacesAt roof-peak term). Thin solid collar round the roof-lift shaft where it pierces the face.
      const S = ROOF_LIFT.shaft, t = 0.05, y0 = 12.3, y1 = 13.2;
      for (const [a0, a1, b0, b1] of [[S.minX - t, S.maxX + t, S.minZ - t, S.minZ], [S.minX - t, S.maxX + t, S.maxZ, S.maxZ + t], [S.minX - t, S.minX, S.minZ, S.maxZ], [S.maxX, S.maxX + t, S.minZ, S.maxZ]])
        this._pushCollider(new THREE.Box3(new THREE.Vector3(a0, y0, b0), new THREE.Vector3(a1, y1, b1)), "wall");
      // kerbs on the roof deck along the Roof Slope Run cutting (where the road has dropped > 6 cm below the deck)
      const kerbM = this._mat(0x1b1f2a, 0.6, 0.3);
      for (const zc of [-8.575, -7.425]) {
        const k = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.05), kerbM); k.position.set(10.1, 11.979 + 0.03, zc); g.add(k);
        this._pushCollider(new THREE.Box3(new THREE.Vector3(8.9, 11.97, zc - 0.025), new THREE.Vector3(11.3, 12.06, zc + 0.025)), "wall");
      }
    }

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
        // Deep stone sill + frame trim
        const sill = new THREE.Mesh(
          new THREE.BoxGeometry(horizontal ? 1.55 : 0.28, 0.12, horizontal ? 0.32 : 1.55),
          this._mat(0xd7ccc8, 0.7, 0.15)
        );
        sill.position.set(wx, fy - 0.95, wz + (horizontal ? 0.08 : 0));
        group.add(sill);
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(horizontal ? 1.45 : 0.28, 1.85, horizontal ? 0.28 : 1.45),
          this._mat(0xc9a227, 0.32, 0.62)
        );
        frame.position.set(wx, fy, wz);
        group.add(frame);
        // Outer molding depth
        const mold = new THREE.Mesh(
          new THREE.BoxGeometry(horizontal ? 1.6 : 0.12, 2.0, horizontal ? 0.12 : 1.6),
          this._mat(0x5d4037, 0.55, 0.2)
        );
        mold.position.set(wx, fy, wz);
        group.add(mold);
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
    // logic19: the carriage-house nook became the backyard LAB GARAGE (drivable chemistry workshop)
    this.labGarage = buildLabGarage(g, (box, kind) => this._pushCollider(box, kind));

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
      if (i === 9) continue; // logic26: this bush stood in the Rose Walk Kicker's run-up (-28, 3) — car drove through it
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
      // [0,12] was INSIDE foyer south strip — looked like central pillar in Drive spawn cone
      [0, 20], [0, 18], [0, -16], [0, -36], [0, -48],
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

    // Stepping stones toward pond + orchard crate stacks (edge of paths)
    for (const [x, z] of [[12, -40], [16, -42], [20, -44], [14, -46]]) {
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.12, 8), this._mat(0x9e9e9e, 0.85));
      stone.position.set(x, -0.01, z); // logic20: set into the turf (top 0.05) and a real rug-like surface —
      g.add(stone);                    // the car used to drive THROUGH the 12 cm stones (no surface/collider)
      this.rugRegions.push({ minX: x - 0.42, maxX: x + 0.42, minZ: z - 0.42, maxZ: z + 0.42, y: 0.05, roomId: "pond", kind: "rug" });
    }
    for (const [x, z] of [[-38, -36], [-20, -48]]) {
      for (let i = 0; i < 2; i++) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.65), this._wood(0x8d6e63));
        crate.position.set(x, 0.22 + i * 0.48, z + i * 0.1);
        g.add(crate);
      }
    }
    // Pond reeds cluster (extra)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const reed = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.04, 0.9, 5),
        this._mat(0x558b2f, 0.9)
      );
      reed.position.set(26 + Math.cos(a) * 4.5, 0.45, -46 + Math.sin(a) * 4.5);
      g.add(reed);
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
    // logic20: the stone rim is solid (ring of small blocks). Before, the car rolled through the torus and
    // drove along the pond floor 12 cm UNDER the water surface.
    for (let i = 0; i < 56; i++) {
      const a = (i / 56) * Math.PI * 2, px = x + Math.cos(a) * 4.2, pz = z + Math.sin(a) * 4.2;
      this._pushCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(px, y + 0.25, pz), new THREE.Vector3(0.5, 0.5, 0.5)), "wall");
    }
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
    // Hard pillar post — Drive must bounce (never soft-raise under car height)
    this._pushCollider(
      new THREE.Box3(
        new THREE.Vector3(x - 0.16, 0.0, z - 0.16),
        new THREE.Vector3(x + 0.16, 2.35, z + 0.16)
      ),
      "pillar"
    );
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
      new THREE.BoxGeometry(w * 0.92, 0.004, d * 0.92),
      this._mat(p.floor, 0.95, 0)
    );
    // logic10: a skin, not a slab — top at cy+0.004 so roads (ride 0.012) and rugs sit ON it
    tint.position.set(cx, cy + 0.003, cz); // top cy+0.005
    tint.name = "zone_tint";
    tint.receiveShadow = true;
    g.add(tint);

    // Outdoor zones rely on moon/hemi — skip PointLights (perf)
    this._addOutdoorZoneDetail(g, room, p);

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
    const floorMat = isAttic ? this._mat(p.floor, 0.88, 0.02) : this._floorMat(p.floor, 0.7);
    // Floor slab: top face exactly at story Y (cy). Stair/climb aperture on landing.
    const floorHoles = this._storyApertures(room, "floor");
    this._addSlabWithHole(g, floorMat, cx, cy - 0.1, cz, w, 0.2, d, floorHoles.length ? floorHoles : null, true, cy);

    // Perimeter floor frame (4 strips) — raised clear of plank top to kill shimmer
    // (never a full coplanar slab on the same Y as the floor)
    {
      // logic31 (Ben "just not very real, not good or smooth"): at the ×0.75 car scale the old 3.4 cm floating frame
      // strips read as kerbs with dark seams under them. Now a flush 6 mm inlay sitting ON the planks (+brass hairline).
      const frameY = cy + 0.003;
      const frameH = 0.006;
      const inset = 0.16;
      const strip = 0.11;
      const woodF = this._mat(0x3e2723, 0.55, 0.12);
      const brassF = this._brass(p.trim);
      const strips = [
        { s: [w - inset * 2, frameH, strip], p: [cx, frameY, cz - d / 2 + inset + strip / 2] },
        { s: [w - inset * 2, frameH, strip], p: [cx, frameY, cz + d / 2 - inset - strip / 2] },
        { s: [strip, frameH, d - inset * 2 - strip * 2], p: [cx - w / 2 + inset + strip / 2, frameY, cz] },
        { s: [strip, frameH, d - inset * 2 - strip * 2], p: [cx + w / 2 - inset - strip / 2, frameY, cz] },
      ];
      const climbHoles = this._storyApertures(room, cy > 1 ? "floor" : "ceiling");
      // logic3: first-floor crest corridor (tip flats z≈-1 + apex U-turn) keeps its asphalt clear
      if (Math.abs(cy - 4.2) < 0.01) climbHoles.push({ minX: -6.6, maxX: 8.6, minZ: -2.35, maxZ: 0.35 });
      for (const s of strips) {
        // Skip perimeter frame segments that cross climb apertures (slab lips)
        if (climbHoles.length) {
          const hx0 = s.p[0] - s.s[0] / 2, hx1 = s.p[0] + s.s[0] / 2;
          const hz0 = s.p[2] - s.s[2] / 2, hz1 = s.p[2] + s.s[2] / 2;
          if (climbHoles.some((h) => hx1 > h.minX && hx0 < h.maxX && hz1 > h.minZ && hz0 < h.maxZ)) continue;
        }
        this.rugRegions.push({ minX: s.p[0] - s.s[0] / 2, maxX: s.p[0] + s.s[0] / 2, minZ: s.p[2] - s.s[2] / 2, maxZ: s.p[2] + s.s[2] / 2, y: cy + 0.0085, roomId: room.id, kind: "frame" });
        const m = new THREE.Mesh(new THREE.BoxGeometry(...s.s), woodF);
        m.position.set(...s.p);
        m.receiveShadow = true;
        m.frustumCulled = true;
        g.add(m);
        // Brass cap on each strip, +4 mm so never coplanar with wood frame
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(
            s.s[0] > s.s[2] ? s.s[0] * 0.92 : 0.045,
            0.003,
            s.s[2] > s.s[0] ? s.s[2] * 0.92 : 0.045
          ),
          brassF
        );
        cap.position.set(s.p[0], frameY + 0.004, s.p[2]); // logic31: hairline inlay, top cy+0.0085
        cap.frustumCulled = true;
        g.add(cap);
      }
    }

    // Area rug — clearly above frame (skip tiny halls; keep clear of climb aperture)
    if (w > 5 && d > 5) {
      let rw = Math.min(w * 0.48, 9);
      let rd = Math.min(d * 0.42, 7);
      let rx = cx, rz = cz;
      const climbHolesRug = this._storyApertures(room, room.id === "landing" ? "floor" : "ceiling");
      if (climbHolesRug.length && room.id === "landing") {
        // logic3: the hairpin lane (x≈0) and balcony_to_climb_b (x≈4.4) cross the landing —
        // a rug above asphalt hid the road. Long runner on the centre island only.
        rw = 1.7;
        rd = 4.35; // logic25: starts north of the chandelier spiral's foot (it lay over the bottom coil — car sank 3.5 cm into it)
        rx = cx + 2.25;
        rz = cz + 2.225;
      }
      if (room.id === "science_attic") { rw = Math.min(rw, 5.6); rd = Math.min(rd, 3.4); } // logic25: inside the Science Attic Ring lane (rug overlapped it)
      const rugTex = this._rugTex(p.trim, p.wall);
      const rugMat = this._stdMat({
        ...(rugTex ? { map: rugTex } : { color: p.trim || 0x6d4c41 }),
        roughness: 0.95,
        metalness: 0.02,
        // logic25 (Ben t191u "you go into the floor a bit"): NO polygonOffset — the rug box already floats 2.2 cm clear
        // of the floor, and the slope-scaled offset pulled the big rug in front of the tyres at low chase-cam angles.
      });
      // Center at cy+0.036, h=0.028 → sits fully above frame brass (~cy+0.026)
      // logic31: a real rug lies ON the floor — 8 mm thick, no 2.2 cm air gap under a 5 cm slab (that read as a raised
      // slab with a lip that hid half the small car, Ben's shot 4).
      const rug = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.008, rd), rugMat);
      rug.position.set(rx, cy + 0.004, rz);
      this.rugRegions.push({ minX: rx - rw / 2, maxX: rx + rw / 2, minZ: rz - rd / 2, maxZ: rz + rd / 2, y: cy + 0.008, roomId: room.id, kind: "rug" });
      rug.receiveShadow = true;
      rug.frustumCulled = true;
      g.add(rug);
    }

    const ceilMat = this._mat(room.glass ? 0x88aacc : 0x6b5d52, room.glass ? 0.3 : 0.9, room.glass ? 0.2 : 0);
    if (!room.glass) { ceilMat.emissive = new THREE.Color(room.palette && room.palette.light != null ? room.palette.light : 0xffe0b2); ceilMat.emissiveIntensity = 0.1; } // logic21: ceilings were #1a1410 (read as black voids overhead)
    if (room.glass) {
      ceilMat.transparent = true;
      ceilMat.opacity = 0.35;
    }
    // Foyer ceiling opens over stair/climb aperture so Drive ramp never smashes slab.
    const ceilHoles = this._storyApertures(room, "ceiling");
    // logic3: slab TOP sits 2 cm below the story line (was centred on it → top at cy+h+0.06,
    // i.e. 6 cm ABOVE the first-floor planks, burying the landing ribbon/car in a dark slab).
    this._addSlabWithHole(g, ceilMat, cx, cy + h - 0.08, cz, w, 0.12, d, ceilHoles.length ? ceilHoles : null, false, null);

    // Conservatory mullions + moonlight feel
    if (room.glass) {
      this._addConservatoryGlass(g, room);
    }

    // Crown / cornice strip (ring of thin boxes along walls — skip attic LOD)
    if (!isAttic) {
      this._addCornice(g, room, p);
      this._addWallPanels(g, room, p);
    } else {
      // Perimeter-only attic crown (avoid coplanar ceiling slab)
      const atticY = cy + h - 0.12;
      const aw = 0.1;
      for (const s of [
        { s: [w - 0.35, 0.08, aw], p: [cx, atticY, cz - d / 2 + 0.22] },
        { s: [w - 0.35, 0.08, aw], p: [cx, atticY, cz + d / 2 - 0.22] },
        { s: [aw, 0.08, d - 0.35 - aw * 2], p: [cx - w / 2 + 0.22, atticY, cz] },
        { s: [aw, 0.08, d - 0.35 - aw * 2], p: [cx + w / 2 - 0.22, atticY, cz] },
      ]) {
        const crown = new THREE.Mesh(new THREE.BoxGeometry(...s.s), this._brass(p.trim));
        crown.position.set(...s.p);
        g.add(crown);
      }
    }

    // Room-specific wallpaper bands + ceiling medallion (mesh accents, no lights)
    if (!isAttic && !room.glass) {
      this._addWallpaperAccents(g, room, p);
    }
    if (!isAttic) {
      this._addCeilingMedallion(g, room, p);
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
    // Landing south = grand French-door aperture matching exterior balcony doors
    // (balDoorW 11.2) so Drive east/west balcony ramps never dead-end into wall slabs.
    if (room.id === "landing") {
      const south = walls.find((w0) => w0.side === "south");
      if (south) south.doorW = 11.0;
    }

    const doorways = this._doorwaysFor(room); // trim gaps still keyed by side

    for (const wall of walls) {
      const openings = this._driveOpeningsForWall(room, wall.side);
      wall.openings = openings;
      if (openings.length) {
        this._addWallWithOpenings(g, wall, p.wall, thick, p.trim, openings, true);
      } else {
        this._addWallWithOpenings(g, wall, p.wall, thick, p.trim, null, true);
        this._addWindows(g, wall, p, cy, h);
      }
    }

    // Baseboard / chair rail / wainscot — sit ON the inner wall face (not buried
    // in the wall volume). Distinct depths prevent plaster/wainscot/wallpaper flicker.
    // bbH keeps a low "road-height" foot (~asphalt y≈0.06) readable next to Drive ribbons.
    const bbH = 0.22;
    const chairY = cy + 0.94;
    const woodTrim = this._mat(0x3e2723, 0.5, 0.14);
    const brassTrim = this._brass(p.trim);
    const doorGapDefault = 3.1; // match default doorW so trim leaves doorway clear
    const halfThick = thick * 0.5; // 0.14
    // Depth stack from plaster outward into room (mm-scale gaps, rock solid)
    const D_WAIN = halfThick + 0.018;   // wainscot face
    const D_BB = halfThick + 0.028;     // baseboard
    const D_CAP = halfThick + 0.036;    // brass cap
    const D_RAIL = halfThick + 0.040;   // chair rail
    const inward = (side, px, pz, depth) => {
      if (side === "north") return [px, pz + depth];
      if (side === "south") return [px, pz - depth];
      if (side === "west") return [px + depth, pz];
      return [px - depth, pz]; // east
    };
    for (const wall of walls) {
      const [sx, , sz] = wall.size;
      const [px, , pz] = wall.pos;
      const horiz = sx > sz;
      const hasDoor = !!doorways[wall.side];
      const doorGap = wall.doorW || doorGapDefault;
      const segments = [];
      // logic3: trim follows the ACTUAL floor-level openings (tunnels, arches, doors) so
      // baseboards / rails never run across a drive portal or lie on a ribbon edge.
      const floorOps = (wall.openings || []).filter((o) => o.y0 < cy + 0.5);
      if (floorOps.length) {
        const len = horiz ? sx : sz;
        const c0 = horiz ? px : pz;
        let spans = [[c0 - len / 2 + 0.075, c0 + len / 2 - 0.075]];
        for (const o of floorOps) {
          const g0 = o.along - o.width / 2 - 0.04, g1 = o.along + o.width / 2 + 0.04;
          const next = [];
          for (const [s0, s1] of spans) {
            if (g1 <= s0 || g0 >= s1) { next.push([s0, s1]); continue; }
            if (g0 - s0 > 0.2) next.push([s0, g0]);
            if (s1 - g1 > 0.2) next.push([g1, s1]);
          }
          spans = next;
        }
        for (const [s0, s1] of spans) {
          const L = s1 - s0, m = (s0 + s1) / 2;
          segments.push(horiz ? { size: [L, null, null], pos: [m, null, pz] } : { size: [null, null, L], pos: [px, null, m] });
        }
      } else if (hasDoor && horiz) {
        const remain = (sx - doorGap) / 2;
        if (remain > 0.2) {
          segments.push({
            size: [remain - 0.08, null, null],
            pos: [px - (doorGap / 2 + remain / 2), null, pz],
          });
          segments.push({
            size: [remain - 0.08, null, null],
            pos: [px + (doorGap / 2 + remain / 2), null, pz],
          });
        }
      } else if (hasDoor && !horiz) {
        const remain = (sz - doorGap) / 2;
        if (remain > 0.2) {
          segments.push({
            size: [null, null, remain - 0.08],
            pos: [px, null, pz - (doorGap / 2 + remain / 2)],
          });
          segments.push({
            size: [null, null, remain - 0.08],
            pos: [px, null, pz + (doorGap / 2 + remain / 2)],
          });
        }
      } else {
        segments.push({
          size: [horiz ? sx - 0.15 : null, null, horiz ? null : sz - 0.15],
          pos: [px, null, pz],
        });
      }
      for (const seg of segments) {
        const bw = seg.size[0] != null ? seg.size[0] : (horiz ? sx - 0.15 : 0.08);
        const bd = seg.size[2] != null ? seg.size[2] : (horiz ? 0.08 : sz - 0.15);
        const [bx0, bz0] = [seg.pos[0], seg.pos[2]];
        const bbT = 0.08; // trim thickness into room
        const [bx, bz] = inward(wall.side, bx0, bz0, D_BB);
        const bb = new THREE.Mesh(
          new THREE.BoxGeometry(horiz ? bw : bbT, bbH, horiz ? bbT : bd),
          woodTrim
        );
        bb.position.set(bx, cy + bbH / 2, bz);
        bb.frustumCulled = true;
        g.add(bb);
        const [cxp, czp] = inward(wall.side, bx0, bz0, D_CAP);
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(horiz ? bw + 0.02 : 0.09, 0.035, horiz ? 0.09 : bd + 0.02),
          brassTrim
        );
        cap.position.set(cxp, cy + bbH + 0.012, czp);
        cap.frustumCulled = true;
        g.add(cap);
        const [rx, rz] = inward(wall.side, bx0, bz0, D_RAIL);
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(horiz ? bw - 0.04 : 0.06, 0.055, horiz ? 0.06 : bd - 0.04),
          brassTrim
        );
        rail.position.set(rx, chairY, rz);
        rail.frustumCulled = true;
        g.add(rail);
      }
      // Wainscot — slightly behind baseboard depth, never coplanar with plaster
      const wainH = chairY - cy - bbH - 0.08;
      if (wainH > 0.3) {
        const wainMat = this._mat(
          ((p.wall >> 1) & 0x7f7f7f) | 0x101010,
          0.72, 0.05
        );
        for (const seg of segments) {
          const bw = seg.size[0] != null ? seg.size[0] : (horiz ? sx - 0.45 : 0.04);
          const bd = seg.size[2] != null ? seg.size[2] : (horiz ? 0.04 : sz - 0.45);
          const [wx, wz] = inward(wall.side, seg.pos[0], seg.pos[2], D_WAIN);
          const wainT = 0.035;
          const wain = new THREE.Mesh(
            new THREE.BoxGeometry(
              horiz ? Math.max(0.1, bw - 0.2) : wainT,
              wainH,
              horiz ? wainT : Math.max(0.1, bd - 0.2)
            ),
            wainMat
          );
          wain.position.set(wx, cy + bbH + 0.04 + wainH / 2, wz);
          wain.frustumCulled = true;
          g.add(wain);
        }
      }
    }

    const reach = Math.max(w, d) * 0.7;
    const spot = new THREE.SpotLight(p.light, 30, reach + 7, Math.PI / 3.05, 0.62, 1.35);
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
    // Budget 8 — foyer/landing/cellar first; skip secondary rooms on SwiftShader
    const keyRooms = new Set(["foyer", "landing", "cellar"]);
    if (keyRooms.has(room.id)) {
      const warm = room.id === "cellar" ? 3.5 : 5.0;
      const amb = this._allocPointLight(p.light, warm, reach + 5, 2);
      if (amb) {
        amb.position.set(cx, cy + Math.min(2.55, h * 0.58), cz);
        g.add(amb);
      }
    }

    this._addChandelier(g, cx, cy + h - 0.5, cz, p.trim);
    this._addSconces(g, room, p);
    this._addDecor(g, room, p);

    // Surface furniture for realism
    this._addRoomFurniture(g, room, p);

    // Floor edge trim is the perimeter frame above (no full coplanar slab — kills flicker)

    this._placeRoomObjects(g, room, cy, p, false);

    this.root.add(g);
  }



  /** logic3: along-wall spans of [a0,a1] NOT covered by an opening that overlaps y∈[yLo,yHi]. */
  _wallFreeSpans(room, side, a0, a1, yLo, yHi, pad = 0.06) {
    let spans = [[a0, a1]];
    for (const o of this._driveOpeningsForWall(room, side) || []) {
      if (o.y1 <= yLo || o.y0 >= yHi) continue;
      const g0 = o.along - o.width / 2 - pad, g1 = o.along + o.width / 2 + pad;
      const next = [];
      for (const [s0, s1] of spans) {
        if (g1 <= s0 || g0 >= s1) { next.push([s0, s1]); continue; }
        if (g0 - s0 > 0.15) next.push([s0, g0]);
        if (s1 - g1 > 0.15) next.push([g1, s1]);
      }
      spans = next;
    }
    return spans;
  }

  _addWallpaperAccents(group, room, p) {
    const [w, h, d] = room.size;
    const [cx, cy, cz] = room.pos;
    const tex = this._wallpaperTex(p.wall, p.trim);
    if (!tex) return;
    const mat = this._stdMat({
      map: (() => { const t = tex.clone(); t.repeat.set(3, 2); return t; })(),
      color: 0xffffff, roughness: 0.86, metalness: 0.02,
    });
    // Upper wallpaper band — inset past plaster AND past wall panels (no shared plane)
    const bandH = Math.min(1.85, h * 0.42);
    const bandY = cy + 1.05 + bandH / 2;
    const wallIn = 0.14 + 0.052; // halfThick + gap past panels (~0.192)
    // logic3: bands split around doors / drive portals (no floating paper across an arch)
    const strips = [];
    const yLo = bandY - bandH / 2, yHi = bandY + bandH / 2;
    for (const [side, zc] of [["north", cz - d / 2 + wallIn], ["south", cz + d / 2 - wallIn]]) {
      for (const [a0, a1] of this._wallFreeSpans(room, side, cx - w / 2 + 0.3, cx + w / 2 - 0.3, yLo, yHi)) {
        strips.push({ s: [a1 - a0, bandH, 0.028], p: [(a0 + a1) / 2, bandY, zc] });
      }
    }
    for (const [side, xc] of [["west", cx - w / 2 + wallIn], ["east", cx + w / 2 - wallIn]]) {
      for (const [a0, a1] of this._wallFreeSpans(room, side, cz - d / 2 + 0.3, cz + d / 2 - 0.3, yLo, yHi)) {
        strips.push({ s: [0.028, bandH, a1 - a0], p: [xc, bandY, (a0 + a1) / 2] });
      }
    }
    for (const s of strips) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...s.s), mat);
      m.position.set(...s.p);
      m.frustumCulled = true;
      group.add(m);
    }
  }

  _addCeilingMedallion(group, room, p) {
    const [w, h, d] = room.size;
    const [cx, cy, cz] = room.pos;
    if (w < 6 || d < 6) return;
    const tex = this._medallionTex(p.trim);
    const mat = this._stdMat({
      ...(tex ? { map: tex, color: 0xffffff } : { color: p.trim }),
      roughness: 0.45, metalness: 0.35,
    });
    const r = Math.min(1.1, Math.min(w, d) * 0.12);
    // Hang just below ceiling underside (cy+h-0.06) — never inside the ceiling slab
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.05, 24), mat);
    disc.position.set(cx, cy + h - 0.095, cz);
    disc.frustumCulled = true;
    group.add(disc);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r * 0.85, 0.03, 6, 24),
      this._brass(p.trim)
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(cx, cy + h - 0.112, cz);
    group.add(ring);
  }

  /** Edge/corner outdoor props — keep path centers clear for walk + drive read. */
  _addOutdoorZoneDetail(group, room, p) {
    const [w, , d] = room.size;
    const [cx, cy, cz] = room.pos;
    const id = room.id;
    const wood = this._wood(0x5d4037);
    const stone = this._mat(0x90a4ae, 0.75, 0.12);
    const green = this._mat(0x2e7d32, 0.88);
    const addBox = (sx, sy, sz, x, y, z, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
      m.position.set(x, y, z); m.frustumCulled = true; group.add(m); return m;
    };
    const addCyl = (rt, rb, hh, x, y, z, mat, seg = 10) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, hh, seg), mat);
      m.position.set(x, y, z); m.frustumCulled = true; group.add(m); return m;
    };

    // Corner planters for every outdoor zone
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (id === "carriage_yard" && sx > 0) continue; // logic19: lab garage + window road stand there
      if (id === "front_drive" && sx > 0 && sz < 0) continue; // logic26: stood on the Grand Descent's run-out — drive-through
      if (id === "garden" && sx < 0 && sz > 0) continue; // logic26: stood on the Garden Road (sky_garden) — drive-through
      if (id === "carriage_yard" && sz > 0) continue; // logic24 (Ben t188u): this planter stood on the East Lawn kicker run-up — drive-through; removed
      const x = cx + sx * (w * 0.38);
      const z = cz + sz * (d * 0.38);
      addCyl(0.35, 0.4, 0.45, x, cy + 0.22, z, this._mat(0x6d4c41, 0.85), 10);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), green);
      leaf.position.set(x, cy + 0.65, z);
      leaf.frustumCulled = true;
      group.add(leaf);
      (this.cornerPlanters || (this.cornerPlanters = [])).push({ id, x, z, cy });
      // logic26 drive-through scan: corner planters had no collider (the car drove through pot + shrub)
      this._pushCollider(new THREE.Box3(new THREE.Vector3(x - 0.4, cy, z - 0.4), new THREE.Vector3(x + 0.4, cy + 1.05, z + 0.4)), "pillar");
    }

    if (id === "front_drive") {
      // Hitching posts + gravel edge stones along drive (keep center clear)
      for (const x of [-5, 5]) {
        for (const z of [22, 30, 38]) {
          addCyl(0.08, 0.1, 1.1, x, cy + 0.55, z, this._mat(0x37474f, 0.5, 0.4), 8);
          addCyl(0.14, 0.14, 0.08, x, cy + 1.15, z, this._brass(0xc9a227), 8);
          this._pushCollider(
            new THREE.Box3(
              new THREE.Vector3(x - 0.16, cy, z - 0.16),
              new THREE.Vector3(x + 0.16, cy + 1.2, z + 0.16)
            ),
            "pillar"
          );
        }
      }
      // Low stone curb rings near fountain approach
      for (const z of [26, 40]) {
        addBox(10, 0.18, 0.35, cx, cy + 0.09, z, stone);
      }
      // Welcome urns near mansion door approach
      for (const sx of [-3.5, 3.5]) {
        addCyl(0.4, 0.48, 0.7, sx, cy + 0.35, 17.6, this._mat(0xb0bec5, 0.5, 0.25), 12);
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), green);
        bush.position.set(sx, cy + 0.95, 17.6); // logic26: urns 40 cm off the Garden Road edge
        group.add(bush);
      }
    }

    if (id === "rose_walk") {
      // Trellis arches along walk edges
      for (const z of [cz - 8, cz, cz + 8]) {
        for (const side of [-1, 1]) {
          const x = cx + side * 6;
          addBox(0.1, 2.2, 0.1, x - 1.2, cy + 1.1, z, wood);
          addBox(0.1, 2.2, 0.1, x + 1.2, cy + 1.1, z, wood);
          addBox(2.6, 0.1, 0.1, x, cy + 2.2, z, wood);
          for (let i = 0; i < 5; i++) {
            const rose = new THREE.Mesh(
              new THREE.SphereGeometry(0.12, 6, 5),
              this._mat(i % 2 ? 0xc62828 : 0xad1457, 0.7)
            );
            rose.position.set(x - 1 + i * 0.5, cy + 1.6 + (i % 2) * 0.3, z);
            group.add(rose);
          }
        }
      }
      // Garden bench mid-edge
      addBox(1.8, 0.12, 0.5, cx - 7, cy + 0.45, cz + 2, stone);
      for (const sx of [-0.7, 0.7]) addBox(0.12, 0.4, 0.45, cx - 7 + sx, cy + 0.2, cz + 2, stone);
    }

    if (id === "garden") {
      // Birdbath + more flower mounds at edges
      addCyl(0.15, 0.2, 0.9, cx + 6, cy + 0.45, cz - 3.4, stone, 10);
      addCyl(0.55, 0.5, 0.12, cx + 6, cy + 0.95, cz - 3.4, stone, 14);
      const water = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.04, 16),
        new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.2, metalness: 0.5, transparent: true, opacity: 0.7 })
      );
      water.position.set(cx + 6, cy + 1.02, cz - 3.4); // logic26: birdbath 60 cm off the Parlor Greenwall lane
      group.add(water);
      for (const [dx, dz, col] of [[-8, 4, 0xe91e63], [8, 6, 0xffeb3b], [-6, -6, 0x9c27b0], [4, -7, 0xff9800]]) {
        addBox(1.6, 0.28, 0.7, cx + dx, cy + 0.14, cz + dz, this._mat(col, 0.85));
      }
    }

    if (id === "orchard") {
      // Fruit crates + ladder at edges (center rows for walking)
      for (const [dx, dz] of [[-10, 6], [10, -6], [-8, -8]]) {
        addBox(0.9, 0.5, 0.7, cx + dx, cy + 0.25, cz + dz, this._wood(0x8d6e63));
        addCyl(0.12, 0.12, 0.12, cx + dx, cy + 0.58, cz + dz, this._mat(0xff9800, 0.6), 8);
      }
      // Ladder leaning
      addBox(0.08, 2.4, 0.08, cx + 9, cy + 1.2, cz + 4, wood);
      addBox(0.08, 2.4, 0.08, cx + 9.5, cy + 1.2, cz + 4, wood);
      for (let i = 0; i < 6; i++) addBox(0.55, 0.05, 0.05, cx + 9.25, cy + 0.3 + i * 0.35, cz + 4, wood);
    }

    if (id === "terrace") {
      // Cafe tables + urns along rim (path center clear)
      for (const [dx, dz] of [[-8, 0], [8, 0], [-4, -4], [4, -4]]) {
        addCyl(0.45, 0.45, 0.05, cx + dx, cy + 0.75, cz + dz, this._mat(0x455a64, 0.4, 0.6), 12);
        addCyl(0.06, 0.08, 0.75, cx + dx, cy + 0.37, cz + dz, this._mat(0x37474f, 0.45, 0.55), 8);
      }
      for (const sx of [-9, 9]) {
        addCyl(0.4, 0.48, 0.8, cx + sx, cy + 0.4, cz + 3, this._mat(0xb0bec5, 0.5, 0.2), 12);
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), green);
        bush.position.set(cx + sx, cy + 1.05, cz + 3);
        group.add(bush);
      }
      // Low balustrade suggestion on north rim
      for (let i = -4; i <= 4; i++) {
        addCyl(0.08, 0.08, 0.7, cx + i * 2.2, cy + 0.35, cz - d / 2 + 0.6, stone, 8);
      }
      addBox(w * 0.75, 0.08, 0.1, cx, cy + 0.72, cz - d / 2 + 0.6, stone);
    }

    if (id === "pond") {
      // Reeds + lily pads + short dock (edge only)
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const x = cx + Math.cos(a) * 9;
        const z = cz + Math.sin(a) * 7;
        addCyl(0.03, 0.04, 0.9 + (i % 3) * 0.15, x, cy + 0.5, z, green, 5);
      }
      for (const [dx, dz] of [[-3, 2], [2, -2], [4, 3], [-5, -1]]) {
        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 0.04, 12),
          this._mat(0x43a047, 0.8)
        );
        pad.position.set(26 + dx * 0.6, cy + 0.125, -46 + dz * 0.6); // logic20: float ON the koi pond (they sat on the lawn 6 cm up)
        group.add(pad);
      }
      // Dock planks from west edge
      addBox(3.5, 0.12, 1.2, cx - 8, cy + 0.12, cz, this._wood(0x6d4c41));
      for (const sx of [-1.4, 1.4]) addBox(0.15, 0.5, 0.15, cx - 8 + sx, cy + 0.25, cz + 0.4, wood);
    }

    if (id === "rockery") {
      // Extra boulder cluster + driftwood
      for (const [dx, dz, s] of [[-6, 3, 0.55], [5, -2, 0.7], [7, 4, 0.45], [-4, -4, 0.6]]) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), this._mat(0x78909c, 0.9));
        rock.position.set(cx + dx, cy + s * 0.6, cz + dz);
        rock.rotation.set(0.2 * dx, 0.3, 0.1);
        group.add(rock);
      }
      addBox(1.8, 0.18, 0.25, cx + 2, cy + 0.2, cz + 5, this._wood(0x5d4037));
      addBox(0.25, 0.18, 1.2, cx + 2.6, cy + 0.2, cz + 4.5, this._wood(0x6d4c41));
    }

    if (id === "carriage_yard") {
      // Hay bales, barrels, spare wheel, workbench along shed wall
      for (const [dx, dz] of [[-7.2, 6.6], [-4, 8], [3, 3.5]]) { // logic24: west bale moved off the Timber Lawn bend (it sat on the road) // logic19: third bale moved out of the lab garage
        addCyl(0.45, 0.45, 0.7, cx + dx, cy + 0.35, cz + dz, this._mat(0xc9a227, 0.85), 12);
        // logic24 (Ben t188u): the bales flank the Timber Lawn exit — they were drive-through; now solid
        this.colliders.push(new THREE.Box3(new THREE.Vector3(cx + dx - 0.4, cy, cz + dz - 0.4), new THREE.Vector3(cx + dx + 0.4, cy + 0.7, cz + dz + 0.4)));
      }
      for (const [dx, dz] of [[5.6, 4.2], [6.4, 4.9]]) { // logic19: barrels moved off the lab window road
        addCyl(0.35, 0.38, 0.75, cx + dx, cy + 0.38, cz + dz, this._wood(0x5d4037), 14);
        addCyl(0.37, 0.37, 0.05, cx + dx, cy + 0.78, cz + dz, this._brass(0x8d6e63), 14);
      }
      // Wagon wheel
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.08, 8, 20), this._wood(0x4e342e));
      wheel.position.set(cx - 7, cy + 0.75, cz - 4);
      wheel.rotation.y = Math.PI / 2;
      group.add(wheel);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI;
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.05), this._wood(0x6d4c41));
        spoke.position.set(cx - 7, cy + 0.75, cz - 4);
        spoke.rotation.set(0, Math.PI / 2, a);
        group.add(spoke);
      }
      addBox(2.4, 0.12, 0.8, cx + 5, cy + 0.9, cz + 8, wood);
      for (const sx of [-1, 1]) addBox(0.1, 0.9, 0.7, cx + 5 + sx, cy + 0.45, cz + 8, wood);
    }
  }

  _addCornice(group, room, p) {
    const [w, h, d] = room.size;
    const [cx, cy, cz] = room.pos;
    const brass = this._brass(p.trim);
    const wood = this._mat(0x3e2723, 0.5, 0.15);
    // Climb corridor gap — hall south triple crown was Ben's "three stacked tan slabs"
    // spanning the asphalt; also clear foyer/landing lips over straightened climb.
    const climbGaps = [
      { minX: -6.35, maxX: -3.65, minZ: -2.60, maxZ: 10.00 }, // holeA_climb (logic3: ends at landing S wall)
      { minX: -8.80, maxX: -6.40, minZ: 2.00, maxZ: 10.50 }, // holeA_scenic
      { minX: 5.65, maxX: 8.35, minZ: -2.60, maxZ: 10.00 }, // holeB_climb
      { minX: 8.20, maxX: 9.90, minZ: 2.00, maxZ: 10.50 }, // holeB_scenic
    ];
    const climbGap = climbGaps[0]; // legacy single for split helpers below (west Climb A)
    const addBox = (sx, sy, sz, px, py, pz, mat) => {
      if (sx < 0.04 || sy < 0.04 || sz < 0.04) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
      m.position.set(px, py, pz);
      m.frustumCulled = true;
      group.add(m);
    };
    // Split a world-X strip around climbGap when it crosses the climb band in Z
    const addXStripSplit = (fullW, thick, depth, px, py, pz, mat) => {
      let segs = [{ x0: px - fullW / 2, x1: px + fullW / 2 }];
      const z0 = pz - depth / 2, z1 = pz + depth / 2;
      for (const gap of climbGaps) {
        if (!(z1 > gap.minZ && z0 < gap.maxZ)) continue;
        const next = [];
        for (const s of segs) {
          if (s.x1 < gap.minX || s.x0 > gap.maxX) { next.push(s); continue; }
          if (gap.minX - s.x0 > 0.04) next.push({ x0: s.x0, x1: gap.minX });
          if (s.x1 - gap.maxX > 0.04) next.push({ x0: gap.maxX, x1: s.x1 });
        }
        segs = next;
      }
      for (const s of segs) {
        const ww = s.x1 - s.x0;
        if (ww > 0.04) addBox(ww, thick, depth, (s.x0 + s.x1) / 2, py, pz, mat);
      }
    };
    // Split a world-Z strip around climbGap when it crosses the climb band in X
    const addZStripSplit = (width, thick, fullD, px, py, pz, mat) => {
      let segs = [{ z0: pz - fullD / 2, z1: pz + fullD / 2 }];
      const x0 = px - width / 2, x1 = px + width / 2;
      for (const gap of climbGaps) {
        if (!(x1 > gap.minX && x0 < gap.maxX)) continue;
        const next = [];
        for (const s of segs) {
          if (s.z1 < gap.minZ || s.z0 > gap.maxZ) { next.push(s); continue; }
          if (gap.minZ - s.z0 > 0.04) next.push({ z0: s.z0, z1: gap.minZ });
          if (s.z1 - gap.maxZ > 0.04) next.push({ z0: gap.maxZ, z1: s.z1 });
        }
        segs = next;
      }
      for (const s of segs) {
        const dd = s.z1 - s.z0;
        if (dd > 0.04) addBox(width, thick, dd, px, py, (s.z0 + s.z1) / 2, mat);
      }
    };
    // Crown steps sit CLEARLY below ceiling underside (ceiling bottom ≈ cy+h-0.06)
    const layers = [
      { t: 0.14, y: 0.10, out: 0.15, mat: wood },
      { t: 0.11, y: 0.18, out: 0.21, mat: brass },
      { t: 0.08, y: 0.26, out: 0.27, mat: wood },
    ];
    for (const L of layers) {
      addXStripSplit(w - 0.15, L.t, 0.1, cx, cy + h - L.y, cz - d / 2 + L.out, L.mat);
      addXStripSplit(w - 0.15, L.t, 0.1, cx, cy + h - L.y, cz + d / 2 - L.out, L.mat);
      addZStripSplit(0.1, L.t, d - 0.15, cx - w / 2 + L.out, cy + h - L.y, cz, L.mat);
      addZStripSplit(0.1, L.t, d - 0.15, cx + w / 2 - L.out, cy + h - L.y, cz, L.mat);
    }
    // Drive-ledge as PERIMETER strips only (full slab fought beams/ceiling)
    const ledgeY = cy + h - 0.30;
    const ledgeIn = 0.30;
    const ledgeW = 0.12;
    addXStripSplit(w - ledgeIn * 2, 0.055, ledgeW, cx, ledgeY, cz - d / 2 + ledgeIn, brass);
    addXStripSplit(w - ledgeIn * 2, 0.055, ledgeW, cx, ledgeY, cz + d / 2 - ledgeIn, brass);
    addZStripSplit(ledgeW, 0.055, d - ledgeIn * 2 - ledgeW * 2, cx - w / 2 + ledgeIn, ledgeY, cz, brass);
    addZStripSplit(ledgeW, 0.055, d - ledgeIn * 2 - ledgeW * 2, cx + w / 2 - ledgeIn, ledgeY, cz, brass);
  }

  _addWallPanels(group, room, p) {
    const [w, h, d] = room.size;
    const [cx, cy, cz] = room.pos;
    if (h < 3.2) return;
    // Keep panels below wallpaper band start (~cy+1.05) to avoid Y-overlap shimmer
    const panelH = Math.min(1.55, h * 0.38);
    const panelY = cy + 0.42 + panelH / 2;
    const panelIn = 0.14 + 0.024; // halfThick + small gap (behind wallpaper)
    const dark = this._mat(
      (p.wall & 0xfefefe) === p.wall ? p.wall : ((p.wall >> 1) & 0x7f7f7f) | (p.wall & 0x808080),
      0.82, 0.03
    );
    const nPanels = Math.max(2, Math.floor(w / 2.8));
    for (let i = 0; i < nPanels; i++) {
      if (i % 2 === 1) continue;
      const pw = Math.min(2.2, w / nPanels - 0.25);
      const x = cx - w / 2 + (i + 0.5) * (w / nPanels);
      for (const zSide of [cz - d / 2 + panelIn, cz + d / 2 - panelIn]) {
        // Skip panels that choke the climb / foyer↔hall west portal band
        if (x > -5.4 && x < -1.6 && zSide > -0.4 && zSide < 2.5) continue;
        // logic3: never hang a panel across a door / drive portal
        const pSide = zSide < cz ? "north" : "south";
        const free = this._wallFreeSpans(room, pSide, x - pw / 2 - 0.05, x + pw / 2 + 0.05, panelY - panelH / 2, panelY + panelH / 2, 0.02);
        if (free.length !== 1 || free[0][1] - free[0][0] < pw) continue;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(pw, panelH, 0.032), dark);
        panel.position.set(x, panelY, zSide);
        panel.frustumCulled = true;
        group.add(panel);
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(pw + 0.08, 0.045, 0.04),
          this._brass(p.trim)
        );
        // Rail slightly further into room than panel face
        const railZ = zSide + (zSide > cz ? -0.012 : 0.012);
        rail.position.set(x, cy + 0.40 + panelH, railZ);
        group.add(rail);
      }
    }
    const nP2 = Math.max(2, Math.floor(d / 2.8));
    for (let i = 0; i < nP2; i++) {
      if (i % 2 === 1) continue;
      const pd = Math.min(2.2, d / nP2 - 0.25);
      const z = cz - d / 2 + (i + 0.5) * (d / nP2);
      for (const xSide of [cx - w / 2 + panelIn, cx + w / 2 - panelIn]) {
        const pSide = xSide < cx ? "west" : "east";
        const free = this._wallFreeSpans(room, pSide, z - pd / 2 - 0.05, z + pd / 2 + 0.05, panelY - panelH / 2, panelY + panelH / 2, 0.02);
        if (free.length !== 1 || free[0][1] - free[0][0] < pd) continue;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.032, panelH, pd), dark);
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
      // Skip beams that bar the foyer↔hall climb lane (west band)
      if (room.id === "hall_ground" && z > -0.2 && z < 2.4) continue;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(w - 0.5, 0.14, 0.2), beamMat);
      beam.position.set(cx, cy + h - 0.20, z);
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
      if (i === 0) continue; // logic26: this one stood in the middle of the terrace doorway (walk/drive-through post)
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 0.9, 0.08), mullion);
      m.position.set(cx + i * 2.5, cy + h * 0.45, cz - d / 2 + 0.2);
      group.add(m);
      const mx = cx + i * 2.5, mz = cz - d / 2 + 0.2; // logic26 drive-through scan: solid now (ground level, under the lane deck)
      this._pushCollider(new THREE.Box3(new THREE.Vector3(mx - 0.05, cy, mz - 0.05), new THREE.Vector3(mx + 0.05, cy + 2.6, mz + 0.05)), "pillar");
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
      // Solid furniture volumes: block Explore walk; Drive softens (shrink/raise).
      // Include tall wall-hugging consoles (thin X, long Z) that used to skip AABB.
      const tallConsole = sy >= 0.55 && Math.min(sx, sz) >= 0.22 && Math.max(sx, sz) >= 0.7;
      if ((sx >= 0.45 && sy >= 0.35 && sz >= 0.35) || tallConsole) {
        this._pushCollider(
          new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(x, y, z),
            new THREE.Vector3(sx, sy, sz)
          ),
          "furniture"
        );
      } else if (cast && sx >= 0.7 && sz >= 0.4 && sy >= 0.1) {
        // Tabletops / benches: thin but wide — extruded for Explore; Drive raises min.y
        this._pushCollider(
          new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(x, y - sy * 0.5 + Math.max(sy, 0.55) * 0.5, z),
            new THREE.Vector3(sx * 0.92, Math.max(sy, 0.55), sz * 0.92)
          ),
          "furniture"
        );
      }
      return m;
    };
    const addCyl = (rt, rb, hh, x, y, z, mat, seg = 10) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, hh, seg), mat);
      m.position.set(x, y, z);
      m.frustumCulled = true;
      group.add(m);
      return m;
    };
    const addFireplace = (x, z, facing = "south") => {
      // Mantel against wall — keep walk center open
      addBox(2.6, 1.5, 0.55, x, cy + 0.75, z, this._mat(0x455a64, 0.7, 0.15), true);
      addBox(2.8, 0.18, 0.65, x, cy + 1.55, z, darkWood);
      addBox(1.4, 0.9, 0.35, x, cy + 0.55, z, this._mat(0x1a1a1a, 0.9));
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.55, 0.12),
        this._emissiveGlow(0xff8f00, 0.85)
      );
      glow.position.set(x, cy + 0.5, z + (facing === "south" ? 0.15 : facing === "north" ? -0.15 : 0));
      group.add(glow);
      // Andirons
      for (const sx of [-0.35, 0.35]) addBox(0.08, 0.25, 0.25, x + sx, cy + 0.2, z, brass);
    };
    const addFloorLamp = (x, z) => {
      addCyl(0.12, 0.16, 0.06, x, cy + 0.03, z, brass, 8);
      addCyl(0.03, 0.035, 1.4, x, cy + 0.75, z, brass, 6);
      const shade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.28, 0.35, 10),
        this._cloth(0xffe0b2, 0.85)
      );
      shade.position.set(x, cy + 1.55, z);
      group.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), this._emissiveGlow(0xffe0b2, 0.9));
      bulb.position.set(x, cy + 1.45, z);
      group.add(bulb);
    };
    const addSideTable = (x, z) => {
      addBox(0.7, 0.08, 0.7, x, cy + 0.55, z, darkWood, true);
      for (const [sx, sz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
        addBox(0.06, 0.55, 0.06, x + sx, cy + 0.27, z + sz, wood);
      }
    };
    const addArmchair = (x, z, velvetHex, yaw = 0) => {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.18, 0.8), this._velvet(velvetHex));
      seat.position.set(0, 0.45, 0); g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.75, 0.14), this._velvet(velvetHex));
      back.position.set(0, 0.85, -0.35); g.add(back);
      for (const sx of [-0.38, 0.38]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.35, 0.7), this._velvet(velvetHex));
        arm.position.set(sx, 0.6, 0); g.add(arm);
      }
      for (const [sx, sz] of [[-0.3, -0.28], [0.3, -0.28], [-0.3, 0.28], [0.3, 0.28]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.07), wood);
        leg.position.set(sx, 0.2, sz); g.add(leg);
      }
      g.position.set(x, cy, z);
      g.rotation.y = yaw;
      group.add(g);
      this._pushCollider(
        new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(x, cy + 0.55, z),
          new THREE.Vector3(0.9, 1.05, 0.85)
        ),
        "furniture"
      );
    };

    if (id === "foyer") {
      // Console table against east wall (away from west stair / east cellar stair)
      // logic3: console moved off the Climb B foot arc → centre, backing onto the S/F straight
      addBox(2.4, 0.12, 0.7, cx + 1.6, cy + 0.9, cz + 3.3, darkWood, true);
      for (const sx of [-0.9, 0.9]) addBox(0.1, 0.9, 0.1, cx + 1.6 + sx, cy + 0.45, cz + 3.3, wood);
      addBox(1.6, 2.0, 0.08, cx + 1.6, cy + 2.3, cz + 3.65, brass);
      addBox(1.35, 1.75, 0.04, cx + 1.6, cy + 2.3, cz + 3.62, this._glass(0xc5e1ff, 0.45));
      addBox(2.2, 0.08, 0.08, cx - 4, cy + 1.7, cz + d / 2 - 0.35, brass);
      for (let i = -2; i <= 2; i++) {
        addCyl(0.03, 0.03, 0.18, cx - 4 + i * 0.4, cy + 1.55, cz + d / 2 - 0.45, brass, 6);
      }
      for (const sx of [-4, 4]) {
        addCyl(0.35, 0.4, 0.7, cx + sx, cy + 0.35, cz - 2, this._mat(0x90a4ae, 0.4, 0.3), 12);
        addCyl(0.2, 0.28, 0.35, cx + sx, cy + 0.85, cz - 2, this._mat(0x78909c, 0.35, 0.25), 10);
      }
      addBox(2.2, 0.02, 0.55, cx + 1.6, cy + 0.97, cz + 3.3, this._cloth(0xd7ccc8, 0.9));
      for (const side of [-1, 1]) {
        const curtain = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, h * 0.7, 0.1),
          this._velvet(0x4e342e)
        );
        // logic3: hang flat against the south wall (1.1-deep drapes reached 0.6u into the S/F lane)
        curtain.position.set(cx + side * 2.4, cy + h * 0.38, cz + d / 2 - 0.22);
        group.add(curtain);
      }
      for (const sx of [-3.2, 4.8]) { // logic3: x=-5 hung on the Climb A centreline
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 8, 6),
          this._emissiveGlow(0xffe0b2, 1.05)
        );
        bulb.position.set(cx + sx, cy + 2.2, cz);
        group.add(bulb);
      }
      // Fireplace on north wall (hall entrance side, offset from center path)
      addFireplace(cx + 5.2, cz - d / 2 + 0.4, "south");
      // Bench against south wall west corner — clear of foyer_drive_start / climb approach
      addBox(2.0, 0.12, 0.55, cx - 6.6, cy + 0.48, cz + d / 2 - 0.85, darkWood);
      for (const sx of [-0.8, 0.8]) addBox(0.1, 0.48, 0.5, cx - 6.6 + sx, cy + 0.24, cz + d / 2 - 0.85, wood);
      addArmchair(cx + 3.5, cz + 2, 0x5d4037, Math.PI * 0.15);
      addSideTable(cx + 4.5, cz + 1.2);
      addFloorLamp(cx + 4.7, cz + 2.4); // logic3: was under the Climb B deck (x 6.2)
      // Grandfather clock — mid-east foyer, clear of Climb B east corridor (x≈7)
      addBox(0.55, 2.2, 0.35, cx + 3.6, cy + 1.1, cz - 0.2, darkWood, true);
      addBox(0.45, 0.4, 0.08, cx + 3.6, cy + 1.9, cz - 0.05, this._mat(0xffe0b2, 0.4));
      addCyl(0.02, 0.02, 0.15, cx + 3.6, cy + 1.9, cz - 0.02, brass, 6);
      // Umbrella stand — south wall, clear of dual climb feet (x±7)
      addCyl(0.18, 0.22, 0.55, cx - 8.25, cy + 0.28, cz + d / 2 - 0.6, this._mat(0x37474f, 0.45, 0.5), 10); // logic3: off the lane
    }

    if (id === "cabinet") {
      for (const [dx, dz] of [[-6, 4], [6, 4], [-6, -4], [6, -4]]) {
        const x = cx + dx, z = cz + dz;
        addBox(2.2, 0.15, 1.2, x, cy + 0.08, z, darkWood, true);
        const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.6, 1.0), this._glass(0xb3e5fc, 0.28));
        glass.position.set(x, cy + 0.95, z);
        glass.frustumCulled = true;
        group.add(glass);
        for (const sx of [-0.95, 0.95]) for (const sz of [-0.45, 0.45]) {
          addBox(0.06, 1.6, 0.06, x + sx, cy + 0.95, z + sz, brass);
        }
        addBox(2.1, 0.08, 1.1, x, cy + 1.78, z, darkWood);
        addBox(0.7, 0.18, 0.04, x, cy + 0.35, z + 0.65, brass);
      }
      for (const dx of [-7, -2.5, 2.5, 7]) {
        addBox(2.0, 2.8, 0.4, cx + dx, cy + 1.4, cz - d / 2 + 0.35, darkWood, true);
        for (let r = 0; r < 5; r++) {
          for (let b = 0; b < 4; b++) {
            const col = [0xb71c1c, 0x1a237e, 0x33691e, 0xf9a825, 0x4a148c, 0x5d4037][(r + b) % 6];
            addBox(0.14, 0.32, 0.28, cx + dx - 0.7 + b * 0.4, cy + 0.35 + r * 0.5, cz - d / 2 + 0.4, this._mat(col, 0.7));
          }
        }
      }
      // Reading chairs + lamp between cases (edges of walk aisle)
      addArmchair(cx, cz + 5.5, 0x4e342e, Math.PI);
      addArmchair(cx + 2.2, cz + 5.5, 0x3e2723, Math.PI);
      addSideTable(cx + 1.1, cz + 6.5);
      addFloorLamp(cx - 2, cz + 6);
      // Velvet drapes on west wall
      for (const dz of [-3, 3]) {
        const curtain = new THREE.Mesh(new THREE.BoxGeometry(0.12, h * 0.7, 1.5), this._velvet(0x2e1a1a));
        curtain.position.set(cx - w / 2 + 0.35, cy + h * 0.4, cz + dz);
        group.add(curtain);
      }
    }

    if (id === "armoury") {
      addBox(6, 0.12, 0.45, cx, cy + 2.4, cz - d / 2 + 0.35, darkWood);
      for (const dx of [-2, 0, 2]) {
        addCyl(0.12, 0.15, 0.35, cx + dx, cy + 2.65, cz - d / 2 + 0.35, brass, 8);
        addBox(0.25, 0.08, 0.25, cx + dx, cy + 2.88, cz - d / 2 + 0.35, this._mat(0xffd54f, 0.35, 0.6));
      }
      addBox(2.4, 0.12, 2.4, cx + 2, cy + 0.85, cz + 1, this._wood(0x1b5e20, 0.55), true);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        addBox(0.12, 0.85, 0.12, cx + 2 + sx, cy + 0.42, cz + 1 + sz, wood);
      }
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
      addBox(3.2, 0.55, 1.1, cx - 4, cy + 0.45, cz + 4, this._velvet(0x283593), true);
      addBox(3.2, 0.7, 0.25, cx - 4, cy + 0.9, cz + 4.4, this._velvet(0x1a237e));
      for (const sx of [-1.4, 1.4]) addBox(0.3, 0.55, 1.0, cx - 4 + sx, cy + 0.7, cz + 4, this._velvet(0x1a237e));
      // Armor stands + cue rack along east wall
      for (const dz of [-4, 0, 4]) {
        addCyl(0.15, 0.2, 0.15, cx + w / 2 - 0.7, cy + 0.08, cz + dz, brass, 8);
        addCyl(0.12, 0.18, 1.4, cx + w / 2 - 0.7, cy + 0.85, cz + dz, this._mat(0xc0c0c0, 0.35, 0.7), 10);
        addCyl(0.22, 0.2, 0.35, cx + w / 2 - 0.7, cy + 1.7, cz + dz, this._mat(0xb0bec5, 0.4, 0.65), 10);
      }
      addBox(0.12, 1.6, 1.8, cx + w / 2 - 0.35, cy + 1.2, cz - 5, darkWood);
      for (let i = 0; i < 4; i++) {
        addCyl(0.025, 0.025, 1.5, cx + w / 2 - 0.5, cy + 1.1, cz - 5.6 + i * 0.35, this._wood(0x8d6e63), 6);
      }
      addFireplace(cx - 2, cz - d / 2 + 0.4, "south");
      addArmchair(cx + 5, cz + 4, 0x1a237e, -0.4);
      addSideTable(cx + 6.2, cz + 3.2);
    }

    if (id === "conservatory") {
      for (const [dx, dz] of [[-7, 2], [7, 2], [0, -5]]) {
        addBox(2.2, 0.12, 0.6, cx + dx, cy + 0.5, cz + dz, this._mat(0x8d6e63, 0.7), true);
        for (const sx of [-0.9, 0.9]) addBox(0.12, 0.5, 0.5, cx + dx + sx, cy + 0.25, cz + dz, this._mat(0x6d4c41, 0.75));
      }
      for (const [dx, dz] of [[-8, -6], [8, -6], [-4, 5], [4, 5]]) {
        addCyl(0.55, 0.65, 0.7, cx + dx, cy + 0.35, cz + dz, this._mat(0x6d4c41, 0.8), 12);
        addCyl(0.5, 0.5, 0.15, cx + dx, cy + 0.72, cz + dz, this._mat(0x3e2723, 0.9), 10);
        addCyl(0.35, 0.2, 0.9, cx + dx, cy + 1.2, cz + dz, this._mat(0x2e7d32, 0.85), 8);
        const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), this._mat(0x43a047, 0.88));
        foliage.position.set(cx + dx, cy + 1.7, cz + dz);
        foliage.frustumCulled = true;
        group.add(foliage);
      }
      for (const dx of [-5, 0, 5]) {
        addCyl(0.02, 0.02, 0.8, cx + dx, cy + 4.2, cz - 2, brass, 6);
        addCyl(0.28, 0.22, 0.25, cx + dx, cy + 3.7, cz - 2, this._mat(0x8d6e63, 0.75), 8);
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), this._mat(0x66bb6a, 0.85));
        leaf.position.set(cx + dx, cy + 3.55, cz - 2);
        group.add(leaf);
      }
      for (const [dx, dz] of [[-3, 0], [3, 0]]) {
        addCyl(0.55, 0.55, 0.06, cx + dx, cy + 0.85, cz + dz, this._mat(0x37474f, 0.4, 0.7), 12);
        addCyl(0.08, 0.1, 0.85, cx + dx, cy + 0.42, cz + dz, this._mat(0x263238, 0.45, 0.65), 8);
      }
      // Central birdbath / fountain basin (low — walkable around)
      addCyl(1.1, 1.2, 0.35, cx, cy + 0.2, cz + 3, this._mat(0x90a4ae, 0.5, 0.25), 20);
      const water = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 0.95, 0.06, 20),
        new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.2, metalness: 0.55, transparent: true, opacity: 0.7 })
      );
      water.position.set(cx, cy + 0.4, cz + 3);
      group.add(water);
      // Trellis strips on west/east inward
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          addBox(0.06, 2.4, 0.06, cx + side * (w / 2 - 0.5), cy + 1.3, cz - 5 + i * 2.5, this._mat(0xc9a227, 0.4, 0.4));
        }
        addBox(0.06, 0.06, 8, cx + side * (w / 2 - 0.5), cy + 2.4, cz - 1, this._mat(0xc9a227, 0.4, 0.4));
      }
    }

    if (id === "dining") {
      addBox(7.5, 0.14, 2.8, cx, cy + 0.88, cz, darkWood, true);
      for (const sx of [-3.2, 3.2]) for (const sz of [-1.0, 1.0]) {
        addBox(0.14, 0.88, 0.14, cx + sx, cy + 0.44, cz + sz, wood);
      }
      for (let i = -2; i <= 2; i++) {
        for (const side of [-1, 1]) {
          const x = cx + i * 1.35;
          const z = cz + side * 1.85;
          addBox(0.45, 0.08, 0.45, x, cy + 0.5, z, wood);
          addBox(0.45, 0.55, 0.08, x, cy + 0.8, z + side * 0.18, this._velvet(0x5d4037));
          for (const lx of [-0.15, 0.15]) addBox(0.06, 0.5, 0.06, x + lx, cy + 0.25, z, wood);
        }
      }
      addBox(4.5, 1.0, 0.55, cx, cy + 0.5, cz - d / 2 + 0.5, darkWood, true);
      addBox(4.5, 0.08, 0.58, cx, cy + 1.05, cz - d / 2 + 0.5, brass);
      for (let i = -2; i <= 2; i++) {
        for (const side of [-1, 1]) {
          addCyl(0.14, 0.14, 0.03, cx + i * 1.35, cy + 0.98, cz + side * 0.7, this._mat(0xfafafa, 0.4), 12);
          addCyl(0.05, 0.06, 0.1, cx + i * 1.35 + 0.22, cy + 1.02, cz + side * 0.7, this._mat(0xffe0b2, 0.35), 8);
        }
      }
      addBox(7.7, 0.02, 2.95, cx, cy + 0.96, cz, this._cloth(0xf5e6d3, 0.92));
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
      // China cabinet + fireplace + candelabra
      addBox(1.8, 2.4, 0.5, cx - w / 2 + 1.1, cy + 1.2, cz + 3, darkWood, true);
      for (let r = 0; r < 4; r++) {
        addBox(1.5, 0.06, 0.4, cx - w / 2 + 1.1, cy + 0.5 + r * 0.55, cz + 3, wood);
        for (let i = 0; i < 3; i++) {
          addCyl(0.08, 0.08, 0.12, cx - w / 2 + 0.6 + i * 0.4, cy + 0.62 + r * 0.55, cz + 3, this._mat(0xeceff1, 0.3), 8);
        }
      }
      addFireplace(cx + 4, cz - d / 2 + 0.4, "south");
      // Centerpiece candelabra (emissive)
      addCyl(0.08, 0.12, 0.25, cx, cy + 1.15, cz, brass, 8);
      for (const a of [0, 2.1, 4.2]) {
        const bx = cx + Math.cos(a) * 0.25;
        const bz = cz + Math.sin(a) * 0.25;
        addCyl(0.02, 0.02, 0.35, bx, cy + 1.35, bz, brass, 5);
        const flame = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), this._emissiveGlow(0xffcc80, 1.1));
        flame.position.set(bx, cy + 1.55, bz);
        group.add(flame);
      }
    }

    if (id === "workshop" || id === "cellar") {
      addBox(8.5, 0.14, 1.4, cx, cy + 0.95, cz - d * 0.28, this._wood(0x6d4c41), true);
      for (const sx of [-3.5, 3.5]) addBox(0.15, 0.95, 1.2, cx + sx, cy + 0.47, cz - d * 0.28, wood);
      addBox(3.5, 2.0, 0.08, cx - w / 2 + 0.2, cy + 1.8, cz, this._mat(0x795548, 0.75));
      for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
        addCyl(0.03, 0.03, 0.12, cx - w / 2 + 0.28, cy + 1.1 + r * 0.4, cz - 1.2 + c * 0.55, brass, 6);
      }
      for (const [dx, dz] of [[3, 3], [4.5, 2.5], [-4, 4]]) {
        addBox(0.8, 0.55, 0.7, cx + dx, cy + 0.28, cz + dz, this._wood(0x8d6e63));
      }
      addCyl(0.28, 0.3, 0.08, cx + 2, cy + 0.55, cz - d * 0.1, wood, 10);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        addCyl(0.04, 0.04, 0.55, cx + 2 + Math.cos(a) * 0.18, cy + 0.27, cz - d * 0.1 + Math.sin(a) * 0.18, wood, 6);
      }
      // Tool chest + hanging lamp mesh + jar shelf
      addBox(1.4, 0.9, 0.7, cx + w / 2 - 1.2, cy + 0.45, cz + 2, this._mat(0xffc107, 0.55, 0.35), true);
      addBox(1.45, 0.08, 0.75, cx + w / 2 - 1.2, cy + 0.92, cz + 2, this._mat(0xffa000, 0.45, 0.4));
      addBox(2.5, 0.1, 0.35, cx + w / 2 - 0.4, cy + 2.0, cz - 2, wood);
      for (let i = 0; i < 5; i++) {
        addCyl(0.08, 0.09, 0.2, cx + w / 2 - 0.4, cy + 2.15, cz - 2.8 + i * 0.4, this._glass(0x81d4fa, 0.35), 8);
      }
      addCyl(0.04, 0.04, 0.6, cx, cy + h - 0.5, cz - d * 0.1, brass, 6);
      const shopLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.25, 10), this._emissiveGlow(0xffe082, 0.95));
      shopLamp.position.set(cx, cy + h - 0.85, cz - d * 0.1);
      group.add(shopLamp);
      if (id === "cellar") {
        // Barrels + wine rack + furnace
        for (const [dx, dz] of [[-6, 5], [-6, 3], [6, 5]]) {
          addCyl(0.45, 0.48, 0.85, cx + dx, cy + 0.42, cz + dz, this._wood(0x5d4037), 14);
          addCyl(0.48, 0.48, 0.06, cx + dx, cy + 0.88, cz + dz, this._brass(0x8d6e63), 14);
        }
        for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
          addCyl(0.1, 0.1, 0.35, cx + 5.5, cy + 0.4 + r * 0.45, cz - 2 + c * 0.4, this._mat(0x4a148c, 0.5), 8);
        }
        addBox(1.8, 1.6, 1.0, cx - 5, cy + 0.8, cz - 4, this._mat(0x37474f, 0.55, 0.3));
        const furnaceGlow = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.1), this._emissiveGlow(0xff6d00, 1.0));
        furnaceGlow.position.set(cx - 5, cy + 0.6, cz - 3.45);
        group.add(furnaceGlow);
        // Ceiling pipes
        for (const z of [cz - 3, cz + 2]) {
          addCyl(0.08, 0.08, w * 0.7, cx, cy + h - 0.35, z, this._mat(0x78909c, 0.4, 0.55), 8);
          group.children[group.children.length - 1].rotation.z = Math.PI / 2;
        }
      }
    }

    if (id === "music") {
      addBox(10, 0.9, 0.55, cx, cy + 0.45, cz + d / 2 - 0.55, this._wood(0x4a148c, 0.55, 0.15), true);
      for (const dx of [-6, -2, 2, 6]) {
        addCyl(0.03, 0.04, 1.3, cx + dx, cy + 0.65, cz - 2, brass, 6);
        addBox(0.55, 0.4, 0.04, cx + dx, cy + 1.4, cz - 2, this._mat(0x212121, 0.6));
        const sheet = new THREE.Mesh(
          new THREE.PlaneGeometry(0.4, 0.3),
          new THREE.MeshStandardMaterial({ color: 0xfff8e1, roughness: 0.9, emissive: 0xfff8e1, emissiveIntensity: 0.05 })
        );
        sheet.position.set(cx + dx, cy + 1.4, cz - 2.03);
        group.add(sheet);
      }
      for (const dx of [-4, -1.5, 1.5, 4]) {
        addBox(0.5, 0.08, 0.5, cx + dx, cy + 0.48, cz + 3, wood);
        addBox(0.5, 0.5, 0.08, cx + dx, cy + 0.75, cz + 3.2, this._velvet(0x6a1b9a));
      }
      for (const side of [-1, 1]) {
        const curtain = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, h * 0.75, 1.8),
          this._velvet(side < 0 ? 0x4a148c : 0x6a1b9a)
        );
        curtain.position.set(cx + side * (w / 2 - 0.4), cy + h * 0.4, cz - d / 2 + 1.2);
        group.add(curtain);
      }
      // Harp silhouette + sheet cabinet + piano bench
      addBox(0.15, 1.6, 0.6, cx - 7, cy + 1.0, cz - 5, this._wood(0xc9a227, 0.45, 0.35));
      addCyl(0.4, 0.05, 1.5, cx - 7, cy + 1.0, cz - 5.2, this._wood(0xffe082, 0.5), 8);
      addBox(1.2, 1.4, 0.45, cx + 7, cy + 0.7, cz + 2, darkWood);
      for (let r = 0; r < 4; r++) addBox(1.0, 0.05, 0.35, cx + 7, cy + 0.35 + r * 0.3, cz + 2, this._mat(0xfff8e1, 0.85));
      addBox(1.0, 0.1, 0.4, cx, cy + 0.5, cz - 5.5, this._velvet(0x4a148c));
      for (const sx of [-0.35, 0.35]) addBox(0.08, 0.45, 0.08, cx + sx, cy + 0.25, cz - 5.5, wood);
      addFloorLamp(cx + 6, cz - 4);
    }

    if (id === "nursery") {
      addBox(1.6, 0.7, 0.9, cx + 5, cy + 0.35, cz + 4, this._wood(0xe91e63, 0.7), true);
      addBox(1.65, 0.08, 0.95, cx + 5, cy + 0.74, cz + 4, brass);
      addBox(2.2, 0.35, 1.2, cx - 4, cy + 0.4, cz + 3, this._wood(0xf8bbd0, 0.75), true);
      addBox(2.3, 0.7, 0.08, cx - 4, cy + 0.7, cz + 3.55, this._wood(0xf48fb1));
      addBox(2.3, 0.7, 0.08, cx - 4, cy + 0.7, cz + 2.45, this._wood(0xf48fb1));
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
      // Rocking chair + bookshelf + hanging mobile
      addArmchair(cx + 4, cz - 4, 0xf8bbd0, 0.5);
      addBox(1.6, 1.8, 0.4, cx - w / 2 + 0.5, cy + 0.9, cz - 3, this._wood(0xf48fb1, 0.7));
      for (let r = 0; r < 3; r++) for (let b = 0; b < 4; b++) {
        const col = [0xf44336, 0x2196f3, 0xffeb3b, 0x4caf50][b];
        addBox(0.22, 0.28, 0.18, cx - w / 2 + 0.5 - 0.5 + b * 0.35, cy + 0.35 + r * 0.5, cz - 3, this._mat(col, 0.65));
      }
      addCyl(0.02, 0.02, 0.8, cx, cy + h - 0.5, cz + 1, brass, 5);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const star = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), this._mat([0xffeb3b, 0xe91e63, 0x42a5f5, 0x66bb6a, 0xff9800][i], 0.5));
        star.position.set(cx + Math.cos(a) * 0.5, cy + h - 1.1, cz + 1 + Math.sin(a) * 0.5);
        group.add(star);
      }
      addSideTable(cx + 5.5, cz - 3);
    }

    if (id === "study") {
      addBox(7.5, 0.14, 1.5, cx, cy + 0.95, cz + d * 0.25, darkWood, true);
      for (const sx of [-3, 3]) addBox(0.12, 0.95, 1.3, cx + sx, cy + 0.47, cz + d * 0.25, wood);
      addBox(0.55, 0.1, 0.55, cx, cy + 0.55, cz + d * 0.25 + 1.2, wood);
      addBox(0.55, 0.65, 0.1, cx, cy + 0.9, cz + d * 0.25 + 1.4, this._velvet(0x37474f));
      addCyl(0.04, 0.05, 0.35, cx - 2.5, cy + 1.2, cz + d * 0.25, brass, 8);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), this._emissiveGlow(0xffe0b2, 1.0));
      lamp.position.set(cx - 2.5, cy + 1.45, cz + d * 0.25);
      group.add(lamp);
      for (let i = 0; i < 4; i++) {
        const col = [0xb71c1c, 0x1a237e, 0x33691e, 0xf9a825][i];
        addBox(0.35, 0.08, 0.25, cx + 2 + (i % 2) * 0.05, cy + 1.05 + i * 0.09, cz + d * 0.25, this._mat(col, 0.7));
      }
      // Darkroom curtain + filing cabinet + chemical bottles + armchair
      const darkCurtain = new THREE.Mesh(new THREE.BoxGeometry(0.1, h * 0.75, 2.2), this._velvet(0x212121));
      darkCurtain.position.set(cx - w / 2 + 0.35, cy + h * 0.4, cz - 2);
      group.add(darkCurtain);
      addBox(0.9, 1.2, 0.55, cx + w / 2 - 0.7, cy + 0.6, cz - 4, this._mat(0x455a64, 0.55, 0.25));
      for (let i = 0; i < 3; i++) addBox(0.8, 0.04, 0.5, cx + w / 2 - 0.7, cy + 0.35 + i * 0.35, cz - 4, this._mat(0x90a4ae, 0.4, 0.3));
      for (let i = 0; i < 4; i++) {
        addCyl(0.06, 0.07, 0.22, cx - 3 + i * 0.35, cy + 1.15, cz + d * 0.25 - 0.4, this._glass([0xef9a9a, 0xa5d6a7, 0x90caf9, 0xffe082][i], 0.4), 8);
      }
      addArmchair(cx - 4, cz + 4, 0x37474f, 0.6);
      addFloorLamp(cx - 5.5, cz + 3);
      addFireplace(cx + 2, cz - d / 2 + 0.4, "south");
    }

    if (id === "library_hall") {
      for (const side of [-1, 1]) {
        const x = cx + side * (w / 2 - 0.35);
        for (let zi = -3; zi <= 2; zi++) { // logic3: zi=3 shelf stood in the crest corridor
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
      // Reading nook table + chairs at north end (edge of hall)
      addBox(1.4, 0.1, 1.4, cx, cy + 0.75, cz - 7, darkWood, true);
      for (const [sx, sz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
        addBox(0.08, 0.75, 0.08, cx + sx, cy + 0.37, cz - 7 + sz, wood);
      }
      addArmchair(cx - 1.3, cz - 5.5, 0x5d4037, 0.3);
      addArmchair(cx + 1.3, cz - 5.5, 0x4e342e, -0.3);
      // Library ladder
      addBox(0.08, 2.4, 0.08, cx - w / 2 + 0.7, cy + 1.2, cz + 2, wood);
      addBox(0.08, 2.4, 0.08, cx - w / 2 + 1.15, cy + 1.2, cz + 2, wood);
      for (let i = 0; i < 7; i++) addBox(0.5, 0.05, 0.05, cx - w / 2 + 0.92, cy + 0.25 + i * 0.32, cz + 2, wood);
      addFloorLamp(cx + 0.8, cz - 8);
    }

    if (id === "landing") {
      // Solid newel / pillar for Drive landing hairpin (hard collider)
      {
        const nx = -2.20, nz = 2.20, ny = 4.2;
        const newelMat = this._mat(0x4e342e, 0.55, 0.25);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.35, 0.55), newelMat);
        post.position.set(nx, ny + 0.675, nz);
        post.castShadow = false;
        post.receiveShadow = true;
        group.add(post);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.14, 10), this._brass());
        cap.position.set(nx, ny + 1.40, nz);
        group.add(cap);
        this._pushCollider(
          new THREE.Box3(
            new THREE.Vector3(nx - 0.30, ny - 0.02, nz - 0.30),
            new THREE.Vector3(nx + 0.30, ny + 1.55, nz + 0.30)
          ),
          "pillar"
        );
      }

      // logic3 decor: lanes run x≈0 (south) and x≈4.4 (north); decor lives in the
      // centre island x∈[1.2,3.2] and the west strip x∈[-3.5,-1.3] — never on asphalt.
      addCyl(0.22, 0.28, 0.45, cx + 2.2, cy + 0.22, cz - 2.9, this._mat(0x8d6e63, 0.8), 10);
      const plant = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), this._mat(0x2e7d32, 0.88));
      plant.position.set(cx + 2.2, cy + 0.7, cz - 2.9);
      group.add(plant);
      // Console + mirror (centre island, narrowed to 1.5)
      addBox(1.5, 0.12, 0.6, cx + 2.2, cy + 0.85, cz + 2, darkWood, true);
      for (const sx of [-0.6, 0.6]) addBox(0.1, 0.85, 0.1, cx + 2.2 + sx, cy + 0.42, cz + 2, wood);
      addBox(0.5, 0.7, 0.04, cx + 2.2, cy + 1.4, cz + 2.25, this._mat(0xd1c4e9, 0.5));
      // Bench — logic6: was across the west strip at z=7.4, right in front of the relocated
      // attic stair foot (z=7.2). Now tucked lengthwise UNDER the stair (stair underside ≥2.2
      // above it), clear of the newel (z 1.9..2.5) and the foot approach.
      addBox(0.55, 0.12, 1.3, cx - 2.4, cy + 0.48, cz - 0.6, this._velvet(0x5e35b1));
      for (const sz of [-0.5, 0.5]) addBox(0.5, 0.48, 0.12, cx - 2.4, cy + 0.24, cz - 0.6 + sz, wood);
      addFloorLamp(cx + 2.2, cz + 0.2);
      addArmchair(cx + 2.2, cz + 4.6, 0x4527a0, -0.5);
      // Balcony-side curtains
      for (const side of [-1, 1]) {
        const curtain = new THREE.Mesh(new THREE.BoxGeometry(0.12, h * 0.65, 1.0), this._velvet(0x5e35b1));
        curtain.position.set(cx + side * 3, cy + h * 0.38, cz + d / 2 - 0.5);
        group.add(curtain);
      }
    }

    if (id === "hall_ground") {
      // Consoles hug the plaster (outside Drive skirting ~0.55–0.7 m inset) so
      // Explore walk lane beside the asphalt ribbon stays clear — no prop theft.
      for (const z of [cz - 8, cz, cz + 6]) {
        for (const side of [-1, 1]) {
          const x = cx + side * (w / 2 - 0.28);
          addBox(0.28, 0.88, 1.15, x, cy + 0.44, z, darkWood, true);
          addBox(0.32, 0.07, 1.2, x, cy + 0.90, z, brass);
          const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.32, 8), this._mat(0x90a4ae, 0.4, 0.3));
          vase.position.set(x, cy + 1.1, z);
          group.add(vase);
        }
      }
      for (const z of [cz - 4, cz + 3]) {
        addBox(1.6, 0.12, 0.5, cx, cy + 0.48, z, this._velvet(0x4e342e));
        for (const sx of [-0.6, 0.6]) addBox(0.1, 0.48, 0.45, cx + sx, cy + 0.24, z, wood);
      }
      addFloorLamp(cx + 3.3, cz - 10); // logic26: was in the Climb A lane (cx+2.2)
      addFloorLamp(cx - 2.2, cz + 8);
    }

    if (id === "hall_east" || id === "study_annex") {
      addCyl(0.22, 0.28, 0.45, cx + w * 0.3, cy + 0.22, cz - d * 0.3, this._mat(0x8d6e63, 0.8), 10);
      const plant2 = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), this._mat(0x2e7d32, 0.88));
      plant2.position.set(cx + w * 0.3, cy + 0.7, cz - d * 0.3);
      group.add(plant2);
      addBox(1.8, 0.12, 0.55, cx, cy + 0.85, cz + d * 0.25, darkWood, true);
      for (const sx of [-0.7, 0.7]) addBox(0.1, 0.85, 0.1, cx + sx, cy + 0.42, cz + d * 0.25, wood);
      addArmchair(cx - 2, cz - 2, id === "hall_east" ? 0x4e342e : 0x455a64, 0.4);
      addSideTable(cx - 2.8, cz - 1);
      addFloorLamp(cx + 2.5, cz - 2.5);
      if (id === "study_annex") {
        addBox(2.2, 0.12, 0.9, cx + 1, cy + 0.9, cz - 2, darkWood);
        for (const sx of [-0.9, 0.9]) addBox(0.1, 0.9, 0.8, cx + 1 + sx, cy + 0.45, cz - 2, wood);
        for (let i = 0; i < 3; i++) {
          addBox(0.3, 0.06, 0.22, cx + 0.5 + i * 0.35, cy + 1.0, cz - 2, this._mat([0xb71c1c, 0x1a237e, 0xf9a825][i], 0.7));
        }
      }
      // Pedestal busts
      for (const side of [-1, 1]) {
        addCyl(0.25, 0.3, 0.7, cx + side * 2.5, cy + 0.35, cz - d / 2 + 0.7, this._mat(0x90a4ae, 0.5, 0.25), 10);
        addCyl(0.15, 0.18, 0.35, cx + side * 2.5, cy + 0.9, cz - d / 2 + 0.7, this._mat(0xeceff1, 0.45), 10);
      }
    }

    if (id === "attic_loft") {
      // logic6: the [-3,7] crate (world -3,1) blocked the attic_up stair top (z=1.7) → moved east.
      for (const [dx, dz] of [[-5, 3], [5, -3], [-7, -6], [7, 5], [1.5, 8], [4, -7]]) {
        addBox(1.0 + (dx > 0 ? 0.2 : 0), 0.7, 0.8, cx + dx, cy + 0.35, cz + dz, this._wood(0x6d4c41));
      }
      // logic6: low balustrade round the attic stairwell (west, east, south sides; the north
      // side is the stair's top exit). Explore colliders so nobody walks into the well.
      {
        const W = ATTIC_STAIRWELL, ry = cy + 0.45, rh = 0.9, t = 0.07;
        const railM = brass;
        const lenZ = W.maxZ - W.minZ, midZ = (W.minZ + W.maxZ) / 2;
        for (const x of [W.minX - t / 2, W.maxX + t / 2]) {
          addBox(t, 0.06, lenZ, x, cy + rh, midZ, railM);
          for (const z of [W.minZ + 0.05, midZ, W.maxZ - 0.05]) addBox(t, rh, t, x, ry, z, railM);
          this._pushCollider(new THREE.Box3(
            new THREE.Vector3(x - 0.06, cy - 0.02, W.minZ), new THREE.Vector3(x + 0.06, cy + rh + 0.05, W.maxZ)), "wall");
        }
        const zs = W.maxZ + t / 2, lenX = W.maxX - W.minX + t * 2, midX = (W.minX + W.maxX) / 2;
        addBox(lenX, 0.06, t, midX, cy + rh, zs, railM);
        addBox(t, rh, t, midX, ry, zs, railM);
        this._pushCollider(new THREE.Box3(
          new THREE.Vector3(W.minX - t, cy - 0.02, zs - 0.06), new THREE.Vector3(W.maxX + t, cy + rh + 0.05, zs + 0.06)), "wall");
      }
      // Trunks + dress form + oil lamps + cobweb strings
      for (const [dx, dz] of [[-8, 0], [8, 2]]) {
        addBox(1.3, 0.55, 0.7, cx + dx, cy + 0.28, cz + dz, this._wood(0x5d4037));
        addBox(1.35, 0.08, 0.75, cx + dx, cy + 0.58, cz + dz, brass);
      }
      addCyl(0.15, 0.25, 1.3, cx + 6, cy + 0.85, cz + 6, this._mat(0xefebe9, 0.7), 10);
      addCyl(0.28, 0.2, 0.35, cx + 6, cy + 1.65, cz + 6, this._cloth(0xd7ccc8));
      for (const [dx, dz] of [[-4, -4], [3, 4]]) {
        addCyl(0.05, 0.06, 0.25, cx + dx, cy + 0.9, cz + dz, brass, 6);
        const oil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), this._emissiveGlow(0xffcc80, 0.85));
        oil.position.set(cx + dx, cy + 1.1, cz + dz);
        group.add(oil);
      }
      // Low attic beams already; add stacked books / hatboxes at edges
      for (let i = 0; i < 4; i++) {
        addCyl(0.25, 0.25, 0.2, cx - 6, cy + 0.15 + i * 0.22, cz + 8, this._mat([0xb71c1c, 0x5d4037, 0x1a237e, 0xf9a825][i], 0.7), 12);
      }
    }

    if (id === "science_attic") {
      for (const [dx, dz] of [[-5, 3], [5, -3]]) {
        addBox(1.0, 0.7, 0.8, cx + dx, cy + 0.35, cz + dz, this._wood(0x6d4c41));
      }
      // Lab bench + shelves + chalkboard + specimen jars
      addBox(6, 0.12, 1.0, cx, cy + 0.9, cz + 2, this._mat(0x90a4ae, 0.45, 0.35), true);
      for (const sx of [-2.5, 2.5]) addBox(0.12, 0.9, 0.9, cx + sx, cy + 0.45, cz + 2, this._mat(0x607d8b, 0.5, 0.3));
      addBox(3.5, 1.8, 0.08, cx - w / 2 + 0.2, cy + 1.5, cz, this._mat(0x37474f, 0.7));
      // chalk tray
      addBox(3.2, 0.06, 0.12, cx - w / 2 + 0.3, cy + 0.55, cz, this._mat(0xcfd8dc, 0.5));
      for (let i = 0; i < 6; i++) {
        addCyl(0.08, 0.09, 0.28, cx - 2 + i * 0.7, cy + 1.12, cz + 2, this._glass([0xef9a9a, 0xa5d6a7, 0x90caf9, 0xffe082, 0xce93d8, 0x80cbc4][i], 0.4), 8);
      }
      addBox(2.2, 2.0, 0.35, cx + w / 2 - 0.4, cy + 1.0, cz - 2, this._mat(0x455a64, 0.6));
      for (let r = 0; r < 4; r++) for (let b = 0; b < 3; b++) {
        addBox(0.35, 0.12, 0.22, cx + w / 2 - 0.4, cy + 0.35 + r * 0.45, cz - 2.5 + b * 0.4, this._mat(0xb0bec5, 0.5));
      }
      addFloorLamp(cx - 3, cz - 2.5); // logic26: was standing in the Science Ring lane (cx+4, cz+3)
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
          new THREE.BoxGeometry(surface === "planter" ? 0.95 : 1.2, 0.1, 0.75),
          this._mat(outdoor ? 0x8d6e63 : 0x6d4c41, 0.55, 0.12)
        );
        top.position.set(px, cy + 0.85, pz);
        group.add(top);
        for (const sx of [-0.45, 0.45]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.1), this._mat(0x4e342e, 0.7));
          leg.position.set(px + sx, cy + 0.42, pz);
          group.add(leg);
          // logic24 (Ben t188u): the Lab Garage bench by the Timber Lawn exit — its legs were drive-through
          if (room.id === "carriage_yard") this.colliders.push(new THREE.Box3(new THREE.Vector3(px + sx - 0.05, cy, pz - 0.05), new THREE.Vector3(px + sx + 0.05, cy + 0.85, pz + 0.05)));
        }
      } else if (surface === "garden") {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.38, 10), this._mat(0xa1887f, 0.75));
        pot.position.set(px, cy + 0.2, pz);
        group.add(pot);
      } else if (surface === "shelf" || surface === "stand") {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.09, 0.55), this._mat(p.trim, 0.42, 0.35));
        shelf.position.set(px, cy + 0.95, pz);
        group.add(shelf);
      }
      // rug / floor: no extra prop

      const obj = buildLayerShells(def);
      let yOff = 1.02; // pedestal top ~0.97
      if (def.monument) yOff = 0.5;
      else if (surface === "rug" || surface === "floor") yOff = 0.42;
      else if (surface === "garden") yOff = 0.58;
      else if (surface === "rock" || surface === "stump" || surface === "crate") yOff = 0.72;
      else if (surface === "pedestal") yOff = 1.02;
      else if (surface === "table" || surface === "bench" || surface === "desk" || surface === "planter" || surface === "shelf" || surface === "stand") yOff = 1.08;
      obj.position.set(px, cy + yOff, pz);
      if (def.monument) obj.scale.multiplyScalar(1.1);
      // logic26 audit: one fixed yOff per surface left small curios hovering up to 28 cm and big ones sunk up to 31 cm
      // into their pedestal / bench / crate / pot. Sit every curio's lowest point exactly on its support's top.
      {
        const SUP = { pedestal: 0.97, crate: 0.5, stump: 0.55, rock: 0.6, table: 0.9, bench: 0.9, desk: 0.9, planter: 0.9, shelf: 0.995, stand: 0.995, garden: 0.39, rug: 0.05, floor: 0.0 };
        obj.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(obj);
        if (Number.isFinite(bb.min.y)) { obj.position.y += cy + (def.monument ? 0 : (SUP[surface] ?? 0.97)) + 0.004 - bb.min.y; yOff = obj.position.y - cy; }
        obj.userData.supportY = cy + (def.monument ? 0 : (SUP[surface] ?? 0.97));
      }
      obj.userData.interactable = true;
      obj.userData.objectId = def.id;
      obj.visible = true;
      obj.traverse((o) => {
        if (o.isMesh) {
          o.visible = true;
          o.frustumCulled = true;
        }
      });
      group.add(obj);
      this.interactives.push(obj);

      // Accent plinth / under-glow for non-pedestal surfaces so curios read in dark rooms
      if (surface !== "pedestal" && surface !== "floor" && surface !== "rug" && !def.monument) {
        const accent = new THREE.Mesh(
          new THREE.RingGeometry(0.22, 0.38, 24),
          new THREE.MeshBasicMaterial({
            color: 0xffe082,
            transparent: true,
            opacity: 0.28,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        accent.rotation.x = -Math.PI / 2;
        accent.position.set(px, cy + ({ crate: 0.5, stump: 0.55, rock: 0.6, garden: 0.39, shelf: 0.995, stand: 0.995 }[surface] ?? 0.9) + 0.003, pz); // logic26: on the support top (it hovered mid-air)
        accent.renderOrder = 1;
        group.add(accent);
        obj.userData.accent = accent;
      }

      // Generous hit proxy — small shells were easy to miss with the crosshair
      const hitR = def.monument ? 2.2 : 1.15;
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(hitR, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.copy(obj.position);
      hit.userData.interactable = true;
      hit.userData.objectId = def.id;
      hit.userData.target = obj;
      obj.userData.hitProxy = hit;
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
    const woodFrame = this._mat(0x3e2723, 0.48, 0.18);
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1) - 0.5) * 0.7;
      const wx = horizontal ? px + t * sx : px;
      const wz = horizontal ? pz : pz + t * sz;
      const wy = floorY + 2.05;
      // Deep recess for architectural read
      const recess = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 1.62 : 0.2, 2.12, horizontal ? 0.2 : 1.62),
        this._mat(0x140e0a, 0.88)
      );
      recess.position.set(wx, wy, wz);
      recess.frustumCulled = true;
      group.add(recess);
      // Outer wood casing
      const casing = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 1.52 : 0.16, 2.02, horizontal ? 0.16 : 1.52),
        woodFrame
      );
      casing.position.set(wx, wy, wz);
      group.add(casing);
      // Inner brass frame
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 1.38 : 0.12, 1.86, horizontal ? 0.12 : 1.38),
        trim
      );
      frame.position.set(wx, wy, wz);
      group.add(frame);
      // Warm leisurely pane (emissive mood — no PointLight)
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 1.12 : 0.055, 1.52, horizontal ? 0.055 : 1.12),
        new THREE.MeshStandardMaterial({
          color: 0xfff0d8, emissive: p.light, emissiveIntensity: 0.88,
          roughness: 0.12, metalness: 0.12, transparent: true, opacity: 0.48,
        })
      );
      glow.position.set(wx, wy, wz);
      group.add(glow);
      // 4-lite mullion grid (premium sash feel)
      const mullMat = trim;
      for (const dy of [-0.38, 0.38]) {
        const mullH = new THREE.Mesh(
          new THREE.BoxGeometry(horizontal ? 1.12 : 0.035, 0.045, horizontal ? 0.045 : 1.12),
          mullMat
        );
        mullH.position.set(wx, wy + dy, wz);
        group.add(mullH);
      }
      const mullMid = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 1.12 : 0.04, 0.05, horizontal ? 0.05 : 1.12),
        mullMat
      );
      mullMid.position.set(wx, wy, wz);
      group.add(mullMid);
      const mullV = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 0.05 : 0.035, 1.52, horizontal ? 0.035 : 0.05),
        mullMat
      );
      mullV.position.set(wx, wy, wz);
      group.add(mullV);
      // Deep sill + apron
      const sill = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 1.62 : 0.26, 0.09, horizontal ? 0.26 : 1.62),
        trim
      );
      sill.position.set(wx, wy - 1.02, wz);
      group.add(sill);
      const apron = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 1.48 : 0.1, 0.12, horizontal ? 0.1 : 1.48),
        woodFrame
      );
      apron.position.set(wx, wy - 1.14, wz);
      group.add(apron);
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
        this._emissiveGlow(0xffe0b2, 1.12)
      );
      bulb.position.set(bx, y - 0.42, bz);
      group.add(bulb);
    }
    const center = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 8),
      this._emissiveGlow(0xffcc80, 0.95)
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
      const artTex = this._artTex(seed);
      const artMat = this._stdMat({
        ...(artTex ? { map: artTex } : { color: 0x5d4037 }),
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
    // Derive from exits so openings always match connected rooms.
    const dirs = {};
    const exits = room.exits || {};
    for (const dir of ["north", "south", "east", "west"]) {
      const destId = exits[dir];
      if (!destId) continue;
      const dest = ROOMS[destId];
      // Indoor↔indoor, or indoor→named outdoor approach (front_drive / terrace / balcony)
      if (dest || destId === "front_drive" || destId === "terrace" || destId === "balcony") {
        dirs[dir] = true;
      }
    }
    // Landing south opens onto the exterior balcony approach
    if (room.id === "landing") dirs.south = true;
    // Conservatory north opens to terrace gardens
    if (room.id === "conservatory") dirs.north = true;
    // Foyer south opens to front drive
    if (room.id === "foyer") dirs.south = true;
    return dirs;
  }

  /**
   * Story-aware floor bridges through doorway gaps so rooms that don't
   * perfectly abut still connect — no drop-through, no invisible blockers.
   */
  _buildDoorConnectors() {
    const opposite = { north: "south", south: "north", east: "west", west: "east" };
    const done = new Set();
    const doorW = 2.8; // slightly wider than wall opening for foot path
    for (const room of Object.values(ROOMS)) {
      if (room.outdoor) continue;
      const exits = room.exits || {};
      for (const dir of ["north", "south", "east", "west"]) {
        const destId = exits[dir];
        if (!destId || !ROOMS[destId] || ROOMS[destId].outdoor) continue;
        const key = [room.id, destId].sort().join(">");
        if (done.has(key)) continue;
        done.add(key);
        const dest = ROOMS[destId];
        // Only connect if dest also exits back (or we force bidirectional floor)
        const back = opposite[dir];
        if (!(dest.exits && (dest.exits[back] === room.id))) {
          // still bridge if dest lists us under any horizontal exit
          const listsBack = dest.exits && Object.values(dest.exits).includes(room.id);
          if (!listsBack) continue;
        }

        const [w1, , d1] = room.size;
        const [cx1, cy1, cz1] = room.pos;
        const [w2, , d2] = dest.size;
        const [cx2, cy2, cz2] = dest.pos;
        if (Math.abs(cy1 - cy2) > 0.2) continue; // same story only

        let minX, maxX, minZ, maxZ;
        if (dir === "north" || dir === "south") {
          // Bridge along Z between the facing wall edges (pad so walk never drops)
          const edge1 = dir === "north" ? cz1 - d1 / 2 : cz1 + d1 / 2;
          const edge2 = dir === "north" ? cz2 + d2 / 2 : cz2 - d2 / 2;
          minZ = Math.min(edge1, edge2) - 0.28;
          maxZ = Math.max(edge1, edge2) + 0.28;
          const midX = (cx1 + cx2) / 2;
          minX = midX - doorW / 2 - 0.12;
          maxX = midX + doorW / 2 + 0.12;
        } else {
          const edge1 = dir === "west" ? cx1 - w1 / 2 : cx1 + w1 / 2;
          const edge2 = dir === "west" ? cx2 + w2 / 2 : cx2 - w2 / 2;
          minX = Math.min(edge1, edge2) - 0.28;
          maxX = Math.max(edge1, edge2) + 0.28;
          const midZ = (cz1 + cz2) / 2;
          minZ = midZ - doorW / 2 - 0.12;
          maxZ = midZ + doorW / 2 + 0.12;
        }

        // Always add a high-priority floor strip so gaps never drop to lawn
        this.floorRegions.push({
          minX, maxX, minZ, maxZ,
          y: cy1,
          priority: 6,
          roomId: `connector_${room.id}_${destId}`,
        });

        // Visual floor plank only when there is a real gap (> ~0.35 m)
        const gap = (dir === "north" || dir === "south")
          ? Math.abs((dir === "north" ? cz1 - d1 / 2 : cz1 + d1 / 2) - (dir === "north" ? cz2 + d2 / 2 : cz2 - d2 / 2))
          : Math.abs((dir === "west" ? cx1 - w1 / 2 : cx1 + w1 / 2) - (dir === "west" ? cx2 + w2 / 2 : cx2 - w2 / 2));
        if (gap > 0.35) {
          const plank = new THREE.Mesh(
            new THREE.BoxGeometry(Math.max(0.2, maxX - minX), 0.08, Math.max(0.2, maxZ - minZ)),
            this._mat(0x5d4037, 0.82, 0.05)
          );
          // Top ≈ cy1+0.012 — above room plank top, only drawn in real gaps
          plank.position.set((minX + maxX) / 2, cy1 - 0.028, (minZ + maxZ) / 2);
          plank.receiveShadow = true;
          plank.name = `door_bridge_${room.id}_${destId}`;
          this.root.add(plank);
        }
      }
    }
  }

  _addWallWithDoor(group, wall, color, thick, trimColor, usePlaster = false) {
    const [sx, sy, sz] = wall.size;
    const [px, py, pz] = wall.pos;
    // Per-wall override: landing south uses ~11m French-door aperture (matches facade).
    const doorW = wall.doorW || 3.05; // Explore-clear near doorway-edge Drive strips
    const doorH = wall.doorW && wall.doorW > 6
      ? Math.min(sy * 0.92, 3.85) // tall grand opening onto balcony
      : Math.min(sy * 0.88, 3.35);
    const horizontal = sx > sz;
    const wallMat = usePlaster ? this._wallMat(color, 0.74, 0.035) : this._mat(color, 0.8);
    if (horizontal) {
      const remain = (sx - doorW) / 2;
      for (const sign of [-1, 1]) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(remain, sy, sz), wallMat);
        mesh.position.set(px + sign * (doorW / 2 + remain / 2), py, pz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        this.colliders.push(
          new THREE.Box3().setFromCenterAndSize(
            mesh.position.clone(),
            new THREE.Vector3(remain, sy, sz + 0.06)
          )
        );
      }
      const headerH = sy - doorH;
      if (headerH > 0.2) {
        const header = new THREE.Mesh(
          new THREE.BoxGeometry(doorW, headerH, sz),
          wallMat
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
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, remain), wallMat);
        mesh.position.set(px, py, pz + sign * (doorW / 2 + remain / 2));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        this.colliders.push(
          new THREE.Box3().setFromCenterAndSize(
            mesh.position.clone(),
            new THREE.Vector3(sx + 0.06, sy, remain)
          )
        );
      }
      const headerH = sy - doorH;
      if (headerH > 0.2) {
        const header = new THREE.Mesh(
          new THREE.BoxGeometry(sx, headerH, doorW),
          wallMat
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


  /**
   * Stair + Drive climb aperture shared by foyer ceiling / landing floor.
   * Covers main_up stair footprint plus narrow east climb lane to landing crest.
   */
  /**
   * Dual figure-8 climb voids: Climb A west stair footprint, Climb B east opposite.
   * Returns one hole (legacy) — prefer _storyApertures for multi-cut slabs.
   */
  _storyAperture(room, which) {
    const holes = this._storyApertures(room, which);
    return holes[0] || null;
  }

  _storyApertures(room, which) {
    // Corridor strips for asphalt climbs + separate scenic stair cuts (logic1).
    // Solid landing band roughly x∈[-3.5, 5.5] between climb strips.
    // logic3: climb strips end at z=10 (landing S wall) — foot arcs now curve onto the
    // foyer straight at y<1, so the foyer ceiling south of z=10 stays solid.
    const holeA_climb = { minX: -6.35, maxX: -3.65, minZ: -2.60, maxZ: 10.00 };
    const holeA_scenic = { minX: -8.80, maxX: -6.40, minZ: 2.00, maxZ: 10.50 };
    const holeB_climb = { minX: 5.65, maxX: 8.35, minZ: -2.60, maxZ: 10.00 };
    const holeB_scenic = { minX: 8.20, maxX: 9.90, minZ: 2.00, maxZ: 10.50 };
    const all = [holeA_climb, holeA_scenic, holeB_climb, holeB_scenic];
    // logic6: stairwell for the relocated attic_up stair (landing x=-2.4, z 7.2→1.7).
    // Cut where the stair passes the landing ceiling / attic floor (eye ≤ ceiling south of
    // z≈4.7; the attic only spans z<5 so the well stays fully under the attic).
    if ((which === "ceiling" && room.id === "landing") || (which === "floor" && room.id === "attic_loft")) {
      return [ATTIC_STAIRWELL, CONVEYOR.shaft]; // logic11/14: + hidden conveyor shaft above the chandelier
    }
    if (which === "ceiling" && room.id === "attic_loft") return [ROOF_LIFT.shaft, CONVEYOR.shaft, { minX: 8.45, maxX: 11.3, minZ: -8.55, maxZ: -7.45 }]; // logic26: cutting for the Roof Slope Run (it dived INTO the roof deck past x 8.5) // logic13 roof lift + logic14 conveyor top
    if (which === "ceiling" && room.id === "foyer") return all;
    if (which === "floor" && room.id === "landing") return all;
    // logic3: every ground ceiling / first floor that overlaps a climb strip gets the same cut
    // (cabinet/armoury ceilings + study/nursery floors used to roof or floor over the crests).
    const [w, h, d] = room.size; const [cx, cy, cz] = room.pos;
    const isGroundCeil = which === "ceiling" && Math.abs(cy) < 0.01 && Math.abs(h - 4.2) < 0.01;
    const isFirstFloor = which === "floor" && Math.abs(cy - 4.2) < 0.01;
    if (!isGroundCeil && !isFirstFloor) return [];
    const r = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
    return [holeA_climb, holeB_climb]
      .filter((q) => q.maxX > r.minX && q.minX < r.maxX && q.maxZ > r.minZ && q.minZ < r.maxZ)
      .map((q) => ({ minX: Math.max(q.minX, r.minX), maxX: Math.min(q.maxX, r.maxX), minZ: Math.max(q.minZ, r.minZ), maxZ: Math.min(q.maxZ, r.maxZ) }));
  }

  /**
   * Drive asphalt passages through walls — real architectural openings (never ghost mesh).
   * Returns [{ along, width, y0, y1 }] in wall-local along-axis (X for N/S, Z for E/W).
   */
  /** logic10: hand-authored openings + every Skyline auto-portal on this wall (unless an existing
   *  door/arch already covers it — then the portal is flagged covered: no neon frame either). */
  _driveOpeningsForWall(room, side) {
    const out = this._driveOpeningsForWallBase(room, side) || [];
    if (room.outdoor) return out;
    const [w, , d] = room.size, [cx, , cz] = room.pos;
    const wallC = side === "north" ? cz - d / 2 : side === "south" ? cz + d / 2 : side === "west" ? cx - w / 2 : cx + w / 2;
    const axis = side === "north" || side === "south" ? "z" : "x";
    for (const P of LOFT_AUTO_PORTALS) {
      if (P.axis !== axis || Math.abs((axis === "z" ? P.z : P.x) - wallC) > 0.05) continue;
      const along = axis === "z" ? P.x : P.z;
      const lo = cx - w / 2, hi = cx + w / 2, lo2 = cz - d / 2, hi2 = cz + d / 2;
      if (axis === "z" ? (along < lo || along > hi) : (along < lo2 || along > hi2)) continue;
      if (P.y0 < room.pos[1] - 0.01 || P.y0 > room.pos[1] + room.size[1] - 0.3) continue;
      let covered = false, clash = false;
      for (const o of out) {
        const ov = Math.abs(o.along - along) < (o.width + P.w) / 2 + 0.05 && o.y0 < P.y1 && o.y1 > P.y0;
        if (!ov) continue;
        if (Math.abs(o.along - along) + P.w / 2 <= o.width / 2 + 0.02 && o.y0 <= P.y0 + 0.01 && o.y1 >= P.y1 - 0.08) covered = true;
        else clash = true;
      }
      if (covered) { P.covered = true; continue; }
      if (clash) {
        // merge: widen into one framed slot spanning both (keeps the wall builder's openings disjoint)
        for (let i = out.length - 1; i >= 0; i--) {
          const o = out[i];
          if (!(Math.abs(o.along - along) < (o.width + P.w) / 2 + 0.05 && o.y0 < P.y1 && o.y1 > P.y0)) continue;
          const a0 = Math.min(o.along - o.width / 2, along - P.w / 2), a1 = Math.max(o.along + o.width / 2, along + P.w / 2);
          out[i] = { ...o, along: (a0 + a1) / 2, width: a1 - a0, y0: Math.min(o.y0, P.y0), y1: Math.max(o.y1, P.y1) };
        }
        P.covered = true;
        continue;
      }
      out.push({ along, width: P.w, y0: P.y0, y1: P.y1, noFrame: true, loftPortal: true });
    }
    return out;
  }

  _driveOpeningsForWallBase(room, side) {
    const cy = room.pos[1];
    const doorH = Math.min((room.size[1] || 4) * 0.88, 3.35);
    const tallH = Math.min((room.size[1] || 4) * 0.92, 3.85);
    const out = [];
    const add = (along, width, y0, y1) => out.push({ along, width, y0, y1 });

    // ── logic3 tunnels: every opening below is sized from drive-corridor-audit
    // (ribbon ±1.1 + 0.25 margin; deck−0.22 … deck+1.9). Ground walls get a TOP NOTCH
    // only where the crest deck passes over them (no more full-story slots);
    // first-floor crossings get framed portals of door height with a lintel.
    const top = cy + (room.size[1] || 4) + 0.02;
    const notch = (a0, a1, y0) => out.push({ along: (a0 + a1) / 2, width: a1 - a0, y0: cy + y0, y1: top, noFrame: true, driveNotch: true });
    const portal = (a0, a1) => out.push({ along: (a0 + a1) / 2, width: a1 - a0, y0: cy, y1: cy + doorH, tunnel: true });

    if (room.id === "foyer" && side === "north") {
      notch(-6.10, -2.95, 3.55); // Climb A crest deck over the foyer north wall top
      notch(3.30, 8.10, 3.55);   // Climb B crest
      add(0.00, 2.80, cy, cy + doorH);
      out.push({ along: 2.55, width: 1.50, y0: cy + 2.98, y1: cy + 3.80, noFrame: true, loftPortal: true }); // logic9 Skyline

      return out;
    }
    if (room.id === "hall_ground" && side === "south") {
      add(0.00, 2.80, cy, cy + doorH); // centre door only (old ±climb slots were unused)
      out.push({ along: 2.55, width: 1.50, y0: cy + 2.98, y1: cy + 3.80, noFrame: true, loftPortal: true }); // logic9 Skyline
      return out;
    }
    // Front drive exit (door_foyer_outdoor near x≈-3.7)
    if (room.id === "foyer" && side === "south") {
      add(-3.70, 3.40, cy, cy + doorH);
      out.push({ along: -1.07, width: 1.50, y0: cy + 2.98, y1: cy + 3.80, noFrame: true, loftPortal: true }); // logic9 mouse run entry
      out.push({ along: 1.00, width: 1.40, y0: cy, y1: cy + 0.90, noFrame: true, loftPortal: true });          // logic9 mouse hole exit
      return out;
    }
    // Landing French doors onto the balcony: widened east to 5.8 for balcony_to_climb_b (x=4.4)
    if (room.id === "landing" && side === "south") {
      // tunnel-type frame: brass jambs + lintel, no threshold lip across the balcony lanes
      out.push({ along: 0.15, width: 11.30, y0: cy, y1: cy + tallH, tunnel: true });
      return out;
    }
    // Landing north: one framed archway (Climb A crest + hairpin + centre door) and a
    // framed portal for the Climb B apex U-turn.
    if (room.id === "landing" && side === "north") {
      portal(-5.10, 1.50);
      portal(4.35, 7.00);
      return out;
    }
    // Library south wall stands inside the landing strip z∈[-2,0]: hairpin arch + east corner notch
    if (room.id === "library_hall" && side === "south") {
      portal(-3.70, 1.60);
      portal(3.00, 3.70);
      return out;
    }
    if (room.id === "hall_ground" && side === "west") {
      add(-7.60, 2.60, cy, cy + doorH);
      notch(-2.45, 0.45, 3.60);
      return out;
    }
    if (room.id === "hall_ground" && side === "east") {
      add(-7.60, 2.60, cy, cy + doorH);
      return out;
    }
    if (room.id === "cabinet" && side === "east") {
      add(-7.70, 2.60, cy, cy + doorH);
      notch(-2.45, 0.10, 3.60);
      return out;
    }
    if (room.id === "armoury" && side === "west") {
      add(-7.70, 2.60, cy, cy + doorH);
      return out;
    }
    if (room.id === "cabinet" && side === "south") {
      notch(-6.45, -3.95, 3.35);
      return out;
    }
    if (room.id === "armoury" && side === "south") {
      notch(3.95, 8.45, 3.35);
      return out;
    }
    // Hall ↔ conservatory
    if (room.id === "hall_ground" && side === "north") {
      add(-2.50, 2.40, cy, cy + doorH);
      add(2.50, 2.40, cy, cy + doorH);
      return out;
    }
    if (room.id === "conservatory" && side === "south") {
      add(-2.50, 2.40, cy, cy + doorH);
      add(2.50, 2.40, cy, cy + doorH);
      return out;
    }
    // Conservatory ↔ dining
    if (room.id === "conservatory" && side === "west") {
      add(-29.6, 2.80, cy, cy + doorH);
      return out;
    }
    if (room.id === "dining" && side === "east") {
      add(-29.6, 2.80, cy, cy + doorH);
      return out;
    }
    // Library ↔ music / nursery / study
    if (room.id === "library_hall" && side === "north") {
      add(2.35, 2.60, cy, cy + doorH);
      return out;
    }
    if (room.id === "music" && side === "south") {
      add(2.35, 2.60, cy, cy + doorH);
      return out;
    }
    if (room.id === "library_hall" && side === "east") {
      add(-8.0, 2.60, cy, cy + doorH);
      portal(-1.45, 0.05); // Climb B apex U-turn brushes the library east end
      return out;
    }
    if (room.id === "library_hall" && side === "west") {
      add(-8.0, 2.60, cy, cy + doorH);
      portal(-2.45, 0.05); // Climb A crest arc
      return out;
    }
    if (room.id === "nursery" && side === "west") {
      add(-8.0, 2.60, cy, cy + doorH);
      portal(-2.45, -0.90);
      return out;
    }
    if (room.id === "nursery" && side === "south") {
      portal(5.90, 8.15); // Climb B descent passes under the nursery south wall
      return out;
    }
    if (room.id === "study" && side === "east") {
      add(-8.0, 2.60, cy, cy + doorH);
      return out;
    }
    if (room.id === "study" && side === "south") {
      return out; // solid (old full-height slot unused)
    }
    // Music ↔ workshop / mezzanine
    if (room.id === "music" && side === "west") {
      add(-29.0, 2.80, cy, cy + doorH);
      return out;
    }
    if (room.id === "workshop" && side === "east") {
      add(-29.0, 2.80, cy, cy + doorH);
      return out;
    }
    if (room.id === "music" && side === "east") {
      add(-28.5, 2.80, cy, cy + doorH);
      return out;
    }
    if (room.id === "study_annex" && side === "west") {
      add(-28.5, 2.80, cy, cy + doorH);
      return out;
    }

    // Landing east/west: only a framed arch where the scenic stair tops out (z≈2..4.6)
    if (room.id === "landing" && side === "west") {
      add(3.25, 2.60, cy, cy + doorH);
      return out;
    }
    // Landing east wall hangs over the Climb B strip (x=8 < hole maxX 8.35): gallery arch
    // over the descent wherever deck+1.9 would reach the wall bottom (z≤5.4) + stair arch.
    if (room.id === "landing" && side === "east") {
      portal(-2.10, 5.40);
      return out;
    }
    // Fallback: single centered doorway from exits map
    const dirs = this._doorwaysFor(room);
    if (dirs[side]) {
      const w = (room.id === "landing" && side === "south") ? 11.0 : 3.20;
      add(0, w, cy, cy + (w > 6 ? tallH : doorH));
    }
    return out;
  }

  /** Build wall as panels around one or more Drive/Explore openings + brass portal frames. */
  _addWallWithOpenings(group, wall, color, thick, trimColor, openings, usePlaster = false) {
    if (!openings || !openings.length) {
      // solid wall path
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...wall.size), usePlaster ? this._wallMat(color, 0.78, 0.04) : this._mat(color, 0.8));
      mesh.position.set(...wall.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      const [wsx, wsy, wsz] = wall.size;
      const inflate = 0.06;
      this.colliders.push(
        new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(...wall.pos),
          new THREE.Vector3(wsx > wsz ? wsx : wsx + inflate, wsy, wsz > wsx ? wsz : wsz + inflate)
        )
      );
      return;
    }
    const [sx, sy, sz] = wall.size;
    const [px, py, pz] = wall.pos;
    const wallMat = usePlaster ? this._wallMat(color, 0.74, 0.035) : this._mat(color, 0.8);
    const trimMat = this._brass(trimColor);
    const horizontal = sx > sz; // N/S wall
    const alongLen = horizontal ? sx : sz;
    const wallMin = (horizontal ? px : pz) - alongLen / 2;
    const wallMax = wallMin + alongLen;
    const sorted = openings
      .map((o) => ({
        a0: Math.max(wallMin, o.along - o.width / 2),
        a1: Math.min(wallMax, o.along + o.width / 2),
        y0: o.y0,
        y1: o.y1,
        along: o.along,
        width: o.width,
        noFrame: !!o.noFrame,
        tunnel: !!o.tunnel,
      }))
      .filter((o) => o.a1 - o.a0 > 0.08)
      .sort((a, b) => a.a0 - b.a0);

    const addPanel = (a0, a1, y0, y1) => {
      const aw = a1 - a0;
      const ah = y1 - y0;
      if (aw < 0.04 || ah < 0.04) return;
      const cy = (y0 + y1) / 2;
      const ca = (a0 + a1) / 2;
      let mesh;
      if (horizontal) {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(aw, ah, sz), wallMat);
        mesh.position.set(ca, cy, pz);
        this.colliders.push(
          new THREE.Box3().setFromCenterAndSize(mesh.position.clone(), new THREE.Vector3(aw, ah, sz + 0.06))
        );
      } else {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, ah, aw), wallMat);
        mesh.position.set(px, cy, ca);
        this.colliders.push(
          new THREE.Box3().setFromCenterAndSize(mesh.position.clone(), new THREE.Vector3(sx + 0.06, ah, aw))
        );
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    };

    // Vertical stacking per along-span: full-height slabs in gaps; open band only in openings
    let cursor = wallMin;
    const yBot = py - sy / 2;
    const yTop = py + sy / 2;
    for (const o of sorted) {
      if (o.a0 > cursor + 0.04) addPanel(cursor, o.a0, yBot, yTop);
      // below opening
      if (o.y0 > yBot + 0.04) addPanel(o.a0, o.a1, yBot, o.y0);
      // above opening (header)
      if (yTop > o.y1 + 0.04) addPanel(o.a0, o.a1, o.y1, yTop);
      cursor = Math.max(cursor, o.a1);
    }
    if (wallMax > cursor + 0.04) addPanel(cursor, wallMax, yBot, yTop);

    // Brass portal frames (readable tunnels) — emissive gold, non-blocking.
    // SKIP full-height climb tunnels: gold jambs read as pillars the climb ribbon
    // clips through (Ben trust-fail screenshot). Ordinary doors keep frames.
    const portalBrass = this._brass(0xe8c547);
    portalBrass.emissive = new THREE.Color(0xc9a227);
    portalBrass.emissiveIntensity = 0.42;
    const storyTop = yTop - 0.05;
    for (const o of sorted) {
      const fullHeightClimb = (o.y1 >= storyTop) && (o.width >= 3.2);
      if (fullHeightClimb || o.noFrame) continue; // hole only — no floating gold posts
      const jambD = horizontal ? sz + 0.10 : sx + 0.10;
      const frameH = Math.max(0.2, o.y1 - o.y0);
      for (const sign of [-1, 1]) {
        // logic3 tunnels: jambs on the CLIPPED edges; none where the opening meets the wall end
        if (o.tunnel && ((sign < 0 && o.a0 <= wallMin + 0.05) || (sign > 0 && o.a1 >= wallMax - 0.05))) continue;
        const ja = o.tunnel ? (sign < 0 ? o.a0 + 0.07 : o.a1 - 0.07) : o.along + sign * (o.width / 2);
        const jamb = new THREE.Mesh(
          new THREE.BoxGeometry(horizontal ? 0.14 : jambD, frameH, horizontal ? jambD : 0.14),
          portalBrass
        );
        if (horizontal) jamb.position.set(ja, (o.y0 + o.y1) / 2, pz);
        else jamb.position.set(px, (o.y0 + o.y1) / 2, ja);
        group.add(jamb);
      }
      const lw = o.tunnel ? (o.a1 - o.a0) + 0.14 : o.width + 0.32;
      const la = o.tunnel ? (o.a0 + o.a1) / 2 : o.along;
      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? lw : jambD, 0.16, horizontal ? jambD : lw),
        portalBrass
      );
      if (horizontal) lintel.position.set(la, o.y1 + 0.08, pz);
      else lintel.position.set(px, o.y1 + 0.08, la);
      group.add(lintel);
      if (o.tunnel) continue; // road is the threshold — no brass lip across the asphalt (z-fight/bump)
      // Threshold lip — reads as tunnel portal at asphalt height
      const thresh = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? o.width + 0.1 : jambD, 0.008, horizontal ? jambD : o.width + 0.1),
        portalBrass
      );
      // logic32: flush 8 mm brass inlay (was a 5 cm kerb across every doorway — a stepped lip at the small car's scale)
      if (horizontal) thresh.position.set(o.along, o.y0 + 0.0045, pz);
      else thresh.position.set(px, o.y0 + 0.0045, o.along);
      group.add(thresh);
    }
  }

  /** Build a room slab as one box, or four panels around a rectangular hole. */
  _addSlabWithHole(group, mat, cx, cy, cz, w, thick, d, hole, isFloor, floorY) {
    const addPanel = (pw, pd, px, pz) => {
      if (pw < 0.04 || pd < 0.04) return;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(pw, thick, pd), mat);
      mesh.position.set(px, cy, pz);
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      if (isFloor) mesh.userData.floorY = floorY;
      group.add(mesh);
    };
    const holes = !hole ? [] : (Array.isArray(hole) ? hole : [hole]);
    if (!holes.length) {
      addPanel(w, d, cx, cz);
      return;
    }
    // Recursive multi-hole: cut first hole, then cut remaining from each panel via AABB clips
    const minX = cx - w / 2, maxX = cx + w / 2;
    const minZ = cz - d / 2, maxZ = cz + d / 2;
    let panels = [{ x0: minX, x1: maxX, z0: minZ, z1: maxZ }];
    for (const h of holes) {
      const next = [];
      for (const pan of panels) {
        const hx0 = Math.max(pan.x0, h.minX);
        const hx1 = Math.min(pan.x1, h.maxX);
        const hz0 = Math.max(pan.z0, h.minZ);
        const hz1 = Math.min(pan.z1, h.maxZ);
        if (hx0 >= hx1 || hz0 >= hz1) {
          next.push(pan);
          continue;
        }
        // North / south full-width remainders + west/east between hole Z
        if (pan.z1 - hz1 > 0.04) next.push({ x0: pan.x0, x1: pan.x1, z0: hz1, z1: pan.z1 });
        if (hz0 - pan.z0 > 0.04) next.push({ x0: pan.x0, x1: pan.x1, z0: pan.z0, z1: hz0 });
        if (hx0 - pan.x0 > 0.04) next.push({ x0: pan.x0, x1: hx0, z0: hz0, z1: hz1 });
        if (pan.x1 - hx1 > 0.04) next.push({ x0: hx1, x1: pan.x1, z0: hz0, z1: hz1 });
      }
      panels = next;
    }
    for (const pan of panels) {
      addPanel(pan.x1 - pan.x0, pan.z1 - pan.z0, (pan.x0 + pan.x1) / 2, (pan.z0 + pan.z1) / 2);
    }
  }

  _buildStair(s, room) {
    const g = new THREE.Group();
    g.name = `stairs_${s.id}`;
    // Scenic stairs (Climb A/B companions) — lite mesh budget so east look doesn't kill SwiftShader.
    // Explore-only scenery; asphalt corridor is the Drive road.
    const scenic = !!s.scenic;
    const steps = scenic ? 7 : 14;
    const rise = (s.toY - s.fromY) / steps;
    const run = s.length / steps;
    const w = s.width;
    const dir = s.dir;
    const trim = scenic
      ? new THREE.MeshLambertMaterial({ color: 0x8d6e63 })
      : this._mat(0x8d6e63, 0.7);
    const railMat = scenic
      ? new THREE.MeshLambertMaterial({ color: 0xc9a227 })
      : this._mat(0xc9a227, 0.35, 0.55);
    let scenicRunner = null;
    if (scenic) {
      scenicRunner = new THREE.MeshLambertMaterial({ color: 0x6a1b9a, emissive: 0x2a0840, emissiveIntensity: 0.08 });
    }

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
      step.receiveShadow = !scenic;
      step.frustumCulled = true;
      g.add(step);
      // Runner: full Standard per-step only on walkable stairs; scenic shares one Lambert strip every other tread
      if (!scenic) {
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
      } else if (i % 2 === 0 && scenicRunner) {
        const runner = new THREE.Mesh(
          new THREE.BoxGeometry(
            dir === "east" || dir === "west" ? run * 0.9 : w * 0.45,
            0.025,
            dir === "east" || dir === "west" ? w * 0.45 : run * 0.9
          ),
          scenicRunner
        );
        runner.position.set(x, y + Math.abs(rise) * 0.48, z);
        runner.frustumCulled = true;
        g.add(runner);
      }
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

    if (!s.scenic) this.ramps.push({
      minX, maxX, minZ, maxZ,
      fromY: s.fromY,
      toY: s.toY,
      dir,
      x0: s.x,
      z0: s.z,
      length: s.length,
      priority: 10,
    });

    // Stair collision: side barriers + underside slab (center run stays driveable via ramp track).
    // Stringers sit INSIDE the stair footprint (not outside) so wall-skirting ribbons —
    // foyer west/east — stay clear for Drive approach onto ramp feet (no pillar grab).
    // logic32: stringers keep their full box for Explore; Drive gets them cut per tread (bottom of tread → rail top), so
    // the open space under the flight is not an invisible wall either.
    const treadBand = (i) => { const y = s.fromY + rise * (i + 0.5), hy = Math.abs(rise) * 0.45; let a = 0;
      if (dir === "north") a = s.z - run * (i + 1); else if (dir === "south") a = s.z + run * i; else if (dir === "east") a = s.x + run * i; else a = s.x - run * (i + 1);
      return { a, b: a + run, y0: y - hy, y1: y + hy + 0.55 }; };
    this._pushStringer = (box, kind) => { box.stairSteps = [];
      for (let i = 0; i < steps; i++) { const t = treadBand(i), c = box.clone();
        if (dir === "north" || dir === "south") { c.min.z = Math.max(box.min.z, t.a); c.max.z = Math.min(box.max.z, t.b); } else { c.min.x = Math.max(box.min.x, t.a); c.max.x = Math.min(box.max.x, t.b); }
        c.min.y = Math.max(box.min.y, t.y0); c.max.y = Math.min(box.max.y, t.y1); if (c.max.x > c.min.x && c.max.z > c.min.z && c.max.y > c.min.y) box.stairSteps.push(c); }
      this._pushCollider(box, kind); };
    const yLo = Math.min(s.fromY, s.toY);
    const yHi = Math.max(s.fromY, s.toY);
    if (dir === "north" || dir === "south") {
      this._pushStringer(
        new THREE.Box3(
          new THREE.Vector3(minX + 0.04, yLo - 0.02, minZ),
          new THREE.Vector3(minX + 0.28, yHi + 0.55, maxZ)
        ),
        "stair"
      );
      this._pushStringer(
        new THREE.Box3(
          new THREE.Vector3(maxX - 0.28, yLo - 0.02, minZ),
          new THREE.Vector3(maxX - 0.04, yHi + 0.55, maxZ)
        ),
        "stair"
      );
    } else {
      this._pushStringer(
        new THREE.Box3(
          new THREE.Vector3(minX, yLo - 0.02, minZ + 0.04),
          new THREE.Vector3(maxX, yHi + 0.55, minZ + 0.28)
        ),
        "stair"
      );
      this._pushStringer(
        new THREE.Box3(
          new THREE.Vector3(minX, yLo - 0.02, maxZ - 0.28),
          new THREE.Vector3(maxX, yHi + 0.55, maxZ - 0.04)
        ),
        "stair"
      );
    }
    // Underside slab — blocks ghosting; Drive softens (raises min.y) so floor approach clears
    const under = new THREE.Box3(
      new THREE.Vector3(minX + 0.08, yLo - 0.15, minZ + 0.08),
      new THREE.Vector3(maxX - 0.08, yLo + Math.max(0.35, (yHi - yLo) * 0.22), maxZ - 0.08)
    );
    // logic32 (Ben 9:23 AM "i ran into an invisible barrier here"): the treads float (open riser stair), so in Drive this
    // 0.9 m block filled the open space under the flight. Drive swaps it for one box per visible tread (mesh-fitted).
    under.stairSteps = [];
    for (let i = 0; i < steps; i++) {
      const y = s.fromY + rise * (i + 0.5), hy = Math.abs(rise) * 0.45;
      let x = s.x, z = s.z;
      if (dir === "north") z = s.z - run * (i + 0.5); else if (dir === "south") z = s.z + run * (i + 0.5);
      else if (dir === "east") x = s.x + run * (i + 0.5); else if (dir === "west") x = s.x - run * (i + 0.5);
      const ew = dir === "east" || dir === "west", hx = (ew ? run * 0.95 : w) / 2, hz = (ew ? w : run * 0.95) / 2;
      under.stairSteps.push(new THREE.Box3(new THREE.Vector3(x - hx, y - hy, z - hz), new THREE.Vector3(x + hx, y + hy, z + hz)));
    }
    this._pushCollider(under, "stair");

    // Continuous brass handrails + fewer posts — kills z-fight/gap seams at yellow frames
    railMat.polygonOffset = true;
    railMat.polygonOffsetFactor = -1;
    railMat.polygonOffsetUnits = -1;
    const railTopMat = this._mat(0xc9a227, 0.32, 0.58);
    railTopMat.polygonOffset = true;
    railTopMat.polygonOffsetFactor = -2;
    railTopMat.polygonOffsetUnits = -2;
    for (const side of [-1, 1]) {
      const railPts = [];
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
        railPts.push({ x, y, z });
        // Sparse posts — scenic every 3rd (east GPU); walkable every 2nd
        const postEvery = scenic ? 3 : 2;
        if (i % postEvery === 0 || i === steps - 1) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.88, scenic ? 5 : 6), railMat);
          post.position.set(x, y, z);
          post.frustumCulled = true;
          g.add(post);
        }
      }
      // Continuous top rail as overlapping short boxes along climb (no seam gaps)
      // Scenic: every other segment — halves east stair draw calls
      for (let i = 0; i < railPts.length - 1; i++) {
        if (scenic && i % 2 === 1) continue;
        const a = railPts[i];
        const b = railPts[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const len = Math.hypot(dx, dy, dz);
        if (len < 0.02) continue;
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.045, 0.04, len + 0.04), // slight overlap kills junction gaps
          railTopMat
        );
        rail.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.38, (a.z + b.z) / 2);
        rail.lookAt(b.x, b.y + 0.38, b.z);
        rail.frustumCulled = true;
        g.add(rail);
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
    const balDoorH0 = 4.20; // logic3: sill flush with deck (4.25 left a 5 cm curb the car hit)
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
    // logic3: outer mullions (±3.5) stood inside the balcony lanes — keep centre pair only
    for (const sx of [-1.2, 1.2]) {
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

    const plank = this._floorMat(0x6d4c41, 0.78) || this._mat(0x6d4c41, 0.78);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.16, deckD), plank);
    deck.position.set(deckX, deckY - 0.08, deckZ);
    deck.receiveShadow = true;
    deck.castShadow = true;
    g.add(deck);

    // logic32 (Ben 9:22 AM "found another spot"): the old 8.5 m approach boards left the foyer ceiling slab (top 2.2 cm
    // lower, dark 0x6b5d52) exposed either side and up to the front wall — the dark band / stepped look between the
    // purple landing and the plank floor. Panels now tile the whole gap flush at the story line, butting (not
    // overlapping) the landing planks (z 10), the balcony deck (z 12.1, x −5.75…6.75) and the front wall (z 12.81), and
    // leaving the two stair-foot apertures (x −8.8…−6.4 / 8.2…9.9, to z 10.5) open.
    const dX0 = deckX - deckW / 2, dX1 = deckX + deckW / 2, dZ0 = deckZ - deckD / 2;
    const panels = [
      [-6.4, 8.2, 10.0, dZ0], [-9.0, -6.4, 10.5, dZ0], [8.2, 9.0, 10.5, dZ0], // landing edge → deck line
      [-9.0, dX0, dZ0, 12.81], [dX1, 9.0, dZ0, 12.81],                         // beside the deck → front wall
    ];
    let approach = null;
    for (const [x0, x1, z0, z1] of panels) {
      this.floorRegions.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, y: deckY, priority: 3, roomId: "balcony_approach" });
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.14, z1 - z0), plank);
      m.position.set((x0 + x1) / 2, deckY - 0.07, (z0 + z1) / 2); m.receiveShadow = true; g.add(m);
      approach = approach || m;
    }
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
      brace.position.set(x, deckY - 0.55, 13.15); // logic26: was z 12.4 — the braces hung across the Skyline lane under the balcony (drive-through)
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


  /**
   * logic20 SERVICE GALLERIES (Ben t183u "this dark spot … you fall through").
   * Between the Library Hall walls (x ±3.6) and the Nursery / Study walls (x ±6.0) the first floor had
   * NO slab: you looked straight onto the dark top of the Armoury / Cabinet ceiling (y 4.18) and the car
   * dropped 4.2 m through it. Each strip is now a finished dark-2100s catwalk at landing height:
   * graphite deck + cyan edge neon + centre guide dashes, a closed end wall at the north end (z −15),
   * a glass balustrade where the strip meets the stair / climb wells, and it links the Upper Landing
   * (east) and both door bridges into one drivable gallery.
   */
  _buildServiceGalleries() {
    const g = new THREE.Group(); g.name = "service_gallery";
    const Y = 4.2, X0 = 3.77, X1 = 5.83, ZN = -15.0;
    // logic21: LIT gallery (Ben t184u "still black"): polished gunmetal deck, pale clad walls, luminous
    // ceiling — all glow from materials (no new lights), so it reads as a finished room from the landing.
    const lit = (hex, em, ei, rough = 0.4, metal = 0.35) => { const m = this._mat(hex, rough, metal); m.emissive = new THREE.Color(em); m.emissiveIntensity = ei; return m; };
    const deckMat = lit(0x5f6875, 0x26303c, 0.7, 0.28, 0.5);
    const panelMat = lit(0x7d8797, 0x2c3542, 0.6, 0.5, 0.3);
    const cladMat = lit(0x6f7f99, 0x26324a, 0.55, 0.6, 0.15);
    const ceilMatG = lit(0x8d97a8, 0x343e4e, 0.6, 0.6, 0.1);
    const lumen = this._emissiveGlow(0xeaf8ff, 1.35); lumen.transparent = false; lumen.opacity = 1;
    const amber = this._emissiveGlow(0xffc46b, 1.0); amber.transparent = false; amber.opacity = 1;
    const neon = this._emissiveGlow(0x34e7ff, 1.25); neon.transparent = false; neon.opacity = 1;
    const neonDim = this._emissiveGlow(0x9ff3ff, 1.0); neonDim.transparent = false; neonDim.opacity = 1;
    const glass = this._glass(0x6fdcff, 0.22);
    this.serviceGalleries = [];
    for (const sx of [1, -1]) {
      const a = sx * X0, b = sx * X1, minX = Math.min(a, b), maxX = Math.max(a, b), cx = (minX + maxX) / 2, w = maxX - minX;
      // east strip opens onto the Upper Landing at z −2.0 (landing north wall gap x 4.35..5.65);
      // west strip meets the scenic stair cut (landing hole z −2.6..) → balustrade there.
      const zS = sx > 0 ? -2.0 : -2.6;
      const region = { minX, maxX, minZ: ZN, maxZ: zS, y: Y, priority: 6, roomId: sx > 0 ? "service_gallery_east" : "service_gallery_west" };
      this.floorRegions.push(region); this.serviceGalleries.push(region);
      const len = zS - ZN, cz = (zS + ZN) / 2;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, len), deckMat);
      deck.position.set(cx, Y - 0.05 + 0.004, cz); deck.receiveShadow = true; deck.name = "service_gallery_deck"; g.add(deck);
      // cyan edge trim along both walls (8 cm wide, 3 mm proud — a rolled-over strip, not a kerb)
      for (const ex of [minX + 0.05, maxX - 0.05]) {
        const e = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.006, len - 0.1), neon);
        e.position.set(ex, Y + 0.004 + 0.003, cz); e.name = "service_gallery_neon"; g.add(e);
      }
      // wall cladding (pale panels, 3 cm inside the wall collider pad) with glowing pilasters + an amber
      // dado band; gaps + lit frames at the door-bridge openings (z −9.3..−6.7)
      const zTop = sx > 0 ? -2.67 : zS; // east side: the climb-well stub at the mouth
      for (const [wx, side] of [[minX + 0.015, -1], [maxX - 0.015, 1]]) {
        const zEnd = (sx > 0 && side > 0) || (sx < 0 && side < 0) ? zTop : zS - 0.02;
        for (const [z0, z1] of [[ZN, -9.3], [-6.7, zEnd]]) {
          const L = z1 - z0; if (L < 0.2) continue;
          const pnl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 3.68, L), cladMat);
          pnl.position.set(wx, Y + 1.84, (z0 + z1) / 2); pnl.name = "service_gallery_clad"; g.add(pnl);
          const band = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, L - 0.04), amber);
          band.position.set(wx - side * 0.004, Y + 0.95, (z0 + z1) / 2); g.add(band);
          for (let z = z0 + 0.4; z < z1 - 0.2; z += 1.6) {
            const pil = new THREE.Mesh(new THREE.BoxGeometry(0.03, 3.2, 0.06), neonDim);
            pil.position.set(wx - side * 0.013, Y + 2.05, z); pil.name = "service_gallery_pilaster"; g.add(pil);
          }
        }
        for (const zd of [-9.3, -6.7]) { const fr = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.34, 0.1), neon); fr.position.set(wx - side * 0.022, Y + 1.67, zd); g.add(fr); }
        const lin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 2.7), neon); lin.position.set(wx - side * 0.022, Y + 3.38, -8.0); g.add(lin);
      }
      // luminous ceiling liner just under the attic slab (above the y 7.2 sky bridge) + light panels
      const ceil = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, len), ceilMatG);
      ceil.position.set(cx, 7.98, cz); ceil.name = "service_gallery_ceiling"; g.add(ceil);
      for (let z = ZN + 1.2; z < zS - 0.6; z += 2.4) {
        const lp = new THREE.Mesh(new THREE.BoxGeometry(w - 0.5, 0.02, 1.1), lumen);
        lp.position.set(cx, 7.945, z); lp.name = "service_gallery_lightpanel"; g.add(lp);
      }
      // display plinths with glowing curios against the walls (out of the 1.6 m lane)
      for (const [pz, side] of (sx > 0 ? [[-4.6, 1], [-10.6, -1]] : [[-4.6, -1], [-10.6, 1]]) /* end bay z<−10.3 kept clear for U-turns */) {
        const px = side > 0 ? maxX - 0.17 : minX + 0.17;
        const ped = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.24), panelMat); ped.position.set(px, Y + 0.31, pz); ped.name = "service_gallery_plinth"; g.add(ped);
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), (pz > -6 ? amber : neon)); orb.position.set(px, Y + 0.72, pz); g.add(orb);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.26), lumen); cap.position.set(px, Y + 0.63, pz); g.add(cap);
        this._pushCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(px, Y + 0.4, pz), new THREE.Vector3(0.26, 0.8, 0.26)), "furniture");
      }
      // centre guide dashes (flush, 3 mm proud — the wheels roll over them)
      for (let z = ZN + 0.6; z < zS - 0.4; z += 0.9) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.006, 0.42), neonDim);
        d.position.set(cx, Y + 0.004 + 0.003, z); d.name = "service_gallery_dash"; g.add(d);
      }
      // closed north end: dark panel wall with neon bars (no more drop into the z<−15 void)
      const endW = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 3.96, 0.2), panelMat);
      endW.position.set(cx, Y + 1.98, ZN - 0.1); endW.name = "service_gallery_endwall"; g.add(endW);
      this._pushCollider(new THREE.Box3().setFromCenterAndSize(endW.position.clone(), new THREE.Vector3(w + 0.1, 3.96, 0.26)), "wall");
      for (let k = 0; k < 3; k++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(w - 0.4, 0.035, 0.02), k === 1 ? neon : neonDim);
        bar.position.set(cx, Y + 0.45 + k * 0.5, ZN + 0.012); g.add(bar);
      }
      // end wall feature: a big glowing panel (reads as a lit wall, not a hole, from the landing)
      const feat = new THREE.Mesh(new THREE.BoxGeometry(w - 0.5, 1.5, 0.02), lumen); feat.position.set(cx, Y + 2.6, ZN + 0.012); feat.name = "service_gallery_feature"; g.add(feat);
      const featF = new THREE.Mesh(new THREE.BoxGeometry(w - 0.36, 1.64, 0.015), amber); featF.position.set(cx, Y + 2.6, ZN + 0.006); g.add(featF);
      if (sx < 0) { // west: glass balustrade across the stair well edge
        const zb = zS + 0.04;
        const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.06), neon); rail.position.set(cx, Y + 0.62, zb); g.add(rail);
        const pane = new THREE.Mesh(new THREE.BoxGeometry(w, 0.56, 0.02), glass); pane.position.set(cx, Y + 0.32, zb); g.add(pane);
        for (const px of [minX + 0.06, cx, maxX - 0.06]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.64, 0.05), panelMat); post.position.set(px, Y + 0.32, zb); g.add(post); }
        this._pushCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(cx, Y + 0.33, zb), new THREE.Vector3(w, 0.66, 0.12)), "wall");
      } else { // east: the climb well nibbles x 5.65..5.83 at z −2.6..−2.0 → a short glass-capped stub wall
        // header over the landing → gallery mouth: the landing painting used to float in mid-air here
        const hdr = new THREE.Mesh(new THREE.BoxGeometry(5.83 - 4.35, 2.2, 0.34), lit(0x5e35b1, 0x2a1a5c, 0.6, 0.8, 0.05));
        hdr.position.set((4.35 + 5.83) / 2, Y + 1.8 + 1.1, -2.0); hdr.name = "service_gallery_header"; g.add(hdr);
        this._pushCollider(new THREE.Box3().setFromCenterAndSize(hdr.position.clone(), new THREE.Vector3(5.83 - 4.35, 2.2, 0.36)), "wall");
        const lip = new THREE.Mesh(new THREE.BoxGeometry(5.83 - 4.35, 0.04, 0.36), neon); lip.position.set((4.35 + 5.83) / 2, Y + 1.8 - 0.02, -2.0); g.add(lip);
        const sw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.66), panelMat); sw.position.set(5.75, Y + 0.33, -2.3); g.add(sw);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.68), neon); cap.position.set(5.75, Y + 0.68, -2.3); g.add(cap);
        this._pushCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(5.75, Y + 0.33, -2.3), new THREE.Vector3(0.2, 0.66, 0.66)), "wall");
      }
    }
    // logic22 (Ben t186u "drive through it and drop to the lower level"): the landing's east edge over the
    // Climb-B well (x 5.65) had no guard — driving off it dropped to the Foyer. Glass + neon balustrade
    // along it, leaving the Climb-B ramp mouth (z −1.46..−0.46) open.
    { const xg = 5.73, glassG = this._glass(0x6fdcff, 0.22), postM = this._mat(0x7d8797, 0.5, 0.3);
      const guard = (cx, cz, sx, sz) => { // sx/sz: run along x or z
        const rail = new THREE.Mesh(new THREE.BoxGeometry(Math.max(sx, 0.06), 0.05, Math.max(sz, 0.06)), neon); rail.position.set(cx, 4.2 + 0.62, cz); rail.name = "landing_well_guard"; g.add(rail);
        const pane = new THREE.Mesh(new THREE.BoxGeometry(Math.max(sx, 0.02), 0.56, Math.max(sz, 0.02)), glassG); pane.position.set(cx, 4.2 + 0.32, cz); g.add(pane);
        const L = Math.max(sx, sz), n = Math.max(1, Math.round(L / 1.2));
        for (let k = 0; k <= n; k++) { const t = -L / 2 + 0.03 + (L - 0.06) * k / n; const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.64, 0.05), postM); post.position.set(cx + (sx > sz ? t : 0), 4.2 + 0.32, cz + (sz >= sx ? t : 0)); g.add(post); }
        this._pushCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(cx, 4.2 + 0.33, cz), new THREE.Vector3(Math.max(sx, 0.14), 0.66, Math.max(sz, 0.14))), "wall");
      };
      guard(xg, (-1.98 - 1.47) / 2, 0, 0.51);          // north of the ramp mouth
      guard(xg, (-0.4 + 9.98) / 2, 0, 10.38);          // west lip of the well, mouth → balcony approach
      guard((5.66 + 8.06) / 2, 9.98, 2.4, 0);          // south lip (balcony approach side)
    }
    this.root.add(g);
  }

  /** Bright Climb B landmark — asphalt mouth + chevron pylons, findable from foyer/landing. */
  _addClimbLandmarks() {
    const g = new THREE.Group();
    g.name = "climb_landmarks";
    const asphalt = this._mat(0x0a0a0e, 0.95, 0.05);
    asphalt.emissive = new THREE.Color(0x111118);
    asphalt.emissiveIntensity = 0.08;
    const paint = this._mat(0xffdd22, 0.45, 0.2);
    paint.emissive = new THREE.Color(0xffaa00);
    paint.emissiveIntensity = 0.55;
    const white = this._mat(0xffffff, 0.55, 0.05);
    white.emissive = new THREE.Color(0xffffff);
    white.emissiveIntensity = 0.35;
    const brass = this._brass(0xc9a227);

    const addPylon = (x, z, y0) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.55, 0.18), brass);
      post.position.set(x, y0 + 0.78, z);
      g.add(post);
      for (let i = 0; i < 4; i++) {
        const chev = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.06), i % 2 ? paint : white);
        chev.position.set(x, y0 + 0.35 + i * 0.28, z + 0.12);
        g.add(chev);
      }
      // Box lamp (no Sphere tessellation) — SwiftShader-safe east look
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), this._emissiveGlow(0xffe082, 0.85));
      lamp.position.set(x, y0 + 1.62, z);
      g.add(lamp);
    };

    // logic3: one pylon on the OUTSIDE corner of each foot arc (never on asphalt).
    // Old twin pylons + asphalt lips marked the retired z=12.9 feet and sat on the road.
    addPylon(-6.45, 12.75, 0); // Climb A foot (west-then-north sweep)
    addPylon(8.45, 12.75, 0);  // Climb B foot (south-then-east sweep)
    void asphalt; void white;

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
    let bestScore = Infinity;
    for (const room of Object.values(ROOMS)) {
      const [w, h, d] = room.size;
      const [cx, cy, cz] = room.pos;
      // Basement volumes share XZ with ground rooms; never pick cellar when above -1
      if (!room.outdoor && cy < -2 && y > -1) continue;
      // Outdoor zones: loose vertical; indoor: stay near this story's floor band
      const yOk = room.outdoor
        ? y > cy - 0.5 && y < cy + 8
        : y > cy - 0.5 && y < cy + Math.min(h + 0.35, 3.0);
      if (
        x > cx - w / 2 && x < cx + w / 2 &&
        z > cz - d / 2 && z < cz + d / 2 &&
        yOk
      ) {
        let pri = room.id.includes("hall") ? 0 : 1;
        if (room.outdoor) pri = 3;
        // Prefer room whose floor Y is closest to query Y (fixes cellar-over-foyer)
        const score = Math.abs(cy - y) * 10 - pri;
        if (score < bestScore) {
          bestScore = score;
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


  /** Push a collider AABB. driveKind: "wall"|"pillar" (hard) | "furniture"|"stair" (Drive softens). */
  _pushCollider(box, driveKind = "wall") {
    box.driveKind = driveKind;
    this.colliders.push(box);
  }

  getColliders() {
    return this.colliders;
  }
}
