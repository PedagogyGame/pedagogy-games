# LOGIC31 notes (Ben pt212u 11:46 PM)

## Spot
library_hall, 2nd floor (y 4.20), x −1.5..1.5, z −13.25..−6.75 (rug), reading nook at the north end with 2 armchairs, a lamp, purple/yellow paintings. Confirmed by matching the shots (before_lib*.png).

## Planes at the spot (before)
- floor slab top 4.200
- perimeter frame strips: wood 4.204–4.224 floating 4 mm, brass cap top 4.234; drive region 4.234 (3.4 cm kerb, dark seam lines)
- rug box 4.222–4.250, a 2.2 cm air gap under a 2.8 cm slab; drive region 4.250 (5 cm lip). Shot 4: this lip hid half the car.

## Fix (mansion.js and world.js, all rooms, since every ≥5 m room uses the same builder)
- rug: 8 mm box resting on the floor (4.200–4.208), region y = cy+0.008, world base −0.008
- frame: 6 mm inlay on the planks plus a 3 mm brass hairline (top cy+0.0085), region y and base −0.0085
- pond stepping rugs are outdoors and unchanged
- stacked-slab scan: 67 rug/frame layers, now all ≤9 mm; no floating thin floor slab (>4 mm gap) over any story floor. outdoor_path 2 mm decals are left as is (anti-z-fight offset).

## Camera
- CAM29 b 0.95→1.0355, u 0.8→0.872 (×1.09); added `tilt` 1.087 applied to the aim after the bumper floor
- mean of 4 standard spots: distance 0.122→0.133 m (×1.090); pitch 18.46°→18.84° down (×1.021, +2%)
- car width 0.208→0.185 (still ≥ logic27's 0.1467); bumper margin 0.087 (≥0.02)
- note: the pull-back alone flattened the pitch to 17.33°, hence tilt 1.087 rather than 1.02

## logic31-sim
4 tests, all pass: rugs/frames flush, no floating slabs, rug edge car on top (sink 0 mm, 5 rooms), camera zoom/tilt.
- logic29-sim L29-screen-fraction: the ≥logic28 width (0.1603) bound is relaxed to ×0.95 (0.152), because Ben asked to zoom out; the brief's floor ≥logic27 (0.1467) is kept. Measured 0.156.
