import { fromAscii } from "@/engine/build";
import type { VaultDef } from "@/engine/types";

export interface Heist {
  id: string;
  n: number;
  title: string;
  /** one-line lesson shown before the first move */
  tip: string;
  def: VaultDef;
}

/**
 * The tutorial campaign. Each heist introduces one idea, then the last few
 * combine them. Every one is checked by the Machine in tests (solvable, and
 * the shortest route is long enough to be interesting).
 */
export const HEISTS: Heist[] = [
  {
    id: "back-door",
    n: 1,
    title: "The Back Door",
    tip: "Grab the gold diamond and walk back out through the entrance. Arrow keys or WASD to move.",
    def: fromAscii([
      "###########",
      "#E..#.....#",
      "#.#.#.###.#",
      "#.#...#$..#",
      "#.#####.###",
      "#.......#  ",
      "#########  ",
    ]),
  },
  {
    id: "night-shift",
    n: 2,
    title: "Night Shift",
    tip: "Red tiles are what a guard can see right now. Stay out of them. Space waits a turn.",
    def: fromAscii(
      [
        "#############",
        "#E..........#",
        "#.#########.#",
        "#.#       #.#",
        "#.#########.#",
        "#.....$.....#",
        "#############",
      ],
      { guards: [{ id: "g1", waypoints: [{ x: 11, y: 5 }, { x: 1, y: 5 }, { x: 1, y: 3 }, { x: 1, y: 5 }], range: 3 }] },
    ),
  },
  {
    id: "lights-out",
    n: 3,
    title: "Lights Out",
    tip: "Walk into a guard from behind or the side to knock them out. From the front, they'll see you first.",
    def: fromAscii(
      [
        "###########",
        "#E........#",
        "#########.#",
        "#$........#",
        "###########",
      ],
      { guards: [{ id: "g1", waypoints: [{ x: 3, y: 3, wait: 6, look: ["W", "W", "W", "W", "W", "E"] }], range: 4 }] },
    ),
  },
  {
    id: "witness",
    n: 4,
    title: "The Witness",
    tip: "Knocked-out guards leave a body. If anyone sees it, the alarm goes off. Watch where you leave them.",
    def: fromAscii(
      [
        "#############",
        "#E..........#",
        "#.#########.#",
        "#.....$.....#",
        "#############",
      ],
      {
        guards: [
          { id: "g1", waypoints: [{ x: 3, y: 3, wait: 1, look: ["E"] }], range: 4 },
          { id: "g2", waypoints: [{ x: 11, y: 1 }, { x: 11, y: 3 }, { x: 5, y: 3 }], mode: "pingpong", range: 3 },
        ],
      },
    ),
  },
  {
    id: "eye-in-the-sky",
    n: 5,
    title: "Eye in the Sky",
    tip: "Cameras sit on walls and turn on a fixed schedule. Hover one to see where it looks next.",
    def: fromAscii(
      [
        "#############",
        "#E..........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#..........$#",
        "#############",
      ],
      {
        cameras: [
          { id: "c1", x: 4, y: 0, dirs: ["S", "N", "N"], range: 4 },
          { id: "c2", x: 12, y: 2, dirs: ["W", "W", "E", "E"], range: 5 },
          { id: "c3", x: 7, y: 6, dirs: ["N", "S", "S"], range: 4 },
        ],
      },
    ),
  },
  {
    id: "tripwire",
    n: 6,
    title: "Tripwire",
    tip: "Lasers blink on a rhythm. Hover one to see its pattern, and step through while it's dark.",
    def: fromAscii(
      [
        "###############",
        "#E.#.........$#",
        "#..#.........##",
        "#..............",
        "###############",
      ],
      {
        lasers: [
          { id: "l1", a: { x: 5, y: 1 }, b: { x: 5, y: 3 }, pattern: "110" },
          { id: "l2", a: { x: 8, y: 1 }, b: { x: 8, y: 3 }, pattern: "1100" },
          { id: "l3", a: { x: 11, y: 1 }, b: { x: 11, y: 3 }, pattern: "11110" },
        ],
      },
    ),
  },
  {
    id: "keycard",
    n: 7,
    title: "Access Denied",
    tip: "Colored doors need the matching keycard. Doors also block every line of sight.",
    def: fromAscii(
      [
        "#############",
        "#E....#..b..#",
        "#.###.#.###.#",
        "#.#r....#...#",
        "#.#####R#.#B#",
        "#.......#.#$#",
        "#############",
      ],
      {
        guards: [
          { id: "g1", waypoints: [{ x: 7, y: 1 }, { x: 11, y: 1 }, { x: 11, y: 3 }, { x: 9, y: 3 }], mode: "pingpong", range: 2 },
          { id: "g2", waypoints: [{ x: 1, y: 5 }, { x: 7, y: 5 }], mode: "pingpong", range: 3 },
        ],
      },
    ),
  },
  {
    id: "blackout",
    n: 8,
    title: "Blackout",
    tip: "Press E to fire an EMP: cameras and lasers go dark for three turns. Guards don't care.",
    def: fromAscii(
      [
        "##############",
        "#E...........#",
        "#............#",
        "#######.######",
        "      #.#     ",
        "      #$#     ",
        "      ###     ",
      ],
      {
        cameras: [
          { id: "c1", x: 6, y: 3, dirs: ["N", "E"], range: 2 },
          { id: "c2", x: 8, y: 3, dirs: ["W", "N"], range: 2 },
        ],
        lasers: [{ id: "l1", a: { x: 7, y: 3 }, b: { x: 7, y: 4 }, pattern: "1" }],
        emp: 2,
      },
    ),
  },
  {
    id: "heavy",
    n: 9,
    title: "Heavy Security",
    tip: "Guards with a hexagon ring are armored. You can't knock them out: slip past them.",
    def: fromAscii(
      [
        "###############",
        "#E....#.......#",
        "#.##..#..##...#",
        "#.......#.....#",
        "#.##....#..##.#",
        "#.....#......$#",
        "###############",
      ],
      {
        guards: [
          { id: "g1", waypoints: [{ x: 4, y: 1 }, { x: 5, y: 5 }, { x: 1, y: 5 }, { x: 1, y: 3 }], range: 2, armored: true },
          { id: "g2", waypoints: [{ x: 7, y: 1 }, { x: 13, y: 1 }, { x: 13, y: 4 }, { x: 7, y: 5 }], range: 2, armored: true },
        ],
      },
    ),
  },
  {
    id: "rush-hour",
    n: 10,
    title: "Rush Hour",
    tip: "Two diamonds and a clock. The police arrive when the turn counter runs out.",
    def: fromAscii(
      [
        "###############",
        "#$....#.......#",
        "#.###.#.#####.#",
        "#.....E.....#$#",
        "#.###.#.###.#.#",
        "#.....#.......#",
        "###############",
      ],
      {
        guards: [
          { id: "g1", waypoints: [{ x: 1, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 1 }, { x: 1, y: 1 }], range: 3 },
          { id: "g2", waypoints: [{ x: 7, y: 1 }, { x: 13, y: 1 }, { x: 13, y: 5 }, { x: 7, y: 5 }], range: 3 },
        ],
        maxTurns: 44,
      },
    ),
  },
  {
    id: "gauntlet",
    n: 11,
    title: "The Gauntlet",
    tip: "Everything you've learned, in one hallway. Plan before you move: press F to see next turn.",
    def: fromAscii(
      [
        "#################",
        "#E..#.....#.....#",
        "#...#.###.#.###.#",
        "#.......#...#$#.#",
        "#####.#.#####.#.#",
        "#.....#.......r.#",
        "#.#####R#########",
        "#.......$.......#",
        "#################",
      ],
      {
        guards: [
          { id: "g1", waypoints: [{ x: 5, y: 1 }, { x: 9, y: 1 }], mode: "pingpong", range: 3 },
          { id: "g2", waypoints: [{ x: 7, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 1 }, { x: 11, y: 1 }], mode: "pingpong", range: 2 },
          { id: "g3", waypoints: [{ x: 1, y: 7 }, { x: 15, y: 7 }], mode: "pingpong", range: 4, armored: true },
        ],
        cameras: [{ id: "c1", x: 4, y: 2, dirs: ["E", "S", "W", "S"], range: 3 }],
        lasers: [{ id: "l1", a: { x: 5, y: 4 }, b: { x: 5, y: 5 }, pattern: "1110" }],
        emp: 1,
        maxTurns: 160,
      },
    ),
  },
  {
    id: "first-national",
    n: 12,
    title: "First National",
    tip: "The big one. Take your time: nothing moves until you do.",
    def: fromAscii(
      [
        "#################",
        "#E....#.....#...#",
        "#.###.#.###.#.#.#",
        "#.#.....#.....#.#",
        "#.#.###.#.###.#.#",
        "#...#b#...#.....#",
        "###.#.#####.###R#",
        "#.....r...#...#.#",
        "#.#####.#.#.#.#.#",
        "#.......#...#..$#",
        "#################",
      ],
      {
        guards: [
          { id: "g1", waypoints: [{ x: 1, y: 3 }, { x: 1, y: 5 }, { x: 3, y: 5 }, { x: 3, y: 3 }, { x: 7, y: 3 }, { x: 7, y: 1 }], mode: "pingpong", range: 3 },
          { id: "g2", waypoints: [{ x: 9, y: 5 }, { x: 9, y: 3 }, { x: 13, y: 3 }, { x: 13, y: 5 }], range: 3, armored: true },
          { id: "g3", waypoints: [{ x: 1, y: 9 }, { x: 7, y: 9 }, { x: 7, y: 7 }, { x: 1, y: 7 }], range: 3 },
          { id: "g4", waypoints: [{ x: 11, y: 9 }, { x: 11, y: 7 }, { x: 13, y: 7 }, { x: 13, y: 9 }], range: 2, armored: true },
        ],
        cameras: [{ id: "c1", x: 16, y: 6, dirs: ["S", "W", "W", "S"], range: 3 }],
        lasers: [{ id: "l1", a: { x: 15, y: 7 }, b: { x: 15, y: 8 }, pattern: "1100" }],
        emp: 1,
        maxTurns: 200,
      },
    ),
  },
];

export function getHeist(id: string): Heist | undefined {
  return HEISTS.find((h) => h.id === id);
}
