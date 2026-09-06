import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export class InspectMode {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enabled = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.8;
    this.controls.maxDistance = 6;
    this.controls.enablePan = false;
    this.active = false;
    this.targetObject = null;
    this._savedPos = new THREE.Vector3();
    this._savedQuat = new THREE.Quaternion();
  }

  enter(object3d) {
    this.targetObject = object3d;
    this._savedPos.copy(this.camera.position);
    this._savedQuat.copy(this.camera.quaternion);
    const target = new THREE.Vector3();
    object3d.getWorldPosition(target);
    this.controls.target.copy(target);
    this.camera.position.set(target.x + 1.6, target.y + 0.9, target.z + 1.6);
    this.camera.lookAt(target);
    this.controls.enabled = true;
    this.active = true;
    this.controls.update();
  }

  exit() {
    this.controls.enabled = false;
    this.active = false;
    this.targetObject = null;
    this.camera.position.copy(this._savedPos);
    this.camera.quaternion.copy(this._savedQuat);
  }

  update() {
    if (this.active) this.controls.update();
  }
}
