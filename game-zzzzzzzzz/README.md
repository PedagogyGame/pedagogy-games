# The Mansion of the Unseen

A children's **3D educational** WebGL game. Free-roam a multi-floor Victorian mansion **and its outer estate grounds**, inspect curiosities, and magically slice them to reveal accurate named layers with kid-friendly definitions. Or switch to **Drive** mode and pilot a tiny RC car along floor roads, wall tunnels, and furniture-top circuits. No combat, timers, or fail states — pure exploration.

**Premise:** Break open the unseen — without breaking anything.

## How to run

Needs a static file server (ES modules + import map). From this folder:

```bash
python3 -m http.server 8080
```

Open **http://localhost:8080** in a modern desktop browser.

> Three.js r160 is vendored under `vendor/` — fully offline after unpack.

## Play modes

| Mode | What it is |
|------|------------|
| **Explore** | FPS walk + inspect / slice (pointer lock) |
| **Drive** | Chase-cam RC car on painted roads, cornice highways, balcony, ramps, tunnels, furniture rails |

Toggle with the **Explore | Drive** control on the title screen or in-HUD, or keys **1** / **2**. Switching exits inspect, unlocks the pointer, and shows/hides the car cleanly (`playMode = 'explore' | 'drive'`).

## Controls

### Explore

| Action | Input |
|--------|--------|
| Look | Mouse (click canvas to lock pointer) |
| Move | WASD / arrow keys |
| Climb floors | Walk the side staircases (west foyer ↔ landing ↔ attic; east foyer ↔ cellar) |
| Exit to gardens | Walk out the **Grand Foyer front door** or the **Conservatory garden doors** |
| Inspect object | Walk up + click while crosshair highlights it |
| Orbit in inspect | Drag mouse |
| Peel / section layers | Scroll wheel, slider, bracket keys, or strata buttons |
| Slice modes | **Section** (default for concentric curios — visible cut faces), Peel, Ghost |
| Leave inspect / unlock | Esc |

### Drive

| Action | Input |
|--------|--------|
| Accelerate / brake / steer | WASD / arrows |
| Boost | Shift |
| Switch to Explore | HUD toggle or key **1** |

HUD shows a speedometer, Drive badge, and room-enter toasts (“Entering Conservatory”).

## Cross-section cutaways (Reveal / Learn)

On inspect, a **world-space clip plane** cuts through the object center (local +X half removed) and each layer gets a solid **cut-face disk** tinted to that stratum — so kids see rings of color, not vanishing shells. Peeling advances outside-in with the active cut face highlighted and the HUD term locked to the same index. Non-concentric assemblies (violin, piano, flytrap, …) also **explode along +X** in Peel/Ghost.

Hero objects tuned for Section: alkaline AA, Magic 8-Ball, bird egg, coconut, baseball, orange, coffee cherry, hard drive, thermos, nautilus, pocket watch, fig.

## Drive track map (summary)

- **Floor loop:** Foyer → Hall of Echoes → Conservatory → Breakfast Parlor → back
- **Spurs:** Hall ↔ Cabinet, Hall ↔ Armoury
- **Outdoor loop:** Front drive → gardens path → terrace → foyer (gravel)
- **Wall tunnels:** two incline tube corridors (hall↔cabinet, hall↔armoury) with arch frames + emissive strip lights
- **Stair ramp:** west foyer stair climb onto Upper Landing
- **Furniture circuits (≥4) + ramps:** foyer console, dining table, cabinet display cases, workshop bench, library bookcase tops, music sideboard, nursery toy chest
- **Cornice highway:** continuous upper-wall ledge circuits in Foyer, Hall of Echoes (both sides), Cabinet, Armoury, Conservatory — dark wood deck + gold edge trim, doorway-header bridges, diagonal corner braces, on-ramps from stair rail / display cases / bookcase tops
- **Balcony:** exterior balcony off the **Upper Landing** with driveable loop + return ramps; optional drop ramp to Front Drive. Explore can walk it (`getFloorY` floor region + French doors)
- **Chandelier ring:** optional elevated loop at foyer chandelier height with cornice on-ramp
- **Bookcase express:** library tops → nursery / study express links + cross header

