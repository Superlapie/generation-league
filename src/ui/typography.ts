import Phaser from 'phaser';

/** Pixel font family — loaded via CSS @font-face and BootScene. */
export const PIXEL_FONT = '"Generation Pixel", "Press Start 2P", "Courier New", monospace';

export type TextRole =
  | 'pageTitle'
  | 'pageMeta'
  | 'panelTitle'
  | 'menuLabel'
  | 'body'
  | 'bodyMuted'
  | 'compact'
  | 'numeric'
  | 'badge'
  | 'dialogue'
  | 'tinyHint';

const ROLE_STYLES: Record<TextRole, { size: number; color: string; bold?: boolean }> = {
  pageTitle: { size: 11, color: '#182c2c', bold: true },
  pageMeta: { size: 7, color: '#52665c', bold: true },
  panelTitle: { size: 9, color: '#20342f', bold: true },
  menuLabel: { size: 8, color: '#20342f', bold: true },
  body: { size: 8, color: '#20342f' },
  bodyMuted: { size: 7, color: '#52665c' },
  compact: { size: 6, color: '#52665c' },
  numeric: { size: 7, color: '#59684f', bold: true },
  badge: { size: 5, color: '#ffffff', bold: true },
  dialogue: { size: 8, color: '#182017' },
  tinyHint: { size: 6, color: '#b9c8ac' },
};

const styleCache = new Map<string, Phaser.Types.GameObjects.Text.TextStyle>();

export function textStyle(role: TextRole | number = 'body', colorOverride?: string): Phaser.Types.GameObjects.Text.TextStyle {
  const spec = typeof role === 'number'
    ? { size: role, color: colorOverride ?? '#182017', bold: role <= 8 }
    : { ...ROLE_STYLES[role], color: colorOverride ?? ROLE_STYLES[role].color };
  const key = `${spec.size}:${spec.color}:${spec.bold}`;
  let cached = styleCache.get(key);
  if (!cached) {
    cached = {
      fontFamily: PIXEL_FONT,
      fontSize: `${Math.max(5, spec.size)}px`,
      fontStyle: spec.bold ? 'bold' : 'normal',
      color: spec.color,
      resolution: 4,
      lineSpacing: 1,
    };
    styleCache.set(key, cached);
  }
  return cached;
}

export function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  role: TextRole | number = 'body',
  color?: string,
  depth: number = 10,
): Phaser.GameObjects.Text {
  return scene.add.text(Math.round(x), Math.round(y), value, textStyle(role, color))
    .setDepth(depth)
    .setOrigin(0, 0);
}

/** Load pixel font before scenes render UI text. */
export async function ensurePixelFont(): Promise<void> {
  if (typeof document === 'undefined') return;
  try {
    await document.fonts.load('8px "Generation Pixel"');
  } catch {
    /* fallback family still works */
  }
}
