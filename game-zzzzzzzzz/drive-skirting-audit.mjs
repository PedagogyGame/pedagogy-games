/**
 * Audit: skirting centerlines vs Drive-soft stair/furniture colliders (pin traps).
 * Also sample primary climb approaches with walls on.
 */
import * as THREE from "./vendor/three.module.js";
import { Mansion } from "./js/mansion.js";
import { DriveMode } from "./js/drive/driveMode.js";
import { TRACK_PATHS, RAMP_MOUNT_FEET } from "./js/data/tracks.js";

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
      : { style: {}, classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {}, removeEventListener() {} },
    addEventListener() {}, removeEventListener() {},
    getElementById: () => null, querySelector: () => null, body: { appendChild() {} },
  };
}
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
const mansion = new Mansion(scene);
const drive = new DriveMode(scene, camera);
drive.setWallColliders(mansion.getColliders());
drive.enter();

const r = drive._carRadius || 0.12;
const softCols = drive._wallColliders;

const skirts = TRACK_PATHS.filter((p) => !p.disabled && (p.id.includes("skirting") || p.id.includes("skirt")));
console.log("SKIRTING_COUNT", skirts.length);
console.log("STAIR_SOFT", softCols.filter((b) => b.driveKind === "stair").map((b) => ({
  kind: b.driveKind,
  x: [+b.min.x.toFixed(3), +b.max.x.toFixed(3)],
  y: [+b.min.y.toFixed(3), +b.max.y.toFixed(3)],
  z: [+b.min.z.toFixed(3), +b.max.z.toFixed(3)],
  bw: +(b.max.x - b.min.x).toFixed(3),
  bd: +(b.max.z - b.min.z).toFixed(3),
})));

const hits = [];
// Use the same Catmull-resampled segments Drive actually drives, rather than raw
// control points; this catches curved skirting edges and all rooms consistently.
for (const seg of drive.tracks.segments) {
  if (!seg.pathId || !skirts.some((p) => p.id === seg.pathId)) continue;
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const s = {
      x: seg.a.x + (seg.b.x - seg.a.x) * t,
      y: seg.a.y + (seg.b.y - seg.a.y) * t,
      z: seg.a.z + (seg.b.z - seg.a.z) * t,
    };
    const yBand = (s.y ?? 0) + 0.07;
    for (const b of softCols) {
      if (b.driveKind !== "stair" && b.driveKind !== "furniture") continue;
      if (b.min.y > yBand + 0.08 || b.max.y < yBand - 0.05) continue;
      if (s.x + r > b.min.x && s.x - r < b.max.x && s.z + r > b.min.z && s.z - r < b.max.z) {
        hits.push({ path: seg.pathId, kind: b.driveKind,
          at: { x: +s.x.toFixed(3), y: +s.y.toFixed(3), z: +s.z.toFixed(3) },
          box: { x: [+b.min.x.toFixed(3), +b.max.x.toFixed(3)],
            y: [+b.min.y.toFixed(3), +b.max.y.toFixed(3)], z: [+b.min.z.toFixed(3), +b.max.z.toFixed(3)] } });
      }
    }
  }
}

// Dedup by path+kind+rounded position
const seen = new Set();
const uniq = [];
for (const h of hits) {
  const k = `${h.path}|${h.kind}|${h.at.x}|${h.at.z}|${h.box.x}|${h.box.z}`;
  if (seen.has(k)) continue;
  seen.add(k);
  uniq.push(h);
}
console.log("SKIRT_TRAP_HITS", uniq.length);
for (const h of uniq.slice(0, 40)) console.log(" HIT", JSON.stringify(h));

// Assert every sampled Drive skirting centerline is clear at car radius and
// all softened boxes remain valid (the old descending-cellar rule inverted one).
const invalid = softCols.filter((b) =>
  b.min.x > b.max.x || b.min.y > b.max.y || b.min.z > b.max.z
);
console.log("INVALID_SOFT_AABBS", invalid.length);
if (uniq.length || invalid.length) {
  console.error(`FAIL skirting audit: traps=${uniq.length} invalidAABBs=${invalid.length}`);
  process.exitCode = 1;
} else {
  console.log("ALL SKIRTING / STAIR / FURNITURE AUDIT CHECKS PASSED");
}
