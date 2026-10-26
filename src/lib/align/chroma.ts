/**
 * Chroma features from a mono recording. Pure TS (runs in a worker, on the
 * main thread, or in Node tests).
 *
 * Pipeline: downsample to ≤ 22050 Hz (windowed-sinc FIR + decimation) →
 * centered STFT (Hann, window 2·hop, radix-2 FFT; at 22050 Hz that is the
 * classic 4096 / 2048 frame / hop) → power in 65 Hz – 2.1 kHz folded onto 12
 * pitch classes with a log-frequency (semitone-centered) weighting → log
 * compression → L2 normalization per frame. Frame j is centered at
 * j · hopSec seconds of *recording* time.
 */

export const PITCH_CLASSES = 12;
export const MAX_ANALYSIS_RATE = 22050;
/** 2048 samples at 22050 Hz ≈ 92.9 ms */
export const DEFAULT_HOP_SEC = 2048 / 22050;

export interface ChromaFeatures {
  /** seconds between frame centers */
  hopSec: number;
  /** number of frames */
  n: number;
  /** frame-major: frames[j * 12 + pc], each frame L2-normalized */
  frames: Float32Array;
  /** per-frame energy before normalization (relative units, ≥ 0) */
  energy: Float32Array;
}

export interface AudioChromaOptions {
  hopSec?: number;
  minHz?: number;
  maxHz?: number;
  /** called with 0–1 while frames are computed; may throw to abort */
  onProgress?: (fraction: number) => void;
}

/** In-place iterative radix-2 FFT. `re.length` must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

export function nextPow2(v: number): number {
  let p = 1;
  while (p < v) p <<= 1;
  return p;
}

/** Low-pass and decimate by an integer factor so the rate is ≤ maxRate. */
export function downsample(samples: Float32Array, sampleRate: number, maxRate = MAX_ANALYSIS_RATE): { samples: Float32Array; sampleRate: number } {
  const factor = Math.ceil(sampleRate / maxRate - 1e-9);
  if (factor <= 1) return { samples, sampleRate };
  const half = 8 * factor;
  const taps = new Float64Array(2 * half + 1);
  const cutoff = 0.45 / factor; // cycles per input sample
  let sum = 0;
  for (let t = -half; t <= half; t++) {
    const sinc = t === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * t) / (Math.PI * t);
    const w = 0.5 + 0.5 * Math.cos((Math.PI * t) / (half + 1));
    taps[t + half] = sinc * w;
    sum += sinc * w;
  }
  for (let i = 0; i < taps.length; i++) taps[i] /= sum;
  const outLen = Math.floor(samples.length / factor);
  const out = new Float32Array(outLen);
  const n = samples.length;
  for (let k = 0; k < outLen; k++) {
    const c = k * factor;
    let acc = 0;
    const t0 = Math.max(-half, -c);
    const t1 = Math.min(half, n - 1 - c);
    for (let t = t0; t <= t1; t++) acc += taps[t + half] * samples[c + t];
    out[k] = acc;
  }
  return { samples: out, sampleRate: sampleRate / factor };
}

interface ChromaBin {
  bin: number;
  pc: number;
  weight: number;
}

function chromaBins(fftSize: number, sampleRate: number, minHz: number, maxHz: number): ChromaBin[] {
  const bins: ChromaBin[] = [];
  const k0 = Math.max(1, Math.ceil((minHz * fftSize) / sampleRate));
  const k1 = Math.min(fftSize / 2 - 1, Math.floor((maxHz * fftSize) / sampleRate));
  for (let k = k0; k <= k1; k++) {
    const f = (k * sampleRate) / fftSize;
    const midi = 69 + 12 * Math.log2(f / 440);
    const nearest = Math.round(midi);
    // semitone-centered weighting: 1 at the pitch, 0.5 a quarter-tone away
    const w = Math.cos(Math.PI * (midi - nearest)) ** 2;
    bins.push({ bin: k, pc: ((nearest % 12) + 12) % 12, weight: w });
  }
  return bins;
}

/**
 * Log-compress and L2-normalize raw pitch-class energies in place.
 * `gamma` controls compression; frames far below the loudest frame tend to a
 * flat (uniform) vector, which is also what silence and rests map to.
 */
export function compressAndNormalize(raw: Float32Array, n: number, gamma = 1000, floor = 0.01): void {
  let maxE = 0;
  for (let j = 0; j < n; j++) {
    let e = 0;
    for (let c = 0; c < PITCH_CLASSES; c++) e += raw[j * PITCH_CLASSES + c];
    if (e > maxE) maxE = e;
  }
  const scale = maxE > 0 ? gamma / maxE : 0;
  for (let j = 0; j < n; j++) {
    let norm = 0;
    const o = j * PITCH_CLASSES;
    for (let c = 0; c < PITCH_CLASSES; c++) {
      const v = Math.log1p(raw[o + c] * scale) + floor;
      raw[o + c] = v;
      norm += v * v;
    }
    norm = Math.sqrt(norm);
    for (let c = 0; c < PITCH_CLASSES; c++) raw[o + c] /= norm;
  }
}

/** Chroma features of a mono recording. */
export function audioChroma(samples: Float32Array, sampleRate: number, options: AudioChromaOptions = {}): ChromaFeatures {
  const down = downsample(samples, sampleRate);
  const x = down.samples;
  const sr = down.sampleRate;
  const hop = Math.max(64, Math.round((options.hopSec ?? DEFAULT_HOP_SEC) * sr));
  const win = 2 * hop;
  const fftSize = nextPow2(win);
  const hopSec = hop / sr;
  const n = Math.floor(x.length / hop) + 1;
  const bins = chromaBins(fftSize, sr, options.minHz ?? 65, options.maxHz ?? 2100);

  const window = new Float64Array(win);
  for (let i = 0; i < win; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / win);

  const raw = new Float32Array(n * PITCH_CLASSES);
  const energy = new Float32Array(n);
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const report = Math.max(1, Math.floor(n / 20));

  for (let j = 0; j < n; j++) {
    re.fill(0);
    im.fill(0);
    const start = j * hop - hop; // centered: frame j spans [j·hop − hop, j·hop + hop)
    for (let i = 0; i < win; i++) {
      const s = start + i;
      if (s >= 0 && s < x.length) re[i] = x[s] * window[i];
    }
    fft(re, im);
    let e = 0;
    const o = j * PITCH_CLASSES;
    for (const b of bins) {
      const p = re[b.bin] * re[b.bin] + im[b.bin] * im[b.bin];
      raw[o + b.pc] += p * b.weight;
      e += p * b.weight;
    }
    energy[j] = e;
    if (options.onProgress && j % report === 0) options.onProgress(j / n);
  }
  compressAndNormalize(raw, n);
  options.onProgress?.(1);
  return { hopSec, n, frames: raw, energy };
}

/** Index range [first, last] of frames whose energy is within `dbRange` dB of the loud frames, or null if silent. */
export function activeRange(energy: Float32Array, dbRange = 45): { first: number; last: number } | null {
  const sorted = Array.from(energy).sort((a, b) => a - b);
  const ref = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  if (!(ref > 0)) return null;
  const threshold = ref * Math.pow(10, -dbRange / 10);
  let first = -1;
  let last = -1;
  for (let j = 0; j < energy.length; j++) {
    if (energy[j] > threshold) {
      if (first < 0) first = j;
      last = j;
    }
  }
  return first < 0 ? null : { first, last };
}
