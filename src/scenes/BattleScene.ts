import Phaser from 'phaser';
import { configureGbaCamera } from '../display';
import { audio } from '../audio';
import { controls } from '../controls';
import { createCreature, evolutionAt, ITEMS, MOVES, SPECIES } from '../data';
import { applyItemEffects } from '../effects';
import { BASE_STAGES, calculateStats, captureResult, chooseTrainerAction, escapeSucceeds, resolveTurn } from '../rules';
import { gameStore } from '../state';
import { rewardMultiplier } from '../triggers';
import { movePresentation } from '../presentation';
import type { BattleAction, BattleContext, BattleEvent, CreatureInstance, TrainerDefinition } from '../types';
import {
  drawBattleArena,
  arenaPaletteForMap,
  drawEnemyStatusPanel,
  drawPlayerStatusPanel,
  drawBattleDialogue,
  drawCommandGrid,
  drawMoveGrid,
  drawMoveDetailFooter,
  drawBattleBagModal,
  drawBattlePartyModal,
  type MoveTileData,
  type StatusPanelRefs,
} from '../ui/battleComponents';
import { UI_COLORS } from '../ui/theme';
import { label } from '../ui/primitives';

type BattleMode = 'command' | 'moves' | 'party' | 'bag' | 'itemTarget' | 'locked';
interface BattleInit { kind: 'wild' | 'trainer'; wild?: CreatureInstance; trainer?: TrainerDefinition; mapId: string }

export class BattleScene extends Phaser.Scene {
  private initData!: BattleInit;
  private context!: BattleContext;
  private trainer?: TrainerDefinition;
  private mode: BattleMode = 'locked';
  private cursor = 0;
  private playerSprite!: Phaser.GameObjects.Image;
  private enemySprite!: Phaser.GameObjects.Image;
  private uiObjects: Phaser.GameObjects.GameObject[] = [];
  private dialogue!: Phaser.GameObjects.Text;
  private enemyStatus!: StatusPanelRefs;
  private playerStatus!: StatusPanelRefs;
  private selectedItemId = '';
  private locked = true;
  private rewarded = new Set<string>();
  private escapeAttempts = 0;

  constructor() { super('Battle'); }

  init(data: BattleInit) { this.initData = data; this.trainer = data.trainer; }

  create() {
    configureGbaCamera(this);
    this.locked = true;
    this.mode = 'locked';
    this.cursor = 0;
    this.escapeAttempts = 0;
    this.rewarded.clear();
    this.uiObjects = [];
    if (!gameStore.save) { this.scene.start('Title'); return; }
    const enemyParty = this.initData.kind === 'wild' ? [this.initData.wild!] : this.trainer!.party.map((entry) => createCreature(entry.speciesId, entry.level, this.trainer!.name, this.initData.mapId, gameStore.rng));
    const playerActive = Math.max(0, gameStore.save.party.findIndex((c) => c.currentHp > 0));
    this.context = {
      player: { party: gameStore.save.party, active: playerActive, stages: { ...BASE_STAGES }, protected: false, participants: [gameStore.save.party[playerActive].uid], protectStreak: 0 },
      enemy: { party: enemyParty, active: 0, stages: { ...BASE_STAGES }, protected: false, participants: [], protectStreak: 0 },
      kind: this.initData.kind, field: { effect: null, turns: 0 }, turn: 0, ended: false, winner: null,
    };
    document.body.dataset.gameScene = 'battle';
    document.body.dataset.battleMode = 'locked';
    document.body.dataset.battleLocked = 'true';
    enemyParty.forEach((c) => gameStore.see(c.speciesId));
    drawBattleArena(this, arenaPaletteForMap(this.initData.mapId));
    this.renderCombatants();
    this.renderStatus();
    this.dialogue = drawBattleDialogue(this);
    controls.clear();
    audio.playMusic(this, this.trainer?.boss ? 'dream' : 'plain');
    const opening = this.initData.kind === 'wild' ? `A wild ${this.enemySpecies().name} appeared!` : `${this.trainer!.name} challenges you!`;
    this.showText(opening);
    this.cameras.main.flash(220, 238, 242, 207);
    this.time.delayedCall(650, () => { this.locked = false; this.openCommand(); });
  }

