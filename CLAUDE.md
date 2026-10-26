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

Next.js 16 (App Router) + TypeScript + Tailwind v4, zustand, radix-ui + sonner
(UI primitives), lucide-react. The API is a Hono app in `src/server/` mounted
at `/api` (Better Auth sessions, Postgres via `pg`, S3 presigned uploads); it
runs inside the same Next.js process (ADR 0007). Score parsing is an
isomorphic module (ADR 0008); alignment runs in a Web Worker (ADR 0009); MP4
export runs in the browser with WebCodecs (ADR 0010); `.ovproj` is a zip
(ADR 0012). Rendering: Canvas 2D behind the `GlowRenderer` interface.
Fonts: Lora + Inter (next/font), Bravura Text (CDN) for pp–fff.

```
stack:  docker compose up -d        # Postgres 17 (5433) + S3Mock (9090); needed by the API
dev:    npm run dev                 # http://localhost:3000; migrations run on boot
lint:   npm run lint
types:  npm run typecheck           # next typegen + tsc --noEmit
unit:   npm test                    # vitest: src/**/*.test.ts(x), tests/unit
api:    npm run test:api            # tests/api against docker compose
e2e:    npm run test:e2e            # Playwright (Chromium) against the dev server
build:  npm run build
db:     npm run db:migrate | db:seed | db:ping
mock:   NEXT_PUBLIC_API_MOCK=1 npm run dev   # front end on the in-memory mock API
```

Source layout: `src/app` routes in `(auth)`, `(app)`, `(workflow)` groups plus
`api/[[...route]]`; `src/server` the Hono API (routes → services → db/storage);
`src/shared` contracts shared by server and browser (info map, project file,
sync, API DTOs, the MusicXML parser); `src/lib` api client, auth, stores, jobs
registry, score helpers, align, audio, export, visualizer; `src/components`
by area, `ui` primitives, `music` transport and score, `visualizer` stage.
Tests: `tests/unit`, `tests/api`, `tests/e2e`; fixtures in `fixtures/`.

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

- `.claude/rules/` – topic rules, auto-loaded by file path (incl. `server.md`)
- `.claude/agents/` – subagents (planner, reviewer, score-engineer, visual-engineer)
- `.claude/skills/` – reference knowledge Claude loads when relevant
- `.claude/commands/` – `/handoff`, `/status`, `/scope-check`
- `.claude/hooks/` – scripts wired in `.claude/settings.json`
- `docs/spec/` – the requirements and design spec, as markdown
- `docs/plan/backend-integration.md` – the integration plan: API table, module signatures, decluttering rules
- `docs/backend/` – server README and API reference; `docs/research/` – library research
