import { executeEffects, moveEffects } from './effects';
import { afterDamageRecoil, damageMultiplier, endTurn as resolveEndTurn, preventsStageChange, rewardMultiplier, speedMultiplier } from './triggers';
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
  (Object.keys(out) as StatName[]).forEach((stat) => { out[stat] = clamp(Math.floor(input[stat] || 0), 0, Math.min(255, remaining)); remaining -= out[stat]; });
  return out;
}

export function calculateStats(creature: CreatureInstance, species: SpeciesDefinition): Stats {
  const evs = sanitizeEvs(creature.evs);
  const stat = (key: StatName) => Math.floor(((2 * species.baseStats[key] + clamp(creature.ivs[key], 0, 31) + Math.floor(evs[key] / 4)) * creature.level) / 100);
  return {
    hp: stat('hp') + creature.level + 10,
    attack: Math.floor((stat('attack') + 5) * natureModifier(creature.nature, 'attack')),
    defense: Math.floor((stat('defense') + 5) * natureModifier(creature.nature, 'defense')),
    spAttack: Math.floor((stat('spAttack') + 5) * natureModifier(creature.nature, 'spAttack')),
    spDefense: Math.floor((stat('spDefense') + 5) * natureModifier(creature.nature, 'spDefense')),
    speed: Math.floor((stat('speed') + 5) * natureModifier(creature.nature, 'speed')),
  };
}

const TYPE_CHART: Record<ElementType, Partial<Record<ElementType, number>>> = {
  Neutral: { Prism: 0 },
  Verdant: { Tide: 2, Terra: 2, Stone: 2, Ember: .5, Wind: .5, Venom: .5, Bloom: .5, Frost: .5, Metal: .5 },
  Ember: { Verdant: 2, Frost: 2, Metal: 2, Bloom: 2, Tide: .5, Stone: .5, Terra: .5, Ember: .5, Drake: .5 },
  Tide: { Ember: 2, Terra: 2, Stone: 2, Verdant: .5, Tide: .5, Volt: .5, Bloom: .5, Drake: .5 },
  Wind: { Verdant: 2, Venom: 2, Bloom: 2, Volt: .5, Stone: .5, Frost: .5 },
  Stone: { Ember: 2, Frost: 2, Wind: 2, Bloom: 2, Tide: .5, Verdant: .5, Terra: .5, Metal: .5, Venom: .5 },
  Frost: { Verdant: 2, Terra: 2, Wind: 2, Drake: 2, Ember: .5, Stone: .5, Metal: .5 },
  Volt: { Tide: 2, Wind: 2, Terra: 0, Volt: .5, Drake: .5 },
  Mystic: { Venom: 2, Umbral: 2, Metal: .5, Mystic: .5, Prism: .5 },
  Umbral: { Mystic: 2, Aether: 2, Bloom: .5, Metal: .5, Umbral: .5 },
  Drake: { Drake: 2, Metal: .5, Frost: .5, Aether: .5 },
  Metal: { Frost: 2, Stone: 2, Prism: 2, Ember: .5, Tide: .5, Terra: .5, Volt: .5 },
  Venom: { Verdant: 2, Bloom: 2, Terra: .5, Mystic: .5, Stone: .5, Venom: .5 },
  Terra: { Ember: 2, Volt: 2, Venom: 2, Stone: 2, Metal: 2, Tide: .5, Verdant: .5, Frost: .5, Wind: 0, Bloom: .5 },
  Bloom: { Verdant: 2, Mystic: 2, Umbral: 2, Ember: .5, Wind: .5, Stone: .5, Metal: .5, Frost: .5 },
  Aether: { Drake: 2, Umbral: 2, Metal: .5, Venom: .5 },
  Prism: { Mystic: 2, Umbral: 2, Neutral: 2, Metal: .5, Prism: .5 },
};

const PHYSICAL_TYPES = new Set<ElementType>(['Neutral', 'Verdant', 'Wind', 'Stone', 'Venom', 'Terra', 'Bloom', 'Prism']);

