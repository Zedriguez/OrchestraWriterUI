import { createRng, smoothNoise } from "@/lib/utils/rng";

/** Deterministic mock waveform peaks (0–1) for a recording. */
export function buildWaveform(seed: number, bars = 420): number[] {
  const rng = createRng(seed * 977 + 13);
  const env = smoothNoise(rng, 3);
  const fine = smoothNoise(rng, 1);
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const p = i / bars;
    const swell = Math.exp(-((p - 0.33) ** 2) / 0.004) * 0.4 + Math.exp(-((p - 0.86) ** 2) / 0.006) * 0.5;
    const base = 0.18 + (env(i) * 0.5 + 0.5) * 0.45 + swell;
    const jitter = (fine(i * 3.7) * 0.5 + 0.5) * 0.35 + rng.range(0, 0.2);
    out.push(Math.min(1, Math.max(0.04, base * (0.65 + jitter))));
  }
  return out;
}
