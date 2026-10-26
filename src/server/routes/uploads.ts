// POST /api/uploads: a presigned S3 PUT for a score, recording, export or project file.
// The key lands under users/<uid>/projects/<pid>/... (or users/<uid>/imports/ for
// a project file); the register routes later accept only keys of that shape.
import { Hono } from "hono";
import type { UploadKind } from "@/shared/api";
import * as uploads from "../services/uploads";
import { requireUser, type AuthEnv } from "./session";
import { idValue, jsonBody, oneOf, str } from "./validate";

export const uploadsRoutes = new Hono<AuthEnv>();

uploadsRoutes.use("*", requireUser);

const KINDS: readonly UploadKind[] = ["score", "audio", "export", "project"];

uploadsRoutes.post("/", async (c) => {
  const body = await jsonBody(c);
  const kind = oneOf(body.kind, "kind", KINDS);
  const target = await uploads.createUpload(c.get("userId"), {
    kind,
    filename: str(body.filename, "filename", { min: 1, max: 255 }),
    contentType: str(body.contentType, "contentType", { min: 1, max: 200 }),
    projectId: body.projectId === undefined || body.projectId === null ? null : idValue(body.projectId, "projectId"),
  });
  return c.json(target);
});
