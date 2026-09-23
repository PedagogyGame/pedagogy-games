# Drive Polish 10 — figure-8 chase feel (2026-09-19)

Ben: “polish the driving, find ten ways, innovative and profound, to do so.”

**Focus pass (polish10d):** keep & strengthen **1, 2, 5, 6, 7, 8, 9** — **ignore/disable 3, 4, 10**.

**Not claiming ready for Ben** — parent live-proves before any ready claim.

Cache bust: `?v=polish10d`

## Repass audit (polish10d) — items 1,2,5,6,7,8,9 + Climb B tip

| # | Item | Result | Notes |
|---|------|--------|-------|
| 1 | Look-into-turn cam | **OK** | Steer-blended lookYaw; camD≈0.30 (close). Left alone. |
| 2 | Engine load | **OK** | Climb strain + descent freewheel. Left alone. |
| 5 | Crest compression | **OK** | Live force-step maxCrest≈0.96 + hairpin handoff. |
| 6 | Junction chevrons | **OK** | 12 instances; all 6 junctions; live cam readable (B→finish). |
| 7 | Void edge warning | **OK** | Live voidE≈0.79 on balcony inner lip. |
| 8 | Asphalt vs carpet | **OK** | Traction/noise contrast; both surfaces sampled. |
| 9 | Kiss handoffs | **FIXED** | Climb B tip→foyer_finish magnet + oval steal. |
| — | Climb B tip release | **FIXED** | Mirror of Climb A crest: tip soften + finish bias beats coplanar foyer_oval east wall. |
| — | Planted Y | **OK** | gap=0 on spawn asphalt. |
| — | Climb surface | **OK** | climb_a/b kind=ramp (asphalt, not stairs). |
| — | Chrome/GPU | **OK** | Chrome alive; meshes=31 deferred. |

## Fixes in polish10d (only confirmed failures)

1. **`js/drive/tracks.js`** — Climb B foot tip release: `tRaw > 0.82` (was 0.90; last seg ~2.2m). Stronger `foyer_finish` junction bias (−1.85). **Penalty** on `foyer_oval` while latched to `climb_b` so the coplanar oval east wall at x=7 cannot steal the kiss before finish.

## Constraints held

| Spec | Result |
|------|--------|
| CAR_SCALE ≈ 0.19 | 0.190 |
| Grades ≤ 30% | climb_a/b mean ≈ 0.296 |
| Planted Y / no fly | gap=0; crest squat visual only |
| Pillars hard | climb collider 0 hard hits |
| No track jumps | tip release is snap choice only |
| Deferred meshes | Explore never pays road GPU |

## Sims (agent box)

```
node --import ./smoke-register.mjs from-scratch-drive-sims.mjs  # ALL PASS
node --import ./smoke-register.mjs climb-collider-check.mjs     # PASS climb_a/b 0 hard
node --import ./smoke-register.mjs no-teleport-sim.mjs          # ALL PASS
node --import ./smoke-register.mjs smoke.mjs                    # ALL SMOKE CHECKS PASSED
```

Crest unit + live force-step: `CREST_PROOF PASS maxCrest≈0.96 seenHair`.
Climb B tip live force-step: handoff at z≈12.33 → sustained `foyer_finish` (no oval-first).

Screenshots: `/workspace/playtest-keep/`

## Archive

`/workspace/mansion-of-the-unseen.zip`
