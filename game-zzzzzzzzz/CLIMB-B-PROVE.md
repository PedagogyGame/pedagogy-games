# Climb B prove — 2026-09-17 (America/Chicago)

**Not claiming ready for Ben** — parent live-proves with `?autodrive=climb_b`.

## Climb B meshes (verified)
- Asphalt corridor centerline **x=7.00** (crest y=4.20 z=-1.80 → foot y=0 z=12.40)
- Dual story holes foyer ceiling + landing floor include east band x∈[5.4,9.9]
- Landmarks: chevron pylons + asphalt lips at foot/crest (`climb_landmarks`)
- Scenic `climb_b_east` at x=9.0 **beside** asphalt (not under ribbon); lite mesh (7 treads, Lambert, sparse rails) — was 70 meshes → **23**

## Autodrive
- `?autodrive=climb_b` or `?climb=b` (also `climb-b`)
- Poses at Climb B foot on landing (~7, 4.22, -2.55), holds W down to foyer
- Banner **CLIMB B AUTO PASS** when drop≥2.5 **and** `path=climb_b`

## East GPU / SwiftShader
- Scenic stairs densify cut (both A/B companions)
- Pylon lamps → box emissive (no Sphere tessellation)
- Landing south + **armoury south** + **nursery south** full-height Climb B tunnels (hard slab at z≈-1 / z≈0 was killing east look + descent)

## Climb B snap freeze fix
- Segment-joint tie: earlier seg endpoint score == next seg interior → magnet froze car at z≈1.09
- Keep unclamped `tRaw`; +0.12 score when past endpoint so ribbon advances on descent
- `foyerClimb` Y-lock extended to `climb_b`

## Sims
- `climb-b-autodrive-sim.mjs` — **PASS** drop≈2.50 path=climb_b
- `from-scratch-drive-sims.mjs` — **ALL PASS**
- `climb-collider-check.mjs` — Climb A/B **0 hard hits**
- `smoke.mjs` (via smoke-register) — **ALL SMOKE CHECKS PASSED**

## Cache
`?v=drivefix9`

## Artifact
`/workspace/mansion-of-the-unseen.zip` → Drive **file9**
