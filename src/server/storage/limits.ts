import type { UploadKind } from "@/shared/api";

/** Hard caps per upload kind, enforced on the presigned PUT (Content-Length) and again when the object is read. */
export const MAX_UPLOAD_BYTES: Record<UploadKind, number> = {
  score: 50 * 1024 * 1024,
  audio: 500 * 1024 * 1024,
  export: 2 * 1024 * 1024 * 1024,
  project: 2.5 * 1024 * 1024 * 1024,
};

/** Recordings longer than this are refused at registration (memory for decode/export in the browser). */
export const MAX_AUDIO_SECONDS = 2 * 60 * 60;
