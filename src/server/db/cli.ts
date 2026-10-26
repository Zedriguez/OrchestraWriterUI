// Database CLI: `tsx src/server/db/cli.ts migrate|seed|ping`
// (npm run db:migrate / db:seed / db:ping). The server does the same on boot
// through src/instrumentation.ts; these exist for CI and for running by hand.
import "./load-env";
import { env } from "../config/env";
import { closePool, isConnectionError } from "./client";
import { runMigrations, waitForDatabase } from "./migrate";
import { ping } from "./ping";
import { runSeeds } from "./seed";

const command = process.argv[2];

async function main(): Promise<void> {
  switch (command) {
    case "migrate": {
      await waitForDatabase(env.isProduction ? 8 : 3, env.isProduction ? 10_000 : 2_000);
      const { applied } = await runMigrations();
      console.log(applied.length === 0 ? "Schema already up to date." : `Applied ${applied.length} file(s).`);
      return;
    }
    case "seed": {
      const { ran } = await runSeeds();
      console.log(ran.length === 0 ? "No seed files." : `Ran ${ran.length} seed file(s).`);
      return;
    }
    case "ping":
      await ping();
      return;
    default:
      console.error("usage: tsx src/server/db/cli.ts migrate|seed|ping");
      process.exitCode = 2;
  }
}

// No top-level await: tsx runs this file as CommonJS (package.json has no "type").
main()
  .catch((err: unknown) => {
    if (isConnectionError(err)) {
      console.error(`Database unreachable at ${env.db.host}:${env.db.port}. Run \`docker compose up -d\`.`);
    } else {
      console.error(err instanceof Error ? err.message : err);
    }
    process.exitCode = 1;
  })
  .finally(() => closePool());
