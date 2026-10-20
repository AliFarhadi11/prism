// "Three colours": bounce the lamp into the prism, then fold the rainbow back so each colour
// reaches its own target. The fold makes the path long enough for the colours to draw apart.
import { prismFaces, type Mirror, type Prism, type Scene } from "../optics.ts";
import { add, cross, fromAngle, mul, norm, sub, type Vec } from "../vec.ts";
import { NOTE } from "./notes.ts";
import { ROOM, applySolution, mainPath, mirrorAngle, type Level } from "./helpers.ts";

export type ThreeColoursLayout = {
  /** Height of the lamp's beam. */
  lampY: number;
  /** Where the first mirror sits on that beam. */
  mirrorX: number;
  /** How far past the prism the second mirror catches the rainbow. */
  reach: number;
  /** Direction the rainbow is folded back in (radians). */
  fold: number;
  /** Least distance between colours where the targets go. */
  gap: number;
};

/** Chosen by searching for the most forgiving layout. */
export const LAYOUT: ThreeColoursLayout = { lampY: 400, mirrorX: 340, reach: 380, fold: (170 * Math.PI) / 180, gap: 46 };

const prism: Prism = { kind: "prism", id: "prism", x: 600, y: 318, a: -Math.PI / 2, r: 112, move: "fixed" };
const inView = (q: Vec, m = 60) => q[0] > m && q[0] < ROOM.w - m && q[1] > 110 && q[1] < ROOM.h - m;

export function buildThreeColours(layout: ThreeColoursLayout): Level | null {
  const lamp = { x: 96, y: layout.lampY, a: 0 };
  const first: Mirror = { kind: "mirror", id: "first", x: 300, y: 640, a: 0.25, len: 96, move: "free" };
  // Long enough to catch the whole rainbow with room to spare, so a small turn upstream loses no colour.
  const second: Mirror = { kind: "mirror", id: "second", x: 1100, y: 600, a: 1.1, len: 132, move: "free" };

  // Aim at the middle of the prism's left face.
  const left = prismFaces(prism)[2];
  const entry = mul(add(left.a, left.b), 0.5);
  const A = { x: layout.mirrorX, y: lamp.y };
  const toEntry = sub(entry, [A.x, A.y]);
  // Keep the beam well away from grazing the face: within 20° of the angle of minimum
  // deviation (about 56° from the normal), where every colour passes cleanly and the exit
  // barely moves when the entry angle changes.
  const inward = mul(left.n, -1);
  const incidence = Math.acos(Math.min(1, Math.abs(norm(toEntry)[0] * inward[0] + norm(toEntry)[1] * inward[1])));
  if (Math.abs(incidence - (56 * Math.PI) / 180) > (20 * Math.PI) / 180) return null;
  const aA = mirrorAngle([1, 0], toEntry);
  const withA: Scene = { lamp, pieces: [prism, { ...first, ...A, a: aA }], targets: [] };

  const path = mainPath(withA, 535);
  const exit = path.at(-1);
  if (!exit || path.length !== 4) return null; // lamp, mirror, through the glass, out
  const B = add(exit.p, mul(exit.d, layout.reach));
  if (!inView(B, 80)) return null;
  const back = fromAngle(layout.fold);
  const aB = mirrorAngle(exit.d, back);
  const solution = { first: { ...A, a: aA }, second: { x: B[0], y: B[1], a: aB } };
  const solved = applySolution({ lamp, pieces: [prism, first, second], targets: [] }, solution);

  // Targets: along each colour's folded path, where the three have drawn apart.
  const centers = [655, 535, 445];
  const paths = centers.map((l) => mainPath(solved, l));
  if (paths.some((p) => p.length !== 5)) return null;
  const folded = paths.map((p) => p.at(-1)!);
  const gap = (s: number, i: number, j: number) => Math.abs(cross(sub(add(folded[i].p, mul(folded[i].d, s)), folded[j].p), folded[j].d));
  for (let s = 120; s < 1400; s += 4) {
    const pts = folded.map((r) => add(r.p, mul(r.d, s)));
    if (!pts.every((q) => inView(q))) continue;
    if (gap(s, 0, 1) < layout.gap || gap(s, 1, 2) < layout.gap) continue;
    // Clear of the lamp's beam and of the light rising from the first mirror into the prism.
    const clear = pts.every((q) => Math.abs(q[1] - lamp.y) > 40 && !(q[0] < entry[0] + 30 && q[1] < lamp.y && q[1] > entry[1] - 30));
    if (!clear) continue;
    const [red, green, blue] = pts;
    return {
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
      notes: [NOTE.A3, NOTE.Cs4, NOTE.E4],
    };
  }
  return null;
}

export const threeColours: Level = buildThreeColours(LAYOUT)!;
