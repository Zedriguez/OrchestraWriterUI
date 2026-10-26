// /api/exports/:id/download-url: presigned download of a past export (15 min).
// Listing and registering exports live under /api/projects/:id/exports.
import { Hono } from "hono";
import * as exportsService from "../services/exports";
import { requireUser, type AuthEnv } from "./session";
import { idParam } from "./validate";

export const exportsRoutes = new Hono<AuthEnv>();

exportsRoutes.use("*", requireUser);

exportsRoutes.get("/:id/download-url", async (c) => {
  const url = await exportsService.getExportDownloadUrl(c.get("userId"), idParam(c, "id", "Export"));
  return c.json({ url });
});
