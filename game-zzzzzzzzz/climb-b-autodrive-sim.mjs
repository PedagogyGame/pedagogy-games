/**
 * Headless prove: beginClimbAutodrive("b") holds W from Climb B landing foot
 * down to foyer — PASS when drop≥2.5 and path=climb_b.
 * Parent live-proves; not a ready claim.
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
console.log("Booting Mansion + Drive for climb-b autodrive…");
const mansion = new Mansion(scene);
const drive = new DriveMode(scene, camera);
drive.setWallColliders(mansion.getColliders());
drive.enter();

drive.beginClimbAutodrive("b");

let fakeNow = performance.now();
const realNow = performance.now.bind(performance);
performance.now = () => fakeNow;

let sawClimbB = false;
for (let i = 0; i < 120; i++) {
  fakeNow += 280;
  drive.update(0.28);
  const ad = drive._autodrive;
  const p = drive.car.position;
  const path = drive.tracks._lastPathId;
  if (path === "climb_b") sawClimbB = true;
  if (i % 10 === 0) {
    console.log(
      `frame ${i} t=${ad?.t?.toFixed(1)} y=${p.y.toFixed(2)} drop=${(ad?.drop || 0).toFixed(2)} path=${path} saw=${ad?.sawPath ? 1 : 0}`
    );
  }
  if (ad?.done) break;
}
performance.now = realNow;

const ad = drive._autodrive;
const pass = !!(ad?.pass && (ad.drop || 0) >= 2.5 && (ad.sawPath || sawClimbB));
console.log(
  pass ? "PASS" : "FAIL",
  `climb-b-autodrive drop=${(ad?.drop || 0).toFixed(3)} minY=${(ad?.minY ?? 0).toFixed(3)} result=${ad?.result || ""}`
);
if (!pass) process.exit(2);
