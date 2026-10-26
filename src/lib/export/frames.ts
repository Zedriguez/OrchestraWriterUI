/**
 * Pure helpers for MP4 export: frame timing, sizes, codec choice, captions,
 * and audio packing. Kept free of browser APIs so they run in node tests.
 */

export type ExportResolution = "720p" | "1080p" | "4k";
export type ExportFrameRate = 30 | 60;

export const RESOLUTIONS: Record<ExportResolution, { width: number; height: number; label: string }> = {
  "720p": { width: 1280, height: 720, label: "1280 × 720" },
  "1080p": { width: 1920, height: 1080, label: "1920 × 1080" },
  "4k": { width: 3840, height: 2160, label: "3840 × 2160" },
};

/**
 * Exports render a fixed logical stage (the size labels and captions are laid
 * out in) scaled to the output resolution, so 720p, 1080p and 4K frames have
 * the same composition as a 1280-px-wide Preview stage.
 */
export const EXPORT_LOGICAL = { width: 1280, height: 720 } as const;

export function exportPixelRatio(resolution: ExportResolution): number {
  return RESOLUTIONS[resolution].width / EXPORT_LOGICAL.width;
}

/** Number of frames for a duration (at least one). */
export function exportFrameCount(durationSec: number, frameRate: number): number {
  if (!(durationSec > 0) || !(frameRate > 0)) return 1;
  return Math.max(1, Math.round(durationSec * frameRate));
}

/** Presentation time of frame i in seconds. */
export function frameTimeSec(i: number, frameRate: number): number {
  return i / frameRate;
}

/** Microsecond timestamp for WebCodecs. */
export function frameTimestampUs(i: number, frameRate: number): number {
  return Math.round((i * 1_000_000) / frameRate);
}

export function frameDurationUs(frameRate: number): number {
  return Math.round(1_000_000 / frameRate);
}

/** Keyframe every `intervalSec` seconds (2 s by default), always on frame 0. */
export function isKeyFrame(i: number, frameRate: number, intervalSec = 2): boolean {
  const every = Math.max(1, Math.round(frameRate * intervalSec));
  return i % every === 0;
}

/** Target video bitrate (bits/s). The stage is dark with soft glows, so modest rates look clean. */
export function defaultVideoBitrate(resolution: ExportResolution, frameRate: ExportFrameRate): number {
  const base: Record<ExportResolution, number> = { "720p": 3_000_000, "1080p": 5_000_000, "4k": 14_000_000 };
  return Math.round(base[resolution] * (frameRate === 60 ? 1.35 : 1));
}

export const AUDIO_BITRATE = 192_000;

/** Rough output size in bytes (video + AAC + ~1% container overhead). */
export function estimateMp4Bytes(durationSec: number, resolution: ExportResolution, frameRate: ExportFrameRate, withAudio = true): number {
  const bits = (defaultVideoBitrate(resolution, frameRate) + (withAudio ? AUDIO_BITRATE : 0)) * Math.max(0, durationSec);
  return Math.round((bits / 8) * 1.01);
}

export type MuxVideoCodec = "avc" | "hevc" | "vp9" | "av1";

/**
 * Codec strings to try in order. H.264 High first (plays everywhere,
 * level 4.0 covers 1080p60, level 5.1 covers 4K); HEVC for 4K when the
 * encoder can't do 4K H.264; VP9 as the last resort (kept in MP4, which
 * Chrome/Firefox/VLC play but QuickTime does not).
 */
export function videoCodecCandidates(resolution: ExportResolution): string[] {
  if (resolution === "4k") return ["avc1.640033", "avc1.4d0033", "hvc1.1.6.L153.B0", "hev1.1.6.L153.B0", "vp09.00.10.08"];
  return ["avc1.640028", "avc1.4d0028", "avc1.42e028", "vp09.00.10.08"];
}

export function muxCodecFor(codec: string): MuxVideoCodec {
  if (codec.startsWith("avc1") || codec.startsWith("avc3")) return "avc";
  if (codec.startsWith("hvc1") || codec.startsWith("hev1")) return "hevc";
  if (codec.startsWith("vp09") || codec === "vp9") return "vp9";
  if (codec.startsWith("av01")) return "av1";
  throw new Error(`Unsupported video codec for MP4: ${codec}`);
}

/** Human-readable codec name for the export result. */
export function codecLabel(codec: string): string {
  switch (muxCodecFor(codec)) {
    case "avc":
      return "H.264";
    case "hevc":
      return "HEVC (H.265)";
    case "vp9":
      return "VP9";
    case "av1":
      return "AV1";
  }
}

/** "Symphony No. 5 · bar 42 of 502" (detail part only; the title is drawn separately). */
export function captionDetail(measure: number, totalMeasures?: number): string {
  const n = Math.max(1, Math.round(measure));
  return totalMeasures && totalMeasures > 0 ? `bar ${n} of ${totalMeasures}` : `bar ${n}`;
}

export function captionText(title: string, measure: number, totalMeasures?: number): string {
  const t = title.trim();
  const detail = captionDetail(measure, totalMeasures);
  return t ? `${t} · ${detail}` : detail;
}

/** Audio frames per AudioData chunk handed to the AAC encoder. */
export const AUDIO_CHUNK_FRAMES = 1024;

export function audioChunkCount(totalFrames: number, chunk = AUDIO_CHUNK_FRAMES): number {
  return Math.ceil(Math.max(0, totalFrames) / chunk);
}

/**
 * Pack `frames` samples starting at `offset` into an f32-planar stereo block
 * [L0..Ln, R0..Rn]. Mono is duplicated to both channels; channels beyond the
 * second are ignored.
 */
export function planarStereo(channels: Float32Array[], offset: number, frames: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(frames * 2);
  if (channels.length === 0) return out;
  const left = channels[0];
  const right = channels[1] ?? channels[0];
  out.set(left.subarray(offset, offset + frames), 0);
  out.set(right.subarray(offset, offset + frames), frames);
  return out;
}

/** Progress weights: rendering frames dominates. */
export const PROGRESS_WEIGHTS = { prepare: 0.02, frames: 0.9, audio: 0.06, mux: 0.02 } as const;

export function framesProgress(done: number, total: number): number {
  const f = total > 0 ? Math.min(1, done / total) : 1;
  return PROGRESS_WEIGHTS.prepare + f * PROGRESS_WEIGHTS.frames;
}

export function audioProgress(done: number, total: number): number {
  const f = total > 0 ? Math.min(1, done / total) : 1;
  return PROGRESS_WEIGHTS.prepare + PROGRESS_WEIGHTS.frames + f * PROGRESS_WEIGHTS.audio;
}

/** Filesystem-safe base name for a download ("Symphony No. 5 / I" → "Symphony No. 5 - I"). */
export function safeFilename(name: string, fallback = "orchestra-visualizer"): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " - ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.-]+|[\s.-]+$/g, "")
    .slice(0, 120);
  return cleaned || fallback;
}
