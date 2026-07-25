import Phaser from 'phaser';
import { audio } from '../audio';
import { controls } from '../controls';
import { ITEMS, MOVES, REGIONAL_GUIDE, SPECIES } from '../data';
import { configureGbaCamera } from '../display';
import { applyItemEffects } from '../effects';
import { calculateStats, expForLevel } from '../rules';
import { gameStore } from '../state';
import type { CreatureInstance, GameOptions, ItemDefinition } from '../types';
import { applyCloudProfile, toCloudProfile } from '../cloudProfile';
import { configureAuthOverlay, hideAuthOverlay, setAuthOverlayStatus, showAuthOverlay } from '../authOverlay';
import { canAttemptLiveConnection, connectLiveWorldSession, liveNetwork } from '../liveNetwork';
import { openLeagueLink } from '../online/LeagueLink';
import { COLORS, hpColor, label, panel, textStyle } from '../ui';

type MenuMode = 'pause' | 'shop';
type Page = 'root' | 'party' | 'summary' | 'bag' | 'guide' | 'card' | 'options' | 'shop' | 'account';
type Pocket = ItemDefinition['category'];
type BagMode = 'browse' | 'actions' | 'quantity' | 'target';

const ROOT = ['CREATURES', 'BAG', 'FIELD GUIDE', 'PLAYER CARD', 'LEAGUE LINK', 'ACCOUNT', 'SAVE', 'OPTIONS', 'CLOSE'];
const ROOT_HELP: Record<string, string> = {
  CREATURES: 'Review, switch, store, and equip your team.',
  BAG: 'Use medicine, Pods, held items, and key gear.',
  'FIELD GUIDE': 'Review every creature you have seen or caught.',
  'PLAYER CARD': 'View your journey record and earned Crests.',
  'LEAGUE LINK': 'World shards, chat, nearby players, friends, and trades.',
  ACCOUNT: 'Link a durable cloud identity and protect your progression.',
  SAVE: 'Write a protected manual save and backup.',
  OPTIONS: 'Tune battle presentation and audio.',
  CLOSE: 'Return to the field.',
};
const POCKETS: Array<{ id: Pocket; label: string }> = [
  { id: 'recovery', label: 'MED' }, { id: 'capture', label: 'PODS' }, { id: 'held', label: 'HELD' }, { id: 'key', label: 'KEY' },
];
const TYPE_COLORS: Record<string, number> = {
  Neutral: 0x8b8375, Verdant: 0x5d9b52, Ember: 0xc65b3e, Tide: 0x4b8fa6, Wind: 0x8ca7a1,
  Stone: 0x8a7966, Frost: 0x74a9c2, Volt: 0xd5b545, Mystic: 0x8b67ad, Umbral: 0x5d567c,
  Drake: 0x6f79bc, Metal: 0x8997a4, Venom: 0x8b5e91, Terra: 0x9a704f, Bloom: 0x7aa45c,
  Aether: 0x6ca6a2, Prism: 0xc37aa8,
};
const GUIDE_SIZE = REGIONAL_GUIDE.length;
const partyActions = (creature: CreatureInstance) => ['SUMMARY', 'SWITCH', creature.heldItem ? 'TAKE ITEM' : 'GIVE ITEM', 'LIST ONLINE', 'CANCEL'];

export class MenuScene extends Phaser.Scene {
  private mode: MenuMode = 'pause';
  private page: Page = 'root';
  private cursor = 0;
  private summaryPage = 0;
  private rows: string[] = [];
  private objects: Phaser.GameObjects.GameObject[] = [];
  private note = '';
  private pocket = 0;
  private storage = false;
  private partyAction = false;
  private partyIndex = 0;
  private storageSwapIndex: number | null = null;
  private itemTarget = 0;
  private bagReturn: Page = 'root';
  private bagMode: BagMode = 'browse';
  private bagItemId = '';
  private bagBrowseCursor = 0;
  private bagQuantity = 1;
  private shopBuying = false;
  private shopQuantity = 1;
  private accountId = '';
  private authToken = '';
  private authStatus = 'GUEST SESSION: LINK AN ACCOUNT TO SYNC PROGRESS';
  private connectedWorldId = 'mossmere';

  constructor() { super('Menu'); }

  init(data: { mode?: MenuMode; page?: Page }) {
    this.mode = data.mode ?? 'pause';
    this.page = data.page ?? (this.mode === 'shop' ? 'shop' : 'root');
    this.cursor = 0;
    this.summaryPage = 0;
    this.pocket = 0;
    this.storage = false;
    this.partyAction = false;
    this.partyIndex = 0;
    this.storageSwapIndex = null;
    this.itemTarget = 0;
    this.bagReturn = 'root';
    this.bagMode = 'browse';
    this.bagItemId = '';
    this.bagBrowseCursor = 0;
    this.bagQuantity = 1;
    this.shopBuying = false;
    this.shopQuantity = 1;
  }

  create() {
    configureGbaCamera(this);
    this.cameras.main.setBackgroundColor('#172219');
    controls.clear();
    if (this.page === 'account') this.connectDefaultWorld();
    this.render();
  }

  update() {
    if (controls.pressed('UP')) this.move(-1);
    if (controls.pressed('DOWN')) this.move(1);
    if (controls.pressed('LEFT')) this.horizontal(-1);
    if (controls.pressed('RIGHT')) this.horizontal(1);
    if (controls.pressed('A')) this.choose();
    if (controls.pressed('B') || controls.pressed('MENU')) this.back();
  }

  private move(amount: number) {
    if (!this.rows.length || this.page === 'summary' || this.shopBuying || this.bagMode === 'quantity') return;
    this.cursor = (this.cursor + amount + this.rows.length) % this.rows.length;
    audio.sfx('confirm');
    this.render();
  }

  private horizontal(amount: number) {
    if (this.page === 'bag' && this.bagMode === 'quantity') {
      const stack=this.bagStacks()[this.bagBrowseCursor];this.bagQuantity=Phaser.Math.Clamp(this.bagQuantity+amount,1,stack?.count??1);
      audio.sfx('confirm');this.render();return;
    }
    if (this.page === 'shop' && this.shopBuying) {
      this.shopQuantity = Phaser.Math.Clamp(this.shopQuantity + amount, 1, 99);
      audio.sfx('confirm'); this.render(); return;
    }
    if (this.page === 'bag' && this.bagMode === 'browse') {
      this.pocket = (this.pocket + amount + POCKETS.length) % POCKETS.length;
      this.cursor = 0;
      audio.sfx('confirm');
      this.render();
      return;
    }
    if (this.page === 'party' && !this.partyAction && this.storageSwapIndex===null && gameStore.save!.storage.length) {
      this.storage = !this.storage;
      this.cursor = 0;
      audio.sfx('confirm');
      this.render();
      return;
    }
    if (this.page === 'summary') {
      this.summaryPage = (this.summaryPage + amount + 4) % 4;
      audio.sfx('confirm');
      this.render();
      return;
    }
    if (this.page === 'guide') {
      this.cursor = Phaser.Math.Clamp(this.cursor + amount, 0, GUIDE_SIZE - 1);
      audio.sfx('confirm');
      this.render();
      return;
    }
    if (this.page === 'options') this.adjustOption(amount);
  }

