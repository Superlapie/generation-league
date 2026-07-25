/** Generation League Phaser UI system — re-exports for scene compatibility. */

export * from './theme';
export * from './layout';
export * from './typography';
export * from './cursor';
export * from './primitives';
export * from './icons';
export * from './transition';
export * from './touchControls';
export * from './menuComponents';
export * from './battleComponents';
export { ROOT_ENTRIES, POCKET_DEFS, arenaPaletteForMap } from './constants';

// Legacy single-file API
export { COLORS, hpColor } from './theme';
export { panel, label, textStyle, button } from './primitives';
export { UI_COLORS } from './theme';
