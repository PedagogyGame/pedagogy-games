/**
 * logic3 — sustained-throttle feel sim on foyer_sf (full DriveMode.update WITH walls).
 * Hold W from rest at spawn: speed must rise smoothly (no instant jumps) and hold near
 * cruise (no snap to 0) while on foyer_sf. Also steer-at-low-speed smoothness and
 * a full-circuit W+steer-to-ribbon lap for crest/junction settle.
 * Not a ready claim — parent live-proves.
 */
import * as THREE from "./vendor/three.module.js";
import { Mansion } from "./js/mansion.js";
import { DriveMode } from "./js/drive/driveMode.js";
import { TRACK_PATHS } from "./js/data/tracks.js";
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
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
const mansion = new Mansion(scene);
const drive = new DriveMode(scene, camera);
drive.setWallColliders(mansion.getColliders());
drive.enter();
const car = drive.car;
const dt = 1 / 60;

// ── 1) Sustained W from rest on foyer_sf ─────────────────────────────
// (logic3 foyer_sf is the 0.95u S/F straight; W carries on over foyer_to_climb_a → climb_a)
{
  drive.keys = { forward: true, back: false, left: false, right: false, boost: false };
  const sp = [];
  let maxStep = 0, zeroAfterMove = 0, offN = 0, n = 0;
  let prev = 0;
  for (let f = 0; f < 150; f++) { // 2.5 s
    drive.update(dt);
    const s = car.speed;
    sp.push(s);
    if (f > 0) maxStep = Math.max(maxStep, s - prev);
    if (prev > 0.3 && s < 0.05) zeroAfterMove++;
    const path = drive.tracks._lastPathId;
    n++;
    if (!(path === "foyer_sf" || path === "foyer_to_climb_a" || path === "climb_a")) offN++;
    prev = s;
    if (drive.car.position.x < -5.0) break;
  }
  const at = (t) => sp[Math.min(sp.length - 1, Math.round(t / dt))];
  const peak = Math.max(...sp);
  const tail = sp.slice(Math.floor(sp.length * 0.6));
  const tailMin = Math.min(...tail);
  // Monotone rise until near cruise (allow tiny noise)
  let dips = 0;
  for (let i = 1; i < sp.length; i++) if (sp[i] < sp[i - 1] - 0.02 && sp[i - 1] < peak * 0.95) dips++;
  console.log(`  speed t=0.1:${at(0.1).toFixed(3)} 0.25:${at(0.25).toFixed(3)} 0.5:${at(0.5).toFixed(3)} 1.0:${at(1.0).toFixed(3)} 1.5:${at(1.5).toFixed(3)} peak=${peak.toFixed(3)} frames=${sp.length}`);
  ok("sustained-w-rises", at(0.5) > at(0.1) && at(1.0) > 0.8, `v0.1=${at(0.1).toFixed(3)} v1.0=${at(1.0).toFixed(3)}`);
  ok("sustained-w-holds", tailMin > 0.8 * Math.min(peak, car.maxSpeed) && zeroAfterMove === 0,
    `tailMin=${tailMin.toFixed(3)} peak=${peak.toFixed(3)} zeroSnaps=${zeroAfterMove}`);
  ok("sustained-w-smooth-ramp", maxStep <= 0.12 && dips === 0, `maxStepPerFrame=${maxStep.toFixed(3)} dips=${dips}`);
  ok("sustained-w-on-ribbon", offN === 0, `offPathFrames=${offN}/${n}`);
  globalThis.__sustained = { maxStep, tailMin, peak, v01: at(0.1), v05: at(0.5), v10: at(1.0) };
}

// ── 2) Low-speed steering smoothness (crawl + full-left) ──────────────
{
  drive.enter();
  car.speed = 0.25;
  drive.keys = { forward: false, back: false, left: true, right: false, boost: false };
  let maxJerk = 0, prevRate = 0, first = true;
  let prevYaw = car.yaw;
  for (let f = 0; f < 40; f++) {
    car.speed = Math.max(car.speed, 0.25); // hold crawl
    drive.update(dt);
    let dy = car.yaw - prevYaw;
    while (dy > Math.PI) dy -= 2 * Math.PI;
    while (dy < -Math.PI) dy += 2 * Math.PI;
    const rate = dy / dt;
    if (!first) maxJerk = Math.max(maxJerk, Math.abs(rate - prevRate));
    first = false;
    prevRate = rate; prevYaw = car.yaw;
  }
  // yaw-rate change per frame (rad/s per frame) — smooth if small
  ok("low-speed-steer-smooth", maxJerk < 0.12, `maxYawRateStep=${maxJerk.toFixed(3)} rad/s/frame`);
  globalThis.__steer = maxJerk;
}

