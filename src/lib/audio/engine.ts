import type { InfoMap } from "@/shared/info-map";
import { DECODE_SAMPLE_RATE, getAudioContext, offlineContextCtor } from "./decode";
import {
  LOOKAHEAD_SEC,
  MAX_SCHEDULED_NOTES,
  SCHEDULER_INTERVAL_MS,
  collectSynthNotes,
  createSynthChain,
  scheduleVoice,
  scheduleWindow,
  type SynthChain,
  type SynthNote,
} from "./synth";

/**
 * One playback source behind the transport. The playback store forwards its
 * actions here and reads currentTime() every frame. Times are seconds in the
 * engine's own clock: recording time for a recording, score time for the
 * generated playback.
 */
export interface AudioEngine {
  readonly kind: "recording" | "score";
  /** seconds; 0 until load() resolves for a recording */
  readonly duration: number;
  load(): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(t: number): void;
  setRate(r: number): void;
  setVolume(v: number): void;
  setMuted(m: boolean): void;
  currentTime(): number;
  /** true once the source reached its end */
  ended(): boolean;
  /** Recording engines: swap the media URL (e.g. a refreshed presigned link) keeping the playhead and play state. */
  replaceSource?(url: string): void;
  /** Recording engines: called when playback fails after the initial load (expired link, network). */
  setErrorHandler?(handler: ((message: string) => void) | null): void;
  /** true when the source is not producing sound (paused by the user, the OS media keys, or the end) */
  paused?(): boolean;
  destroy(): void;
}

/* ------------------------------------------------------------------ */
/* Recording (<audio>)                                                  */
/* ------------------------------------------------------------------ */

/** Readable message for a media element error (expired presigned URL, bad format, network). */
export function mediaErrorMessage(error: Pick<MediaError, "code" | "message"> | null | undefined): string {
  switch (error?.code) {
    case 1:
      return "Loading the recording was stopped.";
    case 2:
      return "The recording could not be downloaded (network error). Check the connection and reload the page.";
    case 3:
      return "The recording could not be decoded. The file may be damaged; try uploading it again.";
    case 4:
      return "The recording could not be opened. Its link may have expired (reload the page) or the format is not supported.";
    default:
      return error?.message ? `The recording could not be played: ${error.message}` : "The recording could not be played.";
  }
}

