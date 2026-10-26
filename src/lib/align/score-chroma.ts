import { BRIGHTNESS_LADDER } from "@/shared/dynamics";
import type { InfoMap } from "@/shared/info-map";
import { PITCH_CLASSES, compressAndNormalize, type ChromaFeatures } from "./chroma";

/**
 * Chroma "rendered" from the info map in *score* time. Frame i is centered at
 * i · hopSec score seconds and integrates every sounding note over a
 * triangular window of ±hopSec (the same shape the audio STFT sees). Each note
 * adds its pitch class plus a little of its 3rd and 5th harmonics (a fifth and
 * a major third above), weighted by the written dynamic.
 *
 * Pitch is the written pitch from the info map; transposing instruments
 * therefore contribute at their written pitch class (MVP limitation).
 */

/** relative power of the harmonics that land on other pitch classes */
const HARMONICS: Array<[semitones: number, weight: number]> = [
  [0, 1],
  [7, 0.3], // 3rd harmonic
  [4, 0.12], // 5th harmonic
];

export interface ScoreChromaOptions {
  /** score seconds between frame centers */
  hopSec: number;
  /** number of frames (default: enough to cover infoMap.duration) */
  n?: number;
  /** semitones from written to sounding pitch per part id (B♭ clarinet: -2) */
  transpose?: Record<string, number>;
}

/** G(u) = ∫₀ᵘ (1 − |x|) dx, the antiderivative of the unit triangle. */
function triArea(u: number): number {
  const c = Math.max(-1, Math.min(1, u));
  return c - (c * Math.abs(c)) / 2;
}

export function scoreChroma(infoMap: InfoMap, options: ScoreChromaOptions): ChromaFeatures {
  const hop = options.hopSec;
  if (!(hop > 0)) throw new Error("scoreChroma: hopSec must be positive");
  const n = options.n ?? Math.floor(infoMap.duration / hop) + 1;
  const raw = new Float32Array(n * PITCH_CLASSES);
  const energy = new Float32Array(n);

  for (const inst of infoMap.instruments) {
    const shift = options.transpose?.[inst.id] ?? 0;
    for (const note of inst.notes) {
      if (!(note.duration > 0)) continue;
      const t0 = note.time;
      const t1 = note.time + note.duration;
      const level = BRIGHTNESS_LADDER[note.dynamics];
      const w = level * level;
      const pc = (((note.pitch + shift) % 12) + 12) % 12;
      const i0 = Math.max(0, Math.ceil((t0 - hop) / hop));
      const i1 = Math.min(n - 1, Math.floor((t1 + hop) / hop));
      for (let i = i0; i <= i1; i++) {
        const c = i * hop;
        const overlap = triArea((t1 - c) / hop) - triArea((t0 - c) / hop);
        if (overlap <= 0) continue;
        const amount = overlap * w;
        energy[i] += amount;
        const o = i * PITCH_CLASSES;
        for (const [shift, hw] of HARMONICS) raw[o + ((pc + shift) % 12)] += amount * hw;
      }
    }
  }
  compressAndNormalize(raw, n);
  return { hopSec: hop, n, frames: raw, energy };
}
