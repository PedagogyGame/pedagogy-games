/**
 * Drive-mode track waypoints for the mansion.
 * Each path is a named polyline of {x,y,z} world points (meters).
 * kind: floor | elevated | ramp | tunnel | outdoor
 * label: optional room-enter toast
 */
export const TRACK_PATHS = [
  // ─── Ground floor loop: foyer → hall → conservatory → dining → back ───
  {
    id: "ground_main",
    kind: "floor",
    width: 1.45,
    tension: 0.2,
    points: [
      { x: 0, y: 0.06, z: 12, label: "Grand Foyer" },
      { x: 0, y: 0.06, z: 6 },
      { x: 0, y: 0.06, z: 0 },
      { x: 0, y: 0.06, z: -6, label: "Hall of Echoes" },
      { x: 0, y: 0.06, z: -14 },
      { x: 0, y: 0.06, z: -22, label: "Conservatory" },
      { x: 0, y: 0.06, z: -30 },
      { x: -6, y: 0.06, z: -30 },
      { x: -12, y: 0.06, z: -30, label: "Breakfast Parlor" },
      { x: -16, y: 0.06, z: -30 },
      { x: -16, y: 0.06, z: -26 },
      { x: -10, y: 0.06, z: -22 },
      { x: -4, y: 0.06, z: -14 },
      { x: 0, y: 0.06, z: -6 },
      { x: 0, y: 0.06, z: 6 },
      { x: 0, y: 0.06, z: 12 },
    ],
  },
  // Spur: hall ↔ cabinet
  {
    id: "hall_cabinet",
    kind: "floor",
    width: 1.3,
    tension: 0.2,
    points: [
      { x: 0, y: 0.06, z: -8, label: "Hall of Echoes" },
      { x: -4, y: 0.06, z: -8 },
      { x: -10, y: 0.06, z: -8, label: "Cabinet of Curiosities" },
      { x: -14, y: 0.06, z: -8 },
      { x: -14, y: 0.06, z: -4 },
      { x: -10, y: 0.06, z: -4 },
      { x: -4, y: 0.06, z: -8 },
      { x: 0, y: 0.06, z: -8 },
    ],
  },
  // Spur: hall ↔ armoury
  {
    id: "hall_armoury",
    kind: "floor",
    width: 1.3,
    tension: 0.2,
    points: [
      { x: 0, y: 0.06, z: -8 },
      { x: 4, y: 0.06, z: -8 },
      { x: 10, y: 0.06, z: -8, label: "Armoury & Game Room" },
      { x: 14, y: 0.06, z: -8 },
      { x: 14, y: 0.06, z: -4 },
      { x: 8, y: 0.06, z: -4 },
      { x: 4, y: 0.06, z: -8 },
      { x: 0, y: 0.06, z: -8 },
    ],
  },
  // Outdoor loop: front drive → gardens → terrace → foyer
  {
    id: "outdoor_loop",
    kind: "outdoor",
    width: 1.7,
    tension: 0.22,
    points: [
      { x: 0, y: 0.08, z: 14, label: "Front Drive" },
      { x: 0, y: 0.08, z: 22 },
      { x: 0, y: 0.08, z: 30 },
      { x: 8, y: 0.08, z: 30 },
      { x: 14, y: 0.08, z: 18, label: "Rose Walk" },
      { x: 18, y: 0.08, z: 0 },
      { x: 14, y: 0.08, z: -20 },
      { x: 8, y: 0.08, z: -40 },
      { x: 0, y: 0.08, z: -44, label: "Conservatory Terrace" },
      { x: -8, y: 0.08, z: -40 },
      { x: -14, y: 0.08, z: -20 },
      { x: -12, y: 0.08, z: 0 },
      { x: -8, y: 0.08, z: 18 },
      { x: 0, y: 0.08, z: 22 },
      { x: 0, y: 0.08, z: 14 },
    ],
  },

  // ─── Wall tunnels / incline corridors ───
  {
    id: "tunnel_hall_cabinet",
    kind: "tunnel",
    width: 1.2,
    points: [
      { x: -2.2, y: 0.06, z: -10, label: "Wall Tunnel" },
      { x: -3.5, y: 0.35, z: -10 },
      { x: -5.5, y: 0.55, z: -10 },
      { x: -7.5, y: 0.35, z: -10 },
      { x: -9.5, y: 0.06, z: -10, label: "Cabinet of Curiosities" },
    ],
  },
  {
    id: "tunnel_hall_armoury",
    kind: "tunnel",
    width: 1.2,
    points: [
      { x: 2.2, y: 0.06, z: -12, label: "Wall Tunnel" },
      { x: 3.5, y: 0.4, z: -12 },
      { x: 5.5, y: 0.65, z: -12 },
      { x: 7.5, y: 0.4, z: -12 },
      { x: 9.5, y: 0.06, z: -12, label: "Armoury & Game Room" },
    ],
  },


  // Driveable stair ramp: foyer west stair → upper landing (reach furniture circuits)
  {
    id: "ramp_foyer_to_landing",
    kind: "ramp",
    width: 1.0,
    points: [
      { x: -6.2, y: 0.06, z: 9, label: "Grand Foyer" },
      { x: -6.8, y: 0.8, z: 7.5 },
      { x: -7.0, y: 1.8, z: 6.0 },
      { x: -7.0, y: 2.8, z: 4.5 },
      { x: -6.5, y: 3.6, z: 3.5 },
      { x: -4.0, y: 4.26, z: 4.0, label: "Upper Landing" },
      { x: 0, y: 4.26, z: 4.0 },
    ],
  },
  // ─── Furniture-top circuits + ramps (Toy Story vibe) ───
  // 1) Foyer console top
  {
    id: "ramp_foyer_console",
    kind: "ramp",
    width: 0.55,
    points: [
      { x: 3.5, y: 0.06, z: 10 },
      { x: 4.2, y: 0.35, z: 10 },
      { x: 4.8, y: 0.7, z: 10 },
      { x: 5.3, y: 0.96, z: 10, label: "Foyer Console" },
    ],
  },
  {
    id: "furniture_foyer_console",
    kind: "elevated",
    width: 0.5,
    rail: true,
    points: [
      { x: 5.3, y: 0.98, z: 10 },
      { x: 5.5, y: 0.98, z: 10.2 },
      { x: 6.2, y: 0.98, z: 10.2 },
      { x: 6.4, y: 0.98, z: 9.8 },
      { x: 5.5, y: 0.98, z: 9.7 },
      { x: 4.7, y: 0.98, z: 9.8 },
      { x: 4.7, y: 0.98, z: 10.2 },
      { x: 5.3, y: 0.98, z: 10 },
    ],
  },
  {
    id: "ramp_foyer_console_down",
    kind: "ramp",
    width: 0.55,
    points: [
      { x: 4.7, y: 0.96, z: 9.5 },
      { x: 4.0, y: 0.55, z: 9.2 },
      { x: 3.2, y: 0.2, z: 9.0 },
      { x: 2.2, y: 0.06, z: 8.5 },
    ],
  },

  // 2) Dining table edge circuit
  {
    id: "ramp_dining_table",
    kind: "ramp",
    width: 0.55,
    points: [
      { x: -12, y: 0.06, z: -30 },
      { x: -13.2, y: 0.35, z: -30 },
      { x: -14.5, y: 0.7, z: -30 },
      { x: -15.5, y: 0.95, z: -30, label: "Dining Table" },
    ],
  },
  {
    id: "furniture_dining_table",
    kind: "elevated",
    width: 0.5,
    rail: true,
    points: [
      { x: -15.5, y: 0.98, z: -30 },
      { x: -13.5, y: 0.98, z: -29.0 },
      { x: -16.0, y: 0.98, z: -28.8 },
      { x: -18.5, y: 0.98, z: -29.0 },
      { x: -18.8, y: 0.98, z: -30.0 },
      { x: -18.5, y: 0.98, z: -31.0 },
      { x: -16.0, y: 0.98, z: -31.2 },
      { x: -13.5, y: 0.98, z: -31.0 },
      { x: -13.2, y: 0.98, z: -30.0 },
      { x: -15.5, y: 0.98, z: -30 },
    ],
  },
  {
    id: "ramp_dining_down",
    kind: "ramp",
    width: 0.55,
    points: [
      { x: -13.2, y: 0.95, z: -29.5 },
      { x: -12.0, y: 0.5, z: -28.5 },
      { x: -10.5, y: 0.15, z: -27.5 },
      { x: -8.5, y: 0.06, z: -26 },
    ],
  },

  // 3) Cabinet display case tops
  {
    id: "ramp_cabinet_case",
    kind: "ramp",
    width: 0.5,
    points: [
      { x: -14, y: 0.06, z: -5 },
      { x: -14, y: 0.5, z: -4.5 },
      { x: -14, y: 1.1, z: -4.2 },
      { x: -14, y: 1.78, z: -4.0, label: "Display Case" },
    ],
  },
  {
    id: "furniture_cabinet_cases",
    kind: "elevated",
    width: 0.48,
    rail: true,
    points: [
      { x: -14, y: 1.82, z: -4 },
      { x: -20, y: 1.82, z: -4 },
      { x: -20, y: 1.82, z: -12 },
      { x: -8, y: 1.82, z: -12 },
      { x: -8, y: 1.82, z: -4 },
      { x: -14, y: 1.82, z: -4 },
    ],
  },
  {
    id: "ramp_cabinet_down",
    kind: "ramp",
    width: 0.5,
    points: [
      { x: -8, y: 1.78, z: -6 },
      { x: -6, y: 1.0, z: -6.5 },
      { x: -4, y: 0.4, z: -7 },
      { x: -2, y: 0.06, z: -8 },
    ],
  },

  // 4) Workshop bench (first floor)
  {
    id: "ramp_workshop_bench",
    kind: "ramp",
    width: 0.55,
    points: [
      // Approach from music room floor → ramp onto bench
      { x: -8, y: 4.26, z: -28, label: "Workshop" },
      { x: -10, y: 4.55, z: -29 },
      { x: -12, y: 4.9, z: -30.5 },
      { x: -14, y: 5.15, z: -31.5, label: "Workshop Bench" },
    ],
  },
  {
    id: "furniture_workshop_bench",
    kind: "elevated",
    width: 0.5,
    rail: true,
    points: [
      { x: -14, y: 5.18, z: -31.5 },
      { x: -17.5, y: 5.18, z: -31.5 },
      { x: -18.0, y: 5.18, z: -32.2 },
      { x: -14.0, y: 5.18, z: -32.2 },
      { x: -10.5, y: 5.18, z: -32.2 },
      { x: -10.0, y: 5.18, z: -31.5 },
      { x: -14, y: 5.18, z: -31.5 },
    ],
  },
  {
    id: "ramp_workshop_down",
    kind: "ramp",
    width: 0.55,
    points: [
      { x: -10, y: 5.15, z: -30.8 },
      { x: -8.5, y: 4.7, z: -29.5 },
      { x: -7, y: 4.4, z: -28.5 },
      { x: -5, y: 4.26, z: -28 },
    ],
  },

  // 5) Library bookcase tops + corner shelf highway
  {
    id: "ramp_library_bookcase",
    kind: "ramp",
    width: 0.5,
    points: [
      { x: 0, y: 4.26, z: -10, label: "Library Hall" },
      { x: 1.5, y: 4.9, z: -10 },
      { x: 2.5, y: 5.8, z: -10 },
      { x: 3.1, y: 6.75, z: -10, label: "Bookcase Highway" },
    ],
  },
  {
    id: "furniture_library_tops",
    kind: "elevated",
    width: 0.45,
    rail: true,
    points: [
      { x: 3.1, y: 6.8, z: -10 },
      { x: 3.1, y: 6.8, z: -4 },
      { x: 3.1, y: 6.8, z: -16 },
      { x: -3.1, y: 6.8, z: -16 },
      { x: -3.1, y: 6.8, z: -4 },
      { x: -3.1, y: 6.8, z: -10 },
      { x: 3.1, y: 6.8, z: -10 },
    ],
  },
  // High corner shelf circuit (cornice height in hall)
  {
    id: "shelf_highway_hall",
    kind: "elevated",
    width: 0.42,
    rail: true,
    points: [
      { x: 3.1, y: 6.8, z: -16 },
      { x: 3.1, y: 6.9, z: -22 },
      { x: 0, y: 7.0, z: -24, label: "Cornice Circuit" },
      { x: -3.1, y: 6.9, z: -22 },
      { x: -3.1, y: 6.8, z: -16 },
    ],
  },
  {
    id: "ramp_library_down",
    kind: "ramp",
    width: 0.5,
    points: [
      { x: -3.1, y: 6.75, z: -8 },
      { x: -2.2, y: 5.6, z: -7 },
      { x: -1.2, y: 4.8, z: -5 },
      { x: 0, y: 4.26, z: -4 },
    ],
  },

  // 6) Music sideboard
  {
    id: "ramp_music_sideboard",
    kind: "ramp",
    width: 0.5,
    points: [
      { x: 0, y: 4.26, z: -24, label: "Music Room" },
      { x: 0, y: 4.55, z: -22.5 },
      { x: 0, y: 4.9, z: -21.2 },
      { x: 0, y: 5.15, z: -20.6, label: "Music Sideboard" },
    ],
  },
  {
    id: "furniture_music_sideboard",
    kind: "elevated",
    width: 0.48,
    rail: true,
    points: [
      { x: 0, y: 5.18, z: -20.6 },
      { x: -4, y: 5.18, z: -20.6 },
      { x: -4.5, y: 5.18, z: -20.9 },
      { x: 0, y: 5.18, z: -20.9 },
      { x: 4.5, y: 5.18, z: -20.9 },
      { x: 4.0, y: 5.18, z: -20.6 },
      { x: 0, y: 5.18, z: -20.6 },
    ],
  },
  {
    id: "ramp_music_down",
    kind: "ramp",
    width: 0.5,
    points: [
      { x: 4, y: 5.15, z: -21 },
      { x: 5, y: 4.7, z: -22 },
      { x: 5.5, y: 4.4, z: -24 },
      { x: 4, y: 4.26, z: -26 },
    ],
  },

  // 7) Nursery toy chest
  {
    id: "ramp_nursery_chest",
    kind: "ramp",
    width: 0.5,
    points: [
      { x: 14, y: 4.26, z: -8, label: "Nursery" },
      { x: 16, y: 4.5, z: -6 },
      { x: 17.5, y: 4.75, z: -5 },
      { x: 18.8, y: 4.95, z: -4, label: "Toy Chest" },
    ],
  },
  {
    id: "furniture_nursery_chest",
    kind: "elevated",
    width: 0.45,
    rail: true,
    points: [
      { x: 18.8, y: 4.98, z: -4 },
      { x: 19.5, y: 4.98, z: -3.7 },
      { x: 19.6, y: 4.98, z: -4.3 },
      { x: 18.3, y: 4.98, z: -4.4 },
      { x: 18.2, y: 4.98, z: -3.7 },
      { x: 18.8, y: 4.98, z: -4 },
    ],
  },
  {
    id: "ramp_nursery_down",
    kind: "ramp",
    width: 0.5,
    points: [
      { x: 18.2, y: 4.95, z: -4.5 },
      { x: 16.5, y: 4.6, z: -6 },
      { x: 15, y: 4.35, z: -8 },
      { x: 12, y: 4.26, z: -10 },
    ],
  },

  // Connector: music floor ↔ library (for upper furniture access)
  {
    id: "first_floor_spine",
    kind: "floor",
    width: 1.2,
    points: [
      { x: 0, y: 4.26, z: 4, label: "Upper Landing" },
      { x: 0, y: 4.26, z: -2 },
      { x: 0, y: 4.26, z: -10, label: "Library Hall" },
      { x: 0, y: 4.26, z: -18 },
      { x: 0, y: 4.26, z: -28, label: "Music Room" },
      { x: -8, y: 4.26, z: -28, label: "Workshop" },
      { x: 0, y: 4.26, z: -28 },
      { x: 8, y: 4.26, z: -14 },
      { x: 14, y: 4.26, z: -8, label: "Nursery" },
      { x: 0, y: 4.26, z: -10 },
      { x: 0, y: 4.26, z: 4 },
    ],
  },

  // ─── Cornice / ledge highways (upper wall corners) ───
  // Foyer upper perimeter ledge
  {
    id: "cornice_foyer",
    kind: "cornice",
    width: 0.55,
    rail: true,
    tension: 0.18,
    closed: true,
    points: [
      { x: -8.2, y: 3.35, z: 12.2, label: "Foyer Cornice" },
      { x: 0, y: 3.35, z: 12.2 },
      { x: 8.2, y: 3.35, z: 12.2 },
      { x: 8.2, y: 3.35, z: 6 },
      { x: 8.2, y: 3.35, z: 0.2 },
      { x: 3.2, y: 3.35, z: -0.4 },
      { x: 0, y: 3.4, z: -0.5, label: "Hall Header Bridge" },
      { x: -3.2, y: 3.35, z: -0.4 },
      { x: -8.2, y: 3.35, z: 0.2 },
      { x: -8.2, y: 3.35, z: 6 },
      { x: -8.2, y: 3.35, z: 12.2 },
    ],
  },
  // On-ramp: foyer stair rail → cornice
  {
    id: "ramp_stair_to_cornice",
    kind: "ramp",
    width: 0.5,
    points: [
      { x: -6.5, y: 2.6, z: 4.8 },
      { x: -7.2, y: 3.0, z: 3.8 },
      { x: -7.8, y: 3.25, z: 2.5 },
      { x: -8.2, y: 3.35, z: 1.2, label: "Foyer Cornice" },
    ],
  },
  // Hall of Echoes — both side cornices + header links
  {
    id: "cornice_hall_east",
    kind: "cornice",
    width: 0.5,
    rail: true,
    tension: 0.18,
    points: [
      { x: 3.1, y: 3.4, z: -0.6, label: "Hall Cornice" },
      { x: 3.1, y: 3.35, z: -6 },
      { x: 3.1, y: 3.35, z: -12 },
      { x: 3.1, y: 3.35, z: -18 },
      { x: 3.1, y: 3.4, z: -21.5 },
      { x: 1.5, y: 3.45, z: -22.2 },
      { x: 0, y: 3.5, z: -22.5, label: "Conservatory Header" },
    ],
  },
  {
    id: "cornice_hall_west",
    kind: "cornice",
    width: 0.5,
    rail: true,
    tension: 0.18,
    points: [
      { x: -3.1, y: 3.4, z: -0.6, label: "Hall Cornice" },
      { x: -3.1, y: 3.35, z: -6 },
      { x: -3.1, y: 3.35, z: -12 },
      { x: -3.1, y: 3.35, z: -18 },
      { x: -3.1, y: 3.4, z: -21.5 },
      { x: -1.5, y: 3.45, z: -22.2 },
      { x: 0, y: 3.5, z: -22.5 },
    ],
  },
  // Cross-hall bridge near foyer
  {
    id: "cornice_hall_cross_south",
    kind: "cornice",
    width: 0.48,
    rail: true,
    points: [
      { x: -3.1, y: 3.4, z: -0.6 },
      { x: 0, y: 3.42, z: -0.5 },
      { x: 3.1, y: 3.4, z: -0.6 },
    ],
  },
  // Cabinet upper corner circuit + doorway header from hall
  {
    id: "cornice_cabinet_bridge",
    kind: "cornice",
    width: 0.48,
    rail: true,
    points: [
      { x: -3.1, y: 3.35, z: -8, label: "Hall Cornice" },
      { x: -4.5, y: 3.38, z: -8 },
      { x: -6.0, y: 3.4, z: -8, label: "Cabinet Header" },
      { x: -7.5, y: 3.35, z: -8 },
    ],
  },
  {
    id: "cornice_cabinet",
    kind: "cornice",
    width: 0.52,
    rail: true,
    tension: 0.18,
    closed: true,
    points: [
      { x: -7.5, y: 3.35, z: -8, label: "Cabinet Cornice" },
      { x: -7.5, y: 3.35, z: -1.0 },
      { x: -14, y: 3.35, z: -1.0 },
      { x: -22.5, y: 3.35, z: -1.0 },
      { x: -22.5, y: 3.35, z: -8 },
      { x: -22.5, y: 3.35, z: -15.0 },
      { x: -14, y: 3.35, z: -15.0 },
      { x: -7.5, y: 3.35, z: -15.0 },
      { x: -7.5, y: 3.35, z: -8 },
    ],
  },
  // Ramp from display cases up to cabinet cornice
  {
    id: "ramp_cases_to_cornice",
    kind: "ramp",
    width: 0.48,
    points: [
      { x: -14, y: 1.82, z: -4 },
      { x: -16, y: 2.4, z: -2.5 },
      { x: -18, y: 2.95, z: -1.5 },
      { x: -20, y: 3.3, z: -1.1 },
      { x: -22.0, y: 3.35, z: -1.0, label: "Cabinet Cornice" },
    ],
  },
  // Armoury upper corners + header bridge
  {
    id: "cornice_armoury_bridge",
    kind: "cornice",
    width: 0.48,
    rail: true,
    points: [
      { x: 3.1, y: 3.35, z: -8, label: "Hall Cornice" },
      { x: 4.5, y: 3.38, z: -8 },
      { x: 6.0, y: 3.4, z: -8, label: "Armoury Header" },
      { x: 7.5, y: 3.35, z: -8 },
    ],
  },
  {
    id: "cornice_armoury",
    kind: "cornice",
    width: 0.52,
    rail: true,
    tension: 0.18,
    closed: true,
    points: [
      { x: 7.5, y: 3.35, z: -8, label: "Armoury Cornice" },
      { x: 7.5, y: 3.35, z: -1.0 },
      { x: 14, y: 3.35, z: -1.0 },
      { x: 22.5, y: 3.35, z: -1.0 },
      { x: 22.5, y: 3.35, z: -8 },
      { x: 22.5, y: 3.35, z: -15.0 },
      { x: 14, y: 3.35, z: -15.0 },
      { x: 7.5, y: 3.35, z: -15.0 },
      { x: 7.5, y: 3.35, z: -8 },
    ],
  },
  // Conservatory upper perimeter (taller room — slightly higher ledge)
  {
    id: "cornice_conservatory",
    kind: "cornice",
    width: 0.55,
    rail: true,
    tension: 0.18,
    closed: true,
    points: [
      { x: 0, y: 3.55, z: -22.5, label: "Conservatory Cornice" },
      { x: 9.5, y: 3.55, z: -22.5 },
      { x: 9.5, y: 3.6, z: -30 },
      { x: 9.5, y: 3.55, z: -37.5 },
      { x: 0, y: 3.55, z: -37.5 },
      { x: -9.5, y: 3.55, z: -37.5 },
      { x: -9.5, y: 3.6, z: -30 },
      { x: -9.5, y: 3.55, z: -22.5 },
      { x: 0, y: 3.55, z: -22.5 },
    ],
  },
  // Climb from foyer cornice header → Upper Landing (via west stair column)
  {
    id: "ramp_cornice_to_landing",
    kind: "ramp",
    width: 0.5,
    points: [
      { x: -8.2, y: 3.35, z: 3.5, label: "Foyer Cornice" },
      { x: -7.5, y: 3.7, z: 3.8 },
      { x: -6.2, y: 4.0, z: 4.0 },
      { x: -4.5, y: 4.2, z: 4.0 },
      { x: -2.0, y: 4.26, z: 4.0, label: "Upper Landing" },
    ],
  },
  // Library bookcase → first-floor cornice already exists; link bookcase highway down-bridge to landing cornice feel
  {
    id: "cornice_landing_east",
    kind: "cornice",
    width: 0.5,
    rail: true,
    tension: 0.2,
    points: [
      { x: 0, y: 7.2, z: 8.5, label: "Landing Cornice" },
      { x: 6.5, y: 7.2, z: 8.5 },
      { x: 7.2, y: 7.2, z: 4 },
      { x: 7.2, y: 7.2, z: -0.5 },
      { x: 3.2, y: 7.15, z: -2 },
      { x: 3.1, y: 6.9, z: -4 },
      { x: 3.1, y: 6.8, z: -10, label: "Bookcase Highway" },
    ],
  },
  {
    id: "ramp_bookcase_to_landing_cornice",
    kind: "ramp",
    width: 0.48,
    points: [
      { x: 3.1, y: 6.8, z: -4 },
      { x: 4.5, y: 7.0, z: -1 },
      { x: 6.0, y: 7.15, z: 2 },
      { x: 6.5, y: 7.2, z: 6 },
      { x: 5.0, y: 7.2, z: 8.5, label: "Landing Cornice" },
    ],
  },

  // ─── Driveable Balcony (east of Upper Landing / front-east) ───
  // Architectural balcony track — loop with turnaround
  {
    id: "ramp_landing_to_balcony",
    kind: "ramp",
    width: 0.7,
    points: [
      { x: 4.0, y: 4.26, z: 6.0, label: "Upper Landing" },
      { x: 5.5, y: 4.26, z: 8.0 },
      { x: 6.5, y: 4.26, z: 10.0 },
      { x: 6.5, y: 4.26, z: 12.0, label: "Balcony" },
    ],
  },
  {
    id: "balcony_loop",
    kind: "balcony",
    width: 1.1,
    rail: true,
    tension: 0.2,
    points: [
      { x: 6.5, y: 4.28, z: 12.2, label: "Balcony" },
      { x: 4.0, y: 4.28, z: 13.5 },
      { x: 0.0, y: 4.28, z: 14.5 },
      { x: -4.0, y: 4.28, z: 13.5 },
      { x: -5.5, y: 4.28, z: 12.2 },
      { x: -5.5, y: 4.28, z: 15.8 },
      { x: -2.0, y: 4.28, z: 17.2 },
      { x: 2.0, y: 4.28, z: 17.2 },
      { x: 5.5, y: 4.28, z: 15.8 },
      { x: 6.5, y: 4.28, z: 14.0 },
      { x: 6.5, y: 4.28, z: 12.2 },
    ],
  },
  // Return inside via west side of balcony
  {
    id: "ramp_balcony_return",
    kind: "ramp",
    width: 0.7,
    points: [
      { x: -5.5, y: 4.28, z: 12.2, label: "Balcony" },
      { x: -5.0, y: 4.26, z: 10.0 },
      { x: -4.0, y: 4.26, z: 7.0 },
      { x: -2.0, y: 4.26, z: 5.0, label: "Upper Landing" },
    ],
  },
  // Optional drop ramp: balcony → front drive gravel
  {
    id: "ramp_balcony_to_drive",
    kind: "ramp",
    width: 0.65,
    points: [
      { x: 0, y: 4.28, z: 17.0, label: "Balcony" },
      { x: 0, y: 3.4, z: 18.5 },
      { x: 0, y: 2.2, z: 20.0 },
      { x: 0, y: 1.0, z: 21.5 },
      { x: 0, y: 0.12, z: 23.0, label: "Front Drive" },
    ],
  },
  // Music room east spur → East Mezzanine → optional second balcony approach (connector only)
  {
    id: "first_floor_to_balcony_east",
    kind: "floor",
    width: 1.0,
    points: [
      { x: 0, y: 4.26, z: -28, label: "Music Room" },
      { x: 8, y: 4.26, z: -28 },
      { x: 14, y: 4.26, z: -28, label: "East Mezzanine" },
      { x: 14, y: 4.26, z: -14 },
      { x: 10, y: 4.26, z: -4 },
      { x: 6, y: 4.26, z: 4, label: "Upper Landing" },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // A. MOUSE-IN-THE-WALLS SHORTCUTS (hollow wall tubes)
  // kind: shortcut — narrow dark corridors inside double walls
  // ═══════════════════════════════════════════════════════════════

  // 1) Foyer ↔ Cabinet (inside west wall) — skirting + mid-height twin
  {
    id: "mouse_foyer_cabinet_skirt",
    kind: "shortcut",
    width: 0.72,
    tension: 0.28,
    rail: true,
    boostExit: true,
    points: [
      { x: -7.6, y: 0.12, z: 9.5, label: "Mouse run", portal: true },
      { x: -8.6, y: 0.18, z: 8.2 },
      { x: -9.15, y: 0.22, z: 5.0 },
      { x: -9.15, y: 0.22, z: 1.0 },
      { x: -9.15, y: 0.22, z: -3.0 },
      { x: -9.4, y: 0.2, z: -6.0 },
      { x: -10.5, y: 0.14, z: -7.5, label: "Wall hollow" },
      { x: -12.0, y: 0.1, z: -8.0, portal: true },
    ],
  },
  {
    id: "mouse_foyer_cabinet_mid",
    kind: "shortcut",
    width: 0.68,
    tension: 0.28,
    rail: true,
    points: [
      { x: -7.4, y: 1.55, z: 8.5, label: "Mouse run", portal: true },
      { x: -8.5, y: 1.65, z: 6.5 },
      { x: -9.15, y: 1.7, z: 3.0 },
      { x: -9.15, y: 1.7, z: -2.0 },
      { x: -9.5, y: 1.65, z: -6.5 },
      { x: -11.5, y: 1.55, z: -8.0, label: "Wall hollow", portal: true },
    ],
  },

  // 2) Foyer ↔ Armoury (inside east wall)
  {
    id: "mouse_foyer_armoury_skirt",
    kind: "shortcut",
    width: 0.72,
    tension: 0.28,
    rail: true,
    boostExit: true,
    points: [
      { x: 7.6, y: 0.12, z: 9.5, label: "Mouse run", portal: true },
      { x: 8.6, y: 0.18, z: 8.2 },
      { x: 9.15, y: 0.22, z: 5.0 },
      { x: 9.15, y: 0.22, z: 1.0 },
      { x: 9.15, y: 0.22, z: -3.0 },
      { x: 9.4, y: 0.2, z: -6.0 },
      { x: 10.5, y: 0.14, z: -7.5, label: "Wall hollow" },
      { x: 12.0, y: 0.1, z: -8.0, portal: true },
    ],
  },
  {
    id: "mouse_foyer_armoury_mid",
    kind: "shortcut",
    width: 0.68,
    tension: 0.28,
    rail: true,
    points: [
      { x: 7.4, y: 1.55, z: 8.5, label: "Mouse run", portal: true },
      { x: 8.5, y: 1.65, z: 6.5 },
      { x: 9.15, y: 1.7, z: 3.0 },
      { x: 9.15, y: 1.7, z: -2.0 },
      { x: 9.5, y: 1.65, z: -6.5 },
      { x: 11.5, y: 1.55, z: -8.0, label: "Wall hollow", portal: true },
    ],
  },

  // 3) Hall ↔ Conservatory (north wall cavity)
  {
    id: "mouse_hall_conservatory",
    kind: "shortcut",
    width: 0.7,
    tension: 0.26,
    rail: true,
    boostExit: true,
    points: [
      { x: 2.4, y: 0.12, z: -18.5, label: "Mouse run", portal: true },
      { x: 2.6, y: 0.25, z: -19.8 },
      { x: 2.7, y: 0.35, z: -20.8 },
      { x: 2.5, y: 0.28, z: -21.6 },
      { x: 1.8, y: 0.16, z: -22.8 },
      { x: 0.8, y: 0.1, z: -24.5, label: "Wall hollow", portal: true },
    ],
  },

  // 4) Dining ↔ Conservatory (shared wall)
  {
    id: "mouse_dining_conservatory",
    kind: "shortcut",
    width: 0.7,
    tension: 0.26,
    rail: true,
    boostExit: true,
    points: [
      { x: -18.5, y: 0.12, z: -30.0, label: "Mouse run", portal: true },
      { x: -14.0, y: 0.2, z: -30.0 },
      { x: -10.5, y: 0.28, z: -30.0 },
      { x: -9.2, y: 0.32, z: -29.5 },
      { x: -8.4, y: 0.22, z: -28.5 },
      { x: -7.2, y: 0.12, z: -27.5, label: "Wall hollow", portal: true },
    ],
  },

  // 5) Cellar ↔ Ground (vertical wall chase / pipe shaft)
  {
    id: "mouse_cellar_ground_shaft",
    kind: "shortcut",
    width: 0.65,
    tension: 0.32,
    rail: true,
    points: [
      { x: 7.2, y: -4.05, z: 6.5, label: "Pipe shaft", portal: true },
      { x: 7.6, y: -3.2, z: 5.8 },
      { x: 8.1, y: -2.2, z: 5.2 },
      { x: 8.3, y: -1.1, z: 5.0 },
      { x: 8.2, y: -0.2, z: 5.2 },
      { x: 7.6, y: 0.12, z: 5.8, label: "Pipe shaft", portal: true },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // B. BETWEEN-FLOOR SERVICE SHAFTS / DROP CHUTE / CLIMB TUBE
  // ═══════════════════════════════════════════════════════════════

  // Service shaft: Cellar → Ground → First → Attic (west wall zigzag)
  {
    id: "shaft_service_west",
    kind: "shaft",
    width: 0.7,
    tension: 0.35,
    rail: true,
    points: [
      { x: -8.4, y: -4.05, z: 7.0, label: "Pipe shaft", portal: true },
      { x: -8.7, y: -2.8, z: 6.2 },
      { x: -8.5, y: -1.4, z: 5.4 },
      { x: -8.6, y: 0.12, z: 4.8, label: "Pipe shaft" },
      { x: -8.8, y: 1.4, z: 4.4 },
      { x: -8.5, y: 2.8, z: 4.2 },
      { x: -8.4, y: 4.26, z: 4.5, label: "Service shaft" },
      { x: -8.6, y: 5.6, z: 3.8 },
      { x: -8.4, y: 7.0, z: 2.5 },
      { x: -7.5, y: 8.2, z: 0.5 },
      { x: -5.0, y: 8.46, z: -2.0, label: "Attic loft", portal: true },
    ],
  },

  // Dramatic drop chute: foyer cornice → foyer floor (steep slide + landing curve)
  {
    id: "chute_foyer_drop",
    kind: "chute",
    width: 0.85,
    tension: 0.4,
    rail: true,
    points: [
      { x: 0.0, y: 3.4, z: 10.5, label: "Drop chute", portal: true },
      { x: 0.0, y: 2.6, z: 9.2 },
      { x: 0.2, y: 1.6, z: 8.0 },
      { x: 0.6, y: 0.7, z: 7.2 },
      { x: 1.4, y: 0.25, z: 7.0 },
      { x: 2.6, y: 0.1, z: 7.4, label: "Safe landing" },
      { x: 3.2, y: 0.08, z: 8.5 },
    ],
  },
  // Balcony → foyer interior chute (alternate dramatic drop)
  {
    id: "chute_balcony_foyer",
    kind: "chute",
    width: 0.8,
    tension: 0.38,
    rail: true,
    points: [
      { x: -2.5, y: 4.28, z: 13.8, label: "Drop chute", portal: true },
      { x: -2.0, y: 3.4, z: 12.5 },
      { x: -1.2, y: 2.2, z: 11.2 },
      { x: -0.4, y: 1.0, z: 10.2 },
      { x: 0.2, y: 0.35, z: 9.5 },
      { x: 0.5, y: 0.1, z: 8.5, label: "Safe landing" },
    ],
  },

  // Climb tube: cellar → hall / workshop approach (spiral-ish)
  {
    id: "climb_cellar_to_hall",
    kind: "shaft",
    width: 0.68,
    tension: 0.34,
    rail: true,
    points: [
      { x: -6.5, y: -4.05, z: 4.0, label: "Climb tube", portal: true },
      { x: -7.2, y: -3.0, z: 2.5 },
      { x: -7.5, y: -1.6, z: 0.5 },
      { x: -7.2, y: -0.4, z: -2.0 },
      { x: -6.0, y: 0.12, z: -5.0, label: "Hall of Echoes" },
      { x: -4.0, y: 0.1, z: -8.0 },
      { x: -2.0, y: 0.08, z: -10.0, portal: true },
    ],
  },
  {
    id: "climb_hall_to_workshop",
    kind: "shaft",
    width: 0.68,
    tension: 0.32,
    rail: true,
    points: [
      { x: -2.5, y: 0.1, z: -18.0, label: "Climb tube", portal: true },
      { x: -4.0, y: 0.9, z: -20.0 },
      { x: -6.0, y: 2.0, z: -22.5 },
      { x: -8.0, y: 3.2, z: -25.0 },
      { x: -10.0, y: 4.0, z: -27.0 },
      { x: -12.0, y: 4.26, z: -28.0, label: "Workshop", portal: true },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // C. BETWEEN THE FLOWERS (garden shortcuts)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "flower_rose_weave",
    kind: "flower",
    width: 0.78,
    tension: 0.3,
    points: [
      { x: -8.0, y: 0.08, z: 22.0, label: "Front Drive", portal: true },
      { x: -14.0, y: 0.08, z: 18.0 },
      { x: -20.0, y: 0.09, z: 14.0, label: "Rose Walk" },
      { x: -26.0, y: 0.09, z: 12.0 },
      { x: -30.0, y: 0.1, z: 10.0 },
      { x: -32.0, y: 0.1, z: 6.0 },
      { x: -30.0, y: 0.09, z: 2.0 },
      { x: -28.0, y: 0.09, z: -2.0, label: "Petal path", portal: true },
    ],
  },
  {
    id: "flower_hedge_tunnel",
    kind: "flower",
    width: 0.72,
    tension: 0.28,
    points: [
      { x: -28.0, y: 0.09, z: -2.0, label: "Hedge tunnel", portal: true },
      { x: -29.0, y: 0.12, z: -6.0 },
      { x: -30.0, y: 0.18, z: -10.0 },
      { x: -29.5, y: 0.22, z: -14.0 },
      { x: -28.0, y: 0.12, z: -18.0, label: "Flower Beds", portal: true },
    ],
  },
  {
    id: "flower_beds_weave",
    kind: "flower",
    width: 0.75,
    tension: 0.3,
    points: [
      { x: -28.0, y: 0.1, z: -18.0, label: "Flower Beds", portal: true },
      { x: -32.0, y: 0.1, z: -16.0 },
      { x: -34.0, y: 0.1, z: -20.0 },
      { x: -32.0, y: 0.1, z: -24.0 },
      { x: -28.0, y: 0.1, z: -24.0 },
      { x: -26.0, y: 0.1, z: -22.0 },
      { x: -24.0, y: 0.09, z: -28.0 },
      { x: -20.0, y: 0.09, z: -36.0 },
      { x: -14.0, y: 0.08, z: -42.0, label: "Conservatory Terrace", portal: true },
    ],
  },
  {
    id: "flower_orchard_sneak",
    kind: "flower",
    width: 0.75,
    tension: 0.28,
    points: [
      { x: -28.0, y: 0.1, z: -24.0, label: "Flower Beds" },
      { x: -30.0, y: 0.1, z: -30.0 },
      { x: -32.0, y: 0.1, z: -36.0, label: "Orchard" },
      { x: -34.0, y: 0.1, z: -42.0 },
      { x: -30.0, y: 0.1, z: -48.0 },
      { x: -22.0, y: 0.09, z: -48.0 },
      { x: -12.0, y: 0.08, z: -46.0 },
      { x: -4.0, y: 0.08, z: -44.0, label: "Conservatory Terrace", portal: true },
    ],
  },
  {
    id: "flower_fountain_arc",
    kind: "flower",
    width: 0.8,
    tension: 0.32,
    points: [
      { x: -14.0, y: 0.08, z: -42.0, label: "Fountain arc", portal: true },
      { x: -8.0, y: 0.08, z: -46.0 },
      { x: 0.0, y: 0.08, z: -48.0 },
      { x: 8.0, y: 0.08, z: -46.0 },
      { x: 12.0, y: 0.08, z: -42.0 },
      { x: 8.0, y: 0.08, z: -40.0 },
      { x: 0.0, y: 0.08, z: -40.0, label: "Conservatory Terrace" },
    ],
  },
  // Link terrace flower path → balcony drop landing / front drive connector
  {
    id: "flower_to_drive_connector",
    kind: "flower",
    width: 0.85,
    tension: 0.25,
    points: [
      { x: 0.0, y: 0.08, z: -40.0, label: "Conservatory Terrace" },
      { x: 10.0, y: 0.08, z: -30.0 },
      { x: 16.0, y: 0.08, z: -10.0 },
      { x: 14.0, y: 0.08, z: 10.0 },
      { x: 8.0, y: 0.08, z: 22.0 },
      { x: 0.0, y: 0.08, z: 23.0, label: "Front Drive", portal: true },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // D. SPECIAL UPPER TRACKS (expand cornice / bookcase / chandelier)
  // ═══════════════════════════════════════════════════════════════

  // Diagonal corner brace bridges (foyer corners)
  {
    id: "cornice_foyer_brace_nw",
    kind: "cornice",
    width: 0.48,
    rail: true,
    tension: 0.2,
    points: [
      { x: -8.2, y: 3.35, z: 12.2, label: "Shortcut bridge" },
      { x: -6.0, y: 3.42, z: 10.0 },
      { x: -4.0, y: 3.4, z: 8.0 },
      { x: -3.2, y: 3.35, z: 6.0 },
    ],
  },
  {
    id: "cornice_foyer_brace_ne",
    kind: "cornice",
    width: 0.48,
    rail: true,
    tension: 0.2,
    points: [
      { x: 8.2, y: 3.35, z: 12.2, label: "Shortcut bridge" },
      { x: 6.0, y: 3.42, z: 10.0 },
      { x: 4.0, y: 3.4, z: 8.0 },
      { x: 3.2, y: 3.35, z: 6.0 },
    ],
  },
  {
    id: "cornice_hall_brace",
    kind: "cornice",
    width: 0.46,
    rail: true,
    points: [
      { x: -3.1, y: 3.35, z: -12 },
      { x: 0.0, y: 3.48, z: -11.2, label: "Shortcut bridge" },
      { x: 3.1, y: 3.35, z: -12 },
    ],
  },

  // Chandelier ring — decorative loop at foyer chandelier height
  {
    id: "chandelier_ring_foyer",
    kind: "elevated",
    width: 0.5,
    rail: true,
    tension: 0.22,
    closed: true,
    points: [
      { x: 0.0, y: 2.85, z: 7.2, label: "Chandelier ring" },
      { x: 1.6, y: 2.85, z: 6.6 },
      { x: 2.0, y: 2.88, z: 5.2 },
      { x: 1.2, y: 2.85, z: 4.0 },
      { x: 0.0, y: 2.85, z: 3.6 },
      { x: -1.2, y: 2.85, z: 4.0 },
      { x: -2.0, y: 2.88, z: 5.2 },
      { x: -1.6, y: 2.85, z: 6.6 },
      { x: 0.0, y: 2.85, z: 7.2 },
    ],
  },
  // On-ramp to chandelier ring from foyer cornice south header
  {
    id: "ramp_cornice_to_chandelier",
    kind: "ramp",
    width: 0.48,
    points: [
      { x: 0.0, y: 3.4, z: -0.5, label: "Hall Header Bridge" },
      { x: 0.0, y: 3.2, z: 1.5 },
      { x: 0.0, y: 3.0, z: 2.8 },
      { x: 0.0, y: 2.85, z: 3.6, label: "Chandelier ring" },
    ],
  },

  // Bookcase-top express: library → nursery → study
  {
    id: "bookcase_express_lib_nursery",
    kind: "elevated",
    width: 0.45,
    rail: true,
    tension: 0.22,
    points: [
      { x: 3.1, y: 6.8, z: -10, label: "Bookcase Highway" },
      { x: 5.0, y: 6.75, z: -10 },
      { x: 8.0, y: 6.7, z: -9.5 },
      { x: 11.0, y: 6.65, z: -8.5 },
      { x: 14.0, y: 6.6, z: -8.0, label: "Nursery Express" },
      { x: 16.0, y: 6.55, z: -7.0 },
      { x: 18.0, y: 5.8, z: -5.5 },
      { x: 18.5, y: 5.1, z: -4.5, label: "Toy Chest" },
    ],
  },
  {
    id: "bookcase_express_lib_study",
    kind: "elevated",
    width: 0.45,
    rail: true,
    tension: 0.22,
    points: [
      { x: -3.1, y: 6.8, z: -10, label: "Bookcase Highway" },
      { x: -5.0, y: 6.75, z: -10 },
      { x: -8.0, y: 6.7, z: -9.5 },
      { x: -11.0, y: 6.65, z: -8.5 },
      { x: -14.0, y: 6.6, z: -8.0, label: "Study Express" },
      { x: -16.0, y: 6.4, z: -7.0 },
      { x: -17.5, y: 5.6, z: -6.0 },
      { x: -18.0, y: 5.25, z: -5.0, label: "Study & Darkroom" },
    ],
  },
  // Nursery ↔ Study cross via library north header (completes express triangle)
  {
    id: "bookcase_express_cross",
    kind: "elevated",
    width: 0.42,
    rail: true,
    points: [
      { x: 14.0, y: 6.6, z: -8.0, label: "Nursery Express" },
      { x: 8.0, y: 6.7, z: -12.0 },
      { x: 0.0, y: 6.85, z: -14.0, label: "Library Express" },
      { x: -8.0, y: 6.7, z: -12.0 },
      { x: -14.0, y: 6.6, z: -8.0, label: "Study Express" },
    ],
  },
];

/** Spawn pose for RC car (foyer road). */
export const CAR_SPAWN = { x: 0, y: 0.12, z: 11, yaw: Math.PI };

/** Labels that are shortcut/shaft toasts (no "Entering" prefix). */
export const SHORTCUT_TOAST_RE = /mouse run|wall hollow|pipe shaft|service shaft|drop chute|climb tube|safe landing|petal path|hedge tunnel|fountain arc|shortcut bridge|chandelier ring|nursery express|study express|library express/i;
