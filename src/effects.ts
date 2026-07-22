import type { BattleEvent, BattleSide, CreatureInstance, EffectOperation, ItemDefinition, MajorStatus, MoveDefinition, SpeciesDefinition } from './types';
import type { Rng } from './rules';

export interface DamageResult { damage: number; effectiveness: number; critical: boolean }

export interface EffectContext {
  actor: CreatureInstance;
  target: CreatureInstance;
  actorSide: BattleSide;
  targetSide: BattleSide;
  move: MoveDefinition;
  actorSpecies: SpeciesDefinition;
  targetSpecies: SpeciesDefinition;
  actorName: string;
  targetName: string;
  actorSideName: 'player' | 'enemy';
  targetSideName: 'player' | 'enemy';
  field: { effect: MoveDefinition['field'] | null; turns: number };
  rng: Rng;
  events: BattleEvent[];
  maxHp: (creature: CreatureInstance, species: SpeciesDefinition) => number;
  damage: (move: MoveDefinition) => DamageResult;
  applyStatus: (target: CreatureInstance, status: Exclude<MajorStatus, null>) => boolean;
  canLowerStage: (target: CreatureInstance) => boolean;
}

export interface EffectSummary { totalDamage: number; lastEffectiveness: number }

const legacyEffects: Record<string, (move: MoveDefinition) => EffectOperation[]> = {
  damage: (move) => [{ kind: 'damage', power: move.power }],
  priority: (move) => [{ kind: 'damage', power: move.power }],
  burn: (move) => legacyDamageStatus(move, 'burn'),
  poison: (move) => legacyDamageStatus(move, 'poison'),
  paralyze: (move) => legacyDamageStatus(move, 'paralysis'),
  sleep: (move) => legacyDamageStatus(move, 'sleep'),
  heal: (move) => [{ kind: 'heal', ratio: move.ratio ?? .5 }],
  drain: (move) => [{ kind: 'damage', power: move.power }, { kind: 'drain', ratio: move.ratio ?? .5 }],
  recoil: (move) => [{ kind: 'damage', power: move.power }, { kind: 'recoil', ratio: move.ratio ?? .25 }],
  raise: (move) => legacyStage(move, 'self'),
  lower: (move) => legacyStage(move, 'foe'),
  multiHit: (move) => [{ kind: 'multiHit', min: move.minHits ?? 2, max: move.maxHits ?? 5 }],
  weather: (move) => [{ kind: 'setField', field: move.field ?? 'sunshower', turns: 5 }],
  protect: () => [{ kind: 'protect' }],
  cleanse: (move) => [{ kind: 'cleanse', healRatio: move.ratio ?? .25 }],
};

function legacyDamageStatus(move: MoveDefinition, status: Exclude<MajorStatus, null>): EffectOperation[] {
  const effects: EffectOperation[] = [];
  if (move.power > 0) effects.push({ kind: 'damage', power: move.power });
  effects.push({ kind: 'applyStatus', status: move.effectStatus ?? status, chance: move.effectChance ?? 100 });
  return effects;
}

function legacyStage(move: MoveDefinition, target: 'self' | 'foe'): EffectOperation[] {
  const effects: EffectOperation[] = [];
  if (move.power > 0) effects.push({ kind: 'damage', power: move.power });
  if (move.stat) effects.push({ kind: 'modifyStage', target, stat: move.stat, stages: move.stages ?? (target === 'self' ? 1 : -1), chance: move.effectChance });
  return effects;
}

/** Resolves old move records through the same operation path as new content. */
export function moveEffects(move: MoveDefinition): EffectOperation[] {
  if (move.effects?.length) return move.effects;
  return legacyEffects[move.effect ?? 'damage']?.(move) ?? [{ kind: 'damage', power: move.power }];
}

function chancePass(chance: number | undefined, rng: Rng) { return chance === undefined || rng.next() * 100 < chance; }

