# Drive refine — W actually drives (2026-09-09)

## Ben playtest (nolamp1)
PASS: pillar-aim, float. FAIL: movement (3 km/h then unclear displacement), ramp-pin (0 km/h, never reached climb).

## Root cause (remaining grabber after lantern move)
1. **Ribbon left asphalt under straight W** — `foyer_drive_start` curved west too early (along z≈11.2). Holding W along spawn yaw left the ribbon by ~1.7 m → carpet snap.
2. **Carpet maxV ×0.58** + display `speed×10.08` → ~3 km/h HUD crawl (matches playtest).
3. **Visual bench on climb corridor** — foyer south bench at (−5, 11) sat on the westbound asphalt (no Drive AABB, but looked like a grabber / blocked the obvious line to the ramp).
4. **Aggressive wall scrub on floor onTrack** could still kill cruise when apron/skirting kissed a wall AABB; unstuck could shove sideways into obstacles.

Not the lantern (already moved). Not a hard furniture soft-AABB pin on the new corridor (car-height choke = 0).

## Fixes
1. **`foyer_drive_start`** — width 2.60 (post-scale ≈2.26); path goes **into open foyer first** (−Z to z≈9.4) then west to ramp foot (−7.15, 11.20), south of the old bench line.
2. **CAR_SPAWN.yaw** — `π+0.12` (into foyer, mild west).
3. **Bench** moved to south-wall west corner (`cx−6.6`, `cz+d/2−0.85`).
4. **Floor onTrack wall resolve** — positional depenetrate only (no speed scrub / yaw yank).
5. **keys.forward on floor asphalt** — enforce cruise floor ≥0.55 after walls.
6. **Unstuck** — nudge along ribbon forward + `_clearPointFromWalls` (not sideways into furniture).
7. **Spawn apron** enlarged; apron XZ counts as **onTrack** (no carpet penalty on pad edge).
8. **Carpet maxV** 0.58 → 0.78 (brief off-ribbon not sticky death).

## Proof
| Suite | Result |
|-------|--------|
| ruthless-drive-diag | ALL PASSED — W 4s sustain, >2m into foyer, pure W onTrack 95%, reach ramp foot, choke=0 |
| last-chance-drive-check | ALL PASSED |
| wall-cruise-sim | ALL PASSED — wallFrames 0, W 2s moved 2.68 |
| ramp-approach-sim | ALL PASSED — pinTime 0, climb crests |

## Remaining honesty
- Soft furniture AABBs still exist mansion-wide (raised for Drive); west stair stringers pierce in climb corridor only.
- If player drives **off** the wide ribbon into deep carpet, speed still soft-caps — follow the asphalt into the foyer / west to the climb.
