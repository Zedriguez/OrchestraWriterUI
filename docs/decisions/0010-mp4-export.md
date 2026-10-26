# 0010. MP4 export renders in the browser with WebCodecs and mp4-muxer

Date: 2026-10-26
Status: accepted (resolves open question 5 in STATE.md)

## Context
Export must use the same renderer as Preview. The options were in-browser
(WebCodecs, or ffmpeg.wasm) and server-side (headless Chromium + ffmpeg). The
browser already has the decoded audio, the info map and the renderer; a
server render needs a GPU-less Chromium in a container and re-downloads.

## Decision
- `src/lib/export/mp4.ts` drives `Canvas2DGlowRenderer` + `FrameEngine` frame
  by frame at the chosen resolution and frame rate, draws labels on the canvas
  with the same layout code as Preview, encodes H.264 with `VideoEncoder`,
  AAC with `AudioEncoder` when available, and muxes with `mp4-muxer` (MIT).
- The finished file is downloaded immediately and uploaded to S3 through a
  presigned URL so it appears in the export history (`app.exports`).
- Fallbacks: no AAC encoder (Firefox, some Linux builds) → video-only MP4 with
  a warning; no WebCodecs at all → the Export page explains which browsers
  work. A server-side renderer remains possible behind the same job shape.

## Consequences
- Export time ≈ real time of the piece at 1080p/60 on a laptop; progress and
  cancel are required UI.
- Audio for "generated from score" comes from the Web Audio synth rendered
  offline (`renderScoreToAudioBuffer`).
