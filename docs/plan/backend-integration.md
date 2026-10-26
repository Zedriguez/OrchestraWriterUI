# Backend integration plan (branch `feat/backend-integration`)

Goal: turn the mock-data front end into a working demo. A signed-in user
uploads a MusicXML score and an optional MP3, the score is parsed into the
information map on the server, the recording is aligned to the score in the
browser, the display is customized and previewed with real audio, and the
result is exported as a project file or an MP4. Accounts, projects, programs,
exports and activity persist in Postgres; files live in S3.

The backend repo (SulaimanKhydyrDUKE/OrchestraWriter: Hono + Better Auth +
Postgres + S3, with a transcription pipeline) has been copied into
`src/server/` and runs **inside Next.js** as one process. Its original docs are
in `docs/backend/`.

Read before working: `CLAUDE.md`, `docs/STATE.md`, `.claude/rules/*.md`, the
relevant `.claude/skills/*/SKILL.md`, and this file. Next.js 16 differs from
older versions: check `node_modules/next/dist/docs/` before using an API
(middleware is now `proxy.ts`; `instrumentation.ts` has `register()`; route
params are promises; `LayoutProps`/`PageProps`/`RouteContext` are global types).

## Architecture

```
browser (Next.js app, React 19)                 server (same Next.js process)
┌────────────────────────────────────┐          ┌─────────────────────────────────┐
│ pages ── zustand stores ── ApiClient│──HTTP──▶│ /api/* → Hono app (src/server)   │
│   │          │           (http.ts)  │          │   Better Auth  /api/auth/*        │
│   │     jobs registry               │          │   routes → services → db/storage  │
│   │   (local + mirrored jobs)       │          │   parse-score job (inline)        │
│ Stage (Canvas2D) ── FrameEngine     │          │   instrumentation: migrate + seed │
│ audio engine (<audio> | WebAudio)   │          └──────────┬──────────────────────┘
│ align worker (chroma DTW)           │                     │ pg            │ S3 SDK
│ export: WebCodecs + mp4-muxer       │──presigned PUT/GET──┼───────────────▶ S3 / S3Mock
└────────────────────────────────────┘               Postgres (docker compose locally)
```

Decisions (ADRs to be written in `docs/decisions/` 0007–0011):
- **Auth: Better Auth** (email+password, optional Google) replaces the Clerk
  plan from ADR 0004. Sessions are HttpOnly cookies, same origin, so the
  browser sends nothing special.
- **Hono mounted in Next.js** at `src/app/api/[[...route]]/route.ts` via
  `hono/vercel`. One `npm run dev`, one Docker image, no CORS.
- **Score parsing on the server** (parse-score job), with an isomorphic parser
  in `src/shared/score/` (`fast-xml-parser` + `fflate` for `.mxl`).
- **Alignment in a browser Web Worker** (chroma features + DTW), result saved
  through the API. The recording is already decoded in the browser; no server
  audio stack needed. Interface in `src/shared/sync.ts` (`Aligner`).
- **MP4 export in the browser** with WebCodecs + `mp4-muxer`, using the same
  `Canvas2DGlowRenderer` as Preview; the file is uploaded to S3 for history.
- **Project file (.ovproj)** = zip (`fflate`) with `project.json`,
  `score.musicxml`, `audio.mp3`.
- **UI primitives on `radix-ui`** (Dialog, Tooltip, Switch, ToggleGroup, Tabs,
  DropdownMenu, Slider, Collapsible, Progress) + `sonner` toasts. Native
  `<select>`/`<input>` stay as they are.
- Local dev: `docker compose up -d` (Postgres 17 on 5433 + S3Mock on 9090),
  then `npm run dev`. Migrations and seeds run from `instrumentation.ts` on
  boot. `.env.example` lists every variable; all have local defaults.

## Conventions

- `@/` = `src/`. No `.js` suffixes on relative imports (bundler resolution).
- Server code never reads `process.env` outside `src/server/config/env.ts`.
- Routes validate input, call a service, shape the response. Services call
  db/storage. Row types are snake_case; DTOs (in `src/shared/api.ts`) are
  camelCase with string ids.
- Every protected route checks ownership by `user_id` in the SQL `WHERE`.
- Time is seconds; measures are 1-based; pitch is MIDI. Name variables by
  which clock they are in (score time vs recording time).
- Colors come from tokens in `src/app/globals.css`; never hard-code.
- Any new user setting goes in `DisplaySettings` (project file) or
  `Preferences` (profile), never in localStorage.
- Tests: `vitest` (unit, `*.test.ts` next to the code or under `tests/unit`),
  API integration tests under `tests/api` (need docker compose), Playwright
  under `tests/e2e`. Fixtures under `fixtures/`.
- Verify before claiming done: `npm run lint`, `npx tsc --noEmit`, and the
  tests you added. State what you ran.

