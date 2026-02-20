# Multi-Dashboard Architecture for ClawDeploy

This document describes how to support multiple dashboards, self-modifying dashboards with fallback, and third-party dashboard integration.

## Control-API Is Tied Only to the Default Dashboard

**The control-api is the backend for the default ClawDeploy dashboard only.** Custom and third-party dashboards each need their own API.

| Dashboard        | API                    |
|------------------|------------------------|
| Default (fallback) | control-api (current)  |
| Custom (OpenClaw-modified) | custom-api (its own backend) |
| Third-party      | its own API            |

**Implications:**

- **Default stack**: dashboard + control-api. Never modified. Served at `/`. Fallback target.
- **Custom stack**: custom dashboard + custom API. OpenClaw can modify both; they deploy together. On error, fallback to default stack.
- **Third-party**: each has its own dashboard + API; no shared control-api.
- The OpenClaw gateway is shared by all (or each stack can have its own gateway if needed).



## Goals

1. **Multiple dashboards** – Run different dashboard variants (default, custom, A/B)
2. **Self-modifying** – OpenClaw can modify its dashboard and deploy updates, with automatic fallback on build/deploy failure
3. **Third-party dashboards** – Connect dashboards installed elsewhere on the VPS; each runs its own API and uses the shared gateway

---

## Current Structure

- **Dashboard**: React/Vite app in `deploy/dashboard/`, built to Docker image, served on port 3000
- **Nginx**: Proxies `/` → dashboard (port 3000), `/api/` → control-api, `/gateway/ws` → OpenClaw gateway
- **OpenClaw**: Runs in Docker, has `openclaw-data` volume; no access to clawdeploy repo by default

---

## 1. Path-Based Dashboard Routing

Each dashboard stack (UI + API) runs on its own ports. Nginx routes by path:

| Path | Dashboard | API | Use Case |
|------|-----------|-----|----------|
| `/` or `/dashboard` | Default (port 3000) | control-api (port 3001) | Fallback, immutable |
| `/dashboard/custom` | Custom (port 3002) | custom-api (port 3003) | OpenClaw-modified |
| `/dashboard/team9` | Third-party (port 3010) | its own API (port 3011) | Third-party stack |

**Nginx changes** – each stack gets its own `location` for both UI and API:

```nginx
# Default stack (fallback)
upstream dashboard_default { server localhost:3000; }
upstream api_default { server localhost:3001; }

# Custom stack
upstream dashboard_custom { server localhost:3002; }
upstream api_custom { server localhost:3003; }

location / {
    proxy_pass http://dashboard_default;
    # ... proxy to api_default for /api/
}
location /dashboard/custom {
    proxy_pass http://dashboard_custom;
    # /dashboard/custom/api/ → api_custom
}
location /dashboard/custom/api/ {
    proxy_pass http://api_custom/;
}
```

---

## 2. Self-Modifying Dashboard with Fallback

### Layout on VPS

```
/opt/clawdeploy/
├── dashboard/              # Default dashboard (immutable)
├── control-api/            # Default API (immutable)
├── custom/                 # OpenClaw-edited stack
│   ├── dashboard/         # Custom UI source
│   └── api/               # Custom API source (fork or rewrite)
├── docker-compose.yml      # Default stack only
├── docker-compose.custom.yml  # Custom stack (dashboard + api)
└── ...
```

### Flow

1. **Default stack**: dashboard + control-api. Never modified. Served at `/`. Fallback target.
2. **Custom stack**: OpenClaw edits `custom/dashboard/` and `custom/api/`. Both must be deployed together.
3. **Deploy script**: Build custom dashboard + custom API. If either fails → exit, keep current custom stack (or show default).
4. **Rollback**: Main dashboard Settings has "Rollback Custom Dashboard" button. Or `POST /dashboard/custom/api/deploy/rollback`. Before each deploy, `redeploy.sh` tags current images as `:previous`; rollback restores them.

### Docker Compose for Multiple Dashboards

```yaml
dashboard:
  # Default dashboard – port 3000
  build: ./dashboard
  ports: ["127.0.0.1:3000:3000"]

dashboard-custom:
  # Custom variant – served when OpenClaw deploys successfully
  build:
    context: ./dashboards/custom
    dockerfile: Dockerfile  # Or use a pre-built static dir
  ports: ["127.0.0.1:3001:3000"]
  profiles: [custom-dashboard]
```

