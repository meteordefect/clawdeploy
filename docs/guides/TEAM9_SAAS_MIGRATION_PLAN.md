# Team9-Parity SaaS Migration Plan

## Objective

Recreate Team9-style product capabilities in `clawdeploy` so you can run and sell a SaaS with:

- full auth (email/password, refresh tokens, Google OAuth, email verification)
- workspace-based multi-tenancy with membership roles
- OpenClaw as an installable application per workspace
- bot/agent lifecycle controls (start, stop, restart, device approval, agent CRUD)
- collaboration-ready backend foundations (realtime messaging/event architecture, storage, workers)

This plan assumes you have licensing clearance to use Team9 concepts and implementation patterns.

## Scope And Non-Goals

### In scope

- Product parity for auth, tenancy, OpenClaw app install lifecycle, and SaaS operations.
- Migration path from current `deploy/control-api` + `deploy/dashboard` + `deploy/agent-bridge` architecture.
- Incremental rollout that allows coexistence with your current mission-command model during transition.

### Out of scope

- Full visual cloning of Team9 frontend components.
- One-shot rewrite/cutover with no compatibility layer.
- Mobile/desktop packaging (can be added after web SaaS parity).

## Current State (ClawDeploy) vs Target State (Team9-Parity)

### Current

- API: `deploy/control-api` (Express, PostgreSQL)
- UI: `deploy/dashboard` (React + polling)
- Agent runtime bridge: `deploy/agent-bridge`
- Security: Nginx basic auth + per-agent bearer token
- Data model: `agents`, `missions`, `commands`, `events` (single-tenant style)

### Target

- API gateway: modular service architecture (Nest-like modules or equivalent domain modules)
- Auth domain: JWT ES256, refresh flow, email verification, OAuth
- Tenant domain: `tenants`, `tenant_members`, role-based access controls
- App install domain: installed applications table + handlers (OpenClaw first)
- OpenClaw integration domain: instance lifecycle, device approvals, agent CRUD
- Async services: worker bus (Redis + RabbitMQ equivalents), file/object storage

## Migration Strategy

Use a **strangler migration** in phases, not a hard rewrite:

1. Stand up new SaaS domains alongside existing APIs.
2. Keep legacy mission-command APIs operational during transition.
3. Move dashboard views one domain at a time.
4. Cut over tenant-aware routes and deprecate legacy auth once parity is proven.

## Phase Plan

## Phase 0 - Program Setup And Architecture Baseline (Week 1)

### Deliverables

- Final architecture decision record (ADR) for:
  - framework approach (keep Express + modularization vs migrate to NestJS)
  - service split (single service first, workers next)
  - tenancy model (workspace == tenant)
- Migration board with epics for Auth, Tenancy, OpenClaw App, Realtime, Billing/Ops.
- Shared contract doc for API versioning (`/v1` for new SaaS routes).

### Files/areas touched

- `docs/guides/` (ADR docs)
- `deploy/control-api/src/` (new `v1` route namespace scaffold)
- `deploy/dashboard/src/` (new API client namespace scaffold)

### Exit criteria

- Signed architecture and sequence.
- No production behavior changes yet.

---

## Phase 1 - Identity And Auth Platform (Weeks 2-3)

### Capability goals

- user registration/login/logout/me
- email verification tokens
- refresh tokens + rotation/blacklist
- optional Google OAuth login
- role-ready JWT payloads

### Backend components

- New auth module:
  - `deploy/control-api/src/routes/v1/auth/*`
  - `deploy/control-api/src/lib/auth/*` (token service, hashing, JWT, guards)
  - `deploy/control-api/src/lib/email/*` (verification emails)
- New tables:
  - `users`
  - `refresh_tokens`
  - `email_verification_tokens`

### Frontend components

- `deploy/dashboard/src/views/auth/*` (login, register, verify callback)
- `deploy/dashboard/src/api/auth.ts`
- auth state store and token refresh interceptor

