# OpenClaw Self-Modify

This project is the **custom dashboard** for ClawDeploy. You can modify it and redeploy.

## Paths

| Where              | Path                        |
|--------------------|-----------------------------|
| On VPS (host)      | `/opt/clawdeploy-custom`    |
| In OpenClaw (mount)| `/workspace/clawdeploy-custom` |

These are the **same directory** — the OpenClaw gateway container mounts the host path as a read-write volume (`docker-compose.agent-mount.yml`). Edits in the mount are immediately reflected on the host. No sync step is needed.

## Layout

```
dashboard/     ← React UI (edit .tsx, .ts, .css)
api/           ← control API (edit .ts, routes)
docker-compose.yml
redeploy.sh    ← run this after editing
```

## Deploy after changes

- **Dashboard only** (you only changed `dashboard/`): soft deploy
  ```bash
  cd /workspace/clawdeploy-custom && ./redeploy.sh --soft
  ```
  User refreshes the page to see changes.

- **API or other files**: full deploy
  ```bash
  cd /workspace/clawdeploy-custom && ./redeploy.sh
  ```

Or on the VPS host: `cd /opt/clawdeploy-custom && ./redeploy.sh` (add `--soft` for dashboard-only)

## Mount required

For OpenClaw chat to see this project, the main clawdeploy gateway override must mount it. When you run `./deploy.sh deploy`, `docker-compose.agent-mount.yml` is copied as override and adds:

- `/opt/clawdeploy-custom` → `/workspace/clawdeploy-custom` (read-write)
- `skills.load.extraDirs` includes `/workspace/clawdeploy-custom/skills`

## Ansible deploys override your edits

The project owner deploys from their local machine using Ansible (`synchronize` with `delete: yes`). This overwrites all files on the VPS with the local version. This is intentional — Ansible is the authoritative deploy mechanism.
