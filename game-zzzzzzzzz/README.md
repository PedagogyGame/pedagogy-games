# The Mansion of the Unseen

A children **3D educational** WebGL game. Free-roam a museum mansion, inspect curiosities, and magically slice them to reveal accurate named layers with kid-friendly definitions. No combat, timers, or fail states — pure exploration.

**Premise:** Break open the unseen — without breaking anything.

## How to run

Needs a static file server (ES modules + import map). From this folder:

```bash
python3 -m http.server 8080
```

Or:

```bash
npx --yes serve -p 8080
```

Open **http://localhost:8080** in a modern desktop browser.

> Three.js r160 is vendored under `vendor/` — fully offline after unpack. See `vendor/README.md`.

## Controls

| Action | Input |
|--------|--------|
| Look | Mouse (click canvas to lock pointer) |
| Move | WASD / arrow keys |
| Inspect object | Walk up + click while crosshair highlights it |
| Orbit in inspect | Drag mouse |
| Peel layers | Scroll wheel, slider, bracket keys, or strata buttons |
| Leave inspect / unlock | Esc |

## Rooms

1. Grand Foyer — starting hall
2. Hall of Echoes — hub connecting all wings
3. Cabinet of Curiosities — nests, eggs, shells, urchins
4. Armoury and Game Room — toys, sports, timepieces, navigation
5. Conservatory — carnivorous plants, pine, coconut
6. Workshop — batteries, spark plugs, motors, locks
7. Music Room — metronome, music box, harmonica, violin, grand piano (monument)

## Objects (21)

Each has at least 5 named layers (data in `js/data/objects.js`):

- Cabinet: Hornet Nest, Bird Egg, Chambered Nautilus, Sea Urchin
- Armoury: Magic 8-Ball, Baseball, Pocket Watch, Magnetic Compass
- Conservatory: Venus Flytrap, Pine Cone, Coconut, Pitcher Plant
- Workshop: Alkaline AA, Spark Plug, Small DC Motor, Pin-Tumbler Padlock
- Music: Metronome, Music Box, Harmonica, Violin, Grand Piano

## Stack

- Plain HTML / CSS / ES modules (no build step)
- Three.js r160 + OrbitControls / PointerLockControls via CDN import map
- Procedural meshes, onion-shell cutaways, glassmorphism HUD
