# SSL/HTTPS Setup Guide for beta.friendlabs.ai

## Quick Start

```bash
cd deploy
./deploy.sh setup-ssl
```

This will:
1. Check DNS configuration
2. Update DNS if needed
3. Wait for DNS propagation
4. Deploy with SSL/HTTPS enabled
5. Set up automatic SSL renewal

---

## Manual Steps

### Step 1: Update DNS Records

**Important:** The DNS for `beta.friendlabs.ai` currently points to Cloudflare IPs, not your server.

You need to create/update an **A record**:

```
Type:     A
Name:     beta (or @)
Value:    157.180.37.246
TTL:      3600 (or auto)
Proxy:    Off (DNS only, not proxied)
```

#### DNS Provider Instructions

**Cloudflare:**
1. Go to DNS > Records
2. Create new record
3. Type: `A`, Name: `beta`, Content: `157.180.37.246`
4. **Important:** Set "Proxy status" to "DNS only" (grey cloud, not orange)
5. Click Save

**Namecheap:**
1. Go to Domain List > Manage > Advanced DNS
2. Click "Add New Record"
3. Type: `A Record`, Host: `beta`, Value: `157.180.37.246`
4. TTL: `Automatic`
5. Click Save All Changes

**GoDaddy:**
1. Go to DNS Management
2. Click "Add"
3. Type: `A`, Name: `beta`, Value: `157.180.37.246`
4. TTL: `1 Hour`
5. Click Save

**AWS Route53:**
1. Go to Hosted Zones
2. Click "Create Record Set"
3. Name: `beta`, Type: `A - IPv4 address`
4. Value: `157.180.37.246`
5. Click Create

### Step 2: Wait for DNS Propagation

DNS changes can take from a few minutes to 48 hours. To check:

```bash
# Check if DNS points to your server
dig +short beta.friendlabs.ai

# Should return: 157.180.37.246
```

### Step 3: Run SSL Setup

```bash
cd deploy
./deploy.sh setup-ssl
```

This will:
- Verify DNS is correct
- Update nginx configuration for HTTPS
- Obtain SSL certificate from Let's Encrypt
- Set up automatic renewal
- Redirect HTTP to HTTPS

### Step 4: Verify SSL

```bash
# Check SSL status
./deploy.sh check-ssl

# Or visit in browser:
# https://beta.friendlabs.ai
```

---

## What Gets Configured

### Nginx Configuration

- **HTTP → HTTPS redirect** (port 80 → 443)
- **SSL/TLS enabled** on port 443
- **Let's Encrypt certificates** auto-obtained
- **Modern cipher suite** (TLS 1.2, 1.3)
- **Security headers** (HSTS, X-Frame-Options, etc.)

### SSL Certificate

- **Issuer:** Let's Encrypt
- **Type:** DV (Domain Validation)
- **Validity:** 90 days
- **Auto-renewal:** Daily at 3 AM via cron
- **Email:** `admin@friendlabs.ai` (for expiry alerts)

### Certificate Path

```
/etc/letsencrypt/live/beta.friendlabs.ai/
├── fullchain.pem    # Certificate + chain
├── privkey.pem      # Private key
└── README           # Let's Encrypt info
```

---

## Troubleshooting

### DNS Not Propagating

If DNS still points to old IP:

```bash
# Check from your machine
dig beta.friendlabs.ai

# Check from different DNS servers
dig @8.8.8.8 beta.friendlabs.ai      # Google DNS
dig @1.1.1.1 beta.friendlabs.ai      # Cloudflare DNS

# Force flush local DNS cache
sudo systemd-resolve --flush-caches  # Ubuntu
sudo dscacheutil -flushcache        # macOS
ipconfig /flushdns                 # Windows
```

### Certificate Obtention Failed

If Certbot can't get a certificate:

```bash
# Test that port 80 is accessible from outside
curl -I http://beta.friendlabs.ai

# Check nginx is running on server
ssh root@157.180.37.246 "systemctl status nginx"

# Check certbot logs
ssh root@157.180.37.246 "cat /var/log/letsencrypt/letsencrypt.log"
```

### Mixed Content Errors

If browser shows "Mixed Content" warning:

```bash
# Make sure all URLs use https:// in your .env
grep -i http .env

# Should show:
VITE_API_URL=/api  (relative path is fine)
VITE_GATEWAY_WS_URL=wss://beta.friendlabs.ai  (not ws://)
```

