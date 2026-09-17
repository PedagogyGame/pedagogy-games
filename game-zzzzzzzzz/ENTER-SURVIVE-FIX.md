# Enter/Explore SwiftShader survival — 2026-09-17 (drivefix4)

## What made Enter die again
After `drivefix2` (Drive move lite: Lambert roads, weak fills, no car shadows, FX off),
**Enter → Explore** started killing the GPU process *before* an Explore screenshot.

Root stack on first Explore paint (SwiftShader):

1. **TrackSystem still built ~20 road meshes + canvas textures at boot** (`new DriveMode` → `new TrackSystem` → `_buildAll`). Hidden for Explore, but geometries/textures still existed in the scene graph and competed for GPU memory with the mansion’s first compile/draw.
2. **Explore restored a heavy GPU profile**: `PCFSoftShadowMap` + `pixelRatio ≤ 2` + MSAA when leaving Drive — and that was also the *initial* Enter profile. First foyer frame = soft shadows + high DPR + ~18 PointLights + many `castShadow` meshes.
3. Soft-map / high-DPR Explore was never cut in fix2 (only Drive was).

Not a JS exception — Chrome GPU process death → gray desktop / frozen tab.

## Fixes (`?v=drivefix4`)
| Area | Change |
|------|--------|
| TrackSystem | **Logic-only at boot** (segments + snap grid). **`ensureMeshes()` on first Drive enter** only. Browser defers; Node sims still auto-build. |
| Explore renderer | `antialias: false`, **`pixelRatio ≤ 1`**, **`shadowMap.enabled = false`**, never restore soft/DPR2 |
| Mansion lights | PointLight budget **18 → 4**; shadow spots **0**; key fills = foyer/landing/cellar only, weaker |
| Shadows | Strip all mansion mesh `castShadow`/`receiveShadow` after build |
| Drive | Unchanged lite profile (Lambert roads, weak fills, no FX/car shadows); meshes appear only on Drive enter |

## Live CDP prove (box Chrome SwiftShader, port 9231)
URL: `http://127.0.0.1:8765/index.html?v=drivefix4&nocache=1`

| Step | Result |
|------|--------|
| Boot | ready ~462ms; `[TrackSystem] logic-only … (meshes deferred)` |
| Enter → Explore | **tab alive**; title hidden; roam HUD; shot `/tmp/motu-survive-post-explore.png` |
| Drive toggle | **alive**; driveActive; deferred meshes built in 11ms (`meshes=20`) |
| Hold W ~5s | **alive**; speedo **8 km/h**; shot `post-w` |
| Explore→Drive cycle | eval timed out once under load, but **tab still alive** at end |
| pageerrors | **[]** |

## Sims
- `from-scratch-drive-sims.mjs` — ALL PASS
- smoke / hostile / climb-collider / no-teleport / ramp-approach / wall-cruise / car-stuck — PASS

**Not claiming ready** — parent live-proves before Ben zip.
