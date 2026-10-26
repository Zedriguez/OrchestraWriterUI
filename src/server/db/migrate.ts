// Schema runner. Applies sql/schema/*.sql, then sql/migrations/*.sql, in
// filename order, each exactly once. Applied filenames are recorded in
// public.schema_migrations, so it is safe to run on every boot.
// Called from src/instrumentation.ts (via db/readiness.ts) and `npm run db:migrate`.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getPool } from "./client";
import { sqlRoot } from "./sql-root";

const folders = ["schema", "migrations"] as const;

async function listSqlFiles(root: string, folder: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(path.join(root, folder));
  } catch {
    return [];
  }
  return names
    .filter((n) => n.endsWith(".sql"))
    .sort()
    .map((n) => `${folder}/${n}`);
}

/**
 * Aurora Serverless v2 with min capacity 0 auto-pauses when idle. The first
 * connection wakes it and can fail or hang for ~15s, so retry before giving up.
 */
export async function waitForDatabase(attempts: number, delayMs = 10_000): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await getPool().query("SELECT 1");
      return;
    } catch (err) {
      if (i >= attempts) throw err;
      console.log(`database not ready (${(err as Error).message || (err as { code?: string }).code}); retry ${i}/${attempts - 1} in ${delayMs / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export type MigrationResult = { applied: string[] };

/**
 * Apply every SQL file not yet recorded. One transaction per file: either every
 * statement in it lands, or none do. Throws on the first failing file.
 */
export async function runMigrations(options: { log?: (line: string) => void } = {}): Promise<MigrationResult> {
  const log = options.log ?? console.log;
  const pool = getPool();
  const root = sqlRoot();

  // Always schema-qualified: the default search_path starts with app since the
  // schema split, and an unqualified name would silently create app.schema_migrations.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename   TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Serialize concurrent runners (two dev servers, a test run next to `next dev`):
  // the second waits for the first, then finds nothing left to apply.
  const lock = await pool.connect();
  const applied: string[] = [];
  try {
    await lock.query("SELECT pg_advisory_lock(hashtext('orchestra.migrations'))");
    const done = new Set(
      (await lock.query<{ filename: string }>("SELECT filename FROM public.schema_migrations")).rows.map(
        (r) => r.filename,
      ),
    );
    const files = (await Promise.all(folders.map((f) => listSqlFiles(root, f)))).flat();
    if (files.length === 0) throw new Error(`No SQL files found under ${root}`);

    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(path.join(root, file), "utf8");
      try {
        await lock.query("BEGIN");
        await lock.query(sql);
        await lock.query("INSERT INTO public.schema_migrations (filename) VALUES ($1)", [file]);
        await lock.query("COMMIT");
        log(`applied  ${file}`);
        applied.push(file);
      } catch (err) {
        await lock.query("ROLLBACK").catch(() => {});
        throw new Error(`${file}: ${(err as Error).message}`);
      }
    }
  } finally {
    await lock.query("SELECT pg_advisory_unlock(hashtext('orchestra.migrations'))").catch(() => {});
    lock.release();
  }
  return { applied };
}
