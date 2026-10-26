import { describe, expect, it } from "vitest";
import { expandRepeats, parseEndingNumbers, type BarFlags } from "@/shared/score/repeats";

const bars = (n: number, patch: Record<number, Partial<BarFlags>> = {}): BarFlags[] =>
  Array.from({ length: n }, (_, i) => ({ label: String(i + 1), forward: false, backward: false, times: null, ending: null, ...patch[i + 1] }));

const played = (b: BarFlags[]) => expandRepeats(b).order.map((i) => i + 1);

describe("expandRepeats", () => {
  it("leaves music without repeats in written order", () => {
    expect(played(bars(4))).toEqual([1, 2, 3, 4]);
    expect(expandRepeats(bars(4)).warnings).toEqual([]);
  });

  it("repeats back to the start when there is no forward repeat", () => {
    expect(played(bars(4, { 2: { backward: true } }))).toEqual([1, 2, 1, 2, 3, 4]);
  });

  it("repeats a section between forward and backward signs", () => {
    const b = bars(5, { 2: { forward: true }, 3: { backward: true } });
    expect(played(b)).toEqual([1, 2, 3, 2, 3, 4, 5]);
    expect(expandRepeats(b).warnings).toEqual(["Repeat expanded: measures 2–3 play twice."]);
  });

  it("handles two consecutive repeated sections", () => {
    const b = bars(6, { 1: { forward: true }, 2: { backward: true }, 4: { backward: true } });
    // the second backward repeat returns to measure 3 (just after the first repeat)
    expect(played(b)).toEqual([1, 2, 1, 2, 3, 4, 3, 4, 5, 6]);
  });

  it("plays first and second endings", () => {
    const b = bars(6, { 2: { forward: true }, 4: { ending: [1], backward: true }, 5: { ending: [2] } });
    expect(played(b)).toEqual([1, 2, 3, 4, 2, 3, 5, 6]);
  });

  it("caps repeats at two passes and says so", () => {
    const b = bars(3, { 2: { backward: true, times: 3 } });
    const out = expandRepeats(b);
    expect(out.order.map((i) => i + 1)).toEqual([1, 2, 1, 2, 3]);
    expect(out.warnings[0]).toBe("Measure 2: repeat marked 3 times; it is played twice.");
  });

  it("reports measures that can never be reached", () => {
    const b = bars(4, { 2: { ending: [1] }, 3: { ending: [2] } });
    const out = expandRepeats(b);
    expect(out.order.map((i) => i + 1)).toEqual([1, 2, 4]);
    expect(out.warnings).toEqual(["Measures 3 are never played (ending brackets without a matching repeat)."]);
  });

  it("parses ending numbers", () => {
    expect(parseEndingNumbers("1")).toEqual([1]);
    expect(parseEndingNumbers("1, 2")).toEqual([1, 2]);
    expect(parseEndingNumbers("1.,2.")).toEqual([1, 2]);
    expect(parseEndingNumbers(undefined)).toEqual([]);
  });
});
