import * as THREE from "three";

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.15,
    transparent: !!opts.opacity && opts.opacity < 1,
    opacity: opts.opacity ?? 1,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    side: opts.side ?? THREE.FrontSide,
  });
}

export function buildLayerShells(def) {
  const root = new THREE.Group();
  root.name = def.id;
  const layers = [];
  const n = def.layers.length;
  for (let i = 0; i < n; i++) {
    const L = def.layers[i];
    const t = 1 - i / n;
    const mesh = shapeMesh(def.shape, L.color, t, i === 0);
    mesh.userData.layerIndex = i;
    mesh.userData.term = L.term;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    layers.push(mesh);
  }
  root.scale.setScalar(def.scale || 0.5);
  root.userData.objectId = def.id;
  root.userData.layers = layers;
  root.userData.def = def;
  return root;
}

function shapeMesh(shape, color, t, isOuter) {
  let geo;
  const s = 0.35 + t * 0.65;
  switch (shape) {
    case "egg":
      geo = new THREE.SphereGeometry(0.55 * s, 24, 18);
      geo.scale(0.85, 1.15, 0.85);
      break;
    case "nest":
      geo = new THREE.SphereGeometry(0.6 * s, 20, 16);
      geo.scale(1.1, 0.85, 1.1);
      break;
    case "spiral":
      geo = new THREE.TorusGeometry(0.35 * s, 0.18 * s, 12, 32);
      break;
    case "urchin":
      geo = new THREE.IcosahedronGeometry(0.55 * s, 1);
      break;
    case "cylinder":
      geo = new THREE.CylinderGeometry(0.22 * s, 0.22 * s, 0.9 * s, 24);
      break;
    case "watch":
      geo = new THREE.CylinderGeometry(0.5 * s, 0.5 * s, 0.18 * s, 32);
      break;
    case "compass":
      geo = new THREE.CylinderGeometry(0.55 * s, 0.55 * s, 0.2 * s, 32);
      break;
    case "flytrap":
      geo = new THREE.ConeGeometry(0.45 * s, 0.7 * s, 8);
      break;
    case "cone":
      geo = new THREE.ConeGeometry(0.4 * s, 0.9 * s, 10);
      break;
    case "pitcher":
      geo = new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 0.9 * s, 16);
      break;
    case "sparkplug":
      geo = new THREE.CylinderGeometry(0.18 * s, 0.22 * s, 1.0 * s, 12);
      break;
    case "motor":
      geo = new THREE.CylinderGeometry(0.4 * s, 0.4 * s, 0.7 * s, 24);
      break;
    case "padlock":
      geo = new THREE.BoxGeometry(0.55 * s, 0.7 * s, 0.35 * s);
      break;
    case "metronome":
      geo = new THREE.ConeGeometry(0.45 * s, 1.0 * s, 4);
      break;
    case "box":
      geo = new THREE.BoxGeometry(0.8 * s, 0.35 * s, 0.55 * s);
      break;
    case "harmonica":
      geo = new THREE.BoxGeometry(0.9 * s, 0.25 * s, 0.3 * s);
      break;
    case "violin":
      geo = new THREE.CapsuleGeometry(0.22 * s, 0.7 * s, 6, 12);
      break;
    case "piano":
      geo = new THREE.BoxGeometry(2.4 * s, 0.9 * s, 1.4 * s);
      break;
    default:
      geo = new THREE.SphereGeometry(0.55 * s, 28, 20);
  }
  const m = mat(color, {
    roughness: isOuter ? 0.4 : 0.65,
    metalness: isOuter ? 0.25 : 0.05,
    opacity: isOuter ? 1 : 0.95,
  });
  return new THREE.Mesh(geo, m);
}

export function buildPedestal(color = 0x5d4037) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.4, 0.15, 16),
    mat(color, { roughness: 0.7 })
  );
  base.position.y = 0.075;
  const col = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 0.7, 12),
    mat(0xc9a227, { metalness: 0.6, roughness: 0.3 })
  );
  col.position.y = 0.5;
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.3, 0.08, 16),
    mat(color, { roughness: 0.6 })
  );
  top.position.y = 0.89;
  g.add(base, col, top);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}
