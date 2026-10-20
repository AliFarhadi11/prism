// The game's state and rules, independent of drawing and React: pieces the player handles, the
// light traced through them each frame, targets lighting up, and the puzzle being solved.
import { ROOM, type Level } from "./levels/helpers.ts";
import { ends, insidePrism, prismCorners, trace, type Filter, type Mirror, type Piece, type Prism, type Scene, type Splitter, type Trace } from "./optics.ts";
import { isLit, progress } from "./puzzle.ts";
import { add, len, sub, toSegment, type Vec } from "./vec.ts";

export type Movable = Mirror | Prism | Filter | Splitter;
export type Grab = { id: string; mode: "move" | "turn"; offset?: Vec; turnFrom?: number };

export type TargetState = { progress: number; shown: number; lit: boolean; pulse: number };

export type GameEvents = {
  /** A target lit up or went dark. */
  onTarget?: (index: number, lit: boolean) => void;
  /** Every target is lit (held for a moment), or the solution was broken again. */
  onSolved?: (solved: boolean) => void;
  /** Something worth announcing to screen readers. */
  onSay?: (text: string) => void;
};

type Goal = { x: number; y: number; a: number };
type Mote = { x: number; y: number; vx: number; vy: number; s: number; ph: number };

const EASE = 0.3; // how quickly pieces follow the hand (per frame at 60 fps)
const HOLD = 0.5; // seconds all targets must stay lit to count as solved
const GRAB = 22; // reach of a grab, virtual units
const TURN_STEP = (1 * Math.PI) / 180;
/** On release, a piece may be eased up to this far (radians) if that lights another target. */
const SETTLE = (3 * Math.PI) / 180;
const SETTLE_STEP = (0.25 * Math.PI) / 180;
/** Keyboard turns settle once the keys have been quiet this long (seconds). */
const KEY_SETTLE = 0.35;
const MOVE_STEP = 6;

const movable = (p: Piece): p is Movable => p.kind !== "wall" && p.move !== "fixed";
const angleLerp = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

export class Game {
  level: Level;
  scene: Scene;
  light: Trace;
  targets: TargetState[];
  hover: Grab | null = null;
  drag: Grab | null = null;
  selected: string | null = null;
  solved = false;
  motes: Mote[];
  time = 0;
  private goals = new Map<string, Goal>();
  private solvedFor = 0;
  private settleAt: { id: string; time: number } | null = null;

  private events: GameEvents;

  constructor(level: Level, events: GameEvents = {}) {
    this.events = events;
    this.level = level;
    this.scene = structuredClone(level.scene);
    this.light = trace(this.scene);
    this.targets = level.scene.targets.map(() => ({ progress: 0, shown: 0, lit: false, pulse: 0 }));
    this.motes = Array.from({ length: 170 }, () => ({
      x: Math.random() * ROOM.w,
      y: Math.random() * ROOM.h,
      vx: (Math.random() - 0.5) * 4,
      vy: -1 - Math.random() * 3,
      s: 0.6 + Math.random() * 1.2,
      ph: Math.random() * Math.PI * 2,
    }));
    this.resetGoals();
  }

  load(level: Level) {
    this.level = level;
    this.scene = structuredClone(level.scene);
    this.targets = level.scene.targets.map(() => ({ progress: 0, shown: 0, lit: false, pulse: 0 }));
    this.solved = false;
    this.solvedFor = 0;
    this.selected = null;
    this.drag = this.hover = null;
    this.resetGoals();
    this.light = trace(this.scene);
  }

  private resetGoals() {
    this.goals.clear();
    for (const p of this.scene.pieces) if (movable(p)) this.goals.set(p.id, { x: p.x, y: p.y, a: p.a });
  }

  get movables() {
    return this.scene.pieces.filter(movable);
  }

  piece(id: string) {
    return this.movables.find((p) => p.id === id) ?? null;
  }

  update(dt: number) {
    this.time += dt;
    const k = 1 - Math.pow(1 - EASE, dt * 60);
    for (const p of this.movables) {
      const g = this.goals.get(p.id)!;
      p.x += (g.x - p.x) * k;
      p.y += (g.y - p.y) * k;
      p.a = angleLerp(p.a, g.a, k);
    }

    this.light = trace(this.scene);
    let all = true;
    this.scene.targets.forEach((t, i) => {
      const s = this.targets[i];
      const hits = this.light.hits.get(t.id) ?? new Map();
      s.progress = progress(t, hits);
      s.shown += (s.progress - s.shown) * Math.min(1, dt * 7);
      const lit = isLit(t, hits);
      if (lit !== s.lit) {
        s.lit = lit;
        if (lit) s.pulse = 1;
        this.events.onTarget?.(i, lit);
      }
      s.pulse = Math.max(0, s.pulse - dt * 0.8);
      all &&= lit;
    });

    if (this.settleAt && this.time >= this.settleAt.time) {
      this.release(this.settleAt.id);
      this.settleAt = null;
    }

    this.solvedFor = all ? this.solvedFor + dt : 0;
    if (!this.solved && this.solvedFor >= HOLD) {
      this.solved = true;
      this.events.onSolved?.(true);
    } else if (this.solved && !all) {
      this.solved = false;
      this.events.onSolved?.(false);
    }

    for (const m of this.motes) {
      m.x += (m.vx + Math.sin(this.time * 0.4 + m.ph) * 3) * dt;
      m.y += m.vy * dt;
      if (m.y < -5) {
        m.y = ROOM.h + 5;
        m.x = Math.random() * ROOM.w;
      }
    }
  }

