# server/

The backend: a Hono app that runs **inside Next.js** (one process, one image).
`src/app/api/[[...route]]/route.ts` hands every `/api/*` request to `app.ts`;
`src/instrumentation.ts` runs migrations and seeds on boot. API reference:
`docs/backend/API.md`.

Request path (`app.ts`, `basePath("/api")`): dev logger, optional CORS
(`CORS_ORIGINS`), body limit, DB-free routes (`/health`, `/health/db`,
`/config`, `/status`), the database gate (`db/readiness.ts`), Better Auth at
`/auth/*`, then the resource routes. One error handler (`routes/errors.ts`).

| Folder | What lives there | Rule |
|--------|------------------|------|
| `config/` | `env.ts` reads all environment variables (local docker-compose defaults outside production); `aws.ts` shared SDK settings | nothing else reads `process.env` |
| `auth.ts` | the Better Auth instance: providers, table/column mapping, id strategy | the only file that knows auth internals |
| `errors.ts` | typed errors (`NotFoundError`, `ForbiddenKeyError`, ...) | services throw these; `routes/errors.ts` maps them |
| `db/` | the lazy global `pg` pool, migrate/seed runners, readiness gate, CLI, SQL files | see `db/README.md` |
| `storage/` | S3 clients, key layout, presigned-URL helpers | no HTTP, no SQL |
| `routes/` | HTTP handlers, one file per resource | validate input, call a service, shape the response; never touch db/ or storage/ |
| `services/` | business logic and ownership checks | call db/ and storage/; know nothing about HTTP |
| `types/` | row types mirroring the SQL tables | snake_case, as Postgres returns them |
| `pipeline/` | the transcription pipeline (Lambda / inline) | kept from the backend repo |

Imports: `@/shared/*` (wire types, score parser) and `@/lib/visualizer/seating`
(pure seating plan) only; nothing from components, stores or the browser API client.

Run: `docker compose up -d && npm run dev`. Test: `npm run test:api`.
