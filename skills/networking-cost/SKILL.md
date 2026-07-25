---
name: networking-cost
description: Keep Generation League networking secure, responsive, and as cheap as possible.
---

# Networking Cost Skill

Use this skill for any client/server, WebSocket, HTTP, account, save, presence, chat, trade, matchmaking, or deployment work.

## Order Of Priorities

1. Preserve correctness and player-visible responsiveness.
2. Minimize always-on connections and server work.
3. Minimize message count, payload size, broadcast fanout, and database writes.
4. Keep the implementation simple enough to audit and operate cheaply.

## Required Design Rules

- Reuse one live connection per active game client. Close menu-only connections when the menu closes.
- Do not poll when an existing WebSocket event or user action is sufficient.
- Use server heartbeats for liveness. Client latency pings are optional and must be disabled when latency is not displayed or needed.
- Send presence only after a successful handshake and only when the player changes tile, map, or meaningful state.
- Keep presence scoped to the smallest useful audience, preferably the same map and an interest radius. The overworld uses a generous 20-tile Euclidean radius with enter/leave transitions, so distant players receive no movement traffic. Do not broadcast every movement to every player in a shard.
- Keep chat world-wide only when requested by the channel. Sanitize, cap, rate-limit, and broadcast accepted messages once.
- Debounce or coalesce repeated UI actions, but never delay movement, chat submission, trade confirmation, or battle turns enough to feel sluggish.
- Persist only on meaningful changes. Never write a full cloud snapshot for an unchanged reconnect or heartbeat.
- Bound every collection, payload, queue, retry loop, and timer. Reject oversized or malformed input at the server boundary.
- Prefer compact JSON envelopes and existing protocol types over new abstractions or dependencies.
- Do not add autoscaling, queues, caches, Redis, or a second service until profiling proves the simpler path is insufficient.

## Cost Review Checklist

Before merging a network change, record:

- maximum simultaneous client connections per player
- messages per player per minute while idle and while moving
- largest payload and expected broadcast fanout
- database writes per player action and per session
- reconnect and cleanup behavior
- security validation and rate limits
- why the UX remains responsive

## Acceptance Checks

- A menu open/close cycle does not leave a duplicate socket.
- Idle overworld clients do not send unnecessary latency traffic.
- A reconnect does not rewrite unchanged profile state.
- Movement remains smooth and remote players remain current.
- Chat remains ordered, sanitized, rate-limited, and visible without forcing a large UI or payload.
- `npm.cmd run check` and `npm.cmd run build` pass.
