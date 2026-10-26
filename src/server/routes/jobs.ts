// GET /api/jobs/:id: a server-side visualizer job (parse-score), polled until
// status is succeeded or failed. Transcription jobs are under /api/transcriptions.
import { Hono } from "hono";
import { getJob } from "../services/jobs";
import { requireUser, type AuthEnv } from "./session";
import { idParam } from "./validate";

export const jobsRoutes = new Hono<AuthEnv>();

jobsRoutes.use("*", requireUser);

jobsRoutes.get("/:id", async (c) => {
  return c.json({ job: await getJob(c.get("userId"), idParam(c, "id", "Job")) });
});
