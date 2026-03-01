#!/usr/bin/env bash
# spawn-agent.sh <project-id> <task-id> <description> <agent-type> <model> <repo-path>
# Called by task-runner.ts. Creates a git worktree, tmux session, and launches the sub-agent.
set -euo pipefail

PROJECT_ID="$1"
TASK_ID="$2"
DESCRIPTION="$3"
AGENT_TYPE="$4"
MODEL="$5"
REPO_PATH="$6"

SHORT_ID="${TASK_ID:0:8}"
BRANCH="feat/task-${SHORT_ID}"
WORKTREE_PATH="$(dirname "$REPO_PATH")/worktrees/${PROJECT_ID:0:8}-${SHORT_ID}"
TMUX_SESSION="claw-${SHORT_ID}"

CONTROL_API_URL="${CONTROL_API_URL:-http://localhost:3001}"

update_status() {
  curl -s -X PATCH "${CONTROL_API_URL}/api/tasks/${TASK_ID}" \
    -H "Content-Type: application/json" \
    -d "{\"status\": \"$1\"}" > /dev/null || true
}

# --- 1. Create git worktree ---
cd "$REPO_PATH"
DEFAULT_BRANCH="$(git remote show origin | awk '/HEAD branch/ {print $NF}')"
git fetch origin "$DEFAULT_BRANCH" --quiet
git worktree add "$WORKTREE_PATH" -b "$BRANCH" "origin/${DEFAULT_BRANCH}" --quiet 2>/dev/null || \
  git worktree add "$WORKTREE_PATH" "$BRANCH" --quiet

cd "$WORKTREE_PATH"

# Install deps if package.json present and node_modules absent
if [ -f "package.json" ] && [ ! -d "node_modules" ]; then
  npm install --silent 2>/dev/null || true
fi

update_status "coding"

# --- 2. Build prompt ---
CONTEXT_FILE="$(dirname "$REPO_PATH")/context/${PROJECT_ID:0:8}/README.md"
PROJECT_CONTEXT=""
if [ -f "$CONTEXT_FILE" ]; then
  PROJECT_CONTEXT="$(cat "$CONTEXT_FILE")"
fi

PROMPT="You are a coding agent working in the git repository at: $(pwd)

Your task:
${DESCRIPTION}

Project context:
${PROJECT_CONTEXT}

Instructions:
- Work in the current directory only.
- Make all necessary code changes to complete the task.
- Run tests if a test command is available (e.g. npm test, pytest).
- Commit your changes with a clear commit message.
- After committing, run: gh pr create --title \"${DESCRIPTION:0:72}\" --body \"Automated PR by ClawDeploy task ${TASK_ID}\" --base ${DEFAULT_BRANCH}
- When done, exit."

# --- 3. Launch in tmux ---
tmux new-session -d -s "$TMUX_SESSION" -x 220 -y 50 2>/dev/null || true

case "$AGENT_TYPE" in
  claude)
    CLAUDE_MODEL="${MODEL:-claude-sonnet-4-5}"
    tmux send-keys -t "$TMUX_SESSION" \
      "claude --model ${CLAUDE_MODEL} --dangerously-skip-permissions -p $(printf '%q' "$PROMPT") && tmux kill-session -t ${TMUX_SESSION}" Enter
    ;;
  codex)
    CODEX_MODEL="${MODEL:-gpt-4o}"
    tmux send-keys -t "$TMUX_SESSION" \
      "codex --model ${CODEX_MODEL} --dangerously-bypass-approvals-and-sandbox $(printf '%q' "$PROMPT") && tmux kill-session -t ${TMUX_SESSION}" Enter
    ;;
  kimi)
    # Kimi K2.5 via OpenClaw thin wrapper
    tmux send-keys -t "$TMUX_SESSION" \
      "OPENCLAW_MODEL=${MODEL:-kimi-k2.5} openclaw-run $(printf '%q' "$PROMPT") && tmux kill-session -t ${TMUX_SESSION}" Enter
    ;;
  *)
    echo "Unknown agent type: $AGENT_TYPE" >&2
    update_status "failed"
    exit 1
    ;;
esac

echo "Spawned ${AGENT_TYPE} agent in tmux session ${TMUX_SESSION} on branch ${BRANCH}"
