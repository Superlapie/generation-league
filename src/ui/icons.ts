import Phaser from 'phaser';

const ICON_NAMES = [
  'creatures', 'bag', 'guide', 'card', 'link', 'account', 'save', 'options',
  'fight', 'battle-bag', 'party', 'run',
  'move-physical', 'move-special', 'move-status',
  'medicine', 'capture', 'held', 'key',
  'seen', 'caught', 'unknown',
  'warning', 'success', 'empty', 'crest-empty', 'crest-filled',
] as const;

export function loadUiIcons(scene: Phaser.Scene): void {
  ICON_NAMES.forEach((name) => scene.load.image(`ui-icon-${name}`, `assets/ui/icons/${name}.png`));
}

export function configureUiIcons(scene: Phaser.Scene): void {
  ICON_NAMES.forEach((name) => {
    scene.textures.get(`ui-icon-${name}`).setFilter(Phaser.Textures.FilterMode.LINEAR);
  });
}

export const NAV_ICON_KEYS = [
  'ui-icon-creatures',
  'ui-icon-bag',
  'ui-icon-guide',
  'ui-icon-card',
  'ui-icon-link',
  'ui-icon-account',
  'ui-icon-save',
  'ui-icon-options',
] as const;

export const POCKET_ICON_KEYS = ['ui-icon-medicine', 'ui-icon-capture', 'ui-icon-held', 'ui-icon-key'] as const;

export const BATTLE_CMD_ICONS = ['ui-icon-fight', 'ui-icon-battle-bag', 'ui-icon-party', 'ui-icon-run'] as const;
