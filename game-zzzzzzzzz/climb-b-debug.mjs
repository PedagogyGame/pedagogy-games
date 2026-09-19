import * as THREE from "./vendor/three.module.js";
import { Mansion } from "./js/mansion.js";
import { DriveMode } from "./js/drive/driveMode.js";

if (typeof globalThis.document === "undefined") {
  const makeCtx = () => ({
    fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1, font: "",
    textAlign: "", textBaseline: "",
    fillRect() {}, strokeRect() {}, clearRect() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, bezierCurveTo() {}, arc() {},
    ellipse() {}, rect() {}, stroke() {}, fill() {}, clip() {}, save() {}, restore() {},
    translate() {}, rotate() {}, scale() {}, setTransform() {}, setLineDash() {},
    fillText() {}, strokeText() {}, measureText: () => ({ width: 0 }),
    drawImage() {}, createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => null,
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    putImageData() {},
  });
  globalThis.document = {
    createElement: (t) => t === "canvas"
      ? { width: 0, height: 0, getContext: () => makeCtx(), style: {} }
      : { style: {}, classList: { add() {}, remove() {} }, appendChild() {},
          addEventListener() {}, removeEventListener() {},
          textContent: "", id: "", className: "", remove() {} },
    addEventListener() {}, removeEventListener() {},
    getElementById: () => null, querySelector: () => null,
    head: { appendChild() {} }, body: { appendChild() {} },
  };
}
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (typeof globalThis.performance === "undefined") {
  globalThis.performance = { now: () => Date.now() };
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
const mansion = new Mansion(scene);
const drive = new DriveMode(scene, camera);
drive.setWallColliders(mansion.getColliders());
drive.enter();

console.log("=== mid-ramp forced drive ===");
drive.tracks._lastPathId = "climb_b";
drive.tracks._lastPathKind = "ramp";
drive.car.setPose(7.0, 3.5, 1.0, 0);
drive.car.speed = 1.2;
drive.keys = { forward: true, back: false, left: false, right: false, boost: false };
drive._autodrive = null;

for (let i = 0; i < 240; i++) {
  drive.update(1 / 60);
  const p = drive.car.position;
  if (i % 40 === 0) {
    console.log(`mid ${i} xyz=${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)} yaw=${drive.car.yaw.toFixed(2)} spd=${drive.car.speed.toFixed(2)} path=${drive.tracks._lastPathId}`);
  }
}
console.log("mid-final", drive.car.position.y.toFixed(2), drive.car.position.z.toFixed(2));

console.log("=== autodrive b start pose ===");
drive.beginClimbAutodrive("b");
console.log("pose", {
  x: drive.car.position.x, y: drive.car.position.y, z: drive.car.position.z,
  yaw: drive.car.yaw, path: drive.tracks._lastPathId, keys: drive.keys,
});

const cols = mansion.getColliders();
let n = 0;
for (const c of cols) {
  const b = c.box || c;
  if (!b.min) continue;
  if (b.max.x > 5.5 && b.min.x < 8.5 && b.max.z > -3 && b.min.z < 2 && b.max.y > 3.5 && b.min.y < 5) {
    n++;
    if (n <= 25) {
      console.log("col", c.driveKind || c.kind || "?",
        `x[${b.min.x.toFixed(2)},${b.max.x.toFixed(2)}]`,
        `y[${b.min.y.toFixed(2)},${b.max.y.toFixed(2)}]`,
        `z[${b.min.z.toFixed(2)},${b.max.z.toFixed(2)}]`);
    }
  }
}
console.log("near crest colliders", n);
