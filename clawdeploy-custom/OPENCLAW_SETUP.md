# Telling OpenClaw About the Custom Dashboard

This doc explains how OpenClaw learns about the custom dashboard and its ability to edit it.

## Automatic Setup (Deploy)

When you run `./deploy.sh deploy` from the clawdeploy-custom directory:

1. **Skill synced** – `skills/clawdeploy-custom/SKILL.md` is copied to the VPS
2. **OpenClaw gateway override** – `docker-compose.agent-mount.yml` is applied to the main clawdeploy, so the gateway gets:
   - `/opt/clawdeploy-custom` mounted at `/workspace/clawdeploy-custom` (read-write, so OpenClaw can edit)
   - `skills.load.extraDirs` patched to include `/workspace/clawdeploy-custom/skills`
3. **Gateway recreated** – picks up the mount and skill config

## How OpenClaw Gets the Skill

The OpenClaw gateway (chat) loads skills from `skills.load.extraDirs` in `openclaw.json`. The override adds `/workspace/clawdeploy-custom/skills`, so when you chat, the agent sees the clawdeploy-custom skill and knows:

- The workspace is at `/workspace/clawdeploy-custom`
- Dashboard code is in `dashboard/`, API in `api/`
- To deploy: `POST /dashboard/custom/api/deploy` or `./redeploy.sh`
- To rollback: `POST /dashboard/custom/api/deploy/rollback`

## What You Need to Do

1. **Deploy clawdeploy-custom** – `cd clawdeploy-custom && ./deploy.sh deploy`
2. Use **chat** to ask OpenClaw to modify the custom dashboard; it can edit files and trigger deploy via the API.

## Quick Reference

| Thing | Value |
|-------|-------|
| Workspace (in agent) | `/workspace/clawdeploy-custom` |
| Deploy API | `POST /dashboard/custom/api/deploy` |
| Rollback API | `POST /dashboard/custom/api/deploy/rollback` |
| Rollback from main UI | Settings → Rollback Custom Dashboard |
