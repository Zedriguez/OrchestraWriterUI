# Orchestra Visualizer: specification

Last updated: 2026-10-26, Milestone 1. This spec describes what is built today.
The full requirement text and screen descriptions are in
`docs/spec/requirements.md` and `docs/spec/design.md`, and the reasons behind
each technical choice are in `docs/decisions/` (ADRs 0001–0013).

## 1. Purpose

The app shows which parts of an orchestra are playing, and how loud the score
says they are, while a recording plays. Its two audiences are:

- **New listeners**, who want to follow a symphony without reading a score.
- **Musicians short on preparation time**, such as a conductor who needs to know
  whether a passage belongs to the first or the second violins before
  rehearsal.

### Design principles

1. **Match the score.** Light shows which parts play and their *written*
   dynamic. The audio signal never drives brightness.
2. **No training needed.** The display uses plain part names and a legend, so
   a first-time listener can name the section that is playing.
3. **Clear when busy.** Even when many parts are bright, the sections stay
   distinguishable.

### Visual encoding

The stage shows exactly three things:

| What | Encoding |
|---|---|
| A part is playing | its glow is on (with a short fade in and out) |
| Written dynamic | brightness on a fixed ladder: pp, p, mp, mf, f, ff, fff |
| Section | hue (strings, woodwinds, brass, percussion, other); parts within a section get tints |

Each glow has a label with the part name and its current dynamic, set in the
Bravura music font. A pp–fff legend sits on the stage. Pitch, articulation,
dynamic ramps and look-ahead cues are left for a later phase.

## 2. Functional requirements and status

| # | Requirement | What is implemented |
|---|---|---|
| 1 | Upload a score and optional audio | MusicXML (`.musicxml`, `.xml`, compressed `.mxl`) plus an optional MP3. Files go straight to S3 through presigned URLs, with caps of 50 MB per score and 500 MB per recording. The Import page shows the file summary, parse progress, warnings and errors. |
| 2 | Sync score and audio | The aligner runs automatically on the first visit to Sync. Each measure gets a confidence score from 0–100% and a color (red means uncertain), and a **Next uncertain** button jumps between weak spots. Users fix the timing with nudge buttons (and millisecond fields under Advanced) that create manual markers. Re-running the aligner keeps those markers. |
| 3 | Information map | The parsed per-part note list (time, duration, pitch, dynamic, style marking, measure). Everything downstream reads this map instead of raw MusicXML. The parser handles up to 64 parts, ties, backup/forward, tempo changes, repeats and transposing instruments. |
| 4 | Customize the display | One visual style. Users can show or hide each part (hiding a part changes the picture, not the audio), drag glows to new positions on the seating plan, set section and part colors, switch between section and part labels, change glow size, and turn on reduced motion. Settings autosave. |
| 5 | Generate the visual | Preview plays the visualization with the uploaded or generated audio. The score, orchestra and visualizer panels can be collapsed. Preview links back to **Edit display**, and to **Edit sync** when the project has a recording. |
| 6 | Export | A project file (`.ovproj`), or an MP4 at 720p, 1080p or 4K and 30 or 60 fps, with the uploaded or generated audio. Exports show progress, can be cancelled and retried, and are listed in an export history. |
| 7 | Playback | Play/pause, seek, mute and keyboard shortcuts, with the current measure highlighted. Clicking a measure starts playback there. When there's no recording, a Web Audio synthesizer plays the score. |
| 8 | Saving and persistence | `.ovproj` save and open (score, audio, markers, display settings). Each signed-in account also keeps its projects on the server, so work comes back across sessions and devices. |

Beyond the eight requirements, the app has accounts (email and password, plus
Google sign-in when it's configured), a project library, programs (concert
programs with an ordered list of pieces), a profile with storage usage, and
settings such as theme, reduced motion and export defaults.

### Out of scope for now

