#!/usr/bin/env bash
# ClawDeploy Custom - Deploy from local to VPS (same method as main clawdeploy)
# Usage: ./deploy.sh [command]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

check_env() {
  if [ ! -f .env ]; then
    echo "Error: .env not found. Copy .env.example to .env and configure."
    exit 1
  fi
}

load_env() {
  [ -f .env ] && set -a && source .env && set +a
}

cmd_deploy() {
  check_env
  load_env
  extra=""
  [ "${1:-}" = "reset" ] && extra='-e reset_postgres=true'
  echo "Deploying to VPS..."
  cd ansible
  ansible-playbook playbooks/site.yml $extra
  cd ..
  domain=$(grep '^DOMAIN=' .env 2>/dev/null | cut -d= -f2- | sed 's/^[ "]*//;s/[ "]*$//')
  if [ -n "$domain" ]; then
    echo "Deploy complete. Dashboard at https://$domain/dashboard/custom"
  else
    echo "Deploy complete. Dashboard at /dashboard/custom (set DOMAIN in .env for full URL)"
  fi
}

cmd_ssh() {
  if [ ! -f ansible/inventory.ini ]; then
    echo "Error: ansible/inventory.ini not found. Copy from inventory.ini.example (same VPS as main)."
    exit 1
  fi
  host=$(grep ansible_host ansible/inventory.ini | head -1 | cut -d= -f2)
  echo "Connecting to $host..."
  ssh root@$host
}

cmd_logs() {
  if [ ! -f ansible/inventory.ini ]; then
    echo "Error: ansible/inventory.ini not found."
    exit 1
  fi
  host=$(grep ansible_host ansible/inventory.ini | head -1 | cut -d= -f2)
  echo "Logs from $host..."
  ssh root@$host "cd /opt/clawdeploy-custom && docker compose logs -f --tail=100"
}

cmd_status() {
  if [ ! -f ansible/inventory.ini ]; then
    echo "Error: ansible/inventory.ini not found."
    exit 1
  fi
  host=$(grep ansible_host ansible/inventory.ini | head -1 | cut -d= -f2)
  echo "Status on $host..."
  ssh root@$host "cd /opt/clawdeploy-custom && docker compose ps"
}

cmd_pull() {
  if [ ! -f ansible/inventory.ini ]; then
    echo "Error: ansible/inventory.ini not found."
    exit 1
  fi
  host=$(grep ansible_host ansible/inventory.ini | head -1 | cut -d= -f2)
  echo "Pulling OpenClaw changes from $host..."
  rsync -avz --exclude=node_modules --exclude=.git root@$host:/opt/clawdeploy-custom/ .
  echo "Done. Review changes with git diff."
}

cmd_help() {
  cat <<EOF
ClawDeploy Custom - Deploy from local to VPS

Usage: ./deploy.sh [command]

Commands:
  deploy    Sync code and deploy (Ansible, same as main clawdeploy)
  deploy reset  Wipe Postgres and redeploy (fixes DB auth/schema issues)
  pull      Pull OpenClaw edits from VPS to local
  ssh       SSH to VPS
  logs      Tail docker compose logs
  status    Show container status
  help      This message

Setup:
  1. cp ansible/inventory.ini.example ansible/inventory.ini
  2. Set ansible_host (same IP as main clawdeploy - same VPS)
  3. cp .env.example .env && configure
  4. ./deploy.sh deploy
EOF
}

case "${1:-help}" in
  deploy)   cmd_deploy "${@:2}" ;;
  pull)     cmd_pull ;;
  ssh)      cmd_ssh ;;
  logs)     cmd_logs ;;
  status)   cmd_status ;;
  help|-h)  cmd_help ;;
  *)
    echo "Unknown command: $1"
    cmd_help
    exit 1
    ;;
esac
