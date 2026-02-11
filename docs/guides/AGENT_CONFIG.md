# Agent Configuration Guide

This guide covers how to configure remote OpenClaw agents to connect to the ClawDeploy control plane.

## LLM Provider: Kimi K2.5 from Moonshot AI

ClawDeploy agents are configured to use **Kimi K2.5** from Moonshot AI as the primary LLM provider.

### Why Kimi K2.5?

- **High Performance**: Competitive with leading frontier models
- **Cost Effective**: Affordable pricing for production workloads
- **API Compatibility**: Works seamlessly with OpenClaw
- **Chinese & English**: Strong multilingual support

## Getting Started

### 1. Get Moonshot API Key

1. Sign up at [Moonshot AI Platform](https://platform.moonshot.cn/)
2. Create a new API key
3. Save the key securely

### 2. Register Agent with Control Plane

```bash
curl -X POST https://your-clawdeploy-domain.com/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Agent 1",
    "description": "Main production agent powered by Kimi K2.5"
  }'
```

**Response:**
```json
{
  "agent_id": "550e8400-e29b-41d4-a716-446655440000",
  "token": "agent-token-here",
  "name": "Production Agent 1",
  "status": "offline",
  "created_at": "2026-02-11T10:00:00Z"
}
```

Save the `token` - you'll need it for agent configuration.

### 3. Configure Agent Environment

On your remote agent server, create a `.env` file:

```bash
# Control Plane Connection
CONTROL_API_URL=https://your-clawdeploy-domain.com/api
AGENT_TOKEN=agent-token-from-registration-response

# Moonshot AI Configuration
MOONSHOT_API_KEY=your-moonshot-api-key-here
OPENCLAW_MODEL=moonshot/kimi-k2.5

# Optional: Model Parameters
OPENCLAW_TEMPERATURE=0.7
OPENCLAW_MAX_TOKENS=4096
OPENCLAW_TOP_P=0.95

# Optional: Agent Identity
AGENT_NAME=Production Agent 1
AGENT_DESCRIPTION=Main production agent

# Optional: Heartbeat Configuration
HEARTBEAT_INTERVAL=30000  # 30 seconds
COMMAND_POLL_INTERVAL=5000  # 5 seconds
```

### 4. Deploy Agent

#### Using Docker (Recommended)

```bash
# Build OpenClaw image with agent client
cd openclaw-source
docker build -t openclaw-agent:latest .

# Run agent
docker run -d \
  --name openclaw-agent \
  --restart unless-stopped \
  --env-file .env \
  -v ~/.openclaw:/root/.openclaw \
  openclaw-agent:latest
```

#### Using Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  agent:
    build: ./openclaw-source
    container_name: openclaw-agent
    restart: unless-stopped
    env_file: .env
    volumes:
      - openclaw-data:/root/.openclaw
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  openclaw-data:
```

Then:

```bash
docker compose up -d
```

## Model Configuration

### Kimi K2.5 Specifications

| Parameter | Value |
|-----------|-------|
| Model ID | `moonshot/kimi-k2.5` |
| Context Window | 128K tokens |
| Max Output | 16K tokens |
| Languages | Chinese, English, and more |
| API Endpoint | `https://api.moonshot.cn/v1` |

### Adjusting Model Parameters

You can fine-tune the model's behavior with these environment variables:

```bash
# Temperature: Controls randomness (0.0-1.0)
# Lower = more focused, Higher = more creative
OPENCLAW_TEMPERATURE=0.7

# Max Tokens: Maximum response length
OPENCLAW_MAX_TOKENS=4096

# Top P: Nucleus sampling (0.0-1.0)
OPENCLAW_TOP_P=0.95

# Frequency Penalty: Reduce repetition (-2.0 to 2.0)
OPENCLAW_FREQUENCY_PENALTY=0.0

# Presence Penalty: Encourage new topics (-2.0 to 2.0)
OPENCLAW_PRESENCE_PENALTY=0.0
```

### Using Alternative Models

If you want to use a different Moonshot model:

```bash
# Kimi v1
OPENCLAW_MODEL=moonshot/kimi-v1

# Kimi K2 (previous generation)
OPENCLAW_MODEL=moonshot/kimi-k2
```

Or switch to other providers:

```bash
# Anthropic Claude
ANTHROPIC_API_KEY=your-key
OPENCLAW_MODEL=anthropic/claude-3-opus

# OpenAI GPT-4
OPENAI_API_KEY=your-key
OPENCLAW_MODEL=openai/gpt-4-turbo

# DeepSeek
DEEPSEEK_API_KEY=your-key
OPENCLAW_MODEL=deepseek/deepseek-chat
```

## Monitoring Agent Health

### Check Agent Status in Dashboard

1. Navigate to **Agents** tab in dashboard
2. Look for your agent in the list
3. Status indicators:
   - 🟢 **Online**: Heartbeat received within 90s
   - 🟡 **Stale**: No heartbeat for 90-300s
   - 🔴 **Offline**: No heartbeat for >300s

### Check Agent Logs

```bash
# Docker
docker logs openclaw-agent -f

# Docker Compose
docker compose logs agent -f

# Filter for errors
docker logs openclaw-agent 2>&1 | grep ERROR
```

### Manual Heartbeat Test

```bash
curl -X POST https://your-clawdeploy-domain.com/api/agents/heartbeat \
  -H "Authorization: Bearer your-agent-token" \
  -H "Content-Type: application/json" \
  -d '{
    "health": {
      "cpu_usage": 45.2,
      "memory_usage": 2048,
      "disk_free": 50000
    },
    "openclaw_version": "1.5.2"
  }'
```

## Troubleshooting

### Agent Shows as Offline

**Check network connectivity:**
```bash
curl -I https://your-clawdeploy-domain.com/api/health
```

**Verify agent token:**
```bash
docker exec openclaw-agent env | grep AGENT_TOKEN
```

**Check logs for errors:**
```bash
docker logs openclaw-agent --tail 100
```

### API Key Issues

**Test Moonshot API key:**
```bash
curl https://api.moonshot.cn/v1/models \
  -H "Authorization: Bearer your-moonshot-api-key"
```

**Verify key is set:**
```bash
docker exec openclaw-agent env | grep MOONSHOT_API_KEY
```

### Commands Not Executing

**Check command polling:**
```bash
docker logs openclaw-agent | grep "Polling for commands"
```

**Manually poll for commands:**
```bash
curl https://your-clawdeploy-domain.com/api/commands/pending \
  -H "Authorization: Bearer your-agent-token"
```

**Check agent can accept commands:**
```bash
# Queue a test command in dashboard
# Check agent logs for execution
docker logs openclaw-agent -f
```

## Security Best Practices

1. **Store API keys securely**
   - Use environment variables, not hardcoded values
   - Use secrets management (Docker secrets, Vault, etc.)
   - Never commit keys to version control

2. **Rotate tokens regularly**
   - Re-register agents periodically
   - Update `.env` with new tokens
   - Restart agent containers

3. **Monitor API usage**
   - Check Moonshot AI dashboard for usage
   - Set up billing alerts
   - Monitor for unusual patterns

4. **Network security**
   - Use HTTPS for control plane
   - Restrict agent server access
   - Use firewall rules

5. **Keep agents updated**
   - Pull latest OpenClaw images regularly
   - Apply security patches
   - Monitor for vulnerabilities

## Cost Management

### Kimi K2.5 Pricing (Approximate)

- **Input**: ~¥0.02 / 1K tokens
- **Output**: ~¥0.06 / 1K tokens

### Estimating Costs

For a typical agent handling 100 tasks/day:
- Average 2K input tokens per task
- Average 1K output tokens per task
- Daily cost: ~¥10-15 ($1.50-2.00 USD)
- Monthly cost: ~¥300-450 ($45-65 USD)

### Optimization Tips

1. **Use appropriate max_tokens**
   ```bash
   OPENCLAW_MAX_TOKENS=2048  # Instead of 4096
   ```

2. **Cache frequent prompts**
   - Reuse system prompts
   - Cache common workflows

3. **Monitor token usage**
   - Log tokens per request
   - Set usage alerts

4. **Use streaming when possible**
   - Reduces latency
   - Better user experience

## Advanced Configuration

### Multiple Agents per Server

```yaml
services:
  agent-1:
    build: ./openclaw-source
    container_name: agent-1
    env_file: .env.agent1
    
  agent-2:
    build: ./openclaw-source
    container_name: agent-2
    env_file: .env.agent2
```

### Custom Health Checks

```bash
# Report custom metrics
curl -X POST https://your-domain.com/api/agents/heartbeat \
  -H "Authorization: Bearer token" \
  -d '{
    "health": {
      "cpu": 45.2,
      "memory": 2048,
      "disk": 50000,
      "custom_metric": "value",
      "active_sessions": 3
    }
  }'
```

### Webhook Notifications

Configure OpenClaw to send webhooks on completion:

```bash
OPENCLAW_WEBHOOK_URL=https://your-webhook-endpoint.com
OPENCLAW_WEBHOOK_SECRET=your-secret
```

## Support

- **Moonshot AI Docs**: https://platform.moonshot.cn/docs
- **OpenClaw Docs**: (your openclaw docs)
- **ClawDeploy Issues**: GitHub Issues
- **Email**: marten@friendlabs.ai

---

**Last Updated**: February 11, 2026  
**ClawDeploy Version**: 3.0  
**Recommended Model**: Kimi K2.5
