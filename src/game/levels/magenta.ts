// "Magenta": split the beam, colour each half, and bring red and blue together. Light adds.
import type { Filter, Mirror, Splitter } from "../optics.ts";
import { NOTE } from "./notes.ts";
import { mirrorAngle, type Level } from "./helpers.ts";

const lamp = { x: 110, y: 420, a: 0 };
const target = { id: "magenta", x: 1060, y: 180, r: 22, colors: ["red" as const, "blue" as const] };
const half: Splitter = { kind: "splitter", id: "half", x: 380, y: 420, a: mirrorAngle([1, 0], [0, -1]), len: 80, move: "fixed" };
const high: Mirror = { kind: "mirror", id: "high", x: 620, y: 620, a: 0.2, len: 96, move: "free" };
const low: Mirror = { kind: "mirror", id: "low", x: 760, y: 620, a: -0.2, len: 96, move: "free" };
const red: Filter = { kind: "filter", id: "red-glass", x: 900, y: 620, a: Math.PI / 2, len: 70, colors: ["red"], move: "free" };
const blue: Filter = { kind: "filter", id: "blue-glass", x: 1010, y: 620, a: Math.PI / 2, len: 70, colors: ["blue"], move: "free" };

export const magenta: Level = {
  id: "magenta",
  title: "Magenta",
  lesson: "Red and blue light, meeting, make magenta. Green must not come.",
  scene: { lamp, pieces: [half, high, low, red, blue], targets: [target] },
  solution: {
    // The turned half goes up, then right through red glass.
    high: { x: 380, y: 180, a: mirrorAngle([0, -1], [1, 0]) },
    "red-glass": { x: 720, y: 180, a: Math.PI / 2 },
    // The half that passes goes right, then up through blue glass.
    low: { x: 1060, y: 420, a: mirrorAngle([1, 0], [0, -1]) },
    "blue-glass": { x: 1060, y: 300, a: 0 },
  },
  notes: [NOTE.B3],
};
