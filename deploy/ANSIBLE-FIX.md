# Ansible Docker Compose Module Fix

## Issue
Ansible playbooks were using the deprecated `community.docker.docker_compose` module, which was removed in version 4.0.0.

## Fix Applied
Updated all playbooks to use `community.docker.docker_compose_v2` with updated parameters:

### Changed Parameters:
- `build: yes` → `build: always`
- `nocache: yes` → removed (not needed with build: always)
- `restarted: yes` → `state: restarted`

### Files Updated:
- `ansible/playbooks/dashboard.yml`
- `ansible/playbooks/file-api.yml`

### Files Already OK:
- `ansible/playbooks/openclaw.yml` (uses shell commands)
- `ansible/playbooks/tasks/start-services.yml` (uses command)

## Deploy Now

```bash
cd deploy
./deploy.sh dashboard
```

This should work now!
