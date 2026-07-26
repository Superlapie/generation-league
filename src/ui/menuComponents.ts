import Phaser from 'phaser';
import type { CreatureInstance, GameOptions, ItemDefinition } from '../types';
import { ITEMS, MOVES, SPECIES } from '../data';
import { calculateStats, expForLevel } from '../rules';
import { UI_COLORS, typeColor } from './theme';
import { UI_SPACING } from './theme';
import { gridCell, pageWindow, ROOT_GRID } from './layout';
import { NAV_ICON_KEYS } from './icons';
import { addText, wrapBitmapText } from './typography';
import {
  drawBackdrop, drawPageBackground, drawPageHeader, drawHelpBar, drawListRow,
  drawHpMeter, drawTypeBadge, drawSegmentedControl, drawProgressMeter, drawEmptyState,
  drawModalShell, drawVolumeMeter, drawToggleSwitch, raisedPanel, recessedPanel,
  keep, type UiSink,
} from './primitives';
import { drawSelectionCursor, selectionFill, selectionTextColor } from './cursor';
import { ROOT_ENTRIES, POCKET_DEFS } from './constants';

export function renderFieldMenuRoot(
  scene: Phaser.Scene,
  opts: {
    playerName: string;
    avatar: 'a' | 'b';
    crests: number;
    money: number;
    guideCaught: number;
    guideTotal: number;
    location: string;
    cursor: number;
    help: string;
    translucent?: boolean;
    onSelect?: (index: number) => void;
  },
  sink: UiSink,
): void {
  if (opts.translucent) keep(sink, drawBackdrop(scene, 0.68));
  else keep(sink, drawPageBackground(scene));
  drawPageHeader(scene, { title: 'Field menu', subtitle: opts.location, iconKey: 'ui-icon-card', rightLabel: 'Space: close' }, sink);

  // Player identity stays dark and recessed so warm paper is reserved for information.
  keep(sink, raisedPanel(scene, 6, 24, 72, 110, UI_COLORS.surfaceLight));
  keep(sink, recessedPanel(scene, 10, 28, 64, 50));
  keep(sink, scene.add.sprite(42, 48, `avatar-${opts.avatar}`, 0).setScale(0.5).setDepth(6));
  keep(sink, addText(scene, 12, 83, opts.playerName, 'panelTitle', '#f1f1d0', 6));
  keep(sink, addText(scene, 12, 94, 'CRESTS', 'tinyHint', '#b9ca68', 6));
  [0, 1, 2].forEach((i) => {
    const key = i < opts.crests ? 'ui-icon-crest-filled' : 'ui-icon-crest-empty';
    keep(sink, scene.add.image(16 + i * 20, 106, key).setDisplaySize(14, 14).setDepth(6));
  });
  keep(sink, addText(scene, 12, 114, `${opts.money} L`, 'numeric', '#f1f1d0', 6));
  keep(sink, addText(scene, 12, 122, `Guide ${opts.guideCaught}/${opts.guideTotal}`, 'compact', '#b9c8ac', 6));

  // 2-column nav grid
  ROOT_ENTRIES.forEach((entry, index) => {
    const cell = gridCell(ROOT_GRID, index, 4);
    const selected = index === opts.cursor;
    const tile = scene.add.rectangle(cell.x, cell.y, cell.w, cell.h, selected ? selectionFill(true) : UI_COLORS.surfaceLight).setOrigin(0).setDepth(5);
    tile.setStrokeStyle(1, selected ? UI_COLORS.accentGoldSoft : UI_COLORS.borderLight, selected ? 0.55 : 0.18);
    if (opts.onSelect) tile.setInteractive({ useHandCursor: true }).on('pointerdown', () => opts.onSelect!(index));
    keep(sink, tile);
    const cur = drawSelectionCursor(scene, cell.x, cell.y, cell.w, cell.h, selected, { depth: 8 });
    if (cur) keep(sink, cur);
    if (scene.textures.exists(NAV_ICON_KEYS[index])) {
      keep(sink, scene.add.image(cell.x + 11, cell.y + Math.floor(cell.h / 2), NAV_ICON_KEYS[index]).setDisplaySize(18, 18).setDepth(9));
    }
    keep(sink, addText(scene, cell.x + 24, cell.y + Math.floor(cell.h / 2) - 4, entry.label, 'menuLabel', selected ? '#ffffff' : '#d6e0cc', 9));
  });

  drawHelpBar(scene, opts.help, sink);
}

