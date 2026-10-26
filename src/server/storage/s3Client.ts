// S3 clients built from config/aws.ts and config/env.ts.
// Credentials come from the SDK's default chain: env vars, ~/.aws, or the
// App Runner instance role in production (dummy values for the local S3Mock).
//
// Two clients exist because a presigned URL is bound to the hostname inside it.
// In docker compose the server reaches S3Mock as http://s3:9090 but the browser
// reaches it as http://localhost:9090, so URLs for the browser are signed with the
// public endpoint. Against real S3 both endpoints are empty and the two are the same.
import { S3Client } from "@aws-sdk/client-s3";
import { awsConfig } from "../config/aws";
import { env } from "../config/env";

function makeClient(endpoint: string | undefined): S3Client {
  return new S3Client({
    ...awsConfig,
    // S3Mock and friends need path-style URLs (host/bucket/key, not bucket.host/key).
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    // Only add checksums when an operation requires one. The SDK default
    // ("when supported") bakes a checksum of an empty body into presigned PUT
    // URLs, which then rejects the browser's real upload.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

/** For calls the server makes itself: HeadObject, DeleteObjects, GetObject. */
export const s3 = makeClient(env.s3.endpoint);

/** For URLs handed to the browser: presigned PUT and GET. */
export const s3Presign =
  env.s3.publicEndpoint === env.s3.endpoint ? s3 : makeClient(env.s3.publicEndpoint);
