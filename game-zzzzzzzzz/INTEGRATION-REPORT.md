# Explore ↔ Drive near-track integration report

**Date:** 2026-09-08 (America/Chicago)  
**Stack:** Three.js r160 WebGL (online-first at pedagogygame.com) — vendored static zip, no Phaser/PixiJS.

## Drive stuck / furniture cage — real fix (2026-09-08)

**What was wrong:** Tiny RC car wedged between room walls and furniture bases (extruded tabletop AABBs + chairs) sat at ~0 km/h on wood floorboards; thin post-scale ribbons read as wires; dark ramp mats vanished on dark floors. Prior "fixed" zips claimed green without a stuck sandwich sim.

| Fix | Detail |
|-----|--------|
| Furniture tagging | `box.driveKind = "furniture"` from room furniture; tall wall consoles now get AABBs too |
| Drive soft colliders | `DriveMode._driveSoftCollider`: shrink XZ ~26%, raise min.y ~0.36 m — Explore keeps full boxes; walls stay hard |
| Auto-unstuck | Forward + off-ribbon stall/jam >0.6s → `findEscapeSnap` nudge onto visible onTrack asphalt |
| Thick asphalt | `FLOOR_WIDTH_MIN=0.52`, `DOOR_WIDTH_MIN=0.48`, `DECK_WIDTH_MIN=0.42` after scale |
| No ghost snaps | `visual:false` paths get **no** snap segments (flower connector included) |
| Readable ramps | Bright chevron asphalt mat + slight emissive (not black-on-wood stealth) |

### Honest sims

| Sim | Result |
|-----|--------|
| `car-stuck-sim.mjs` | foyer / hall / dining / landing wall+furniture wedges escape ≤3s; foyer→landing crest OK |
| `car-phys-sim.mjs` | 11/11 guided OK; hostile multi-climb (foyer, console, cornice link, dining, attic) PASSED |
| `smoke.mjs` | ALL SMOKE CHECKS PASSED (Explore lanes + binary onTrack + under≠on preserved) |

## Ramp climb — real-drive fix (earlier same day)

Ramp width boost, climb-only lateral hold, Y-lock 38, grade soften. Preserved: binary onTrack, under≠on, lag culls, Explore.

## Still might fail (honest)

- Hostile climbs can crest ~88–95% of rise with yaw bias (not exact XYZ kiss every time).
- Unstuck nudges to nearest thick asphalt — may briefly teleport ~1–2 m when caged deep in furniture clusters.
- `ramp-approach` still reports 2 secondary progFail samples (music sideboard / non-primary); primary mounts OK.
- Extremely narrow mouse tubes unchanged (intentional hollow runs, not floor asphalt).

## Smoke

```
node --import ./smoke-register.mjs smoke.mjs → ALL SMOKE CHECKS PASSED
node --import ./smoke-register.mjs car-stuck-sim.mjs → PASSED
node --import ./smoke-register.mjs car-phys-sim.mjs → 11/11 + HOSTILE multi-climb PASSED
```
