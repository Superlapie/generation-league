import Phaser from 'phaser';
import type { CreatureInstance } from '../types';
import { ITEMS, MOVES, SPECIES } from '../data';
import { calculateStats } from '../rules';
import { UI_COLORS } from './theme';
import { BATTLE_CMD_GRID, gridCell, pageWindow } from './layout';
import { BATTLE_CMD_ICONS } from './icons';
import { addText, wrapBitmapText } from './typography';
import {
  drawHpMeter, keep, type UiSink,
} from './primitives';
import { renderItemIcon } from './menuComponents';
import { drawSelectionCursor } from './cursor';

import { arenaPaletteForMap, type ArenaPalette } from './constants';

const ARENA_PALETTES: Record<ArenaPalette, { skyTop: number; skyBot: number; ground: number; platform: number; accent: number }> = {
  verdant: { skyTop: 0x8ec4a8, skyBot: 0xdce8b8, ground: 0xe8e6c8, platform: 0x6a9e62, accent: 0x4a7a52 },
  ember: { skyTop: 0xc48868, skyBot: 0xe8c8a0, ground: 0xd8c0a0, platform: 0x9a6048, accent: 0x6a4030 },
  tide: { skyTop: 0x78b8c8, skyBot: 0xc8e8e0, ground: 0xd0e0d8, platform: 0x5a98a8, accent: 0x3a6878 },
  cave: { skyTop: 0x5a5850, skyBot: 0x8a8878, ground: 0x706858, platform: 0x4a4840, accent: 0x2a2820 },
  trainer: { skyTop: 0x90a8b0, skyBot: 0xd0d8c0, ground: 0xc8d0b8, platform: 0x688878, accent: 0x485858 },
};

export { arenaPaletteForMap };

export function drawBattleArena(scene: Phaser.Scene, palette: ArenaPalette = 'verdant'): Phaser.GameObjects.Graphics {
  const p = ARENA_PALETTES[palette];
  const g = scene.add.graphics();
  g.fillGradientStyle(p.skyTop, p.skyTop, p.skyBot, p.skyBot, 1).fillRect(0, 0, 240, 108);
  for (let y = 4; y < 105; y += 6) g.fillStyle(0xffffff, 0.06).fillRect(0, y, 240, 1);
  g.fillStyle(p.ground, 1).fillRect(0, 108, 240, 52);
  g.fillStyle(p.platform, 0.38).fillEllipse(178, 66, 88, 18);
  g.fillStyle(p.accent, 0.5).fillEllipse(62, 116, 118, 26);
  g.fillStyle(UI_COLORS.borderDeep, 0.6).fillRect(0, 107, 240, 2);
  g.fillStyle(p.accent, 0.25).fillRect(0, 109, 240, 3);
  return g;
}

export interface StatusPanelRefs {
  nameText: Phaser.GameObjects.Text;
  statusText: Phaser.GameObjects.Text;
  hpText?: Phaser.GameObjects.Text;
  hpMeter: ReturnType<typeof drawHpMeter>;
  partyDots?: Phaser.GameObjects.Arc[];
}

export function drawEnemyStatusPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  name: string,
  level: number,
  ratio: number,
): StatusPanelRefs {
  const panel = scene.add.graphics().setDepth(8);
  panel.fillStyle(UI_COLORS.shadow, 0.42).fillRect(x + 2, y + 2, 112, 32);
  panel.fillStyle(UI_COLORS.surfaceDark, 0.96).fillRect(x, y, 112, 32);
  panel.lineStyle(1, UI_COLORS.borderLight, 0.75).strokeRect(x, y, 112, 32);
  panel.fillStyle(UI_COLORS.accentGold, 1).fillRect(x, y, 2, 32);
  panel.fillStyle(0xffffff, 0.07).fillRect(x + 2, y + 1, 109, 1);
  const nameText = addText(scene, x + 7, y + 5, `${name.toUpperCase()}  Lv${level}`, 'menuLabel', '#f1f1d0', 10);
  const statusText = addText(scene, x + 105, y + 5, '', 'badge', '#9f4034', 10).setOrigin(1, 0);
  addText(scene, x + 7, y + 21, 'HP', 'badge', '#d2af42', 10);
  const hpMeter = drawHpMeter(scene, x + 22, y + 22, 82, 5, ratio, 10);
  return { nameText, statusText, hpMeter };
}

