# ClawDeploy v3

**Self-hosted control plane for managing remote OpenClaw AI agent instances**

ClawDeploy v3 provides a PostgreSQL-backed, password-protected dashboard for orchestrating multiple remote OpenClaw agents via a pull-based heartbeat architecture.

## Features

- **Pull-based Architecture** - Agents poll the control plane for commands; no inbound connections to agents
- **PostgreSQL State Management** - All missions, commands, agents, and events stored in PostgreSQL 16
- **Password-Protected Dashboard** - React web UI with Nginx basic auth
- **Agent Registration & Heartbeat** - Automatic agent status tracking (online/stale/offline)
- **Mission & Command Queue** - Create missions, queue commands, track execution
- **Workspace File Management** - Browse and edit OpenClaw config files
- **Event Audit Trail** - Complete history of all system events
- **One-Command Deploy** - `./deploy.sh init` takes a bare VPS to full production

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Hetzner VPS (Ubuntu 24.04) — Control Plane                 │
│                                                             │
│  Nginx (80/443) → Dashboard (3000) + Control API (3001)    │
│                        ↓                                    │
│                   PostgreSQL (5432)                         │
│                        ↑                                    │
│                   Agent Bridge (optional, same server)      │
│                        ↓                                    │
│                   OpenClaw Gateway                          │
└─────────────────────────────────────────────────────────────┘
              ↑ HTTP/HTTPS polling
    ┌─────────┴──────────┐   ┌─────────────────┐
    │ Agent Bridge       │   │ Agent Bridge    │
    │ (Different Server) │   │ (Another Server)│
    └────────────────────┘   └─────────────────┘
```

## Quick Start

### Prerequisites

- Hetzner Cloud account with API token
- SSH key pair
- Domain name (optional, can use IP)
- Local machine with:
  - Terraform >= 1.0
  - Ansible >= 2.15
  - Docker (for building OpenClaw images)

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone --recursive https://github.com/your-org/clawdeploy.git
   cd clawdeploy/deploy
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   vim .env
   ```
   
   Edit `.env` and set:
   - `POSTGRES_PASSWORD` - Generate using the command in the file
   - `BETA_PASSWORD` - Generate using the command in the file
   - `DATABASE_URL` - Update with your `POSTGRES_PASSWORD`
   - `DOMAIN` - Your domain or server IP

3. **Configure Terraform**
   ```bash
   cd terraform
   cp terraform.tfvars.example terraform.tfvars
   vim terraform.tfvars
   # Set: hcloud_token, ssh_public_key
   cd ..
   ```

4. **Deploy Control Plane**
   ```bash
   ./deploy.sh init
   ```

This will:
- Provision a Hetzner VPS
- Install Docker, PostgreSQL, Nginx
- Deploy Control API and Dashboard
- Set up basic authentication
- Run database migrations

5. **Deploy Agent Bridge (Optional)**
   
   Deploy agent bridge to the **same VPS** as control plane:
   ```bash
   ./deploy.sh agent-bridge-deploy
   ```
   
   Or deploy on a **different server** (copy agent-bridge folder and configure `.env`):
   ```bash
   # On target machine:
   cd agent-bridge
   cp .env.example .env
   # Edit .env: set CONTROL_API_URL to your VPS
   docker compose --profile agent-bridge up -d
   ```

### Access the Dashboard

After deployment:
```
URL: http://YOUR_SERVER_IP
Username: (from .env BETA_USER)
Password: (from .env BETA_PASSWORD)
```

## Project Structure

```
clawdeploy/
├── README.md                  # This file
├── DESIGN.md                  # Design reference
├── QUICK_START.md             # Quick start guide
├── CHANGELOG.md               # Version history
├── DEPLOY_READY.md            # Deployment checklist
├── docs/                      # Documentation
│   ├── guides/
│   │   └── AGENT_CONFIG.md    # Agent configuration guide
│   └── archive/               # Implementation history
├── openclaw-source/           # OpenClaw source (git submodule)
└── deploy/
    ├── deploy.sh              # Main deployment script
    ├── .env.example           # Environment template
    ├── docker-compose.yml     # Service definitions
    ├── control-api/           # Control API (Node.js + Express + PostgreSQL)
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── db/
    │   │   ├── routes/
    │   │   ├── middleware/
    │   │   └── lib/
    │   ├── package.json
    │   └── Dockerfile
    ├── dashboard/             # Dashboard (React + TypeScript + Vite + Tailwind)
    │   ├── src/
    │   │   ├── App.tsx
    │   │   ├── api/
    │   │   ├── components/
    │   │   ├── views/
    │   │   ├── hooks/
    │   │   └── types.ts
    │   ├── package.json
    │   └── Dockerfile
    ├── agent-bridge/          # Agent Bridge (TypeScript + Node)
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── config.ts
    │   │   ├── control-api-client.ts
    │   │   ├── heartbeat.ts
    │   │   ├── command-poller.ts
    │   │   └── skills-parser.ts
    │   ├── package.json
    │   └── Dockerfile
    ├── terraform/             # Infrastructure as Code
    │   ├── main.tf
    │   └── terraform.tfvars.example
    └── ansible/               # Configuration management
        ├── playbooks/
        │   ├── site.yml
        │   ├── agent-bridge.yml
        │   ├── db-migrate.yml
        │   ├── backup.yml
        │   └── status.yml
        ├── templates/
        │   └── nginx.conf.j2
        ├── group_vars/
        └── inventory.ini.example
```

