/**
 * logic33 (Ben 11:42–11:46 AM Nov 4): SKY NEEDLE + NIGHT VILLAGE + the foyer painting.
 *  · Sky Needle — dark-2100s observation tower behind/right of the Lab Garage (as seen from the yard): gunmetal/graphite
 *    core, three flared legs, saucer pod with cyan rings + glowing observation band, needle spire with a blinking aviation
 *    light, base uplight; glass elevator shaft + cab (driven by DriveMode via globalThis.__TOWER_LIFT), landing doors,
 *    catwalk ring lights, gutters/downpipes/fins beside the facade road, beacons, the cat behind its porthole hatch.
 *  · Village — painted-dark old-world backdrop EAST beyond the yard hedge (not drivable): Wessex stone/timber/thatch
 *    cottages, a church tower and a lit pub, Portland West-Hills craftsman + Tudor homes on winding wooded slopes,
 *    Gatlinburg-dense mixed forest, golden oak-studded California hills, layered misty blue Appalachian ridges, moonlit
 *    rims, valley mist, amber windows, lane lamps, stars.
 *  · A framed painting of that village on the foyer north wall.
 *  · WebAudio: tower hum + wind chimes near the top, a meow near the cat.
 * Pure visuals: no colliders here (the tower's Drive colliders live in data/tower.js → towerSolids()).
 */
import * as THREE from "three";
import { TOWER } from "./data/tower.js?v=logic36";

