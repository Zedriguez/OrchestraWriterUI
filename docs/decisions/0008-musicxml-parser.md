# 0008. MusicXML parsing: in-house walker over fast-xml-parser, run as a server job

Date: 2026-10-26
Status: accepted

## Context
No maintained, permissively licensed JavaScript library turns MusicXML into
timed per-part notes with dynamics. OSMD (BSD-3) parses for rendering and is
heavy; Verovio is LGPL; musicxml-interfaces is unmaintained. The info map
needs exact timing (divisions, backup/forward, ties, tempo map, repeats) and
deterministic output for tests.

## Decision
- `src/shared/score/parse.ts` walks the document with `fast-xml-parser` (MIT,
  preserveOrder) and handles `.mxl` with `fflate` (MIT). It is isomorphic: the
  same module runs in the server's parse-score job and in the browser when a
  project file is opened.
- Parsing happens on the server (ADR 0004): upload to S3 → `POST
  /projects/:id/score` → inline job → `info-map.json` written to S3 → client
  fetches it with a presigned URL. The info map is a cache; the MusicXML stays
  the source.
- Instruments are classified from `instrument-sound`, then General MIDI
  program, then name keywords (see `docs/research/sync-and-instrument-identification.md`).
- Every quirk handled gets a fixture under `fixtures/scores/` and a test.

## Consequences
- The 64-part limit, repeat expansion and ignored jumps are enforced in one
  place and reported as warnings on the Import screen.
- Engraved rendering (OSMD) can be added later from the same MusicXML without
  touching the info map.