export function drawPlayerStatusPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  name: string,
  level: number,
  ratio: number,
  currentHp: number,
  maxHp: number,
  party: CreatureInstance[],
): StatusPanelRefs {
  const panel = scene.add.graphics().setDepth(8);
  panel.fillStyle(UI_COLORS.shadow, 0.42).fillRect(x + 2, y + 2, 108, 34);
  panel.fillStyle(UI_COLORS.surfaceDark, 0.96).fillRect(x, y, 108, 34);
  panel.lineStyle(1, UI_COLORS.borderLight, 0.75).strokeRect(x, y, 108, 34);
  panel.fillStyle(UI_COLORS.accentTeal, 1).fillRect(x, y, 2, 34);
  panel.fillStyle(0xffffff, 0.07).fillRect(x + 2, y + 1, 105, 1);
  const nameText = addText(scene, x + 7, y + 5, `${name.toUpperCase()}  Lv${level}`, 'menuLabel', '#f1f1d0', 10);
  const statusText = addText(scene, x + 101, y + 5, '', 'badge', '#9f4034', 10).setOrigin(1, 0);
  addText(scene, x + 7, y + 21, 'HP', 'badge', '#6eaaa0', 10);
  const hpMeter = drawHpMeter(scene, x + 22, y + 22, 72, 5, ratio, 10);
  const hpText = addText(scene, x + 101, y + 27, `${currentHp}/${maxHp}`, 'compact', '#b7c7b8', 10).setOrigin(1, 0);
  const partyDots = party.map((c, i) =>
    scene.add.circle(x + 8 + i * 7, y + 30, 2, c.currentHp > 0 ? UI_COLORS.accentGold : UI_COLORS.disabled)
      .setStrokeStyle(1, UI_COLORS.borderDeep).setDepth(10),
  );
  return { nameText, statusText, hpText, hpMeter, partyDots };
}

export function drawBattleDialogue(scene: Phaser.Scene): Phaser.GameObjects.Text {
  const panel = scene.add.graphics().setDepth(15);
  panel.fillStyle(UI_COLORS.shadow, 0.45).fillRect(4, 115, 234, 43);
  panel.fillStyle(UI_COLORS.surfaceDark, 0.97).fillRect(3, 113, 234, 44);
  panel.lineStyle(1, UI_COLORS.borderLight, 0.72).strokeRect(3, 113, 234, 44);
  panel.fillStyle(UI_COLORS.accentTeal, 1).fillRect(3, 113, 2, 44);
  return addText(scene, 11, 121, '', 'dialogue', '#edf2dc', 16);
}

export function drawCommandGrid(
  scene: Phaser.Scene,
  labels: string[],
  cursor: number,
  disabled: boolean[],
  sink: UiSink,
  onSelect: (index: number) => void,
  showIcons = true,
): void {
  const dock = scene.add.graphics().setDepth(19);
  dock.fillStyle(UI_COLORS.surfaceVoid, 0.98).fillRect(3, 113, 234, 44);
  dock.lineStyle(1, UI_COLORS.borderLight, 0.65).strokeRect(3, 113, 234, 44);
  dock.fillStyle(UI_COLORS.accentTeal, 1).fillRect(3, 113, 2, 44);
  keep(sink, dock);
  labels.forEach((label, index) => {
    const cell = gridCell(BATTLE_CMD_GRID, index, 4);
    const selected = index === cursor;
    const off = disabled[index] ?? false;
    const fill = off ? UI_COLORS.recessed : selected ? UI_COLORS.selection : UI_COLORS.surfaceLight;
    const bg = scene.add.rectangle(cell.x, cell.y, cell.w, cell.h, fill).setOrigin(0).setDepth(20)
      .setStrokeStyle(1, selected ? UI_COLORS.accentGold : UI_COLORS.borderLight, selected ? 0.8 : 0.22);
    if (!off) bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => onSelect(index));
    keep(sink, bg);
    const cur = drawSelectionCursor(scene, cell.x, cell.y, cell.w, cell.h, selected && !off, { depth: 22 });
    if (cur) keep(sink, cur);
    const iconKey = showIcons ? BATTLE_CMD_ICONS[index] : undefined;
    if (iconKey && scene.textures.exists(iconKey)) {
      keep(sink, scene.add.image(cell.x + 10, cell.y + Math.floor(cell.h / 2), iconKey).setDisplaySize(14, 14).setDepth(21));
    }
    keep(sink, addText(scene, cell.x + (showIcons ? 21 : 8), cell.y + Math.floor(cell.h / 2) - 4, label.toUpperCase(), 'menuLabel', off ? '#718477' : '#edf2dc', 21));
  });
}

