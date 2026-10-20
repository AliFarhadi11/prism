import { PrismGame } from "@/components/PrismGame";
import { levels } from "@/game/levels";

// Reads `?p=` on each request: the page is tiny, so render it then rather than prerender.
export const instant = false;

/** `?p=3` opens puzzle three. In development, `&solve` shows its solution (for checking levels). */
export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const p = Number(params.p);
  const start = Number.isInteger(p) && p >= 1 && p <= levels.length ? p - 1 : 0;
  const solve = process.env.NODE_ENV !== "production" && "solve" in params;
  return <PrismGame start={start} solve={solve} />;
}
