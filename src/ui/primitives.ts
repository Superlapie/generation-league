import Phaser from 'phaser';
import { UI_COLORS, UI_DEPTH, UI_SPACING, hpColor } from './theme';
import { addText, wrapBitmapText } from './typography';
import { drawSelectionCursor, selectionFill, selectionTextColor } from './cursor';

export type UiSink = (obj: Phaser.GameObjects.GameObject) => void;

export function keep(sink: UiSink | undefined, obj: Phaser.GameObjects.GameObject) {
  sink?.(obj);
  return obj;
}

/** Full-screen dark green tint for field menu overlay. */
export function drawBackdrop(scene: Phaser.Scene, alpha = 0.72, depth = UI_DEPTH.backdrop): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(UI_COLORS.surfaceVoid, alpha).fillRect(0, 0, 240, 160);
  g.fillGradientStyle(0x27453c, 0x182b25, 0x10201a, 0x0d1713, 0.28).fillRect(0, 0, 240, 160);
  return g;
}

export function drawPageBackground(scene: Phaser.Scene, depth = UI_DEPTH.backdrop): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  g.fillGradientStyle(UI_COLORS.surfaceMid, UI_COLORS.surfaceDark, UI_COLORS.surfaceVoid, UI_COLORS.surfaceDark, 1).fillRect(0, 0, 240, 160);
  g.fillStyle(UI_COLORS.accentGoldSoft, 0.15).fillCircle(214, 144, 70);
  return g;
}

/** Raised panel with pixel bevel corners. */
export function raisedPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = UI_COLORS.paper,
  depth = UI_DEPTH.frame,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  const ix = Math.round(x);
  const iy = Math.round(y);
  const iw = Math.round(w);
  const ih = Math.round(h);
  g.fillStyle(UI_COLORS.shadow, 0.5).fillRect(ix + 1, iy + 2, iw, ih);
  g.fillStyle(UI_COLORS.borderLight, 0.56).fillRect(ix, iy, iw, ih);
  g.fillStyle(fill, 1).fillRect(ix + 1, iy + 1, iw - 2, ih - 2);
  g.fillStyle(0xffffff, 0.2).fillRect(ix + 1, iy + 1, iw - 2, 1);
  g.fillStyle(UI_COLORS.borderDeep, 0.22).fillRect(ix + 1, iy + ih - 2, iw - 2, 1);
  return g;
}

export function recessedPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, depth = UI_DEPTH.frame): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(UI_COLORS.recessed, 1).fillRect(x, y, w, h);
  g.fillStyle(UI_COLORS.borderDeep, 1).fillRect(x, y, w, 1).fillRect(x, y, 1, h);
  g.fillStyle(UI_COLORS.borderMid, 0.35).fillRect(x + 1, y + h - 1, w - 1, 1).fillRect(x + w - 1, y + 1, 1, h - 1);
  return g;
}

export function darkEquipmentPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, depth = UI_DEPTH.modal): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(0x0b1610, 0.82).fillRect(0, 0, 240, 160);
  raisedPanel(scene, x, y, w, h, UI_COLORS.battlePaper, depth + 1);
  return g;
}

export interface PageHeaderOptions {
  title: string;
  subtitle?: string;
  iconKey?: string;
  rightLabel?: string;
}

