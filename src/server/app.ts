// The Hono app behind every /api/* request. Next.js mounts it in
// src/app/api/[[...route]]/route.ts; tests drive it directly with app.request().
//
// Order: logging (dev) -> optional CORS -> body limit -> DB-free routes
// (health, config, status) -> database gate -> Better Auth -> resource routes.
// One error handler (routes/errors.ts) answers for all of them.
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { auth } from "./auth";
import { env } from "./config/env";
import { query } from "./db/client";
import { ensureDatabase } from "./db/readiness";
import { activityRoutes } from "./routes/activity";
import { errorBody, handleError, handleNotFound } from "./routes/errors";
import { exportsRoutes } from "./routes/exports";
import { filesRoutes } from "./routes/files";
import { jobsRoutes } from "./routes/jobs";
import { meRoutes } from "./routes/me";
import { programsRoutes } from "./routes/programs";
import { projectsRoutes } from "./routes/projects";
import { statusRoutes } from "./routes/status";
import { sheetsRoutes, transcriptionsRoutes } from "./routes/transcriptions";
import { uploadsRoutes } from "./routes/uploads";

/** JSON bodies only (files go straight to S3). Sync state for a long piece is the largest. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

export function createApp() {
  const app = new Hono().basePath("/api");

  // Request logging: Next.js already prints one line per request in dev.

  // A frontend on another origin needs CORS with credentials so the session
  // cookie travels. The Next.js app itself is same-origin and needs none of this.
  if (env.corsOrigins.length > 0) {
    app.use("*", cors({ origin: env.corsOrigins, credentials: true }));
  }

  // Defense in depth next to SameSite=Lax session cookies: form-style requests
  // (urlencoded, multipart, text/plain) must come from our own origin(s).
  // JSON requests from the app are unaffected; Better Auth runs its own check.
  app.use("*", csrf({ origin: [env.auth.url, ...env.corsOrigins] }));

  app.use(
    "*",
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json(errorBody("Request body is too large", "too_large"), 413),
    }),
  );

  // Liveness (App Runner polls this). DB-free so a DB blip does not restart the service.
  app.get("/health", (c) => c.json({ ok: true }));
  // Readiness: proves the pool can reach Postgres.
  app.get("/health/db", async (c) => {
    try {
      await query("SELECT 1");
      return c.json({ ok: true });
    } catch (err) {
      console.error("DB health check failed", err);
      return c.json({ ok: false }, 503);
    }
  });
  // What the frontend needs to know before anyone is signed in.
  app.get("/config", (c) => c.json({ googleEnabled: Boolean(env.auth.google.clientId && env.auth.google.clientSecret) }));
  // Self-checks; reports a database outage instead of failing on it.
  app.route("/status", statusRoutes);

  // Everything below needs Postgres: wait for boot migrations, 503 while unreachable.
  app.use("*", async (_c, next) => {
    await ensureDatabase();
    await next();
  });

  // Every Better Auth endpoint lives under /api/auth/*.
  app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));

  app.route("/me", meRoutes);
  app.route("/uploads", uploadsRoutes);
  app.route("/projects", projectsRoutes);
  app.route("/exports", exportsRoutes);
  app.route("/programs", programsRoutes);
  app.route("/activity", activityRoutes);
  app.route("/jobs", jobsRoutes);
  if (env.pipeline.enabled) {
    app.route("/files", filesRoutes);
    app.route("/transcriptions", transcriptionsRoutes);
    app.route("/sheets", sheetsRoutes);
  }

  app.notFound(handleNotFound);
  app.onError(handleError);
  return app;
}

export const app = createApp();
export type App = typeof app;
