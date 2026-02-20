#!/usr/bin/env bash
# Soft deploy - restart containers without rebuilding (hot reload only)
# Use when you want to apply configuration changes only

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting soft deploy (hot reload)..."
echo "This will restart containers without rebuilding images."

docker compose up -d

echo "Soft deploy complete."
echo "Dashboard on port 3002, API on 3003."
