# ClawDeploy v4 — Deploy Checklist

## What's Complete

### ✅ Database (Phase 1)
- `002_projects_tasks.sql` — `projects` and `tasks` tables
- Control API routes: `projects.ts`, `tasks.ts`
- Task runner service with cron for agent status checks

### ✅ Sub-Agent Scripts (Phase 2)
- `scripts/spawn-agent.sh` — worktree + tmux + claude/codex/kimi
- `scripts/check-agents.sh` — PR detection + CI status + Telegram notify
- `scripts/cleanup-agents.sh` — 7-day cleanup of merged/failed worktrees
- `scripts/merge-pr.sh` — gh pr merge + status update + worktree cleanup

### ✅ Dashboard (Phases 3–6)
- shadcn/ui component library installed
- Project tab bar navigation
- Tasks view (Card + Badge + Dialog + DropdownMenu)
- Merge Queue view (Table + CI badges + approve/merge/request-changes)
- Activity view (per-project event log)
- Chat view scoped per project

---

## Pre-Deployment Checklist

### Environment (deploy/.env)

```bash
cd deploy
cp .env.example .env
```

Required:
- [ ] `POSTGRES_PASSWORD` — `openssl rand -base64 32`
- [ ] `DATABASE_URL` — `postgresql://clawdeploy:<pass>@postgres:5432/clawdeploy`
- [ ] `BETA_PASSWORD` — `openssl rand -base64 16`
- [ ] `DOMAIN` — your server IP or domain
- [ ] `ZHIPU_API_KEY` — for OpenClaw GLM manager (chat)

Optional but needed for sub-agents:
- [ ] `MOONSHOT_API_KEY` — Kimi K2.5 tasks
- [ ] `ANTHROPIC_API_KEY` — Claude Code tasks (or use claude CLI auth)

### Terraform (deploy/terraform/terraform.tfvars)

- [ ] `hcloud_token`
- [ ] `ssh_public_key`
- [ ] Server type (default: `cx22`) — sub-agents need RAM; `cx32` recommended

### Server Requirements

These must be installed on the server (not in Docker) for sub-agents to work:

- [ ] `claude` CLI — `npm install -g @anthropic-ai/claude-cli`
- [ ] `gh` CLI — authenticated with `gh auth login`
- [ ] `tmux`
- [ ] `git` with SSH access to your repos

---

## Deployment Steps

### Fresh VPS

```bash
cd deploy
./deploy.sh init      # Terraform + Ansible + Docker
./deploy.sh migrate   # Run 001 + 002 migrations
```

### Existing Server (redeploy)

```bash
cd deploy
./deploy.sh deploy    # Rebuild + restart containers
./deploy.sh migrate   # Run any pending migrations
```

---

## Verification Steps

### 1. Services healthy

```bash
./deploy.sh status
```

Expected:
- ✅ PostgreSQL: healthy
- ✅ Control API: healthy
- ✅ Dashboard: running
- ✅ Nginx: active

### 2. Migration applied

```bash
./deploy.sh ssh
docker exec clawdeploy-postgres psql -U clawdeploy -c "\dt"
# Should show: projects, tasks, events, agents, missions, commands
```

### 3. Dashboard loads

Open `http://YOUR_DOMAIN` — project tab bar should appear with a `+ Add` button.

### 4. Server tooling

```bash
./deploy.sh ssh
claude --version
gh auth status
tmux -V
git --version
```

### 5. Spawn a test task

Create a project in the dashboard pointing to a real repo on the server, then create a simple task. Check:
- Task status moves to `spawned` then `coding`
- `tmux ls` shows a `claw-<id>` session on the server

---

## Post-Deployment

### Telegram Notifications (optional)

Set in server environment for `check-agents.sh`:
```bash
TELEGRAM_BOT_TOKEN=your-token
TELEGRAM_CHAT_ID=your-chat-id
```

Notifies on PR opened and CI passing.

### Check-Agents Cron

The Control API starts a `setInterval` every 5 minutes that runs `check-agents.sh`. This detects PR creation and CI status automatically. No extra cron config needed.

### Cleanup Cron (optional)

For 7-day worktree cleanup, add to server crontab:
```bash
0 2 * * * /path/to/clawdeploy/scripts/cleanup-agents.sh
```

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Task stuck at `spawned` | `tmux ls` on server; `tmux attach -t claw-<id>` to see agent output |
| No PR detected | `gh auth status` on server; check check-agents.sh logs in control-api |
| Dashboard shows no projects | Migration not applied — run `./deploy.sh migrate` |
| Chat not working | Verify `ZHIPU_API_KEY` in `.env`; check openclaw-gateway container |
| Merge fails | `gh auth status` on server; verify `REPO_SLUG` resolves correctly |

---

**Ready to deploy:**
```bash
cd deploy && ./deploy.sh init && ./deploy.sh migrate
```
