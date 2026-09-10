# Addictive Drive Circuit — want to keep driving (2026-09-09)

## Goal
Mario Kart / Driver / TM-rooftop feel: scenic continuous lap people want to **DRIVE AND DRIVE**.
Live gap was climb→roof; sims already green — this pass hardens **human** mount + cruise joy.

## What changed for “want to keep driving”

### 1. Human-friendly climb mount
- **Wider foot**: `ramp_foyer_to_landing` authored width 0.68→0.82 (post-scale ~1.27); spur 2.10→2.35; `RAMP_WIDTH_MULT` 1.72→1.78 / min 0.62.
- **Gentler first 20%**: `gentleStart` ease-in — first 20% of flat run carries ~9% of rise (grade ~0.11), then ~0.28 (still ≤0.30). Soft mount, not wall.
- **Brighter chevron**: climb asphalt + bold gold chevrons; ramp emissive ↑; foot beacon = large gold cone + glow pad + second chevron ahead; pulse brighter.
- **Stronger climb assist**: foyer ribbon corridor/continuity ↑; foot engage radius 2.85 m + bias bonus; lateral hold / yaw settle / Y-lock / rim fence stronger on foyer climb; `engageBack` 0.55→0.75.
- **Live aperture**: climb hole expanded (`minX/maxX/minZ/maxZ`) so imperfect weave never smashes slab lip; foyer climb corridor pierce widened through S-weave.

### 2. Scenic primary circuit
- Continuous lap: **foyer → climb → landing → balcony lap → return**.
- Wider readable asphalt: foyer_skirting, landing_skirting, balcony_loop, balcony ramps.
- Solid asphalt + clear lane markings retained; brass **portal frames** thicker + emissive gold + threshold lip (readable tunnels).

### 3. Handling cruise sweet spot
- Car: maxSpeed ~1.39, steerRate ~3.28, steer lerp 2.55, yaw-rate cap 2.28 — planted wander, not twitchy, not crawl.
- Yaw wrapped each step (long sessions stay stable).

### 4. Dead-ends / obstructing props on the line
- Umbrella stand moved off foyer_drive_start / climb T (SE corner).
- Near-flat balcony-return no longer steals eastbound landing lap; east balcony mount still engages when aimed.
- Primary enabled set stays one connected circuit from spawn (37 paths).

### 5. Sims (must pass)
- `hostile-climb-sim.mjs` — PASS (grade ≤0.30, connected, runway, noisy crest + balcony)
- `core-tour-sim.mjs` — CORE TOUR PASSED
- `ramp-approach-sim.mjs` / `ruthless-drive-diag.mjs` / `wall-cruise-sim.mjs` / `car-stuck-sim.mjs` — PASSED

## Hard specs held
| Spec | Result |
|------|--------|
| Max grade ≤ 30% | worst foyer climb maxG ≈ 0.285 |
| Single primary circuit | 37/37 connected from spawn |
| Approach runway | kiss 0.000, spurW ≈ 2.04 |
| Hostile crest + balcony | PASS |

## Archive
`/workspace/mansion-of-the-unseen.zip`
