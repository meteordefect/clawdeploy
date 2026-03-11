#!/bin/bash
set -e

cd /workspace

echo "$PROMPT_B64" | base64 -d > /tmp/prompt.txt
PROMPT="$(cat /tmp/prompt.txt)"

git config user.name "Phoung Agent"
git config user.email "agent@phoung.local"

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
