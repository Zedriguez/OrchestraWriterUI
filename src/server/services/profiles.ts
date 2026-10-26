// Profile (app.profiles + auth.users), storage usage, and account deletion.
import { DEFAULT_PREFERENCES, type Preferences, type ProfileDto, type UsageDto } from "@/shared/api";
import type { Director } from "@/shared/domain";
import { query, withTransaction } from "../db/client";
import { ConflictError, NotFoundError } from "../errors";
import { deletePrefix, userPrefix } from "../storage/keys";
import type { ProfileRow } from "../types/db";

export const ROLES: ReadonlyArray<Director["role"]> = ["Music director", "Educator", "Conductor", "Listener", "Student"];

type ProfileJoinRow = ProfileRow & {
  id: number;
  name: string;
  email: string;
  image: string | null;
  joined_at: Date;
};

export type ProfileChanges = {
  name?: string;
  handle?: string;
  role?: Director["role"];
  ensemble?: string;
  location?: string;
  bio?: string;
  website?: string | null;
  preferences?: Partial<Preferences>;
};

/** Stored JSON may predate a preference or hold a stale value: keep only valid known keys. */
export function mergePreferences(stored: unknown): Preferences {
  const out: Preferences = { ...DEFAULT_PREFERENCES };
  if (!stored || typeof stored !== "object") return out;
  const s = stored as Record<string, unknown>;
  if (s.theme === "program" || s.theme === "stage") out.theme = s.theme;
  if (typeof s.reducedMotion === "boolean") out.reducedMotion = s.reducedMotion;
  if (typeof s.showLabelsDefault === "boolean") out.showLabelsDefault = s.showLabelsDefault;
  if (s.exportResolution === "720p" || s.exportResolution === "1080p" || s.exportResolution === "4k") {
    out.exportResolution = s.exportResolution;
  }
  if (s.exportFrameRate === 30 || s.exportFrameRate === 60) out.exportFrameRate = s.exportFrameRate;
  if (typeof s.emailOnExport === "boolean") out.emailOnExport = s.emailOnExport;
  return out;
}

export function initialsFor(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function toDto(row: ProfileJoinRow): ProfileDto {
  const dto: ProfileDto = {
    id: String(row.id),
    name: row.name,
    handle: row.handle,
    email: row.email,
    role: (ROLES as string[]).includes(row.role) ? (row.role as Director["role"]) : "Music director",
    ensemble: row.ensemble,
    location: row.location,
    bio: row.bio,
    initials: initialsFor(row.name, row.email),
    joinedAt: row.joined_at.toISOString(),
    image: row.image,
    preferences: mergePreferences(row.preferences),
  };
  if (row.website) dto.website = row.website;
  return dto;
}

const SELECT_PROFILE = `
  SELECT u.id, u.name, u.email, u.image, u.created_at AS joined_at,
         p.user_id, p.handle, p.role, p.ensemble, p.location, p.bio, p.website, p.preferences,
         p.created_at, p.updated_at
    FROM auth.users u
    JOIN app.profiles p ON p.user_id = u.id
   WHERE u.id = $1`;

/** "Ada.Lovelace+test@x.org" -> "ada-lovelace-test". Always 3-24 chars of [a-z0-9-]. */
export function handleBase(email: string): string {
  const local = email.split("@")[0] ?? "";
  let base = local.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24).replace(/-+$/, "");
  if (base.length < 3) base = `user${base ? `-${base}` : ""}`.slice(0, 24);
  return base;
}

