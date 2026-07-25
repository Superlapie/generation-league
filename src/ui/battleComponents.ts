import Phaser from 'phaser';
import type { CreatureInstance, ItemDefinition } from '../types';
import { ITEMS, MOVES, SPECIES } from '../data';
import { calculateStats } from '../rules';
import { UI_COLORS } from './theme';
import { BATTLE_CMD_GRID, gridCell } from './layout';
import { BATTLE_CMD_ICONS } from './icons';
import { addText, textStyle } from './typography';
import {
  raisedPanel, recessedPanel, drawHpMeter, drawListRow, drawDialogueBox,
  drawEmptyState, keep, type UiSink,
} from './primitives';
import { renderItemIcon } from './menuComponents';
import { drawSelectionCursor, selectionFill, selectionTextColor } from './cursor';
import { hpColor } from './theme';

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
  raisedPanel(scene, x, y, 112, 32, UI_COLORS.enemyPanel, 8);
  recessedPanel(scene, x + 4, y + 20, 88, 7, 9);
  const nameText = addText(scene, x + 7, y + 5, `${name.toUpperCase()}  Lv${level}`, 'menuLabel', undefined, 10);
  const statusText = addText(scene, x + 105, y + 5, '', 'badge', '#9f4034', 10).setOrigin(1, 0);
  addText(scene, x + 7, y + 21, 'HP', 'badge', '#aa4b35', 10);
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
  raisedPanel(scene, x, y, 108, 34, UI_COLORS.playerPanel, 8);
  recessedPanel(scene, x + 4, y + 20, 78, 7, 9);
  const nameText = addText(scene, x + 7, y + 5, `${name.toUpperCase()}  Lv${level}`, 'menuLabel', undefined, 10);
  const statusText = addText(scene, x + 101, y + 5, '', 'badge', '#9f4034', 10).setOrigin(1, 0);
  addText(scene, x + 7, y + 21, 'HP', 'badge', '#aa4b35', 10);
  const hpMeter = drawHpMeter(scene, x + 22, y + 22, 72, 5, ratio, 10);
  const hpText = addText(scene, x + 101, y + 28, `${currentHp}/${maxHp}`, 'compact', '#52665c', 10).setOrigin(1, 0);
  const partyDots = party.map((c, i) =>
    scene.add.circle(x + 8 + i * 7, y + 30, 2, c.currentHp > 0 ? UI_COLORS.accentGold : UI_COLORS.disabled)
      .setStrokeStyle(1, UI_COLORS.borderDeep).setDepth(10),
  );
  return { nameText, statusText, hpText, hpMeter, partyDots };
}

export function drawBattleDialogue(scene: Phaser.Scene): Phaser.GameObjects.Text {
  drawDialogueBox(scene, 3, 113, 234, 44, 15);
  return scene.add.text(11, 121, '', textStyle('dialogue')).setDepth(16).setWordWrapWidth(214);
}

