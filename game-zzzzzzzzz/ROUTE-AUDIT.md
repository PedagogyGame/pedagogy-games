# Primary Drive circuit — route audit

**Date:** 2026-09-17 (America/Chicago)  
**Scope:** Full primary circuit after from-scratch rebuild (8 paths).  
**Not claiming ready for Ben** — facts for parent live-prove only.

## Paths audited

`foyer_drive_start`, `foyer_climb_spur`, `foyer_skirting`, `ramp_foyer_to_landing`, `landing_skirting`, `ramp_landing_to_balcony`, `balcony_loop`, `ramp_balcony_return`.

## 1) HardHits (centerline + ±halfW @ car height vs wall/pillar)

Sampling: Catmull-Rom along each path; laterals `[0, ±halfW, ±0.5·halfW]`; Y offsets `+0.18 / +0.35 / +0.48` m vs mansion `driveKind` wall/pillar AABBs.

| Path | width | halfW | samples | hardHits |
|------|------:|------:|--------:|---------:|
| foyer_drive_start | 1.960 | 0.980 | 81 | **0** |
| foyer_climb_spur | 1.840 | 0.920 | 81 | **0** |
| foyer_skirting | 1.088 | 0.544 | 689 | **0** |
| ramp_foyer_to_landing | 1.292 | 0.646 | 119 | **0** |
| landing_skirting | 0.960 | 0.480 | 360 | **0** |
| ramp_landing_to_balcony | 1.197 | 0.599 | 81 | **0** |
| balcony_loop | 0.760 | 0.380 | 192 | **0** |
| ramp_balcony_return | 1.197 | 0.599 | 81 | **0** |

**Total hardHits: 0**  
Soft furniture/stair asphalt traps (car radius): **0** (`drive-skirting-audit` + full-circuit soft scan).  
Climb gold jamb hits: **0** (`climb-collider-check`).

## 2) Float / airborne

Tour sim along each path (throttle-forward; mild yaw assist on ramp/balcony only):

| Path | max \|car.y − snap.y\| on-ribbon | airSuspect |
|------|----------------------------------:|-----------:|
| foyer_drive_start | 0.0080 | 0 |
| foyer_climb_spur | 0.0027 | 0 |
| foyer_skirting | 0.0027 | 0 |
| ramp_foyer_to_landing | 0.0000 | 0 |
| landing_skirting | 0.0027 | 0 |
| ramp_landing_to_balcony | 0.0000 | 0 |
| balcony_loop | 0.0019 | 0 |
| ramp_balcony_return | 0.0000 | 0 |

- **global max ΔY (on-ribbon): 0.0080 m**
- **airborne latch frames on floor cruise: 0**
- Static snap continuity: all 8 paths onRate ≈ 1.0 on centerline (spur foot intentionally mounts climb → small authored-vs-snap Y near junction only).

## 3) Sims run (this pass)

| Suite | Result |
|-------|--------|
| `route-audit.mjs` (hardHits + float) | PASS |
| `no-teleport-sim.mjs` | PASS |
| `from-scratch-drive-sims.mjs` | PASS |
| `climb-collider-check.mjs` | PASS (0 hard / 0 gold) |
| `hostile-climb-sim.mjs` | PASS |
| `wall-cruise-sim.mjs` | PASS |
| `car-stuck-sim.mjs` | PASS |
| `drive-skirting-audit.mjs` | PASS |
| `smoke.mjs` (`--import ./smoke-register.mjs`) | PASS |

No-teleport hysteresis still in place (`TrackSystem` path bias / junction gates; car `snapJump < 0.55` gate; `ASSIST_MAGNET = false`).

## 4) Proportions

- `CAR_SCALE = 0.190` (band 0.18–0.20) — no tweak
- `ROAD_WIDTH_SCALE = 0.80`
- Post-scale widths: drive 1.96 · spur 1.84 · foyer skirt 1.088 · climb 1.292 · landing 0.96 · balcony 0.76 · balcony ramps 1.197
- Climb: flat ≈ 14.15 m, rise 4.20, mean/maxSeg grade **0.297 ≤ 0.30**, turn ≈ **41°**

## 5) Physics / control

- Motion: user throttle/steer only (`ASSIST_MAGNET = false`)
- Floor: soft rim hold only when `edgeMargin < 0.10` (no centerline yank)
- Climb: soft lateral hold + yaw settle with teleport gate; not a full-floor magnet
- Walls/pillars HARD; furniture soft-slide only

## 6) Fixes this audit

None required — all checks green; no road/aperture/blocker moves.

## Artifact

Re-zipped: `/workspace/mansion-of-the-unseen.zip` (all checks green).
