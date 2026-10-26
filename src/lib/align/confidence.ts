import { localCost, type DtwResult } from "./dtw";
import { PITCH_CLASSES } from "./chroma";

/**
 * Per-measure confidence (0–100) for a chroma-DTW alignment.
 *
 * Distinctiveness: the mean local cost of the warping path around the
 * measure's start, compared with what the same score frames cost against
 * nearby-but-wrong recording frames. A boundary whose path cost is much lower
 * than its alternatives is pinned down; one whose alternatives cost the same
 * (sustained chords, repeated material) is not.
 *
 * Penalties:
 * - many vertical/horizontal path moves near the boundary (the path had to
 *   stretch toward slope ½ or 2);
 * - tempo inconsistency: a misplaced boundary makes the measure before it
 *   longer and the one after it shorter (or the reverse), so their tempos
 *   disagree; smooth rubato changes both together and is not penalized;
 * - rests: a bar where the score is (nearly) silent has no harmony to match,
 *   so its start is a guess.
 *
 * Band edges for display live in src/shared/sync.ts (CONFIDENCE_BANDS).
 */

export interface ConfidenceInput {
  path: DtwResult;
  /** score chroma frames (frame-major, 12 per frame) */
  scoreFrames: Float32Array;
  /** raw score energy per score frame */
  scoreEnergy: Float32Array;
  /** recording chroma frames */
  audioFrames: Float32Array;
  audioN: number;
  /** score seconds per score frame */
  scoreHopSec: number;
  /** recording seconds per recording frame */
  audioHopSec: number;
  /** score-time start and duration of each measure */
  measures: Array<{ startTime: number; duration: number }>;
  /** aligned measure starts, recording seconds (same order as measures) */
  startsSec: number[];
}

/** Tunables (measured on fixtures/scores/orchestra-demo + its warped recording). */
export const CONFIDENCE_TUNING = {
  /** distinctiveness (1 − pathCost/altCost) at which confidence starts above 0 */
  distinctLow: 0.1,
  /** distinctiveness that maps to 100 */
  distinctHigh: 0.45,
  /** fraction of non-diagonal moves near a boundary tolerated before penalizing */
  slackMoves: 0.35,
  /** score energy below this fraction of the median measure counts as a rest */
  restEnergy: 0.06,
  /** multiplier for rest measures */
  restFactor: 0.45,
  /** relative tempo difference between the two measures around a boundary tolerated before penalizing */
  tempoSlack: 0.1,
  /** difference beyond the slack that takes the full tempo penalty */
  tempoSpan: 0.4,
};

export function measureConfidences(input: ConfidenceInput): number[] {
  const { path, scoreFrames, scoreEnergy, audioFrames, audioN, scoreHopSec, audioHopSec, measures, startsSec } = input;
  const T = CONFIDENCE_TUNING;
  const nScore = scoreEnergy.length;

  // path cells per score row
  const firstCell = new Int32Array(nScore).fill(-1);
  const lastCell = new Int32Array(nScore).fill(-1);
  for (let k = 0; k < path.rows.length; k++) {
    const r = path.rows[k];
    if (firstCell[r] < 0) firstCell[r] = k;
    lastCell[r] = k;
  }

  // measure energies → rest detection
  const measureEnergy = measures.map((m) => {
    const r0 = Math.max(0, Math.round(m.startTime / scoreHopSec));
    const r1 = Math.min(nScore - 1, Math.max(r0, Math.round((m.startTime + m.duration) / scoreHopSec) - 1));
    let e = 0;
    for (let r = r0; r <= r1; r++) e += scoreEnergy[r];
    return e / (r1 - r0 + 1);
  });
  const sortedEnergy = [...measureEnergy].sort((a, b) => a - b);
  const medianEnergy = sortedEnergy[Math.floor(sortedEnergy.length / 2)] || 1;

  // recording/score duration ratio per measure (local tempo); the last measure has none
  const ratios = measures.map((m, k) =>
    k + 1 < measures.length && m.duration > 0 ? (startsSec[k + 1] - startsSec[k]) / m.duration : NaN,
  );
  // A boundary misplaced by δ lengthens one neighbor and shortens the other, so the two
  // measures around it disagree on tempo; smooth rubato moves both the same way.
  const tempoDeviation = (k: number): number => {
    const a = ratios[k - 1];
    const b = ratios[k];
    if (!(a > 0) || !(b > 0)) return 0;
    return Math.abs(a - b) / ((a + b) / 2);
  };

  const excludeCols = Math.max(3, Math.round(0.45 / audioHopSec));
  const searchCols = Math.max(excludeCols + 4, Math.round(2.5 / audioHopSec));

  return measures.map((m, idx) => {
    const center = m.startTime / scoreHopSec;
    const measureRows = m.duration / scoreHopSec;
    const half = Math.max(2, Math.min(8, Math.round(measureRows * 0.35)));
    const r0 = Math.max(0, Math.floor(center) - half);
    const r1 = Math.min(nScore - 1, Math.ceil(center) + half);
    const k0 = firstCell[r0];
    const k1 = lastCell[r1];
    if (k0 < 0 || k1 < 0) return 0;

    // path cost around the boundary
    let pathCost = 0;
    for (let k = k0; k <= k1; k++) pathCost += path.costs[k];
    pathCost /= k1 - k0 + 1;

    // alternative cost: the same score rows against recording frames away from the path
    let altCost = 0;
    let altCount = 0;
    for (let r = r0; r <= r1; r++) {
      const col = path.cols[firstCell[r]];
      for (let d = excludeCols; d <= searchCols; d += 2) {
        for (const j of [col - d, col + d]) {
          if (j < 0 || j >= audioN) continue;
          altCost += localCost(scoreFrames, r, audioFrames, j, PITCH_CLASSES);
          altCount++;
        }
      }
    }
    altCost = altCount > 0 ? altCost / altCount : pathCost;
    const distinct = altCost > 1e-9 ? 1 - pathCost / altCost : 0;
    let conf = clamp01((distinct - T.distinctLow) / (T.distinctHigh - T.distinctLow));

    // stretched path near the boundary
    let offDiagonal = 0;
    for (let k = k0 + 1; k <= k1; k++) {
      if (path.rows[k] === path.rows[k - 1] || path.cols[k] === path.cols[k - 1]) offDiagonal++;
    }
    const moves = Math.max(1, k1 - k0);
    const frac = offDiagonal / moves;
    if (frac > T.slackMoves) conf *= 1 - Math.min(0.6, (frac - T.slackMoves) / 0.5);

    // the boundary disagrees with the local tempo
    const dev = tempoDeviation(idx);
    if (dev > T.tempoSlack) conf *= 1 - Math.min(0.6, (dev - T.tempoSlack) / T.tempoSpan);

    // rests: nothing to match
    if (measureEnergy[idx] < T.restEnergy * medianEnergy) conf *= T.restFactor;

    return Math.round(100 * clamp01(conf));
  });
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
