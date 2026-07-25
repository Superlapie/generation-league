import { describe, expect, it } from 'vitest';
import { ROOT_ENTRIES, POCKET_DEFS, arenaPaletteForMap } from './constants';
import { gridCell, pageWindow, ROOT_GRID } from './layout';
import { hpColor, typeColor, UI_COLORS } from './theme';
import { selectionFill, selectionTextColor } from './cursor';
import { shouldShowTouchControls } from './touchControls';

describe('Phaser UI system', () => {
  it('defines root menu entries without a dedicated close tile', () => {
    expect(ROOT_ENTRIES.map((e) => e.id)).toEqual([
      'CREATURES', 'BAG', 'FIELD GUIDE', 'PLAYER CARD', 'LEAGUE LINK', 'ACCOUNT', 'SAVE', 'OPTIONS',
    ]);
    expect(ROOT_ENTRIES).toHaveLength(8);
  });

  it('lays out root navigation in a 2-column grid', () => {
    const first = gridCell(ROOT_GRID, 0, 4);
    const second = gridCell(ROOT_GRID, 1, 4);
    expect(second.x).toBeGreaterThan(first.x);
    expect(second.y).toBe(first.y);
    const third = gridCell(ROOT_GRID, 2, 4);
    expect(third.y).toBeGreaterThan(first.y);
  });

  it('computes list windows for pagination', () => {
    expect(pageWindow(5, 20, 7)).toEqual({ start: 2, end: 9 });
    expect(pageWindow(1, 3, 7)).toEqual({ start: 0, end: 3 });
  });

  it('maps bag pockets to icon keys', () => {
    expect(POCKET_DEFS.map((p) => p.id)).toEqual(['recovery', 'capture', 'held', 'key']);
    POCKET_DEFS.forEach((p) => expect(p.icon).toMatch(/^ui-icon-/));
  });

  it('returns HP threshold colors', () => {
    expect(hpColor(0.8)).toBe(UI_COLORS.success);
    expect(hpColor(0.3)).toBe(UI_COLORS.warning);
    expect(hpColor(0.1)).toBe(UI_COLORS.danger);
  });

  it('distinguishes selected and disabled row fills', () => {
    expect(selectionFill(true)).not.toBe(selectionFill(false));
    expect(selectionFill(false, true)).not.toBe(selectionFill(false));
    expect(selectionTextColor(true)).not.toBe(selectionTextColor(false, true));
  });

  it('selects arena palette from map context', () => {
    expect(arenaPaletteForMap('mossmere')).toBe('verdant');
    expect(arenaPaletteForMap('cinder-trail')).toBe('ember');
    expect(arenaPaletteForMap('reedwater')).toBe('tide');
    expect(typeColor('Verdant')).toBeGreaterThan(0);
  });

  it('evaluates touch control visibility from environment', () => {
    expect(typeof shouldShowTouchControls()).toBe('boolean');
  });
});
