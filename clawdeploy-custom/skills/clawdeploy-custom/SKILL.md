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

## After editing

**Option A – API deploy (recommended, no round-trip)**  
POST to the custom API to rebuild and restart:

```bash
curl -X POST https://YOUR-DOMAIN/dashboard/custom/api/deploy
```

**Option B – Shell on VPS**  
If you have shell access to the VPS:

```bash
cd /workspace/clawdeploy-custom && ./redeploy.sh
```

Changes appear at `/dashboard/custom`.

## Rollback

If the UI breaks: **Rollback Custom Dashboard** in the main ClawDeploy Settings, or:

```bash
curl -X POST https://YOUR-DOMAIN/dashboard/custom/api/deploy/rollback
```