export function typeEffectiveness(attack: ElementType, defending: SpeciesDefinition) { return defending.types.reduce((value, type) => type ? value * (TYPE_CHART[attack][type] ?? 1) : value, 1); }
export function gen3Category(type: ElementType): 'Physical' | 'Special' { return PHYSICAL_TYPES.has(type) ? 'Physical' : 'Special'; }
export function stageMultiplier(stage: number) { const value = clamp(stage, -6, 6); return value >= 0 ? (2 + value) / 2 : 2 / (2 - value); }
export function accuracyStageMultiplier(stage: number) { const value = clamp(stage, -6, 6); return value >= 0 ? (3 + value) / 3 : 3 / (3 - value); }

export function accuracyCheck(move: MoveDefinition, attacker: BattleSide, defender: BattleSide, rng: Rng) {
  if (move.accuracy <= 0) return true;
  const chance = clamp(move.accuracy * accuracyStageMultiplier(attacker.stages.accuracy) / accuracyStageMultiplier(defender.stages.evasion), 1, 100);
  return rng.next() * 100 < chance;
}

export function damageRoll(attacker: CreatureInstance, defender: CreatureInstance, move: MoveDefinition, attackerSpecies: SpeciesDefinition, defenderSpecies: SpeciesDefinition, attackerStages: BattleSide['stages'], defenderStages: BattleSide['stages'], rng: Rng, field: MoveDefinition['field'] | null = null) {
  const aStats = calculateStats(attacker, attackerSpecies); const dStats = calculateStats(defender, defenderSpecies);
  const category = move.power > 0 ? gen3Category(move.type) : move.category;
  const attackKey = category === 'Physical' ? 'attack' : 'spAttack'; const defenseKey = category === 'Physical' ? 'defense' : 'spDefense';
  const critical = rng.next() < 1 / 16;
  const attack = aStats[attackKey] * stageMultiplier(critical && attackerStages[attackKey] < 0 ? 0 : attackerStages[attackKey]);
  const defense = dStats[defenseKey] * stageMultiplier(critical && defenderStages[defenseKey] > 0 ? 0 : defenderStages[defenseKey]);
  const stab = attackerSpecies.types.includes(move.type) ? 1.5 : 1; const effectiveness = typeEffectiveness(move.type, defenderSpecies);
  const burn = attacker.status === 'burn' && category === 'Physical' ? .5 : 1;
  const random = 217 + Math.floor(rng.next() * 39); const base = Math.floor(Math.floor(Math.floor((2 * attacker.level / 5 + 2) * move.power * attack / Math.max(1, defense)) / 50) + 2);
  const modifier = stab * effectiveness * burn * damageMultiplier(attacker, defender, { ...move, category }, field) * (critical ? 2 : 1);
  return { damage: effectiveness === 0 ? 0 : Math.max(1, Math.floor((base * modifier * random) / 255)), effectiveness, critical };
}

export function expForLevel(level: number, curve: SpeciesDefinition['growthCurve']) { return curve === 'fast' ? Math.floor(4 * level ** 3 / 5) : curve === 'slow' ? Math.floor(5 * level ** 3 / 4) : level ** 3; }
export function expReward(species: SpeciesDefinition, level: number, participants = 1, trainer = false) { return Math.max(1, Math.floor((species.baseExp * level * (trainer ? 1.5 : 1)) / 7 / Math.max(1, participants))); }
export function captureResult(target: CreatureInstance, species: SpeciesDefinition, maxHp: number, itemModifier: number, rng: Rng) {
  const statusBonus = target.status === 'sleep' ? 2 : target.status ? 1.5 : 1;
  const rate = Math.max(1, Math.floor(((3 * maxHp - 2 * target.currentHp) * species.captureRate * itemModifier * statusBonus) / (3 * maxHp)));
  if (rate >= 255) return { caught: true, shakes: 3 };
  const threshold = Math.floor(1048560 / Math.sqrt(Math.sqrt(Math.floor(16711680 / rate))));
  for (let shakes = 0; shakes < 4; shakes += 1) if (rng.next() * 65536 >= threshold) return { caught: false, shakes: Math.min(3, shakes) };
  return { caught: true, shakes: 3 };
}

export function captureChance(target: CreatureInstance, species: SpeciesDefinition, maxHp: number, itemModifier: number, rng: Rng) {
  return captureResult(target, species, maxHp, itemModifier, rng).caught;
}

