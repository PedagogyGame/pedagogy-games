# Drive from scratch — 2026-09-17

Ben: rebuild the entire driving side from scratch; keep Explore clean; no junk secondary ribbons.

**Not claiming ready for Ben** — parent live-proves before any zip handoff.

## Replaced (from scratch)

| File | What changed |
|------|----------------|
| `js/data/tracks.js` | **Rewritten.** Primary circuit only (8 paths). Removed ~100+ secondary ribbons (furniture tops, cornice junk, mouse tubes, outdoor forks, attic/cellar expands). |
| `js/drive/tracks.js` | **Rewritten (~785 lines vs ~2276).** Clean TrackSystem: thick asphalt decks, binary on-road, strong path hysteresis, no room-crossing escape teleports, spatial snap grid. |
| `js/drive/car.js` | Restored clean planted RC base; `CAR_SCALE = 0.190` (band 0.18–0.20). |
| `js/drive/driveMode.js` | Kept proven physics/chase/walls; climb fill retargeted; Explore handoff markers. |
| `js/drive/engineAudio.js` | Kept (already Drive-only mute on Explore). |

## Kept intact

- `js/mansion.js` / Explore / slice / player / inspect — **unchanged** (existing climb aperture / `climbGap` / noFrame portals already match east-of-stair corridor).
- Shared mansion colliders wired once via `drive.setWallColliders(mansion.getColliders())` in `main.js`.
- Vehicle presets UI (car / suv / jeep / convertible).

## Primary circuit (XYZ summary)

1. **`foyer_drive_start`** — spawn asphalt `(-2.55, 0.06, 11.50)` → open foyer bow
2. **`foyer_climb_spur`** — T runway → climb foot `(-4.85, 0.06, 11.85)`
3. **`foyer_skirting`** — closed foyer wall-hug loop (Y=0.06)
4. **`ramp_foyer_to_landing`** — foot `(-4.85, 0.06, 11.85)` → crest `(-3.55, 4.26, -2.10)`  
   flat ≈ **14.15 m**, rise **4.20**, mean/maxSeg grade **0.297 ≤ 0.30**, turn ≈ **41° ≪ 100°**
5. **`landing_skirting`** — Y=4.26 closed loop (crest kiss + balcony mounts)
6. **`ramp_landing_to_balcony`** — landing → balcony south face
7. **`balcony_loop`** — elevated deck Y≈4.28
8. **`ramp_balcony_return`** — balcony → landing

Widths post-scale: drive≈1.96, spur≈1.84, climb≈1.29, balcony≈0.76. `ROAD_WIDTH_SCALE=0.80`.

## Explore ↔ Drive handoff

| Enter Drive | Exit → Explore |
|-------------|----------------|
| `player.unlock()` + `player.enabled=false` (main) | `drive.exit()` → `parkForExplore()` |
| tracks `setVisible(true)` | tracks `setVisible("explore")` — asphalt hidden |
| engine `start()` | engine `stop()` |
| fill / climb lights on | fill / climb lights off |
| FOV → drive (68) | FOV restored to `_baseFov` |
| WASD on window+document capture | listeners removed; keys cleared |
| car at `CAR_SPAWN` | car parked at spawn, speed 0 |

No Drive asphalt in Explore. No Explore PointerLock while Drive owns WASD.

## Collisions

- Walls + pillars **HARD** (no soft-raise / no shrink).
- Furniture soft-slide OK (Drive copy only; Explore keeps full AABBs).
- Climb centerline vs hard AABBs: **0 hits** (`climb-collider-check`).

## Sims (green this pass)

- `from-scratch-drive-sims.mjs` — tour + no-teleport + climb hard + pillar + handoff
- `climb-collider-check.mjs` — **0 hardHits, 0 goldHits**
- `no-teleport-sim.mjs`
- `hostile-climb-sim.mjs`
- `ramp-approach-sim.mjs`
- `wall-cruise-sim.mjs`
- `car-stuck-sim.mjs` (hall/dining skipped — no secondary asphalt)
- `smoke.mjs` (adapted for primary-only)

## Backup

Previous Drive stack: `_drive_scratch_backup/`
