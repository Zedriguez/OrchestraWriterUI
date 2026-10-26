# server/services/

Business logic. Functions take the signed-in user's id plus plain values, talk to `db/` and `storage/`, and return DTOs from `src/shared/api.ts` or throw typed errors from `server/errors.ts`. They know nothing about HTTP.

Every query that reads or changes a user's data has `user_id = $n` in its `WHERE` (or joins through a row that does). A missing or foreign row is `NotFoundError`.

- `profiles.ts`: profile get-or-create (handle from the email), update, preferences merge, usage, account deletion.
- `projects.ts`: project CRUD, derived status, score/audio registration, presigned URLs, sync and display saves.
- `parse-score.ts`: the in-process parse-score job (S3 → `parseMusicXml` → info map in S3 → project row).
- `jobs.ts`: `app.jobs` rows (create, progress, finish, read).
- `uploads.ts`: content-type allowlist and presigned PUT targets.
- `exports.ts`, `programs.ts`, `activity.ts`: export history, concert programs, the activity feed.
- `display-defaults.ts`: default `DisplaySettings` for a freshly parsed score.
- `files.ts`, `transcriptions.ts`, `status.ts`: kept from the backend repo (recordings for the transcription pipeline, `/api/status` checks).

Convention: DTOs are camelCase with string ids; rows are snake_case (`types/db.ts`). The service does the translation.
