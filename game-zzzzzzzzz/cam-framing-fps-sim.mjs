/**
 * logic7 — chase-cam framing vs frame rate (full DriveMode.update WITH walls).
 * Live logic6 at 0.7–5.7 fps: the car shrank to a dot while moving and snapped back when it
 * stopped. This drives the SAME held-W route (spawn → foyer → Climb A → crest → hairpin, plus
 * a Climb B descent) with rendered frames of 1 s, 0.2 s and 1/60 s, a per-sub-step driver,
 * a 3 s stop-and-go mid-route, and checks at EVERY rendered frame (launch included) that cam→car distance is within ±20% of the nominal
 * chase framing (DriveMode.chaseNominalDistance) — plus the car stays in the view frustum,
 * and the mean distance agrees across frame rates within 10%.
 */
import * as THREE from "./vendor/three.module.js";
import { Mansion } from "./js/mansion.js";
import { DriveMode } from "./js/drive/driveMode.js";
import { TRACK_PATHS, PRIMARY_CIRCUIT } from "./js/data/tracks.js";
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

const fails = [];
const ok = (name, pass, detail = "") => {
  console.log((pass ? "PASS  " : "FAIL  ") + name + (detail ? " — " + detail : ""));
  if (!pass) fails.push(name);
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, 1.6, 0.08, 240);
const mansion = new Mansion(scene);
const drive = new DriveMode(scene, camera);
drive.setWallColliders(mansion.getColliders());

const byId = Object.fromEntries(TRACK_PATHS.map((q) => [q.id, q]));
const line = [];
for (const id of PRIMARY_CIRCUIT) {
  const pts = byId[id].points.map((q) => new THREE.Vector3(q.x, q.y, q.z));
  const curve = pts.length >= 3 ? new THREE.CatmullRomCurve3(pts, false, "catmullrom", byId[id].tension ?? 0.15) : null;
  const L = curve ? curve.getLength() : pts[0].distanceTo(pts[1]);
  const sp = curve ? curve.getSpacedPoints(Math.max(2, Math.ceil(L / 0.05))) : [pts[0], pts[1]];
  for (let i = line.length ? 1 : 0; i < sp.length; i++) line.push({ p: sp[i], id });
}

// Per-sub-step pursuit driver (so steering quality does not depend on the render rate)
const origFrame = drive._updateFrame.bind(drive);
let idx = 0, simT = 0;
drive._updateFrame = (dt) => {
  simT += dt;
  const pos = drive.car.position;
  let best = idx, bd = Infinity;
  for (let k = idx; k < Math.min(line.length, idx + 60); k++) {
    const q = line[k].p;
    const d = Math.hypot(q.x - pos.x, (q.y - pos.y) * 2, q.z - pos.z);
    if (d < bd) { bd = d; best = k; }
  }
  idx = best;
  const look = line[Math.min(line.length - 1, idx + 14)].p;
  let d = Math.atan2(look.x - pos.x, look.z - pos.z) - drive.car.yaw;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  // stop-and-go: release W for 3 s mid-route (coast to rest), then hold again
  drive.keys.forward = !(simT > 20 && simT < 23);
  drive.keys.left = d > 0.03; drive.keys.right = d < -0.03;
  origFrame(dt);
};

const runs = {};
for (const [label, frameDt] of [["1fps", 1.0], ["5fps", 0.2], ["60fps", 1 / 60]]) {
  drive.enter();
  idx = 0; simT = 0;
  drive.keys = { forward: true, back: false, left: false, right: false, boost: false };
  const T = 75; // s of sim time — spawn → Climb A → crest → hairpin → … → Climb B descent
  let t = 0, n = 0, bad = 0, worst = { r: 1 }, sum = 0, offFrame = 0, maxY = 0, sawB = false;
  while (t < T && idx < line.length - 3) {
    drive.update(frameDt);
    t += frameDt;
    const c = drive.car.position, cam = drive.camera.position;
    const dist = cam.distanceTo(c);
    const nom = drive.chaseNominalDistance();
    const r = dist / nom;
    maxY = Math.max(maxY, c.y);
    if (line[idx].id === "climb_b") sawB = true;
    // every rendered frame counts — including the launch from rest and the stop-and-go
    n++; sum += dist;
    if (r < 0.8 || r > 1.2) bad++;
    if (Math.abs(r - 1) > Math.abs(worst.r - 1)) worst = { r, dist, nom, x: c.x, y: c.y, z: c.z, path: line[idx].id, spd: drive.car.speed };
    camera.updateMatrixWorld(true);
    const ndc = new THREE.Vector3(c.x, c.y + 0.03, c.z).project(camera);
    if (!(ndc.z < 1 && Math.abs(ndc.x) < 0.95 && Math.abs(ndc.y) < 0.95)) offFrame++;
  }
  runs[label] = { mean: sum / Math.max(1, n), n };
  ok(`cam-dist-within-20pct-${label}`, n > 0 && bad === 0,
    `frames=${n} bad=${bad} worst=${(worst.r * 100).toFixed(0)}% (${(worst.dist ?? 0).toFixed(3)} vs nominal ${(worst.nom ?? 0).toFixed(3)}) @${(worst.x ?? 0).toFixed(2)},${(worst.y ?? 0).toFixed(2)},${(worst.z ?? 0).toFixed(2)} ${worst.path || ""} v=${(worst.spd ?? 0).toFixed(2)}`);
  ok(`car-in-frame-${label}`, offFrame === 0, `offFrame=${offFrame}`);
  ok(`route-covered-${label}`, maxY > 4.1 && sawB, `maxY=${maxY.toFixed(2)} reachedClimbB=${sawB} progress=${(idx / line.length * 100).toFixed(0)}%`);
  drive.exit();
}
const means = Object.values(runs).map((q) => q.mean);
const spread = (Math.max(...means) - Math.min(...means)) / Math.min(...means);
ok("cam-dist-same-across-fps", spread < 0.10, Object.entries(runs).map(([k, v]) => `${k}=${v.mean.toFixed(3)}`).join(" ") + ` spread=${(spread * 100).toFixed(1)}%`);

console.log(fails.length ? `\n${fails.length} FAIL(s): ${fails.join(", ")}` : "\nALL PASS");
process.exit(fails.length ? 1 : 0);
