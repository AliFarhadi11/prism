import assert from "node:assert/strict";
import { test } from "node:test";
import { isSolved } from "../puzzle.ts";
import { ROOM, applySolution } from "./helpers.ts";
import { levels } from "./index.ts";

test("there are levels, with unique ids", () => {
  assert.ok(levels.length > 0);
  assert.equal(new Set(levels.map((l) => l.id)).size, levels.length);
});

for (const level of levels) {
  test(`${level.id}: unsolved at the start`, () => {
    assert.equal(isSolved(level.scene), false);
  });

  test(`${level.id}: its recorded solution solves it`, () => {
    assert.equal(isSolved(applySolution(level.scene, level.solution)), true);
  });

  test(`${level.id}: the solution only changes what the player may change`, () => {
    for (const [id, change] of Object.entries(level.solution)) {
      const piece = level.scene.pieces.find((p) => p.id === id);
      assert.ok(piece && piece.kind !== "wall", `${id} is a movable piece`);
      assert.notEqual(piece.move, "fixed", `${id} is not fixed`);
      if (piece.move === "turn") assert.ok(change.x === undefined && change.y === undefined, `${id} may only turn`);
    }
  });

  test(`${level.id}: everything sits inside the room`, () => {
    const solved = applySolution(level.scene, level.solution);
    const inside = (x: number, y: number) => x >= ROOM.margin && x <= ROOM.w - ROOM.margin && y >= ROOM.margin && y <= ROOM.h - ROOM.margin;
    for (const t of solved.targets) assert.ok(inside(t.x, t.y), `target ${t.id} at ${t.x.toFixed(0)},${t.y.toFixed(0)}`);
    for (const p of solved.pieces) if (p.kind !== "wall") assert.ok(inside(p.x, p.y), `${p.id} at ${p.x.toFixed(0)},${p.y.toFixed(0)}`);
  });
}
