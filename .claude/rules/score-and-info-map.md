---
# Adjust these globs once the source layout exists.
paths:
  - "**/score/**"
  - "**/musicxml/**"
  - "**/info-map/**"
  - "**/infomap/**"
---
# Score parsing and the information map

- Everything downstream (sync, display, export) reads the **info map**, never
  raw MusicXML. Parse once, at import, into this shape:

  ```
  Instrument {
    id: string            // stable, from MusicXML part id
    name: string          // "Cello Section"
    section: Strings | Woodwinds | Brass | Percussion | Other
    notes: [{
      time: number        // seconds in score time (before sync)
      duration: number    // seconds
      pitch: number       // MIDI note number
      dynamics: pp | p | mp | mf | f | ff | fff
      styleMarking: Staccato | Slur | Marcato | ... | null
      measure: number
    }]
  }
  ```
- Support up to **64 parts**. Don't assume a fixed orchestra; derive parts and
  sections from the `part-list`, with a fallback section of `Other`.
- A dynamic persists until the next dynamic marking in that part. Apply the
  score's written dynamic; never infer loudness from audio.
- Hiding a part is a display setting only. It must not alter the info map or
  playback audio.
- Keep parsing deterministic and testable: same MusicXML in, same info map out.
  Add a fixture-based test for every MusicXML quirk you fix.
