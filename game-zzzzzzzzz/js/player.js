import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

/**
 * Leisurely first-person stroll — comfortable walk, Shift for brisk,
 * crisp stop (no floaty slide), story-aware floors.
 */
export class Player {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new PointerLockControls(camera, domElement);
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.keys = {
      forward: false, back: false, left: false, right: false, brisk: false,
    };
    this.enabled = true;
    /** Comfortable stroll (m/s feel) */
    this.walkSpeed = 3.9;
    /** Shift = purposeful brisk walk, not sprint chaos */
    this.briskSpeed = 5.6;
    this.eyeHeight = 1.6;
    this.radius = 0.36;
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
      case "ShiftLeft":
      case "ShiftRight":
        this.keys.brisk = down;
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

  get speed() {
    return this.keys.brisk ? this.briskSpeed : this.walkSpeed;
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
    this.velocity.set(0, 0, 0);
  }

  get position() {
    return this.controls.getObject().position;
  }

  update(dt, colliders) {
    if (!this.enabled || !this.controls.isLocked) {
      // Settle quickly when unlocked / disabled
      const settle = 1 - Math.exp(-14 * dt);
      this.velocity.x *= 1 - settle;
      this.velocity.z *= 1 - settle;
      return;
    }

    const moving =
      this.keys.forward || this.keys.back || this.keys.left || this.keys.right;
    // Smooth accel while moving; still crisp stop (not floaty)
    const friction = moving ? 7.8 : 16.5;
    const damp = 1 - Math.exp(-friction * dt);
    this.velocity.x -= this.velocity.x * damp;
    this.velocity.z -= this.velocity.z * damp;

    this.direction.z = Number(this.keys.forward) - Number(this.keys.back);
    this.direction.x = Number(this.keys.right) - Number(this.keys.left);
    this.direction.normalize();

    const accel = (this.keys.brisk ? 11.2 : 8.6) * this.speed;
    if (this.keys.forward || this.keys.back) {
      this.velocity.z -= this.direction.z * accel * dt;
    }
    if (this.keys.left || this.keys.right) {
      this.velocity.x -= this.direction.x * accel * dt;
    }

    // Soft cap so accel doesn't overshoot stroll/brisk
    const maxV = this.speed * 1.05;
    const hSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (hSpeed > maxV) {
      const s = maxV / hSpeed;
      this.velocity.x *= s;
      this.velocity.z *= s;
    }

    const obj = this.controls.getObject();
    const before = obj.position.clone();
    this.controls.moveRight(-this.velocity.x * dt);
    this.controls.moveForward(-this.velocity.z * dt);

    // Multi-floor grounding: sample using last floorY (story-aware)
    const sampleY = this._sampleFloor(obj.position.x, obj.position.z);
    const targetEye = sampleY + this.eyeHeight;
    const dy = Math.abs(targetEye - obj.position.y);
    // Soften floor/story eye-height blend (still snappy on big drops)
    const lerp = dy > 2.2 ? Math.min(1, dt * 16)
      : dy > 0.85 ? Math.min(1, dt * 11)
        : Math.min(1, dt * 8.5);
    obj.position.y = THREE.MathUtils.lerp(obj.position.y, targetEye, lerp);
    if (!Number.isFinite(obj.position.y)) obj.position.y = targetEye;
    this.floorY = sampleY;

    if (colliders && colliders.length) {
      this._resolveColliders(obj, before, colliders);
    }
  }

  /**
   * Robust wall blocking: multi-pass axis slide + minimum-penetration push-out.
   * Character must never tunnel through thin mansion walls.
   */
  _resolveColliders(obj, before, colliders) {
    const feetY = () => obj.position.y - this.eyeHeight + 0.15;
    const headY = () => obj.position.y + 0.35;

    const overlapsY = (box) => !(headY() < box.min.y || feetY() > box.max.y);

    for (let pass = 0; pass < 3; pass++) {
      let hitAny = false;
      for (const box of colliders) {
        if (!overlapsY(box)) continue;
        if (!this._hits(obj.position, box)) continue;
        hitAny = true;

        const tryX = before.clone();
        tryX.x = obj.position.x;
        tryX.y = obj.position.y;
        const tryZ = before.clone();
        tryZ.z = obj.position.z;
        tryZ.y = obj.position.y;

        const okX = !this._hits(tryX, box);
        const okZ = !this._hits(tryZ, box);

        if (okX && !okZ) {
          obj.position.x = tryX.x;
          obj.position.z = before.z;
          this.velocity.z *= 0.25;
        } else if (okZ && !okX) {
          obj.position.z = tryZ.z;
          obj.position.x = before.x;
          this.velocity.x *= 0.25;
        } else if (okX && okZ) {
          const dx = Math.abs(obj.position.x - before.x);
          const dz = Math.abs(obj.position.z - before.z);
          if (dx >= dz) {
            obj.position.x = tryX.x;
            obj.position.z = before.z;
            this.velocity.z *= 0.25;
          } else {
            obj.position.z = tryZ.z;
            obj.position.x = before.x;
            this.velocity.x *= 0.25;
          }
        } else {
          obj.position.x = before.x;
          obj.position.z = before.z;
          this.velocity.x *= 0.15;
          this.velocity.z *= 0.15;
          this._depenetrate(obj, box);
          const fy = this._sampleFloor(obj.position.x, obj.position.z);
          obj.position.y = fy + this.eyeHeight;
          this.floorY = fy;
        }

        if (this._hits(obj.position, box)) {
          this._depenetrate(obj, box);
        }
      }
      if (!hitAny) break;
      before.x = obj.position.x;
      before.z = obj.position.z;
      before.y = obj.position.y;
    }
  }

  /** Push capsule out along the shallowest penetration axis. */
  _depenetrate(obj, box) {
    const r = this.radius;
    const px = obj.position.x;
    const pz = obj.position.z;
    const overlapL = (px + r) - box.min.x;
    const overlapR = box.max.x - (px - r);
    const overlapD = (pz + r) - box.min.z;
    const overlapU = box.max.z - (pz - r);
    if (overlapL <= 0 || overlapR <= 0 || overlapD <= 0 || overlapU <= 0) return;

    const minPen = Math.min(overlapL, overlapR, overlapD, overlapU);
    const eps = 0.002;
    if (minPen === overlapL) obj.position.x = box.min.x - r - eps;
    else if (minPen === overlapR) obj.position.x = box.max.x + r + eps;
    else if (minPen === overlapD) obj.position.z = box.min.z - r - eps;
    else obj.position.z = box.max.z + r + eps;
  }

  _hits(pos, box) {
    const r = this.radius;
    return (
      pos.x + r > box.min.x &&
      pos.x - r < box.max.x &&
      pos.z + r > box.min.z &&
      pos.z - r < box.max.z
    );
  }

  dispose() {
    document.removeEventListener("keydown", this._onKey);
    document.removeEventListener("keyup", this._onKey);
  }
}
