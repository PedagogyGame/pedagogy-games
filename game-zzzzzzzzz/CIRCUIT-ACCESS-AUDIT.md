# Circuit Access Audit — Drive (?v=logic2)

**Date:** 2026-09-23 (America/Chicago, CDT)  
**Working tree:** `/workspace/mansion-of-the-unseen/`  
**Cache:** `?v=logic2`  
**Scope:** Ben’s three concrete questions on entrances/ramps, tunnels/turns, and circuit interconnect.  
**Method:** Read `js/data/tracks.js`, `js/drive/tracks.js`, mansion apertures/openings; re-run green sim suite; quantitative junction/runway/grade/hole/graph checks.  
**Not a ready claim** — parent still live-proves before Ben zip.

---

## Scorecard

| # | Question | Verdict |
|---|----------|---------|
| 1 | Entrances / on-ramps to vertically inclined portions align & work? | **YES** |
| 2 | Passageways have smooth tunnels and turns? | **YES** |
| 3 | All roads / drivable circuits access one another? | **YES** |

---

## Q1 — Ramp entrances / on-ramps — **YES**

Checks: flat runway ≥2u on SOLID floor before foot; tip flats; grade ≤30%; foot/crest kisses d=0; `RAMP_MOUNT_FEET` consistent; engage `nearDeck` uses correct foot; no triple-kiss; scenic stairs not under road.

### Evidence

- **Solid runways ≥2u:** `foyer_to_climb_a` flat XZ run **2.332 u** on ground plank (ceiling hole ≠ deleted floor). `balcony_to_climb_b` solid pad (x=4.80 &lt; holeB minX=5.65) until hole merge = **11.800 u**. (`logic1-acceptance-sim` `runway-a/b-solid-ge-2` PASS.)
- **Tip flats present:** climb_a tipStart=**0.40 u** / tipEnd=**0.35 u**; climb_b tipStart=**0.35 u** / tipEnd=**0.40 u** (authored y-hold segments at each end).
- **Grade:** both climbs flat run **14.20**, rise **4.20**, mean **0.296**, maxSeg **0.313** (≤ `RAMP_MAX_GRADE` 0.30 + 0.02 tip allowance used by acceptance; mean under 30%).
- **Junction kisses d=0** on every PRIMARY chain edge including S/F close: all eight `kiss-*` checks d=0.0000.
- **`RAMP_MOUNT_FEET`:** both climbs `foot.y=0` (LOW), `crest.y=4.2`; Climb B foot `(7,0,12.70)`, crest `(7,4.2,-1.50)` — naming fixed vs pre-logic1 invert. Approaches: A→`foyer_to_climb_a`, B→`balcony_to_climb_b`.
- **`nearDeck` engage:** A uses `FOYER_CLIMB_FOOT`; B uses `CLIMB_B_FOOT` when y≤1.2 and `CLIMB_B_CREST` when y≥3.5 (`js/drive/tracks.js:1134–1147`) — not the old Climb-A-foot copy-paste.
- **No triple-kiss:** endpoint cluster within 0.75 m has ≤1 neighbor each (`unique-junction-no-triple` PASS). Oval removed from circuit.
- **Scenic stairs clear:** ground-ribbon ∩ scenic AABB hits=0; Climb A/B centerlines scenicHits=0. Newel at `(-2.20,4.20,2.20)` on solid (not in hole); hairpin centerline minD=**1.387** (need ≥1.35); ribbon edge-to-newel ≈**0.19 u** clear.
- **Flat y=4.2 hole occupancy:** landing_hairpin / balcony_arc / balcony_to_climb_b → **0** non-kiss samples over climb holes (kiss-band only at crest merges).

### Sims (2026-09-23 CDT)

| Suite | Result |
|-------|--------|
| `logic1-acceptance-sim.mjs` | **ALL PASS** |
| `from-scratch-drive-sims.mjs` | **ALL PASS** (meshes=37) |
| `no-teleport-sim.mjs` | **ALL PASS** |
| `climb-collider-check.mjs` | **PASS** 0 hard both climbs |
| `full-update-climb.mjs` | **PASS** maxY≈3.81 on=1 no crash |
| `climb-b-autodrive-sim.mjs` | **PASS** drop=2.50 on=1 |

---

## Q2 — Smooth tunnels & turns — **YES**

Checks: real aperture/drive opening where path crosses wall/floor; climb corridor holes match path; hairpin clearance vs newel; no sharp self-overlap; tunnels wide enough for car.

### Evidence

- **Climb holes match asphalt:** `holeA_climb` x∈[-6.35,-3.65], `holeB_climb` x∈[5.65,8.35], z∈[-2.60,13.00]; climbs at x=**-5** / **+7**, width **2.20** → ribbon ±1.10 inside strips. Separate scenic cuts do not host asphalt.
- **Drive openings punch climb corridors** (`_driveOpeningsForWall`), e.g. foyer/hall N–S at along=±5/7 widths **3.90/4.00** fullH; cabinet south −5.00/3.90; armoury south 7.00/4.00; landing E/W full-depth; study/nursery/library crest bands fullH width up to **5.20–7.0**. Opening width ≫ car/ribbon (**2.2**).
- **Collider proof:** `climb-collider-check.mjs` samples centerline + ±0.85/0.98·halfW @ y+0.22/0.48 vs hard wall/pillar (incl. unmarked thin+tall) → **0 hard** both climbs.
- **Hairpin:** self-prox pairs &lt;1 m = **0**; newel clearance as in Q1; no spaghetti double-back.
- **Balcony not floating:** exterior balcony floorRegions exist (`roomId=balcony` deck z≈12.1–17.5 + connection strip z≈9.5–12.2 @ y=4.2). Dense sample of `balcony_arc` + all other flats: **0** missing plank under centerline.
- **Landing French doors / climb voids** on landing south keep crest handoff from dead-ending into slabs (logic2 widened east/west).

