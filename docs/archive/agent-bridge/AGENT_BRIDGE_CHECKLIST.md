# Agent Bridge Implementation Checklist

Track progress through the implementation phases. Mark items as complete as you build.

---

## Phase 1: Agent Bridge Service ⏳

### 1.1 Project Setup
- [ ] Create `deploy/agent-bridge/` directory structure
- [ ] Create `package.json` with dependencies
- [ ] Create `tsconfig.json`
- [ ] Create `.env.example`
- [ ] Create `README.md`
- [ ] Create `.dockerignore`
- [ ] Create `.gitignore`

**Dependencies to install**:
```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "ws": "^8.16.0",
    "dotenv": "^16.4.0",
    "yaml": "^2.3.4"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/ws": "^8.5.10",
    "typescript": "^5.3.0",
    "tsx": "^4.7.0"
  }
}
```

### 1.2 Core Components

#### Config Loader (`src/config.ts`)
- [ ] Define `Config` interface
- [ ] Load from `.env` file
- [ ] Validate required fields
- [ ] Export typed config object
- [ ] Add default values

#### Skills Parser (`src/skills-parser.ts`)
- [ ] Define `Skill` interface
- [ ] Scan skills directory recursively
- [ ] Parse YAML frontmatter from SKILL.md files
- [ ] Extract metadata (name, emoji, description)
- [ ] Check binary requirements (which/command -v)
- [ ] Return skill list with availability
- [ ] Add error handling for malformed files
- [ ] Cache parsed results

#### Control API Client (`src/control-api-client.ts`)
- [ ] Define `ControlApiClient` class
- [ ] Implement `registerAgent(name, description)`
- [ ] Implement `sendHeartbeat(health)`
- [ ] Implement `pollCommands(agentId)`
- [ ] Implement `claimCommand(commandId)`
- [ ] Implement `completeCommand(commandId, result)`
- [ ] Implement `failCommand(commandId, error)`
- [ ] Add Bearer token authentication
- [ ] Add retry logic with exponential backoff
- [ ] Add request/response logging

#### OpenClaw Client (`src/openclaw-client.ts`)
- [ ] Define `OpenClawClient` class
- [ ] Implement WebSocket connection
- [ ] Implement `connect()` RPC
- [ ] Implement `chat.send()` RPC
- [ ] Handle response events
- [ ] Handle chat events (agent replies)
- [ ] Extract final message content
- [ ] Handle errors and timeouts
- [ ] Implement reconnection logic
- [ ] Support session management
- [ ] Add embedded mode (CLI spawner)

#### Heartbeat Manager (`src/heartbeat.ts`)
- [ ] Define `HeartbeatManager` class
- [ ] Collect system metrics (CPU, memory, disk)
- [ ] Collect OpenClaw status
- [ ] Collect capabilities from skills parser
- [ ] Format heartbeat payload
- [ ] Send heartbeat every N seconds
- [ ] Handle send failures
- [ ] Log heartbeat status

#### Command Poller (`src/command-poller.ts`)
- [ ] Define `CommandPoller` class
- [ ] Poll API every N seconds
- [ ] Filter by agent_id
- [ ] Claim commands immediately
- [ ] Pass to executor
- [ ] Handle polling errors
- [ ] Log command arrivals

#### Command Executor (`src/command-executor.ts`)
- [ ] Define `CommandExecutor` class
- [ ] Route to OpenClaw client
- [ ] Support command types: chat, task, skill
- [ ] Extract result from response
- [ ] Handle timeout
- [ ] Report success to API
- [ ] Report failure to API
- [ ] Log execution details

#### Main Entry Point (`src/index.ts`)
- [ ] Load configuration
- [ ] Initialize logger
- [ ] Parse skills on startup
- [ ] Connect to OpenClaw gateway
- [ ] Register with control API
- [ ] Start heartbeat loop
- [ ] Start command polling loop
- [ ] Handle SIGTERM for graceful shutdown
- [ ] Handle SIGINT for graceful shutdown
- [ ] Handle SIGHUP for config reload
- [ ] Add startup banner

---

## Phase 2: Control API Extensions ⏳

### 2.1 Database Schema
- [ ] Create migration: `002_capabilities.sql`
- [ ] Add `capabilities JSONB` to agents table
- [ ] Add GIN index on capabilities
- [ ] Add `session_id TEXT` to commands table
- [ ] Add `artifacts JSONB` to commands table
- [ ] Add `claimed_at TIMESTAMP` to commands table
- [ ] Add index on `session_id`
- [ ] Test migration locally

