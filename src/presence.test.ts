import { describe, expect, it } from 'vitest';
import { canSeePlayer, PRESENCE_RADIUS_TILES, visibleRemotePlayerIds } from './presence';
import type { PresenceRecord } from './types';

const player = (overrides: Partial<PresenceRecord> = {}): PresenceRecord => ({
  accountId: 'acct-b',
  displayName: 'Scout',
  worldId: 'mossmere',
  x: 10,
  y: 10,
  mapId: 'mossmere',
  avatar: 'a',
  onlineAt: Date.now(),
  ...overrides,
});

describe('presence visibility', () => {
  it('requires the same map before players can see each other', () => {
    expect(canSeePlayer({ mapId: 'mossmere', x: 10, y: 10 }, { mapId: 'research-lodge', x: 10, y: 10 })).toBe(false);
    expect(canSeePlayer({ mapId: 'mossmere', x: 10, y: 10 }, { mapId: 'mossmere', x: 10, y: 10 })).toBe(true);
  });

  it('uses a 20-tile radius for nearby visibility', () => {
    const observer = { mapId: 'mossmere', x: 10, y: 10 };
    expect(canSeePlayer(observer, { mapId: 'mossmere', x: 10 + PRESENCE_RADIUS_TILES, y: 10 })).toBe(true);
    expect(canSeePlayer(observer, { mapId: 'mossmere', x: 10 + PRESENCE_RADIUS_TILES + 1, y: 10 })).toBe(false);
  });

  it('filters self and other-map players from visible remote ids', () => {
    const onlinePlayers = new Map<string, PresenceRecord>([
      ['acct-self', player({ accountId: 'acct-self' })],
      ['acct-nearby', player({ accountId: 'acct-nearby', x: 11, y: 10 })],
      ['acct-away', player({ accountId: 'acct-away', mapId: 'research-lodge' })],
    ]);
    expect([...visibleRemotePlayerIds(onlinePlayers, 'acct-self', 'mossmere')]).toEqual(['acct-nearby']);
  });
});