These are planned for a later phase: other score and audio formats (Sibelius,
PDF, extracting audio from video), custom mappings from musical data to visual
effects, color and brightness gradients, pitch, articulation and ramp effects,
engraved notation, account-free mode, public share pages, and publishing
straight to YouTube.

## 3. Page flow

```
Import ──(recording uploaded)──▶ Sync ──▶ Customize ──▶ Preview ──▶ Export
   └──────(score only)──────────────────────▲    ▲          │
                                            │    └──────────┤ Edit display
                                            └───────────────┘ Edit sync (recording only)
```

Before the workflow, users land in the Library, where they open or create a
project, or open a saved `.ovproj` file.

## 4. System architecture

The app is one Next.js 16 application with two halves: the pages, and an
HTTP API mounted at `/api` that runs in the same process. Postgres stores
accounts and project data, and S3 stores files. We kept the heavy work that
needs the decoded audio or the renderer (alignment and MP4 export) in the
browser. Score parsing runs on the server.

```
Browser (Next.js pages, React 19)                 Server (same Next.js process)
┌──────────────────────────────────────┐          ┌──────────────────────────────────┐
│ Screens ── zustand stores ── ApiClient│──HTTP──▶│ /api/* → Hono app (src/server)    │
│                                       │          │   Better Auth   /api/auth/*       │
│ Visualizer: Canvas 2D GlowRenderer    │          │   routes → services → db/storage  │
│   + FrameEngine (fades, dynamics)     │          │   parse-score job (shared parser) │
│ Audio: <audio> for recordings,        │          │   migrations + seeds on boot      │
│   Web Audio synth for score playback  │          └──────────┬───────────────┬────────┘
│ Alignment: chroma DTW in a Web Worker │                     │ pg            │ AWS SDK
│ MP4 export: WebCodecs + mp4-muxer     │                     ▼               ▼
│ .ovproj pack/unpack (zip)             │──presigned PUT/GET──────────────▶ S3
└──────────────────────────────────────┘                  Postgres
```

### Components

| Component | Where | What it does |
|---|---|---|
| Screens and UI | `src/app`, `src/components` | Next.js App Router routes in three groups: `(auth)`, `(app)` (library, programs, profile, settings) and `(workflow)` (the five steps). Radix UI primitives, sonner toasts, Lucide icons, Tailwind v4 design tokens. |
| Client state | `src/lib/store` | zustand stores for the project (info map, display settings, sync markers, autosave), playback (one transport clock that every screen shares), preferences and session. |
| API client | `src/lib/api` | A typed `ApiClient` with two implementations: HTTP for real use and in-memory for tests and design review. Long-running work shows up as a job that the UI polls. |
| Shared contracts | `src/shared` | Types and logic used by both server and browser: the info map, the project file format and its migrations, sync state and the marker merge, and the API DTOs. |
| MusicXML parser | `src/shared/score` | Walks the XML with `fast-xml-parser` and unzips `.mxl` with `fflate`. It runs in both server and browser, classifies each instrument into a section, and reports warnings (repeats expanded, jumps ignored, more than 64 parts). |
| Aligner | `src/lib/align` | Chroma DTW. It computes chroma from the recording (STFT) and from the score (synthesized from the info map and weighted by dynamic), then runs a banded DTW with cosine cost. It outputs each measure's start time and a confidence score. It runs in a Web Worker and can be cancelled. |
| Audio engines | `src/lib/audio` | An `<audio>` element plays an uploaded recording. A Web Audio synthesizer plays the score when there's no recording, and also renders audio offline for MP4 export. |
| Visualizer | `src/lib/visualizer`, `src/components/visualizer` | A Canvas 2D implementation of the `GlowRenderer` interface, so PixiJS or Three.js could replace it. The `FrameEngine` turns the info map and the playback time into what each part should show, including fades and reduced motion. It also handles the seating layout and places labels. |
| MP4 export | `src/lib/export` | Renders frames with the same renderer and label layout as Preview. It encodes H.264 with `VideoEncoder` and AAC with `AudioEncoder` (when the browser has one) and muxes them with `mp4-muxer`. The file downloads in the browser and is uploaded to the export history. |
| HTTP API | `src/server` | A Hono app that `src/app/api/[[...route]]/route.ts` mounts. Handlers are split into routes (validation), services (business logic) and db/storage. Every query is filtered by the signed-in user. |
| Auth | `src/server/auth.ts` | Better Auth with email and password, plus Google when configured. Sessions are HttpOnly cookies. |
| Database | Postgres 17 | The `auth` schema holds users, sessions and accounts. The `app` schema holds profiles, projects (with sync and display stored as JSON), programs, program_projects, jobs, exports and activity. SQL migrations run on boot. |
| Object storage | S3 (S3Mock locally) | Keys are prefixed with `users/<id>/projects/<pid>/` and hold scores, recordings, info-map JSON and exports. The browser uploads and downloads files through presigned URLs, so file bytes never pass through the app server. |

