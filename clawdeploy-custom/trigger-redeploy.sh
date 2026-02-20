#!/bin/bash
# Simple deploy trigger - creates a timestamp file
# On VPS, watch this file or use it as trigger

echo "$(date '+%Y-%m-%d %H:%M:%S')" > .deploy-trigger
echo "Deploy triggered at $(date)"
echo "On VPS, run: cd /opt/clawdeploy-custom && ./redeploy.sh"
