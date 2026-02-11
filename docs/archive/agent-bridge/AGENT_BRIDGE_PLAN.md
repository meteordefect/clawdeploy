# ClawDeploy v3 - Agent Bridge Integration Plan

**Purpose**: Build and deploy the OpenClaw Agent Bridge that connects OpenClaw instances to the ClawDeploy control plane, enabling skill discovery, command execution, and multi-agent orchestration.

**Prerequisites**: 
- ClawDeploy v3 control plane deployed and operational
- OpenClaw source available in `openclaw-source/`
- Understanding of OpenClaw's gateway and skill system

---

## Overview

### What This Adds

The **Agent Bridge** is a middleware service that:

1. **Connects** OpenClaw instances to your control plane
2. **Discovers** available skills from OpenClaw's 60+ built-in capabilities
3. **Executes** commands by routing them through OpenClaw's agent runtime
4. **Reports** agent health, status, and capabilities to the dashboard
5. **Scales** to support multiple OpenClaw instances across machines

### Architecture

```
Dashboard (Browser)
    ↓ HTTP
Control API (Postgres)
    ↓ HTTP (polling)
Agent Bridge Client ← NEW
    ↓ Local/WebSocket
OpenClaw Gateway (AI Runtime)
    ↓
Skills (github, obsidian, slack, etc.)
```

---

## Phase 1: Agent Bridge Service

> Build the core bridge service that connects OpenClaw to the control plane.

### 1.1 Create Agent Bridge Structure

**New directory**: `deploy/agent-bridge/`

```
deploy/agent-bridge/
├── src/
│   ├── index.ts                # Main entry point
│   ├── config.ts               # Configuration loader
│   ├── control-api-client.ts   # Control API HTTP client
│   ├── openclaw-client.ts      # OpenClaw WebSocket/CLI client
│   ├── skills-parser.ts        # Parse SKILL.md files
│   ├── heartbeat.ts            # Heartbeat manager
│   ├── command-poller.ts       # Command polling loop
│   ├── command-executor.ts     # Execute commands via OpenClaw
│   └── types.ts                # TypeScript interfaces
├── package.json
├── tsconfig.json
├── Dockerfile
├── .dockerignore
├── .env.example
└── README.md
```

**Actions**:
- [ ] Create directory structure
- [ ] Initialize `package.json` with dependencies
- [ ] Create TypeScript configuration
- [ ] Create `.env.example` template
- [ ] Create README with setup instructions

### 1.2 Implement Core Components

#### Configuration (`src/config.ts`)

**Actions**:
- [ ] Load environment variables
- [ ] Validate required config (API URL, tokens, model)
- [ ] Support config from file and environment
- [ ] Export typed configuration object

**Required Environment Variables**:
```bash
# Control Plane Connection
CONTROL_API_URL=http://localhost:3001/api
AGENT_NAME=Local OpenClaw Agent
AGENT_DESCRIPTION=OpenClaw agent with full skill suite

# OpenClaw Configuration
OPENCLAW_GATEWAY_URL=ws://localhost:18789
OPENCLAW_GATEWAY_TOKEN=your-gateway-token
OPENCLAW_MODE=gateway  # or "embedded"
OPENCLAW_SKILLS_PATH=../openclaw-source/skills

# LLM Provider (Moonshot AI)
MOONSHOT_API_KEY=your-moonshot-key
OPENCLAW_MODEL=moonshot/kimi-k2.5

# Behavior
HEARTBEAT_INTERVAL=30000   # 30 seconds
COMMAND_POLL_INTERVAL=5000 # 5 seconds
```

#### Control API Client (`src/control-api-client.ts`)

**Actions**:
- [ ] Implement `registerAgent()` - POST /agents/register
- [ ] Implement `sendHeartbeat(health)` - POST /agents/heartbeat
- [ ] Implement `pollCommands()` - GET /commands?status=pending&agent_id={id}
- [ ] Implement `claimCommand(id)` - POST /commands/{id}/claim
- [ ] Implement `completeCommand(id, result)` - POST /commands/{id}/complete
- [ ] Implement `failCommand(id, error)` - POST /commands/{id}/fail
- [ ] Add error handling and retries
- [ ] Add Bearer token authentication

