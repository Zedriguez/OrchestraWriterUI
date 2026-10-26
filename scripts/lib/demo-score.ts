import { createRng } from "../../src/lib/utils/rng";
import type { TempoWarpSpec } from "../../src/lib/score/synth-notes";
import type { WEvent, WMeasure, WPart, WScore } from "./musicxml-writer";

/**
 * "Overture in D" — the generated 14-part demo score (fixtures/scores/orchestra-demo.musicxml).
 * 48 written measures of 4/4 at 112 bpm, Meno mosso 96 from bar 33, bars 9–16
 * repeated (56 measures in playback order), a general pause in bar 32, dynamics
 * pp–ff, chords, ties, two voices in Violin I, pizzicato strings in the repeat,
 * and a B♭ clarinet written a whole tone above sounding pitch.
 *
 * Deterministic: a fixed seed and no clocks.
 */

export const DEMO_TITLE = "Overture in D";
export const DEMO_COMPOSER = "Fixture Orchestra";
export const DEMO_MOVEMENT = "I. Allegro";
export const DEMO_MEASURES = 48;
export const DEMO_TEMPO = 112;
export const DEMO_TEMPO_B = 96;
export const DEMO_TEMPO_CHANGE_BAR = 33;
export const DEMO_GP_BAR = 32;
export const DEMO_REPEAT = [9, 16] as const;

/** The deliberate mismatch between score time and the demo recording. */
export function demoWarpSpec(scoreDurationSec: number): TempoWarpSpec {
  return { leadingSilenceSec: 1.2, splitScoreSec: scoreDurationSec / 2, firstTempoFactor: 1.04, secondTempoFactor: 0.95 };
}

/* ------------------------------------------------------------------ */
/* Harmony                                                             */
/* ------------------------------------------------------------------ */

const CH: Record<string, number[]> = {
  I: [2, 6, 9],
  ii: [4, 7, 11],
  iii: [6, 9, 1],
  IV: [7, 11, 2],
  V: [9, 1, 4],
  V7: [9, 1, 4, 7],
  vi: [11, 2, 6],
};

// one chord per written bar (bar 32 is the general pause)
const PROGRESSION = [
  "I", "I", "IV", "V", "vi", "ii", "V", "I", // A 1–8
  "I", "vi", "IV", "V", "I", "IV", "V7", "I", // B 9–16 (repeated)
  "IV", "V", "iii", "vi", "ii", "V", "I", "V7", // C 17–24
  "vi", "IV", "I", "V", "vi", "ii", "V", "V7", // D 25–31, 32 G.P.
  "I", "iii", "IV", "I", "vi", "ii", "V", "I", // E 33–40
  "IV", "V", "vi", "iii", "IV", "ii", "V7", "I", // F 41–48
];

const SCALE = [2, 4, 6, 7, 9, 11, 1];
const pc = (m: number) => ((m % 12) + 12) % 12;
const chordOf = (bar: number) => CH[PROGRESSION[bar - 1]];
const rootOf = (bar: number) => chordOf(bar)[0];

function tonesIn(chord: number[], lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (chord.includes(pc(m))) out.push(m);
  return out;
}

function nearest(cands: number[], target: number): number {
  let best = cands[0];
  for (const c of cands) if (Math.abs(c - target) < Math.abs(best - target)) best = c;
  return best;
}

function scaleStep(m: number, dir: 1 | -1): number {
  let x = m + dir;
  while (!SCALE.includes(pc(x))) x += dir;
  return x;
}

function lowest(pitchClass: number, lo: number): number {
  let m = lo;
  while (pc(m) !== pitchClass) m++;
  return m;
}

/* ------------------------------------------------------------------ */
/* Roles: one measure of music for one part                            */
/* ------------------------------------------------------------------ */

type Role =
  | "rest"
  | "melody"
  | "melody2v"
  | "counter"
  | "pulse8"
  | "pulse8stacc"
  | "pizzPulse"
  | "bassQ"
  | "bassQstacc"
  | "bassH"
  | "sustain"
  | "arp"
  | "brass"
  | "timp"
  | "timpRoll"
  | "doubleStop"
  | "chordHits"
  | "final";

