import Phaser from 'phaser';

type IconDraw = (g: Phaser.GameObjects.Graphics) => void;

const ICON_SIZE = 10;

function makeIcon(scene: Phaser.Scene, key: string, draw: IconDraw, size = ICON_SIZE) {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, size, size);
  g.destroy();
}

const PAL = {
  ink: 0x182017,
  lime: 0xb9ca68,
  teal: 0x5b8f94,
  gold: 0xd2af42,
  paper: 0xf1f1d0,
  danger: 0xb74635,
  success: 0x5ca85c,
};

export function registerUiIcons(scene: Phaser.Scene): void {
  // Navigation
  makeIcon(scene, 'ui-icon-creatures', (g) => {
    g.fillStyle(PAL.teal).fillCircle(5, 6, 4);
    g.fillStyle(PAL.lime).fillCircle(5, 4, 2);
    g.fillStyle(PAL.ink).fillRect(3, 8, 4, 1);
  });
  makeIcon(scene, 'ui-icon-bag', (g) => {
    g.fillStyle(PAL.gold).fillRect(2, 3, 6, 6);
    g.fillStyle(PAL.ink).fillRect(4, 1, 2, 2);
    g.lineStyle(1, PAL.ink).strokeRect(2, 3, 6, 6);
  });
  makeIcon(scene, 'ui-icon-guide', (g) => {
    g.fillStyle(PAL.paper).fillRect(2, 1, 6, 8);
    g.fillStyle(PAL.teal).fillRect(3, 3, 4, 1).fillRect(3, 5, 3, 1);
    g.lineStyle(1, PAL.ink).strokeRect(2, 1, 6, 8);
  });
  makeIcon(scene, 'ui-icon-card', (g) => {
    g.fillStyle(PAL.paper).fillRect(1, 2, 8, 6);
    g.fillStyle(PAL.lime).fillRect(2, 3, 3, 2);
    g.fillStyle(PAL.gold).fillRect(6, 4, 2, 3);
    g.lineStyle(1, PAL.ink).strokeRect(1, 2, 8, 6);
  });
  makeIcon(scene, 'ui-icon-link', (g) => {
    g.lineStyle(2, PAL.lime).beginPath().arc(3, 5, 2, 0, Math.PI * 2).strokePath();
    g.lineStyle(2, PAL.teal).beginPath().arc(7, 5, 2, 0, Math.PI * 2).strokePath();
  });
  makeIcon(scene, 'ui-icon-save', (g) => {
    g.fillStyle(PAL.teal).fillRect(2, 1, 6, 8);
    g.fillStyle(PAL.paper).fillRect(3, 2, 4, 2);
    g.fillStyle(PAL.lime).fillRect(3, 5, 4, 3);
  });
  makeIcon(scene, 'ui-icon-account', (g) => {
    g.fillStyle(PAL.teal).fillCircle(5, 3, 2);
    g.fillStyle(PAL.teal).fillRect(2, 6, 6, 3);
  });
  makeIcon(scene, 'ui-icon-options', (g) => {
    g.fillStyle(PAL.gold).fillCircle(5, 5, 2);
    g.fillStyle(PAL.ink).fillRect(5, 1, 1, 2).fillRect(5, 7, 1, 2).fillRect(1, 5, 2, 1).fillRect(7, 5, 2, 1);
  });

  // Battle commands
  makeIcon(scene, 'ui-icon-fight', (g) => {
    g.fillStyle(PAL.danger).fillTriangle(2, 8, 5, 1, 8, 8);
    g.fillStyle(PAL.gold).fillRect(4, 4, 2, 3);
  });
  makeIcon(scene, 'ui-icon-battle-bag', (g) => {
    g.fillStyle(PAL.gold).fillRect(1, 4, 8, 5);
    g.fillStyle(PAL.teal).fillRect(3, 2, 4, 2);
  });
  makeIcon(scene, 'ui-icon-party', (g) => {
    g.fillStyle(PAL.lime).fillCircle(3, 5, 2);
    g.fillStyle(PAL.teal).fillCircle(7, 5, 2);
    g.fillStyle(PAL.success).fillCircle(5, 3, 2);
  });
  makeIcon(scene, 'ui-icon-run', (g) => {
    g.fillStyle(PAL.paper).fillTriangle(2, 5, 7, 2, 7, 8);
    g.fillStyle(PAL.danger).fillRect(2, 4, 2, 2);
  });

  // Move categories
  makeIcon(scene, 'ui-icon-move-physical', (g) => {
    g.fillStyle(PAL.danger).fillRect(2, 2, 6, 2).fillRect(4, 1, 2, 8);
  });
  makeIcon(scene, 'ui-icon-move-special', (g) => {
    g.fillStyle(PAL.teal).fillCircle(5, 5, 3);
    g.fillStyle(PAL.lime).fillCircle(5, 5, 1);
  });
  makeIcon(scene, 'ui-icon-move-status', (g) => {
    g.fillStyle(PAL.gold).fillCircle(5, 5, 3);
    g.lineStyle(1, PAL.ink).strokeCircle(5, 5, 3);
  });

  // Bag pockets
  makeIcon(scene, 'ui-icon-medicine', (g) => {
    g.fillStyle(PAL.teal).fillRect(3, 1, 4, 8);
    g.fillStyle(PAL.success).fillRect(2, 4, 6, 3);
    g.fillStyle(PAL.paper).fillRect(4, 2, 2, 2);
  });
  makeIcon(scene, 'ui-icon-capture', (g) => {
    g.lineStyle(2, PAL.teal).strokeCircle(5, 5, 4);
    g.fillStyle(PAL.lime).fillCircle(5, 5, 2);
  });
  makeIcon(scene, 'ui-icon-held', (g) => {
    g.lineStyle(2, PAL.gold).strokeCircle(5, 5, 4);
    g.fillStyle(PAL.gold).fillTriangle(5, 2, 8, 7, 2, 7);
  });
  makeIcon(scene, 'ui-icon-key', (g) => {
    g.fillStyle(PAL.gold).fillCircle(3, 3, 2);
    g.fillStyle(PAL.gold).fillRect(4, 4, 5, 2).fillRect(7, 3, 2, 3);
  });

  // Guide
  makeIcon(scene, 'ui-icon-seen', (g) => {
    g.fillStyle(PAL.teal).fillCircle(5, 5, 3);
    g.fillStyle(PAL.paper).fillRect(3, 5, 4, 1);
  });
  makeIcon(scene, 'ui-icon-caught', (g) => {
    g.fillStyle(PAL.gold).fillCircle(5, 5, 3);
    g.fillStyle(PAL.ink).fillRect(3, 5, 4, 1).fillRect(5, 3, 1, 4);
  });
  makeIcon(scene, 'ui-icon-unknown', (g) => {
    g.fillStyle(PAL.ink).fillRect(3, 3, 4, 4);
    g.fillStyle(PAL.paper).fillRect(4, 4, 2, 2);
  });

  // System
  makeIcon(scene, 'ui-icon-warning', (g) => {
    g.fillStyle(PAL.gold).fillTriangle(5, 1, 9, 9, 1, 9);
    g.fillStyle(PAL.ink).fillRect(4, 4, 2, 3).fillRect(4, 8, 2, 1);
  });
  makeIcon(scene, 'ui-icon-success', (g) => {
    g.fillStyle(PAL.success).fillCircle(5, 5, 4);
    g.lineStyle(1, PAL.paper).beginPath().moveTo(3, 5).lineTo(5, 7).lineTo(8, 3).strokePath();
  });
  makeIcon(scene, 'ui-icon-empty', (g) => {
    g.lineStyle(1, PAL.teal).strokeRect(2, 2, 6, 6);
    g.lineStyle(1, PAL.teal).beginPath().moveTo(3, 3).lineTo(7, 7).strokePath();
  });

  // Crest socket
  makeIcon(scene, 'ui-icon-crest-empty', (g) => {
    g.lineStyle(1, PAL.teal).strokeCircle(5, 5, 4);
    g.fillStyle(PAL.ink, 0.3).fillCircle(5, 5, 3);
  }, 16);
  makeIcon(scene, 'ui-icon-crest-filled', (g) => {
    g.fillStyle(PAL.gold).fillCircle(5, 5, 4);
    g.fillStyle(PAL.lime).fillCircle(5, 5, 2);
  }, 16);

  Object.values(scene.textures.list).forEach((tex) => {
    if (tex.key.startsWith('ui-icon-')) tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
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
