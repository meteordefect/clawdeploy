# ClawDeploy v4

**Git-project-centric AI agent orchestrator — spawn coding sub-agents, create PRs, queue merges for human approval.**

You talk to an OpenClaw manager (GLM). It spawns coding sub-agents (Claude Code, Codex, Kimi K2.5) that work in isolated git worktrees, push branches, and open PRs. You come back and approve merges. That's it.

## Architecture

```
You (Dashboard — per-project tabs)
        │
        ▼
  OpenClaw Manager (GLM-4.7-flash)
  ├── Persistent, scoped per project
  ├── Routes tasks to the right model
  └── Calls spawn-agent.sh per task
        │
        ▼
  Sub-Agents (tmux sessions)
  ├── Each works in an isolated git worktree
  ├── Commits → pushes → gh pr create
  └── Exits when done
        │
        ▼
  Merge Queue (dashboard)
  ├── PRs listed per project with CI status
  └── You approve → merge
```

## Model Routing

| Role | Model | When |
|------|-------|------|
| Manager / Chat / Planning | GLM-4.7-flash | Always-on |
| Coding (default) | Kimi K2.5 | Most tasks — fast, cheap |
| Coding (complex) | Claude Sonnet | Multi-file, refactors |
| Coding (alternative) | Codex / GPT-4o | User override |

## Quick Start

### Prerequisites

- Hetzner Cloud account + API token
- SSH key pair
- Domain name (optional)
- Local machine with: Terraform ≥ 1.0, Ansible ≥ 2.15, Docker
- Server needs: `claude` CLI, `gh` CLI, `tmux`, `git` installed

### Initial Setup

1. **Clone and configure**
   ```bash
   git clone --recursive https://github.com/meteordefect/clawdeploy.git
   cd clawdeploy/deploy
   cp .env.example .env
   vim .env
   ```

   Required env vars:
   - `POSTGRES_PASSWORD` — generate a secure password
   - `DATABASE_URL` — update with the same password
   - `BETA_PASSWORD` — dashboard basic auth password
   - `DOMAIN` — your domain or server IP
   - `ZHIPU_API_KEY` — for OpenClaw GLM manager

2. **Configure Terraform**
   ```bash
   cd terraform
   cp terraform.tfvars.example terraform.tfvars
   vim terraform.tfvars  # set hcloud_token, ssh_public_key
   cd ..
   ```

3. **Deploy**
   ```bash
   ./deploy.sh init
   ```

4. **Run the DB migration** (new `projects` + `tasks` tables)
   ```bash
   ./deploy.sh migrate
   ```

### Access the Dashboard

```
URL:      http://YOUR_SERVER_IP
Username: (from .env BETA_USER)
Password: (from .env BETA_PASSWORD)
```

## Project Structure

```
clawdeploy/
├── README.md
├── MIGRATION_PLAN.md          # v4 full architecture spec
├── CHANGELOG.md
├── scripts/
│   ├── spawn-agent.sh         # Creates worktree + tmux + launches sub-agent
│   ├── check-agents.sh        # Cron: detects PR creation + CI status
│   ├── cleanup-agents.sh      # Daily: removes merged/failed worktrees
│   └── merge-pr.sh            # gh pr merge + status update + cleanup
└── deploy/
    ├── deploy.sh              # Main deployment script
    ├── .env.example           # Environment template
    ├── docker-compose.yml     # Service definitions
    ├── control-api/           # Node.js + Express + PostgreSQL
    │   └── src/
    │       ├── routes/
    │       │   ├── projects.ts    # CRUD for projects
    │       │   └── tasks.ts       # CRUD + merge queue + activity
    │       ├── services/
    │       │   └── task-runner.ts # Calls spawn-agent.sh, runs cron
    │       └── migrations/
    │           ├── 001_initial.sql
    │           └── 002_projects_tasks.sql
    ├── dashboard/             # React + TypeScript + Vite + shadcn/ui
    │   └── src/
    │       ├── views/
    │       │   ├── TasksView.tsx
    │       │   ├── MergeQueueView.tsx
    │       │   └── ActivityView.tsx
    │       └── components/
    │           ├── Layout.tsx     # Project tab bar
    │           └── chat/
    ├── terraform/
    └── ansible/
```

## Dashboard Views

