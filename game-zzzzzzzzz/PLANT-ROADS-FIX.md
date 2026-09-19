# Plant roads + car Y — 2026-09-17 (drivefix5)

## Screenshot bug
Car hovered on a paper-thin dark strip; asphalt floated above wood floor (~y=0).

## Before → After (ground foyer)
| Value | Before | After |
|-------|--------|-------|
| Wood plank top | 0 | 0 |
| Path / apron plank Y | 0.06 | **0.0** |
| Asphalt top (ride) | 0.075 | **0.012** |
| Spawn apron mesh | Circle @ 0.072 (0 thick) | **Cylinder** top 0.012, bottom **-0.043** |
| CAR_SPAWN.y / wheel bottoms | 0.075 | **0.012** |
| Floor ribbon bottom | ~0.033 (air gap) | **≤ 0** (into planks) |
| Wheel−asphalt gap | floated visually | **0** |

Landing/balcony path Y: 4.26/4.28 → **4.20** (deck top); ride = 4.212.

## Code
- `js/data/tracks.js` — plant path Y; `CAR_SPAWN.y=0.012`
- `js/drive/tracks.js` — `ASPHALT_RIDE/THICK_*`, thick spawn apron + lane dash, ribbonYLift, story floors
- `js/drive/car.js` — story ride heights
- Cache `?v=drivefix5`

## Sims
from-scratch, no-teleport, climb-collider, hostile, car-stuck, ramp-approach, wall-cruise — **PASS**

**Not claiming ready** — parent live-proves car wheels on foyer asphalt.