export function drawCommandGrid(
  scene: Phaser.Scene,
  labels: string[],
  cursor: number,
  disabled: boolean[],
  sink: UiSink,
  onSelect: (index: number) => void,
): void {
  labels.forEach((label, index) => {
    const cell = gridCell(BATTLE_CMD_GRID, index, 4);
    const selected = index === cursor;
    const off = disabled[index] ?? false;
    const bg = scene.add.rectangle(cell.x, cell.y, cell.w, cell.h, selectionFill(selected, off)).setOrigin(0).setDepth(20);
    if (!off) bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => onSelect(index));
    keep(sink, bg);
    const cur = drawSelectionCursor(scene, cell.x, cell.y, cell.w, cell.h, selected && !off, { depth: 22 });
    if (cur) keep(sink, cur);
    const iconKey = BATTLE_CMD_ICONS[index];
    if (iconKey && scene.textures.exists(iconKey)) {
      keep(sink, scene.add.image(cell.x + 6, cell.y + Math.floor(cell.h / 2), iconKey).setDepth(21));
    }
    keep(sink, addText(scene, cell.x + 18, cell.y + Math.floor(cell.h / 2) - 4, label.toUpperCase(), 'menuLabel', selectionTextColor(selected, off), 21));
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
  moves.forEach((move, index) => {
    const cell = gridCell({ x: 6, y: 116, w: 228, h: 34, cols: 2, rows: 2 }, index, 3);
    const selected = index === cursor;
    const off = move.disabled || move.empty;
    const fill = move.empty ? UI_COLORS.recessed : selectionFill(selected, off);
    const bg = scene.add.rectangle(cell.x, cell.y, cell.w, cell.h, fill).setOrigin(0).setDepth(20);
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
    if (scene.textures.exists(catIcon)) keep(sink, scene.add.image(cell.x + 4, cell.y + 4, catIcon).setDepth(21));
    const nameColor = move.struggle ? '#9f4034' : selectionTextColor(selected, off);
    keep(sink, addText(scene, cell.x + 14, cell.y + 3, move.name.toUpperCase(), 'menuLabel', nameColor, 21));
    keep(sink, addText(scene, cell.x + 14, cell.y + 12, `${move.type}  ${move.pp}/${move.maxPp}`, 'compact', selectionTextColor(selected, off), 21));
  });
}

export function drawMoveDetailFooter(
  scene: Phaser.Scene,
  move: { type: string; pp: number; maxPp: number; power: number; category: string; accuracy?: number },
  noPp: boolean,
  sink: UiSink,
): void {
  const bg = scene.add.rectangle(6, 150, 228, 8, UI_COLORS.borderDeep).setOrigin(0).setDepth(29);
  keep(sink, bg);
  const acc = move.accuracy !== undefined ? `  ACC ${move.accuracy}` : '';
  const text = noPp ? 'NO PP — STRUGGLE' : `PP ${move.pp}/${move.maxPp}  ${move.type.toUpperCase()}  PWR ${move.power}${acc}  ${move.category.toUpperCase()}`;
  keep(sink, addText(scene, 120, 150, text, 'compact', '#f1f1d0', 30).setOrigin(0.5, 0));
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
  keep(sink, scene.add.rectangle(0, 0, 240, 160, 0x0b1610, 0.78).setOrigin(0).setDepth(25));
  keep(sink, raisedPanel(scene, 6, 7, 228, 146, UI_COLORS.battlePaper, 26));
  keep(sink, recessedPanel(scene, 10, 11, 218, 14, 27));
  keep(sink, addText(scene, 14, 14, opts.title ?? 'BATTLE BAG', 'panelTitle', undefined, 28));
  keep(sink, addText(scene, 226, 14, 'A: USE  B: BACK', 'compact', '#59684f', 28).setOrigin(1, 0));
  keep(sink, scene.add.rectangle(118, 30, 2, 108, UI_COLORS.recessed).setOrigin(0).setDepth(27));

  if (!opts.items.length) {
    drawEmptyState(scene, 12, 50, 100, 'No items', 'No usable battle items right now.', 'ui-icon-empty', sink);
    return;
  }

  opts.items.forEach((stack, index) => {
    const y = 36 + index * 16;
    drawListRow(scene, {
      x: 12, y, w: 100, h: 14,
      label: ITEMS[stack.itemId].name,
      right: `×${stack.count}`,
      selected: index === opts.cursor,
      onClick: () => onSelect(index),
    }, sink);
  });

  const stack = opts.items[opts.cursor];
  if (stack) {
    const item = ITEMS[stack.itemId];
    keep(sink, recessedPanel(scene, 124, 36, 104, 48, 28));
    renderItemIcon(scene, item, 176, 52, sink);
    keep(sink, addText(scene, 128, 68, item.name.toUpperCase(), 'menuLabel', undefined, 28));
    keep(sink, addText(scene, 128, 78, item.category.toUpperCase(), 'compact', '#7b6843', 28));
    keep(sink, scene.add.text(128, 88, item.description, textStyle('compact')).setDepth(28).setWordWrapWidth(96).setMaxLines(3));
    keep(sink, addText(scene, 128, 118, `OWNED ${stack.count}`, 'compact', '#7b6843', 28));
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
  keep(sink, scene.add.rectangle(0, 0, 240, 160, 0x0b1610, 0.78).setOrigin(0).setDepth(25));
  keep(sink, raisedPanel(scene, 6, 7, 228, 146, UI_COLORS.battlePaper, 26));
  keep(sink, recessedPanel(scene, 10, 11, 218, 14, 27));
  keep(sink, addText(scene, 14, 14, opts.title, 'panelTitle', undefined, 28));
  keep(sink, addText(scene, 226, 14, 'A: CHOOSE  B: BACK', 'compact', '#59684f', 28).setOrigin(1, 0));

  const count = opts.party.length;
  const compact = count > 3;
  const rowH = compact ? 16 : 22;

  opts.party.forEach((creature, index) => {
    const species = SPECIES[creature.speciesId];
    const max = calculateStats(creature, species).hp;
    const ratio = Math.max(0, creature.currentHp / max);
    const fainted = creature.currentHp <= 0;
    const active = opts.activeIndices?.includes(index) ?? index === opts.activeIndex;
    const y = 32 + index * rowH;
    const selected = index === opts.cursor;

    if (compact) {
      drawListRow(scene, {
        x: 12, y, w: 214, h: rowH - 2,
        label: (creature.nickname || species.name).toUpperCase(),
        right: `${creature.currentHp}/${max}`,
        selected,
        disabled: fainted,
        onClick: () => onSelect(index),
      }, sink);
      const m = drawHpMeter(scene, 100, y + 11, 80, 2, ratio, 29);
      keep(sink, m.bg);
      keep(sink, m.fill);
    } else {
      keep(sink, raisedPanel(scene, 12, y, 214, rowH - 2, selectionFill(selected, fainted), 27));
      if (selected && !fainted) {
        const cur = drawSelectionCursor(scene, 12, y, 214, rowH - 2, true, { depth: 29 });
        if (cur) keep(sink, cur);
      }
      if (!fainted) scene.add.rectangle(12, y, 214, rowH - 2, 0).setOrigin(0).setDepth(28).setInteractive({ useHandCursor: true }).on('pointerdown', () => onSelect(index));
      keep(sink, scene.add.image(22, y + Math.floor(rowH / 2), `${species.id}-front`).setDisplaySize(18, 18).setDepth(28).setTint(fainted ? 0x666666 : 0xffffff));
      keep(sink, addText(scene, 34, y + 4, (creature.nickname || species.name).toUpperCase(), 'menuLabel', selectionTextColor(selected, fainted), 28));
      keep(sink, addText(scene, 34, y + 13, `Lv${creature.level}  ${creature.currentHp}/${max}`, 'compact', selectionTextColor(selected, fainted), 28));
      const m = drawHpMeter(scene, 120, y + 12, 96, 3, ratio, 29);
      keep(sink, m.bg);
      keep(sink, m.fill);
    }
    if (active) keep(sink, addText(scene, 210, y + 4, 'ACTIVE', 'badge', '#7b6843', 29).setOrigin(1, 0));
    if (fainted) keep(sink, addText(scene, 210, y + 4, 'FAINTED', 'badge', '#9f4034', 29).setOrigin(1, 0));
  });
}