export interface MoveTileData {
  name: string;
  type: string;
  pp: number;
  maxPp: number;
  category: string;
  disabled: boolean;
  empty: boolean;
  struggle: boolean;
}

export function drawMoveGrid(
  scene: Phaser.Scene,
  moves: MoveTileData[],
  cursor: number,
  sink: UiSink,
  onSelect: (index: number) => void,
): void {
  const dock = scene.add.graphics().setDepth(19);
  dock.fillStyle(UI_COLORS.surfaceVoid, 0.98).fillRect(3, 112, 234, 46);
  dock.lineStyle(1, UI_COLORS.borderLight, 0.65).strokeRect(3, 112, 234, 46);
  dock.fillStyle(UI_COLORS.accentGold, 1).fillRect(3, 112, 2, 46);
  keep(sink, dock);
  moves.forEach((move, index) => {
    const cell = gridCell({ x: 6, y: 114, w: 228, h: 35, cols: 2, rows: 2 }, index, 2);
    const selected = index === cursor;
    const off = move.disabled || move.empty;
    const fill = off ? UI_COLORS.recessed : selected ? UI_COLORS.selection : UI_COLORS.surfaceLight;
    const bg = scene.add.rectangle(cell.x, cell.y, cell.w, cell.h, fill).setOrigin(0).setDepth(20)
      .setStrokeStyle(1, selected ? UI_COLORS.accentGold : UI_COLORS.borderLight, selected ? 0.8 : 0.2);
    if (!off) bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => onSelect(index));
    keep(sink, bg);
    if (selected && !off) {
      const cur = drawSelectionCursor(scene, cell.x, cell.y, cell.w, cell.h, true, { depth: 22 });
      if (cur) keep(sink, cur);
    }
    if (move.empty) {
      keep(sink, addText(scene, cell.x + cell.w / 2, cell.y + cell.h / 2 - 3, '—', 'bodyMuted', '#7a8a7a', 21).setOrigin(0.5, 0));
      return;
    }
    const catIcon = move.category === 'Physical' ? 'ui-icon-move-physical'
      : move.category === 'Special' ? 'ui-icon-move-special' : 'ui-icon-move-status';
    if (scene.textures.exists(catIcon)) keep(sink, scene.add.image(cell.x + 7, cell.y + 8, catIcon).setDisplaySize(10, 10).setDepth(21));
    const nameColor = move.struggle ? '#e7a08f' : '#edf2dc';
    keep(sink, addText(scene, cell.x + 14, cell.y + 2, move.name.toUpperCase(), 'menuLabel', nameColor, 21));
    keep(sink, addText(scene, cell.x + 14, cell.y + 9, `${move.type.toUpperCase()}  ${move.pp}/${move.maxPp} PP`, 'tinyHint', '#b7c7b8', 21));
  });
}

export function drawMoveDetailFooter(
  scene: Phaser.Scene,
  move: { type: string; pp: number; maxPp: number; power: number; category: string; accuracy?: number },
  noPp: boolean,
  sink: UiSink,
): void {
  const bg = scene.add.rectangle(6, 151, 228, 6, UI_COLORS.surfaceMid).setOrigin(0).setDepth(29);
  keep(sink, bg);
  const acc = move.accuracy !== undefined ? `  ACC ${move.accuracy}` : '';
  const text = noPp ? 'NO PP — STRUGGLE' : `PP ${move.pp}/${move.maxPp}  ${move.type.toUpperCase()}  PWR ${move.power}${acc}  ${move.category.toUpperCase()}`;
  keep(sink, addText(scene, 120, 151, text, 'tinyHint', '#dbe5cf', 30).setOrigin(0.5, 0));
}

