import Phaser from 'phaser';
import { audio } from '../audio';
import { controls } from '../controls';
import { createCreature, ITEMS, MOVES, SPECIES } from '../data';
import { configureGbaCamera } from '../display';
import { applyItemEffects } from '../effects';
import { BASE_STAGES, calculateStats } from '../rules';
import { resolveDoubleTurn, type DoubleBattleState, type DoubleAction } from '../doubleBattle';
import { gameStore } from '../state';
import { rewardMultiplier } from '../triggers';
import type { BattleEvent, CreatureInstance, TrainerDefinition } from '../types';
import { COLORS, hpColor, label, panel, textStyle } from '../ui';

type DoubleMode = 'command' | 'moves' | 'target' | 'bag' | 'party' | 'itemTarget' | 'locked';
interface DoubleBattleInit { trainer: TrainerDefinition; mapId: string }

export class DoubleBattleScene extends Phaser.Scene {
  private trainer!: TrainerDefinition;
  private mapId = '';
  private state!: DoubleBattleState;
  private mode: DoubleMode = 'locked';
  private cursor = 0;
  private commandSlot: 0 | 1 = 0;
  private selectedMoveIndex = 0;
  private pendingActions: [DoubleAction['action'] | null, DoubleAction['action'] | null] = [null, null];
  private selectedItemId = '';
  private playerSprites: Phaser.GameObjects.Image[] = [];
  private enemySprites: Phaser.GameObjects.Image[] = [];
  private playerBars: Phaser.GameObjects.Rectangle[] = [];
  private enemyBars: Phaser.GameObjects.Rectangle[] = [];
  private playerHpText: Phaser.GameObjects.Text[] = [];
  private enemyHpText: Phaser.GameObjects.Text[] = [];
  private uiObjects: Phaser.GameObjects.GameObject[] = [];
  private dialogue!: Phaser.GameObjects.Text;
  private rewarded = new Set<string>();

  constructor() { super('DoubleBattle'); }

  init(data: DoubleBattleInit) { this.trainer = data.trainer; this.mapId = data.mapId; }

  create() {
    configureGbaCamera(this);
    controls.clear();
    this.mode = 'locked';
    this.cursor = 0;
    this.commandSlot = 0;
    this.selectedMoveIndex = 0;
    this.pendingActions = [null, null];
    this.selectedItemId = '';
    this.rewarded.clear();
    this.playerSprites = [];
    this.enemySprites = [];
    this.playerBars = [];
    this.enemyBars = [];
    this.playerHpText = [];
    this.enemyHpText = [];
    if (!gameStore.save || this.trainer.party.length < 2) { this.scene.start('Battle', { kind: 'trainer', trainer: this.trainer, mapId: this.mapId }); return; }

    const enemyParty = this.trainer.party.map((entry) => createCreature(entry.speciesId, entry.level, this.trainer.name, this.mapId, gameStore.rng));
    const playerIndices = this.firstAlivePair(gameStore.save.party);
    if (playerIndices[0] === playerIndices[1]) { this.scene.start('Battle', { kind: 'trainer', trainer: this.trainer, mapId: this.mapId }); return; }
    this.state = {
      player: { party: gameStore.save.party, active: playerIndices[0], activeSlots: playerIndices, stages: { ...BASE_STAGES }, protected: false, protectedSlots: [false, false], participants: playerIndices.map((index) => gameStore.save!.party[index].uid), protectStreak: 0 },
      enemy: { party: enemyParty, active: 0, activeSlots: [0, 1], stages: { ...BASE_STAGES }, protected: false, protectedSlots: [false, false], participants: [] as string[], protectStreak: 0 },
      field: { effect: null, turns: 0 }, turn: 0, ended: false, winner: null,
    };
    enemyParty.forEach((creature) => gameStore.see(creature.speciesId));
    document.body.dataset.gameScene = 'double-battle';
    this.renderArena();
    this.renderCombatants();
    this.renderStatus();
    this.renderDialogue();
    this.showText(`${this.trainer.name} sent out two partners!`);
    this.cameras.main.flash(220, 238, 242, 207);
    audio.playMusic(this, this.trainer.boss ? 'dream' : 'plain');
    this.time.delayedCall(700, () => this.openCommand());
  }