export function renderPartyScreen(
  scene: Phaser.Scene,
  opts: {
    storage: boolean;
    partyCount: number;
    storageCount: number;
    creatures: CreatureInstance[];
    selectedIndex: number;
    cursor: number;
    partyAction: boolean;
    actions: string[];
    help: string;
    note?: string;
  },
  sink: UiSink,
): void {
  const subtitle = opts.storage ? `BOX ${opts.storageCount}/120` : `PARTY ${opts.partyCount}/6`;
  drawPageHeader(scene, { title: 'CREATURES', subtitle, iconKey: 'ui-icon-creatures', rightLabel: opts.storage ? undefined : `${opts.selectedIndex + 1}/${opts.creatures.length}` }, sink);
  drawSegmentedControl(scene, 6, 24, ['PARTY', 'BOX'], opts.storage ? 1 : 0, sink);

  if (!opts.creatures.length) {
    keep(sink, raisedPanel(scene, 8, 40, 224, 90));
    drawEmptyState(scene, 8, 55, 224, 'No creatures', opts.storage ? 'This box is empty.' : 'Your party is empty.', 'ui-icon-empty', sink);
    drawHelpBar(scene, 'B: BACK', sink);
    return;
  }

  const selected = opts.creatures[opts.selectedIndex] ?? opts.creatures[0];
  const species = SPECIES[selected.speciesId];
  const stats = calculateStats(selected, species);
  const ratio = Math.max(0, selected.currentHp / stats.hp);

  // Preview panel
  keep(sink, raisedPanel(scene, 5, 38, 84, 96, UI_COLORS.paperWarm));
  keep(sink, recessedPanel(scene, 9, 42, 76, 48));
  keep(sink, scene.add.image(47, 62, `${species.id}-front`).setDisplaySize(50, 50).setDepth(6));
  keep(sink, addText(scene, 11, 94, (selected.nickname || species.name).toUpperCase(), 'menuLabel', undefined, 6));
  keep(sink, addText(scene, 11, 104, `Lv${selected.level}`, 'bodyMuted', undefined, 6));
  const meter = drawHpMeter(scene, 11, 116, 66, 5, ratio, 6);
  keep(sink, meter.bg);
  keep(sink, meter.fill);
  keep(sink, addText(scene, 11, 123, `${selected.currentHp}/${stats.hp}`, 'compact', undefined, 6));
  if (selected.status) keep(sink, addText(scene, 11, 130, selected.status.toUpperCase(), 'badge', '#9f4034', 6));
  else if (selected.heldItem) keep(sink, addText(scene, 11, 130, ITEMS[selected.heldItem].name, 'compact', '#7b6843', 6));

  // Roster rows
  const { start, end } = pageWindow(opts.selectedIndex, opts.creatures.length, 6);
  opts.creatures.slice(start, end).forEach((creature, row) => {
    const abs = start + row;
    const sp = SPECIES[creature.speciesId];
    const st = calculateStats(creature, sp);
    const r = Math.max(0, creature.currentHp / st.hp);
    const y = 38 + row * 16;
    const sel = abs === opts.selectedIndex;
    drawListRow(scene, {
      x: 93, y, w: 139, h: 14,
      label: (creature.nickname || sp.name).toUpperCase(),
      right: `Lv${creature.level}`,
      selected: sel,
    }, sink);
    const m = drawHpMeter(scene, 97, y + 11, 80, 2, r, 7);
    keep(sink, m.bg);
    keep(sink, m.fill);
    if (creature.status) keep(sink, addText(scene, 210, y + 3, creature.status.slice(0, 3).toUpperCase(), 'badge', sel ? '#fff' : '#9f4034', 7));
    else if (creature.heldItem) keep(sink, scene.add.rectangle(218, y + 7, 4, 4, UI_COLORS.accentGold).setAngle(45).setDepth(7));
    if (!opts.storage && abs === 0) keep(sink, addText(scene, 95, y + 3, '*', 'badge', '#d2af42', 8));
  });

  // Action panel
  if (opts.partyAction) {
    keep(sink, raisedPanel(scene, 118, 70, 110, 64, UI_COLORS.paperWarm, 8));
    opts.actions.forEach((action, index) => {
      drawListRow(scene, {
        x: 124, y: 76 + index * 13, w: 98, h: 12,
        label: action,
        selected: index === opts.cursor,
      }, sink);
    });
  }

  drawHelpBar(scene, opts.note || opts.help, sink, Boolean(opts.note));
}