export function drawBattleBagModal(
  scene: Phaser.Scene,
  opts: {
    items: Array<{ itemId: string; count: number }>;
    cursor: number;
    title?: string;
  },
  sink: UiSink,
  onSelect: (index: number) => void,
): void {
  const shell = scene.add.graphics().setDepth(25);
  shell.fillStyle(UI_COLORS.surfaceVoid, 0.97).fillRect(0, 0, 240, 160);
  shell.fillGradientStyle(UI_COLORS.surfaceRaised, UI_COLORS.surfaceMid, UI_COLORS.surfaceDark, UI_COLORS.surfaceDark, 1).fillRect(4, 4, 232, 22);
  shell.fillStyle(UI_COLORS.accentGold, 1).fillRect(4, 4, 2, 22);
  shell.lineStyle(1, UI_COLORS.borderLight, 0.7).strokeRect(4, 4, 232, 152);
  shell.fillStyle(UI_COLORS.surfaceDark, 1).fillRect(8, 30, 100, 108);
  shell.fillStyle(UI_COLORS.surfaceMid, 1).fillRect(112, 30, 120, 108);
  shell.lineStyle(1, UI_COLORS.borderLight, 0.32).strokeRect(8, 30, 100, 108).strokeRect(112, 30, 120, 108);
  keep(sink, shell);
  keep(sink, scene.add.image(16, 15, 'ui-icon-battle-bag').setDisplaySize(15, 15).setDepth(27));
  keep(sink, addText(scene, 28, 8, opts.title ?? 'BATTLE BAG', 'panelTitle', '#edf2dc', 28));
  keep(sink, addText(scene, 228, 9, 'A USE   B BACK', 'tinyHint', '#d2af42', 28).setOrigin(1, 0));

  if (!opts.items.length) {
    keep(sink, scene.add.image(58, 65, 'ui-icon-empty').setDisplaySize(22, 22).setDepth(28));
    keep(sink, addText(scene, 58, 82, 'NO ITEMS', 'panelTitle', '#b7c7b8', 28).setOrigin(0.5, 0));
    keep(sink, addText(scene, 58, 95, 'Nothing usable\nin this battle.', 'compact', '#718477', 28).setOrigin(0.5, 0));
    keep(sink, addText(scene, 172, 78, 'Your usable recovery\nand capture items\nappear here.', 'compact', '#718477', 28).setOrigin(0.5, 0));
    return;
  }

  const { start, end } = pageWindow(opts.cursor, opts.items.length, 6);
  opts.items.slice(start, end).forEach((stack, row) => {
    const index = start + row;
    const item = ITEMS[stack.itemId];
    const y = 34 + row * 17;
    const selected = index === opts.cursor;
    const bg = scene.add.rectangle(12, y, 92, 15, selected ? UI_COLORS.selection : UI_COLORS.surfaceLight)
      .setOrigin(0).setDepth(27)
      .setStrokeStyle(1, selected ? UI_COLORS.accentGold : UI_COLORS.borderLight, selected ? 0.8 : 0.15)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => onSelect(index));
    keep(sink, bg);
    keep(sink, addText(scene, 17, y + 4, item.name, 'compact', '#edf2dc', 28));
    keep(sink, addText(scene, 100, y + 4, `x${stack.count}`, 'numeric', selected ? '#f1d77b' : '#b7c7b8', 28).setOrigin(1, 0));
  });
  if (start > 0) keep(sink, addText(scene, 105, 30, '▲', 'tinyHint', '#d2af42', 28).setOrigin(1, 0));
  if (end < opts.items.length) keep(sink, addText(scene, 105, 130, '▼', 'tinyHint', '#d2af42', 28).setOrigin(1, 0));

  const stack = opts.items[opts.cursor];
  if (stack) {
    const item = ITEMS[stack.itemId];
    const iconWell = scene.add.graphics().setDepth(27);
    iconWell.fillStyle(UI_COLORS.surfaceVoid, 0.75).fillRect(118, 36, 108, 38);
    iconWell.lineStyle(1, UI_COLORS.borderLight, 0.28).strokeRect(118, 36, 108, 38);
    keep(sink, iconWell);
    renderItemIcon(scene, item, 172, 54, sink, 28);
    keep(sink, addText(scene, 120, 80, item.name.toUpperCase(), 'panelTitle', '#edf2dc', 28));
    keep(sink, addText(scene, 120, 91, item.category.toUpperCase(), 'badge', '#d2af42', 28));
    keep(sink, addText(scene, 120, 101, wrapBitmapText(item.description, 24, 3), 'compact', '#b7c7b8', 28));
    keep(sink, addText(scene, 120, 127, `OWNED  ${stack.count}`, 'compact', '#d2af42', 28));
  }
}

