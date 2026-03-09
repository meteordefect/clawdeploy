#!/bin/bash
set -e

mkdir -p /workspace
cd /workspace

echo "$PROMPT_B64" | base64 -d > /workspace/prompt.txt
PROMPT="$(cat /workspace/prompt.txt)"

git clone "https://x-access-token:${GITHUB_TOKEN}@${REPO_URL#https://}" repo && cd repo

git config user.name "ClawDeploy Agent"
git config user.email "agent@clawdeploy.local"
git checkout -b "$BRANCH"

if [ "$AGENT_TYPE" = "pi" ] || [ -z "$AGENT_TYPE" ]; then
    MODEL_FLAG=""
    if [ -n "$SUBAGENT_MODEL" ]; then
        MODEL_FLAG="--model $SUBAGENT_MODEL"
    fi
    pi -p --no-session $MODEL_FLAG "$PROMPT"
elif [ "$AGENT_TYPE" = "claude" ]; then
    echo "$PROMPT" | claude --dangerously-skip-permissions
elif [ "$AGENT_TYPE" = "codex" ]; then
    echo "$PROMPT" | codex --full-auto
else
    echo "Unknown agent type: $AGENT_TYPE"
    exit 1
fi

git add -A
if git diff --cached --quiet; then
    echo "No changes made by agent"
    exit 0
fi

git commit -m "task($TASK_ID): automated changes"
git push origin "$BRANCH"

TITLE="$(echo "$PROMPT" | head -c 60)"
gh pr create \
    --title "[$TASK_ID] $TITLE" \
    --body "Automated PR from sub-agent.

Task: $TASK_ID
Agent: $AGENT_TYPE
Model: ${SUBAGENT_MODEL:-default}"
