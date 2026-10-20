import assert from "node:assert/strict";
import { test } from "node:test";
import { trace, type Scene } from "./optics.ts";
import { angleOf } from "./vec.ts";

const lamp = { x: 0, y: 0, a: 0 }; // shining along +x
const deg = (r: number) => (r * 180) / Math.PI;

// The main path of one wavelength: segments in order, following only the strongest ray.
function path(scene: Scene, l: number) {
  return trace(scene, [l]).segments.filter((s) => s.I > 0.5);
}

test("a mirror at 45° turns the beam a right angle", () => {
  const scene: Scene = { lamp, pieces: [{ kind: "mirror", id: "m", x: 100, y: 0, a: Math.PI / 4, len: 60, move: "free" }], targets: [] };
  const [first, second] = path(scene, 550);
  assert.ok(Math.abs(first.x1 - 100) < 1e-6 && Math.abs(first.y1) < 1e-6, "hits the mirror's center");
  assert.ok(Math.abs(deg(angleOf([second.x1 - second.x0, second.y1 - second.y0])) - 90) < 1e-6, "leaves along +y");
});

test("a wall absorbs the beam", () => {
  const scene: Scene = { lamp, pieces: [{ kind: "wall", id: "w", x0: 100, y0: -50, x1: 100, y1: 50 }], targets: [] };
  const segs = trace(scene, [550]).segments;
  assert.equal(segs.length, 1);
  assert.ok(Math.abs(segs[0].x1 - 100) < 1e-6);
});

test("a prism bends blue light more than red, and splits them apart", () => {
  const scene: Scene = { lamp: { x: 0, y: 40, a: -0.2 }, pieces: [{ kind: "prism", id: "p", x: 200, y: 0, a: -Math.PI / 2, r: 60, move: "fixed" }], targets: [] };
  const exit = (l: number) => {
    const segs = path(scene, l);
    const last = segs[segs.length - 1];
    return angleOf([last.x1 - last.x0, last.y1 - last.y0]);
  };
  const red = exit(680);
  const blue = exit(420);
  const deviation = (a: number) => Math.abs(a - -0.2);
  assert.ok(deviation(blue) > deviation(red), "blue deviates more");
  assert.ok(deg(Math.abs(blue - red)) > 3, `spread ${deg(Math.abs(blue - red)).toFixed(1)}° is visible`);
});

test("light inside glass beyond the critical angle reflects back in (total internal reflection)", () => {
  // A beam entering the left face steeply reaches the right face beyond the critical angle.
  const scene: Scene = { lamp: { x: 150, y: 120, a: -1.25 }, pieces: [{ kind: "prism", id: "p", x: 200, y: 0, a: -Math.PI / 2, r: 80, move: "fixed" }], targets: [] };
  const segs = trace(scene, [550]).segments;
  assert.ok(segs.some((s) => s.I > 0.5 && s.tir), "at least one total internal reflection on the main path");
});

test("coloured glass passes its own colour and absorbs the rest", () => {
  const filter = { kind: "filter" as const, id: "f", x: 100, y: 0, a: Math.PI / 2, len: 60, colors: ["red" as const], move: "free" as const };
  const scene: Scene = { lamp, pieces: [filter], targets: [] };
  assert.ok(path(scene, 660).some((s) => s.x0 >= 100), "red continues past the glass");
  assert.ok(!path(scene, 450).some((s) => s.x0 >= 100), "blue stops at the glass");
});

test("targets record the light that reaches them, per wavelength", () => {
  const scene: Scene = { lamp, pieces: [], targets: [{ id: "t", x: 200, y: 0, r: 15, colors: ["red", "green", "blue"] }] };
  const { hits } = trace(scene, [450, 550, 650]);
  const t = hits.get("t");
  assert.ok(t);
  assert.deepEqual([...t.keys()].sort(), [450, 550, 650]);
});

test("light keeps losing a little at every surface, never gaining", () => {
  const scene: Scene = {
    lamp,
    pieces: [
      { kind: "mirror", id: "a", x: 100, y: 0, a: Math.PI / 4, len: 60, move: "free" },
      { kind: "mirror", id: "b", x: 100, y: 100, a: -Math.PI / 4, len: 60, move: "free" },
    ],
    targets: [],
  };
  const segs = path(scene, 550);
  for (let i = 1; i < segs.length; i++) assert.ok(segs[i].I <= segs[i - 1].I);
});