  update() {
    if (this.locked || this.mode === 'locked') return;
    const count = Math.max(1, this.mode === 'command' || this.mode === 'moves' ? 4 : this.mode === 'party' || this.mode === 'itemTarget' ? this.context.player.party.length : this.availableBag().length);
    if (controls.pressed('LEFT')) { this.cursor = (this.cursor + count - 1) % count; audio.sfx('confirm'); this.renderMenu(); }
    if (controls.pressed('RIGHT')) { this.cursor = (this.cursor + 1) % count; audio.sfx('confirm'); this.renderMenu(); }
    if (controls.pressed('UP')) { this.cursor = (this.cursor + (this.mode === 'command' || this.mode === 'moves' ? 2 : count - 1)) % count; audio.sfx('confirm'); this.renderMenu(); }
    if (controls.pressed('DOWN')) { this.cursor = (this.cursor + (this.mode === 'command' || this.mode === 'moves' ? 2 : 1)) % count; audio.sfx('confirm'); this.renderMenu(); }
    if (controls.pressed('B')) {
      if (this.mode === 'itemTarget') { audio.sfx('cancel'); this.mode = 'bag'; this.cursor = 0; this.showText('Choose an item.'); this.renderMenu(); }
      else if (this.mode !== 'command') { audio.sfx('cancel'); this.openCommand(); }
    }
    if (controls.pressed('A')) this.choose();
  }

  private player() { return this.context.player.party[this.context.player.active]; }
  private enemy() { return this.context.enemy.party[this.context.enemy.active]; }
  private playerSpecies() { return SPECIES[this.player().speciesId]; }
  private enemySpecies() { return SPECIES[this.enemy().speciesId]; }