  private clear() {
    this.objects.forEach((object) => object.destroy());
    this.objects = [];
  }

  private keep<T extends Phaser.GameObjects.GameObject>(object: T) {
    this.objects.push(object);
    return object;
  }

  private render() {
    this.clear();
    const bg = this.keep(this.add.graphics());
    bg.fillStyle(0x14221d, 1).fillRect(0, 0, 240, 160);
    bg.fillStyle(0x21382e, 1).fillRect(0, 21, 240, 2);
    if (this.page === 'root') this.renderRoot();
    else if (this.page === 'party') this.renderParty();
    else if (this.page === 'summary') this.renderSummary();
    else if (this.page === 'bag') this.renderBag();
    else if (this.page === 'guide') this.renderGuide();
    else if (this.page === 'card') this.renderCard();
    else if (this.page === 'options') this.renderOptions();
    else if (this.page === 'account') this.renderAccount();
    else this.renderShop();
  }

  private header(title: string, subtitle = '') {
    const bar = this.keep(this.add.graphics().setDepth(1));
    bar.fillStyle(0xf1f1d0, 1).fillRect(0, 0, 240, 21);
    bar.fillStyle(0x6d8f82, 1).fillRect(0, 18, 240, 3);
    bar.fillStyle(0xb9ca68, 1).fillRect(0, 18, 72, 3);
    this.keep(label(this, 8, 5, title, 11, '#182c2c', 2));
    if (subtitle) this.keep(label(this, 232, 7, subtitle, 7, '#52665c', 2)).setOrigin(1, 0);
  }

  private box(x: number, y: number, width: number, height: number, fill = COLORS.paper, depth = 1) {
    return this.keep(panel(this, x, y, width, height, fill, depth));
  }

  private list(rows: string[], x: number, y: number, width: number, rowHeight = 16) {
    this.rows = rows;
    rows.forEach((row, index) => {
      const selected = index === this.cursor;
      const bg = this.keep(this.add.rectangle(x, y + index * rowHeight, width, rowHeight - 2, selected ? 0x5b8f94 : 0x2c4543).setOrigin(0).setDepth(2).setInteractive());
      if (selected) this.keep(this.add.rectangle(x, y + index * rowHeight, 3, rowHeight - 2, 0xd8d968).setOrigin(0).setDepth(3));
      this.keep(label(this, x + 7, y + index * rowHeight + 3, `${selected ? '> ' : ''}${row}`, 8, selected ? '#ffffff' : '#dbe5cf', 4));
      bg.on('pointerdown', () => { this.cursor = index; this.choose(); });
    });
  }

  private renderRoot() {
    const save = gameStore.save!;
    this.header('FIELD MENU', save.location.mapId.replaceAll('-', ' ').toUpperCase());
    this.box(7, 27, 61, 106, 0xdce7ca);
    this.keep(this.add.sprite(37, 53, `avatar-${save.player.avatar}`, 0).setScale(0.55).setDepth(3));
    this.keep(label(this, 12, 75, save.player.name.toUpperCase(), 9, '#20342f', 3));
    this.keep(label(this, 12, 90, `CRESTS ${save.player.crests.length}/3`, 7, '#59684f', 3));
    this.keep(label(this, 12, 103, `${save.money} L`, 7, '#59684f', 3));
    this.keep(label(this, 12, 116, `${save.guide.caught.length}/${GUIDE_SIZE} CAUGHT`, 7, '#59684f', 3));
    this.list(ROOT, 76, 27, 157, 10);
    this.box(7, 137, 226, 18, 0xe8edcf);
    this.keep(label(this, 13, 143, this.note || ROOT_HELP[ROOT[this.cursor]], 6, '#30433a', 3));
  }

  private renderAccount() {
    this.header('CLOUD ACCOUNT', this.accountId && !this.accountId.startsWith('guest-') ? 'LINKED' : 'GUEST');
    this.box(8, 27, 224, 118, 0xe4e9cf);
    this.keep(label(this, 16, 42, 'ACCOUNT CONTROLS OPEN', 8, '#30433a', 3));
    this.keep(label(this, 16, 61, 'USE THE SECURE ACCOUNT WINDOW', 6, '#52665c', 3));
    this.keep(label(this, 14, 148, this.note || 'B: BACK', 6, '#c9d8bd', 3));
    this.syncAccountAuthOverlay();
  }

  private syncAccountAuthOverlay() {
    configureAuthOverlay({
      onSubmit: (mode, username, password) => {
        liveNetwork.send(mode === 'register' ? 'auth:register' : 'auth:login', { username, password });
        this.authStatus = 'CONTACTING CLOUD SERVICE...';
        setAuthOverlayStatus(this.authStatus);
      },
      onClose: () => this.open('root'),
    });
    const status = this.authStatus.startsWith('GUEST SESSION') ? 'GUEST SAVE: LOCAL ONLY' : this.authStatus;
    showAuthOverlay({ gate: false, status });
  }

  private uploadCloudProfile() {
    if (!gameStore.save || !this.accountId || this.accountId.startsWith('guest-')) return false;
    return liveNetwork.send('profile:save', { profile: toCloudProfile(gameStore.save, this.accountId, this.connectedWorldId, false) });
  }

  private connectDefaultWorld() {
    const save = gameStore.save;
    if (!save || !canAttemptLiveConnection()) return;
    const stored = this.authToken || (() => { try { return JSON.parse(localStorage.getItem('generation-league:auth:v1') ?? '{}').token ?? ''; } catch { return ''; } })();
    this.authToken = stored;
    if (!liveNetwork.hasLiveSocket()) {
      connectLiveWorldSession(save.location.mapId, save.location.x, save.location.y, { pingIntervalMs: 15_000 });
    }
  }

