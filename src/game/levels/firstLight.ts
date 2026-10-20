// "First light": one mirror, one target. Learn to move and turn a piece.
import type { Mirror } from "../optics.ts";
import { NOTE } from "./notes.ts";
import { WHITE, mirrorAngle, type Level } from "./helpers.ts";

const lamp = { x: 120, y: 560, a: 0 };
const mirror: Mirror = { kind: "mirror", id: "mirror", x: 560, y: 250, a: 0.5, len: 96, move: "free" };
const target = { id: "light", x: 1000, y: 190, r: 22, colors: WHITE };
const at = { x: 720, y: lamp.y };

export const firstLight: Level = {
  id: "first-light",
  title: "First light",
  lesson: "Put the mirror in the beam and turn it toward the target.",
  scene: { lamp, pieces: [mirror], targets: [target] },
  solution: { mirror: { ...at, a: mirrorAngle([1, 0], [target.x - at.x, target.y - at.y]) } },
  notes: [NOTE.A3],
};
