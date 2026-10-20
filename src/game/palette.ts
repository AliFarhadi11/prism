// The game's colours, in one place. Light carries its own colour (light.ts); these are the room,
// the materials and the colours targets ask for.
import type { BandName } from "./light.ts";
import type { Rgb } from "./light.ts";

export const ROOM_COLORS = {
  center: "#11131b",
  edge: "#050609",
  dots: "rgba(233,230,223,0.05)",
  paper: "#e9e6df",
  wall: "#1b1e27",
  wallEdge: "rgba(233,230,223,0.16)",
  lampBody: "#16181f",
  lampEdge: "rgba(233,230,223,0.18)",
  mirrorBack: "#2a2d36",
  mirrorStops: ["#9aa3b5", "#f4f6fb", "#cfd5e2", "#7d8597"],
  glassEdge: "rgba(220,230,255,0.35)",
  targetHole: "rgba(10,11,16,0.88)",
} as const;

/** The colour a target shows for each band it asks for. */
export const BAND_HUE: Record<BandName, Rgb> = {
  red: [1, 0.32, 0.25],
  green: [0.4, 1, 0.45],
  blue: [0.35, 0.5, 1],
};

export const mixHue = (bands: BandName[]): Rgb => {
  const c = bands.reduce<[number, number, number]>((s, b) => [s[0] + BAND_HUE[b][0], s[1] + BAND_HUE[b][1], s[2] + BAND_HUE[b][2]], [0, 0, 0]);
  const peak = Math.max(...c, 1e-6);
  return [c[0] / peak, c[1] / peak, c[2] / peak];
};

export const rgba = (c: Rgb, a: number) =>
  `rgba(${Math.round(Math.min(1, Math.max(0, c[0])) * 255)},${Math.round(Math.min(1, Math.max(0, c[1])) * 255)},${Math.round(Math.min(1, Math.max(0, c[2])) * 255)},${Math.max(0, Math.min(1, a))})`;
