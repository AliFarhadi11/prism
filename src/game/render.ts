// Drawing the room on a 2D canvas. Light is drawn additively ("lighter"), so colours that travel
// together add back up to white, and split light shows its true colour.
import type { Game } from "./engine.ts";
import { ROOM } from "./levels/helpers.ts";
import { colorOf, type Rgb } from "./light.ts";
import { allLamps, ends, insidePrism, prismCorners, type Piece, type Prism, type Segment } from "./optics.ts";
import { BAND_HUE, ROOM_COLORS, mixHue, rgba } from "./palette.ts";

/** `rotate`: the room is turned a quarter turn clockwise to fill a tall (portrait) screen. */
export type View = { scale: number; ox: number; oy: number; dpr: number; reducedMotion: boolean; rotate: boolean };

type Beam = { x0: number; y0: number; x1: number; y1: number; c: Rgb; w: number; inside: boolean };

/**
 * Rays that share a path (all of them, before a prism) are drawn once in their mixed colour:
 * a canvas stores 8 bits per channel, so 32 faint strokes would lose the colour.
 */
function beams(segs: Segment[]): Beam[] {
  const groups = new Map<string, { s: Segment; c: [number, number, number]; I: number; n: number }>();
  for (const s of segs) {
    const key = `${Math.round(s.x0)},${Math.round(s.y0)},${Math.round(s.x1)},${Math.round(s.y1)}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { s, c: [0, 0, 0], I: 0, n: 0 }));
    const c = colorOf(s.l);
    g.c = [g.c[0] + c[0] * s.I, g.c[1] + c[1] * s.I, g.c[2] + c[2] * s.I];
    g.I += s.I;
    g.n++;
  }
  return [...groups.values()].map(({ s, c, I, n }) => {
    const mean = c.map((v) => v / I);
    const peak = Math.max(...mean, 1e-6);
    // Split light is dimmer than the whole beam, but not 32 times dimmer, or the rainbow would vanish.
    return { x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1, c: mean.map((v) => v / peak) as unknown as Rgb, w: Math.pow(n / 32, 0.38) * (I / n), inside: s.inside };
  });
}

let grain: HTMLCanvasElement | null = null;
function grainTexture() {
  if (grain) return grain;
  grain = document.createElement("canvas");
  grain.width = grain.height = 220;
  const g = grain.getContext("2d")!;
  const img = g.createImageData(220, 220);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return grain;
}

const PASSES: Array<[number, number]> = [
  [26, 0.03],
  [9, 0.07],
  [2.4, 0.35],
  [1, 0.85],
];

export function draw(ctx: CanvasRenderingContext2D, game: Game, view: View) {
  const { scene, light } = game;
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  const bg = ctx.createRadialGradient(cw * 0.45, ch * 0.45, 0, cw * 0.5, ch * 0.5, Math.max(cw, ch) * 0.75);
  bg.addColorStop(0, ROOM_COLORS.center);
  bg.addColorStop(1, ROOM_COLORS.edge);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cw, ch);

  const s = view.dpr * view.scale;
  if (view.rotate) ctx.setTransform(0, s, -s, 0, view.dpr * (view.ox + ROOM.h * view.scale), view.dpr * view.oy);
  else ctx.setTransform(s, 0, 0, s, view.dpr * view.ox, view.dpr * view.oy);

  // A table of faint dots, for a sense of space.
  ctx.fillStyle = ROOM_COLORS.dots;
  for (let x = 40; x < ROOM.w; x += 40) for (let y = 40; y < ROOM.h; y += 40) ctx.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);

  for (const p of scene.pieces) if (p.kind === "wall") drawWall(ctx, p);
  for (const p of scene.pieces) if (p.kind === "prism") drawGlassBody(ctx, p);

  // Light.
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  const merged = beams(light.segments);
  for (const [w, a] of PASSES) {
    ctx.lineWidth = w;
    for (const b of merged) {
      ctx.strokeStyle = rgba(b.c, a * b.w * (b.inside ? 0.75 : 1));
      ctx.beginPath();
      ctx.moveTo(b.x0, b.y0);
      ctx.lineTo(b.x1, b.y1);
      ctx.stroke();
    }
  }
  for (const sp of light.sparks) {
    const g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 16);
    g.addColorStop(0, rgba(colorOf(sp.l).map((v) => v / 3) as unknown as Rgb, 0.05 * sp.I));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(sp.x - 16, sp.y - 16, 32, 32);
  }

  if (!view.reducedMotion) drawDust(ctx, game, light.segments);
  drawTargetGlow(ctx, game);

  ctx.globalCompositeOperation = "source-over";
  drawTargets(ctx, game);
  for (const p of scene.pieces) if (p.kind === "prism") drawGlassEdges(ctx, p, game);
  for (const lamp of allLamps(scene)) drawLamp(ctx, lamp.x, lamp.y, lamp.a);
  for (const p of scene.pieces) {
    if (p.kind === "mirror") drawMirror(ctx, p, game);
    if (p.kind === "filter") drawFilter(ctx, p, game);
    if (p.kind === "splitter") drawSplitter(ctx, p, game);
  }

  // Film grain over everything.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 0.045;
  ctx.globalCompositeOperation = "overlay";
  const gx = view.reducedMotion ? 0 : (Math.random() * 220) | 0;
  const gy = view.reducedMotion ? 0 : (Math.random() * 220) | 0;
  ctx.fillStyle = ctx.createPattern(grainTexture(), "repeat")!;
  ctx.translate(-gx, -gy);
  ctx.fillRect(gx, gy, cw, ch);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

const isActive = (game: Game, id: string) => game.touch || game.selected === id || game.hover?.id === id || game.drag?.id === id;

function drawWall(ctx: CanvasRenderingContext2D, w: Extract<Piece, { kind: "wall" }>) {
  ctx.lineCap = "round";
  ctx.strokeStyle = ROOM_COLORS.wall;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(w.x0, w.y0);
  ctx.lineTo(w.x1, w.y1);
  ctx.stroke();
  ctx.strokeStyle = ROOM_COLORS.wallEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function prismPath(ctx: CanvasRenderingContext2D, p: Prism) {
  const c = prismCorners(p);
  ctx.beginPath();
  c.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function drawGlassBody(ctx: CanvasRenderingContext2D, p: Prism) {
  const c = prismCorners(p);
  const g = ctx.createLinearGradient(c[2][0], c[2][1], c[1][0], c[0][1]);
  g.addColorStop(0, "rgba(180,200,255,0.05)");
  g.addColorStop(1, "rgba(255,255,255,0.11)");
  prismPath(ctx, p);
  ctx.fillStyle = g;
  ctx.fill();
}

function drawGlassEdges(ctx: CanvasRenderingContext2D, p: Prism, game: Game) {
  ctx.globalCompositeOperation = "lighter";
  prismPath(ctx, p);
  ctx.strokeStyle = ROOM_COLORS.glassEdge;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
  if (game.level.scene.targets.length === 0) return; // the title room: nothing to handle
  if (p.move !== "fixed" && isActive(game, p.id)) for (const [x, y] of prismCorners(p)) handle(ctx, x, y);
  if (p.move === "turn") pivot(ctx, p.x, p.y);
}

function drawMirror(ctx: CanvasRenderingContext2D, m: Extract<Piece, { kind: "mirror" }>, game: Game) {
  const [a, b] = ends(m);
  ctx.lineCap = "round";
  ctx.strokeStyle = ROOM_COLORS.mirrorBack;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
  ROOM_COLORS.mirrorStops.forEach((c, i) => g.addColorStop([0, 0.45, 0.55, 1][i], c));
  ctx.strokeStyle = g;
  ctx.lineWidth = 3;
  ctx.stroke();
  if (m.move !== "fixed" && isActive(game, m.id)) {
    handle(ctx, a[0], a[1]);
    handle(ctx, b[0], b[1]);
  }
  if (m.move === "turn") pivot(ctx, m.x, m.y);
}

function drawFilter(ctx: CanvasRenderingContext2D, f: Extract<Piece, { kind: "filter" }>, game: Game) {
  const [a, b] = ends(f);
  const hue = mixHue(f.colors);
  ctx.lineCap = "butt";
  ctx.strokeStyle = rgba(hue, 0.28);
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = rgba(hue, 0.75);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
  if (f.move !== "fixed" && isActive(game, f.id)) {
    handle(ctx, a[0], a[1]);
    handle(ctx, b[0], b[1]);
  }
  if (f.move === "turn") pivot(ctx, f.x, f.y);
}

/** Half-silvered glass: a pale pane with a silver hairline, broken like a half-tone. */
function drawSplitter(ctx: CanvasRenderingContext2D, m: Extract<Piece, { kind: "splitter" }>, game: Game) {
  const [a, b] = ends(m);
  ctx.lineCap = "butt";
  ctx.strokeStyle = "rgba(200,215,255,0.14)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = "rgba(240,244,252,0.85)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);
  if (m.move !== "fixed" && isActive(game, m.id)) {
    handle(ctx, a[0], a[1]);
    handle(ctx, b[0], b[1]);
  }
  if (m.move === "turn") pivot(ctx, m.x, m.y);
}

function handle(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = "rgba(233,230,223,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.stroke();
}

/** A small pin: this piece turns in place but cannot be moved. */
function pivot(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = ROOM_COLORS.paper;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.arc(x, y, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawLamp(ctx: CanvasRenderingContext2D, x: number, y: number, a: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = ROOM_COLORS.lampBody;
  ctx.beginPath();
  ctx.roundRect(-52, -13, 52, 26, 6);
  ctx.fill();
  ctx.strokeStyle = ROOM_COLORS.lampEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, 34);
  g.addColorStop(0, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - 34, y - 34, 68, 68);
  ctx.globalCompositeOperation = "source-over";
}

function drawTargetGlow(ctx: CanvasRenderingContext2D, game: Game) {
  game.scene.targets.forEach((t, i) => {
    const s = game.targets[i];
    const c = mixHue(t.colors);
    const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, 72);
    g.addColorStop(0, rgba(c, 0.34 * s.shown));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(t.x - 72, t.y - 72, 144, 144);
    if (s.pulse > 0) {
      ctx.strokeStyle = rgba(c, 0.5 * s.pulse);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r + (1 - s.pulse) * 64, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}

function drawTargets(ctx: CanvasRenderingContext2D, game: Game) {
  game.scene.targets.forEach((t, i) => {
    const s = game.targets[i];
    ctx.fillStyle = ROOM_COLORS.targetHole;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    // The ring shows the colours it asks for: one arc per colour.
    const n = t.colors.length;
    t.colors.forEach((band, k) => {
      const from = -Math.PI / 2 + (k * 2 * Math.PI) / n;
      ctx.strokeStyle = rgba(BAND_HUE[band], 0.4 + 0.6 * s.shown);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, from + 0.08, from + (2 * Math.PI) / n - 0.08);
      ctx.stroke();
    });
    ctx.fillStyle = rgba(mixHue(t.colors), 0.15 + 0.85 * s.shown);
    ctx.beginPath();
    ctx.arc(t.x, t.y, 4 + 6 * s.shown, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Dust, visible only where it drifts through a beam. */
function drawDust(ctx: CanvasRenderingContext2D, game: Game, segs: Segment[]) {
  const strong = segs.filter((s) => s.I > 0.2);
  for (const m of game.motes) {
    let best = 18;
    let col: Rgb | null = null;
    let I = 0;
    for (const s of strong) {
      const ax = s.x1 - s.x0;
      const ay = s.y1 - s.y0;
      const l2 = ax * ax + ay * ay || 1;
      const t = Math.max(0, Math.min(1, ((m.x - s.x0) * ax + (m.y - s.y0) * ay) / l2));
      const d = Math.hypot(m.x - (s.x0 + ax * t), m.y - (s.y0 + ay * t));
      if (d < best) {
        best = d;
        col = colorOf(s.l);
        I = s.I;
      }
    }
    const lit = col ? (1 - best / 18) * I : 0;
    ctx.fillStyle = col ? rgba(col.map((c) => Math.min(1, c / 2) * 0.6 + 0.4) as unknown as Rgb, 0.05 + lit * 0.9) : "rgba(233,230,223,0.04)";
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.s * (1 + lit), 0, Math.PI * 2);
    ctx.fill();
  }
}

export { insidePrism };
