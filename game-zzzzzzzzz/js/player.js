import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

export class Player {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new PointerLockControls(camera, domElement);
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.keys = { forward: false, back: false, left: false, right: false };
    this.enabled = true;
    this.speed = 6.5;
    this.eyeHeight = 1.6;
    this.radius = 0.35;
    this.floorY = 0;
    /** @type {null | ((x:number,z:number)=>number)} set by main — should pass this.floorY as story hint */
    this.getFloorY = null;
    this._onKey = this._onKey.bind(this);
    document.addEventListener("keydown", this._onKey);
    document.addEventListener("keyup", this._onKey);
  }

  _onKey(e) {
    const down = e.type === "keydown";
    switch (e.code) {
      case "KeyW":
      case "ArrowUp":
        this.keys.forward = down;
        break;
      case "KeyS":
      case "ArrowDown":
        this.keys.back = down;
        break;
      case "KeyA":
      case "ArrowLeft":
        this.keys.left = down;
        break;
      case "KeyD":
      case "ArrowRight":
        this.keys.right = down;
        break;
    }
  }

  lock() {
    this.controls.lock();
  }

  unlock() {
    this.controls.unlock();
  }

  get locked() {
    return this.controls.isLocked;
  }

  _sampleFloor(x, z) {
    if (!this.getFloorY) return this.floorY;
    const y = this.getFloorY(x, z);
    return Number.isFinite(y) ? y : this.floorY;
  }

  setPosition(x, y, z) {
    const fy = this._sampleFloor(x, z);
    this.floorY = fy;
    const eye = y != null && Number.isFinite(y) && y > fy + 0.2 ? y : fy + this.eyeHeight;
    this.controls.getObject().position.set(x, eye, z);
  }

  get position() {
    return this.controls.getObject().position;
  }

  update(dt, colliders) {
    if (!this.enabled || !this.controls.isLocked) {
      this.velocity.x -= this.velocity.x * 8 * dt;
      this.velocity.z -= this.velocity.z * 8 * dt;
      return;
    }
    this.velocity.x -= this.velocity.x * 10 * dt;
    this.velocity.z -= this.velocity.z * 10 * dt;
    this.direction.z = Number(this.keys.forward) - Number(this.keys.back);
    this.direction.x = Number(this.keys.right) - Number(this.keys.left);
    this.direction.normalize();
    if (this.keys.forward || this.keys.back) this.velocity.z -= this.direction.z * this.speed * dt * 12;
    if (this.keys.left || this.keys.right) this.velocity.x -= this.direction.x * this.speed * dt * 12;

    const obj = this.controls.getObject();
    const before = obj.position.clone();
    this.controls.moveRight(-this.velocity.x * dt);
    this.controls.moveForward(-this.velocity.z * dt);

    // Multi-floor grounding: sample using last floorY (story-aware)
    const sampleY = this._sampleFloor(obj.position.x, obj.position.z);
    const targetEye = sampleY + this.eyeHeight;
    // Snap harder on stairs / story changes to avoid float
    const dy = Math.abs(targetEye - obj.position.y);
    const lerp = dy > 1.5 ? Math.min(1, dt * 22) : Math.min(1, dt * 14);
    obj.position.y = THREE.MathUtils.lerp(obj.position.y, targetEye, lerp);
    if (!Number.isFinite(obj.position.y)) obj.position.y = targetEye;
    this.floorY = sampleY;

    if (colliders && colliders.length) {
      for (const box of colliders) {
        // Only collide with wall boxes near our elevation
        if (obj.position.y + 0.5 < box.min.y || obj.position.y - 1.8 > box.max.y) continue;
        if (this._hits(obj.position, box)) {
          obj.position.x = before.x;
          if (this._hits(obj.position, box)) {
            obj.position.x = before.x + (obj.position.x - before.x);
            obj.position.z = before.z;
          }
          if (this._hits(obj.position, box)) {
            obj.position.copy(before);
            const fy = this._sampleFloor(obj.position.x, obj.position.z);
            obj.position.y = fy + this.eyeHeight;
            this.floorY = fy;
          }
        }
      }
    }
  }

  _hits(pos, box) {
    const r = this.radius;
    return (
      pos.x + r > box.min.x &&
      pos.x - r < box.max.x &&
      pos.z + r > box.min.z &&
      pos.z - r < box.max.z &&
      pos.y < box.max.y &&
      pos.y > box.min.y
    );
  }

  dispose() {
    document.removeEventListener("keydown", this._onKey);
    document.removeEventListener("keyup", this._onKey);
  }
}