Or serve `custom` from a volume with pre-built static files instead of building in Docker.

---

## 3. Third-Party Dashboards

Third-party dashboards each run their own stack (UI + API). They do not use the default control-api. Each has its own backend. The OpenClaw gateway can be shared (same gateway URL for all) or each stack can configure its own.

Third-party stack needs:

- Its own API (UI points to e.g. `https://your-domain/dashboard/team9/api`)
- `GATEWAY_WS_URL` (e.g. `wss://your-domain/gateway/ws` or `ws://host:18789`)
- `GATEWAY_TOKEN` or password (same as main dashboard)

**Integration options:**

1. **Same host**: Run on a port (e.g. 3010), add nginx `location` to proxy a path to that port.
2. **Docker Compose**: Add a service that uses the third-party image and same network.
3. **Config-driven**: Store dashboard config (name, path, upstream) in control-api or a config file; Ansible/nginx generates routing from that.

**Example – Team9 or other UI** (its own API):

```yaml
# Third-party stack: UI + its own API
dashboard-team9:
  image: some/team9-dashboard:latest
  environment:
    VITE_API_URL: https://{{ domain }}/dashboard/team9/api
    VITE_GATEWAY_WS_URL: wss://{{ domain }}/gateway/ws
    VITE_GATEWAY_TOKEN: ${OPENCLAW_GATEWAY_TOKEN}
  ports: ["127.0.0.1:3010:3000"]

api-team9:
  image: some/team9-api:latest
  ports: ["127.0.0.1:3011:3001"]
```

---

## 4. OpenClaw Access to Repo

For OpenClaw to modify the dashboard, add a volume mount so it can see and edit the clawdeploy repo.

**For agent-bridge** (if it has file-editing capabilities):

```yaml
# In docker-compose.yml, under agent-bridge:
volumes:
  - /opt/clawdeploy:/workspace/clawdeploy:rw
```

**For openclaw-gateway** (chat and file-editing):

When clawdeploy-custom is deployed, `docker-compose.agent-mount.yml` (copied as override) adds to openclaw-gateway:

```yaml
volumes:
  - /opt/clawdeploy-custom:/workspace/clawdeploy-custom:rw
```

and patches `skills.load.extraDirs` to include `/workspace/clawdeploy-custom/skills`. The chat agent then sees the clawdeploy-custom skill and knows about the custom dashboard workspace, deploy API, and rollback.

For editing the main clawdeploy (not custom):

```yaml
# Under openclaw-gateway:
volumes:
  - openclaw-data:/home/node/.openclaw
  - /opt/clawdeploy:/workspace/clawdeploy:ro   # or :rw if gateway needs write
```

Then configure OpenClaw `agents.defaults.workspace` or equivalent to include `/workspace/clawdeploy/deploy/dashboard/`. The agent can edit files there. To deploy, it would need to run `./scripts/dashboard-deploy-safe.sh` – that requires either:
- SSH from the host into itself (awkward), or
- A sidecar/helper container that has the repo and docker socket mounted, or
- The agent-bridge to run the script (if it has `docker exec` or shell access to the host).

---

## 5. Implementation Checklist

- [x] Add `deploy/scripts/dashboard-deploy-safe.sh` – build via docker; only recreate container on success
- [ ] Add `deploy/scripts/dashboard-rollback.sh` – restore `active` to `default`
- [ ] Extend docker-compose with `dashboard-custom` service (or static-serving option)
- [ ] Extend nginx template with path-based routing for `/dashboard/default`, `/dashboard/custom`, `/dashboard/<thirdparty>`
- [ ] Add `DASHBOARD_VARIANTS` or similar config for third-party dashboards (name, port, path)
- [ ] Document volume mount for OpenClaw to access clawdeploy repo
- [ ] Optional: control-api endpoint `GET /dashboard/config` for current active variant and available dashboards

---

## 6. Minimal Starter

A minimal path to self-modifying dashboard:

1. Mount `/opt/clawdeploy` into OpenClaw container.
2. Add `dashboard-deploy-safe.sh` that builds from `dashboard/` and only swaps if build passes.
3. Add a second dashboard service that serves the “custom” build (from a build output dir or volume).
4. Add nginx `location /dashboard/custom` for the custom dashboard.
5. Main `/` stays on the default dashboard as the stable fallback.

This gives you: default always available, custom editable by OpenClaw, and rollback by switching nginx or `active` symlink back to default.
