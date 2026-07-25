# GitHub workspace

This folder holds repository automation and contributor pointers for [Generation League](https://github.com/Superlapie/generation-league).

## Branches and deploys

| Branch | Deploy target |
| --- | --- |
| `main` | Production frontend (Vercel) and backend (DigitalOcean App Platform) |

Feature work should branch from `main` and merge via pull request after `pnpm run check` passes locally.

## CI

[`.github/workflows/ci.yml`](workflows/ci.yml) runs on push and pull requests to `main`:

- TypeScript build (`tsc -b`)
- Asset validation
- Vitest unit tests

## Docs map

| File | Purpose |
| --- | --- |
| [../README.md](../README.md) | Game overview, local dev, controls, multiplayer |
| [../DEPLOYMENT.md](../DEPLOYMENT.md) | Production hosting and smoke tests |
| [../AGENTS.md](../AGENTS.md) | Agent coding rules |
| [../THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) | Third-party licenses |

## Reporting issues

Include browser, whether you were guest or signed in, world shard, map name, and steps to reproduce. For multiplayer bugs, note whether both players were on the same map and within ~20 tiles.
