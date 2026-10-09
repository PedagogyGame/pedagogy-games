/**
 * logic3 — honest human-style lap: pure-pursuit steering (W held, A/D only) along the
 * ordered PRIMARY_CIRCUIT centerline through full DriveMode.update WITH walls.
 * No pose writes, no yaw writes — only keys. Reports stalls, crashes, wall hits,
 * off-ribbon rate, speed dips. Not a ready claim — parent live-proves.
 */
import * as THREE from "./vendor/three.module.js";
import { Mansion } from "./js/mansion.js";
import { DriveMode } from "./js/drive/driveMode.js";
import { TRACK_PATHS, PRIMARY_CIRCUIT } from "./js/data/tracks.js";
if (typeof globalThis.document === "undefined") {
  const makeCtx = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : (k === "measureText" ? () => ({ width: 0 }) : (k === "getImageData" ? () => ({ data: new Uint8ClampedArray(4) }) : (k.startsWith && k.startsWith("create") ? () => ({ addColorStop() {} }) : () => {})))), set: (t, k, v) => { t[k] = v; return true; } });
  globalThis.document = {
    createElement: (t) => t === "canvas" ? { width: 0, height: 0, getContext: () => makeCtx(), style: {} }
      : { style: {}, classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {}, removeEventListener() {}, remove() {} },
    addEventListener() {}, removeEventListener() {}, getElementById: () => null, querySelector: () => null,
    head: { appendChild() {} }, body: { appendChild() {} },
  };
}
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;

const fails = [];
const ok = (name, pass, detail = "") => {
  console.log((pass ? "PASS  " : "FAIL  ") + name + (detail ? " — " + detail : ""));
  if (!pass) fails.push(name);
};
const VERBOSE = !!process.env.LAPDBG;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
const mansion = new Mansion(scene);
const drive = new DriveMode(scene, camera);
drive.setWallColliders(mansion.getColliders());
drive.enter();
const car = drive.car;

// Ordered centerline (same CatmullRom as TrackSystem)
const byId = Object.fromEntries(TRACK_PATHS.map((p) => [p.id, p]));
const line = [];
for (const id of PRIMARY_CIRCUIT) {
  const p = byId[id];
  const pts = p.points.map((q) => new THREE.Vector3(q.x, q.y, q.z));
  const curve = pts.length >= 3 ? new THREE.CatmullRomCurve3(pts, false, "catmullrom", p.tension ?? 0.15) : null;
  const L = curve ? curve.getLength() : pts[0].distanceTo(pts[1]);
  const n = Math.max(2, Math.ceil(L / 0.05));
  const sp = curve ? curve.getSpacedPoints(n) : [pts[0], pts[1]];
  for (let i = line.length ? 1 : 0; i < sp.length; i++) line.push({ p: sp[i], id });
}
const totalN = line.length;

const dt = 1 / 60;
let idx = 0;
let crashed = false, stallT = 0, maxStall = 0, offN = 0, n = 0, minV = 99, started = false;
let maxLatErr = 0, wallFrames = 0;
const pathsSeen = [];
let lastPrint = -1;
drive.keys = { forward: true, back: false, left: false, right: false, boost: false };
const T = 90;
let done = false;
for (let f = 0; f < 60 * T; f++) {
  const pos = car.position;
  // advance progress index (search window ahead, 3D-aware)
  let best = idx, bd = Infinity;
  for (let k = idx; k < Math.min(totalN, idx + 60); k++) {
    const q = line[k].p;
    const d = Math.hypot(q.x - pos.x, (q.y - pos.y) * 2, q.z - pos.z);
    if (d < bd) { bd = d; best = k; }
  }
  idx = best;
  maxLatErr = Math.max(maxLatErr, Math.hypot(line[idx].p.x - pos.x, line[idx].p.z - pos.z));
  const look = line[Math.min(totalN - 1, idx + 14)].p; // ~0.7u lookahead
  const want = Math.atan2(look.x - pos.x, look.z - pos.z);
  let d = want - car.yaw;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  drive.keys.left = d > 0.03;
  drive.keys.right = d < -0.03;
  const px = pos.x, pz = pos.z;
  drive.update(dt);
  if (drive._crashPhase || car.crashed) { crashed = true; break; }
  const p = car.position;
  const id = line[idx].id;
  if (pathsSeen.at(-1) !== id) pathsSeen.push(id);
  const moved = Math.hypot(p.x - px, p.z - pz);
  if (moved < 0.004) stallT += dt; else stallT = 0;
  maxStall = Math.max(maxStall, stallT);
  if ((drive._frameWallHits || 0) > 0) wallFrames++;
  const snap = drive.tracks.querySnap(p.x, p.y, p.z, 1.65, car.yaw);
  n++; if (!snap.onTrack) offN++;
  if (car.speed > 0.8) started = true;
  if (started) minV = Math.min(minV, car.speed);
  const sec = Math.floor(f / 60);
  if (VERBOSE && sec !== lastPrint) {
    lastPrint = sec;
    console.log(`  t=${sec} p=${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)} v=${car.speed.toFixed(2)} idx=${idx}/${totalN} ${id} on=${snap.onTrack ? 1 : 0} snapPath=${snap.pathId} wall=${drive._frameWallHits || 0}`);
  }
  if (maxStall > 3) break;
  if (idx >= totalN - 3) { done = true; break; }
}
const p = car.position;
console.log(`  end p=${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)} idx=${idx}/${totalN} path=${line[idx].id} seq=${pathsSeen.join(">")}`);
ok("pursuit-lap-complete", done, `progress=${(idx / totalN * 100).toFixed(1)}%`);
ok("pursuit-lap-no-crash", !crashed);
ok("pursuit-lap-no-stall", maxStall < 1.0, `maxStall=${maxStall.toFixed(2)}s`);
ok("pursuit-lap-on-ribbon", offN / Math.max(1, n) < 0.05, `off=${(offN / Math.max(1, n) * 100).toFixed(1)}%`);
ok("pursuit-lap-wall-free", wallFrames === 0, `wallFrames=${wallFrames}`);
ok("pursuit-lap-holds-speed", minV > 0.35, `minV=${minV.toFixed(3)}`);
console.log(`  maxLatErr=${maxLatErr.toFixed(3)}`);
console.log(fails.length ? `\n${fails.length} FAIL(s): ${fails.join(", ")}` : "\nALL PASS");
process.exit(fails.length ? 1 : 0);
