import assert from "node:assert/strict";
import { test } from "node:test";
import { LAMBDAS, inBand } from "./light.ts";
import type { Target } from "./optics.ts";
import { bandEnergy, isLit } from "./puzzle.ts";

const only = (pred: (l: number) => boolean) => new Map(LAMBDAS.filter(pred).map((l) => [l, 1]));
const white = only(() => true);
const target = (colors: Target["colors"]): Target => ({ id: "t", x: 0, y: 0, r: 10, colors });

test("band energy is the share of a band's wavelengths that arrive", () => {
  assert.equal(bandEnergy(white, "red"), 1);
  assert.equal(bandEnergy(new Map(), "red"), 0);
  const half = new Map(LAMBDAS.filter((l) => inBand(l, "green")).map((l, i) => [l, i % 2 ? 1 : 0]));
  const e = bandEnergy(half, "green");
  assert.ok(e > 0.3 && e < 0.7, `about half: ${e}`);
});

test("a white target lights with the whole beam", () => {
  assert.equal(isLit(target(["red", "green", "blue"]), white), true);
});

test("a red target does not light with white light: it must be sorted out first", () => {
  assert.equal(isLit(target(["red"]), white), false);
  assert.equal(isLit(target(["red"]), only((l) => inBand(l, "red"))), true);
});

test("magenta needs red and blue together, and no green", () => {
  const magenta = target(["red", "blue"]);
  assert.equal(isLit(magenta, only((l) => inBand(l, "red") || inBand(l, "blue"))), true);
  assert.equal(isLit(magenta, only((l) => inBand(l, "red"))), false, "red alone is not magenta");
  assert.equal(isLit(magenta, white), false, "green spoils it");
});
