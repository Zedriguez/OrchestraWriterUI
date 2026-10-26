// Runs once when a Next.js server instance starts (next dev, next start, the
// standalone server.js). Applies database migrations and seeds in the
// background; API routes that need Postgres wait for that run (see
// src/server/db/readiness.ts), while /api/health answers at once.
// If Postgres is unreachable this logs one line and the server keeps running;
// DB routes answer 503 until it comes up, then migrate on the next request.
export async function register() {
  // The DB code is Node-only. The build phase imports modules but must not migrate.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { prepareDatabase } = await import("./server/db/readiness");
    void prepareDatabase();
  }
}
