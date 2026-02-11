#!/usr/bin/env bash
set -e

# ClawDeploy v3 - Deployment Script
# Usage: ./deploy.sh [command]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if .env exists
check_env() {
    if [ ! -f .env ]; then
        log_error ".env file not found!"
        log_info "Copy .env.example to .env and configure it:"
        log_info "  cp .env.example .env"
        exit 1
    fi
}

# Load environment variables
load_env() {
    if [ -f .env ]; then
        export $(grep -v '^#' .env | xargs)
    fi
}

# Terraform commands
cmd_terraform_init() {
    log_info "Initializing Terraform..."
    cd terraform
    terraform init
    cd ..
    log_success "Terraform initialized"
}

cmd_terraform_plan() {
    log_info "Planning Terraform changes..."
    cd terraform
    terraform plan
    cd ..
}

cmd_terraform_apply() {
    log_info "Applying Terraform configuration..."
    cd terraform
    terraform apply
    
    # Get server IP
    SERVER_IP=$(terraform output -raw server_ip)
    log_success "Server provisioned at IP: $SERVER_IP"
    
    # Update Ansible inventory
    cd ../ansible
    if [ ! -f inventory.ini ]; then
        cp inventory.ini.example inventory.ini
    fi
    sed -i.bak "s/ansible_host=.*/ansible_host=$SERVER_IP/" inventory.ini
    log_success "Ansible inventory updated"
    cd ..
}

cmd_terraform_destroy() {
    log_warn "This will destroy all infrastructure!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        cd terraform
        terraform destroy
        cd ..
        log_success "Infrastructure destroyed"
    else
        log_info "Cancelled"
    fi
}

# Ansible commands
cmd_ansible_deploy() {
    check_env
    load_env
    log_info "Deploying with Ansible..."
    cd ansible
    ansible-playbook playbooks/site.yml
    cd ..
    log_success "Deployment complete"
}

cmd_ansible_status() {
    log_info "Checking system status..."
    cd ansible
    ansible-playbook playbooks/status.yml
    cd ..
}

cmd_ansible_backup() {
    check_env
    load_env
    log_info "Creating backup..."
    cd ansible
    ansible-playbook playbooks/backup.yml
    cd ..
    log_success "Backup complete"
}

cmd_ansible_migrate() {
    log_info "Running database migrations..."
    cd ansible
    ansible-playbook playbooks/db-migrate.yml
    cd ..
    log_success "Migrations complete"
}

# Combined commands
cmd_init() {
    log_info "Initializing ClawDeploy Control Plane from scratch..."
    
    check_env
    
    log_info "Step 1: Terraform Init"
    cmd_terraform_init
    
    log_info "Step 2: Provision Infrastructure"
    cmd_terraform_apply
    
    log_info "Step 3: Wait for SSH (30s)"
    sleep 30
    
    log_info "Step 4: Deploy Services"
    cmd_ansible_deploy
    
    log_success "ClawDeploy Control Plane is ready!"
    log_info "Access dashboard at: http://$SERVER_IP"
    log_info "Username: $BETA_USER"
    log_info "Password: $BETA_PASSWORD"
}

cmd_full() {
    log_info "Full redeploy (Terraform + Ansible)..."
    cmd_terraform_plan
    cmd_terraform_apply
    sleep 10
    cmd_ansible_deploy
}

cmd_config() {
    log_info "Updating configuration only..."
    cmd_ansible_deploy
}

cmd_api() {
    log_info "Updating Control API only..."
    cd ansible
    ansible control_plane -m shell -a "cd /opt/clawdeploy && docker compose restart control-api"
    cd ..
    log_success "Control API restarted"
}

cmd_dashboard() {
    log_info "Updating Dashboard only..."
    cd ansible
    ansible control_plane -m shell -a "cd /opt/clawdeploy && docker compose restart dashboard"
    cd ..
    log_success "Dashboard restarted"
}

cmd_nginx() {
    log_info "Updating Nginx configuration..."
    cd ansible
    ansible-playbook playbooks/site.yml --tags nginx
    cd ..
    log_success "Nginx updated"
}