export function drawPageHeader(scene: Phaser.Scene, opts: PageHeaderOptions, sink?: UiSink): Phaser.GameObjects.GameObject[] {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const bar = scene.add.graphics().setDepth(UI_DEPTH.header);
  bar.fillGradientStyle(UI_COLORS.surfaceRaised, UI_COLORS.surfaceMid, UI_COLORS.surfaceDark, UI_COLORS.surfaceDark, 1).fillRect(0, 0, 240, UI_SPACING.headerH);
  bar.fillStyle(UI_COLORS.accentGold, 1).fillRect(0, 0, 2, UI_SPACING.headerH);
  bar.fillStyle(UI_COLORS.borderLight, 0.65).fillRect(0, UI_SPACING.headerH - 1, 240, 1);
  bar.fillStyle(UI_COLORS.accentGold, 0.85).fillRect(0, UI_SPACING.headerH - 1, 58, 1);
  objs.push(bar);
  if (opts.iconKey && scene.textures.exists(opts.iconKey)) {
    objs.push(keep(sink, scene.add.image(10, 10, opts.iconKey).setDisplaySize(15, 15).setDepth(UI_DEPTH.header + 1)));
  }
  const titleX = opts.iconKey ? 22 : 8;
  objs.push(keep(sink, addText(scene, titleX, 3, opts.title, 'pageTitle', '#f1f1d0', UI_DEPTH.header + 1)));
  if (opts.subtitle) objs.push(keep(sink, addText(scene, titleX, 14, opts.subtitle, 'pageMeta', '#b7c7b8', UI_DEPTH.header + 1)));
  if (opts.rightLabel) {
    const t = addText(scene, 232, 6, opts.rightLabel, 'pageMeta', '#d2af42', UI_DEPTH.header + 1).setOrigin(1, 0);
    objs.push(keep(sink, t));
  }
  return objs;
}

export function drawHelpBar(scene: Phaser.Scene, text: string, sink?: UiSink, highlight = false): Phaser.GameObjects.GameObject[] {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const bg = scene.add.graphics().setDepth(UI_DEPTH.content);
  bg.fillStyle(UI_COLORS.surfaceVoid, 0.92).fillRect(UI_SPACING.pagePad, HELP_Y, 240 - UI_SPACING.pagePad * 2, 14);
  bg.fillStyle(highlight ? UI_COLORS.accentGold : UI_COLORS.accentTeal, 1).fillRect(UI_SPACING.pagePad, HELP_Y, 2, 14);
  bg.lineStyle(1, UI_COLORS.borderLight, 0.35).strokeRect(UI_SPACING.pagePad + 2, HELP_Y, 240 - UI_SPACING.pagePad * 2 - 2, 14);
  objs.push(keep(sink, bg));
  objs.push(keep(sink, addText(scene, UI_SPACING.pagePad + 7, HELP_Y + 3, text, 'compact', highlight ? '#e3d36e' : '#dbe5cf', UI_DEPTH.content + 1)));
  return objs;
}

const HELP_Y = 143;

export interface ListRowOptions {
  x: number;
  y: number;
  w: number;
  h?: number;
  label: string;
  right?: string;
  selected: boolean;
  disabled?: boolean;
  iconKey?: string;
  onClick?: () => void;
}

export function drawListRow(scene: Phaser.Scene, opts: ListRowOptions, sink?: UiSink): Phaser.GameObjects.GameObject[] {
  const h = opts.h ?? UI_SPACING.rowH;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const fill = selectionFill(opts.selected, opts.disabled);
  const bg = scene.add.rectangle(opts.x, opts.y, opts.w, h, fill).setOrigin(0).setDepth(UI_DEPTH.row);
  bg.setStrokeStyle(1, opts.selected ? UI_COLORS.accentGoldSoft : UI_COLORS.borderLight, opts.selected ? 0.5 : 0.12);
  if (!opts.disabled && opts.onClick) bg.setInteractive({ useHandCursor: true }).on('pointerdown', opts.onClick);
  objs.push(keep(sink, bg));
  const cursor = drawSelectionCursor(scene, opts.x, opts.y, opts.w, h, opts.selected && !opts.disabled);
  if (cursor) objs.push(keep(sink, cursor));
  let textX = opts.x + 6;
  if (opts.iconKey && scene.textures.exists(opts.iconKey)) {
    objs.push(keep(sink, scene.add.image(opts.x + 8, opts.y + Math.floor(h / 2), opts.iconKey).setDisplaySize(11, 11).setDepth(UI_DEPTH.row + 1)));
    textX = opts.x + 17;
  }
  objs.push(keep(sink, addText(scene, textX, opts.y + 3, opts.label, 'menuLabel', selectionTextColor(opts.selected, opts.disabled), UI_DEPTH.row + 1)));
  if (opts.right) objs.push(keep(sink, addText(scene, opts.x + opts.w - 4, opts.y + 3, opts.right, 'numeric', selectionTextColor(opts.selected, opts.disabled), UI_DEPTH.row + 1).setOrigin(1, 0)));
  return objs;
}

