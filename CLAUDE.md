# Orchestra Visualizer

A web app that shows which parts of an orchestra are playing, and how loud the
score says they are, while a recording plays. Users upload a MusicXML score and
an optional MP3, check the sync, set up the display, preview it, and export a
project file or an MP4 with audio.

Core rule of the product: **the light shows the written dynamic in the score,
not the loudness of the recording.** Brightness = dynamic, color = section.

## Read first (loaded automatically)

@docs/STATE.md
@docs/spec/requirements.md
@docs/spec/design.md

## Design principles (apply to every UI and visual decision)

1. **Match the score.** The visual reflects which parts play and their written
   dynamic. Never derive brightness from the audio signal.
2. **No training needed.** Plain part names and a legend. A first-time listener
   can name the section that is playing.
3. **Clear when busy.** Many bright parts must still read as separate sections.

## Scope: MVP vs later phase

| Area | MVP | Later phase (do NOT build unless STATE.md moves it) |
|---|---|---|
| Input | MusicXML, optional MP3 | Sibelius, PDF, other audio formats |
| Sync | Auto alignment + manual markers, confidence per measure | — |
| Display | One style, labeled seating layout, adjustable colors/positions, up to 64 parts, brightness follows dynamics | Custom mappings, color/saturation/brightness gradients, pitch, articulation, ramps, look-ahead ring |
| Playback | Controls, current-measure highlight, click a measure to start | — |
| Saving/export | Manual project file (no account), project file or MP4 | Auto-restore in browser, sign-in, cloud storage |

If a task touches a later-phase item, stop and say so before writing code.

## Page flow

Import → Sync (only when an MP3 was uploaded) → Customize → Preview → Export.
Preview can go back to Customize, or to Sync when a recording exists.

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind v4, zustand, lucide-react.
See ADR 0004 (stack), 0005 (visual direction), 0006 (front-end architecture).
Rendering: Canvas 2D behind the `GlowRenderer` interface (PixiJS/Three may
replace it). Fonts: Lora + Inter (next/font), Bravura Text (CDN) for pp–fff.

```
dev:    npm run dev        # http://localhost:3000
lint:   npm run lint
types:  npx tsc --noEmit   # run `npx next typegen` first on a fresh clone
build:  npm run build
```

Source layout: `src/app` routes in `(auth)`, `(app)`, `(workflow)` groups;
`src/shared` contracts (future shared package); `src/lib` api / mock / store /
visualizer; `src/components` by area, `ui` primitives, `music` transport and
score, `visualizer` stage.

## Vocabulary

- **Part** – one staff/line in the MusicXML (e.g., Violin I). Up to 64.
- **Section** – a family of parts (Strings, Woodwinds, Brass, Percussion).
- **Info map** – the parsed per-part note list (time, duration, pitch, dynamic,
  style marking). Everything downstream reads this, never raw MusicXML.
- **Marker** – a user-placed or auto-generated alignment point tying a measure
  (or note) to a timestamp in the recording.
- **Confidence** – 0–100% per measure from the auto-aligner; shown as a color.
- **Project file** – importable file containing score, audio, markers, settings.

## Working conventions (team)

- One branch per feature. Never commit to `main` directly; merge via PR.
- Before ending a session, run `/handoff`. It appends to
  `docs/handoffs/<branch>.md` so the next person (or agent) can pick up.
- Decisions go in `docs/decisions/`, one file each, copied from `0000-template.md`.
- `docs/STATE.md` is edited only on `main` or in the PR that merges the change.
- Don't hand-edit `.claude/agent-memory/`. Commit it only in the PR that
  produced it, and resolve conflicts by keeping both sides' facts.
- Prefer small, verifiable steps. Run lint and tests before claiming done.
- Don't add a dependency without saying why and checking its license
  (the project leans on open-source, permissively licensed tools).

## Where things live

- `.claude/rules/` – topic rules, auto-loaded by file path
- `.claude/agents/` – subagents (planner, reviewer, score-engineer, visual-engineer)
- `.claude/skills/` – reference knowledge Claude loads when relevant
- `.claude/commands/` – `/handoff`, `/status`, `/scope-check`
- `.claude/hooks/` – scripts wired in `.claude/settings.json`
- `docs/spec/` – the requirements and design spec, as markdown
