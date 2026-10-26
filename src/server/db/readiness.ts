// Database readiness: run migrations + seeds once per process, and gate API
// routes on the result.
//
// src/instrumentation.ts starts prepareDatabase() at boot without awaiting it,
// so the server (and the DB-free /api/health) comes up immediately. Routes that
// need Postgres go through ensureDatabase() (middleware in app.ts): it waits for
// the boot run, and if Postgres was unreachable it retries at most every few
// seconds, so `docker compose up -d` after `npm run dev` just works.
// State lives on globalThis because instrumentation and the route handler are
// separate bundles in Next.js, and dev reloads re-evaluate modules.
import { env } from "../config/env";
import { DatabaseUnreachableError } from "../errors";
import { isConnectionError } from "./client";
import { runMigrations, waitForDatabase } from "./migrate";
import { runSeeds } from "./seed";
import { recoverInterruptedJobs } from "./recovery";

type DbState = {
  status: "unknown" | "ready" | "unreachable" | "failed";
  lastAttempt: number;
  pending: Promise<void> | null;
};

const RETRY_AFTER_MS = 5_000;
const globalForDb = globalThis as typeof globalThis & { __orchestraDbState?: DbState };

function state(): DbState {
  return (globalForDb.__orchestraDbState ??= { status: "unknown", lastAttempt: 0, pending: null });
}

async function attempt(): Promise<void> {
  const s = state();
  s.lastAttempt = Date.now();
  try {
    // Production waits out an Aurora resume (~15s); locally a refused
    // connection is final, so one try and a clear message.
    if (env.isProduction) await waitForDatabase(8);
    const { applied } = await runMigrations({ log: (line) => console.log(`[db] ${line}`) });
    await runSeeds({ log: () => {} });
    const recovered = await recoverInterruptedJobs();
    if (recovered > 0) console.log(`[db] marked ${recovered} job(s) interrupted by a restart as failed`);
    s.status = "ready";
    console.log(
      applied.length === 0
        ? "[db] schema up to date"
        : `[db] applied ${applied.length} migration file(s)`,
    );
  } catch (err) {
    if (isConnectionError(err)) {
      s.status = "unreachable";
      console.error(`Database unreachable at ${env.db.host}:${env.db.port}. Run \`docker compose up -d\`.`);
    } else {
      // A broken migration is a bug to fix, not something to retry per request.
      s.status = "failed";
      console.error(`[db] migration failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/** Run migrations and seeds once. Never throws; logs one line on failure. */
export function prepareDatabase(): Promise<void> {
  const s = state();
  if (s.status === "ready") return Promise.resolve();
  if (!s.pending) {
    s.pending = attempt().finally(() => {
      s.pending = null;
    });
  }
  return s.pending;
}

/**
 * Await before touching Postgres. Throws DatabaseUnreachableError (503) while
 * the database cannot be reached. A failed migration is logged at boot and
 * not retried; requests then proceed and fail on their own terms.
 */
export async function ensureDatabase(): Promise<void> {
  const s = state();
  if (s.status === "ready" || s.status === "failed") return;
  if (s.pending) {
    await s.pending;
  } else if (s.status === "unknown" || Date.now() - s.lastAttempt >= RETRY_AFTER_MS) {
    await prepareDatabase();
  }
  if (state().status === "unreachable") throw new DatabaseUnreachableError();
}

/** For the health endpoint and tests. */
export function databaseStatus(): DbState["status"] {
  return state().status;
}
