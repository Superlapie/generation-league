import type {
  BattleAction, BattleContext, BattleEvent, BattleSide, CreatureInstance, ElementType,
  MajorStatus, MoveDefinition, SpeciesDefinition, StatName, Stats,
} from './types';

export interface Rng { next(): number; int(min: number, max: number): number }

export class SeededRng implements Rng {
  private seed: number;
  constructor(seed = Date.now()) { this.seed = seed >>> 0 || 1; }
  next() { this.seed = (this.seed + 0x6d2b79f5) | 0; let t = this.seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  int(min: number, max: number) { return Math.floor(this.next() * (max - min + 1)) + min; }
}

export const ZERO_STATS: Stats = { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 };
export const BASE_STAGES = { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0, accuracy: 0, evasion: 0 };

const NATURE_AXES: Array<[StatName | null, StatName | null]> = [
  [null, null], ['attack', 'defense'], ['attack', 'spAttack'], ['attack', 'spDefense'], ['attack', 'speed'],
  ['defense', 'attack'], [null, null], ['defense', 'spAttack'], ['defense', 'spDefense'], ['defense', 'speed'],
  ['spAttack', 'attack'], ['spAttack', 'defense'], [null, null], ['spAttack', 'spDefense'], ['spAttack', 'speed'],
  ['spDefense', 'attack'], ['spDefense', 'defense'], ['spDefense', 'spAttack'], [null, null], ['spDefense', 'speed'],
  ['speed', 'attack'], ['speed', 'defense'], ['speed', 'spAttack'], ['speed', 'spDefense'], [null, null],
];

export const NATURES = [
  'Hardy', 'Boldheart', 'Fierce', 'Keen', 'Hasty', 'Stalwart', 'Docile', 'Clever', 'Calm', 'Fleet',
  'Mighty', 'Guarded', 'Bashful', 'Serene', 'Swift', 'Gentle', 'Patient', 'Bright', 'Quirky', 'Nimble',
  'Quick', 'Daring', 'Wily', 'Careful', 'Steady',
] as const;

export function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
export function natureModifier(nature: string, stat: StatName) {
  const axes = NATURE_AXES[Math.max(0, NATURES.indexOf(nature as typeof NATURES[number]))];
  if (axes[0] === stat) return 1.1;
  if (axes[1] === stat) return 0.9;
  return 1;
}

export function sanitizeEvs(input: Stats): Stats {
  const out = { ...ZERO_STATS };
  let remaining = 510;
  (Object.keys(out) as StatName[]).forEach((stat) => {
    out[stat] = clamp(Math.floor(input[stat] || 0), 0, Math.min(255, remaining));
    remaining -= out[stat];
  });
  return out;
}

export function calculateStats(creature: CreatureInstance, species: SpeciesDefinition): Stats {
  const evs = sanitizeEvs(creature.evs);
  const level = creature.level;
  const stat = (key: StatName) => Math.floor(((2 * species.baseStats[key] + clamp(creature.ivs[key], 0, 31) + Math.floor(evs[key] / 4)) * level) / 100);
  return {
    hp: stat('hp') + level + 10,
    attack: Math.floor((stat('attack') + 5) * natureModifier(creature.nature, 'attack')),
    defense: Math.floor((stat('defense') + 5) * natureModifier(creature.nature, 'defense')),
    spAttack: Math.floor((stat('spAttack') + 5) * natureModifier(creature.nature, 'spAttack')),
    spDefense: Math.floor((stat('spDefense') + 5) * natureModifier(creature.nature, 'spDefense')),
    speed: Math.floor((stat('speed') + 5) * natureModifier(creature.nature, 'speed')),
  };
}

const TYPE_CHART: Record<ElementType, Partial<Record<ElementType, number>>> = {
  Neutral: {},
  Verdant: { Tide: 2, Ember: 0.5, Wind: 0.5, Verdant: 0.5 },
  Ember: { Verdant: 2, Tide: 0.5, Ember: 0.5 },
  Tide: { Ember: 2, Verdant: 0.5, Tide: 0.5 },
  Wind: { Verdant: 2, Wind: 0.5 },
};

export function typeEffectiveness(attack: ElementType, defending: SpeciesDefinition) {
  return defending.types.reduce((value, type) => type ? value * (TYPE_CHART[attack][type] ?? 1) : value, 1);
}

export function gen3Category(type: ElementType): 'Physical' | 'Special' {
  return type === 'Ember' || type === 'Tide' ? 'Special' : 'Physical';
}

export function stageMultiplier(stage: number) {
  const value = clamp(stage, -6, 6);
  return value >= 0 ? (2 + value) / 2 : 2 / (2 - value);
}

export function accuracyCheck(move: MoveDefinition, attacker: BattleSide, defender: BattleSide, rng: Rng) {
  if (move.accuracy <= 0) return true;
  const chance = clamp(move.accuracy * stageMultiplier(attacker.stages.accuracy) / stageMultiplier(defender.stages.evasion), 1, 100);
  return rng.next() * 100 < chance;
}

export function damageRoll(
  attacker: CreatureInstance, defender: CreatureInstance, move: MoveDefinition,
  attackerSpecies: SpeciesDefinition, defenderSpecies: SpeciesDefinition,
  attackerStages: BattleSide['stages'], defenderStages: BattleSide['stages'], rng: Rng,
  field: MoveDefinition['field'] | null = null,
) {
  const aStats = calculateStats(attacker, attackerSpecies);
  const dStats = calculateStats(defender, defenderSpecies);
  const category = move.power > 0 ? gen3Category(move.type) : move.category;
  const attackKey = category === 'Physical' ? 'attack' : 'spAttack';
  const defenseKey = category === 'Physical' ? 'defense' : 'spDefense';
  const critical = rng.next() < 1 / 16;
  const attack = aStats[attackKey] * stageMultiplier(critical && attackerStages[attackKey] < 0 ? 0 : attackerStages[attackKey]);
  const defense = dStats[defenseKey] * stageMultiplier(critical && defenderStages[defenseKey] > 0 ? 0 : defenderStages[defenseKey]);
  const stab = attackerSpecies.types.includes(move.type) ? 1.5 : 1;
  const effectiveness = typeEffectiveness(move.type, defenderSpecies);
  const burn = attacker.status === 'burn' && category === 'Physical' ? 0.5 : 1;
  const abilityBoost = attacker.currentHp <= Math.floor(aStats.hp / 3) && ((attacker.ability === 'Rootwake' && move.type === 'Verdant') || (attacker.ability === 'Flashkindle' && move.type === 'Ember') || (attacker.ability === 'Tidewell' && move.type === 'Tide') || (attacker.ability === 'Windweave' && move.type === 'Wind')) ? 1.5 : 1;
  const heldBoost = attacker.heldItem === 'emberCharm' && move.type === 'Ember' ? 1.12 : 1;
  const guard = (defender.ability === 'Stoneheart' && move.type === 'Neutral') || (defender.ability === 'Gritcoat' && move.type === 'Wind') ? .75 : 1;
  const fieldBoost = field === 'cinderfall' ? (move.type === 'Ember' ? 1.25 : move.type === 'Tide' ? .8 : 1) : field === 'monsoon' ? (move.type === 'Tide' ? 1.25 : move.type === 'Ember' ? .8 : 1) : field === 'tailwind' && move.type === 'Wind' ? 1.15 : 1;
  const random = 217 + Math.floor(rng.next() * 39);
  const base = Math.floor(Math.floor(Math.floor((2 * attacker.level / 5 + 2) * move.power * attack / Math.max(1, defense)) / 50) + 2);
  const modifier = stab * effectiveness * burn * abilityBoost * heldBoost * guard * fieldBoost * (critical ? 2 : 1);
  const damage = Math.floor((base * modifier * random) / 255);
  return { damage: effectiveness === 0 ? 0 : Math.max(1, damage), effectiveness, critical };
}

export function expForLevel(level: number, curve: SpeciesDefinition['growthCurve']) {
  if (curve === 'fast') return Math.floor(4 * level ** 3 / 5);
  if (curve === 'slow') return Math.floor(5 * level ** 3 / 4);
  return level ** 3;
}

export function expReward(species: SpeciesDefinition, level: number, participants = 1, trainer = false) {
  return Math.max(1, Math.floor((species.baseExp * level * (trainer ? 1.5 : 1)) / 7 / Math.max(1, participants)));
}

export function captureChance(target: CreatureInstance, species: SpeciesDefinition, maxHp: number, itemModifier: number, rng: Rng) {
  const statusBonus = target.status === 'sleep' ? 2 : target.status ? 1.5 : 1;
  const a = ((3 * maxHp - 2 * target.currentHp) * species.captureRate * itemModifier * statusBonus) / (3 * maxHp);
  return rng.next() < clamp(a / 255, 0.02, 0.95);
}

function displayName(creature: CreatureInstance, species: SpeciesDefinition) { return creature.nickname || species.name; }
function active(side: BattleSide) { return side.party[side.active]; }
function alive(creature: CreatureInstance) { return creature.currentHp > 0; }
function speed(side: BattleSide, species: SpeciesDefinition, field: MoveDefinition['field'] | null = null) {
  const creature = active(side);
  let value = calculateStats(creature, species).speed * stageMultiplier(side.stages.speed);
  if (creature.status === 'paralysis') value *= 0.25;
  if (creature.heldItem === 'swiftBand') value *= 1.1;
  if (field === 'tailwind' && species.types.includes('Wind')) value *= 1.25;
  return value;
}

export function chooseTrainerAction(context: BattleContext, species: Record<string, SpeciesDefinition>, moves: Record<string, MoveDefinition>, rng: Rng): BattleAction {
  const side = context.enemy;
  const foe = context.player;
  const creature = active(side);
  const foeCreature = active(foe);
  const creatureSpecies = species[creature.speciesId];
  const foeSpecies = species[foeCreature.speciesId];
  const hpRatio = creature.currentHp / calculateStats(creature, creatureSpecies).hp;
  const viable = creature.moves.map((known, index) => ({ known, index, move: moves[known.moveId] })).filter((entry) => entry.known.pp > 0);
  let best = viable[0]?.index ?? 0;
  let bestScore = -Infinity;
  for (const entry of viable) {
    const move = entry.move;
    let score = move.power * typeEffectiveness(move.type, foeSpecies) * (move.accuracy / 100);
    if (move.effectStatus && foeCreature.status) score *= 0.4;
    if (move.effect === 'heal') score = hpRatio < 0.35 ? 160 : 10;
    if (move.effect === 'protect') score = hpRatio < 0.25 ? 80 : 20;
    if (move.effect === 'raise' || move.effect === 'lower') score += context.turn < 3 ? 35 : 8;
    score += rng.next() * 12;
    if (score > bestScore) { bestScore = score; best = entry.index; }
  }
  if (hpRatio < 0.18) {
    const switchIndex = side.party.findIndex((candidate, index) => index !== side.active && alive(candidate));
    if (switchIndex >= 0 && rng.next() < 0.45) return { kind: 'switch', partyIndex: switchIndex };
  }
  return { kind: 'move', moveIndex: best };
}

function actionPriority(action: BattleAction, side: BattleSide, moveMap: Record<string, MoveDefinition>) {
  if (action.kind === 'switch' || action.kind === 'item' || action.kind === 'capture' || action.kind === 'flee') return 6;
  return moveMap[active(side).moves[action.moveIndex]?.moveId]?.priority ?? 0;
}

function canAct(creature: CreatureInstance, name: string, sideName: 'player' | 'enemy', rng: Rng, events: BattleEvent[]) {
  if (creature.status === 'sleep') {
    if (creature.sleepTurns > 0) { creature.sleepTurns -= 1; events.push({ kind: 'status', side: sideName, text: `${name} is fast asleep.` }); return false; }
    creature.status = null; events.push({ kind: 'status', side: sideName, text: `${name} woke up!` });
  }
  if (creature.status === 'paralysis' && rng.next() < 0.25) { events.push({ kind: 'status', side: sideName, text: `${name} is paralyzed!` }); return false; }
  return true;
}

function applyStatus(target: CreatureInstance, status: Exclude<MajorStatus, null>, rng: Rng) {
  if (target.status) return false;
  target.status = status;
  if (status === 'sleep') target.sleepTurns = rng.int(1, 3);
  return true;
}

export function resolveTurn(
  context: BattleContext, playerAction: BattleAction, enemyAction: BattleAction,
  species: Record<string, SpeciesDefinition>, moves: Record<string, MoveDefinition>, rng: Rng,
): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (!alive(active(context.player)) && playerAction.kind === 'switch') {
    const next = context.player.party[playerAction.partyIndex];
    if (next && alive(next) && playerAction.partyIndex !== context.player.active) {
      context.player.active = playerAction.partyIndex; context.player.stages = { ...BASE_STAGES };
      events.push({ kind: 'switch', side: 'player', text: `Go ${displayName(next, species[next.speciesId])}!` });
    }
    return events;
  }
  context.turn += 1;
  context.player.protected = false;
  context.enemy.protected = false;
  const pairs: Array<{ name: 'player' | 'enemy'; side: BattleSide; foeName: 'player' | 'enemy'; foe: BattleSide; action: BattleAction }> = [
    { name: 'player', side: context.player, foeName: 'enemy', foe: context.enemy, action: playerAction },
    { name: 'enemy', side: context.enemy, foeName: 'player', foe: context.player, action: enemyAction },
  ];
  pairs.sort((a, b) => {
    const priority = actionPriority(b.action, b.side, moves) - actionPriority(a.action, a.side, moves);
    if (priority) return priority;
    const aSpeed = speed(a.side, species[active(a.side).speciesId], context.field.effect);
    const bSpeed = speed(b.side, species[active(b.side).speciesId], context.field.effect);
    return bSpeed === aSpeed ? (rng.next() < 0.5 ? -1 : 1) : bSpeed - aSpeed;
  });

