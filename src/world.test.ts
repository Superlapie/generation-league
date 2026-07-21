import { describe, expect, it } from 'vitest';
import type { TrainerDefinition } from './types';
import { facingFrame, terrain3x3Frame, trainerHasLineOfSight } from './world';

const trainer = (facing: TrainerDefinition['facing']): TrainerDefinition => ({
  id: 't', x: 5, y: 5, name: 'Scout', dialogue: [], sprite: 'trainer', facing,
  party: [], sight: 4, flag: 'defeated:t', reward: 1,
});

describe('overworld facing', () => {
  it('maps the sprite-sheet columns to visible directions', () => {
    expect([facingFrame('down'), facingFrame('up'), facingFrame('left'), facingFrame('right')]).toEqual([0, 1, 2, 3]);
  });

  it('only detects the player in the direction the trainer visibly faces', () => {
    expect(trainerHasLineOfSight(trainer('left'), 2, 5, () => false)).toBe(true);
    expect(trainerHasLineOfSight(trainer('left'), 8, 5, () => false)).toBe(false);
    expect(trainerHasLineOfSight(trainer('right'), 8, 5, () => false)).toBe(true);
  });

  it('stops sight at blocked map tiles', () => {
    expect(trainerHasLineOfSight(trainer('left'), 2, 5, (x) => x === 4)).toBe(false);
  });
});

describe('terrain autotiling', () => {
  it('chooses matching center, edge, and corner frames from a 3x3 terrain block', () => {
    expect(terrain3x3Frame(0, 7, {up:true,right:true,down:true,left:true})).toBe(177);
    expect(terrain3x3Frame(0, 7, {up:false,right:true,down:true,left:true})).toBe(155);
    expect(terrain3x3Frame(0, 7, {up:false,right:true,down:true,left:false})).toBe(154);
  });
});
