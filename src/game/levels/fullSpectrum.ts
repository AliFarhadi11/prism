// "Full spectrum": everything at once, with two lamps. The first makes the rainbow of
// "Three colours"; the second meets a half mirror: half goes on through magenta glass to a
// magenta target, half turns down to a white one.
import type { Filter, Splitter } from "../optics.ts";
import { NOTE } from "./notes.ts";
import { WHITE, mirrorAngle, type Level } from "./helpers.ts";
import { threeColours } from "./threeColours.ts";

const second = { x: 96, y: 150, a: 0 };
const half: Splitter = { kind: "splitter", id: "half", x: 470, y: 670, a: 0.1, len: 80, move: "free" };
const glass: Filter = { kind: "filter", id: "magenta-glass", x: 1160, y: 120, a: 0, len: 70, colors: ["red", "blue"], move: "free" };
const magenta = { id: "magenta", x: 560, y: second.y, r: 24, colors: ["red" as const, "blue" as const] };
const white = { id: "white", x: 380, y: 290, r: 22, colors: WHITE };
const H = { x: 380, y: second.y };

export const fullSpectrum: Level = {
  id: "full-spectrum",
  title: "Full spectrum",
  lesson: "Everything you know, at once. One lamp makes a rainbow; the other, magenta and white.",
  scene: {
    lamp: threeColours.scene.lamp,
    lamps: [second],
    pieces: [...threeColours.scene.pieces, half, glass],
    targets: [...threeColours.scene.targets, magenta, white],
  },
  solution: {
    ...threeColours.solution,
    half: { ...H, a: mirrorAngle([1, 0], [0, 1]) },
    "magenta-glass": { x: 470, y: second.y, a: Math.PI / 2 },
  },
  notes: [NOTE.A3, NOTE.Cs4, NOTE.E4, NOTE.A4, NOTE.E4 * 2],
};
