// /api/me: the signed-in user's profile, preferences, storage usage, account deletion.
import { Hono } from "hono";
import type { Preferences, ProfileUpdate } from "@/shared/api";
import { auth } from "../auth";
import { ValidationError } from "../errors";
import * as profiles from "../services/profiles";
import { requireUser, type AuthEnv } from "./session";
import { bool, isPlainObject, jsonBody, nullableStr, oneOf, onlyKeys, optOneOf, optStr } from "./validate";

export const meRoutes = new Hono<AuthEnv>();

meRoutes.use("*", requireUser);

meRoutes.get("/", async (c) => {
  return c.json({ profile: await profiles.getOrCreateProfile(c.get("userId")) });
});

const PREFERENCE_KEYS = [
  "theme",
  "reducedMotion",
  "showLabelsDefault",
  "exportResolution",
  "exportFrameRate",
  "emailOnExport",
] as const satisfies ReadonlyArray<keyof Preferences>;

function parsePreferences(value: unknown): Partial<Preferences> {
  if (!isPlainObject(value)) throw new ValidationError("preferences must be an object");
  onlyKeys(value, PREFERENCE_KEYS, "preferences");
  const out: Partial<Preferences> = {};
  if (value.theme !== undefined) out.theme = oneOf(value.theme, "preferences.theme", ["program", "stage"] as const);
  if (value.reducedMotion !== undefined) out.reducedMotion = bool(value.reducedMotion, "preferences.reducedMotion");
  if (value.showLabelsDefault !== undefined) out.showLabelsDefault = bool(value.showLabelsDefault, "preferences.showLabelsDefault");
  if (value.exportResolution !== undefined) {
    out.exportResolution = oneOf(value.exportResolution, "preferences.exportResolution", ["720p", "1080p", "4k"] as const);
  }
  if (value.exportFrameRate !== undefined) {
    out.exportFrameRate = oneOf(value.exportFrameRate, "preferences.exportFrameRate", [30, 60] as const);
  }
  if (value.emailOnExport !== undefined) out.emailOnExport = bool(value.emailOnExport, "preferences.emailOnExport");
  return out;
}

meRoutes.put("/", async (c) => {
  const body = await jsonBody(c);
  const handle = optStr(body.handle, "handle", { max: 30 })?.toLowerCase();
  if (handle !== undefined && !/^[a-z0-9][a-z0-9-]{2,29}$/.test(handle)) {
    throw new ValidationError("handle must be 3-30 characters: letters, numbers and dashes, starting with a letter or number");
  }
  const website = nullableStr(body.website, "website", { max: 200 });
  if (website && !/^https?:\/\/[^\s]+$/i.test(website)) throw new ValidationError("website must start with http:// or https://");

  const update: ProfileUpdate = {
    name: optStr(body.name, "name", { min: 1, max: 100 }),
    handle,
    role: optOneOf(body.role, "role", profiles.ROLES),
    ensemble: optStr(body.ensemble, "ensemble", { max: 120 }),
    location: optStr(body.location, "location", { max: 120 }),
    bio: optStr(body.bio, "bio", { max: 1000 }),
    website,
    preferences: body.preferences === undefined ? undefined : parsePreferences(body.preferences),
  };
  return c.json({ profile: await profiles.updateProfile(c.get("userId"), update) });
});

meRoutes.delete("/", async (c) => {
  const userId = c.get("userId");
  // Sign out first: it deletes the session row and returns Set-Cookie headers
  // that expire the session cookie. Deleting the user then cascades the rest.
  let cleared: string[] = [];
  try {
    const out = await auth.api.signOut({ headers: c.req.raw.headers, returnHeaders: true });
    cleared = out.headers.getSetCookie();
  } catch (err) {
    console.warn("sign-out before account deletion failed; deleting anyway", err);
  }
  await profiles.deleteAccount(userId);
  for (const cookie of cleared) c.header("Set-Cookie", cookie, { append: true });
  return c.body(null, 204);
});

meRoutes.get("/usage", async (c) => {
  return c.json(await profiles.getUsage(c.get("userId")));
});