Suggested flow: foyer floor → **mouse hole** → wall hollow → furniture → cornice / chandelier → Upper Landing → **Balcony** → flower paths outdoors.

### Mouse shortcuts & shafts

The RC car can sneak like a clever mouse:

| Kind | Routes |
|------|--------|
| **Hollow wall tubes** (`shortcut`) | Foyer↔Cabinet (west, skirt + mid), Foyer↔Armoury (east, skirt + mid), Hall↔Conservatory (north cavity), Dining↔Conservatory (shared wall), Cellar↔Ground (pipe shaft) |
| **Service shafts** (`shaft`) | West-wall zigzag Cellar→Ground→First→Attic; climb tube Cellar→Hall; Hall→Workshop climb |
| **Drop chutes** (`chute`) | Cornice→foyer floor with landing curve; balcony→foyer slide |
| **Flower paths** (`flower`) | Rose Walk weave, hedge tunnel, flower-bed sneak, orchard arc, fountain arc, terrace↔front-drive connector |

**Visuals:** round wood-trimmed mouse-hole portals with glowing rings; dark timber/plaster cavity interiors; light slots + dust-mote emissives; petal edge dust + lantern markers on garden shortcuts; optional boost pads at some exits.

**Toasts / hints:** “Mouse run”, “Wall hollow”, “Pipe shaft”; near a portal the HUD whispers “Shortcut — wall run” (or petal / pipe variants). Explore|Drive toggle unchanged.

### Drive handling notes

- Premium candy-red / cream RC mesh, chrome mirrors, glass cabin, detailed wheels, subtle underglow
- Snappy accel with soft speed cap; high steer at low speed, stable at high; visual drift trail intensity
- Stronger magnetic centerline on elevated / shortcut / shaft / chute; wider forgiveness on floor roads
- Soft guard-rail push; banking follows track; landing damp after slides
- Chase cam: cinematic look-ahead, spring-damped follow (less jitter), boost FOV, smooth dark→light recover after tunnels
- Off-track: slow on carpet/grass/petal paths, soft pull back near track — never hard freeze
- Optional speed lines + dust particles while boosting (emissive meshes only)
- Prefer emissive lenses / lanterns / tunnel strips / mouse-hole glow over extra PointLights

Tracks live in `js/data/tracks.js`; meshes + snap in `js/drive/tracks.js`; car in `js/drive/car.js`; mode glue in `js/drive/driveMode.js`. Balcony architecture is built in `js/mansion.js` (`_buildBalcony`).

## Multi-floor layout + gardens

| Floor | Y | Rooms / zones |
|-------|---|--------|
| **Basement** | ≈ −4.2 | Cellar Workshop |
| **Ground Floor** | ≈ 0 | Grand Foyer, Hall of Echoes, Cabinet of Curiosities, Armoury & Game Room, Conservatory, Breakfast Parlor, East Gallery |
| **Gardens (outdoor)** | ≈ 0 | Front Drive, Rose Walk, Flower Beds, Orchard, Conservatory Terrace, Moonlit Pond, Rockery, Carriage House · Shed |
| **First Floor** | ≈ 4.2 | Upper Landing, Library Hall, Workshop, Music Room, Study & Darkroom, Nursery & Toy Corner |
| **Attic** | ≈ 8.4 | Attic Curiosities Loft, Storage & Science Attic |

Stairs use continuous **ramp floor sampling** via `mansion.getFloorY(x, z, currentY)`. Sampling is **story-aware**: stacked rooms sharing XZ no longer steal the ground floor. Spawn is on the foyer near the front door (`z≈11`).

**Performance:** PointLights capped (~18), moon directional shadows off, large furniture + outer shells cast shadows. Lamps/chandeliers/windows use emissive meshes. Curtains, tablecloths, sharper glass, thicker window trim.

## Objects (~95 unique sliceables)

Each has ≥5 named layers (data in `js/data/objects.js`) plus a mesh builder in `js/meshes.js`.

## Stack

- Plain HTML / CSS / ES modules (no build step)
- Three.js r160 + OrbitControls / PointerLockControls (vendored)
- Procedural meshes, onion-shell cutaways with cut faces, glassmorphism HUD
- Dual play modes: Explore walk + Drive RC tracks
- Twilight estate mood: deep blue fog, moon light, warm window glow, path lanterns, fireflies
