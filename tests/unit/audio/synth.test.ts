import { describe, expect, it } from "vitest";
import {
  VOICE_ADSR,
  collectSynthNotes,
  envelopePoints,
  lowerBound,
  midiToHz,
  partBusGain,
  scheduleWindow,
  velocityFor,
  voiceForInstrument,
  type SynthNote,
} from "@/lib/audio/synth";
import { DYNAMICS } from "@/shared/dynamics";
import type { InfoMap } from "@/shared/info-map";

function n(time: number, duration = 0.5, part = 0): SynthNote {
  return { time, duration, pitch: 60, velocity: 0.5, voice: "strings", part };
}

describe("scheduleWindow", () => {
  const notes = [n(0), n(0.5), n(1), n(1, 0.5, 1), n(1.5), n(2, 4), n(3)];

  it("returns notes starting in [from, to)", () => {
    expect(scheduleWindow(notes, 1, 2).map((x) => x.time)).toEqual([1, 1, 1.5]);
    expect(scheduleWindow(notes, 0, 0.5).map((x) => x.time)).toEqual([0]);
    expect(scheduleWindow(notes, 3.5, 10)).toEqual([]);
    expect(scheduleWindow(notes, 2, 2)).toEqual([]);
  });

  it("tiles the score with no gaps or duplicates", () => {
    const seen: SynthNote[] = [];
    for (let t = 0; t < 4; t += 0.25) seen.push(...scheduleWindow(notes, t, t + 0.25));
    expect(seen).toEqual(notes);
  });

  it("adds notes still sounding at a seek point", () => {
    const after = scheduleWindow(notes, 2.5, 3.2, { includeSounding: true, maxDuration: 4 });
    expect(after.map((x) => x.time)).toEqual([2, 3]);
    // without maxDuration the scan still finds it
    expect(scheduleWindow(notes, 2.5, 3.2, { includeSounding: true }).map((x) => x.time)).toEqual([2, 3]);
    // a note that ends right at the seek point is not restarted
    expect(scheduleWindow(notes, 1.5, 1.6, { includeSounding: true }).map((x) => x.time)).toEqual([1.5]);
  });

  it("finds the lower bound", () => {
    expect(lowerBound(notes, -1)).toBe(0);
    expect(lowerBound(notes, 1)).toBe(2);
    expect(lowerBound(notes, 99)).toBe(notes.length);
  });
});

describe("envelopePoints", () => {
  const adsr = { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.3 };

  it("attacks to peak, decays to sustain, holds, releases to zero", () => {
    expect(envelopePoints(adsr, 10, 1, 0.8)).toEqual([
      [10, 0],
      [10.1, 0.8],
      [expect.closeTo(10.3), 0.4],
      [11, 0.4],
      [11.3, 0],
    ]);
  });

  it("releases from mid-attack for very short notes", () => {
    const pts = envelopePoints(adsr, 0, 0.05, 1);
    expect(pts).toEqual([
      [0, 0],
      [0.05, expect.closeTo(0.5)],
      [expect.closeTo(0.35), 0],
    ]);
  });

  it("releases from mid-decay", () => {
    const pts = envelopePoints(adsr, 0, 0.2, 1);
    expect(pts[2][0]).toBeCloseTo(0.2);
    expect(pts[2][1]).toBeCloseTo(0.75);
    expect(pts.at(-1)![1]).toBe(0);
  });

  it("ends percussion after its decay even for long written notes", () => {
    const pts = envelopePoints(VOICE_ADSR.percussion, 0, 4, 1);
    expect(pts.at(-1)![1]).toBe(0);
    expect(pts.at(-1)![0]).toBeLessThan(0.2);
  });

  it("keeps times increasing", () => {
    for (const dur of [0, 0.01, 0.1, 0.25, 1, 5]) {
      const pts = envelopePoints(VOICE_ADSR.strings, 2, dur, 0.6);
      for (let i = 1; i < pts.length; i++) expect(pts[i][0]).toBeGreaterThan(pts[i - 1][0]);
    }
  });
});

describe("voices and levels", () => {
  it("maps sections to timbres", () => {
    expect(voiceForInstrument({ name: "Violin I", section: "Strings" })).toBe("strings");
    expect(voiceForInstrument({ name: "Clarinet", section: "Woodwinds" })).toBe("woodwinds");
    expect(voiceForInstrument({ name: "Trumpet", section: "Brass" })).toBe("brass");
    expect(voiceForInstrument({ name: "Timpani", section: "Percussion" })).toBe("timpani");
    expect(voiceForInstrument({ name: "Snare Drum", section: "Percussion" })).toBe("percussion");
    expect(voiceForInstrument({ name: "Glockenspiel", section: "Percussion" })).toBe("other");
    expect(voiceForInstrument({ name: "Harp", section: "Other" })).toBe("other");
  });

  it("raises velocity with the written dynamic", () => {
    const v = DYNAMICS.map(velocityFor);
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThan(v[i - 1]);
    expect(velocityFor("fff")).toBe(1);
  });

  it("converts MIDI to Hz", () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(57)).toBeCloseTo(220);
  });

  it("trims the bus for many parts", () => {
    expect(partBusGain(64)).toBeLessThan(partBusGain(4));
    expect(partBusGain(0)).toBe(partBusGain(1));
  });

  it("collects every note sorted by time with its part and voice", () => {
    const infoMap: InfoMap = {
      instruments: [
        { id: "P1", name: "Horn", shortName: "Hn.", section: "Brass", notes: [{ time: 1, duration: 1, pitch: 60, dynamics: "f", styleMarking: null, measure: 1 }] },
        {
          id: "P2",
          name: "Violin I",
          shortName: "Vln. I",
          section: "Strings",
          notes: [
            { time: 0, duration: 1, pitch: 67, dynamics: "p", styleMarking: null, measure: 1 },
            { time: 2, duration: 0, pitch: 67, dynamics: "p", styleMarking: null, measure: 1 },
          ],
        },
      ],
      measures: [{ number: 1, startTime: 0, duration: 4 }],
      duration: 4,
      tempo: 60,
      timeSignature: "4/4",
      warnings: [],
    };
    const notes = collectSynthNotes(infoMap);
    expect(notes.map((x) => [x.time, x.part, x.voice])).toEqual([
      [0, 1, "strings"],
      [1, 0, "brass"],
    ]);
    expect(notes[0].velocity).toBe(velocityFor("p"));
  });

  it("plays transposing parts at sounding pitch (info map keeps written pitch)", () => {
    const written = { time: 0, duration: 1, pitch: 62, dynamics: "mf" as const, styleMarking: null, measure: 1 };
    const infoMap: InfoMap = {
      instruments: [
        { id: "P1", name: "Clarinet in B-flat", shortName: "Cl.", section: "Woodwinds", transpose: -2, notes: [written] },
        { id: "P2", name: "Horn in F", shortName: "Hn.", section: "Brass", transpose: -7, notes: [written] },
        { id: "P3", name: "Flute", shortName: "Fl.", section: "Woodwinds", notes: [written] },
      ],
      measures: [{ number: 1, startTime: 0, duration: 1 }],
      duration: 1,
      tempo: 60,
      timeSignature: "4/4",
      warnings: [],
    };
    const pitches = Object.fromEntries(collectSynthNotes(infoMap).map((x) => [x.part, x.pitch]));
    expect(pitches).toEqual({ 0: 60, 1: 55, 2: 62 });
    expect(infoMap.instruments[0].notes[0].pitch).toBe(62);
  });
});
