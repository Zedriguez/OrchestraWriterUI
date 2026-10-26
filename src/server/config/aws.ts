// Shared AWS SDK settings used by the RDS signer, the S3 clients and Step Functions.
// Credentials are normally NOT set here: the SDK resolves them from env vars,
// ~/.aws, or an attached IAM role, in that order. The one exception is the local
// S3 stand-in, which gets fixed dummy credentials from config/env.ts.
import { env } from "./env";

export const awsConfig = {
  region: env.aws.region,
  ...(env.aws.credentials ? { credentials: env.aws.credentials } : {}),
} as const;
