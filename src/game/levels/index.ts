import { aroundTheWall } from "./aroundTheWall.ts";
import { colouredGlass } from "./colouredGlass.ts";
import { firstLight } from "./firstLight.ts";
import { fullSpectrum } from "./fullSpectrum.ts";
import type { Level } from "./helpers.ts";
import { magenta } from "./magenta.ts";
import { newtonsSlit } from "./newtonsSlit.ts";
import { spectrum } from "./spectrum.ts";
import { threeColours } from "./threeColours.ts";
import { twoWays } from "./twoWays.ts";

/** The puzzles, in order: each one adds one idea. */
export const levels: Level[] = [firstLight, aroundTheWall, spectrum, threeColours, colouredGlass, twoWays, magenta, newtonsSlit, fullSpectrum];
