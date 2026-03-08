# ClawDeploy v3

**AI agent orchestration platform built on [pi-mono](https://github.com/badlogic/pi-mono). Talk to Phoung (your PM). She queues tasks, spawns coding sub-agents, and surfaces PRs for your review.**

---

## Why Pi-Mono

ClawDeploy v2 used raw HTTP calls to LLM APIs and parsed XML action tags from responses. v3 replaces all of that with the [Pi coding agent SDK](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent):

- **Phoung** is a pi-mono agent session with custom tools. No XML parsing — the LLM calls `spawn_subagent`, `update_task`, `check_prs` etc. as native tool calls.
- **Sub-agents** are full pi-mono instances running in Docker containers (`pi -p`). They get branching sessions, built-in file tools, and multi-provider LLM support.
- **Multi-provider LLM** is handled by pi-mono's unified API. Kimi For Coding, ZAI (GLM), Anthropic — all work through the same interface, no custom dispatch code.
- **Memory files** accumulate over time. Phoung reads them for long-term context about why you're building what you're building.

---

## How It Works

```
You (chat via Review UI)
    │
    ▼
Phoung — pi-mono agent session (Kimi / ZAI / Anthropic)
    │  Built-in tools: read, write, edit, bash
    │  Custom tools: spawn_subagent, list_tasks, update_task, check_prs, create_memory, ask_human
    │  Reads memory/ for long-term project context
    │  Sessions stored as JSONL with branching + compaction
    │
    ▼
Sub-Agent (Docker container running `pi -p`)
    │  Clones repo → creates branch → writes code → pushes → opens PR
    │  Full pi-mono coding agent with file tools
    │
    ▼
GitHub PR ← You review and merge in the Review UI
```

---

## Architecture

**3 Docker containers + on-demand sub-agents:**

| Container | What | Port |
|-----------|------|------|
| `clawdeploy-api` | Node.js/Express — pi-mono SDK + API for the UI | 8000 (internal) |
| `clawdeploy-ui` | React Review UI — chat, tasks, logs | 3000 (internal) |
| `clawdeploy-nginx` | Reverse proxy | 8080 |

**No database.** All state lives in markdown files in `memory/` and pi-mono session files.

**Sub-agents** are spawned on-demand as Docker containers. They run the pi coding agent CLI, push a PR, and exit.

**Cron jobs** run on the server:
- Hourly: wakes Phoung to process the task queue and check container status
- Daily at 2am: housekeeping (organise conversations, rename memory files)

---

## Memory Structure

```
memory/
├── system-prompt.md          ← Phoung's identity, rules, and behaviour
├── subagent-prompt.md        ← Sub-agent identity template (injected at spawn)
├── overview.md               ← All projects: status, stack, repo, folder
├── sessions/                 ← Pi-mono session files (JSONL, auto-managed)
├── conversations/
│   └── inbox/                ← New chats land here; daily cron sorts them
├── projects/
│   └── <project-name>/
│       ├── context.md        ← Full project context: stack, repo, priorities
│       ├── memories/         ← Decisions, lessons, technical notes
│       ├── conversations/    ← Sorted conversation history
│       └── tasks/
│           ├── active/       ← Live tasks (.md files with YAML frontmatter)
│           └── completed/
└── general/
    ├── memories/             ← Cross-project preferences and notes
    └── conversations/
```

Memory files build up over time — they are long-term institutional knowledge. Phoung loads the system prompt + overview always, then the relevant project's context and memories for each conversation.

Pi-mono sessions (JSONL) store per-conversation history with full tool call traces, branching, and automatic compaction.

---

## File Structure

```
clawdeploy/
├── main-agent/
│   ├── src/
│   │   ├── index.ts          # Entry point
│   │   ├── server.ts         # Express API — tasks, chat, logs, models
│   │   ├── phoung.ts         # Pi-mono SDK session management
│   │   ├── extension.ts      # Custom tools: spawn_subagent, task mgmt, GitHub
│   │   ├── memory.ts         # Markdown file read/write, activity logs
│   │   ├── spawner.ts        # Docker sub-agent launcher (dockerode)
│   │   ├── github.ts         # GitHub API via @octokit/rest
│   │   ├── cron.ts           # Cron: container checks + Phoung wake-up
│   │   └── config.ts         # Environment config
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── subagent/
│   ├── Dockerfile            # Pi coding agent + Claude Code + GitHub CLI
│   └── entrypoint.sh         # Clone → branch → pi -p → commit → PR
├── review-ui/
│   └── src/
│       ├── App.tsx            # 3-panel layout: sidebar, main content, context
│       ├── ChatView.tsx       # Chat with Phoung, model switcher
│       ├── Sidebar.tsx        # Tasks + conversation navigation
│       ├── TaskDetailView.tsx # Task detail with activity timeline
│       ├── ContextPanel.tsx   # PR file changes + CI checks
│       ├── LogsDrawer.tsx     # Collapsible container log viewer
│       └── MessageCard.tsx    # Rich chat messages with inline tool actions
├── memory/                   # All persistent state (git-tracked)
├── docker-compose.yml
├── nginx.conf
└── .env                      # API keys and config
```

---

## Setup

### Prerequisites

- Linux server with Docker (Hetzner CX22 or similar)
- SSH key configured
- Ansible >= 2.15 on your local machine
- API keys (see below)

### Configuration

Create `.env` at the repo root:

```env
# Primary LLM: Kimi For Coding (Moonshot AI)
# Pi coding agent uses KIMI_API_KEY for the kimi-coding provider
KIMI_API_KEY=sk-...

# Secondary LLM: ZAI (ZhipuAI / GLM)
# Pi coding agent uses ZAI_API_KEY for the zai provider
ZAI_API_KEY=...

# Optional: Anthropic
ANTHROPIC_API_KEY=

# Default model (pi-mono provider/model format, leave empty for auto-select)
DEFAULT_MODEL=

# GitHub — fine-grained PAT scoped to your target repos
# Permissions: Contents (Read/Write), Pull requests (Read/Write)
GITHUB_TOKEN=github_pat_...

# Sub-agent settings
SUBAGENT_MODEL=            # e.g. kimi-coding/kimi-k2.5, zai/glm-4, anthropic/claude-sonnet-4-20250514
MAX_CONCURRENT_SUBAGENTS=3
SUBAGENT_IMAGE=clawdeploy/subagent:latest
SUBAGENT_MEMORY_LIMIT=4g
SUBAGENT_CPUS=2
```

Get API keys:
- **Kimi For Coding**: [platform.moonshot.cn](https://platform.moonshot.cn)
- **ZAI (GLM)**: [open.bigmodel.cn](https://open.bigmodel.cn)
- **GitHub PAT**: [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)

### Deploy

```bash
source .env
cd deploy
./deploy.sh deploy-v2
```

### Access

```bash
./deploy.sh tunnel
```

Then open `http://localhost:8080`.

---

## Phoung's Custom Tools

These are registered as pi-mono custom tools. The LLM calls them as native tool calls — no XML parsing.

| Tool | Description |
|------|-------------|
| `spawn_subagent` | Spawn a pi coding agent in Docker to execute a coding task |
| `list_tasks` | List all active tasks across projects |
| `update_task` | Update task status or metadata |
| `ask_human` | Flag a task as needing human input |
| `check_prs` | Check open PRs for a project's repository |
| `create_memory` | Create a persistent memory file for long-term knowledge |

Phoung also has pi-mono's built-in tools (`read`, `write`, `edit`, `bash`) for direct file and system operations.

---

## Task Lifecycle

```
pending → coding → pr_open → ready_to_merge → [you merge]
                           ↘ needs_human → [you answer] → coding
                           ↘ failed
```

Each task is a `.md` file with YAML frontmatter tracking status, container ID, branch, and PR number. Activity is logged to `<task-id>-activity.jsonl`. Sub-agent output is saved to `<task-id>-run-<N>.log`.

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
| `GET` | `/tasks/{id}/pr-info` | PR file changes and CI checks |
| `POST` | `/chat` | Send message to Phoung |
| `GET` | `/conversations` | List all conversations |
| `GET` | `/conversations/{id}` | Load conversation history |
| `POST` | `/conversations/new` | Start a new conversation |
| `GET` | `/models` | Available LLM models (from pi-mono) |
| `GET` | `/projects` | List projects from memory |
| `GET` | `/logs/{service}` | Container logs (api/ui/nginx) |
| `POST` | `/cron/wake` | Trigger cron cycle |

---

## Security

- **Dashboard**: Nginx reverse proxy, server-level access control
- **Sub-agents**: isolated Docker containers, resource-limited (`--memory=4g --cpus=2`)
- **GitHub**: fine-grained PAT scoped to specific repos
- **Phoung never merges**: only you merge, via the UI or GitHub directly
- **Tool allowlist**: enforced by pi-mono — Phoung can only use registered custom tools + built-in file tools

---

## Cost Estimate

| Item | Est. Cost |
|------|-----------|
| Hetzner CX22 (4 GB RAM) | ~$6.50/month |
| LLM API usage (active use) | ~$5–20/month |

---

**Maintainer**: Marten — Friend Labs
**Version**: 3.0
**Stack**: TypeScript, Pi-mono SDK, Express, React, Vite, Tailwind, Docker, Ansible