  private renderParty() {
    const save = gameStore.save!;
    const source = this.storage ? save.storage : save.party;
    const actionCreature = source[this.partyIndex] ?? source[0];
    this.rows = this.partyAction && actionCreature ? partyActions(actionCreature) : source.map((creature) => creature.uid);
    this.header('CREATURES', this.storage ? `BOX ${save.storage.length}/120` : `PARTY ${save.party.length}/6`);
    this.keep(label(this, 8, 24, this.storage ? '< BOX >   PARTY' : '< PARTY >   BOX', 6, '#d7e4c8', 2));
    if (!source.length) {
      this.box(8, 39, 224, 91);
      this.keep(label(this, 120, 78, 'NO CREATURES', 8, '#52665c', 3)).setOrigin(.5);
      this.keep(label(this, 120, 145, 'B: BACK', 6, '#c9d8bd', 2)).setOrigin(.5);
      return;
    }
    const selected = source[this.partyAction ? this.partyIndex : this.cursor] ?? source[0];
    const selectedIndex=this.partyAction?this.partyIndex:this.cursor;
    const start=this.storage?Math.min(Math.max(0,selectedIndex-3),Math.max(0,source.length-6)):0;
    this.renderPartyPreview(selected);
    source.slice(start,start+6).forEach((creature,row) => this.renderPartyRow(creature,row,start+row===selectedIndex));
    if (this.partyAction) this.renderPartyActions();
    this.box(6, 133, 228, 22, 0xe8edcf);
    this.keep(label(this, 12, 139, this.note || (this.partyAction ? 'A: CHOOSE  B: BACK' : 'A: OPTIONS  B: CANCEL'), 7, '#30433a', 3));
    if (!this.partyAction) this.keep(label(this, 228, 139, `${this.cursor + 1}/${source.length}`, 7, '#52665c', 3)).setOrigin(1, 0);
  }

  private renderPartyPreview(creature: CreatureInstance) {
    const species = SPECIES[creature.speciesId];
    const stats = calculateStats(creature, species);
    const ratio = Math.max(0, creature.currentHp / stats.hp);
    this.box(5, 31, 82, 98, 0xe4e9cf);
    this.keep(this.add.image(46, 62, `${species.id}-front`).setDisplaySize(54, 54).setDepth(2));
    this.keep(label(this, 11, 88, (creature.nickname || species.name).toUpperCase(), 7, '#20342f', 3));
    this.keep(label(this, 11, 100, `Lv${creature.level} ${genderGlyph(creature.gender)}`, 7, '#52665c', 3));
    this.keep(label(this, 11, 113, `${creature.currentHp}/${stats.hp}`, 7, '#52665c', 3));
    const hp = this.keep(this.add.graphics().setDepth(3));
    hp.fillStyle(0x34443c, 1).fillRect(11, 124, 66, 5);
    hp.fillStyle(hpColor(ratio), 1).fillRect(12, 125, 64 * ratio, 3);
    if (creature.status) this.keep(label(this, 11, 133, creature.status.toUpperCase(), 6, '#9f4034', 3));
    else if (creature.heldItem) this.keep(label(this, 11, 133, `HOLDS ${ITEMS[creature.heldItem].name.toUpperCase()}`, 5, '#7b6843', 3));
  }

  private renderPartyRow(creature: CreatureInstance, index: number, selected: boolean) {
    const species = SPECIES[creature.speciesId];
    const stats = calculateStats(creature, species);
    const x = 93;
    const y = 31 + index * 16;
    this.keep(this.add.rectangle(x, y, 141, 14, selected ? 0x638f91 : 0xd4dfc8).setOrigin(0).setDepth(2));
    this.keep(label(this, x + 4, y + 3, `${selected ? '▶ ' : '  '}${creature.nickname || species.name}`, 7, selected ? '#fff' : '#20342f', 3));
    this.keep(label(this, x + 93, y + 3, `${genderGlyph(creature.gender)} Lv${creature.level}`, 6, selected ? '#fff' : '#52665c', 3));
    const ratio = Math.max(0, creature.currentHp / stats.hp);
    const hp = this.keep(this.add.graphics().setDepth(3));
    hp.fillStyle(0x34443c, 1).fillRect(x + 4, y + 11, 80, 2);
    hp.fillStyle(hpColor(ratio), 1).fillRect(x + 5, y + 11, 78 * ratio, 1);
    if (creature.status) this.keep(label(this, x + 119, y + 3, creature.status.slice(0, 3).toUpperCase(), 5, selected ? '#fff' : '#9f4034', 3));
    else if (creature.heldItem) this.keep(this.add.rectangle(x + 126, y + 7, 4, 4, 0xd2af42).setAngle(45).setStrokeStyle(1, 0x6b5524).setDepth(3));
  }

  private renderPartyActions() {
    const source = this.storage ? gameStore.save!.storage : gameStore.save!.party;
    const actions = partyActions(source[this.partyIndex]);
    this.box(119, 67, 108, 61, 0xe4e9cf);
    actions.forEach((action, index) => {
      const selected = index === this.cursor;
      const y = 73 + index * 13;
      if (selected) this.keep(this.add.rectangle(125, y - 2, 96, 12, 0x638f91).setOrigin(0).setDepth(4));
      this.keep(label(this, 131, y, `${selected ? '▶ ' : '  '}${action}`, 7, selected ? '#fff' : '#20342f', 5));
    });
  }

  private renderSummary() {
    const save = gameStore.save!;
    const source = this.storage ? save.storage : save.party;
    const creature = source[this.cursor];
    if (!creature) { this.open('party'); return; }
    const species = SPECIES[creature.speciesId];
    this.header('SUMMARY', `PAGE ${this.summaryPage + 1}/4`);
    this.box(5, 25, 230, 130, 0xe4e9cf);
    this.keep(label(this, 12, 30, `No.${String(species.regionalNumber).padStart(3, '0')} ${species.name.toUpperCase()}`, 8, '#20342f', 3));
    this.keep(this.add.image(43, 69, `${species.id}-front`).setDisplaySize(62, 62).setDepth(2));
    this.keep(label(this, 12, 108, `${creature.nickname || species.name}`, 7, '#20342f', 3));
    this.keep(label(this, 12, 120, `Lv${creature.level} ${genderGlyph(creature.gender)}`, 7, '#52665c', 3));
    this.keep(label(this, 12, 132, creature.status ? creature.status.toUpperCase() : 'STATUS OK', 5, creature.status ? '#9f4034' : '#7b6843', 3));
    if (this.summaryPage === 0) this.summaryProfile(creature, species);
    else if (this.summaryPage === 1) this.summaryStats(creature, species);
    else if (this.summaryPage === 2) this.summaryMoves(creature);
    else this.summaryGrowth(creature, species);
    this.keep(label(this, 12, 146, 'L/R: PAGE   B: BACK', 6, '#52665c', 3));
  }

