import type { Dynamic } from "@/shared/dynamics";
import type { InfoMap, Instrument } from "@/shared/info-map";
import { soundingTranspose } from "@/shared/score/transpose";

/**
 * Offline additive synthesis of an info map to mono PCM. Deterministic (no
 * randomness, fixed phases) so fixture audio and test audio are bit-identical.
 *
 * Used by scripts/make-fixtures.ts to build the demo recording and by the
 * aligner tests. It is a test/demo tool, not the app's playback engine: it
 * renders written dynamics as a simple gain ladder and knows nothing about
 * hidden parts.
 *
 * Two clocks: note times in the info map are *score* seconds; `warp` maps
 * them to *recording* seconds in the output buffer.
 */

export interface SynthOptions {
  /** output sample rate, default 22050 */
  sampleRate?: number;
  /** score seconds → recording seconds (default: identity) */
  warp?: (scoreSec: number) => number;
  /** semitones from written to sounding pitch per part id (default: the parser's <transpose>, e.g. B♭ clarinet -2) */
  transpose?: Record<string, number>;
  /** seconds of audio after the last measure ends (recording time), default 1.5 */
  tailSec?: number;
  /** peak level after normalization, default 0.89 */
  peak?: number;
}

type EnvelopeKind = "bowed" | "blown" | "brass" | "pluck" | "mallet";

interface Timbre {
  id: string;
  /** relative amplitudes of harmonics 1..n */
  harmonics: number[];
  env: EnvelopeKind;
  /** seconds */
  attack: number;
  /** seconds, after the written end */
  release: number;
  /** exponential decay time constant for pluck/mallet, seconds */
  decay: number;
  gain: number;
  vibrato: boolean;
}

const TIMBRES: Record<string, Timbre> = {
  strings: { id: "strings", harmonics: [1, 0.5, 0.33, 0.25, 0.2, 0.16, 0.14, 0.12, 0.1, 0.09], env: "bowed", attack: 0.06, release: 0.12, decay: 0, gain: 0.8, vibrato: true },
  flute: { id: "flute", harmonics: [1, 0.25, 0.08, 0.03], env: "blown", attack: 0.04, release: 0.08, decay: 0, gain: 0.9, vibrato: true },
  oboe: { id: "oboe", harmonics: [0.6, 1, 0.8, 0.5, 0.35, 0.2, 0.1], env: "blown", attack: 0.03, release: 0.07, decay: 0, gain: 0.75, vibrato: false },
  clarinet: { id: "clarinet", harmonics: [1, 0.05, 0.6, 0.04, 0.35, 0.03, 0.2], env: "blown", attack: 0.03, release: 0.08, decay: 0, gain: 0.85, vibrato: false },
  bassoon: { id: "bassoon", harmonics: [0.7, 1, 0.6, 0.4, 0.25, 0.15], env: "blown", attack: 0.03, release: 0.08, decay: 0, gain: 0.85, vibrato: false },
  horn: { id: "horn", harmonics: [1, 0.6, 0.3, 0.15, 0.08], env: "brass", attack: 0.05, release: 0.12, decay: 0, gain: 0.8, vibrato: false },
  brass: { id: "brass", harmonics: [1, 0.9, 0.75, 0.6, 0.45, 0.33, 0.24, 0.17], env: "brass", attack: 0.03, release: 0.08, decay: 0, gain: 0.7, vibrato: false },
  timpani: { id: "timpani", harmonics: [1, 0.35, 0.12], env: "mallet", attack: 0.004, release: 0.25, decay: 0.7, gain: 1.1, vibrato: false },
  harp: { id: "harp", harmonics: [1, 0.4, 0.15, 0.05], env: "pluck", attack: 0.003, release: 0.3, decay: 0.9, gain: 1, vibrato: false },
  pizz: { id: "pizz", harmonics: [1, 0.45, 0.2, 0.1], env: "pluck", attack: 0.003, release: 0.1, decay: 0.28, gain: 1, vibrato: false },
  other: { id: "other", harmonics: [1, 0.5, 0.25, 0.12], env: "blown", attack: 0.02, release: 0.1, decay: 0, gain: 0.8, vibrato: false },
};

/** Gain per written dynamic (a gentle ladder; only used to make the demo recording sound plausible). */
const DYNAMIC_GAIN: Record<Dynamic, number> = { pp: 0.16, p: 0.24, mp: 0.33, mf: 0.44, f: 0.58, ff: 0.74, fff: 0.9 };

function timbreFor(inst: Instrument): Timbre {
  const n = inst.name.toLowerCase();
  if (/flute|piccolo/.test(n)) return TIMBRES.flute;
  if (/oboe|english horn|cor anglais/.test(n)) return TIMBRES.oboe;
  if (/clarinet/.test(n)) return TIMBRES.clarinet;
  if (/bassoon/.test(n)) return TIMBRES.bassoon;
  if (/horn/.test(n)) return TIMBRES.horn;
  if (/timpani/.test(n)) return TIMBRES.timpani;
  if (/harp/.test(n)) return TIMBRES.harp;
  switch (inst.section) {
    case "Strings":
      return TIMBRES.strings;
    case "Woodwinds":
      return TIMBRES.clarinet;
    case "Brass":
      return TIMBRES.brass;
    case "Percussion":
      return TIMBRES.timpani;
    default:
      return TIMBRES.other;
  }
}

