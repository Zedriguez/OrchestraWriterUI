// Seed runner. Executes sql/seeds/*.sql in filename order on every boot.
// Seeds are NOT tracked like schema files; write them to be re-runnable
// (INSERT ... ON CONFLICT DO NOTHING).
// Called from src/instrumentation.ts (via db/readiness.ts) and `npm run db:seed`.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getPool } from "./client";
import { sqlRoot } from "./sql-root";

export async function runSeeds(options: { log?: (line: string) => void } = {}): Promise<{ ran: string[] }> {
  const log = options.log ?? console.log;
  const seedsDir = path.join(sqlRoot(), "seeds");
  let names: string[] = [];
  try {
    names = (await readdir(seedsDir)).filter((n) => n.endsWith(".sql")).sort();
  } catch {
    // no seeds folder
  }
  for (const name of names) {
    const sql = await readFile(path.join(seedsDir, name), "utf8");
    await getPool().query(sql);
    log(`seeded   seeds/${name}`);
  }
  return { ran: names };
}