export interface HpMeterResult {
  bg: Phaser.GameObjects.Graphics;
  fill: Phaser.GameObjects.Graphics;
  update: (ratio: number) => void;
}

export function drawHpMeter(scene: Phaser.Scene, x: number, y: number, w: number, h: number, ratio: number, depth = UI_DEPTH.content): HpMeterResult {
  const bg = scene.add.graphics().setDepth(depth);
  const fill = scene.add.graphics().setDepth(depth + 1);
  const update = (r: number) => {
    const clamped = Math.max(0, Math.min(1, r));
    bg.clear();
    fill.clear();
    bg.fillStyle(UI_COLORS.recessed, 1).fillRect(x, y, w, h);
    bg.fillStyle(UI_COLORS.borderDeep, 1).fillRect(x, y, w, 1).fillRect(x, y + h - 1, w, 1);
    const fillW = Math.max(0, Math.round((w - 2) * clamped));
    fill.fillStyle(hpColor(clamped), 1).fillRect(x + 1, y + 1, fillW, h - 2);
    fill.fillStyle(0xffffff, 0.2).fillRect(x + 1, y + 1, fillW, 1);
  };
  update(ratio);
  return { bg, fill, update };
}

export function drawTypeBadge(scene: Phaser.Scene, x: number, y: number, type: string, typeColors: (t: string) => number, sink?: UiSink): Phaser.GameObjects.GameObject[] {
  const w = 46;
  const h = 11;
  const objs: Phaser.GameObjects.GameObject[] = [];
  objs.push(keep(sink, scene.add.rectangle(x, y, w, h, typeColors(type)).setOrigin(0).setDepth(UI_DEPTH.content)));
  objs.push(keep(sink, addText(scene, x + w / 2, y + 2, type.toUpperCase(), 'badge', '#fff', UI_DEPTH.content + 1).setOrigin(0.5, 0)));
  return objs;
}

export function drawSegmentedControl(
  scene: Phaser.Scene,
  x: number,
  y: number,
  labels: string[],
  selected: number,
  sink?: UiSink,
): Phaser.GameObjects.GameObject[] {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const segW = Math.floor(228 / labels.length);
  labels.forEach((label, i) => {
    const sx = x + i * segW;
    const sel = i === selected;
    objs.push(keep(sink, scene.add.rectangle(sx, y, segW - 2, UI_SPACING.tabH, sel ? UI_COLORS.accentGold : UI_COLORS.surfaceLight).setOrigin(0).setDepth(UI_DEPTH.content)));
    objs.push(keep(sink, addText(scene, sx + (segW - 2) / 2, y + 2, label, 'compact', sel ? '#24342d' : '#d6e0cc', UI_DEPTH.content + 1).setOrigin(0.5, 0)));
  });
  return objs;
}

export function drawProgressMeter(scene: Phaser.Scene, x: number, y: number, w: number, ratio: number, depth = UI_DEPTH.content): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(UI_COLORS.recessed, 1).fillRect(x, y, w, 5);
  g.fillStyle(UI_COLORS.accentTeal, 1).fillRect(x + 1, y + 1, Math.round((w - 2) * Math.max(0, Math.min(1, ratio))), 3);
  return g;
}

export function drawEmptyState(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  title: string,
  body: string,
  iconKey?: string,
  sink?: UiSink,
): Phaser.GameObjects.GameObject[] {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const cx = x + w / 2;
  if (iconKey && scene.textures.exists(iconKey)) {
    objs.push(keep(sink, scene.add.image(cx, y + 12, iconKey).setDisplaySize(22, 22).setDepth(UI_DEPTH.content)));
  }
  objs.push(keep(sink, addText(scene, cx, y + 28, title, 'panelTitle', '#52665c', UI_DEPTH.content).setOrigin(0.5, 0)));
  const bodyText = addText(scene, cx, y + 40, wrapBitmapText(body, Math.max(8, Math.floor((w - 16) / 6))), 'compact', '#7a8a7a', UI_DEPTH.content).setOrigin(0.5, 0);
  objs.push(keep(sink, bodyText));
  return objs;
}

