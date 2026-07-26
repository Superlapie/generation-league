import { describe, expect, it } from 'vitest';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, pickDesktopScale, pickFitScale, pickIntegerScale } from './gameScale';

describe('pickIntegerScale', () => {
  it('uses the largest integer scale that fits both axes', () => {
    expect(pickIntegerScale(1012, 665)).toBe(2);
    expect(pickIntegerScale(480, 320)).toBe(1);
    expect(pickIntegerScale(1566, 977)).toBe(3);
    expect(pickIntegerScale(4000, 4000)).toBe(3);
    expect(INTERNAL_WIDTH * 2).toBe(960);
    expect(INTERNAL_HEIGHT * 2).toBe(640);
    expect(INTERNAL_WIDTH * 3).toBe(1440);
    expect(INTERNAL_HEIGHT * 3).toBe(960);
  });
});

describe('pickDesktopScale', () => {
  it('uses a deliberate 1.5x compact-shell step before falling back to 1x', () => {
    expect(pickDesktopScale(1014, 501)).toBe(1.5);
    expect(pickDesktopScale(1366, 768)).toBe(2);
    expect(pickDesktopScale(600, 400)).toBe(1);
  });
});

describe('pickFitScale', () => {
  it('fills until the first boundary is reached', () => {
    const frameScale = pickFitScale(1012, 665);
    expect(frameScale).toBeCloseTo(2.078125, 5);
    expect(Math.round(480 * frameScale)).toBe(998);
    expect(Math.round(320 * frameScale)).toBe(665);
  });

  it('allows a fractional phone fit without horizontal overflow', () => {
    expect(pickFitScale(366, 244)).toBeCloseTo(366 / 480, 5);
  });
});
