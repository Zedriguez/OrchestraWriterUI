# server/routes/

HTTP handlers. One file per resource, each exporting a `Hono` sub-app that `app.ts` mounts under `/api`.

- `session.ts`: `requireUser` middleware. Turns the session cookie into `c.get("user")` / `c.get("userId")`, or answers 401 `{ error: "Not signed in" }`. The user id never comes from the request body or query.
- `validate.ts`: small validators (`jsonBody`, `idParam`, `str`, `num`, `oneOf`, ...). Routes read only the fields they name.
- `errors.ts`: the single error handler (`handleError`, `handleNotFound`), mounted on the root app. Services throw typed errors from `server/errors.ts`; this maps them to `{ error, code }` with 400/403/404/409/413/503, logs anything unexpected and answers a generic 500.
- `me.ts`, `uploads.ts`, `projects.ts`, `exports.ts`, `programs.ts`, `activity.ts`, `jobs.ts`: the visualizer API.
- `files.ts`, `transcriptions.ts` (with `sheets`), `status.ts`: kept from the backend repo.

A route validates input, calls one service function with `c.get("userId")`, and returns JSON. Routes never import from `db/` or `storage/`. Ownership is enforced in the service's SQL (`WHERE ... AND user_id = $n`); a record that is missing or someone else's is a 404.

Adding a resource: create `thing.ts` with `export const thingRoutes = new Hono<AuthEnv>()` and `thingRoutes.use("*", requireUser)`, mount it in `app.ts`, document it in `docs/backend/API.md`, add a test in `tests/api/`.
