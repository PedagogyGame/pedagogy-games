# The Mansion of the Unseen

A children's **3D educational** WebGL game. Free-roam a multi-floor Victorian mansion **and its outer estate grounds**, inspect curiosities, and magically slice them to reveal accurate named layers with kid-friendly definitions. No combat, timers, or fail states — pure exploration.

**Premise:** Break open the unseen — without breaking anything.

## How to run

Needs a static file server (ES modules + import map). From this folder:

```bash
python3 -m http.server 8080
```

Open **http://localhost:8080** in a modern desktop browser.

> Three.js r160 is vendored under `vendor/` — fully offline after unpack.

## Controls

| Action | Input |
|--------|--------|
| Look | Mouse (click canvas to lock pointer) |
| Move | WASD / arrow keys |
| Climb floors | Walk the staircases (foyer ↔ landing ↔ attic, foyer ↔ cellar) |
| Exit to gardens | Walk out the **Grand Foyer front door** (south, toward the drive) or the **Conservatory garden doors** (north, onto the terrace) |
| Inspect object | Walk up + click while crosshair highlights it |
| Orbit in inspect | Drag mouse |
| Peel layers | Scroll wheel, slider, bracket keys, or strata buttons |
| Leave inspect / unlock | Esc |

## Multi-floor layout + gardens

| Floor | Y | Rooms / zones |
|-------|---|--------|
| **Basement** | ≈ −4.2 | Cellar Workshop |
| **Ground Floor** | ≈ 0 | Grand Foyer, Hall of Echoes, Cabinet of Curiosities, Armoury & Game Room, Conservatory, Breakfast Parlor, East Gallery |
| **Gardens (outdoor)** | ≈ 0 | Front Drive, Rose Walk, Flower Beds, Orchard, Conservatory Terrace, Moonlit Pond, Rockery, Carriage House · Shed |
| **First Floor** | ≈ 4.2 | Upper Landing, Library Hall, Workshop, Music Room, Study & Darkroom, Nursery & Toy Corner |
| **Attic** | ≈ 8.4 | Attic Curiosities Loft, Storage & Science Attic |

Outdoor zones use `outdoor: true` (no full walls). The estate includes lawn, gravel drive, stone paths, glowing facade windows, fountain, koi pond, gazebo, greenhouse, carriage shed, orchard trees, topiary, rose ring, lantern posts, and fireflies under dusk fog.

Stairs use continuous **ramp floor sampling** via `mansion.getFloorY(x,z)`. Exterior ground samples at Y=0. Room badge shows `Floor · Room` (e.g. `Gardens · Rose Walk`, `First Floor · Music Room`).

## Objects (~95 unique sliceables)

Each has ≥5 named layers (data in `js/data/objects.js`) plus a mesh builder in `js/meshes.js`.

**Cabinet / attic curios:** Hornet Nest, Bird Egg, Nautilus, Pearl, Honeycomb, Feather, Coral Colony, Oak Gall, Thunderegg, Ammonite, Tree Cookie, Abalone, Cuttlebone, Sponge…

**Gardens / orchard / rockery / terrace (many outdoors):** Sunflower Head, Artichoke, Aloe Leaf, Carrot, Tomato, Grape, Pine Cone, Pitcher Plant, Venus Flytrap, Avocado, Cacao Pod, Walnut Husk, Lotus Pod, Fig, Orange, Pineapple, Pomegranate, Coffee Cherry, Papaya, Kiwi, Passion Fruit, Barnacle, Sea Urchin, Mermaid's Purse, Starfish, Oyster…

**Drive / shed:** Oil Filter, Skateboard Deck, Super Soaker, Golf Ball (5-piece), Solar Cell, Spinning Reel, Binoculars, Thermos, Glow Stick

**Study models:** Cow Eye, Tooth Model, Long Bone, Artery Model, Hard Drive, Polaroid Film, Color Film, SLR Camera, Fountain Pen, Credit Card

**Workshop / kitchen:** Alkaline AA, Spark Plug, DC Motor, Padlock, MLCC Chip, Formica Sample, Coax Cable, Tape Measure, Sewing Machine, Croissant, Baklava, KitKat, Juice Carton…

**Music:** Grand Piano, Violin, Acoustic Guitar, Clarinet, Metronome, Music Box, Harmonica, Recorder, Trumpet Valve, Speaker Driver, Accordion Free Reed

**Nursery / play:** Etch A Sketch, Nerf Blaster, M&M Candy, Walkman, Skateboard Deck, Magic 8-Ball, Baseball, Pocket Watch, Compass, Gyroscope, Combination Lock

Some types appear in more than one place (repeats for discovery density). Cabinet keeps classic pedestals; other rooms use tables, benches, desks, rugs, garden pots, and rocks.

## Stack

- Plain HTML / CSS / ES modules (no build step)
- Three.js r160 + OrbitControls / PointerLockControls (vendored)
- Procedural meshes, onion-shell cutaways, glassmorphism HUD
- Twilight estate mood: deep blue fog, moon light, warm window glow, path lanterns, fireflies
