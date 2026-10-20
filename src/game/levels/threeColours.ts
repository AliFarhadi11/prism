// "Three colours": bounce the lamp into the prism, then fold the rainbow back so each colour
// reaches its own target. The fold makes the path long enough for the colours to draw apart.
import type { Mirror, Prism, Scene } from "../optics.ts";
import { prismCorners } from "../optics.ts";
import { add, cross, mul, norm, sub, type Vec } from "../vec.ts";
import { ROOM, applySolution, mainPath, mirrorAngle, type Level } from "./helpers.ts";

const lamp = { x: 96, y: 604, a: 0 };
const prism: Prism = { kind: "prism", id: "prism", x: 600, y: 318, a: -Math.PI / 2, r: 112, move: "fixed" };
const first: Mirror = { kind: "mirror", id: "first", x: 300, y: 430, a: 0.25, len: 96, move: "free" };
const second: Mirror = { kind: "mirror", id: "second", x: 1100, y: 560, a: 1.1, len: 96, move: "free" };

// Solution, part one: the first mirror sends the beam to the middle of the prism's left face.
const [top, , left] = prismCorners(prism); // corners run clockwise from the top: top, bottom right, bottom left
const entry = mul(add(top, left), 0.5);
const A = { x: 330, y: lamp.y };
const aA = mirrorAngle([1, 0], sub(entry, [A.x, A.y]));
const withA: Scene = { lamp, pieces: [prism, { ...first, ...A, a: aA }], targets: [] };

// Where the green light leaves the glass, and the second mirror catches the whole rainbow there.
const exitOf = (l: number) => mainPath(withA, l).at(-1)!; // the last stretch: out of the glass, into the room
const greenExit = exitOf(535);
const inView = (q: Vec, m = 70) => q[0] > m && q[0] < ROOM.w - m && q[1] > 120 && q[1] < ROOM.h - m;
let reach = 470;
while (!inView(add(greenExit.p, mul(greenExit.d, reach)))) reach -= 10;
const B = add(greenExit.p, mul(greenExit.d, reach));
const back = norm([-0.9, 0.42]); // down and back under the prism, clear of the lamp's beam
const aB = mirrorAngle(greenExit.d, back);
const solution = { first: { ...A, a: aA }, second: { x: B[0], y: B[1], a: aB } };
const solved = applySolution({ lamp, pieces: [prism, first, second], targets: [] }, solution);

// Targets: along each colour's folded path, where the three have drawn at least 42 apart.
const folded = (["red", "green", "blue"] as const).map((band) => {
  const l = { red: 655, green: 535, blue: 445 }[band];
  const path = mainPath(solved, l);
  return path[path.length - 1];
});
const gap = (r: (typeof folded)[number], s: number, o: (typeof folded)[number]) => Math.abs(cross(sub(add(r.p, mul(r.d, s)), o.p), o.d));
let spot = 200;
for (; spot < 1600; spot += 4) {
  const pts = folded.map((r) => add(r.p, mul(r.d, spot)));
  const apart = folded.every((r, i) => folded.every((o, j) => i === j || gap(r, spot, o) > 42));
  if (apart && pts.every((q) => inView(q, 60) && (q[0] > 660 || q[1] < lamp.y - 70))) break;
}
const [red, green, blue] = folded.map((r) => add(r.p, mul(r.d, spot)));

export const threeColours: Level = {
  id: "three-colours",
  title: "Three colours",
  lesson: "Bend the light into the prism, then send each colour home.",
  scene: {
    lamp,
    pieces: [prism, first, second],
    targets: [
      { id: "red", x: red[0], y: red[1], r: 19, colors: ["red"] },
      { id: "green", x: green[0], y: green[1], r: 19, colors: ["green"] },
      { id: "blue", x: blue[0], y: blue[1], r: 19, colors: ["blue"] },
    ],
  },
  solution,
  // A major: red is the lowest note, as red light has the lowest frequency.
  notes: [220, 277.18, 329.63],
};