type Dyn = "pp" | "p" | "mp" | "mf" | "f" | "ff";

interface PartPlan {
  id: string;
  name: string;
  abbreviation?: string;
  instrumentSound: string;
  midiProgram: number;
  clef: "treble" | "bass" | "alto";
  clef2?: "treble" | "bass";
  transposeChromatic?: number;
  transposeDiatonic?: number;
  /** sounding range for melodic material */
  range: [number, number];
  strings?: boolean;
  /** [fromBar, toBar, role, dynamic at fromBar] */
  plan: Array<[number, number, Role, Dyn?]>;
}

const MELODY_RHYTHMS = [
  [4, 4, 4, 4],
  [6, 2, 4, 4],
  [4, 4, 8],
  [8, 4, 4],
  [2, 2, 4, 4, 4],
  [4, 2, 2, 4, 4],
  [12, 4],
  [4, 4, 4, 2, 2],
];
const COUNTER_RHYTHMS = [[8, 8], [12, 4], [4, 4, 8], [16], [8, 4, 4]];

interface Ctx {
  bar: number;
  part: PartPlan;
  rng: ReturnType<typeof createRng>;
  prev: { pitch: number };
}

function melodyEvents(ctx: Ctx, rhythms: number[][], slur: boolean): WEvent[] {
  const { rng, part, bar, prev } = ctx;
  const [lo, hi] = part.range;
  const chord = chordOf(bar);
  const rhythm = rng.pick(rhythms);
  const events: WEvent[] = [];
  let offset = 0;
  let pitch = prev.pitch || Math.round((lo + hi) / 2);
  rhythm.forEach((dur, i) => {
    const strong = offset % 8 === 0;
    if (strong || i === 0) {
      pitch = nearest(tonesIn(chord, lo, hi), pitch + rng.int(-4, 4));
    } else {
      const dir: 1 | -1 = pitch > hi - 4 ? -1 : pitch < lo + 4 ? 1 : rng.chance(0.5) ? 1 : -1;
      pitch = scaleStep(pitch, dir);
      if (rng.chance(0.35)) pitch = scaleStep(pitch, dir);
      pitch = Math.max(lo, Math.min(hi, pitch));
    }
    events.push({
      offset,
      dur,
      pitches: [pitch],
      voice: 1,
      slur: slur && rhythm.length > 1 ? (i === 0 ? "start" : i === rhythm.length - 1 ? "stop" : undefined) : undefined,
    });
    offset += dur;
  });
  prev.pitch = pitch;
  return events;
}

