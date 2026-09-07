import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export class InspectMode {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enabled = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.6;
    this.controls.maxDistance = 8;
    this.controls.enablePan = false;
    this.active = false;
    this.targetObject = null;
    this._savedPos = new THREE.Vector3();
    this._savedQuat = new THREE.Quaternion();
    this._keyLight = null;
    this._fillLight = null;
    this._box = new THREE.Box3();
    this._size = new THREE.Vector3();
    this._center = new THREE.Vector3();
  }

  enter(object3d, scene) {
    this.targetObject = object3d;
    this._savedPos.copy(this.camera.position);
    this._savedQuat.copy(this.camera.quaternion);

    this._box.setFromObject(object3d);
    this._box.getCenter(this._center);
    this._box.getSize(this._size);
    const radius = Math.max(this._size.length() * 0.5, 0.35);
    const fitDist = Math.max(radius / Math.sin((this.camera.fov * Math.PI) / 360) * 0.55, 1.2);

    this.controls.target.copy(this._center);
    this.camera.position.set(
      this._center.x + fitDist * 0.72,
      this._center.y + fitDist * 0.38,
      this._center.z + fitDist * 0.72
    );
    this.camera.lookAt(this._center);
    this.controls.minDistance = Math.max(radius * 0.9, 0.5);
    this.controls.maxDistance = Math.max(fitDist * 2.8, 4);
    this.controls.enabled = true;
    this.active = true;
    this.controls.update();

    if (scene) this._addLights(scene, this._center, radius);
  }

  _addLights(scene, center, radius) {
    this._removeLights(scene);
    this._keyLight = new THREE.DirectionalLight(0xffe6c0, 0.85);
    this._keyLight.position.set(center.x + radius * 2.2, center.y + radius * 2.8, center.z + radius * 1.4);
    this._keyLight.target.position.copy(center);
    scene.add(this._keyLight);
    scene.add(this._keyLight.target);

    this._fillLight = new THREE.PointLight(0xc8d8ff, 12, radius * 6, 2);
    this._fillLight.position.set(center.x - radius * 1.5, center.y + radius * 1.2, center.z + radius * 1.8);
    scene.add(this._fillLight);
  }

  _removeLights(scene) {
    if (this._keyLight && scene) {
      scene.remove(this._keyLight.target);
      scene.remove(this._keyLight);
    }
    if (this._fillLight && scene) scene.remove(this._fillLight);
    this._keyLight = null;
    this._fillLight = null;
  }

  exit(scene) {
    this.controls.enabled = false;
    this.active = false;
    this.targetObject = null;
    this.camera.position.copy(this._savedPos);
    this.camera.quaternion.copy(this._savedQuat);
    if (scene) this._removeLights(scene);
  }

  update() {
    if (this.active) this.controls.update();
  }
}
