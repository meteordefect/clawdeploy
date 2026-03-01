# Agent Swarm Implementation Plan

One-person dev team: OpenClaw orchestrator spawning Claude Code / Codex agents across git worktrees, monitored by cron, with Telegram review notifications, multi-model PR review, and Google Search Console integration for SEO.

---

## Model Lineup

| Role | Provider | Model | Key needed | Status |
|---|---|---|---|---|
| Base / Chat | `zhipu` | `glm-4.7-flash` | `ZHIPU_API_KEY` | Already in `.env.example` |
| Kimi K2.5 | `moonshot` | `kimi-k2.5` via `api.moonshot.ai/v1` | `MOONSHOT_API_KEY` | Need to add |
| Claude Sonnet 4.6 | `anthropic` | `claude-sonnet-4-5` | `ANTHROPIC_API_KEY` | Need to add |
| Kimi Coding (`k2p5`) | ~~`kimi-coding`~~ | Broken — OpenClaw issue #22409 | — | Skip until fixed |

> Kimi K2.5 is accessed via the **moonshot** provider, not `kimi-coding`. The `kimi-coding` endpoint stopped working in OpenClaw 2026.2.2 (still broken in 2026.2.6-3). When #22409 is resolved, run `openclaw onboard --token-provider kimi-coding` to re-enable without touching anything else.

---

## Architecture Overview

```
You (Telegram / Dashboard)
        │
        ▼
  OpenClaw Orchestrator ("Zoe")
  - Loads context from context/ vault
  - Routes tasks to right agent type
  - Assembles detailed prompts
  - Calls spawn-agent.sh
        │
        ▼
  scripts/spawn-agent.sh
  - git worktree add → isolated branch
  - tmux new-session → named session
  - Launches: claude --dangerously-skip-permissions
             or: codex --dangerously-bypass-approvals
  - Writes to .clawdbot/active-tasks.json
        │
        ▼
  Coding Agent (Claude Code / Codex)
  - Works in isolated worktree
  - Commits → pushes → gh pr create --fill
        │
        ▼
  scripts/check-agents.sh  (cron every 10 min)
  - Reads .clawdbot/active-tasks.json
  - Checks tmux sessions alive
  - Polls gh pr view --json
  - Checks CI via gh run list
  - Sends Telegram alert when all checks pass
        │
        ▼
  You review PR (5-10 min) → merge
        │
        ▼
  scripts/cleanup-agents.sh  (daily cron)
  - Prunes stale worktrees
  - Archives completed tasks
```

---

## Phase 1 — Model Configuration

**Goal:** Wire Kimi K2.5 and Claude Sonnet 4.6 into the OpenClaw environment.

**Files to change:**
- `deploy/.env.example` — add `MOONSHOT_API_KEY`, `ANTHROPIC_API_KEY`
- `deploy/docker-compose.yml` — pass new keys to `openclaw-gateway` service

**Setup steps (on the machine running OpenClaw):**
```bash
# Kimi K2.5 via Moonshot
openclaw onboard --token-provider moonshot --token $MOONSHOT_API_KEY

# Claude Sonnet 4.6 via Anthropic API key
openclaw onboard --token-provider anthropic --token $ANTHROPIC_API_KEY
# OR via Claude Code setup-token:
# claude setup-token  (then paste token into openclaw onboard)
```

**Verification:**
```bash
openclaw models list
# Should show: moonshot/kimi-k2.5, anthropic/claude-*, zhipu/glm-*
```

---

## Phase 2 — Context Vault (Obsidian replacement)

**Goal:** A git-synced markdown vault the orchestrator reads before assembling any agent prompt. No new tools, no paid services — just files in this repo.

**Why not Obsidian:** Obsidian Sync is paid. Git is already here. OpenClaw's file skills read the filesystem directly. Any editor works.

**Directory structure to create:**
```
context/
├── README.md              # How to use this vault
├── business/
│   └── overview.md        # What you're building, ICP, positioning
├── customers/
│   └── _template.md       # One file per customer
├── meetings/
│   └── _template.md       # One file per meeting (date-named)
├── decisions/
│   └── _template.md       # ADR-style: what, why, what we tried
└── learnings/
    └── agent-prompts.md   # What prompt patterns work, which models for what
```

