import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  ProjectFileError,
  buildProjectFile,
  migrateProjectFile,
  packProjectFile,
  unpackProjectFile,
} from "@/lib/export/project-file";
import type { DisplaySettings } from "@/shared/project-file";
import type { InfoMap } from "@/shared/info-map";
import type { SyncState } from "@/shared/sync";

const display: DisplaySettings = {
  visibleParts: ["P1", "P2"],
  positions: { P1: { x: 0.3, y: 0.6 }, P2: { x: 0.7, y: 0.4 } },
  colors: { P2: "#123456" },
  sectionColors: { Strings: "#e2b04c", Woodwinds: "#5cba9a", Brass: "#e8705e", Percussion: "#9298e0", Other: "#c98bc9" },
  sections: { P2: "Brass" },
  showLabels: true,
  labelMode: "parts",
  reducedMotion: true,
  glowScale: 1.2,
};

const sync: SyncState = {
  method: "chroma-dtw",
  auto: [
    { n: 1, startSec: 0.4, confidence: 97 },
    { n: 2, startSec: 2.1, confidence: 55 },
  ],
  manual: [{ id: "m1", measure: 2, startSec: 2.3, createdAt: "2026-10-26T10:00:00.000Z" }],
  averageConfidence: 76,
};

const infoMap: InfoMap = {
  instruments: [
    { id: "P1", name: "Violin I", shortName: "Vln. I", section: "Strings", notes: [{ time: 0, duration: 1, pitch: 67, dynamics: "mf", styleMarking: null, measure: 1 }] },
    { id: "P2", name: "Horn", shortName: "Hn.", section: "Brass", notes: [] },
  ],
  measures: [
    { number: 1, startTime: 0, duration: 2 },
    { number: 2, startTime: 2, duration: 2 },
  ],
  duration: 4,
  tempo: 120,
  timeSignature: "4/4",
  warnings: [],
};

const scoreBytes = strToU8('<?xml version="1.0"?><score-partwise version="4.0"></score-partwise>');
const audioBytes = new Uint8Array(4096).map((_, i) => (i * 31) & 0xff);

