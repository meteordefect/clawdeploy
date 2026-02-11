# ClawDeploy Agent Bridge

Connects OpenClaw instances to the ClawDeploy Control Plane.

## What It Does

1. **Registers** the agent with the control plane
2. **Discovers** available OpenClaw skills
3. **Sends** periodic heartbeats to maintain online status
4. **Polls** for pending commands from the control plane
5. **Executes** commands via OpenClaw
6. **Reports** command results back to the control plane

## Quick Start

### 1. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:
- `CONTROL_API_URL` - URL to your control API
- `AGENT_NAME` - Name for this agent
- `AGENT_DESCRIPTION` - Description of this agent

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

Or for development with auto-reload:

```bash
npm run dev
```

## Docker Deployment

Build the image:

```bash
docker build -t clawdeploy-agent-bridge .
```

Run with environment variables:

```bash
docker run -d \
  --name agent-bridge \
  -e CONTROL_API_URL=http://control-api:3001/api \
  -e AGENT_NAME="My OpenClaw Agent" \
  clawdeploy-agent-bridge
```

## Configuration

All configuration via environment variables. See `.env.example` for full list.

### Key Settings

- `HEARTBEAT_INTERVAL_MS` - How often to send heartbeat (default: 30000ms)
- `COMMAND_POLL_INTERVAL_MS` - How often to check for commands (default: 5000ms)
- `OPENCLAW_SKILLS_PATH` - Path to OpenClaw skills directory

## Architecture

```
Agent Bridge
    ↓ HTTP (register)
    ↓ HTTP (heartbeat every 30s)
    ↓ HTTP (poll commands every 5s)
Control API
    ↓ (future: WebSocket)
OpenClaw Gateway
```

## Development

Run in development mode with hot reload:

```bash
npm run dev
```

## Troubleshooting

### Agent not showing in dashboard

- Check `CONTROL_API_URL` is correct
- Ensure control API is accessible from agent bridge
- Check logs: `docker logs clawdeploy-agent-bridge`

### Heartbeat failures

- Verify network connectivity to control API
- Check agent token is valid
- Ensure agent registered successfully on startup

## License

MIT
