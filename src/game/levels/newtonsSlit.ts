// "Newton's slit": isolate one colour through a slit, then bend it again with a second prism.
// It bends, but it does not split: one colour stays one colour (Newton, 1672).
import type { Prism, Scene, Wall } from "../optics.ts";
import { add, mul, type Vec } from "../vec.ts";
import { NOTE } from "./notes.ts";
import { ROOM, mainPath, type Level } from "./helpers.ts";

const lamp = { x: 100, y: 150, a: 0.32 };
const first: Prism = { kind: "prism", id: "first", x: 300, y: 215, a: -0.94, r: 80, move: "fixed" };

// The slit stands across green's path; red and blue fall on its walls.
const green = mainPath({ lamp, pieces: [first], targets: [] }, 535).at(-1)!;
const across: Vec = [-green.d[1], green.d[0]];
const slit = add(green.p, mul(green.d, 190));
const wall = (id: string, side: number): Wall => {
  const a = add(slit, mul(across, side * 8));
  const b = add(slit, mul(across, side * 90));
  return { kind: "wall", id, x0: a[0], y0: a[1], x1: b[0], y1: b[1] };
};
const walls = [wall("slit-left", 1), wall("slit-right", -1)];

// The second prism sits in the green light beyond the slit. Find an angle where green leaves
// it cleanly and lands well inside the room.
const at = add(slit, mul(green.d, 170));
const second: Prism = { kind: "prism", id: "second", x: 1050, y: 160, a: 0.4, r: 64, move: "free" };
let solvedAngle = 0;
let target = { x: 0, y: 0 };
for (let a = -Math.PI; a < Math.PI; a += 0.01) {
  const scene: Scene = { lamp, pieces: [first, ...walls, { ...second, x: at[0], y: at[1], a }], targets: [] };
  const path = mainPath(scene, 535);
  if (path.length !== 6) continue; // lamp, through the first prism (2), out, through the second, out
  const out = path.at(-1)!;
  const end = add(out.p, mul(out.d, 220));
  const room = end[0] > 120 && end[0] < ROOM.w - 80 && end[1] > 120 && end[1] < ROOM.h - 80;
  const turned = Math.abs(out.d[0] * green.d[1] - out.d[1] * green.d[0]) > 0.35; // bent well away from its old line
  if (room && turned) {
    solvedAngle = a;
    target = { x: end[0], y: end[1] };
    break;
  }
}

export const newtonsSlit: Level = {
  id: "newtons-slit",
  title: "Newton's slit",
  lesson: "Let one colour through the slit, then bend it with the second prism. It bends, but stays one colour.",
  scene: { lamp, pieces: [first, ...walls, second], targets: [{ id: "green", ...target, r: 20, colors: ["green"] }] },
  solution: { second: { x: at[0], y: at[1], a: solvedAngle } },
  notes: [NOTE.Gs4],
};