**How the orchestrator uses it:**
1. Before spawning any agent, reads relevant `context/` files
2. Injects customer history, past decisions, and working prompt patterns into the coding agent's prompt
3. After a successful PR merge, appends to `context/learnings/agent-prompts.md`

---

## Phase 3 — Agent Swarm Scripts

**Goal:** The mechanical engine of the system. Spawn → monitor → notify → cleanup.

### 3a. `.clawdbot/active-tasks.json`

Task registry. Written by `spawn-agent.sh`, read by `check-agents.sh`.

```json
{
  "tasks": [
    {
      "id": "feat-example",
      "tmuxSession": "codex-example",
      "agent": "claude",
      "description": "Short description of the task",
      "repo": "your-repo-name",
      "worktree": "feat-example",
      "branch": "feat/example",
      "startedAt": 1740268800000,
      "status": "running",
      "notifyOnComplete": true,
      "pr": null,
      "completedAt": null,
      "checks": {}
    }
  ]
}
```

Status lifecycle: `running` → `pr-open` → `ci-pending` → `reviewing` → `done` | `failed`

### 3b. `scripts/spawn-agent.sh`

Usage: `./scripts/spawn-agent.sh <task-id> <description> <agent: claude|codex> <model>`

What it does:
1. Creates git worktree: `git worktree add ../worktrees/<task-id> -b feat/<task-id> origin/main`
2. Installs deps in worktree
3. Opens tmux session: `tmux new-session -d -s "<agent>-<task-id>" -c <worktree-path>`
4. Launches agent with prompt via `tmux send-keys`
5. Writes task entry to `.clawdbot/active-tasks.json`

Agent launch commands:
```bash
# Claude Code
claude --model claude-sonnet-4-5 \
  --dangerously-skip-permissions \
  -p "$PROMPT"

# Codex (when available)
codex --model gpt-4o \
  --dangerously-bypass-approvals-and-sandbox \
  "$PROMPT"
```

### 3c. `scripts/check-agents.sh`

Runs every 10 minutes via cron. Fully deterministic, token-efficient (no LLM calls).

Checks per task:
1. `tmux has-session -t <session>` — is agent still alive?
2. `gh pr list --head feat/<task-id>` — has a PR been created?
3. `gh run list --branch feat/<task-id>` — is CI passing?
4. All checks passing? → send Telegram notification

Auto-respawn logic: if tmux session dead and status != done/failed, respawn up to 3 times.

Sends Telegram via OpenClaw:
```bash
openclaw message send --channel telegram --to "$TELEGRAM_CHAT_ID" \
  "PR #$PR_NUM ready for review: $PR_TITLE\n$PR_URL"
```

### 3d. `scripts/cleanup-agents.sh`

Runs daily via cron. Removes worktrees for tasks with status `done` older than 7 days.

```bash
git worktree remove ../worktrees/<task-id> --force
```

---

## Phase 4 — Orchestrator Agent Setup

**Goal:** Configure a named OpenClaw agent ("Zoe") that holds business context, routes tasks, spawns agents, and monitors to completion.

**System prompt structure:**
```
You are Zoe, orchestrator for [business name].

Your context vault is at ~/clawdeploy/context/. Read it before every task.

Model routing:
- Backend logic, complex bugs, multi-file: Claude Code (claude-sonnet-4-5)
- Frontend UI work: Claude Code (claude-sonnet-4-5)  
- Design specs first: Kimi K2.5 (moonshot/kimi-k2.5) → then Claude to implement
- Quick tasks, chat: GLM-4.7-flash

When asked to implement a feature:
1. Read relevant context/ files
2. Scope the task clearly
3. Run: scripts/spawn-agent.sh <id> "<description>" claude claude-sonnet-4-5
4. Monitor via: scripts/check-agents.sh --task <id>
5. Notify me on Telegram when PR is ready

Definition of done for every agent:
- PR created with gh pr create --fill
- No merge conflicts with main
- CI passing (lint, types, tests)
- Screenshots in PR description if UI changed
```

