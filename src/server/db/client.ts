// Postgres connection pool.
// One pool per process, created on first use and kept on globalThis: Next.js dev
// re-evaluates modules on every edit, and instrumentation.ts and the route
// handler are separate bundles, so a module-level `new Pool()` would leak a pool
// per reload. Everything imports getPool() / query() from here.
import { readFileSync } from "node:fs";
import tls from "node:tls";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { Signer } from "@aws-sdk/rds-signer";
import { env } from "../config/env";
import { awsConfig } from "../config/aws";

function createPool(): Pool {
  // IAM authentication (Aurora). The Signer is the code equivalent of
  // `aws rds generate-db-auth-token`: it signs a short-lived (15 min) token
  // using the AWS credentials. It makes no network call and never talks to
  // the database itself. Skipped entirely when DB_PASSWORD is set (local Postgres).
  const signer = env.db.password
    ? undefined
    : new Signer({
        hostname: env.db.host,
        port: env.db.port,
        username: env.db.user,
        region: awsConfig.region,
      });

  // TLS. The server certificate is verified against Node's built-in public roots
  // (the Aurora cluster chains to Amazon Root CA 1, a public CA).
  // If DB_SSL_CA_PATH is set, that bundle is ADDED to the roots rather than
  // replacing them, so clusters issued by the RDS private CA also verify.
  // DB_SSL_VERIFY=false turns verification off (psql's sslmode=require); debugging only.
  // DB_SSL=false turns TLS off; only for a local Postgres.
  const ssl = env.db.ssl
    ? {
        rejectUnauthorized: env.db.sslVerify,
        ca: env.db.sslCaPath
          ? [...tls.rootCertificates, readFileSync(env.db.sslCaPath, "utf8")]
          : undefined,
      }
    : false;

  const pool = new Pool({
    host: env.db.host,
    port: env.db.port,
    database: env.db.name,
    user: env.db.user,
    // pg calls a function password every time it opens a NEW connection, so each
    // one gets a fresh IAM token. Connections already open are unaffected by expiry.
    password: env.db.password ?? (() => signer!.getAuthToken()),
    ssl,
    // app tables first, then auth (see sql/migrations/20261022_01_auth_app_schemas.sql).
    options: "-c search_path=app,auth,public",
    max: 10,
    idleTimeoutMillis: 30_000,
    // Aurora Serverless v2 is configured with min 0 ACU and pauses after 5 idle
    // minutes. Resuming takes ~15s, and the connection that triggers it must wait
    // that long or the first request after idle fails. Locally a refused
    // connection fails at once regardless of this value.
    connectionTimeoutMillis: 30_000,
  });

  pool.on("error", (err) => {
    console.error("Unexpected error on idle Postgres client", err);
  });
  return pool;
}

const globalForDb = globalThis as typeof globalThis & { __orchestraPool?: Pool };

/** The process-wide pool. Creating it does not connect; the first query does. */
export function getPool(): Pool {
  if (!globalForDb.__orchestraPool) globalForDb.__orchestraPool = createPool();
  return globalForDb.__orchestraPool;
}

const CONNECTION_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "57P03", // cannot_connect_now (server starting up)
]);
// Seen while Aurora resumes from auto-pause: the TCP connect succeeds, then the
// server drops it, or the handshake exceeds the timeout.
const CONNECTION_MESSAGE = /terminated|timeout|ECONNRESET|ECONNREFUSED|EPIPE|socket hang up/i;

/**
 * True when an error means "could not talk to Postgres", as opposed to "your SQL
 * is wrong". Node reports a refused localhost connection as an AggregateError
 * (IPv6 + IPv4 attempts) with an empty message, so codes are checked too.
 */
export function isConnectionError(err: unknown, depth = 0): boolean {
  if (!err || typeof err !== "object" || depth > 3) return false;
  const e = err as { code?: unknown; message?: unknown; errors?: unknown; cause?: unknown };
  if (typeof e.code === "string" && CONNECTION_CODES.has(e.code)) return true;
  if (typeof e.message === "string" && CONNECTION_MESSAGE.test(e.message)) return true;
  if (Array.isArray(e.errors) && e.errors.some((x) => isConnectionError(x, depth + 1))) return true;
  return isConnectionError(e.cause, depth + 1);
}

const RETRY_DELAY_MS = env.isProduction ? 5_000 : 500;

/**
 * Run a parameterised query and return the rows. Use $1, $2... for params.
 * Retries twice if the connection itself failed, which covers the first query
 * after the cluster has auto-paused. Queries with side effects are safe to
 * retry here because a connection failure means the statement never ran.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      const result = await getPool().query<T>(text, params);
      return result.rows;
    } catch (err) {
      if (!isConnectionError(err) || attempt >= 3) throw err;
      console.warn(`database connection failed (${describe(err)}); retrying (${attempt}/2)`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

/** Run `fn` inside BEGIN/COMMIT on one connection; ROLLBACK if it throws. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Drain the pool. Call on shutdown and at the end of one-off scripts and test files. */
export async function closePool(): Promise<void> {
  const pool = globalForDb.__orchestraPool;
  globalForDb.__orchestraPool = undefined;
  if (pool) await pool.end();
}

function describe(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : String(err);
}
