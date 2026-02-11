# ClawDeploy v3 - Migration Runsheet

**Purpose**: Step-by-step guide to migrate from v2 (WebSocket/file-based) to v3 (pull-based heartbeat, PostgreSQL Control API).

**Prerequisites**: Existing v2 codebase in `clawdeploy/` with `deploy/`, `openclaw-source/`, and current Terraform/Ansible setup.

---

## Phase 1: Control API + PostgreSQL

> Replace the File API with a PostgreSQL-backed Control API that serves both the dashboard and remote agents.

### 1.1 Create the Control API service

**New directory**: `deploy/control-api/`

```
deploy/control-api/
├── src/
│   ├── index.ts              # Express app entry point
│   ├── db/
│   │   ├── client.ts         # PostgreSQL connection (pg Pool)
│   │   └── migrate.ts        # Migration runner
│   ├── migrations/
│   │   └── 001_initial.sql   # Schema: agents, missions, commands, events
│   ├── routes/
│   │   ├── agents.ts         # POST /register, POST /heartbeat
│   │   ├── commands.ts       # GET /pending, POST /:id/accept, POST /:id/result
│   │   ├── missions.ts       # CRUD missions + queue commands
│   │   ├── files.ts          # GET/PUT workspace files (from old File API)
│   │   ├── sessions.ts       # GET sessions (from old File API)
│   │   ├── events.ts         # GET events
│   │   └── health.ts         # GET /health (API + DB check)
│   ├── middleware/
│   │   └── agentAuth.ts      # Bearer token auth for agent endpoints
│   └── lib/
│       └── agentStatus.ts    # Heartbeat timeout logic (online/stale/offline)
├── package.json
├── tsconfig.json
└── Dockerfile
```

**Actions**:
- [ ] Create `deploy/control-api/` directory structure
- [ ] Write `package.json` with dependencies: `express`, `pg`, `cors`, `typescript`
- [ ] Write `001_initial.sql` migration with schema from SPEC.md
- [ ] Write `db/client.ts` — PostgreSQL pool using `DATABASE_URL` env var
- [ ] Write `db/migrate.ts` — reads SQL files from `migrations/`, executes in order
- [ ] Port file endpoints from `deploy/file-api/src/index.ts` → `routes/files.ts` and `routes/sessions.ts`
- [ ] Write `routes/agents.ts` — register, heartbeat
- [ ] Write `routes/commands.ts` — pending, accept, result
- [ ] Write `routes/missions.ts` — CRUD
- [ ] Write `routes/events.ts` — list with filters
- [ ] Write `routes/health.ts` — API + DB connectivity check
- [ ] Write `middleware/agentAuth.ts` — validates `Authorization: Bearer <token>` against `agents.token`
- [ ] Write `lib/agentStatus.ts` — marks agents stale (>90s) or offline (>300s) on heartbeat checks
- [ ] Write `Dockerfile` (multi-stage: build TypeScript → run with Node)
- [ ] Write `index.ts` entry point (Express app, mount routes, run migrations on startup)

### 1.2 Add PostgreSQL to docker-compose

**File**: `deploy/docker-compose.yml`

**Actions**:
- [ ] Add `postgres` service (image: `postgres:16-alpine`)
- [ ] Add `postgres-data` volume for persistence
- [ ] Replace `file-api` service with `control-api` service
- [ ] Update `control-api` to depend on `postgres` with healthcheck
- [ ] Remove `openclaw-gateway` service (agents run remotely now)
- [ ] Update dashboard service — remove `VITE_GATEWAY_WS_URL` and `VITE_GATEWAY_TOKEN` build args
- [ ] Add `VITE_API_URL` build arg for dashboard (points to Control API)
- [ ] Keep `openclaw-data` volume for workspace files (Control API reads these for file endpoints)

**Target docker-compose.yml services**:
```
postgres          → postgres:16-alpine, port 5432 internal, volume postgres-data
control-api       → built from deploy/control-api/, port 3001, depends on postgres
dashboard         → built from deploy/dashboard/, port 3000, depends on control-api
```

