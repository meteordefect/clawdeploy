#!/usr/bin/env bash
# Install Team9 - collaborative workspace for AI agents (OpenClaw ecosystem)
# https://github.com/team9ai/team9
#
# Requires: Node.js 18+, pnpm 8+, Docker, Docker Compose
# Usage: ./install-team9.sh [install_dir]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_DIR="${1:-$(cd "$DEPLOY_DIR/.." && pwd)/team9}"
TEAM9_REPO="https://github.com/team9ai/team9.git"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Generate secure random string
rand_str() { openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | xxd -p | tr -d '\n'; }

# Check prerequisites
check_prereqs() {
    log_info "Checking prerequisites..."
    command -v node >/dev/null 2>&1 || { log_error "Node.js required. Install: https://nodejs.org/"; exit 1; }
    command -v pnpm >/dev/null 2>&1 || { log_error "pnpm required. Install: npm install -g pnpm"; exit 1; }
    command -v docker >/dev/null 2>&1 || { log_error "Docker required."; exit 1; }
    command -v openssl >/dev/null 2>&1 || { log_error "OpenSSL required for JWT key generation."; exit 1; }
    log_success "Prerequisites OK"
}

# Clone or update Team9
clone_team9() {
    if [ -d "$INSTALL_DIR" ]; then
        log_info "Team9 already at $INSTALL_DIR, pulling latest..."
        (cd "$INSTALL_DIR" && git pull origin main 2>/dev/null || true)
    else
        log_info "Cloning Team9 to $INSTALL_DIR..."
        git clone --depth 1 "$TEAM9_REPO" "$INSTALL_DIR"
    fi
    # Ensure docker compose file exists (shallow clone can miss it; re-clone if needed)
    if [ ! -f "$INSTALL_DIR/docker/docker-compose.yml" ]; then
        log_warn "docker/docker-compose.yml missing, re-cloning without depth limit..."
        rm -rf "$INSTALL_DIR"
        git clone "$TEAM9_REPO" "$INSTALL_DIR"
    fi
    log_success "Team9 at $INSTALL_DIR"
}