#### Skills Parser (`src/skills-parser.ts`)

**Actions**:
- [ ] Scan OpenClaw skills directory
- [ ] Parse YAML frontmatter from each SKILL.md
- [ ] Extract metadata: name, description, emoji, requirements
- [ ] Check if requirements are met (binaries available)
- [ ] Return structured skill list with availability status
- [ ] Cache parsed skills (rescan on SIGHUP)

**Output Format**:
```typescript
interface Skill {
  id: string;           // e.g., "github"
  name: string;         // e.g., "GitHub"
  emoji: string;        // e.g., "🐙"
  description: string;
  available: boolean;   // true if requirements met
  requirements: string[]; // e.g., ["gh"]
  missing?: string[];   // missing requirements
}
```

#### OpenClaw Client (`src/openclaw-client.ts`)

**Actions**:
- [ ] Implement WebSocket client for gateway mode
- [ ] Implement CLI spawner for embedded mode
- [ ] Send `connect` RPC with authentication
- [ ] Send `chat.send` RPC for command execution
- [ ] Handle response events and extract results
- [ ] Handle connection errors and reconnection
- [ ] Support session management
- [ ] Extract artifacts from responses

**WebSocket Protocol** (from OpenClaw):
```json
// Connect
{"type": "req", "id": "connect-1", "method": "connect", "params": {
  "minProtocol": 3, "maxProtocol": 3,
  "client": {"id": "agent-bridge", "version": "1.0.0"},
  "auth": {"token": "YOUR_TOKEN"}
}}

// Send message
{"type": "req", "id": "msg-1", "method": "chat.send", "params": {
  "sessionKey": "bridge-session",
  "message": "List my GitHub repos",
  "timeoutMs": 60000
}}

// Response
{"type": "res", "id": "msg-1", "ok": true, "payload": {...}}

// Event (agent reply)
{"type": "event", "event": "chat", "payload": {
  "state": "final",
  "message": {"content": [{"type": "text", "text": "..."}]}
}}
```

#### Heartbeat Manager (`src/heartbeat.ts`)

**Actions**:
- [ ] Initialize on agent registration
- [ ] Collect health metrics (CPU, memory, disk)
- [ ] Collect OpenClaw status (gateway URL, model, version)
- [ ] Collect skill capabilities from parser
- [ ] Send heartbeat every 30s
- [ ] Handle heartbeat failures (exponential backoff)
- [ ] Log heartbeat status

**Heartbeat Payload**:
```json
{
  "health": {
    "openclaw_version": "2026.2.6-3",
    "gateway_url": "ws://localhost:18789",
    "gateway_connected": true,
    "model": "moonshot/kimi-k2.5",
    "capabilities": [...skills],
    "active_sessions": 2,
    "cpu_usage": 23.4,
    "memory_mb": 1024,
    "disk_free_gb": 45.2
  },
  "openclaw_version": "2026.2.6-3"
}
```

#### Command Poller (`src/command-poller.ts`)

**Actions**:
- [ ] Poll control API every 5s for pending commands
- [ ] Filter by agent_id
- [ ] Claim commands immediately
- [ ] Pass to executor
- [ ] Handle polling errors (exponential backoff)
- [ ] Log command arrivals

#### Command Executor (`src/command-executor.ts`)

**Actions**:
- [ ] Route command to OpenClaw client
- [ ] Support command types: `chat`, `task`, `skill`
- [ ] Extract result from OpenClaw response
- [ ] Handle execution timeout
- [ ] Report success/failure to control API
- [ ] Log execution details

**Command Types**:
```typescript
interface Command {
  id: string;
  type: 'chat' | 'task' | 'skill';
  payload: {
    message?: string;      // for chat/task
    skill?: string;        // for skill execution
    args?: any;            // skill arguments
    session_id?: string;   // session context
    timeout_ms?: number;   // override default
  };
}
```

#### Main Entry Point (`src/index.ts`)

**Actions**:
- [ ] Load configuration
- [ ] Initialize OpenClaw client (connect to gateway)
- [ ] Parse skills and check availability
- [ ] Register agent with control API
- [ ] Start heartbeat loop
- [ ] Start command polling loop
- [ ] Handle SIGTERM/SIGINT for graceful shutdown
- [ ] Handle SIGHUP for config reload

