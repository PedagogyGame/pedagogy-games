# POLISH-LOGIC7: fixes from the logic6 live prove (layout unchanged, cache `?v=logic7`)

## 1. Chase cam fell behind, the car shrank to a dot, then snapped back
- **Root cause:** the follow was a world-space spring (k 9.2) damped toward *zero* velocity (4.6).
  - At cruise it trails by about v·damp/k ≈ 1.21·4.6/9.2 ≈ 0.6u on top of the 0.30u framing. The camera sat about 1.1u back (3.7× the design distance) whenever the car moved.
  - When the car stopped, the spring caught up, which looked like the car jumping forward.
  - The physics substeps already ran it, so it was about equally wrong at every fps. The low live fps just made the jumps visible.
- **Fix (driveMode.js):** a car-relative rig.
  - The camera = the car position plus an offset behind it, set by a smoothed yaw and smoothed back/up lengths using exp(-k·dt) (yaw k 7.5, lengths k 7) in every ≤1/30 s substep.
  - The aim point is a car-relative offset, low-passed with exp (k 6.5 XZ / 3 Y).
  - The deck sight-line guard is kept: the lift rises instantly and relaxes smoothly.
  - The look-steer and FOV lerps are also exp(-k·dt) now.
- **New sim `cam-framing-fps-sim.mjs`:** full DriveMode with walls, the whole circuit, held W with a 3 s stop-and-go, rendered at 1, 5 and 60 fps.
  - Cam→car distance stays within ±20% of the nominal framing on every frame. The worst frame is 114%, at the launch from rest.
  - The car stays in the frustum.
  - The mean distance agrees across fps (0.4% spread).
  - Run against the logic6 camera, it fails on every frame: up to 451% of nominal.
- **Live (box Chrome, about 4 fps):** the moving car's distance stayed at 0.94–1.13× nominal.

## 2 and 3. "Climb A PASS on pink floor" and autodrive driving on after PASS
- **Root cause:** after PASS the harness released steering but kept W held.
  - The car rolled straight off the crest (Climb A) or the foot (Climb B) onto room floors and into walls.
  - The live shots were taken after that roll; the log line on screen was frozen at the PASS moment.
- **Hold:** when a result is reached, every key is released and the car brakes to a stop where it was measured (about 0.1u roll). Any real key press hands control back.
- **Asphalt check:** PASS now also needs drawn asphalt under the car.
  - `_asphaltUnderCar()` casts a ray straight down. The first visible surface hit must be a track road mesh (ribbon, spawn pad, end band or chevrons) within 8 cm of the wheels.
  - This holds for the last 6 samples. The result line carries `asphalt=<mesh>`.
  - With the road hidden or the car off the road, the check returns false.
- **Sims:** `full-update-climb` / `climb-b-autodrive-sim` add `*-hold-after-pass` (roll < 0.4u over 7×0.28 s + 7×1.0 s frames, speed 0, asphalt under the car, on track) and `*-player-takeover`.
- **Live:** Climb A held at (−4.04, 4.17, −0.94) on `ribbon_ramp` for 8 s+, and the road visibly continues over the crest. Climb B held at (5.38, 0.17, 11.40) on `ribbon_ramp`.

## 4. The Explore | Drive bar couldn't be clicked in Drive
- **Root cause:** `#hud` is `pointer-events:none`, and the play-mode bar inherited it, so clicks fell through to `<canvas id="c">`.
- **Fix:** `.hud-mode` and its buttons are `pointer-events:auto`.
- **Also:** switching to Explore from the HUD no longer auto-locks the pointer. A lock captured the mouse, so Drive could never be clicked back, and moving toward it spun the view. Click the canvas to look around; Esc frees the mouse; keys 1 and 2 still switch.
- The button blurs after a click so WASD reaches the game.
- **Live:** xdotool mouse clicks: Explore → explore, then Drive → drive. The pointer is not locked.

## 5. The spawn view read as a narrow brown corridor
- At rest the chase lifts and pulls back a little (up 0.115+0.11·leisure, back 0.21+0.13·leisure). The leisure FOV went 62 → 72 and the drive FOV 68 → 70.
- That shows more of the foyer ceiling, walls and the Climb B deck, with the car above the speedo.
- No new meshes or lights.

## Sim results (logic7)
- logic1-acceptance-sim: exit 0, 25 PASS / 0 FAIL ALL PASS
- from-scratch-drive-sims: exit 0, 37 PASS / 0 FAIL ALL PASS
- no-teleport-sim: exit 0, 10 PASS / 0 FAIL ALL PASS
- climb-collider-check: exit 0, 2 PASS / 0 FAIL 
- full-update-climb: exit 0, 3 PASS / 0 FAIL 
- climb-b-autodrive-sim: exit 0, 3 PASS / 0 FAIL 
- smoke: exit 0, 0 PASS / 0 FAIL ALL SMOKE CHECKS PASSED
- sustained-throttle-sim: exit 0, 12 PASS / 0 FAIL ALL PASS
- lap-pursuit-sim: exit 0, 6 PASS / 0 FAIL ALL PASS
- drive-corridor-audit: exit 0, 63 PASS / 0 FAIL ALL PASS
- cam-framing-fps-sim: exit 0, 10 PASS / 0 FAIL ALL PASS
