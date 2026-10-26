# 0001. MVP is MusicXML + optional MP3, one visualization style, manual project files

Date: 2026-10-22
Status: accepted

## Context
The requirements and design spec split every area into an initial scope and
expansions. Without a hard line, work drifts into mappings, gradients, cloud
storage, and extra formats before the core loop works.

## Decision
MVP = requirements 1–8 at their "initial scope / Scope 1" level: MusicXML input,
optional MP3, auto alignment with manual markers and per-measure confidence,
one visualization style with adjustable colors and positions for up to 64
parts, playback with measure highlight and click-to-play, export as project
file or MP4, manual save/open with no account.

## Consequences
Anything in the later-phase column of `CLAUDE.md` is refused by default and
needs an update to `docs/STATE.md` to enter scope. Code should still keep
interfaces (renderer, aligner, persistence) swappable so expansions don't
require rewrites.