export function renderItemIcon(scene: Phaser.Scene, item: ItemDefinition, x: number, y: number, sink: UiSink, depth = 6): void {
  if (item.category === 'capture') {
    const img = scene.add.image(x, y, 'capture-pod').setDisplaySize(28, 28).setDepth(depth);
    if (item.id === 'greatPod') img.setTint(0xc5e8ee);
    keep(sink, img);
    return;
  }
  const iconKey = item.category === 'recovery' ? 'ui-icon-medicine'
    : item.category === 'held' ? 'ui-icon-held' : 'ui-icon-key';
  if (scene.textures.exists(iconKey)) {
    keep(sink, scene.add.image(x, y, iconKey).setDisplaySize(24, 24).setDepth(depth));
  }
}

export function renderBagScreen(
  scene: Phaser.Scene,
  opts: {
    money: number;
    pocket: number;
    stacks: Array<{ itemId: string; count: number }>;
    selectedIndex: number;
    cursor: number;
    bagMode: 'browse' | 'actions' | 'quantity' | 'target';
    actions: string[];
    bagQuantity: number;
    selectedItem?: ItemDefinition;
    selectedCount: number;
    help: string;
    note?: string;
  },
  sink: UiSink,
): void {
  drawPageHeader(scene, { title: 'BAG', subtitle: `${opts.money} LUMEN`, iconKey: 'ui-icon-bag' }, sink);

  POCKET_DEFS.forEach((pocket, index) => {
    const x = 5 + index * 57;
    const sel = index === opts.pocket;
    keep(sink, scene.add.rectangle(x, 24, 54, UI_SPACING.tabH, sel ? UI_COLORS.accentGold : UI_COLORS.surfaceLight).setOrigin(0).setDepth(5));
    if (scene.textures.exists(pocket.icon)) keep(sink, scene.add.image(x + 9, 30, pocket.icon).setDisplaySize(12, 12).setDepth(6));
    keep(sink, addText(scene, x + 19, 27, pocket.label, 'compact', sel ? '#24342d' : '#d6e0cc', 6));
  });

  keep(sink, raisedPanel(scene, 5, 40, 112, 98));
  keep(sink, raisedPanel(scene, 120, 40, 115, 98, UI_COLORS.paperCool));

  if (!opts.stacks.length) {
    drawEmptyState(scene, 5, 55, 112, 'Pocket empty', 'Items of this type will appear here.', POCKET_DEFS[opts.pocket]?.icon ?? 'ui-icon-empty', sink);
  } else {
    const { start, end } = pageWindow(opts.selectedIndex, opts.stacks.length, 7);
    opts.stacks.slice(start, end).forEach((stack, row) => {
      const abs = start + row;
      const item = ITEMS[stack.itemId];
      const y = 46 + row * 12;
      drawListRow(scene, {
        x: 9, y, w: 104, h: 11,
        label: item.name,
        right: `×${stack.count}`,
        selected: abs === opts.selectedIndex,
      }, sink);
    });
    if (start > 0) keep(sink, addText(scene, 61, 42, '▲', 'compact', '#52665c', 6).setOrigin(0.5, 0));
    if (end < opts.stacks.length) keep(sink, addText(scene, 61, 130, '▼', 'compact', '#52665c', 6).setOrigin(0.5, 0));
  }

  if (opts.selectedItem) {
    renderItemIcon(scene, opts.selectedItem, 176, 58, sink);
    keep(sink, addText(scene, 128, 82, opts.selectedItem.name.toUpperCase(), 'menuLabel', undefined, 6));
    keep(sink, addText(scene, 128, 94, wrapBitmapText(opts.selectedItem.description, 17, 3), 'compact', undefined, 6));
    keep(sink, addText(scene, 128, 120, opts.selectedItem.price ? `VALUE ${opts.selectedItem.price} L` : 'KEY ITEM', 'compact', '#7b6843', 6));
    keep(sink, addText(scene, 128, 128, `OWN ${opts.selectedCount}`, 'numeric', undefined, 6));
  }

  if (opts.bagMode === 'actions' && opts.selectedItem) {
    keep(sink, scene.add.rectangle(120, 40, 115, 98, 0x14221d, 0.5).setOrigin(0).setDepth(9));
    keep(sink, raisedPanel(scene, 130, 72, 96, 12 + opts.actions.length * 14, UI_COLORS.paper, 10));
    opts.actions.forEach((action, index) => {
      drawListRow(scene, { x: 136, y: 78 + index * 14, w: 84, h: 12, label: action, selected: index === opts.cursor }, sink);
    });
  }

  if (opts.bagMode === 'quantity' && opts.selectedItem) {
    keep(sink, scene.add.rectangle(120, 40, 115, 98, 0x14221d, 0.5).setOrigin(0).setDepth(9));
    keep(sink, raisedPanel(scene, 130, 76, 96, 48, UI_COLORS.paper, 10));
    keep(sink, addText(scene, 178, 82, `TOSS ${opts.selectedItem.name.toUpperCase()}?`, 'compact', undefined, 10).setOrigin(0.5, 0));
    keep(sink, addText(scene, 178, 98, String(opts.bagQuantity), 'pageTitle', '#7b6843', 10).setOrigin(0.5, 0));
    keep(sink, addText(scene, 155, 98, '◀', 'menuLabel', '#52665c', 10));
    keep(sink, addText(scene, 200, 98, '▶', 'menuLabel', '#52665c', 10));
  }

  drawHelpBar(scene, opts.note || opts.help, sink, Boolean(opts.note));
}

