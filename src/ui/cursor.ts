import Phaser from 'phaser';
import { UI_COLORS, UI_DEPTH } from './theme';

export interface SelectionCursorOptions {
  depth?: number;
  rail?: boolean;
  brackets?: boolean;
  pulse?: boolean;
}

/** Draw corner brackets + optional left rail — no text-arrow cursors. */
export function drawSelectionCursor(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  selected: boolean,
  options: SelectionCursorOptions = {},
): Phaser.GameObjects.Graphics | null {
  if (!selected) return null;
  const depth = options.depth ?? UI_DEPTH.cursor;
  const g = scene.add.graphics().setDepth(depth);
  const rail = options.rail !== false;
  if (rail) {
    g.fillStyle(UI_COLORS.selectionRail, 1).fillRect(x, y + 2, 2, Math.max(1, h - 4));
  }
  g.lineStyle(1, UI_COLORS.accentGoldSoft, options.brackets === false ? 0.35 : 0.7)
    .strokeRect(x + 2, y, w - 2, h);
  g.fillStyle(0xffffff, 0.09).fillRect(x + 3, y + 1, w - 4, 1);
  return g;
}

export function selectionFill(selected: boolean, disabled = false): number {
  if (disabled) return UI_COLORS.recessed;
  if (selected) return UI_COLORS.selection;
  return UI_COLORS.paperWarm;
}

export function selectionTextColor(selected: boolean, disabled = false): string {
  if (disabled) return '#7a8a7a';
  if (selected) return '#ffffff';
  return '#20342f';
}

/** Tiny two-frame diamond pulse for focused tiles. */
export function addSelectionPulse(
  scene: Phaser.Scene,
  x: number,
  y: number,
  reducedMotion: boolean,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(UI_DEPTH.cursor + 1);
  const draw = (bright: boolean) => {
    g.clear();
    g.fillStyle(bright ? UI_COLORS.accentGold : UI_COLORS.accentLime, 1);
    g.fillRect(x, y + 5, 2, 2);
    g.fillRect(x + 1, y + 4, 1, 1);
    g.fillRect(x + 1, y + 6, 1, 1);
  };
  draw(true);
  if (!reducedMotion) {
    scene.tweens.add({
      targets: { v: 0 },
      v: 1,
      duration: 280,
      yoyo: true,
      repeat: -1,
      onUpdate: (_t, target) => draw((target as { v: number }).v < 0.5),
    });
  }
  return g;
}
