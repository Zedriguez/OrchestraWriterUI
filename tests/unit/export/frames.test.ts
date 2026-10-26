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

  it("keeps the encoder targets ordered", () => {
    expect(defaultVideoBitrate("1080p", 60)).toBeGreaterThan(defaultVideoBitrate("1080p", 30));
    expect(defaultVideoBitrate("4k", 30)).toBeGreaterThan(defaultVideoBitrate("1080p", 60));
  });

  it("estimates size from bits per pixel per frame, plus AAC and container overhead", () => {
    // 1280 × 720 × 30 × 0.02 = 552,960 bit/s of video; + 192 kbit/s AAC; × 125 s ÷ 8 × 1.05
    expect(estimateMp4Bytes(125, "720p", 30)).toBe(12_222_000);
    expect(estimateMp4Bytes(125, "720p", 30, false)).toBe(9_072_000);
    // measured on the 14-part demo score (Chrome, H.264): 13.2 MB with audio; stay within ±25 %
    expect(estimateMp4Bytes(125, "720p", 30) / 13_248_268).toBeGreaterThan(0.75);
    expect(estimateMp4Bytes(125, "720p", 30) / 13_248_268).toBeLessThan(1.25);
    // 1080p60 with audio lands at 2–3 Mbit/s for this imagery
    const mbps = (estimateMp4Bytes(60, "1080p", 60) * 8) / 60 / 1e6;
    expect(mbps).toBeGreaterThan(2);
    expect(mbps).toBeLessThan(3);
  });

  it("scales with pixels and frame rate, never above the encoder's target", () => {
    const base = estimateMp4Bytes(60, "720p", 30, false);
    expect(estimateMp4Bytes(60, "720p", 60, false) / base).toBeCloseTo(2);
    expect(estimateMp4Bytes(60, "4k", 30, false) / base).toBeCloseTo(9);
    for (const res of ["720p", "1080p", "4k"] as const) {
      for (const fps of [30, 60] as const) {
        expect((estimateMp4Bytes(10, res, fps, false) * 8) / 10).toBeLessThanOrEqual(defaultVideoBitrate(res, fps) * 1.05);
      }
    }
    expect(estimateMp4Bytes(0, "1080p", 30)).toBe(0);
    expect(estimateMp4Bytes(-5, "1080p", 30)).toBe(0);
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
