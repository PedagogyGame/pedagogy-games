# Workable Drive — polish pass (2026-09-16)

One thorough pass toward a finished, workable primary circuit. Not a redesign.

## What this pass fixed

### Circuit blockers (real AABB pins)
- **Landing ↔ library jamb leftovers**: `landing_skirting` Catmull fillet crossed library south leftover slabs (west + east) and scraped library west/east wall tips at z≈0. Added matching Drive portals on landing north / library south (center + west + east) and south-tip openings on library west/east walls.
- **Climb dual-wall at x≈−4**: hall_ground west climb tunnel existed, but **cabinet east** was a coplanar dual wall with only the cabinet/armoury door opening — imperfect steer (±0.45 m) still hit the cabinet slab mid-climb. Mirrored the full-story climb tunnel onto cabinet east; widened hall west climb aperture slightly south.
- **Landing skirting fillet nudge**: west/east points moved slightly clearer of jambs; library skirting kiss points synced.

### Chase cam
- Tightened open-road chase (back ~0.25→~0.20 base, less leisure push-out). Spawn chase distance ≈0.29 m (was ≈0.36). Autodrive-only UI unchanged.

### Climb dark pockets
- Added static mid-climb fill light (`drive_climb_mid_fill` at ≈(−3.55, 2.15, 4.6)); shown on Drive enter, hidden on exit/explore. Foot fill retained.

### Audio
- `EngineAudio.start` / resume paths wrapped so blocked/suspended `AudioContext` mutes cleanly — no throw on enter.

### Rails
- Stronger rail `polygonOffset` vs asphalt to reduce seam flicker at ribbon edges.

### Boot / debug
- Autodrive HUD/banner still **only** when `?autodrive=climb`. Normal Boot → Enter → Drive HUD = speed + vehicle picker.
- Cache-bust `index.html` → `?v=drivew2`.

## Intact (not regressed)
- Bank / grade split; upright caps (`VISUAL_BANK_MAX` etc.); planted climb throttle.
- Max grade ≤0.30 on enabled paths (worst foyer climb ≈0.297).
- Primary circuit connected from `foyer_drive_start` (37/37).
- Engine starts on Drive enter, stops on exit.

## Sims (all green this pass)
`smoke`, `ramp-approach-sim`, `hostile-climb-sim`, `core-tour-sim`, `wall-cruise-sim`, `full-update-climb`, `car-stuck-sim`.

Centerline sample (car-height band) on primary circuit after fix: **0 solid hits**. Climb lateral ±0.45 m: **0 hits**.

## Known remaining risks (honest)
- **Human steer off-ribbon**: walls beside the asphalt are still solid — leaving the ribbon into a room interior can bounce/pin (by design). Sims prove on-ribbon + hostile noise, not free roaming.
- **Grade near cap**: foyer climb ~29.7% — works planted, but slow crawl + heavy left/right on the upper S-weave can still feel sticky vs a flatter TM rooftop.
- **Audio policy**: first gesture must unlock AudioContext; if the browser blocks it, Drive is silent (no error spam).
- **Closer cam vs walls**: chase is tighter; in tight wall cavities rare near-clip is possible (in-wall mode still tucks closer with reduced FOV).
- **Secondary/disabled ribbons**: cornice furniture loops and many mouse tunnels remain disabled for primary-course clarity — not part of this spawn circuit.
- **Live Chrome vs Node**: sims use the same Drive update + wall grid; timing/dt clamp and GPU z-fight can still differ slightly in browser.
- **Landing furniture / attic stringers**: Drive softens stair/furniture AABBs; extreme off-line aim at attic stringers can still graze soft portals.

## Primary circuit (spawn lap)
`foyer_drive_start` → `foyer_climb_spur` → `ramp_foyer_to_landing` → `landing_skirting` → `ramp_landing_to_balcony` → `balcony_loop` → `ramp_balcony_return` → back on landing skirting.
