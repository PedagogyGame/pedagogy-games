# Expert figure-8 lap — 2026-09-17 (America/Chicago)

**Not claiming ready for Ben** — parent live-proves. Sims + zip only.

## Blueprint (drivefix9 — Climb A/B asphalt ≠ stairs)

1. **Foyer oval** — S/F mid-foyer long axis (`foyer_oval`)
2. **Climb A** — dedicated **asphalt corridor** at **x≈-5.0** through real ceiling/floor hole; west scenic stairs (`main_up` at x≈-7.6) are Explore-only scenery (not the road)
3. **Landing hairpin** — 180° around solid newel; starts east of newel at Climb A crest
4. **Balcony loop** — outer rail wall, marked inner edge (`balcony_loop`)
5. **Climb B** — asphalt at **x≈7.0** through east hole; scenic stairs (`climb_b_east` at x≈9.0) beside, not under ribbon; chevron pylons + asphalt lips at foot/crest
6. **Foyer finish** — short straight into S/F — all junctions kissed (d=0)

## Stairs vs asphalt separation
| Climb | Asphalt centerline | Scenic stairs | Separation |
|--|--|--|--|
| A | x=-5.00, foot z=12.40 → crest z=-1.80 | `main_up` x=-7.6 w=2.2 | ~1.5 m gap; stairs `scenic:true` (no drive ramp) |
| B | x=7.00, crest z=-1.80 → foot z=12.40 | `climb_b_east` x=9.0 w=1.5 | ~1.3 m gap; stairs scenic only |

## Climb XYZ (authored)
| | foot | crest | flat | rise | mean |
|--|--|--|--:|--:|--:|
| Climb A | (-5.00, 0.00, 12.40) | (-5.00, 4.20, -1.80) | 14.20 | 4.20 | 0.296 |
| Climb B | (7.00, 4.20, -1.80) | (7.00, 0.00, 12.40) | 14.20 | 4.20 | 0.296 |

## Lane / GPU
- Clear width 2.4–2.5 m; `CAR_SCALE=0.190`; `ROAD_WIDTH_SCALE=1.0`
- Track meshes **30** (≤40 budget); deferred `ensureMeshes`
- White/yellow lanes + climb chevrons on both ramps

## Sims (this pass)
- `from-scratch-drive-sims.mjs` — **ALL PASS**
- `climb-collider-check.mjs` — Climb A/B **0 hard hits**
- `smoke.mjs` (via smoke-register) — **ALL SMOKE CHECKS PASSED**

## Cache
`?v=drivefix9`

## Artifact
`/workspace/mansion-of-the-unseen.zip`
