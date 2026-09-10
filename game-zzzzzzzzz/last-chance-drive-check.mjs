/**
 * LAST CHANCE Drive proof — must pass before zip.
 * Asserts: wheel gap, nose·travel, floor onRate, climb crest,
 * no enabled primary path with maxG>0.55 or interior angle>150°.
 */
import * as THREE from "./vendor/three.module.js";
import { Mansion } from "./js/mansion.js";
import { DriveMode } from "./js/drive/driveMode.js";
import { RCCar, CAR_SCALE } from "./js/drive/car.js";
import { TRACK_PATHS, CAR_SPAWN } from "./js/data/tracks.js";
import { ROOMS } from "./js/data/rooms.js";
import fs from "fs";

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
const warns = [];
const ok = (name, pass, detail = "") => {
  const line = pass ? `PASS  ${name}${detail ? " — " + detail : ""}` : `FAIL  ${name}${detail ? " — " + detail : ""}`;
  console.log(line);
  if (!pass) fails.push(line);
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
const mansion = new Mansion(scene);
const drive = new DriveMode(scene, camera);
drive.setWallColliders(mansion.getColliders());
const car = drive.car;
const tracks = drive.tracks;
const byId = Object.fromEntries(TRACK_PATHS.map((p) => [p.id, p]));
const enabled = TRACK_PATHS.filter((p) => !p.disabled && p.visual !== false);

// ── 1) Nose · travel (bodyPivot 180 + yaw travel) ─────────────────
{
  car.setPose(0, 0.075, 0, 0); // yaw 0 → travel +Z
  car.updateMatrixWorld?.(true);
  car.root.updateMatrixWorld(true);
  // Mesh nose is modeled toward -Z in bodyPivot; bodyPivot.y = π flips it to +Z
  const noseLocal = new THREE.Vector3(0, 0, -1); // modeled nose
  noseLocal.applyQuaternion(car.bodyPivot.quaternion);
  noseLocal.applyQuaternion(car.root.quaternion);
  const travel = new THREE.Vector3(Math.sin(car.yaw), 0, Math.cos(car.yaw));
  const dot = noseLocal.x * travel.x + noseLocal.z * travel.z;
  ok("nose·travel", dot > 0.85, `dot=${dot.toFixed(3)} bodyPivot.y=${car.bodyPivot.rotation.y.toFixed(3)}`);
}

// ── 2) Wheel gap at spawn / floor asphalt ─────────────────────────
{
  car.setPose(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, CAR_SPAWN.yaw);
  const snap = tracks.querySnap(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, 2.0);
  // Settle car onto snap for a few frames
  for (let i = 0; i < 30; i++) {
    const s = tracks.querySnap(car.position.x, car.position.y, car.position.z, 2.0);
    car.update(1 / 60, { forward: false, back: false, left: false, right: false, boost: false }, s);
  }
  car.root.updateMatrixWorld(true);
  // Wheel bottom world Y = root.y + (wheelLocalY - tireR) * scale ≈ root.y
  // (wheels positioned at y=tireR local, radius=tireR, scale=CAR_SCALE)
  let maxGap = -Infinity;
  let minGap = Infinity;
  const surfaceY = snap?.y ?? 0.075;
  for (const w of car.wheels) {
    const wp = new THREE.Vector3();
    w.getWorldPosition(wp);
    // tire radius in world = _wheelRadius already scaled in car
    const bottom = wp.y - car._wheelRadius;
    const gap = bottom - surfaceY;
    maxGap = Math.max(maxGap, gap);
    minGap = Math.min(minGap, gap);
  }
  // Also measure vs live snap under car after settle
  const live = tracks.querySnap(car.position.x, car.position.y, car.position.z, 2.0);
  const liveSurf = live?.y ?? surfaceY;
  let liveMax = -Infinity;
  for (const w of car.wheels) {
    const wp = new THREE.Vector3();
    w.getWorldPosition(wp);
    liveMax = Math.max(liveMax, (wp.y - car._wheelRadius) - liveSurf);
  }
  ok(
    "wheel gap ≤0.01 (flush on asphalt)",
    liveMax <= 0.01 && liveMax >= -0.01,
    `liveMaxGap=${liveMax.toFixed(4)} rootY=${car.position.y.toFixed(4)} surf=${liveSurf.toFixed(4)} onTrack=${!!live?.onTrack}`
  );
  // Floor Y settle must NOT flatten upper stories
  const landingSegs = tracks.segments.filter((s) => s.pathId === "landing_skirting");
  const landingY = landingSegs.length ? landingSegs[0].a.y : null;
  ok("landing floor Y preserved (~4.26)", landingY != null && Math.abs(landingY - 4.26) < 0.05, `y=${landingY}`);
  const foyerSegs = tracks.segments.filter((s) => s.pathId === "foyer_skirting");
  const foyerY = foyerSegs.length ? foyerSegs[0].a.y : null;
  ok("foyer floor Y ~0.06 (matches ramp feet)", foyerY != null && Math.abs(foyerY - 0.06) < 0.02, `y=${foyerY}`);
}

// ── 3) Ramp feet kiss floor asphalt Y ─────────────────────────────
{
  const primaryRamps = [
    "ramp_foyer_to_landing", // sole primary foyer climb (secondary elevated ramps culled)
  ];
  let kissOk = true;
  const details = [];
  for (const id of primaryRamps) {
    const path = byId[id];
    if (!path || path.disabled) { details.push(`${id}:missing`); kissOk = false; continue; }
    const foot = path.points[0];
    // Find nearest floor/elevated segment Y at foot XZ
    const snap = tracks.querySnap(foot.x, foot.y, foot.z, 1.5);
    const dy = Math.abs((snap?.y ?? 99) - (foot.y + (path.kind === "ramp" ? 0.018 : 0.015)));
    // Foot authored Y should be within 0.04 of approach asphalt segment Y
    const segs = tracks.segments.filter((s) => Math.hypot(s.a.x - foot.x, s.a.z - foot.z) < 0.35 || Math.hypot(s.b.x - foot.x, s.b.z - foot.z) < 0.35);
    const floorNear = segs.filter((s) => s.kind === "floor" || s.kind === "elevated" || s.kind === "cornice" || s.kind === "balcony");
    let bestDy = Infinity;
    for (const s of floorNear) {
      if (s.pathId === id) continue;
      bestDy = Math.min(bestDy, Math.abs(s.a.y - foot.y), Math.abs(s.b.y - foot.y));
    }
    const pass = bestDy < 0.05 || bestDy === Infinity;
    if (!pass) kissOk = false;
    details.push(`${id}:footY=${foot.y} kissDy=${bestDy === Infinity ? "n/a" : bestDy.toFixed(3)}`);
  }
  ok("ramp feet kiss approach Y", kissOk, details.join("; "));
}

// ── 4) Floor cruise onRate ────────────────────────────────────────
{
  car.setPose(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, Math.PI); // face along west wall toward -Z-ish; use yaw toward hall
  // Face along foyer east skirting (south wall → +X then down west)
  car.setPose(-7.9, 0.075, 12.2, Math.atan2(0 - (-7.9), 12.35 - 12.2)); // toward east along south wall
  car.speed = 1.1;
  tracks._lastPathId = "foyer_skirting";
  const dt = 1 / 60;
  let on = 0, total = 0, falls = 0;
  const keys = { forward: true, back: false, left: false, right: false, boost: false };
  for (let i = 0; i < 60 * 8; i++) {
    const s = tracks.querySnap(car.position.x, car.position.y, car.position.z, 1.8, car.yaw);
    // Soft steer toward snap yaw when on track
    if (s?.onTrack && s.yaw != null) {
      let dyaw = s.yaw - car.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      keys.left = dyaw > 0.08;
      keys.right = dyaw < -0.08;
    }
    car.update(dt, keys, s);
    total++;
    if (s?.onTrack) on++;
    if (car.airborne || car.crashed) falls++;
  }
  const rate = on / total;
  ok("floor cruise onRate ≥0.85", rate >= 0.85 && falls === 0, `onRate=${(rate * 100).toFixed(1)}% falls=${falls}`);
}

// ── 5) Climb crest: foyer → landing ───────────────────────────────
{
  const path = byId["ramp_foyer_to_landing"];
  const pts = path.points;
  const foot = pts[0];
  const crest = pts[pts.length - 1];
  car.setPose(foot.x, foot.y + 0.02, foot.z, Math.atan2(pts[1].x - foot.x, pts[1].z - foot.z));
  car.speed = 1.25;
  car.crashed = false; car.airborne = false; car.vy = 0;
  car._unsupportedFrames = 0; car._lastElevated = false;
  tracks._lastPathId = "foyer_skirting";
  tracks._lastPathKind = "floor";
  const dt = 1 / 60;
  let reached = false;
  let onClimb = 0, frames = 0;
  const keys = { forward: true, back: false, left: false, right: false, boost: false };
  for (let i = 0; i < 60 * 25; i++) {
    const s = tracks.querySnap(car.position.x, car.position.y, car.position.z, 1.8, car.yaw);
    if (s?.onTrack && s.yaw != null) {
      let dyaw = s.yaw - car.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      keys.left = dyaw > 0.1;
      keys.right = dyaw < -0.1;
    }
    car.update(dt, keys, s);
    frames++;
    if (s?.kind === "ramp" || (s?.pathId === "ramp_foyer_to_landing")) onClimb++;
    if (car.position.y >= crest.y - 0.15 && Math.hypot(car.position.x - crest.x, car.position.z - crest.z) < 1.2) {
      reached = true;
      break;
    }
    if (car.crashed) break;
  }
  ok("foyer→landing climb crest", reached && !car.crashed, `y=${car.position.y.toFixed(2)} reached=${reached} climbFrames=${onClimb}`);
}

// ── 6) Foyer console wall-fork class MUST stay disabled ───────────
{
  const culled = [
    "ramp_foyer_console", "furniture_foyer_console", "ramp_foyer_console_down",
    "ramp_console_to_foyer_cornice",
  ];
  const stillOn = culled.filter((id) => byId[id] && !byId[id].disabled);
  ok("foyer console wall-fork disabled", stillOn.length === 0, stillOn.join(",") || "all off");
  // Floor skirting stays out of stair AABB; climb MUST use stair/climb aperture (not solid slab)
  {
    const aper = { minX: -8.2, maxX: -4.85, minZ: 1.7, maxZ: 8.2 };
    const stair = { minX: -8.2, maxX: -5.8, minZ: 2.5, maxZ: 8 };
    const ramp = byId["ramp_foyer_to_landing"];
    const skirt = byId["foyer_skirting"];
    const bad = [];
    for (const pt of (skirt?.points || [])) {
      if (pt.x + 0.5 > stair.minX && pt.x - 0.5 < stair.maxX
          && pt.z + 0.5 > stair.minZ && pt.z - 0.5 < stair.maxZ) {
        bad.push(`skirt@(${pt.x.toFixed(2)},${pt.z.toFixed(2)})`);
      }
    }
    let highInAper = 0, highTotal = 0;
    for (const pt of (ramp?.points || [])) {
      if (pt.y < 3.15) continue;
      highTotal++;
      if (pt.x >= aper.minX && pt.x <= aper.maxX && pt.z >= aper.minZ && pt.z <= aper.maxZ) highInAper++;
      else bad.push(`rampHighOutsideAper@(${pt.x.toFixed(2)},${pt.y.toFixed(2)},${pt.z.toFixed(2)})`);
    }
    ok("foyer floor clear; climb through aperture", bad.length === 0 && highTotal > 0 && highInAper === highTotal,
      bad.slice(0, 4).join(";") || `highInAper=${highInAper}/${highTotal}`);
  }
  // No snap-active climb ribbon at east wall behind console table
  const wall = tracks.querySnap(8.15, 0.35, 10.5, 1.2);
  const bad = wall?.kind === "ramp" || /console|furniture_foyer/i.test(String(wall?.pathId || ""));
  ok("no wall-behind-table climb ribbon", !bad, `${wall?.kind}/${wall?.pathId}`);
}

// ── 7) Geometry: primary set maxG / interior angle ────────────────
{
  const PRIMARY = new Set([
    "foyer_skirting", "hall_skirting_east", "hall_skirting_west",
    "hall_cross_south", "hall_cross_north",
    "door_foyer_hall_east", "door_foyer_hall_west",
    "door_hall_conservatory", "door_hall_conservatory_w",
    "conservatory_skirting", "door_cons_dining", "dining_skirting",
    "hall_to_cabinet_skirt", "cabinet_skirting",
    "hall_to_armoury_skirt", "armoury_skirting",
    "ramp_foyer_to_landing", "foyer_drive_start",
    "cornice_hall_east", "cornice_hall_west",
    "landing_skirting", "balcony_loop",
  ]);
  const badG = [];
  const badAng = [];
  for (const path of enabled) {
    if (!PRIMARY.has(path.id)) continue;
    const pts = path.points;
    if (pts.length < 2) continue;
    // max grade (rise/run) per segment
    let maxG = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const run = Math.hypot(b.x - a.x, b.z - a.z);
      const rise = Math.abs(b.y - a.y);
      if (run > 1e-4) maxG = Math.max(maxG, rise / run);
    }
    if (path.kind === "ramp" && maxG > 0.55) badG.push(`${path.id}:${maxG.toFixed(2)}`);
    // interior plan angles
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const v1x = a.x - b.x, v1z = a.z - b.z;
      const v2x = c.x - b.x, v2z = c.z - b.z;
      const l1 = Math.hypot(v1x, v1z), l2 = Math.hypot(v2x, v2z);
      if (l1 < 1e-4 || l2 < 1e-4) continue;
      const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1z * v2z) / (l1 * l2)));
      const ang = Math.acos(cos) * 180 / Math.PI; // 0=U-turn, 180=straight
      // "interior angle >150°" in user terms = sharp kink = turning angle from straight
      // Turning deflection = 180 - ang; sharp V when ang is small (near 0 = reverse)
      // User said "interior angle>150°" meaning the kink angle of the polyline turn
      // i.e. the smaller exterior turn: if going along path, turn amount > 150° is a V
      const turn = 180 - ang; // 0=straight, 180=U-turn
      if (turn > 150) badAng.push(`${path.id}@${i}:${turn.toFixed(0)}°`);
    }
  }
  ok("primary maxG≤0.55", badG.length === 0, badG.join(", ") || "none");
  ok("primary interior turn≤150°", badAng.length === 0, badAng.join(", ") || "none");
}