  update() {
    if (this.mode === 'locked') return;
    const count = this.mode === 'target' ? 2 : this.mode === 'command' || this.mode === 'moves' ? 4 : this.mode === 'bag' ? Math.max(1, this.availableBag().length) : this.state.player.party.length;
    if (controls.pressed('LEFT')) { this.cursor = (this.cursor + count - 1) % count; audio.sfx('confirm'); this.renderMenu(); }
    if (controls.pressed('RIGHT')) { this.cursor = (this.cursor + 1) % count; audio.sfx('confirm'); this.renderMenu(); }
    if (controls.pressed('UP')) { this.cursor = (this.cursor + count - 2) % count; audio.sfx('confirm'); this.renderMenu(); }
    if (controls.pressed('DOWN')) { this.cursor = (this.cursor + 2) % count; audio.sfx('confirm'); this.renderMenu(); }
    if (controls.pressed('B')) {
      if (this.mode === 'target') { this.mode = 'moves'; this.cursor = this.selectedMoveIndex; this.showText(`Choose ${this.playerName(this.commandSlot)}'s move.`); this.renderMenu(); }
      else if (this.mode === 'moves' || this.mode === 'bag' || this.mode === 'party') { this.openCommand(); }
      else if (this.mode === 'itemTarget') { this.mode = 'bag'; this.cursor = 0; this.showText('Choose an item.'); this.renderMenu(); }
    }
    if (controls.pressed('A')) this.choose();
  }

  private firstAlivePair(party: CreatureInstance[]) {
    const pair = party.map((creature, index) => creature.currentHp > 0 ? index : -1).filter((index) => index >= 0).slice(0, 2);
    return [pair[0] ?? 0, pair[1] ?? pair[0] ?? 0] as [number, number];
  }
  private player(slot: 0 | 1) { return this.state.player.party[this.state.player.activeSlots[slot]]; }
  private enemy(slot: 0 | 1) { return this.state.enemy.party[this.state.enemy.activeSlots[slot]]; }
  private firstMove(creature: CreatureInstance) { return creature.moves.findIndex((known) => known.pp > 0); }
  private playerName(slot: 0 | 1) { const creature = this.player(slot); return creature.nickname || SPECIES[creature.speciesId].name; }
  private enemyName(slot: 0 | 1) { return SPECIES[this.enemy(slot).speciesId].name; }

