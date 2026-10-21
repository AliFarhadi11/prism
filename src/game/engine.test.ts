import assert from "node:assert/strict";
import { test } from "node:test";
import { Game, TURN_STEP } from "./engine.ts";
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

test("on a phone-sized reach, a mirror's middle still moves it and its tips still turn it", () => {
  const game = new Game(tiny);
  game.grabRadius = 30 / 0.54; // 30px finger on a phone, where the room is drawn at about half size
  assert.equal(game.pick([400, 500])?.mode, "move");
  assert.equal(game.pick([412, 510])?.mode, "move");
  assert.equal(game.pick([436, 500])?.mode, "turn");
  assert.equal(game.pick([470, 500])?.mode, "turn"); // just past the tip
  assert.equal(game.pick([700, 500])?.mode, "turn"); // pinned: its middle turns
});

test("on a phone-sized reach, a free prism's middle moves it and its corners turn it", () => {
  const prism = { kind: "prism", id: "p", x: 600, y: 300, a: 0, r: 64, move: "free" } as const;
  const game = new Game({ ...tiny, scene: { ...tiny.scene, pieces: [prism] } });
  game.grabRadius = 30 / 0.54;
  assert.equal(game.pick([600, 300])?.mode, "move");
  assert.equal(game.pick([616, 300])?.mode, "move"); // still well inside
  assert.equal(game.pick([640, 300])?.mode, "turn"); // near the first corner, at (664, 300)
  assert.equal(game.pick([680, 300])?.mode, "turn"); // just outside it
});

test("on touch, turning close to the center is gentler; far out it follows the finger", () => {
  const turnBy = (r: number) => {
    const game = new Game(tiny);
    game.touch = true;
    game.grabRadius = 30 / 0.54;
    assert.ok(game.pointerDown([440, 500])); // the tip
    game.pointerMove([400 + r, 500]);
    for (let k = 1; k <= 10; k++) game.pointerMove([400 + r * Math.cos(k * 0.03), 500 + r * Math.sin(k * 0.03)]);
    game.pointerUp();
    settle(game);
    return game.piece("free")!.a;
  };
  const close = turnBy(40); // just past the tip: the finger swept 0.3 rad
  const far = turnBy(200);
  assert.ok(close > 0.05 && close < 0.2, `close turned ${close.toFixed(3)}`);
  assert.ok(Math.abs(far - 0.3) < 0.06, `far turned ${far.toFixed(3)}`);
});

test("the turn buttons turn the selected piece, and say what is selected", () => {
  const names: (string | null)[] = [];
  const game = new Game(tiny, { onSelect: (n) => names.push(n) });
  assert.equal(game.turn(0.1), false, "nothing selected yet");
  game.pointerDown([400, 500]);
  game.pointerUp();
  for (let k = 0; k < 10; k++) game.turn(TURN_STEP);
  settle(game);
  assert.ok(Math.abs(game.piece("free")!.a - 10 * TURN_STEP) < 0.06);
  game.load(tiny);
  assert.deepEqual(names, ["mirror", null]);
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