export function renderBagTargetScreen(
  scene: Phaser.Scene,
  opts: { item: ItemDefinition; party: CreatureInstance[]; cursor: number; help: string; note?: string },
  sink: UiSink,
): void {
  drawPageHeader(scene, { title: opts.item.category === 'held' ? 'GIVE ITEM' : 'USE ITEM', subtitle: opts.item.name.toUpperCase(), iconKey: 'ui-icon-bag' }, sink);
  keep(sink, raisedPanel(scene, 5, 27, 62, 112, UI_COLORS.paperCool));
  renderItemIcon(scene, opts.item, 36, 52, sink);
  keep(sink, addText(scene, 12, 78, wrapBitmapText(opts.item.description, 8, 5), 'compact', undefined, 6));
  keep(sink, raisedPanel(scene, 70, 27, 165, 112));
  opts.party.forEach((creature, index) => {
    const sp = SPECIES[creature.speciesId];
    const maxHp = calculateStats(creature, sp).hp;
    const y = 33 + index * 17;
    drawListRow(scene, {
      x: 76, y, w: 153, h: 15,
      label: (creature.nickname || sp.name).toUpperCase(),
      right: `${creature.currentHp}/${maxHp}`,
      selected: index === opts.cursor,
    }, sink);
    const sub = opts.item.category === 'held'
      ? `Held: ${creature.heldItem ? ITEMS[creature.heldItem].name : 'None'}`
      : creature.status ? creature.status : 'Status: OK';
    keep(sink, addText(scene, 81, y + 8, sub, 'compact', '#7b6843', 7));
  });
  drawHelpBar(scene, opts.note || opts.help, sink, Boolean(opts.note));
}