  /** What a pointer at `p` would grab: a piece's ends or corners turn it, its body moves it. */
  pick(p: Vec): Grab | null {
    let best: Grab | null = null;
    let bestD = GRAB;
    for (const piece of this.movables) {
      if (piece.kind === "prism") {
        for (const c of prismCorners(piece)) {
          const d = len(sub(p, c));
          if (d < bestD) {
            best = { id: piece.id, mode: "turn" };
            bestD = d;
          }
        }
        if (!best && insidePrism(piece, p)) best = { id: piece.id, mode: piece.move === "free" ? "move" : "turn" };
        continue;
      }
      const [a, b] = ends(piece);
      for (const e of [a, b]) {
        const d = len(sub(p, e));
        if (d < bestD) {
          best = { id: piece.id, mode: "turn" };
          bestD = d;
        }
      }
      const { d } = toSegment(p, a, b);
      if (d < bestD && best?.mode !== "turn") {
        best = { id: piece.id, mode: piece.move === "free" ? "move" : "turn" };
        bestD = d;
      }
    }
    return best;
  }

  pointerDown(p: Vec) {
    const grab = this.pick(p);
    if (!grab) return false;
    const goal = this.goals.get(grab.id)!;
    grab.offset = sub([goal.x, goal.y], p);
    grab.turnFrom = Math.atan2(p[1] - goal.y, p[0] - goal.x) - goal.a;
    this.drag = grab;
    this.selected = grab.id;
    return true;
  }

  pointerMove(p: Vec) {
    if (!this.drag) {
      this.hover = this.pick(p);
      return;
    }
    const goal = this.goals.get(this.drag.id)!;
    if (this.drag.mode === "move") {
      const q = add(p, this.drag.offset!);
      goal.x = clampX(q[0]);
      goal.y = clampY(q[1]);
    } else {
      goal.a = Math.atan2(p[1] - goal.y, p[0] - goal.x) - this.drag.turnFrom!;
    }
  }

  pointerUp() {
    if (this.drag) this.release(this.drag.id);
    this.drag = null;
  }

  /** Move a piece's goal directly (tests, hints). */
  setGoal(id: string, change: Partial<Goal>) {
    const g = this.goals.get(id);
    if (g) Object.assign(g, change);
  }

  /**
   * The player let go of a piece. If turning it a little (at most SETTLE) would light more
   * targets, ease it there: the light finds its way home. It never solves anything from afar.
   */
  release(id: string) {
    const goal = this.goals.get(id);
    const piece = this.piece(id);
    if (!goal || !piece) return;
    const lit = (a: number) => {
      const scene: Scene = {
        ...this.scene,
        pieces: this.scene.pieces.map((p) => {
          if (!movable(p)) return p;
          const g = this.goals.get(p.id)!;
          return { ...p, x: g.x, y: g.y, a: p.id === id ? a : g.a };
        }),
      };
      const { hits } = trace(scene);
      return scene.targets.filter((t) => isLit(t, hits.get(t.id) ?? new Map())).length;
    };
    const now = lit(goal.a);
    let best = { count: now, a: goal.a };
    for (let d = SETTLE_STEP; d <= SETTLE + 1e-9; d += SETTLE_STEP) {
      for (const a of [goal.a - d, goal.a + d]) {
        const count = lit(a);
        if (count > best.count) best = { count, a };
      }
      if (best.count > now) break; // the nearest angle that lights more wins
    }
    goal.a = best.a;
  }

  wheel(p: Vec, dy: number) {
    const grab = this.pick(p);
    if (!grab) return false;
    this.goals.get(grab.id)!.a += dy * 0.0025;
    return true;
  }

  /** Keyboard: Tab-like cycling with [ and ] or number keys, arrows move, Q/E turn. */
  key(key: string, shift: boolean) {
    const list = this.movables;
    if (list.length === 0) return false;
    const n = Number(key);
    if (n >= 1 && n <= list.length) return this.select(list[n - 1].id);
    if (key === "]" || key === "[") {
      const i = list.findIndex((p) => p.id === this.selected);
      return this.select(list[(i + (key === "]" ? 1 : list.length - 1)) % list.length].id);
    }
    const piece = this.selected ? this.piece(this.selected) : null;
    if (!piece) return false;
    const goal = this.goals.get(piece.id)!;
    const step = shift ? MOVE_STEP * 4 : MOVE_STEP;
    const turn = shift ? TURN_STEP * 5 : TURN_STEP;
    const moves: Record<string, Vec> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[key] && piece.move === "free") {
      goal.x = clampX(goal.x + moves[key][0]);
      goal.y = clampY(goal.y + moves[key][1]);
      return true;
    }
    const settleLater = () => (this.settleAt = { id: piece.id, time: this.time + KEY_SETTLE });
    if (key === "q" || key === "Q") return (goal.a -= turn), settleLater(), true;
    if (key === "e" || key === "E") return (goal.a += turn), settleLater(), true;
    return false;
  }

  private select(id: string) {
    this.selected = id;
    const i = this.movables.findIndex((p) => p.id === id);
    const piece = this.movables[i];
    const what =
      piece.kind === "prism" ? "prism" : piece.kind === "filter" ? `${piece.colors.join(" and ")} glass` : piece.kind === "splitter" ? "half mirror" : "mirror";
    this.events.onSay?.(`${what} ${i + 1} of ${this.movables.length} selected${piece.move === "turn" ? ", it can only turn" : ""}`);
    return true;
  }

  /** Put every piece where the level's solution has it (for checks and the "show me" hint). */
  solve() {
    for (const [id, change] of Object.entries(this.level.solution)) {
      const g = this.goals.get(id);
      if (g) Object.assign(g, change);
    }
  }

  reset() {
    this.load(this.level);
  }
}

const clampX = (x: number) => Math.max(ROOM.margin, Math.min(ROOM.w - ROOM.margin, x));
const clampY = (y: number) => Math.max(ROOM.margin, Math.min(ROOM.h - ROOM.margin, y));
