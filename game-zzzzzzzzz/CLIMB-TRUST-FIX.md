# Climb trust fix — floating gold-pillar ribbon (2026-09-16)

Ben screenshot: paper-thin chevron strip floating mid-air, clipping a golden pillar, disconnected from the floor car. Not claiming Drive ready — parent live-proves first.

## Root cause
1. **Straighten pass** authored nearly-flat Y until a last-point jump, then aimed the centerline through foyer door-frame volume. Catmull + wide ribbon read as a hazard stripe punching gold portal jambs (visual-only meshes; hard AABBs were already clear — that is why earlier sims stayed green while Ben’s eye saw failure).
2. Gold jambs on **full-height climb tunnels** and the **landing→library crest portal** are non-colliding decor, so they never failed collider sims but produced the exact screenshot.

## Fix
- **Restored east-of-stair corridor** (foyer-drive family): foot `(-4.85, 0.06, 11.85)` → crest `(-3.55, 4.26, -2.10)` kissing `landing_skirting`.
- Gradual rise via `_softenRampGrades` (gentleStart); flat ≈14.15 m → mean grade ≈0.297 ≤0.30; turn ≈41° ≪100°; no spiral, no track teleport.
- Climb ribbon: authored width 0.95 → post-scale ≈**1.29 m**; ramp slab **0.112 m** asphalt deck; chevrons on top only.
- **Skip brass frames** on full-height climb openings + `noFrame` crest portals (landing N / library S / library W·E south tip) so gold posts cannot reappear in the climb lane.
- Story aperture / climbGap / hall ceiling punch retargeted to the restored corridor.
- Spur + landing_skirting + library west kiss updated.

## Why the screenshot cannot recur
- Path stays in the **open east-of-stair volume**, not through door-gold frames.
- The gold pillar class in the shot was **portal jamb decor** — those jambs are no longer spawned on climb/crest openings.
- Ribbon is a **thick asphalt deck** planted at foot Y=0.06 (first 8% of curve maxY≈0.41 — continuous mount, not a floating mid-air strip).
- `climb-collider-check.mjs` samples Catmull centerline + ±0.85·halfW at car height vs hard wall/pillar AABBs **and** remaining gold jamb meshes — must be zero hits before zip.

## Scale (intact)
CAR_SCALE **0.188**, ROAD_WIDTH_SCALE **0.80**.

## Sims (green this pass)
`smoke`, `no-teleport-sim`, `ramp-approach-sim`, `hostile-climb-sim`, `core-tour-sim`, `wall-cruise-sim`, `full-update-climb`, `car-stuck-sim`, `climb-collider-check`.

## Intact rules
No-teleport hysteresis, ≤30% grade, hard pillars, no auto jumps, connected primary circuit. Not claiming ready for Ben.
