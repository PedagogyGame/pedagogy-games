# POLISH-LOGIC6 — review bug fixes only (layout = logic5, cache `?v=logic6`)

Scope: the four bugs flagged in DRIVE-V2-BLUEPRINT.md §1. The v2 redesign was **not** applied.
The circuit, lanes, grades, lights, adaptive scale and polish items are unchanged from logic5.

## 1. The attic stair no longer stands over the Climb A hole
- **Before:** `landing.attic_up` sat at x −6.5, z 6, width 2.2. Its footprint (x −7.6..−5.4, z 0.5..6) stood over both `holeA_climb` and `holeA_scenic`. It was 0.60u *inside* the climb_a ribbon edge, so it stood right over the climb.
- **Now:** x −2.4, z 7.2 → 1.7 (dir north), width 1.3, length 5.5. It runs on the landing's solid west strip.
  - It is 0.6u clear of the hole edge (x −3.65).
  - It is 0.65u clear of the hairpin lane edge (x −1.1).
- **Stairwell:** `ATTIC_STAIRWELL` (x −3.10..−1.70, z 1.70..4.70) is cut in both the landing ceiling and the attic floor. Eye height stays under the ceiling slab south of the well (worst case is about 7.86 vs 8.06), and the well sits fully under the attic (z < 5).
- **Attic:** a brass balustrade (with Explore colliders) runs round the west, east and south sides of the well. The north side is the top exit.
- **Things moved out of the stair's way:**
  - The landing bench was across the foot approach at z 7.4. It is now tucked lengthwise under the stair.
  - The attic crate at (−3, 1) blocked the top exit. It moved to (1.5, 2).
  - The existing hairpin newel (−2.2, 2.2) is unchanged and now stands under the stair's upper end.
- **Explore floor:** getFloorY along x −2.4 climbs smoothly from 4.20 (z 7.5) to 8.40 (z 1.5).
- **New audit checks (drive-corridor-audit F):** `stair-clear-of-climb-holes@*` and `stair-clear-of-ribbon@*` (≥0.3u). The old stair position FAILS both checks, so they have teeth.

## 2. Curbs are red/white
- **Before:** the curbs were 0x1e2028, near-black on dark asphalt.
- **Now:** white Lambert material with per-instance colours via `setColorAt` (red 0xd8382c / white 0xf4f1ea), plus a tiny neutral emissive.
- Each strip is split into blocks of about 0.32u, and the blocks pitch with the ramp grade.
- It is still ONE `curb_segments_instanced` mesh with 543 instances. Track meshes total 27 (≤40).

## 3. CAR_LENGTH_U
- `js/data/tracks.js` had `CAR_LENGTH_U = 0.19`. That number is car.js `CAR_SCALE`, not the car's length; the real length is 0.45 × 0.19 = 0.0855u.
- A grep finds nothing that imports it (no module, no sim), so it never caused any behaviour issue.
- It is corrected to 0.0855 with a comment, for documentation only. Lane widths (2.2) are untouched.

## 4. Climb A foot surge: the handoff is now continuous
- **Root cause (also present in logic3–5):**
  - At x ≈ −1.55 the snap latches climb_a while the car is still on the runway.
  - querySnap clamps t = 0, so the snap point becomes the climb's first vertex (x −2.11), about 0.56u *ahead* of the car.
  - car.js's ramp "lateral" magnet (pull up to 0.72/frame) then dragged the car forward. One 1/60 frame moved 0.129u at 1.21 u/s, which is 6.4× speed·dt.
- **Fix (car.js):** every XZ magnet is now lateral-only. The along-track component of (snap − car) is removed using the ribbon tangent (`snap.yaw`), so the magnets can only centre the car and can never push it along the track.
- **New no-teleport-sim checks:** these run the full DriveMode with walls and fail if any frame moves the car more than 1.5 × speed·dt + 4 mm.
  - `step-ratio-pursuit-lap`: a whole held-W lap.
  - `step-ratio-climb-a-foot-release`: release W at the foot.
  - `step-ratio-climb-a-foot-30fps`: dt = 1/30.
  - `step-ratio-climb-b-foot`
  - On logic5 code the three Climb A checks FAIL (13, 7 and 3 bad frames; worst 6.4×). On logic6 they PASS.

## Sim results (logic6)
- logic1-acceptance-sim: 25 PASS / 0 FAIL — ALL PASS
- from-scratch-drive-sims: 37 PASS / 0 FAIL — ALL PASS
- no-teleport-sim: 10 PASS / 0 FAIL — ALL PASS
- climb-collider-check: 2 PASS / 0 FAIL — PASS  climb_b — 0 hard hits foot=(4.11,0.00,11.40) crest=(4.40,4.20,0.30)
- full-update-climb: 1 PASS / 0 FAIL — PASS climb-a-autodrive maxY=4.154 result=CLIMB AUTO PASS maxY=4.15 on=1 path=climb_a vis=1
- climb-b-autodrive-sim: 1 PASS / 0 FAIL — PASS climb-b-autodrive drop=4.007 minY=0.205 result=CLIMB B AUTO PASS drop=4.01 on=1 path=
- smoke: 0 PASS / 0 FAIL — ALL SMOKE CHECKS PASSED
- sustained-throttle-sim: 12 PASS / 0 FAIL — ALL PASS
- lap-pursuit-sim: 6 PASS / 0 FAIL — ALL PASS
- drive-corridor-audit: 63 PASS / 0 FAIL — ALL PASS

- In the headless browser, a held-W drive from spawn to the top of Climb A gave 117 frames, 0 over 1.5×, worst 1.00×. The Climb A and B autodrives both PASS with the car 100% visible.
