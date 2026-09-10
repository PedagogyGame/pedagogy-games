/**
 * Ruthless Drive gate — CAR_SPAWN + ALL colliders + human-like W.
 * PASS: sustain speed>0.5 for 4s AND move >2m into open foyer, no pin.
 * Also: path spawn→ramp foot continuous asphalt, no car-height collider choke.
 */
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

const fails = [];
const ok = (name, pass, detail = "") => {
  console.log(pass ? `PASS  ${name}${detail ? " — " + detail : ""}` : `FAIL  ${name}${detail ? " — " + detail : ""}`);
  if (!pass) fails.push(name);
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
const mansion = new Mansion(scene);
const drive = new DriveMode(scene, camera);
drive.setWallColliders(mansion.getColliders());
const soft = drive._wallColliders;
const dt = 1 / 60;
const rampPath = TRACK_PATHS.find((p) => p.id === "ramp_foyer_to_landing" && !p.disabled);
const footPt = rampPath?.points?.[0];
const foot = { x: footPt?.x ?? -4.85, z: footPt?.z ?? 8.95 };

function carHeightHits(x, z, r = 0.12) {
  const y0 = 0.055, y1 = 0.20;
  const out = [];
  for (const b of soft) {
    if (y1 < b.min.y || y0 > b.max.y) continue;
    if (!(x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z)) continue;
    out.push(b);
  }
  return out;
}

// ── Path continuity: open lane + climb spur → ramp foot ──
{
  const lane = TRACK_PATHS.find((p) => p.id === "foyer_drive_start");
  const spur = TRACK_PATHS.find((p) => p.id === "foyer_climb_spur");
  const pts = [...lane.points, ...spur.points.slice(1)];
  let choke = 0, off = 0;
  const n = 48;
  let total = 0;
  const lens = [];
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    lens.push(L); total += L;
  }
  for (let i = 0; i <= n; i++) {
    let want = (i / n) * total;
    let x = pts[0].x, z = pts[0].z;
    for (let j = 0; j < lens.length; j++) {
      if (want <= lens[j]) {
        const u = lens[j] < 1e-6 ? 0 : want / lens[j];
        x = pts[j].x + (pts[j + 1].x - pts[j].x) * u;
        z = pts[j].z + (pts[j + 1].z - pts[j].z) * u;
        break;
      }
      want -= lens[j];
    }
    const snap = drive.tracks.querySnap(x, 0.075, z, 1.8);
    if (!snap?.onTrack) off++;
    if (carHeightHits(x, z, 0.14).length) choke++;
  }
  ok("path spawn→foot continuous asphalt", off === 0, `off=${off}/${n + 1} width=${lane.width}`);
  ok("path spawn→foot no car-height collider choke", choke === 0, `choke=${choke}`);
  ok("path width ≥2.2", lane.width >= 2.2, `w=${lane.width}`);
}

// ── Straight-W stays onTrack ≥2m into foyer ──
{
  drive.enter();
  const yaw = drive.car.yaw;
  let firstOff = null;
  for (const d of [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]) {
    const x = CAR_SPAWN.x + Math.sin(yaw) * d;
    const z = CAR_SPAWN.z + Math.cos(yaw) * d;
    const s = drive.tracks.querySnap(x, 0.075, z, 1.8, yaw);
    if (!s?.onTrack && firstOff == null) firstOff = d;
  }
  ok("straight-W corridor onTrack ≥2.0m", firstOff == null || firstOff > 2.0, `firstOff=${firstOff}`);
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  ok("enter yaw into foyer (-Z)", fz < -0.85, `fwd=(${fx.toFixed(2)},${fz.toFixed(2)}) deg=${(yaw * 180 / Math.PI).toFixed(1)}`);
}

// ── Full DriveMode W-hold 4s with colliders (human: no steer first 1.2s, then mild toward climb) ──
{
  drive.enter();
  const car = drive.car;
  const start = { x: car.position.x, z: car.position.z };
  let above05 = 0, wallHits = 0, carpet = 0, maxV = 0, pin = false;
  let minVAfter1 = Infinity;
  for (let i = 0; i < 60 * 4; i++) {
    const t = i * dt;
    if (t > 1.2) {
      const toYaw = Math.atan2(foot.x - car.position.x, foot.z - car.position.z);
      let dy = toYaw - car.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      drive.keys = { forward: true, back: false, left: dy > 0.14, right: dy < -0.14, boost: false };
    } else {
      drive.keys = { forward: true, back: false, left: false, right: false, boost: false };
    }
    drive.update(dt);
    const absV = Math.abs(car.speed);
    maxV = Math.max(maxV, absV);
    if (absV > 0.5) above05++;
    if (t >= 1.0) minVAfter1 = Math.min(minVAfter1, absV);
    if ((drive._frameWallHits || 0) > 0) wallHits++;
    const s = drive.tracks.querySnap(car.position.x, car.position.y, car.position.z, 1.65, car.yaw);
    if (s?.carpet && !s.onTrack) carpet++;
    const dist = Math.hypot(car.position.x - start.x, car.position.z - start.z);
    if (t > 2 && dist < 0.4 && absV < 0.2) pin = true;
  }
  const moved = Math.hypot(car.position.x - start.x, car.position.z - start.z);
  const into = start.z - car.position.z;
  ok("W 4s sustain speed>0.5 (≥3.5s)", above05 >= 60 * 3.5, `frames=${above05} minV@≥1s=${minVAfter1.toFixed(3)}`);
  ok("W 4s move >2m into foyer", moved > 2.0 && into > 0.8, `moved=${moved.toFixed(2)} into=${into.toFixed(2)}`);
  ok("no return-to-pin", !pin, `final=(${car.position.x.toFixed(2)},${car.position.z.toFixed(2)}) v=${Math.abs(car.speed).toFixed(3)}`);
  ok("no carpet-death crawl", carpet < 60, `carpetFrames=${carpet} wallHits=${wallHits} maxV=${maxV.toFixed(2)}`);
}

