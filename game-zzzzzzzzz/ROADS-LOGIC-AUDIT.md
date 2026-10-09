# Roads Logic Audit — Drive figure-8 (ramps1)

**Date:** 2026-09-22 (America/Chicago)  
**Working tree:** `/workspace/mansion-of-the-unseen/`  
**Cache:** `?v=ramps1`  
**Scope:** `js/data/tracks.js`, `js/drive/tracks.js`, house floors/holes/stairs in `js/data/rooms.js` + `js/mansion.js`  
**Not claiming ready. No rebuild in this pass.**

---

## Verdict: **NOT LOGICAL**

Sims are mostly green (snap magnets + wide engage radii + giant dual floor holes make the car *feel* supported). That is **not** the same as a track that lives inside real house volumes. Layout and physics are fighting each other; Ben’s “impossible challenge for parameters” diagnosis is correct.

---

## Ranked breaks (what Ben would hate)

### 1. Flat landing roads float over Climb A / Climb B floor holes (CRITICAL)

Landing floor apertures (`js/mansion.js` `_storyApertures`, floor+landing):

| Hole | Bounds |
|------|--------|
| A | `minX=-8.80 maxX=-3.70 minZ=-3.00 maxZ=13.10` |
| B | `minX=5.40 maxX=9.90 minZ=-3.00 maxZ=13.10` |

Author flat paths at `y=4.20` that sit **inside** those voids (sampled along authored segments @ 0.25 m):

| Path | Samples @ y=4.2 | Over hole | Evidence |
|------|----------------:|----------:|----------|
| `landing_hairpin` | 135 | **56%** | pts `(-5.00,4.20,-2.35)` … `(-6.60,4.20,-0.30)` over **A** — `js/data/tracks.js:110–123` |
| `balcony_to_climb_b` | 77 | **86%** | `(5.70,4.20,10.50)` → `(7.00,4.20,-2.35)` over **B** — `:170–178` |
| `balcony_loop` | 149 | **18%** | east/west lips `(5.40,4.20,11.20)`, `(-5.10,4.20,13.00)` — `:145–155` |

Landing deck grid sample (0.5 m): **45.5% void**. Almost half the first-floor deck is gone, then the “floor” ribbons are drawn across empty air. Physics must invent support (ribbon snap / nearDeck) because there is no plank under the wheels.

**Bar broken:** roads sit IN the house on real floors; real holes only where climbs pass.

### 2. Hairpin is spaghetti around a newel planted in the void (CRITICAL)

- Newel hard pillar: `(-5.50, 4.20, -0.20)` — `js/mansion.js:2317–2332`
- That XYZ is **inside hole A** (void). Pillar has no floor.
- `landing_hairpin` doubles back on itself: authored pts **1** `(-4.85,-1.35)` and **10** `(-4.80,-1.35)` are **xzDist=0.050 m** (`tracks.js:113` vs `:122`).
- Inner edge vs newel at pt8 `(-6.60,-0.30)`: centerline R≈1.105, halfW=1.20 → **inner_edge ≈ −0.10 m** (ribbon clips hard pillar).

**Bar broken:** Mario Kart readability; pillars hard without eating the lane; hairpin on solid landing.

### 3. Climb B “runway” is a 17 m diagonal down the void (CRITICAL)

`balcony_to_climb_b` (`tracks.js:164–178`):

```
(5.00,4.20,14.80) → (5.70,4.20,10.50) → (6.50,4.20,5.50) → (7.00,4.20,1.50)
  → (7.00,4.20,-0.35) → (7.00,4.20,-2.35)  // kiss climb_b crest
```

Constant-X=7 Z-run ≈ 3.85 m looks like a ≥2 u runway on paper, but **almost all of it is over hole B**. There is no solid east-landing pad before the ramp foot/crest. Grade/engage tuning cannot fix “approach is air.”

### 4. Foyer west oval drives through scenic stairs (HIGH)

- Scenic `main_up`: `x=-7.6`, `z=10.5`, `dir=north`, `width=2.2`, `length=8.5` → AABB **x∈[-8.7,-6.5], z∈[2.0,10.5]** (`rooms.js:17`, stair build `mansion.js:3379–3381`).
- `foyer_oval` west cruise: `(-7.00,0,12.20)`, `(-7.00,0,9.00)`, `(-7.00,0,5.50)` — `tracks.js:39–41`.
- Ribbon halfW=1.25 → asphalt spans ≈`[-8.25,-5.75]` — overlaps stair band.

**Bar broken:** scenic stairs BESIDE climbs, never under/as the road; house-scale clear lanes.

### 5. Triple ribbon kiss + oval steal at Climb B foyer foot (HIGH)

