export const ROOMS = {
  foyer: {
    id: "foyer", name: "Grand Foyer",
    size: [10, 4, 8], pos: [0, 0, 2],
    palette: { wall: 0x3e2723, floor: 0x5d4037, trim: 0xc9a227, light: 0xffe0b2 },
    exits: { north: "hallway" }
  },
  hallway: {
    id: "hallway", name: "Hall of Echoes",
    size: [4, 4, 20], pos: [0, 0, -12],
    palette: { wall: 0x4e342e, floor: 0x6d4c41, trim: 0xb8860b, light: 0xffecb3 },
    exits: { south: "foyer", west: "cabinet", east: "armoury", north: "conservatory" }
  },
  cabinet: {
    id: "cabinet", name: "Cabinet of Curiosities",
    size: [12, 4, 10], pos: [-8, 0, -10],
    palette: { wall: 0x2e1a1a, floor: 0x3e2723, trim: 0x8d6e63, light: 0xffcc80 },
    exits: { east: "hallway" },
    objects: [
      { id: "hornet_nest", pos: [-10, 1.1, -8] },
      { id: "bird_egg", pos: [-6, 1.1, -8] },
      { id: "nautilus", pos: [-10, 1.1, -12] },
      { id: "sea_urchin", pos: [-6, 1.1, -12] }
    ]
  },
  armoury: {
    id: "armoury", name: "Armoury & Game Room",
    size: [12, 4, 10], pos: [8, 0, -10],
    palette: { wall: 0x1a237e, floor: 0x283593, trim: 0xc0c0c0, light: 0x90caf9 },
    exits: { west: "hallway" },
    objects: [
      { id: "magic_8ball", pos: [6, 1.1, -8] },
      { id: "baseball", pos: [10, 1.1, -8] },
      { id: "pocket_watch", pos: [6, 1.1, -12] },
      { id: "compass", pos: [10, 1.1, -12] }
    ]
  },
  conservatory: {
    id: "conservatory", name: "Conservatory",
    size: [14, 5, 12], pos: [0, 0, -28],
    palette: { wall: 0x1b5e20, floor: 0x33691e, trim: 0x81c784, light: 0xc8e6c9 },
    exits: { south: "hallway", west: "workshop", east: "music" },
    objects: [
      { id: "venus_flytrap", pos: [-3, 1.0, -26] },
      { id: "pine_cone", pos: [3, 1.0, -26] },
      { id: "coconut", pos: [-3, 1.0, -30] },
      { id: "pitcher_plant", pos: [3, 1.0, -30] }
    ]
  },
  workshop: {
    id: "workshop", name: "Workshop",
    size: [10, 4, 10], pos: [-12, 0, -28],
    palette: { wall: 0x37474f, floor: 0x455a64, trim: 0xffc107, light: 0xffecb3 },
    exits: { east: "conservatory" },
    objects: [
      { id: "alkaline_aa", pos: [-14, 1.1, -26] },
      { id: "spark_plug", pos: [-10, 1.1, -26] },
      { id: "dc_motor", pos: [-14, 1.1, -30] },
      { id: "padlock", pos: [-10, 1.1, -30] }
    ]
  },
  music: {
    id: "music", name: "Music Room",
    size: [12, 4, 12], pos: [12, 0, -28],
    palette: { wall: 0x4a148c, floor: 0x6a1b9a, trim: 0xc9a227, light: 0xe1bee7 },
    exits: { west: "conservatory" },
    objects: [
      { id: "metronome", pos: [10, 1.1, -25] },
      { id: "music_box", pos: [14, 1.1, -25] },
      { id: "harmonica", pos: [10, 1.1, -29] },
      { id: "violin", pos: [14, 1.1, -29] },
      { id: "piano", pos: [12, 0.9, -32] }
    ]
  }
};