## Deployment Commands

### Setup
```bash
./deploy.sh init                     # Fresh VPS → control plane + database
./deploy.sh full                     # Terraform + full Ansible redeploy
```

### Agent Bridge - Same Server (VPS)
```bash
./deploy.sh agent-bridge-deploy      # Deploy agent bridge to VPS
./deploy.sh agent-bridge-remote-logs # View agent bridge logs on VPS
./deploy.sh agent-bridge-remote-status # Check agent status on VPS
```

### Agent Bridge - Local/Different Server
```bash
./deploy.sh agent-bridge-build       # Build agent bridge image (local)
./deploy.sh agent-bridge-start       # Start agent bridge (local)
./deploy.sh agent-bridge-stop        # Stop agent bridge
./deploy.sh agent-bridge-logs        # View logs (local)
./deploy.sh agent-bridge-status      # Check status (local)
```

### Service Management
```bash
./deploy.sh deploy            # Deploy/update all services
./deploy.sh api               # Restart Control API only
./deploy.sh dashboard         # Restart Dashboard only
./deploy.sh nginx             # Update Nginx config
./deploy.sh migrate           # Run database migrations
./deploy.sh list-agents       # List all registered agents
```

### Maintenance
```bash
./deploy.sh status            # Check service health
./deploy.sh backup            # Backup database + files
./deploy.sh logs              # View logs
./deploy.sh ssh               # SSH to server
```

### OpenClaw
```bash
./deploy.sh build-openclaw    # Build OpenClaw image from source
```

## Configuration

### Environment Variables

See `.env.example` for all available options:

```bash
# PostgreSQL
POSTGRES_USER=clawdeploy
POSTGRES_PASSWORD=CHANGE_ME
POSTGRES_DB=clawdeploy
DATABASE_URL=postgresql://...

# Dashboard Auth
BETA_USER=openclaw
BETA_PASSWORD=CHANGE_ME

# Domain
DOMAIN=your-domain.com

# OpenClaw Version
OPENCLAW_VERSION=latest
```

### Terraform Variables

See `terraform/terraform.tfvars.example`:

```hcl
hcloud_token = "your-hetzner-api-token"
ssh_public_key = "ssh-rsa AAAAB3..."
server_name = "clawdeploy-control-plane"
server_type = "cx22"
location = "nbg1"
```

## API Documentation

### Agent Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/agents/register` | Register new agent (returns token) |
| `POST` | `/api/agents/heartbeat` | Agent heartbeat + health data |
| `GET` | `/api/commands/pending` | Poll for pending commands |
| `POST` | `/api/commands/:id/accept` | Accept a command |
| `POST` | `/api/commands/:id/result` | Submit command result |

### Dashboard Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | System health check |
| `GET` | `/api/agents` | List all agents |
| `GET` | `/api/missions` | List all missions |
| `POST` | `/api/missions` | Create new mission |
| `POST` | `/api/missions/:id/commands` | Queue command |
| `GET` | `/api/events` | Event log |

All dashboard endpoints require Nginx basic auth. Agent endpoints use bearer token authentication.

## Database Schema

See `deploy/control-api/src/migrations/001_initial.sql` for the complete schema.

### Tables

- **agents** - Registered OpenClaw instances
- **missions** - High-level objectives
- **commands** - Individual tasks assigned to agents
- **events** - Audit trail of all system events

## Dashboard Views

- **Overview** - Agent status, mission stats, recent events
- **Agents** - Registered agents with health monitoring
- **Missions** - Create missions, queue commands, view results
- **Files** - Browse/edit workspace files (SOUL.md, AGENTS.md, etc.)
- **Sessions** - View OpenClaw session transcripts
- **Events** - System audit log
- **Settings** - System information

## Security

### Authentication

- **Dashboard**: Nginx HTTP Basic Auth
- **Agents**: Bearer token (generated during registration)

### Network

- PostgreSQL: Internal Docker network only (not exposed)
- Firewall: Only ports 22 (SSH), 80 (HTTP), 443 (HTTPS)
- Agent endpoints: Bypass basic auth, require bearer token

## Agent Bridge Setup

The **Agent Bridge** connects OpenClaw instances to your control plane. It handles:
- Agent registration with control plane
- Periodic heartbeats (keeps status online)
- Command polling and execution
- Skill discovery from OpenClaw

### Quick Setup

