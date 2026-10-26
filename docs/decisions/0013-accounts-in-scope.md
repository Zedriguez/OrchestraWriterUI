# 0013. Accounts and server-side projects are in scope (supersedes the no-account line of 0001)

Date: 2026-10-26
Status: accepted

## Context
ADR 0001 and requirement 8 Scope 1 said the MVP needs no account: projects
live only in manual `.ovproj` files. On 2026-10-26 the product owner asked for
the full demo "capable of ingesting music files, sheet note music, syncing the
two and displaying animations as well as doing user account tracking and
management", integrating the team's backend (accounts, Postgres, S3). The
branch review flagged that this contradicts 0001 and the rule files unless
recorded.

## Decision
- Accounts (Better Auth) are part of the product. Projects, programs, display
  settings, alignment, exports history, activity and preferences are stored
  per user on the server; the library is the user's home.
- Requirement 8 Scope 1 (manual project file) stays: `.ovproj` save and open
  work from the Export and Import screens. Opening a file re-creates the
  project on the server, so the file is portable between accounts and
  installations. There is no account-free mode in this build.
- Requirement 8 Scope 2 (automatic restore) is satisfied by the server copy
  reloading on return; Scope 3 (sign-in, online storage, cross-device) is in.
- Preferences (theme, reduced motion, export defaults) live on the profile;
  display settings stay inside the project (and the project file), as the
  export rule requires.

## Consequences
- `CLAUDE.md` scope table, `.claude/rules/export-and-project-file.md` and
  `docs/STATE.md` are updated to match.
- Password reset needs an email provider; until one is configured a lost
  password means a lost account. Listed in STATE.md as a follow-up.
- The audio-to-score transcription pipeline from the backend repo is still
  outside the spec; its routes are mounted only with `PIPELINE_ENABLED=1`.
