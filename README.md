# ClawDeploy v2

**AI agent orchestration platform. Talk to Phoung (your PM). She queues tasks, spawns coding sub-agents, and surfaces PRs for your review.**

---

## What It Does

You chat with **Phoung** — a persistent AI project manager who knows your business, your projects, and your history. When you assign a task, Phoung spins up a Docker sub-agent (Claude Code, Codex, etc.) that clones your repo, writes the code, pushes a branch, and opens a PR. You come back to the Review UI and merge or reject.

```
You (chat)
    │
    ▼
Phoung — main agent (Kimi K2.5 / GLM 4.7)
    │  Reads/writes .md memory files
    │  Knows all your projects
    │  Queues tasks, spawns sub-agents
    │
    ▼
Sub-Agent (Docker container)
    │  Clones repo → writes code → pushes branch → opens PR
    │
    ▼
GitHub PR ← You review and merge in the Review UI
```

---

## Architecture

**3 Docker containers:**

| Container | What | Port |
|-----------|------|------|
| `clawdeploy-api` | Python FastAPI — Phoung's brain + API for the UI | 8000 (internal) |
| `clawdeploy-ui` | React Review UI — chat, tasks, logs | 3000 (internal) |
| `clawdeploy-nginx` | Reverse proxy | 8080 |

**No database.** All state lives in `.md` files in `memory/`.

**Sub-agents** are spawned on-demand as Docker containers. They run, push a PR, and exit.

**Two cron jobs** run on the server:
- Hourly: wakes Phoung to process the task queue
- Daily at 2am: housekeeping (organise conversations, rename memory files)

---

## Memory Structure

```
memory/
├── system-prompt.md          ← Phoung's identity, rules, and behaviour
├── subagent-prompt.md        ← Sub-agent identity template (injected at spawn)
├── overview.md               ← All projects: status, stack, repo, folder
├── conversations/
│   └── inbox/                ← New chats land here; daily cron sorts them
├── projects/
│   └── <project-name>/
│       ├── context.md        ← Full project context: stack, repo, priorities
│       ├── memories/         ← Decisions, lessons, technical notes
│       ├── conversations/    ← Sorted conversation history
│       └── tasks/
│           ├── active/       ← Live tasks (.md files with frontmatter)
│           └── completed/
└── general/
    ├── memories/             ← Cross-project preferences and notes
    └── conversations/
```

Phoung loads only what's needed: system prompt + overview always, then the relevant project's context and memories for that conversation.

---

## File Structure

```
clawdeploy/
├── main-agent/
│   ├── agent.py              # Core agent loop — parses actions, dispatches
│   ├── pi_client.py          # LLM API client (Kimi K2.5, GLM, Claude, Pi)
│   ├── spawner.py            # Docker sub-agent launcher
│   ├── memory.py             # .md file read/write, activity logs
│   ├── github_client.py      # GitHub API (PRs, merge, status)
│   ├── housekeeping.py       # Daily cron: sort conversations, collect agent logs
│   ├── cron_handler.py       # Hourly cron: wake Phoung
│   ├── api.py                # FastAPI — serves tasks, chat, logs, models
│   ├── config.py             # Settings and API keys
│   └── requirements.txt
├── subagent/
│   ├── Dockerfile            # Sub-agent container image
│   └── entrypoint.sh         # Clone → branch → run agent → PR
├── review-ui/
│   └── src/
│       ├── App.tsx            # Main layout, tabs
│       ├── ChatView.tsx       # Chat with Phoung, model switcher, history
│       ├── TasksView.tsx      # Task cards with activity timeline
│       └── LogsView.tsx       # Container log viewer
├── memory/                   # All persistent state (git-tracked)
├── deploy/
│   ├── deploy.sh             # Deploy script
│   └── ansible/
│       └── playbooks/
│           └── deploy-v2.yml # Single Ansible playbook
├── docker-compose.yml
├── nginx.conf
└── .env                      # API keys and config (see below)
```

---

## Setup

### Prerequisites

- Hetzner VPS (or any Linux server with Docker)
- SSH key configured
- Ansible ≥ 2.15 on your local machine
- API keys (see below)

### Configuration

Copy and fill in your `.env` at the repo root:

