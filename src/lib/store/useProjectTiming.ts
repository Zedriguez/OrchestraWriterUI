"use client";

import { useCallback, useMemo } from "react";
import { mergeAlignment, measureAtRecordingTime, recordingToScoreTime, scoreToRecordingTime } from "@/shared/sync";
import { useProject } from "./project";
import { usePlayback } from "./playback";

export { recordingToScoreTime, scoreToRecordingTime };

/**
 * Two clocks: the transport runs in recording time when a recording exists
 * (score time otherwise). The visual always reads score time, so these map
 * one onto the other through the merged alignment.
 */
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
