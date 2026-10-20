// White light as a set of wavelengths, their colours, and how glass bends them.

/** 32 wavelengths across the visible spectrum, in nanometres. */
export const LAMBDAS: readonly number[] = Array.from({ length: 32 }, (_, i) => 400 + (i * 300) / 31);

/**
 * Refractive index of the prism glass (Cauchy's equation). Real crown glass has B ≈ 4200 nm²;
 * Prism uses 30000 so the rainbow opens wide enough to play with. Short (blue) light bends more.
 */
export const nGlass = (l: number) => 1.5 + 30000 / (l * l);

export type Rgb = readonly [number, number, number];

/** Approximate colour of a wavelength (0–1 per channel), dimmed at the ends of the spectrum. */
export function spectrum(l: number): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  if (l < 440) {
    r = -(l - 440) / 60;
    b = 1;
  } else if (l < 490) {
    g = (l - 440) / 50;
    b = 1;
  } else if (l < 510) {
    g = 1;
    b = -(l - 510) / 20;
  } else if (l < 580) {
    r = (l - 510) / 70;
    g = 1;
  } else if (l < 645) {
    r = 1;
    g = -(l - 645) / 65;
  } else r = 1;
  const edge = l < 420 ? 0.4 + (0.6 * (l - 400)) / 20 : l > 680 ? 0.4 + (0.6 * (700 - l)) / 20 : 1;
  return [r * edge, g * edge, b * edge];
}

// Per-channel gains so the mean colour over all wavelengths is neutral white.
const SUM = LAMBDAS.reduce<[number, number, number]>((s, l) => {
  const c = spectrum(l);
  return [s[0] + c[0], s[1] + c[1], s[2] + c[2]];
}, [0, 0, 0]);
const GAIN = SUM.map((v) => LAMBDAS.length / v);

/** Colour of a wavelength, weighted so the mean over LAMBDAS is exactly [1, 1, 1]. */
export const colorOf = (l: number): Rgb => {
  const c = spectrum(l);
  return [c[0] * GAIN[0], c[1] * GAIN[1], c[2] * GAIN[2]];
};

/** The three colours targets ask for. Additive mixes (magenta, yellow, cyan, white) combine them. */
export const BANDS = {
  red: { from: 615, to: 700 },
  green: { from: 510, to: 560 },
  blue: { from: 425, to: 465 },
} as const;

export type BandName = keyof typeof BANDS;
export const BAND_NAMES = Object.keys(BANDS) as BandName[];

export const inBand = (l: number, band: BandName) => l >= BANDS[band].from && l <= BANDS[band].to;

/** What coloured glass lets through: broader than the target bands, as real filters are. */
export const FILTER_PASS: Record<BandName, { from: number; to: number }> = {
  red: { from: 590, to: 700 },
  green: { from: 490, to: 585 },
  blue: { from: 400, to: 490 },
};