export function createRecordingEngine(url: string): AudioEngine {
  if (typeof document === "undefined") throw new Error("Recording playback needs a browser.");
  const el = document.createElement("audio");
  el.crossOrigin = "anonymous";
  el.preload = "auto";
  let triedWithoutCors = false;
  let pendingSeek: number | null = null;
  let loadPromise: Promise<void> | null = null;
  let destroyed = false;
  const listeners: Array<[string, EventListener]> = [];
  const on = (type: string, fn: EventListener) => {
    el.addEventListener(type, fn);
    listeners.push([type, fn]);
  };

  const applyPendingSeek = () => {
    if (pendingSeek === null) return;
    const t = clampTime(pendingSeek, el.duration);
    pendingSeek = null;
    try {
      el.currentTime = t;
    } catch {
      /* not seekable yet */
    }
  };
  on("loadedmetadata", applyPendingSeek);

  let errorHandler: ((message: string) => void) | null = null;
  // Errors after the initial load (an expired presigned URL mid-playback) are
  // reported so the owner can fetch a fresh link and call replaceSource.
  on("error", () => {
    if (loadPromise && el.readyState >= 1) return; // handled by load()'s own listener while loading
    if (loadSettled) errorHandler?.(mediaErrorMessage(el.error));
  });
  let loadSettled = false;

  el.src = url;

  const engine: AudioEngine = {
    kind: "recording",
    get duration() {
      return Number.isFinite(el.duration) ? el.duration : 0;
    },
    load() {
      if (loadPromise) return loadPromise;
      loadPromise = new Promise<void>((resolve, reject) => {
        if (el.readyState >= 1) {
          resolve();
          return;
        }
        const onMeta = () => {
          cleanup();
          loadSettled = true;
          resolve();
        };
        const onError = () => {
          // S3 without CORS headers fails the crossorigin request; plain playback does not need CORS
          if (!triedWithoutCors && el.crossOrigin !== null) {
            triedWithoutCors = true;
            el.removeAttribute("crossorigin");
            el.src = url;
            el.load();
            return;
          }
          cleanup();
          reject(new Error(mediaErrorMessage(el.error)));
        };
        const cleanup = () => {
          el.removeEventListener("loadedmetadata", onMeta);
          el.removeEventListener("error", onError);
        };
        el.addEventListener("loadedmetadata", onMeta);
        el.addEventListener("error", onError);
        el.load();
      });
      return loadPromise;
    },
    play() {
      if (destroyed) return Promise.reject(new Error("The audio engine was closed."));
      if (el.ended) el.currentTime = 0;
      return el.play();
    },
    pause() {
      el.pause();
    },
    seek(t) {
      if (el.readyState < 1) {
        pendingSeek = Math.max(0, t);
        return;
      }
      pendingSeek = null;
      el.currentTime = clampTime(t, el.duration);
    },
    setRate(r) {
      el.playbackRate = r;
      el.defaultPlaybackRate = r;
    },
    setVolume(v) {
      el.volume = Math.max(0, Math.min(1, v));
    },
    setMuted(m) {
      el.muted = m;
    },
    currentTime() {
      return pendingSeek ?? el.currentTime;
    },
    ended() {
      return el.ended;
    },
    paused() {
      return el.paused;
    },
    replaceSource(next) {
      if (destroyed) return;
      const wasPlaying = !el.paused && !el.ended;
      const t = el.currentTime;
      pendingSeek = t;
      loadSettled = false;
      el.src = next;
      el.load();
      el.addEventListener(
        "loadedmetadata",
        () => {
          loadSettled = true;
          if (wasPlaying) void el.play().catch(() => {});
        },
        { once: true },
      );
    },
    setErrorHandler(handler) {
      errorHandler = handler;
    },
    destroy() {
      destroyed = true;
      el.pause();
      for (const [type, fn] of listeners) el.removeEventListener(type, fn);
      el.removeAttribute("src");
      el.load();
    },
  };
  return engine;
}

function clampTime(t: number, duration: number) {
  const max = Number.isFinite(duration) && duration > 0 ? duration : Infinity;
  return Math.max(0, Math.min(max, t));
}

/* ------------------------------------------------------------------ */
/* Generated playback (Web Audio synth)                                 */
/* ------------------------------------------------------------------ */

interface Generation {
  bus: GainNode;
  voices: Set<AudioScheduledSourceNode>;
}

/**
 * Plays the info map's notes with a look-ahead scheduler: every 50 ms it
 * schedules the next ~1 s of score. Seeking or changing the rate cancels
 * what was scheduled and restarts from the new position; the rate scales
 * the schedule (tempo changes, pitch does not).
 */
