# Project state

Edited only on `main` (or in the PR that merges). Everything Claude needs to
know about *where we are* lives here; *what we're building* lives in `docs/spec/`.

Last updated: 2026-10-26

## Status by requirement

| # | Requirement | Status | Branch / owner | Notes |
|---|---|---|---|---|
| 1 | Upload score (MusicXML) + optional MP3 | in progress | main (front end) | Import screen built on the mock job API; real parser pending |
| 2 | Sync score and audio (auto + manual, confidence) | in progress | main (front end) | Sync screen built (bands, markers, nudge, next uncertain); alignment method undecided |
| 3 | Information map | in progress | main (front end) | types in `src/shared/info-map.ts`; mock generator only |
| 4 | Customize display (one style, colors, positions, 64 parts) | in progress | main (front end) | Customize screen built; settings live in `DisplaySettings` |
| 5 | Generate the visual | in progress | main (front end) | Canvas 2D renderer behind `GlowRenderer` |
| 6 | Export (project file, MP4) | in progress | main (front end) | Export screen on mock jobs; server pipeline pending |
| 7 | Playback (controls, measure highlight, click-to-play) | in progress | main (front end) | silent demo clock; audio element pending |
| 8 | Local saving (manual project file) | not started | | schema in `src/shared/project-file.ts` |

Status values: not started · in progress · in review · done · blocked

## Screens

| Screen | Status | Notes |
|---|---|---|
| Import | designed | front end built, mock jobs |
| Sync | designed | only with uploaded audio; nudge default, ms advanced |
| Customize | designed | pitch ramp + Mappings labeled later phase |
| Preview | designed | matches the direction A mockup |
| Export | designed | project file + MP4 cards, history |

## Open questions (need a human decision)

1. ~~Stack~~ – decided in ADR 0004; rendering library for export still open (Canvas 2D in the browser today).
2. **Alignment method** – see `.claude/skills/score-audio-alignment/SKILL.md` for candidates.
3. ~~Visual direction~~ – A by default, B as a theme (ADR 0005).
4. **Audience** – new listeners following a symphony vs musicians maximizing prep time; needs confirmation.
5. **MP4 export** – in-browser (WebCodecs / ffmpeg.wasm) vs server-side.

## Known breakage

None recorded. Front end runs entirely on mock data (`src/lib/mock/`, `src/lib/api/mock.ts`).

## Later-phase backlog (not in scope)

Other score/audio formats · custom mappings and gradients · pitch, articulation,
ramps, look-ahead ring · browser auto-restore · cloud storage.

Sign-in, library, programs and profile screens exist as front-end designs (the
product brief asked for them); they stay behind the auth adapter and do not
change requirement 8 Scope 1 until STATE.md moves it.
