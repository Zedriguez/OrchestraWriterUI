# The server

The API that backs the app. It began as the separate OrchestraWriter repo
(Hono + Better Auth + Postgres + S3 + a transcription pipeline) and now runs
inside this Next.js app: `src/server/` is mounted at `/api` by
`src/app/api/[[...route]]/route.ts` (ADR 0007). `API.md` lists every route.
`architecture.drawio` / `.png` is the original AWS diagram (still accurate for
the hosting and the transcription pipeline; the web tier is now the Next.js
image).

## Layout

```
src/server/
  app.ts            builds the Hono app (basePath /api), middleware order, error handler
  auth.ts           Better Auth instance (owns auth.* tables and /api/auth/*)
  config/env.ts     every environment variable, with local defaults outside production
  db/               pg pool (one per process), migrate/seed runners, cli.ts, sql/
    sql/schema/     CREATE TABLE files applied once, in order (original backend tables)
    sql/migrations/ dated changes; new app tables live here (schema-qualified)
    sql/seeds/      lookup data (instruments); re-runnable
  storage/          S3 clients, key layout, presigned URLs, head/delete helpers
  routes/           HTTP handlers: validate, call a service, shape the response
  services/         business logic: profiles, projects, parse-score, jobs, uploads,
                    exports, programs, activity, files, transcriptions, status
  pipeline/         the transcription pipeline (split → transcribe → merge → notate → finalize)
  types/db.ts       row types, snake_case
src/instrumentation.ts   runs migrations and seeds when the server boots
```

## Run locally

```bash
docker compose up -d      # Postgres 17 on localhost:5433, S3Mock on localhost:9090
npm run dev               # http://localhost:3000; migrations run on boot
```

No `.env` is needed: `config/env.ts` defaults to the compose values when
`NODE_ENV` is not production. `.env.example` lists every variable. Useful:

```bash
npm run db:ping | db:migrate | db:seed    # the same runners, from the CLI
npm run test:api                          # tests/api/** against the compose stack
scripts/smoke-test.sh [base-url]          # curl walk-through: auth, uploads, projects, parse job, transcription
docker compose --profile app up --build   # the production image (Dockerfile) against the local stack
docker compose --profile app down -v      # stop and wipe local data
```

If Postgres is down the server logs one line and keeps serving; routes that
need the database answer 503 until it is back. Peek at the data with
`psql "postgres://postgres:orchestra@localhost:5433/orchestra"` and at the
bucket with `curl -s "http://localhost:9090/orchestra-audio?list-type=2"`.

## How it fits together

- **Auth.** Better Auth stores users, sessions, accounts and verifications in
  the `auth` schema. Sessions are HttpOnly cookies
  (`better-auth.session_token`, `__Secure-` prefixed on https). `requireUser`
  turns the cookie into `c.get("userId")`; every query filters by it.
- **Files.** The browser asks `POST /api/uploads` for a presigned PUT, uploads
  straight to S3, then registers the key (`/projects/:id/score`,
  `/projects/:id/audio`, `/projects/:id/exports`). Keys are
  `users/<id>/projects/<pid>/...`, so a key alone proves ownership. Playback
  and downloads use presigned GETs from `/projects/:id/urls`.
- **Parsing.** Registering a score starts an in-process job that reads the
  object, runs the shared MusicXML parser (`src/shared/score`), writes
  `info-map-<job>.json` back to S3 and updates the project row. Poll
  `GET /api/jobs/:id`.
- **Alignment and exports** run in the browser; the server stores the results
  (`PUT /projects/:id/sync`, `POST /projects/:id/exports`).
- **Transcription** (`/api/transcriptions`, `/api/sheets`, `/api/files`) is
  the original audio-to-score pipeline: Step Functions in production, inline
  locally. Not surfaced in the UI; see `../../infra/README.md` and
  `scripts/pipeline-init.sh`.

## Changing the database

Add a dated file in `src/server/db/sql/migrations/` (`CREATE TABLE app....`,
`ALTER TABLE ...`). It runs once on the next boot (locally) or deploy. Never
edit a file that has already been applied. Test it from scratch with
`docker compose down -v && docker compose up -d && npm run db:migrate`.

## Deploying

Push to `main`. `.github/workflows/deploy.yml` builds the Next.js standalone
image, pushes it to ECR and waits for App Runner; the worker job updates the
transcription Lambdas when they exist. One-time setup by the AWS account
owner: `scripts/deploy-init.sh` (creates ECR, roles, secrets and the App
Runner service; health check path `/api/health`). Database network notes and
known gaps are in `../../infra/README.md`.