  for (const turn of pairs) {
    if (context.ended || !alive(active(turn.side))) continue;
    const actor = active(turn.side);
    const actorSpecies = species[actor.speciesId];
    const actorName = displayName(actor, actorSpecies);
    const target = active(turn.foe);
    const targetSpecies = species[target.speciesId];
    const targetName = displayName(target, targetSpecies);
    if (turn.action.kind === 'move' && turn.side.participants && !turn.side.participants.includes(actor.uid)) turn.side.participants.push(actor.uid);
    if (turn.action.kind === 'switch') {
      const next = turn.side.party[turn.action.partyIndex];
      if (next && alive(next) && turn.action.partyIndex !== turn.side.active) {
        turn.side.active = turn.action.partyIndex; turn.side.stages = { ...BASE_STAGES };
        events.push({ kind: 'switch', side: turn.name, text: `${turn.name === 'player' ? 'Go' : 'The foe sent out'} ${displayName(next, species[next.speciesId])}!` });
      }
      continue;
    }
    if (turn.action.kind !== 'move') continue;
    if (turn.action.moveIndex < 0 || turn.action.moveIndex >= actor.moves.length) continue;
    if (!canAct(actor, actorName, turn.name, rng, events)) continue;
    const known = actor.moves[turn.action.moveIndex];
    const move = known && moves[known.moveId];
    if (!move || known.pp <= 0) { events.push({ kind: 'text', side: turn.name, text: `${actorName} has no PP left!` }); continue; }
    known.pp -= 1;
    events.push({ kind: 'move', side: turn.name, moveId: move.id, text: `${actorName} used ${move.name}!` });
    if (!accuracyCheck(move, turn.side, turn.foe, rng)) { events.push({ kind: 'miss', side: turn.name, text: 'But it missed!' }); continue; }
    if (move.effect === 'protect') {
      const streak = turn.side.protectStreak ?? 0; const success = streak === 0 || rng.next() < 1 / (2 ** streak);
      if (success) { turn.side.protected = true; turn.side.protectStreak = streak + 1; events.push({ kind: 'status', side: turn.name, text: `${actorName} braced behind a shining guard!` }); }
      else { turn.side.protectStreak = 0; events.push({ kind: 'text', side: turn.name, text: `${actorName}'s guard failed!` }); }
      continue;
    }
    turn.side.protectStreak = 0;
    if (turn.foe.protected && move.target === 'foe') { events.push({ kind: 'text', side: turn.foeName, text: `${targetName} protected itself!` }); continue; }
    if (move.effect === 'heal' || move.effect === 'cleanse') {
      if (move.effect === 'cleanse') { actor.status = null; events.push({ kind: 'status', side: turn.name, text: `${actorName} was cleansed!` }); }
      const maxHp = calculateStats(actor, actorSpecies).hp;
      const amount = Math.min(maxHp - actor.currentHp, Math.max(1, Math.floor(maxHp * (move.ratio ?? 0.5))));
      actor.currentHp += amount; events.push({ kind: 'heal', side: turn.name, amount, text: `${actorName} restored health!` });
      continue;
    }
    if ((move.effect === 'raise' || move.effect === 'lower') && move.power === 0) {
      const affected = move.effect === 'raise' ? turn.side : turn.foe;
      const affectedName = move.effect === 'raise' ? actorName : targetName;
      const sideName = move.effect === 'raise' ? turn.name : turn.foeName;
      if (move.effect === 'lower' && active(affected).ability === 'Clearbody') { events.push({ kind: 'text', side: sideName, text: `${affectedName}'s Clearbody prevented the drop!` }); continue; }
      if (move.stat) affected.stages[move.stat] = clamp(affected.stages[move.stat] + (move.stages ?? (move.effect === 'raise' ? 1 : -1)), -6, 6);
      events.push({ kind: 'stage', side: sideName, text: `${affectedName}'s ${move.stat?.toUpperCase()} shifted!` });
      continue;
    }
    if (move.effectStatus && move.power === 0) {
      if (applyStatus(target, move.effectStatus, rng)) events.push({ kind: 'status', side: turn.foeName, text: `${targetName} was ${move.effectStatus === 'paralysis' ? 'paralyzed' : `${move.effectStatus}ed`}!` });
      else events.push({ kind: 'text', side: turn.foeName, text: 'But it had no effect.' });
      continue;
    }
    if (move.effect === 'weather') {
      context.field = { effect: move.field ?? null, turns: 5 };
      events.push({ kind: 'field', side: turn.name, text: `${move.name} transformed the field!` });
      continue;
    }
    let totalDamage = 0;
    let lastEffectiveness = 1;
    const hits = move.effect === 'multiHit' ? rng.int(move.minHits ?? 2, move.maxHits ?? 5) : 1;
    for (let hit = 0; hit < hits && target.currentHp > 0; hit += 1) {
      const result = damageRoll(actor, target, move, actorSpecies, targetSpecies, turn.side.stages, turn.foe.stages, rng, context.field.effect);
      lastEffectiveness = result.effectiveness;
      const amount = Math.min(target.currentHp, result.damage);
      target.currentHp -= amount; totalDamage += amount;
      events.push({ kind: 'damage', side: turn.foeName, amount, moveId: move.id, effectiveness: result.effectiveness, text: result.critical ? 'A critical hit!' : '' });
    }
    if (hits > 1) events.push({ kind: 'text', side: turn.name, text: `It struck ${hits} times!` });
    if (lastEffectiveness > 1) events.push({ kind: 'text', text: 'It is super effective!' });
    if (lastEffectiveness < 1) events.push({ kind: 'text', text: 'It is not very effective…' });
    if (move.effectStatus && rng.next() * 100 < (move.effectChance ?? 100) && applyStatus(target, move.effectStatus, rng)) events.push({ kind: 'status', side: turn.foeName, text: `${targetName} was ${move.effectStatus}ed!` });
    if ((move.effect === 'raise' || move.effect === 'lower') && move.stat) {
      const affected = move.effect === 'raise' ? turn.side : turn.foe;
      const affectedName = move.effect === 'raise' ? actorName : targetName;
      const sideName = move.effect === 'raise' ? turn.name : turn.foeName;
      if (move.effect === 'lower' && active(affected).ability === 'Clearbody') events.push({ kind: 'text', side: sideName, text: `${affectedName}'s Clearbody prevented the drop!` });
      else { affected.stages[move.stat] = clamp(affected.stages[move.stat] + (move.stages ?? (move.effect === 'raise' ? 1 : -1)), -6, 6); events.push({ kind: 'stage', side: sideName, text: `${affectedName}'s ${move.stat.toUpperCase()} shifted!` }); }
    }
    if (move.effect === 'drain') {
      const maxHp = calculateStats(actor, actorSpecies).hp;
      const amount = Math.min(maxHp - actor.currentHp, Math.max(1, Math.floor(totalDamage * (move.ratio ?? 0.5))));
      actor.currentHp += amount; events.push({ kind: 'heal', side: turn.name, amount, text: `${actorName} absorbed vitality!` });
    }
    if (move.effect === 'recoil') {
      const amount = Math.min(actor.currentHp, Math.max(1, Math.floor(totalDamage * (move.ratio ?? 0.25))));
      actor.currentHp -= amount; events.push({ kind: 'damage', side: turn.name, amount, text: `${actorName} was hurt by recoil!` });
    }
    if (target.ability === 'Thornhide' && move.power > 0 && gen3Category(move.type) === 'Physical' && actor.currentHp > 0) {
      const amount = Math.min(actor.currentHp, Math.max(1, Math.floor(calculateStats(actor, actorSpecies).hp / 8))); actor.currentHp -= amount;
      events.push({ kind: 'damage', side: turn.name, amount, text: `${actorName} was pricked by Thornhide!` });
    }
    if (!alive(target)) events.push({ kind: 'faint', side: turn.foeName, text: `${targetName} fainted!` });
    if (!alive(actor)) events.push({ kind: 'faint', side: turn.name, text: `${actorName} fainted!` });
  }

