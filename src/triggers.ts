import type { CreatureInstance, ElementType, MoveDefinition, MajorStatus } from './types';
import type { Rng } from './rules';

type TriggerName = 'beforeDamage' | 'beforeSpeed' | 'beforeStageChange' | 'afterDamage' | 'endTurn' | 'reward';
type TriggerCondition = {
  moveType?: ElementType;
  moveCategory?: 'Physical' | 'Special';
  hpBelow?: number;
  status?: Exclude<MajorStatus, null>;
  negativeStages?: boolean;
};
type TriggerEffect =
  | { kind: 'multiplyDamage'; multiplier: number }
  | { kind: 'multiplySpeed'; multiplier: number }
  | { kind: 'reduceDamage'; multiplier: number }
  | { kind: 'prevent' }
  | { kind: 'recoil'; ratio: number }
  | { kind: 'cureStatus'; chance: number }
  | { kind: 'multiplyReward'; multiplier: number };
interface TriggerRule { trigger: TriggerName; condition?: TriggerCondition; effect: TriggerEffect }

const ABILITY_RULES: Record<string, TriggerRule[]> = {
  Rootwake: [{ trigger: 'beforeDamage', condition: { hpBelow: 1 / 3, moveType: 'Verdant' }, effect: { kind: 'multiplyDamage', multiplier: 1.5 } }],
  Flashkindle: [{ trigger: 'beforeDamage', condition: { hpBelow: 1 / 3, moveType: 'Ember' }, effect: { kind: 'multiplyDamage', multiplier: 1.5 } }],
  Tidewell: [{ trigger: 'beforeDamage', condition: { hpBelow: 1 / 3, moveType: 'Tide' }, effect: { kind: 'multiplyDamage', multiplier: 1.5 } }],
  Windweave: [{ trigger: 'beforeDamage', condition: { hpBelow: 1 / 3, moveType: 'Wind' }, effect: { kind: 'multiplyDamage', multiplier: 1.5 } }],
  Stoneheart: [{ trigger: 'beforeDamage', condition: { moveType: 'Neutral' }, effect: { kind: 'reduceDamage', multiplier: .75 } }],
  Gritcoat: [{ trigger: 'beforeDamage', condition: { moveType: 'Wind' }, effect: { kind: 'reduceDamage', multiplier: .75 } }],
  Clearbody: [{ trigger: 'beforeStageChange', condition: { negativeStages: true }, effect: { kind: 'prevent' } }],
  Thornhide: [{ trigger: 'afterDamage', condition: { moveCategory: 'Physical' }, effect: { kind: 'recoil', ratio: 1 / 8 } }],
  Shedskin: [{ trigger: 'endTurn', condition: { status: 'burn' }, effect: { kind: 'cureStatus', chance: 30 } }, { trigger: 'endTurn', condition: { status: 'poison' }, effect: { kind: 'cureStatus', chance: 30 } }, { trigger: 'endTurn', condition: { status: 'paralysis' }, effect: { kind: 'cureStatus', chance: 30 } }, { trigger: 'endTurn', condition: { status: 'sleep' }, effect: { kind: 'cureStatus', chance: 30 } }],
  Prospector: [{ trigger: 'reward', effect: { kind: 'multiplyReward', multiplier: 1.2 } }],
};

const ITEM_RULES: Record<string, TriggerRule[]> = {
  emberCharm: [{ trigger: 'beforeDamage', condition: { moveType: 'Ember' }, effect: { kind: 'multiplyDamage', multiplier: 1.12 } }],
  swiftBand: [{ trigger: 'beforeSpeed', effect: { kind: 'multiplySpeed', multiplier: 1.1 } }],
};

const FIELD_MULTIPLIERS: Record<string, Partial<Record<ElementType, number>>> = {
  cinderfall: { Ember: 1.25, Tide: .8 }, monsoon: { Tide: 1.25, Ember: .8 }, tailwind: { Wind: 1.15 }, sunshower: {},
};

