// "Full spectrum": everything at once. A half mirror on the lamp's beam: one half becomes the
// rainbow of "Three colours", the other goes through magenta glass to a magenta target.
import type { Filter, Mirror, Splitter } from "../optics.ts";
import { NOTE } from "./notes.ts";
import { mirrorAngle, type Level } from "./helpers.ts";
import { threeColours } from "./threeColours.ts";

const lamp = threeColours.scene.lamp;
const half: Splitter = { kind: "splitter", id: "half", x: 470, y: 670, a: 0.1, len: 80, move: "free" };
const high: Mirror = { kind: "mirror", id: "high", x: 150, y: 300, a: 0.7, len: 96, move: "free" };
const glass: Filter = { kind: "filter", id: "magenta-glass", x: 1160, y: 120, a: 0, len: 70, colors: ["red", "blue"], move: "free" };
const magenta = { id: "magenta", x: 540, y: 140, r: 22, colors: ["red" as const, "blue" as const] };
const H = { x: 215, y: lamp.y };

export const fullSpectrum: Level = {
  id: "full-spectrum",
  title: "Full spectrum",
  lesson: "Everything you know, at once. Half the light makes a rainbow; the other half, magenta.",
  scene: {
    lamp,
    pieces: [...threeColours.scene.pieces, half, high, glass],
    targets: [...threeColours.scene.targets, magenta],
  },
  solution: {
    ...threeColours.solution,
    half: { ...H, a: mirrorAngle([1, 0], [0, -1]) },
    high: { x: H.x, y: 150, a: mirrorAngle([0, -1], [1, 0]) },
    "magenta-glass": { x: 380, y: 150, a: Math.PI / 2 },
  },
  notes: [NOTE.A3, NOTE.Cs4, NOTE.E4, NOTE.A4],
};