**Startup Flow**:
```
1. Load config → validate
2. Parse OpenClaw skills → build capability list
3. Connect to OpenClaw gateway → verify connection
4. Register with control API → receive agent_id + token
5. Start heartbeat loop (30s interval)
6. Start command poller (5s interval)
7. Ready → log success
```

---

## Phase 2: Control API Extensions

> Extend the control API to support skill capabilities and better command management.

### 2.1 Update Database Schema

**New migration**: `deploy/control-api/src/migrations/002_capabilities.sql`

**Actions**:
- [ ] Add `capabilities JSONB` column to `agents` table
- [ ] Add index on `capabilities` for fast queries
- [ ] Add `session_id TEXT` column to `commands` table
- [ ] Add `artifacts JSONB` column to `commands` table
- [ ] Add `claimed_at TIMESTAMP` column to `commands` table

**Migration SQL**:
```sql
-- Add capabilities to agents
ALTER TABLE agents ADD COLUMN capabilities JSONB;
CREATE INDEX idx_agents_capabilities ON agents USING GIN(capabilities);

-- Enhance commands table
ALTER TABLE commands ADD COLUMN session_id TEXT;
ALTER TABLE commands ADD COLUMN artifacts JSONB;
ALTER TABLE commands ADD COLUMN claimed_at TIMESTAMP;
CREATE INDEX idx_commands_session ON commands(session_id);
```

### 2.2 Update Agent Endpoints

**File**: `deploy/control-api/src/routes/agents.ts`

**Actions**:
- [ ] Update heartbeat endpoint to accept `capabilities` in health payload
- [ ] Store capabilities in `agents.capabilities` column
- [ ] Return capabilities in agent detail endpoint
- [ ] Add endpoint: `GET /agents/:id/capabilities` - list agent skills
- [ ] Update agent list to include capability summary

### 2.3 Update Command Endpoints

**File**: `deploy/control-api/src/routes/commands.ts`

**Actions**:
- [ ] Add `POST /commands/:id/claim` endpoint
- [ ] Add `POST /commands/:id/complete` endpoint
- [ ] Add `POST /commands/:id/fail` endpoint
- [ ] Support `session_id` and `artifacts` in command payloads
- [ ] Add query parameter: `GET /commands?agent_id=X`
- [ ] Prevent double-claiming (check `claimed_at`)

---

## Phase 3: Dashboard Updates

> Show agent capabilities and enable skill-based command routing.

### 3.1 Update Agent View

**File**: `deploy/dashboard/src/views/Agents.tsx`

**Actions**:
- [ ] Show capabilities section for each agent
- [ ] Display skills as emoji badges (green = available, gray = unavailable)
- [ ] Add skill filter/search
- [ ] Show total skill count
- [ ] Add tooltip on hover showing skill description
- [ ] Add "missing requirements" indicator for unavailable skills
- [ ] Link to skill documentation (if available)

**UI Design**:
```
Agent Card:
┌────────────────────────────────────────┐
│ Agent Name                   [Online]  │
│ Last heartbeat: 12s ago                │
│                                        │
│ Capabilities (42 available)            │
│ 🐙 GitHub  💎 Obsidian  📝 Notion     │
│ 🎵 Spotify  🔔 Slack  📧 Gmail        │
│ + 36 more...                           │
│                                        │
│ [View Details] [Send Command]          │
└────────────────────────────────────────┘
```

### 3.2 Create Skill Browser View

**New file**: `deploy/dashboard/src/views/Skills.tsx`

**Actions**:
- [ ] Create new nav item: "Skills"
- [ ] List all unique skills across all agents
- [ ] Show which agents have each skill
- [ ] Add search/filter by name, category, availability
- [ ] Show skill description and requirements
- [ ] Add "Use Skill" button → opens command composer
- [ ] Show skill usage stats (commands executed)

### 3.3 Enhance Mission Command Creation

**File**: `deploy/dashboard/src/views/Missions.tsx`

**Actions**:
- [ ] Add skill selector dropdown
- [ ] Filter available agents by skill
- [ ] Pre-fill command payload based on skill selection
- [ ] Add command template library
- [ ] Show skill documentation in sidebar
- [ ] Add session management UI (continue conversation)

