# 0007. Better Auth for accounts; the Hono backend runs inside Next.js

Date: 2026-10-26
Status: accepted (supersedes the Clerk line in 0004)

## Context
The team's backend repo (OrchestraWriter) already has working accounts with
Better Auth (email + password, optional Google), a Postgres schema, S3 presigned
uploads, a local Docker stack and an App Runner deploy. The front end was
built against an adapter so any auth could slot in. Running two processes
(Next.js and Hono) means CORS, two deploys and two dev servers.

## Decision
- Accounts use Better Auth (MIT). Sessions are HttpOnly cookies on the site
  origin. Clerk is not used.
- The Hono app lives in `src/server/` and is mounted at
  `src/app/api/[[...route]]/route.ts` through `hono/vercel`. One process, one
  Docker image (Next.js standalone), one `npm run dev`.
- Migrations and seeds run from `src/instrumentation.ts` on boot; the SQL files
  stay the source of truth. Locally, `docker compose up -d` provides Postgres
  and S3Mock; `.env.example` lists every variable with a local default.
- The transcription pipeline from the backend repo is kept under
  `/api/transcriptions` (and its Lambda/Step Functions setup) but is not
  surfaced in the UI; the product spec does not include it.

## Consequences
- `src/lib/auth/session.ts` wraps `better-auth/react`; `src/proxy.ts` does an
  optimistic cookie check for the signed-in routes; every API route verifies
  the session server-side.
- Requirement 8 (manual project files, no account needed) still holds for
  opening and saving `.ovproj` files, but the library, programs and exports
  history need an account because they live in Postgres.
- Deploy stays App Runner; the image is the Next.js standalone build. The
  health check path moves to `/api/health`.
