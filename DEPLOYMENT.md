# Generation League Backend Deployment

This project uses a Node WebSocket server and a Postgres-backed state snapshot.
The server uses local JSON only when `DATABASE_URL` is empty, which is suitable
for local development but not for a hosted world.

## Recommended zero-cost layout

- Frontend: Vercel
- Backend: one OCI Always Free Ubuntu VM
- Database: Neon Free Postgres
- TLS and WebSocket proxy: Nginx plus Certbot

## Local production check

```powershell
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run check
npm.cmd run build
$env:DATABASE_URL = ''
$env:SESSION_SECRET = 'local-development-only-change-me'
npm.cmd run server
```

Check `http://127.0.0.1:8787/health` in another terminal.

## OCI VM setup

Create an Ubuntu VM in the OCI home region using only Always Free resources.
Allow TCP 22, 80, and 443 in the OCI security list. Do not expose 8787.

```bash
sudo apt update
sudo apt install -y git curl nginx certbot python3-certbot-nginx ufw
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo adduser --system --group --home /opt/generation-league generation
sudo mkdir -p /opt/generation-league
sudo chown -R generation:generation /opt/generation-league
sudo -u generation git clone YOUR_REPOSITORY_URL /opt/generation-league
cd /opt/generation-league
sudo -u generation npm ci --omit=dev
```

Create `/etc/generation-league/world.env`:

```text
PORT=8787
DATABASE_URL=YOUR_NEON_CONNECTION_STRING
DATABASE_SSL=require
DATABASE_POOL_SIZE=5
SESSION_SECRET=GENERATE_A_LONG_RANDOM_SECRET
SESSION_TTL_MS=2592000000
ALLOWED_ORIGINS=https://YOUR_VERCEL_DOMAIN
NODE_ENV=production
```

Create the directory and file before starting systemd:

```bash
sudo install -d -o root -g root -m 0750 /etc/generation-league
sudo nano /etc/generation-league/world.env
```

Generate the session secret on the VM with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Install the service and proxy templates from `ops/`:

```bash
sudo install -o root -g root -m 0644 ops/generation-league.service /etc/systemd/system/generation-league.service
sudo install -o root -g root -m 0644 ops/nginx-generation-league.conf /etc/nginx/sites-available/generation-league
sudo sed -i 's/api.example.com/api.YOURDOMAIN.com/g' /etc/nginx/sites-available/generation-league
sudo ln -s /etc/nginx/sites-available/generation-league /etc/nginx/sites-enabled/generation-league
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now generation-league
sudo systemctl restart nginx
sudo certbot --nginx -d api.YOURDOMAIN.com
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## Vercel

Set this production environment variable in the Vercel project:

```text
VITE_WORLD_SERVER_URL=wss://api.YOURDOMAIN.com/socket
```

Redeploy after saving the variable. The frontend falls back to the local
8787 endpoint only when this variable is absent.

## Smoke test

```bash
curl https://api.YOURDOMAIN.com/health
sudo journalctl -u generation-league -f
```

Then test guest access, account registration, login after a service restart,
cloud save, reconnect, chat, friend requests, and a trade. Do not announce the
world as production-ready until the restart and trade tests pass.

## Updating the server

```bash
cd /opt/generation-league
sudo -u generation git pull --ff-only
sudo -u generation npm ci --omit=dev
sudo systemctl restart generation-league
curl https://api.YOURDOMAIN.com/health
```
