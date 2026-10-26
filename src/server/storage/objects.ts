// Plain S3 object reads and writes. Used by the transcription pipeline and the
// parse-score job; API routes never move bytes themselves.
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { bucket } from "./keys";
import { s3 } from "./s3Client";

export class ObjectTooLargeError extends Error {
  constructor(key: string, bytes: number, maxBytes: number) {
    super(`The file is ${(bytes / 1e6).toFixed(1)} MB; the limit is ${Math.round(maxBytes / 1e6)} MB.`);
    this.name = "ObjectTooLargeError";
  }
}

/**
 * Read a whole object. `maxBytes` guards the process: a presigned PUT does not
 * fix the size, so the job must refuse oversized objects before inflating them.
 */
export async function getObjectBytes(key: string, options: { maxBytes?: number } = {}): Promise<Uint8Array> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!res.Body) throw new Error(`S3 object ${key} has no body`);
  const length = Number(res.ContentLength ?? 0);
  if (options.maxBytes !== undefined && length > options.maxBytes) {
    const body = res.Body as { destroy?: () => void };
    body.destroy?.();
    throw new ObjectTooLargeError(key, length, options.maxBytes);
  }
  const bytes = await res.Body.transformToByteArray();
  if (options.maxBytes !== undefined && bytes.byteLength > options.maxBytes) {
    throw new ObjectTooLargeError(key, bytes.byteLength, options.maxBytes);
  }
  return bytes;
}

export async function putObjectBytes(key: string, body: Uint8Array | string, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
}
