# Drive tab-death fix — 2026-09-17

## Root cause
`TrackSystem` built **~212 individual `CylinderGeometry` rail-post meshes** (plus ribbon decks) → **~230 meshes** total. Explore hid them with `setVisible("explore")`. Switching to Drive called `setVisible(true)`, which forced a sudden WebGL upload/draw of hundreds of tiny meshes on top of the mansion scene. On SwiftShader / constrained GPU that kills the GPU process → Chrome vanishes to a gray desktop (not a JS exception).

Secondary risks (hardened, not primary):
- `engineAudio.start()` / `update()` uncaught AudioContext failures
- Non-finite chase-cam after enter (would destabilize WebGL)

## Fix
1. **`js/drive/tracks.js`**
   - Collect rail posts → **one `InstancedMesh`** (`_flushRailPosts`)
   - Lower Catmull visual densification (climb 11×/8× → 4×)
   - Shared side material (no per-strip `MeshStandardMaterial`)
   - Shared asphalt/chevron mats (no per-strip clone)
   - Result: **meshes ≈ 19–20** (was 230)
2. **`js/drive/driveMode.js`**
   - try/catch around `setVehicle`, `setVisible`, `engineAudio.start`
   - `_sanitizeCamera()` after snap + each frame
3. **`js/drive/engineAudio.js`**
   - Guard missing graph nodes; wrap update body; soft-fail gain ramps

## Verify
- `from-scratch-drive-sims.mjs` — ALL PASS
- climb / no-teleport / hostile / ramp-approach / wall-cruise / car-stuck — PASS
- Live CDP: Explore → Drive → Explore → Drive, no pageerrors, Drive HUD + car visible
- Cache bust: `?v=drivefix1`

**Not claiming ready** — parent live-proves again.
