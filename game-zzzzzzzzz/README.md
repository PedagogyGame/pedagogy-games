# The Mansion of the Unseen

A children's **3D educational** WebGL game. Free-roam a multi-floor Victorian mansion **and its outer estate grounds**, inspect curiosities, and magically slice them to reveal accurate named layers with kid-friendly definitions. Or switch to **Drive** mode and pilot a tiny RC car along floor roads, wall tunnels, and furniture-top circuits. Explore has no fail states. Drive is true manual RC — fall off edges and you crash, then restart at spawn.

**Premise:** Break open the unseen — without breaking anything.

## How to run

**Online-first:** play at [pedagogygame.com](https://pedagogygame.com) (Three.js WebGL — Explore walk + Drive RC). This repo is the same static ES-module build (vendored `three` + import map); no Phaser/PixiJS conversion and no trivia APIs.

Local static server (ES modules + import map):

```bash
python3 -m http.server 8080
```

Open **http://localhost:8080** in a modern desktop browser.

> Three.js r160 is vendored under `vendor/` — the deploy zip runs from any static host (or locally) without a CDN.

## Play modes

| Mode | What it is |
|------|------------|
| **Explore** | FPS walk + inspect / slice (pointer lock) |
| **Drive** | Mouse-eye chase-cam RC toy (~0.11 m) on skirting/perimeter tracks, cornice, balcony, ramps, mouse tubes, furniture tops |

Toggle with the **Explore | Drive** control on the title screen or in-HUD, or keys **1** / **2**. Switching exits inspect and unlocks the pointer. In **Explore** the car stays in-world (tiny, parked by foyer skirting) with tracks hidden; **Drive** reveals tracks and unlocks control (`playMode = 'explore' | 'drive'`).

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

### Drive (manual)

| Action | Input |
|--------|--------|
| Accelerate / brake / steer | WASD / arrows |
| Boost | Shift |
| Switch to Explore | HUD toggle or key **1** |

**True manual physics** — no centerline magnet. Leave balcony, cornice, furniture, or a wall tube into void and you **fall → CRASH → restart at spawn**. Floor/carpet is still crawlable. Soft **rim fences** on elevated decks push you back toward the center when near the edge (casual play stays on the road); hard fall only if you truly leave the deck. Walls/furniture bounce solid (`setWallColliders`); passages only via mouse/tunnel/shaft/chute/shortcut. Wall hollows have studs, pipes, crack light, speed-gate rings, and exit boost pads.

**Spawn road:** one continuous asphalt apron under `CAR_SPAWN` (dark asphalt + soft yellow center dashes only). Foyer skirting ribbon is gapped there so nothing stacks/z-fights. Driver cruise ~1.40 with smoothed steer (lerp ~2.85, steerRate ~3.42, soft yaw-rate cap).

HUD: “Manual — don't fall!”, speedo, **CRASH** banner, “Wall run” near holes, room-enter toasts.

## Cross-section cutaways (Reveal / Learn)

On inspect, a **world-space clip plane** cuts through the object center (local +X half removed) and each layer gets a solid **cut-face disk** tinted to that stratum — so kids see rings of color, not vanishing shells. Peeling advances outside-in with the active cut face highlighted and the HUD term locked to the same index. Non-concentric assemblies (violin, piano, flytrap, …) also **explode along +X** in Peel/Ghost.

Hero objects tuned for Section: alkaline AA, Magic 8-Ball, bird egg, coconut, baseball, orange, coffee cherry, hard drive, thermos, nautilus, pocket watch, fig.

## Drive track map (summary)

Floor roads hug **walls / skirting** (≈0.4–0.8 m inset) — no center-room highways.

- **Ground skirting:** Foyer, Hall (east+west wall runs), Conservatory, Dining, Cabinet, Armoury perimeter loops + thin doorway-edge strips
- **First-floor skirting:** Landing, Library (east+west), Music, Workshop, Nursery, Study + mezzanine connectors
- **Outdoor perimeter:** exterior loop around the mansion (not a driveway center spine)
- **Wall tunnels:** two incline tube corridors (hall↔cabinet, hall↔armoury)
- **Stair ramp:** west foyer stair climb onto Upper Landing (lands on landing edge)
- **Furniture circuits + ramps:** foyer console, dining table, cabinet display cases, workshop bench, library bookcase tops, music sideboard, nursery toy chest
- **Cornice highway:** upper-wall ledge circuits + doorway-header bridges + braces
- **Balcony:** exterior balcony loop + return ramps; optional drop to Front Drive edge. Explore can still walk it
- **Chandelier ring / bookcase express:** elevated specialty tracks

**Explore park:** car (~0.11 m long) idle at west foyer skirting by the front door (`CAR_SPAWN`); tracks hidden.

Suggested flow: foyer skirting → **mouse hole** → wall hollow → furniture → cornice → Upper Landing → **Balcony** → flower paths outdoors.


### Explore ↔ Drive near tracks

Floor ribbons hug skirting; Explore polish keeps **walk lanes clear** beside those corridors (doorways, hall consoles hug plaster outside the asphalt inset). In Explore, asphalt stays hidden but **mouse-portal rings** remain as quiet wall cues. Ramp feet are designated in `RAMP_MOUNT_FEET` (`js/data/tracks.js`) — approach path, foot XYZ, engage band, and 25/50/75% climb samples.

### Mouse shortcuts & shafts

The RC car can sneak like a clever mouse (including long **west/east grand wall runs** foyer→hall→conservatory):

| Kind | Routes |
|------|--------|
| **Hollow wall tubes** (`shortcut`) | Foyer↔Cabinet (west, skirt + mid), Foyer↔Armoury (east, skirt + mid), Hall↔Conservatory (north cavity), Dining↔Conservatory (shared wall), Cellar↔Ground (pipe shaft) |
| **Service shafts** (`shaft`) | West-wall zigzag Cellar→Ground→First→Attic; climb tube Cellar→Hall; Hall→Workshop climb |
| **Drop chutes** (`chute`) | Cornice→foyer floor with landing curve; balcony→foyer slide |
| **Flower paths** (`flower`) | Rose Walk weave, hedge tunnel, flower-bed sneak, orchard arc, fountain arc, terrace↔front-drive connector |

**Visuals:** round wood-trimmed mouse-hole portals with glowing rings; dark timber/plaster cavity interiors; light slots + dust-mote emissives; petal edge dust + lantern markers on garden shortcuts; optional boost pads at some exits.

**Toasts / hints:** “Mouse run”, “Wall hollow”, “Pipe shaft”; near a portal the HUD whispers “Shortcut — wall run” (or petal / pipe variants). Explore|Drive toggle unchanged.

### Drive handling notes

- Toy/mouse-scale candy-red RC (~0.11 m / `CAR_SCALE` 0.25×); subtler headlights/underglow so Explore barely notices
- maxSpeed ~2.85, boost ~4.2; zippy steer for a mouse; soft speed cap
- Stronger magnetic centerline on elevated / shortcut / shaft / chute; narrow floor perimeter tracks
- Soft guard-rail push; banking follows track; landing damp after slides
- Chase cam: **close & low** mouse-eye cinema, wider Drive FOV (~78), boost FOV kick, tunnel recover
- Idle wheel twitch + tiny headlight blink in Drive only; Explore parked & static
- Off-track: slow on carpet/grass/petal paths, soft pull back near track — never hard freeze
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
