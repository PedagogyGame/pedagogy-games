# POLISH — logic22 (Ben t186u, 30 Oct 2026)

> "this black space ahead has a flaw, that you just drive through it and drop down to the lower level, please fix"

- **Service Gallery:** the logic20 and logic21 work holds up. The floor at y 4.2 is solid and lit, with no fall-through. logic20-sim and logic21-sim pass.
- **New gap: the Climb-B well lip.** The Upper Landing's east lip (x 5.65, z −2..10) was an unguarded drop into the Foyer, and so was the well's south lip at z 10. Fan-driving at full throttle in 24 headings from 6 landing spots found 60 of 144 runs falling there.
- **Guards added:**
  - Glass and neon balustrades with colliders: north of the ramp mouth, along the whole west lip, and along the south lip.
  - Side rails on Climb B's top turn where it hangs over the well.
  - The Climb-B ramp mouth (z −1.47..−0.4) is left open.
- **logic22-sim:**
  - 216 full-throttle runs from 9 spots on the landing and at the gallery mouth: **0 falls**.
  - 3 guard runs built.
  - Landing → Climb B is still drivable.
- **Not changed:** the outer edges of the balcony approach (z 10.2–12.2, x ≈ 7.5–8.2, behind the camera in Ben's view) still drop onto Climb B's lower bend. They are outside this view, so they are reported, not changed.
- **Full suite:** all sims exit 0, with 20 visible z-fighting pairs (baseline).
- **Cache:** `?v=logic22`.
