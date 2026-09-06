import * as THREE from "three";

/** Shared vertical cut plane (local +X half removed) for sectional views. */
export const SHARED_CLIP_PLANE = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.02);

function mat(color, opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.15,
    transparent: opts.transparent ?? (!!opts.opacity && opts.opacity < 1),
    opacity: opts.opacity ?? 1,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    side: opts.side ?? THREE.DoubleSide,
    depthWrite: opts.depthWrite ?? true,
  });
  m.clippingPlanes = [SHARED_CLIP_PLANE];
  m.clipShadows = true;
  return m;
}

function L(i, term) {
  const g = new THREE.Group();
  g.name = `layer_${i}_${term}`;
  g.userData.layerIndex = i;
  g.userData.term = term;
  return g;
}

function add(mesh, parent) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cyl(rTop, rBot, h, rad = 20) {
  return new THREE.CylinderGeometry(rTop, rBot, h, rad);
}
function sph(r, w = 24, h = 16, half = true) {
  // half=true -> longitude half for cutaway silhouette even without clip
  return half
    ? new THREE.SphereGeometry(r, w, h, 0, Math.PI, 0, Math.PI)
    : new THREE.SphereGeometry(r, w, h);
}
function box(x, y, z) {
  return new THREE.BoxGeometry(x, y, z);
}
function tor(r, t, rad = 12, tub = 24) {
  return new THREE.TorusGeometry(r, t, rad, tub);
}

function finish(root, def, layers) {
  if (layers.length !== def.layers.length) {
    console.warn(`[meshes] ${def.id}: expected ${def.layers.length} layers, got ${layers.length}`);
  }
  root.scale.setScalar(def.scale || 0.5);
  root.userData.objectId = def.id;
  root.userData.layers = layers;
  root.userData.def = def;
  root.userData.clipPlane = SHARED_CLIP_PLANE;
  root.name = def.id;
  return root;
}

function colors(def) {
  return def.layers.map((l) => l.color);
}

function buildAlkalineAA(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  // 0 Steel Can — outer cylinder shell (half)
  {
    const g = L(0, def.layers[0].term);
    const mesh = new THREE.Mesh(cyl(0.28, 0.28, 1.0, 28), mat(c[0], { metalness: 0.7, roughness: 0.35 }));
    // open top rim
    const rim = new THREE.Mesh(cyl(0.29, 0.29, 0.04, 28), mat(c[0], { metalness: 0.8, roughness: 0.3 }));
    rim.position.y = 0.48;
    add(mesh, g); add(rim, g);
    root.add(g); layers.push(g);
  }
  // 1 MnO2 Cathode — thick black ring/cylinder
  {
    const g = L(1, def.layers[1].term);
    add(new THREE.Mesh(cyl(0.24, 0.24, 0.88, 24), mat(c[1], { roughness: 0.85 })), g);
    root.add(g); layers.push(g);
  }
  // 2 Separator — thin paper cylinder
  {
    const g = L(2, def.layers[2].term);
    add(new THREE.Mesh(cyl(0.18, 0.18, 0.82, 20), mat(c[2], { roughness: 0.9, opacity: 0.9, transparent: true })), g);
    root.add(g); layers.push(g);
  }
  // 3 KOH — translucent fill
  {
    const g = L(3, def.layers[3].term);
    add(new THREE.Mesh(cyl(0.14, 0.14, 0.75, 16), mat(c[3], { roughness: 0.4, opacity: 0.55, transparent: true, metalness: 0.05 })), g);
    root.add(g); layers.push(g);
  }
  // 4 Zinc gel — core cylinder
  {
    const g = L(4, def.layers[4].term);
    add(new THREE.Mesh(cyl(0.1, 0.1, 0.7, 16), mat(c[4], { roughness: 0.7 })), g);
    root.add(g); layers.push(g);
  }
  // 5 Brass collector pin
  {
    const g = L(5, def.layers[5].term);
    const pin = new THREE.Mesh(cyl(0.035, 0.035, 0.85, 10), mat(c[5], { metalness: 0.85, roughness: 0.25 }));
    add(pin, g);
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildBaseball(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  // 0 Cowhide
  {
    const g = L(0, def.layers[0].term);
    add(new THREE.Mesh(sph(0.55, 28, 20), mat(c[0], { roughness: 0.55 })), g);
    root.add(g); layers.push(g);
  }
  // 1 Stitching — red curve tubes on surface
  {
    const g = L(1, def.layers[1].term);
    const m = mat(c[1], { roughness: 0.6, metalness: 0.05 });
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < 18; i++) {
        const t = i / 17;
        const ang = t * Math.PI;
        const y = Math.cos(ang) * 0.42;
        const x = Math.sin(ang) * 0.42 * s * 0.35;
        const z = Math.sin(ang) * 0.42;
        const stitch = new THREE.Mesh(cyl(0.012, 0.012, 0.06, 6), m);
        stitch.position.set(x, y, z * (s > 0 ? 1 : -1) * 0.15 + z * 0.85);
        stitch.lookAt(0, 0, 0);
        add(stitch, g);
      }
    }
    // seam tubes
    for (let s = -1; s <= 1; s += 2) {
      const curve = [];
      for (let i = 0; i <= 24; i++) {
        const t = (i / 24) * Math.PI;
        curve.push(new THREE.Vector3(Math.sin(t) * 0.52 * 0.25 * s, Math.cos(t) * 0.52, Math.sin(t) * 0.52));
      }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curve), 24, 0.012, 5, false), m);
      add(tube, g);
    }
    root.add(g); layers.push(g);
  }
  // 2 Gray wool
  {
    const g = L(2, def.layers[2].term);
    add(new THREE.Mesh(sph(0.42, 20, 14), mat(c[2], { roughness: 0.95 })), g);
    root.add(g); layers.push(g);
  }
  // 3 White wool
  {
    const g = L(3, def.layers[3].term);
    add(new THREE.Mesh(sph(0.3, 18, 12), mat(c[3], { roughness: 0.9 })), g);
    root.add(g); layers.push(g);
  }
  // 4 Cork pill
  {
    const g = L(4, def.layers[4].term);
    const cork = new THREE.Mesh(sph(0.16, 14, 10, false), mat(c[4], { roughness: 0.7 }));
    cork.scale.set(1, 0.75, 1);
    add(cork, g);
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildBirdEgg(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  const egg = (r, col, opts = {}) => {
    const m = new THREE.Mesh(sph(r, 24, 16), mat(col, opts));
    m.scale.set(0.85, 1.15, 0.85);
    return m;
  };
  // 0 Cuticle
  { const g = L(0, def.layers[0].term); add(egg(0.55, c[0], { roughness: 0.45, opacity: 0.85, transparent: true }), g); root.add(g); layers.push(g); }
  // 1 Calcite shell
  { const g = L(1, def.layers[1].term); add(egg(0.52, c[1], { roughness: 0.55 }), g); root.add(g); layers.push(g); }
  // 2 Outer membrane
  { const g = L(2, def.layers[2].term); add(egg(0.46, c[2], { roughness: 0.7, opacity: 0.8, transparent: true }), g); root.add(g); layers.push(g); }
  // 3 Inner membrane
  { const g = L(3, def.layers[3].term); add(egg(0.42, c[3], { roughness: 0.7, opacity: 0.75, transparent: true }), g); root.add(g); layers.push(g); }
  // 4 Albumen
  { const g = L(4, def.layers[4].term); add(egg(0.36, c[4], { roughness: 0.3, opacity: 0.45, transparent: true, metalness: 0.05 }), g); root.add(g); layers.push(g); }
  // 5 Chalaza — thin tubes
  {
    const g = L(5, def.layers[5].term);
    const m = mat(c[5], { roughness: 0.5 });
    for (const side of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        pts.push(new THREE.Vector3(Math.sin(t * Math.PI * 2) * 0.04, side * (0.28 - t * 0.28), Math.cos(t * 4) * 0.03));
      }
      add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.012, 5, false), m), g);
    }
    root.add(g); layers.push(g);
  }
  // 6 Vitelline
  { const g = L(6, def.layers[6].term); const m = egg(0.2, c[6], { roughness: 0.4, opacity: 0.7, transparent: true }); m.scale.set(1, 1, 1); add(m, g); root.add(g); layers.push(g); }
  // 7 Yolk
  { const g = L(7, def.layers[7].term); add(new THREE.Mesh(sph(0.16, 16, 12, false), mat(c[7], { roughness: 0.45 })), g); root.add(g); layers.push(g); }
  return finish(root, def, layers);
}

