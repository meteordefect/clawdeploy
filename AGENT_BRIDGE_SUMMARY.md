# Agent Bridge Integration - Quick Summary

**TL;DR**: Connect OpenClaw AI agents to your ClawDeploy dashboard for multi-agent orchestration with automatic skill discovery.

---

## What You Get

✅ **Single Dashboard** to manage multiple OpenClaw AI agents  
✅ **60+ Skills** automatically discovered and displayed  
✅ **Command Queue** to assign tasks to agents  
✅ **Real-Time Status** showing agent health and capabilities  
✅ **Session Management** for multi-turn conversations  
✅ **Remote Agents** deployed across multiple servers  

---

## How It Works

```
┌─────────────────────────────────┐
│  1. OpenClaw Agent              │
│     - Runs on any machine       │
│     - Has 60+ skills built-in   │
│     - Executes AI-powered tasks │
└──────────────┬──────────────────┘
               │
               ↓ (Agent Bridge connects them)
┌─────────────────────────────────┐
│  2. Control Plane Dashboard     │
│     - Shows all agents          │
│     - Assigns tasks             │
│     - Monitors progress         │
└─────────────────────────────────┘
```

The **Agent Bridge** is the middleware that:
- Registers agents with your control plane
- Reports what skills each agent has
- Polls for commands and executes them via OpenClaw
- Returns results back to the dashboard

---

## File Guide

### Planning Documents (Read First)

| File | Purpose | When to Use |
|------|---------|-------------|
| **AGENT_BRIDGE_PLAN.md** | Full implementation plan with architecture, phases, and timelines | Before starting implementation |
| **AGENT_BRIDGE_CHECKLIST.md** | Task-by-task checklist for tracking progress | During implementation |
| **AGENT_BRIDGE_SUMMARY.md** (this file) | High-level overview and quick reference | When explaining to others |

### Existing Documentation (Context)

| File | Relevance |
|------|-----------|
| **RUNSHEET.md** | Migration plan for v3, now includes Phase 6 (Agent Bridge) |
| **SPEC.md** | System specification (control API, database schema) |
| **AGENT_CONFIG.md** | How to configure remote OpenClaw instances |
| **QUICK_START.md** | Quick deployment guide (will be updated with bridge setup) |

---

## Implementation Timeline

### Quick Path (Minimal Viable)
**Time**: ~20 hours  
**Result**: Single local agent connected to dashboard

1. Phase 1.1-1.2: Build agent bridge service (8h)
2. Phase 2: Update control API for capabilities (3h)
3. Phase 3.1: Update dashboard agent view (2h)
4. Phase 4.1-4.4: Dockerize and integrate with deploy.sh (4h)
5. Phase 5.2: Integration testing (2h)
6. Phase 7.1: Update docs (1h)

### Full Implementation (Production Ready)
**Time**: ~50 hours  
**Result**: Multi-agent system with remote provisioning

All 7 phases from AGENT_BRIDGE_PLAN.md

---

## Quick Start Commands

### Build & Run Locally

```bash
# 1. Ensure control plane is running
cd deploy
docker compose up -d

# 2. Start OpenClaw gateway locally
cd ../openclaw-source
pnpm openclaw gateway run --port 18789

# 3. Generate gateway token (in another terminal)
pnpm openclaw doctor --generate-gateway-token
# Copy the token

# 4. Configure agent bridge
cd ../deploy/agent-bridge
cp .env.example .env
# Edit .env with your tokens

# 5. Build and start agent bridge
./deploy.sh agent-bridge build
./deploy.sh agent-bridge start

# 6. View in dashboard
open http://localhost:3000
# Navigate to Agents tab - your agent should appear with skills listed
```

### Deploy Remote Agent

```bash
# After completing local implementation:
./deploy.sh provision-agent <remote-host-ip>

# Monitor remote agent
./deploy.sh agent-health <agent-id>
```

---

## Key Concepts

### Skills
OpenClaw has 60+ built-in skills like:
- **GitHub** (🐙): Manage repos, PRs, issues
- **Obsidian** (💎): Work with markdown notes
- **Slack** (💬): Send messages, read channels
- **Gmail** (📧): Read/send emails
- **Spotify** (🎵): Control music playback
- ...and 55 more

Each skill is defined in a `SKILL.md` file with metadata. The agent bridge automatically discovers these on startup.

### Commands
Commands are queued in the control plane and executed by agents:

**Chat Command**: General AI conversation
```json
{
  "type": "chat",
  "payload": {
    "message": "Summarize recent GitHub PRs"
  }
}
```

**Skill Command**: Target specific capability
```json
{
  "type": "skill",
  "payload": {
    "skill": "github",
    "message": "List all open PRs in my repos"
  }
}
```

### Sessions
Sessions maintain conversation context across multiple commands:
- Each agent can have multiple active sessions
- Dashboard shows session history
- Commands can reference previous turns

---

## Architecture Decisions

### Why Not Integrate Directly Into OpenClaw?

**Reason**: Keep OpenClaw standalone and flexible

