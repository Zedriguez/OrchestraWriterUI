---
description: Summarize where the project stands — STATE.md, this branch vs main, open ADRs, and recent handoffs.
allowed-tools: Bash(git *), Read, Glob
---
Give a short status report:

1. Read `docs/STATE.md` and summarize each requirement's status in one line.
2. `git fetch --quiet && git log --oneline HEAD..origin/main` → what's new on main.
3. `git for-each-ref --sort=-committerdate refs/remotes/origin --format='%(committerdate:short) %(refname:short)' | head` → active branches.
4. List `docs/decisions/*.md` titles and any marked `Status: proposed`.
5. Tail the last entry of each file in `docs/handoffs/` modified in the last 7 days.
6. End with: the three most useful next tasks and who/which branch they fit.