### 2.2 Agent Endpoints
- [ ] Update heartbeat to accept capabilities
- [ ] Store capabilities in database
- [ ] Return capabilities in agent detail
- [ ] Add `GET /agents/:id/capabilities`
- [ ] Update agent list response
- [ ] Add tests

### 2.3 Command Endpoints
- [ ] Add `POST /commands/:id/claim`
- [ ] Add `POST /commands/:id/complete`
- [ ] Add `POST /commands/:id/fail`
- [ ] Support session_id in commands
- [ ] Support artifacts in results
- [ ] Prevent double-claiming
- [ ] Add query param: `agent_id`
- [ ] Add tests

---

## Phase 3: Dashboard Updates ⏳

### 3.1 Agent View Updates
- [ ] Update `types.ts` with Capability interface
- [ ] Update `api/client.ts` to fetch capabilities
- [ ] Create `components/SkillBadge.tsx`
- [ ] Update `views/Agents.tsx` with capabilities section
- [ ] Add skill badges (available/unavailable)
- [ ] Add skill count
- [ ] Add tooltip on hover
- [ ] Add missing requirements indicator
- [ ] Style with Tailwind

### 3.2 Skill Browser
- [ ] Create `views/Skills.tsx`
- [ ] Add "Skills" nav item to App.tsx
- [ ] List all unique skills across agents
- [ ] Show which agents have each skill
- [ ] Add search/filter
- [ ] Show skill descriptions
- [ ] Add "Use Skill" button
- [ ] Show usage stats

### 3.3 Mission Enhancements
- [ ] Add skill selector to command form
- [ ] Filter agents by skill
- [ ] Pre-fill command payload
- [ ] Add command template library
- [ ] Add session management UI
- [ ] Show skill docs in sidebar

---

## Phase 4: Deployment Integration ⏳

### 4.1 Dockerization
- [ ] Create `agent-bridge/Dockerfile`
- [ ] Multi-stage build (TypeScript → Node)
- [ ] Use Node 22+ base
- [ ] Copy package files
- [ ] Install production deps
- [ ] Build TypeScript
- [ ] Run as non-root user
- [ ] Add healthcheck
- [ ] Test build locally

### 4.2 Docker Compose
- [ ] Add `agent-bridge` service to docker-compose.yml
- [ ] Mount skills directory as read-only
- [ ] Add to clawdeploy network
- [ ] Depend on control-api
- [ ] Pass environment variables
- [ ] Add restart policy
- [ ] Add profile (optional)
- [ ] Test with `docker compose up`

### 4.3 Environment
- [ ] Update `.env.example` with agent bridge vars
- [ ] Document all new variables
- [ ] Add comments for each section
- [ ] Update `.env` locally

### 4.4 Deploy Script
- [ ] Add `cmd_agent_bridge_build()`
- [ ] Add `cmd_agent_bridge_start()`
- [ ] Add `cmd_agent_bridge_stop()`
- [ ] Add `cmd_agent_bridge_logs()`
- [ ] Add `cmd_agent_bridge_status()`
- [ ] Add `cmd_agent_bridge_restart()`
- [ ] Update `cmd_status()` to include bridge
- [ ] Update help text
- [ ] Test all new commands

---

## Phase 5: Testing & Verification ⏳

### 5.1 Unit Tests
- [ ] Test skills parser with fixtures
- [ ] Test control API client (mocked)
- [ ] Test OpenClaw client (mocked WebSocket)
- [ ] Test heartbeat payload generation
- [ ] Test command execution flow
- [ ] Test error handling
- [ ] Run tests with `npm test`

### 5.2 Integration Testing
- [ ] Start control plane locally
- [ ] Start OpenClaw gateway
- [ ] Generate gateway token
- [ ] Configure bridge .env
- [ ] Start agent bridge
- [ ] Verify registration in dashboard
- [ ] Verify skills appear
- [ ] Create test mission
- [ ] Queue test command
- [ ] Verify execution
- [ ] Verify result in dashboard
- [ ] Test GitHub skill
- [ ] Test session continuity
- [ ] Test offline/online transitions

### 5.3 E2E Test Script
- [ ] Create `test-agent-bridge.sh`
- [ ] Start services with docker-compose
- [ ] Wait for health checks
- [ ] Register test agent via API
- [ ] Send test command via API
- [ ] Poll for result
- [ ] Validate result
- [ ] Clean up test data
- [ ] Report pass/fail