const CYAN = 0x22e6ff, AMBER = 0xffb347;
const rand = (() => { let s = 1337; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Skyline33 {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group(); this.root.name = "skyline33"; scene.add(this.root);
    this._t = 0;
    this._buildTower();
    this._buildVillage();
    this._buildPainting();
    this._audio = null;
    const kick = () => { this._initAudio(); };
    if (typeof window !== "undefined") { window.addEventListener("pointerdown", kick, { once: true }); window.addEventListener("keydown", kick, { once: true }); }
  }

  /* ------------------------------------------------------------------ TOWER */
  _buildTower() {
    const T = TOWER, g = new THREE.Group(); g.name = "sky_needle"; g.position.set(T.x, 0, T.z); this.root.add(g); this.tower = g;
    const gun = new THREE.MeshStandardMaterial({ color: 0x3b4048, metalness: 0.8, roughness: 0.38 });
    const graphite = new THREE.MeshStandardMaterial({ color: 0x23262c, metalness: 0.65, roughness: 0.5 });
    const neon = new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false });
    const neonSoft = new THREE.MeshBasicMaterial({ color: 0x6ff3ff, transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0d2a36, metalness: 0.3, roughness: 0.15, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
    this._mats = { gun, graphite, neon, glass };
    // legs: tapered boxes from the feet (r 6.5) to the core (r 2.9 @ y 9), slight outward flare at the foot
    for (const a of T.legAngles) {
      const fx = Math.cos(a) * T.legR, fz = Math.sin(a) * T.legR, tx = Math.cos(a) * 2.9, tz = Math.sin(a) * 2.9;
      const L = Math.hypot(fx - tx, T.legMeetY, fz - tz);
      const geo = new THREE.CylinderGeometry(0.3, 0.42, L, 6, 1); // top thinner
      const m = new THREE.Mesh(geo, gun); m.position.set((fx + tx) / 2, T.legMeetY / 2, (fz + tz) / 2);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(tx - fx, T.legMeetY, tz - fz).normalize()); g.add(m);
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, L * 0.94, 0.05), neon); st.position.copy(m.position); st.quaternion.copy(m.quaternion);
      st.translateX(0.0); st.position.x += Math.cos(a) * 0.36; st.position.z += Math.sin(a) * 0.36; g.add(st);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, 0.22, 8), graphite); foot.position.set(fx, 0.11, fz); g.add(foot);
      // base uplight: soft additive cone above each foot
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 1.3, 7, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x3fd8ff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      cone.position.set(fx * 0.92, 3.6, fz * 0.92); cone.rotation.x = Math.PI; g.add(cone);
    }
    // ground: cyan base ring + glowing drive-on pad in the cab (tops at +6 mm/+8 mm → never coplanar with the lawn)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.035, 6, 48), neon); ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; g.add(ring);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.012, 32), new THREE.MeshBasicMaterial({ color: 0x29f0ff, toneMapped: false })); pad.position.y = 0.002; g.add(pad); this._pad = pad;
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.25, 0.02, 32), graphite); apron.position.y = -0.006; g.add(apron);
    // core: lower lattice (y 9–12.3, open: the core door + inner climb), glass tube + 12 fins above, lit gutter bands
    const coreRing = (y, r = 2.85) => { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 6, 40), gun); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); };
    coreRing(9.0, 2.95); coreRing(12.3); coreRing(15.4); coreRing(17.0); coreRing(28.3, 2.7);
    for (const [y0, y1] of [[12.3, 15.4], [17.0, 28.4]]) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, y1 - y0, 32, 1, true), glass); tube.position.y = (y0 + y1) / 2; g.add(tube);
      for (let k = 0; k < 12; k++) { const a = (15 + 30 * k) * Math.PI / 180; const f = new THREE.Mesh(new THREE.BoxGeometry(0.1, y1 - y0, 0.26), graphite);
        f.position.set(Math.cos(a) * 2.72, (y0 + y1) / 2, Math.sin(a) * 2.72); f.rotation.y = -a; g.add(f); }
    }
    for (let k = 0; k < 3; k++) { const a = (90 + 120 * k) * Math.PI / 180; // lower lattice posts
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.3, 0.16), gun); p.position.set(Math.cos(a) * 2.85, 10.65, Math.sin(a) * 2.85); g.add(p); }
    // downpipes beside the facade road + gutter lips
    for (let k = 0; k < 6; k++) { const a = (k * 60) * Math.PI / 180; const d = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 16.1, 6), graphite); d.position.set(Math.cos(a) * 2.9, 20.35, Math.sin(a) * 2.9); g.add(d); }
    for (const y of [15.35, 23.5, 27.6]) { const gt = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.05, 4, 40), neonSoft); gt.rotation.x = Math.PI / 2; gt.position.y = y; g.add(gt); }
    // core door frame (inner climb mouth, Catwalk 1) and duct window (exit onto the facade road)
    const frame = (a, y, r, w = 1.2, h = 0.75) => { const f = new THREE.Group(); f.position.set(Math.cos(a) * r, y, Math.sin(a) * r); f.rotation.y = -a + Math.PI / 2;
      for (const [sx, sy, px, py] of [[0.06, h, -w / 2, h / 2], [0.06, h, w / 2, h / 2], [w + 0.06, 0.06, 0, h]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.06), neon); b.position.set(px, py, 0); f.add(b); } g.add(f); };
    frame(-150 * Math.PI / 180, 9.0, 2.95); frame(-520 * Math.PI / 180, 11.45, 2.75, 1.1, 0.7);
    // catwalk ring underglow
    for (const y of T.c) { const u = new THREE.Mesh(new THREE.TorusGeometry(T.ringR, 0.03, 4, 64), neon); u.rotation.x = Math.PI / 2; u.position.y = y - 0.24; g.add(u); }
    // elevator shaft (glass) + cab + landing doors
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, 32.5, 24, 1, true), glass); shaft.position.y = 16.25; g.add(shaft);
    for (let y = 2; y < 32; y += 2.5) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.02, 4, 24), neonSoft); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); }
    const cab = new THREE.Group(); cab.name = "tower_cab";
    { const floor = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.05, 24), graphite); floor.position.y = -0.03; cab.add(floor);
      const lit = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.02, 4, 32), neon); lit.rotation.x = Math.PI / 2; lit.position.y = 0.006; cab.add(lit);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.06, 24), gun); roof.position.y = 1.0; cab.add(roof);
      const rl = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.025, 4, 32), neon); rl.rotation.x = Math.PI / 2; rl.position.y = 0.96; cab.add(rl); }
    g.add(cab); this._cab = cab;
    this._doors = [];
    for (const [i, y, face] of [[0, 0, 1], [1, T.c[1], 1], [2, T.deckY, -1]]) { // face +1 = south (+z), −1 = north
      const pair = []; for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.95, 0.03), gun); d.position.set(s * 0.21, y + 0.49, face * 0.87); g.add(d);
        const e = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.95, 0.035), neon); e.position.set(-s * 0.2, 0, 0); d.add(e); pair.push({ m: d, s }); }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.06), neon); lintel.position.set(0, y + 1.0, face * 0.88); g.add(lintel);
      this._doors.push(pair); }
    // saucer: underside lathe in three radial bands, the middle band cut by the road slot
    const S = T.slot, under = (r) => T.saucerBottom + (r / T.saucerR) ** 2 * 1.05;
    const band = (r0, r1, phiStart = 0, phiLen = Math.PI * 2) => { const pts = [], n = 8;
      for (let i = 0; i <= n; i++) { const r = r0 + (r1 - r0) * i / n; pts.push(new THREE.Vector2(Math.max(r, 0.001), under(r))); }
      pts.push(new THREE.Vector2(r1, T.deckY - 0.02)); pts.push(new THREE.Vector2(Math.max(r0, 0.001), T.deckY - 0.02)); pts.push(pts[0].clone());
      const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 64, phiStart, phiLen), graphite); g.add(m); return m; };
    const phi = (a) => Math.PI / 2 - a; // lathe phi for my angle a (x = cos a, z = sin a)
    band(0.85, S.r0); band(S.r1, T.saucerR - 0.25); band(S.r0, S.r1, phi(S.a0) + 0, -(Math.PI * 2 - (S.a1 - S.a0))); // middle band: everything but the slot
    // deck top (y 30): discs/annuli + slot cut (RingGeometry thetas in its own XY → rotate)
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x2a2e35, metalness: 0.55, roughness: 0.55 });
    const ringTop = (r0, r1, t0 = 0, tl = Math.PI * 2) => { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 72, 1, t0, tl), deckMat); m.rotation.x = -Math.PI / 2; m.position.y = T.deckY; g.add(m); return m; };
    // RingGeometry θ after rotation.x=−90°: (x, z) = (cos θ, −sin θ) → my angle a = −θ
    ringTop(0.86, S.r0); ringTop(S.r1, T.deckR); ringTop(S.r0, S.r1, -S.a0, -(Math.PI * 2 - (S.a1 - S.a0)));
    // rim: observation band (window strip texture), cyan rings, outer lip
    const bandTex = (() => { const c = document.createElement("canvas"); c.width = 512; c.height = 32; const x = c.getContext("2d"); x.fillStyle = "#0b1a22"; x.fillRect(0, 0, 512, 32);
      for (let i = 0; i < 64; i++) { x.fillStyle = i % 9 === 0 ? "#ffd27a" : "#7ff6ff"; x.globalAlpha = 0.65 + 0.35 * ((i * 37) % 7) / 7; x.fillRect(i * 8 + 1, 6, 6, 20); } const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1); return t; })();
    const obs = new THREE.Mesh(new THREE.CylinderGeometry(T.saucerR - 0.02, T.saucerR - 0.12, 0.42, 72, 1, true), new THREE.MeshBasicMaterial({ map: bandTex, toneMapped: false })); obs.position.y = 29.42; g.add(obs);
    for (const [y, r] of [[29.12, T.saucerR - 0.18], [29.68, T.saucerR + 0.02], [28.86, 5.0]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 6, 96), neon); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); }
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(T.saucerR, T.saucerR, 0.12, 72, 1, true), gun); lip.position.y = 29.9; g.add(lip);
    // deck rail posts (collider = towerSolids rim rail) + top rail
    for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2, p = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.03), gun); p.position.set(Math.cos(a) * (T.deckR - 0.05), T.deckY + 0.08, Math.sin(a) * (T.deckR - 0.05)); g.add(p); }
    { const t = new THREE.Mesh(new THREE.TorusGeometry(T.deckR - 0.05, 0.015, 4, 96), neon); t.rotation.x = Math.PI / 2; t.position.y = T.deckY + 0.16; g.add(t); }
    // slot lips: thin cyan arcs on the deck rails along the slot
    for (const r of [S.r0 - 0.03, S.r1 + 0.03]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.015, 4, 48, S.a1 - (S.aOpen ?? S.a0)), neon); t.rotation.x = Math.PI / 2; t.rotation.z = -(S.a1); t.position.y = T.deckY + 0.07; g.add(t); }
    // halo cap above the deck + needle spire + aviation light
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.0, 0.5, 40), graphite); cap.position.y = 32.75; g.add(cap);
    { const t = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.04, 6, 64), neon); t.rotation.x = Math.PI / 2; t.position.y = 32.98; g.add(t); }
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.32, T.spireTop - 33, 8), gun); spire.position.y = (T.spireTop + 33) / 2; g.add(spire);
    for (const y of [36, 39.5, 43]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.32 - (y - 33) * 0.02, 0.025, 4, 16), neon); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); }
    this._avia = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false })); this._avia.position.y = T.spireTop + 0.1; g.add(this._avia);
    this._aviaGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff3030, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); this._aviaGlow.scale.set(3, 3, 1); this._aviaGlow.position.y = T.spireTop + 0.1; g.add(this._aviaGlow);
    // beacons (blinking, two phases): leg feet, catwalks, saucer rim
    const bpos = [[], []];
    T.legAngles.forEach((a, i) => bpos[i % 2].push([Math.cos(a) * T.legR, 0.35, Math.sin(a) * T.legR]));
    T.c.forEach((y, j) => { for (let k = 0; k < 6; k++) { const a = (k * 60 + j * 20) * Math.PI / 180; bpos[k % 2].push([Math.cos(a) * (T.ringR + 0.46), y + 0.14, Math.sin(a) * (T.ringR + 0.46)]); } });
    for (let k = 0; k < 10; k++) { const a = k * 36 * Math.PI / 180; bpos[k % 2].push([Math.cos(a) * T.saucerR, 29.7, Math.sin(a) * T.saucerR]); }
    this._beacons = bpos.map((P, i) => { const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: i ? 0xff3b6b : CYAN, toneMapped: false }), P.length);
      const M = new THREE.Matrix4(); P.forEach((p, k) => { M.makeTranslation(p[0], p[1], p[2]); im.setMatrixAt(k, M); }); g.add(im); return im; });
    this._buildCat(g);
  }

  _buildCat(g) {
    const T = TOWER, a = T.cat.a, r = 3.45, y = T.cat.y;
    const pod = new THREE.Group(); pod.name = "cat_pod"; pod.position.set(Math.cos(a) * r, y, Math.sin(a) * r); pod.rotation.y = -a + Math.PI / 2; g.add(pod); // local +z = radially outward
    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.8), this._mats.graphite); shell.position.set(0, 0.45, -0.02); pod.add(shell);
    // the hatch (outer face, z = +0.39): porthole ring + glass + warm interior seen through it
    const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.03), this._mats.gun); hatch.position.set(0, 0.42, 0.395); pod.add(hatch);
    const port = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.03, 8, 32), this._mats.neon); port.position.set(0, 0.5, 0.415); pod.add(port);
    const room = new THREE.Mesh(new THREE.CircleGeometry(0.18, 32), new THREE.MeshBasicMaterial({ color: 0x5a3a1e, toneMapped: false })); room.position.set(0, 0.5, 0.412); pod.add(room);
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false })); lamp.position.set(0.09, 0.6, 0.413); pod.add(lamp);
    // the cat (sits right behind the glass: drawn in front of the warm backdrop, inside the porthole)
    const cat = new THREE.Group(); cat.position.set(-0.02, 0.36, 0.42); pod.add(cat); this._cat = cat;
    const fur = new THREE.MeshBasicMaterial({ color: 0x1c1c22 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), fur); body.scale.set(1, 1.15, 0.7); body.position.y = 0.06; cat.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), fur); head.position.y = 0.18; cat.add(head); this._catHead = head;
    for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.05, 4), fur); ear.position.set(s * 0.032, 0.235, 0); ear.rotation.z = -s * 0.25; cat.add(ear); }
    this._catEyes = []; for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0x9dff6a, toneMapped: false })); e.position.set(s * 0.021, 0.19, 0.045); e.scale.z = 0.5; cat.add(e); this._catEyes.push(e); }
    const tail = new THREE.Group(); tail.position.set(0.05, 0.02, 0); cat.add(tail); this._catTail = [];
    let parent = tail; for (let i = 0; i < 4; i++) { const seg = new THREE.Group(); seg.position.y = i ? 0.035 : 0; parent.add(seg); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.04, 6), fur); m.position.y = 0.018; seg.add(m); this._catTail.push(seg); parent = seg; }
    tail.rotation.z = -1.0;
    this._catWorld = new THREE.Vector3(); pod.updateMatrixWorld(true); pod.localToWorld(this._catWorld.set(0, 0.4, 0.6));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.07), new THREE.MeshBasicMaterial({ map: textTex("CAT · DO NOT OPEN", "#7ff6ff"), transparent: true, toneMapped: false })); sign.position.set(0, 0.84, 0.413); pod.add(sign);
  }

  /* ---------------------------------------------------------------- VILLAGE */
  _buildVillage() {
    // the backdrop lives in its OWN scene, drawn first with its own far camera (Drive trims the main camera's far plane to
    // 110 m for depth precision) — then the depth buffer is cleared and the estate is drawn over it (see renderBackdrop).
    this.backScene = new THREE.Scene(); this.backScene.background = new THREE.Color(0x0b1224);
    this.backCam = new THREE.PerspectiveCamera(68, 1, 2, 900);
    const V = new THREE.Group(); V.name = "village33"; this.backScene.add(V); this.village = V;
    { this.backScene.add(new THREE.HemisphereLight(0xc5d8f0, 0x1a2a18, 0.6)); const m1 = new THREE.DirectionalLight(0xd0e4ff, 0.65); m1.position.set(-18, 35, 12); this.backScene.add(m1);
      const m2 = new THREE.DirectionalLight(0xb8c8ff, 0.35); m2.position.set(170, 120, 95); this.backScene.add(m2); } // same moonlight as the estate + a rim from the moon
    const fogC = new THREE.Color(0x1a1830), eye = new THREE.Vector3(36, 2, 6);
    const haze = (c, x, y, z, k = 1) => { const d = Math.hypot(x - eye.x, y - eye.y, z - eye.z); return c.clone().lerp(fogC, Math.min(0.72, Math.max(0, (d - 40) / 230) * k)); };
    // terrain heightfield: valley floor beyond the hedge → wooded slopes → golden oak hills (tops 18–26)
    const H = (x, z) => { const az = Math.abs(z);
      const base = -0.6 - 0.8 * sstep(70, 82, x) + 3.5 * sstep(82, 100, x) + 13 * sstep(94, 138, x)
        + 6 * sstep(135, 168, x) * (0.72 + 0.28 * Math.sin(z * 0.045 + 1.3) * Math.cos(z * 0.021 + 0.4)) + 6 * sstep(70, 125, az) * sstep(80, 100, x);
      return base + 1.6 * Math.sin(x * 0.083 + z * 0.061) * Math.cos(z * 0.047 - x * 0.02) * sstep(88, 120, x); };
    this._H = H;
    const W = 110, D = 260, geo = new THREE.PlaneGeometry(W, D, 66, 130); geo.rotateX(-Math.PI / 2); geo.translate(70 + W / 2, 0, 0);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), cWood = new THREE.Color(0x0f1a14), cGold = new THREE.Color(0x8c7640), cRim = new THREE.Color(0xb39c62);
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), y = H(x, z); pos.setY(i, y);
      const gold = sstep(11, 17, y + 3 * Math.sin(z * 0.07)), c = cWood.clone().lerp(cGold, gold); if (y > 21) c.lerp(cRim, sstep(21, 25, y) * 0.6);
      const h = haze(c, x, y, z); col[i * 3] = h.r; col[i * 3 + 1] = h.g; col[i * 3 + 2] = h.b; }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    const ter = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, fog: false })); ter.name = "village_terrain"; V.add(ter);
    // distant ridges: layered misty blue Appalachian silhouettes (vertex-colour moonlit rims) + a low ring N/S/W
    const ridge = (x0, top, base, col0, rim, seed, span = 420, along = "z", c0 = 0) => { const n = 160, shape = new THREE.Shape(); shape.moveTo(-span / 2, base);
      for (let i = 0; i <= n; i++) { const u = i / n, s = -span / 2 + span * u; const h = top * (0.8 + 0.13 * Math.sin(u * 9 + seed) + 0.06 * Math.sin(u * 23 + seed * 2.3) + 0.03 * Math.sin(u * 57 + seed * 5.1)); shape.lineTo(s, h); }
      shape.lineTo(span / 2, base); const g2 = new THREE.ShapeGeometry(shape, 1); const p = g2.attributes.position, cc = new Float32Array(p.count * 3), C0 = new THREE.Color(col0), CR = new THREE.Color(rim);
      let maxY = 0; for (let i = 0; i < p.count; i++) maxY = Math.max(maxY, p.getY(i));
      for (let i = 0; i < p.count; i++) { const k = sstep(maxY * 0.55, maxY, p.getY(i)) ** 2; const c = C0.clone().lerp(CR, k * 0.55); cc[i * 3] = c.r; cc[i * 3 + 1] = c.g; cc[i * 3 + 2] = c.b; }
      g2.setAttribute("color", new THREE.BufferAttribute(cc, 3)); const m = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
      if (along === "z") { m.rotation.y = -Math.PI / 2; m.position.set(x0, 0, c0); } else { m.position.set(c0, 0, x0); } V.add(m); return m; };
    ridge(234, 66, -5, 0x34456a, 0x8aa2cc, 0.7); ridge(216, 57, -5, 0x2a3a5c, 0x7890b8, 2.1); ridge(198, 48, -5, 0x213050, 0x6680a6, 3.6); ridge(182, 40, -5, 0x1a2640, 0x56709a, 5.2);
    ridge(-200, 16, -5, 0x1a2436, 0x485c7a, 1.1, 460, "x", 0); ridge(200, 15, -5, 0x1a2436, 0x485c7a, 4.4, 460, "x", 0);
    { const m = ridge(-205, 14, -5, 0x1a2436, 0x485c7a, 2.9, 460, "z", 0); m.rotation.y = Math.PI / 2; }
    // mist: soft horizontal sheets in the valley + vertical veils between ridge layers
    const mistTex = radialTex(), mistMat = new THREE.MeshBasicMaterial({ map: mistTex, color: 0x9fb4d8, transparent: true, opacity: 0.3, depthWrite: false, fog: false });
    for (const [x, y, z, s] of [[92, 3.2, -30, 60], [100, 4.5, 25, 70], [118, 7.5, -5, 80], [140, 11, 40, 90], [150, 12, -50, 90], [88, 2.4, 60, 50]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 0.55), mistMat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); V.add(m); }
    const veilMat = new THREE.MeshBasicMaterial({ map: vGradTex(), color: 0x7f97c0, transparent: true, opacity: 0.38, depthWrite: false, fog: false, side: THREE.DoubleSide });
    for (const [x, h] of [[225, 40], [207, 34], [190, 28], [172, 22]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(440, h), veilMat); m.rotation.y = -Math.PI / 2; m.position.set(x, h / 2 - 2, 0); V.add(m); }
    // stars + moon
    { const n = 1600, sp = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const th = rand() * Math.PI * 2, ph = Math.acos(0.08 + rand() * 0.92), R = 225; sp[i * 3] = Math.sin(ph) * Math.cos(th) * R + 30; sp[i * 3 + 1] = Math.cos(ph) * R * 0.75 + 8; sp[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * R; }
      const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3)); const st = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false })); st.name = "stars33"; st.frustumCulled = false; V.add(st); }
    { const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex(), fog: false, transparent: true, depthWrite: false })); moon.position.set(170, 120, 95); moon.scale.set(22, 22, 1); V.add(moon); }
    // lanes: winding splines through the village; houses + lamps + trees placed along/around them
    const lanes = [
      [[86, -20], [94, -14], [101, -9], [108, -13], [116, -6], [124, 2], [132, 12]],
      [[101, -9], [103, 3], [99, 15], [105, 27], [113, 35], [121, 46]],
      [[108, -13], [112, -27], [108, -41], [116, -54], [125, -64]],
      [[86, 30], [93, 24], [99, 15]],
      [[116, -6], [124, -18], [134, -24], [142, -33]],
    ].map((P) => new THREE.CatmullRomCurve3(P.map(([x, z]) => new THREE.Vector3(x, H(x, z), z))));
    const lanePts = []; lanes.forEach((c) => { const L = c.getLength(); for (let s = 0; s <= L; s += 2) { const p = c.getPointAt(s / L), t = c.getTangentAt(s / L); lanePts.push({ p, t }); } });
    const nearLane = (x, z, d) => lanePts.some((q) => Math.hypot(q.p.x - x, q.p.z - z) < d);
    // lane ribbons (dim cobble)
    for (const c of lanes) { const pts = c.getSpacedPoints(80), v = [], idx = [];
      pts.forEach((p, i) => { const t = c.getTangentAt(i / 80); const nx = -t.z, nz = t.x, n = Math.hypot(nx, nz) || 1; for (const s of [-1, 1]) { const x = p.x + nx / n * 1.4 * s, z = p.z + nz / n * 1.4 * s; v.push(x, H(x, z) + 0.12, z); } if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
      const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); lg.setIndex(idx); const lm = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: 0x3a3428, fog: false, side: THREE.DoubleSide })); V.add(lm); }
    // houses: instanced walls + roofs (+ window quads). Types: Wessex stone/thatch, timber-framed/slate, Tudor (steep), craftsman (low, wide)
    const houses = [{ x: 94, z: -1, reserved: true }, { x: 110, z: -3, reserved: true }, { x: 101, z: -1, reserved: true }];
    const tryHouse = (x, z, yaw, type) => { if (houses.some((h) => Math.hypot(h.x - x, h.z - z) < 7)) return false; if (x < 86) return false; houses.push({ x, z, y: H(x, z), yaw, type }); return true; };
    for (const q of lanePts) { if (rand() < 0.42) continue; const side = rand() < 0.5 ? -1 : 1, nx = -q.t.z * side, nz = q.t.x * side, off = 4.2 + rand() * 2.5;
      const x = q.p.x + nx * off, z = q.p.z + nz * off; const yaw = Math.atan2(-nx, -nz); const r = rand(); tryHouse(x, z, yaw, x < 102 ? (r < 0.5 ? 0 : r < 0.85 ? 1 : 2) : (r < 0.45 ? 3 : r < 0.8 ? 2 : 1)); }
    for (let i = 0; i < 200 && houses.length < 150; i++) { const x = 98 + rand() * 45, z = -80 + rand() * 160; const y = H(x, z); if (y > 15) continue; tryHouse(x, z, Math.PI / 2 + (rand() - 0.5) * 1.2, rand() < 0.5 ? 3 : 2); } // West-Hills / Tudor homes up the slopes
    const wallCol = [0x6c665a, 0x857e6c, 0x7a6e5e, 0x5f5a52], roofCol = [0x5e4a2e, 0x2b2f38, 0x33292a, 0x3a3226];
    const dims = [[5.5, 3.2, 4.2, 2.6], [6.2, 3.6, 4.6, 2.8], [5.0, 4.4, 5.0, 3.6], [7.4, 3.4, 5.6, 1.9]]; // w, wallH, d, roofH
    const wallIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ fog: false }), houses.length + 2);
    const roofGeo = (() => { const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.lineTo(-0.5, 0); const g2 = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g2.translate(0, 0, -0.5); return g2; })();
    const roofIM = new THREE.InstancedMesh(roofGeo, new THREE.MeshLambertMaterial({ fog: false }), houses.length + 2);
    const winGeo = new THREE.PlaneGeometry(1.0, 1.25), winM = []; const glowM = [];
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Sv = new THREE.Vector3(), Pv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    houses.forEach((h, i) => { if (h.reserved) return; const [w, wh, d, rh] = dims[h.type]; const sc = 0.85 + rand() * 0.35;
      Q.setFromAxisAngle(up, h.yaw); M.compose(Pv.set(h.x, h.y + wh * sc / 2 - 0.3, h.z), Q, Sv.set(w * sc, wh * sc + 0.6, d * sc)); wallIM.setMatrixAt(i, M); wallIM.setColorAt(i, haze(new THREE.Color(wallCol[h.type]), h.x, h.y, h.z));
      // roof ridge runs along the house width (local x): rotate the prism so its extrusion (z) follows local x
      const Qr = Q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.PI / 2)); M.compose(Pv.set(h.x, h.y + wh * sc - 0.3, h.z), Qr, Sv.set(d * sc + 0.7, rh * sc, w * sc + 0.5)); roofIM.setMatrixAt(i, M); roofIM.setColorAt(i, haze(new THREE.Color(roofCol[h.type]), h.x, h.y, h.z));
      // windows on the front face (local +z = toward the lane), a few lit, some dark
      const nW = h.type === 3 ? 4 : 3, fx = Math.sin(h.yaw), fz = Math.cos(h.yaw), rx = Math.cos(h.yaw), rz = -Math.sin(h.yaw);
      for (let k = 0; k < nW; k++) { if (rand() < 0.28) continue; const along = (k - (nW - 1) / 2) * (w * sc / nW), yy = h.y + (rand() < 0.4 && h.type !== 3 ? wh * sc * 0.72 : wh * sc * 0.32);
        winM.push(new THREE.Matrix4().compose(new THREE.Vector3(h.x + fx * (d * sc / 2 + 0.03) + rx * along, yy, h.z + fz * (d * sc / 2 + 0.03) + rz * along), Q.clone(), new THREE.Vector3(1, 1, 1)));
        if (rand() < 0.35) glowM.push([h.x + fx * (d * sc / 2 + 0.6) + rx * along, yy, h.z + fz * (d * sc / 2 + 0.6) + rz * along]); }
      // and one or two on the west gable for the yard/tower view
      if (rand() < 0.6) winM.push(new THREE.Matrix4().compose(new THREE.Vector3(h.x - rx * (w * sc / 2 + 0.03), h.y + wh * sc * 0.45, h.z - rz * (w * sc / 2 + 0.03)), Q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(up, -Math.PI / 2)), new THREE.Vector3(1, 1, 1)));
    });
    // church (nave + tower + spire) and the pub, at the village green near (98, −10)
    const special = (x, z, yaw, w, wh, d, col, rcol, rh) => { const i = houses.findIndex((h) => h.reserved && !h.used && Math.hypot(h.x - x, h.z - z) < 1); houses[i].used = true; const y = H(x, z); Q.setFromAxisAngle(up, yaw);
      M.compose(Pv.set(x, y + wh / 2 - 0.3, z), Q, Sv.set(w, wh + 0.6, d)); wallIM.setMatrixAt(i, M); wallIM.setColorAt(i, haze(new THREE.Color(col), x, y, z));
      const Qr = Q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.PI / 2)); M.compose(Pv.set(x, y + wh - 0.3, z), Qr, Sv.set(d + 0.6, rh, w + 0.5)); roofIM.setMatrixAt(i, M); roofIM.setColorAt(i, haze(new THREE.Color(rcol), x, y, z)); return y; };
    const cx = 94, cz = -1, cy = special(cx, cz, 0.3, 14, 6, 6.5, 0x6e6a60, 0x2b2f38, 4.2);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3.6, 15, 3.6), new THREE.MeshLambertMaterial({ color: haze(new THREE.Color(0x6a6458), cx, cy, cz), fog: false })); tower.position.set(cx - 7.5 * Math.cos(0.3), cy + 7.2, cz + 7.5 * Math.sin(0.3)); tower.rotation.y = 0.3; V.add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.4, 7, 4), new THREE.MeshLambertMaterial({ color: haze(new THREE.Color(0x2b2f38), cx, cy, cz), fog: false })); spire.position.set(tower.position.x, cy + 18.2, tower.position.z); spire.rotation.y = 0.3 + Math.PI / 4; V.add(spire);
    for (const dy of [3, 9.5]) for (const s of [-1, 1]) winM.push(new THREE.Matrix4().compose(new THREE.Vector3(tower.position.x - 1.83 * Math.cos(0.3) + s * 0.0, cy + dy, tower.position.z + 1.83 * Math.sin(0.3) + s * 0.8), new THREE.Quaternion().setFromAxisAngle(up, -Math.PI / 2 + 0.3), new THREE.Vector3(1, 1.6, 1)));
    for (let k = -2; k <= 2; k++) winM.push(new THREE.Matrix4().compose(new THREE.Vector3(cx + Math.sin(0.3) * 3.3 + Math.cos(0.3) * k * 2.4, cy + 2.4, cz + Math.cos(0.3) * 3.3 - Math.sin(0.3) * k * 2.4), new THREE.Quaternion().setFromAxisAngle(up, 0.3), new THREE.Vector3(0.9, 2.2, 1)));
    const px = 110, pz = -3, py = special(px, pz, -0.4, 9, 4.2, 6, 0x857e6c, 0x5e4a2e, 3.0); // the pub: thatched, every window lit
    for (let k = -1; k <= 1; k++) for (const yy of [1.4, 3.1]) { const yaw = -0.4 - Math.PI / 2; const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      winM.push(new THREE.Matrix4().compose(new THREE.Vector3(px + fx * 4.53 + rx * k * 1.8, py + yy, pz + fz * 4.53 + rz * k * 1.8), new THREE.Quaternion().setFromAxisAngle(up, yaw), new THREE.Vector3(1.2, 1, 1))); glowM.push([px + fx * 5.2 + rx * k * 1.8, py + yy, pz + fz * 5.2 + rz * k * 1.8]); }
    special(101, -1, 0.1, 6, 3.4, 5, 0x6c665a, 0x5e4a2e, 2.8); // village-green cottage beside the church
    wallIM.count = houses.length; roofIM.count = houses.length; wallIM.instanceMatrix.needsUpdate = true; roofIM.instanceMatrix.needsUpdate = true; V.add(wallIM, roofIM); this._houses = houses;
    const winIM = new THREE.InstancedMesh(winGeo, new THREE.MeshBasicMaterial({ color: AMBER, fog: false, toneMapped: false, side: THREE.DoubleSide }), winM.length);
    winM.forEach((m, i) => { winIM.setMatrixAt(i, m); const c = new THREE.Color(AMBER).multiplyScalar(0.75 + rand() * 0.45); if (rand() < 0.12) c.set(0xffe2a8); winIM.setColorAt(i, c); }); V.add(winIM);
    // lamps along the lanes + window glows (additive points)
    const glowPts = glowM.slice(); lanePts.forEach((q, i) => { if (i % 4) return; const nx = -q.t.z, nz = q.t.x; glowPts.push([q.p.x + nx * 1.9, q.p.y + 2.6, q.p.z + nz * 1.9]); });
    glowPts.push([px - 4, py + 2.4, pz - 2], [cx, cy + 6.5, cz + 5]); // pub lantern, church porch
    { const n = glowPts.length, gp = new Float32Array(n * 3); glowPts.forEach((p, i) => gp.set(p, i * 3)); const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.BufferAttribute(gp, 3));
      const pm = new THREE.Points(gg, new THREE.PointsMaterial({ map: glowTex(), color: 0xffb04a, size: 4.2, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); pm.name = "village_glows"; V.add(pm); this._glows = pm; }
    { const posts = lanePts.filter((q, i) => i % 4 === 0); const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), new THREE.MeshLambertMaterial({ color: 0x14141a, fog: false }), posts.length);
      posts.forEach((q, i) => { const nx = -q.t.z, nz = q.t.x; M.makeTranslation(q.p.x + nx * 1.9, q.p.y + 1.3, q.p.z + nz * 1.9); im.setMatrixAt(i, M); }); V.add(im); }
    // forest: Gatlinburg-dense mixed conifer + deciduous, big dark wooded tracts, oaks studding the golden hills
    const con = [], dec = [], oak = [];
    for (let i = 0; i < 16000 && con.length + dec.length < 4600; i++) { const x = 72 + rand() * 103, z = -128 + rand() * 256, y = H(x, z);
      if ((x < 84 && rand() < 0.85) || nearLane(x, z, 2.6) || houses.some((h) => Math.hypot(h.x - x, h.z - z) < 4.2)) continue;
      const dens = 0.55 + 0.45 * Math.sin(x * 0.05 + 1.7) * Math.cos(z * 0.04); if (y > 15) { if (rand() < 0.06) oak.push([x, y, z]); continue; } if (rand() > dens + 0.25) continue;
      (rand() < 0.5 + 0.25 * Math.sin(z * 0.02) ? con : dec).push([x, y, z]); }
    const treeIM = (geo, arr, cA, cB, hMin, hMax, wk, yOff) => { const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ fog: false }), arr.length);
      arr.forEach(([x, y, z], i) => { const h = hMin + rand() * (hMax - hMin); Q.setFromAxisAngle(up, rand() * 6.28); M.compose(Pv.set(x, y + h * yOff, z), Q, Sv.set(h * wk, h, h * wk)); im.setMatrixAt(i, M);
        im.setColorAt(i, haze(new THREE.Color(cA).lerp(new THREE.Color(cB), rand()), x, y, z)); }); V.add(im); return im; };
    treeIM(new THREE.ConeGeometry(0.5, 1, 7), con, 0x0e1c16, 0x1d2e24, 5, 11, 0.42, 0.5);
    treeIM(new THREE.IcosahedronGeometry(0.5, 0), dec, 0x182416, 0x3a3420, 4.5, 8, 0.95, 0.55);
    treeIM(new THREE.IcosahedronGeometry(0.5, 0), oak, 0x1a1e12, 0x262a18, 4, 7, 1.5, 0.35);
    this._villageStats = { houses: houses.length, conifers: con.length, deciduous: dec.length, oaks: oak.length, windows: winM.length, lamps: glowPts.length };
  }

  /** Draw the village/ridges/stars backdrop for `camera` (pose, fov, aspect copied). Returns false when skipped
   *  (camera deep inside the house: nothing outside is visible there — saves its draw calls). */
  renderBackdrop(renderer, camera) {
    const p = camera.getWorldPosition(this._tmpV || (this._tmpV = new THREE.Vector3()));
    if (Math.abs(p.x) < 21 && p.z > -28 && p.z < 13 && p.y < 11.6 && !globalThis.__BACKDROP_ALWAYS) { renderer.setClearColor(0x0b1224, 1); renderer.clear(true, false, false); return false; }
    const c = this.backCam; c.position.copy(p); c.quaternion.copy(camera.getWorldQuaternion(this._tmpQ || (this._tmpQ = new THREE.Quaternion())));
    if (c.fov !== camera.fov || c.aspect !== camera.aspect) { c.fov = camera.fov; c.aspect = camera.aspect; c.updateProjectionMatrix(); }
    renderer.render(this.backScene, c); return true;
  }

  /* --------------------------------------------------------------- PAINTING */
  _buildPainting() {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 640; const x = c.getContext("2d");
    paintVillage(x, 1024, 640);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace || tex.colorSpace;
    const g = new THREE.Group(); g.name = "village_painting"; g.position.set(globalThis.__PAINT_X ?? 5.9, 1.85, globalThis.__PAINT_Z ?? 0.155); this.root.add(g); this.painting = g;
    const W = 1.55, Hh = 0.97;
    const canvas = new THREE.Mesh(new THREE.PlaneGeometry(W, Hh), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); canvas.position.z = 0.03; g.add(canvas);
    const back = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, Hh + 0.04, 0.03), new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.9 })); back.position.z = 0.012; g.add(back);
    const gold = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.75, roughness: 0.35, emissive: 0x2a1c05 });
    for (const [w, h, px, py] of [[W + 0.28, 0.14, 0, Hh / 2 + 0.07], [W + 0.28, 0.14, 0, -Hh / 2 - 0.07], [0.14, Hh, -W / 2 - 0.07, 0], [0.14, Hh, W / 2 + 0.07, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), gold); b.position.set(px, py, 0.035); g.add(b); }
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.097), new THREE.MeshBasicMaterial({ map: textTex("THE VALE BEYOND THE HEDGE", "#e9cf86", "#2a1c08"), toneMapped: false })); plate.position.set(0, -Hh / 2 - 0.22, 0.012); g.add(plate);
  }

  /* ------------------------------------------------------------------ AUDIO */
  _initAudio() {
    if (this._audio) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { const ctx = new AC(), out = ctx.createGain(); out.gain.value = 0; out.connect(ctx.destination);
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420; lp.connect(out);
      for (const [f, gv] of [[55, 0.5], [82.6, 0.3], [110.4, 0.18]]) { const o = ctx.createOscillator(); o.frequency.value = f; const gg = ctx.createGain(); gg.gain.value = gv; o.connect(gg).connect(lp); o.start(); }
      const chime = ctx.createGain(); chime.gain.value = 0; chime.connect(ctx.destination); const meow = ctx.createGain(); meow.gain.value = 0.0; meow.connect(ctx.destination);
      this._audio = { ctx, hum: out, chime, meow, nextChime: 0, lastMeow: -99 }; } catch (_) { this._audio = null; }
  }
  _chime(A, vol) { const ctx = A.ctx, t = ctx.currentTime, f = [523.3, 587.3, 659.3, 784, 880, 1046.5][Math.floor(Math.random() * 6)];
    for (const [m, g0] of [[1, 1], [2.76, 0.35], [5.4, 0.12]]) { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f * m; const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 * vol * g0, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 2.7); } }
  _meow(A) { const ctx = A.ctx, t = ctx.currentTime, o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(420, t); o.frequency.linearRampToValueAtTime(820, t + 0.18); o.frequency.linearRampToValueAtTime(560, t + 0.62);
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(900, t); bp.frequency.linearRampToValueAtTime(1700, t + 0.2); bp.frequency.linearRampToValueAtTime(1100, t + 0.6); bp.Q.value = 4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.06); g.gain.linearRampToValueAtTime(0.09, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); o.connect(bp).connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.75); }

  /* ----------------------------------------------------------------- UPDATE */
  update(t, dt, focus) {
    this._t = t; const T = TOWER;
    // aviation light: 1 Hz double blink; beacons alternate
    const av = (t % 1.6) < 0.12 || ((t % 1.6) > 0.3 && (t % 1.6) < 0.42); this._avia.visible = av; this._aviaGlow.visible = av;
    const ph = Math.floor(t / 0.8) % 2; this._beacons[0].visible = ph === 0; this._beacons[1].visible = ph === 1;
    // cab + landing doors follow the Drive elevator state
    const L = globalThis.__TOWER_LIFT; const cabY = L ? L.cabY : 0; this._cab.position.y = cabY;
    this._doors.forEach((pair, i) => { const o = L ? L.doors[i] : 0; for (const d of pair) d.m.position.x = d.s * (0.21 + 0.38 * o); });
    this._pad.material.color.setHSL(0.52, 1, 0.5 + 0.12 * Math.sin(t * 3.2));
    // cat: breathing, tail swish, eye blink, head tilt
    if (this._cat) { this._cat.scale.y = 1 + 0.025 * Math.sin(t * 2.1); this._catTail.forEach((s, i) => (s.rotation.z = 0.35 * Math.sin(t * 2.4 - i * 0.6)));
      const bl = (t % 4.3) < 0.13 ? 0.08 : 1; this._catEyes.forEach((e) => (e.scale.y = bl)); this._catHead.rotation.z = 0.15 * Math.sin(t * 0.7); }
    // audio by the focus point (car in Drive, player otherwise)
    const A = this._audio; if (A && focus) { const dx = focus.x - T.x, dz = focus.z - T.z, r = Math.hypot(dx, dz);
      const near = Math.max(0, 1 - r / 18) * sstep(14, 26, focus.y); const tt = A.ctx.currentTime;
      A.hum.gain.setTargetAtTime(0.07 * near, tt, 0.4);
      if (near > 0.15 && tt > A.nextChime) { this._chime(A, near); A.nextChime = tt + 1.2 + Math.random() * 2.4; }
      if (this._catWorld && focus.distanceTo(this._catWorld) < 2.2 && tt - A.lastMeow > 6) { A.lastMeow = tt; this._meow(A); this._catHead.rotation.y = 0.3; } }
  }
}

