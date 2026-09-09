# Drive refine — ramp-approach / no wall-pin (2026-09-09)

## Root cause (playtest-shots3)
**Stair stringer + underside “pillar grab” at foyer climb foot.**
- West `main_up` outer stringer AABB sat *outside* the stair (`x=[-8.42,-8.12]`) and clipped `foyer_skirting` centerline at `x=-8.3`.
- Underside slab (`y` up to ~0.92 over the whole stair footprint) grabbed the RC car when turning toward `ramp_foyer_to_landing` before ramp `onTrack` pierce engaged.
- Floor yaw settle was one-way along skirting winding, fighting reverse approach from spawn toward the west ramp; wall-slide + yaw-gate could keep the car off the climb ribbon and pin at **0 km/h**.

## Fixes
1. **Inset stair stringers** — barriers sit *inside* the stair footprint (`driveKind: "stair"`); west/east skirting ribbons clear.
2. **Drive-soft underside** — wide stair slabs raise `min.y` to **0.52** so floor cruise clears the approach (Explore keeps full boxes).
3. **Ramp pierce on approach** — `_resolveDriveWalls` skips when `ramp` + (`onTrack` | `nearDeck` | `rampContinuity`).
4. **Bidirectional ribbon yaw** — floor/wall settle picks `yaw` or `yaw+π` (no U-turn when aiming at climb against winding).
5. **Faster unstuck** near climb / wall-pin (0.35s vs 0.6s).
6. Stair hits treated soft (like furniture) for jam counting / scrub.

## Proof numbers
### ramp-approach-sim
| Metric | Value |
|--------|-------|
| Approach avg speed | **1.248** |
| Approach min speed | **1.198** |
| Pin time | **0.00 s** |
| Max pin streak | **0.00 s** |
| Mounted + crested | **yes** (maxY **4.01**, crest 4.26) |
| Stringers clear west ribbon | **yes** |
| Endcap / underside / wall-gap cases | **all pin&lt;0.5s** |

### wall-cruise-sim
| Metric | Value |
|--------|-------|
| Loop avg speed | **0.822** |
| Loop min speed | **0.116** |
| Pin time | **0.00 s** |
| Max pin streak | **0.00 s** |
| Foyer quads | **3** |
| Head-on west escape | **0.43 s** |
| Climb foyer→landing maxY | **4.07** |

### last-chance + smoke
- `last-chance-drive-check.mjs` — ALL PASSED (climbFrames=551)
- `smoke.mjs` — ALL PASSED (ramp mountFail=0, footFail=0)

## Preserve
Nose-first, ride height, clean HUD, Explore boot, under≠on — unchanged / still green.
