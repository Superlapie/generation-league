import Phaser from 'phaser';
import { audio } from '../audio';
import { controls } from '../controls';
import { ITEMS, MOVES, REGIONAL_GUIDE, SPECIES } from '../data';
import { configureGbaCamera } from '../display';
import { applyItemEffects } from '../effects';
import { gameStore } from '../state';
import type { CreatureInstance, GameOptions, ItemDefinition } from '../types';
import { applyCloudProfile, toCloudProfile } from '../cloudProfile';
import { configureAuthOverlay, hideAuthOverlay, setAuthOverlayStatus, showAuthOverlay } from '../authOverlay';
import { canAttemptLiveConnection, connectLiveWorldSession, liveNetwork } from '../liveNetwork';
import { openLeagueLink } from '../online/LeagueLink';
import {
  renderFieldMenuRoot,
  renderPartyScreen,
  renderBagScreen,
  renderBagTargetScreen,
  renderGuideScreen,
  renderPlayerCard,
  renderOptionsScreen,
  renderSummaryScreen,
  renderSaveModal,
  renderItemIcon,
  genderGlyph,
} from '../ui/menuComponents';
import { ROOT_ENTRIES, POCKET_DEFS } from '../ui/constants';
import { drawPageBackground, drawPageHeader, drawHelpBar, raisedPanel, addText, keep } from '../ui/primitives';

