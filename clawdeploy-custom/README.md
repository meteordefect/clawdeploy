# ClawDeploy Custom

Your modified dashboard + API, deployable alongside the default ClawDeploy stack. Uses the same Ansible-based deploy as the main app (same VPS).

## Deploy from local machine

```bash
# One-time setup
cp ansible/inventory.ini.example ansible/inventory.ini
# Set ansible_host (same IP as main clawdeploy - it's the same VPS)

cp .env.example .env
# Fill POSTGRES_PASSWORD, VITE_GATEWAY_WS_URL, DOMAIN, etc.

# Deploy
./deploy.sh deploy
```

Access at `https://your-domain/dashboard/custom`.

**If you see sidebar with empty content:** the main nginx needs the `/dashboard/custom` routes. From the main clawdeploy directory run: `./deploy.sh nginx`

## Layout

- `dashboard/` – React UI
- `api/` – control API
- `docker-compose.yml` – postgres + api + dashboard
- `ansible/` – same deploy pattern as main clawdeploy (sync + docker compose)
- `deploy.sh` – deploy, ssh, logs, status (run from local)
- `redeploy.sh` – rebuild on VPS (for OpenClaw self-deploy)

## Commands

| Command   | Description                          |
|-----------|--------------------------------------|
| `deploy`  | Sync code + docker compose (Ansible) |
| `ssh`     | SSH to VPS                           |
| `logs`    | Tail docker compose logs             |
| `status`  | Container status                     |

## Self-deploy (OpenClaw modifies and deploys)

**Deploy does it automatically.** When you run `./deploy.sh deploy`, it:
1. Syncs and deploys the custom stack
2. Copies the agent-bridge mount override to the main clawdeploy
3. Recreates agent-bridge so it has `/opt/clawdeploy-custom` → `/workspace/clawdeploy-custom`

OpenClaw can then edit `dashboard/` or `api/` and deploy via the API. See `OPENCLAW_SELF_MODIFY.md` for paths, `OPENCLAW_SETUP.md` for how OpenClaw learns about the custom dashboard, and `skills/clawdeploy-custom/` for the self-modify skill.

## Prerequisites

- Main clawdeploy deployed first (creates openclaw-data volume)
- **Nginx routes** – run `./deploy.sh nginx` from the main clawdeploy dir so nginx proxies `/dashboard/custom` to the custom stack
- Same VPS – copy `inventory.ini` from main deploy or use same `ansible_host`

## Standalone (no main stack)

Use `docker-compose.override.yml`:

```yaml
volumes:
  openclaw-data:
    driver: local
```

## Ports

- 3002 – dashboard
- 3003 – api
