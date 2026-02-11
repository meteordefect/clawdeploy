# ClawDeploy - Specification

**Version:** 3.0  
**Date:** February 11, 2026  
**Status:** Active Development

---

## Overview

ClawDeploy is a self-hosted control plane for managing one or more remote OpenClaw AI agent instances. It provides a password-protected dashboard, a PostgreSQL-backed Control API, and a pull-based heartbeat model where agents poll for instructions — the dashboard never pushes to agents, and agents never connect to the dashboard.

### Design Principles

1. **Pull, not push** — Agents poll the Control API on a heartbeat. No inbound connections to agents.
2. **PostgreSQL is truth** — All state lives in PostgreSQL: missions, commands, agent registrations, results, events.
3. **Dashboard writes intent** — The dashboard creates missions and queues commands. It never talks to agents.
4. **Agents execute and report** — Agents pick up commands, execute them via OpenClaw, and POST results back.
5. **Repeatable from zero** — One `./deploy.sh init` takes a bare Hetzner VPS to a fully running control plane.
6. **Pin or pull** — OpenClaw source can be pinned to a tag for stability or pulled to `main` for latest security patches.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Hetzner VPS (Ubuntu 24.04) — Control Plane             │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Nginx (Port 80/443)                              │  │
│  │  - Basic Auth (.htpasswd)                         │  │
│  │  - SSL via Certbot (optional)                     │  │
│  │  - Routes / → Dashboard, /api/ → Control API      │  │
│  └────────┬──────────────────────────────────────────┘  │
│           │                                              │
│  ┌────────┴──────────────────────────────────────────┐  │
│  │  Dashboard (React + Vite, Port 3000)              │  │
│  │  - Polls Control API only                         │  │
│  │  - Creates missions, views agent status           │  │
│  │  - No WebSocket, no direct agent connection       │  │
│  └────────┬──────────────────────────────────────────┘  │
│           │                                              │
│  ┌────────┴──────────────────────────────────────────┐  │
│  │  Control API (Node.js + Express, Port 3001)       │  │
│  │  - Single API surface for dashboard + agents      │  │
│  │  - Mission & command management                   │  │
│  │  - Agent registration & heartbeat                 │  │
│  │  - Workspace file browsing (absorbed File API)    │  │
│  │  - Connects to PostgreSQL                         │  │
│  └────────┬──────────────────────────────────────────┘  │
│           │                                              │
│  ┌────────┴──────────────────────────────────────────┐  │
│  │  PostgreSQL 16 (Port 5432, internal only)         │  │
│  │  - Agents, missions, commands, results, events    │  │
│  │  - Single source of truth                         │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  OpenClaw Data Volume (~/.openclaw/)              │  │
│  │  - Workspace files (SOUL.md, AGENTS.md, etc.)     │  │
│  │  - Sessions, config                               │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘

         ▲ Agents poll (HTTPS)          ▲
         │                              │
    ┌────┴─────┐   ┌────┴─────┐   ┌────┴─────┐
    │ Agent A  │   │ Agent B  │   │ Agent C  │
    │ (Remote) │   │ (Remote) │   │ (Remote) │
    │ OpenClaw │   │ OpenClaw │   │ OpenClaw │
    └──────────┘   └──────────┘   └──────────┘

    Each agent:
    - Registers with Control API (once)
    - Heartbeats every N seconds (GET /api/agents/heartbeat)
    - Polls for pending commands (GET /api/commands/pending)
    - Executes via OpenClaw runtime
    - Reports results (POST /api/commands/:id/result)
```

---

## Components

### 1. Control API

The single API surface. Replaces the old File API. Both the dashboard and agents talk to this service.

- **Port**: 3001 (internal), exposed via Nginx at `/api/`
- **Technology**: Node.js + Express + TypeScript
- **Database**: PostgreSQL 16 (via `pg` or Drizzle ORM)
- **Auth**: Agent token (for agents), Nginx basic auth pass-through (for dashboard)

#### Endpoints — Agent-facing

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/agents/register` | Register a new agent (returns agent_id + token) |
| `POST` | `/api/agents/heartbeat` | Agent heartbeat — updates last_seen, reports health |
| `GET` | `/api/commands/pending` | Poll for commands assigned to this agent |
| `POST` | `/api/commands/:id/accept` | Agent accepts a command (sets status → running) |
| `POST` | `/api/commands/:id/result` | Agent posts result (sets status → completed/failed) |