  for (const [name, side] of [['player', context.player], ['enemy', context.enemy]] as const) {
    const creature = active(side);
    if (!alive(creature)) continue;
    const creatureName = displayName(creature, species[creature.speciesId]);
    if (creature.status === 'burn' || creature.status === 'poison') {
      const amount = Math.max(1, Math.floor(calculateStats(creature, species[creature.speciesId]).hp / 8));
      creature.currentHp = Math.max(0, creature.currentHp - amount);
      events.push({ kind: 'damage', side: name, amount, text: `${creatureName} is hurt by ${creature.status}!` });
      if (!alive(creature)) events.push({ kind: 'faint', side: name, text: `${creatureName} fainted!` });
    }
    if (creature.ability === 'Shedskin' && creature.status && rng.next() < .3) { creature.status = null; events.push({ kind: 'status', side: name, text: `${creatureName}'s Shedskin cured its status!` }); }
  }
  if (context.field.turns > 0 && --context.field.turns === 0) { context.field.effect = null; events.push({ kind: 'field', text: 'The field returned to normal.' }); }
  const playerAlive = context.player.party.some(alive);
  const enemyAlive = context.enemy.party.some(alive);
  if (!playerAlive || !enemyAlive) {
    context.ended = true; context.winner = playerAlive ? 'player' : 'enemy';
    events.push({ kind: 'end', text: playerAlive ? 'You won the battle!' : 'Your party is unable to battle!' });
  }
  return events;
}
