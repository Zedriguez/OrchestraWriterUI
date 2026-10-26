/**
 * Score ↔ audio alignment at the measure level. Two clocks exist: score time
 * (from the info map) and recording time (the MP3). Name variables by which.
 */

export interface MeasureAlignment {
  /** 1-based measure number */
  n: number;
  /** seconds in the recording */
  startSec: number;
  /** 0–100 */
  confidence: number;
}

export interface ManualMarker {
  id: string;
  measure: number;
  /** seconds in the recording */
  startSec: number;
  createdAt: string;
}

export interface SyncState {
  method: string;
  auto: MeasureAlignment[];
  manual: ManualMarker[];
  /** average confidence 0–100 over all measures, from the auto pass */
  averageConfidence: number;
}

export type ConfidenceBandId = "high" | "mid" | "low";

export interface ConfidenceBand {
  id: ConfidenceBandId;
  /** inclusive lower bound */
  min: number;
  label: string;
  description: string;
  token: string;
}

/** Band edges live here only; the legend and the "Next uncertain" button read from this. */
export const CONFIDENCE_BANDS: ConfidenceBand[] = [
  { id: "high", min: 90, label: "Confident", description: "90–100%", token: "var(--conf-high)" },
  { id: "mid", min: 60, label: "Check", description: "60–89%", token: "var(--conf-mid)" },
  { id: "low", min: 0, label: "Uncertain", description: "below 60%", token: "var(--conf-low)" },
];

export const UNCERTAIN_THRESHOLD = 90;

export function confidenceBand(confidence: number): ConfidenceBand {
  for (const band of CONFIDENCE_BANDS) {
    if (confidence >= band.min) return band;
  }
  return CONFIDENCE_BANDS[CONFIDENCE_BANDS.length - 1];
}

/**
 * Merge manual markers over the automatic alignment. Manual wins; the result
 * stays monotonic. Measures between two manual markers are re-timed
 * proportionally so a single correction fixes its neighborhood.
 */
export function mergeAlignment(auto: MeasureAlignment[], manual: ManualMarker[]): MeasureAlignment[] {
  if (manual.length === 0) return auto;
  const byMeasure = new Map<number, ManualMarker>();
  for (const m of manual) byMeasure.set(m.measure, m);

  const result = auto.map((a) => ({ ...a }));
  const anchors = [...byMeasure.values()].sort((a, b) => a.measure - b.measure);

  for (const anchor of anchors) {
    const idx = result.findIndex((r) => r.n === anchor.measure);
    if (idx === -1) continue;
    result[idx] = { ...result[idx], startSec: anchor.startSec, confidence: 100 };
  }

  // Re-time the stretches between anchors (and before the first / after the last) proportionally.
  const anchorIdx = anchors.map((a) => result.findIndex((r) => r.n === a.measure)).filter((i) => i >= 0);
  const stretch = (from: number, to: number) => {
    const a0 = auto[from].startSec;
    const a1 = auto[to].startSec;
    const r0 = result[from].startSec;
    const r1 = result[to].startSec;
    const span = a1 - a0 || 1;
    for (let i = from + 1; i < to; i++) {
      const t = (auto[i].startSec - a0) / span;
      result[i] = { ...result[i], startSec: r0 + t * (r1 - r0) };
    }
  };
  for (let k = 0; k < anchorIdx.length - 1; k++) stretch(anchorIdx[k], anchorIdx[k + 1]);
  if (anchorIdx.length > 0) {
    const first = anchorIdx[0];
    const delta = result[first].startSec - auto[first].startSec;
    for (let i = 0; i < first; i++) result[i] = { ...result[i], startSec: Math.max(0, auto[i].startSec + delta) };
    const last = anchorIdx[anchorIdx.length - 1];
    const deltaLast = result[last].startSec - auto[last].startSec;
    for (let i = last + 1; i < result.length; i++) result[i] = { ...result[i], startSec: auto[i].startSec + deltaLast };
  }

  // Enforce monotonic order.
  for (let i = 1; i < result.length; i++) {
    if (result[i].startSec < result[i - 1].startSec + 0.01) {
      result[i] = { ...result[i], startSec: result[i - 1].startSec + 0.01 };
    }
  }
  return result;
}

/** Map a recording time to a measure number using the merged alignment. */
export function measureAtRecordingTime(aligned: MeasureAlignment[], t: number): number {
  if (aligned.length === 0) return 1;
  let lo = 0;
  let hi = aligned.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (aligned[mid].startSec <= t) lo = mid;
    else hi = mid - 1;
  }
  return aligned[lo].n;
}

/* ------------------------------------------------------------------ */
/* Alignment contract (see .claude/skills/score-audio-alignment)        */
/* ------------------------------------------------------------------ */

/** Mono PCM of the recording, as decoded by the browser. */
export interface AlignAudio {
  sampleRate: number;
  samples: Float32Array;
  durationSec: number;
}

export type AlignProgress = (progress: number, message: string) => void;

/**
 * align(infoMap, audio) -> { measures: [{ n, startSec, confidence }], method }.
 * Implementations live in src/lib/align/. Manual markers are merged separately
 * with mergeAlignment(); the aligner never sees them.
 */
export interface Aligner {
  readonly method: string;
  align(infoMap: import("./info-map").InfoMap, audio: AlignAudio, onProgress?: AlignProgress, signal?: AbortSignal): Promise<SyncState>;
}
