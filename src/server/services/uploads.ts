// Presigned upload targets. Step 1 of every upload: mint a key under the
// caller's prefix, sign a PUT for it. The browser PUTs the bytes straight to S3,
// then calls the matching register route with the key.
import type { UploadKind, UploadTarget } from "@/shared/api";
import { TooLargeError, ValidationError } from "../errors";
import { MAX_UPLOAD_BYTES } from "../storage/limits";
import {
  newImportKey,
  newProjectObjectKey,
  presignUpload,
  URL_TTL_SECONDS,
  type ProjectFolder,
} from "../storage/keys";
import { assertProjectOwned } from "./projects";

const SCORE_TYPES = new Set([
  "application/vnd.recordare.musicxml+xml",
  "application/vnd.recordare.musicxml",
  "application/xml",
  "text/xml",
  "application/octet-stream",
]);
const EXPORT_TYPES = new Set(["video/mp4", "application/zip", "application/octet-stream"]);
const PROJECT_TYPES = new Set(["application/zip", "application/octet-stream"]);

/** Is this Content-Type accepted for this kind? Parameters (";charset=...") are ignored. */
export function contentTypeAllowed(kind: UploadKind, contentType: string): boolean {
  const base = contentType.split(";")[0]!.trim().toLowerCase();
  switch (kind) {
    case "score":
      return SCORE_TYPES.has(base);
    case "audio":
      return /^audio\/[a-z0-9.+-]+$/.test(base);
    case "export":
      return EXPORT_TYPES.has(base);
    case "project":
      return PROJECT_TYPES.has(base);
  }
}

const FOLDER: Record<Exclude<UploadKind, "project">, ProjectFolder> = {
  score: "score",
  audio: "audio",
  export: "exports",
};

export async function createUpload(
  userId: number,
  input: { kind: UploadKind; filename: string; contentType: string; projectId: number | null; bytes?: number | null },
): Promise<UploadTarget> {
  if (!contentTypeAllowed(input.kind, input.contentType)) {
    throw new ValidationError(`Content type ${input.contentType} is not accepted for a ${input.kind} upload`);
  }
  const limit = MAX_UPLOAD_BYTES[input.kind];
  if (input.bytes && input.bytes > limit) {
    throw new TooLargeError(`A ${input.kind} file may be at most ${Math.round(limit / 1e6)} MB`);
  }
  let key: string;
  if (input.kind === "project") {
    key = newImportKey(userId, input.filename);
  } else {
    if (input.projectId === null) throw new ValidationError(`projectId is required for a ${input.kind} upload`);
    await assertProjectOwned(userId, input.projectId);
    key = newProjectObjectKey(userId, input.projectId, FOLDER[input.kind], input.filename);
  }
  const uploadUrl = await presignUpload(key, input.contentType, input.bytes ?? undefined);
  return { key, uploadUrl, expiresInSeconds: URL_TTL_SECONDS };
}