#### Endpoints — Dashboard-facing

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Control API + DB health check |
| `GET` | `/api/agents` | List all registered agents with status |
| `GET` | `/api/agents/:id` | Agent detail (last heartbeat, health, commands) |
| `POST` | `/api/missions` | Create a new mission |
| `GET` | `/api/missions` | List missions (with filters) |
| `GET` | `/api/missions/:id` | Mission detail with commands and results |
| `POST` | `/api/missions/:id/commands` | Queue a command for a mission |
| `GET` | `/api/commands` | List all commands (filterable by status, agent) |
| `GET` | `/api/events` | Event log / audit trail |

#### Endpoints — Workspace Files (absorbed from File API)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/files` | List workspace files |
| `GET` | `/api/files/:path(*)` | Read file content |
| `PUT` | `/api/files/:path(*)` | Update file content |
| `GET` | `/api/sessions` | List sessions |
| `GET` | `/api/sessions/:id` | Get session transcript |

### 2. Dashboard

Password-protected React web UI. Talks only to the Control API. Never connects to agents.

- **Port**: 3000 (internal), exposed via Nginx at `/`
- **Technology**: React 19 + TypeScript + Vite + TailwindCSS
- **Auth**: Nginx basic auth (browser-native prompt)
- **Data**: Polls Control API at regular intervals

#### Views

| View | Purpose |
|------|---------|
| **Overview** | Agent count, mission stats, recent activity, system health |
| **Agents** | List of registered agents, last heartbeat, health status, online/offline |
| **Missions** | Create missions, view command queue, see results |
| **Files** | Browse and edit workspace files (SOUL.md, AGENTS.md, etc.) |
| **Sessions** | View session transcripts |
| **Events** | Audit log of all system events |
| **Settings** | System configuration |

### 3. PostgreSQL

Single source of truth for all control plane state.

- **Port**: 5432 (internal only, not exposed to internet)
- **Version**: 16
- **Container**: Official `postgres:16-alpine` Docker image
- **Data**: Persistent Docker volume (`postgres-data`)

#### Schema

```sql
-- Agents: remote OpenClaw instances that check in
CREATE TABLE agents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    token           TEXT NOT NULL UNIQUE,          -- bearer token for auth
    description     TEXT,
    last_heartbeat  TIMESTAMPTZ,
    health          JSONB DEFAULT '{}',            -- free-form health data from agent
    status          TEXT NOT NULL DEFAULT 'offline', -- online, offline, stale
    ip_address      INET,
    openclaw_version TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Missions: high-level objectives created by the dashboard
CREATE TABLE missions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'pending', -- pending, active, completed, failed, cancelled
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Commands: individual tasks assigned to agents
CREATE TABLE commands (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id      UUID REFERENCES missions(id) ON DELETE CASCADE,
    agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
    type            TEXT NOT NULL,                  -- e.g. 'chat', 'execute', 'file_read', 'custom'
    payload         JSONB NOT NULL DEFAULT '{}',   -- command-specific data
    status          TEXT NOT NULL DEFAULT 'pending', -- pending, assigned, running, completed, failed
    priority        INTEGER NOT NULL DEFAULT 0,
    result          JSONB,                          -- response from agent
    assigned_at     TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Events: audit trail
CREATE TABLE events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            TEXT NOT NULL,                  -- agent.registered, agent.heartbeat, command.created, etc.
    agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
    mission_id      UUID REFERENCES missions(id) ON DELETE SET NULL,
    command_id      UUID REFERENCES commands(id) ON DELETE SET NULL,
    data            JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_commands_status ON commands(status);
CREATE INDEX idx_commands_agent_status ON commands(agent_id, status);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_created_at ON events(created_at);
```

### 4. Nginx Reverse Proxy

