"use client";

import { useCallback, useMemo } from "react";
import { mergeAlignment, measureAtRecordingTime, type MeasureAlignment } from "@/shared/sync";
import type { InfoMap } from "@/shared/info-map";
import { useProject } from "./project";
import { usePlayback } from "./playback";

/**
 * Two clocks: the transport runs in recording time when a recording exists
 * (score time otherwise). The visual always reads score time, so these map
 * one onto the other through the merged alignment.
 */
export function recordingToScoreTime(infoMap: InfoMap, aligned: MeasureAlignment[], t: number): number {
  if (aligned.length === 0) return t;
  const n = measureAtRecordingTime(aligned, t);
  const i = n - 1;
  const a = aligned[i];
  const next = aligned[i + 1];
  const m = infoMap.measures[i];
  if (!a || !m) return t;
  const span = next ? next.startSec - a.startSec : m.duration;
  const frac = span > 0 ? (t - a.startSec) / span : 0;
  return m.startTime + Math.max(0, Math.min(1.2, frac)) * m.duration;
}

export function scoreToRecordingTime(infoMap: InfoMap, aligned: MeasureAlignment[], scoreT: number): number {
  if (aligned.length === 0) return scoreT;
  const ms = infoMap.measures;
  let lo = 0;
  let hi = ms.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ms[mid].startTime <= scoreT) lo = mid;
    else hi = mid - 1;
  }
  const m = ms[lo];
  const a = aligned[lo];
  const next = aligned[lo + 1];
  const span = next ? next.startSec - a.startSec : m.duration;
  const frac = m.duration > 0 ? (scoreT - m.startTime) / m.duration : 0;
  return a.startSec + frac * span;
}

export function useProjectTiming() {
  const infoMap = useProject((s) => s.infoMap);
  const sync = useProject((s) => s.sync);
  const hasRecording = useProject((s) => s.summary?.hasRecording ?? false);

  const aligned = useMemo(() => (sync && hasRecording ? mergeAlignment(sync.auto, sync.manual) : []), [sync, hasRecording]);

  /** score-time clock for the Stage */
  const clock = useCallback(() => {
    const t = usePlayback.getState().time;
    if (!infoMap || aligned.length === 0) return t;
    return recordingToScoreTime(infoMap, aligned, t);
  }, [infoMap, aligned]);

  const measureAt = useCallback(
    (t: number) => {
      if (!infoMap) return 1;
      if (aligned.length > 0) return measureAtRecordingTime(aligned, t);
      const ms = infoMap.measures;
      let lo = 0;
      let hi = ms.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (ms[mid].startTime <= t) lo = mid;
        else hi = mid - 1;
      }
      return ms[lo]?.number ?? 1;
    },
    [infoMap, aligned],
  );

  const measureStart = useCallback(
    (n: number) => {
      if (!infoMap) return 0;
      if (aligned.length > 0) return aligned[n - 1]?.startSec ?? 0;
      return infoMap.measures[n - 1]?.startTime ?? 0;
    },
    [infoMap, aligned],
  );

  const seekMeasure = useCallback(
    (n: number) => {
      usePlayback.getState().seek(measureStart(n));
    },
    [measureStart],
  );

  return { clock, measureAt, measureStart, seekMeasure, aligned, hasRecording };
}
