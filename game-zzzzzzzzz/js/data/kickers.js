/**
 * logic13 KICKER RAMPS — short sprung jump ramps (≤30%) on open floor / lawn, each with a clear
 * landing run ahead. Axis-aligned; dir is the launch heading. base = the floor they stand on.
 */
const K = (id, x, z, dir, label, on = 0, base = 0, len = 0.5, rise = 0.14, w = 0.62, pop = 0) => ({ id, x, z, dir, label, on, base, len, rise, w, pop });
export const KICKERS = [
  // Front-lawn JUMP STRIP: three kickers in a row up the east lawn
  K("strip_1", 14.5, 21.0, "+z", "Jump Strip 1"),
  K("strip_2", 14.5, 24.0, "+z", "Jump Strip 2"),
  K("strip_3", 14.5, 27.0, "+z", "Jump Strip 3"),
  K("east_lawn", 22.0, 18.0, "+z", "East Lawn Kicker"),
  K("rose", -28.0, 4.0, "+z", "Rose Walk Kicker"),
  K("terrace", 0.0, -43.0, "-z", "Terrace Kicker"),
  K("hall", -1.6, -9.0, "-z", "Gallery Kicker", 0.05),   // stands on the runner rug
  K("armoury", 16.0, -9.0, "+x", "Armoury Kicker", 0.05), // on the armoury rug
  // logic15 ATTIC KICKERS — big sprung lips (pop) on the attic boards (y 8.4): ≥0.5 s of air
  K("attic_1", -4.6, -13.0, "+x", "Attic Kicker 1", 0, 8.4, 0.6, 0.17, 0.66, 1.5),
  K("attic_2", 3.0, -14.0, "+x", "Attic Kicker 2", 0, 8.4, 0.6, 0.17, 0.66, 1.5),
  K("attic_3", -6.0, -28.0, "+z", "Attic Kicker 3", 0, 8.4, 0.6, 0.17, 0.66, 1.5),
];
/** Kicker footprint + height at (x,z) (null outside). */
export function kickerBox(k) {
  const ax = k.dir[1] === "x", s = k.dir[0] === "+" ? 1 : -1;
  const hx = ax ? k.len / 2 : k.w / 2, hz = ax ? k.w / 2 : k.len / 2;
  return { minX: k.x - hx, maxX: k.x + hx, minZ: k.z - hz, maxZ: k.z + hz, ax, s };
}
export function kickerY(k, x, z) {
  const b = kickerBox(k);
  if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return null;
  const along = b.ax ? (x - k.x) * b.s : (z - k.z) * b.s; // −len/2 … +len/2
  return k.base + (k.on || 0) + k.rise * (along / k.len + 0.5);
}