export function escapeSucceeds(player: CreatureInstance, enemy: CreatureInstance, playerSpecies: SpeciesDefinition, enemySpecies: SpeciesDefinition, attempts: number, rng: Rng) {
  const playerSpeed = calculateStats(player, playerSpecies).speed, enemySpeed = calculateStats(enemy, enemySpecies).speed;
  if (playerSpeed >= enemySpeed) return true;
  const odds = (Math.floor(playerSpeed * 128 / Math.max(1, enemySpeed)) + 30 * Math.max(1, attempts)) % 256;
  return rng.int(0, 255) < odds;
}

function displayName(creature: CreatureInstance, species: SpeciesDefinition) { return creature.nickname || species.name; }
function active(side: BattleSide) { return side.party[side.active]; }
function alive(creature: CreatureInstance) { return creature.currentHp > 0; }
function speed(side: BattleSide, species: SpeciesDefinition, field: MoveDefinition['field'] | null = null) {
  const creature = active(side); let value = calculateStats(creature, species).speed * stageMultiplier(side.stages.speed);
  if (creature.status === 'paralysis') value *= .25; value *= speedMultiplier(creature, field, species.types.includes('Wind')); return value;
}

export function chooseTrainerAction(context: BattleContext, species: Record<string, SpeciesDefinition>, moves: Record<string, MoveDefinition>, rng: Rng): BattleAction {
  const side = context.enemy; const foe = context.player; const creature = active(side); const foeCreature = active(foe); const creatureSpecies = species[creature.speciesId]; const foeSpecies = species[foeCreature.speciesId];
  const hpRatio = creature.currentHp / calculateStats(creature, creatureSpecies).hp; const viable = creature.moves.map((known, index) => ({ known, index, move: moves[known.moveId] })).filter((entry) => entry.known.pp > 0);
  if (!viable.length) return { kind: 'struggle' };
  let best = viable[0].index; let bestScore = -Infinity;
  for (const entry of viable) {
    const effects = moveEffects(entry.move); let score = entry.move.power * typeEffectiveness(entry.move.type, foeSpecies) * (entry.move.accuracy / 100);
    if (effects.some((effect) => effect.kind === 'applyStatus') && foeCreature.status) score *= .4;
    if (effects.some((effect) => effect.kind === 'heal' || effect.kind === 'cleanse')) score = hpRatio < .35 ? 160 : 10;
    if (effects.some((effect) => effect.kind === 'protect')) score = hpRatio < .25 ? 80 : 20;
    if (effects.some((effect) => effect.kind === 'modifyStage')) score += context.turn < 3 ? 35 : 8;
    score += rng.next() * 12; if (score > bestScore) { bestScore = score; best = entry.index; }
  }
  if (hpRatio < .18) { const switchIndex = side.party.findIndex((candidate, index) => index !== side.active && alive(candidate)); if (switchIndex >= 0 && rng.next() < .45) return { kind: 'switch', partyIndex: switchIndex }; }
  return { kind: 'move', moveIndex: best };
}

function actionPriority(action: BattleAction, side: BattleSide, moveMap: Record<string, MoveDefinition>) { return action.kind === 'move' ? moveMap[active(side).moves[action.moveIndex]?.moveId]?.priority ?? 0 : action.kind === 'struggle' ? 0 : 6; }
function confusionDamage(creature: CreatureInstance, species: SpeciesDefinition, rng: Rng) {
  const stats = calculateStats(creature, species);
  const base = Math.floor(Math.floor(Math.floor((2 * creature.level / 5 + 2) * 40 * stats.attack / Math.max(1, stats.defense)) / 50) + 2);
  return Math.max(1, Math.floor((base * (217 + Math.floor(rng.next() * 39))) / 255));
}
function canAct(creature: CreatureInstance, species: SpeciesDefinition, name: string, sideName: 'player' | 'enemy', rng: Rng, events: BattleEvent[]) {
  if (creature.status === 'sleep') { if (creature.sleepTurns > 0) { creature.sleepTurns -= 1; events.push({ kind: 'status', side: sideName, text: `${name} is fast asleep.` }); return false; } creature.status = null; events.push({ kind: 'status', side: sideName, text: `${name} woke up!` }); }
  if (creature.status === 'freeze') { if (rng.next() < .2) { creature.status = null; events.push({ kind: 'status', side: sideName, text: `${name} thawed out!` }); } else { events.push({ kind: 'status', side: sideName, text: `${name} is frozen solid.` }); return false; } }
  if ((creature.confusionTurns ?? 0) > 0) {
    creature.confusionTurns = Math.max(0, (creature.confusionTurns ?? 0) - 1);
    if (rng.next() < .5) {
      const amount = Math.min(creature.currentHp, confusionDamage(creature, species, rng));
      creature.currentHp -= amount;
      events.push({ kind: 'damage', side: sideName, amount, text: `${name} hurt itself in its confusion!` });
      if (!alive(creature)) events.push({ kind: 'faint', side: sideName, text: `${name} fainted!` });
      return false;
    }
    events.push({ kind: 'status', side: sideName, text: `${name} is confused!` });
  } else if (creature.confusionTurns === 0) { creature.confusionTurns = undefined; events.push({ kind: 'status', side: sideName, text: `${name} snapped out of confusion!` }); }
  if (creature.status === 'paralysis' && rng.next() < .25) { events.push({ kind: 'status', side: sideName, text: `${name} is paralyzed!` }); return false; } return true;
}
function applyStatus(target: CreatureInstance, status: Exclude<MajorStatus, null>, rng: Rng, toxic = false) { if (target.status) return false; target.status = status; target.toxicCounter = toxic ? 1 : 0; if (status === 'sleep') target.sleepTurns = rng.int(1, 4); return true; }

