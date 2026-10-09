/**
 * Proof: beginClimbAutodrive("a") full DriveMode.update WITH walls —
 * must crest Climb A (maxY≥3.8, on=1, no crash). Parent live-proves; not ready.
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
const crashed = !!(drive._crashPhase || drive.car?.crashed);
// logic3 honest PASS: full crest (≥4.15), on=1 in the result line, no crash
const pass = !!(ad?.pass && maxY >= 4.15 && (ad?.sawPath || sawClimbA) && /on=1/.test(ad.result || "") && !crashed);
console.log(
  pass ? "PASS" : "FAIL",
  `climb-a-autodrive maxY=${maxY.toFixed(3)} result=${ad?.result || ""}`
);

// logic7: HOLD after the result — the car must stay parked on drawn asphalt (logic6 kept W
// held after PASS and rolled onto room floors / into walls). Also asphalt-under-car in result.
let holdFail = !pass;
{
  const asphInResult = /asphalt=(ribbon_|spawn_|climb_end_band)/.test(ad?.result || "");
  const h = ad?.holdAt || { x: drive.car.position.x, y: drive.car.position.y, z: drive.car.position.z };
  let maxD = 0;
  for (let i = 0; i < 14; i++) { drive.update(i < 7 ? 0.28 : 1.0); const p = drive.car.position; maxD = Math.max(maxD, Math.hypot(p.x - h.x, p.z - h.z)); }
  const p = drive.car.position;
  const asph = drive._asphaltUnderCar();
  const snap = drive.tracks.querySnap(p.x, p.y, p.z, 1.65, drive.car.yaw);
  const holdOk = asphInResult && maxD < 0.4 && Math.abs(drive.car.speed) < 0.01 && asph.ok && !!snap?.onTrack && !drive.car.crashed;
  console.log(holdOk ? "PASS" : "FAIL", `climb-a-hold-after-pass asphaltInResult=${asphInResult} roll=${maxD.toFixed(3)}u speed=${drive.car.speed.toFixed(3)} under=${asph.hit} gap=${asph.gap?.toFixed(3)} on=${snap?.onTrack ? 1 : 0}`);
  if (!holdOk) holdFail = true;
  // a real key press hands control back
  const p0 = drive.car.position.clone();
  drive.keys.forward = true;
  for (let i = 0; i < 30; i++) drive.update(1 / 60);
  const moved = Math.hypot(drive.car.position.x - p0.x, drive.car.position.z - p0.z);
  const takeOk = moved > 0.02 && ad && ad.hold === false;
  console.log(takeOk ? "PASS" : "FAIL", `climb-a-player-takeover moved=${moved.toFixed(3)}u`);
  if (!takeOk) holdFail = true;
}
if (holdFail) process.exit(2);
