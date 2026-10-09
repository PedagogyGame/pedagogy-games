# POLISH-LOGIC4 — fixes for the three failed logic3 live-prove points (cache `?v=logic4`)

This is not a ready claim. The numbers below come from headless sims and headless SwiftShader Chrome
(this box was running at about 1 fps, load average around 9). The parent still has to live-prove it.

Scope: only the three proven failures. Everything else is unchanged:
- layout, grades, circuit, runways, colliders
- polish items 1, 2, 5, 6, 7, 8 and 9
- still no screech, no brake lights, no checkered start

## 1. Spawn too dark
**Root cause.** Indoors the house is lit almost only by the hemisphere light, and its ground colour was near-black green (`0x1a2a18`). Vertical walls get half of that. The Drive fill light was 3.4 cd, which barely reaches walls 2–3u away. The ramp side, bottom and keel material was `0x2a2c34`, so the Climb B deck overhead at spawn read as a black slab.

**Fix.** Only uniforms change: same light count, no new lights, no shadows, no shader recompiles.
- `main.js` `applyDriveGpuProfile(true)`:
  - hemisphere sky `0xfff0dc`, ground `0x8a6a4e` (wood bounce), intensity 1.05 → 2.6
  - moon 0.85 → 1.0, moonFill 0.42 → 0.7
  - exposure 1.12 → 1.42
  - all values restore on Drive exit, so Explore is unchanged
- `driveMode.js`: fill light 3.4/14 → 7.0/16; climb fill 2.8 → 4.2.
- `drive/tracks.js`: deck side material `0x2a2c34` → `0x4a4d58`.
- **Measured at spawn** (upper 42% of the frame):

  | | Mean luminance | Pixels below 25/255 |
  |---|---|---|
  | logic3 live | 21 | 81% |
  | logic4 | 54 | 17% |

## 3 (found while fixing it). The whole asphalt road was invisible from above
**Root cause.** In `_addRibbonRoad` the top-face index order `(a,b,c / b,d,c)` wound every asphalt ribbon with its normal facing DOWN. FrontSide culling therefore hid the road from the chase cam everywhere except the separate spawn pad:
- floors showed bare wood (the Climb B foot in `05-climbb-end`, and the Climb A runway)
- ramps showed only the untextured bottom slab

The ramp bottom was wound upward. Raycasts confirm it: logic3 ribbons are hit only from below; logic4 ribbons are hit from above with normal y = +1.00 on floors and 0.96 on ramps.

**Fix.** Top faces `(a,c,b / b,c,d)`, bottom faces `(a,b,c / b,d,c)`. The mesh count is unchanged at 27.

## 3. Climb B end: black void, no car
**Root cause (camera).** The chase cam trails about 1.0u behind at cruise. That is spring lag, and it is the approved framing. On the 29% Climb B DESCENT the deck behind the car is about 0.30 higher than the car, but the only floor was `car.y + 0.06`. The lens sat about 0.16 UNDER the ramp deck: it saw the deck underside (black) and the wood floor below it (the road was invisible too, see above). `on=1` was true; the car was really on the ribbon. The camera→car ray was blocked by `ribbon_ramp` from the crest to the foot.

**Second occluder.** The under-fill keels were long straight chord boxes. Across the apex U-turn they stuck out past the inner ribbon edge and hid the car for about 0.4 s.

**Fixes.**
- `drive/tracks.js` `surfaceYAt(x, z, yRef, pathId)`: a stateless ribbon height query. It never touches `_lastPathId`, and only counts the current path and its PRIMARY_CIRCUIT neighbours.
- `driveMode.js` camera floor: the camera must be at least 0.14 above the deck under the lens. It must also sit high enough that the car→camera sight line clears the deck at 30/45/60/75/90% of the way. Capped at car.y + 0.9. XZ trail and look-into-turn are unchanged.
- `drive/tracks.js` keels: adaptive chord length, so each keel bends at most about 10°. Still one InstancedMesh.
- **Honest banners.** `_carVisibleInFrame()` checks two things: the car centre is inside the frustum (|ndc| ≤ 0.92), and the camera→car ray hits no visible opaque mesh. Both `CLIMB AUTO PASS` and `CLIMB B AUTO PASS` now also need:
  - at least 90% of in-climb samples visible
  - the last 6 frames visible

  The result line shows `vis=NN% car-in-frame`, the log shows `car=vis` or `car=HIDDEN(<mesh>)`, and a timeout shows `block=<mesh>`.
- **Teeth test.** With only the camera fix disabled, Climb B now reports `CLIMB B AUTO TIMEOUT ... vis=70% block=ribbon_ramp` instead of the old green lie.

## 2. Manual W: only 6 km/h, then an instant 0 on release
Both were real physics, not the HUD. The HUD just prints `car.getSpeedKmh()`.

**Root cause A: slow game clock.** `main.js` clamped every rAF to dt ≤ 0.05. At SwiftShader frame rates (about 1–6 fps) game time ran 4–20× slower than the wall clock. Holding W for about 2 s real gave about 0.2–0.3 s of game time, which is about 6 km/h.
- **Fix:** main passes real dt (≤ 0.25 s). `DriveMode.update` integrates it in ≤ 1/30 s sub-steps. A 60 fps frame is still a single step, so the sims are unchanged.
- **Browser, about 1 fps:** W reaches 14 km/h after about 1.05 s real.

**Root cause B: coast used the full surface friction as a brake.** That was about 8.3 u/s² on floor asphalt, so 1.38 → 0 in about 0.17 s, which is 1–3 frames. The symmetric 4.4/s throttle ease also kept pushing for about 0.9 s after W-up, then hit that wall.
- **Fix, `car.js`:**
  - pressing keeps the 4.4/s ease (6.8/s on ramps)
  - releasing lifts at 16/s
  - coast is rolling drag, `(0.55 + 0.9·v) × surface ratio`, and it fades in as the pedal fades out
- **Result:** floor cruise 1.38 → 0 in about 1.35 s. The largest per-sub-step drop in the browser trace is 1.67 km/h. The trace is in `/workspace/playtest-logic4/manual-speed-trace.json`. S (brake) is unchanged.

## Sims (`node --import ./smoke-register.mjs <sim>`)
| Sim | Result |
|---|---|
| logic1-acceptance-sim | ALL PASS (25) |
| from-scratch-drive-sims | ALL PASS (37) |
| no-teleport-sim | ALL PASS (6) |
| climb-collider-check | PASS A and B, 0 hard hits |
| full-update-climb (A autodrive) | PASS maxY=4.154, on=1, **vis=100% car-in-frame** |
| climb-b-autodrive-sim | PASS drop=4.007, on=1, **vis=100% car-in-frame** |
| smoke | ALL SMOKE CHECKS PASSED |
| sustained-throttle-sim | ALL PASS (12). Ramp 0.071/frame, 0 dips, steer 0.067 (<0.12), cam above car 0.119 |
| lap-pursuit-sim | ALL PASS: lap 99.8%, 0 wall frames, minV 0.803. Extra probe: car in frame 433/433 samples |
| drive-corridor-audit | ALL PASS (58) |

## Known and NOT fixed (outside scope; it was already in logic3)
At the Climb A foot handoff (`foyer_to_climb_a` → `climb_a`, x ≈ −1.55, z 11.4) the car surges forward about 0.5u over about 0.15 s, with a peak of 0.129u in one 1/60 frame (about 7.7 u/s at a speed of 1.21). The logic3 zip does exactly the same, and no-teleport-sim does not flag it. Worth a look in a later pass.
