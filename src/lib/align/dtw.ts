/**
 * Banded dynamic time warping between two sequences of L2-normalized feature
 * vectors (score chroma X, n frames; recording chroma Y, m frames).
 *
 * - Local cost: 1 − cosine similarity (= 1 − dot product).
 * - Step sizes (1,1), (2,1), (1,2): the local slope stays within [½, 2]. The
 *   (2,1)/(1,2) steps also pay for the cell they jump over, so a zig-zag is
 *   never cheaper than the diagonal.
 * - Sakoe–Chiba band of radius r around a center line from (0, startCenter)
 *   to (n−1, endCenter); memory is O(n · r) bytes for the step matrix plus
 *   three rows of accumulated cost, capped by `maxCells` (≈ 48 MB: a 10-minute
 *   piece keeps the full 20% band, a 40-minute one gets about ±2 minutes).
 * - Open begin / open end on the recording axis: frames before the path's
 *   first column and after its last column are "skipped" at `skipCost[j]`
 *   each (pass the cost of matching each frame to silence, so leading silence
 *   or applause is cheap to skip and music is not).
 */

export interface DtwOptions {
  /** feature dimension (12 for chroma) */
  dim?: number;
  /** band radius in frames (default: 20% of the longer sequence) */
  radius?: number;
  /** column the band is centered on at row 0 (default 0) */
  startCenter?: number;
  /** column the band is centered on at row n−1 (default m−1) */
  endCenter?: number;
  /** cost of leaving recording frame j unmatched before the start or after the end (default: no open ends) */
  skipCost?: Float32Array;
  /** upper bound on band cells (bytes of the step matrix); the radius shrinks to fit (default 48M) */
  maxCells?: number;
  /** called with 0–1 while rows are processed; may throw to abort */
  onProgress?: (fraction: number) => void;
}

export interface DtwResult {
  /** row (score frame) of each path cell, ascending */
  rows: Int32Array;
  /** column (recording frame) of each path cell, non-decreasing */
  cols: Int32Array;
  /** local cost of each path cell */
  costs: Float32Array;
  /** accumulated cost including skipped frames */
  total: number;
  radius: number;
}

const STEP_START = 0;
const STEP_DIAG = 1;
const STEP_2_1 = 2; // from (i−2, j−1) via (i−1, j)
const STEP_1_2 = 3; // from (i−1, j−2) via (i, j−1)

export function localCost(X: Float32Array, i: number, Y: Float32Array, j: number, dim: number): number {
  let dot = 0;
  const a = i * dim;
  const b = j * dim;
  for (let k = 0; k < dim; k++) dot += X[a + k] * Y[b + k];
  return 1 - dot;
}

export function dtw(X: Float32Array, Y: Float32Array, options: DtwOptions = {}): DtwResult {
  const dim = options.dim ?? 12;
  const n = Math.floor(X.length / dim);
  const m = Math.floor(Y.length / dim);
  if (n < 1 || m < 1) throw new Error("dtw: empty sequence");
  const maxCells = options.maxCells ?? 48_000_000;
  const requested = Math.max(2, Math.ceil(options.radius ?? 0.2 * Math.max(n, m)));
  // long recordings: keep the step matrix (n × (2r + 3) bytes) within budget
  const radius = Math.max(2, Math.min(requested, Math.floor((maxCells / n - 3) / 2)));
  const startCenter = options.startCenter ?? 0;
  const endCenter = options.endCenter ?? m - 1;
  const skip = options.skipCost;

  // band per row
  const lo = new Int32Array(n);
  const hi = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const c = n === 1 ? startCenter : startCenter + ((endCenter - startCenter) * i) / (n - 1);
    lo[i] = Math.max(0, Math.floor(c) - radius);
    hi[i] = Math.min(m - 1, Math.ceil(c) + radius);
    if (hi[i] < lo[i]) hi[i] = lo[i] = Math.max(0, Math.min(m - 1, Math.round(c)));
  }
  const stride = 2 * radius + 3;
  const steps = new Uint8Array(n * stride);

  // prefix sums of skip cost (open begin / open end)
  const prefix = new Float64Array(m + 1);
  for (let j = 0; j < m; j++) prefix[j + 1] = prefix[j] + (skip ? skip[j] : 0);
  const skippedBefore = (j: number) => (skip ? prefix[j] : j === 0 ? 0 : Infinity);
  const skippedAfter = (j: number) => (skip ? prefix[m] - prefix[j + 1] : j === m - 1 ? 0 : Infinity);

  let prev2 = new Float64Array(stride).fill(Infinity);
  let prev1 = new Float64Array(stride).fill(Infinity);
  let cur = new Float64Array(stride).fill(Infinity);
  const get = (row: Float64Array, i: number, j: number) => (i < 0 || j < lo[i] || j > hi[i] ? Infinity : row[j - lo[i]]);
  const report = Math.max(1, Math.floor(n / 20));

  for (let i = 0; i < n; i++) {
    cur.fill(Infinity);
    for (let j = lo[i]; j <= hi[i]; j++) {
      const c = localCost(X, i, Y, j, dim);
      let best: number;
      let step: number;
      if (i === 0) {
        best = skippedBefore(j);
        step = STEP_START;
      } else {
        best = get(prev1, i - 1, j - 1);
        step = STEP_DIAG;
        if (i >= 2 && j >= 1) {
          const v = get(prev2, i - 2, j - 1);
          if (v < Infinity) {
            const via = v + localCost(X, i - 1, Y, j, dim);
            if (via < best) {
              best = via;
              step = STEP_2_1;
            }
          }
        }
        if (j >= 2) {
          const v = get(prev1, i - 1, j - 2);
          if (v < Infinity) {
            const via = v + localCost(X, i, Y, j - 1, dim);
            if (via < best) {
              best = via;
              step = STEP_1_2;
            }
          }
        }
      }
      cur[j - lo[i]] = best + c;
      steps[i * stride + (j - lo[i])] = step;
    }
    const t = prev2;
    prev2 = prev1;
    prev1 = cur;
    cur = t;
    if (options.onProgress && i % report === 0) options.onProgress(i / n);
  }

  // best end column on the last row
  let endJ = -1;
  let total = Infinity;
  for (let j = lo[n - 1]; j <= hi[n - 1]; j++) {
    const v = prev1[j - lo[n - 1]] + skippedAfter(j);
    if (v < total) {
      total = v;
      endJ = j;
    }
  }
  if (endJ < 0 || !Number.isFinite(total)) throw new Error("dtw: no admissible path inside the band");

  // backtrack
  const rows: number[] = [];
  const cols: number[] = [];
  let i = n - 1;
  let j = endJ;
  for (;;) {
    rows.push(i);
    cols.push(j);
    const step = steps[i * stride + (j - lo[i])];
    if (i === 0 || step === STEP_START) break;
    if (step === STEP_DIAG) {
      i -= 1;
      j -= 1;
    } else if (step === STEP_2_1) {
      rows.push(i - 1);
      cols.push(j);
      i -= 2;
      j -= 1;
    } else {
      rows.push(i);
      cols.push(j - 1);
      i -= 1;
      j -= 2;
    }
  }
  rows.reverse();
  cols.reverse();
  const costs = new Float32Array(rows.length);
  for (let k = 0; k < rows.length; k++) costs[k] = localCost(X, rows[k], Y, cols[k], dim);
  options.onProgress?.(1);
  return { rows: Int32Array.from(rows), cols: Int32Array.from(cols), costs, total, radius };
}