---

## Phase 4: Deployment Integration

> Add agent bridge to deploy.sh and docker-compose.

### 4.1 Dockerize Agent Bridge

**File**: `deploy/agent-bridge/Dockerfile`

**Actions**:
- [ ] Multi-stage build (build TypeScript → runtime image)
- [ ] Use Node 22+ base image
- [ ] Copy OpenClaw skills directory
- [ ] Install dependencies (production only)
- [ ] Set working directory
- [ ] Expose no ports (outbound only)
- [ ] Run as non-root user
- [ ] Add healthcheck script

**Dockerfile**:
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /build
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/package.json ./
RUN addgroup -g 1001 bridge && \
    adduser -D -u 1001 -G bridge bridge
USER bridge
CMD ["node", "dist/index.js"]
```

### 4.2 Add to docker-compose (Local Development)

**File**: `deploy/docker-compose.yml`

**Actions**:
- [ ] Add `agent-bridge` service
- [ ] Mount OpenClaw skills directory as read-only volume
- [ ] Connect to `clawdeploy` network
- [ ] Depend on `control-api`
- [ ] Pass environment variables from `.env`
- [ ] Add restart policy
- [ ] Optional: make this service profile-gated

**Service Definition**:
```yaml
agent-bridge:
  build:
    context: ./agent-bridge
    dockerfile: Dockerfile
  container_name: clawdeploy-agent-bridge
  restart: unless-stopped
  environment:
    CONTROL_API_URL: http://control-api:3001/api
    AGENT_NAME: ${AGENT_NAME:-Local Dev Agent}
    AGENT_DESCRIPTION: ${AGENT_DESCRIPTION:-Development OpenClaw instance}
    OPENCLAW_GATEWAY_URL: ${OPENCLAW_GATEWAY_URL}
    OPENCLAW_GATEWAY_TOKEN: ${OPENCLAW_GATEWAY_TOKEN}
    OPENCLAW_MODE: ${OPENCLAW_MODE:-gateway}
    OPENCLAW_SKILLS_PATH: /openclaw-skills
    MOONSHOT_API_KEY: ${MOONSHOT_API_KEY}
    OPENCLAW_MODEL: ${OPENCLAW_MODEL}
  volumes:
    - ../openclaw-source/skills:/openclaw-skills:ro
  networks:
    - clawdeploy
  depends_on:
    control-api:
      condition: service_healthy
  profiles:
    - agent-bridge  # Optional: only start with --profile agent-bridge
```

### 4.3 Update Environment Variables

**File**: `deploy/.env.example`

**Actions**:
- [ ] Add agent bridge configuration section
- [ ] Add OpenClaw gateway settings
- [ ] Add LLM provider settings
- [ ] Add behavior tuning settings

**New Variables**:
```bash
# Agent Bridge Configuration
AGENT_NAME=Local Development Agent
AGENT_DESCRIPTION=OpenClaw agent with full capabilities
OPENCLAW_MODE=gateway  # or "embedded"
OPENCLAW_SKILLS_PATH=../openclaw-source/skills

# OpenClaw Gateway
OPENCLAW_GATEWAY_URL=ws://localhost:18789
OPENCLAW_GATEWAY_TOKEN=your-gateway-token-here
OPENCLAW_VERSION=2026.2.6-3

# LLM Provider (Moonshot AI Kimi K2.5)
MOONSHOT_API_KEY=your-moonshot-api-key
OPENCLAW_MODEL=moonshot/kimi-k2.5
OPENCLAW_TEMPERATURE=0.7
OPENCLAW_MAX_TOKENS=4096

