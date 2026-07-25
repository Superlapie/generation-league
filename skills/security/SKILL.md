---
name: security
description: Make Generation League server-authoritative, abuse-resistant, and secure by default.
---

# Security Skill

Use this skill for every feature that accepts client input, changes game state, touches identity, stores data, sends network messages, renders user content, or changes deployment configuration.

## Core Rule

The client is untrusted presentation code. The server is the source of truth for identity, authorization, progression, inventory, creatures, currency, trades, battles, presence, chat, and rewards.

Never accept a client-reported result merely because it was produced by the official frontend. Attackers can call the WebSocket directly, modify JavaScript, replay messages, forge payloads, or skip the UI.

## Required Server Boundary

- Authenticate sessions with expiring, signed tokens and never trust a client-supplied account ID.
- Authorize every action against the authenticated session and current server state.
- Validate message version, envelope ID, type, payload shape, ranges, ownership, state transitions, and permissions before mutation.
- Reject malformed, oversized, duplicated, expired, out-of-order, and unauthorized messages.
- Make important commands idempotent or transactionally guarded so retries cannot duplicate rewards, trades, creatures, currency, or progression.
- Derive timestamps, IDs, prices, levels, positions, damage, drops, inventory counts, and trade results on the server.
- Treat client saves as import candidates only. Do not use client-supplied progression as authoritative cloud state without a validated migration or signed server record.
- Enforce ownership and availability checks again immediately before every trade, listing, transfer, battle result, or reward.

## Abuse Controls

- Rate-limit login, registration, chat, profile writes, presence updates, trade actions, and expensive operations by account and connection.
- Use constant-time password comparison, strong password hashing, generic login errors, and account enumeration resistance.
- Cap payloads, strings, arrays, nested objects, queues, database writes, and retained chat history.
- Sanitize user text at the server boundary and render it as text, never executable HTML.
- Validate WebSocket `Origin`, use TLS in production, keep secrets in environment variables, and never expose database credentials or session secrets to the browser.
- Close duplicate sessions safely and ensure an old socket cannot delete or mutate the replacement session.
- Log security-relevant failures without logging passwords, tokens, or full private messages.

## Persistence And Transactions

- Use server-side transactions or conditional updates for atomic transfers.
- Never perform a read-modify-write trade or inventory mutation without a conflict check.
- Persist only validated server state.
- Make migrations explicit, versioned, bounded, and testable.
- Fail closed when validation or persistence is unavailable; do not silently grant or discard progression.

## Review Questions

Before merging, answer:

- What can an attacker send directly that the UI does not expose?
- Which fields are client claims, and which are derived on the server?
- Can this request be replayed, reordered, duplicated, or raced?
- Can one account access another account's profile, creatures, messages, or trade?
- What happens on reconnect, timeout, duplicate login, and partial persistence failure?
- Are all user-controlled strings rendered safely?
- What is the rate limit and maximum resource cost per attacker?

## Current Repository Debt

The existing `profile:save` path still accepts a client profile snapshot for local-save import and must be replaced with server-authoritative command mutations before claiming full anti-cheat protection. Do not expand that trust boundary. Any work touching it must either narrow validation immediately or document the migration and add tests.

## Acceptance Checks

- Security tests cover malformed envelopes, forged IDs, duplicate messages, replay, unauthorized ownership, oversized payloads, rate limits, and trade races.
- A modified client cannot grant itself progression, currency, creatures, or completed battles.
- A duplicate request cannot duplicate or destroy state.
- Private data is not returned to unauthorized clients.
- `npm.cmd run check` and `npm.cmd run build` pass.
