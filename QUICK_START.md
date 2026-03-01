# ClawDeploy v4 — Quick Start

Get the orchestrator running and spawn your first coding sub-agent in under 15 minutes.

## Prerequisites

- Hetzner Cloud account + API token
- SSH key pair
- Local machine with: Terraform, Ansible, Docker
- Server must have: `claude` CLI, `gh` CLI, `tmux`, `git`
- API keys: `ZHIPU_API_KEY` (manager), `MOONSHOT_API_KEY` (Kimi), `ANTHROPIC_API_KEY` (Claude)

## 1. Clone & Configure

```bash
git clone --recursive https://github.com/meteordefect/clawdeploy.git
cd clawdeploy/deploy

cp .env.example .env
vim .env
```

Set at minimum:
```bash
POSTGRES_PASSWORD=<generate with: openssl rand -base64 32>
DATABASE_URL=postgresql://clawdeploy:<POSTGRES_PASSWORD>@postgres:5432/clawdeploy
BETA_PASSWORD=<generate with: openssl rand -base64 16>
DOMAIN=<your-server-ip-or-domain>
ZHIPU_API_KEY=<your-key>
```

## 2. Terraform

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
vim terraform.tfvars  # set hcloud_token, ssh_public_key
cd ..
```

## 3. Deploy

```bash
./deploy.sh init
```

Wait 5–10 minutes. You'll see:
```
✓ ClawDeploy Control Plane is ready!
ℹ Access dashboard at: http://YOUR_IP
```

## 4. Run the v4 Migration

```bash
./deploy.sh migrate
```

This creates the `projects` and `tasks` tables.

## 5. Open the Dashboard

```
http://YOUR_SERVER_IP
Username: value of BETA_USER in .env
Password: value of BETA_PASSWORD in .env
```

## 6. Create Your First Project

In the dashboard, click **+ Add** in the project tab bar.

Fill in:
- **Name** — e.g. `clawdeploy`
- **Repo URL** — `git@github.com:you/your-repo.git`
- **Repo Path** — absolute path on the server where the repo is cloned, e.g. `/home/marten/repos/clawdeploy`
- **Default Branch** — `main`

## 7. Create a Task (Spawn a Sub-Agent)

Inside the project, go to **Tasks** → **New Task**.

- **Title** — short name
- **Description** — the full coding prompt the sub-agent will receive
- **Agent Type** — `claude` / `kimi` / `codex`
- **Model** — e.g. `claude-sonnet-4-5` or `kimi-k2.5`

Click **Create Task**. The control API calls `spawn-agent.sh`, which:
1. Creates a git worktree on the server
2. Launches the agent in a tmux session
3. The agent codes, commits, pushes, and opens a PR
4. Exits when done

## 8. Approve & Merge

When the task reaches **review** status (PR open, CI passing), go to **Merge Queue** and click **Approve & Merge**.

That runs `gh pr merge --squash`, updates the task to `merged`, and cleans up the worktree.

---

## Common Commands

```bash
./deploy.sh status      # Check all services
./deploy.sh logs        # View service logs
./deploy.sh migrate     # Run DB migrations
./deploy.sh ssh         # SSH to server
./deploy.sh backup      # Backup DB + files
./deploy.sh api         # Restart Control API
./deploy.sh dashboard   # Restart Dashboard
```

## Task Status Flow

```
pending → spawned → coding → pr_open → ci_pending → review → merged
                                                           ↘ failed (auto-retry up to 3x)
```

## Troubleshooting

**Task stuck in `spawned`:**
- SSH to server and check: `tmux ls`
- View agent output: `tmux attach -t claw-<short-task-id>`

**PR not detected:**
- Check `check-agents.sh` is running (cron every 5 min via Control API)
- Verify `gh auth status` on the server

**Dashboard won't load:**
```bash
./deploy.sh ssh
cd /opt/clawdeploy
docker compose ps
docker compose logs dashboard
```

**DB migration not applied:**
```bash
./deploy.sh migrate
# or manually:
docker exec clawdeploy-control-api node dist/db/migrate.js
```

---

Full docs: [README.md](README.md) | Full spec: [MIGRATION_PLAN.md](MIGRATION_PLAN.md)
