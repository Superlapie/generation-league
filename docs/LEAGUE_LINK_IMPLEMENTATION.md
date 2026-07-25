# League Link Implementation Plan

## Goal

Move all online-facing UI from Phaser overlays and floating DOM chat into a unified **League Link** companion sidebar/drawer while preserving the existing WebSocket client, server protocol, and gameplay canvas.

## Source of Truth

| Data | Current source | After migration |
|------|----------------|-----------------|
| WebSocket connection | `liveNetwork` (`GenerationNetworkClient`) | Unchanged — single client |
| Worlds directory | `worlds:list` server event | `onlineUiStore.worlds` via bridge |
| Presence / nearby | `presence:list`, `presence:changed` | `onlineUiStore.onlinePlayers` via bridge |
| Chat | `chat:message` | `onlineUiStore.chatMessages` by channel |
| Friends | `friend:changed` | `onlineUiStore.friends` / `pendingFriendRequests` |
| Trades | `trade:changed` | `onlineUiStore.tradeListings` |
| Player cards | `player:card` | `onlineUiStore.selectedPlayerCard` |
| Connection / ping | `liveNetwork` + `pong` | `onlineUiStore.connectionState`, `pingMs` |

## Architecture

```
main.ts
  ├── initGameScale()          → integer canvas scaling
  ├── initOnlineUiBridge()     → single WS message handler
  └── initLeagueLink()         → DOM sidebar / drawer

OverworldScene
  ├── connectLiveWorldSession() (unchanged)
  ├── onlineUiBridge.setObserver() on move
  └── reads store.onlinePlayers for sprite sync

MenuScene
  └── "LEAGUE LINK" opens DOM sidebar (retires Phaser worlds/social pages)
```

## Files

### New
- `src/online/onlineUiStore.ts`
- `src/online/onlineUiBridge.ts`
- `src/online/LeagueLink.ts`
- `src/online/OnlineNotifications.ts`
- `src/online/gameScale.ts`
- `src/online/views/WorldView.ts`
- `src/online/views/ChatView.ts`
- `src/online/views/PlayersView.ts`
- `src/online/views/TradeView.ts`
- `src/online/online-ui.css`
- `src/online/onlineUiStore.test.ts`

### Modified
- `index.html` — app shell layout
- `src/style.css` — design tokens + shell (remove `.world-chat`)
- `src/main.ts` — bootstrap League Link + scaling
- `src/scenes/OverworldScene.ts` — remove floating chat, use bridge/store
- `src/scenes/MenuScene.ts` — retire Phaser online/social screens
- `src/presence.ts` — radius-aware `visibleRemotePlayerIds`

## Checklist

- [x] Implementation plan documented
- [x] `onlineUiStore` with normalized presentation state
- [x] `onlineUiBridge` — single WS subscription, no duplicate connections
- [x] League Link shell (header, sidebar, mobile drawer)
- [x] World view with shard rows and switch confirmation
- [x] Chat view — single stream, channels, unread, auto-scroll
- [x] Players view — nearby/friends/requests with detail card
- [x] Trade view — listings with pending-state guards
- [x] Toast notifications
- [x] Integer game scaling (target 2× / 960×640)
- [x] Remove floating `.world-chat` from OverworldScene
- [x] Retire MenuScene ONLINE WORLDS / SOCIAL HUB Phaser pages
- [x] Tests for store, chat dedup, unread, sidebar state
- [x] `npm run check` and `npm run build` pass

## Networking Preservation

- No new WebSocket connections
- No polling for data already delivered by WS events
- All sends go through existing `liveNetwork.send()` types
- `connectLiveWorldSession` / `switchWorldSession` unchanged
