import * as THREE from "three";
import { SHARED_CLIP_PLANE } from "./meshes.js";

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
    this.mode = "peel"; // peel | ghost | section
    this.particles = null;
    this.rimLight = null;
    this.cutLight = null;
    this.onLayerChange = null;
    this._baseOpacity = new WeakMap();
    this._baseScale = new WeakMap();
    this._targets = new WeakMap(); // material -> { opacity, emissiveIntensity, wireframe }
    this._layerScaleTarget = new Map(); // layer -> scale
    this._pulseT = 0;
  }

  attach(object3d, scene) {
    this.detach(scene);
    this.object = object3d;
    this.def = object3d.userData.def;
    this.index = 0;
    this.mode = this.mode || "peel";
    this._pulseT = 0;

    const meshLayers = object3d.userData.layers || [];
    const dataLayers = this.def?.layers || [];
    if (meshLayers.length !== dataLayers.length) {
      console.warn(
        `[slice] layer count mismatch for ${this.def?.id}: mesh=${meshLayers.length} def=${dataLayers.length}`
      );
    }

    for (const layer of meshLayers) {
      if (!this._baseScale.has(layer)) {
        this._baseScale.set(layer, layer.scale.x || 1);
      }
      eachMaterial(layer, (m) => {
        if (!this._baseOpacity.has(m)) this._baseOpacity.set(m, m.opacity ?? 1);
        m.clippingPlanes = [SHARED_CLIP_PLANE];
        m.clipShadows = true;
        // seed targets so first frame doesn't flash
        this._targets.set(m, {
          opacity: m.opacity ?? 1,
          emissiveIntensity: m.emissiveIntensity ?? 0,
          wireframe: !!m.wireframe,
          depthWrite: m.depthWrite !== false,
        });
      });
    }
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
          if (this.mode === "section") {
            // leave clipping as meshes.js set it
          }
        });
      }
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
    this.particles = null;
    this.rimLight = null;
    this.cutLight = null;
    this.object = null;
    this.def = null;
    this.index = 0;
    this._layerScaleTarget.clear();
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

  _apply(immediate = false) {
    if (!this.object) return;
    const layers = this.object.userData.layers;
    const mode = this.mode;

    // Clip plane strength by mode
    if (mode === "section") {
      SHARED_CLIP_PLANE.constant = 0.0 + this.index * 0.008;
    } else if (mode === "ghost") {
      SHARED_CLIP_PLANE.constant = 0.04 + this.index * 0.012;
    } else {
      SHARED_CLIP_PLANE.constant = 0.02 + this.index * 0.01;
    }

    if (this.cutLight) {
      this.cutLight.visible = mode === "section";
      this.cutLight.intensity = mode === "section" ? 28 : 0;
    }

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const isActive = i === this.index;
      const isOuter = i < this.index;
      const isInner = i > this.index;
      const baseS = this._baseScale.get(layer) ?? 1;

      // Section mode hides outer shells; peel/ghost keep them as ghosts
      layer.visible = !(mode === "section" && isOuter);

      this._layerScaleTarget.set(layer, isActive ? baseS * 1.02 : baseS);

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
          // section
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
        } else {
          // ensure transparent while lerping
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

    // Thin accent along the cut face (section mode)
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

    // Smooth opacity / emissive toward targets (~180ms)
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
        eachMaterial(layer, (m) => {
          const target = this._targets.get(m);
          if (!target) return;
          m.opacity = lerp(m.opacity ?? 1, target.opacity, alpha);
          m.transparent = true;
          if (m.emissive) {
            m.emissiveIntensity = lerp(m.emissiveIntensity ?? 0, target.emissiveIntensity, alpha);
          }
          // snap discrete flags once close
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
