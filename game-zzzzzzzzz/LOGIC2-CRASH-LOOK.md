# logic2 — Climb wall crash + Drive look

**Date:** 2026-09-23 (America/Chicago, CDT)  
**Working tree:** `/workspace/mansion-of-the-unseen/`  
**Cache:** `?v=logic2`  
**Status:** **NOT READY** — parent must live-prove. No Ben-facing ready claim.

---

## What was wrong (logic1 live evidence)

### 1. Climb A wall bury despite green PASS

Playtest `02-climba-pass.png` / `03-landing-solid.png`:

- Telemetry: `on=0 xz=-3.93,3.95 path=climb_a y=2.34` + **CRASH** overlay
- Green **CLIMB AUTO PASS** still showed

**Root causes (stacked):**

| Layer | Failure |
|-------|---------|
| **Autodrive pose** | Harness started at `(-4.2, 0.012, 10.9)` — **east of centerline** `x=-5`. Car rode the east ribbon lip into `holeA_climb` void; camera looked into the floor-cut “wall”. |
| **PASS criteria** | Pass fired on `maxY ≥ 2.5` alone — **no `on=1`, no crest, no crash check**. Crash-freeze path could also green-pass. |
| **Wall openings** | Climb ribbon ±halfW hit **unmarked** hard wall panels the old collider sim ignored (`driveKind` unset → sim only counted `wall`/`pillar`). Cabinet south lip at `x=-5.20`, landing east slab at `x≈8`, study east at `x≈-6`, etc. |
| **Yaw preference** | Bidirectional “match travel” flip at the foot faced **+Z into foyer north wall** when posed on centerline. |

Crash XYZ `(-3.93, 2.34, 3.95)` is **inside** `holeA_climb` (`x∈[-6.35,-3.65]`), ~1.07 m east of asphalt centerline — off-ribbon (`on=0`) against the aperture cut, not a mystery floating collider.

### 2. Drive look — black void + giant yellow squares

- Ambient/hemi too low for Drive; only two weak PointLights → mansion unreadably dark.
- Asphalt canvas was near-black `#050508` with **fat** yellow dashes (lineWidth 12–18) + UV `dist*0.42` → tread looked like oversized glowing squares on pure black.

---

## What changed (logic2)

### Geometry / openings (`js/mansion.js`)

Widened / added full-story climb punches (layout strips kept — no mega holes, no oval steal):

- Cabinet south → `along=-5.00 width=3.90` (was `-3.40/3.60`; west lip clipped ribbon)
- Landing **east + west** full-depth Climb A/B voids
- Study east + south, nursery west — crest bands fullH
- Library hall E/W crest tips → fullH width 5.20
- Foyer/hall/landing/armoury/nursery south climb widths bumped (3.90 / 4.00)

Climb path **width 2.20** (was 2.40) for hole margin (`js/data/tracks.js`).

### Autodrive honesty (`js/drive/driveMode.js`)

- Pose Climb A on **centerline** facing **crest** `(-5, 0.08, 12.15)` yaw≈π; `aimFallback` = crest
- Yaw preference follows **aimFallback** (uphill), not travel-match flip
- Stronger lateral snap to ribbon; off-ribbon yank back
- Climb corridor pierce band = hole strips only (dropped old east mega-hole `x≤-1.85`)
- **PASS A:** `maxY≥3.8` + `on=1` + path `climb_a|landing_hairpin` + **no crash**
- Crash/freeze can no longer green-pass

### Lighting

- Drive enter: hemi **1.05**, moon **0.85**, moonFill **0.42**, lighter fog (`js/main.js` `applyDriveGpuProfile`)
- Fill + climb PointLights stronger/longer range (still **two** only — GPU-lite)

### Asphalt (`js/drive/tracks.js`)

- Gray asphalt `#2a2c32` + grain (not void black)
- Thin white edges + thin yellow dashes
- UV along-track `*0.95`; low emissive so paint doesn’t bloom into squares

### Sims

- `climb-collider-check.mjs`: treats **unmarked thin+tall** AABBs as hard; samples ±0.98·halfW
- `full-update-climb.mjs`: requires maxY≥3.8 + no crash

---

## Sim results (2026-09-23 CDT)

| Suite | Result |
|-------|--------|
| `climb-collider-check.mjs` | **PASS** — 0 hard both climbs (stricter) |
| `full-update-climb.mjs` | **PASS** — centerline `x=-5.00`, `maxY≈3.81`, `on=1`, no crash |
| `climb-b-autodrive-sim.mjs` | **PASS** — `drop=2.50`, `x=7.00` on=1 |
| `logic1-acceptance-sim.mjs` | **ALL PASS** |
| `from-scratch-drive-sims.mjs` | **ALL PASS** (meshes=37) |
| `no-teleport-sim.mjs` | **ALL PASS** |

---

## Parent live-prove checklist

1. `?v=logic2&autodrive=climb` — car stays near `x=-5`, crest with `on=1`, **no CRASH**, no wall-bury camera  
2. Spawn Drive — wood floors/walls readable; asphalt gray with thin white edges + subtle yellow dashes (not black + giant yellow squares)  
3. Climb B autodrive still descends cleanly  

**NOT ready** for Ben zip upload until parent live-proves.
