# SSL/HTTPS Setup Summary

## What Was Configured

### ✅ Files Modified

1. **deploy/ansible/templates/nginx.conf.j2** - Updated with SSL configuration
2. **deploy/ansible/playbooks/site.yml** - Added Certbot installation and SSL setup
3. **deploy/.env** - Added SSL_EMAIL and updated WebSocket URL to wss://
4. **deploy/.env.example** - Added SSL_EMAIL variable
5. **deploy/dashboard/src/components/chat/ChatView.tsx** - Auto-detect wss:// or ws://
6. **deploy/deploy.sh** - Added SSL commands (setup-ssl, renew-ssl, check-ssl)

### ✅ New Files Created

1. **deploy/setup-ssl.sh** - Automated SSL setup script
2. **SSL_SETUP_GUIDE.md** - Complete SSL setup documentation

---

## Next Steps to Enable HTTPS

### 1. Update DNS Record (CRITICAL!)

**Current DNS Issue:**
```
beta.friendlabs.ai → 172.67.137.144, 104.21.62.172 (Cloudflare IPs)
```

**Required DNS:**
```
beta.friendlabs.ai → 157.180.37.246 (Your server IP)
```

### Create/Update A Record:

| Setting | Value |
|---------|--------|
| Type | A |
| Name | beta (or @) |
| Value | 157.180.37.246 |
| TTL | 3600 or Automatic |
| Proxy | DNS Only (grey cloud, not orange) |

### 2. Run SSL Setup

```bash
cd deploy
./deploy.sh setup-ssl
```

This will:
- ✅ Check DNS configuration
- ✅ Wait for DNS propagation
- ✅ Deploy with SSL enabled
- ✅ Obtain Let's Encrypt certificate
- ✅ Set up HTTP → HTTPS redirect
- ✅ Configure auto-renewal

### 3. Verify

```bash
# Check SSL status
./deploy.sh check-ssl

# Or visit in browser:
https://beta.friendlabs.ai
```

---

## What Will Be Configured

### SSL/TLS Features

- ✅ **HTTPS on port 443**
- ✅ **HTTP → HTTPS redirect** (port 80)
- ✅ **Let's Encrypt certificates**
- ✅ **Auto-renewal** (daily at 3 AM)
- ✅ **HTTP/2** for performance
- ✅ **Modern cipher suite** (TLS 1.2, 1.3)

### Security Headers

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`

### WebSocket Security

- Uses `wss://` (WebSocket Secure) when on HTTPS
- Auto-detects protocol (ws:// or wss://)

---

## New Commands

```bash
# Run full SSL setup (DNS check + deploy + certificate)
./deploy.sh setup-ssl

# Check SSL certificate status
./deploy.sh check-ssl

# Manually renew SSL certificate
./deploy.sh renew-ssl

# View SSL logs on server
./deploy.sh ssh
# Then: cat /var/log/letsencrypt/letsencrypt.log
```

---

## Environment Variables

Add to `.env`:

```bash
# Domain name
DOMAIN=beta.friendlabs.ai

# SSL email for expiry alerts
SSL_EMAIL=admin@friendlabs.ai

# WebSocket URL (secure)
VITE_GATEWAY_WS_URL=wss://beta.friendlabs.ai

# API URL (relative works fine)
VITE_API_URL=/api
```

---

## Quick DNS Check

Before running SSL setup, verify DNS:

```bash
# Should return your server IP
dig +short beta.friendlabs.ai

# Expected output: 157.180.37.246
```

If it returns different IPs, update your DNS first!

---

## After Setup Works

Your dashboard will be available at:

```
✅ https://beta.friendlabs.ai
✅ HTTP automatically redirects to HTTPS
✅ WebSocket uses wss:// (secure)
✅ Chat with @agent mentions works over secure connection
```

Login credentials remain the same:
- Username: `openclaw`
- Password: (from .env)

---

## Troubleshooting

### DNS Not Propagating

```bash
# Check from multiple DNS servers
dig +short beta.friendlabs.ai
dig @8.8.8.8 beta.friendlabs.ai
dig @1.1.1.1 beta.friendlabs.ai
```

### Certificate Obtention Fails

```bash
# Test port 80 accessibility
curl -I http://beta.friendlabs.ai

# Check nginx status
ssh root@157.180.37.246 "systemctl status nginx"

# Check certbot logs
ssh root@157.180.37.246 "cat /var/log/letsencrypt/letsencrypt.log"
```

### Mixed Content Warnings

Ensure WebSocket URL uses `wss://` not `ws://`:

```bash
grep VITE_GATEWAY_WS_URL .env
# Should be: wss://beta.friendlabs.ai
```

---

## Cloudflare Users

If using Cloudflare:

1. **Disable proxy** initially (set to "DNS only" - grey cloud)
2. Run SSL setup script
3. After certificate is valid, you can re-enable proxy

Or use Cloudflare Origin Certificate instead of Let's Encrypt.

---

## Certificate Details

| Property | Value |
|----------|--------|
| Issuer | Let's Encrypt |
| Type | Domain Validation (DV) |
| Validity | 90 days |
| Auto-renewal | Daily at 3 AM UTC |
| Email alerts | admin@friendlabs.ai |
| Certificate path | /etc/letsencrypt/live/beta.friendlabs.ai/ |

---

## Files Reference

| File | Purpose |
|------|---------|
| `deploy/ansible/templates/nginx.conf.j2` | Nginx SSL config |
| `deploy/ansible/playbooks/site.yml` | Deployment playbook with SSL |
| `deploy/setup-ssl.sh` | Automated SSL setup script |
| `SSL_SETUP_GUIDE.md` | Complete SSL setup documentation |
| `deploy/.env` | Environment variables with SSL_EMAIL |

---

## Summary

To enable HTTPS for `beta.friendlabs.ai`:

1. ✅ **Update DNS** - Point beta.friendlabs.ai to 157.180.37.246
2. ✅ **Run** `./deploy.sh setup-ssl`
3. ✅ **Done!** - HTTPS enabled with auto-renewal

---

**Current Status:** Ready for DNS update + SSL setup.

Once DNS is updated and SSL setup runs, your dashboard will be accessible at:
🔒 **https://beta.friendlabs.ai**

With:
- ✅ Chat with @agent mentions
- ✅ Secure WebSocket (wss://)
- ✅ Auto-renewing SSL certificate
- ✅ HTTP to HTTPS redirect