# Agent Bridge Behavior
HEARTBEAT_INTERVAL=30000
COMMAND_POLL_INTERVAL=5000
```

### 4.4 Extend deploy.sh

**File**: `deploy/deploy.sh`

**Actions**:
- [ ] Add `cmd_agent_bridge_build` - build agent bridge image
- [ ] Add `cmd_agent_bridge_start` - start agent bridge service
- [ ] Add `cmd_agent_bridge_stop` - stop agent bridge service
- [ ] Add `cmd_agent_bridge_logs` - tail agent bridge logs
- [ ] Add `cmd_agent_bridge_status` - check agent registration status
- [ ] Update `cmd_init` - optionally deploy agent bridge
- [ ] Update `cmd_status` - include agent bridge health
- [ ] Update help text

**New Commands**:
```bash
./deploy.sh agent-bridge build    # Build agent bridge Docker image
./deploy.sh agent-bridge start    # Start agent bridge service
./deploy.sh agent-bridge stop     # Stop agent bridge service
./deploy.sh agent-bridge logs     # View agent bridge logs
./deploy.sh agent-bridge status   # Check agent registration
./deploy.sh agent-bridge restart  # Restart agent bridge
```

---

## Phase 5: Testing & Verification

> Comprehensive testing checklist for the agent bridge integration.

### 5.1 Unit Tests

**Actions**:
- [ ] Test skills parser with mock SKILL.md files
- [ ] Test control API client with mock server
- [ ] Test OpenClaw client with mock WebSocket
- [ ] Test heartbeat payload generation
- [ ] Test command execution flow
- [ ] Test error handling and retries

### 5.2 Integration Tests

**Actions**:
- [ ] Start control plane (postgres, control-api, dashboard)
- [ ] Start OpenClaw gateway locally
- [ ] Generate gateway token: `openclaw doctor --generate-gateway-token`
- [ ] Configure agent bridge `.env`
- [ ] Start agent bridge
- [ ] Verify agent registration in dashboard
- [ ] Verify skills appear in agent capabilities
- [ ] Create test mission in dashboard
- [ ] Queue chat command
- [ ] Verify command execution
- [ ] Verify result appears in dashboard
- [ ] Test skill-specific command (e.g., GitHub)
- [ ] Test session continuity
- [ ] Test agent offline/online transitions

### 5.3 End-to-End Test Script

**New file**: `deploy/test-agent-bridge.sh`

**Actions**:
- [ ] Automated test script for CI/CD
- [ ] Start services with docker-compose
- [ ] Wait for services to be healthy
- [ ] Register test agent via API
- [ ] Send test command
- [ ] Poll for result
- [ ] Validate result content
- [ ] Clean up test data
- [ ] Report pass/fail

---

## Phase 6: Remote Agent Provisioning

> Deploy agent bridge to remote servers.

### 6.1 Ansible Playbook for Remote Agents

**New file**: `deploy/ansible/playbooks/agent-provision.yml`

**Actions**:
- [ ] Install Docker on remote host
- [ ] Copy agent bridge source
- [ ] Build agent bridge image
- [ ] Copy OpenClaw skills directory
- [ ] Generate `.env` from template
- [ ] Start OpenClaw gateway container
- [ ] Start agent bridge container
- [ ] Verify registration with control plane
- [ ] Add to systemd for auto-restart

**Playbook Structure**:
```yaml
- name: Provision OpenClaw Agent
  hosts: agents
  become: yes
  tasks:
    - name: Install Docker
      include_tasks: tasks/docker.yml
    
    - name: Deploy Agent Bridge
      include_tasks: tasks/agent-bridge.yml
    
    - name: Deploy OpenClaw Gateway
      include_tasks: tasks/openclaw-gateway.yml
    
    - name: Register with Control Plane
      uri:
        url: "{{ control_api_url }}/agents/register"
        method: POST
        body_format: json
        body:
          name: "{{ agent_name }}"
          description: "{{ agent_description }}"
        status_code: 201
      register: agent_registration
    
    - name: Save agent token
      copy:
        content: "{{ agent_registration.json.token }}"
        dest: /opt/clawdeploy-agent/.agent-token
        mode: '0600'
