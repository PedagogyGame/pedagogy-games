import * as THREE from "three";

export class SliceSystem {
  constructor() {
    this.object = null;
    this.def = null;
    this.index = 0;
    this.particles = null;
    this.rimLight = null;
    this.onLayerChange = null;
  }

  attach(object3d, scene) {
    this.detach(scene);
    this.object = object3d;
    this.def = object3d.userData.def;
    this.index = 0;
    this._apply();
    this._spawnVFX(scene);
    return this.currentLayer();
  }

  detach(scene) {
    if (this.object && this.object.userData.layers) {
      for (const m of this.object.userData.layers) {
        m.visible = true;
        if (m.material) {
          m.material.emissive?.setHex(0x000000);
          m.material.emissiveIntensity = 0;
        }
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
    return { ...this.def.layers[this.index], index: this.index, total: this.def.layers.length, objectName: this.def.name };
  }

  _apply() {
    const layers = this.object.userData.layers;
    for (let i = 0; i < layers.length; i++) {
      const m = layers[i];
      // Onion peel: hide shells outside current depth
      m.visible = i >= this.index;
      if (m.material && m.material.emissive) {
        if (i === this.index) {
          m.material.emissive.setHex(0xffd54f);
          m.material.emissiveIntensity = 0.35;
          m.material.transparent = true;
          m.material.opacity = 0.92;
        } else {
          m.material.emissive.setHex(0x000000);
          m.material.emissiveIntensity = 0;
          m.material.opacity = i === this.index + 1 ? 0.85 : 1;
        }
      }
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