## HTTP API (contract; DTOs in `src/shared/api.ts`)

All under `/api`. Errors: `{ error, code? }`. 401 `{ error: "Not signed in" }`.

| Method | Path | Body → Response |
|---|---|---|
| GET | `/health`, `/health/db` | `{ ok }` |
| GET | `/config` | `{ googleEnabled }` |
| GET | `/status` | backend self-checks (as in docs/backend/API.md) |
| * | `/auth/*` | Better Auth (sign-up/email, sign-in/email, sign-in/social, get-session, sign-out) |
| GET | `/me` | `{ profile: ProfileDto }` (profile row created on first call from the auth user) |
| PUT | `/me` | `ProfileUpdate` → `{ profile }` |
| DELETE | `/me` | 204; deletes the user (cascades) and clears the session |
| GET | `/me/usage` | `UsageDto` |
| POST | `/uploads` | `UploadRequest` → `UploadTarget` (key under `users/<uid>/projects/<pid>/...`, or `users/<uid>/imports/...` for `project`) |
| GET | `/projects` | `{ projects: ProjectSummary[] }` newest first |
| POST | `/projects` | `ProjectCreate` → 201 `{ project: ProjectDto }` |
| GET | `/projects/:id` | `{ project: ProjectDto }` (includes `sync`, `display`) |
| PATCH | `/projects/:id` | `ProjectPatch` → `{ project }` |
| DELETE | `/projects/:id` | 204 (removes rows and S3 objects under the project prefix) |
| POST | `/projects/:id/score` | `RegisterScoreRequest` → 202 `{ project, job }`; starts the inline parse-score job: read S3 object → `parseMusicXml` → write `info-map.json` to S3 → update project (title/composer/movement/parts/measures/duration/thumbnail/status/display defaults if none) → job succeeded with `ParseScoreResult`; on `{ ok:false }` job fails with the error and project.status = failed |
| POST | `/projects/:id/audio` | `RegisterAudioRequest` → `{ project }`; inserts `app.audio_files`, sets `has_recording`, `audio_peaks`, clears `sync`, logs activity |
| DELETE | `/projects/:id/audio` | `{ project }` |
| GET | `/projects/:id/urls` | `ProjectUrls` (presigned GET, 15 min) |
| PUT | `/projects/:id/sync` | `SyncState` → `{ project }` |
| PUT | `/projects/:id/display` | `DisplaySettings` → `{ project }` |
| GET | `/projects/:id/exports` | `{ exports: ExportDto[] }` |
| POST | `/projects/:id/exports` | `RegisterExportRequest` → 201 `{ export }` (also logs activity, bumps `exports` count) |
| GET | `/exports/:id/download-url` | `{ url }` |
| GET | `/jobs/:id` | `{ job: JobDto }` (generic visualizer jobs table) |
| GET/POST | `/programs` | list / `ProgramCreate` → 201 `{ program }` |
| GET/PATCH/DELETE | `/programs/:id` | `{ program, projects }` / `ProgramPatch` → `{ program }` / 204 |
| GET | `/activity` | `{ activity: ActivityDto[] }` last 25 |
| * | `/files/*`, `/transcriptions/*`, `/sheets/*` | kept from the backend (transcription pipeline), renamed from `/jobs` to `/transcriptions` |

Project status is derived server-side: `importing` while the parse job runs,
`failed` if it failed, `needs-sync` when `has_recording` and `sync` is null,
`exported` when the project has at least one export, else `ready`. `stage` is
stored and updated by the client (PATCH) as the user advances.

## Database (new migration `src/server/db/sql/migrations/20261026_01_visualizer.sql`)

New tables in schema `app`, all with `user_id → auth.users(id) ON DELETE CASCADE`:
`profiles` (user_id PK, handle UNIQUE, role, ensemble, location, bio, website,
preferences JSONB), `projects` (id, user_id, title, subtitle, composer,
movement, score_filename, score_key, info_map_key, audio_file_id → audio_files
ON DELETE SET NULL, audio_peaks JSONB, parts, measures, duration_seconds,
tempo, time_signature, warnings JSONB, thumbnail JSONB, stage, parse_status,
parse_error, parse_job_id, sync JSONB, display JSONB, created_at, updated_at),
`programs` (id, user_id, name, season, date, venue, description, color, notes),
`program_projects` (program_id, project_id, position; PK (program_id,
project_id)), `jobs` (id, user_id, project_id, kind, status, progress REAL,
message, result JSONB, error, created_at, updated_at), `exports` (id, user_id,
project_id, kind, filename, s3_key UNIQUE, bytes BIGINT, resolution,
frame_rate, created_at), `activity` (id, user_id, project_id, kind, text,
created_at). Add `GRANT`s for `orchestra_worker` only where the pipeline needs
them (it does not need these). Note: new schema-qualified tables must go in a
dated *migration* (not `schema/`) because `schema/*.sql` runs before the
schema-split migration on a fresh database.

