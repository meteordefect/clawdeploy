# Phoung v3

Phoung is your project manager for coding work.  
You chat with Phoung in the review UI.  
Phoung can create coding tasks, spawn pi-mono coding sub agents in Docker, and open merge requests for your approval.

## Project Overview

- Purpose: run a practical coding workflow where AI agents produce merge requests and you stay in control of merge decisions.
- Primary agent: Phoung, powered by the pi-mono coding agent SDK.
- Sub agents: short lived coding workers that clone repo, create branch, make changes, push, and open merge requests.
- Interface: review dashboard for chat, tasks, run logs, and PR context.
- State model: file based memory and session data, no database required.

## Technical Overview

### Runtime Components

- `clawdeploy-api`: Express API that hosts chat, task operations, PR operations, logs, and cron trigger endpoints.
- `clawdeploy-ui`: React review UI for conversations, task status, and technical context.
- `clawdeploy-nginx`: reverse proxy to expose a single entrypoint.
- `subagent` image: on demand worker container that runs the coding agent CLI and exits when work is done.

### Core Source Modules

- `main-agent/src/phoung.ts`: session lifecycle, model routing, stream handling for chat.
- `main-agent/src/extension.ts`: custom tool definitions exposed to Phoung.
- `main-agent/src/spawner.ts`: Docker orchestration for sub agent runs.
- `main-agent/src/memory.ts`: task files, conversation files, activity logs, memory documents.
- `main-agent/src/github.ts`: GitHub PR operations such as list, details, merge, close.
- `main-agent/src/server.ts`: REST and SSE transport layer for UI and automation.

### Agent Workflow

1. You send a request in the UI.
2. API streams request to a Phoung session.
3. Phoung can call custom tools such as `spawn_subagent` or `update_task`.
4. Spawner launches a sub agent container with project context and prompt.
5. Sub agent performs coding work in git, then opens a merge request.
6. Task metadata and activity logs are written to `memory/projects/<project>/tasks`.
7. You review, approve, and merge.

### Tooling Model

Phoung uses native pi-mono tool calls.  
Custom tools currently include:

- `spawn_subagent`
- `list_tasks`
- `update_task`
- `ask_human`
- `check_prs`
- `create_memory`

Built in tools such as file read, write, edit, and shell remain available through pi-mono.

### Persistence Model

- `memory/system-prompt.md`: primary behavior and operating constraints.
- `memory/subagent-prompt.md`: worker template used during spawn.
- `memory/overview.md`: cross project context index.
- `memory/sessions/`: pi-mono session files.
- `memory/projects/<project>/`: project context, memories, conversations, active tasks, completed tasks.

This structure keeps project history and decision context available across sessions.

### API Surface

Key endpoints:

- `GET /health`
- `GET /tasks`
- `GET /tasks/:taskId`
- `POST /tasks/:taskId/merge`
- `POST /tasks/:taskId/reject`
- `GET /tasks/:taskId/activity`
- `GET /tasks/:taskId/runs/:run/log`
- `GET /tasks/:taskId/pr-info`
- `POST /chat` (SSE streaming)
- `GET /conversations`
- `GET /conversations/:convId`
- `POST /conversations/new`
- `GET /models`
- `GET /projects`
- `GET /logs/:service`
- `POST /cron/wake`

## Setup

### Prerequisites

- Docker host
- Ansible 2.15 or newer
- SSH access
- API credentials for your selected model providers and GitHub

### Configuration

Create `.env` at repo root with values such as:

```env
KIMI_API_KEY=
ZAI_API_KEY=
ANTHROPIC_API_KEY=
GITHUB_TOKEN=
DEFAULT_MODEL=
SUBAGENT_MODEL=
MAX_CONCURRENT_SUBAGENTS=3
SUBAGENT_IMAGE=clawdeploy/subagent:latest
SUBAGENT_MEMORY_LIMIT=4g
SUBAGENT_CPUS=2
```

### Deploy

```bash
source .env
cd deploy
./deploy.sh deploy-v2
```

### Access UI

```bash
./deploy.sh tunnel
```

Open `http://localhost:8080`.

## Secret Safety Before Push

- Keep real credentials only in `.env` or secure secret managers, never in tracked files.
- `.gitignore` already excludes `.env` and `.env.*` except explicit examples.
- Before every push, run a quick staged scan:

```bash
git diff --cached | rg -n "sk-|github_pat_|AKIA|BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY|API_KEY=|TOKEN="
```

- If a match appears, remove it from staged changes before push.

## Stack

TypeScript, Express, React, Vite, Tailwind, Docker, pi-mono SDK, Ansible.