// ── Pure W no-steer: must leave spawn into foyer on asphalt ──
{
  drive.enter();
  const car = drive.car;
  const start = { x: car.position.x, z: car.position.z };
  drive.keys = { forward: true, back: false, left: false, right: false, boost: false };
  let on = 0;
  for (let i = 0; i < 60 * 3; i++) {
    drive.update(dt);
    const s = drive.tracks.querySnap(car.position.x, car.position.y, car.position.z, 1.65, car.yaw);
    if (s?.onTrack) on++;
  }
  const moved = Math.hypot(car.position.x - start.x, car.position.z - start.z);
  const into = start.z - car.position.z;
  ok("pure W 3s onTrack≥70%", on / (60 * 3) >= 0.70, `onRate=${(on / (60 * 3) * 100).toFixed(1)}%`);
  ok("pure W 3s into foyer >2m", into > 2.0 && moved > 2.0, `into=${into.toFixed(2)} moved=${moved.toFixed(2)}`);
}

// ── Reach ramp foot with soft steer ──
{
  drive.enter();
  const car = drive.car;
  drive.keys = { forward: true, back: false, left: false, right: false, boost: false };
  let reached = false, climb = 0;
  for (let i = 0; i < 60 * 14; i++) {
    const toYaw = Math.atan2(foot.x - car.position.x, foot.z - car.position.z);
    let dy = toYaw - car.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const s = drive.tracks.querySnap(car.position.x, car.position.y, car.position.z, 1.65, car.yaw);
    let left = false, right = false;
    const dist = Math.hypot(car.position.x - foot.x, car.position.z - foot.z);
    // Prefer climb spur / foot aim — don't follow west-wall skirting detour
    const onApproach = s?.pathId === "foyer_drive_start" || s?.pathId === "foyer_climb_spur"
      || s?.pathId === "ramp_foyer_to_landing";
    if (dist > 1.4 && onApproach && s?.yaw != null && s.pathId !== "foyer_climb_spur") {
      let d2 = s.yaw - car.yaw;
      while (d2 > Math.PI) d2 -= Math.PI * 2;
      while (d2 < -Math.PI) d2 += Math.PI * 2;
      let d2r = d2 + Math.PI;
      while (d2r > Math.PI) d2r -= Math.PI * 2;
      while (d2r < -Math.PI) d2r += Math.PI * 2;
      if (Math.abs(d2r) < Math.abs(d2)) d2 = d2r;
      // Blend toward foot so we take the spur T west
      const blend = Math.min(1, dist / 4);
      const aim = dy * (0.55 + 0.35 * (1 - blend)) + d2 * (0.45 * blend);
      left = aim > 0.08; right = aim < -0.08;
    } else {
      left = dy > 0.08; right = dy < -0.08;
    }
    drive.keys = { forward: true, back: false, left, right, boost: false };
    drive.update(dt);
    const s2 = drive.tracks.querySnap(car.position.x, car.position.y, car.position.z, 1.65, car.yaw);
    if (s2?.pathId === "ramp_foyer_to_landing" || s2?.kind === "ramp") climb++;
    if (Math.hypot(car.position.x - foot.x, car.position.z - foot.z) < 0.9
        || (s2?.pathId === "ramp_foyer_to_landing" && s2?.onTrack)) {
      reached = true; break;
    }
    if (car.crashed) break;
  }
  ok("reach ramp_foyer_to_landing foot", reached && !car.crashed,
    `pos=(${car.position.x.toFixed(2)},${car.position.z.toFixed(2)}) climbFrames=${climb} v=${Math.abs(car.speed).toFixed(2)}`);
}

console.log(fails.length ? `\n${fails.length} FAIL(s)` : "\nALL PASSED");
process.exit(fails.length ? 1 : 0);
