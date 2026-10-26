/** Deterministic PRNG (mulberry32) so mock data is stable across renders. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min: number, max: number) => min + next() * (max - min),
    int: (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
    pick: <T>(arr: readonly T[]) => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
  };
}

export type Rng = ReturnType<typeof createRng>;

/** Smooth 1-D noise: a sum of sines with random phases, in [-1, 1]. */
export function smoothNoise(rng: Rng, octaves = 3) {
  const comps = Array.from({ length: octaves }, (_, i) => ({
    freq: (1 / (7 + i * 11)) * rng.range(0.7, 1.4),
    phase: rng.range(0, Math.PI * 2),
    amp: 1 / (i + 1),
  }));
  const norm = comps.reduce((s, c) => s + c.amp, 0);
  return (x: number) => comps.reduce((s, c) => s + Math.sin(x * c.freq * Math.PI * 2 + c.phase) * c.amp, 0) / norm;
}
