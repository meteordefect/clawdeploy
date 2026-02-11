# ClawDeploy v3 - Deployment Checklist

Use this checklist when deploying ClawDeploy for the first time or to a new server.

## Pre-Deployment

- [ ] Hetzner Cloud account created
- [ ] Hetzner API token generated
- [ ] SSH key pair generated (`ssh-keygen -t rsa -b 4096`)
- [ ] Domain name configured (optional, can use IP)
- [ ] Local tools installed:
  - [ ] Terraform >= 1.0
  - [ ] Ansible >= 2.15
  - [ ] Docker (for building OpenClaw images)
  - [ ] Git

## Configuration

- [ ] Clone repository: `git clone --recursive https://github.com/your-org/clawdeploy.git`
- [ ] Copy environment file: `cp deploy/.env.example deploy/.env`
- [ ] Edit `deploy/.env`:
  - [ ] Set `POSTGRES_PASSWORD` (generate strong password)
  - [ ] Set `BETA_USER` and `BETA_PASSWORD`
  - [ ] Set `DOMAIN` (or use IP)
  - [ ] Set `OPENCLAW_VERSION` (latest or specific tag)
- [ ] Copy Terraform vars: `cp deploy/terraform/terraform.tfvars.example deploy/terraform/terraform.tfvars`
- [ ] Edit `deploy/terraform/terraform.tfvars`:
  - [ ] Set `hcloud_token`
  - [ ] Set `ssh_public_key` (from `~/.ssh/id_rsa.pub`)
  - [ ] Optionally adjust `server_type`, `location`

## Initial Deployment

- [ ] Navigate to deploy directory: `cd deploy`
- [ ] Run init command: `./deploy.sh init`
- [ ] Wait for deployment to complete (~5-10 minutes)
- [ ] Note the server IP from output

## Verification

- [ ] Access dashboard: `http://YOUR_SERVER_IP`
- [ ] Log in with credentials from `.env`
- [ ] Check Overview page loads
- [ ] Verify API health: `curl http://YOUR_SERVER_IP/api/health`
- [ ] Check services status: `./deploy.sh status`
- [ ] SSH to server: `./deploy.sh ssh`
- [ ] View logs: `./deploy.sh logs`

## Post-Deployment

- [ ] Create first backup: `./deploy.sh backup`
- [ ] Test agent registration:
  ```bash
  curl -X POST http://YOUR_SERVER_IP/api/agents/register \
    -H "Content-Type: application/json" \
    -d '{"name": "Test Agent", "description": "Testing"}'
  ```
- [ ] Save agent token from response
- [ ] Create test mission in dashboard
- [ ] Queue test command

## Security Hardening (Optional)

- [ ] Configure domain DNS A record
- [ ] Set up SSL/TLS with Let's Encrypt (future feature)
- [ ] Review firewall rules: `ssh root@IP "ufw status"`
- [ ] Change default SSH port (optional)
- [ ] Set up fail2ban (optional)
- [ ] Configure log rotation

## Monitoring Setup (Optional)

- [ ] Set up external uptime monitoring
- [ ] Configure alerting (email/Slack)
- [ ] Set up log aggregation
- [ ] Schedule regular backups (cron)

## Documentation

- [ ] Document server IP and credentials (secure location)
- [ ] Note Hetzner server ID
- [ ] Save agent tokens securely
- [ ] Document any custom configurations
- [ ] Share dashboard URL with team

## Agent Setup (When Ready)

For each remote agent:

- [ ] Provision agent server
- [ ] Install Docker
- [ ] Register agent via API
- [ ] Configure agent `.env` with token
- [ ] Build/pull OpenClaw image
- [ ] Start agent with heartbeat client
- [ ] Verify agent appears "online" in dashboard

## Troubleshooting

If something goes wrong:

1. Check logs: `./deploy.sh logs`
2. Check status: `./deploy.sh status`
3. SSH to server: `./deploy.sh ssh`
4. Verify Docker containers: `docker compose ps`
5. Check PostgreSQL: `docker exec clawdeploy-postgres pg_isready`
6. Run migrations: `./deploy.sh migrate`
7. Restart services: `cd /opt/clawdeploy && docker compose restart`

## Rollback Plan

If deployment fails:

1. Destroy infrastructure: `./deploy.sh destroy` (WARNING: DESTRUCTIVE)
2. Fix configuration issues
3. Re-run: `./deploy.sh init`

Or for partial updates:

1. Revert code changes
2. Redeploy: `./deploy.sh deploy`
3. Restore from backup if needed

## Success Criteria

Deployment is successful when:

- ✓ Dashboard accessible and responsive
- ✓ API health check returns `"status": "ok"`
- ✓ PostgreSQL is connected
- ✓ All Docker containers running
- ✓ Nginx serving correctly
- ✓ Can register test agent
- ✓ Can create test mission
- ✓ Events appear in audit log

---

**Date Deployed**: _______________  
**Deployed By**: _______________  
**Server IP**: _______________  
**Notes**: _______________
