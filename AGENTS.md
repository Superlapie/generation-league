# Generation League Agent Rules

Before changing code, inspect the relevant project skills.

1. Read the root `SKILL.md` when the task involves creatures, sprites, or visual asset production.
2. Read every relevant `skills/*/SKILL.md` file before implementing a cross-cutting system.
3. For networking, accounts, presence, chat, saves, trades, or deployment, read `skills/networking-cost/SKILL.md` first.
4. For authentication, authorization, user input, persistence, protocol messages, accounts, trades, or multiplayer state, read `skills/security/SKILL.md` before editing.
5. Prefer the smallest implementation that preserves the user-visible contract. Do not add a service, dependency, polling loop, database write, or message type without a measured need.
6. After network or security changes, run `npm.cmd run check` and `npm.cmd run build`, then inspect the browser path when available.
7. Never commit secrets, local state, generated package stores, or unrelated dirty-worktree changes.

Networking cost is a release requirement. Every network change must state its connection count, message frequency, payload size, persistence behavior, and expected UX impact.
