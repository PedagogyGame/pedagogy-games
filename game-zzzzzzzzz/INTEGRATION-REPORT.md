# Explore ↔ Drive near-track integration report

**Date:** 2026-09-08 (America/Chicago)  
**Stack:** Three.js r160 WebGL (online-first at pedagogygame.com) — vendored static zip, no Phaser/PixiJS.

## Near-track Explore polish

| Corridor | Change |
|----------|--------|
| Hall of Echoes (east/west skirting) | Consoles **hug plaster** (`w/2 − 0.28`, depth 0.28) so the asphalt inset (~0.55–0.7 m) + Explore walk lane at \|x\|≈2.55 stay clear — no prop/collider theft |
| Doorways (foyer↔hall, hall↔cons, …) | `doorW` 2.7→**3.05**, baseboard `doorGap`→**3.1** — Explore capsule (r=0.38) clears doorway-edge Drive strips |
| Baseboard / road language | `bbH` 0.24→**0.22** — low foot reads next to asphalt y≈0.06 without flicker stacks |
| Mouse portals in Explore | Asphalt/rails hidden; **portal rings stay** (`setVisible("explore")`) with dimmed emissive — readable cues, mansion look preserved |
| Floors | Existing polygonOffset on slabs + asphalt retained; story-aware `getFloorY` unchanged |

Smoke: `Explore near-track walk lanes { laneFails: [], hallCleared: true }`  
Smoke: `Explore portal cues { portalVis: 106, asphaltVis: 0, portals: 53 }`

Objects/slice placements left as-is (no near-track pedestal walk blockers requiring moves).

## Ramp mount precision

Every **enabled** climb is designated in `RAMP_MOUNT_FEET` (`js/data/tracks.js`):

- `approach` — skirting/deck path of arrival  
- `foot` / `crest` XYZ  
- `engageBack: 0.08` — snap-priority band behind foot  
- `crestSoft: 0.12`  
- `climbFracs: [0.25, 0.5, 0.75]`

### Results (smoke + sims)

| Check | Result |
|-------|--------|
| Ramp pickup audit (33 ramps) | footFail **0**, climbFail **0** |
| Mount precision from designated approaches | mountFail **0** / 33 |
| `ramp-approach.mjs` PRIMARY | footFail **0**, progFail **0** |
| `car-phys-sim.mjs` | 11/11 OK, neverMounted 0, crashed 0 |
| Crest junction kiss vs nearest deck | **≤0.05 m** (softened `ramp_foyer_console_down`, `ramp_dining_down`, `ramp_library_down`) |
| Parallel skirting snap theft | unchanged priority rules; no new thieves |

Preserved: binary onTrack, under≠on, asphalt aesthetic, lag culls, `ROAD_WIDTH_SCALE` **0.87**.

## Integration notes

- Drive still reveals full ribbons; Explore parks the car and shows only mouse/flower portal hints.
- README + how-to-run: **online-first** pedagogygame.com; local/static zip still works via vendored three (not offline-only marketed).
- Prefer data/path tweaks + snap priority (done) over architecture rewrites.

## Smoke

```
node --import ./smoke-register.mjs smoke.mjs
→ ALL SMOKE CHECKS PASSED
```
