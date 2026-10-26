// Plain S3 object reads and writes. Used by the transcription pipeline and the
// parse-score job; API routes never move bytes themselves.
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { bucket } from "./keys";
import { s3 } from "./s3Client";

export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!res.Body) throw new Error(`S3 object ${key} has no body`);
  return res.Body.transformToByteArray();
}

export async function putObjectBytes(key: string, body: Uint8Array | string, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
}
