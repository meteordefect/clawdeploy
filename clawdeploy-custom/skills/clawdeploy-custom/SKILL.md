---
name: clawdeploy-custom
description: Modify and redeploy the ClawDeploy custom dashboard (React + API).
metadata:
  { "openclaw": { "emoji": "🎛️" } }
---

# ClawDeploy Custom Dashboard

This skill lets you modify the custom dashboard and redeploy it.

## Workspace

The custom dashboard source is at **`/workspace/clawdeploy-custom`** (when the project is mounted into the agent).

| Path | Contents |
|------|----------|
| `dashboard/` | React UI – edit `.tsx`, `.ts`, `.css` |
| `api/` | control API – edit `.ts` routes and logic |
| `redeploy.sh` | Deploy script – run after editing |

## Deploy after editing

**Important:** Your workspace is inside the agent; the deploy API builds from the VPS. You must **sync your workspace first** so your edits reach the VPS, then deploy.

1. **Sync workspace** (push your edits to the VPS):
   ```bash
   cd /workspace/clawdeploy-custom && tar czf - . | curl -s -X POST -H "Content-Type: application/gzip" --data-binary @- http://clawdeploy-custom-api:3001/api/sync
   ```

2. **Deploy** (runs on VPS with Docker):

   - **Dashboard only** (`.tsx`, `.ts`, `.css`, `dashboard/` or `nginx.conf`)? → **Always use soft deploy**:
     ```bash
     curl -s -X POST http://clawdeploy-custom-api:3001/api/deploy/soft
     ```

   - **API or other files** (`api/`, `docker-compose`, etc.)? → Full deploy:
     ```bash
     curl -s -X POST http://clawdeploy-custom-api:3001/api/deploy
     ```

**Use soft deploy whenever possible.** Full deploy restarts more services and can cause the API to appear stuck. If you only changed UI code, use soft deploy.

Tell the user to refresh the dashboard page after deploy (~1–2 minutes).

**Fallback (if API unreachable):** Run on VPS shell:
  ```bash
  cd /opt/clawdeploy-custom && ./redeploy.sh --soft   # dashboard only
  cd /opt/clawdeploy-custom && ./redeploy.sh          # full (api + dashboard)
  ```

**Which deploy to use?**
- Edited `dashboard/**`, `*.tsx`, `*.ts`, `*.css`, `nginx.conf` → **soft deploy**
- Edited `api/**`, `docker-compose`, `Dockerfile` → full deploy

Changes appear at `/dashboard/custom`.

## Rollback

If the UI breaks: **Rollback Custom Dashboard** in the main ClawDeploy Settings, or:

```bash
curl -X POST https://YOUR-DOMAIN/dashboard/custom/api/deploy/rollback
```
