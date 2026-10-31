/**
 * logic15 GHOST BOOKS — exactly 12 floating collectibles. (x, y, z) is the book's centre; a book
 * is collected when the car body passes within TOUCH_R horizontally and TOUCH_DY vertically.
 * "jump" books float at the apex of a kicker flight: out of reach for a car on the floor.
 */
export const BOOK_TOUCH_R = 0.17;
export const BOOK_TOUCH_DY = 0.11;
export const BOOK_CAR_DY = 0.044; // logic16: smaller car // the car's body centre above its wheels' contact point
const B = (id, x, y, z, where, jump = false) => ({ id, x, y, z, where, jump });
export const GHOST_BOOKS = [
  B("attic_leap", -4.02, 8.87, -13.0, "Attic — high above Attic Kicker 1 (jump only)", true),
  B("attic_boards", 2.0, 8.47, -22.5, "Attic — on the open boards, south end"),
  B("lawn_leap", 14.5, 0.21, 24.34, "Front lawn — over Jump Strip 2 (jump only)", true),
  B("armoury_leap", 16.34, 0.26, -9.0, "Armoury — over the Armoury Kicker (jump only)", true),
  B("foyer_bridge", 6.45, 3.204, 2.253, "Grand Foyer — on the new Foyer Bridge"),
  B("mouse_run", -6.95, 2.102, 13.57, "Mouse world — halfway along the Mouse Run"),
  B("armoury_ring", 23.25, 3.282, -11.25, "Armoury Ring — east side"),
  B("roof_ring", 2.588, 13.432, -10.81, "Roof — on the Roof Ring"),
  B("conveyor_top", 0.0, 12.842, 0.2, "Roof — Conveyor Exit road over the attic"),
  B("gallery", -1.6, 0.07, -6.0, "Gallery — on the long runner"),
  B("front_lawn", 14.5, 0.07, 15.0, "Front lawn — by the drive"),
  B("rose_walk", -28.0, 0.075, 8.0, "Rose Walk — west garden path"),
];
export const BOOKS_FOR_TURBO = 6;
export const BOOKS_FOR_SUPER = 12;
