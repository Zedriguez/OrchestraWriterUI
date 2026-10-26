import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { soundingTranspose, summarizeInfoMap } from "@/shared/score";
import { buildDemoScore } from "../../../scripts/lib/demo-score";
import { writeMusicXml } from "../../../scripts/lib/musicxml-writer";
import { FIXTURES, parseOk } from "./helpers";

describe("orchestra-demo fixture", () => {
  const { infoMap, meta } = parseOk("orchestra-demo.musicxml");

  it("is what scripts/make-fixtures.ts generates (committed file is up to date)", () => {
    expect(readFileSync(FIXTURES + "orchestra-demo.musicxml", "utf8")).toBe(writeMusicXml(buildDemoScore()));
  });

  it("parses to 14 parts and 56 playback measures with the expected metadata", () => {
    expect(meta).toMatchObject({
      title: "Overture in D",
      composer: "Fixture Orchestra",
      movement: "I. Allegro",
      parts: 14,
      measures: 56, // 48 written + bars 9–16 repeated
      tempo: 112,
      timeSignature: "4/4",
    });
    expect(meta.warnings).toEqual(["Repeat expanded: measures 9–16 play twice."]);
    expect(infoMap.instruments.map((i) => `${i.name}|${i.shortName}|${i.section}`)).toEqual([
      "Flute|Fl.|Woodwinds",
      "Oboe|Ob.|Woodwinds",
      "Clarinet in B♭|Cl.|Woodwinds",
      "Bassoon|Bsn.|Woodwinds",
      "Horn in F|Hn.|Brass",
      "Trumpet in C|Tpt.|Brass",
      "Trombone|Tbn.|Brass",
      "Timpani|Timp.|Percussion",
      "Harp|Hp.|Other",
      "Violin I|Vln. I|Strings",
      "Violin II|Vln. II|Strings",
      "Viola|Vla.|Strings",
      "Cello|Vc.|Strings",
      "Double Bass|Cb.|Strings",
    ]);
  });

  it("has the tempo change at written bar 33 (playback 41) and a total of 125.714 s", () => {
    const beat112 = 60 / 112;
    const beat96 = 60 / 96;
    expect(infoMap.measures[0]).toEqual({ number: 1, startTime: 0, duration: round6(4 * beat112) }); // no label: printed 1 = playback 1
    expect(infoMap.measures[40].startTime).toBeCloseTo(40 * 4 * beat112, 5);
    expect(infoMap.measures[40].duration).toBeCloseTo(4 * beat96, 5);
    expect(infoMap.duration).toBeCloseTo(40 * 4 * beat112 + 16 * 4 * beat96, 5);
  });

  it("labels playback measures with their printed bar numbers after the repeat", () => {
    const labels = infoMap.measures.map((m) => m.label);
    expect(labels.slice(0, 16)).toEqual(Array(16).fill(undefined)); // 1–16: playback index = printed number
    expect(labels.slice(16, 24)).toEqual(["9", "10", "11", "12", "13", "14", "15", "16"]); // second pass
    expect(infoMap.measures[40]).toMatchObject({ number: 41, label: "33" }); // Meno mosso
    expect(infoMap.measures[55]).toMatchObject({ number: 56, label: "48" });
    // every measure after the repeat is labeled, 8 bars behind its playback index
    for (const m of infoMap.measures.slice(24)) expect(m.label).toBe(String(m.number - 8));
  });

  it("has a general pause in written bar 32 (playback 40) and the clarinet transposed", () => {
    expect(infoMap.instruments.every((i) => i.notes.every((n) => n.measure !== 40))).toBe(true);
    expect(soundingTranspose(infoMap.instruments[2])).toBe(-2);
    expect(infoMap.instruments.filter((i) => soundingTranspose(i) !== 0)).toHaveLength(1);
  });

  it("covers pp–ff, pizzicato in the repeat, ties and chords", () => {
    const all = infoMap.instruments.flatMap((i) => i.notes);
    expect(new Set(all.map((n) => n.dynamics))).toEqual(new Set(["pp", "p", "mp", "mf", "f", "ff"]));
    const vln2 = infoMap.instruments[10];
    const pizz = vln2.notes.filter((n) => n.styleMarking === "Pizzicato").map((n) => n.measure);
    expect(Math.min(...pizz)).toBe(9);
    expect(Math.max(...pizz)).toBe(24); // second pass of written 9–16
    // tied sustained notes last longer than one 4/4 bar at 112 bpm
    expect(infoMap.instruments[9].notes.some((n) => n.duration > 4 * (60 / 112) + 0.01)).toBe(true);
    // chords: several notes of one part starting together
    const harp = infoMap.instruments[8].notes;
    expect(harp.some((n, i) => i > 0 && n.time === harp[i - 1].time)).toBe(true);
  });

  it(".mxl and .musicxml give the same info map", () => {
    expect(parseOk("orchestra-demo.mxl").infoMap).toEqual(infoMap);
  });

  it("summarizes with one thumbnail glow per section", () => {
    const summary = summarizeInfoMap(infoMap);
    expect(summary).toMatchObject({ parts: 14, measures: 56, durationSec: infoMap.duration });
    expect(summary.thumbnail.map((g) => g.section)).toEqual(["Strings", "Woodwinds", "Brass", "Percussion", "Other"]);
    for (const g of summary.thumbnail) {
      expect(g.level).toBeGreaterThanOrEqual(0.2);
      expect(g.level).toBeLessThanOrEqual(1);
      expect(g.x).toBeGreaterThanOrEqual(0);
      expect(g.x).toBeLessThanOrEqual(1);
    }
    const level = Object.fromEntries(summary.thumbnail.map((g) => [g.section, g.level]));
    // strings play nearly everywhere; the timpani a third of the time
    expect(level.Strings).toBeGreaterThan(level.Percussion);
  });
});

function round6(x: number) {
  return Math.round(x * 1e6) / 1e6;
}
