import { describe, expect, it } from "vitest";
import type { Dynamic } from "@/shared/dynamics";
import type { InfoMap, Instrument, Note } from "@/shared/info-map";
import { activitySegments, measureDynamic, partsPlayingAt, segmentAt } from "@/lib/score/segments";
import * as mock from "@/lib/mock/info-map";

const note = (time: number, duration: number, dynamics: Dynamic, measure = 1): Note => ({ time, duration, pitch: 60, dynamics, styleMarking: null, measure });
const inst = (id: string, notes: Note[]): Instrument => ({ id, name: id, shortName: id, section: "Strings", notes });

describe("activitySegments", () => {
  it("merges consecutive notes and bridges short gaps of the same dynamic", () => {
    const segs = activitySegments(inst("a", [note(0, 1, "p"), note(1.05, 1, "p"), note(3, 1, "p")]));
    expect(segs).toEqual([
      { start: 0, end: 2.05, dynamic: "p" },
      { start: 3, end: 4, dynamic: "p" },
    ]);
  });

  it("splits on dynamic changes and takes the louder voice where voices overlap", () => {
    // a long p note in one voice, a short f note in another
    const segs = activitySegments(inst("a", [note(0, 4, "p"), note(1, 0.5, "f"), note(2, 1, "p")]));
    expect(segs).toEqual([
      { start: 0, end: 1, dynamic: "p" },
      { start: 1, end: 1.5, dynamic: "f" },
      { start: 1.5, end: 4, dynamic: "p" },
    ]);
    // non-overlapping and sorted, so bisection finds the long note after the short one ends
    expect(segmentAt(segs, 3)?.dynamic).toBe("p");
    expect(segmentAt(segs, 1.2)?.dynamic).toBe("f");
    expect(segmentAt(segs, 4)).toBeNull();
  });

  it("ignores grace notes (zero duration)", () => {
    expect(activitySegments(inst("a", [note(0, 0, "ff"), note(0, 1, "p")]))).toEqual([{ start: 0, end: 1, dynamic: "p" }]);
  });
});

describe("measureDynamic and partsPlayingAt", () => {
  const a = inst("a", [note(0, 1, "p", 1), note(1, 1, "f", 1), note(2, 1, "mp", 2)]);
  const b = inst("b", [note(2.5, 1, "ff", 2)]);
  const map: InfoMap = {
    instruments: [a, b],
    measures: [
      { number: 1, startTime: 0, duration: 2 },
      { number: 2, startTime: 2, duration: 2 },
    ],
    duration: 4,
    tempo: 120,
    timeSignature: "4/4",
    warnings: [],
  };

  it("summarizes a measure with its loudest written dynamic", () => {
    expect(measureDynamic(a, 1)).toBe("f");
    expect(measureDynamic(a, 2)).toBe("mp");
    expect(measureDynamic(b, 1)).toBeNull();
  });

  it("lists the parts sounding at a score time", () => {
    expect(partsPlayingAt(map, 0.5)).toEqual([{ id: "a", dynamic: "p" }]);
    expect(partsPlayingAt(map, 2.7)).toEqual([
      { id: "a", dynamic: "mp" },
      { id: "b", dynamic: "ff" },
    ]);
    expect(partsPlayingAt(map, 3.6)).toEqual([]);
  });

  it("is re-exported from the mock module for older imports", () => {
    expect(mock.activitySegments).toBe(activitySegments);
    expect(mock.segmentAt).toBe(segmentAt);
    expect(mock.measureDynamic).toBe(measureDynamic);
  });
});
