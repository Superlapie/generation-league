import type Phaser from 'phaser';
import type { Direction, TrainerDefinition } from './types';

export const DIRECTION_DELTAS: Record<Direction, [number, number]> = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
};

/** 4x4 sheet: row 0 down, row 1 up, row 2 left, row 3 right. */
const DIRECTION_FRAME_BASE: Record<Direction, number> = { down: 0, up: 4, left: 8, right: 12 };

export const facingFrame = (direction: Direction) => DIRECTION_FRAME_BASE[direction];
export const facingFlipX = (_direction: Direction) => false;

export const walkFrames = (direction: Direction) => {
  const base = DIRECTION_FRAME_BASE[direction];
  return [base, base + 1, base + 2, base + 3];
};

export const walkStepFrames = (direction: Direction, phase: 0 | 1): [number, number] => {
  const frames = walkFrames(direction);
  return phase === 0 ? [frames[0], frames[1]] : [frames[2], frames[3]];
};

export const applyFacing = (sprite: Phaser.GameObjects.Sprite, direction: Direction) => {
  sprite.setFrame(facingFrame(direction));
  sprite.setFlipX(false);
  return sprite;
};

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