cmd_ssh() {
    if [ ! -f ansible/inventory.ini ]; then
        log_error "Ansible inventory not found. Run 'deploy.sh init' first."
        exit 1
    fi
    
    SERVER_IP=$(grep ansible_host ansible/inventory.ini | cut -d'=' -f2)
    log_info "Connecting to $SERVER_IP..."
    ssh root@$SERVER_IP
}

cmd_logs() {
    if [ ! -f ansible/inventory.ini ]; then
        log_error "Ansible inventory not found. Run 'deploy.sh init' first."
        exit 1
    fi
    
    SERVER_IP=$(grep ansible_host ansible/inventory.ini | cut -d'=' -f2)
    log_info "Fetching logs from $SERVER_IP..."
    ssh root@$SERVER_IP "cd /opt/clawdeploy && docker compose logs -f --tail=100"
}

cmd_build_openclaw() {
    log_info "Building OpenClaw image from source..."
    check_env
    load_env
    
    cd ../openclaw-source
    
    if [ "$OPENCLAW_VERSION" = "latest" ]; then
        log_info "Pulling latest from main branch..."
        git pull origin main
    else
        log_info "Checking out tag: $OPENCLAW_VERSION"
        git fetch --tags
        git checkout "$OPENCLAW_VERSION"
    fi
    
    log_info "Building Docker image..."
    docker build -t openclaw/openclaw:${OPENCLAW_VERSION} .
    
    cd ../deploy
    log_success "OpenClaw image built: openclaw/openclaw:${OPENCLAW_VERSION}"
}

cmd_destroy() {
    log_warn "This will destroy ALL infrastructure and data!"
    read -p "Type 'destroy' to confirm: " confirm
    if [ "$confirm" = "destroy" ]; then
        cmd_terraform_destroy
    else
        log_info "Cancelled"
    fi
}

cmd_help() {
    cat <<EOF
${GREEN}ClawDeploy v3 - Deployment Tool${NC}

${BLUE}Usage:${NC}
  ./deploy.sh [command]

${BLUE}Setup Commands:${NC}
  init              Fresh VPS → fully running control plane
  full              Terraform plan + full Ansible redeploy
  
${BLUE}Terraform Commands:${NC}
  terraform-init    Initialize Terraform
  terraform-plan    Plan infrastructure changes
  terraform-apply   Apply infrastructure changes
  terraform-destroy Destroy all infrastructure

${BLUE}Ansible Commands:${NC}
  deploy            Deploy/update all services via Ansible
  config            Update configuration only
  api               Restart Control API
  dashboard         Restart Dashboard
  nginx             Update Nginx configuration
  migrate           Run database migrations
  
${BLUE}Maintenance Commands:${NC}
  status            Check all services health
  backup            Backup PostgreSQL + workspace files
  ssh               SSH to server
  logs              View server logs
  build-openclaw    Build OpenClaw image from source
  
${BLUE}Destructive Commands:${NC}
  destroy           Tear down everything (DESTRUCTIVE)

${BLUE}Examples:${NC}
  ./deploy.sh init              # Initial setup
  ./deploy.sh status            # Check health
  ./deploy.sh api               # Restart API only
  ./deploy.sh backup            # Create backup

${YELLOW}Note:${NC} Make sure .env is configured before running any commands.
EOF
}

# Main command router
case "${1:-help}" in
    init)             cmd_init ;;
    full)             cmd_full ;;
    terraform-init)   cmd_terraform_init ;;
    terraform-plan)   cmd_terraform_plan ;;
    terraform-apply)  cmd_terraform_apply ;;
    terraform-destroy) cmd_terraform_destroy ;;
    deploy)           cmd_ansible_deploy ;;
    config)           cmd_config ;;
    api)              cmd_api ;;
    dashboard)        cmd_dashboard ;;
    nginx)            cmd_nginx ;;
    migrate)          cmd_ansible_migrate ;;
    status)           cmd_ansible_status ;;
    backup)           cmd_ansible_backup ;;
    ssh)              cmd_ssh ;;
    logs)             cmd_logs ;;
    build-openclaw)   cmd_build_openclaw ;;
    destroy)          cmd_destroy ;;
    help|--help|-h)   cmd_help ;;
    *)
        log_error "Unknown command: $1"
        cmd_help
        exit 1
        ;;
esac