export function drawBattlePartyModal(
  scene: Phaser.Scene,
  opts: {
    title: string;
    party: CreatureInstance[];
    cursor: number;
    activeIndex?: number;
    activeIndices?: number[];
    itemLabel?: string;
  },
  sink: UiSink,
  onSelect: (index: number) => void,
): void {
  const shell = scene.add.graphics().setDepth(25);
  shell.fillStyle(UI_COLORS.surfaceVoid, 0.97).fillRect(0, 0, 240, 160);
  shell.fillGradientStyle(UI_COLORS.surfaceRaised, UI_COLORS.surfaceMid, UI_COLORS.surfaceDark, UI_COLORS.surfaceDark, 1).fillRect(4, 4, 232, 22);
  shell.fillStyle(UI_COLORS.accentTeal, 1).fillRect(4, 4, 2, 22);
  shell.lineStyle(1, UI_COLORS.borderLight, 0.7).strokeRect(4, 4, 232, 152);
  shell.fillStyle(UI_COLORS.surfaceDark, 1).fillRect(8, 30, 224, 108);
  shell.lineStyle(1, UI_COLORS.borderLight, 0.32).strokeRect(8, 30, 224, 108);
  keep(sink, shell);
  keep(sink, scene.add.image(16, 15, 'ui-icon-party').setDisplaySize(15, 15).setDepth(27));
  keep(sink, addText(scene, 28, 8, opts.title, 'panelTitle', '#edf2dc', 28));
  keep(sink, addText(scene, 228, 9, 'A CHOOSE   B BACK', 'tinyHint', '#d2af42', 28).setOrigin(1, 0));

  const rowH = 17;

  opts.party.forEach((creature, index) => {
    const species = SPECIES[creature.speciesId];
    const max = calculateStats(creature, species).hp;
    const ratio = Math.max(0, creature.currentHp / max);
    const fainted = creature.currentHp <= 0;
    const active = opts.activeIndices?.includes(index) ?? index === opts.activeIndex;
    const y = 33 + index * rowH;
    const selected = index === opts.cursor;
    const fill = fainted ? UI_COLORS.recessed : selected ? UI_COLORS.selection : UI_COLORS.surfaceLight;
    const card = scene.add.rectangle(12, y, 216, 15, fill).setOrigin(0).setDepth(27)
      .setStrokeStyle(1, selected ? UI_COLORS.accentGold : UI_COLORS.borderLight, selected ? 0.8 : 0.15);
    if (!fainted) card.setInteractive({ useHandCursor: true }).on('pointerdown', () => onSelect(index));
    keep(sink, card);
    keep(sink, scene.add.image(22, y + 8, `${species.id}-front`).setDisplaySize(17, 17).setDepth(28).setTint(fainted ? 0x666666 : 0xffffff));
    keep(sink, addText(scene, 34, y + 2, (creature.nickname || species.name).toUpperCase(), 'menuLabel', fainted ? '#718477' : '#edf2dc', 28));
    keep(sink, addText(scene, 34, y + 9, `Lv${creature.level}`, 'tinyHint', fainted ? '#59684f' : '#b7c7b8', 28));
    const meter = drawHpMeter(scene, 72, y + 10, 78, 3, ratio, 29);
    keep(sink, meter.bg);
    keep(sink, meter.fill);
    keep(sink, addText(scene, 157, y + 8, `${creature.currentHp}/${max}`, 'tinyHint', fainted ? '#59684f' : '#b7c7b8', 29));
    if (active) keep(sink, addText(scene, 222, y + 4, 'ACTIVE', 'badge', '#d2af42', 29).setOrigin(1, 0));
    if (fainted) keep(sink, addText(scene, 222, y + 4, 'FAINTED', 'badge', '#e7907d', 29).setOrigin(1, 0));
  });
}
