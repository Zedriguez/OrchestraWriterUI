import { describe, expect, it } from "vitest";
import type { InfoMap } from "@/shared/info-map";
import { DEFAULT_HOP_SEC, PITCH_CLASSES, activeRange, audioChroma, downsample, fft } from "@/lib/align/chroma";
import { scoreChroma } from "@/lib/align/score-chroma";
import { createRng } from "@/lib/utils/rng";

const SR = 22050;

function tone(freqs: number[], seconds: number, sr = SR, leadSilence = 0): Float32Array {
  const out = new Float32Array(Math.round((seconds + leadSilence) * sr));
  const start = Math.round(leadSilence * sr);
  for (let i = start; i < out.length; i++) {
    for (const f of freqs) out[i] += Math.sin((2 * Math.PI * f * (i - start)) / sr) / freqs.length;
  }
  return out;
}

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function frame(features: { frames: Float32Array }, j: number): number[] {
  return Array.from(features.frames.subarray(j * PITCH_CLASSES, (j + 1) * PITCH_CLASSES));
}

const argmax = (v: number[]) => v.indexOf(Math.max(...v));
const norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));

describe("fft", () => {
  it("matches a naive DFT", () => {
    const n = 64;
    const rng = createRng(3);
    const x = Array.from({ length: n }, () => rng.range(-1, 1));
    const re = Float64Array.from(x);
    const im = new Float64Array(n);
    fft(re, im);
    for (const k of [0, 1, 5, 17, 32, 63]) {
      let r = 0;
      let i = 0;
      for (let t = 0; t < n; t++) {
        r += x[t] * Math.cos((-2 * Math.PI * k * t) / n);
        i += x[t] * Math.sin((-2 * Math.PI * k * t) / n);
      }
      expect(re[k]).toBeCloseTo(r, 9);
      expect(im[k]).toBeCloseTo(i, 9);
    }
  });
});

describe("downsample", () => {
  it("decimates to at most 22050 Hz and keeps in-band tones", () => {
    expect(downsample(new Float32Array(100), 22050).sampleRate).toBe(22050);
    expect(downsample(new Float32Array(100), 44100).sampleRate).toBe(22050);
    expect(downsample(new Float32Array(100), 48000).sampleRate).toBe(16000);
    const a = downsample(tone([440], 1, 48000), 48000);
    const peak = Math.max(...Array.from(a.samples.subarray(1000, 15000)).map(Math.abs));
    expect(peak).toBeGreaterThan(0.95);
    expect(peak).toBeLessThan(1.05);
  });

  it("removes content above the new Nyquist frequency", () => {
    const hi = downsample(tone([12000], 1, 48000), 48000);
    const peak = Math.max(...Array.from(hi.samples.subarray(1000, 15000)).map(Math.abs));
    expect(peak).toBeLessThan(0.05);
  });
});

describe("audioChroma", () => {
  it("emits 12 L2-normalized values per frame on a 2048-sample hop at 22050 Hz", () => {
    const x = tone([440], 2);
    const c = audioChroma(x, SR);
    expect(c.hopSec).toBeCloseTo(DEFAULT_HOP_SEC, 9);
    expect(c.n).toBe(Math.floor(x.length / 2048) + 1);
    expect(c.frames.length).toBe(12 * c.n);
    for (let j = 0; j < c.n; j++) expect(norm(frame(c, j))).toBeCloseTo(1, 5);
  });

  it("puts a sine's energy on its pitch class", () => {
    const a4 = audioChroma(tone([440], 2), SR);
    expect(argmax(frame(a4, 10))).toBe(9); // A
    const c5 = audioChroma(tone([midiHz(72)], 2, 44100), 44100);
    expect(argmax(frame(c5, 10))).toBe(0); // C, through the 44.1 kHz → 22.05 kHz path
  });

  it("finds the three pitch classes of a triad", () => {
    const c = audioChroma(tone([midiHz(60), midiHz(64), midiHz(67)], 2), SR);
    const v = frame(c, 10);
    const top3 = [...v.keys()].sort((a, b) => v[b] - v[a]).slice(0, 3).sort((a, b) => a - b);
    expect(top3).toEqual([0, 4, 7]);
  });

  it("maps silence to a flat vector and reports where sound starts", () => {
    const c = audioChroma(tone([440], 1, SR, 1.5), SR);
    for (const v of frame(c, 2)) expect(v).toBeCloseTo(1 / Math.sqrt(12), 5);
    const active = activeRange(c.energy)!;
    // sound starts at 1.5 s; frames are centered every ~92.9 ms with a ±92.9 ms window
    expect(active.first * c.hopSec).toBeGreaterThan(1.3);
    expect(active.first * c.hopSec).toBeLessThan(1.55);
    expect(activeRange(new Float32Array(10))).toBeNull();
  });
});

describe("scoreChroma", () => {
  const map: InfoMap = {
    instruments: [
      {
        id: "P1",
        name: "Clarinet in B♭",
        shortName: "Cl.",
        section: "Woodwinds",
        notes: [{ time: 1, duration: 1, pitch: 69, dynamics: "mf", styleMarking: null, measure: 1 }],
      },
    ],
    measures: [{ number: 1, startTime: 0, duration: 3 }],
    duration: 3,
    tempo: 120,
    timeSignature: "4/4",
    warnings: [],
  };

  it("renders notes on a score-time grid, normalized, flat where nothing sounds", () => {
    const c = scoreChroma(map, { hopSec: 0.1 });
    expect(c.n).toBe(31);
    expect(argmax(frame(c, 15))).toBe(9);
    expect(norm(frame(c, 15))).toBeCloseTo(1, 5);
    expect(c.energy[15]).toBeGreaterThan(0);
    expect(c.energy[5]).toBe(0);
    for (const v of frame(c, 5)) expect(v).toBeCloseTo(1 / Math.sqrt(12), 5);
    // the third harmonic shows up a fifth above (E) more than an unrelated pitch class
    const v = frame(c, 15);
    expect(v[4]).toBeGreaterThan(v[2]);
  });

  it("applies the written → sounding transposition", () => {
    const c = scoreChroma(map, { hopSec: 0.1, transpose: { P1: -2 } });
    expect(argmax(frame(c, 15))).toBe(7); // written A sounds G
  });
});
