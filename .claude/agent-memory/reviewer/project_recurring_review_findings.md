---
name: recurring-review-findings
description: Failure modes found in the 2026-10-26 backend-integration review, to re-check on later PRs (upload size caps, zip bombs, presigned URL expiry, autosave/refresh race, MP4 memory, empty e2e dir)
metadata:
  type: project
---
These checks turned up real problems in the 2026-10-26 review of `feat/backend-integration`. Re-check them whenever a PR touches the same areas.

- **Size caps on server reads.** Presigned S3 PUTs can be reused until they expire, and their size is not signed. A HEAD check at register time does not stop a bigger re-upload. Any server read of user bytes (parse-score `getObjectBytes`) needs its own cap. `.mxl` `unzipSync` needs an `originalSize` filter, like `unpackProjectFile` already has.
- **Unbounded numbers that drive loops.** For example, `/api/files` `audioLengthSeconds` sets the transcription chunk count. One shared Next.js process serves every user, so an out-of-memory crash takes everyone down.
- **Presigned GET TTL is 15 min.** The client cache is 10 min. The `<audio>` element has no recovery when the URL expires mid-playback, which matters for long recordings.
- **Store `refresh()` vs in-flight autosave.** `refresh()` checks only `pendingKinds`, not saves already in flight, so a stale GET can overwrite fresh local edits. Edits waiting on the debounce are also lost on tab close, because there is no pagehide flush.
- **MP4 export memory.** It uses `ArrayBufferTarget` plus `fastStart: "in-memory"`, and the download only appears after the S3 history upload succeeds. Long pieces risk running out of memory, and a failed upload loses the render.
- **CI e2e job.** It runs `playwright test` while `tests/e2e/` is empty, which fails with "No tests found". Nothing covers the alignment worker in the real bundle.
- **Public `/api/status`.** It exposes env, DB host, bucket and state machine names, and hits the DB and S3 on every call.

**Why:** Each item was a real defect in this codebase. Merging to main auto-deploys (`.github/workflows/deploy.yml`), so server issues become production issues on merge.

**How to apply:** Grep for these patterns in new server, export or store code before reading line by line. Related: [[backend-integration-scope-conflict]].