### Exit criteria

- JWT access + refresh flow works end-to-end.
- Legacy basic auth can be toggled off in non-prod.

---

## Phase 2 - Multi-Tenant Foundation (Weeks 3-5)

### Capability goals

- workspace/tenant creation
- member invitations
- role model (`owner`, `admin`, `member`, `guest`)
- tenant resolution middleware (`x-tenant-id`, query, domain)

### Backend components

- New tenant middleware:
  - `deploy/control-api/src/middleware/tenant-context.ts`
- New tenant routes:
  - `deploy/control-api/src/routes/v1/workspaces/*`
  - `deploy/control-api/src/routes/v1/workspace-members/*`
  - `deploy/control-api/src/routes/v1/invitations/*`
- New tables:
  - `tenants`
  - `tenant_members`
  - `workspace_invitations`
  - `user_tenant_preferences` (optional, for default workspace)

### Frontend components

- Workspace switcher UI and invite management:
  - `deploy/dashboard/src/components/workspace/*`
  - `deploy/dashboard/src/views/workspace/*`

### Exit criteria

- Every business route can be scoped by tenant context.
- Permissions enforced server-side for admin/owner operations.

---

## Phase 3 - OpenClaw As Installable App (Weeks 5-7)

### Capability goals

- app catalog + install/uninstall flow
- OpenClaw handler on install/uninstall
- per-workspace `instancesId` configuration
- OpenClaw status/start/stop/restart APIs

### Backend components

- Applications domain:
  - `deploy/control-api/src/routes/v1/applications/*`
  - `deploy/control-api/src/routes/v1/installed-applications/*`
  - `deploy/control-api/src/lib/applications/handlers/openclaw.handler.ts`
- OpenClaw integration domain:
  - `deploy/control-api/src/lib/openclaw/openclaw.service.ts`
  - `deploy/control-api/src/lib/openclaw/openclaw.routes.ts`
- New tables:
  - `applications` (catalog)
  - `installed_applications` (tenant-app config with `instancesId`)
  - `bots` (with `extra.openclaw.agentId`, `extra.openclaw.workspace`)

### Frontend components

- OpenClaw install/config panel:
  - `deploy/dashboard/src/views/apps/OpenClawConfig.tsx`
  - `deploy/dashboard/src/api/applications.ts`

### Exit criteria

- A workspace admin can install OpenClaw and control instance lifecycle from UI.

---

## Phase 4 - Device Pairing And Agent/Bot Operations (Weeks 7-8)

### Capability goals

- list pending/paired devices
- approve/reject device requests
- create/delete OpenClaw agents (bot records + OpenClaw control plane calls)
- bot mentor assignment and display metadata

### Backend components

- Extend OpenClaw routes:
  - `/v1/installed-applications/:id/openclaw/devices`
  - `/v1/installed-applications/:id/openclaw/devices/approve`
  - `/v1/installed-applications/:id/openclaw/devices/reject`
  - `/v1/installed-applications/:id/openclaw/agents`
- Bot domain updates:
  - `deploy/control-api/src/routes/v1/bots/*`
  - `deploy/control-api/src/lib/bots/*`

### Frontend components

- Device queue UI and bot management table.

### Exit criteria

- Admin controls for pairing and agent lifecycle operate without direct OpenClaw shell access.

---

## Phase 5 - Realtime, Worker, And Storage Backbone (Weeks 8-10)

### Capability goals

- websocket events for workspace-level updates
- queue-backed background jobs
- object/file storage abstraction (S3/MinIO compatible)

### Backend components

- Introduce infra dependencies:
  - Redis
  - RabbitMQ (or equivalent queue)
  - S3/MinIO storage service
- Worker service (new):
  - `deploy/worker/` (job processors for async tasks, notifications, indexing)

### Infrastructure

- Update `deploy/docker-compose.yml` for Redis/RabbitMQ/MinIO.
- Add env and secrets management for new infra.

