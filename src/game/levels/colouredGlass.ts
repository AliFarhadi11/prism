// "Coloured glass": white light on a red target does not count. Choose the glass that lets red through.
import type { Filter, Mirror } from "../optics.ts";
import { NOTE } from "./notes.ts";
import { mirrorAngle, type Level } from "./helpers.ts";

const lamp = { x: 110, y: 200, a: 0 };
const target = { id: "red", x: 1040, y: 560, r: 22, colors: ["red" as const] };
const mirror: Mirror = { kind: "mirror", id: "mirror", x: 600, y: 520, a: 0.3, len: 96, move: "free" };
const red: Filter = { kind: "filter", id: "red-glass", x: 300, y: 600, a: Math.PI / 2, len: 70, colors: ["red"], move: "free" };
const blue: Filter = { kind: "filter", id: "blue-glass", x: 420, y: 600, a: Math.PI / 2, len: 70, colors: ["blue"], move: "free" };
const M = { x: 760, y: lamp.y };

export const colouredGlass: Level = {
  id: "coloured-glass",
  title: "Coloured glass",
  lesson: "A red target wants red light, and nothing else. Coloured glass keeps only its own colour.",
  scene: { lamp, pieces: [mirror, red, blue], targets: [target] },
  solution: {
    mirror: { ...M, a: mirrorAngle([1, 0], [target.x - M.x, target.y - M.y]) },
    "red-glass": { x: 450, y: lamp.y, a: Math.PI / 2 },
  },
  notes: [NOTE.E4],
};
