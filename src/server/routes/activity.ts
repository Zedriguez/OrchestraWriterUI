// GET /api/activity: the signed-in user's last 25 activity lines, newest first.
import { Hono } from "hono";
import { listActivity } from "../services/activity";
import { requireUser, type AuthEnv } from "./session";

export const activityRoutes = new Hono<AuthEnv>();

activityRoutes.use("*", requireUser);

activityRoutes.get("/", async (c) => {
  return c.json({ activity: await listActivity(c.get("userId")) });
});