- **Tasks** — create tasks, pick agent type, monitor status per project
- **Merge Queue** — PRs ready for review with CI status; one-click merge
- **Chat** — talk to the OpenClaw manager, scoped per project
- **Activity** — per-project event log

## Task Lifecycle

```
pending → spawned → coding → pr_open → ci_pending → review → merged
                                                            → failed
```

Each task = one sub-agent = one git worktree = one branch = one PR.

## API Endpoints

### Projects

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create project |
| `PUT` | `/api/projects/:id` | Update project |
| `DELETE` | `/api/projects/:id` | Delete project |

### Tasks

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects/:id/tasks` | List tasks for project |
| `POST` | `/api/projects/:id/tasks` | Create task (spawns sub-agent) |
| `GET` | `/api/tasks/:id` | Task detail |
| `POST` | `/api/tasks/:id/cancel` | Cancel task |
| `POST` | `/api/tasks/:id/retry` | Retry failed task |
| `GET` | `/api/projects/:id/merge-queue` | PRs ready for review |
| `POST` | `/api/tasks/:id/merge` | Approve and merge PR |
| `GET` | `/api/projects/:id/activity` | Project event log |

### Legacy (deprecated, kept for v3 compatibility)

`/api/agents/*`, `/api/missions/*`, `/api/commands/*` — still served, no new writes.

## Database Schema

### `projects`
```sql
id, name, repo_url, repo_path, default_branch, created_at, updated_at
```

### `tasks`
```sql
id, project_id, title, description, status, agent_type, model,
branch, worktree_path, tmux_session, pr_number, pr_url, ci_status,
spawn_retries, created_at, started_at, completed_at
```

### `events`
Audit trail — types: `task_created`, `agent_spawned`, `agent_exited`,
`pr_opened`, `ci_passed`, `ci_failed`, `merged`, `merge_conflict`

## Deployment Commands

```bash
./deploy.sh init          # Fresh VPS → full control plane
./deploy.sh deploy        # Redeploy services (existing server)
./deploy.sh migrate       # Run DB migrations
./deploy.sh status        # Check service health
./deploy.sh logs          # View logs
./deploy.sh ssh           # SSH to server
./deploy.sh backup        # Backup database + files
./deploy.sh api           # Restart Control API only
./deploy.sh dashboard     # Restart Dashboard only
```

## Security

- **Dashboard**: Nginx HTTP Basic Auth
- **Network**: PostgreSQL internal-only; ports 22, 80, 443 only
- **Sub-agents**: run under the server's OS user, scoped to isolated git worktrees

## Cost Estimate

| Item | Cost |
|------|------|
| Hetzner CX22 (4 GB RAM) | ~$6.50/month |
| Kimi K2.5 (100 tasks/day) | ~$45–65/month |
| GLM-4.7-flash (manager) | ~$2–5/month |

## What's Not Done Yet

- **Auto-merge** — requires CI integration + confidence scoring
- **Multi-model PR review** — manager spawning a review agent to read diffs
- **WebSocket push** — dashboard still polls; good enough for now
- **Kimi K2.5 CLI** — currently routed through OpenClaw; needs thin wrapper

## Maintenance

### Backup & Restore

```bash
# Backup
./deploy.sh backup

# Restore (on server)
docker compose down
docker compose up -d postgres
docker exec -i clawdeploy-postgres psql -U clawdeploy < backup.sql
docker compose up -d
```

### Logs

```bash
./deploy.sh logs
# or on server:
docker compose logs -f control-api
```

## Local Development

```bash
# Control API
cd deploy/control-api
npm install && npm run dev

# Dashboard
cd deploy/dashboard
npm install && npm run dev
```

## Additional Documentation

- **[MIGRATION_PLAN.md](MIGRATION_PLAN.md)** — full v4 architecture and phase breakdown
- **[DEPLOY_READY.md](DEPLOY_READY.md)** — deployment checklist
- **[CHANGELOG.md](CHANGELOG.md)** — version history
- **[docs/guides/AGENT_CONFIG.md](docs/guides/AGENT_CONFIG.md)** — agent configuration

---

**Version**: 4.0  
**Last Updated**: March 1, 2026  
**Maintainer**: Marten (Friend Labs) — marten@friendlabs.ai
