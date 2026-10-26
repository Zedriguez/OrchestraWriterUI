"use client";

import { create } from "zustand";
import type { AudioEngine } from "@/lib/audio/engine";

interface PlaybackState {
  playing: boolean;
  /** seconds, recording time (or score time when audio is generated) */
  time: number;
  duration: number;
  rate: number;
  volume: number;
  muted: boolean;
  loop: boolean;
  /** the audio source; null = silent clock (tests, auth demo) */
  engine: AudioEngine | null;
  /** false while an attached engine is loading */
  ready: boolean;
  /** readable message when the engine failed to load or play */
  error: string | null;
  /** attach (or detach with null) the audio engine; the caller owns destroy() */
  attach: (engine: AudioEngine | null) => void;
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
  /** advance by dt seconds (called by the clock every frame) */
  tick: (dt: number) => void;
  reset: (duration: number, time?: number) => void;
}

/**
 * Smoothing for coarse media clocks (some browsers update <audio>.currentTime
 * only a few times a second): between engine updates the store extrapolates,
 * and it never steps back by less than 0.1 s, so the playhead stays monotonic.
 */
let lastEngineTime = -1;
let engineAdvancing = false;

function resetSmoothing() {
  lastEngineTime = -1;
  engineAdvancing = false;
}

function messageOf(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}

function isAbort(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { name?: string }).name === "AbortError";
}

export const usePlayback = create<PlaybackState>((set, get) => {
  const startEngine = (engine: AudioEngine) => {
    engine
      .play()
      .then(() => {
        if (get().engine === engine && get().error) set({ error: null });
      })
      .catch((err: unknown) => {
        if (get().engine !== engine) return;
        // pause() before playback started rejects with AbortError; that is not a failure
        if (isAbort(err)) return;
        const blocked = typeof err === "object" && err !== null && (err as { name?: string }).name === "NotAllowedError";
        set({
          playing: false,
          error: blocked ? "The browser blocked playback. Press play to start the audio." : messageOf(err, "The audio could not start."),
        });
      });
  };

  return {
    playing: false,
    time: 42,
    duration: 438,
    rate: 1,
    volume: 0.8,
    muted: false,
    loop: false,
    engine: null,
    ready: true,
    error: null,

    attach: (engine) => {
      const prev = get().engine;
      if (prev === engine) return;
      if (prev) prev.pause();
      resetSmoothing();
      if (!engine) {
        set({ engine: null, ready: true, error: null, playing: false });
        return;
      }
      const s = get();
      set({ engine, ready: false, error: null, playing: false });
      engine.setRate(s.rate);
      engine.setVolume(s.volume);
      engine.setMuted(s.muted);
      engine
        .load()
        .then(() => {
          if (get().engine !== engine) return;
          const d = engine.duration > 0 ? engine.duration : get().duration;
          const t = Math.max(0, Math.min(d, get().time));
          engine.seek(t);
          set({ ready: true, error: null, duration: d, time: t });
        })
        .catch((err: unknown) => {
          if (get().engine !== engine) return;
          set({ ready: false, playing: false, error: messageOf(err, "The audio could not be loaded.") });
        });
    },

    play: () => {
      const s = get();
      const engine = s.engine;
      if (!engine) {
        set({ playing: true });
        return;
      }
      // a failed load leaves nothing to play
      if (!s.ready && s.error) return;
      if (s.duration > 0 && s.time >= s.duration - 0.05) {
        engine.seek(0);
        set({ time: 0 });
      }
      resetSmoothing();
      set({ playing: true, error: s.ready ? null : s.error });
      startEngine(engine);
    },

    pause: () => {
      const engine = get().engine;
      if (!engine) {
        set({ playing: false });
        return;
      }
      engine.pause();
      set({ playing: false, time: Math.max(0, Math.min(get().duration, engine.currentTime())) });
    },

    toggle: () => (get().playing ? get().pause() : get().play()),

    seek: (t) => {
      const s = get();
      const next = Math.max(0, Math.min(s.duration, t));
      resetSmoothing();
      s.engine?.seek(next);
      set({ time: next });
    },

    skip: (dt) => get().seek(get().time + dt),

    setDuration: (d) => set((s) => ({ duration: d, time: Math.min(s.time, d) })),

    setRate: (r) => {
      get().engine?.setRate(r);
      set({ rate: r });
    },

    setVolume: (v) => {
      const volume = Math.max(0, Math.min(1, v));
      const muted = v === 0;
      const engine = get().engine;
      engine?.setVolume(volume);
      engine?.setMuted(muted);
      set({ volume, muted });
    },

    toggleMute: () => {
      const muted = !get().muted;
      get().engine?.setMuted(muted);
      set({ muted });
    },

    toggleLoop: () => set((s) => ({ loop: !s.loop })),

    tick: (dt) => {
      const s = get();
      if (!s.playing) return;
      const engine = s.engine;
      if (engine) {
        const raw = engine.currentTime();
        const ended = engine.ended() || (s.duration > 0 && raw >= s.duration);
        if (ended) {
          resetSmoothing();
          if (s.loop) {
            engine.seek(0);
            set({ time: 0 });
            startEngine(engine);
          } else {
            engine.pause();
            set({ time: s.duration > 0 ? s.duration : raw, playing: false });
          }
          return;
        }
        // paused outside the app (OS media keys) or stalled after a failed play
        if (engine.paused?.() && s.ready) {
          set({ playing: false, time: raw });
          return;
        }
        let t = raw;
        if (raw === lastEngineTime) {
          // no update since last frame: extrapolate once the clock is known to move (never past +0.25 s)
          if (engineAdvancing) t = Math.min(s.time + dt * s.rate, raw + 0.25);
        } else {
          if (lastEngineTime >= 0 && raw > lastEngineTime) engineAdvancing = true;
          lastEngineTime = raw;
          if (s.time > raw && s.time - raw < 0.1) t = s.time;
        }
        t = Math.max(0, Math.min(s.duration > 0 ? s.duration : t, t));
        if (t !== s.time) set({ time: t });
        return;
      }
      const next = s.time + dt * s.rate;
      if (next >= s.duration) {
        if (s.loop) set({ time: 0 });
        else set({ time: s.duration, playing: false });
        return;
      }
      set({ time: next });
    },

    reset: (duration, time = 0) => {
      const t = Math.min(time, duration);
      const engine = get().engine;
      resetSmoothing();
      if (engine) {
        engine.pause();
        engine.seek(t);
      }
      set({ duration, time: t, playing: false });
    },
  };
});
