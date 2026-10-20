// When a target counts as lit, and when a puzzle is solved.
import { BAND_NAMES, LAMBDAS, inBand, type BandName } from "./light.ts";
import { trace, type Scene, type Target } from "./optics.ts";

/**
 * A target lights when each of its colours arrives at least this strongly. A quarter-strength
 * beam (after a half mirror and a few surfaces) still qualifies.
 */
export const ENOUGH = 0.15;
/**
 * Purity: any other colour may arrive at most this fraction of the weakest wanted colour. White
 * poured on a red target fails at any strength; a faint stray edge of a neighbour is forgiven.
 */
export const PURITY = 0.3;

/** Share (0–1) of a band's wavelengths that arrive, each counted up to full strength. */
export function bandEnergy(hits: Map<number, number>, band: BandName) {
  const ls = LAMBDAS.filter((l) => inBand(l, band));
  return ls.reduce((s, l) => s + Math.min(1, hits.get(l) ?? 0), 0) / ls.length;
}

const wanted = (target: Target, hits: Map<number, number>) => Math.min(...target.colors.map((b) => bandEnergy(hits, b)));
const stray = (target: Target, hits: Map<number, number>) =>
  Math.max(0, ...BAND_NAMES.filter((b) => !target.colors.includes(b)).map((b) => bandEnergy(hits, b)));

export function isLit(target: Target, hits: Map<number, number>) {
  const w = wanted(target, hits);
  return w >= ENOUGH && stray(target, hits) <= PURITY * w;
}

/** How close a target is (0–1), for its glow and hum: wanted light, dimmed when impure. */
export function progress(target: Target, hits: Map<number, number>) {
  const w = wanted(target, hits);
  const pure = stray(target, hits) <= PURITY * w;
  return Math.max(0, Math.min(1, w / (ENOUGH * 2))) * (pure ? 1 : 0.35);
}

export function isSolved(scene: Scene) {
  const { hits } = trace(scene);
  return scene.targets.every((t) => isLit(t, hits.get(t.id) ?? new Map()));
}