export function renderGuideScreen(
  scene: Phaser.Scene,
  opts: {
    guideIds: string[];
    cursor: number;
    seen: string[];
    caught: string[];
    help: string;
  },
  sink: UiSink,
): void {
  drawPageHeader(scene, {
    title: 'FIELD GUIDE',
    subtitle: `${opts.seen.length} SEEN  ${opts.caught.length} CAUGHT`,
    iconKey: 'ui-icon-guide',
    rightLabel: `${opts.caught.length}/${opts.guideIds.length}`,
  }, sink);
  keep(sink, drawProgressMeter(scene, 6, 24, 228, opts.caught.length / Math.max(1, opts.guideIds.length), 5));

  keep(sink, raisedPanel(scene, 5, 30, 106, 108));
  keep(sink, raisedPanel(scene, 114, 30, 121, 108, UI_COLORS.paperCool));

  const { start, end } = pageWindow(opts.cursor, opts.guideIds.length, 7);
  opts.guideIds.slice(start, end).forEach((id, row) => {
    const abs = start + row;
    const y = 34 + row * 14;
    const seen = opts.seen.includes(id);
    const caught = opts.caught.includes(id);
    const name = seen ? SPECIES[id].name : '???';
    drawListRow(scene, {
      x: 9, y, w: 98, h: 13,
      label: `${String(abs + 1).padStart(3, '0')} ${name}`,
      selected: abs === opts.cursor,
      iconKey: caught ? 'ui-icon-caught' : seen ? 'ui-icon-seen' : 'ui-icon-unknown',
    }, sink);
  });

  const id = opts.guideIds[opts.cursor];
  const species = SPECIES[id];
  const seen = opts.seen.includes(id);
  const caught = opts.caught.includes(id);
  const art = scene.add.image(174, 58, `${id}-front`).setDisplaySize(58, 58).setDepth(6);
  if (!seen) art.setTint(0x172219);
  keep(sink, art);
  keep(sink, addText(scene, 120, 34, `No. ${String(opts.cursor + 1).padStart(3, '0')}`, 'bodyMuted', undefined, 6));
  keep(sink, addText(scene, 120, 86, seen ? species.name.toUpperCase() : 'UNKNOWN', 'panelTitle', undefined, 6));
  if (seen) {
    species.types.forEach((type, i) => { if (type) drawTypeBadge(scene, 120 + i * 50, 96, type, typeColor, sink); });
    keep(sink, addText(scene, 120, 109, `${species.height.toFixed(1)}m  ${species.weight.toFixed(1)}kg`, 'compact', undefined, 6));
    keep(sink, addText(scene, 120, 118, `${caught ? 'Captured' : 'Seen'} · ${species.habitat}`, 'compact', caught ? '#8b6b25' : '#52665c', 6));
    keep(sink, addText(scene, 120, 127, wrapBitmapText(species.description, 24, 2), 'tinyHint', '#52665c', 6));
  } else {
    drawEmptyState(scene, 114, 100, 121, 'No data', 'Encounter this species to unlock research notes.', 'ui-icon-unknown', sink);
  }
  drawHelpBar(scene, opts.help, sink);
}

export function renderPlayerCard(
  scene: Phaser.Scene,
  opts: { name: string; avatar: 'a' | 'b'; id: string; money: number; guideCaught: number; guideTotal: number; crests: string[]; location?: string },
  sink: UiSink,
): void {
  drawPageHeader(scene, { title: 'PLAYER CARD', subtitle: 'GENERATION LEAGUE', iconKey: 'ui-icon-card' }, sink);
  const card = scene.add.graphics().setDepth(4);
  card.fillStyle(UI_COLORS.paperCool, 1).fillRect(10, 28, 220, 112);
  card.fillStyle(UI_COLORS.borderMid, 1).fillRect(10, 28, 220, 2).fillRect(10, 138, 220, 2).fillRect(10, 28, 2, 112).fillRect(228, 28, 2, 112);
  card.fillStyle(UI_COLORS.accentTeal, 1).fillRect(12, 30, 216, 18);
  card.fillStyle(UI_COLORS.recessed, 0.4).fillRect(14, 52, 58, 68);
  keep(sink, card);
  keep(sink, scene.add.sprite(43, 82, `avatar-${opts.avatar}`, 0).setScale(0.6).setDepth(5));
  keep(sink, addText(scene, 80, 33, opts.name.toUpperCase(), 'pageTitle', '#f7f8df', 6));
  keep(sink, addText(scene, 80, 56, `ID ${opts.id}`, 'bodyMuted', undefined, 6));
  if (opts.location) keep(sink, addText(scene, 80, 68, opts.location, 'compact', undefined, 6));
  keep(sink, addText(scene, 80, 82, `Money   ${opts.money} L`, 'body', undefined, 6));
  keep(sink, addText(scene, 80, 94, `Guide   ${opts.guideCaught} / ${opts.guideTotal}`, 'body', undefined, 6));
  keep(sink, addText(scene, 80, 106, `Crests  ${opts.crests.length} / 3`, 'body', undefined, 6));
  const crestIds = ['glimmer', 'cinder', 'tide'];
  const crestColors = [0x73a96b, 0xc76a43, 0x5a9eb0];
  crestIds.forEach((crest, i) => {
    const owned = opts.crests.includes(crest);
    keep(sink, scene.add.circle(96 + i * 34, 126, 9, owned ? crestColors[i] : UI_COLORS.disabled).setDepth(5).setStrokeStyle(1, UI_COLORS.borderDeep));
    if (!owned) keep(sink, scene.add.image(96 + i * 34, 126, 'ui-icon-crest-empty').setDisplaySize(14, 14).setDepth(6));
  });
  drawHelpBar(scene, 'A / B: Return', sink);
}

