"use client";

import { useMemo } from "react";
import { buildWaveform } from "@/lib/mock/waveform";

export function useWaveform(seed: number, bars = 420) {
  return useMemo(() => buildWaveform(seed, bars), [seed, bars]);
}
