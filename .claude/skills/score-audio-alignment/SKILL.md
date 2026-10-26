---
name: score-audio-alignment
description: Options and constraints for aligning a MusicXML score to an uploaded MP3 at the measure level, with a per-measure confidence score and manual marker overrides. Use when designing, prototyping, or evaluating the sync step.
---
# Score ↔ audio alignment

The method is undecided. The job of any sync work is to put a candidate behind
a stable interface and measure it, then write an ADR.

## Interface (don't change without an ADR)
```
align(infoMap, audio) -> { measures: [{ n, startSec, confidence }], method }
applyManualMarkers(auto, manual) -> merged   // manual wins, monotonic
```

## Candidate approaches
1. **Synthesize-and-match** (the idea in the requirements): render each
   measure to audio from the score, then find where it best matches the
   recording. Confidence = match strength relative to neighbors.
2. **Chroma DTW**: compute chroma features for the recording and for a
   synthesized score rendering; run dynamic time warping; read measure starts
   off the warping path. Confidence = local path cost. Robust to tempo drift;
   well-studied; needs the whole file (fine for an offline tool).
3. **Onset / beat tracking**: estimate beats in the recording, assign to score
   beats. Cheap, but fragile on rubato and sustained passages.

Start with 2 unless a prototype shows otherwise; keep 1 as a fallback for
measures with low confidence.

## Confidence and display
- Group confidence into bands (e.g., ≥90 green, 60–89 amber, <60 red). Keep
  band edges in one place; the legend reads from it.
- "Next uncertain" jumps to the next measure below the amber threshold.

## Constraints
- Monotonic: measure n+1 never starts before measure n.
- Manual markers survive re-running auto-alignment.
- Both score time and recording time exist; name variables by which one.
- Large files: run alignment off the main thread (worker) with progress.