Co-located at **`(7.00, 0.00, 12.75)`**:

- `climb_b` foot label — `tracks.js:202`
- `foyer_finish` start — `:214`
- `foyer_oval` east point — `:51`

`querySnap` already special-cases this with junctionBias **+0.95** to *block* oval and **−1.85** to force `foyer_finish` (`js/drive/tracks.js:1013–1024`). That is physics cheating because three paths share one XYZ. Crest magnets / path steal are authored in.

Also: `balcony_loop → balcony_to_climb_b` kiss **d=0.200** (`(5.20,4.20,14.80)` vs `(5.00,4.20,14.80)`) — only non-zero junction gap on PRIMARY_CIRCUIT.

### 6. Mega-holes force wall tunnels everywhere (MEDIUM–HIGH)

Because holes span stair+corridor as one rectangle, mansion must punch full-height drive openings through foyer/hall/cabinet/armoury/landing/nursery (`_driveOpeningsForWall`, `mansion.js:2981–3111`). Climb corridors leave the foyer volume (x=±5/7 vs hall width ±3.6) and rely on multi-room wall cheese. Readable “house circuit” becomes “ribbon through Swiss cheese.”

### 7. Snap / engage cheats that only exist because layout is wrong (MEDIUM)

Evidence in `js/drive/tracks.js`:

| Cheat | Where | Why it exists |
|-------|-------|----------------|
| `corridorMul=2.25`, `contMul=2.55` on climb A/B | `:905–910` | Keep car glued when geometry is hostile |
| `FOYER_CLIMB_ENGAGE_R ≈ 2.6 m` | `:118–123` | Fat foot magnet |
| Climb B nearDeck apron still measures **`FOYER_CLIMB_FOOT` (Climb A)** | `:1131–1134` | Copy-paste; B floor apron wrong |
| Climb B `RAMP_MOUNT_FEET.foot` = upper `(7,4.2,-2.35)`, `.crest` = ground | `data/tracks.js:313–318` | Path order inverted vs Climb A naming — engage semantics confusing |
| Crest release softens rampBias×0.12 | `drive/tracks.js:973–987` | Fight tip magnets |
| Oval steal penalty at B foot | `:1019–1024` | Triple kiss |
| `_assignSegmentGradeBank` clamps grade to **±0.20 rad** | `:313` | Softens authored 30% feel |

### 8. Closed loops as circuit segments blur lap direction (MEDIUM)

`PRIMARY_CIRCUIT` includes **closed** `foyer_oval` + `balcony_loop` (`data/tracks.js:329–338`). Lap intent is “touch then leave,” but meshes are full rings — Driver clarity suffers (which way is the lap?).

### Grades / widths (OK on paper, not the problem)

| Climb | Foot | Crest | Flat run | Rise | Mean | MaxSeg |
|-------|------|-------|---------:|-----:|-----:|-------:|
| A | `(-5.00,0.00,12.75)` | `(-5.00,4.20,-2.35)` | 15.10 | 4.20 | 0.278 | **0.300** |
| B | path `(7.00,4.20,-2.35)` → `(7.00,0.00,12.75)` | (same) | 15.10 | 4.20 | 0.278 | **0.300** |

