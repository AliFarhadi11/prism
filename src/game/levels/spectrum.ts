// "Spectrum": the prism only turns. Find the angle that lays the rainbow across the three targets.
import type { Prism, Scene } from "../optics.ts";
import { NOTE } from "./notes.ts";
import { mainPath, type Level } from "./helpers.ts";

const lamp = { x: 100, y: 150, a: 0.32 };
const solvedAngle = -0.94; // near minimum deviation: every colour leaves the glass cleanly
const prism: Prism = { kind: "prism", id: "prism", x: 300, y: 215, a: solvedAngle + 0.55, r: 80, move: "turn" };
const solved: Scene = { lamp, pieces: [{ ...prism, a: solvedAngle }], targets: [] };
const spot = (l: number, s: number) => {
  const r = mainPath(solved, l).at(-1)!;
  return { x: r.p[0] + r.d[0] * s, y: r.p[1] + r.d[1] * s };
};
const DIST = 335;

export const spectrum: Level = {
  id: "spectrum",
  title: "Spectrum",
  lesson: "Glass bends blue light more than red. Turn the prism to spread its colours.",
  scene: {
    lamp,
    pieces: [prism],
    targets: [
      { id: "red", ...spot(655, DIST), r: 17, colors: ["red"] },
      { id: "green", ...spot(535, DIST), r: 17, colors: ["green"] },
      { id: "blue", ...spot(445, DIST), r: 17, colors: ["blue"] },
    ],
  },
  solution: { prism: { a: solvedAngle } },
  notes: [NOTE.D4, NOTE.Fs4, NOTE.A4],
};
