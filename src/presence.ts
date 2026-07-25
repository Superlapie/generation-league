import type { PresenceRecord } from './types';

export const PRESENCE_RADIUS_TILES = 20;

export function canSeePlayer(
  observer: Pick<PresenceRecord, 'mapId' | 'x' | 'y'>,
  player: Pick<PresenceRecord, 'mapId' | 'x' | 'y'>,
  radiusTiles = PRESENCE_RADIUS_TILES,
): boolean {
  if (observer.mapId !== player.mapId) return false;
  const dx = observer.x - player.x;
  const dy = observer.y - player.y;
  return dx * dx + dy * dy <= radiusTiles * radiusTiles;
}

export function visibleRemotePlayerIds(
  onlinePlayers: Iterable<[string, PresenceRecord]>,
  ownId: string | undefined,
  observer: Pick<PresenceRecord, 'mapId' | 'x' | 'y'>,
): Set<string> {
  const visible = new Set<string>();
  for (const [accountId, player] of onlinePlayers) {
    if (accountId === ownId) continue;
    if (canSeePlayer(observer, player)) visible.add(accountId);
  }
  return visible;
}
