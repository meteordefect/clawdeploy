#!/bin/bash
set -e

cd /workspace
git clone "https://x-access-token:${GITHUB_TOKEN}@${REPO_URL#https://}" repo && cd repo
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
gh pr create \
    --title "[$TASK_ID] $(echo "$PROMPT" | head -c 60)" \
    --body "Automated PR from sub-agent.

Task: $TASK_ID
Agent: $AGENT_TYPE
Model: ${SUBAGENT_MODEL:-default}

Prompt:
$PROMPT"