export function renderOptionsScreen(
  scene: Phaser.Scene,
  opts: { options: GameOptions; cursor: number; rows: string[]; values: string[]; help: string },
  sink: UiSink,
): void {
  drawPageHeader(scene, { title: 'OPTIONS', subtitle: 'L/R TO CHANGE', iconKey: 'ui-icon-options' }, sink);
  keep(sink, raisedPanel(scene, 10, 27, 220, 113));

  const sections = [
    { label: 'BATTLE', start: 0, end: 2 },
    { label: 'AUDIO', start: 2, end: 5 },
    { label: 'ACCESS', start: 5, end: 7 },
  ];

  let y = 31;
  sections.forEach((sec) => {
    keep(sink, addText(scene, 16, y, sec.label, 'compact', '#7b6843', 6));
    y += 7;
    for (let i = sec.start; i < sec.end && i < opts.rows.length; i++) {
      const selected = i === opts.cursor;
      drawListRow(scene, { x: 16, y, w: 208, h: 11, label: opts.rows[i], right: opts.values[i], selected }, sink);
      if (i === 2 || i === 3) {
        const vol = i === 2 ? opts.options.musicVolume : opts.options.sfxVolume;
        keep(sink, drawVolumeMeter(scene, 150, y + 2, 8, Math.round(vol * 8), 7));
      }
      if (i === 0 || i === 4 || i === 5) {
        const on = i === 0 ? opts.options.battleScene : i === 4 ? opts.options.muted : opts.options.reducedMotion;
        keep(sink, drawToggleSwitch(scene, 188, y + 1, on, 7));
      }
      y += 12;
    }
    y += 1;
  });

  drawHelpBar(scene, opts.help, sink);
}