export function resolveTurn(context: BattleContext, playerAction: BattleAction, enemyAction: BattleAction, species: Record<string, SpeciesDefinition>, moves: Record<string, MoveDefinition>, rng: Rng): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (!alive(active(context.player)) && playerAction.kind === 'switch') {
    const next = context.player.party[playerAction.partyIndex]; if (next && alive(next) && playerAction.partyIndex !== context.player.active) { context.player.active = playerAction.partyIndex; context.player.stages = { ...BASE_STAGES }; events.push({ kind: 'switch', side: 'player', text: `Go ${displayName(next, species[next.speciesId])}!` }); } return events;
  }
  context.turn += 1; context.player.protected = false; context.enemy.protected = false;
  const pairs: Array<{ name: 'player' | 'enemy'; side: BattleSide; foeName: 'player' | 'enemy'; foe: BattleSide; action: BattleAction }> = [
    { name: 'player', side: context.player, foeName: 'enemy', foe: context.enemy, action: playerAction }, { name: 'enemy', side: context.enemy, foeName: 'player', foe: context.player, action: enemyAction },
  ];
  pairs.sort((a, b) => { const priority = actionPriority(b.action, b.side, moves) - actionPriority(a.action, a.side, moves); if (priority) return priority; const aSpeed = speed(a.side, species[active(a.side).speciesId], context.field.effect); const bSpeed = speed(b.side, species[active(b.side).speciesId], context.field.effect); return bSpeed === aSpeed ? (rng.next() < .5 ? -1 : 1) : bSpeed - aSpeed; });
  for (const turn of pairs) {
    if (context.ended || !alive(active(turn.side))) continue;
    const actor = active(turn.side); const actorSpecies = species[actor.speciesId]; const actorName = displayName(actor, actorSpecies); const target = active(turn.foe); const targetSpecies = species[target.speciesId]; const targetName = displayName(target, targetSpecies);
    if ((turn.action.kind === 'move' || turn.action.kind === 'struggle') && turn.side.participants && !turn.side.participants.includes(actor.uid)) turn.side.participants.push(actor.uid);
    if (turn.action.kind === 'switch') { const next = turn.side.party[turn.action.partyIndex]; if (next && alive(next) && turn.action.partyIndex !== turn.side.active) { turn.side.active = turn.action.partyIndex; turn.side.stages = { ...BASE_STAGES }; if(turn.name==='player'&&turn.side.participants&&!turn.side.participants.includes(next.uid))turn.side.participants.push(next.uid);events.push({ kind: 'switch', side: turn.name, text: `${turn.name === 'player' ? 'Go' : 'The foe sent out'} ${displayName(next, species[next.speciesId])}!` }); } continue; }
    if (turn.action.kind !== 'move' && turn.action.kind !== 'struggle' || !canAct(actor, actorSpecies, actorName, turn.name, rng, events)) continue;
    const known = turn.action.kind === 'move' ? actor.moves[turn.action.moveIndex] : undefined; const move = turn.action.kind === 'struggle' ? moves.struggle : known && moves[known.moveId];
    if (!move || turn.action.kind === 'move' && (!known || known.pp <= 0)) { events.push({ kind: 'text', side: turn.name, text: `${actorName} has no PP left!` }); continue; }
    if (known) known.pp -= 1; events.push({ kind: 'move', side: turn.name, moveId: move.id, text: `${actorName} used ${move.name}!` });
    if (!accuracyCheck(move, turn.side, turn.foe, rng)) { events.push({ kind: 'miss', side: turn.name, text: 'But it missed!' }); continue; }
    const effects = moveEffects(move); const hasProtect = effects.some((effect) => effect.kind === 'protect');
    if (!hasProtect) turn.side.protectStreak = 0;
    if (turn.foe.protected && move.target === 'foe' && !hasProtect) { events.push({ kind: 'text', side: turn.foeName, text: `${targetName} protected itself!` }); continue; }
    const summary = executeEffects(effects, {
      actor, target, actorSide: turn.side, targetSide: turn.foe, move, actorSpecies, targetSpecies, actorName, targetName,
      actorSideName: turn.name, targetSideName: turn.foeName, field: context.field, rng, events,
      maxHp: (creature, creatureSpecies) => calculateStats(creature, creatureSpecies).hp,
      damage: (effectiveMove) => damageRoll(actor, target, effectiveMove, actorSpecies, targetSpecies, turn.side.stages, turn.foe.stages, rng, context.field.effect),
      applyStatus: (creature, status, toxic) => applyStatus(creature, status, rng, toxic), canLowerStage: (creature) => !preventsStageChange(creature, move, -1),
    });
    if (summary.lastEffectiveness > 1) events.push({ kind: 'text', text: 'It is super effective!' });
    if (summary.lastEffectiveness < 1) events.push({ kind: 'text', text: 'It is not very effective…' });
    if (summary.totalDamage > 0 && gen3Category(move.type) === 'Physical' && actor.currentHp > 0) { const amount = afterDamageRecoil(target, actor, { ...move, category: 'Physical' }, summary.totalDamage, calculateStats(actor, actorSpecies).hp); if (amount > 0) { actor.currentHp -= amount; events.push({ kind: 'damage', side: turn.name, amount, text: `${actorName} was pricked by an ability!` }); } }
    if (!alive(target)) events.push({ kind: 'faint', side: turn.foeName, text: `${targetName} fainted!` }); if (!alive(actor)) events.push({ kind: 'faint', side: turn.name, text: `${actorName} fainted!` });
  }
  for (const [name, side] of [['player', context.player], ['enemy', context.enemy]] as const) {
    const creature = active(side); if (!alive(creature)) continue; const creatureName = displayName(creature, species[creature.speciesId]);
    if (creature.status === 'burn' || creature.status === 'poison') { const maxHp = calculateStats(creature, species[creature.speciesId]).hp; const toxic = creature.status === 'poison' && creature.toxicCounter > 0; const amount = toxic ? Math.max(1, Math.floor(maxHp * creature.toxicCounter / 16)) : Math.max(1, Math.floor(maxHp / 8)); creature.currentHp = Math.max(0, creature.currentHp - amount); if (toxic) creature.toxicCounter = Math.min(15, creature.toxicCounter + 1); events.push({ kind: 'damage', side: name, amount, text: `${creatureName} is hurt by ${creature.status}!` }); if (!alive(creature)) events.push({ kind: 'faint', side: name, text: `${creatureName} fainted!` }); }
    if (creature.status && resolveEndTurn(creature, rng)) events.push({ kind: 'status', side: name, text: `${creatureName}'s ability cured its status!` });
  }
  if (context.field.turns > 0 && --context.field.turns === 0) { context.field.effect = null; events.push({ kind: 'field', text: 'The field returned to normal.' }); }
  const playerAlive = context.player.party.some(alive); const enemyAlive = context.enemy.party.some(alive); if (!playerAlive || !enemyAlive) { context.ended = true; context.winner = playerAlive ? 'player' : 'enemy'; events.push({ kind: 'end', text: playerAlive ? 'You won the battle!' : 'Your party is unable to battle!' }); }
  return events;
}
