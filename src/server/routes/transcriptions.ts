// /api/transcriptions: transcription jobs for the signed-in user (the backend's
// audio-to-score pipeline; not surfaced in the visualizer UI).
// /api/sheets/:id/download-url: presigned link to a finished MusicXML part.
import { Hono } from "hono";
import * as transcriptions from "../services/transcriptions";
import { requireUser, type AuthEnv } from "./session";
import { idParam, idValue, jsonBody } from "./validate";

export const transcriptionsRoutes = new Hono<AuthEnv>();

transcriptionsRoutes.use("*", requireUser);

transcriptionsRoutes.get("/", async (c) => c.json({ jobs: await transcriptions.listTranscriptions(c.get("userId")) }));

transcriptionsRoutes.post("/", async (c) => {
  const body = await jsonBody(c);
  const audioFileId = idValue(body.audioFileId, "audioFileId");
  return c.json({ job: await transcriptions.createTranscription(c.get("userId"), audioFileId) }, 201);
});

transcriptionsRoutes.get("/:id", async (c) => {
  return c.json({ job: await transcriptions.getTranscription(c.get("userId"), idParam(c, "id", "Transcription")) });
});

export const sheetsRoutes = new Hono<AuthEnv>();

sheetsRoutes.use("*", requireUser);

sheetsRoutes.get("/:id/download-url", async (c) => {
  return c.json({ url: await transcriptions.getSheetDownloadUrl(c.get("userId"), idParam(c, "id", "Sheet")) });
});
