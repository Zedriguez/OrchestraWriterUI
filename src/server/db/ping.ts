// Connection smoke test behind `npm run db:ping`.
// Proves credentials (or the IAM token), TLS and network access before writing anything.
import { env } from "../config/env";
import { query } from "./client";

type PingRow = { now: Date; version: string; db_user: string; db_name: string };

export async function ping(log: (line: string) => void = console.log): Promise<void> {
  const [row] = await query<PingRow>(
    "select now() as now, version() as version, current_user as db_user, current_database() as db_name",
  );
  log(`Connected to ${env.db.host}:${env.db.port}`);
  log(`  as user:     ${row!.db_user}`);
  log(`  database:    ${row!.db_name}`);
  log(`  server time: ${row!.now.toISOString()}`);
  log(`  version:     ${row!.version}`);
}
