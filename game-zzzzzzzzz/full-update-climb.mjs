/**
 * Proof: full DriveMode.update WITH mansion wall colliders for 25s from
 * beginClimbAutodrive pose (-3.65,0.075,10.80) keys.forward — must reach maxY≥2.5.
 */
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
console.log("Booting Mansion + Drive for full-update-climb…");
const mansion = new Mansion(scene);
const drive = new DriveMode(scene, camera);
drive.setWallColliders(mansion.getColliders());
drive.enter();

const ax = -3.65, ay = 0.075, az = 10.80;
const yaw = Math.atan2(-4.70 - ax, 10.00 - az);
drive.tracks._lastPathId = "foyer_climb_spur";
drive.tracks._lastPathKind = "floor";
drive._crashPhase = null;
drive._crashTimer = 0;
drive._inputsFrozen = false;
drive.car.setPose(ax, ay, az, yaw);
drive.car.speed = 0.45;
drive.car.crashed = false;
drive.car.airborne = false;
drive.car.vy = 0;
drive.keys = { forward: true, back: false, left: false, right: false, boost: false };
drive._autoLastWall = performance.now();
drive._autodrive = {
  mode: "climb", t: 0, duration: 25, maxY: ay, done: false, pass: false,
  foot: { x: -4.55, y: 0.06, z: 10.55 },
  logEl: null, bannerEl: null, logAcc: 0, result: "",
};

// Simulate Chrome-throttled rAF: rare frames with large rawDt — catch-up must still crest.
const dt = 1 / 60;
let maxY = ay;
const wallStart = performance.now();
// Advance wall clock artificially between updates to prove catch-up path
let fakeNow = wallStart;
const realNow = performance.now.bind(performance);
performance.now = () => fakeNow;

for (let i = 0; i < 90; i++) {
  // One "rAF" every ~280ms wall (throttled), rawDt ~0.28 — without catch-up maxY freezes
  fakeNow += 280;
  drive.update(0.28);
  maxY = Math.max(maxY, drive.car.position.y, drive._autodrive?.maxY || 0);
  if (i % 10 === 0) {
    const p = drive.car.position;
    console.log(`frame ${i} t=${drive._autodrive?.t?.toFixed(1)} y=${p.y.toFixed(2)} maxY=${maxY.toFixed(2)} path=${drive.tracks._lastPathId}`);
  }
  if (drive._autodrive?.done) break;
}
performance.now = realNow;

const pass = maxY >= 2.5;
console.log(pass ? "PASS" : "FAIL", `full-update-with-walls maxY=${maxY.toFixed(3)} ad=${drive._autodrive?.result || ""}`);
if (!pass) process.exit(2);