export function createScoreSynthEngine(infoMap: InfoMap): AudioEngine {
  const notes: SynthNote[] = collectSynthNotes(infoMap);
  let lastEnd = 0;
  let maxDuration = 0;
  for (const n of notes) {
    lastEnd = Math.max(lastEnd, n.time + n.duration);
    maxDuration = Math.max(maxDuration, n.duration);
  }
  const duration = infoMap.duration > 0 ? infoMap.duration : lastEnd;
  const partCount = infoMap.instruments.length;

  let ctx: AudioContext | null = null;
  let chain: SynthChain | null = null;
  let gen: Generation | null = null;
  let playing = false;
  let started = false;
  let atEnd = false;
  let destroyed = false;
  let anchorScore = 0;
  let anchorCtx = 0;
  let scheduledTo = 0;
  let rate = 1;
  let volume = 0.8;
  let muted = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let playToken = 0;

  const ensureContext = () => {
    if (!ctx) ctx = getAudioContext();
    if (!chain) {
      chain = createSynthChain(ctx, partCount, muted ? 0 : volume);
    }
    return ctx;
  };

  const applyGain = () => {
    if (!ctx || !chain) return;
    chain.master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.02);
  };

  const position = () => {
    if (!playing || !started || !ctx) return anchorScore;
    const t = anchorScore + Math.max(0, ctx.currentTime - anchorCtx) * rate;
    return Math.min(duration, t);
  };

  const killGeneration = () => {
    if (!gen || !ctx) return;
    const g = gen;
    gen = null;
    const now = ctx.currentTime;
    g.bus.gain.cancelScheduledValues(now);
    g.bus.gain.setTargetAtTime(0, now, 0.012);
    for (const s of g.voices) {
      try {
        s.stop(now + 0.06);
      } catch {
        /* never started or already stopped */
      }
    }
    setTimeout(() => {
      try {
        g.bus.disconnect();
      } catch {
        /* already gone */
      }
    }, 200);
  };

  const scheduleRange = (from: number, to: number, includeSounding: boolean) => {
    if (!ctx || !gen) return;
    const now = ctx.currentTime;
    const batch = scheduleWindow(notes, from, to, { includeSounding, maxDuration });
    for (const n of batch) {
      if (gen.voices.size >= MAX_SCHEDULED_NOTES) break;
      let when = anchorCtx + (n.time - anchorScore) / rate;
      let dur = n.duration / rate;
      if (when < now + 0.005) {
        const late = now + 0.005 - when;
        when += late;
        dur -= late;
        if (dur < 0.03) continue;
      }
      const v = scheduleVoice(ctx, gen.bus, n, when, dur);
      const voices = gen.voices;
      for (const s of v.sources) {
        voices.add(s);
        s.addEventListener("ended", () => voices.delete(s));
      }
    }
  };

  const startGeneration = (from: number) => {
    if (!ctx || !chain) return;
    const bus = ctx.createGain();
    bus.connect(chain.input);
    gen = { bus, voices: new Set() };
    anchorScore = from;
    anchorCtx = ctx.currentTime + 0.03;
    scheduledTo = Math.min(duration, from + LOOKAHEAD_SEC * rate);
    scheduleRange(from, scheduledTo, true);
  };

  const stopTimer = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
  };

  const pump = () => {
    if (!playing || !started || !ctx) return;
    const now = position();
    if (now >= duration) {
      anchorScore = duration;
      playing = false;
      started = false;
      atEnd = true;
      stopTimer();
      // let the release tails ring out, then free the bus
      const finished = gen;
      gen = null;
      setTimeout(() => {
        try {
          finished?.bus.disconnect();
        } catch {
          /* already gone */
        }
      }, 3000);
      return;
    }
    const horizon = Math.min(duration, now + LOOKAHEAD_SEC * rate);
    if (horizon > scheduledTo) {
      scheduleRange(scheduledTo, horizon, false);
      scheduledTo = horizon;
    }
  };

  return {
    kind: "score",
    duration,
    load() {
      return Promise.resolve();
    },
    play() {
      if (destroyed) return Promise.reject(new Error("The audio engine was closed."));
      if (playing) return Promise.resolve();
      // create + resume synchronously inside the user gesture
      const c = ensureContext();
      const resumed = c.state === "running" ? Promise.resolve() : c.resume();
      if (atEnd || anchorScore >= duration) {
        anchorScore = 0;
        atEnd = false;
      }
      playing = true;
      started = false;
      const token = ++playToken;
      return resumed.then(() => {
        if (!playing || token !== playToken || destroyed) return;
        started = true;
        startGeneration(anchorScore);
        stopTimer();
        timer = setInterval(pump, SCHEDULER_INTERVAL_MS);
      });
    },
    pause() {
      if (!playing) return;
      anchorScore = position();
      playing = false;
      started = false;
      stopTimer();
      killGeneration();
    },
    seek(t) {
      const target = Math.max(0, Math.min(duration, t));
      atEnd = target >= duration;
      if (playing && started) {
        killGeneration();
        startGeneration(target);
      } else {
        anchorScore = target;
      }
    },
    setRate(r) {
      const next = r > 0 ? r : 1;
      if (next === rate) return;
      if (playing && started) {
        const pos = position();
        killGeneration();
        rate = next;
        startGeneration(pos);
      } else {
        rate = next;
      }
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      applyGain();
    },
    setMuted(m) {
      muted = m;
      applyGain();
    },
    currentTime: position,
    ended() {
      return atEnd || position() >= duration;
    },
    paused() {
      return !playing;
    },
    destroy() {
      destroyed = true;
      playing = false;
      stopTimer();
      killGeneration();
      const c = chain;
      chain = null;
      // the shared AudioContext stays open for the next engine
      setTimeout(() => c?.disconnect(), 250);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Offline render for MP4 export                                        */
/* ------------------------------------------------------------------ */

export interface RenderScoreOptions {
  sampleRate?: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * Render the generated playback into a 44.1 kHz stereo AudioBuffer with the
 * same synth as live playback. Notes are added in 10 s windows from
 * suspend() callbacks so long scores don't build every node up front.
 */
export async function renderScoreToAudioBuffer(infoMap: InfoMap, durationSec: number, options: RenderScoreOptions = {}): Promise<AudioBuffer> {
  const Ctor = offlineContextCtor();
  const sampleRate = options.sampleRate ?? DECODE_SAMPLE_RATE;
  const total = Math.max(0.1, durationSec);
  const length = Math.max(1, Math.ceil(total * sampleRate));
  const ctx = new Ctor(2, length, sampleRate);
  const chain = createSynthChain(ctx, infoMap.instruments.length, 0.9);
  const notes = collectSynthNotes(infoMap).filter((n) => n.time < total);
  const schedule = (from: number, to: number) => {
    for (const n of scheduleWindow(notes, from, to)) scheduleVoice(ctx, chain.input, n, n.time, n.duration);
  };

  const WINDOW = 10;
  const LEAD = 2;
  const canSuspend = typeof ctx.suspend === "function" && total > WINDOW;
  if (canSuspend) {
    schedule(0, WINDOW);
    for (let t = WINDOW; t < total; t += WINDOW) {
      const from = t;
      ctx
        .suspend(from - LEAD)
        .then(() => {
          if (options.signal?.aborted) return; // leave it suspended; the promise below rejects
          schedule(from, from + WINDOW);
          options.onProgress?.(Math.min(1, from / total));
          return ctx.resume();
        })
        .catch(() => {
          /* suspend times past the end are rejected by some browsers; harmless */
        });
    }
  } else {
    schedule(0, total + 1);
  }

  const rendered = startRendering(ctx);
  const result = options.signal
    ? await Promise.race([
        rendered,
        new Promise<never>((_, reject) => {
          const onAbort = () => reject(new DOMException("Audio render cancelled", "AbortError"));
          if (options.signal!.aborted) onAbort();
          else options.signal!.addEventListener("abort", onAbort, { once: true });
        }),
      ])
    : await rendered;
  options.onProgress?.(1);
  return result;
}

/** Promise or event form (older Safari's startRendering returns undefined). */
function startRendering(ctx: OfflineAudioContext): Promise<AudioBuffer> {
  return new Promise<AudioBuffer>((resolve, reject) => {
    let settled = false;
    const done = (b: AudioBuffer) => {
      if (settled) return;
      settled = true;
      resolve(b);
    };
    ctx.oncomplete = (e) => done(e.renderedBuffer);
    try {
      const p = ctx.startRendering() as Promise<AudioBuffer> | undefined;
      if (p && typeof p.then === "function") p.then(done, (err) => !settled && reject(err));
    } catch (err) {
      reject(err);
    }
  });
}
