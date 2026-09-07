import * as THREE from "three";
import { RCCar } from "./car.js";
import { TrackSystem } from "./tracks.js";
import { CAR_SPAWN, SHORTCUT_TOAST_RE } from "../data/tracks.js";

/**
 * Drive-mode orchestrator: RC car + chase cam + track snap + HUD hooks.
 * Completely separate from Explore FPS walk.
 */
export class DriveMode {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.active = false;
    this.tracks = new TrackSystem(scene);
    this.car = new RCCar();
    this.scene.add(this.car.root);
    this.car.root.visible = false;
    this.tracks.setVisible(false);

    this.keys = { forward: false, back: false, left: false, right: false, boost: false };
    this._onKey = this._onKey.bind(this);
    this._camPos = new THREE.Vector3();
    this._camTarget = new THREE.Vector3();
    this._lookAhead = new THREE.Vector3();
    this._camVel = new THREE.Vector3();
    this._lastLabel = "";
    this._labelCooldown = 0;
    this._hintCooldown = 0;
    this._lastHint = "";
    this._baseFov = camera.fov || 60;
    this._fov = this._baseFov;
    this._tunnelDark = 0;
    this._time = 0;
    this.onCheckpoint = null;
    this.onSpeed = null;
    this.onHint = null;

    this._fxRoot = new THREE.Group();
    this._fxRoot.name = "drive_fx";
    this._fxRoot.visible = false;
    scene.add(this._fxRoot);
    this._speedLines = [];
    this._dust = [];
    this._buildFx();

