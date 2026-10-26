# 0004. Stack: Next.js/TypeScript front end, AWS server for all heavy processing

Date: 2026-10-26
Status: accepted

## Context
The requirements and design spec don't name a stack. The team's earlier
architecture spec does (Next.js, Clerk, AWS hosting, Lambda processing,
Three.js, Blender/Illustrator for assets), and the team has confirmed it still
stands, with rendering libraries left open.

## Decision
- **Front end:** Next.js (App Router) in TypeScript.
- **Auth:** Clerk.
- **Server:** AWS. Score parsing (MusicXML → info map), score-generated audio,
  score↔audio alignment, and MP4 export all run server-side as jobs, not in
  the browser. Lambda is the default compute; a job that exceeds Lambda limits
  moves to a container, not back to the browser.
- **Rendering:** PixiJS + pixi-filters and Rive are the starting point. Three.js
  and other UI/rendering libraries are allowed when they fit; nothing is
  excluded. The renderer stays behind one interface so libraries can be mixed
  or swapped.
- **Shared code:** info-map types and the project-file schema live in one
  shared package used by both the web app and the services.
- **Specific libraries** for MusicXML parsing, audio synthesis, alignment, and
  video encoding are not chosen yet. Each gets its own ADR when picked.

## Consequences
- The web app is a thin client over an async job API: upload → job id → poll
  or subscribe → result. Every processing screen (Import, Sync, Export) needs
  progress, error, and retry states.
- "Preview and export share one renderer" now means the renderer must also run
  headless on AWS (Node canvas/WebGL, or a headless browser capturing frames).
  Choose rendering libraries with that in mind.
- Clerk exists, but requirement 8 Scope 1 says the MVP needs no account.
  Whether sign-in is required to call the processing API is an open question
  in `docs/STATE.md`.
- Repo layout, commands, and rule globs follow the layout in `CLAUDE.md`.