export function drawModalShell(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  sink?: UiSink,
): Phaser.GameObjects.GameObject[] {
  const objs: Phaser.GameObjects.GameObject[] = [];
  objs.push(keep(sink, scene.add.rectangle(0, 0, 240, 160, 0x0b1610, 0.78).setOrigin(0).setDepth(UI_DEPTH.modal)));
  objs.push(keep(sink, raisedPanel(scene, x, y, w, h, UI_COLORS.paperWarm, UI_DEPTH.modal + 1)));
  objs.push(keep(sink, recessedPanel(scene, x + 4, y + 4, w - 8, 14, UI_DEPTH.modal + 2)));
  objs.push(keep(sink, addText(scene, x + 8, y + 7, title, 'panelTitle', '#20342f', UI_DEPTH.modal + 3)));
  return objs;
}

export function drawDialogueBox(scene: Phaser.Scene, x: number, y: number, w: number, h: number, depth = UI_DEPTH.content): Phaser.GameObjects.Graphics {
  const g = raisedPanel(scene, x, y, w, h, UI_COLORS.dialogue, depth);
  return g;
}

export function drawVolumeMeter(scene: Phaser.Scene, x: number, y: number, steps: number, filled: number, depth = UI_DEPTH.content): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  for (let i = 0; i < steps; i++) {
    const on = i < filled;
    g.fillStyle(on ? UI_COLORS.accentTeal : UI_COLORS.recessed, 1).fillRect(x + i * 7, y, 5, 8);
    if (on) g.fillStyle(0xffffff, 0.15).fillRect(x + i * 7, y, 5, 2);
  }
  return g;
}

export function drawToggleSwitch(scene: Phaser.Scene, x: number, y: number, on: boolean, depth = UI_DEPTH.content): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(on ? UI_COLORS.accentTeal : UI_COLORS.recessed, 1).fillRect(x, y, 28, 10);
  g.fillStyle(on ? UI_COLORS.accentLime : UI_COLORS.borderMid, 1).fillRect(on ? x + 16 : x + 2, y + 2, 10, 6);
  return g;
}

/** @deprecated */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, fill?: number, depth?: number) {
  return raisedPanel(scene, x, y, w, h, fill ?? UI_COLORS.paper, depth ?? UI_DEPTH.frame);
}

/** @deprecated */
export function label(scene: Phaser.Scene, x: number, y: number, value: string, size = 8, color = '#182017', depth = 21) {
  return addText(scene, x, y, value, size, color, depth);
}

export function button(scene: Phaser.Scene, x: number, y: number, width: number, value: string, onClick: () => void, depth = 30) {
  const shadow = scene.add.rectangle(x + 1, y + 2, width, 16, UI_COLORS.shadow, 0.45).setOrigin(0).setDepth(depth - 1);
  const bg = scene.add.rectangle(x, y, width, 16, UI_COLORS.borderDeep).setOrigin(0).setDepth(depth).setInteractive({ useHandCursor: true });
  const accent = scene.add.rectangle(x, y, 3, 16, UI_COLORS.accentLime).setOrigin(0).setDepth(depth + 1);
  const text = addText(scene, x + 5, y + 4, value, 8, '#f1f1d0', depth + 1);
  bg.on('pointerover', () => bg.setFillStyle(UI_COLORS.borderMid)).on('pointerout', () => bg.setFillStyle(UI_COLORS.borderDeep)).on('pointerdown', onClick);
  return {
    bg, text, shadow, accent,
    setSelected(selected: boolean) {
      bg.setFillStyle(selected ? UI_COLORS.accentTeal : UI_COLORS.borderDeep);
      accent.setFillStyle(selected ? UI_COLORS.accentGold : UI_COLORS.accentLime);
      text.setTint(Phaser.Display.Color.HexStringToColor(selected ? '#ffffff' : '#f1f1d0').color);
    },
  };
}

export { textStyle, addText } from './typography';
export { hpColor, COLORS } from './theme';