  private renderArena() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x9fd1be, 0x9fd1be, 0xe7edbd, 0xe7edbd, 1).fillRect(0, 0, 240, 111);
    g.fillStyle(0xf1efd2).fillRect(0, 111, 240, 49);
    for (let y = 4; y < 108; y += 5) g.fillStyle(0xffffff, .08).fillRect(0, y, 240, 1);
    g.fillStyle(0x7fb987, .36).fillEllipse(174, 66, 108, 22);
    g.fillStyle(0x709c67, .45).fillEllipse(62, 118, 126, 28);
    g.fillStyle(0x4c5849).fillRect(0, 110, 240, 2);
  }

  private renderCombatants() {
    const enemyPositions: Array<[number, number]> = [[157, 48], [207, 42]];
    const playerPositions: Array<[number, number]> = [[48, 105], [98, 100]];
    this.enemySprites = [0, 1].map((slot) => this.add.image(...enemyPositions[slot], `${this.enemy(slot as 0 | 1).speciesId}-front`).setDisplaySize(52, 52).setOrigin(.5, .6).setDepth(4));
    this.playerSprites = [0, 1].map((slot) => this.add.image(...playerPositions[slot], `${this.player(slot as 0 | 1).speciesId}-back`).setDisplaySize(62, 62).setOrigin(.5, .72).setDepth(5));
    this.enemySprites.forEach((sprite) => this.tweens.add({ targets: sprite, y: sprite.y - 2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
    this.playerSprites.forEach((sprite) => this.tweens.add({ targets: sprite, y: sprite.y + 2, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
  }

  private renderStatus() {
    const enemyCards: Array<[number, number]> = [[8, 6], [126, 6]];
    const playerCards: Array<[number, number]> = [[8, 77], [126, 77]];
    [0, 1].forEach((slot) => {
      const enemy = this.enemy(slot as 0 | 1); const player = this.player(slot as 0 | 1);
      const [ex, ey] = enemyCards[slot]; const [px, py] = playerCards[slot];
      panel(this, ex, ey, 106, 28, COLORS.paper, 8); panel(this, px, py, 106, 28, COLORS.paper, 8);
      label(this, ex + 6, ey + 5, `${this.enemyName(slot as 0 | 1).toUpperCase()} Lv${enemy.level}`, 6, '#182017', 9);
      label(this, px + 6, py + 5, `${this.playerName(slot as 0 | 1).toUpperCase()} Lv${player.level}`, 6, '#182017', 9);
      label(this, ex + 6, ey + 16, 'HP', 5, '#aa4b35', 9); label(this, px + 6, py + 16, 'HP', 5, '#aa4b35', 9);
      this.add.rectangle(ex + 22, ey + 17, 76, 4, 0x263226).setOrigin(0).setDepth(9); this.add.rectangle(px + 22, py + 17, 76, 4, 0x263226).setOrigin(0).setDepth(9);
      this.enemyBars[slot] = this.add.rectangle(ex + 23, ey + 18, 74, 2, 0x5ca85c).setOrigin(0).setDepth(10);
      this.playerBars[slot] = this.add.rectangle(px + 23, py + 18, 74, 2, 0x5ca85c).setOrigin(0).setDepth(10);
      this.enemyHpText[slot] = label(this, ex + 98, ey + 22, '', 5, '#52665c', 10).setOrigin(1, 0);
      this.playerHpText[slot] = label(this, px + 98, py + 22, '', 5, '#52665c', 10).setOrigin(1, 0);
    });
    this.updateHpBars();
  }

  private renderDialogue() { panel(this, 3, 113, 234, 44, COLORS.paper, 15); this.dialogue = this.add.text(11, 121, '', textStyle(8, '#182017')).setDepth(16).setWordWrapWidth(214); }
  private showText(value: string) { this.dialogue?.setText(value); }
  private clearMenu() { this.uiObjects.forEach((object) => object.destroy()); this.uiObjects = []; }
  private openCommand() { this.mode = 'command'; this.cursor = 0; this.showText(`What will ${this.playerName(this.commandSlot)} do?`); this.renderMenu(); }
  private renderMenu() {
    this.clearMenu(); if (this.mode === 'locked') return;
    if (this.mode === 'command') {
      this.drawGrid(['FIGHT', 'BAG', 'PARTY', 'RUN']);
      this.uiObjects.push(label(this, 120, 151, `A: CHOOSE ${this.playerName(this.commandSlot).toUpperCase()}`, 5, '#f1f1d0', 30).setOrigin(.5, 0));
      return;
    }
    if (this.mode === 'moves') {
      const creature = this.player(this.commandSlot); const names = Array.from({ length: 4 }, (_, index) => creature.moves[index] ? MOVES[creature.moves[index].moveId].name : '---');
      this.drawGrid(names); this.uiObjects.push(label(this, 120, 151, 'A: CHOOSE MOVE   B: BACK', 5, '#f1f1d0', 30).setOrigin(.5, 0));
      return;
    }
    if (this.mode === 'target') {
      const names = [this.enemyName(0), this.enemyName(1)];
      this.drawGrid(names); this.uiObjects.push(label(this, 120, 151, 'A: TARGET   B: BACK', 5, '#f1f1d0', 30).setOrigin(.5, 0));
      return;
    }
    if (this.mode === 'bag') { this.drawBattleBag(); return; }
    this.drawBattleParty();
  }
  private drawGrid(values: string[]) { values.forEach((value, index) => { const x = 9 + (index % 2) * 110; const y = 117 + Math.floor(index / 2) * 17; const selected = index === this.cursor; const bg = this.add.rectangle(x, y, 106, 15, selected ? COLORS.blue : 0xe5e6c7).setOrigin(0).setDepth(20).setInteractive(); const text = label(this, x + 5, y + 4, `${selected ? '▶ ' : ''}${value.toUpperCase()}`, 7, selected ? '#fff' : '#182017', 21); bg.on('pointerdown', () => { this.cursor = index; this.choose(); }); this.uiObjects.push(bg, text); }); }

  private availableBag() { return gameStore.save!.inventory.filter((stack) => stack.count > 0 && ITEMS[stack.itemId]?.category === 'recovery'); }

  private drawBattleBag() {
    const bag = this.availableBag();
    if (!bag.length) { this.showText('There are no usable recovery items.'); return; }
    const shade = this.add.rectangle(0, 0, 240, 160, 0x0b1610, .78).setOrigin(0).setDepth(25);
    const shell = panel(this, 6, 7, 228, 146, COLORS.paper, 26);
    const title = label(this, 15, 15, 'BATTLE BAG', 11, '#20342f', 27);
    const hint = label(this, 225, 18, 'A: USE  B: BACK', 5, '#59684f', 27).setOrigin(1, 0);
    this.uiObjects.push(shade, shell, title, hint);
    bag.forEach((stack, index) => {
      const selected = index === this.cursor; const y = 38 + index * 17;
      const row = this.add.rectangle(13, y, 101, 15, selected ? COLORS.blue : 0xdce4c8).setOrigin(0).setDepth(27).setInteractive();
      const name = label(this, 19, y + 4, `${selected ? '▶ ' : ''}${ITEMS[stack.itemId].name}`, 7, selected ? '#fff' : '#20342f', 28);
      const count = label(this, 109, y + 4, `×${stack.count}`, 6, selected ? '#fff' : '#59684f', 28).setOrigin(1, 0);
      row.on('pointerdown', () => { this.cursor = index; this.choose(); }); this.uiObjects.push(row, name, count);
    });
    const stack = bag[this.cursor], item = stack && ITEMS[stack.itemId];
    if (item) {
      const icon = this.add.graphics().setDepth(28); icon.fillStyle(0x31514e).fillRoundedRect(166, 45, 20, 24, 4); icon.fillStyle(0xe9edcf).fillRect(171, 40, 10, 7); icon.fillStyle(0x8fc79d).fillRect(169, 54, 14, 7);
      const itemName = label(this, 128, 80, item.name.toUpperCase(), 8, '#20342f', 28); const description = this.add.text(128, 94, item.description, textStyle(6, '#52665c')).setDepth(28).setWordWrapWidth(94);
      this.uiObjects.push(icon, itemName, description);
    }
  }

  private drawBattleParty() {
    const shade = this.add.rectangle(0, 0, 240, 160, 0x0b1610, .78).setOrigin(0).setDepth(25);
    const shell = panel(this, 6, 7, 228, 146, COLORS.paper, 26);
    const title = label(this, 15, 15, this.mode === 'itemTarget' ? `USE ${ITEMS[this.selectedItemId].name.toUpperCase()}` : 'CHOOSE A CREATURE', 10, '#20342f', 27);
    const hint = label(this, 225, 18, 'A: CHOOSE  B: BACK', 5, '#59684f', 27).setOrigin(1, 0);
    this.uiObjects.push(shade, shell, title, hint);
    this.state.player.party.forEach((creature, index) => {
      const species = SPECIES[creature.speciesId]; const max = calculateStats(creature, species).hp; const ratio = Math.max(0, creature.currentHp / max); const selected = index === this.cursor; const y = 35 + index * 18;
      const row = this.add.rectangle(13, y, 214, 16, selected ? COLORS.blue : 0xdce4c8).setOrigin(0).setDepth(27).setInteractive();
      const name = label(this, 20, y + 3, `${selected ? '▶ ' : ''}${creature.nickname || species.name}`, 7, selected ? '#fff' : '#20342f', 28);
      const level = label(this, 152, y + 3, `Lv${creature.level}`, 6, selected ? '#fff' : '#52665c', 28);
      const hp = label(this, 220, y + 3, `${creature.currentHp}/${max}`, 6, selected ? '#fff' : '#52665c', 28).setOrigin(1, 0);
      const barBg = this.add.rectangle(166, y + 12, 54, 2, 0x34443c).setOrigin(0).setDepth(28); const bar = this.add.rectangle(167, y + 12, 52 * ratio, 1, hpColor(ratio)).setOrigin(0).setDepth(29);
      row.on('pointerdown', () => { this.cursor = index; this.choose(); }); this.uiObjects.push(row, name, level, hp, barBg, bar);
      if (index === this.state.player.activeSlots[this.commandSlot]) this.uiObjects.push(label(this, 145, y + 10, 'ACTIVE', 5, selected ? '#eef1d5' : '#7b6843', 29).setOrigin(1, 0));
    });
  }

  private choose() {
    audio.sfx('confirm');
    if (this.mode === 'command') {
      if (this.cursor === 0) { this.mode = 'moves'; this.cursor = this.selectedMoveIndex; this.showText(`Choose ${this.playerName(this.commandSlot)}'s move.`); this.renderMenu(); }
      else if (this.cursor === 1) { this.mode = 'bag'; this.cursor = 0; this.showText('Choose a recovery item.'); this.renderMenu(); }
      else if (this.cursor === 2) { this.mode = 'party'; this.cursor = 0; this.showText(`Choose ${this.playerName(this.commandSlot)}'s replacement.`); this.renderMenu(); }
      else this.showText('You cannot flee from a trainer double battle.');
      return;
    }
    if (this.mode === 'moves') {
      const move = this.player(this.commandSlot).moves[this.cursor];
      if (!move || move.pp <= 0) { this.showText('That move has no PP left.'); return; }
      this.selectedMoveIndex = this.cursor; this.mode = 'target'; this.cursor = 0; this.showText('Choose a target.'); this.renderMenu(); return;
    }
    if (this.mode === 'target') { this.pendingActions[this.commandSlot] = { kind: 'move', moveIndex: this.selectedMoveIndex }; this.continueSelection(this.cursor as 0 | 1); return; }
    if (this.mode === 'party') {
      const selected = this.state.player.party[this.cursor];
      if (!selected || selected.currentHp <= 0 || this.state.player.activeSlots.includes(this.cursor)) { this.showText('That creature cannot switch in.'); return; }
      this.pendingActions[this.commandSlot] = { kind: 'switch', partyIndex: this.cursor }; this.continueSelection(this.cursor as 0 | 1); return;
    }
    if (this.mode === 'bag') {
      const stack = this.availableBag()[this.cursor]; const item = stack && ITEMS[stack.itemId];
      if (!item) return;
      this.selectedItemId = item.id; this.mode = 'itemTarget'; this.cursor = this.state.player.activeSlots[this.commandSlot]; this.showText(`Use ${item.name} on which creature?`); this.renderMenu(); return;
    }
    if (this.mode === 'itemTarget') {
      const creature = this.state.player.party[this.cursor]; const item = ITEMS[this.selectedItemId];
      if (!creature || creature.currentHp <= 0) { this.showText('Choose a standing creature.'); return; }
      const events = applyItemEffects(item, creature, SPECIES[creature.speciesId], gameStore.rng);
      if (!events.length || events.every((event) => event.kind === 'heal' && event.amount === 0)) { this.showText('It would have no effect.'); return; }
      gameStore.useItem(item.id); events.forEach((event) => this.showText(event.text)); this.pendingActions[this.commandSlot] = { kind: 'item', itemId: item.id, targetIndex: this.cursor }; this.continueSelection(this.cursor as 0 | 1); return;
    }
  }

  private continueSelection(_target: 0 | 1) {
    const next = this.pendingActions.findIndex((action) => action === null);
    if (next >= 0) { this.commandSlot = next as 0 | 1; this.openCommand(); return; }
    void this.perform();
  }

  private async perform() {
    this.mode = 'locked'; this.clearMenu();
    const leadMove = this.pendingActions[0]; const partnerMove = this.pendingActions[1];
    const actions: DoubleAction[] = [
      { side: 'player', slot: 0, action: leadMove ?? { kind: 'struggle' }, targetSlot: 0 },
      { side: 'player', slot: 1, action: partnerMove ?? { kind: 'struggle' }, targetSlot: 0 },
      ...([0, 1] as const).map((slot) => { const moveIndex = this.firstMove(this.enemy(slot)); return { side: 'enemy' as const, slot, action: moveIndex >= 0 ? { kind: 'move' as const, moveIndex } : { kind: 'struggle' as const }, targetSlot: slot === 0 ? 0 as const : 1 as const }; }),
    ];
    const events = resolveDoubleTurn(this.state, actions, SPECIES, MOVES, gameStore.rng);
    for (const event of events) await this.playEvent(event);
    await this.afterTurn();
  }

  private async playEvent(event: BattleEvent) {
    if (event.kind === 'move' && event.side) { this.showText(event.text); audio.sfx(MOVES[event.moveId!].audioCue); await this.wait(150); return; }
    if (event.kind === 'damage' && event.side) { if (event.text) this.showText(event.text); await this.damageFlash(event.side); this.updateHpBars(); await this.wait(event.text ? 280 : 100); return; }
    if (event.kind === 'faint' || event.kind === 'status' || event.kind === 'switch' || event.kind === 'field') { this.showText(event.text); this.updateHpBars(); await this.wait(event.kind === 'faint' ? 450 : 550); return; }
    if (event.kind === 'text' && event.text) { this.showText(event.text); await this.wait(500); }
  }

  private async afterTurn() {
    const participantIds = new Set(this.state.player.participants ?? []);
    const participants = this.state.player.party.filter((creature) => participantIds.has(creature.uid));
    for (const enemy of this.state.enemy.party) if (enemy.currentHp <= 0 && !this.rewarded.has(enemy.uid)) {
      this.rewarded.add(enemy.uid);
      for (const participant of participants) for (const message of gameStore.awardExperience(participant, enemy.speciesId, enemy.level, participants.length, true).messages) { this.showText(message); await this.wait(650); }
    }
    if (this.state.ended) { if (this.state.winner === 'player') await this.victory(); else await this.defeat(); return; }
    for (const slot of [0, 1] as const) {
      if (this.player(slot).currentHp <= 0) {
        const next = this.state.player.party.findIndex((creature, index) => creature.currentHp > 0 && !this.state.player.activeSlots.includes(index));
        if (next >= 0) { this.state.player.activeSlots[slot] = next; this.state.player.participants?.push(this.state.player.party[next].uid); this.replaceSprite('player', slot); this.showText(`Go ${this.playerName(slot)}!`); await this.wait(600); }
      }
      if (this.enemy(slot).currentHp <= 0) {
        const next = this.state.enemy.party.findIndex((creature, index) => creature.currentHp > 0 && !this.state.enemy.activeSlots.includes(index));
        if (next >= 0) { this.state.enemy.activeSlots[slot] = next; this.replaceSprite('enemy', slot); this.showText(`${this.trainer.name} sent out ${this.enemyName(slot)}!`); await this.wait(700); }
      }
    }
    this.pendingActions = [null, null]; this.commandSlot = 0; this.updateHpBars(); this.openCommand();
  }

  private replaceSprite(side: 'player' | 'enemy', slot: 0 | 1) {
    const sprites = side === 'player' ? this.playerSprites : this.enemySprites;
    const old = sprites[slot]; const position = { x: old.x, y: old.y }; old.destroy(); const creature = side === 'player' ? this.player(slot) : this.enemy(slot);
    sprites[slot] = this.add.image(position.x, position.y, `${creature.speciesId}-${side === 'player' ? 'back' : 'front'}`).setDisplaySize(side === 'player' ? 62 : 52, side === 'player' ? 62 : 52).setOrigin(.5, side === 'player' ? .72 : .6).setDepth(side === 'player' ? 5 : 4);
  }

  private updateHpBars() {
    if (!this.state) return;
    [0, 1].forEach((slot) => {
      const enemy = this.enemy(slot as 0 | 1); const player = this.player(slot as 0 | 1);
      const enemyMax = calculateStats(enemy, SPECIES[enemy.speciesId]).hp; const playerMax = calculateStats(player, SPECIES[player.speciesId]).hp;
      const enemyRatio = Math.max(0, enemy.currentHp / enemyMax); const playerRatio = Math.max(0, player.currentHp / playerMax);
      this.enemyBars[slot]?.setSize(74 * enemyRatio, 2).setFillStyle(hpColor(enemyRatio)); this.playerBars[slot]?.setSize(74 * playerRatio, 2).setFillStyle(hpColor(playerRatio));
      this.enemyHpText[slot]?.setText(`${enemy.currentHp}/${enemyMax}`); this.playerHpText[slot]?.setText(`${player.currentHp}/${playerMax}`);
    });
  }

  private async damageFlash(side: 'player' | 'enemy') { const sprites = side === 'player' ? this.playerSprites : this.enemySprites; await this.tween({ targets: sprites, alpha: .2, duration: 55, yoyo: true, repeat: 2 }); }
  private async victory() {
    audio.sfx('victory'); gameStore.defeat(this.trainer.flag); const reward = Math.floor(this.trainer.reward * rewardMultiplier(gameStore.save!.party[0])); gameStore.save!.money += reward; this.showText(`Victory! You received ${reward} Lumen.`); await this.wait(1200); gameStore.autoSave(); this.returnToWorld();
  }
  private async defeat() { audio.stopMusic(); this.showText('Your party is exhausted… You return to Mossmere.'); await this.wait(1000); gameStore.healAll(); gameStore.setLocation('mossmere', 12, 10); gameStore.autoSave(); this.scene.start('Overworld'); }
  private returnToWorld() { audio.stopMusic(); this.cameras.main.fadeOut(180, 0, 0, 0); this.time.delayedCall(190, () => this.scene.start('Overworld')); }
  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig) { return new Promise<void>((resolve) => this.tweens.add({ ...config, onComplete: () => resolve() })); }
  private wait(ms: number) { return new Promise<void>((resolve) => this.time.delayedCall(ms, () => resolve())); }
}
