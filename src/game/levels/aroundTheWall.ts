// "Around the wall": two mirrors carry the light over an obstacle.
import type { Mirror, Wall } from "../optics.ts";
import { NOTE } from "./notes.ts";
import { WHITE, mirrorAngle, type Level } from "./helpers.ts";

const lamp = { x: 110, y: 600, a: 0 };
const wall: Wall = { kind: "wall", id: "wall", x0: 760, y0: 380, x1: 760, y1: 700 };
const target = { id: "light", x: 1090, y: 560, r: 24, colors: WHITE };
const a: Mirror = { kind: "mirror", id: "a", x: 300, y: 300, a: 0.2, len: 96, move: "free" };
const b: Mirror = { kind: "mirror", id: "b", x: 1000, y: 160, a: 0, len: 96, move: "free" };
const A = { x: 430, y: lamp.y };
const B = { x: 820, y: 270 }; // found by searching for the most forgiving layout

export const aroundTheWall: Level = {
  id: "around-the-wall",
  title: "Around the wall",
  lesson: "Two mirrors can carry light over what stands in its way.",
  scene: { lamp, pieces: [wall, a, b], targets: [target] },
  solution: {
    a: { ...A, a: mirrorAngle([1, 0], [B.x - A.x, B.y - A.y]) },
    b: { ...B, a: mirrorAngle([B.x - A.x, B.y - A.y], [target.x - B.x, target.y - B.y]) },
  },
  notes: [NOTE.D4],
};
