# Track Redesign — logic1

**Date:** 2026-09-22 (America/Chicago, CDT)  
**Working tree:** `/workspace/mansion-of-the-unseen/`  
**Cache:** `?v=logic1`  
**Source brief:** `ROADS-LOGIC-AUDIT.md` sections A–C + rebuild order  

## NOT READY

Parent must live-prove Drive before any Ben zip upload. This pass redesigns layout so roads sit in real house volumes; it does **not** claim a shippable Driver experience.

---

## What changed

### 1. House apertures + newel (`js/mansion.js`)

Mega climb holes replaced with corridor + scenic strips:

| ID | Bounds |
|----|--------|
| `holeA_climb` | minX=-6.35 maxX=-3.65 minZ=-2.60 maxZ=13.00 |
| `holeA_scenic` | minX=-8.80 maxX=-6.40 minZ=2.00 maxZ=10.50 |
| `holeB_climb` | minX=5.65 maxX=8.35 minZ=-2.60 maxZ=13.00 |
| `holeB_scenic` | minX=8.20 maxX=9.90 minZ=2.00 maxZ=10.50 |

- Foyer ceiling + landing floor return all four.
- Cornice `climbGaps` match the same four strips.
- Landing newel hard pillar moved to **(-2.20, 4.20, 2.20)** (solid deck, east of hole A).

### 2. Open PRIMARY_CIRCUIT (`js/data/tracks.js`)

Closed `foyer_oval` + `balcony_loop` removed as lap segments. New open circuit:

`foyer_sf → foyer_to_climb_a → climb_a → landing_hairpin → balcony_arc → balcony_to_climb_b → climb_b → foyer_finish` → S/F

Widths **2.4**. All authored junctions **d=0**. Grades mean ≈0.296, maxSeg ≈0.313 (≤30% + tiny tip).

### 3. Drive snap / meshes (`js/drive/tracks.js`)

- Path-id retarget: `foyer_sf`, `balcony_arc`.
- Removed oval-steal `junctionBias` (+0.95 / −1.85 war) — unique Climb B foot kiss.
- Climb B `RAMP_MOUNT_FEET.foot` = **LOW** `(7, 0, 12.70)`; crest = upper `(7, 4.2, -1.50)`.
- `nearDeck` for Climb B uses **B foot** at foyer / **B crest** on landing (no longer Climb A foot copy-paste).
- Junction flow chevrons retargeted; corner chevrons on hairpin + balcony_arc.
- Polish 1,2,5,6,7,8,9 retained (crest/tip soften, hysteresis, no teleport).
- Mesh budget: **37** meshes (≤40), thick asphalt decks, feet chevrons only.

### 4. Autodrive poses (`js/drive/driveMode.js`)

Climb B harness poses at **crest** (upper); aim foot z=12.70. Climb A aim foot z=12.70.

### 5. Sims

- Updated: `from-scratch-drive-sims.mjs`, `no-teleport-sim.mjs`, `smoke.mjs`, `hostile-climb-sim.mjs`, `climb-collider-check.mjs`.
- Added: `logic1-acceptance-sim.mjs` (§C checks).

---

## Key XYZ table

| Path | Kind | Anchors |
|------|------|---------|
| `foyer_sf` | floor open | S/F `(0,0,10.40)` → `(-5.20,0,10.40)` |
| `foyer_to_climb_a` | floor | `(-5.20,0,10.40)` → `(-5.00,0,12.70)` runway ≥2 u |
| `climb_a` | ramp | Foot `(-5,0,12.70)` → Crest `(-5,4.2,-1.50)` flat=14.2 |
| `landing_hairpin` | floor | Crest → due east `(-3.55,4.2,-1.50)` → around newel `(-2.20,4.2,2.20)` → `(4.20,4.2,9.20)` |
| `balcony_arc` | balcony open | `(4.20,4.2,9.20)` → north arc → `(4.80,4.2,11.00)` |
| `balcony_to_climb_b` | floor | Solid x=4.80 runway → merge `(7,4.2,-1.50)` |
| `climb_b` | ramp | Crest `(7,4.2,-1.50)` → Foot `(7,0,12.70)` |
| `foyer_finish` | floor | `(7,0,12.70)` → `(0,0,10.40)` |
| Spawn | — | `(0.00, 0.012, 10.40)` yaw −π/2 |

---

## Sim results (2026-09-22 CDT)

| Suite | Result |
|-------|--------|
| `logic1-acceptance-sim.mjs` | **ALL PASS** (hole occupancy, unique junction, hairpin self-prox, newel clear, scenic∩ribbon, grade, runways, mounts) |
| `from-scratch-drive-sims.mjs` | **ALL PASS** (incl. gpu-lite meshes=37, dual strips n=4, newel, climbs) |
| `no-teleport-sim.mjs` | **ALL PASS** |
| `climb-collider-check.mjs` | **PASS** (0 hard both climbs) |
| `full-update-climb.mjs` | **PASS** Climb A autodrive |
| `climb-b-autodrive-sim.mjs` | **PASS** Climb B (drop≥2.5) |
| `smoke.mjs` | **ALL SMOKE CHECKS PASSED** |

Legacy sims that still name removed secondary paths (`core-tour-sim`, `drive-sim`, `car-phys-sim`, `drive-sim-detail`, `last-chance-drive-check`) were **not** fully retargeted this pass — they predate primary-only and are outside the audit’s green suite.

---

## Success criteria checklist

- [x] Flat y=4.2 path samples on solid planks (not inside climb holes) except ramp corridor kisses  
- [x] No triple kiss at B foot; scenic stairs clear of foyer ribbon  
- [x] Sims green (primary suite + new acceptance)  
- [x] Cache `?v=logic1`  
- [ ] **NOT ready** — parent live-prove before Ben zip  

## Artifacts

- Report: `/workspace/mansion-of-the-unseen/TRACK-REDESIGN-LOGIC1.md`
- Zip on disk: `/workspace/mansion-of-the-unseen/mansion-of-the-unseen.zip` (refreshed for parent; do not upload to Ben yet)
