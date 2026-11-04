# LOGIC32 notes (Ben 9:22 / 9:23 AM Nov 4)

## Spot 1: "found another spot" (s32/ben/1.png)
- Location: Upper Landing south edge → balcony approach (y 4.20, x −9…9, z 10…12.8).
- The "tan plane" was the top of the Grand Foyer CEILING slab (0x6b5d52, emissive, so it reads beige-tan). Its top is 4.178, 2.2 cm below the story line.
- Planes there:
  - landing planks at 4.200 (purple, to z 10);
  - the old approach boards, only 8.5 m wide (x −3.75…4.75, z 9.6…12.8, top 4.200);
  - the foyer ceiling slab (x −9…9, z 10.5…13, top 4.178), exposed everywhere the boards did not reach and seen through the seams;
  - the balcony deck at 4.200 (x −5.75…6.75, z 12.1…17.5).
- Physics also had a filled_top at 4.178 there, plus doorway brass thresholds that were 5 cm kerbs (gold strip 4.207–4.253 at the landing door, foyer z 13 at 0.006–0.054, 27 in total).
- Fix: approach panels tile the whole gap flush at 4.200. They butt the landing (z 10), the deck (z 12.1) and the front wall (z 12.81) with no coplanar overlap. The stair-foot apertures (x −8.8…−6.4 and 8.2…9.9 to z 10.5) are left open. Matching floorRegions were added. Thresholds are now 8 mm inlays.

## Spot 2: "invisible barrier" (s32/ben/2_invisible_barrier.png)
- Location: under the foyer's west open-riser scenic stair (x −8.7…−6.5, z 2…10.5, 7 floating treads).
- Cause: the underside slab collider [−8.62,−0.15,2.08]-[−6.58,0.92,10.42] filled the whole open space under the flight. The two stringer boxes also ran full height along both sides.
- Fix: Drive replaces both with per-tread boxes (tread volume; stringers cut per tread from the tread bottom to 0.55 m above the tread top). Explore keeps the old boxes. The same applies to every builder stair (east stair too).
- Scan: `_c.mjs` checks every 0.1 m cell on story floors that is blocked, then raycasts for a visible mesh within r+6 cm. The stair was the largest cluster (1862 cells). The other clusters were wall-line padding, ramp keels (visible underfill) and furniture boxes.
- Not changed: furniture tops are "block" down to the floor, so the space under tables is solid in Drive (logic8 rule: every solid is hard). This is a broader design change and is left for Ben to decide.

## Steering (car.js STEER)
- rampT 0.32→0.35, ease 1.25→1.35, buildRate 9.0→7.8. YAW_MAX is unchanged (2.214 rad/s), so full-lock hairpins keep their circle.
- At cruise 1.34 m/s:
  - 0.1 s tap: 2.0°→1.5° (−25%);
  - 0.3 s tap: 23.0°→19.1° (−17%);
  - 0.6 s hold: 61.8°→58.9° (−5%).

## logic32-sim
4 tests: landing-balcony flush, thresholds flush, no barrier under the stair (drives through both ways), softer steering.

## Suite run 1
- Failures: L26-no-drive-through-props (2) and L28-gap-scan (1). Both came from the stair change, not from weakened tests.
  - Two support blocks under the landing→attic stair (−2.4, 4.2, 2.9/3.9) got no auto-collider, because the auto-prop pass still saw the old underside block as covering them. Fixed: the auto-prop pass is now judged against the treads.
  - A 13 cm slot opened between the foyer west stair's bottom tread and the wall. Fixed with SLOT_FILLERS28 entry [−8.84,0,9.32]-[−8.70,0.57,10.47].
- Z-fighting: 18.

## Suite run 2 (after fixes): all pass, every log exit 0, z-fighting 18.
Shots: s32/before_*.png (live logic31) and s32/after_*.png (1_landing_gap, 1b_landing_gap_east, 2_under_stair, 2b_under_stair_drive), plus side-by-side s32/ba_grid.png. Before, the car stopped at x −6.48 under the stair; after, it drives through to −7.80.
