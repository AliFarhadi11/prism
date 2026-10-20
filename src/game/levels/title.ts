// The title screen's room: a lamp and a slowly turning prism sweeping a rainbow across the dark.
// Not a puzzle (no targets); PrismGame turns the prism.
import type { Level } from "./helpers.ts";

export const TITLE_PRISM = { x: 700, y: 380, a: -Math.PI / 2 + 0.2 };

export const title: Level = {
  id: "title",
  title: "Prism",
  lesson: "",
  scene: {
    lamp: { x: 260, y: 470, a: -0.22 },
    pieces: [{ kind: "prism", id: "prism", ...TITLE_PRISM, r: 120, move: "turn" }],
    targets: [],
  },
  solution: {},
  notes: [],
};
