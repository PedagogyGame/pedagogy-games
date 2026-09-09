# Explore ↔ Drive near-track integration report

**Date:** 2026-09-09 (America/Chicago)  
**Stack:** Three.js r160 WebGL — vendored static zip.

## Core tour fix (2026-09-09) — UPPER + floor playable

**Priority:** floor cruise → foyer→landing→cornice → primary upper loop; disable void-dump islands.

| Fix | Detail |
|-----|--------|
| Floor asphalt | `FLOOR_WIDTH_MIN` 0.52 → **0.78** (halfW ≥0.39) |
| Floor ribbon hold | Soft lateral + yaw settle on floor/outdoor/flower when `onTrack` (ASSIST_MAGNET still false) |
| Primary loft links | `loft_landing_to_library` kissed to landing cornice; west twin; `loft_library_to_music`; shelf→music kiss |
| Study express | `ramp_study_express_down` to study floor (no 2m+ void dump) |
| Disabled islands | chandelier ring+ramp, loft_nursery, mid-air mice, chutes, loft→attic science ramp |

### Core tour numbers (`core-tour-sim.mjs`)

| Check | Result |
|-------|--------|
| Floor cruise 8s | **onRate=100%** falls=0 |
| foyer→landing crest | OK onRate=100% |
| landing→cornice crest | OK onRate=100% |
| cornice↔landing↔balcony↔return | OK falls=0 |
| Primary joins ≤0.15m | **12/12** d=0.000 |

### Other sims

| Sim | Result |
|-----|--------|
| `car-stuck-sim.mjs` | PASSED (5/5 + foyer crest) |
| `car-phys-sim.mjs` | 11/11 + HOSTILE multi-climb PASSED |
| `smoke.mjs` | ALL SMOKE CHECKS PASSED |

### Intentional remaining islands

- **Dining table furniture** (y≈0.98) — own on/off ramps; not on primary upper loop
- **Attic loft/science** — reachable via `attic_from_landing_access` from landing; not fused into landing cornice (Δy≈1.2m intentional)
- **Nursery loft** — disabled as secondary (strand risk)
- **Chandelier ring** — disabled (decorative void island)
- **Steep death traps** — `ramp_cabinet_down`, `ramp_study_express_to_cases`, `ramp_cornice_to_balcony` remain disabled

Preserved: climb hold, unstuck, visible-only asphalt, under≠on, lag culls, Explore.