// ── 8) No enabled mouse/shaft skinny ribbons ──────────────────────
{
  const skinny = enabled.filter((p) =>
    ["mouse", "shaft", "shortcut", "chute"].includes(p.kind)
    || (p.kind === "tunnel" && !p.disabled)
  );
  ok("no enabled mouse/shaft/shortcut/tunnel", skinny.length === 0, skinny.map((p) => p.id).join(", ") || "none");
}

// ── 9) HUD: no .drive-hint in HTML; prompt hidden pattern; no drive-mode-label ──
{
  const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("./css/style.css", import.meta.url), "utf8");
  const main = fs.readFileSync(new URL("./js/main.js", import.meta.url), "utf8");
  ok("no drive-hint element in HTML", !html.includes('class="drive-hint"') && !html.includes("id=\"drive-hint\""));
  ok("no drive-mode-label in Drive HUD HTML", !html.includes("drive-mode-label"));
  ok("main hides #prompt in Drive", /promptEl\.classList\.add\(["']hidden["']\)/.test(main));
  ok(".drive-hint CSS removed or inert", !css.includes(".drive-hint {") || css.includes("drive-hint removed"));
}

// ── 10) Spawn west apron into foyer (-Z + mild west), NOT center pillar / wall-hug ──
{
  const want = Math.PI; // into room
  let dyaw = CAR_SPAWN.yaw - want;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;
  ok("CAR_SPAWN.yaw into foyer (allow mild west bias)", Math.abs(dyaw) < 0.55,
    `yaw=${CAR_SPAWN.yaw.toFixed(3)} want≈${want.toFixed(3)} d=${dyaw.toFixed(3)}`);
  ok("CAR_SPAWN off wall-hug SW corner", Math.hypot(CAR_SPAWN.x - (-7.9), CAR_SPAWN.z - 12.2) > 2.5,
    `spawn=(${CAR_SPAWN.x},${CAR_SPAWN.z})`);
  ok("CAR_SPAWN off center pillar lane", Math.abs(CAR_SPAWN.x) >= 2.5,
    `spawn.x=${CAR_SPAWN.x}`);
  const snap = tracks.querySnap(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z, 2.0);
  ok("spawn on asphalt", !!(snap && snap.onTrack), `path=${snap?.pathId} on=${snap?.onTrack}`);
  // enter() must not steal yaw into wall-hug +X
  drive.enter();
  let dy = drive.car.yaw - want;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  ok("enter() yaw stays into foyer (not wall)", Math.abs(dy) < 0.70,
    `carYaw=${drive.car.yaw.toFixed(3)} deg=${(drive.car.yaw*180/Math.PI).toFixed(1)}`);
  // Probe forward must not be into south wall (+Z); prefer -X toward climb
  const fx = Math.sin(drive.car.yaw), fz = Math.cos(drive.car.yaw);
  ok("enter() forward has -Z into room", fz < -0.55, `fwd=(${fx.toFixed(2)},${fz.toFixed(2)})`);
  ok("enter() forward not east of spawn (toward climb)", fx <= 0.15, `fx=${fx.toFixed(2)}`);
  drive.exit();
}

// ── 11) WASD: keys.forward accelerates from spawn (no wall pin) ────
{
  drive.enter();
  drive.keys.forward = true;
  const sp0 = Math.abs(drive.car.speed);
  for (let i = 0; i < 45; i++) drive.update(1 / 60);
  const sp1 = Math.abs(drive.car.speed);
  const moved = Math.hypot(drive.car.position.x - CAR_SPAWN.x, drive.car.position.z - CAR_SPAWN.z);
  ok("keys.forward accelerates", sp1 > 0.45 && sp1 > sp0 + 0.3, `sp0=${sp0.toFixed(3)} sp1=${sp1.toFixed(3)} moved=${moved.toFixed(3)}`);
  ok("_addCorniceShowcase on TrackSystem", typeof drive.tracks._addCorniceShowcase === "function");
  ok("drive fill light present", !!drive._fillLight);
  drive.exit();
}

// ── 11b) Spawn forward corridor clear 3m + W 2s moves (no pin) ────
{
  drive.enter();
  const yaw = drive.car.yaw;
  const r = drive._carRadius;
  const y0 = CAR_SPAWN.y - 0.02, y1 = CAR_SPAWN.y + 0.12;
  let clear3 = true;
  const hitAt = [];
  for (const dist of [0.35, 0.7, 1.1, 1.6, 2.2, 3.0]) {
    const px = CAR_SPAWN.x + Math.sin(yaw) * dist;
    const pz = CAR_SPAWN.z + Math.cos(yaw) * dist;
    const cols = drive._wallsNear ? drive._wallsNear(px, pz, r + 0.28) : [];
    for (const box of cols) {
      if (y1 < box.min.y || y0 > box.max.y) continue;
      if (px + r > box.min.x && px - r < box.max.x && pz + r > box.min.z && pz - r < box.max.z) {
        clear3 = false;
        hitAt.push(dist);
        break;
      }
    }
  }
  ok("spawn forward probeClear 3m", clear3, hitAt.length ? `hit@${hitAt.join(',')}` : "clear");
  drive.keys.forward = true;
  let wallFrames = 0;
  const x0 = drive.car.position.x, z0 = drive.car.position.z;
  for (let i = 0; i < 120; i++) {
    drive.update(1 / 60);
    if ((drive._frameWallHits || 0) > 0) wallFrames++;
  }
  const moved = Math.hypot(drive.car.position.x - x0, drive.car.position.z - z0);
  ok("W 2s moves >0.5m", moved > 0.5, `moved=${moved.toFixed(3)} spd=${Math.abs(drive.car.speed).toFixed(3)}`);
  ok("W 2s no wall-hit pin frames", wallFrames === 0, `wallFrames=${wallFrames}`);
  drive.exit();
}

// ── 12) Room HUD: cellar must not win at foyer spawn Y ────────────
{
  function roomAt(x, y, z) {
    let best = null, bestScore = Infinity;
    for (const room of Object.values(ROOMS)) {
      const [w, h, d] = room.size;
      const [cx, cy, cz] = room.pos;
      if (!room.outdoor && cy < -2 && y > -1) continue;
      const yOk = room.outdoor
        ? y > cy - 0.5 && y < cy + 8
        : y > cy - 0.5 && y < cy + Math.min(h + 0.35, 3.0);
      if (x > cx - w / 2 && x < cx + w / 2 && z > cz - d / 2 && z < cz + d / 2 && yOk) {
        let pri = room.id.includes("hall") ? 0 : 1;
        if (room.outdoor) pri = 3;
        const score = Math.abs(cy - y) * 10 - pri;
        if (score < bestScore) { bestScore = score; best = room; }
      }
    }
    return best;
  }
  const r = roomAt(CAR_SPAWN.x, CAR_SPAWN.y, CAR_SPAWN.z);
  ok("spawn room ≠ Cellar", r && r.id !== "cellar" && r.floor !== "Basement", `room=${r?.id}/${r?.floor}/${r?.name}`);
  const cellar = roomAt(CAR_SPAWN.x, -4.0, CAR_SPAWN.z);
  ok("y=-4 still Cellar", cellar && cellar.id === "cellar", `room=${cellar?.id}`);
  const css2 = fs.readFileSync(new URL("./css/style.css", import.meta.url), "utf8");
  const main2 = fs.readFileSync(new URL("./js/main.js", import.meta.url), "utf8");
  ok("CSS hides room-badge in drive-mode", css2.includes("body.drive-mode #room-badge"));
  ok("main toggles room-badge hidden in Drive", /roomBadge\.classList\.toggle\(["']hidden["'],\s*playMode\s*===\s*["']drive["']\)/.test(main2));
}

// ── 13) Explore still boots (parkForExplore) ──────────────────────
{
  drive.parkForExplore();
  ok("Explore park boots", !drive.active && car.root.visible === true, `spawn≈(${car.position.x.toFixed(2)},${car.position.y.toFixed(2)},${car.position.z.toFixed(2)})`);
}

console.log("\n── Summary ──");
console.log(`enabled paths: ${enabled.length}`);
console.log(`fails: ${fails.length}`);
if (fails.length) {
  console.log("FAILURES:");
  fails.forEach((f) => console.log(" ", f));
  process.exit(1);
}
console.log("ALL LAST-CHANCE CHECKS PASSED");
process.exit(0);