- **Port**: 80 (HTTP), 443 (HTTPS optional)
- **Auth**: HTTP Basic Authentication via `.htpasswd`
- **Routes**:
  - `/` → Dashboard (3000)
  - `/api/` → Control API (3001)
  - `/api/agents/register` → Control API (no basic auth — agent token auth instead)
  - `/api/agents/heartbeat` → Control API (no basic auth — agent token auth)
  - `/api/commands/pending` → Control API (no basic auth — agent token auth)
  - `/api/commands/*/accept` → Control API (no basic auth — agent token auth)
  - `/api/commands/*/result` → Control API (no basic auth — agent token auth)

Agent-facing endpoints bypass Nginx basic auth and use bearer token auth at the Control API level instead.

### 5. OpenClaw Source

- **Location**: `openclaw-source/` (git clone or submodule)
- **Strategy**: `deploy.sh` can `git pull origin main` for latest, or `git checkout v1.2.3` to pin
- **Build**: Docker image built from source during deploy
- **Usage**: The built image is what remote agents run. It is not part of the control plane containers.
- **Config**: `OPENCLAW_VERSION` env var in `.env` — set to `latest` or a git tag

---

## Data Flow

### Creating a Mission (Dashboard → PostgreSQL → Agent)

```
1. User clicks "New Mission" in Dashboard
2. Dashboard POSTs to /api/missions
3. Control API inserts mission row in PostgreSQL
4. User queues commands for the mission (POST /api/missions/:id/commands)
5. Commands inserted with status = 'pending', optionally assigned to a specific agent

--- time passes ---

6. Agent heartbeats (POST /api/agents/heartbeat)
7. Agent polls (GET /api/commands/pending)
8. Control API returns pending commands for this agent
9. Agent accepts command (POST /api/commands/:id/accept → status = 'running')
10. Agent executes via OpenClaw runtime
11. Agent posts result (POST /api/commands/:id/result → status = 'completed')
12. Dashboard polls /api/missions/:id and sees updated results
```

### Agent Heartbeat Lifecycle

```
1. Agent starts → POST /api/agents/register (first time) or /api/agents/heartbeat
2. Every 30s → POST /api/agents/heartbeat { health: {...}, openclaw_version: "..." }
3. Control API updates last_heartbeat, sets status = 'online'
4. If no heartbeat for 90s → status = 'stale'
5. If no heartbeat for 300s → status = 'offline'
```

---

## Security

### Authentication Layers

| Surface | Auth Method |
|---------|-------------|
| Dashboard (browser) | Nginx HTTP Basic Auth (.htpasswd) |
| Dashboard → Control API | Pass-through (same Nginx auth) |
| Agent → Control API | Bearer token (per-agent, stored in `agents.token`) |

### Network Security

- PostgreSQL port (5432) is **not exposed** — internal Docker network only
- Firewall: only ports 22, 80, 443 open
- Agent endpoints bypass Nginx basic auth but require bearer token
- All agent tokens are generated server-side during registration

---

## Docker Compose Services

| Service | Image | Port | Depends On |
|---------|-------|------|------------|
| `postgres` | `postgres:16-alpine` | 5432 (internal) | — |
| `control-api` | Built from `deploy/control-api/` | 3001 | postgres |
| `dashboard` | Built from `deploy/dashboard/` | 3000 | control-api |

Note: OpenClaw Gateway is **not** part of the control plane stack. It runs on remote agent servers.

---

## OpenClaw Version Management

```bash
# In .env
OPENCLAW_VERSION=latest          # pulls main branch
# or
OPENCLAW_VERSION=v1.5.2          # pins to a specific tag

# deploy.sh handles this:
cd openclaw-source
if [ "$OPENCLAW_VERSION" = "latest" ]; then
    git pull origin main
else
    git fetch --tags
    git checkout "$OPENCLAW_VERSION"
fi
docker build -t openclaw/openclaw:$OPENCLAW_VERSION .
```

The built image can be pushed to a private registry or transferred to agent servers via `docker save`/`docker load`, SCP, or a registry.

---

## Environment Variables

### Control Plane (.env)

