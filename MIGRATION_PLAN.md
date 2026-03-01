# ClawDeploy v4 — Middle Manager Migration Plan

**From:** Self-hosted OpenClaw control plane (dashboard + agent bridge)
**To:** Git-project-centric agent orchestrator that spawns coding sub-agents, creates PRs, and queues merges for human approval

**Core idea:** OpenClaw (GLM) is the persistent manager. You talk to it. It spawns coding sub-agents (Claude Code, Kimi K2.5, Codex) that work in isolated worktrees, push branches, and open PRs. You come back and approve merges. That's all this thing does.

---

## What Changes vs. Current System

| Current (v3) | Target (v4) |
|---|---|
| Single OpenClaw agent managed via dashboard | OpenClaw **is** the manager; sub-agents do the work |
| Missions = abstract objectives you queue | Tasks = concrete coding instructions that spawn sub-agents |
| Commands = generic payloads polled by agent bridge | Commands replaced by `spawn-agent` + `check-agents` scripts |
| No git integration | Git worktrees, branches, PRs, merge queue |
| One flat agent list | Projects as top-level entity, each with its own agents/tasks |
| Chat = talk to OpenClaw gateway | Chat = give instructions to the manager, who dispatches work |
| Agent bridge polls for generic commands | Sub-agents are spawned processes (tmux + claude/codex CLI) |

---

## Architecture

```
You (Dashboard tab per project)
        │
        ▼
  OpenClaw Manager (GLM-4.7-flash)
  ├── Persistent, remembers context across sessions
  ├── Reads context/ vault per project
  ├── Routes tasks to right model:
  │     GLM → manages, plans, responds to you
  │     Kimi K2.5 → coding tasks
  │     Claude Code → complex/multi-file tasks
  ├── Calls spawn-agent.sh per task
  └── Monitors via check-agents.sh
        │
        ▼
  Sub-Agents (tmux sessions)
  ├── Each works in isolated git worktree
  ├── Commits → pushes → gh pr create
  └── Exits when done
        │
        ▼
  Merge Queue (dashboard)
  ├── PRs listed per project
  ├── CI status shown
  ├── You approve → merge
  └── (Later: auto-merge when tests pass)
```

---

## Data Model Changes

### New table: `projects`

The top-level entity. One tab per project in the dashboard.

```sql
CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,                    -- "clawdeploy", "friendlabs-site"
  repo_url    TEXT NOT NULL,                    -- "git@github.com:marten/clawdeploy.git"
  repo_path   TEXT NOT NULL,                    -- "/home/marten/repos/clawdeploy"
  default_branch TEXT NOT NULL DEFAULT 'main',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Evolve `missions` → `tasks`

Rename and add git/agent fields. Each task = one sub-agent = one branch = one PR.

```sql
CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id),
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,                  -- full prompt for the sub-agent
  status        TEXT NOT NULL DEFAULT 'pending',
  -- pending → spawned → coding → pr_open → ci_pending → review → merged → failed
  agent_type    TEXT NOT NULL DEFAULT 'claude',  -- claude | codex | kimi
  model         TEXT,                            -- claude-sonnet-4-5, kimi-k2.5, etc.
  branch        TEXT,                            -- feat/task-<short-id>
  worktree_path TEXT,                            -- ../worktrees/<project>-<short-id>
  tmux_session  TEXT,                            -- agent session name
  pr_number     INTEGER,
  pr_url        TEXT,
  ci_status     TEXT,                            -- pending | passing | failing
  spawn_retries INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);
