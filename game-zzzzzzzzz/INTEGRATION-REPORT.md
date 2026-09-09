# Explore ↔ Drive near-track integration report

**Date:** 2026-09-09 (America/Chicago)  
**Stack:** Three.js r160 WebGL — vendored static zip.

## Drive course rebuild (2026-09-09) — V + triple-fork purge

**Priority:** continuous asphalt network; kill screenshot V-ramp + mid-air triple forks; solid roads.

### Path IDs disabled (decorative / undrivable ribbons)

mouse_dining_west_garden, mouse_dining_cornice_garden, mouse_foyer_cabinet_skirt, mouse_foyer_cabinet_mid, mouse_foyer_armoury_skirt, mouse_foyer_armoury_mid, mouse_hall_conservatory, mouse_dining_conservatory, mouse_cellar_ground_shaft, shaft_service_west, climb_cellar_to_hall, climb_hall_to_workshop, mouse_west_grand_run, mouse_east_grand_run, mouse_armoury_nursery_chase, mouse_cabinet_study_chase, mouse_hall_conservatory_mid, mouse_dining_hall_west, ramp_mouse_to_foyer_cornice, ramp_mouse_east_to_foyer_cornice  
(+ prior: chutes, chandelier, loft_nursery, mid-air mice already disabled)

### Geometry rewritten

| Site | Fix |
|------|-----|
| Foyer console triple | Cornice climb foot moved to west furniture T `(5.2,0.98,9.65)`; SE keeps floor→console only |
| Hall cornice 4-way | East T `@ (3.5,3.55,-22.5)`, west T `@ (-3.5,3.55,-22.5)`; music crest `@ (7.0,3.6,-22.55)` |
| Landing cornice triple | Climb crest T-joins east arm `(3.5,7.22,8.55)` |
| Music / cabinet triples | Cornice climbs leave west side of furniture loops |
| Workshop bench V | Smooth westward points (no 162° kink) |
| Solid asphalt | `DECK_WIDTH_MIN` 0.42→**0.52**; deck ribbons extruded slab (~5.5cm) |

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
| `drive-sim.mjs` tour | ok=true (foyer→console→cornice→landing→hall→conservatory→balcony) |

### Honest remaining limits

- Furniture on/off circuits (dining / workshop / nursery) still use up+loop+down — intentional Toy Story furniture tops, not mid-air ribbon forks
- Elev-only graph still has separate components (attic loft, balcony, dining table) bridged by floor/ramps in the full drive graph — attic via `attic_from_landing_access`, balcony via landing floor
- Closed-loop cornice hairpins can still show ~120–150° plan turns (not near-vertical V grades)
- Disabled mouse/shaft data retained for Explore lore / future re-enable; not drawn or snappable

Preserved: climb hold, unstuck, visible-only asphalt, under≠on, lag culls, Explore.