const TABLE_SIZE = 2048;
const tableCache = new Map<string, Float32Array>();

function wavetable(timbre: Timbre, harmonicCount: number): Float32Array {
  const n = Math.max(1, Math.min(timbre.harmonics.length, harmonicCount));
  const key = `${timbre.id}:${n}`;
  let table = tableCache.get(key);
  if (table) return table;
  table = new Float32Array(TABLE_SIZE + 1);
  let peak = 0;
  for (let i = 0; i < TABLE_SIZE; i++) {
    let v = 0;
    for (let h = 0; h < n; h++) v += timbre.harmonics[h] * Math.sin((2 * Math.PI * (h + 1) * i) / TABLE_SIZE);
    table[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  for (let i = 0; i < TABLE_SIZE; i++) table[i] /= peak || 1;
  table[TABLE_SIZE] = table[0];
  tableCache.set(key, table);
  return table;
}

/** Render the info map to mono PCM in recording time. */
export function renderInfoMapAudio(infoMap: InfoMap, options: SynthOptions = {}): Float32Array {
  const sr = options.sampleRate ?? 22050;
  const warp = options.warp ?? ((s: number) => s);
  const tail = options.tailSec ?? 1.5;
  const totalSec = warp(infoMap.duration) + tail;
  const out = new Float32Array(Math.ceil(totalSec * sr));
  const nyquist = sr / 2;

  for (const inst of infoMap.instruments) {
    const base = timbreFor(inst);
    const shift = options.transpose ? (options.transpose[inst.id] ?? 0) : soundingTranspose(inst);
    for (const note of inst.notes) {
      if (!(note.duration > 0)) continue;
      const timbre = note.styleMarking === "Pizzicato" && base.env === "bowed" ? TIMBRES.pizz : base;
      const f0 = 440 * Math.pow(2, (note.pitch + shift - 69) / 12);
      const harmonicCount = Math.floor((nyquist * 0.9) / f0);
      if (harmonicCount < 1) continue;
      const table = wavetable(timbre, harmonicCount);

      const r0 = warp(note.time);
      let r1 = warp(note.time + note.duration);
      if (note.styleMarking === "Staccato") r1 = r0 + (r1 - r0) * 0.5;
      const decaying = timbre.env === "pluck" || timbre.env === "mallet";
      const end = decaying ? Math.min(r1 + timbre.release, r0 + timbre.decay * 5) : r1 + timbre.release;
      const i0 = Math.max(0, Math.round(r0 * sr));
      const i1 = Math.min(out.length, Math.round(end * sr));
      const iOff = Math.round(r1 * sr);
      const accent = note.styleMarking === "Accent" || note.styleMarking === "Marcato" ? 1.3 : 1;
      const amp = DYNAMIC_GAIN[note.dynamics] * timbre.gain * accent * 0.25;
      const tremolo = note.styleMarking === "Tremolo";
      const inc0 = (f0 * TABLE_SIZE) / sr;
      const attackN = Math.max(1, Math.round(timbre.attack * sr));
      const releaseN = Math.max(1, Math.round(timbre.release * sr));
      const decayK = decaying ? Math.exp(-1 / (timbre.decay * sr)) : 1;

      let phase = 0;
      let decayEnv = 1;
      for (let i = i0; i < i1; i++) {
        const k = i - i0;
        let env = k < attackN ? k / attackN : 1;
        if (decaying) {
          env *= decayEnv;
          decayEnv *= decayK;
        } else if (timbre.env === "brass" && k < attackN * 3) {
          env *= 1 + 0.25 * Math.max(0, 1 - Math.abs(k - attackN) / attackN);
        }
        if (i >= iOff) env *= Math.max(0, 1 - (i - iOff) / releaseN);
        if (tremolo) env *= 0.65 + 0.35 * Math.cos((2 * Math.PI * 11 * k) / sr);
        let inc = inc0;
        if (timbre.vibrato && k > sr * 0.15) inc *= 1 + 0.003 * Math.sin((2 * Math.PI * 5.5 * k) / sr);
        const idx = phase | 0;
        const frac = phase - idx;
        const s = table[idx] + (table[idx + 1] - table[idx]) * frac;
        out[i] += s * env * amp;
        phase += inc;
        if (phase >= TABLE_SIZE) phase -= TABLE_SIZE;
      }
    }
  }

  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  const target = options.peak ?? 0.89;
  if (peak > 0) {
    const g = target / peak;
    for (let i = 0; i < out.length; i++) out[i] *= g;
  }
  return out;
}

export interface TempoWarpSpec {
  /** silence before the first measure, recording seconds */
  leadingSilenceSec: number;
  /** score second at which the tempo factor switches */
  splitScoreSec: number;
  /** tempo multiplier before the split (1.04 = 4% faster) */
  firstTempoFactor: number;
  /** tempo multiplier after the split (0.95 = 5% slower) */
  secondTempoFactor: number;
}

/** Piecewise-linear score → recording warp: lead-in silence, then two tempo factors. */
export function makeTempoWarp(spec: TempoWarpSpec): (scoreSec: number) => number {
  const { leadingSilenceSec, splitScoreSec, firstTempoFactor, secondTempoFactor } = spec;
  return (s: number) =>
    s <= splitScoreSec
      ? leadingSilenceSec + s / firstTempoFactor
      : leadingSilenceSec + splitScoreSec / firstTempoFactor + (s - splitScoreSec) / secondTempoFactor;
}
