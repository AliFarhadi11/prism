import assert from "node:assert/strict";
import { test } from "node:test";
import { Game } from "./engine.ts";
import type { Level } from "./levels/helpers.ts";
import { levels } from "./levels/index.ts";

const settle = (game: Game, seconds = 1) => {
  for (let t = 0; t < seconds; t += 1 / 60) game.update(1 / 60);
};

const tiny: Level = {
  id: "tiny",
  title: "Tiny",
  lesson: "",
  scene: {
    lamp: { x: 100, y: 300, a: 0 },
    pieces: [
      { kind: "mirror", id: "free", x: 400, y: 500, a: 0, len: 80, move: "free" },
      { kind: "mirror", id: "pinned", x: 700, y: 500, a: 0, len: 80, move: "turn" },
    ],
    targets: [],
  },
  solution: {},
  notes: [],
};

test("dragging a free mirror's body moves it with the pointer", () => {
  const game = new Game(tiny);
  assert.ok(game.pointerDown([400, 500]));
  game.pointerMove([460, 420]);
  game.pointerUp();
  settle(game);
  const m = game.piece("free")!;
  assert.ok(Math.abs(m.x - 460) < 1 && Math.abs(m.y - 420) < 1, `at ${m.x.toFixed(1)},${m.y.toFixed(1)}`);
});

test("a pinned mirror turns when dragged, but never moves", () => {
  const game = new Game(tiny);
  assert.ok(game.pointerDown([710, 500]));
  game.pointerMove([700, 600]);
  game.pointerUp();
  settle(game);
  const m = game.piece("pinned")!;
  assert.equal(m.x, 700);
  assert.equal(m.y, 500);
  assert.ok(Math.abs(m.a) > 0.5, `turned to ${m.a.toFixed(2)}`);
});

test("keyboard: pick a piece by number, move with arrows, turn with Q and E", () => {
  const game = new Game(tiny);
  assert.ok(game.key("1", false));
  game.key("ArrowRight", false);
  game.key("e", false);
  settle(game);
  const m = game.piece("free")!;
  assert.ok(m.x > 400 && m.a > 0);
  assert.ok(game.key("2", false));
  assert.equal(game.key("ArrowRight", false), false, "a pinned piece cannot be moved");
});

test("putting the pieces in the solution solves the level, once lit for a moment", () => {
  const events: boolean[] = [];
  const game = new Game(levels[0], { onSolved: (s) => events.push(s) });
  settle(game, 0.3);
  assert.equal(game.solved, false);
  game.solve();
  settle(game, 2);
  assert.equal(game.solved, true);
  assert.deepEqual(events, [true]);
  assert.ok(game.targets.every((t) => t.lit));
});

test("letting go just off the mark: the light finds the target (up to 3°)", () => {
  const game = new Game(levels[0]);
  game.solve();
  game.setGoal("mirror", { a: (game.level.solution.mirror.a ?? 0) + (2.5 * Math.PI) / 180 });
  settle(game, 1);
  assert.equal(game.targets[0].lit, false, "2.5° off is not lit by itself");
  game.release("mirror");
  settle(game, 1.5);
  assert.equal(game.targets[0].lit, true);
});

test("letting go far off the mark changes nothing: no puzzle solves itself", () => {
  const game = new Game(levels[0]);
  game.solve();
  const off = (game.level.solution.mirror.a ?? 0) + (12 * Math.PI) / 180;
  game.setGoal("mirror", { a: off });
  settle(game, 1);
  game.release("mirror");
  settle(game, 1);
  assert.equal(game.targets[0].lit, false);
  assert.ok(Math.abs(game.piece("mirror")!.a - off) < 1e-3);
});
