# Deployment

Production runs on one AWS Lightsail instance, with CloudFront in front.

| Piece | What | Cost |
|---|---|---|
| Lightsail `owc-prod` (`micro_3_0`: 1 GB RAM, 2 vCPU, 40 GB, us-east-1a) | Game server (`owc-server`) and bots (`owc-bots`), both systemd units; Node 22; 1 GB swap | $7/mo |
| Static IP `owc-ip`: 98.88.175.192 | Attached to the instance | free while attached |
| CloudFront `E3LWTLW0LK3EW` (`d3km191wml4umh.cloudfront.net`) | HTTPS, WebSockets on `/play`, edge-cached `/assets/*`; PriceClass_100 | pennies at this scale |
| Route 53 zone `openworldchess.com` (`Z02400531304F8SIG268B`) | Apex and www point at CloudFront | $0.50/mo |
| ACM certificate (us-east-1) | openworldchess.com + www | free |

**The origin only answers CloudFront.** CloudFront adds an `X-Origin-Verify` header, and the server rejects anything without it (except localhost, which the bots use). The secret lives in `/etc/owc/env` on the box and in the distribution's origin config.

## Deploy a new version

```bash
deploy/deploy.sh          # build client, rsync, pnpm install --prod, restart services
```

To inspect the box:

```bash
ssh -i ~/.ssh/owc_lightsail ubuntu@98.88.175.192
journalctl -u owc-server -f   # logs
journalctl -u owc-bots -f
```

World data lives in `/var/lib/owc/world.json` (saved every 15s and on shutdown). Bot identities are in `/var/lib/owc/bots.json`.

## First-time domain hookup

1. In GoDaddy, set the nameservers for openworldchess.com to the four Route 53 nameservers (see below).
2. Wait for the ACM certificate to show `ISSUED` (minutes to a few hours after the nameserver change).
3. Run `deploy/attach-domain.sh`.

Route 53 nameservers:

```
ns-873.awsdns-45.net
ns-289.awsdns-36.com
ns-1827.awsdns-36.co.uk
ns-1218.awsdns-24.org
```

## Google sign-in

1. Go to https://console.cloud.google.com/, then **APIs & Services → OAuth consent screen**.
   - User type: External. App name: Open World Chess. Add your support email.
   - Scopes: `openid`, `email`, `profile` (no sensitive scopes, so no verification is needed).
   - Publish the app (from Testing to In production) so anyone can sign in.
2. Go to **Credentials → Create credentials → OAuth client ID**.
   - Type: **Web application**.
   - Authorized JavaScript origins: `https://openworldchess.com`
   - Authorized redirect URIs: `https://openworldchess.com/auth/google/callback`
     - For local testing, also add: `http://localhost:8787/auth/google/callback`
3. Put the client ID and secret on the server:

   ```bash
   ssh -i ~/.ssh/owc_lightsail ubuntu@98.88.175.192
   sudo nano /etc/owc/env
   # add these lines (keep the existing ORIGIN_SECRET line):
   GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
   sudo systemctl restart owc-server
   ```

   `PUBLIC_URL=https://openworldchess.com` is already set in the systemd unit. The "Sign in with Google" button appears automatically once `/auth/config` reports it's configured.

For local development, run `GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… PUBLIC_URL=http://localhost:8787 node apps/server/src/main.ts` and open http://localhost:8787 (the built client).

## Tuning (in `/etc/owc/env`, then restart)

| Variable | Default | Meaning |
|---|---|---|
| `GUEST_GRACE_MS` | 900000 | How long after a guest leaves until their empire falls |
| `SPEED` | 1 | Economy speed |
| `SHIELD_MS` | 2 h | New-player shield |

The bot count is `BOTS` in `/etc/owc/bots.env` (default 12).