---

## Phase 6: Remote Provisioning ⏳

### 6.1 Ansible Playbook
- [ ] Create `ansible/playbooks/agent-provision.yml`
- [ ] Create `ansible/tasks/agent-bridge.yml`
- [ ] Create `ansible/tasks/openclaw-gateway.yml`
- [ ] Install Docker on remote
- [ ] Copy agent bridge files
- [ ] Build images on remote
- [ ] Copy skills directory
- [ ] Generate .env from template
- [ ] Start OpenClaw gateway container
- [ ] Start agent bridge container
- [ ] Verify registration
- [ ] Add systemd service files

### 6.2 Deploy Script Updates
- [ ] Add `cmd_provision_agent()`
- [ ] Add inventory management
- [ ] Add SSH key distribution
- [ ] Add remote health checks
- [ ] Add `cmd_list_agents()`
- [ ] Add `cmd_agent_health()`
- [ ] Test provisioning to remote host

---

## Phase 7: Documentation ⏳

### 7.1 Update Existing Docs
- [ ] Update `README.md` - add agent bridge section
- [ ] Update `QUICK_START.md` - add setup steps
- [ ] Update `AGENT_CONFIG.md` - merge bridge docs
- [ ] Update `RUNSHEET.md` - reference Phase 6

### 7.2 New Documentation
- [ ] Create `AGENT_BRIDGE_GUIDE.md`
  - [ ] Architecture overview
  - [ ] Setup instructions
  - [ ] Configuration reference
  - [ ] Troubleshooting guide
  - [ ] Performance tuning
- [ ] Create `SKILLS_REFERENCE.md`
  - [ ] List all skills
  - [ ] Requirements per skill
  - [ ] Usage examples
  - [ ] Integration patterns
- [ ] Create `API_REFERENCE.md`
  - [ ] All endpoints
  - [ ] Authentication
  - [ ] Payload formats
  - [ ] Error codes
  - [ ] WebSocket protocol

---

## Final Verification ✅

### Local Development
- [ ] Build succeeds
- [ ] Service starts without errors
- [ ] Agent registers successfully
- [ ] Agent appears in dashboard
- [ ] Status shows "online"
- [ ] Capabilities show 60+ skills
- [ ] Skills marked available/unavailable correctly
- [ ] Heartbeat logs every 30s
- [ ] Command polling logs every 5s

### Command Execution
- [ ] Create mission works
- [ ] Queue command works
- [ ] Agent picks up command within 5s
- [ ] Command claimed correctly
- [ ] OpenClaw executes command
- [ ] Result appears in dashboard
- [ ] Status updates to completed
- [ ] Output is readable

### Skill Testing
- [ ] GitHub skill works
- [ ] File operations work
- [ ] Session continuity works
- [ ] Error handling works
- [ ] Timeout handling works
- [ ] Unavailable skill handled correctly

### Dashboard
- [ ] Skills browser works
- [ ] Search/filter works
- [ ] Skill detail view works
- [ ] Command composer works
- [ ] Agent filter by skill works
- [ ] Mission history shows artifacts

### Remote Deployment
- [ ] Provision script works
- [ ] Remote agent registers
- [ ] Remote agent appears in dashboard
- [ ] Remote agent executes commands
- [ ] Agent persists after reboot

### Documentation
- [ ] README complete
- [ ] QUICK_START includes setup
- [ ] AGENT_BRIDGE_GUIDE complete
- [ ] SKILLS_REFERENCE complete
- [ ] API_REFERENCE accurate
- [ ] All examples tested

---

## Progress Tracking

**Started**: _____________
**Target Completion**: _____________

**Phase 1**: ⬜ Not Started | ⏳ In Progress | ✅ Complete  
**Phase 2**: ⬜ Not Started | ⏳ In Progress | ✅ Complete  
**Phase 3**: ⬜ Not Started | ⏳ In Progress | ✅ Complete  
**Phase 4**: ⬜ Not Started | ⏳ In Progress | ✅ Complete  
**Phase 5**: ⬜ Not Started | ⏳ In Progress | ✅ Complete  
**Phase 6**: ⬜ Not Started | ⏳ In Progress | ✅ Complete  
**Phase 7**: ⬜ Not Started | ⏳ In Progress | ✅ Complete  

**Overall**: ____ / 7 phases complete

---

## Notes & Issues

_Track any blockers, decisions, or important notes here:_

- 
- 
- 

---

**Last Updated**: February 11, 2026
