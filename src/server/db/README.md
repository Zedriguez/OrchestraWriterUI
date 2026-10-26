# server/db/

- `client.ts`: `getPool()` returns one `pg` pool per process, created lazily and kept on `globalThis` (Next.js dev reloads modules, and instrumentation and route handlers are separate bundles). `query()` retries twice when the connection itself failed (Aurora resuming); `withTransaction()`; `isConnectionError()`. On Aurora the pool has no password: every new connection gets a 15-minute IAM token. Locally `DB_PASSWORD` is set and TLS is off (the defaults in `config/env.ts`).
- `migrate.ts`: `runMigrations()` applies `sql/schema/*.sql` then `sql/migrations/*.sql` in filename order, each once, each in its own transaction, under an advisory lock. Applied names are in `public.schema_migrations`.
- `seed.ts`: `runSeeds()` runs `sql/seeds/*.sql` every time; write seeds with `ON CONFLICT DO NOTHING`.
- `readiness.ts`: `prepareDatabase()` (migrate + seed once; logs `Database unreachable at host:port. Run \`docker compose up -d\`.` instead of crashing) and `ensureDatabase()` (API middleware; 503 while unreachable, retried every 5 s).
- `sql-root.ts`: finds the SQL folder next to this module, or under `<cwd>/src/server/db/sql` in the standalone image.
- `cli.ts`: `npm run db:migrate | db:seed | db:ping`. Loads `.env.local` / `.env` through `load-env.ts`.
- `ping.ts`: the connection check behind `db:ping`.

The server runs migrations and seeds on boot from `src/instrumentation.ts`, so `npm run dev` after `docker compose up -d` needs nothing else. Rules for SQL files are in `sql/README.md`.
