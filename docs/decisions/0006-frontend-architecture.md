# 0006. Front-end architecture: app shell + workflow shell, mock job API, renderer behind one interface

Date: 2026-10-26
Status: accepted

## Context
ADR 0004 fixes Next.js (App Router, TypeScript), Clerk, and an AWS async job
API. The front end was built before the services exist, so it needs seams
that let the real backend drop in without redesign.

## Decision
**Routes**
- `(auth)`: `/sign-in`, `/sign-up` — custom forms over an auth adapter
  (`src/lib/auth/session.ts`). Clerk Elements / `useSignIn` wire in here.
- `(app)`: `/library`, `/programs`, `/programs/[id]`, `/profile`, `/settings`
  — the director's home, behind the top app nav.
- `(workflow)`: `/projects/[id]/{import,sync,customize,preview,export}` —
  the five spec screens behind the stepper nav. Sync is shown struck-through
  when the project has no recording (ADR 0003).

**Data and state**
- `src/shared/` holds the contracts that will move to the shared package:
  info map, project file, sync (bands, merge, monotonic rule), jobs, domain.
- `src/lib/api/` is the job API client interface (`ApiClient`) with a mock
  implementation that simulates progress, success and failure. Pages consume
  jobs through `useJob(jobId)`.
- Zustand stores: `project` (info map, display settings, sync markers,
  dirty/saved), `playback` (one transport clock shared by Sync, Customize and
  Preview, with shared keyboard shortcuts), `preferences`, `session`.
- Mock data (`src/lib/mock/`) is deterministic (seeded) so screenshots and
  tests are stable.

**Rendering**
- `GlowRenderer` (`src/lib/visualizer/renderer.ts`) is the one interface:
  `mount / resize / render(scene) / destroy`. `Canvas2DGlowRenderer` is the
  first implementation (additive radial gradients at reduced resolution plus
  a blur pass; brightness applied as luminance). PixiJS/Three/headless canvas
  implement the same interface for export.
- `FrameEngine` turns the info map + a clock into per-part `{playing,
  dynamic, level}` with attack/release envelopes; reduced motion makes them
  instant. Labels and leader lines are DOM/SVG overlays, not canvas.
- Two clocks: the transport runs in recording time when a recording exists;
  `useProjectTiming` maps it onto score time through the merged alignment.

## Consequences
- Replacing the mock API is a one-file change (`src/lib/api/index.ts`).
- Any new user setting must be added to `DisplaySettings` in
  `src/shared/project-file.ts` (project-file rule).
- The schematic score strip is a placeholder for an engraving renderer
  (OSMD / Verovio); it already supports page navigation independent of
  playback, follow mode, and click-to-play.
