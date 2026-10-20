// "Two ways": a half-silvered mirror sends half the light on and turns the other half.
import type { Mirror, Splitter } from "../optics.ts";
import { NOTE } from "./notes.ts";
import { WHITE, mirrorAngle, type Level } from "./helpers.ts";

const lamp = { x: 110, y: 360, a: 0 };
const up = { id: "up", x: 640, y: 110, r: 22, colors: WHITE };
const down = { id: "down", x: 1110, y: 620, r: 22, colors: WHITE };
const half: Splitter = { kind: "splitter", id: "half", x: 300, y: 600, a: 0.2, len: 80, move: "free" };
const mirror: Mirror = { kind: "mirror", id: "mirror", x: 900, y: 150, a: 0.4, len: 96, move: "free" };

export const twoWays: Level = {
  id: "two-ways",
  title: "Two ways",
  lesson: "A half mirror lets half the light through and turns the other half.",
  scene: { lamp, pieces: [half, mirror], targets: [up, down] },
  solution: {
    half: { x: 640, y: lamp.y, a: mirrorAngle([1, 0], [0, -1]) },
    mirror: { x: 1110, y: lamp.y, a: mirrorAngle([1, 0], [0, 1]) },
  },
  notes: [NOTE.Cs4, NOTE.Fs4],
};
