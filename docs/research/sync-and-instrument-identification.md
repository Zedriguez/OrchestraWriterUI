# Research: syncing a score to a recording, and identifying instruments

Date: 2026-10-26. Written for the backend integration (ADRs 0008–0010).

## 1. Score ↔ audio alignment

The problem: the score gives *score time* (from tempo marks), the recording
gives *recording time*. We need one start time per measure in the recording,
plus a confidence, with manual markers overriding. The established approach is
feature-based dynamic time warping (DTW): compute a time series of chroma
(12 pitch-class energies) for the recording and a matching series synthesized
directly from the score, warp one onto the other, and read measure boundaries
off the warping path.

| Candidate | Language / license | What it does | Fit |
|---|---|---|---|
| [Sync Toolbox](https://github.com/meinardmueller/synctoolbox) | Python, MIT | Memory-restricted multiscale DTW (MrMsDTW) on chroma + onset features; the reference implementation from Müller's group; used as the baseline in current alignment papers | Best server-side option once a Python worker (Lambda container) exists. Needs the score rendered to audio or to a chroma sequence first. |
| [midi-audio-align](https://github.com/Oliverpoc/midi-audio-align) | Python, MIT | Takes MIDI/MusicXML, synthesizes a reference, chroma + attack channel, banded DTW, optional refine pass; can delegate to synctoolbox | Thin, new (single author, few commits); reported median error ~12 ms synthetic, ~27 ms real; memory grows quadratically without `--hop`. Useful as a reference script, not as a dependency. |
| [librosa](https://librosa.org) | Python, ISC | `chroma_cqt`, `chroma_stft`, `dtw` building blocks | What synctoolbox builds on. |
| [Matchmaker](https://www.researchgate.net/publication/396458773_Matchmaker_An_Open-source_Library_for_Real-time_Piano_Score_Following_and_Systematic_Evaluation) | Python | Real-time score following (piano-centric), MusicXML/MIDI in via partitura | Online use; we need offline batch alignment. |
| [meyda](https://meyda.js.org) | JS, MIT | Audio feature extraction in the browser incl. chroma | Fine, but a hand-written STFT + chroma is ~150 lines and avoids a dependency. |
| In-house `src/lib/align` (this repo) | TypeScript, project license | STFT → chroma, score chroma from the info map, banded DTW, per-measure confidence, runs in a Web Worker | Chosen for the MVP (ADR 0009). No server audio stack needed because the browser already decodes the MP3 for playback. |

Findings that shaped the design:
- Chroma DTW gives measure-level alignment reliably but is coarse at the
  note-onset level; recent papers add onset/transcription features for
  precision. Measure-level with manual nudges is exactly the MVP requirement.
- Memory: a full DTW matrix for a 20-minute piece at a 50 ms hop is
  24k × 24k cells. A Sakoe-Chiba band (we use 20%) and a coarse hop (93 ms at
  22.05 kHz with hop 2048) keep it tractable in a worker.
- Leading silence and tempo drift are the common failure modes; the band must
  be wide enough to absorb the silence, and confidence should drop in bars
  where the score is silent (nothing to match).
- "Syncing to MP4 files": a video's audio track is the input; extracting it
  (`<video>` + `decodeAudioData` on the demuxed track, or ffmpeg server-side)
  is the "other audio formats" later-phase item. Nothing in the aligner changes.

Upgrade path: keep the `Aligner` interface in `src/shared/sync.ts`; a
server-side `synctoolbox` aligner can be added as a job later without
touching the Sync page.

## 2. Identifying instruments

Two different questions:

**From the score (shipped now).** MusicXML carries enough to name sections
without guessing: `score-instrument/instrument-sound` ids
(`strings.violin`, `wind.flutes.flute`, `brass.trumpet`, `drum.timpani`),
`midi-instrument/midi-program` (General MIDI families), and `part-name` /
`part-abbreviation`. The parser classifies in that order, then falls back to
name keywords. Users can still reassign a part's section in Customize.

**From audio (later phase; the transcription model slot).** Candidates:

| Model / library | License | What it gives | Notes |
|---|---|---|---|
| [YAMNet](https://tfhub.dev/google/yamnet/1) (TensorFlow, AudioSet) | Apache-2.0 | 521 AudioSet classes incl. many instruments, per ~1 s frame | Small, fast, runs on CPU and in TF.js; a 2026 study found it weaker than OpenL3 on similar string instruments but fine for low-resource use. |
| [PANNs](https://github.com/qiuqiangkong/audioset_tagging_cnn) (PyTorch, AudioSet) | MIT | Tagging incl. instruments; strong embeddings | Reported ~78% predominant-instrument accuracy in an open repo; CNN14 is heavier than YAMNet. |
| [OpenL3](https://github.com/marl/openl3) embeddings + a classifier trained on [OpenMIC-2018](https://zenodo.org/record/1432913) | MIT (OpenL3), CC-BY (dataset) | Multi-instrument presence per 10 s clip across 20 instrument classes | OpenMIC is the standard open benchmark for polyphonic instrument recognition. |
| [MuScriptor](https://www.opentrain.ai/papers/muscriptor-an-open-model-for-multi-instrument-music-transcription--arxiv-2607.08168/) / MT3-style transcription | MIT (MuScriptor) | Multi-instrument transcription: notes *with* instrument labels | Directly fits the backend contract in `src/server/pipeline/model.ts` (one MIDI track per instrument). |
| [Basic Pitch](https://github.com/spotify/basic-pitch) | Apache-2.0 | Polyphonic pitch → MIDI, no instrument labels | Pair with a tagger if used. |
| Essentia models | AGPL-3.0 | Many taggers | Avoid: license conflicts with the project's permissive policy. |

Recommendation: for the "recording → score" pipeline that the backend repo
started, implement the model slot with an MT3-style multi-instrument
transcriber (MuScriptor is the current open, MIT-licensed option); for a
cheaper "which instruments are present" tag, PANNs or YAMNet. Both run as a
Python Lambda container behind the existing Step Functions state machine.

## 3. Engraved notation (replacing the schematic score strip)

- [OpenSheetMusicDisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay): BSD-3-Clause, renders MusicXML to SVG in the browser, slow on long scores, no playback cursor in the free build (audio player is sponsor-only early access). Candidate for Preview's score panel; later phase.
- Verovio: LGPL-3.0; excluded by the license policy unless the team accepts LGPL.

## 4. MP4 export in the browser

- WebCodecs `VideoEncoder` (H.264) is available in Chrome/Edge since 94 and
  Safari 16.4+; `AudioEncoder` with AAC in Chrome/Edge and Safari 26+; Firefox
  has WebCodecs video but **no AAC encoder**. Linux desktop browsers may lack
  AAC too. So: detect at runtime, fall back to a video-only MP4 with a warning.
- Muxers: [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) (MIT, stable) chosen;
  mediabunny (MPL-2.0) is its successor with more formats, kept as an option.
- Server-side alternative (headless Chromium + ffmpeg in a container) stays
  the fallback for browsers without WebCodecs; see ADR 0010.

Sources: [midi-audio-align](https://github.com/Oliverpoc/midi-audio-align) ·
[Sync Toolbox paper](https://www.researchgate.net/publication/354174330_Sync_Toolbox_A_Python_Package_for_Efficient_Robust_and_Accurate_Music_Synchronization) ·
[Matchmaker](https://www.jku.at/fileadmin/gruppen/173/Research/Rach_3_Project/_ISMIR_2024_LBD__Matchmaker-2.pdf) ·
[Precise and simple audio-to-score alignment (2026)](https://arxiv.org/pdf/2605.20014) ·
[Portuguese instruments embedding study (2026)](https://www.sciencedirect.com/science/article/pii/S2666827026000757) ·
[instrument-recognition repo](https://github.com/Dasa108/instrument-recognition) ·
[OpenMIC attention paper](https://arxiv.org/pdf/1907.04294) ·
[MuScriptor](https://www.opentrain.ai/papers/muscriptor-an-open-model-for-multi-instrument-music-transcription--arxiv-2607.08168/) ·
[WebCodecs codec selection (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Codec_selection) ·
[WebCodecs codec support data 2026](https://webcodecsfundamentals.org/datasets/codec-analysis-2026/) ·
[WebCodecs browser support](https://www.testmuai.com/learning-hub/webcodecs-browser-support/) ·
[OSMD](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay)