**OpenClaw agent config location:** `~/.openclaw/agents/<agent-id>/config.yaml`

---

## Phase 5 — GitHub + Telegram Wiring

**Goal:** Close the loop between agent PR creation and human review notification.

**Coding agent prompt boilerplate (injected by spawn-agent.sh):**
```
When your work is complete:
1. git add -A && git commit -m "feat: <description>"
2. git push origin feat/<task-id>
3. gh pr create --fill --body "$(cat <<'EOF'
## Summary
<describe what you built>

## Test plan
- [ ] CI passing
- [ ] Manual smoke test

## Screenshots
<if UI changes, paste screenshots here>
EOF
)"
4. Exit cleanly.
```

**Telegram notification (check-agents.sh calls this when all checks pass):**
```bash
openclaw message send \
  --channel telegram \
  --to "$TELEGRAM_OWNER_CHAT_ID" \
  "✅ PR #$PR_NUM ready: $PR_TITLE — $PR_URL"
```

**Cron setup (add to crontab):**
```cron
*/10 * * * * /path/to/clawdeploy/scripts/check-agents.sh >> /tmp/claw-monitor.log 2>&1
0 2  * * * /path/to/clawdeploy/scripts/cleanup-agents.sh >> /tmp/claw-cleanup.log 2>&1
```

---

## Phase 6 — Google Search Console Integration

**Goal:** Agent can pull GSC data, identify SEO opportunities, and implement fixes.

### Setup steps:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → enable **Search Console API** and **Google Analytics Data API**
3. Create a service account → grant it **Read** access to your Search Console property
4. Download service account JSON → save as `~/.openclaw/credentials/gsc-service-account.json`
5. Add `GOOGLE_SERVICE_ACCOUNT_JSON_PATH` to `.env.example`

### What the agent can do:

**Pull opportunity data:**
```bash
# Top queries ranked 6-20 (low-hanging fruit)
# High impressions, low CTR pages (title/meta fixes)
# Pages losing ranking over time
```

**OpenClaw skill to create:** `skills/google-search-console/`
- `fetch-queries.ts` — pulls top queries, filters by position 6-20
- `fetch-ctr-issues.ts` — pulls pages with CTR < 2% and impressions > 500
- `generate-recommendations.ts` — formats findings for orchestrator prompt

**Agent workflow:**
1. Zoe runs GSC skill weekly (cron) or on demand
2. Formats top 5 opportunities into a task list
3. For each: spawns a coding agent with the page URL + query data + instruction to fix title/meta/content
4. Agent edits the file, creates PR
5. You review and merge

### Websites to add GSC access for:
- [ ] Add your Search Console property URL here when ready

---

## Implementation Order

| # | Phase | Est. time | Unblocks |
|---|---|---|---|
| 1 | Model config (env + onboard) | 1 hr | Multi-model from day one |
| 2 | Context vault (create dirs + seed files) | 30 min | Orchestrator usefulness |
| 3 | Swarm scripts (spawn + check + cleanup) | 3 hrs | Core automation loop |
| 4 | Orchestrator setup (Zoe system prompt) | 2 hrs | Hands-free task routing |
| 5 | GitHub + Telegram wiring | 1 hr | Review notifications |
| 6 | Google Search Console integration | 3 hrs | SEO automation |

**Total estimated:** ~10-11 hours of focused work

---

## Open Questions / Decisions Needed

- [ ] **Which repo(s) will agents work on?** Worktrees need a target repo path.
- [ ] **Codex or Claude Code as primary workhorse?** Article recommends Codex for backend, Claude Code for frontend. Do you have a Codex subscription?
- [ ] **What Telegram chat ID should Zoe notify?** Personal DM or a dedicated group?
- [ ] **Which websites/domains get GSC access?** Need property URLs for service account grant.
- [ ] **Mac Mini or remote VPS for running agents?** Affects where scripts live and tmux sessions run. Currently infra is on Hetzner — agents could also run there, but tmux + Claude Code on VPS vs local has tradeoffs.
