// 2D vectors as [x, y] tuples. Pure helpers, no allocation tricks: scenes are tiny.

export type Vec = readonly [number, number];

export const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
export const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1];
export const cross = (a: Vec, b: Vec) => a[0] * b[1] - a[1] * b[0];
export const len = (a: Vec) => Math.hypot(a[0], a[1]);
export const norm = (a: Vec): Vec => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
export const fromAngle = (a: number): Vec => [Math.cos(a), Math.sin(a)];
export const angleOf = (a: Vec) => Math.atan2(a[1], a[0]);
/** Mirror `d` about the line with unit normal `n`. */
export const reflect = (d: Vec, n: Vec): Vec => sub(d, mul(n, 2 * dot(d, n)));

/** Distance from `p` to the segment a–b, and the closest point's parameter t in [0, 1]. */
export function toSegment(p: Vec, a: Vec, b: Vec) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  return { d: len(sub(p, add(a, mul(ab, t)))), t };
}
