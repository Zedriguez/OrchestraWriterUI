import { describe, expect, it } from "vitest";
import {
  RESOLUTIONS,
  audioChunkCount,
  captionDetail,
  captionText,
  defaultVideoBitrate,
  estimateMp4Bytes,
  exportFrameCount,
  exportPixelRatio,
  frameTimestampUs,
  framesProgress,
  isKeyFrame,
  muxCodecFor,
  planarStereo,
  safeFilename,
  videoCodecCandidates,
} from "@/lib/export/frames";

describe("export frame helpers", () => {
  it("counts frames and timestamps", () => {
    expect(exportFrameCount(10, 30)).toBe(300);
    expect(exportFrameCount(438, 60)).toBe(26280);
    expect(exportFrameCount(0, 60)).toBe(1);
    expect(frameTimestampUs(0, 30)).toBe(0);
    expect(frameTimestampUs(30, 30)).toBe(1_000_000);
    expect(frameTimestampUs(1, 60)).toBe(16667);
  });

  it("places a keyframe every 2 s", () => {
    const keys = Array.from({ length: 300 }, (_, i) => i).filter((i) => isKeyFrame(i, 30));
    expect(keys).toEqual([0, 60, 120, 180, 240]);
    expect(isKeyFrame(120, 60)).toBe(true);
    expect(isKeyFrame(119, 60)).toBe(false);
  });

  it("maps the 1280×720 logical stage onto every resolution", () => {
    expect(exportPixelRatio("720p")).toBe(1);
    expect(exportPixelRatio("1080p")).toBe(1.5);
    expect(exportPixelRatio("4k")).toBe(3);
    expect(RESOLUTIONS["4k"]).toMatchObject({ width: 3840, height: 2160 });
  });

  it("prefers H.264 and falls back to HEVC / VP9", () => {
    expect(videoCodecCandidates("1080p")[0]).toBe("avc1.640028");
    expect(videoCodecCandidates("4k")[0]).toBe("avc1.640033");
    expect(videoCodecCandidates("4k").some((c) => c.startsWith("hvc1") || c.startsWith("hev1"))).toBe(true);
    expect(videoCodecCandidates("720p").at(-1)).toBe("vp09.00.10.08");
    expect(muxCodecFor("avc1.640028")).toBe("avc");
    expect(muxCodecFor("hev1.1.6.L153.B0")).toBe("hevc");
    expect(muxCodecFor("vp09.00.10.08")).toBe("vp9");
    expect(() => muxCodecFor("theora")).toThrow(/Unsupported/);
  });

  it("estimates size from the bitrate", () => {
    expect(defaultVideoBitrate("1080p", 60)).toBeGreaterThan(defaultVideoBitrate("1080p", 30));
    expect(defaultVideoBitrate("4k", 30)).toBeGreaterThan(defaultVideoBitrate("1080p", 60));
    const bytes = estimateMp4Bytes(60, "1080p", 30);
    expect(bytes).toBeGreaterThan(30_000_000);
    expect(bytes).toBeLessThan(50_000_000);
    expect(estimateMp4Bytes(60, "1080p", 30, false)).toBeLessThan(bytes);
  });

  it("writes the caption", () => {
    expect(captionText("Symphony No. 5", 42, 502)).toBe("Symphony No. 5 · bar 42 of 502");
    expect(captionText("  ", 3)).toBe("bar 3");
    expect(captionDetail(0.2)).toBe("bar 1");
  });

  it("packs f32-planar stereo, duplicating mono", () => {
    const l = Float32Array.from([1, 2, 3, 4]);
    const r = Float32Array.from([5, 6, 7, 8]);
    expect(Array.from(planarStereo([l, r], 1, 2))).toEqual([2, 3, 6, 7]);
    expect(Array.from(planarStereo([l], 2, 2))).toEqual([3, 4, 3, 4]);
    expect(audioChunkCount(2048)).toBe(2);
    expect(audioChunkCount(2049)).toBe(3);
  });

  it("reports frame progress inside its phase", () => {
    expect(framesProgress(0, 100)).toBeCloseTo(0.02);
    expect(framesProgress(100, 100)).toBeCloseTo(0.92);
  });

  it("makes safe download names", () => {
    expect(safeFilename("Symphony No. 5 / I: Allegro")).toBe("Symphony No. 5 - I - Allegro");
    expect(safeFilename("...")).toBe("orchestra-visualizer");
  });
});
