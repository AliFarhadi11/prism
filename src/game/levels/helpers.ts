// Tools for authoring levels: apply a solution, follow a wavelength's path, place targets on it.
import { BANDS, type BandName } from "../light.ts";
import { trace, type Piece, type Scene, type Target } from "../optics.ts";
import { add, mul, norm, sub, type Vec } from "../vec.ts";

/** The room every level is played in (virtual units). */
export const ROOM = { w: 1280, h: 720, margin: 40 } as const;

export type Change = { x?: number; y?: number; a?: number };
export type Solution = Record<string, Change>;

export type Level = {
  id: string;
  title: string;
  /** One line under the title: what this puzzle teaches. */
  lesson: string;
  scene: Scene;
  solution: Solution;
  /** One frequency (Hz) per target, in target order: together they make the level's chord. */
  notes: number[];
};

export function applySolution(scene: Scene, solution: Solution): Scene {
  return {
    ...scene,
    pieces: scene.pieces.map((p) => (solution[p.id] && p.kind !== "wall" ? ({ ...p, ...solution[p.id] } as Piece) : p)),
  };
}

/** Angle for a mirror at any point that turns light travelling along `din` to travel along `dout`. */
export function mirrorAngle(din: Vec, dout: Vec) {
  const n = norm(sub(norm(dout), norm(din)));
  return Math.atan2(n[1], n[0]) + Math.PI / 2;
}

/** The main (strongest) path of one wavelength, as rays: start point and unit direction per segment. */
export function mainPath(scene: Scene, l: number) {
  return trace(scene, [l])
    .segments.filter((s) => s.I > 0.5)
    .map((s) => ({ p: [s.x0, s.y0] as Vec, d: norm([s.x1 - s.x0, s.y1 - s.y0]), end: [s.x1, s.y1] as Vec }));
}

/** A point `distance` along segment `index` of a wavelength's main path (negative index counts from the end). */
export function along(scene: Scene, l: number, index: number, distance: number): Vec {
  const path = mainPath(scene, l);
  const seg = path[index < 0 ? path.length + index : index];
  return add(seg.p, mul(seg.d, distance));
}

const center = (band: BandName) => (BANDS[band].from + BANDS[band].to) / 2;

/** A target on the main path of a colour's central wavelength. */
export function targetOn(scene: Scene, id: string, colors: BandName[], via: BandName, index: number, distance: number, r = 19): Target {
  const [x, y] = along(scene, center(via), index, distance);
  return { id, x, y, r, colors };
}

export const WHITE: BandName[] = ["red", "green", "blue"];

/**
 * How far (degrees, total) a piece of the solution can turn either way and still solve the
 * level. Small numbers mean the player needs pixel-perfect aim.
 */
export function turnSlack(scene: Scene, solution: Solution, id: string, isSolved: (s: Scene) => boolean, step = 0.25) {
  const solved = applySolution(scene, solution);
  const turned = (da: number): Scene => ({
    ...solved,
    pieces: solved.pieces.map((p) => (p.id === id && p.kind !== "wall" ? ({ ...p, a: p.a + (da * Math.PI) / 180 } as Piece) : p)),
  });
  let lo = 0;
  let hi = 0;
  while (lo < 30 && isSolved(turned(-(lo + step)))) lo += step;
  while (hi < 30 && isSolved(turned(hi + step))) hi += step;
  return lo + hi;
}
