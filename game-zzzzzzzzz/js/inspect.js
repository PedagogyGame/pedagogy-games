import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/**
 * Inspect orbit — soft ease into framing, calm damping for leisurely look-around.
 */
export class InspectMode {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enabled = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.078;
    this.controls.minDistance = 0.55;
    this.controls.maxDistance = 9;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.82;
    this.controls.zoomSpeed = 0.9;
    this.controls.minPolarAngle = 0.18;
    this.controls.maxPolarAngle = Math.PI - 0.22;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0.55;
    this.active = false;
    this.targetObject = null;
    this._savedPos = new THREE.Vector3();
    this._savedQuat = new THREE.Quaternion();
    this._keyLight = null;
    this._fillLight = null;
    this._rimLight = null;
    this._box = new THREE.Box3();
    this._size = new THREE.Vector3();
    this._center = new THREE.Vector3();
    this._easeFrom = new THREE.Vector3();
    this._easeTo = new THREE.Vector3();
    this._easeTargetFrom = new THREE.Vector3();
    this._easeTargetTo = new THREE.Vector3();
    this._easeT = 1;
    this._easeDur = 0.58;
    this._autoUntil = 0;
  }

  enter(object3d, scene) {
    this.targetObject = object3d;
    this._savedPos.copy(this.camera.position);
    this._savedQuat.copy(this.camera.quaternion);

    this._box.setFromObject(object3d);
    this._box.getCenter(this._center);
    this._box.getSize(this._size);
    const radius = Math.max(this._size.length() * 0.5, 0.45);
    // Prefer a closer frame so small curios fill the view
    const fitDist = Math.max(radius / Math.sin((this.camera.fov * Math.PI) / 360) * 0.48, 1.05);

    this._easeFrom.copy(this.camera.position);
    this._easeTargetFrom.copy(this.controls.target);
    this._easeTargetTo.copy(this._center);
    // Bias hard toward +X so the section cut face (YZ disks) faces the camera
    this._easeTo.set(
      this._center.x + fitDist * 1.05,
      this._center.y + fitDist * 0.32,
      this._center.z + fitDist * 0.28
    );
    this._easeT = 0;

    this.controls.target.copy(this._center);
    this.controls.minDistance = Math.max(radius * 0.85, 0.48);
    this.controls.maxDistance = Math.max(fitDist * 3.0, 4.5);
    this.controls.enabled = true;
    this.controls.autoRotate = true;
    this._autoUntil = 1.35; // gentle intro spin, then hand control
    this.active = true;

    if (scene) this._addLights(scene, this._center, radius);
  }

  _addLights(scene, center, radius) {
    this._removeLights(scene);
    this._keyLight = new THREE.DirectionalLight(0xffe6c0, 1.25);
    this._keyLight.position.set(center.x + radius * 2.2, center.y + radius * 2.8, center.z + radius * 1.4);
    this._keyLight.target.position.copy(center);
    scene.add(this._keyLight);
    scene.add(this._keyLight.target);

    this._fillLight = new THREE.PointLight(0xc8d8ff, 22, radius * 7.5, 2);
    this._fillLight.position.set(center.x - radius * 1.5, center.y + radius * 1.2, center.z + radius * 1.8);
    scene.add(this._fillLight);

    // Warm rim from the cut side so Section faces read clearly
    this._rimLight = new THREE.PointLight(0xffd699, 18, radius * 6, 2);
    // Rim from +X (cut side) so section faces pop
    this._rimLight.position.set(center.x + radius * 2.2, center.y + radius * 0.55, center.z);
    scene.add(this._rimLight);
  }

  _removeLights(scene) {
    if (this._keyLight && scene) {
      scene.remove(this._keyLight.target);
      scene.remove(this._keyLight);
    }
    if (this._fillLight && scene) scene.remove(this._fillLight);
    if (this._rimLight && scene) scene.remove(this._rimLight);
    this._keyLight = null;
    this._fillLight = null;
    this._rimLight = null;
  }

  exit(scene) {
    this.controls.enabled = false;
    this.controls.autoRotate = false;
    this.active = false;
    this.targetObject = null;
    this._easeT = 1;
    this._autoUntil = 0;
    this.camera.position.copy(this._savedPos);
    this.camera.quaternion.copy(this._savedQuat);
    if (scene) this._removeLights(scene);
  }

  update(dt = 1 / 60) {
    if (!this.active) return;
    if (this._easeT < 1) {
      this._easeT = Math.min(1, this._easeT + dt / this._easeDur);
      // Quintic smoothstep — softer settle into orbit framing
      const u = this._easeT;
      const s = u * u * u * (u * (u * 6 - 15) + 10);
      this.camera.position.lerpVectors(this._easeFrom, this._easeTo, s);
      this.controls.target.lerpVectors(this._easeTargetFrom, this._easeTargetTo, s);
      this.camera.lookAt(this.controls.target);
      this.controls.update();
      return;
    }
    if (this._autoUntil > 0) {
      this._autoUntil -= dt;
      if (this._autoUntil <= 0) this.controls.autoRotate = false;
    }
    this.controls.update();
  }
}
