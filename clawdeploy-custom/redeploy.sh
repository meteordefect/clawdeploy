#!/usr/bin/env bash
# Rebuild and restart on the VPS. Use after editing code (e.g. OpenClaw self-deploy).
# Run this ON the VPS: cd /opt/clawdeploy-custom && ./redeploy.sh
#
# Usage: ./redeploy.sh [--pull] [--rollback] [--soft]
#   --soft  Rebuild dashboard only (Vite build), restart dashboard. Refresh page to see changes.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

[ -f .env ] && set -a && source .env && set +a

clear_deploy_banner() {
  for _ in $(seq 1 15); do
    curl -s -X POST http://127.0.0.1:3003/api/deploy/complete && break
    sleep 2
  done
}

soft_deploy() {
  echo "Quick deploy: rebuilding dashboard image..."
  docker compose build dashboard || { echo "Build failed."; exit 1; }
  echo "Recreating dashboard container with new image..."
  docker compose up -d --force-recreate dashboard
  clear_deploy_banner
  echo "Done. Refresh the dashboard page to see changes."
  exit 0
}

rollback() {
  echo "Rolling back to :previous images..."
  docker compose down
  docker tag clawdeploy-custom-dashboard:latest clawdeploy-custom-dashboard:broken 2>/dev/null || true
  docker tag clawdeploy-custom-dashboard:previous clawdeploy-custom-dashboard:latest 2>/dev/null || true
  docker tag clawdeploy-custom-api:latest clawdeploy-custom-api:broken 2>/dev/null || true
  docker tag clawdeploy-custom-api:previous clawdeploy-custom-api:latest 2>/dev/null || true
  docker compose up -d
  clear_deploy_banner
  echo "Rollback complete."
  exit 0
}

if [ "$1" = "--rollback" ]; then
  rollback
fi

if [ "$1" = "--soft" ]; then
  soft_deploy
fi

if [ "$1" = "--pull" ]; then
  echo "Pulling latest..."
  git pull
fi

# Tag current images as :previous before replacing (for rollback)
docker tag clawdeploy-custom-dashboard:latest clawdeploy-custom-dashboard:previous 2>/dev/null || true
docker tag clawdeploy-custom-api:latest clawdeploy-custom-api:previous 2>/dev/null || true

echo "Building..."
if ! docker compose build; then
  echo "Build failed. Containers unchanged."
  exit 1
fi

echo "Starting (dashboard + postgres; API kept running to avoid deploy races)..."
docker compose up -d --force-recreate dashboard postgres
clear_deploy_banner
echo "Deployed. Dashboard on port 3002, API on 3003."
