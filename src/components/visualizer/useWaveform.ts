"use client";

import { useMemo } from "react";
import type { InfoMap } from "@/shared/info-map";
import { peaksFromInfoMap, resamplePeaks } from "@/lib/audio/decode";
import { buildWaveform } from "@/lib/mock/waveform";

/**
 * Peaks for the transport scrubber.
 * - `{ peaks }`: recording peaks (server `audioPeaks` or peaksFromAudioBuffer), resampled to `bars`
 * - `{ infoMap }`: score envelope for generated playback (written dynamics)
 * - a number: deterministic mock peaks (demo pages)
 */
export type WaveformSource = number | { peaks?: number[] | null; infoMap?: InfoMap | null; seed?: number };

export function useWaveform(source: WaveformSource, bars = 420): number[] {
  const seed = typeof source === "number" ? source : (source.seed ?? 0);
  const peaks = typeof source === "number" ? null : (source.peaks ?? null);
  const infoMap = typeof source === "number" ? null : (source.infoMap ?? null);
  return useMemo(() => {
    if (peaks && peaks.length > 0) return resamplePeaks(peaks, bars);
    if (infoMap) return peaksFromInfoMap(infoMap, bars);
    return buildWaveform(seed, bars);
  }, [peaks, infoMap, seed, bars]);
}