  private summaryProfile(creature: CreatureInstance, species: typeof SPECIES[string]) {
    this.keep(label(this, 91, 43, 'TYPE', 6, '#7b6843', 3));
    species.types.forEach((type, index) => { if (!type) return; this.keep(this.add.rectangle(120 + index * 51, 40, 47, 12, TYPE_COLORS[type]).setOrigin(0).setDepth(2)); this.keep(label(this, 143 + index * 51, 43, type.toUpperCase(), 6, '#fff', 3)).setOrigin(.5, 0); });
    this.keep(label(this, 91, 58, `ABILITY  ${creature.ability}`, 6, '#20342f', 3));
    this.keep(label(this, 91, 70, `NATURE   ${creature.nature}`, 6, '#20342f', 3));
    this.keep(label(this, 91, 82, `HEIGHT   ${species.height.toFixed(1)} m`, 6, '#20342f', 3));
    this.keep(label(this, 91, 94, `WEIGHT   ${species.weight.toFixed(1)} kg`, 6, '#20342f', 3));
    this.keep(label(this, 91, 109, `OT       ${creature.capture.originalTrainer}`, 6, '#20342f', 3));
    this.keep(label(this, 91, 121, `MET      Lv${creature.capture.metLevel} ${creature.capture.mapId.replaceAll('-', ' ')}`, 6, '#52665c', 3));
    this.keep(label(this, 91, 133, `HELD     ${creature.heldItem ? ITEMS[creature.heldItem].name : 'NONE'}`, 6, creature.heldItem ? '#7b6843' : '#52665c', 3));
  }

  private summaryStats(creature: CreatureInstance, species: typeof SPECIES[string]) {
    const stats = calculateStats(creature, species);
    const rows: Array<[string, keyof typeof stats]> = [['HP', 'hp'], ['ATTACK', 'attack'], ['DEFENSE', 'defense'], ['SP. ATK', 'spAttack'], ['SP. DEF', 'spDefense'], ['SPEED', 'speed']];
    this.keep(label(this, 92, 39, 'STAT      NOW   IV  EV', 6, '#7b6843', 3));
    rows.forEach(([name, key], index) => { const y = 49 + index * 11; this.keep(label(this, 92, y, `${name.padEnd(8, ' ')} ${String(stats[key]).padStart(3, ' ')}  ${String(creature.ivs[key]).padStart(2, '0')}  ${String(creature.evs[key]).padStart(3, ' ')}`, 6, '#20342f', 3)); });
    this.keep(label(this, 92, 120, `EV TOTAL  ${Object.values(creature.evs).reduce((sum, value) => sum + value, 0)}/510`, 6, '#52665c', 3));
    this.keep(label(this, 92, 132, `HP        ${creature.currentHp}/${stats.hp}`, 6, '#52665c', 3));
  }

  private summaryMoves(creature: CreatureInstance) {
    this.keep(label(this, 92, 40, 'MOVE              TYPE      PP', 6, '#7b6843', 3));
    creature.moves.forEach((known, index) => { const move = MOVES[known.moveId]; const y = 52 + index * 17; this.keep(label(this, 92, y, move.name.toUpperCase(), 7, '#20342f', 3)); this.keep(label(this, 92, y + 9, `${move.category}  ${move.type}  ${known.pp}/${known.maxPp}`, 5, '#52665c', 3)); });
    if (!creature.moves.length) this.keep(label(this, 92, 63, 'NO MOVES LEARNED', 7, '#52665c', 3));
  }

  private summaryGrowth(creature: CreatureInstance, species: typeof SPECIES[string]) {
    const next = species.evolution;
    const nextExp = creature.level >= 100 ? 'MAX LEVEL' : String(Math.max(0, expForLevel(creature.level + 1, species.growthCurve) - creature.experience));
    this.keep(label(this, 92, 42, `EXP       ${creature.experience}`, 6, '#20342f', 3));
    this.keep(label(this, 92, 54, `TO NEXT   ${nextExp}`, 6, '#20342f', 3));
    this.keep(label(this, 92, 66, `FRIENDSHIP ${creature.friendship}/255`, 6, '#20342f', 3));
    this.keep(label(this, 92, 80, `FAMILY    ${species.line}`, 6, '#20342f', 3));
    this.keep(label(this, 92, 92, next ? `NEXT     Lv${next.level} ${SPECIES[next.speciesId].name}` : 'NEXT     FINAL STAGE', 6, '#52665c', 3));
    this.keep(this.add.text(92, 106, species.description, textStyle(6, '#52665c')).setDepth(3).setWordWrapWidth(128));
  }

  private bagStacks() {
    const pocket = POCKETS[this.pocket].id;
    return gameStore.save!.inventory.filter((stack) => stack.count > 0 && ITEMS[stack.itemId].category === pocket);
  }

  private bagActions(item: ItemDefinition) {
    if (item.category === 'recovery') return ['USE', 'TOSS', 'CANCEL'];
    if (item.category === 'held') return ['GIVE', 'TOSS', 'CANCEL'];
    if (item.category === 'capture') return ['TOSS', 'CANCEL'];
    return [];
  }

