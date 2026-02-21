---
name: clawdeploy-custom
description: Modify and redeploy the ClawDeploy custom dashboard (React + API).
metadata:
  { "openclaw": { "emoji": "🎛️" } }
---

# ClawDeploy Custom Dashboard

This skill lets you modify the custom dashboard and redeploy it.

## Workspace

The custom dashboard source is at **`/workspace/clawdeploy-custom`** — this is a direct read-write mount of `/opt/clawdeploy-custom` on the VPS host. Edits you make here are immediately visible on the VPS filesystem. No sync step is needed.

| Path | Contents |
|------|----------|
| `dashboard/` | React UI – edit `.tsx`, `.ts`, `.css` |
| `api/` | control API – edit `.ts` routes and logic |
| `redeploy.sh` | Deploy script – run after editing |

## Deploy after editing

**IMPORTANT: Do NOT run `npm install`, `npm run build`, or any build commands locally.** You cannot build the dashboard inside this container. Instead, trigger a deploy via the API — it builds inside Docker on the host.

After editing files, deploy by calling the API:

- **Dashboard only** (`.tsx`, `.ts`, `.css`, `dashboard/` or `nginx.conf`) — **always use soft deploy**:
  ```bash
  curl -s -X POST http://clawdeploy-custom-api:3001/api/deploy/soft
  ```

- **API or other files** (`api/`, `docker-compose`, etc.) — full deploy:
  ```bash
  curl -s -X POST http://clawdeploy-custom-api:3001/api/deploy
  ```

The API will return `{"status":"started","deployId":"..."}`. The build runs in the background (~1–2 min). Tell the user to refresh the dashboard page after deploy.

**Use soft deploy whenever possible.** Full deploy restarts more services.

**Fallback (if API unreachable):** Run on VPS shell:
  ```bash
  cd /opt/clawdeploy-custom && ./redeploy.sh --soft   # dashboard only
  cd /opt/clawdeploy-custom && ./redeploy.sh          # full (api + dashboard)
  ```

**Which deploy to use?**
- Edited `dashboard/**`, `*.tsx`, `*.ts`, `*.css`, `nginx.conf` → **soft deploy**
- Edited `api/**`, `docker-compose`, `Dockerfile` → full deploy

Changes appear at `/dashboard/custom`.

## Important: Ansible deploys override your edits

The project owner deploys from their local machine using Ansible, which rsyncs files with `--delete`. This overwrites any changes you've made. This is intentional — Ansible is the authoritative source.

## Rollback

If the UI breaks: **Rollback Custom Dashboard** in the main ClawDeploy Settings, or:

```bash
curl -X POST https://YOUR-DOMAIN/dashboard/custom/api/deploy/rollback
```
