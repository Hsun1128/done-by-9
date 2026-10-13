/**
 * Reads `?seed=123` from a query string so a specific evening can be replayed
 * or shared. Returns null for anything that is not a non-negative safe integer.
 */
export function parseSeed(search: string): number | null {
  const raw = new URLSearchParams(search).get('seed');
  if (raw === null || !/^\d{1,10}$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

/** A fresh unsigned 32-bit seed from the browser's CSPRNG. */
export function randomSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] ?? 1;
}

/** Yields the URL seed first (then seed+1, seed+2 … for replays), or random seeds. */
export function createSeedSource(search: string): () => number {
  let next = parseSeed(search);
  return () => {
    if (next === null) return randomSeed();
    const current = next;
    next += 1;
    return current;
  };
}
