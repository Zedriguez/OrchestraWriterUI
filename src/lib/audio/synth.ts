import { BRIGHTNESS_LADDER, type Dynamic } from "@/shared/dynamics";
import type { InfoMap, Instrument } from "@/shared/info-map";
import { soundingTranspose } from "@/shared/score/transpose";

/**
 * Generated playback for scores without a recording: a small subtractive
 * synth driven by the info map. Loudness follows the written dynamic ladder,
 * timbre follows the section. The pure scheduling math lives at the top of
 * this file (tested in node); node graphs are built by scheduleVoice().
 */

export type SynthVoice = "strings" | "woodwinds" | "brass" | "percussion" | "timpani" | "other";

export interface SynthNote {
  /** score time, seconds */
  time: number;
  duration: number;
  /** MIDI, sounding (written pitch + the part's transposition) */
  pitch: number;
  /** 0–1 from the dynamic ladder */
  velocity: number;
  voice: SynthVoice;
  /** index into infoMap.instruments */
  part: number;
}

export interface Adsr {
  attack: number;
  decay: number;
  /** 0–1 of peak */
  sustain: number;
  release: number;
}

export const VOICE_ADSR: Record<SynthVoice, Adsr> = {
  strings: { attack: 0.07, decay: 0.2, sustain: 0.75, release: 0.25 },
  woodwinds: { attack: 0.035, decay: 0.12, sustain: 0.8, release: 0.12 },
  brass: { attack: 0.045, decay: 0.16, sustain: 0.7, release: 0.15 },
  percussion: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.05 },
  timpani: { attack: 0.004, decay: 0.7, sustain: 0.12, release: 0.45 },
  other: { attack: 0.01, decay: 0.3, sustain: 0.45, release: 0.3 },
};

/** Per-voice level trim so sections sit together before the compressor. */
export const VOICE_GAIN: Record<SynthVoice, number> = {
  strings: 0.3,
  woodwinds: 0.6,
  brass: 0.22,
  percussion: 0.75,
  timpani: 0.95,
  other: 0.55,
};

/** Seconds of score scheduled ahead of the playhead (live engine). */
export const LOOKAHEAD_SEC = 1;
/** Scheduler timer period, ms. */
export const SCHEDULER_INTERVAL_MS = 50;
/** Cap on simultaneously scheduled notes so dense tutti passages stay cheap. */
export const MAX_SCHEDULED_NOTES = 384;

const MALLETS = /glockenspiel|xylophone|marimba|vibraphone|celesta|chimes|bells|crotales/i;

export function voiceForInstrument(inst: Pick<Instrument, "name" | "section">): SynthVoice {
  switch (inst.section) {
    case "Strings":
      return "strings";
    case "Woodwinds":
      return "woodwinds";
    case "Brass":
      return "brass";
    case "Percussion":
      if (/timpani|timp\./i.test(inst.name)) return "timpani";
      return MALLETS.test(inst.name) ? "other" : "percussion";
    default:
      return "other";
  }
}

