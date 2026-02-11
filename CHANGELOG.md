# Changelog

All notable changes to ClawDeploy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2026-02-11

### Architecture Overhaul

Complete rewrite from v2 to v3 with pull-based agent architecture.

### Added

- **PostgreSQL Backend**: All state now stored in PostgreSQL 16
  - Agents table with health tracking
  - Missions table for high-level objectives
  - Commands table for task queue
  - Events table for audit trail
  
- **Control API**: Unified Node.js + Express API
  - Agent registration and heartbeat endpoints
  - Command polling and result submission
  - Mission and command management
  - Workspace file browsing
  - Session transcript access
  - Health check endpoint
  
- **Dashboard Rewrite**: React 19 + TypeScript + Vite
  - Overview page with system stats
  - Agents view with status monitoring
  - Missions view with command queuing
  - Files browser and editor
  - Sessions viewer
  - Events audit log
  - Settings page
  
- **Pull-Based Architecture**: Agents poll for commands
  - No inbound connections to agents
  - Heartbeat-based status tracking (online/stale/offline)
  - Bearer token authentication
  
- **Infrastructure as Code**:
  - Terraform for Hetzner VPS provisioning
  - Ansible playbooks for deployment
  - Nginx reverse proxy with basic auth
  - Docker Compose orchestration
  
- **Deployment Script**: Single `deploy.sh` for all operations
  - `init` command for fresh deployments
  - `backup` and `restore` commands
  - `status` and `logs` commands
  - Service-specific restart commands

### Changed

- **Removed WebSocket**: Dashboard now polls Control API
- **Removed File API**: Absorbed into Control API
- **Simplified Firewall**: Only ports 22, 80, 443
- **Agent Authentication**: Bearer token instead of shared secret

### Removed

- OpenClaw Gateway (agents no longer run on control plane)
- WebSocket server
- File API microservice
- Direct agent connections

### Security

- Nginx basic authentication for dashboard
- Bearer token authentication for agents
- PostgreSQL internal-only (not exposed)
- Firewall restricted to essential ports

## [2.0.0] - 2025-12-XX

Previous version with WebSocket and file-based architecture.

## [1.0.0] - 2025-10-XX

Initial release.

---

[3.0.0]: https://github.com/your-org/clawdeploy/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/your-org/clawdeploy/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/your-org/clawdeploy/releases/tag/v1.0.0
