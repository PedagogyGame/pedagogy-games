# POLISH-LOGIC3 — Drive polish pass (cache `?v=logic3`)

This is **not a ready claim**. Every number below comes from headless sims plus a few SwiftShader
screenshots. The parent still has to live-prove it in the browser.

Ben's hard specs are unchanged and re-verified:
- real holes and tunnels
- every segment ≤30%
- one connected open 8-path `PRIMARY_CIRCUIT`
- ≥2u solid runways
- walls and pillars are hard
- car stays planted
- house-scale car and lanes
- no teleports
- scenic stairs sit beside the climbs and are never road
- GPU-lite

Polish items #1, #2, #5, #6, #7, #8 and #9 are kept. No screech, no brake lights, no checkered start.

## Hidden defects found (the old sims never caught them) and why the layout moved
- **Climb A foot was a 180° reversal.** `foyer_to_climb_a` headed +Z to (−5, 12.7) and `climb_a` then headed −Z. `car.js` hid it by spinning the car's yaw (yawLim π).
- **Kiss tangents were broken at most junctions.** The turns were 108°, 180°, 90°, 54°, 73°, 90° and 116°.
- **The hairpin was blocked by a wall.** The library_hall south wall panel (x −3.25…−1.5, y 4.2–8.2) sat in the hairpin. A pursuit lap pinned there forever while the speed readout still said ~1.2.
- **Ground ceilings covered the first-floor road.** Ceiling slabs were centred on y=4.2, so their tops sat at 4.26: above the first-floor planks, the landing ribbon (4.212) and the car.
- **Wall tops were treated as walls.** Ground-wall tops at y=4.2 collided with a car driving at 4.212, because the collision band started at y−0.02.
- **Facade sill.** The facade had a 5 cm sill at the balcony doors (4.25).
- **Balcony path problems.** Balcony_arc crossed itself, and balcony_to_climb_b ran 0.6u beside it.
- **Decor and shelves on the lanes:**
  - the landing rug, plant, console, bench, lamp and armchair
  - the foyer console under Climb B, and a floor lamp poking through the Climb B deck
  - curtains 0.6u into the S/F lane, an umbrella stand on the lane
  - a pendant bulb hanging on the Climb A centreline
  - a library shelf in the crest corridor
- **Floor frame strips across the crest corridor.** Library floor-frame strips ran across it, and nursery/study floors plus cabinet/armoury ceilings roofed or floored over the climb strips.
- **Chase cam buried on climbs.** On a 29% climb it trailed **0.35u below the car**, inside the deck, so Climb A never showed the car.
- **0.55 cruise-floor snap.** Holding W jumped speed by 0.49 in a single frame.
- **Residual throttle after re-enter or respawn.** It caused creep and made the steering jerk 0.142 rad/s per frame.

Because of these, the layout itself was re-authored in `js/data/tracks.js`. This goes beyond a pure polish pass:
- tangent-continuous foot arcs off one S/F straight at z=11.4
- crest arcs, then tip flats, then the hairpin
- a balcony sweep out and back
- the Climb B apex U-turn

## Before → after numbers
| Metric | logic2 (before) | logic3 (after) |
|---|---|---|
| climb_a maxSeg (control pts) | 0.313 | **0.294** |
| climb_b maxSeg (control pts) | 0.313 | **0.294** |
| climb_a / climb_b maxSeg (rendered spline, 0.5u window) | ~0.313 | **0.2980 / 0.2981** |
| Kisses d (all 8) | 0 | **0.0000** |
| Kiss tangent turn (worst) | 180° | **10.8°** (balcony_to_climb_b→climb_b; others ≤0.3°) |
| Hairpin edge → newel collider box | ~0.19 (centre-based) / **−0.219** (honest box on spline) | **0.800** |
| Runway A / B before the ramp foot | 2.33 / 11.80 | **2.16 / 10.30** (both ≥2) |
| Track meshes | 37 | **27** (≤40). Chevrons and junction arrows are 2 InstancedMeshes |
| Hold-W speed step per frame (max) | 0.493 (snap) | **0.071** (0→1.38 in ~0.5 s, no dips) |
| Low-speed steer yaw-rate step | 0.142 | **0.042** |
| Chase cam height vs car on climb A (min) | **−0.350** (buried) | **+0.115** |
| Chase cam trail on climb vs flat | 1.26 vs 1.13 | 1.26 vs 1.13 (framing kept) |
| Full-story drive slots in walls | 15 | **0** |
| Drive-opening wall area (approx.) | ~441 m² | **~98 m²** (−78%) |

### Openings (along × height) — before → after
| Wall | logic2 | logic3 |
|---|---|---|
| foyer N | Climb A 3.9 + B 4.0 full story (0–4.22) | **top notches only**: A x −6.10…−2.95, B 3.30…8.10, y 3.55→top |
| hall_ground S | ±climb 3.9/4.0 full story (unused) | removed (centre door only) |
| hall_ground W | 4.2 full story | **notch** z −2.45…0.45, y 3.6→top |
| cabinet E / S | 4.2 / 3.9 full story | **notches** 2.55 / 2.5 wide, y 3.6 / 3.35→top |
| armoury S | 4.0 full story | **notch** x 3.95…8.45, y 3.35→top |
| landing N | door 3.0 + frameless climb slots 3.5 / 3.6 | **framed arch** x −5.1…1.5 and **framed portal** x 4.35…7.0, door height 3.35 + lintel |
| landing S | French 11.0 + climb portals 3.9 / 4.0 full story | French 11.3 (tunnel frame, no threshold lip across the lanes) |
| landing W / E | 12.0 full story each (Swiss cheese) | W: 2.6 framed stair arch. E: 7.5 framed gallery arch over the Climb B descent (the wall hangs over the B strip) |
| library S | door 3.0 + ghost slots | **framed arch** 5.3 + 0.7 corner portal |
| library W / E | 5.2 full story | **framed portals** 2.5 / 1.5, door height |
| nursery W / S | 7.0 / 4.0 full story | **framed portals** 1.55 / 2.25, door height |
| study E / S | 7.0 / 3.9 full story | solid (unused) |