export function velocityFor(dynamic: Dynamic): number {
  return BRIGHTNESS_LADDER[dynamic] ?? BRIGHTNESS_LADDER.mf;
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Every note of the info map as synth notes, sorted by time. The info map
 * keeps written pitch; transposing parts (B-flat clarinet, horn in F) are
 * shifted to sounding pitch here.
 */
export function collectSynthNotes(infoMap: InfoMap): SynthNote[] {
  const out: SynthNote[] = [];
  infoMap.instruments.forEach((inst, part) => {
    const voice = voiceForInstrument(inst);
    const transpose = soundingTranspose(inst);
    for (const n of inst.notes) {
      if (!(n.duration > 0) || !Number.isFinite(n.time)) continue;
      out.push({ time: n.time, duration: n.duration, pitch: n.pitch + transpose, velocity: velocityFor(n.dynamics), voice, part });
    }
  });
  out.sort((a, b) => a.time - b.time || a.part - b.part);
  return out;
}

/** First index whose note starts at or after t (notes sorted by time). */
export function lowerBound(notes: SynthNote[], t: number): number {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].time < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export interface ScheduleWindowOptions {
  /** also return notes that started before `from` and still sound at `from` (after a seek) */
  includeSounding?: boolean;
  /** longest note duration in the list; bounds the backward scan for sounding notes */
  maxDuration?: number;
}

/**
 * Notes to schedule for the score-time window [from, to): every note that
 * starts in it, plus (optionally) notes already sounding at `from`.
 */
export function scheduleWindow(notes: SynthNote[], from: number, to: number, options: ScheduleWindowOptions = {}): SynthNote[] {
  if (!(to > from)) return [];
  const out: SynthNote[] = [];
  const start = lowerBound(notes, from);
  if (options.includeSounding) {
    const maxDur = options.maxDuration ?? Infinity;
    const sounding: SynthNote[] = [];
    for (let i = start - 1; i >= 0; i--) {
      const n = notes[i];
      if (n.time < from - maxDur) break;
      if (n.time + n.duration > from + 0.03) sounding.push(n);
    }
    sounding.reverse();
    out.push(...sounding);
  }
  for (let i = start; i < notes.length && notes[i].time < to; i++) out.push(notes[i]);
  return out;
}

/**
 * ADSR breakpoints (absolute times) for a note: [time, gain] pairs to feed
 * setValueAtTime / linearRampToValueAtTime. A note released during its attack
 * or decay releases from wherever it got to. Voices with zero sustain end
 * after their decay even if the written note is longer.
 */
export function envelopePoints(adsr: Adsr, start: number, duration: number, peak: number): Array<[number, number]> {
  const a = Math.max(0.002, adsr.attack);
  const d = Math.max(0.001, adsr.decay);
  const r = Math.max(0.005, adsr.release);
  const sustain = Math.max(0, Math.min(1, adsr.sustain)) * peak;
  const off = start + Math.max(0.03, duration);
  const pts: Array<[number, number]> = [[start, 0]];
  const tA = start + a;
  if (off <= tA) {
    pts.push([off, peak * ((off - start) / a)]);
    pts.push([off + r, 0]);
    return pts;
  }
  pts.push([tA, peak]);
  const tD = tA + d;
  if (off <= tD) {
    pts.push([off, peak + (sustain - peak) * ((off - tA) / d)]);
    pts.push([off + r, 0]);
    return pts;
  }
  pts.push([tD, sustain]);
  if (sustain <= 0) return pts;
  pts.push([off, sustain]);
  pts.push([off + r, 0]);
  return pts;
}

/** Level of each part's bus so 1 or 64 parts land near the same loudness. */
export function partBusGain(partCount: number): number {
  return 1.1 / Math.sqrt(Math.max(1, partCount));
}

/* ------------------------------------------------------------------ */
/* Web Audio graph                                                      */
/* ------------------------------------------------------------------ */

export interface SynthChain {
  /** connect note voices here */
  input: GainNode;
  /** master volume (live engine) */
  master: GainNode;
  disconnect(): void;
}

/** input (part-count trim) → compressor → master → destination */
export function createSynthChain(ctx: BaseAudioContext, partCount: number, masterGain: number): SynthChain {
  const input = ctx.createGain();
  input.gain.value = partBusGain(partCount);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.005;
  comp.release.value = 0.2;
  const master = ctx.createGain();
  master.gain.value = masterGain;
  input.connect(comp);
  comp.connect(master);
  master.connect(ctx.destination);
  return {
    input,
    master,
    disconnect() {
      try {
        input.disconnect();
        comp.disconnect();
        master.disconnect();
      } catch {
        /* already disconnected */
      }
    },
  };
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseBuffers.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate), ctx.sampleRate);
    const data = buf.getChannelData(0);
    let seed = 0x9e3779b9;
    for (let i = 0; i < data.length; i++) {
      // xorshift: deterministic noise so exports are reproducible
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      data[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
    }
    noiseBuffers.set(ctx, buf);
  }
  return buf;
}

export interface ScheduledVoice {
  sources: AudioScheduledSourceNode[];
  /** context time when the voice is silent and stopped */
  end: number;
}

/**
 * Build and schedule one note. `when` and `duration` are in context time
 * (already scaled by the playback rate).
 */
export function scheduleVoice(ctx: BaseAudioContext, dest: AudioNode, note: SynthNote, when: number, duration: number): ScheduledVoice {
  const adsr = VOICE_ADSR[note.voice];
  const peak = note.velocity * VOICE_GAIN[note.voice];
  const points = envelopePoints(adsr, when, duration, peak);
  const end = points[points.length - 1][0];

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, when);
  for (let i = 1; i < points.length; i++) env.gain.linearRampToValueAtTime(points[i][1], points[i][0]);
  env.connect(dest);

  const f = Math.max(27.5, Math.min(4186, midiToHz(note.pitch)));
  const sources: AudioScheduledSourceNode[] = [];
  const osc = (type: OscillatorType, freq: number, detune = 0) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    if (detune) o.detune.value = detune;
    sources.push(o);
    return o;
  };
  const filter = (type: BiquadFilterType, freq: number, q: number) => {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = freq;
    b.Q.value = q;
    return b;
  };

  switch (note.voice) {
    case "strings": {
      const lp = filter("lowpass", clamp(f * 3 + 900 * note.velocity, 500, 6000), 0.6);
      osc("sawtooth", f, -7).connect(lp);
      osc("sawtooth", f, 7).connect(lp);
      lp.connect(env);
      break;
    }
    case "woodwinds":
      osc("triangle", f).connect(env);
      break;
    case "brass": {
      const lp = filter("lowpass", clamp(f * (2 + 4 * note.velocity), 700, 7500), 1);
      osc("square", f).connect(lp);
      lp.connect(env);
      break;
    }
    case "percussion": {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx);
      const bp = filter("bandpass", 1800, 0.8);
      src.connect(bp);
      bp.connect(env);
      sources.push(src);
      break;
    }
    case "timpani":
      osc("sine", clamp(f, 40, 260)).connect(env);
      break;
    default:
      osc("sine", f).connect(env);
  }

  for (const s of sources) {
    s.start(when);
    s.stop(end + 0.02);
  }
  // free the graph once the last source ends
  const last = sources[sources.length - 1];
  if (last) {
    last.onended = () => {
      try {
        env.disconnect();
      } catch {
        /* already gone */
      }
    };
  }
  return { sources, end };
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