  private renderBag() {
    if (this.bagMode === 'target') { this.renderBagTarget(); return; }
    const stacks = this.bagStacks();
    const selectedIndex = this.bagMode === 'browse' ? this.cursor : this.bagBrowseCursor;
    const selectedStack = stacks[selectedIndex];
    const selectedItem = selectedStack && ITEMS[selectedStack.itemId];
    this.rows = this.bagMode === 'actions' && selectedItem ? this.bagActions(selectedItem) : this.bagMode === 'quantity' ? ['CONFIRM'] : stacks.map((stack) => stack.itemId);
    this.header('BAG', `${gameStore.save!.money} LUMEN`);
    POCKETS.forEach((entry, index) => { const selected = index === this.pocket; const x = 5 + index * 57; this.keep(this.add.rectangle(x, 24, 54, 13, selected ? 0xd7c45c : 0x31514e).setOrigin(0).setDepth(2)); this.keep(label(this, x + 27, 27, entry.label, 6, selected ? '#24342d' : '#d6e0cc', 3)).setOrigin(.5, 0); });
    this.box(5, 40, 113, 98, 0xe6ead0); this.box(121, 40, 114, 98, 0xd7e2cb);
    if (!stacks.length) this.keep(label(this, 61, 80, 'POCKET EMPTY', 7, '#59684f', 3)).setOrigin(.5);
    const start = Math.min(Math.max(0, selectedIndex - 3), Math.max(0, stacks.length - 7));
    stacks.slice(start, start + 7).forEach((stack, row) => { const absolute = start + row; const selected = absolute === selectedIndex; const y = 46 + row * 12; if (selected) this.keep(this.add.rectangle(9, y - 1, 105, 11, 0x6b9693).setOrigin(0).setDepth(2)); this.keep(label(this, 13, y, `${selected ? '> ' : ''}${ITEMS[stack.itemId].name}`, 7, selected ? '#fff' : '#263a32', 3)); this.keep(label(this, 109, y, `x${stack.count}`, 6, selected ? '#fff' : '#59684f', 3)).setOrigin(1, 0); });
    if (start > 0) this.keep(label(this, 61, 42, '▲', 5, '#52665c', 3)).setOrigin(.5, 0);
    if (start + 7 < stacks.length) this.keep(label(this, 61, 130, '▼', 5, '#52665c', 3)).setOrigin(.5, 0);
    if (selectedItem) this.itemDetails(selectedItem, selectedStack.count);
    if (this.bagMode === 'actions' && selectedItem) this.renderBagActions(selectedItem);
    if (this.bagMode === 'quantity' && selectedItem) this.renderBagQuantity(selectedItem);
    this.keep(label(this, 8, 144, this.note || (this.bagMode === 'quantity' ? 'L/R: QUANTITY   A: TOSS   B: CANCEL' : this.bagMode === 'actions' ? 'A: CHOOSE   B: CANCEL' : 'L/R: POCKET   A: SELECT   B: BACK'), 6, this.note ? '#e3d36e' : '#c9d8bd', 2));
  }

  private itemDetails(item: ItemDefinition, count: number) {
    this.itemIcon(item, 178, 64);
    this.keep(label(this, 128, 84, item.name.toUpperCase(), 7, '#253830', 3)); this.keep(this.add.text(128, 97, item.description, textStyle(6, '#52665c')).setDepth(3).setWordWrapWidth(98));
    this.keep(label(this, 128, 124, item.price ? `VALUE ${item.price} L   OWN ${count}` : `KEY ITEM   OWN ${count}`, 5, '#7b6843', 3));
  }

  private itemIcon(item: ItemDefinition, x: number, y: number) {
    if (item.category === 'capture') {
      const image = this.keep(this.add.image(x, y, 'capture-pod').setDisplaySize(31, 31).setDepth(3));
      if (item.id === 'greatPod') image.setTint(0xc5e8ee);
      return;
    }
    const icon = this.keep(this.add.graphics().setDepth(3));
    if (item.category === 'recovery') {
      icon.fillStyle(0x31514e).fillRoundedRect(x - 8, y - 8, 16, 18, 3); icon.fillStyle(0xe9edcf).fillRect(x - 4, y - 12, 8, 5); icon.fillStyle(0x8fc79d).fillRect(x - 5, y - 2, 10, 5); icon.fillStyle(0xffffff, .5).fillRect(x - 5, y - 6, 2, 9);
    } else if (item.category === 'held') {
      icon.fillStyle(0x2b3d36).fillCircle(x, y, 12); icon.lineStyle(2, 0xd2af42).strokeCircle(x, y, 9); icon.fillStyle(0xe8c95d).fillTriangle(x, y - 7, x + 7, y + 5, x - 7, y + 5); icon.fillStyle(0xfff0a0).fillCircle(x, y, 3);
    } else {
      icon.fillStyle(0xd2af42).fillCircle(x - 5, y - 3, 7); icon.fillStyle(0x293828).fillCircle(x - 5, y - 3, 3); icon.fillStyle(0xd2af42).fillRect(x, y - 5, 12, 5).fillRect(x + 8, y, 4, 5);
    }
  }

  private renderBagActions(item: ItemDefinition) {
    const actions = this.bagActions(item);
    this.keep(this.add.rectangle(125, 44, 106, 91, 0x14221d, .42).setOrigin(0).setDepth(4));
    this.box(133, 73, 91, 12 + actions.length * 14, 0xf0f0d0, 5);
    actions.forEach((action, index) => {
      const selected = index === this.cursor;
      const y = 80 + index * 14;
      if (selected) this.keep(this.add.rectangle(139, y - 2, 79, 12, 0x638f91).setOrigin(0).setDepth(6));
      this.keep(label(this, 145, y, `${selected ? '> ' : '  '}${action}`, 7, selected ? '#fff' : '#20342f', 7));
    });
  }

  private renderBagQuantity(item: ItemDefinition) {
    this.keep(this.add.rectangle(125, 44, 106, 91, 0x14221d, .42).setOrigin(0).setDepth(4));
    this.box(133, 78, 91, 47, 0xf0f0d0, 5);
    this.keep(label(this, 178, 85, `TOSS ${item.name.toUpperCase()}?`, 6, '#20342f', 7)).setOrigin(.5, 0);
    this.keep(label(this, 178, 101, `<  ${this.bagQuantity}  >`, 9, '#7b6843', 7)).setOrigin(.5, 0);
  }

  private renderBagTarget() {
    const item = ITEMS[this.bagItemId];
    const party = gameStore.save!.party;
    this.rows = party.map((creature) => creature.uid);
    this.header(item.category === 'held' ? 'GIVE ITEM' : 'USE ITEM', item.name.toUpperCase());
    this.box(5, 27, 61, 112, 0xdce7ca); this.itemIcon(item, 35, 55);
    this.keep(this.add.text(12, 79, item.description, textStyle(6, '#52665c')).setDepth(3).setWordWrapWidth(47));
    this.box(70, 27, 165, 112, 0xe4e9cf);
    party.forEach((creature, index) => {
      const species = SPECIES[creature.speciesId], maxHp = calculateStats(creature, species).hp, selected = index === this.cursor, y = 33 + index * 17;
      if (selected) this.keep(this.add.rectangle(76, y - 2, 153, 15, 0x638f91).setOrigin(0).setDepth(3));
      this.keep(label(this, 81, y, `${selected ? '> ' : ''}${creature.nickname || species.name}`, 7, selected ? '#fff' : '#20342f', 4));
      this.keep(label(this, 224, y, `${creature.currentHp}/${maxHp}`, 6, selected ? '#fff' : '#52665c', 4)).setOrigin(1, 0);
      this.keep(label(this, 81, y + 8, item.category === 'held' ? `HELD: ${creature.heldItem ? ITEMS[creature.heldItem].name : 'NONE'}` : creature.status ? creature.status.toUpperCase() : 'STATUS: OK', 5, selected ? '#edf1d4' : '#7b6843', 4));
    });
    this.keep(label(this, 8, 145, this.note || 'A: CHOOSE TARGET   B: CANCEL', 6, this.note ? '#e3d36e' : '#c9d8bd', 2));
  }