## Workstreams and file ownership

Phase 1 runs in parallel. Do not edit files owned by another workstream; if
you must, say so in your report instead.

| WS | Owner agent | Owns | Depends on |
|---|---|---|---|
| WS1 backend | api-engineer | `src/server/**`, `src/app/api/**`, `src/instrumentation.ts`, `next.config.ts`, `Dockerfile`, `docker-compose.yml`, `.env.example`, `scripts/*.sh`, `docs/backend/API.md`, `tests/api/**` | contracts in `src/shared/api.ts`, `src/shared/score/index.ts` (stub) |
| WS2 score + align | score-engineer | `src/shared/score/**`, `src/lib/score/**`, `src/lib/align/**`, `fixtures/scores/**`, `fixtures/audio/**`, `scripts/make-fixtures.ts`; may update imports in `src/lib/visualizer/frame-state.ts` and `src/components/music/ScoreStrip.tsx` when moving helpers out of `src/lib/mock/info-map.ts` | — |
| WS3 audio + export | visual-engineer | `src/lib/audio/**`, `src/lib/export/**`, `src/lib/visualizer/**` (labels refactor), `src/lib/store/playback.ts`, `src/components/visualizer/Stage.tsx`, `src/components/music/Transport.tsx`, `src/components/music/Waveform.tsx` | contracts |
| WS4a UI primitives | ui-engineer | `src/components/ui/**`, `src/components/shell/UserMenu.tsx`, `src/app/layout.tsx` (providers), `src/app/globals.css` (additions only) | — |
| WS4c client data | general-purpose | `src/lib/api/**`, `src/lib/auth/**`, `src/lib/store/project.ts`, `src/lib/store/preferences.ts`, `src/lib/jobs/**`, `src/proxy.ts`, `src/components/shell/ProjectLoader.tsx` | contracts; calls WS2/WS3 modules by their documented signatures |

Phase 2 (after phase 1): page wiring + decluttering, split A (auth, library,
programs, profile, settings, AppNav, WorkflowNav) and B (import, sync,
customize, preview, export). Phase 3: tests/CI, docs, manual run-through.

Known phase-1 breakage that phase 2 fixes: `src/lib/api/mock.ts` and
`src/components/import/ImportPage.tsx` no longer match `ApiClient` (WS4c fixes
the mock; phase 2 rewrites the page).

## Module signatures other workstreams rely on

- `src/shared/score`: `parseMusicXml({ bytes, filename }): ParseOutcome`,
  `summarizeInfoMap(infoMap): ScoreSummary`, `abbreviateInstrumentName(name)`.
- `src/lib/score/segments.ts` (WS2): `activitySegments(inst)`, `segmentAt(segs, t)`,
  `measureDynamic(inst, measure)` (moved from `src/lib/mock/info-map.ts`, which
  keeps re-exporting them so nothing else breaks).
- `src/lib/align/index.ts` (WS2): `chromaDtwAligner: Aligner`;
  `src/lib/align/worker-client.ts`: `alignInWorker(infoMap, audio, onProgress, signal): Promise<SyncState>`.
- `src/lib/audio/index.ts` (WS3): `decodeAudioFile(file | ArrayBuffer): Promise<AudioBuffer>`,
  `peaksFromAudioBuffer(buffer, bars = 420): number[]`, `peaksFromInfoMap(infoMap, bars = 420): number[]`,
  `toAlignAudio(buffer): AlignAudio` (mono, downmixed), `AudioEngine` interface with
  `createRecordingEngine(url)` and `createScoreSynthEngine(infoMap)`; `usePlayback` gains
  `attach(engine | null)` and keeps its existing actions.
- `src/lib/export/index.ts` (WS3): `renderMp4({ infoMap, display, aligned, audio: AudioBuffer | null, durationSec, resolution, frameRate, title, onProgress, signal }): Promise<Blob>`,
  `packProjectFile({ project, scoreBytes, scoreFilename, audioBytes?, audioFilename? }): Uint8Array`,
  `unpackProjectFile(bytes): { project: ProjectFile; scoreBytes; audioBytes? }`.
- `src/lib/jobs/registry.ts` (done): `runLocalJob`, `createJob`, `updateJob`,
  `mirrorRemoteJob`, `getJob`, `subscribeJob`.

## Decluttering rules (phase 2)

- One `h1` per page (serif, ~2rem). No eyebrow + headline pairs; the stepper
  already says which step you are on.
- A card has either a short muted label or a heading, never both.
- Delete demo copy, fake numbers, fake links, the Apple button, magic link,
  notification bell, header search; the library keeps its own search.
- Keep one legend per color encoding; keyboard hints live in transport tooltips.
- Settings: Account (incl. storage usage and delete account), Appearance,
  Export defaults.
- Preview header: title, movement, bar counter, actions. Panels collapsible.
