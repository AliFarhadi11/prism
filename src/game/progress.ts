// Which puzzles are solved, kept in localStorage and readable from React without hydration
// mismatches (useSyncExternalStore with an empty server snapshot).

const KEY = "prism.solved";
const listeners = new Set<() => void>();
let cache: string | null = null;

function read(): string {
  if (cache !== null) return cache;
  try {
    cache = localStorage.getItem(KEY) ?? "[]";
  } catch {
    cache = "[]";
  }
  return cache;
}

export const progressStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: read,
  getServerSnapshot: () => "[]",
};

export const solvedFrom = (snapshot: string): number[] => {
  try {
    const list = JSON.parse(snapshot);
    return Array.isArray(list) ? list.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
};

export function markSolved(index: number) {
  const set = new Set(solvedFrom(read()));
  if (set.has(index)) return;
  set.add(index);
  cache = JSON.stringify([...set].sort((a, b) => a - b));
  try {
    localStorage.setItem(KEY, cache);
  } catch {
    // Private mode or storage blocked: progress lasts for this visit only.
  }
  for (const l of listeners) l();
}