export function renderSummaryScreen(
  scene: Phaser.Scene,
  opts: { creature: CreatureInstance; summaryPage: number },
  sink: UiSink,
): void {
  const { creature } = opts;
  const species = SPECIES[creature.speciesId];
  drawPageHeader(scene, { title: 'SUMMARY', subtitle: `PAGE ${opts.summaryPage + 1}/4`, iconKey: 'ui-icon-creatures' }, sink);
  keep(sink, raisedPanel(scene, 5, 25, 230, 118));
  keep(sink, recessedPanel(scene, 10, 30, 70, 72));
  keep(sink, scene.add.image(45, 62, `${species.id}-front`).setDisplaySize(58, 58).setDepth(6));
  keep(sink, addText(scene, 12, 106, `No.${String(species.regionalNumber).padStart(3, '0')} ${species.name.toUpperCase()}`, 'menuLabel', undefined, 6));
  keep(sink, addText(scene, 12, 118, `Lv${creature.level}`, 'bodyMuted', undefined, 6));
  keep(sink, addText(scene, 12, 128, creature.status ? creature.status.toUpperCase() : 'STATUS OK', 'compact', creature.status ? '#9f4034' : '#7b6843', 6));

  if (opts.summaryPage === 0) {
    species.types.forEach((type, i) => { if (type) drawTypeBadge(scene, 88 + i * 50, 36, type, typeColor, sink); });
    keep(sink, addText(scene, 88, 52, `Ability  ${creature.ability}`, 'compact', undefined, 6));
    keep(sink, addText(scene, 88, 62, `Nature   ${creature.nature}`, 'compact', undefined, 6));
    keep(sink, addText(scene, 88, 72, `Height   ${species.height.toFixed(1)} m`, 'compact', undefined, 6));
    keep(sink, addText(scene, 88, 82, `Weight   ${species.weight.toFixed(1)} kg`, 'compact', undefined, 6));
    keep(sink, addText(scene, 88, 96, `OT  ${creature.capture.originalTrainer}`, 'compact', undefined, 6));
    keep(sink, addText(scene, 88, 106, `Met Lv${creature.capture.metLevel}`, 'compact', undefined, 6));
    keep(sink, addText(scene, 88, 116, `Held  ${creature.heldItem ? ITEMS[creature.heldItem].name : 'None'}`, 'compact', undefined, 6));
  } else if (opts.summaryPage === 1) {
    const stats = calculateStats(creature, species);
    const rows: Array<[string, keyof typeof stats]> = [['HP', 'hp'], ['ATK', 'attack'], ['DEF', 'defense'], ['SP.A', 'spAttack'], ['SP.D', 'spDefense'], ['SPD', 'speed']];
    keep(sink, addText(scene, 88, 34, 'STAT   NOW  IV  EV', 'compact', '#7b6843', 6));
    rows.forEach(([name, key], i) => {
      keep(sink, addText(scene, 88, 44 + i * 10, `${name}  ${stats[key]}  ${creature.ivs[key]}  ${creature.evs[key]}`, 'compact', undefined, 6));
    });
    keep(sink, addText(scene, 88, 108, `HP ${creature.currentHp}/${stats.hp}`, 'body', undefined, 6));
  } else if (opts.summaryPage === 2) {
    creature.moves.forEach((known, i) => {
      const move = MOVES[known.moveId];
      keep(sink, addText(scene, 88, 38 + i * 16, move.name.toUpperCase(), 'menuLabel', undefined, 6));
      keep(sink, addText(scene, 88, 47 + i * 16, `${move.category} · ${move.type} · ${known.pp}/${known.maxPp} PP`, 'compact', undefined, 6));
    });
  } else {
    const next = species.evolution;
    const nextExp = creature.level >= 100 ? 'MAX' : String(Math.max(0, expForLevel(creature.level + 1, species.growthCurve) - creature.experience));
    keep(sink, addText(scene, 88, 38, `EXP ${creature.experience}`, 'body', undefined, 6));
    keep(sink, addText(scene, 88, 50, `To next ${nextExp}`, 'body', undefined, 6));
    keep(sink, addText(scene, 88, 62, `Friendship ${creature.friendship}/255`, 'body', undefined, 6));
    keep(sink, addText(scene, 88, 76, next ? `Evolves Lv${next.level}` : 'Final stage', 'compact', undefined, 6));
    keep(sink, addText(scene, 88, 90, wrapBitmapText(species.description, 22, 4), 'compact', undefined, 6));
  }
  drawHelpBar(scene, 'L/R: Page   B: Back', sink);
}

export function renderSaveModal(scene: Phaser.Scene, opts: { title: string; message: string; success: boolean }, sink: UiSink): void {
  drawModalShell(scene, 40, 48, 160, 64, opts.title, sink);
  const icon = opts.success ? 'ui-icon-success' : 'ui-icon-warning';
  if (scene.textures.exists(icon)) keep(sink, scene.add.image(56, 72, icon).setDisplaySize(22, 22).setDepth(30));
  keep(sink, addText(scene, 72, 70, opts.message, 'body', undefined, 30));
}

export function genderGlyph(gender: CreatureInstance['gender']): string {
  return gender === 'male' ? '♂' : gender === 'female' ? '♀' : '·';
}
