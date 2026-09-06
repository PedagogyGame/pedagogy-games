import * as THREE from "three";
import { SHARED_CLIP_PLANE } from "./meshes.js";

function eachMaterial(layer, fn) {
  layer.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) fn(m, o);
  });
}

export class SliceSystem {
  constructor() {
    this.object = null;
    this.def = null;
    this.index = 0;
    this.particles = null;
    this.rimLight = null;
    this.onLayerChange = null;
    this._baseOpacity = new WeakMap();
  }

  attach(object3d, scene) {
    this.detach(scene);
    this.object = object3d;
    this.def = object3d.userData.def;
    this.index = 0;
    // remember original opacities
    for (const layer of object3d.userData.layers || []) {
      eachMaterial(layer, (m) => {
        if (!this._baseOpacity.has(m)) this._baseOpacity.set(m, m.opacity ?? 1);
        m.clippingPlanes = [SHARED_CLIP_PLANE];
        m.clipShadows = true;
      });
    }
    this._apply();
    this._spawnVFX(scene);
    return this.currentLayer();
  }

  detach(scene) {
    if (this.object && this.object.userData.layers) {
      for (const layer of this.object.userData.layers) {
        layer.visible = true;
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
        });
      }
    }
    if (this.particles && scene) {
      scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particles.material.dispose();
    }
    if (this.rimLight && scene) scene.remove(this.rimLight);
    this.particles = null;
    this.rimLight = null;
    this.object = null;
    this.def = null;
    this.index = 0;
  }

  setIndex(i) {
    if (!this.def) return null;
    this.index = Math.max(0, Math.min(this.def.layers.length - 1, i));
    this._apply();
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
    };
  }

  _apply() {
    const layers = this.object.userData.layers;
    // Soften clip as we peel deeper (slight offset so inner faces read clearly)
    SHARED_CLIP_PLANE.constant = 0.02 + this.index * 0.01;

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      layer.visible = true; // keep cutaway context — fade outers instead of hiding
      const isActive = i === this.index;
      const isOuter = i < this.index;
      const isInner = i > this.index;

      eachMaterial(layer, (m) => {
        const base = this._baseOpacity.get(m) ?? 1;
        if (m.emissive) {
          if (isActive) {
            m.emissive.setHex(0xffd54f);
            m.emissiveIntensity = 0.4;
          } else {
            m.emissive.setHex(0x000000);
            m.emissiveIntensity = 0;
          }
        }
        if (isOuter) {
          // ghost outer shells so the section stack still reads
          m.transparent = true;
          m.opacity = Math.min(base, 0.2);
          m.depthWrite = false;
        } else if (isActive) {
          m.transparent = true;
          m.opacity = Math.min(base, 0.95);
          m.depthWrite = true;
        } else if (isInner) {
          m.transparent = base < 1;
          m.opacity = i === this.index + 1 ? Math.min(base, 0.85) : base;
          m.depthWrite = true;
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
  }

  update(t) {
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
  }
}