```

### Keep `events` (audit log)

Add `project_id` and `task_id` foreign keys. Event types expand:

```
task_created, agent_spawned, agent_exited, pr_opened, ci_passed,
ci_failed, review_requested, merged, merge_conflict, agent_respawned
```

### Drop or deprecate

- `commands` table — replaced by tasks + spawn scripts
- `agents` table — the old agent-bridge model is replaced by ephemeral sub-agents tracked in `tasks`
- `missions` table — replaced by `tasks`

Keep the old tables but stop writing to them. No destructive migration.

---

## Dashboard Changes

### UI Framework: shadcn/ui

All dashboard UI will be rebuilt using **shadcn/ui** components. The current dashboard already runs Vite + React + TypeScript + Tailwind with CSS custom properties (`--radius`, `--color-*`), which is very close to shadcn's conventions.

**Setup required:**
1. Add `@` path alias to `tsconfig.json` and `vite.config.ts`
2. Run `npx shadcn@latest init` — generates `components.json` + `src/components/ui/`
3. Map existing CSS custom properties to shadcn's expected tokens (`--background`, `--foreground`, `--card`, `--primary`, etc.) or let shadcn overwrite them
4. Install components as needed: `npx shadcn@latest add tabs card badge button dialog table select textarea dropdown-menu sheet separator scroll-area`

**shadcn components → dashboard features mapping:**

| shadcn Component | Used For |
|---|---|
| `Tabs` | Project tab bar (top-level navigation between repos) |
| `Card` | Task cards, merge queue items, project summary stats |
| `Badge` | Task status (pending / coding / PR open / review / merged / failed) |
| `Button` | Actions (New Task, Merge, Cancel, Retry) |
| `Dialog` | New task form, project setup, confirm merge |
| `Table` | Merge queue list, activity log |
| `Select` | Agent type picker (claude / kimi / codex), model picker |
| `Textarea` | Task description input |
| `DropdownMenu` | Task actions (cancel, retry, view PR, view logs) |
| `Sheet` | Mobile sidebar navigation |
| `Separator` | Visual dividers |
| `ScrollArea` | Chat message list, activity feed |
| `Tooltip` | Status explanations, timestamps |
| `Skeleton` | Loading states (replaces spinners per DESIGN.md) |

**What this replaces:** The current hand-rolled `Card`, `Button`, `Modal`, `Badge`, `StatusBadge` components in `src/components/` get replaced by shadcn equivalents. Existing Lucide icon usage stays — shadcn uses Lucide too.

### Navigation: Project Tabs

Replace the current sidebar with a project-scoped layout using shadcn `Tabs`:

```
┌──────────────────────────────────────────────────────┐
│  [ClawDeploy]   [Project A ▼]  [Project B]  [+ Add] │  ← shadcn Tabs
├──────────────────────────────────────────────────────┤
│  Sidebar (per project):                              │  ← shadcn Sheet (mobile)
│    Tasks                                             │
│    Merge Queue                                       │
│    Chat (with manager)                               │
│    Activity                                          │
│    Settings                                          │
├──────────────────────────────────────────────────────┤
│  Main content area                                   │
└──────────────────────────────────────────────────────┘
```

### View: Tasks (replaces Missions)

Built with shadcn `Card` + `Badge` + `Button` + `Dialog`.

Each task card shows:
- Title + description snippet
- `Badge` for status (pending / coding / PR open / CI passing / review / merged)
- Agent type + model
- Branch name
- PR link (when open)
- Time elapsed

Actions:
- **New Task** (`Dialog` with `Textarea` + `Select`) — describe what you want done, pick agent type
- **Bulk Task** — paste a list, manager breaks them up (via OpenClaw chat)
- **Cancel** (`DropdownMenu` action) — kills tmux session, cleans worktree

### View: Merge Queue (new)

Built with shadcn `Table` + `Badge` + `Button`.

Shows all tasks with status `pr_open` or later:
- PR title + link
- CI status badge (green/red/pending)
- Diff stats (+/- lines)
- **Approve & Merge** `Button` → calls `gh pr merge`
- **Request Changes** `Button` → sends message back to manager
- Merge conflict indicator

### View: Chat (evolve existing)

Same chat UI but now scoped to the active project. Uses shadcn `ScrollArea` for message list, `Textarea` + `Button` for input. Messages go to the OpenClaw manager. The manager can:
- Accept task descriptions and spawn sub-agents
- Report on task status
- Answer questions about the project (reads context vault)

### Views to remove or demote

- **Agents** — no longer a top-level concept; sub-agents are shown inline on task cards
- **Files** — move to project Settings (still useful for editing OpenClaw config)
- **Sessions** — fold into Activity log
- **Overview** — replace with a per-project summary at the top of Tasks view

---

## Scripts (from SWARM_PLAN.md, refined)

All scripts live in `scripts/`. The Control API calls them via `child_process.exec`.

### `scripts/spawn-agent.sh`

```
Usage: spawn-agent.sh <project-id> <task-id> <description> <agent-type> <model> <repo-path>
```

Steps:
1. `git worktree add ../worktrees/<project>-<task-short-id> -b feat/<task-short-id> origin/<default-branch>`
2. `cd` into worktree, install deps if needed
3. `tmux new-session -d -s "claw-<task-short-id>"`
4. Build prompt: inject task description + project context + PR instructions
5. Launch agent in tmux:
   - Claude: `claude --model <model> --dangerously-skip-permissions -p "$PROMPT"`
   - Codex: `codex --model <model> --dangerously-bypass-approvals-and-sandbox "$PROMPT"`
   - Kimi: route through OpenClaw with `kimi-k2.5` model
6. Update task status → `spawned` via Control API

### `scripts/check-agents.sh`

Runs on cron (every 5 min) or triggered by dashboard poll.

Per active task:
1. `tmux has-session -t "claw-<task-short-id>"` — still alive?
2. If dead + no PR → mark `failed`, optionally respawn (up to 3 retries)
3. `gh pr list --repo <repo> --head feat/<task-short-id> --json number,url,title` — PR created?
4. If PR found → update task with `pr_number`, `pr_url`, status → `pr_open`
5. `gh pr checks <pr-number> --repo <repo>` — CI status?
6. If all checks pass → status → `review`, notify via dashboard + Telegram

### `scripts/cleanup-agents.sh`

Daily cron. For tasks with status `merged` or `failed` older than 7 days:
1. `git worktree remove ../worktrees/<project>-<task-short-id> --force`
2. `tmux kill-session -t "claw-<task-short-id>"` (if still around)
3. Archive task in events log

### `scripts/merge-pr.sh`

Called by dashboard "Approve & Merge" button:
1. `gh pr merge <pr-number> --repo <repo> --squash --delete-branch`
2. Update task status → `merged`
3. Clean up worktree
4. Log event

---

## Control API Changes

### New routes

```
POST   /api/projects                  — create project (name, repo_url, repo_path)
GET    /api/projects                  — list all projects
GET    /api/projects/:id              — get project details
PUT    /api/projects/:id              — update project
DELETE /api/projects/:id              — delete project