### Certificate Expiry Warning

To check certificate expiry:

```bash
# From server
ssh root@157.180.37.246
certbot certificates

# Should show expiry date and auto-renewal status
```

To manually renew:

```bash
cd deploy
./deploy.sh renew-ssl
```

---

## Environment Variables

Add these to your `.env` file:

```bash
# Domain name
DOMAIN=beta.friendlabs.ai

# Email for Let's Encrypt (for expiry alerts)
SSL_EMAIL=admin@friendlabs.ai

# WebSocket URL with wss:// (secure)
VITE_GATEWAY_WS_URL=wss://beta.friendlabs.ai

# API URL (relative is fine when on same domain)
VITE_API_URL=/api
```

---

## Testing HTTPS

### Command Line Tests

```bash
# Test HTTPS connection
curl -I https://beta.friendlabs.ai

# Should show:
# HTTP/2 200
# server: nginx
# strict-transport-security: max-age=31536000

# Test SSL certificate
openssl s_client -connect beta.friendlabs.ai:443 -servername beta.friendlabs.ai

# Check certificate details
echo | openssl s_client -showcerts -servername beta.friendlabs.ai \
  -connect beta.friendlabs.ai:443 2>/dev/null | \
  openssl x509 -noout -dates -issuer
```

### Browser Tests

1. Visit `https://beta.friendlabs.ai`
2. Check for 🔒 lock icon
3. Click the lock → "Connection is secure"
4. Verify certificate is for `beta.friendlabs.ai`
5. Check certificate issuer is "Let's Encrypt"

---

## Security Features Enabled

- ✅ **HTTP/2** - Faster page loads
- ✅ **TLS 1.2 & 1.3** - Modern protocols
- ✅ **HSTS** - Strict Transport Security header
- ✅ **X-Frame-Options** - Clickjacking protection
- ✅ **X-Content-Type-Options** - MIME sniffing protection
- ✅ **X-XSS-Protection** - XSS filter
- ✅ **Auto-renewal** - Daily cron job
- ✅ **Email alerts** - Certificate expiry warnings

---

## Manual SSL Setup (If Script Fails)

If the `setup-ssl.sh` script doesn't work for some reason, you can do it manually:

```bash
# SSH to server
ssh root@157.180.37.246

# Stop nginx temporarily (to free port 80)
systemctl stop nginx

# Obtain certificate
certbot certonly --standalone \
  --email admin@friendlabs.ai \
  --agree-tos \
  --non-interactive \
  -d beta.friendlabs.ai

# Start nginx again
systemctl start nginx

# Set up auto-renewal
crontab -e
# Add: 0 3 * * * certbot renew --quiet && systemctl reload nginx
```

---

## Cloudflare Specific Notes

If using Cloudflare proxy (orange cloud):

1. **Disable proxy** for the beta subdomain
2. Set "Proxy status" to **DNS only** (grey cloud)
3. This allows Let's Encrypt to validate your domain
4. After SSL is set up, you can re-enable the proxy

Or, use Cloudflare's **Origin Certificate** instead of Let's Encrypt:
- Edge Certificates > Origin Server > Create
- Install certificate on your server
- Then you can use Cloudflare proxy

---

## After Setup

Once SSL is working:

```bash
# Your dashboard is available at:
https://beta.friendlabs.ai

# Login:
Username: openclaw
Password: [from .env]

# WebSocket connection will use:
wss://beta.friendlabs.ai
```

All HTTP requests will automatically redirect to HTTPS!

---

## Need Help?

Common issues:

1. **DNS not updated** - Wait longer or check with your DNS provider
2. **Port 80 blocked** - Check firewall rules on server
3. **Certificate fails** - Make sure DNS is correct first
4. **Mixed content** - Update .env to use wss:// not ws://

---

## Quick Reference

```bash
# Run full SSL setup
./deploy.sh setup-ssl

# Check SSL status
./deploy.sh check-ssl

# Renew SSL certificate manually
./deploy.sh renew-ssl

# View nginx logs on server
./deploy.sh ssh  # then: tail -f /var/log/nginx/clawdeploy-error.log

# View certbot logs
./deploy.sh ssh  # then: cat /var/log/letsencrypt/letsencrypt.log

# Test certificate from outside
openssl s_client -connect beta.friendlabs.ai:443 -showcerts
```

---

**Done! Your ClawDeploy should now be accessible at https://beta.friendlabs.ai** 🎉
