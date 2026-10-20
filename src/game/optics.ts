// 2D ray optics for Prism: mirrors reflect, glass refracts by wavelength (and reflects internally
// past the critical angle), coloured glass filters, walls absorb, targets collect.
import { BAND_NAMES, FILTER_PASS, LAMBDAS, nGlass, type BandName } from "./light.ts";
import { add, cross, dot, fromAngle, mul, norm, reflect, sub, type Vec } from "./vec.ts";

/** How the player may handle a piece. */
export type Move = "free" | "turn" | "fixed";

export type Mirror = { kind: "mirror"; id: string; x: number; y: number; a: number; len: number; move: Move };
/** Equilateral glass prism: center, circumradius `r`, `a` = angle of its first corner. */
export type Prism = { kind: "prism"; id: string; x: number; y: number; a: number; r: number; move: Move };
/** Coloured glass: lets its colours through, absorbs the rest. */
export type Filter = { kind: "filter"; id: string; x: number; y: number; a: number; len: number; colors: BandName[]; move: Move };
/** Half-silvered mirror: lets half the light through and reflects the other half. */
export type Splitter = { kind: "splitter"; id: string; x: number; y: number; a: number; len: number; move: Move };
export type Wall = { kind: "wall"; id: string; x0: number; y0: number; x1: number; y1: number };
export type Piece = Mirror | Prism | Filter | Splitter | Wall;

export type Target = { id: string; x: number; y: number; r: number; colors: BandName[] };
export type Lamp = { x: number; y: number; a: number };
export type Scene = { lamp: Lamp; pieces: Piece[]; targets: Target[] };

export type Segment = { x0: number; y0: number; x1: number; y1: number; l: number; I: number; inside: boolean; tir?: boolean };
export type Spark = { x: number; y: number; l: number; I: number };
export type Trace = { segments: Segment[]; sparks: Spark[]; hits: Map<string, Map<number, number>> };

const LOSS = { mirror: 0.97, glass: 0.93, filter: 0.9, tir: 0.98, split: 0.48 } as const;
/** Faint reflection off a glass face (Fresnel), drawn as a glint. */
const GLINT = 0.035;
const MAX_DEPTH = 16;
const MIN_I = 0.02;
const FAR = 4000;

export function ends(p: { x: number; y: number; a: number; len: number }): [Vec, Vec] {
  const h = mul(fromAngle(p.a), p.len / 2);
  return [sub([p.x, p.y], h), add([p.x, p.y], h)];
}

export function prismCorners(p: Prism): Vec[] {
  return [0, 1, 2].map((i) => add([p.x, p.y], mul(fromAngle(p.a + (i * 2 * Math.PI) / 3), p.r)));
}

/** Prism faces with outward unit normals. */
export function prismFaces(p: Prism) {
  const c = prismCorners(p);
  return c.map((a, i) => {
    const b = c[(i + 1) % 3];
    const mid = mul(add(a, b), 0.5);
    return { a, b, n: norm(sub(mid, [p.x, p.y])) };
  });
}

export function insidePrism(p: Prism, q: Vec) {
  return prismFaces(p).every((f) => dot(sub(q, f.a), f.n) < 0);
}

function raySegment(o: Vec, d: Vec, a: Vec, b: Vec) {
  const e = sub(b, a);
  const den = cross(d, e);
  if (Math.abs(den) < 1e-12) return Infinity;
  const w = sub(a, o);
  const t = cross(w, e) / den;
  const u = cross(w, d) / den;
  return t > 1e-7 && u >= -1e-9 && u <= 1 + 1e-9 ? t : Infinity;
}

function rayCircle(o: Vec, d: Vec, c: Vec, r: number) {
  const m = sub(o, c);
  const b = dot(m, d);
  const disc = b * b - (dot(m, m) - r * r);
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t > 1e-7 ? t : Infinity;
}

type Hit =
  | { kind: "mirror"; n: Vec }
  | { kind: "glass"; n: Vec }
  | { kind: "filter"; colors: BandName[] }
  | { kind: "splitter"; n: Vec }
  | { kind: "wall" }
  | { kind: "target"; id: string };

type Ray = { o: Vec; d: Vec; I: number; depth: number; inside: boolean; tir?: boolean };