```bash
# PostgreSQL
POSTGRES_USER=clawdeploy
POSTGRES_PASSWORD=<generated>
POSTGRES_DB=clawdeploy
DATABASE_URL=postgresql://clawdeploy:<password>@postgres:5432/clawdeploy

# Dashboard auth (Nginx basic auth)
BETA_USER=openclaw
BETA_PASSWORD=<generated>

# Domain
DOMAIN=<your-domain.com or VPS IP>

# OpenClaw version to build
OPENCLAW_VERSION=latest
```

### Agent (.env on remote servers)

```bash
# Control plane URL
CONTROL_API_URL=https://your-domain.com/api

# Agent credentials (from registration)
AGENT_TOKEN=<token from /api/agents/register>

# LLM Provider - Using Kimi K2.5 from Moonshot AI
MOONSHOT_API_KEY=<your-moonshot-api-key>

# OpenClaw config
OPENCLAW_MODEL=moonshot/kimi-k2.5
```

---

## Deployment

### Infrastructure as Code

- **Terraform**: Hetzner VPS provisioning (same as v2, simplified firewall — only 22, 80, 443)
- **Ansible**: Configuration management, Docker install, service deployment
- **deploy.sh**: Unified deployment script

### Deploy Commands

```bash
./deploy.sh init         # Fresh VPS → fully running control plane
./deploy.sh full         # Terraform plan + full Ansible redeploy
./deploy.sh config       # Update configs only (Ansible)
./deploy.sh api          # Update Control API only
./deploy.sh dashboard    # Update Dashboard only
./deploy.sh nginx        # Update Nginx only
./deploy.sh db-migrate   # Run database migrations
./deploy.sh build-openclaw # Build OpenClaw image from source
./deploy.sh ssh          # SSH to server
./deploy.sh logs         # View server logs
./deploy.sh status       # Check all services health
./deploy.sh backup       # Backup PostgreSQL + workspace files
./deploy.sh restore <file> # Restore from backup
./deploy.sh destroy      # Tear down (DESTRUCTIVE)
```

---

## UI Design

### Color Palette (unchanged from v2)

```css
--color-surface: #FAFAFA;
--color-card: #FFFFFF;
--color-accent-blue: #1E3A5F;
--color-status-done: #059669;
--color-status-waiting: #F59E0B;
```

### Typography

- **Sans-serif**: Inter (UI, body text)
- **Serif**: Playfair Display (headings)

### Layout

- **Sidebar**: Fixed left, 240px wide (desktop)
- **Bottom nav**: Mobile
- **Main Content**: Fluid, max-width 1400px

---

## Monitoring

### Health Endpoints

```bash
# Control API + DB health
curl http://<SERVER_IP>/api/health

# Dashboard
curl http://<SERVER_IP>/
```

### Agent Health

Visible in the dashboard Agents view. Each agent reports:
- Last heartbeat timestamp
- OpenClaw version
- Free-form health JSON (CPU, memory, disk, active sessions, etc.)
- Status: online / stale / offline

---

## Roadmap

### Phase 1: Control Plane (Current)
- [ ] PostgreSQL schema + migrations
- [ ] Control API (agent endpoints + dashboard endpoints + file endpoints)
- [ ] Dashboard rewrite (poll Control API, remove WebSocket)
- [ ] Updated docker-compose.yml (postgres + control-api + dashboard)
- [ ] Updated Terraform (simplified firewall)
- [ ] Updated Ansible (PostgreSQL, Control API, migrations)
- [ ] Updated deploy.sh

### Phase 2: Agent SDK
- [ ] Agent-side heartbeat client (TypeScript module)
- [ ] Command executor integration with OpenClaw runtime
- [ ] Agent provisioning playbook (Ansible)
- [ ] Agent Docker image build pipeline

### Phase 3: Enhancements
- [ ] SSL/TLS via Let's Encrypt
- [ ] Command scheduling (cron-style)
- [ ] Mission templates
- [ ] Agent groups / tagging
- [ ] Webhook notifications on mission completion
- [ ] Usage analytics dashboard

---

**Last Updated**: February 11, 2026  
**Maintainer**: Marten (marten@friendlabs.ai)