function buildCoconut(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  { const g = L(0, def.layers[0].term); add(new THREE.Mesh(sph(0.58, 24, 16), mat(c[0], { roughness: 0.6 })), g); root.add(g); layers.push(g); }
  // fibrous mesocarp — bumpy shell via icosa + noise scale
  {
    const g = L(1, def.layers[1].term);
    add(new THREE.Mesh(sph(0.52, 18, 12), mat(c[1], { roughness: 0.95 })), g);
    for (let i = 0; i < 24; i++) {
      const fiber = new THREE.Mesh(cyl(0.01, 0.01, 0.2, 4), mat(c[1], { roughness: 1 }));
      const phi = Math.acos(2 * Math.random() - 1);
      const th = Math.random() * Math.PI; // half
      fiber.position.setFromSphericalCoords(0.5, phi, th);
      fiber.lookAt(0, 0, 0);
      add(fiber, g);
    }
    root.add(g); layers.push(g);
  }
  { const g = L(2, def.layers[2].term); add(new THREE.Mesh(sph(0.4, 20, 14), mat(c[2], { roughness: 0.75 })), g); root.add(g); layers.push(g); }
  { const g = L(3, def.layers[3].term); add(new THREE.Mesh(sph(0.32, 18, 12), mat(c[3], { roughness: 0.55 })), g); root.add(g); layers.push(g); }
  { const g = L(4, def.layers[4].term); add(new THREE.Mesh(sph(0.2, 14, 10, false), mat(c[4], { roughness: 0.2, opacity: 0.55, transparent: true })), g); root.add(g); layers.push(g); }
  {
    const g = L(5, def.layers[5].term);
    const nub = new THREE.Mesh(sph(0.06, 10, 8, false), mat(c[5], { roughness: 0.5 }));
    nub.position.set(0.08, 0.05, 0.05);
    add(nub, g);
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildCompass(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  // 0 Bowl
  {
    const g = L(0, def.layers[0].term);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.22, 32, 1, true), mat(c[0], { metalness: 0.4, roughness: 0.45, side: THREE.DoubleSide }));
    add(bowl, g);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), mat(c[0], { metalness: 0.3, roughness: 0.5 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.1;
    add(floor, g);
    root.add(g); layers.push(g);
  }
  // 1 Glass
  {
    const g = L(1, def.layers[1].term);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.52, 32), mat(c[1], { roughness: 0.15, metalness: 0.1, opacity: 0.35, transparent: true }));
    glass.rotation.x = -Math.PI / 2; glass.position.y = 0.12;
    add(glass, g);
    root.add(g); layers.push(g);
  }
  // 2 Card
  {
    const g = L(2, def.layers[2].term);
    const card = new THREE.Mesh(new THREE.CircleGeometry(0.4, 32), mat(c[2], { roughness: 0.7 }));
    card.rotation.x = -Math.PI / 2; card.position.y = 0.02;
    add(card, g);
    // N mark
    const n = new THREE.Mesh(box(0.04, 0.01, 0.12), mat(0xaa2222, { roughness: 0.5 }));
    n.position.set(0, 0.03, 0.28);
    add(n, g);
    root.add(g); layers.push(g);
  }
  // 3 Magnet needle
  {
    const g = L(3, def.layers[3].term);
    const needle = new THREE.Mesh(box(0.06, 0.02, 0.55), mat(c[3], { metalness: 0.7, roughness: 0.3 }));
    needle.position.y = 0.04;
    add(needle, g);
    root.add(g); layers.push(g);
  }
  // 4 Pivot
  { const g = L(4, def.layers[4].term); const p = new THREE.Mesh(cyl(0.015, 0.005, 0.12, 8), mat(c[4], { metalness: 0.8 })); p.position.y = 0.0; add(p, g); root.add(g); layers.push(g); }
  // 5 Jewel
  { const g = L(5, def.layers[5].term); const j = new THREE.Mesh(sph(0.03, 10, 8, false), mat(c[5], { metalness: 0.4, roughness: 0.2, emissive: c[5], emissiveIntensity: 0.15 })); j.position.y = -0.04; add(j, g); root.add(g); layers.push(g); }
  // 6 Lubber line
  {
    const g = L(6, def.layers[6].term);
    const line = new THREE.Mesh(box(0.02, 0.08, 0.01), mat(c[6], { roughness: 0.4 }));
    line.position.set(0, 0.08, 0.48);
    add(line, g);
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildDcMotor(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  // 0 Housing can
  {
    const g = L(0, def.layers[0].term);
    add(new THREE.Mesh(cyl(0.42, 0.42, 0.75, 28), mat(c[0], { metalness: 0.65, roughness: 0.4 })), g);
    root.add(g); layers.push(g);
  }
  // 1 Magnet arcs
  {
    const g = L(1, def.layers[1].term);
    for (const ang of [0, Math.PI]) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.07, 8, 16, Math.PI), mat(c[1], { metalness: 0.3, roughness: 0.5 }));
      arc.rotation.y = ang;
      arc.rotation.x = Math.PI / 2;
      add(arc, g);
    }
    root.add(g); layers.push(g);
  }
  // 2 Armature
  { const g = L(2, def.layers[2].term); add(new THREE.Mesh(cyl(0.18, 0.18, 0.55, 16), mat(c[2], { metalness: 0.5, roughness: 0.4 })), g); root.add(g); layers.push(g); }
  // 3 Windings — torus coils
  {
    const g = L(3, def.layers[3].term);
    for (let i = 0; i < 3; i++) {
      const coil = new THREE.Mesh(tor(0.14, 0.035, 8, 16), mat(c[3], { metalness: 0.7, roughness: 0.35 }));
      coil.rotation.y = (i / 3) * Math.PI;
      coil.rotation.z = Math.PI / 2;
      add(coil, g);
    }
    root.add(g); layers.push(g);
  }
  // 4 Commutator
  { const g = L(4, def.layers[4].term); const m = new THREE.Mesh(cyl(0.1, 0.1, 0.12, 12), mat(c[4], { metalness: 0.8, roughness: 0.25 })); m.position.y = 0.32; add(m, g); root.add(g); layers.push(g); }
  // 5 Brushes
  {
    const g = L(5, def.layers[5].term);
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(box(0.06, 0.08, 0.04), mat(c[5], { roughness: 0.8 }));
      b.position.set(s * 0.14, 0.32, 0);
      add(b, g);
    }
    root.add(g); layers.push(g);
  }
  // 6 Shaft
  {
    const g = L(6, def.layers[6].term);
    const shaft = new THREE.Mesh(cyl(0.04, 0.04, 1.1, 10), mat(c[6], { metalness: 0.85, roughness: 0.25 }));
    add(shaft, g);
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildHarmonica(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  // 0 Cover plates
  {
    const g = L(0, def.layers[0].term);
    for (const y of [0.12, -0.12]) {
      const plate = new THREE.Mesh(box(0.95, 0.04, 0.32), mat(c[0], { metalness: 0.75, roughness: 0.3 }));
      plate.position.y = y;
      add(plate, g);
    }
    root.add(g); layers.push(g);
  }
  // 1 Comb with slots
  {
    const g = L(1, def.layers[1].term);
    add(new THREE.Mesh(box(0.9, 0.18, 0.28), mat(c[1], { roughness: 0.7 })), g);
    for (let i = 0; i < 8; i++) {
      const slot = new THREE.Mesh(box(0.06, 0.1, 0.2), mat(0x222222, { roughness: 0.9 }));
      slot.position.set(-0.35 + i * 0.1, 0, 0.05);
      add(slot, g);
    }
    root.add(g); layers.push(g);
  }
  // 2 Reed plate
  { const g = L(2, def.layers[2].term); const p = new THREE.Mesh(box(0.88, 0.02, 0.22), mat(c[2], { metalness: 0.6, roughness: 0.4 })); p.position.y = 0.02; add(p, g); root.add(g); layers.push(g); }
  // 3 Reeds flaps
  {
    const g = L(3, def.layers[3].term);
    for (let i = 0; i < 8; i++) {
      const reed = new THREE.Mesh(box(0.05, 0.005, 0.14), mat(c[3], { metalness: 0.7, roughness: 0.3 }));
      reed.position.set(-0.35 + i * 0.1, 0.04, 0);
      add(reed, g);
    }
    root.add(g); layers.push(g);
  }
  // 4 Wind slot
  {
    const g = L(4, def.layers[4].term);
    const slot = new THREE.Mesh(box(0.85, 0.06, 0.04), mat(c[4], { roughness: 0.8 }));
    slot.position.set(0, 0, 0.14);
    add(slot, g);
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildHornetNest(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  // 0 Envelope lumpy
  {
    const g = L(0, def.layers[0].term);
    const env = new THREE.Mesh(sph(0.55, 16, 12), mat(c[0], { roughness: 0.95 }));
    env.scale.set(1.15, 0.95, 1.1);
    add(env, g);
    for (let i = 0; i < 8; i++) {
      const bump = new THREE.Mesh(sph(0.12, 8, 6, false), mat(c[0], { roughness: 0.95 }));
      bump.position.set(Math.cos(i) * 0.4, (i % 3) * 0.15 - 0.1, Math.sin(i) * 0.35);
      add(bump, g);
    }
    root.add(g); layers.push(g);
  }
  // 1 Pedicel
  {
    const g = L(1, def.layers[1].term);
    const ped = new THREE.Mesh(cyl(0.04, 0.07, 0.35, 8), mat(c[1], { roughness: 0.85 }));
    ped.position.y = 0.55;
    add(ped, g);
    root.add(g); layers.push(g);
  }
  // 2 Carton
  { const g = L(2, def.layers[2].term); const m = new THREE.Mesh(sph(0.45, 14, 10), mat(c[2], { roughness: 0.9 })); m.scale.set(1.05, 0.85, 1.05); add(m, g); root.add(g); layers.push(g); }
  // 3 Comb discs stacked
  {
    const g = L(3, def.layers[3].term);
    for (let i = 0; i < 4; i++) {
      const disc = new THREE.Mesh(cyl(0.32 - i * 0.02, 0.32 - i * 0.02, 0.06, 6), mat(c[3], { roughness: 0.8 }));
      disc.position.y = 0.2 - i * 0.12;
      add(disc, g);
    }
    root.add(g); layers.push(g);
  }
  // 4 Hex cell hint
  {
    const g = L(4, def.layers[4].term);
    for (let i = 0; i < 7; i++) {
      const cell = new THREE.Mesh(cyl(0.04, 0.04, 0.05, 6), mat(c[4], { roughness: 0.7 }));
      const a = (i / 7) * Math.PI * 2;
      cell.position.set(Math.cos(a) * 0.12, 0.15, Math.sin(a) * 0.12);
      add(cell, g);
    }
    root.add(g); layers.push(g);
  }
  // 5 Silk caps
  {
    const g = L(5, def.layers[5].term);
    for (let i = 0; i < 5; i++) {
      const cap = new THREE.Mesh(sph(0.035, 8, 6, false), mat(c[5], { roughness: 0.6 }));
      cap.position.set((i - 2) * 0.07, 0.2, 0.05);
      add(cap, g);
    }
    root.add(g); layers.push(g);
  }
  // 6 Meconium
  {
    const g = L(6, def.layers[6].term);
    const m = new THREE.Mesh(sph(0.04, 8, 6, false), mat(c[6], { roughness: 0.9 }));
    m.position.set(0.05, 0.08, 0);
    add(m, g);
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildMagic8Ball(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  { const g = L(0, def.layers[0].term); add(new THREE.Mesh(sph(0.55, 28, 20), mat(c[0], { roughness: 0.35, metalness: 0.2 })), g); root.add(g); layers.push(g); }
  {
    const g = L(1, def.layers[1].term);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 24), mat(c[1], { metalness: 0.3, roughness: 0.5 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.15;
    add(ring, g);
    root.add(g); layers.push(g);
  }
  { const g = L(2, def.layers[2].term); const r = new THREE.Mesh(cyl(0.25, 0.25, 0.35, 20), mat(c[2], { roughness: 0.4, opacity: 0.7, transparent: true })); r.position.y = -0.05; add(r, g); root.add(g); layers.push(g); }
  { const g = L(3, def.layers[3].term); const liq = new THREE.Mesh(cyl(0.22, 0.22, 0.28, 16), mat(c[3], { roughness: 0.2, opacity: 0.5, transparent: true })); liq.position.y = -0.05; add(liq, g); root.add(g); layers.push(g); }
  { const g = L(4, def.layers[4].term); const die = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mat(c[4], { roughness: 0.45 })); die.position.y = -0.02; add(die, g); root.add(g); layers.push(g); }
  {
    const g = L(5, def.layers[5].term);
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.18, 24), mat(c[5], { roughness: 0.1, opacity: 0.4, transparent: true, metalness: 0.1 }));
    win.rotation.x = -Math.PI / 2; win.position.y = 0.42;
    add(win, g);
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildMetronome(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  // 0 Pyramid case
  {
    const g = L(0, def.layers[0].term);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.0, 4), mat(c[0], { roughness: 0.65 })), g);
    root.add(g); layers.push(g);
  }
  // 1 Pendulum rod
  {
    const g = L(1, def.layers[1].term);
    const rod = new THREE.Mesh(cyl(0.02, 0.02, 0.75, 8), mat(c[1], { metalness: 0.5, roughness: 0.4 }));
    rod.position.set(0.05, 0.1, 0.15);
    rod.rotation.z = 0.15;
    add(rod, g);
    root.add(g); layers.push(g);
  }
  // 2 Bob
  {
    const g = L(2, def.layers[2].term);
    const bob = new THREE.Mesh(box(0.1, 0.08, 0.06), mat(c[2], { metalness: 0.7, roughness: 0.3 }));
    bob.position.set(0.12, 0.35, 0.15);
    add(bob, g);
    root.add(g); layers.push(g);
  }
  // 3 Escapement
  {
    const g = L(3, def.layers[3].term);
    const esc = new THREE.Mesh(box(0.14, 0.1, 0.08), mat(c[3], { metalness: 0.55, roughness: 0.4 }));
    esc.position.set(0, -0.25, 0.1);
    add(esc, g);
    root.add(g); layers.push(g);
  }
  // 4 Mainspring coil
  {
    const g = L(4, def.layers[4].term);
    const spring = new THREE.Mesh(tor(0.08, 0.02, 6, 20), mat(c[4], { metalness: 0.7, roughness: 0.3 }));
    spring.position.set(0, -0.3, 0);
    add(spring, g);
    root.add(g); layers.push(g);
  }
  // 5 Winding key
  {
    const g = L(5, def.layers[5].term);
    const key = new THREE.Mesh(cyl(0.025, 0.025, 0.2, 8), mat(c[5], { metalness: 0.8, roughness: 0.25 }));
    key.rotation.z = Math.PI / 2;
    key.position.set(0.25, -0.3, 0);
    add(key, g);
    const handle = new THREE.Mesh(box(0.04, 0.02, 0.1), mat(c[5], { metalness: 0.8 }));
    handle.position.set(0.35, -0.3, 0);
    add(handle, g);
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildMusicBox(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  // 0 Comb teeth row (with subtle box frame as part of comb presentation)
  {
    const g = L(0, def.layers[0].term);
    const frame = new THREE.Mesh(box(0.9, 0.12, 0.5), mat(0x5a3a1a, { roughness: 0.7 }));
    frame.position.y = -0.15;
    add(frame, g);
    for (let i = 0; i < 12; i++) {
      const tooth = new THREE.Mesh(box(0.04, 0.02 + i * 0.008, 0.18), mat(c[0], { metalness: 0.7, roughness: 0.35 }));
      tooth.position.set(-0.4 + i * 0.07, 0.02, -0.05);
      add(tooth, g);
    }
    root.add(g); layers.push(g);
  }
  // 1 Pinned cylinder
  {
    const g = L(1, def.layers[1].term);
    const drum = new THREE.Mesh(cyl(0.12, 0.12, 0.7, 16), mat(c[1], { metalness: 0.55, roughness: 0.4 }));
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0, 0.05, 0.12);
    add(drum, g);
    for (let i = 0; i < 16; i++) {
      const pin = new THREE.Mesh(cyl(0.008, 0.008, 0.04, 4), mat(c[1], { metalness: 0.7 }));
      const a = (i / 16) * Math.PI * 2;
      pin.position.set((i % 8 - 3.5) * 0.07, 0.05 + Math.cos(a) * 0.12, 0.12 + Math.sin(a) * 0.12);
      add(pin, g);
    }
    root.add(g); layers.push(g);
  }
  // 2 Mainspring
  {
    const g = L(2, def.layers[2].term);
    const spring = new THREE.Mesh(tor(0.09, 0.025, 6, 18), mat(c[2], { metalness: 0.7, roughness: 0.3 }));
    spring.position.set(-0.3, -0.05, 0.1);
    add(spring, g);
    root.add(g); layers.push(g);
  }
  // 3 Governor
  {
    const g = L(3, def.layers[3].term);
    for (const s of [-1, 1]) {
      const blade = new THREE.Mesh(box(0.12, 0.02, 0.04), mat(c[3], { metalness: 0.5, roughness: 0.4 }));
      blade.position.set(0.3, 0.05, s * 0.06);
      add(blade, g);
    }
    root.add(g); layers.push(g);
  }
  // 4 Key
  {
    const g = L(4, def.layers[4].term);
    const key = new THREE.Mesh(cyl(0.02, 0.02, 0.25, 8), mat(c[4], { metalness: 0.8 }));
    key.rotation.z = Math.PI / 2;
    key.position.set(0.45, -0.05, 0);
    add(key, g);
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildNautilus(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  // spiral approx helper
  const spiralPts = (scale, turns = 2.2) => {
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      const ang = t * Math.PI * 2 * turns;
      const r = 0.08 + t * 0.42 * scale;
      pts.push(new THREE.Vector3(Math.cos(ang) * r, (t - 0.5) * 0.1, Math.sin(ang) * r));
    }
    return pts;
  };
  // 0 Periostracum
  {
    const g = L(0, def.layers[0].term);
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiralPts(1.05)), 48, 0.12, 8, false), mat(c[0], { roughness: 0.7 })), g);
    root.add(g); layers.push(g);
  }
  // 1 Prismatic
  {
    const g = L(1, def.layers[1].term);
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiralPts(0.95)), 40, 0.1, 8, false), mat(c[1], { roughness: 0.65 })), g);
    root.add(g); layers.push(g);
  }
  // 2 Nacre
  {
    const g = L(2, def.layers[2].term);
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiralPts(0.85)), 40, 0.08, 8, false), mat(c[2], { roughness: 0.25, metalness: 0.35 })), g);
    root.add(g); layers.push(g);
  }
  // 3 Living chamber — larger end bulb
  {
    const g = L(3, def.layers[3].term);
    const chamber = new THREE.Mesh(sph(0.22, 14, 10, false), mat(c[3], { roughness: 0.5, opacity: 0.75, transparent: true }));
    chamber.position.set(0.35, 0, 0.1);
    add(chamber, g);
    root.add(g); layers.push(g);
  }
  // 4 Septum segments
  {
    const g = L(4, def.layers[4].term);
    for (let i = 0; i < 6; i++) {
      const t = 0.2 + i * 0.12;
      const ang = t * Math.PI * 2 * 2.2;
      const r = 0.08 + t * 0.42 * 0.7;
      const wall = new THREE.Mesh(new THREE.CircleGeometry(0.08 - i * 0.008, 12), mat(c[4], { roughness: 0.55 }));
      wall.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
      wall.lookAt(0, 0, 0);
      add(wall, g);
    }
    root.add(g); layers.push(g);
  }
  // 5 Siphuncle tube
  {
    const g = L(5, def.layers[5].term);
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiralPts(0.55, 2.0)), 32, 0.015, 5, false), mat(c[5], { roughness: 0.5 })), g);
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildPadlock(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  // NOTE: data order is Shackle, Body, Cylinder, Key Pins, Driver Pins, Springs
  // 0 Shackle U
  {
    const g = L(0, def.layers[0].term);
    const sh = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 16, Math.PI), mat(c[0], { metalness: 0.8, roughness: 0.3 }));
    sh.position.y = 0.35;
    sh.rotation.z = Math.PI;
    add(sh, g);
    root.add(g); layers.push(g);
  }
  // 1 Body
  {
    const g = L(1, def.layers[1].term);
    add(new THREE.Mesh(box(0.55, 0.55, 0.28), mat(c[1], { metalness: 0.55, roughness: 0.4 })), g);
    root.add(g); layers.push(g);
  }
  // 2 Cylinder
  {
    const g = L(2, def.layers[2].term);
    const cylm = new THREE.Mesh(cyl(0.1, 0.1, 0.22, 16), mat(c[2], { metalness: 0.6, roughness: 0.35 }));
    cylm.rotation.x = Math.PI / 2;
    cylm.position.set(0, -0.05, 0.08);
    add(cylm, g);
    root.add(g); layers.push(g);
  }
  // 3 Key pins
  {
    const g = L(3, def.layers[3].term);
    for (let i = 0; i < 5; i++) {
      const pin = new THREE.Mesh(cyl(0.015, 0.015, 0.06 + (i % 3) * 0.02, 6), mat(c[3], { metalness: 0.5, roughness: 0.4 }));
      pin.position.set(-0.08 + i * 0.04, -0.02, 0.05);
      add(pin, g);
    }
    root.add(g); layers.push(g);
  }
  // 4 Driver pins
  {
    const g = L(4, def.layers[4].term);
    for (let i = 0; i < 5; i++) {
      const pin = new THREE.Mesh(cyl(0.015, 0.015, 0.05, 6), mat(c[4], { metalness: 0.45, roughness: 0.4 }));
      pin.position.set(-0.08 + i * 0.04, 0.06, 0.05);
      add(pin, g);
    }
    root.add(g); layers.push(g);
  }
  // 5 Springs
  {
    const g = L(5, def.layers[5].term);
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(tor(0.015, 0.005, 4, 8), mat(c[5], { metalness: 0.7, roughness: 0.3 }));
      s.position.set(-0.08 + i * 0.04, 0.12, 0.05);
      add(s, g);
    }
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildPiano(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  // Monument-scale parts kept compact in local units (outer scale applies)
  // 0 Case — grand-ish wing shape via boxes
  {
    const g = L(0, def.layers[0].term);
    const body = new THREE.Mesh(box(2.2, 0.55, 1.3), mat(c[0], { roughness: 0.35, metalness: 0.15 }));
    body.position.set(0, 0.1, 0);
    add(body, g);
    const wing = new THREE.Mesh(box(1.0, 0.5, 0.9), mat(c[0], { roughness: 0.35, metalness: 0.15 }));
    wing.position.set(0.6, 0.1, -0.2);
    add(wing, g);
    root.add(g); layers.push(g);
  }
  // 1 Soundboard
  {
    const g = L(1, def.layers[1].term);
    const sb = new THREE.Mesh(box(1.8, 0.04, 1.0), mat(c[1], { roughness: 0.6 }));
    sb.position.set(0.1, 0.28, 0);
    add(sb, g);
    root.add(g); layers.push(g);
  }
  // 2 Bridges
  {
    const g = L(2, def.layers[2].term);
    for (const z of [-0.25, 0.2]) {
      const br = new THREE.Mesh(box(1.5, 0.05, 0.06), mat(c[2], { roughness: 0.55 }));
      br.position.set(0.1, 0.32, z);
      add(br, g);
    }
    root.add(g); layers.push(g);
  }
  // 3 Strings
  {
    const g = L(3, def.layers[3].term);
    for (let i = 0; i < 18; i++) {
      const s = new THREE.Mesh(cyl(0.006, 0.006, 1.4, 4), mat(c[3], { metalness: 0.85, roughness: 0.25 }));
      s.rotation.z = Math.PI / 2;
      s.position.set(0.1, 0.36, -0.4 + i * 0.045);
      add(s, g);
    }
    root.add(g); layers.push(g);
  }
  // 4 Hammers row
  {
    const g = L(4, def.layers[4].term);
    for (let i = 0; i < 12; i++) {
      const h = new THREE.Mesh(box(0.04, 0.03, 0.08), mat(c[4], { roughness: 0.7 }));
      h.position.set(-0.7, 0.2, -0.3 + i * 0.05);
      add(h, g);
    }
    root.add(g); layers.push(g);
  }
  // 5 Dampers
  {
    const g = L(5, def.layers[5].term);
    for (let i = 0; i < 12; i++) {
      const d = new THREE.Mesh(box(0.03, 0.04, 0.05), mat(c[5], { roughness: 0.85 }));
      d.position.set(-0.55, 0.34, -0.3 + i * 0.05);
      add(d, g);
    }
    root.add(g); layers.push(g);
  }
  // 6 Action
  {
    const g = L(6, def.layers[6].term);
    for (let i = 0; i < 10; i++) {
      const lev = new THREE.Mesh(box(0.2, 0.015, 0.03), mat(c[6], { roughness: 0.6 }));
      lev.position.set(-0.85, 0.12, -0.25 + i * 0.05);
      add(lev, g);
    }
    root.add(g); layers.push(g);
  }
  // 7 Keys
  {
    const g = L(7, def.layers[7].term);
    for (let i = 0; i < 14; i++) {
      const white = new THREE.Mesh(box(0.22, 0.03, 0.04), mat(c[7], { roughness: 0.45 }));
      white.position.set(-1.0, 0.02, -0.3 + i * 0.045);
      add(white, g);
      if (i % 2 === 0 && i < 13) {
        const black = new THREE.Mesh(box(0.12, 0.04, 0.025), mat(0x111111, { roughness: 0.4 }));
        black.position.set(-0.95, 0.04, -0.3 + i * 0.045 + 0.022);
        add(black, g);
      }
    }
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildPineCone(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  // 0 Axis
  {
    const g = L(0, def.layers[0].term);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.95, 10), mat(c[0], { roughness: 0.8 })), g);
    root.add(g); layers.push(g);
  }
  // 1 Ovuliferous scales — overlapping plates
  {
    const g = L(1, def.layers[1].term);
    let n = 0;
    for (let row = 0; row < 7; row++) {
      const y = 0.4 - row * 0.12;
      const rad = 0.12 + row * 0.04;
      const count = 6 + row;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + row * 0.35;
        const sc = new THREE.Mesh(box(0.1, 0.02, 0.14), mat(c[1], { roughness: 0.85 }));
        sc.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad);
        sc.lookAt(0, y - 0.2, 0);
        add(sc, g);
        n++;
        if (n > 48) break;
      }
    }
    root.add(g); layers.push(g);
  }
  // 2 Bract scales — thinner under
  {
    const g = L(2, def.layers[2].term);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const sc = new THREE.Mesh(box(0.06, 0.01, 0.1), mat(c[2], { roughness: 0.8 }));
      sc.position.set(Math.cos(a) * 0.18, 0.05, Math.sin(a) * 0.18);
      add(sc, g);
    }
    root.add(g); layers.push(g);
  }
  // 3 Seeds
  {
    const g = L(3, def.layers[3].term);
    for (let i = 0; i < 8; i++) {
      const seed = new THREE.Mesh(sph(0.03, 8, 6, false), mat(c[3], { roughness: 0.6 }));
      const a = (i / 8) * Math.PI * 2;
      seed.position.set(Math.cos(a) * 0.14, 0.0, Math.sin(a) * 0.14);
      add(seed, g);
    }
    root.add(g); layers.push(g);
  }
  // 4 Wings
  {
    const g = L(4, def.layers[4].term);
    for (let i = 0; i < 8; i++) {
      const wing = new THREE.Mesh(box(0.08, 0.005, 0.04), mat(c[4], { roughness: 0.5, opacity: 0.8, transparent: true }));
      const a = (i / 8) * Math.PI * 2;
      wing.position.set(Math.cos(a) * 0.2, 0.02, Math.sin(a) * 0.2);
      add(wing, g);
    }
    root.add(g); layers.push(g);
  }
  // 5 Umbo tips
  {
    const g = L(5, def.layers[5].term);
    for (let i = 0; i < 10; i++) {
      const u = new THREE.Mesh(sph(0.02, 6, 5, false), mat(c[5], { roughness: 0.7 }));
      const a = (i / 10) * Math.PI * 2;
      u.position.set(Math.cos(a) * 0.28, 0.15, Math.sin(a) * 0.28);
      add(u, g);
    }
    root.add(g); layers.push(g);
  }
  // 6 Resin ducts — thin tubes on axis
  {
    const g = L(6, def.layers[6].term);
    for (let i = 0; i < 4; i++) {
      const d = new THREE.Mesh(cyl(0.01, 0.01, 0.5, 5), mat(c[6], { roughness: 0.4, metalness: 0.1 }));
      d.position.set((i - 1.5) * 0.03, 0, 0.02);
      add(d, g);
    }
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildPitcherPlant(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  // 0 Operculum lid
  {
    const g = L(0, def.layers[0].term);
    const lid = new THREE.Mesh(sph(0.22, 12, 10, false), mat(c[0], { roughness: 0.55 }));
    lid.scale.set(1.2, 0.35, 1);
    lid.position.set(0.05, 0.55, 0);
    add(lid, g);
    root.add(g); layers.push(g);
  }
  // 1 Peristome rim
  {
    const g = L(1, def.layers[1].term);
    const rim = new THREE.Mesh(tor(0.22, 0.04, 8, 20), mat(c[1], { roughness: 0.45 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.4;
    add(rim, g);
    root.add(g); layers.push(g);
  }
  // 2 Waxy zone — upper cylinder
  {
    const g = L(2, def.layers[2].term);
    const w = new THREE.Mesh(cyl(0.22, 0.2, 0.35, 16), mat(c[2], { roughness: 0.25, metalness: 0.1 }));
    w.position.y = 0.2;
    add(w, g);
    root.add(g); layers.push(g);
  }
  // 3 Digestive zone
  {
    const g = L(3, def.layers[3].term);
    const d = new THREE.Mesh(cyl(0.2, 0.28, 0.35, 16), mat(c[3], { roughness: 0.6 }));
    d.position.y = -0.12;
    add(d, g);
    root.add(g); layers.push(g);
  }
  // 4 Fluid
  {
    const g = L(4, def.layers[4].term);
    const fluid = new THREE.Mesh(cyl(0.16, 0.16, 0.12, 12), mat(c[4], { roughness: 0.2, opacity: 0.55, transparent: true }));
    fluid.position.y = -0.22;
    add(fluid, g);
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildPocketWatch(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  // 0 Case
  {
    const g = L(0, def.layers[0].term);
    add(new THREE.Mesh(cyl(0.5, 0.5, 0.18, 32), mat(c[0], { metalness: 0.75, roughness: 0.3 })), g);
    root.add(g); layers.push(g);
  }
  // 1 Crystal
  {
    const g = L(1, def.layers[1].term);
    const cr = new THREE.Mesh(new THREE.CircleGeometry(0.45, 32), mat(c[1], { roughness: 0.1, opacity: 0.35, transparent: true, metalness: 0.1 }));
    cr.rotation.x = -Math.PI / 2; cr.position.y = 0.1;
    add(cr, g);
    root.add(g); layers.push(g);
  }
  // 2 Dial
  {
    const g = L(2, def.layers[2].term);
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.4, 32), mat(c[2], { roughness: 0.7 }));
    dial.rotation.x = -Math.PI / 2; dial.position.y = 0.06;
    add(dial, g);
    root.add(g); layers.push(g);
  }
  // 3 Plates
  {
    const g = L(3, def.layers[3].term);
    for (let i = 0; i < 2; i++) {
      const pl = new THREE.Mesh(cyl(0.35, 0.35, 0.02, 24), mat(c[3], { metalness: 0.6, roughness: 0.35 }));
      pl.position.y = -0.02 - i * 0.04;
      add(pl, g);
    }
    root.add(g); layers.push(g);
  }
  // 4 Gear train
  {
    const g = L(4, def.layers[4].term);
    for (let i = 0; i < 4; i++) {
      const gear = new THREE.Mesh(cyl(0.08 - i * 0.01, 0.08 - i * 0.01, 0.03, 10), mat(c[4], { metalness: 0.65, roughness: 0.35 }));
      gear.position.set(-0.12 + i * 0.1, -0.05, 0.05);
      add(gear, g);
    }
    root.add(g); layers.push(g);
  }
  // 5 Mainspring
  {
    const g = L(5, def.layers[5].term);
    const spring = new THREE.Mesh(tor(0.1, 0.02, 6, 18), mat(c[5], { metalness: 0.7, roughness: 0.3 }));
    spring.position.set(0.15, -0.06, -0.05);
    add(spring, g);
    root.add(g); layers.push(g);
  }
  // 6 Balance wheel
  {
    const g = L(6, def.layers[6].term);
    const bal = new THREE.Mesh(tor(0.08, 0.015, 6, 16), mat(c[6], { metalness: 0.7, roughness: 0.3 }));
    bal.position.set(-0.15, -0.06, -0.08);
    add(bal, g);
    root.add(g); layers.push(g);
  }
  // 7 Hairspring
  {
    const g = L(7, def.layers[7].term);
    const hs = new THREE.Mesh(tor(0.05, 0.006, 4, 20), mat(c[7], { metalness: 0.75, roughness: 0.25 }));
    hs.position.set(-0.15, -0.06, -0.08);
    add(hs, g);
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildSeaUrchin(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  // 0 Spines (limited count for FPS)
  {
    const g = L(0, def.layers[0].term);
    const spineMat = mat(c[0], { roughness: 0.6 });
    for (let i = 0; i < 36; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / 36);
      const th = Math.PI * (1 + 5 ** 0.5) * i; // half-ish distribution
      const spine = new THREE.Mesh(cyl(0.015, 0.008, 0.35, 5), spineMat);
      const r = 0.35;
      const x = r * Math.sin(phi) * Math.cos(th);
      const y = r * Math.cos(phi);
      const z = Math.abs(r * Math.sin(phi) * Math.sin(th)); // bias to +Z half for cutaway
      spine.position.set(x, y, z);
      spine.lookAt(0, 0, 0);
      spine.rotateX(Math.PI / 2);
      add(spine, g);
    }
    root.add(g); layers.push(g);
  }
  // 1 Test
  {
    const g = L(1, def.layers[1].term);
    add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 1), mat(c[1], { roughness: 0.7 })), g);
    root.add(g); layers.push(g);
  }
  // 2 Tubercles
  {
    const g = L(2, def.layers[2].term);
    for (let i = 0; i < 16; i++) {
      const bump = new THREE.Mesh(sph(0.03, 6, 5, false), mat(c[2], { roughness: 0.65 }));
      const phi = (i / 16) * Math.PI;
      const th = i * 1.7;
      bump.position.setFromSphericalCoords(0.34, phi, th * 0.5);
      add(bump, g);
    }
    root.add(g); layers.push(g);
  }
  // 3 Tube feet
  {
    const g = L(3, def.layers[3].term);
    for (let i = 0; i < 10; i++) {
      const foot = new THREE.Mesh(cyl(0.015, 0.02, 0.12, 5), mat(c[3], { roughness: 0.5 }));
      const a = (i / 10) * Math.PI;
      foot.position.set(Math.cos(a) * 0.2, -0.3, Math.sin(a) * 0.2);
      add(foot, g);
    }
    root.add(g); layers.push(g);
  }
  // 4 Ampullae
  {
    const g = L(4, def.layers[4].term);
    for (let i = 0; i < 8; i++) {
      const amp = new THREE.Mesh(sph(0.025, 6, 5, false), mat(c[4], { roughness: 0.4, opacity: 0.8, transparent: true }));
      const a = (i / 8) * Math.PI;
      amp.position.set(Math.cos(a) * 0.15, -0.15, Math.sin(a) * 0.15);
      add(amp, g);
    }
    root.add(g); layers.push(g);
  }
  // 5 Aristotle lantern
  {
    const g = L(5, def.layers[5].term);
    for (let i = 0; i < 5; i++) {
      const tooth = new THREE.Mesh(box(0.04, 0.12, 0.03), mat(c[5], { roughness: 0.55 }));
      const a = (i / 5) * Math.PI * 2;
      tooth.position.set(Math.cos(a) * 0.05, -0.05, Math.sin(a) * 0.05);
      tooth.rotation.z = a;
      add(tooth, g);
    }
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildSparkPlug(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  // stacked cylinders top to bottom visually, but layers match def order
  // 0 Terminal
  {
    const g = L(0, def.layers[0].term);
    const t = new THREE.Mesh(cyl(0.06, 0.06, 0.12, 10), mat(c[0], { metalness: 0.8, roughness: 0.3 }));
    t.position.y = 0.55;
    add(t, g);
    root.add(g); layers.push(g);
  }
  // 1 Ceramic
  {
    const g = L(1, def.layers[1].term);
    const cer = new THREE.Mesh(cyl(0.12, 0.1, 0.45, 16), mat(c[1], { roughness: 0.35 }));
    cer.position.y = 0.25;
    add(cer, g);
    // ribs
    for (let i = 0; i < 4; i++) {
      const rib = new THREE.Mesh(cyl(0.14, 0.14, 0.03, 16), mat(c[1], { roughness: 0.35 }));
      rib.position.y = 0.35 - i * 0.08;
      add(rib, g);
    }
    root.add(g); layers.push(g);
  }
  // 2 Steel shell
  {
    const g = L(2, def.layers[2].term);
    const shell = new THREE.Mesh(cyl(0.16, 0.14, 0.35, 12), mat(c[2], { metalness: 0.7, roughness: 0.35 }));
    shell.position.y = -0.1;
    add(shell, g);
    root.add(g); layers.push(g);
  }
  // 3 Gasket
  {
    const g = L(3, def.layers[3].term);
    const gas = new THREE.Mesh(tor(0.15, 0.02, 6, 16), mat(c[3], { roughness: 0.6 }));
    gas.rotation.x = Math.PI / 2;
    gas.position.y = 0.05;
    add(gas, g);
    root.add(g); layers.push(g);
  }
  // 4 Center electrode
  {
    const g = L(4, def.layers[4].term);
    const el = new THREE.Mesh(cyl(0.025, 0.025, 0.5, 8), mat(c[4], { metalness: 0.85, roughness: 0.25 }));
    el.position.y = -0.2;
    add(el, g);
    root.add(g); layers.push(g);
  }
  // 5 Ground electrode hook
  {
    const g = L(5, def.layers[5].term);
    const hook = new THREE.Mesh(box(0.04, 0.02, 0.1), mat(c[5], { metalness: 0.7, roughness: 0.35 }));
    hook.position.set(0.05, -0.42, 0);
    add(hook, g);
    const tip = new THREE.Mesh(box(0.08, 0.02, 0.02), mat(c[5], { metalness: 0.7 }));
    tip.position.set(0.02, -0.42, 0);
    add(tip, g);
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildVenusFlytrap(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  // 0 Petiole
  {
    const g = L(0, def.layers[0].term);
    const pet = new THREE.Mesh(box(0.2, 0.05, 0.55), mat(c[0], { roughness: 0.7 }));
    pet.position.set(0, -0.15, -0.2);
    add(pet, g);
    root.add(g); layers.push(g);
  }
  // 1 Lobes — two halves
  {
    const g = L(1, def.layers[1].term);
    for (const s of [-1, 1]) {
      const lobe = new THREE.Mesh(sph(0.28, 12, 10, false), mat(c[1], { roughness: 0.55 }));
      lobe.scale.set(0.7, 0.25, 1);
      lobe.position.set(s * 0.12, 0.1, 0.1);
      lobe.rotation.z = s * 0.4;
      add(lobe, g);
    }
    root.add(g); layers.push(g);
  }
  // 2 Midrib
  {
    const g = L(2, def.layers[2].term);
    const mid = new THREE.Mesh(cyl(0.02, 0.02, 0.45, 8), mat(c[2], { roughness: 0.6 }));
    mid.rotation.x = Math.PI / 2;
    mid.position.set(0, 0.08, 0.1);
    add(mid, g);
    root.add(g); layers.push(g);
  }
  // 3 Cilia spikes
  {
    const g = L(3, def.layers[3].term);
    for (let i = 0; i < 14; i++) {
      const cil = new THREE.Mesh(cyl(0.008, 0.004, 0.12, 4), mat(c[3], { roughness: 0.5 }));
      const side = i < 7 ? -1 : 1;
      const k = i % 7;
      cil.position.set(side * 0.22, 0.12 + k * 0.01, -0.05 + k * 0.06);
      cil.rotation.z = side * 0.6;
      add(cil, g);
    }
    root.add(g); layers.push(g);
  }
  // 4 Trigger hairs
  {
    const g = L(4, def.layers[4].term);
    for (let i = 0; i < 6; i++) {
      const hair = new THREE.Mesh(cyl(0.005, 0.003, 0.08, 4), mat(c[4], { roughness: 0.45 }));
      hair.position.set((i % 2) * 0.08 - 0.04, 0.14, 0.05 + (i % 3) * 0.06);
      add(hair, g);
    }
    root.add(g); layers.push(g);
  }
  // 5 Digestive glands
  {
    const g = L(5, def.layers[5].term);
    for (let i = 0; i < 12; i++) {
      const gl = new THREE.Mesh(sph(0.015, 6, 5, false), mat(c[5], { roughness: 0.4 }));
      gl.position.set((i % 4) * 0.05 - 0.08, 0.1, 0.02 + Math.floor(i / 4) * 0.06);
      add(gl, g);
    }
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildViolin(def) {
  const root = new THREE.Group();
  const c = colors(def);
  const layers = [];
  // 0 Belly (top plate)
  {
    const g = L(0, def.layers[0].term);
    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 6, 12), mat(c[0], { roughness: 0.5 }));
    belly.scale.set(1, 1, 0.35);
    belly.position.y = 0.12;
    add(belly, g);
    root.add(g); layers.push(g);
  }
  // 1 Bass bar
  {
    const g = L(1, def.layers[1].term);
    const bar = new THREE.Mesh(box(0.04, 0.5, 0.03), mat(c[1], { roughness: 0.6 }));
    bar.position.set(-0.1, 0.05, 0);
    add(bar, g);
    root.add(g); layers.push(g);
  }
  // 2 Soundpost
  {
    const g = L(2, def.layers[2].term);
    const post = new THREE.Mesh(cyl(0.02, 0.02, 0.22, 8), mat(c[2], { roughness: 0.55 }));
    post.position.set(0.1, 0.0, 0);
    add(post, g);
    root.add(g); layers.push(g);
  }
  // 3 Back
  {
    const g = L(3, def.layers[3].term);
    const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 6, 12), mat(c[3], { roughness: 0.5 }));
    back.scale.set(1, 1, 0.35);
    back.position.y = -0.12;
    add(back, g);
    root.add(g); layers.push(g);
  }
  // 4 Ribs
  {
    const g = L(4, def.layers[4].term);
    const ribs = new THREE.Mesh(cyl(0.24, 0.24, 0.55, 20, 1, true), mat(c[4], { roughness: 0.55, side: THREE.DoubleSide }));
    ribs.scale.set(1, 1, 0.85);
    ribs.rotation.x = Math.PI / 2;
    add(ribs, g);
    root.add(g); layers.push(g);
  }
  // 5 Cavity
  {
    const g = L(5, def.layers[5].term);
    const cav = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.4, 4, 10), mat(c[5], { roughness: 0.4, opacity: 0.35, transparent: true }));
    cav.scale.set(0.9, 0.9, 0.5);
    add(cav, g);
    root.add(g); layers.push(g);
  }
  return finish(root, def, layers);
}

function buildGeneric(def) {
  const root = new THREE.Group();
  const layers = [];
  const n = def.layers.length;
  for (let i = 0; i < n; i++) {
    const g = L(i, def.layers[i].term);
    const t = 1 - i / n;
    add(new THREE.Mesh(sph(0.2 + t * 0.35, 20, 14), mat(def.layers[i].color, { roughness: 0.55 })), g);
    root.add(g);
    layers.push(g);
  }
  return finish(root, def, layers);
}

const BUILDERS = {
  alkaline_aa: buildAlkalineAA,
  baseball: buildBaseball,
  bird_egg: buildBirdEgg,
  coconut: buildCoconut,
  compass: buildCompass,
  dc_motor: buildDcMotor,
  harmonica: buildHarmonica,
  hornet_nest: buildHornetNest,
  magic_8ball: buildMagic8Ball,
  metronome: buildMetronome,
  music_box: buildMusicBox,
  nautilus: buildNautilus,
  padlock: buildPadlock,
  piano: buildPiano,
  pine_cone: buildPineCone,
  pitcher_plant: buildPitcherPlant,
  pocket_watch: buildPocketWatch,
  sea_urchin: buildSeaUrchin,
  spark_plug: buildSparkPlug,
  venus_flytrap: buildVenusFlytrap,
  violin: buildViolin,
};

export function buildLayerShells(def) {
  const fn = BUILDERS[def.id] || buildGeneric;
  return fn(def);
}

export function buildPedestal(color = 0x5d4037) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(cyl(0.35, 0.4, 0.15, 16), mat(color, { roughness: 0.7 }));
  base.position.y = 0.075;
  const col = new THREE.Mesh(cyl(0.12, 0.16, 0.7, 12), mat(0xc9a227, { metalness: 0.6, roughness: 0.3 }));
  col.position.y = 0.5;
  const top = new THREE.Mesh(cyl(0.32, 0.3, 0.08, 16), mat(color, { roughness: 0.6 }));
  top.position.y = 0.89;
  g.add(base, col, top);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material) {
        o.material.clippingPlanes = [];
      }
    }
  });
  return g;
}
