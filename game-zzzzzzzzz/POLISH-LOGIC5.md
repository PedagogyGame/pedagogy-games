# POLISH-LOGIC5 — manual drive in the real box Chrome (cache `?v=logic5`)

This is not a ready claim. The live numbers below come from the box Chrome on DISPLAY=:9, driven with real `xdotool keydown w` / `keyup w`, captured with ffmpeg x11grab, and read from the `&speedtrace=1` overlay.

## Was it real or a test artifact? Real.
**Root cause 1: Drive ran at 0.78 fps in the live Chrome.**
- Drive had 26 visible lights: 17 room SpotLights, about 5 room PointLights, hemi, 2 directional lights and 2 Drive fills. SwiftShader shades every fragment against every light.
- With the room lights hidden, the same page measured 3.57 fps. Adding adaptive render scale brought it to about 10 fps.

**Root cause 2: the 0.25 s cap starved the game clock.** The logic4 cap was still far too low at 0.78 fps. A 2 s W hold gave about 2 frames × 0.25 s ≈ 0.5 s of game time, which is the 8 km/h in `01-held.png`.

**Root cause 3: the coast finished within 1–2 rendered frames.** At 0.78 fps each frame is about 1.3 s of wall time, so a 1.35 s game-time coast had nothing to count down on screen. All three rapid screenshots showed 0.

**Ruled out, via the overlay's event log:**
- No blur or visibility events.
- No spurious keyup: X autorepeat gives keydown with `repeat=true` (40 in 2 s) and a single keyup.
- No respawn and no crash.
- `_respawnAtStart` only runs after a crash.

## Changes
- **`main.js` `applyDriveGpuProfile`:**
  - In Drive, hides the mansion's room Spot/Point lights (the exact list is saved) and restores them on exit.
  - Drive now has 5 visible lights; Explore has 24, the same as a fresh load.
- **`main.js` adaptive Drive render scale:**
  - Frame-time EMA above 110 ms steps the pixel ratio down 1 → 0.8 → 0.65 → 0.5; below 45 ms it steps back up.
  - It resets to 1 on Explore.
  - The CSS size is unchanged.
- **`main.js` / `driveMode.js`:** Drive takes the real wall-clock dt up to 1.0 s and still integrates it in ≤ 1/30 s sub-steps. A 60 fps frame is still one step, so sims are unchanged.
- **`car.js` coast:**
  - The coast surface ratio is clamped to 0.85–1.15.
  - A release on the Climb A foot or a deck now coasts about 1.0 s. It was 0.83 s because ramps used 1.58× floor friction.
  - Floor asphalt is unchanged at about 1.2–1.35 s.
- **`js/drive/speedTrace.js` (new, loaded only with `&speedtrace=1`):**
  - Header: fps, render scale, W↓→13 km/h time, peak, km/h at W↑, W↑→0 time, key-repeat count, and blur/visibility/crash/respawn/speed-drop events.
  - A graph of speed vs wall-clock time with the W-held span shaded, latched to the latest press so a later screenshot still shows the whole curve.
  - A table of samples with `performance.now()` stamps and frame dt.
- **Explore view after Drive:**
  - Lighting never leaked. Every value is identical before and after Drive:
    - exposure 1.12
    - hemi 0.55
    - moon 0.55 / 0.18
    - fog 0.0095
    - 24 lights
    - pixel ratio 1
  - The dark `07-explore.png` came from inheriting the chase-cam pose: the car's spot, looking west at the unlit wall.
  - Now Drive saves the Explore camera (position + look direction) and restores it. From title→Drive the fallback is the default foyer view, facing north.
  - The after-Drive frame now has the same luminance as a fresh Explore (mean 85.0).
- **`__MOTU_DUMP__().gpu`** now reports exposure, pixel ratio, visible lights and hemi/moon/fog values, for live checks.

## Live box-Chrome speed trace (DISPLAY=:9, xdotool, ~10–11 fps, scale 0.50)
| Test | W↓ → 13 km/h | Peak | At W↑ | W↑ → 0 |
|---|---|---|---|---|
| hold 2.0 s (released on the Climb A foot, ramp) | 0.39 s | 13.9 | 12.2 km/h | **1.00 s** |
| hold 1.2 s (released on the S/F flat) | 0.38 s | 13.9 | 13.9 km/h | **1.22 s** |

Flat coast samples, km/h at 0.1 s steps: 13.9 · 13.3 · 11.7 · 10.1 · 8.6 · 7.3 · 5.9 · 4.9 · 4.0 · 3.1 · 2.3 · 1.4 · 0.7 · 0.1 · 0.

Live autodrive with the new light budget:
- Climb A: `CLIMB AUTO PASS maxY=4.15 on=1 vis=100% car-in-frame`
- Climb B: `CLIMB B AUTO PASS drop=4.01 on=1 vis=100% car-in-frame`

## Sims: all PASS
| Sim | Result |
|---|---|
| logic1-acceptance | 25 |
| from-scratch | 37 |
| no-teleport | 6 |
| climb-collider | A and B, 0 hard hits |
| Climb A autodrive | 4.154, vis=100% |
| Climb B autodrive | 4.007, vis=100% |
| smoke | ALL PASS |
| sustained-throttle | 12 |
| lap-pursuit | 99.8%, 0 wall frames |
| drive-corridor-audit | 58 |

## Carried over (not fixed)
The Climb A foot handoff surge noted in POLISH-LOGIC4 is still there.
