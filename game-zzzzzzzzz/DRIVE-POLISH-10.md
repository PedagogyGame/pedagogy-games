# Drive Polish 10 — figure-8 chase feel (2026-09-19)

Ben: “polish the driving, find ten ways, innovative and profound, to do so.”

**Focus pass (polish10c):** keep & strengthen **1, 2, 5, 6, 7, 8, 9** — **ignore/disable 3, 4, 10**.

**Not claiming ready for Ben** — parent live-proves before any ready claim.

Cache bust: `?v=polish10c`

## Repass audit (polish10c) — items 1,2,5,6,7,8,9

| # | Item | Result | Notes |
|---|------|--------|-------|
| 1 | Look-into-turn cam | **OK** | Steer-blended lookYaw; camD≈0.30 (close). |
| 2 | Engine load | **OK** | Climb strain on grade+throttle; freewheel on descent+light throttle. |
| 5 | Crest compression | **FIXED** | Was dead: smoothed `_prevGrade` never spanned 0.10→0.06; climb_a tip magnet blocked hairpin handoff. Now raw-grade arm + crest tip release. |
| 6 | Junction chevrons | **OK** | 12 instances; all 6 junctions present. |
| 7 | Void edge warning | **OK** | Inner lip voidE fires (~0.16–0.8); center quiet. |
| 8 | Asphalt vs carpet | **OK** | Traction/noise contrast; both surfaces sampled. |
| 9 | Kiss handoffs | **FIXED** | Climb A crest was sticky (path magnet). Crest tip release restores hairpin kiss; maxΔY/frame low. |

Also: planted Y / no float OK · Chrome alive · Climb A/B `kind=ramp` (asphalt, not stairs).

## Fixes in polish10c (only confirmed failures)

1. **`js/drive/car.js`** — crest (#5) arms on **raw** grade drop; `_prevGrade` stores raw (smoothed grade never spanned the threshold in one frame).
2. **`js/drive/tracks.js`** — climb_a crest / climb_b foot tip release (soften ramp+path bias past tip) + stronger `landing_hairpin` / `foyer_finish` junction bias so handoff can win (#5/#9).

## Constraints held

| Spec | Result |
|------|--------|
| CAR_SCALE ≈ 0.19 | 0.190 |
| Grades ≤ 30% | climb_a/b mean ≈ 0.296 |
| Planted Y / no fly | crest squat is visual body dip only |
| Pillars hard | climb collider 0 hard hits |
| No track jumps | kiss Y soft-settle; crest tip release is snap choice only |
| Deferred meshes | Explore never pays road GPU |

## Sims (agent box)

```
node --import ./smoke-register.mjs from-scratch-drive-sims.mjs  # ALL PASS
node --import ./smoke-register.mjs climb-collider-check.mjs     # PASS climb_a/b 0 hard
node --import ./smoke-register.mjs no-teleport-sim.mjs          # ALL PASS
node --import ./smoke-register.mjs smoke.mjs                    # ALL SMOKE CHECKS PASSED
```

Crest unit proof: `CREST_PROOF PASS maxCrest≈0.96 seen hairpin`.

## Archive

`/workspace/mansion-of-the-unseen.zip`
