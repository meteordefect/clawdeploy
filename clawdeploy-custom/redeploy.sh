#!/usr/bin/env bash
# Rebuild and restart on the VPS. Use after editing code (e.g. OpenClaw self-deploy).
# Run this ON the VPS: cd /opt/clawdeploy-custom && ./redeploy.sh
#
# Usage: ./redeploy.sh [--pull] [--rollback]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

rollback() {
  echo "Rolling back to :previous images..."
  docker compose down
  docker tag clawdeploy-custom-dashboard:latest clawdeploy-custom-dashboard:broken 2>/dev/null || true
  docker tag clawdeploy-custom-dashboard:previous clawdeploy-custom-dashboard:latest 2>/dev/null || true
  docker tag clawdeploy-custom-api:latest clawdeploy-custom-api:broken 2>/dev/null || true
  docker tag clawdeploy-custom-api:previous clawdeploy-custom-api:latest 2>/dev/null || true
  docker compose up -d
  echo "Rollback complete."
  exit 0
}

if [ "$1" = "--rollback" ]; then
  rollback
fi

if [ "$1" = "--pull" ]; then
  echo "Pulling latest..."
  git pull
fi

[ -f .env ] && set -a && source .env && set +a

# Tag current images as :previous before replacing (for rollback)
docker tag clawdeploy-custom-dashboard:latest clawdeploy-custom-dashboard:previous 2>/dev/null || true
docker tag clawdeploy-custom-api:latest clawdeploy-custom-api:previous 2>/dev/null || true

echo "Building..."
if ! docker compose build; then
  echo "Build failed. Containers unchanged."
  exit 1
fi

echo "Starting..."
docker compose up -d --force-recreate
echo "Deployed. Dashboard on port 3002, API on 3003."
