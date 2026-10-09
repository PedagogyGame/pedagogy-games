# Spicy Rodents — v0.8 Hospital & Ducts

**Desktop browser, mouse and keyboard** · A continuation of the existing v0.7 prototype, not a fresh level rebuild.

## Start

Open `index.html` in a desktop browser. The Three.js renderer loads from a public CDN, so a working internet connection is required. If opening the file directly causes a module-loading restriction, serve the folder with `python3 -m http.server 8000` and open `http://localhost:8000`.

## Explore

- **North:** Sycamore Park, its new swings, slide and sandbox; the adjacent Cedar Rest Cemetery; and the original working Tabasco garden.
- **West, across the park approach:** a hospital on its own short arterial spur. The emergency entrance is on the **south** side. Stand by the door and press **E**.
- **East:** the existing Chili's-style restaurant, gas station, commercial intersection and towers.
- **Under the northern neighborhood:** the original small L-shaped sewer and its clothing stand.

## Controls

| Control | Action |
|---|---|
| WASD | Move / climb along a grabbed route |
| Mouse | Free look |
| Shift | Sprint |
| Space | Leap |
| Left mouse | Pounce (also outside stalking) |
| Hold right mouse | Slow, first-person stalking |
| E | Grab or transfer tree/wire routes; interact with doors, vents, grates and the fashion stand |
| Hold E by a closed hospital vent | Chew the grille (initial entry takes **2 minutes** of unpaused play) |
| Q | Drop from a route |
| P | Pause / resume **all gameplay timers** |
| H or ? CONTROLS | Toggle control panel |
| 1, 2, 3 | Cycle clothing choices near the sewer stand |
| Escape | Release cursor |

The first hospital vent is in the western waiting-room wing. Once opened, pressing E at its grille enters the narrow duct. Other grilles can also be opened by chewing; E moves through an open grille. Leaving a vent does not remove it. You cannot bite through metal walls.

## Included from earlier versions

The rolling neighborhood, three giant lookout trees, traversal on trunks/branches/lines, 8 randomized single-use peppers, temporary Chili Rush, 10-minute Power fade, sparse human cast, vehicles, policeman with baton, dog yards, park, cemetery, garden, sewer, predators after 13 minutes immobile, coins and persistent clothing are retained.

## In v0.8

- A new west-side hospital, sheltered entrance, interior waiting room and wards.
- Patients and staff who follow different routines. Guards, orderlies with rolling stretchers, and a woman with a fire extinguisher react to intrusions with readable wind-ups.
- An ambulance that occasionally approaches the emergency entrance, with quiet siren pulses that yield to immediate danger warnings.
- A short duct network, with a long first grille chewing action and further enterable openings.
- Four rabbits that always escape; seven ordinary squirrels in the neighborhood.
- A separate, understated community **Infection** meter that reflects the larger situation.
- Garden and hedge cover reduce human spotting when the squirrel moves carefully.

## Notes

This is a procedural geometry prototype, not a photorealistically modeled game. The supplied JavaScript passed syntax checks and targeted source / behavior tests covering infection timing and limits. **A full 3D visual browser test could not be completed in the build environment.** Rendering, frame rate, and camera feel should be checked in a desktop browser.

This local HTML package does **not** automatically update or deploy any live site, including any project on pedagogygame.com. Keep backups of your earlier game files before replacing them.
