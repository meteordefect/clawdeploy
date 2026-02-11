# Chat Interface - Ready to Deploy

## What Was Built

A **direct WebSocket connection** from the dashboard to OpenClaw Gateway. No database, no middleware - just pure OpenClaw features.

### Architecture

```
Dashboard (WebSocket) ─→ OpenClaw Gateway :18789
```

That's it! OpenClaw handles everything internally:
- ✅ Sessions and context
- ✅ Agent routing
- ✅ Memory and learning
- ✅ Tool execution
- ✅ All AI features

## Files Created/Modified

### New Files
- `dashboard/src/hooks/useOpenClawChat.ts` - WebSocket hook for OpenClaw protocol
- `dashboard/src/components/chat/ChatView.tsx` - Chat UI component

### Updated Files
- `docker-compose.yml` - Simplified (removed PostgreSQL/API/Watcher)
- `dashboard/src/App.tsx` - Integrated ChatView
- `.env` - No database config needed
- `.env.example` - Simplified
- `nginx/nginx.conf` - Reverted to simple routing
- `nginx/nginx-nossl.conf` - Reverted to simple routing
- `dashboard/vite.config.ts` - Simplified proxy

## Features

### Direct OpenClaw Connection
- WebSocket connection to gateway (port 18789)
- Uses OpenClaw's native `chat.send` RPC protocol
- Receives real-time responses via `chat` events
- Connection status indicator (connecting/connected/disconnected)

### Clean UI
- User messages (right, blue)
- Assistant messages (left, with "OpenClaw" badge)
- Auto-scroll to latest message
- Timestamps on all messages
- Disabled input until connected

## Environment Configuration

Only need these in `.env`:

```bash
# Gateway configuration
OPENCLAW_GATEWAY_TOKEN=4ec554754c2e4cfb94f441923ce79c337ae15ddbda3fd62ea41d04ef5524abc7
OPENCLAW_GATEWAY_PORT=18789

# LLM credentials (already configured)
ZHIPU_API_KEY=...
ZAI_API_KEY=...
OPENCLAW_MODEL=zai/glm-4.7
BRAVE_API_KEY=...
```

## Deployment

### Local Test

```bash
cd deploy

# Start services
docker compose up -d

# Watch logs
docker compose logs -f

# Access dashboard
open http://localhost:3000
```

### Production Deployment

```bash
cd deploy

# Deploy dashboard with new chat feature
./deploy.sh dashboard

# Or full deployment
./deploy.sh full
```

## How It Works

1. **Dashboard loads** → Creates WebSocket connection to `ws://localhost:18789`
2. **WebSocket connects** → Sends `connect` RPC with auth token
3. **Gateway responds** → Connection ready, shows "Connected" status
4. **User sends message** → Calls `chat.send` RPC method
5. **OpenClaw processes** → Uses configured model (GLM-4.7)
6. **Gateway sends response** → Via `chat` event with `state: 'final'`
7. **Dashboard displays** → Shows message in chat UI

## OpenClaw Protocol

The chat uses OpenClaw's native WebSocket protocol:

### Connect
```json
{
  "type": "req",
  "id": "connect-123",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": { "id": "clawdeploy-dashboard", ... },
    "auth": { "token": "..." }
  }
}
```

### Send Message
```json
{
  "type": "req",
  "id": "rpc-1",
  "method": "chat.send",
  "params": {
    "sessionKey": "dashboard-session",
    "message": "Hello OpenClaw!",
    "idempotencyKey": "user-123",
    "timeoutMs": 0
  }
}
```

### Receive Response
```json
{
  "type": "event",
  "event": "chat",
  "payload": {
    "state": "final",
    "message": {
      "role": "assistant",
      "content": [{ "type": "text", "text": "Hello! How can I help?" }],
      "timestamp": 1707692400000
    },
    "sessionKey": "dashboard-session",
    "seq": 2
  }
}
```

## Services Running

After deployment:

| Service | Port | Description |
|---------|------|-------------|
| Dashboard | 3000 | React UI with chat |
| File API | 3001 | File browsing/editing |
| OpenClaw Gateway | 18789 | AI agent system |
| OpenClaw Bridge | 18790 | Native bridge |

## Testing

1. **Open dashboard**: http://localhost:3000
2. **Click "Chat"** in navigation
3. **Watch connection status**: Should show "Connected" with green icon
4. **Send a message**: "Hello, what can you do?"
5. **See response**: OpenClaw responds using GLM-4.7 model

## Troubleshooting

### "Disconnected" status

```bash
# Check gateway is running
docker compose ps openclaw-gateway

# Check gateway logs
docker compose logs openclaw-gateway

# Verify token is set
grep OPENCLAW_GATEWAY_TOKEN deploy/.env
```

### WebSocket connection fails

Check browser console for errors. The WebSocket URL should be:
- Local: `ws://localhost:18789`
- Production: `wss://beta.friendlabs.ai/gateway` (if nginx configured)

### No response from OpenClaw

```bash
# Check LLM credentials are set
docker compose logs openclaw-gateway | grep -i "api key"

# Verify model is configured
docker compose logs openclaw-gateway | grep -i "model"
```

## Next Steps

1. **Deploy and test** - Make sure chat works end-to-end
2. **Add session history** - Store messages in browser localStorage
3. **Add typing indicators** - Show when OpenClaw is thinking
4. **Add tool usage display** - Show when OpenClaw uses tools
5. **Add markdown rendering** - For formatted responses

---

**Status**: ✅ Ready to deploy
**Last Updated**: February 11, 2026