# Create .env for Team9
setup_env() {
    local env_file="$INSTALL_DIR/.env"
    local docker_env="$INSTALL_DIR/docker/.env"

    if [ -f "$env_file" ] && [ -f "$docker_env" ]; then
        log_info ".env already exists"
        # Patch missing DB_HOST/DB_PORT for Drizzle migrations (common if .env was created before we added them)
        if ! grep -q '^DB_HOST=' "$env_file"; then
            log_info "Patching missing DB_HOST/DB_PORT in .env"
            printf '\nDB_HOST=localhost\nDB_PORT=5432\n' >> "$env_file"
        fi
        # Drizzle loads from apps/server/.env (../../.env from libs/database) - must stay in sync
        if [ -d "$INSTALL_DIR/apps/server" ]; then
            cp "$env_file" "$INSTALL_DIR/apps/server/.env"
        fi
        return
    fi

    log_info "Generating secrets and .env..."

    PG_USER="${TEAM9_POSTGRES_USER:-team9}"
    PG_PASS="${TEAM9_POSTGRES_PASSWORD:-$(rand_str)}"
    PG_DB="${TEAM9_POSTGRES_DB:-team9}"
    REDIS_PASS="${TEAM9_REDIS_PASSWORD:-$(rand_str)}"
    RABBIT_PASS="${TEAM9_RABBITMQ_PASSWORD:-$(rand_str)}"
    S3_KEY="${TEAM9_S3_ACCESS_KEY:-admin}"
    S3_SECRET="${TEAM9_S3_SECRET:-$(rand_str)}"
    BOT_PASS="${TEAM9_SYSTEM_BOT_PASSWORD:-$(rand_str)}"

    # Generate JWT keys
    local tmpdir
    tmpdir=$(mktemp -d)
    trap "rm -rf '$tmpdir'" EXIT
    openssl ecparam -name prime256v1 -genkey -noout -out "$tmpdir/priv.pem" 2>/dev/null
    openssl ec -in "$tmpdir/priv.pem" -pubout -out "$tmpdir/pub.pem" 2>/dev/null
    openssl ecparam -name prime256v1 -genkey -noout -out "$tmpdir/priv_refresh.pem" 2>/dev/null
    openssl ec -in "$tmpdir/priv_refresh.pem" -pubout -out "$tmpdir/pub_refresh.pem" 2>/dev/null

    JWT_PRIVATE=$(sed ':a;N;$!ba;s/\n/\\n/g' "$tmpdir/priv.pem")
    JWT_PUBLIC=$(sed ':a;N;$!ba;s/\n/\\n/g' "$tmpdir/pub.pem")
    JWT_REFRESH_PRIVATE=$(sed ':a;N;$!ba;s/\n/\\n/g' "$tmpdir/priv_refresh.pem")
    JWT_REFRESH_PUBLIC=$(sed ':a;N;$!ba;s/\n/\\n/g' "$tmpdir/pub_refresh.pem")

    # Docker compose .env (infra)
    mkdir -p "$(dirname "$docker_env")"
    cat > "$docker_env" << EOF
# Team9 Docker infrastructure - auto-generated
POSTGRES_USER=$PG_USER
POSTGRES_PASSWORD=$PG_PASS
POSTGRES_DB=$PG_DB
REDIS_PASSWORD=$REDIS_PASS
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=$RABBIT_PASS
S3_ACCESS_KEY=$S3_KEY
S3_SECRET_ACCESS_KEY=$S3_SECRET
EOF

    # Application .env (root - used by pnpm commands)
    cat > "$env_file" << EOF
# Team9 Application - auto-generated
# Add OPENAI_API_KEY, ANTHROPIC_API_KEY, etc. for AI features

GATEWAY_PORT=3000
IM_WORKER_PORT=3011
IM_WORKER_GRPC_URL=localhost:3011
EDITION=community

POSTGRES_USER=$PG_USER
POSTGRES_PASSWORD=$PG_PASS
POSTGRES_DB=$PG_DB
DB_HOST=localhost
DB_PORT=5432
DATABASE_URL=postgresql://$PG_USER:$PG_PASS@localhost:5432/$PG_DB

REDIS_HOST=localhost
REDIS_PASSWORD=$REDIS_PASS
REDIS_PORT=6379
REDIS_URL=redis://:$REDIS_PASS@localhost:6379

RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=$RABBIT_PASS
RABBITMQ_VHOST=/
RABBITMQ_URL=amqp://admin:$RABBIT_PASS@localhost:5672

S3_REGION=us-east-1
S3_ACCESS_KEY=$S3_KEY
S3_SECRET_ACCESS_KEY=$S3_SECRET
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=team9
S3_USE_SSL=false

JWT_PRIVATE_KEY="$JWT_PRIVATE"
JWT_PUBLIC_KEY="$JWT_PUBLIC"
JWT_REFRESH_PRIVATE_KEY="$JWT_REFRESH_PRIVATE"
JWT_REFRESH_PUBLIC_KEY="$JWT_REFRESH_PUBLIC"

SYSTEM_BOT_ENABLED=true
SYSTEM_BOT_USERNAME=moltbot
SYSTEM_BOT_PASSWORD=$BOT_PASS
SYSTEM_BOT_DISPLAY_NAME=Moltbot
EOF

    # Reuse LLM keys from ClawDeploy .env if present (deploy/.env or /opt/clawdeploy/.env)
    local clawdeploy_env=""
    for candidate in "$DEPLOY_DIR/.env" "/opt/clawdeploy/.env"; do
        if [ -f "$candidate" ]; then
            clawdeploy_env="$candidate"
            break
        fi
    done
    if [ -n "$clawdeploy_env" ]; then
        log_info "Reusing LLM config from $clawdeploy_env"
        {
            echo ""
            echo "# LLM config (reused from ClawDeploy)"
            grep -E '^(ZHIPU_API_KEY|MOONSHOT_API_KEY|OPENAI_API_KEY|OPENAI_BASE_URL|OPENCLAW_MODEL|ANTHROPIC_API_KEY|GOOGLE_API_KEY|OPENROUTER_API_KEY)=' "$clawdeploy_env" 2>/dev/null || true
        } >> "$env_file"
    else
        echo "" >> "$env_file"
        echo "# Add OPENAI_API_KEY, ANTHROPIC_API_KEY, etc. for AI features" >> "$env_file"
    fi

    # Copy to apps/server for NestJS
    if [ -d "$INSTALL_DIR/apps/server" ]; then
        cp "$env_file" "$INSTALL_DIR/apps/server/.env"
    fi

    log_success ".env created"
}

# Start Docker infrastructure
start_infra() {
    log_info "Starting PostgreSQL, Redis, RabbitMQ, MinIO..."
    local compose_file="$INSTALL_DIR/docker/docker-compose.yml"
    local env_file="$INSTALL_DIR/docker/.env"
    if [ ! -f "$compose_file" ]; then
        log_error "Compose file not found: $compose_file"
        exit 1
    fi
    if [ ! -f "$env_file" ]; then
        log_error "Docker .env not found: $env_file"
        exit 1
    fi
    (unset COMPOSE_FILE COMPOSE_PATH; cd "$INSTALL_DIR/docker" && docker compose -f docker-compose.yml --env-file .env up -d)
    log_info "Waiting for services (30s)..."
    sleep 30
    log_success "Infrastructure ready"
}

# Install dependencies and run migrations
setup_app() {
    log_info "Installing dependencies (pnpm)..."
    (cd "$INSTALL_DIR" && pnpm install)
    log_info "Running database migrations..."
    (cd "$INSTALL_DIR" && pnpm db:migrate)
    log_success "App setup complete"
}

# Main
main() {
    echo ""
    log_info "Team9 Install - https://github.com/team9ai/team9"
    log_info "Install directory: $INSTALL_DIR"
    echo ""

    check_prereqs
    clone_team9
    setup_env
    start_infra
    setup_app

    echo ""
    log_success "Team9 installed successfully!"
    echo ""
    echo "  Start development:"
    echo "    cd $INSTALL_DIR"
    echo "    pnpm dev"
    echo ""
    echo "  Then open: http://localhost:5173"
    echo ""
    echo "  Credentials saved in: $INSTALL_DIR/.env"
    echo ""
}

main "$@"