  private renderGuide() {
    const save = gameStore.save!;
    this.rows = REGIONAL_GUIDE;
    this.header('FIELD GUIDE', `${save.guide.seen.length} SEEN  ${save.guide.caught.length} CAUGHT`);
    this.box(5, 25, 106, 129, 0xe4e9cf); this.box(114, 25, 121, 129, 0xd8e3ce);
    const start = Math.min(Math.max(0, this.cursor - 3), GUIDE_SIZE - 8);
    REGIONAL_GUIDE.slice(start, start + 8).forEach((id, index) => { const absolute = start + index; const y = 30 + index * 14; const selected = absolute === this.cursor; const seen = save.guide.seen.includes(id); const caught = save.guide.caught.includes(id); if (selected) this.keep(this.add.rectangle(9, y - 1, 98, 13, 0x638f91).setOrigin(0).setDepth(2)); this.keep(label(this, 12, y, `${selected ? '> ' : ''}${String(absolute + 1).padStart(3, '0')} ${seen ? SPECIES[id].name : '----------'}`, 7, selected ? '#fff' : '#263a32', 3)); if (caught) this.keep(this.add.circle(102, y + 4, 2, 0xd2af42).setDepth(3)); });
    const id = REGIONAL_GUIDE[this.cursor]; const species = SPECIES[id]; const seen = save.guide.seen.includes(id); const caught = save.guide.caught.includes(id);
    const art = this.keep(this.add.image(175, 60, `${id}-front`).setDisplaySize(62, 62).setDepth(2)); if (!seen) art.setTint(0x172219);
    this.keep(label(this, 120, 30, `No. ${String(this.cursor + 1).padStart(3, '0')}`, 7, '#52665c', 3)); this.keep(label(this, 120, 88, seen ? species.name.toUpperCase() : 'UNKNOWN', 9, '#20342f', 3));
    if (seen) {
      species.types.forEach((type, index) => { if (!type) return; this.keep(this.add.rectangle(122 + index * 50, 101, 46, 11, TYPE_COLORS[type]).setOrigin(0).setDepth(2)); this.keep(label(this, 145 + index * 50, 103, type.toUpperCase(), 6, '#fff', 3)).setOrigin(.5, 0); });
      this.keep(label(this, 120, 116, `${species.height.toFixed(1)}m  ${species.weight.toFixed(1)}kg`, 6, '#52665c', 3));
      this.keep(label(this, 120, 127, `${caught ? 'CAPTURED' : 'SEEN'}  ${species.habitat}`, 6, caught ? '#8b6b25' : '#52665c', 3));
      this.keep(this.add.text(120, 137, species.description, textStyle(5, '#52665c')).setDepth(3).setWordWrapWidth(110));
    } else this.keep(label(this, 120, 120, 'DATA NOT FOUND', 6, '#52665c', 3));
    this.keep(label(this, 120, 149, 'U/D: SELECT  B: BACK', 5, '#52665c', 3));
  }

  private renderCard() {
    const save = gameStore.save!;
    this.header('PLAYER CARD', 'GENERATION LEAGUE');
    const card = this.keep(this.add.graphics().setDepth(1)); card.fillStyle(0xd8dfb8, 1).fillRoundedRect(12, 28, 216, 112, 7); card.lineStyle(3, 0x6f805e, 1).strokeRoundedRect(12, 28, 216, 112, 7); card.fillStyle(0x789a79, 1).fillRect(15, 31, 210, 19); card.fillStyle(0xe9edcf, 1).fillRoundedRect(20, 57, 55, 66, 4);
    this.keep(this.add.sprite(47, 83, `avatar-${save.player.avatar}`, 0).setScale(0.65).setDepth(2)); this.keep(label(this, 84, 35, save.player.name.toUpperCase(), 11, '#f7f8df', 3)); this.keep(label(this, 84, 58, `ID  ${String(save.startedAt).slice(-6)}`, 7, '#283a32', 3)); this.keep(label(this, 84, 72, `MONEY   ${save.money} L`, 7, '#283a32', 3)); this.keep(label(this, 84, 86, `GUIDE   ${save.guide.caught.length} / ${GUIDE_SIZE}`, 7, '#283a32', 3)); this.keep(label(this, 84, 100, `CRESTS  ${save.player.crests.length} / 3`, 7, '#283a32', 3));
    ['glimmer', 'cinder', 'tide'].forEach((crest, index) => { const owned = save.player.crests.includes(crest); this.keep(this.add.circle(99 + index * 31, 124, 8, owned ? [0x73a96b, 0xc76a43, 0x5a9eb0][index] : 0x9ca58e).setDepth(2)); this.keep(label(this, 99 + index * 31, 120, owned ? '*' : '-', 7, '#fff', 3)).setOrigin(.5, 0); });
    this.rows = ['BACK']; this.keep(label(this, 18, 147, 'A / B: RETURN', 6, '#c9d8bd', 2));
  }

  private optionRows() { return ['BATTLE SCENE', 'BATTLE STYLE', 'MUSIC', 'SFX', 'MUTE', 'REDUCED MOTION', 'CANCEL']; }
  private optionHelp() { return ['Show move and impact animation.', 'SHIFT offers a switch before the next foe.', 'Adjust music volume.', 'Adjust menu and battle effects.', 'Silence all game audio.', 'Shorten visual transitions and disable camera shake.', 'Return without changing selection.']; }

  private optionValues(options: GameOptions) { return [options.battleScene ? 'ON' : 'OFF', options.battleStyle.toUpperCase(), `${Math.round(options.musicVolume * 100)}%`, `${Math.round(options.sfxVolume * 100)}%`, options.muted ? 'ON' : 'OFF', options.reducedMotion ? 'ON' : 'OFF', '']; }

