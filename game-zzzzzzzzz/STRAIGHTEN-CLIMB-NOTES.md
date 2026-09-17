# Straighten climb — foyer→landing (2026-09-16)

Ben: spiral S-weave on the climb was unreadable. Not claiming ready.

## Climb turn (measured)
| | before | after |
|---|---|---|
| Cumulative turnDeg | **421.2°** | **~29°** |
| XZ length | ~14.2 m | ~14.0 m |
| Mean grade | ~29.5% | ~29.9% (≤30% hard) |
| Shape | Soft S-weave / corkscrew | Mostly west corridor, single gentle SE bend to crest |

## Geometry
- **Foot:** (-5.05, 0.06, 11.75) — east of grand stair, north of south-wall skirting lane; spur runway kisses foot.
- **Crest:** (-2.75, 4.26, -1.95) — kisses `landing_skirting` west library fillet (and library west skirt).
- **Path:** holds x≲-4.3 until low Z so foyer skirting can cruise east of the climb; then gentle bend to crest.
- **Aperture / climbGap / corridor pierce** updated to cover the straightened ribbon (stair void still included).
- **Upper circuit:** `landing_skirting` west fillet simplified; `balcony_loop` joins unchanged and still connected.

## Scale (intact)
CAR_SCALE **0.188**, ROAD_WIDTH_SCALE **0.80**.

## Sims (green this pass)
`smoke`, `no-teleport-sim`, `ramp-approach-sim`, `hostile-climb-sim`, `core-tour-sim`, `wall-cruise-sim`, `full-update-climb`, `car-stuck-sim`.

Float ribbon sample on climb waypoints: max |snapY−authoredY| ≈ 0.03 m.

## Remaining risks
1. **South-wall skirting gap** at the climb foot — skirting does not run through the foot XZ; SW foyer is west-stub + long-way-around. Cruise coverage is N+S on the east first; imperfect soft-steer can still prefer one wall for a while.
2. **Grade is tight** (~0.299) — small Catmull overshoot / future waypoint edits can flip `_softenRampGrades` disable. Keep length ≥ ~14.05 m flat.
3. **Hall stuck wedge** — west-wall climb tunnel leaves overlapping furniture/wall slabs; escape now accepts freed near-road cruise if onTrack latch is slow.
4. **Crest handoff** into library fillet is farther north than the old (-5, 1.9) kiss — first-time players may read “into library” before “landing lap.”
5. Not claiming Drive ready for Ben.

## Intact rules
No-teleport hysteresis, ≤30% grade, hard pillars, no auto jumps, connected primary circuit.
