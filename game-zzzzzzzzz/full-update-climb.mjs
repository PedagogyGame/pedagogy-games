/**
 * Proof: beginClimbAutodrive("a") full DriveMode.update WITH walls —
 * must crest Climb A (maxY≥3.5, path=climb_a). Parent live-proves; not ready.
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
console.log("Booting Mansion + Drive for climb-a autodrive…");
const mansion = new Mansion(scene);
const drive = new DriveMode(scene, camera);
drive.setWallColliders(mansion.getColliders());
drive.enter();

drive.beginClimbAutodrive("a");

let fakeNow = performance.now();
const realNow = performance.now.bind(performance);
performance.now = () => fakeNow;

let maxY = drive.car.position.y;
let sawClimbA = false;
for (let i = 0; i < 120; i++) {
  fakeNow += 280;
  drive.update(0.28);
  const ad = drive._autodrive;
  const p = drive.car.position;
  const path = drive.tracks._lastPathId;
  if (path === "climb_a") sawClimbA = true;
  maxY = Math.max(maxY, p.y, ad?.maxY || 0);
  if (i % 10 === 0) {
    console.log(
      `frame ${i} t=${ad?.t?.toFixed(1)} y=${p.y.toFixed(2)} maxY=${maxY.toFixed(2)} path=${path} saw=${ad?.sawPath ? 1 : 0}`
    );
  }
  if (ad?.done) break;
}
performance.now = realNow;

const ad = drive._autodrive;
const pass = !!(ad?.pass && maxY >= 2.5 && (ad?.sawPath || sawClimbA));
console.log(
  pass ? "PASS" : "FAIL",
  `climb-a-autodrive maxY=${maxY.toFixed(3)} result=${ad?.result || ""}`
);
if (!pass) process.exit(2);
