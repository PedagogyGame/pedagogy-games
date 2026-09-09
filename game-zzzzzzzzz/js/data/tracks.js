/**
 * Drive-mode track waypoints for the mansion.
 * Floor paths are PERIMETER / SKIRTING loops (0.4–0.8 m from walls) —
 * never highways through room centers.
 * kind: floor | elevated | ramp | tunnel | outdoor | cornice | balcony | shortcut | shaft | chute | flower
 * label: optional room-enter toast
 */
export const TRACK_PATHS = [

  // ═══════════════════════════════════════════════════════════════
  // GROUND FLOOR — skirting / perimeter only (NO center highways)
  // Room walls ≈ foyer ±9×(z -1..13), hall ±3.6×(z 2..-22),
  // conservatory ±11×(z -21..-39), dining -24..-8 × -23..-37
  // ═══════════════════════════════════════════════════════════════

  // Foyer skirting loop (hug walls ~0.55–0.7 m inset)
  
  
  {
    id: "foyer_skirting",
    kind: "floor",
    width: 0.42,
    tension: 0.12,
    closed: true,
    fancy: true,
    points: [
      { x: -7.9, y: 0.06, z: 12.2, label: "Grand Foyer" },
      { x: -4.0, y: 0.06, z: 12.35 },
      { x: 0.0, y: 0.06, z: 12.4 },
      { x: 4.0, y: 0.06, z: 12.35 },
      { x: 7.9, y: 0.06, z: 12.2 },
      { x: 8.15, y: 0.06, z: 11.3 },
      { x: 8.2, y: 0.06, z: 10.5 },
      { x: 8.35, y: 0.06, z: 9.0 },
      { x: 8.35, y: 0.06, z: 5.0 },
      { x: 8.35, y: 0.06, z: 1.0 },
      { x: 8.2, y: 0.06, z: -0.35 },
      { x: 2.85, y: 0.06, z: -0.4 },
      { x: -2.85, y: 0.06, z: -0.4 },
      { x: -8.2, y: 0.06, z: -0.35 },
      { x: -8.35, y: 0.06, z: 1.0 },
      { x: -8.35, y: 0.06, z: 5.0 },
      { x: -8.3, y: 0.06, z: 9.05 },
      { x: -8.3, y: 0.06, z: 10.5 },
      { x: -8.15, y: 0.06, z: 11.35 },
      { x: -7.9, y: 0.06, z: 12.2 },
    ],
  },
  // Doorway edge strip: foyer → hall (east jamb, not dead center)
  {
    id: "door_foyer_hall_east",
    kind: "floor",
    width: 0.38,
    tension: 0.15,
    points: [
      { x: 2.85, y: 0.06, z: -0.4, label: "Grand Foyer" },
      { x: 2.85, y: 0.06, z: -1.2 },
      { x: 2.9, y: 0.06, z: -2.2, label: "Hall of Echoes" },
    ],
  },
  {
    id: "door_foyer_hall_west",
    kind: "floor",
    width: 0.38,
    tension: 0.15,
    points: [
      { x: -2.85, y: 0.06, z: -0.4 },
      { x: -2.85, y: 0.06, z: -1.2 },
      { x: -2.9, y: 0.06, z: -2.2, label: "Hall of Echoes" },
    ],
  },
  // Hall of Echoes — twin wall runs (east + west skirting), linked at ends
  {
    id: "hall_skirting_east",
    kind: "floor",
    width: 0.4,
    tension: 0.16,
    points: [
      { x: 2.9, y: 0.06, z: -2.2, label: "Hall of Echoes" },
      { x: 2.95, y: 0.06, z: -6 },
      { x: 2.95, y: 0.06, z: -10 },
      { x: 2.95, y: 0.06, z: -14 },
      { x: 2.95, y: 0.06, z: -18 },
      { x: 2.9, y: 0.06, z: -21.2 },
    ],
  },
  {
    id: "hall_skirting_west",
    kind: "floor",
    width: 0.4,
    tension: 0.16,
    points: [
      { x: -2.9, y: 0.06, z: -2.2, label: "Hall of Echoes" },
      { x: -2.95, y: 0.06, z: -6 },
      { x: -2.95, y: 0.06, z: -10 },
      { x: -2.95, y: 0.06, z: -14 },
      { x: -2.95, y: 0.06, z: -18 },
      { x: -2.9, y: 0.06, z: -21.2 },
    ],
  },
  // Thin cross-links at hall ends (near walls, not mid-spine)
  {
    id: "hall_cross_south",
    kind: "floor",
    width: 0.36,
    points: [
      { x: -2.9, y: 0.06, z: -2.4 },
      { x: 0.0, y: 0.06, z: -2.55 },
      { x: 2.9, y: 0.06, z: -2.4 },
    ],
  },
  {
    id: "hall_cross_north",
    kind: "floor",
    width: 0.36,
    points: [
      { x: -2.9, y: 0.06, z: -21.0 },
      { x: 0.0, y: 0.06, z: -21.15 },
      { x: 2.9, y: 0.06, z: -21.0 },
    ],
  },
  // Door edge: hall → conservatory
  {
    id: "door_hall_conservatory",
    kind: "floor",
    width: 0.38,
    points: [
      { x: 2.5, y: 0.06, z: -21.2, label: "Hall of Echoes" },
      { x: 2.4, y: 0.06, z: -21.8 },
      { x: 2.2, y: 0.06, z: -22.6, label: "Conservatory" },
    ],
  },
  {
    id: "door_hall_conservatory_w",
    kind: "floor",
    width: 0.38,
    points: [
      { x: -2.5, y: 0.06, z: -21.2 },
      { x: -2.4, y: 0.06, z: -21.8 },
      { x: -2.2, y: 0.06, z: -22.6, label: "Conservatory" },
    ],
  },
  // Conservatory perimeter (hug glass walls)
  {
    id: "conservatory_skirting",
    kind: "floor",
    width: 0.45,
    tension: 0.18,
    closed: true,
    points: [
      { x: 2.2, y: 0.06, z: -22.6, label: "Conservatory" },
      { x: 6.0, y: 0.06, z: -22.5 },
      { x: 10.2, y: 0.06, z: -22.5 },
      { x: 10.35, y: 0.06, z: -26 },
      { x: 10.35, y: 0.06, z: -30 },
      { x: 10.35, y: 0.06, z: -34 },
      { x: 10.2, y: 0.06, z: -38.2 },
      { x: 5.0, y: 0.06, z: -38.35 },
      { x: 0.0, y: 0.06, z: -38.4 },
      { x: -5.0, y: 0.06, z: -38.35 },
      { x: -10.2, y: 0.06, z: -38.2 },
      { x: -10.35, y: 0.06, z: -34 },
      { x: -10.35, y: 0.06, z: -30 },
      { x: -10.35, y: 0.06, z: -26 },
      { x: -10.2, y: 0.06, z: -22.5 },
      { x: -6.0, y: 0.06, z: -22.5 },
      { x: -2.2, y: 0.06, z: -22.6 },
      { x: 2.2, y: 0.06, z: -22.6 },
    ],
  },
  // Door edge: conservatory → dining (west jamb strip)
  {
    id: "door_cons_dining",
    kind: "floor",
    width: 0.38,
    points: [
      { x: -10.2, y: 0.06, z: -29.2, label: "Conservatory" },
      { x: -10.8, y: 0.06, z: -29.5 },
      { x: -11.6, y: 0.06, z: -29.8, label: "Breakfast Parlor" },
    ],
  },
  // Dining / breakfast parlor skirting
  {
    id: "dining_skirting",
    kind: "floor",
    width: 0.42,
    tension: 0.18,
    closed: true,
    points: [
      { x: -11.6, y: 0.06, z: -29.8, label: "Breakfast Parlor" },
      { x: -11.5, y: 0.06, z: -26.5 },
      { x: -11.5, y: 0.06, z: -23.6 },
      { x: -16.0, y: 0.06, z: -23.5 },
      { x: -20.0, y: 0.06, z: -23.5 },
      { x: -23.2, y: 0.06, z: -23.6 },
      { x: -23.35, y: 0.06, z: -27 },
      { x: -23.35, y: 0.06, z: -30 },
      { x: -23.35, y: 0.06, z: -33 },
      { x: -23.2, y: 0.06, z: -36.4 },
      { x: -20.0, y: 0.06, z: -36.5 },
      { x: -16.0, y: 0.06, z: -36.5 },
      { x: -11.5, y: 0.06, z: -36.4 },
      { x: -11.5, y: 0.06, z: -33 },
      { x: -11.6, y: 0.06, z: -29.8 },
    ],
  },
  // Cabinet spur — along hall west wall then room perimeter (not center cut)
  {
    id: "hall_to_cabinet_skirt",
    kind: "floor",
    width: 0.4,
    tension: 0.16,
    points: [
      { x: -2.95, y: 0.06, z: -7.5, label: "Hall of Echoes" },
      { x: -3.6, y: 0.06, z: -7.6 },
      { x: -4.5, y: 0.06, z: -7.7 },
      { x: -5.5, y: 0.06, z: -7.8, label: "Cabinet of Curiosities" },
    ],
  },
  {
    id: "cabinet_skirting",
    kind: "floor",
    width: 0.42,
    tension: 0.18,
    closed: true,
    points: [
      { x: -5.5, y: 0.06, z: -7.8, label: "Cabinet of Curiosities" },
      { x: -5.4, y: 0.06, z: -4.0 },
      { x: -5.4, y: 0.06, z: -1.0 },
      { x: -10.0, y: 0.06, z: -0.85 },
      { x: -16.0, y: 0.06, z: -0.85 },
      { x: -22.5, y: 0.06, z: -0.9 },
      { x: -23.35, y: 0.06, z: -4 },
      { x: -23.35, y: 0.06, z: -8 },
      { x: -23.35, y: 0.06, z: -12 },
      { x: -22.5, y: 0.06, z: -15.1 },
      { x: -16.0, y: 0.06, z: -15.15 },
      { x: -10.0, y: 0.06, z: -15.15 },
      { x: -5.4, y: 0.06, z: -15.1 },
      { x: -5.4, y: 0.06, z: -12 },
      { x: -5.5, y: 0.06, z: -7.8 },
    ],
  },
  // Armoury spur — east wall then room perimeter
  {
    id: "hall_to_armoury_skirt",
    kind: "floor",
    width: 0.4,
    tension: 0.16,
    points: [
      { x: 2.95, y: 0.06, z: -7.5, label: "Hall of Echoes" },
      { x: 3.6, y: 0.06, z: -7.6 },
      { x: 4.5, y: 0.06, z: -7.7 },
      { x: 5.5, y: 0.06, z: -7.8, label: "Armoury & Game Room" },
    ],
  },
  {
    id: "armoury_skirting",
    kind: "floor",
    width: 0.42,
    tension: 0.18,
    closed: true,
    points: [
      { x: 5.5, y: 0.06, z: -7.8, label: "Armoury & Game Room" },
      { x: 5.4, y: 0.06, z: -4.0 },
      { x: 5.4, y: 0.06, z: -1.0 },
      { x: 10.0, y: 0.06, z: -0.85 },
      { x: 16.0, y: 0.06, z: -0.85 },
      { x: 22.5, y: 0.06, z: -0.9 },
      { x: 23.35, y: 0.06, z: -4 },
      { x: 23.35, y: 0.06, z: -8 },
      { x: 23.35, y: 0.06, z: -12 },
      { x: 22.5, y: 0.06, z: -15.1 },
      { x: 16.0, y: 0.06, z: -15.15 },
      { x: 10.0, y: 0.06, z: -15.15 },
      { x: 5.4, y: 0.06, z: -15.1 },
      { x: 5.4, y: 0.06, z: -12 },
      { x: 5.5, y: 0.06, z: -7.8 },
    ],
  },
  // Outdoor — mansion exterior perimeter (NOT center driveway spine)
  
  {
    id: "outdoor_perimeter",
    kind: "outdoor",
    width: 0.55,
    tension: 0.12,
    closed: true,
    fancy: true,
    points: [
      // Softened corners (fillets) so Catmull stays on asphalt ribbon
      { x: -6.5, y: 0.08, z: 14.2, label: "Front Drive" },
      { x: -4.58, y: 0.08, z: 14.29 },
      { x: 0.0, y: 0.08, z: 14.5 },
      { x: 6.5, y: 0.08, z: 14.2 },
      { x: 9.2, y: 0.08, z: 16.5 },
      { x: 10.0, y: 0.08, z: 18 },
      { x: 12.0, y: 0.08, z: 20.2 },
      { x: 14.0, y: 0.08, z: 22, label: "Rose Walk" },
      { x: 16.2, y: 0.08, z: 18.5 },
      { x: 18.0, y: 0.08, z: 14 },
      { x: 20.0, y: 0.08, z: 0 },
      { x: 18.0, y: 0.08, z: -18 },
      { x: 15.5, y: 0.08, z: -30 },
      { x: 14.0, y: 0.08, z: -36 },
      { x: 11.2, y: 0.08, z: -39.2 },
      { x: 8.0, y: 0.08, z: -42 },
      { x: 0.0, y: 0.08, z: -44.5, label: "Conservatory Terrace" },
      { x: -8.0, y: 0.08, z: -42 },
      { x: -11.2, y: 0.08, z: -39.2 },
      { x: -14.0, y: 0.08, z: -36 },
      { x: -15.5, y: 0.08, z: -30 },
      { x: -18.0, y: 0.08, z: -18 },
      { x: -20.0, y: 0.08, z: 0 },
      { x: -16.0, y: 0.08, z: 14 },
      { x: -12.5, y: 0.08, z: 17.8 },
      { x: -10.0, y: 0.08, z: 20 },
      { x: -8.0, y: 0.08, z: 17.2 },
      { x: -6.5, y: 0.08, z: 14.2 },
    ],
  },
  // Tiny edge pad: front door → outdoor (side of threshold)
  
  {
    id: "door_foyer_outdoor",
    kind: "outdoor",
    width: 0.4,
    tension: 0.12,
    points: [
      // Kiss foyer south skirting → outdoor front-drive ribbon
      { x: -3.2, y: 0.06, z: 12.35, label: "Grand Foyer" },
      { x: -3.55, y: 0.07, z: 13.1 },
      { x: -4.15, y: 0.08, z: 13.75 },
      { x: -4.58, y: 0.08, z: 14.29, label: "Front Drive" },
    ],
  },

  // First floor — wall skirting (replaces center spine highways)
  
  
  {
    id: "landing_skirting",
    kind: "floor",
    width: 0.4,
    tension: 0.1,
    closed: true,
    fancy: true,
    points: [
      // Extra NW/NE fillets + lower tension keep Catmull on asphalt
      { x: -6.8, y: 4.26, z: 8.8, label: "Upper Landing" },
      { x: -4.5, y: 4.26, z: 8.95 },
      { x: -2.0, y: 4.26, z: 9.0 },
      { x: 0.0, y: 4.26, z: 9.0 },
      { x: 2.0, y: 4.26, z: 9.0 },
      { x: 4.5, y: 4.26, z: 8.95 },
      { x: 6.8, y: 4.26, z: 8.8 },
      { x: 7.1, y: 4.26, z: 7.0 },
      { x: 7.2, y: 4.26, z: 5.0 },
      { x: 7.2, y: 4.26, z: 1.0 },
      { x: 2.9, y: 4.26, z: -0.8 },
      { x: -2.9, y: 4.26, z: -0.8 },
      { x: -7.2, y: 4.26, z: 1.0 },
      { x: -7.2, y: 4.26, z: 5.0 },
      { x: -7.1, y: 4.26, z: 7.0 },
      { x: -6.8, y: 4.26, z: 8.8 },
    ],
  },
  {
    id: "library_skirting_east",
    kind: "floor",
    width: 0.38,
    tension: 0.16,
    points: [
      { x: 2.9, y: 4.26, z: -0.8, label: "Library Hall" },
      { x: 2.95, y: 4.26, z: -4 },
      { x: 2.95, y: 4.26, z: -10 },
      { x: 2.95, y: 4.26, z: -16 },
      { x: 2.9, y: 4.26, z: -19.5 },
    ],
  },
  {
    id: "library_skirting_west",
    kind: "floor",
    width: 0.38,
    tension: 0.16,
    points: [
      { x: -2.9, y: 4.26, z: -0.8, label: "Library Hall" },
      { x: -2.95, y: 4.26, z: -4 },
      { x: -2.95, y: 4.26, z: -10 },
      { x: -2.95, y: 4.26, z: -16 },
      { x: -2.9, y: 4.26, z: -19.5 },
    ],
  },
  {
    id: "door_library_music",
    kind: "floor",
    width: 0.36,
    points: [
      { x: 2.5, y: 4.26, z: -19.5, label: "Library Hall" },
      { x: 2.4, y: 4.26, z: -20.5 },
      { x: 2.2, y: 4.26, z: -21.5, label: "Music Room" },
    ],
  },
  {
    id: "music_skirting",
    kind: "floor",
    width: 0.42,
    tension: 0.18,
    closed: true,
    points: [
      { x: 2.2, y: 4.26, z: -21.5, label: "Music Room" },
      { x: 6.0, y: 4.26, z: -21.4 },
      { x: 9.2, y: 4.26, z: -21.4 },
      { x: 9.35, y: 4.26, z: -25 },
      { x: 9.35, y: 4.26, z: -30 },
      { x: 9.2, y: 4.26, z: -34.6 },
      { x: 4.0, y: 4.26, z: -34.8 },
      { x: 0.0, y: 4.26, z: -34.85 },
      { x: -4.0, y: 4.26, z: -34.8 },
      { x: -9.2, y: 4.26, z: -34.6 },
      { x: -9.35, y: 4.26, z: -30 },
      { x: -9.35, y: 4.26, z: -25 },
      { x: -9.2, y: 4.26, z: -21.4 },
      { x: -4.0, y: 4.26, z: -21.4 },
      { x: -2.2, y: 4.26, z: -21.5 },
      { x: 2.2, y: 4.26, z: -21.5 },
    ],
  },
  {
    id: "door_music_workshop",
    kind: "floor",
    width: 0.36,
    points: [
      { x: -9.2, y: 4.26, z: -28, label: "Music Room" },
      { x: -10.0, y: 4.26, z: -28 },
      { x: -11.2, y: 4.26, z: -28, label: "Workshop" },
    ],
  },
  {
    id: "workshop_skirting",
    kind: "floor",
    width: 0.4,
    tension: 0.18,
    closed: true,
    points: [
      { x: -11.2, y: 4.26, z: -28, label: "Workshop" },
      { x: -11.1, y: 4.26, z: -24.5 },
      { x: -11.1, y: 4.26, z: -22.2 },
      { x: -16.0, y: 4.26, z: -22.1 },
      { x: -20.5, y: 4.26, z: -22.1 },
      { x: -21.2, y: 4.26, z: -25 },
      { x: -21.2, y: 4.26, z: -30 },
      { x: -21.2, y: 4.26, z: -33.8 },
      { x: -16.0, y: 4.26, z: -33.9 },
      { x: -11.1, y: 4.26, z: -33.8 },
      { x: -11.1, y: 4.26, z: -30 },
      { x: -11.2, y: 4.26, z: -28 },
    ],
  },
  {
    id: "door_library_nursery",
    kind: "floor",
    width: 0.36,
    points: [
      { x: 2.95, y: 4.26, z: -8, label: "Library Hall" },
      { x: 4.0, y: 4.26, z: -8 },
      { x: 5.5, y: 4.26, z: -8, label: "Nursery" },
    ],
  },
  {
    id: "nursery_skirting",
    kind: "floor",
    width: 0.4,
    tension: 0.18,
    closed: true,
    points: [
      { x: 5.5, y: 4.26, z: -8, label: "Nursery" },
      { x: 5.4, y: 4.26, z: -4.0 },
      { x: 5.4, y: 4.26, z: -2.2 },
      { x: 10.0, y: 4.26, z: -2.1 },
      { x: 16.0, y: 4.26, z: -2.1 },
      { x: 20.5, y: 4.26, z: -2.2 },
      { x: 21.2, y: 4.26, z: -5 },
      { x: 21.2, y: 4.26, z: -8 },
      { x: 21.2, y: 4.26, z: -12 },
      { x: 20.5, y: 4.26, z: -14.0 },
      { x: 16.0, y: 4.26, z: -14.1 },
      { x: 10.0, y: 4.26, z: -14.1 },
      { x: 5.4, y: 4.26, z: -14.0 },
      { x: 5.4, y: 4.26, z: -11 },
      { x: 5.5, y: 4.26, z: -8 },
    ],
  },
  {
    id: "door_library_study",
    kind: "floor",
    width: 0.36,
    points: [
      { x: -2.95, y: 4.26, z: -8, label: "Library Hall" },
      { x: -4.0, y: 4.26, z: -8 },
      { x: -5.5, y: 4.26, z: -8, label: "Study & Darkroom" },
    ],
  },
  {
    id: "study_skirting",
    kind: "floor",
    width: 0.4,
    tension: 0.18,
    closed: true,
    points: [
      { x: -5.5, y: 4.26, z: -8, label: "Study & Darkroom" },
      { x: -5.4, y: 4.26, z: -4.0 },
      { x: -5.4, y: 4.26, z: -2.2 },
      { x: -10.0, y: 4.26, z: -2.1 },
      { x: -16.0, y: 4.26, z: -2.1 },
      { x: -20.5, y: 4.26, z: -2.2 },
      { x: -21.2, y: 4.26, z: -5 },
      { x: -21.2, y: 4.26, z: -8 },
      { x: -21.2, y: 4.26, z: -12 },
      { x: -20.5, y: 4.26, z: -14.0 },
      { x: -16.0, y: 4.26, z: -14.1 },
      { x: -10.0, y: 4.26, z: -14.1 },
      { x: -5.4, y: 4.26, z: -14.0 },
      { x: -5.4, y: 4.26, z: -11 },
      { x: -5.5, y: 4.26, z: -8 },
    ],
  },
  {
    id: "music_to_mezzanine_skirt",
    kind: "floor",
    width: 0.38,
    points: [
      { x: 9.2, y: 4.26, z: -28, label: "Music Room" },
      { x: 11.0, y: 4.26, z: -28 },
      { x: 14.0, y: 4.26, z: -28, label: "East Mezzanine" },
      { x: 14.0, y: 4.26, z: -24 },
      { x: 14.0, y: 4.26, z: -20 },
    ],
  },
  {
    id: "mezzanine_to_landing_skirt",
    kind: "floor",
    width: 0.38,
    points: [
      { x: 14.0, y: 4.26, z: -14 },
      { x: 11.5, y: 4.26, z: -6 },
      { x: 9.0, y: 4.26, z: 0.5 },
      { x: 7.2, y: 4.26, z: 5.0, label: "Upper Landing" },
    ],
  },

  // ─── Wall tunnels / incline corridors ───
  {
    id: "tunnel_hall_cabinet",
    kind: "tunnel",
    width: 0.4,
    points: [
      { x: -2.95, y: 0.06, z: -10, label: "Wall Tunnel" },
      { x: -3.6, y: 0.28, z: -10.2 },
      { x: -4.4, y: 0.4, z: -10.8 },
      { x: -5.0, y: 0.25, z: -11.5 },
      { x: -5.4, y: 0.06, z: -12.0, label: "Cabinet of Curiosities" },
    ],
  },
  {
    id: "tunnel_hall_armoury",
    kind: "tunnel",
    width: 0.4,
    points: [
      { x: 2.95, y: 0.06, z: -14, label: "Wall Tunnel" },
      { x: 3.6, y: 0.28, z: -13.5 },
      { x: 4.4, y: 0.35, z: -13.0 },
      { x: 5.0, y: 0.2, z: -12.5 },
      { x: 5.4, y: 0.06, z: -12.0, label: "Armoury & Game Room" },
    ],
  },


  // Driveable stair ramp: foyer west stair → upper landing (reach furniture circuits)
  
  
  
  {
    id: "ramp_foyer_to_landing",
    kind: "ramp",
    width: 0.52,
    points: [
      // Lengthened spiral (more run) — softener evens Y; crest stays landing y=4.26
      { x: -8.3, y: 0.06, z: 9.05, label: "Grand Foyer" },
      { x: -8.28, y: 0.28, z: 8.15 },
      { x: -8.26, y: 0.52, z: 7.2 },
      { x: -8.22, y: 0.78, z: 6.2 },
      { x: -8.12, y: 1.08, z: 5.25 },
      { x: -7.92, y: 1.4, z: 4.4 },
      { x: -7.55, y: 1.72, z: 3.75 },
      { x: -7.0, y: 2.05, z: 3.35 },
      { x: -6.3, y: 2.38, z: 3.25 },
      { x: -5.65, y: 2.7, z: 3.55 },
      { x: -5.35, y: 3.0, z: 4.25 },
      { x: -5.45, y: 3.28, z: 5.05 },
      { x: -5.95, y: 3.55, z: 5.55 },
      { x: -6.5, y: 3.8, z: 5.55 },
      { x: -6.9, y: 4.02, z: 5.3 },
      { x: -7.2, y: 4.26, z: 5.0, label: "Upper Landing" },
    ],
  },
  // ─── Furniture-top circuits + ramps (Toy Story vibe) ───
  // 1) Foyer console top
  
  
  
  
  
  {
    id: "ramp_foyer_console",
    kind: "ramp",
    width: 0.48,
    points: [
      { x: 8.3, y: 0.06, z: 10.5 },
      { x: 7.85, y: 0.22, z: 10.45 },
      { x: 7.4, y: 0.4, z: 10.38 },
      { x: 7.0, y: 0.58, z: 10.3 },
      { x: 6.65, y: 0.74, z: 10.25 },
      { x: 6.4, y: 0.88, z: 10.22 },
      { x: 6.2, y: 0.98, z: 10.2, label: "Foyer Console" },
    ],
  },
  
  {
    id: "furniture_foyer_console",
    kind: "elevated",
    width: 0.40,
    rail: true,
    closed: true,
    tension: 0.1,
    points: [
      // Softer loop — less yaw kink at SE/SW corners; kiss to cornice ramp
      { x: 6.2, y: 0.98, z: 10.2, label: "Foyer Console" },
      { x: 5.7, y: 0.98, z: 10.22 },
      { x: 5.15, y: 0.98, z: 10.05 },
      { x: 4.85, y: 0.98, z: 9.8 },
      { x: 5.2, y: 0.98, z: 9.65 },
      { x: 5.8, y: 0.98, z: 9.7 },
      { x: 6.25, y: 0.98, z: 9.85 },
      { x: 6.2, y: 0.98, z: 10.2 },
    ],
  },
  
  {
    id: "ramp_foyer_console_down",
    kind: "ramp",
    width: 0.40,
    points: [
      // Foot kissed to softened console SE corner
      { x: 4.85, y: 0.98, z: 9.8 },
      { x: 6.0, y: 0.55, z: 9.4 },
      { x: 7.15, y: 0.18, z: 9.95 },
      { x: 8.15, y: 0.06, z: 10.5 }, // crest kiss foyer_skirting ≤0.05
    ],
  },

  // 2) Dining table edge circuit
  {
    id: "ramp_dining_table",
    kind: "ramp",
    width: 0.40,
    points: [
      { x: -11.6, y: 0.06, z: -29.8 },
      { x: -13.0, y: 0.35, z: -30.0 },
      { x: -14.4, y: 0.7, z: -30.0 },
      { x: -15.5, y: 0.95, z: -30.0, label: "Dining Table" },
    ],
  },
  {
    id: "furniture_dining_table",
    kind: "elevated",
    width: 0.40,
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
    width: 0.40,
    points: [
      { x: -13.25, y: 0.98, z: -29.85 },
      { x: -12.0, y: 0.5, z: -28.5 },
      { x: -11.7, y: 0.16, z: -27.2 },
      { x: -11.5, y: 0.06, z: -26.52 }, // crest kiss dining_skirting ≤0.05
    ],
  },

  // Breakfast Parlor west wall breakthrough — table highway continues into gardens
  // (was a flat green-wall dead-end; now portal + wall-hollow mouse run)
  {
    id: "mouse_dining_west_garden",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "mouse",
    width: 0.26,
    tension: 0.28,
    rail: true,
    boostExit: true,
    points: [
      { x: -19.4, y: 0.95, z: -30.0, label: "Mouse run", portal: true },
      { x: -20.2, y: 0.92, z: -30.0 },
      { x: -21.6, y: 0.78, z: -30.1 },
      { x: -22.8, y: 0.55, z: -30.2, label: "Wall hollow" },
      { x: -23.6, y: 0.35, z: -29.5 },
      { x: -24.4, y: 0.18, z: -28.5 },
      { x: -25.2, y: 0.1, z: -26.5 },
      { x: -26.0, y: 0.1, z: -24.0 },
      { x: -28.0, y: 0.1, z: -24.0, label: "Flower Beds", portal: true },
    ],
  },
  // Cornice-level twin: dining west cornice → outdoor (between-walls feel)
  {
    id: "mouse_dining_cornice_garden",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "shortcut",
    width: 0.26,
    tension: 0.28,
    rail: true,
    boostExit: true,
    points: [
      { x: -22.7, y: 3.4, z: -30.5, label: "Mouse run", portal: true },
      { x: -23.3, y: 3.2, z: -30.2 },
      { x: -23.8, y: 2.7, z: -29.5, label: "Wall hollow" },
      { x: -24.4, y: 2.0, z: -28.5 },
      { x: -25.0, y: 1.2, z: -27.0 },
      { x: -25.6, y: 0.55, z: -25.5 },
      { x: -26.0, y: 0.1, z: -24.0, label: "Flower Beds", portal: true },
    ],
  },

  // 3) Cabinet display case tops
  {
    id: "ramp_cabinet_case",
    kind: "ramp",
    width: 0.40,
    points: [
      { x: -5.4, y: 0.06, z: -4.0 },
      { x: -8.0, y: 0.3, z: -3.6 },
      { x: -10.5, y: 0.65, z: -3.2 },
      { x: -12.2, y: 1.05, z: -3.0 },
      { x: -13.4, y: 1.45, z: -3.4 },
      { x: -14.0, y: 1.78, z: -4.0, label: "Display Case" },
    ],
  },
  {
    id: "furniture_cabinet_cases",
    kind: "elevated",
    width: 0.44,
    rail: true,
    tension: 0.02,
    closed: true,
    points: [
      { x: -14, y: 1.82, z: -4 },
      { x: -17, y: 1.82, z: -4 },
      { x: -20, y: 1.82, z: -4 },
      { x: -20, y: 1.82, z: -8 },
      { x: -20, y: 1.82, z: -12 },
      { x: -14, y: 1.82, z: -12 },
      { x: -11, y: 1.82, z: -12 },
      { x: -8, y: 1.82, z: -12 },
      { x: -8, y: 1.82, z: -8 },
      { x: -8, y: 1.82, z: -4 },
      { x: -11, y: 1.82, z: -4 },
    ],
  },
    {
    id: "ramp_cabinet_down",
    kind: "ramp",
    width: 0.40,
    points: [
      // Straightened descent (was zigzagging — CatmullRom bowed past halfW)
      { x: -8.0, y: 1.82, z: -8.0 },
      { x: -7.2, y: 1.35, z: -7.9 },
      { x: -6.4, y: 0.9, z: -7.85 },
      { x: -5.8, y: 0.5, z: -7.82 },
      { x: -5.5, y: 0.06, z: -7.8 },
    ],
  },

  // 4) Workshop bench (first floor)
  {
    id: "ramp_workshop_bench",
    kind: "ramp",
    width: 0.42,
    points: [
      // Smooth westward climb — no 162° V-kink
      { x: -11.1, y: 4.26, z: -30.0, label: "Workshop" },
      { x: -11.6, y: 4.45, z: -30.25 },
      { x: -12.25, y: 4.68, z: -30.55 },
      { x: -12.95, y: 4.9, z: -30.9 },
      { x: -13.55, y: 5.05, z: -31.25 },
      { x: -14.0, y: 5.15, z: -31.5, label: "Workshop Bench" },
    ],
  },
  {
    id: "furniture_workshop_bench",
    kind: "elevated",
    width: 0.40,
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
    width: 0.40,
    points: [
      { x: -10.05, y: 5.18, z: -31.45 },
      { x: -9.2, y: 4.85, z: -30.2 },
      { x: -10.0, y: 4.5, z: -28.8 },
      { x: -11.2, y: 4.26, z: -28.0, label: "Workshop" },
    ],
  },

  // 5) Library bookcase tops + corner shelf highway
  {
    id: "ramp_library_bookcase",
    kind: "ramp",
    width: 0.40,
    points: [
      { x: 2.8, y: 4.26, z: -10, label: "Library Hall" },
      { x: 1.6, y: 4.55, z: -8.8 },
      { x: 0.6, y: 4.95, z: -8.0 },
      { x: 0.2, y: 5.4, z: -8.6 },
      { x: 0.6, y: 5.85, z: -9.6 },
      { x: 1.5, y: 6.25, z: -10.2 },
      { x: 2.4, y: 6.55, z: -10.1 },
      { x: 3.1, y: 6.8, z: -10.0, label: "Bookcase Highway" },
    ],
  },
  {
    id: "furniture_library_tops",
    kind: "elevated",
    width: 0.42,
    rail: true,
    tension: 0.02,
    closed: true,
    points: [
      { x: 3.1, y: 6.8, z: -4 },
      { x: 3.1, y: 6.8, z: -10 },
      { x: 3.1, y: 6.8, z: -16 },
      { x: 0.0, y: 6.8, z: -16 },
      { x: -3.1, y: 6.8, z: -16 },
      { x: -3.1, y: 6.8, z: -10 },
      { x: -3.1, y: 6.8, z: -4 },
      { x: 0.0, y: 6.8, z: -4 },
    ],
  },
  // High corner shelf circuit (cornice height in hall)
  {
    id: "shelf_highway_hall",
    kind: "elevated",
    width: 0.42,
    rail: true,
    tension: 0.04,
    points: [
      { x: 3.1, y: 6.8, z: -16 },
      { x: 3.1, y: 6.95, z: -18.5 },
      { x: 3.1, y: 7.15, z: -20.7, label: "Music loft kiss" },
      { x: 1.5, y: 7.16, z: -22.8 },
      { x: 0, y: 7.18, z: -24.0, label: "Cornice Circuit" },
      { x: -1.5, y: 7.16, z: -22.8 },
      { x: -3.1, y: 7.15, z: -20.7, label: "Music loft kiss" },
      { x: -3.1, y: 6.95, z: -18.5 },
      { x: -3.1, y: 6.8, z: -16 },
    ],
  },
  {
    id: "ramp_library_down",
    kind: "ramp",
    width: 0.40,
    points: [
      { x: -3.1, y: 6.8, z: -10 },
      { x: -2.4, y: 6.1, z: -8.2 },
      { x: -1.6, y: 5.4, z: -6.4 },
      { x: -1.7, y: 4.7, z: -4.8 },
      { x: -2.95, y: 4.26, z: -4.02 }, // crest kiss library_skirting_west ≤0.05
    ],
  },

  // 6) Music sideboard
  {
    id: "ramp_music_sideboard",
    kind: "ramp",
    width: 0.40,
    points: [
      { x: 2.2, y: 4.26, z: -21.5, label: "Music Room" },
      { x: 1.4, y: 4.45, z: -21.4 },
      { x: 0.6, y: 4.7, z: -21.2 },
      { x: 0.2, y: 4.95, z: -20.9 },
      { x: 0.0, y: 5.18, z: -20.6, label: "Music Sideboard" },
    ],
  },
  {
    id: "furniture_music_sideboard",
    kind: "elevated",
    width: 0.40,
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
    width: 0.40,
    points: [
      { x: 4.05, y: 5.18, z: -20.65 },
      { x: 5.2, y: 4.85, z: -21.0 },
      { x: 6.0, y: 4.5, z: -21.2 },
      { x: 6.0, y: 4.26, z: -21.4 },
    ],
  },

  // 7) Nursery toy chest
  {
    id: "ramp_nursery_chest",
    kind: "ramp",
    width: 0.40,
    points: [
      { x: 21.2, y: 4.26, z: -5.0, label: "Nursery" },
      { x: 20.2, y: 4.5, z: -4.6 },
      { x: 19.4, y: 4.75, z: -4.2 },
      { x: 18.9, y: 4.9, z: -4.05 },
      { x: 18.8, y: 4.98, z: -4.0, label: "Toy Chest" },
    ],
  },
  {
    id: "furniture_nursery_chest",
    kind: "elevated",
    width: 0.40,
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
    width: 0.4,
    points: [
      { x: 18.2, y: 4.95, z: -4.5 },
      { x: 19.2, y: 4.7, z: -6.5 },
      { x: 20.4, y: 4.45, z: -10.0 },
      { x: 21.2, y: 4.26, z: -12.0 },
    ],
  },

  // Connector: music floor ↔ library (for upper furniture access)

  // ─── Cornice / ledge highways — SHOWCASE upper circuit ───
  // Continuous polished circuit: foyer → hall → rooms → conservatory → back.
  // Fancy banked corners, chicanes, hairpins, elevation; width ~0.32 for tiny car.
  // Foyer cornice — start/finish stripe + banked corners + chicane on south header
  {
    id: "cornice_foyer",
    kind: "cornice",
    width: 0.355,
    rail: true,
    tension: 0.12,
    closed: true,
    fancy: true,
    startFinish: true,
    points: [
      { x: -8.15, y: 3.35, z: 12.15, label: "Start / Finish" },
      { x: -4.2, y: 3.36, z: 12.25 },
      { x: 0.0, y: 3.38, z: 12.3 },
      { x: 4.2, y: 3.36, z: 12.25 },
      { x: 7.4, y: 3.42, z: 12.0 },
      { x: 8.15, y: 3.46, z: 11.4 },
      { x: 8.35, y: 3.42, z: 9.0 },
      { x: 8.3, y: 3.36, z: 6.0 },
      { x: 8.3, y: 3.35, z: 3.0 },
      { x: 8.2, y: 3.4, z: 1.0 },
      { x: 7.0, y: 3.46, z: 0.15 },
      { x: 5.0, y: 3.4, z: -0.35 },
      { x: 3.2, y: 3.38, z: -0.45 },
      { x: 1.2, y: 3.42, z: -0.55, label: "Hall Header Bridge" },
      { x: 0.0, y: 3.48, z: -0.6 },
      { x: -1.2, y: 3.42, z: -0.55 },
      { x: -3.2, y: 3.38, z: -0.45 },
      { x: -5.0, y: 3.4, z: -0.35 },
      { x: -7.0, y: 3.46, z: 0.15 },
      { x: -8.2, y: 3.4, z: 1.0 },
      { x: -8.3, y: 3.35, z: 3.0 },
      { x: -8.3, y: 3.36, z: 6.0 },
      { x: -8.35, y: 3.42, z: 9.0 },
      { x: -8.15, y: 3.46, z: 11.4 },
      { x: -7.4, y: 3.42, z: 12.0 },
      { x: -8.15, y: 3.35, z: 12.15 },
    ],
  },
  // DISABLED — branched mid foyer stair & stole snap from primary climb
  {
    id: "ramp_stair_to_cornice",
    kind: "ramp",
    disabled: true,
    width: 0.42,
    points: [
      // Branches from mid foyer stair climb onto west cornice
      { x: -6.0, y: 2.55, z: 3.95 },
      { x: -6.45, y: 2.68, z: 3.9 },
      { x: -6.9, y: 2.82, z: 3.7 },
      { x: -7.25, y: 2.98, z: 3.25 },
      { x: -7.55, y: 3.12, z: 2.6 },
      { x: -7.8, y: 3.24, z: 2.0 },
      { x: -8.0, y: 3.32, z: 1.5 },
      { x: -8.15, y: 3.38, z: 1.15 },
      { x: -8.2, y: 3.4, z: 1.0, label: "Foyer Cornice" },
    ],
  },
  // Hall east cornice — undulating elevation + link to conservatory
  {
    id: "cornice_hall_east",
    kind: "cornice",
    width: 0.38,
    rail: true,
    tension: 0.12,
    fancy: true,
    points: [
      { x: 3.15, y: 3.4, z: -0.55, label: "Hall Cornice" },
      { x: 3.2, y: 3.36, z: -3.0 },
      { x: 3.25, y: 3.45, z: -5.5 },
      { x: 3.15, y: 3.35, z: -8.0 },
      { x: 3.25, y: 3.48, z: -10.5 },
      { x: 3.2, y: 3.42, z: -12.0 },
      { x: 3.15, y: 3.36, z: -13.0 },
      { x: 3.25, y: 3.44, z: -15.5 },
      { x: 3.15, y: 3.36, z: -18.0 },
      { x: 3.2, y: 3.42, z: -20.2 },
      { x: 3.3, y: 3.48, z: -21.3 },
      { x: 3.4, y: 3.52, z: -22.0 },
      { x: 3.5, y: 3.55, z: -22.5, label: "Conservatory Header" },
    ],
  },
  {
    id: "cornice_hall_west",
    kind: "cornice",
    width: 0.38,
    rail: true,
    tension: 0.12,
    fancy: true,
    points: [
      { x: -3.15, y: 3.4, z: -0.55, label: "Hall Cornice" },
      { x: -3.2, y: 3.36, z: -3.0 },
      { x: -3.25, y: 3.45, z: -5.5 },
      { x: -3.15, y: 3.35, z: -8.0 },
      { x: -3.25, y: 3.48, z: -10.5 },
      { x: -3.2, y: 3.42, z: -12.0 },
      { x: -3.15, y: 3.36, z: -13.0 },
      { x: -3.25, y: 3.44, z: -15.5 },
      { x: -3.15, y: 3.36, z: -18.0 },
      { x: -3.2, y: 3.42, z: -20.2 },
      { x: -3.3, y: 3.48, z: -21.3 },
      { x: -3.4, y: 3.52, z: -22.0 },
      { x: -3.5, y: 3.55, z: -22.5, label: "Conservatory Header" },
    ],
  },
  // Cross-hall bridge near foyer (railed header)
  {
    id: "cornice_hall_cross_south",
    kind: "cornice",
    width: 0.355,
    rail: true,
    tension: 0.1,
    fancy: true,
    visual: false, // foyer cornice draws this header — NO elev snap/support (invisible must not lift)
    points: [
      { x: -3.15, y: 3.4, z: -0.55 },
      { x: -1.5, y: 3.46, z: -0.48 },
      { x: 0.0, y: 3.5, z: -0.45, label: "Hall Header Bridge" },
      { x: 1.5, y: 3.46, z: -0.48 },
      { x: 3.15, y: 3.4, z: -0.55 },
    ],
  },
  // Mid-hall cross bridge (smooth arch)
  {
    id: "cornice_hall_cross_mid",
    kind: "cornice",
    width: 0.34,
    rail: true,
    tension: 0.1,
    fancy: true,
    points: [
      { x: -3.2, y: 3.42, z: -12.0 },
      { x: -1.5, y: 3.52, z: -11.85 },
      { x: 0.0, y: 3.58, z: -11.75, label: "Shortcut bridge" },
      { x: 1.5, y: 3.52, z: -11.85 },
      { x: 3.2, y: 3.42, z: -12.0 },
    ],
  },
  // Cabinet header bridge + room-top circuit with hairpins
  {
    id: "cornice_cabinet_bridge",
    kind: "cornice",
    width: 0.355,
    rail: true,
    tension: 0.1,
    fancy: true,
    points: [
      { x: -3.15, y: 3.35, z: -8.0, label: "Hall Cornice" },
      { x: -4.4, y: 3.42, z: -8.05 },
      { x: -5.8, y: 3.48, z: -8.0, label: "Cabinet Header" },
      { x: -7.2, y: 3.4, z: -8.0 },
      { x: -7.55, y: 3.36, z: -8.0 },
    ],
  },
  {
    id: "cornice_cabinet",
    kind: "cornice",
    width: 0.355,
    rail: true,
    tension: 0.12,
    closed: true,
    fancy: true,
    points: [
      { x: -7.55, y: 3.36, z: -8.0, label: "Cabinet Cornice" },
      { x: -7.55, y: 3.4, z: -4.5 },
      { x: -7.5, y: 3.48, z: -1.6 },
      { x: -8.2, y: 3.5, z: -1.15 },
      { x: -10.5, y: 3.4, z: -0.9 },
      { x: -14.0, y: 3.36, z: -0.95 },
      { x: -18.0, y: 3.4, z: -0.95 },
      { x: -21.5, y: 3.48, z: -1.0 },
      { x: -22.4, y: 3.52, z: -1.9 },
      { x: -22.7, y: 3.42, z: -4.5 },
      { x: -22.65, y: 3.36, z: -8.0 },
      { x: -22.7, y: 3.42, z: -11.5 },
      { x: -22.55, y: 3.5, z: -14.4 },
      { x: -21.2, y: 3.48, z: -15.15 },
      { x: -18.0, y: 3.38, z: -15.1 },
      { x: -14.0, y: 3.36, z: -15.1 },
      { x: -10.5, y: 3.4, z: -15.05 },
      { x: -8.3, y: 3.48, z: -14.9 },
      { x: -7.5, y: 3.45, z: -13.5 },
      { x: -7.55, y: 3.36, z: -11.0 },
      { x: -7.55, y: 3.36, z: -8.0 },
    ],
  },
  // Ramp from display cases up to cabinet cornice
  {
    id: "ramp_cases_to_cornice",
    kind: "ramp",
    width: 0.40,
    points: [
      // Foot on WEST case tops (T) — not SE climb arrival
      { x: -20, y: 1.82, z: -4, label: "Display Case" },
      { x: -20.4, y: 2.15, z: -3.2 },
      { x: -20.7, y: 2.5, z: -2.4 },
      { x: -20.9, y: 2.85, z: -1.7 },
      { x: -21.1, y: 3.15, z: -1.25 },
      { x: -21.35, y: 3.35, z: -1.05 },
      { x: -21.5, y: 3.48, z: -1.0, label: "Cabinet Cornice" },
    ],
  },
  // Armoury header + room circuit (mirror of cabinet)
  {
    id: "cornice_armoury_bridge",
    kind: "cornice",
    width: 0.355,
    rail: true,
    tension: 0.1,
    fancy: true,
    points: [
      { x: 3.15, y: 3.35, z: -8.0, label: "Hall Cornice" },
      { x: 4.4, y: 3.42, z: -8.05 },
      { x: 5.8, y: 3.48, z: -8.0, label: "Armoury Header" },
      { x: 7.2, y: 3.4, z: -8.0 },
      { x: 7.55, y: 3.36, z: -8.0 },
    ],
  },
  {
    id: "cornice_armoury",
    kind: "cornice",
    width: 0.355,
    rail: true,
    tension: 0.12,
    closed: true,
    fancy: true,
    points: [
      { x: 7.55, y: 3.36, z: -8.0, label: "Armoury Cornice" },
      { x: 7.55, y: 3.4, z: -4.5 },
      { x: 7.5, y: 3.48, z: -1.6 },
      { x: 8.2, y: 3.5, z: -1.15 },
      { x: 10.5, y: 3.4, z: -0.9 },
      { x: 14.0, y: 3.36, z: -0.95 },
      { x: 18.0, y: 3.4, z: -0.95 },
      { x: 21.5, y: 3.48, z: -1.0 },
      { x: 22.4, y: 3.52, z: -1.9 },
      { x: 22.7, y: 3.42, z: -4.5 },
      { x: 22.65, y: 3.36, z: -8.0 },
      { x: 22.7, y: 3.42, z: -11.5 },
      { x: 22.55, y: 3.5, z: -14.4 },
      { x: 21.2, y: 3.48, z: -15.15 },
      { x: 18.0, y: 3.38, z: -15.1 },
      { x: 14.0, y: 3.36, z: -15.1 },
      { x: 10.5, y: 3.4, z: -15.05 },
      { x: 8.3, y: 3.48, z: -14.9 },
      { x: 7.5, y: 3.45, z: -13.5 },
      { x: 7.55, y: 3.36, z: -11.0 },
      { x: 7.55, y: 3.36, z: -8.0 },
    ],
  },
  // Conservatory upper perimeter — chicanes on long glass sides
  {
    id: "cornice_conservatory",
    kind: "cornice",
    width: 0.355,
    rail: true,
    tension: 0.12,
    closed: true,
    fancy: true,
    points: [
      { x: 0.0, y: 3.58, z: -22.45, label: "Conservatory Cornice" },
      { x: 3.5, y: 3.55, z: -22.5 },
      { x: 7.0, y: 3.6, z: -22.55 },
      { x: 9.4, y: 3.62, z: -22.7 },
      { x: 9.55, y: 3.68, z: -25.0 },
      { x: 9.35, y: 3.58, z: -27.5 },
      { x: 9.55, y: 3.68, z: -30.0 },
      { x: 9.35, y: 3.58, z: -32.5 },
      { x: 9.5, y: 3.65, z: -35.0 },
      { x: 9.3, y: 3.55, z: -37.3 },
      { x: 7.0, y: 3.6, z: -37.55 },
      { x: 3.5, y: 3.55, z: -37.5 },
      { x: 0.0, y: 3.58, z: -37.5 },
      { x: -3.5, y: 3.55, z: -37.5 },
      { x: -7.0, y: 3.6, z: -37.55 },
      { x: -9.3, y: 3.55, z: -37.3 },
      { x: -9.5, y: 3.65, z: -35.0 },
      { x: -9.35, y: 3.58, z: -32.5 },
      { x: -9.55, y: 3.68, z: -30.0 },
      { x: -9.35, y: 3.58, z: -27.5 },
      { x: -9.55, y: 3.7, z: -25.0 },
      { x: -9.4, y: 3.62, z: -22.7 },
      { x: -7.0, y: 3.6, z: -22.55 },
      { x: -3.5, y: 3.55, z: -22.5 },
      { x: 0.0, y: 3.58, z: -22.45 },
    ],
  },
  // Dining parlor cornice spur off conservatory west
  {
    id: "cornice_dining_bridge",
    kind: "cornice",
    width: 0.34,
    rail: true,
    tension: 0.1,
    fancy: true,
    points: [
      { x: -9.55, y: 3.68, z: -30.0, label: "Conservatory Cornice" },
      { x: -10.5, y: 3.55, z: -30.0 },
      { x: -11.5, y: 3.45, z: -30.0, label: "Dining Header" },
      { x: -12.6, y: 3.4, z: -30.0 },
    ],
  },
  {
    id: "cornice_dining",
    kind: "cornice",
    width: 0.355,
    rail: true,
    tension: 0.12,
    closed: true,
    fancy: true,
    points: [
      { x: -12.6, y: 3.4, z: -30.0, label: "Dining Cornice" },
      { x: -12.55, y: 3.42, z: -26.5 },
      { x: -12.5, y: 3.48, z: -23.8 },
      { x: -14.5, y: 3.45, z: -23.55 },
      { x: -18.0, y: 3.38, z: -23.5 },
      { x: -21.5, y: 3.45, z: -23.6 },
      { x: -22.4, y: 3.5, z: -24.6 },
      { x: -22.7, y: 3.4, z: -27.5 },
      { x: -22.65, y: 3.38, z: -30.5 },
      { x: -22.7, y: 3.45, z: -33.5 },
      { x: -22.5, y: 3.5, z: -35.8 },
      { x: -20.0, y: 3.42, z: -36.2 },
      { x: -16.0, y: 3.38, z: -36.25 },
      { x: -13.2, y: 3.45, z: -36.0 },
      { x: -12.5, y: 3.42, z: -34.0 },
      { x: -12.55, y: 3.4, z: -32.0 },
      { x: -12.6, y: 3.4, z: -30.0 },
    ],
  },
  // Climb from foyer cornice → Upper Landing
  {
    id: "ramp_cornice_to_landing",
    kind: "ramp",
    width: 0.37,
    points: [
      { x: -8.3, y: 3.35, z: 3.0, label: "Foyer Cornice" },
      { x: -8.1, y: 3.55, z: 3.5 },
      { x: -7.85, y: 3.75, z: 4.0 },
      { x: -7.55, y: 3.95, z: 4.4 },
      { x: -7.35, y: 4.12, z: 4.7 },
      { x: -7.2, y: 4.26, z: 5.0, label: "Upper Landing" },
    ],
  },
  // First-floor landing cornice → bookcase highway
  {
    id: "cornice_landing_east",
    kind: "cornice",
    width: 0.355,
    rail: true,
    tension: 0.14,
    fancy: true,
    points: [
      { x: 0.0, y: 7.2, z: 8.5, label: "Landing Cornice" },
      { x: 3.5, y: 7.22, z: 8.55 },
      { x: 6.3, y: 7.25, z: 8.4 },
      { x: 7.25, y: 7.28, z: 6.5 },
      { x: 7.3, y: 7.22, z: 3.5 },
      { x: 7.25, y: 7.2, z: 0.5 },
      { x: 5.5, y: 7.18, z: -1.2 },
      { x: 3.3, y: 7.1, z: -2.2 },
      { x: 3.1, y: 6.8, z: -4.0, label: "Bookcase Highway" },
    ],
  },
  {
    id: "ramp_bookcase_to_landing_cornice",
    kind: "ramp",
    width: 0.37,
    points: [
      { x: 3.1, y: 6.8, z: -4 },
      { x: 4.4, y: 6.95, z: -1.2 },
      { x: 5.8, y: 7.12, z: 2.0 },
      { x: 6.5, y: 7.22, z: 5.5 },
      { x: 6.3, y: 7.25, z: 8.4, label: "Landing Cornice" },
    ],
  },
  // Molding tunnel: short decorative pass-through on foyer east cornice
  {
    id: "tunnel_foyer_molding_east",
    kind: "tunnel",
    width: 0.34,
    tension: 0.15,
    points: [
      { x: 8.3, y: 3.36, z: 6.0, label: "Molding tunnel" },
      { x: 8.75, y: 3.42, z: 5.5 },
      { x: 8.75, y: 3.42, z: 4.0 },
      { x: 8.3, y: 3.35, z: 3.0 },
    ],
  },
  {
    id: "tunnel_foyer_molding_west",
    kind: "tunnel",
    width: 0.34,
    tension: 0.15,
    points: [
      { x: -8.3, y: 3.36, z: 6.0, label: "Molding tunnel" },
      { x: -8.75, y: 3.42, z: 5.5 },
      { x: -8.75, y: 3.42, z: 4.0 },
      { x: -8.3, y: 3.35, z: 3.0 },
    ],
  },
  // Cornice → balcony on-ramp (east landing approach)
  {
    id: "ramp_cornice_to_balcony",
    kind: "ramp",
    width: 0.37,
    points: [
      { x: 7.25, y: 7.28, z: 6.5, label: "Landing Cornice" },
      { x: 7.7, y: 6.95, z: 7.1 },
      { x: 8.1, y: 6.5, z: 8.1 },
      { x: 8.0, y: 6.05, z: 9.2 },
      { x: 7.55, y: 5.6, z: 10.2 },
      { x: 7.1, y: 5.2, z: 11.0 },
      { x: 6.75, y: 4.85, z: 11.5 },
      { x: 6.6, y: 4.55, z: 11.85 },
      { x: 6.5, y: 4.28, z: 12.2, label: "Balcony" },
    ],
  },
  // Wall-run exit on-ramp: mouse mid → foyer cornice
  {
    id: "ramp_mouse_to_foyer_cornice",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "ramp",
    width: 0.34,
    points: [
      { x: -7.4, y: 1.55, z: 8.5, label: "Mouse run" },
      { x: -7.2, y: 1.85, z: 9.6 },
      { x: -7.0, y: 2.2, z: 10.8 },
      { x: -7.15, y: 2.5, z: 11.5 },
      { x: -7.45, y: 2.8, z: 11.9 },
      { x: -7.75, y: 3.05, z: 12.1 },
      { x: -7.95, y: 3.22, z: 12.15 },
      { x: -8.15, y: 3.35, z: 12.15, label: "Foyer Cornice" },
    ],
  },
  {
    id: "ramp_mouse_east_to_foyer_cornice",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "ramp",
    width: 0.34,
    points: [
      { x: 7.4, y: 1.55, z: 8.5, label: "Mouse run" },
      { x: 7.2, y: 1.85, z: 9.6 },
      { x: 7.0, y: 2.2, z: 10.8 },
      { x: 7.15, y: 2.5, z: 11.5 },
      { x: 7.45, y: 2.8, z: 11.9 },
      { x: 7.75, y: 3.05, z: 12.1 },
      { x: 7.95, y: 3.25, z: 12.1 },
      { x: 8.15, y: 3.46, z: 11.4, label: "Foyer Cornice" },
    ],
  },

  // ─── Driveable Balcony (east of Upper Landing / front-east) ───
  // Architectural balcony track — loop with turnaround
  {
    id: "ramp_landing_to_balcony",
    kind: "ramp",
    width: 0.40,
    points: [
      { x: 6.8, y: 4.26, z: 8.8, label: "Upper Landing" },
      { x: 6.6, y: 4.26, z: 10.0 },
      { x: 6.5, y: 4.26, z: 11.2 },
      { x: 6.5, y: 4.28, z: 12.2, label: "Balcony" },
    ],
  },
  
  
  {
    id: "balcony_loop",
    kind: "balcony",
    width: 0.46,
    rail: true,
    tension: 0.05,
    closed: true,
    fancy: true,
    points: [
      { x: 6.5, y: 4.28, z: 12.2, label: "Balcony" },
      { x: 4.0, y: 4.28, z: 13.5 },
      { x: 0.0, y: 4.28, z: 14.5 },
      { x: -4.0, y: 4.28, z: 13.5 },
      { x: -5.5, y: 4.28, z: 12.2 },
      // Fillet softens ~130° west return kink
      { x: -5.7, y: 4.28, z: 13.9 },
      { x: -5.5, y: 4.28, z: 15.8 },
      { x: -2.0, y: 4.28, z: 17.2 },
      { x: 0.0, y: 4.28, z: 17.2 },
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
    width: 0.40,
    points: [
      // Ends at north landing center — clears attic_from_landing_access foot at (-6.8,8.8)
      { x: -5.5, y: 4.28, z: 12.2, label: "Balcony" },
      { x: -4.2, y: 4.26, z: 10.6 },
      { x: -2.8, y: 4.26, z: 9.4 },
      { x: -2.0, y: 4.26, z: 9.0, label: "Upper Landing" },
    ],
  },
  // Optional drop ramp: balcony → front drive gravel
  {
    id: "ramp_balcony_to_drive",
    kind: "ramp",
    width: 0.40,
    points: [
      { x: 0.0, y: 4.28, z: 17.2, label: "Balcony" },
      { x: 0.2, y: 3.8, z: 18.2 },
      { x: 0.8, y: 3.2, z: 19.2 },
      { x: 1.8, y: 2.5, z: 20.0 },
      { x: 3.2, y: 1.7, z: 20.4 },
      { x: 4.4, y: 1.0, z: 19.8 },
      { x: 5.2, y: 0.45, z: 19.0 },
      { x: 5.8, y: 0.18, z: 17.2 },
      { x: 6.2, y: 0.1, z: 15.5 },
      { x: 6.5, y: 0.08, z: 14.2, label: "Front Drive" },
    ],
  },
  // Music room east spur → East Mezzanine → optional second balcony approach (connector only)

  // ═══════════════════════════════════════════════════════════════
  // A. MOUSE-IN-THE-WALLS SHORTCUTS (hollow wall tubes)
  // kind: shortcut — narrow dark corridors inside double walls
  // ═══════════════════════════════════════════════════════════════

  // 1) Foyer ↔ Cabinet (inside west wall) — skirting + mid-height twin
  {
    id: "mouse_foyer_cabinet_skirt",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "shortcut",
    width: 0.24,
    tension: 0.3,
    rail: true,
    boostExit: true,
    points: [
      { x: -8.3, y: 0.06, z: 9.05, label: "Mouse run", portal: true },
      { x: -8.6, y: 0.14, z: 8.0 },
      { x: -8.95, y: 0.22, z: 6.5 },
      { x: -9.2, y: 0.28, z: 5.0 },
      { x: -9.1, y: 0.18, z: 3.2 },
      { x: -9.25, y: 0.3, z: 1.2 },
      { x: -9.15, y: 0.2, z: -1.0 },
      { x: -9.35, y: 0.32, z: -3.5 },
      { x: -9.2, y: 0.18, z: -5.5 },
      { x: -7.8, y: 0.12, z: -7.0, label: "Wall hollow" },
      { x: -5.5, y: 0.06, z: -7.8, portal: true },
    ],
  },
  {
    id: "mouse_foyer_cabinet_mid",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "shortcut",
    width: 0.26,
    tension: 0.28,
    rail: true,
    points: [
      { x: -7.4, y: 1.55, z: 8.5, label: "Mouse run", portal: true },
      { x: -8.5, y: 1.65, z: 6.5 },
      { x: -9.15, y: 1.7, z: 3.0 },
      { x: -9.15, y: 1.7, z: -2.0 },
      { x: -9.5, y: 1.65, z: -6.5 },
      { x: -8.5, y: 1.2, z: -7.2 },
      { x: -6.8, y: 0.55, z: -7.5 },
      { x: -5.5, y: 0.06, z: -7.8, label: "Wall hollow", portal: true },
    ],
  },

  // 2) Foyer ↔ Armoury (inside east wall)
  {
    id: "mouse_foyer_armoury_skirt",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "shortcut",
    width: 0.24,
    tension: 0.3,
    rail: true,
    boostExit: true,
    points: [
      { x: 8.35, y: 0.06, z: 9.0, label: "Mouse run", portal: true },
      { x: 8.6, y: 0.14, z: 8.0 },
      { x: 8.95, y: 0.22, z: 6.5 },
      { x: 9.2, y: 0.28, z: 5.0 },
      { x: 9.1, y: 0.18, z: 3.2 },
      { x: 9.25, y: 0.3, z: 1.2 },
      { x: 9.15, y: 0.2, z: -1.0 },
      { x: 9.35, y: 0.32, z: -3.5 },
      { x: 9.2, y: 0.18, z: -5.5 },
      { x: 7.8, y: 0.12, z: -7.0, label: "Wall hollow" },
      { x: 5.5, y: 0.06, z: -7.8, portal: true },
    ],
  },
  {
    id: "mouse_foyer_armoury_mid",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "shortcut",
    width: 0.26,
    tension: 0.28,
    rail: true,
    points: [
      { x: 7.4, y: 1.55, z: 8.5, label: "Mouse run", portal: true },
      { x: 8.5, y: 1.65, z: 6.5 },
      { x: 9.15, y: 1.7, z: 3.0 },
      { x: 9.15, y: 1.7, z: -2.0 },
      { x: 9.5, y: 1.65, z: -6.5 },
      { x: 8.5, y: 1.2, z: -7.2 },
      { x: 6.8, y: 0.55, z: -7.5 },
      { x: 5.5, y: 0.06, z: -7.8, label: "Wall hollow", portal: true },
    ],
  },

  // 3) Hall ↔ Conservatory (north wall cavity)
  {
    id: "mouse_hall_conservatory",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "shortcut",
    width: 0.24,
    tension: 0.28,
    rail: true,
    boostExit: true,
    points: [
      { x: 2.95, y: 0.06, z: -18.0, label: "Mouse run", portal: true },
      { x: 2.7, y: 0.18, z: -19.2 },
      { x: 2.55, y: 0.32, z: -20.2 },
      { x: 2.5, y: 0.2, z: -21.0 },
      { x: 2.35, y: 0.28, z: -21.8 },
      { x: 2.25, y: 0.12, z: -22.3 },
      { x: 2.2, y: 0.06, z: -22.6, label: "Wall hollow", portal: true },
    ],
  },

  // 4) Dining ↔ Conservatory (shared wall)
  {
    id: "mouse_dining_conservatory",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "shortcut",
    width: 0.24,
    tension: 0.28,
    rail: true,
    boostExit: true,
    points: [
      { x: -11.6, y: 0.06, z: -29.8, label: "Mouse run", portal: true },
      { x: -11.3, y: 0.16, z: -29.5 },
      { x: -11.0, y: 0.28, z: -29.3 },
      { x: -10.7, y: 0.2, z: -29.1 },
      { x: -10.4, y: 0.14, z: -28.0 },
      { x: -10.35, y: 0.06, z: -26.0, label: "Wall hollow", portal: true },
    ],
  },

  // 5) Cellar ↔ Ground (vertical wall chase / pipe shaft)
  {
    id: "mouse_cellar_ground_shaft",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "shortcut",
    width: 0.26,
    tension: 0.32,
    rail: true,
    points: [
      { x: 7.2, y: -4.05, z: 6.5, label: "Pipe shaft", portal: true },
      { x: 7.6, y: -3.2, z: 5.8 },
      { x: 8.1, y: -2.2, z: 5.2 },
      { x: 8.3, y: -1.1, z: 5.0 },
      { x: 8.2, y: -0.2, z: 5.2 },
      { x: 8.35, y: 0.06, z: 5.0, label: "Pipe shaft", portal: true },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // B. BETWEEN-FLOOR SERVICE SHAFTS / DROP CHUTE / CLIMB TUBE
  // ═══════════════════════════════════════════════════════════════

  // Service shaft: Cellar → Ground → First → Attic (west wall zigzag)
  {
    id: "shaft_service_west",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "shaft",
    width: 0.24,
    tension: 0.35,
    rail: true,
    boostExit: true,
    points: [
      { x: -8.4, y: -4.05, z: 7.0, label: "Pipe shaft", portal: true },
      { x: -8.7, y: -2.8, z: 6.2 },
      { x: -8.5, y: -1.4, z: 5.4 },
      { x: -8.35, y: 0.06, z: 5.0, label: "Pipe shaft" },
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
    disabled: true, // core-tour: secondary island / void risk
    kind: "chute",
    width: 0.32,
    tension: 0.4,
    rail: true,
    points: [
      { x: 0.0, y: 3.38, z: 12.3, label: "Drop chute", portal: true },
      { x: 0.0, y: 2.6, z: 10.5 },
      { x: 0.2, y: 1.6, z: 8.8 },
      { x: 0.6, y: 0.7, z: 7.8 },
      { x: 1.4, y: 0.25, z: 7.5 },
      { x: 6.8, y: 0.1, z: 9.2, label: "Safe landing" },
      { x: 8.2, y: 0.06, z: 10.5 },
    ],
  },
  // Balcony → foyer interior chute (alternate dramatic drop)
  {
    id: "chute_balcony_foyer",
    disabled: true, // core-tour: secondary island / void risk
    kind: "chute",
    width: 0.32,
    tension: 0.38,
    rail: true,
    points: [
      { x: -4.0, y: 4.28, z: 13.5, label: "Drop chute", portal: true },
      { x: -2.5, y: 3.4, z: 12.2 },
      { x: -1.2, y: 2.2, z: 11.0 },
      { x: -0.4, y: 1.0, z: 10.0 },
      { x: -2.0, y: 0.35, z: 10.5 },
      { x: -8.35, y: 0.06, z: 10.5, label: "Safe landing" },
    ],
  },

  // Climb tube: cellar → hall / workshop approach (spiral-ish)
  {
    id: "climb_cellar_to_hall",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "shaft",
    width: 0.26,
    tension: 0.34,
    rail: true,
    points: [
      { x: -6.5, y: -4.05, z: 4.0, label: "Climb tube", portal: true },
      { x: -7.2, y: -3.0, z: 2.5 },
      { x: -7.5, y: -1.6, z: 0.5 },
      { x: -7.2, y: -0.4, z: -2.0 },
      { x: -6.0, y: 0.12, z: -5.0, label: "Hall of Echoes" },
      { x: -4.0, y: 0.1, z: -8.0 },
      { x: -2.85, y: 0.08, z: -10.0, portal: true },
    ],
  },
  {
    id: "climb_hall_to_workshop",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "shaft",
    width: 0.26,
    tension: 0.32,
    rail: true,
    points: [
      { x: -2.95, y: 0.06, z: -18.0, label: "Climb tube", portal: true },
      { x: -4.0, y: 0.9, z: -20.0 },
      { x: -6.0, y: 2.0, z: -22.5 },
      { x: -8.0, y: 3.2, z: -25.0 },
      { x: -10.0, y: 4.0, z: -27.0 },
      { x: -11.2, y: 4.26, z: -28.0, label: "Workshop", portal: true },
    ],
  },

  // ─── SPECTACULAR continuous west-wall run: foyer → hall → conservatory ───
  {
    id: "mouse_west_grand_run",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "shortcut",
    width: 0.28,
    tension: 0.32,
    rail: true,
    boostExit: true,
    points: [
      { x: -8.35, y: 0.06, z: 10.5, label: "Mouse run", portal: true },
      { x: -8.9, y: 0.22, z: 8.5 },
      { x: -9.1, y: 0.35, z: 5.5 },
      { x: -9.0, y: 0.18, z: 2.5 },
      { x: -9.15, y: 0.4, z: -0.5 },
      { x: -8.6, y: 0.25, z: -2.5 },
      { x: -4.5, y: 0.3, z: -3.2, label: "Wall hollow" },
      { x: -3.4, y: 0.22, z: -5.0 },
      { x: -3.5, y: 0.38, z: -9.0 },
      { x: -3.45, y: 0.2, z: -13.0 },
      { x: -3.5, y: 0.42, z: -17.0 },
      { x: -3.3, y: 0.25, z: -20.5 },
      { x: -4.0, y: 0.35, z: -22.0 },
      { x: -6.5, y: 0.28, z: -23.5 },
      { x: -9.0, y: 0.2, z: -26.0 },
      { x: -9.5, y: 0.32, z: -30.0 },
      { x: -9.2, y: 0.18, z: -34.0 },
      { x: -9.2, y: 0.1, z: -37.5 },
      { x: -10.2, y: 0.06, z: -38.2, label: "Wall hollow", portal: true },
    ],
  },
  // Mid-height east grand run: foyer cornice cavity → armoury → hall
  {
    id: "mouse_east_grand_run",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "shortcut",
    width: 0.28,
    tension: 0.32,
    rail: true,
    boostExit: true,
    points: [
      { x: 7.4, y: 1.55, z: 8.5, label: "Mouse run", portal: true },
      { x: 8.9, y: 1.75, z: 7.0 },
      { x: 9.15, y: 1.55, z: 3.0 },
      { x: 9.1, y: 1.85, z: -1.0 },
      { x: 8.5, y: 1.6, z: -4.0 },
      { x: 5.0, y: 1.7, z: -5.5, label: "Wall hollow" },
      { x: 3.4, y: 1.55, z: -8.0 },
      { x: 3.5, y: 1.9, z: -12.0 },
      { x: 3.4, y: 1.55, z: -16.5 },
      { x: 3.5, y: 1.8, z: -20.0 },
      { x: 5.5, y: 1.5, z: -22.5 },
      { x: 8.5, y: 1.35, z: -24.0 },
      { x: 9.5, y: 0.9, z: -28.0 },
      { x: 9.2, y: 0.35, z: -32.0 },
      { x: 9.2, y: 0.1, z: -37.5 },
      { x: 10.2, y: 0.06, z: -38.2, label: "Wall hollow", portal: true },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // C. BETWEEN THE FLOWERS (garden shortcuts)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "flower_rose_weave",
    kind: "flower",
    width: 0.4,
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
    width: 0.4,
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
    width: 0.4,
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
    width: 0.4,
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
    width: 0.4,
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
    width: 0.4,
    tension: 0.15,
    visual: false, // outdoor_perimeter already draws garden→drive ribbons
    points: [
      { x: 0.0, y: 0.08, z: -40.0, label: "Conservatory Terrace" },
      { x: 0.0, y: 0.08, z: -44.5, label: "Front Drive", portal: true },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // D. SPECIAL UPPER TRACKS (expand cornice / bookcase / chandelier)
  // ═══════════════════════════════════════════════════════════════

  // Diagonal corner brace bridges (foyer corners)

  // Chandelier ring — decorative loop at foyer chandelier height
  {
    id: "chandelier_ring_foyer",
    disabled: true, // core-tour: secondary island / void risk
    kind: "elevated",
    width: 0.40,
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
    disabled: true, // core-tour: secondary island / void risk
    kind: "ramp",
    width: 0.40,
    points: [
      { x: 0.0, y: 3.48, z: -0.6, label: "Hall Header Bridge" },
      { x: 0.0, y: 3.25, z: 1.2 },
      { x: 0.0, y: 3.0, z: 2.5 },
      { x: 0.0, y: 2.85, z: 3.6, label: "Chandelier ring" },
    ],
  },

  // Bookcase-top express: library → nursery → study
  {
    id: "bookcase_express_lib_nursery",
    kind: "elevated",
    width: 0.40,
    rail: true,
    tension: 0.22,
    points: [
      { x: 3.1, y: 6.8, z: -10, label: "Bookcase Highway" },
      { x: 5.0, y: 6.75, z: -10 },
      { x: 8.0, y: 6.7, z: -9.5 },
      { x: 11.0, y: 6.65, z: -8.5 },
      { x: 14.0, y: 6.6, z: -8.0, label: "Nursery Express" },
      { x: 16.0, y: 6.4, z: -6.5 },
      { x: 17.5, y: 5.7, z: -5.2 },
      { x: 18.3, y: 5.15, z: -4.4 },
      { x: 18.5, y: 4.98, z: -4.2, label: "Toy Chest" },
    ],
  },
  {
    id: "bookcase_express_lib_study",
    kind: "elevated",
    width: 0.40,
    rail: true,
    tension: 0.22,
    points: [
      { x: -3.1, y: 6.8, z: -10, label: "Bookcase Highway" },
      { x: -5.0, y: 6.75, z: -10 },
      { x: -8.0, y: 6.7, z: -9.5 },
      { x: -11.0, y: 6.65, z: -8.5 },
      { x: -14.0, y: 6.6, z: -8.0, label: "Study Express" },
      { x: -16.0, y: 6.35, z: -6.8 },
      { x: -17.2, y: 5.8, z: -5.6 },
      { x: -17.8, y: 5.35, z: -4.8 },
      { x: -18.0, y: 5.18, z: -4.2, label: "Study & Darkroom" },
    ],
  },
  // Nursery ↔ Study cross via library north header (completes express triangle)
  {
    id: "bookcase_express_cross",
    kind: "elevated",
    width: 0.40,
    rail: true,
    points: [
      { x: 14.0, y: 6.6, z: -8.0, label: "Nursery Express" },
      { x: 8.0, y: 6.7, z: -12.0 },
      { x: 0.0, y: 6.85, z: -14.0, label: "Library Express" },
      { x: -8.0, y: 6.7, z: -12.0 },
      { x: -14.0, y: 6.6, z: -8.0, label: "Study Express" },
    ],
  },

  // ─── Elevated circuit connectors (unite cornice / balcony / furniture / landing) ───
  // Gentle climb: Upper Landing floor → high landing cornice (closes orphan start)
  
  
  
  {
    id: "ramp_landing_to_landing_cornice",
    kind: "ramp",
    width: 0.44,
    points: [
      // Foot on landing center; crest T-joins EAST cornice arm (no center triple fork)
      { x: 0.0, y: 4.26, z: 9.0, label: "Upper Landing" },
      { x: 0.35, y: 4.42, z: 9.35 },
      { x: 0.95, y: 4.65, z: 9.55 },
      { x: 1.7, y: 4.92, z: 9.5 },
      { x: 2.35, y: 5.2, z: 9.15 },
      { x: 2.85, y: 5.48, z: 8.65 },
      { x: 3.15, y: 5.78, z: 8.1 },
      { x: 3.25, y: 6.08, z: 7.55 },
      { x: 3.15, y: 6.35, z: 7.15 },
      { x: 2.95, y: 6.6, z: 7.0 },
      { x: 2.95, y: 6.82, z: 7.25 },
      { x: 3.15, y: 7.0, z: 7.7 },
      { x: 3.35, y: 7.12, z: 8.15 },
      { x: 3.5, y: 7.22, z: 8.55, label: "Landing Cornice" },
    ],
  },
  // West landing cornice spur — mirrors east approach, joins bookcase west
  {
    id: "cornice_landing_west",
    kind: "cornice",
    width: 0.355,
    rail: true,
    tension: 0.14,
    fancy: true,
    points: [
      { x: 0.0, y: 7.2, z: 8.5, label: "Landing Cornice" },
      { x: -3.5, y: 7.22, z: 8.55 },
      { x: -6.3, y: 7.25, z: 8.4 },
      { x: -7.25, y: 7.28, z: 6.5 },
      { x: -7.3, y: 7.22, z: 3.5 },
      { x: -7.25, y: 7.2, z: 0.5 },
      { x: -5.5, y: 7.18, z: -1.2 },
      { x: -3.3, y: 7.1, z: -2.2 },
      { x: -3.1, y: 6.8, z: -4.0, label: "Bookcase Highway" },
    ],
  },
  {
    id: "ramp_bookcase_west_to_landing_cornice",
    kind: "ramp",
    width: 0.37,
    points: [
      { x: -3.1, y: 6.8, z: -4 },
      { x: -4.4, y: 6.95, z: -1.2 },
      { x: -5.8, y: 7.12, z: 2.0 },
      { x: -6.5, y: 7.22, z: 5.5 },
      { x: -6.3, y: 7.25, z: 8.4, label: "Landing Cornice" },
    ],
  },
  // Study express turnaround → soft drop onto cabinet case tops (no void dump)
  {
    id: "ramp_study_express_to_cases",
    kind: "ramp",
    width: 0.37,
    points: [
      { x: -18.0, y: 5.18, z: -4.2, label: "Study & Darkroom" },
      { x: -19.0, y: 4.85, z: -3.2 },
      { x: -20.0, y: 4.45, z: -2.4 },
      { x: -20.8, y: 4.0, z: -2.1 },
      { x: -21.3, y: 3.55, z: -2.3 },
      { x: -21.4, y: 3.1, z: -2.8 },
      { x: -21.1, y: 2.65, z: -3.35 },
      { x: -20.6, y: 2.25, z: -3.8 },
      { x: -20.0, y: 1.82, z: -4.0, label: "Display Case" },
    ],
  },
  // Nursery express already meets toy chest; soft return ramp to nursery floor
  {
    id: "ramp_nursery_express_return",
    kind: "ramp",
    width: 0.37,
    points: [
      { x: 18.5, y: 4.98, z: -4.2, label: "Toy Chest" },
      { x: 17.5, y: 4.7, z: -5.2 },
      { x: 16.8, y: 4.45, z: -6.4 },
      { x: 17.8, y: 4.3, z: -7.5 },
      { x: 19.2, y: 4.26, z: -8.0 },
      { x: 21.2, y: 4.26, z: -8.0, label: "Nursery" },
    ],
  },
  // Music sideboard ↔ hall cornice header (unites mid furniture into cornice circuit)
  {
    id: "ramp_music_to_hall_cornice",
    kind: "ramp",
    width: 0.42,
    points: [
      // Foot on WEST sideboard (T) — not the climb-arrival SE (kills music triple fork)
      { x: -4.0, y: 5.18, z: -20.6, label: "Music Sideboard" },
      { x: -2.2, y: 4.95, z: -20.9 },
      { x: -0.2, y: 4.7, z: -21.2 },
      { x: 1.8, y: 4.4, z: -21.45 },
      { x: 3.6, y: 4.1, z: -21.7 },
      { x: 5.0, y: 3.85, z: -21.95 },
      { x: 6.1, y: 3.7, z: -22.25 },
      { x: 7.0, y: 3.6, z: -22.55, label: "Conservatory Cornice" },
    ],
  },
  // Workshop bench → dining cornice (gentle furniture→cornice link)
  {
    id: "ramp_workshop_to_dining_cornice",
    kind: "ramp",
    width: 0.37,
    points: [
      { x: -14.0, y: 5.18, z: -31.5, label: "Workshop Bench" },
      { x: -15.5, y: 4.9, z: -32.0 },
      { x: -16.8, y: 4.5, z: -32.4 },
      { x: -17.5, y: 4.1, z: -31.8 },
      { x: -16.5, y: 3.75, z: -30.8 },
      { x: -14.8, y: 3.5, z: -30.2 },
      { x: -13.5, y: 3.42, z: -30.0 },
      { x: -12.6, y: 3.4, z: -30.0, label: "Dining Cornice" },
    ],
  },
  // Foyer console → east cornice climb (unites low furniture into upper circuit)
  
  
  
  
  
  
  
  {
    id: "ramp_console_to_foyer_cornice",
    kind: "ramp",
    width: 0.44,
    points: [
      // Foot on WEST furniture loop (T-junction) — NOT the SE climb arrival (kills triple fork)
      { x: 5.2, y: 0.98, z: 9.65, label: "Foyer Console" },
      { x: 4.55, y: 1.28, z: 10.35 },
      { x: 4.15, y: 1.58, z: 11.1 },
      { x: 4.35, y: 1.92, z: 11.75 },
      { x: 5.05, y: 2.28, z: 12.15 },
      { x: 5.85, y: 2.62, z: 12.25 },
      { x: 6.7, y: 2.95, z: 12.05 },
      { x: 7.45, y: 3.22, z: 11.7 },
      { x: 8.15, y: 3.46, z: 11.4, label: "Foyer Cornice" },
    ],
  },


  // ═══════════════════════════════════════════════════════════════
  // ATTIC LOFT — cornice-style corner skirting + shaft / stair links
  // Room: attic_loft [22×22] @ (0,8.4,-6); science_attic [16×12] @ (0,8.4,-26)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "attic_loft_skirting",
    kind: "cornice",
    width: 0.355,
    rail: true,
    tension: 0.14,
    closed: true,
    fancy: true,
    startFinish: true,
    points: [
      // Corner philosophy: hug walls ~0.55–0.7 m inset, banked corners
      { x: -10.3, y: 8.46, z: 4.3, label: "Attic loft" },
      { x: -5.0, y: 8.48, z: 4.4 },
      { x: 0.0, y: 8.5, z: 4.45 },
      { x: 5.0, y: 8.48, z: 4.4 },
      { x: 10.3, y: 8.46, z: 4.3 },
      { x: 10.45, y: 8.5, z: 2.0 },
      { x: 10.5, y: 8.46, z: -2.0 },
      { x: 10.5, y: 8.48, z: -6.0 },
      { x: 10.5, y: 8.46, z: -10.0 },
      { x: 10.45, y: 8.5, z: -14.0 },
      { x: 10.3, y: 8.48, z: -16.3 },
      { x: 6.0, y: 8.46, z: -16.45 },
      { x: 0.0, y: 8.5, z: -16.5, label: "Attic loft" },
      { x: -6.0, y: 8.46, z: -16.45 },
      { x: -10.3, y: 8.48, z: -16.3 },
      { x: -10.45, y: 8.5, z: -14.0 },
      { x: -10.5, y: 8.46, z: -10.0 },
      { x: -10.5, y: 8.48, z: -6.0 },
      { x: -10.5, y: 8.46, z: -2.0 },
      { x: -10.45, y: 8.5, z: 2.0 },
      { x: -10.3, y: 8.46, z: 4.3 },
    ],
  },
  // Science attic perimeter (north loft)
  {
    id: "attic_science_skirting",
    kind: "cornice",
    width: 0.34,
    rail: true,
    tension: 0.14,
    closed: true,
    fancy: true,
    points: [
      { x: -7.3, y: 8.46, z: -20.7, label: "Science attic" },
      { x: 0.0, y: 8.48, z: -20.6 },
      { x: 7.3, y: 8.46, z: -20.7 },
      { x: 7.45, y: 8.5, z: -23.0 },
      { x: 7.5, y: 8.46, z: -26.0 },
      { x: 7.45, y: 8.5, z: -29.0 },
      { x: 7.3, y: 8.46, z: -31.3 },
      { x: 0.0, y: 8.48, z: -31.4 },
      { x: -7.3, y: 8.46, z: -31.3 },
      { x: -7.45, y: 8.5, z: -29.0 },
      { x: -7.5, y: 8.46, z: -26.0 },
      { x: -7.45, y: 8.5, z: -23.0 },
      { x: -7.3, y: 8.46, z: -20.7 },
    ],
  },
  // Loft ↔ science connector (door threshold strip)
  {
    id: "attic_loft_to_science",
    kind: "cornice",
    width: 0.34,
    rail: true,
    tension: 0.1,
    fancy: true,
    points: [
      { x: 0.0, y: 8.5, z: -16.5, label: "Attic loft" },
      { x: 0.0, y: 8.48, z: -18.0 },
      { x: 0.0, y: 8.46, z: -19.5 },
      { x: 0.0, y: 8.48, z: -20.6, label: "Science attic" },
    ],
  },
  // shaft_service_west attic portal → loft west skirting
  {
    id: "attic_from_shaft_service",
    kind: "cornice",
    width: 0.34,
    rail: true,
    tension: 0.12,
    fancy: true,
    points: [
      { x: -5.0, y: 8.46, z: -2.0, label: "Attic loft" },
      { x: -6.5, y: 8.48, z: -1.5 },
      { x: -8.5, y: 8.5, z: -1.2 },
      { x: -10.0, y: 8.48, z: -1.5 },
      { x: -10.5, y: 8.46, z: -2.0 },
    ],
  },
  // Landing attic stair access → loft south wall (west corner climb remnant)
  
  
  {
    id: "attic_from_landing_access",
    kind: "ramp",
    width: 0.4,
    points: [
      // Rise pushed into long spiral legs — loft crest ≤~0.55
      { x: -6.8, y: 4.26, z: 8.8, label: "Upper Landing" },
      { x: -5.2, y: 4.5, z: 9.0 },
      { x: -3.6, y: 4.8, z: 8.35 },
      { x: -3.35, y: 5.15, z: 6.9 },
      { x: -4.2, y: 5.5, z: 5.6 },
      { x: -5.7, y: 5.85, z: 5.05 },
      { x: -7.15, y: 6.2, z: 5.3 },
      { x: -8.15, y: 6.5, z: 6.25 },
      { x: -8.45, y: 6.8, z: 7.4 },
      { x: -8.3, y: 7.05, z: 8.25 },
      { x: -8.7, y: 7.3, z: 8.55 },
      { x: -9.45, y: 7.55, z: 7.9 },
      { x: -9.95, y: 7.8, z: 6.7 },
      { x: -10.2, y: 8.0, z: 5.6 },
      { x: -10.3, y: 8.18, z: 4.9 },
      { x: -10.32, y: 8.32, z: 4.55 },
      { x: -10.3, y: 8.46, z: 4.3, label: "Attic loft" },
    ],
  },
  // East loft corner spur (mirrors west shaft philosophy)
  {
    id: "attic_loft_east_spur",
    kind: "cornice",
    width: 0.32,
    rail: true,
    tension: 0.12,
    fancy: true,
    points: [
      { x: 10.5, y: 8.46, z: -6.0, label: "Attic loft" },
      { x: 9.0, y: 8.5, z: -6.0 },
      { x: 6.0, y: 8.48, z: -6.0 },
      { x: 3.0, y: 8.46, z: -6.0 },
      { x: 0.0, y: 8.48, z: -6.0 },
      { x: -3.0, y: 8.46, z: -6.0 },
      { x: -6.0, y: 8.48, z: -6.0 },
      { x: -10.5, y: 8.46, z: -6.0 },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // CELLAR — light skirting so shaft stubs make sense (not deleted)
  // Room: cellar [18×16] @ (0,-4.2,8) → ≈ x±9, z 0..16
  // ═══════════════════════════════════════════════════════════════
  {
    id: "cellar_skirting",
    kind: "floor",
    width: 0.4,
    tension: 0.16,
    closed: true,
    points: [
      { x: -8.3, y: -4.05, z: 15.3, label: "Cellar Workshop" },
      { x: -4.0, y: -4.05, z: 15.4 },
      { x: 0.0, y: -4.05, z: 15.45 },
      { x: 4.0, y: -4.05, z: 15.4 },
      { x: 8.3, y: -4.05, z: 15.3 },
      { x: 8.45, y: -4.05, z: 12.0 },
      { x: 8.5, y: -4.05, z: 8.0 },
      { x: 8.45, y: -4.05, z: 5.0 },
      { x: 8.3, y: -4.05, z: 1.2 },
      { x: 4.0, y: -4.05, z: 0.7 },
      { x: 0.0, y: -4.05, z: 0.6 },
      { x: -4.0, y: -4.05, z: 0.7 },
      { x: -8.3, y: -4.05, z: 1.2 },
      { x: -8.45, y: -4.05, z: 5.0 },
      { x: -8.5, y: -4.05, z: 8.0 },
      { x: -8.45, y: -4.05, z: 12.0 },
      { x: -8.3, y: -4.05, z: 15.3 },
    ],
  },
  // Connectors from skirting → existing shaft / pipe portals
  {
    id: "cellar_to_shaft_service",
    kind: "floor",
    width: 0.36,
    points: [
      { x: -8.45, y: -4.05, z: 5.0, label: "Cellar Workshop" },
      { x: -8.42, y: -4.05, z: 6.0 },
      { x: -8.4, y: -4.05, z: 7.0, label: "Pipe shaft" },
    ],
  },
  {
    id: "cellar_to_pipe_east",
    kind: "floor",
    width: 0.36,
    points: [
      { x: 8.45, y: -4.05, z: 5.0, label: "Cellar Workshop" },
      { x: 8.0, y: -4.05, z: 5.6 },
      { x: 7.2, y: -4.05, z: 6.5, label: "Pipe shaft" },
    ],
  },
  {
    id: "cellar_to_climb_tube",
    kind: "floor",
    width: 0.36,
    points: [
      { x: -8.3, y: -4.05, z: 1.2, label: "Cellar Workshop" },
      { x: -7.4, y: -4.05, z: 2.4 },
      { x: -6.5, y: -4.05, z: 4.0, label: "Climb tube" },
    ],
  },
  // Light cross-aisle so the three stubs form a usable basement loop
  {
    id: "cellar_cross_mid",
    kind: "floor",
    width: 0.34,
    points: [
      { x: -8.4, y: -4.05, z: 7.0 },
      { x: -4.0, y: -4.05, z: 6.8 },
      { x: 0.0, y: -4.05, z: 6.6 },
      { x: 4.0, y: -4.05, z: 6.6 },
      { x: 7.2, y: -4.05, z: 6.5 },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // BETWEEN-THE-WALLS — quality mouse / shaft runs (car through walls)
  // Drive wall collision already exempts shortcut/mouse/shaft/tunnel/chute
  // ═══════════════════════════════════════════════════════════════

  // 1) Armoury (ground) ↔ Nursery (first) — climb inside the shared east wall hollow
  {
    id: "mouse_armoury_nursery_chase",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "mouse",
    width: 0.26,
    tension: 0.3,
    rail: true,
    boostExit: true,
    points: [
      { x: 23.35, y: 0.06, z: -8.0, label: "Mouse run", portal: true },
      { x: 23.55, y: 0.28, z: -7.9 },
      { x: 23.7, y: 0.7, z: -7.5 },
      { x: 23.75, y: 1.25, z: -7.0 },
      { x: 23.7, y: 1.9, z: -6.5 },
      { x: 23.65, y: 2.55, z: -6.0, label: "Wall hollow" },
      { x: 23.55, y: 3.2, z: -5.5 },
      { x: 23.2, y: 3.75, z: -5.1 },
      { x: 22.4, y: 4.15, z: -4.7 },
      { x: 21.5, y: 4.26, z: -4.5 },
      { x: 21.2, y: 4.26, z: -5.0, label: "Nursery", portal: true },
    ],
  },

  // 2) Cabinet (ground) ↔ Study (first) — west wall hollow climb / drop
  {
    id: "mouse_cabinet_study_chase",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "mouse",
    width: 0.26,
    tension: 0.3,
    rail: true,
    boostExit: true,
    points: [
      { x: -23.35, y: 0.06, z: -8.0, label: "Mouse run", portal: true },
      { x: -23.55, y: 0.28, z: -7.9 },
      { x: -23.7, y: 0.7, z: -7.5 },
      { x: -23.75, y: 1.25, z: -7.0 },
      { x: -23.7, y: 1.9, z: -6.5 },
      { x: -23.65, y: 2.55, z: -6.0, label: "Wall hollow" },
      { x: -23.55, y: 3.2, z: -5.5 },
      { x: -23.2, y: 3.75, z: -5.1 },
      { x: -22.4, y: 4.15, z: -4.7 },
      { x: -21.5, y: 4.26, z: -4.5 },
      { x: -21.2, y: 4.26, z: -5.0, label: "Study & Darkroom", portal: true },
    ],
  },

  // 3) Hall ↔ Conservatory mid-height — pierce the north header wall cavity
  {
    id: "mouse_hall_conservatory_mid",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "shortcut",
    width: 0.26,
    tension: 0.28,
    rail: true,
    boostExit: true,
    points: [
      { x: -2.95, y: 1.55, z: -18.0, label: "Mouse run", portal: true },
      { x: -2.7, y: 1.7, z: -19.2 },
      { x: -2.4, y: 1.85, z: -20.4 },
      { x: -1.5, y: 1.9, z: -21.4, label: "Wall hollow" },
      { x: 0.0, y: 1.85, z: -22.0 },
      { x: 1.5, y: 1.75, z: -22.8 },
      { x: 2.4, y: 1.55, z: -24.0 },
      { x: 4.0, y: 1.2, z: -26.0 },
      { x: 6.0, y: 0.55, z: -28.0 },
      { x: 8.0, y: 0.18, z: -30.0 },
      { x: 10.2, y: 0.06, z: -30.0, label: "Conservatory", portal: true },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // LOFT EDGE RINGS + INTERSECTING WALL MICE (asphalt ribbons; corner hug)
  // Shared mats / one ribbon per path — path density OK, mesh bloat not.
  // ═══════════════════════════════════════════════════════════════

  // Attic loft inner cross — E–W spine intersecting perimeter (tourable loft highway)
  {
    id: "attic_loft_cross_ew",
    kind: "cornice",
    width: 0.34,
    rail: true,
    tension: 0.12,
    fancy: true,
    points: [
      { x: -10.5, y: 8.46, z: -6.0, label: "Attic loft" },
      { x: -6.0, y: 8.48, z: -6.0 },
      { x: 0.0, y: 8.5, z: -6.0 },
      { x: 6.0, y: 8.48, z: -6.0 },
      { x: 10.5, y: 8.46, z: -6.0, label: "Attic loft" },
    ],
  },
  // Attic loft inner cross — N–S spine (intersects E–W at center)
  {
    id: "attic_loft_cross_ns",
    kind: "cornice",
    width: 0.34,
    rail: true,
    tension: 0.12,
    fancy: true,
    points: [
      { x: 0.0, y: 8.5, z: 4.45, label: "Attic loft" },
      { x: 0.0, y: 8.48, z: 0.0 },
      { x: 0.0, y: 8.5, z: -6.0 },
      { x: 0.0, y: 8.48, z: -12.0 },
      { x: 0.0, y: 8.5, z: -16.5, label: "Attic loft" },
    ],
  },
  // First-floor library loft edge (east room rim at cornice height — hugs walls)
  {
    id: "loft_library_edge",
    kind: "cornice",
    width: 0.33,
    rail: true,
    tension: 0.13,
    fancy: true,
    closed: true,
    points: [
      // Library [7.2×20] @ (0,-10) — hug walls ~0.5 m inset
      { x: -3.1, y: 7.15, z: -0.9, label: "Library Hall" },
      { x: 0.0, y: 7.18, z: -0.8 },
      { x: 3.1, y: 7.15, z: -0.9 },
      { x: 3.15, y: 7.18, z: -6.0 },
      { x: 3.15, y: 7.15, z: -12.0 },
      { x: 3.1, y: 7.18, z: -19.1 },
      { x: 0.0, y: 7.15, z: -19.2 },
      { x: -3.1, y: 7.18, z: -19.1 },
      { x: -3.15, y: 7.15, z: -12.0 },
      { x: -3.15, y: 7.18, z: -6.0 },
      { x: -3.1, y: 7.15, z: -0.9 },
    ],
  },
  // Nursery loft edge ring
  
  {
    id: "loft_nursery_edge",
    disabled: true, // core-tour: secondary island / void risk
    kind: "cornice",
    width: 0.32,
    rail: true,
    tension: 0.08,
    fancy: true,
    closed: true,
    points: [
      { x: 6.8, y: 7.15, z: -1.7, label: "Nursery & Toy Corner" },
      { x: 14.0, y: 7.18, z: -1.6 },
      { x: 21.0, y: 7.15, z: -1.7 },
      { x: 21.15, y: 7.16, z: -4.8 },
      { x: 21.2, y: 7.18, z: -8.0 },
      { x: 21.15, y: 7.16, z: -11.2 },
      { x: 21.0, y: 7.15, z: -14.2 },
      { x: 14.0, y: 7.18, z: -14.3 },
      { x: 6.8, y: 7.15, z: -14.2 },
      { x: 6.65, y: 7.16, z: -11.2 },
      { x: 6.6, y: 7.18, z: -8.0 },
      { x: 6.65, y: 7.16, z: -4.8 },
      { x: 6.8, y: 7.15, z: -1.7 },
    ],
  },
  // Music loft edge (south first-floor)
  
  {
    id: "loft_music_edge",
    kind: "cornice",
    width: 0.32,
    rail: true,
    tension: 0.08,
    fancy: true,
    closed: true,
    points: [
      // Midpoints on long E/W sides keep Catmull + chord samples on ribbon
      { x: -9.4, y: 7.15, z: -20.7, label: "Music Room" },
      { x: 0.0, y: 7.18, z: -20.6 },
      { x: 9.4, y: 7.15, z: -20.7 },
      { x: 9.45, y: 7.16, z: -24.3 },
      { x: 9.5, y: 7.18, z: -28.0 },
      { x: 9.45, y: 7.16, z: -31.6 },
      { x: 9.4, y: 7.15, z: -35.2 },
      { x: 0.0, y: 7.18, z: -35.3 },
      { x: -9.4, y: 7.15, z: -35.2 },
      { x: -9.45, y: 7.16, z: -31.6 },
      { x: -9.5, y: 7.18, z: -28.0 },
      { x: -9.45, y: 7.16, z: -24.3 },
      { x: -9.4, y: 7.15, z: -20.7 },
    ],
  },
  // Bridge: landing cornice east tip → library loft edge (was floating dead-end at z=1)
  {
    id: "loft_landing_to_library",
    kind: "cornice",
    width: 0.32,
    rail: true,
    tension: 0.1,
    fancy: true,
    points: [
      { x: 3.3, y: 7.1, z: -2.2, label: "Landing Cornice" },
      { x: 3.2, y: 7.12, z: -1.55 },
      { x: 3.1, y: 7.15, z: -0.9, label: "Library Hall" },
    ],
  },
  // West twin: landing cornice west tip → library loft
  {
    id: "loft_landing_to_library_west",
    kind: "cornice",
    width: 0.32,
    rail: true,
    tension: 0.1,
    fancy: true,
    points: [
      { x: -3.3, y: 7.1, z: -2.2, label: "Landing Cornice" },
      { x: -3.2, y: 7.12, z: -1.55 },
      { x: -3.1, y: 7.15, z: -0.9, label: "Library Hall" },
    ],
  },
  // Library loft south header → music loft north (closes 1.4 m void gap)
  {
    id: "loft_library_to_music",
    kind: "cornice",
    width: 0.32,
    rail: true,
    tension: 0.08,
    fancy: true,
    points: [
      { x: 0.0, y: 7.15, z: -19.2, label: "Library Hall" },
      { x: 0.0, y: 7.16, z: -19.9 },
      { x: 0.0, y: 7.18, z: -20.6, label: "Music Room" },
    ],
  },
  // Nursery loft west rail → bookcase express cross (closes ~0.43 m Y island gap)
  {
    id: "ramp_loft_nursery_to_express",
    disabled: true, // core-tour: secondary island / void risk
    kind: "ramp",
    width: 0.36,
    points: [
      { x: 6.65, y: 7.16, z: -11.2, label: "Nursery loft" },
      { x: 7.05, y: 7.02, z: -11.5 },
      { x: 7.5, y: 6.86, z: -11.8 },
      { x: 8.0, y: 6.7, z: -12.0, label: "Nursery Express" },
    ],
  },
  // Study loft-adjacent express → study floor (was 2.2 m void dump)
  {
    id: "ramp_study_express_down",
    kind: "ramp",
    width: 0.37,
    points: [
      { x: -18.0, y: 5.18, z: -4.2, label: "Study & Darkroom" },
      { x: -18.6, y: 5.0, z: -3.4 },
      { x: -19.4, y: 4.75, z: -2.7 },
      { x: -20.2, y: 4.5, z: -2.25 },
      { x: -20.5, y: 4.35, z: -2.15 },
      { x: -20.5, y: 4.26, z: -2.2, label: "Study" },
    ],
  },
  // Music loft → science attic (gentle bowed climb; closes 1.3 m vertical island gap)
  {
    id: "ramp_loft_music_to_attic_science",
    disabled: true, // core-tour: secondary island / void risk
    kind: "ramp",
    width: 0.38,
    points: [
      { x: 0.0, y: 7.18, z: -20.6, label: "Music loft" },
      { x: 1.6, y: 7.35, z: -20.0 },
      { x: 3.0, y: 7.6, z: -19.0 },
      { x: 3.4, y: 7.9, z: -17.8 },
      { x: 2.2, y: 8.15, z: -17.0 },
      { x: 0.6, y: 8.35, z: -16.7 },
      { x: 0.0, y: 8.46, z: -18.0 },
      { x: 0.0, y: 8.48, z: -20.6, label: "Science attic" },
    ],
  },

  // ── Intersecting mouse wall corridors (portals clear of doorways) ──

  // A) Landing ↔ Library — pierce shared south wall at mid height
  {
    id: "mouse_landing_library_mid",
    disabled: true, // core-tour: secondary island / void risk
    kind: "mouse",
    width: 0.26,
    tension: 0.28,
    rail: true,
    boostExit: true,
    points: [
      { x: 0.0, y: 5.55, z: 8.2, label: "Mouse run", portal: true },
      { x: 0.8, y: 5.65, z: 6.0 },
      { x: 1.6, y: 5.75, z: 3.0, label: "Wall hollow" },
      { x: 2.4, y: 5.7, z: 0.5 },
      { x: 2.95, y: 5.55, z: -2.0 },
      { x: 2.95, y: 5.4, z: -6.0 },
      { x: 3.0, y: 5.2, z: -10.0, label: "Library Hall", portal: true },
    ],
  },
  // B) Foyer ↔ Hall — mid-cavity cross (between double walls, above skirting)
  {
    id: "mouse_foyer_hall_mid",
    disabled: true, // core-tour: secondary island / void risk
    kind: "shortcut",
    width: 0.26,
    tension: 0.28,
    rail: true,
    boostExit: true,
    points: [
      { x: 0.0, y: 1.65, z: 4.0, label: "Mouse run", portal: true },
      { x: 0.0, y: 1.75, z: 2.0 },
      { x: 0.0, y: 1.85, z: 0.2, label: "Wall hollow" },
      { x: 0.0, y: 1.8, z: -1.5 },
      { x: 0.0, y: 1.7, z: -4.0 },
      { x: 0.0, y: 1.55, z: -8.0 },
      { x: 0.0, y: 1.4, z: -12.0, label: "Hall of Echoes", portal: true },
    ],
  },
  // C) Dining ↔ Hall west — shared wall sneak (ground, skirting-clear)
  {
    id: "mouse_dining_hall_west",
    disabled: true, // drive-course: decorative / undrivable ribbon (triple-fork or insane grade)
    kind: "mouse",
    width: 0.25,
    tension: 0.3,
    rail: true,
    boostExit: true,
    points: [
      { x: -11.0, y: 0.55, z: -23.6, label: "Mouse run", portal: true },
      { x: -8.5, y: 0.7, z: -22.8 },
      { x: -5.5, y: 0.85, z: -22.2, label: "Wall hollow" },
      { x: -3.4, y: 0.75, z: -21.5 },
      { x: -2.95, y: 0.45, z: -18.0 },
      { x: -2.95, y: 0.18, z: -12.0 },
      { x: -2.9, y: 0.06, z: -6.0, label: "Hall of Echoes", portal: true },
    ],
  },
  // D) Library ↔ Attic loft — between-floors wall chase (gentle grade, portals clear)
  {
    id: "mouse_library_attic_chase",
    disabled: true, // core-tour: secondary island / void risk
    kind: "mouse",
    width: 0.26,
    tension: 0.3,
    rail: true,
    boostExit: true,
    points: [
      { x: -2.95, y: 4.26, z: -10.0, label: "Mouse run", portal: true },
      { x: -3.2, y: 4.6, z: -9.5 },
      { x: -3.6, y: 5.2, z: -8.5 },
      { x: -4.2, y: 5.9, z: -7.5, label: "Wall hollow" },
      { x: -5.0, y: 6.6, z: -7.0 },
      { x: -6.0, y: 7.3, z: -6.5 },
      { x: -7.5, y: 7.9, z: -6.2 },
      { x: -9.0, y: 8.3, z: -6.0 },
      { x: -10.3, y: 8.46, z: -6.0, label: "Attic loft", portal: true },
    ],
  },

];

/**
 * Roadway width scale (~13% smaller) so skirting / cornice ribbons sit
 * naturally on architectural ledges. Applied once at module load —
 * preserves every path id / points / kinds; only width values shrink.
 *
 * Climb ramps get an extra width boost AFTER scale so post-scale halfW
 * lands ~0.29–0.35 (real car has lateral drift; centerline smoke lied).
 */
export const ROAD_WIDTH_SCALE = 0.87;
/** Extra multiplier for kind===ramp only (after ROAD_WIDTH_SCALE). */
export const RAMP_WIDTH_MULT = 1.72;
/** Minimum post-boost ramp width → halfW ≥ ~0.29. */
export const RAMP_WIDTH_MIN = 0.58;
/** Floor/outdoor post-scale min — thick readable asphalt (no wire-thin ribbons). */
export const FLOOR_WIDTH_MIN = 0.78; // playable floor cruise (halfW ≥0.39)
/** Doorway connector min width after scale. */
export const DOOR_WIDTH_MIN = 0.48;
/** Elevated/cornice/balcony/furniture decks min after scale. */
export const DECK_WIDTH_MIN = 0.52; // solid elevated asphalt (not tape ribbons)
/** Soften lumpy / death-trap climb grades (rise/run per segment). */
export const RAMP_MAX_GRADE = 0.44;
/** Mean grade above this after soften → path disabled (no invisible death traps). */
export const RAMP_DISABLE_MEAN_GRADE = 0.48;

export const ROAD_WIDTH_DESIGN = Object.fromEntries(
  TRACK_PATHS.map((path) => [path.id, path.width])
);
for (const path of TRACK_PATHS) {
  if (typeof path.width === "number") {
    path.width = Math.round(path.width * ROAD_WIDTH_SCALE * 1000) / 1000;
  }
}
for (const path of TRACK_PATHS) {
  if (path.kind !== "ramp" || typeof path.width !== "number") continue;
  path.width = Math.round(path.width * RAMP_WIDTH_MULT * 1000) / 1000;
  if (path.width < RAMP_WIDTH_MIN) path.width = RAMP_WIDTH_MIN;
}
// Enforce thick visible asphalt on every snap-active ribbon (visual:false paths
// get no snap elsewhere — driveable ⇒ drawable and thick).
for (const path of TRACK_PATHS) {
  if (path.disabled || path.visual === false || typeof path.width !== "number") continue;
  const id = path.id || "";
  if (path.kind === "floor" || path.kind === "outdoor" || path.kind === "flower") {
    if (id.startsWith("door_") && path.width < DOOR_WIDTH_MIN) path.width = DOOR_WIDTH_MIN;
    else if (path.width < FLOOR_WIDTH_MIN) path.width = FLOOR_WIDTH_MIN;
  } else if (path.kind === "elevated" || path.kind === "cornice" || path.kind === "balcony") {
    if (path.width < DECK_WIDTH_MIN) path.width = DECK_WIDTH_MIN;
  }
}

/**
 * Soften ramp grades: even Y along flat arc, mild sin-bow lengthen if mean
 * still too steep, else disable. Keeps foot/crest XYZ (junction kisses).
 */
function _softenRampGrades(path) {
  if (path.kind !== "ramp" || path.disabled || !path.points || path.points.length < 3) return;
  const pts = path.points;
  const foot = pts[0];
  const crest = pts[pts.length - 1];
  const y0 = foot.y;
  const y1 = crest.y;
  const rise = Math.abs(y1 - y0);

  const recomputeCum = () => {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
    }
    return cum;
  };

  let cum = recomputeCum();
  let totalFlat = cum[cum.length - 1];
  if (totalFlat < 1e-4 || rise < 1e-4) return;

  // Mild lateral bow to gain flat length when mean grade is too steep
  if (rise / totalFlat > RAMP_MAX_GRADE) {
    const needFlat = rise / RAMP_MAX_GRADE;
    const chord = Math.hypot(crest.x - foot.x, crest.z - foot.z) || 1;
    const nx = -(crest.z - foot.z) / chord;
    const nz = (crest.x - foot.x) / chord;
    // Grow bow amplitude until flat length hits need (cap so we do not leave the room)
    let amp = 0.15;
    for (let iter = 0; iter < 8; iter++) {
      for (let i = 1; i < pts.length - 1; i++) {
        const t = cum[i] / totalFlat;
        const bow = Math.sin(Math.PI * t) * amp * (0.35 + 0.08 * iter);
        // apply relative to original chord sample — use current x/z + incremental
        pts[i].x += nx * bow * 0.22;
        pts[i].z += nz * bow * 0.22;
      }
      cum = recomputeCum();
      totalFlat = cum[cum.length - 1];
      if (rise / totalFlat <= RAMP_MAX_GRADE) break;
      amp += 0.12;
    }
  }

  cum = recomputeCum();
  totalFlat = cum[cum.length - 1];
  const mean = rise / Math.max(1e-4, totalFlat);

  // Death trap — cannot soften without a redesign
  if (mean > RAMP_DISABLE_MEAN_GRADE) {
    path.disabled = true;
    path._disabledReason = `mean grade ${mean.toFixed(2)} > ${RAMP_DISABLE_MEAN_GRADE}`;
    return;
  }

  // Even Y along flat arc — kills lumpy max-segment spikes, keeps ends
  for (let i = 1; i < pts.length - 1; i++) {
    const t = cum[i] / totalFlat;
    pts[i].y = Math.round((y0 + (y1 - y0) * t) * 1000) / 1000;
  }
}

for (const path of TRACK_PATHS) {
  _softenRampGrades(path);
}

/** Spawn / Explore park pose — west foyer skirting by front door (NOT mid-room). */
export const CAR_SPAWN = { x: -7.9, y: 0.02, z: 12.2, yaw: 0 };


/**
 * Precise ramp foot engagement zones for every enabled climb.
 * `approach` = skirting/deck path the car arrives on; `foot` = points[0];
 * engage within engageBack meters behind the foot along approach heading.
 * Climb samples at 25/50/75% along the ramp must stay onTrack+supported.
 * Junction kiss to destination decks is verified ≤0.05 m in smoke.
 */
export const RAMP_MOUNT_FEET = (() => {
  const PRIMARY_APPROACH = {
    ramp_foyer_to_landing: "foyer_skirting",
    ramp_foyer_console: "foyer_skirting",
    ramp_foyer_console_down: "furniture_foyer_console",
    ramp_dining_table: "door_cons_dining",
    ramp_dining_down: "furniture_dining_table",
    ramp_cabinet_case: "cabinet_skirting",
    ramp_cabinet_down: "furniture_cabinet_cases",
    ramp_workshop_bench: "workshop_skirting",
    ramp_workshop_down: "furniture_workshop_bench",
    ramp_library_bookcase: "library_skirting_east",
    ramp_library_down: "furniture_library_tops",
    ramp_music_sideboard: "music_skirting",
    ramp_music_down: "furniture_music_sideboard",
    ramp_nursery_chest: "nursery_skirting",
    ramp_nursery_down: "furniture_nursery_chest",
    ramp_landing_to_landing_cornice: "landing_skirting",
    ramp_console_to_foyer_cornice: "furniture_foyer_console",
    ramp_landing_to_balcony: "landing_skirting",
    ramp_balcony_to_drive: "balcony_loop",
    ramp_balcony_return: "balcony_loop",
    ramp_cornice_to_balcony: "cornice_landing_east",
    ramp_music_to_hall_cornice: "furniture_music_sideboard",
    ramp_cases_to_cornice: "furniture_cabinet_cases",
    ramp_study_express_to_cases: "bookcase_express_lib_study",
    ramp_workshop_to_dining_cornice: "workshop_skirting",
    attic_from_landing_access: "landing_skirting",
    ramp_cornice_to_landing: "cornice_landing_east",
    ramp_bookcase_to_landing_cornice: "furniture_library_tops",
    ramp_bookcase_west_to_landing_cornice: "furniture_library_tops",
    ramp_nursery_express_return: "bookcase_express_lib_nursery",
    ramp_cornice_to_chandelier: "cornice_foyer",
    ramp_mouse_to_foyer_cornice: "mouse_foyer_cabinet_skirt",
    ramp_mouse_east_to_foyer_cornice: "mouse_foyer_armoury_skirt",
    ramp_loft_nursery_to_express: "loft_nursery_edge",
    ramp_study_express_down: "bookcase_express_lib_study",
    ramp_loft_music_to_attic_science: "loft_music_edge",
  };
  const out = {};
  for (const path of TRACK_PATHS) {
    if (path.kind !== "ramp" || path.disabled) continue;
    const foot = path.points[0];
    const crest = path.points[path.points.length - 1];
    out[path.id] = {
      approach: PRIMARY_APPROACH[path.id] || null,
      foot: { x: foot.x, y: foot.y, z: foot.z },
      crest: { x: crest.x, y: crest.y, z: crest.z },
      /** Meters behind foot along approach where ramp snap must win */
      engageBack: 0.08,
      /** Soft crest blend band (m) — avoid snap theft at deck kiss */
      crestSoft: 0.12,
      climbFracs: [0.25, 0.5, 0.75],
    };
  }
  return out;
})();

/** Labels that are shortcut/shaft toasts (no "Entering" prefix). */
export const SHORTCUT_TOAST_RE = /mouse run|wall hollow|pipe shaft|service shaft|drop chute|climb tube|safe landing|petal path|hedge tunnel|fountain arc|shortcut bridge|chandelier ring|nursery express|study express|library express|start \/ finish|molding tunnel|dining header|dining cornice|attic loft|science attic|cellar workshop/i;