Tunnel frames are brass jambs on the clipped edges plus a lintel. There is no threshold lip across the asphalt. Baseboards, rails, wainscot, wallpaper bands and wall panels now split around every floor-level opening, so nothing floats across an arch or lies on a ribbon edge.

## Drive-feel changes
- `car.js`: floor throttle ease 5.8 → 4.4/s. `setPose` clears `_throttleSmooth`, so there is no residual throttle after enter or respawn.
- `car.js`: the climb-foot "spin to uphill" hold is gone (yawLim π → 1.35, softer yawK and yawRate), because the feet are tangent-aligned now.
- `driveMode.js`: the cruise floor eases up at +1.8/s instead of snapping to 0.55.
- `driveMode.js`: the collision band is `y+0.02…y+0.12`, so tyres ride on flush wall tops.
- `driveMode.js`: chase cam gets vertical velocity feed-forward plus a floor at car.y+0.06. XZ trail is unchanged, so the approved framing and look-into-turn (#1) stay.
- `driveMode.js`: void warning (#7) now uses the outer side of the balcony loop, south of the facade.
- `driveMode.js`: `_nearFoyerClimbCorridor` matches the new feet and strips.
- Autodrive harness: poses on the circuit upstream of each climb (A on the runway, B on balcony_to_climb_b) and just follows the ribbon. There are no hard-coded aim points or yaw flips.
  - A PASS needs maxY ≥ 4.15, on=1 and no crash.
  - B PASS needs drop ≥ 4.0, on=1 and no crash.
  - Crash or freeze can never PASS.
- `drive/tracks.js` (kept from the earlier part of this pass):
  - per-path visual lift alternates +0.003 between circuit neighbours, so kisses don't z-fight
  - void bars became flush painted bands
  - curvature-based corner chevrons, instanced
  - 16 flat junction chevrons derived from the 8 kisses
  - one asphalt / edge-line style on all 8 paths

## Sims (all run headless with `node --import ./smoke-register.mjs <sim>`)
| Sim | Result |
|---|---|
| logic1-acceptance-sim | **ALL PASS** (25). Grade gate tightened to maxSeg ≤0.300 with no +0.02 allowance |
| from-scratch-drive-sims | **ALL PASS** (37). Climb A crest now needs 4.15 with on=100% |
| no-teleport-sim | **ALL PASS** (6). Apron probe moved beside the climb straight, since the old point is now on the A foot leg |
| climb-collider-check (±0.98·halfW, y+0.22/+0.48) | **PASS** A and B, 0 hard hits |
| full-update-climb (A autodrive) | **PASS** maxY=4.154, `on=1`, no crash |
| climb-b-autodrive-sim | **PASS** drop=4.007, `on=1`, no crash |
| smoke | **ALL SMOKE CHECKS PASSED** |
| sustained-throttle-sim (new) | **ALL PASS** (12): rises, holds, smooth ramp 0.071, steer 0.042, full 8-path lap with no crash, y/pitch settle, cam above car on climb |
| lap-pursuit-sim (new) | **ALL PASS**: lap 99.8%, no crash, no stall, 0% off-ribbon, 0 wall frames, minV 0.803 |
| drive-corridor-audit (new) | **ALL PASS** (58), covering: <br>• flat hard/soft-free <br>• opening coverage per wall crossing <br>• newel ≥0.40 <br>• no foreign or self overlap <br>• kiss tangent ≤35° <br>• spline grade ≤0.300 <br>• lane-volume visual clear on all 8 paths |

Legacy sims outside the required list (car-phys, car-stuck, core-tour, hostile-climb, last-chance, magnet-choke, ramp-approach, wall-cruise) already errored or failed on the logic2 backup. They are unchanged and were not updated.

## Files
- **Changed:** `js/data/tracks.js`, `js/drive/tracks.js`, `js/drive/driveMode.js`, `js/drive/car.js`, `js/mansion.js`, `js/main.js`, `index.html` (`?v=logic3`)
- **Sims updated:** `logic1-acceptance-sim.mjs`, `from-scratch-drive-sims.mjs`, `no-teleport-sim.mjs`, `full-update-climb.mjs`, `climb-b-autodrive-sim.mjs`
- **New:** `sustained-throttle-sim.mjs`, `lap-pursuit-sim.mjs`, `drive-corridor-audit.mjs` (`--json`, `--quiet`, `WALLDBG=<regex>`)
- **Screens (headless SwiftShader, not a live proof):** `/workspace/playtest-logic3/`
- **Backup of logic2:** `/workspace/_mansion_logic2_backup/` (not in the zip)

## For the live proof
1. Open `?v=logic3`, then `&autodrive=climb` and `&autodrive=climb_b`.
2. Hold W for a manual lap from spawn: S/F → runway → Climb A → hairpin → balcony loop → Climb B apex → descent → S/F.
3. Watch these specifically:
   - the landing north arch, library south arch and landing east gallery arch (frames and lintels)
   - the balcony loop edge near the west deck end (road edge is 0.45u from the deck edge)
   - the car staying visible on Climb A (camera fix)
