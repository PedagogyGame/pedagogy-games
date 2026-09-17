# Workable Drive — no-teleport + scale balance (2026-09-16)

Ben: car jumped between track ribbons — unacceptable. Also: smaller car/roads, house clarity over fat toys. Not claiming ready.

## Root cause — track-to-track jumps
1. **Spawn apron false onTrack** kept distant `pathId` (e.g. `door_foyer_outdoor`) and latched `_lastPathId`, then sticky bias + snap XYZ yanked the car ~1m+.
2. **Weak path hysteresis** (`pathBias -0.48`) + **foyer rampBias ×1.48** let overlapping floor/climb ribbons steal mid-cruise.
3. **`findEscapeSnap` / stuck escape** hard-teleported to nearest asphalt within 4.5m (parallel tracks across the room).
4. **Near-flat connector crush** (`rampBias ×0.28`) blocked intentional `balcony→ramp_balcony_return` when sticky on deck — separate from foyer jumps but fixed in same pass.

## Hysteresis rules (querySnap)
- Prefer `_lastPathId` unless challenger is clearly closer / on-ribbon, OR intentional junction:
  - spur/drive/skirting → foyer climb inside engage radius
  - any ramp foot mount when already on/near that ramp ribbon
  - climb crest → coplanar deck handoff
  - floor re-engage when drifted off last ribbon onto another under the wheels
- Spawn apron: onTrack asphalt feel with **car XZ** + latch **only** `foyer_drive_start` (never door_*/skirting steal).
- Carpet off-ribbon: XZ stays at car (no parallel-centerline magnet target).
- Foyer `rampBias` only inside foot engage (or same-ramp continuity); ×1.48 → ×1.12 gated.
- Escape: same-path / ≤~1.15m only; stuck nudge soft-capped (~0.32m), no room-crossing teleport.
- Car lateral lerp refused if snap centerline >0.55m away.

## Scale (before → after)
| | before | after |
|---|---|---|
| CAR_SCALE | 0.218 | **0.188** |
| ROAD_WIDTH_SCALE | 0.87 | **0.80** |
| foyer_drive_start (post-scale) | ~2.26 | **~1.96** |
| foyer_skirting | ~1.11 | **~1.09** |
| foyer_climb_spur | ~2.13 | **~1.84** |
| ramp_foyer_to_landing | ~1.39 | **~1.12** |

## Sims (green)
`no-teleport-sim`, `smoke`, `ramp-approach-sim`, `hostile-climb-sim`, `core-tour-sim`, `wall-cruise-sim`.

## Intact
≤30% grade, holes/tunnels, connected circuit, pillars hard, climb mount, no track jumps.
