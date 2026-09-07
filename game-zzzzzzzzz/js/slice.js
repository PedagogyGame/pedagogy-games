import * as THREE from "three";
import { SHARED_CLIP_PLANE, isConcentricDef } from "./meshes.js";

const TRANSITION_MS = 180;
const PEEL_OUTER = 0.16;
const GHOST_OUTER = 0.15;
const SECTION_OUTER = 0.06;

function eachMaterial(layer, fn) {
  layer.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) fn(m, o);
  });
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export class SliceSystem {
  constructor() {
    this.object = null;
    this.def = null;
    this.index = 0;
    this.mode = "section"; // peel | ghost | section — Section is the designed Reveal/Learn default
    this.particles = null;
    this.rimLight = null;
    this.cutLight = null;
    this.cutFaces = null; // Group of cut-face disks/quads
    this.onLayerChange = null;
    this._baseOpacity = new WeakMap();
    this._baseScale = new WeakMap();
    this._basePos = new WeakMap();
    this._targets = new WeakMap();
    this._layerScaleTarget = new Map();
    this._layerPosTarget = new Map();
    this._layerRadii = [];
    this._pulseT = 0;
    this._clipNormalLocal = new THREE.Vector3(1, 0, 0); // cut removes +X half
    this._tmpV = new THREE.Vector3();
    this._tmpN = new THREE.Vector3();
    this._box = new THREE.Box3();
    this._size = new THREE.Vector3();
    this._centerLocal = new THREE.Vector3();
  }

  attach(object3d, scene) {
    this.detach(scene);
    this.object = object3d;
    this.def = object3d.userData.def;
    this.index = 0;
    // Smart default: Section for concentric onion objects; Peel for exploded assemblies
    this.mode = isConcentricDef(this.def) ? "section" : "peel";
    this._pulseT = 0;

    const meshLayers = object3d.userData.layers || [];
    const dataLayers = this.def?.layers || [];
    if (meshLayers.length !== dataLayers.length) {
      console.warn(
        `[slice] layer count mismatch for ${this.def?.id}: mesh=${meshLayers.length} def=${dataLayers.length}`
      );
    }

    // Measure per-layer radii in LOCAL space for cut-face disks
    this._layerRadii = [];
    object3d.updateWorldMatrix(true, true);
    const worldScale = object3d.scale.x || 1;
    for (const layer of meshLayers) {
      if (!this._baseScale.has(layer)) {
        this._baseScale.set(layer, layer.scale.x || 1);
      }
      if (!this._basePos.has(layer)) {
        this._basePos.set(layer, layer.position.clone());
      }
      this._box.setFromObject(layer);
      this._box.getSize(this._size);
      // World AABB → local radius (undo root scale)
      const rWorld = Math.max(this._size.y, this._size.z, this._size.x) * 0.48;
      const r = rWorld / Math.max(worldScale, 1e-4);
      this._layerRadii.push(Math.max(r, 0.06));

      eachMaterial(layer, (m) => {
        if (!this._baseOpacity.has(m)) this._baseOpacity.set(m, m.opacity ?? 1);
        m.clippingPlanes = [SHARED_CLIP_PLANE];
        m.clipShadows = true;
        this._targets.set(m, {
          opacity: m.opacity ?? 1,
          emissiveIntensity: m.emissiveIntensity ?? 0,
          wireframe: !!m.wireframe,
          depthWrite: m.depthWrite !== false,
        });
      });
    }

    this._buildCutFaces(scene);
    this._updateClipPlane();
    this._apply(true);
    this._spawnVFX(scene);
    return this.currentLayer();
  }

  detach(scene) {
    if (this.object && this.object.userData.layers) {
      for (const layer of this.object.userData.layers) {
        layer.visible = true;
        const baseS = this._baseScale.get(layer);
        if (baseS != null) layer.scale.setScalar(baseS);
        const baseP = this._basePos.get(layer);
        if (baseP) layer.position.copy(baseP);
        eachMaterial(layer, (m) => {
          if (m.emissive) {
            m.emissive.setHex(0x000000);
            m.emissiveIntensity = 0;
          }
          const base = this._baseOpacity.get(m);
          if (base != null) {
            m.opacity = base;
            m.transparent = base < 1;
          }
          m.wireframe = false;
          m.depthWrite = true;
          m.clippingPlanes = [];
        });
      }
    }
    if (this.cutFaces) {
      if (this.cutFaces.parent) this.cutFaces.parent.remove(this.cutFaces);
      this.cutFaces.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
    }
    if (this.particles && scene) {
      scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particles.material.dispose();
    }
    if (this.rimLight && scene) scene.remove(this.rimLight);
    if (this.cutLight && scene) {
      scene.remove(this.cutLight.target);
      scene.remove(this.cutLight);
    }
    this.cutFaces = null;
    this.particles = null;
    this.rimLight = null;
    this.cutLight = null;
    this.object = null;
    this.def = null;
    this.index = 0;
    this._layerScaleTarget.clear();
    this._layerPosTarget.clear();
    this._layerRadii = [];
  }

  setMode(mode) {
    if (!["peel", "ghost", "section"].includes(mode)) return;
    this.mode = mode;
    this._apply(false);
  }

  setIndex(i) {
    if (!this.def) return null;
    this.index = Math.max(0, Math.min(this.def.layers.length - 1, i));
    this._apply(false);
    const layer = this.currentLayer();
    if (this.onLayerChange) this.onLayerChange(layer, this.index);
    return layer;
  }

  delta(d) {
    return this.setIndex(this.index + d);
  }

  currentLayer() {
    if (!this.def) return null;
    const L = this.def.layers[this.index];
    return {
      ...L,
      index: this.index,
      total: this.def.layers.length,
      objectName: this.def.name,
      hint: L.hint || "",
      mode: this.mode,
    };
  }

  /** World-space clip through object center, removing local +X half. */
  _updateClipPlane() {
    if (!this.object) return;
    this.object.updateWorldMatrix(true, false);
    // Point on plane = object world origin (local center)
    this._tmpV.set(0, 0, 0).applyMatrix4(this.object.matrixWorld);
    // Normal in world = object local +X (clip keeps points with normal·x + c <= 0 → -X side kept when normal is +X… )
    // Three.js clips where plane.distanceToPoint(p) < 0 is discarded when using clippingPlanes.
    // Plane(normal, constant): distance = normal·p + constant. Discard if < 0.
    // We want to discard local +X (positive local x). World normal = R * (1,0,0).
    // At center C: normal·C + constant = 0 ⇒ constant = -normal·C.
    // Point at C + ε*normal: normal·(C+εn)+c = ε > 0 → kept. Wait, Three discards NEGATIVE.
    // So discard side is where normal·p + c < 0, i.e. opposite to normal.
    // To discard +X local: use normal = -localX (pointing toward kept half), constant = -normal·C.
    this._tmpN.copy(this._clipNormalLocal).transformDirection(this.object.matrixWorld).normalize();
    // Discard the +X side: normal points toward kept (−X), so worldNormal = −localX_world
    this._tmpN.multiplyScalar(-1);
    SHARED_CLIP_PLANE.normal.copy(this._tmpN);
    SHARED_CLIP_PLANE.constant = -this._tmpN.dot(this._tmpV);
  }

  _buildCutFaces(scene) {
    const group = new THREE.Group();
    group.name = "cut_faces";
    const layers = this.object.userData.layers || [];
    const dataLayers = this.def?.layers || [];

    for (let i = 0; i < layers.length; i++) {
      const r = this._layerRadii[i] || 0.1;
      const color = dataLayers[i]?.color ?? 0xcccccc;
      // Disk in YZ plane (facing ±X) — the visible cut face / strata ring
      const geo = new THREE.CircleGeometry(r, 28);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.55,
        metalness: 0.08,
        side: THREE.DoubleSide,
        emissive: color,
        emissiveIntensity: 0.15,
        depthWrite: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      // No clipping on cut faces — they ARE the cut
      mat.clippingPlanes = [];
      const disk = new THREE.Mesh(geo, mat);
      // Sit slightly into the kept half so it isn't z-fought away
      disk.rotation.y = Math.PI / 2;
      disk.position.set(-0.002 - i * 0.0015, 0, 0);
      disk.userData.layerIndex = i;
      disk.userData.baseEmissive = 0.15;
      group.add(disk);

      // Thin ring edge for strata readability
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(Math.max(r * 0.92, 0.01), r * 1.02, 28),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      ring.material.clippingPlanes = [];
      ring.rotation.y = Math.PI / 2;
      ring.position.copy(disk.position);
      ring.position.x -= 0.001;
      ring.userData.layerIndex = i;
      ring.userData.isRing = true;
      group.add(ring);
    }

    this.object.add(group);
    this.cutFaces = group;
  }

  _apply(immediate = false) {
    if (!this.object) return;
    const layers = this.object.userData.layers;
    const mode = this.mode;
    const concentric = isConcentricDef(this.def);
    const explode = !concentric && (mode === "peel" || mode === "ghost");

    this._updateClipPlane();

    if (this.cutLight) {
      this.cutLight.visible = mode === "section" || mode === "peel";
      this.cutLight.intensity = mode === "section" ? 28 : mode === "peel" ? 14 : 0;
    }

    // Cut faces: show for section always; for peel show remaining; ghost faint
    if (this.cutFaces) {
      this.cutFaces.visible = mode === "section" || mode === "peel" || mode === "ghost";
      this.cutFaces.children.forEach((child) => {
        const i = child.userData.layerIndex;
        if (i == null) return;
        const isOuter = i < this.index;
        const isActive = i === this.index;
        // Outside-in: hide outer cut faces once peeled past; keep active + inner
        if (mode === "section") {
          child.visible = !isOuter;
        } else if (mode === "peel") {
          child.visible = true;
          if (child.isMesh && child.material && !child.userData.isRing) {
            child.material.opacity = isOuter ? 0.25 : 1;
            child.material.transparent = isOuter;
          }
        } else {
          child.visible = !isOuter || true;
          if (child.isMesh && child.material && !child.userData.isRing) {
            child.material.opacity = isOuter ? 0.2 : 0.85;
            child.material.transparent = true;
          }
        }
        if (child.isMesh && child.material && child.material.emissive && !child.userData.isRing) {
          child.material.emissiveIntensity = isActive ? 0.65 : child.userData.baseEmissive ?? 0.15;
        }
        if (child.userData.isRing) {
          child.visible = isActive && child.visible;
        }
      });
    }

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const isActive = i === this.index;
      const isOuter = i < this.index;
      const isInner = i > this.index;
      const baseS = this._baseScale.get(layer) ?? 1;
      const baseP = this._basePos.get(layer) || new THREE.Vector3();

      // Section: hide outer shells (cut faces remain); peel/ghost keep ghosts
      layer.visible = !(mode === "section" && isOuter);

      this._layerScaleTarget.set(layer, isActive ? baseS * 1.02 : baseS);

      // Exploded offset along local +X for outer parts when peeling non-concentric
      let ox = 0;
      if (explode && isOuter) {
        ox = (this.index - i) * 0.22;
      } else if (explode && isActive) {
        ox = 0.06;
      }
      this._layerPosTarget.set(layer, { x: baseP.x + ox, y: baseP.y, z: baseP.z });

      eachMaterial(layer, (m) => {
        const base = this._baseOpacity.get(m) ?? 1;
        let opacity = base;
        let emissiveIntensity = 0;
        let wireframe = false;
        let depthWrite = true;

        if (m.emissive) {
          if (isActive) m.emissive.setHex(0xffd54f);
          else m.emissive.setHex(0x000000);
        }

        if (mode === "peel") {
          if (isOuter) {
            opacity = Math.min(base, PEEL_OUTER);
            depthWrite = false;
          } else if (isActive) {
            opacity = Math.min(base, 0.95);
            emissiveIntensity = 0.45;
          } else if (isInner) {
            opacity = i === this.index + 1 ? Math.min(base, 0.85) : base;
          }
        } else if (mode === "ghost") {
          if (isOuter) {
            opacity = Math.min(base, GHOST_OUTER);
            wireframe = true;
            depthWrite = false;
          } else if (isActive) {
            opacity = Math.min(base, 0.98);
            emissiveIntensity = 0.5;
            wireframe = false;
          } else {
            opacity = base;
            wireframe = false;
          }
        } else {
          // section — solid cutaway; outer hidden; active highlighted
          if (isOuter) {
            opacity = Math.min(base, SECTION_OUTER);
            depthWrite = false;
          } else if (isActive) {
            opacity = Math.min(base, 1);
            emissiveIntensity = 0.55;
          } else {
            opacity = base;
          }
        }

        const target = { opacity, emissiveIntensity, wireframe, depthWrite };
        this._targets.set(m, target);

        if (immediate) {
          m.transparent = true;
          m.opacity = opacity;
          m.wireframe = wireframe;
          m.depthWrite = depthWrite;
          if (m.emissive) m.emissiveIntensity = emissiveIntensity;
          layer.position.set(baseP.x + ox, baseP.y, baseP.z);
        } else {
          m.transparent = true;
        }
      });
    }
  }

  _spawnVFX(scene) {
    const count = 48;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 1.2;
      pos[i * 3 + 1] = Math.random() * 1.2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffe082,
      size: 0.04,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(geo, mat);
    this.particles.position.copy(this.object.position);
    scene.add(this.particles);

    this.rimLight = new THREE.PointLight(0xffecb3, 20, 4, 2);
    this.rimLight.position.copy(this.object.position);
    this.rimLight.position.y += 0.8;
    scene.add(this.rimLight);

    this.cutLight = new THREE.SpotLight(0xffe0a0, 0, 5, Math.PI / 5, 0.55, 1.2);
    this.cutLight.position.copy(this.object.position);
    this.cutLight.position.x -= 0.9;
    this.cutLight.position.y += 0.35;
    this.cutLight.target.position.copy(this.object.position);
    scene.add(this.cutLight);
    scene.add(this.cutLight.target);
    this.cutLight.visible = this.mode === "section";
  }

  update(t, dt = 1 / 60) {
    this._updateClipPlane();

    // Keep cut-face group oriented in object local space (already parented)
    if (this.cutFaces && this.object) {
      // Pulse active cut face
      this.cutFaces.children.forEach((child) => {
        if (child.userData.isRing || child.userData.layerIndex !== this.index) return;
        if (child.material?.emissive) {
          const base = 0.55;
          child.material.emissiveIntensity = base + 0.2 * (0.5 + 0.5 * Math.sin(t * 4));
        }
      });
    }

    if (this.particles) {
      this.particles.rotation.y = t * 0.25;
      const arr = this.particles.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] += Math.sin(t * 2 + i) * 0.0015;
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }
    if (this.rimLight) {
      this.rimLight.intensity = 16 + Math.sin(t * 3) * 4;
    }
    if (this.cutLight && this.cutLight.visible) {
      this.cutLight.intensity = 24 + Math.sin(t * 4) * 6;
    }

    const alpha = 1 - Math.exp(-dt / (TRANSITION_MS / 1000));
    if (this.object?.userData?.layers) {
      this._pulseT = t;
      for (const layer of this.object.userData.layers) {
        const baseTarget = this._layerScaleTarget.get(layer);
        if (baseTarget != null) {
          const baseS = this._baseScale.get(layer) ?? 1;
          const isActiveScale = Math.abs(baseTarget - baseS) > 1e-6;
          const pulse = isActiveScale ? 1 + 0.02 * (0.5 + 0.5 * Math.sin(t * 3.2)) : 1;
          const targetS = isActiveScale ? baseS * pulse : baseTarget;
          const s = lerp(layer.scale.x, targetS, alpha);
          layer.scale.setScalar(s);
        }
        const posT = this._layerPosTarget.get(layer);
        if (posT) {
          layer.position.x = lerp(layer.position.x, posT.x, alpha);
          layer.position.y = lerp(layer.position.y, posT.y, alpha);
          layer.position.z = lerp(layer.position.z, posT.z, alpha);
        }
        eachMaterial(layer, (m) => {
          const target = this._targets.get(m);
          if (!target) return;
          m.opacity = lerp(m.opacity ?? 1, target.opacity, alpha);
          m.transparent = true;
          if (m.emissive) {
            m.emissiveIntensity = lerp(m.emissiveIntensity ?? 0, target.emissiveIntensity, alpha);
          }
          if (Math.abs(m.opacity - target.opacity) < 0.02) {
            m.wireframe = target.wireframe;
            m.depthWrite = target.depthWrite;
          } else if (target.wireframe) {
            m.wireframe = true;
            m.depthWrite = false;
          }
        });
      }
    }
  }
}
