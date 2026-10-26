import type { InfoMap } from "@/shared/info-map";
import type { MeasureAlignment, SyncState } from "@/shared/sync";
import { createRng, smoothNoise } from "@/lib/utils/rng";

/** A believable automatic alignment: slight rubato drift plus pockets of doubt. */
export function buildMockAlignment(infoMap: InfoMap, seed: number): SyncState {
  const rng = createRng(seed * 17 + 3);
  const drift = smoothNoise(rng, 2);
  const doubt = smoothNoise(rng, 3);
  let t = 0.9; // recording begins after a short silence
  const auto: MeasureAlignment[] = infoMap.measures.map((m, i) => {
    const stretch = 1 + drift(i) * 0.06;
    const startSec = t;
    t += m.duration * stretch;
    const d = doubt(i) * 0.5 + 0.5; // 0–1
    let confidence = 97.5 - d * 8 + rng.range(-2, 2);
    // a few genuinely uncertain pockets (sustained / quiet passages)
    if ((i > 118 && i < 127) || (i > 296 && i < 306) || (i > 470 && i < 481)) confidence -= 34 + d * 14;
    if (i % 97 === 55 || i % 61 === 17) confidence -= 14 + d * 10;
    return { n: m.number, startSec, confidence: Math.round(Math.max(18, Math.min(99, confidence))) };
  });
  const averageConfidence = Math.round(auto.reduce((s, a) => s + a.confidence, 0) / auto.length);
  return { method: "chroma-dtw (prototype)", auto, manual: [], averageConfidence };
}
