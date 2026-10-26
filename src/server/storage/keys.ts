// S3 object keys, presigned URLs, and object housekeeping.
// The server never proxies bytes (except the parse-score job). The browser PUTs
// straight to S3 with a URL we sign and GETs the same way. Keys are recorded in
// the DB, and every key starts with users/<userId>/, so the prefix is the
// ownership check.
//
// Layout:
//   users/<uid>/projects/<pid>/score/<uuid>-<name>      uploaded MusicXML
//   users/<uid>/projects/<pid>/audio/<uuid>-<name>      uploaded recording
//   users/<uid>/projects/<pid>/exports/<uuid>-<name>    MP4 / .ovproj exports
//   users/<uid>/projects/<pid>/info-map-<jobId>.json    written by the parse-score job
//   users/<uid>/imports/<uuid>-<name>                   .ovproj files being opened
//   users/<uid>/<uuid>-<name>                           /api/files recordings (transcription)
//   users/<uid>/jobs/<jobId>/...                        transcription pipeline output
import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env";
import { StorageNotConfiguredError } from "../errors";
import { s3, s3Presign } from "./s3Client";

export { StorageNotConfiguredError };

/** Presigned URLs (PUT and GET) are valid this long. */
export const URL_TTL_SECONDS = 15 * 60;

export type ProjectFolder = "score" | "audio" | "exports";

export function bucket(): string {
  if (!env.s3.audioBucket) throw new StorageNotConfiguredError();
  return env.s3.audioBucket;
}

/** Lowercase, [a-z0-9._-] only, at most 80 characters. */
export function safeFilename(filename: string, fallback = "file"): string {
  return (
    filename
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^[-.]+|-+$/g, "")
      .slice(0, 80) || fallback
  );
}

export function userPrefix(userId: number): string {
  return `users/${userId}/`;
}

export function projectPrefix(userId: number, projectId: number): string {
  return `users/${userId}/projects/${projectId}/`;
}

/** A fresh key for an upload into one of a project's folders. */
export function newProjectObjectKey(userId: number, projectId: number, folder: ProjectFolder, filename: string): string {
  return `${projectPrefix(userId, projectId)}${folder}/${randomUUID()}-${safeFilename(filename, folder)}`;
}

/** A fresh key for a project file being opened (not tied to a project yet). */
export function newImportKey(userId: number, filename: string): string {
  return `${userPrefix(userId)}imports/${randomUUID()}-${safeFilename(filename, "project")}`;
}

/** Key for /api/files recordings: users/<userId>/<uuid>-<safe-filename>. */
export function newAudioKey(userId: number, filename: string): string {
  return `${userPrefix(userId)}${randomUUID()}-${safeFilename(filename, "audio")}`;
}

/** Where the parse-score job writes the information map. One per job, so a superseded job never overwrites a newer one. */
export function infoMapKey(userId: number, projectId: number, jobId: number): string {
  return `${projectPrefix(userId, projectId)}info-map-${jobId}.json`;
}

export function keyBelongsTo(key: string, userId: number): boolean {
  return key.startsWith(userPrefix(userId)) && !key.includes("..");
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * True only for a key this server could have minted for that user, project and
 * folder. Stricter than a prefix check: no "..", no extra path segments.
 */
export function isProjectObjectKey(key: string, userId: number, projectId: number, folder: ProjectFolder): boolean {
  const re = new RegExp(`^users/${userId}/projects/${projectId}/${folder}/${UUID}-[a-z0-9._-]{1,80}$`);
  return re.test(key) && !key.includes("..");
}

/** URL the browser can PUT the file to. It must send the same Content-Type. */
export function presignUpload(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    s3Presign,
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn: URL_TTL_SECONDS },
  );
}

/** RFC 6266: an ASCII fallback plus the UTF-8 name, so any filename survives the header. */
function attachmentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const utf8 = encodeURIComponent(filename).replace(/['()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

/** URL the browser can GET (or stream in an <audio> element). `filename` makes it a download. */
export function presignDownload(key: string, options: { filename?: string } = {}): Promise<string> {
  const disposition = options.filename ? attachmentDisposition(options.filename) : undefined;
  return getSignedUrl(
    s3Presign,
    new GetObjectCommand({ Bucket: bucket(), Key: key, ResponseContentDisposition: disposition }),
    { expiresIn: URL_TTL_SECONDS },
  );
}

/** Size and type of an uploaded object, or null if it does not exist. */
export async function headObject(key: string): Promise<{ bytes: number; contentType: string | null } | null> {
  try {
    const res = await s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { bytes: Number(res.ContentLength ?? 0), contentType: res.ContentType ?? null };
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    const name = (err as { name?: string }).name;
    if (status === 404 || name === "NotFound" || name === "NoSuchKey") return null;
    throw err;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** Delete a list of keys, 1000 per request. */
export async function deleteObjects(keys: string[]): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }),
    );
    deleted += batch.length;
  }
  return deleted;
}

/** Delete every object under a prefix (ListObjectsV2, paginated). The prefix must end in "/". */
export async function deletePrefix(prefix: string): Promise<number> {
  if (!/^users\/\d+\/(projects\/\d+\/)?$/.test(prefix)) {
    throw new Error(`Refusing to delete unexpected prefix ${prefix}`);
  }
  let deleted = 0;
  let token: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }),
    );
    const keys = (page.Contents ?? []).map((o) => o.Key).filter((k): k is string => Boolean(k));
    if (keys.length > 0) deleted += await deleteObjects(keys);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}