### Exit criteria

- Core SaaS workflows no longer rely solely on dashboard polling.

---

## Phase 6 - Data Migration And Backward Compatibility (Weeks 10-11)

### Goals

- Map existing entities into tenant-scoped schema.
- Preserve historical missions/events where needed.
- Keep legacy endpoints functional during transitional period.

### Migration design

- Seed `default` tenant.
- Map existing `agents` into `bots` + installed OpenClaw app context.
- Preserve mission/command history in legacy tables or archive schema.
- Add compatibility API adapters so old dashboard screens still load.

### Exit criteria

- Existing production data available in new tenant model.
- No mandatory downtime beyond planned maintenance window.

---

## Phase 7 - SaaS Operations Hardening (Weeks 11-12)

### Capability goals

- plan tiers (`free`, `pro`, `enterprise`)
- workspace limits and entitlement checks
- audit logs for security-critical actions
- tenant-aware observability and rate limits

### Components

- Billing/plan module:
  - `deploy/control-api/src/lib/billing/*`
- Audit module:
  - `deploy/control-api/src/lib/audit/*`
- Monitoring:
  - tenant-tagged logs, metrics, error alerts

### Exit criteria

- You can onboard/upgrade customers and enforce limits predictably.

---

## Phase 8 - Cutover And Decommission (Week 13)

### Activities

- Production cutover to SaaS-auth + tenant routing.
- Freeze legacy basic-auth dashboard paths.
- Decommission unused legacy mission-only routes after stabilization window.

### Exit criteria

- SaaS v1 is default for all new customers.
- Legacy components moved to maintenance or archived.

## Data Model Target (Minimum)

- `users`
- `tenants`
- `tenant_members`
- `workspace_invitations`
- `applications`
- `installed_applications`
- `bots`
- `email_verification_tokens`
- `refresh_tokens`
- `audit_logs`

## API Surface Target (Minimum)

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `GET /v1/auth/me`
- `GET /v1/workspaces`
- `POST /v1/workspaces`
- `POST /v1/workspaces/:id/invitations`
- `POST /v1/installed-applications`
- `DELETE /v1/installed-applications/:id`
- `GET /v1/installed-applications/:id/openclaw/status`
- `POST /v1/installed-applications/:id/openclaw/start`
- `POST /v1/installed-applications/:id/openclaw/stop`
- `GET /v1/installed-applications/:id/openclaw/devices`
- `POST /v1/installed-applications/:id/openclaw/devices/approve`
- `POST /v1/installed-applications/:id/openclaw/agents`

## Team And Execution Model

- Platform lead: API architecture + tenancy + auth.
- Integrations lead: OpenClaw service/handler + device workflows.
- Frontend lead: auth/workspace/apps UX.
- DevOps lead: Redis/RabbitMQ/MinIO, secrets, observability, rollout.

## Risks And Mitigations

- **Scope explosion** -> enforce phase gates and parity-first milestones.
- **Breaking existing flows** -> keep legacy APIs and build compatibility adapters.
- **Operational complexity** -> add infra one service at a time with runbooks.
- **Tenant security bugs** -> mandatory tenant context in middleware + authz tests per role.
- **Third-party dependency drift (OpenClaw APIs)** -> version-pin integration contracts.

## Go-Live Readiness Checklist

- Auth flow load-tested and token refresh stable.
- Tenant isolation test suite passes.
- OpenClaw install/start/stop/device approve/reject flows pass in staging.
- Billing/limits enforced and auditable.
- Rollback playbook validated.

## Recommended First Build Slice (2-Week MVP Inside This Plan)

Implement these first to de-risk:

1. `v1/auth` (register/login/refresh/me)
2. `v1/workspaces` + tenant middleware + role checks
3. `v1/installed-applications` with OpenClaw install + status + start/stop
4. dashboard workspace switcher + OpenClaw config panel

This yields immediate SaaS-shaped capability while preserving your existing mission-command system during migration.