### Minor note (not a fail)

- Opening set is still large (multi-room fullH punches) — readable house vs Swiss-cheese tension remains a live-prove look item, but apertures **exist and match** the path (Q2 bar).

---

## Q3 — Road / circuit interconnect — **YES**

Checks: `PRIMARY_CIRCUIT` one connected open loop; list every drive path/mesh; orphans / dead-ends / closed non-members / Explore-only; reach every asphalt from spawn without teleport.

### Every drive path / mesh (complete inventory)

| # | Path id | Kind | Width | Closed | In PRIMARY | Role |
|---|---------|------|------:|:------:|:----------:|------|
| 1 | `foyer_sf` | floor | 2.4 | no | yes | S/F open arc |
| 2 | `foyer_to_climb_a` | floor | 2.4 | no | yes | Ground runway → A foot |
| 3 | `climb_a` | ramp | 2.2 | no | yes | Foot→crest |
| 4 | `landing_hairpin` | floor | 2.4 | no | yes | Crest→balcony |
| 5 | `balcony_arc` | balcony | 2.4 | no | yes | Open north balcony arc |
| 6 | `balcony_to_climb_b` | floor | 2.4 | no | yes | Solid pad → B crest |
| 7 | `climb_b` | ramp | 2.2 | no | yes | Crest→foot |
| 8 | `foyer_finish` | floor | 2.4 | no | yes | B foot → S/F |

- **`TRACK_PATHS.length === PRIMARY_CIRCUIT.length === 8`** — no secondary / Explore-only asphalt paths.
- **Meshes:** deferred build reports **37** (≤40 budget); Explore never pays road GPU at boot (`exploreHint` only).

### Graph

- Endpoint adjacency (d&lt;0.05): every path degree **2** → **single open loop**.
- BFS from `foyer_sf`: all 8 reachable; **unreachable = []**; **orphans = []**.
- Chain kisses all **d=0** (see Q1). No dead-end that fails to reconnect; no closed loop sitting outside the circuit (`foyer_oval` / `balcony_loop` removed).
- Spawn `(0.00, 0.012, 10.40)` snaps `onTrack` path=`foyer_sf`. `no-teleport-sim` PASS (no distant path flip / yank). `from-scratch` drove foyer → spur → climb A → hairpin → balcony → climb B → finish with on-ribbon proofs.

**Answer:** every asphalt segment is a PRIMARY member and is graph-reachable from spawn along kissed junctions without teleport.

---

## Top remaining gaps (none block YES; parent live-prove)

1. **Live Drive still required** — logic2 notes Climb A wall-bury was a playtest failure despite earlier green sims; autodrive/PASS honesty + openings were fixed, but parent must prove `?v=logic2&autodrive=climb` visually.
2. **maxSeg 0.313** slightly over pure 30% (accepted as tip-segment); tighten tip easing only if live feel is harsh.
3. **Hairpin edge↔newel ~0.19 u** — legal but tight; if live clip, nudge hairpin waypoints east or shrink pillar.
4. **Opening Swiss-cheese look** — functional, may still read as punched house; cosmetic/layout polish only.
5. **Legacy sims** (`core-tour-sim`, `drive-sim`, etc.) still name removed paths — outside green suite; ignore or retire.

### Concrete XYZ fixes (only if live fails) — do not implement here

| If… | Fix |
|-----|-----|
| Climb A west lip clip | Cabinet/study south opening already −5.00/3.90; verify live at `(-5,y,z)` on=1 |
| Hairpin newel rub | Move hairpin pts near `(-0.55,4.2,2.90)` further east, or newel to `(-2.50,4.2,2.20)` |
| Grade harsh at tip | Lengthen tip flats from 0.35→~0.6 u on climb_* ends |
| Balcony off-ribbon | Confirm `balcony_arc` stays in deck x∈[-5.75,6.75] z∈[12.1,17.5] + strip |

---

## Sim command reference

```bash
cd /workspace/mansion-of-the-unseen
node --import ./smoke-register.mjs logic1-acceptance-sim.mjs
node --import ./smoke-register.mjs from-scratch-drive-sims.mjs
node --import ./smoke-register.mjs no-teleport-sim.mjs
node --import ./smoke-register.mjs climb-collider-check.mjs
node --import ./smoke-register.mjs full-update-climb.mjs
node --import ./smoke-register.mjs climb-b-autodrive-sim.mjs
```

**Artifact:** `/workspace/mansion-of-the-unseen/CIRCUIT-ACCESS-AUDIT.md`
