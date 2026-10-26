import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import type { InfoMap } from "@/shared/info-map";
import type { DisplaySettings } from "@/shared/project-file";
import type { MeasureAlignment } from "@/shared/sync";
import { recordingToScoreTime } from "@/shared/sync";
import {
  BRAVURA_SAMPLE,
  Canvas2DGlowRenderer,
  FrameEngine,
  buildScene,
  computeLabels,
  drawCaption,
  drawLabels,
  placeLabels,
  resolveLabelStyle,
} from "@/lib/visualizer";
import {
  AUDIO_BITRATE,
  AUDIO_CHUNK_FRAMES,
  EXPORT_LOGICAL,
  RESOLUTIONS,
  audioChunkCount,
  audioProgress,
  captionDetail,
  codecLabel,
  defaultVideoBitrate,
  exportFrameCount,
  exportPixelRatio,
  frameDurationUs,
  frameTimeSec,
  frameTimestampUs,
  framesProgress,
  isKeyFrame,
  muxCodecFor,
  planarStereo,
  videoCodecCandidates,
  type ExportFrameRate,
  type ExportResolution,
} from "./frames";

export interface RenderMp4Options {
  infoMap: InfoMap;
  display: DisplaySettings;
  /** merged alignment (empty when playback is generated from the score) */
  aligned: MeasureAlignment[];
  /** uploaded recording or renderScoreToAudioBuffer() output; null = silent video */
  audio: AudioBuffer | null;
  /** seconds of video (recording time when aligned, else score time) */
  durationSec: number;
  resolution: ExportResolution;
  frameRate: ExportFrameRate;
  title: string;
  /** progress 0–1 with a short message */
  onProgress?: (progress: number, message: string) => void;
  signal?: AbortSignal;
  /** video bits per second; defaults by resolution and frame rate */
  videoBitrate?: number;
  /** seconds between keyframes (default 2) */
  keyframeIntervalSec?: number;
  /** draw the "Title · bar N of M" caption (default true) */
  caption?: boolean;
}

export interface RenderMp4Result {
  blob: Blob;
  /** WebCodecs codec string actually used, e.g. "avc1.640028" */
  codec: string;
  /** "H.264", "HEVC (H.265)" or "VP9" */
  codecName: string;
  mimeType: string;
  frames: number;
  hasAudio: boolean;
  /** things the user should know (no audio track, fallback codec, …) */
  warnings: string[];
}

/** Readable reason when this browser cannot export, or null when it can. */
export function mp4ExportUnsupportedReason(): string | null {
  if (typeof document === "undefined") return "MP4 export runs in the browser.";
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") {
    return "This browser cannot encode video (WebCodecs is missing). Use a current Chrome, Edge or Safari to export an MP4.";
  }
  return null;
}

/**
 * Render the visual frame by frame with the same Canvas2DGlowRenderer and
 * FrameEngine as Preview, draw labels and a caption on the canvas, encode
 * with WebCodecs and mux to MP4 with mp4-muxer.
 */