```

### 6.2 Update deploy.sh for Remote Agents

**Actions**:
- [ ] Add `cmd_provision_agent` - run Ansible playbook
- [ ] Add inventory management for agent hosts
- [ ] Add SSH key distribution
- [ ] Add health check for remote agents

**New Commands**:
```bash
./deploy.sh provision-agent <host>     # Provision new agent on remote host
./deploy.sh list-agents                # List all registered agents
./deploy.sh agent-health <agent-id>    # Check specific agent health
```

---

## Phase 7: Documentation

> Comprehensive documentation for agent bridge deployment and usage.

### 7.1 Update Existing Docs

**Actions**:
- [ ] Update `README.md` - add agent bridge overview
- [ ] Update `QUICK_START.md` - add agent bridge setup
- [ ] Update `AGENT_CONFIG.md` - merge with agent bridge docs
- [ ] Update `RUNSHEET.md` - add Phase 6 for agent bridge

### 7.2 Create New Documentation

**New files**:

**`AGENT_BRIDGE_GUIDE.md`**
- Architecture overview
- Setup instructions
- Configuration reference
- Troubleshooting guide
- Performance tuning

**`SKILLS_REFERENCE.md`**
- List all OpenClaw skills
- Requirements for each skill
- Usage examples
- Integration patterns

**`API_REFERENCE.md`**
- Control API endpoints
- Agent authentication
- Command payload formats
- WebSocket protocol
- Error codes

---

## Implementation Order

Execute in this order for smooth integration:

| # | Phase | Task | Duration | Dependencies |
|---|-------|------|----------|--------------|
| 1 | P1.1 | Create agent bridge structure | 1h | - |
| 2 | P1.2 | Implement config loader | 1h | P1.1 |
| 3 | P1.2 | Implement skills parser | 2h | P1.1 |
| 4 | P1.2 | Implement control API client | 2h | P1.1 |
| 5 | P1.2 | Implement OpenClaw WebSocket client | 3h | P1.1 |
| 6 | P1.2 | Implement heartbeat manager | 1h | P1.2(config, skills) |
| 7 | P1.2 | Implement command poller | 1h | P1.2(api client) |
| 8 | P1.2 | Implement command executor | 2h | P1.2(openclaw client) |
| 9 | P1.2 | Implement main entry point | 2h | All P1.2 |
| 10 | P2.1 | Create capabilities migration | 0.5h | - |
| 11 | P2.2 | Update agent endpoints | 1h | P2.1 |
| 12 | P2.3 | Update command endpoints | 1h | P2.1 |
| 13 | P3.1 | Update agent view UI | 2h | P2.2 |
| 14 | P3.2 | Create skill browser view | 3h | P2.2 |
| 15 | P3.3 | Enhance mission command UI | 2h | P3.2 |
| 16 | P4.1 | Create Dockerfile | 1h | P1 complete |
| 17 | P4.2 | Add to docker-compose | 0.5h | P4.1 |
| 18 | P4.3 | Update .env.example | 0.5h | - |
| 19 | P4.4 | Extend deploy.sh | 2h | P4.1-4.3 |
| 20 | P5.1 | Write unit tests | 3h | P1 complete |
| 21 | P5.2 | Integration testing | 2h | P1-P4 complete |
| 22 | P5.3 | Create E2E test script | 2h | P5.2 |
| 23 | P6.1 | Create Ansible playbook | 3h | P4 complete |
| 24 | P6.2 | Update deploy.sh for remote | 1h | P6.1 |
| 25 | P7.1 | Update existing docs | 2h | P1-P6 complete |
| 26 | P7.2 | Write new docs | 4h | P1-P6 complete |

**Total Estimated Time**: ~45-50 hours

---

## Verification Checklist

After completing all phases, verify:

### Local Development
- [ ] `./deploy.sh agent-bridge build` succeeds
- [ ] `./deploy.sh agent-bridge start` starts service
- [ ] Agent appears in dashboard Agents view
- [ ] Agent status shows "online" with green badge
- [ ] Capabilities section shows 60+ skills
- [ ] Skills are marked available/unavailable correctly
- [ ] Heartbeat updates every 30s (check logs)
- [ ] Command polling works (check logs)

### Command Execution
- [ ] Create mission in dashboard succeeds
- [ ] Queue chat command succeeds
- [ ] Agent picks up command within 5s
- [ ] Agent claims command (status: claimed)
- [ ] OpenClaw executes command
- [ ] Result appears in dashboard
- [ ] Command status updates to completed
- [ ] Command output is readable

### Skill Testing
- [ ] Test GitHub skill (list repos)
- [ ] Test file operations (read workspace file)
- [ ] Test session continuity (multi-turn chat)
- [ ] Test error handling (invalid command)
- [ ] Test timeout handling (long-running command)
- [ ] Test unavailable skill (missing dependency)

### Dashboard Features
- [ ] Skills browser shows all skills
- [ ] Skill search/filter works
- [ ] Skill detail view shows description
- [ ] Command composer pre-fills from skill
- [ ] Agent filter by capability works
- [ ] Mission history shows artifacts

### Remote Deployment
- [ ] `./deploy.sh provision-agent <host>` succeeds
- [ ] Remote agent registers successfully
- [ ] Remote agent appears in dashboard
- [ ] Remote agent can execute commands
- [ ] Remote agent persists after reboot

### Documentation
- [ ] README has agent bridge section
- [ ] QUICK_START includes agent setup
- [ ] AGENT_BRIDGE_GUIDE is complete
- [ ] SKILLS_REFERENCE lists all skills
- [ ] API_REFERENCE is accurate

---

## Architecture Decisions

### Why WebSocket over HTTP for OpenClaw?

OpenClaw's gateway uses WebSocket for real-time bidirectional communication. This allows:
- Streaming responses from the AI agent
- Live status updates during long-running tasks
- Session management for multi-turn conversations
- Lower latency than HTTP polling

### Why Pull-Based Command Polling?

Agents poll the control plane for commands rather than the control plane pushing via WebSocket to agents because:
- Simpler firewall configuration (agents don't need inbound ports)
- Works across NAT/firewalls without VPN
- Easier to scale (no persistent connections to manage)
- Agents can be stopped/started without control plane changes

### Why Parse SKILL.md Files?

OpenClaw skills are documented in Markdown with YAML frontmatter. Parsing these gives us:
- Single source of truth (no duplicate metadata)
- Automatic skill discovery (no manual registration)
- Requirement checking (binary availability)
- Rich metadata (emoji, descriptions, install instructions)

### Why Separate Agent Bridge Service?

The agent bridge could be baked into OpenClaw itself, but we keep it separate because:
- Decoupling allows OpenClaw to be used standalone
- Easier to update bridge logic without rebuilding OpenClaw
- Can support multiple OpenClaw instances per bridge
- Clearer separation of concerns (orchestration vs. execution)

---

## Security Considerations

### Agent Authentication

**Current**: Bearer token from registration endpoint
**Risk**: Token transmitted in HTTP headers
**Mitigation**: 
- Use HTTPS for control API
- Rotate tokens periodically
- Store tokens in secure files (not environment variables)
- Consider JWT with short expiry

### OpenClaw Gateway Access

**Current**: Static token from `openclaw.json`
**Risk**: Long-lived token in config file
**Mitigation**:
- Generate unique token per agent bridge
- Use `openclaw doctor --generate-gateway-token`
- Store in secrets manager in production
- Enable gateway authentication modes (password + token)

### Skill Execution

**Risk**: Skills run shell commands with agent's permissions
**Mitigation**:
- Run agent bridge as unprivileged user
- Use Docker to sandbox OpenClaw execution
- Review skill code before deployment
- Implement skill allowlist in dashboard
- Log all skill executions to control plane

### Remote Agent Provisioning

**Risk**: SSH keys and API tokens in Ansible playbooks
**Mitigation**:
- Use Ansible Vault for secrets
- Generate unique tokens per agent
- Use SSH key-based auth only
- Restrict agent server SSH access
- Enable audit logging

---

## Performance Tuning

### Heartbeat Interval

**Default**: 30 seconds
**Tuning**:
- Decrease to 10s for faster status updates
- Increase to 60s to reduce API load
- Monitor database write load
- Consider adaptive intervals (faster when active)

### Command Polling Interval

**Default**: 5 seconds
**Tuning**:
- Decrease to 1s for lower latency
- Increase to 10s to reduce API load
- Use WebSocket notifications instead (future enhancement)
- Implement exponential backoff when no commands

### Skill Parsing

**Current**: Parse on startup, cache in memory
**Optimization**:
- Watch skills directory for changes (fs.watch)
- Re-parse on SIGHUP signal
- Store parsed skills in Redis (shared cache)
- Compress capabilities payload in heartbeat

### OpenClaw Connection

**Current**: Persistent WebSocket in gateway mode
**Optimization**:
- Implement connection pooling (multiple OpenClaw instances)
- Add circuit breaker for failed connections
- Implement request queuing during reconnection
- Use embedded mode for simpler deployments (trade-off: slower)

---

## Future Enhancements

### Phase 8: Advanced Features

- [ ] **Multi-Agent Collaboration**: Commands that require multiple agents
- [ ] **Skill Composition**: Chain skills together (e.g., GitHub → Slack)
- [ ] **Cost Tracking**: Monitor LLM API usage per agent/mission
- [ ] **Agent Pools**: Group agents by capability (e.g., "code-agents")
- [ ] **Priority Queues**: High-priority commands jump the queue
- [ ] **Scheduled Commands**: Cron-like command scheduling
- [ ] **Command Templates**: Library of pre-built command workflows
- [ ] **Skill Marketplace**: Install community skills from registry

### Phase 9: Observability

- [ ] **Metrics**: Prometheus exporter for agent/command metrics
- [ ] **Tracing**: OpenTelemetry integration for request tracing
- [ ] **Dashboards**: Grafana dashboards for agent health
- [ ] **Alerting**: Alert on agent offline, command failures
- [ ] **Log Aggregation**: Ship logs to ELK/Loki
- [ ] **Replay**: Record/replay command executions

### Phase 10: Security Hardening

- [ ] **mTLS**: Mutual TLS between agent bridge and control API
- [ ] **Secrets Management**: Integration with Vault/AWS Secrets
- [ ] **Audit Logging**: Comprehensive audit trail
- [ ] **Role-Based Access**: Different agent permission levels
- [ ] **Skill Sandboxing**: Run skills in isolated containers
- [ ] **Network Policies**: Restrict agent egress traffic

---

## Cost Implications

### Additional Infrastructure

| Component | Resource | Monthly Cost |
|-----------|----------|--------------|
| Agent Bridge | CPU/Memory (included in agent server) | $0 |
| OpenClaw Gateway | 1-2GB RAM | Included |
| LLM API (Moonshot) | Per-token pricing | Variable |

**Estimated Costs**:
- Local development: $0 (runs on dev machine)
- Single remote agent: $6-12/month (Hetzner CX22/CX32)
- 10 remote agents: $60-120/month
- LLM usage: ~$1-5 per agent per day (varies by workload)

**Cost Optimization**:
- Use smaller agent servers (CX22 often sufficient)
- Batch commands to reduce API calls
- Cache frequently used prompts
- Implement token usage limits per mission
- Use cheaper models for simple tasks

---

## Rollout Strategy

### Stage 1: Local Development (Week 1)
- Build agent bridge locally
- Test with local OpenClaw gateway
- Verify skill discovery and command execution
- Polish dashboard UI

### Stage 2: Single Remote Agent (Week 2)
- Deploy one remote agent to test server
- Verify firewall/networking
- Test remote command execution
- Document any issues

### Stage 3: Production Deployment (Week 3)
- Deploy to production control plane
- Provision 2-3 production agents
- Run end-to-end tests
- Monitor for 48 hours

### Stage 4: Scale Testing (Week 4)
- Add 5-10 agents
- Load test command queue
- Optimize polling intervals
- Tune database queries

### Stage 5: Documentation & Training (Week 5)
- Finalize all documentation
- Create video walkthroughs
- Write troubleshooting guides
- Train team on usage

---

## Success Metrics

After full deployment, track:

- **Agent Availability**: % of agents online at any time (target: >95%)
- **Command Latency**: Time from queue → execution → result (target: <10s)
- **Command Success Rate**: % of commands that complete successfully (target: >98%)
- **Skill Coverage**: % of skills available across all agents (target: >80%)
- **API Uptime**: Control API availability (target: >99.9%)
- **Cost Efficiency**: $ per command executed (target: <$0.05)

---

**Last Updated**: February 11, 2026  
**Version**: 1.0  
**Status**: Ready for Implementation

---

## Quick Reference Commands

```bash
# Build & Start
./deploy.sh agent-bridge build
./deploy.sh agent-bridge start

# Monitor
./deploy.sh agent-bridge logs
./deploy.sh agent-bridge status
./deploy.sh status

# Test
./test-agent-bridge.sh

# Provision Remote Agent
./deploy.sh provision-agent <host>

# Manage Agents
./deploy.sh list-agents
./deploy.sh agent-health <agent-id>
```
