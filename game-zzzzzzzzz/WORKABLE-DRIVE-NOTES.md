# Workable Drive — solid / polish pass (2026-09-16)

Ben feedback pass: solids stay solid, car/audio/tracks not crap. Not claiming ready.

## Root cause — pillar ghosting
1. **Lantern posts tagged `furniture`** → `_driveSoftCollider` raised `min.y` by ~0.36 so car height band (~0–0.12) slipped under.
2. **Climb corridor pierce** treated thin walls (`min(bw,bd) < 0.55`) as aperture lips and dropped them — freestanding thin posts/columns ghosted.
3. **Gate pillars / hitching posts** had mesh only — **no Drive AABB**.

## Hard classification
- New `driveKind: "pillar"` — never soft-shrink, never raise, never climb-pierce.
- Lantern posts, hitching posts, gate pillars → `"pillar"`.
- Heuristic: tall skinny furniture (h≥1.2, maxXZ≤0.55) promoted to pillar in soft copy.
- Climb corridor pierces **only** `stair` / `furniture`. Walls + pillars always collide.
- Soft-slide still OK for furniture bases; pillars = hard bounce.

## Car / audio / tracks
- `_buildCar`: proper toy RC proportions (chassis, shell, greenhouse glass, wheel arches, tires) — not stacked candy boxes. Light SUV chassis tweak. Planted steer (friction/steer lerp/yaw cap).
- `engineAudio.js`: triangle/sine + brown rumble bed; no harsh saw; smooth RPM; quiet scrape; mute on Explore.
- Asphalt: richer dark grit + crisp white edges + clean yellow dashes. Dark steel continuous rails (not translucent beige/yellow beams). Smoother ramp-foot joins.

## Sims (green)
`smoke`, `ramp-approach-sim`, `hostile-climb-sim`, `core-tour-sim`, `wall-cruise-sim` (+ pillar penetration samples).

## Intact
≤30% grade, holes/tunnels, connected circuit, runway before feet, climb apertures, upright bank caps.