type MenuMode = 'pause' | 'shop';
type Page = 'root' | 'party' | 'summary' | 'bag' | 'guide' | 'card' | 'options' | 'shop' | 'account';
type Pocket = ItemDefinition['category'];
type BagMode = 'browse' | 'actions' | 'quantity' | 'target';

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
  private saveFlash: 'success' | 'failure' | null = null;

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
    this.saveFlash = null;
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
    if (this.page === 'root') {
      const cols = 2;
      const row = Math.floor(this.cursor / cols);
      const newRow = (row + amount + Math.ceil(ROOT_ENTRIES.length / cols)) % Math.ceil(ROOT_ENTRIES.length / cols);
      this.cursor = Math.min(newRow * cols + (this.cursor % cols), ROOT_ENTRIES.length - 1);
    } else {
      this.cursor = (this.cursor + amount + this.rows.length) % this.rows.length;
    }
    audio.sfx('confirm');
    this.render();
  }

  private horizontal(amount: number) {
    if (this.page === 'root') {
      const cols = 2;
      const col = this.cursor % cols;
      const row = Math.floor(this.cursor / cols);
      const newCol = (col + amount + cols) % cols;
      const next = row * cols + newCol;
      if (next < ROOT_ENTRIES.length) { this.cursor = next; audio.sfx('confirm'); this.render(); }
      return;
    }
    if (this.page === 'bag' && this.bagMode === 'quantity') {
      const stack = this.bagStacks()[this.bagBrowseCursor];
      this.bagQuantity = Phaser.Math.Clamp(this.bagQuantity + amount, 1, stack?.count ?? 1);
      audio.sfx('confirm'); this.render(); return;
    }
    if (this.page === 'shop' && this.shopBuying) {
      this.shopQuantity = Phaser.Math.Clamp(this.shopQuantity + amount, 1, 99);
      audio.sfx('confirm'); this.render(); return;
    }
    if (this.page === 'bag' && this.bagMode === 'browse') {
      this.pocket = (this.pocket + amount + POCKET_DEFS.length) % POCKET_DEFS.length;
      this.cursor = 0;
      audio.sfx('confirm');
      this.render();
      return;
    }
    if (this.page === 'party' && !this.partyAction && this.storageSwapIndex === null && gameStore.save!.storage.length) {
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

  private sink = (object: Phaser.GameObjects.GameObject) => { this.objects.push(object); };

  private clear() {
    this.objects.forEach((object) => object.destroy());
    this.objects = [];
  }

  private render() {
    this.clear();
    const save = gameStore.save!;
    this.rows = [];

    if (this.page === 'root') {
      this.rows = ROOT_ENTRIES.map((e) => e.id);
      renderFieldMenuRoot(this, {
        playerName: save.player.name,
        avatar: save.player.avatar,
        crests: save.player.crests.length,
        money: save.money,
        guideCaught: save.guide.caught.length,
        guideTotal: GUIDE_SIZE,
        location: save.location.mapId.replaceAll('-', ' ').toUpperCase(),
        cursor: this.cursor,
        help: this.note || ROOT_ENTRIES[this.cursor].help,
        translucent: this.mode === 'pause',
        onSelect: (index) => { this.cursor = index; this.choose(); },
      }, this.sink);
      if (this.saveFlash) {
        renderSaveModal(this, {
          title: this.saveFlash === 'success' ? 'SAVED' : 'SAVE FAILED',
          message: this.note,
          success: this.saveFlash === 'success',
        }, this.sink);
      }
      return;
    }

    keep(this.sink, drawPageBackground(this));

    if (this.page === 'party') this.renderParty();
    else if (this.page === 'summary') this.renderSummary();
    else if (this.page === 'bag') this.renderBag();
    else if (this.page === 'guide') this.renderGuide();
    else if (this.page === 'card') this.renderCard();
    else if (this.page === 'options') this.renderOptions();
    else if (this.page === 'account') this.renderAccount();
    else this.renderShop();
  }

  private renderAccount() {
    drawPageHeader(this, { title: 'CLOUD ACCOUNT', subtitle: this.accountId && !this.accountId.startsWith('guest-') ? 'LINKED' : 'GUEST', iconKey: 'ui-icon-account' }, this.sink);
    keep(this.sink, raisedPanel(this, 8, 27, 224, 118));
    keep(this.sink, addText(this, 16, 42, 'ACCOUNT CONTROLS OPEN', 'menuLabel', undefined, 6));
    keep(this.sink, addText(this, 16, 61, 'Use the secure account window', 'bodyMuted', undefined, 6));
    drawHelpBar(this, this.note || 'B: Back', this.sink);
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
    this.rows = this.partyAction && actionCreature ? partyActions(actionCreature) : source.map((c) => c.uid);
    const selectedIndex = this.partyAction ? this.partyIndex : this.cursor;
    renderPartyScreen(this, {
      storage: this.storage,
      partyCount: save.party.length,
      storageCount: save.storage.length,
      creatures: source,
      selectedIndex,
      cursor: this.cursor,
      partyAction: this.partyAction,
      actions: actionCreature ? partyActions(actionCreature) : [],
      help: this.partyAction ? 'A: Choose  B: Back' : 'A: Options  B: Cancel',
      note: this.note || undefined,
    }, this.sink);
  }

  private renderSummary() {
    const save = gameStore.save!;
    const source = this.storage ? save.storage : save.party;
    const creature = source[this.cursor];
    if (!creature) { this.open('party'); return; }
    renderSummaryScreen(this, { creature, summaryPage: this.summaryPage }, this.sink);
  }

  private bagStacks() {
    const pocket = POCKET_DEFS[this.pocket].id;
    return gameStore.save!.inventory.filter((stack) => stack.count > 0 && ITEMS[stack.itemId].category === pocket);
  }

  private bagActions(item: ItemDefinition) {
    if (item.category === 'recovery') return ['USE', 'TOSS', 'CANCEL'];
    if (item.category === 'held') return ['GIVE', 'TOSS', 'CANCEL'];
    if (item.category === 'capture') return ['TOSS', 'CANCEL'];
    return [];
  }

  private renderBag() {
    if (this.bagMode === 'target') {
      const item = ITEMS[this.bagItemId];
      this.rows = gameStore.save!.party.map((c) => c.uid);
      renderBagTargetScreen(this, {
        item,
        party: gameStore.save!.party,
        cursor: this.cursor,
        help: 'A: Choose target  B: Cancel',
        note: this.note || undefined,
      }, this.sink);
      return;
    }
    const stacks = this.bagStacks();
    const selectedIndex = this.bagMode === 'browse' ? this.cursor : this.bagBrowseCursor;
    const selectedStack = stacks[selectedIndex];
    const selectedItem = selectedStack && ITEMS[selectedStack.itemId];
    this.rows = this.bagMode === 'actions' && selectedItem ? this.bagActions(selectedItem)
      : this.bagMode === 'quantity' ? ['CONFIRM'] : stacks.map((s) => s.itemId);
    renderBagScreen(this, {
      money: gameStore.save!.money,
      pocket: this.pocket,
      stacks,
      selectedIndex,
      cursor: this.cursor,
      bagMode: this.bagMode,
      actions: selectedItem ? this.bagActions(selectedItem) : [],
      bagQuantity: this.bagQuantity,
      selectedItem: selectedItem || undefined,
      selectedCount: selectedStack?.count ?? 0,
      help: this.bagMode === 'quantity' ? 'L/R: Quantity  A: Toss  B: Cancel'
        : this.bagMode === 'actions' ? 'A: Choose  B: Cancel'
          : 'L/R: Pocket  A: Select  B: Back',
      note: this.note || undefined,
    }, this.sink);
  }

  private renderGuide() {
    const save = gameStore.save!;
    this.rows = REGIONAL_GUIDE;
    renderGuideScreen(this, {
      guideIds: REGIONAL_GUIDE,
      cursor: this.cursor,
      seen: save.guide.seen,
      caught: save.guide.caught,
      help: 'Up/Down: Select  B: Back',
    }, this.sink);
  }

  private renderCard() {
    const save = gameStore.save!;
    this.rows = ['BACK'];
    renderPlayerCard(this, {
      name: save.player.name,
      avatar: save.player.avatar,
      id: String(save.startedAt).slice(-6),
      money: save.money,
      guideCaught: save.guide.caught.length,
      guideTotal: GUIDE_SIZE,
      crests: save.player.crests,
      location: save.location.mapId.replaceAll('-', ' '),
    }, this.sink);
  }

  private optionRows() { return ['BATTLE SCENE', 'BATTLE STYLE', 'MUSIC', 'SFX', 'MUTE', 'REDUCED MOTION', 'CANCEL']; }
  private optionHelp() { return ['Show move and impact animation.', 'SHIFT offers a switch before the next foe.', 'Adjust music volume.', 'Adjust menu and battle effects.', 'Silence all game audio.', 'Shorten visual transitions and disable camera shake.', 'Return without changing selection.']; }
  private optionValues(options: GameOptions) { return [options.battleScene ? 'ON' : 'OFF', options.battleStyle.toUpperCase(), `${Math.round(options.musicVolume * 100)}%`, `${Math.round(options.sfxVolume * 100)}%`, options.muted ? 'ON' : 'OFF', options.reducedMotion ? 'ON' : 'OFF', '']; }

  private renderOptions() {
    const options = gameStore.save!.options;
    this.rows = this.optionRows();
    renderOptionsScreen(this, {
      options,
      cursor: this.cursor,
      rows: this.rows,
      values: this.optionValues(options),
      help: this.optionHelp()[this.cursor],
    }, this.sink);
  }

  private renderShop() {
    const save = gameStore.save!;
    const crests = save.player.crests.length;
    const ids = ['tonic', 'prismPod', ...(crests >= 1 ? ['superTonic', 'greatPod'] : []), ...(crests >= 2 ? ['fullMend', 'swiftBand', 'emberCharm'] : []), 'LEAVE'];
    this.rows = [...ids];
    drawPageHeader(this, { title: 'SUPPLY SHOP', subtitle: `${save.money} LUMEN`, iconKey: 'ui-icon-bag' }, this.sink);
    keep(this.sink, raisedPanel(this, 6, 27, 133, 113));
    keep(this.sink, raisedPanel(this, 142, 27, 92, 113));
    this.rows.forEach((id, index) => {
      const selected = index === this.cursor;
      const y = 34 + index * 14;
      const item = ITEMS[id];
      const bg = this.add.rectangle(10, y - 2, 125, 13, selected ? 0x4a7a78 : 0xd4dfc8).setOrigin(0).setDepth(5);
      if (selected) this.add.graphics().setDepth(6).fillStyle(0xd8d968).fillRect(10, y - 2, 2, 13);
      keep(this.sink, bg);
      keep(this.sink, addText(this, 14, y, item?.name ?? 'LEAVE', 'menuLabel', selected ? '#fff' : '#263a32', 6));
      if (item) keep(this.sink, addText(this, 131, y, `${item.price}`, 'numeric', selected ? '#fff' : '#52665c', 6).setOrigin(1, 0));
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.cursor = index; this.choose(); });
    });
    const item = ITEMS[ids[this.cursor]];
    if (item) {
      renderItemIcon(this, item, 188, 48, this.sink);
      keep(this.sink, addText(this, 149, 68, item.name.toUpperCase(), 'menuLabel', undefined, 6));
      keep(this.sink, this.add.text(149, 81, item.description, { fontFamily: '"Generation Pixel", monospace', fontSize: '6px', color: '#52665c', resolution: 4 }).setDepth(6).setWordWrapWidth(77));
      if (this.shopBuying) {
        keep(this.sink, addText(this, 149, 112, `QTY  ${this.shopQuantity}`, 'body', undefined, 6));
        keep(this.sink, addText(this, 149, 124, `TOTAL ${item.price * this.shopQuantity} L`, 'compact', '#9a632d', 6));
      } else {
        keep(this.sink, addText(this, 149, 124, this.note || `OWNED ${save.inventory.find((s) => s.itemId === item.id)?.count ?? 0}`, 'compact', '#7b6843', 6));
      }
    }
    drawHelpBar(this, this.shopBuying ? 'L/R: Quantity  A: Buy  B: Cancel' : 'A: Select  B: Leave', this.sink);
  }

  private choose() {
    audio.sfx('confirm');
    const save = gameStore.save!;

    if (this.page === 'root') {
      const pick = ROOT_ENTRIES[this.cursor].id;
      if (pick === 'CREATURES') this.open('party');
      else if (pick === 'BAG') this.open('bag');
      else if (pick === 'FIELD GUIDE') this.open('guide');
      else if (pick === 'PLAYER CARD') this.open('card');
      else if (pick === 'LEAGUE LINK') { this.connectDefaultWorld(); openLeagueLink(); this.close(); }
      else if (pick === 'ACCOUNT') { this.connectDefaultWorld(); this.open('account'); }
      else if (pick === 'OPTIONS') this.open('options');
      else if (pick === 'SAVE') {
        const ok = gameStore.manualSave();
        this.note = ok ? 'Game saved safely.' : 'Save failed.';
        this.saveFlash = ok ? 'success' : 'failure';
        this.render();
        this.time.delayedCall(1400, () => { this.saveFlash = null; this.note = ''; this.render(); });
      }
      return;
    }

    if (this.page === 'account') { this.note = 'Use the account form to continue.'; this.render(); return; }

    if (this.page === 'party') {
      const source = this.storage ? save.storage : save.party;
      if (!this.partyAction && this.storageSwapIndex !== null) {
        const stored = save.storage[this.storageSwapIndex];
        const partyCreature = save.party[this.cursor];
        if (!stored || !partyCreature) return;
        save.storage[this.storageSwapIndex] = partyCreature;
        save.party[this.cursor] = stored;
        this.storageSwapIndex = null;
        this.note = `${stored.nickname || SPECIES[stored.speciesId].name} joined the party.`;
        this.cursor = 0;
        this.render();
        return;
      }
      if (!this.partyAction) {
        if (!source[this.cursor]) return;
        this.partyIndex = this.cursor;
        this.cursor = 0;
        this.partyAction = true;
        this.render();
        return;
      }
      const creature = source[this.partyIndex];
      if (!creature) return;
      if (this.cursor === 0) { this.partyAction = false; this.cursor = this.partyIndex; this.open('summary'); }
      else if (this.cursor === 1) {
        if (this.storage) {
          if (save.party.length < 6) {
            const withdrawn = save.storage.splice(this.partyIndex, 1)[0];
            save.party.push(withdrawn);
            this.storage = false;
            this.partyAction = false;
            this.cursor = save.party.length - 1;
            this.note = `${withdrawn.nickname || SPECIES[withdrawn.speciesId].name} joined the party.`;
            this.render();
            return;
          }
          this.storageSwapIndex = this.partyIndex;
          this.storage = false;
          this.note = 'Choose a party creature to place in storage.';
          this.partyAction = false;
          this.cursor = 0;
          this.render();
          return;
        }
        if (this.partyIndex === 0) this.note = `${creature.nickname || SPECIES[creature.speciesId].name} is already leading.`;
        else { save.party.splice(this.partyIndex, 1); save.party.unshift(creature); this.note = `${creature.nickname || SPECIES[creature.speciesId].name} is now leading.`; }
        this.partyAction = false;
        this.cursor = 0;
        this.render();
      } else if (this.cursor === 2) {
        if (creature.heldItem) {
          const item = ITEMS[creature.heldItem];
          gameStore.addItem(creature.heldItem);
          creature.heldItem = null;
          this.note = `${creature.nickname || SPECIES[creature.speciesId].name} returned ${item.name}.`;
          this.partyAction = false;
          this.cursor = this.partyIndex;
          this.render();
        } else {
          this.itemTarget = this.partyIndex;
          this.bagReturn = 'party';
          this.partyAction = false;
          this.open('bag');
          this.pocket = POCKET_DEFS.findIndex((e) => e.id === 'held');
          this.bagMode = 'browse';
          this.render();
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
      const id = this.rows[this.cursor];
      const item = ITEMS[id];
      if (!this.shopBuying) { this.shopBuying = true; this.shopQuantity = 1; this.note = ''; this.render(); return; }
      const total = item.price * this.shopQuantity;
      if (save.money < total) { this.note = 'Not enough Lumen.'; audio.sfx('cancel'); this.render(); return; }
      save.money -= total;
      gameStore.addItem(id, this.shopQuantity);
      this.note = `Bought ${this.shopQuantity} ${item.name}${this.shopQuantity > 1 ? 's' : ''}.`;
      this.shopBuying = false;
      this.shopQuantity = 1;
      this.render();
    }
  }

  private adjustOption(amount: number) {
    const options = gameStore.save!.options;
    const cycle = <T extends string>(values: readonly T[], current: T) => values[(values.indexOf(current) + amount + values.length) % values.length];
    if (this.cursor === 0) gameStore.setOptions({ battleScene: !options.battleScene });
    else if (this.cursor === 1) gameStore.setOptions({ battleStyle: cycle(['shift', 'set'] as const, options.battleStyle) });
    else if (this.cursor === 2) gameStore.setOptions({ musicVolume: Phaser.Math.Clamp(options.musicVolume + amount * 0.1, 0, 1) });
    else if (this.cursor === 3) gameStore.setOptions({ sfxVolume: Phaser.Math.Clamp(options.sfxVolume + amount * 0.1, 0, 1) });
    else if (this.cursor === 4) gameStore.setOptions({ muted: !options.muted });
    else if (this.cursor === 5) gameStore.setOptions({ reducedMotion: !options.reducedMotion });
    else return;
    audio.sfx('confirm');
    audio.refreshMusic();
    this.render();
  }

  private chooseBag() {
    const save = gameStore.save!;
    if (this.bagMode === 'browse') {
      const stack = this.bagStacks()[this.cursor];
      if (!stack) return;
      const item = ITEMS[stack.itemId];
      const actions = this.bagActions(item);
      if (!actions.length) { this.note = `${item.name} works automatically when needed.`; this.render(); return; }
      this.bagItemId = item.id;
      this.bagBrowseCursor = this.cursor;
      this.bagMode = 'actions';
      this.cursor = 0;
      this.note = '';
      this.render();
      return;
    }
    if (this.bagMode === 'actions') {
      const item = ITEMS[this.bagItemId];
      const action = this.rows[this.cursor];
      if (action === 'CANCEL') { this.bagMode = 'browse'; this.cursor = this.bagBrowseCursor; this.render(); return; }
      if (action === 'TOSS') { this.bagMode = 'quantity'; this.bagQuantity = 1; this.note = ''; this.render(); return; }
      this.bagMode = 'target';
      this.cursor = Math.min(this.itemTarget, save.party.length - 1);
      this.note = '';
      this.render();
      return;
    }
    if (this.bagMode === 'quantity') {
      const item = ITEMS[this.bagItemId];
      gameStore.useItem(item.id, this.bagQuantity);
      this.note = `Discarded ${this.bagQuantity} ${item.name}${this.bagQuantity > 1 ? 's' : ''}.`;
      this.bagMode = 'browse';
      this.bagQuantity = 1;
      this.cursor = Math.min(this.bagBrowseCursor, Math.max(0, this.bagStacks().length - 1));
      this.render();
      return;
    }
    const creature = save.party[this.cursor];
    const item = ITEMS[this.bagItemId];
    if (!creature || !item) return;
    if (item.category === 'recovery') {
      const events = applyItemEffects(item, creature, SPECIES[creature.speciesId], gameStore.rng);
      if (!events.length) { this.note = 'It would have no effect.'; this.render(); return; }
      if (gameStore.useItem(item.id)) { this.note = events[events.length - 1].text; audio.sfx('heal'); }
    } else if (item.category === 'held' && gameStore.useItem(item.id)) {
      if (creature.heldItem) gameStore.addItem(creature.heldItem);
      creature.heldItem = item.id;
      this.note = `${creature.nickname || SPECIES[creature.speciesId].name} now holds ${item.name}.`;
    }
    this.bagMode = 'browse';
    this.cursor = Math.min(this.bagBrowseCursor, Math.max(0, this.bagStacks().length - 1));
    this.render();
  }

  private open(page: Page) {
    this.page = page;
    this.cursor = 0;
    this.summaryPage = 0;
    this.note = '';
    if (page !== 'party') this.partyAction = false;
    if (page === 'bag') { this.bagMode = 'browse'; this.bagItemId = ''; this.bagBrowseCursor = 0; this.bagQuantity = 1; }
    this.render();
    if (page !== 'account') hideAuthOverlay();
  }

  private back() {
    audio.sfx('cancel');
    if (this.page === 'shop' && this.shopBuying) { this.shopBuying = false; this.shopQuantity = 1; this.note = ''; this.render(); }
    else if (this.page === 'root' || this.page === 'shop') this.close();
    else if (this.page === 'account') this.open('root');
    else if (this.page === 'party' && this.storageSwapIndex !== null) { this.storageSwapIndex = null; this.storage = true; this.cursor = this.partyIndex; this.note = ''; this.render(); }
    else if (this.page === 'party' && this.partyAction) { this.partyAction = false; this.cursor = this.partyIndex; this.render(); }
    else if (this.page === 'summary') { this.open('party'); this.cursor = this.partyIndex; this.render(); }
    else if (this.page === 'bag' && this.bagMode === 'target') { this.bagMode = 'actions'; this.cursor = 0; this.note = ''; this.render(); }
    else if (this.page === 'bag' && this.bagMode === 'quantity') { this.bagMode = 'actions'; this.cursor = 0; this.bagQuantity = 1; this.note = ''; this.render(); }
    else if (this.page === 'bag' && this.bagMode === 'actions') { this.bagMode = 'browse'; this.cursor = this.bagBrowseCursor; this.note = ''; this.render(); }
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

export { genderGlyph };