The agent bridge is a **separate service** because:
- OpenClaw can be used without ClawDeploy
- Easier to update bridge logic independently
- Can support multiple OpenClaw instances per bridge
- Clear separation: orchestration (bridge) vs execution (OpenClaw)

### Why Poll Instead of Push?

**Reason**: Simpler networking, works across firewalls

Agents **poll** the control plane rather than control plane pushing to agents:
- No inbound ports needed on agent servers
- Works through NAT/firewalls without VPN
- Easier to scale (no persistent connections)
- Agents can restart without control plane changes

### Why Parse SKILL.md Files?

**Reason**: Single source of truth, no manual registration

Skills are **auto-discovered** by parsing markdown files:
- No duplicate metadata to maintain
- Skills update automatically when OpenClaw updates
- Requirements checking (are binaries available?)
- Rich metadata (emoji, descriptions, install instructions)

---

## Cost Breakdown

### Infrastructure
- **Control Plane**: $6-12/month (Hetzner CX22/CX32)
- **Per Agent**: $6-12/month each (same server size)
- **Agent Bridge**: $0 (runs on same server as OpenClaw)

### LLM API Usage (Moonshot Kimi K2.5)
- **Light usage**: ~$1-2/day per agent (10-20 commands)
- **Medium usage**: ~$3-5/day per agent (50-100 commands)
- **Heavy usage**: ~$10-15/day per agent (200+ commands)

### Example: 5 Agents
- Infrastructure: ~$35-70/month (control plane + 5 agents)
- LLM usage: ~$150-750/month (depends on workload)
- **Total**: ~$200-800/month

**Cost Optimization**:
- Use smaller instances where possible (CX22 often sufficient)
- Batch commands to reduce API calls
- Cache frequently used prompts
- Set token limits per mission

---

## Troubleshooting Quick Reference

### Agent Won't Connect

**Check**:
```bash
# 1. Control API reachable?
curl http://localhost:3001/api/health

# 2. Agent bridge running?
docker ps | grep agent-bridge

# 3. Check logs
docker logs clawdeploy-agent-bridge

# 4. Verify token
docker exec clawdeploy-agent-bridge env | grep AGENT_TOKEN
```

### Skills Not Showing

**Check**:
```bash
# 1. Skills directory mounted?
docker inspect clawdeploy-agent-bridge | grep Mounts

# 2. Parser errors?
docker logs clawdeploy-agent-bridge | grep -i "skill"

# 3. Manually test parser
cd agent-bridge
npm run parse-skills -- ../openclaw-source/skills
```

### Commands Not Executing

**Check**:
```bash
# 1. OpenClaw gateway running?
ps aux | grep openclaw

# 2. Gateway connection?
docker logs clawdeploy-agent-bridge | grep "gateway"

# 3. Command polling working?
docker logs clawdeploy-agent-bridge | grep "poll"

# 4. Check command queue
curl http://localhost:3001/api/commands?status=pending
```

---

## Next Steps After Implementation

### Week 1: Stabilization
- Monitor agent uptime and connection stability
- Tune polling intervals based on load
- Fix any edge cases discovered
- Gather user feedback

### Week 2: Skills Expansion
- Install additional skill dependencies (gh, obsidian-cli, etc.)
- Test each skill manually
- Document usage patterns
- Create command templates

### Week 3: Multi-Agent Testing
- Deploy 3-5 agents with different skill sets
- Test load balancing (routing commands to capable agents)
- Test parallel execution
- Optimize database queries

### Week 4: Production Hardening
- Enable HTTPS for all connections
- Implement secrets management (Vault/AWS Secrets)
- Add monitoring/alerting (Prometheus/Grafana)
- Set up log aggregation
- Document runbook procedures

---

## Support & Resources

### Documentation
- **AGENT_BRIDGE_PLAN.md**: Detailed implementation guide
- **AGENT_BRIDGE_CHECKLIST.md**: Task tracking
- **OpenClaw Docs**: https://docs.openclaw.ai
- **Moonshot AI Docs**: https://platform.moonshot.cn/docs

### Getting Help
- **GitHub Issues**: Report bugs/feature requests
- **OpenClaw Discord**: Community support
- **Email**: marten@friendlabs.ai

---

## Success Criteria

You'll know it's working when:

✅ **Dashboard shows "Online" agent with green status**  
✅ **Agent card displays 60+ skill badges**  
✅ **Mission command completes and shows result**  
✅ **Skills browser lists all capabilities**  
✅ **Remote agents can be provisioned with one command**  
✅ **Command latency is <10 seconds end-to-end**  
✅ **Agent uptime is >95%**  
✅ **Cost per command is <$0.05**  

---

**Ready to Start?**

1. Read: **AGENT_BRIDGE_PLAN.md** (understand the architecture)
2. Track: **AGENT_BRIDGE_CHECKLIST.md** (mark off tasks as you go)
3. Build: Follow Phase 1 → Phase 7
4. Deploy: `./deploy.sh agent-bridge start`
5. Celebrate: You've built a multi-agent AI orchestration system! 🎉

---

**Last Updated**: February 11, 2026  
**Version**: 1.0  
**Status**: Ready to Implement