/* ------------------------------------------------------------ texture helpers */
function glowTex() { if (glowTex._t) return glowTex._t; const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.25, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (glowTex._t = new THREE.CanvasTexture(c)); }
function radialTex() { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(0.6, "rgba(255,255,255,0.35)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); }
function vGradTex() { const c = document.createElement("canvas"); c.width = 4; c.height = 128; const x = c.getContext("2d"); const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.7, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0.8)"); x.fillStyle = g; x.fillRect(0, 0, 4, 128); return new THREE.CanvasTexture(c); }
function moonTex() { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"); const g = x.createRadialGradient(64, 64, 10, 64, 64, 64);
  g.addColorStop(0, "rgba(255,250,230,1)"); g.addColorStop(0.28, "rgba(240,236,214,1)"); g.addColorStop(0.33, "rgba(200,210,240,0.35)"); g.addColorStop(1, "rgba(160,180,230,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); }
function textTex(s, fg, bg = null) { const c = document.createElement("canvas"); c.width = 512; c.height = 80; const x = c.getContext("2d"); if (bg) { x.fillStyle = bg; x.fillRect(0, 0, 512, 80); }
  x.fillStyle = fg; let fs = 40; x.font = `bold ${fs}px Georgia, serif`; while (x.measureText(s).width > 490 && fs > 12) { fs -= 2; x.font = `bold ${fs}px Georgia, serif`; } x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(s, 256, 42); return new THREE.CanvasTexture(c); }

/** The foyer painting: the same night village, painterly (layered ridges, golden hills, forest, cottages, church, lamps, mist, stars). */
export function paintVillage(x, W, H) {
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const sky = x.createLinearGradient(0, 0, 0, H * 0.6); sky.addColorStop(0, "#070b1c"); sky.addColorStop(0.6, "#18203e"); sky.addColorStop(1, "#2b3558"); x.fillStyle = sky; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(230,236,255,${0.3 + r() * 0.7})`; const sz = r() < 0.08 ? 2 : 1; x.fillRect(r() * W, r() * H * 0.45, sz, sz); }
  { const g = x.createRadialGradient(W * 0.78, H * 0.16, 4, W * 0.78, H * 0.16, 70); g.addColorStop(0, "#fff6dc"); g.addColorStop(0.25, "#efe9d0"); g.addColorStop(0.32, "rgba(200,210,240,0.35)"); g.addColorStop(1, "rgba(160,180,230,0)"); x.fillStyle = g; x.fillRect(0, 0, W, H); }
  const ridge = (y0, amp, col, rim, seed) => { x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= 100; i++) { const u = i / 100, y = y0 - amp * (0.6 + 0.25 * Math.sin(u * 9 + seed) + 0.1 * Math.sin(u * 23 + seed * 2) + 0.05 * Math.sin(u * 61 + seed)); x.lineTo(u * W, y); } x.lineTo(W, H); x.closePath();
    const g = x.createLinearGradient(0, y0 - amp, 0, y0 + 40); g.addColorStop(0, rim); g.addColorStop(0.18, col); g.addColorStop(1, col); x.fillStyle = g; x.fill();
    const m = x.createLinearGradient(0, y0 - 10, 0, y0 + 30); m.addColorStop(0, "rgba(150,170,210,0)"); m.addColorStop(1, "rgba(150,170,210,0.28)"); x.fillStyle = m; x.fillRect(0, y0 - 10, W, 40); };
  ridge(H * 0.4, 70, "#2c3b58", "#8197bd", 0.7); ridge(H * 0.47, 70, "#223049", "#6c83a8", 2.1); ridge(H * 0.54, 66, "#1a263b", "#5a7396", 3.6);
  // golden oak hills
  x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= 100; i++) { const u = i / 100; x.lineTo(u * W, H * 0.62 - 45 * (0.5 + 0.5 * Math.sin(u * 5.5 + 0.8))); } x.lineTo(W, H); x.closePath();
  { const g = x.createLinearGradient(0, H * 0.5, 0, H * 0.75); g.addColorStop(0, "#9a8550"); g.addColorStop(0.3, "#6e5c30"); g.addColorStop(1, "#2e2a18"); x.fillStyle = g; x.fill(); }
  for (let i = 0; i < 70; i++) { const u = r(), y = H * 0.62 - 45 * (0.5 + 0.5 * Math.sin(u * 5.5 + 0.8)) + 8 + r() * 26; x.fillStyle = "#1d2112"; x.beginPath(); x.ellipse(u * W, y, 5 + r() * 6, 4 + r() * 4, 0, 0, 7); x.fill(); }
  // forest bank (dense conifers + rounded deciduous)
  for (let i = 0; i < 900; i++) { const u = r(), base = H * 0.74 + r() * H * 0.26, hgt = 18 + r() * 30; const c = ["#0e1c16", "#132219", "#1b2a1f", "#1f2a1a", "#2a2a18"][Math.floor(r() * 5)]; x.fillStyle = c;
    if (r() < 0.55) { x.beginPath(); x.moveTo(u * W, base - hgt); x.lineTo(u * W - hgt * 0.28, base); x.lineTo(u * W + hgt * 0.28, base); x.fill(); } else { x.beginPath(); x.ellipse(u * W, base - hgt * 0.4, hgt * 0.38, hgt * 0.34, 0, 0, 7); x.fill(); } }
  // valley mist
  { const g = x.createLinearGradient(0, H * 0.68, 0, H * 0.82); g.addColorStop(0, "rgba(160,180,215,0)"); g.addColorStop(0.5, "rgba(160,180,215,0.28)"); g.addColorStop(1, "rgba(160,180,215,0)"); x.fillStyle = g; x.fillRect(0, H * 0.66, W, H * 0.18); }
  // winding lane with lamps
  x.strokeStyle = "rgba(90,78,58,0.9)"; x.lineWidth = 6; x.beginPath(); x.moveTo(W * 0.05, H * 0.98); x.bezierCurveTo(W * 0.3, H * 0.8, W * 0.45, H * 0.92, W * 0.62, H * 0.78); x.bezierCurveTo(W * 0.75, H * 0.7, W * 0.85, H * 0.76, W * 0.98, H * 0.7); x.stroke();
  const glow = (gx, gy, rr, a = 0.9) => { const g = x.createRadialGradient(gx, gy, 0, gx, gy, rr); g.addColorStop(0, `rgba(255,214,140,${a})`); g.addColorStop(0.3, `rgba(255,170,70,${a * 0.45})`); g.addColorStop(1, "rgba(255,150,50,0)"); x.fillStyle = g; x.fillRect(gx - rr, gy - rr, rr * 2, rr * 2); };
  // cottages / Tudor / craftsman peeking through the trees
  const house = (hx, hy, w, h, wall, roof, steep) => { x.fillStyle = wall; x.fillRect(hx - w / 2, hy - h, w, h); x.fillStyle = roof; x.beginPath(); x.moveTo(hx - w / 2 - 4, hy - h); x.lineTo(hx, hy - h - w * steep); x.lineTo(hx + w / 2 + 4, hy - h); x.fill();
    if (wall === "#857e6c") { x.strokeStyle = "#2a2018"; x.lineWidth = 2; for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(hx + k * w / 3, hy - h); x.lineTo(hx + k * w / 3, hy); x.stroke(); } }
    for (let k = 0; k < 2; k++) if (r() < 0.8) { const wx = hx - w / 4 + k * w / 2 - 3, wy = hy - h * 0.6; x.fillStyle = "#ffb347"; x.fillRect(wx, wy, 6, 8); glow(wx + 3, wy + 4, 14, 0.5); } };
  const H0 = [["#6c665a", "#5e4a2e", 0.45], ["#857e6c", "#2b2f38", 0.6], ["#7a6e5e", "#33292a", 0.85], ["#5f5a52", "#3a3226", 0.3]];
  for (let i = 0; i < 34; i++) { const u = 0.04 + r() * 0.92, y = H * 0.75 + r() * H * 0.2, t = H0[Math.floor(r() * 4)]; house(u * W, y, 26 + r() * 14, 16 + r() * 8, t[0], t[1], t[2]); }
  // church tower + spire, pub
  x.fillStyle = "#6a6458"; x.fillRect(W * 0.42, H * 0.6, 26, 90); x.fillStyle = "#2b2f38"; x.beginPath(); x.moveTo(W * 0.42 - 4, H * 0.6); x.lineTo(W * 0.42 + 13, H * 0.6 - 60); x.lineTo(W * 0.42 + 30, H * 0.6); x.fill();
  x.fillStyle = "#ffb347"; x.fillRect(W * 0.42 + 9, H * 0.6 + 20, 8, 14); glow(W * 0.42 + 13, H * 0.6 + 27, 22);
  house(W * 0.55, H * 0.86, 60, 26, "#857e6c", "#5e4a2e", 0.45); for (let k = 0; k < 4; k++) { x.fillStyle = "#ffc76a"; x.fillRect(W * 0.55 - 24 + k * 14, H * 0.86 - 18, 8, 10); glow(W * 0.55 - 20 + k * 14, H * 0.86 - 13, 20, 0.7); }
  for (const [u, v] of [[0.12, 0.92], [0.28, 0.85], [0.45, 0.89], [0.66, 0.77], [0.8, 0.72], [0.93, 0.71]]) { x.fillStyle = "#14141a"; x.fillRect(u * W - 1, v * H - 26, 2, 26); glow(u * W, v * H - 28, 18); }
  // painterly finish: vignette + brush grain
  { const g = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.65); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.55)"); x.fillStyle = g; x.fillRect(0, 0, W, H); }
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${r() < 0.5 ? "255,240,210" : "0,0,0"},${0.03 + r() * 0.04})`; x.fillRect(r() * W, r() * H, 2 + r() * 6, 1); }
}