function roleEvents(role: Role, ctx: Ctx): WEvent[] {
  const { bar, part, rng } = ctx;
  const chord = chordOf(bar);
  const [lo, hi] = part.range;
  const mid = Math.round((lo + hi) / 2);
  switch (role) {
    case "rest":
      return [];
    case "melody":
      return melodyEvents(ctx, MELODY_RHYTHMS, true);
    case "counter":
      return melodyEvents(ctx, COUNTER_RHYTHMS, false).map((e, i) => (i === 0 ? { ...e, articulation: "tenuto" as const } : e));
    case "melody2v": {
      const top = melodyEvents(ctx, MELODY_RHYTHMS, true);
      const below = nearest(tonesIn(chord, lo - 7, mid), mid - 5);
      return [...top, { offset: 0, dur: 16, pitches: [below], voice: 2 }];
    }
    case "pulse8":
    case "pulse8stacc":
    case "pizzPulse": {
      const tones = tonesIn(chord, lo, Math.min(hi, lo + 14));
      const a = tones[0];
      const b = tones[Math.min(tones.length - 1, 1 + (bar % 2))];
      const step = role === "pizzPulse" ? 4 : 2;
      const out: WEvent[] = [];
      for (let o = 0; o < 16; o += step) {
        out.push({
          offset: o,
          dur: step,
          pitches: [(o / step) % 2 === 0 ? a : b],
          voice: 1,
          articulation: role === "pulse8stacc" ? "staccato" : undefined,
        });
      }
      return out;
    }
    case "bassQ":
    case "bassQstacc": {
      const root = lowest(rootOf(bar), lo);
      const fifth = lowest(pc(rootOf(bar) + 7), lo);
      return [0, 4, 8, 12].map((o, i) => ({
        offset: o,
        dur: 4,
        pitches: [i % 2 === 0 ? root : fifth],
        voice: 1 as const,
        articulation: role === "bassQstacc" ? ("staccato" as const) : undefined,
      }));
    }
    case "bassH": {
      const root = lowest(rootOf(bar), lo);
      return [
        { offset: 0, dur: 8, pitches: [root], voice: 1 },
        { offset: 8, dur: 8, pitches: [lowest(pc(rootOf(bar) + 7), lo)], voice: 1 },
      ];
    }
    case "sustain": {
      const tones = tonesIn(chord, lo, hi);
      const pick = nearest(tones, ctx.prev.pitch || mid);
      ctx.prev.pitch = pick;
      return [{ offset: 0, dur: 16, pitches: [pick], voice: 1 }];
    }
    case "arp": {
      const tones = tonesIn(chord, lo, hi).slice(0, 6);
      const out: WEvent[] = [];
      for (let o = 0, k = 0; o < 16; o += 2, k++) {
        const up = Math.floor(k / tones.length) % 2 === 0;
        const idx = k % tones.length;
        out.push({ offset: o, dur: 2, pitches: [tones[up ? idx : tones.length - 1 - idx]], voice: 1, staff: 1 });
      }
      if (part.clef2) {
        const root = lowest(rootOf(bar), 38);
        out.push({ offset: 0, dur: 8, pitches: [root, root + 12], voice: 2, staff: 2 });
        out.push({ offset: 8, dur: 8, pitches: [lowest(pc(rootOf(bar) + 7), 38)], voice: 2, staff: 2 });
      }
      return out;
    }
    case "brass": {
      const tones = tonesIn(chord, lo, hi);
      const p1 = nearest(tones, mid + 3);
      const p2 = nearest(tones, mid - 2);
      return [
        { offset: 0, dur: 4, pitches: [p1], voice: 1, articulation: "accent" },
        { offset: 4, dur: 2, pitches: [p2], voice: 1 },
        { offset: 6, dur: 2, pitches: [p2], voice: 1 },
        { offset: 8, dur: 8, pitches: [p1], voice: 1 },
      ];
    }
    case "timp": {
      const pitch = chord.includes(9) && !chord.includes(2) ? 45 : 50;
      return [
        { offset: 0, dur: 4, pitches: [pitch], voice: 1, articulation: "accent" },
        { offset: 8, dur: 4, pitches: [pitch], voice: 1 },
      ];
    }
    case "timpRoll": {
      const pitch = chord.includes(9) && !chord.includes(2) ? 45 : 50;
      return [{ offset: 0, dur: 16, pitches: [pitch], voice: 1, tremolo: true }];
    }
    case "doubleStop": {
      const tones = tonesIn(chord, lo, hi);
      return [0, 4, 8, 12].map((o) => {
        const top = nearest(tones, mid + rng.int(-2, 4));
        const below = tones[Math.max(0, tones.indexOf(top) - 1)];
        return { offset: o, dur: 4, pitches: below === top ? [top] : [below, top], voice: 1 as const };
      });
    }
    case "chordHits": {
      const tones = tonesIn(chord, lo, hi);
      const triad = tones.slice(Math.max(0, Math.floor(tones.length / 2) - 1), Math.floor(tones.length / 2) + 2);
      return [
        { offset: 0, dur: 4, pitches: triad, voice: 1, staff: 1, articulation: "accent" },
        { offset: 4, dur: 4, pitches: triad, voice: 1, staff: 1 },
        { offset: 8, dur: 8, pitches: triad, voice: 1, staff: 1 },
        ...(part.clef2 ? [{ offset: 0, dur: 16, pitches: [lowest(rootOf(bar), 38)], voice: 2 as const, staff: 2 as const }] : []),
      ];
    }
    case "final": {
      if (part.id === "P8") return [{ offset: 0, dur: 16, pitches: [50], voice: 1, tremolo: true }];
      const tones = tonesIn(CH.I, lo, hi);
      const top = nearest(tones, mid);
      const pitches = part.clef2 ? [...new Set([nearest(tones, top - 4), top])] : [top];
      const out: WEvent[] = [{ offset: 0, dur: 16, pitches, voice: 1, staff: 1, articulation: "strong-accent" }];
      if (part.clef2) out.push({ offset: 0, dur: 16, pitches: [lowest(2, 38)], voice: 2, staff: 2 });
      return out;
    }
  }
}