Widths 2.4–2.5 (house-scale). Tip flats on ramps only **0.55 m** each; approaches claim ≥2 u but B’s approach is over void (#3).

---

## Sims run (2026-09-22 CT)

| Suite | Result | Note |
|-------|--------|------|
| `from-scratch-drive-sims.mjs` | **ALL PASS** | Does **not** assert “flat path over hole = fail” |
| `climb-collider-check.mjs` | **PASS** (0 hard) | Centerline vs walls only |
| `no-teleport-sim.mjs` | **ALL PASS** | Hysteresis gates hold |
| `full-update-climb.mjs` | **PASS** Climb A autodrive | Magnetized ribbon |
| `climb-b-autodrive-sim.mjs` | **PASS** Climb B | Same |
| `smoke.mjs` | **ALL SMOKE CHECKS PASSED** | Dual-holes present ≠ dual-holes logical |

**Green sims ≠ logical roads.** They prove the cheat stack works.

---

## Layout-vs-physics conflicts

These are places the **authored track fights the house**, so parameters/snap must cheat. Fix layout first; do not retune magnets.

1. **Hairpin / B-approach demand solid `y=4.2` planks; landing holes delete those planks.**  
   Conflict: `landing_hairpin` + `balcony_to_climb_b` @ `y=4.2` vs `_storyApertures` hole A/B.  
   Physics response: ribbon is the only “floor”; `querySnap` `onTrack`/`supported` without story plank.

2. **Newel is a hard pillar in mid-air.**  
   Conflict: newel `(-5.50,4.20,-0.20)` ∈ hole A; hairpin ribbon clips it (inner_edge &lt; 0).  
   Physics response: hard bounce mid-turn with no visual floor — feels broken, not “skill.”

3. **≥2 u runway bar vs hole B under the entire east approach.**  
   Conflict: runway length measured in XZ ignores “is there a floor?”  
   Physics response: `nearDeck` / ramp continuity keeps car on asphalt over void.

4. **Three paths, one foyer XYZ at Climb B foot.**  
   Conflict: `foyer_oval` ∩ `climb_b` ∩ `foyer_finish` at `(7,0,12.75)`.  
   Physics response: hand-authored junctionBias war (`drive/tracks.js:1013–1024`).

5. **West oval wants wall-cruise at x=-7; scenic stairs occupy that band.**  
   Conflict: `foyer_oval` vs `main_up` AABB.  
   Physics response: stairs are scenic (soft / non-drive ramps) so car can skim them — reads as “driving the stairs.”

6. **Climb corridors leave room envelopes; walls must open full-height tunnels.**  
   Conflict: climb x=±5/7 vs `hall_ground` width ±3.6; crest z=-2.35 past landing south.  
   Physics response: `_driveOpeningsForWall` Swiss cheese — without it, collider sims fail; with it, house stops reading as a house.

7. **Climb B foot/crest naming inverted in `RAMP_MOUNT_FEET` + nearDeck uses Climb A foot for both.**  
   Conflict: engage helpers disagree with geometric “foot = low end.”  
   Physics response: oversized engage radii paper over wrong apron tests.

**Bottom line:** you cannot tune grade, width, or magnet strength into a coherent Driver game while flat lanes are drawn on punched voids and three ribbons share one point. **Track must be redesigned to match house volumes.**

---

## What “logical” would look like (this mansion)

1. **One open PRIMARY_CIRCUIT** (no closed oval/balcony as lap segments): foyer arc → Climb A → solid landing hairpin → short balcony arc → Climb B → foyer finish → back to S/F. Direction obvious without junctionBias wars.
2. **Holes = climb strips (+ optional separate scenic stair cuts), not mega-rectangles.** Climb ribbon ± curb only; landing center stays solid wood.
3. **Every flat segment at y=0 or y=4.2 has plank under centerline ± halfW** (assert in sim). Ramps alone may occupy holes.
4. **≥2 u flat runway on solid floor** immediately before each ramp foot/crest engage; ramp tip pads can stay short.
5. **Mean/maxSeg grade ≤30%**; rise 4.2 ⇒ flat run ≥14 m on climbs.
6. **Scenic stairs stay BESIDE** (west x≈-7.6, east x≈9.0); drive corridors east of west stairs / west of east stairs with visible gap.
7. **Newel on solid landing** east of hole A; hairpin inner R ≥ 1.5 clear of pillar; no self-overlapping waypoints.
8. **House-scale lanes** (≈2.2–2.8 m); pillars/walls hard; no track-to-track teleport — junctions kissed d=0 with a single successor path.

---

## Redesign brief (concrete XYZ — do not implement yet)

House refs: foyer `pos[0,0,6] size[18,4.2,14]` → x∈[-9,9] z∈[-1,13]; landing `pos[0,4.2,4] size[16,4,12]` → x∈[-8,8] z∈[-2,10]; floors **0 / 4.2**; scenic `main_up` x=-7.6, `climb_b_east` x=9.0.

### A) Re-cut apertures (mansion)

Replace mega holes with **corridor strips** (+ optional scenic-only cuts):

| ID | Purpose | Proposed bounds |
|----|---------|-----------------|
| `holeA_climb` | Climb A asphalt only | `minX=-6.35 maxX=-3.65 minZ=-2.60 maxZ=13.00` |
| `holeA_scenic` | West stairs (Explore/ceiling) | `minX=-8.80 maxX=-6.40 minZ=2.00 maxZ=10.50` |
| `holeB_climb` | Climb B asphalt only | `minX=5.65 maxX=8.35 minZ=-2.60 maxZ=13.00` |
| `holeB_scenic` | East stairs | `minX=8.20 maxX=9.90 minZ=2.00 maxZ=10.50` |

Landing floor + foyer ceiling return `[holeA_climb, holeA_scenic, holeB_climb, holeB_scenic]` (or merge scenic into Explore-only if Drive never needs them). **Solid landing band** roughly x∈[-3.5, 5.5] between climb strips.

### B) Figure-8 path anchors (proposed)

Widths: floors/balcony **2.4**, climbs **2.4**. All junctions **d=0**.

| # | Path | Kind | Key XYZ (proposed) |
|---|------|------|--------------------|
| 1 | `foyer_sf` | floor open arc | S/F `(0.00,0.00,10.40)` → west **inside** stairs: `(-5.20,0,10.40)` → `(-5.20,0,12.40)` (not x=-7) |
| 2 | `foyer_to_climb_a` | floor | Runway on ground plank: `(-5.20,0,10.40)` → `(-5.00,0,11.00)` → `(-5.00,0,12.00)` → `(-5.00,0,12.50)` (**≥2 u** @ x=-5) |
| 3 | `climb_a` | ramp | Foot `(-5.00,0.00,12.50)` → Crest `(-5.00,4.20,-1.50)` · flat≈14.0 · rise 4.2 · mean≈0.30 · tip flats ~0.5 u |
| 4 | `landing_hairpin` | floor | **Exit hole immediately east onto solid:** `(-5.00,4.20,-1.50)` → `(-3.40,4.20,-1.20)` → `(-2.40,4.20,0.40)` → around **newel `(-2.20,4.20,2.20)`** (move pillar here) → `(-2.20,4.20,4.00)` → `(-0.50,4.20,6.50)` → `(2.50,4.20,8.20)` → `(4.20,4.20,9.20)` |
| 5 | `balcony_arc` | balcony open | `(4.20,4.20,9.20)` → `(4.50,4.20,12.50)` → `(3.00,4.20,14.50)` → `(0.00,4.20,15.20)` → `(-2.00,4.20,14.20)` → back east **avoiding hole strips** to `(4.80,4.20,11.00)` (do **not** close a full ring as a circuit segment) |
| 6 | `balcony_to_climb_b` | floor | **Solid east pad runway then enter strip:** `(4.80,4.20,11.00)` → `(4.80,4.20,6.00)` → `(4.80,4.20,1.00)` → `(4.80,4.20,-0.80)` (**≥2 u** on solid, x=4.80 &lt; holeB minX) → merge `(5.80,4.20,-1.50)` → `(7.00,4.20,-1.50)` kiss |
| 7 | `climb_b` | ramp | Crest/start `(7.00,4.20,-1.50)` → Foot `(7.00,0.00,12.50)` · mirror A · **RAMP_MOUNT_FEET.foot = low end** |
| 8 | `foyer_finish` | floor | `(7.00,0,12.50)` → `(3.50,0,11.00)` → `(0.00,0,10.40)` — **do not** co-list this XYZ on `foyer_oval` |

S/F spawn unchanged intent: `(0.00, 0.012, 10.40)`, yaw toward Climb A (−π/2).

### C) Non-negotiable acceptance checks (add to sims)

1. For every non-ramp sample on centerline ± halfW: either `y≈0` with foyer/ground plank, or `y≈4.2` with landing plank (**not** inside climb holes).  
2. Junction successor unique within 0.75 m (no triple kiss).  
3. Hairpin self-proximity: no two non-adjacent waypoints with xzDist &lt; 1.0 m.  
4. Newel boxDist to centerline ≥ halfW + 0.15.  
5. Scenic stair AABB ∩ ground ribbon AABB = ∅.  
6. Grade ≤30%; runway solid length ≥2.0 u; kiss d=0; PRIMARY_CIRCUIT connected.

---

## Recommended rebuild order (smallest → logic)

1. **Re-cut `_storyApertures` / climbGaps** to corridor+scenic strips (unlocks solid landing). Move newel to solid `(-2.20,4.20,2.20)`.  
2. **Rewrite `landing_hairpin` + `balcony_to_climb_b`** onto solid deck (fixes #1–#3).  
3. **Retarget `foyer_oval` / replace with open `foyer_sf`** — pull west cruise off scenic stairs; remove Climb B foot co-point from oval.  
4. **Normalize Climb B path + `RAMP_MOUNT_FEET`** (foot=low); fix nearDeck to use B foot; delete oval-steal junctionBias hacks once unique kiss exists.  
5. **Open `balcony_arc`** (drop closed loop as circuit member); kiss chevrons only at real handoffs.  
6. **Add hole-occupancy + unique-junction sims**; only then touch magnet radii / polish.

Do **not** start with magnet/grade retune. Do **not** claim ready until acceptance checks above pass on the redesigned paths.

---

## File index

| File | Role |
|------|------|
| `js/data/tracks.js` | Path XYZ, PRIMARY_CIRCUIT, grades, mounts |
| `js/drive/tracks.js` | Meshes, snap, chevrons, engage cheats |
| `js/data/rooms.js` | Floor Y, scenic stair anchors |
| `js/mansion.js` | `_storyApertures`, `_driveOpeningsForWall`, newel, stairs |
| This report | `/workspace/mansion-of-the-unseen/ROADS-LOGIC-AUDIT.md` |