  private renderCombatants() {
    this.enemySprite = this.add.image(181, 49, `${this.enemy().speciesId}-front`).setDisplaySize(68, 68).setOrigin(0.5, 0.6).setDepth(4);
    this.playerSprite = this.add.image(62, 104, `${this.player().speciesId}-back`).setDisplaySize(84, 84).setOrigin(0.5, 0.72).setDepth(5);
    if (!gameStore.save?.options.reducedMotion) {
      this.tweens.add({ targets: this.enemySprite, y: '-=2', duration: 920, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.tweens.add({ targets: this.playerSprite, y: '+=2', duration: 1040, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
  }

  private renderStatus() {
    const eMax = calculateStats(this.enemy(), this.enemySpecies()).hp;
    const pMax = calculateStats(this.player(), this.playerSpecies()).hp;
    this.enemyStatus = drawEnemyStatusPanel(this, 7, 7, this.enemySpecies().name, this.enemy().level, Math.max(0, this.enemy().currentHp / eMax));
    this.playerStatus = drawPlayerStatusPanel(this, 127, 77, this.player().nickname || this.playerSpecies().name, this.player().level, Math.max(0, this.player().currentHp / pMax), this.player().currentHp, pMax, this.context.player.party);
    this.updateHpBars();
  }

  private showText(value: string) { this.dialogue.setText(value); }

  private sink = (o: Phaser.GameObjects.GameObject) => { this.uiObjects.push(o); };

  private clearMenu() { this.uiObjects.forEach((o) => o.destroy()); this.uiObjects = []; }

  private openCommand() { this.mode = 'command'; this.cursor = 0; this.showText('What will you do?'); this.renderMenu(); }

  private renderMenu() {
    document.body.dataset.battleMode = this.mode;
    document.body.dataset.battleLocked = String(this.locked);
    this.clearMenu();
    if (this.mode === 'locked' || (this.mode === 'command' && this.locked)) return;

    if (this.mode === 'command') {
      drawCommandGrid(this, ['FIGHT', 'BAG', 'PARTY', 'RUN'], this.cursor, [false, false, false, false], this.sink, (i) => { this.cursor = i; this.choose(); });
      return;
    }

    if (this.mode === 'moves') {
      const known = this.player().moves;
      const noPp = known.every((m) => m.pp <= 0);
      const tiles: MoveTileData[] = Array.from({ length: 4 }, (_, i) => {
        if (noPp && i === 0) return { name: 'Struggle', type: 'Neutral', pp: 0, maxPp: 0, category: 'Physical', disabled: false, empty: false, struggle: true };
        if (noPp) return { name: '—', type: '', pp: 0, maxPp: 0, category: '', disabled: true, empty: true, struggle: false };
        const slot = known[i];
        if (!slot) return { name: '—', type: '', pp: 0, maxPp: 0, category: '', disabled: true, empty: true, struggle: false };
        const move = MOVES[slot.moveId];
        return { name: move.name, type: move.type, pp: slot.pp, maxPp: slot.maxPp, category: move.category, disabled: slot.pp <= 0, empty: false, struggle: false };
      });
      drawMoveGrid(this, tiles, this.cursor, this.sink, (i) => { this.cursor = i; this.choose(); });
      const selected = noPp && this.cursor === 0 ? { moveId: 'struggle', pp: 0, maxPp: 0 } : known[this.cursor];
      if (selected) {
        const move = MOVES[selected.moveId];
        drawMoveDetailFooter(this, { type: move.type, pp: selected.pp, maxPp: selected.maxPp, power: move.power, category: move.category, accuracy: move.accuracy }, noPp, this.sink);
      }
      return;
    }

    if (this.mode === 'party' || this.mode === 'itemTarget') {
      drawBattlePartyModal(this, {
        title: this.mode === 'itemTarget' ? `USE ${ITEMS[this.selectedItemId].name.toUpperCase()}` : 'CHOOSE A CREATURE',
        party: this.context.player.party,
        cursor: this.cursor,
        activeIndex: this.context.player.active,
      }, this.sink, (i) => { this.cursor = i; this.choose(); });
      return;
    }

    drawBattleBagModal(this, { items: this.availableBag(), cursor: this.cursor }, this.sink, (i) => { this.cursor = i; this.choose(); });
  }

  private availableBag() { return gameStore.save!.inventory.filter((s) => s.count > 0 && (ITEMS[s.itemId].category === 'recovery' || ITEMS[s.itemId].category === 'capture')); }

  private choose() {
    audio.unlock();
    audio.sfx('confirm');
    if (this.mode === 'command') {
      if (this.cursor === 0) { this.mode = 'moves'; this.cursor = 0; this.showText('Choose a move.'); this.renderMenu(); }
      else if (this.cursor === 1) { this.mode = 'bag'; this.cursor = 0; this.showText('Choose an item.'); this.renderMenu(); }
      else if (this.cursor === 2) { this.mode = 'party'; this.cursor = 0; this.showText('Choose a party member.'); this.renderMenu(); }
      else if (this.context.kind === 'wild') void this.perform({ kind: 'flee' });
      else this.showText('You cannot flee from a Warden or trainer!');
      return;
    }
    if (this.mode === 'moves') {
      const known = this.player().moves[this.cursor];
      if (this.player().moves.every((m) => m.pp <= 0)) { if (this.cursor === 0) void this.perform({ kind: 'struggle' }); return; }
      if (!known || known.pp <= 0) { this.showText('That move has no PP left.'); return; }
      void this.perform({ kind: 'move', moveIndex: this.cursor });
      return;
    }
    if (this.mode === 'party') {
      const target = this.context.player.party[this.cursor];
      if (!target || target.currentHp <= 0 || this.cursor === this.context.player.active) { this.showText('That creature cannot switch in.'); return; }
      void this.perform({ kind: 'switch', partyIndex: this.cursor });
      return;
    }
    if (this.mode === 'itemTarget') { void this.useItem(this.selectedItemId, this.cursor); return; }
    if (this.mode === 'bag') {
      const stack = this.availableBag()[this.cursor];
      const item = stack && ITEMS[stack.itemId];
      if (!item) return;
      if (item.category === 'capture') {
        if (this.context.kind !== 'wild') { this.showText('Capture Pods only work in wild battles.'); return; }
        void this.capture(stack.itemId);
      } else {
        this.selectedItemId = stack.itemId;
        this.mode = 'itemTarget';
        this.cursor = this.context.player.active;
        this.showText(`Use ${item.name} on which creature?`);
        this.renderMenu();
      }
    }
  }

  private async capture(itemId: string) {
    if (gameStore.save!.party.length >= 6 && gameStore.save!.storage.length >= 120) { this.showText('Your party and storage are full.'); return; }
    this.locked = true; this.mode = 'locked'; this.clearMenu();
    gameStore.useItem(itemId);
    const item = ITEMS[itemId];
    const enemy = this.enemy();
    const species = this.enemySpecies();
    const max = calculateStats(enemy, species).hp;
    const result = captureResult(enemy, species, max, item.captureModifier ?? 1, gameStore.rng);
    this.showText(`You threw a ${item.name}!`);
    await this.captureAnimation(result.shakes, result.caught);
    if (result.caught) {
      this.context.ended = true; this.context.winner = 'captured';
      const placed = gameStore.addCreature(enemy);
      this.showText(`${species.name} joined you! Sent to ${placed === 'party' ? 'your party' : 'storage'}.`);
      audio.sfx('victory'); gameStore.autoSave(); await this.wait(1300); this.returnToWorld(); return;
    }
    this.showText(`${species.name} broke free!`); await this.wait(700);
    await this.perform({ kind: 'capture', itemId }, true);
  }

  private async useItem(itemId: string, targetIndex: number) {
    const item = ITEMS[itemId];
    const creature = this.context.player.party[targetIndex];
    const species = creature && SPECIES[creature.speciesId];
    const events: BattleEvent[] = [];
    if (!creature || !species) { this.showText('Choose a valid creature.'); return; }
    if (!item.effects?.length) { this.showText('It would have no effect.'); return; }
    events.push(...applyItemEffects(item, creature, species, gameStore.rng));
    if (!events.length || events.every((e) => e.kind === 'heal' && e.amount === 0)) { this.showText('It would have no effect.'); return; }
    gameStore.useItem(itemId); this.locked = true; this.mode = 'locked'; this.clearMenu();
    events.forEach((e) => this.showText(e.text)); audio.sfx('heal'); this.updateHpBars();
    await this.wait(550); await this.perform({ kind: 'item', itemId, targetIndex }, true);
  }

  private async perform(action: BattleAction, alreadyLocked = false) {
    if (!alreadyLocked) { this.locked = true; this.mode = 'locked'; this.clearMenu(); }
    document.body.dataset.battleMode = this.mode; document.body.dataset.battleLocked = String(this.locked);
    if (action.kind === 'flee') {
      this.escapeAttempts += 1;
      if (escapeSucceeds(this.player(), this.enemy(), this.playerSpecies(), this.enemySpecies(), this.escapeAttempts, gameStore.rng)) {
        this.showText('You got away safely!'); audio.sfx('confirm'); await this.wait(700); gameStore.autoSave(); this.returnToWorld(); return;
      }
      this.showText('Could not escape!'); await this.wait(550);
    }
    const enemyAction = chooseTrainerAction(this.context, SPECIES, MOVES, gameStore.rng);
    const events = resolveTurn(this.context, action, enemyAction, SPECIES, MOVES, gameStore.rng);
    for (const event of events) await this.playEvent(event);
    await this.afterTurn();
  }

  private async playEvent(event: BattleEvent) {
    if (event.kind === 'move' && event.side) {
      this.showText(event.text);
      if (gameStore.save?.options.battleScene !== false) await this.animateMove(event.side, event.moveId!);
      else { audio.sfx(MOVES[event.moveId!].audioCue); await this.wait(120); }
      return;
    }
    if (event.kind === 'damage' && event.side) {
      if (event.text) this.showText(event.text);
      await this.damageFlash(event.side); this.updateHpBars();
      if (event.text) await this.wait(350); return;
    }
    if (event.kind === 'heal' && event.side) { this.showText(event.text); await this.healAnimation(event.side); this.updateHpBars(); return; }
    if (event.kind === 'status' || event.kind === 'stage' || event.kind === 'miss' || event.kind === 'field' || event.kind === 'switch') {
      this.showText(event.text); if (event.kind === 'switch') this.swapSprite(event.side!); this.updateHpBars(); await this.wait(650); return;
    }
    if (event.kind === 'faint' && event.side) {
      this.showText(event.text);
      const sprite = event.side === 'player' ? this.playerSprite : this.enemySprite;
      await this.tween({ targets: sprite, y: sprite.y + 30, alpha: 0, duration: 420, ease: 'Quad.In' });
      this.updateHpBars(); await this.wait(350); return;
    }
    if (event.kind === 'text' && event.text) { this.showText(event.text); await this.wait(600); }
  }

  private async afterTurn() {
    const participantIds = new Set(this.context.player.participants ?? []);
    const participants = this.context.player.party.filter((c) => participantIds.has(c.uid));
    for (const enemy of this.context.enemy.party) {
      if (enemy.currentHp <= 0 && !this.rewarded.has(enemy.uid)) {
        this.rewarded.add(enemy.uid);
        for (const participant of participants) {
          const award = gameStore.awardExperience(participant, enemy.speciesId, enemy.level, participants.length, this.context.kind === 'trainer');
          for (const message of award.messages) { this.showText(message); await this.wait(750); }
          for (const moveId of award.pendingMoves) await this.processMoveLearning(participant, moveId);
          await this.processEvolutions(participant);
        }
      }
    }
    if (this.context.ended) { if (this.context.winner === 'player') await this.victory(); else await this.defeat(); return; }
    if (this.enemy().currentHp <= 0) {
      const next = this.context.enemy.party.findIndex((c) => c.currentHp > 0);
      if (next >= 0) {
        const switchTo = await this.offerShift(next);
        if (switchTo !== null) {
          this.context.player.active = switchTo;
          this.context.player.stages = { ...BASE_STAGES };
          this.swapSprite('player');
          this.showText(`Go ${this.player().nickname || this.playerSpecies().name}!`);
          await this.wait(650);
        }
        this.context.enemy.active = next;
        this.context.enemy.stages = { ...BASE_STAGES };
        this.swapSprite('enemy');
        this.showText(`${this.trainer?.name ?? 'The foe'} sent out ${this.enemySpecies().name}!`);
        await this.wait(850);
      }
    }
    if (this.player().currentHp <= 0) {
      const next = this.context.player.party.findIndex((c) => c.currentHp > 0);
      if (next >= 0) { this.mode = 'party'; this.cursor = next; this.locked = false; this.showText('Choose a creature to continue.'); this.renderMenu(); return; }
    }
    this.locked = false; this.openCommand();
  }

  private async victory() {
    audio.sfx('victory');
    if (this.trainer) {
      gameStore.defeat(this.trainer.flag);
      const reward = Math.floor(this.trainer.reward * rewardMultiplier(this.player()));
      gameStore.save!.money += reward;
      this.showText(`Victory! You received ${reward} Lumen.`);
      if (this.trainer.id === 'warden-lyra') { gameStore.awardCrest('glimmer'); this.showText('Warden Lyra awarded the Glimmer Crest!'); }
      if (this.trainer.id === 'warden-kael') { gameStore.awardCrest('cinder'); this.showText('Warden Kael awarded the Cinder Crest!'); }
      if (this.trainer.id === 'warden-selene') { gameStore.awardCrest('tide'); gameStore.addFlag('champion'); this.showText('Warden Selene awarded the Tide Crest!'); }
      await this.wait(1300);
    } else { this.showText('The wild creature was overcome.'); await this.wait(650); }
    gameStore.autoSave();
    if (this.trainer?.id === 'warden-selene') { this.scene.start('Credits'); return; }
    this.returnToWorld();
  }

  private async defeat() {
    audio.stopMusic();
    this.showText('Your party is exhausted… You return to Mossmere.');
    await this.wait(1100);
    gameStore.healAll();
    gameStore.setLocation('mossmere', 12, 10);
    gameStore.autoSave();
    this.scene.start('Overworld');
  }

  private returnToWorld() { audio.stopMusic(); this.cameras.main.fadeOut(180, 0, 0, 0); this.time.delayedCall(190, () => this.scene.start('Overworld')); }

  private swapSprite(side: 'player' | 'enemy') {
    const old = side === 'player' ? this.playerSprite : this.enemySprite;
    old.destroy();
    if (side === 'player') {
      this.playerSprite = this.add.image(62, 104, `${this.player().speciesId}-back`).setDisplaySize(84, 84).setOrigin(0.5, 0.72).setDepth(5);
    } else {
      this.enemySprite = this.add.image(181, 49, `${this.enemy().speciesId}-front`).setDisplaySize(68, 68).setOrigin(0.5, 0.6).setDepth(4);
    }
    this.updateStatusText();
  }

  private updateStatusText() {
    this.enemyStatus.nameText?.setText(`${this.enemySpecies().name.toUpperCase()}  Lv${this.enemy().level}`);
    this.playerStatus.nameText?.setText(`${(this.player().nickname || this.playerSpecies().name).toUpperCase()}  Lv${this.player().level}`);
    this.updateHpBars();
  }

  private updateHpBars() {
    if (!this.playerStatus || !this.enemyStatus) return;
    const pMax = calculateStats(this.player(), this.playerSpecies()).hp;
    const eMax = calculateStats(this.enemy(), this.enemySpecies()).hp;
    const pRatio = Math.max(0, this.player().currentHp / pMax);
    const eRatio = Math.max(0, this.enemy().currentHp / eMax);
    this.playerStatus.hpMeter.update(pRatio);
    this.enemyStatus.hpMeter.update(eRatio);
    this.playerStatus.hpText?.setText(`${this.player().currentHp}/${pMax}`);
    this.playerStatus.statusText?.setText(this.statusCode(this.player()));
    this.enemyStatus.statusText?.setText(this.statusCode(this.enemy()));
    document.body.dataset.battleHp = `${this.player().currentHp}/${pMax}:${this.enemy().currentHp}/${eMax}`;
  }

  private statusCode(creature: CreatureInstance) {
    if (creature.status === 'poison' && creature.toxicCounter > 0) return 'TOX';
    if (creature.status) return creature.status.slice(0, 3).toUpperCase();
    if ((creature.confusionTurns ?? 0) > 0) return 'CNF';
    return '';
  }

  private async animateMove(side: 'player' | 'enemy', moveId: string) {
    const move = MOVES[moveId];
    const attacker = side === 'player' ? this.playerSprite : this.enemySprite;
    const target = side === 'player' ? this.enemySprite : this.playerSprite;
    audio.sfx(move.audioCue);
    const home = { x: attacker.x, y: attacker.y };
    await this.tween({ targets: attacker, x: attacker.x + (side === 'player' ? 14 : -14), y: attacker.y + (side === 'player' ? -7 : 7), duration: 110, ease: 'Quad.Out' });
    const presentation = movePresentation(move);
    const color = presentation.impactTint;
    const burst = this.add.particles(target.x, target.y, 'pixel-circle', { speed: { min: 25, max: 75 }, angle: { min: 0, max: 360 }, lifespan: 280, quantity: 12, scale: { start: 0.42, end: 0 }, tint: color, blendMode: 'ADD' }).setDepth(12);
    burst.explode(14);
    if (presentation.projectile) {
      const bolt = this.add.rectangle(attacker.x, attacker.y, presentation.projectileWidth, presentation.projectileHeight, color, 0.9).setDepth(11).setAngle(move.type === 'Wind' ? -25 : 0);
      await this.tween({ targets: bolt, x: target.x, y: target.y, duration: 220, ease: 'Quad.In' });
      bolt.destroy();
    }
    if (!gameStore.save?.options.reducedMotion) this.cameras.main.shake(move.power >= 90 ? 150 : 80, presentation.cameraShake);
    target.setAlpha(0.28); await this.wait(70); target.setAlpha(1);
    await this.tween({ targets: attacker, x: home.x, y: home.y, duration: 130, ease: 'Quad.In' });
    this.time.delayedCall(320, () => burst.destroy());
  }

  private async damageFlash(side: 'player' | 'enemy') {
    const target = side === 'player' ? this.playerSprite : this.enemySprite;
    await this.tween({ targets: target, alpha: 0.2, duration: 55, yoyo: true, repeat: 2 });
  }

  private async healAnimation(side: 'player' | 'enemy') {
    audio.sfx('heal');
    const target = side === 'player' ? this.playerSprite : this.enemySprite;
    const particles = this.add.particles(target.x, target.y + 18, 'pixel-circle', { speedY: { min: -45, max: -18 }, speedX: { min: -12, max: 12 }, lifespan: 650, quantity: 8, scale: { start: 0.28, end: 0 }, tint: 0x8de56d, blendMode: 'ADD' }).setDepth(12);
    particles.explode(12); await this.wait(520); particles.destroy();
  }

  private async captureAnimation(shakes: number, caught: boolean) {
    const start = { x: 36, y: 105 }, impact = { x: this.enemySprite.x, y: this.enemySprite.y - 5 }, groundY = 72;
    const enemyHomeScale = { x: this.enemySprite.scaleX, y: this.enemySprite.scaleY };
    const pod = this.add.image(start.x, start.y, 'capture-pod').setDisplaySize(18, 18).setDepth(20);
    const flight = { t: 0 }; audio.sfx('capture');
    await this.tween({ targets: flight, t: 1, duration: 430, ease: 'Cubic.Out', onUpdate: () => { pod.x = Phaser.Math.Linear(start.x, impact.x, flight.t); pod.y = Phaser.Math.Interpolation.Bezier([start.y, 35, impact.y], flight.t); pod.angle = flight.t * 620; } });
    const ring = this.add.circle(impact.x, impact.y, 5, 0xf6cf63, 0).setStrokeStyle(2, 0xf6cf63, 0.9).setDepth(19);
    this.tweens.add({ targets: ring, radius: 25, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
    const absorb = this.add.particles(impact.x, impact.y, 'pixel-circle', { speed: { min: 12, max: 42 }, angle: { min: 0, max: 360 }, lifespan: 320, quantity: 10, scale: { start: 0.24, end: 0 }, tint: [0xf6cf63, 0xf1f1d0], blendMode: 'ADD' }).setDepth(18);
    absorb.explode(16);
    await this.tween({ targets: this.enemySprite, scaleX: 0, scaleY: 0, alpha: 0, duration: 260, ease: 'Back.In' });
    pod.setPosition(impact.x, impact.y).setAngle(0); await this.tween({ targets: pod, y: groundY, duration: 230, ease: 'Bounce.Out' }); this.time.delayedCall(350, () => absorb.destroy());
    for (let i = 0; i < shakes; i += 1) {
      await this.wait(260); this.showText(['One…', 'Two…', 'Three…'][i]); audio.sfx('confirm');
      const direction = i % 2 ? 1 : -1;
      await this.tween({ targets: pod, x: pod.x + direction * 4, angle: direction * 18, duration: 105, ease: 'Sine.Out', yoyo: true });
      pod.clearTint();
    }
    if (caught) {
      await this.wait(220); this.showText('Click! The Prism Pod sealed!'); pod.setTint(0xffef9a); audio.sfx('victory');
      const success = this.add.particles(pod.x, pod.y, 'pixel-circle', { speed: { min: 20, max: 55 }, angle: { min: 200, max: 340 }, lifespan: 520, quantity: 8, gravityY: 35, scale: { start: 0.22, end: 0 }, tint: [0xffef9a, 0xb9ca68, 0xffffff], blendMode: 'ADD' }).setDepth(21);
      success.explode(14); this.cameras.main.flash(130, 246, 223, 125); await this.wait(420); success.destroy();
    } else {
      await this.wait(180); this.cameras.main.flash(110, 255, 244, 205);
      await this.tween({ targets: pod, scaleX: 1.35, scaleY: 1.35, alpha: 0, duration: 120 });
      this.enemySprite.setVisible(true).setScale(0).setAlpha(1);
      await this.tween({ targets: this.enemySprite, scaleX: enemyHomeScale.x, scaleY: enemyHomeScale.y, duration: 220, ease: 'Back.Out' });
    }
    pod.destroy();
  }

  private async processEvolutions(creature: CreatureInstance) {
    let next = evolutionAt(creature.speciesId, creature.level);
    while (next) {
      gameStore.save!.pendingEvolution = creature.uid;
      controls.clear();
      const evolved = await this.evolutionAnimation(creature, next);
      gameStore.save!.pendingEvolution = null;
      if (!evolved) break;
      next = evolutionAt(creature.speciesId, creature.level);
    }
  }

  private async processMoveLearning(creature: CreatureInstance, moveId: string) {
    const move = MOVES[moveId];
    const name = creature.nickname || SPECIES[creature.speciesId].name;
    const objects: Phaser.GameObjects.GameObject[] = [];
    objects.push(this.add.rectangle(120, 80, 240, 160, 0x08130d, 0.96).setDepth(50));
    objects.push(label(this, 120, 10, `Teach ${move.name} to ${name}?`, 8, '#f1f1d0', 52).setOrigin(0.5, 0));
    let cursor = 0;
    const draw = () => {
      objects.splice(2).forEach((o) => o.destroy());
      creature.moves.forEach((known, index) => {
        const selected = index === cursor;
        const y = 35 + index * 20;
        objects.push(this.add.rectangle(25, y, 190, 16, selected ? UI_COLORS.selection : 0x293828).setOrigin(0).setDepth(51));
        objects.push(label(this, 33, y + 4, `${MOVES[known.moveId].name}  PP ${known.pp}/${known.maxPp}`, 7, selected ? '#fff' : '#d7ddb8', 52));
        if (selected) drawSelectionBracket(this, 25, y, 190, 16, objects);
      });
      const selected = cursor === 4;
      objects.push(this.add.rectangle(25, 119, 190, 16, selected ? UI_COLORS.selection : 0x293828).setOrigin(0).setDepth(51));
      objects.push(label(this, 33, 123, 'DO NOT LEARN', 7, selected ? '#fff' : '#d7ddb8', 52));
      if (selected) drawSelectionBracket(this, 25, 119, 190, 16, objects);
      objects.push(label(this, 120, 143, 'A: CHOOSE  B: CANCEL', 6, '#aab7a0', 52).setOrigin(0.5, 0));
    };
    draw();
    controls.clear();
    while (true) {
      await this.wait(20);
      if (controls.pressed('UP')) { cursor = (cursor + 4) % 5; audio.sfx('confirm'); draw(); }
      if (controls.pressed('DOWN')) { cursor = (cursor + 1) % 5; audio.sfx('confirm'); draw(); }
      const cancel = controls.pressed('B');
      if (cancel) cursor = 4;
      if (controls.pressed('A') || cancel) break;
    }
    objects.forEach((o) => o.destroy());
    if (cursor === 4) { this.showText(`${name} did not learn ${move.name}.`); await this.wait(650); return; }
    const forgotten = MOVES[creature.moves[cursor].moveId].name;
    gameStore.learnMove(creature, moveId, cursor);
    this.showText(`${name} forgot ${forgotten} and learned ${move.name}!`);
    audio.sfx('victory');
    await this.wait(850);
  }

  private async offerShift(nextEnemyIndex: number) {
    if (this.context.kind !== 'trainer' || gameStore.save!.options.battleStyle !== 'shift') return null;
    const choices = this.context.player.party.map((c, i) => ({ creature: c, index: i })).filter(({ creature, index }) => index !== this.context.player.active && creature.currentHp > 0);
    if (!choices.length) return null;
    const incoming = SPECIES[this.context.enemy.party[nextEnemyIndex].speciesId].name;
    const objects: Phaser.GameObjects.GameObject[] = [];
    let cursor = 0;
    objects.push(this.add.rectangle(120, 80, 240, 160, 0x08130d, 0.96).setDepth(50));
    objects.push(label(this, 120, 9, `${this.trainer?.name ?? 'Trainer'} will send ${incoming}.`, 8, '#f1f1d0', 52).setOrigin(0.5, 0));
    objects.push(label(this, 120, 21, 'Choose a switch, or stay in.', 6, '#aab7a0', 52).setOrigin(0.5, 0));
    const draw = () => {
      objects.splice(3).forEach((o) => o.destroy());
      [...choices.map(({ creature }) => creature.nickname || SPECIES[creature.speciesId].name), 'STAY'].forEach((name, index) => {
        const selected = index === cursor;
        const y = 36 + index * 16;
        objects.push(this.add.rectangle(35, y, 170, 13, selected ? UI_COLORS.selection : 0x293828).setOrigin(0).setDepth(51));
        objects.push(label(this, 43, y + 3, name, 7, selected ? '#fff' : '#d7ddb8', 52));
        if (selected) drawSelectionBracket(this, 35, y, 170, 13, objects);
      });
    };
    draw();
    controls.clear();
    while (true) {
      await this.wait(20);
      if (controls.pressed('UP')) { cursor = (cursor + choices.length) % (choices.length + 1); audio.sfx('confirm'); draw(); }
      if (controls.pressed('DOWN')) { cursor = (cursor + 1) % (choices.length + 1); audio.sfx('confirm'); draw(); }
      const cancel = controls.pressed('B');
      if (cancel) cursor = choices.length;
      if (controls.pressed('A') || cancel) break;
    }
    objects.forEach((o) => o.destroy());
    return cursor === choices.length ? null : choices[cursor].index;
  }

  private async evolutionAnimation(creature: CreatureInstance, next: string) {
    const from = creature.speciesId;
    const oldName = creature.nickname || SPECIES[from].name;
    const newName = SPECIES[next].name;
    const overlay = this.add.rectangle(120, 80, 240, 160, 0x08130d, 0.94).setDepth(50);
    const title = label(this, 120, 18, `What? ${oldName} is evolving!`, 8, '#f1f1d0', 52).setOrigin(0.5, 0);
    const sprite = this.add.image(120, 82, `${from}-front`).setDisplaySize(88, 88).setDepth(51);
    const hint = label(this, 120, 141, 'B: CANCEL', 6, '#aab7a0', 52).setOrigin(0.5, 0);
    for (let i = 0; i < 8; i += 1) {
      sprite.setTexture(`${i % 2 ? next : from}-front`).setAlpha(i % 2 ? 0.55 : 1);
      await this.wait(120);
      if (controls.pressed('B')) { this.showText(`${oldName} stopped evolving.`); overlay.destroy(); title.destroy(); sprite.destroy(); hint.destroy(); await this.wait(650); return false; }
    }
    sprite.setAlpha(1).setTexture(`${next}-front`);
    this.cameras.main.flash(280, 241, 241, 208);
    audio.sfx('victory');
    gameStore.evolveCreature(creature, next);
    title.setText(`Congratulations! ${oldName} evolved into ${newName}!`);
    hint.setText('');
    await this.wait(1100);
    overlay.destroy(); title.destroy(); sprite.destroy(); hint.destroy();
    this.updateStatusText();
    return true;
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig) { return new Promise<void>((resolve) => this.tweens.add({ ...config, onComplete: () => resolve() })); }
  private wait(ms: number) { return new Promise<void>((resolve) => this.time.delayedCall(ms, () => resolve())); }
}

function drawSelectionBracket(scene: Phaser.Scene, x: number, y: number, w: number, h: number, objects: Phaser.GameObjects.GameObject[]) {
  const g = scene.add.graphics().setDepth(52);
  g.lineStyle(1, 0xd8d968, 1);
  g.beginPath().moveTo(x + 1, y + 4).lineTo(x + 1, y + 1).lineTo(x + 4, y + 1).strokePath();
  g.beginPath().moveTo(x + w - 5, y + 1).lineTo(x + w - 2, y + 1).lineTo(x + w - 2, y + 4).strokePath();
  objects.push(g);
}