/** Trace every wavelength from the lamp through the scene. */
export function trace(scene: Scene, lambdas: readonly number[] = LAMBDAS): Trace {
  const out: Trace = { segments: [], sparks: [], hits: new Map() };
  for (const t of scene.targets) out.hits.set(t.id, new Map());
  const faces = scene.pieces.filter((p): p is Prism => p.kind === "prism").flatMap((p) => prismFaces(p));

  for (const l of lambdas) {
    const stack: Ray[] = [{ o: [scene.lamp.x, scene.lamp.y], d: fromAngle(scene.lamp.a), I: 1, depth: 0, inside: false }];
    while (stack.length) {
      const ray = stack.pop()!;
      let best = FAR;
      let hit: Hit | null = null;
      const consider = (t: number, h: Hit) => {
        if (t < best) {
          best = t;
          hit = h;
        }
      };

      for (const p of scene.pieces) {
        if (p.kind === "mirror") {
          const [a, b] = ends(p);
          consider(raySegment(ray.o, ray.d, a, b), { kind: "mirror", n: norm([-(b[1] - a[1]), b[0] - a[0]]) });
        } else if (p.kind === "filter") {
          const [a, b] = ends(p);
          consider(raySegment(ray.o, ray.d, a, b), { kind: "filter", colors: p.colors });
        } else if (p.kind === "splitter") {
          const [a, b] = ends(p);
          consider(raySegment(ray.o, ray.d, a, b), { kind: "splitter", n: norm([-(b[1] - a[1]), b[0] - a[0]]) });
        } else if (p.kind === "wall") {
          consider(raySegment(ray.o, ray.d, [p.x0, p.y0], [p.x1, p.y1]), { kind: "wall" });
        }
      }
      for (const f of faces) consider(raySegment(ray.o, ray.d, f.a, f.b), { kind: "glass", n: f.n });
      for (const t of scene.targets) consider(rayCircle(ray.o, ray.d, [t.x, t.y], t.r), { kind: "target", id: t.id });

      const q = add(ray.o, mul(ray.d, best));
      out.segments.push({ x0: ray.o[0], y0: ray.o[1], x1: q[0], y1: q[1], l, I: ray.I, inside: ray.inside, tir: ray.tir });
      const h = hit as Hit | null;
      if (!h || ray.depth >= MAX_DEPTH) continue;
      const next = (d: Vec, I: number, inside: boolean, tir = false) => {
        if (I >= MIN_I) stack.push({ o: add(q, mul(d, 1e-3)), d, I, depth: ray.depth + 1, inside, tir });
      };

      if (h.kind === "mirror") {
        next(reflect(ray.d, h.n), ray.I * LOSS.mirror, false);
        out.sparks.push({ x: q[0], y: q[1], l, I: ray.I });
      } else if (h.kind === "splitter") {
        next(ray.d, ray.I * LOSS.split, ray.inside);
        next(reflect(ray.d, h.n), ray.I * LOSS.split, false);
        out.sparks.push({ x: q[0], y: q[1], l, I: ray.I * 0.5 });
      } else if (h.kind === "filter") {
        if (h.colors.some((c) => l >= FILTER_PASS[c].from && l <= FILTER_PASS[c].to)) next(ray.d, ray.I * LOSS.filter, ray.inside);
      } else if (h.kind === "glass") {
        const entering = dot(ray.d, h.n) < 0;
        const ni = entering ? h.n : mul(h.n, -1); // normal facing the incoming light
        const [n1, n2] = entering ? [1, nGlass(l)] : [nGlass(l), 1];
        const eta = n1 / n2;
        const cosi = -dot(ni, ray.d);
        const k = 1 - eta * eta * (1 - cosi * cosi);
        if (k < 0) {
          next(reflect(ray.d, ni), ray.I * LOSS.tir, true, true);
        } else {
          next(norm(add(mul(ray.d, eta), mul(ni, eta * cosi - Math.sqrt(k)))), ray.I * LOSS.glass, entering);
          if (ray.depth < 2) next(reflect(ray.d, ni), ray.I * GLINT, ray.inside);
        }
      } else if (h.kind === "target") {
        const m = out.hits.get(h.id)!;
        m.set(l, (m.get(l) ?? 0) + ray.I);
      }
    }
  }
  return out;
}

export { BAND_NAMES };