/* ------------------------------------------------------------------ */
/* The orchestra                                                       */
/* ------------------------------------------------------------------ */

const PARTS: PartPlan[] = [
  {
    id: "P1", name: "Flute", abbreviation: "Fl.", instrumentSound: "wind.flutes.flute", midiProgram: 74, clef: "treble", range: [74, 93],
    plan: [[1, 4, "rest"], [5, 8, "melody", "p"], [9, 16, "melody", "mf"], [17, 24, "melody", "f"], [25, 36, "rest"], [37, 40, "counter", "p"], [41, 44, "melody", "f"], [45, 47, "melody", "ff"], [48, 48, "final"]],
  },
  {
    id: "P2", name: "Oboe", abbreviation: "Ob.", instrumentSound: "wind.reed.oboe", midiProgram: 69, clef: "treble", range: [64, 84],
    plan: [[1, 8, "rest"], [9, 16, "counter", "mf"], [17, 24, "sustain", "f"], [25, 28, "rest"], [29, 31, "sustain", "p"], [32, 36, "rest"], [37, 40, "sustain", "p"], [41, 44, "melody", "f"], [45, 47, "melody", "ff"], [48, 48, "final"]],
  },
  {
    id: "P3", name: "Clarinet in B♭", abbreviation: "Cl.", instrumentSound: "wind.reed.clarinet.bflat", midiProgram: 72, clef: "treble",
    transposeChromatic: -2, transposeDiatonic: -1, range: [58, 79],
    plan: [[1, 8, "rest"], [9, 16, "arp", "mp"], [17, 24, "sustain", "f"], [25, 31, "melody", "mp"], [32, 32, "rest"], [33, 40, "counter", "p"], [41, 44, "sustain", "f"], [45, 47, "sustain", "ff"], [48, 48, "final"]],
  },
  {
    id: "P4", name: "Bassoon", abbreviation: "Bsn.", instrumentSound: "wind.reed.bassoon", midiProgram: 71, clef: "bass", range: [41, 62],
    plan: [[1, 8, "rest"], [9, 16, "bassQstacc", "mp"], [17, 24, "bassQ", "f"], [25, 31, "sustain", "p"], [32, 32, "rest"], [33, 40, "melody", "mf"], [41, 44, "bassQ", "f"], [45, 47, "bassQ", "ff"], [48, 48, "final"]],
  },
  {
    id: "P5", name: "Horn in F", abbreviation: "Hn.", instrumentSound: "brass.french-horn", midiProgram: 61, clef: "treble", range: [53, 70],
    plan: [[1, 4, "rest"], [5, 8, "sustain", "pp"], [9, 16, "sustain", "mp"], [17, 24, "brass", "f"], [25, 32, "rest"], [33, 40, "sustain", "mp"], [41, 44, "brass", "f"], [45, 47, "brass", "ff"], [48, 48, "final"]],
  },
  {
    id: "P6", name: "Trumpet in C", abbreviation: "Tpt.", instrumentSound: "brass.trumpet", midiProgram: 57, clef: "treble", range: [62, 79],
    plan: [[1, 16, "rest"], [17, 24, "brass", "f"], [25, 40, "rest"], [41, 44, "brass", "f"], [45, 47, "brass", "ff"], [48, 48, "final"]],
  },
  {
    id: "P7", name: "Trombone", abbreviation: "Tbn.", instrumentSound: "brass.trombone", midiProgram: 58, clef: "bass", range: [43, 65],
    plan: [[1, 16, "rest"], [17, 24, "sustain", "f"], [25, 36, "rest"], [37, 40, "sustain", "pp"], [41, 44, "brass", "f"], [45, 47, "brass", "ff"], [48, 48, "final"]],
  },
  {
    id: "P8", name: "Timpani", abbreviation: "Timp.", instrumentSound: "drum.timpani", midiProgram: 48, clef: "bass", range: [45, 50],
    plan: [[1, 7, "rest"], [8, 8, "timp", "p"], [9, 16, "rest"], [17, 23, "timp", "f"], [24, 24, "timpRoll", "ff"], [25, 40, "rest"], [41, 47, "timp", "ff"], [48, 48, "final"]],
  },
  {
    id: "P9", name: "Harp", instrumentSound: "pluck.harp", midiProgram: 47, clef: "treble", clef2: "bass", range: [62, 86],
    plan: [[1, 24, "rest"], [25, 31, "arp", "p"], [32, 32, "rest"], [33, 40, "arp", "mp"], [41, 44, "chordHits", "f"], [45, 47, "rest"], [48, 48, "final", "ff"]],
  },
  {
    id: "P10", name: "Violin I", abbreviation: "Vln. I", instrumentSound: "strings.violin", midiProgram: 41, clef: "treble", range: [67, 88], strings: true,
    plan: [[1, 4, "melody", "p"], [5, 8, "melody2v", "mp"], [9, 16, "pizzPulse", "p"], [17, 20, "melody", "f"], [21, 24, "melody2v", "ff"], [25, 31, "sustain", "pp"], [32, 32, "rest"], [33, 40, "counter", "p"], [41, 44, "melody", "f"], [45, 47, "melody", "ff"], [48, 48, "final"]],
  },
  {
    id: "P11", name: "Violin II", abbreviation: "Vln. II", instrumentSound: "strings.violin", midiProgram: 41, clef: "treble", range: [62, 81], strings: true,
    plan: [[1, 8, "pulse8", "p"], [9, 16, "pizzPulse", "p"], [17, 24, "doubleStop", "f"], [25, 31, "sustain", "pp"], [32, 32, "rest"], [33, 40, "pulse8", "p"], [41, 44, "doubleStop", "f"], [45, 47, "doubleStop", "ff"], [48, 48, "final"]],
  },
  {
    id: "P12", name: "Viola", abbreviation: "Vla.", instrumentSound: "strings.viola", midiProgram: 42, clef: "alto", range: [55, 74], strings: true,
    plan: [[1, 8, "pulse8", "p"], [9, 16, "pizzPulse", "p"], [17, 24, "pulse8stacc", "f"], [25, 31, "sustain", "pp"], [32, 32, "rest"], [33, 40, "sustain", "mp"], [41, 44, "pulse8", "f"], [45, 47, "pulse8", "ff"], [48, 48, "final"]],
  },
  {
    id: "P13", name: "Cello", abbreviation: "Vc.", instrumentSound: "strings.cello", midiProgram: 43, clef: "bass", range: [43, 64], strings: true,
    plan: [[1, 8, "bassQ", "p"], [9, 16, "bassQ", "p"], [17, 24, "bassQ", "f"], [25, 31, "sustain", "pp"], [32, 32, "rest"], [33, 40, "melody", "mf"], [41, 44, "bassQ", "f"], [45, 47, "bassQ", "ff"], [48, 48, "final"]],
  },
  {
    id: "P14", name: "Double Bass", instrumentSound: "strings.contrabass", midiProgram: 44, clef: "bass", range: [31, 50], strings: true,
    plan: [[1, 8, "bassH", "p"], [9, 16, "bassQ", "p"], [17, 24, "bassQ", "f"], [25, 31, "sustain", "pp"], [32, 32, "rest"], [33, 40, "bassH", "mp"], [41, 44, "bassQ", "f"], [45, 47, "bassQ", "ff"], [48, 48, "final"]],
  },
];

