import { describe, expect, it } from 'vitest';
import { createCreature, MOVES, SPECIES } from './data';
import { resolveDoubleTurn, type DoubleBattleState } from './doubleBattle';
import { envelope, isEnvelope, cleanChatBody } from './network';
import { BASE_STAGES, SeededRng, typeEffectiveness } from './rules';
import { ELEMENT_TYPES } from './types';
import { applyCloudProfile, toCloudProfile } from './cloudProfile';
import type { GameSaveV1 } from './types';

describe('production foundations', () => {
  it('supports a complete finite 17-element effectiveness matrix', () => {
    ELEMENT_TYPES.forEach((attack) => {
      ELEMENT_TYPES.forEach((defendingType) => {
        const defending = { ...SPECIES.cragbud, types: [defendingType] as [typeof defendingType] };
        expect(typeEffectiveness(attack, defending)).toBeGreaterThanOrEqual(0);
      });
    });
    expect(typeEffectiveness('Volt', { ...SPECIES.jellume, types: ['Tide'] })).toBe(2);
    expect(typeEffectiveness('Terra', { ...SPECIES.jellume, types: ['Wind'] })).toBe(0);
  });

  it('resolves two simultaneous active slots with deterministic ordering and damage', () => {
    const player = [createCreature('cragbud', 20, 'A', 'test', new SeededRng(1)), createCreature('cinderskink', 20, 'A', 'test', new SeededRng(2))];
    const enemy = [createCreature('jellume', 20, 'B', 'test', new SeededRng(3)), createCreature('gildig', 20, 'B', 'test', new SeededRng(4))];
    const side = (party: typeof player) => ({ party, active: 0, activeSlots: [0, 1] as [number, number], stages: { ...BASE_STAGES }, protected: false });
    const state: DoubleBattleState = { player: side(player), enemy: side(enemy), field: { effect: null, turns: 0 }, turn: 0, ended: false, winner: null };
    const events = resolveDoubleTurn(state, [
      { side: 'player', slot: 0, action: { kind: 'move', moveIndex: 0 }, targetSlot: 0 },
      { side: 'player', slot: 1, action: { kind: 'move', moveIndex: 0 }, targetSlot: 1 },
      { side: 'enemy', slot: 0, action: { kind: 'move', moveIndex: 0 }, targetSlot: 0 },
      { side: 'enemy', slot: 1, action: { kind: 'move', moveIndex: 0 }, targetSlot: 1 },
    ], SPECIES, MOVES, new SeededRng(5));
    expect(state.turn).toBe(1);
    expect(events.filter((event) => event.kind === 'damage')).toHaveLength(4);
    expect(enemy[0].currentHp).toBeLessThan(enemy[0].calculatedStats.hp);
    expect(player[0].currentHp).toBeLessThan(player[0].calculatedStats.hp);
  });

  it('applies spread damage to both active targets with the doubles modifier', () => {
    const player = [createCreature('cragbud', 25, 'A', 'test', new SeededRng(10)), createCreature('cragbud', 25, 'A', 'test', new SeededRng(11))];
    const enemy = [createCreature('jellume', 25, 'B', 'test', new SeededRng(12)), createCreature('jellume', 25, 'B', 'test', new SeededRng(13))];
    player.forEach((creature) => { creature.moves = [{ moveId: 'bloomwhorl', pp: 5, maxPp: 5 }]; });
    enemy.forEach((creature) => { creature.moves = [{ moveId: 'nudge', pp: 5, maxPp: 5 }]; });
    const side = (party: typeof player) => ({ party, active: 0, activeSlots: [0, 1] as [number, number], stages: { ...BASE_STAGES }, protected: false });
    const state: DoubleBattleState = { player: side(player), enemy: side(enemy), field: { effect: null, turns: 0 }, turn: 0, ended: false, winner: null };
    const before = enemy.map((creature) => creature.currentHp);
    resolveDoubleTurn(state, [
      { side: 'player', slot: 0, action: { kind: 'move', moveIndex: 0 }, targetSlot: 0 },
      { side: 'player', slot: 1, action: { kind: 'struggle' }, targetSlot: 0 },
      { side: 'enemy', slot: 0, action: { kind: 'struggle' }, targetSlot: 0 },
      { side: 'enemy', slot: 1, action: { kind: 'struggle' }, targetSlot: 1 },
    ], SPECIES, MOVES, new SeededRng(14));
    expect(enemy[0].currentHp).toBeLessThan(before[0]);
    expect(enemy[1].currentHp).toBeLessThan(before[1]);
  });

  it('accepts independent double-battle switches and item turns without inventing a move failure', () => {
    const player = [createCreature('cragbud', 25, 'A', 'test', new SeededRng(20)), createCreature('cinderskink', 25, 'A', 'test', new SeededRng(21)), createCreature('gildig', 25, 'A', 'test', new SeededRng(22))];
    const enemy = [createCreature('jellume', 25, 'B', 'test', new SeededRng(23)), createCreature('gildig', 25, 'B', 'test', new SeededRng(24))];
    const side = (party: typeof player | typeof enemy) => ({ party, active: 0, activeSlots: [0, 1] as [number, number], stages: { ...BASE_STAGES }, protected: false });
    const state: DoubleBattleState = { player: side(player), enemy: side(enemy), field: { effect: null, turns: 0 }, turn: 0, ended: false, winner: null };
    player[0].currentHp = 1;
    const events = resolveDoubleTurn(state, [
      { side: 'player', slot: 0, action: { kind: 'item', itemId: 'tonic', targetIndex: 0 } },
      { side: 'player', slot: 1, action: { kind: 'switch', partyIndex: 2 }, targetSlot: 0 },
      { side: 'enemy', slot: 0, action: { kind: 'struggle' }, targetSlot: 0 },
      { side: 'enemy', slot: 1, action: { kind: 'struggle' }, targetSlot: 1 },
    ], SPECIES, MOVES, new SeededRng(25));
    expect(state.player.activeSlots).toEqual([0, 2]);
    expect(events.some((event) => event.text?.includes('no PP'))).toBe(false);
  });

  it('validates protocol envelopes and sanitizes chat input', () => {
    const message = envelope('chat:send', { body: ' hello\nworld ', channel: 'world' });
    expect(isEnvelope(message)).toBe(true);
    expect(cleanChatBody('\u0000  hello\nworld  ')).toBe('hello world');
    expect(isEnvelope({ version: 2 })).toBe(false);
  });

  it('round-trips a local save through the versioned cloud profile bridge', () => {
    const starter = createCreature('cragbud', 5, 'ACE', 'research-lodge', new SeededRng(8));
    const save: GameSaveV1 = {
      schemaVersion: 1, migrationVersion: 2, savedAt: 1, player: { name: 'ACE', avatar: 'a', crests: [] }, location: { mapId: 'mossmere', x: 1, y: 1, facing: 'down' }, party: [starter], storage: [], inventory: [], money: 1200, guide: { seen: ['cragbud'], caught: ['cragbud'] }, storyFlags: [], defeatedTrainers: [], collectedItems: [], options: { musicVolume: .4, sfxVolume: .5, muted: false, textSpeed: 'normal', battleScene: true, battleStyle: 'shift', sound: 'stereo', buttonMode: 'normal', frame: 1, reducedMotion: false }, playTimeSeconds: 0, startedAt: 1, pendingEvolution: null,
    };
    const profile = toCloudProfile(save, 'acct-test', 'mossmere');
    const restored = applyCloudProfile(save, profile);
    expect(restored.party[0].uid).toBe(starter.uid);
    expect(profile.accountId).toBe('acct-test');
    expect(restored.money).toBe(1200);
  });
});
