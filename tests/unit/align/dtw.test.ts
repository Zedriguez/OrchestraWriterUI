import { describe, expect, it } from "vitest";
import { dtw } from "@/lib/align/dtw";

/** Unit vectors in 3-D cycling through distinct directions, so neighbors differ. */
function seq(labels: number[]): Float32Array {
  const dirs = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [Math.SQRT1_2, Math.SQRT1_2, 0],
    [0, Math.SQRT1_2, Math.SQRT1_2],
    [Math.SQRT1_2, 0, Math.SQRT1_2],
  ];
  const out = new Float32Array(labels.length * 3);
  labels.forEach((l, i) => out.set(dirs[l % dirs.length], i * 3));
  return out;
}

const pairs = (r: { rows: Int32Array; cols: Int32Array }) => Array.from(r.rows, (row, k) => [row, r.cols[k]]);

describe("dtw", () => {
  it("follows the diagonal for identical sequences", () => {
    const x = seq([0, 1, 2, 3, 4, 5, 0, 1]);
    const r = dtw(x, x, { dim: 3 });
    expect(pairs(r)).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i, i]));
    expect(r.total).toBeCloseTo(0, 6);
  });

  it("absorbs a time stretch with (1,2) steps and stays monotonic", () => {
    const x = seq([0, 1, 2, 3, 4, 5]);
    const y = seq([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]); // twice as slow
    // open ends (cheap skips) let the path start on either copy of frame 0
    const r = dtw(x, y, { dim: 3, radius: 12, skipCost: new Float32Array(12).fill(0.01) });
    // every score frame lands on one of its copies
    for (let k = 0; k < r.rows.length; k++) expect(Math.floor(r.cols[k] / 2)).toBe(r.rows[k]);
    for (let k = 1; k < r.rows.length; k++) {
      expect(r.rows[k]).toBeGreaterThanOrEqual(r.rows[k - 1]);
      expect(r.cols[k]).toBeGreaterThanOrEqual(r.cols[k - 1]);
      expect(r.rows[k] - r.rows[k - 1] + r.cols[k] - r.cols[k - 1]).toBeGreaterThan(0);
    }
    expect(r.costs.every((c) => c < 1e-6)).toBe(true);
  });

  it("never exceeds slope 2: a 3× stretch has no closed-end path", () => {
    const x = seq([0, 1, 2]);
    const y = seq([0, 0, 0, 1, 1, 1, 2, 2, 2]);
    expect(() => dtw(x, y, { dim: 3, radius: 9 })).toThrow(/no admissible path/);
    // with open ends it matches a slope-≤2 stretch and leaves the rest unmatched
    const r = dtw(x, y, { dim: 3, radius: 9, skipCost: new Float32Array(9).fill(0.5) });
    for (let k = 1; k < r.rows.length; k++) expect(r.cols[k] - r.cols[k - 1]).toBeLessThanOrEqual(1);
    expect(r.cols[r.cols.length - 1] - r.cols[0]).toBeLessThanOrEqual(4);
  });

  it("skips leading and trailing frames when a skip cost is given (open begin/end)", () => {
    const x = seq([1, 2, 3, 4]);
    const y = seq([0, 0, 0, 1, 2, 3, 4, 0, 0]);
    const skipCost = new Float32Array(9).fill(0.01);
    const r = dtw(x, y, { dim: 3, skipCost, radius: 4, startCenter: 3, endCenter: 6 });
    expect(pairs(r)).toEqual([
      [0, 3],
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
    // without open ends the path must start at column 0 and end at the last column
    const closed = dtw(x, seq([0, 1, 2, 3, 4, 0]), { dim: 3, radius: 6 });
    expect(closed.cols[0]).toBe(0);
    expect(closed.cols[closed.cols.length - 1]).toBe(5);
  });

  it("stays inside the Sakoe–Chiba band", () => {
    const x = seq(Array.from({ length: 40 }, (_, i) => i));
    const y = seq(Array.from({ length: 40 }, (_, i) => i));
    const r = dtw(x, y, { dim: 3, radius: 2 });
    expect(r.radius).toBe(2);
    for (let k = 0; k < r.rows.length; k++) expect(Math.abs(r.cols[k] - r.rows[k])).toBeLessThanOrEqual(3);
    expect(() => dtw(new Float32Array(0), y, { dim: 3 })).toThrow(/empty/);
  });
});