describe("project file (.ovproj)", () => {
  it("round-trips a project with an uploaded recording", () => {
    const project = buildProjectFile({
      infoMap,
      sync,
      display,
      scoreFilename: "Beethoven 5.musicxml",
      audioFilename: "recording.mp3",
      audioSource: "uploaded",
      createdWith: "orchestra-visualizer@test",
    });
    const zip = packProjectFile({ project, scoreBytes, scoreFilename: "Beethoven 5.musicxml", audioBytes, audioFilename: "recording.mp3" });
    const out = unpackProjectFile(zip);

    expect(out.project.version).toBe(1);
    expect(out.project.createdWith).toBe("orchestra-visualizer@test");
    expect(out.project.score).toEqual({ filename: "Beethoven 5.musicxml", musicxml: "score/Beethoven 5.musicxml" });
    expect(out.project.audio).toEqual({ source: "uploaded", filename: "recording.mp3", mp3: "audio/recording.mp3" });
    expect(out.project.sync).toEqual(sync);
    expect(out.project.display).toEqual(display);
    expect(out.project.infoMap).toEqual(infoMap);
    expect(out.scoreBytes).toEqual(scoreBytes);
    expect(out.audioBytes).toEqual(audioBytes);
    expect(out.scoreFilename).toBe("Beethoven 5.musicxml");
    expect(out.audioFilename).toBe("recording.mp3");
  });

  it("round-trips a project with generated playback (no audio entry)", () => {
    const project = buildProjectFile({ sync: null, display, scoreFilename: "mozart.musicxml", audioSource: "generated" });
    const zip = packProjectFile({ project, scoreBytes, scoreFilename: "mozart.musicxml" });
    const out = unpackProjectFile(zip);
    expect(out.project.audio).toEqual({ source: "generated", filename: null, mp3: null });
    expect(out.audioBytes).toBeUndefined();
    expect(out.project.sync).toBeNull();
    expect(out.project.infoMap).toBeUndefined();
    expect(out.project.display).toEqual(display);
    expect(out.scoreBytes).toEqual(scoreBytes);
  });

  it("never stores local paths", () => {
    const project = buildProjectFile({ sync: null, display, scoreFilename: "/Users/me/Desktop/score.musicxml", audioFilename: "C:\\music\\take 2.mp3", audioSource: "uploaded" });
    expect(project.score).toEqual({ filename: "score.musicxml", musicxml: "score/score.musicxml" });
    expect(project.audio.mp3).toBe("audio/take 2.mp3");
    const zip = packProjectFile({ project, scoreBytes, scoreFilename: "../../etc/score.musicxml", audioBytes, audioFilename: "C:\\music\\take 2.mp3" });
    const out = unpackProjectFile(zip);
    expect(out.project.score.musicxml).toBe("score/score.musicxml");
    expect(out.project.audio.mp3).toBe("audio/take 2.mp3");
  });

  it("refuses to pack an uploaded-recording project without the recording", () => {
    const project = buildProjectFile({ sync, display, scoreFilename: "s.musicxml", audioFilename: "a.mp3", audioSource: "uploaded" });
    expect(() => packProjectFile({ project, scoreBytes, scoreFilename: "s.musicxml" })).toThrow(/recording was not provided/);
  });

  it("explains a file that is not a zip", () => {
    expect(() => unpackProjectFile(strToU8("hello"))).toThrow(ProjectFileError);
    try {
      unpackProjectFile(strToU8("hello"));
    } catch (e) {
      expect((e as ProjectFileError).code).toBe("not-a-zip");
    }
  });

  it("explains a missing project.json", () => {
    const zip = zipSync({ "score/a.musicxml": scoreBytes });
    expect(() => unpackProjectFile(zip)).toThrow(/missing project\.json/);
  });

  it("explains invalid JSON", () => {
    const zip = zipSync({ "project.json": strToU8("{ not json") });
    expect(() => unpackProjectFile(zip)).toThrow(/not valid JSON/);
  });

  it("explains a file from a newer app version", () => {
    const project = { ...buildProjectFile({ sync: null, display, scoreFilename: "a.musicxml", audioSource: "generated" }), version: 2 };
    const zip = zipSync({ "project.json": strToU8(JSON.stringify(project)), "score/a.musicxml": scoreBytes });
    expect(() => unpackProjectFile(zip)).toThrow(/newer version of Orchestra Visualizer \(file version 2/);
  });

  it("explains a missing version and an unsupported old version", () => {
    expect(() => migrateProjectFile({ score: {} })).toThrow(/no version number/);
    expect(() => migrateProjectFile({ version: 0 })).toThrow(/not supported/);
  });

  it("explains a missing score or recording entry", () => {
    const generated = buildProjectFile({ sync: null, display, scoreFilename: "a.musicxml", audioSource: "generated" });
    expect(() => unpackProjectFile(zipSync({ "project.json": strToU8(JSON.stringify(generated)) }))).toThrow(/missing its score \(score\/a\.musicxml\)/);

    const uploaded = buildProjectFile({ sync, display, scoreFilename: "a.musicxml", audioFilename: "a.mp3", audioSource: "uploaded" });
    const zip = zipSync({ "project.json": strToU8(JSON.stringify(uploaded)), "score/a.musicxml": scoreBytes });
    expect(() => unpackProjectFile(zip)).toThrow(/missing its recording \(audio\/a\.mp3\)/);
  });

  it("rejects damaged project.json shapes", () => {
    const bad = { version: 1, createdWith: "x", score: { filename: "a", musicxml: "score/a" }, audio: { source: "generated", filename: null, mp3: null }, sync: null };
    expect(() => migrateProjectFile(bad)).toThrow(/display settings are missing/);
  });

  it("ignores unrelated entries in the archive", () => {
    const project = buildProjectFile({ sync: null, display, scoreFilename: "a.musicxml", audioSource: "generated" });
    const zip = zipSync({
      "project.json": strToU8(JSON.stringify(project)),
      "score/a.musicxml": scoreBytes,
      "__MACOSX/._project.json": strToU8("junk"),
    });
    expect(unpackProjectFile(zip).scoreBytes).toEqual(scoreBytes);
  });
});
