#!/usr/bin/env bash
# PreToolUse hook on Bash. Blocks commands that would destroy history or
# bypass the PR flow. Exit 2 = block and show the message to Claude.
input=$(cat)
if command -v jq >/dev/null 2>&1; then
  cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
else
  cmd=$(printf '%s' "$input" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p')
fi
[ -z "$cmd" ] && exit 0

block() {
  echo "Blocked by .claude/hooks/guard-destructive.sh: $1. Ask the human to run this themselves." >&2
  exit 2
}

echo "$cmd" | grep -Eq 'git push .*(--force|-f\b)'            && block "force push"
echo "$cmd" | grep -Eq 'git push .*\b(origin )?main\b'         && block "direct push to main (open a PR)"
echo "$cmd" | grep -Eq 'git reset --hard'                      && block "hard reset"
echo "$cmd" | grep -Eq 'git (checkout|restore) (--|\.)'        && block "discarding working-tree changes"
echo "$cmd" | grep -Eq 'git clean -[a-z]*f'                    && block "git clean -f"
echo "$cmd" | grep -Eq 'git branch -D'                         && block "force branch delete"
echo "$cmd" | grep -Eq 'rm -rf? +(/|~|\.\.|\$HOME)'            && block "recursive delete outside the project"
exit 0
