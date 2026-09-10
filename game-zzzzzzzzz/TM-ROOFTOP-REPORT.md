# TM Rooftop — sim↔live climb gap + hard specs (2026-09-09)

## Live fail diagnosis (playtest-shots14)
- Movement OK (6–14 km/h); climb aperture / elevated / balcony FAIL.
- Root causes: (1) foyerFoot engage still keyed to stale west-stair (-7.15,11.20) while foot is (-4.70,10.60); (2) climb too steep for human (~0.45 mean); (3) tiny foot chevron; (4) crest glue onto ramp end blocked landing→balcony handoff.

## Hard specs enforced
1. Holes/tunnels — drive wall openings + brass portal frames for foyer/hall/balcony/room doors; climb slab hole retained/expanded.
2. Max grade ≤ 30% — RAMP_MAX_GRADE=0.30; foyer climb ~16.8 m flat S-weave (post-soften maxG≈0.25).
3. Single primary circuit — orphan cornice/flower/attic/cellar/loft disabled; side-room kisses fixed; 37/37 enabled paths connected from spawn.
4. Approach runway — foyer_climb_spur widened, kisses foot; engageBack 0.55.
5. Loops feed circuit — balcony loop + return joins verified at 0.000 m.

## Human climb mounts
- Wider climb ribbon, stronger ramp hold/yaw settle, brighter foot chevron.
- Crest handoff leaves climb ribbon once on landing_skirting.

## Sims green
- hostile-climb-sim.mjs PASS (grade, connectivity, runway, noisy crest+balcony)
- core-tour-sim.mjs CORE TOUR PASSED
- ramp-approach-sim.mjs ALL PASSED
- ruthless-drive-diag.mjs ALL PASSED

Archive: /workspace/mansion-of-the-unseen-tm-rooftop.tar.gz
