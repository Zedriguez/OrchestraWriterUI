---
description: Append a session handoff entry to docs/handoffs/<branch>.md so the next person or agent can continue.
allowed-tools: Bash(git *), Read, Write, Edit
argument-hint: [optional one-line summary]
---
Write a handoff entry for this session.

1. Run `git rev-parse --abbrev-ref HEAD` and `git status --short` and
   `git log --oneline origin/main..HEAD`.
2. Target file: `docs/handoffs/<branch with / replaced by ->.md`. Create it
   from `docs/handoffs/_template.md` if missing.
3. Append (never rewrite) an entry with today's date (UTC) and:
   - **Done** – what changed, by file area, in 1–5 lines
   - **Decisions** – anything decided; link the ADR if one was written, or
     say one is needed
   - **Open questions / blockers**
   - **Next steps** – concrete, ordered
   - **Verified by** – commands run and results
   Use `$ARGUMENTS` as the headline if given.
4. If the branch is `main`, also update the status table in `docs/STATE.md`.
   Otherwise don't touch STATE.md.
5. Show the entry you appended.
