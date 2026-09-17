# Drive move-time GPU death fix — 2026-09-17

## Root cause
Explore → Drive toggle was OK after the InstancedMesh rail fix (~19 meshes). **Holding W** then killed Chrome’s GPU process → gray desktop (not a JS exception).

While moving, cost stacked on SwiftShader:

1. **Chase `PointLight` fill** at intensity **9.0 / distance 16**, repositioned **every frame** → full-scene `MeshStandardMaterial` re-light as the car advanced into new rooms.
2. **+ climb mid fill** (3rd Drive PointLight at 6.2) on top of mansion’s ~18 PointLights.
3. **Car meshes `castShadow = true`** + Explore `PCFSoftShadowMap` → shadow-map redraw every frame as the caster moved.
4. **Move FX** (14 speed lines + 10 **Standard** dust + 16 sparks) becoming visible / lit while translating.
5. Road ribbons still **MeshStandard** × moving fill.

Idle Drive (0 km/h) looked fine because fill/camera/casters were static.

## What we cut
| Area | Change |
|------|--------|
| Drive lights | **fill + climb foot only**; intensities **2.4 / 1.8**, short distance; **climbMid never enabled**; fill follows every **other** frame |
| FX | `_liteGpu`: **0** speed/dust/spark meshes; smash **6× BasicMaterial** only |
| Car | all **`castShadow = false`** |
| Roads | asphalt/chevron/rail/side/boost → **MeshLambert** (no Standard under moving fill) |
| Renderer (Drive) | `pixelRatio ≤ 1`, **`BasicShadowMap`**; Explore restores soft + prior DPR |
| NaN | `_sanitizeCar()` + stronger camera/car finite guards |

Cache bust: `?v=drivefix2`

## Sims
- `from-scratch-drive-sims.mjs` — ALL PASS
- climb-collider / no-teleport / hostile / ramp-approach / wall-cruise / car-stuck — PASS

**Not claiming ready** — parent live-proves: Enter → Explore → Drive → hold W 5s → Explore → Drive → hold W again; Chrome must stay open.
