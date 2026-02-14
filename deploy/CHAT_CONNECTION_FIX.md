# Chat Connection Error - Fix Summary

## Problem

The dashboard chat feature shows a "Connection error" message because it's trying to connect to an OpenClaw Gateway that isn't running.

## What's Been Fixed

### 1. Updated Nginx Configuration (`nginx/nginx.conf`)
- Added WebSocket proxy endpoint at `/gateway/ws` that forwards to port 18789
- Configured proper WebSocket upgrade headers and timeouts (24h)
- The dashboard can now connect via `wss://beta.friendlabs.ai/gateway/ws`

### 2. Updated Environment Variables (`.env`)
- Changed `VITE_GATEWAY_WS_URL` to point to the Nginx proxy: `wss://beta.friendlabs.ai/gateway/ws`
- Added OpenClaw gateway authentication configuration:
  - `OPENCLAW_AUTH_MODE=password`
  - `OPENCLAW_GATEWAY_PASSWORD=<generated-password>`

### 3. Enhanced Error Messages (`dashboard/src/hooks/useOpenClawChat.ts`)
- Better error messages that explain what's wrong
- Clear indication when the gateway is not running
- Connection close codes and reasons are now displayed

### 4. Added OpenClaw Gateway Service (`docker-compose.yml`)
- New `openclaw-gateway` service (optional profile)
- Runs on port 18789
- Configurable authentication (password or token)
- Health check included

### 5. New Management Commands (`deploy.sh`)
```bash
./deploy.sh gateway-start     # Start gateway
./deploy.sh gateway-stop      # Stop gateway
./deploy.sh gateway-restart   # Restart gateway
./deploy.sh gateway-logs      # View logs
./deploy.sh gateway-status    # Check status
```

### 6. Documentation (`CHAT_SETUP.md`)
- Complete guide for setting up the OpenClaw gateway
- Multiple deployment options (Docker, native, systemd)
- Troubleshooting section
- Security considerations

## Quick Fix: Start the OpenClaw Gateway

### Option 1: Using Docker Compose (Easiest)

```bash
cd deploy

# Start the gateway service
./deploy.sh gateway-start

# Check status
./deploy.sh gateway-status

# View logs
./deploy.sh gateway-logs
```

### Option 2: Using Docker Manually

```bash
docker run -d \
  --name openclaw-gateway \
  -p 127.0.0.1:18789:18789 \
  -e OPENCLAW_AUTH_MODE=password \
  -e OPENCLAW_GATEWAY_PASSWORD=8fK3mP9vR2nX5qL7wT4yZ6bC8dE1fG3h \
  openclaw/openclaw:latest gateway
```

### Option 3: Using OpenClaw CLI

```bash
# Install if needed
npm install -g @openclaw/cli

# Start gateway
OPENCLAW_AUTH_MODE=password \
OPENCLAW_GATEWAY_PASSWORD=8fK3mP9vR2nX5qL7wT4yZ6bC8dE1fG3h \
openclaw gateway
```

## Deploying the Changes

1. **Update Nginx configuration** (if on remote server):
   ```bash
   cd deploy
   ./deploy.sh nginx
   ```

2. **Rebuild dashboard** (to apply env var changes):
   ```bash
   ./deploy.sh dashboard
   ```

3. **Start the gateway**:
   ```bash
   ./deploy.sh gateway-start
   ```

4. **Restart services** (full redeploy):
   ```bash
   ./deploy.sh config
   ```

## Authentication

The gateway is configured with password authentication. To use it in the dashboard:

1. Open the dashboard at https://beta.friendlabs.ai
2. Navigate to the Chat tab
3. The connection should now work automatically (password is not entered in the UI for the dashboard)

**Note:** The dashboard uses the gateway for internal communication. The password in `.env` is used by the gateway itself, not directly by the dashboard UI.

## Verification

After starting the gateway, verify it's working:

```bash
# Check if gateway is running
curl http://localhost:18789/health

# Expected output:
# {"status":"ok",...}

# Check Nginx proxy
curl -k https://beta.friendlabs.ai/gateway/ws

# Should return: 400 Bad Request (WebSocket upgrade expected - this is normal)
```

## Testing the Chat

1. Open https://beta.friendlabs.ai in your browser
2. Click on "Chat" in the navigation
3. You should see:
   - Green "Connected" status
   - No error messages
   - Chat input field enabled

## Troubleshooting

### Still showing "Connection error"

1. **Check if gateway is running:**
   ```bash
   ./deploy.sh gateway-status
   ```

2. **Check Nginx logs:**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

3. **Check browser console:**
   - Press F12
   - Go to Console tab
   - Look for WebSocket errors

4. **Verify Nginx config was reloaded:**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### Gateway keeps restarting

Check the gateway logs:
```bash
./deploy.sh gateway-logs
```

Common issues:
- Port 18789 already in use
- Invalid authentication configuration
- Missing dependencies

### "Unauthorized" or "Authentication failed"

1. Verify password in `.env` matches
2. Check gateway logs for auth errors
3. Try restarting the gateway with new credentials

## Architecture Overview

```
User Browser
    ↓ (WSS to /gateway/ws)
Nginx (SSL termination, WebSocket proxy)
    ↓ (WS to localhost:18789)
OpenClaw Gateway (Port 18789)
    ↓ (Internal)
Agents & LLM
```

## Files Changed

1. `nginx/nginx.conf` - Added `/gateway/ws` WebSocket proxy
2. `.env` - Updated `VITE_GATEWAY_WS_URL`, added gateway config
3. `.env.example` - Updated with gateway configuration variables
4. `docker-compose.yml` - Added `openclaw-gateway` service
5. `deploy.sh` - Added gateway management commands
6. `dashboard/src/hooks/useOpenClawChat.ts` - Improved error messages
7. `CHAT_SETUP.md` - New comprehensive setup guide (NEW)
8. `CHAT_CONNECTION_FIX.md` - This file (NEW)

## Next Steps

1. Deploy the Nginx configuration: `./deploy.sh nginx`
2. Start the gateway: `./deploy.sh gateway-start`
3. Test the chat feature in the dashboard
4. Review `CHAT_SETUP.md` for production deployment options

## Support

- OpenClaw Documentation: https://docs.openclaw.ai
- For issues with this setup, check the troubleshooting section in `CHAT_SETUP.md`
