"use client";

import { create } from "zustand";

interface PlaybackState {
  playing: boolean;
  /** seconds, recording time (or score time when audio is generated) */
  time: number;
  duration: number;
  rate: number;
  volume: number;
  muted: boolean;
  loop: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (t: number) => void;
  skip: (dt: number) => void;
  setDuration: (d: number) => void;
  setRate: (r: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleLoop: () => void;
  /** advance by dt seconds (called by the clock) */
  tick: (dt: number) => void;
  reset: (duration: number, time?: number) => void;
}

export const usePlayback = create<PlaybackState>((set, get) => ({
  playing: false,
  time: 42,
  duration: 438,
  rate: 1,
  volume: 0.8,
  muted: false,
  loop: false,
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  toggle: () => set((s) => ({ playing: !s.playing })),
  seek: (t) => set((s) => ({ time: Math.max(0, Math.min(s.duration, t)) })),
  skip: (dt) => set((s) => ({ time: Math.max(0, Math.min(s.duration, s.time + dt)) })),
  setDuration: (d) => set((s) => ({ duration: d, time: Math.min(s.time, d) })),
  setRate: (r) => set({ rate: r }),
  setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)), muted: v === 0 }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  toggleLoop: () => set((s) => ({ loop: !s.loop })),
  tick: (dt) => {
    const s = get();
    if (!s.playing) return;
    const next = s.time + dt * s.rate;
    if (next >= s.duration) {
      if (s.loop) set({ time: 0 });
      else set({ time: s.duration, playing: false });
      return;
    }
    set({ time: next });
  },
  reset: (duration, time = 0) => set({ duration, time: Math.min(time, duration), playing: false }),
}));
