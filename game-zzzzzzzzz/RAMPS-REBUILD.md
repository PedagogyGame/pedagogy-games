# Ramps Rebuild (ramps1) — Climb A / Climb B from scratch

**Not claiming ready for Ben** — parent live-proves before any ready claim.

Ben: “completely rebuild the ramps” · “try again.” Rebuild is path+mesh+aperture from scratch, not a patch of old waypoints.

## Vision (committed)

House-scale mouse RC · Mario Kart readability · Driver clarity · TM rooftop balcony energy.
Climbs are the emotional beat of the figure-8: one clean ascent (**A west**), one clean descent/return (**B east**).

Each climb = thick dark asphalt ribbon with **white edges + yellow center**, gentle **≤30%** grade, **≥2u flat** before/after on approach/exit, **REAL** floor/ceiling holes, scenic stairs **BESIDE** (never the road), planted Y, no float, no spiral, tip release into `landing_hairpin` / `foyer_finish`.

## Figure-8 (preserved)

`foyer_oval` → `foyer_to_climb_a` → `climb_a` → `landing_hairpin` → `balcony_loop` → `balcony_to_climb_b` → `climb_b` → `foyer_finish` (all junctions kissed d=0).

## Climb XYZ + grades (authored, after `_softenRampGrades`)

| Climb | Foot (path start) | Crest (path end) | Flat run | Rise | Mean | MaxSeg |
|-------|-------------------|------------------|----------|------|------|--------|
| **A** | **(-5.00, 0.00, 12.75)** | **(-5.00, 4.20, -2.35)** | 15.10 m | 4.20 | **0.278** | **0.300** |
| **B** | **(7.00, 4.20, -2.35)** | **(7.00, 0.00, 12.75)** | 15.10 m | 4.20 | **0.278** | **0.300** |

Notes:
- Constant-X corridors (A x=-5.0 east of scenic `main_up` x≈-7.6; B x=7.0 west of scenic `climb_b_east` x≈9.0).
- Tip flats (~0.55 m) on each ramp end; **≥2u flat runways** on `foyer_to_climb_a`, hairpin tip-release, and `balcony_to_climb_b`.
- Climb B path order: upper landing → foyer (RAMP_MOUNT_FEET.foot = upper).

## Mesh rebuild (not a paint patch)

- Deck: `ASPHALT_THICK_RAMP = 0.168` (was 0.112).
- Material: **asphalt** texture (white edges + yellow center) — chevron texture no longer wraps the whole ribbon.
- Chevrons: **feet only** (2 painted arrows per climb).
- Under-fill: ramp bottom face + InstancedMesh keels (`ramp_underfill`) — no paper float.
- GPU-lite: deferred meshes = **37** (budget ≤40).

## Apertures (re-punched)

| Hole | Bounds |
|------|--------|
| Climb A + west scenic | minX=-8.80 maxX=-3.70 minZ=-3.00 maxZ=13.10 |
| Climb B + east scenic | minX=5.40 maxX=9.90 minZ=-3.00 maxZ=13.10 |

Foyer ceiling + landing floor dual holes; hall ceiling corridor punch; wall drive openings still at x≈-5 / x≈7. Scenic stairs unchanged (offset).

## Polish kept

1 look-into-turn · 2 engine load · 5 crest compression · 6 junction chevrons · 7 void edge · 8 asphalt vs carpet · 9 kiss handoffs.  
Pillars hard · no teleport · Explore never pays road GPU.

## Sims (agent box)

```
node --import ./smoke-register.mjs from-scratch-drive-sims.mjs   # ALL PASS
node --import ./smoke-register.mjs climb-collider-check.mjs      # A+B 0 hard hits
node --import ./smoke-register.mjs no-teleport-sim.mjs           # ALL PASS
node --import ./smoke-register.mjs full-update-climb.mjs         # climb_a AUTO PASS
node --import ./smoke-register.mjs climb-b-autodrive-sim.mjs     # climb_b AUTO PASS
node --import ./smoke-register.mjs smoke.mjs                     # ALL SMOKE CHECKS PASSED
```

## Cache / artifact

- Cache bust: `?v=ramps1`
- Zip: `/workspace/mansion-of-the-unseen.zip`
