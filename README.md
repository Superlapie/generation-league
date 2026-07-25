# Generation League

An original GBA-style monster-catching RPG built with **Phaser 4**, **TypeScript**, and **Vite**. The campaign runs offline-first in the browser, with optional online shared worlds for presence, chat, accounts, cloud saves, friends, and trades.

**Play:** https://generation-league.vercel.app

**Repository:** https://github.com/Superlapie/generation-league

## Current game state

Generation League v2 is a playable regional adventure with:

- **Single-player campaign** across Mossmere Village, Verdant Path, Glimmerwood, Reedwater Crossing, Cinderstep Town, Ashfall Grotto, Ember Ridge, Tideglass City, furnished interiors, and the League Spire
- **Three Crests** (Glimmer, Cinder, Tide) from Warden battles, then post-ending free roam with rematches
- **Turn-based battles** (single and double), capture Pods, evolution, held items, party/box management, and a regional Field Guide
- **Online shared worlds** on three population shards (`mossmere`, `cinderstep`, `tideglass`) with scoped presence, world chat, player inspection, friend requests, and trade listings
- **Accounts and cloud profiles** — sign in or register on the title screen before entering the world, or continue as a guest with local-only progress
- **Local save resilience** — one manual save, its previous backup, and three rotating recovery autosaves in `localStorage`

Rendering uses a fixed **240×160** internal resolution (2× camera zoom), nearest-neighbor scaling, and keyboard or touch controls.

## Quick start

```powershell
pnpm install
copy .env.example .env
```

Run the client and world server in separate terminals:

```powershell
pnpm run dev
pnpm run server
```

Open http://127.0.0.1:4173/. The client connects to `ws://127.0.0.1:8787/socket` when `VITE_WORLD_SERVER_URL` is unset.

Verify before pushing:

```powershell
pnpm run check
pnpm run build
```

`npm` works with the same scripts if you prefer it.

## Controls

| Input | Action |
| --- | --- |
| Arrow keys / WASD | Move / navigate menus |
| Enter, Z, or Space | Confirm / interact |
| X or Escape | Back / cancel |
| Shift | Run |
| M | Field menu |
| Touch UI | On-screen D-pad, A, B, and Menu |

## Player flow

```
Boot → Title → [sign in / register / continue as guest] → Intro (new game) or Overworld (continue)
```

From the overworld, **M** opens the field menu (party, bag, guide, player card, online worlds, social hub, account, save, options). Online features reuse one WebSocket per browser tab via the shared `liveNetwork` client.

## Multiplayer

| Feature | Behavior |
| --- | --- |
| **Auth gate** | Guests choose sign-in, register, or continue as guest on the title screen before starting |
| **World shards** | Three shared shards; switch from **Online Worlds** in the field menu |
| **Presence** | Players on the same map within a **20-tile radius** see each other, with correct avatar sprites (`a` female / `b` male) |
| **Chat** | World and local channels; rate-limited server-side |
| **Cloud save** | Linked accounts can upload/download a cloud profile from **Account** |
| **Social** | Inspect nearby players, send friend requests, browse trade listings |

Production API (WebSocket): `wss://generation-league-api-euwsq.ondigitalocean.app/socket`

## Project layout

```
src/           Phaser client (scenes, battle rules, UI, networking)
server/        Node WebSocket world server (presence, auth, profiles, chat, trades)
public/assets/ Sprites, tiles, audio
ops/           Systemd and Nginx templates for self-hosted VMs
skills/        Agent skills for networking, security, and art direction
```

Key client modules:

- `src/liveNetwork.ts` — singleton WebSocket session and reconnect backoff
- `src/presence.ts` — client-side visibility radius helpers
- `src/authOverlay.ts` — shared title/menu account UI
- `src/display.ts` — GBA camera, character scale, remote nameplates

## Environment variables

Copy [`.env.example`](.env.example). Important values:

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_WORLD_SERVER_URL` | Frontend build | Production WebSocket URL (`wss://…/socket`) |
| `PORT` | Backend | HTTP/WebSocket listen port (default `8787`) |
| `DATABASE_URL` | Backend | Postgres connection; empty uses local JSON for dev |
| `SESSION_SECRET` | Backend | HMAC signing key for auth tokens |
| `ALLOWED_ORIGINS` | Backend | Comma-separated CORS origins for the API |

## Deployment

Production autodeploys from `main`:

- **Frontend:** Vercel → https://generation-league.vercel.app
- **Backend:** DigitalOcean App Platform (Docker) → health at `/health`, WebSocket at `/socket`

See [DEPLOYMENT.md](DEPLOYMENT.md) for local production checks, environment setup, smoke tests, and optional self-hosted VM instructions.

## Documentation

| Doc | Contents |
| --- | --- |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Hosting, env vars, smoke tests, updates |
| [AGENTS.md](AGENTS.md) | Rules for coding agents working in this repo |
| [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) | Licenses, sources, and checksums |
| [SKILL.md](SKILL.md) | Creature sprite art direction |
| [skills/networking-cost/SKILL.md](skills/networking-cost/SKILL.md) | Networking budget and protocol constraints |
| [skills/security/SKILL.md](skills/security/SKILL.md) | Server boundary and abuse controls |

## License and attribution

Game code is private project source. Third-party assets and engine licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