GET    /api/projects/:id/tasks        — list tasks for project
POST   /api/projects/:id/tasks        — create task (spawns sub-agent)
GET    /api/tasks/:id                 — task detail
POST   /api/tasks/:id/cancel          — cancel task (kill agent, clean worktree)
POST   /api/tasks/:id/retry           — respawn failed task

GET    /api/projects/:id/merge-queue  — tasks with PRs ready for review
POST   /api/tasks/:id/merge           — approve and merge PR
POST   /api/tasks/:id/request-changes — send feedback to manager

GET    /api/projects/:id/activity     — events for project
```

### Routes to deprecate

- `/api/agents/*` — old agent-bridge polling model
- `/api/missions/*` — replaced by tasks
- `/api/commands/*` — replaced by spawn scripts

Keep them running but add deprecation header. Remove in v5.

### New service: `TaskRunner`

A service class in the Control API that:
1. Receives a task creation request
2. Calls `spawn-agent.sh` via `child_process.execFile`
3. Updates task status in DB
4. Exposes status via API for dashboard polling

### Cron integration

The Control API starts a `setInterval` (or node-cron) that runs `check-agents.sh` every 5 minutes. Results update task statuses in Postgres.

---

## Model Routing (Dual Mode)

| Role | Provider | Model | When |
|---|---|---|---|
| Manager / Chat / Planning | zhipu | glm-4.7-flash | Always-on, handles your instructions |
| Coding (default) | moonshot | kimi-k2.5 | Most coding tasks — fast, cheap |
| Coding (complex) | anthropic | claude-sonnet-4-5 | Multi-file, refactors, debugging |
| Coding (alternative) | openai | codex / gpt-4o | If user prefers Codex CLI |

The manager (GLM) decides which coding model to use based on task complexity, or the user can override when creating a task.

---

## Migration Phases

### Phase 1 — Database + Projects (Day 1)

**Goal:** Add `projects` and `tasks` tables. Wire up CRUD routes.

Files touched:
- `deploy/control-api/src/db/migrations/002_projects_tasks.sql` — new migration
- `deploy/control-api/src/routes/projects.ts` — new route file
- `deploy/control-api/src/routes/tasks.ts` — new route file
- `deploy/control-api/src/index.ts` — register new routes

**No dashboard changes yet.** Test via curl.

Estimated: 2-3 hours

---

### Phase 2 — Spawn + Check Scripts (Day 1-2)

**Goal:** Working agent spawn and monitoring loop.

Files to create:
- `scripts/spawn-agent.sh`
- `scripts/check-agents.sh`
- `scripts/cleanup-agents.sh`
- `scripts/merge-pr.sh`

Files touched:
- `deploy/control-api/src/services/task-runner.ts` — new service
- `deploy/control-api/src/routes/tasks.ts` — wire spawn on POST

Test manually: create a task via API → agent spawns in tmux → codes → PR appears.

Estimated: 3-4 hours

---

### Phase 3a — shadcn/ui Setup (Day 2)

**Goal:** Initialize shadcn/ui in the dashboard. Replace hand-rolled components with shadcn equivalents.

Steps:
1. Add `@` path alias to `tsconfig.json` (`"paths": { "@/*": ["./src/*"] }`) and `vite.config.ts` (`resolve.alias`)
2. `npx shadcn@latest init` in `deploy/dashboard/`
3. Install needed components: `npx shadcn@latest add tabs card badge button dialog table select textarea dropdown-menu sheet separator scroll-area tooltip skeleton`
4. Map existing CSS custom properties to shadcn tokens (or adopt shadcn's defaults and re-apply DESIGN.md palette)
5. Delete old hand-rolled components: `Card.tsx`, `Button.tsx`, `Modal.tsx`, `Badge.tsx`, `StatusBadge.tsx`

Files touched:
- `deploy/dashboard/tsconfig.json` — add path alias
- `deploy/dashboard/vite.config.ts` — add resolve alias
- `deploy/dashboard/tailwind.config.js` — shadcn init will extend this
- `deploy/dashboard/src/lib/utils.ts` — shadcn creates this (`cn()` helper)
- `deploy/dashboard/src/components/ui/*` — shadcn generates these
- `deploy/dashboard/src/components/*.tsx` — remove old hand-rolled components
- `deploy/dashboard/src/index.css` — shadcn CSS variables layer

Estimated: 1-2 hours

---

### Phase 3b — Dashboard: Project Tabs + Tasks View (Day 2-3)

**Goal:** Replace flat sidebar with project-scoped navigation using shadcn Tabs. Tasks view replaces Missions.

Files touched:
- `deploy/dashboard/src/App.tsx` — add project routing
- `deploy/dashboard/src/components/Layout.tsx` — project tab bar (shadcn `Tabs`)
- `deploy/dashboard/src/views/TasksView.tsx` — new, built with shadcn `Card` + `Badge` + `Dialog`
- `deploy/dashboard/src/views/MergeQueueView.tsx` — new, built with shadcn `Table` + `Badge`
- `deploy/dashboard/src/api/client.ts` — add project + task API calls
- `deploy/dashboard/src/types.ts` — add Project, Task types

Remove or hide:
- `deploy/dashboard/src/views/AgentsView.tsx`
- `deploy/dashboard/src/views/MissionsView.tsx`

Estimated: 3-4 hours

---

### Phase 4 — Chat → Manager Integration (Day 3)

**Goal:** Chat view talks to OpenClaw manager, scoped per project. Manager can accept task descriptions and spawn agents.

Files touched:
- `deploy/dashboard/src/views/ChatView.tsx` — add project context
- `deploy/dashboard/src/hooks/useOpenClawChat.ts` — scope sessions per project
- OpenClaw agent config (on the machine running OpenClaw):
  - System prompt: add tool-use instructions for `spawn-agent.sh`
  - Context vault: `context/<project-name>/` per project

The key integration: when you tell the manager "fix the login bug and update the README", it breaks that into 2 tasks and calls the task creation API for each.

Estimated: 2-3 hours

---

### Phase 5 — Merge Queue + Approval Flow (Day 3-4)

**Goal:** Dashboard shows PRs ready for review. One-click merge.

Files touched:
- `deploy/dashboard/src/views/MergeQueueView.tsx` — flesh out
- `deploy/control-api/src/routes/tasks.ts` — add merge + request-changes endpoints
- `scripts/merge-pr.sh` — implement

Estimated: 2-3 hours

---

### Phase 6 — Polish + Telegram Notifications (Day 4)

**Goal:** Notification when PR is ready. Activity feed per project. Status summary.

Files touched:
- `scripts/check-agents.sh` — add Telegram notification call
- `deploy/dashboard/src/views/ActivityView.tsx` — project-scoped events
- `deploy/control-api/src/routes/events.ts` — add project_id filter

Estimated: 2 hours

---

## What We're NOT Doing (Yet)

- **Auto-merge flow** — Phase 2 of the roadmap. Requires CI integration and confidence scoring.
- **Multi-model PR review** — Later. Manager could spawn a review agent that reads the diff before merge.
- **Google Search Console integration** — Separate feature from SWARM_PLAN.md Phase 6. Not part of this migration.
- **Obsidian integration** — Using git-synced context vault instead.
- **WebSocket push** — Dashboard still polls. Good enough for now.
- **Multi-tenant** — Single user (you). No auth beyond Nginx basic auth.

---

## Key Decisions Needed

1. **Where do sub-agents run?** The machine running the Control API needs `claude`, `codex`, `gh`, `tmux`, and `git` installed. This likely means your Mac or a beefy VPS — not the current CX22 Hetzner box.

2. **Kimi K2.5 as CLI or API?** Claude Code and Codex have CLI tools that run in tmux. Kimi K2.5 doesn't have a CLI — it would need to be invoked via OpenClaw's chat (which already supports moonshot provider) or via a thin wrapper script that calls the Moonshot API and applies diffs.

3. **How does the manager spawn agents?** Two options:
   - **A)** Manager has a tool/skill that calls the Control API endpoint, which calls `spawn-agent.sh`
   - **B)** Manager calls `spawn-agent.sh` directly via shell tool
   - Recommend **A** — keeps the API as single source of truth, dashboard stays in sync.

4. **One manager per project or one global manager?** The article uses one manager per project. With OpenClaw you could have one manager with project context switching, or multiple named agents. One global manager with project context switching is simpler to start.

---

## Estimated Total Effort

| Phase | Est. Hours |
|---|---|
| 1. Database + Projects | 2-3 |
| 2. Spawn + Check Scripts | 3-4 |
| 3a. shadcn/ui Setup | 1-2 |
| 3b. Dashboard: Tabs + Tasks | 3-4 |
| 4. Chat → Manager | 2-3 |
| 5. Merge Queue | 2-3 |
| 6. Polish + Notifications | 2 |
| **Total** | **15-21 hours** |

Spread across 4 focused days, or 1 week at regular pace.

---

## File Inventory (What Gets Created / Changed)

### New files
- `deploy/control-api/src/db/migrations/002_projects_tasks.sql`
- `deploy/control-api/src/routes/projects.ts`
- `deploy/control-api/src/routes/tasks.ts`
- `deploy/control-api/src/services/task-runner.ts`
- `deploy/dashboard/src/views/TasksView.tsx`
- `deploy/dashboard/src/views/MergeQueueView.tsx`
- `scripts/spawn-agent.sh`
- `scripts/check-agents.sh`
- `scripts/cleanup-agents.sh`
- `scripts/merge-pr.sh`

### Modified files
- `deploy/control-api/src/index.ts`
- `deploy/control-api/src/db/migrate.ts`
- `deploy/dashboard/tsconfig.json` — add `@` path alias for shadcn
- `deploy/dashboard/vite.config.ts` — add resolve alias for shadcn
- `deploy/dashboard/tailwind.config.js` — shadcn extends this
- `deploy/dashboard/src/index.css` — shadcn CSS variables
- `deploy/dashboard/src/App.tsx`
- `deploy/dashboard/src/components/Layout.tsx`
- `deploy/dashboard/src/api/client.ts`
- `deploy/dashboard/src/types.ts`
- `deploy/dashboard/src/views/ChatView.tsx`
- `deploy/dashboard/src/hooks/useOpenClawChat.ts`
- `deploy/.env.example`

### Generated by shadcn (auto)
- `deploy/dashboard/components.json`
- `deploy/dashboard/src/lib/utils.ts`
- `deploy/dashboard/src/components/ui/*.tsx` — all installed shadcn components

### Deleted (replaced by shadcn)
- `deploy/dashboard/src/components/Card.tsx`
- `deploy/dashboard/src/components/Button.tsx`
- `deploy/dashboard/src/components/Modal.tsx`
- `deploy/dashboard/src/components/Badge.tsx`
- `deploy/dashboard/src/components/StatusBadge.tsx`

### Deprecated (kept but unused)
- `deploy/control-api/src/routes/missions.ts`
- `deploy/control-api/src/routes/commands.ts`
- `deploy/control-api/src/routes/agents.ts`
- `deploy/dashboard/src/views/MissionsView.tsx`
- `deploy/dashboard/src/views/AgentsView.tsx`
- `deploy/agent-bridge/` (entire module — replaced by spawn scripts)
