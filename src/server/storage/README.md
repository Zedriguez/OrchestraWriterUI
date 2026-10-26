# server/storage/

S3 access. The server signs URLs and the browser talks to S3 directly; the only
bytes the server moves are the parse-score job's read of the score and its
`info-map-<jobId>.json` write (and the transcription pipeline).

- `s3Client.ts`: two `S3Client`s (server calls, and browser-facing presigned URLs), credentials from the SDK default chain.
- `keys.ts`: the key layout (`users/<uid>/projects/<pid>/{score,audio,exports}/<uuid>-<name>`, `users/<uid>/imports/...`), `isProjectObjectKey` / `keyBelongsTo` (the prefix is the ownership check), `presignUpload` (PUT, 15 min, Content-Type pinned), `presignDownload` (GET, 15 min, optional attachment filename), `headObject`, `deleteObject(s)`, `deletePrefix`.
- `objects.ts`: `getObjectBytes` / `putObjectBytes` for server-side reads and writes.

The bucket blocks all public access; the only way in is a presigned URL. Its CORS rule must list the site origin, which `scripts/s3-init.sh` sets.
