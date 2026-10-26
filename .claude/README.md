# Claude Code setup for this repo

Everything Claude needs is committed, so a teammate gets the same behavior by
cloning. Nothing here depends on a plugin or on anyone's `~/.claude/`.

## First time

1. Install Claude Code and run `claude` from the repo root. Accept the trust
   prompt; it reads `CLAUDE.md`, `.claude/rules/`, and `docs/STATE.md`.
2. Optional: `cp .claude/settings.local.json.example .claude/settings.local.json`
   for personal permissions. It is gitignored.
3. Optional: create `CLAUDE.local.md` at the repo root for personal notes
   (local paths, sandbox URLs). Also gitignored.
4. If hooks don't fire, check the scripts are executable:
   `chmod +x .claude/hooks/*.sh`.

## Every session

- The `SessionStart` hook fetches and prints what landed on `main`, which
  branches are active, and this branch's handoff log.
- Work on a feature branch. The `PreToolUse` guard blocks force pushes,
  hard resets, and direct pushes to `main`.
- Run `/handoff` before you stop. It appends to `docs/handoffs/<branch>.md`.
- Run `/scope-check <feature>` before building anything that might be
  later-phase.

## What's committed vs personal

| Committed (shared) | Personal (gitignored) |
|---|---|
| `CLAUDE.md`, `.claude/settings.json`, `.claude/rules/`, `.claude/agents/`, `.claude/skills/`, `.claude/commands/`, `.claude/hooks/`, `.mcp.json`, `docs/` | `CLAUDE.local.md`, `.claude/settings.local.json`, `.claude/agent-memory-local/`, `~/.claude/*` |

`.claude/agent-memory/` (created when the `reviewer` agent runs) is shared via
git. Commit it in the same PR as the work that produced it.

## How updates from other people reach your session

Claude only sees the branch you have checked out. Merge or rebase `main` into
your branch to pick up others' rules, decisions, and agent memory. Their
unmerged branches show up only in the session-start summary.
