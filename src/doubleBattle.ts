import { MOVES } from './data';
import { calculateStats, damageRoll, typeEffectiveness, type Rng } from './rules';
import type { BattleAction, BattleEvent, DoubleBattleSide, MoveDefinition, SpeciesDefinition } from './types';
import type { CreatureInstance } from './types';

export interface DoubleBattleState {
  player: DoubleBattleSide;
  enemy: DoubleBattleSide;
  field: { effect: MoveDefinition['field'] | null; turns: number };
  turn: number;
  ended: boolean;
  winner: 'player' | 'enemy' | null;
}

export interface DoubleAction {
  side: 'player' | 'enemy';
  slot: 0 | 1;
  action: BattleAction;
  targetSlot?: 0 | 1;
}

function alive(creature: CreatureInstance | undefined) { return Boolean(creature && creature.currentHp > 0); }
function active(side: DoubleBattleSide, slot: 0 | 1) { return side.party[side.activeSlots[slot]]; }
function view(side: DoubleBattleSide, slot: 0 | 1) { return { ...side, active: side.activeSlots[slot] }; }
function actionPriority(action: BattleAction, side: DoubleBattleSide, slot: 0 | 1, moves: Record<string, MoveDefinition>) {
  if (action.kind === 'move') {
    const moveId = active(side, slot)?.moves[action.moveIndex]?.moveId;
    return moveId ? moves[moveId]?.priority ?? 0 : 0;
  }
  if (action.kind === 'item') return 6;
  return action.kind === 'struggle' ? 0 : 6;
}

export function resolveDoubleTurn(
  state: DoubleBattleState,
  actions: DoubleAction[],
  species: Record<string, SpeciesDefinition>,
  moves: Record<string, MoveDefinition> = MOVES,
  rng: Rng,
): BattleEvent[] {
  const events: BattleEvent[] = [];
  state.turn += 1;
  state.player.protected = false;
  state.enemy.protected = false;
  if (state.player.protectedSlots) state.player.protectedSlots = [false, false];
  if (state.enemy.protectedSlots) state.enemy.protectedSlots = [false, false];
  const ordered = [...actions].sort((left, right) => {
    const leftSide = left.side === 'player' ? state.player : state.enemy;
    const rightSide = right.side === 'player' ? state.player : state.enemy;
    const priority = actionPriority(right.action, rightSide, right.slot, moves) - actionPriority(left.action, leftSide, left.slot, moves);
    if (priority) return priority;
    const leftCreature = active(leftSide, left.slot); const rightCreature = active(rightSide, right.slot);
    const leftSpeed = leftCreature ? calculateStats(leftCreature, species[leftCreature.speciesId]).speed : -1;
    const rightSpeed = rightCreature ? calculateStats(rightCreature, species[rightCreature.speciesId]).speed : -1;
    return rightSpeed === leftSpeed ? (rng.next() < .5 ? -1 : 1) : rightSpeed - leftSpeed;
  });

  for (const turn of ordered) {
    const side = turn.side === 'player' ? state.player : state.enemy;
    const foe = turn.side === 'player' ? state.enemy : state.player;
    const actor = active(side, turn.slot);
    if (!alive(actor)) continue;
    if (turn.action.kind === 'switch') {
      const next = side.party[turn.action.partyIndex];
      if (alive(next) && !side.activeSlots.includes(turn.action.partyIndex)) {
        side.activeSlots[turn.slot] = turn.action.partyIndex;
        side.stages = { ...side.stages, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0, accuracy: 0, evasion: 0 };
        events.push({ kind: 'switch', side: turn.side, text: `${turn.side === 'player' ? 'Go' : 'The foe sent out'} ${species[next.speciesId].name}!` });
      }
      continue;
    }
    if (turn.action.kind === 'item') continue;
    const known = turn.action.kind === 'move' ? actor.moves[turn.action.moveIndex] : undefined;
    const move = turn.action.kind === 'struggle' ? moves.struggle : known && moves[known.moveId];
    if (!move || (known && known.pp <= 0)) { events.push({ kind: 'text', side: turn.side, text: 'That move has no PP left!' }); continue; }
    if (known) known.pp -= 1;
    events.push({ kind: 'move', side: turn.side, moveId: move.id, text: `${species[actor.speciesId].name} used ${move.name}!` });
    const targetSlots = move.target === 'allFoes' ? ([0, 1] as const) : ([turn.targetSlot ?? 0] as const);
    let landed = false;
    for (const targetSlot of targetSlots) {
      const target = active(foe, targetSlot);
      if (!alive(target)) continue;
      if (move.accuracy > 0 && rng.next() * 100 >= move.accuracy) continue;
      if ((foe.protectedSlots?.[targetSlot] ?? foe.protected) && move.target !== 'self') { events.push({ kind: 'text', side: turn.side === 'player' ? 'enemy' : 'player', text: `${species[target.speciesId].name} protected itself!` }); continue; }
      landed = true;
      if (move.power > 0) {
        const result = damageRoll(actor, target, move, species[actor.speciesId], species[target.speciesId], view(side, turn.slot).stages, view(foe, targetSlot).stages, rng, state.field.effect);
        const spreadDamage = move.target === 'allFoes' ? Math.max(1, Math.floor(result.damage * .75)) : result.damage;
        target.currentHp = Math.max(0, target.currentHp - spreadDamage);
        events.push({ kind: 'damage', side: turn.side, amount: spreadDamage, effectiveness: result.effectiveness, text: `${species[target.speciesId].name} took ${spreadDamage} damage.` });
        if (!alive(target)) events.push({ kind: 'faint', side: turn.side === 'player' ? 'enemy' : 'player', text: `${species[target.speciesId].name} fainted!` });
      }
    }
    if (!landed && move.accuracy > 0) events.push({ kind: 'miss', side: turn.side, text: 'But it missed!' });
    if (move.power === 0 && move.effects?.some((effect) => effect.kind === 'protect')) {
      if (side.protectedSlots) side.protectedSlots[turn.slot] = true;
      side.protected = true;
      events.push({ kind: 'status', side: turn.side, text: `${species[actor.speciesId].name} braced itself.` });
    }
  }
  const playerAlive = state.player.activeSlots.some((slot) => alive(active(state.player, slot as 0 | 1))) || state.player.party.some(alive);
  const enemyAlive = state.enemy.activeSlots.some((slot) => alive(active(state.enemy, slot as 0 | 1))) || state.enemy.party.some(alive);
  if (!playerAlive || !enemyAlive) { state.ended = true; state.winner = playerAlive ? 'player' : 'enemy'; events.push({ kind: 'end', text: playerAlive ? 'You won the double battle!' : 'Your party is unable to battle!' }); }
  return events;
}

export function doubleTypePreview(move: MoveDefinition, target: SpeciesDefinition) { return typeEffectiveness(move.type, target); }
