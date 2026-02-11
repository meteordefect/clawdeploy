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
┌─────────────────────────────────────────────────────────┐
│  Hetzner VPS (Ubuntu 24.04) — Control Plane             │
│                                                         │
│  Nginx (80/443) → Dashboard (3000) + Control API (3001)│
│                ↓                                        │
│           PostgreSQL (5432)                             │
└─────────────────────────────────────────────────────────┘
         ↑ Agents poll via HTTPS          ↑
    ┌────┴─────┐   ┌────┴─────┐   ┌────┴─────┐
    │ Agent A  │   │ Agent B  │   │ Agent C  │
    │ OpenClaw │   │ OpenClaw │   │ OpenClaw │
    └──────────┘   └──────────┘   └──────────┘
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

4. **Deploy**
   ```bash
   ./deploy.sh init
   ```

This will:
- Provision a Hetzner VPS
- Install Docker, PostgreSQL, Nginx
- Deploy Control API and Dashboard
- Set up basic authentication
- Run database migrations

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
├── SPEC.md                    # Architecture specification
├── RUNSHEET.md                # Migration guide
├── README.md                  # This file
├── openclaw-source/           # OpenClaw source (git submodule)
└── deploy/
    ├── deploy.sh              # Main deployment script
    ├── .env.example           # Environment template
    ├── docker-compose.yml     # Service definitions
    ├── control-api/           # Control API (Node.js + Express + PostgreSQL)
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── db/
    │   │   ├── migrations/
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
    ├── terraform/             # Infrastructure as Code
    │   ├── main.tf
    │   └── terraform.tfvars.example
    └── ansible/               # Configuration management
        ├── playbooks/
        │   ├── site.yml
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
./deploy.sh init              # Fresh VPS → fully running control plane
./deploy.sh full              # Terraform + full Ansible redeploy
```

### Service Management
```bash
./deploy.sh deploy            # Deploy/update all services
./deploy.sh api               # Restart Control API only
./deploy.sh dashboard         # Restart Dashboard only
./deploy.sh nginx             # Update Nginx config
./deploy.sh migrate           # Run database migrations
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

## Agent Setup

ClawDeploy agents use **Kimi K2.5 from Moonshot AI** as the LLM provider.

For detailed agent setup instructions, see **[AGENT_CONFIG.md](AGENT_CONFIG.md)**.

### Quick Setup

1. **Register the agent**
   ```bash
   curl -X POST https://your-domain.com/api/agents/register \
     -H "Content-Type: application/json" \
     -d '{"name": "Agent A", "description": "Production agent"}'
   ```

   Response:
   ```json
   {
     "agent_id": "uuid",
     "token": "bearer-token",
     "name": "Agent A",
     "status": "offline"
   }
   ```

2. **Configure agent** (on remote server)
   ```bash
   # .env
   CONTROL_API_URL=https://your-domain.com/api
   AGENT_TOKEN=bearer-token-from-registration
   
   # LLM Configuration - Using Kimi K2.5 from Moonshot AI
   MOONSHOT_API_KEY=your-moonshot-api-key
   OPENCLAW_MODEL=moonshot/kimi-k2.5
   ```

3. **Deploy agent** (Phase 5 - implementation pending)
   ```bash
   docker run -d --env-file .env openclaw-agent:latest
   ```

See **[AGENT_CONFIG.md](AGENT_CONFIG.md)** for complete configuration options, troubleshooting, and best practices.

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
- **[AGENT_CONFIG.md](AGENT_CONFIG.md)** - Complete agent configuration guide
- **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Deployment verification
- **[SPEC.md](SPEC.md)** - Architecture specification
- **[RUNSHEET.md](RUNSHEET.md)** - Migration guide

## Support

- **Issues**: https://github.com/your-org/clawdeploy/issues
- **Moonshot AI**: https://platform.moonshot.cn/docs
- **Email**: marten@friendlabs.ai

---

**Last Updated**: February 11, 2026  
**Version**: 3.0  
**Maintainer**: Marten (Friend Labs)
# clawdeploy