export function executeEffects(effects: EffectOperation[], context: EffectContext): EffectSummary {
  const summary: EffectSummary = { totalDamage: 0, lastEffectiveness: 1 };
  const run = (effect: EffectOperation) => {
    if (effect.kind === 'sequence') { effect.effects.forEach(run); return; }
    if (effect.kind === 'chance') { if (chancePass(effect.chance, context.rng)) effect.effects.forEach(run); return; }
    if (effect.kind === 'damage') {
      const move = { ...context.move, power: effect.power ?? context.move.power, category: effect.category ?? context.move.category };
      const result = context.damage(move);
      summary.lastEffectiveness = result.effectiveness;
      const amount = Math.min(context.target.currentHp, result.damage);
      context.target.currentHp -= amount;
      summary.totalDamage += amount;
      context.events.push({ kind: 'damage', side: context.targetSideName, amount, moveId: context.move.id, effectiveness: result.effectiveness, text: result.critical ? 'A critical hit!' : '' });
      return;
    }
    if (effect.kind === 'multiHit') {
      const hits = context.rng.int(effect.min, effect.max);
      for (let hit = 0; hit < hits && context.target.currentHp > 0; hit += 1) run({ kind: 'damage' });
      context.events.push({ kind: 'text', side: context.actorSideName, text: `It struck ${hits} times!` });
      return;
    }
    if (effect.kind === 'heal') {
      const maxHp = context.maxHp(context.actor, context.actorSpecies);
      const requested = effect.amount === 'flat' ? effect.value ?? 0 : Math.floor(maxHp * (effect.ratio ?? 0.5));
      const amount = Math.min(Math.max(0, maxHp - context.actor.currentHp), Math.max(1, requested));
      if (amount > 0) { context.actor.currentHp += amount; context.events.push({ kind: 'heal', side: context.actorSideName, amount, text: `${context.actorName} restored health!` }); }
      return;
    }
    if (effect.kind === 'cleanse') {
      const hadStatus = Boolean(context.actor.status);
      context.actor.status = null;
      context.actor.sleepTurns = 0;
      if (hadStatus) context.events.push({ kind: 'status', side: context.actorSideName, text: `${context.actorName} was cleansed!` });
      if (effect.healRatio) run({ kind: 'heal', ratio: effect.healRatio });
      return;
    }
    if (effect.kind === 'applyStatus') {
      if (!chancePass(effect.chance, context.rng)) return;
      if (context.applyStatus(context.target, effect.status)) context.events.push({ kind: 'status', side: context.targetSideName, text: `${context.targetName} was ${effect.status === 'paralysis' ? 'paralyzed' : `${effect.status}ed`}!` });
      return;
    }
    if (effect.kind === 'modifyStage') {
      if (!chancePass(effect.chance, context.rng)) return;
      const side = effect.target === 'self' ? context.actorSide : context.targetSide;
      const target = effect.target === 'self' ? context.actor : context.target;
      if (effect.stages < 0 && !context.canLowerStage(target)) {
        context.events.push({ kind: 'text', side: effect.target === 'self' ? context.actorSideName : context.targetSideName, text: `${target === context.actor ? context.actorName : context.targetName}'s ability prevented the drop!` });
        return;
      }
      side.stages[effect.stat] = Math.max(-6, Math.min(6, side.stages[effect.stat] + effect.stages));
      context.events.push({ kind: 'stage', side: effect.target === 'self' ? context.actorSideName : context.targetSideName, text: `${target === context.actor ? context.actorName : context.targetName}'s ${effect.stat.toUpperCase()} shifted!` });
      return;
    }
    if (effect.kind === 'drain') {
      const amount = Math.min(Math.max(0, context.maxHp(context.actor, context.actorSpecies) - context.actor.currentHp), Math.max(1, Math.floor(summary.totalDamage * effect.ratio)));
      context.actor.currentHp += amount;
      context.events.push({ kind: 'heal', side: context.actorSideName, amount, text: `${context.actorName} absorbed vitality!` });
      return;
    }
    if (effect.kind === 'recoil') {
      const amount = Math.min(context.actor.currentHp, Math.max(1, Math.floor(summary.totalDamage * effect.ratio)));
      context.actor.currentHp -= amount;
      context.events.push({ kind: 'damage', side: context.actorSideName, amount, text: `${context.actorName} was hurt by recoil!` });
      return;
    }
    if (effect.kind === 'setField') {
      context.field.effect = effect.field;
      context.field.turns = effect.turns;
      context.events.push({ kind: 'field', side: context.actorSideName, text: `${context.move.name} transformed the field!` });
      return;
    }
    if (effect.kind === 'protect') {
      const streak = context.actorSide.protectStreak ?? 0;
      const success = streak === 0 || context.rng.next() < 1 / (2 ** streak);
      if (success) { context.actorSide.protected = true; context.actorSide.protectStreak = streak + 1; context.events.push({ kind: 'status', side: context.actorSideName, text: `${context.actorName} braced behind a shining guard!` }); }
      else { context.actorSide.protectStreak = 0; context.events.push({ kind: 'text', side: context.actorSideName, text: `${context.actorName}'s guard failed!` }); }
    }
  };
  effects.forEach(run);
  return summary;
}

export function applyItemEffects(item: ItemDefinition, creature: CreatureInstance, species: SpeciesDefinition, rng: Rng) {
  const events: BattleEvent[] = [];
  if (!item.effects?.length) return events;
  const side: BattleSide = { party: [creature], active: 0, stages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0, accuracy: 0, evasion: 0 }, protected: false };
  executeEffects(item.effects, {
    actor: creature, target: creature, actorSide: side, targetSide: side,
    move: { id: `item:${item.id}`, name: item.name, type: 'Neutral', power: 0, accuracy: 0, pp: 0, priority: 0, target: 'self', category: 'Status', effects: item.effects, animation: 'item', audioCue: 'heal', description: item.description },
    actorSpecies: species, targetSpecies: species, actorName: creature.nickname || species.name, targetName: creature.nickname || species.name,
    actorSideName: 'player', targetSideName: 'player', field: { effect: null, turns: 0 }, rng, events,
    maxHp: (target, targetSpecies) => targetSpecies.baseStats.hp > 0 ? Math.floor(((2 * targetSpecies.baseStats.hp + target.ivs.hp + Math.floor(target.evs.hp / 4)) * target.level) / 100) + target.level + 10 : target.currentHp,
    damage: () => ({ damage: 0, effectiveness: 1, critical: false }), applyStatus: () => false, canLowerStage: () => true,
  });
  return events;
}
