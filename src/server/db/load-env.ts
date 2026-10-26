// Loads .env.local then .env for the CLI scripts (tsx src/server/db/cli.ts ...).
// Next.js loads these files itself, so nothing under the Next process imports this.
// Import it first: ES modules evaluate imports in order, and config/env.ts reads
// process.env when it is evaluated.
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
