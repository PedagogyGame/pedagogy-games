import * as THREE from "three";
import { GHOST_BOOKS, BOOK_TOUCH_R, BOOK_TOUCH_DY, BOOK_CAR_DY, BOOKS_FOR_TURBO, BOOKS_FOR_SUPER } from "../data/ghostBooks.js?v=logic26";

const STORE_KEY = "motu.ghostBooks.v1";
const ls = () => { try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (_) { return null; } };

/**
 * logic15 GHOST BOOKS: 12 translucent glowing books (bob + spin), collected on touch with a
 * sparkle burst + soft chime. Progress persists in localStorage. 6 → TURBO, 12 → flames + SUPER.
 * Unlit materials only (no lights added).
 */
export class GhostBooks {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group(); this.root.name = "ghost_books";
    this.got = new Set();
    try { const s = ls()?.getItem(STORE_KEY); if (s) for (const id of JSON.parse(s)) if (GHOST_BOOKS.some((b) => b.id === id)) this.got.add(id); } catch (_) {}
    this.items = [];
    const cover = new THREE.BoxGeometry(0.075, 0.095, 0.022);
    const pages = new THREE.BoxGeometry(0.066, 0.086, 0.024);
    const halo = new THREE.PlaneGeometry(0.2, 0.2);
    const haloTex = makeGlowTexture(); this._glow = haloTex;
    GHOST_BOOKS.forEach((b, i) => {
      const g = new THREE.Group(); g.name = "ghost_book_" + b.id;
      const hue = 0.5 + 0.1 * Math.sin(i * 1.7);
      const cm = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue, 0.7, 0.68), transparent: true, opacity: 0.62, depthWrite: false });
      const pm = new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.55, depthWrite: false });
      const c = new THREE.Mesh(cover, cm), p = new THREE.Mesh(pages, pm); p.position.x = 0.006;
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color().setHSL(hue, 0.8, 0.7), transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
      h.scale.set(0.24, 0.24, 1);
      for (const o of [c, p, h]) o.raycast = () => {}; // never an occluder / pick target
      g.add(c, p, h);
      g.position.set(b.x, b.y, b.z);
      g.visible = !this.got.has(b.id);
      this.root.add(g);
      this.items.push({ b, g, phase: i * 0.83 });
    });
    void halo;
    this.sparks = [];
    scene.add(this.root);
    this.onCollect = null;
  }
  get count() { return this.got.size; }
  get total() { return GHOST_BOOKS.length; }
  get turboLevel() { return this.got.size >= BOOKS_FOR_SUPER ? 2 : this.got.size >= BOOKS_FOR_TURBO ? 1 : 0; }
  setVisible(v) { this.root.visible = v; }
  _save() { try { ls()?.setItem(STORE_KEY, JSON.stringify([...this.got])); } catch (_) {} }
  reset() { this.got.clear(); this._save(); for (const it of this.items) it.g.visible = true; }
  /** Debug/sim: mark n books (in list order) collected. */
  grant(n) { for (const it of this.items.slice(0, n)) { this.got.add(it.b.id); it.g.visible = false; } this._save(); }
  /** Per physics step: collect any book the car body touches. Returns collected book or null. */
  touch(p) {
    let hit = null;
    for (const it of this.items) {
      if (this.got.has(it.b.id)) continue;
      const bob = Math.sin(this._t * 2.2 + it.phase) * 0.012 || 0;
      if (Math.hypot(p.x - it.b.x, p.z - it.b.z) < BOOK_TOUCH_R && Math.abs(p.y + BOOK_CAR_DY - (it.b.y + bob)) < BOOK_TOUCH_DY) {
        this.got.add(it.b.id); it.g.visible = false; this._save(); this._burst(it.g.position); chime(this.got.size === this.total); hit = it.b;
        if (this.onCollect) this.onCollect(it.b, this.got.size);
      }
    }
    return hit;
  }
  update(t, dt) {
    this._t = t;
    for (const it of this.items) {
      if (!it.g.visible) continue;
      it.g.position.y = it.b.y + Math.sin(t * 2.2 + it.phase) * 0.012;
      it.g.rotation.y = t * 1.6 + it.phase;
      it.g.rotation.z = Math.sin(t * 1.3 + it.phase) * 0.18;
    }
    for (const s of this.sparks) {
      s.age += dt; const a = s.age / 0.9;
      const pos = s.pts.geometry.attributes.position;
      for (let i = 0; i < s.vel.length; i++) { const v = s.vel[i]; v.y -= 0.6 * dt; pos.setXYZ(i, pos.getX(i) + v.x * dt, pos.getY(i) + v.y * dt, pos.getZ(i) + v.z * dt); }
      pos.needsUpdate = true; s.pts.material.opacity = Math.max(0, 1 - a);
      if (a >= 1) { this.root.remove(s.pts); s.pts.geometry.dispose(); s.pts.material.dispose(); }
    }
    this.sparks = this.sparks.filter((s) => s.age < 0.9);
  }
  _burst(at) {
    const n = 36, arr = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) {
      arr.set([at.x, at.y, at.z], i * 3);
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 - 0.2, sp = 0.25 + Math.random() * 0.35;
      vel.push(new THREE.Vector3(Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 0.2, Math.sin(a) * Math.cos(e) * sp));
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: this._glow, color: 0xcff6ff, size: 0.012, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.name = "ghost_book_sparkle"; pts.raycast = () => {};
    this.root.add(pts); this.sparks.push({ pts, vel, age: 0 });
  }
}

function makeGlowTexture() {
  if (typeof document === "undefined") return null;
  try {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"); if (!g) return null;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(0.35, "rgba(200,240,255,0.35)"); gr.addColorStop(1, "rgba(200,240,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); return t;
  } catch (_) { return null; }
}

let _ac = null;
function chime(big) {
  try {
    const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    _ac = _ac || new AC();
    const now = _ac.currentTime;
    const notes = big ? [784, 988, 1175, 1568] : [1047, 1568];
    notes.forEach((f, i) => {
      const o = _ac.createOscillator(), g = _ac.createGain();
      o.type = "sine"; o.frequency.value = f;
      const t0 = now + i * 0.08;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.07, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.9);
      o.connect(g).connect(_ac.destination); o.start(t0); o.stop(t0 + 1.0);
    });
  } catch (_) {}
}

/** Muffler flames: two additive cones at the car's tail (unlit; no lights). */
export function makeFlames() {
  const grp = new THREE.Group(); grp.name = "muffler_flames";
  const outer = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
  const inner = new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
  // car-local units (the car root is scaled by CAR_SCALE): twin tail pipes under the rear bumper
  for (const sx of [-0.065, 0.065]) {
    const o = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 10, 1, true), outer);
    const i = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.13, 8, 1, true), inner);
    o.position.set(sx, 0.075, -0.33); i.position.set(sx, 0.075, -0.285);
    for (const m of [o, i]) { m.raycast = () => {}; m.rotation.x = -Math.PI / 2; m.userData.base = m.position.z; grp.add(m); }
  }
  grp.visible = false;
  return grp;
}
