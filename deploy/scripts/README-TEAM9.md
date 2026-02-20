# Team9 Deploy

[Team9](https://github.com/team9ai/team9) - collaborative workspace for AI agents built on OpenClaw.

## Deploy to Hetzner

After deploying ClawDeploy to your VPS:

```bash
cd deploy
./deploy.sh team9-deploy
```

Team9 replaces the ClawDeploy dashboard and is available at `http://YOUR_SERVER_IP/` (root).

**Agent bridge:** Set `CONTROL_API_URL` to `http://YOUR_SERVER_IP/control-api` (ClawDeploy control API moved to `/control-api`).

**Login flow:** Users register at `/register` → with `DEV_SKIP_EMAIL_VERIFICATION=true` and `APP_ENV=local`, the API returns the verification link in the response (no email/SMTP needed) → click it to verify → log in at `/login`. `APP_URL` is set to your server IP so verification links work.

**Prerequisites:** Run `./deploy.sh init` or `./deploy.sh deploy` first. Team9 reuses ClawDeploy's LLM keys from `.env`.

## What It Does (on the VPS)

1. **Clones** Team9 from GitHub to `/opt/team9`
2. **Generates** `.env` with secure passwords for PostgreSQL, Redis, RabbitMQ, MinIO
3. **Copies** LLM keys from ClawDeploy's `.env`
4. **Starts** Docker infrastructure: PostgreSQL, Redis, RabbitMQ, MinIO
5. **Builds** server + client, runs `pnpm db:migrate`
6. **Starts** gateway and IM worker via systemd
7. **Configures** nginx: Team9 at `/`, API at `/api`, ClawDeploy control at `/control-api`

## AI Features

**LLM keys are reused from ClawDeploy** when present: if `deploy/.env` or `/opt/clawdeploy/.env` exists, the script copies `ZHIPU_API_KEY`, `MOONSHOT_API_KEY`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENCLAW_MODEL`, etc. into Team9's `.env`.

If no ClawDeploy env is found, add at least one API key manually:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
# or ZHIPU_API_KEY, MOONSHOT_API_KEY (if Team9 supports them)
```

## Troubleshooting

**502 on login/register:** The Team9 gateway isn't responding. On the server:

```bash
# 1. Is the gateway running?
sudo systemctl status team9-gateway

# 2. Recent gateway logs (look for connection errors, port conflicts)
sudo journalctl -u team9-gateway -n 100 --no-pager

# 3. Is it listening on 3010?
ss -tlnp | grep 3010

# 4. Are Team9's Docker services (Postgres, Redis, RabbitMQ, MinIO) up?
cd /opt/team9 && docker compose -f docker/docker-compose.yml ps

# 5. Restart gateway and tail logs
sudo systemctl restart team9-gateway && sleep 5 && sudo journalctl -u team9-gateway -f
```

Common causes: **Port 3001 conflict** (Team9 IM worker vs ClawDeploy control-api)—deploy uses 3011 for IM worker; Postgres/Redis not ready; gateway crash (check journalctl).

**Not Found at `/`:**

```bash
# Can nginx read the files?
sudo -u www-data cat /opt/team9/apps/client/dist/index.html | head -5

# Which nginx config handles the request?
sudo nginx -T 2>&1 | grep -A2 "server_name\|listen 80"

# Nginx error log
sudo tail -20 /var/log/nginx/error.log
```

## Environment Override

Set these before running to use your own secrets instead of generated ones:

- `TEAM9_POSTGRES_USER`, `TEAM9_POSTGRES_PASSWORD`, `TEAM9_POSTGRES_DB`
- `TEAM9_REDIS_PASSWORD`
- `TEAM9_RABBITMQ_PASSWORD`
- `TEAM9_S3_ACCESS_KEY`, `TEAM9_S3_SECRET`
- `TEAM9_SYSTEM_BOT_PASSWORD`
