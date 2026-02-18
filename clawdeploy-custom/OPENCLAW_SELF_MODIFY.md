# OpenClaw Self-Modify

This project is the **custom dashboard** for ClawDeploy. You can modify it and redeploy.

## Paths

| Where              | Path                        |
|--------------------|-----------------------------|
| On VPS (host)      | `/opt/clawdeploy-custom`    |
| In OpenClaw (mount)| `/workspace/clawdeploy-custom` |

## Layout

```
dashboard/     ← React UI (edit .tsx, .ts, .css)
api/           ← control API (edit .ts, routes)
docker-compose.yml
redeploy.sh    ← run this after editing
```

## Deploy after changes

```bash
cd /workspace/clawdeploy-custom && ./redeploy.sh
```

Or on the VPS host: `cd /opt/clawdeploy-custom && ./redeploy.sh`

## Mount required

For OpenClaw to see this project, the main clawdeploy `agent-bridge` must mount it:

```yaml
# In deploy/docker-compose.override.yml or agent-bridge service
volumes:
  - /opt/clawdeploy-custom:/workspace/clawdeploy-custom:rw
```