function roleAt(part: PartPlan, bar: number): { role: Role; dyn?: Dyn; startsRange: boolean } {
  for (const [from, to, role, dyn] of part.plan) {
    if (bar >= from && bar <= to) return { role, dyn, startsRange: bar === from };
  }
  return { role: "rest", startsRange: false };
}

export function buildDemoScore(): WScore {
  const parts: WPart[] = PARTS.map((part, pi) => {
    const prev = { pitch: 0 };
    let currentDyn: Dyn | null = null;
    const measures: WMeasure[] = [];
    for (let bar = 1; bar <= DEMO_MEASURES; bar++) {
      const rng = createRng(1009 * (pi + 1) + bar * 7919);
      const { role, dyn, startsRange } = roleAt(part, bar);
      const gp = bar === DEMO_GP_BAR;
      const events = gp ? [] : roleEvents(bar === DEMO_MEASURES ? "final" : role, { bar, part, rng, prev });
      const m: WMeasure = { events, directions: [], rest: events.length === 0 };

      let wantDyn: Dyn | undefined = startsRange ? dyn : undefined;
      if (bar === DEMO_MEASURES) wantDyn = "ff";
      if (wantDyn && events.length > 0 && wantDyn !== currentDyn) {
        m.directions.push({ offset: 0, dynamic: wantDyn });
        currentDyn = wantDyn;
      }
      // a re-entry after rests restates the dynamic, as a copyist would
      if (!wantDyn && events.length > 0 && measures.length > 0 && measures[measures.length - 1].rest && currentDyn) {
        m.directions.push({ offset: 0, dynamic: currentDyn });
      }
      if (part.strings && bar === DEMO_REPEAT[0]) m.directions.push({ offset: 0, words: "pizz.", pizzicato: true });
      if (part.strings && bar === DEMO_REPEAT[1] + 1) m.directions.push({ offset: 0, words: "arco", pizzicato: false });
      if (pi === 0 && bar === 1) m.directions.push({ offset: 0, words: "Allegro", tempo: DEMO_TEMPO });
      if (pi === 0 && bar === DEMO_TEMPO_CHANGE_BAR) m.directions.push({ offset: 0, words: "Meno mosso", tempo: DEMO_TEMPO_B });
      if (pi === 0 && bar === DEMO_GP_BAR) m.directions.push({ offset: 0, words: "G.P." });
      if (bar === DEMO_REPEAT[0]) m.forwardRepeat = true;
      if (bar === DEMO_REPEAT[1]) m.backwardRepeat = true;
      if (bar === DEMO_MEASURES) m.finalBarline = true;
      measures.push(m);
    }

    // tie sustained notes that repeat the same pitch into the next bar (not across the repeat or into rests)
    for (let i = 0; i + 1 < measures.length; i++) {
      const bar = i + 1;
      if (bar === DEMO_REPEAT[1] || bar + 1 === DEMO_REPEAT[0]) continue;
      if (roleAt(part, bar).role !== "sustain" || roleAt(part, bar + 1).role !== "sustain") continue;
      const a = measures[i].events;
      const b = measures[i + 1].events;
      if (a.length === 1 && b.length === 1 && a[0].pitches.length === 1 && b[0].pitches[0] === a[0].pitches[0] && b[0].offset === 0) {
        a[0].tieStart = true;
        b[0].tieStop = true;
      }
    }

    return {
      id: part.id,
      name: part.name,
      abbreviation: part.abbreviation,
      instrumentSound: part.instrumentSound,
      midiProgram: part.midiProgram,
      // channel 10 is the GM drum channel; pitched parts skip it
      midiChannel: pi + 1 >= 10 ? pi + 2 : pi + 1,
      clef: part.clef,
      clef2: part.clef2,
      transposeChromatic: part.transposeChromatic,
      transposeDiatonic: part.transposeDiatonic,
      measures,
    };
  });

  return { title: DEMO_TITLE, movement: DEMO_MOVEMENT, composer: DEMO_COMPOSER, fifths: 2, beats: 4, beatType: 4, parts };
}
