---
name: backend-integration-scope-conflict
description: feat/backend-integration (reviewed 2026-10-26) built sign-in, Postgres/S3 project storage and server autosave, which CLAUDE.md lists as later phase; check whether a human decision was recorded before treating accounts as in scope
metadata:
  type: project
---
On 2026-10-26 the branch `feat/backend-integration` (merging the OrchestraWriter Hono/Better Auth/Postgres/S3 backend into Next.js) was reviewed. It made an account required for the whole workflow (`src/proxy.ts` protects `/projects`), autosaved display/sync to Postgres (that is auto-restore plus cloud storage), and added a profile `Preferences` store. CLAUDE.md's scope table, ADR 0001, requirement 8 Scope 1 and `.claude/rules/export-and-project-file.md` all still call these later phase. The branch's STATE.md edit dropped "sign-in" and "cloud storage" from the later-phase backlog without saying so explicitly. I flagged it as the first blocker.

It also kept the backend's audio-to-score transcription pipeline (`/api/files`, `/api/transcriptions`, placeholder model). That feature is not in the spec at all.

**Why:** ADR 0001 says later-phase work needs a STATE.md move, and CLAUDE.md says to stop and ask first. Quietly editing a backlog line is not a recorded decision.

**How to apply:** On later reviews, check whether a superseding ADR for 0001 exists and whether the CLAUDE.md scope table and the export rule were updated. If they were, accounts and server storage are in scope. If not, keep flagging. Either way, check that a no-account path to save and open `.ovproj` still exists. Related: [[recurring-review-findings]].
