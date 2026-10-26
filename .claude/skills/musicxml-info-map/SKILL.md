---
name: musicxml-info-map
description: How to turn a MusicXML score into the Orchestra Visualizer information map (per-part notes with time, duration, pitch, dynamic, style marking, measure). Use when parsing MusicXML, building or changing the info map, or debugging wrong timings, dynamics, or missing parts.
---
# MusicXML → information map

Check what's installed first. If the repo already has a MusicXML library, use
it; if not, prefer a maintained, permissively licensed one and write an ADR.

## Structure to walk
- `score-partwise` is the common form; convert `score-timewise` to it first.
- `part-list/score-part` gives `id`, `part-name`, and `score-instrument`.
  Derive the **section** from instrument name keywords (violin, viola,
  cello, bass → Strings; flute, oboe, clarinet, bassoon → Woodwinds; horn,
  trumpet, trombone, tuba → Brass; timpani, percussion → Percussion) with a
  fallback of `Other`. Let the user re-assign in Customize.
- Within each `part/measure`: `attributes/divisions` (ticks per quarter, can
  change mid-part), `note/duration` (in divisions), `note/pitch`,
  `note/rest`, `note/chord` (same onset as previous note), `note/voice`,
  `backup`/`forward` (move the time cursor), `direction/direction-type/dynamics`
  (pp…fff, also `sfz` etc. – map to the nearest of the seven), `sound tempo`,
  `direction-type/metronome`, `notations/articulations` and `notations/slur`.

## Timing
- Keep a cursor in divisions per part; convert to seconds with the active
  tempo. Tempo lives in `sound tempo` or `metronome`; default 120 if absent.
- Repeats, D.C., D.S., and codas change playback order. MVP: expand repeats
  (`barline/repeat`) and ignore jumps with a warning; log it in the import
  status.
- Ties merge durations; slurs don't.
- Grace notes have no duration; give them 0 and keep them for style markings.

## Dynamics
- A dynamic applies from its position until the next dynamic in the same part.
- Hairpins (`wedge`) are later phase; MVP keeps the stepped value.

## Common bugs to test for
- `divisions` change mid-part → wrong durations after the change.
- Multi-voice measures counted sequentially instead of in parallel.
- Transposing instruments: keep **written** pitch for display; note sounding
  pitch is not needed in MVP.
- Parts with no `part-name` → fall back to `id`.
- More than 64 parts → import error with a clear message.
