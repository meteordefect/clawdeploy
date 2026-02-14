# Chat Feature Setup Guide

The ClawDeploy dashboard includes a chat feature that connects to an OpenClaw Gateway for direct communication with agents.

## Current Status

The chat interface is implemented but **requires a running OpenClaw Gateway** to function. Without the gateway, you'll see a "Connection error" message.

## Requirements

1. **OpenClaw Gateway** running on port 18789 (default)
2. **Nginx WebSocket proxy** configured (already included in nginx.conf)
3. **Gateway token** (optional, for authentication)

## Quick Start: Run OpenClaw Gateway Locally

If you want to test the chat feature, you can run an OpenClaw gateway locally:

### Option 1: Using Docker (Recommended)

```bash
# Run OpenClaw gateway in Docker
docker run -d \
  --name openclaw-gateway \
  -p 18789:18789 \
  -e OPENCLAW_AUTH_MODE=password \
  -e OPENCLAW_PASSWORD=your-password \
  openclaw/openclaw:latest gateway
```

### Option 2: Using OpenClaw Source

If you have the OpenClaw source code (in `../openclaw-source/`):

```bash
cd ../openclaw-source

# Build and run the gateway
pnpm build
pnpm start:gateway

# Or with specific configuration
OPENCLAW_AUTH_MODE=password OPENCLAW_PASSWORD=your-password pnpm start:gateway
```

### Option 3: Using OpenClaw CLI (if installed)

```bash
# Install OpenClaw (if not already installed)
npm install -g @openclaw/cli

# Start the gateway
openclaw gateway

# Or with authentication
OPENCLAW_AUTH_MODE=password OPENCLAW_PASSWORD=your-password openclaw gateway
```

## Configuration

### Environment Variables

Update `.env` with the correct WebSocket URL:

```bash
# For local development (HTTP)
VITE_GATEWAY_WS_URL=ws://localhost:18789

# For production with SSL (HTTPS)
VITE_GATEWAY_WS_URL=wss://beta.friendlabs.ai/gateway/ws

# Optional: Gateway token for authentication
VITE_GATEWAY_TOKEN=your-gateway-token
```

### Nginx Configuration

The Nginx configuration (`./nginx/nginx.conf`) already includes a WebSocket proxy at `/gateway/ws` that forwards to the OpenClaw gateway on port 18789.

If you need to update the port, modify the nginx config:

```nginx
location /gateway/ws {
    proxy_pass http://127.0.0.1:18789/;  # Change port if needed
    # ... rest of WebSocket config
}
```

### Generate a Gateway Token

If you want to use token-based authentication:

```bash
# Generate a random token
openssl rand -hex 32

# Or use OpenClaw CLI
openclaw doctor --generate-gateway-token
```

Then set it in your `.env`:

```bash
VITE_GATEWAY_TOKEN=your-generated-token-here
```

## Deploying OpenClaw Gateway as a Service

For production, you should run the OpenClaw gateway as a persistent service. Here's how:

### Using Docker Compose (Recommended)

Add this to your `docker-compose.yml`:

```yaml
services:
  # ... existing services ...

  openclaw-gateway:
    image: openclaw/openclaw:latest
    container_name: openclaw-gateway
    restart: unless-stopped
    command: gateway
    ports:
      - "127.0.0.1:18789:18789"
    environment:
      OPENCLAW_AUTH_MODE: ${OPENCLAW_AUTH_MODE:-password}
      OPENCLAW_PASSWORD: ${OPENCLAW_GATEWAY_PASSWORD:-}
      OPENCLAW_TOKEN: ${OPENCLAW_GATEWAY_TOKEN:-}
      OPENCLAW_CONTROL_UI_BASE_PATH: /dashboard
    volumes:
      - openclaw-data:/openclaw-data
    networks:
      - clawdeploy

# ... rest of config ...

volumes:
  # ... existing volumes ...
  openclaw-data:
    driver: local
```

Update `.env`:

```bash
# OpenClaw Gateway Configuration
OPENCLAW_AUTH_MODE=password
OPENCLAW_GATEWAY_PASSWORD=your-secure-password
# OR for token auth:
# OPENCLAW_AUTH_MODE=token
# OPENCLAW_GATEWAY_TOKEN=your-generated-token
```

Deploy:

```bash
./deploy.sh config  # Update configuration
```

### Using systemd (Native Installation)

Create `/etc/systemd/system/openclaw-gateway.service`:

```ini
[Unit]
Description=OpenClaw Gateway
After=network.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/opt/openclaw
Environment="OPENCLAW_AUTH_MODE=password"
Environment="OPENCLAW_PASSWORD=your-password"
ExecStart=/usr/bin/openclaw gateway
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable openclaw-gateway
sudo systemctl start openclaw-gateway
sudo systemctl status openclaw-gateway
```

## Testing the Connection

After setting up the gateway, verify it's running:

```bash
# Check if port 18789 is listening
netstat -tlnp | grep 18789
# OR
ss -tlnp | grep 18789

# Test HTTP endpoint
curl http://localhost:18789/health

# Test WebSocket connection (requires wscat)
npm install -g wscat
wscat -c ws://localhost:18789
```

## Troubleshooting

### "Connection error" in chat UI

1. **Check if gateway is running:**
   ```bash
   curl http://localhost:18789/health
   ```

2. **Check Nginx proxy is configured:**
   - Verify nginx config has `/gateway/ws` location
   - Reload nginx: `sudo systemctl reload nginx`

3. **Check WebSocket URL in browser console:**
   - Open browser dev tools (F12)
   - Look for WebSocket connection errors in Console tab
   - Verify it's connecting to the correct URL

4. **Check firewall:**
   ```bash
   # Allow local connections (should be default)
   sudo ufw allow from 127.0.0.1 to any port 18789
   ```

### "Connection refused"

The gateway is not running. Start it using one of the methods above.

### "Authentication failed"

Check your auth configuration:
- If using password: Verify `OPENCLAW_PASSWORD` matches what you enter in the UI
- If using token: Verify `VITE_GATEWAY_TOKEN` matches `OPENCLAW_GATEWAY_TOKEN`

### WebSocket disconnects frequently

1. Check Nginx timeout settings (configured to 24h)
2. Check if the gateway is crashing (check logs)
3. Check network stability

## Architecture

```
Dashboard (Browser)
    ↓ (WSS to /gateway/ws)
Nginx (Proxy)
    ↓ (WS to localhost:18789)
OpenClaw Gateway (Port 18789)
    ↓ (Internal)
Agents & LLM
```

## Security Considerations

1. **Don't expose gateway port directly** - Always use Nginx as a proxy
2. **Use authentication** - Either password or token auth is recommended
3. **HTTPS required for production** - Use `wss://` not `ws://`
4. **Rate limiting** - Nginx already has rate limiting configured
5. **Token rotation** - Rotate gateway tokens periodically

## Next Steps

1. Choose a deployment method (Docker Compose recommended)
2. Configure authentication (password or token)
3. Deploy the gateway service
4. Test the connection
5. Verify chat functionality in the dashboard

## Additional Resources

- OpenClaw Documentation: https://docs.openclaw.ai
- OpenClaw GitHub: https://github.com/openclaw/openclaw
- WebSocket Debugging: Use Chrome DevTools > Network > WS tab
