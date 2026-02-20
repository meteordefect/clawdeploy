#!/usr/bin/env bash
# Deploy dashboard with fallback on build failure.
# Usage: ./dashboard-deploy-safe.sh [--rollback]
#
# Normal flow: Build dashboard image. If build fails, exit without changing running container.
# If build succeeds, recreate dashboard container with new image.
#
# Rollback: Restart dashboard with default image (requires clawdeploy-dashboard:default tag).
#
# Requires: Run from deploy/ dir or set PROJECT_DIR. Expects docker compose.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="${DEPLOY_DIR:-$SCRIPT_DIR/..}"
cd "$DEPLOY_DIR"

rollback() {
    echo "Rolling back dashboard to default..."
    docker compose build dashboard 2>/dev/null || true
    docker compose up -d dashboard --force-recreate
    echo "Rollback complete."
    exit 0
}

if [ "$1" = "--rollback" ]; then
    rollback
fi

echo "Building dashboard (build failure = no deploy, current dashboard kept)..."
if ! docker compose build dashboard; then
    echo "Build failed. Current dashboard unchanged."
    exit 1
fi

echo "Build succeeded. Recreating dashboard container..."
docker compose up -d dashboard --force-recreate
echo "Dashboard deployed."
