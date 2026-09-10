# Cross-section (Peel / Ghost / Section) — 2026-09-09

## Result
**95 / 95** object defs pass `cross-section-check.mjs` (setSlice 0.25 / 0.5 / 0.75 × section/peel/ghost).

## Root cause
Cut faces were **full stacked disks** along −X. From the +X inspect camera the **outermost disk fully occluded** every inner stratum, so Peel/Ghost (and often Section) looked like “nothing happened.”

## Systemic fix (`js/slice.js`)
1. **Annular cut faces** — each layer is a ring (core = disk) on one YZ plane so all strata read like a real section.
2. **`setSlice(frac)`** — maps continuous 0…1 depth → layer index.
3. **Mode opacity reset** — Section restores opaque cut mats after Peel/Ghost.
4. **YZ-biased radius** measure for cut-plane sizing; nested vs evenly-spread radii for assemblies.

## Checks
| Suite | Result |
|-------|--------|
| `node cross-section-check.mjs` | 95/95 PASS |
| `node --import ./smoke-register.mjs smoke.mjs` | ALL PASSED (slice spot-checks) |
| `ruthless-drive-diag.mjs` | ALL PASSED |
| `last-chance-drive-check.mjs` | ALL PASSED |

Drive untouched.
