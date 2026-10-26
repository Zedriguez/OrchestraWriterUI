// /api/files: the signed-in user's standalone recordings (input to /api/transcriptions).
// Upload is two requests: POST /upload-url (get a presigned S3 PUT), then
// POST / with the key once the browser has PUT the bytes to S3 directly.
// Project recordings use /api/uploads + /api/projects/:id/audio instead.
import { Hono } from "hono";
import { MAX_AUDIO_SECONDS } from "../storage/limits";
import { ValidationError } from "../errors";
import * as files from "../services/files";
import { requireUser, type AuthEnv } from "./session";
import { idParam, jsonBody, num, str } from "./validate";

export const filesRoutes = new Hono<AuthEnv>();

filesRoutes.use("*", requireUser);

filesRoutes.get("/", async (c) => {
  return c.json({ files: await files.listFiles(c.get("userId")) });
});

filesRoutes.post("/upload-url", async (c) => {
  const body = await jsonBody(c);
  const filename = str(body.filename, "filename", { min: 1, max: 255 });
  const contentType = str(body.contentType, "contentType", { min: 1, max: 200 });
  if (!/^(audio\/|video\/|application\/octet-stream$)/.test(contentType)) {
    throw new ValidationError("Only audio uploads are accepted");
  }
  return c.json(await files.createUploadUrl(c.get("userId"), filename, contentType));
});

filesRoutes.post("/", async (c) => {
  const body = await jsonBody(c);
  const name = str(body.name, "name", { min: 1, max: 100 });
  const key = str(body.key, "key", { min: 1, max: 1024, trim: false });
  const audioLengthSeconds = num(body.audioLengthSeconds, "audioLengthSeconds", { min: 1, max: MAX_AUDIO_SECONDS });
  if (!Number.isInteger(audioLengthSeconds)) throw new ValidationError("audioLengthSeconds must be a positive integer");
  const file = await files.registerFile(c.get("userId"), { name, key, audioLengthSeconds });
  return c.json({ file }, 201);
});

filesRoutes.get("/:id/download-url", async (c) => {
  const url = await files.getDownloadUrl(c.get("userId"), idParam(c, "id", "File"));
  return url ? c.json({ url }) : c.json({ error: "File not found", code: "not_found" }, 404);
});

filesRoutes.delete("/:id", async (c) => {
  const deleted = await files.deleteFile(c.get("userId"), idParam(c, "id", "File"));
  return deleted ? c.body(null, 204) : c.json({ error: "File not found", code: "not_found" }, 404);
});