export async function renderMp4(options: RenderMp4Options): Promise<RenderMp4Result> {
  const unsupported = mp4ExportUnsupportedReason();
  if (unsupported) throw new Error(unsupported);

  const { infoMap, display, aligned, frameRate, resolution, signal } = options;
  const report = throttledProgress(options.onProgress);
  const warnings: string[] = [];
  const checkAbort = () => {
    if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
  };

  report(0, "Preparing renderer", true);
  checkAbort();
  const style = await loadExportFonts();
  if (!style.bravura) warnings.push("The music font (Bravura) did not load; dynamics are drawn as letters.");
  checkAbort();

  const { width, height } = RESOLUTIONS[resolution];
  const dpr = exportPixelRatio(resolution);
  const lw = EXPORT_LOGICAL.width;
  const lh = EXPORT_LOGICAL.height;

  // A real <canvas> (not OffscreenCanvas): the renderer relies on ctx.filter.
  const canvas = document.createElement("canvas");
  const renderer = new Canvas2DGlowRenderer({ maxDpr: dpr });
  renderer.mount(canvas);
  renderer.resize(lw, lh, dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a canvas for the export.");

  const bitrate = options.videoBitrate ?? defaultVideoBitrate(resolution, frameRate);
  const video = await pickVideoConfig(resolution, width, height, frameRate, bitrate);
  if (!video) {
    renderer.destroy();
    throw new Error(`This browser cannot encode ${RESOLUTIONS[resolution].label} video. Try a lower resolution.`);
  }
  if (muxCodecFor(video.codec) !== "avc") {
    warnings.push(`H.264 is not available at this resolution in this browser; the video uses ${codecLabel(video.codec)}, which some players (QuickTime) cannot open.`);
  }

  const audioBuffer = options.audio;
  let audioConfig: AudioEncoderConfig | null = null;
  if (audioBuffer) {
    audioConfig = await pickAudioConfig(audioBuffer.sampleRate);
    if (!audioConfig) warnings.push("This browser cannot encode AAC audio, so the MP4 has no sound.");
  }

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: muxCodecFor(video.codec), width, height, frameRate },
    audio: audioConfig ? { codec: "aac", numberOfChannels: 2, sampleRate: audioConfig.sampleRate } : undefined,
    fastStart: "in-memory",
  });

  let encodeError: Error | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (encodeError = e instanceof Error ? e : new Error(String(e))),
  });
  let audioEncoder: AudioEncoder | null = null;
  const throwIfFailed = () => {
    if (encodeError) throw new Error(`Encoding failed: ${encodeError.message}`);
  };

  try {
    videoEncoder.configure(video);

    const engine = new FrameEngine(infoMap);
    const total = exportFrameCount(options.durationSec, frameRate);
    const dtMs = 1000 / frameRate;
    const mode = display.showLabels ? display.labelMode : null;
    const totalMeasures = infoMap.measures.length;
    const showCaption = options.caption ?? true;
    const placeOptions = { bottomInset: showCaption ? 22 : 0 };
    const keyEvery = options.keyframeIntervalSec ?? 2;

    report(framesProgress(0, total), `Rendering frames · 0 / ${total}`, true);
    for (let i = 0; i < total; i++) {
      checkAbort();
      throwIfFailed();
      const tRecording = frameTimeSec(i, frameRate);
      const tScore = aligned.length > 0 ? recordingToScoreTime(infoMap, aligned, tRecording) : tRecording;
      // first frame snaps (no fade-in from black); afterwards the envelope runs in video time
      const frame = engine.compute(tScore, i === 0 ? 1000 : dtMs, display.reducedMotion);
      renderer.render(buildScene(infoMap, display, frame, { showSeating: true, showConductor: true }));

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const layout = mode ? placeLabels(computeLabels(infoMap, display, frame.parts, mode), lw, lh, placeOptions) : [];
      drawLabels(ctx, layout, { width: lw, height: lh, showConductor: true, style });
      if (showCaption) drawCaption(ctx, { title: options.title, detail: captionDetail(frame.measure, totalMeasures) }, { width: lw, height: lh, style });

      const vf = new VideoFrame(canvas, { timestamp: frameTimestampUs(i, frameRate), duration: frameDurationUs(frameRate) });
      try {
        videoEncoder.encode(vf, { keyFrame: isKeyFrame(i, frameRate, keyEvery) });
      } finally {
        vf.close();
      }
      await drainQueue(videoEncoder, 6);
      if (i % 4 === 3) await yieldToEventLoop();
      report(framesProgress(i + 1, total), `Rendering frames · ${i + 1} / ${total}`);
    }
    await videoEncoder.flush();
    throwIfFailed();
    checkAbort();

    if (audioBuffer && audioConfig) {
      report(audioProgress(0, 1), "Encoding audio", true);
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error: (e) => (encodeError = e instanceof Error ? e : new Error(String(e))),
      });
      audioEncoder.configure(audioConfig);
      const channels = Array.from({ length: Math.min(2, audioBuffer.numberOfChannels) }, (_, c) => audioBuffer.getChannelData(c));
      const sampleRate = audioBuffer.sampleRate;
      const totalFrames = Math.min(audioBuffer.length, Math.ceil(options.durationSec * sampleRate));
      const chunks = audioChunkCount(totalFrames);
      for (let k = 0; k < chunks; k++) {
        checkAbort();
        throwIfFailed();
        const offset = k * AUDIO_CHUNK_FRAMES;
        const frames = Math.min(AUDIO_CHUNK_FRAMES, totalFrames - offset);
        const data = new AudioData({
          format: "f32-planar",
          sampleRate,
          numberOfFrames: frames,
          numberOfChannels: 2,
          timestamp: Math.round((offset * 1_000_000) / sampleRate),
          data: planarStereo(channels, offset, frames),
        });
        try {
          audioEncoder.encode(data);
        } finally {
          data.close();
        }
        await drainQueue(audioEncoder, 32);
        if (k % 64 === 63) {
          await yieldToEventLoop();
          report(audioProgress(k + 1, chunks), "Encoding audio");
        }
      }
      await audioEncoder.flush();
      throwIfFailed();
    }

    checkAbort();
    report(audioProgress(1, 1), "Muxing", true);
    muxer.finalize();
    const blob = new Blob([target.buffer], { type: "video/mp4" });
    report(1, "Done", true);
    return {
      blob,
      codec: video.codec,
      codecName: codecLabel(video.codec),
      mimeType: "video/mp4",
      frames: total,
      hasAudio: !!audioConfig,
      warnings,
    };
  } finally {
    closeQuietly(videoEncoder);
    if (audioEncoder) closeQuietly(audioEncoder);
    renderer.destroy();
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** First supported encoder config among the candidates for this resolution. */
export async function pickVideoConfig(
  resolution: ExportResolution,
  width: number,
  height: number,
  frameRate: number,
  bitrate: number,
): Promise<VideoEncoderConfig | null> {
  for (const codec of videoCodecCandidates(resolution)) {
    const config: VideoEncoderConfig = {
      codec,
      width,
      height,
      bitrate,
      framerate: frameRate,
      bitrateMode: "variable",
      latencyMode: "quality",
    };
    const mux = muxCodecFor(codec);
    if (mux === "avc") (config as VideoEncoderConfig & { avc?: { format: "avc" | "annexb" } }).avc = { format: "avc" };
    if (mux === "hevc") (config as VideoEncoderConfig & { hevc?: { format: "hevc" | "annexb" } }).hevc = { format: "hevc" };
    try {
      const support = await VideoEncoder.isConfigSupported(config);
      if (support.supported) return support.config ?? config;
    } catch {
      /* malformed or unknown codec string in this browser: try the next */
    }
  }
  return null;
}

export async function pickAudioConfig(sampleRate: number): Promise<AudioEncoderConfig | null> {
  if (typeof AudioEncoder === "undefined" || typeof AudioData === "undefined") return null;
  const config: AudioEncoderConfig = { codec: "mp4a.40.2", sampleRate, numberOfChannels: 2, bitrate: AUDIO_BITRATE };
  try {
    const support = await AudioEncoder.isConfigSupported(config);
    return support.supported ? (support.config ?? config) : null;
  } catch {
    return null;
  }
}

/** Load Inter, Lora and Bravura Text before the first frame so labels don't render in a fallback. */
async function loadExportFonts() {
  const pre = resolveLabelStyle();
  if (typeof document !== "undefined" && document.fonts) {
    await Promise.allSettled([
      document.fonts.load(`19px "Bravura Text"`, BRAVURA_SAMPLE),
      document.fonts.load(`600 10px ${pre.sans}`),
      document.fonts.load(`500 12px ${pre.sans}`),
      document.fonts.load(`600 13px ${pre.serif}`),
      document.fonts.load(`italic 600 19px ${pre.serif}`),
    ]);
    await withTimeout(document.fonts.ready, 3000);
  }
  return resolveLabelStyle();
}

/** Back-pressure: wait until the encoder's queue is short again. */
async function drainQueue(encoder: VideoEncoder | AudioEncoder, max: number) {
  while (encoder.encodeQueueSize > max) {
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        encoder.removeEventListener("dequeue", finish);
        resolve();
      };
      encoder.addEventListener("dequeue", finish);
      // browsers without the dequeue event: poll
      setTimeout(finish, 4);
    });
  }
}

function yieldToEventLoop() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function withTimeout<T>(p: Promise<T>, ms: number) {
  return Promise.race([p, new Promise<void>((resolve) => setTimeout(resolve, ms))]);
}

function closeQuietly(encoder: VideoEncoder | AudioEncoder) {
  try {
    if (encoder.state !== "closed") encoder.close();
  } catch {
    /* already closed */
  }
}

/** At most ~10 progress callbacks per second, plus forced ones at phase changes. */
function throttledProgress(cb?: (progress: number, message: string) => void) {
  let last = 0;
  return (progress: number, message: string, force = false) => {
    if (!cb) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (!force && now - last < 100) return;
    last = now;
    cb(Math.max(0, Math.min(1, progress)), message);
  };
}