    this.car.setPose(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, CAR_SPAWN.yaw);
  }

  _buildFx() {
    // Cheap speed lines (boost juice)
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false,
    });
    for (let i = 0; i < 10; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.55), lineMat.clone());
      line.visible = false;
      this._fxRoot.add(line);
      this._speedLines.push(line);
    }
    // Dust / petal puffs when boosting
    const dustMat = new THREE.MeshStandardMaterial({
      color: 0xd7ccc8, emissive: 0xffcc80, emissiveIntensity: 0.4,
      transparent: true, opacity: 0.0, roughness: 0.8,
    });
    for (let i = 0; i < 8; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), dustMat.clone());
      d.visible = false;
      this._fxRoot.add(d);
      this._dust.push({ mesh: d, life: 0, vx: 0, vy: 0, vz: 0 });
    }
  }

  _onKey(e) {
    if (!this.active) return;
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
        this.keys.boost = down;
        break;
    }
  }

  enter() {
    this.active = true;
    this.car.root.visible = true;
    this.tracks.setVisible(true);
    this._fxRoot.visible = true;
    this.car.setPose(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, CAR_SPAWN.yaw);
    this.car.speed = 0;
    this.keys = { forward: false, back: false, left: false, right: false, boost: false };
    this._baseFov = this.camera.fov || 60;
    this._fov = this._baseFov;
    this._tunnelDark = 0;
    this._camVel.set(0, 0, 0);
    if (typeof document !== "undefined") {
      document.addEventListener("keydown", this._onKey);
      document.addEventListener("keyup", this._onKey);
    }
    this._snapCamera(true);
  }

  exit() {
    this.active = false;
    this.car.root.visible = false;
    this.tracks.setVisible(false);
    this._fxRoot.visible = false;
    this.car.speed = 0;
    this.keys = { forward: false, back: false, left: false, right: false, boost: false };
    this.camera.fov = this._baseFov;
    this.camera.updateProjectionMatrix();
    if (typeof document !== "undefined") {
      document.removeEventListener("keydown", this._onKey);
      document.removeEventListener("keyup", this._onKey);
    }
  }

  _snapCamera(immediate = false) {
    const p = this.car.position;
    const yaw = this.car.yaw;
    const spd = Math.abs(this.car.speed);
    // Cinematic chase: more look-ahead distance at speed, slightly lower
    const back = 2.75 + Math.min(1.7, spd * 0.14);
    const up = 1.35 + Math.min(0.55, spd * 0.045);
    const cx = p.x - Math.sin(yaw) * back;
    const cy = p.y + up;
    const cz = p.z - Math.cos(yaw) * back;
    this._camPos.set(cx, cy, cz);

    const ahead = 1.6 + Math.min(2.8, spd * 0.22);
    this._lookAhead.set(
      p.x + Math.sin(yaw) * ahead,
      p.y + 0.32 + Math.min(0.25, spd * 0.02),
      p.z + Math.cos(yaw) * ahead
    );
    this._camTarget.copy(this._lookAhead);

    if (immediate) {
      this.camera.position.copy(this._camPos);
      this.camera.lookAt(this._camTarget);
    }
  }

  _updateFx(dt, snap) {
    const boosting = this.car.isBoosting;
    const spd = Math.abs(this.car.speed);
    const p = this.car.position;
    const yaw = this.car.yaw;
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);

    for (let i = 0; i < this._speedLines.length; i++) {
      const line = this._speedLines[i];
      if (boosting && spd > 4) {
        line.visible = true;
        const side = (i % 2 === 0 ? -1 : 1) * (0.25 + (i % 5) * 0.08);
        const back = 0.4 + (i * 0.12);
        line.position.set(
          p.x - fwdX * back + Math.cos(yaw) * side,
          p.y + 0.15 + (i % 3) * 0.08,
          p.z - fwdZ * back - Math.sin(yaw) * side
        );
        line.rotation.y = yaw;
        line.material.opacity = 0.15 + Math.min(0.45, (spd - 4) * 0.06);
      } else {
        line.material.opacity = Math.max(0, line.material.opacity - 4 * dt);
        if (line.material.opacity <= 0.02) line.visible = false;
      }
    }

    // Spawn dust occasionally while boosting or drifting
    if ((boosting || this.car.driftTrail > 0.35) && spd > 3 && Math.random() < 0.35) {
      const slot = this._dust.find((d) => d.life <= 0);
      if (slot) {
        slot.life = 0.45 + Math.random() * 0.35;
        slot.vx = -fwdX * 0.6 + (Math.random() - 0.5) * 0.8;
        slot.vy = 0.4 + Math.random() * 0.5;
        slot.vz = -fwdZ * 0.6 + (Math.random() - 0.5) * 0.8;
        slot.mesh.visible = true;
        slot.mesh.position.set(p.x - fwdX * 0.2, p.y + 0.05, p.z - fwdZ * 0.2);
        const petal = snap?.kind === "flower";
        slot.mesh.material.color.setHex(petal ? 0xf48fb1 : 0xd7ccc8);
        slot.mesh.material.emissive.setHex(petal ? 0xe91e63 : 0xffcc80);
      }
    }
    for (const d of this._dust) {
      if (d.life <= 0) { d.mesh.visible = false; continue; }
      d.life -= dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      d.vy -= 1.2 * dt;
      d.mesh.material.opacity = Math.max(0, d.life * 1.2);
      d.mesh.scale.setScalar(0.7 + (0.5 - d.life));
    }
  }

  update(dt) {
    if (!this.active) return;
    this._time += dt;
    const pos = this.car.position;

    // Larger snap radius; magnet kinds hold tighter via car.js
    const snap = this.tracks.querySnap(pos.x, pos.y, pos.z, 2.85);

    // Exit boost pad micro-boost
    if (this.tracks.onBoostPad(pos.x, pos.z) && this.car.speed > 1) {
      this.car.speed = Math.min(this.car.boostMax, this.car.speed + 6 * dt);
    }

    this.car.update(dt, this.keys, snap);
    this.tracks.updateVisuals(this._time);
    this._updateFx(dt, snap);

    this._snapCamera(false);

    // Critically-damped-ish follow: less jitter than raw lerp
    const spring = 5.2;
    const damp = 2.4;
    const dx = this._camPos.x - this.camera.position.x;
    const dy = this._camPos.y - this.camera.position.y;
    const dz = this._camPos.z - this.camera.position.z;
    this._camVel.x += (dx * spring - this._camVel.x * damp) * dt;
    this._camVel.y += (dy * spring - this._camVel.y * damp) * dt;
    this._camVel.z += (dz * spring - this._camVel.z * damp) * dt;
    this.camera.position.x += this._camVel.x * dt;
    this.camera.position.y += this._camVel.y * dt;
    this.camera.position.z += this._camVel.z * dt;
    this.camera.lookAt(this._camTarget);

    // Tunnel / shortcut darkness → FOV recover smoothly after exit
    const inDark =
      snap?.kind === "shortcut" || snap?.kind === "mouse" || snap?.kind === "shaft"
      || snap?.kind === "tunnel" || snap?.kind === "chute";
    this._tunnelDark = THREE.MathUtils.lerp(this._tunnelDark, inDark ? 1 : 0, Math.min(1, 3.5 * dt));

    const wantFov = this.keys.boost && Math.abs(this.car.speed) > 3
      ? this._baseFov + 10
      : this._baseFov - this._tunnelDark * 4;
    this._fov = THREE.MathUtils.lerp(this._fov, wantFov, Math.min(1, 5.5 * dt));
    if (Math.abs(this.camera.fov - this._fov) > 0.04) {
      this.camera.fov = this._fov;
      this.camera.updateProjectionMatrix();
    }

    if (this.onSpeed) this.onSpeed(this.car.getSpeedKmh());

    this._labelCooldown = Math.max(0, this._labelCooldown - dt);
    this._hintCooldown = Math.max(0, this._hintCooldown - dt);

    const cp = this.tracks.nearestCheckpoint(pos.x, pos.z, 3.2, pos.y);
    if (cp && cp.label !== this._lastLabel && this._labelCooldown <= 0) {
      this._lastLabel = cp.label;
      this._labelCooldown = 2.5;
      if (this.onCheckpoint) {
        const isShortcut = SHORTCUT_TOAST_RE.test(cp.label);
        this.onCheckpoint(cp.label, { shortcut: isShortcut });
      }
    }

    // HUD hint near mouse holes / portals
    const portal = this.tracks.nearestPortal(pos.x, pos.y, pos.z, 2.6);
    if (portal && this._hintCooldown <= 0) {
      const hint =
        portal.kind === "flower" ? "Shortcut — petal path"
          : portal.kind === "shaft" || portal.kind === "chute" ? "Shortcut — pipe shaft"
            : "Shortcut — wall run";
      if (hint !== this._lastHint) {
        this._lastHint = hint;
        this._hintCooldown = 3.0;
        if (this.onHint) this.onHint(hint);
      }
    }
  }
}
