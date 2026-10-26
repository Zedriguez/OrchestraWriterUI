import { describe, expect, it } from "vitest";
import { downmixToMono, normalizeToPercentile, peaksFromAudioBuffer, peaksFromInfoMap, resamplePeaks, toAlignAudio, type AudioBufferLike } from "@/lib/audio/decode";
import { BRIGHTNESS_LADDER, type Dynamic } from "@/shared/dynamics";
import type { InfoMap, Instrument, Note } from "@/shared/info-map";

function fakeBuffer(channels: Float32Array<ArrayBuffer>[], sampleRate = 100): AudioBufferLike {
  return {
    numberOfChannels: channels.length,
    length: channels[0].length,
    sampleRate,
    getChannelData: (c: number) => channels[c],
  };
}

function note(time: number, duration: number, dynamics: Dynamic): Note {
  return { time, duration, pitch: 60, dynamics, styleMarking: null, measure: 1 };
}

function part(id: string, notes: Note[]): Instrument {
  return { id, name: id, shortName: id, section: "Strings", notes };
}

function map(instruments: Instrument[], duration: number): InfoMap {
  return { instruments, measures: [{ number: 1, startTime: 0, duration }], duration, tempo: 120, timeSignature: "4/4", warnings: [] };
}

describe("peaksFromInfoMap", () => {
  it("is zero where nothing plays and 1 at the busiest bar", () => {
    const m = map([part("A", [note(0, 2, "p")]), part("B", [note(5, 3, "ff")]), part("C", [note(6, 1, "fff")])], 10);
    const peaks = peaksFromInfoMap(m, 10);
    expect(peaks).toHaveLength(10);
    expect(peaks[3]).toBe(0);
    expect(peaks[4]).toBe(0);
    expect(peaks[9]).toBe(0);
    expect(Math.max(...peaks)).toBe(1);
    // bar 6 has ff + fff, the loudest sum
    expect(peaks[6]).toBe(1);
    expect(peaks[0]).toBeCloseTo(BRIGHTNESS_LADDER.p / (BRIGHTNESS_LADDER.ff + BRIGHTNESS_LADDER.fff));
    expect(peaks[5]).toBeCloseTo(BRIGHTNESS_LADDER.ff / (BRIGHTNESS_LADDER.ff + BRIGHTNESS_LADDER.fff));
  });

  it("counts each part once per bar, at its loudest dynamic", () => {
    const m = map([part("A", [note(0, 0.3, "pp"), note(0.4, 0.3, "f"), note(0.8, 0.1, "p")]), part("B", [note(1.2, 0.5, "f")])], 2);
    const peaks = peaksFromInfoMap(m, 2);
    // bar 0: A at f; bar 1: B at f → equal
    expect(peaks[0]).toBeCloseTo(1);
    expect(peaks[1]).toBeCloseTo(1);
  });

  it("does not spill a note ending on a bar edge into the next bar", () => {
    const m = map([part("A", [note(0, 1, "mf")]), part("B", [note(1.5, 0.2, "pp")])], 2);
    const peaks = peaksFromInfoMap(m, 2);
    expect(peaks[0]).toBe(1);
    expect(peaks[1]).toBeCloseTo(BRIGHTNESS_LADDER.pp / BRIGHTNESS_LADDER.mf);
  });

  it("handles an empty score", () => {
    expect(peaksFromInfoMap(map([], 0), 5)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("peaksFromAudioBuffer", () => {
  it("takes max |sample| of the mono downmix per bar", () => {
    const l = new Float32Array(100);
    const r = new Float32Array(100);
    l[10] = 0.5;
    r[10] = 0.5; // in phase → 0.5
    l[60] = 0.8;
    r[60] = -0.8; // cancels in the downmix → 0
    l[90] = -0.4;
    r[90] = -0.4;
    // one sample per bar; mostly silence, so the reference falls back to the max (0.5)
    const peaks = peaksFromAudioBuffer(fakeBuffer([l, r]), 100);
    expect(peaks).toHaveLength(100);
    expect(peaks[10]).toBeCloseTo(1);
    expect(peaks[60]).toBe(0);
    expect(peaks[90]).toBeCloseTo(0.8);
  });

  it("normalizes to the 98th percentile so one spike doesn't flatten the rest", () => {
    const n = 1000;
    const data = new Float32Array(n);
    for (let i = 0; i < n; i++) data[i] = 0.1 * Math.sin(i);
    data[500] = 1; // single spike
    const peaks = peaksFromAudioBuffer(fakeBuffer([data]), 100);
    const sorted = [...peaks].sort((a, b) => a - b);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeGreaterThan(0.5);
    expect(Math.max(...peaks)).toBe(1);
  });

  it("returns zeros for silence", () => {
    expect(peaksFromAudioBuffer(fakeBuffer([new Float32Array(50)]), 5)).toEqual([0, 0, 0, 0, 0]);
    expect(normalizeToPercentile([], 0.98)).toEqual([]);
  });
});

describe("toAlignAudio / downmix / resample", () => {
  it("downmixes to mono with the buffer's rate and duration", () => {
    const a = toAlignAudio(fakeBuffer([Float32Array.from([1, 0, -1, 0.5]), Float32Array.from([0, 0, 1, 0.5])], 4));
    expect(Array.from(a.samples)).toEqual([0.5, 0, 0, 0.5]);
    expect(a.sampleRate).toBe(4);
    expect(a.durationSec).toBe(1);
    const mono = Float32Array.from([0.1, 0.2]);
    const copy = downmixToMono(fakeBuffer([mono]));
    expect(copy).not.toBe(mono);
    expect(Array.from(copy)).toEqual(Array.from(mono));
  });

  it("resamples peaks keeping maxima", () => {
    expect(resamplePeaks([0, 1, 0, 0.5], 2)).toEqual([1, 0.5]);
    expect(resamplePeaks([0.2, 0.4], 4)).toEqual([0.2, 0.2, 0.4, 0.4]);
    expect(resamplePeaks([], 3)).toEqual([0, 0, 0]);
  });
});
