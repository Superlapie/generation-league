import { describe, expect, it } from 'vitest';
import type { TrainerDefinition } from './types';
import { facingFlipX, facingFrame, terrain3x3Frame, trainerHasLineOfSight, walkFrames, walkStepFrames } from './world';

const trainer = (facing: TrainerDefinition['facing']): TrainerDefinition => ({
  id: 't', x: 5, y: 5, name: 'Scout', dialogue: [], sprite: 'rival', facing,
  party: [], sight: 4, flag: 'defeated:t', reward: 1,
});

describe('overworld facing', () => {
  it('maps each direction to the first frame of its sheet row', () => {
    expect([facingFrame('down'), facingFrame('up'), facingFrame('left'), facingFrame('right')]).toEqual([0, 4, 8, 12]);
  });

  it('does not flip sheets that already include left and right rows', () => {
    expect(facingFlipX('left')).toBe(false);
    expect(facingFlipX('right')).toBe(false);
  });

  it('builds four-frame walk cycles from each direction row', () => {
    expect(walkFrames('up')).toEqual([4, 5, 6, 7]);
    expect(walkFrames('left')).toEqual([8, 9, 10, 11]);
  expect(walkFrames('right')).toEqual([12, 13, 14, 15]);
  expect(walkStepFrames('down', 0)).toEqual([0, 1]);
  expect(walkStepFrames('down', 1)).toEqual([2, 3]);
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
