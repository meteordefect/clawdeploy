# ClawDeploy v3 - Quick Start Guide

Get ClawDeploy running in under 10 minutes.

## Prerequisites

- Hetzner Cloud account + API token
- SSH key pair
- Local machine with Terraform, Ansible, Docker

## 5-Step Setup

### 1. Clone & Configure

```bash
git clone --recursive https://github.com/your-org/clawdeploy.git
cd clawdeploy/deploy

# Copy and edit environment
cp .env.example .env
vim .env
# Generate passwords using the commands in the file
# Set: POSTGRES_PASSWORD, BETA_PASSWORD, DATABASE_URL, DOMAIN

# Copy and edit Terraform vars
cd terraform
cp terraform.tfvars.example terraform.tfvars
vim terraform.tfvars
# Set: hcloud_token, ssh_public_key
cd ..
```

### 2. Deploy

```bash
./deploy.sh init
```

Wait 5-10 minutes. Output will show:
```
✓ ClawDeploy Control Plane is ready!
ℹ Access dashboard at: http://YOUR_IP
ℹ Username: openclaw
ℹ Password: [your password]
```

### 3. Verify

```bash
# Check health
curl http://YOUR_IP/api/health

# View status
./deploy.sh status

# Access dashboard
open http://YOUR_IP
```

### 4. Register Test Agent

```bash
curl -X POST http://YOUR_IP/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Agent", "description": "My first agent"}'
```

Response:
```json
{
  "agent_id": "uuid-here",
  "token": "token-here",
  "name": "Test Agent",
  "status": "offline"
}
```

**Note**: Agents use **Kimi K2.5 from Moonshot AI** as the LLM provider. See [AGENT_CONFIG.md](AGENT_CONFIG.md) for full setup.

### 5. Create Mission

Via dashboard:
1. Go to **Missions** tab
2. Click **New Mission**
3. Enter name and description
4. Click **Create Mission**

Or via API:
```bash
curl -X POST http://YOUR_IP/api/missions \
  -u openclaw:your-password \
  -H "Content-Type: application/json" \
  -d '{"name": "Deploy to Production", "description": "Roll out v2.0"}'
```

## Common Commands

```bash
# View logs
./deploy.sh logs

# SSH to server
./deploy.sh ssh

# Restart API
./deploy.sh api

# Create backup
./deploy.sh backup

# Check status
./deploy.sh status

# Full help
./deploy.sh help
```

## Next Steps

- Set up remote agents (see README.md)
- Configure SSL/TLS
- Set up scheduled backups
- Explore the dashboard views

## Troubleshooting

**Dashboard won't load:**
```bash
./deploy.sh ssh
cd /opt/clawdeploy
docker compose ps
docker compose logs dashboard nginx
```

**API returns errors:**
```bash
./deploy.sh logs
docker exec clawdeploy-postgres pg_isready
./deploy.sh migrate
```

**Can't connect to server:**
- Check firewall allows ports 22, 80, 443
- Verify SSH key is correct
- Check Hetzner dashboard for server status

## Support

- Full docs: See README.md
- Issues: GitHub Issues
- Email: marten@friendlabs.ai

---

That's it! You now have a fully functional ClawDeploy control plane.
