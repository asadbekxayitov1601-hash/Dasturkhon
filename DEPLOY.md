# Deploying Dasturkhon to a Hetzner VPS

This hosts **both** the frontend (static `dist/`) and the backend (Node API) on one
Ubuntu server behind **Caddy** (automatic HTTPS). The database stays on Neon Postgres,
email goes through Brevo. One box = one domain, a static IP for Uzum, and no CORS.

```
Browser ──HTTPS──> Caddy ──/api/*──> Node API (localhost:4000) ──> Neon Postgres
                     └────/* ───────> static frontend (dist/)
```

---

## 0. Before you start
- A **Hetzner Cloud** server (CX22 or similar, **Ubuntu 24.04**).
- Your domain (`dasturkhon.uz`) with a DNS **A record** pointing to the server's IP
  (and `www` too). Wait for DNS to propagate before step 6.
- Your Neon `DATABASE_URL` / `DIRECT_URL`, a `JWT_SECRET`, and your `BREVO_API_KEY`.

## 1. Create the server & log in
Create the server in Hetzner Cloud (add your SSH key). Then:
```bash
ssh root@YOUR_SERVER_IP
```

## 2. Install dependencies (Node 20, git, Caddy)
```bash
apt update && apt upgrade -y
# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git
# Caddy (auto HTTPS)
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
node -v   # confirm v20.x
```

## 3. Create an app user & clone the repo
```bash
adduser --system --group --home /opt/dasturkhon dasturkhon
cd /opt
git clone https://github.com/asadbekxayitov1601-hash/Dasturkhon.git dasturkhon
chown -R dasturkhon:dasturkhon /opt/dasturkhon
```

## 4. Configure environment
```bash
cp /opt/dasturkhon/server/.env.example /opt/dasturkhon/server/.env
nano /opt/dasturkhon/server/.env      # fill in DATABASE_URL, DIRECT_URL, JWT_SECRET,
                                      # BREVO_API_KEY, MAIL_FROM, APP_URL, FRONTEND_URL,
                                      # GOOGLE_CLIENT_ID (optional)
```
If you use **Google sign-in**, the frontend also needs its client ID at build time.
Create a root `.env` for the build:
```bash
echo 'VITE_GOOGLE_CLIENT_ID=YOUR_ID.apps.googleusercontent.com' > /opt/dasturkhon/.env
```
(Leave it out to ship without the Google button. `VITE_API_URL` is not needed —
the app talks to the same origin in production.)

## 5. First build + database push
```bash
cd /opt/dasturkhon
chmod +x deploy/deploy.sh
sudo -u dasturkhon bash -c 'cd /opt/dasturkhon && ./deploy/deploy.sh' || true
# The first run may fail at "restart service" because the service isn't installed yet —
# that's fine, continue to step 6. (Build + db push still ran.)
```

## 6. Install the API service & Caddy config
```bash
# systemd service for the Node API
cp /opt/dasturkhon/deploy/dasturkhon-api.service /etc/systemd/system/
# Confirm the node path matches `which node`; edit ExecStart if not /usr/bin/node
systemctl daemon-reload
systemctl enable --now dasturkhon-api
systemctl status dasturkhon-api --no-pager     # should be active (running)

# Caddy: serve frontend + proxy /api  (edit the domain if different)
cp /opt/dasturkhon/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
```

## 7. Verify
- Open **https://dasturkhon.uz** — the site should load over HTTPS.
- `curl https://dasturkhon.uz/api/health` → `{"status":"ok",...}`.
- Test signup → email code arrives (Brevo), login → 2FA code, create a recipe.

## 8. Create your admin account
```bash
cd /opt/dasturkhon/server && node scripts/create-admin.js   # follow the prompts
```

---

## Updating later (every change)
```bash
sudo -u dasturkhon bash -c 'cd /opt/dasturkhon && ./deploy/deploy.sh'
```
That pulls `main`, installs, runs `prisma db push`, rebuilds the frontend, and
restarts the API.

## Operations
- **API logs:** `journalctl -u dasturkhon-api -f` (and `server/logs/error.log`).
- **Restart API:** `systemctl restart dasturkhon-api`.
- **Caddy logs:** `journalctl -u caddy -f`.
- **Firewall (optional):** `ufw allow OpenSSH && ufw allow 80,443/tcp && ufw enable`.
- **Backups:** Neon handles DB backups. Move recipe/avatar images to Cloudflare R2
  before traffic grows (base64-in-DB won't scale).

## Notes
- The prod build uses `schema.prod.prisma` (Postgres) via the `--schema` flag, so the
  tracked `schema.prisma` (SQLite, for local dev) is never modified on the server.
- This setup gives a **static IP** — required when you whitelist for Uzbek Bank later.
- You can keep the frontend on Vercel instead and only host the API here; if so, point
  the frontend at this server and set `FRONTEND_URL` to the Vercel domain. The all-in-one
  setup above is simpler for a single founder.