```env
# Primary LLM: Kimi K2.5 (Moonshot AI)
MOONSHOT_API_KEY=sk-...
KIMI_MODEL=kimi-k2.5
DEFAULT_MODEL=kimi-k2.5

# Secondary LLM: GLM 4.7 (ZhipuAI)
ZHIPU_API_KEY=...
GLM_MODEL=glm-4.7-flash

# Optional LLMs
PI_API_KEY=
ANTHROPIC_API_KEY=

# GitHub (required for sub-agents to push branches and open PRs)
# Use a fine-grained PAT scoped to your target repos
# Permissions needed: Contents (Read/Write), Pull requests (Read/Write)
GITHUB_TOKEN=github_pat_...

# Sub-agent settings
MAX_CONCURRENT_SUBAGENTS=3
SUBAGENT_IMAGE=clawdeploy/subagent:latest
SUBAGENT_MEMORY_LIMIT=4g
SUBAGENT_CPUS=2
```

Get API keys:
- **Kimi K2.5**: [platform.moonshot.cn](https://platform.moonshot.cn)
- **GLM 4.7**: [open.bigmodel.cn](https://open.bigmodel.cn)
- **GitHub PAT**: [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)

### Deploy

```bash
source .env
cd deploy
./deploy.sh deploy-v2
```

### Access

Open an SSH tunnel to the server:

```bash
./deploy.sh tunnel
```

Then open `http://localhost:8080` in your browser.

---

## Task Lifecycle

```
pending → coding → pr_open → ready_to_merge → [you merge]
                           ↘ needs_human → [you answer] → coding
                           ↘ failed
```

Each task is a `.md` file in `memory/projects/<project>/tasks/active/` with frontmatter tracking status, container ID, branch, and PR number.

When a sub-agent finishes, its logs are captured to `<task-id>-run-<N>.log` and an activity timeline is written to `<task-id>-activity.jsonl`. You can view both in the Tasks tab of the Review UI.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health check |
| `GET` | `/tasks` | List all active tasks |
| `GET` | `/tasks/{id}` | Single task detail |
| `POST` | `/tasks/{id}/merge` | Merge the task's PR |
| `POST` | `/tasks/{id}/reject` | Close the task's PR |
| `GET` | `/tasks/{id}/activity` | Full activity timeline |
| `GET` | `/tasks/{id}/runs/{n}/log` | Sub-agent output for run N |
| `POST` | `/chat` | Send message to Phoung |
| `GET` | `/conversations` | List all conversations |
| `GET` | `/conversations/{id}` | Load conversation history |
| `POST` | `/conversations/new` | Start a new conversation |
| `GET` | `/models` | Available LLM models |
| `GET` | `/projects` | List projects from memory |
| `GET` | `/logs/{service}` | Container logs (api/ui/nginx) |

---

## Models

Phoung supports multiple LLMs. The active model is selected in the chat UI. The server default is set by `DEFAULT_MODEL` in `.env`.

| Model | Provider | ID | Best for |
|-------|----------|----|----------|
| Kimi K2.5 | Moonshot AI | `kimi-k2.5` | Default — strong reasoning, good instruction following |
| GLM 4.7 | ZhipuAI | `glm-4.7-flash` | Fast, cheap, good for routing |
| Claude | Anthropic | `claude-sonnet-4-...` | Optional |

Sub-agents use Claude Code or Codex — set by `AGENT_TYPE` when spawning.

---

## Security

- **Dashboard**: Nginx reverse proxy, server-level access control
- **Sub-agents**: isolated Docker containers, resource-limited (`--memory=4g --cpus=2`)
- **GitHub**: fine-grained PAT scoped to specific repos
- **Phoung never merges**: only you merge, via the UI or GitHub directly
- **Action allowlist**: enforced in code — Phoung can only execute actions from `ALLOWED_ACTIONS`

---

## Cost Estimate

| Item | Est. Cost |
|------|-----------|
| Hetzner CX22 (4 GB RAM) | ~$6.50/month |
| Kimi K2.5 (active use) | ~$5–20/month |
| GLM 4.7-flash (routing) | ~$1–3/month |

---

**Maintainer**: Marten — Friend Labs  
**Version**: 2.0  
**Stack**: Python 3.12, FastAPI, React, Vite, Tailwind, Docker, Ansible