// ── 3) Handoff settle: follow the ribbon (steer to snap yaw like a driver) ─
{
  drive.enter();
  drive.keys = { forward: true, back: false, left: false, right: false, boost: false };
  let maxYStep = 0, maxPitchStep = 0, prevPitch = 0, prevY = car.position.y;
  let crashed = false, visited = new Set(), offN = 0, n = 0;
  let minSpeedAfterStart = 99, started = false;
  let camMinUp = 99, camMaxBack = 0, flatBack = 0; // chase cam on the uphill (logic3: was buried in the deck)
  for (let f = 0; f < 60 * 100; f++) { // logic3 lap ≈ 95u ≈ 75 s at cruise
    const pos = car.position;
    const snap = drive.tracks.querySnap(pos.x, pos.y, pos.z, 1.65, car.yaw);
    // crude driver: steer toward look-ahead on ribbon
    drive.keys.left = drive.keys.right = false;
    if (snap && snap.yaw != null && snap.onTrack) {
      let d = snap.yaw - car.yaw;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      if (Math.abs(d) > Math.PI / 2) { d += d > 0 ? -Math.PI : Math.PI; }
      // lateral error
      const lx = (snap.x ?? pos.x) - pos.x, lz = (snap.z ?? pos.z) - pos.z;
      const right = { x: -Math.cos(car.yaw), z: Math.sin(car.yaw) };
      const latErr = lx * right.x + lz * right.z; // + = snap is to the right
      const cmd = d * 1.6 - latErr * 1.2;
      if (cmd > 0.04) drive.keys.left = true; else if (cmd < -0.04) drive.keys.right = true;
    }
    drive.update(dt);
    if (drive._crashPhase || car.crashed) { crashed = true; break; }
    const p = car.position;
    const path = drive.tracks._lastPathId;
    if (path) visited.add(path);
    n++;
    if (!snap?.onTrack) offN++;
    if ((path === "foyer_to_climb_a" || path === "landing_hairpin") && car.speed > 1.2 && Math.abs(car._steerInput || 0) < 0.05) {
      const cp = drive.camera.position;
      flatBack = Math.max(flatBack, Math.hypot(cp.x - p.x, cp.z - p.z));
    }
    if (path === "climb_a" && car.speed > 0.8) {
      const cp = drive.camera.position;
      camMinUp = Math.min(camMinUp, cp.y - p.y);
      camMaxBack = Math.max(camMaxBack, Math.hypot(cp.x - p.x, cp.z - p.z));
    }
    maxYStep = Math.max(maxYStep, Math.abs(p.y - prevY));
    prevY = p.y;
    const pitch = car.bodyPivot.rotation.x;
    if (f > 0) maxPitchStep = Math.max(maxPitchStep, Math.abs(pitch - prevPitch));
    prevPitch = pitch;
    if (process.env.LAPDBG && f % 60 === 0) console.log(`  t=${(f/60).toFixed(0)} p=${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)} path=${path} on=${snap?.onTrack?1:0} v=${car.speed.toFixed(2)} yaw=${car.yaw.toFixed(2)} snapYaw=${snap?.yaw?.toFixed?.(2)}`);
    if (car.speed > 0.6) started = true;
    if (started) minSpeedAfterStart = Math.min(minSpeedAfterStart, car.speed);
    if (visited.has("foyer_finish") && Math.hypot(p.x - 1.0, p.z - 11.4) < 0.8 && f > 600) break; // back at S/F
  }
  const all8 = TRACK_PATHS.every((pp) => visited.has(pp.id));
  console.log(`  lap visited=${[...visited].join(",")} offRate=${(offN / Math.max(1, n)).toFixed(3)} minV=${minSpeedAfterStart.toFixed(3)}`);
  ok("lap-no-crash", !crashed, crashed ? `crash at ${car.position.x.toFixed(2)},${car.position.y.toFixed(2)},${car.position.z.toFixed(2)}` : "");
  ok("lap-visits-all-8", all8, `n=${visited.size}`);
  ok("lap-y-settle", maxYStep < 0.05, `maxYStep=${maxYStep.toFixed(4)}`);
  ok("lap-pitch-settle", maxPitchStep < 0.02, `maxPitchStep=${maxPitchStep.toFixed(4)}`);
  ok("lap-holds-speed", minSpeedAfterStart > 0.2, `minV=${minSpeedAfterStart.toFixed(3)}`);
  ok("climb-cam-above-car", camMinUp >= 0.05, `minCamUp=${camMinUp.toFixed(3)}`);
  ok("climb-cam-trail-like-flat", camMaxBack <= flatBack + 0.35, `climbBack=${camMaxBack.toFixed(3)} flatBack=${flatBack.toFixed(3)}`);
}

console.log(fails.length ? `\n${fails.length} FAIL(s): ${fails.join(", ")}` : "\nALL PASS");
process.exit(fails.length ? 1 : 0);
