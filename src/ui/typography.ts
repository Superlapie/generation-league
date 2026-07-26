import Phaser from 'phaser';

/** Shared renderer-native typography roles for the 240×160 game UI. */
export type TextRole = 'pageTitle' | 'pageMeta' | 'panelTitle' | 'menuLabel' | 'body' | 'bodyMuted' | 'compact' | 'numeric' | 'badge' | 'dialogue' | 'tinyHint';

const UI_FONT = '"Segoe UI", Arial, sans-serif';
const ROLES: Record<TextRole, { size: number; color: string; fontStyle: string }> = {
  pageTitle: { size: 11, color: '#182017', fontStyle: '600' }, pageMeta: { size: 6, color: '#52665c', fontStyle: '500' },
  panelTitle: { size: 8, color: '#20342f', fontStyle: '600' }, menuLabel: { size: 7, color: '#20342f', fontStyle: '600' },
  body: { size: 7, color: '#20342f', fontStyle: '400' }, bodyMuted: { size: 6, color: '#52665c', fontStyle: '400' },
  compact: { size: 6, color: '#52665c', fontStyle: '500' }, numeric: { size: 6, color: '#59684f', fontStyle: '600' },
  badge: { size: 5, color: '#ffffff', fontStyle: '700' }, dialogue: { size: 7, color: '#182017', fontStyle: '400' }, tinyHint: { size: 5, color: '#b9c8ac', fontStyle: '600' },
};

export type UiLabel = Phaser.GameObjects.Text;

function spec(role: TextRole | number, color?: string) {
  const base = typeof role === 'number'
    ? { size: Math.max(5, Math.round(role)), color: '#182017', fontStyle: '600' }
    : ROLES[role];
  return { ...base, color: color ?? base.color };
}

export function textStyle(role: TextRole | number = 'body', colorOverride?: string): Phaser.Types.GameObjects.Text.TextStyle {
  const value = spec(role, colorOverride);
  return {
    fontFamily: UI_FONT,
    fontSize: `${value.size}px`,
    fontStyle: value.fontStyle,
    color: value.color,
    resolution: 4,
    lineSpacing: 1,
  };
}

export function addText(scene: Phaser.Scene, x: number, y: number, value: string, role: TextRole | number = 'body', color?: string, depth = 10): UiLabel {
  return scene.add.text(Math.round(x), Math.round(y), value, textStyle(role, color))
    .setDepth(depth).setOrigin(0, 0);
}

/** Deterministic wrapping keeps descriptions bounded across browsers and resolutions. */
export function wrapBitmapText(value: string, maxChars: number, maxLines?: number) {
  const lines: string[] = [];
  for (const paragraph of value.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && next.length > maxChars) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
  }
  return lines.slice(0, maxLines).join('\n');
}
