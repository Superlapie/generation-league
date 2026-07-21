import type { Direction, TrainerDefinition } from './types';

export const DIRECTION_DELTAS: Record<Direction, [number, number]> = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
};

export const facingFrame = (direction: Direction) => ({ down: 0, up: 1, left: 2, right: 3 })[direction];
export const oppositeDirection = (direction: Direction): Direction => ({ down: 'up', up: 'down', left: 'right', right: 'left' })[direction] as Direction;

export type CardinalNeighbors = { up: boolean; right: boolean; down: boolean; left: boolean };

export function terrain3x3Frame(baseX: number, baseY: number, neighbors: CardinalNeighbors) {
  const { up, right, down, left } = neighbors;
  let column = 1;
  let row = 1;
  if (!left && !right) row = !up ? 0 : !down ? 2 : 1;
  else if (!up && !down) column = !left ? 0 : !right ? 2 : 1;
  else {
    if (!left) column = 0;
    else if (!right) column = 2;
    if (!up) row = 0;
    else if (!down) row = 2;
  }
  return (baseY + row) * 22 + baseX + column;
}

export function trainerHasLineOfSight(
  trainer: TrainerDefinition,
  playerX: number,
  playerY: number,
  blocked: (x: number, y: number) => boolean,
) {
  const [dx, dy] = DIRECTION_DELTAS[trainer.facing];
  const offsetX = playerX - trainer.x;
  const offsetY = playerY - trainer.y;
  const distance = Math.abs(offsetX) + Math.abs(offsetY);
  if (!distance || distance > trainer.sight) return false;
  if (dx && (offsetY !== 0 || Math.sign(offsetX) !== dx)) return false;
  if (dy && (offsetX !== 0 || Math.sign(offsetY) !== dy)) return false;
  for (let step = 1; step < distance; step += 1) if (blocked(trainer.x + dx * step, trainer.y + dy * step)) return false;
  return true;
}
