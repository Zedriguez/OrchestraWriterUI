---
description: Check whether a proposed feature or change is MVP or later phase before building it.
argument-hint: <feature or change>
---
Check `$ARGUMENTS` against the scope table in `CLAUDE.md`, `docs/spec/requirements.md`,
and `docs/STATE.md`.

Answer with:
- **Verdict**: MVP / later phase / unclear
- **Why**: the exact line in the spec it maps to
- **If later phase**: the smallest MVP-safe version, if one exists
- **If unclear**: the question to ask the team, and a suggested ADR title
Do not write code.