/** The profile, creating the row on first call with a unique handle derived from the email. */
export async function getOrCreateProfile(userId: number): Promise<ProfileDto> {
  const [existing] = await query<ProfileJoinRow>(SELECT_PROFILE, [userId]);
  if (existing) return toDto(existing);

  const [user] = await query<{ email: string }>("SELECT email FROM auth.users WHERE id = $1", [userId]);
  if (!user) throw new NotFoundError("User");

  const base = handleBase(user.email);
  for (let i = 0; i < 25; i++) {
    const suffix = i === 0 ? "" : i < 20 ? `-${i + 1}` : `-${Math.random().toString(36).slice(2, 7)}`;
    const handle = `${base.slice(0, 30 - suffix.length)}${suffix}`;
    // DO NOTHING covers both races: a concurrent first GET for this user (user_id
    // conflict, row exists afterwards) and a handle taken by someone else (no row: try the next one).
    await query(
      `INSERT INTO app.profiles (user_id, handle) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, handle],
    );
    const [row] = await query<ProfileJoinRow>(SELECT_PROFILE, [userId]);
    if (row) return toDto(row);
  }
  throw new ConflictError("Could not choose a unique handle");
}

export async function updateProfile(userId: number, changes: ProfileChanges): Promise<ProfileDto> {
  await getOrCreateProfile(userId);
  await withTransaction(async (db) => {
    if (changes.name !== undefined) {
      await db.query("UPDATE auth.users SET name = $2, updated_at = now() WHERE id = $1", [userId, changes.name]);
    }
    const sets: string[] = [];
    const params: unknown[] = [userId];
    const set = (column: string, value: unknown, cast = "") => {
      params.push(value);
      sets.push(`${column} = $${params.length}${cast}`);
    };
    if (changes.handle !== undefined) set("handle", changes.handle);
    if (changes.role !== undefined) set("role", changes.role);
    if (changes.ensemble !== undefined) set("ensemble", changes.ensemble);
    if (changes.location !== undefined) set("location", changes.location);
    if (changes.bio !== undefined) set("bio", changes.bio);
    if (changes.website !== undefined) set("website", changes.website);
    if (changes.preferences !== undefined) {
      params.push(JSON.stringify(changes.preferences));
      sets.push(`preferences = preferences || $${params.length}::jsonb`);
    }
    if (sets.length === 0) return;
    try {
      await db.query(`UPDATE app.profiles SET ${sets.join(", ")}, updated_at = now() WHERE user_id = $1`, params);
    } catch (err) {
      if ((err as { code?: string }).code === "23505") throw new ConflictError("That handle is taken");
      throw err;
    }
  });
  return getOrCreateProfile(userId);
}

/** Preferences only (used to seed display defaults). Defaults if there is no profile yet. */
export async function getPreferences(userId: number): Promise<Preferences> {
  const [row] = await query<{ preferences: unknown }>("SELECT preferences FROM app.profiles WHERE user_id = $1", [userId]);
  return mergePreferences(row?.preferences);
}

export async function getUsage(userId: number): Promise<UsageDto> {
  const [row] = await query<{
    score_count: number;
    score_bytes: string;
    audio_count: number;
    audio_bytes: string;
    export_count: number;
    export_bytes: string;
  }>(
    `SELECT
       (SELECT count(*)::int FROM app.projects WHERE user_id = $1 AND score_key IS NOT NULL)  AS score_count,
       (SELECT COALESCE(sum(score_bytes), 0) FROM app.projects WHERE user_id = $1)            AS score_bytes,
       (SELECT count(*)::int FROM app.audio_files WHERE user_id = $1)                          AS audio_count,
       (SELECT COALESCE(sum(bytes), 0) FROM app.audio_files WHERE user_id = $1)                AS audio_bytes,
       (SELECT count(*)::int FROM app.exports WHERE user_id = $1)                              AS export_count,
       (SELECT COALESCE(sum(bytes), 0) FROM app.exports WHERE user_id = $1)                    AS export_bytes`,
    [userId],
  );
  const scores = { count: row!.score_count, bytes: Number(row!.score_bytes) };
  const recordings = { count: row!.audio_count, bytes: Number(row!.audio_bytes) };
  const exports = { count: row!.export_count, bytes: Number(row!.export_bytes) };
  return { scores, recordings, exports, totalBytes: scores.bytes + recordings.bytes + exports.bytes };
}

/**
 * Delete the account: the auth.users row (cascades to sessions, profile,
 * projects, programs, jobs, exports, activity, recordings), then every S3
 * object under users/<id>/. Storage cleanup is best effort; the rows are the
 * source of truth and are gone either way.
 */
export async function deleteAccount(userId: number): Promise<void> {
  const deleted = await query<{ id: number }>("DELETE FROM auth.users WHERE id = $1 RETURNING id", [userId]);
  if (deleted.length === 0) throw new NotFoundError("User");
  try {
    await deletePrefix(userPrefix(userId));
  } catch (err) {
    console.error(`account ${userId} deleted; failed to remove its S3 objects`, err);
  }
}
