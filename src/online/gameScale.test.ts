import { describe, expect, it } from 'vitest';
import { pickFitScale, pickIntegerScale } from './gameScale';

describe('pickIntegerScale', () => {
  it('uses the largest integer scale that fits both axes', () => {
    expect(pickIntegerScale(1012, 665)).toBe(2);
    expect(pickIntegerScale(480, 320)).toBe(1);
    expect(pickIntegerScale(1566, 977)).toBe(3);
  });
});

describe('pickFitScale', () => {
  it('fills until the first boundary is reached', () => {
    const frameScale = pickFitScale(1012, 665);
    expect(frameScale).toBeCloseTo(2.078125, 5);
    expect(Math.round(480 * frameScale)).toBe(998);
    expect(Math.round(320 * frameScale)).toBe(665);
  });
});
