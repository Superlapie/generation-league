# Generation League Deployment

Generation League ships as a static Vite frontend plus a Node WebSocket backend. Production deploys automatically from the `main` branch on GitHub.

## Production layout (current)

| Component | Platform | URL |
| --- | --- | --- |
| Frontend | Vercel | https://generation-league.vercel.app |
| Backend API | DigitalOcean App Platform (`Dockerfile`) | https://generation-league-api-euwsq.ondigitalocean.app |
| WebSocket | Same backend | `wss://generation-league-api-euwsq.ondigitalocean.app/socket` |
| Database | Postgres (Neon or managed provider) | Set via `DATABASE_URL` on the backend |

Pushing to `main` triggers autodeploy on both platforms when they are connected to this repository.

### Vercel (frontend)

Build settings:

- **Build command:** `npm run build` (or `pnpm run build`)
- **Output directory:** `dist`
- **Install command:** `npm ci` (or `pnpm install --frozen-lockfile`)

Required production environment variable:

```text
VITE_WORLD_SERVER_URL=wss://generation-league-api-euwsq.ondigitalocean.app/socket
```

Redeploy after changing this variable. Without it, the client falls back to `ws://127.0.0.1:8787/socket`.

### DigitalOcean App Platform (backend)

The repo root [`Dockerfile`](Dockerfile) runs `node server/world-server.mjs` on port `8787`.

Configure these runtime environment variables in the app spec (see [`.env.example`](.env.example)):

```text
PORT=8787
DATABASE_URL=postgresql://...
DATABASE_SSL=require
DATABASE_POOL_SIZE=5
SESSION_SECRET=<long-random-hex>
SESSION_TTL_MS=2592000000
ALLOWED_ORIGINS=https://generation-league.vercel.app
NODE_ENV=production
```

Generate a session secret:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Health check path: `/health`

When `DATABASE_URL` is empty, the server persists to local JSON (`GENERATION_LEAGUE_DATA`). That mode is for development only.

## Local production check

```powershell
Copy-Item .env.example .env
pnpm install
pnpm run check
pnpm run build
$env:DATABASE_URL = ''
$env:SESSION_SECRET = 'local-development-only-change-me'
pnpm run server
```

In another terminal, verify:

```powershell
curl http://127.0.0.1:8787/health
```

Then run `pnpm run preview` and play through guest access, title-screen auth, movement, chat, and menu account linking against the local server.

## Smoke test (production)

After a deploy:

```bash
curl https://generation-league-api-euwsq.ondigitalocean.app/health
```

In the browser:

1. Open https://generation-league.vercel.app
2. Sign in or continue as guest on the title screen
3. Enter the overworld and confirm another player appears with the correct avatar
4. Send a world chat message (single delivery)
5. Register/login, link a cloud profile, reconnect after refresh
6. Exercise friend request and trade listing flows from the Social Hub

Do not treat the world as production-ready until reconnect and trade paths pass after a backend restart.

## Updating production

**Autodeploy:** merge to `main`. Vercel and DigitalOcean rebuild from the latest commit.

**Manual backend pull** (self-hosted VM only):

```bash
cd /opt/generation-league
sudo -u generation git pull --ff-only
sudo -u generation npm ci --omit=dev
sudo systemctl restart generation-league
curl https://api.YOURDOMAIN.com/health
```

## Optional: self-hosted VM (OCI / Ubuntu)

For a single Always Free VM with Nginx TLS termination instead of App Platform, use the templates in `ops/`:

- `ops/generation-league.service` — systemd unit
- `ops/nginx-generation-league.conf` — reverse proxy to port 8787

Do not expose port 8787 publicly; terminate TLS on Nginx (ports 80/443) and proxy `/socket` upgrades.

Create `/etc/generation-league/world.env` with the same variables as the DigitalOcean section above, substituting your domain:

```text
ALLOWED_ORIGINS=https://generation-league.vercel.app
```

Point Vercel’s `VITE_WORLD_SERVER_URL` at `wss://api.YOURDOMAIN.com/socket`.

Full VM bootstrap steps (Node 22, Certbot, UFW) remain the same as earlier revisions of this document—see `ops/` and your provider’s security list for ports 22, 80, and 443.

## Networking notes

- One WebSocket per browser tab; the menu does not open a second socket
- Presence broadcasts are scoped to the same map and a 20-tile radius
- Server heartbeats run every 30s; client reconnect uses a 3s backoff guard
- Profile writes persist only on meaningful `profile:save` actions, not every reconnect

See [skills/networking-cost/SKILL.md](skills/networking-cost/SKILL.md) for the full cost checklist.
