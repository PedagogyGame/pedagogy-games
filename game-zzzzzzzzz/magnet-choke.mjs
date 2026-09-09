import * as THREE from "./vendor/three.module.js";
import { Mansion } from "./js/mansion.js";
import { DriveMode } from "./js/drive/driveMode.js";
import { CAR_SPAWN, TRACK_PATHS } from "./js/data/tracks.js";

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

const path = TRACK_PATHS.find(p => p.id === "foyer_drive_start");
console.log("=== foyer_drive_start points + clearPointFromWalls delta ===");
for (const pt of path.points) {
  const snap = drive.tracks.querySnap(pt.x, pt.y, pt.z, 1.65);
  const cleared = drive._clearPointFromWalls(snap.x ?? pt.x, snap.z ?? pt.z, 0.075);
  const dx = cleared.x - (snap.x ?? pt.x);
  const dz = cleared.z - (snap.z ?? pt.z);
  console.log(`pt=(${pt.x},${pt.z}) snap=(${(snap.x??0).toFixed(2)},${(snap.z??0).toFixed(2)}) on=${!!snap.onTrack} cleared=(${cleared.x.toFixed(2)},${cleared.z.toFixed(2)}) d=(${dx.toFixed(3)},${dz.toFixed(3)})`);
}

// ALL stair/furniture soft boxes that still intersect y band near west foyer
console.log("\n=== ALL soft kinds with min.y<0.2 max.y>0 near west foyer (-9..-4, 7..13) ===");
for (const b of drive._wallColliders) {
  if (b.max.x < -9.5 || b.min.x > -3.5 || b.max.z < 6.5 || b.min.z > 13.5) continue;
  if (b.min.y > 0.2 || b.max.y < 0) continue;
  console.log(b.driveKind,
    `min=(${b.min.x.toFixed(2)},${b.min.y.toFixed(2)},${b.min.z.toFixed(2)})`,
    `max=(${b.max.x.toFixed(2)},${b.max.y.toFixed(2)},${b.max.z.toFixed(2)})`);
}

// Raw (pre-soft) same region — what got raised away?
console.log("\n=== RAW furniture/stair near west foyer (any y overlapping 0..0.5) ===");
for (const b of mansion.getColliders()) {
  if (b.max.x < -9.5 || b.min.x > -3.5 || b.max.z < 6.5 || b.min.z > 13.5) continue;
  if (b.min.y > 0.5 || b.max.y < 0) continue;
  console.log(b.driveKind||"wall",
    `min=(${b.min.x.toFixed(2)},${b.min.y.toFixed(2)},${b.min.z.toFixed(2)})`,
    `max=(${b.max.x.toFixed(2)},${b.max.y.toFixed(2)},${b.max.z.toFixed(2)})`,
    `szXZ=${(b.max.x-b.min.x).toFixed(2)}x${(b.max.z-b.min.z).toFixed(2)}`);
}

// What is the wooden furniture visual near spawn left?
// Search mansion for meshes near (-5, 0, 11)
console.log("\n=== Named meshes near spawn left ===");
scene.traverse(o => {
  if (!o.isMesh || !o.position) return;
  const p = new THREE.Vector3();
  o.getWorldPosition(p);
  if (p.x > -9 && p.x < -2 && p.z > 8 && p.z < 13 && p.y < 3) {
    const n = o.name || o.parent?.name || "?";
    if (n !== "?" || (o.geometry?.type && p.y < 1.5)) {
      // filter small
      const box = new THREE.Box3().setFromObject(o);
      const s = new THREE.Vector3(); box.getSize(s);
      if (s.x > 0.3 || s.z > 0.3) {
        console.log(n, o.geometry?.type, `pos=(${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}) size=(${s.x.toFixed(2)},${s.y.toFixed(2)},${s.z.toFixed(2)})`);
      }
    }
  }
});

// Widen ribbon / straighten path analysis: how far off center is straight-W?
console.log("\n=== Lateral miss of straight-W vs ribbon ===");
const yaw = CAR_SPAWN.yaw;
for (let d=0; d<=4; d+=0.25) {
  const x = CAR_SPAWN.x + Math.sin(yaw)*d;
  const z = CAR_SPAWN.z + Math.cos(yaw)*d;
  const s = drive.tracks.querySnap(x,0.075,z,2.0,yaw);
  console.log(`d=${d.toFixed(2)} lat=${s?.dist?.toFixed(3)} on=${!!s?.onTrack} half≈${((s?.edgeMargin??0)+(s?.dist??0)).toFixed(3)}`);
}
