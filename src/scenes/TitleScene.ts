import Phaser from 'phaser';
import { configureGbaCamera } from '../display';
import { audio } from '../audio';
import { controls } from '../controls';
import { gameStore } from '../state';
import { configureAuthOverlay, hideAuthOverlay, removeAuthOverlay, setAuthOverlayStatus, showAuthOverlay } from '../authOverlay';
import { connectAuthSession, isLoggedIn, liveNetwork } from '../liveNetwork';
import { button, COLORS, label, panel, textStyle } from '../ui';

export class TitleScene extends Phaser.Scene {
  private selected = 0;
  private options: ReturnType<typeof button>[] = [];
  private authGateOpen = false;
  private authOff?: () => void;

  constructor() { super('Title'); }

  create() {
    configureGbaCamera(this);
    document.body.dataset.gameScene = 'title';
    this.options = [];
    this.selected = 0;
    this.authGateOpen = isLoggedIn();
    this.cameras.main.setBackgroundColor('#172519');
    this.add.image(120, 80, 'title-background').setDisplaySize(240, 160);
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x07140d, 0x07140d, 0x13251a, 0x13251a, .34).fillRect(0, 0, 240, 160);
    bg.fillStyle(0x08130d, .6).fillRoundedRect(42, 8, 156, 76, 9);
    bg.fillStyle(0x08130d, .68).fillRoundedRect(59, 89, 122, 63, 7);
    this.add.text(120, 23, 'GENERATION', textStyle(23, '#f1f4d1')).setOrigin(.5).setShadow(2, 2, '#101b13', 3).setStroke('#426146', 2);
    this.add.text(120, 47, 'LEAGUE', textStyle(30, '#e2c15d')).setOrigin(.5).setShadow(2, 2, '#101b13', 3).setStroke('#77503b', 2);
    label(this, 120, 74, 'A JOURNEY OF FIVE LINES', 7, '#e3e9c4').setOrigin(.5);
    panel(this, 63, 94, 114, 54, COLORS.paper, 10).setAlpha(.94);
    const names = gameStore.hasSave() ? ['CONTINUE', 'NEW JOURNEY'] : ['NEW JOURNEY'];
    this.options = names.map((name, index) => button(this, 72, 101 + index * 19, 96, name, () => this.choose(index), 20));
    this.selected = 0;
    this.refresh();
    label(this, 120, 151, '© 2026 ORIGINAL CREATURE RPG', 6, '#8fa183').setOrigin(.5);
    this.input.once('pointerdown', () => { audio.unlock(); audio.playMusic(this, 'village'); });
    controls.clear();
    this.setupAuthGate();
  }

  update() {
    if (!this.authGateOpen) return;
    if (controls.pressed('UP') || controls.pressed('DOWN')) { this.selected = (this.selected + 1) % this.options.length; audio.unlock(); audio.sfx('confirm'); this.refresh(); }
    if (controls.pressed('A')) this.choose(this.selected);
  }

  shutdown() {
    this.authOff?.();
    this.authOff = undefined;
    hideAuthOverlay();
  }

  private refresh() { this.options.forEach((entry, index) => entry.setSelected(index === this.selected)); }

  private setupAuthGate() {
    if (this.authGateOpen) return;
    connectAuthSession();
    configureAuthOverlay({
      onSubmit: (mode, username, password) => {
        liveNetwork.send(mode === 'register' ? 'auth:register' : 'auth:login', { username, password });
        setAuthOverlayStatus('CONTACTING CLOUD SERVICE...');
      },
      onGuestContinue: () => this.releaseAuthGate(),
      onClose: () => hideAuthOverlay(),
    });
    this.authOff = liveNetwork.onMessage((message) => {
      if (message.type === 'auth:ack') {
        localStorage.setItem('generation-league:auth:v1', JSON.stringify({
          accountId: message.payload.accountId,
          token: message.payload.token,
          displayName: message.payload.displayName,
        }));
        this.releaseAuthGate();
        return;
      }
      if (message.type === 'error') setAuthOverlayStatus(message.payload.message);
    });
    showAuthOverlay({ gate: true, status: 'SIGN IN TO PLAY ONLINE' });
  }

  private releaseAuthGate() {
    this.authGateOpen = true;
    hideAuthOverlay();
    audio.sfx('confirm');
  }

  private choose(index: number) {
    if (!this.authGateOpen) {
      audio.sfx('cancel');
      showAuthOverlay({ gate: true, status: 'SIGN IN OR CONTINUE AS GUEST' });
      return;
    }
    audio.unlock();
    audio.sfx('confirm');
    audio.playMusic(this, 'village');
    removeAuthOverlay();
    this.authOff?.();
    this.authOff = undefined;
    if (gameStore.hasSave() && index === 0) { gameStore.continueGame(); this.scene.start('Overworld'); }
    else this.scene.start('Intro');
  }
}