**Option A: Deploy on Same VPS (Recommended)**
```bash
cd deploy
./deploy.sh agent-bridge-deploy
```

The agent bridge will:
1. Register automatically with the control API
2. Send heartbeats every 30 seconds
3. Poll for commands every 5 seconds
4. Show as "online" in dashboard

**Option B: Deploy on Different Server**

1. Copy agent-bridge to target machine:
   ```bash
   scp -r deploy/agent-bridge/ user@target-machine:/path/to/
   ```

2. Configure on target machine:
   ```bash
   cd /path/to/agent-bridge
   cp .env.example .env
   nano .env
   ```
   
   Set:
   ```bash
   CONTROL_API_URL=http://YOUR_VPS_IP/api
   AGENT_NAME=Production Agent
   AGENT_DESCRIPTION=OpenClaw agent instance
   ```

3. Start agent bridge:
   ```bash
   docker compose --profile agent-bridge up -d
   ```

### Verify Agent Registration

```bash
# Check agent appears in dashboard
./deploy.sh list-agents

# View agent logs
./deploy.sh agent-bridge-remote-logs
```

See **[docs/guides/AGENT_CONFIG.md](docs/guides/AGENT_CONFIG.md)** for advanced configuration.

## Maintenance

### Backup & Restore

**Create backup:**
```bash
./deploy.sh backup
# Creates: ./backups/clawdeploy-backup-TIMESTAMP.tar.gz
```

**Restore:**
```bash
# SSH to server
ssh root@YOUR_SERVER_IP

# Stop services
cd /opt/clawdeploy && docker compose down

# Restore PostgreSQL dump
docker compose up -d postgres
docker exec -i clawdeploy-postgres psql -U clawdeploy < backup.sql

# Restore OpenClaw data
rm -rf /root/.openclaw
tar xzf backup.tar.gz -C /

# Restart services
docker compose up -d
```

### Logs

```bash
# From local machine
./deploy.sh logs

# Or SSH and view directly
ssh root@YOUR_SERVER_IP
cd /opt/clawdeploy
docker compose logs -f
```

### Health Monitoring

```bash
# Check all services
./deploy.sh status

# Check API directly
curl http://YOUR_SERVER_IP/api/health
```

## Troubleshooting

### Services won't start

```bash
./deploy.sh ssh
cd /opt/clawdeploy
docker compose ps
docker compose logs control-api
docker compose logs postgres
```

### Database connection issues

```bash
# Check PostgreSQL is running
docker exec clawdeploy-postgres pg_isready -U clawdeploy

# Verify DATABASE_URL in .env
grep DATABASE_URL /opt/clawdeploy/.env

# Run migrations manually
docker exec clawdeploy-control-api node dist/db/migrate.js
```

### Agent not appearing online

- Check agent is sending heartbeats every 30s
- Verify bearer token is correct
- Check agent status threshold (>90s = stale, >300s = offline)

## Cost Estimate

| Item | Cost |
|------|------|
| Hetzner CX22 (4GB RAM) | ~$6.50/month |
| Hetzner CX32 (8GB RAM) | ~$12.50/month |
| Kimi K2.5 LLM (per agent) | ~$45-65/month (100 tasks/day) |

See [AGENT_CONFIG.md](AGENT_CONFIG.md) for detailed cost estimates and optimization tips.

## Development

### Local Development

**Control API:**
```bash
cd deploy/control-api
npm install
npm run dev
```

**Dashboard:**
```bash
cd deploy/dashboard
npm install
npm run dev
```

### Running Tests

```bash
# Control API
cd deploy/control-api
npm test

# Dashboard
cd deploy/dashboard
npm test
```

## Roadmap

See `SPEC.md` for detailed roadmap.

### Phase 1: Control Plane ✓
- PostgreSQL schema
- Control API
- Dashboard
- Docker Compose setup
- Terraform & Ansible

### Phase 2: Agent SDK
- Agent heartbeat client
- Command executor
- Agent provisioning

### Phase 3: Enhancements
- SSL/TLS via Let's Encrypt
- Command scheduling
- Mission templates
- Webhook notifications

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Additional Documentation

- **[QUICK_START.md](QUICK_START.md)** - 5-step setup guide
- **[DESIGN.md](DESIGN.md)** - Design philosophy and visual reference
- **[DEPLOY_READY.md](DEPLOY_READY.md)** - Deployment readiness checklist
- **[docs/guides/AGENT_CONFIG.md](docs/guides/AGENT_CONFIG.md)** - Agent configuration guide
- **[docs/archive/](docs/archive/)** - Implementation history and planning docs

## Support

- **Issues**: https://github.com/your-org/clawdeploy/issues
- **Moonshot AI**: https://platform.moonshot.cn/docs
- **Email**: marten@friendlabs.ai

---

**Last Updated**: February 11, 2026  
**Version**: 3.0  
**Maintainer**: Marten (Friend Labs)
# clawdeploy
