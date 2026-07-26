import { describe, expect, it } from 'vitest';
import { gameKeyForCode } from './controls';

describe('game controls', () => {
  it('maps Space to the field menu without changing confirm', () => {
    expect(gameKeyForCode('Space')).toBe('MENU');
    expect(gameKeyForCode('Enter')).toBe('A');
    expect(gameKeyForCode('KeyM')).toBe('MENU');
  });
});