  private renderOptions() {
    const options = gameStore.save!.options; this.rows = this.optionRows(); this.header('OPTIONS', 'L/R TO CHANGE'); this.box(12, 29, 216, 116, 0xe4e9cf);
    const values = this.optionValues(options);
    this.rows.forEach((row, index) => { const selected = index === this.cursor; const y = 38 + index * 16; if (selected) this.keep(this.add.rectangle(18, y - 3, 204, 14, 0x638f91).setOrigin(0).setDepth(2)); this.keep(label(this, 24, y, `${selected ? '> ' : '  '}${row}`, 7, selected ? '#fff' : '#263a32', 3)); this.keep(label(this, 216, y, values[index], 7, selected ? '#fff' : '#52665c', 3)).setOrigin(1, 0); });
    this.keep(label(this, 18, 149, this.optionHelp()[this.cursor], 5, '#b9c8ac', 3));
  }

  private renderShop() {
    const save = gameStore.save!; const crests = save.player.crests.length; const ids = ['tonic', 'prismPod', ...(crests >= 1 ? ['superTonic', 'greatPod'] : []), ...(crests >= 2 ? ['fullMend', 'swiftBand', 'emberCharm'] : [])]; this.rows = [...ids, 'LEAVE']; this.header('SUPPLY SHOP', `${save.money} LUMEN`); this.box(6, 27, 133, 113, 0xe4e9cf); this.box(142, 27, 92, 113, 0xd8e3ce);
    this.rows.forEach((id, index) => { const selected = index === this.cursor; const y = 34 + index * 14; if (selected) this.keep(this.add.rectangle(10, y - 2, 125, 13, 0x638f91).setOrigin(0).setDepth(2)); const item = ITEMS[id]; this.keep(label(this, 14, y, `${selected ? '> ' : ''}${item?.name ?? 'LEAVE'}`, 7, selected ? '#fff' : '#263a32', 3)); if (item) this.keep(label(this, 131, y, `${item.price}`, 6, selected ? '#fff' : '#52665c', 3)).setOrigin(1, 0); });
    const item = ITEMS[ids[this.cursor]]; if (item) {
      this.itemIcon(item, 188, 48); this.keep(label(this, 149, 68, item.name.toUpperCase(), 7, '#283a32', 3)); this.keep(this.add.text(149, 81, item.description, textStyle(6, '#52665c')).setDepth(3).setWordWrapWidth(77));
      if(this.shopBuying){this.keep(label(this,149,112,`QTY  < ${this.shopQuantity} >`,7,'#283a32',3));this.keep(label(this,149,124,`TOTAL ${item.price*this.shopQuantity} L`,6,'#9a632d',3));}
      else this.keep(label(this, 149, 124, this.note || `OWNED ${save.inventory.find((stack) => stack.itemId === item.id)?.count ?? 0}`, 6, '#7b6843', 3));
    }
    this.keep(label(this,8,146,this.shopBuying?'L/R: QUANTITY   A: BUY   B: CANCEL':'A: SELECT   B: LEAVE',6,'#c9d8bd',2));
  }

  private choose() {
    audio.sfx('confirm'); const save = gameStore.save!;
    if (this.page === 'root') {
      const pick = ROOT[this.cursor];
      if (pick === 'CREATURES') this.open('party');
      else if (pick === 'BAG') this.open('bag');
      else if (pick === 'FIELD GUIDE') this.open('guide');
      else if (pick === 'PLAYER CARD') this.open('card');
      else if (pick === 'LEAGUE LINK') { this.connectDefaultWorld(); openLeagueLink(); this.close(); }
      else if (pick === 'ACCOUNT') { this.connectDefaultWorld(); this.open('account'); }
      else if (pick === 'OPTIONS') this.open('options');
      else if (pick === 'SAVE') { this.note = gameStore.manualSave() ? 'Game saved safely.' : 'Save failed.'; this.render(); }
      else this.close();
      return;
    }
    if (this.page === 'account') { this.note = 'USE THE ACCOUNT FORM TO CONTINUE.'; this.render(); return; }
    if (this.page === 'party') {
      const source = this.storage ? save.storage : save.party;
      if(!this.partyAction&&this.storageSwapIndex!==null){
        const stored=save.storage[this.storageSwapIndex],partyCreature=save.party[this.cursor];if(!stored||!partyCreature)return;
        save.storage[this.storageSwapIndex]=partyCreature;save.party[this.cursor]=stored;this.storageSwapIndex=null;this.note=`${stored.nickname||SPECIES[stored.speciesId].name} joined the party.`;this.cursor=0;this.render();return;
      }
      if (!this.partyAction) { if (!source[this.cursor]) return; this.partyIndex = this.cursor; this.cursor = 0; this.partyAction = true; this.render(); return; }
      const creature = source[this.partyIndex];
      if (!creature) return;
      if (this.cursor === 0) { this.partyAction = false; this.cursor = this.partyIndex; this.open('summary'); }
      else if (this.cursor === 1) {
        if (this.storage) {
          if(save.party.length<6){const withdrawn=save.storage.splice(this.partyIndex,1)[0];save.party.push(withdrawn);this.storage=false;this.partyAction=false;this.cursor=save.party.length-1;this.note=`${withdrawn.nickname||SPECIES[withdrawn.speciesId].name} joined the party.`;this.render();return;}
          this.storageSwapIndex=this.partyIndex;this.storage=false;this.note='Choose a party creature to place in storage.';this.partyAction=false;this.cursor=0;this.render();return;
        }
        if (this.partyIndex === 0) this.note = `${creature.nickname || SPECIES[creature.speciesId].name} is already leading.`;
        else { save.party.splice(this.partyIndex, 1); save.party.unshift(creature); this.note = `${creature.nickname || SPECIES[creature.speciesId].name} is now leading.`; }
        this.partyAction = false; this.cursor = 0; this.render();
      } else if (this.cursor === 2) {
        if (creature.heldItem) {
          const item = ITEMS[creature.heldItem]; gameStore.addItem(creature.heldItem); creature.heldItem = null;
          this.note = `${creature.nickname || SPECIES[creature.speciesId].name} returned ${item.name}.`; this.partyAction = false; this.cursor = this.partyIndex; this.render();
        } else {
          this.itemTarget = this.partyIndex; this.bagReturn = 'party'; this.partyAction = false; this.open('bag');
          this.pocket = POCKETS.findIndex((entry) => entry.id === 'held'); this.bagMode = 'browse'; this.render();
        }
      } else if (this.cursor === 3) {
        this.partyAction = false;
        this.cursor = this.partyIndex;
        openLeagueLink('trade');
        this.close();
      } else { this.partyAction = false; this.cursor = this.partyIndex; this.render(); }
      return;
    }
    if (this.page === 'summary') return;
    if (this.page === 'bag') { this.chooseBag(); return; }
    if (this.page === 'guide') return;
    if (this.page === 'card') { this.back(); return; }
    if (this.page === 'options') { if (this.cursor === this.optionRows().length - 1) this.back(); else this.adjustOption(1); return; }
    if (this.page === 'shop') {
      if (this.rows[this.cursor] === 'LEAVE') { this.close(); return; }
      const id = this.rows[this.cursor], item = ITEMS[id];
      if(!this.shopBuying){this.shopBuying=true;this.shopQuantity=1;this.note='';this.render();return;}
      const total=item.price*this.shopQuantity;
      if(save.money<total){this.note='Not enough Lumen.';audio.sfx('cancel');this.render();return;}
      save.money-=total;gameStore.addItem(id,this.shopQuantity);this.note=`Bought ${this.shopQuantity} ${item.name}${this.shopQuantity>1?'s':''}.`;this.shopBuying=false;this.shopQuantity=1;this.render();
    }
  }

