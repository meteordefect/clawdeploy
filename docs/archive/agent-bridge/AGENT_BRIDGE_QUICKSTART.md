# Agent Bridge - Quick Start

The agent bridge service has been created! Here's how to get agents showing up in your dashboard.

## What Was Built

```
deploy/agent-bridge/
├── src/
│   ├── index.ts              # Main entry point
│   ├── config.ts             # Configuration loader
│   ├── control-api-client.ts # HTTP client for control API
│   ├── skills-parser.ts      # Discovers OpenClaw skills
│   ├── heartbeat.ts          # Sends periodic heartbeats
│   ├── command-poller.ts     # Polls for commands
│   └── types.ts              # TypeScript interfaces
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

## Quick Start (Local Testing)

### 1. Configure Environment

```bash
cd deploy/agent-bridge
cp .env.example .env
```

Edit `.env` and set:
- `CONTROL_API_URL=http://localhost:3001/api` (or your control API URL)
- `AGENT_NAME=My Local Agent`
- `AGENT_DESCRIPTION=Test agent for development`

### 2. Install Dependencies

```bash
npm install
```

### 3. Build

```bash
npm run build
```

### 4. Run

```bash
npm start
```

You should see:
```
====================================
ClawDeploy Agent Bridge v1.0.0
====================================

Configuration loaded successfully
Control API: http://localhost:3001/api
Agent Name: My Local Agent

✓ Agent registered: My Local Agent (abc-123-def)
✓ Found 0 skill(s)
✓ Heartbeat started
✓ Command poller started

====================================
Agent Bridge is running!
====================================
```

### 5. Check Dashboard

Open your dashboard at `http://localhost:3000` and navigate to the **Agents** view. You should see your agent listed with status "online" (green dot).

## Docker Deployment

### Using docker-compose (Recommended)

The agent-bridge service is already configured in docker-compose.yml.

#### 1. Configure Environment

Edit `deploy/.env` and add agent bridge settings:

```bash
AGENT_NAME=Production Agent
AGENT_DESCRIPTION=OpenClaw agent with full skill suite
```

#### 2. Build and Start

```bash
cd deploy
./deploy.sh agent-bridge-build
./deploy.sh agent-bridge-start
```

#### 3. View Logs

```bash
./deploy.sh agent-bridge-logs
```

#### 4. Check Status

```bash
./deploy.sh agent-bridge-status
```

#### 5. List Registered Agents

```bash
./deploy.sh list-agents
```

## Troubleshooting

### Agent not showing in dashboard

**Check if agent bridge is running:**
```bash
docker ps | grep agent-bridge
```

**Check logs:**
```bash
./deploy.sh agent-bridge-logs
```

**Common issues:**
- Control API URL is wrong (check `CONTROL_API_URL` in .env)
- Control API is not running (check with `docker ps`)
- Network connectivity issues (agent-bridge must reach control-api)

### Agent shows as "offline"

**Heartbeat is failing:**
- Check logs: `./deploy.sh agent-bridge-logs`
- Verify agent token is valid
- Ensure heartbeat interval isn't too long

**Agent hasn't sent heartbeat yet:**
- Wait 30 seconds (default heartbeat interval)
- Check that agent bridge is running

### Registration fails

**"Failed to register agent" error:**
- Verify control API is running: `curl http://localhost:3001/api/health`
- Check network connectivity
- Ensure CONTROL_API_URL is correct

## What Happens Next

Once the agent is registered and heartbeating:

1. **Dashboard shows agent as "online"** with green status indicator
2. **Heartbeats sent every 30 seconds** to maintain online status
3. **Agent polls for commands every 5 seconds**
4. **Commands can be assigned** via dashboard (future feature)
5. **Agent executes commands** via OpenClaw (future integration)

## Next Steps

- [ ] Connect agent bridge to actual OpenClaw gateway
- [ ] Implement command execution via OpenClaw
- [ ] Add skill discovery from OpenClaw skills directory
- [ ] Enable multi-agent support (run multiple bridges)
- [ ] Add WebSocket support for real-time updates

## Architecture

```
Dashboard (Browser)
    ↓ View agents
Control API (Postgres)
    ↓ HTTP: /agents/register (once)
    ↓ HTTP: /agents/heartbeat (every 30s)
    ↓ HTTP: /commands/pending (every 5s)
Agent Bridge
    ↓ (future: WebSocket to OpenClaw)
OpenClaw Gateway
```

## Configuration Reference

See `deploy/agent-bridge/.env.example` for all available options:

- `CONTROL_API_URL` - Control plane API endpoint
- `AGENT_NAME` - Display name for agent
- `AGENT_DESCRIPTION` - Agent description
- `HEARTBEAT_INTERVAL_MS` - Heartbeat frequency (default: 30000)
- `COMMAND_POLL_INTERVAL_MS` - Command polling frequency (default: 5000)
- `OPENCLAW_GATEWAY_URL` - OpenClaw gateway WebSocket URL (future)
- `OPENCLAW_SKILLS_PATH` - Path to skills directory

## Development

Run in development mode with auto-reload:

```bash
cd deploy/agent-bridge
npm run dev
```

## Deployment Commands

All agent bridge commands via `deploy.sh`:

```bash
./deploy.sh agent-bridge-build    # Build Docker image
./deploy.sh agent-bridge-start    # Start service
./deploy.sh agent-bridge-stop     # Stop service
./deploy.sh agent-bridge-restart  # Restart service
./deploy.sh agent-bridge-logs     # View logs (live)
./deploy.sh agent-bridge-status   # Check status
./deploy.sh list-agents           # List all agents
```

## Success Criteria

You'll know it's working when:

1. ✅ Agent bridge starts without errors
2. ✅ Dashboard shows agent in Agents view
3. ✅ Agent status is "online" (green dot)
4. ✅ Agent heartbeat timestamp updates every 30s
5. ✅ No errors in agent bridge logs
