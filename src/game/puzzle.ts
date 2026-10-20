// When a target counts as lit, and when a puzzle is solved.
import { BAND_NAMES, LAMBDAS, inBand, type BandName } from "./light.ts";
import { trace, type Scene, type Target } from "./optics.ts";

/** A target lights when each of its colours arrives at least this strongly (a split beam carries about half)… */
export const ENOUGH = 0.35;
/** …and no other colour arrives more than this (white poured on a red target does not count). */
export const STRAY = 0.25;

/** Share (0–1) of a band's wavelengths that arrive, each counted up to full strength. */
export function bandEnergy(hits: Map<number, number>, band: BandName) {
  const ls = LAMBDAS.filter((l) => inBand(l, band));
  return ls.reduce((s, l) => s + Math.min(1, hits.get(l) ?? 0), 0) / ls.length;
}

export function isLit(target: Target, hits: Map<number, number>) {
  return BAND_NAMES.every((band) => {
    const e = bandEnergy(hits, band);
    return target.colors.includes(band) ? e >= ENOUGH : e <= STRAY;
  });
}

/** How close a target is (0–1): the weakest of its colours, spoiled by stray ones. */
export function progress(target: Target, hits: Map<number, number>) {
  const wanted = Math.min(...target.colors.map((b) => bandEnergy(hits, b)));
  const stray = Math.max(0, ...BAND_NAMES.filter((b) => !target.colors.includes(b)).map((b) => bandEnergy(hits, b)));
  return Math.max(0, Math.min(1, wanted / ENOUGH) - Math.max(0, stray - STRAY) * 2);
}

export function isSolved(scene: Scene) {
  const { hits } = trace(scene);
  return scene.targets.every((t) => isLit(t, hits.get(t.id) ?? new Map()));
}