function matches(condition: TriggerCondition | undefined, owner: CreatureInstance, move: MoveDefinition, stageDelta = 0) {
  if (!condition) return true;
  const hp = owner.currentHp / Math.max(1, owner.calculatedStats.hp);
  return (condition.moveType === undefined || condition.moveType === move.type)
    && (condition.moveCategory === undefined || condition.moveCategory === move.category)
    && (condition.hpBelow === undefined || hp < condition.hpBelow)
    && (condition.status === undefined || owner.status === condition.status)
    && (condition.negativeStages === undefined || (condition.negativeStages ? stageDelta < 0 : stageDelta >= 0));
}

function rulesFor(creature: CreatureInstance, itemRules = false) { return (itemRules ? ITEM_RULES[creature.heldItem ?? ''] : ABILITY_RULES[creature.ability]) ?? []; }

export function damageMultiplier(attacker: CreatureInstance, defender: CreatureInstance, move: MoveDefinition, field: MoveDefinition['field'] | null) {
  let multiplier = 1;
  rulesFor(attacker).filter((rule) => rule.trigger === 'beforeDamage' && matches(rule.condition, attacker, move)).forEach((rule) => { if (rule.effect.kind === 'multiplyDamage') multiplier *= rule.effect.multiplier; });
  rulesFor(attacker, true).filter((rule) => rule.trigger === 'beforeDamage' && matches(rule.condition, attacker, move)).forEach((rule) => { if (rule.effect.kind === 'multiplyDamage') multiplier *= rule.effect.multiplier; });
  rulesFor(defender).filter((rule) => rule.trigger === 'beforeDamage' && matches(rule.condition, defender, move)).forEach((rule) => { if (rule.effect.kind === 'reduceDamage') multiplier *= rule.effect.multiplier; });
  const fieldMultiplier = field ? FIELD_MULTIPLIERS[field]?.[move.type] : undefined;
  return multiplier * (fieldMultiplier ?? 1);
}

export function speedMultiplier(creature: CreatureInstance, move: MoveDefinition['field'] | null, speciesHasWind: boolean) {
  let multiplier = 1;
  rulesFor(creature, true).filter((rule) => rule.trigger === 'beforeSpeed').forEach((rule) => { if (rule.effect.kind === 'multiplySpeed') multiplier *= rule.effect.multiplier; });
  if (move === 'tailwind' && speciesHasWind) multiplier *= 1.25;
  return multiplier;
}

export function preventsStageChange(creature: CreatureInstance, move: MoveDefinition, stages: number) {
  return rulesFor(creature).some((rule) => rule.trigger === 'beforeStageChange' && matches(rule.condition, creature, move, stages) && rule.effect.kind === 'prevent');
}

export function afterDamageRecoil(defender: CreatureInstance, attacker: CreatureInstance, move: MoveDefinition, dealt: number, maxHp: number) {
  return rulesFor(defender).filter((rule) => rule.trigger === 'afterDamage' && matches(rule.condition, defender, move)).reduce((amount, rule) => rule.effect.kind === 'recoil' ? Math.min(attacker.currentHp, Math.max(1, Math.floor(maxHp * rule.effect.ratio))) : amount, 0);
}

export function endTurn(creature: CreatureInstance, rng: Rng) {
  const rule = rulesFor(creature).find((entry) => entry.trigger === 'endTurn' && matches(entry.condition, creature, { type: 'Neutral' } as MoveDefinition));
  if (!rule || rule.effect.kind !== 'cureStatus' || rng.next() * 100 >= rule.effect.chance) return false;
  creature.status = null; creature.sleepTurns = 0; return true;
}

export function rewardMultiplier(creature: CreatureInstance) {
  return rulesFor(creature).filter((rule) => rule.trigger === 'reward').reduce((value, rule) => rule.effect.kind === 'multiplyReward' ? value * rule.effect.multiplier : value, 1);
}

export function validateTriggerRegistry(abilities: string[], items: string[]) {
  const missingAbilities = abilities.filter((id) => !ABILITY_RULES[id]);
  const missingItems = items.filter((id) => !ITEM_RULES[id]);
  return { missingAbilities, missingItems };
}
