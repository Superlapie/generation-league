import type { CloudProfileV2, GameSaveV1 } from './types';

export function toCloudProfile(save: GameSaveV1, accountId: string, worldId: string, guest = false): CloudProfileV2 {
  return {
    schemaVersion: 2,
    accountId,
    displayName: save.player.name,
    guest,
    player: structuredClone(save.player),
    location: structuredClone(save.location),
    party: structuredClone(save.party),
    storage: structuredClone(save.storage),
    inventory: structuredClone(save.inventory),
    money: save.money,
    guide: structuredClone(save.guide),
    storyFlags: [...save.storyFlags],
    defeatedTrainers: [...save.defeatedTrainers],
    collectedItems: [...save.collectedItems],
    options: structuredClone(save.options),
    playTimeSeconds: save.playTimeSeconds,
    startedAt: save.startedAt,
    pendingEvolution: structuredClone(save.pendingEvolution),
    crests: [...save.player.crests],
    worldId,
    updatedAt: Date.now(),
  };
}

export function applyCloudProfile(local: GameSaveV1, profile: CloudProfileV2): GameSaveV1 {
  if (profile.schemaVersion !== 2 || profile.party.length > 6 || profile.storage.length > 120) throw new Error('Invalid cloud profile');
  return {
    ...structuredClone(local),
    player: structuredClone(profile.player),
    location: structuredClone(profile.location),
    party: structuredClone(profile.party),
    storage: structuredClone(profile.storage),
    inventory: structuredClone(profile.inventory),
    money: Math.max(0, Math.floor(profile.money)),
    guide: structuredClone(profile.guide),
    storyFlags: [...profile.storyFlags],
    defeatedTrainers: [...profile.defeatedTrainers],
    collectedItems: [...profile.collectedItems],
    options: structuredClone(profile.options),
    playTimeSeconds: Math.max(0, profile.playTimeSeconds),
    startedAt: profile.startedAt,
    pendingEvolution: structuredClone(profile.pendingEvolution),
    savedAt: Date.now(),
  };
}
