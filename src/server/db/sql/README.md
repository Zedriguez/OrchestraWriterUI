# SQL layout

- `schema/`     The original CREATE TABLE files (`001_init.sql`, `002_auth.sql`). Frozen:
                they have been applied to live databases and run first on a fresh one.
- `migrations/` Every change since, including **new tables**. Name as `YYYYMMDD_NN_description.sql`.
- `seeds/`      Lookup data (instruments). Re-run on every boot, so write `ON CONFLICT DO NOTHING`.

Files are plain Postgres SQL. `server/db/migrate.ts` applies `schema/` then `migrations/`, in
filename order, each exactly once, each in its own transaction, and records them in
`public.schema_migrations`. It runs on every server boot (`src/instrumentation.ts`) and from
`npm run db:migrate`. Never edit a file that has been applied anywhere; add a new one.

## Why new tables go in a dated migration, not `schema/`

`schema/*.sql` runs **before** `migrations/*.sql`. On a fresh database the `app` and `auth`
schemas do not exist until `migrations/20261022_01_auth_app_schemas.sql` moves the original
tables into them. A new `schema/003_*.sql` that says `CREATE TABLE app.something ... REFERENCES
auth.users` would therefore fail on a fresh database (and an unqualified one would land in
`public`). So every new table is created in a dated migration, schema-qualified. Example:
`migrations/20261026_01_visualizer.sql` (profiles, projects, programs, program_projects, jobs,
exports, activity).

## Schemas

Since `migrations/20261022_01_auth_app_schemas.sql` the tables live in two schemas:

- `auth`: `users`, `sessions`, `accounts`, `verifications`. Owned by Better Auth; only the API touches them.
- `app`: everything else: transcription tables and the visualizer tables.

Every connection uses `search_path = app, auth, public`, so code may write plain `users` or `audio_files`.
Name the schema explicitly in new SQL (`CREATE TABLE app.something`, `FROM app.projects`) so there is no doubt where a table lands.

The pipeline workers log in as `orchestra_worker`, which has privileges on selected `app` tables and none on `auth`.
When you add an `app` table the workers need, add the matching `GRANT ... TO orchestra_worker` in the same file.
The visualizer tables are API-only and grant nothing.