### 1.3 Update environment variables

**File**: `deploy/.env.example`

**Actions**:
- [ ] Add PostgreSQL variables: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`
- [ ] Add `OPENCLAW_VERSION=latest`
- [ ] Remove `OPENCLAW_GATEWAY_TOKEN` (no longer needed on control plane)
- [ ] Remove `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` etc. (these live on agent servers now)
- [ ] Remove `VITE_GATEWAY_WS_URL`, `VITE_GATEWAY_TOKEN`
- [ ] Add `VITE_API_URL` (dashboard → Control API URL)
- [ ] Keep `BETA_USER`, `BETA_PASSWORD`, `DOMAIN`

---

## Phase 2: Dashboard Rewrite

> Remove WebSocket/Gateway integration. Dashboard polls Control API only.

### 2.1 Update API client

**File**: `deploy/dashboard/src/api/client.ts`

**Actions**:
- [ ] Remove all WebSocket/Gateway code
- [ ] Remove Gateway token handling
- [ ] Add Control API endpoints:
  - `getAgents()` → `GET /api/agents`
  - `getAgent(id)` → `GET /api/agents/:id`
  - `getMissions()` → `GET /api/missions`
  - `getMission(id)` → `GET /api/missions/:id`
  - `createMission(data)` → `POST /api/missions`
  - `queueCommand(missionId, data)` → `POST /api/missions/:id/commands`
  - `getCommands(filters)` → `GET /api/commands`
  - `getEvents(filters)` → `GET /api/events`
- [ ] Keep file endpoints: `getFiles()`, `getFile(path)`, `updateFile(path, content)`
- [ ] Keep session endpoints: `getSessions()`, `getSession(id)`
- [ ] Add polling hooks with configurable intervals

### 2.2 Update dashboard views

**File**: `deploy/dashboard/src/App.tsx` + new view components

**Actions**:
- [ ] Remove `ChatView` import and chat nav item
- [ ] Add `Agents` nav item and view — shows registered agents, status badges (online/stale/offline), last heartbeat
- [ ] Add `Missions` nav item and view — list missions, create new mission form, command queue, results
- [ ] Add `Events` nav item and view — scrollable audit log
- [ ] Update `Overview` — show agent count, mission stats, recent events
- [ ] Keep `Files` view (now backed by Control API file endpoints)
- [ ] Keep `Sessions` view (now backed by Control API session endpoints)
- [ ] Keep `Settings` view (placeholder)
- [ ] Remove WebSocket connection status indicator
- [ ] Update health check to use `/api/health` (Control API + DB)

### 2.3 Remove old chat components

**Actions**:
- [ ] Delete `deploy/dashboard/src/components/chat/ChatView.tsx` (or keep as dead code for Phase 3 if desired)
- [ ] Remove Gateway-related hooks from `deploy/dashboard/src/hooks/`
- [ ] Remove Gateway-related types from `deploy/dashboard/src/types/`

---

## Phase 3: Infrastructure Updates

> Update Terraform, Ansible, and deploy.sh for the new architecture.

### 3.1 Update Terraform firewall

**File**: `deploy/terraform/main.tf`

**Actions**:
- [ ] Remove firewall rules for ports 3000, 3001, 18789, 18790 (all behind Nginx now)
- [ ] Keep only ports 22 (SSH), 80 (HTTP), 443 (HTTPS)
- [ ] Update server labels if desired

### 3.2 Update Ansible playbooks

**Directory**: `deploy/ansible/`

**Actions**:
- [ ] Remove `playbooks/tasks/openclaw-source.yml` (OpenClaw doesn't run on control plane)
- [ ] Remove `playbooks/tasks/openclaw-config.yml`
- [ ] Create `playbooks/tasks/postgres.yml` — ensure PostgreSQL container is running and healthy
- [ ] Rename/rewrite `playbooks/tasks/deploy-files.yml` → deploy control-api + dashboard files
- [ ] Update `playbooks/tasks/start-services.yml` — new docker-compose services
- [ ] Update `playbooks/templates/` — new Nginx config template:
  - Route `/` → dashboard:3000
  - Route `/api/` → control-api:3001
  - Agent endpoints (`/api/agents/register`, `/api/agents/heartbeat`, `/api/commands/pending`, `/api/commands/*/accept`, `/api/commands/*/result`) bypass basic auth
  - All other `/api/` routes require basic auth
- [ ] Update `playbooks/site.yml` — new task order: docker → deploy-files → postgres → start-services → nginx
- [ ] Create `playbooks/db-migrate.yml` — runs `docker exec control-api node dist/db/migrate.js`
- [ ] Update `group_vars/all/vars.yml` with new variables

### 3.3 Update deploy.sh

**File**: `deploy/deploy.sh`

**Actions**:
- [ ] Rename `cmd_openclaw` → `cmd_build_openclaw` (builds OpenClaw image from source for agents)
- [ ] Rename `cmd_fileapi` → `cmd_api` (deploys Control API)
- [ ] Add `cmd_db_migrate` — runs database migrations via Ansible
- [ ] Add `cmd_build_openclaw` — pulls/pins openclaw-source, builds Docker image
- [ ] Update `cmd_backup` — backup PostgreSQL dump (`pg_dump`) + workspace files
- [ ] Update `cmd_restore` — restore PostgreSQL dump + workspace files
- [ ] Update `cmd_status` — check postgres, control-api, dashboard health
- [ ] Update `cmd_help` — reflect new commands
- [ ] Remove references to "No PostgreSQL" in help text

---

## Phase 4: Delete Old Code

> Clean up v2 artifacts that are no longer needed.

**Actions**:
- [ ] Delete `deploy/file-api/` directory (absorbed into control-api)
- [ ] Delete or archive `DEPLOYMENT_READY.md` (replace with updated version)
- [ ] Delete or archive `NEXT_STEPS.md` (replaced by this runsheet + SPEC.md)
- [ ] Update `README.md` to reflect v3 architecture

---

## Phase 5: Agent-Side (Future)

> Build the agent SDK and provisioning tooling for remote OpenClaw instances.

**Status**: Superseded by Phase 6 (see AGENT_BRIDGE_PLAN.md)

### 5.1 Agent heartbeat client

**New file**: `agent/heartbeat.ts` (or published npm package)

A lightweight TypeScript module that:
- Reads `CONTROL_API_URL` and `AGENT_TOKEN` from env
- POSTs heartbeat every 30s with health data
- Polls for pending commands
- Calls a handler function when commands arrive
- POSTs results back

### 5.2 Agent provisioning

**New file**: `deploy/ansible/playbooks/agent.yml`

An Ansible playbook that provisions a remote server as an OpenClaw agent:
- Installs Docker
- Pulls/builds OpenClaw image
- Configures agent env (CONTROL_API_URL, AGENT_TOKEN, LLM keys)
- Starts OpenClaw container with heartbeat client
- Registers with Control API

### 5.3 Agent Docker image

Build from `openclaw-source/` with the heartbeat client baked in:
```bash
./deploy.sh build-openclaw    # builds openclaw/openclaw:$OPENCLAW_VERSION
```

---

## Phase 6: OpenClaw Agent Bridge Integration

> Full-featured agent bridge with skill discovery and multi-agent orchestration.

**Detailed Plan**: See [AGENT_BRIDGE_PLAN.md](./AGENT_BRIDGE_PLAN.md)

This phase implements:
- **Agent Bridge Service**: Connects OpenClaw instances to control plane
- **Skill Discovery**: Automatically discovers 60+ OpenClaw capabilities
- **Command Execution**: Routes commands through OpenClaw's AI runtime
- **Dashboard Integration**: Shows agent skills and enables skill-based routing
- **Remote Provisioning**: Deploy agents to remote servers via Ansible

**Key Components**:
- `deploy/agent-bridge/` - Bridge service (TypeScript)
- Skills parser for SKILL.md files
- OpenClaw WebSocket/CLI client
- Enhanced dashboard with skill browser
- Ansible playbooks for remote agent deployment

**Quick Start**:
```bash
# See AGENT_BRIDGE_PLAN.md for full details
./deploy.sh agent-bridge build
./deploy.sh agent-bridge start
```

**Benefits**:
- Multiple OpenClaw agents orchestrated from one dashboard
- Automatic skill discovery (no manual configuration)
- Session management for multi-turn conversations
- Real-time agent health and capabilities
- Scalable to 10+ agents across servers

---

## Implementation Order

Execute in this order. Each step should be testable independently.

| # | Task | Files Changed | Testable By |
|---|------|--------------|-------------|
| 1 | Create Control API directory + package.json + Dockerfile | `deploy/control-api/*` | `npm install` succeeds |
| 2 | Write PostgreSQL schema migration | `control-api/src/migrations/001_initial.sql` | SQL is valid |
| 3 | Write DB client + migration runner | `control-api/src/db/*` | Migrations run against local Postgres |
| 4 | Write health endpoint | `control-api/src/routes/health.ts` | `curl /api/health` returns DB status |
| 5 | Port file + session endpoints from File API | `control-api/src/routes/files.ts`, `sessions.ts` | Same behavior as old File API |
| 6 | Write agent endpoints (register, heartbeat) | `control-api/src/routes/agents.ts` | `curl -X POST /api/agents/register` returns token |
| 7 | Write mission + command endpoints | `control-api/src/routes/missions.ts`, `commands.ts` | Create mission, queue command, poll pending |
| 8 | Write events endpoint | `control-api/src/routes/events.ts` | `curl /api/events` returns log |
| 9 | Write agent auth middleware | `control-api/src/middleware/agentAuth.ts` | Unauthenticated requests rejected |
| 10 | Update docker-compose.yml | `deploy/docker-compose.yml` | `docker compose up` starts postgres + control-api + dashboard |
| 11 | Update dashboard API client | `deploy/dashboard/src/api/client.ts` | No more WebSocket code, new endpoints work |
| 12 | Update dashboard views | `deploy/dashboard/src/App.tsx` + views | Agents, Missions, Events views render |
| 13 | Update Terraform firewall | `deploy/terraform/main.tf` | Only ports 22, 80, 443 |
| 14 | Update Ansible playbooks | `deploy/ansible/playbooks/*` | Full deploy works on fresh VPS |
| 15 | Update deploy.sh | `deploy/deploy.sh` | All commands work |
| 16 | Delete old File API | `deploy/file-api/` | Removed, no references remain |
| 17 | Update README | `README.md` | Accurate docs |

---

## Verification Checklist

After completing migration, verify:

- [ ] `./deploy.sh init` creates VPS and deploys full stack from scratch
- [ ] Dashboard loads at `http://<IP>` with basic auth prompt
- [ ] `/api/health` returns `{ "status": "ok", "db": "connected" }`
- [ ] `POST /api/agents/register` returns agent_id and token
- [ ] `POST /api/agents/heartbeat` with valid token succeeds
- [ ] Agent shows as "online" in dashboard Agents view
- [ ] `POST /api/missions` creates a mission visible in dashboard
- [ ] `POST /api/missions/:id/commands` queues a command
- [ ] `GET /api/commands/pending` returns queued command for the agent
- [ ] `POST /api/commands/:id/result` marks command completed
- [ ] Dashboard Missions view shows completed result
- [ ] `/api/files` returns workspace files
- [ ] `/api/sessions` returns sessions
- [ ] `./deploy.sh backup` creates a `.tar.gz` with PostgreSQL dump + files
- [ ] `./deploy.sh destroy` tears down cleanly
- [ ] Firewall only allows ports 22, 80, 443

---

## Cost Estimate (unchanged)

| Item | Cost |
|------|------|
| Hetzner CX22 (4GB RAM) | ~$6.50/month |
| Hetzner CX32 (8GB RAM, if needed) | ~$12.50/month |
| LLM usage (on agent servers) | Pay-as-you-go |

PostgreSQL adds negligible overhead — runs on the same VPS.

---

**Last Updated**: February 11, 2026  
**Version**: 3.0