### Key data flows

1. **Import.** The browser asks `POST /api/uploads` for a presigned PUT and
   uploads the score to S3. It then calls `POST /api/projects/:id/score`, which
   starts the parse-score job. The job runs the shared parser and writes
   `info-map-<job>.json` to S3, while the browser polls
   `GET /api/jobs/:id`. A recording goes through the same upload, and its
   waveform peaks are computed in the browser.
2. **Sync.** The browser decodes the MP3 and runs the aligner in a worker. It
   saves the per-measure results and the manual markers with
   `PUT /api/projects/:id/sync`. Manual markers always override the automatic
   ones, and measure times must keep increasing.
3. **Customize, Preview.** Display settings autosave with
   `PUT /api/projects/:id/display`. Playback drives one shared clock. Each
   frame, the `FrameEngine` looks up the active notes and their dynamics in
   the info map, using the sync map to convert recording time to score time.
4. **Export.** The browser renders and encodes the MP4 frame by frame,
   uploads it to S3, and registers it with `POST /api/projects/:id/exports`.
   A `.ovproj` file is a zip of `project.json` (version 1) with the original
   score and audio. Opening one creates a new project, and the server parses
   the score again.

The full route list is in `docs/backend/API.md`.

### Why this shape

- **One process.** Running the API inside Next.js means one dev server, one
  Docker image, and no CORS (ADR 0007).
- **Alignment and export in the browser.** The browser has already decoded the
  audio, and it already holds the info map and the renderer. Rendering the MP4
  there means it uses exactly the same renderer as Preview, and it avoids the
  Lambda time and memory limits we listed as a risk in the proposal
  (ADRs 0009, 0010). The `Aligner` and `GlowRenderer` interfaces leave room
  to move either to the server later.
- **Parser shared by server and browser.** The server parses uploads, and the
  browser parses a score inside an opened `.ovproj`, both with the same code
  (ADR 0008).

### Deployment

`Dockerfile` builds a standalone Next.js image. On a push to `main`,
`.github/workflows/deploy.yml` deploys it to AWS App Runner, with RDS Postgres
and S3 behind it. CI runs lint, typecheck, unit, API and Playwright tests on
every pull request. Locally, `docker compose` provides Postgres and S3Mock.

The backend also contains an audio-to-score transcription pipeline
(`/api/transcriptions`, AWS Step Functions in production). It is kept in the
code but has no UI. Whether to keep it is an open question.

## 5. Known limitations

- MP4 export needs WebCodecs. Chrome and Edge are tested. Firefox exports
  video only, because it has no AAC encoder. Safari hasn't been tested.
- We tuned the alignment confidence thresholds on synthetic audio only.
- In part-label mode with 64 parts, labels overlap.
- Password reset needs an email provider, which isn't set up yet.
- Each file has a size cap, but there is no per-user storage quota yet.
