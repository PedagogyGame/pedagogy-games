import * as THREE from "./vendor/three.module.js";
import { Mansion } from "./js/mansion.js";
import { DriveMode } from "./js/drive/driveMode.js";
import { CAR_SPAWN } from "./js/data/tracks.js";

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
      : { style: {}, classList: { add() {}, remove() {}, contains: () => false }, appendChild() {}, addEventListener() {}, removeEventListener() {} },
    addEventListener() {}, removeEventListener() {},
    getElementById: () => null, querySelector: () => null, body: { appendChild() {} },
  };
}
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60,1,0.1,200);
const mansion = new Mansion(scene);
const drive = new DriveMode(scene, camera);
drive.setWallColliders(mansion.getColliders());

const yaw = Math.PI + 0.32;
const sx = CAR_SPAWN.x, sz = CAR_SPAWN.z;

const soft = drive._wallColliders;
function dumpHits(cols, label, x, z, y=0.075, r=0.15) {
  console.log("\n"+label, "at", x.toFixed(2), z.toFixed(2));
  for (let i=0;i<cols.length;i++) {
    const b = cols[i];
    const y0=y-0.02, y1=y+0.12;
    if (y1 < b.min.y || y0 > b.max.y) continue;
    if (!(x+r>b.min.x && x-r<b.max.x && z+r>b.min.z && z-r<b.max.z)) continue;
    console.log(i, b.driveKind||"?", 
      `min=(${b.min.x.toFixed(2)},${b.min.y.toFixed(2)},${b.min.z.toFixed(2)})`,
      `max=(${b.max.x.toFixed(2)},${b.max.y.toFixed(2)},${b.max.z.toFixed(2)})`,
      `size=${(b.max.x-b.min.x).toFixed(2)}x${(b.max.y-b.min.y).toFixed(2)}x${(b.max.z-b.min.z).toFixed(2)}`);
  }
}
const px = sx + Math.sin(yaw)*2.0;
const pz = sz + Math.cos(yaw)*2.0;
dumpHits(soft, "SOFT forward@2m", px, pz, 0.075, 0.15);
dumpHits(soft, "SOFT forward@2m r=0.25", px, pz, 0.075, 0.25);

console.log("\n=== Soft colliders car-height near apron (-6..0, 9..13.5) ===");
for (let i=0;i<soft.length;i++) {
  const b = soft[i];
  const y0=-0.02, y1=0.20;
  if (y1 < b.min.y || y0 > b.max.y) continue;
  if (b.max.x < -6.5 || b.min.x > 0.5 || b.max.z < 8.5 || b.min.z > 13.5) continue;
  console.log(i, b.driveKind||"?",
    `min=(${b.min.x.toFixed(2)},${b.min.y.toFixed(2)},${b.min.z.toFixed(2)})`,
    `max=(${b.max.x.toFixed(2)},${b.max.y.toFixed(2)},${b.max.z.toFixed(2)})`,
    `sz=${(b.max.x-b.min.x).toFixed(2)}x${(b.max.y-b.min.y).toFixed(2)}x${(b.max.z-b.min.z).toFixed(2)}`);
}

console.log("\n=== Snap along authored yaw ===");
for (const d of [0,0.5,1,1.5,1.7,1.9,2.0,2.2,2.5,3.0]) {
  const x = sx + Math.sin(yaw)*d;
  const z = sz + Math.cos(yaw)*d;
  const s = drive.tracks.querySnap(x, 0.075, z, 1.65, yaw);
  console.log(`d=${d.toFixed(1)} (${x.toFixed(2)},${z.toFixed(2)}) on=${!!s?.onTrack} carpet=${!!s?.carpet} path=${s?.pathId||"-"} dist=${s?.dist?.toFixed?.(3)} edge=${s?.edgeMargin?.toFixed?.(3)} wb=${JSON.stringify(s?.wallBounce||null)}`);
}

// foyer_drive_start is a curve west — straight W leaves ribbon. Is ribbon too narrow/wrong shape?
console.log("\n=== foyer_drive_start segment halfW samples ===");
const segs = drive.tracks.segments.filter(s => s.pathId === "foyer_drive_start");
console.log("segs", segs.length);
for (const s of segs.slice(0,8)) {
  console.log(`  a=(${s.a.x.toFixed(2)},${s.a.z.toFixed(2)}) b=(${s.b.x.toFixed(2)},${s.b.z.toFixed(2)}) halfW=${s.halfW} kind=${s.kind}`);
}

// Check if apron snap fights ribbon
console.log("\n=== spawn apron meta ===", drive.tracks._spawnApron);

// What happens if car goes straight W and hits the wall at d=2?
dumpHits(soft, "SOFT at ( -3.83, 10.25 )", -3.83, 10.25, 0.075, 0.12);

// Raw mansion walls near that point
const raw = mansion.getColliders();
dumpHits(raw, "RAW at (-3.83,10.25)", -3.83, 10.25, 0.075, 0.2);

// Stair furniture near west climb
console.log("\n=== Near ramp foot (-7.15,11.20) car-height ===");
dumpHits(soft, "SOFT ramp foot", -7.15, 11.20, 0.075, 0.5);
dumpHits(soft, "SOFT ramp approach (-6.1,11.18)", -6.1, 11.18, 0.075, 0.4);

// Browser discrepancy: maybe pointer lock / keys. Check if _inputsFrozen or enter issues
drive.enter();
console.log("\nenter keys/frozen", { frozen: drive._inputsFrozen, active: drive.active, yaw: drive.car.yaw });