  private adjustOption(amount: number) {
    const options = gameStore.save!.options;
    const cycle = <T extends string>(values: readonly T[], current: T) => values[(values.indexOf(current) + amount + values.length) % values.length];
    if (this.cursor === 0) gameStore.setOptions({ battleScene: !options.battleScene });
    else if (this.cursor === 1) gameStore.setOptions({ battleStyle: cycle(['shift', 'set'] as const, options.battleStyle) });
    else if (this.cursor === 2) gameStore.setOptions({ musicVolume: Phaser.Math.Clamp(options.musicVolume + amount * .1, 0, 1) });
    else if (this.cursor === 3) gameStore.setOptions({ sfxVolume: Phaser.Math.Clamp(options.sfxVolume + amount * .1, 0, 1) });
    else if (this.cursor === 4) gameStore.setOptions({ muted: !options.muted });
    else if (this.cursor === 5) gameStore.setOptions({ reducedMotion: !options.reducedMotion });
    else return;
    audio.sfx('confirm'); audio.refreshMusic(); this.render();
  }

  private chooseBag() {
    const save = gameStore.save!;
    if (this.bagMode === 'browse') {
      const stack = this.bagStacks()[this.cursor]; if (!stack) return;
      const item = ITEMS[stack.itemId], actions = this.bagActions(item);
      if (!actions.length) { this.note = `${item.name} works automatically when needed.`; this.render(); return; }
      this.bagItemId = item.id; this.bagBrowseCursor = this.cursor; this.bagMode = 'actions'; this.cursor = 0; this.note = ''; this.render(); return;
    }
    if (this.bagMode === 'actions') {
      const item = ITEMS[this.bagItemId], action = this.rows[this.cursor];
      if (action === 'CANCEL') { this.bagMode = 'browse'; this.cursor = this.bagBrowseCursor; this.render(); return; }
      if (action === 'TOSS') {
        this.bagMode='quantity';this.bagQuantity=1;this.note='';this.render();return;
      }
      this.bagMode = 'target'; this.cursor = Math.min(this.itemTarget, save.party.length - 1); this.note = ''; this.render(); return;
    }
    if(this.bagMode==='quantity'){
      const item=ITEMS[this.bagItemId];gameStore.useItem(item.id,this.bagQuantity);this.note=`Discarded ${this.bagQuantity} ${item.name}${this.bagQuantity>1?'s':''}.`;this.bagMode='browse';this.bagQuantity=1;
      this.cursor=Math.min(this.bagBrowseCursor,Math.max(0,this.bagStacks().length-1));this.render();return;
    }
    const creature = save.party[this.cursor], item = ITEMS[this.bagItemId]; if (!creature || !item) return;
    if (item.category === 'recovery') {
      const events = applyItemEffects(item, creature, SPECIES[creature.speciesId], gameStore.rng);
      if (!events.length) { this.note = 'It would have no effect.'; this.render(); return; }
      if (gameStore.useItem(item.id)) { this.note = events[events.length - 1].text; audio.sfx('heal'); }
    } else if (item.category === 'held' && gameStore.useItem(item.id)) {
      if (creature.heldItem) gameStore.addItem(creature.heldItem);
      creature.heldItem = item.id; this.note = `${creature.nickname || SPECIES[creature.speciesId].name} now holds ${item.name}.`;
    }
    this.bagMode = 'browse'; this.cursor = Math.min(this.bagBrowseCursor, Math.max(0, this.bagStacks().length - 1)); this.render();
  }

  private open(page: Page) { this.page = page; this.cursor = 0; this.summaryPage = 0; this.note = ''; if (page !== 'party') this.partyAction = false; if(page==='bag'){this.bagMode='browse';this.bagItemId='';this.bagBrowseCursor=0;this.bagQuantity=1;} this.render(); if (page !== 'account') hideAuthOverlay(); }
  private back() {
    audio.sfx('cancel');
    if (this.page === 'shop' && this.shopBuying) { this.shopBuying=false;this.shopQuantity=1;this.note='';this.render(); }
    else if (this.page === 'root' || this.page === 'shop') this.close();
    else if (this.page === 'account') this.open('root');
    else if (this.page === 'party' && this.storageSwapIndex!==null) { this.storageSwapIndex=null;this.storage=true;this.cursor=this.partyIndex;this.note='';this.render(); }
    else if (this.page === 'party' && this.partyAction) { this.partyAction = false; this.cursor = this.partyIndex; this.render(); }
    else if (this.page === 'summary') { this.open('party'); this.cursor = this.partyIndex; this.render(); }
    else if (this.page === 'bag' && this.bagMode === 'target') { this.bagMode='actions';this.cursor=0;this.note='';this.render(); }
    else if (this.page === 'bag' && this.bagMode === 'quantity') { this.bagMode='actions';this.cursor=0;this.bagQuantity=1;this.note='';this.render(); }
    else if (this.page === 'bag' && this.bagMode === 'actions') { this.bagMode='browse';this.cursor=this.bagBrowseCursor;this.note='';this.render(); }
    else if (this.page === 'bag' && this.bagReturn === 'party') { this.open('party'); this.cursor = this.partyIndex; this.render(); }
    else this.open('root');
  }
  private close() {
    hideAuthOverlay();
    this.scene.stop();
    this.scene.resume('Overworld');
    controls.clear();
  }
}

function genderGlyph(gender: CreatureInstance['gender']) { return gender === 'male' ? 'M' : gender === 'female' ? 'F' : '-'; }
